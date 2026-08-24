"use client";

import { useActionState } from "react";

import { AGR_SYNC_WINDOWS } from "../agr-delivery.types";
import {
  runAgrDeliverySyncAction,
  saveAgrDeliveryCredentialAction,
  type AgrDeliveryActionState,
} from "../server/agr-delivery-actions";

const initialState: AgrDeliveryActionState = { type: "idle", message: "" };

function Feedback({ state }: { state: AgrDeliveryActionState }) {
  if (state.type === "idle") return null;
  return (
    <p
      className={
        state.type === "success"
          ? "text-sm font-medium text-ui-success"
          : "text-sm font-medium text-ui-danger"
      }
      role="status"
    >
      {state.message}
    </p>
  );
}

export function AgrDeliveryCredentialForm() {
  const [state, action, pending] = useActionState(
    saveAgrDeliveryCredentialAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium text-ui-text">
        Nueva cookie de sesión
        <input
          autoComplete="off"
          className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 font-mono text-sm"
          name="sessionCookie"
          placeholder="Pega únicamente el valor de la cookie"
          required
          type="password"
        />
      </label>
      <p className="text-xs text-ui-muted">
        El valor se prueba contra una venta desde el 10/08 y se almacena
        cifrado. Nunca se vuelve a mostrar.
      </p>
      <Feedback state={state} />
      <button
        className="rounded-lg bg-ui-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Validando…" : "Probar y guardar"}
      </button>
    </form>
  );
}

export function AgrDeliverySyncForm() {
  const [state, action, pending] = useActionState(
    runAgrDeliverySyncAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium text-ui-text">
        Alcance
        <select
          className="mt-1 w-full rounded-lg border border-ui-border bg-ui-surface px-3 py-2 text-sm"
          defaultValue="LAST_24H"
          name="window"
        >
          {Object.entries(AGR_SYNC_WINDOWS).map(([value, option]) => (
            <option key={value} value={value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <p className="text-xs text-ui-muted">
        Acota por fecha de registro de la venta. El corte del 10/08 se respeta
        siempre.
      </p>

      <Feedback state={state} />
      <button
        className="rounded-lg border border-ui-border bg-ui-surface px-4 py-2 text-sm font-semibold text-ui-text disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Sincronizando…" : "Sincronizar ahora"}
      </button>
    </form>
  );
}
