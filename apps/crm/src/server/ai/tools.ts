import "server-only";

import { formatDateTime } from "@/lib/time";

import { database } from "../database";
import { publishEvent } from "../events/bus";
import { getAvailableSlots, createAppointment, SlotUnavailableError } from "../calendar/service";
import { setResponderState } from "../messaging/conversation-state";
import { findOpenOpportunity, openOpportunity, setProposal, setStage } from "../opportunities/service";

import { districtCoverage } from "./coverage";
import { emptySandboxState, type SandboxState } from "./sandbox";
import { isToolName, TOOL_DEFINITIONS, TOOL_NAMES, toolDefinitionsFor, type ToolName } from "./tool-definitions";

/**
 * Ejecutores de las herramientas del agente (SPEC-058 BR-007).
 *
 * Toda herramienta comprueba primero la organización y, cuando toca la
 * conversación, que la conversación sea de esa organización. El agente actúa
 * con `actorKind: "AGENT_AI"`, así que su rastro se distingue del de una
 * persona en `OpportunityEvent` y en `Appointment`.
 *
 * En simulador y en pruebas se usa `sandboxToolExecutor`: opera sobre un
 * contexto ficticio en memoria y no escribe nada en la base. Las dos
 * herramientas de solo lectura que sí consultan datos reales son
 * `consultar_planes` y `consultar_horarios`, porque una respuesta con precios
 * inventados no probaría nada (SPEC-058 BR-018, AC-001).
 */

export { TOOL_DEFINITIONS, TOOL_NAMES, toolDefinitionsFor, isToolName };
export type { ToolName };

