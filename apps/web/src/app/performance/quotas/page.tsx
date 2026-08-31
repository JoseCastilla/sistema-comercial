import { redirect } from "next/navigation";

import { SignOutButton } from "@/app/orders/sign-out-button";
import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { PerformanceQuotas } from "@/features/performance/components/performance-quotas";
import { getPerformanceQuotas } from "@/features/performance/server/get-performance-quotas";
import { requireCommercialAccess } from "@/server/auth/access";

interface QuotasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PerformanceQuotasPage({
  searchParams,
}: QuotasPageProps) {
  const { session, membership } = await requireCommercialAccess();

  // El asesor consulta su cuota en el panel de rendimiento, no aquí.
  if (membership.role === "AGENT") {
    redirect("/performance");
  }

  const parameters = await searchParams;
  const data = await getPerformanceQuotas(
    membership.organization.id,
    { userId: session.user.id, role: membership.role },
    {
      period: firstValue(parameters.period),
      window: firstValue(parameters.window),
    },
  );

  return (
    <CommercialAppShell
      activeSection="performance"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <PerformanceQuotas data={data} />
    </CommercialAppShell>
  );
}
