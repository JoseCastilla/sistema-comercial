import Link from "next/link";

import { formatCount } from "@repo/ui/format";
import { ConfirmSubmitButton } from "@repo/ui/confirm-submit-button";
import { EmptyState } from "@repo/ui/empty-state";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";

import { AssignTeamMemberForm } from "@/features/teams/components/assign-team-member-form";
import { CreateTeamForm } from "@/features/teams/components/create-team-form";
import { disableTeamAction } from "@/features/teams/server/team-actions";
import {
  describeTeamDisableImpact,
  summarizeTeamMembers,
} from "@/features/teams/team-roster";
import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { membership } = await requireAdminAccess();
  const parameters = await searchParams;
  const creating =
    (Array.isArray(parameters.nuevo)
      ? parameters.nuevo[0]
      : parameters.nuevo) === "1";
  // SPEC-043 UX-04: el indicador «Sin supervisor» abre exactamente esta lista.
  const withoutSupervisorOnly =
    (Array.isArray(parameters.sinSupervisor)
      ? parameters.sinSupervisor[0]
      : parameters.sinSupervisor) === "1";
  const organizationId = membership.organization.id;
  const [teams, candidates, openOrdersByTeam, openCasesByTeam] =
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
    ]);

  const openOrdersOf = new Map(
    openOrdersByTeam.map((row) => [row.assignedTeamId, row._count._all]),
  );
  const openCasesOf = new Map(
    openCasesByTeam.map((row) => [row.assignedTeamId, row._count._all]),
  );

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
  const visibleTeams = withoutSupervisorOnly ? teamsWithoutSupervisor : teams;

  return (
    <>
      <div className="ui-page-stack">
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
            href="/admin/teams?sinSupervisor=1"
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

        {withoutSupervisorOnly ? (
          <p className="text-xs text-ui-muted">
            Mostrando solo los {formatCount(visibleTeams.length)} equipo(s)
            activos sin supervisor.{" "}
            <Link
              className="text-ui-accent underline-offset-2 hover:underline"
              href="/admin/teams"
            >
              Ver todos los equipos
            </Link>
          </p>
        ) : null}

        {visibleTeams.length === 0 ? (
          <EmptyState
            description={
              withoutSupervisorOnly
                ? "Todos los equipos activos tienen supervisor."
                : "Crea el primer equipo para asignar supervisores y asesores."
            }
            title={
              withoutSupervisorOnly
                ? "Nada pendiente"
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
              const disableImpact = describeTeamDisableImpact({
                losingTeam: roster.sellers.map((member) => member.user.name),
                supervisionsClosed: teamSupervisors
                  .filter((member) => !member.salesEnabled)
                  .map((member) => member.user.name),
                openOrders: openOrdersOf.get(team.id) ?? 0,
                openCases: openCasesOf.get(team.id) ?? 0,
              });

              return (
                <details className="ui-team-overview" key={team.id}>
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
                                <span>{item.user.name}</span>
                                <small>
                                  {item.user.email}
                                  {item.salesEnabled ? " · También vende" : ""}
                                </small>
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
                                <span>{item.user.name}</span>
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
