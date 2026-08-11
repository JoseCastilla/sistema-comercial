"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { confirmDitoImportAction } from "../server/confirm-dito-import-action";

import type { DitoImportAdminActionState } from "../server/dito-import-action.types";

const initialState: DitoImportAdminActionState = {
  type: "idle",
  message: "",
};

export function ConfirmDitoImportForm({
  batchId,
  expectedUpdatedAt,
  disabledReason,
}: {
  batchId: string;
  expectedUpdatedAt: string;
  disabledReason: string | null;
}) {
  const [state, action, pending] = useActionState(
    confirmDitoImportAction,
    initialState,
  );

  return (
    <form action={action} className="ui-form-stack">
      <input name="batchId" type="hidden" value={batchId} />
      <input name="expectedUpdatedAt" type="hidden" value={expectedUpdatedAt} />

      {disabledReason ? (
        <p className="text-sm leading-6 text-ui-warning">{disabledReason}</p>
      ) : (
        <p className="text-sm leading-6 text-ui-muted">
          Esta acción creará ventas nuevas y completará únicamente campos
          ausentes. No sobrescribirá conflictos.
        </p>
      )}

      <InlineFeedback
        message={state.message}
        tone={state.type === "success" ? "success" : "danger"}
      />

      <Button
        disabled={pending || Boolean(disabledReason)}
        fullWidth
        type="submit"
      >
        {pending ? "Confirmando importación..." : "Confirmar importación"}
      </Button>
    </form>
  );
}
