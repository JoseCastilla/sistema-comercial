import type { ParsedDitoBatchRow } from './dito-xlsx-parser';

export type DitoImportPreviewClassification =
  | 'NEW_ORDER'
  | 'ENRICHMENT'
  | 'UNCHANGED'
  | 'EXCLUDED'
  | 'INVALID'
  | 'BLOCKED_IDENTITY'
  | 'CONFLICT';

export interface ExistingDitoOrderSnapshot {
  id: string;
  orderCodeNormalized: string;
  salesCode: string | null;
  operationRaw: string;
  commercialOperation: string;
  carrier: string;
  fixedCharge: number | null;
  holderFullNameRaw: string;
  holderDocumentType: string;
  holderDocumentNumber: string;
  serviceNumber: string;
  deliveryMethod: string;
  deliveryMethodRaw: string | null;
  deliveryAddress: string | null;
  deliveryReference: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  department: string;
  province: string;
  district: string;
  agentUserId: string | null;
  assignedTeamId: string | null;
  agentNameRaw: string;
  agentNameNormalized: string | null;
}

export interface DitoAgentIdentitySnapshot {
  id: string;
  userId: string | null;
  teamId: string | null;
  isSharedAccount: boolean;
}

export interface DitoImportFieldDifference {
  field: string;
  current: string | number | null;
  incoming: string | number | null;
}

export interface DitoImportPreviewDecision {
  classification: DitoImportPreviewClassification;
  issueCodes: string[];
  targetDitoOrderId: string | null;
  ditoAgentIdentityId: string | null;
  proposedChanges: Record<string, string | number | null> | null;
  conflicts: DitoImportFieldDifference[] | null;
}

export interface DitoImportPreviewContext {
  identity: DitoAgentIdentitySnapshot | null;
  orderByCode: ExistingDitoOrderSnapshot | null;
  orderBySalesCode: ExistingDitoOrderSnapshot | null;
}

const placeholderValues = new Set(['', '-', 'N/A', 'NA', 'NULL', 'UNKNOWN']);

export function normalizeDitoUsername(value: string | null): string | null {
  if (!value) return null;

  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  return normalized || null;
}

export function classifyDitoImportRow(
  row: ParsedDitoBatchRow,
  context: DitoImportPreviewContext,
): DitoImportPreviewDecision {
  const base = {
    issueCodes: [...row.issues],
    targetDitoOrderId: context.orderByCode?.id ?? null,
    ditoAgentIdentityId: context.identity?.id ?? null,
    proposedChanges: null,
    conflicts: null,
  };

  if (row.outcome === 'EXCLUDED') {
    return { ...base, classification: 'EXCLUDED' };
  }

  if (row.outcome === 'INVALID') {
    return { ...base, classification: 'INVALID' };
  }

  const salesCodeOrderConflict =
    context.orderBySalesCode &&
    context.orderBySalesCode.id !== context.orderByCode?.id;

  if (salesCodeOrderConflict) {
    return {
      ...base,
      classification: 'CONFLICT',
      issueCodes: [...base.issueCodes, 'SALES_CODE_POINTS_TO_ANOTHER_ORDER'],
      conflicts: [
        {
          field: 'salesCode',
          current: context.orderBySalesCode?.orderCodeNormalized ?? null,
          incoming: row.orderCodeNormalized,
        },
      ],
    };
  }

  if (!context.identity?.userId || !context.identity.teamId) {
    return {
      ...base,
      classification: 'BLOCKED_IDENTITY',
      issueCodes: [...base.issueCodes, 'UNRESOLVED_DITO_IDENTITY'],
    };
  }

  if (!context.orderByCode) {
    return { ...base, classification: 'NEW_ORDER' };
  }

  const comparison = compareExistingOrder(context.orderByCode, row);
  const ownership = compareExistingOwnership(
    context.orderByCode,
    context.identity,
  );
  const proposedChanges = {
    ...comparison.proposedChanges,
    ...ownership.proposedChanges,
  };

  if (comparison.conflicts.length > 0 || ownership.conflicts.length > 0) {
    return {
      ...base,
      classification: 'CONFLICT',
      issueCodes: [...base.issueCodes, 'VALID_VALUE_CONFLICT'],
      proposedChanges:
        Object.keys(proposedChanges).length > 0 ? proposedChanges : null,
      conflicts: [...comparison.conflicts, ...ownership.conflicts],
    };
  }

  if (Object.keys(proposedChanges).length > 0) {
    return {
      ...base,
      classification: 'ENRICHMENT',
      proposedChanges,
    };
  }

  return { ...base, classification: 'UNCHANGED' };
}

