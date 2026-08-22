import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import type { Prisma } from '@repo/database';

import { calculateInitialDeliverySchedule } from '../dito/dito-sla';
import { DatabaseService } from '../database/database.service';

import {
  classifyDitoImportRow,
  normalizeDitoUsername,
  type DitoAgentIdentitySnapshot,
  type DitoImportPreviewDecision,
  type DitoImportPreviewClassification,
  type ExistingDitoOrderSnapshot,
} from './dito-import-preview';
import {
  ditoBatchParserVersion,
  type ParsedDitoBatchRow,
} from './dito-xlsx-parser';

export interface ConfirmDitoImportBatchInput {
  organizationId: string;
  actorUserId: string;
  batchId: string;
  expectedUpdatedAt: Date;
}

export interface DitoImportConfirmationSummary {
  batchId: string;
  reused: boolean;
  status: 'CONFIRMED';
  createdRows: number;
  enrichedRows: number;
  unchangedRows: number;
  skippedRows: number;
}

const orderSnapshotSelect = {
  id: true,
  orderCodeNormalized: true,
  salesCode: true,
  operationRaw: true,
  commercialOperation: true,
  carrier: true,
  fixedCharge: true,
  holderFullNameRaw: true,
  holderDocumentType: true,
  holderDocumentNumber: true,
  serviceNumber: true,
  deliveryMethod: true,
  deliveryMethodRaw: true,
  deliveryAddress: true,
  deliveryReference: true,
  deliveryLatitude: true,
  deliveryLongitude: true,
  department: true,
  province: true,
  district: true,
  agentUserId: true,
  assignedTeamId: true,
  agentNameRaw: true,
  agentNameNormalized: true,
  updatedAt: true,
} as const;

type CurrentOrder = ExistingDitoOrderSnapshot & { updatedAt: Date };

@Injectable()
export class DitoImportConfirmationService {
  constructor(private readonly databaseService: DatabaseService) {}

