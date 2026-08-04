import "server-only";

import { headers } from "next/headers";

import { redirect } from "next/navigation";

import { auth } from "./auth";

import { database } from "../database";

export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireCommercialAccess() {
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
}
export async function requireAdminAccess() {
  const access = await requireCommercialAccess();

  if (access.membership.role !== "ADMIN") {
    redirect("/access-denied");
  }

  return access;
}
