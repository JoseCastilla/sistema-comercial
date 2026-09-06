import { NextResponse } from "next/server";

import { countOverdueInternalCases } from "@/features/recovery/server/count-overdue-internal-cases";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { session, membership } = await requireCommercialAccess();
    if (membership.role !== "ADMIN" && membership.role !== "SUPERVISOR") {
      return NextResponse.json({ count: 0 });
    }

    const supervisedTeamIds =
      membership.role === "SUPERVISOR"
        ? (
            await database.commercialTeamMember.findMany({
              where: {
                userId: session.user.id,
                memberRole: "SUPERVISOR",
                isActive: true,
                team: {
                  organizationId: membership.organization.id,
                  status: "ACTIVE",
                },
              },
              select: { teamId: true },
            })
          ).map((item) => item.teamId)
        : [];

    const [count, recoveryOverdue] = await Promise.all([
      database.deliveryEscalation.count({
        where: {
          organizationId: membership.organization.id,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
          ...(membership.role === "SUPERVISOR"
            ? { teamIdSnapshot: { in: supervisedTeamIds } }
            : {}),
        },
      }),
      // SPEC-030 BR-066/BR-058: un caso interno vencido escala a la vista
      // del supervisor. SPEC-045 PL-02: mismo criterio y mismo alcance que la
      // bandeja, así el aviso abre exactamente lo que cuenta.
      countOverdueInternalCases(membership.organization.id, {
        userId: session.user.id,
        role: membership.role,
      }),
    ]);
    return NextResponse.json({ count, recoveryOverdue });
  } catch {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }
}
