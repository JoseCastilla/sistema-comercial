import {
  AgrDeliveryCredentialForm,
  AgrDeliverySyncForm,
} from "@/features/agr-delivery/components/agr-delivery-admin-forms";
import { describeAgrSchedule } from "@/features/agr-delivery/schedule";
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
  // PL-07: la hora de la fuente no es la hora de la pantalla.
  const now = new Date();
  const schedule = describeAgrSchedule(now, integration?.lastSuccessAt ?? null);
  const timeFormatter = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const isToday = (value: Date) =>
    formatter.format(value).slice(0, 8) === formatter.format(now).slice(0, 8);
  const slotLabel = (value: Date) =>
    `${isToday(value) ? "hoy" : "mañana"} a las ${timeFormatter.format(value)}`;
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
            Datos de Máximo al:{" "}
            <strong className="text-ui-text">
              {integration?.lastSuccessAt
                ? format(integration.lastSuccessAt)
                : "sin consulta todavía"}
            </strong>
          </span>
          <span>Pantalla generada: {format(now)}</span>
          <span>
            Próxima consulta automática: {slotLabel(schedule.nextAt)}; la
            dispara el proceso de fondo en los cinco minutos siguientes, o quien
            abra Pedidos si el proceso no está.
          </span>
        </p>
        {schedule.delayed && schedule.lastExpectedAt ? (
          <p className="rounded-lg border border-ui-warning-border bg-ui-warning-soft px-4 py-3 text-sm text-ui-warning">
            La consulta de las {timeFormatter.format(schedule.lastExpectedAt)}{" "}
            no se ha ejecutado: los datos son de{" "}
            {integration?.lastSuccessAt
              ? format(integration.lastSuccessAt)
              : "antes de la primera consulta"}
            . El acceso puede estar activo y aun así la información estar
            atrasada.
          </p>
        ) : null}

        <MetricGroup>
          {/*
           * SPEC-045 PL-06: la cifra es el acumulado de pedidos con
           * oportunidad logística abierta desde el 10/08 —no el resultado de
           * la última ejecución— y abre exactamente esa lista en Pedidos
           * («Entregas fallidas por gestionar» ignora el período, SPEC-029
           * BR-025). Navegar no dispara ninguna sincronización.
           */}
          <Metric
            emphasis="hero"
            hint="Acumulado desde el 10/08 con oportunidad abierta, no solo la última ejecución · abre Pedidos"
            href="/orders?status=LOGISTICS"
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
            description="Automática cuatro veces al día, a las 08:00, 12:00, 15:00 y 18:00 (hora de Lima); cualquier otra consulta es manual."
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
