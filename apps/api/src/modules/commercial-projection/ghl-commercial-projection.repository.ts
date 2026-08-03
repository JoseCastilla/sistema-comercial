import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

export type ProjectedDocumentType = 'DNI' | 'UNKNOWN';

export type ProjectedCarrier =
  'BITEL' | 'CLARO' | 'ENTEL' | 'MOVISTAR' | 'OTHER' | 'UNKNOWN';

export type ProjectedCommercialOperation =
  'NEW_LINE' | 'PORT_PREPAID' | 'PORT_POSTPAID' | 'UNKNOWN';

export type ProjectedManagementStatus =
  | 'QUALIFIED'
  | 'FOLLOW_UP'
  | 'ORDER_ENTERED'
  | 'CHIP_DELIVERED'
  | 'SALE_CONFIRMED'
  | 'LOST';

export type ProjectedActivationStatus = 'PENDING' | 'INCIDENT' | 'ACTIVATED';

export type ProjectedFollowUpReason =
  'SCHEDULED' | 'ACTIVE_DEBT' | 'LESS_THAN_30_DAYS' | 'MEETING_POINT';

export type ProjectedLostReason =
  | 'CURRENT_MOVISTAR_CUSTOMER'
  | 'OUT_OF_COVERAGE'
  | 'ZERO_FIXED_CHARGE'
  | 'FOREIGNER_ID'
  | 'DEVICE_INSTALLMENTS'
  | 'NO_LONGER_INTERESTED'
  | 'PORTED_OTHER_AGENCY'
  | 'PORTED_OTHER_OPERATOR'
  | 'RUC_10';

export type ProjectedLeadOrigin =
  'CAMPAIGN' | 'DATABASE' | 'REFERRAL' | 'OTHER' | 'UNKNOWN';

export type ProjectedRequestStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'PARTIALLY_COMPLETED'
  | 'COMPLETED'
  | 'LOST'
  | 'CANCELLED';

export interface ProjectContactInput {
  organizationId: string;
  ghlIntegrationId: string;

  externalContactId: string;
  locationId: string;

  documentType: ProjectedDocumentType;

  documentNumber: string | null;

  documentNumberNormalized: string | null;

  firstName: string | null;

  lastName: string | null;

  fullName: string | null;

  email: string | null;

  primaryPhone: string | null;

  secondaryPhone: string | null;

  customerCity: string | null;

  country: string;

  contactType: string | null;

  tags: string | null;

  sourceCreatedAt: Date | null;

  lastEventAt: Date;
}

export interface ResolveAgentInput {
  organizationId: string;

  externalId: string | null;

  name: string | null;

  email: string | null;
}

export interface UpsertCommercialRequestInput {
  organizationId: string;
  ghlIntegrationId: string;

  externalOpportunityId: string;

  requesterContactId: string | null;

  agentUserId: string | null;

  leadOrigin: ProjectedLeadOrigin;

  status: ProjectedRequestStatus;

  reportedTotalFixedCharge: number | null;

  pipelineStage: string | null;

  opportunityStatus: string | null;

  sourceCreatedAt: Date | null;

  lastEventAt: Date;
}

export interface UpsertCommercialServiceInput {
  organizationId: string;
  commercialRequestId: string;

  serviceNumber: string;

  carrier: ProjectedCarrier;

  commercialOperation: ProjectedCommercialOperation;

  fixedCharge: number | null;

  managementStatus: ProjectedManagementStatus | null;

  followUpReason: ProjectedFollowUpReason | null;

  lostReason: ProjectedLostReason | null;

  activationStatus: ProjectedActivationStatus | null;

  incidentReason: string | null;

  sourceCreatedAt: Date | null;

  lastEventAt: Date;
}

@Injectable()
export class GhlCommercialProjectionRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async upsertContact(input: ProjectContactInput): Promise<string> {
    const database = this.databaseService.getClient();

