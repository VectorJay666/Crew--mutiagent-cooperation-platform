import { store } from "@/lib/server/store-io";
import type { Bot } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json()) as Partial<Bot>;
  const updated = store.updateBot(id, body);
  if (!updated) return Response.json({ error: "Bot not found" }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = store.deleteBot(id);
  if (!ok) return Response.json({ error: "Bot not found" }, { status: 404 });
  return Response.json({ ok: true });
}
