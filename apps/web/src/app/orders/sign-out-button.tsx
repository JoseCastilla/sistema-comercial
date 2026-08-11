"use client";

import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

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
      className="rounded-lg border border-ui-border-strong bg-ui-surface px-4 py-2 text-sm font-medium transition hover:bg-ui-subtle"
      onClick={handleSignOut}
      type="button"
    >
      Cerrar sesión
    </button>
  );
}
