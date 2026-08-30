import type { ReactNode } from "react";

import { SignOutButton } from "@/app/orders/sign-out-button";
import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { requireCommercialAccess } from "@/server/auth/access";

export default async function ExternalToolsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { session, membership } = await requireCommercialAccess();

  return (
    <CommercialAppShell
      activeSection="tools"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      {children}
    </CommercialAppShell>
  );
}
