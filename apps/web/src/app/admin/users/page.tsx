import Link from "next/link";
import Form from "next/form";
import { formatCount } from "@repo/ui/format";
import { EmptyState } from "@repo/ui/empty-state";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { CreateUserForm } from "@/features/users/components/create-user-form";
import { PersonAdminPanel } from "@/features/users/components/person-admin-panel";
import { ReturnFocus } from "@/features/users/components/return-focus";
import {
  personRoleLabels,
  personStatusLabels,
  personStatusTones,
} from "@/features/users/person-labels";
import { getPersonLifecycleOverview } from "@/features/users/server/get-person-lifecycle-overview";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

interface AdminUsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Personas — SPEC-017, SPEC-042 y SPEC-043 (UX-01 a UX-03).
 *
 * La lista compara: nombre, rol, equipo y estado por fila, y una sola acción,
 * «Administrar». El panel lateral administra: una persona a la vez, elegida
 * en la URL (`persona=`), de modo que los filtros y la posición sobreviven y
 * el enlace se puede compartir. Crear también vive en el panel (`nueva=1`).
 */
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
  const openPersonId = firstValue(parameters.persona).trim().slice(0, 50);
  const creating = firstValue(parameters.nueva) === "1";

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

  type Member = (typeof members)[number];

  const activeMembershipsOf = (member: Member) =>
    member.user.commercialTeamMemberships.filter(
      (teamMembership) => teamMembership.team.status === "ACTIVE",
    );
  const primaryTeamOf = (member: Member) =>
    activeMembershipsOf(member).find(
      (teamMembership) =>
        teamMembership.salesEnabled && teamMembership.isPrimary,
    ) ?? null;
  const supervisedTeamsOf = (member: Member) =>
    activeMembershipsOf(member).filter(
      (teamMembership) => teamMembership.memberRole === "SUPERVISOR",
    );

  // SPEC-042: qué equipos quedarían sin ningún supervisor si alguien se va.
  const activeSupervisorsByTeam = new Map<string, number>();
  for (const member of members) {
    if (member.user.status !== "ACTIVE") continue;
    for (const teamMembership of supervisedTeamsOf(member)) {
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
  // Un asesor sin equipo primario de venta está incompleto (SPEC-001 BR-007);
  // administración y back office no requieren equipo y no cuentan aquí.
  const agentsWithoutTeam = agents.filter(
    (member) => primaryTeamOf(member) === null,
  ).length;
  const hasFilters = Boolean(query || roleFilter || statusFilter || teamFilter);

  const dateFormatter = new Intl.DateTimeFormat("es-PE", {
    timeZone: membership.organization.timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Los enlaces conservan los filtros: abrir o cerrar el panel no mueve la
  // lista ni pierde la búsqueda.
  const directoryHref = (overrides: {
    persona?: string | null;
    nueva?: boolean;
    hash?: string;
  }): string => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (roleFilter) next.set("role", roleFilter);
    if (teamFilter) next.set("team", teamFilter);
    if (statusFilter) next.set("status", statusFilter);
    if (overrides.persona) next.set("persona", overrides.persona);
    if (overrides.nueva) next.set("nueva", "1");
    const search = next.toString();
    return `/admin/users${search ? `?${search}` : ""}${overrides.hash ?? ""}`;
  };

  const openMember = openPersonId
    ? (members.find((member) => member.user.id === openPersonId) ?? null)
    : null;
  const panelOpen = creating || openMember !== null;

  return (
    <div className="ui-page-stack">
      <ReturnFocus />
      <PageHeader
        description="Administra accesos, roles y equipos usando el correo corporativo como identidad operativa."
        eyebrow="Administración"
        meta={
          <span className="flex flex-wrap items-center justify-end gap-3">
            <span>
              {activeUsers} de {formatCount(members.length)} personas activas
            </span>
            <Link
              className="ui-directory__manage"
              href={
                creating ? directoryHref({}) : directoryHref({ nueva: true })
              }
            >
              {creating ? "Cerrar" : "Nueva persona"}
            </Link>
          </span>
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

      <div
        className="ui-admin-workspace"
        data-open={panelOpen ? "true" : "false"}
      >
        <SectionPanel
          description={`${formatCount(filteredMembers.length)} ${filteredMembers.length === 1 ? "resultado" : "resultados"}`}
          title="Directorio de la organización"
        >
          <Form action="/admin/users" className="ui-admin-toolbar">
            {openMember ? (
              <input name="persona" type="hidden" value={openMember.user.id} />
            ) : null}
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
                const primaryTeam = primaryTeamOf(member);
                const supervisedTeams = supervisedTeamsOf(member);
                const requiresTeam =
                  member.role === "AGENT" || member.role === "SUPERVISOR";
                const teamLabel = primaryTeam
                  ? primaryTeam.team.name
                  : supervisedTeams.length > 0
                    ? supervisedTeams
                        .map((teamMembership) => teamMembership.team.name)
                        .join(", ")
                    : requiresTeam
                      ? "Sin equipo"
                      : "No requiere equipo";
                const isOpen = openMember?.user.id === member.user.id;

                return (
                  <article
                    aria-current={isOpen ? "true" : undefined}
                    className="ui-directory__row"
                    id={`persona-${member.user.id}`}
                    key={member.user.id}
                    tabIndex={-1}
                  >
                    <div className="ui-directory__identity">
                      <p title={member.user.name}>{member.user.name}</p>
                      <span>{member.user.email}</span>
                    </div>
                    <div className="ui-directory__cell" data-label="Rol">
                      {personRoleLabels[member.role] ?? member.role}
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
                          personStatusTones[member.user.status] ?? "neutral"
                        }
                      >
                        {personStatusLabels[member.user.status] ??
                          member.user.status}
                      </StatusBadge>
                    </div>
                    <Link
                      aria-expanded={isOpen}
                      className="ui-directory__manage"
                      href={
                        isOpen
                          ? directoryHref({
                              hash: `#persona-${member.user.id}`,
                            })
                          : directoryHref({ persona: member.user.id })
                      }
                    >
                      {isOpen ? "Cerrar" : "Administrar"}
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </SectionPanel>

        {creating ? (
          <aside
            aria-labelledby="nueva-persona-titulo"
            className="ui-admin-panel"
          >
            <header className="ui-admin-panel__header">
              <div>
                <p className="ui-admin-panel__eyebrow">Crear</p>
                <h2 className="ui-admin-panel__title" id="nueva-persona-titulo">
                  Nueva persona
                </h2>
                <p className="ui-admin-panel__email">
                  Crea una cuenta solo cuando la necesites.
                </p>
              </div>
              <Link className="ui-admin-panel__close" href={directoryHref({})}>
                Cerrar
              </Link>
            </header>
            <CreateUserForm />
          </aside>
        ) : openMember ? (
          (() => {
            const primaryTeam = primaryTeamOf(openMember);
            const supervisedTeams = supervisedTeamsOf(openMember);

            return (
              <PersonAdminPanel
                closeHref={directoryHref({
                  hash: `#persona-${openMember.user.id}`,
                })}
                destinationCandidates={members
                  .filter(
                    (candidate) =>
                      candidate.user.id !== openMember.user.id &&
                      candidate.user.status === "ACTIVE" &&
                      primaryTeam !== null &&
                      primaryTeamOf(candidate)?.teamId === primaryTeam.teamId,
                  )
                  .map((candidate) => ({
                    id: candidate.user.id,
                    name: candidate.user.name,
                  }))}
                history={lifecycle.history.get(openMember.user.id) ?? []}
                isCurrentUser={openMember.user.id === session.user.id}
                overview={
                  lifecycle.counts.get(openMember.user.id) ?? {
                    openOrders: 0,
                    internalCases: 0,
                    campaignCases: 0,
                  }
                }
                person={{
                  id: openMember.user.id,
                  name: openMember.user.name,
                  email: openMember.user.email,
                  role: openMember.role,
                  status: openMember.user.status,
                  primaryTeamId: primaryTeam?.teamId ?? null,
                  primaryTeamName: primaryTeam?.team.name ?? null,
                  teamsLeftWithoutSupervisor: supervisedTeams
                    .filter(
                      (teamMembership) =>
                        (activeSupervisorsByTeam.get(teamMembership.teamId) ??
                          0) <= 1,
                    )
                    .map((teamMembership) => teamMembership.team.name),
                  emailVerified: openMember.user.emailVerified,
                  sinceLabel: dateFormatter.format(openMember.createdAt),
                  supervisedTeamNames: supervisedTeams.map(
                    (teamMembership) => teamMembership.team.name,
                  ),
                }}
                teams={teams}
              />
            );
          })()
        ) : null}
      </div>
    </div>
  );
}
