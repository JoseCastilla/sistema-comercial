import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { ConfirmRecoveryBatchForm } from "@/features/recovery/components/confirm-recovery-batch-form";
import { RecoveryBaseUploadForm } from "@/features/recovery/components/recovery-base-upload-form";
import { PortabilityCrossForm } from "@/features/recovery/components/portability-cross-form";
import { RecoveryConfigForm } from "@/features/recovery/components/recovery-config-form";
import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import { defaultRecoveryEligibilityConfig } from "@repo/validation";

import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import { SignOutButton } from "@/app/orders/sign-out-button";

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  dateStyle: "short",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  dateStyle: "medium",
});

const batchStatusLabels: Record<string, string> = {
  PREVIEW: "Vista previa",
  CONFIRMING: "Confirmando",
  CONFIRMED: "Confirmado",
  FAILED: "Con error",
};

export default async function RecoveryBaseAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const { session, membership } = await requireAdminAccess();
  const parameters = await searchParams;

  const [
    activeConfig,
    batches,
    triageCount,
    waitingCount,
    openServiceCount,
    portabilityBatches,
  ] = await Promise.all([
    database.recoveryEligibilityConfig.findFirst({
      where: { organizationId: membership.organization.id, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    database.recoveryBaseBatch.findMany({
      where: { organizationId: membership.organization.id },
      orderBy: { uploadedAt: "desc" },
      take: 10,
      select: {
        id: true,
        fileName: true,
        status: true,
        sourceRows: true,
        eligibleRows: true,
        excludedRows: true,
        invalidRows: true,
        newCases: true,
        sightingCases: true,
        registeredFrom: true,
        registeredTo: true,
        uploadedAt: true,
        updatedAt: true,
        uploadedBy: { select: { name: true } },
      },
    }),
    database.recoveryCase.count({
      where: { organizationId: membership.organization.id, status: "TRIAGE" },
    }),
    database.recoveryCase.count({
      where: { organizationId: membership.organization.id, status: "WAITING" },
    }),
    database.recoveryCaseService.count({
      where: {
        organizationId: membership.organization.id,
        discardedAt: null,
        case: {
          status: {
            in: [
              "TRIAGE",
              "WAITING",
              "OPEN",
              "ASSIGNED",
              "IN_PROGRESS",
              "SCHEDULED",
            ],
          },
        },
      },
    }),
    database.recoveryPortabilityBatch.findMany({
      where: { organizationId: membership.organization.id },
      orderBy: { uploadedAt: "desc" },
      take: 5,
      select: {
        id: true,
        kind: true,
        fileName: true,
        totalRows: true,
        matchedServices: true,
        discardedCases: true,
        waitingCases: true,
        scheduledServices: true,
        uploadedAt: true,
      },
    }),
  ]);

  const selectedBatch = parameters.batch
    ? (batches.find((batch) => batch.id === parameters.batch) ?? null)
    : (batches[0] ?? null);

  const config = activeConfig ?? {
    modalities: defaultRecoveryEligibilityConfig.modalities,
    planNames: defaultRecoveryEligibilityConfig.planNames,
    equipmentNames: defaultRecoveryEligibilityConfig.equipmentNames,
    carrierNames: defaultRecoveryEligibilityConfig.carrierNames,
  };

  return (
    <CommercialAppShell
      activeSection="recovery"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="Campañas"
          title="Preparar campaña"
          description="Importa la base del día, cruza portabilidad y crea los casos que el equipo trabajará."
        />

        <MetricGroup>
          <Metric label="Casos por revisar (triage)" value={triageCount} />
          <Metric label="Casos en espera" value={waitingCount} />
          <Metric label="Lotes importados" value={batches.length} />
        </MetricGroup>

        {triageCount + waitingCount > 0 ? (
          <SectionPanel
            title="Siguiente paso: revisar los casos"
            description="Antes de repartir trabajo, el triage separa a quienes ya tienen un pedido en curso de quienes son oportunidad real."
          >
            <p className="text-sm text-ui-muted">
              Hay{" "}
              <strong className="text-ui-text">
                {triageCount.toLocaleString("es-PE")}
              </strong>{" "}
              caso(s) esperando revisión. Marca en lote quiénes quedan en espera
              y quiénes se liberan para asignar.
            </p>
            <p>
              <a className="ui-button ui-button--primary" href="/recovery/triage">
                Abrir triage de casos
              </a>
            </p>
          </SectionPanel>
        ) : null}

        {selectedBatch ? (
          <SectionPanel
            title={`Lote: ${selectedBatch.fileName}`}
            description={`${batchStatusLabels[selectedBatch.status] ?? selectedBatch.status} · subido por ${selectedBatch.uploadedBy.name} el ${dateTimeFormatter.format(selectedBatch.uploadedAt)}${
              selectedBatch.registeredFrom && selectedBatch.registeredTo
                ? ` · pedidos del ${dateFormatter.format(selectedBatch.registeredFrom)} al ${dateFormatter.format(selectedBatch.registeredTo)}`
                : ""
            }`}
          >
            <MetricGroup>
              <Metric label="Filas leídas" value={selectedBatch.sourceRows} />
              <Metric
                label="Filas elegibles"
                value={selectedBatch.eligibleRows}
              />
              <Metric
                label="Filas excluidas por filtros"
                value={selectedBatch.excludedRows}
              />
              <Metric
                label="Filas inválidas"
                value={selectedBatch.invalidRows}
              />
            </MetricGroup>

            {selectedBatch.status === "CONFIRMED" ? (
              <>
                <p className="text-sm text-ui-muted">
                  Cada fila es un pedido; cada caso es un cliente. Las filas de
                  un mismo cliente se agrupan en un solo caso con todos sus
                  servicios y teléfonos.
                </p>
                <MetricGroup>
                  <Metric
                    label="Clientes con caso nuevo"
                    value={selectedBatch.newCases}
                  />
                  <Metric
                    label="Clientes que reaparecieron"
                    value={selectedBatch.sightingCases}
                  />
                  <Metric
                    label="Filas agrupadas"
                    value={
                      selectedBatch.eligibleRows -
                      selectedBatch.newCases -
                      selectedBatch.sightingCases
                    }
                  />
                </MetricGroup>
              </>
            ) : null}

            {selectedBatch.status === "PREVIEW" ||
            selectedBatch.status === "CONFIRMING" ? (
              <ConfirmRecoveryBatchForm
                batchId={selectedBatch.id}
                eligibleRows={selectedBatch.eligibleRows}
                expectedUpdatedAt={selectedBatch.updatedAt.toISOString()}
              />
            ) : null}
          </SectionPanel>
        ) : null}

        <SectionPanel
          title="Importar base del día"
          description="Carga inicial de tres días una sola vez; después, solo los pedidos del día anterior."
        >
          <RecoveryBaseUploadForm />
        </SectionPanel>

        {batches.length > 0 ? (
          <SectionPanel
            title="Lotes recientes"
            description="Reimportar un archivo idéntico no duplica casos."
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-ui-border text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-ui-muted">
                  <tr>
                    <th className="px-3 py-2">Archivo</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Leídas</th>
                    <th className="px-3 py-2">Elegibles</th>
                    <th className="px-3 py-2">Casos nuevos</th>
                    <th className="px-3 py-2">Subido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border">
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td className="px-3 py-2">
                        <a
                          className="text-ui-accent underline-offset-2 hover:underline"
                          href={`/admin/recovery-base?batch=${batch.id}`}
                        >
                          {batch.fileName}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {batchStatusLabels[batch.status] ?? batch.status}
                      </td>
                      <td className="px-3 py-2">{batch.sourceRows}</td>
                      <td className="px-3 py-2">{batch.eligibleRows}</td>
                      <td className="px-3 py-2">{batch.newCases}</td>
                      <td className="px-3 py-2 text-xs text-ui-muted">
                        {dateTimeFormatter.format(batch.uploadedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionPanel>
        ) : null}

        <SectionPanel
          title="Cruce de portabilidad"
          description="Exporta los números, consúltalos fuera y sube el reporte. Los que ya están en Movistar salen de la bandeja; los que tienen portación en curso pasan a espera."
        >
          <p className="text-sm text-ui-muted">
            Hay{" "}
            <strong className="text-ui-text">
              {openServiceCount.toLocaleString("es-PE")}
            </strong>{" "}
            línea(s) de casos abiertos para consultar.
          </p>
          <p>
            <a
              className="ui-button ui-button--secondary"
              href="/admin/recovery-base/numbers"
            >
              Descargar números para consultar
            </a>
          </p>
          <PortabilityCrossForm />

          {portabilityBatches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-ui-border text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-ui-muted">
                  <tr>
                    <th className="px-3 py-2">Reporte</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Consultadas</th>
                    <th className="px-3 py-2">Cruzadas</th>
                    <th className="px-3 py-2">Descartados</th>
                    <th className="px-3 py-2">En espera</th>
                    <th className="px-3 py-2">Aplicado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border">
                  {portabilityBatches.map((cross) => (
                    <tr key={cross.id}>
                      <td className="px-3 py-2">{cross.fileName}</td>
                      <td className="px-3 py-2 text-xs">
                        {cross.kind === "FULL" ? "Completo" : "Cruce rápido"}
                      </td>
                      <td className="px-3 py-2">{cross.totalRows}</td>
                      <td className="px-3 py-2">{cross.matchedServices}</td>
                      <td className="px-3 py-2">{cross.discardedCases}</td>
                      <td className="px-3 py-2">{cross.waitingCases}</td>
                      <td className="px-3 py-2 text-xs text-ui-muted">
                        {dateTimeFormatter.format(cross.uploadedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionPanel>

        <SectionPanel
          title="Filtros de elegibilidad"
          description="Los cambios aplican a las próximas importaciones. Cada lote conserva la configuración con la que se evaluó."
        >
          <RecoveryConfigForm
            carrierNames={config.carrierNames}
            equipmentNames={config.equipmentNames}
            modalities={config.modalities}
            planNames={config.planNames}
          />
        </SectionPanel>
      </div>
    </CommercialAppShell>
  );
}
