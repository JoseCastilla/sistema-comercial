import { CommercialAppShell } from "@/components/layout/commercial-app-shell";

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

function getStatusClasses(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "INVITED":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "DISABLED":
      return "border-neutral-300 bg-neutral-100 text-neutral-600";

    default:
      return "border-neutral-200 bg-neutral-50 text-neutral-600";
  }
}

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
      activeSection="team"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <div className="space-y-6">
        <section>
          <p className="text-sm font-medium text-neutral-500">Administración</p>

          <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                Equipo y usuarios
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                Crea cuentas y administra quién tiene acceso a la organización.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Usuarios activos
              </p>

              <p className="mt-1 text-2xl font-semibold text-neutral-950">
                {activeUsers}
                <span className="text-sm font-normal text-neutral-500">
                  {" "}
                  de {members.length}
                </span>
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <article className="self-start rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm xl:sticky xl:top-8">
            <h2 className="font-semibold text-neutral-950">Crear usuario</h2>

            <p className="mt-1 text-sm leading-6 text-neutral-500">
              La cuenta quedará activa inmediatamente y vinculada a esta
              organización.
            </p>

            <div className="mt-5">
              <CreateUserForm />
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="font-semibold text-neutral-950">
                Miembros de la organización
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                Revisa las cuentas, roles y estados vigentes.
              </p>
            </div>

            {members.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="font-medium text-neutral-900">
                  No existen usuarios registrados
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {members.map((member) => (
                  <div
                    className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_150px_120px_190px] sm:items-center"
                    key={member.user.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-950">
                        {member.user.name}
                      </p>

                      <p className="mt-1 truncate text-sm text-neutral-500">
                        {member.user.email}
                      </p>

                      <p className="mt-1 text-xs text-neutral-400">
                        Miembro desde {dateFormatter.format(member.createdAt)}
                        {" · "}
                        {member.user.emailVerified
                          ? "Correo verificado"
                          : "Correo pendiente"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                        Rol
                      </p>

                      <p className="mt-1 text-sm font-medium text-neutral-800">
                        {roleLabels[member.role] ?? member.role}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <span
                        className={[
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                          getStatusClasses(member.user.status),
                        ].join(" ")}
                      >
                        {statusLabels[member.user.status] ?? member.user.status}
                      </span>
                    </div>

                    <ResetUserPasswordForm
                      isCurrentUser={member.user.id === session.user.id}
                      userEmail={member.user.email}
                      userId={member.user.id}
                    />
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      </div>
    </CommercialAppShell>
  );
}
