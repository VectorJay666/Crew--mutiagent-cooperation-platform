import type { StreamEvent } from "../contract";

export function sseResponse(
  run: (emit: (event: StreamEvent) => void, signal: AbortSignal) => Promise<void>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };
      try {
        await run(emit, controllerSignal());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream failed";
        emit({ type: "error", message });
        emit({ type: "done" });
      } finally {
        controller.close();
      }

      function controllerSignal() {
        const ac = new AbortController();
        return ac.signal;
      }
    },
    cancel() {
      // client disconnected
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/** Prefer request abort when available */
export function sseResponseWithSignal(
  req: Request,
  run: (emit: (event: StreamEvent) => void, signal: AbortSignal) => Promise<void>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };
      try {
        await run(emit, req.signal);
      } catch (err) {
        if (req.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Stream failed";
        emit({ type: "error", message });
        emit({ type: "done" });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
