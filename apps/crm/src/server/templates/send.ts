import "server-only";

import type { MessageOriginKind } from "@/generated/prisma/enums";

import { database } from "../database";
import { enqueueOutboundMessage } from "../messaging/store";
import { renderTemplateBody, type TemplateVariable } from "./render";

/**
 * Envía una plantilla aprobada a una conversación. Resuelve las variables
 * (datos del contacto, del asesor o valores manuales), renderiza la vista
 * previa y encola el envío. Lo usan bandeja, flujos, agente y difusiones.
 */
export async function sendTemplateToConversation(input: {
  conversationId: string;
  templateId: string;
  manualValues?: Record<string, string>;
  originKind: MessageOriginKind;
  originRef?: string | null;
  senderUserId?: string | null;
  clientRequestId?: string | null;
}) {
  const conversation = await database.conversation.findUniqueOrThrow({
    where: { id: input.conversationId },
    include: { contact: true },
  });
  const template = await database.messageTemplate.findFirstOrThrow({
    where: { id: input.templateId, organizationId: conversation.organizationId },
  });
  if (template.status !== "APPROVED") {
    throw new Error("Esta plantilla aún no está aprobada por Meta.");
  }
  const advisor = input.senderUserId
    ? await database.user.findUnique({ where: { id: input.senderUserId }, select: { name: true } })
    : conversation.assignedUserId
      ? await database.user.findUnique({ where: { id: conversation.assignedUserId }, select: { name: true } })
      : null;

  const variables = (Array.isArray(template.variables) ? (template.variables as unknown as TemplateVariable[]) : []);
  const context = {
    "contact.name": conversation.contact.displayName ?? "",
    "contact.phone": conversation.contact.phone ?? "",
    "advisor.name": advisor?.name ?? "",
  };
  const bodyParameters = variables
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((variable) => {
      const manual = input.manualValues?.[String(variable.index)] ?? input.manualValues?.[variable.label ?? ""];
      const value = variable.source === "manual" ? manual : (context[variable.source as keyof typeof context] ?? manual);
      if (!value) throw new Error(`Falta el valor de «${variable.label ?? `variable ${variable.index}`}»`);
      return value;
    });

  return enqueueOutboundMessage({
    conversationId: conversation.id,
    originKind: input.originKind,
    originRef: input.originRef,
    senderUserId: input.senderUserId,
    clientRequestId: input.clientRequestId,
    content: {
      kind: "template",
      templateId: template.id,
      bodyParameters,
      renderedBody: renderTemplateBody(template.components, bodyParameters),
    },
  });
}
