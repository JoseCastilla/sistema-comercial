import { z } from "zod";

import type { DitoOrderStatus } from "./dito-order-state.js";

export const commercialTeamStatuses = ["ACTIVE", "DISABLED"] as const;

export const commercialTeamMemberRoles = ["SUPERVISOR", "AGENT"] as const;

export const ditoOrderAssignmentReasons = [
  "REGISTERED_FOR_ANOTHER_AGENT",
  "INCORRECT_ALIAS",
  "AGENT_ABSENCE",
  "WORKLOAD_BALANCING",
  "TEAM_TRANSFER",
  "DATA_CORRECTION",
  "OTHER",
] as const;

export const ditoOrderAssignmentSources = [
  "ALIAS_AUTO",
  "MANUAL",
  "BACKFILL",
  "ORPHAN_CLAIM",
  "REQUEST_APPROVAL",
  "SYSTEM",
] as const;

export const ditoOrderAssignmentRequestStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;

export const ditoOrderAssignmentRequestSources = [
  "AGENT_REQUEST",
  "BACKOFFICE_SUGGESTION",
  "SUPERVISOR_REVIEW",
  "SYSTEM_REVIEW",
] as const;

export const commercialTeamStatusSchema = z.enum(commercialTeamStatuses);

export const commercialTeamMemberRoleSchema = z.enum(commercialTeamMemberRoles);

export const ditoOrderAssignmentReasonSchema = z.enum(
  ditoOrderAssignmentReasons,
);

export const ditoOrderAssignmentSourceSchema = z.enum(
  ditoOrderAssignmentSources,
);

export const ditoOrderAssignmentRequestStatusSchema = z.enum(
  ditoOrderAssignmentRequestStatuses,
);

export const ditoOrderAssignmentRequestSourceSchema = z.enum(
  ditoOrderAssignmentRequestSources,
);

export type CommercialTeamStatus = z.infer<typeof commercialTeamStatusSchema>;

export type CommercialTeamMemberRole = z.infer<
  typeof commercialTeamMemberRoleSchema
>;

export type DitoOrderAssignmentReason = z.infer<
  typeof ditoOrderAssignmentReasonSchema
>;

export type DitoOrderAssignmentSource = z.infer<
  typeof ditoOrderAssignmentSourceSchema
>;

export type DitoOrderAssignmentRequestStatus = z.infer<
  typeof ditoOrderAssignmentRequestStatusSchema
>;

export type DitoOrderAssignmentRequestSource = z.infer<
  typeof ditoOrderAssignmentRequestSourceSchema
>;

export type CommercialAccessRole =
  "ADMIN" | "SUPERVISOR" | "BACKOFFICE" | "AGENT";

export type DitoOrderVisibility = "FULL" | "LIMITED_ORPHAN" | "NONE";

export type DitoOrderScope =
  | { kind: "ORGANIZATION" }
  | { kind: "AGENT"; userId: string }
  | { kind: "SUPERVISED_TEAMS_WITH_ORPHANS"; teamIds: readonly string[] }
  | {
      kind: "SUPERVISED_TEAMS_WITH_OWN_AND_ORPHANS";
      teamIds: readonly string[];
      userId: string;
    }
  | { kind: "NONE" };

export type CommercialContextAccess = "NORMAL" | "DERIVED_READ_ONLY" | "NONE";

type UserStatus = "INVITED" | "ACTIVE" | "DISABLED";

export function canAdministerCommercialTeam(input: {
  actorRole: CommercialAccessRole;
  actorOrganizationId: string;
  teamOrganizationId: string;
  teamStatus: CommercialTeamStatus;
}): boolean {
  return (
    input.actorRole === "ADMIN" &&
    input.actorOrganizationId === input.teamOrganizationId &&
    input.teamStatus === "ACTIVE"
  );
}

export function canAssignCommercialTeamMember(input: {
  actorRole: CommercialAccessRole;
  actorOrganizationId: string;
  teamOrganizationId: string;
  memberOrganizationId: string;
  teamStatus: CommercialTeamStatus;
  memberUserStatus: UserStatus;
  memberOrganizationRole: CommercialAccessRole;
  targetMemberRole: CommercialTeamMemberRole;
  salesEnabled?: boolean;
}): boolean {
  const compatibleRole =
    input.targetMemberRole === "AGENT"
      ? input.memberOrganizationRole === "AGENT"
      : input.memberOrganizationRole === "SUPERVISOR" ||
        (input.salesEnabled === true &&
          input.memberOrganizationRole === "AGENT");

  return (
    canAdministerCommercialTeam({
      actorRole: input.actorRole,
      actorOrganizationId: input.actorOrganizationId,
      teamOrganizationId: input.teamOrganizationId,
      teamStatus: input.teamStatus,
    }) &&
    input.memberOrganizationId === input.actorOrganizationId &&
    input.memberUserStatus === "ACTIVE" &&
    compatibleRole
  );
}

