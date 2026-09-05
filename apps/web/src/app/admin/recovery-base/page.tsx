import Link from "next/link";
import { ConfirmRecoveryBatchForm } from "@/features/recovery/components/confirm-recovery-batch-form";
import { RecoveryBaseUploadForm } from "@/features/recovery/components/recovery-base-upload-form";
import { PortabilityCrossForm } from "@/features/recovery/components/portability-cross-form";
import { QueueFilters } from "@/features/recovery/components/queue-filters";
import { RecoveryConfigForm } from "@/features/recovery/components/recovery-config-form";
import { expireUnverifiedCases } from "@/features/recovery/server/expire-unverified-cases";
import { releaseWaitingBaseCases } from "@/features/recovery/server/release-waiting-base-cases";
import { CampaignNav } from "@/features/recovery/components/campaign-nav";
import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import {
  defaultRecoveryEligibilityConfig,
  needsPortabilityRecross,
} from "@repo/validation";

import { formatCount } from "@repo/ui/format";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

// 24 horas y sin segundos: la hora es un dato tabular, no una frase.
const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
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

/**
 * Cifra del lote: etiqueta pequeña y número monoespaciado en la misma
 * fijación de la vista (SPEC-039 BR-004, BR-005). Más denso que una tarjeta
 * de métrica, que aquí competiría con el embudo de la campaña.
 */
function BatchStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning";
}) {
  return (
    <div>
      <dt className="ui-label-eyebrow">{label}</dt>
      <dd
        className={`ui-data text-base font-semibold ${
          tone === "warning" ? "text-ui-warning" : "text-ui-text"
        }`}
      >
        {formatCount(value)}
      </dd>
    </div>
  );
}

