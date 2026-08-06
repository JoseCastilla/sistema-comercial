import { z } from "zod";

import type {
  DitoExtensionOrderEnvelopeV2,
  DitoIncomingOrderEnvelope,
  DitoLegacyOrderEnvelopeV1,
} from "@repo/contracts";

export const ditoLegacyOrderEnvelopeV1Schema = z.object({
    schema_version: z.literal("1.0"),

    source: z.literal("DITO_EXTENSION_LEGACY"),

    event_id: z
      .string()
      .trim()
      .min(1, "event_id es obligatorio")
      .max(191, "event_id supera la longitud permitida"),

    captured_at: z.iso.datetime({
      offset: true,
    }),

    product_type: z.enum(["MOBILE", "FIXED", "UNKNOWN"]),

    order: z.object({
      code_raw: z
        .string()
        .trim()
        .min(1, "order.code_raw es obligatorio")
        .max(100),

      code_normalized: z
        .string()
        .trim()
        .regex(
          /^\d+$/,
          "order.code_normalized debe contener únicamente números",
        )
        .max(100),

      code_suffix: z.string().trim().max(10),

      operation_raw: z
        .string()
        .trim()
        .min(1, "order.operation_raw es obligatorio")
        .max(200),

      commercial_operation: z.enum([
        "NEW_LINE",
        "PORT_PREPAID",
        "PORT_POSTPAID",
        "UNKNOWN",
      ]),

      carrier: z.enum([
        "BITEL",
        "CLARO",
        "ENTEL",
        "MOVISTAR",
        "OTHER",
        "UNKNOWN",
      ]),

      fixed_charge: z.number().finite().nonnegative().nullable(),

      sales_code: z.string().trim().max(100).nullable(),

      billing_cycle_day: z.number().int().min(1).max(31).nullable(),

      payment_due_day: z.number().int().min(1).max(31).nullable(),
    }),

    holder: z.object({
      full_name: z
        .string()
        .trim()
        .min(1, "holder.full_name es obligatorio")
        .max(200),

      document_type: z.enum([
        "DNI",
        "FOREIGNER_ID",
        "RUC_10",
        "OTHER",
        "UNKNOWN",
      ]),

      document_number: z.string().trim().max(30),

      service_number: z.string().trim().max(30),
    }),

    delivery: z.object({
      method: z.enum([
        "EXPRESS",
        "REGULAR_24H",
        "REGULAR_48H",
        "REGULAR_72H",
        "UNKNOWN",
      ]),

      department: z.string().trim().max(100),

      province: z.string().trim().max(100),

      district: z.string().trim().max(100),

      contact_phone: z.string().trim().max(30).nullable().optional(),

      time_range: z.string().trim().max(100).nullable().optional(),

      address: z.string().trim().max(500).nullable().optional(),

      reference: z.string().trim().max(500).nullable().optional(),

      latitude: z.number().finite().min(-90).max(90).nullable().optional(),

      longitude: z.number().finite().min(-180).max(180).nullable().optional(),
    }),

    agent: z.object({
      name_raw: z
        .string()
        .trim()
        .min(1, "agent.name_raw es obligatorio")
        .max(150),
    }),

    raw_summary: z
      .string()
      .trim()
      .min(1, "raw_summary es obligatorio")
      .max(10000),

    additional_details: z.record(z.string(), z.unknown()),
  }) satisfies z.ZodType<DitoLegacyOrderEnvelopeV1>;

export const ditoExtensionOrderEnvelopeV2Schema =
  ditoLegacyOrderEnvelopeV1Schema
    .omit({
      schema_version: true,
      source: true,
    })
    .extend({
      schema_version: z.literal("2.0"),
      source: z.literal("DITO_EXTENSION"),
      submitted_by: z.object({
        installation_id: z.uuid(),
        email: z
          .email("submitted_by.email debe ser un correo válido")
          .trim()
          .max(254)
          .refine(
            (email) =>
              email.toLowerCase().endsWith("@distribuidoronline.com"),
            "submitted_by.email debe pertenecer a distribuidoronline.com",
          ),
      }),
    }) satisfies z.ZodType<DitoExtensionOrderEnvelopeV2>;

export const ditoIncomingOrderEnvelopeSchema: z.ZodType<DitoIncomingOrderEnvelope> =
  z.union([
    ditoLegacyOrderEnvelopeV1Schema,
    ditoExtensionOrderEnvelopeV2Schema,
  ]);

export function parseDitoLegacyOrderEnvelope(
  value: unknown,
): DitoLegacyOrderEnvelopeV1 {
  return ditoLegacyOrderEnvelopeV1Schema.parse(value);
}

export function safeParseDitoLegacyOrderEnvelope(value: unknown) {
  return ditoLegacyOrderEnvelopeV1Schema.safeParse(value);
}

export function parseDitoIncomingOrderEnvelope(
  value: unknown,
): DitoIncomingOrderEnvelope {
  return ditoIncomingOrderEnvelopeSchema.parse(value);
}

export function safeParseDitoIncomingOrderEnvelope(value: unknown) {
  return ditoIncomingOrderEnvelopeSchema.safeParse(value);
}
