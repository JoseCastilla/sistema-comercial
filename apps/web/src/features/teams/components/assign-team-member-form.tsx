"use client";

import { useActionState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";
import { Field, SelectInput } from "@repo/ui/field";

import { assignTeamMemberAction } from "../server/team-actions";

interface Candidate { id: string; name: string; email: string }

const initialState = { type: "idle" as const, message: "" };

export function AssignTeamMemberForm({ agents, supervisors, teamId }: { agents: Candidate[]; supervisors: Candidate[]; teamId: string }) {
  const [state, action, pending] = useActionState(assignTeamMemberAction, initialState);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-end">
      <input name="teamId" type="hidden" value={teamId} />
      <Field label="Tipo">
        <SelectInput name="memberRole" required>
          <option value="AGENT">Asesor principal</option>
          <option value="SUPERVISOR">Supervisor</option>
        </SelectInput>
      </Field>
      <Field label="Persona">
        <SelectInput name="userId" required>
          <option value="">Seleccionar</option>
          <optgroup label="Asesores">{agents.map((user) => <option key={`agent-${user.id}`} value={user.id}>{user.name} · {user.email}</option>)}</optgroup>
          <optgroup label="Supervisores">{supervisors.map((user) => <option key={`supervisor-${user.id}`} value={user.id}>{user.name} · {user.email}</option>)}</optgroup>
        </SelectInput>
      </Field>
      <Button disabled={pending} type="submit" variant="secondary">{pending ? "Asignando..." : "Asignar"}</Button>
      <div className="sm:col-span-3"><InlineFeedback message={state.message} tone={state.type === "error" ? "danger" : "success"} /></div>
    </form>
  );
}
