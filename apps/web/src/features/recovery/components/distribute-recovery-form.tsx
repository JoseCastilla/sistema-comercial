"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { computeRangeSelection } from "@repo/validation";

import { formatCount } from "@repo/ui/format";
import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { distributeRecoveryCasesAction } from "../server/distribute-recovery-cases-action";

import { CopyValue } from "./copy-value";

import {
  previewDirectLoad,
  previewEquitableLoad,
} from "../distribution-preview";

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
  /** Con dueño y sin ningún intento (PL-04). */
  unworkedCases: number;
  /** En gestión con la próxima acción ya vencida (PL-04). */
  overdueCases: number;
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
  const [directTargetId, setDirectTargetId] = useState("");
  const [poolTeamId, setPoolTeamId] = useState("");
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

  /**
   * COR-05 (05/09/2026): al cambiar el filtro la lista trae otros casos, pero
   * el estado de este componente sobrevive, y los IDs marcados seguirían
   * viajando ocultos en el formulario aunque ya no estén en pantalla: un
   * clic en «aplicar» actuaría sobre clientes que nadie ve. Se limpia y se
   * dice, porque una selección que desaparece sin explicación parece un
   * fallo.
   */
  const rowsKey = rows.map((row) => row.id).join("|");
  const previousRowsKey = useRef(rowsKey);
  const [selectionCleared, setSelectionCleared] = useState(false);

  useEffect(() => {
    if (previousRowsKey.current === rowsKey) return;

    previousRowsKey.current = rowsKey;

    if (selected.size > 0) {
      lastIndexRef.current = null;
      setSelected(new Set());
      setSelectionCleared(true);
    }
  }, [rowsKey, selected]);

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

  // PL-04: la vista previa usa la misma regla que aplica el servidor.
  const equitablePreview = useMemo(
    () =>
      new Map(
        previewEquitableLoad(
          selected.size,
          equitableAdvisors.filter(
            (advisor) => !excludedParticipants.has(advisor.id),
          ),
        ).map((row) => [row.id, row]),
      ),
    [selected.size, equitableAdvisors, excludedParticipants],
  );
  const directTarget = directTargets.find(
    (advisor) => advisor.id === directTargetId,
  );
  const directPreview = directTarget
    ? previewDirectLoad(selected.size, directTarget)
    : null;
  const poolTeamAdvisors = advisors.filter(
    (advisor) => advisor.teamId === poolTeamId,
  );
  const poolLoad = poolTeamAdvisors.reduce(
    (sum, advisor) => ({
      open: sum.open + advisor.openCases,
      unworked: sum.unworked + advisor.unworkedCases,
      overdue: sum.overdue + advisor.overdueCases,
    }),
    { open: 0, unworked: 0, overdue: 0 },
  );

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
      {selectionCleared && selected.size === 0 ? (
        <p className="text-xs text-ui-warning" role="status">
          La selección se limpió porque cambió la lista: marca de nuevo lo que
          quieras aplicar.
        </p>
      ) : null}
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
              aria-label="Asesor destino"
              className="block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
              name="targetUserId"
              onChange={(event) => setDirectTargetId(event.target.value)}
              value={directTargetId}
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
          {directPreview ? (
            <p className="mt-2 text-xs leading-5 text-ui-text" role="status">
              Hoy carga {directPreview.openCases} abiertos (
              {directPreview.unworkedCases} sin primer contacto,{" "}
              {directPreview.overdueCases} vencidos). Recibiría{" "}
              {directPreview.receives} y quedaría con{" "}
              <strong>{directPreview.resulting}</strong>.
            </p>
          ) : null}
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
              aria-label="Equipo para el reparto equitativo"
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
            <table className="mt-2 w-full text-xs text-ui-text">
              <thead className="text-ui-muted">
                <tr>
                  <th className="py-1 text-left font-medium" scope="col">
                    Participa
                  </th>
                  <th
                    className="py-1 text-right font-medium"
                    scope="col"
                    title="Casos de campaña que ya carga"
                  >
                    Abiertos
                  </th>
                  <th
                    className="py-1 text-right font-medium"
                    scope="col"
                    title="Con dueño y sin ningún intento"
                  >
                    Sin 1.er contacto
                  </th>
                  <th
                    className="py-1 text-right font-medium"
                    scope="col"
                    title="Próxima acción ya vencida"
                  >
                    Vencidos
                  </th>
                  <th className="py-1 text-right font-medium" scope="col">
                    Recibiría
                  </th>
                  <th className="py-1 text-right font-medium" scope="col">
                    Quedaría
                  </th>
                </tr>
              </thead>
              <tbody>
                {equitableAdvisors.map((advisor) => {
                  const participates = !excludedParticipants.has(advisor.id);
                  const preview = equitablePreview.get(advisor.id);
                  return (
                    <tr key={advisor.id}>
                      <td className="py-1">
                        <label className="flex items-center gap-2">
                          <input
                            checked={participates}
                            onChange={() => toggleParticipant(advisor.id)}
                            type="checkbox"
                          />
                          <span>
                            {advisor.name}
                            {advisor.id === viewerUserId ? (
                              <span className="text-ui-muted"> · tú</span>
                            ) : null}
                          </span>
                        </label>
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {advisor.openCases}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {advisor.unworkedCases}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {advisor.overdueCases}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {participates ? (preview?.receives ?? 0) : "—"}
                      </td>
                      <td className="py-1 text-right tabular-nums font-semibold">
                        {participates
                          ? (preview?.resulting ?? advisor.openCases)
                          : advisor.openCases}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs leading-5 text-ui-muted">
            Reparto equitativo: parejo, a lo más un caso de diferencia, y el
            residuo a quien menos abiertos tiene. La vista previa solo informa;
            desmarca a quien no trabaja hoy y queda registrado quién quedó
            fuera. Nadie se reasigna por tener carga alta.
          </p>
        </div>

        <div className="rounded-xl border border-ui-border p-3">
          <p className="mb-2 text-sm font-semibold text-ui-text">
            A la cola del equipo
          </p>
          <div className="flex gap-2">
            <select
              aria-label="Equipo destino de la cola"
              className="block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
              name="poolTeamId"
              onChange={(event) => setPoolTeamId(event.target.value)}
              value={poolTeamId}
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
          {poolTeamId ? (
            <p className="mt-2 text-xs leading-5 text-ui-text" role="status">
              El equipo carga hoy {poolLoad.open} abiertos entre{" "}
              {poolTeamAdvisors.length}{" "}
              {poolTeamAdvisors.length === 1 ? "asesor" : "asesores"} (
              {poolLoad.unworked} sin primer contacto, {poolLoad.overdue}{" "}
              vencidos). A la cola irían {selected.size}.
            </p>
          ) : null}
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
