import { parsePerformanceMonth } from "@repo/validation";

import { SignOutButton } from "@/app/orders/sign-out-button";
import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { PerformanceReconciliation } from "@/features/performance/components/performance-reconciliation";
import { getPerformanceReconciliation } from "@/features/performance/server/get-performance-reconciliation";
import { requireAdminAccess } from "@/server/auth/access";

import type { ReconciliationFilter } from "@/features/performance/reconciliation.types";

interface ReconciliationPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseReason(value: string | undefined): ReconciliationFilter {
  const filters: ReconciliationFilter[] = [
    "ALL",
    "PAYABLE",
    "NEW_LINE_NO_COMMISSION",
    "UNKNOWN_OPERATION",
    "UNASSIGNED",
    "CANCELLED",
    "NOT_DELIVERED",
    "NOT_ACTIVATED",
  ];
  return filters.includes(value as ReconciliationFilter)
    ? (value as ReconciliationFilter)
    : "ALL";
}

export default async function ReconciliationPage({
  searchParams,
}: ReconciliationPageProps) {
  const { session, membership } = await requireAdminAccess();
  const parameters = await searchParams;
  const rawPage = Number(firstValue(parameters.page));
  const data = await getPerformanceReconciliation(membership.organization.id, {
    month: parsePerformanceMonth(firstValue(parameters.month)),
    team: firstValue(parameters.team)?.trim().slice(0, 50),
    reason: parseReason(firstValue(parameters.reason)),
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  });

  return (
    <CommercialAppShell
      activeSection="performance"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <PerformanceReconciliation data={data} />
    </CommercialAppShell>
  );
}
