"use client";

import { useActionState } from "react";

import { sendOrderToRecoveryAction } from "@/features/recovery/server/send-order-to-recovery-action";

import type { OrderInboxItem } from "../order-inbox.types";
import type { SendOrderToRecoveryActionState } from "@/features/recovery/server/recovery-action.types";

const initialState: SendOrderToRecoveryActionState = {
  type: "idle",
  message: "",
};

const reasonLabels: Record<string, string> = {
  NO_ENTREGADO: "No recibió: ausencia, falta de tiempo o cambio de fecha",
  INCIDENCIA_LOGISTICA: "Incidencia logística solucionable",
  PROMESA_COMERCIAL_INCORRECTA: "Promesa comercial incorrecta (crítico)",
  DEUDA: "Deuda pendiente de regularizar",
  ANTIGUEDAD_PORTA: "Antigüedad de portabilidad insuficiente",
  OTRO: "Otro motivo",
};

const statusLabels: Record<string, string> = {
  OPEN: "Sin responsable",
  ASSIGNED: "Asignado",
  IN_PROGRESS: "En gestión",
  SCHEDULED: "Agendado",
  TRIAGE: "Por revisar",
  WAITING: "En espera",
};

const priorityLabels: Record<string, string> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Media",
  CONDICIONADA: "Condicionada",
};

export function SendOrderToRecoveryPanel({ order }: { order: OrderInboxItem }) {
  const [state, action, pending] = useActionState(
    sendOrderToRecoveryAction,
    initialState,
  );

  if (order.recoveryCase) {
    return (
      <section
        aria-label="Caso de recuperación"
        className="rounded-lg border border-ui-info-border bg-ui-info-soft p-3 text-sm"
      >
        <p className="font-semibold text-ui-info">En recuperación</p>
        <p className="mt-1 text-ui-text">
          {statusLabels[order.recoveryCase.status] ?? order.recoveryCase.status}
          {order.recoveryCase.priority
            ? ` · Prioridad ${priorityLabels[order.recoveryCase.priority] ?? order.recoveryCase.priority}`
            : ""}
          {order.recoveryCase.assignedToName
            ? ` · ${order.recoveryCase.assignedToName}`
            : ""}
        </p>
        {order.recoveryCase.entryReason ? (
          <p className="mt-1 text-xs text-ui-muted">
            {reasonLabels[order.recoveryCase.entryReason] ??
              order.recoveryCase.entryReason}
          </p>
        ) : null}
      </section>
    );
  }

  if (!order.canSendToRecovery) return null;

  return (
    <details className="rounded-lg border border-ui-border bg-ui-surface p-3">
      <summary className="cursor-pointer text-sm font-semibold text-ui-text">
        Enviar a recupero
      </summary>
      <form action={action} className="mt-4 space-y-3">
        <input name="orderId" type="hidden" value={order.id} />
        <label className="block text-sm font-medium text-ui-text">
          Motivo comercial
          <select
            className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
            defaultValue="NO_ENTREGADO"
            name="entryReason"
          >
            {Object.entries(reasonLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-ui-text">
          ¿Qué ocurrió con esta venta?
          <textarea
            className="mt-1 min-h-24 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
            maxLength={2000}
            minLength={10}
            name="observation"
            placeholder="Conserva el mensaje del operador o lo que dijo el cliente."
            required
          />
        </label>
        {state.type !== "idle" ? (
          <p
            aria-live="polite"
            className={
              state.type === "success"
                ? "text-sm font-medium text-ui-success"
                : "text-sm font-medium text-ui-danger"
            }
          >
            {state.message}
          </p>
        ) : null}
        <button
          className="rounded-lg bg-ui-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Enviando…" : "Abrir caso de recuperación"}
        </button>
        <p className="text-xs text-ui-muted">
          La orden conserva a su asesor y equipo. Una promesa comercial
          incorrecta entra como Crítica y nunca vuelve a quien originó la
          venta.
        </p>
      </form>
    </details>
  );
}
