import { nanoid } from "nanoid";
import { chatCompletion, LlmError, streamChatCompletion } from "./llm";
import {
  botSystemPrompt,
  coordinatorPrompt,
  extractMentions,
  groupBotPrompt,
  parseHandoff,
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

async function pickSpeakers(
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
      speakers: mentioned.slice(0, 3),
      plan: `Honoring mentions: ${mentioned.map((m) => m.name).join(", ")}`,
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
      return {
        speakers: heuristicSpeakers(members, content),
        plan: parsed.plan ?? "Fallback heuristic routing",
      };
    }
    return {
      speakers: speakers.slice(0, 3),
      plan: parsed.plan ?? "Coordinator selected speakers",
    };
  } catch {
    const speakers = heuristicSpeakers(members, content);
    return {
      speakers,
      plan: `Coordinator failed; heuristic: ${speakers
        .map((s) => s.name)
        .join(", ")}`,
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

    const spoken = new Set<string>();
    let previous = req.content;

    for (const bot of speakers) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      emit({
        type: "status",
        botId: bot.id,
        status: "working",
        action: `Working on: ${previous.slice(0, 42)}`,
      });
      emit({ type: "speaker", botId: bot.id, name: bot.name });

      const userTurn =
        previous === req.content
          ? req.content
          : `${req.content}\n\n(Context from teammates)\n${previous}`;

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

      const handoff = parseHandoff(content);
      if (handoff) {
        const target = members.find(
          (m) => m.name.toLowerCase() === handoff.targetName.toLowerCase()
        );
        if (target) {
          emit({
            type: "handoff",
            fromBotId: bot.id,
            toBotId: target.id,
            reason: handoff.reason,
          });
          store.addMessage({
            threadId,
            kind: "handoff",
            content: handoff.reason,
            meta: { fromBotId: bot.id, toBotId: target.id },
          });

          const alreadyQueued = speakers.some((s) => s.id === target.id);
          if (!spoken.has(target.id) && !alreadyQueued) {
            emit({
              type: "status",
              botId: target.id,
              status: "working",
              action: handoff.reason,
            });
            emit({ type: "speaker", botId: target.id, name: target.name });
            await generateReply(
              target,
              groupBotPrompt(target, members),
              modelHistory(threadId),
              handoff.reason,
              settings,
              threadId,
              emit,
              signal
            );
            emit({ type: "status", botId: target.id, status: "idle" });
            spoken.add(target.id);
          }
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
