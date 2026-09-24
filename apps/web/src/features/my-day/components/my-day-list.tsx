"use client";

import Link from "next/link";
import { useCallback, useId, useState } from "react";

import { myDayTierLabels, myDayTierOrder, type MyDayTier } from "@repo/validation";

import { attemptResultLabels } from "@/features/recovery/attempt-result-labels";
import {
  CampaignAttemptEditor,
  type ConfirmedAttempt,
} from "@/features/recovery/components/campaign-attempt-editor";
import { useCampaignDraft } from "@/features/recovery/components/campaign-draft-context";

import { myDayKindLabels, type MyDayEntry } from "../my-day-types";

interface NextCase {
  caseId: string;
  title: string;
}

/**
 * «Guardar y siguiente» recorre los casos de la lista en el orden en que se
 * ven (SPEC-063 fase 2): el siguiente de cada fila es el próximo caso que se
 * puede gestionar desde aquí. Un pedido no tiene editor: se salta.
 */
function nextCases(entries: MyDayEntry[]): Map<string, NextCase> {
  const manageable = entries.filter((entry) => entry.manage !== null);
  const next = new Map<string, NextCase>();

  manageable.forEach((entry, index) => {
    const following = manageable[index + 1];
    if (entry.manage && following?.manage) {
      next.set(entry.manage.caseId, {
        caseId: following.manage.caseId,
        title: following.title,
      });
    }
  });

  return next;
}

/**
 * La lista de trabajo (BR-005 a BR-007): agrupada por tramo de urgencia, una
 * fila por cosa que hacer, con el cliente, la acción en una frase, el plazo y
 * la acción principal. En los casos, la acción principal es registrar la
 * gestión sin salir de «Mi día».
 */
