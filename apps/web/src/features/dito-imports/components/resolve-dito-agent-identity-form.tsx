"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";
import { Field, SelectInput } from "@repo/ui/field";

import { resolveDitoAgentIdentityAction } from "../server/resolve-dito-agent-identity-action";

import type { DitoImportAdminActionState } from "../server/dito-import-action.types";

const initialState: DitoImportAdminActionState = {
  type: "idle",
  message: "",
};

export function ResolveDitoAgentIdentityForm({
  batchId,
  identity,
  agents,
}: {
  batchId: string;
  identity: { id: string; updatedAt: string };
  agents: Array<{ id: string; name: string; teamName: string }>;
}) {
  const [state, action, pending] = useActionState(
    resolveDitoAgentIdentityAction,
    initialState,
  );

  return (
    <form action={action} className="flex min-w-64 flex-wrap items-end gap-2">
      <input name="batchId" type="hidden" value={batchId} />
      <input name="identityId" type="hidden" value={identity.id} />
      <input
        name="expectedUpdatedAt"
        type="hidden"
        value={identity.updatedAt}
      />

      <Field label="Asesor responsable">
        <SelectInput disabled={pending} name="userId" required>
          <option value="">Seleccionar</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} · {agent.teamName}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Button disabled={pending} type="submit" variant="secondary">
        {pending ? "Vinculando..." : "Vincular"}
      </Button>

      <div className="basis-full">
        <InlineFeedback
          message={state.message}
          tone={state.type === "success" ? "success" : "danger"}
        />
      </div>
    </form>
  );
}
