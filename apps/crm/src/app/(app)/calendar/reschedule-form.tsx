"use client";

import { useActionState } from "react";

import type { ActionState } from "@/server/forms";

import { rescheduleAppointmentAction } from "./actions";

/** Horario libre listo para mostrar: valor en ISO y texto con el cupo que queda. */
export interface SlotOption {
  value: string;
  label: string;
}

/**
 * Mover una cita a otro horario con cupo. La cita original no se edita: queda
 * como reprogramada y apunta a la nueva, así el historial no se pierde.
 */
export function RescheduleForm({ appointmentId, slots }: { appointmentId: string; slots: SlotOption[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(rescheduleAppointmentAction, {});
  return (
    <details className="grid gap-2">
      <summary className="cursor-pointer text-sm font-medium text-ui-accent">Reprogramar</summary>
      {slots.length === 0 ? (
        <p className="text-xs text-ui-muted">
          No queda ningún horario libre en los próximos 14 días. Hasta que se amplíen las franjas de atención (Ajustes → Cupos de citas) esta cita no se puede mover.
        </p>
      ) : (
        <form action={formAction} className="ui-form-stack">
          <input name="appointmentId" type="hidden" value={appointmentId} />
          <label className="ui-field">
            <span className="ui-field__label">Nuevo horario</span>
            <select className="ui-control ui-control--select" defaultValue="" name="scheduledAt" required>
              <option disabled value="">Elige un horario</option>
              {slots.map((slot) => (
                <option key={slot.value} value={slot.value}>{slot.label}</option>
              ))}
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-field__label">Motivo (opcional)</span>
            <input className="ui-control" maxLength={200} name="reason" placeholder="El cliente pidió otra hora" />
          </label>
          {state.error ? <p className="ui-feedback" data-tone="danger" role="alert">{state.error}</p> : null}
          <button className="ui-button ui-button--secondary" disabled={pending} type="submit">
            {pending ? "Moviendo…" : "Mover la cita"}
          </button>
        </form>
      )}
    </details>
  );
}
