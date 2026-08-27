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

    const existing = await client.recoveryPortabilityBatch.findUnique({
      where: {
        organizationId_fileSha256: {
          organizationId: input.organizationId,
          fileSha256,
        },
      },
    });

    if (existing) {
      return {
        batchId: existing.id,
        reused: true,
        kind: existing.kind,
        totalRows: existing.totalRows,
        matchedServices: existing.matchedServices,
        discardedServices: existing.discardedServices,
        discardedCases: existing.discardedCases,
        waitingCases: existing.waitingCases,
        revalidationCases: existing.revalidationCases,
        scheduledServices: existing.scheduledServices,
        plantLineServices: existing.plantLineServices,
      };
    }

    const parsed = parsePortabilityReport(input.report, {
      quickColumn: input.quickColumn ?? null,
    });

    if (parsed.rows.length === 0) {
      throw new BadRequestException(
        'El reporte no contiene números reconocibles.',
      );
    }

    const batch = await client.recoveryPortabilityBatch.create({
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
    });

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
        case: { select: { id: true, status: true } },
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

    const updated = await client.recoveryPortabilityBatch.update({
      where: { id: batch.id },
      data: counters,
    });

    return {
      batchId: batch.id,
      reused: false,
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
      case: { id: string; status: string };
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
     * Una portación que falló devuelve el caso al triage (BR-019e), pero solo
     * cuando la espera la puso el propio cruce (el servicio venía PROGRAMADO).
     * Una espera marcada a mano por el supervisor se respeta: él vio un
     * pedido que este reporte no puede ver.
     */
    if (
      service.case.status === 'WAITING' &&
      service.portabilityState === 'PROGRAMADO' &&
      (decision.outcome === 'OPPORTUNITY' || decision.outcome === 'PLANT_LINE')
    ) {
      await transaction.recoveryCase.update({
        where: { id: service.caseId },
        data: { status: 'TRIAGE' },
      });

      await transaction.recoveryCaseEvent.create({
        data: {
          organizationId,
          caseId: service.caseId,
          type: 'PORTABILITY_CROSSED',
          previousStatus: 'WAITING',
          newStatus: 'TRIAGE',
          observation:
            'La portación no prosperó: el caso vuelve a ser oportunidad.',
          metadata: {
            serviceNumber: service.serviceNumber,
          },
        },
      });
    }
  }

  private async closeCaseAsDiscarded(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    caseId: string,
    previousStatus: string,
    now: Date,
  ): Promise<void> {
    await transaction.recoveryCase.update({
      where: { id: caseId },
      data: {
        status: 'DISCARDED',
        discardReason: 'YA_ACTIVO',
        resolvedAt: now,
      },
    });

    await transaction.recoveryCaseEvent.create({
      data: {
        organizationId,
        caseId,
        type: 'CASE_DISCARDED',
        previousStatus: previousStatus as never,
        newStatus: 'DISCARDED',
        observation:
          'Todas las líneas del cliente ya están activas en Movistar.',
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
