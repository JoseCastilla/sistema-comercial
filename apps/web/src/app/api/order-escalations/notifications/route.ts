import { NextResponse } from "next/server";

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

    const count = await database.deliveryEscalation.count({
      where: {
        organizationId: membership.organization.id,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
        ...(membership.role === "SUPERVISOR"
          ? { teamIdSnapshot: { in: supervisedTeamIds } }
          : {}),
      },
    });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }
}
