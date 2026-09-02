"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { computeRangeSelection } from "@repo/validation";

import { formatCount } from "@repo/ui/format";
import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { distributeRecoveryCasesAction } from "../server/distribute-recovery-cases-action";

import { CopyValue } from "./copy-value";

import type { RecoveryTriageActionState } from "../server/recovery-action.types";

const initialState: RecoveryTriageActionState = {
  type: "idle",
  message: "",
};

export interface DistributeRecoveryRow {
  id: string;
  holderName: string;
  documentNumber: string;
  department: string | null;
  planSummary: string;
  serviceCount: number;
  teamName: string | null;
  assignedToName: string | null;
  habilitationOverdue: boolean;
  unverified: boolean;
  lastSightingLabel: string;
}

export interface DistributeTeamOption {
  id: string;
  name: string;
}

export interface DistributeAdvisorOption {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  openCases: number;
}

export function DistributeRecoveryForm({
  rows,
  teams,
  advisors,
  viewerUserId,
  viewerRole,
}: {
  rows: DistributeRecoveryRow[];
  teams: DistributeTeamOption[];
  advisors: DistributeAdvisorOption[];
  viewerUserId: string;
  viewerRole: string;
}) {
  const [state, formAction, pending] = useActionState(
    distributeRecoveryCasesAction,
    initialState,
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [takeCount, setTakeCount] = useState("50");
  const [equitableTeamId, setEquitableTeamId] = useState(teams[0]?.id ?? "");
  const [excludedParticipants, setExcludedParticipants] = useState<
    ReadonlySet<string>
  >(new Set());
  const lastIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.type === "success") {
      lastIndexRef.current = null;
      setSelected(new Set());
    }
  }, [state]);

  const allSelected = rows.length > 0 && selected.size === rows.length;

  // BR-050b: un supervisor no puede elegirse casos por selección directa.
  const directTargets = useMemo(
    () =>
      viewerRole === "SUPERVISOR"
        ? advisors.filter((advisor) => advisor.id !== viewerUserId)
        : advisors,
    [advisors, viewerRole, viewerUserId],
  );

  const equitableAdvisors = useMemo(
    () => advisors.filter((advisor) => advisor.teamId === equitableTeamId),
    [advisors, equitableTeamId],
  );

  const participantIds = equitableAdvisors
    .filter((advisor) => !excludedParticipants.has(advisor.id))
    .map((advisor) => advisor.id);

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

  function toggleParticipant(advisorId: string) {
    setExcludedParticipants((current) => {
      const next = new Set(current);
      if (next.has(advisorId)) {
        next.delete(advisorId);
      } else {
        next.add(advisorId);
      }
      return next;
    });
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
          {formatCount(selected.size)} de {formatCount(rows.length)} casos
          seleccionados. Mantén{" "}
          <kbd className="rounded border border-ui-border px-1">Shift</kbd> para
          seleccionar un rango. Para repartir entre equipos, marca una cantidad
          y asígnala a un equipo; luego repite con el resto.
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-ui-border p-3">
          <p className="mb-2 text-sm font-semibold text-ui-text">
            Directa a un asesor
          </p>
          <div className="flex gap-2">
            <select
              className="block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
              defaultValue=""
              name="targetUserId"
            >
              <option disabled value="">
                Asesor destino…
              </option>
              {directTargets.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisor.name} · {advisor.teamName} ({advisor.openCases}{" "}
                  abiertos)
                </option>
              ))}
            </select>
            <Button
              disabled={pending || selected.size === 0}
              name="mode"
              type="submit"
              value="DIRECTA"
              variant="secondary"
            >
              Asignar
            </Button>
          </div>
          <p className="mt-2 text-xs leading-5 text-ui-muted">
            Todos los casos marcados van a un solo asesor, de cualquiera de tus
            equipos.
          </p>
        </div>

        <div className="rounded-xl border border-ui-border p-3">
          <p className="mb-2 text-sm font-semibold text-ui-text">
            Equitativa en un equipo
          </p>
          <div className="flex gap-2">
            <select
              className="block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
              name="teamId-equitativa-selector"
              onChange={(event) => {
                setEquitableTeamId(event.target.value);
                setExcludedParticipants(new Set());
              }}
              value={equitableTeamId}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <Button
              disabled={
                pending || selected.size === 0 || participantIds.length === 0
              }
              name="mode"
              type="submit"
              value="EQUITATIVA"
            >
              Repartir
            </Button>
          </div>
          {equitableAdvisors.length === 0 ? (
            <p className="mt-2 text-xs text-ui-muted">
              Este equipo no tiene asesores activos con venta habilitada.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {equitableAdvisors.map((advisor) => {
                const participates = !excludedParticipants.has(advisor.id);
                return (
                  <li key={advisor.id}>
                    <label className="flex items-center gap-2 text-xs text-ui-text">
                      <input
                        checked={participates}
                        onChange={() => toggleParticipant(advisor.id)}
                        type="checkbox"
                      />
                      <span>
                        {advisor.name}
                        <span className="text-ui-muted">
                          {" "}
                          · {advisor.openCases} abiertos
                          {advisor.id === viewerUserId ? " · tú" : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs leading-5 text-ui-muted">
            Se reparte parejo (a lo más un caso de diferencia). Desmarca a quien
            no trabaja hoy; queda registrado quién quedó fuera.
          </p>
        </div>

        <div className="rounded-xl border border-ui-border p-3">
          <p className="mb-2 text-sm font-semibold text-ui-text">
            A la cola del equipo
          </p>
          <div className="flex gap-2">
            <select
              className="block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
              defaultValue=""
              name="poolTeamId"
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
              name="mode"
              type="submit"
              value="COLA"
              variant="secondary"
            >
              Enviar
            </Button>
          </div>
          <p className="mt-2 text-xs leading-5 text-ui-muted">
            Sin nominar asesor: cada asesor toma hasta 10 casos y nadie puede
            tomar los mismos.
          </p>
        </div>
      </div>

      {/* El teamId efectivo depende del modo: equitativa usa su selector. */}
      <EquitableTeamBridge
        equitableTeamId={equitableTeamId}
        participantIds={participantIds}
      />

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
        <table className="ui-table">
          <thead>
            <tr>
              <th>
                <input
                  aria-label="Seleccionar todos"
                  checked={allSelected}
                  onChange={toggleAll}
                  type="checkbox"
                />
              </th>
              <th>Cliente</th>
              <th>DNI</th>
              <th>Departamento</th>
              <th>Plan</th>
              <th>Equipo</th>
              <th>Responsable</th>
              <th>Última vez en la base</th>
            </tr>
          </thead>
          <tbody>
            {/* Toda la fila selecciona, igual que en el triage. */}
            {rows.map((row, index) => (
              <tr
                aria-selected={selected.has(row.id)}
                className={`cursor-pointer select-none ${
                  selected.has(row.id)
                    ? "bg-ui-accent-soft"
                    : "hover:bg-ui-subtle"
                }`}
                key={row.id}
                onClick={(event) => handleRowClick(index, event.shiftKey)}
              >
                <td>
                  <input
                    aria-label={`Seleccionar a ${row.holderName}`}
                    checked={selected.has(row.id)}
                    className="pointer-events-none"
                    readOnly
                    tabIndex={-1}
                    type="checkbox"
                  />
                </td>
                <td className="font-medium text-ui-text">
                  {row.holderName}
                  {row.habilitationOverdue ? (
                    <span className="ml-2 rounded-full bg-ui-warning-soft px-2 py-0.5 text-[11px] text-ui-warning">
                      Ya puede portar
                    </span>
                  ) : null}
                  {row.unverified ? (
                    <span className="ml-2 rounded-full bg-ui-warning-soft px-2 py-0.5 text-[11px] text-ui-warning">
                      Falta consultar portabilidad
                    </span>
                  ) : null}
                </td>
                <td>
                  <CopyValue label="DNI" value={row.documentNumber} />
                </td>
                <td className="text-xs text-ui-muted">
                  {row.department ?? "—"}
                </td>
                <td className="text-xs text-ui-muted">
                  {row.planSummary}
                  {row.serviceCount > 1 ? ` · ${row.serviceCount} líneas` : ""}
                </td>
                <td className="text-xs">
                  {row.teamName ?? (
                    <span className="text-ui-muted">Sin equipo</span>
                  )}
                </td>
                <td className="text-xs">
                  {row.assignedToName ?? (
                    <span className="text-ui-muted">Sin asignar</span>
                  )}
                </td>
                <td className="text-xs text-ui-muted">
                  {row.lastSightingLabel}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="text-center text-ui-muted" colSpan={8}>
                  No hay casos que cumplan el filtro en esta vista.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </form>
  );
}

/**
 * El formulario tiene un solo action y tres botones de modo. La equitativa
 * necesita su equipo y sus participantes; la cola usa su propio selector
 * (`poolTeamId`). Este puente publica los campos que el servidor espera.
 */
function EquitableTeamBridge({
  equitableTeamId,
  participantIds,
}: {
  equitableTeamId: string;
  participantIds: string[];
}) {
  return (
    <>
      <input name="equitableTeamId" type="hidden" value={equitableTeamId} />
      {participantIds.map((id) => (
        <input key={id} name="participantIds" type="hidden" value={id} />
      ))}
    </>
  );
}
