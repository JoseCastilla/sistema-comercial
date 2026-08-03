import { Injectable } from '@nestjs/common';

import type {
  AttributionSnapshot,
  ContactSnapshot,
  GhlCommercialCaseSnapshotV2,
  GhlContactSnapshotV2,
  GhlIncomingSnapshot,
  GhlWebhookEnvelopeV1,
  LegacyGhlContactCommercialSnapshotV1,
  OwnerSnapshot,
  SnapshotDates,
} from '@repo/contracts';

import {
  GhlCommercialProjectionRepository,
  type ProjectedActivationStatus,
  type ProjectedCarrier,
  type ProjectedCommercialOperation,
  type ProjectedFollowUpReason,
  type ProjectedLeadOrigin,
  type ProjectedLostReason,
  type ProjectedManagementStatus,
  type ProjectedRequestStatus,
} from './ghl-commercial-projection.repository';

export interface GhlProjectionContext {
  organizationId: string;
  ghlIntegrationId: string;
  locationId: string;
}

export interface GhlProjectionResult {
  projectionType: 'CONTACT' | 'COMMERCIAL_CASE' | 'LEGACY';

  contactId: string | null;

  commercialRequestId: string | null;

  commercialServiceId: string | null;
}

@Injectable()
export class GhlCommercialProjectionService {
  constructor(private readonly repository: GhlCommercialProjectionRepository) {}

  async project(
    envelope: GhlWebhookEnvelopeV1,

    context: GhlProjectionContext,
  ): Promise<GhlProjectionResult> {
    const snapshot = envelope.snapshot;

    if (this.isContactSnapshot(snapshot)) {
      return this.projectContactSnapshot(snapshot, context);
    }

    if (this.isCommercialCaseSnapshot(snapshot)) {
      return this.projectCommercialCaseSnapshot(snapshot, context);
    }

    return this.projectLegacySnapshot(snapshot, context);
  }

  private async projectContactSnapshot(
    snapshot: GhlContactSnapshotV2,

    context: GhlProjectionContext,
  ): Promise<GhlProjectionResult> {
    const contactId = await this.projectContact(
      snapshot.external.contact_id,

      snapshot.contact,

      snapshot.dates,

      context,
    );

    return {
      projectionType: 'CONTACT',

      contactId,

      commercialRequestId: null,

      commercialServiceId: null,
    };
  }

  private async projectCommercialCaseSnapshot(
    snapshot: GhlCommercialCaseSnapshotV2,

    context: GhlProjectionContext,
  ): Promise<GhlProjectionResult> {
    const contactId = await this.repository.findContactIdByExternalIdentity(
      context.ghlIntegrationId,

      snapshot.external.contact_id,
    );

    const agentUserId = await this.resolveAgent(snapshot.owner, context);

    const requestId = await this.repository.upsertCommercialRequest({
      organizationId: context.organizationId,

      ghlIntegrationId: context.ghlIntegrationId,

      externalOpportunityId: snapshot.external.opportunity_id,

      requesterContactId: contactId,

      agentUserId,

      leadOrigin: 'UNKNOWN',

      status: this.mapRequestStatus(
        snapshot.commercial_case.management_status,

        snapshot.commercial_case.opportunity_status,
      ),

      reportedTotalFixedCharge: this.normalizeMoney(
        snapshot.commercial_case.fixed_charge,
      ),

      pipelineStage: this.nullableText(snapshot.commercial_case.pipeline_stage),

      opportunityStatus: this.nullableText(
        snapshot.commercial_case.opportunity_status,
      ),

      sourceCreatedAt: this.parseNullableDate(snapshot.dates.created_at_utc),

      lastEventAt: this.parseRequiredDate(snapshot.dates.event_at_utc),
    });
    /*
     * GHL representa una solicitud comercial agregada.
     *
     * Los servicios reales se crean al asociar cada
     * orden DITO confirmada. No se usa service_number
     * de GHL ni se infiere cuántas líneas faltan.
     */
    return {
      projectionType: 'COMMERCIAL_CASE',
      contactId,
      commercialRequestId: requestId,
      commercialServiceId: null,
    };
  }

