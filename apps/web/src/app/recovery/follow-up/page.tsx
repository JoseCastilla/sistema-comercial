import Link from "next/link";
import { redirect } from "next/navigation";

import {
  attemptResultLabels,
  attemptResultTones,
} from "@/features/recovery/attempt-result-labels";
import { CopyValue } from "@/features/recovery/components/copy-value";
import { QueueFilters } from "@/features/recovery/components/queue-filters";
import { buildRecoverySearchWhere } from "@/features/recovery/server/recovery-search-where";
import { returnStaleBaseCasesToPool } from "@/features/recovery/server/return-stale-base-cases";
import { CampaignNav } from "@/features/recovery/components/campaign-nav";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import {
  allOf,
  countOnSameLimaDay,
  formatAdvisorDisplayName,
  getLimaIsoDate,
  isWithoutFirstContact,
  recoveryFollowUpContactOptions,
  recoveryFollowUpStatusOptions,
  recoveryFollowUpStatuses,
  recoveryFollowUpWorkedOptions,
  recoveryLastResultNone,
  recoveryNextActionBucket,
  recoveryNextActionBuckets,
  recoveryTeamFilterNone,
  selectFollowUpCases,
  type FollowUpFilters,
  type RecoveryFollowUpStatus,
  type RecoveryNextActionBucket,
} from "@repo/validation";

import { formatCount } from "@repo/ui/format";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import type { Prisma } from "@repo/database";

const followUpRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);
const pageSize = 100;

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const statusLabels = Object.fromEntries(
  recoveryFollowUpStatusOptions.map((option) => [option.value, option.label]),
);

const nextActionTones: Record<RecoveryNextActionBucket, string> = {
  vencida: "font-semibold text-ui-danger",
  hoy: "font-semibold text-ui-warning",
  futura: "text-ui-muted",
  sin: "text-ui-muted",
};

function pick<T extends string>(
  value: string | undefined,
  allowed: ReadonlyArray<{ value: T }>,
): T | null {
  const text = (value ?? "").trim();

  return allowed.some((option) => option.value === text) ? (text as T) : null;
}

/**
 * Seguimiento de la cartera asignada — SPEC-040.
 *
 * Es la lista que le faltaba al tablero: la misma población, las mismas
 * definiciones (BR-053/BR-055), pero por cliente. Un indicador que dice
 * «Sin primer contacto: 27» abre aquí exactamente esos 27 (BR-001).
 * Última tipificación, próxima acción y contacto se resuelven en memoria con
 * la regla pura del paquete de validación, sobre una cartera acotada por
 * alcance: la misma decisión que ya tomó el tablero.
 */
