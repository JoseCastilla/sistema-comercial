import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { database } from "../database";
import { decryptSecret } from "../crypto";
import { publishEvent } from "../events/bus";
import { createTemplate, deleteTemplate, listTemplates } from "../meta/graph";
import { metaTemplateStatusToLocal } from "../meta/status-text";
import { detectVariables } from "./render";
import { buildTemplateComponents, templateVariablesFor, validateTemplateDraft, type TemplateDraft } from "./validation";

/**
 * Biblioteca de plantillas contra Meta (SPEC-055 BR-001): sincronizar lo que
 * hay en la WABA y crear plantillas nuevas desde el sistema.
 */

export interface SyncSummary {
  created: number;
  updated: number;
  retired: number;
}

/** Variables por defecto de una plantilla que vino de Meta: las completa un supervisor. */
function defaultVariables(components: unknown): { index: number; source: string; label: string }[] {
  const body = Array.isArray(components)
    ? ((components as { type?: string; text?: string }[]).find((component) => (component.type ?? "").toUpperCase() === "BODY")?.text ?? "")
    : "";
  return detectVariables(body).map((index) => ({ index, source: "manual", label: `Variable ${index}` }));
}

/**
 * Trae de Meta las plantillas de un número y las deja igual en la biblioteca.
 * Las que Meta ya no tiene quedan «retiradas»: su historial de envíos no se toca.
 */
export async function syncTemplatesForNumber(input: {
  organizationId: string;
  whatsappNumberId: string;
}): Promise<SyncSummary> {
  const number = await database.whatsappNumber.findFirstOrThrow({
    where: { id: input.whatsappNumberId, organizationId: input.organizationId },
    select: { id: true, wabaId: true, accessTokenCiphertext: true },
  });
  const token = decryptSecret(number.accessTokenCiphertext);
  const remote = await listTemplates(token, number.wabaId);
  const now = new Date();

  const summary: SyncSummary = { created: 0, updated: 0, retired: 0 };
  const seen = new Set<string>();

  for (const template of remote) {
    const language = template.language || "es";
    seen.add(`${template.name}|${language}`);
    const status = metaTemplateStatusToLocal(template.status);
    const category = (template.category ?? "UTILITY").toUpperCase();
    const existing = await database.messageTemplate.findUnique({
      where: { whatsappNumberId_name_language: { whatsappNumberId: number.id, name: template.name, language } },
      select: { id: true, variables: true },
    });
    const shared = {
      externalId: template.id,
      category: (category === "MARKETING" || category === "AUTHENTICATION" ? category : "UTILITY") as "MARKETING" | "UTILITY" | "AUTHENTICATION",
      status,
      components: (template.components ?? []) as unknown as Prisma.InputJsonValue,
      rejectedReason: status === "REJECTED" ? template.rejected_reason ?? "Meta no dio el motivo" : null,
      qualityScore: template.quality_score?.score?.toUpperCase() ?? null,
      lastSyncedAt: now,
    };
    if (existing) {
      const keepVariables = Array.isArray(existing.variables) && existing.variables.length > 0;
      const saved = await database.messageTemplate.update({
        where: { id: existing.id },
        data: {
          ...shared,
          ...(keepVariables ? {} : { variables: defaultVariables(template.components) as unknown as Prisma.InputJsonValue }),
        },
      });
      summary.updated += 1;
      publishEvent({ type: "template.updated", organizationId: input.organizationId, templateId: saved.id, status: saved.status });
    } else {
      const saved = await database.messageTemplate.create({
        data: {
          organizationId: input.organizationId,
          whatsappNumberId: number.id,
          name: template.name,
          language,
          ...shared,
          variables: defaultVariables(template.components) as unknown as Prisma.InputJsonValue,
        },
      });
      summary.created += 1;
      publishEvent({ type: "template.updated", organizationId: input.organizationId, templateId: saved.id, status: saved.status });
    }
  }

  const locals = await database.messageTemplate.findMany({
    where: { whatsappNumberId: number.id, status: { notIn: ["DRAFT", "RETIRED"] } },
    select: { id: true, name: true, language: true },
  });
  for (const local of locals) {
    if (seen.has(`${local.name}|${local.language}`)) continue;
    await database.messageTemplate.update({ where: { id: local.id }, data: { status: "RETIRED", lastSyncedAt: now } });
    summary.retired += 1;
    publishEvent({ type: "template.updated", organizationId: input.organizationId, templateId: local.id, status: "RETIRED" });
  }
  return summary;
}

