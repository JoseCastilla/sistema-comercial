import Link from "next/link";

import { formatCount } from "@repo/ui/format";
import { PageHeader } from "@repo/ui/page-header";
import type { TeamMemberDaySummary } from "@repo/validation";

import { MyDayRefresh } from "@/features/my-day/components/my-day-refresh";
import { CampaignDraftProvider } from "@/features/recovery/components/campaign-draft-context";

import type { TeamTodayData } from "../server/get-team-today";

function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}

/** BR-005: cada cifra abre la lista que la explica, filtrada por el asesor. */
const hrefs = {
  sales: (userId: string) => `/recovery/sales?advisor=${userId}`,
  // «Agenda vencida» del tablero: una cita agendada cuya hora ya pasó.
  citas: (userId: string) =>
    `/recovery/follow-up?advisor=${userId}&next=vencida&status=SCHEDULED`,
  campaign: (userId: string) => `/recovery/follow-up?advisor=${userId}`,
  orders: (userId: string) => `/orders?advisor=${userId}&status=LOGISTICS`,
};

/**
 * Hoy en mi equipo — SPEC-069. Arriba el equipo en una línea; debajo una
 * tarjeta por asesor, primero quien más pierde. Todo sale del «Mi día» de
 * cada asesor (BR-002): lo que ve el supervisor es lo que ve el asesor.
 */
