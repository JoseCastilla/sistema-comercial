import { z } from "zod";

import type { GhlWebhookEnvelopeV1 } from "@repo/contracts";

import { ghlIncomingSnapshotSchema } from "./ghl-snapshot-schemas.js";

export const ghlWebhookEnvelopeV1Schema: z.ZodType<GhlWebhookEnvelopeV1> = z
  .object({
    envelope_version: z.literal("1.0"),

    source: z.literal("GHL_N8N"),

    event_id: z
      .string()
      .trim()
      .min(1, "event_id es obligatorio")
      .max(191, "event_id supera la longitud permitida"),

    event_type: z
      .string()
      .trim()
      .min(1, "event_type es obligatorio")
      .max(100, "event_type supera la longitud permitida"),

    occurred_at: z.iso.datetime({
      offset: true,
    }),

    snapshot: ghlIncomingSnapshotSchema,
  })
  .passthrough();

export function parseGhlWebhookEnvelope(value: unknown): GhlWebhookEnvelopeV1 {
  return ghlWebhookEnvelopeV1Schema.parse(value);
}

export function safeParseGhlWebhookEnvelope(value: unknown) {
  return ghlWebhookEnvelopeV1Schema.safeParse(value);
}
