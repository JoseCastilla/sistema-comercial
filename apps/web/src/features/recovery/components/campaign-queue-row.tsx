"use client";

import Link from "next/link";
import { useCallback, useId, useState } from "react";

import {
  attemptResultLabels,
  attemptResultTones,
} from "../attempt-result-labels";
import {
  CampaignAttemptEditor,
  type ConfirmedAttempt,
} from "./campaign-attempt-editor";
import { useCampaignDraft } from "./campaign-draft-context";
import { CopyValue } from "./copy-value";

export interface CampaignQueueRowData {
  id: string;
  lastResult: string | null;
  /** Observación de la última gestión, como referencia; nunca se copia. */
  lastObservation: string | null;
  lastAttemptAtLabel: string | null;
  holderName: string;
  documentNumber: string;
  fatherName: string | null;
  motherName: string | null;
  birthPlace: string | null;
  phones: string[];
  services: Array<{
    serviceNumber: string;
    planRaw: string | null;
    carrierRaw: string | null;
    isPlantLine: boolean;
  }>;
  phone: string | null;
  location: string;
  address: string | null;
  reference: string | null;
  deliveryInstructions: string | null;
  mapsUrl: string | null;
  origin: { operator: string; detail: string | null } | null;
  status: string;
  planSummary: string;
  serviceCount: number;
  attemptsToday: number;
  nextActionAtLabel: string | null;
  overdue: boolean;
  habilitationOverdue: boolean;
  resolutionDue: boolean;
  interestedWithOrder: boolean;
}

/**
 * Fila de la cola de campaña con la ficha del cliente desplegable.
 *
 * Antes el único camino para ver los datos era «Abrir», que lleva a la ficha
 * completa y saca al asesor de su cola: pierde el filtro, la posición en la
 * lista y el hilo de a quién venía llamando. Los datos que necesita durante la
 * llamada se abren acá mismo; la ficha sigue existiendo para registrar el
 * intento y ver el historial.
 */
