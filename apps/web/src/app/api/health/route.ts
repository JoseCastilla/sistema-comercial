export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "sistema-comercial-web",
    timestamp: new Date().toISOString(),
  });
}
