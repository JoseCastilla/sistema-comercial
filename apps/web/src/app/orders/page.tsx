import { after } from "next/server";

import { parseOrderPeriod, parseOrderRange } from "@repo/validation";

import { OrderInbox } from "@/features/orders/components/order-inbox";

import { getOrderInbox } from "@/features/orders/server/get-order-inbox";
import { maybeRunScheduledAgrDeliverySync } from "@/features/agr-delivery/server/agr-delivery-sync";

import { requireCommercialAccess } from "@/server/auth/access";

import type { OrderFilter } from "@/features/orders/order-inbox.types";

interface OrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseOrderFilter(
  value: string | undefined,
  fallback: OrderFilter,
): OrderFilter {
  return [
    "ACTIVE",
    "ESCALATIONS",
    "LOGISTICS",
    "INCIDENTS",
    "RECOVERY",
    "AWAITING_ACTIVATION",
    "DELIVERED",
    "FINAL",
    "ALL",
  ].includes(value ?? "")
    ? (value as OrderFilter)
    : fallback;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { session, membership } = await requireCommercialAccess();
  const parameters = await searchParams;
  const requestedPeriod = parseOrderPeriod(firstValue(parameters.period));
  const requestedRange = parseOrderRange(
    firstValue(parameters.from),
    firstValue(parameters.to),
  );
  const period =
    requestedPeriod === "RANGE" && !requestedRange ? "MONTH" : requestedPeriod;
  const rawPage = Number(firstValue(parameters.page));
  const filter = parseOrderFilter(
    firstValue(parameters.status),
    membership.role === "AGENT" ? "ACTIVE" : "ALL",
  );
  const search = firstValue(parameters.q)?.trim().slice(0, 100) ?? "";
  const team = firstValue(parameters.team)?.trim().slice(0, 50);
  const advisor = firstValue(parameters.advisor)?.trim().slice(0, 50);

  after(async () => {
    await maybeRunScheduledAgrDeliverySync(membership.organization.id).catch(
      () => undefined,
    );
  });

  const inbox = await getOrderInbox(
    membership.organization.id,
    {
      userId: session.user.id,
      role: membership.role,
    },
    {
      period,
      from: period === "RANGE" ? requestedRange?.from : undefined,
      to: period === "RANGE" ? requestedRange?.to : undefined,
      page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
      filter,
      search,
      team,
      advisor,
      action: firstValue(parameters.accion),
      due: firstValue(parameters.plazo),
    },
  );

  return <OrderInbox data={inbox} />;
}
