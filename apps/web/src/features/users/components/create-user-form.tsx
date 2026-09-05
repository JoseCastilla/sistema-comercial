"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@repo/ui/button";
import { InlineFeedback } from "@repo/ui/feedback";
import { Field, SelectInput, TextInput } from "@repo/ui/field";

import { createUserAction } from "../server/create-user-action";

import type { CreateUserActionState } from "../server/user-action.types";

const initialState: CreateUserActionState = {
  type: "idle",
  message: "",
};

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(
    createUserAction,
    initialState,
  );

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.type === "success") {
      formRef.current?.reset();
    }
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

      <Field error={state.fieldErrors?.email} label="Correo">
        <TextInput
          autoComplete="email"
          disabled={pending}
          maxLength={254}
          name="email"
          placeholder="usuario@empresa.com"
          required
          type="email"
        />
      </Field>

      <Field error={state.fieldErrors?.role} label="Rol">
        <SelectInput defaultValue="" disabled={pending} name="role" required>
          <option disabled value="">
            Seleccionar rol
          </option>

          <option value="AGENT">Asesor</option>
          <option value="BACKOFFICE">Back office</option>
          <option value="SUPERVISOR">Supervisor</option>
          <option value="ADMIN">Administrador</option>
        </SelectInput>
      </Field>

      <Field
        error={state.fieldErrors?.password}
        hint="Compártela por un canal seguro. No podrá consultarse posteriormente."
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
      <Button disabled={pending} fullWidth type="submit">
        {pending ? "Creando usuario..." : "Crear usuario"}
      </Button>
    </form>
  );
}
