import { BadRequestException, ConflictException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

import { DitoImportConfirmationService } from './dito-import-confirmation.service';

const expectedUpdatedAt = new Date('2026-08-08T12:00:00.000Z');

const parsedRow = {
  sourceRow: 4,
  outcome: 'IMPORTABLE',
  issues: [],
  ditoStatus: 'APROBADO',
  salesCode: 'FE-100',
  orderCodeNormalized: '1943000001',
  displayedOrderCode: '1943000001A',
  registeredAt: '2026-08-01T15:30:00.000Z',
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

function batch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'batch-1',
    status: 'READY',
    parserVersion: '1.8',
    updatedAt: expectedUpdatedAt,
    newRows: 1,
    enrichmentRows: 0,
    unchangedRows: 0,
    excludedRows: 0,
    invalidRows: 0,
    rows: [],
    ...overrides,
  };
}

function storedRow(resolved: boolean, overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    sourceRow: 4,
    parsedData: parsedRow,
    ditoAgentIdentityId: 'identity-1',
    manualAgentUserId: null,
    manualTeamId: null,
    manualAgent: null,
    agentIdentity: {
      id: 'identity-1',
      userId: resolved ? 'agent-1' : null,
      isActive: true,
      isSharedAccount: false,
      user: resolved
        ? {
            status: 'ACTIVE',
            memberships: [{ userId: 'agent-1' }],
            commercialTeamMemberships: [{ teamId: 'team-1' }],
          }
        : null,
    },
    ...overrides,
  };
}

function existingOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    orderCodeNormalized: parsedRow.orderCodeNormalized,
    salesCode: parsedRow.salesCode,
    operationRaw: parsedRow.operationRaw,
    commercialOperation: parsedRow.commercialOperation,
    carrier: parsedRow.carrier,
    fixedCharge: { toNumber: () => parsedRow.fixedCharge },
    holderFullNameRaw: parsedRow.holderName,
    holderDocumentType: 'DNI',
    holderDocumentNumber: parsedRow.holderDocumentNumber,
    serviceNumber: parsedRow.serviceNumber,
    deliveryMethod: parsedRow.deliveryMethod,
    deliveryMethodRaw: parsedRow.deliveryMethodRaw,
    deliveryAddress: parsedRow.deliveryAddress,
    deliveryReference: parsedRow.deliveryReference,
    deliveryLatitude: { toNumber: () => parsedRow.deliveryLatitude },
    deliveryLongitude: { toNumber: () => parsedRow.deliveryLongitude },
    department: parsedRow.department,
    province: parsedRow.province,
    district: parsedRow.district,
    agentUserId: 'agent-1',
    assignedTeamId: 'team-1',
    agentNameRaw: parsedRow.salesAdvisorName,
    agentNameNormalized: 'ASESOR PRUEBA',
    updatedAt: new Date('2026-08-08T11:00:00.000Z'),
    ...overrides,
  };
}

function createService(transaction: Record<string, unknown>) {
  const database = {
    $transaction: jest.fn((callback: (client: unknown) => unknown) =>
      callback(transaction),
    ),
  };

  return {
    database,
    service: new DitoImportConfirmationService({
      getClient: () => database,
    } as unknown as DatabaseService),
  };
}

