"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { computeRangeSelection } from "@repo/validation";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { markRecoveryTriageAction } from "../server/mark-recovery-triage-action";

import { CopyValue } from "./copy-value";

import type { RecoveryTriageActionState } from "../server/recovery-action.types";

const initialState: RecoveryTriageActionState = {
  type: "idle",
  message: "",
};

export interface RecoveryTriageRow {
  id: string;
  holderName: string;
  documentNumber: string;
  status: "TRIAGE" | "WAITING";
  serviceNumbers: string[];
  planSummary: string;
  carrierSummary: string;
  teamName: string | null;
  lastSightingLabel: string;
  sightingCount: number;
}

export interface RecoveryTriageTeamOption {
  id: string;
  name: string;
}

export function RecoveryTriageForm({
  rows,
  teams,
  canAssignTeams,
}: {
  rows: RecoveryTriageRow[];
  teams: RecoveryTriageTeamOption[];
  canAssignTeams: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    markRecoveryTriageAction,
    initialState,
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [takeCount, setTakeCount] = useState("200");
  const lastIndexRef = useRef<number | null>(null);

  /**
   * Una acción aplicada saca casos de la tabla: la selección previa dejaría
   * IDs fantasma y el siguiente clic actuaría sobre casos que ya no se ven.
   */
  useEffect(() => {
    if (state.type === "success") {
      lastIndexRef.current = null;
      setSelected(new Set());
    }
  }, [state]);

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggleAll() {
    lastIndexRef.current = null;
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)));
  }

  function selectFirst() {
    const count = Math.max(0, Number.parseInt(takeCount, 10) || 0);

    lastIndexRef.current = null;
    setSelected(new Set(rows.slice(0, count).map((row) => row.id)));
  }

  function handleRowClick(index: number, shiftKey: boolean) {
    const result = computeRangeSelection({
      orderedIds: rows.map((row) => row.id),
      selected,
      clickedIndex: index,
      lastClickedIndex: lastIndexRef.current,
      shiftKey,
    });

    lastIndexRef.current = result.lastClickedIndex;
    setSelected(result.selected);
  }

  return (
    <form action={formAction} className="space-y-4">
      {[...selected].map((id) => (
        <input key={id} name="caseIds" type="hidden" value={id} />
      ))}

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ui-muted">
              Seleccionar los primeros
            </span>
            <input
              className="block w-24 rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-1.5 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
              inputMode="numeric"
              onChange={(event) => setTakeCount(event.target.value)}
              onKeyDown={(event) => {
                // Enter aquí seleccionaría... y enviaría el formulario con el
                // primer botón (marcar en espera). Se intercepta.
                if (event.key === "Enter") {
                  event.preventDefault();
                  selectFirst();
                }
              }}
              value={takeCount}
            />
          </label>
          <Button onClick={selectFirst} type="button" variant="secondary">
            Seleccionar
          </Button>
        </div>

        <span className="pb-2 text-sm text-ui-muted">
          {selected.size.toLocaleString("es-PE")} de{" "}
          {rows.length.toLocaleString("es-PE")} casos seleccionados. Mantén{" "}
          <kbd className="rounded border border-ui-border px-1">Shift</kbd> al
          hacer clic para seleccionar un rango.
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-ui-border p-3">
          <Button
            disabled={pending || selected.size === 0}
            fullWidth
            name="decision"
            type="submit"
            value="EN_ESPERA"
            variant="secondary"
          >
            {pending ? "Aplicando..." : "Marcar en espera"}
          </Button>
          <p className="mt-2 text-xs leading-5 text-ui-muted">
            El cliente <strong>aún tiene un pedido en curso</strong>: no se
            llama ni se asigna. Reaparece en la revisión de mañana; si porta,
            sale solo de la bandeja.
          </p>
        </div>

        <div className="rounded-xl border border-ui-border p-3">
          <Button
            disabled={pending || selected.size === 0}
            fullWidth
            name="decision"
            type="submit"
            value="LIBERADO"
          >
            {pending ? "Aplicando..." : "Liberar para asignar"}
          </Button>
          <p className="mt-2 text-xs leading-5 text-ui-muted">
            El cliente <strong>ya no tiene pedido vigente</strong>: es
            oportunidad real y queda disponible para repartirse a los asesores.
          </p>
        </div>

        {canAssignTeams ? (
          <div className="rounded-xl border border-ui-border p-3">
            <div className="flex gap-2">
              <select
                className="block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
                defaultValue=""
                name="teamId"
              >
                <option disabled value="">
                  Equipo destino…
                </option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <Button
                disabled={pending || selected.size === 0}
                name="decision"
                type="submit"
                value="ASIGNAR_EQUIPO"
                variant="secondary"
              >
                Asignar
              </Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-ui-muted">
              Entrega el bloque al equipo: su supervisor verá{" "}
              <strong>solo su base</strong> en este triage y la repartirá entre
              sus asesores.
            </p>
          </div>
        ) : null}
      </div>

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

      <div className="overflow-x-auto rounded-xl border border-ui-border">
        <table className="min-w-full divide-y divide-ui-border text-sm">
          <thead className="bg-ui-surface-muted text-left text-xs uppercase tracking-wide text-ui-muted">
            <tr>
              <th className="px-3 py-2">
                <input
                  aria-label="Seleccionar todos"
                  checked={allSelected}
                  onChange={toggleAll}
                  type="checkbox"
                />
              </th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">DNI</th>
              <th className="px-3 py-2">Servicios</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Cedente</th>
              <th className="px-3 py-2">Equipo</th>
              <th className="px-3 py-2">Último registro</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ui-border bg-ui-surface">
            {rows.map((row, index) => (
              <tr className="select-none" key={row.id}>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Seleccionar a ${row.holderName}`}
                    checked={selected.has(row.id)}
                    onClick={(event) =>
                      handleRowClick(index, event.shiftKey)
                    }
                    readOnly
                    type="checkbox"
                  />
                </td>
                <td className="px-3 py-2 font-medium text-ui-text">
                  {row.holderName}
                </td>
                <td className="px-3 py-2">
                  <CopyValue label="DNI" value={row.documentNumber} />
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {row.serviceNumbers.join(", ")}
                  {row.sightingCount > 1 ? (
                    <span className="ml-2 rounded-full bg-ui-surface-muted px-2 py-0.5 text-[11px] text-ui-muted">
                      {row.sightingCount} apariciones
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-ui-muted">
                  {row.planSummary}
                </td>
                <td className="px-3 py-2 text-xs">{row.carrierSummary}</td>
                <td className="px-3 py-2 text-xs">
                  {row.teamName ?? (
                    <span className="text-ui-muted">Sin equipo</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-ui-muted">
                  {row.lastSightingLabel}
                </td>
                <td className="px-3 py-2 text-xs">
                  {row.status === "WAITING" ? "En espera" : "Por revisar"}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-ui-muted" colSpan={9}>
                  No hay casos pendientes de triage. Buen trabajo.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </form>
  );
}
