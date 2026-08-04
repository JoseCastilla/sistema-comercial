import { CommercialAppShell } from "@/components/layout/commercial-app-shell";

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
    <CommercialAppShell
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <OrderInbox data={inbox} />
    </CommercialAppShell>
  );
}
