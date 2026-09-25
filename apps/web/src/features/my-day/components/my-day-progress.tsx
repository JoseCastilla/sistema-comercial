"use client";

import Link from "next/link";
import { useState } from "react";

import { formatCount, formatMoneyFromCents } from "@repo/ui/format";
import {
  myDaySaleBucketHints,
  myDaySaleBucketLabels,
  type MyDaySaleBucket,
  type PerformanceCommercialOperation,
} from "@repo/validation";

import { Button } from "@/components/ui/button";

import type { MyDayProgress, MyDaySales } from "../server/get-my-day";

const operationLabels: Partial<Record<PerformanceCommercialOperation, string>> =
  {
    PORT_POSTPAID: "Portabilidad postpago",
    PORT_PREPAID: "Portabilidad prepago",
    NEW_LINE: "Alta nueva",
  };

/** El color dice qué tan cerca está el dinero; ninguno grita. */
const bucketTone: Record<MyDaySaleBucket, string> = {
  pagan: "border-ui-success bg-ui-success-soft text-ui-success",
  por_activar: "border-ui-info-border bg-ui-info-soft text-ui-info",
  en_camino: "border-ui-border bg-ui-subtle text-ui-text",
  caidas: "border-ui-warning-border bg-ui-warning-soft text-ui-warning",
  sin_comision: "border-ui-border bg-ui-surface text-ui-muted",
};

/** Qué falta para cobrar el monto de una venta que todavía no paga. */
const pendingAmountSuffix: Partial<Record<MyDaySaleBucket, string>> = {
  por_activar: "al activarse",
  en_camino: "al entregarse y activarse",
  caidas: "si la recuperas",
};

/**
 * Quién lee (SPEC-069): el asesor en su «Mi día» («tu comisión») o su
 * supervisor en «Ver su día» («su comisión»). Las cifras son las mismas.
 */
export type MyDayVoice = "tu" | "su";

const voiceText = {
  tu: {
    lacks: (count: number) => (count === 1 ? "te falta" : "te faltan"),
    commission: "Tu comisión",
    howTo: "Cómo se calcula tu comisión",
    sales: "tus ventas",
    owner: "a tu nombre",
    enters: "que ingresas",
  },
  su: {
    lacks: (count: number) => (count === 1 ? "le falta" : "le faltan"),
    commission: "Su comisión",
    howTo: "Cómo se calcula su comisión",
    sales: "sus ventas",
    owner: "a su nombre",
    enters: "que ingresa",
  },
} as const;

function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Lo que dice del bono, en una línea (fase 6): la ventana abierta dice cuánto
 * falta; del 16 al 24, el bono que viene, no el que ya cerró.
 */
function bonusLine(
  window: MyDayProgress["window"],
  voice: MyDayVoice,
): string | null {
  if (!window) return null;
  if (window.closed) {
    return window.upcoming
      ? `Bono del día ${window.upcoming.startDay}: ${formatCount(window.upcoming.target)} confirmadas = ${formatMoneyFromCents(window.upcoming.amountCents)}`
      : "Sin bono abierto este mes";
  }
  return window.nextTarget === null
    ? `${window.label}: sin tramo pendiente`
    : `${window.label}: ${voiceText[voice].lacks(window.missingForNextTarget)} ${formatCount(window.missingForNextTarget)} para ${formatMoneyFromCents(window.nextTargetAmountCents)} más`;
}

/**
 * El progreso del mes en una franja (SPEC-063 fase 6): hoy, comisión, cuota y
 * bono en una línea; al abrirla, «Tu comisión» con el dinero por grupo de
 * ventas (fase 4, BR-020) y cómo se calcula (BR-010). Antes eran cuatro
 * tarjetas, una nota y un bloque aparte que decían parte de lo mismo, y en el
 * celular empujaban el trabajo dos pantallas abajo.
 */
