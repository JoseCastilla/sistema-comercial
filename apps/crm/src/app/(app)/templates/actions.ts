"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/server/audit";
import { requireManager } from "@/server/auth/access";
import { failure, optionalText, text, type ActionState } from "@/server/forms";
import { describeMetaError, MetaApiError } from "@/server/meta/errors";
import { retireTemplate, submitTemplate, syncTemplates, TemplateDraftInvalid } from "@/server/templates/manage";
import { detectVariables } from "@/server/templates/render";
import {
  normalizeTemplateName,
  TEMPLATE_LIMITS,
  type TemplateButtonDraft,
  type TemplateCategoryValue,
  type TemplateDraft,
  type TemplateVariableDraft,
} from "@/server/templates/validation";

/** Acciones de la biblioteca de plantillas (SPEC-055). Crean y editan supervisores. */

function problemText(error: unknown): string {
  if (error instanceof TemplateDraftInvalid) return error.problems.join(" ");
  if (error instanceof MetaApiError) return describeMetaError(error);
  return error instanceof Error ? error.message : "No se pudo completar la acción.";
}

export async function syncWithMeta(): Promise<ActionState> {
  try {
    const access = await requireManager();
    const summary = await syncTemplates(access.organizationId);
    revalidatePath("/templates");
    return {
      ok: true,
      message: `Listo: ${summary.created} nuevas, ${summary.updated} actualizadas y ${summary.retired} que Meta ya no tiene.`,
    };
  } catch (error) {
    return { ok: false, error: problemText(error) };
  }
}

function readButtons(formData: FormData): TemplateButtonDraft[] {
  const buttons: TemplateButtonDraft[] = [];
  for (let index = 1; index <= TEMPLATE_LIMITS.buttons; index += 1) {
    const label = text(formData, `buttonText_${index}`);
    if (!label) continue;
    const kind = text(formData, `buttonType_${index}`) === "URL" ? "URL" : "QUICK_REPLY";
    buttons.push({ type: kind, text: label, url: kind === "URL" ? optionalText(formData, `buttonUrl_${index}`) : null });
  }
  return buttons;
}

function readVariables(formData: FormData, body: string): TemplateVariableDraft[] {
  return detectVariables(body).map<TemplateVariableDraft>((index) => ({
    index,
    source: text(formData, `variableSource_${index}`) || "manual",
    label: text(formData, `variableLabel_${index}`) || `Variable ${index}`,
    example: text(formData, `variableExample_${index}`),
  }));
}

const CATEGORIES: TemplateCategoryValue[] = ["MARKETING", "UTILITY", "AUTHENTICATION"];

export async function createTemplate(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const whatsappNumberId = text(formData, "whatsappNumberId");
    if (!whatsappNumberId) return { ok: false, error: "Elige el número desde el que se enviará." };

    const category = text(formData, "category") as TemplateCategoryValue;
    if (!CATEGORIES.includes(category)) return { ok: false, error: "Elige para qué sirve la plantilla." };

    const body = text(formData, "body");
    const draft: TemplateDraft = {
      name: normalizeTemplateName(text(formData, "name")),
      language: text(formData, "language") || "es",
      category,
      header: optionalText(formData, "header"),
      body,
      footer: optionalText(formData, "footer"),
      buttons: readButtons(formData),
      variables: readVariables(formData, body),
    };

    const saved = await submitTemplate({
      organizationId: access.organizationId,
      whatsappNumberId,
      draft,
      createdByUserId: access.userId,
    });
    await audit({
      organizationId: access.organizationId,
      actorUserId: access.userId,
      action: "template.submitted",
      targetKind: "message_template",
      targetId: saved.id,
      detail: { name: saved.name, language: saved.language, category: saved.category },
    });
    revalidatePath("/templates");
    return {
      ok: true,
      message: `«${saved.name}» quedó en revisión de Meta. Cuando la apruebe, aparecerá lista para enviar.`,
    };
  } catch (error) {
    return { ok: false, error: problemText(error) };
  }
}

export async function retire(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const saved = await retireTemplate({ organizationId: access.organizationId, templateId: text(formData, "templateId") });
    await audit({
      organizationId: access.organizationId,
      actorUserId: access.userId,
      action: "template.retired",
      targetKind: "message_template",
      targetId: saved.id,
      detail: { name: saved.name },
    });
    revalidatePath("/templates");
    return { ok: true, message: `«${saved.name}» ya no se puede enviar. Los mensajes que se enviaron con ella no se tocan.` };
  } catch (error) {
    return failure(error, "No se pudo retirar la plantilla.");
  }
}
