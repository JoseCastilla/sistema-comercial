"use client";

import Link from "next/link";
import { useCallback, useId, useState } from "react";

import { campaignResolutionNote } from "@repo/validation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { attemptResultLabels } from "../attempt-result-labels";
import {
  CampaignAttemptEditor,
  type ConfirmedAttempt,
} from "./campaign-attempt-editor";
import { useCampaignDraft } from "./campaign-draft-context";
import { CopyValue } from "./copy-value";
import { PhoneNumber } from "./phone-number";

export interface CampaignQueueRowData {
  id: string;
  lastResult: string | null;
  /** Observación de la última gestión, como referencia; nunca se copia. */
  lastObservation: string | null;
  /** «08/09 12:40» (SPEC-065 BR-009). */
  lastAttemptAtLabel: string | null;
  holderName: string;
  documentNumber: string;
  fatherName: string | null;
  motherName: string | null;
  birthPlace: string | null;
  phones: string[];
  /** SPEC-049 BR-002: marcados como errados; se muestran tachados. */
  invalidPhones: string[];
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
  resolutionDue: boolean;
  interestedWithOrder: boolean;
  /** SPEC-049 BR-016: las últimas gestiones, para decidir sin salir de la fila. */
  recentAttempts: Array<{
    resultLabel: string;
    observation: string | null;
    createdAtLabel: string;
  }>;
  /**
   * Qué hacer, con la misma regla que «Mi día» (SPEC-065 BR-002, BR-004): la
   * frase, la nota que le dice algo al asesor y el plazo con su tono.
   */
  work: {
    action: string;
    note: string | null;
    due: { label: string; tone: "danger" | "warning" | "neutral" } | null;
  } | null;
}

/**
 * Fila de la cola de campaña (SPEC-065 BR-003): la misma de «Mi día». Plazo
 * arriba, cliente con su teléfono a la vista, qué hacer en una frase y las
 * acciones a la derecha, sin desplazarse de lado. Lo que es consulta —la
 * última gestión, operador y plan, los intentos— va en una línea menor, y lo
 * demás en «Ver datos». Antes era una tabla de diez columnas que en la
 * computadora escondía las acciones y en el celular escondía al cliente.
 *
 * El registro de la gestión se abre dentro de la fila (BR-090): el asesor no
 * pierde el filtro ni la posición. La ficha completa sigue en «Abrir caso».
 */
