import type { ApiSettings } from "../types";

export type ChatMessageParam = {
  role: "system" | "user" | "assistant";
  content: string;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function chatCompletionsUrl(baseUrl: string) {
  const base = normalizeBaseUrl(baseUrl);
  if (base.endsWith("/v1")) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

export class LlmError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function chatCompletion(
  settings: ApiSettings,
  messages: ChatMessageParam[],
  opts?: { temperature?: number; signal?: AbortSignal }
): Promise<string> {
  if (!settings.apiKey) {
    throw new LlmError(
      "Missing API key. Set it in Settings or LLM_API_KEY.",
      400
    );
  }

  const res = await fetch(chatCompletionsUrl(settings.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: opts?.temperature ?? settings.temperature,
      messages,
      stream: false,
    }),
    signal: opts?.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new LlmError(
      `LLM error (${res.status}): ${text.slice(0, 400)}`,
      res.status
    );
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function* streamChatCompletion(
  settings: ApiSettings,
  messages: ChatMessageParam[],
  opts?: { temperature?: number; signal?: AbortSignal }
): AsyncGenerator<string> {
  if (!settings.apiKey) {
    throw new LlmError(
      "Missing API key. Set it in Settings or LLM_API_KEY.",
      400
    );
  }

  const res = await fetch(chatCompletionsUrl(settings.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: opts?.temperature ?? settings.temperature,
      messages,
      stream: true,
    }),
    signal: opts?.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new LlmError(
      `LLM error (${res.status}): ${text.slice(0, 400)}`,
      res.status
    );
  }

  const reader = res.body?.getReader();
  if (!reader) throw new LlmError("No response body from LLM", 502);

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {
        // ignore malformed chunks
      }
    }
  }
}
