import { NextResponse } from "next/server";

import { expireUnverifiedCases } from "@/features/recovery/server/expire-unverified-cases";
import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

/**
 * BR-017/BR-082: exporta números para la consulta externa de portabilidad,
 * de forma **incremental** — solo líneas sin consultar o marcadas para
 * revalidación, de casos abiertos, las más recientes primero. Consultar dos
 * veces lo mismo es tiempo de operación perdido. `?take=200` limita la
 * tanda al tamaño que la herramienta soporte; sin parámetro salen todas
 * las pendientes. Solo emite el número de servicio: ningún dato personal
 * viaja en este archivo.
 */
export async function GET(request: Request) {
  const { membership } = await requireAdminAccess();

  // BR-084: lo vencido sale del embudo antes de exportar.
  await expireUnverifiedCases(membership.organization.id);

  const takeRaw = new URL(request.url).searchParams.get("take");
  const take = Math.min(
    5000,
    Math.max(0, Number.parseInt(takeRaw ?? "0", 10) || 0),
  );

  const services = await database.recoveryCaseService.findMany({
    where: {
      organizationId: membership.organization.id,
      discardedAt: null,
      OR: [{ portabilityCheckedAt: null }, { needsRevalidation: true }],
      case: {
        status: {
          in: [
            "TRIAGE",
            "WAITING",
            "OPEN",
            "ASSIGNED",
            "IN_PROGRESS",
            "SCHEDULED",
          ],
        },
      },
    },
    select: { serviceNumber: true },
    // Lo más reciente primero: un lead frío pierde valor con cada día.
    orderBy: { case: { lastSightingAt: "desc" } },
    ...(take > 0 ? { take: take * 2 } : {}),
  });

  const unique = [...new Set(services.map((service) => service.serviceNumber))];
  const batch = take > 0 ? unique.slice(0, take) : unique;

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
  }).format(new Date());
  const suffix = take > 0 ? `_tanda_${batch.length}` : "";

  return new NextResponse(batch.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="numeros_recupero_${today}${suffix}.txt"`,
      "cache-control": "no-store",
    },
  });
}
