import { EmptyState } from "@repo/ui/empty-state";
import { ConfirmSubmitButton } from "@repo/ui/confirm-submit-button";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
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
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const agents = candidates.filter((item) => item.role === "AGENT").map((item) => item.user);
  const supervisors = candidates.filter((item) => item.role === "SUPERVISOR").map((item) => item.user);

  return (
    <CommercialAppShell activeSection="teams" organizationName={membership.organization.name} role={membership.role} signOut={<SignOutButton />} userName={session.user.name}>
      <div className="ui-page-stack">
        <PageHeader description="Organiza supervisores y asesores. Cada asesor operativo conserva un solo equipo principal activo." eyebrow="Administración" title="Equipos comerciales" />

        <section className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="self-start xl:sticky xl:top-8">
            <SectionPanel description="El nombre debe ser único entre los equipos activos de esta organización." title="Nuevo equipo">
              <CreateTeamForm />
            </SectionPanel>
          </div>

          <div className="space-y-4">
            {teams.length === 0 ? <EmptyState description="Crea el primer equipo para asignar supervisores y asesores." title="Aún no hay equipos comerciales" /> : null}
            {teams.map((team) => (
              <SectionPanel
                aside={team.status === "ACTIVE" ? (
                  <form action={disableTeamAction}>
                    <input name="teamId" type="hidden" value={team.id} />
                    <ConfirmSubmitButton confirmLabel="Deshabilitar equipo" description={`Se cerrarán ${team.members.length} membresías activas. Las órdenes y el historial existente se conservarán.`} title={`¿Deshabilitar ${team.name}?`} triggerLabel="Deshabilitar" />
                  </form>
                ) : null}
                description={`${team.code ? `Código ${team.code} · ` : ""}${team.members.length} integrantes activos`}
                key={team.id}
                title={team.name}
              >
                <div className="mb-4"><StatusBadge tone={team.status === "ACTIVE" ? "success" : "neutral"}>{team.status === "ACTIVE" ? "Activo" : "Deshabilitado"}</StatusBadge></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Supervisores</p>
                    <ul className="mt-2 space-y-1 text-sm text-neutral-700">{team.members.filter((item) => item.memberRole === "SUPERVISOR").map((item) => <li key={item.user.id}>{item.user.name}</li>)}{team.members.every((item) => item.memberRole !== "SUPERVISOR") ? <li className="text-neutral-400">Sin supervisor</li> : null}</ul>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Asesores</p>
                    <ul className="mt-2 space-y-1 text-sm text-neutral-700">{team.members.filter((item) => item.memberRole === "AGENT").map((item) => <li key={item.user.id}>{item.user.name}{item.isPrimary ? " · principal" : ""}</li>)}{team.members.every((item) => item.memberRole !== "AGENT") ? <li className="text-neutral-400">Sin asesores</li> : null}</ul>
                  </div>
                </div>
                {team.status === "ACTIVE" ? <div className="mt-4 border-t border-neutral-100 pt-4"><AssignTeamMemberForm agents={agents} supervisors={supervisors} teamId={team.id} /></div> : null}
              </SectionPanel>
            ))}
          </div>
        </section>
      </div>
    </CommercialAppShell>
  );
}