export function CampaignQueueRow({
  row,
  statusLabel,
  minimumDailyAttempts,
  queueContext,
  justVisited,
}: {
  row: CampaignQueueRowData;
  statusLabel: string;
  /** Filtros y página de la cola, para volver aquí desde la ficha. */
  queueContext?: string;
  /** El asesor acaba de consultar esta ficha y vuelve buscándola. */
  justVisited?: boolean;
  minimumDailyAttempts: number;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const editorId = useId();
  const draft = useCampaignDraft();
  const editing = draft.editingId === row.id;

  /**
   * Tras guardar, la fila enseña lo que el servidor confirmó y no lo que el
   * asesor escribió. Se queda en su sitio a propósito (BR-090): la lista se
   * reconcilia al actualizarla, no bajo las manos de quien trabaja.
   */
  const [confirmed, setConfirmed] = useState<ConfirmedAttempt | null>(null);
  const [unmanageableReason, setUnmanageableReason] = useState<string | null>(
    null,
  );

  const lastResult = confirmed?.result ?? row.lastResult;
  const lastObservation = confirmed
    ? confirmed.observation
    : row.lastObservation;
  const status = confirmed?.status ?? row.status;
  const attemptsToday = confirmed?.attemptsToday ?? row.attemptsToday;
  const nextActionAtLabel = confirmed
    ? confirmed.nextActionAtLabel
    : row.nextActionAtLabel;
  const tone = lastResult ? attemptResultTones[lastResult] : undefined;

  const handleSaved = useCallback((attempt: ConfirmedAttempt) => {
    setConfirmed(attempt);
  }, []);

  // Teléfonos de contacto primero, luego las líneas; sin repetir.
  const phoneOptions = [
    ...new Set([
      ...row.phones,
      ...row.services.map((service) => service.serviceNumber),
    ]),
  ];

  return (
    <>
      {/*
       * El ancla es el caso, no una altura de desplazamiento: la lista cambia
       * entre una visita y la vuelta —un caso se resuelve, otro entra— y un
       * número de píxeles apuntaría a otra fila. `scroll-mt` deja aire para
       * que la cabecera no la tape al saltar.
       */}
      <tr
        aria-selected={editing || undefined}
        className={editing ? "scroll-mt-24 bg-ui-accent-soft" : "scroll-mt-24"}
        data-result-tone={tone}
        id={`caso-${row.id}`}
      >
        {/* Tipificación: el último resultado, y desde aquí se registra el
            siguiente. Va primero porque es lo que el asesor escribe. */}
        <td className="text-xs">
          <span
            className="ui-status-badge"
            data-tone={lastResult ? (tone ?? "neutral") : "neutral"}
          >
            {lastResult
              ? (attemptResultLabels[lastResult] ?? lastResult)
              : "Sin gestión"}
          </span>
          {status === "SCHEDULED" || status === "WAITING" ? (
            <span className="block text-2xs text-ui-muted">{statusLabel}</span>
          ) : null}
          {row.lastAttemptAtLabel && !confirmed ? (
            <span className="block text-2xs text-ui-muted">
              {row.lastAttemptAtLabel}
            </span>
          ) : null}
          {unmanageableReason ? (
            <span className="block text-2xs text-ui-danger">
              {unmanageableReason}
            </span>
          ) : editing ? null : (
            <button
              aria-controls={editorId}
              aria-expanded={false}
              className="ui-row-toggle mt-1"
              onClick={() => draft.startEditing(row.id)}
              type="button"
            >
              Registrar gestión
            </button>
          )}
        </td>

        {/* Observación: la última, como referencia. La nueva se escribe en
            el editor y nunca se copia de aquí. */}
        <td className="text-xs">
          {lastObservation ? (
            <span className="ui-cell-clamp" title={lastObservation}>
              {lastObservation}
            </span>
          ) : (
            <span className="text-ui-muted">—</span>
          )}
        </td>

        <td className="font-medium text-ui-text">
          {row.holderName}
          {justVisited ? (
            <span className="ml-2 rounded-full bg-ui-subtle px-2 py-0.5 text-2xs text-ui-muted">
              Lo acabas de ver
            </span>
          ) : null}
          {row.resolutionDue ? (
            <span className="ml-2 rounded-full bg-ui-danger-soft px-2 py-0.5 text-2xs text-ui-danger">
              Resolver hoy
            </span>
          ) : null}
          {row.habilitationOverdue ? (
            <span className="ml-2 rounded-full bg-ui-warning-soft px-2 py-0.5 text-2xs text-ui-warning">
              Ya puede portar
            </span>
          ) : null}
          {row.interestedWithOrder ? (
            <span className="ml-2 rounded-full bg-ui-accent-soft px-2 py-0.5 text-2xs text-ui-accent">
              Tenía pedido en curso: pregunta si se cayó
            </span>
          ) : null}
        </td>
        <td>
          {row.phone ? (
            <CopyValue label="Teléfono" value={row.phone} />
          ) : (
            <span className="text-xs text-ui-muted">—</span>
          )}
        </td>
        <td>
          <CopyValue label="DNI" value={row.documentNumber} />
        </td>
        <td className="text-xs">
          {row.origin ? (
            <span className="font-medium text-ui-text">
              {row.origin.operator}
            </span>
          ) : (
            <span className="text-ui-muted">—</span>
          )}
          <span className="block text-2xs text-ui-muted">
            {row.planSummary}
            {row.serviceCount > 1 ? ` · ${row.serviceCount} líneas` : ""}
          </span>
          {row.origin?.detail ? (
            <span className="block text-2xs text-ui-muted">
              {row.origin.detail}
            </span>
          ) : null}
        </td>
        <td className="text-xs" data-numeric>
          <span
            className={
              status !== "SCHEDULED" &&
              status !== "WAITING" &&
              attemptsToday < minimumDailyAttempts
                ? "font-semibold text-ui-warning"
                : "text-ui-muted"
            }
          >
            {attemptsToday} / {minimumDailyAttempts}
          </span>
        </td>
        <td className="text-xs">
          <span
            className={
              row.overdue && !confirmed
                ? "font-semibold text-ui-danger"
                : "text-ui-muted"
            }
          >
            {nextActionAtLabel ?? "—"}
          </span>
        </td>
        <td className="text-xs" data-actions>
          <button
            aria-controls={panelId}
            aria-expanded={open}
            className="ui-row-toggle"
            onClick={() => setOpen((previo) => !previo)}
            type="button"
          >
            {open ? "Ocultar datos" : "Ver datos"}
          </button>
          <Link
            className="ml-3 text-ui-accent underline-offset-2 hover:underline"
            href={`/recovery/campaigns/${row.id}${
              queueContext ? `?${queueContext}` : ""
            }`}
          >
            Abrir
          </Link>
        </td>
      </tr>

      {editing ? (
        <tr data-result-tone={tone}>
          <td className="ui-row-panel" colSpan={9} id={editorId}>
            {/* En pantalla pequeña el editor va debajo del cliente con su
                nombre visible: las columnas fijas no existen ahí. */}
            <p className="mb-2 text-sm font-medium text-ui-text lg:hidden">
              {row.holderName} · {row.documentNumber}
            </p>
            <CampaignAttemptEditor
              caseId={row.id}
              defaultPhone={row.phone}
              holderName={row.holderName}
              lastObservation={lastObservation}
              lastResult={lastResult}
              onCancel={draft.stopEditing}
              onSaved={handleSaved}
              onUnmanageable={setUnmanageableReason}
              phoneOptions={phoneOptions}
            />
          </td>
        </tr>
      ) : null}

      {open ? (
        <tr data-result-tone={tone}>
          <td className="ui-row-panel" colSpan={9} id={panelId}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <section>
                <h3 className="ui-label-eyebrow">Identidad del titular</h3>
                <dl className="mt-1 space-y-0.5">
                  <div>
                    <dt className="sr-only">Padre</dt>
                    <dd>Padre: {row.fatherName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="sr-only">Madre</dt>
                    <dd>Madre: {row.motherName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="sr-only">Nacimiento</dt>
                    <dd>Nacimiento: {row.birthPlace ?? "—"}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="ui-label-eyebrow">Teléfonos de contacto</h3>
                {row.phones.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {row.phones.map((numero) => (
                      <li key={numero}>
                        <CopyValue label="Teléfono" value={numero} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-ui-muted">
                    Sin teléfono de contacto registrado.
                  </p>
                )}
              </section>

              <section>
                <h3 className="ui-label-eyebrow">Dónde entregar</h3>
                <div className="mt-1 space-y-0.5">
                  <p>{row.address ?? "Sin dirección en la base."}</p>
                  {row.location ? (
                    <p className="text-ui-muted">{row.location}</p>
                  ) : null}
                  {row.reference ? (
                    <p className="text-ui-muted">Referencia: {row.reference}</p>
                  ) : null}
                  {row.deliveryInstructions ? (
                    <p className="text-ui-muted">
                      Indicaciones: {row.deliveryInstructions}
                    </p>
                  ) : null}
                  {row.mapsUrl ? (
                    <a
                      className="inline-block text-ui-accent underline-offset-2 hover:underline"
                      href={row.mapsUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Ver en el mapa ↗
                    </a>
                  ) : null}
                </div>
              </section>

              <section>
                <h3 className="ui-label-eyebrow">Líneas a portar</h3>
                {row.services.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {row.services.map((service) => (
                      <li key={service.serviceNumber}>
                        <CopyValue
                          label="Línea"
                          value={service.serviceNumber}
                        />
                        <span className="ml-2 text-2xs text-ui-muted">
                          {[
                            service.carrierRaw,
                            service.planRaw,
                            service.isPlantLine ? "línea de planta" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-ui-muted">Sin líneas registradas.</p>
                )}
              </section>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