export function CampaignQueueRow({
  row,
  minimumDailyAttempts,
  queueContext,
  justVisited,
  nextId = null,
  nextName = null,
}: {
  row: CampaignQueueRowData;
  /** SPEC-049 BR-016: el siguiente caso de la lista, para «Guardar y siguiente». */
  nextId?: string | null;
  nextName?: string | null;
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
  /** Lo que el servidor dijo al guardar; se queda en la fila aunque el foco avance. */
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const lastResult = confirmed?.result ?? row.lastResult;
  const lastObservation = confirmed
    ? confirmed.observation
    : row.lastObservation;
  const attemptsToday = confirmed?.attemptsToday ?? row.attemptsToday;

  const handleSaved = useCallback(
    (attempt: ConfirmedAttempt, message: string, detail: string) => {
      setConfirmed(attempt);
      setSavedNote([message, detail].filter(Boolean).join(" "));
    },
    [],
  );

  /**
   * BR-016: tras confirmar el guardado, la gestión del siguiente caso se abre
   * y su fila entra en pantalla; el editor pone el foco en el resultado al
   * montarse. El servidor vuelve a comprobar permiso y elegibilidad al
   * guardar ese caso: si dejó de ser del asesor, lo dice ahí.
   */
  const openNext = useCallback(() => {
    if (!nextId) return;
    draft.startEditing(nextId);
    requestAnimationFrame(() => {
      document
        .getElementById(`caso-${nextId}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [draft, nextId]);

  /** Flechas arriba y abajo mueven el foco entre filas (BR-016). */
  function rowKeys(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const target = event.target as HTMLElement;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
    const rows = Array.from(
      event.currentTarget
        .closest("[data-case-list]")
        ?.querySelectorAll<HTMLElement>("[data-case-row]") ?? [],
    );
    const index = rows.indexOf(event.currentTarget);
    const sibling = rows[index + (event.key === "ArrowDown" ? 1 : -1)];
    const action = sibling?.querySelector<HTMLElement>("[data-row-action]");
    if (action) {
      event.preventDefault();
      action.focus();
    }
  }

  // Teléfonos de contacto primero, luego las líneas; sin repetir.
  const phoneOptions = [
    ...new Set([
      ...row.phones,
      ...row.services.map((service) => service.serviceNumber),
    ]),
  ];

  const lastLine = lastResult
    ? [
        `Última gestión: ${attemptResultLabels[lastResult] ?? lastResult}`,
        confirmed ? null : row.lastAttemptAtLabel,
        lastObservation ? `«${lastObservation}»` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Sin gestión";
  const lineLine = [
    row.origin?.operator,
    row.planSummary !== "—" ? row.planSummary : null,
    row.serviceCount > 1 ? `${row.serviceCount} líneas` : null,
    row.origin?.detail,
  ]
    .filter(Boolean)
    .join(" · ");
  const countsAttempts = row.status !== "SCHEDULED" && row.status !== "WAITING";

  return (
    /*
     * El ancla es el caso, no una altura de desplazamiento: la lista cambia
     * entre una visita y la vuelta —un caso se resuelve, otro entra— y un
     * número de píxeles apuntaría a otra fila. `scroll-mt` deja aire para
     * que la cabecera no la tape al saltar.
     */
    <article
      aria-current={editing || undefined}
      className={`scroll-mt-24 rounded-lg border bg-ui-surface ${
        editing ? "border-ui-accent" : "border-ui-border"
      } ${confirmed && !editing ? "opacity-70" : ""}`}
      data-case-row
      id={`caso-${row.id}`}
      onKeyDown={rowKeys}
    >
      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ui-soft">
            {confirmed ? (
              <Badge tone="success">
                Gestionado:{" "}
                {attemptResultLabels[confirmed.result] ?? confirmed.result}
              </Badge>
            ) : row.work?.due ? (
              <Badge tone={row.work.due.tone}>{row.work.due.label}</Badge>
            ) : null}
            {justVisited ? <Badge>Lo acabas de ver</Badge> : null}
          </p>
          <h3 className="mt-1 flex flex-wrap items-baseline gap-x-3 text-base font-semibold text-ui-text">
            <span className="min-w-0 truncate">{row.holderName}</span>
            {row.phone ? <PhoneNumber phone={row.phone} /> : null}
          </h3>
          <p className="mt-0.5 text-sm text-ui-text">
            {confirmed
              ? confirmed.nextActionAtLabel
                ? `Próxima acción: ${confirmed.nextActionAtLabel}`
                : "Gestión registrada"
              : (row.work?.action ?? "Sin tarea")}
          </p>
          {unmanageableReason ? (
            <p className="mt-0.5 text-xs text-ui-danger">{unmanageableReason}</p>
          ) : null}
          {row.resolutionDue && !confirmed ? (
            <p className="mt-0.5 text-xs font-medium text-ui-warning">
              {campaignResolutionNote}
            </p>
          ) : null}
          {row.interestedWithOrder && !confirmed ? (
            <p className="mt-0.5 text-xs text-ui-accent">
              Tenía pedido en curso: pregunta si se cayó
            </p>
          ) : null}
          {row.work?.note && !confirmed ? (
            <p className="mt-0.5 text-xs text-ui-muted">{row.work.note}</p>
          ) : null}
          {savedNote && !editing ? (
            <p className="mt-0.5 text-xs text-ui-success" role="status">
              ✓ {savedNote}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-ui-muted">
            <span className="line-clamp-2">{lastLine}</span>
            <span className="block">
              {[
                lineLine || null,
                countsAttempts
                  ? `${attemptsToday} de ${minimumDailyAttempts} hoy`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <Button
            aria-controls={panelId}
            aria-expanded={open}
            onClick={() => setOpen((previo) => !previo)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {open ? "Ocultar datos" : "Ver datos"}
          </Button>
          <Button asChild size="inline" variant="link">
            <Link
              href={`/recovery/campaigns/${row.id}${
                queueContext ? `?${queueContext}` : ""
              }`}
            >
              Abrir caso
            </Link>
          </Button>
          {unmanageableReason || editing ? null : (
            <Button
              aria-controls={editorId}
              aria-expanded={false}
              aria-label={`Registrar gestión: ${row.holderName}`}
              data-row-action
              onClick={() => draft.startEditing(row.id)}
              type="button"
            >
              {confirmed ? "Otra gestión" : "Registrar gestión"}
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <div
          className="border-t border-ui-border bg-ui-subtle p-4"
          id={editorId}
        >
          <CampaignAttemptEditor
            caseId={row.id}
            defaultPhone={row.phone}
            holderName={row.holderName}
            lastObservation={lastObservation}
            lastResult={lastResult}
            nextName={nextName}
            onCancel={draft.stopEditing}
            onNext={nextId ? openNext : undefined}
            onSaved={handleSaved}
            onUnmanageable={setUnmanageableReason}
            phoneOptions={phoneOptions}
            serviceNumbers={row.services.map((service) => service.serviceNumber)}
          />
        </div>
      ) : null}

      {open ? (
        <div
          className="grid gap-4 border-t border-ui-border bg-ui-subtle p-4 text-xs sm:grid-cols-2 lg:grid-cols-3"
          id={panelId}
        >
          <section>
            <h4 className="ui-label-eyebrow">Identidad del titular</h4>
            <dl className="mt-1 space-y-0.5">
              <div>
                <dt className="sr-only">DNI</dt>
                <dd>
                  <CopyValue label="DNI" value={row.documentNumber} />
                </dd>
              </div>
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
            <h4 className="ui-label-eyebrow">Teléfonos de contacto</h4>
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
            {row.invalidPhones.length > 0 ? (
              <p className="mt-1 text-2xs text-ui-muted">
                Errados:{" "}
                {row.invalidPhones.map((numero, index) => (
                  <span key={numero}>
                    {index > 0 ? " · " : ""}
                    <s>{numero}</s>
                  </span>
                ))}
              </p>
            ) : null}
          </section>

          <section>
            <h4 className="ui-label-eyebrow">Últimas gestiones</h4>
            {row.recentAttempts.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {row.recentAttempts.map((attempt, index) => (
                  <li key={index}>
                    <span className="font-medium text-ui-text">
                      {attempt.resultLabel}
                    </span>
                    <span className="ml-1 text-2xs text-ui-muted">
                      {attempt.createdAtLabel}
                    </span>
                    {attempt.observation ? (
                      <span className="block text-2xs text-ui-muted">
                        {attempt.observation}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-ui-muted">Sin gestión registrada.</p>
            )}
          </section>

          <section>
            <h4 className="ui-label-eyebrow">Dónde entregar</h4>
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
            <h4 className="ui-label-eyebrow">Líneas a portar</h4>
            {row.services.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {row.services.map((service) => (
                  <li key={service.serviceNumber}>
                    <CopyValue label="Línea" value={service.serviceNumber} />
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
      ) : null}
    </article>
  );
}
