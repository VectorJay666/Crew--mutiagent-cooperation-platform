import { nanoid } from "nanoid";
import { chatCompletion, LlmError, streamChatCompletion } from "./llm";
import {
  botSystemPrompt,
  coordinatorPrompt,
  extractMentions,
  groupBotPrompt,
  isBroadcastIntent,
  parseHandoffs,
  transcriptForModel,
} from "../prompts";
import { store } from "./store-io";
import type { ApiSettings, Bot, Group } from "../types";
import type { ChatStreamRequest, StreamEvent } from "../contract";

function resolveSettings(req: ChatStreamRequest): ApiSettings {
  const saved = store.getSettings();
  const fromReq = req.settings;
  return {
    baseUrl: fromReq?.baseUrl || saved.baseUrl,
    apiKey: fromReq?.apiKey || saved.apiKey,
    model: fromReq?.model || saved.model,
    temperature: fromReq?.temperature ?? saved.temperature ?? 0.7,
  };
}

const BROADCAST_SPEAKER_CAP = 8;
const PLAN_DETAIL_MAX = 180;

function heuristicSpeakers(members: Bot[], content: string): Bot[] {
  const lower = content.toLowerCase();
  const scored = members.map((b) => {
    let score = 0;
    if (b.title.toLowerCase().includes("chief") || b.name === "Nova") score += 2;
    if (/design|ui|ux|视觉|界面/.test(lower) && /design/i.test(b.title)) score += 5;
    if (
      /code|engineer|api|后端|前端|架构/.test(lower) &&
      /engineer/i.test(b.title)
    ) {
      score += 5;
    }
    if (/research|分析|调研|竞品/.test(lower) && /research/i.test(b.title)) {
      score += 5;
    }
    if (
      /plan|协调|安排|总结|团队/.test(lower) &&
      /chief|staff/i.test(b.title)
    ) {
      score += 4;
    }
    return { b, score };
  });
  scored.sort((a, c) => c.score - a.score);
  const top = scored.filter((s) => s.score > 0).slice(0, 3).map((s) => s.b);
  if (top.length >= 1) return top;
  return members.slice(0, Math.min(2, members.length));
}

function allGroupSpeakers(members: Bot[]): Bot[] {
  return members.slice(0, BROADCAST_SPEAKER_CAP);
}

export function maxGroupTurns(memberCount: number): number {
  return Math.max(8, memberCount * 2);
}

function redactSecrets(text: string, apiKey?: string): string {
  let s = text;
  if (apiKey && apiKey.length > 3) {
    s = s.split(apiKey).join("[redacted]");
  }
  s = s.replace(/sk-[a-zA-Z0-9_-]{8,}/g, "[redacted]");
  s = s.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  return s.replace(/\s+/g, " ").trim();
}

/** Short, safe parenthetical for activity/plan. Never includes API keys. */
export function describeCoordinatorFailure(
  err: unknown,
  apiKey?: string
): string {
  if (err instanceof LlmError) {
    const body = redactSecrets(
      err.message.replace(/^LLM error \(\d+\):\s*/i, ""),
      apiKey
    );
    const extra = body ? ` / ${body.slice(0, 60)}` : "";
    return `HTTP ${err.status}${extra}`;
  }
  if (err instanceof SyntaxError) return "invalid JSON";
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (/json|unexpected token|unexpected end/.test(msg)) return "invalid JSON";
    return redactSecrets(err.message, apiKey).slice(0, 60) || "unknown error";
  }
  return "unknown error";
}

function logCoordinatorFailure(err: unknown, extra?: Record<string, unknown>) {
  if (err instanceof LlmError) {
    console.error("Coordinator failed", {
      status: err.status,
      body: err.message,
      ...extra,
    });
    return;
  }
  console.error("Coordinator failed", err, extra ?? "");
}

function truncatePlan(plan: string): string {
  const oneLine = plan.replace(/\s+/g, " ").trim();
  return oneLine.length > PLAN_DETAIL_MAX
    ? `${oneLine.slice(0, PLAN_DETAIL_MAX - 1)}…`
    : oneLine;
}

function heuristicPlan(reason: string, speakers: Bot[]): string {
  return truncatePlan(
    `Coordinator failed (${reason}); heuristic: ${speakers
      .map((s) => s.name)
      .join(", ")}`
  );
}

