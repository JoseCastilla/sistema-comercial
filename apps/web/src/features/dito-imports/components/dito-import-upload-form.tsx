"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { createDitoImportPreviewAction } from "../server/create-dito-import-preview-action";

import type { DitoImportPreviewActionState } from "../server/dito-import-action.types";

const initialState: DitoImportPreviewActionState = {
  type: "idle",
  message: "",
};

export function DitoImportUploadForm() {
  const [state, formAction, pending] = useActionState(
    createDitoImportPreviewAction,
    initialState,
  );

  return (
    <form action={formAction} className="ui-form-stack">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-neutral-800">
          Archivo de la bandeja DITO
        </span>

        <input
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full cursor-pointer rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:font-medium file:text-white hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          disabled={pending}
          name="file"
          required
          type="file"
        />
      </label>

      <p className="text-xs leading-5 text-neutral-500">
        Máximo 10 MB. Analizar el archivo no crea ni modifica pedidos.
      </p>

      <InlineFeedback
        message={state.message}
        tone={state.type === "error" ? "danger" : "neutral"}
      />

      <Button disabled={pending} fullWidth type="submit">
        {pending ? "Analizando archivo..." : "Generar vista previa"}
      </Button>
    </form>
  );
}
