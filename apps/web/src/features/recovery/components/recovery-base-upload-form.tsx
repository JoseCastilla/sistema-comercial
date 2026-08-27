"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { createRecoveryBasePreviewAction } from "../server/create-recovery-base-preview-action";

import type { RecoveryPreviewActionState } from "../server/recovery-action.types";

const initialState: RecoveryPreviewActionState = {
  type: "idle",
  message: "",
};

export function RecoveryBaseUploadForm() {
  const [state, formAction, pending] = useActionState(
    createRecoveryBasePreviewAction,
    initialState,
  );

  return (
    <form action={formAction} className="ui-form-stack">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ui-text">
          Base consolidada del día
        </span>

        <input
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full cursor-pointer rounded-xl border border-ui-border-strong bg-ui-surface px-3 py-3 text-sm text-ui-muted file:mr-3 file:rounded-lg file:border-0 file:bg-ui-strong file:px-3 file:py-2 file:font-medium file:text-ui-on-strong hover:border-ui-border-strong focus:outline-none focus:ring-2 focus:ring-ui-accent focus:ring-offset-2"
          disabled={pending}
          name="file"
          required
          type="file"
        />
      </label>

      <p className="text-xs leading-5 text-ui-muted">
        Máximo 25 MB. Analizar el archivo no crea casos: primero verás la vista
        previa con elegibles, excluidos e inválidos.
      </p>

      <InlineFeedback
        message={state.message}
        tone={state.type === "error" ? "danger" : "neutral"}
      />

      <Button disabled={pending} fullWidth type="submit">
        {pending ? "Analizando base..." : "Generar vista previa"}
      </Button>
    </form>
  );
}
