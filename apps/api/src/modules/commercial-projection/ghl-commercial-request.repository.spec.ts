import { DatabaseService } from '../database/database.service';

import {
  GhlCommercialProjectionRepository,
  type UpsertCommercialRequestInput,
} from './ghl-commercial-projection.repository';

type UpsertArguments = [Record<string, unknown>];

interface CommercialRequestMock {
  upsert: jest.Mock<
    Promise<{
      id: string;
    }>,
    UpsertArguments
  >;
}

function createInput(
  overrides: Partial<UpsertCommercialRequestInput> = {},
): UpsertCommercialRequestInput {
  return {
    organizationId: 'organization-1',

    ghlIntegrationId: 'integration-1',

    externalOpportunityId: 'opportunity-1',

    requesterContactId: 'contact-1',

    agentUserId: 'agent-1',

    leadOrigin: 'CAMPAIGN',

    status: 'PARTIALLY_COMPLETED',

    reportedTotalFixedCharge: 69.8,

    pipelineStage: 'Entregado',

    opportunityStatus: 'won',

    sourceCreatedAt: null,

    lastEventAt: new Date('2026-08-04T03:48:44.375Z'),

    ...overrides,
  };
}

describe('GhlCommercialProjectionRepository commercial requests', () => {
  let commercialRequest: CommercialRequestMock;

  let repository: GhlCommercialProjectionRepository;

  beforeEach(() => {
    commercialRequest = {
      upsert: jest.fn<
        Promise<{
          id: string;
        }>,
        UpsertArguments
      >(),
    };

    commercialRequest.upsert.mockResolvedValue({
      id: 'commercial-request-1',
    });

    const databaseClient = {
      commercialRequest,
    };

    const databaseService = {
      getClient: () => databaseClient,
    } as unknown as DatabaseService;

    repository = new GhlCommercialProjectionRepository(databaseService);
  });

  it('updates the origin when a reliable value is received', async () => {
    const input = createInput({
      leadOrigin: 'CAMPAIGN',
    });

    const result = await repository.upsertCommercialRequest(input);

    expect(result).toBe('commercial-request-1');

    expect(commercialRequest.upsert).toHaveBeenCalledWith({
      where: {
        ghlIntegrationId_externalOpportunityId: {
          ghlIntegrationId: 'integration-1',

          externalOpportunityId: 'opportunity-1',
        },
      },

      update: {
        requesterContactId: 'contact-1',

        agentUserId: 'agent-1',

        leadOrigin: 'CAMPAIGN',

        status: 'PARTIALLY_COMPLETED',

        reportedTotalFixedCharge: 69.8,

        pipelineStage: 'Entregado',

        opportunityStatus: 'won',

        sourceCreatedAt: null,

        lastEventAt: new Date('2026-08-04T03:48:44.375Z'),
      },

      create: {
        organizationId: 'organization-1',

        ghlIntegrationId: 'integration-1',

        externalOpportunityId: 'opportunity-1',

        requesterContactId: 'contact-1',

        agentUserId: 'agent-1',

        leadOrigin: 'CAMPAIGN',

        status: 'PARTIALLY_COMPLETED',

        reportedTotalFixedCharge: 69.8,

        pipelineStage: 'Entregado',

        opportunityStatus: 'won',

        sourceCreatedAt: null,

        lastEventAt: new Date('2026-08-04T03:48:44.375Z'),
      },

      select: {
        id: true,
      },
    });
  });

  it('does not overwrite an existing origin with UNKNOWN', async () => {
    const input = createInput({
      leadOrigin: 'UNKNOWN',
    });

    await repository.upsertCommercialRequest(input);

    expect(commercialRequest.upsert).toHaveBeenCalledWith({
      where: {
        ghlIntegrationId_externalOpportunityId: {
          ghlIntegrationId: 'integration-1',

          externalOpportunityId: 'opportunity-1',
        },
      },

      update: {
        requesterContactId: 'contact-1',

        agentUserId: 'agent-1',

        /*
         * No aparece leadOrigin.
         */
        status: 'PARTIALLY_COMPLETED',

        reportedTotalFixedCharge: 69.8,

        pipelineStage: 'Entregado',

        opportunityStatus: 'won',

        sourceCreatedAt: null,

        lastEventAt: new Date('2026-08-04T03:48:44.375Z'),
      },

      create: {
        organizationId: 'organization-1',

        ghlIntegrationId: 'integration-1',

        externalOpportunityId: 'opportunity-1',

        requesterContactId: 'contact-1',

        agentUserId: 'agent-1',

        /*
         * En una creación sí se conserva.
         */
        leadOrigin: 'UNKNOWN',

        status: 'PARTIALLY_COMPLETED',

        reportedTotalFixedCharge: 69.8,

        pipelineStage: 'Entregado',

        opportunityStatus: 'won',

        sourceCreatedAt: null,

        lastEventAt: new Date('2026-08-04T03:48:44.375Z'),
      },

      select: {
        id: true,
      },
    });
  });
});
