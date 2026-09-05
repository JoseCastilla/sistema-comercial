"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import {
  attemptResultChoiceLabels,
  attemptResultLabels,
  attemptResultTones,
} from "../attempt-result-labels";
import { registerCampaignAttemptInlineAction } from "../server/register-recovery-attempt-action";
import { useCampaignDraft } from "./campaign-draft-context";

import type { CampaignAttemptInlineState } from "../server/recovery-action.types";

const initialState: CampaignAttemptInlineState = { type: "idle", message: "" };

const channelLabels: Record<string, string> = {
  LLAMADA: "Llamada",
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  PRESENCIAL: "Presencial",
  OTRO: "Otro",
};

const otherPhone = "__otro__";

export type ConfirmedAttempt = NonNullable<CampaignAttemptInlineState["attempt"]>;

/**
 * Registro de una gestión sin salir de la fila (BR-090).
 *
 * Es el gesto del Excel: resultado y observación a la izquierda, se anota y
 * se sigue con el siguiente. Lo que cambia respecto a la hoja es que cada
 * guardado es un evento nuevo e inmutable, con autor y hora del servidor, y
 * que la fila se actualiza con lo que el servidor confirmó, no con lo que
 * el asesor escribió.
 *
 * La observación anterior se muestra como referencia y **nunca se copia** al
 * campo nuevo: copiarla sería registrar información vieja como si fuera del
 * contacto de hoy.
 */
