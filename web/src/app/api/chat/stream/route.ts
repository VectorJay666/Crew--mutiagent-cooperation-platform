import type { ChatStreamRequest } from "@/lib/contract";
import { runChatStream } from "@/lib/server/orchestrator";
import { sseResponseWithSignal } from "@/lib/server/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as ChatStreamRequest;
  if (!body?.threadId || !body?.mode || !body?.targetId || !body?.content) {
    return Response.json(
      { error: "threadId, mode, targetId, content required" },
      { status: 400 }
    );
  }

  return sseResponseWithSignal(req, (emit, signal) =>
    runChatStream(body, emit, signal)
  );
}
