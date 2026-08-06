jest.mock('@repo/validation', () => ({
  normalizeAgentAlias: (value: unknown): string | null => {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

    return normalized || null;
  },
}));

import { UnauthorizedException } from '@nestjs/common';

import type {
  DitoExtensionOrderEnvelopeV2,
  DitoIncomingOrderEnvelope,
  DitoLegacyOrderEnvelopeV1,
} from '@repo/contracts';

import { createHash } from 'node:crypto';

import type {
  CreateDitoOrderInput,
  DitoOrganization,
  PersistedDitoOrder,
} from './dito-orders.repository';

import { DitoOrdersRepository } from './dito-orders.repository';
import { DitoWebhookService } from './dito-webhook.service';
import { DitoWebhookValidationService } from './dito-webhook-validation.service';

interface ValidationServiceMock {
  parse: jest.Mock<Promise<DitoIncomingOrderEnvelope>, [unknown]>;
}

interface RepositoryMock {
  findOrganizationBySlug: jest.Mock<Promise<DitoOrganization | null>, [string]>;

  resolveAgentUserIdByAlias: jest.Mock<
    Promise<string | null>,
    [string, string]
  >;

  resolveAgentAssignmentByEmail: jest.Mock<
    Promise<{ userId: string; teamId: string } | null>,
    [string, string]
  >;

  hasInstallationEmailConflict: jest.Mock<
    Promise<boolean>,
    [string, string, string]
  >;

  create: jest.Mock<Promise<PersistedDitoOrder>, [CreateDitoOrderInput]>;

  findExisting: jest.Mock<
    Promise<PersistedDitoOrder | null>,
    [string, string, string]
  >;

  markNeedsReview: jest.Mock<Promise<void>, [string]>;
}

function createIdentityEnvelope(
  overrides: Partial<DitoExtensionOrderEnvelopeV2> = {},
): DitoExtensionOrderEnvelopeV2 {
  const legacy = createEnvelope();

  return {
    ...legacy,
    schema_version: '2.0',
    source: 'DITO_EXTENSION',
    submitted_by: {
      installation_id: 'f24b8f20-6ce3-4c3f-a2bb-c10110c26c2d',
      email: 'carmen.ramirez@distribuidoronline.com',
    },
    ...overrides,
  };
}

function createEnvelope(
  overrides: Partial<DitoLegacyOrderEnvelopeV1> = {},
): DitoLegacyOrderEnvelopeV1 {
  const baseEnvelope: DitoLegacyOrderEnvelopeV1 = {
    schema_version: '1.0',
    source: 'DITO_EXTENSION_LEGACY',

    event_id: 'dito:1941912820',

    captured_at: '2026-08-02T15:03:00.000Z',

    product_type: 'MOBILE',

    order: {
      code_raw: '1941912820A',

      code_normalized: '1941912820',

      code_suffix: 'A',

      operation_raw: 'PORTA ENTEL PRE 39.9',

      commercial_operation: 'PORT_PREPAID',

      carrier: 'ENTEL',

      fixed_charge: 39.9,

      sales_code: null,

      billing_cycle_day: null,

      payment_due_day: null,
    },

    holder: {
      full_name: 'ELMER HUIÑAPI INUMA',

      document_type: 'DNI',

      document_number: '48316585',

      service_number: '908649047',
    },

    delivery: {
      method: 'EXPRESS',

      department: 'LIMA',

      province: 'LIMA',

      district: 'BREÑA',
    },

    agent: {
      name_raw: 'Jimena C.',
    },

    raw_summary: [
      'OPERACIÓN: PORTA ENTEL PRE 39.9',
      'NOMBRE: ELMER HUIÑAPI INUMA',
      'DNI: 48316585 / TELÉFONO: 908649047',
      '',
      'ZONAL: LIMA - LIMA - BREÑA',
      'ENTREGA: DELIVERY EXPRESS',
      '',
      'ASESOR: Jimena C.',
      'CÓDIGO DE ORDEN: 1941912820A',
    ].join('\n'),

    additional_details: {
      parser_version: '1.1',

      delivery_raw: 'DELIVERY EXPRESS',

      zonal_raw: 'LIMA - LIMA - BREÑA',
    },
  };

  return {
    ...baseEnvelope,
    ...overrides,
  };
}

