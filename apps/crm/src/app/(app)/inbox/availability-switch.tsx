"use client";

import { useActionState, useRef } from "react";

import { setAvailability } from "@/server/inbox/actions";
import type { ActionState } from "@/server/forms";

/**
 * Interruptor de presencia del asesor (SPEC-054 BR-005). Se envía solo al
 * marcarlo: no hay botón «Guardar» para algo que se cambia varias veces al día.
 */
export function AvailabilitySwitch({ available }: { available: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setAvailability, {});
  const form = useRef<HTMLFormElement>(null);

  return (
    <form action={formAction} className="inbox-availability" data-available={available ? "true" : "false"} ref={form}>
      <label className="inbox-switch">
        <input
          defaultChecked={available}
          disabled={pending}
          name="available"
          onChange={() => form.current?.requestSubmit()}
          type="checkbox"
        />
        <span>Disponible para recibir conversaciones</span>
      </label>
      {state.error ? <p className="ui-feedback" data-tone="danger" role="alert">{state.error}</p> : null}
    </form>
  );
}
