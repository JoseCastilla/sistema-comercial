import {
  AgrDeliveryCredentialForm,
  AgrDeliverySyncForm,
} from "@/features/agr-delivery/components/agr-delivery-admin-forms";
import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

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
  const { membership } = await requireAdminAccess();
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
    <>
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="Integraciones"
          title="Estado logístico Máximo"
          description="Consulta únicamente ventas recuperables desde el 10/08. Las entregadas o cerradas ya no se vuelven a consultar."
        />
        {/*
         * El estado del acceso y la fecha de la ultima sincronizacion no son
         * cifras: ocupaban la tipografia de numero grande para mostrar
         * «Activo» y una fecha. Un estado es un badge y una fecha es metadato;
         * la fila de tarjetas queda para la unica cifra que el administrador
         * necesita ver.
         */}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ui-muted">
          <StatusBadge
            tone={
              integration?.credentialStatus === "ACTIVE" ? "success" : "danger"
            }
          >
            {integration?.credentialStatus === "ACTIVE"
              ? "Acceso activo"
              : integration
                ? "Acceso por renovar"
                : "Acceso sin configurar"}
          </StatusBadge>
          <span>
            Última sincronización:{" "}
            {integration?.lastSuccessAt
              ? format(integration.lastSuccessAt)
              : "pendiente"}
          </span>
        </p>

        <MetricGroup>
          <Metric
            emphasis="hero"
            label="Pedidos que requieren acción"
            tone={opportunityCount > 0 ? "warning" : "neutral"}
            value={opportunityCount}
          />
        </MetricGroup>
        {integration?.lastError ? (
          <div className="rounded-xl border border-ui-danger-border bg-ui-danger-soft p-4 text-sm text-ui-danger">
            <p>
              No se pudo conectar con Máximo. Vuelve a configurar el acceso.
            </p>
            <p className="mt-1 text-xs opacity-80">
              Detalle para soporte: {integration.lastError}
            </p>
          </div>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionPanel
            title="Acceso al portal Máximo"
            description={
              integration
                ? `Actual: ••••${integration.credentialHint} · actualizada por ${integration.credentialUpdatedBy.name} el ${format(integration.credentialUpdatedAt)}`
                : "Pega la clave que aparece al iniciar sesión en Máximo."
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
    </>
  );
}
