"use client";

import { useActionState, useState } from "react";

import { registerRecoveryAttemptAction } from "../server/register-recovery-attempt-action";

import type { SendOrderToRecoveryActionState } from "../server/recovery-action.types";

const initialState: SendOrderToRecoveryActionState = {
  type: "idle",
  message: "",
};

const channelLabels: Record<string, string> = {
  LLAMADA: "Llamada",
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  PRESENCIAL: "Presencial",
  OTRO: "Otro",
};

const resultLabels: Record<string, string> = {
  SIN_RESPUESTA: "Sin respuesta",
  INTERESADO: "Interesado",
  INTERESADO_CON_PEDIDO: "Interesado · tiene pedido en curso",
  RECHAZA: "Rechaza (pausa 1–2 días)",
  AGENDA: "Agenda una próxima llamada",
  NUMERO_ERRADO: "Número errado",
  NO_CUMPLE_30D: "No cumple los 30 días de porta",
  YA_ACTIVO: "Ya está activo en Movistar (pasa a verificación)",
  DATOS_INVALIDOS: "Datos inválidos",
  VENDIDO: "Vendido: aceptó de nuevo",
};

export function RegisterAttemptForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(
    registerRecoveryAttemptAction,
    initialState,
  );
  const [result, setResult] = useState("SIN_RESPUESTA");

  return (
    <form action={action} className="space-y-3">
      <input name="caseId" type="hidden" value={caseId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-ui-text">
          Canal
          <select
            className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
            defaultValue="LLAMADA"
            name="channel"
          >
            {Object.entries(channelLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-ui-text">
          Resultado
          <select
            className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
            name="result"
            onChange={(event) => setResult(event.target.value)}
            value={result}
          >
            {Object.entries(resultLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {result === "AGENDA" ? (
        <label className="block text-sm font-medium text-ui-text">
          Fecha y hora acordadas con el cliente
          <input
            className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
            name="scheduledAt"
            required
            type="datetime-local"
          />
        </label>
      ) : null}
      {result === "RECHAZA" ? (
        <label className="block text-sm font-medium text-ui-text">
          Pausa antes de reintentar
          <select
            className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
            defaultValue="1"
            name="pauseDays"
          >
            <option value="1">1 día</option>
            <option value="2">2 días</option>
          </select>
        </label>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-ui-text">
          Teléfono utilizado
          <input
            className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
            maxLength={15}
            name="phoneUsed"
            placeholder="Opcional"
          />
        </label>
        <label className="text-sm font-medium text-ui-text">
          Observación
          <input
            className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
            maxLength={2000}
            name="observation"
            placeholder="Qué dijo el cliente"
          />
        </label>
      </div>
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
        {pending ? "Registrando…" : "Registrar intento"}
      </button>
    </form>
  );
}
