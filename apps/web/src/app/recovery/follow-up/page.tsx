import Link from "next/link";
import { formatCount } from "@repo/ui/format";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { attemptResultLabels } from "@/features/recovery/attempt-result-labels";
import { CopyValue } from "@/features/recovery/components/copy-value";
import { PhoneNumber } from "@/features/recovery/components/phone-number";
import { QueueFilters } from "@/features/recovery/components/queue-filters";
import { ReleaseStaleCasesForm } from "@/features/recovery/components/release-stale-cases-form";
import { buildRecoverySearchWhere } from "@/features/recovery/server/recovery-search-where";
import { returnStaleBaseCasesToPool } from "@/features/recovery/server/return-stale-base-cases";
import { CampaignNav } from "@/features/recovery/components/campaign-nav";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import {
  allOf,
  countOnSameLimaDay,
  formatAdvisorDisplayName,
  formatCampaignMoment,
  formatMyDaySaleDay,
  getLimaIsoDate,
  isWithoutFirstContact,
  recoveryDaysUntouched,
  recoveryFollowUpContactOptions,
  recoveryFollowUpStatusOptions,
  recoveryFollowUpStatuses,
  recoveryFollowUpWorkedOptions,
  recoveryBoardPeriods,
  recoveryIdleOptions,
  resolveRecoveryBoardPeriod,
  recoveryLastResultNone,
  recoveryNextActionBucket,
  recoveryNextActionBuckets,
  recoveryStaleDays,
  recoveryTeamFilterNone,
  selectFollowUpCases,
  summarizeFollowUpByAdvisor,
  effectiveAttemptResult,
  type FollowUpFilters,
  type RecoveryFollowUpStatus,
} from "@repo/validation";

import { PageHeader } from "@repo/ui/page-header";

import type { Prisma } from "@repo/database";

const followUpRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);
const pageSize = 100;

