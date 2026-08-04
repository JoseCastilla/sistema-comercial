import { z } from "zod";

import type {
  AttributionSnapshot,
  CommercialCaseFields,
  ContactSnapshot,
  GhlCommercialCaseSnapshotV2,
  GhlContactSnapshotV2,
  GhlIncomingSnapshot,
  LegacyGhlContactCommercialSnapshotV1,
  OwnerSnapshot,
  SnapshotDates,
} from "@repo/contracts";

const textSchema = z.string();

const moneyOrEmptySchema = z.union([
  z.number().finite().nonnegative(),
  z.literal(""),
]);

const isoDateTimeOrEmptySchema = z.union([
  z.literal(""),
  z.iso.datetime({ offset: true }),
]);

const businessDateSchema = z.union([
  z.literal(""),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha comercial debe usar YYYY-MM-DD"),
]);

export const attributionSnapshotSchema: z.ZodType<AttributionSnapshot> = z
  .object({
    session_source: textSchema,
    medium: textSchema,
    url: textSchema,
    ctwa_clid: textSchema,
    ad_id: textSchema,
    ad_name: textSchema,
  })
  .passthrough();

export const contactSnapshotSchema: z.ZodType<ContactSnapshot> = z
  .object({
    first_name: textSchema,
    last_name: textSchema,
    full_name: textSchema,
    email: textSchema,
    primary_phone: textSchema,
    secondary_phone: textSchema,
    dni: textSchema,
    customer_city: textSchema,
    product: textSchema,
    country: textSchema,
    contact_type: textSchema,
    tags: textSchema,
  })
  .passthrough();

export const ownerSnapshotSchema: z.ZodType<OwnerSnapshot> = z
  .object({
    external_id: textSchema,
    name: textSchema,
    email: textSchema,
    phone: textSchema,
  })
  .passthrough();

export const snapshotDatesSchema: z.ZodType<SnapshotDates> = z
  .object({
    created_at_utc: isoDateTimeOrEmptySchema,
    created_at_lima: textSchema,
    lead_business_date: businessDateSchema,
    event_at_utc: z.iso.datetime({
      offset: true,
    }),
    event_at_lima: textSchema,
    event_business_date: businessDateSchema,
    timezone: z.literal("America/Lima"),
  })
  .passthrough();

export const commercialCaseFieldsSchema = z
  .object({
    carrier: textSchema,
    commercial_operation: textSchema,
    fixed_charge: moneyOrEmptySchema,
    management_status: textSchema,
    follow_up_reason: textSchema,
    lost_reason: textSchema,
    activation_status: textSchema,
    incident_reason: textSchema,
    pipeline_stage: textSchema,
    opportunity_status: textSchema,
  })
  .passthrough() satisfies z.ZodType<CommercialCaseFields>;

export const ghlContactSnapshotV2Schema: z.ZodType<GhlContactSnapshotV2> = z
  .object({
    schema_version: z.literal("2.0"),
    snapshot_type: z.literal("contact"),

    external: z
      .object({
        contact_id: textSchema,
        location_id: textSchema,
        location_name: textSchema,
      })
      .passthrough(),

    contact: contactSnapshotSchema,
    owner: ownerSnapshotSchema,

    attribution: z
      .object({
        first: attributionSnapshotSchema,
        last: attributionSnapshotSchema,
      })
      .passthrough(),

    dates: snapshotDatesSchema,
  })
  .passthrough();

export const ghlCommercialCaseSnapshotV2Schema: z.ZodType<GhlCommercialCaseSnapshotV2> =
  z
    .object({
      schema_version: z.literal("2.0"),
      snapshot_type: z.literal("commercial_case"),

      external: z
        .object({
          contact_id: textSchema,
          opportunity_id: textSchema,
          location_id: textSchema,
          location_name: textSchema,
        })
        .passthrough(),

      commercial_case: commercialCaseFieldsSchema.extend({
        service_number: textSchema,
        request_group_id: textSchema,
      }),

      owner: ownerSnapshotSchema,
      dates: snapshotDatesSchema,
    })
    .passthrough();

export const legacyGhlSnapshotV1Schema: z.ZodType<LegacyGhlContactCommercialSnapshotV1> =
  z
    .object({
      schema_version: textSchema,

      external: z
        .object({
          contact_id: textSchema,
          opportunity_id: textSchema,
          location_id: textSchema,
          location_name: textSchema,
        })
        .passthrough(),

      contact: contactSnapshotSchema,
      commercial: commercialCaseFieldsSchema,
      owner: ownerSnapshotSchema,

      attribution: z
        .object({
          first: attributionSnapshotSchema,
          last: attributionSnapshotSchema,
        })
        .passthrough(),

      dates: snapshotDatesSchema,
    })
    .passthrough();

export const ghlIncomingSnapshotSchema: z.ZodType<GhlIncomingSnapshot> =
  z.union([
    ghlContactSnapshotV2Schema,
    ghlCommercialCaseSnapshotV2Schema,
    legacyGhlSnapshotV1Schema,
  ]);

export function parseGhlIncomingSnapshot(value: unknown): GhlIncomingSnapshot {
  return ghlIncomingSnapshotSchema.parse(value);
}

export function safeParseGhlIncomingSnapshot(value: unknown) {
  return ghlIncomingSnapshotSchema.safeParse(value);
}
