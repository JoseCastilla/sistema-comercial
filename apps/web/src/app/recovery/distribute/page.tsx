import Link from "next/link";
import Form from "next/form";
import { redirect } from "next/navigation";

import {
  DistributeRecoveryForm,
  type DistributeAdvisorOption,
  type DistributeRecoveryRow,
  type DistributeTeamOption,
} from "@/features/recovery/components/distribute-recovery-form";
import { returnStaleBaseCasesToPool } from "@/features/recovery/server/return-stale-base-cases";
import { requireCommercialAccess } from "@/server/auth/access";

import { allOf } from "@repo/validation";
import { database } from "@/server/database";

import type { Prisma } from "@repo/database";

import { formatCount } from "@repo/ui/format";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

const distributionRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);

const pageSize = 250;

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  dateStyle: "short",
  timeStyle: "short",
});

function summarizePlan(planRaw: string | null): string {
  if (!planRaw) return "—";
  const match = planRaw.match(/S\/\s?\d+(?:\.\d+)?/);
  return match ? `Máximo ${match[0]}` : planRaw;
}

export default async function RecoveryDistributePage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    team?: string;
    department?: string;
    plan?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const { session, membership } = await requireCommercialAccess();

  if (!distributionRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const parameters = await searchParams;
  const view = parameters.view === "unworked" ? "unworked" : "open";
  const teamFilter = parameters.team ?? "";
  const departmentFilter = parameters.department ?? "";
  const planFilter = (parameters.plan ?? "").trim().slice(0, 100);
  const documentFilter = (parameters.q ?? "").trim().slice(0, 20);
  const page = Math.max(1, Number.parseInt(parameters.page ?? "1", 10) || 1);

  // BR-077: lo abandonado vuelve al pool antes de mirar qué distribuir.
  await returnStaleBaseCasesToPool(membership.organization.id);

  const isSupervisor = membership.role === "SUPERVISOR";
  const supervisedTeamIds = isSupervisor
    ? (
        await database.commercialTeamMember.findMany({
          where: {
            organizationId: membership.organization.id,
            userId: session.user.id,
            memberRole: "SUPERVISOR",
            isActive: true,
            team: { status: "ACTIVE" },
          },
          select: { teamId: true },
        })
      ).map((item) => item.teamId)
    : null;

  const scopeWhere: Prisma.RecoveryCaseWhereInput = {
    organizationId: membership.organization.id,
    source: "NATIONAL_BASE",
    ...(supervisedTeamIds ? { assignedTeamId: { in: supervisedTeamIds } } : {}),
  };

  /**
   * COR-04 (05/09/2026, BR-022b/BR-029): el `?team=` de la URL pisaba la
   * restricción a los equipos del supervisor —misma clave, el último gana—
   * y le mostraba la base de otro equipo. El filtro solo puede estrechar el
   * alcance; un equipo ajeno se ignora.
   */
  const teamScope = supervisedTeamIds
    ? supervisedTeamIds.includes(teamFilter)
      ? teamFilter
      : ""
    : teamFilter;

  // COR-01: condiciones juntas con AND, para que ninguna pise a otra.
  const filterWhere: Prisma.RecoveryCaseWhereInput = allOf<Prisma.RecoveryCaseWhereInput>(
    scopeWhere,
    teamScope ? { assignedTeamId: teamScope } : null,
    departmentFilter
      ? { department: { equals: departmentFilter, mode: "insensitive" } }
      : null,
    planFilter
      ? {
          services: {
            some: {
              discardedAt: null,
              planRaw: { contains: planFilter, mode: "insensitive" },
            },
          },
        }
      : null,
    documentFilter ? { documentNumber: { contains: documentFilter } } : null,
  );

  const viewWhere: Prisma.RecoveryCaseWhereInput = allOf<Prisma.RecoveryCaseWhereInput>(
    filterWhere,
    view === "open"
      ? { status: "OPEN" }
      : { status: "ASSIGNED", attempts: { none: {} } },
  );

  const [
    openCount,
    unworkedCount,
    inProgressCount,
    triageCount,
    filteredTotal,
    cases,
    departmentGroups,
    teams,
    advisorMemberships,
    advisorOpenCounts,
  ] = await Promise.all([
    database.recoveryCase.count({ where: { ...scopeWhere, status: "OPEN" } }),
    database.recoveryCase.count({
      where: { ...scopeWhere, status: "ASSIGNED", attempts: { none: {} } },
    }),
    database.recoveryCase.count({
      where: {
        ...scopeWhere,
        OR: [
          { status: { in: ["IN_PROGRESS", "SCHEDULED"] } },
          { status: "ASSIGNED", attempts: { some: {} } },
        ],
      },
    }),
    database.recoveryCase.count({
      where: { ...scopeWhere, status: { in: ["TRIAGE", "WAITING"] } },
    }),
    database.recoveryCase.count({ where: viewWhere }),
    database.recoveryCase.findMany({
      where: viewWhere,
      orderBy:
        view === "open" ? [{ lastSightingAt: "desc" }] : [{ claimedAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        holderName: true,
        documentNumber: true,
        department: true,
        lastSightingAt: true,
        portabilityEligibleAt: true,
        assignedTeam: { select: { name: true } },
        assignedUser: { select: { name: true } },
        services: {
          where: { discardedAt: null },
          select: { planRaw: true, portabilityCheckedAt: true },
        },
      },
    }),
    database.recoveryCase.groupBy({
      by: ["department"],
      where: { ...scopeWhere, status: view === "open" ? "OPEN" : "ASSIGNED" },
      _count: { _all: true },
      orderBy: { _count: { department: "desc" } },
      take: 30,
    }),
    database.commercialTeam.findMany({
      where: {
        organizationId: membership.organization.id,
        status: "ACTIVE",
        ...(supervisedTeamIds ? { id: { in: supervisedTeamIds } } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    database.commercialTeamMember.findMany({
      where: {
        salesEnabled: true,
        isActive: true,
        isPrimary: true,
        team: {
          organizationId: membership.organization.id,
          status: "ACTIVE",
          ...(supervisedTeamIds ? { id: { in: supervisedTeamIds } } : {}),
        },
        user: { status: "ACTIVE" },
      },
      select: {
        userId: true,
        teamId: true,
        user: { select: { name: true } },
        team: { select: { name: true } },
      },
    }),
    database.recoveryCase.groupBy({
      by: ["assignedUserId"],
      where: {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        status: { in: ["ASSIGNED", "IN_PROGRESS", "SCHEDULED"] },
        assignedUserId: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  const now = new Date();
  const openByUser = new Map(
    advisorOpenCounts.map((item) => [item.assignedUserId, item._count._all]),
  );

  const rows: DistributeRecoveryRow[] = cases.map((item) => ({
    id: item.id,
    holderName: item.holderName,
    documentNumber: item.documentNumber,
    department: item.department,
    planSummary: summarizePlan(item.services[0]?.planRaw ?? null),
    serviceCount: item.services.length,
    // BR-083: distribuir sin verificar se advierte, no se bloquea.
    unverified: item.services.some(
      (service) => service.portabilityCheckedAt === null,
    ),
    teamName: item.assignedTeam?.name ?? null,
    assignedToName: item.assignedUser?.name ?? null,
    habilitationOverdue:
      item.portabilityEligibleAt !== null &&
      item.portabilityEligibleAt.getTime() <= now.getTime(),
    lastSightingLabel: dateTimeFormatter.format(item.lastSightingAt),
  }));

  const teamOptions: DistributeTeamOption[] = teams;
  const advisorOptions: DistributeAdvisorOption[] = advisorMemberships
    .map((item) => ({
      id: item.userId,
      name: item.user.name,
      teamId: item.teamId,
      teamName: item.team.name,
      openCases: openByUser.get(item.userId) ?? 0,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));

  const departments = departmentGroups
    .map((group) => group.department)
    .filter((value): value is string => value !== null && value.length > 0);

  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));

  const baseQuery = new URLSearchParams();
  if (view !== "open") baseQuery.set("view", view);
  if (teamScope) baseQuery.set("team", teamScope);
  if (departmentFilter) baseQuery.set("department", departmentFilter);
  if (planFilter) baseQuery.set("plan", planFilter);
  if (documentFilter) baseQuery.set("q", documentFilter);

  function pageHref(target: number): string {
    const query = new URLSearchParams(baseQuery);
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return `/recovery/distribute${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <>
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="Campañas"
          title="Repartir la base"
          description="Reparte los casos listos entre asesores o envíalos a la cola del equipo. Los casos asignados sin gestión se pueden redistribuir."
        />

        <MetricGroup>
          <Metric label="Disponible" value={openCount} />
          <Metric label="Asignados sin gestión" value={unworkedCount} />
          <Metric label="En gestión" value={inProgressCount} />
          <Metric label="Por revisar o portando" value={triageCount} />
        </MetricGroup>

        {triageCount > 0 ? (
          <p className="text-sm text-ui-muted">
            Hay {formatCount(triageCount)} caso(s) que aún no pasan la revisión.{" "}
            <Link
              className="text-ui-accent underline-offset-2 hover:underline"
              href="/recovery/triage"
            >
              Ir a revisarlos
            </Link>
          </p>
        ) : null}

        <SectionPanel
          title={
            view === "open"
              ? "Base disponible"
              : "Asignados sin gestión (redistribuibles)"
          }
          description={`${formatCount(filteredTotal)} caso(s) cumplen el filtro; se muestran ${formatCount(rows.length)} por página, los más recientes primero.`}
        >
          <Form
            action="/recovery/distribute"
            className="flex flex-wrap items-end gap-3"
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ui-muted">
                Vista
              </span>
              <select
                className="block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
                defaultValue={view}
                name="view"
              >
                <option value="open">Por distribuir</option>
                <option value="unworked">Asignados sin gestión</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ui-muted">
                Equipo
              </span>
              <select
                className="block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
                defaultValue={teamScope}
                name="team"
              >
                <option value="">Todos</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ui-muted">
                Departamento
              </span>
              <select
                className="block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
                defaultValue={departmentFilter}
                name="department"
              >
                <option value="">Todos</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ui-muted">
                Plan contiene
              </span>
              <input
                className="block w-32 rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
                defaultValue={planFilter}
                maxLength={100}
                name="plan"
                placeholder="49.9"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ui-muted">
                DNI
              </span>
              <input
                className="block w-32 rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
                defaultValue={documentFilter}
                maxLength={20}
                name="q"
                placeholder="Buscar"
              />
            </label>
            <button className="ui-button ui-button--secondary" type="submit">
              Filtrar
            </button>
          </Form>

          <DistributeRecoveryForm
            advisors={advisorOptions}
            rows={rows}
            teams={teamOptions}
            viewerRole={membership.role}
            viewerUserId={session.user.id}
          />

          {totalPages > 1 ? (
            <div className="flex items-center gap-3 text-sm">
              {page > 1 ? (
                <Link
                  className="text-ui-accent underline-offset-2 hover:underline"
                  href={pageHref(page - 1)}
                >
                  ← Anterior
                </Link>
              ) : null}
              <span className="text-ui-muted">
                Página {page} de {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  className="text-ui-accent underline-offset-2 hover:underline"
                  href={pageHref(page + 1)}
                >
                  Siguiente →
                </Link>
              ) : null}
            </div>
          ) : null}
        </SectionPanel>
      </div>
    </>
  );
}
