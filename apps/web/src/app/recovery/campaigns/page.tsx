import {
  baseRecoveryMinimumDailyAttempts,
  countOnSameLimaDay,
  isBaseRecoveryResolutionDue,
} from "@repo/validation";

import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { CopyValue } from "@/features/recovery/components/copy-value";
import { TakePoolBlockForm } from "@/features/recovery/components/take-pool-block-form";
import { returnStaleBaseCasesToPool } from "@/features/recovery/server/return-stale-base-cases";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import { SignOutButton } from "@/app/orders/sign-out-button";

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function summarizePlan(planRaw: string | null): string {
  if (!planRaw) return "—";
  const match = planRaw.match(/S\/\s?\d+(?:\.\d+)?/);
  return match ? `Máximo ${match[0]}` : planRaw;
}

const statusLabels: Record<string, string> = {
  ASSIGNED: "Asignado",
  IN_PROGRESS: "En gestión",
  SCHEDULED: "Agendado",
};

/**
 * Cola de campaña del asesor — SPEC-030 BR-029b, BR-032, BR-058 y BR-078.
 * Muestra sus casos asignados con la exigencia del día y el pool de su
 * equipo, del que toma bloques de hasta 10 casos.
 */
export default async function RecoveryCampaignsPage() {
  const { session, membership } = await requireCommercialAccess();

  // BR-077: al abrir la cola, lo abandonado ya volvió al pool.
  await returnStaleBaseCasesToPool(membership.organization.id);

  const now = new Date();

  const [myCases, sellingMembership] = await Promise.all([
    database.recoveryCase.findMany({
      where: {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        assignedUserId: session.user.id,
        status: { in: ["ASSIGNED", "IN_PROGRESS", "SCHEDULED"] },
      },
      orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }],
      take: 100,
      select: {
        id: true,
        holderName: true,
        documentNumber: true,
        department: true,
        status: true,
        claimedAt: true,
        nextActionAt: true,
        portabilityEligibleAt: true,
        services: {
          where: { discardedAt: null },
          select: { planRaw: true },
        },
        attempts: {
          orderBy: { createdAt: "desc" },
          take: 15,
          select: { createdAt: true },
        },
      },
    }),
    database.commercialTeamMember.findFirst({
      where: {
        organizationId: membership.organization.id,
        userId: session.user.id,
        salesEnabled: true,
        isActive: true,
        isPrimary: true,
        team: { status: "ACTIVE" },
      },
      select: { teamId: true, team: { select: { name: true } } },
    }),
  ]);

  const poolWhere = sellingMembership
    ? {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE" as const,
        status: "OPEN" as const,
        assignedTeamId: sellingMembership.teamId,
        assignedUserId: null,
      }
    : null;

  const [poolCount, poolDepartments] = poolWhere
    ? await Promise.all([
        database.recoveryCase.count({ where: poolWhere }),
        database.recoveryCase.groupBy({
          by: ["department"],
          where: poolWhere,
          _count: { _all: true },
          orderBy: { _count: { department: "desc" } },
          take: 30,
        }),
      ])
    : [0, []];

  const rows = myCases.map((item) => {
    const attemptsToday = countOnSameLimaDay(
      item.attempts.map((attempt) => attempt.createdAt),
      now,
    );
    return {
      id: item.id,
      holderName: item.holderName,
      documentNumber: item.documentNumber,
      department: item.department,
      status: String(item.status),
      planSummary: summarizePlan(item.services[0]?.planRaw ?? null),
      serviceCount: item.services.length,
      attemptsToday,
      nextActionAtLabel: item.nextActionAt
        ? dateTimeFormatter.format(item.nextActionAt)
        : null,
      overdue:
        item.nextActionAt !== null &&
        item.nextActionAt.getTime() < now.getTime(),
      habilitationOverdue:
        item.portabilityEligibleAt !== null &&
        item.portabilityEligibleAt.getTime() <= now.getTime(),
      resolutionDue:
        item.claimedAt !== null &&
        isBaseRecoveryResolutionDue(item.claimedAt, now),
    };
  });

  const dueToday = rows.filter((row) => row.overdue || row.resolutionDue);
  const underMinimum = rows.filter(
    (row) =>
      row.status !== "SCHEDULED" &&
      row.attemptsToday < baseRecoveryMinimumDailyAttempts,
  );

  const departments = poolDepartments
    .map((group) => group.department)
    .filter((value): value is string => value !== null && value.length > 0);

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
          title="Mi cola de campaña"
          description="Tus casos de base asignados y el pool de tu equipo. Un caso sin respuesta exige tres intentos en el día."
        />

        <MetricGroup>
          <Metric label="Mis casos abiertos" value={rows.length} />
          <Metric label="Vencidos o por resolver" value={dueToday.length} />
          <Metric label="Sin los 3 intentos de hoy" value={underMinimum.length} />
          <Metric
            label={
              sellingMembership
                ? `Pool de ${sellingMembership.team.name}`
                : "Pool del equipo"
            }
            value={poolCount}
          />
        </MetricGroup>

        {sellingMembership ? (
          <SectionPanel
            title="Tomar trabajo del pool"
            description="Bloques de hasta 10 casos, los más recientes primero. Las habilitaciones vencidas llegan al inicio porque su ventana es más corta."
          >
            <TakePoolBlockForm departments={departments} />
          </SectionPanel>
        ) : (
          <SectionPanel
            title="Sin equipo vendedor"
            description="No tienes venta habilitada en un equipo activo, así que no puedes tomar casos del pool."
          >
            <p className="text-sm text-ui-muted">
              Si distribuyes trabajo, hazlo desde{" "}
              <a
                className="text-ui-accent underline-offset-2 hover:underline"
                href="/recovery/distribute"
              >
                Distribuir la base
              </a>
              .
            </p>
          </SectionPanel>
        )}

        <SectionPanel
          title="Mis casos"
          description="Ordenados por la próxima acción. Al séptimo día de gestión un caso sin venta ni agenda exige resolverse."
        >
          <div className="overflow-x-auto rounded-xl border border-ui-border">
            <table className="min-w-full divide-y divide-ui-border text-sm">
              <thead className="bg-ui-surface-muted text-left text-xs uppercase tracking-wide text-ui-muted">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">DNI</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Intentos hoy</th>
                  <th className="px-3 py-2">Próxima acción</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border bg-ui-surface">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-medium text-ui-text">
                      {row.holderName}
                      {row.resolutionDue ? (
                        <span className="ml-2 rounded-full bg-ui-danger-soft px-2 py-0.5 text-[11px] text-ui-danger">
                          Resolver hoy
                        </span>
                      ) : null}
                      {row.habilitationOverdue ? (
                        <span className="ml-2 rounded-full bg-ui-warning-soft px-2 py-0.5 text-[11px] text-ui-warning">
                          Habilitada para portar
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <CopyValue label="DNI" value={row.documentNumber} />
                    </td>
                    <td className="px-3 py-2 text-xs text-ui-muted">
                      {row.planSummary}
                      {row.serviceCount > 1
                        ? ` · ${row.serviceCount} líneas`
                        : ""}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {statusLabels[row.status] ?? row.status}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={
                          row.status !== "SCHEDULED" &&
                          row.attemptsToday < baseRecoveryMinimumDailyAttempts
                            ? "font-semibold text-ui-warning"
                            : "text-ui-muted"
                        }
                      >
                        {row.attemptsToday} / {baseRecoveryMinimumDailyAttempts}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={
                          row.overdue
                            ? "font-semibold text-ui-danger"
                            : "text-ui-muted"
                        }
                      >
                        {row.nextActionAtLabel ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <a
                        className="text-ui-accent underline-offset-2 hover:underline"
                        href={`/recovery/campaigns/${row.id}`}
                      >
                        Abrir
                      </a>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-ui-muted"
                      colSpan={7}
                    >
                      No tienes casos de campaña asignados. Toma un bloque del
                      pool para empezar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionPanel>
      </div>
    </CommercialAppShell>
  );
}
