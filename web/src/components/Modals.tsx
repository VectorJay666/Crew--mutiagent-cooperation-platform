"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { BOT_COLORS } from "@/lib/avatars";
import { USE_BACKEND } from "@/lib/contract";
import { useAppStore } from "@/lib/store";
import type { BotColor } from "@/lib/types";
import { BotAvatar } from "./BotAvatar";

export function ModalShell({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`w-full ${wide ? "max-w-xl" : "max-w-md"} rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-lg)]`}
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
              <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                {title}
              </h2>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  return (
    <ModalShell open={open} onClose={onClose} title="连接你的模型" wide>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">Base URL</span>
          <input
            className="field w-full"
            value={draft.baseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">API Key</span>
          <input
            className="field w-full"
            type="password"
            value={draft.apiKey}
            placeholder="sk-..."
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">Model</span>
            <input
              className="field w-full"
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">Temperature</span>
            <input
              className="field w-full"
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={draft.temperature}
              onChange={(e) =>
                setDraft({ ...draft, temperature: Number(e.target.value) || 0 })
              }
            />
          </label>
        </div>
        <p className="rounded-2xl bg-[var(--chip)] px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
          {USE_BACKEND ? (
            <>
              这些配置会随 <code className="text-[var(--ink-soft)]">POST /api/chat/stream</code>{" "}
              传给后端。当前已开启后端模式（
              <code className="text-[var(--ink-soft)]">NEXT_PUBLIC_USE_BACKEND=true</code>
              ）。
            </>
          ) : (
            <>
              前端会把这些配置随 <code className="text-[var(--ink-soft)]">POST /api/chat/stream</code>{" "}
              传给后端。当前默认是本地演示流；后端 agent 接好后设{" "}
              <code className="text-[var(--ink-soft)]">NEXT_PUBLIC_USE_BACKEND=true</code>。
            </>
          )}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setSettings(draft);
              onClose();
            }}
          >
            保存
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function NewBotModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createBot = useAppStore((s) => s.createBot);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [color, setColor] = useState<BotColor>("teal");

  useEffect(() => {
    if (!open) return;
    setName("");
    setTitle("");
    setDescription("");
    setSystemPrompt("");
    setColor("teal");
  }, [open]);

  const preview = {
    name: name || "New Bot",
    color,
    accessory: 0,
    status: "idle" as const,
    currentAction: undefined,
  };

  return (
    <ModalShell open={open} onClose={onClose} title="创建 Bot" wide>
      <div className="mb-4 flex items-center gap-3">
        <BotAvatar bot={preview} size={56} />
        <div>
          <div className="font-medium text-[var(--ink)]">{name || "未命名"}</div>
          <div className="text-xs text-[var(--muted)]">{title || "角色待定"}</div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">名字</span>
          <input className="field w-full" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">职称</span>
          <input className="field w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs text-[var(--muted)]">简介</span>
        <input
          className="field w-full"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs text-[var(--muted)]">System Prompt</span>
        <textarea
          className="field min-h-[88px] w-full"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
        />
      </label>
      <div className="mt-3">
        <span className="mb-2 block text-xs text-[var(--muted)]">头像色</span>
        <div className="flex flex-wrap gap-2">
          {BOT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full ring-2 ${color === c ? "ring-[var(--ink)]" : "ring-transparent"}`}
              style={{ background: `var(--bot-${c})` }}
              aria-label={c}
            />
          ))}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!name.trim()}
          onClick={() => {
            createBot({
              name,
              title: title || "Specialist",
              description: description || `${name} helps with focused work.`,
              systemPrompt:
                systemPrompt ||
                `You are ${name}. Be a helpful teammate with a clear specialty.`,
              color,
            });
            onClose();
          }}
        >
          创建
        </button>
      </div>
    </ModalShell>
  );
}

export function NewGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const bots = useAppStore((s) => s.bots);
  const createGroup = useAppStore((s) => s.createGroup);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setSelected(bots.slice(0, Math.min(3, bots.length)).map((b) => b.id));
  }, [open, bots]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 6 ? prev : [...prev, id]
    );
  }

  return (
    <ModalShell open={open} onClose={onClose} title="创建群组" wide>
      <label className="block">
        <span className="mb-1 block text-xs text-[var(--muted)]">群组名称</span>
        <input
          className="field w-full"
          value={name}
          placeholder="例如 Website Launch"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <p className="mt-3 text-xs text-[var(--muted)]">选择 2–6 位 Bot（已选 {selected.length}）</p>
      <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        {bots.map((b) => {
          const on = selected.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left ${
                on ? "bg-[var(--chip-strong)]" : "hover:bg-[var(--chip)]"
              }`}
            >
              <BotAvatar bot={b} size={34} showStatus={false} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--ink)]">{b.name}</div>
                <div className="text-xs text-[var(--muted)]">{b.title}</div>
              </div>
              <span className={`h-4 w-4 rounded-full border ${on ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--line)]"}`} />
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={selected.length < 2}
          onClick={() => {
            createGroup(name || "Team", selected);
            onClose();
          }}
        >
          创建群组
        </button>
      </div>
    </ModalShell>
  );
}
