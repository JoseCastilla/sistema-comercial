import Link from "next/link";

import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { AssignSharedDitoImportRowsForm } from "@/features/dito-imports/components/assign-shared-dito-import-rows-form";
import { ConfirmDitoImportForm } from "@/features/dito-imports/components/confirm-dito-import-form";
import { DitoImportUploadForm } from "@/features/dito-imports/components/dito-import-upload-form";
import { DeleteDitoImportBatchForm } from "@/features/dito-imports/components/delete-dito-import-batch-form";
import { MarkDitoAgentIdentitySharedForm } from "@/features/dito-imports/components/mark-dito-agent-identity-shared-form";
import { ResolveDitoAgentIdentityForm } from "@/features/dito-imports/components/resolve-dito-agent-identity-form";
import { ResolveDitoImportConflictForm } from "@/features/dito-imports/components/resolve-dito-import-conflict-form";
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

const currentDitoImportParserVersion = "1.7";

const operationLabels: Record<string, string> = {
  NEW_LINE: "Alta nueva",
  PORT_PREPAID: "Portabilidad prepago",
  PORT_POSTPAID: "Portabilidad postpago",
};

const issueLabels: Record<string, string> = {
  STATUS_NOT_APPROVED: "Estado DITO no aprobado",
  OUTSIDE_CURRENT_MONTH: "Fuera del mes actual",
  NON_MOBILE_PRODUCT: "Venta no móvil (Movistar Hogar)",
  MISSING_REQUIRED_VALUE: "Faltan datos requeridos",
  INVALID_DOCUMENT_NUMBER: "El DNI debe tener 8 dígitos",
  INVALID_ORDER_CODE: "Código de orden inválido",
  INVALID_REGISTERED_AT: "Fecha de registro inválida",
  UNKNOWN_OPERATION: "Operación no reconocida",
  MISSING_PORTABILITY_ORIGIN: "Falta Origen Portabilidad",
  UNKNOWN_PORTABILITY_ORIGIN: "Origen de portabilidad no reconocido",
  UNKNOWN_OPERATOR: "Operador cedente no reconocido",
  UNKNOWN_DELIVERY_METHOD: "Método de entrega no reconocido",
  UNKNOWN_PROVINCE: "Provincia no reconocida",
  UNRESOLVED_DITO_IDENTITY: "Falta vincular al asesor",
  SALES_CODE_POINTS_TO_ANOTHER_ORDER: "Código de venta en otra orden",
  VALID_VALUE_CONFLICT: "Datos válidos en conflicto",
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
      updatedAt: true,
      confirmedAt: true,
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
          parserVersion: true,
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
              conflicts: true,
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
          role: { in: ["AGENT", "SUPERVISOR"] },
          user: {
            status: "ACTIVE",
            commercialTeamMemberships: {
              some: {
                salesEnabled: true,
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
                  salesEnabled: true,
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
  const conflictRows =
    selectedBatch?.rows.flatMap((row) => {
      if (row.classification !== "CONFLICT") return [];

      const conflicts = readResolvableConflicts(row.conflicts);

      return conflicts.length > 0
        ? [
            {
              id: row.id,
              orderCode: row.displayedOrderCode ?? "Orden sin código",
              customerName:
                readJsonText(row.parsedData, "holderName") ??
                "Cliente no registrado",
              updatedAt: row.updatedAt.toISOString(),
              conflicts,
            },
          ]
        : [];
    }) ?? [];
  const dateFormatter = new Intl.DateTimeFormat("es-PE", {
    timeZone: membership.organization.timezone,
    dateStyle: "short",
    timeStyle: "short",
  });
  const confirmationDisabledReason = selectedBatch
    ? getConfirmationDisabledReason(
        selectedBatch.status,
        selectedBatch.parserVersion,
        selectedBatch.importableRows,
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
              description="Mostramos las 8 últimas. Puedes retirar vistas previas; las confirmadas conservan la trazabilidad."
              title="Cargas recientes"
            >
              {recentBatches.length === 0 ? (
                <p className="text-sm text-ui-muted">
                  Todavía no existen archivos analizados.
                </p>
              ) : (
                <nav aria-label="Cargas DITO recientes" className="space-y-2">
                  {recentBatches.map((batch) => (
                    <article
                      className="rounded-xl border border-ui-border px-3 py-3 transition has-[a[aria-current=page]]:border-ui-success has-[a[aria-current=page]]:bg-ui-success-soft"
                      key={batch.id}
                    >
                      <Link
                        aria-current={
                          batch.id === selectedBatch?.id ? "page" : undefined
                        }
                        className="block"
                        href={`/admin/dito-imports?batch=${batch.id}`}
                      >
                        <span className="block truncate text-sm font-medium text-ui-text">
                          {batch.fileName}
                        </span>
                        <span className="mt-1 block text-xs text-ui-muted">
                          {dateFormatter.format(batch.uploadedAt)} ·{" "}
                          {batch.importableRows} aprobadas ·{" "}
                          {batchStatusLabels[batch.status] ?? batch.status}
                        </span>
                      </Link>
                      {!batch.confirmedAt &&
                      ["PREVIEW", "READY", "FAILED"].includes(batch.status) ? (
                        <DeleteDitoImportBatchForm
                          batchId={batch.id}
                          expectedUpdatedAt={batch.updatedAt.toISOString()}
                          fileName={batch.fileName}
                        />
                      ) : null}
                    </article>
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
                          selectedBatch.invalidRows +
                          selectedBatch.conflictRows >
                        0
                          ? "danger"
                          : "neutral"
                      }
                      value={
                        unresolvedIdentities.length +
                        pendingSharedRows +
                        selectedBatch.invalidRows +
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
                  {selectedBatch.parserVersion !==
                  currentDitoImportParserVersion ? (
                    <p className="mt-4 rounded-xl border border-ui-warning bg-ui-warning-soft px-4 py-3 text-sm text-ui-warning">
                      Este lote se procesó con una versión anterior del lector.
                      Genera una nueva vista previa para conservar todos los
                      campos disponibles antes de confirmar.
                    </p>
                  ) : null}
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
                          salesAdvisorName: readJsonText(
                            row.parsedData,
                            "salesAdvisorName",
                          ),
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

                {conflictRows.length > 0 ? (
                  <SectionPanel
                    description="Compara cada diferencia. El sistema conserva el valor actual por defecto y registra tu decisión."
                    title={`Resolver conflictos (${conflictRows.length})`}
                  >
                    <div className="space-y-4">
                      {conflictRows.map((row) => (
                        <ResolveDitoImportConflictForm
                          batchId={selectedBatch.id}
                          key={row.id}
                          row={row}
                        />
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
                      <thead className="border-b border-ui-border text-xs uppercase tracking-wide text-ui-muted">
                        <tr>
                          <th className="px-3 py-3 font-medium">Fila</th>
                          <th className="px-3 py-3 font-medium">Orden</th>
                          <th className="px-3 py-3 font-medium">Cliente</th>
                          <th className="px-3 py-3 font-medium">Operación</th>
                          <th className="px-3 py-3 font-medium">
                            Asesor / cuenta DITO
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
                            <td className="px-3 py-3 text-ui-text">
                              <span className="block font-medium">
                                {operationLabel(
                                  row.parsedData,
                                  selectedBatch.parserVersion,
                                )}
                              </span>
                              <span className="mt-1 block text-xs text-ui-muted">
                                {portabilityOriginLabel(
                                  row.parsedData,
                                  selectedBatch.parserVersion,
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-ui-muted">
                              <span className="block font-medium text-ui-text">
                                {readJsonText(
                                  row.parsedData,
                                  "salesAdvisorName",
                                ) ?? "Asesor no reportado"}
                              </span>
                              <span className="mt-1 block font-mono text-xs text-ui-muted">
                                Cuenta: {row.ditoUsernameNormalized ?? "N/D"}
                              </span>
                              {(row.manualAgent?.name ??
                              row.targetOrder?.agent?.name ??
                              row.agentIdentity?.user?.name) ? (
                                <span className="mt-1 block text-xs text-ui-success">
                                  Vinculado:{" "}
                                  {row.manualAgent?.name ??
                                    row.targetOrder?.agent?.name ??
                                    row.agentIdentity?.user?.name}
                                </span>
                              ) : null}
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
                              {row.issueCodes.length > 0 ? (
                                <span className="mt-1.5 block max-w-64 text-xs leading-5 text-ui-danger">
                                  {row.issueCodes
                                    .map((issue) => issueLabels[issue] ?? issue)
                                    .join(" · ")}
                                </span>
                              ) : null}
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

type ConflictScalar = string | number | null;

const resolvableConflictFields = new Set([
  "commercialOperation",
  "carrier",
  "fixedCharge",
  "holderFullNameRaw",
  "holderDocumentType",
  "holderDocumentNumber",
  "serviceNumber",
  "deliveryMethod",
  "deliveryMethodRaw",
  "deliveryAddress",
  "deliveryReference",
  "deliveryLatitude",
  "deliveryLongitude",
  "department",
  "province",
  "district",
]);

function readResolvableConflicts(value: unknown): Array<{
  field: string;
  current: ConflictScalar;
  incoming: ConflictScalar;
}> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("field" in entry) ||
      typeof entry.field !== "string" ||
      !resolvableConflictFields.has(entry.field) ||
      !("current" in entry) ||
      !("incoming" in entry) ||
      !isConflictScalar(entry.current) ||
      !isConflictScalar(entry.incoming)
    ) {
      return [];
    }

    return [
      { field: entry.field, current: entry.current, incoming: entry.incoming },
    ];
  });
}

function isConflictScalar(value: unknown): value is ConflictScalar {
  return (
    value === null || typeof value === "string" || typeof value === "number"
  );
}

function operationLabel(value: unknown, parserVersion: string): string {
  const operation = readJsonText(value, "commercialOperation");
  const origin = readJsonText(value, "portabilityOriginRaw");

  if (
    parserVersion !== currentDitoImportParserVersion &&
    operation?.startsWith("PORT_") &&
    !origin
  ) {
    return "Portabilidad por revisar";
  }

  return operation
    ? (operationLabels[operation] ?? operation)
    : "Sin clasificar";
}

function portabilityOriginLabel(value: unknown, parserVersion: string): string {
  const operation = readJsonText(value, "commercialOperation");
  const origin = readJsonText(value, "portabilityOriginRaw");

  if (operation === "NEW_LINE") return "No requiere origen";
  if (origin) return `Origen declarado: ${origin}`;
  if (parserVersion !== currentDitoImportParserVersion) {
    return `Origen no informado · análisis ${parserVersion}`;
  }

  return "Origen no informado";
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
  parserVersion: string,
  importableRows: number,
  unresolvedIdentities: number,
  pendingSharedRows: number,
  conflicts: number,
): string | null {
  if (status === "CONFIRMING") {
    return "La importación ya está siendo procesada.";
  }
  if (parserVersion !== currentDitoImportParserVersion) {
    return "Esta vista previa usa un lector anterior. Genera una nueva antes de confirmar.";
  }
  if (importableRows === 0) {
    return "No existen filas válidas para importar. Revisa los motivos y carga un archivo corregido.";
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
