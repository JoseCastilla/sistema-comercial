import Link from "next/link";

import { formatCount, formatMoneyFromCents } from "@repo/ui/format";
import {
  myDaySaleBucketHints,
  myDaySaleBucketLabels,
  type MyDaySaleBucket,
} from "@repo/validation";

import { Button } from "@/components/ui/button";

import type { MyDaySales } from "../server/get-my-day";

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
 * «Tus ventas del mes» — SPEC-063 fase 4 (BR-020). Cada venta con lo que vale
 * para la comisión: lo que ya paga y lo que falta para cobrar el resto. Así
 * el asesor ve dónde está el dinero que le falta y qué lo mueve.
 */
export function MyDaySalesPanel({
  sales,
  monthLabel,
}: {
  sales: MyDaySales;
  monthLabel: string;
}) {
  if (sales.total === 0) return null;

  return (
    <details className="rounded-lg border border-ui-border bg-ui-surface">
      <summary className="cursor-pointer px-4 py-3">
        <span className="text-sm font-semibold text-ui-text">
          Tus {formatCount(sales.total)}{" "}
          {sales.total === 1 ? "venta" : "ventas"} de {monthLabel}
        </span>
        <span className="mt-0.5 block text-xs text-ui-muted">
          Dónde está tu comisión: lo que ya pagan y lo que falta para cobrar el
          resto.
        </span>
        <span className="mt-2 flex flex-wrap gap-2">
          {sales.summary.map((group) => (
            <span
              className={`rounded-lg border px-2.5 py-1 text-xs ${bucketTone[group.bucket]}`}
              key={group.bucket}
            >
              <span className="font-semibold">
                {myDaySaleBucketLabels[group.bucket]}
              </span>
              {" · "}
              {formatCount(group.count)}
              {group.amountCents > 0
                ? ` · ${formatMoneyFromCents(group.amountCents)}`
                : ""}
            </span>
          ))}
        </span>
      </summary>

      <div className="grid gap-3 px-4 pb-4">
        {sales.summary.map((group) => (
          <details
            className="rounded-lg border border-ui-border"
            key={group.bucket}
          >
            <summary className="cursor-pointer px-3 py-2 text-sm">
              <span className="font-semibold text-ui-text">
                {myDaySaleBucketLabels[group.bucket]}
              </span>{" "}
              <span className="text-ui-soft">
                {formatCount(group.count)}
                {group.amountCents > 0
                  ? ` · ${formatMoneyFromCents(group.amountCents)}`
                  : ""}
              </span>
              <span className="mt-0.5 block text-xs text-ui-muted">
                {myDaySaleBucketHints[group.bucket]}
              </span>
            </summary>
            <ul className="divide-y divide-ui-border border-t border-ui-border">
              {(sales.byBucket[group.bucket] ?? []).map((sale) => (
                <li
                  className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4"
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
                        ? `${formatMoneyFromCents(sale.amountCents)} ${pendingAmountSuffix[group.bucket] ?? ""}`.trim()
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
          </details>
        ))}
      </div>
    </details>
  );
}
