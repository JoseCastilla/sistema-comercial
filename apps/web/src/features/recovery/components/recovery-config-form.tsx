"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { updateRecoveryConfigAction } from "../server/update-recovery-config-action";

import type { RecoveryAdminActionState } from "../server/recovery-action.types";

const initialState: RecoveryAdminActionState = {
  type: "idle",
  message: "",
};

const textareaClassName =
  "block w-full rounded-xl border border-ui-border-strong bg-ui-surface px-3 py-2 font-mono text-xs text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent focus:ring-offset-2";

function ListField({
  label,
  name,
  defaultValue,
  rows,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string[];
  rows: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ui-text">
        {label}
      </span>
      <textarea
        className={textareaClassName}
        defaultValue={defaultValue.join("\n")}
        name={name}
        rows={rows}
      />
      {hint ? <span className="mt-1 block text-xs text-ui-muted">{hint}</span> : null}
    </label>
  );
}

export function RecoveryConfigForm({
  modalities,
  planNames,
  equipmentNames,
  carrierNames,
}: {
  modalities: string[];
  planNames: string[];
  equipmentNames: string[];
  carrierNames: string[];
}) {
  const [state, formAction, pending] = useActionState(
    updateRecoveryConfigAction,
    initialState,
  );

  return (
    <form action={formAction} className="ui-form-stack">
      <ListField
        defaultValue={modalities}
        label="Modalidades permitidas"
        name="modalities"
        rows={2}
      />
      <ListField
        defaultValue={planNames}
        hint="Un plan por línea, tal como aparece en la columna Plan Móvil."
        label="Planes elegibles"
        name="planNames"
        rows={5}
      />
      <ListField
        defaultValue={equipmentNames}
        hint="Cuando el canal habilite equipos, agrega aquí los modelos permitidos."
        label="Equipos permitidos"
        name="equipmentNames"
        rows={2}
      />
      <ListField
        defaultValue={carrierNames}
        hint="El código 27 corresponde a Guinea Mobile S.A.C."
        label="Operadores cedentes válidos"
        name="carrierNames"
        rows={3}
      />

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

      <Button disabled={pending} fullWidth type="submit" variant="secondary">
        {pending ? "Guardando filtros..." : "Guardar filtros de elegibilidad"}
      </Button>
    </form>
  );
}
