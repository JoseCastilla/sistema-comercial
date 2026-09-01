import { createHash } from 'node:crypto';
import { basename } from 'node:path';

import { BadRequestException, Injectable } from '@nestjs/common';

import type { Prisma } from '@repo/database';
import { decideRecoveryPortability } from '@repo/validation';

import { DatabaseService } from '../database/database.service';

import {
  parsePortabilityReport,
  type ParsedPortabilityRow,
} from './recovery-portability-parser';

export interface ApplyPortabilityInput {
  organizationId: string;
  actorUserId: string;
  fileName: string;
  report: Buffer;
  quickColumn?: string | null;
}

export interface PortabilityCrossSummary {
  batchId: string;
  reused: boolean;
  kind: 'FULL' | 'QUICK';
  totalRows: number;
  matchedServices: number;
  discardedServices: number;
  discardedCases: number;
  waitingCases: number;
  revalidationCases: number;
  scheduledServices: number;
  plantLineServices: number;
}

const serviceChunkSize = 200;
const openCaseStatuses = [
  'TRIAGE',
  'WAITING',
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'SCHEDULED',
] as const;

/**
 * Cruza un reporte de portabilidad contra todos los casos abiertos (BR-020) y
 * aplica la decisión por servicio: descarte, espera, revalidación o agenda de
 * habilitación. Ninguna rama declara una pérdida (BR-019d).
 */
@Injectable()
export class RecoveryPortabilityService {
  constructor(private readonly databaseService: DatabaseService) {}

