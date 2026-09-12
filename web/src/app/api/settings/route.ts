import { store } from "@/lib/server/store-io";
import type { ApiSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

function mask(settings: ApiSettings) {
  return {
    ...settings,
    apiKey: settings.apiKey
      ? `${settings.apiKey.slice(0, 3)}…${settings.apiKey.slice(-2)}`
      : "",
  };
}

export async function GET() {
  return Response.json(mask(store.getSettings()));
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<ApiSettings>;
  const next = store.setSettings({
    ...(body.baseUrl !== undefined ? { baseUrl: body.baseUrl } : {}),
    ...(body.apiKey !== undefined ? { apiKey: body.apiKey } : {}),
    ...(body.model !== undefined ? { model: body.model } : {}),
    ...(body.temperature !== undefined
      ? { temperature: Number(body.temperature) }
      : {}),
  });
  return Response.json(mask(next));
}
