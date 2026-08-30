"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";
import { Metric, MetricGroup } from "@repo/ui/metric";

import { lookupMobileDebtAction } from "../server/mobile-debt-actions";

import type {
  MobileDebtActionState,
  MobileDebtStats,
  MobileDebtView,
} from "../mobile-debt.types";

const queriedAtFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Lima",
});

export function MobileDebtLookup({
  initialStats,
}: {
  initialStats: MobileDebtStats;
}) {
  const initialState: MobileDebtActionState = {
    type: "idle",
    message: "",
    result: null,
    stats: initialStats,
  };
  const [state, action, pending] = useActionState(
    lookupMobileDebtAction,
    initialState,
  );

  return (
    <div className="grid gap-5">
      <section aria-labelledby="debt-activity-title" className="grid gap-3">
        <div>
          <h2
            className="text-sm font-bold text-ui-text"
            id="debt-activity-title"
          >
            Tu actividad de consultas
          </h2>
          <p className="mt-1 text-xs leading-5 text-ui-muted">
            Cada intento queda registrado para mantener las consultas dentro de
            la operación.
          </p>
        </div>
        <MetricGroup>
          <Metric label="Consultas de hoy" value={state.stats.today} />
          <Metric label="Consultas del mes" value={state.stats.month} />
        </MetricGroup>
      </section>

      <section className="rounded-xl border border-ui-border bg-ui-surface p-4 shadow-sm sm:p-5">
        <form action={action} className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="ui-field__label">Operador de la línea</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["CLARO", "ENTEL", "BITEL"] as const).map((operator) => (
                <label
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-ui-border bg-ui-surface px-4 py-3 text-sm font-semibold text-ui-text has-[:checked]:border-ui-accent has-[:checked]:bg-ui-subtle"
                  key={operator}
                >
                  <input
                    className="h-4 w-4 accent-[var(--ui-accent)]"
                    name="operator"
                    required
                    type="radio"
                    value={operator}
                  />
                  {operator[0]}
                  {operator.slice(1).toLocaleLowerCase("es-PE")}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-2">
            <label className="ui-field__label" htmlFor="mobile-debt-phone">
              Número celular
            </label>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,22rem)_auto] sm:items-stretch">
              <input
                autoComplete="off"
                className="ui-control font-mono tracking-[0.1em]"
                id="mobile-debt-phone"
                inputMode="numeric"
                maxLength={9}
                minLength={9}
                name="phone"
                pattern="9[0-9]{8}"
                placeholder="9XXXXXXXX"
                required
              />
              <Button
                className="min-h-[2.625rem]"
                disabled={pending}
                type="submit"
              >
                {pending ? "Consultando..." : "Consultar deuda"}
              </Button>
            </div>
            <p className="ui-field__hint">
              Ingresa los 9 dígitos. Esta acción solo consulta; no realiza
              pagos.
            </p>
          </div>
        </form>

        {state.message ? (
          <div className="mt-4" role="status">
            <InlineFeedback
              message={state.message}
              tone={state.type === "error" ? "danger" : "success"}
            />
          </div>
        ) : null}
      </section>

      {state.result ? <MobileDebtResultCard result={state.result} /> : null}
    </div>
  );
}

function MobileDebtResultCard({ result }: { result: MobileDebtView }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-ui-border bg-ui-surface shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-ui-border bg-ui-subtle p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ui-muted">
            Deuda encontrada
          </p>
          <h2 className="mt-2 font-mono text-xl font-bold tracking-[0.08em] text-ui-text sm:text-2xl">
            {result.phone}
          </h2>
          {result.customerName ? (
            <div className="mt-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ui-muted">
                Titular reportado
              </p>
              <p className="mt-1 text-base font-bold text-ui-text">
                {result.customerName}
              </p>
            </div>
          ) : null}
        </div>
        <span className="ui-status-badge" data-tone="info">
          {operatorLabel(result.operator)}
        </span>
      </header>

      <div className="grid gap-5 p-5 sm:p-6">
        <section className="grid gap-3 sm:grid-cols-2">
          <KeyDatum
            label="Deuda de la línea"
            value={formatMoney(result.debtAmount)}
          />
          <KeyDatum
            label="Fecha de vencimiento"
            value={result.dueDateRaw ?? "No informada"}
          />
        </section>

        <p className="text-xs leading-5 text-ui-muted">
          {result.customerName
            ? "Titular reportado por el operador. Verifica este dato con el cliente."
            : "El operador no informó el nombre del titular en esta consulta."}
        </p>

        <p className="text-xs leading-5 text-ui-soft">
          Consultado el {queriedAtFormatter.format(new Date(result.queriedAt))}.
          Confirma el monto antes de continuar con la gestión comercial.
        </p>
      </div>
    </article>
  );
}

function KeyDatum({ label, value }: { label: string; value: string }) {
  return (
    <dl className="rounded-xl border border-ui-accent bg-ui-subtle p-5">
      <dt className="text-xs font-bold uppercase tracking-[0.08em] text-ui-accent">
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-bold tabular-nums text-ui-text">
        {value}
      </dd>
    </dl>
  );
}

function formatMoney(value: number | null): string {
  return value === null
    ? "No informado"
    : new Intl.NumberFormat("es-PE", {
        style: "currency",
        currency: "PEN",
      }).format(value);
}

function operatorLabel(operator: MobileDebtView["operator"]): string {
  return `${operator[0]}${operator.slice(1).toLocaleLowerCase("es-PE")}`;
}
