import Link from "next/link";

import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { DitoImportUploadForm } from "@/features/dito-imports/components/dito-import-upload-form";
import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import { EmptyState } from "@repo/ui/empty-state";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { SignOutButton } from "@/app/orders/sign-out-button";

const classificationLabels: Record<string, string> = {
  NEW_ORDER: "Nueva",
  ENRICHMENT: "Completar datos",
  UNCHANGED: "Sin cambios",
  EXCLUDED: "Excluida",
  INVALID: "Inválida",
  BLOCKED_IDENTITY: "Falta asesor",
  CONFLICT: "Conflicto",
};

const batchStatusLabels: Record<string, string> = {
  PREVIEW: "Requiere revisión",
  READY: "Lista para confirmar",
  CONFIRMING: "Procesando",
  CONFIRMED: "Confirmada",
  FAILED: "Fallida",
};

export default async function DitoImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const { session, membership } = await requireAdminAccess();
  const parameters = await searchParams;
  const organizationId = membership.organization.id;
  const recentBatches = await database.ditoImportBatch.findMany({
    where: { organizationId },
    orderBy: { uploadedAt: "desc" },
    take: 8,
    select: {
      id: true,
      fileName: true,
      status: true,
      uploadedAt: true,
      sourceRows: true,
      importableRows: true,
      blockedRows: true,
      conflictRows: true,
    },
  });
  const selectedBatchId = parameters.batch ?? recentBatches[0]?.id ?? null;
  const selectedBatch = selectedBatchId
    ? await database.ditoImportBatch.findFirst({
        where: { id: selectedBatchId, organizationId },
        select: {
          id: true,
          fileName: true,
          fileSha256: true,
          status: true,
          uploadedAt: true,
          sourceRows: true,
          importableRows: true,
          excludedRows: true,
          invalidRows: true,
          newRows: true,
          enrichmentRows: true,
          unchangedRows: true,
          blockedRows: true,
          conflictRows: true,
          uploadedBy: { select: { name: true } },
          rows: {
            orderBy: { sourceRow: "asc" },
            take: 100,
            select: {
              id: true,
              sourceRow: true,
              classification: true,
              issueCodes: true,
              displayedOrderCode: true,
              ditoUsernameNormalized: true,
              parsedData: true,
              agentIdentity: {
                select: {
                  externalUsername: true,
                  displayName: true,
                  user: { select: { name: true } },
                },
              },
            },
          },
        },
      })
    : null;
  const unresolvedIdentities = selectedBatch
    ? await database.ditoAgentIdentity.findMany({
        where: {
          organizationId,
          isActive: true,
          userId: null,
          importRows: { some: { batchId: selectedBatch.id } },
        },
        orderBy: { externalUsernameNormalized: "asc" },
        select: {
          id: true,
          externalUsername: true,
          displayName: true,
          _count: {
            select: { importRows: { where: { batchId: selectedBatch.id } } },
          },
        },
      })
    : [];
  const dateFormatter = new Intl.DateTimeFormat("es-PE", {
    timeZone: membership.organization.timezone,
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <CommercialAppShell
      activeSection="imports"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <div className="ui-page-stack">
        <PageHeader
          description="Carga la bandeja DITO, revisa coincidencias y resuelve observaciones antes de incorporar ventas."
          eyebrow="Administración"
          meta="Ningún pedido cambia durante la vista previa"
          title="Importar ventas DITO"
        />

        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6 self-start xl:sticky xl:top-8">
            <SectionPanel
              description="Usa el archivo XLSX original descargado desde la bandeja de pedidos."
              title="Nueva vista previa"
            >
              <DitoImportUploadForm />
            </SectionPanel>

            <SectionPanel
              description="Las cargas repetidas reutilizan el mismo análisis."
              title="Cargas recientes"
            >
              {recentBatches.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Todavía no existen archivos analizados.
                </p>
              ) : (
                <nav aria-label="Cargas DITO recientes" className="space-y-2">
                  {recentBatches.map((batch) => (
                    <Link
                      aria-current={
                        batch.id === selectedBatch?.id ? "page" : undefined
                      }
                      className="block rounded-xl border border-neutral-200 px-3 py-3 transition hover:border-neutral-400 aria-[current=page]:border-emerald-700 aria-[current=page]:bg-emerald-50"
                      href={`/admin/dito-imports?batch=${batch.id}`}
                      key={batch.id}
                    >
                      <span className="block truncate text-sm font-medium text-neutral-900">
                        {batch.fileName}
                      </span>
                      <span className="mt-1 block text-xs text-neutral-500">
                        {dateFormatter.format(batch.uploadedAt)} ·{" "}
                        {batch.importableRows} aprobadas
                      </span>
                    </Link>
                  ))}
                </nav>
              )}
            </SectionPanel>
          </div>

          <div className="min-w-0 space-y-6">
            {!selectedBatch ? (
              <EmptyState
                description="Carga un archivo XLSX para comparar sus pedidos con el Sistema Comercial."
                title="Aún no existe una vista previa"
              />
            ) : (
              <>
                <SectionPanel
                  aside={
                    <StatusBadge
                      tone={
                        selectedBatch.status === "READY" ? "success" : "warning"
                      }
                    >
                      {batchStatusLabels[selectedBatch.status] ??
                        selectedBatch.status}
                    </StatusBadge>
                  }
                  description={`${selectedBatch.fileName} · Cargado por ${selectedBatch.uploadedBy.name} el ${dateFormatter.format(selectedBatch.uploadedAt)}`}
                  title="Resultado del análisis"
                >
                  <MetricGroup>
                    <Metric
                      label="Aprobadas"
                      value={selectedBatch.importableRows}
                    />
                    <Metric label="Nuevas" value={selectedBatch.newRows} />
                    <Metric
                      label="Para completar"
                      value={selectedBatch.enrichmentRows}
                    />
                    <Metric
                      label="Requieren atención"
                      tone={
                        selectedBatch.blockedRows + selectedBatch.conflictRows >
                        0
                          ? "danger"
                          : "neutral"
                      }
                      value={
                        selectedBatch.blockedRows + selectedBatch.conflictRows
                      }
                    />
                  </MetricGroup>

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-600">
                    <span>{selectedBatch.excludedRows} excluidas</span>
                    <span>{selectedBatch.invalidRows} inválidas</span>
                    <span>{selectedBatch.unchangedRows} sin cambios</span>
                    <span className="font-mono text-xs text-neutral-400">
                      {selectedBatch.fileSha256.slice(0, 12)}…
                    </span>
                  </div>
                </SectionPanel>

                {unresolvedIdentities.length > 0 ? (
                  <SectionPanel
                    description="Cada identidad se vincula una sola vez con un asesor activo."
                    title={`Asesores pendientes (${unresolvedIdentities.length})`}
                  >
                    <div className="divide-y divide-neutral-100">
                      {unresolvedIdentities.map((identity) => (
                        <article
                          className="flex flex-wrap items-center justify-between gap-3 py-3"
                          key={identity.id}
                        >
                          <div>
                            <p className="font-medium text-neutral-900">
                              {identity.displayName ??
                                identity.externalUsername}
                            </p>
                            <p className="mt-1 font-mono text-xs text-neutral-500">
                              {identity.externalUsername} ·{" "}
                              {identity._count.importRows} filas
                            </p>
                          </div>
                          <StatusBadge tone="warning">
                            Pendiente de vincular
                          </StatusBadge>
                        </article>
                      ))}
                    </div>
                  </SectionPanel>
                ) : null}

                <SectionPanel
                  description="Consulta qué ocurriría con cada fila antes de confirmar."
                  title="Detalle por pedido"
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                        <tr>
                          <th className="px-3 py-3 font-medium">Fila</th>
                          <th className="px-3 py-3 font-medium">Orden</th>
                          <th className="px-3 py-3 font-medium">Cliente</th>
                          <th className="px-3 py-3 font-medium">
                            Usuario DITO
                          </th>
                          <th className="px-3 py-3 font-medium">Resultado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {selectedBatch.rows.map((row) => (
                          <tr key={row.id}>
                            <td className="px-3 py-3 text-neutral-500">
                              {row.sourceRow}
                            </td>
                            <td className="px-3 py-3 font-mono text-xs font-semibold text-neutral-800">
                              {row.displayedOrderCode ?? "Sin código"}
                            </td>
                            <td className="max-w-56 truncate px-3 py-3 font-medium text-neutral-900">
                              {readJsonText(row.parsedData, "holderName") ??
                                "No registrado"}
                            </td>
                            <td className="px-3 py-3 text-neutral-600">
                              {row.agentIdentity?.user?.name ??
                                row.agentIdentity?.displayName ??
                                row.ditoUsernameNormalized ??
                                "No registrado"}
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge
                                tone={classificationTone(row.classification)}
                              >
                                {classificationLabels[row.classification] ??
                                  row.classification}
                              </StatusBadge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionPanel>

                <SectionPanel
                  description="La confirmación se habilitará después de resolver asesores y revisar conflictos."
                  title="Confirmar importación"
                >
                  <button
                    className="w-full cursor-not-allowed rounded-xl bg-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-500"
                    disabled
                    type="button"
                  >
                    Confirmación todavía no disponible
                  </button>
                </SectionPanel>
              </>
            )}
          </div>
        </section>
      </div>
    </CommercialAppShell>
  );
}

function readJsonText(value: unknown, key: string): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    key in value &&
    typeof value[key as keyof typeof value] === "string"
  ) {
    return value[key as keyof typeof value] as string;
  }

  return null;
}

function classificationTone(
  classification: string,
): "neutral" | "success" | "warning" | "danger" {
  if (classification === "NEW_ORDER" || classification === "UNCHANGED") {
    return "success";
  }
  if (classification === "CONFLICT" || classification === "INVALID") {
    return "danger";
  }
  if (
    classification === "BLOCKED_IDENTITY" ||
    classification === "ENRICHMENT"
  ) {
    return "warning";
  }

  return "neutral";
}