export function MyDayProgressPanel({
  progress,
  sales,
  voice = "tu",
}: {
  progress: MyDayProgress;
  sales: MyDaySales;
  /** «su» cuando lo mira su supervisor (SPEC-069 fase 2). */
  voice?: MyDayVoice;
}) {
  const bonus = bonusLine(progress.window, voice);
  const text = voiceText[voice];
  const pendingCents = sales.summary
    .filter((group) => group.bucket !== "pagan")
    .reduce((total, group) => total + group.amountCents, 0);

  return (
    <details className="group rounded-lg border border-ui-border bg-ui-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-sm text-ui-muted">
        <span>
          Hoy{" "}
          <strong className="text-ui-text">
            {plural(progress.enteredToday, "venta", "ventas")}
          </strong>{" "}
          · {plural(progress.attemptsToday, "gestión", "gestiones")}
        </span>
        <span>
          Comisión{" "}
          <strong className="text-base tabular-nums text-ui-text">
            {formatMoneyFromCents(progress.estimatedCommissionCents)}
          </strong>
        </span>
        <span>
          Cuota{" "}
          <strong className="tabular-nums text-ui-text">
            {formatCount(progress.quota.delivered)} de{" "}
            {formatCount(progress.quota.target)}
          </strong>
        </span>
        {bonus ? <span>{bonus}</span> : null}
        <span className="ml-auto text-xs font-semibold text-ui-accent">
          <span className="group-open:hidden">Ver detalle</span>
          <span className="hidden group-open:inline">Ocultar detalle</span>
        </span>
      </summary>

      <div className="grid gap-4 border-t border-ui-border px-4 py-4 text-sm">
        <CommissionSummary
          pendingCents={pendingCents}
          progress={progress}
          sales={sales}
          voice={voice}
        />
        <p className="text-ui-muted">
          <strong className="text-ui-text">Cuota del mes:</strong>{" "}
          {formatCount(progress.quota.delivered)} de{" "}
          {formatCount(progress.quota.target)} portabilidades entregadas
          {progress.quota.target > progress.quota.delivered
            ? ` · ${text.lacks(progress.quota.target - progress.quota.delivered)} ${formatCount(progress.quota.target - progress.quota.delivered)}`
            : " · cumplida"}
          {progress.quota.assigned ? "" : " · cuota por defecto"}
        </p>
        {progress.window?.closed ? (
          <p className="text-ui-muted">
            <strong className="text-ui-text">{progress.window.label}:</strong>{" "}
            cerrado con{" "}
            {plural(progress.window.confirmed, "confirmada", "confirmadas")}.
            Solo suman las ventas de esos días al confirmarse.
          </p>
        ) : null}
        <details className="rounded-lg border border-ui-border">
          <summary className="cursor-pointer px-3 py-2 font-semibold text-ui-accent">
            {text.howTo}
          </summary>
          <CommissionExplanation progress={progress} voice={voice} />
        </details>
      </div>
    </details>
  );
}

/**
 * «Tu comisión»: lo ganado y lo que falta cobrar, por grupo. Cada recuadro
 * abre su propia lista (fase 6); antes todo el bloque se abría junto.
 */
