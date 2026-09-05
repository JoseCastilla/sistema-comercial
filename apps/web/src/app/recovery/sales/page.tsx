import { parseInternalRecoveryDue } from "@repo/validation";

import { SalesRecoveryInbox } from "@/features/recovery/components/sales-recovery-inbox";
import { getSalesRecoveryInbox } from "@/features/recovery/server/get-sales-recovery-inbox";
import { requireCommercialAccess } from "@/server/auth/access";

export default async function SalesRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ vence?: string; page?: string }>;
}) {
  const [{ session, membership }, parameters] = await Promise.all([
    requireCommercialAccess(),
    searchParams,
  ]);
  const data = await getSalesRecoveryInbox(
    membership.organization.id,
    { userId: session.user.id, role: membership.role },
    {
      due: parseInternalRecoveryDue(parameters.vence),
      page: Number.parseInt(parameters.page ?? "1", 10),
    },
  );

  return <SalesRecoveryInbox data={data} />;
}
