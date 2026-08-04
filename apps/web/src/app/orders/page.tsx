import { OrderInbox } from "@/features/orders/components/order-inbox";

import { getOrderInbox } from "@/features/orders/server/get-order-inbox";

import { requireCommercialAccess } from "@/server/auth/access";

import { SignOutButton } from "./sign-out-button";

export default async function OrdersPage() {
  const { session, membership } = await requireCommercialAccess();

  const inbox = await getOrderInbox(membership.organization.id, {
    userId: session.user.id,
    role: membership.role,
  });

  return (
    <main className="min-h-screen bg-neutral-100">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm text-neutral-500">
              {membership.organization.name}
            </p>

            <h1 className="text-lg font-semibold text-neutral-950">
              Seguimiento de órdenes
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

      <div className="mx-auto max-w-7xl px-5 py-6 sm:py-8">
        <OrderInbox data={inbox} />
      </div>
    </main>
  );
}
