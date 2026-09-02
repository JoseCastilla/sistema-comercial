import "server-only";

import {
  isMovistarReceiver,
  shouldReleaseWaitingBaseCase,
} from "@repo/validation";

import { database } from "@/server/database";

/**
 * BR-024b: devuelve a triage las esperas que ya no esperan nada.
 *
 * Barrido perezoso e idempotente, como el retorno al pool de BR-077 y el
 * vencimiento de BR-084: corre al abrir las superficies de campaña, para
 * que el embudo se mueva sin proceso programado.
 *
 * El caso conserva su equipo: vuelve a la bandeja de su supervisor, que fue
 * quien recibió el bloque, no al reparto general.
 */
export async function releaseWaitingBaseCases(
  organizationId: string,
): Promise<number> {
  const now = new Date();

  const candidates = await database.recoveryCase.findMany({
    where: {
      organizationId,
      source: "NATIONAL_BASE",
      status: "WAITING",
      /**
       * Con dueño la espera es de BR-085 —el asesor afirmó «ya es Movistar» y
       * el caso lo conserva mientras se verifica—, o la puso un supervisor
       * sobre un caso ya repartido. Ninguna se libera sola: eso convertiría
       * la palabra del asesor en un descarte.
       */
      assignedUserId: null,
      services: { none: { discardedAt: null, needsRevalidation: true } },
    },
    select: {
      id: true,
      services: {
        where: { discardedAt: null },
        select: {
          portabilityState: true,
          portabilityReceiver: true,
          portabilityWindowAt: true,
        },
      },
      events: {
        where: { type: "TRIAGE_WAITING" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    take: 500,
  });

  const releasable = candidates.filter((item) =>
    shouldReleaseWaitingBaseCase({
      manualWaitAt: item.events[0]?.createdAt ?? null,
      movistarWindowAt: latestMovistarWindow(item.services),
      now,
    }),
  );

  if (releasable.length === 0) return 0;

  await database.$transaction(async (transaction) => {
    const affected = await transaction.recoveryCase.updateMany({
      where: { id: { in: releasable.map((item) => item.id) }, status: "WAITING" },
      data: { status: "TRIAGE" },
    });

    if (affected.count === 0) return;

    await transaction.recoveryCaseEvent.createMany({
      data: releasable.map((item) => ({
        organizationId,
        caseId: item.id,
        type: "PORTABILITY_CROSSED" as const,
        previousStatus: "WAITING" as const,
        newStatus: "TRIAGE" as const,
        observation:
          latestMovistarWindow(item.services) !== null
            ? "Su fecha de portación ya pasó: vuelve a revisión para confirmar si portó o si se cayó (BR-024b)."
            : "La espera del chequeo manual venció ayer: vuelve a revisión (BR-024b).",
        metadata: { mode: "LIBERACION_ESPERA" },
      })),
    });
  });

  return releasable.length;
}

/**
 * De todas sus líneas en curso hacia Movistar, la que tarda más: mientras a
 * una le quede ventana por delante, el caso todavía tiene algo que esperar.
 */
function latestMovistarWindow(
  services: {
    portabilityState: string | null;
    portabilityReceiver: string | null;
    portabilityWindowAt: Date | null;
  }[],
): Date | null {
  const windows = services
    .filter(
      (service) =>
        service.portabilityState === "PROGRAMADO" &&
        isMovistarReceiver(service.portabilityReceiver) &&
        service.portabilityWindowAt !== null,
    )
    .map((service) => service.portabilityWindowAt as Date);

  if (windows.length === 0) return null;

  return windows.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest,
  );
}