function createFingerprint(envelope: DitoLegacyOrderEnvelopeV1): string {
  const normalizedSummary = envelope.raw_summary
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  const canonicalPayload = {
    product_type: envelope.product_type,

    order: {
      code_raw: envelope.order.code_raw,

      code_normalized: envelope.order.code_normalized,

      code_suffix: envelope.order.code_suffix,

      operation_raw: envelope.order.operation_raw,

      commercial_operation: envelope.order.commercial_operation,

      carrier: envelope.order.carrier,

      fixed_charge: envelope.order.fixed_charge,

      sales_code: envelope.order.sales_code,

      billing_cycle_day: envelope.order.billing_cycle_day,

      payment_due_day: envelope.order.payment_due_day,
    },

    holder: {
      full_name: envelope.holder.full_name,

      document_type: envelope.holder.document_type,

      document_number: envelope.holder.document_number,

      service_number: envelope.holder.service_number,
    },

    delivery: {
      method: envelope.delivery.method,

      department: envelope.delivery.department,

      province: envelope.delivery.province,

      district: envelope.delivery.district,
    },

    agent: {
      name_raw: envelope.agent.name_raw,
    },

    raw_summary: normalizedSummary,
  };

  return createHash('sha256')
    .update(JSON.stringify(canonicalPayload), 'utf8')
    .digest('hex');
}

