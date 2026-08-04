"use client";

import { useActionState, useEffect, useRef } from "react";

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
    <form action={formAction} className="space-y-4" ref={formRef}>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-neutral-800">Nombre completo</span>

        <input
          autoComplete="name"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
          disabled={pending}
          maxLength={150}
          name="name"
          placeholder="Nombre y apellido"
          required
          type="text"
        />

        {state.fieldErrors?.name ? (
          <span className="text-xs text-red-600">{state.fieldErrors.name}</span>
        ) : null}
      </label>

      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-neutral-800">Correo</span>

        <input
          autoComplete="email"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
          disabled={pending}
          maxLength={254}
          name="email"
          placeholder="usuario@empresa.com"
          required
          type="email"
        />

        {state.fieldErrors?.email ? (
          <span className="text-xs text-red-600">
            {state.fieldErrors.email}
          </span>
        ) : null}
      </label>

      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-neutral-800">Rol</span>

        <select
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
          defaultValue=""
          disabled={pending}
          name="role"
          required
        >
          <option disabled value="">
            Seleccionar rol
          </option>

          <option value="AGENT">Asesor</option>
          <option value="BACKOFFICE">Back office</option>
          <option value="SUPERVISOR">Supervisor</option>
          <option value="ADMIN">Administrador</option>
        </select>

        {state.fieldErrors?.role ? (
          <span className="text-xs text-red-600">{state.fieldErrors.role}</span>
        ) : null}
      </label>

      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-neutral-800">Contraseña inicial</span>

        <input
          autoComplete="new-password"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
          disabled={pending}
          maxLength={128}
          minLength={12}
          name="password"
          placeholder="Mínimo 12 caracteres"
          required
          type="password"
        />

        <span className="block text-xs leading-5 text-neutral-500">
          Compártela por un canal seguro. No podrá consultarse posteriormente.
        </span>

        {state.fieldErrors?.password ? (
          <span className="text-xs text-red-600">
            {state.fieldErrors.password}
          </span>
        ) : null}
      </label>

      <div className="space-y-3 pt-1">
        <p
          aria-live="polite"
          className={
            state.type === "error"
              ? "text-sm text-red-600"
              : state.type === "success"
                ? "text-sm text-emerald-700"
                : "text-sm text-neutral-500"
          }
        >
          {state.message}
        </p>

        <button
          className="w-full rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Creando usuario..." : "Crear usuario"}
        </button>
      </div>
    </form>
  );
}
