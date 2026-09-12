import { nanoid } from "nanoid";
import type { ChatStreamRequest, StreamEvent } from "./contract";
import { HANDOFF_PATTERN, USE_BACKEND } from "./contract";
import { extractMentions } from "./prompts";
import type { ApiSettings, Bot } from "./types";
import { useAppStore } from "./store";

export type StreamHandlers = {
  onEvent: (event: StreamEvent) => void;
  signal?: AbortSignal;
};

/** Backend SSE when enabled; otherwise local mock for UI demo. */
export async function streamChat(
  req: ChatStreamRequest,
  handlers: StreamHandlers
): Promise<void> {
  if (USE_BACKEND) {
    await streamFromBackend(req, handlers);
    return;
  }
  await streamMock(req, handlers);
}

async function streamFromBackend(req: ChatStreamRequest, handlers: StreamHandlers) {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(req),
    signal: handlers.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Chat stream failed (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("data:"));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        handlers.onEvent(JSON.parse(data) as StreamEvent);
      } catch {
        // ignore malformed
      }
    }
  }
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

async function emitTokens(
  botId: string,
  text: string,
  onEvent: (e: StreamEvent) => void,
  signal?: AbortSignal
) {
  const messageId = `msg_${nanoid(8)}`;
  let content = "";
  for (const part of text.split(/(\s+)/)) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    content += part;
    onEvent({ type: "token", botId, content: part });
    await sleep(18 + Math.random() * 28, signal);
  }
  onEvent({ type: "message_done", botId, messageId, content });
  return content;
}

function parseHandoffLine(content: string): { targetName: string; reason: string } | null {
  const match = content.match(HANDOFF_PATTERN);
  if (!match) return null;
  return { targetName: match[1].trim(), reason: match[2].trim() };
}

async function streamMock(req: ChatStreamRequest, handlers: StreamHandlers) {
  const { onEvent, signal } = handlers;
  const state = useAppStore.getState();
  const settings: ApiSettings = {
    ...state.settings,
    ...(req.settings ?? {}),
    temperature: req.settings?.temperature ?? state.settings.temperature,
  };

  if (req.mode === "bot") {
    const bot = state.bots.find((b) => b.id === req.targetId);
    if (!bot) throw new Error("Bot not found");

    onEvent({ type: "status", botId: bot.id, status: "thinking", action: "Reading your message" });
    await sleep(400, signal);
    onEvent({ type: "status", botId: bot.id, status: "working", action: "Drafting reply" });
    onEvent({ type: "speaker", botId: bot.id, name: bot.name });
    await emitTokens(bot.id, mockSingleReply(bot, req.content, settings), onEvent, signal);
    onEvent({ type: "status", botId: bot.id, status: "done", action: "Done" });
    await sleep(400, signal);
    onEvent({ type: "status", botId: bot.id, status: "idle" });
    onEvent({ type: "done" });
    return;
  }

  const group = state.groups.find((g) => g.id === req.targetId);
  if (!group) throw new Error("Group not found");
  const members = state.bots.filter((b) => group.botIds.includes(b.id));
  const mentioned = extractMentions(req.content, members);
  const fromIds = req.mentionBotIds?.length
    ? members.filter((m) => req.mentionBotIds!.includes(m.id))
    : [];
  const speakers =
    fromIds.length > 0
      ? fromIds
      : mentioned.length > 0
        ? mentioned
        : pickSpeakers(members, req.content);

  onEvent({
    type: "activity",
    action: "Routing to team",
    detail: speakers.map((s) => s.name).join(" · "),
    botIds: speakers.map((s) => s.id),
  });
  await sleep(500, signal);

  let previous = req.content;
  for (const bot of speakers) {
    onEvent({
      type: "status",
      botId: bot.id,
      status: "working",
      action: `Working on: ${truncate(previous, 42)}`,
    });
    onEvent({ type: "speaker", botId: bot.id, name: bot.name });
    const full = await emitTokens(
      bot.id,
      mockGroupReply(bot, previous, members, settings),
      onEvent,
      signal
    );

    const handoff = parseHandoffLine(full);
    if (handoff) {
      const target = members.find(
        (m) => m.name.toLowerCase() === handoff.targetName.toLowerCase()
      );
      if (target) {
        onEvent({
          type: "handoff",
          fromBotId: bot.id,
          toBotId: target.id,
          reason: handoff.reason,
        });
        await sleep(350, signal);
        if (!speakers.some((s) => s.id === target.id)) {
          onEvent({ type: "status", botId: target.id, status: "working", action: handoff.reason });
          onEvent({ type: "speaker", botId: target.id, name: target.name });
          await emitTokens(
            target.id,
            mockGroupReply(target, handoff.reason, members, settings, true),
            onEvent,
            signal
          );
          onEvent({ type: "status", botId: target.id, status: "idle" });
        }
      }
    }

    onEvent({ type: "status", botId: bot.id, status: "idle" });
    previous = full;
    await sleep(280, signal);
  }

  onEvent({ type: "done" });
}

