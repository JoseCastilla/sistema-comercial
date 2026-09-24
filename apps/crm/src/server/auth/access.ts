import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { OrganizationRole } from "@/generated/prisma/enums";

import { auth } from "./auth";
import { database } from "../database";

export interface Access {
  userId: string;
  userName: string;
  email: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  timezone: string;
  role: OrganizationRole;
  memberId: string;
}

export const getCurrentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Carga la membresía activa del usuario. Sin sesión → login; sin membresía → acceso denegado. */
export const requireAccess = cache(async (): Promise<Access> => {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  const membership = await database.organizationMember.findFirst({
    where: { userId: session.user.id, user: { status: "ACTIVE" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      organization: { select: { id: true, name: true, slug: true, timezone: true } },
    },
  });
  if (!membership) {
    redirect("/access-denied");
  }
  return {
    userId: session.user.id,
    userName: session.user.name,
    email: session.user.email,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    timezone: membership.organization.timezone,
    role: membership.role,
    memberId: membership.id,
  };
});

export const MANAGER_ROLES: OrganizationRole[] = ["OWNER", "SUPERVISOR"];

export function canManage(role: OrganizationRole): boolean {
  return MANAGER_ROLES.includes(role);
}

export function canRespond(role: OrganizationRole): boolean {
  // El back office lee pero no responde (SPEC-054 BR-001).
  return role !== "BACKOFFICE";
}

export async function requireRole(...roles: OrganizationRole[]): Promise<Access> {
  const access = await requireAccess();
  if (!roles.includes(access.role)) {
    redirect("/access-denied");
  }
  return access;
}

export const requireOwner = () => requireRole("OWNER");
export const requireManager = () => requireRole("OWNER", "SUPERVISOR");

/** Para acciones de servidor: mismo chequeo, pero lanza en vez de redirigir. */
export async function assertRole(access: Access, ...roles: OrganizationRole[]) {
  if (!roles.includes(access.role)) {
    throw new Error("No tienes permiso para esta acción");
  }
}
