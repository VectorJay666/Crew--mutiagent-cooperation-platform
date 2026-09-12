import { nanoid } from "nanoid";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BOT_COLORS, DEFAULT_BOTS } from "./avatars";
import type {
  ApiSettings,
  AppState,
  Bot,
  BotColor,
  BotStatus,
  ChatMessage,
  Group,
  Thread,
} from "./types";
import { STORE_PERSIST_KEY, botThreadId, groupThreadId } from "./types";

function seedBots(): Bot[] {
  const now = Date.now();
  return DEFAULT_BOTS.map((b, i) => ({
    id: `bot_${i + 1}`,
    name: b.name,
    title: b.title,
    description: b.description,
    systemPrompt: b.systemPrompt,
    color: b.color,
    accessory: b.accessory,
    status: "idle" as BotStatus,
    pinned: i === 0,
    createdAt: now - (DEFAULT_BOTS.length - i) * 1000,
  }));
}

function seedGroup(bots: Bot[]): { group: Group; thread: Thread } {
  const group: Group = {
    id: "group_1",
    name: "Product Launch",
    botIds: bots.slice(0, 4).map((b) => b.id),
    createdAt: Date.now(),
  };
  const thread: Thread = {
    id: groupThreadId(group.id),
    type: "group",
    targetId: group.id,
    updatedAt: Date.now(),
  };
  return { group, thread };
}

const seeded = seedBots();
const seededGroup = seedGroup(seeded);
const botThreads: Thread[] = seeded.map((b) => ({
  id: botThreadId(b.id),
  type: "bot" as const,
  targetId: b.id,
  updatedAt: Date.now() - 10_000,
}));

const defaultSettings: ApiSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.7,
};

