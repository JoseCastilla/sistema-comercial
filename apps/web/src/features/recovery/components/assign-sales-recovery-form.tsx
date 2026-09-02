"use client";

import { useActionState } from "react";

import { assignSalesRecoveryCaseAction } from "../server/assign-sales-recovery-case-action";

import type { SendOrderToRecoveryActionState } from "../server/recovery-action.types";

const initialState: SendOrderToRecoveryActionState = {
  type: "idle",
  message: "",
};

export function AssignSalesRecoveryForm({
  caseId,
  advisors,
  blockedAdvisorId,
  hasAssignee,
}: {
  caseId: string;
  advisors: Array<{ id: string; name: string; teamName: string }>;
  /** BR-065: en una Crítica, el originador ni siquiera aparece como opción. */
  blockedAdvisorId: string | null;
  hasAssignee: boolean;
}) {
  const [state, action, pending] = useActionState(
    assignSalesRecoveryCaseAction,
    initialState,
  );
  const options = advisors.filter((advisor) => advisor.id !== blockedAdvisorId);

  if (options.length === 0) return null;

  return (
    <form action={action} className="mt-1 flex flex-wrap items-center gap-1.5">
      <input name="caseId" type="hidden" value={caseId} />
      <select
        aria-label="Asesor destino"
        className="max-w-44 rounded-md border border-ui-border bg-ui-surface px-2 py-1 text-xs"
        defaultValue=""
        name="targetUserId"
        required
      >
        <option disabled value="">
          {hasAssignee ? "Reasignar a…" : "Asignar a…"}
        </option>
        {options.map((advisor) => (
          <option key={advisor.id} value={advisor.id}>
            {advisor.name} · {advisor.teamName}
          </option>
        ))}
      </select>
      <button
        className="rounded-md bg-ui-accent px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "…" : "Asignar"}
      </button>
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
