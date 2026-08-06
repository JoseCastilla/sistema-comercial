import { CommercialAppShell } from "@/components/layout/commercial-app-shell";

import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { AssignAgentAliasForm } from "@/features/users/components/assign-agent-alias-form";
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

export default async function AdminUsersPage() {
  const { session, membership } = await requireAdminAccess();

  const members = await database.organizationMember.findMany({
    where: {
      organizationId: membership.organization.id,
    },

    orderBy: [
      {
        role: "asc",
      },
      {
        createdAt: "asc",
      },
    ],

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

          agentAliases: {
            where: {
              organizationId: membership.organization.id,
              isActive: true,
            },

            orderBy: {
              alias: "asc",
            },

            select: {
              id: true,
              alias: true,
              normalizedAlias: true,
            },
          },
        },
      },
    },
  });

  const dateFormatter = new Intl.DateTimeFormat("es-PE", {
    timeZone: membership.organization.timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const activeUsers = members.filter((member) => {
    return member.user.status === "ACTIVE";
  }).length;

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
          description="Crea cuentas, administra permisos y vincula asesores con los nombres recibidos desde DITO."
          eyebrow="Administración"
          meta={<>{activeUsers} de {members.length} personas activas</>}
          title="Personas"
        />

        <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="self-start xl:sticky xl:top-8">
            <SectionPanel description="La cuenta quedará activa inmediatamente y vinculada a esta organización." title="Nueva persona">
              <CreateUserForm />
            </SectionPanel>
          </div>

          <SectionPanel description="Revisa las cuentas, roles, estados y vínculos DITO." title="Personas de la organización">
            {members.length === 0 ? (
              <EmptyState description="Crea la primera cuenta para comenzar a organizar la operación." title="No existen personas registradas" />
            ) : (
              <div className="divide-y divide-neutral-100">
                {members.map((member) => (
                  <article
                    className="grid gap-4 px-1 py-4 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-start"
                    key={member.user.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-950">
                        {member.user.name}
                      </p>

                      <p className="mt-1 truncate text-sm text-neutral-500">
                        {member.user.email}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-neutral-400">
                        Miembro desde {dateFormatter.format(member.createdAt)}
                        {" · "}
                        {member.user.emailVerified
                          ? "Correo verificado"
                          : "Correo pendiente"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-neutral-600">
                          {roleLabels[member.role] ?? member.role}
                        </span>
                        <StatusBadge tone={member.user.status === "ACTIVE" ? "success" : member.user.status === "INVITED" ? "warning" : "neutral"}>
                          {statusLabels[member.user.status] ?? member.user.status}
                        </StatusBadge>
                      </div>
                    </div>

                    <ResetUserPasswordForm
                      isCurrentUser={member.user.id === session.user.id}
                      userEmail={member.user.email}
                      userId={member.user.id}
                    />

                    {member.role === "AGENT" ? (
                      <div className="sm:col-span-2">
                        <AssignAgentAliasForm
                          aliases={member.user.agentAliases}
                          userId={member.user.id}
                          userName={member.user.name}
                        />
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </SectionPanel>
        </section>
      </div>
    </CommercialAppShell>
  );
}
