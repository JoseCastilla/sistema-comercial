import { loopsStatus } from "@/server/background/registry";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, loops: loopsStatus() });
}
