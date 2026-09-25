"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { attemptResultLabels } from "../attempt-result-labels";
import {
  CampaignAttemptEditor,
  type ConfirmedAttempt,
} from "./campaign-attempt-editor";
import { useCampaignDraft } from "./campaign-draft-context";
import { CancelCommitmentForm } from "./cancel-commitment-form";
import { PhoneNumber } from "./phone-number";
import { RescheduleCommitmentForm } from "./reschedule-commitment-form";

import type { AgendaEntry } from "../server/get-agenda";

type AgendaCommitmentView = AgendaEntry;

interface NextCase {
  caseId: string;
  commitmentId: string;
  title: string;
}

/**
 * Una lista de citas (SPEC-066 BR-009). «Guardar y siguiente» recorre las
 * citas pendientes en el orden en que se ven.
 */
export function AgendaCommitmentList({
  entries,
  showDate = false,
  openCommitmentId = "",
}: {
  entries: AgendaCommitmentView[];
  /** En «Vencidas» las citas son de días distintos: se dice la fecha. */
  showDate?: boolean;
  /** La cita pedida con `cita=<id>`: abre su historial. */
  openCommitmentId?: string;
}) {
  const pending = entries.filter((entry) => entry.isPending);
  const next = new Map<string, NextCase>();
  pending.forEach((entry, index) => {
    const following = pending[index + 1];
    if (following) {
      next.set(entry.commitmentId, {
        caseId: following.caseId,
        commitmentId: following.commitmentId,
        title: following.holderName,
      });
    }
  });

  return (
    <ol className="grid gap-2" data-case-list>
      {entries.map((entry) => (
        <li key={entry.key}>
          <AgendaCommitmentRow
            entry={entry}
            next={next.get(entry.commitmentId) ?? null}
            opened={entry.commitmentId === openCommitmentId}
            showDate={showDate}
          />
        </li>
      ))}
    </ol>
  );
}

type Panel = "reprogramar" | "cancelar" | "historial" | null;

/**
 * La cita como la fila de «Mi día»: hora y plazo arriba, cliente con su
 * teléfono, el motivo y la última gestión. Atenderla es registrar qué pasó,
 * con el mismo editor de la cola; reprogramar, cancelar e historial son
 * acciones secundarias de la misma tarjeta. Antes eran tres formularios
 * apilados en un panel encima de la agenda, y el registro usaba listas
 * desplegables en vez de los botones del editor.
 */
