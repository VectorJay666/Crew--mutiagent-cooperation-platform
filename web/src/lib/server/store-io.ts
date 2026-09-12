import { nanoid } from "nanoid";
import type {
  ApiSettings,
  Bot,
  BotColor,
  ChatMessage,
  Group,
  Thread,
} from "../types";
import type { CreateBotInput } from "../contract";

const BOT_COLORS: BotColor[] = [
  "teal",
  "amber",
  "rose",
  "sky",
  "violet",
  "lime",
  "coral",
  "slate",
];

const DEFAULT_BOT_DEFS = [
  {
    name: "Nova",
    title: "Chief of Staff",
    description:
      "Routes work, keeps the team aligned, and escalates decisions to you.",
    systemPrompt:
      "You are Nova, Chief of Staff. Coordinate specialists, summarize status, and ask the user only when judgment is required. Be concise and action-oriented.",
    color: "teal" as BotColor,
    accessory: 0,
  },
  {
    name: "Rex",
    title: "Engineer",
    description:
      "Turns requirements into concrete technical plans, code sketches, and tradeoffs.",
    systemPrompt:
      "You are Rex, a pragmatic engineer. Prefer clear architecture, small steps, and explicit assumptions. When uncertain, list options with a recommendation.",
    color: "sky" as BotColor,
    accessory: 1,
  },
  {
    name: "Mira",
    title: "Designer",
    description: "Shapes product narrative, UX structure, and visual direction.",
    systemPrompt:
      "You are Mira, a product designer. Focus on clarity, hierarchy, and user flow. Propose concrete UI copy and layout ideas without fluff.",
    color: "rose" as BotColor,
    accessory: 2,
  },
  {
    name: "Kai",
    title: "Researcher",
    description:
      "Gathers context, compares options, and surfaces risks with sources of uncertainty.",
    systemPrompt:
      "You are Kai, a researcher-analyst. Structure findings, call out unknowns, and keep recommendations evidence-based and compact.",
    color: "amber" as BotColor,
    accessory: 3,
  },
];

function seedBots(): Bot[] {
  const now = Date.now();
  return DEFAULT_BOT_DEFS.map((b, i) => ({
    id: `bot_${i + 1}`,
    name: b.name,
    title: b.title,
    description: b.description,
    systemPrompt: b.systemPrompt,
    color: b.color,
    accessory: b.accessory,
    status: "idle" as const,
    pinned: i === 0,
    createdAt: now - (DEFAULT_BOT_DEFS.length - i) * 1000,
  }));
}

function createInitialState() {
  const bots = seedBots();
  const group: Group = {
    id: "group_1",
    name: "Product Launch",
    botIds: bots.slice(0, 4).map((b) => b.id),
    createdAt: Date.now(),
  };
  const groupThread: Thread = {
    id: `thread_${group.id}`,
    type: "group",
    targetId: group.id,
    updatedAt: Date.now(),
  };
  const botThreads: Thread[] = bots.map((b) => ({
    id: `thread_${b.id}`,
    type: "bot" as const,
    targetId: b.id,
    updatedAt: Date.now() - 10_000,
  }));

  const settings: ApiSettings = {
    baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    apiKey: process.env.LLM_API_KEY || "",
    model: process.env.LLM_MODEL || "gpt-4o-mini",
    temperature: Number(process.env.LLM_TEMPERATURE || 0.7),
  };

  return {
    bots,
    groups: [group],
    threads: [...botThreads, groupThread],
    messages: [] as ChatMessage[],
    settings,
  };
}

type State = ReturnType<typeof createInitialState>;

class Store {
  private state: State = createInitialState();

  snapshot() {
    return this.state;
  }

  getSettings(): ApiSettings {
    return { ...this.state.settings };
  }

  setSettings(patch: Partial<ApiSettings>): ApiSettings {
    this.state.settings = { ...this.state.settings, ...patch };
    return this.getSettings();
  }

  listBots() {
    return [...this.state.bots];
  }

  getBot(id: string) {
    return this.state.bots.find((b) => b.id === id);
  }

