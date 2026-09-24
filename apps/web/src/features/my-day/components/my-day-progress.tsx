import Link from "next/link";

import { formatCount, formatMoneyFromCents } from "@repo/ui/format";
import type { PerformanceCommercialOperation } from "@repo/validation";

import type { MyDayProgress } from "../server/get-my-day";

const operationLabels: Partial<Record<PerformanceCommercialOperation, string>> = {
  PORT_POSTPAID: "Portabilidad postpago",
  PORT_PREPAID: "Portabilidad prepago",
  NEW_LINE: "Alta nueva",
};

function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}

/**
 * La franja de progreso (BR-009) y su explicación (BR-010). Las tarifas y los
 * bonos se leen de la política centralizada que llega en `progress.policy`:
 * ninguna cifra de la política está escrita en esta pantalla.
 */
export function MyDayProgressPanel({ progress }: { progress: MyDayProgress }) {
  const window = progress.window;

  return (
    <section
      aria-labelledby="mi-dia-progreso"
      className="rounded-lg border border-ui-border bg-ui-surface"
    >
      <h2 className="sr-only" id="mi-dia-progreso">
        Tu progreso
      </h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-t-lg bg-ui-border lg:grid-cols-4">
        <Figure
          label="Hoy"
          value={plural(progress.enteredToday, "venta", "ventas")}
          note={`${plural(progress.attemptsToday, "gestión registrada", "gestiones registradas")}`}
        />
        <Figure
          label={`Comisión estimada · ${progress.monthLabel}`}
          value={formatMoneyFromCents(progress.estimatedCommissionCents)}
          note={`${formatMoneyFromCents(progress.baseCommissionCents)} por ${plural(progress.payable, "venta pagable", "ventas pagables")} + ${formatMoneyFromCents(progress.bonusCents)} de bonos`}
        />
        {window ? (
          <Figure
            label={window.closed ? `${window.label} · cerrado` : window.label}
            value={plural(window.confirmed, "confirmada", "confirmadas")}
            note={describeWindowNote(window)}
          />
        ) : null}
        <Figure
          label={`Cuota de ${progress.monthLabel.split(" ")[0]}`}
          value={`${formatCount(progress.quota.delivered)} de ${formatCount(progress.quota.target)}`}
          note={describeQuotaNote(progress.quota)}
        />
      </dl>
      {progress.deliveredPendingActivation > 0 ? (
        <p className="border-t border-ui-border px-4 py-2 text-sm text-ui-muted">
          {plural(
            progress.deliveredPendingActivation,
            "venta entregada espera",
            "ventas entregadas esperan",
          )}{" "}
          activación para volverse pagable.
        </p>
      ) : null}
      <details className="group border-t border-ui-border">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ui-accent hover:underline">
          Cómo se calcula tu comisión
        </summary>
        <CommissionExplanation progress={progress} />
      </details>
    </section>
  );
}

/** BR-019: la cuota es del mes y se mide en portabilidades entregadas. */
function describeQuotaNote(quota: MyDayProgress["quota"]): string {
  const missing = quota.target - quota.delivered;
  const progress =
    missing > 0
      ? `te ${missing === 1 ? "falta" : "faltan"} ${formatCount(missing)}`
      : "cuota cumplida";
  // Sin cuota del líder, la del mes por defecto: la que cobra los dos bonos.
  return quota.assigned
    ? `Portabilidades entregadas del mes · ${progress}`
    : `Cuota por defecto · ${progress}`;
}

function describeWindowNote(
  window: NonNullable<MyDayProgress["window"]>,
): string {
  if (window.closed) {
    const upcoming = window.upcoming
      ? ` El siguiente bono empieza el día ${window.upcoming.startDay}.`
      : "";
    return `Solo suman las ventas de esos días al confirmarse.${upcoming}`;
  }

  return window.nextTarget === null
    ? "Sin bono pendiente en esta ventana"
    : `Te ${window.missingForNextTarget === 1 ? "falta" : "faltan"} ${formatCount(window.missingForNextTarget)} para ganar ${formatMoneyFromCents(window.nextTargetAmountCents)} más`;
}

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="bg-ui-surface px-3 py-3 sm:px-4">
      <dt className="text-2xs font-semibold uppercase tracking-wide text-ui-soft sm:text-xs">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-bold tabular-nums text-ui-text sm:text-2xl">
        {value}
      </dd>
      <dd className="mt-0.5 text-xs text-ui-muted">{note}</dd>
    </div>
  );
}

function CommissionExplanation({ progress }: { progress: MyDayProgress }) {
  const { policy } = progress;
  const rates = Object.entries(policy.baseRateCents).flatMap(
    ([operation, cents]) => {
      const label = operationLabels[operation as PerformanceCommercialOperation];
      return label ? [{ label, cents }] : [];
    },
  );

  return (
    <div className="grid gap-4 px-4 pb-4 text-sm text-ui-text">
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
          Una venta es pagable cuando está entregada, activada y a tu nombre.
        </p>
      </div>
      {policy.acceleratorWindows.map((window) => {
        const lastTier = window.tiers[window.tiers.length - 1];
        return (
          <div key={window.key}>
            <h3 className="font-semibold">{window.label}</h3>
            <p className="mt-1 text-ui-muted">
              Cuentan las portabilidades que ingresas del día{" "}
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
        <Link
          className="font-semibold text-ui-accent underline-offset-4 hover:underline"
          href="/performance/reconciliation"
        >
          Ver el detalle de cada venta
        </Link>
      </p>
    </div>
  );
}
