"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { computeRangeSelection } from "@repo/validation";

import { formatCount } from "@repo/ui/format";
import { InlineFeedback } from "@repo/ui/feedback";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { distributeRecoveryCasesAction } from "../server/distribute-recovery-cases-action";

import {
  previewDirectLoad,
  previewEquitableLoad,
} from "../distribution-preview";

import type { RecoveryTriageActionState } from "../server/recovery-action.types";

const initialState: RecoveryTriageActionState = {
  type: "idle",
  message: "",
};

const selectClass =
  "block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent";

type DistributionMode = "EQUITATIVA" | "DIRECTA" | "COLA";

/**
 * SPEC-071: una forma de repartir a la vez, a todo el ancho. Antes las tres
 * iban lado a lado y la tabla del reparto equitativo no cabía en su tercio.
 * El reparto parejo en el equipo va primero: es el de siempre.
 */
const modeOptions: ReadonlyArray<{ value: DistributionMode; label: string }> = [
  { value: "EQUITATIVA", label: "Parejo en el equipo" },
  { value: "DIRECTA", label: "A un asesor" },
  { value: "COLA", label: "A la cola del equipo" },
];

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
  const [mode, setMode] = useState<DistributionMode>("EQUITATIVA");
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

  const count = selected.size;
  const casesLabel = `${formatCount(count)} ${count === 1 ? "caso" : "casos"}`;

  return (
    // `minmax(0, 1fr)`: ningún hijo ancho estira el formulario más allá de
    // la pantalla (en el celular el selector de modo lo empujaba).
    <form action={formAction} className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {selectionCleared && count === 0 ? (
        <p className="text-xs text-ui-warning" role="status">
          La selección se limpió porque cambió la lista: marca de nuevo lo que
          quieras aplicar.
        </p>
      ) : null}
      {[...selected].map((id) => (
        <input key={id} name="caseIds" type="hidden" value={id} />
      ))}

      {/* 1. Qué casos: marcar los primeros N, todos o un rango con Shift. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-ui-border bg-ui-surface px-4 py-3 text-sm">
        <span className="font-semibold text-ui-text">
          {formatCount(count)} de {formatCount(rows.length)} marcados
        </span>
        <label className="flex items-center gap-2 text-ui-muted">
          Marcar los primeros
          <input
            aria-label="Cuántos marcar"
            className="w-16 rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-1 text-sm text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-accent"
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
        <Button onClick={selectFirst} size="sm" type="button" variant="outline">
          Marcar
        </Button>
        <Button onClick={toggleAll} size="sm" type="button" variant="ghost">
          {allSelected ? "Quitar las marcas" : "Marcar todos"}
        </Button>
        <span className="text-xs text-ui-muted">
          Shift + clic marca un rango.
        </span>
      </div>

      {/* 2. A quién van: una forma a la vez, a todo el ancho. */}
      <section
        aria-label="A quién van"
        className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border border-ui-border bg-ui-surface p-4"
      >
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <span className="text-sm font-semibold text-ui-text">
            ¿A quién van?
          </span>
          <div className="ui-segmented-scroll">
            <div
              className="ui-segmented"
              role="group"
              aria-label="Forma de repartir"
            >
              {modeOptions.map((option) => (
                <button
                  aria-pressed={mode === option.value}
                  className="ui-segmented__item"
                  key={option.value}
                  onClick={() => setMode(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {mode === "EQUITATIVA" ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Equipo para el reparto equitativo"
                className={selectClass}
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
                disabled={pending || count === 0 || participantIds.length === 0}
                name="mode"
                type="submit"
                value="EQUITATIVA"
                variant="accent"
              >
                {pending ? "Repartiendo…" : `Repartir ${casesLabel}`}
              </Button>
            </div>
            {equitableAdvisors.length === 0 ? (
              <p className="text-xs text-ui-muted">
                Este equipo no tiene asesores activos con venta habilitada.
              </p>
            ) : (
              <ul className="divide-y divide-ui-border rounded-lg border border-ui-border text-sm">
                {equitableAdvisors.map((advisor) => {
                  const participates = !excludedParticipants.has(advisor.id);
                  const preview = equitablePreview.get(advisor.id);
                  return (
                    <li
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2"
                      key={advisor.id}
                    >
                      <label className="flex min-w-48 items-center gap-2 font-medium text-ui-text">
                        <input
                          checked={participates}
                          onChange={() => toggleParticipant(advisor.id)}
                          type="checkbox"
                        />
                        {advisor.name}
                        {advisor.id === viewerUserId ? (
                          <span className="text-ui-muted"> · tú</span>
                        ) : null}
                      </label>
                      <span className="text-xs text-ui-muted">
                        Tiene {formatCount(advisor.openCases)} abiertos ·{" "}
                        {formatCount(advisor.unworkedCases)} sin primer contacto
                        · {formatCount(advisor.overdueCases)} vencidos
                      </span>
                      <span className="text-xs tabular-nums text-ui-text sm:ml-auto">
                        {participates ? (
                          <>
                            Recibiría{" "}
                            <strong>
                              {formatCount(preview?.receives ?? 0)}
                            </strong>{" "}
                            → quedaría con{" "}
                            <strong>
                              {formatCount(
                                preview?.resulting ?? advisor.openCases,
                              )}
                            </strong>
                          </>
                        ) : (
                          <span className="text-ui-muted">
                            No participa hoy
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-ui-muted">
              Parejo, a lo más un caso de diferencia; el residuo va a quien
              menos abiertos tiene. Desmarca a quien no trabaja hoy: queda
              registrado quién quedó fuera.
            </p>
          </div>
        ) : mode === "DIRECTA" ? (
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Asesor destino"
                className={selectClass}
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
                disabled={pending || count === 0 || !directTargetId}
                name="mode"
                type="submit"
                value="DIRECTA"
                variant="accent"
              >
                {pending ? "Asignando…" : `Asignar ${casesLabel}`}
              </Button>
            </div>
            {directPreview ? (
              <p className="text-xs text-ui-text" role="status">
                Hoy tiene {directPreview.openCases} abiertos (
                {directPreview.unworkedCases} sin primer contacto,{" "}
                {directPreview.overdueCases} vencidos). Recibiría{" "}
                {directPreview.receives} y quedaría con{" "}
                <strong>{directPreview.resulting}</strong>.
              </p>
            ) : null}
            <p className="text-xs text-ui-muted">
              Todos los marcados van a un solo asesor, de cualquiera de tus
              equipos.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Equipo destino de la cola"
                className={selectClass}
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
                disabled={pending || count === 0 || !poolTeamId}
                name="mode"
                type="submit"
                value="COLA"
                variant="accent"
              >
                {pending ? "Enviando…" : `Enviar ${casesLabel}`}
              </Button>
            </div>
            {poolTeamId ? (
              <p className="text-xs text-ui-text" role="status">
                El equipo tiene hoy {poolLoad.open} abiertos entre{" "}
                {poolTeamAdvisors.length}{" "}
                {poolTeamAdvisors.length === 1 ? "asesor" : "asesores"} (
                {poolLoad.unworked} sin primer contacto, {poolLoad.overdue}{" "}
                vencidos).
              </p>
            ) : null}
            <p className="text-xs text-ui-muted">
              Sin nombrar asesor: cada uno toma hasta 10 casos y nadie puede
              tomar los mismos.
            </p>
          </div>
        )}

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
      </section>

      {/* El teamId efectivo depende del modo: equitativa usa su selector. */}
      <EquitableTeamBridge
        equitableTeamId={equitableTeamId}
        participantIds={participantIds}
      />

      {/* 3. Los casos: una fila compacta que se marca con un clic y cabe en
          cualquier ancho. Antes, una tabla de ocho columnas que no cabía. */}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-ui-border bg-ui-surface px-4 py-6 text-center text-sm text-ui-muted">
          No hay casos que cumplan el filtro en esta vista.
        </p>
      ) : (
        <ul className="divide-y divide-ui-border rounded-lg border border-ui-border bg-ui-surface">
          {rows.map((row, index) => {
            const checked = selected.has(row.id);
            return (
              <li
                aria-selected={checked}
                className={`flex cursor-pointer select-none items-start gap-3 px-4 py-2.5 ${
                  checked ? "bg-ui-accent-soft" : "hover:bg-ui-subtle"
                }`}
                key={row.id}
                onClick={(event) => handleRowClick(index, event.shiftKey)}
              >
                <input
                  aria-label={`Marcar a ${row.holderName}`}
                  checked={checked}
                  className="pointer-events-none mt-1"
                  readOnly
                  tabIndex={-1}
                  type="checkbox"
                />
                <span className="grid min-w-0 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ui-text">
                    {row.holderName}
                    {row.habilitationOverdue ? (
                      <Badge tone="warning">Ya puede portar</Badge>
                    ) : null}
                    {row.unverified ? (
                      <Badge tone="warning">Falta consultar portabilidad</Badge>
                    ) : null}
                  </span>
                  <span className="text-xs text-ui-muted">
                    {[
                      row.department ?? "Sin departamento",
                      `${row.planSummary}${row.serviceCount > 1 ? ` · ${row.serviceCount} líneas` : ""}`,
                      row.assignedToName
                        ? `Con ${row.assignedToName}`
                        : (row.teamName ?? "Sin equipo"),
                      `en la base el ${row.lastSightingLabel}`,
                    ].join(" · ")}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
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