export default async function RecoveryBaseAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    batch?: string;
    q?: string;
    estado?: string;
    usuario?: string;
    rango?: string;
  }>;
}) {
  const { membership } = await requireAdminAccess();
  const parameters = await searchParams;

  /**
   * Fase 4: el historial de cargas se filtra por archivo, estado, quién
   * cargó y antigüedad de la carga. Un lote no debe identificarse solo por
   * el nombre del archivo, que se repite de un día a otro.
   */
  const batchSearch = (parameters.q ?? "").trim().slice(0, 80);
  const batchStatuses = [
    "PREVIEW",
    "CONFIRMING",
    "CONFIRMED",
    "FAILED",
  ] as const;
  const batchStatus = batchStatuses.find(
    (status) => status === (parameters.estado ?? "").trim(),
  );
  const uploaderFilter = (parameters.usuario ?? "").trim().slice(0, 40);
  const rangeDays =
    parameters.rango === "7" ? 7 : parameters.rango === "30" ? 30 : null;
  const rangeStart = rangeDays
    ? new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000)
    : null;

  // BR-084: lo vencido drena antes de mostrar el embudo. BR-024b: y lo que
  // ya no espera nada vuelve a revisión, o el embudo miente.
  await expireUnverifiedCases(membership.organization.id);
  await releaseWaitingBaseCases(membership.organization.id);

  // BR-082b: la ventana del barrido y la del contador que lo anuncia son la
  // misma; si una cambia, la otra miente.
  const sweepDays = 3;

  const [
    activeConfig,
    batches,
    uploaders,
    triageCount,
    waitingCount,
    openCount,
    managedCount,
    recoveredCount,
    discardedCount,
    lostCount,
    pendingLineCount,
    openLineCount,
    readyCaseCount,
    waitingServices,
    sweepServices,
    portabilityBatches,
  ] = await Promise.all([
    database.recoveryEligibilityConfig.findFirst({
      where: { organizationId: membership.organization.id, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    database.recoveryBaseBatch.findMany({
      where: {
        organizationId: membership.organization.id,
        ...(batchSearch
          ? { fileName: { contains: batchSearch, mode: "insensitive" } }
          : {}),
        ...(batchStatus ? { status: batchStatus } : {}),
        ...(uploaderFilter ? { uploadedByUserId: uploaderFilter } : {}),
        ...(rangeStart ? { uploadedAt: { gte: rangeStart } } : {}),
      },
      orderBy: { uploadedAt: "desc" },
      take: 50,
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
    database.recoveryBaseBatch.findMany({
      where: { organizationId: membership.organization.id },
      distinct: ["uploadedByUserId"],
      select: {
        uploadedByUserId: true,
        uploadedBy: { select: { name: true } },
      },
    }),
    database.recoveryCase.count({
      where: {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        status: "TRIAGE",
      },
    }),
    database.recoveryCase.count({
      where: {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        status: "WAITING",
      },
    }),
    database.recoveryCase.count({
      where: {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        status: "OPEN",
      },
    }),
    database.recoveryCase.count({
      where: {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        status: { in: ["ASSIGNED", "IN_PROGRESS", "SCHEDULED"] },
      },
    }),
    database.recoveryCase.count({
      where: {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        status: "RECOVERED",
      },
    }),
    // BR-056: los descartes por portabilidad no son pérdidas, pero sí
    // explican por qué el embudo tiene menos casos de los que se crearon.
    database.recoveryCase.count({
      where: {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        status: "DISCARDED",
      },
    }),
    database.recoveryCase.count({
      where: {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        status: "LOST",
      },
    }),
    // BR-082: la exportación es incremental; estos contadores muestran el
    // avance de la consulta, no el total de líneas.
    database.recoveryCaseService.count({
      where: {
        organizationId: membership.organization.id,
        discardedAt: null,
        OR: [{ portabilityCheckedAt: null }, { needsRevalidation: true }],
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
    // BR-080: caso listo = ninguna línea activa sin consultar.
    database.recoveryCase.count({
      where: {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        status: "TRIAGE",
        services: { none: { discardedAt: null, portabilityCheckedAt: null } },
      },
    }),
    // Las líneas de los pedidos en curso: lo que queda esperando de verdad
    // tras BR-024b, y lo que hay que volver a filtrar para saber si el
    // pedido se concretó.
    database.recoveryCaseService.findMany({
      where: {
        organizationId: membership.organization.id,
        discardedAt: null,
        case: { status: "WAITING", source: "NATIONAL_BASE" },
      },
      select: { serviceNumber: true },
    }),
    // BR-082b: el mismo universo que exporta el barrido, para anunciar
    // cuántos números salen antes de gastarlos en la herramienta externa.
    // El receptor es texto libre, así que el recorte no se puede pedir en
    // SQL: se resuelve con la regla pura sobre estas cuatro columnas.
    database.recoveryCaseService.findMany({
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
          createdAt: {
            gte: new Date(Date.now() - sweepDays * 24 * 60 * 60 * 1000),
          },
        },
      },
      select: {
        serviceNumber: true,
        portabilityState: true,
        portabilityReceiver: true,
        portabilityWindowAt: true,
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

  const waitingNumbers = new Set(
    waitingServices.map((service) => service.serviceNumber),
  ).size;

  const now = new Date();
  const recrossNumbers = new Set(
    sweepServices
      .filter((service) =>
        needsPortabilityRecross({
          state: service.portabilityState,
          receiverRaw: service.portabilityReceiver,
          windowDate: service.portabilityWindowAt,
          now,
        }),
      )
      .map((service) => service.serviceNumber),
  ).size;
  const sweepNumbers = new Set(
    sweepServices.map((service) => service.serviceNumber),
  ).size;
  const settledNumbers = sweepNumbers - recrossNumbers;

  const totalCases =
    triageCount +
    waitingCount +
    openCount +
    managedCount +
    recoveredCount +
    discardedCount +
    lostCount;

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
    <>
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="Campañas"
          title="Preparar campaña"
          description="Cargar la base, cruzar portabilidad y crear los casos."
        />
        <CampaignNav current="preparar" role={membership.role} />

        <SectionPanel
          title="Cómo va la campaña"
          description="Al volver en otra sesión, aquí está lo que falta."
        >
          <MetricGroup>
            <Metric label="Por revisar" value={triageCount} />
            <Metric
              label="Con pedido en curso"
              value={waitingCount}
              hint="Su pedido avanza solo"
            />
            <Metric label="Disponible" value={openCount} />
            <Metric label="En gestión" value={managedCount} />
            <Metric label="Recuperados" value={recoveredCount} />
          </MetricGroup>

          {/* El embudo debe cuadrar: sin esta línea, los casos cerrados por
              el cruce desaparecen y el total no explica de dónde sale. */}
          <p className="text-xs leading-5 text-ui-muted">
            <strong className="text-ui-text">{formatCount(totalCases)}</strong>{" "}
            caso(s) creados desde la base
            {discardedCount > 0 ? (
              <>
                {" "}
                ·{" "}
                <strong className="text-ui-text">
                  {formatCount(discardedCount)}
                </strong>{" "}
                cerrados porque ya eran Movistar (no cuentan como pérdida)
              </>
            ) : null}
            {lostCount > 0 ? (
              <>
                {" "}
                ·{" "}
                <strong className="text-ui-text">
                  {formatCount(lostCount)}
                </strong>{" "}
                perdidos
              </>
            ) : null}
            . Un caso es un cliente: las líneas de un mismo cliente se agrupan
            en un solo caso.
          </p>
          <div className="ui-form-row">
            {triageCount > 0 ? (
              <Link
                className="ui-button ui-button--primary"
                href="/recovery/triage"
              >
                Revisar {formatCount(triageCount)} caso(s)
              </Link>
            ) : null}
            {openCount > 0 ? (
              <Link
                className={`ui-button ${triageCount > 0 ? "ui-button--secondary" : "ui-button--primary"}`}
                href="/recovery/distribute"
              >
                Repartir {formatCount(openCount)} listos
              </Link>
            ) : null}
            {triageCount === 0 && openCount === 0 ? (
              <p className="text-sm text-ui-muted">
                Sin casos por revisar ni distribuir. Carga la base del día.
              </p>
            ) : null}
          </div>
        </SectionPanel>

        <SectionPanel
          title="Base del día"
          description="Reimportar un archivo idéntico no duplica casos."
        >
          <RecoveryBaseUploadForm />

          <QueueFilters
            basePath="/admin/recovery-base"
            options={{
              extras: [
                {
                  key: "estado",
                  label: "Estado del lote",
                  options: batchStatuses.map((status) => ({
                    value: status,
                    label: batchStatusLabels[status] ?? status,
                  })),
                },
                {
                  key: "usuario",
                  label: "Quién cargó",
                  options: uploaders.map((item) => ({
                    value: item.uploadedByUserId,
                    label: item.uploadedBy.name,
                  })),
                },
                {
                  key: "rango",
                  label: "Cargado en",
                  emptyLabel: "Cualquier fecha",
                  options: [
                    { value: "7", label: "Últimos 7 días" },
                    { value: "30", label: "Últimos 30 días" },
                  ],
                },
              ],
            }}
            resultLabel={`${formatCount(batches.length)} carga(s).`}
            searchLabel="Buscar archivo"
            searchPlaceholder="Nombre del archivo"
            values={{
              q: batchSearch,
              team: "",
              department: "",
              plan: "",
              extra: {
                estado: batchStatus ?? "",
                usuario: uploaderFilter,
                rango: rangeDays ? String(rangeDays) : "",
              },
            }}
          />

          {selectedBatch ? (
            <div className="rounded-xl border border-ui-border p-3">
              <p className="text-sm font-semibold text-ui-text">
                {selectedBatch.fileName}
                <span className="ml-2 text-xs font-normal text-ui-muted">
                  {batchStatusLabels[selectedBatch.status] ??
                    selectedBatch.status}{" "}
                  · {selectedBatch.uploadedBy.name} ·{" "}
                  <span className="ui-data">
                    {dateTimeFormatter.format(selectedBatch.uploadedAt)}
                  </span>
                  {selectedBatch.registeredFrom && selectedBatch.registeredTo
                    ? ` · pedidos del ${dateFormatter.format(selectedBatch.registeredFrom)} al ${dateFormatter.format(selectedBatch.registeredTo)}`
                    : ""}
                </span>
              </p>

              <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                <BatchStat
                  label="Filas del archivo"
                  value={selectedBatch.sourceRows}
                />
                <BatchStat
                  label="Entran a la campaña"
                  value={selectedBatch.eligibleRows}
                />
                <BatchStat
                  label="Excluidas"
                  value={selectedBatch.excludedRows}
                />
                <BatchStat
                  label="Inválidas"
                  tone={selectedBatch.invalidRows > 0 ? "warning" : undefined}
                  value={selectedBatch.invalidRows}
                />
                {selectedBatch.status === "CONFIRMED" ? (
                  <>
                    <BatchStat
                      label="Casos nuevos"
                      value={selectedBatch.newCases}
                    />
                    <BatchStat
                      label="Clientes que ya estaban"
                      value={selectedBatch.sightingCases}
                    />
                    <BatchStat
                      label="Líneas del mismo cliente"
                      value={
                        selectedBatch.eligibleRows -
                        selectedBatch.newCases -
                        selectedBatch.sightingCases
                      }
                    />
                  </>
                ) : null}
              </dl>

              {selectedBatch.status === "PREVIEW" ||
              selectedBatch.status === "CONFIRMING" ? (
                <div className="mt-3">
                  <ConfirmRecoveryBatchForm
                    batchId={selectedBatch.id}
                    eligibleRows={selectedBatch.eligibleRows}
                    expectedUpdatedAt={selectedBatch.updatedAt.toISOString()}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {batches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th className="font-semibold">Archivo</th>
                    <th className="font-semibold">Estado</th>
                    <th data-numeric className="font-semibold">
                      Filas del archivo
                    </th>
                    <th data-numeric className="font-semibold">
                      Entran a la campaña
                    </th>
                    <th data-numeric className="font-semibold">
                      Casos
                    </th>
                    <th className="font-semibold">Subido</th>
                    <th data-actions />
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td>
                        <Link
                          className="text-ui-accent underline-offset-2 hover:underline"
                          href={`/admin/recovery-base?batch=${batch.id}`}
                        >
                          {batch.fileName}
                        </Link>
                      </td>
                      <td className="text-xs text-ui-muted">
                        {batchStatusLabels[batch.status] ?? batch.status}
                      </td>
                      <td data-numeric className="ui-data">
                        {formatCount(batch.sourceRows)}
                      </td>
                      <td data-numeric className="ui-data">
                        {formatCount(batch.eligibleRows)}
                      </td>
                      <td data-numeric className="ui-data">
                        {formatCount(batch.newCases)}
                      </td>
                      <td className="ui-data text-ui-muted">
                        {dateTimeFormatter.format(batch.uploadedAt)}
                      </td>
                      <td className="text-xs" data-actions>
                        {batch.status === "CONFIRMED" ? (
                          <Link
                            className="text-ui-accent underline-offset-2 hover:underline"
                            href={`/recovery/triage?batch=${batch.id}`}
                            title="Los clientes que aparecieron en este archivo, cada uno una vez"
                          >
                            Ver clientes
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionPanel>

        <SectionPanel
          title="Cruce de portabilidad"
          description="Los que ya están en Movistar salen de la bandeja; los que tienen portación en curso pasan a espera."
        >
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            <BatchStat
              label="Sin consultar"
              tone={pendingLineCount > 0 ? "warning" : undefined}
              value={pendingLineCount}
            />
            <BatchStat label="Líneas en la bandeja" value={openLineCount} />
            <BatchStat
              label="Casos listos para repartir"
              value={readyCaseCount}
            />
          </dl>

          {pendingLineCount > 0 ? (
            <div className="ui-form-row">
              <a
                className="ui-button ui-button--secondary"
                href="/admin/recovery-base/numbers?take=200"
              >
                Descargar 200 números
              </a>
              <a
                className="ui-button ui-button--secondary"
                href="/admin/recovery-base/numbers?take=500"
              >
                500 números
              </a>
              <a
                className="ui-button ui-button--secondary"
                href="/admin/recovery-base/numbers"
              >
                Todos los pendientes
              </a>
              <span className="pb-2 text-xs text-ui-muted">
                Solo salen líneas sin consultar, las más recientes primero.
              </span>
            </div>
          ) : (
            <p className="text-xs text-ui-muted">
              No hay líneas pendientes de consulta.
            </p>
          )}

          <div className="ui-form-row">
            <a
              className="ui-button ui-button--secondary"
              href={`/admin/recovery-base/numbers?days=${sweepDays}&scope=recross`}
            >
              Revisión diaria: {formatCount(recrossNumbers)} número(s)
            </a>
            <span className="pb-2 text-xs text-ui-muted">
              Las líneas de los últimos {sweepDays} días que todavía pueden
              cambiar: las que están en otro operador y las que tienen pedido a
              Movistar sin fecha, que puede caerse.
              {waitingNumbers > 0 ? (
                <div className="ui-form-row">
                  <a
                    className="ui-button ui-button--secondary"
                    href="/admin/recovery-base/numbers?scope=waiting"
                  >
                    Pedidos en curso: {formatCount(waitingNumbers)} número(s)
                  </a>
                  <span className="pb-2 text-xs text-ui-muted">
                    Las líneas de los clientes que están esperando: unas ya
                    portaron y otras se cayeron. Pásalas por el filtro para
                    saber cuáles siguen siendo oportunidad.
                  </span>
                </div>
              ) : null}
              {settledNumbers > 0 ? (
                <>
                  {" "}
                  Quedan fuera {formatCount(settledNumbers)} con fecha de
                  portación ya puesta: volver a consultarlas gasta el cupo del
                  filtro en respuestas que ya conocemos.
                </>
              ) : null}
            </span>
          </div>

          {settledNumbers > 0 ? (
            <div className="ui-form-row">
              <a
                className="ui-button ui-button--quiet"
                href={`/admin/recovery-base/numbers?days=${sweepDays}`}
              >
                Bajar también las que ya tienen fecha (
                {formatCount(sweepNumbers)})
              </a>
              <span className="pb-2 text-xs text-ui-muted">
                Solo si quieres auditar el barrido completo.
              </span>
            </div>
          ) : null}

          <PortabilityCrossForm />

          {portabilityBatches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th className="font-semibold">Reporte</th>
                    <th className="font-semibold">Tipo</th>
                    <th data-numeric className="font-semibold">
                      Consultadas
                    </th>
                    <th data-numeric className="font-semibold">
                      Encontradas en la base
                    </th>
                    <th data-numeric className="font-semibold">
                      Ya eran Movistar
                    </th>
                    <th data-numeric className="font-semibold">
                      Portando a Movistar
                    </th>
                    <th className="font-semibold">Aplicado</th>
                  </tr>
                </thead>
                <tbody>
                  {portabilityBatches.map((cross) => (
                    <tr key={cross.id}>
                      <td>{cross.fileName}</td>
                      <td className="text-xs text-ui-muted">
                        {cross.kind === "FULL" ? "Completo" : "Rápido"}
                      </td>
                      <td data-numeric className="ui-data">
                        {formatCount(cross.totalRows)}
                      </td>
                      <td data-numeric className="ui-data">
                        {formatCount(cross.matchedServices)}
                      </td>
                      <td data-numeric className="ui-data">
                        {formatCount(cross.discardedCases)}
                      </td>
                      <td data-numeric className="ui-data">
                        {formatCount(cross.waitingCases)}
                      </td>
                      <td className="ui-data text-ui-muted">
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
          title="Qué ventas entran a la campaña"
          description="Aplican a las próximas importaciones; cada archivo ya cargado mantiene las reglas con las que se procesó."
        >
          <RecoveryConfigForm
            carrierNames={config.carrierNames}
            equipmentNames={config.equipmentNames}
            modalities={config.modalities}
            planNames={config.planNames}
          />
        </SectionPanel>
      </div>
    </>
  );
}
