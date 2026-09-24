"use client";

import { useActionState } from "react";

import type { ActionState } from "@/server/forms";

import { recordOutcomeAction } from "./actions";

/**
 * Cierre de una cita pendiente: atendida, no contestó o cancelada, con nota
 * opcional. Un solo formulario y tres botones para que la nota valga para
 * cualquiera de los tres resultados.
 */
export function OutcomeForm({ appointmentId }: { appointmentId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(recordOutcomeAction, {});
  if (state.ok) return <p className="ui-feedback" data-tone="success">{state.message}</p>;
  return (
    <form
      action={formAction}
      className="grid gap-2"
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === "CANCELLED" && !window.confirm("¿Cancelar esta cita? El contacto dejará de tener hora reservada.")) {
          event.preventDefault();
        }
      }}
    >
      <input name="appointmentId" type="hidden" value={appointmentId} />
      <input aria-label="Nota sobre el resultado" className="ui-control" maxLength={500} name="notes" placeholder="Nota (opcional)" />
      <div className="flex flex-wrap gap-1">
        <button className="ui-button ui-button--primary" disabled={pending} name="status" type="submit" value="DONE">Atendida</button>
        <button className="ui-button ui-button--secondary" disabled={pending} name="status" type="submit" value="NO_SHOW">No contestó</button>
        <button className="ui-button ui-button--quiet" disabled={pending} name="status" type="submit" value="CANCELLED">Cancelar</button>
      </div>
      {state.error ? <p className="ui-feedback" data-tone="danger" role="alert">{state.error}</p> : null}
    </form>
  );
}
