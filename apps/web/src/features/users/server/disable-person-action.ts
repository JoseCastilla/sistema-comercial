"use server";

import { revalidatePath } from "next/cache";

import {
  canDisablePerson,
  parsePersonDisableReason,
  personDisableReasonOptions,
  planPortfolioRelease,
} from "@repo/validation";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { PersonLifecycleActionState } from "./person-lifecycle.types";

function readText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

const openCaseStatuses = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "SCHEDULED",
  "WAITING",
] as const;
const openOrderStatuses = ["OPEN", "SENT", "UNKNOWN"] as const;
const firstContactMs = 2 * 60 * 60 * 1000;

/**
 * Baja de un asesor o supervisor — SPEC-042 BR-001 a BR-007.
 *
 * Apaga, no borra: la cuenta pasa a deshabilitada, sus membresías se cierran
 * con fecha, sus sesiones mueren y su cartera de recupero se libera o se
 * entrega, todo en una transacción y con un evento que dice quién, cuándo y
 * por qué. Sus ventas siguen a su nombre (BR-004): son su venta.
 */
export async function disablePersonAction(
  previousState: PersonLifecycleActionState,
  formData: FormData,
): Promise<PersonLifecycleActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();
  const userId = readText(formData.get("userId"));
  const reason = parsePersonDisableReason(readText(formData.get("reason")));
  const reasonDetail = readText(formData.get("reasonDetail")).slice(0, 160);
  const destinationUserId = readText(formData.get("destinationUserId")) || null;

  if (!userId) {
    return { type: "error", message: "La persona seleccionada no es válida." };
  }
  if (!reason) {
    return {
      type: "error",
      message: "Indica el motivo de la baja.",
      fieldErrors: { reason: "Elige un motivo" },
    };
  }
  if (reason === "OTRO" && reasonDetail.length < 4) {
    return {
      type: "error",
      message: "Describe el motivo de la baja.",
      fieldErrors: { reasonDetail: "Escribe al menos cuatro caracteres" },
    };
  }

  const target = await database.organizationMember.findFirst({
    where: { organizationId: membership.organization.id, userId },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true, status: true } },
    },
  });

  if (!target) {
    return {
      type: "error",
      message: "La persona no existe o pertenece a otra organización.",
    };
  }

  const decision = canDisablePerson({
    actorRole: membership.role,
    actorUserId: session.user.id,
    targetUserId: target.user.id,
    targetRole: target.role,
    targetStatus: target.user.status,
  });

  if (!decision.allowed) {
    return { type: "error", message: decision.reason ?? "No permitido." };
  }

  const reasonLabel =
    personDisableReasonOptions.find((option) => option.value === reason)
      ?.label ?? reason;
  const reasonText = reasonDetail
    ? `${reasonLabel}: ${reasonDetail}`
    : reasonLabel;

  try {
    const outcome = await database.$transaction(async (transaction) => {
      const now = new Date();

      // Destino, si lo hay: un asesor activo con venta en la organización.
      const destination = destinationUserId
        ? await transaction.commercialTeamMember.findFirst({
            where: {
              userId: destinationUserId,
              salesEnabled: true,
              isActive: true,
              isPrimary: true,
              team: {
                organizationId: membership.organization.id,
                status: "ACTIVE",
              },
              user: { status: "ACTIVE" },
              NOT: { userId: target.user.id },
            },
            select: {
              teamId: true,
              userId: true,
              user: { select: { name: true } },
            },
          })
        : null;

      if (destinationUserId && !destination) {
        throw new Error("DESTINO_INVALIDO");
      }

      const memberships = await transaction.commercialTeamMember.findMany({
        where: {
          userId: target.user.id,
          isActive: true,
          team: { organizationId: membership.organization.id },
        },
        select: {
          teamId: true,
          memberRole: true,
          salesEnabled: true,
          isPrimary: true,
          team: { select: { name: true } },
        },
      });

      const cases = await transaction.recoveryCase.findMany({
        where: {
          organizationId: membership.organization.id,
          assignedUserId: target.user.id,
          status: { in: [...openCaseStatuses] },
        },
        select: {
          id: true,
          source: true,
          status: true,
          priority: true,
          originalAgentUserId: true,
          assignedTeamId: true,
        },
      });

      const plan = planPortfolioRelease(
        cases.map((item) => ({
          id: item.id,
          source: String(item.source),
          priority: item.priority ? String(item.priority) : null,
          originalAgentUserId: item.originalAgentUserId,
        })),
        destination?.userId ?? null,
      );
      const byId = new Map(cases.map((item) => [item.id, item]));
      const releaseObservation = `Liberado por la baja de ${target.user.name} (${reasonLabel}).`;

      // Campañas: al pool de su equipo, como BR-077.
      if (plan.toPool.length > 0) {
        await transaction.recoveryCase.updateMany({
          where: { id: { in: plan.toPool } },
          data: {
            status: "OPEN",
            assignedUserId: null,
            claimedAt: null,
            nextActionAt: null,
          },
        });
      }

      // Carril interno sin destino: sin responsable en su equipo; una agenda
      // pactada con el cliente se conserva como próxima acción.
      if (plan.toUnassigned.length > 0) {
        await transaction.recoveryCase.updateMany({
          where: { id: { in: plan.toUnassigned } },
          data: { status: "OPEN", assignedUserId: null, claimedAt: null },
        });
      }

      if (plan.toPool.length + plan.toUnassigned.length > 0) {
        await transaction.recoveryCaseEvent.createMany({
          data: [...plan.toPool, ...plan.toUnassigned].map((caseId) => {
            const item = byId.get(caseId)!;
            return {
              organizationId: membership.organization.id,
              caseId,
              type: "ASSIGNED_TO_TEAM" as const,
              actorUserId: session.user.id,
              previousStatus: item.status,
              newStatus: "OPEN" as const,
              observation: releaseObservation,
              metadata: {
                mode: "BAJA",
                teamId: item.assignedTeamId,
                previousAssignedUserId: target.user.id,
              },
            };
          }),
        });
      }

      // Carril interno con destino: misma regla que reasignar (BR-065 ya
      // aplicada en el plan); el nuevo responsable recibe su reloj de dos
      // horas salvo que haya una agenda pactada.
      if (destination && plan.toDestination.length > 0) {
        const scheduled = plan.toDestination.filter(
          (caseId) => byId.get(caseId)!.status === "SCHEDULED",
        );
        const others = plan.toDestination.filter(
          (caseId) => byId.get(caseId)!.status !== "SCHEDULED",
        );

        if (scheduled.length > 0) {
          await transaction.recoveryCase.updateMany({
            where: { id: { in: scheduled } },
            data: {
              assignedUserId: destination.userId,
              assignedTeamId: destination.teamId,
              claimedAt: now,
            },
          });
        }
        if (others.length > 0) {
          await transaction.recoveryCase.updateMany({
            where: { id: { in: others } },
            data: {
              assignedUserId: destination.userId,
              assignedTeamId: destination.teamId,
              claimedAt: now,
              status: "ASSIGNED",
              nextActionAt: new Date(now.getTime() + firstContactMs),
            },
          });
        }

        await transaction.recoveryCaseEvent.createMany({
          data: plan.toDestination.map((caseId) => {
            const item = byId.get(caseId)!;
            return {
              organizationId: membership.organization.id,
              caseId,
              type: "ASSIGNED_TO_USER" as const,
              actorUserId: session.user.id,
              previousStatus: item.status,
              newStatus:
                item.status === "SCHEDULED"
                  ? ("SCHEDULED" as const)
                  : ("ASSIGNED" as const),
              observation: `Entregado por la baja de ${target.user.name} (${reasonLabel}).`,
              metadata: {
                mode: "BAJA",
                targetUserId: destination.userId,
                targetTeamId: destination.teamId,
                previousAssignedUserId: target.user.id,
              },
            };
          }),
        });
      }

      await transaction.commercialTeamMember.updateMany({
        where: {
          userId: target.user.id,
          isActive: true,
          team: { organizationId: membership.organization.id },
        },
        data: { isActive: false, isPrimary: false, validUntil: now },
      });

      await transaction.user.update({
        where: { id: target.user.id },
        data: { status: "DISABLED" },
      });

      const revoked = await transaction.session.deleteMany({
        where: { userId: target.user.id },
      });

      const openOrders = await transaction.ditoOrder.count({
        where: {
          organizationId: membership.organization.id,
          agentUserId: target.user.id,
          status: { in: [...openOrderStatuses] },
        },
      });

      const releasedSummary = {
        openOrders,
        internalReleased: plan.toUnassigned.length,
        internalDelivered: plan.toDestination.length,
        campaignsToPool: plan.toPool.length,
        blockedByCritical: plan.blockedByCritical,
        destinationUserId: destination?.userId ?? null,
        destinationName: destination?.user.name ?? null,
      };

      await transaction.personLifecycleEvent.create({
        data: {
          organizationId: membership.organization.id,
          userId: target.user.id,
          action: "DISABLED",
          actorUserId: session.user.id,
          reason: reasonText.slice(0, 200),
          previousValues: {
            status: target.user.status,
            role: target.role,
            memberships: memberships.map((item) => ({
              teamId: item.teamId,
              teamName: item.team.name,
              memberRole: item.memberRole,
              salesEnabled: item.salesEnabled,
              isPrimary: item.isPrimary,
            })),
          },
          newValues: { status: "DISABLED", role: target.role },
          releasedSummary,
        },
      });

      return { ...releasedSummary, revokedSessions: revoked.count };
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/teams");
    revalidatePath("/recovery/sales");
    revalidatePath("/recovery/campaigns");

    const parts = [
      `${target.user.name} quedó de baja.`,
      outcome.openOrders > 0
        ? `${outcome.openOrders} venta(s) abiertas siguen a su nombre.`
        : null,
      outcome.internalDelivered > 0
        ? `${outcome.internalDelivered} caso(s) entregados a ${outcome.destinationName}.`
        : null,
      outcome.internalReleased > 0
        ? `${outcome.internalReleased} caso(s) quedaron sin responsable en su equipo${outcome.blockedByCritical > 0 ? ` (${outcome.blockedByCritical} crítico(s) no podían ir al destino elegido)` : ""}.`
        : null,
      outcome.campaignsToPool > 0
        ? `${outcome.campaignsToPool} caso(s) de Campañas volvieron al pool.`
        : null,
      outcome.revokedSessions > 0
        ? `Sesiones cerradas: ${outcome.revokedSessions}.`
        : null,
    ].filter(Boolean);

    return { type: "success", message: parts.join(" ") };
  } catch (error) {
    if (error instanceof Error && error.message === "DESTINO_INVALIDO") {
      return {
        type: "error",
        message:
          "El asesor destino no está activo con venta habilitada. Elige otro o deja la cartera sin responsable.",
        fieldErrors: { destinationUserId: "Destino no válido" },
      };
    }

    console.error("No se pudo dar de baja a la persona", {
      error,
      targetUserId: userId,
      organizationId: membership.organization.id,
      performedByUserId: session.user.id,
    });

    return {
      type: "error",
      message: "No se pudo completar la baja. Nada cambió; inténtalo de nuevo.",
    };
  }
}
