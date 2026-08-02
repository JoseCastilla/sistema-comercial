import { z } from 'zod';

import type {
  ActivationStatus,
  Carrier,
  CommercialOperation,
  FollowUpReason,
  LostReason,
  ManagementStatus,
  OrganizationRole,
  WebhookProcessingStatus,
} from '@repo/contracts';

export const organizationRoleSchema: z.ZodType<OrganizationRole> =
  z.enum([
    'ADMIN',
    'SUPERVISOR',
    'AGENT',
    'BACKOFFICE',
  ]);

export const carrierSchema: z.ZodType<Carrier> =
  z.enum([
    'BITEL',
    'CLARO',
    'ENTEL',
    'MOVISTAR',
    'OTHER',
  ]);

export const commercialOperationSchema:
  z.ZodType<CommercialOperation> = z.enum([
    'NEW_LINE',
    'PORT_PREPAID',
    'PORT_POSTPAID',
  ]);

export const managementStatusSchema:
  z.ZodType<ManagementStatus> = z.enum([
    'QUALIFIED',
    'FOLLOW_UP',
    'ORDER_ENTERED',
    'CHIP_DELIVERED',
    'SALE_CONFIRMED',
    'LOST',
  ]);

export const activationStatusSchema:
  z.ZodType<ActivationStatus> = z.enum([
    'PENDING',
    'INCIDENT',
    'ACTIVATED',
  ]);

export const followUpReasonSchema:
  z.ZodType<FollowUpReason> = z.enum([
    'SCHEDULED',
    'ACTIVE_DEBT',
    'LESS_THAN_30_DAYS',
    'MEETING_POINT',
  ]);

export const lostReasonSchema:
  z.ZodType<LostReason> = z.enum([
    'CURRENT_MOVISTAR_CUSTOMER',
    'OUT_OF_COVERAGE',
    'ZERO_FIXED_CHARGE',
    'FOREIGNER_ID',
    'DEVICE_INSTALLMENTS',
    'NO_LONGER_INTERESTED',
    'PORTED_OTHER_AGENCY',
    'PORTED_OTHER_OPERATOR',
    'RUC_10',
  ]);

export const webhookProcessingStatusSchema:
  z.ZodType<WebhookProcessingStatus> = z.enum([
    'RECEIVED',
    'PROCESSING',
    'PROCESSED',
    'FAILED',
    'IGNORED_DUPLICATE',
  ]);
