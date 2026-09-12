/**
 * Crew shared domain types — CONTRACT_VERSION 0.1.0
 * Owned by: structure agent (bc-01a09353-11eb-7d26-8a69-be99b08ba7ef)
 */

export type BotStatus =
  | "idle"
  | "thinking"
  | "working"
  | "waiting"
  | "blocked"
  | "done";

export type BotColor =
  | "teal"
  | "amber"
  | "rose"
  | "sky"
  | "violet"
  | "lime"
  | "coral"
  | "slate";

export interface Bot {
  id: string;
  name: string;
  title: string;
  description: string;
  systemPrompt: string;
  color: BotColor;
  accessory: number;
  status: BotStatus;
  currentAction?: string;
  pinned?: boolean;
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  botIds: string[];
  createdAt: number;
}

export type MessageKind =
  | "user"
  | "assistant"
  | "system"
  | "handoff"
  | "activity";

export interface ChatMessage {
  id: string;
  threadId: string;
  kind: MessageKind;
  botId?: string;
  content: string;
  meta?: {
    fromBotId?: string;
    toBotId?: string;
    action?: string;
    speakers?: string[];
  };
  createdAt: number;
}

export interface Thread {
  id: string;
  type: "bot" | "group";
  targetId: string;
  updatedAt: number;
}

export interface ApiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export const STORE_PERSIST_KEY = "crew-bot-store-v2" as const;

export function botThreadId(botId: string): string {
  return `thread_${botId}`;
}

export function groupThreadId(groupId: string): string {
  return `thread_${groupId}`;
}