function includesTeam(
  teamIds: readonly string[],
  teamId: string | null,
): boolean {
  return teamId !== null && teamIds.includes(teamId);
}

export function isOrphanDitoOrder(
  agentUserId: string | null,
  assignedTeamId: string | null,
): boolean {
  return agentUserId === null && assignedTeamId === null;
}

export function resolveDitoOrderScope(input: {
  role: CommercialAccessRole;
  userId: string;
  supervisedTeamIds: readonly string[];
  salesEnabled?: boolean;
}): DitoOrderScope {
  if (input.role === "ADMIN" || input.role === "BACKOFFICE") {
    return { kind: "ORGANIZATION" };
  }

  if (input.role === "AGENT") {
    return { kind: "AGENT", userId: input.userId };
  }

  if (input.role === "SUPERVISOR" && input.salesEnabled) {
    return {
      kind: "SUPERVISED_TEAMS_WITH_OWN_AND_ORPHANS",
      teamIds: input.supervisedTeamIds,
      userId: input.userId,
    };
  }

  if (input.supervisedTeamIds.length === 0) {
    return { kind: "NONE" };
  }

  return {
    kind: "SUPERVISED_TEAMS_WITH_ORPHANS",
    teamIds: input.supervisedTeamIds,
  };
}

export function resolveDitoOrderVisibility(input: {
  role: CommercialAccessRole;
  userId: string;
  supervisedTeamIds: readonly string[];
  orderAgentUserId: string | null;
  orderAssignedTeamId: string | null;
  salesEnabled?: boolean;
}): DitoOrderVisibility {
  if (input.role === "ADMIN" || input.role === "BACKOFFICE") {
    return "FULL";
  }

  if (input.role === "SUPERVISOR") {
    if (input.salesEnabled && input.orderAgentUserId === input.userId) {
      return "FULL";
    }

    if (includesTeam(input.supervisedTeamIds, input.orderAssignedTeamId)) {
      return "FULL";
    }

    if (
      input.supervisedTeamIds.length > 0 &&
      isOrphanDitoOrder(input.orderAgentUserId, input.orderAssignedTeamId)
    ) {
      return "LIMITED_ORPHAN";
    }

    return "NONE";
  }

  return input.orderAgentUserId === input.userId ? "FULL" : "NONE";
}

export function canCloseDitoOrder(input: {
  role: CommercialAccessRole;
  visibility: DitoOrderVisibility;
  isOwnOrder?: boolean;
}): boolean {
  return (
    input.visibility === "FULL" &&
    !input.isOwnOrder &&
    (input.role === "ADMIN" ||
      input.role === "BACKOFFICE" ||
      input.role === "SUPERVISOR")
  );
}

export function canCancelDitoOrder(input: {
  role: CommercialAccessRole;
  visibility: DitoOrderVisibility;
  isOwnOrder?: boolean;
}): boolean {
  return (
    input.visibility === "FULL" &&
    !input.isOwnOrder &&
    (input.role === "ADMIN" ||
      input.role === "BACKOFFICE" ||
      input.role === "SUPERVISOR")
  );
}

export function canRequestDitoOrderCancellation(input: {
  role: CommercialAccessRole;
  visibility: DitoOrderVisibility;
  currentStatus: DitoOrderStatus;
  hasPendingRequest: boolean;
  isSalesOwner?: boolean;
}): boolean {
  return (
    (input.role === "AGENT" || input.isSalesOwner === true) &&
    input.visibility === "FULL" &&
    input.currentStatus !== "CLOSED" &&
    input.currentStatus !== "CANCELLED" &&
    !input.hasPendingRequest
  );
}

export function canCreateDitoOrderEscalation(input: {
  role: CommercialAccessRole;
  visibility: DitoOrderVisibility;
  isSalesOwner: boolean;
  assignedTeamId: string | null;
  hasActiveEscalation: boolean;
}): boolean {
  return (
    (input.role === "AGENT" || input.role === "SUPERVISOR") &&
    input.visibility === "FULL" &&
    input.isSalesOwner &&
    input.assignedTeamId !== null &&
    !input.hasActiveEscalation
  );
}

