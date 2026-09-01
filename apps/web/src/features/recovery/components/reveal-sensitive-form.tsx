"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { revealSensitiveDataAction } from "../server/reveal-sensitive-data-action";

import type { RecoveryTriageActionState } from "../server/recovery-action.types";

const initialState: RecoveryTriageActionState = {
  type: "idle",
  message: "",
};

export function RevealSensitiveForm({ caseId }: { caseId: string }) {
  const [state, formAction, pending] = useActionState(
    revealSensitiveDataAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input name="caseId" type="hidden" value={caseId} />
      <Button disabled={pending} type="submit" variant="secondary">
        {pending ? "Revelando…" : "Revelar datos de validación"}
      </Button>
      <p className="text-xs leading-5 text-ui-muted">
        La revelación queda auditada con tu usuario, el caso y la hora.
      </p>
      <InlineFeedback
        message={state.message}
        tone={state.type === "error" ? "danger" : "neutral"}
      />
    </form>
  );
}
