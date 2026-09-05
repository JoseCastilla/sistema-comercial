"use client";

import Link from "next/link";
import { useId, useState } from "react";

import {
  attemptResultLabels,
  attemptResultTones,
} from "../attempt-result-labels";
import { CopyValue } from "./copy-value";

export interface CampaignQueueRowData {
  id: string;
  lastResult: string | null;
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
  const tone = row.lastResult ? attemptResultTones[row.lastResult] : undefined;

  return (
    <>
      {/*
       * El ancla es el caso, no una altura de desplazamiento: la lista cambia
       * entre una visita y la vuelta —un caso se resuelve, otro entra— y un
       * número de píxeles apuntaría a otra fila. `scroll-mt` deja aire para
       * que la cabecera no la tape al saltar.
       */}
      <tr data-result-tone={tone} id={`caso-${row.id}`} className="scroll-mt-24">
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
            <>
              <span className="font-medium text-ui-text">
                {row.origin.operator}
              </span>
              {row.origin.detail ? (
                <span className="block text-2xs text-ui-muted">
                  {row.origin.detail}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-ui-muted">—</span>
          )}
        </td>
        <td className="text-xs text-ui-muted">
          {row.planSummary}
          {row.serviceCount > 1 ? ` · ${row.serviceCount} líneas` : ""}
        </td>
        <td className="text-xs">
          {statusLabel}
          {row.lastResult ? (
            <span className="block text-2xs text-ui-muted">
              {attemptResultLabels[row.lastResult] ?? row.lastResult}
            </span>
          ) : null}
        </td>
        <td className="text-xs" data-numeric>
          <span
            className={
              row.status !== "SCHEDULED" &&
              row.status !== "WAITING" &&
              row.attemptsToday < minimumDailyAttempts
                ? "font-semibold text-ui-warning"
                : "text-ui-muted"
            }
          >
            {row.attemptsToday} / {minimumDailyAttempts}
          </span>
        </td>
        <td className="text-xs">
          <span
            className={
              row.overdue ? "font-semibold text-ui-danger" : "text-ui-muted"
            }
          >
            {row.nextActionAtLabel ?? "—"}
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
