import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import {
  AgrDeliveryCredentialForm,
  AgrDeliverySyncForm,
} from "@/features/agr-delivery/components/agr-delivery-admin-forms";
import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import { SignOutButton } from "@/app/orders/sign-out-button";

const formatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  dateStyle: "short",
  timeStyle: "short",
});

const syncStatusLabels: Record<string, string> = {
  RUNNING: "En proceso",
  COMPLETED: "Completada",
  FAILED: "Con error",
  SKIPPED: "Omitida",
};

export default async function LogisticsAdminPage() {
  const { session, membership } = await requireAdminAccess();
  const [integration, opportunityCount, lastRun] = await Promise.all([
    database.agrDeliveryIntegration.findUnique({
      where: { organizationId: membership.organization.id },
      select: {
        credentialHint: true,
        credentialStatus: true,
        credentialUpdatedAt: true,
        lastValidatedAt: true,
        lastSuccessAt: true,
        lastError: true,
        credentialUpdatedBy: { select: { name: true } },
      },
    }),
    database.agrDeliveryOrderSnapshot.count({
      where: {
        organizationId: membership.organization.id,
        isRecoveryOpportunity: true,
        ditoOrder: {
          status: { not: "CLOSED" },
          deliveryStatus: { not: "DELIVERED" },
        },
      },
    }),
    database.agrDeliverySyncRun.findFirst({
      where: { organizationId: membership.organization.id },
      orderBy: { startedAt: "desc" },
      select: {
        status: true,
        candidateOrders: true,
        consultedOrders: true,
        foundOrders: true,
        opportunityOrders: true,
        startedAt: true,
        completedAt: true,
      },
    }),
  ]);
  const format = (value: Date | null | undefined) =>
    value ? formatter.format(value) : "Aún no registrado";
  return (
    <CommercialAppShell
      activeSection="logistics"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="Integraciones"
          title="Estado logístico AGR"
          description="Consulta únicamente ventas recuperables desde el 10/08. Las entregadas o cerradas dejan de recorrerse."
        />
        <MetricGroup>
          <Metric
            label="Credencial"
            tone={
              integration?.credentialStatus === "ACTIVE" ? "success" : "danger"
            }
            value={
              integration?.credentialStatus === "ACTIVE"
                ? "Activa"
                : integration
                  ? "Requiere actualización"
                  : "Sin configurar"
            }
          />
          <Metric label="Casos accionables" value={opportunityCount} />
          <Metric
            label="Última sincronización"
            value={
              integration?.lastSuccessAt
                ? format(integration.lastSuccessAt)
                : "Pendiente"
            }
          />
        </MetricGroup>
        {integration?.lastError ? (
          <p className="rounded-xl border border-ui-danger-border bg-ui-danger-soft p-4 text-sm text-ui-danger">
            {integration.lastError}
          </p>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionPanel
            title="Credencial de sesión"
            description={
              integration
                ? `Actual: ••••${integration.credentialHint} · actualizada por ${integration.credentialUpdatedBy.name} el ${format(integration.credentialUpdatedAt)}`
                : "Configura la cookie obtenida al iniciar sesión en AGR."
            }
          >
            <AgrDeliveryCredentialForm />
          </SectionPanel>
          <SectionPanel
            title="Sincronización"
            description="Automática después de las 08:15, 13:15 y 18:15; también puedes ejecutarla manualmente."
          >
            <div className="space-y-4">
              {lastRun ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-ui-muted">Estado</dt>
                    <dd className="font-semibold text-ui-text">
                      {syncStatusLabels[lastRun.status] ?? lastRun.status}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ui-muted">Inicio</dt>
                    <dd>{format(lastRun.startedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-ui-muted">Consultadas</dt>
                    <dd>
                      {lastRun.consultedOrders} de {lastRun.candidateOrders}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ui-muted">Oportunidades</dt>
                    <dd>{lastRun.opportunityOrders}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-ui-muted">
                  Todavía no hay sincronizaciones.
                </p>
              )}
              <AgrDeliverySyncForm />
            </div>
          </SectionPanel>
        </div>
      </div>
    </CommercialAppShell>
  );
}
