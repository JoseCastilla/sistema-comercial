"use client";

import { useActionState, useState } from "react";

import { resolveRecoveryCaseAction } from "../server/resolve-recovery-case-action";

import type { SendOrderToRecoveryActionState } from "../server/recovery-action.types";

const initialState: SendOrderToRecoveryActionState = {
  type: "idle",
  message: "",
};

const lossLabels: Record<string, string> = {
  YA_MIGRO_OTRA_AGENCIA: "Ya migró con otra agencia",
  RECHAZO_DEFINITIVO: "Rechazo definitivo",
  INUBICABLE: "Inubicable",
  DEUDA: "Deuda sin solución",
  DATOS_INVALIDOS: "Datos inválidos",
  NO_PORTABLE: "No portable",
  OTRO: "Otro (requiere supervisor)",
};

export function ResolveCaseForm({
  caseId,
  suggestions,
  canUseOther,
  gates,
}: {
  caseId: string;
  suggestions: Array<{
    id: string;
    orderCode: string;
    registeredAtLabel: string;
    status: string;
  }>;
  canUseOther: boolean;
  gates: Record<string, { enabled: boolean; missing: string | null }>;
}) {
  const [state, action, pending] = useActionState(
    resolveRecoveryCaseAction,
    initialState,
  );
  const [resolution, setResolution] = useState("RECOVERED");
  const [lossReason, setLossReason] = useState("YA_MIGRO_OTRA_AGENCIA");
  const selectedGate = gates[lossReason];
  const showExpressPath =
    lossReason === "RECHAZO_DEFINITIVO" && !gates.RECHAZO_DEFINITIVO?.enabled;

  return (
    <form action={action} className="space-y-3">
      <input name="caseId" type="hidden" value={caseId} />
      <label className="block text-sm font-medium text-ui-text">
        Resultado final
        <select
          className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
          name="resolution"
          onChange={(event) => setResolution(event.target.value)}
          value={resolution}
        >
          <option value="RECOVERED">Recuperado: hay una venta nueva</option>
          <option value="LOST">Perdido</option>
        </select>
      </label>

      {resolution === "RECOVERED" ? (
        <label className="block text-sm font-medium text-ui-text">
          Orden DITO que respalda la recuperación
          {suggestions.length > 0 ? (
            <select
              className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
              defaultValue=""
              name="recoveredOrderId"
              required
            >
              <option disabled value="">
                Elige la orden nueva del cliente…
              </option>
              {suggestions.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderCode} · {order.registeredAtLabel} ·{" "}
                  {order.status}
                </option>
              ))}
            </select>
          ) : (
            <span className="mt-1 block rounded-lg border border-ui-warning-border bg-ui-warning-soft px-3 py-2 text-xs font-normal text-ui-warning">
              El cliente aún no tiene una orden nueva posterior al caso. La
              recuperación se confirma cuando la venta reingresada exista en
              el sistema.
            </span>
          )}
        </label>
      ) : (
        <>
          <label className="block text-sm font-medium text-ui-text">
            Motivo de pérdida
            <select
              className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
              name="lossReason"
              onChange={(event) => setLossReason(event.target.value)}
              value={lossReason}
            >
              {Object.entries(lossLabels)
                .filter(([value]) => canUseOther || value !== "OTRO")
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {gates[value]?.enabled === false ? `⏳ ${label}` : label}
                  </option>
                ))}
            </select>
          </label>
          {selectedGate && !selectedGate.enabled && !showExpressPath ? (
            <p className="rounded-lg border border-ui-warning-border bg-ui-warning-soft px-3 py-2 text-xs text-ui-warning">
              {selectedGate.missing}
            </p>
          ) : null}
          {showExpressPath ? (
            <div className="space-y-2">
              <p className="rounded-lg border border-ui-warning-border bg-ui-warning-soft px-3 py-2 text-xs text-ui-warning">
                {gates.RECHAZO_DEFINITIVO?.missing}
              </p>
              <label className="flex items-start gap-2 text-sm font-medium text-ui-text">
                <input
                  className="mt-0.5"
                  name="expressRequest"
                  type="checkbox"
                />
                <span>
                  El cliente pidió expresamente no ser contactado de nuevo
                  <span className="block text-xs font-normal text-ui-muted">
                    Habilita el cierre de inmediato; la observación debe
                    registrar sus palabras.
                  </span>
                </span>
              </label>
            </div>
          ) : null}
          <label className="block text-sm font-medium text-ui-text">
            ¿Por qué se perdió?
            <textarea
              className="mt-1 min-h-20 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
              maxLength={2000}
              minLength={10}
              name="observation"
              required
            />
          </label>
        </>
      )}

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
        disabled={
          pending || (resolution === "RECOVERED" && suggestions.length === 0)
        }
        type="submit"
      >
        {pending ? "Resolviendo…" : "Resolver caso"}
      </button>
    </form>
  );
}
