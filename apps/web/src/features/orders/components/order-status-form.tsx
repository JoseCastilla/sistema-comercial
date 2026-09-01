"use client";

import { useActionState, useEffect, useState } from "react";

import { updateOrderStatusAction } from "../server/update-order-status-action";

import type { OrderStatusActionState } from "../server/order-status-action.types";

const initialActionState: OrderStatusActionState = {
  type: "idle",

  message: "",
};

const statusOptions = [
  {
    value: "OPEN",

    label: "Abierto",
  },
  {
    value: "SENT",

    label: "Enviado",
  },
  {
    value: "CLOSED",

    label: "Cerrado",
  },
  {
    value: "CANCELLED",

    label: "Cancelado",
  },
] as const;

const sentSubstatusOptions = [
  {
    value: "NO_STATUS",

    label: "El operador aún no reporta",
  },
  {
    value: "ASSIGNED",

    label: "Asignado",
  },
  {
    value: "SCHEDULED",

    label: "Agendado",
  },
  {
    value: "NOT_DELIVERED",

    label: "No entregado",
  },
  {
    value: "REJECTED",

    label: "Rechazado",
  },
  {
    value: "DELIVERED",

    label: "Entregado",
  },
] as const;

export function OrderStatusForm({
  orderId,
  initialStatus,
  initialSentSubstatus,
  initialObservation,
  canClose,
  canCancelDirectly,
  canRequestCancellation,
  canUpdate,
}: {
  orderId: string;

  initialStatus: string;

  initialSentSubstatus: string | null;

  initialObservation: string | null;

  canClose: boolean;

  canCancelDirectly: boolean;

  canRequestCancellation: boolean;

  canUpdate: boolean;
}) {
  const [actionState, formAction, pending] = useActionState(
    updateOrderStatusAction,
    initialActionState,
  );

  const [status, setStatus] = useState(
    initialStatus === "UNKNOWN" ? "" : initialStatus,
  );

  const [sentSubstatus, setSentSubstatus] = useState(
    initialSentSubstatus ?? "",
  );

  const showSubstatus = status === "SENT";
  const requiresObservation = status === "CANCELLED";
  const requestsCancellation = status === "CANCELLED" && !canCancelDirectly;

  useEffect(() => {
    if (!showSubstatus) {
      setSentSubstatus("");
    }
  }, [showSubstatus]);

  if (!canUpdate) {
    return (
      <p className="text-sm text-ui-muted">
        No tienes permiso para modificar esta orden.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input name="orderId" type="hidden" value={orderId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-ui-text">Estado</span>

          <select
            className="w-full rounded-lg border border-ui-border-strong bg-ui-surface px-3 py-2 text-ui-text"
            disabled={pending}
            name="status"
            onChange={(event) => {
              setStatus(event.target.value);
            }}
            required
            value={status}
          >
            <option value="">Seleccionar</option>

            {statusOptions
              .filter((option) => {
                if (option.value === "CLOSED") return canClose;
                if (option.value === "CANCELLED") {
                  return canCancelDirectly || canRequestCancellation;
                }

                return true;
              })
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value === "CANCELLED" && !canCancelDirectly
                    ? "Solicitar cancelación"
                    : option.label}
                </option>
              ))}
          </select>

          {actionState.fieldErrors?.status ? (
            <span className="text-xs text-ui-danger">
              {actionState.fieldErrors.status}
            </span>
          ) : null}
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-ui-text">
            ¿En qué va la entrega?
          </span>

          <select
            className="w-full rounded-lg border border-ui-border-strong bg-ui-surface px-3 py-2 text-ui-text disabled:bg-ui-subtle"
            disabled={pending || !showSubstatus}
            name="sentSubstatus"
            onChange={(event) => {
              setSentSubstatus(event.target.value);
            }}
            required={showSubstatus}
            value={sentSubstatus}
          >
            <option value="">Seleccionar</option>

            {sentSubstatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {actionState.fieldErrors?.sentSubstatus ? (
            <span className="text-xs text-ui-danger">
              {actionState.fieldErrors.sentSubstatus}
            </span>
          ) : null}
        </label>
      </div>

      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-ui-text">
          Observación{requiresObservation ? " obligatoria" : ""}
        </span>

        <textarea
          className="min-h-24 w-full rounded-lg border border-ui-border-strong bg-ui-surface px-3 py-2 text-ui-text"
          defaultValue={initialObservation ?? ""}
          disabled={pending}
          maxLength={2000}
          minLength={requiresObservation ? 10 : undefined}
          name="observation"
          placeholder={
            requiresObservation
              ? requestsCancellation
                ? "Explica por qué solicitas cancelar la venta"
                : "Explica el motivo de la cancelación"
              : "Motivo, incidencia o acción realizada"
          }
          required={requiresObservation}
        />

        {actionState.fieldErrors?.observation ? (
          <span className="text-xs text-ui-danger">
            {actionState.fieldErrors.observation}
          </span>
        ) : null}
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          aria-live="polite"
          className={
            actionState.type === "error"
              ? "text-sm text-ui-danger"
              : actionState.type === "success"
                ? "text-sm text-ui-success"
                : "text-sm text-ui-muted"
          }
        >
          {actionState.message}
        </p>

        <button
          className="rounded-lg bg-ui-strong px-4 py-2 text-sm font-medium text-ui-on-strong disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending || !status}
          type="submit"
        >
          {pending
            ? "Guardando..."
            : requestsCancellation
              ? "Enviar solicitud"
              : "Guardar estado"}
        </button>
      </div>
    </form>
  );
}
