import Link from "next/link";
import {
  baseRecoveryMinimumDailyAttempts,
  countOnSameLimaDay,
  describeRecoveryLineOrigin,
  isBaseRecoveryResolutionDue,
  parseRecoverySearchTerm,
} from "@repo/validation";

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
import { returnStaleBaseCasesToPool } from "@/features/recovery/server/return-stale-base-cases";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { Prisma } from "@repo/database";

import { formatCount } from "@repo/ui/format";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

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
  WAITING: "Esperando confirmación de portabilidad",
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
  searchParams: Promise<{
    q?: string;
    visto?: string;
    department?: string;
    plan?: string;
    page?: string;
    intento?: string;
  }>;
}) {
  const { session, membership } = await requireCommercialAccess();
  const parameters = await searchParams;
  const searchInput = (parameters.q ?? "").trim().slice(0, 80);
  const search = parseRecoverySearchTerm(searchInput);
  const departmentFilter = parameters.department ?? "";
  const planFilter = (parameters.plan ?? "").trim().slice(0, 100);
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
    /**
     * El asesor busca con un dato suelto y el sistema lo prueba contra todo:
     * nombre, DNI, teléfono de contacto y número de línea. Las palabras del
     * nombre se exigen todas pero en cualquier orden — nadie dicta los cuatro
     * apellidos seguidos—; los dígitos valen para los tres campos numéricos,
     * porque quien llama no sabe cuál de ellos tiene en la mano.
     *
     * Busca solo en **sus** casos. El pool se reparte en bloques por
     * BR-028: poder pescar en él por DNI convertiría un reparto equitativo
     * en una elección.
     */
    ...(search
      ? {
          AND: [
            ...search.words.map((word) => ({
              holderName: { contains: word, mode: "insensitive" as const },
            })),
            ...(search.digits
              ? [
                  {
                    OR: [
                      { documentNumber: { contains: search.digits } },
                      {
                        phones: {
                          some: { phoneNumber: { contains: search.digits } },
                        },
                      },
                      {
                        services: {
                          some: {
                            discardedAt: null,
                            serviceNumber: { contains: search.digits },
                          },
                        },
                      },
                    ],
                  },
                ]
              : []),
          ],
        }
      : {}),
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

  /**
   * El total manda sobre la página pedida. Un caso resuelto o descartado
   * mientras el asesor estaba en la ficha puede dejar sin contenido la
   * página tres, y volver a ella mostraría una bandeja vacía con el mensaje
   * de «nada coincide»: parecería que perdió su cartera. Se muestra la
   * última página que sí existe.
   */
  const myTotal = await database.recoveryCase.count({ where: myCasesWhere });
  const totalPages = Math.max(1, Math.ceil(myTotal / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const [myCases, myDepartments, sellingMembership] =
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
            where: { kind: "CONTACT", invalidMarkedAt: null },
            select: { phoneNumber: true },
          },
          attempts: {
            orderBy: { createdAt: "desc" },
            take: 15,
            select: {
              createdAt: true,
              result: true,
              observation: true,
            },
          },
        },
      }),
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
    const lastResult = item.attempts[0]
      ? String(item.attempts[0].result)
      : null;
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
        item.phones[0]?.phoneNumber ?? item.services[0]?.serviceNumber ?? null,
      interestedWithOrder:
        lastResult === "INTERESADO_CON_PEDIDO" &&
        String(item.status) !== "WAITING",
      id: item.id,
      lastResult,
      lastObservation: item.attempts[0]?.observation ?? null,
      lastAttemptAtLabel: item.attempts[0]
        ? dateTimeFormatter.format(item.attempts[0].createdAt)
        : null,
      holderName: item.holderName,
      documentNumber: item.documentNumber,
      fatherName: item.fatherName,
      motherName: item.motherName,
      birthPlace: item.birthPlace,
      phones: item.phones.map((phone) => phone.phoneNumber),
      location: [item.department, item.province, item.district]
        .filter(Boolean)
        .join(" · "),
      address: composeAddress(readContactSummary(item.contactSummary)),
      reference: readContactSummary(item.contactSummary).reference ?? null,
      deliveryInstructions:
        readContactSummary(item.contactSummary).shippingInstructions ?? null,
      mapsUrl: buildMapsUrl(
        readCoordinates(readContactSummary(item.contactSummary)),
      ),
      services: item.services.map((service) => ({
        serviceNumber: service.serviceNumber,
        planRaw: service.planRaw,
        carrierRaw: service.carrierRaw,
        isPlantLine: service.isPlantLine,
      })),
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

  /**
   * El contexto de la cola viaja a la ficha para que «Volver a mi cola»
   * devuelva al asesor donde estaba, y no a una bandeja recién barajada.
   */
  const queueContext = new URLSearchParams();
  if (searchInput) queueContext.set("q", searchInput);
  if (departmentFilter) queueContext.set("department", departmentFilter);
  if (planFilter) queueContext.set("plan", planFilter);
  if (page > 1) queueContext.set("page", String(page));
  const queueContextQuery = queueContext.toString();

  function pageHref(target: number): string {
    const query = new URLSearchParams();
    if (searchInput) query.set("q", searchInput);
    if (departmentFilter) query.set("department", departmentFilter);
    if (planFilter) query.set("plan", planFilter);
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return `/recovery/campaigns${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <>
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="Campañas"
          title="Mi cola de campaña"
          description="Tus casos de base asignados y los casos libres de tu equipo. Un caso sin respuesta exige tres intentos en el día."
        />

        {attemptNotice ? (
          <p
            className="rounded-lg border border-ui-success bg-ui-success-soft px-3 py-2 text-sm text-ui-success"
            role="status"
          >
            {attemptNotice}
          </p>
        ) : null}

        <MetricGroup>
          <Metric emphasis="hero" label="Mis casos abiertos" value={myTotal} />
          <Metric
            hideWhenZero
            label="Vencidos o por resolver"
            tone="danger"
            value={dueToday.length}
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

        <SectionPanel
          title="Mis casos"
          description="Vencidos primero, luego lo de hoy, después los agendados; lo que espera confirmación queda al fondo."
        >
          <CampaignDraftProvider>
          <CampaignInboxFilters
            department={departmentFilter}
            departments={myDepartmentOptions}
            plan={planFilter}
            resultLabel={`${formatCount(myTotal)} caso(s) cumplen el filtro.`}
            search={searchInput}
          />

          <div className="overflow-x-auto rounded-xl border border-ui-border">
            <table className="ui-table ui-table--campaign">
              <thead>
                <tr>
                  <th>Tipificación</th>
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
                    statusLabel={statusLabels[row.status] ?? row.status}
                  />
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-ui-muted"
                      colSpan={9}
                    >
                      {/* Decirle que no tiene casos mientras filtra le hace
                          creer que los perdió. */}
                      {search || departmentFilter || planFilter
                        ? "Ningún caso tuyo coincide con lo que buscas. Prueba con menos datos o limpia el filtro."
                        : "No tienes casos de campaña asignados. Toma casos libres para empezar."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

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
