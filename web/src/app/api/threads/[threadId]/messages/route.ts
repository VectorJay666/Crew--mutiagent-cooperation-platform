import { store } from "@/lib/server/store-io";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ threadId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { threadId } = await ctx.params;
  return Response.json(store.getMessages(threadId));
}
