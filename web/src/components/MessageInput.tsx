"use client";

import { useMemo, useRef, useState } from "react";
import { AtSign, SendHorizontal, Square } from "lucide-react";
import clsx from "clsx";
import type { Bot } from "@/lib/types";
import { USE_BACKEND } from "@/lib/contract";

export function MessageInput({
  disabled,
  sending,
  placeholder,
  mentionable,
  onSend,
  onStop,
}: {
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
  mentionable: Bot[];
  onSend: (text: string, mentionBotIds: string[]) => void;
  onStop?: () => void;
}) {
  const [text, setText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const filtered = useMemo(() => {
    const q = mentionFilter.toLowerCase();
    return mentionable.filter(
      (b) => !q || b.name.toLowerCase().includes(q) || b.title.toLowerCase().includes(q)
    );
  }, [mentionable, mentionFilter]);

  function detectMention(value: string, caret: number) {
    const before = value.slice(0, caret);
    const match = before.match(/@([\w\u4e00-\u9fff]*)$/);
    if (match) {
      setShowMentions(true);
      setMentionFilter(match[1] ?? "");
    } else {
      setShowMentions(false);
      setMentionFilter("");
    }
  }

  function insertMention(bot: Bot) {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const replaced = before.replace(/@([\w\u4e00-\u9fff]*)$/, `@${bot.name} `);
    const next = replaced + after;
    setText(next);
    setShowMentions(false);
    requestAnimationFrame(() => {
      el.focus();
      const pos = replaced.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function submit() {
    const value = text.trim();
    if (!value || disabled || sending) return;
    const mentionBotIds = mentionable
      .filter((b) => new RegExp(`@${b.name}\\b`, "i").test(value))
      .map((b) => b.id);
    onSend(value, mentionBotIds);
    setText("");
    setShowMentions(false);
  }

  return (
    <div className="border-t border-[var(--line)] bg-[var(--panel)]/70 px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="relative mx-auto max-w-3xl">
        {showMentions && filtered.length > 0 && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-72 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
            {filtered.map((b) => (
              <button
                key={b.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--chip)]"
                onClick={() => insertMention(b)}
              >
                <AtSign size={14} className="text-[var(--accent)]" />
                <span className="font-medium text-[var(--ink)]">{b.name}</span>
                <span className="text-xs text-[var(--muted)]">{b.title}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-soft)]">
          <textarea
            ref={ref}
            value={text}
            rows={1}
            disabled={disabled}
            placeholder={placeholder ?? "给团队布置任务，用 @ 点名…"}
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
            onChange={(e) => {
              setText(e.target.value);
              detectMention(e.target.value, e.target.selectionStart);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          {sending ? (
            <button type="button" className="btn-primary !rounded-full !px-3" onClick={onStop}>
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              className={clsx("btn-primary !rounded-full !px-3", (!text.trim() || disabled) && "opacity-40")}
              disabled={!text.trim() || disabled}
              onClick={submit}
            >
              <SendHorizontal size={16} />
            </button>
          )}
        </div>
        <p className="mt-2 px-2 text-[11px] text-[var(--muted)]">
          {USE_BACKEND
            ? "Enter 发送 · Shift+Enter 换行 · 已连接后端，流式回复走真实模型"
            : "Enter 发送 · Shift+Enter 换行 · 前端演示模式可直接体验协作流，后端接入后自动走真实模型"}
        </p>
      </div>
    </div>
  );
}