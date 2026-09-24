import { cache } from "react";

import type { ReactNode } from "react";

import { SignOutButton } from "@/app/orders/sign-out-button";
import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

/**
 * ¿El usuario vende? Un asesor siempre; un supervisor, si tiene membresía de
 * venta activa en un equipo activo (supervisor vendedor, SPEC-019). Es la
 * misma membresía con la que Rendimiento le ofrece su vista propia.
 */
const userSells = cache(
  async (organizationId: string, userId: string): Promise<boolean> => {
    const membership = await database.commercialTeamMember.findFirst({
      where: {
        userId,
        salesEnabled: true,
        isActive: true,
        isPrimary: true,
        team: { organizationId, status: "ACTIVE" },
      },
      select: { teamId: true },
    });
    return membership !== null;
  },
);

/**
 * El shell vive en el layout, no en cada página: así `loading.tsx` solo
 * reemplaza el contenido y la navegación nunca desaparece durante una
 * transición. `requireCommercialAccess` está memorizada por render, de modo
 * que layout y página comparten la misma lectura de sesión y membresía.
 *
 * Todas las secciones usan este mismo layout: antes eran siete copias
 * idénticas, y el menú necesitaba saber algo más que el rol —si el usuario
 * vende— para ofrecer «Mi día» al supervisor vendedor (SPEC-063 fase 5).
 */
export async function CommercialLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { session, membership } = await requireCommercialAccess();
  const sells =
    membership.role === "AGENT" ||
    (membership.role === "SUPERVISOR" &&
      (await userSells(membership.organization.id, session.user.id)));

  return (
    <CommercialAppShell
      organizationName={membership.organization.name}
      role={membership.role}
      sells={sells}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      {children}
    </CommercialAppShell>
  );
}
