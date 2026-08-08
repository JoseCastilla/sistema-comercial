import type { GhlWebhookEnvelopeV1 } from '@repo/contracts';

import { GhlCommercialProjectionRepository } from './ghl-commercial-projection.repository';

import { GhlCommercialProjectionService } from './ghl-commercial-projection.service';

interface RepositoryMock {
  upsertContact: jest.Mock<
    ReturnType<GhlCommercialProjectionRepository['upsertContact']>,
    Parameters<GhlCommercialProjectionRepository['upsertContact']>
  >;

  findContactIdByExternalIdentity: jest.Mock<
    ReturnType<
      GhlCommercialProjectionRepository['findContactIdByExternalIdentity']
    >,
    Parameters<
      GhlCommercialProjectionRepository['findContactIdByExternalIdentity']
    >
  >;

  resolveAgentUserId: jest.Mock<
    ReturnType<GhlCommercialProjectionRepository['resolveAgentUserId']>,
    Parameters<GhlCommercialProjectionRepository['resolveAgentUserId']>
  >;

  upsertCommercialRequest: jest.Mock<
    ReturnType<GhlCommercialProjectionRepository['upsertCommercialRequest']>,
    Parameters<GhlCommercialProjectionRepository['upsertCommercialRequest']>
  >;

  upsertCommercialService: jest.Mock<
    ReturnType<GhlCommercialProjectionRepository['upsertCommercialService']>,
    Parameters<GhlCommercialProjectionRepository['upsertCommercialService']>
  >;
}

const projectionContext = {
  organizationId: 'organization-1',

  ghlIntegrationId: 'integration-1',

  locationId: 'location-1',
};

const owner = {
  external_id: 'owner-001',

  name: 'JimÃ©na C.',

  email: 'JIMENA@EXAMPLE.COM',

  phone: '+51957159208',
};

const attribution = {
  first: {
    session_source: 'Paid Social',

    medium: 'whatsapp',

    url: 'https://fb.me/test',

    ctwa_clid: 'ctwa-test',

    ad_id: 'ad-001',

    ad_name: 'CÃ¡mbiate a Movistar',
  },

  last: {
    session_source: 'Paid Social',

    medium: 'whatsapp',

    url: 'https://fb.me/test',

    ctwa_clid: 'ctwa-test',

    ad_id: 'ad-001',

    ad_name: 'CÃ¡mbiate a Movistar',
  },
};

const dates = {
  created_at_utc: '2026-08-03T13:00:00.000Z',

  created_at_lima: '2026-08-03 08:00:00',

  lead_business_date: '2026-08-03',

  event_at_utc: '2026-08-03T14:00:00.000Z',

  event_at_lima: '2026-08-03 09:00:00',

  event_business_date: '2026-08-03',

  timezone: 'America/Lima',
};

const contact = {
  first_name: 'Jose',

  last_name: 'Castilla',

  full_name: 'Jose Castilla',

  email: ' JOSE@EXAMPLE.COM ',

  primary_phone: '+51 933 123 456',

  secondary_phone: '987-654-321',

  /*
   * El webhook real de contacto
   * no utiliza un campo DNI.
   */
  dni: '',

  customer_city: 'Lima',

  product: 'Portabilidad',

  country: 'pe',

  contact_type: 'lead',

  tags: 'campaña',
};

function createEnvelope(snapshot: unknown): GhlWebhookEnvelopeV1 {
  return {
    envelope_version: '1.0',

    source: 'GHL_N8N',

    event_id: 'event-001',

    event_type: 'contact.updated',

    occurred_at: '2026-08-03T14:00:00.000Z',

    snapshot,
  } as unknown as GhlWebhookEnvelopeV1;
}

function createContactSnapshot() {
  return {
    schema_version: '2.0',

    snapshot_type: 'contact',

    external: {
      contact_id: 'contact-external-1',

      location_id: 'location-1',

      location_name: 'Distribuidor Online',
    },

    contact,
    owner,
    attribution,
    dates,
  };
}

function createCommercialCaseSnapshot() {
  return {
    schema_version: '2.0',

    snapshot_type: 'commercial_case',

    external: {
      contact_id: 'contact-external-1',

      opportunity_id: 'opportunity-1',

      location_id: 'location-1',

      location_name: 'Distribuidor Online',
    },

    commercial_case: {
      carrier: 'CLARO',

      commercial_operation: 'PORT_POSTPAID',

      fixed_charge: 79.8,

      management_status: 'ORDER_ENTERED',

      follow_up_reason: '',

      lost_reason: '',

      activation_status: 'PENDING',

      incident_reason: '',

      pipeline_stage: 'Pedido ingresado',

      opportunity_status: 'open',

      /*
       * Aunque exista este campo,
       * GHL no crea servicios reales.
       */
      service_number: '933123456',

      request_group_id: '',
    },

    owner,
    attribution,
    dates,
  };
}

function createLegacySnapshot() {
  return {
    schema_version: '1.0',

    external: {
      contact_id: 'contact-external-1',

      opportunity_id: 'opportunity-legacy-1',

      location_id: 'location-1',

      location_name: 'Distribuidor Online',
    },

    contact,

    commercial: {
      carrier: 'ENTEL',

      commercial_operation: 'PORT_PREPAID',

      fixed_charge: 39.9,

      management_status: 'QUALIFIED',

      follow_up_reason: '',

      lost_reason: '',

      activation_status: 'PENDING',

      incident_reason: '',

      pipeline_stage: 'Calificado',

      opportunity_status: 'open',
    },

    owner,
    attribution,
    dates,
  };
}

