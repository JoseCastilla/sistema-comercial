"use client";

import { useActionState } from "react";

import { assignTeamMemberAction } from "../server/team-actions";

const initialState = { type: "idle" as const, message: "" };

/**
 * Asignar equipo desde la persona incompleta — SPEC-043 UX-04.
 *
 * Un asesor sin equipo operativo no recibe ventas (SPEC-001 BR-007). En vez
 * de mandar al administrador a Equipos a buscarlo, el panel de la persona
 * ofrece elegir el equipo aquí y reutiliza la misma acción de asignación,
 * con las mismas reglas y la misma auditoría.
 */
export function AssignTeamFromPersonForm({
  userId,
  mode,
  teams,
}: {
  userId: string;
  /** Asesor: equipo principal de venta. Supervisor: equipo que supervisará. */
  mode: "AGENT" | "SUPERVISOR";
  teams: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(
    assignTeamMemberAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-2 text-xs">
      <input name="userId" type="hidden" value={userId} />
      <input name="memberRole" type="hidden" value={mode} />
      <label className="block space-y-1">
        <span className="font-medium text-ui-muted">
          {mode === "AGENT"
            ? "Asignar equipo principal"
            : "Asignar equipo a supervisar"}
        </span>
        <select
          className="w-full rounded-lg border border-ui-border-strong bg-ui-surface px-3 py-2 text-sm text-ui-text"
          defaultValue=""
          name="teamId"
          required
        >
          <option value="">Elige el equipo</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
      {state.type !== "idle" ? (
        <p
          aria-live="polite"
          className={
            state.type === "success"
              ? "font-medium text-ui-success"
              : "font-medium text-ui-danger"
          }
        >
          {state.message}
        </p>
      ) : null}
      <button
        className="rounded-lg bg-ui-accent px-3 py-2 font-semibold text-white disabled:opacity-60"
        disabled={pending || state.type === "success"}
        type="submit"
      >
        {pending ? "Asignando…" : "Asignar equipo"}
      </button>
    </form>
  );
}
