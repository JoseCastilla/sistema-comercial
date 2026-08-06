import { z } from "zod";

import { isDitoPlaceholder } from "./dito-order-schemas.js";

const requiredText = (label: string, maximum: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} es obligatorio`)
    .max(maximum)
    .refine((value) => !isDitoPlaceholder(value), `${label} no puede ser N/A`);

const nullableText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || null);

const nullableNumber = z
  .union([z.literal(""), z.coerce.number().finite().nonnegative()])
  .transform((value) => (value === "" ? null : value));

const nullableDay = z
  .union([z.literal(""), z.coerce.number().int().min(1).max(31)])
  .transform((value) => (value === "" ? null : value));

export const ditoOrderCorrectionSchema = z.object({
  orderId: z.uuid(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  operationRaw: requiredText("La operación", 200),
  commercialOperation: z.enum(["NEW_LINE", "PORT_PREPAID", "PORT_POSTPAID"]),
  carrier: z.enum(["BITEL", "CLARO", "ENTEL", "MOVISTAR", "OTHER", "UNKNOWN"]),
  fixedCharge: nullableNumber,
  salesCode: nullableText(100),
  billingCycleDay: nullableDay,
  paymentDueDay: nullableDay,
  holderName: requiredText("El nombre del titular", 200),
  documentNumber: requiredText("El documento", 30).refine(
    (value) => /^\d{8,11}$/.test(value.replace(/\D/g, "")),
    "Ingresa un documento válido",
  ),
  serviceNumber: requiredText("El teléfono de la operación", 30).refine(
    (value) => /^\d{7,15}$/.test(value.replace(/\D/g, "")),
    "Ingresa un teléfono válido",
  ),
  deliveryMethod: z.enum([
    "EXPRESS",
    "REGULAR_24H",
    "REGULAR_48H",
    "REGULAR_72H",
  ]),
  deliveryContactPhone: requiredText("El teléfono de contacto", 30).refine(
    (value) => /^\d{7,15}$/.test(value.replace(/\D/g, "")),
    "Ingresa un teléfono válido",
  ),
  deliveryTimeRange: nullableText(100),
  deliveryAddress: nullableText(500),
  deliveryReference: nullableText(500),
  department: requiredText("El departamento", 100),
  province: requiredText("La provincia", 100),
  district: requiredText("El distrito", 100),
  reason: requiredText("El motivo", 500).refine(
    (value) => value.length >= 10,
    "Explica el motivo en al menos 10 caracteres",
  ),
});

export type DitoOrderCorrectionInput = z.infer<
  typeof ditoOrderCorrectionSchema
>;
