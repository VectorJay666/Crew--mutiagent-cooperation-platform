"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { BotAvatar } from "./BotAvatar";
import { useAppStore } from "@/lib/store";
import { COLOR_MAP } from "@/lib/avatars";
import type { ChatMessage } from "@/lib/types";

export function MessageList({ threadId }: { threadId: string }) {
  const messages = useAppStore((s) => s.messages);
  const bots = useAppStore((s) => s.bots);
  const list = useMemo(
    () =>
      messages
        .filter((m) => m.threadId === threadId)
        .sort((a, b) => a.createdAt - b.createdAt),
    [messages, threadId]
  );
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [list.length, list[list.length - 1]?.content]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AnimatePresence initial={false}>
          {list.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              <MessageBubble message={m} />
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
    </div>
  );
}

function displayContent(content: string) {
  return content
    .replace(/\n?HANDOFF:\s*@?[^\n]+\|\s*[^\n]+/gi, "")
    .trim();
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const bots = useAppStore((s) => s.bots);

  if (message.kind === "activity") {
    return (
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--chip)] px-3 py-1.5 text-xs text-[var(--muted)]">
          <Sparkles size={12} className="text-[var(--accent)]" />
          <span>{message.content}</span>
          {message.meta?.action && (
            <span className="text-[var(--ink-soft)]">· {message.meta.action}</span>
          )}
        </div>
      </div>
    );
  }

  if (message.kind === "handoff") {
    const from = bots.find((b) => b.id === message.meta?.fromBotId);
    const to = bots.find((b) => b.id === message.meta?.toBotId);
    return (
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs shadow-[var(--shadow-soft)]">
          {from && <BotAvatar bot={from} size={22} showStatus={false} />}
          <span className="font-medium text-[var(--ink)]">{from?.name ?? "Bot"}</span>
          <ArrowRight size={12} className="text-[var(--accent)]" />
          {to && <BotAvatar bot={to} size={22} showStatus={false} />}
          <span className="font-medium text-[var(--ink)]">{to?.name ?? "Bot"}</span>
          <span className="max-w-[220px] truncate text-[var(--muted)]">{message.content}</span>
        </div>
      </div>
    );
  }

  if (message.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-[var(--ink)] px-4 py-3 text-[15px] leading-relaxed text-[var(--surface)]">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  const bot = bots.find((b) => b.id === message.botId);
  const soft = bot ? COLOR_MAP[bot.color].soft : "var(--chip)";

  return (
    <div className="flex items-start gap-3">
      {bot ? (
        <BotAvatar bot={bot} size={36} />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--chip)]">
          <Zap size={16} className="text-[var(--accent)]" />
        </div>
      )}
      <div className="min-w-0 max-w-[85%]">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-[var(--ink)]">{bot?.name ?? "Bot"}</span>
          <span className="text-[11px] text-[var(--muted)]">{bot?.title}</span>
        </div>
        <div
          className="rounded-3xl rounded-tl-lg px-4 py-3 text-[15px] leading-relaxed text-[var(--ink)] shadow-[var(--shadow-soft)]"
          style={{ background: soft }}
        >
          <p className="whitespace-pre-wrap">{displayContent(message.content) || "…"}</p>
        </div>
      </div>
    </div>
  );
}
