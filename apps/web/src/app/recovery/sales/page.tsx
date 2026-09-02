import { SalesRecoveryInbox } from "@/features/recovery/components/sales-recovery-inbox";
import { getSalesRecoveryInbox } from "@/features/recovery/server/get-sales-recovery-inbox";
import { requireCommercialAccess } from "@/server/auth/access";

export default async function SalesRecoveryPage() {
  const { session, membership } = await requireCommercialAccess();
  const data = await getSalesRecoveryInbox(membership.organization.id, {
    userId: session.user.id,
    role: membership.role,
  });

  return <SalesRecoveryInbox data={data} />;
}
