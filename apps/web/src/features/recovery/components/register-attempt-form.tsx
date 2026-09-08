"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  previewRecoveryAttemptConsequence,
  recoveryAttemptChoices,
  recoveryAttemptFields,
} from "@repo/validation";

import { registerRecoveryAttemptAction } from "../server/register-recovery-attempt-action";
import {
  AttemptResultFields,
  emptyAttemptExtras,
  type AttemptExtras,
} from "./attempt-result-fields";

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

/**
 * Registro de un intento desde la ficha — SPEC-030 BR-035; SPEC-049 BR-009
 * a BR-011. Sin resultado preseleccionado; los campos aparecen según el
 * resultado; la consecuencia se lee antes de guardar.
 */
export function RegisterAttemptForm({
  caseId,
  returnTo,
  serviceNumbers = [],
  phoneOptions = [],
}: {
  caseId: string;
  /**
   * Adónde vuelve el asesor al registrar el intento. En campañas es su cola:
   * la llamada terminó y lo que sigue es el próximo caso, no quedarse en la
   * ficha del que acaba de gestionar. Sin este dato el formulario se queda
   * donde está, que es lo correcto en recupero de ventas.
   */
  returnTo?: string;
  /** Líneas activas del caso, para «no cumple antigüedad». */
  serviceNumbers?: string[];
  /** Teléfonos válidos, para calcular qué queda si uno resulta errado. */
  phoneOptions?: string[];
}) {
  const router = useRouter();
  const ids = useId();
  const [state, action, pending] = useActionState(
    registerRecoveryAttemptAction,
    initialState,
  );
  const [result, setResult] = useState("");
  const [phoneUsed, setPhoneUsed] = useState("");
  const [extras, setExtras] = useState<AttemptExtras>(emptyAttemptExtras);

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

  const observationRequired = recoveryAttemptFields(result).required.includes(
    "observation",
  );
  const preview = previewRecoveryAttemptConsequence({
    result,
    reason: extras.reason,
    pauseDays: extras.pauseDays === "2" ? 2 : 1,
    scheduledAtRaw:
      result === "AGENDA" || extras.interestedNext === "cita"
        ? extras.scheduledAt
        : "",
    followUpDate:
      result === "IMPEDIMENTO" || extras.interestedNext === "seguimiento"
        ? extras.followUpDate
        : "",
    reportedDate: extras.reportedDate,
    needsSupervisor: extras.needsSupervisor,
    phoneUsed: phoneUsed || null,
    validPhonesLeft: phoneOptions.filter((phone) => phone !== phoneUsed).length,
  });

  return (
    <form action={action} className="space-y-3">
      <input name="caseId" type="hidden" value={caseId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-ui-text">
          Resultado
          <select
            className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
            name="result"
            onChange={(event) => setResult(event.target.value)}
            required
            value={result}
          >
            <option value="">Elige qué pasó…</option>
            {recoveryAttemptChoices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
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
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <AttemptResultFields
          extras={extras}
          idPrefix={ids}
          onChange={(next) => setExtras((current) => ({ ...current, ...next }))}
          result={result}
          serviceNumbers={serviceNumbers}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-ui-text">
          Teléfono utilizado
          <input
            className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
            list={`${ids}-phones`}
            maxLength={15}
            name="phoneUsed"
            onChange={(event) => setPhoneUsed(event.target.value.trim())}
            placeholder={result === "NUMERO_ERRADO" ? "El número errado" : "Opcional"}
            required={result === "NUMERO_ERRADO"}
            value={phoneUsed}
          />
          <datalist id={`${ids}-phones`}>
            {phoneOptions.map((phone) => (
              <option key={phone} value={phone} />
            ))}
          </datalist>
        </label>
        <label className="text-sm font-medium text-ui-text">
          {observationRequired ? "Qué dijo el cliente (obligatorio)" : "Observación"}
          <input
            className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
            maxLength={2000}
            name="observation"
            placeholder="Qué dijo el cliente"
            required={observationRequired}
          />
        </label>
      </div>
      {preview ? (
        <p className="text-sm text-ui-muted">
          <span className="ui-label-eyebrow">Al guardar</span> {preview}
        </p>
      ) : null}
      {state.type !== "idle" ? (
        <p
          aria-live="polite"
          className={`text-sm ${state.type === "error" ? "text-ui-danger" : "text-ui-success"}`}
        >
          {state.message}
        </p>
      ) : null}
      <button
        className="ui-button ui-button--primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Guardando…" : "Registrar intento"}
      </button>
    </form>
  );
}
