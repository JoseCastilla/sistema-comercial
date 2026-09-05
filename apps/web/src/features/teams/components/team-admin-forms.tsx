"use client";

import { useActionState } from "react";

import { ConfirmSubmitButton } from "@repo/ui/confirm-submit-button";

import {
  reactivateTeamAction,
  removeTeamSupervisionAction,
  renameTeamAction,
} from "../server/team-actions";

const initialState = { type: "idle" as const, message: "" };

const inputClass =
  "w-full rounded-lg border border-ui-border-strong bg-ui-surface px-3 py-2 text-sm text-ui-text";

function Feedback({
  state,
}: {
  state: { type: "idle" | "success" | "error"; message: string };
}) {
  if (state.type === "idle") return null;

  return (
    <p
      aria-live="polite"
      className={
        state.type === "success"
          ? "text-xs font-medium text-ui-success"
          : "text-xs font-medium text-ui-danger"
      }
      role={state.type === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

/** SPEC-001 FR-001 vía SPEC-043 PE-05: renombrar conserva identidad e historial. */
export function RenameTeamForm({
  teamId,
  name,
  code,
}: {
  teamId: string;
  name: string;
  code: string | null;
}) {
  const [state, action, pending] = useActionState(
    renameTeamAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-2 text-xs">
      <input name="teamId" type="hidden" value={teamId} />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <label className="block space-y-1">
          <span className="font-medium text-ui-muted">Nombre</span>
          <input
            className={inputClass}
            defaultValue={name}
            maxLength={150}
            minLength={2}
            name="name"
            required
            type="text"
          />
          {state.fieldErrors?.name ? (
            <span className="text-ui-danger">{state.fieldErrors.name}</span>
          ) : null}
        </label>
        <label className="block space-y-1">
          <span className="font-medium text-ui-muted">Código</span>
          <input
            className={inputClass}
            defaultValue={code ?? ""}
            maxLength={50}
            name="code"
            type="text"
          />
        </label>
      </div>
      <p className="text-ui-muted">
        Las ventas, los casos y el historial siguen apuntando al mismo equipo;
        solo cambia cómo se llama.
      </p>
      <Feedback state={state} />
      <button
        className="rounded-lg bg-ui-accent px-3 py-2 font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Guardando…" : "Guardar nombre"}
      </button>
    </form>
  );
}

/**
 * Retirar una supervisión sin tocar nada más (SPEC-043 BR-013). Si la persona
 * vende en el equipo, sigue vendiendo como asesora; si era la única
 * supervisora, se avisa que el equipo queda sin supervisor (no bloquea,
 * SPEC-017 BR-009).
 */
export function RemoveSupervisionForm({
  teamId,
  teamName,
  userId,
  userName,
  sellsHere,
  lastSupervisor,
}: {
  teamId: string;
  teamName: string;
  userId: string;
  userName: string;
  sellsHere: boolean;
  lastSupervisor: boolean;
}) {
  const [state, action] = useActionState(
    removeTeamSupervisionAction,
    initialState,
  );

  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input name="teamId" type="hidden" value={teamId} />
      <input name="userId" type="hidden" value={userId} />
      <ConfirmSubmitButton
        confirmLabel="Retirar supervisión"
        description={
          <ul className="space-y-1">
            <li>
              {userName} deja de supervisar {teamName}. Sus otros equipos no
              cambian.
            </li>
            <li>
              {sellsHere
                ? "Sigue vendiendo en este equipo, ahora como asesor: sus ventas nuevas se le siguen asignando."
                : "No vendía aquí: no pierde ninguna venta."}
            </li>
            {lastSupervisor ? (
              <li className="text-ui-warning">
                Era la única supervisión: el equipo queda sin supervisor hasta
                que asignes otro.
              </li>
            ) : null}
            <li>Su rol en la organización y su historial no cambian.</li>
          </ul>
        }
        title={`¿Retirar a ${userName} de la supervisión de ${teamName}?`}
        triggerLabel="Retirar supervisión"
      />
      <Feedback state={state} />
    </form>
  );
}

/** Reactivar devuelve el equipo vacío: nadie recupera su membresía en silencio. */
export function ReactivateTeamForm({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName: string;
}) {
  const [state, action] = useActionState(reactivateTeamAction, initialState);

  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input name="teamId" type="hidden" value={teamId} />
      <ConfirmSubmitButton
        confirmLabel="Reactivar vacío"
        description={
          <ul className="space-y-1">
            <li>{teamName} vuelve a estar activo y disponible para asignar.</li>
            <li>
              Vuelve <strong>vacío</strong>: nadie recupera su membresía
              anterior. Asigna supervisor e integrantes después, a mano.
            </li>
            <li>
              Si otro equipo activo ya se llama igual, no se reactiva: primero
              renombra uno de los dos.
            </li>
          </ul>
        }
        title={`¿Reactivar ${teamName}?`}
        triggerLabel="Reactivar"
      />
      <Feedback state={state} />
    </form>
  );
}