  private async projectLegacySnapshot(
    snapshot: LegacyGhlContactCommercialSnapshotV1,

    context: GhlProjectionContext,
  ): Promise<GhlProjectionResult> {
    const contactId = await this.projectContact(
      snapshot.external.contact_id,

      snapshot.contact,

      snapshot.dates,

      context,
    );

    const agentUserId = await this.resolveAgent(snapshot.owner, context);

    const requestId = await this.repository.upsertCommercialRequest({
      organizationId: context.organizationId,

      ghlIntegrationId: context.ghlIntegrationId,

      externalOpportunityId: snapshot.external.opportunity_id,

      requesterContactId: contactId,

      agentUserId,

      leadOrigin: this.inferLeadOrigin(
        snapshot.attribution.first,

        snapshot.attribution.last,
      ),

      status: this.mapRequestStatus(
        snapshot.commercial.management_status,

        snapshot.commercial.opportunity_status,
      ),

      reportedTotalFixedCharge: this.normalizeMoney(
        snapshot.commercial.fixed_charge,
      ),

      pipelineStage: this.nullableText(snapshot.commercial.pipeline_stage),

      opportunityStatus: this.nullableText(
        snapshot.commercial.opportunity_status,
      ),

      sourceCreatedAt: this.parseNullableDate(snapshot.dates.created_at_utc),

      lastEventAt: this.parseRequiredDate(snapshot.dates.event_at_utc),
    });

    /*
     * El snapshot legacy no contiene
     * un service_number independiente.
     *
     * Por eso crea la solicitud,
     * pero no inventa un servicio.
     */
    return {
      projectionType: 'LEGACY',

      contactId,

      commercialRequestId: requestId,

      commercialServiceId: null,
    };
  }

  private async projectContact(
    externalContactId: string,

    contact: ContactSnapshot,

    dates: SnapshotDates,

    context: GhlProjectionContext,
  ): Promise<string> {
    const documentNumber = this.normalizeDocumentNumber(contact.dni);

    return this.repository.upsertContact({
      organizationId: context.organizationId,

      ghlIntegrationId: context.ghlIntegrationId,

      externalContactId,

      locationId: context.locationId,

      documentType: documentNumber?.length === 8 ? 'DNI' : 'UNKNOWN',

      documentNumber,

      documentNumberNormalized: documentNumber,

      firstName: this.nullableText(contact.first_name),

      lastName: this.nullableText(contact.last_name),

      fullName: this.nullableText(contact.full_name),

      email: this.normalizeEmail(contact.email),

      primaryPhone: this.normalizePhone(contact.primary_phone),

      secondaryPhone: this.normalizePhone(contact.secondary_phone),

      customerCity: this.nullableText(contact.customer_city),

      country: this.normalizeCountry(contact.country),

      contactType: this.nullableText(contact.contact_type),

      tags: this.nullableText(contact.tags),

      sourceCreatedAt: this.parseNullableDate(dates.created_at_utc),

      lastEventAt: this.parseRequiredDate(dates.event_at_utc),
    });
  }

  private async resolveAgent(
    owner: OwnerSnapshot,

    context: GhlProjectionContext,
  ): Promise<string | null> {
    return this.repository.resolveAgentUserId({
      organizationId: context.organizationId,

      externalId: this.normalizeAlias(owner.external_id),

      name: this.normalizeAlias(owner.name),

      email: this.normalizeEmail(owner.email),
    });
  }

  private isContactSnapshot(
    snapshot: GhlIncomingSnapshot,
  ): snapshot is GhlContactSnapshotV2 {
    return 'snapshot_type' in snapshot && snapshot.snapshot_type === 'contact';
  }

  private isCommercialCaseSnapshot(
    snapshot: GhlIncomingSnapshot,
  ): snapshot is GhlCommercialCaseSnapshotV2 {
    return (
      'snapshot_type' in snapshot &&
      snapshot.snapshot_type === 'commercial_case'
    );
  }

  private nullableText(value: string): string | null {
    const normalized = value.trim();

    return normalized || null;
  }

  private normalizeEmail(value: string): string | null {
    const normalized = value.trim().toLowerCase();

    return normalized || null;
  }

  private normalizeDocumentNumber(value: string): string | null {
    const digits = value.replace(/\D/g, '');

    return digits || null;
  }

  private normalizePhone(value: string): string | null {
    const digits = value.replace(/\D/g, '');

    if (!digits) {
      return null;
    }

    if (digits.length === 11 && digits.startsWith('51')) {
      return digits.slice(2);
    }

    return digits;
  }

  private normalizeCountry(value: string): string {
    const country = value.trim().toUpperCase();

    return country || 'PE';
  }

  private normalizeAlias(value: string): string | null {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

    return normalized || null;
  }

