import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCount, formatLimaDateTime } from "@repo/ui/format";
import {
  allOf,
  detectRecoveryAttemptDiscrepancy,
  effectiveAttemptResult,
  recoveryBoardPeriods,
  resolveRecoveryBoardPeriod,
} from "@repo/validation";

import { attemptResultLabels } from "@/features/recovery/attempt-result-labels";
import { CampaignNav } from "@/features/recovery/components/campaign-nav";
import { QueueFilters } from "@/features/recovery/components/queue-filters";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import type { Prisma } from "@repo/database";

const reviewRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);

/**
 * Revisar tipificaciones — SPEC-049 BR-019 (CAM-T07).
 *
 * Lista los intentos del período cuya observación podría contradecir al
 * resultado, dentro del mismo alcance que Seguimiento (SPEC-040 BR-004),
 * para que la supervisión los revise caso por caso desde la ficha, con la
 * rectificación de BR-017. Nada cambia desde aquí; ningún caso se cierra ni
 * se pausa desde texto libre. Los intentos ya rectificados no se señalan.
 */
export default async function RecoveryAttemptQualityPage({
  searchParams,
}: {
  searchParams: Promise<{
    team?: string;
    advisor?: string;
    /** `periodo=` como el tablero; la barra de filtros lo escribe como `view=`. */
    periodo?: string;
    view?: string;
    tipo?: string;
  }>;
}) {
  const { session, membership } = await requireCommercialAccess();

  if (!reviewRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const parameters = await searchParams;
  const teamFilter = parameters.team ?? "";
  const advisorFilter = (parameters.advisor ?? "").trim().slice(0, 40);
  const kindFilter = (parameters.tipo ?? "").trim().slice(0, 40);
  const now = new Date();
  const period = resolveRecoveryBoardPeriod(
    parameters.view ?? parameters.periodo,
    now,
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

  // SPEC-040 BR-004: el mismo alcance que el tablero; la URL solo estrecha.
  const teamScope = supervisedTeamIds
    ? supervisedTeamIds.includes(teamFilter)
      ? teamFilter
      : ""
    : teamFilter;

  const caseScope = allOf<Prisma.RecoveryCaseWhereInput>(
    {
      organizationId: membership.organization.id,
      source: "NATIONAL_BASE",
      ...(supervisedTeamIds
        ? { assignedTeamId: { in: supervisedTeamIds } }
        : {}),
    },
    teamScope ? { assignedTeamId: teamScope } : null,
    advisorFilter ? { assignedUserId: advisorFilter } : null,
  );

  const [attempts, teams, advisors] = await Promise.all([
    database.recoveryCaseAttempt.findMany({
      where: {
        organizationId: membership.organization.id,
        createdAt: { gte: period.start, lt: period.end },
        correction: null,
        observation: { not: null },
        case: caseScope,
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
      select: {
        id: true,
        result: true,
        observation: true,
        createdAt: true,
        actor: { select: { name: true } },
        case: {
          select: {
            id: true,
            holderName: true,
            assignedTeam: { select: { name: true } },
          },
        },
      },
    }),
    isSupervisor
      ? Promise.resolve([])
      : database.commercialTeam.findMany({
          where: { organizationId: membership.organization.id, status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
    database.user.findMany({
      where: {
        recoveryCasesAssigned: {
          some: {
            organizationId: membership.organization.id,
            source: "NATIONAL_BASE",
            ...(supervisedTeamIds
              ? { assignedTeamId: { in: supervisedTeamIds } }
              : {}),
          },
        },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const flagged = attempts
    .map((attempt) => {
      const result = effectiveAttemptResult(attempt);
      const discrepancy = detectRecoveryAttemptDiscrepancy({
        result,
        observation: attempt.observation,
      });
      return discrepancy ? { attempt, result, discrepancy } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const kinds = [...new Set(flagged.map((item) => item.discrepancy.kind))];
  const visible = kindFilter
    ? flagged.filter((item) => item.discrepancy.kind === kindFilter)
    : flagged;

  const periodLabel =
    recoveryBoardPeriods.find((option) => option.value === period.key)
      ?.label ?? "Hoy";

  return (
    <div className="ui-page-stack">
      <PageHeader
        eyebrow="Campañas · Seguimiento"
        title="Revisar tipificaciones"
        description="Intentos cuya observación podría contradecir al resultado. Se revisan uno a uno desde la ficha; nada cambia solo."
      />

      <CampaignNav current="seguimiento" role={membership.role} />

      <p className="text-sm">
        <Link
          className="text-ui-accent underline-offset-2 hover:underline"
          href="/recovery/follow-up"
        >
          ← Volver a Seguimiento
        </Link>
      </p>

      <MetricGroup>
        <Metric
          emphasis="hero"
          label={`Intentos revisados · ${periodLabel}`}
          value={attempts.length}
        />
        <Metric
          hideWhenZero
          label="Con posible discrepancia"
          tone="warning"
          value={flagged.length}
        />
      </MetricGroup>

      <SectionPanel
        title="Por revisar"
        description={`${formatCount(visible.length)} intento(s). Cada uno abre la ficha, donde se rectifica si corresponde (el original se conserva).`}
      >
        <QueueFilters
          basePath="/recovery/follow-up/calidad"
          hideSearch
          options={{
            views: recoveryBoardPeriods.map((option) => ({
              value: option.value,
              label: option.label,
            })),
            ...(teams.length > 0 ? { teams } : {}),
            advisors,
            extras: [
              {
                key: "tipo",
                label: "Discrepancia",
                options: kinds.map((kind) => ({
                  value: kind,
                  label:
                    flagged.find((item) => item.discrepancy.kind === kind)
                      ?.discrepancy.label ?? kind,
                })),
              },
            ],
          }}
          resultLabel={`${formatCount(visible.length)} intento(s).`}
          values={{
            q: "",
            view: period.key,
            team: teamScope,
            department: "",
            plan: "",
            advisor: advisorFilter,
            extra: { tipo: kindFilter },
          }}
        />

        <div className="overflow-x-auto rounded-xl border border-ui-border">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Registrada</th>
                <th>Asesor</th>
                <th>Cliente</th>
                <th>Resultado</th>
                <th>Qué parece</th>
                <th>Observación</th>
                <th data-actions />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ attempt, result, discrepancy }) => (
                <tr key={attempt.id}>
                  <td className="whitespace-nowrap text-xs">
                    {formatLimaDateTime(attempt.createdAt)}
                  </td>
                  <td className="text-xs">
                    {attempt.actor.name}
                    {attempt.case.assignedTeam ? (
                      <span className="block text-ui-muted">
                        {attempt.case.assignedTeam.name}
                      </span>
                    ) : null}
                  </td>
                  <td className="font-medium text-ui-text">
                    {attempt.case.holderName}
                  </td>
                  <td className="text-xs">
                    {attemptResultLabels[result] ?? result}
                  </td>
                  <td className="text-xs text-ui-warning">
                    {discrepancy.label}
                  </td>
                  <td className="max-w-md text-xs text-ui-muted">
                    {attempt.observation}
                  </td>
                  <td data-actions>
                    <Link
                      className="text-ui-accent underline-offset-2 hover:underline"
                      href={`/recovery/campaigns/${attempt.case.id}?from=follow-up`}
                    >
                      Revisar en la ficha
                    </Link>
                  </td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-ui-muted" colSpan={7}>
                    Ninguna discrepancia en este período y alcance.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionPanel>
    </div>
  );
}
