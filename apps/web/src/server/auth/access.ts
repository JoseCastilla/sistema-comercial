import "server-only";

import { cache } from "react";

import { headers } from "next/headers";

import { redirect } from "next/navigation";

import { auth } from "./auth";

import { database } from "../database";

/**
 * Memorizadas por render: con el shell montado en un layout, el layout y la
 * página resuelven la sesión en paralelo dentro de la misma petición. Sin
 * `cache()` eso serían dos lecturas de sesión y dos consultas de membresía
 * por cada navegación.
 */
export const getCurrentSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});

export const requireCommercialAccess = cache(async () => {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const membership = await database.organizationMember.findFirst({
    where: {
      userId: session.user.id,

      user: {
        status: "ACTIVE",
      },

      organization: {
        status: "ACTIVE",
      },
    },

    orderBy: {
      createdAt: "asc",
    },

    select: {
      role: true,

      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
        },
      },
    },
  });

  if (!membership) {
    redirect("/access-denied");
  }

  return {
    session,
    membership,
  };
});

export async function requireAdminAccess() {
  const access = await requireCommercialAccess();

  if (access.membership.role !== "ADMIN") {
    redirect("/access-denied");
  }

  return access;
}
