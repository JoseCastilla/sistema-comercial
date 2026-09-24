import Link from "next/link";

import { myDayTierLabels, myDayTierOrder, type MyDayTier } from "@repo/validation";

import {
  myDayKindLabels,
  type MyDayEntry,
} from "../server/get-my-day";

/**
 * La lista de trabajo (BR-005 a BR-007): agrupada por tramo de urgencia, una
 * fila por cosa que hacer, con el cliente, la acción en una frase, el plazo y
 * un solo botón que lleva donde se resuelve.
 */
export function MyDayList({
  entries,
  campaignTotal,
}: {
  entries: MyDayEntry[];
  campaignTotal: number;
}) {
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
                <MyDayRow entry={entry} />
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

export function MyDayRow({ entry }: { entry: MyDayEntry }) {
  return (
    <article
      className="grid gap-3 rounded-lg border border-ui-border bg-ui-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      data-overdue={entry.overdue ? "true" : undefined}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ui-soft">
          <span className="font-semibold uppercase tracking-wide">
            {myDayKindLabels[entry.kind]}
          </span>
          {entry.dueLabel ? (
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
        <p className="mt-0.5 text-sm text-ui-text">{entry.action}</p>
        {entry.detail ? (
          <p className="mt-0.5 text-xs text-ui-muted">{entry.detail}</p>
        ) : null}
      </div>
      <Link
        aria-label={`${entry.actionLabel}: ${entry.title}`}
        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-ui-strong px-4 text-sm font-semibold text-ui-on-strong transition hover:opacity-90"
        href={entry.href}
      >
        {entry.actionLabel}
      </Link>
    </article>
  );
}
