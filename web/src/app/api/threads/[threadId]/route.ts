import { store } from "@/lib/server/store-io";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ threadId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { threadId } = await ctx.params;
  store.clearThread(threadId);
  return Response.json({ ok: true });
}