export function TeamToday({
  data,
  dateLabel,
}: {
  data: TeamTodayData;
  dateLabel: string;
}) {
  const { totals, members } = data;
  const figures = [
    {
      label: "Calientes sin llamar",
      value: formatCount(totals.salesNotCalled),
      alert: totals.salesNotCalled > 0,
    },
    {
      label: "Citas vencidas",
      value: formatCount(totals.citasOverdue),
      alert: totals.citasOverdue > 0,
    },
    {
      label: "Pedidos que necesitan acción",
      value: formatCount(totals.orders),
      alert: totals.orders > 0,
    },
    {
      label: "Gestiones hoy",
      value: formatCount(totals.attemptsToday),
      alert: false,
    },
    {
      label: "Cuota del equipo",
      value: `${formatCount(totals.quotaDelivered)} de ${formatCount(totals.quotaTarget)}`,
      alert: false,
    },
  ];

  return (
    // El refresco se pausa con una gestión abierta; aquí no hay editor, pero
    // el componente lo necesita para saberlo.
    <CampaignDraftProvider>
      <div className="ui-page-stack">
        <MyDayRefresh />
        <PageHeader
          eyebrow={dateLabel}
          meta={
            <span className="flex flex-wrap gap-x-3">
              {data.teamNames.length > 0 ? (
                <span>{data.teamNames.join(" · ")}</span>
              ) : null}
              {/* En el celular el menú no tiene «Mi equipo»: se llega aquí. */}
              <Link
                className="text-ui-accent underline-offset-2 hover:underline"
                href="/team"
              >
                Mi equipo y alta de asesores
              </Link>
            </span>
          }
          title="Hoy en mi equipo"
        />

        {/* BR-003: el equipo en una línea; solo lo de hoy y caliente. */}
        <section
          aria-label="El equipo hoy"
          className="flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-lg border border-ui-border bg-ui-surface px-4 py-3 text-sm text-ui-muted"
        >
          {figures.map((figure) => (
            <span key={figure.label}>
              {figure.label}{" "}
              <strong
                className={`text-base tabular-nums ${figure.alert ? "text-ui-warning" : "text-ui-text"}`}
              >
                {figure.value}
              </strong>
            </span>
          ))}
        </section>

        {members.length === 0 ? (
          <p className="rounded-lg border border-ui-border bg-ui-surface px-4 py-6 text-center text-sm text-ui-muted">
            Tus equipos no tienen asesores con venta habilitada. Los das de
            alta en Mi equipo.
          </p>
        ) : (
          <ol className="grid gap-2">
            {members.map((member) => (
              <li key={member.userId}>
                <MemberCard member={member} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </CampaignDraftProvider>
  );
}

/**
 * BR-004: lo de ahora primero y en color; la campaña, lo que hizo hoy y el
 * mes, debajo; lo antiguo, una cifra en gris.
 */
function MemberCard({ member }: { member: TeamMemberDaySummary }) {
  const nowItems = [
    member.salesNotCalled > 0
      ? {
          key: "ventas",
          href: hrefs.sales(member.userId),
          text: `${plural(member.salesNotCalled, "venta caliente sin llamar", "ventas calientes sin llamar")}${
            member.salesNotCalledOverdue > 0
              ? ` (${plural(member.salesNotCalledOverdue, "vencida", "vencidas")})`
              : ""
          }`,
          alert: member.salesNotCalledOverdue > 0,
        }
      : null,
    member.salesFollowUp > 0
      ? {
          key: "seguimientos",
          href: hrefs.sales(member.userId),
          text: plural(
            member.salesFollowUp,
            "seguimiento de venta caída vencido",
            "seguimientos de ventas caídas vencidos",
          ),
          alert: true,
        }
      : null,
    member.citasOverdue > 0
      ? {
          key: "citas",
          href: hrefs.citas(member.userId),
          text: plural(member.citasOverdue, "cita vencida", "citas vencidas"),
          alert: true,
        }
      : null,
    member.orders > 0
      ? {
          key: "pedidos",
          href: hrefs.orders(member.userId),
          text: plural(
            member.orders,
            "pedido que necesita acción",
            "pedidos que necesitan acción",
          ),
          alert: false,
        }
      : null,
  ].filter((item) => item !== null);

  const didToday =
    member.attemptsToday > 0
      ? `${plural(member.attemptsToday, "gestión", "gestiones")} hoy${
          member.lastAttemptLabel ? ` · la última a las ${member.lastAttemptLabel}` : ""
        }`
      : "Sin gestiones hoy";

  return (
    <article className="grid gap-2 rounded-lg border border-ui-border bg-ui-surface p-4 text-sm">
      <h2 className="flex flex-wrap items-baseline justify-between gap-x-3 text-base font-semibold text-ui-text">
        <Link
          className="underline-offset-2 hover:underline"
          href={hrefs.sales(member.userId)}
        >
          {member.name}
        </Link>
        <span className="text-xs font-medium tabular-nums text-ui-muted">
          Cuota {formatCount(member.quotaDelivered)} de{" "}
          {formatCount(member.quotaTarget)}
        </span>
      </h2>

      {nowItems.length > 0 ? (
        <ul className="grid gap-1">
          {nowItems.map((item) => (
            <li key={item.key}>
              <Link
                className={`underline-offset-2 hover:underline ${
                  item.alert ? "font-semibold text-ui-warning" : "text-ui-text"
                }`}
                href={item.href}
              >
                {item.text}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ui-muted">Nada urgente ahora.</p>
      )}

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ui-muted">
        {member.campaignTotal > 0 ? (
          <Link
            className="underline-offset-2 hover:underline"
            href={hrefs.campaign(member.userId)}
          >
            Campaña: {plural(member.campaignTotal, "caso", "casos")} por
            trabajar hoy
          </Link>
        ) : (
          <span>Campaña: nada por trabajar hoy</span>
        )}
        {/* BR-007: sin gestiones no es ausencia; en ámbar después de las 11. */}
        <span
          className={
            member.idle === "tarde" ? "font-semibold text-ui-warning" : undefined
          }
        >
          {didToday}
        </span>
        <span>
          {plural(member.enteredToday, "venta ingresada", "ventas ingresadas")}{" "}
          hoy
        </span>
        {member.coldCount > 0 ? (
          <span>{plural(member.coldCount, "antigua", "antiguas")}</span>
        ) : null}
      </p>
    </article>
  );
}
