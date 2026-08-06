import { CommercialAppShell } from "@/components/layout/commercial-app-shell";

import { parseOrderPeriod } from "@repo/validation";

import { OrderInbox } from "@/features/orders/components/order-inbox";

import { getOrderInbox } from "@/features/orders/server/get-order-inbox";

import { requireCommercialAccess } from "@/server/auth/access";

import { SignOutButton } from "./sign-out-button";

import type { OrderFilter } from "@/features/orders/order-inbox.types";

interface OrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseOrderFilter(value: string | undefined): OrderFilter {
  return [
    "ACTIVE",
    "INCIDENTS",
    "RECOVERY",
    "DELIVERED",
    "FINAL",
    "ALL",
  ].includes(value ?? "")
    ? (value as OrderFilter)
    : "ALL";
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { session, membership } = await requireCommercialAccess();
  const parameters = await searchParams;
  const period = parseOrderPeriod(firstValue(parameters.period));
  const rawPage = Number(firstValue(parameters.page));
  const filter = parseOrderFilter(firstValue(parameters.status));
  const search = firstValue(parameters.q)?.trim().slice(0, 100) ?? "";

  const inbox = await getOrderInbox(
    membership.organization.id,
    {
      userId: session.user.id,
      role: membership.role,
    },
    {
      period,
      page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
      filter,
      search,
    },
  );

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
