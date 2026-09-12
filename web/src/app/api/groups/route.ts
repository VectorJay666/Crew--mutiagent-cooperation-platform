import { store } from "@/lib/server/store-io";
import type { CreateGroupInput } from "@/lib/contract";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(store.listGroups());
}

export async function POST(req: Request) {
  const body = (await req.json()) as CreateGroupInput;
  if (!body?.name || !Array.isArray(body.botIds)) {
    return Response.json({ error: "name and botIds required" }, { status: 400 });
  }
  return Response.json(store.createGroup(body.name, body.botIds), { status: 201 });
}
