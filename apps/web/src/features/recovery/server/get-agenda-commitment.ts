import "server-only";

import {
  describeRecoveryCommitmentState,
  recoveryCommitmentStateLabels,
} from "@repo/validation";

import { database } from "@/server/database";
import { formatLimaDateTime } from "@repo/ui/format";

import { attemptResultLabels } from "../attempt-result-labels";

const caseStatusLabels: Record<string, string> = {
  ASSIGNED: "Asignado",
  IN_PROGRESS: "En gestión",
  SCHEDULED: "Agendado",
  WAITING: "En verificación",
  RECOVERED: "Recuperado",
  LOST: "Perdido",
  DISCARDED: "Descartado",
};

export interface AgendaCommitmentDetail {
  id: string;
  caseId: string;
  holderName: string;
  phone: string | null;
  caseStatusLabel: string;
  scheduledAtLabel: string;
  state: string;
  stateLabel: string;
  isPending: boolean;
  reason: string | null;
  /** La cita que la sustituyó, si se reprogramó. */
  supersededById: string | null;
  attempts: Array<{
    id: string;
    resultLabel: string;
    observation: string | null;
    actorName: string;
    createdAtLabel: string;
  }>;
  history: Array<{
    id: string;
    scheduledAtLabel: string;
    stateLabel: string;
    reason: string | null;
    createdAtLabel: string;
    createdByName: string;
    closedAtLabel: string | null;
  }>;
}

/**
 * Panel de una cita en Mi agenda — SPEC-048 CAM-F09. Solo las citas de los
 * casos del propio asesor (BR-029b): la agenda es suya. El contexto que
 * necesita para decidir es el caso, sus últimos intentos y la historia de
 * la cita (cadena de reprogramaciones).
 */
export async function getAgendaCommitment(
  organizationId: string,
  userId: string,
  commitmentId: string,
  now = new Date(),
): Promise<AgendaCommitmentDetail | null> {
  const commitment = await database.recoveryCaseCommitment.findFirst({
    where: {
      id: commitmentId,
      organizationId,
      case: { source: "NATIONAL_BASE", assignedUserId: userId },
    },
    select: {
      id: true,
      caseId: true,
      scheduledAt: true,
      status: true,
      reason: true,
      supersededById: true,
      case: {
        select: {
          holderName: true,
          status: true,
          phones: {
            where: { kind: "CONTACT", invalidMarkedAt: null },
            take: 1,
            select: { phoneNumber: true },
          },
          services: {
            where: { discardedAt: null },
            take: 1,
            select: { serviceNumber: true },
          },
          attempts: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true,
              result: true,
              observation: true,
              createdAt: true,
              actor: { select: { name: true } },
            },
          },
          commitments: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              scheduledAt: true,
              status: true,
              reason: true,
              createdAt: true,
              closedAt: true,
              createdBy: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!commitment) return null;

  const state = describeRecoveryCommitmentState(
    String(commitment.status),
    commitment.scheduledAt,
    now,
  );

  return {
    id: commitment.id,
    caseId: commitment.caseId,
    holderName: commitment.case.holderName,
    phone:
      commitment.case.phones[0]?.phoneNumber ??
      commitment.case.services[0]?.serviceNumber ??
      null,
    caseStatusLabel:
      caseStatusLabels[String(commitment.case.status)] ??
      String(commitment.case.status),
    scheduledAtLabel: formatLimaDateTime(commitment.scheduledAt),
    state,
    stateLabel: recoveryCommitmentStateLabels[state],
    isPending: String(commitment.status) === "PENDING",
    reason: commitment.reason,
    supersededById: commitment.supersededById,
    attempts: commitment.case.attempts.map((attempt) => ({
      id: attempt.id,
      resultLabel:
        attemptResultLabels[String(attempt.result)] ?? String(attempt.result),
      observation: attempt.observation,
      actorName: attempt.actor.name,
      createdAtLabel: formatLimaDateTime(attempt.createdAt),
    })),
    history: commitment.case.commitments.map((item) => ({
      id: item.id,
      scheduledAtLabel: formatLimaDateTime(item.scheduledAt),
      stateLabel:
        recoveryCommitmentStateLabels[
          describeRecoveryCommitmentState(
            String(item.status),
            item.scheduledAt,
            now,
          )
        ],
      reason: item.reason,
      createdAtLabel: formatLimaDateTime(item.createdAt),
      createdByName: item.createdBy.name,
      closedAtLabel: item.closedAt ? formatLimaDateTime(item.closedAt) : null,
    })),
  };
}