function compareExistingOwnership(
  current: ExistingDitoOrderSnapshot,
  identity: DitoAgentIdentitySnapshot,
): {
  proposedChanges: Record<string, string>;
  conflicts: DitoImportFieldDifference[];
} {
  if (!identity.userId || !identity.teamId) {
    return { proposedChanges: {}, conflicts: [] };
  }

  if (current.agentUserId === null && current.assignedTeamId === null) {
    return {
      proposedChanges: {
        agentUserId: identity.userId,
        assignedTeamId: identity.teamId,
      },
      conflicts: [],
    };
  }

  if (
    current.agentUserId === identity.userId &&
    current.assignedTeamId === identity.teamId
  ) {
    return { proposedChanges: {}, conflicts: [] };
  }

  return {
    proposedChanges: {},
    conflicts: [
      {
        field: 'assignment',
        current: [current.agentUserId, current.assignedTeamId]
          .filter(Boolean)
          .join(':'),
        incoming: `${identity.userId}:${identity.teamId}`,
      },
    ],
  };
}

function compareExistingOrder(
  current: ExistingDitoOrderSnapshot,
  incoming: ParsedDitoBatchRow,
): {
  proposedChanges: Record<string, string | number | null>;
  conflicts: DitoImportFieldDifference[];
} {
  const proposedChanges: Record<string, string | number | null> = {};
  const conflicts: DitoImportFieldDifference[] = [];
  const candidates: Array<{
    field: keyof ExistingDitoOrderSnapshot;
    incoming: string | number | null;
    equivalent?: (left: string | number, right: string | number) => boolean;
  }> = [
    { field: 'salesCode', incoming: incoming.salesCode },
    {
      field: 'commercialOperation',
      incoming: incoming.commercialOperation,
    },
    { field: 'carrier', incoming: incoming.carrier },
    { field: 'fixedCharge', incoming: incoming.fixedCharge },
    {
      field: 'holderFullNameRaw',
      incoming: incoming.holderName,
      equivalent: equivalentText,
    },
    {
      field: 'holderDocumentType',
      incoming: normalizeDocumentType(incoming.holderDocumentType),
    },
    {
      field: 'holderDocumentNumber',
      incoming: incoming.holderDocumentNumber,
    },
    { field: 'serviceNumber', incoming: incoming.serviceNumber },
    { field: 'deliveryMethod', incoming: incoming.deliveryMethod },
    { field: 'deliveryMethodRaw', incoming: incoming.deliveryMethodRaw },
    {
      field: 'deliveryAddress',
      incoming: incoming.deliveryAddress,
      equivalent: equivalentText,
    },
    {
      field: 'deliveryReference',
      incoming: incoming.deliveryReference,
      equivalent: equivalentText,
    },
    {
      field: 'deliveryLatitude',
      incoming: incoming.deliveryLatitude,
      equivalent: equivalentCoordinate,
    },
    {
      field: 'deliveryLongitude',
      incoming: incoming.deliveryLongitude,
      equivalent: equivalentCoordinate,
    },
    {
      field: 'department',
      incoming: incoming.department,
      equivalent: equivalentText,
    },
    {
      field: 'province',
      incoming: incoming.province,
      equivalent: equivalentText,
    },
    {
      field: 'district',
      incoming: incoming.district,
      equivalent: equivalentText,
    },
  ];

  for (const candidate of candidates) {
    if (candidate.incoming === null || candidate.incoming === '') continue;

    const currentValue = current[candidate.field];

    if (currentValue === null || isMissingValue(currentValue)) {
      proposedChanges[candidate.field] = candidate.incoming;
      continue;
    }

    const equivalent = candidate.equivalent
      ? candidate.equivalent(currentValue, candidate.incoming)
      : equivalentScalar(currentValue, candidate.incoming);

    if (!equivalent) {
      conflicts.push({
        field: candidate.field,
        current: currentValue,
        incoming: candidate.incoming,
      });
    }
  }

  return { proposedChanges, conflicts };
}

function normalizeDocumentType(value: string | null): string | null {
  const normalized = normalizeDitoUsername(value);

  if (normalized === 'DNI') return 'DNI';
  if (normalized?.startsWith('RUC')) return 'RUC_10';

  return normalized ? 'OTHER' : null;
}

function isMissingValue(value: string | number | null): boolean {
  if (value === null) return true;
  if (typeof value === 'number') return false;

  return placeholderValues.has(value.trim().toUpperCase());
}

function equivalentScalar(
  left: string | number,
  right: string | number,
): boolean {
  if (typeof left === 'number' || typeof right === 'number') {
    return Number(left) === Number(right);
  }

  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

function equivalentText(
  left: string | number,
  right: string | number,
): boolean {
  return (
    normalizeDitoUsername(String(left)) === normalizeDitoUsername(String(right))
  );
}

function equivalentCoordinate(
  left: string | number,
  right: string | number,
): boolean {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  return (
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber) &&
    Math.abs(leftNumber - rightNumber) <= 0.000001
  );
}