export async function pickSpeakers(
  members: Bot[],
  group: Group,
  content: string,
  mentionBotIds: string[] | undefined,
  settings: ApiSettings,
  history: ReturnType<typeof transcriptForModel>,
  signal?: AbortSignal
): Promise<{ speakers: Bot[]; plan: string }> {
  const mentionedById = mentionBotIds
    ?.map((id) => members.find((m) => m.id === id))
    .filter((b): b is Bot => Boolean(b));
  const mentionedByText = extractMentions(content, members);
  const mentioned = [
    ...new Map(
      [...(mentionedById ?? []), ...mentionedByText].map((b) => [b.id, b])
    ).values(),
  ];

  if (mentioned.length > 0) {
    return {
      speakers: mentioned.slice(0, BROADCAST_SPEAKER_CAP),
      plan: `Honoring mentions: ${mentioned.map((m) => m.name).join(", ")}`,
    };
  }

  if (isBroadcastIntent(content)) {
    const speakers = allGroupSpeakers(members);
    return {
      speakers,
      plan: "Broadcast: all members",
    };
  }

  if (!settings.apiKey) {
    const speakers = heuristicSpeakers(members, content);
    return {
      speakers,
      plan: `Heuristic route: ${speakers.map((s) => s.name).join(", ")}`,
    };
  }

  try {
    const raw = await chatCompletion(
      settings,
      [
        { role: "system", content: coordinatorPrompt(members, group) },
        ...history,
        { role: "user", content },
      ],
      { temperature: 0.2, signal }
    );
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? raw) as {
      speakers?: string[];
      plan?: string;
    };
    const speakers = (parsed.speakers ?? [])
      .map((name) =>
        members.find((m) => m.name.toLowerCase() === name.toLowerCase())
      )
      .filter((b): b is Bot => Boolean(b));

    if (speakers.length === 0) {
      console.error("Coordinator returned no speakers", {
        raw: String(raw).slice(0, 400),
        parsed,
      });
      const fallback = heuristicSpeakers(members, content);
      return {
        speakers: fallback,
        plan: heuristicPlan(parsed.plan || "empty speakers", fallback),
      };
    }
    const cap = isBroadcastIntent(content)
      ? BROADCAST_SPEAKER_CAP
      : 3;
    return {
      speakers: speakers.slice(0, cap),
      plan: parsed.plan ?? "Coordinator selected speakers",
    };
  } catch (err) {
    logCoordinatorFailure(err);
    const speakers = heuristicSpeakers(members, content);
    return {
      speakers,
      plan: heuristicPlan(
        describeCoordinatorFailure(err, settings.apiKey),
        speakers
      ),
    };
  }
}

function modelHistory(threadId: string) {
  const all = transcriptForModel(store.getMessages(threadId), store.botsById());
  // Drop trailing user — generateReply always appends the active user turn.
  const last = all[all.length - 1];
  if (last?.role === "user") {
    return all.slice(0, -1);
  }
  return all;
}

async function generateReply(
  bot: Bot,
  system: string,
  history: ReturnType<typeof transcriptForModel>,
  userContent: string,
  settings: ApiSettings,
  threadId: string,
  emit: (e: StreamEvent) => void,
  signal?: AbortSignal
): Promise<string> {
  const messageId = `msg_${nanoid(8)}`;
  let content = "";

  if (!settings.apiKey) {
    content = [
      `收到。我是 ${bot.name}（${bot.title}）。`,
      "",
      `针对「${userContent.trim().slice(0, 80)}」，后端已收到请求，但尚未配置 API Key。`,
      "请在 Settings 中填写 baseUrl / apiKey / model，或设置环境变量 LLM_API_KEY。",
    ].join("\n");
    for (const part of content.split(/(\s+)/)) {
      if (!part) continue;
      emit({ type: "token", botId: bot.id, content: part });
    }
  } else {
    for await (const token of streamChatCompletion(
      settings,
      [
        { role: "system", content: system },
        ...history,
        { role: "user", content: userContent },
      ],
      { signal }
    )) {
      content += token;
      emit({ type: "token", botId: bot.id, content: token });
    }
    if (!content.trim()) {
      content = `(${bot.name} returned an empty reply)`;
      emit({ type: "token", botId: bot.id, content });
    }
  }

  emit({ type: "message_done", botId: bot.id, messageId, content });
  store.addMessage({
    id: messageId,
    threadId,
    kind: "assistant",
    botId: bot.id,
    content,
  });
  return content;
}

