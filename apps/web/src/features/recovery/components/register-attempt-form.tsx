"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { attemptResultChoiceLabels } from "../attempt-result-labels";

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

const resultLabels = attemptResultChoiceLabels;

export function RegisterAttemptForm({
  caseId,
  returnTo,
}: {
  caseId: string;
  /**
   * Adónde vuelve el asesor al registrar el intento. En campañas es su cola:
   * la llamada terminó y lo que sigue es el próximo caso, no quedarse en la
   * ficha del que acaba de gestionar. Sin este dato el formulario se queda
   * donde está, que es lo correcto en recupero de ventas.
   */
  returnTo?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    registerRecoveryAttemptAction,
    initialState,
  );
  const [result, setResult] = useState("SIN_RESPUESTA");

  // El mensaje de éxito lleva información operativa —cuántos intentos van hoy,
  // si la cadencia se agotó— así que viaja a la cola en vez de perderse con la
  // navegación.
  useEffect(() => {
    if (!returnTo || state.type !== "success") return;

    // `returnTo` puede traer ya la búsqueda, los filtros, la página y el
    // ancla del caso (BR-089): el aviso se suma a eso, no lo pisa.
    const destino = new URL(returnTo, window.location.origin);
    destino.searchParams.set("intento", state.message);
    router.push(`${destino.pathname}${destino.search}${destino.hash}`);
  }, [returnTo, router, state, state.message, state.type]);

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
