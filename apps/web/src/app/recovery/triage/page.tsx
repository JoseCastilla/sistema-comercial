import Link from "next/link";
import { redirect } from "next/navigation";

import {
  RecoveryTriageForm,
  type RecoveryTriageRow,
  type RecoveryTriageTeamOption,
} from "@/features/recovery/components/recovery-triage-form";
import { QueueFilters } from "@/features/recovery/components/queue-filters";
import { buildRecoverySearchWhere } from "@/features/recovery/server/recovery-search-where";
import { releaseWaitingBaseCases } from "@/features/recovery/server/release-waiting-base-cases";
import { requireCommercialAccess } from "@/server/auth/access";

import {
  parseRecoveryAgeBucket,
  recoveryAgeBucketRange,
  recoveryAgeBuckets,
  recoveryTeamFilterNone,
  summarizeRecoveryPlan,
  allOf,
} from "@repo/validation";
import { database } from "@/server/database";

import type { Prisma } from "@repo/database";

import { formatCount } from "@repo/ui/format";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

const triageRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);

const pageSize = 250;

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default async function RecoveryTriagePage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    team?: string;
    department?: string;
    plan?: string;
    q?: string;
    age?: string;
    page?: string;
  }>;
}) {
  const { session, membership } = await requireCommercialAccess();

  if (!triageRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  // BR-024b: lo que ya no espera nada vuelve a revisión antes de contarlo.
  await releaseWaitingBaseCases(membership.organization.id);

  const parameters = await searchParams;
  /**
   * COR-02 (05/09/2026): tres vistas y cada contador abre exactamente el
   * conjunto que nombra. «Listos» eran solo los `TRIAGE` verificados en el
   * contador, pero el listado colaba también los `WAITING` verificados: el
   * supervisor veía casos en espera bajo un botón que decía «listos».
   */
  const view =
    parameters.view === "pendientes"
      ? "pendientes"
      : parameters.view === "espera"
        ? "espera"
        : "listos";
  const teamFilter = parameters.team ?? "";
  const departmentFilter = parameters.department ?? "";
  const planFilter = (parameters.plan ?? "").trim().slice(0, 100);
  const searchInput = (parameters.q ?? "").trim().slice(0, 80);
  const ageFilter = parseRecoveryAgeBucket(parameters.age);
  const page = Math.max(1, Number.parseInt(parameters.page ?? "1", 10) || 1);

  const isSupervisor = membership.role === "SUPERVISOR";

  /**
   * BR-022b/BR-029: un supervisor solo ve el triage de la base que le fue
   * entregada — los casos asignados a sus equipos. ADMIN y BACKOFFICE ven la
   * organización completa y son quienes reparten bloques entre equipos.
   */
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
   * BR-080/BR-083: un caso está listo cuando ninguna línea activa queda sin
   * consultar. El triage trabaja los listos; los que esperan consulta se ven
   * bajo su propio contador, nunca mezclados.
   */
  const readyWhere: Prisma.RecoveryCaseWhereInput = {
    services: { none: { discardedAt: null, portabilityCheckedAt: null } },
  };
  const pendingWhere: Prisma.RecoveryCaseWhereInput = {
    services: { some: { discardedAt: null, portabilityCheckedAt: null } },
  };

  /**
   * BR-022b/BR-029: `assignedTeamId` pisaría la restricción de `scopeWhere`,
   * así que un `?team=` en la barra de direcciones —pegado de un enlace
   * ajeno— le mostraría a un supervisor los casos de otro equipo. El filtro
   * puede estrechar su alcance, nunca ampliarlo.
   */
  const teamScope = supervisedTeamIds
    ? supervisedTeamIds.includes(teamFilter)
      ? teamFilter
      : ""
    : teamFilter;

  /**
   * Fase 2: el plan se elige de una lista, no se teclea. Las opciones son los
   * planes presentes en la base dentro del alcance, con su etiqueta
   * comercial; varias variantes crudas pueden compartir etiqueta, así que el
   * filtro abarca todas las que la comparten.
   */
  const planGroups = await database.recoveryCaseService.groupBy({
    by: ["planRaw"],
    where: {
      organizationId: membership.organization.id,
      discardedAt: null,
      case: { ...scopeWhere, status: { in: ["TRIAGE", "WAITING"] } },
    },
  });
  const planRaws = planGroups
    .map((group) => group.planRaw)
    .filter((plan): plan is string => plan !== null && plan.length > 0);
  const planOptions = [...new Set(planRaws.map(summarizeRecoveryPlan))].sort();
  const planRawsForFilter = planRaws.filter(
    (plan) => summarizeRecoveryPlan(plan) === planFilter,
  );

  const viewWhere: Prisma.RecoveryCaseWhereInput =
    view === "listos"
      ? { status: "TRIAGE", ...readyWhere }
      : view === "espera"
        ? { status: "WAITING", ...readyWhere }
        : { status: { in: ["TRIAGE", "WAITING"] }, ...pendingWhere };

  /**
   * COR-01 (05/09/2026): las condiciones se juntan con AND, no por spread.
   * La vista y el filtro de plan hablan los dos de `services`; por spread
   * el plan ganaba y borraba la verificación, así que elegir un plan en
   * «Listos» traía casos sin consultar. El contador usaba el mismo objeto:
   * coincidían entre sí y mentían los dos.
   */
  const caseScope: Prisma.RecoveryCaseWhereInput =
    allOf<Prisma.RecoveryCaseWhereInput>(
      scopeWhere,
      viewWhere,
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
      // BR-004: la antigüedad se mide desde el pedido, nunca desde la carga.
      ageFilter
        ? { lastSightingAt: recoveryAgeBucketRange(ageFilter, new Date()) }
        : null,
      // BR-088: un dato suelto —nombre, DNI, teléfono o línea— basta.
      buildRecoverySearchWhere(searchInput),
    );

  const [
    readyTotal,
    pendingTotal,
    waitingTotal,
    openTotal,
    filteredTotal,
    cases,
    departmentGroups,
    teams,
  ] = await Promise.all([
    database.recoveryCase.count({
      where: { ...scopeWhere, status: "TRIAGE", ...readyWhere },
    }),
    database.recoveryCase.count({
      where: {
        ...scopeWhere,
        status: { in: ["TRIAGE", "WAITING"] },
        ...pendingWhere,
      },
    }),
    database.recoveryCase.count({
      where: { ...scopeWhere, status: "WAITING", ...readyWhere },
    }),
    database.recoveryCase.count({ where: { ...scopeWhere, status: "OPEN" } }),
    database.recoveryCase.count({ where: caseScope }),
    database.recoveryCase.findMany({
      where: caseScope,
      orderBy: [{ status: "asc" }, { lastSightingAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        holderName: true,
        documentNumber: true,
        status: true,
        lastSightingAt: true,
        assignedTeam: { select: { name: true } },
        services: {
          select: { serviceNumber: true, planRaw: true, carrierRaw: true },
        },
        _count: { select: { sightings: true } },
      },
    }),
    database.recoveryCase.groupBy({
      by: ["department"],
      where: { ...scopeWhere, status: { in: ["TRIAGE", "WAITING"] } },
      _count: { _all: true },
      orderBy: { _count: { department: "desc" } },
      take: 30,
    }),
    isSupervisor
      ? Promise.resolve([])
      : database.commercialTeam.findMany({
          where: {
            organizationId: membership.organization.id,
            status: "ACTIVE",
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
  ]);

  const rows: RecoveryTriageRow[] = cases.map((recoveryCase) => ({
    id: recoveryCase.id,
    holderName: recoveryCase.holderName,
    documentNumber: recoveryCase.documentNumber,
    status: recoveryCase.status === "WAITING" ? "WAITING" : "TRIAGE",
    serviceNumbers: recoveryCase.services.map(
      (service) => service.serviceNumber,
    ),
    planSummary: summarizeRecoveryPlan(
      recoveryCase.services[0]?.planRaw ?? null,
    ),
    carrierSummary: [
      ...new Set(
        recoveryCase.services
          .map((service) => service.carrierRaw)
          .filter((value): value is string => value !== null),
      ),
    ].join(", "),
    teamName: recoveryCase.assignedTeam?.name ?? null,
    lastSightingLabel: dateTimeFormatter.format(recoveryCase.lastSightingAt),
    sightingCount: recoveryCase._count.sightings,
  }));

  const teamOptions: RecoveryTriageTeamOption[] = teams;
  const departments = departmentGroups
    .map((group) => group.department)
    .filter((value): value is string => value !== null && value.length > 0);
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));

  const baseQuery = new URLSearchParams();
  if (view !== "listos") baseQuery.set("view", view);
  if (teamScope) baseQuery.set("team", teamScope);
  if (departmentFilter) baseQuery.set("department", departmentFilter);
  if (planFilter) baseQuery.set("plan", planFilter);
  if (searchInput) baseQuery.set("q", searchInput);
  if (ageFilter) baseQuery.set("age", ageFilter);

  function pageHref(target: number): string {
    const query = new URLSearchParams(baseQuery);
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return `/recovery/triage${suffix ? `?${suffix}` : ""}`;
  }

  function viewHref(target: "listos" | "pendientes" | "espera"): string {
    const query = new URLSearchParams(baseQuery);
    query.delete("view");
    if (target !== "listos") query.set("view", target);
    const suffix = query.toString();
    return `/recovery/triage${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <>
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="Campañas"
          title={
            isSupervisor ? "Revisar mi bloque" : "Revisar y repartir la base"
          }
          description={
            isSupervisor
              ? "La base entregada a tus equipos. El DNI y cada línea se copian con un clic."
              : "Reparte bloques a los equipos o pon en espera a los que ya tienen pedido. El DNI y cada línea se copian con un clic."
          }
        />

        <MetricGroup>
          <Metric
            href={viewHref("listos")}
            label="Listos para repartir"
            value={readyTotal}
            hint="Líneas ya verificadas: se pueden entregar hoy"
          />
          <Metric
            href={viewHref("pendientes")}
            label="Falta consultar"
            value={pendingTotal}
            hint="Aún no pasan por el reporte de portabilidad"
          />
          <Metric
            href={viewHref("espera")}
            label="Con pedido en curso"
            value={waitingTotal}
            hint="Verificados que esperan a que su pedido se concrete o se caiga"
          />
          <Metric
            label="Disponible"
            value={openTotal}
            hint="Ya revisados; falta asignarlos a un equipo"
          />
        </MetricGroup>

        <div className="ui-form-row">
          <Link
            className={`ui-button ${view === "listos" ? "ui-button--primary" : "ui-button--secondary"}`}
            href={viewHref("listos")}
          >
            Listos para repartir ({formatCount(readyTotal)})
          </Link>
          <Link
            className={`ui-button ${view === "pendientes" ? "ui-button--primary" : "ui-button--secondary"}`}
            href={viewHref("pendientes")}
          >
            Falta consultar ({formatCount(pendingTotal)})
          </Link>
          <Link
            className={`ui-button ${view === "espera" ? "ui-button--primary" : "ui-button--secondary"}`}
            href={viewHref("espera")}
          >
            Con pedido en curso ({formatCount(waitingTotal)})
          </Link>
          <Link
            className="ui-button ui-button--secondary"
            href="/recovery/board"
          >
            Tablero del día
          </Link>
          <Link
            className="ui-button ui-button--secondary"
            href="/recovery/follow-up"
          >
            Seguimiento
          </Link>
          <span className="pb-2 text-xs text-ui-muted">
            {view === "pendientes"
              ? "Aún sin verificar: si los repartes, el asesor llamará sin saber si el cliente ya es Movistar."
              : view === "espera"
                ? "Verificados con pedido en curso: vuelven solos a revisión al día siguiente, o cuando su fecha de portación pasa."
                : "Ya verificados, sin pedido en curso: se pueden repartir hoy."}
          </span>
        </div>

        {openTotal > 0 ? (
          <p className="text-sm text-ui-muted">
            Hay {formatCount(openTotal)} caso(s) en la base disponible.{" "}
            <Link
              className="text-ui-accent underline-offset-2 hover:underline"
              href="/recovery/distribute"
            >
              Distribuir la base
            </Link>
          </p>
        ) : null}

        <SectionPanel
          title="Casos pendientes"
          description={`${formatCount(filteredTotal)} caso(s) cumplen el filtro; se muestran ${formatCount(rows.length)} por página, primero los del último archivo cargado. Puedes marcar un rango con Shift o elegir cuántos tomar.`}
        >
          <QueueFilters
            basePath="/recovery/triage"
            options={{
              teams: isSupervisor ? undefined : teams,
              allowNoTeam: !isSupervisor,
              departments,
              plans: planOptions,
              ages: recoveryAgeBuckets,
            }}
            resultLabel={`${formatCount(filteredTotal)} caso(s) cumplen el filtro.`}
            values={{
              q: searchInput,
              view: view === "listos" ? "" : view,
              team: teamScope,
              department: departmentFilter,
              plan: planFilter,
              age: ageFilter ?? "",
            }}
          />

          <RecoveryTriageForm
            canAssignTeams={!isSupervisor}
            rows={rows}
            teams={teamOptions}
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
