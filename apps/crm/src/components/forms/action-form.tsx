"use client";

import { useActionState, type ReactNode } from "react";

import type { ActionState } from "@/server/forms";

/**
 * Formulario mínimo para acciones de servidor con estado {ok, error, message}.
 * Muestra el mensaje y deshabilita el botón mientras se envía.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Guardando…",
  className = "ui-form-stack",
  variant = "primary",
  confirm,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "secondary" | "danger" | "quiet";
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
      {state.error ? <p className="ui-feedback" data-tone="danger" role="alert">{state.error}</p> : null}
      {state.ok && state.message ? <p className="ui-feedback" data-tone="success">{state.message}</p> : null}
      <button className={`ui-button ui-button--${variant}`} disabled={pending} type="submit">
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