  createBot(input: CreateBotInput): Bot {
    const used = new Set(this.state.bots.map((b) => b.color));
    const requested = input.color as BotColor | undefined;
    const color: BotColor =
      (requested && BOT_COLORS.includes(requested) ? requested : undefined) ??
      BOT_COLORS.find((c) => !used.has(c)) ??
      BOT_COLORS[this.state.bots.length % BOT_COLORS.length] ??
      "teal";
    const bot: Bot = {
      id: `bot_${nanoid(8)}`,
      name: input.name.trim(),
      title: input.title.trim(),
      description: input.description.trim(),
      systemPrompt: input.systemPrompt.trim(),
      color,
      accessory: input.accessory ?? this.state.bots.length % 4,
      status: "idle",
      createdAt: Date.now(),
    };
    this.state.bots.push(bot);
    this.ensureThread("bot", bot.id);
    return bot;
  }

  updateBot(id: string, patch: Partial<Bot>): Bot | null {
    const idx = this.state.bots.findIndex((b) => b.id === id);
    if (idx < 0) return null;
    const current = this.state.bots[idx]!;
    const next: Bot = { ...current, ...patch, id };
    this.state.bots[idx] = next;
    return next;
  }

  deleteBot(id: string): boolean {
    const before = this.state.bots.length;
    this.state.bots = this.state.bots.filter((b) => b.id !== id);
    this.state.groups = this.state.groups.map((g) => ({
      ...g,
      botIds: g.botIds.filter((bid) => bid !== id),
    }));
    return this.state.bots.length < before;
  }

  listGroups() {
    return [...this.state.groups];
  }

  getGroup(id: string) {
    return this.state.groups.find((g) => g.id === id);
  }

  createGroup(name: string, botIds: string[]): Group {
    const group: Group = {
      id: `group_${nanoid(8)}`,
      name: name.trim(),
      botIds: [...botIds],
      createdAt: Date.now(),
    };
    this.state.groups.push(group);
    this.ensureThread("group", group.id);
    return group;
  }

  updateGroup(id: string, patch: Partial<Group>): Group | null {
    const idx = this.state.groups.findIndex((g) => g.id === id);
    if (idx < 0) return null;
    const current = this.state.groups[idx]!;
    const next: Group = { ...current, ...patch, id };
    this.state.groups[idx] = next;
    return next;
  }

  deleteGroup(id: string): boolean {
    const before = this.state.groups.length;
    this.state.groups = this.state.groups.filter((g) => g.id !== id);
    return this.state.groups.length < before;
  }

  listThreads() {
    return [...this.state.threads];
  }

  ensureThread(type: "bot" | "group", targetId: string): Thread {
    const id = `thread_${targetId}`;
    const existing = this.state.threads.find((t) => t.id === id);
    if (existing) return existing;
    const thread: Thread = {
      id,
      type,
      targetId,
      updatedAt: Date.now(),
    };
    this.state.threads.push(thread);
    return thread;
  }

  touchThread(threadId: string) {
    const t = this.state.threads.find((x) => x.id === threadId);
    if (t) t.updatedAt = Date.now();
  }

  getMessages(threadId: string) {
    return this.state.messages.filter((m) => m.threadId === threadId);
  }

  addMessage(
    msg: Omit<ChatMessage, "id" | "createdAt"> & { id?: string }
  ): ChatMessage {
    const full: ChatMessage = {
      id: msg.id ?? `msg_${nanoid(8)}`,
      createdAt: Date.now(),
      ...msg,
    };
    this.state.messages.push(full);
    this.touchThread(full.threadId);
    return full;
  }

  clearThread(threadId: string) {
    this.state.messages = this.state.messages.filter(
      (m) => m.threadId !== threadId
    );
    this.state.threads = this.state.threads.filter((t) => t.id !== threadId);
  }

  botsById(): Record<string, Bot> {
    return Object.fromEntries(this.state.bots.map((b) => [b.id, b]));
  }
}

export const store = new Store();
