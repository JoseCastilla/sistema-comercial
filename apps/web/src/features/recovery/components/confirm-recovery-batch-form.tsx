"use client";

import { useActionState } from "react";

import { formatCount } from "@repo/ui/format";
import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { confirmRecoveryBaseAction } from "../server/confirm-recovery-base-action";

import type { RecoveryAdminActionState } from "../server/recovery-action.types";

const initialState: RecoveryAdminActionState = {
  type: "idle",
  message: "",
};

export function ConfirmRecoveryBatchForm({
  batchId,
  expectedUpdatedAt,
  eligibleRows,
}: {
  batchId: string;
  expectedUpdatedAt: string;
  eligibleRows: number;
}) {
  const [state, formAction, pending] = useActionState(
    confirmRecoveryBaseAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input name="batchId" type="hidden" value={batchId} />
      <input name="expectedUpdatedAt" type="hidden" value={expectedUpdatedAt} />

      {state.type !== "success" ? (
        <Button disabled={pending} type="submit">
          {pending
            ? "Creando casos…"
            : `Confirmar y crear ${formatCount(eligibleRows)} casos`}
        </Button>
      ) : null}

      <InlineFeedback
        message={state.message}
        tone={
          state.type === "error" || state.type === "conflict"
            ? "danger"
            : state.type === "success"
              ? "success"
              : "neutral"
        }
      />
    </form>
  );
}
