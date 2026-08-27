import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Prisma } from '@repo/database';
import {
  groupRecoveryRecordsByClient,
  type RecoveryClientGroup,
} from '@repo/validation';

import { DatabaseService } from '../database/database.service';

export interface ConfirmRecoveryBaseInput {
  organizationId: string;
  actorUserId: string;
  batchId: string;
  expectedUpdatedAt: Date;
}

export interface RecoveryBaseConfirmationSummary {
  batchId: string;
  status: 'CONFIRMED';
  newCases: number;
  sightingCases: number;
  appliedRecords: number;
}

const clientChunkSize = 50;

/**
 * Aplica un lote previsualizado creando casos por cliente (BR-006), con
 * servicios, teléfonos y avistamientos (BR-007, BR-009b). Reejecutar una
 * confirmación interrumpida retoma únicamente los registros pendientes.
 */
@Injectable()
export class RecoveryBaseConfirmationService {
  constructor(private readonly databaseService: DatabaseService) {}

  async confirm(
    input: ConfirmRecoveryBaseInput,
  ): Promise<RecoveryBaseConfirmationSummary> {
    const client = this.databaseService.getClient();

    const batch = await client.recoveryBaseBatch.findFirst({
      where: { id: input.batchId, organizationId: input.organizationId },
      select: { id: true, status: true, updatedAt: true },
    });

    if (!batch) {
      throw new NotFoundException('El lote no existe en esta organización.');
    }

    if (batch.status === 'CONFIRMED') {
      throw new BadRequestException('El lote ya fue confirmado.');
    }

    if (batch.status === 'FAILED') {
      throw new BadRequestException(
        'El lote falló al registrarse. Vuelve a subir el archivo.',
      );
    }

    if (
      batch.status === 'PREVIEW' &&
      batch.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
    ) {
      throw new ConflictException(
        'El lote cambió desde que lo abriste. Recarga la página.',
      );
    }

    await client.recoveryBaseBatch.update({
      where: { id: batch.id },
      data: { status: 'CONFIRMING' },
    });

    const pendingRecords = await client.recoveryBaseRecord.findMany({
      where: {
        batchId: batch.id,
        classification: 'ELIGIBLE',
        applicationStatus: 'PENDING',
      },
      orderBy: { sourceRow: 'asc' },
      select: {
        id: true,
        documentNumber: true,
        serviceNumber: true,
        contactPhone: true,
        holderName: true,
        registeredAt: true,
        modalityRaw: true,
        planRaw: true,
        equipmentRaw: true,
        carrierRaw: true,
        requiresIdentityValidation: true,
        rawData: true,
      },
    });

    const groups = groupRecoveryRecordsByClient(
      pendingRecords
        .filter(
          (record) =>
            record.documentNumber !== null &&
            record.serviceNumber !== null &&
            record.registeredAt !== null,
        )
        .map((record) => ({
          recordId: record.id,
          documentNumber: record.documentNumber!,
          serviceNumber: record.serviceNumber!,
          contactPhone: record.contactPhone,
          holderName: record.holderName,
          registeredAt: record.registeredAt!,
          modalityRaw: record.modalityRaw,
          planRaw: record.planRaw,
          equipmentRaw: record.equipmentRaw,
          carrierRaw: record.carrierRaw,
          requiresIdentityValidation: record.requiresIdentityValidation,
        })),
    );

    const rawByRecordId = new Map(
      pendingRecords.map((record) => [record.id, record.rawData]),
    );

    let newCases = 0;
    let sightingCases = 0;
    let appliedRecords = 0;

    for (let offset = 0; offset < groups.length; offset += clientChunkSize) {
      const chunk = groups.slice(offset, offset + clientChunkSize);

      const result = await client.$transaction(
        async (transaction) => {
          let chunkNewCases = 0;
          let chunkSightingCases = 0;
          let chunkAppliedRecords = 0;

          for (const group of chunk) {
            const outcome = await this.applyClientGroup(
              transaction,
              input,
              batch.id,
              group,
              rawByRecordId,
            );

            if (outcome === 'CREATED') chunkNewCases += 1;
            if (outcome === 'SIGHTED') chunkSightingCases += 1;

            chunkAppliedRecords += group.recordIds.length;
          }

          return {
            newCases: chunkNewCases,
            sightingCases: chunkSightingCases,
            appliedRecords: chunkAppliedRecords,
          };
        },
        { timeout: 60_000 },
      );

      newCases += result.newCases;
      sightingCases += result.sightingCases;
      appliedRecords += result.appliedRecords;
    }

    const confirmed = await client.recoveryBaseBatch.update({
      where: { id: batch.id },
      data: {
        status: 'CONFIRMED',
        confirmedByUserId: input.actorUserId,
        confirmedAt: new Date(),
        newCases: { increment: newCases },
        sightingCases: { increment: sightingCases },
      },
      select: { newCases: true, sightingCases: true },
    });

    return {
      batchId: batch.id,
      status: 'CONFIRMED',
      newCases: confirmed.newCases,
      sightingCases: confirmed.sightingCases,
      appliedRecords,
    };
  }

