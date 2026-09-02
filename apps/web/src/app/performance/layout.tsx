import type { ReactNode } from "react";

import { SignOutButton } from "@/app/orders/sign-out-button";
import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { requireCommercialAccess } from "@/server/auth/access";

/**
 * El shell vive en el layout, no en cada página: así `loading.tsx` solo
 * reemplaza el contenido y la navegación nunca desaparece durante una
 * transición. `requireCommercialAccess` está memorizada por render, de modo
 * que layout y página comparten la misma lectura de sesión y membresía.
 */
export default async function PerformanceLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { session, membership } = await requireCommercialAccess();

  return (
    <CommercialAppShell
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      {children}
    </CommercialAppShell>
  );
}
