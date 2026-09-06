import { parsePerformanceMonth } from "@repo/validation";

import { PerformanceDashboard } from "@/features/performance/components/performance-dashboard";
import { getPerformanceDashboard } from "@/features/performance/server/get-performance-dashboard";
import { requireCommercialAccess } from "@/server/auth/access";
import { firstValue } from "@/server/search-params";

interface PerformancePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PerformancePage({
  searchParams,
}: PerformancePageProps) {
  const { session, membership } = await requireCommercialAccess();
  const parameters = await searchParams;
  const month = parsePerformanceMonth(firstValue(parameters.month));
  const team = firstValue(parameters.team)?.trim().slice(0, 50);
  const agent = firstValue(parameters.agent)?.trim().slice(0, 50);
  const view = firstValue(parameters.view) === "SELF" ? "SELF" : "TEAM";
  const sort = firstValue(parameters.orden)?.trim().slice(0, 30);
  const management = firstValue(parameters.gestion)?.trim().slice(0, 30);
  const search = firstValue(parameters.q)?.slice(0, 100);
  const matrix = firstValue(parameters.matriz)?.trim().slice(0, 10);
  const dashboard = await getPerformanceDashboard(
    membership.organization.id,
    { userId: session.user.id, role: membership.role },
    { month, team, agent, view, sort, management, search, matrix },
  );

  return <PerformanceDashboard data={dashboard} />;
}
