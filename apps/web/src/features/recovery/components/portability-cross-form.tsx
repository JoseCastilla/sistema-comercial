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
    <form action={formAction} className="ui-form-stack">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ui-text">
          Reporte de portabilidad
        </span>

        <input
          accept=".csv,.txt,text/csv,text/plain"
          className="block w-full cursor-pointer rounded-xl border border-ui-border-strong bg-ui-surface px-3 py-3 text-sm text-ui-muted file:mr-3 file:rounded-lg file:border-0 file:bg-ui-strong file:px-3 file:py-2 file:font-medium file:text-ui-on-strong hover:border-ui-border-strong focus:outline-none focus:ring-2 focus:ring-ui-accent focus:ring-offset-2"
          disabled={pending}
          name="file"
          required
          type="file"
        />
      </label>

      <p className="text-xs leading-5 text-ui-muted">
        El reporte completo de <code>consulta.portabilidad.pe</code> se detecta
        por sus columnas y decide descartes, esperas y habilitaciones. Un cruce
        rápido con solo números se interpreta como líneas ya activas en
        Movistar y únicamente produce descartes.
      </p>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ui-text">
          Columna del número (solo para el cruce rápido)
        </span>
        <input
          className="block w-full rounded-xl border border-ui-border-strong bg-ui-surface px-3 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent focus:ring-offset-2"
          disabled={pending}
          name="quickColumn"
          placeholder="Se detecta sola si la columna se llama numero, telefono o linea"
          type="text"
        />
      </label>

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

      <Button disabled={pending} fullWidth type="submit">
        {pending ? "Cruzando portabilidad..." : "Aplicar cruce de portabilidad"}
      </Button>
    </form>
  );
}
