"use client";

import { useActionState, useState } from "react";
import {
  correctableResults,
  noContactReasons,
  recoveryAttemptReasonLabels,
} from "@repo/validation";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { correctRecoveryAttemptAction } from "../server/correct-recovery-attempt-action";

import type { SendOrderToRecoveryActionState } from "../server/recovery-action.types";

const initialState: SendOrderToRecoveryActionState = {
  type: "idle",
  message: "",
};

const inputClass =
  "mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text";

/**
 * Rectificar un intento desde la ficha — SPEC-049 BR-017. Se abre junto al
 * intento; el original queda visible y tachado cuando se guarda. Lo escrito
 * se conserva ante error.
 */
export function CorrectAttemptForm({
  attemptId,
  originalLabel,
}: {
  attemptId: string;
  originalLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [effectiveResult, setEffectiveResult] = useState("");
  const [state, formAction, pending] = useActionState(
    correctRecoveryAttemptAction,
    initialState,
  );

  if (!open) {
    return (
      <button
        className="ui-row-toggle mt-1"
        onClick={() => setOpen(true)}
        type="button"
      >
        Rectificar
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-2 space-y-2 rounded-lg border border-ui-border-strong p-3"
    >
      <input name="attemptId" type="hidden" value={attemptId} />
      <p className="text-xs text-ui-muted">
        Registrado como <strong>{originalLabel}</strong>. El original se conserva;
        la rectificación queda con tu nombre y no cuenta como llamada nueva.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="ui-label-eyebrow">Resultado correcto</span>
          <select
            className={inputClass}
            name="effectiveResult"
            onChange={(event) => setEffectiveResult(event.target.value)}
            required
            value={effectiveResult}
          >
            <option value="">Elige…</option>
            {correctableResults.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {effectiveResult === "SIN_RESPUESTA" ? (
          <label className="block text-sm">
            <span className="ui-label-eyebrow">Por qué no contestó</span>
            <select className={inputClass} name="effectiveReason" defaultValue="">
              <option value="">No contesta</option>
              {noContactReasons
                .filter((reason) => reason !== "NO_CONTESTA")
                .map((reason) => (
                  <option key={reason} value={reason}>
                    {recoveryAttemptReasonLabels[reason]}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        <label className="block text-sm sm:col-span-2">
          <span className="ui-label-eyebrow">Por qué se rectifica</span>
          <input
            className={inputClass}
            maxLength={500}
            name="correctionReason"
            placeholder="Marqué no interesado por error; el cliente dijo que sí"
            required
            type="text"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="ui-label-eyebrow">Observación corregida (opcional)</span>
          <input className={inputClass} maxLength={2000} name="observation" type="text" />
        </label>
      </div>
      <p className="text-xs text-ui-muted">
        Para agendar, registrar antigüedad o un impedimento, registra un intento
        nuevo: necesitan datos que la rectificación no tiene.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={pending || state.type === "success"} type="submit">
          Rectificar
        </Button>
        <Button
          disabled={pending}
          onClick={() => setOpen(false)}
          type="button"
          variant="quiet"
        >
          Cerrar
        </Button>
      </div>
      <InlineFeedback
        message={state.message}
        tone={
          state.type === "error"
            ? "danger"
            : state.type === "success"
              ? "success"
              : "neutral"
        }
      />
    </form>
  );
}