export default async function RecoveryFollowUpPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    team?: string;
    advisor?: string;
    result?: string;
    next?: string;
    contact?: string;
    worked?: string;
    status?: string;
    page?: string;
    visto?: string;
  }>;
}) {
  const { session, membership } = await requireCommercialAccess();

  if (!followUpRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const parameters = await searchParams;
  const searchInput = (parameters.q ?? "").trim().slice(0, 80);
  const teamFilter = parameters.team ?? "";
  const advisorFilter = (parameters.advisor ?? "").trim().slice(0, 40);
  const requestedPage = Math.max(
    1,
    Number.parseInt(parameters.page ?? "1", 10) || 1,
  );
  const justVisited = (parameters.visto ?? "").trim().slice(0, 40);

  const resultFilter =
    parameters.result === recoveryLastResultNone
      ? recoveryLastResultNone
      : parameters.result && parameters.result in attemptResultLabels
        ? parameters.result
        : null;
  const filters: FollowUpFilters = {
    lastResult: resultFilter,
    nextAction: pick(parameters.next, recoveryNextActionBuckets),
    contact: pick(parameters.contact, recoveryFollowUpContactOptions),
    worked: pick(parameters.worked, recoveryFollowUpWorkedOptions),
    status: pick<RecoveryFollowUpStatus>(
      parameters.status,
      recoveryFollowUpStatusOptions,
    ),
  };

  // BR-077: lo abandonado ya volvió al pool; no aparece como cartera de nadie.
  await returnStaleBaseCasesToPool(membership.organization.id);

  const now = new Date();
  const dayStart = new Date(`${getLimaIsoDate(now)}T00:00:00-05:00`);

  const isSupervisor = membership.role === "SUPERVISOR";
  const supervisedTeamIds = isSupervisor
    ? (
        await database.commercialTeamMember.findMany({
          where: {
            organizationId: membership.organization.id,
            userId: session.user.id,
            memberRole: "SUPERVISOR",
            isActive: true,
            team: { status: "ACTIVE" },
          },
          select: { teamId: true },
        })
      ).map((item) => item.teamId)
    : null;

  // BR-004: el mismo alcance que el tablero; la URL solo estrecha.
  const teamScope = supervisedTeamIds
    ? supervisedTeamIds.includes(teamFilter)
      ? teamFilter
      : ""
    : teamFilter;

  const scopeWhere: Prisma.RecoveryCaseWhereInput = {
    organizationId: membership.organization.id,
    source: "NATIONAL_BASE",
    ...(supervisedTeamIds ? { assignedTeamId: { in: supervisedTeamIds } } : {}),
  };

  const portfolioWhere = allOf<Prisma.RecoveryCaseWhereInput>(
    scopeWhere,
    {
      status: { in: [...recoveryFollowUpStatuses] },
      assignedUserId: { not: null },
    },
    teamScope === recoveryTeamFilterNone
      ? { assignedTeamId: null }
      : teamScope
        ? { assignedTeamId: teamScope }
        : null,
    // BR-005: el dueño de hoy. Fuera del alcance no devuelve filas.
    advisorFilter ? { assignedUserId: advisorFilter } : null,
    buildRecoverySearchWhere(searchInput),
  );

  const [portfolio, attemptsToday, teams] = await Promise.all([
    database.recoveryCase.findMany({
      where: portfolioWhere,
      orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }],
      select: {
        id: true,
        holderName: true,
        documentNumber: true,
        status: true,
        firstContactAt: true,
        nextActionAt: true,
        assignedUserId: true,
        assignedUser: { select: { name: true, email: true } },
        assignedTeam: { select: { name: true } },
        phones: {
          where: { kind: "CONTACT", invalidMarkedAt: null },
          take: 1,
          select: { phoneNumber: true },
        },
        services: {
          where: { discardedAt: null },
          take: 1,
          select: { serviceNumber: true },
        },
        attempts: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { result: true, observation: true, createdAt: true },
        },
      },
    }),
    database.recoveryCaseAttempt.findMany({
      where: {
        organizationId: membership.organization.id,
        createdAt: { gte: dayStart },
        case: scopeWhere,
      },
      select: { caseId: true, createdAt: true },
    }),
    isSupervisor
      ? Promise.resolve([])
      : database.commercialTeam.findMany({
          where: {
            organizationId: membership.organization.id,
            status: "ACTIVE",
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
  ]);

  const attemptsByCase = new Map<string, Date[]>();
  for (const attempt of attemptsToday) {
    const list = attemptsByCase.get(attempt.caseId) ?? [];
    list.push(attempt.createdAt);
    attemptsByCase.set(attempt.caseId, list);
  }

  const cases = portfolio.map((item) => ({
    id: item.id,
    holderName: item.holderName,
    documentNumber: item.documentNumber,
    phone:
      item.phones[0]?.phoneNumber ?? item.services[0]?.serviceNumber ?? null,
    status: String(item.status),
    firstContactAt: item.firstContactAt,
    nextActionAt: item.nextActionAt,
    advisorId: item.assignedUserId,
    advisorName: item.assignedUser
      ? formatAdvisorDisplayName(
          item.assignedUser.name,
          item.assignedUser.email,
        )
      : "Sin asesor",
    teamName: item.assignedTeam?.name ?? "—",
    lastResult: item.attempts[0] ? String(item.attempts[0].result) : null,
    lastObservation: item.attempts[0]?.observation ?? null,
    lastAttemptAt: item.attempts[0]?.createdAt ?? null,
    attemptsToday: countOnSameLimaDay(attemptsByCase.get(item.id) ?? [], now),
  }));

  // Las cifras de cabecera cuentan sobre la cartera acotada, no sobre la
  // página: son las del tablero, aquí abribles.
  const withoutContact = cases.filter(isWithoutFirstContact).length;
  // BR-053, como el tablero: «agenda vencida» es una cita agendada que ya
  // pasó, no cualquier próxima acción en el pasado. La cabecera y el
  // indicador que la abre cuentan lo mismo (BR-001).
  const overdue = cases.filter(
    (item) =>
      item.status === "SCHEDULED" &&
      recoveryNextActionBucket(item.nextActionAt, now) === "vencida",
  ).length;
  const workedToday = cases.filter((item) => item.attemptsToday > 0).length;

  const selected = selectFollowUpCases(cases, filters, now);
  const totalPages = Math.max(1, Math.ceil(selected.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const rows = selected.slice((page - 1) * pageSize, page * pageSize);

  const advisors = [
    ...new Map(
      cases
        .filter((item) => item.advisorId)
        .map((item) => [
          item.advisorId as string,
          {
            id: item.advisorId as string,
            name: `${item.advisorName} · ${item.teamName}`,
          },
        ]),
    ).values(),
  ].sort((left, right) => left.name.localeCompare(right.name, "es"));

  const query = new URLSearchParams();
  if (searchInput) query.set("q", searchInput);
  if (teamScope) query.set("team", teamScope);
  if (advisorFilter) query.set("advisor", advisorFilter);
  if (filters.lastResult) query.set("result", filters.lastResult);
  if (filters.nextAction) query.set("next", filters.nextAction);
  if (filters.contact) query.set("contact", filters.contact);
  if (filters.worked) query.set("worked", filters.worked);
  if (filters.status) query.set("status", filters.status);

  function href(overrides: Record<string, string | null>): string {
    const next = new URLSearchParams(query);
    for (const [key, value] of Object.entries(overrides)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const suffix = next.toString();
    return `/recovery/follow-up${suffix ? `?${suffix}` : ""}`;
  }

  // BR-009: la ficha vuelve aquí, no a la bandeja del asesor.
  const caseContext = new URLSearchParams(query);
  caseContext.set("from", "follow-up");
  if (page > 1) caseContext.set("page", String(page));
  const caseContextQuery = caseContext.toString();

  return (
    <div className="ui-page-stack">
      <PageHeader
        eyebrow="Campañas"
        title="Seguimiento"
        description="La cartera asignada, cliente por cliente: quién la tiene, qué pasó en la última llamada y cuándo toca la siguiente."
      />
      <CampaignNav current="seguimiento" role={membership.role} />

      <MetricGroup>
        <Metric
          href={href({ contact: null, next: null, worked: null })}
          label="Cartera"
          value={cases.length}
        />
        <Metric
          href={href({ contact: "sin" })}
          label="Sin primer contacto"
          tone={withoutContact > 0 ? "warning" : undefined}
          value={withoutContact}
        />
        <Metric
          href={href({ next: "vencida", status: "SCHEDULED" })}
          label="Agenda vencida"
          tone={overdue > 0 ? "danger" : undefined}
          value={overdue}
        />
        <Metric
          href={href({ worked: "hoy" })}
          label="Con gestión hoy"
          value={workedToday}
        />
      </MetricGroup>

      <SectionPanel
        title="Clientes"
        description="Vencidos primero, luego lo de hoy, después lo agendado; al fondo lo que no tiene fecha."
      >
        <QueueFilters
          basePath="/recovery/follow-up"
          options={{
            teams: isSupervisor ? undefined : teams,
            allowNoTeam: false,
            advisors,
            extras: [
              {
                key: "result",
                label: "Última tipificación",
                options: [
                  { value: recoveryLastResultNone, label: "Sin gestión" },
                  ...Object.entries(attemptResultLabels).map(
                    ([value, label]) => ({
                      value,
                      label,
                    }),
                  ),
                ],
              },
              {
                key: "next",
                label: "Próxima acción",
                emptyLabel: "Cualquiera",
                options: recoveryNextActionBuckets,
              },
              {
                key: "contact",
                label: "Primer contacto",
                emptyLabel: "Todos",
                options: recoveryFollowUpContactOptions,
              },
              {
                key: "worked",
                label: "Gestión de hoy",
                emptyLabel: "Todos",
                options: recoveryFollowUpWorkedOptions,
              },
              {
                key: "status",
                label: "Estado",
                options: recoveryFollowUpStatusOptions,
              },
            ],
          }}
          resultLabel={`${formatCount(selected.length)} caso(s) cumplen el filtro.`}
          values={{
            q: searchInput,
            team: teamScope,
            department: "",
            plan: "",
            advisor: advisorFilter,
            extra: {
              result: filters.lastResult ?? "",
              next: filters.nextAction ?? "",
              contact: filters.contact ?? "",
              worked: filters.worked ?? "",
              status: filters.status ?? "",
            },
          }}
        />

        <div className="overflow-x-auto rounded-xl border border-ui-border">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>DNI</th>
                <th>Teléfono</th>
                <th>Asesor</th>
                <th>Estado</th>
                <th>Última tipificación</th>
                <th>Observación</th>
                <th data-numeric>Intentos hoy</th>
                <th>Próxima acción</th>
                <th data-actions />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const bucket = recoveryNextActionBucket(row.nextActionAt, now);
                const tone = row.lastResult
                  ? attemptResultTones[row.lastResult]
                  : undefined;

                return (
                  <tr
                    className="scroll-mt-24"
                    data-result-tone={tone}
                    id={`caso-${row.id}`}
                    key={row.id}
                  >
                    <td className="font-medium text-ui-text">
                      {row.holderName}
                      {row.id === justVisited ? (
                        <span className="ml-2 rounded-full bg-ui-subtle px-2 py-0.5 text-2xs text-ui-muted">
                          Lo acabas de ver
                        </span>
                      ) : null}
                      {isWithoutFirstContact(row) ? (
                        <span className="ml-2 rounded-full bg-ui-warning-soft px-2 py-0.5 text-2xs text-ui-warning">
                          Sin primer contacto
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <CopyValue label="DNI" value={row.documentNumber} />
                    </td>
                    <td>
                      {row.phone ? (
                        <CopyValue label="Teléfono" value={row.phone} />
                      ) : (
                        <span className="text-xs text-ui-muted">—</span>
                      )}
                    </td>
                    <td className="text-xs">
                      {row.advisorId ? (
                        <Link
                          className="text-ui-accent underline-offset-2 hover:underline"
                          href={href({ advisor: row.advisorId })}
                          title="Ver solo su cartera"
                        >
                          {row.advisorName}
                        </Link>
                      ) : (
                        row.advisorName
                      )}
                      <span className="block text-2xs text-ui-muted">
                        {row.teamName}
                      </span>
                    </td>
                    <td className="text-xs">
                      {statusLabels[row.status] ?? row.status}
                    </td>
                    <td className="text-xs">
                      <span
                        className="ui-status-badge"
                        data-tone={tone ?? "neutral"}
                      >
                        {row.lastResult
                          ? (attemptResultLabels[row.lastResult] ??
                            row.lastResult)
                          : "Sin gestión"}
                      </span>
                      {row.lastAttemptAt ? (
                        <span className="block text-2xs text-ui-muted">
                          {dateTimeFormatter.format(row.lastAttemptAt)}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-xs">
                      {row.lastObservation ? (
                        <span
                          className="ui-cell-clamp"
                          title={row.lastObservation}
                        >
                          {row.lastObservation}
                        </span>
                      ) : (
                        <span className="text-ui-muted">—</span>
                      )}
                    </td>
                    <td className="text-xs" data-numeric>
                      <span
                        className={
                          row.status !== "WAITING" &&
                          row.status !== "SCHEDULED" &&
                          row.attemptsToday < 3
                            ? "font-semibold text-ui-warning"
                            : "text-ui-muted"
                        }
                      >
                        {row.attemptsToday} / 3
                      </span>
                    </td>
                    <td className="text-xs">
                      <span className={nextActionTones[bucket]}>
                        {row.nextActionAt
                          ? dateTimeFormatter.format(row.nextActionAt)
                          : "Sin fecha"}
                      </span>
                    </td>
                    <td className="text-xs" data-actions>
                      <Link
                        className="text-ui-accent underline-offset-2 hover:underline"
                        href={`/recovery/campaigns/${row.id}?${caseContextQuery}`}
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-ui-muted"
                    colSpan={10}
                  >
                    {selected.length === 0 && cases.length > 0
                      ? "Ningún caso de la cartera coincide con estos filtros. Prueba con menos o límpialos."
                      : "No hay cartera asignada en este alcance."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center gap-3 text-sm">
            {page > 1 ? (
              <Link
                className="text-ui-accent underline-offset-2 hover:underline"
                href={href({ page: String(page - 1) })}
              >
                ← Anterior
              </Link>
            ) : null}
            <span className="text-ui-muted">
              Página {page} de {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                className="text-ui-accent underline-offset-2 hover:underline"
                href={href({ page: String(page + 1) })}
              >
                Siguiente →
              </Link>
            ) : null}
          </div>
        ) : null}
      </SectionPanel>
    </div>
  );
}
