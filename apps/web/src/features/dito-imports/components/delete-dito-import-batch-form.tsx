"use client";

import { useActionState } from "react";

import { InlineFeedback } from "@repo/ui/feedback";

import { deleteDitoImportAction } from "../server/delete-dito-import-action";

import type { DitoImportAdminActionState } from "../server/dito-import-action.types";

const initialState: DitoImportAdminActionState = {
  type: "idle",
  message: "",
};

export function DeleteDitoImportBatchForm({
  batchId,
  expectedUpdatedAt,
  fileName,
}: {
  batchId: string;
  expectedUpdatedAt: string;
  fileName: string;
}) {
  const [state, action, pending] = useActionState(
    deleteDitoImportAction,
    initialState,
  );

  return (
    <form
      action={action}
      className="mt-2"
      onSubmit={(event) => {
        if (
          !window.confirm(
            `¿Eliminar la vista previa “${fileName}”? Esta acción no se puede deshacer.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input name="batchId" type="hidden" value={batchId} />
      <input name="expectedUpdatedAt" type="hidden" value={expectedUpdatedAt} />
      <button
        className="text-xs font-medium text-ui-danger underline-offset-4 hover:underline disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Eliminando…" : "Eliminar vista previa"}
      </button>
      <InlineFeedback
        message={state.message}
        tone={state.type === "success" ? "success" : "danger"}
      />
    </form>
  );
}
