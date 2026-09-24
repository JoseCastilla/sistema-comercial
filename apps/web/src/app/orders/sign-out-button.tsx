"use client";

import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

/**
 * Con el menú contraído solo queda el icono: en las PCs compartidas del call
 * center cerrar sesión no puede exigir antes expandir el menú.
 */
export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess() {
          router.replace("/login");
          router.refresh();
        },
      },
    });
  }

  return (
    <button
      aria-label="Cerrar sesión"
      className="app-sign-out inline-flex items-center justify-center gap-2 rounded-lg border border-ui-border-strong bg-ui-surface px-4 py-2 text-sm font-medium transition hover:bg-ui-subtle"
      onClick={handleSignOut}
      title="Cerrar sesión"
      type="button"
    >
      <svg
        aria-hidden="true"
        className="app-sign-out__icon"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        viewBox="0 0 20 20"
      >
        <path d="M8 3.5H5A1.5 1.5 0 0 0 3.5 5v10A1.5 1.5 0 0 0 5 16.5h3" />
        <path d="M13 13.5 16.5 10 13 6.5" />
        <path d="M16.5 10H8" />
      </svg>
      <span className="app-sign-out__label">Cerrar sesión</span>
    </button>
  );
}
