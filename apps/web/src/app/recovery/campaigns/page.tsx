import Link from "next/link";
import { formatCount, formatLimaDateTime } from "@repo/ui/format";
import {
  allOf,
  baseRecoveryMinimumDailyAttempts,
  classifyRecoveryWorkItem,
  compareRecoveryWorkNow,
  countOnSameLimaDay,
  describeRecoveryLineOrigin,
  describeRecoveryWait,
  isBaseRecoveryResolutionDue,
  parseRecoveryAgeBucket,
  parseRecoveryWorkView,
  recoveryAgeBucketRange,
  recoveryAgendaKindLabels,
  recoveryAgendaOriginLabels,
  recoveryWorkViewOptions,
  selectRecoveryAgendaItem,
} from "@repo/validation";

import { AdvisorCampaignNav } from "@/features/recovery/components/advisor-campaign-nav";
import { CampaignQueueRow } from "@/features/recovery/components/campaign-queue-row";
import {
  buildMapsUrl,
  composeAddress,
  readContactSummary,
  readCoordinates,
} from "@/features/recovery/contact-summary";
import {
  CampaignDraftProvider,
  GuardedLink,
} from "@/features/recovery/components/campaign-draft-context";
import { CampaignInboxFilters } from "@/features/recovery/components/campaign-inbox-filters";
import { TakePoolBlockForm } from "@/features/recovery/components/take-pool-block-form";
import { lossReasonLabels } from "@/features/recovery/loss-reason-labels";
import { buildRecoverySearchWhere } from "@/features/recovery/server/recovery-search-where";
import { returnStaleBaseCasesToPool } from "@/features/recovery/server/return-stale-base-cases";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { CampaignQueueRowData } from "@/features/recovery/components/campaign-queue-row";
import type { Prisma } from "@repo/database";
import type { RecoveryWorkViewKey } from "@repo/validation";

import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

function summarizePlan(planRaw: string | null): string {
  if (!planRaw) return "—";
  const match = planRaw.match(/S\/\s?\d+(?:\.\d+)?/);
  return match ? `Máximo ${match[0]}` : planRaw;
}

const resolutionLabels: Record<string, string> = {
  RECOVERED: "Recuperado",
  LOST: "Perdido",
  DISCARDED: "Descartado",
};

const openStatuses = ["ASSIGNED", "IN_PROGRESS", "SCHEDULED", "WAITING"] as const;
const resolvedStatuses = ["RECOVERED", "LOST", "DISCARDED"] as const;
const historyDays = 30;

/**
 * Cola de campaña del asesor — SPEC-030 BR-029b, BR-032, BR-058 y BR-078;
 * SPEC-049 BR-007, BR-012 a BR-015. Cuatro vistas sobre la misma cartera:
 * Trabajar ahora (solo lo exigible, urgentes primero y después lo más
 * reciente), Por completar, En espera (con por qué y cómo termina) e
 * Historial (30 días, solo lectura). Cada fila dice qué toca, no solo qué
 * pasó la última vez.
 */
const pageSize = 100;