function createRepositoryMock(): RepositoryMock {
  return {
    upsertContact: jest.fn<
      ReturnType<GhlCommercialProjectionRepository['upsertContact']>,
      Parameters<GhlCommercialProjectionRepository['upsertContact']>
    >(),

    findContactIdByExternalIdentity: jest.fn<
      ReturnType<
        GhlCommercialProjectionRepository['findContactIdByExternalIdentity']
      >,
      Parameters<
        GhlCommercialProjectionRepository['findContactIdByExternalIdentity']
      >
    >(),

    resolveAgentUserId: jest.fn<
      ReturnType<GhlCommercialProjectionRepository['resolveAgentUserId']>,
      Parameters<GhlCommercialProjectionRepository['resolveAgentUserId']>
    >(),

    upsertCommercialRequest: jest.fn<
      ReturnType<GhlCommercialProjectionRepository['upsertCommercialRequest']>,
      Parameters<GhlCommercialProjectionRepository['upsertCommercialRequest']>
    >(),

    upsertCommercialService: jest.fn<
      ReturnType<GhlCommercialProjectionRepository['upsertCommercialService']>,
      Parameters<GhlCommercialProjectionRepository['upsertCommercialService']>
    >(),
  };
}

describe('GhlCommercialProjectionService', () => {
  let repository: RepositoryMock;

  let service: GhlCommercialProjectionService;

  beforeEach(() => {
    repository = createRepositoryMock();

    repository.upsertContact.mockResolvedValue('contact-1');

    repository.findContactIdByExternalIdentity.mockResolvedValue('contact-1');

    repository.resolveAgentUserId.mockResolvedValue('agent-user-1');

    repository.upsertCommercialRequest.mockResolvedValue('request-1');

    repository.upsertCommercialService.mockResolvedValue('service-1');

    service = new GhlCommercialProjectionService(
      repository as unknown as GhlCommercialProjectionRepository,
    );
  });

  it('projects a GHL contact without assuming a DNI', async () => {
    const result = await service.project(
      createEnvelope(createContactSnapshot()),

      projectionContext,
    );

    expect(result).toEqual({
      projectionType: 'CONTACT',

      contactId: 'contact-1',

      commercialRequestId: null,

      commercialServiceId: null,
    });

    expect(repository.upsertContact).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'organization-1',

        ghlIntegrationId: 'integration-1',

        externalContactId: 'contact-external-1',

        locationId: 'location-1',

        documentType: 'UNKNOWN',

        documentNumber: null,

        documentNumberNormalized: null,

        fullName: 'Jose Castilla',

        email: 'jose@example.com',

        primaryPhone: '933123456',

        secondaryPhone: '987654321',

        country: 'PE',
      }),
    );

    expect(repository.upsertCommercialRequest).not.toHaveBeenCalled();

    expect(repository.upsertCommercialService).not.toHaveBeenCalled();
  });

  it('creates a commercial request from an opportunity snapshot', async () => {
    const result = await service.project(
      createEnvelope(createCommercialCaseSnapshot()),

      projectionContext,
    );

    expect(result).toEqual({
      projectionType: 'COMMERCIAL_CASE',

      contactId: 'contact-1',

      commercialRequestId: 'request-1',

      commercialServiceId: null,
    });

    expect(repository.upsertCommercialRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'organization-1',

        ghlIntegrationId: 'integration-1',

        externalOpportunityId: 'opportunity-1',

        requesterContactId: 'contact-1',

        agentUserId: 'agent-user-1',

        leadOrigin: 'UNKNOWN',

        status: 'IN_PROGRESS',

        /*
         * El cargo fijo puede ser
         * agregado para toda la
         * oportunidad.
         */
        reportedTotalFixedCharge: 79.8,
      }),
    );
  });

  it('does not create commercial services from GHL', async () => {
    await service.project(
      createEnvelope(createCommercialCaseSnapshot()),

      projectionContext,
    );

    expect(repository.upsertCommercialService).not.toHaveBeenCalled();
  });

  it('keeps the request without an agent when the owner cannot be resolved', async () => {
    repository.resolveAgentUserId.mockResolvedValue(null);

    await service.project(
      createEnvelope(createCommercialCaseSnapshot()),

      projectionContext,
    );

    expect(repository.upsertCommercialRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        agentUserId: null,
      }),
    );
  });

  it('projects a legacy campaign snapshot without inventing services', async () => {
    const result = await service.project(
      createEnvelope(createLegacySnapshot()),

      projectionContext,
    );

    expect(result).toEqual({
      projectionType: 'LEGACY',

      contactId: 'contact-1',

      commercialRequestId: 'request-1',

      commercialServiceId: null,
    });

    expect(repository.upsertCommercialRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        externalOpportunityId: 'opportunity-legacy-1',

        leadOrigin: 'CAMPAIGN',

        status: 'IN_PROGRESS',
      }),
    );

    expect(repository.upsertCommercialService).not.toHaveBeenCalled();
  });

  it('rejects a contact snapshot with an invalid event date', async () => {
    const snapshot = createContactSnapshot();

    snapshot.dates = {
      ...snapshot.dates,

      event_at_utc: 'invalid-date',
    };

    await expect(
      service.project(
        createEnvelope(snapshot),

        projectionContext,
      ),
    ).rejects.toThrow('El snapshot GHL contiene una fecha de evento invalida');

    expect(repository.upsertContact).not.toHaveBeenCalled();
  });
});
