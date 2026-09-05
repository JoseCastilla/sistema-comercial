import Link from "next/link";
import Form from "next/form";
import { formatCount } from "@repo/ui/format";
import { EmptyState } from "@repo/ui/empty-state";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { CreateUserForm } from "@/features/users/components/create-user-form";
import { PersonLifecycleActions } from "@/features/users/components/person-lifecycle-actions";
import { getPersonLifecycleOverview } from "@/features/users/server/get-person-lifecycle-overview";
import { ResetUserPasswordForm } from "@/features/users/components/reset-user-password-form";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  BACKOFFICE: "Back office",
  AGENT: "Asesor",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Activo",
  INVITED: "Invitado",
  DISABLED: "Deshabilitado",
};

interface AdminUsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const { session, membership } = await requireAdminAccess();
  const organizationId = membership.organization.id;
  const parameters = await searchParams;
  const query = firstValue(parameters.q).trim().slice(0, 100);
  const roleFilter = firstValue(parameters.role);
  const statusFilter = firstValue(parameters.status);
  const teamFilter = firstValue(parameters.team);

  const [members, teams, lifecycle] = await Promise.all([
    database.organizationMember.findMany({
      where: { organizationId },
      orderBy: { user: { name: "asc" } },
      select: {
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            status: true,
            commercialTeamMemberships: {
              where: {
                isActive: true,
                team: { organizationId },
              },
              orderBy: [{ isPrimary: "desc" }, { team: { name: "asc" } }],
              select: {
                memberRole: true,
                salesEnabled: true,
                isPrimary: true,
                teamId: true,
                team: { select: { name: true, status: true } },
              },
            },
          },
        },
      },
    }),
    database.commercialTeam.findMany({
      where: { organizationId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getPersonLifecycleOverview(organizationId),
  ]);

  // SPEC-042: quién puede recibir la cartera de quien se va (asesores activos
  // con venta del mismo equipo) y qué equipos quedarían sin supervisor.
  const primaryTeamOf = (member: (typeof members)[number]) =>
    member.user.commercialTeamMemberships.find(
      (teamMembership) =>
        teamMembership.salesEnabled &&
        teamMembership.isPrimary &&
        teamMembership.team.status === "ACTIVE",
    )?.teamId ?? null;
  const activeSupervisorsByTeam = new Map<string, number>();
  for (const member of members) {
    if (member.user.status !== "ACTIVE") continue;
    for (const teamMembership of member.user.commercialTeamMemberships) {
      if (teamMembership.memberRole !== "SUPERVISOR") continue;
      activeSupervisorsByTeam.set(
        teamMembership.teamId,
        (activeSupervisorsByTeam.get(teamMembership.teamId) ?? 0) + 1,
      );
    }
  }

  const normalizedQuery = query.toLocaleLowerCase("es");
  const filteredMembers = members.filter((member) => {
    const matchesQuery =
      !normalizedQuery ||
      member.user.name.toLocaleLowerCase("es").includes(normalizedQuery) ||
      member.user.email.toLocaleLowerCase("es").includes(normalizedQuery);
    const matchesRole = !roleFilter || member.role === roleFilter;
    const matchesStatus = !statusFilter || member.user.status === statusFilter;
    const matchesTeam =
      !teamFilter ||
      member.user.commercialTeamMemberships.some(
        (teamMembership) => teamMembership.teamId === teamFilter,
      );

    return matchesQuery && matchesRole && matchesStatus && matchesTeam;
  });

  const activeUsers = members.filter(
    (member) => member.user.status === "ACTIVE",
  ).length;
  const agents = members.filter((member) => member.role === "AGENT");
  const supervisors = members.filter(
    (member) => member.role === "SUPERVISOR",
  ).length;
  const agentsWithoutTeam = agents.filter(
    (member) =>
      !member.user.commercialTeamMemberships.some(
        (teamMembership) =>
          teamMembership.salesEnabled &&
          teamMembership.isPrimary &&
          teamMembership.team.status === "ACTIVE",
      ),
  ).length;
  const hasFilters = Boolean(query || roleFilter || statusFilter || teamFilter);

  const dateFormatter = new Intl.DateTimeFormat("es-PE", {
    timeZone: membership.organization.timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <>
      <div className="ui-page-stack">
        <PageHeader
          description="Administra accesos, roles y equipos usando el correo corporativo como identidad operativa."
          eyebrow="Administración"
          meta={
            <>
              {activeUsers} de {formatCount(members.length)} personas activas
            </>
          }
          title="Personas"
        />

        <MetricGroup>
          <Metric emphasis="hero" label="Personas" value={members.length} />
          <Metric label="Asesores" value={agents.length} />
          <Metric label="Supervisores" value={supervisors} />
          <Metric
            hideWhenZero
            label="Asesores sin equipo"
            tone="danger"
            value={agentsWithoutTeam}
          />
        </MetricGroup>

        <details className="ui-admin-create">
          <summary>
            <span>
              <strong>Nueva persona</strong>
              <small>Crea una cuenta solo cuando la necesites.</small>
            </span>
            <span aria-hidden="true">+</span>
          </summary>
          <div className="ui-admin-create__body">
            <CreateUserForm />
          </div>
        </details>

        <SectionPanel
          description={`${formatCount(filteredMembers.length)} ${filteredMembers.length === 1 ? "resultado" : "resultados"}`}
          title="Directorio de la organización"
        >
          <Form action="/admin/users" className="ui-admin-toolbar">
            <label className="ui-admin-toolbar__search">
              <span className="sr-only">Buscar persona</span>
              <input
                defaultValue={query}
                maxLength={100}
                name="q"
                placeholder="Buscar por nombre o correo"
                type="search"
              />
            </label>
            <label>
              <span className="sr-only">Filtrar por rol</span>
              <select defaultValue={roleFilter} name="role">
                <option value="">Todos los roles</option>
                <option value="AGENT">Asesores</option>
                <option value="SUPERVISOR">Supervisores</option>
                <option value="BACKOFFICE">Back office</option>
                <option value="ADMIN">Administradores</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Filtrar por equipo</span>
              <select defaultValue={teamFilter} name="team">
                <option value="">Todos los equipos</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filtrar por estado</span>
              <select defaultValue={statusFilter} name="status">
                <option value="">Todos los estados</option>
                <option value="ACTIVE">Activos</option>
                <option value="INVITED">Invitados</option>
                <option value="DISABLED">Deshabilitados</option>
              </select>
            </label>
            <button className="ui-admin-toolbar__submit" type="submit">
              Filtrar
            </button>
            {hasFilters ? (
              <Link className="ui-admin-toolbar__clear" href="/admin/users">
                Limpiar
              </Link>
            ) : null}
          </Form>

          {filteredMembers.length === 0 ? (
            <EmptyState
              description={
                hasFilters
                  ? "Prueba cambiando o limpiando los filtros."
                  : "Crea la primera cuenta para comenzar a organizar la operación."
              }
              title={
                hasFilters
                  ? "No encontramos personas"
                  : "No existen personas registradas"
              }
            />
          ) : (
            <div className="ui-directory">
              <div className="ui-directory__header" aria-hidden="true">
                <span>Persona</span>
                <span>Rol</span>
                <span>Equipo</span>
                <span>Estado</span>
                <span />
              </div>
              {filteredMembers.map((member) => {
                const activeMemberships =
                  member.user.commercialTeamMemberships.filter(
                    (teamMembership) => teamMembership.team.status === "ACTIVE",
                  );
                const primaryTeam = activeMemberships.find(
                  (teamMembership) =>
                    teamMembership.salesEnabled && teamMembership.isPrimary,
                );
                const supervisedTeams = activeMemberships.filter(
                  (teamMembership) =>
                    teamMembership.memberRole === "SUPERVISOR",
                );
                const teamLabel = primaryTeam
                  ? primaryTeam.team.name
                  : supervisedTeams.length > 0
                    ? supervisedTeams
                        .map((teamMembership) => teamMembership.team.name)
                        .join(", ")
                    : "Sin equipo";

                return (
                  <article className="ui-directory__row" key={member.user.id}>
                    <div className="ui-directory__identity">
                      <p>{member.user.name}</p>
                      <span>{member.user.email}</span>
                      <small>
                        Desde {dateFormatter.format(member.createdAt)} ·{" "}
                        {member.user.emailVerified
                          ? "Correo verificado"
                          : "Correo pendiente"}
                      </small>
                    </div>
                    <div className="ui-directory__cell" data-label="Rol">
                      {roleLabels[member.role] ?? member.role}
                      {member.role === "SUPERVISOR" && primaryTeam
                        ? " · También vende"
                        : ""}
                    </div>
                    <div className="ui-directory__cell" data-label="Equipo">
                      <span
                        className={
                          teamLabel === "Sin equipo" ? "text-ui-warning" : ""
                        }
                      >
                        {teamLabel}
                      </span>
                    </div>
                    <div className="ui-directory__cell" data-label="Estado">
                      <StatusBadge
                        tone={
                          member.user.status === "ACTIVE"
                            ? "success"
                            : member.user.status === "INVITED"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {statusLabels[member.user.status] ?? member.user.status}
                      </StatusBadge>
                    </div>
                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                      <ResetUserPasswordForm
                        isCurrentUser={member.user.id === session.user.id}
                        userEmail={member.user.email}
                        userId={member.user.id}
                      />
                      <PersonLifecycleActions
                        destinationCandidates={members
                          .filter(
                            (candidate) =>
                              candidate.user.id !== member.user.id &&
                              candidate.user.status === "ACTIVE" &&
                              primaryTeam !== undefined &&
                              primaryTeamOf(candidate) === primaryTeam.teamId,
                          )
                          .map((candidate) => ({
                            id: candidate.user.id,
                            name: candidate.user.name,
                          }))}
                        history={lifecycle.history.get(member.user.id) ?? []}
                        isCurrentUser={member.user.id === session.user.id}
                        overview={
                          lifecycle.counts.get(member.user.id) ?? {
                            openOrders: 0,
                            internalCases: 0,
                            campaignCases: 0,
                          }
                        }
                        person={{
                          id: member.user.id,
                          name: member.user.name,
                          email: member.user.email,
                          role: member.role,
                          status: member.user.status,
                          primaryTeamId: primaryTeam?.teamId ?? null,
                          primaryTeamName: primaryTeam?.team.name ?? null,
                          teamsLeftWithoutSupervisor: supervisedTeams
                            .filter(
                              (teamMembership) =>
                                (activeSupervisorsByTeam.get(
                                  teamMembership.teamId,
                                ) ?? 0) <= 1,
                            )
                            .map((teamMembership) => teamMembership.team.name),
                        }}
                        teams={teams}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionPanel>
      </div>
    </>
  );
}
