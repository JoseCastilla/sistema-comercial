"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/server/audit";
import { requireManager, requireOwner } from "@/server/auth/access";
import { database } from "@/server/database";
import { checkbox, decimal, failure, integer, list, optionalText, text, type ActionState } from "@/server/forms";
import { createUserWithMembership } from "@/server/users/create-user";

import type { OrganizationRole } from "@/generated/prisma/enums";

export async function saveOrganization(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const days = list(formData, "days").map(Number).filter((d) => d >= 0 && d <= 6);
    await database.organization.update({
      where: { id: access.organizationId },
      data: {
        name: text(formData, "name") || undefined,
        timezone: text(formData, "timezone") || undefined,
        businessHours: { days, start: text(formData, "start") || "09:00", end: text(formData, "end") || "19:00" },
        unattendedAfterMinutes: integer(formData, "unattendedAfterMinutes", 15),
        returnToQueueAfterMinutes: integer(formData, "returnToQueueAfterMinutes", 30),
        handBackToAgentOnClose: checkbox(formData, "handBackToAgentOnClose"),
      },
    });
    await audit({ organizationId: access.organizationId, actorUserId: access.userId, action: "organization.updated", targetKind: "organization", targetId: access.organizationId });
    revalidatePath("/settings");
    return { ok: true, message: "Guardado." };
  } catch (error) {
    return failure(error);
  }
}

const ROLES: OrganizationRole[] = ["OWNER", "SUPERVISOR", "AGENT", "BACKOFFICE"];

export async function createUser(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireOwner();
    const role = text(formData, "role") as OrganizationRole;
    if (!ROLES.includes(role)) throw new Error("Rol inválido");
    await createUserWithMembership({
      organizationId: access.organizationId,
      name: text(formData, "name"),
      email: text(formData, "email"),
      password: text(formData, "password"),
      role,
      actorUserId: access.userId,
    });
    revalidatePath("/settings/users");
    return { ok: true, message: "Cuenta creada. Comparte la contraseña inicial con la persona." };
  } catch (error) {
    return failure(error);
  }
}

export async function updateMember(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireOwner();
    const memberId = text(formData, "memberId");
    const role = text(formData, "role") as OrganizationRole;
    const status = text(formData, "status") === "DISABLED" ? "DISABLED" : "ACTIVE";
    if (!ROLES.includes(role)) throw new Error("Rol inválido");
    const member = await database.organizationMember.findFirstOrThrow({ where: { id: memberId, organizationId: access.organizationId } });
    if (member.userId === access.userId && (role !== "OWNER" || status === "DISABLED")) {
      throw new Error("No puedes quitarte a ti mismo el rol de dueño ni desactivarte.");
    }
    await database.organizationMember.update({ where: { id: memberId }, data: { role } });
    await database.user.update({ where: { id: member.userId }, data: { status } });
    if (status === "DISABLED") await database.session.deleteMany({ where: { userId: member.userId } });
    await audit({ organizationId: access.organizationId, actorUserId: access.userId, action: "member.updated", targetKind: "user", targetId: member.userId, detail: { role, status } });
    revalidatePath("/settings/users");
    return { ok: true, message: "Actualizado." };
  } catch (error) {
    return failure(error);
  }
}

export async function toggleAvailability(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const memberId = text(formData, "memberId");
    const available = checkbox(formData, "available");
    await database.organizationMember.updateMany({ where: { id: memberId, organizationId: access.organizationId }, data: { available, lastSeenAt: new Date() } });
    revalidatePath("/settings/users");
    return { ok: true, message: available ? "Disponible para recibir conversaciones." : "No recibirá conversaciones nuevas." };
  } catch (error) {
    return failure(error);
  }
}

export async function savePlan(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const id = optionalText(formData, "id");
    const fixedCharge = decimal(formData, "fixedCharge");
    if (fixedCharge === null) throw new Error("El cargo fijo es obligatorio");
    const validUntil = optionalText(formData, "validUntil");
    const data = {
      name: text(formData, "name"),
      kind: text(formData, "kind") || "PORTABILIDAD",
      fixedCharge,
      requirements: optionalText(formData, "requirements"),
      promotion: optionalText(formData, "promotion"),
      validUntil: validUntil ? new Date(`${validUntil}T23:59:59-05:00`) : null,
    };
    if (!data.name) throw new Error("El plan necesita nombre");
    if (id) {
      await database.planCatalogItem.updateMany({ where: { id, organizationId: access.organizationId }, data });
    } else {
      await database.planCatalogItem.create({ data: { ...data, organizationId: access.organizationId } });
    }
    revalidatePath("/settings/catalog");
    return { ok: true, message: "Plan guardado." };
  } catch (error) {
    return failure(error);
  }
}

export async function retirePlan(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    await database.planCatalogItem.updateMany({ where: { id: text(formData, "id"), organizationId: access.organizationId }, data: { validUntil: new Date() } });
    revalidatePath("/settings/catalog");
    return { ok: true, message: "Plan retirado: deja de ofrecerse desde ahora." };
  } catch (error) {
    return failure(error);
  }
}

export async function saveBookingRule(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const weekdays = list(formData, "weekday").map(Number);
    if (!weekdays.length) throw new Error("Elige al menos un día");
    const startTime = text(formData, "startTime");
    const endTime = text(formData, "endTime");
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) throw new Error("Horario inválido");
    await database.bookingRule.createMany({
      data: weekdays.map((weekday) => ({
        organizationId: access.organizationId,
        weekday,
        startTime,
        endTime,
        slotMinutes: integer(formData, "slotMinutes", 30),
        capacity: integer(formData, "capacity", 3),
      })),
    });
    revalidatePath("/settings/booking");
    return { ok: true, message: "Franja creada." };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteBookingRule(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    await database.bookingRule.deleteMany({ where: { id: text(formData, "id"), organizationId: access.organizationId } });
    revalidatePath("/settings/booking");
    return { ok: true, message: "Franja eliminada." };
  } catch (error) {
    return failure(error);
  }
}

export async function saveQuickReply(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const shortcut = text(formData, "shortcut").replace(/^\//, "").toLowerCase();
    const body = text(formData, "body");
    if (!shortcut || !body) throw new Error("Atajo y texto son obligatorios");
    await database.quickReply.upsert({
      where: { organizationId_shortcut: { organizationId: access.organizationId, shortcut } },
      create: { organizationId: access.organizationId, shortcut, body },
      update: { body },
    });
    revalidatePath("/settings/quick-replies");
    return { ok: true, message: "Respuesta rápida guardada." };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteQuickReply(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    await database.quickReply.deleteMany({ where: { id: text(formData, "id"), organizationId: access.organizationId } });
    revalidatePath("/settings/quick-replies");
    return { ok: true, message: "Eliminada." };
  } catch (error) {
    return failure(error);
  }
}
