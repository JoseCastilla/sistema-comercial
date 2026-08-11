import type { DitoExtensionOrderEnvelopeV2 } from '@repo/contracts';

import { DatabaseService } from '../database/database.service';

import {
  DitoOrdersRepository,
  type CreateDitoOrderInput,
} from './dito-orders.repository';

type QueryArguments = [Record<string, unknown>];

interface DatabaseMock {
  organizationMember: {
    findFirst: jest.Mock<Promise<unknown>, QueryArguments>;
  };
  ditoOrder: {
    findFirst: jest.Mock<Promise<unknown>, QueryArguments>;
    create: jest.Mock<Promise<unknown>, QueryArguments>;
  };
}

function createDatabaseMock(): DatabaseMock {
  return {
    organizationMember: {
      findFirst: jest.fn<Promise<unknown>, QueryArguments>(),
    },
    ditoOrder: {
      findFirst: jest.fn<Promise<unknown>, QueryArguments>(),
      create: jest.fn<Promise<unknown>, QueryArguments>(),
    },
  };
}

function createEnvelope(): DitoExtensionOrderEnvelopeV2 {
  return {
    schema_version: '2.0',
    source: 'DITO_EXTENSION',
    event_id: 'dito:1943468019',
    captured_at: '2026-08-05T15:00:00.000Z',
    product_type: 'MOBILE',
    submitted_by: {
      installation_id: 'f24b8f20-6ce3-4c3f-a2bb-c10110c26c2d',
      email: 'carmen.ramirez@distribuidoronline.com',
    },
    order: {
      code_raw: '1943468019A',
      code_normalized: '1943468019',
      code_suffix: 'A',
      operation_raw: 'PORTA CLARO POST 39.9',
      commercial_operation: 'PORT_POSTPAID',
      carrier: 'CLARO',
      fixed_charge: 39.9,
      sales_code: 'FE-1128647263',
      billing_cycle_day: 9,
      payment_due_day: 22,
    },
    holder: {
      full_name: 'NOEL MARCOS ARZAPALO POMA',
      document_type: 'DNI',
      document_number: '47004223',
      service_number: '941586779',
    },
    delivery: {
      method: 'EXPRESS',
      department: 'AYACUCHO',
      province: 'HUAMANGA',
      district: 'AYACUCHO',
      contact_phone: '941586778',
      time_range: '3pm-7pm',
      address: 'AVENIDA MARISCAL ANDRES AVELINO CACERES 1220',
      reference: 'garilazo de la vega',
      latitude: -13.156957739,
      longitude: -74.227206392,
    },
    agent: { name_raw: 'Carmen R.' },
    raw_summary: 'OPERACION DE PRUEBA',
    additional_details: {
      parser_version: '2.3',
      delivery_raw: 'DELIVERY EXPRESS',
    },
  };
}

