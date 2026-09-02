"use client";

import { useActionState, type ReactNode } from "react";

import { formatCount } from "@repo/ui/format";
import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";
import { Metric, MetricGroup } from "@repo/ui/metric";

import { lookupDniAction } from "../server/lookup-dni-action";

import type {
  DniCreditStatus,
  DniLookupActionState,
  DniLookupStats,
  DniPersonView,
} from "../dni.types";

const fetchedAtFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Lima",
});

export function DniLookupForm({
  initialStats,
  initialCreditStatus,
}: {
  initialStats: DniLookupStats;
  initialCreditStatus: DniCreditStatus | null;
}) {
  const initialState: DniLookupActionState = {
    type: "idle",
    message: "",
    person: null,
    stats: initialStats,
    creditStatus: initialCreditStatus,
  };
  const [state, formAction, pending] = useActionState(
    lookupDniAction,
    initialState,
  );

  return (
    <div className="grid gap-5">
      {state.creditStatus ? (
        <DniCreditPanel status={state.creditStatus} />
      ) : null}

      <section aria-labelledby="dni-count-title" className="grid gap-3">
        <div>
          <h2 className="text-sm font-bold text-ui-text" id="dni-count-title">
            Tu actividad de consultas
          </h2>
          <p className="mt-1 text-xs leading-5 text-ui-muted">
            El sistema cuenta cada consulta completada, incluso si el DNI ya
            existía en el historial.
          </p>
        </div>
        <MetricGroup>
          <Metric
            emphasis="hero"
            label="Consultas del mes"
            value={state.stats.month}
          />
          <Metric label="Consultas de hoy" value={state.stats.today} />
          <Metric
            label="DNI distintos este mes"
            value={state.stats.uniqueDnisThisMonth}
          />
        </MetricGroup>
      </section>

      <section className="rounded-xl border border-ui-border bg-ui-surface p-4 shadow-sm sm:p-5">
        <form action={formAction} className="grid gap-2">
          <label className="ui-field__label" htmlFor="dni-lookup-input">
            DNI del cliente
          </label>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,22rem)_auto] sm:items-stretch">
            <input
              autoComplete="off"
              autoFocus
              className="ui-control font-mono tracking-[0.12em]"
              id="dni-lookup-input"
              inputMode="numeric"
              maxLength={12}
              name="dni"
              pattern="[0-9 -]*"
              placeholder="12345678"
              required
            />
            <Button
              className="min-h-[2.625rem]"
              disabled={pending}
              type="submit"
            >
              {pending ? "Consultando..." : "Consultar DNI"}
            </Button>
          </div>
          <p className="ui-field__hint">
            Escribe los 8 dígitos. La consulta queda auditada.
          </p>
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

      {state.person ? <DniPersonCard person={state.person} /> : null}
    </div>
  );
}