function pick<T extends string>(
  value: string | undefined,
  allowed: ReadonlyArray<{ value: T }>,
): T | null {
  const text = (value ?? "").trim();

  return allowed.some((option) => option.value === text) ? (text as T) : null;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Seguimiento de la cartera asignada — SPEC-040 y SPEC-070.
 *
 * La misma población y las mismas definiciones que el tablero (BR-001), pero
 * por cliente. SPEC-070 la ordena para quien supervisa: arriba, cuánto de la
 * cartera de cada asesor lleva días sin que nadie la toque, con la opción de
 * devolverlo a los casos libres del equipo; debajo, la tarjeta de cada
 * cliente. Antes era una tabla de diez columnas que no cabía, con la fecha
 * interna de la próxima acción en rojo en todas las filas.
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
    periodo?: string;
    idle?: string;
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
  // PL-09: el período de actividad del tablero también se acepta aquí; la
  // cartera sigue siendo la de ahora, lo que cambia es la ventana de los
  // intentos que cuentan como «gestión».
  const activityPeriod = resolveRecoveryBoardPeriod(
    parameters.periodo,
    new Date(),
  );

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
    idle: pick(parameters.idle, recoveryIdleOptions),
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
        claimedAt: true,
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
          select: {
            result: true,
            observation: true,
            createdAt: true,
            correction: { select: { effectiveResult: true } },
          },
        },
        commitments: {
          where: { status: "PENDING" },
          take: 1,
          select: { scheduledAt: true },
        },
      },
    }),
    database.recoveryCaseAttempt.findMany({
      where: {
        organizationId: membership.organization.id,
        createdAt: {
          gte: new Date(
            Math.min(dayStart.getTime(), activityPeriod.start.getTime()),
          ),
        },
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

  const allCases = portfolio.map((item) => ({
    id: item.id,
    holderName: item.holderName,
    documentNumber: item.documentNumber,
    phone:
      item.phones[0]?.phoneNumber ?? item.services[0]?.serviceNumber ?? null,
    status: String(item.status),
    firstContactAt: item.firstContactAt,
    nextActionAt: item.nextActionAt,
    claimedAt: item.claimedAt,
    advisorId: item.assignedUserId,
    advisorName: item.assignedUser
      ? formatAdvisorDisplayName(
          item.assignedUser.name,
          item.assignedUser.email,
        )
      : "Sin asesor",
    teamName: item.assignedTeam?.name ?? "—",
    // SPEC-049 BR-017: lo que vale es el resultado efectivo.
    lastResult: item.attempts[0] ? effectiveAttemptResult(item.attempts[0]) : null,
    lastObservation: item.attempts[0]?.observation ?? null,
    lastAttemptAt: item.attempts[0]?.createdAt ?? null,
    pendingCommitmentAt: item.commitments[0]?.scheduledAt ?? null,
    hasPendingCommitment: item.commitments.length > 0,
    attemptsToday: countOnSameLimaDay(attemptsByCase.get(item.id) ?? [], now),
    attemptsInPeriod: (attemptsByCase.get(item.id) ?? []).filter(
      (at) =>
        at.getTime() >= activityPeriod.start.getTime() &&
        at.getTime() < activityPeriod.end.getTime(),
    ).length,
  }));

  // BR-004: el resumen por asesor mira toda la cartera del alcance; el
  // filtro de asesor estrecha la lista, no el resumen.
  const byAdvisor = summarizeFollowUpByAdvisor(allCases, now);
  const cases = advisorFilter
    ? allCases.filter((item) => item.advisorId === advisorFilter)
    : allCases;

  // Las cifras de cabecera cuentan sobre la cartera acotada, no sobre la
  // página: son las del tablero, aquí abribles (BR-001).
  const withoutContact = cases.filter(isWithoutFirstContact).length;
  const overdue = cases.filter(
    (item) =>
      item.status === "SCHEDULED" &&
      recoveryNextActionBucket(item.nextActionAt, now) === "vencida",
  ).length;
  const workedInPeriod = cases.filter(
    (item) => item.attemptsInPeriod > 0,
  ).length;
  const staleCount = cases.filter((item) => {
    const days = recoveryDaysUntouched(item, now);
    return days !== null && days >= recoveryStaleDays;
  }).length;

  const selected = selectFollowUpCases(cases, filters, now);
  const totalPages = Math.max(1, Math.ceil(selected.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const rows = selected.slice((page - 1) * pageSize, page * pageSize);

  const advisors = byAdvisor
    .map((item) => ({ id: item.advisorId, name: item.name }))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));

  const query = new URLSearchParams();
  if (searchInput) query.set("q", searchInput);
  if (teamScope) query.set("team", teamScope);
  if (advisorFilter) query.set("advisor", advisorFilter);
  if (filters.lastResult) query.set("result", filters.lastResult);
  if (filters.nextAction) query.set("next", filters.nextAction);
  if (filters.contact) query.set("contact", filters.contact);
  if (filters.worked) query.set("worked", filters.worked);
  if (filters.status) query.set("status", filters.status);
  if (filters.idle) query.set("idle", filters.idle);
  if (activityPeriod.key !== "hoy") query.set("periodo", activityPeriod.key);

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

  const periodLabel = activityPeriod.label.toLowerCase();
  const figures = [
    {
      label: "Cartera",
      value: cases.length,
      href: href({ contact: null, next: null, worked: null, idle: null }),
      alert: false,
    },
    {
      label: `Sin tocar hace ${recoveryStaleDays} días o más`,
      value: staleCount,
      href: href({ idle: String(recoveryStaleDays) }),
      alert: staleCount > 0,
    },
    {
      label: `Con gestión · ${periodLabel}`,
      value: workedInPeriod,
      href: href({ worked: "hoy" }),
      alert: false,
    },
    {
      label: "Citas vencidas",
      value: overdue,
      href: href({ next: "vencida", status: "SCHEDULED" }),
      alert: overdue > 0,
    },
    ...(withoutContact > 0
      ? [
          {
            label: "Sin primer contacto",
            value: withoutContact,
            href: href({ contact: "sin" }),
            alert: true,
          },
        ]
      : []),
  ];

  return (
    <div className="ui-page-stack">
      {/* BR-005: sin subtítulo; las cifras dicen lo que hay. */}
      <PageHeader eyebrow="Campañas" title="Seguimiento" />
      <CampaignNav current="seguimiento" role={membership.role} />

      <section
        aria-label="La cartera"
        className="flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-lg border border-ui-border bg-ui-surface px-4 py-3 text-sm text-ui-muted"
      >
        {figures.map((figure) => (
          <Link
            className="underline-offset-2 hover:underline"
            href={figure.href}
            key={figure.label}
          >
            {figure.label}{" "}
            <strong
              className={`text-base tabular-nums ${figure.alert ? "text-ui-warning" : "text-ui-text"}`}
            >
              {formatCount(figure.value)}
            </strong>
          </Link>
        ))}
        <Link
          className="ml-auto text-xs text-ui-accent underline-offset-2 hover:underline"
          href="/recovery/follow-up/calidad"
        >
          Revisar tipificaciones →
        </Link>
      </section>

      {/* BR-004 y BR-010: la cartera por asesor y devolver lo abandonado. */}
      {byAdvisor.length > 0 ? (
        <section aria-labelledby="por-asesor" className="grid gap-2">
          <h2 className="text-sm font-semibold text-ui-text" id="por-asesor">
            Por asesor
          </h2>
          <ul className="divide-y divide-ui-border rounded-lg border border-ui-border bg-ui-surface text-sm">
            {byAdvisor.map((advisor) => {
              const selectedAdvisor = advisorFilter === advisor.advisorId;
              return (
                <li
                  className={`grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${selectedAdvisor ? "bg-ui-accent-soft" : ""}`}
                  key={advisor.advisorId}
                >
                  <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <Link
                      className="min-w-40 font-medium text-ui-text underline-offset-2 hover:underline"
                      href={href({
                        advisor: selectedAdvisor ? null : advisor.advisorId,
                        page: null,
                      })}
                    >
                      {advisor.name}
                    </Link>
                    <span
                      className={
                        advisor.stale > 0
                          ? "font-semibold text-ui-warning"
                          : "text-ui-muted"
                      }
                    >
                      {formatCount(advisor.stale)} de{" "}
                      {formatCount(advisor.portfolio)} sin tocar hace{" "}
                      {recoveryStaleDays} días o más
                    </span>
                    <span className="text-ui-muted">
                      {plural(
                        advisor.workedToday,
                        "con gestión hoy",
                        "con gestión hoy",
                      )}
                    </span>
                    {advisor.agendaOverdue > 0 ? (
                      <span className="text-ui-warning">
                        {plural(
                          advisor.agendaOverdue,
                          "cita vencida",
                          "citas vencidas",
                        )}
                      </span>
                    ) : null}
                  </p>
                  {advisor.releasable > 0 ? (
                    <ReleaseStaleCasesForm
                      advisorId={advisor.advisorId}
                      advisorName={advisor.name}
                      count={advisor.releasable}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <QueueFilters
        basePath="/recovery/follow-up"
        moreFilters
        options={{
          teams: isSupervisor ? undefined : teams,
          allowNoTeam: false,
          advisors,
          extras: [
            {
              key: "idle",
              label: "Sin tocar desde",
              emptyLabel: "Cualquiera",
              options: recoveryIdleOptions,
            },
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
              key: "periodo",
              label: "Período de actividad",
              emptyLabel: "Hoy",
              options: recoveryBoardPeriods.filter(
                (option) => option.value !== "hoy",
              ),
            },
            {
              key: "worked",
              label: "Gestión en el período",
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
        resultLabel={plural(selected.length, "caso", "casos")}
        values={{
          q: searchInput,
          team: teamScope,
          department: "",
          plan: "",
          advisor: advisorFilter,
          extra: {
            idle: filters.idle ?? "",
            result: filters.lastResult ?? "",
            next: filters.nextAction ?? "",
            contact: filters.contact ?? "",
            worked: filters.worked ?? "",
            status: filters.status ?? "",
            periodo: activityPeriod.key === "hoy" ? "" : activityPeriod.key,
          },
        }}
        visibleExtras={["idle"]}
      />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-ui-border bg-ui-surface px-4 py-6 text-center text-sm text-ui-muted">
          {selected.length === 0 && cases.length > 0
            ? "Ningún caso de la cartera coincide con estos filtros. Prueba con menos o límpialos."
            : "No hay cartera asignada en este alcance."}
        </p>
      ) : (
        <ol className="grid gap-2">
          {rows.map((row) => {
            const days = recoveryDaysUntouched(row, now);
            const stale = days !== null && days >= recoveryStaleDays;
            const touchedAt = row.lastAttemptAt ?? row.claimedAt;
            const citaOverdue =
              row.pendingCommitmentAt !== null &&
              row.pendingCommitmentAt.getTime() < now.getTime();
            const lastLine = row.lastResult
              ? [
                  `Última gestión: ${attemptResultLabels[row.lastResult] ?? row.lastResult}`,
                  row.lastAttemptAt ? formatCampaignMoment(row.lastAttemptAt) : null,
                  row.lastObservation ? `«${row.lastObservation}»` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Sin gestión todavía";

            return (
              <li key={row.id}>
                <article
                  className={`grid scroll-mt-24 gap-3 rounded-lg border bg-ui-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                    row.id === justVisited ? "border-ui-accent" : "border-ui-border"
                  }`}
                  id={`caso-${row.id}`}
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ui-soft">
                      {/* BR-001 y BR-006: cuánto lleva sin tocar, no la
                          fecha interna de la próxima acción. */}
                      {touchedAt ? (
                        <Badge tone={stale ? "warning" : "neutral"}>
                          {days === 0
                            ? row.lastAttemptAt
                              ? "Gestionado hoy"
                              : "Asignado hoy"
                            : `Sin tocar desde el ${formatMyDaySaleDay(touchedAt)} · ${plural(days ?? 0, "día", "días")}`}
                        </Badge>
                      ) : null}
                      {row.pendingCommitmentAt ? (
                        <Badge tone={citaOverdue ? "danger" : "neutral"}>
                          Cita {citaOverdue ? "vencida " : ""}del{" "}
                          {formatCampaignMoment(row.pendingCommitmentAt)}
                        </Badge>
                      ) : null}
                      {isWithoutFirstContact(row) ? (
                        <Badge tone="warning">Sin primer contacto</Badge>
                      ) : null}
                      {row.id === justVisited ? <Badge>Lo acabas de ver</Badge> : null}
                    </p>
                    <h3 className="mt-1 flex flex-wrap items-baseline gap-x-3 text-base font-semibold text-ui-text">
                      <span className="min-w-0 truncate">{row.holderName}</span>
                      {row.phone ? <PhoneNumber phone={row.phone} /> : null}
                    </h3>
                    <p className="mt-0.5 text-sm text-ui-text">
                      {row.advisorId ? (
                        <Link
                          className="underline-offset-2 hover:underline"
                          href={href({ advisor: row.advisorId, page: null })}
                          title="Ver solo su cartera"
                        >
                          {row.advisorName}
                        </Link>
                      ) : (
                        row.advisorName
                      )}
                      <span className="text-ui-muted">
                        {" "}
                        · {row.attemptsToday} de 3 hoy
                      </span>
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-ui-muted">
                      {lastLine}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    {/* BR-007: el DNI, a un clic; no en cada fila. */}
                    <details className="text-xs">
                      <summary className="cursor-pointer font-semibold text-ui-accent">
                        Ver datos
                      </summary>
                      <p className="mt-1">
                        DNI{" "}
                        <CopyValue label="DNI" value={row.documentNumber} />
                      </p>
                    </details>
                    <Button asChild size="sm">
                      <Link
                        href={`/recovery/campaigns/${row.id}?${caseContextQuery}`}
                      >
                        Abrir caso
                      </Link>
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}

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
    </div>
  );
}