export function MyDayList({
  entries,
  campaignTotal,
}: {
  entries: MyDayEntry[];
  campaignTotal: number;
}) {
  const next = nextCases(entries);
  const groups = myDayTierOrder
    .map((tier) => ({
      tier,
      entries: entries.filter((entry) => entry.tier === tier),
    }))
    .filter((group) => group.entries.length > 0);

  return (
    <div className="grid gap-6">
      {groups.map((group) => (
        <section aria-labelledby={`tramo-${group.tier}`} key={group.tier}>
          <TierHeading
            campaignTotal={campaignTotal}
            count={group.entries.length}
            tier={group.tier}
          />
          <ol className="mt-2 grid gap-2">
            {group.entries.map((entry) => (
              <li key={entry.key}>
                <MyDayRow
                  entry={entry}
                  next={entry.manage ? (next.get(entry.manage.caseId) ?? null) : null}
                />
              </li>
            ))}
          </ol>
          {group.tier === "campana" && campaignTotal > group.entries.length ? (
            <p className="mt-2 text-sm text-ui-muted">
              Hay {campaignTotal} casos de campaña para trabajar ahora.{" "}
              <Link
                className="font-semibold text-ui-accent underline-offset-4 hover:underline"
                href="/recovery/campaigns"
              >
                Ir a mi cola de campaña
              </Link>
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}

/** Una lista sin tramos: «Más tarde hoy» y las ventas antiguas. */
export function MyDayFlatList({ entries }: { entries: MyDayEntry[] }) {
  const next = nextCases(entries);

  return (
    <ol className="grid gap-2">
      {entries.map((entry) => (
        <li key={entry.key}>
          <MyDayRow
            entry={entry}
            next={entry.manage ? (next.get(entry.manage.caseId) ?? null) : null}
          />
        </li>
      ))}
    </ol>
  );
}

function TierHeading({
  tier,
  count,
  campaignTotal,
}: {
  tier: MyDayTier;
  count: number;
  campaignTotal: number;
}) {
  const total = tier === "campana" ? campaignTotal : count;

  return (
    <h2
      className="flex items-baseline gap-2 text-sm font-semibold text-ui-text"
      id={`tramo-${tier}`}
    >
      {myDayTierLabels[tier]}
      <span className="text-xs font-medium text-ui-soft">{total}</span>
    </h2>
  );
}

const primaryButton =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-ui-strong px-4 text-sm font-semibold text-ui-on-strong transition hover:opacity-90";

function MyDayRow({
  entry,
  next,
}: {
  entry: MyDayEntry;
  next: NextCase | null;
}) {
  const draft = useCampaignDraft();
  const editorId = useId();
  const manage = entry.manage;
  const editing = manage !== null && draft.editingId === manage.caseId;
  const [saved, setSaved] = useState<ConfirmedAttempt | null>(null);
  const [unmanageable, setUnmanageable] = useState<string | null>(null);

  const handleSaved = useCallback((attempt: ConfirmedAttempt) => {
    setSaved(attempt);
  }, []);

  const openNext = useCallback(() => {
    if (!next) return;
    draft.startEditing(next.caseId);
    requestAnimationFrame(() => {
      document
        .getElementById(`mi-dia-${next.caseId}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [draft, next]);

  const canManage = manage !== null && unmanageable === null;

  return (
    <article
      className={`rounded-lg border bg-ui-surface ${
        editing ? "border-ui-accent" : "border-ui-border"
      } ${saved && !editing ? "opacity-70" : ""}`}
      data-overdue={entry.overdue && !saved ? "true" : undefined}
      id={manage ? `mi-dia-${manage.caseId}` : undefined}
    >
      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ui-soft">
            <span className="font-semibold uppercase tracking-wide">
              {myDayKindLabels[entry.kind]}
            </span>
            {saved ? (
              <span className="rounded-full bg-ui-success-soft px-2 py-0.5 font-semibold text-ui-success">
                Gestionado: {attemptResultLabels[saved.result] ?? saved.result}
              </span>
            ) : entry.dueLabel ? (
              <span
                className={
                  entry.overdue
                    ? "rounded-full bg-ui-danger-soft px-2 py-0.5 font-semibold text-ui-danger"
                    : "rounded-full bg-ui-subtle px-2 py-0.5 font-semibold text-ui-muted"
                }
              >
                {entry.dueLabel}
              </span>
            ) : null}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold text-ui-text">
            {entry.title}
          </h3>
          <p className="mt-0.5 text-sm text-ui-text">
            {saved
              ? saved.nextActionAtLabel
                ? `Próxima acción: ${saved.nextActionAtLabel}`
                : "Gestión registrada"
              : entry.action}
          </p>
          {unmanageable ? (
            <p className="mt-0.5 text-xs text-ui-danger">{unmanageable}</p>
          ) : entry.detail ? (
            <p className="mt-0.5 text-xs text-ui-muted">{entry.detail}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {canManage && !editing ? (
            <>
              <Link
                className="text-sm font-semibold text-ui-accent underline-offset-4 hover:underline"
                href={entry.href}
              >
                {entry.actionLabel}
              </Link>
              <button
                aria-controls={editorId}
                aria-expanded={false}
                aria-label={`Registrar gestión: ${entry.title}`}
                className={primaryButton}
                onClick={() => draft.startEditing(manage.caseId)}
                type="button"
              >
                {saved ? "Otra gestión" : "Registrar gestión"}
              </button>
            </>
          ) : !editing ? (
            <Link
              aria-label={`${entry.actionLabel}: ${entry.title}`}
              className={primaryButton}
              href={entry.href}
            >
              {entry.actionLabel}
            </Link>
          ) : null}
        </div>
      </div>
      {editing && manage ? (
        <div
          className="border-t border-ui-border bg-ui-subtle p-4"
          id={editorId}
        >
          <CampaignAttemptEditor
            caseId={manage.caseId}
            defaultPhone={manage.defaultPhone}
            holderName={entry.title}
            lastObservation={saved ? saved.observation : manage.lastObservation}
            lastResult={saved ? saved.result : manage.lastResult}
            nextName={next?.title ?? null}
            onCancel={draft.stopEditing}
            onNext={next ? openNext : undefined}
            onSaved={handleSaved}
            onUnmanageable={setUnmanageable}
            phoneOptions={manage.phoneOptions}
            serviceNumbers={manage.serviceNumbers}
          />
        </div>
      ) : null}
    </article>
  );
}
