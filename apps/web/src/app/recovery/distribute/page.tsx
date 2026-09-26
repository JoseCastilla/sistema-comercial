import Link from "next/link";
import { redirect } from "next/navigation";

import {
  DistributeRecoveryForm,
  type DistributeAdvisorOption,
  type DistributeRecoveryRow,
  type DistributeTeamOption,
} from "@/features/recovery/components/distribute-recovery-form";
import { returnStaleBaseCasesToPool } from "@/features/recovery/server/return-stale-base-cases";
import { QueueFilters } from "@/features/recovery/components/queue-filters";
import { buildRecoverySearchWhere } from "@/features/recovery/server/recovery-search-where";
import { CampaignNav } from "@/features/recovery/components/campaign-nav";
import {
  campaignStageHints,
  campaignStageHrefs,
  campaignStageLabels,
} from "@/features/recovery/campaign-stage-labels";
import { requireCommercialAccess } from "@/server/auth/access";

import {
  parseRecoveryAgeBucket,
  recoveryAgeBucketRange,
  recoveryAgeBuckets,
  recoveryTeamFilterNone,
  summarizeRecoveryPlan,
  allOf,
  formatCampaignMoment,
} from "@repo/validation";
import { database } from "@/server/database";

import type { Prisma } from "@repo/database";

import { formatCount } from "@repo/ui/format";
import { PageHeader } from "@repo/ui/page-header";

const distributionRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);

const pageSize = 250;

