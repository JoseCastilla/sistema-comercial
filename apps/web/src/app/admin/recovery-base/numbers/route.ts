import { NextResponse } from "next/server";

import { expireUnverifiedCases } from "@/features/recovery/server/expire-unverified-cases";
import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import { needsPortabilityRecross } from "@repo/validation";

import type { Prisma } from "@repo/database";

/**
 * BR-017/BR-082: exporta números para la consulta externa de portabilidad,
 * de forma **incremental** — solo líneas sin consultar o marcadas para
 * revalidación, de casos abiertos, las más recientes primero. Consultar dos
 * veces lo mismo es tiempo de operación perdido. `?take=200` limita la
 * tanda al tamaño que la herramienta soporte; sin parámetro salen todas
 * las pendientes.
 *
 * `?days=3` cambia al **barrido**: emite todas las líneas de los casos
 * abiertos de los últimos N días, consultadas o no. Pensado para la
 * herramienta rápida, que procesa 2 000 diarios sin problema: caza al
 * cliente que portó después de su consulta. Solo emite el número de
 * servicio: ningún dato personal viaja en este archivo.
 *
 * `?scope=waiting` emite los **pedidos en curso**: las líneas de los casos
 * en espera, sin ventana de días. Sirve para confirmar cuáles se concretaron
 * y cuáles se cayeron, que es la pregunta que mantiene viva una espera.
 *
 * BR-082b: `?scope=recross` recorta ese barrido a lo que todavía puede
 * cambiar — deja fuera las líneas cuyo pedido a Movistar tiene una fecha de
 * ventana **por delante**, porque hasta ese día nada puede cambiar. Pasada
 * la ventana vuelven a entrar (`needsPortabilityRecross`).
 */
export async function GET(request: Request) {
  const { membership } = await requireAdminAccess();

  // BR-084: lo vencido sale del embudo antes de exportar.
  await expireUnverifiedCases(membership.organization.id);

  const url = new URL(request.url);
  const take = Math.min(
    5000,
    Math.max(0, Number.parseInt(url.searchParams.get("take") ?? "0", 10) || 0),
  );
  const days = Math.min(
    30,
    Math.max(0, Number.parseInt(url.searchParams.get("days") ?? "0", 10) || 0),
  );
  const scope = url.searchParams.get("scope");
  const onlyRecrossable = scope === "recross";
  const onlyWaiting = scope === "waiting";

  const openCase: Prisma.RecoveryCaseWhereInput = {
    status: {
      in: ["TRIAGE", "WAITING", "OPEN", "ASSIGNED", "IN_PROGRESS", "SCHEDULED"],
    },
  };

  const services = await database.recoveryCaseService.findMany({
    where: {
      organizationId: membership.organization.id,
      discardedAt: null,
      ...(onlyWaiting
        ? {
            /**
             * Los pedidos en curso, sin ventana de días: lo que interesa de
             * una espera es si el pedido se concretó, y eso no caduca a los
             * tres días. Tras BR-024b aquí solo queda lo que de verdad
             * todavía espera algo.
             */
            case: { status: "WAITING", source: "NATIONAL_BASE" },
          }
        : days > 0
        ? {
            // Barrido: todo lo cargado al sistema en los últimos N días,
            // consultado o no. La fecha comercial del pedido no sirve aquí:
            // una base subida hoy trae pedidos de hace varios días.
            case: {
              ...openCase,
              createdAt: {
                gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
              },
            },
          }
        : {
            OR: [{ portabilityCheckedAt: null }, { needsRevalidation: true }],
            case: openCase,
          }),
    },
    select: {
      serviceNumber: true,
      portabilityState: true,
      portabilityReceiver: true,
      portabilityWindowAt: true,
    },
    // Lo más reciente primero: un lead frío pierde valor con cada día.
    orderBy: { case: { lastSightingAt: "desc" } },
    // El recorte de BR-082b descarta filas después de la consulta, así que
    // pedir de más a la base dejaría tandas cortas: se corta en memoria.
    ...(take > 0 && !onlyRecrossable ? { take: take * 2 } : {}),
  });

  const now = new Date();
  const selected = onlyRecrossable
    ? services.filter((service) =>
        needsPortabilityRecross({
          state: service.portabilityState,
          receiverRaw: service.portabilityReceiver,
          windowDate: service.portabilityWindowAt,
          now,
        }),
      )
    : services;

  const unique = [...new Set(selected.map((service) => service.serviceNumber))];
  const batch = take > 0 ? unique.slice(0, take) : unique;

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
  }).format(new Date());
  const suffix = onlyWaiting
    ? "_pedidos_en_curso"
    : days > 0
      ? `_barrido_${days}d${onlyRecrossable ? "_sin_movistar" : ""}`
      : take > 0
        ? `_tanda_${batch.length}`
        : "";

  return new NextResponse(batch.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="numeros_recupero_${today}${suffix}.txt"`,
      "cache-control": "no-store",
    },
  });
}
