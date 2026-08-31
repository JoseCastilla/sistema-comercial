import { notFound } from "next/navigation";

import { SignOutButton } from "@/app/orders/sign-out-button";
import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { SalesRecoveryCaseDetail } from "@/features/recovery/components/sales-recovery-case-detail";
import { getSalesRecoveryCase } from "@/features/recovery/server/get-sales-recovery-case";
import { requireCommercialAccess } from "@/server/auth/access";

interface SalesRecoveryCasePageProps {
  params: Promise<{ caseId: string }>;
}

export default async function SalesRecoveryCasePage({
  params,
}: SalesRecoveryCasePageProps) {
  const { session, membership } = await requireCommercialAccess();
  const { caseId } = await params;
  const data = await getSalesRecoveryCase(
    membership.organization.id,
    { userId: session.user.id, role: membership.role },
    caseId.trim().slice(0, 50),
  );

  if (!data) notFound();

  return (
    <CommercialAppShell
      activeSection="sales-recovery"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <SalesRecoveryCaseDetail data={data} />
    </CommercialAppShell>
  );
}