export default async function RecoveryDistributePage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    team?: string;
    department?: string;
    plan?: string;
    q?: string;
    advisor?: string;
    age?: string;
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
  const searchInput = (parameters.q ?? "").trim().slice(0, 80);
  const advisorFilter = (parameters.advisor ?? "").trim().slice(0, 40);
  const ageFilter = parseRecoveryAgeBucket(parameters.age);
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

  /**
   * Fase 2: el plan se elige de una lista con las etiquetas comerciales
   * presentes en la base dentro del alcance. Varias variantes crudas pueden
   * compartir etiqueta; el filtro abarca todas las que la comparten.
   */
  const planGroups = await database.recoveryCaseService.groupBy({
    by: ["planRaw"],
    where: {
      organizationId: membership.organization.id,
      discardedAt: null,
      case: { ...scopeWhere, status: view === "open" ? "OPEN" : "ASSIGNED" },
    },
  });
  const planRaws = planGroups
    .map((group) => group.planRaw)
    .filter((plan): plan is string => plan !== null && plan.length > 0);
  const planOptions = [...new Set(planRaws.map(summarizeRecoveryPlan))].sort();
  const planRawsForFilter = planRaws.filter(
    (plan) => summarizeRecoveryPlan(plan) === planFilter,
  );

  // COR-01: condiciones juntas con AND, para que ninguna pise a otra.
  const filterWhere: Prisma.RecoveryCaseWhereInput =
    allOf<Prisma.RecoveryCaseWhereInput>(
      scopeWhere,
      // «Sin equipo» es un valor propio del filtro, no un equipo (fase 2).
      teamScope === recoveryTeamFilterNone
        ? { assignedTeamId: null }
        : teamScope
          ? { assignedTeamId: teamScope }
          : null,
      departmentFilter
        ? { department: { equals: departmentFilter, mode: "insensitive" } }
        : null,
      planFilter
        ? {
            services: {
              some: { discardedAt: null, planRaw: { in: planRawsForFilter } },
            },
          }
        : null,
      /**
       * «Asesor actual» filtra por el dueño de hoy, no por el destino de una
       * asignación. Solo aplica a los asignados; los casos por distribuir no
       * tienen dueño. Un supervisor sigue acotado por `scopeWhere`: un asesor
       * de otro equipo simplemente no devuelve filas.
       */
      view === "unworked" && advisorFilter
        ? { assignedUserId: advisorFilter }
        : null,
      // BR-004: la antigüedad se mide desde el pedido, nunca desde la carga.
      ageFilter
        ? { lastSightingAt: recoveryAgeBucketRange(ageFilter, new Date()) }
        : null,
      // BR-088: un dato suelto —nombre, DNI, teléfono o línea— basta.
      buildRecoverySearchWhere(searchInput),
    );

  const viewWhere: Prisma.RecoveryCaseWhereInput =
    allOf<Prisma.RecoveryCaseWhereInput>(
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
    advisorUnworkedCounts,
    advisorOverdueCounts,
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
    // PL-04: carga real por asesor antes de repartir —sin primer contacto y
    // con la próxima acción vencida—, con las mismas definiciones que
    // Seguimiento.
    database.recoveryCase.groupBy({
      by: ["assignedUserId"],
      where: {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        status: { in: ["ASSIGNED", "IN_PROGRESS", "SCHEDULED"] },
        assignedUserId: { not: null },
        firstContactAt: null,
      },
      _count: { _all: true },
    }),
    database.recoveryCase.groupBy({
      by: ["assignedUserId"],
      where: {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        status: { in: ["ASSIGNED", "IN_PROGRESS", "SCHEDULED"] },
        assignedUserId: { not: null },
        nextActionAt: { lt: new Date() },
      },
      _count: { _all: true },
    }),
  ]);

  const now = new Date();
  const openByUser = new Map(
    advisorOpenCounts.map((item) => [item.assignedUserId, item._count._all]),
  );
  const unworkedByUser = new Map(
    advisorUnworkedCounts.map((item) => [
      item.assignedUserId,
      item._count._all,
    ]),
  );
  const overdueByUser = new Map(
    advisorOverdueCounts.map((item) => [item.assignedUserId, item._count._all]),
  );

  const rows: DistributeRecoveryRow[] = cases.map((item) => ({
    id: item.id,
    holderName: item.holderName,
    documentNumber: item.documentNumber,
    department: item.department,
    planSummary: summarizeRecoveryPlan(item.services[0]?.planRaw ?? null),
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
    lastSightingLabel: formatCampaignMoment(item.lastSightingAt),
  }));

  const teamOptions: DistributeTeamOption[] = teams;
  const advisorOptions: DistributeAdvisorOption[] = advisorMemberships
    .map((item) => ({
      id: item.userId,
      name: item.user.name,
      teamId: item.teamId,
      teamName: item.team.name,
      openCases: openByUser.get(item.userId) ?? 0,
      unworkedCases: unworkedByUser.get(item.userId) ?? 0,
      overdueCases: overdueByUser.get(item.userId) ?? 0,
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
  if (searchInput) baseQuery.set("q", searchInput);
  if (view === "unworked" && advisorFilter)
    baseQuery.set("advisor", advisorFilter);
  if (ageFilter) baseQuery.set("age", ageFilter);

  function pageHref(target: number): string {
    const query = new URLSearchParams(baseQuery);
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return `/recovery/distribute${suffix ? `?${suffix}` : ""}`;
  }

  // SPEC-071: las cuatro etapas en una línea; cada cifra abre su lista.
  const stageFigures = [
    {
      label: campaignStageLabels.open,
      value: openCount,
      href: campaignStageHrefs.open,
      hint: campaignStageHints.open,
    },
    {
      label: campaignStageLabels.assignedUnworked,
      value: unworkedCount,
      href: campaignStageHrefs.assignedUnworked,
      hint: campaignStageHints.assignedUnworked,
    },
    {
      label: campaignStageLabels.managed,
      value: inProgressCount,
      href: campaignStageHrefs.managed,
      hint: campaignStageHints.managed,
    },
    {
      label: "En revisión",
      value: triageCount,
      href: "/recovery/triage",
      hint: "Todavía en «Revisar»: falta consultar, verificados por entregar o con pedido en curso",
    },
  ];

  return (
    <>
      <div className="ui-page-stack">
        {/* SPEC-071: sin subtítulo ni tarjetas; una línea de cifras. */}
        <PageHeader eyebrow="Campañas" title="Repartir la base" />
        <CampaignNav current="repartir" role={membership.role} />

        <section
          aria-label="La base"
          className="flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-lg border border-ui-border bg-ui-surface px-4 py-3 text-sm text-ui-muted"
        >
          {stageFigures.map((figure) => (
            <Link
              className="underline-offset-2 hover:underline"
              href={figure.href}
              key={figure.label}
              title={figure.hint}
            >
              {figure.label}{" "}
              <strong className="text-base tabular-nums text-ui-text">
                {formatCount(figure.value)}
              </strong>
            </Link>
          ))}
        </section>

        {/* Las dos poblaciones que se reparten, como pestañas con su cifra. */}
        <nav aria-label="Qué repartir" className="ui-segmented-scroll">
          <div className="ui-segmented">
            {(
              [
                { value: "open", label: "Por repartir", count: openCount },
                {
                  value: "unworked",
                  label: "Asignados sin gestión",
                  count: unworkedCount,
                },
              ] as const
            ).map((option) => (
              <Link
                aria-current={view === option.value ? "page" : undefined}
                className="ui-segmented__item"
                href={campaignStageHrefs[option.value === "open" ? "open" : "assignedUnworked"]}
                key={option.value}
              >
                {option.label}
                <span className="ml-1 text-xs text-ui-muted">
                  {formatCount(option.count)}
                </span>
              </Link>
            ))}
          </div>
        </nav>

        <section aria-label="Base disponible" className="grid gap-4">
          <QueueFilters
            basePath="/recovery/distribute"
            moreFilters
            options={{
              teams,
              allowNoTeam: !isSupervisor,
              advisors:
                view === "unworked"
                  ? [
                      ...new Map(
                        advisorMemberships.map((item) => [
                          item.userId,
                          {
                            id: item.userId,
                            name: `${item.user.name} · ${item.team.name}`,
                          },
                        ]),
                      ).values(),
                    ]
                  : undefined,
              departments,
              plans: planOptions,
              ages: recoveryAgeBuckets,
            }}
            resultLabel={`${formatCount(filteredTotal)} ${filteredTotal === 1 ? "caso" : "casos"}`}
            values={{
              q: searchInput,
              view,
              team: teamScope,
              department: departmentFilter,
              plan: planFilter,
              advisor: view === "unworked" ? advisorFilter : "",
              age: ageFilter ?? "",
            }}
          />

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
        </section>
      </div>
    </>
  );
}
