"use client";

import { useActionState, useState } from "react";

import { formatCount } from "@repo/ui/format";
import { InlineFeedback } from "@repo/ui/feedback";
import { baseRecoveryPoolTakeLimit } from "@repo/validation";

import { Button } from "@/components/ui/button";

import { takeRecoveryPoolBlockAction } from "../server/take-recovery-pool-block-action";

import type { RecoveryTriageActionState } from "../server/recovery-action.types";

const initialState: RecoveryTriageActionState = {
  type: "idle",
  message: "",
};

const fieldClass =
  "block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent";

/**
 * Tomar casos libres (SPEC-065 BR-012): una línea con cuántos hay y el botón.
 * Lo habitual es tomar el bloque completo; elegir departamento, plan o
 * cantidad queda en «Elegir cuáles». Antes el bloque ocupaba media pantalla
 * encima del trabajo, con dos textos que decían casi lo mismo.
 */
export function TakePoolBlockForm({
  departments,
  poolCount,
  teamName,
}: {
  departments: string[];
  poolCount: number;
  teamName: string;
}) {
  const [state, formAction, pending] = useActionState(
    takeRecoveryPoolBlockAction,
    initialState,
  );
  const [blockSize, setBlockSize] = useState(String(baseRecoveryPoolTakeLimit));
  const parsed = Number.parseInt(blockSize, 10);
  const shown = Number.isNaN(parsed)
    ? baseRecoveryPoolTakeLimit
    : Math.min(baseRecoveryPoolTakeLimit, Math.max(1, parsed));
  const canTake = poolCount > 0;

  return (
    <form
      action={formAction}
      aria-label="Tomar casos libres"
      className="grid gap-2 rounded-lg border border-ui-border bg-ui-surface p-4 text-sm"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-ui-muted">
          <strong className="text-ui-text">{formatCount(poolCount)}</strong>{" "}
          {poolCount === 1 ? "caso libre" : "casos libres"} en {teamName}
        </p>
        {canTake ? (
          <Button disabled={pending} size="sm" type="submit">
            {pending ? "Tomando…" : `Tomar ${shown} ${shown === 1 ? "caso" : "casos"}`}
          </Button>
        ) : null}
      </div>

      {canTake ? (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-ui-accent">
            Elegir cuáles
          </summary>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="ui-label-eyebrow">Departamento</span>
              <select className={fieldClass} defaultValue="" name="department">
                <option value="">Todos</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="ui-label-eyebrow">Plan contiene</span>
              <input
                className={`${fieldClass} w-36`}
                maxLength={100}
                name="plan"
                placeholder="49.9"
              />
            </label>
            <label className="block">
              <span className="ui-label-eyebrow">
                Cantidad (máx. {baseRecoveryPoolTakeLimit})
              </span>
              <input
                className={`${fieldClass} w-24`}
                inputMode="numeric"
                name="blockSize"
                onChange={(event) => setBlockSize(event.target.value)}
                value={blockSize}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-ui-muted">
            Recibes los más recientes que cumplan tu filtro; primero los que ya
            pueden portar. Nadie más puede tomar los mismos casos.
          </p>
        </details>
      ) : null}

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
