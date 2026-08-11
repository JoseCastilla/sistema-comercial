import { CommercialAppShell } from "@/components/layout/commercial-app-shell";

import { EmptyState } from "@repo/ui/empty-state";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { CreateUserForm } from "@/features/users/components/create-user-form";
import { ResetUserPasswordForm } from "@/features/users/components/reset-user-password-form";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import { SignOutButton } from "@/app/orders/sign-out-button";

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

  const [members, teams] = await Promise.all([
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
  ]);

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
          teamMembership.memberRole === "AGENT" &&
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
    <CommercialAppShell
      activeSection="people"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <div className="ui-page-stack">
        <PageHeader
          description="Administra accesos, roles y equipos usando el correo corporativo como identidad operativa."
          eyebrow="Administración"
          meta={
            <>
              {activeUsers} de {members.length} personas activas
            </>
          }
          title="Personas"
        />

        <MetricGroup>
          <Metric label="Personas" value={members.length} />
          <Metric label="Asesores" value={agents.length} />
          <Metric label="Supervisores" value={supervisors} />
          <Metric
            label="Asesores sin equipo"
            tone={agentsWithoutTeam > 0 ? "danger" : "neutral"}
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
          description={`${filteredMembers.length} ${filteredMembers.length === 1 ? "resultado" : "resultados"}`}
          title="Directorio de la organización"
        >
          <form className="ui-admin-toolbar" method="get">
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
              <a className="ui-admin-toolbar__clear" href="/admin/users">
                Limpiar
              </a>
            ) : null}
          </form>

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
                    teamMembership.memberRole === "AGENT" &&
                    teamMembership.isPrimary,
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
                    <ResetUserPasswordForm
                      isCurrentUser={member.user.id === session.user.id}
                      userEmail={member.user.email}
                      userId={member.user.id}
                    />
                  </article>
                );
              })}
            </div>
          )}
        </SectionPanel>
      </div>
    </CommercialAppShell>
  );
}
