import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAdministerCommercialTeam,
  canAssignCommercialTeamMember,
  canActivateAgentAlias,
  canClaimOrphanDitoOrder,
  canReassignDitoOrder,
  canResolveAutomaticDitoAssignment,
  commercialTeamMemberRoleSchema,
  commercialTeamStatusSchema,
  ditoOrderAssignmentReasonSchema,
  ditoOrderAssignmentRequestSourceSchema,
  ditoOrderAssignmentRequestStatusSchema,
  ditoOrderAssignmentSourceSchema,
  isOrphanDitoOrder,
  resolveCommercialContextAccess,
  resolveDitoOrderVisibility,
} from "../dist/commercial-team-rules.js";

describe("canActivateAgentAlias", () => {
  const validInput = {
    userStatus: "ACTIVE",
    organizationRole: "AGENT",
    primaryMembershipActive: true,
    primaryTeamStatus: "ACTIVE",
  };

  it("allows an active agent with an active primary team", () => {
    assert.equal(canActivateAgentAlias(validInput), true);
  });

  it("rejects users without an active primary team", () => {
    assert.equal(
      canActivateAgentAlias({
        ...validInput,
        primaryMembershipActive: false,
      }),
      false,
    );

    assert.equal(
      canActivateAgentAlias({
        ...validInput,
        primaryTeamStatus: "DISABLED",
      }),
      false,
    );
  });

  it("rejects inactive users and non-agent roles", () => {
    assert.equal(
      canActivateAgentAlias({ ...validInput, userStatus: "DISABLED" }),
      false,
    );
    assert.equal(
      canActivateAgentAlias({
        ...validInput,
        organizationRole: "SUPERVISOR",
      }),
      false,
    );
  });
});

describe("commercial team administration isolation", () => {
  const validAssignment = {
    actorRole: "ADMIN",
    actorOrganizationId: "organization-a",
    teamOrganizationId: "organization-a",
    memberOrganizationId: "organization-a",
    teamStatus: "ACTIVE",
    memberUserStatus: "ACTIVE",
    memberOrganizationRole: "AGENT",
    targetMemberRole: "AGENT",
  };

  it("allows an administrator to manage an active team in the same organization", () => {
    assert.equal(
      canAdministerCommercialTeam({
        actorRole: "ADMIN",
        actorOrganizationId: "organization-a",
        teamOrganizationId: "organization-a",
        teamStatus: "ACTIVE",
      }),
      true,
    );
  });

  it("rejects a team from another organization", () => {
    assert.equal(
      canAssignCommercialTeamMember({
        ...validAssignment,
        teamOrganizationId: "organization-b",
      }),
      false,
    );
  });

  it("rejects a member from another organization", () => {
    assert.equal(
      canAssignCommercialTeamMember({
        ...validAssignment,
        memberOrganizationId: "organization-b",
      }),
      false,
    );
  });

  it("rejects disabled teams, non-admin actors and incompatible roles", () => {
    assert.equal(
      canAssignCommercialTeamMember({
        ...validAssignment,
        teamStatus: "DISABLED",
      }),
      false,
    );
    assert.equal(
      canAssignCommercialTeamMember({
        ...validAssignment,
        actorRole: "SUPERVISOR",
      }),
      false,
    );
    assert.equal(
      canAssignCommercialTeamMember({
        ...validAssignment,
        memberOrganizationRole: "SUPERVISOR",
      }),
      false,
    );
  });
});

describe("commercial team catalogs", () => {
  it("accepts the approved team statuses and member roles", () => {
    assert.equal(commercialTeamStatusSchema.safeParse("ACTIVE").success, true);

    assert.equal(
      commercialTeamMemberRoleSchema.safeParse("SUPERVISOR").success,
      true,
    );
  });

  it("accepts the approved assignment catalogs", () => {
    assert.equal(
      ditoOrderAssignmentReasonSchema.safeParse("REGISTERED_FOR_ANOTHER_AGENT")
        .success,
      true,
    );

    assert.equal(
      ditoOrderAssignmentSourceSchema.safeParse("ORPHAN_CLAIM").success,
      true,
    );

    assert.equal(
      ditoOrderAssignmentRequestStatusSchema.safeParse("PENDING").success,
      true,
    );

    assert.equal(
      ditoOrderAssignmentRequestSourceSchema.safeParse("BACKOFFICE_SUGGESTION")
        .success,
      true,
    );
  });

  it("rejects values outside the approved catalogs", () => {
    assert.equal(
      commercialTeamStatusSchema.safeParse("ARCHIVED").success,
      false,
    );

    assert.equal(
      commercialTeamMemberRoleSchema.safeParse("ADMIN").success,
      false,
    );

    assert.equal(
      ditoOrderAssignmentReasonSchema.safeParse("NO_REASON").success,
      false,
    );

    assert.equal(
      ditoOrderAssignmentRequestStatusSchema.safeParse("OPEN").success,
      false,
    );
  });
});