    return database.$transaction(async (transaction) => {
      const existingIdentity =
        await transaction.contactExternalIdentity.findUnique({
          where: {
            ghlIntegrationId_externalContactId: {
              ghlIntegrationId: input.ghlIntegrationId,

              externalContactId: input.externalContactId,
            },
          },

          select: {
            contactId: true,
          },
        });

      let contactId = existingIdentity?.contactId ?? null;

      if (!contactId && input.documentNumberNormalized) {
        const existingByDocument = await transaction.contact.findUnique({
          where: {
            organizationId_documentType_documentNumberNormalized: {
              organizationId: input.organizationId,

              documentType: input.documentType,

              documentNumberNormalized: input.documentNumberNormalized,
            },
          },

          select: {
            id: true,
          },
        });

        contactId = existingByDocument?.id ?? null;
      }

      if (!contactId && input.primaryPhone) {
        const existingByPhone = await transaction.contact.findFirst({
          where: {
            organizationId: input.organizationId,

            OR: [
              {
                primaryPhone: input.primaryPhone,
              },

              {
                secondaryPhone: input.primaryPhone,
              },
            ],
          },

          select: {
            id: true,
          },
        });

        contactId = existingByPhone?.id ?? null;
      }

      const contactData = {
        documentType: input.documentType,

        documentNumber: input.documentNumber,

        documentNumberNormalized: input.documentNumberNormalized,

        firstName: input.firstName,

        lastName: input.lastName,

        fullName: input.fullName,

        email: input.email,

        primaryPhone: input.primaryPhone,

        secondaryPhone: input.secondaryPhone,

        customerCity: input.customerCity,

        country: input.country,

        contactType: input.contactType,

        tags: input.tags,

        sourceCreatedAt: input.sourceCreatedAt,

        lastEventAt: input.lastEventAt,
      };

      if (contactId) {
        await transaction.contact.update({
          where: {
            id: contactId,
          },

          data: contactData,
        });
      } else {
        const createdContact = await transaction.contact.create({
          data: {
            organizationId: input.organizationId,

            ...contactData,
          },

          select: {
            id: true,
          },
        });

        contactId = createdContact.id;
      }

      await transaction.contactExternalIdentity.upsert({
        where: {
          ghlIntegrationId_externalContactId: {
            ghlIntegrationId: input.ghlIntegrationId,

            externalContactId: input.externalContactId,
          },
        },

        update: {
          organizationId: input.organizationId,

          contactId,

          locationId: input.locationId,

          lastSeenAt: input.lastEventAt,
        },

        create: {
          organizationId: input.organizationId,

          contactId,

          ghlIntegrationId: input.ghlIntegrationId,

          externalContactId: input.externalContactId,

          locationId: input.locationId,

          firstSeenAt: input.lastEventAt,

          lastSeenAt: input.lastEventAt,
        },
      });

      return contactId;
    });
  }

  async findContactIdByExternalIdentity(
    ghlIntegrationId: string,
    externalContactId: string,
  ): Promise<string | null> {
    const database = this.databaseService.getClient();

    const identity = await database.contactExternalIdentity.findUnique({
      where: {
        ghlIntegrationId_externalContactId: {
          ghlIntegrationId,
          externalContactId,
        },
      },

      select: {
        contactId: true,
      },
    });

    return identity?.contactId ?? null;
  }

  async resolveAgentUserId(input: ResolveAgentInput): Promise<string | null> {
    const database = this.databaseService.getClient();

    if (input.email) {
      const userByEmail = await database.user.findFirst({
        where: {
          email: {
            equals: input.email,

            mode: 'insensitive',
          },

          status: 'ACTIVE',

          memberships: {
            some: {
              organizationId: input.organizationId,
            },
          },
        },

        select: {
          id: true,
        },
      });

      if (userByEmail) {
        return userByEmail.id;
      }
    }

    const aliases = [input.externalId, input.name].filter(
      (value): value is string => Boolean(value),
    );

    if (aliases.length === 0) {
      return null;
    }

    const matchingAliases = await database.agentAlias.findMany({
      where: {
        organizationId: input.organizationId,

        isActive: true,

        normalizedAlias: {
          in: aliases,
        },

        user: {
          status: 'ACTIVE',
        },
      },

      select: {
        userId: true,
      },

      distinct: ['userId'],

      take: 2,
    });

    if (matchingAliases.length !== 1) {
      return null;
    }

    return matchingAliases[0]?.userId ?? null;
  }

  async upsertCommercialRequest(
    input: UpsertCommercialRequestInput,
  ): Promise<string> {
    const database = this.databaseService.getClient();

    const request = await database.commercialRequest.upsert({
      where: {
        ghlIntegrationId_externalOpportunityId: {
          ghlIntegrationId: input.ghlIntegrationId,

          externalOpportunityId: input.externalOpportunityId,
        },
      },

      update: {
        requesterContactId: input.requesterContactId,

        agentUserId: input.agentUserId,

        leadOrigin: input.leadOrigin,

        status: input.status,

        reportedTotalFixedCharge: input.reportedTotalFixedCharge,

        pipelineStage: input.pipelineStage,

        opportunityStatus: input.opportunityStatus,

        sourceCreatedAt: input.sourceCreatedAt,

        lastEventAt: input.lastEventAt,
      },

      create: {
        organizationId: input.organizationId,

        ghlIntegrationId: input.ghlIntegrationId,

        externalOpportunityId: input.externalOpportunityId,

        requesterContactId: input.requesterContactId,

        agentUserId: input.agentUserId,

        leadOrigin: input.leadOrigin,

        status: input.status,

        reportedTotalFixedCharge: input.reportedTotalFixedCharge,

        pipelineStage: input.pipelineStage,

        opportunityStatus: input.opportunityStatus,

        sourceCreatedAt: input.sourceCreatedAt,

        lastEventAt: input.lastEventAt,
      },

      select: {
        id: true,
      },
    });

    return request.id;
  }

  async upsertCommercialService(
    input: UpsertCommercialServiceInput,
  ): Promise<string> {
    const database = this.databaseService.getClient();

    const existingService = await database.commercialService.findFirst({
      where: {
        commercialRequestId: input.commercialRequestId,

        serviceNumber: input.serviceNumber,
      },

      select: {
        id: true,
      },
    });

    const serviceData = {
      carrier: input.carrier,

      commercialOperation: input.commercialOperation,

      fixedCharge: input.fixedCharge,

      managementStatus: input.managementStatus,

      followUpReason: input.followUpReason,

      lostReason: input.lostReason,

      activationStatus: input.activationStatus,

      incidentReason: input.incidentReason,

      sourceCreatedAt: input.sourceCreatedAt,

      lastEventAt: input.lastEventAt,
    };

    if (existingService) {
      const updatedService = await database.commercialService.update({
        where: {
          id: existingService.id,
        },

        data: serviceData,

        select: {
          id: true,
        },
      });

      return updatedService.id;
    }

    const createdService = await database.commercialService.create({
      data: {
        organizationId: input.organizationId,

        commercialRequestId: input.commercialRequestId,

        serviceNumber: input.serviceNumber,

        ...serviceData,
      },

      select: {
        id: true,
      },
    });

    return createdService.id;
  }
}
