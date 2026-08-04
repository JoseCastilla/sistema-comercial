import { z } from "zod";

export const editableDitoOrderStatuses = [
  "OPEN",
  "SENT",
  "CLOSED",
  "CANCELLED",
] as const;

export const editableDitoSentSubstatuses = [
  "NO_STATUS",
  "ASSIGNED",
  "SCHEDULED",
  "NOT_DELIVERED",
  "REJECTED",
  "DELIVERED",
] as const;

const sentSubstatusSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return value;
}, z.enum(editableDitoSentSubstatuses).nullable());

const observationSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}, z.string().max(2000, "La observación no puede superar 2000 caracteres").nullable());

export const ditoOrderStatusUpdateSchema = z
  .object({
    orderId: z.string().uuid("La orden no es válida"),

    status: z.enum(editableDitoOrderStatuses),

    sentSubstatus: sentSubstatusSchema,

    observation: observationSchema,
  })
  .superRefine((value, context) => {
    if (value.status === "SENT" && value.sentSubstatus === null) {
      context.addIssue({
        code: "custom",

        path: ["sentSubstatus"],

        message: "Selecciona el subestado de la orden enviada",
      });
    }

    if (value.status !== "SENT" && value.sentSubstatus !== null) {
      context.addIssue({
        code: "custom",

        path: ["sentSubstatus"],

        message: "Los subestados solo corresponden al estado Enviado",
      });
    }
  });

export type DitoOrderStatusUpdateInput = z.infer<
  typeof ditoOrderStatusUpdateSchema
>;
