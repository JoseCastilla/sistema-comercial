"use client";

import {
  impedimentReasons,
  noContactReasons,
  recoveryAttemptFields,
  recoveryAttemptReasonLabels,
} from "@repo/validation";

/**
 * Lo que el asesor completa según el resultado — SPEC-049 BR-009/BR-010.
 * Tres preguntas: qué pasó (el resultado, elegido fuera), por qué (motivo o
 * impedimento) y qué sigue (fecha, pausa, línea). Solo aparecen los campos
 * que la consecuencia necesita; la observación es libre y no sustituye a
 * ninguno.
 */
export interface AttemptExtras {
  reason: string;
  interestedNext: "" | "cita" | "seguimiento";
  scheduledAt: string;
  followUpDate: string;
  reportedDate: string;
  serviceNumber: string;
  pauseDays: "1" | "2";
  needsSupervisor: boolean;
}

export const emptyAttemptExtras: AttemptExtras = {
  reason: "",
  interestedNext: "",
  scheduledAt: "",
  followUpDate: "",
  reportedDate: "",
  serviceNumber: "",
  pauseDays: "1",
  needsSupervisor: false,
};

const inputClass =
  "mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text";

export function AttemptResultFields({
  result,
  extras,
  onChange,
  serviceNumbers,
  idPrefix,
  errorId,
}: {
  result: string;
  extras: AttemptExtras;
  onChange: (next: Partial<AttemptExtras>) => void;
  /** Líneas activas del caso, para «no cumple antigüedad». */
  serviceNumbers: string[];
  idPrefix: string;
  errorId?: string;
}) {
  const fields = recoveryAttemptFields(result);
  const shows = (field: string) =>
    fields.required.includes(field as never) ||
    fields.optional.includes(field as never);

  const reasons =
    result === "IMPEDIMENTO"
      ? impedimentReasons
      : result === "SIN_RESPUESTA"
        ? noContactReasons
        : [];

  return (
    <>
      {shows("reason") || shows("impedimentReason") ? (
        <label className="block text-sm">
          <span className="ui-label-eyebrow">
            {result === "IMPEDIMENTO" ? "Qué lo impide" : "Por qué no contestó"}
          </span>
          <select
            className={inputClass}
            name="reason"
            onChange={(event) => onChange({ reason: event.target.value })}
            required={result === "IMPEDIMENTO"}
            value={extras.reason}
          >
            {result === "IMPEDIMENTO" ? (
              <option value="">Elige el motivo…</option>
            ) : (
              <option value="">No contesta</option>
            )}
            {reasons
              .filter((reason) => result === "IMPEDIMENTO" || reason !== "NO_CONTESTA")
              .map((reason) => (
                <option key={reason} value={reason}>
                  {recoveryAttemptReasonLabels[reason]}
                </option>
              ))}
          </select>
        </label>
      ) : null}

      {shows("interestedNext") ? (
        <fieldset className="text-sm">
          <legend className="ui-label-eyebrow">Qué sigue</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {(
              [
                ["", "Seguir hoy"],
                ["cita", "Llamada acordada"],
                ["seguimiento", "Seguimiento en una fecha"],
              ] as const
            ).map(([value, label]) => (
              <label className="flex items-center gap-1" key={value || "hoy"}>
                <input
                  checked={extras.interestedNext === value}
                  name="interestedNext"
                  onChange={() => onChange({ interestedNext: value })}
                  type="radio"
                  value={value}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {shows("scheduledAt") ||
      (shows("interestedNext") && extras.interestedNext === "cita") ? (
        <label className="block text-sm lg:col-span-2">
          <span className="ui-label-eyebrow">Fecha y hora acordadas</span>
          <input
            aria-describedby={errorId}
            className={inputClass}
            id={`${idPrefix}-scheduledAt`}
            name="scheduledAt"
            onChange={(event) => onChange({ scheduledAt: event.target.value })}
            type="datetime-local"
            value={extras.scheduledAt}
          />
        </label>
      ) : null}

      {shows("followUpDate") ||
      (shows("interestedNext") && extras.interestedNext === "seguimiento") ? (
        <label className="block text-sm">
          <span className="ui-label-eyebrow">Fecha del seguimiento</span>
          <input
            className={inputClass}
            name="followUpDate"
            onChange={(event) => onChange({ followUpDate: event.target.value })}
            required={result === "IMPEDIMENTO"}
            type="date"
            value={extras.followUpDate}
          />
        </label>
      ) : null}

      {shows("pauseDays") ? (
        <label className="block text-sm">
          <span className="ui-label-eyebrow">Pausa antes de reintentar</span>
          <select
            className={inputClass}
            name="pauseDays"
            onChange={(event) =>
              onChange({ pauseDays: event.target.value === "2" ? "2" : "1" })
            }
            value={extras.pauseDays}
          >
            <option value="1">1 día</option>
            <option value="2">2 días</option>
          </select>
        </label>
      ) : null}

      {shows("serviceNumber") ? (
        <label className="block text-sm">
          <span className="ui-label-eyebrow">Línea que no cumple</span>
          {serviceNumbers.length <= 1 ? (
            <>
              <input
                name="serviceNumber"
                type="hidden"
                value={serviceNumbers[0] ?? ""}
              />
              <span className="mt-1 block text-ui-text">
                {serviceNumbers[0] ?? "Sin línea activa"}
              </span>
            </>
          ) : (
            <select
              className={inputClass}
              name="serviceNumber"
              onChange={(event) => onChange({ serviceNumber: event.target.value })}
              required
              value={extras.serviceNumber}
            >
              <option value="">Elige la línea…</option>
              {serviceNumbers.map((serviceNumber) => (
                <option key={serviceNumber} value={serviceNumber}>
                  {serviceNumber}
                </option>
              ))}
            </select>
          )}
        </label>
      ) : null}

      {shows("reportedDate") ? (
        <label className="block text-sm">
          <span className="ui-label-eyebrow">
            Fecha de portación que dio el cliente
          </span>
          <input
            className={inputClass}
            name="reportedDate"
            onChange={(event) => onChange({ reportedDate: event.target.value })}
            type="date"
            value={extras.reportedDate}
          />
          <span className="mt-1 block text-xs text-ui-muted">
            Déjala vacía si no la sabe: queda la tarea de pedírsela.
          </span>
        </label>
      ) : null}

      {shows("needsSupervisor") ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={extras.needsSupervisor}
            name="needsSupervisor"
            onChange={(event) =>
              onChange({ needsSupervisor: event.target.checked })
            }
            type="checkbox"
            value="on"
          />
          Necesito apoyo de mi supervisor
        </label>
      ) : null}
    </>
  );
}
