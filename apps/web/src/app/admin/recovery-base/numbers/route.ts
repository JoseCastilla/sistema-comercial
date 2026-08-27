import { NextResponse } from "next/server";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

/**
 * BR-017: exporta los números de los casos abiertos — incluidos los `WAITING`,
 * que se revalidan cada día — para alimentar la consulta externa de
 * portabilidad. Solo emite el número de servicio: ningún dato personal viaja
 * en este archivo.
 */
export async function GET() {
  const { membership } = await requireAdminAccess();

  const services = await database.recoveryCaseService.findMany({
    where: {
      organizationId: membership.organization.id,
      discardedAt: null,
      case: {
        status: {
          in: ["TRIAGE", "WAITING", "OPEN", "ASSIGNED", "IN_PROGRESS", "SCHEDULED"],
        },
      },
    },
    select: { serviceNumber: true },
    orderBy: { serviceNumber: "asc" },
  });

  const unique = [...new Set(services.map((service) => service.serviceNumber))];
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
  }).format(new Date());

  return new NextResponse(unique.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="numeros_recupero_${today}.txt"`,
      "cache-control": "no-store",
    },
  });
}
