import { DatabaseService } from '../database/database.service';

import {
  GhlCommercialProjectionRepository,
  type ProjectContactInput,
} from './ghl-commercial-projection.repository';

type RepositoryArguments = [Record<string, unknown>];

interface TransactionMock {
  contactExternalIdentity: {
    findUnique: jest.Mock<
      Promise<{
        contactId: string;
      } | null>,
      RepositoryArguments
    >;

    upsert: jest.Mock<Promise<Record<string, never>>, RepositoryArguments>;
  };

  contact: {
    findUnique: jest.Mock<
      Promise<{
        id: string;
      } | null>,
      RepositoryArguments
    >;

    findFirst: jest.Mock<
      Promise<{
        id: string;
      } | null>,
      RepositoryArguments
    >;

    update: jest.Mock<Promise<Record<string, never>>, RepositoryArguments>;

    create: jest.Mock<
      Promise<{
        id: string;
      }>,
      RepositoryArguments
    >;
  };
}

function createInput(
  overrides: Partial<ProjectContactInput> = {},
): ProjectContactInput {
  return {
    organizationId: 'organization-1',

    ghlIntegrationId: 'integration-1',

    externalContactId: 'external-contact-1',

    locationId: 'location-1',

    documentType: 'UNKNOWN',

    documentNumber: null,

    documentNumberNormalized: null,

    firstName: null,

    lastName: null,

    fullName: 'Nombre actualizado',

    email: null,

    primaryPhone: '999888777',

    secondaryPhone: null,

    customerCity: null,

    country: 'PE',

    contactType: null,

    tags: null,

    sourceCreatedAt: null,

    lastEventAt: new Date('2026-08-03T20:00:00.000Z'),

    ...overrides,
  };
}

function createTransactionMock(): TransactionMock {
  return {
    contactExternalIdentity: {
      findUnique: jest.fn<
        Promise<{
          contactId: string;
        } | null>,
        RepositoryArguments
      >(),

      upsert: jest.fn<Promise<Record<string, never>>, RepositoryArguments>(),
    },

    contact: {
      findUnique: jest.fn<
        Promise<{
          id: string;
        } | null>,
        RepositoryArguments
      >(),

      findFirst: jest.fn<
        Promise<{
          id: string;
        } | null>,
        RepositoryArguments
      >(),

      update: jest.fn<Promise<Record<string, never>>, RepositoryArguments>(),

      create: jest.fn<
        Promise<{
          id: string;
        }>,
        RepositoryArguments
      >(),
    },
  };
}

describe('GhlCommercialProjectionRepository', () => {
  let transaction: TransactionMock;

  let repository: GhlCommercialProjectionRepository;

  beforeEach(() => {
    transaction = createTransactionMock();

    transaction.contactExternalIdentity.findUnique.mockResolvedValue({
      contactId: 'contact-1',
    });

    transaction.contactExternalIdentity.upsert.mockResolvedValue({});

    transaction.contact.findUnique.mockResolvedValue(null);

    transaction.contact.findFirst.mockResolvedValue(null);

    transaction.contact.update.mockResolvedValue({});

    transaction.contact.create.mockResolvedValue({
      id: 'created-contact-1',
    });

    const databaseClient = {
      $transaction: async (
        callback: (value: TransactionMock) => Promise<string>,
      ): Promise<string> => callback(transaction),
    };

    const databaseService = {
      getClient: () => databaseClient,
    } as unknown as DatabaseService;

    repository = new GhlCommercialProjectionRepository(databaseService);
  });

  it('does not erase existing fields when GHL sends empty values', async () => {
    await repository.upsertContact(createInput());

    /*
     * Esta comparación exacta
     * también comprueba que no
     * se enviaron propiedades
     * vacías adicionales.
     */
    expect(transaction.contact.update).toHaveBeenCalledWith({
      where: {
        id: 'contact-1',
      },

      data: {
        fullName: 'Nombre actualizado',

        primaryPhone: '999888777',

        country: 'PE',

        lastEventAt: new Date('2026-08-03T20:00:00.000Z'),
      },
    });
  });

  it('uses email as the final identity fallback', async () => {
    transaction.contactExternalIdentity.findUnique.mockResolvedValue(null);

    transaction.contact.findFirst.mockResolvedValueOnce({
      id: 'contact-by-email',
    });

    await repository.upsertContact(
      createInput({
        fullName: null,

        primaryPhone: null,

        email: 'cliente@example.com',
      }),
    );

    expect(transaction.contact.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'organization-1',

        email: {
          equals: 'cliente@example.com',

          mode: 'insensitive',
        },
      },

      select: {
        id: true,
      },
    });

    expect(transaction.contact.update).toHaveBeenCalledWith({
      where: {
        id: 'contact-by-email',
      },

      data: {
        email: 'cliente@example.com',

        country: 'PE',

        lastEventAt: new Date('2026-08-03T20:00:00.000Z'),
      },
    });
  });

  it('creates a new contact when no identity matches', async () => {
    transaction.contactExternalIdentity.findUnique.mockResolvedValue(null);

    transaction.contact.findFirst.mockResolvedValue(null);

    const contactId = await repository.upsertContact(createInput());

    expect(contactId).toBe('created-contact-1');

    expect(transaction.contact.create).toHaveBeenCalledTimes(1);

    expect(transaction.contactExternalIdentity.upsert).toHaveBeenCalledWith({
      where: {
        ghlIntegrationId_externalContactId: {
          ghlIntegrationId: 'integration-1',

          externalContactId: 'external-contact-1',
        },
      },

      update: {
        organizationId: 'organization-1',

        contactId: 'created-contact-1',

        locationId: 'location-1',

        lastSeenAt: new Date('2026-08-03T20:00:00.000Z'),
      },

      create: {
        organizationId: 'organization-1',

        contactId: 'created-contact-1',

        ghlIntegrationId: 'integration-1',

        externalContactId: 'external-contact-1',

        locationId: 'location-1',

        firstSeenAt: new Date('2026-08-03T20:00:00.000Z'),

        lastSeenAt: new Date('2026-08-03T20:00:00.000Z'),
      },
    });
  });
});
