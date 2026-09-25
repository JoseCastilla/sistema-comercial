import {
  describeMyDayDue,
  describeMyDaySince,
  formatMyDaySaleDay,
  formatMyDayTime,
  myDaySoonMs,
} from "./my-day.js";
import { baseRecoveryResolutionDays } from "./recovery-base-distribution.js";

import type {
  RecoveryAgendaItem,
  RecoveryAgendaItemKind,
  RecoveryAgendaOrigin,
} from "./recovery-agenda.js";

/**
 * Cómo se dice un caso de campaña al asesor — SPEC-065. «Mi día» y la cola
 * de Campañas muestran el mismo caso: con esta regla dicen lo mismo (AC-001).
 */

/** BR-004: qué hacer, en una frase y sin jerga del motor. */
export const campaignWorkActions: Record<RecoveryAgendaItemKind, string> = {
  VERIFICACION: "En verificación",
  CITA_ACORDADA: "Llamar: cita acordada",
  COMPLETAR_VENTA: "Completar la venta",
  CERRAR: "Cerrar como rechazo definitivo",
  RESOLVER_DATOS: "Corregir sus datos",
  SEGUIMIENTO: "Llamar: seguimiento acordado",
  HABILITACION: "Ya puede portar: llámalo",
  REINTENTO: "Volver a llamar",
  SIN_FECHA: "Llamar por primera vez",
};

/** Solo el origen que le dice algo al asesor; el resto es ruido del motor. */
export const campaignWorkNotes: Partial<Record<RecoveryAgendaOrigin, string>> =
  {
    devuelto: "Volvió de verificación: sigue pudiendo portar",
    dato_pendiente: "Falta la fecha de portación",
    impedimento: "Seguimiento del impedimento",
    pausa: "Estaba en pausa por un rechazo",
  };

/** BR-006: la resolución obligatoria (SPEC-030 BR-058) dice qué hacer. */
export const campaignResolutionNote = `Lleva ${baseRecoveryResolutionDays} días contigo: ciérralo o agenda una fecha`;

export type CampaignWorkTone = "danger" | "warning" | "neutral";

/**
 * BR-002: el plazo de lo que toca. Solo la llamada acordada es un compromiso
 * del asesor: roja si la dejó vencer, ámbar si vence pronto. Lo demás es una
 * oportunidad: vencida dice desde cuándo, sin reproche; futura, cuándo vuelve.
 */
export function describeCampaignWorkDue(
  item: RecoveryAgendaItem,
  now: Date,
): { label: string; tone: CampaignWorkTone } | null {
  if (!item.at) return null;

  if (item.kind === "CITA_ACORDADA") {
    const untilMs = item.at.getTime() - now.getTime();
    return {
      label: describeMyDayDue(item.at, now),
      tone: untilMs < 0 ? "danger" : untilMs <= myDaySoonMs ? "warning" : "neutral",
    };
  }

  return {
    label: item.overdue
      ? describeMyDaySince(item.at, now)
      : describeMyDayDue(item.at, now),
    tone: "neutral",
  };
}

/** BR-009: «08/09 12:40», el mismo formato de «Mi día». */
export function formatCampaignMoment(at: Date): string {
  return `${formatMyDaySaleDay(at)} ${formatMyDayTime(at)}`;
}
