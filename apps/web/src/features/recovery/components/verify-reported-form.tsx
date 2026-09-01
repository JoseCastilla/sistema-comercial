"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { verifyReportedActiveAction } from "../server/verify-reported-active-action";

import type { RecoveryTriageActionState } from "../server/recovery-action.types";

const initialState: RecoveryTriageActionState = {
  type: "idle",
  message: "",
};

export function VerifyReportedForm({ caseId }: { caseId: string }) {
  const [state, formAction, pending] = useActionState(
    verifyReportedActiveAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input name="caseId" type="hidden" value={caseId} />
      <div className="ui-form-row">
        <Button
          disabled={pending}
          name="decision"
          type="submit"
          value="CONFIRMAR"
          variant="danger"
        >
          Confirmar: ya es Movistar
        </Button>
        <Button
          disabled={pending}
          name="decision"
          type="submit"
          value="DESMENTIR"
          variant="secondary"
        >
          Sigue portable: devolver a la cola
        </Button>
      </div>
      <p className="text-xs leading-5 text-ui-muted">
        Confirmar cierra como pérdida frente a otra agencia, con tu usuario
        como evidencia. Devolver reactiva el caso con su asesor.
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
