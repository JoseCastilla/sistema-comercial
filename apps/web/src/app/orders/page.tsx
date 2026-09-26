import { after } from "next/server";

import { parseOrderPeriod, parseOrderRange } from "@repo/validation";

import { OrderInbox } from "@/features/orders/components/order-inbox";

import { getOrderInbox } from "@/features/orders/server/get-order-inbox";
import { maybeRunScheduledAgrDeliverySync } from "@/features/agr-delivery/server/agr-delivery-sync";

import { requireCommercialAccess } from "@/server/auth/access";

import type { OrderFilter } from "@/features/orders/order-inbox.types";
import { firstValue } from "@/server/search-params";

interface OrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseOrderFilter(
  value: string | undefined,
  fallback: OrderFilter,
): OrderFilter {
  return [
    "TO_MOVE",
    "DONE",
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
  /*
   * SPEC-082: la supervisión entra a las ventas del día, todas, para
   * validarlas una a una. Un enlace con período o vista propios manda.
   */
  const supervisorDay =
    membership.role === "SUPERVISOR" &&
    firstValue(parameters.period) === undefined &&
    firstValue(parameters.status) === undefined &&
    firstValue(parameters.q) === undefined;
  const requestedPeriod = supervisorDay
    ? "TODAY"
    : parseOrderPeriod(firstValue(parameters.period));
  const requestedRange = parseOrderRange(
    firstValue(parameters.from),
    firstValue(parameters.to),
  );
  const period =
    requestedPeriod === "RANGE" && !requestedRange ? "MONTH" : requestedPeriod;
  const rawPage = Number(firstValue(parameters.page));
  const filter = parseOrderFilter(
    firstValue(parameters.status),
    // SPEC-080: el asesor ve su mes en una sola lista agrupada; el resto
    // entra a lo que falta entregar (SPEC-074).
    membership.role === "AGENT" || supervisorDay ? "ALL" : "TO_MOVE",
  );
  const search = firstValue(parameters.q)?.trim().slice(0, 100) ?? "";
  const team = firstValue(parameters.team)?.trim().slice(0, 50);
  const advisor = firstValue(parameters.advisor)?.trim().slice(0, 50);
  // SPEC-044 REN-01: camino de vuelta a Rendimiento con sus filtros. Solo se
  // acepta una ruta interna de Rendimiento; cualquier otra cosa se ignora.
  const requestedReturn = firstValue(parameters.volver) ?? "";
  const returnTo = /^\/performance(\?[^\s]*)?$/.test(requestedReturn)
    ? requestedReturn.slice(0, 500)
    : null;

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
      maximo: firstValue(parameters.maximo),
      due: firstValue(parameters.plazo),
    },
  );

  return <OrderInbox data={{ ...inbox, returnTo }} />;
}
