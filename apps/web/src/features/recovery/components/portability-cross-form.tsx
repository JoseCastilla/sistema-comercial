"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { applyPortabilityAction } from "../server/apply-portability-action";

import type { RecoveryAdminActionState } from "../server/recovery-action.types";

const initialState: RecoveryAdminActionState = {
  type: "idle",
  message: "",
};

export function PortabilityCrossForm() {
  const [state, formAction, pending] = useActionState(
    applyPortabilityAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <div className="ui-form-row">
        <label className="ui-form-row__grow">
          <span className="ui-label-eyebrow">Reporte de la consulta</span>
          <input
            accept=".csv,.txt,text/csv,text/plain"
            className="ui-file-input"
            disabled={pending}
            name="file"
            required
            type="file"
          />
        </label>
        <label className="ui-form-row__fixed">
          <span className="ui-label-eyebrow">Columna · solo cruce rápido</span>
          <input
            className="block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
            disabled={pending}
            name="quickColumn"
            placeholder="Se detecta sola"
            type="text"
          />
        </label>
        <Button disabled={pending} type="submit">
          {pending ? "Cruzando…" : "Aplicar cruce"}
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
