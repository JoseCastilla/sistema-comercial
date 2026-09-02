"use client";

import { useActionState, useMemo, useState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";
import { Field, SelectInput } from "@repo/ui/field";

import { assignTeamMemberAction } from "../server/team-actions";

interface Candidate {
  id: string;
  name: string;
  email: string;
  currentTeamId: string | null;
  currentTeamName: string | null;
  activeTeamIds: string[];
}

const initialState = { type: "idle" as const, message: "" };

export function AssignTeamMemberForm({
  agents,
  supervisors,
  teamId,
  teamName,
}: {
  agents: Candidate[];
  supervisors: Candidate[];
  teamId: string;
  teamName: string;
}) {
  const [state, action, pending] = useActionState(
    assignTeamMemberAction,
    initialState,
  );
  const [memberRole, setMemberRole] = useState<
    "AGENT" | "SUPERVISOR" | "SELLING_SUPERVISOR"
  >("AGENT");
  const [userId, setUserId] = useState("");
  const candidates = useMemo(() => {
    const source =
      memberRole === "AGENT"
        ? agents
        : memberRole === "SUPERVISOR"
          ? supervisors
          : [...agents, ...supervisors].filter(
              (candidate, index, all) =>
                all.findIndex((item) => item.id === candidate.id) === index,
            );
    return source.filter(
      (candidate) =>
        memberRole !== "AGENT" || !candidate.activeTeamIds.includes(teamId),
    );
  }, [agents, memberRole, supervisors, teamId]);
  const selectedCandidate = candidates.find(
    (candidate) => candidate.id === userId,
  );
  const movesAgent =
    memberRole === "AGENT" &&
    selectedCandidate?.currentTeamId &&
    selectedCandidate.currentTeamId !== teamId;

  return (
    <form action={action} className="ui-team-assignment">
      <input name="teamId" type="hidden" value={teamId} />
      <Field label="Función en el equipo">
        <SelectInput
          name="memberRole"
          onChange={(event) => {
            setMemberRole(
              event.target.value as
                "AGENT" | "SUPERVISOR" | "SELLING_SUPERVISOR",
            );
            setUserId("");
          }}
          value={memberRole}
        >
          <option value="AGENT">Asesor (este es su equipo principal)</option>
          <option value="SUPERVISOR">Supervisor</option>
          <option value="SELLING_SUPERVISOR">
            Supervisor que también vende
          </option>
        </SelectInput>
      </Field>
      <Field label={memberRole === "AGENT" ? "Asesor" : "Persona"}>
        <SelectInput
          disabled={candidates.length === 0}
          name="userId"
          onChange={(event) => setUserId(event.target.value)}
          required
          value={userId}
        >
          <option value="">
            {candidates.length === 0
              ? "No hay personas disponibles"
              : "Seleccionar persona"}
          </option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} · {candidate.email}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Button
        disabled={pending || !userId || candidates.length === 0}
        type="submit"
        variant="secondary"
      >
        {pending ? "Asignando..." : "Confirmar asignación"}
      </Button>
      {movesAgent ? (
        <p className="ui-team-assignment__notice">
          {selectedCandidate?.name} se moverá de{" "}
          <strong>{selectedCandidate?.currentTeamName}</strong> a{" "}
          <strong>{teamName}</strong>. Sus pedidos históricos conservarán el
          equipo registrado.
        </p>
      ) : null}
      {memberRole === "SELLING_SUPERVISOR" && userId ? (
        <p className="ui-team-assignment__notice">
          Se promoverá como supervisor y sus ventas nuevas seguirán llegando a
          este equipo. No podrá cerrar ni cancelar sus propias órdenes.
        </p>
      ) : null}
      <div className="ui-team-assignment__feedback">
        <InlineFeedback
          message={state.message}
          tone={state.type === "error" ? "danger" : "success"}
        />
      </div>
    </form>
  );
}
