import Link from "next/link";
import { redirect } from "next/navigation";

import {
  formatAdvisorDisplayName,
  recoveryBoardPeriods,
  resolveRecoveryBoardPeriod,
} from "@repo/validation";

import { CampaignNav } from "@/features/recovery/components/campaign-nav";
import { QueueFilters } from "@/features/recovery/components/queue-filters";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { Prisma } from "@repo/database";

import { formatCount } from "@repo/ui/format";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

const boardRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);

const limaOffsetMs = 5 * 60 * 60 * 1000;

const limaDayFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
});

const contactedResults = new Set([
  "INTERESADO",
  "INTERESADO_CON_PEDIDO",
  "RECHAZA",
  "AGENDA",
  "VENDIDO",
]);

/** Inicio del día calendario de Lima que contiene a `now`. */
function getLimaDayStart(now: Date): Date {
  const lima = new Date(now.getTime() - limaOffsetMs);
  return new Date(
    Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate()) +
      limaOffsetMs,
  );
}

function limaDayKey(moment: Date): string {
  return limaDayFormatter.format(moment);
}

function Stat({
  label,
  value,
  detail,
  tone,
  href,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "warning" | "danger" | "success";
  /** La lista que explica la cifra (SPEC-040 BR-008). */
  href?: string;
}) {
  const valueClass =
    tone === "danger"
      ? "text-ui-danger"
      : tone === "warning"
        ? "text-ui-warning"
        : tone === "success"
          ? "text-ui-success"
          : "text-ui-text";
  return (
    <div>
      <dt className="ui-label-eyebrow">{label}</dt>
      <dd className={`ui-data text-lg font-semibold ${valueClass}`}>
        {href ? (
          <Link
            className="underline-offset-4 hover:underline"
            href={href}
            title="Ver los clientes de esta cifra"
          >
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
      {detail ? <dd className="text-xs text-ui-muted">{detail}</dd> : null}
    </div>
  );
}

/**
 * Tablero del día de la campaña — SPEC-030 BR-052 a BR-056b, BR-075/BR-076.
 * Responde las tres preguntas de supervisión: cuánto se avanzó, con qué
 * cobertura y con qué efectividad. Solo casos de base nacional; los relojes
 * corren desde la asignación y los descartes por portabilidad jamás se
 * cuentan como pérdidas.
 */
export default async function RecoveryBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; advisor?: string; periodo?: string }>;
}) {
  const { session, membership } = await requireCommercialAccess();

  if (!boardRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const parameters = await searchParams;
  const teamFilter = parameters.team ?? "";
  const advisorFilter = (parameters.advisor ?? "").trim().slice(0, 40);
  const now = new Date();

  /**
   * Fase 5 (BR-094): el tablero deja de ser solo «del día». La **actividad**
   * —intentos, contactos, recuperos, pérdidas, descartes— se mide en un
   * período de días de Lima; la **cartera** —asignados, sin primer
   * contacto, agenda vencida— es el estado de ahora y no tiene período.
   * Confundir las dos es lo que este tablero existe para evitar.
   */
  const period = resolveRecoveryBoardPeriod(parameters.periodo, now);
  const todayStart = getLimaDayStart(now);
  // Las cohortes van por fecha de carga: al menos siete días y, si el
  // período es más largo, todo el período.
  const cohortStart = new Date(
    Math.min(
      period.start.getTime(),
      todayStart.getTime() - 7 * 24 * 60 * 60 * 1000,
    ),
  );

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

  /**
   * COR-04 (05/09/2026, BR-022b/BR-029): el `?team=` de la URL pisaba la
   * restricción a los equipos del supervisor. Solo estrecha; un equipo
   * ajeno se ignora.
   */
  const teamScope = supervisedTeamIds
    ? supervisedTeamIds.includes(teamFilter)
      ? teamFilter
      : ""
    : teamFilter;

  /**
   * SPEC-040 BR-001/BR-008: cada indicador de cartera viva abre en
   * Seguimiento exactamente la población que cuenta, con el mismo equipo.
   */
  function followUpHref(filters: Record<string, string>): string {
    const query = new URLSearchParams();
    if (teamScope) query.set("team", teamScope);
    if (advisorFilter) query.set("advisor", advisorFilter);
    for (const [key, value] of Object.entries(filters)) query.set(key, value);
    const suffix = query.toString();
    return `/recovery/follow-up${suffix ? `?${suffix}` : ""}`;
  }

  const scopeWhere: Prisma.RecoveryCaseWhereInput = {
    organizationId: membership.organization.id,
    source: "NATIONAL_BASE",
    ...(supervisedTeamIds ? { assignedTeamId: { in: supervisedTeamIds } } : {}),
    // Con supervisor, `teamScope` es un subconjunto de sus equipos: el
    // reemplazo estrecha, nunca amplía.
    ...(teamScope ? { assignedTeamId: teamScope } : {}),
  };

  const [
    assignedCases,
    attemptsToday,
    resolvedToday,
    cohortCases,
    teams,
    advisorMemberships,
  ] = await Promise.all([
    database.recoveryCase.findMany({
      where: {
        ...scopeWhere,
        status: { in: ["ASSIGNED", "IN_PROGRESS", "SCHEDULED", "WAITING"] },
        assignedUserId: { not: null },
        ...(advisorFilter ? { assignedUserId: advisorFilter } : {}),
      },
      select: {
        id: true,
        status: true,
        assignedUserId: true,
        firstContactAt: true,
        nextActionAt: true,
        assignedUser: { select: { name: true, email: true } },
        assignedTeam: { select: { name: true } },
      },
    }),
    database.recoveryCaseAttempt.findMany({
      where: {
        organizationId: membership.organization.id,
        createdAt: { gte: period.start, lt: period.end },
        ...(advisorFilter ? { actorUserId: advisorFilter } : {}),
        case: { ...scopeWhere },
      },
      select: { caseId: true, actorUserId: true, result: true },
    }),
    database.recoveryCase.findMany({
      where: {
        ...scopeWhere,
        status: { in: ["RECOVERED", "LOST", "DISCARDED"] },
        resolvedAt: { gte: period.start, lt: period.end },
        ...(advisorFilter ? { assignedUserId: advisorFilter } : {}),
      },
      select: {
        status: true,
        lossReason: true,
        discardReason: true,
        assignedUserId: true,
      },
    }),
    database.recoveryCase.findMany({
      where: { ...scopeWhere, createdAt: { gte: cohortStart } },
      select: { createdAt: true, status: true },
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
    database.commercialTeamMember.findMany({
      where: {
        salesEnabled: true,
        isActive: true,
        isPrimary: true,
        team: {
          organizationId: membership.organization.id,
          status: "ACTIVE",
          ...(supervisedTeamIds ? { id: { in: supervisedTeamIds } } : {}),
        },
        user: { status: "ACTIVE" },
      },
      select: {
        userId: true,
        user: { select: { name: true, email: true } },
        team: { select: { name: true } },
      },
    }),
  ]);

  // ── Avance del día (BR-053) ────────────────────────────────────────────
  const attemptsByCase = new Map<string, number>();
  const contactedCases = new Set<string>();
  for (const attempt of attemptsToday) {
    attemptsByCase.set(
      attempt.caseId,
      (attemptsByCase.get(attempt.caseId) ?? 0) + 1,
    );
    if (contactedResults.has(String(attempt.result))) {
      contactedCases.add(attempt.caseId);
    }
  }

  const workedToday = assignedCases.filter((item) =>
    attemptsByCase.has(item.id),
  );
  const noFirstContact = assignedCases.filter(
    (item) => item.firstContactAt === null && item.status !== "WAITING",
  );
  const overdueAgenda = assignedCases.filter(
    (item) =>
      item.status === "SCHEDULED" &&
      item.nextActionAt !== null &&
      item.nextActionAt.getTime() < now.getTime(),
  );

  // ── Cobertura (BR-054): activos hoy con tres o más intentos ────────────
  const activeToday = assignedCases.filter(
    (item) =>
      item.status === "ASSIGNED" ||
      item.status === "IN_PROGRESS" ||
      (item.status === "SCHEDULED" &&
        item.nextActionAt !== null &&
        item.nextActionAt.getTime() <= now.getTime()),
  );
  const coveredToday = activeToday.filter(
    (item) => (attemptsByCase.get(item.id) ?? 0) >= 3,
  );
  const coverage =
    activeToday.length > 0
      ? Math.round((coveredToday.length / activeToday.length) * 100)
      : null;

  // ── Efectividad por asesor (BR-055) ────────────────────────────────────
  interface AdvisorRow {
    userId: string;
    name: string;
    teamName: string;
    assigned: number;
    active: number;
    worked: number;
    attempts: number;
    contacted: number;
    covered: number;
    noContact: number;
    recovered: number;
    lost: number;
    lostToOthers: number;
  }
  const byAdvisor = new Map<string, AdvisorRow>();

  function advisorRow(
    userId: string,
    user: { name: string; email: string } | null,
    teamName: string | null,
  ): AdvisorRow {
    let row = byAdvisor.get(userId);
    if (!row) {
      row = {
        userId,
        name: user
          ? formatAdvisorDisplayName(user.name, user.email)
          : "Sin asesor",
        teamName: teamName ?? "—",
        assigned: 0,
        active: 0,
        worked: 0,
        attempts: 0,
        contacted: 0,
        covered: 0,
        noContact: 0,
        recovered: 0,
        lost: 0,
        lostToOthers: 0,
      };
      byAdvisor.set(userId, row);
    }
    return row;
  }

  const activeIds = new Set(activeToday.map((item) => item.id));
  const caseOwner = new Map<string, string>();
  for (const item of assignedCases) {
    if (!item.assignedUserId) continue;
    caseOwner.set(item.id, item.assignedUserId);
    const row = advisorRow(
      item.assignedUserId,
      item.assignedUser,
      item.assignedTeam?.name ?? null,
    );
    row.assigned += 1;
    if (activeIds.has(item.id)) row.active += 1;
    if (attemptsByCase.has(item.id)) row.worked += 1;
    if (contactedCases.has(item.id)) row.contacted += 1;
    if (activeIds.has(item.id) && (attemptsByCase.get(item.id) ?? 0) >= 3) {
      row.covered += 1;
    }
    if (item.firstContactAt === null && item.status !== "WAITING") {
      row.noContact += 1;
    }
  }
  for (const attempt of attemptsToday) {
    const owner = caseOwner.get(attempt.caseId) ?? attempt.actorUserId;
    const row = byAdvisor.get(owner);
    if (row) row.attempts += 1;
  }

  let discardedTodayCount = 0;
  for (const resolved of resolvedToday) {
    if (resolved.status === "DISCARDED") {
      // BR-056: los descartes por portabilidad no son pérdidas de nadie.
      discardedTodayCount += 1;
      continue;
    }
    if (!resolved.assignedUserId) continue;
    const row = byAdvisor.get(resolved.assignedUserId);
    if (!row) continue;
    if (resolved.status === "RECOVERED") row.recovered += 1;
    if (resolved.status === "LOST") {
      row.lost += 1;
      if (resolved.lossReason === "YA_MIGRO_OTRA_AGENCIA") {
        row.lostToOthers += 1;
      }
    }
  }

  const advisorRows = [...byAdvisor.values()].sort(
    (left, right) =>
      right.attempts - left.attempts ||
      left.name.localeCompare(right.name, "es"),
  );

  const recoveredToday = resolvedToday.filter(
    (item) => item.status === "RECOVERED",
  ).length;
  const lostToday = resolvedToday.filter(
    (item) => item.status === "LOST",
  ).length;

  // ── Conversión por cohorte (BR-056b) ───────────────────────────────────
  interface CohortRow {
    key: string;
    total: number;
    discarded: number;
    recovered: number;
  }
  const cohorts = new Map<string, CohortRow>();
  for (const item of cohortCases) {
    const key = limaDayKey(item.createdAt);
    let row = cohorts.get(key);
    if (!row) {
      row = { key, total: 0, discarded: 0, recovered: 0 };
      cohorts.set(key, row);
    }
    row.total += 1;
    if (String(item.status) === "DISCARDED") row.discarded += 1;
    if (String(item.status) === "RECOVERED") row.recovered += 1;
  }
  const cohortRows = [...cohorts.values()].reverse();

  return (
    <>
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="Campañas"
          title="Tablero"
          description={`La cartera de ahora y la actividad de ${period.label.toLowerCase()}: cuánto se avanzó, con qué cobertura y con qué efectividad.`}
        />
        <CampaignNav current="tablero" role={membership.role} />

        <QueueFilters
          basePath="/recovery/board"
          hideSearch
          options={{
            teams: isSupervisor ? undefined : teams,
            allowNoTeam: false,
            advisors: [
              ...new Map(
                advisorMemberships.map((item) => [
                  item.userId,
                  {
                    id: item.userId,
                    name: `${formatAdvisorDisplayName(item.user.name, item.user.email)} · ${item.team.name}`,
                  },
                ]),
              ).values(),
            ],
            extras: [
              {
                key: "periodo",
                label: "Período de actividad",
                emptyLabel: "Hoy",
                options: recoveryBoardPeriods.filter(
                  (option) => option.value !== "hoy",
                ),
              },
            ],
          }}
          resultLabel={`Actividad: ${period.label.toLowerCase()} · cartera: ahora.`}
          values={{
            q: "",
            team: teamScope,
            department: "",
            plan: "",
            advisor: advisorFilter,
            extra: { periodo: period.key === "hoy" ? "" : period.key },
          }}
        />

        <div className="ui-form-row">
          <Link
            className="ui-button ui-button--secondary"
            href={followUpHref({})}
          >
            Seguimiento: la cartera cliente por cliente
          </Link>
          <span className="pb-2 text-xs text-ui-muted">
            Cada cifra de abajo abre los clientes que la explican.
          </span>
        </div>

        <SectionPanel
          title="Cartera y actividad"
          description="La cartera es el estado de ahora; la actividad, lo ocurrido en el período elegido. Los plazos corren desde la asignación: los casos sin repartir no generan alertas."
        >
          <div className="space-y-4">
            <div>
              <p className="ui-label-eyebrow">Cartera · ahora</p>
              <dl className="mt-2 flex flex-wrap gap-x-10 gap-y-3">
                <Stat
                  detail="Casos con asesor en este momento"
                  href={followUpHref({})}
                  label="Asignados"
                  value={formatCount(assignedCases.length)}
                />
                <Stat
                  detail="Asignados que nadie ha llamado aún; los en espera no cuentan"
                  href={followUpHref({ contact: "sin" })}
                  label="Sin primer contacto"
                  tone={noFirstContact.length > 0 ? "warning" : undefined}
                  value={formatCount(noFirstContact.length)}
                />
                <Stat
                  detail="Citas agendadas cuya fecha ya pasó"
                  href={followUpHref({ next: "vencida", status: "SCHEDULED" })}
                  label="Agenda vencida"
                  tone={overdueAgenda.length > 0 ? "danger" : undefined}
                  value={formatCount(overdueAgenda.length)}
                />
              </dl>
            </div>

            <div>
              <p className="ui-label-eyebrow">
                Actividad · {period.label.toLowerCase()}
              </p>
              <dl className="mt-2 flex flex-wrap gap-x-10 gap-y-3">
                <Stat
                  detail="Casos de la cartera con al menos un intento en el período"
                  href={
                    period.key === "hoy"
                      ? followUpHref({ worked: "hoy" })
                      : undefined
                  }
                  label="Trabajados"
                  value={formatCount(workedToday.length)}
                />
                <Stat
                  detail={
                    period.days === 1
                      ? `${formatCount(coveredToday.length)} de ${formatCount(activeToday.length)} activos con 3+ intentos en el día`
                      : "Se mide por día; elige Hoy o Ayer"
                  }
                  label="Cobertura · 3+ intentos"
                  tone={
                    period.days !== 1 || coverage === null
                      ? undefined
                      : coverage >= 70
                        ? "success"
                        : "warning"
                  }
                  value={
                    period.days !== 1 || coverage === null
                      ? "—"
                      : `${coverage}%`
                  }
                />
                <Stat
                  detail="Resueltos como recuperados en el período"
                  label="Recuperados"
                  tone={recoveredToday > 0 ? "success" : undefined}
                  value={formatCount(recoveredToday)}
                />
                <Stat
                  detail="Resueltos como perdidos en el período"
                  label="Perdidos"
                  value={formatCount(lostToday)}
                />
                <Stat
                  detail="Portabilidad y vencidos; no son pérdidas de nadie"
                  label="Descartes"
                  value={formatCount(discardedTodayCount)}
                />
              </dl>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel
          title="Efectividad por asesor"
          description={`Intentos y contactos de ${period.label.toLowerCase()}; recuperos y pérdidas resueltos en el mismo período. Los intentos se atribuyen al dueño actual del caso.`}
        >
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th className="font-semibold">Asesor</th>
                  <th className="font-semibold">Equipo</th>
                  <th data-numeric className="font-semibold">
                    Asignados
                  </th>
                  <th data-numeric className="font-semibold">
                    Trabajados
                  </th>
                  <th data-numeric className="font-semibold">
                    Intentos
                  </th>
                  <th data-numeric className="font-semibold">
                    Contactados
                  </th>
                  <th data-numeric className="font-semibold">
                    Cobertura
                  </th>
                  <th data-numeric className="font-semibold">
                    Sin contacto
                  </th>
                  <th data-numeric className="font-semibold">
                    Recuperados
                  </th>
                  <th data-numeric className="font-semibold">
                    Perdidos
                  </th>
                </tr>
              </thead>
              <tbody>
                {advisorRows.map((row) => (
                  <tr key={`${row.name}-${row.teamName}`}>
                    <td className="font-medium text-ui-text">
                      <Link
                        className="text-ui-accent underline-offset-2 hover:underline"
                        href={followUpHref({ advisor: row.userId })}
                        title="Ver su cartera"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="text-xs text-ui-muted">{row.teamName}</td>
                    <td data-numeric className="ui-data">
                      {row.assigned}
                    </td>
                    <td data-numeric className="ui-data">
                      {row.worked}
                    </td>
                    <td data-numeric className="ui-data">
                      {row.attempts}
                    </td>
                    <td data-numeric className="ui-data">
                      {row.contacted}
                    </td>
                    <td data-numeric className="ui-data">
                      {row.active > 0 ? `${row.covered}/${row.active}` : "—"}
                    </td>
                    <td
                      className={`ui-data px-3 py-1.5 text-right ${row.noContact > 0 ? "font-semibold text-ui-warning" : ""}`}
                    >
                      {row.noContact > 0 ? (
                        <Link
                          className="underline-offset-2 hover:underline"
                          href={followUpHref({
                            advisor: row.userId,
                            contact: "sin",
                          })}
                        >
                          {row.noContact}
                        </Link>
                      ) : (
                        row.noContact
                      )}
                    </td>
                    <td
                      className={`ui-data px-3 py-1.5 text-right ${row.recovered > 0 ? "font-semibold text-ui-success" : ""}`}
                    >
                      {row.recovered}
                    </td>
                    <td data-numeric className="ui-data">
                      {row.lost}
                      {row.lostToOthers > 0 ? (
                        <span className="ml-1 text-[11px] text-ui-muted">
                          ({row.lostToOthers} a otras agencias)
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {advisorRows.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-ui-muted"
                      colSpan={10}
                    >
                      Nadie tiene casos asignados en estos equipos. Reparte
                      desde Distribuir la base.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionPanel>

        <SectionPanel
          title="Cómo se calcula"
          description="Tres fechas distintas, tres preguntas distintas. Ninguna cifra mezcla dos."
        >
          <dl className="grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-ui-text">Cartera · ahora</dt>
              <dd className="text-ui-muted">
                Lo que hay asignado en este momento. No depende del período: un
                caso sin primer contacto lo sigue estando aunque mires la semana
                pasada.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ui-text">
                Actividad · período
              </dt>
              <dd className="text-ui-muted">
                Intentos hechos entre las fechas elegidas (día de Lima) y casos
                resueltos en esas fechas. «Trabajado» es un caso con al menos un
                intento; «contactado», uno cuyo intento terminó en respuesta del
                cliente. La cobertura exige tres intentos en un mismo día, así
                que solo se muestra para Hoy y Ayer.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ui-text">
                Cohorte · fecha de carga
              </dt>
              <dd className="text-ui-muted">
                El día en que el caso entró al sistema, con lo recuperado hasta
                hoy. Mide si esa base rinde, no qué se hizo un día. Los
                descartes por portabilidad salen del denominador.
              </dd>
            </div>
          </dl>
        </SectionPanel>

        <SectionPanel
          title="Conversión por fecha de carga"
          description="Cada fecha de carga —el día en que el caso entró— contra la meta del 3–6 %, con lo recuperado hasta hoy. Es independiente del período de actividad. Los que ya eran Movistar no cuentan: la conversión se mide sobre oportunidad real."
        >
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th className="font-semibold">Día de carga</th>
                  <th data-numeric className="font-semibold">
                    Casos
                  </th>
                  <th data-numeric className="font-semibold">
                    Ya eran Movistar
                  </th>
                  <th data-numeric className="font-semibold">
                    Oportunidad real
                  </th>
                  <th data-numeric className="font-semibold">
                    Recuperados
                  </th>
                  <th data-numeric className="font-semibold">
                    Conversión
                  </th>
                  <th className="font-semibold">Meta 3–6 %</th>
                </tr>
              </thead>
              <tbody>
                {cohortRows.map((row) => {
                  const denominator = row.total - row.discarded;
                  const rate =
                    denominator > 0
                      ? (row.recovered / denominator) * 100
                      : null;
                  return (
                    <tr key={row.key}>
                      <td className="ui-data">{row.key}</td>
                      <td data-numeric className="ui-data">
                        {formatCount(row.total)}
                      </td>
                      <td data-numeric className="ui-data text-ui-muted">
                        {formatCount(row.discarded)}
                      </td>
                      <td data-numeric className="ui-data">
                        {formatCount(denominator)}
                      </td>
                      <td data-numeric className="ui-data">
                        {formatCount(row.recovered)}
                      </td>
                      <td data-numeric className="ui-data">
                        {rate === null ? "—" : `${rate.toFixed(1)}%`}
                      </td>
                      <td className="text-xs">
                        {rate === null ? (
                          <span className="text-ui-muted">
                            Todavía sin casos
                          </span>
                        ) : rate >= 3 ? (
                          <span className="text-ui-success">
                            {rate > 6 ? "Sobre la meta" : "En rango"}
                          </span>
                        ) : (
                          <span className="text-ui-warning">
                            Aún por debajo de la meta
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {cohortRows.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-ui-muted"
                      colSpan={7}
                    >
                      Sin cargas en el período.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionPanel>
      </div>
    </>
  );
}
