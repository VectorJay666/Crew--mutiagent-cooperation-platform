import { CONTRACT_VERSION, type HealthResponse } from "@/lib/contract";

export const dynamic = "force-dynamic";

export async function GET() {
  const body: HealthResponse = {
    ok: true,
    version: "0.1.0",
    contractVersion: CONTRACT_VERSION,
  };
  return Response.json(body);
}
