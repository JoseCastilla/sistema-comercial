"use client";

import { useActionState, useState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { rescheduleCommitmentAction } from "../server/reschedule-commitment-action";

import type { SendOrderToRecoveryActionState } from "../server/recovery-action.types";

const initialState: SendOrderToRecoveryActionState = {
  type: "idle",
  message: "",
};

/**
 * Reprogramar una cita desde la agenda — SPEC-048 BR-008. Los campos no se
 * limpian ante un error: lo escrito sigue ahí para corregir y reenviar. La
 * clave de idempotencia nace con el formulario y se renueva solo tras un
 * envío que sí quedó guardado.
 */
export function RescheduleCommitmentForm({
  commitmentId,
}: {
  commitmentId: string;
}) {
  const [state, formAction, pending] = useActionState(
    rescheduleCommitmentAction,
    initialState,
  );
  const [clientRequestId] = useState(() => crypto.randomUUID());

  return (
    <form action={formAction} className="space-y-3">
      <input name="commitmentId" type="hidden" value={commitmentId} />
      <input name="clientRequestId" type="hidden" value={clientRequestId} />
      <label className="block text-sm">
        <span className="ui-label-eyebrow">Nueva fecha y hora acordadas</span>
        <input
          className="mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
          name="scheduledAt"
          required
          type="datetime-local"
        />
      </label>
      <label className="block text-sm">
        <span className="ui-label-eyebrow">Por qué se reprograma</span>
        <input
          className="mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
          maxLength={500}
          name="reason"
          placeholder="El cliente pidió otra hora"
          required
          type="text"
        />
      </label>
      <p className="text-xs leading-5 text-ui-muted">
        Reprogramar no es una llamada: no suma intentos. La cita anterior
        queda en el historial con este motivo.
      </p>
      <Button disabled={pending || state.type === "success"} type="submit">
        Reprogramar
      </Button>
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
