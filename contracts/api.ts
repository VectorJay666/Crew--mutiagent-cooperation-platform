/**
 * Crew REST + SSE contract — CONTRACT_VERSION 0.1.0
 * Owned by: structure agent (bc-01a09353-11eb-7d26-8a69-be99b08ba7ef)
 * FE/BE wiring (env switch, SSE order, abort, mirror sync): docs/BRIDGE.md
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
 * GET /api/health
 * GET|POST /api/bots ; PATCH|DELETE /api/bots/:id
 * GET|POST /api/groups ; PATCH|DELETE /api/groups/:id
 * GET /api/threads ; GET /api/threads/:threadId/messages ; DELETE /api/threads/:threadId
 * POST /api/chat/stream -> SSE StreamEvent
 * GET|PUT /api/settings
 */

export type BotsResponse = Bot[];
export type GroupsResponse = Group[];
export type ThreadsResponse = Thread[];
export type MessagesResponse = ChatMessage[];
export type SettingsResponse = ApiSettings;

export const HANDOFF_PATTERN = /HANDOFF:\s*@([^\n|]+?)\s*\|\s*([^\n]+)/i;

export interface CoordinatorPlan {
  speakers: string[];
  plan: string;
}
