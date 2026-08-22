import {
  classifyDitoImportRow,
  normalizeDitoUsername,
  type DitoAgentIdentitySnapshot,
  type ExistingDitoOrderSnapshot,
} from './dito-import-preview';
import type { ParsedDitoBatchRow } from './dito-xlsx-parser';

const parsedRow: ParsedDitoBatchRow = {
  sourceRow: 4,
  outcome: 'IMPORTABLE',
  issues: [],
  ditoStatus: 'APROBADO',
  salesCode: 'FE-100',
  orderCodeNormalized: '1943000001',
  displayedOrderCode: '1943000001A',
  registeredAt: new Date('2026-08-01T15:30:00.000Z'),
  ditoUsername: 'usuario.asesor',
  ditoUserName: 'Asesor Prueba',
  salesAdvisorName: 'Asesor Prueba',
  holderName: 'CLIENTE PRUEBA',
  holderDocumentType: 'DNI',
  holderDocumentNumber: '12345678',
  customerEmail: 'cliente@example.com',
  serviceNumber: '900000001',
  portabilityOriginRaw: 'POSTPAGO',
  commercialOperation: 'PORT_POSTPAID',
  carrier: 'CLARO',
  fixedCharge: 39.9,
  operationRaw: 'PORTA CLARO POST 39.9',
  deliveryMethod: 'EXPRESS',
  deliveryMethodRaw: 'Delivery Express',
  department: 'LIMA',
  province: 'LIMA',
  district: 'MIRAFLORES',
  deliveryAddress: 'AV. PRUEBA 123',
  deliveryReference: 'FRENTE AL PARQUE',
  deliveryLatitude: -12.12,
  deliveryLongitude: -77.03,
  deliveryInstructions: null,
  deliveryOption: 'DELIVERY',
  sourceLoadType: 'MOBILE',
  ubigeoCatalogVersion: '2025-09-17',
};

const resolvedIdentity: DitoAgentIdentitySnapshot = {
  id: 'identity-1',
  userId: 'user-1',
  teamId: 'team-1',
  isSharedAccount: false,
};

const existingOrder: ExistingDitoOrderSnapshot = {
  id: 'order-1',
  orderCodeNormalized: '1943000001',
  salesCode: 'FE-100',
  operationRaw: 'PORTA CLARO POST 39.9',
  commercialOperation: 'PORT_POSTPAID',
  carrier: 'CLARO',
  fixedCharge: 39.9,
  holderFullNameRaw: 'CLIENTE PRUEBA',
  holderDocumentType: 'DNI',
  holderDocumentNumber: '12345678',
  serviceNumber: '900000001',
  deliveryMethod: 'EXPRESS',
  deliveryMethodRaw: 'Delivery Express',
  deliveryAddress: 'AV. PRUEBA 123',
  deliveryReference: 'FRENTE AL PARQUE',
  deliveryLatitude: -12.12,
  deliveryLongitude: -77.03,
  department: 'LIMA',
  province: 'LIMA',
  district: 'MIRAFLORES',
  agentUserId: 'user-1',
  assignedTeamId: 'team-1',
  agentNameRaw: 'Asesor Prueba',
  agentNameNormalized: 'ASESOR PRUEBA',
};

describe('DITO import preview classification', () => {
  it('normalizes the external DITO username as a stable organization key', () => {
    expect(normalizeDitoUsername('  Mar\u00eda.P\u00e9rez  ')).toBe(
      'MARIA.PEREZ',
    );
  });

  it('blocks an otherwise valid new order until the DITO identity is resolved', () => {
    const decision = classifyDitoImportRow(parsedRow, {
      identity: {
        id: 'identity-1',
        userId: null,
        teamId: null,
        isSharedAccount: false,
      },
      orderByCode: null,
      orderBySalesCode: null,
    });

    expect(decision).toMatchObject({
      classification: 'BLOCKED_IDENTITY',
      ditoAgentIdentityId: 'identity-1',
      issueCodes: ['UNRESOLVED_DITO_IDENTITY'],
    });
  });

  it('classifies a valid row with a resolved identity as a new order', () => {
    const decision = classifyDitoImportRow(parsedRow, {
      identity: resolvedIdentity,
      orderByCode: null,
      orderBySalesCode: null,
    });

    expect(decision.classification).toBe('NEW_ORDER');
  });

  it('proposes only fields that are missing or placeholders', () => {
    const decision = classifyDitoImportRow(parsedRow, {
      identity: resolvedIdentity,
      orderByCode: {
        ...existingOrder,
        deliveryAddress: null,
        deliveryReference: 'N/A',
        carrier: 'UNKNOWN',
      },
      orderBySalesCode: existingOrder,
    });

    expect(decision.classification).toBe('ENRICHMENT');
    expect(decision.proposedChanges).toEqual({
      carrier: 'CLARO',
      deliveryAddress: 'AV. PRUEBA 123',
      deliveryReference: 'FRENTE AL PARQUE',
    });
    expect(decision.conflicts).toBeNull();
  });

  it('reports valid differences as conflicts without proposing overwrites', () => {
    const decision = classifyDitoImportRow(parsedRow, {
      identity: resolvedIdentity,
      orderByCode: {
        ...existingOrder,
        serviceNumber: '900000099',
      },
      orderBySalesCode: existingOrder,
    });

    expect(decision.classification).toBe('CONFLICT');
    expect(decision.proposedChanges).toBeNull();
    expect(decision.conflicts).toEqual([
      {
        field: 'serviceNumber',
        current: '900000099',
        incoming: '900000001',
      },
    ]);
  });

  it('ignores coordinate differences caused only by spreadsheet precision', () => {
    const decision = classifyDitoImportRow(
      { ...parsedRow, deliveryLatitude: -8.426517015 },
      {
        identity: resolvedIdentity,
        orderByCode: { ...existingOrder, deliveryLatitude: -8.42651702 },
        orderBySalesCode: existingOrder,
      },
    );

    expect(decision.classification).toBe('UNCHANGED');
    expect(decision.conflicts).toBeNull();
  });

  it('blocks a sales code that already belongs to another order', () => {
    const decision = classifyDitoImportRow(parsedRow, {
      identity: resolvedIdentity,
      orderByCode: existingOrder,
      orderBySalesCode: {
        ...existingOrder,
        id: 'order-2',
        orderCodeNormalized: '1943999999',
      },
    });

    expect(decision.classification).toBe('CONFLICT');
    expect(decision.issueCodes).toContain('SALES_CODE_POINTS_TO_ANOTHER_ORDER');
  });

  it('keeps an identical existing order unchanged', () => {
    const decision = classifyDitoImportRow(parsedRow, {
      identity: resolvedIdentity,
      orderByCode: existingOrder,
      orderBySalesCode: existingOrder,
    });

    expect(decision).toMatchObject({
      classification: 'UNCHANGED',
      proposedChanges: null,
      conflicts: null,
    });
  });

  it('preserves parser exclusions without requiring an identity', () => {
    const decision = classifyDitoImportRow(
      {
        ...parsedRow,
        outcome: 'EXCLUDED',
        issues: ['STATUS_NOT_APPROVED'],
      },
      { identity: null, orderByCode: null, orderBySalesCode: null },
    );

    expect(decision.classification).toBe('EXCLUDED');
    expect(decision.issueCodes).toEqual(['STATUS_NOT_APPROVED']);
  });
});
