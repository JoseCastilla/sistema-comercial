import Link from "next/link";
import { redirect } from "next/navigation";

import { formatCount } from "@repo/ui/format";
import { EmptyState } from "@repo/ui/empty-state";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";

import { CreateAgentForm } from "@/features/teams/components/create-agent-form";
import { summarizeTeamMembers } from "@/features/teams/team-roster";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

/**
 * Mi equipo — SPEC-043 PE-07 (BR-014), sobre SPEC-001 BR-011 a BR-013.
 *
 * La superficie del supervisor: sus equipos activos y sus integrantes en
 * lectura, y una sola acción, «Nuevo asesor», limitada a esos equipos y al
 * rol asesor. Administración tiene Equipos para lo demás; un asesor no tiene
 * nada que administrar aquí.
 */
export default async function MyTeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, membership } = await requireCommercialAccess();

  if (membership.role === "ADMIN") redirect("/admin/teams");
  if (membership.role !== "SUPERVISOR") redirect("/access-denied");

  const parameters = await searchParams;
  const nuevo = Array.isArray(parameters.nuevo)
    ? parameters.nuevo[0]
    : parameters.nuevo;
  const creating = nuevo === "1";

  const teams = await database.commercialTeam.findMany({
    where: {
      organizationId: membership.organization.id,
      status: "ACTIVE",
      members: {
        some: {
          userId: session.user.id,
          memberRole: "SUPERVISOR",
          isActive: true,
        },
      },
    },
    orderBy: { name: "asc" },
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
          user: { select: { id: true, name: true, email: true, status: true } },
        },
      },
    },
  });

  const rosters = teams.map((team) => ({
    team,
    roster: summarizeTeamMembers(team.members, true),
  }));
  const agentCount = new Set(
    rosters.flatMap(({ roster }) => roster.agents.map((m) => m.user.id)),
  ).size;
  const sellerCount = new Set(
    rosters.flatMap(({ roster }) => roster.sellers.map((m) => m.user.id)),
  ).size;
  const teamOptions = teams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="ui-page-stack">
      <PageHeader
        description="Los equipos que supervisas y quiénes venden en ellos. Aquí das de alta a un asesor nuevo; lo demás lo administra administración."
        eyebrow="Supervisión"
        meta={
          teams.length > 0 ? (
            <Link
              className="ui-directory__manage"
              href={creating ? "/team" : "/team?nuevo=1"}
            >
              {creating ? "Cerrar" : "Nuevo asesor"}
            </Link>
          ) : undefined
        }
        title="Mi equipo"
      />

      <MetricGroup>
        <Metric emphasis="hero" label="Equipos a cargo" value={teams.length} />
        <Metric
          hint="Con función asesor en tus equipos"
          label="Asesores"
          value={agentCount}
        />
        <Metric
          hint="Asesores y supervisores que venden, sin repetir"
          label="Personas habilitadas para vender"
          value={sellerCount}
        />
      </MetricGroup>

      {creating && teams.length > 0 ? (
        <section
          aria-labelledby="nuevo-asesor-titulo"
          className="ui-admin-panel"
          style={{ position: "static" }}
        >
          <header className="ui-admin-panel__header">
            <div>
              <p className="ui-admin-panel__eyebrow">Alta</p>
              <h2 className="ui-admin-panel__title" id="nuevo-asesor-titulo">
                Nuevo asesor
              </h2>
              <p className="ui-admin-panel__email">
                Entra como asesor de uno de tus equipos, con venta habilitada.
                Nada más se puede elegir desde aquí.
              </p>
            </div>
            <Link className="ui-admin-panel__close" href="/team">
              Cerrar
            </Link>
          </header>
          <CreateAgentForm teams={teamOptions} />
        </section>
      ) : null}

      {teams.length === 0 ? (
        <EmptyState
          description="Todavía no supervisas ningún equipo activo. Pide a administración que te asigne uno en Equipos."
          title="Sin equipos a cargo"
        />
      ) : (
        <section className="ui-team-list" aria-label="Mis equipos">
          {rosters.map(({ team, roster }) => (
            <details className="ui-team-overview" key={team.id} open>
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
                  <strong>
                    {roster.supervisors.map((m) => m.user.name).join(", ")}
                  </strong>
                </span>
                <span className="ui-team-overview__count">
                  <strong>{formatCount(roster.agents.length)}</strong>
                  <small>
                    asesores
                    {roster.sellingSupervisors.length > 0
                      ? ` · ${formatCount(roster.sellingSupervisors.length)} supervisor(es) que venden`
                      : ""}
                  </small>
                </span>
                <StatusBadge tone="success">Activo</StatusBadge>
                <span className="ui-team-overview__chevron" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <div className="ui-team-overview__body">
                <div className="ui-team-members">
                  <section>
                    <header>
                      <span>Supervisores</span>
                      <strong>{formatCount(roster.supervisors.length)}</strong>
                    </header>
                    <ul>
                      {roster.supervisors.map((item) => (
                        <li key={item.user.id}>
                          <span>{item.user.name}</span>
                          <small>
                            {item.user.email}
                            {item.salesEnabled ? " · También vende" : ""}
                          </small>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <header>
                      <span>Asesores</span>
                      <strong>{formatCount(roster.agents.length)}</strong>
                    </header>
                    {roster.agents.length > 0 ? (
                      <ul>
                        {roster.agents.map((item) => (
                          <li key={item.user.id}>
                            <span>{item.user.name}</span>
                            <small>
                              {item.user.email}
                              {item.user.status !== "ACTIVE"
                                ? " · cuenta no activa"
                                : ""}
                            </small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Sin asesores todavía: da de alta al primero arriba.</p>
                    )}
                  </section>
                </div>
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