describe('DitoImportConfirmationService', () => {
  it('reuses an already confirmed batch without applying rows again', async () => {
    const transaction = {
      ditoImportBatch: {
        findFirst: jest.fn().mockResolvedValue(
          batch({
            status: 'CONFIRMED',
            newRows: 2,
            enrichmentRows: 3,
            unchangedRows: 4,
            excludedRows: 1,
            invalidRows: 1,
          }),
        ),
        updateMany: jest.fn(),
      },
      ditoOrder: { create: jest.fn(), updateMany: jest.fn() },
    };
    const { service } = createService(transaction);

    await expect(
      service.confirm({
        organizationId: 'organization-1',
        actorUserId: 'admin-1',
        batchId: 'batch-1',
        expectedUpdatedAt,
      }),
    ).resolves.toEqual({
      batchId: 'batch-1',
      reused: true,
      status: 'CONFIRMED',
      createdRows: 2,
      enrichedRows: 3,
      unchangedRows: 4,
      skippedRows: 2,
    });
    expect(transaction.ditoImportBatch.updateMany).not.toHaveBeenCalled();
    expect(transaction.ditoOrder.create).not.toHaveBeenCalled();
  });

  it('aborts the transaction when a DITO identity is still unresolved', async () => {
    const transaction = {
      ditoImportBatch: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            batch({ status: 'PREVIEW', rows: [storedRow(false)] }),
          ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
      ditoOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const { service } = createService(transaction);

    await expect(
      service.confirm({
        organizationId: 'organization-1',
        actorUserId: 'admin-1',
        batchId: 'batch-1',
        expectedUpdatedAt,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.ditoOrder.create).not.toHaveBeenCalled();
    expect(transaction.ditoImportBatch.update).not.toHaveBeenCalled();
  });

  it('rejects a stale batch version before claiming the transaction', async () => {
    const transaction = {
      ditoImportBatch: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            batch({ updatedAt: new Date('2026-08-08T12:01:00.000Z') }),
          ),
        updateMany: jest.fn(),
      },
      ditoOrder: { create: jest.fn(), updateMany: jest.fn() },
    };
    const { service } = createService(transaction);

    await expect(
      service.confirm({
        organizationId: 'organization-1',
        actorUserId: 'admin-1',
        batchId: 'batch-1',
        expectedUpdatedAt,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.ditoImportBatch.updateMany).not.toHaveBeenCalled();
    expect(transaction.ditoOrder.create).not.toHaveBeenCalled();
  });

  it('rejects an unconfirmed preview created by an older parser', async () => {
    const transaction = {
      ditoImportBatch: {
        findFirst: jest.fn().mockResolvedValue(batch({ parserVersion: '1.0' })),
        updateMany: jest.fn(),
      },
      ditoOrder: { create: jest.fn(), updateMany: jest.fn() },
    };
    const { service } = createService(transaction);

    await expect(
      service.confirm({
        organizationId: 'organization-1',
        actorUserId: 'admin-1',
        batchId: 'batch-1',
        expectedUpdatedAt,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.ditoImportBatch.updateMany).not.toHaveBeenCalled();
    expect(transaction.ditoOrder.create).not.toHaveBeenCalled();
  });

  it('uses a validated row assignment for a shared DITO account', async () => {
    const sharedRow = storedRow(false, {
      manualAgentUserId: 'agent-2',
      manualTeamId: 'team-before-transfer',
      manualAgent: {
        status: 'ACTIVE',
        memberships: [{ userId: 'agent-2' }],
        commercialTeamMemberships: [{ teamId: 'team-2' }],
      },
      agentIdentity: {
        id: 'identity-1',
        userId: null,
        isActive: true,
        isSharedAccount: true,
        user: null,
      },
    });
    const transaction = {
      ditoImportBatch: {
        findFirst: jest.fn().mockResolvedValue(batch({ rows: [sharedRow] })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      ditoOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'order-shared' }),
        updateMany: jest.fn(),
      },
      ditoImportRow: { update: jest.fn().mockResolvedValue({}) },
    };
    const { service } = createService(transaction);

    await service.confirm({
      organizationId: 'organization-1',
      actorUserId: 'admin-1',
      batchId: 'batch-1',
      expectedUpdatedAt,
    });

    expect(transaction.ditoOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest's asymmetric matcher is intentionally untyped at this boundary.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          agentUserId: 'agent-2',
          assignedTeamId: 'team-2',
        }),
      }),
    );
    expect(transaction.ditoImportRow.update).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest's asymmetric matcher is intentionally untyped at this boundary.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ manualTeamId: 'team-2' }),
      }),
    );
  });

  it('creates a resolved order once and marks the batch confirmed', async () => {
    const transaction = {
      ditoImportBatch: {
        findFirst: jest
          .fn()
          .mockResolvedValue(batch({ rows: [storedRow(true)] })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      ditoOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'order-1' }),
        updateMany: jest.fn(),
      },
      ditoImportRow: { update: jest.fn().mockResolvedValue({}) },
    };
    const { service } = createService(transaction);

    await expect(
      service.confirm({
        organizationId: 'organization-1',
        actorUserId: 'admin-1',
        batchId: 'batch-1',
        expectedUpdatedAt,
      }),
    ).resolves.toMatchObject({
      reused: false,
      status: 'CONFIRMED',
      createdRows: 1,
    });
    expect(transaction.ditoOrder.create).toHaveBeenCalledTimes(1);
    expect(transaction.ditoOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest's asymmetric matcher is intentionally untyped at this boundary.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          agentUserId: 'agent-1',
          assignedTeamId: 'team-1',
          eventId: 'dito-import:batch-1:4',
          commercialLinkStatus: 'UNMATCHED',
        }),
      }),
    );
    expect(transaction.ditoImportBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest's asymmetric matcher is intentionally untyped at this boundary.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          status: 'CONFIRMED',
          confirmedByUserId: 'admin-1',
        }),
      }),
    );
  });

  it('reapplies a reviewed conflict when the compared values are unchanged', async () => {
    const incomingRow = {
      ...parsedRow,
      commercialOperation: 'PORT_PREPAID',
      portabilityOriginRaw: 'PREPAGO',
      operationRaw: 'PORTA CLARO PRE 39.9',
      conflictResolutions: [
        {
          field: 'commercialOperation',
          current: 'PORT_POSTPAID',
          incoming: 'PORT_PREPAID',
          decision: 'USE_INCOMING',
          resolvedByUserId: 'admin-1',
          resolvedAt: '2026-08-08T11:30:00.000Z',
        },
      ],
    };
    const transaction = {
      ditoImportBatch: {
        findFirst: jest.fn().mockResolvedValue(
          batch({
            rows: [storedRow(true, { parsedData: incomingRow })],
          }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      ditoOrder: {
        findMany: jest.fn().mockResolvedValue([existingOrder()]),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      ditoOrderCorrection: { create: jest.fn().mockResolvedValue({}) },
      ditoOrderAssignmentHistory: { create: jest.fn() },
      ditoImportRow: { update: jest.fn().mockResolvedValue({}) },
    };
    const { service } = createService(transaction);

    await expect(
      service.confirm({
        organizationId: 'organization-1',
        actorUserId: 'admin-1',
        batchId: 'batch-1',
        expectedUpdatedAt,
      }),
    ).resolves.toMatchObject({
      status: 'CONFIRMED',
      enrichedRows: 1,
    });
    expect(transaction.ditoOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          commercialOperation: 'PORT_PREPAID',
          operationRaw: 'PORTA CLARO PRE 39.9',
        }),
      }),
    );
  });

  it('rejects a reviewed conflict when the current order changed afterward', async () => {
    const incomingRow = {
      ...parsedRow,
      commercialOperation: 'PORT_PREPAID',
      conflictResolutions: [
        {
          field: 'commercialOperation',
          current: 'PORT_POSTPAID',
          incoming: 'PORT_PREPAID',
          decision: 'USE_INCOMING',
        },
      ],
    };
    const transaction = {
      ditoImportBatch: {
        findFirst: jest.fn().mockResolvedValue(
          batch({
            rows: [storedRow(true, { parsedData: incomingRow })],
          }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
      ditoOrder: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            existingOrder({ commercialOperation: 'NEW_LINE' }),
          ]),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const { service } = createService(transaction);

    await expect(
      service.confirm({
        organizationId: 'organization-1',
        actorUserId: 'admin-1',
        batchId: 'batch-1',
        expectedUpdatedAt,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.ditoOrder.updateMany).not.toHaveBeenCalled();
  });
});