  private normalizeMoney(value: number | ''): number | null {
    return value === '' ? null : value;
  }

  private parseNullableDate(value: string): Date | null {
    const normalized = value.trim();

    if (!normalized) {
      return null;
    }

    const date = new Date(normalized);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parseRequiredDate(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new RangeError(
        'El snapshot GHL contiene una fecha de evento invalida',
      );
    }

    return date;
  }

  private inferLeadOrigin(
    first: AttributionSnapshot,

    last: AttributionSnapshot,
  ): ProjectedLeadOrigin {
    const combined = [
      first.session_source,
      first.medium,
      first.ctwa_clid,
      first.ad_id,
      first.ad_name,

      last.session_source,
      last.medium,
      last.ctwa_clid,
      last.ad_id,
      last.ad_name,
    ]
      .join(' ')
      .toUpperCase();

    if (
      combined.includes('PAID SOCIAL') ||
      combined.includes('WHATSAPP') ||
      Boolean(first.ctwa_clid || last.ctwa_clid || first.ad_id || last.ad_id)
    ) {
      return 'CAMPAIGN';
    }

    return 'UNKNOWN';
  }

  private mapCarrier(value: string): ProjectedCarrier {
    const normalized = value.trim().toUpperCase();

    switch (normalized) {
      case 'BITEL':
      case 'CLARO':
      case 'ENTEL':
      case 'MOVISTAR':
      case 'OTHER':
        return normalized;

      default:
        return 'UNKNOWN';
    }
  }

  private mapCommercialOperation(value: string): ProjectedCommercialOperation {
    const normalized = value.trim().toUpperCase();

    switch (normalized) {
      case 'NEW_LINE':
      case 'PORT_PREPAID':
      case 'PORT_POSTPAID':
        return normalized;

      default:
        return 'UNKNOWN';
    }
  }

  private mapManagementStatus(value: string): ProjectedManagementStatus | null {
    const normalized = value.trim().toUpperCase();

    switch (normalized) {
      case 'QUALIFIED':
      case 'FOLLOW_UP':
      case 'ORDER_ENTERED':
      case 'CHIP_DELIVERED':
      case 'SALE_CONFIRMED':
      case 'LOST':
        return normalized;

      default:
        return null;
    }
  }

  private mapFollowUpReason(value: string): ProjectedFollowUpReason | null {
    const normalized = value.trim().toUpperCase();

    switch (normalized) {
      case 'SCHEDULED':
      case 'ACTIVE_DEBT':
      case 'LESS_THAN_30_DAYS':
      case 'MEETING_POINT':
        return normalized;

      default:
        return null;
    }
  }

  private mapLostReason(value: string): ProjectedLostReason | null {
    const normalized = value.trim().toUpperCase();

    switch (normalized) {
      case 'CURRENT_MOVISTAR_CUSTOMER':
      case 'OUT_OF_COVERAGE':
      case 'ZERO_FIXED_CHARGE':
      case 'FOREIGNER_ID':
      case 'DEVICE_INSTALLMENTS':
      case 'NO_LONGER_INTERESTED':
      case 'PORTED_OTHER_AGENCY':
      case 'PORTED_OTHER_OPERATOR':
      case 'RUC_10':
        return normalized;

      default:
        return null;
    }
  }

  private mapActivationStatus(value: string): ProjectedActivationStatus | null {
    const normalized = value.trim().toUpperCase();

    switch (normalized) {
      case 'PENDING':
      case 'INCIDENT':
      case 'ACTIVATED':
        return normalized;

      default:
        return null;
    }
  }

  private mapRequestStatus(
    managementStatus: string,
    opportunityStatus: string,
  ): ProjectedRequestStatus {
    const management = managementStatus.trim().toUpperCase();

    const opportunity = opportunityStatus.trim().toUpperCase();

    if (management === 'LOST' || opportunity === 'LOST') {
      return 'LOST';
    }

    if (opportunity === 'CANCELLED') {
      return 'CANCELLED';
    }

    if (management === 'SALE_CONFIRMED') {
      return 'COMPLETED';
    }

    if (management === 'CHIP_DELIVERED') {
      return 'PARTIALLY_COMPLETED';
    }

    if (
      management === 'QUALIFIED' ||
      management === 'FOLLOW_UP' ||
      management === 'ORDER_ENTERED'
    ) {
      return 'IN_PROGRESS';
    }

    return 'OPEN';
  }
}
