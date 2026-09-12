import { store } from "@/lib/server/store-io";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(store.listThreads());
}