function AgendaCommitmentRow({
  entry,
  next,
  showDate,
  opened,
}: {
  entry: AgendaCommitmentView;
  next: NextCase | null;
  showDate: boolean;
  opened: boolean;
}) {
  const draft = useCampaignDraft();
  const editorId = useId();
  const panelId = useId();
  // Un caso puede tener en pantalla su cita viva y otras ya cerradas: el
  // editor se abre solo en la viva.
  const editing = entry.isPending && draft.editingId === entry.caseId;
  const [panel, setPanel] = useState<Panel>(opened ? "historial" : null);
  const [saved, setSaved] = useState<ConfirmedAttempt | null>(null);
  const [unmanageable, setUnmanageable] = useState<string | null>(null);

  const handleSaved = useCallback((attempt: ConfirmedAttempt) => {
    setSaved(attempt);
  }, []);

  // La cita pedida desde la ficha del caso (`cita=<id>`) entra en pantalla.
  useEffect(() => {
    if (!opened) return;
    document
      .getElementById(`cita-${entry.commitmentId}`)
      ?.scrollIntoView({ block: "center" });
  }, [opened, entry.commitmentId]);

  const openNext = useCallback(() => {
    if (!next) return;
    draft.startEditing(next.caseId);
    requestAnimationFrame(() => {
      document
        .getElementById(`cita-${next.commitmentId}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [draft, next]);

  function toggle(target: Exclude<Panel, null>) {
    setPanel((current) => (current === target ? null : target));
  }

  const live = entry.isPending && !saved;
  const lastLine = entry.lastResultLabel
    ? [
        `Última gestión: ${entry.lastResultLabel}`,
        entry.lastAttemptAtLabel,
        entry.lastObservation ? `«${entry.lastObservation}»` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Sin gestión todavía";

  return (
    <article
      className={`scroll-mt-24 rounded-lg border bg-ui-surface ${
        editing || opened ? "border-ui-accent" : "border-ui-border"
      } ${entry.isPending ? "" : "opacity-70"}`}
      data-case-row
      id={`cita-${entry.commitmentId}`}
    >
      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ui-soft">
            <span className="text-sm font-semibold tabular-nums text-ui-text">
              {showDate
                ? `${entry.dayIso.slice(8, 10)}/${entry.dayIso.slice(5, 7)} ${entry.timeLabel}`
                : entry.timeLabel}
            </span>
            {saved ? (
              <Badge tone="success">
                Atendida: {attemptResultLabels[saved.result] ?? saved.result}
              </Badge>
            ) : entry.due ? (
              <Badge tone={entry.due.tone}>{entry.due.label}</Badge>
            ) : (
              <Badge>{entry.stateLabel}</Badge>
            )}
            {entry.source === "venta_caida" ? (
              <span>Venta caída · {entry.saleLabel}</span>
            ) : null}
            {entry.clash && live ? (
              <span className="text-ui-warning">Otra cita a la misma hora</span>
            ) : null}
          </p>
          <h3 className="mt-1 flex flex-wrap items-baseline gap-x-3 text-base font-semibold text-ui-text">
            <span className="min-w-0 truncate">{entry.holderName}</span>
            {entry.phone ? <PhoneNumber phone={entry.phone} /> : null}
          </h3>
          <p className="mt-0.5 text-sm text-ui-text">
            {saved
              ? saved.nextActionAtLabel
                ? `Próxima acción: ${saved.nextActionAtLabel}`
                : "Gestión registrada"
              : entry.reason
                ? `Acordado: «${entry.reason}»`
                : entry.isPending
                  ? "Llamar: cita acordada"
                  : entry.stateLabel}
          </p>
          {unmanageable ? (
            <p className="mt-0.5 text-xs text-ui-danger">{unmanageable}</p>
          ) : null}
          <p className="mt-1 line-clamp-2 text-xs text-ui-muted">{lastLine}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {live ? (
            <>
              <Button
                aria-controls={panelId}
                aria-expanded={panel === "reprogramar"}
                onClick={() => toggle("reprogramar")}
                size="sm"
                type="button"
                variant="ghost"
              >
                Reprogramar
              </Button>
              <Button
                aria-controls={panelId}
                aria-expanded={panel === "cancelar"}
                onClick={() => toggle("cancelar")}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cancelar cita
              </Button>
            </>
          ) : null}
          {entry.history.length > 0 ? (
            <Button
              aria-controls={panelId}
              aria-expanded={panel === "historial"}
              onClick={() => toggle("historial")}
              size="sm"
              type="button"
              variant="ghost"
            >
              Historial
            </Button>
          ) : null}
          <Button asChild size="inline" variant="link">
            <Link href={entry.caseHref}>Abrir caso</Link>
          </Button>
          {live && !editing && !unmanageable ? (
            <Button
              aria-controls={editorId}
              aria-expanded={false}
              aria-label={`Registrar gestión: ${entry.holderName}`}
              data-row-action
              onClick={() => {
                setPanel(null);
                draft.startEditing(entry.caseId);
              }}
              type="button"
            >
              Registrar gestión
            </Button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="border-t border-ui-border bg-ui-subtle p-4" id={editorId}>
          <CampaignAttemptEditor
            caseId={entry.caseId}
            defaultPhone={entry.phone}
            holderName={entry.holderName}
            lastObservation={entry.lastObservation}
            lastResult={entry.lastResult}
            nextName={next?.title ?? null}
            onCancel={draft.stopEditing}
            onNext={next ? openNext : undefined}
            onSaved={handleSaved}
            onUnmanageable={setUnmanageable}
            phoneOptions={entry.phoneOptions}
            serviceNumbers={entry.serviceNumbers}
          />
        </div>
      ) : null}

      {panel && !editing ? (
        <div
          className="border-t border-ui-border bg-ui-subtle p-4 text-sm"
          id={panelId}
        >
          {panel === "reprogramar" ? (
            <RescheduleCommitmentForm commitmentId={entry.commitmentId} />
          ) : panel === "cancelar" ? (
            <CancelCommitmentForm commitmentId={entry.commitmentId} />
          ) : (
            <ul className="space-y-1 text-xs">
              {entry.history.map((item) => (
                <li key={item.id}>
                  <span className="font-medium text-ui-text">{item.atLabel}</span>
                  <span className="ml-2 text-ui-muted">
                    {item.stateLabel} · la acordó {item.createdByName}
                  </span>
                  {item.reason ? (
                    <span className="block text-ui-muted">{item.reason}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </article>
  );
}
