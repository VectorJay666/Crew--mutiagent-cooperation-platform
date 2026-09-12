import { store } from "@/lib/server/store-io";
import type { CreateBotInput } from "@/lib/contract";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(store.listBots());
}

export async function POST(req: Request) {
  const body = (await req.json()) as CreateBotInput;
  if (!body?.name || !body?.title || !body?.description || !body?.systemPrompt) {
    return Response.json(
      { error: "name, title, description, systemPrompt required" },
      { status: 400 }
    );
  }
  return Response.json(store.createBot(body), { status: 201 });
}