export default async function RecoveryCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    visto?: string;
    department?: string;
    plan?: string;
    page?: string;
    intento?: string;
    vista?: string;
    age?: string;
  }>;
}) {
  const { session, membership } = await requireCommercialAccess();
  const parameters = await searchParams;
  const searchInput = (parameters.q ?? "").trim().slice(0, 80);
  const departmentFilter = parameters.department ?? "";
  const planFilter = (parameters.plan ?? "").trim().slice(0, 100);
  const view = parseRecoveryWorkView(parameters.vista);
  const age = parseRecoveryAgeBucket(parameters.age);
  // Confirmación del intento que el asesor acaba de registrar: vuelve con él
  // desde la ficha para que no pierda el dato de cuántos intentos lleva hoy.
  const attemptNotice = (parameters.intento ?? "").trim().slice(0, 300);
  const requestedPage = Math.max(
    1,
    Number.parseInt(parameters.page ?? "1", 10) || 1,
  );
  // El caso que acaba de consultar, para que lo reconozca al volver.
  const justVisited = (parameters.visto ?? "").trim().slice(0, 40);

  // BR-077: al abrir la cola, lo abandonado ya volvió al pool.
  await returnStaleBaseCasesToPool(membership.organization.id);

  const now = new Date();

  // SPEC-048 BR-012: las citas vencidas o que vencen en las próximas dos
  // horas se ven encima de la lista y fuera del alcance de los filtros.
  const dueCommitments = await database.recoveryCaseCommitment.findMany({
    where: {
      organizationId: membership.organization.id,
      status: "PENDING",
      scheduledAt: { lt: new Date(now.getTime() + 2 * 60 * 60 * 1000) },
      case: {
        source: "NATIONAL_BASE",
        assignedUserId: session.user.id,
        status: { in: ["ASSIGNED", "IN_PROGRESS", "SCHEDULED"] },
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: 20,
    select: {
      id: true,
      scheduledAt: true,
      case: { select: { id: true, holderName: true } },
    },
  });

  /**
   * "Hoy solo llamo Lima": la bandeja propia se filtra igual que el pool. La
   * búsqueda alcanza solo los casos del propio asesor (BR-088). La recencia
   * (BR-014) se aplica en memoria para que las cifras de cabecera no
   * dependan de ella.
   */
  const mineWhere = allOf<Prisma.RecoveryCaseWhereInput>(
    {
      organizationId: membership.organization.id,
      source: "NATIONAL_BASE",
      assignedUserId: session.user.id,
    },
    buildRecoverySearchWhere(searchInput),
    departmentFilter
      ? { department: { equals: departmentFilter, mode: "insensitive" } }
      : null,
    planFilter
      ? {
          services: {
            some: {
              discardedAt: null,
              planRaw: { contains: planFilter, mode: "insensitive" },
            },
          },
        }
      : null,
  );

  const [myCases, myDepartments, sellingMembership, history] =
    await Promise.all([
      database.recoveryCase.findMany({
        where: allOf<Prisma.RecoveryCaseWhereInput>(mineWhere, {
          status: { in: [...openStatuses] },
        }),
        orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }],
        select: {
          id: true,
          holderName: true,
          documentNumber: true,
          department: true,
          status: true,
          claimedAt: true,
          nextActionAt: true,
          lastSightingAt: true,
          portabilityEligibleAt: true,
          fatherName: true,
          motherName: true,
          birthPlace: true,
          province: true,
          district: true,
          contactSummary: true,
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
            where: { kind: "CONTACT" },
            select: { phoneNumber: true, invalidMarkedAt: true },
          },
          attempts: {
            orderBy: { createdAt: "desc" },
            take: 15,
            select: {
              createdAt: true,
              result: true,
              observation: true,
              followUpAt: true,
            },
          },
          commitments: {
            where: { status: "PENDING" },
            take: 1,
            select: { scheduledAt: true },
          },
          events: {
            where: { type: "CASE_REOPENED" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, actor: { select: { name: true } } },
          },
        },
      }),
      database.recoveryCase.groupBy({
        by: ["department"],
        where: {
          organizationId: membership.organization.id,
          source: "NATIONAL_BASE",
          assignedUserId: session.user.id,
          status: { in: [...openStatuses] },
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
      view === "historial"
        ? database.recoveryCase.findMany({
            where: allOf<Prisma.RecoveryCaseWhereInput>(mineWhere, {
              status: { in: [...resolvedStatuses] },
              resolvedAt: {
                gte: new Date(now.getTime() - historyDays * 24 * 60 * 60 * 1000),
              },
            }),
            orderBy: { resolvedAt: "desc" },
            take: 300,
            select: {
              id: true,
              holderName: true,
              documentNumber: true,
              status: true,
              resolvedAt: true,
              lossReason: true,
              discardReason: true,
              resolvedBy: { select: { name: true } },
              recoveredDitoOrder: { select: { orderCodeRaw: true } },
            },
          })
        : Promise.resolve([]),
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

  const ageRange = age ? recoveryAgeBucketRange(age, now) : null;

  const classified = myCases.map((item) => {
    const attemptsToday = countOnSameLimaDay(
      item.attempts.map((attempt) => attempt.createdAt),
      now,
    );
    const last = item.attempts[0] ?? null;
    const lastResult = last ? String(last.result) : null;
    const validPhones = item.phones.filter(
      (phone) => phone.invalidMarkedAt === null,
    );
    const returned = item.events[0] ?? null;
    const workItem = selectRecoveryAgendaItem(
      {
        status: String(item.status),
        nextActionAt: item.nextActionAt,
        portabilityEligibleAt: item.portabilityEligibleAt,
        lastResult,
        lastAttemptAt: last?.createdAt ?? null,
        pendingCommitmentAt: item.commitments[0]?.scheduledAt ?? null,
        returnedFromVerificationAt: returned?.createdAt ?? null,
        validPhoneCount: validPhones.length + item.services.length,
        lastFollowUpAt: last?.followUpAt ?? null,
      },
      now,
    );
    const workView = workItem ? classifyRecoveryWorkItem(workItem, now) : "ahora";
    const wait = workItem && workView === "espera" ? describeRecoveryWait(workItem) : null;
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
    const summary = readContactSummary(item.contactSummary);

    const row: CampaignQueueRowData = {
      origin,
      // Llamar es la acción: primero un teléfono de contacto válido; sin él,
      // la propia línea a portar.
      phone:
        validPhones[0]?.phoneNumber ?? item.services[0]?.serviceNumber ?? null,
      interestedWithOrder:
        lastResult === "INTERESADO_CON_PEDIDO" && String(item.status) !== "WAITING",
      id: item.id,
      lastResult,
      lastObservation: last?.observation ?? null,
      lastAttemptAtLabel: last ? formatLimaDateTime(last.createdAt) : null,
      holderName: item.holderName,
      documentNumber: item.documentNumber,
      fatherName: item.fatherName,
      motherName: item.motherName,
      birthPlace: item.birthPlace,
      phones: validPhones.map((phone) => phone.phoneNumber),
      invalidPhones: item.phones
        .filter((phone) => phone.invalidMarkedAt !== null)
        .map((phone) => phone.phoneNumber),
      location: [item.department, item.province, item.district]
        .filter(Boolean)
        .join(" · "),
      address: composeAddress(summary),
      reference: summary.reference ?? null,
      deliveryInstructions: summary.shippingInstructions ?? null,
      mapsUrl: buildMapsUrl(readCoordinates(summary)),
      services: item.services.map((service) => ({
        serviceNumber: service.serviceNumber,
        planRaw: service.planRaw,
        carrierRaw: service.carrierRaw,
        isPlantLine: service.isPlantLine,
      })),
      status: String(item.status),
      planSummary: summarizePlan(item.services[0]?.planRaw ?? null),
      serviceCount: item.services.length,
      attemptsToday,
      nextActionAtLabel: item.nextActionAt
        ? formatLimaDateTime(item.nextActionAt)
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
      work: workItem
        ? {
            label: recoveryAgendaKindLabels[workItem.kind],
            detail:
              workItem.origin === "devuelto" && returned
                ? `${recoveryAgendaOriginLabels[workItem.origin]} · ${returned.actor?.name ?? "el cruce"} · ${formatLimaDateTime(returned.createdAt)}`
                : recoveryAgendaOriginLabels[workItem.origin],
            overdue: workItem.overdue,
            wait,
          }
        : null,
    };

    return {
      row,
      workItem,
      workView,
      lastSightingAt: item.lastSightingAt,
      inAge:
        !ageRange ||
        ((ageRange.gte === undefined ||
          item.lastSightingAt.getTime() >= ageRange.gte.getTime()) &&
          (ageRange.lt === undefined ||
            item.lastSightingAt.getTime() < ageRange.lt.getTime())),
    };
  });

  // BR-012: contadores por población, no por página ni por recencia.
  const counts: Record<RecoveryWorkViewKey, number> = {
    ahora: classified.filter((entry) => entry.workView === "ahora").length,
    completar: classified.filter((entry) => entry.workView === "completar").length,
    espera: classified.filter((entry) => entry.workView === "espera").length,
    historial: history.length,
  };

  const visible = classified.filter(
    (entry) => entry.workView === view && entry.inAge,
  );
  if (view === "ahora") {
    // BR-013: exigibles primero, después lo más reciente primero.
    visible.sort((left, right) =>
      compareRecoveryWorkNow(
        { item: left.workItem!, lastSightingAt: left.lastSightingAt },
        { item: right.workItem!, lastSightingAt: right.lastSightingAt },
      ),
    );
  } else {
    visible.sort(
      (left, right) =>
        (left.workItem?.at?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (right.workItem?.at?.getTime() ?? Number.MAX_SAFE_INTEGER),
    );
  }

  const listTotal = view === "historial" ? history.length : visible.length;
  const totalPages = Math.max(1, Math.ceil(listTotal / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const rows = visible
    .slice((page - 1) * pageSize, page * pageSize)
    .map((entry) => entry.row);

  const underMinimum = classified.filter(
    (entry) =>
      entry.workView === "ahora" &&
      entry.row.status !== "SCHEDULED" &&
      entry.row.status !== "WAITING" &&
      entry.row.attemptsToday < baseRecoveryMinimumDailyAttempts,
  );

  const departments = poolDepartments
    .map((group) => group.department)
    .filter((value): value is string => value !== null && value.length > 0);
  const myDepartmentOptions = myDepartments
    .map((group) => group.department)
    .filter((value): value is string => value !== null && value.length > 0);

  /**
   * El contexto de la cola viaja a la ficha para que «Volver a mi cola»
   * devuelva al asesor donde estaba, y no a una bandeja recién barajada.
   */
  function contextQuery(overrides: { vista?: string; page?: number } = {}) {
    const query = new URLSearchParams();
    const vista = overrides.vista ?? view;
    if (vista !== "ahora") query.set("vista", vista);
    if (searchInput) query.set("q", searchInput);
    if (departmentFilter) query.set("department", departmentFilter);
    if (planFilter) query.set("plan", planFilter);
    if (age) query.set("age", age);
    const target = overrides.page ?? page;
    if (target > 1 && overrides.vista === undefined) {
      query.set("page", String(target));
    }
    return query.toString();
  }
  const queueContextQuery = contextQuery();

  function pageHref(target: number): string {
    const suffix = contextQuery({ page: target });
    return `/recovery/campaigns${suffix ? `?${suffix}` : ""}`;
  }
  function viewHref(target: RecoveryWorkViewKey): string {
    const suffix = contextQuery({ vista: target });
    return `/recovery/campaigns${suffix ? `?${suffix}` : ""}`;
  }

  const currentView = recoveryWorkViewOptions.find(
    (option) => option.value === view,
  )!;
  const hasFilters = Boolean(searchInput || departmentFilter || planFilter || age);

  return (
    <>
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="Campañas"
          title="Mi cola de campaña"
          description="Tus casos de base asignados y los casos libres de tu equipo. Un caso sin respuesta exige tres intentos en el día."
        />

        <AdvisorCampaignNav current="cola" />

        {attemptNotice ? (
          <p
            className="rounded-lg border border-ui-success bg-ui-success-soft px-3 py-2 text-sm text-ui-success"
            role="status"
          >
            {attemptNotice}
          </p>
        ) : null}

        <MetricGroup>
          <Metric
            emphasis="hero"
            href={viewHref("ahora")}
            label="Trabajar ahora"
            value={counts.ahora}
          />
          <Metric
            hideWhenZero
            href={viewHref("completar")}
            label="Por completar"
            tone="warning"
            value={counts.completar}
          />
          <Metric
            href={viewHref("espera")}
            label="En espera"
            value={counts.espera}
          />
          <Metric
            hideWhenZero
            label="Sin los 3 intentos de hoy"
            tone="warning"
            value={underMinimum.length}
          />
          <Metric
            label={
              sellingMembership
                ? `Casos libres de ${sellingMembership.team.name}`
                : "Casos libres del equipo"
            }
            value={poolCount}
          />
        </MetricGroup>

        {sellingMembership ? (
          <SectionPanel
            title="Tomar casos libres"
            description="Bloques de hasta 10 casos, los más recientes primero. Primero los clientes que ya cumplieron los 30 días y pueden portar: hay que llamarlos antes."
          >
            <TakePoolBlockForm departments={departments} />
          </SectionPanel>
        ) : (
          <SectionPanel
            title="Sin equipo vendedor"
            description="No tienes venta habilitada en un equipo activo, así que no puedes tomar casos libres."
          >
            <p className="text-sm text-ui-muted">
              Si distribuyes trabajo, hazlo desde{" "}
              <Link
                className="text-ui-accent underline-offset-2 hover:underline"
                href="/recovery/distribute"
              >
                Distribuir la base
              </Link>
              .
            </p>
          </SectionPanel>
        )}

        {dueCommitments.length > 0 ? (
          <SectionPanel
            title="Compromisos por atender"
            description="Llamadas acordadas que ya vencieron o vencen en las próximas dos horas. No dependen de los filtros de abajo."
          >
            <ul className="space-y-1 text-sm">
              {dueCommitments.map((commitment) => (
                <li
                  className="flex flex-wrap items-center gap-2"
                  key={commitment.id}
                >
                  <span
                    className={
                      commitment.scheduledAt.getTime() < now.getTime()
                        ? "font-medium text-ui-danger"
                        : "font-medium text-ui-text"
                    }
                  >
                    {formatLimaDateTime(commitment.scheduledAt)}
                  </span>
                  <Link
                    className="text-ui-accent underline-offset-2 hover:underline"
                    href={`/recovery/campaigns/${commitment.case.id}${queueContextQuery ? `?${queueContextQuery}` : ""}`}
                  >
                    {commitment.case.holderName}
                  </Link>
                  <span className="text-xs text-ui-muted">
                    {commitment.scheduledAt.getTime() < now.getTime()
                      ? "vencida"
                      : "en las próximas dos horas"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              <Link
                className="text-ui-accent underline-offset-2 hover:underline"
                href="/recovery/agenda"
              >
                Ver mi agenda
              </Link>
            </p>
          </SectionPanel>
        ) : null}

        <SectionPanel title={currentView.label} description={currentView.hint}>
          <CampaignDraftProvider>
            <nav aria-label="Vistas de la cola" className="ui-segmented-scroll mb-3">
              <div className="ui-segmented">
                {recoveryWorkViewOptions.map((option) => (
                  <GuardedLink
                    aria-current={option.value === view ? "page" : undefined}
                    className="ui-segmented__item"
                    href={viewHref(option.value)}
                    key={option.value}
                  >
                    {option.label}
                    <span className="ml-1 text-xs text-ui-muted">
                      {formatCount(counts[option.value])}
                    </span>
                  </GuardedLink>
                ))}
              </div>
            </nav>

            <CampaignInboxFilters
              age={age ?? ""}
              department={departmentFilter}
              departments={myDepartmentOptions}
              plan={planFilter}
              resultLabel={`${formatCount(listTotal)} caso(s) en esta vista.`}
              search={searchInput}
              vista={view}
            />

            {view === "historial" ? (
              <div className="overflow-x-auto rounded-xl border border-ui-border">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>DNI</th>
                      <th>Resolución</th>
                      <th>Quién</th>
                      <th>Cuándo</th>
                      <th>Orden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history
                      .slice((page - 1) * pageSize, page * pageSize)
                      .map((item) => (
                        <tr key={item.id}>
                          <td className="font-medium text-ui-text">
                            <Link
                              className="text-ui-accent underline-offset-2 hover:underline"
                              href={`/recovery/campaigns/${item.id}${queueContextQuery ? `?${queueContextQuery}` : ""}`}
                            >
                              {item.holderName}
                            </Link>
                          </td>
                          <td className="text-xs">{item.documentNumber}</td>
                          <td className="text-xs">
                            {resolutionLabels[String(item.status)] ?? item.status}
                            {item.lossReason ? (
                              <span className="block text-ui-muted">
                                {lossReasonLabels[String(item.lossReason)] ??
                                  String(item.lossReason)}
                              </span>
                            ) : null}
                            {item.discardReason ? (
                              <span className="block text-ui-muted">
                                {String(item.discardReason)}
                              </span>
                            ) : null}
                          </td>
                          <td className="text-xs">{item.resolvedBy?.name ?? "—"}</td>
                          <td className="text-xs">
                            {item.resolvedAt ? formatLimaDateTime(item.resolvedAt) : "—"}
                          </td>
                          <td className="text-xs">
                            {item.recoveredDitoOrder?.orderCodeRaw ?? "—"}
                          </td>
                        </tr>
                      ))}
                    {history.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-ui-muted" colSpan={6}>
                          Ningún caso tuyo se resolvió en los últimos 30 días.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-ui-border">
                <table className="ui-table ui-table--campaign">
                  <thead>
                    <tr>
                      <th>Último resultado</th>
                      <th>Qué toca</th>
                      <th>Observación</th>
                      <th>Cliente</th>
                      <th>Teléfono</th>
                      <th>DNI</th>
                      <th>Operador / Plan</th>
                      <th data-numeric>Intentos hoy</th>
                      <th>Próxima acción</th>
                      <th data-actions />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <CampaignQueueRow
                        justVisited={row.id === justVisited}
                        key={row.id}
                        minimumDailyAttempts={baseRecoveryMinimumDailyAttempts}
                        queueContext={queueContextQuery}
                        row={row}
                      />
                    ))}
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          className="px-3 py-6 text-center text-ui-muted"
                          colSpan={10}
                        >
                          {/* Decirle que no tiene casos mientras filtra le hace
                            creer que los perdió. */}
                          {hasFilters
                            ? "Ningún caso tuyo coincide con lo que buscas. Prueba con menos datos o limpia el filtro."
                            : view === "ahora"
                              ? counts.espera + counts.completar > 0
                                ? "Nada exigible ahora mismo. Revisa Por completar o En espera, o toma casos libres."
                                : "No tienes casos de campaña asignados. Toma casos libres para empezar."
                              : "Nada en esta vista."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 ? (
              <div className="flex items-center gap-3 text-sm">
                {page > 1 ? (
                  <GuardedLink
                    className="text-ui-accent underline-offset-2 hover:underline"
                    href={pageHref(page - 1)}
                  >
                    ← Anterior
                  </GuardedLink>
                ) : null}
                <span className="text-ui-muted">
                  Página {page} de {totalPages}
                </span>
                {page < totalPages ? (
                  <GuardedLink
                    className="text-ui-accent underline-offset-2 hover:underline"
                    href={pageHref(page + 1)}
                  >
                    Siguiente →
                  </GuardedLink>
                ) : null}
              </div>
            ) : null}
          </CampaignDraftProvider>
        </SectionPanel>
      </div>
    </>
  );
}
