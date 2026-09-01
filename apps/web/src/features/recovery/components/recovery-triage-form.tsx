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

  /**
   * Una columna cuyas celdas dicen todas lo mismo no informa: ocupa ancho y
   * obliga a leerla para descubrir que no aporta nada. Aparecen solas cuando
   * empiezan a distinguir — al entregar el primer bloque a un equipo, o
   * cuando convive un caso en espera con uno por revisar.
   */
  const showTeamColumn = rows.some((row) => row.teamName !== null);
  const showStatusColumn = rows.some((row) => row.status !== rows[0]?.status);
  const columnCount = 6 + (showTeamColumn ? 1 : 0) + (showStatusColumn ? 1 : 0);

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

      <div className="ui-form-row">
        <label>
          <span className="ui-label-eyebrow">Seleccionar los primeros</span>
          <div className="flex gap-2">
            <input
              className="block w-20 rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
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
            <Button onClick={selectFirst} type="button" variant="secondary">
              Seleccionar
            </Button>
          </div>
        </label>

        <span className="pb-2 text-xs text-ui-muted">
          {selected.size.toLocaleString("es-PE")} de{" "}
          {rows.length.toLocaleString("es-PE")} seleccionados ·{" "}
          <kbd className="rounded border border-ui-border px-1">Shift</kbd> para
          un rango
        </span>
      </div>

      <div className="ui-form-row">
        <Button
          disabled={pending || selected.size === 0}
          name="decision"
          type="submit"
          value="EN_ESPERA"
          variant="secondary"
        >
          {pending ? "Aplicando…" : "Marcar en espera"}
        </Button>
        <Button
          disabled={pending || selected.size === 0}
          name="decision"
          type="submit"
          value="LIBERADO"
        >
          {pending ? "Aplicando…" : "Liberar para asignar"}
        </Button>

        {canAssignTeams ? (
          <>
            <select
              className="ui-form-row__fixed rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
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
              Entregar al equipo
            </Button>
          </>
        ) : null}
      </div>

      <p className="text-xs leading-5 text-ui-muted">
        Con pedido en curso → <strong>en espera</strong>, reaparece mañana y
        sale sola si porta. Sin pedido vigente →{" "}
        <strong>liberar</strong>, queda lista para repartir.
        {canAssignTeams
          ? " Entregar al equipo deja el bloque en el triage de su supervisor."
          : ""}
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

      <div className="overflow-x-auto rounded-xl border border-ui-border">
        <table className="min-w-full divide-y divide-ui-border text-sm">
          <thead className="bg-ui-surface-muted text-left text-xs uppercase tracking-wide text-ui-muted">
            <tr>
              <th className="px-3 py-1.5">
                <input
                  aria-label="Seleccionar todos"
                  checked={allSelected}
                  onChange={toggleAll}
                  type="checkbox"
                />
              </th>
              <th className="px-3 py-1.5 font-semibold">Cliente</th>
              <th className="px-3 py-1.5 font-semibold">DNI</th>
              <th className="px-3 py-1.5 font-semibold">Servicios</th>
              <th className="px-3 py-1.5 font-semibold">Plan</th>
              <th className="px-3 py-1.5 font-semibold">Cedente</th>
              {showTeamColumn ? (
                <th className="px-3 py-1.5 font-semibold">Equipo</th>
              ) : null}
              <th className="px-3 py-1.5 font-semibold">Último registro</th>
              {showStatusColumn ? (
                <th className="px-3 py-1.5 font-semibold">Estado</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-ui-border bg-ui-surface">
            {/*
             * Toda la fila selecciona: apuntar a una casilla de 13px por
             * cliente es el cuello de botella cuando hay que marcar decenas.
             * El clic con Shift sigue extendiendo el rango y los controles
             * internos (copiar DNI) detienen la propagación.
             */}
            {rows.map((row, index) => (
              <tr
                aria-selected={selected.has(row.id)}
                className={`cursor-pointer select-none ${
                  selected.has(row.id)
                    ? "bg-ui-accent-soft"
                    : "hover:bg-ui-surface-muted"
                }`}
                key={row.id}
                onClick={(event) => handleRowClick(index, event.shiftKey)}
              >
                <td className="px-3 py-1.5">
                  <input
                    aria-label={`Seleccionar a ${row.holderName}`}
                    checked={selected.has(row.id)}
                    className="pointer-events-none"
                    readOnly
                    tabIndex={-1}
                    type="checkbox"
                  />
                </td>
                <td className="px-3 py-1.5 font-medium text-ui-text">
                  {row.holderName}
                </td>
                <td className="px-3 py-1.5">
                  <CopyValue label="DNI" value={row.documentNumber} />
                </td>
                <td className="px-3 py-1.5 font-mono text-xs">
                  {row.serviceNumbers.join(", ")}
                  {row.sightingCount > 1 ? (
                    <span className="ml-2 rounded-full bg-ui-surface-muted px-2 py-0.5 text-[11px] text-ui-muted">
                      {row.sightingCount} apariciones
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5 text-xs text-ui-muted">
                  {row.planSummary}
                </td>
                <td className="px-3 py-1.5 text-xs">{row.carrierSummary}</td>
                {showTeamColumn ? (
                  <td className="px-3 py-1.5 text-xs">
                    {row.teamName ?? (
                      <span className="text-ui-muted">Sin equipo</span>
                    )}
                  </td>
                ) : null}
                <td className="ui-data px-3 py-1.5 text-ui-muted">
                  {row.lastSightingLabel}
                </td>
                {showStatusColumn ? (
                  <td className="px-3 py-1.5 text-xs">
                    {row.status === "WAITING" ? "En espera" : "Por revisar"}
                  </td>
                ) : null}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-6 text-center text-ui-muted"
                  colSpan={columnCount}
                >
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
