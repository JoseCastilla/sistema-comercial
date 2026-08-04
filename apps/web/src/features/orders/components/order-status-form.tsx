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

    label: "Sin estado",
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
  canUpdate,
}: {
  orderId: string;

  initialStatus: string;

  initialSentSubstatus: string | null;

  initialObservation: string | null;

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

  useEffect(() => {
    if (!showSubstatus) {
      setSentSubstatus("");
    }
  }, [showSubstatus]);

  if (!canUpdate) {
    return (
      <p className="text-sm text-neutral-500">
        No tienes permiso para modificar esta orden.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input name="orderId" type="hidden" value={orderId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-neutral-800">Estado</span>

          <select
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
            disabled={pending}
            name="status"
            onChange={(event) => {
              setStatus(event.target.value);
            }}
            required
            value={status}
          >
            <option value="">Seleccionar</option>

            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {actionState.fieldErrors?.status ? (
            <span className="text-xs text-red-600">
              {actionState.fieldErrors.status}
            </span>
          ) : null}
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-neutral-800">
            Subestado de Enviado
          </span>

          <select
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 disabled:bg-neutral-100"
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
            <span className="text-xs text-red-600">
              {actionState.fieldErrors.sentSubstatus}
            </span>
          ) : null}
        </label>
      </div>

      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-neutral-800">Observación</span>

        <textarea
          className="min-h-24 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
          defaultValue={initialObservation ?? ""}
          disabled={pending}
          maxLength={2000}
          name="observation"
          placeholder="Motivo, incidencia o acción realizada"
        />

        {actionState.fieldErrors?.observation ? (
          <span className="text-xs text-red-600">
            {actionState.fieldErrors.observation}
          </span>
        ) : null}
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          aria-live="polite"
          className={
            actionState.type === "error"
              ? "text-sm text-red-600"
              : actionState.type === "success"
                ? "text-sm text-emerald-700"
                : "text-sm text-neutral-500"
          }
        >
          {actionState.message}
        </p>

        <button
          className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending || !status}
          type="submit"
        >
          {pending ? "Guardando..." : "Guardar estado"}
        </button>
      </div>
    </form>
  );
}
