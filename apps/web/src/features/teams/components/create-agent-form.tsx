"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";
import { Field, SelectInput, TextInput } from "@repo/ui/field";

import { createAgentForTeamAction } from "../server/create-agent-for-team-action";

import type { CreateUserActionState } from "@/features/users/server/user-action.types";

const initialState: CreateUserActionState = { type: "idle", message: "" };

/**
 * Alta de un asesor desde «Mi equipo» — SPEC-043 PE-07. El rol no se elige:
 * siempre es asesor; el equipo solo puede ser uno de los que supervisa quien
 * lo crea. El servidor vuelve a comprobar las dos cosas.
 */
export function CreateAgentForm({
  teams,
}: {
  teams: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    createAgentForTeamAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.type === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form action={formAction} className="ui-form-stack" ref={formRef}>
      <Field error={state.fieldErrors?.name} label="Nombre completo">
        <TextInput
          autoComplete="name"
          disabled={pending}
          maxLength={150}
          name="name"
          placeholder="Nombre y apellido"
          required
          type="text"
        />
      </Field>

      <Field
        error={state.fieldErrors?.email}
        hint="Es su identidad operativa: las ventas que lleguen con este correo se le asignan."
        label="Correo corporativo"
      >
        <TextInput
          autoComplete="email"
          disabled={pending}
          maxLength={254}
          name="email"
          placeholder="nombre.apellido@empresa.com"
          required
          type="email"
        />
      </Field>

      <Field
        error={state.fieldErrors?.role}
        hint="Solo los equipos que supervisas. Entra como asesor."
        label="Equipo"
      >
        <SelectInput
          defaultValue={teams.length === 1 ? teams[0]!.id : ""}
          disabled={pending || teams.length === 0}
          name="teamId"
          required
        >
          <option disabled value="">
            {teams.length === 0
              ? "No supervisas equipos activos"
              : "Elige el equipo"}
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field
        error={state.fieldErrors?.password}
        hint="Compártela por un canal seguro. No podrá consultarse después."
        label="Contraseña inicial"
      >
        <TextInput
          autoComplete="new-password"
          disabled={pending}
          maxLength={128}
          minLength={12}
          name="password"
          placeholder="Mínimo 12 caracteres"
          required
          type="password"
        />
      </Field>

      <InlineFeedback
        message={state.message}
        tone={state.type === "error" ? "danger" : "success"}
      />
      <Button disabled={pending || teams.length === 0} fullWidth type="submit">
        {pending ? "Creando asesor..." : "Crear asesor"}
      </Button>
    </form>
  );
}
