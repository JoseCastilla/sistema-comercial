import { redirect } from "next/navigation";

import { formatAdvisorDisplayName } from "@repo/validation";

import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { Prisma } from "@repo/database";

import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import { SignOutButton } from "@/app/orders/sign-out-button";

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
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "warning" | "danger" | "success";
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
      <dd className={`ui-data text-lg font-semibold ${valueClass}`}>{value}</dd>
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
  searchParams: Promise<{ team?: string }>;
}) {
  const { session, membership } = await requireCommercialAccess();

  if (!boardRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const parameters = await searchParams;
  const teamFilter = parameters.team ?? "";
  const now = new Date();
  const dayStart = getLimaDayStart(now);
  const cohortStart = new Date(dayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

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

  const scopeWhere: Prisma.RecoveryCaseWhereInput = {
    organizationId: membership.organization.id,
    source: "NATIONAL_BASE",
    ...(supervisedTeamIds ? { assignedTeamId: { in: supervisedTeamIds } } : {}),
    ...(teamFilter ? { assignedTeamId: teamFilter } : {}),
  };

  const [assignedCases, attemptsToday, resolvedToday, cohortCases, teams] =
    await Promise.all([
      database.recoveryCase.findMany({
        where: {
          ...scopeWhere,
          status: { in: ["ASSIGNED", "IN_PROGRESS", "SCHEDULED", "WAITING"] },
          assignedUserId: { not: null },
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
          createdAt: { gte: dayStart },
          case: { ...scopeWhere },
        },
        select: { caseId: true, actorUserId: true, result: true },
      }),
      database.recoveryCase.findMany({
        where: {
          ...scopeWhere,
          status: { in: ["RECOVERED", "LOST", "DISCARDED"] },
          resolvedAt: { gte: dayStart },
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
      right.attempts - left.attempts || left.name.localeCompare(right.name, "es"),
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
          title="Tablero del día"
          description="Cuánto se avanzó, con qué cobertura y con qué efectividad."
        />

        {!isSupervisor && teams.length > 0 ? (
          <form action="/recovery/board" className="ui-form-row" method="get">
            <label>
              <span className="ui-label-eyebrow">Equipo</span>
              <select
                className="block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
                defaultValue={teamFilter}
                name="team"
              >
                <option value="">Todos</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="ui-button ui-button--secondary" type="submit">
              Filtrar
            </button>
          </form>
        ) : null}

        <SectionPanel
          title="Avance"
          description="Los relojes corren desde la asignación: la base sin repartir no genera alertas."
        >
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <Stat
              label="Asignados"
              value={assignedCases.length.toLocaleString("es-PE")}
            />
            <Stat
              label="Trabajados hoy"
              value={workedToday.length.toLocaleString("es-PE")}
            />
            <Stat
              label="Sin primer contacto"
              tone={noFirstContact.length > 0 ? "warning" : undefined}
              value={noFirstContact.length.toLocaleString("es-PE")}
            />
            <Stat
              label="Agenda vencida"
              tone={overdueAgenda.length > 0 ? "danger" : undefined}
              value={overdueAgenda.length.toLocaleString("es-PE")}
            />
            <Stat
              label="Cobertura · 3+ intentos"
              detail={`${coveredToday.length} de ${activeToday.length} activos hoy`}
              tone={
                coverage === null
                  ? undefined
                  : coverage >= 70
                    ? "success"
                    : "warning"
              }
              value={coverage === null ? "—" : `${coverage}%`}
            />
            <Stat
              label="Recuperados hoy"
              tone={recoveredToday > 0 ? "success" : undefined}
              value={recoveredToday.toLocaleString("es-PE")}
            />
            <Stat
              label="Perdidos hoy"
              value={lostToday.toLocaleString("es-PE")}
            />
            <Stat
              label="Descartes del día"
              detail="portabilidad y vencidos; no son pérdidas"
              value={discardedTodayCount.toLocaleString("es-PE")}
            />
          </dl>
        </SectionPanel>

        <SectionPanel
          title="Efectividad por asesor"
          description="Intentos y contactos de hoy; recuperos y pérdidas resueltos hoy."
        >
          <div className="overflow-x-auto rounded-xl border border-ui-border">
            <table className="min-w-full divide-y divide-ui-border text-sm">
              <thead className="bg-ui-surface-muted text-left text-xs uppercase tracking-wide text-ui-muted">
                <tr>
                  <th className="px-3 py-1.5 font-semibold">Asesor</th>
                  <th className="px-3 py-1.5 font-semibold">Equipo</th>
                  <th className="px-3 py-1.5 text-right font-semibold">
                    Asignados
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold">
                    Trabajados
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold">
                    Intentos
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold">
                    Contactados
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold">
                    Cobertura
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold">
                    Sin contacto
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold">
                    Recuperados
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold">
                    Perdidos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border bg-ui-surface">
                {advisorRows.map((row) => (
                  <tr key={`${row.name}-${row.teamName}`}>
                    <td className="px-3 py-1.5 font-medium text-ui-text">
                      {row.name}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-ui-muted">
                      {row.teamName}
                    </td>
                    <td className="ui-data px-3 py-1.5 text-right">
                      {row.assigned}
                    </td>
                    <td className="ui-data px-3 py-1.5 text-right">
                      {row.worked}
                    </td>
                    <td className="ui-data px-3 py-1.5 text-right">
                      {row.attempts}
                    </td>
                    <td className="ui-data px-3 py-1.5 text-right">
                      {row.contacted}
                    </td>
                    <td className="ui-data px-3 py-1.5 text-right">
                      {row.active > 0
                        ? `${row.covered}/${row.active}`
                        : "—"}
                    </td>
                    <td
                      className={`ui-data px-3 py-1.5 text-right ${row.noContact > 0 ? "font-semibold text-ui-warning" : ""}`}
                    >
                      {row.noContact}
                    </td>
                    <td
                      className={`ui-data px-3 py-1.5 text-right ${row.recovered > 0 ? "font-semibold text-ui-success" : ""}`}
                    >
                      {row.recovered}
                    </td>
                    <td className="ui-data px-3 py-1.5 text-right">
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
                      Nadie tiene casos asignados en este alcance. Reparte
                      desde Distribuir la base.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionPanel>

        <SectionPanel
          title="Conversión por cohorte"
          description="Cada día de carga contra la meta del 3–6 %. Los descartes salen del denominador: la conversión se mide sobre oportunidad real."
        >
          <div className="overflow-x-auto rounded-xl border border-ui-border">
            <table className="min-w-full divide-y divide-ui-border text-sm">
              <thead className="bg-ui-surface-muted text-left text-xs uppercase tracking-wide text-ui-muted">
                <tr>
                  <th className="px-3 py-1.5 font-semibold">Cohorte</th>
                  <th className="px-3 py-1.5 text-right font-semibold">
                    Casos
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold">
                    Descartados
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold">
                    Oportunidad real
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold">
                    Recuperados
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold">
                    Conversión
                  </th>
                  <th className="px-3 py-1.5 font-semibold">Meta 3–6 %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border bg-ui-surface">
                {cohortRows.map((row) => {
                  const denominator = row.total - row.discarded;
                  const rate =
                    denominator > 0 ? (row.recovered / denominator) * 100 : null;
                  return (
                    <tr key={row.key}>
                      <td className="ui-data px-3 py-1.5">{row.key}</td>
                      <td className="ui-data px-3 py-1.5 text-right">
                        {row.total.toLocaleString("es-PE")}
                      </td>
                      <td className="ui-data px-3 py-1.5 text-right text-ui-muted">
                        {row.discarded.toLocaleString("es-PE")}
                      </td>
                      <td className="ui-data px-3 py-1.5 text-right">
                        {denominator.toLocaleString("es-PE")}
                      </td>
                      <td className="ui-data px-3 py-1.5 text-right">
                        {row.recovered.toLocaleString("es-PE")}
                      </td>
                      <td className="ui-data px-3 py-1.5 text-right">
                        {rate === null ? "—" : `${rate.toFixed(1)}%`}
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        {rate === null ? (
                          <span className="text-ui-muted">Sin base</span>
                        ) : rate >= 3 ? (
                          <span className="text-ui-success">
                            {rate > 6 ? "Sobre la meta" : "En rango"}
                          </span>
                        ) : (
                          <span className="text-ui-warning">
                            En maduración
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
                      Sin cargas en los últimos 7 días.
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
