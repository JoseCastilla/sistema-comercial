import { createHash } from 'node:crypto';
import { basename } from 'node:path';

import { Injectable } from '@nestjs/common';

import type { Prisma } from '@repo/database';

import { DatabaseService } from '../database/database.service';

import {
  classifyDitoImportRow,
  normalizeDitoUsername,
  type DitoAgentIdentitySnapshot,
  type DitoImportPreviewClassification,
  type ExistingDitoOrderSnapshot,
} from './dito-import-preview';
import {
  ditoBatchParserVersion,
  parseDitoSalesWorkbook,
  type ParsedDitoBatchRow,
} from './dito-xlsx-parser';

export interface CreateDitoImportPreviewInput {
  organizationId: string;
  actorUserId: string;
  fileName: string;
  workbook: Buffer;
  now?: Date;
}

export interface DitoImportPreviewSummary {
  batchId: string;
  reused: boolean;
  status: 'PREVIEW' | 'READY' | 'CONFIRMING' | 'CONFIRMED' | 'FAILED';
  sourceRows: number;
  importableRows: number;
  excludedRows: number;
  invalidRows: number;
  newRows: number;
  enrichmentRows: number;
  unchangedRows: number;
  blockedRows: number;
  conflictRows: number;
}

interface PersistablePreviewRow {
  row: ParsedDitoBatchRow;
  classification: DitoImportPreviewClassification;
  issueCodes: string[];
  targetDitoOrderId: string | null;
  ditoAgentIdentityId: string | null;
  proposedChanges: Record<string, string | number | null> | null;
  conflicts: Array<{
    field: string;
    current: string | number | null;
    incoming: string | number | null;
  }> | null;
}

const batchSummarySelect = {
  id: true,
  status: true,
  sourceRows: true,
  importableRows: true,
  excludedRows: true,
  invalidRows: true,
  newRows: true,
  enrichmentRows: true,
  unchangedRows: true,
  blockedRows: true,
  conflictRows: true,
} as const;

@Injectable()
export class DitoImportPreviewService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createPreview(
    input: CreateDitoImportPreviewInput,
  ): Promise<DitoImportPreviewSummary> {
    const database = this.databaseService.getClient();
    const fileName = sanitizeFileName(input.fileName);
    const fileSha256 = createHash('sha256')
      .update(input.workbook)
      .digest('hex');
    const existing = await database.ditoImportBatch.findUnique({
      where: {
        organizationId_fileSha256: {
          organizationId: input.organizationId,
          fileSha256,
        },
      },
      select: batchSummarySelect,
    });

    if (existing) return toSummary(existing, true);

    const preview = await parseDitoSalesWorkbook(input.workbook, input.now);

    try {
      return await database.$transaction(async (transaction) => {
        const duplicate = await transaction.ditoImportBatch.findUnique({
          where: {
            organizationId_fileSha256: {
              organizationId: input.organizationId,
              fileSha256,
            },
          },
          select: batchSummarySelect,
        });

        if (duplicate) return toSummary(duplicate, true);

        const identities = await resolveIdentities(
          transaction,
          input.organizationId,
          preview.rows,
        );
        const orders = await findExistingOrders(
          transaction,
          input.organizationId,
          preview.rows,
        );
        const plannedRows = planRows(preview.rows, identities, orders);
        const counts = countClassifications(plannedRows);
        const status =
          counts.blockedRows === 0 && counts.conflictRows === 0
            ? ('READY' as const)
            : ('PREVIEW' as const);
        const ubigeoCatalogVersion =
          preview.rows[0]?.ubigeoCatalogVersion ?? 'unknown';
        const created = await transaction.ditoImportBatch.create({
          data: {
            organizationId: input.organizationId,
            fileName,
            fileSha256,
            fileSize: input.workbook.length,
            parserVersion: ditoBatchParserVersion,
            ubigeoCatalogVersion,
            sourceSheet: preview.sheetName,
            headerRow: preview.headerRow,
            status,
            sourceRows: preview.sourceRows,
            importableRows: preview.importable,
            excludedRows: preview.excluded,
            invalidRows: preview.invalid,
            ...counts,
            uploadedByUserId: input.actorUserId,
            rows: {
              create: plannedRows.map((planned) => ({
                organizationId: input.organizationId,
                sourceRow: planned.row.sourceRow,
                classification: planned.classification,
                issueCodes: planned.issueCodes,
                orderCodeNormalized: planned.row.orderCodeNormalized,
                displayedOrderCode: planned.row.displayedOrderCode,
                salesCode: planned.row.salesCode,
                ditoUsernameNormalized: normalizeDitoUsername(
                  planned.row.ditoUsername,
                ),
                ditoAgentIdentityId: planned.ditoAgentIdentityId,
                targetDitoOrderId: planned.targetDitoOrderId,
                parsedData: jsonValue(planned.row),
                proposedChanges: planned.proposedChanges
                  ? jsonValue(planned.proposedChanges)
                  : undefined,
                conflicts: planned.conflicts
                  ? jsonValue(planned.conflicts)
                  : undefined,
              })),
            },
          },
          select: batchSummarySelect,
        });

        return toSummary(created, false);
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      const concurrent = await database.ditoImportBatch.findUnique({
        where: {
          organizationId_fileSha256: {
            organizationId: input.organizationId,
            fileSha256,
          },
        },
        select: batchSummarySelect,
      });

      if (!concurrent) throw error;

      return toSummary(concurrent, true);
    }
  }
}

async function resolveIdentities(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  rows: ParsedDitoBatchRow[],
): Promise<Map<string, DitoAgentIdentitySnapshot>> {
  const descriptors = new Map<
    string,
    { externalUsername: string; displayName: string | null }
  >();

  for (const row of rows) {
    if (row.outcome !== 'IMPORTABLE') continue;

    const normalized = normalizeDitoUsername(row.ditoUsername);

    if (normalized && row.ditoUsername && !descriptors.has(normalized)) {
      descriptors.set(normalized, {
        externalUsername: row.ditoUsername,
        displayName: row.ditoUserName,
      });
    }
  }

  const identities = new Map<string, DitoAgentIdentitySnapshot>();

  for (const [normalized, descriptor] of descriptors) {
    const identity = await transaction.ditoAgentIdentity.upsert({
      where: {
        organizationId_externalUsernameNormalized: {
          organizationId,
          externalUsernameNormalized: normalized,
        },
      },
      create: {
        organizationId,
        externalUsername: descriptor.externalUsername,
        externalUsernameNormalized: normalized,
        displayName: descriptor.displayName,
      },
      update: {
        externalUsername: descriptor.externalUsername,
        displayName: descriptor.displayName,
      },
      select: {
        id: true,
        userId: true,
        isActive: true,
        isSharedAccount: true,
        user: {
          select: {
            status: true,
            memberships: {
              where: { organizationId, role: 'AGENT' },
              select: { userId: true },
              take: 1,
            },
            commercialTeamMemberships: {
              where: {
                memberRole: 'AGENT',
                isPrimary: true,
                isActive: true,
                team: { organizationId, status: 'ACTIVE' },
              },
              select: { teamId: true },
              take: 2,
            },
          },
        },
      },
    });
    const hasActiveAgent =
      identity.isActive &&
      !identity.isSharedAccount &&
      identity.user?.status === 'ACTIVE' &&
      identity.user.memberships.length === 1 &&
      identity.user.commercialTeamMemberships.length === 1;
    const teamId = identity.user?.commercialTeamMemberships[0]?.teamId ?? null;

    identities.set(normalized, {
      id: identity.id,
      userId: hasActiveAgent ? identity.userId : null,
      teamId: hasActiveAgent ? teamId : null,
      isSharedAccount: identity.isSharedAccount,
    });
  }

  return identities;
}

async function findExistingOrders(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  rows: ParsedDitoBatchRow[],
): Promise<ExistingDitoOrderSnapshot[]> {
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
    select: {
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
    },
  });

  return orders.map((order) => ({
    ...order,
    fixedCharge: order.fixedCharge?.toNumber() ?? null,
    deliveryLatitude: order.deliveryLatitude?.toNumber() ?? null,
    deliveryLongitude: order.deliveryLongitude?.toNumber() ?? null,
  }));
}