  async confirm(
    input: ConfirmDitoImportBatchInput,
  ): Promise<DitoImportConfirmationSummary> {
    const database = this.databaseService.getClient();

    return database.$transaction(async (transaction) => {
      const batch = await transaction.ditoImportBatch.findFirst({
        where: { id: input.batchId, organizationId: input.organizationId },
        select: {
          id: true,
          status: true,
          parserVersion: true,
          updatedAt: true,
          newRows: true,
          enrichmentRows: true,
          unchangedRows: true,
          excludedRows: true,
          invalidRows: true,
          rows: {
            orderBy: { sourceRow: 'asc' },
            select: {
              id: true,
              sourceRow: true,
              parsedData: true,
              ditoAgentIdentityId: true,
              manualAgentUserId: true,
              manualTeamId: true,
              manualAgent: {
                select: {
                  status: true,
                  memberships: {
                    where: {
                      organizationId: input.organizationId,
                      role: { in: ['AGENT', 'SUPERVISOR'] },
                    },
                    select: { userId: true },
                    take: 1,
                  },
                  commercialTeamMemberships: {
                    where: {
                      salesEnabled: true,
                      isPrimary: true,
                      isActive: true,
                      team: {
                        organizationId: input.organizationId,
                        status: 'ACTIVE',
                      },
                    },
                    select: { teamId: true },
                    take: 2,
                  },
                },
              },
              agentIdentity: {
                select: {
                  id: true,
                  userId: true,
                  isActive: true,
                  isSharedAccount: true,
                  user: {
                    select: {
                      status: true,
                      memberships: {
                        where: {
                          organizationId: input.organizationId,
                          role: { in: ['AGENT', 'SUPERVISOR'] },
                        },
                        select: { userId: true },
                        take: 1,
                      },
                      commercialTeamMemberships: {
                        where: {
                          salesEnabled: true,
                          isPrimary: true,
                          isActive: true,
                          team: {
                            organizationId: input.organizationId,
                            status: 'ACTIVE',
                          },
                        },
                        select: { teamId: true },
                        take: 2,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!batch) {
        throw new BadRequestException('El lote no existe en la organización.');
      }

      if (batch.status === 'CONFIRMED') {
        return {
          batchId: batch.id,
          reused: true,
          status: 'CONFIRMED',
          createdRows: batch.newRows,
          enrichedRows: batch.enrichmentRows,
          unchangedRows: batch.unchangedRows,
          skippedRows: batch.excludedRows + batch.invalidRows,
        };
      }

      if (batch.parserVersion !== ditoBatchParserVersion) {
        throw new BadRequestException(
          'Esta vista previa usa una versión anterior del importador. Genera una nueva antes de confirmar.',
        );
      }

      if (batch.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
        throw new ConflictException(
          'El lote cambió mientras lo revisabas. Actualiza la página.',
        );
      }

      const claimed = await transaction.ditoImportBatch.updateMany({
        where: {
          id: batch.id,
          organizationId: input.organizationId,
          updatedAt: batch.updatedAt,
          status: { in: ['PREVIEW', 'READY', 'FAILED'] },
        },
        data: { status: 'CONFIRMING', failureReason: null },
      });

      if (claimed.count !== 1) {
        throw new ConflictException(
          'El lote ya está siendo confirmado por otro usuario.',
        );
      }

      const parsedRows = batch.rows.map((stored) => ({
        stored,
        row: readParsedRow(stored.parsedData),
      }));
      const identities = resolveIdentitySnapshots(batch.rows);
      const existingOrders = await findExistingOrders(
        transaction,
        input.organizationId,
        parsedRows.map((entry) => entry.row),
      );
      const byOrderCode = new Map(
        existingOrders.map((order) => [order.orderCodeNormalized, order]),
      );
      const bySalesCode = new Map(
        existingOrders
          .filter((order) => order.salesCode)
          .map((order) => [order.salesCode as string, order]),
      );
      const plans = parsedRows.map(({ stored, row }) => {
        const baseIdentity = stored.ditoAgentIdentityId
          ? (identities.get(stored.ditoAgentIdentityId) ?? null)
          : null;
        const orderByCode = row.orderCodeNormalized
          ? (byOrderCode.get(row.orderCodeNormalized) ?? null)
          : null;
        const identity = effectiveConfirmationIdentity(
          stored,
          baseIdentity,
          orderByCode,
        );
        const decision = applyStoredConflictResolutions(
          classifyDitoImportRow(row, {
            identity,
            orderByCode,
            orderBySalesCode: row.salesCode
              ? (bySalesCode.get(row.salesCode) ?? null)
              : null,
          }),
          stored.parsedData,
        );

        return { stored, row, identity, decision };
      });
      const counts = countClassifications(
        plans.map((plan) => plan.decision.classification),
      );

      if (counts.blockedRows > 0 || counts.conflictRows > 0) {
        throw new ConflictException(
          `No se puede confirmar: ${counts.blockedRows} filas sin asesor y ${counts.conflictRows} conflictos.`,
        );
      }

      const appliedAt = new Date();

      for (const plan of plans) {
        let applicationStatus: 'APPLIED' | 'SKIPPED' = 'SKIPPED';
        let targetDitoOrderId = plan.decision.targetDitoOrderId;

        if (plan.decision.classification === 'NEW_ORDER') {
          const created = await createOrder(transaction, {
            organizationId: input.organizationId,
            batchId: batch.id,
            sourceRow: plan.stored.sourceRow,
            row: plan.row,
            identity: requireResolvedIdentity(plan.identity),
          });
          targetDitoOrderId = created.id;
          applicationStatus = 'APPLIED';
        } else if (plan.decision.classification === 'ENRICHMENT') {
          const current = existingOrders.find(
            (order) => order.id === plan.decision.targetDitoOrderId,
          );

          if (!current || !plan.decision.proposedChanges) {
            throw new ConflictException(
              `La orden de la fila ${plan.stored.sourceRow} cambió durante la confirmación.`,
            );
          }

          await enrichOrder(transaction, {
            organizationId: input.organizationId,
            actorUserId: input.actorUserId,
            batchId: batch.id,
            current,
            changes: plan.decision.proposedChanges,
          });
          applicationStatus = 'APPLIED';
        }

        await transaction.ditoImportRow.update({
          where: { id: plan.stored.id },
          data: {
            classification: plan.decision.classification,
            issueCodes: plan.decision.issueCodes,
            targetDitoOrderId,
            proposedChanges: plan.decision.proposedChanges
              ? jsonValue(plan.decision.proposedChanges)
              : undefined,
            conflicts: plan.decision.conflicts
              ? jsonValue(plan.decision.conflicts)
              : undefined,
            applicationStatus,
            appliedAt,
            failureReason: null,
            ...(plan.stored.manualAgentUserId &&
            plan.identity?.isSharedAccount &&
            plan.identity.teamId
              ? { manualTeamId: plan.identity.teamId }
              : {}),
          },
        });
      }

      await transaction.ditoImportBatch.update({
        where: { id: batch.id },
        data: {
          status: 'CONFIRMED',
          confirmedByUserId: input.actorUserId,
          confirmedAt: appliedAt,
          failureReason: null,
          ...counts,
        },
      });

      return {
        batchId: batch.id,
        reused: false,
        status: 'CONFIRMED',
        createdRows: counts.newRows,
        enrichedRows: counts.enrichmentRows,
        unchangedRows: counts.unchangedRows,
        skippedRows: counts.excludedRows + counts.invalidRows,
      };
    });
  }
}

function resolveIdentitySnapshots(
  rows: Array<{
    ditoAgentIdentityId: string | null;
    agentIdentity: {
      id: string;
      userId: string | null;
      isActive: boolean;
      isSharedAccount: boolean;
      user: {
        status: string;
        memberships: Array<{ userId: string }>;
        commercialTeamMemberships: Array<{ teamId: string }>;
      } | null;
    } | null;
  }>,
): Map<string, DitoAgentIdentitySnapshot> {
  const result = new Map<string, DitoAgentIdentitySnapshot>();

  for (const row of rows) {
    const identity = row.agentIdentity;

    if (!identity || result.has(identity.id)) continue;

    const valid =
      identity.isActive &&
      !identity.isSharedAccount &&
      identity.userId !== null &&
      identity.user?.status === 'ACTIVE' &&
      identity.user.memberships.length === 1 &&
      identity.user.commercialTeamMemberships.length === 1;

    result.set(identity.id, {
      id: identity.id,
      userId: valid ? identity.userId : null,
      teamId: valid
        ? (identity.user?.commercialTeamMemberships[0]?.teamId ?? null)
        : null,
      isSharedAccount: identity.isSharedAccount,
    });
  }

  return result;
}

function effectiveConfirmationIdentity(
  row: {
    manualAgentUserId: string | null;
    manualTeamId: string | null;
    manualAgent: {
      status: string;
      memberships: Array<{ userId: string }>;
      commercialTeamMemberships: Array<{ teamId: string }>;
    } | null;
  },
  identity: DitoAgentIdentitySnapshot | null,
  existingOrder: ExistingDitoOrderSnapshot | null,
): DitoAgentIdentitySnapshot | null {
  if (!identity?.isSharedAccount) return identity;

  const manualMemberships = row.manualAgent?.commercialTeamMemberships ?? [];
  const currentPrimaryTeamId = manualMemberships[0]?.teamId ?? null;
  const hasValidManualAssignment =
    row.manualAgentUserId !== null &&
    row.manualTeamId !== null &&
    row.manualAgent?.status === 'ACTIVE' &&
    row.manualAgent.memberships.length === 1 &&
    manualMemberships.length === 1 &&
    currentPrimaryTeamId !== null;

  if (hasValidManualAssignment) {
    return {
      ...identity,
      userId: row.manualAgentUserId,
      teamId: currentPrimaryTeamId,
    };
  }

  if (existingOrder?.agentUserId && existingOrder.assignedTeamId) {
    return {
      ...identity,
      userId: existingOrder.agentUserId,
      teamId: existingOrder.assignedTeamId,
    };
  }

  return identity;
}

async function findExistingOrders(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  rows: ParsedDitoBatchRow[],
) {
  const orderCodes = uniqueValues(rows.map((row) => row.orderCodeNormalized));
  const salesCodes = uniqueValues(rows.map((row) => row.salesCode));

  if (orderCodes.length === 0 && salesCodes.length === 0) return [];

  const orders = await transaction.ditoOrder.findMany({
    where: {
      organizationId,
      OR: [
        { orderCodeNormalized: { in: orderCodes } },
        { salesCode: { in: salesCodes } },
      ],
    },
    select: orderSnapshotSelect,
  });

  return orders.map((order) => ({
    ...order,
    fixedCharge: order.fixedCharge?.toNumber() ?? null,
    deliveryLatitude: order.deliveryLatitude?.toNumber() ?? null,
    deliveryLongitude: order.deliveryLongitude?.toNumber() ?? null,
  }));
}

async function createOrder(
  transaction: Prisma.TransactionClient,
  input: {
    organizationId: string;
    batchId: string;
    sourceRow: number;
    row: ParsedDitoBatchRow;
    identity: { userId: string; teamId: string };
  },
) {
  const row = input.row;

  if (
    !row.registeredAt ||
    !row.orderCodeNormalized ||
    !row.displayedOrderCode ||
    !row.operationRaw ||
    !row.commercialOperation ||
    !row.carrier ||
    !row.holderName ||
    !row.holderDocumentNumber ||
    !row.serviceNumber ||
    !row.deliveryMethod ||
    !row.department ||
    !row.province ||
    !row.district
  ) {
    throw new BadRequestException(
      `La fila ${input.sourceRow} no contiene todos los campos requeridos.`,
    );
  }

  const schedule = calculateInitialDeliverySchedule(
    row.deliveryMethod,
    row.registeredAt,
  );
  const additionalDetails = {
    import_batch_id: input.batchId,
    import_source_row: input.sourceRow,
    dito_status: row.ditoStatus,
    dito_username: row.ditoUsername,
    sales_advisor_name: row.salesAdvisorName,
    customer_email: row.customerEmail,
    portability_origin_raw: row.portabilityOriginRaw,
    delivery_instructions: row.deliveryInstructions,
    delivery_option: row.deliveryOption,
    source_load_type: row.sourceLoadType,
    ubigeo_catalog_version: row.ubigeoCatalogVersion,
  };
  const sourceFingerprint = createHash('sha256')
    .update(JSON.stringify({ row, batchId: input.batchId }))
    .digest('hex');

  return transaction.ditoOrder.create({
    data: {
      organizationId: input.organizationId,
      eventId: `dito-import:${input.batchId}:${input.sourceRow}`,
      sourceFingerprint,
      productType: 'MOBILE',
      orderCodeRaw: row.displayedOrderCode,
      orderCodeNormalized: row.orderCodeNormalized,
      operationRaw: row.operationRaw,
      commercialOperation: row.commercialOperation,
      carrier: row.carrier,
      fixedCharge: row.fixedCharge,
      salesCode: row.salesCode,
      holderFullNameRaw: row.holderName,
      holderDocumentType: normalizeDocumentType(row.holderDocumentType),
      holderDocumentNumber: row.holderDocumentNumber,
      serviceNumber: row.serviceNumber,
      deliveryContactPhone: row.serviceNumber,
      deliveryAddress: row.deliveryAddress,
      deliveryReference: row.deliveryReference,
      deliveryLatitude: row.deliveryLatitude,
      deliveryLongitude: row.deliveryLongitude,
      deliveryMethod: row.deliveryMethod,
      deliveryMethodRaw: row.deliveryMethodRaw,
      department: row.department,
      province: row.province,
      district: row.district,
      agentNameRaw:
        row.salesAdvisorName ??
        row.ditoUserName ??
        row.ditoUsername ??
        'ASESOR DITO',
      agentNameNormalized: normalizeDitoUsername(
        row.salesAdvisorName ?? row.ditoUserName ?? row.ditoUsername,
      ),
      agentUserId: input.identity.userId,
      assignedTeamId: input.identity.teamId,
      rawSummary: createRawSummary(row),
      additionalDetails,
      parseStatus: 'PARSED',
      commercialLinkStatus: 'UNMATCHED',
      status: 'OPEN',
      statusRaw: 'ABIERTO',
      statusUpdatedAt: row.registeredAt,
      capturedAt: row.registeredAt,
      receivedAt: row.registeredAt,
      registeredAt: row.registeredAt,
      approvedAt: row.registeredAt,
      approvalSource: 'ASSUMED_FROM_REGISTRATION',
      deliveryWindowStart: schedule.deliveryWindowStart,
      deliveryWindowEnd: schedule.deliveryWindowEnd,
      deliveryDueAt: schedule.deliveryDueAt,
      deliveryStatus: 'PENDING',
    },
    select: { id: true },
  });
}

async function enrichOrder(
  transaction: Prisma.TransactionClient,
  input: {
    organizationId: string;
    actorUserId: string;
    batchId: string;
    current: CurrentOrder;
    changes: Record<string, string | number | null>;
  },
) {
  const changes = sanitizeChanges(input.changes);
  const completesAssignment =
    'agentUserId' in changes && 'assignedTeamId' in changes;
  const appliedChanges = changes;
  const keys = Object.keys(changes);
  const currentValues: Record<string, unknown> = { ...input.current };
  const previousValues: Record<string, string | number | boolean | null> =
    Object.fromEntries(
      keys.map((key) => [key, jsonScalar(currentValues[key])]),
    );
  const updated = await transaction.ditoOrder.updateMany({
    where: {
      id: input.current.id,
      organizationId: input.organizationId,
      updatedAt: input.current.updatedAt,
    },
    data: appliedChanges,
  });

  if (updated.count !== 1) {
    throw new ConflictException(
      `La orden ${input.current.orderCodeNormalized} cambió durante la confirmación.`,
    );
  }

  await transaction.ditoOrderCorrection.create({
    data: {
      organizationId: input.organizationId,
      ditoOrderId: input.current.id,
      source: 'DITO_BATCH_IMPORT',
      actorUserId: input.actorUserId,
      ditoImportBatchId: input.batchId,
      reason: 'Enriquecimiento confirmado desde archivo DITO.',
      previousValues: jsonValue(previousValues),
      newValues: jsonValue(appliedChanges),
    },
  });

  if (completesAssignment) {
    await transaction.ditoOrderAssignmentHistory.create({
      data: {
        organizationId: input.organizationId,
        ditoOrderId: input.current.id,
        previousAgentUserId: input.current.agentUserId,
        newAgentUserId: String(changes.agentUserId),
        previousTeamId: input.current.assignedTeamId,
        newTeamId: String(changes.assignedTeamId),
        originalAgentNameRaw: input.current.agentNameRaw,
        originalAgentNameNormalized: input.current.agentNameNormalized,
        reason: 'DATA_CORRECTION',
        observation: 'Responsable completado desde identidad DITO resuelta.',
        source: 'BACKFILL',
        performedByUserId: input.actorUserId,
        orderUpdatedAtBefore: input.current.updatedAt,
      },
    });
  }
}

function sanitizeChanges(
  input: Record<string, string | number | null>,
): Record<string, string | number | null> {
  const allowed = new Set([
    'salesCode',
    'operationRaw',
    'commercialOperation',
    'carrier',
    'fixedCharge',
    'holderFullNameRaw',
    'holderDocumentType',
    'holderDocumentNumber',
    'serviceNumber',
    'deliveryMethod',
    'deliveryMethodRaw',
    'deliveryAddress',
    'deliveryReference',
    'deliveryLatitude',
    'deliveryLongitude',
    'department',
    'province',
    'district',
    'agentUserId',
    'assignedTeamId',
  ]);

  return Object.fromEntries(
    Object.entries(input).filter(([field]) => allowed.has(field)),
  );
}

function countClassifications(
  classifications: DitoImportPreviewClassification[],
) {
  const count = (value: DitoImportPreviewClassification) =>
    classifications.filter((classification) => classification === value).length;

  return {
    newRows: count('NEW_ORDER'),
    enrichmentRows: count('ENRICHMENT'),
    unchangedRows: count('UNCHANGED'),
    excludedRows: count('EXCLUDED'),
    invalidRows: count('INVALID'),
    blockedRows: count('BLOCKED_IDENTITY'),
    conflictRows: count('CONFLICT'),
  };
}

function requireResolvedIdentity(identity: DitoAgentIdentitySnapshot | null): {
  userId: string;
  teamId: string;
} {
  if (!identity?.userId || !identity.teamId) {
    throw new BadRequestException('La identidad DITO no está resuelta.');
  }

  return { userId: identity.userId, teamId: identity.teamId };
}

function readParsedRow(value: Prisma.JsonValue): ParsedDitoBatchRow {
  const stored = value as unknown as ParsedDitoBatchRow & {
    registeredAt: string | null;
  };
  const registeredAt = stored.registeredAt
    ? new Date(stored.registeredAt)
    : null;

  if (
    !Number.isInteger(stored.sourceRow) ||
    (registeredAt && Number.isNaN(registeredAt.getTime()))
  ) {
    throw new BadRequestException('El lote contiene una fila inválida.');
  }

  return { ...stored, registeredAt };
}

type ConflictScalar = string | number | null;

interface StoredConflictResolution {
  field: string;
  current: ConflictScalar;
  incoming: ConflictScalar;
  decision: 'KEEP_CURRENT' | 'USE_INCOMING';
}

function applyStoredConflictResolutions(
  decision: DitoImportPreviewDecision,
  parsedData: Prisma.JsonValue,
): DitoImportPreviewDecision {
  if (decision.classification !== 'CONFLICT' || !decision.conflicts?.length) {
    return decision;
  }

  const resolutions = readConflictResolutions(parsedData);
  const proposedChanges = { ...(decision.proposedChanges ?? {}) };

  for (const conflict of decision.conflicts) {
    const resolution = resolutions.findLast(
      (candidate) =>
        candidate.field === conflict.field &&
        sameConflictScalar(candidate.current, conflict.current) &&
        sameConflictScalar(candidate.incoming, conflict.incoming),
    );

    if (!resolution) return decision;

    if (resolution.decision === 'USE_INCOMING') {
      proposedChanges[conflict.field] = conflict.incoming;

      if (conflict.field === 'commercialOperation') {
        const operationRaw = readJsonText(parsedData, 'operationRaw');
        if (operationRaw) proposedChanges.operationRaw = operationRaw;
      }
    } else {
      delete proposedChanges[conflict.field];
      if (conflict.field === 'commercialOperation') {
        delete proposedChanges.operationRaw;
      }
    }
  }

  return {
    ...decision,
    classification:
      Object.keys(proposedChanges).length > 0 ? 'ENRICHMENT' : 'UNCHANGED',
    issueCodes: decision.issueCodes.filter(
      (issue) => issue !== 'VALID_VALUE_CONFLICT',
    ),
    proposedChanges:
      Object.keys(proposedChanges).length > 0 ? proposedChanges : null,
    conflicts: null,
  };
}

function readConflictResolutions(
  parsedData: Prisma.JsonValue,
): StoredConflictResolution[] {
  if (
    !parsedData ||
    Array.isArray(parsedData) ||
    typeof parsedData !== 'object' ||
    !('conflictResolutions' in parsedData) ||
    !Array.isArray(parsedData.conflictResolutions)
  ) {
    return [];
  }

  return parsedData.conflictResolutions.flatMap((entry) => {
    if (
      !entry ||
      Array.isArray(entry) ||
      typeof entry !== 'object' ||
      typeof entry.field !== 'string' ||
      !isConflictScalar(entry.current) ||
      !isConflictScalar(entry.incoming) ||
      (entry.decision !== 'KEEP_CURRENT' && entry.decision !== 'USE_INCOMING')
    ) {
      return [];
    }

    return [
      {
        field: entry.field,
        current: entry.current,
        incoming: entry.incoming,
        decision: entry.decision,
      },
    ];
  });
}

function readJsonText(value: Prisma.JsonValue, key: string): string | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const candidate = value[key];
  return typeof candidate === 'string' && candidate.trim()
    ? candidate.trim()
    : null;
}

function isConflictScalar(value: unknown): value is ConflictScalar {
  return (
    value === null || typeof value === 'string' || typeof value === 'number'
  );
}

function sameConflictScalar(
  left: ConflictScalar,
  right: ConflictScalar,
): boolean {
  return left === right;
}

function normalizeDocumentType(value: string | null) {
  const normalized = normalizeDitoUsername(value);

  if (normalized === 'DNI') return 'DNI' as const;
  if (normalized?.startsWith('RUC')) return 'RUC_10' as const;

  return 'OTHER' as const;
}

function createRawSummary(row: ParsedDitoBatchRow): string {
  return [
    `OPERACIÓN: ${row.operationRaw}`,
    `NOMBRE: ${row.holderName}`,
    `DNI: ${row.holderDocumentNumber} / TELÉFONO: ${row.serviceNumber}`,
    '',
    `ZONAL: ${row.department} - ${row.province} - ${row.district}`,
    `ENTREGA: ${row.deliveryMethodRaw ?? row.deliveryMethod}`,
    '',
    `ASESOR: ${row.salesAdvisorName ?? row.ditoUserName ?? row.ditoUsername}`,
    `CÓDIGO DE ORDEN: ${row.displayedOrderCode}`,
  ].join('\n');
}

function uniqueValues(values: Array<string | null>): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function jsonScalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  return null;
}
