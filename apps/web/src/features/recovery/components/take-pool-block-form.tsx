"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { takeRecoveryPoolBlockAction } from "../server/take-recovery-pool-block-action";

import type { RecoveryTriageActionState } from "../server/recovery-action.types";

const initialState: RecoveryTriageActionState = {
  type: "idle",
  message: "",
};

export function TakePoolBlockForm({
  departments,
}: {
  departments: string[];
}) {
  const [state, formAction, pending] = useActionState(
    takeRecoveryPoolBlockAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ui-muted">
            Departamento
          </span>
          <select
            className="block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
            defaultValue=""
            name="department"
          >
            <option value="">Todos</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ui-muted">
            Plan contiene
          </span>
          <input
            className="block w-36 rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
            maxLength={100}
            name="plan"
            placeholder="49.9"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ui-muted">
            Cantidad (máx. 10)
          </span>
          <input
            className="block w-24 rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
            defaultValue="10"
            inputMode="numeric"
            name="blockSize"
          />
        </label>
        <Button disabled={pending} type="submit">
          {pending ? "Tomando…" : "Tomar casos"}
        </Button>
      </div>
      <p className="text-xs leading-5 text-ui-muted">
        Recibes los casos más recientes que cumplan tu filtro; primero los que
        ya pueden portar. Nadie más puede tomar los mismos casos.
      </p>
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
