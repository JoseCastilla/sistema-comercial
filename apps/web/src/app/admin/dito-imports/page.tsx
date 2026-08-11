import Link from "next/link";

import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { AssignSharedDitoImportRowsForm } from "@/features/dito-imports/components/assign-shared-dito-import-rows-form";
import { ConfirmDitoImportForm } from "@/features/dito-imports/components/confirm-dito-import-form";
import { DitoImportUploadForm } from "@/features/dito-imports/components/dito-import-upload-form";
import { MarkDitoAgentIdentitySharedForm } from "@/features/dito-imports/components/mark-dito-agent-identity-shared-form";
import { ResolveDitoAgentIdentityForm } from "@/features/dito-imports/components/resolve-dito-agent-identity-form";
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
  searchParams: Promise<{ batch?: string; confirmed?: string }>;
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
          updatedAt: true,
          uploadedAt: true,
          confirmedAt: true,
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
          confirmedBy: { select: { name: true } },
          rows: {
            orderBy: { sourceRow: "asc" },
            take: 100,
            select: {
              id: true,
              sourceRow: true,
              updatedAt: true,
              classification: true,
              applicationStatus: true,
              issueCodes: true,
              displayedOrderCode: true,
              ditoUsernameNormalized: true,
              parsedData: true,
              manualAgentUserId: true,
              manualAgent: { select: { name: true } },
              targetOrder: {
                select: {
                  agentUserId: true,
                  assignedTeamId: true,
                  agent: { select: { name: true } },
                },
              },
              agentIdentity: {
                select: {
                  id: true,
                  externalUsername: true,
                  displayName: true,
                  isSharedAccount: true,
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
          isSharedAccount: false,
          userId: null,
          importRows: { some: { batchId: selectedBatch.id } },
        },
        orderBy: { externalUsernameNormalized: "asc" },
        select: {
          id: true,
          updatedAt: true,
          externalUsername: true,
          displayName: true,
          _count: {
            select: { importRows: { where: { batchId: selectedBatch.id } } },
          },
        },
      })
    : [];
  const eligibleAgentMembers = selectedBatch
    ? await database.organizationMember.findMany({
        where: {
          organizationId,
          role: "AGENT",
          user: {
            status: "ACTIVE",
            commercialTeamMemberships: {
              some: {
                memberRole: "AGENT",
                isPrimary: true,
                isActive: true,
                team: { organizationId, status: "ACTIVE" },
              },
            },
          },
        },
        orderBy: { user: { name: "asc" } },
        select: {
          userId: true,
          user: {
            select: {
              name: true,
              commercialTeamMemberships: {
                where: {
                  memberRole: "AGENT",
                  isPrimary: true,
                  isActive: true,
                  team: { organizationId, status: "ACTIVE" },
                },
                take: 2,
                select: { team: { select: { name: true } } },
              },
            },
          },
        },
      })
    : [];
  const eligibleAgents = eligibleAgentMembers.flatMap((member) => {
    const memberships = member.user.commercialTeamMemberships;

    return memberships.length === 1 && memberships[0]
      ? [
          {
            id: member.userId,
            name: member.user.name,
            teamName: memberships[0].team.name,
          },
        ]
      : [];
  });
  const sharedRows =
    selectedBatch?.rows.filter(
      (row) =>
        row.agentIdentity?.isSharedAccount &&
        row.classification !== "EXCLUDED" &&
        row.classification !== "INVALID",
    ) ?? [];
  const sharedRowsNeedingManualAssignment = sharedRows.filter(
    (row) => !row.targetOrder?.agentUserId || !row.targetOrder.assignedTeamId,
  );
  const pendingSharedRows = sharedRowsNeedingManualAssignment.filter(
    (row) => !row.manualAgentUserId,
  ).length;
  const dateFormatter = new Intl.DateTimeFormat("es-PE", {
    timeZone: membership.organization.timezone,
    dateStyle: "short",
    timeStyle: "short",
  });
  const confirmationDisabledReason = selectedBatch
    ? getConfirmationDisabledReason(
        selectedBatch.status,
        unresolvedIdentities.length,
        pendingSharedRows,
        selectedBatch.conflictRows,
      )
    : null;

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
                <p className="text-sm text-ui-muted">
                  Todavía no existen archivos analizados.
                </p>
              ) : (
                <nav aria-label="Cargas DITO recientes" className="space-y-2">
                  {recentBatches.map((batch) => (
                    <Link
                      aria-current={
                        batch.id === selectedBatch?.id ? "page" : undefined
                      }
                      className="block rounded-xl border border-ui-border px-3 py-3 transition hover:border-ui-border-strong aria-[current=page]:border-ui-success aria-[current=page]:bg-ui-success-soft"
                      href={`/admin/dito-imports?batch=${batch.id}`}
                      key={batch.id}
                    >
                      <span className="block truncate text-sm font-medium text-ui-text">
                        {batch.fileName}
                      </span>
                      <span className="mt-1 block text-xs text-ui-muted">
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
                        unresolvedIdentities.length +
                          pendingSharedRows +
                          selectedBatch.conflictRows >
                        0
                          ? "danger"
                          : "neutral"
                      }
                      value={
                        unresolvedIdentities.length +
                        pendingSharedRows +
                        selectedBatch.conflictRows
                      }
                    />
                  </MetricGroup>

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ui-muted">
                    <span>{selectedBatch.excludedRows} excluidas</span>
                    <span>{selectedBatch.invalidRows} inválidas</span>
                    <span>{selectedBatch.unchangedRows} sin cambios</span>
                    <span className="font-mono text-xs text-ui-soft">
                      {selectedBatch.fileSha256.slice(0, 12)}…
                    </span>
                  </div>
                </SectionPanel>

                {unresolvedIdentities.length > 0 ? (
                  <SectionPanel
                    description="Vincula cuentas personales. Si varias personas utilizaron la misma cuenta, asigna sus ventas por orden."
                    title={`Asesores pendientes (${unresolvedIdentities.length})`}
                  >
                    <div className="divide-y divide-neutral-100">
                      {unresolvedIdentities.map((identity) => (
                        <article
                          className="flex flex-wrap items-center justify-between gap-3 py-3"
                          key={identity.id}
                        >
                          <div>
                            <p className="font-medium text-ui-text">
                              {identity.displayName ??
                                identity.externalUsername}
                            </p>
                            <p className="mt-1 font-mono text-xs text-ui-muted">
                              {identity.externalUsername} ·{" "}
                              {identity._count.importRows} filas
                            </p>
                          </div>
                          <div className="space-y-2">
                            <ResolveDitoAgentIdentityForm
                              agents={eligibleAgents}
                              batchId={selectedBatch.id}
                              identity={{
                                id: identity.id,
                                updatedAt: identity.updatedAt.toISOString(),
                              }}
                            />
                            <MarkDitoAgentIdentitySharedForm
                              batchId={selectedBatch.id}
                              identity={{
                                id: identity.id,
                                updatedAt: identity.updatedAt.toISOString(),
                              }}
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  </SectionPanel>
                ) : null}

                {sharedRows.length > 0 ? (
                  <SectionPanel
                    description="La cuenta de reserva no identifica al vendedor. Las órdenes ya asociadas conservan su responsable; completa únicamente las pendientes."
                    title={`Cuenta compartida · ${pendingSharedRows} pendientes`}
                  >
                    {sharedRowsNeedingManualAssignment.length > 0 ? (
                      <AssignSharedDitoImportRowsForm
                        agents={eligibleAgents}
                        batchId={selectedBatch.id}
                        rows={sharedRowsNeedingManualAssignment.map((row) => ({
                          id: row.id,
                          orderCode:
                            row.displayedOrderCode ?? "Orden sin código",
                          customerName:
                            readJsonText(row.parsedData, "holderName") ??
                            "Cliente no registrado",
                          updatedAt: row.updatedAt.toISOString(),
                          assignedUserId: row.manualAgentUserId,
                        }))}
                      />
                    ) : (
                      <p className="text-sm text-ui-success">
                        Todas las ventas de esta cuenta ya tienen un responsable
                        confiable.
                      </p>
                    )}
                  </SectionPanel>
                ) : null}

                <SectionPanel
                  description="Consulta qué ocurriría con cada fila antes de confirmar."
                  title="Detalle por pedido"
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-ui-border text-xs uppercase tracking-wide text-ui-muted">
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
                            <td className="px-3 py-3 text-ui-muted">
                              {row.sourceRow}
                            </td>
                            <td className="px-3 py-3 font-mono text-xs font-semibold text-ui-text">
                              {row.displayedOrderCode ?? "Sin código"}
                            </td>
                            <td className="max-w-56 truncate px-3 py-3 font-medium text-ui-text">
                              {readJsonText(row.parsedData, "holderName") ??
                                "No registrado"}
                            </td>
                            <td className="px-3 py-3 text-ui-muted">
                              {row.manualAgent?.name ??
                                row.targetOrder?.agent?.name ??
                                row.agentIdentity?.user?.name ??
                                row.agentIdentity?.displayName ??
                                row.ditoUsernameNormalized ??
                                "No registrado"}
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge
                                tone={
                                  row.manualAgentUserId ||
                                  (row.agentIdentity?.isSharedAccount &&
                                    row.targetOrder?.agentUserId &&
                                    row.targetOrder.assignedTeamId)
                                    ? "success"
                                    : classificationTone(row.classification)
                                }
                              >
                                {row.manualAgentUserId
                                  ? "Asesor asignado"
                                  : row.agentIdentity?.isSharedAccount &&
                                      row.targetOrder?.agentUserId &&
                                      row.targetOrder.assignedTeamId
                                    ? "Conservar asesor"
                                    : (classificationLabels[
                                        row.classification
                                      ] ?? row.classification)}
                              </StatusBadge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionPanel>

                <SectionPanel
                  description="Aplica todo el lote en una sola transacción y conserva el historial de los datos completados."
                  title="Confirmar importación"
                >
                  {selectedBatch.status === "CONFIRMED" ? (
                    <div className="rounded-xl border border-ui-success bg-ui-success-soft px-4 py-4 text-sm text-ui-success">
                      <p className="font-semibold">Importación confirmada</p>
                      <p className="mt-1">
                        {selectedBatch.newRows} ventas creadas ·{" "}
                        {selectedBatch.enrichmentRows} completadas ·{" "}
                        {selectedBatch.unchangedRows} sin cambios.
                      </p>
                      {selectedBatch.confirmedAt ? (
                        <p className="mt-1 text-ui-success">
                          {selectedBatch.confirmedBy?.name ?? "Administrador"} ·{" "}
                          {dateFormatter.format(selectedBatch.confirmedAt)}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <ConfirmDitoImportForm
                      batchId={selectedBatch.id}
                      disabledReason={confirmationDisabledReason}
                      expectedUpdatedAt={selectedBatch.updatedAt.toISOString()}
                    />
                  )}
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

function getConfirmationDisabledReason(
  status: string,
  unresolvedIdentities: number,
  pendingSharedRows: number,
  conflicts: number,
): string | null {
  if (status === "CONFIRMING") {
    return "La importación ya está siendo procesada.";
  }
  if (unresolvedIdentities > 0) {
    return `Vincula ${unresolvedIdentities} ${unresolvedIdentities === 1 ? "asesor pendiente" : "asesores pendientes"} antes de confirmar.`;
  }
  if (pendingSharedRows > 0) {
    return `Identifica al asesor de ${pendingSharedRows} ${pendingSharedRows === 1 ? "venta de cuenta compartida" : "ventas de cuenta compartida"} antes de confirmar.`;
  }
  if (conflicts > 0) {
    return `Revisa ${conflicts} ${conflicts === 1 ? "conflicto" : "conflictos"} antes de confirmar.`;
  }

  return null;
}