export function CampaignAttemptEditor({
  caseId,
  holderName,
  phoneOptions,
  defaultPhone,
  lastResult,
  lastObservation,
  onSaved,
  onCancel,
  onUnmanageable,
}: {
  caseId: string;
  holderName: string;
  /** Teléfonos de contacto y líneas, sin repetir. */
  phoneOptions: string[];
  defaultPhone: string | null;
  lastResult: string | null;
  lastObservation: string | null;
  onSaved: (attempt: ConfirmedAttempt, message: string, detail: string) => void;
  onCancel: () => void;
  /** El servidor dijo que el caso ya no es gestionable por quien lo intenta. */
  onUnmanageable: (reason: string) => void;
}) {
  const draft = useCampaignDraft();
  const [state, action, pending] = useActionState(
    registerCampaignAttemptInlineAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLSelectElement>(null);
  const ids = useId();

  /**
   * BR-090: la clave nace con el borrador y viaja en cada envío. Un doble
   * clic o un reintento tras un corte llevan la misma clave y el servidor
   * devuelve la gestión ya guardada en vez de crear otra. Solo cambia cuando
   * el asesor pide registrar *otro* intento.
   */
  const [clientRequestId, setClientRequestId] = useState(() =>
    crypto.randomUUID(),
  );

  const [result, setResult] = useState("SIN_RESPUESTA");
  const [observation, setObservation] = useState("");
  const [phoneChoice, setPhoneChoice] = useState(
    phoneOptions.length === 1
      ? phoneOptions[0]!
      : defaultPhone && phoneOptions.includes(defaultPhone)
        ? defaultPhone
        : phoneOptions[0] ?? otherPhone,
  );
  const [otherNumber, setOtherNumber] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ message: string; detail: string } | null>(
    null,
  );

  const dirty =
    result !== "SIN_RESPUESTA" ||
    observation.length > 0 ||
    scheduledAt.length > 0 ||
    otherNumber.length > 0;

  useEffect(() => {
    draft.setDirty(saved === null && dirty);
  }, [dirty, draft, saved]);

  // El foco entra en la gestión al abrirla y no se mueve mientras se edita.
  useEffect(() => {
    resultRef.current?.focus();
  }, []);

  const notifiedRef = useRef<CampaignAttemptInlineState | null>(null);

  useEffect(() => {
    if (state === notifiedRef.current) return;
    notifiedRef.current = state;

    if (state.type === "success" && state.attempt) {
      setSaved({ message: state.message, detail: state.detail ?? "" });
      onSaved(state.attempt, state.message, state.detail ?? "");
      draft.finishAfterSave();
    }

    if (state.type === "error" && state.unmanageable) {
      onUnmanageable(state.message);
    }
  }, [draft, onSaved, onUnmanageable, state]);

  function validate(event: React.FormEvent<HTMLFormElement>) {
    // Se valida aquí lo que el asesor puede corregir sin ida al servidor;
    // el servidor vuelve a validar todo, y su palabra es la que vale.
    if (result === "AGENDA") {
      const when = scheduledAt ? new Date(scheduledAt) : null;

      if (!when || Number.isNaN(when.getTime())) {
        event.preventDefault();
        setFieldError("Indica la fecha y hora acordadas para agendar.");
        return;
      }

      if (when.getTime() <= Date.now()) {
        event.preventDefault();
        setFieldError("La fecha agendada debe ser posterior a ahora.");
        return;
      }
    }

    if (phoneChoice === otherPhone && otherNumber.trim().length === 0) {
      event.preventDefault();
      setFieldError("Escribe el número que usaste o elige uno de la lista.");
      return;
    }

    setFieldError(null);
  }

  function startAnother() {
    setClientRequestId(crypto.randomUUID());
    setResult("SIN_RESPUESTA");
    setObservation("");
    setScheduledAt("");
    setOtherNumber("");
    setFieldError(null);
    setSaved(null);
    notifiedRef.current = null;
    resultRef.current?.focus();
  }

  const phoneUsed = phoneChoice === otherPhone ? otherNumber.trim() : phoneChoice;
  const showPause = result === "RECHAZA" || result === "CANCELADO";

  if (saved) {
    return (
      <div
        aria-live="polite"
        className="flex flex-wrap items-center gap-3 text-sm"
        role="status"
      >
        <span className="font-medium text-ui-success">✓ {saved.message}</span>
        {saved.detail ? (
          <span className="text-ui-muted">{saved.detail}</span>
        ) : null}
        <span className="text-xs text-ui-muted">
          Este caso cambiará de posición al actualizar la cola.
        </span>
        <button
          className="ui-button ui-button--secondary"
          onClick={startAnother}
          type="button"
        >
          Registrar otro intento
        </button>
        <button className="ui-button ui-button--quiet" onClick={onCancel} type="button">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={validate}
      ref={formRef}
    >
      <input name="caseId" type="hidden" value={caseId} />
      <input name="clientRequestId" type="hidden" value={clientRequestId} />
      <input name="phoneUsed" type="hidden" value={phoneUsed} />

      {lastResult ? (
        <p className="text-xs text-ui-muted">
          <span className="ui-label-eyebrow">Última gestión</span>{" "}
          <span
            className="ui-status-badge"
            data-tone={attemptResultTones[lastResult] ?? "neutral"}
          >
            {attemptResultLabels[lastResult] ?? lastResult}
          </span>
          {lastObservation ? (
            <span className="ml-2 italic">«{lastObservation}»</span>
          ) : null}
        </p>
      ) : null}

      {draft.pendingSwitchId ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-ui-warning bg-ui-warning-soft px-3 py-2 text-sm"
          role="alertdialog"
          aria-labelledby={`${ids}-switch`}
        >
          <span id={`${ids}-switch`} className="text-ui-warning">
            Tienes una gestión sin guardar para {holderName}.
          </span>
          <button
            className="ui-button ui-button--primary"
            disabled={pending}
            onClick={() => formRef.current?.requestSubmit()}
            type="button"
          >
            Guardar y cambiar
          </button>
          <button
            className="ui-button ui-button--secondary"
            onClick={draft.discardAndSwitch}
            type="button"
          >
            Descartar y cambiar
          </button>
          <button
            className="ui-button ui-button--quiet"
            onClick={draft.staySwitching}
            type="button"
          >
            Seguir editando
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="ui-label-eyebrow">Resultado</span>
          <select
            className="mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
            name="result"
            onChange={(event) => {
              setResult(event.target.value);
              setFieldError(null);
            }}
            ref={resultRef}
            value={result}
          >
            {Object.entries(attemptResultChoiceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm lg:col-span-2">
          <span className="ui-label-eyebrow">Observación del contacto</span>
          <input
            className="mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
            maxLength={2000}
            name="observation"
            onChange={(event) => setObservation(event.target.value)}
            placeholder="Qué dijo el cliente hoy"
            value={observation}
          />
        </label>

        <label className="block text-sm">
          <span className="ui-label-eyebrow">Canal</span>
          <select
            className="mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
            defaultValue="LLAMADA"
            name="channel"
          >
            {Object.entries(channelLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="ui-label-eyebrow">Teléfono utilizado</span>
          <select
            className="mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
            onChange={(event) => setPhoneChoice(event.target.value)}
            value={phoneChoice}
          >
            {phoneOptions.map((phone) => (
              <option key={phone} value={phone}>
                {phone}
              </option>
            ))}
            <option value={otherPhone}>Otro número…</option>
          </select>
        </label>

        {phoneChoice === otherPhone ? (
          <label className="block text-sm">
            <span className="ui-label-eyebrow">Número usado</span>
            <input
              className="mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
              inputMode="tel"
              maxLength={15}
              onChange={(event) => setOtherNumber(event.target.value)}
              value={otherNumber}
            />
          </label>
        ) : null}

        {result === "AGENDA" ? (
          <label className="block text-sm lg:col-span-2">
            <span className="ui-label-eyebrow">Fecha y hora acordadas</span>
            <input
              aria-describedby={fieldError ? `${ids}-error` : undefined}
              aria-invalid={fieldError ? true : undefined}
              className="mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
              name="scheduledAt"
              onChange={(event) => {
                setScheduledAt(event.target.value);
                setFieldError(null);
              }}
              type="datetime-local"
              value={scheduledAt}
            />
          </label>
        ) : null}

        {showPause ? (
          <label className="block text-sm">
            <span className="ui-label-eyebrow">Pausa antes de reintentar</span>
            <select
              className="mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
              defaultValue="1"
              name="pauseDays"
            >
              <option value="1">1 día</option>
              <option value="2">2 días</option>
            </select>
          </label>
        ) : null}
      </div>

      {fieldError || state.type === "error" ? (
        <p
          aria-live="assertive"
          className="text-sm font-medium text-ui-danger"
          id={`${ids}-error`}
          role="alert"
        >
          {fieldError ?? state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="ui-button ui-button--primary"
          disabled={pending || state.unmanageable === true}
          type="submit"
        >
          {pending ? "Guardando…" : "Guardar gestión"}
        </button>
        <button
          className="ui-button ui-button--quiet"
          disabled={pending}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <span className="text-xs text-ui-muted">
          Lo que guardes no se puede editar después.
        </span>
      </div>
    </form>
  );
}