export function canReviewDitoOrderEscalation(input: {
  role: CommercialAccessRole;
  visibility: DitoOrderVisibility;
  isRequester: boolean;
}): boolean {
  return (
    (input.role === "ADMIN" || input.role === "SUPERVISOR") &&
    input.visibility === "FULL" &&
    !input.isRequester
  );
}

export function canTransitionDitoOrderStatus(input: {
  role: CommercialAccessRole;
  visibility: DitoOrderVisibility;
  currentStatus: DitoOrderStatus;
  targetStatus: DitoOrderStatus;
  isOwnOrder?: boolean;
}): boolean {
  if (input.visibility !== "FULL") {
    return false;
  }

  if (input.currentStatus === "CLOSED" || input.currentStatus === "CANCELLED") {
    return false;
  }

  if (input.targetStatus === "CLOSED") {
    return canCloseDitoOrder(input);
  }

  if (input.targetStatus === "CANCELLED") {
    return canCancelDitoOrder(input);
  }

  return input.targetStatus !== "UNKNOWN";
}

export function canClaimOrphanDitoOrder(input: {
  role: CommercialAccessRole;
  supervisedTeamIds: readonly string[];
  orderAgentUserId: string | null;
  orderAssignedTeamId: string | null;
  targetTeamId: string;
  targetTeamStatus: CommercialTeamStatus;
}): boolean {
  if (!isOrphanDitoOrder(input.orderAgentUserId, input.orderAssignedTeamId)) {
    return false;
  }

  if (input.targetTeamStatus !== "ACTIVE") {
    return false;
  }

  if (input.role === "ADMIN") {
    return true;
  }

  return (
    input.role === "SUPERVISOR" &&
    input.supervisedTeamIds.includes(input.targetTeamId)
  );
}

export function resolveCommercialContextAccess(input: {
  role: CommercialAccessRole;
  userId: string;
  supervisedTeamIds: readonly string[];
  orderAgentUserId: string | null;
  orderAssignedTeamId: string | null;
  hasNormalAccess: boolean;
}): CommercialContextAccess {
  if (
    input.hasNormalAccess ||
    input.role === "ADMIN" ||
    input.role === "BACKOFFICE"
  ) {
    return "NORMAL";
  }

  if (input.role === "AGENT" && input.orderAgentUserId === input.userId) {
    return "DERIVED_READ_ONLY";
  }

  if (
    input.role === "SUPERVISOR" &&
    includesTeam(input.supervisedTeamIds, input.orderAssignedTeamId)
  ) {
    return "DERIVED_READ_ONLY";
  }

  return "NONE";
}

export function canReassignDitoOrder(input: {
  role: CommercialAccessRole;
  supervisedTeamIds: readonly string[];
  currentTeamId: string | null;
  targetTeamId: string | null;
  targetTeamStatus: CommercialTeamStatus;
}): boolean {
  if (input.targetTeamId === null || input.targetTeamStatus !== "ACTIVE") {
    return false;
  }

  if (input.role === "ADMIN") {
    return true;
  }

  if (input.role !== "SUPERVISOR" || input.currentTeamId === null) {
    return false;
  }

  return (
    input.supervisedTeamIds.includes(input.currentTeamId) &&
    input.supervisedTeamIds.includes(input.targetTeamId)
  );
}

export function canResolveAutomaticDitoAssignment(input: {
  aliasMatchCount: number;
  userStatus: UserStatus;
  organizationRole: CommercialAccessRole;
  primaryMembershipActive: boolean;
  primarySalesEnabled: boolean;
  primaryTeamId: string | null;
  primaryTeamStatus: CommercialTeamStatus | null;
}): boolean {
  return (
    input.aliasMatchCount === 1 &&
    input.userStatus === "ACTIVE" &&
    (input.organizationRole === "AGENT" ||
      input.organizationRole === "SUPERVISOR") &&
    input.primaryMembershipActive &&
    input.primarySalesEnabled &&
    input.primaryTeamId !== null &&
    input.primaryTeamStatus === "ACTIVE"
  );
}

export function canActivateAgentAlias(input: {
  userStatus: UserStatus;
  organizationRole: CommercialAccessRole;
  primaryMembershipActive: boolean;
  primarySalesEnabled: boolean;
  primaryTeamStatus: CommercialTeamStatus | null;
}): boolean {
  return (
    input.userStatus === "ACTIVE" &&
    (input.organizationRole === "AGENT" ||
      input.organizationRole === "SUPERVISOR") &&
    input.primaryMembershipActive &&
    input.primarySalesEnabled &&
    input.primaryTeamStatus === "ACTIVE"
  );
}