function planRows(
  rows: ParsedDitoBatchRow[],
  identities: Map<string, DitoAgentIdentitySnapshot>,
  orders: ExistingDitoOrderSnapshot[],
): PersistablePreviewRow[] {
  const byOrderCode = new Map(
    orders.map((order) => [order.orderCodeNormalized, order]),
  );
  const bySalesCode = new Map(
    orders
      .filter((order) => order.salesCode)
      .map((order) => [order.salesCode as string, order]),
  );

  return rows.map((row) => {
    const normalizedUsername = normalizeDitoUsername(row.ditoUsername);
    const orderByCode = row.orderCodeNormalized
      ? (byOrderCode.get(row.orderCodeNormalized) ?? null)
      : null;
    const identity = normalizedUsername
      ? (identities.get(normalizedUsername) ?? null)
      : null;
    const decision = classifyDitoImportRow(row, {
      identity: effectivePreviewIdentity(identity, orderByCode),
      orderByCode,
      orderBySalesCode: row.salesCode
        ? (bySalesCode.get(row.salesCode) ?? null)
        : null,
    });

    return { row, ...decision };
  });
}

function effectivePreviewIdentity(
  identity: DitoAgentIdentitySnapshot | null,
  order: ExistingDitoOrderSnapshot | null,
): DitoAgentIdentitySnapshot | null {
  if (identity?.isSharedAccount && order?.agentUserId && order.assignedTeamId) {
    return {
      ...identity,
      userId: order.agentUserId,
      teamId: order.assignedTeamId,
    };
  }

  return identity;
}

function countClassifications(rows: PersistablePreviewRow[]) {
  const count = (classification: DitoImportPreviewClassification) =>
    rows.filter((row) => row.classification === classification).length;

  return {
    newRows: count('NEW_ORDER'),
    enrichmentRows: count('ENRICHMENT'),
    unchangedRows: count('UNCHANGED'),
    blockedRows: count('BLOCKED_IDENTITY'),
    conflictRows: count('CONFLICT'),
  };
}

function uniqueValues(values: Array<string | null>): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function sanitizeFileName(value: string): string {
  const fileName = basename(value.trim()).slice(0, 255);

  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    throw new Error('El archivo debe tener extensión .xlsx.');
  }

  return fileName;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function toSummary(
  batch: {
    id: string;
    status: DitoImportPreviewSummary['status'];
    sourceRows: number;
    importableRows: number;
    excludedRows: number;
    invalidRows: number;
    newRows: number;
    enrichmentRows: number;
    unchangedRows: number;
    blockedRows: number;
    conflictRows: number;
  },
  reused: boolean,
): DitoImportPreviewSummary {
  return {
    batchId: batch.id,
    reused,
    status: batch.status,
    sourceRows: batch.sourceRows,
    importableRows: batch.importableRows,
    excludedRows: batch.excludedRows,
    invalidRows: batch.invalidRows,
    newRows: batch.newRows,
    enrichmentRows: batch.enrichmentRows,
    unchangedRows: batch.unchangedRows,
    blockedRows: batch.blockedRows,
    conflictRows: batch.conflictRows,
  };
}
