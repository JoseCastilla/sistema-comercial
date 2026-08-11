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

    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();

    const password = String(formData.get("password") ?? "");

    const result = await authClient.signIn.email({
      email,
      password,
      rememberMe: false,
    });

    if (result.error) {
      setErrorMessage("El correo o la contraseña no son correctos.");

      setIsSubmitting(false);
      return;
    }

    router.replace("/orders");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="email">
          Correo electrónico
        </label>

        <input
          autoComplete="email"
          className="h-11 w-full rounded-lg border border-ui-border-strong bg-ui-surface px-3 outline-none transition focus:border-ui-accent focus:ring-2 focus:ring-ui-border"
          id="email"
          name="email"
          placeholder="nombre@empresa.com"
          required
          type="email"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="password">
          Contraseña
        </label>

        <input
          autoComplete="current-password"
          className="h-11 w-full rounded-lg border border-ui-border-strong bg-ui-surface px-3 outline-none transition focus:border-ui-accent focus:ring-2 focus:ring-ui-border"
          id="password"
          minLength={12}
          name="password"
          required
          type="password"
        />
      </div>

      {errorMessage ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-ui-danger-border bg-ui-danger-soft px-3 py-2 text-sm text-ui-danger"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <button
        className="h-11 w-full rounded-lg bg-ui-strong px-4 font-medium text-ui-on-strong transition hover:bg-ui-strong disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
