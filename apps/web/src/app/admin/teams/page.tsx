import { ConfirmSubmitButton } from "@repo/ui/confirm-submit-button";
import { EmptyState } from "@repo/ui/empty-state";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";

import { SignOutButton } from "@/app/orders/sign-out-button";
import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { AssignTeamMemberForm } from "@/features/teams/components/assign-team-member-form";
import { CreateTeamForm } from "@/features/teams/components/create-team-form";
import { disableTeamAction } from "@/features/teams/server/team-actions";
import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

export default async function AdminTeamsPage() {
  const { session, membership } = await requireAdminAccess();
  const organizationId = membership.organization.id;
  const [teams, candidates] = await Promise.all([
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
  ]);

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
  const activeAgentIds = new Set(
    activeTeams.flatMap((team) =>
      team.members
        .filter((member) => member.salesEnabled)
        .map((member) => member.user.id),
    ),
  );
  const teamsWithoutSupervisor = activeTeams.filter((team) =>
    team.members.every((member) => member.memberRole !== "SUPERVISOR"),
  ).length;

  return (
    <CommercialAppShell
      activeSection="teams"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <div className="ui-page-stack">
        <PageHeader
          description="Revisa la estructura comercial, detecta equipos sin supervisión y administra integrantes cuando sea necesario."
          eyebrow="Administración"
          title="Equipos comerciales"
        />

        <MetricGroup>
          <Metric label="Equipos activos" value={activeTeams.length} />
          <Metric label="Asesores asignados" value={activeAgentIds.size} />
          <Metric label="Supervisores disponibles" value={supervisors.length} />
          <Metric
            label="Sin supervisor"
            tone={teamsWithoutSupervisor > 0 ? "danger" : "neutral"}
            value={teamsWithoutSupervisor}
          />
        </MetricGroup>

        <details className="ui-admin-create">
          <summary>
            <span>
              <strong>Nuevo equipo</strong>
              <small>
                Crea otro equipo sin interrumpir la revisión actual.
              </small>
            </span>
            <span aria-hidden="true">+</span>
          </summary>
          <div className="ui-admin-create__body">
            <CreateTeamForm />
          </div>
        </details>

        {teams.length === 0 ? (
          <EmptyState
            description="Crea el primer equipo para asignar supervisores y asesores."
            title="Aún no hay equipos comerciales"
          />
        ) : (
          <section className="ui-team-list" aria-label="Equipos comerciales">
            {teams.map((team) => {
              const teamSupervisors = team.members.filter(
                (member) => member.memberRole === "SUPERVISOR",
              );
              const teamAgents = team.members.filter(
                (member) => member.memberRole === "AGENT",
              );
              const active = team.status === "ACTIVE";
              const needsSupervisor = active && teamSupervisors.length === 0;

              return (
                <details className="ui-team-overview" key={team.id}>
                  <summary>
                    <span className="ui-team-overview__identity">
                      <strong>{team.name}</strong>
                      <small>
                        {team.code ? `Código ${team.code} · ` : ""}
                        {team.members.length} integrantes activos
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
                      <strong>{teamAgents.length}</strong>
                      <small>asesores</small>
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
                          Asigna un supervisor para habilitar correctamente su
                          alcance operativo y seguimiento.
                        </span>
                      </div>
                    ) : null}

                    <div className="ui-team-members">
                      <section>
                        <header>
                          <span>Supervisores</span>
                          <strong>{teamSupervisors.length}</strong>
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
                          <strong>{teamAgents.length}</strong>
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
                        <details className="ui-team-manage">
                          <summary>Agregar o trasladar integrante</summary>
                          <div>
                            <AssignTeamMemberForm
                              agents={agents}
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
                            description={`Se cerrarán ${team.members.length} membresías activas. Las órdenes y el historial existente se conservarán.`}
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
    </CommercialAppShell>
  );
}
