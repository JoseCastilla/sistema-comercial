"use client";

import { useActionState } from "react";

import { runSetup, type SetupState } from "./setup-action";

export function SetupForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(runSetup, { error: null });
  return (
    <form action={action} className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Empresa</legend>
        <label className="ui-field"><span className="ui-field__label">Nombre</span><input className="ui-control" name="organizationName" required /></label>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Dueño del negocio</legend>
        <label className="ui-field"><span className="ui-field__label">Nombre completo</span><input className="ui-control" name="name" required /></label>
        <label className="ui-field"><span className="ui-field__label">Correo</span><input className="ui-control" name="email" required type="email" /></label>
        <label className="ui-field"><span className="ui-field__label">Contraseña</span><input className="ui-control" minLength={12} name="password" required type="password" /><span className="ui-field__hint">Mínimo 12 caracteres.</span></label>
      </fieldset>
      {state.error ? <p className="rounded-lg border border-ui-danger-border bg-ui-danger-soft px-3 py-2 text-sm text-ui-danger" role="alert">{state.error}</p> : null}
      <button className="ui-button ui-button--primary ui-button--full" disabled={pending} type="submit">{pending ? "Creando…" : "Crear empresa y entrar"}</button>
    </form>
  );
}
