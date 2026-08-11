import { isDitoPlaceholder, normalizeAgentAlias } from '@repo/validation';

import 'dotenv/config';

import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

import type {
  DitoIncomingOrderEnvelope,
  DitoOrderIngestionResponse,
} from '@repo/contracts';

import { createHash, timingSafeEqual } from 'node:crypto';

import { calculateInitialDeliverySchedule } from '../dito/dito-sla';

import { DitoOrdersRepository } from './dito-orders.repository';

import { DitoWebhookValidationService } from './dito-webhook-validation.service';

interface ErrorWithCode {
  code: unknown;
}

@Injectable()
export class DitoWebhookService {
  constructor(
    private readonly validationService: DitoWebhookValidationService,

    private readonly repository: DitoOrdersRepository,
  ) {}

  async ingest(
    rawPayload: unknown,
    providedSecret: string | undefined,
  ): Promise<DitoOrderIngestionResponse> {
    this.assertAuthorized(providedSecret);

    const envelope = await this.validationService.parse(rawPayload);

    const organizationSlug = this.requiredEnvironmentVariable(
      'DITO_WEBHOOK_ORGANIZATION_SLUG',
    );

    const organization =
      await this.repository.findOrganizationBySlug(organizationSlug);

    if (!organization) {
      throw new InternalServerErrorException(
        'La organización configurada para DITO no existe',
      );
    }

    const capturedAt = new Date(envelope.captured_at);

    const registeredAt = new Date(capturedAt.getTime());

    const approvedAt = new Date(capturedAt.getTime());

    const schedule = calculateInitialDeliverySchedule(
      envelope.delivery.method,
      approvedAt,
    );

    const sourceFingerprint = this.createSourceFingerprint(envelope);

    const agentNameNormalized = normalizeAgentAlias(envelope.agent.name_raw);

    const isIdentityEnvelope = envelope.schema_version === '2.0';

    const submitterInstallationId = isIdentityEnvelope
      ? envelope.submitted_by.installation_id
      : null;
    const submitterEmailRaw = isIdentityEnvelope
      ? envelope.submitted_by.email
      : null;
    const submitterEmailNormalized = submitterEmailRaw
      ? submitterEmailRaw.trim().toLowerCase()
      : null;

    const installationConflict =
      submitterInstallationId && submitterEmailNormalized
        ? await this.repository.hasInstallationEmailConflict(
            organization.id,
            submitterInstallationId,
            submitterEmailNormalized,
          )
        : false;

    const emailAssignment =
      isIdentityEnvelope && submitterEmailNormalized && !installationConflict
        ? await this.repository.resolveAgentAssignmentByEmail(
            organization.id,
            submitterEmailNormalized,
          )
        : null;

    const legacyAgentUserId =
      !isIdentityEnvelope && agentNameNormalized
        ? await this.repository.resolveAgentUserIdByAlias(
            organization.id,
            agentNameNormalized,
          )
        : null;

    const agentUserId = emailAssignment?.userId ?? legacyAgentUserId;
    const assignedTeamId = emailAssignment?.teamId ?? null;
    const parseStatus = this.determineParseStatus(envelope);

    const createInput = {
      organizationId: organization.id,

      envelope,
      sourceFingerprint,
      agentNameNormalized,

      agentUserId,
      assignedTeamId,

      submitterInstallationId,
      submitterEmailRaw,
      submitterEmailNormalized,

      parseStatus,
      registeredAt,
      approvedAt,
      schedule,
    } as const;

    try {
      const persisted = await this.repository.create(createInput);

      return {
        accepted: true,
        duplicate: false,

        event_id: envelope.event_id,

        dito_order_id: persisted.id,

        status: 'RECEIVED',
      };
    } catch (error: unknown) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      return this.resolveDuplicate(createInput);
    }
  }

  private async resolveDuplicate(
    input: Parameters<DitoOrdersRepository['create']>[0],
  ): Promise<DitoOrderIngestionResponse> {
    const existing = await this.repository.findExisting(
      input.organizationId,
      input.envelope.event_id,
      input.envelope.order.code_normalized,
    );

    if (!existing) {
      throw new InternalServerErrorException(
        'No fue posible recuperar la orden DITO duplicada',
      );
    }

    if (existing.sourceFingerprint !== input.sourceFingerprint) {
      await this.repository.markNeedsReview(existing.id);
    }

    return {
      accepted: true,
      duplicate: true,

      event_id: input.envelope.event_id,

      dito_order_id: existing.id,

      status: 'IGNORED_DUPLICATE',
    };
  }

  private determineParseStatus(
    envelope: DitoIncomingOrderEnvelope,
  ): 'PARSED' | 'PARTIAL' {
    const isPartial =
      envelope.product_type === 'UNKNOWN' ||
      isDitoPlaceholder(envelope.order.operation_raw) ||
      envelope.order.commercial_operation === 'UNKNOWN' ||
      (envelope.order.commercial_operation !== 'NEW_LINE' &&
        envelope.order.carrier === 'UNKNOWN') ||
      envelope.delivery.method === 'UNKNOWN' ||
      isDitoPlaceholder(envelope.holder.full_name) ||
      !/^\d{8,11}$/.test(envelope.holder.document_number.replace(/\D/g, '')) ||
      !/^\d{7,15}$/.test(envelope.holder.service_number.replace(/\D/g, '')) ||
      isDitoPlaceholder(envelope.delivery.department) ||
      isDitoPlaceholder(envelope.delivery.province) ||
      isDitoPlaceholder(envelope.delivery.district);

    return isPartial ? 'PARTIAL' : 'PARSED';
  }

  private createSourceFingerprint(envelope: DitoIncomingOrderEnvelope): string {
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

        contact_phone: envelope.delivery.contact_phone,

        time_range: envelope.delivery.time_range,

        address: envelope.delivery.address,

        reference: envelope.delivery.reference,

        latitude: envelope.delivery.latitude,

        longitude: envelope.delivery.longitude,
      },

      agent: {
        name_raw: envelope.agent.name_raw,
      },

      ...(envelope.schema_version === '2.0'
        ? { submitted_by: envelope.submitted_by }
        : {}),

      raw_summary: normalizedSummary,
    };

    return createHash('sha256')
      .update(JSON.stringify(canonicalPayload), 'utf8')
      .digest('hex');
  }

  private assertAuthorized(providedSecret: string | undefined): void {
    const configuredSecret = this.requiredEnvironmentVariable(
      'DITO_WEBHOOK_SECRET',
    );

    if (!providedSecret) {
      throw new UnauthorizedException('Webhook no autorizado');
    }

    const providedDigest = createHash('sha256')
      .update(providedSecret, 'utf8')
      .digest();

    const configuredDigest = createHash('sha256')
      .update(configuredSecret, 'utf8')
      .digest();

    if (!timingSafeEqual(providedDigest, configuredDigest)) {
      throw new UnauthorizedException('Webhook no autorizado');
    }
  }

  private requiredEnvironmentVariable(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
      throw new InternalServerErrorException(
        `La variable ${name} no está configurada`,
      );
    }

    return value;
  }

  private isUniqueViolation(error: unknown): boolean {
    return this.isErrorWithCode(error) && error.code === 'P2002';
  }

  private isErrorWithCode(value: unknown): value is ErrorWithCode {
    return typeof value === 'object' && value !== null && 'code' in value;
  }
}