function CommissionSummary({
  progress,
  sales,
  pendingCents,
  voice,
}: {
  voice: MyDayVoice;
  progress: MyDayProgress;
  sales: MyDaySales;
  pendingCents: number;
}) {
  const [open, setOpen] = useState<MyDaySaleBucket | null>(null);
  const openGroup = sales.summary.find((group) => group.bucket === open);

  return (
    <section aria-labelledby="mi-dia-comision" className="grid gap-2">
      <h2 className="font-semibold text-ui-text" id="mi-dia-comision">
        {voiceText[voice].commission} de {progress.monthLabel} (estimada)
      </h2>
      <p className="text-ui-muted">
        {formatMoneyFromCents(progress.baseCommissionCents)} por{" "}
        {plural(progress.payable, "venta pagable", "ventas pagables")} +{" "}
        {formatMoneyFromCents(progress.bonusCents)} de bonos ={" "}
        <strong className="text-ui-text">
          {formatMoneyFromCents(progress.estimatedCommissionCents)}
        </strong>
        {pendingCents > 0
          ? ` · por cobrar ${formatMoneyFromCents(pendingCents)} en ${voiceText[voice].sales} que todavía no pagan`
          : ""}
      </p>
      {sales.total > 0 ? (
        <div className="flex flex-wrap gap-2">
          {sales.summary.map((group) => (
            <button
              aria-expanded={open === group.bucket}
              className={`rounded-lg border px-2.5 py-1 text-left text-xs ${bucketTone[group.bucket]} ${
                open === group.bucket ? "ring-2 ring-ui-accent" : ""
              }`}
              key={group.bucket}
              onClick={() =>
                setOpen((current) =>
                  current === group.bucket ? null : group.bucket,
                )
              }
              type="button"
            >
              <span className="font-semibold">
                {myDaySaleBucketLabels[group.bucket]}
              </span>
              {" · "}
              {formatCount(group.count)}
              {group.amountCents > 0
                ? ` · ${formatMoneyFromCents(group.amountCents)}`
                : ""}
            </button>
          ))}
        </div>
      ) : null}
      {openGroup ? (
        <div className="rounded-lg border border-ui-border">
          <p className="border-b border-ui-border px-3 py-2 text-xs text-ui-muted">
            {myDaySaleBucketHints[openGroup.bucket]}
          </p>
          <ul className="divide-y divide-ui-border">
            {(sales.byBucket[openGroup.bucket] ?? []).map((sale) => (
              <li
                className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4"
                key={sale.id}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ui-text">
                    {sale.holderName}
                  </span>
                  <span className="block text-xs text-ui-muted">
                    Venta del {sale.saleDayLabel} · pedido {sale.orderCode}
                  </span>
                </span>
                <span className="text-xs tabular-nums text-ui-text sm:text-right">
                  {sale.reasonText ??
                    (sale.potential
                      ? `${formatMoneyFromCents(sale.amountCents)} ${pendingAmountSuffix[openGroup.bucket] ?? ""}`.trim()
                      : formatMoneyFromCents(sale.amountCents))}
                </span>
                <Button
                  asChild
                  className="text-xs"
                  size="inline"
                  variant="link"
                >
                  <Link
                    aria-label={`Ver pedido de ${sale.holderName}`}
                    href={sale.href}
                  >
                    Ver pedido
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function CommissionExplanation({
  progress,
  voice,
}: {
  progress: MyDayProgress;
  voice: MyDayVoice;
}) {
  const { policy } = progress;
  const rates = Object.entries(policy.baseRateCents).flatMap(
    ([operation, cents]) => {
      const label =
        operationLabels[operation as PerformanceCommercialOperation];
      return label ? [{ label, cents }] : [];
    },
  );

  return (
    <div className="grid gap-4 px-3 pb-3 text-sm text-ui-text">
      <div>
        <h3 className="font-semibold">Por cada venta pagable</h3>
        <ul className="mt-1 grid gap-0.5 text-ui-muted">
          {rates.map((rate) => (
            <li key={rate.label}>
              {rate.label}:{" "}
              <strong className="text-ui-text">
                {rate.cents > 0
                  ? formatMoneyFromCents(rate.cents)
                  : "no paga comisión"}
              </strong>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-ui-muted">
          Una venta es pagable cuando está entregada, activada y{" "}
          {voiceText[voice].owner}.
        </p>
      </div>
      {policy.acceleratorWindows.map((window) => {
        const lastTier = window.tiers[window.tiers.length - 1];
        return (
          <div key={window.key}>
            <h3 className="font-semibold">{window.label}</h3>
            <p className="mt-1 text-ui-muted">
              Cuentan las portabilidades {voiceText[voice].enters} del día{" "}
              {window.windowStartDay} al{" "}
              {window.windowEndDay === null
                ? "último día del mes"
                : `día ${window.windowEndDay}`}{" "}
              y que terminan confirmadas (entregadas y activadas).
            </p>
            <ul className="mt-1 grid gap-0.5 text-ui-muted">
              {window.tiers.map((tier) => (
                <li key={tier.target}>
                  Con {formatCount(tier.target)} confirmadas:{" "}
                  <strong className="text-ui-text">
                    {formatMoneyFromCents(tier.amountCents)}
                  </strong>
                </li>
              ))}
              {lastTier && window.perExtraConfirmedCents > 0 ? (
                <li>
                  Desde {formatCount(lastTier.target)}, cada confirmada más suma{" "}
                  <strong className="text-ui-text">
                    {formatMoneyFromCents(window.perExtraConfirmedCents)}
                  </strong>
                </li>
              ) : null}
            </ul>
          </div>
        );
      })}
      <p className="text-ui-muted">
        Es un monto estimado: el definitivo sale de la liquidación del mes.{" "}
        <Button asChild size="inline" variant="link">
          <Link href="/performance/reconciliation">
            Ver el detalle de cada venta
          </Link>
        </Button>
      </p>
    </div>
  );
}
