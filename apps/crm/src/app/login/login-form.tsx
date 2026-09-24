"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    const formData = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      password: String(formData.get("password") ?? ""),
      rememberMe: false,
    });
    if (result.error) {
      setErrorMessage("El correo o la contraseña no son correctos.");
      setIsSubmitting(false);
      return;
    }
    router.replace("/inbox");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="email">Correo electrónico</label>
        <input autoComplete="email" className="ui-control" id="email" name="email" required type="email" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="password">Contraseña</label>
        <input autoComplete="current-password" className="ui-control" id="password" minLength={12} name="password" required type="password" />
      </div>
      {errorMessage ? <p aria-live="polite" className="rounded-lg border border-ui-danger-border bg-ui-danger-soft px-3 py-2 text-sm text-ui-danger" role="alert">{errorMessage}</p> : null}
      <button className="ui-button ui-button--primary ui-button--full" disabled={isSubmitting} type="submit">{isSubmitting ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
