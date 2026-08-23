import { z } from "zod";

export const ditoOrderEscalationCategories = [
  "COMMERCIAL_OFFER",
  "CUSTOMER_REQUEST",
  "DELIVERY_LOGISTICS",
  "ACTIVATION_PAYMENT",
  "DATA_QUALITY",
  "CANCELLATION",
  "OTHER",
] as const;

export const ditoOrderEscalationPriorities = [
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export const ditoOrderEscalationTemplateTypes = [
  "LOGISTICS_NOT_MANAGED",
  "ORDER_NOT_CLOSED",
  "PORTABILITY_DATE_MISSING",
  "BAG_CORRECTION",
  "OTHER",
] as const;

export const ditoOrderEscalationCreateSchema = z.object({
  orderId: z.string().uuid("La orden no es válida"),
  category: z.enum(ditoOrderEscalationCategories),
  priority: z.enum(ditoOrderEscalationPriorities),
  templateType: z.enum(ditoOrderEscalationTemplateTypes),
  description: z
    .string()
    .trim()
    .min(10, "Describe la incidencia con al menos 10 caracteres")
    .max(2000, "La descripción no puede superar 2000 caracteres"),
  requestedAction: z
    .string()
    .trim()
    .min(5, "Indica qué necesitas del supervisor")
    .max(500, "La acción solicitada no puede superar 500 caracteres"),
});

export const ditoOrderEscalationReviewSchema = z
  .object({
    escalationId: z.string().uuid("La escalación no es válida"),
    decision: z.enum(["ACKNOWLEDGE", "ESCALATE_TDP", "RESOLVE"]),
    response: z
      .string()
      .trim()
      .max(2000, "La respuesta no puede superar 2000 caracteres"),
    tdpTemplate: z
      .string()
      .trim()
      .max(4000, "La plantilla no puede superar 4000 caracteres")
      .default(""),
  })
  .superRefine((value, context) => {
    if (value.decision === "RESOLVE" && value.response.length < 10) {
      context.addIssue({
        code: "custom",
        path: ["response"],
        message: "Explica la resolución con al menos 10 caracteres",
      });
    }
    if (value.decision === "ESCALATE_TDP" && value.tdpTemplate.length < 30) {
      context.addIssue({
        code: "custom",
        path: ["tdpTemplate"],
        message: "Completa la plantilla antes de escalar a TDP",
      });
    }
  });

export function buildDitoTdpEscalationTemplate(input: {
  type: (typeof ditoOrderEscalationTemplateTypes)[number];
  orderCode: string;
  deliveryMethod: string;
  contactPhone: string;
  department: string;
  province: string;
  district: string;
  deliveryTimeRange: string | null;
  documentNumber: string;
  serviceNumber: string;
  carrier: string;
  holderName: string;
  observation: string;
}): string {
  const customerFields = [
    `ORDEN: ${input.orderCode}`,
    `DNI: ${input.documentNumber}`,
    `CEL: ${input.serviceNumber}`,
    `OPERADOR CEDENTE: ${input.carrier}`,
    `NOMBRE Y APELLIDOS: ${input.holderName}`,
  ].join("\n");

  if (input.type === "LOGISTICS_NOT_MANAGED") {
    return [
      "Buen día, su apoyo con el pedido no gestionado por el operador logístico:",
      "",
      `ID orden: ${input.orderCode}`,
      `Opción de envío: ${input.deliveryMethod}`,
      `Número de contacto: ${input.contactPhone}`,
      `Departamento: ${input.department}`,
      `Provincia: ${input.province}`,
      `Distrito: ${input.district}`,
      `Horario de entrega acordado: ${input.deliveryTimeRange ?? "Por confirmar"}`,
      `Observación: ${input.observation}`,
    ].join("\n");
  }

  const intro =
    input.type === "PORTABILITY_DATE_MISSING"
      ? "Buena tarde, su apoyo para completar la orden. El chip fue entregado, pero el número no tiene fecha de portación verificable en consulta.portabilidad.pe."
      : input.type === "BAG_CORRECTION"
        ? "Buen día, su apoyo para CORREGIR BOLSA. El cliente aún no cuenta con llamadas y megas:"
        : input.type === "ORDER_NOT_CLOSED"
          ? "Buen día, su apoyo para completar y cerrar la orden. El pedido figura entregado desde el día anterior:"
          : "Buen día, su apoyo con la siguiente incidencia:";

  return [
    intro,
    "",
    customerFields,
    "",
    `Observación: ${input.observation}`,
  ].join("\n");
}

export type DitoOrderEscalationCreateInput = z.infer<
  typeof ditoOrderEscalationCreateSchema
>;

export type DitoOrderEscalationReviewInput = z.infer<
  typeof ditoOrderEscalationReviewSchema
>;
