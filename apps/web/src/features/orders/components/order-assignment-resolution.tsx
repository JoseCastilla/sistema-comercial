"use client";

import { useActionState, useState } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";
import { Field, SelectInput, TextInput } from "@repo/ui/field";

import { claimOrphanOrderAction } from "../server/claim-orphan-order-action";
import { resolveOrderAssignmentAction } from "../server/resolve-order-assignment-action";

import type {
  OrderAssignmentTeamOption,
  OrderInboxItem,
} from "../order-inbox.types";
import type { ClaimOrphanOrderActionState } from "../server/claim-orphan-order-action.types";
import type { ResolveOrderAssignmentActionState } from "../server/resolve-order-assignment-action.types";

const initialResolveState: ResolveOrderAssignmentActionState = {
  type: "idle",
  message: "",
};
const initialClaimState: ClaimOrphanOrderActionState = {
  type: "idle",
  message: "",
};

const reasonOptions = [
  { value: "DATA_CORRECTION", label: "Corrección de datos" },
  { value: "INCORRECT_ALIAS", label: "Nombre o alias incorrecto" },
  {
    value: "REGISTERED_FOR_ANOTHER_AGENT",
    label: "Registrada para otro asesor",
  },
  { value: "OTHER", label: "Otro motivo" },
] as const;

export function OrderAssignmentResolution({
  order,
  teams,
}: {
  order: OrderInboxItem;
  teams: OrderAssignmentTeamOption[];
}) {
  const [resolveState, resolveAction, resolving] = useActionState(
    resolveOrderAssignmentAction,
    initialResolveState,
  );
  const [claimState, claimAction, claiming] = useActionState(
    claimOrphanOrderAction,
    initialClaimState,
  );
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [agentUserId, setAgentUserId] = useState(teams[0]?.agents[0]?.id ?? "");
  const [reason, setReason] = useState("DATA_CORRECTION");
  const selectedTeam = teams.find((team) => team.id === teamId);

  function selectTeam(nextTeamId: string) {
    const nextTeam = teams.find((team) => team.id === nextTeamId);
    setTeamId(nextTeamId);
    setAgentUserId(nextTeam?.agents[0]?.id ?? "");
  }

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h4 className="text-sm font-semibold text-amber-950">
        Asignación pendiente
      </h4>

      <p className="mt-2 text-sm leading-6 text-amber-900">
        Esta venta todavía no pertenece a un asesor ni a un equipo comercial.
      </p>

      {order.canResolveAssignment && order.submitterEmail ? (
        <form action={resolveAction} className="mt-4 space-y-3">
          <input name="orderId" type="hidden" value={order.id} />
          <input
            name="expectedUpdatedAt"
            type="hidden"
            value={order.updatedAt}
          />

          <p className="text-xs leading-5 text-amber-800">
            Correo informado: {order.submitterEmail}
          </p>

          <InlineFeedback
            message={resolveState.message}
            tone={
              resolveState.type === "success"
                ? "success"
                : resolveState.type === "idle"
                  ? "neutral"
                  : "danger"
            }
          />

          <Button disabled={resolving} type="submit" variant="secondary">
            {resolving
              ? "Comprobando identidad..."
              : "Asociar por correo corporativo"}
          </Button>
        </form>
      ) : null}

      {order.canClaimAssignment ? (
        <details
          className="mt-4 border-t border-amber-200 pt-4"
          open={!order.canResolveAssignment}
        >
          <summary className="cursor-pointer text-sm font-semibold text-amber-950">
            Asignar responsable manualmente
          </summary>

          <form action={claimAction} className="ui-form-stack mt-4">
            <input name="orderId" type="hidden" value={order.id} />
            <input
              name="expectedUpdatedAt"
              type="hidden"
              value={order.updatedAt}
            />

            <Field error={claimState.fieldErrors?.teamId} label="Equipo">
              <SelectInput
                disabled={claiming}
                name="teamId"
                onChange={(event) => selectTeam(event.currentTarget.value)}
                required
                value={teamId}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field
              error={claimState.fieldErrors?.agentUserId}
              label="Asesor responsable"
            >
              <SelectInput
                disabled={claiming}
                name="agentUserId"
                onChange={(event) => setAgentUserId(event.currentTarget.value)}
                required
                value={agentUserId}
              >
                {selectedTeam?.agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field error={claimState.fieldErrors?.reason} label="Motivo">
              <SelectInput
                disabled={claiming}
                name="reason"
                onChange={(event) => setReason(event.currentTarget.value)}
                required
                value={reason}
              >
                {reasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            {reason === "OTHER" ? (
              <Field
                error={claimState.fieldErrors?.observation}
                label="Explicación"
              >
                <TextInput
                  disabled={claiming}
                  maxLength={500}
                  name="observation"
                  required
                />
              </Field>
            ) : null}

            <InlineFeedback
              message={claimState.message}
              tone={
                claimState.type === "success"
                  ? "success"
                  : claimState.type === "idle"
                    ? "neutral"
                    : "danger"
              }
            />

            <Button disabled={claiming || !agentUserId} type="submit">
              {claiming ? "Asignando..." : "Confirmar asignación"}
            </Button>
          </form>
        </details>
      ) : null}
    </section>
  );
}
