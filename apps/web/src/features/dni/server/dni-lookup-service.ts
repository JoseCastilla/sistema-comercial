import "server-only";

import { database } from "@/server/database";

import {
  getOrderPeriodRange,
  parseDniLookupApiResponse,
  resolveDniCreditIndicator,
} from "@repo/validation";

import type { Prisma } from "@repo/database";
import type { DniCreditStatus, DniLookupStats } from "../dni.types";

const defaultEndpoint = "https://leder-data-api.ngrok.dev/v1.7/persona/reniec";

export type DniLookupFailureCode =
  "CONFIGURATION" | "NOT_FOUND" | "UPSTREAM" | "INVALID_RESPONSE";

export class DniLookupError extends Error {
  constructor(
    public readonly code: DniLookupFailureCode,
    message: string,
  ) {
    super(message);
  }
}

export async function getDniLookupOverview(input: {
  organizationId: string;
  actorUserId: string;
  canViewCredits: boolean;
}): Promise<{
  stats: DniLookupStats;
  creditStatus: DniCreditStatus | null;
}> {
  const today = getOrderPeriodRange("TODAY");
  const month = getOrderPeriodRange("MONTH");
  const commonWhere = {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
  };

  const [todayCount, monthCount, uniqueDnis, creditStatus] = await Promise.all([
    database.dniLookupEvent.count({
      where: {
        ...commonWhere,
        queriedAt: { gte: today.start!, lt: today.end! },
      },
    }),
    database.dniLookupEvent.count({
      where: {
        ...commonWhere,
        queriedAt: { gte: month.start!, lt: month.end! },
      },
    }),
    database.dniLookupEvent.findMany({
      where: {
        ...commonWhere,
        queriedAt: { gte: month.start!, lt: month.end! },
      },
      distinct: ["dniPersonSnapshotId"],
      select: { dniPersonSnapshotId: true },
    }),
    input.canViewCredits
      ? getLatestDniCreditStatus(input.organizationId)
      : Promise.resolve(null),
  ]);

  return {
    stats: {
      today: todayCount,
      month: monthCount,
      uniqueDnisThisMonth: uniqueDnis.length,
    },
    creditStatus,
  };
}

export async function lookupDni(input: {
  organizationId: string;
  actorUserId: string;
  dni: string;
}) {
  const uniqueKey = {
    organizationId: input.organizationId,
    dni: input.dni,
  };

  const existing = await database.dniPersonSnapshot.findUnique({
    where: { organizationId_dni: uniqueKey },
  });

  if (existing) {
    await database.dniLookupEvent.create({
      data: {
        organizationId: input.organizationId,
        dniPersonSnapshotId: existing.id,
        actorUserId: input.actorUserId,
        source: "CACHE",
      },
    });
    return { snapshot: existing, source: "CACHE" as const };
  }

  /*
   * La lectura rápida anterior evita una transacción en la ruta común. En un
   * miss, el advisory lock por tenant+DNI serializa a los dos asesores que
   * consulten la misma identidad al mismo tiempo. El segundo vuelve a leer la
   * caché al obtener el lock y no gasta otro crédito.
   */
  return database.$transaction(
    async (transaction) => {
      const lockKey = `${input.organizationId}:${input.dni}`;
      await transaction.$queryRaw`
        SELECT 1::integer AS lock_acquired
        FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
      `;

      const cached = await transaction.dniPersonSnapshot.findUnique({
        where: { organizationId_dni: uniqueKey },
      });

      if (cached) {
        await transaction.dniLookupEvent.create({
          data: {
            organizationId: input.organizationId,
            dniPersonSnapshotId: cached.id,
            actorUserId: input.actorUserId,
            source: "CACHE",
          },
        });
        return { snapshot: cached, source: "CACHE" as const };
      }

      const payload = await fetchDniFromProvider(input.dni);
      const parsed = parseDniLookupApiResponse(payload, input.dni);

      if (!parsed.ok) {
        throw new DniLookupError(
          parsed.reason,
          parsed.reason === "NOT_FOUND"
            ? "No se encontraron datos para este DNI."
            : "El proveedor devolvió una respuesta que no se puede validar.",
        );
      }

      const snapshot = await transaction.dniPersonSnapshot.create({
        data: {
          organizationId: input.organizationId,
          ...parsed.person,
          creditsAtFetch: parsed.credits,
          rawPayload: payload as Prisma.InputJsonValue,
        },
      });

      await transaction.dniLookupEvent.create({
        data: {
          organizationId: input.organizationId,
          dniPersonSnapshotId: snapshot.id,
          actorUserId: input.actorUserId,
          source: "API",
        },
      });

      return { snapshot, source: "API" as const };
    },
    { maxWait: 5_000, timeout: 20_000 },
  );
}

async function fetchDniFromProvider(dni: string): Promise<unknown> {
  const token = process.env.DNI_LOOKUP_API_TOKEN?.trim();
  if (!token) {
    throw new DniLookupError(
      "CONFIGURATION",
      "DNI_LOOKUP_API_TOKEN no está configurado.",
    );
  }

  const endpoint = process.env.DNI_LOOKUP_API_URL?.trim() || defaultEndpoint;
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dni, source: "database", token }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new DniLookupError(
      "UPSTREAM",
      "No se pudo contactar al proveedor de datos.",
    );
  }

  if (!response.ok) {
    throw new DniLookupError(
      "UPSTREAM",
      `El proveedor de datos respondió ${response.status}.`,
    );
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new DniLookupError(
      "INVALID_RESPONSE",
      "El proveedor devolvió una respuesta ilegible.",
    );
  }
}

async function getLatestDniCreditStatus(
  organizationId: string,
): Promise<DniCreditStatus> {
  const latest = await database.dniPersonSnapshot.findFirst({
    where: { organizationId, creditsAtFetch: { not: null } },
    orderBy: { fetchedAt: "desc" },
    select: { creditsAtFetch: true, fetchedAt: true },
  });
  const indicator = resolveDniCreditIndicator(latest?.creditsAtFetch ?? null);

  return {
    ...indicator,
    reportedAt: latest?.fetchedAt.toISOString() ?? null,
  };
}
