"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Settings,
  Users,
  Search,
  Pin,
  MessageSquare,
} from "lucide-react";
import clsx from "clsx";
import { BotAvatar } from "./BotAvatar";
import { useAppStore } from "@/lib/store";
import type { Bot, Group, Thread } from "@/lib/types";

export function Sidebar({
  onOpenSettings,
  onNewBot,
  onNewGroup,
}: {
  onOpenSettings: () => void;
  onNewBot: () => void;
  onNewGroup: () => void;
}) {
  const bots = useAppStore((s) => s.bots);
  const groups = useAppStore((s) => s.groups);
  const threads = useAppStore((s) => s.threads);
  const messages = useAppStore((s) => s.messages);
  const activeThreadId = useAppStore((s) => s.activeThreadId);
  const setActiveThread = useAppStore((s) => s.setActiveThread);
  const ensureThread = useAppStore((s) => s.ensureThread);
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    const botItems = bots
      .filter((b) => !query || b.name.toLowerCase().includes(query) || b.title.toLowerCase().includes(query))
      .map((bot) => {
        const thread = threads.find((t) => t.type === "bot" && t.targetId === bot.id);
        return { kind: "bot" as const, bot, thread, sort: thread?.updatedAt ?? bot.createdAt };
      });
    const groupItems = groups
      .filter((g) => !query || g.name.toLowerCase().includes(query))
      .map((group) => {
        const thread = threads.find((t) => t.type === "group" && t.targetId === group.id);
        return { kind: "group" as const, group, thread, sort: thread?.updatedAt ?? group.createdAt };
      });
    return [...groupItems, ...botItems].sort((a, b) => {
      const ap = a.kind === "bot" && a.bot.pinned ? 1 : 0;
      const bp = b.kind === "bot" && b.bot.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return b.sort - a.sort;
    });
  }, [bots, groups, threads, q]);

  function preview(thread?: Thread) {
    if (!thread) return "还没有消息";
    const last = [...messages].reverse().find((m) => m.threadId === thread.id && m.kind !== "activity");
    if (!last) return "还没有消息";
    return last.content.replace(/\s+/g, " ").slice(0, 48);
  }

  function openBot(bot: Bot) {
    const t = ensureThread("bot", bot.id);
    setActiveThread(t.id);
  }

  function openGroup(group: Group) {
    const t = ensureThread("group", group.id);
    setActiveThread(t.id);
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-[var(--line)] bg-[var(--panel)]/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 pb-3 pt-5">
        <div>
          <div className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]">
            Crew
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">多智能体协作工作台</p>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="icon-btn"
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      <div className="px-3 pb-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索 Bot / 群组"
            className="field w-full pl-9"
          />
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={onNewBot}>
            <Plus size={15} />
            新建 Bot
          </button>
          <button type="button" className="btn-secondary flex-1" onClick={onNewGroup}>
            <Users size={15} />
            新建群组
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            if (item.kind === "group") {
              const active = item.thread?.id === activeThreadId;
              const memberBots = bots.filter((b) => item.group.botIds.includes(b.id));
              return (
                <motion.button
                  layout
                  key={item.group.id}
                  type="button"
                  onClick={() => openGroup(item.group)}
                  className={clsx("roster-row", active && "roster-row-active")}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="relative h-10 w-10 shrink-0">
                    {memberBots.slice(0, 3).map((b, i) => (
                      <div
                        key={b.id}
                        className="absolute"
                        style={{ left: i * 10, top: i * 4, zIndex: 3 - i }}
                      >
                        <BotAvatar bot={b} size={24} showStatus={false} />
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <Users size={12} className="text-[var(--accent)]" />
                      <span className="truncate text-sm font-medium text-[var(--ink)]">
                        {item.group.name}
                      </span>
                    </div>
                    <p className="truncate text-xs text-[var(--muted)]">{preview(item.thread)}</p>
                  </div>
                </motion.button>
              );
            }

            const active = item.thread?.id === activeThreadId;
            return (
              <motion.button
                layout
                key={item.bot.id}
                type="button"
                onClick={() => openBot(item.bot)}
                className={clsx("roster-row", active && "roster-row-active")}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <BotAvatar bot={item.bot} size={40} />
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    {item.bot.pinned && <Pin size={11} className="text-[var(--accent)]" />}
                    <span className="truncate text-sm font-medium text-[var(--ink)]">
                      {item.bot.name}
                    </span>
                    <span className="truncate text-[11px] text-[var(--muted)]">
                      {item.bot.title}
                    </span>
                  </div>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {item.bot.status !== "idle" && item.bot.currentAction
                      ? item.bot.currentAction
                      : preview(item.thread)}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="px-3 py-10 text-center text-sm text-[var(--muted)]">
            <MessageSquare className="mx-auto mb-2 opacity-50" size={22} />
            没有匹配的 Bot
          </div>
        )}
      </div>
    </aside>
  );
}
