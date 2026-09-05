import Link from "next/link";

import { formatCount } from "@repo/ui/format";
import { ConfirmSubmitButton } from "@repo/ui/confirm-submit-button";
import { EmptyState } from "@repo/ui/empty-state";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";

import { DirectoryFilters } from "@/features/admin/components/directory-filters";
import { AssignTeamMemberForm } from "@/features/teams/components/assign-team-member-form";
import { CreateTeamForm } from "@/features/teams/components/create-team-form";
import {
  ReactivateTeamForm,
  RemoveSupervisionForm,
  RenameTeamForm,
} from "@/features/teams/components/team-admin-forms";
import { disableTeamAction } from "@/features/teams/server/team-actions";
import {
  describeTeamDisableImpact,
  summarizeTeamMembers,
} from "@/features/teams/team-roster";
import { ReturnFocus } from "@/features/users/components/return-focus";
import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

const auditActionLabels: Record<string, string> = {
  TEAM_CREATED: "Equipo creado",
  TEAM_DISABLED: "Equipo deshabilitado",
  TEAM_REACTIVATED: "Equipo reactivado",
  TEAM_RENAMED: "Equipo renombrado",
  MEMBER_ASSIGNED: "Integrante asignado",
  MEMBER_REMOVED: "Supervisión retirada",
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function describeAudit(action: string, values: unknown): string | null {
  if (!values || typeof values !== "object") return null;
  const value = values as Record<string, unknown>;
  const parts: string[] = [];

  if (action === "TEAM_RENAMED" && typeof value["name"] === "string") {
    parts.push(`ahora «${value["name"]}»`);
  }
  if (typeof value["memberRole"] === "string") {
    parts.push(value["memberRole"] === "SUPERVISOR" ? "supervisión" : "asesor");
  }
  if (value["salesEnabled"] === true) parts.push("vende aquí");
  if (value["promotedToSupervisor"] === true) parts.push("promoción");
  if (value["reentered"] === true) parts.push("reingreso");
  if (value["isActive"] === false) parts.push("membresía cerrada");

  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Equipos — SPEC-001, SPEC-017 y SPEC-043 (UX-04 a UX-07, PE-05, PE-06).
 *
 * Cada tarjeta compara supervisión, plantilla y estado; al abrirla se
 * administra: asignar, renombrar, retirar una supervisión, deshabilitar con
 * las consecuencias por delante, o reactivar vacío. Los filtros viven en la
 * URL; `equipo=<id>` abre una tarjeta al llegar desde Personas.
 */
export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { membership } = await requireAdminAccess();
  const parameters = await searchParams;
  const creating = firstValue(parameters.nuevo) === "1";
  const query = firstValue(parameters.q).trim().slice(0, 100);
  const statusFilter = ["ACTIVE", "DISABLED"].includes(
    firstValue(parameters.estado),
  )
    ? firstValue(parameters.estado)
    : "";
  // SPEC-043 UX-04: el indicador «Sin supervisor» abre exactamente esta lista.
  const supervisionFilter =
    firstValue(parameters.sinSupervisor) === "1"
      ? "sin"
      : ["con", "sin"].includes(firstValue(parameters.supervision))
        ? firstValue(parameters.supervision)
        : "";
  const supervisorFilter = firstValue(parameters.supervisor)
    .trim()
    .slice(0, 50);
  const openTeamId = firstValue(parameters.equipo).trim().slice(0, 50);
  const organizationId = membership.organization.id;

  const [teams, candidates, openOrdersByTeam, openCasesByTeam, auditLogs] =
    await Promise.all([
      database.commercialTeam.findMany({
        where: { organizationId },
        orderBy: [{ status: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          members: {
            where: { isActive: true },
            orderBy: [{ memberRole: "desc" }, { user: { name: "asc" } }],
            select: {
              memberRole: true,
              salesEnabled: true,
              isPrimary: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      database.organizationMember.findMany({
        where: {
          organizationId,
          role: { in: ["AGENT", "SUPERVISOR"] },
          user: { status: "ACTIVE" },
        },
        orderBy: { user: { name: "asc" } },
        select: {
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              commercialTeamMemberships: {
                where: {
                  isActive: true,
                  team: { organizationId },
                },
                select: {
                  teamId: true,
                  memberRole: true,
                  salesEnabled: true,
                  isPrimary: true,
                  team: { select: { name: true, status: true } },
                },
              },
            },
          },
        },
      }),
      // SPEC-043 PE-06: cuánto trabajo abierto conserva el equipo si se
      // deshabilita. Se cuenta, no se mueve.
      database.ditoOrder.groupBy({
        by: ["assignedTeamId"],
        where: {
          organizationId,
          assignedTeamId: { not: null },
          status: { in: ["OPEN", "SENT", "UNKNOWN"] },
        },
        _count: { _all: true },
      }),
      database.recoveryCase.groupBy({
        by: ["assignedTeamId"],
        where: {
          organizationId,
          assignedTeamId: { not: null },
          status: {
            in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "SCHEDULED", "WAITING"],
          },
        },
        _count: { _all: true },
      }),
      // PE-05: el historial de cambios ya existía; aquí se lee.
      database.commercialTeamAuditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 300,
        select: {
          teamId: true,
          action: true,
          createdAt: true,
          newValues: true,
          actor: { select: { name: true } },
          targetUser: { select: { name: true } },
        },
      }),
    ]);

  const openOrdersOf = new Map(
    openOrdersByTeam.map((row) => [row.assignedTeamId, row._count._all]),
  );
  const openCasesOf = new Map(
    openCasesByTeam.map((row) => [row.assignedTeamId, row._count._all]),
  );
  const auditByTeam = new Map<string, typeof auditLogs>();
  for (const log of auditLogs) {
    const list = auditByTeam.get(log.teamId) ?? [];
    if (list.length < 8) list.push(log);
    auditByTeam.set(log.teamId, list);
  }
  const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
    timeZone: membership.organization.timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const toCandidate = (item: (typeof candidates)[number]) => {
    const activeMemberships = item.user.commercialTeamMemberships.filter(
      (teamMembership) => teamMembership.team.status === "ACTIVE",
    );
    const primaryTeam = activeMemberships.find(
      (teamMembership) =>
        teamMembership.salesEnabled && teamMembership.isPrimary,
    );

    return {
      id: item.user.id,
      name: item.user.name,
      email: item.user.email,
      currentTeamId: primaryTeam?.teamId ?? null,
      currentTeamName: primaryTeam?.team.name ?? null,
      activeTeamIds: activeMemberships.map(
        (teamMembership) => teamMembership.teamId,
      ),
    };
  };
  const agents = candidates
    .filter((item) => item.role === "AGENT")
    .map(toCandidate);
  const supervisors = candidates
    .filter((item) => item.role === "SUPERVISOR")
    .map(toCandidate);
  const activeTeams = teams.filter((team) => team.status === "ACTIVE");
  // SPEC-043 UX-05: rol y capacidad de venta no son lo mismo. Esto cuenta a
  // quien vende —asesores y supervisores vendedores—, sin repetir personas.
  const sellerIds = new Set(
    activeTeams.flatMap((team) =>
      summarizeTeamMembers(team.members, true).sellers.map(
        (member) => member.user.id,
      ),
    ),
  );
  const activeSupervisorIds = new Set(
    activeTeams.flatMap((team) =>
      summarizeTeamMembers(team.members, true).supervisors.map(
        (member) => member.user.id,
      ),
    ),
  );
  const teamsWithoutSupervisor = activeTeams.filter(
    (team) => summarizeTeamMembers(team.members, true).needsSupervisor,
  );
  // Supervisores que hoy supervisan algún equipo, para el filtro.
  const supervisorOptions = [
    ...new Map(
      activeTeams
        .flatMap((team) => summarizeTeamMembers(team.members, true).supervisors)
        .map((member) => [member.user.id, member.user.name] as const),
    ).entries(),
  ]
    .map(([id, name]) => ({ value: id, label: name }))
    .sort((left, right) => left.label.localeCompare(right.label, "es"));

  // UX-06: búsqueda por nombre, código o integrante; estado; supervisión.
  const normalizedQuery = query.toLocaleLowerCase("es");
  const visibleTeams = teams.filter((team) => {
    const roster = summarizeTeamMembers(team.members, team.status === "ACTIVE");
    const matchesQuery =
      !normalizedQuery ||
      team.name.toLocaleLowerCase("es").includes(normalizedQuery) ||
      (team.code ?? "").toLocaleLowerCase("es").includes(normalizedQuery) ||
      team.members.some(
        (member) =>
          member.user.name.toLocaleLowerCase("es").includes(normalizedQuery) ||
          member.user.email.toLocaleLowerCase("es").includes(normalizedQuery),
      );
    const matchesStatus = !statusFilter || team.status === statusFilter;
    const matchesSupervision =
      !supervisionFilter ||
      (supervisionFilter === "sin"
        ? roster.needsSupervisor
        : team.status === "ACTIVE" && roster.supervisors.length > 0);
    const matchesSupervisor =
      !supervisorFilter ||
      roster.supervisors.some((member) => member.user.id === supervisorFilter);

    return (
      matchesQuery && matchesStatus && matchesSupervision && matchesSupervisor
    );
  });
  const hasFilters = Boolean(
    query || statusFilter || supervisionFilter || supervisorFilter,
  );

  return (
    <>
      <div className="ui-page-stack">
        <ReturnFocus />
        <PageHeader
          description="Revisa la estructura comercial, detecta equipos sin supervisión y administra integrantes cuando sea necesario."
          eyebrow="Administración"
          meta={
            <Link
              className="ui-directory__manage"
              href={creating ? "/admin/teams" : "/admin/teams?nuevo=1"}
            >
              {creating ? "Cerrar" : "Nuevo equipo"}
            </Link>
          }
          title="Equipos comerciales"
        />

        <MetricGroup>
          <Metric
            emphasis="hero"
            label="Equipos activos"
            value={activeTeams.length}
          />
          <Metric
            hint="Asesores y supervisores que venden, en equipos activos"
            label="Personas habilitadas para vender"
            value={sellerIds.size}
          />
          <Metric
            hint="Con al menos un equipo activo a cargo"
            label="Supervisores"
            value={activeSupervisorIds.size}
          />
          <Metric
            hideWhenZero
            hint="Equipos activos sin ningún supervisor; abre la lista"
            href="/admin/teams?supervision=sin"
            label="Sin supervisor"
            tone="danger"
            value={teamsWithoutSupervisor.length}
          />
        </MetricGroup>

        {creating ? (
          <section
            aria-labelledby="nuevo-equipo-titulo"
            className="ui-admin-panel"
            style={{ position: "static" }}
          >
            <header className="ui-admin-panel__header">
              <div>
                <p className="ui-admin-panel__eyebrow">Crear</p>
                <h2 className="ui-admin-panel__title" id="nuevo-equipo-titulo">
                  Nuevo equipo
                </h2>
              </div>
              <Link className="ui-admin-panel__close" href="/admin/teams">
                Cerrar
              </Link>
            </header>
            <CreateTeamForm />
          </section>
        ) : null}

        <DirectoryFilters
          basePath="/admin/teams"
          preserve={{ nuevo: creating ? "1" : "" }}
          resultLabel={`${formatCount(visibleTeams.length)} ${visibleTeams.length === 1 ? "equipo" : "equipos"}`}
          search={{
            value: query,
            label: "Buscar equipo",
            placeholder: "Nombre, código o integrante",
          }}
          selects={[
            {
              key: "estado",
              label: "Estado",
              value: statusFilter,
              emptyLabel: "Todos",
              options: [
                { value: "ACTIVE", label: "Activos" },
                { value: "DISABLED", label: "Deshabilitados" },
              ],
            },
            {
              key: "supervision",
              label: "Supervisión",
              value: supervisionFilter,
              emptyLabel: "Cualquiera",
              options: [
                { value: "con", label: "Con supervisor" },
                { value: "sin", label: "Sin supervisor" },
              ],
            },
            {
              key: "supervisor",
              label: "Supervisor",
              value: supervisorFilter,
              emptyLabel: "Todos",
              options: supervisorOptions,
            },
          ]}
        />

        {visibleTeams.length === 0 ? (
          <EmptyState
            description={
              hasFilters
                ? "Prueba cambiando o limpiando los filtros."
                : "Crea el primer equipo para asignar supervisores y asesores."
            }
            title={
              hasFilters
                ? "Ningún equipo coincide"
                : "Aún no hay equipos comerciales"
            }
          />
        ) : (
          <section className="ui-team-list" aria-label="Equipos comerciales">
            {visibleTeams.map((team) => {
              const active = team.status === "ACTIVE";
              const roster = summarizeTeamMembers(team.members, active);
              const teamSupervisors = roster.supervisors;
              const teamAgents = roster.agents;
              const needsSupervisor = roster.needsSupervisor;
              const isOpen = team.id === openTeamId;
              const disableImpact = describeTeamDisableImpact({
                losingTeam: roster.sellers.map((member) => member.user.name),
                supervisionsClosed: teamSupervisors
                  .filter((member) => !member.salesEnabled)
                  .map((member) => member.user.name),
                openOrders: openOrdersOf.get(team.id) ?? 0,
                openCases: openCasesOf.get(team.id) ?? 0,
              });
              const history = auditByTeam.get(team.id) ?? [];

              return (
                <details
                  className="ui-team-overview scroll-mt-24"
                  id={`equipo-${team.id}`}
                  key={team.id}
                  open={isOpen || undefined}
                  tabIndex={-1}
                >
                  <summary>
                    <span className="ui-team-overview__identity">
                      <strong>{team.name}</strong>
                      <small>
                        {team.code ? `Código ${team.code} · ` : ""}
                        {formatCount(team.members.length)} integrantes activos
                      </small>
                    </span>
                    <span className="ui-team-overview__supervision">
                      <small>Supervisión</small>
                      <strong
                        className={needsSupervisor ? "text-ui-danger" : ""}
                      >
                        {needsSupervisor
                          ? "Sin supervisor"
                          : teamSupervisors
                              .map((item) => item.user.name)
                              .join(", ") || "No aplica"}
                      </strong>
                    </span>
                    <span className="ui-team-overview__count">
                      <strong>{formatCount(teamAgents.length)}</strong>
                      <small>
                        asesores
                        {roster.sellingSupervisors.length > 0
                          ? ` · ${formatCount(roster.sellingSupervisors.length)} supervisor(es) que venden`
                          : ""}
                      </small>
                    </span>
                    <StatusBadge tone={active ? "success" : "neutral"}>
                      {active ? "Activo" : "Deshabilitado"}
                    </StatusBadge>
                    <span
                      className="ui-team-overview__chevron"
                      aria-hidden="true"
                    >
                      ⌄
                    </span>
                  </summary>

                  <div className="ui-team-overview__body">
                    {needsSupervisor ? (
                      <div className="ui-team-warning">
                        <strong>Este equipo necesita supervisión.</strong>
                        <span>
                          Sin supervisor nadie ve ni gestiona sus ventas desde
                          supervisión. Abajo el formulario ya pide uno.
                        </span>
                      </div>
                    ) : null}

                    <div className="ui-team-members">
                      <section>
                        <header>
                          <span>Supervisores</span>
                          <strong>{formatCount(teamSupervisors.length)}</strong>
                        </header>
                        {teamSupervisors.length > 0 ? (
                          <ul>
                            {teamSupervisors.map((item) => (
                              <li key={item.user.id}>
                                {/* UX-07: del integrante a su panel en Personas. */}
                                <Link
                                  className="text-ui-accent underline-offset-2 hover:underline"
                                  href={`/admin/users?persona=${item.user.id}`}
                                >
                                  {item.user.name}
                                </Link>
                                <small>
                                  {item.user.email}
                                  {item.salesEnabled ? " · También vende" : ""}
                                </small>
                                {active ? (
                                  <RemoveSupervisionForm
                                    lastSupervisor={
                                      teamSupervisors.length === 1
                                    }
                                    sellsHere={item.salesEnabled}
                                    teamId={team.id}
                                    teamName={team.name}
                                    userId={item.user.id}
                                    userName={item.user.name}
                                  />
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>Sin supervisor asignado</p>
                        )}
                      </section>
                      <section>
                        <header>
                          <span>Asesores</span>
                          <strong>{formatCount(teamAgents.length)}</strong>
                        </header>
                        {teamAgents.length > 0 ? (
                          <ul>
                            {teamAgents.map((item) => (
                              <li key={item.user.id}>
                                <Link
                                  className="text-ui-accent underline-offset-2 hover:underline"
                                  href={`/admin/users?persona=${item.user.id}`}
                                >
                                  {item.user.name}
                                </Link>
                                <small>{item.user.email}</small>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>Sin asesores asignados</p>
                        )}
                      </section>
                    </div>

                    {active ? (
                      <div className="ui-team-overview__actions">
                        <details
                          className="ui-team-manage"
                          open={needsSupervisor || undefined}
                        >
                          <summary>
                            {needsSupervisor
                              ? "Asignar supervisor"
                              : "Agregar o trasladar integrante"}
                          </summary>
                          <div>
                            <AssignTeamMemberForm
                              agents={agents}
                              defaultMode={
                                needsSupervisor ? "SUPERVISOR" : "AGENT"
                              }
                              supervisors={supervisors}
                              teamId={team.id}
                              teamName={team.name}
                            />
                          </div>
                        </details>
                        <details className="ui-team-manage">
                          <summary>Renombrar</summary>
                          <div>
                            <RenameTeamForm
                              code={team.code}
                              name={team.name}
                              teamId={team.id}
                            />
                          </div>
                        </details>
                        <form action={disableTeamAction}>
                          <input name="teamId" type="hidden" value={team.id} />
                          <ConfirmSubmitButton
                            confirmLabel="Deshabilitar equipo"
                            description={
                              <ul className="space-y-1">
                                {disableImpact.map((line) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            }
                            title={`¿Deshabilitar ${team.name}?`}
                            triggerLabel="Deshabilitar"
                          />
                        </form>
                      </div>
                    ) : (
                      <div className="ui-team-overview__actions">
                        <ReactivateTeamForm
                          teamId={team.id}
                          teamName={team.name}
                        />
                      </div>
                    )}

                    {history.length > 0 ? (
                      <details className="ui-team-manage">
                        <summary>
                          Historial ({formatCount(history.length)})
                        </summary>
                        <div>
                          <ol className="space-y-1 text-xs">
                            {history.map((log, index) => {
                              const detail = describeAudit(
                                log.action,
                                log.newValues,
                              );
                              return (
                                <li
                                  key={`${log.createdAt.toISOString()}-${index}`}
                                >
                                  <span className="font-medium text-ui-text">
                                    {auditActionLabels[log.action] ??
                                      log.action}
                                  </span>
                                  {log.targetUser
                                    ? ` · ${log.targetUser.name}`
                                    : ""}
                                  {detail ? ` · ${detail}` : ""}
                                  <span className="text-ui-muted">
                                    {" "}
                                    · {dateTimeFormatter.format(
                                      log.createdAt,
                                    )}{" "}
                                    · {log.actor.name}
                                  </span>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      </details>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </section>
        )}
      </div>
    </>
  );
}