describe('DitoOrdersRepository', () => {
  let database: DatabaseMock;
  let repository: DitoOrdersRepository;

  beforeEach(() => {
    database = createDatabaseMock();
    const databaseService = {
      getClient: () => database,
    } as unknown as DatabaseService;
    repository = new DitoOrdersRepository(databaseService);
  });

  it('resolves the adviser and active primary team together by email', async () => {
    database.organizationMember.findFirst.mockResolvedValue({
      userId: 'user-carmen-ramirez',
      user: {
        commercialTeamMemberships: [{ teamId: 'team-lima' }],
      },
    });

    await expect(
      repository.resolveAgentAssignmentByEmail(
        'organization-1',
        'carmen.ramirez@distribuidoronline.com',
      ),
    ).resolves.toEqual({
      userId: 'user-carmen-ramirez',
      teamId: 'team-lima',
    });

    expect(database.organizationMember.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'organization-1',
        role: 'AGENT',
        user: {
          email: {
            equals: 'carmen.ramirez@distribuidoronline.com',
            mode: 'insensitive',
          },
          status: 'ACTIVE',
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            commercialTeamMemberships: {
              where: {
                memberRole: 'AGENT',
                isPrimary: true,
                isActive: true,
                team: {
                  organizationId: 'organization-1',
                  status: 'ACTIVE',
                },
              },
              take: 2,
              select: { teamId: true },
            },
          },
        },
      },
    });
  });

  it.each([
    ['no membership', null],
    [
      'no primary team',
      { userId: 'user-1', user: { commercialTeamMemberships: [] } },
    ],
    [
      'more than one primary team',
      {
        userId: 'user-1',
        user: {
          commercialTeamMemberships: [
            { teamId: 'team-1' },
            { teamId: 'team-2' },
          ],
        },
      },
    ],
  ])('does not assign an adviser when there is %s', async (_label, result) => {
    database.organizationMember.findFirst.mockResolvedValue(result);

    await expect(
      repository.resolveAgentAssignmentByEmail(
        'organization-1',
        'carmen.rivas@distribuidoronline.com',
      ),
    ).resolves.toBeNull();
  });

  it('detects an installation previously used with another email', async () => {
    database.ditoOrder.findFirst.mockResolvedValue({ id: 'existing-order' });

    await expect(
      repository.hasInstallationEmailConflict(
        'organization-1',
        'f24b8f20-6ce3-4c3f-a2bb-c10110c26c2d',
        'carmen.rivas@distribuidoronline.com',
      ),
    ).resolves.toBe(true);

    expect(database.ditoOrder.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'organization-1',
        submitterInstallationId: 'f24b8f20-6ce3-4c3f-a2bb-c10110c26c2d',
        submitterEmailNormalized: {
          not: 'carmen.rivas@distribuidoronline.com',
        },
      },
      select: { id: true },
    });
  });

  it('persists identity, assignment and delivery details in one order', async () => {
    database.ditoOrder.create.mockResolvedValue({
      id: 'order-1',
      sourceFingerprint: 'fingerprint-1',
    });

    const input: CreateDitoOrderInput = {
      organizationId: 'organization-1',
      envelope: createEnvelope(),
      sourceFingerprint: 'fingerprint-1',
      agentNameNormalized: 'CARMEN R',
      agentUserId: 'user-carmen-ramirez',
      assignedTeamId: 'team-lima',
      submitterInstallationId: 'f24b8f20-6ce3-4c3f-a2bb-c10110c26c2d',
      submitterEmailRaw: 'Carmen.Ramirez@distribuidoronline.com',
      submitterEmailNormalized: 'carmen.ramirez@distribuidoronline.com',
      parseStatus: 'PARSED',
      registeredAt: new Date('2026-08-05T15:01:00.000Z'),
      approvedAt: new Date('2026-08-05T15:01:00.000Z'),
      schedule: {
        serviceLevelHours: 3,
        scheduleStatus: 'SCHEDULED',
        deliveryWindowStart: new Date('2026-08-05T15:00:00.000Z'),
        deliveryWindowEnd: new Date('2026-08-05T19:00:00.000Z'),
        deliveryDueAt: new Date('2026-08-05T19:00:00.000Z'),
      },
    };

    await expect(repository.create(input)).resolves.toEqual({
      id: 'order-1',
      sourceFingerprint: 'fingerprint-1',
    });

    expect(database.ditoOrder.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        agentUserId: 'user-carmen-ramirez',
        assignedTeamId: 'team-lima',
        commercialLinkStatus: 'UNMATCHED',
        submitterEmailNormalized: 'carmen.ramirez@distribuidoronline.com',
        deliveryContactPhone: '941586778',
        deliveryTimeRangeRaw: '3pm-7pm',
        salesCode: 'FE-1128647263',
        billingCycleDay: 9,
        paymentDueDay: 22,
        deliveryLatitude: -13.156957739,
        deliveryLongitude: -74.227206392,
      },
      select: { id: true, sourceFingerprint: true },
    });
  });
});