function DniPersonCard({ person }: { person: DniPersonView }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-ui-border bg-ui-surface shadow-sm">
      <header className="border-b border-ui-border bg-ui-subtle p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ui-muted">
              Ficha de identidad
            </p>
            <h2 className="mt-2 text-xl font-bold text-ui-text sm:text-2xl">
              {person.fullName}
            </h2>
            <p className="mt-1 font-mono text-sm text-ui-muted">
              DNI {person.dni}
              {person.verificationDigit
                ? ` · Dígito verificador ${person.verificationDigit}`
                : ""}
            </p>
          </div>
          <span
            className="ui-status-badge"
            data-tone={person.source === "CACHE" ? "success" : "info"}
          >
            {person.source === "CACHE" ? "Datos guardados" : "Nueva consulta"}
          </span>
        </div>
      </header>

      <div className="grid gap-5 p-5 sm:p-6">
        <section aria-labelledby="dni-key-data-title">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ui-accent">
              Validación con el cliente
            </p>
            <h3
              className="mt-1 text-base font-bold text-ui-text"
              id="dni-key-data-title"
            >
              Nacimiento y nombres de los padres
            </h3>
          </div>
          <dl className="mt-3 grid gap-3 lg:grid-cols-3">
            <KeyDatum
              label="Distrito de nacimiento"
              supporting={joinValues(
                person.birthProvince,
                person.birthDepartment,
              )}
              value={person.birthDistrict}
            />
            <KeyDatum label="Papá" value={person.fatherName} />
            <KeyDatum label="Mamá" value={person.motherName} />
          </dl>
        </section>

        <section aria-labelledby="dni-operational-title">
          <h3
            className="text-sm font-bold text-ui-text"
            id="dni-operational-title"
          >
            Datos útiles para la gestión
          </h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Datum
              label="Nacimiento / edad"
              value={joinValues(
                person.birthDateRaw,
                person.age === null ? null : `${person.age} años`,
              )}
            />
            <Datum label="Género" value={person.sex} />
            <Datum label="Emisión" value={person.issueDateRaw} />
            <Datum label="Caducidad" value={person.expiryDateRaw} />
          </dl>
        </section>

        <section
          aria-labelledby="dni-address-title"
          className="rounded-xl border border-ui-border bg-ui-subtle p-4"
        >
          <h3
            className="text-xs font-bold uppercase tracking-[0.1em] text-ui-muted"
            id="dni-address-title"
          >
            Dirección registrada
          </h3>
          <p className="mt-2 text-base font-semibold text-ui-text">
            {show(person.addressDescription)}
          </p>
          <p className="mt-1 text-sm text-ui-muted">
            {joinValues(
              person.addressDistrict,
              person.addressProvince,
              person.addressDepartment,
            )}
          </p>
        </section>

        <section
          aria-labelledby="dni-restriction-title"
          className="rounded-xl border border-ui-border p-4"
        >
          <h3
            className="text-xs font-bold uppercase tracking-[0.1em] text-ui-muted"
            id="dni-restriction-title"
          >
            Restricción RENIEC
          </h3>
          <p className="mt-2 text-sm font-semibold text-ui-text">
            {show(person.restriction)}
          </p>
        </section>

        <div className="grid gap-3">
          <DetailSection title="Nacimiento y datos civiles">
            <Datum
              label="Fecha de nacimiento"
              value={joinValues(
                person.birthDateRaw,
                person.age === null ? null : `${person.age} años`,
              )}
            />
            <Datum label="Provincia" value={person.birthProvince} />
            <Datum label="Departamento" value={person.birthDepartment} />
            <Datum label="Estado civil" value={person.maritalStatus} />
            <Datum label="Grado de instrucción" value={person.educationLevel} />
            <Datum
              label="Estatura"
              value={person.heightCm ? `${person.heightCm} cm` : null}
            />
          </DetailSection>

          <DetailSection title="Registro del documento">
            <Datum
              label="Fecha de inscripción"
              value={person.registrationDateRaw}
            />
            <Datum label="Fecha de emisión" value={person.issueDateRaw} />
            <Datum label="Fecha de caducidad" value={person.expiryDateRaw} />
          </DetailSection>

          <DetailSection title="Códigos de ubicación">
            <Datum label="Ubigeo RENIEC" value={person.reniecUbigeo} />
            <Datum label="Ubigeo INEI" value={person.ineiUbigeo} />
            <Datum label="Ubigeo SUNAT" value={person.sunatUbigeo} />
            <Datum label="Código postal" value={person.postalCode} />
          </DetailSection>
        </div>

        <p className="text-xs leading-5 text-ui-soft">
          Datos obtenidos el{" "}
          {fetchedAtFormatter.format(new Date(person.fetchedAt))}. La ficha se
          conserva para futuras validaciones. Verifica con el cliente cualquier
          dato que pueda haber cambiado desde esa fecha.
        </p>
      </div>
    </article>
  );
}

const creditToneClasses: Record<DniCreditStatus["tone"], string> = {
  success: "bg-ui-success",
  warning: "bg-ui-warning",
  danger: "bg-ui-danger",
  neutral: "bg-ui-muted",
};

function DniCreditPanel({ status }: { status: DniCreditStatus }) {
  const explanation =
    status.tone === "danger"
      ? "Quedan menos de 100 créditos. Coordina la recarga antes de agotar el servicio."
      : status.tone === "warning"
        ? "El saldo está entre 100 y 199 créditos. Conviene planificar la próxima recarga."
        : status.tone === "success"
          ? "El saldo permite continuar operando con normalidad."
          : "El proveedor todavía no ha reportado un saldo numérico.";

  return (
    <section className="rounded-xl border border-ui-border bg-ui-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ui-muted">
            Control administrativo
          </p>
          <h2 className="mt-1 text-base font-bold text-ui-text">
            Saldo de consultas DNI
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`h-4 w-4 rounded-full ${creditToneClasses[status.tone]}`}
          />
          <div>
            <p className="text-2xl font-bold tabular-nums text-ui-text">
              {status.balance === null ? "—" : formatCount(status.balance)}
            </p>
            <p className="text-xs font-semibold text-ui-muted">
              {status.label}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-ui-muted">{explanation}</p>
      {status.reportedAt ? (
        <p className="mt-1 text-xs text-ui-soft">
          Saldo reportado el{" "}
          {fetchedAtFormatter.format(new Date(status.reportedAt))}.
        </p>
      ) : null}
    </section>
  );
}

function KeyDatum({
  label,
  value,
  supporting,
}: {
  label: string;
  value: string | null;
  supporting?: string | null;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-ui-border bg-ui-subtle p-4">
      <dt className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ui-accent">
        {label}
      </dt>
      <dd className="mt-2 break-words text-lg font-bold leading-snug text-ui-text">
        {show(value)}
        {supporting ? (
          <span className="mt-1 block text-xs font-normal leading-5 text-ui-muted">
            {supporting}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-ui-border bg-ui-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ui-text">
        {title}
        <span
          aria-hidden="true"
          className="text-lg font-normal text-ui-muted transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <dl className="grid gap-3 border-t border-ui-border px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </dl>
    </details>
  );
}

function Datum({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-ui-soft">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-ui-text">
        {show(value)}
      </dd>
    </div>
  );
}

function joinValues(...values: Array<string | null>): string | null {
  const present = values.filter((value): value is string => Boolean(value));
  return present.length > 0 ? present.join(" · ") : null;
}

function show(value: string | null): string {
  return value || "No disponible";
}
