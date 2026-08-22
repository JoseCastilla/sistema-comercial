"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { resolveDitoImportConflictAction } from "../server/resolve-dito-import-conflict-action";

import type { DitoImportAdminActionState } from "../server/dito-import-action.types";

const initialState: DitoImportAdminActionState = {
  type: "idle",
  message: "",
};

const fieldLabels: Record<string, string> = {
  commercialOperation: "Tipo de operación",
  carrier: "Operador cedente",
  fixedCharge: "Cargo fijo",
  holderFullNameRaw: "Nombre del cliente",
  holderDocumentType: "Tipo de documento",
  holderDocumentNumber: "DNI / documento",
  serviceNumber: "Número móvil",
  deliveryMethod: "Método de entrega",
  deliveryMethodRaw: "Detalle de entrega",
  deliveryAddress: "Dirección",
  deliveryReference: "Referencia",
  deliveryLatitude: "Latitud",
  deliveryLongitude: "Longitud",
  department: "Departamento",
  province: "Provincia",
  district: "Distrito",
};

type Scalar = string | number | null;

export function ResolveDitoImportConflictForm({
  batchId,
  row,
}: {
  batchId: string;
  row: {
    id: string;
    orderCode: string;
    customerName: string;
    updatedAt: string;
    conflicts: Array<{ field: string; current: Scalar; incoming: Scalar }>;
  };
}) {
  const [state, action, pending] = useActionState(
    resolveDitoImportConflictAction,
    initialState,
  );

  return (
    <form action={action} className="rounded-xl border border-ui-border p-4">
      <input name="batchId" type="hidden" value={batchId} />
      <input name="rowId" type="hidden" value={row.id} />
      <input name="expectedUpdatedAt" type="hidden" value={row.updatedAt} />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-semibold text-ui-text">
            {row.orderCode}
          </p>
          <p className="mt-1 text-sm text-ui-muted">{row.customerName}</p>
        </div>
        <span className="rounded-full bg-ui-danger-soft px-2.5 py-1 text-xs font-medium text-ui-danger">
          {row.conflicts.length} por resolver
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {row.conflicts.map((conflict) => (
          <fieldset
            className="rounded-lg border border-ui-border bg-ui-surface-muted p-3"
            key={conflict.field}
          >
            <input name="conflictField" type="hidden" value={conflict.field} />
            <legend className="px-1 text-sm font-semibold text-ui-text">
              {fieldLabels[conflict.field] ?? conflict.field}
            </legend>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="flex cursor-pointer gap-2 rounded-lg border border-ui-border bg-ui-surface px-3 py-2.5">
                <input
                  defaultChecked
                  disabled={pending}
                  name={`decision:${conflict.field}`}
                  type="radio"
                  value="KEEP_CURRENT"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-ui-muted">
                    Conservar sistema
                  </span>
                  <span className="mt-1 block break-words text-sm text-ui-text">
                    {displayValue(conflict.field, conflict.current)}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer gap-2 rounded-lg border border-ui-border bg-ui-surface px-3 py-2.5">
                <input
                  disabled={pending}
                  name={`decision:${conflict.field}`}
                  type="radio"
                  value="USE_INCOMING"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-ui-muted">
                    Usar archivo DITO
                  </span>
                  <span className="mt-1 block break-words text-sm text-ui-text">
                    {displayValue(conflict.field, conflict.incoming)}
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <InlineFeedback
          message={state.message}
          tone={state.type === "success" ? "success" : "danger"}
        />
        <Button disabled={pending} type="submit">
          {pending ? "Guardando..." : "Aplicar decisión"}
        </Button>
      </div>
    </form>
  );
}

function displayValue(field: string, value: Scalar): string {
  if (value === null || value === "") return "Sin información";

  if (field === "commercialOperation" && typeof value === "string") {
    return (
      {
        NEW_LINE: "Alta nueva",
        PORT_PREPAID: "Portabilidad prepago",
        PORT_POSTPAID: "Portabilidad postpago",
      }[value] ?? value
    );
  }

  return String(value);
}