describe('DitoWebhookService', () => {
  const originalSecret = process.env.DITO_WEBHOOK_SECRET;

  const originalOrganizationSlug = process.env.DITO_WEBHOOK_ORGANIZATION_SLUG;

  let validationService: ValidationServiceMock;

  let repository: RepositoryMock;

  let service: DitoWebhookService;

  beforeAll(() => {
    process.env.DITO_WEBHOOK_SECRET = 'test-dito-webhook-secret';

    process.env.DITO_WEBHOOK_ORGANIZATION_SLUG = 'distribuidor-online';
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.DITO_WEBHOOK_SECRET;
    } else {
      process.env.DITO_WEBHOOK_SECRET = originalSecret;
    }

    if (originalOrganizationSlug === undefined) {
      delete process.env.DITO_WEBHOOK_ORGANIZATION_SLUG;
    } else {
      process.env.DITO_WEBHOOK_ORGANIZATION_SLUG = originalOrganizationSlug;
    }
  });

  beforeEach(() => {
    validationService = {
      parse: jest.fn<Promise<DitoIncomingOrderEnvelope>, [unknown]>(),
    };

    repository = {
      findOrganizationBySlug: jest.fn<
        Promise<DitoOrganization | null>,
        [string]
      >(),

      resolveAgentUserIdByAlias: jest.fn<
        Promise<string | null>,
        [string, string]
      >(),

      resolveAgentAssignmentByEmail: jest.fn<
        Promise<{ userId: string; teamId: string } | null>,
        [string, string]
      >(),

      hasInstallationEmailConflict: jest.fn<
        Promise<boolean>,
        [string, string, string]
      >(),

      create: jest.fn<Promise<PersistedDitoOrder>, [CreateDitoOrderInput]>(),

      findExisting: jest.fn<
        Promise<PersistedDitoOrder | null>,
        [string, string, string]
      >(),

      markNeedsReview: jest.fn<Promise<void>, [string]>(),
    };

    repository.resolveAgentUserIdByAlias.mockResolvedValue(null);
    repository.resolveAgentAssignmentByEmail.mockResolvedValue(null);
    repository.hasInstallationEmailConflict.mockResolvedValue(false);

    repository.findOrganizationBySlug.mockResolvedValue({
      id: 'organization-1',
      slug: 'distribuidor-online',
    });

    const validationServicePort: DitoWebhookValidationService =
      validationService;

    service = new DitoWebhookService(
      validationServicePort,

      repository as unknown as DitoOrdersRepository,
    );
  });

  it('rejects a missing webhook secret', async () => {
    await expect(service.ingest({}, undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(validationService.parse).not.toHaveBeenCalled();
  });

  it('rejects an invalid webhook secret', async () => {
    await expect(service.ingest({}, 'incorrect-secret')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(validationService.parse).not.toHaveBeenCalled();
  });

  it('stores a new Express order with a three-hour SLA', async () => {
    const envelope = createEnvelope();

    validationService.parse.mockResolvedValue(envelope);

    repository.resolveAgentUserIdByAlias.mockResolvedValue('agent-user-1');

    repository.create.mockResolvedValue({
      id: 'dito-order-1',

      sourceFingerprint: createFingerprint(envelope),
    });

    const result = await service.ingest(envelope, 'test-dito-webhook-secret');

    expect(result).toEqual({
      accepted: true,
      duplicate: false,

      event_id: 'dito:1941912820',

      dito_order_id: 'dito-order-1',

      status: 'RECEIVED',
    });

    expect(repository.findOrganizationBySlug).toHaveBeenCalledWith(
      'distribuidor-online',
    );

    expect(repository.resolveAgentUserIdByAlias).toHaveBeenCalledWith(
      'organization-1',
      'JIMENA C.',
    );

    expect(repository.create).toHaveBeenCalledTimes(1);

    const createInput = repository.create.mock.calls[0]?.[0];

    expect(createInput).toBeDefined();

    expect(createInput?.organizationId).toBe('organization-1');

    expect(createInput?.agentNameNormalized).toBe('JIMENA C.');

    expect(createInput?.agentUserId).toBe('agent-user-1');

    expect(createInput?.parseStatus).toBe('PARSED');

    expect(createInput?.registeredAt).toEqual(
      new Date('2026-08-02T15:03:00.000Z'),
    );

    expect(createInput?.approvedAt).toEqual(
      new Date('2026-08-02T15:03:00.000Z'),
    );

    expect(createInput?.schedule).toEqual({
      serviceLevelHours: 3,

      scheduleStatus: 'SCHEDULED',

      deliveryWindowStart: new Date('2026-08-02T15:03:00.000Z'),

      deliveryWindowEnd: new Date('2026-08-02T18:03:00.000Z'),

      deliveryDueAt: new Date('2026-08-02T18:03:00.000Z'),
    });

    expect(createInput?.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('resolves an identity envelope by corporate email and primary team', async () => {
    const envelope = createIdentityEnvelope();

    validationService.parse.mockResolvedValue(envelope);
    repository.resolveAgentAssignmentByEmail.mockResolvedValue({
      userId: 'carmen-ramirez-user',
      teamId: 'team-lima-1',
    });
    repository.create.mockResolvedValue({
      id: 'dito-order-email',
      sourceFingerprint: 'fingerprint-email',
    });

    await service.ingest(envelope, 'test-dito-webhook-secret');

    expect(repository.hasInstallationEmailConflict).toHaveBeenCalledWith(
      'organization-1',
      'f24b8f20-6ce3-4c3f-a2bb-c10110c26c2d',
      'carmen.ramirez@distribuidoronline.com',
    );
    expect(repository.resolveAgentAssignmentByEmail).toHaveBeenCalledWith(
      'organization-1',
      'carmen.ramirez@distribuidoronline.com',
    );
    expect(repository.resolveAgentUserIdByAlias).not.toHaveBeenCalled();

    const createInput = repository.create.mock.calls[0]?.[0];

    expect(createInput).toMatchObject({
      agentUserId: 'carmen-ramirez-user',
      assignedTeamId: 'team-lima-1',
      submitterInstallationId: 'f24b8f20-6ce3-4c3f-a2bb-c10110c26c2d',
      submitterEmailRaw: 'carmen.ramirez@distribuidoronline.com',
      submitterEmailNormalized: 'carmen.ramirez@distribuidoronline.com',
      matchStatus: 'UNMATCHED',
    });
  });

  it('does not fall back to alias when an installation changes email', async () => {
    const envelope = createIdentityEnvelope();

    validationService.parse.mockResolvedValue(envelope);
    repository.hasInstallationEmailConflict.mockResolvedValue(true);
    repository.resolveAgentUserIdByAlias.mockResolvedValue('alias-user');
    repository.create.mockResolvedValue({
      id: 'dito-order-conflict',
      sourceFingerprint: 'fingerprint-conflict',
    });

    await service.ingest(envelope, 'test-dito-webhook-secret');

    expect(repository.resolveAgentAssignmentByEmail).not.toHaveBeenCalled();
    expect(repository.resolveAgentUserIdByAlias).not.toHaveBeenCalled();
    expect(repository.create.mock.calls[0]?.[0]).toMatchObject({
      agentUserId: null,
      assignedTeamId: null,
      matchStatus: 'NEEDS_REVIEW',
    });
  });

  it('keeps a regular order pending until a shift is assigned', async () => {
    const envelope = createEnvelope({
      delivery: {
        method: 'REGULAR_48H',

        department: 'LIMA',

        province: 'LIMA',

        district: 'CARABAYLLO',
      },
    });

    validationService.parse.mockResolvedValue(envelope);

    repository.create.mockResolvedValue({
      id: 'dito-order-regular',

      sourceFingerprint: createFingerprint(envelope),
    });

    await service.ingest(envelope, 'test-dito-webhook-secret');

    const createInput = repository.create.mock.calls[0]?.[0];

    expect(createInput?.schedule).toEqual({
      serviceLevelHours: 48,

      scheduleStatus: 'PENDING_SHIFT',

      deliveryWindowStart: null,

      deliveryWindowEnd: null,

      deliveryDueAt: null,
    });
  });

  it('returns the existing order when the event is duplicated', async () => {
    const envelope = createEnvelope();

    const fingerprint = createFingerprint(envelope);

    validationService.parse.mockResolvedValue(envelope);

    repository.create.mockRejectedValue({
      code: 'P2002',
    });

    repository.findExisting.mockResolvedValue({
      id: 'existing-order',

      sourceFingerprint: fingerprint,
    });

    const result = await service.ingest(envelope, 'test-dito-webhook-secret');

    expect(result).toEqual({
      accepted: true,
      duplicate: true,

      event_id: envelope.event_id,

      dito_order_id: 'existing-order',

      status: 'IGNORED_DUPLICATE',
    });

    expect(repository.findExisting).toHaveBeenCalledWith(
      'organization-1',
      envelope.event_id,
      envelope.order.code_normalized,
    );

    expect(repository.markNeedsReview).not.toHaveBeenCalled();
  });

  it('marks a duplicate as needing review when structured data changed', async () => {
    const originalEnvelope = createEnvelope();

    const modifiedEnvelope = createEnvelope({
      delivery: {
        method: 'EXPRESS',

        department: 'LIMA',

        province: 'LIMA',

        district: 'RIMAC',
      },
    });

    /*
     * El resumen textual permanece igual.
     * Solo cambia un campo estructurado.
     */
    expect(modifiedEnvelope.raw_summary).toBe(originalEnvelope.raw_summary);

    validationService.parse.mockResolvedValue(modifiedEnvelope);

    repository.create.mockRejectedValue({
      code: 'P2002',
    });

    repository.findExisting.mockResolvedValue({
      id: 'existing-order',

      sourceFingerprint: createFingerprint(originalEnvelope),
    });

    const result = await service.ingest(
      modifiedEnvelope,
      'test-dito-webhook-secret',
    );

    expect(result).toEqual({
      accepted: true,
      duplicate: true,

      event_id: modifiedEnvelope.event_id,

      dito_order_id: 'existing-order',

      status: 'IGNORED_DUPLICATE',
    });

    expect(repository.markNeedsReview).toHaveBeenCalledWith('existing-order');
  });

  it('marks incomplete normalized data as partial', async () => {
    const envelope = createEnvelope({
      product_type: 'UNKNOWN',

      delivery: {
        method: 'UNKNOWN',

        department: '',

        province: '',

        district: '',
      },
    });

    validationService.parse.mockResolvedValue(envelope);

    repository.create.mockResolvedValue({
      id: 'partial-order',

      sourceFingerprint: createFingerprint(envelope),
    });

    await service.ingest(envelope, 'test-dito-webhook-secret');

    const createInput = repository.create.mock.calls[0]?.[0];

    expect(createInput?.parseStatus).toBe('PARTIAL');

    expect(createInput?.schedule).toEqual({
      serviceLevelHours: null,

      scheduleStatus: 'PENDING_CONFIGURATION',

      deliveryWindowStart: null,

      deliveryWindowEnd: null,

      deliveryDueAt: null,
    });
  });
});
