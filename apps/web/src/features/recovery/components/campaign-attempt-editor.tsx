"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  parseLimaDateTimeLocal,
  previewRecoveryAttemptConsequence,
  recoveryAttemptChoices,
  recoveryAttemptFields,
} from "@repo/validation";

import { attemptResultLabels, attemptResultTones } from "../attempt-result-labels";
import { registerCampaignAttemptInlineAction } from "../server/register-recovery-attempt-action";
import {
  AttemptResultFields,
  emptyAttemptExtras,
  type AttemptExtras,
} from "./attempt-result-fields";
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

const quickChoices = recoveryAttemptChoices.filter((choice) => choice.hotkey);

export type ConfirmedAttempt = NonNullable<
  CampaignAttemptInlineState["attempt"]
>;

/**
 * Registro de una gestión sin salir de la fila (BR-090; SPEC-049 BR-009 a
 * BR-011).
 *
 * Es el gesto del Excel: resultado y observación a la izquierda, se anota y
 * se sigue con el siguiente. Lo que cambia respecto a la hoja es que cada
 * guardado es un evento nuevo e inmutable, con autor y hora del servidor, y
 * que la fila se actualiza con lo que el servidor confirmó, no con lo que
 * el asesor escribió.
 *
 * Nada viene preseleccionado: un clic de más no guarda «no contesta» sin
 * que haya pasado. Los resultados frecuentes tienen tecla (N, I, R, A); los
 * campos adicionales aparecen solo para el resultado elegido, y la
 * consecuencia se lee antes de guardar.
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
  serviceNumbers = [],
  lastResult,
  lastObservation,
  onSaved,
  onCancel,
  onUnmanageable,
  onNext,
  nextName,
}: {
  caseId: string;
  holderName: string;
  /** Teléfonos de contacto y líneas, sin repetir. */
  phoneOptions: string[];
  defaultPhone: string | null;
  /** Líneas activas del caso, para «no cumple antigüedad». */
  serviceNumbers?: string[];
  lastResult: string | null;
  lastObservation: string | null;
  onSaved: (attempt: ConfirmedAttempt, message: string, detail: string) => void;
  onCancel: () => void;
  /** El servidor dijo que el caso ya no es gestionable por quien lo intenta. */
  onUnmanageable: (reason: string) => void;
  /**
   * SPEC-049 BR-016: «Guardar y siguiente». Se llama solo cuando el servidor
   * confirmó el guardado; abre la gestión del siguiente caso exigible.
   */
  onNext?: () => void;
  nextName?: string | null;
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

  const [result, setResult] = useState("");
  const [observation, setObservation] = useState("");
  const [phoneChoice, setPhoneChoice] = useState(
    phoneOptions.length === 1
      ? phoneOptions[0]!
      : defaultPhone && phoneOptions.includes(defaultPhone)
        ? defaultPhone
        : (phoneOptions[0] ?? otherPhone),
  );
  const [otherNumber, setOtherNumber] = useState("");
  const [extras, setExtras] = useState<AttemptExtras>(emptyAttemptExtras);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{
    message: string;
    detail: string;
    result: string;
  } | null>(null);

  const dirty =
    result.length > 0 || observation.length > 0 || otherNumber.length > 0;

  useEffect(() => {
    draft.setDirty(saved === null && dirty);
  }, [dirty, draft, saved]);

  // El foco entra en la gestión al abrirla y no se mueve mientras se edita.
  useEffect(() => {
    resultRef.current?.focus();
  }, []);

  const notifiedRef = useRef<CampaignAttemptInlineState | null>(null);
  /** El asesor pidió avanzar al siguiente en cuanto el servidor confirme. */
  const advanceRef = useRef(false);

  useEffect(() => {
    if (state === notifiedRef.current) return;
    notifiedRef.current = state;

    if (state.type === "success" && state.attempt) {
      setSaved({
        message: state.message,
        detail: state.detail ?? "",
        result: state.attempt.result,
      });
      onSaved(state.attempt, state.message, state.detail ?? "");
      draft.finishAfterSave();

      // BR-016: avanzar únicamente después de confirmar el guardado. Un
      // error deja el borrador en su sitio y no mueve el foco.
      if (advanceRef.current && onNext) {
        advanceRef.current = false;
        onNext();
      }
    }

    if (state.type === "error") {
      advanceRef.current = false;
      if (state.unmanageable) onUnmanageable(state.message);
    }
  }, [draft, onNext, onSaved, onUnmanageable, state]);

  function choose(next: string) {
    setResult(next);
    setFieldError(null);
  }

  function validate(event: React.FormEvent<HTMLFormElement>) {
    // Se valida aquí lo que el asesor puede corregir sin ida al servidor;
    // el servidor vuelve a validar todo, y su palabra es la que vale.
    if (!result) {
      event.preventDefault();
      setFieldError("Elige qué pasó en la llamada antes de guardar.");
      return;
    }

    const needsAppointment =
      result === "AGENDA" ||
      (result === "INTERESADO" && extras.interestedNext === "cita");
    if (needsAppointment) {
      const when = extras.scheduledAt
        ? parseLimaDateTimeLocal(extras.scheduledAt)
        : null;

      if (!when) {
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

    const needsFollowUp =
      result === "IMPEDIMENTO" ||
      (result === "INTERESADO" && extras.interestedNext === "seguimiento");
    if (needsFollowUp && !extras.followUpDate) {
      event.preventDefault();
      setFieldError("Indica la fecha del seguimiento.");
      return;
    }

    if (result === "IMPEDIMENTO" && !extras.reason) {
      event.preventDefault();
      setFieldError("Di qué impide la venta: problema de huella u otro.");
      return;
    }

    if (result === "NO_CONTACTAR" && observation.trim().length < 10) {
      event.preventDefault();
      setFieldError(
        "Escribe qué dijo el cliente: es la evidencia para cerrarlo como rechazo definitivo.",
      );
      return;
    }

    if (
      result === "NO_CUMPLE_30D" &&
      serviceNumbers.length > 1 &&
      !extras.serviceNumber
    ) {
      event.preventDefault();
      setFieldError("Di cuál de las líneas no cumple los 30 días.");
      return;
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
    setResult("");
    setObservation("");
    setOtherNumber("");
    setExtras(emptyAttemptExtras);
    setFieldError(null);
    setSaved(null);
    // La marca de «ya notificado» se conserva: el estado de la acción sigue
    // siendo el del envío anterior y no debe volver a mostrarse como guardado
    // cuando el asesor cambie un campo del intento nuevo.
    resultRef.current?.focus();
  }

  /**
   * Teclas directas (BR-009): N, I, R, A eligen el resultado sin abrir el
   * desplegable. No actúan mientras se escribe en un campo de texto.
   */
  function hotkeys(event: React.KeyboardEvent<HTMLFormElement>) {
    // Esc cierra la gestión, como el botón Cancelar (BR-016).
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" &&
      !["radio", "checkbox"].includes((target as HTMLInputElement).type)
    ) {
      return;
    }
    if (target.tagName === "TEXTAREA" || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const key = event.key.toUpperCase();
    const choice = quickChoices.find((item) => item.hotkey === key);
    if (choice) {
      event.preventDefault();
      choose(choice.value);
    }
  }

  const phoneUsed =
    phoneChoice === otherPhone ? otherNumber.trim() : phoneChoice;
  const requires = recoveryAttemptFields(result);
  const observationRequired = requires.required.includes("observation");
  const preview = previewRecoveryAttemptConsequence({
    result,
    reason: extras.reason,
    pauseDays: extras.pauseDays === "2" ? 2 : 1,
    scheduledAtRaw:
      result === "AGENDA" || extras.interestedNext === "cita"
        ? extras.scheduledAt
        : "",
    followUpDate:
      result === "IMPEDIMENTO" || extras.interestedNext === "seguimiento"
        ? extras.followUpDate
        : "",
    reportedDate: extras.reportedDate,
    needsSupervisor: extras.needsSupervisor,
    phoneUsed,
    validPhonesLeft: phoneOptions.filter((phone) => phone !== phoneUsed).length,
  });

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
        {saved.result === "NO_CONTACTAR" ? (
          <Link
            className="ui-button ui-button--danger"
            href={`/recovery/campaigns/${caseId}#resolver`}
          >
            Cerrar ahora como rechazo definitivo
          </Link>
        ) : null}
        {saved.result === "VENDIDO" ? (
          <Link
            className="ui-button ui-button--secondary"
            href={`/recovery/campaigns/${caseId}#resolver`}
          >
            Vincular la orden
          </Link>
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
        <button
          className="ui-button ui-button--quiet"
          onClick={onCancel}
          type="button"
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="space-y-3"
      onKeyDown={hotkeys}
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

      <div
        aria-label="Resultados frecuentes"
        className="flex flex-wrap gap-2"
        role="group"
      >
        {quickChoices.map((choice) => (
          <button
            aria-pressed={result === choice.value}
            className={`ui-button ${result === choice.value ? "ui-button--primary" : "ui-button--secondary"}`}
            key={choice.value}
            onClick={() => choose(choice.value)}
            title={`Tecla ${choice.hotkey}`}
            type="button"
          >
            <span className="mr-1 rounded bg-ui-surface-muted px-1 text-xs">
              {choice.hotkey}
            </span>
            {choice.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="ui-label-eyebrow">Resultado</span>
          <select
            className="mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
            name="result"
            onChange={(event) => choose(event.target.value)}
            ref={resultRef}
            value={result}
          >
            <option value="">Elige qué pasó…</option>
            {recoveryAttemptChoices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>

        <AttemptResultFields
          errorId={fieldError ? `${ids}-error` : undefined}
          extras={extras}
          idPrefix={ids}
          onChange={(next) => {
            setExtras((current) => ({ ...current, ...next }));
            setFieldError(null);
          }}
          result={result}
          serviceNumbers={serviceNumbers}
        />

        <label className="block text-sm lg:col-span-2">
          <span className="ui-label-eyebrow">
            {observationRequired
              ? "Qué dijo el cliente (obligatorio)"
              : "Observación del contacto"}
          </span>
          <input
            className="mt-1 block w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
            maxLength={2000}
            name="observation"
            onChange={(event) => setObservation(event.target.value)}
            placeholder="Qué dijo el cliente hoy"
            required={observationRequired}
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
      </div>

      {preview ? (
        <p className="text-sm text-ui-muted" data-testid="consecuencia">
          <span className="ui-label-eyebrow">Al guardar</span> {preview}
        </p>
      ) : null}

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
          onClick={() => {
            advanceRef.current = false;
          }}
          type="submit"
        >
          {pending ? "Guardando…" : "Guardar gestión"}
        </button>
        {onNext ? (
          <button
            className="ui-button ui-button--secondary"
            disabled={pending || state.unmanageable === true}
            onClick={() => {
              // Envía por el mismo camino que Enter: la validación del
              // formulario y la acción; el avance espera la confirmación.
              advanceRef.current = true;
              formRef.current?.requestSubmit();
            }}
            title={
              nextName
                ? `Guardar y abrir la gestión de ${nextName}`
                : "Guardar y abrir la gestión del siguiente caso"
            }
            type="button"
          >
            Guardar y siguiente
          </button>
        ) : null}
        <button
          className="ui-button ui-button--quiet"
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <span className="text-2xs text-ui-muted">
          Enter guarda · Esc cierra · N, I, R, A eligen el resultado
        </span>
      </div>
    </form>
  );
}
