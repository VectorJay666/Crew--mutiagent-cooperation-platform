/**
 * Crew REST + SSE contract — CONTRACT_VERSION 0.1.0
 * Owned by: structure agent (bc-01a09353-11eb-7d26-8a69-be99b08ba7ef)
 * Frontend: web/src/lib/contract.ts (mirror)
 * Backend:  implement every endpoint under web/src/app/api/**
 */

import type { ApiSettings, Bot, ChatMessage, Group, Thread } from "./types";

export const CONTRACT_VERSION = "0.1.0" as const;

/** SSE body: `data: ${JSON.stringify(StreamEvent)}\n\n` */
export type StreamEvent =
  | { type: "status"; botId?: string; status: string; action?: string }
  | { type: "speaker"; botId: string; name: string }
  | { type: "token"; botId: string; content: string }
  | { type: "message_done"; botId: string; messageId: string; content: string }
  | { type: "handoff"; fromBotId: string; toBotId: string; reason: string }
  | { type: "activity"; action: string; detail?: string; botIds?: string[] }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ChatStreamRequest {
  threadId: string;
  mode: "bot" | "group";
  targetId: string;
  content: string;
  mentionBotIds?: string[];
  /** Optional per-request override; else server uses stored settings */
  settings?: {
    baseUrl: string;
    apiKey: string;
    model: string;
    temperature?: number;
  };
}

export interface CreateBotInput {
  name: string;
  title: string;
  description: string;
  systemPrompt: string;
  color?: string;
  accessory?: number;
}

export interface CreateGroupInput {
  name: string;
  botIds: string[];
}

export interface HealthResponse {
  ok: true;
  version: string;
  contractVersion: typeof CONTRACT_VERSION;
}

/**
 * Endpoints
 *
 * GET    /api/health
 * GET    /api/bots
 * POST   /api/bots                 body: CreateBotInput
 * PATCH  /api/bots/:id             body: Partial<CreateBotInput & { status, pinned }>
 * DELETE /api/bots/:id
 * GET    /api/groups
 * POST   /api/groups               body: CreateGroupInput
 * PATCH  /api/groups/:id
 * DELETE /api/groups/:id
 * GET    /api/threads
 * GET    /api/threads/:threadId/messages
 * DELETE /api/threads/:threadId
 * POST   /api/chat/stream          body: ChatStreamRequest → SSE StreamEvent
 * GET    /api/settings             ApiSettings (apiKey may be masked)
 * PUT    /api/settings             body: ApiSettings
 */

export type BotsResponse = Bot[];
export type GroupsResponse = Group[];
export type ThreadsResponse = Thread[];
export type MessagesResponse = ChatMessage[];
export type SettingsResponse = ApiSettings;

/** Text protocol bots may emit inside assistant content */
export const HANDOFF_PATTERN =
  /HANDOFF:\s*@([^\n|]+?)\s*\|\s*([^\n]+)/i;

/** Coordinator model should return JSON matching this shape */
export interface CoordinatorPlan {
  speakers: string[];
  plan: string;
}
