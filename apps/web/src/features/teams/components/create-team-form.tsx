"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";
import { Field, TextInput } from "@repo/ui/field";

import { createTeamAction } from "../server/team-actions";

const initialState = { type: "idle" as const, message: "" };

export function CreateTeamForm() {
  const [state, action, pending] = useActionState(createTeamAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.type === "success") formRef.current?.reset();
  }, [state.type]);

  return (
    <form action={action} className="ui-form-stack" ref={formRef}>
      <Field error={state.fieldErrors?.name} label="Nombre del equipo">
        <TextInput disabled={pending} maxLength={150} name="name" required />
      </Field>
      <Field error={state.fieldErrors?.code} hint="Útil para reportes y referencias internas." label="Código opcional">
        <TextInput className="uppercase" disabled={pending} maxLength={50} name="code" placeholder="LIMA-01" />
      </Field>
      <InlineFeedback message={state.message} tone={state.type === "error" ? "danger" : "success"} />
      <Button disabled={pending} fullWidth type="submit">{pending ? "Creando..." : "Crear equipo"}</Button>
    </form>
  );
}
