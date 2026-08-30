import { ExternalToolsNavigation } from "@/features/external-tools/components/external-tools-navigation";
import { MobileDebtCredentialPanel } from "@/features/mobile-debt/components/mobile-debt-credential-panel";
import { MobileDebtLookup } from "@/features/mobile-debt/components/mobile-debt-lookup";
import {
  getMobileDebtCredentialView,
  getMobileDebtOverview,
} from "@/features/mobile-debt/server/mobile-debt-service";
import { requireCommercialAccess } from "@/server/auth/access";

import { PageHeader } from "@repo/ui/page-header";

export default async function MobileDebtPage() {
  const { session, membership } = await requireCommercialAccess();
  const canManageCredentials =
    membership.role === "ADMIN" || membership.role === "SUPERVISOR";
  const [stats, credential] = await Promise.all([
    getMobileDebtOverview({
      organizationId: membership.organization.id,
      actorUserId: session.user.id,
    }),
    canManageCredentials
      ? getMobileDebtCredentialView(membership.organization.id)
      : Promise.resolve(null),
  ]);

  return (
    <div className="ui-page-stack">
      <PageHeader
        eyebrow="Consultas de línea"
        title="Deuda de una línea"
        description="Consulta cuánto debe una línea Claro, Entel o Bitel y cuándo vence, sin salir del sistema comercial."
      />
      <ExternalToolsNavigation activeTool="debt" />
      {credential ? (
        <MobileDebtCredentialPanel credential={credential} />
      ) : null}
      <MobileDebtLookup initialStats={stats} />
    </div>
  );
}
