import { auth } from "@/server/auth/auth";
import { database } from "@/server/database";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ ok: false }, { status: 401 });
  await database.organizationMember.updateMany({ where: { userId: session.user.id }, data: { lastSeenAt: new Date() } });
  return Response.json({ ok: true });
}
