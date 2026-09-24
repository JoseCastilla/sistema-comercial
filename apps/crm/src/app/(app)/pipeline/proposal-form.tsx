"use client";

import { useState } from "react";

import { ActionForm } from "@/components/forms/action-form";

import { saveProposal } from "./actions";

/**
 * Propuesta: al elegir plan y líneas el cargo fijo total se calcula solo,
 * pero queda editable (hay descuentos que no están en el catálogo).
 */
export function ProposalForm({
  opportunityId,
  plans,
  planId,
  lines,
  fixedCharge,
}: {
  opportunityId: string;
  plans: { id: string; name: string; kind: string; fixedCharge: number }[];
  planId: string | null;
  lines: number | null;
  fixedCharge: number | null;
}) {
  const [plan, setPlan] = useState(planId ?? "");
  const [count, setCount] = useState(lines ?? 1);
  const [charge, setCharge] = useState(fixedCharge === null ? "" : fixedCharge.toFixed(2));

  function recalculate(nextPlan: string, nextLines: number) {
    const chosen = plans.find((item) => item.id === nextPlan);
    if (chosen) setCharge((chosen.fixedCharge * Math.max(1, nextLines)).toFixed(2));
  }

  return (
    <ActionForm action={saveProposal} submitLabel="Guardar propuesta">
      <input name="id" type="hidden" value={opportunityId} />
      <div className="ui-form-row">
        <label className="ui-field ui-form-row__grow">
          <span className="ui-field__label">Plan del catálogo</span>
          <select
            className="ui-control ui-control--select"
            name="planId"
            onChange={(event) => {
              setPlan(event.target.value);
              recalculate(event.target.value, count);
            }}
            value={plan}
          >
            <option value="">Sin plan del catálogo</option>
            {plans.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · S/ {item.fixedCharge.toFixed(2)}
              </option>
            ))}
          </select>
          {plans.length === 0 ? <span className="ui-field__hint">Todavía no hay planes vigentes: cárgalos en Ajustes → Catálogo de planes.</span> : null}
        </label>
        <label className="ui-field ui-form-row__fixed">
          <span className="ui-field__label">Líneas</span>
          <input
            className="ui-control"
            min={1}
            name="lines"
            onChange={(event) => {
              const value = Number.parseInt(event.target.value, 10) || 1;
              setCount(value);
              recalculate(plan, value);
            }}
            step={1}
            type="number"
            value={count}
          />
        </label>
        <label className="ui-field ui-form-row__fixed">
          <span className="ui-field__label">Cargo fijo total (S/)</span>
          <input className="ui-control" min={0} name="fixedCharge" onChange={(event) => setCharge(event.target.value)} required step="0.01" type="number" value={charge} />
          <span className="ui-field__hint">Se calcula con el plan y las líneas; puedes cambiarlo.</span>
        </label>
      </div>
    </ActionForm>
  );
}
