import { SignOutButton } from "@/app/orders/sign-out-button";
import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { DniLookupForm } from "@/features/dni/components/dni-lookup-form";
import { getDniLookupOverview } from "@/features/dni/server/dni-lookup-service";
import { requireCommercialAccess } from "@/server/auth/access";

import { PageHeader } from "@repo/ui/page-header";

export default async function DniLookupPage() {
  const { session, membership } = await requireCommercialAccess();
  const canViewCredits = membership.role === "ADMIN";
  const overview = await getDniLookupOverview({
    organizationId: membership.organization.id,
    actorUserId: session.user.id,
    canViewCredits,
  });

  return (
    <CommercialAppShell
      activeSection="dni"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="Clientes"
          title="Consulta por DNI"
          description={
            canViewCredits
              ? "Valida la identidad del cliente y supervisa el saldo disponible del servicio."
              : "Valida la identidad del cliente. Si el DNI ya fue consultado, el sistema recupera la ficha guardada al instante."
          }
        />
        <DniLookupForm
          initialCreditStatus={overview.creditStatus}
          initialStats={overview.stats}
        />
      </div>
    </CommercialAppShell>
  );
}
