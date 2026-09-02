"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { computeRangeSelection } from "@repo/validation";

import { formatCount } from "@repo/ui/format";
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
   * Foco itinerante: con 250 filas, hacerlas todas tabulables obligaría a 250
   * pulsaciones para cruzar la tabla. Solo una entra en el orden de tabulación
   * y las flechas mueven el foco dentro.
   */
  const [focusedIndex, setFocusedIndex] = useState(0);
  /**
   * El cursor solo se dibuja mientras el teclado está dentro de la tabla: si
   * no, la primera fila parecería enfocada desde que carga la página.
   */
  const [cursorVisible, setCursorVisible] = useState(false);

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
  // Una acción vacía la tabla o la acorta: el índice recordado podría apuntar
  // a una fila que ya no existe y dejar la tabla sin puerta de entrada.
  const rovingIndex = Math.min(focusedIndex, Math.max(0, rows.length - 1));

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

  /**
   * El teclado reparte el trabajo igual que la hoja de cálculo: Espacio actúa
   * sobre el dato bajo el cursor —lo copia— y Shift + Espacio sobre la fila
   * entera —la marca—. Arriba y abajo cambian de cliente; izquierda y derecha
   * eligen qué dato de ese cliente se va a copiar.
   *
   * Marcar pasa por la misma regla que el ratón, así que teclado y clic no
   * pueden divergir.
   */
  function handleRowKeyDown(
    event: React.KeyboardEvent<HTMLTableRowElement>,
    index: number,
  ) {
    const row = event.currentTarget;
    const values = [...row.querySelectorAll<HTMLButtonElement>("button")];
    const valueIndex = values.indexOf(event.target as HTMLButtonElement);

    if (event.key === " " || event.key === "Spacebar") {
      if (event.shiftKey) {
        // Espacio desplaza la página por defecto; aquí marca al cliente.
        event.preventDefault();
        handleRowClick(index, false);
        return;
      }

      // Sobre un dato copia el propio botón: interferir lo rompería.
      if (valueIndex >= 0) return;

      // Sobre la fila, sin haber elegido dato, copia el primero: el DNI.
      event.preventDefault();
      values[0]?.click();
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      if (values.length === 0) return;

      event.preventDefault();

      const target = event.key === "ArrowRight" ? valueIndex + 1 : valueIndex - 1;

      // A la izquierda del primer dato está la fila, no el cliente anterior.
      if (target < 0) {
        row.focus();
        return;
      }

      values[Math.min(target, values.length - 1)]?.focus();
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const sibling =
      event.key === "ArrowDown"
        ? row.nextElementSibling
        : row.previousElementSibling;

    if (!(sibling instanceof HTMLElement)) return;

    event.preventDefault();
    sibling.focus();
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

        <span className="pb-2 text-xs leading-5 text-ui-muted">
          {formatCount(selected.size)} de {formatCount(rows.length)}{" "}
          seleccionados ·{" "}
          <kbd className="rounded border border-ui-border px-1">↑</kbd>{" "}
          <kbd className="rounded border border-ui-border px-1">↓</kbd> cambian
          de cliente,{" "}
          <kbd className="rounded border border-ui-border px-1">←</kbd>{" "}
          <kbd className="rounded border border-ui-border px-1">→</kbd> eligen
          DNI o línea,{" "}
          <kbd className="rounded border border-ui-border px-1">Espacio</kbd>{" "}
          copia ese dato y{" "}
          <kbd className="rounded border border-ui-border px-1">Shift</kbd> +{" "}
          <kbd className="rounded border border-ui-border px-1">Espacio</kbd>{" "}
          marca al cliente. Con el ratón, la fila entera marca y{" "}
          <kbd className="rounded border border-ui-border px-1">Shift</kbd> +
          clic extiende el rango.
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
          {pending ? "Aplicando…" : "Poner en espera"}
        </Button>
        <Button
          disabled={pending || selected.size === 0}
          name="decision"
          type="submit"
          value="LIBERADO"
        >
          {pending ? "Aplicando…" : "Dejar listo para repartir"}
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
        Si el cliente ya tiene un pedido en curso, ponlo{" "}
        <strong>en espera</strong>: reaparece mañana y sale solo si porta. Si no
        tiene pedido, déjalo <strong>listo para repartir</strong>.
        {canAssignTeams
          ? " «Entregar al equipo» manda el bloque a la bandeja de su supervisor."
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
              <th className="font-semibold">Cliente</th>
              <th className="font-semibold">DNI</th>
              <th className="font-semibold">Servicios</th>
              <th className="font-semibold">Plan</th>
              <th className="font-semibold">Cedente</th>
              {showTeamColumn ? (
                <th className="font-semibold">Equipo</th>
              ) : null}
              <th className="font-semibold">Último registro</th>
              {showStatusColumn ? (
                <th className="font-semibold">Estado</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {/*
             * Toda la fila selecciona: apuntar a una casilla de 13px por
             * cliente es el cuello de botella cuando hay que marcar decenas.
             * El clic con Shift sigue extendiendo el rango y los controles
             * internos (copiar DNI o línea) detienen la propagación.
             */}
            {rows.map((row, index) => (
              <tr
                aria-selected={selected.has(row.id)}
                className={`cursor-pointer select-none focus:outline-none ${
                  selected.has(row.id)
                    ? "bg-ui-accent-soft"
                    : "hover:bg-ui-subtle"
                }`}
                /* El marco lo pinta `.ui-table`: sobre `border-collapse` un
                   contorno en la fila no se dibuja, hay que marcar las celdas. */
                data-focused={
                  cursorVisible && index === rovingIndex ? "true" : undefined
                }
                key={row.id}
                onBlur={(event) => {
                  // `focusout` burbujea: moverse a otro dato de la misma fila,
                  // o a otra fila, no saca el cursor de la tabla.
                  if (
                    !event.currentTarget.parentElement?.contains(
                      event.relatedTarget,
                    )
                  ) {
                    setCursorVisible(false);
                  }
                }}
                onClick={(event) => handleRowClick(index, event.shiftKey)}
                onFocus={() => {
                  setFocusedIndex(index);
                  setCursorVisible(true);
                }}
                onKeyDown={(event) => handleRowKeyDown(event, index)}
                tabIndex={index === rovingIndex ? 0 : -1}
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
                <td className="font-medium text-ui-text">{row.holderName}</td>
                <td>
                  <CopyValue label="DNI" value={row.documentNumber} />
                </td>
                <td>
                  {/*
                   * Cada línea se copia sola: la consulta en OSIPTEL se hace
                   * número por número, y seleccionar texto dentro de una fila
                   * que además marca al cliente no es viable.
                   */}
                  <div className="flex flex-wrap items-center gap-1">
                    {row.serviceNumbers.map((serviceNumber) => (
                      <CopyValue
                        key={serviceNumber}
                        label="Línea"
                        value={serviceNumber}
                      />
                    ))}
                    {row.sightingCount > 1 ? (
                      <span className="rounded-full bg-ui-subtle px-2 py-0.5 text-[11px] text-ui-muted">
                        {row.sightingCount} apariciones
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="text-xs text-ui-muted">{row.planSummary}</td>
                <td className="text-xs">{row.carrierSummary}</td>
                {showTeamColumn ? (
                  <td className="text-xs">
                    {row.teamName ?? (
                      <span className="text-ui-muted">Sin equipo</span>
                    )}
                  </td>
                ) : null}
                <td className="ui-data text-ui-muted">
                  {row.lastSightingLabel}
                </td>
                {showStatusColumn ? (
                  <td className="text-xs">
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
                  No hay casos por revisar. Buen trabajo.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </form>
  );
}