interface Store extends AppState {
  setHydrated: (v: boolean) => void;
  setActiveThread: (id: string | null) => void;
  setSettings: (s: Partial<ApiSettings>) => void;
  upsertBot: (bot: Bot) => void;
  createBot: (input: {
    name: string;
    title: string;
    description: string;
    systemPrompt: string;
    color?: BotColor;
  }) => Bot;
  updateBot: (id: string, patch: Partial<Bot>) => void;
  removeBot: (id: string) => void;
  setBotStatus: (id: string, status: BotStatus, action?: string) => void;
  createGroup: (name: string, botIds: string[]) => Group;
  updateGroup: (id: string, patch: Partial<Group>) => void;
  removeGroup: (id: string) => void;
  ensureThread: (type: "bot" | "group", targetId: string) => Thread;
  addMessage: (msg: Omit<ChatMessage, "id" | "createdAt"> & { id?: string }) => ChatMessage;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  appendToMessage: (id: string, token: string) => void;
  getThreadMessages: (threadId: string) => ChatMessage[];
  clearThread: (threadId: string) => void;
}

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      bots: seeded,
      groups: [seededGroup.group],
      threads: [...botThreads, seededGroup.thread],
      messages: [],
      settings: defaultSettings,
      activeThreadId: seededGroup.thread.id,
      hydrated: false,

      setHydrated: (v) => set({ hydrated: v }),
      setActiveThread: (id) => set({ activeThreadId: id }),
      setSettings: (s) => set({ settings: { ...get().settings, ...s } }),

      upsertBot: (bot) =>
        set({
          bots: get().bots.some((b) => b.id === bot.id)
            ? get().bots.map((b) => (b.id === bot.id ? bot : b))
            : [...get().bots, bot],
        }),

      createBot: (input) => {
        const used = new Set(get().bots.map((b) => b.color));
        const color =
          input.color ??
          BOT_COLORS.find((c) => !used.has(c)) ??
          BOT_COLORS[get().bots.length % BOT_COLORS.length];
        const bot: Bot = {
          id: `bot_${nanoid(8)}`,
          name: input.name.trim(),
          title: input.title.trim(),
          description: input.description.trim(),
          systemPrompt: input.systemPrompt.trim(),
          color,
          accessory: get().bots.length % 6,
          status: "idle",
          createdAt: Date.now(),
        };
        const thread: Thread = {
          id: botThreadId(bot.id),
          type: "bot",
          targetId: bot.id,
          updatedAt: Date.now(),
        };
        set({
          bots: [...get().bots, bot],
          threads: [...get().threads, thread],
          activeThreadId: thread.id,
        });
        return bot;
      },

      updateBot: (id, patch) =>
        set({ bots: get().bots.map((b) => (b.id === id ? { ...b, ...patch } : b)) }),

      removeBot: (id) => {
        const threadId = botThreadId(id);
        set({
          bots: get().bots.filter((b) => b.id !== id),
          groups: get().groups.map((g) => ({
            ...g,
            botIds: g.botIds.filter((bid) => bid !== id),
          })),
          threads: get().threads.filter((t) => t.targetId !== id),
          messages: get().messages.filter((m) => m.threadId !== threadId),
          activeThreadId:
            get().activeThreadId === threadId
              ? get().threads.find((t) => t.id !== threadId)?.id ?? null
              : get().activeThreadId,
        });
      },

      setBotStatus: (id, status, action) =>
        set({
          bots: get().bots.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status,
                  currentAction:
                    action ?? (status === "idle" ? undefined : b.currentAction),
                }
              : b
          ),
        }),

      createGroup: (name, botIds) => {
        const group: Group = {
          id: `group_${nanoid(8)}`,
          name: name.trim() || "Team",
          botIds,
          createdAt: Date.now(),
        };
        const thread: Thread = {
          id: groupThreadId(group.id),
          type: "group",
          targetId: group.id,
          updatedAt: Date.now(),
        };
        set({
          groups: [...get().groups, group],
          threads: [...get().threads, thread],
          activeThreadId: thread.id,
        });
        return group;
      },

      updateGroup: (id, patch) =>
        set({ groups: get().groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) }),

      removeGroup: (id) => {
        const threadId = groupThreadId(id);
        set({
          groups: get().groups.filter((g) => g.id !== id),
          threads: get().threads.filter((t) => t.targetId !== id),
          messages: get().messages.filter((m) => m.threadId !== threadId),
          activeThreadId:
            get().activeThreadId === threadId
              ? get().threads.find((t) => t.id !== threadId)?.id ?? null
              : get().activeThreadId,
        });
      },

      ensureThread: (type, targetId) => {
        const existing = get().threads.find(
          (t) => t.type === type && t.targetId === targetId
        );
        if (existing) return existing;
        const thread: Thread = {
          id: type === "bot" ? botThreadId(targetId) : groupThreadId(targetId),
          type,
          targetId,
          updatedAt: Date.now(),
        };
        set({ threads: [...get().threads, thread] });
        return thread;
      },

      addMessage: (msg) => {
        const message: ChatMessage = {
          id: msg.id ?? `msg_${nanoid(10)}`,
          createdAt: Date.now(),
          ...msg,
        };
        set({
          messages: [...get().messages, message],
          threads: get().threads.map((t) =>
            t.id === msg.threadId ? { ...t, updatedAt: Date.now() } : t
          ),
        });
        return message;
      },

      updateMessage: (id, patch) =>
        set({
          messages: get().messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }),

      appendToMessage: (id, token) =>
        set({
          messages: get().messages.map((m) =>
            m.id === id ? { ...m, content: m.content + token } : m
          ),
        }),

      getThreadMessages: (threadId) =>
        get()
          .messages.filter((m) => m.threadId === threadId)
          .sort((a, b) => a.createdAt - b.createdAt),

      clearThread: (threadId) =>
        set({ messages: get().messages.filter((m) => m.threadId !== threadId) }),
    }),
    {
      name: STORE_PERSIST_KEY,
      partialize: (s) => ({
        bots: s.bots,
        groups: s.groups,
        threads: s.threads,
        messages: s.messages,
        settings: s.settings,
        activeThreadId: s.activeThreadId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