export interface ToolInvocation {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolOutcome {
  /** Lo que lee el modelo. */
  content: string;
  /** La herramienta no pudo hacer lo que se pidió; el modelo debe ofrecer otra salida. */
  isError?: boolean;
  /** `pasar_a_asesor`: el turno termina con despedida y no se sigue conversando. */
  handoff?: boolean;
  handoffReason?: string;
}

export interface ToolExecutor {
  run(invocation: ToolInvocation): Promise<ToolOutcome>;
}

// ───────────────────────── Lectura de la entrada ─────────────────────────

function textOf(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function intOf(input: Record<string, unknown>, key: string): number | null {
  const value = input[key];
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function money(value: unknown): string {
  const amount = typeof value === "object" && value !== null && "toString" in value ? Number(value.toString()) : Number(value);
  return Number.isFinite(amount) ? `S/ ${amount.toFixed(2)}` : "sin cargo fijo registrado";
}

// ───────────────────────── Lecturas compartidas ─────────────────────────

const COVERAGE_NOTE = "Dile que la dirección exacta la confirma el asesor antes de la entrega.";

async function readPlans(organizationId: string): Promise<ToolOutcome> {
  const now = new Date();
  const plans = await database.planCatalogItem.findMany({
    where: { organizationId, validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true, fixedCharge: true, requirements: true, promotion: true },
  });
  if (!plans.length) {
    return {
      content:
        "No hay planes vigentes en el catálogo. No digas ningún precio: dile que un asesor le confirma las opciones y deriva la conversación.",
    };
  }
  const list = plans
    .map(
      (plan) =>
        [
          `- id: ${plan.id}`,
          `  plan: ${plan.name} (${plan.kind})`,
          `  cargo fijo por línea: ${money(plan.fixedCharge)}`,
          `  requisitos: ${plan.requirements?.trim() || "sin requisitos anotados"}`,
          `  promoción: ${plan.promotion?.trim() || "sin promoción vigente"}`,
        ].join("\n"),
    )
    .join("\n");
  return { content: `Planes vigentes hoy:\n${list}\n\nSolo puedes mencionar montos que aparezcan en esta lista.` };
}

async function readSlots(organizationId: string, timezone: string): Promise<ToolOutcome> {
  const slots = await getAvailableSlots({ organizationId, days: 5, onlyAvailable: true });
  const next = slots.slice(0, 8);
  if (!next.length) {
    return {
      content:
        "No hay horarios con cupo en los próximos cinco días. No inventes uno: dile que un asesor coordina la llamada y deriva la conversación.",
    };
  }
  const list = next
    .map((slot) => `- ${slot.label} (horario_iso: ${slot.startsAt.toISOString()}, quedan ${slot.capacity - slot.booked} cupos)`)
    .join("\n");
  return { content: `Horarios con cupo (hora de ${timezone}):\n${list}\n\nOfrece como mucho dos de estos y usa el horario_iso tal cual al agendar.` };
}

function coverageAnswer(district: string | null): ToolOutcome {
  if (!district) return { content: "No entendí el distrito. Pregúntale en qué distrito de Lima o Callao está." };
  const answer = districtCoverage(district);
  if (answer.covered) {
    return { content: `Sí hay reparto en ${answer.district}. ${COVERAGE_NOTE}` };
  }
  return {
    content: `${district} no está en la zona de reparto conocida. No prometas entrega: dile que un asesor confirma si llegan a su zona y deriva la conversación.`,
  };
}

// ───────────────────────── Ejecutor real (modo LIVE) ─────────────────────────

export interface LiveToolContext {
  organizationId: string;
  conversationId: string;
  contactId: string;
  timezone: string;
  allowedTags: string[];
  /** Herramientas activas de la versión del agente. */
  enabled: readonly string[];
}

class LiveToolExecutor implements ToolExecutor {
  constructor(private readonly context: LiveToolContext) {}

  async run(invocation: ToolInvocation): Promise<ToolOutcome> {
    const name = invocation.name;
    if (!isToolName(name)) return { content: `La herramienta ${name} no existe.`, isError: true };
    switch (name) {
      case "guardar_dato_lead":
        return this.saveLead(invocation.input);
      case "consultar_planes":
        return readPlans(this.context.organizationId);
      case "consultar_cobertura":
        return coverageAnswer(textOf(invocation.input, "distrito"));
      case "consultar_horarios":
        return readSlots(this.context.organizationId, this.context.timezone);
      case "avanzar_oportunidad":
        return this.advance(invocation.input);
      case "agendar_llamada":
        return this.book(invocation.input);
      case "pasar_a_asesor":
        return this.handoff(invocation.input);
      case "etiquetar":
        return this.tag(invocation.input);
      case "registrar_baja":
        return this.optOut(invocation.input);
    }
  }

  /** La oportunidad abierta del contacto; si no hay, la abre con el origen de la conversación. */
  private async currentOpportunity() {
    const { organizationId, contactId, conversationId } = this.context;
    const open = await findOpenOpportunity(organizationId, contactId);
    if (open) return open;
    const conversation = await database.conversation.findFirst({
      where: { id: conversationId, organizationId },
      select: { originAdId: true, assignedUserId: true },
    });
    const { opportunity } = await openOpportunity({
      organizationId,
      contactId,
      conversationId,
      origin: conversation?.originAdId ? "AD" : "ORGANIC",
      originRef: conversation?.originAdId ?? null,
      assignedUserId: conversation?.assignedUserId ?? null,
      actorKind: "AGENT_AI",
    });
    return opportunity;
  }

  private async saveLead(input: Record<string, unknown>): Promise<ToolOutcome> {
    const { organizationId, contactId } = this.context;
    const nombre = textOf(input, "nombre");
    const dniRaw = textOf(input, "dni");
    const dni = dniRaw && /^\d{8}$/.test(dniRaw.replace(/\D/g, "")) ? dniRaw.replace(/\D/g, "") : null;
    const operador = textOf(input, "operador_actual");
    const distrito = textOf(input, "distrito");
    const lineas = intOf(input, "lineas");
    const planInteres = textOf(input, "plan_interes");

    if (dniRaw && !dni) {
      return { content: "Ese DNI no tiene 8 dígitos. Pídeselo de nuevo antes de guardarlo.", isError: true };
    }
    const saved: string[] = [];
    const data: Record<string, unknown> = {};
    if (nombre) {
      data.displayName = nombre;
      saved.push("nombre");
    }
    if (dni) {
      data.documentNumber = dni;
      saved.push("DNI");
    }
    if (operador) {
      data.currentCarrier = operador;
      saved.push("operador actual");
    }
    if (distrito) {
      data.district = distrito;
      saved.push("distrito");
    }
    if (Object.keys(data).length) {
      await database.contact.updateMany({ where: { id: contactId, organizationId }, data });
    }
    if (lineas !== null) saved.push(`${lineas} línea(s)`);
    if (planInteres) saved.push(`plan de interés «${planInteres}»`);
    if (!saved.length) return { content: "No mandaste ningún dato: no se guardó nada.", isError: true };

    const opportunity = await this.currentOpportunity();
    await database.opportunityEvent.create({
      data: {
        opportunityId: opportunity.id,
        type: "TOUCH",
        actorKind: "AGENT_AI",
        detail: { source: "asistente virtual", nombre, dni, operador, distrito, lineas, planInteres },
      },
    });
    return { content: `Guardado: ${saved.join(", ")}. No vuelvas a pedir estos datos.` };
  }

  private async advance(input: Record<string, unknown>): Promise<ToolOutcome> {
    const etapa = textOf(input, "etapa");
    if (etapa !== "CALIFICADO" && etapa !== "PROPUESTA") {
      return { content: "Solo puedes mover la oportunidad a CALIFICADO o a PROPUESTA.", isError: true };
    }
    const opportunity = await this.currentOpportunity();
    const planId = textOf(input, "plan_id");
    const lineas = intOf(input, "lineas") ?? 1;
    try {
      if (planId) {
        const plan = await database.planCatalogItem.findFirst({
          where: { id: planId, organizationId: this.context.organizationId },
          select: { id: true, name: true, fixedCharge: true },
        });
        if (!plan) return { content: "Ese plan no está en el catálogo. Vuelve a consultar los planes vigentes.", isError: true };
        await setProposal({
          organizationId: this.context.organizationId,
          opportunityId: opportunity.id,
          planId: plan.id,
          lines: Math.max(1, lineas),
          fixedCharge: Number(plan.fixedCharge) * Math.max(1, lineas),
          actorKind: "AGENT_AI",
        });
      }
      if (opportunity.stage !== etapa) {
        await setStage({
          organizationId: this.context.organizationId,
          opportunityId: opportunity.id,
          stage: etapa,
          actorKind: "AGENT_AI",
          reason: textOf(input, "motivo") ?? "lo avanzó el asistente virtual",
        });
      }
      return { content: `Oportunidad en ${etapa}. Sigue la conversación con normalidad.` };
    } catch (error) {
      return { content: error instanceof Error ? error.message : "No se pudo mover la oportunidad.", isError: true };
    }
  }

  private async book(input: Record<string, unknown>): Promise<ToolOutcome> {
    const iso = textOf(input, "horario_iso");
    const at = iso ? new Date(iso) : null;
    if (!at || Number.isNaN(at.getTime())) {
      return { content: "Ese horario no es válido. Vuelve a consultar los horarios con cupo.", isError: true };
    }
    const opportunity = await this.currentOpportunity();
    try {
      const { appointment } = await createAppointment({
        organizationId: this.context.organizationId,
        contactId: this.context.contactId,
        conversationId: this.context.conversationId,
        opportunityId: opportunity.id,
        scheduledAt: at,
        createdByKind: "AGENT_AI",
        clientRequestId: `${this.context.conversationId}:${at.toISOString()}`,
        notes: "Llamada agendada por el asistente virtual.",
      });
      return {
        content: `Llamada agendada para ${formatDateTime(appointment.scheduledAt, this.context.timezone)}. Confírmasela en un mensaje corto.`,
      };
    } catch (error) {
      if (error instanceof SlotUnavailableError) {
        return { content: `${error.message} Consulta los horarios de nuevo y ofrécele otro.`, isError: true };
      }
      return { content: error instanceof Error ? error.message : "No se pudo agendar.", isError: true };
    }
  }

  private async handoff(input: Record<string, unknown>): Promise<ToolOutcome> {
    const resumen = textOf(input, "resumen") ?? "Sin resumen.";
    const motivo = textOf(input, "motivo") ?? "LO_PIDIO";
    // `ConversationNote.authorUserId` es obligatorio y aquí no hay persona, así
    // que el resumen se guarda como evento AI_HANDOFF (evidencia que solo añade filas).
    await database.conversationEvent.create({
      data: { conversationId: this.context.conversationId, type: "AI_HANDOFF", detail: { summary: resumen, reason: motivo } },
    });
    await setResponderState({
      conversationId: this.context.conversationId,
      state: "REQUIERE_ASESOR",
      reason: handoffReasonText(motivo),
    });
    return {
      content: "La conversación quedó en la cola del equipo. Despídete en un mensaje corto diciendo que un asesor le escribe y no preguntes nada más.",
      handoff: true,
      handoffReason: handoffReasonText(motivo),
    };
  }

  private async tag(input: Record<string, unknown>): Promise<ToolOutcome> {
    const tag = textOf(input, "etiqueta");
    if (!tag) return { content: "No mandaste ninguna etiqueta.", isError: true };
    const allowed = this.context.allowedTags.find((candidate) => candidate.toLowerCase() === tag.toLowerCase());
    if (!allowed) {
      return {
        content: `«${tag}» no está en la lista permitida (${this.context.allowedTags.join(", ") || "vacía"}). No la agregues.`,
        isError: true,
      };
    }
    const contact = await database.contact.findFirst({
      where: { id: this.context.contactId, organizationId: this.context.organizationId },
      select: { tags: true },
    });
    if (!contact) return { content: "El contacto ya no existe.", isError: true };
    if (contact.tags.includes(allowed)) return { content: `Ya tenía la etiqueta ${allowed}.` };
    await database.contact.update({ where: { id: this.context.contactId }, data: { tags: [...contact.tags, allowed] } });
    publishEvent({ type: "contact.tagged", organizationId: this.context.organizationId, contactId: this.context.contactId, tag: allowed });
    return { content: `Etiqueta ${allowed} agregada.` };
  }

  private async optOut(input: Record<string, unknown>): Promise<ToolOutcome> {
    const frase = textOf(input, "frase");
    await database.contact.updateMany({
      where: { id: this.context.contactId, organizationId: this.context.organizationId },
      data: { marketingOptIn: false, marketingOptOutAt: new Date() },
    });
    await database.contactConsent.create({
      data: {
        organizationId: this.context.organizationId,
        contactId: this.context.contactId,
        category: "MARKETING",
        granted: false,
        source: "lo pidió al asistente",
        evidenceText: frase,
      },
    });
    return { content: "Baja de marketing registrada. Confírmaselo y dile que igual puede escribir si necesita algo." };
  }
}

export function handoffReasonText(code: string): string {
  const reasons: Record<string, string> = {
    LO_PIDIO: "la persona pidió hablar con alguien",
    DATOS_COMPLETOS: "ya tiene los datos para evaluar",
    FUERA_DE_MI_ALCANCE: "la pregunta no está en lo que sabe el asistente",
    MOLESTIA: "la persona está molesta",
    SIN_AVANCE: "tres turnos sin avanzar",
    ADJUNTO_NO_ENTENDIDO: "mandó un archivo que el asistente no puede leer",
  };
  return reasons[code] ?? "lo derivó el asistente virtual";
}

export function liveToolExecutor(context: LiveToolContext): ToolExecutor {
  return new LiveToolExecutor(context);
}

// ───────────────────── Ejecutor de simulador y pruebas ─────────────────────

export { emptySandboxState };
export type { SandboxState };

export interface SandboxToolContext {
  organizationId: string;
  timezone: string;
  allowedTags: string[];
  state: SandboxState;
}

class SandboxToolExecutor implements ToolExecutor {
  constructor(private readonly context: SandboxToolContext) {}

  async run(invocation: ToolInvocation): Promise<ToolOutcome> {
    const name = invocation.name;
    if (!isToolName(name)) return { content: `La herramienta ${name} no existe.`, isError: true };
    const state = this.context.state;
    const input = invocation.input;
    switch (name) {
      // Estas dos leen datos reales: probar con precios de mentira no probaría nada.
      case "consultar_planes":
        return readPlans(this.context.organizationId);
      case "consultar_horarios":
        return readSlots(this.context.organizationId, this.context.timezone);
      case "consultar_cobertura":
        return coverageAnswer(textOf(input, "distrito"));
      case "guardar_dato_lead": {
        const nombre = textOf(input, "nombre");
        const dni = textOf(input, "dni");
        const operador = textOf(input, "operador_actual");
        const distrito = textOf(input, "distrito");
        const lineas = intOf(input, "lineas");
        const plan = textOf(input, "plan_interes");
        if (nombre) state.contact.nombre = nombre;
        if (dni) state.contact.dni = dni;
        if (operador) state.contact.operador = operador;
        if (distrito) state.contact.distrito = distrito;
        if (lineas !== null) state.lineas = lineas;
        if (plan) state.planInteres = plan;
        const saved = [nombre && "nombre", dni && "DNI", operador && "operador", distrito && "distrito", lineas !== null && "líneas", plan && "plan"]
          .filter(Boolean)
          .join(", ");
        return saved ? { content: `Guardado (prueba): ${saved}.` } : { content: "No mandaste ningún dato.", isError: true };
      }
      case "avanzar_oportunidad": {
        const etapa = textOf(input, "etapa");
        if (etapa !== "CALIFICADO" && etapa !== "PROPUESTA") {
          return { content: "Solo puedes mover la oportunidad a CALIFICADO o a PROPUESTA.", isError: true };
        }
        state.etapa = etapa;
        return { content: `Oportunidad en ${etapa} (prueba).` };
      }
      case "agendar_llamada": {
        const iso = textOf(input, "horario_iso");
        const at = iso ? new Date(iso) : null;
        if (!at || Number.isNaN(at.getTime())) return { content: "Ese horario no es válido.", isError: true };
        state.citaIso = at.toISOString();
        return { content: `Llamada agendada para ${formatDateTime(at, this.context.timezone)} (prueba). Confírmasela en un mensaje corto.` };
      }
      case "etiquetar": {
        const tag = textOf(input, "etiqueta");
        if (!tag) return { content: "No mandaste ninguna etiqueta.", isError: true };
        const allowed = this.context.allowedTags.find((candidate) => candidate.toLowerCase() === tag.toLowerCase());
        if (!allowed) return { content: `«${tag}» no está en la lista permitida.`, isError: true };
        if (!state.contact.etiquetas.includes(allowed)) state.contact.etiquetas.push(allowed);
        return { content: `Etiqueta ${allowed} agregada (prueba).` };
      }
      case "registrar_baja":
        state.bajaMarketing = true;
        return { content: "Baja de marketing registrada (prueba)." };
      case "pasar_a_asesor": {
        const resumen = textOf(input, "resumen") ?? "Sin resumen.";
        const motivo = textOf(input, "motivo") ?? "LO_PIDIO";
        state.handoff = { resumen, motivo };
        return {
          content: "La conversación quedó en la cola (prueba). Despídete en un mensaje corto y no preguntes nada más.",
          handoff: true,
          handoffReason: handoffReasonText(motivo),
        };
      }
    }
  }
}

export function sandboxToolExecutor(context: SandboxToolContext): ToolExecutor {
  return new SandboxToolExecutor(context);
}
