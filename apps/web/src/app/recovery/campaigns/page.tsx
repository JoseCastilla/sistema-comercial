import {
  baseRecoveryMinimumDailyAttempts,
  countOnSameLimaDay,
  describeRecoveryLineOrigin,
  isBaseRecoveryResolutionDue,
} from "@repo/validation";

import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { CopyValue } from "@/features/recovery/components/copy-value";
import { TakePoolBlockForm } from "@/features/recovery/components/take-pool-block-form";
import { returnStaleBaseCasesToPool } from "@/features/recovery/server/return-stale-base-cases";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { Prisma } from "@repo/database";

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
  WAITING: "En verificación",
};

/**
 * Cola de campaña del asesor — SPEC-030 BR-029b, BR-032, BR-058 y BR-078.
 * Muestra sus casos asignados con la exigencia del día y el pool de su
 * equipo, del que toma bloques de hasta 10 casos.
 */
const pageSize = 100;

export default async function RecoveryCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string; plan?: string; page?: string }>;
}) {
  const { session, membership } = await requireCommercialAccess();
  const parameters = await searchParams;
  const departmentFilter = parameters.department ?? "";
  const planFilter = (parameters.plan ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(parameters.page ?? "1", 10) || 1);

  // BR-077: al abrir la cola, lo abandonado ya volvió al pool.
  await returnStaleBaseCasesToPool(membership.organization.id);

  const now = new Date();

  /**
   * "Hoy solo llamo Lima": la bandeja propia se filtra igual que el pool.
   * El orden es el del día del asesor — vencidos primero, luego lo de hoy,
   * después los agendados, y al fondo lo que está en verificación.
   */
  const myCasesWhere: Prisma.RecoveryCaseWhereInput = {
    organizationId: membership.organization.id,
    source: "NATIONAL_BASE",
    assignedUserId: session.user.id,
    // WAITING incluido: el reportado como "ya Movistar" queda visible al
    // fondo, en verificación, sin exigir gestión (BR-085).
    status: {
      in: ["ASSIGNED", "IN_PROGRESS", "SCHEDULED", "WAITING"],
    },
    ...(departmentFilter
      ? { department: { equals: departmentFilter, mode: "insensitive" } }
      : {}),
    ...(planFilter
      ? {
          services: {
            some: {
              discardedAt: null,
              planRaw: { contains: planFilter, mode: "insensitive" },
            },
          },
        }
      : {}),
  };

  const [myCases, myTotal, myDepartments, sellingMembership] =
    await Promise.all([
    database.recoveryCase.findMany({
      where: myCasesWhere,
      orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
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
          select: {
            planRaw: true,
            serviceNumber: true,
            carrierRaw: true,
            portabilityState: true,
            portabilityReceiver: true,
            portabilityWindowAt: true,
            isPlantLine: true,
          },
        },
        phones: {
          where: { kind: "CONTACT", invalidMarkedAt: null },
          take: 1,
          select: { phoneNumber: true },
        },
        attempts: {
          orderBy: { createdAt: "desc" },
          take: 15,
          select: { createdAt: true, result: true },
        },
      },
    }),
    database.recoveryCase.count({ where: myCasesWhere }),
    database.recoveryCase.groupBy({
      by: ["department"],
      where: {
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        assignedUserId: session.user.id,
        status: {
          in: ["ASSIGNED", "IN_PROGRESS", "SCHEDULED", "WAITING"],
        },
      },
      _count: { _all: true },
      orderBy: { _count: { department: "desc" } },
      take: 30,
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
    const lastResult = item.attempts[0] ? String(item.attempts[0].result) : null;
    const firstService = item.services[0];
    const origin = firstService
      ? describeRecoveryLineOrigin({
          carrierRaw: firstService.carrierRaw,
          portabilityState: firstService.portabilityState
            ? (String(firstService.portabilityState) as never)
            : null,
          portabilityReceiver: firstService.portabilityReceiver,
          portabilityWindowAt: firstService.portabilityWindowAt,
          isPlantLine: firstService.isPlantLine,
          now,
        })
      : null;
    return {
      origin,
      // Llamar es la acción: primero el teléfono de contacto; sin él, la
      // propia línea a portar.
      phone:
        item.phones[0]?.phoneNumber ??
        item.services[0]?.serviceNumber ??
        null,
      interestedWithOrder:
        lastResult === "INTERESADO_CON_PEDIDO" &&
        String(item.status) !== "WAITING",
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
      row.status !== "WAITING" &&
      row.attemptsToday < baseRecoveryMinimumDailyAttempts,
  );

  const departments = poolDepartments
    .map((group) => group.department)
    .filter((value): value is string => value !== null && value.length > 0);
  const myDepartmentOptions = myDepartments
    .map((group) => group.department)
    .filter((value): value is string => value !== null && value.length > 0);

  const totalPages = Math.max(1, Math.ceil(myTotal / pageSize));

  function pageHref(target: number): string {
    const query = new URLSearchParams();
    if (departmentFilter) query.set("department", departmentFilter);
    if (planFilter) query.set("plan", planFilter);
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return `/recovery/campaigns${suffix ? `?${suffix}` : ""}`;
  }

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
          <Metric label="Mis casos abiertos" value={myTotal} />
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
          description="Vencidos primero, luego lo de hoy, después los agendados; lo que está en verificación queda al fondo."
        >
          <form
            action="/recovery/campaigns"
            className="flex flex-wrap items-end gap-3"
            method="get"
          >
            <label className="block">
              <span className="ui-label-eyebrow">Departamento</span>
              <select
                className="block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
                defaultValue={departmentFilter}
                name="department"
              >
                <option value="">Todos</option>
                {myDepartmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="ui-label-eyebrow">Plan contiene</span>
              <input
                className="block w-32 rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
                defaultValue={planFilter}
                maxLength={100}
                name="plan"
                placeholder="49.9"
              />
            </label>
            <button className="ui-button ui-button--secondary" type="submit">
              Filtrar
            </button>
            <span className="pb-2 text-xs text-ui-muted">
              {myTotal.toLocaleString("es-PE")} caso(s) cumplen el filtro.
            </span>
          </form>

          <div className="overflow-x-auto rounded-xl border border-ui-border">
            <table className="min-w-full divide-y divide-ui-border text-sm">
              <thead className="bg-ui-surface-muted text-left text-xs uppercase tracking-wide text-ui-muted">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Teléfono</th>
                  <th className="px-3 py-2">DNI</th>
                  <th className="px-3 py-2">Operador</th>
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
                      {row.interestedWithOrder ? (
                        <span className="ml-2 rounded-full bg-ui-accent-soft px-2 py-0.5 text-[11px] text-ui-accent">
                          Pedido en curso: ¿ya cayó?
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {row.phone ? (
                        <CopyValue label="Teléfono" value={row.phone} />
                      ) : (
                        <span className="text-xs text-ui-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <CopyValue label="DNI" value={row.documentNumber} />
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.origin ? (
                        <>
                          <span className="font-medium text-ui-text">
                            {row.origin.operator}
                          </span>
                          {row.origin.detail ? (
                            <span className="block text-[11px] text-ui-muted">
                              {row.origin.detail}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-ui-muted">—</span>
                      )}
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
                          row.status !== "WAITING" &&
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
                      colSpan={9}
                    >
                      No tienes casos de campaña asignados. Toma un bloque del
                      pool para empezar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center gap-3 text-sm">
              {page > 1 ? (
                <a
                  className="text-ui-accent underline-offset-2 hover:underline"
                  href={pageHref(page - 1)}
                >
                  ← Anterior
                </a>
              ) : null}
              <span className="text-ui-muted">
                Página {page} de {totalPages}
              </span>
              {page < totalPages ? (
                <a
                  className="text-ui-accent underline-offset-2 hover:underline"
                  href={pageHref(page + 1)}
                >
                  Siguiente →
                </a>
              ) : null}
            </div>
          ) : null}
        </SectionPanel>
      </div>
    </CommercialAppShell>
  );
}
