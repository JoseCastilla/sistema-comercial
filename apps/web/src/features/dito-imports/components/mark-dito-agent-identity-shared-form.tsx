"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { markDitoAgentIdentitySharedAction } from "../server/mark-dito-agent-identity-shared-action";

import type { DitoImportAdminActionState } from "../server/dito-import-action.types";

const initialState: DitoImportAdminActionState = {
  type: "idle",
  message: "",
};

export function MarkDitoAgentIdentitySharedForm({
  batchId,
  identity,
}: {
  batchId: string;
  identity: { id: string; updatedAt: string };
}) {
  const [state, action, pending] = useActionState(
    markDitoAgentIdentitySharedAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-2">
      <input name="batchId" type="hidden" value={batchId} />
      <input name="identityId" type="hidden" value={identity.id} />
      <input
        name="expectedUpdatedAt"
        type="hidden"
        value={identity.updatedAt}
      />
      <Button disabled={pending} type="submit" variant="quiet">
        {pending ? "Registrando..." : "Asignar ventas por orden"}
      </Button>
      <InlineFeedback
        message={state.message}
        tone={state.type === "success" ? "success" : "danger"}
      />
    </form>
  );
}
