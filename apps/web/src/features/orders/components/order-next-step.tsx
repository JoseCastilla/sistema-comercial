"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { updateOrderStatusAction } from "../server/update-order-status-action";

import type { OrderStatusActionState } from "../server/order-status-action.types";
import type { OrderInboxItem } from "../order-inbox.types";

const initialActionState: OrderStatusActionState = {
  type: "idle",
  message: "",
};

export interface OrderStep {
  label: string;
  status: "OPEN" | "SENT" | "CLOSED";
  sentSubstatus: string | null;
}

const sent = (sentSubstatus: string, label: string): OrderStep => ({
  label,
  status: "SENT",
  sentSubstatus,
});

/**
 * SPEC-074 §4.3: los pasos que tienen sentido desde donde está el pedido.
 * Cada botón nombra el resultado («Entregado»), no la mecánica («Guardar
 * estado»). Cancelar no está aquí: exige motivo y, para el asesor,
 * aprobación (SPEC-013), así que sigue en «Otro cambio».
 */
export function getOrderSteps(
  order: Pick<
    OrderInboxItem,
    "status" | "sentSubstatus" | "canUpdate" | "canClose"
  > &
    Partial<Pick<OrderInboxItem, "pendingCancellationRequest">>,
): OrderStep[] {
  if (!order.canUpdate) return [];
  // Con una cancelación por aprobar el pedido no cambia (SPEC-013).
  if (order.pendingCancellationRequest) return [];

  if (order.status === "OPEN" || order.status === "UNKNOWN") {
    return [sent("NO_STATUS", "Enviado")];
  }

  if (order.status !== "SENT") return [];

  switch (order.sentSubstatus) {
    case "ASSIGNED":
      return [
        sent("SCHEDULED", "Agendado"),
        sent("DELIVERED", "Entregado"),
        sent("NOT_DELIVERED", "No entregado"),
      ];
    case "SCHEDULED":
      return [
        sent("DELIVERED", "Entregado"),
        sent("NOT_DELIVERED", "No entregado"),
        sent("REJECTED", "Rechazado"),
      ];
    case "NOT_DELIVERED":
      return [
        sent("SCHEDULED", "Agendado"),
        sent("DELIVERED", "Entregado"),
        sent("REJECTED", "Rechazado"),
      ];
    case "REJECTED":
      return [
        sent("SCHEDULED", "Agendado"),
        sent("DELIVERED", "Entregado"),
      ];
    case "DELIVERED":
      // Entregado: al asesor no le queda nada; supervisión cierra al activar.
      return order.canClose
        ? [{ label: "Cerrar: ya activó", status: "CLOSED", sentSubstatus: null }]
        : [];
    default:
      return [
        sent("ASSIGNED", "Asignado"),
        sent("SCHEDULED", "Agendado"),
        sent("DELIVERED", "Entregado"),
        sent("NOT_DELIVERED", "No entregado"),
      ];
  }
}

/**
 * SPEC-074: un toque guarda y, en escritorio, pasa al pedido de abajo. La
 * nota es la misma observación de siempre: se envía con el paso para no
 * borrarla, y se puede cambiar antes de tocar.
 *
 * SPEC-084: el paso al siguiente lo decide el padre al tocar (`onStepStart`),
 * no al terminar: `revalidatePath` trae los datos nuevos en la misma
 * respuesta y este componente se vuelve a montar (o sale de la vista) antes
 * de poder avisar. Si el guardado falla, `onStepFailed` lo anula.
 */