export async function runChatStream(
  req: ChatStreamRequest,
  emit: (e: StreamEvent) => void,
  signal?: AbortSignal
) {
  const settings = resolveSettings(req);
  store.ensureThread(req.mode, req.targetId);
  const threadId = req.threadId || `thread_${req.targetId}`;
  if (!store.listThreads().some((t) => t.id === threadId)) {
    store.ensureThread(req.mode, req.targetId);
  }

  store.addMessage({
    threadId,
    kind: "user",
    content: req.content,
  });

  try {
    if (req.mode === "bot") {
      const bot = store.getBot(req.targetId);
      if (!bot) {
        emit({ type: "error", message: "Bot not found" });
        emit({ type: "done" });
        return;
      }

      emit({
        type: "status",
        botId: bot.id,
        status: "thinking",
        action: "Reading your message",
      });
      emit({
        type: "status",
        botId: bot.id,
        status: "working",
        action: "Drafting reply",
      });
      emit({ type: "speaker", botId: bot.id, name: bot.name });

      await generateReply(
        bot,
        botSystemPrompt(bot),
        modelHistory(threadId),
        req.content,
        settings,
        threadId,
        emit,
        signal
      );

      emit({ type: "status", botId: bot.id, status: "done", action: "Done" });
      emit({ type: "status", botId: bot.id, status: "idle" });
      emit({ type: "done" });
      return;
    }

    const group = store.getGroup(req.targetId);
    if (!group) {
      emit({ type: "error", message: "Group not found" });
      emit({ type: "done" });
      return;
    }

    const members = store.listBots().filter((b) => group.botIds.includes(b.id));
    const { speakers, plan } = await pickSpeakers(
      members,
      group,
      req.content,
      req.mentionBotIds,
      settings,
      modelHistory(threadId),
      signal
    );

    emit({
      type: "activity",
      action: "Routing to team",
      detail: plan,
      botIds: speakers.map((s) => s.id),
    });
    store.addMessage({
      threadId,
      kind: "activity",
      content: plan,
      meta: { action: "routing", speakers: speakers.map((s) => s.name) },
    });

    type WorkItem = { bot: Bot; handoffReason?: string };
    const work: WorkItem[] = speakers.map((bot) => ({ bot }));
    const queuedIds = new Set(speakers.map((s) => s.id));
    const spoken = new Set<string>();
    let previous = req.content;
    let turns = 0;
    const turnCap = maxGroupTurns(members.length);

    while (work.length > 0) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (turns >= turnCap) break;

      const item = work.shift()!;
      const bot = item.bot;
      if (spoken.has(bot.id)) continue;

      const userTurn = item.handoffReason
        ? item.handoffReason
        : previous === req.content
          ? req.content
          : `${req.content}\n\n(Context from teammates)\n${previous}`;

      emit({
        type: "status",
        botId: bot.id,
        status: "working",
        action: item.handoffReason ?? `Working on: ${previous.slice(0, 42)}`,
      });
      emit({ type: "speaker", botId: bot.id, name: bot.name });

      const content = await generateReply(
        bot,
        groupBotPrompt(bot, members),
        modelHistory(threadId),
        userTurn,
        settings,
        threadId,
        emit,
        signal
      );
      spoken.add(bot.id);
      turns += 1;

      for (const hop of parseHandoffs(content)) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const target = members.find(
          (m) => m.name.toLowerCase() === hop.targetName.toLowerCase()
        );
        if (!target) continue;

        emit({
          type: "handoff",
          fromBotId: bot.id,
          toBotId: target.id,
          reason: hop.reason,
        });
        store.addMessage({
          threadId,
          kind: "handoff",
          content: hop.reason,
          meta: { fromBotId: bot.id, toBotId: target.id },
        });

        if (
          !spoken.has(target.id) &&
          !queuedIds.has(target.id) &&
          turns + work.length < turnCap
        ) {
          work.push({ bot: target, handoffReason: hop.reason });
          queuedIds.add(target.id);
        }
      }

      emit({ type: "status", botId: bot.id, status: "idle" });
      previous = content;
    }

    emit({ type: "done" });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      emit({ type: "error", message: "Aborted" });
      emit({ type: "done" });
      return;
    }
    const message =
      err instanceof LlmError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";
    emit({ type: "error", message });
    emit({ type: "done" });
  }
}
