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
    <form action={formAction} className="space-y-2">
      <div className="ui-form-row">
        <label className="ui-form-row__grow">
          <span className="ui-label-eyebrow">Archivo · XLSX o CSV</span>
          <input
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="ui-file-input"
            disabled={pending}
            name="file"
            required
            type="file"
          />
        </label>
        <Button disabled={pending} type="submit">
          {pending ? "Analizando…" : "Generar vista previa"}
        </Button>
      </div>

      <InlineFeedback
        message={state.message}
        tone={state.type === "error" ? "danger" : "neutral"}
      />
    </form>
  );
}
