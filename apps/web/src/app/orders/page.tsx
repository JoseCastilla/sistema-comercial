import { requireCommercialAccess } from "@/server/auth/access";

import { SignOutButton } from "./sign-out-button";

export default async function OrdersPage() {
  const { session, membership } = await requireCommercialAccess();

  return (
    <main className="min-h-screen bg-neutral-100">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm text-neutral-500">
              {membership.organization.name}
            </p>

            <h1 className="text-lg font-semibold text-neutral-950">
              Bandeja de pedidos
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-neutral-900">
                {session.user.name}
              </p>

              <p className="text-xs text-neutral-500">{membership.role}</p>
            </div>

            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-950">
            Pedidos DITO
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            La autenticación y la autorización están funcionando. En el
            siguiente paso cargaremos aquí las órdenes pendientes de asociación.
          </p>
        </div>
      </section>
    </main>
  );
}