  async apply(input: ApplyPortabilityInput): Promise<PortabilityCrossSummary> {
    const client = this.databaseService.getClient();
    const fileSha256 = createHash('sha256').update(input.report).digest('hex');

    /**
     * BR-020 revisado el 01/09/2026: el cruce corre sobre **todos** los casos
     * abiertos al momento de aplicarlo, y esa población cambia — una base
     * cargada después trae casos que este mismo reporte todavía puede
     * resolver, y BR-019e exige revalidar al día siguiente aunque el reporte
     * vuelva idéntico. Por eso un archivo ya conocido no se rechaza: se
     * conserva **un solo lote por archivo** como evidencia (la huella sigue
     * siendo única) y el cruce se vuelve a ejecutar sobre los casos abiertos
     * de hoy. Reaplicar es inocuo: cada decisión es función del estado del
     * reporte, no del historial.
     */
    const existing = await client.recoveryPortabilityBatch.findUnique({
      where: {
        organizationId_fileSha256: {
          organizationId: input.organizationId,
          fileSha256,
        },
      },
      select: { id: true },
    });

    // Un archivo con formato inesperado es un error del usuario con
    // explicación (p. ej. el rechazo de BR-018c), nunca un 500.
    let parsed: ReturnType<typeof parsePortabilityReport>;
    try {
      parsed = parsePortabilityReport(input.report, {
        quickColumn: input.quickColumn ?? null,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'El reporte no se pudo leer.',
      );
    }

    if (parsed.rows.length === 0) {
      throw new BadRequestException(
        'El reporte no contiene números reconocibles.',
      );
    }

    const batch =
      existing ??
      (await client.recoveryPortabilityBatch.create({
        data: {
          organizationId: input.organizationId,
          kind: parsed.kind,
          fileName: basename(input.fileName).slice(0, 255),
          fileSha256,
          fileSize: input.report.byteLength,
          totalRows: parsed.rows.length,
          uploadedByUserId: input.actorUserId,
        },
        select: { id: true },
      }));

    const byNumber = new Map(
      parsed.rows.map((row) => [row.serviceNumber, row]),
    );
    const now = new Date();

    const counters = {
      matchedServices: 0,
      discardedServices: 0,
      discardedCases: 0,
      waitingCases: 0,
      revalidationCases: 0,
      scheduledServices: 0,
      plantLineServices: 0,
    };

    const services = await client.recoveryCaseService.findMany({
      where: {
        organizationId: input.organizationId,
        serviceNumber: { in: [...byNumber.keys()] },
        discardedAt: null,
        case: { status: { in: [...openCaseStatuses] } },
      },
      select: {
        id: true,
        caseId: true,
        serviceNumber: true,
        portabilityState: true,
        needsRevalidation: true,
        case: { select: { id: true, status: true, assignedUserId: true } },
      },
    });

    for (let offset = 0; offset < services.length; offset += serviceChunkSize) {
      const chunk = services.slice(offset, offset + serviceChunkSize);

      await client.$transaction(
        async (transaction) => {
          for (const service of chunk) {
            const row = byNumber.get(service.serviceNumber);

            if (!row) continue;

            await this.applyToService(
              transaction,
              input.organizationId,
              service,
              row,
              now,
              counters,
            );
          }
        },
        { timeout: 60_000 },
      );
    }

    await this.persistResults(
      client,
      input.organizationId,
      batch.id,
      parsed.rows,
      new Set(services.map((service) => service.serviceNumber)),
    );

    // Los contadores describen la última aplicación; el rastro por caso vive
    // en sus eventos, que sí son acumulativos.
    const updated = await client.recoveryPortabilityBatch.update({
      where: { id: batch.id },
      data: counters,
    });

    return {
      batchId: batch.id,
      reused: existing !== null,
      kind: parsed.kind,
      totalRows: updated.totalRows,
      matchedServices: updated.matchedServices,
      discardedServices: updated.discardedServices,
      discardedCases: updated.discardedCases,
      waitingCases: updated.waitingCases,
      revalidationCases: updated.revalidationCases,
      scheduledServices: updated.scheduledServices,
      plantLineServices: updated.plantLineServices,
    };
  }

  private async applyToService(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    service: {
      id: string;
      caseId: string;
      serviceNumber: string;
      portabilityState: string | null;
      needsRevalidation: boolean;
      case: { id: string; status: string; assignedUserId: string | null };
    },
    row: ParsedPortabilityRow,
    now: Date,
    counters: {
      matchedServices: number;
      discardedServices: number;
      discardedCases: number;
      waitingCases: number;
      revalidationCases: number;
      scheduledServices: number;
      plantLineServices: number;
    },
  ): Promise<void> {
    const decision = decideRecoveryPortability({
      state: row.state,
      receiverRaw: row.receiverRaw,
      windowDate: row.windowDate,
      now,
    });

    counters.matchedServices += 1;

    await transaction.recoveryCaseService.update({
      where: { id: service.id },
      data: {
        portabilityState: row.state,
        portabilityCheckedAt: now,
        portabilityWindowAt: row.windowDate,
        portabilityReceiver: row.receiverRaw?.slice(0, 150) ?? null,
        isPlantLine: decision.isPlantLine,
        needsRevalidation: decision.needsRevalidation,
        portabilityEligibleAt: decision.eligibleAt,
        ...(decision.outcome === 'DISCARD_ALREADY_ACTIVE'
          ? { discardedAt: now, discardReason: 'YA_ACTIVO' as const }
          : {}),
      },
    });

    if (decision.isPlantLine) counters.plantLineServices += 1;
    if (decision.outcome === 'SCHEDULE_UNTIL_ELIGIBLE') {
      counters.scheduledServices += 1;
    }

    if (decision.outcome === 'DISCARD_ALREADY_ACTIVE') {
      counters.discardedServices += 1;

      const remaining = await transaction.recoveryCaseService.count({
        where: { caseId: service.caseId, discardedAt: null },
      });

      if (remaining === 0) {
        await this.closeCaseAsDiscarded(
          transaction,
          organizationId,
          service.caseId,
          service.case.status,
          now,
        );
        counters.discardedCases += 1;
      }

      return;
    }

    if (
      decision.outcome === 'WAIT_IN_PROGRESS' ||
      decision.outcome === 'WAIT_REVALIDATE'
    ) {
      if (service.case.status === 'TRIAGE' || service.case.status === 'OPEN') {
        await transaction.recoveryCase.update({
          where: { id: service.caseId },
          data: { status: 'WAITING' },
        });

        await transaction.recoveryCaseEvent.create({
          data: {
            organizationId,
            caseId: service.caseId,
            type: 'PORTABILITY_WAITING',
            previousStatus: service.case.status as never,
            newStatus: 'WAITING',
            observation:
              decision.outcome === 'WAIT_IN_PROGRESS'
                ? 'Portación programada hacia Movistar con fecha: el pedido avanza.'
                : 'Portación programada sin fecha: se revalida en el próximo reporte.',
            metadata: {
              serviceNumber: service.serviceNumber,
            },
          },
        });

        counters.waitingCases += 1;
      }

      if (decision.needsRevalidation) counters.revalidationCases += 1;

      return;
    }

    /**
     * Una portación que falló devuelve el caso a quien lo trabajaba (BR-019e,
     * BR-087), pero solo cuando la espera la puso el sistema — el servicio
     * venía `PROGRAMADO` o estaba marcado para revalidación (el reporte del
     * asesor de BR-085 y el "interesado con pedido" de BR-086 usan esa
     * marca). Una espera marcada a mano por el supervisor se respeta: él vio
     * un pedido que este reporte no puede ver. Con asesor asignado, el caso
     * vuelve a su cola con próxima acción inmediata; sin asesor, al triage.
     */
    if (
      service.case.status === 'WAITING' &&
      (service.portabilityState === 'PROGRAMADO' ||
        service.needsRevalidation) &&
      (decision.outcome === 'OPPORTUNITY' ||
        decision.outcome === 'PLANT_LINE' ||
        decision.outcome === 'SCHEDULE_UNTIL_ELIGIBLE')
    ) {
      const backToOwner = service.case.assignedUserId !== null;
      // Portó a otro operador hace poco: con dueño, se agenda a la fecha de
      // habilitación (BR-039); la línea no es portable todavía.
      const scheduledUntil =
        decision.outcome === 'SCHEDULE_UNTIL_ELIGIBLE'
          ? decision.eligibleAt
          : null;
      const newStatus = backToOwner
        ? scheduledUntil
          ? ('SCHEDULED' as const)
          : ('ASSIGNED' as const)
        : ('TRIAGE' as const);

      await transaction.recoveryCase.update({
        where: { id: service.caseId },
        data: {
          status: newStatus,
          ...(backToOwner ? { nextActionAt: scheduledUntil ?? now } : {}),
        },
      });

      await transaction.recoveryCaseEvent.create({
        data: {
          organizationId,
          caseId: service.caseId,
          type: 'PORTABILITY_CROSSED',
          previousStatus: 'WAITING',
          newStatus,
          observation: backToOwner
            ? 'El reporte dice que la línea sigue portable: vuelve a la cola de su asesor.'
            : 'La portación no prosperó: el caso vuelve a ser oportunidad.',
          metadata: {
            serviceNumber: service.serviceNumber,
          },
        },
      });
    }
  }

  /**
   * BR-059/BR-087: portado a Movistar es terminal siempre, pero la
   * clasificación depende del esfuerzo invertido. Con intentos registrados
   * es una pérdida frente a otra agencia — la única que el sistema declara
   * solo, porque el hecho ya ocurrió y el reporte es la evidencia. Sin
   * intentos es un descarte que no cuenta como pérdida (BR-056).
   */
  private async closeCaseAsDiscarded(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    caseId: string,
    previousStatus: string,
    now: Date,
  ): Promise<void> {
    const attemptCount = await transaction.recoveryCaseAttempt.count({
      where: { caseId },
    });
    const asLoss = attemptCount > 0;

    await transaction.recoveryCase.update({
      where: { id: caseId },
      data: asLoss
        ? {
            status: 'LOST',
            lossReason: 'YA_MIGRO_OTRA_AGENCIA',
            resolvedAt: now,
            nextActionAt: null,
          }
        : {
            status: 'DISCARDED',
            discardReason: 'YA_ACTIVO',
            resolvedAt: now,
            nextActionAt: null,
          },
    });

    await transaction.recoveryCaseEvent.create({
      data: {
        organizationId,
        caseId,
        type: asLoss ? 'CASE_RESOLVED' : 'CASE_DISCARDED',
        previousStatus: previousStatus as never,
        newStatus: asLoss ? 'LOST' : 'DISCARDED',
        observation: asLoss
          ? 'Portado a Movistar con gestión previa: pérdida frente a otra agencia, con el reporte como evidencia (BR-059).'
          : 'Todas las líneas del cliente ya están activas en Movistar.',
        ...(asLoss
          ? { metadata: { lossReason: 'YA_MIGRO_OTRA_AGENCIA', attemptCount } }
          : {}),
      },
    });
  }

  private async persistResults(
    client: ReturnType<DatabaseService['getClient']>,
    organizationId: string,
    batchId: string,
    rows: ParsedPortabilityRow[],
    matched: Set<string>,
  ): Promise<void> {
    for (let offset = 0; offset < rows.length; offset += serviceChunkSize) {
      const chunk = rows.slice(offset, offset + serviceChunkSize);

      await client.recoveryPortabilityResult.createMany({
        data: chunk.map((row) => ({
          organizationId,
          batchId,
          serviceNumber: row.serviceNumber,
          state: row.state,
          receiverRaw: row.receiverRaw?.slice(0, 150) ?? null,
          cedentRaw: row.cedentRaw?.slice(0, 150) ?? null,
          windowDate: row.windowDate,
          isMovistarReceiver: row.isMovistarReceiver,
          matchedCase: matched.has(row.serviceNumber),
          rawData: row.rawData,
        })),
        skipDuplicates: true,
      });
    }
  }
}
