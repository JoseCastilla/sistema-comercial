import { Injectable } from '@nestjs/common';

import type { DitoLegacyOrderEnvelopeV1 } from '@repo/contracts';

import type { Prisma } from '@repo/database';

import type { InitialDeliverySchedule } from '../dito/dito-sla';

import { DatabaseService } from '../database/database.service';

export interface DitoOrganization {
  id: string;
  slug: string;
}

export interface PersistedDitoOrder {
  id: string;
  sourceFingerprint: string;
}

export interface CreateDitoOrderInput {
  organizationId: string;

  envelope: DitoLegacyOrderEnvelopeV1;

  sourceFingerprint: string;

  agentNameNormalized: string | null;

  parseStatus: 'PARSED' | 'PARTIAL';

  registeredAt: Date;
  approvedAt: Date;

  schedule: InitialDeliverySchedule;
}

@Injectable()
export class DitoOrdersRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findOrganizationBySlug(slug: string): Promise<DitoOrganization | null> {
    const database = this.databaseService.getClient();

    return database.organization.findUnique({
      where: {
        slug,
      },

      select: {
        id: true,
        slug: true,
      },
    });
  }

  async create(input: CreateDitoOrderInput): Promise<PersistedDitoOrder> {
    const database = this.databaseService.getClient();

    const deliveryMethodRaw =
      typeof input.envelope.additional_details.delivery_raw === 'string'
        ? input.envelope.additional_details.delivery_raw
        : null;

    return database.ditoOrder.create({
      data: {
        organizationId: input.organizationId,

        eventId: input.envelope.event_id,

        sourceFingerprint: input.sourceFingerprint,

        productType: input.envelope.product_type,

        orderCodeRaw: input.envelope.order.code_raw,

        orderCodeNormalized: input.envelope.order.code_normalized,

        orderCodeSuffix: input.envelope.order.code_suffix,

        displayedOrderCode: null,

        operationRaw: input.envelope.order.operation_raw,

        commercialOperation: input.envelope.order.commercial_operation,

        carrier: input.envelope.order.carrier,

        fixedCharge: input.envelope.order.fixed_charge,

        salesCode: input.envelope.order.sales_code,

        billingCycleDay: input.envelope.order.billing_cycle_day,

        paymentDueDay: input.envelope.order.payment_due_day,

        holderFullNameRaw: input.envelope.holder.full_name,

        holderDocumentType: input.envelope.holder.document_type,

        holderDocumentNumber: input.envelope.holder.document_number,

        serviceNumber: input.envelope.holder.service_number,

        deliveryContactPhone: input.envelope.holder.service_number,

        deliveryMethod: input.envelope.delivery.method,

        deliveryMethodRaw,

        department: input.envelope.delivery.department,

        province: input.envelope.delivery.province,

        district: input.envelope.delivery.district,

        agentNameRaw: input.envelope.agent.name_raw,

        agentNameNormalized: input.agentNameNormalized,

        rawSummary: input.envelope.raw_summary,

        additionalDetails: input.envelope
          .additional_details as Prisma.InputJsonValue,

        parseStatus: input.parseStatus,

        matchStatus: 'UNMATCHED',

        status: 'OPEN',

        statusRaw: 'ABIERTO',

        statusUpdatedAt: input.registeredAt,
        capturedAt: new Date(input.envelope.captured_at),

        registeredAt: input.registeredAt,

        approvedAt: input.approvedAt,

        approvalSource: 'ASSUMED_FROM_REGISTRATION',

        deliveryWindowStart: input.schedule.deliveryWindowStart,

        deliveryWindowEnd: input.schedule.deliveryWindowEnd,

        deliveryDueAt: input.schedule.deliveryDueAt,

        deliveryStatus: 'PENDING',
      },

      select: {
        id: true,
        sourceFingerprint: true,
      },
    });
  }

  async findExisting(
    organizationId: string,
    eventId: string,
    orderCodeNormalized: string,
  ): Promise<PersistedDitoOrder | null> {
    const database = this.databaseService.getClient();

    return database.ditoOrder.findFirst({
      where: {
        organizationId,

        OR: [
          {
            eventId,
          },

          {
            orderCodeNormalized,
          },
        ],
      },

      select: {
        id: true,
        sourceFingerprint: true,
      },
    });
  }

  async markNeedsReview(id: string): Promise<void> {
    const database = this.databaseService.getClient();

    await database.ditoOrder.update({
      where: {
        id,
      },

      data: {
        matchStatus: 'NEEDS_REVIEW',
      },
    });
  }
}
