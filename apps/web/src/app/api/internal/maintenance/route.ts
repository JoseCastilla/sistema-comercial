import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { maybeRunScheduledAgrDeliverySync } from "@/features/agr-delivery/server/agr-delivery-sync";
import { expireUnverifiedCases } from "@/features/recovery/server/expire-unverified-cases";
import { releaseWaitingBaseCases } from "@/features/recovery/server/release-waiting-base-cases";
import { returnStaleBaseCasesToPool } from "@/features/recovery/server/return-stale-base-cases";
import { database } from "@/server/database";

export const dynamic = "force-dynamic";

/**
 * SPEC-046 BR-001: las reglas con reloj —sincronización AGR a sus horas,
 * vencimiento de casos sin verificar, liberación de los que esperaban un
 * pedido, retorno al pool de los asignados sin gestión— corren desde el
 * worker por esta ruta, no cuando alguien abre una página. Las páginas
 * conservan sus llamadas: son idempotentes y así nada se pierde si el
 * worker cae. La ruta exige el secreto compartido y devuelve qué corrió y
 * qué falló, por organización, sin ocultar el error.
 */
interface JobResult {
  job: string;
  ok: boolean;
  result?: number | null;
  error?: string;
}

const jobs: ReadonlyArray<{
  name: string;
  run: (organizationId: string) => Promise<number | void | null | unknown>;
}> = [
  { name: "agr-delivery-sync", run: maybeRunScheduledAgrDeliverySync },
  { name: "expire-unverified-cases", run: expireUnverifiedCases },
  { name: "release-waiting-base-cases", run: releaseWaitingBaseCases },
  { name: "return-stale-base-cases", run: returnStaleBaseCasesToPool },
];

function isAuthorized(provided: string | null): boolean | null {
  const expected = process.env.MAINTENANCE_INTERNAL_SECRET?.trim();
  if (!expected) return null;

  const providedBuffer = Buffer.from(provided ?? "", "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  const authorized = isAuthorized(request.headers.get("x-maintenance-secret"));
  if (authorized === null) {
    return NextResponse.json(
      { error: "MAINTENANCE_INTERNAL_SECRET no está configurado" },
      { status: 503 },
    );
  }
  if (!authorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const startedAt = new Date();
  const organizations = await database.organization.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, slug: true },
  });

  const results: Array<{ organization: string; jobs: JobResult[] }> = [];

  for (const organization of organizations) {
    const jobResults: JobResult[] = [];

    for (const job of jobs) {
      try {
        const result = await job.run(organization.id);
        jobResults.push({
          job: job.name,
          ok: true,
          result: typeof result === "number" ? result : null,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error);
        console.error(
          `Mantenimiento ${job.name} falló para ${organization.slug}: ${message}`,
        );
        jobResults.push({ job: job.name, ok: false, error: message });
      }
    }

    results.push({ organization: organization.slug, jobs: jobResults });
  }

  return NextResponse.json({
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    organizations: results,
  });
}
