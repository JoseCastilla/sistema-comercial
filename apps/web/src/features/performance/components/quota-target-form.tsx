"use client";

import { useActionState } from "react";

import { assignPerformanceQuotaAction } from "../server/assign-performance-quota-action";

import type { QuotaActionState } from "../server/assign-performance-quota-action";

const initialState: QuotaActionState = { type: "idle", message: "" };

export function QuotaTargetForm({
  scope,
  targetId,
  window,
  period,
  target,
  isDefault,
  disabled,
}: {
  scope: "TEAM" | "USER";
  targetId: string;
  window: string;
  period: string;
  target: number;
  isDefault: boolean;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    assignPerformanceQuotaAction,
    initialState,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input name="scope" type="hidden" value={scope} />
      <input name="targetId" type="hidden" value={targetId} />
      <input name="window" type="hidden" value={window} />
      <input name="period" type="hidden" value={period} />
      <input
        aria-label="Cuota de portabilidades entregadas"
        className="w-20 rounded-md border border-ui-border bg-ui-surface px-2 py-1 text-sm"
        defaultValue={target}
        disabled={disabled}
        max={9999}
        min={0}
        name="target"
        type="number"
      />
      {disabled ? null : (
        <button
          className="rounded-md border border-ui-border bg-ui-surface px-2.5 py-1 text-xs font-semibold text-ui-text disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "…" : "Guardar"}
        </button>
      )}
      {isDefault ? (
        <span className="text-xs text-ui-muted">por defecto</span>
      ) : null}
      {state.type !== "idle" ? (
        <span
          aria-live="polite"
          className={
            state.type === "success"
              ? "w-full text-xs font-medium text-ui-success"
              : "w-full text-xs font-medium text-ui-danger"
          }
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
