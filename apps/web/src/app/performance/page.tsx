import { parsePerformanceMonth } from "@repo/validation";

import { SignOutButton } from "@/app/orders/sign-out-button";
import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { PerformanceDashboard } from "@/features/performance/components/performance-dashboard";
import { getPerformanceDashboard } from "@/features/performance/server/get-performance-dashboard";
import { requireCommercialAccess } from "@/server/auth/access";

interface PerformancePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PerformancePage({
  searchParams,
}: PerformancePageProps) {
  const { session, membership } = await requireCommercialAccess();
  const parameters = await searchParams;
  const month = parsePerformanceMonth(firstValue(parameters.month));
  const team = firstValue(parameters.team)?.trim().slice(0, 50);
  const view = firstValue(parameters.view) === "SELF" ? "SELF" : "TEAM";
  const dashboard = await getPerformanceDashboard(
    membership.organization.id,
    { userId: session.user.id, role: membership.role },
    { month, team, view },
  );

  return (
    <CommercialAppShell
      activeSection="performance"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <PerformanceDashboard data={dashboard} />
    </CommercialAppShell>
  );
}
