"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";

import { saveMobileDebtCredentialsAction } from "../server/mobile-debt-actions";

import type {
  MobileDebtCredentialActionState,
  MobileDebtCredentialView,
} from "../mobile-debt.types";

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Lima",
});

const initialState: MobileDebtCredentialActionState = {
  type: "idle",
  message: "",
};

export function MobileDebtCredentialPanel({
  credential,
}: {
  credential: MobileDebtCredentialView;
}) {
  const [state, action, pending] = useActionState(
    saveMobileDebtCredentialsAction,
    initialState,
  );
  const status =
    credential.status === "ACTIVE"
      ? { tone: "success", label: "Configuración activa" }
      : credential.status === "EXPIRED"
        ? { tone: "danger", label: "Sesión vencida" }
        : credential.status === "ERROR"
          ? { tone: "warning", label: "Requiere revisión" }
          : { tone: "neutral", label: "Sin configurar" };

  return (
    <details className="rounded-xl border border-ui-border bg-ui-surface shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ui-muted">
            Administración y supervisión
          </p>
          <h2 className="mt-1 text-base font-bold text-ui-text">
            Conexión con Red Digital
          </h2>
        </div>
        <span className="ui-status-badge" data-tone={status.tone}>
          {status.label}
        </span>
      </summary>

      <div className="grid gap-5 border-t border-ui-border p-4 sm:p-5">
        {credential.configured ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <Metadata
              label="Sesión guardada"
              value={`Termina en ${credential.hint ?? "••••"}`}
            />
            <Metadata
              label="Actualizada"
              value={
                credential.updatedAt
                  ? dateFormatter.format(new Date(credential.updatedAt))
                  : "No disponible"
              }
            />
            <Metadata
              label="Responsable"
              value={credential.updatedBy ?? "No disponible"}
            />
          </dl>
        ) : null}

        <form action={action} className="grid gap-4">
          <p className="text-sm leading-6 text-ui-muted">
            Pega cada valor por separado. Se cifra en el servidor, nunca vuelve
            a mostrarse y no queda disponible para los asesores.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <CredentialInput label="JSESSIONID" name="jSessionId" />
            <CredentialInput label="CIDSB" name="cidSb" />
            <CredentialInput label="captcha" name="captcha" />
            <CredentialInput label="csrft" name="csrfToken" />
          </div>
          {state.type !== "idle" ? (
            <InlineFeedback
              message={state.message}
              tone={state.type === "error" ? "danger" : "success"}
            />
          ) : null}
          <div>
            <Button disabled={pending} type="submit">
              {pending
                ? "Guardando..."
                : credential.configured
                  ? "Reemplazar credenciales"
                  : "Guardar credenciales"}
            </Button>
          </div>
        </form>
      </div>
    </details>
  );
}

function CredentialInput({ label, name }: { label: string; name: string }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-ui-text">
      {label}
      <input
        autoComplete="new-password"
        className="ui-control font-mono text-sm"
        name={name}
        required
        type="password"
      />
    </label>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ui-soft">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-ui-text">{value}</dd>
    </div>
  );
}