  private async applyClientGroup(
    transaction: Prisma.TransactionClient,
    input: ConfirmRecoveryBaseInput,
    batchId: string,
    group: RecoveryClientGroup,
    rawByRecordId: Map<string, Prisma.JsonValue>,
  ): Promise<'CREATED' | 'SIGHTED'> {
    const openCase = await transaction.recoveryCase.findFirst({
      where: {
        organizationId: input.organizationId,
        documentNumber: group.documentNumber,
        status: { notIn: ['RECOVERED', 'LOST', 'DISCARDED'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, lastSightingAt: true },
    });

    if (openCase) {
      await this.recordSightings(
        transaction,
        input,
        batchId,
        group,
        openCase.id,
      );

      if (group.lastRegisteredAt > openCase.lastSightingAt) {
        await transaction.recoveryCase.update({
          where: { id: openCase.id },
          data: { lastSightingAt: group.lastRegisteredAt },
        });
      }

      await transaction.recoveryCaseEvent.create({
        data: {
          organizationId: input.organizationId,
          caseId: openCase.id,
          type: 'SIGHTING_RECORDED',
          observation:
            'El cliente volvió a aparecer en la base nacional con un pedido nuevo.',
          metadata: { batchId },
        },
      });

      await this.markRecordsApplied(transaction, group, openCase.id);

      return 'SIGHTED';
    }

    const previousCase = await transaction.recoveryCase.findFirst({
      where: {
        organizationId: input.organizationId,
        documentNumber: group.documentNumber,
        status: { in: ['RECOVERED', 'LOST', 'DISCARDED'] },
      },
      orderBy: { resolvedAt: 'desc' },
      select: { id: true },
    });

    const firstRawData = rawByRecordId.get(group.recordIds[0]) as
      Record<string, string | null> | undefined;

    const createdCase = await transaction.recoveryCase.create({
      data: {
        organizationId: input.organizationId,
        source: 'NATIONAL_BASE',
        status: 'TRIAGE',
        documentNumber: group.documentNumber,
        holderName: group.holderName.slice(0, 200) || 'SIN NOMBRE',
        department: firstRawData?.department?.slice(0, 100) ?? null,
        province: firstRawData?.province?.slice(0, 100) ?? null,
        district: firstRawData?.district?.slice(0, 100) ?? null,
        contactSummary: buildContactSummary(firstRawData),
        requiresIdentityValidation: group.requiresIdentityValidation,
        fatherName: firstRawData?.fatherName?.slice(0, 150) ?? null,
        motherName: firstRawData?.motherName?.slice(0, 150) ?? null,
        birthPlace: firstRawData?.birthPlace?.slice(0, 150) ?? null,
        firstRegisteredAt: group.firstRegisteredAt,
        lastSightingAt: group.lastRegisteredAt,
        previousCaseId: previousCase?.id ?? null,
        services: {
          create: group.services.map((service) => ({
            organizationId: input.organizationId,
            serviceNumber: service.serviceNumber,
            modalityRaw: service.modalityRaw?.slice(0, 20) ?? null,
            planRaw: service.planRaw?.slice(0, 150) ?? null,
            equipmentRaw: service.equipmentRaw?.slice(0, 150) ?? null,
            carrierRaw: service.carrierRaw?.slice(0, 100) ?? null,
            firstRegisteredAt: service.firstRegisteredAt,
            lastRegisteredAt: service.lastRegisteredAt,
          })),
        },
        phones: {
          create: buildCasePhones(input.organizationId, group),
        },
      },
      select: { id: true },
    });

    await this.recordSightings(
      transaction,
      input,
      batchId,
      group,
      createdCase.id,
    );

    await transaction.recoveryCaseEvent.create({
      data: {
        organizationId: input.organizationId,
        caseId: createdCase.id,
        type: 'CASE_CREATED',
        newStatus: 'TRIAGE',
        observation: previousCase
          ? 'Caso creado desde la base nacional; sucede a un caso resuelto del mismo cliente.'
          : 'Caso creado desde la base nacional.',
        metadata: { batchId },
      },
    });

    await this.markRecordsApplied(transaction, group, createdCase.id);

    return 'CREATED';
  }

  private async recordSightings(
    transaction: Prisma.TransactionClient,
    input: ConfirmRecoveryBaseInput,
    batchId: string,
    group: RecoveryClientGroup,
    caseId: string,
  ): Promise<void> {
    for (const service of group.services) {
      await transaction.recoveryCaseService.upsert({
        where: {
          caseId_serviceNumber: {
            caseId,
            serviceNumber: service.serviceNumber,
          },
        },
        create: {
          organizationId: input.organizationId,
          caseId,
          serviceNumber: service.serviceNumber,
          modalityRaw: service.modalityRaw?.slice(0, 20) ?? null,
          planRaw: service.planRaw?.slice(0, 150) ?? null,
          equipmentRaw: service.equipmentRaw?.slice(0, 150) ?? null,
          carrierRaw: service.carrierRaw?.slice(0, 100) ?? null,
          firstRegisteredAt: service.firstRegisteredAt,
          lastRegisteredAt: service.lastRegisteredAt,
        },
        update: {
          lastRegisteredAt: service.lastRegisteredAt,
          planRaw: service.planRaw?.slice(0, 150) ?? null,
          carrierRaw: service.carrierRaw?.slice(0, 100) ?? null,
        },
      });
    }

    await transaction.recoveryCaseSighting.createMany({
      data: group.services.flatMap((service) =>
        service.sightings.map((sighting) => ({
          organizationId: input.organizationId,
          caseId,
          batchId,
          serviceNumber: service.serviceNumber,
          registeredAt: sighting.registeredAt,
        })),
      ),
      skipDuplicates: true,
    });

    for (const phoneNumber of group.contactPhones) {
      await transaction.recoveryCasePhone.upsert({
        where: { caseId_phoneNumber: { caseId, phoneNumber } },
        create: {
          organizationId: input.organizationId,
          caseId,
          phoneNumber,
          kind: 'CONTACT',
        },
        update: {},
      });
    }
  }

  private async markRecordsApplied(
    transaction: Prisma.TransactionClient,
    group: RecoveryClientGroup,
    caseId: string,
  ): Promise<void> {
    await transaction.recoveryBaseRecord.updateMany({
      where: { id: { in: group.recordIds } },
      data: {
        applicationStatus: 'APPLIED',
        caseId,
        appliedAt: new Date(),
      },
    });
  }
}

function buildContactSummary(
  rawData: Record<string, string | null> | undefined,
): Prisma.InputJsonValue | undefined {
  if (!rawData) return undefined;

  const summary: Record<string, string> = {};

  for (const key of [
    'deliveryMethod',
    'streetType',
    'streetName',
    'streetNumber',
    'housingType',
    'housingName',
    'block',
    'lot',
    'reference',
    'latitude',
    'longitude',
    'shippingInstructions',
  ]) {
    const value = rawData[key];

    if (value) {
      summary[key] = value;
    }
  }

  return Object.keys(summary).length > 0 ? summary : undefined;
}

function buildCasePhones(
  organizationId: string,
  group: RecoveryClientGroup,
): {
  organizationId: string;
  phoneNumber: string;
  kind: 'SERVICE' | 'CONTACT';
}[] {
  const phones = new Map<string, 'SERVICE' | 'CONTACT'>();

  for (const service of group.services) {
    phones.set(service.serviceNumber, 'SERVICE');
  }

  for (const phoneNumber of group.contactPhones) {
    if (!phones.has(phoneNumber)) {
      phones.set(phoneNumber, 'CONTACT');
    }
  }

  return [...phones.entries()].map(([phoneNumber, kind]) => ({
    organizationId,
    phoneNumber,
    kind,
  }));
}
