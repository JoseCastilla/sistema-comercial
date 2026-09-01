import { redirect } from "next/navigation";

import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import {
  RecoveryTriageForm,
  type RecoveryTriageRow,
  type RecoveryTriageTeamOption,
} from "@/features/recovery/components/recovery-triage-form";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { Prisma } from "@repo/database";

import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import { SignOutButton } from "@/app/orders/sign-out-button";

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

function summarizePlan(planRaw: string | null): string {
  if (!planRaw) return "—";

  const match = planRaw.match(/S\/\s?\d+(?:\.\d+)?/);

  return match ? `Máximo ${match[0]}` : planRaw;
}

export default async function RecoveryTriagePage({
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

  if (!triageRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const parameters = await searchParams;
  const view = parameters.view === "pendientes" ? "pendientes" : "listos";
  const teamFilter = parameters.team ?? "";
  const departmentFilter = parameters.department ?? "";
  const planFilter = (parameters.plan ?? "").trim().slice(0, 100);
  const documentFilter = (parameters.q ?? "").trim().slice(0, 20);
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

  const caseScope: Prisma.RecoveryCaseWhereInput = {
    ...scopeWhere,
    status: { in: ["TRIAGE", "WAITING"] },
    ...(view === "listos" ? readyWhere : pendingWhere),
    ...(teamFilter ? { assignedTeamId: teamFilter } : {}),
    ...(departmentFilter
      ? { department: { equals: departmentFilter, mode: "insensitive" } }
      : {}),
    ...(planFilter
      ? {
          services: {
            some: {
              discardedAt: null,
              planRaw: { contains: planFilter, mode: "insensitive" },
            },
          },
        }
      : {}),
    ...(documentFilter
      ? { documentNumber: { contains: documentFilter } }
      : {}),
  };

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
    planSummary: summarizePlan(recoveryCase.services[0]?.planRaw ?? null),
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
  if (teamFilter) baseQuery.set("team", teamFilter);
  if (departmentFilter) baseQuery.set("department", departmentFilter);
  if (planFilter) baseQuery.set("plan", planFilter);
  if (documentFilter) baseQuery.set("q", documentFilter);

  function pageHref(target: number): string {
    const query = new URLSearchParams(baseQuery);
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return `/recovery/triage${suffix ? `?${suffix}` : ""}`;
  }

  function viewHref(target: "listos" | "pendientes"): string {
    const query = new URLSearchParams(baseQuery);
    query.delete("view");
    if (target !== "listos") query.set("view", target);
    const suffix = query.toString();
    return `/recovery/triage${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <CommercialAppShell
      activeSection="recovery"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="Campañas"
          title={isSupervisor ? "Revisar mi bloque" : "Revisar y repartir la base"}
          description={
            isSupervisor
              ? "La base entregada a tus equipos. El DNI se copia con un clic."
              : "Reparte bloques a los equipos o pon en espera a los que ya tienen pedido. El DNI se copia con un clic."
          }
        />

        <MetricGroup>
          <Metric
            label="Listos para repartir"
            value={readyTotal}
            hint="Líneas ya verificadas: se pueden entregar hoy"
          />
          <Metric
            label="Falta consultar"
            value={pendingTotal}
            hint="Aún no pasan por el reporte de portabilidad"
          />
          <Metric
            label="Con pedido en curso"
            value={waitingTotal}
            hint="Su pedido avanza solo; salen cuando se concreta"
          />
          <Metric
            label="Por repartir"
            value={openTotal}
            hint="Ya revisados; falta asignarlos a un equipo"
          />
        </MetricGroup>

        <div className="ui-form-row">
          <a
            className={`ui-button ${view === "listos" ? "ui-button--primary" : "ui-button--secondary"}`}
            href={viewHref("listos")}
          >
            Listos para repartir ({readyTotal.toLocaleString("es-PE")})
          </a>
          <a
            className={`ui-button ${view === "pendientes" ? "ui-button--primary" : "ui-button--secondary"}`}
            href={viewHref("pendientes")}
          >
            Falta consultar ({pendingTotal.toLocaleString("es-PE")})
          </a>
          <a
            className="ui-button ui-button--secondary"
            href="/recovery/board"
          >
            Tablero del día
          </a>
          <span className="pb-2 text-xs text-ui-muted">
            {view === "pendientes"
              ? "Aún sin verificar: si los repartes, el asesor llamará sin saber si el cliente ya es Movistar."
              : "Ya verificados: el cliente no es Movistar y no tiene portación en curso."}
          </span>
        </div>

        {openTotal > 0 ? (
          <p className="text-sm text-ui-muted">
            Hay {openTotal.toLocaleString("es-PE")} caso(s) listos esperando
            reparto.{" "}
            <a
              className="text-ui-accent underline-offset-2 hover:underline"
              href="/recovery/distribute"
            >
              Distribuir la base
            </a>
          </p>
        ) : null}

        <SectionPanel
          title="Casos pendientes"
          description={`${filteredTotal.toLocaleString("es-PE")} caso(s) cumplen el filtro; se muestran ${rows.length.toLocaleString("es-PE")} por página, primero los del último archivo cargado. Puedes marcar un rango con Shift o elegir cuántos tomar.`}
        >
          <form
            action="/recovery/triage"
            className="flex flex-wrap items-end gap-3"
            method="get"
          >
            {!isSupervisor ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ui-muted">
                  Equipo
                </span>
                <select
                  className="block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
                  defaultValue={teamFilter}
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
            ) : null}
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
          </form>

          <RecoveryTriageForm
            canAssignTeams={!isSupervisor}
            rows={rows}
            teams={teamOptions}
          />

          {totalPages > 1 ? (
            <div className="flex items-center gap-3 text-sm">
              {page > 1 ? (
                <a
                  className="text-ui-accent underline-offset-2 hover:underline"
                  href={pageHref(page - 1)}
                >
                  ← Anterior
                </a>
              ) : null}
              <span className="text-ui-muted">
                Página {page} de {totalPages}
              </span>
              {page < totalPages ? (
                <a
                  className="text-ui-accent underline-offset-2 hover:underline"
                  href={pageHref(page + 1)}
                >
                  Siguiente →
                </a>
              ) : null}
            </div>
          ) : null}
        </SectionPanel>
      </div>
    </CommercialAppShell>
  );
}