describe("isOrphanDitoOrder", () => {
  it("identifies an order without agent and team", () => {
    assert.equal(isOrphanDitoOrder(null, null), true);
  });

  it("does not classify a partially assigned order as orphan", () => {
    assert.equal(isOrphanDitoOrder("agent-1", null), false);
    assert.equal(isOrphanDitoOrder(null, "team-1"), false);
  });
});

describe("resolveDitoOrderVisibility", () => {
  const baseInput = {
    userId: "user-1",
    supervisedTeamIds: [],
    orderAgentUserId: null,
    orderAssignedTeamId: null,
  };

  it("grants full organizational visibility to ADMIN", () => {
    assert.equal(
      resolveDitoOrderVisibility({
        ...baseInput,
        role: "ADMIN",
      }),
      "FULL",
    );
  });

  it("grants full operational visibility to BACKOFFICE", () => {
    assert.equal(
      resolveDitoOrderVisibility({
        ...baseInput,
        role: "BACKOFFICE",
      }),
      "FULL",
    );
  });

  it("grants a supervisor full access to an assigned team", () => {
    assert.equal(
      resolveDitoOrderVisibility({
        ...baseInput,
        role: "SUPERVISOR",
        supervisedTeamIds: ["team-1"],
        orderAssignedTeamId: "team-1",
      }),
      "FULL",
    );
  });

  it("grants a supervisor limited access to the orphan pool", () => {
    assert.equal(
      resolveDitoOrderVisibility({
        ...baseInput,
        role: "SUPERVISOR",
        supervisedTeamIds: ["team-1"],
      }),
      "LIMITED_ORPHAN",
    );
  });

  it("does not expose the orphan pool to a supervisor without teams", () => {
    assert.equal(
      resolveDitoOrderVisibility({
        ...baseInput,
        role: "SUPERVISOR",
      }),
      "NONE",
    );
  });

  it("grants an agent access only to their own order", () => {
    assert.equal(
      resolveDitoOrderVisibility({
        ...baseInput,
        role: "AGENT",
        orderAgentUserId: "user-1",
      }),
      "FULL",
    );

    assert.equal(
      resolveDitoOrderVisibility({
        ...baseInput,
        role: "AGENT",
        orderAgentUserId: "user-2",
      }),
      "NONE",
    );
  });
});

describe("canClaimOrphanDitoOrder", () => {
  const baseInput = {
    supervisedTeamIds: ["team-1"],
    orderAgentUserId: null,
    orderAssignedTeamId: null,
    targetTeamId: "team-1",
    targetTeamStatus: "ACTIVE",
  };

  it("allows ADMIN to claim an orphan into an active team", () => {
    assert.equal(
      canClaimOrphanDitoOrder({
        ...baseInput,
        role: "ADMIN",
      }),
      true,
    );
  });

  it("allows a supervisor to claim into a supervised team", () => {
    assert.equal(
      canClaimOrphanDitoOrder({
        ...baseInput,
        role: "SUPERVISOR",
      }),
      true,
    );
  });

  it("rejects a supervisor claim into another team", () => {
    assert.equal(
      canClaimOrphanDitoOrder({
        ...baseInput,
        role: "SUPERVISOR",
        targetTeamId: "team-2",
      }),
      false,
    );
  });

  it("rejects claims for assigned orders or disabled teams", () => {
    assert.equal(
      canClaimOrphanDitoOrder({
        ...baseInput,
        role: "ADMIN",
        orderAgentUserId: "agent-1",
      }),
      false,
    );

    assert.equal(
      canClaimOrphanDitoOrder({
        ...baseInput,
        role: "ADMIN",
        targetTeamStatus: "DISABLED",
      }),
      false,
    );
  });
});

