import { createHash } from 'node:crypto';
import { basename } from 'node:path';

import { BadRequestException, Injectable } from '@nestjs/common';

import { defaultRecoveryEligibilityConfig } from '@repo/validation';

import { DatabaseService } from '../database/database.service';

import {
  parseRecoveryBaseWorkbook,
  recoveryBaseParserVersion,
} from './recovery-base-xlsx-parser';

export interface CreateRecoveryBasePreviewInput {
  organizationId: string;
  actorUserId: string;
  fileName: string;
  workbook: Buffer;
}

export interface RecoveryBasePreviewSummary {
  batchId: string;
  reused: boolean;
  status: 'PREVIEW' | 'CONFIRMING' | 'CONFIRMED' | 'FAILED';
  sourceRows: number;
  eligibleRows: number;
  excludedRows: number;
  invalidRows: number;
}

const recordChunkSize = 500;

@Injectable()
export class RecoveryBasePreviewService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createPreview(
    input: CreateRecoveryBasePreviewInput,
  ): Promise<RecoveryBasePreviewSummary> {
    const client = this.databaseService.getClient();
    const fileSha256 = createHash('sha256')
      .update(input.workbook)
      .digest('hex');

    const existing = await client.recoveryBaseBatch.findUnique({
      where: {
        organizationId_fileSha256: {
          organizationId: input.organizationId,
          fileSha256,
        },
      },
      select: {
        id: true,
        status: true,
        sourceRows: true,
        eligibleRows: true,
        excludedRows: true,
        invalidRows: true,
      },
    });

    if (existing) {
      return {
        batchId: existing.id,
        reused: true,
        status: existing.status,
        sourceRows: existing.sourceRows,
        eligibleRows: existing.eligibleRows,
        excludedRows: existing.excludedRows,
        invalidRows: existing.invalidRows,
      };
    }

    const eligibilityConfig = await this.resolveActiveConfig(
      input.organizationId,
      input.actorUserId,
    );

    const parsed = await parseRecoveryBaseWorkbook(input.workbook, {
      modalities: eligibilityConfig.modalities,
      planNames: eligibilityConfig.planNames,
      equipmentNames: eligibilityConfig.equipmentNames,
      carrierNames: eligibilityConfig.carrierNames,
    });

    if (parsed.rows.length === 0) {
      throw new BadRequestException(
        'El archivo no contiene filas de datos legibles.',
      );
    }

    const eligibleRows = parsed.rows.filter(
      (row) => row.classification === 'ELIGIBLE',
    ).length;
    const excludedRows = parsed.rows.filter(
      (row) => row.classification === 'EXCLUDED',
    ).length;
    const invalidRows = parsed.rows.filter(
      (row) => row.classification === 'INVALID',
    ).length;

    const registeredDates = parsed.rows
      .map((row) => row.registeredAt)
      .filter((value): value is Date => value !== null)
      .sort((left, right) => left.getTime() - right.getTime());

    const batch = await client.recoveryBaseBatch.create({
      data: {
        organizationId: input.organizationId,
        fileName: basename(input.fileName).slice(0, 255),
        fileSha256,
        fileSize: input.workbook.byteLength,
        parserVersion: recoveryBaseParserVersion,
        status: 'PREVIEW',
        sourceRows: parsed.rows.length,
        eligibleRows,
        excludedRows,
        invalidRows,
        registeredFrom: registeredDates[0] ?? null,
        registeredTo: registeredDates[registeredDates.length - 1] ?? null,
        eligibilityConfigId: eligibilityConfig.id,
        uploadedByUserId: input.actorUserId,
      },
      select: { id: true },
    });

    try {
      for (
        let offset = 0;
        offset < parsed.rows.length;
        offset += recordChunkSize
      ) {
        const chunk = parsed.rows.slice(offset, offset + recordChunkSize);

        await client.recoveryBaseRecord.createMany({
          data: chunk.map((row) => ({
            organizationId: input.organizationId,
            batchId: batch.id,
            sourceRow: row.sourceRow,
            classification: row.classification,
            issueCodes: row.issueCodes,
            documentNumber: row.documentNumber,
            serviceNumber: row.serviceNumber,
            contactPhone: row.contactPhone,
            holderName: row.holderName?.slice(0, 200) ?? null,
            registeredAt: row.registeredAt,
            modalityRaw: row.modalityRaw?.slice(0, 20) ?? null,
            planRaw: row.planRaw?.slice(0, 150) ?? null,
            equipmentRaw: row.equipmentRaw?.slice(0, 150) ?? null,
            carrierRaw: row.carrierRaw?.slice(0, 100) ?? null,
            requiresIdentityValidation: row.requiresIdentityValidation,
            rawData: row.rawData,
          })),
        });
      }
    } catch (error) {
      await client.recoveryBaseBatch.update({
        where: { id: batch.id },
        data: {
          status: 'FAILED',
          failureReason:
            error instanceof Error
              ? error.message.slice(0, 2000)
              : 'Error desconocido al registrar las filas.',
        },
      });

      throw error;
    }

    return {
      batchId: batch.id,
      reused: false,
      status: 'PREVIEW',
      sourceRows: parsed.rows.length,
      eligibleRows,
      excludedRows,
      invalidRows,
    };
  }

  private async resolveActiveConfig(
    organizationId: string,
    actorUserId: string,
  ) {
    const client = this.databaseService.getClient();

    const active = await client.recoveryEligibilityConfig.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (active) {
      return active;
    }

    return client.recoveryEligibilityConfig.create({
      data: {
        organizationId,
        modalities: defaultRecoveryEligibilityConfig.modalities,
        planNames: defaultRecoveryEligibilityConfig.planNames,
        equipmentNames: defaultRecoveryEligibilityConfig.equipmentNames,
        carrierNames: defaultRecoveryEligibilityConfig.carrierNames,
        createdByUserId: actorUserId,
      },
    });
  }
}