export function OrderNextStep({
  order,
  onStepStart,
  onStepFailed,
}: {
  order: OrderInboxItem;
  onStepStart?: () => void;
  onStepFailed?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateOrderStatusAction,
    initialActionState,
  );
  const savedNote = order.deliveryObservation ?? "";
  const [note, setNote] = useState(savedNote);
  const [chosen, setChosen] = useState<string | null>(null);
  // SPEC-084: cerrar no se deshace; pide un segundo toque, como en bloque.
  const [confirmingClose, setConfirmingClose] = useState(false);
  const handled = useRef<OrderStatusActionState | null>(null);
  const steps = getOrderSteps(order);

  useEffect(() => {
    if (state.type !== "error" || handled.current === state) return;
    handled.current = state;
    onStepFailed?.();
  }, [state, onStepFailed]);

  // La nota se puede guardar sola, sin mover el pedido (SPEC-084).
  const canSaveNote =
    order.canUpdate &&
    !order.pendingCancellationRequest &&
    (order.status === "OPEN" || order.status === "SENT") &&
    note.trim() !== savedNote.trim();

  function submit(
    status: string,
    sentSubstatus: string | null,
    label: string,
    advance: boolean,
  ) {
    const data = new FormData();
    data.set("orderId", order.id);
    data.set("status", status);
    if (sentSubstatus) data.set("sentSubstatus", sentSubstatus);
    data.set("observation", note);
    setChosen(label);
    if (advance) onStepStart?.();
    startTransition(() => formAction(data));
  }

  function save(step: OrderStep) {
    if (step.status === "CLOSED" && !confirmingClose) {
      setConfirmingClose(true);
      return;
    }
    setConfirmingClose(false);
    submit(step.status, step.sentSubstatus, step.label, true);
  }

  const notice = order.pendingCancellationRequest
    ? "Cancelación pedida: el pedido queda como está hasta que la revisen."
    : order.status === "SENT" && order.sentSubstatus === "DELIVERED" && steps.length === 0
      ? "Entregado. Falta que el operador active la línea."
      : null;
  const showNote =
    order.canUpdate &&
    !order.pendingCancellationRequest &&
    (order.status === "OPEN" || order.status === "SENT");

  if (steps.length === 0 && !showNote) {
    return notice ? <p className="text-sm text-ui-muted">{notice}</p> : null;
  }

  return (
    <div className="space-y-3">
      {notice ? <p className="text-sm text-ui-muted">{notice}</p> : null}

      {steps.length > 0 ? (
        <div
          aria-label="¿En qué va?"
          className="flex flex-wrap gap-2"
          role="group"
        >
          {steps.map((step) => (
            <button
              className="rounded-lg border border-ui-border-strong bg-ui-surface px-3 py-2 text-sm font-semibold text-ui-text transition hover:border-ui-accent hover:bg-ui-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent disabled:cursor-wait disabled:opacity-60"
              disabled={pending}
              key={step.label}
              onClick={() => save(step)}
              type="button"
            >
              {pending && chosen === step.label
                ? "Guardando…"
                : step.status === "CLOSED" && confirmingClose
                  ? "Sí, cerrar: no se puede deshacer"
                  : step.label}
            </button>
          ))}
          {confirmingClose ? (
            <button
              className="rounded-lg px-3 py-2 text-sm text-ui-muted hover:bg-ui-subtle"
              onClick={() => setConfirmingClose(false)}
              type="button"
            >
              Volver
            </button>
          ) : null}
        </div>
      ) : null}

      {showNote ? (
        <label className="block space-y-1 text-xs text-ui-muted">
          <span>Nota</span>
          <textarea
            className="min-h-16 w-full rounded-lg border border-ui-border-strong bg-ui-surface px-3 py-2 text-sm text-ui-text"
            disabled={pending}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Qué pasó o qué se acordó con el cliente"
            value={note}
          />
        </label>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          aria-live="polite"
          className={
            state.type === "error"
              ? "text-sm text-ui-danger"
              : "text-xs text-ui-muted"
          }
        >
          {state.type === "error"
            ? state.message
            : onStepStart && steps.length > 0
              ? "Guarda y pasa al siguiente."
              : null}
        </p>
        {canSaveNote ? (
          <button
            className="rounded-lg border border-ui-border-strong px-3 py-1.5 text-xs font-semibold text-ui-text hover:border-ui-accent disabled:opacity-60"
            disabled={pending}
            onClick={() =>
              submit(order.status, order.sentSubstatus, "Guardar nota", false)
            }
            type="button"
          >
            {pending && chosen === "Guardar nota" ? "Guardando…" : "Guardar nota"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