function pickSpeakers(members: Bot[], content: string): Bot[] {
  const lower = content.toLowerCase();
  const scored = members.map((b) => {
    let score = 0;
    if (/chief|staff|管理统筹/i.test(b.title) || b.name === "Vector") score += 2;
    if (/design|ui|ux|视觉|界面/.test(lower) && /design/i.test(b.title)) score += 5;
    if (/code|engineer|api|后端|前端|架构/.test(lower) && /engineer/i.test(b.title)) score += 5;
    if (/research|分析|调研|竞品/.test(lower) && /research/i.test(b.title)) score += 5;
    if (/plan|协调|安排|总结|团队/.test(lower) && /chief|staff|管理统筹/i.test(b.title)) score += 4;
    return { b, score };
  });
  scored.sort((a, c) => c.score - a.score);
  const top = scored.filter((s) => s.score > 0).slice(0, 3).map((s) => s.b);
  return top.length >= 2 ? top : members.slice(0, Math.min(3, members.length));
}

function mockSingleReply(bot: Bot, content: string, settings: ApiSettings): string {
  const configured = settings.apiKey ? "已读取你的 API 配置" : "当前为前端演示模式（未接后端）";
  return [
    `收到。我是 ${bot.name}（${bot.title}）。`,
    ``,
    `针对「${truncate(content, 80)}」，建议：`,
    `1. 先明确成功标准和截止时间`,
    `2. 拆成可并行小块再分配`,
    `3. 有决策点时再叫你确认`,
    ``,
    `${configured}。接上 POST /api/chat/stream 后走真实模型流。`,
  ].join("\n");
}

function mockGroupReply(
  bot: Bot,
  content: string,
  members: Bot[],
  settings: ApiSettings,
  isHandoff = false
): string {
  const others = members.filter((m) => m.id !== bot.id);
  const next = others[Math.floor(Math.random() * Math.max(others.length, 1))];
  const lines = [
    isHandoff ? `接过了——我从 ${bot.title} 视角继续。` : `${bot.name} 这边先说：`,
    ``,
    roleAdvice(bot, content),
  ];
  if (!isHandoff && next && (/chief|staff/i.test(bot.title) || Math.random() > 0.45)) {
    lines.push(``, `HANDOFF: @${next.name} | 请从你的专业角度补一版可执行细节`);
  } else {
    lines.push(``, `模型：${settings.model} · ${settings.apiKey ? "Key 已配置" : "演示模式"}`);
  }
  return lines.join("\n");
}

function roleAdvice(bot: Bot, content: string): string {
  if (/design/i.test(bot.title)) {
    return `界面压成「花名册 + 对话 + 状态」三层，首屏只留品牌、目标和输入。任务：「${truncate(content, 60)}」。`;
  }
  if (/engineer/i.test(bot.title)) {
    return `技术建议：前端 SSE 消费 StreamEvent；后端编排 speakers / handoff。契约在 contracts/api.ts。`;
  }
  if (/research/i.test(bot.title)) {
    return `对齐 Grok Bot 原语：roster、presence、group handoff、activity cards。Computer 预览可二期。`;
  }
  return `我来协调：先对齐目标，再让对应角色接力。当前：「${truncate(content, 60)}」。`;
}

function truncate(s: string, n: number) {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export async function fetchHealth(): Promise<boolean> {
  if (!USE_BACKEND) return false;
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return false;
    const json = (await res.json()) as { ok?: boolean };
    return json.ok === true;
  } catch {
    return false;
  }
}
