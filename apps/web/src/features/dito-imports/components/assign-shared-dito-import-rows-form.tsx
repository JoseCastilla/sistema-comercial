"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";
import { SelectInput } from "@repo/ui/field";

import { assignSharedDitoImportRowsAction } from "../server/assign-shared-dito-import-rows-action";

import type { DitoImportAdminActionState } from "../server/dito-import-action.types";

const initialState: DitoImportAdminActionState = {
  type: "idle",
  message: "",
};

export function AssignSharedDitoImportRowsForm({
  batchId,
  rows,
  agents,
}: {
  batchId: string;
  rows: Array<{
    id: string;
    orderCode: string;
    customerName: string;
    salesAdvisorName: string | null;
    updatedAt: string;
    assignedUserId: string | null;
  }>;
  agents: Array<{ id: string; name: string; teamName: string }>;
}) {
  const [state, action, pending] = useActionState(
    assignSharedDitoImportRowsAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-4">
      <input name="batchId" type="hidden" value={batchId} />

      <div className="divide-y divide-neutral-100 rounded-xl border border-ui-border">
        {rows.map((row) => (
          <div
            className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] md:items-center"
            key={row.id}
          >
            <input name="rowId" type="hidden" value={row.id} />
            <input
              name={`version:${row.id}`}
              type="hidden"
              value={row.updatedAt}
            />
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold text-ui-text">
                {row.orderCode}
              </p>
              <p className="mt-1 truncate text-sm text-ui-muted">
                {row.customerName}
              </p>
              {row.salesAdvisorName ? (
                <p className="mt-1 truncate text-xs font-medium text-ui-text">
                  Reportado: {row.salesAdvisorName}
                </p>
              ) : null}
            </div>
            <SelectInput
              aria-label={`Asesor de la orden ${row.orderCode}`}
              defaultValue={row.assignedUserId ?? ""}
              disabled={pending}
              name={`agent:${row.id}`}
            >
              <option value="">Pendiente de identificar</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} · {agent.teamName}
                </option>
              ))}
            </SelectInput>
          </div>
        ))}
      </div>

      <InlineFeedback
        message={state.message}
        tone={state.type === "success" ? "success" : "danger"}
      />
      <Button disabled={pending} type="submit">
        {pending ? "Guardando..." : "Guardar asignaciones"}
      </Button>
    </form>
  );
}