describe("resolveCommercialContextAccess", () => {
  const baseInput = {
    role: "AGENT",
    userId: "user-1",
    supervisedTeamIds: [],
    orderAgentUserId: null,
    orderAssignedTeamId: null,
    hasNormalAccess: false,
  };

  it("preserves normal access when it already exists", () => {
    assert.equal(
      resolveCommercialContextAccess({
        ...baseInput,
        hasNormalAccess: true,
      }),
      "NORMAL",
    );
  });

  it("grants derived read-only access to the responsible agent", () => {
    assert.equal(
      resolveCommercialContextAccess({
        ...baseInput,
        orderAgentUserId: "user-1",
      }),
      "DERIVED_READ_ONLY",
    );
  });

  it("grants derived read-only access to a team supervisor", () => {
    assert.equal(
      resolveCommercialContextAccess({
        ...baseInput,
        role: "SUPERVISOR",
        supervisedTeamIds: ["team-1"],
        orderAssignedTeamId: "team-1",
      }),
      "DERIVED_READ_ONLY",
    );
  });

  it("denies unrelated users", () => {
    assert.equal(resolveCommercialContextAccess(baseInput), "NONE");
  });
});

describe("canReassignDitoOrder", () => {
  const baseInput = {
    supervisedTeamIds: ["team-1"],
    currentTeamId: "team-1",
    targetTeamId: "team-1",
    targetTeamStatus: "ACTIVE",
  };

  it("allows ADMIN to transfer into an active team", () => {
    assert.equal(
      canReassignDitoOrder({
        ...baseInput,
        role: "ADMIN",
        targetTeamId: "team-2",
      }),
      true,
    );
  });

  it("allows a supervisor to reassign inside supervised teams", () => {
    assert.equal(
      canReassignDitoOrder({
        ...baseInput,
        role: "SUPERVISOR",
      }),
      true,
    );
  });

  it("rejects a supervisor transfer to an unsupervised team", () => {
    assert.equal(
      canReassignDitoOrder({
        ...baseInput,
        role: "SUPERVISOR",
        targetTeamId: "team-2",
      }),
      false,
    );
  });

  it("rejects BACKOFFICE and disabled destinations", () => {
    assert.equal(
      canReassignDitoOrder({
        ...baseInput,
        role: "BACKOFFICE",
      }),
      false,
    );

    assert.equal(
      canReassignDitoOrder({
        ...baseInput,
        role: "ADMIN",
        targetTeamStatus: "DISABLED",
      }),
      false,
    );
  });
});

describe("canResolveAutomaticDitoAssignment", () => {
  const validInput = {
    aliasMatchCount: 1,
    userStatus: "ACTIVE",
    organizationRole: "AGENT",
    primaryMembershipActive: true,
    primaryTeamId: "team-1",
    primaryTeamStatus: "ACTIVE",
  };

  it("accepts one active alias, agent and primary active team", () => {
    assert.equal(canResolveAutomaticDitoAssignment(validInput), true);
  });

  it("rejects zero or ambiguous alias matches", () => {
    assert.equal(
      canResolveAutomaticDitoAssignment({
        ...validInput,
        aliasMatchCount: 0,
      }),
      false,
    );

    assert.equal(
      canResolveAutomaticDitoAssignment({
        ...validInput,
        aliasMatchCount: 2,
      }),
      false,
    );
  });

  it("rejects an inactive user or a non-agent role", () => {
    assert.equal(
      canResolveAutomaticDitoAssignment({
        ...validInput,
        userStatus: "DISABLED",
      }),
      false,
    );

    assert.equal(
      canResolveAutomaticDitoAssignment({
        ...validInput,
        organizationRole: "SUPERVISOR",
      }),
      false,
    );
  });

  it("rejects a missing or inactive primary team membership", () => {
    assert.equal(
      canResolveAutomaticDitoAssignment({
        ...validInput,
        primaryMembershipActive: false,
      }),
      false,
    );

    assert.equal(
      canResolveAutomaticDitoAssignment({
        ...validInput,
        primaryTeamId: null,
      }),
      false,
    );

    assert.equal(
      canResolveAutomaticDitoAssignment({
        ...validInput,
        primaryTeamStatus: "DISABLED",
      }),
      false,
    );
  });
});
