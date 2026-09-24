import type { ReactNode } from "react";

import { requireAccess } from "@/server/auth/access";

import { AppShell } from "./app-shell";
import { SignOutButton } from "./sign-out-button";

/** Layout de toda sección autenticada: resuelve el acceso y monta el cascarón. */
export async function ShellLayout({ children }: { children: ReactNode }) {
  const access = await requireAccess();
  return (
    <AppShell organizationName={access.organizationName} role={access.role} signOut={<SignOutButton />} userName={access.userName}>
      {children}
    </AppShell>
  );
}