/** Sincroniza todos los números conectados de la organización. */
export async function syncTemplates(organizationId: string): Promise<SyncSummary> {
  const numbers = await database.whatsappNumber.findMany({
    where: { organizationId, status: { not: "DISCONNECTED" } },
    select: { id: true },
  });
  const total: SyncSummary = { created: 0, updated: 0, retired: 0 };
  for (const number of numbers) {
    const summary = await syncTemplatesForNumber({ organizationId, whatsappNumberId: number.id });
    total.created += summary.created;
    total.updated += summary.updated;
    total.retired += summary.retired;
  }
  return total;
}

export class TemplateDraftInvalid extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join(" "));
    this.name = "TemplateDraftInvalid";
    this.problems = problems;
  }
}

/** Crea la plantilla en Meta y la guarda «en revisión» con el id que devuelve. */
export async function submitTemplate(input: {
  organizationId: string;
  whatsappNumberId: string;
  draft: TemplateDraft;
  createdByUserId?: string | null;
}) {
  const problems = validateTemplateDraft(input.draft);
  if (problems.length) throw new TemplateDraftInvalid(problems);

  const number = await database.whatsappNumber.findFirstOrThrow({
    where: { id: input.whatsappNumberId, organizationId: input.organizationId },
    select: { id: true, wabaId: true, accessTokenCiphertext: true },
  });
  const components = buildTemplateComponents(input.draft);
  const token = decryptSecret(number.accessTokenCiphertext);
  const response = await createTemplate(token, number.wabaId, {
    name: input.draft.name,
    language: input.draft.language,
    category: input.draft.category,
    components,
  });

  const status = metaTemplateStatusToLocal(response.status);
  const saved = await database.messageTemplate.upsert({
    where: { whatsappNumberId_name_language: { whatsappNumberId: number.id, name: input.draft.name, language: input.draft.language } },
    create: {
      organizationId: input.organizationId,
      whatsappNumberId: number.id,
      externalId: response.id,
      name: input.draft.name,
      language: input.draft.language,
      category: input.draft.category,
      status,
      components: components as unknown as Prisma.InputJsonValue,
      variables: templateVariablesFor(input.draft) as unknown as Prisma.InputJsonValue,
      createdByUserId: input.createdByUserId ?? null,
      lastSyncedAt: new Date(),
    },
    update: {
      externalId: response.id,
      category: input.draft.category,
      status,
      components: components as unknown as Prisma.InputJsonValue,
      variables: templateVariablesFor(input.draft) as unknown as Prisma.InputJsonValue,
      rejectedReason: null,
      pausedUntil: null,
      lastSyncedAt: new Date(),
    },
  });
  publishEvent({ type: "template.updated", organizationId: input.organizationId, templateId: saved.id, status: saved.status });
  return saved;
}

/** Borra la plantilla en Meta y la deja retirada aquí. El historial no se toca. */
export async function retireTemplate(input: { organizationId: string; templateId: string }) {
  const template = await database.messageTemplate.findFirstOrThrow({
    where: { id: input.templateId, organizationId: input.organizationId },
    include: { whatsappNumber: { select: { wabaId: true, accessTokenCiphertext: true } } },
  });
  if (template.status !== "DRAFT" && template.status !== "RETIRED") {
    const token = decryptSecret(template.whatsappNumber.accessTokenCiphertext);
    await deleteTemplate(token, template.whatsappNumber.wabaId, template.name);
  }
  const saved = await database.messageTemplate.update({ where: { id: template.id }, data: { status: "RETIRED" } });
  publishEvent({ type: "template.updated", organizationId: input.organizationId, templateId: saved.id, status: "RETIRED" });
  return saved;
}
