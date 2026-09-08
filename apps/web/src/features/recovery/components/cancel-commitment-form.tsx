"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { cancelCommitmentAction } from "../server/cancel-commitment-action";

import type { SendOrderToRecoveryActionState } from "../server/recovery-action.types";

const initialState: SendOrderToRecoveryActionState = {
  type: "idle",
  message: "",
};

/**
 * Cancelar una cita y decir qué sigue — SPEC-048 BR-009. El caso nunca
 * queda sin próxima acción: vuelve a la cola de hoy o se pausa uno o dos
 * días. Para acordar otra hora, se reprograma.
 */
export function CancelCommitmentForm({
  commitmentId,
}: {
  commitmentId: string;
}) {
  const [state, formAction, pending] = useActionState(
    cancelCommitmentAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="commitmentId" type="hidden" value={commitmentId} />
      <label className="block text-sm">
        <span className="ui-label-eyebrow">Por qué se cancela</span>
        <input
          className="mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
          maxLength={500}
          name="reason"
          placeholder="El cliente ya no quiere que lo llamen a esa hora"
          required
          type="text"
        />
      </label>
      <fieldset className="space-y-1 text-sm">
        <legend className="ui-label-eyebrow">Qué sigue con el caso</legend>
        <label className="flex items-center gap-2">
          <input defaultChecked name="nextAction" type="radio" value="RESUME_TODAY" />
          Volver a intentar hoy
        </label>
        <label className="flex items-center gap-2">
          <input name="nextAction" type="radio" value="PAUSE_1D" />
          Pausar 1 día
        </label>
        <label className="flex items-center gap-2">
          <input name="nextAction" type="radio" value="PAUSE_2D" />
          Pausar 2 días
        </label>
      </fieldset>
      <Button
        disabled={pending || state.type === "success"}
        type="submit"
        variant="danger"
      >
        Cancelar la cita
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
