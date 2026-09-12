"use client";

import { useMemo, useRef, useState } from "react";
import { MoreHorizontal, Trash2, Users } from "lucide-react";
import { BotAvatar } from "./BotAvatar";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { streamChat } from "@/lib/api";
import type { StreamEvent } from "@/lib/contract";
// StreamEvent mirrored from contracts/api.ts (CONTRACT_VERSION 0.1.0)
import { useAppStore } from "@/lib/store";
import { nanoid } from "nanoid";

export function ChatPanel() {
  const activeThreadId = useAppStore((s) => s.activeThreadId);
  const threads = useAppStore((s) => s.threads);
  const bots = useAppStore((s) => s.bots);
  const groups = useAppStore((s) => s.groups);
  const messages = useAppStore((s) => s.messages);
  const settings = useAppStore((s) => s.settings);
  const addMessage = useAppStore((s) => s.addMessage);
  const appendToMessage = useAppStore((s) => s.appendToMessage);
  const updateMessage = useAppStore((s) => s.updateMessage);
  const setBotStatus = useAppStore((s) => s.setBotStatus);
  const clearThread = useAppStore((s) => s.clearThread);

  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamingIds = useRef<Record<string, string>>({});

  const thread = threads.find((t) => t.id === activeThreadId) ?? null;
  const bot = thread?.type === "bot" ? bots.find((b) => b.id === thread.targetId) : null;
  const group = thread?.type === "group" ? groups.find((g) => g.id === thread.targetId) : null;
  const members = useMemo(() => {
    if (bot) return [bot];
    if (group) return bots.filter((b) => group.botIds.includes(b.id));
    return [];
  }, [bot, group, bots]);

  async function handleSend(content: string, mentionBotIds: string[]) {
    if (!thread || sending) return;
    setSending(true);
    streamingIds.current = {};

    addMessage({
      threadId: thread.id,
      kind: "user",
      content,
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        {
          threadId: thread.id,
          mode: thread.type,
          targetId: thread.targetId,
          content,
          mentionBotIds,
          settings,
        },
        {
          signal: controller.signal,
          onEvent: (event) => applyEvent(thread.id, event),
        }
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        addMessage({
          threadId: thread.id,
          kind: "activity",
          content: `出错了：${(err as Error).message}`,
        });
      }
    } finally {
      setSending(false);
      abortRef.current = null;
      members.forEach((m) => setBotStatus(m.id, "idle"));
    }
  }

  function applyEvent(threadId: string, event: StreamEvent) {
    switch (event.type) {
      case "status":
        if (event.botId) setBotStatus(event.botId, event.status as never, event.action);
        break;
      case "speaker": {
        const id = `msg_${nanoid(10)}`;
        streamingIds.current[event.botId] = id;
        addMessage({
          id,
          threadId,
          kind: "assistant",
          botId: event.botId,
          content: "",
        });
        break;
      }
      case "token": {
        const id = streamingIds.current[event.botId];
        if (id) appendToMessage(id, event.content);
        break;
      }
      case "message_done": {
        const id = streamingIds.current[event.botId] ?? event.messageId;
        updateMessage(id, { content: event.content });
        streamingIds.current[event.botId] = id;
        break;
      }
      case "handoff":
        addMessage({
          threadId,
          kind: "handoff",
          content: event.reason,
          meta: { fromBotId: event.fromBotId, toBotId: event.toBotId },
        });
        break;
      case "activity":
        addMessage({
          threadId,
          kind: "activity",
          content: event.action,
          meta: { action: event.detail, speakers: event.botIds },
        });
        break;
      case "error":
        addMessage({
          threadId,
          kind: "activity",
          content: event.message,
        });
        break;
      default:
        break;
    }
  }

  if (!thread) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-[var(--muted)]">
        从左侧选择一个 Bot 或群组开始
      </div>
    );
  }

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel)]/60 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {bot && <BotAvatar bot={bot} size={44} />}
          {group && (
            <div className="flex -space-x-2">
              {members.slice(0, 4).map((m) => (
                <BotAvatar key={m.id} bot={m} size={34} className="ring-2 ring-[var(--surface)]" />
              ))}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              {bot?.name ?? group?.name}
            </h1>
            <p className="truncate text-xs text-[var(--muted)]">
              {bot
                ? `${bot.title} · ${bot.currentAction || bot.description}`
                : `${members.length} 位队友 · 可见交接与并行协作`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {group && (
            <span className="hidden items-center gap-1 rounded-full bg-[var(--chip)] px-2.5 py-1 text-[11px] text-[var(--muted)] sm:inline-flex">
              <Users size={12} />
              Group
            </span>
          )}
          <button
            type="button"
            className="icon-btn"
            title="清空对话"
            onClick={() => clearThread(thread.id)}
          >
            <Trash2 size={16} />
          </button>
          <button type="button" className="icon-btn" title="更多">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </header>

      {messages.some((m) => m.threadId === thread.id) ? (
        <MessageList threadId={thread.id} />
      ) : (
        <EmptyHero
          title={bot?.name ?? group?.name ?? "Crew"}
          subtitle={
            bot
              ? bot.description
              : "像给同事发消息一样布置任务。用 @ 点名，或让协调者自动路由。"
          }
        />
      )}

      <MessageInput
        sending={sending}
        mentionable={members}
        placeholder={
          bot ? `给 ${bot.name} 发消息…` : `给 ${group?.name ?? "团队"} 布置任务，用 @ 点名…`
        }
        onSend={handleSend}
        onStop={() => abortRef.current?.abort()}
      />
    </section>
  );
}

function EmptyHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6">
      <div className="hero-aura" aria-hidden />
      <div className="relative z-[1] max-w-md text-center">
        <p className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-[var(--ink)] md:text-5xl">
          {title}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">{subtitle}</p>
      </div>
    </div>
  );
}
