"use client";

import { useActionState, useState } from "react";

import { reviewOrderCancellationAction } from "../server/review-order-cancellation-action";

import type { OrderCancellationActionState } from "../server/order-cancellation-action.types";
import type { OrderInboxItem } from "../order-inbox.types";

const initialState: OrderCancellationActionState = {
  type: "idle",
  message: "",
};

export function OrderCancellationRequestPanel({
  request,
  canReview,
}: {
  request: NonNullable<OrderInboxItem["pendingCancellationRequest"]>;
  canReview: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    reviewOrderCancellationAction,
    initialState,
  );
  const [decision, setDecision] = useState("");
  const rejecting = decision === "REJECT";

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-amber-950">
            Cancelación pendiente
          </h4>
          <p className="mt-1 text-xs text-amber-800">
            {request.requestedByName} · {request.requestedAtLabel}
          </p>
        </div>

        <span className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900">
          Requiere revisión
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-amber-950">{request.reason}</p>

      {canReview ? (
        <form
          action={formAction}
          className="mt-4 border-t border-amber-200 pt-4"
        >
          <input name="requestId" type="hidden" value={request.id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-amber-950">Decisión</span>
              <select
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-neutral-900"
                disabled={pending}
                name="decision"
                onChange={(event) => setDecision(event.target.value)}
                required
                value={decision}
              >
                <option value="">Seleccionar</option>
                <option value="APPROVE">Aprobar cancelación</option>
                <option value="REJECT">Rechazar solicitud</option>
              </select>
              {state.fieldErrors?.decision ? (
                <span className="text-xs text-red-700">
                  {state.fieldErrors.decision}
                </span>
              ) : null}
            </label>

            {rejecting ? (
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-amber-950">
                  Motivo del rechazo
                </span>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-neutral-900"
                  disabled={pending}
                  maxLength={2000}
                  minLength={10}
                  name="observation"
                  placeholder="Explica por qué la venta continúa vigente"
                  required
                />
                {state.fieldErrors?.observation ? (
                  <span className="text-xs text-red-700">
                    {state.fieldErrors.observation}
                  </span>
                ) : null}
              </label>
            ) : (
              <input name="observation" type="hidden" value="" />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p
              aria-live="polite"
              className={
                state.type === "error" || state.type === "conflict"
                  ? "text-sm text-red-700"
                  : "text-sm text-emerald-800"
              }
            >
              {state.message}
            </p>

            <button
              className="rounded-lg bg-amber-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pending || !decision}
              type="submit"
            >
              {pending ? "Guardando..." : "Confirmar decisión"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-amber-900">
          La orden continuará activa hasta que un responsable revise la
          solicitud.
        </p>
      )}
    </section>
  );
}
