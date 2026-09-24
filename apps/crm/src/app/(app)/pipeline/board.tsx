"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { StatusBadge } from "@repo/ui/status-badge";

import type { OpportunityStage } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/time";
import type { PipelineCard } from "@/server/opportunities/queries";
import {
  canTransition,
  LOST_REASONS,
  manualTargets,
  NEXT_ACTION_LABELS,
  ORIGIN_LABELS,
  RELATION_LABELS,
  soles,
  STAGE_HINTS,
  STAGE_LABELS,
} from "@/server/opportunities/rules";

import { moveStage } from "./actions";

/**
 * Tablero del embudo. El arrastre es el nativo del navegador (draggable +
 * dragover + drop): sin librerías. Soltar en Ganada no se permite y se
 * explica; soltar en Perdida o retroceder pide motivo antes de guardar.
 */

type PendingMove = { card: PipelineCard; stage: OpportunityStage; mode: "lost" | "reason" };

export function PipelineBoard({
  cards,
  columns,
  view,
  canMove,
  timezone,
}: {
  cards: PipelineCard[];
  columns: OpportunityStage[];
  view: "tablero" | "lista";
  canMove: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<OpportunityStage | null>(null);
  const [move, setMove] = useState<PendingMove | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (move && !dialog.open) dialog.showModal();
    if (!move && dialog.open) dialog.close();
  }, [move]);

  function submit(card: PipelineCard, stage: OpportunityStage, extra?: { reason?: string; lostReason?: string; lostDetail?: string }) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", card.id);
      formData.set("stage", stage);
      if (extra?.reason) formData.set("reason", extra.reason);
      if (extra?.lostReason) formData.set("lostReason", extra.lostReason);
      if (extra?.lostDetail) formData.set("lostDetail", extra.lostDetail);
      const result = await moveStage({}, formData);
      if (result.error) {
        setNotice({ tone: "danger", text: result.error });
      } else {
        setNotice({ tone: "success", text: result.message ?? "Guardado." });
        setMove(null);
        router.refresh();
      }
    });
  }

  function request(card: PipelineCard, stage: OpportunityStage) {
    setNotice(null);
    if (!canMove) {
      setNotice({ tone: "danger", text: "El back office consulta el embudo pero no mueve oportunidades." });
      return;
    }
    const verdict = canTransition(card.stage, stage, "USER");
    if (!verdict.allowed) {
      setNotice({ tone: "danger", text: verdict.message });
      return;
    }
    if (stage === "PERDIDA") {
      setMove({ card, stage, mode: "lost" });
      return;
    }
    if (verdict.requiresReason) {
      setMove({ card, stage, mode: "reason" });
      return;
    }
    submit(card, stage);
  }

  function onDropIn(stage: OpportunityStage) {
    setOver(null);
    const card = cards.find((item) => item.id === dragging);
    setDragging(null);
    if (card) request(card, stage);
  }

  function confirmDialog(formData: FormData) {
    if (!move) return;
    if (move.mode === "lost") {
      submit(move.card, move.stage, {
        lostReason: String(formData.get("lostReason") ?? ""),
        lostDetail: String(formData.get("lostDetail") ?? ""),
      });
    } else {
      submit(move.card, move.stage, { reason: String(formData.get("reason") ?? "") });
    }
  }

  const cardFor = (stage: OpportunityStage) => cards.filter((card) => card.stage === stage);

  return (
    <>
      {notice ? (
        <p className="ui-feedback pipeline-feedback" data-tone={notice.tone} role="status">
          {notice.text}
        </p>
      ) : null}

      {view === "lista" ? (
        <div className="pipeline-list">
          {cards.length === 0 ? <p className="pipeline-column__empty">Sin oportunidades con estos filtros.</p> : null}
          {cards.map((card) => (
            <article className="pipeline-list__row" key={card.id}>
              <div className="pipeline-list__main">
                <Link className="pipeline-card__name" href={`/pipeline/${card.id}`}>
                  {card.contactName}
                </Link>
                <span className="pipeline-card__phone">{card.contactPhone ?? "Sin teléfono"}</span>
                <div className="pipeline-card__badges">
                  <StatusBadge tone="neutral">{STAGE_LABELS[card.stage]}</StatusBadge>
                  <StatusBadge tone="info">{ORIGIN_LABELS[card.origin]}</StatusBadge>
                  <StatusBadge tone={card.customerRelation === "EXISTING" ? "success" : "neutral"}>{RELATION_LABELS[card.customerRelation]}</StatusBadge>
                </div>
                <p className="pipeline-card__meta" data-tone={card.nextActionOverdue ? "danger" : undefined}>
                  {card.nextActionKind
                    ? `${NEXT_ACTION_LABELS[card.nextActionKind as keyof typeof NEXT_ACTION_LABELS] ?? card.nextActionKind}: ${formatDateTime(card.nextActionAt, timezone)}${card.nextActionOverdue ? " · venció" : ""}`
                    : "Sin siguiente acción"}
                </p>
                <p className="pipeline-card__foot">
                  <span>{card.assignedName ?? "Sin responsable"}</span>
                  <span>{card.daysInStage} d en la etapa</span>
                  <span>{soles(card.proposalFixedCharge)}</span>
                </p>
              </div>
              {canMove && manualTargets(card.stage).length > 0 ? (
                <label className="pipeline-list__move ui-field">
                  <span className="ui-field__label">Mover a</span>
                  <select
                    className="ui-control ui-control--select"
                    disabled={pending}
                    onChange={(event) => {
                      const value = event.target.value as OpportunityStage | "";
                      event.currentTarget.value = "";
                      if (value) request(card, value);
                    }}
                    value=""
                  >
                    <option value="">Elegir etapa…</option>
                    {manualTargets(card.stage).map((stage) => (
                      <option key={stage} value={stage}>
                        {STAGE_LABELS[stage]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="pipeline-board">
          {columns.map((stage) => {
            const items = cardFor(stage);
            const blocked = dragging !== null && !canTransition(cards.find((card) => card.id === dragging)?.stage ?? stage, stage, "USER").allowed;
            return (
              <section
                className="pipeline-column"
                data-blocked={blocked ? "true" : "false"}
                data-over={over === stage ? "true" : "false"}
                key={stage}
                onDragLeave={() => setOver((current) => (current === stage ? null : current))}
                onDragOver={(event) => {
                  event.preventDefault();
                  setOver(stage);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  onDropIn(stage);
                }}
              >
                <header className="pipeline-column__header">
                  <h2 className="pipeline-column__title">{STAGE_LABELS[stage]}</h2>
                  <span className="pipeline-column__count">{items.length}</span>
                </header>
                <p className="pipeline-column__hint">{STAGE_HINTS[stage]}</p>
                {items.length === 0 ? <p className="pipeline-column__empty">Vacía</p> : null}
                {items.map((card) => (
                  <article
                    className="pipeline-card"
                    data-dragging={dragging === card.id ? "true" : "false"}
                    draggable={canMove}
                    key={card.id}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", card.id);
                      setDragging(card.id);
                    }}
                  >
                    <Link className="pipeline-card__name" href={`/pipeline/${card.id}`}>
                      {card.contactName}
                    </Link>
                    <span className="pipeline-card__phone">{card.contactPhone ?? "Sin teléfono"}</span>
                    <div className="pipeline-card__badges">
                      <StatusBadge tone="info">{ORIGIN_LABELS[card.origin]}</StatusBadge>
                      <StatusBadge tone={card.customerRelation === "EXISTING" ? "success" : "neutral"}>{RELATION_LABELS[card.customerRelation]}</StatusBadge>
                      {card.orderDropped ? <StatusBadge tone="danger">Pedido caído</StatusBadge> : null}
                    </div>
                    <p className="pipeline-card__meta" data-tone={card.nextActionOverdue ? "danger" : undefined}>
                      {card.nextActionKind
                        ? `${NEXT_ACTION_LABELS[card.nextActionKind as keyof typeof NEXT_ACTION_LABELS] ?? card.nextActionKind}: ${formatDateTime(card.nextActionAt, timezone)}${card.nextActionOverdue ? " · venció" : ""}`
                        : "Sin siguiente acción"}
                    </p>
                    <p className="pipeline-card__foot">
                      <span>{card.assignedName ?? "Sin responsable"}</span>
                      <span>{card.daysInStage} d</span>
                      <span>{soles(card.proposalFixedCharge)}</span>
                    </p>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}

      <dialog className="pipeline-dialog" onClose={() => setMove(null)} ref={dialogRef}>
        {move ? (
          <form action={confirmDialog}>
            <h2 className="pipeline-dialog__title">
              {move.mode === "lost" ? "Cerrar como perdida" : `Mover a ${STAGE_LABELS[move.stage]}`}
            </h2>
            <p className="pipeline-dialog__description">
              {move.mode === "lost"
                ? `${move.card.contactName} deja de trabajarse. Elige por qué: eso es lo que se mide después.`
                : `${move.card.contactName} vuelve atrás en el embudo. Escribe qué pasó para que quede en el historial.`}
            </p>
            {move.mode === "lost" ? (
              <>
                <label className="ui-field">
                  <span className="ui-field__label">Motivo</span>
                  <select className="ui-control ui-control--select" name="lostReason" required>
                    {LOST_REASONS.map((reason) => (
                      <option key={reason.code} value={reason.code}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ui-field">
                  <span className="ui-field__label">Detalle</span>
                  <textarea className="ui-control" name="lostDetail" rows={2} />
                  <span className="ui-field__hint">Obligatorio si el motivo es «Otro».</span>
                </label>
              </>
            ) : (
              <label className="ui-field">
                <span className="ui-field__label">Motivo</span>
                <input className="ui-control" name="reason" required />
              </label>
            )}
            <div className="pipeline-dialog__actions">
              <button className="ui-button ui-button--quiet" onClick={() => setMove(null)} type="button">
                Cancelar
              </button>
              <button className="ui-button ui-button--primary" disabled={pending} type="submit">
                {pending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>
  );
}
