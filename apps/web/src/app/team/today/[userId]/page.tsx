import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@repo/ui/page-header";

import { MyDayBody } from "@/features/my-day/components/my-day-body";
import { MyDayRefresh } from "@/features/my-day/components/my-day-refresh";
import { getMyDay } from "@/features/my-day/server/get-my-day";
import { CampaignDraftProvider } from "@/features/recovery/components/campaign-draft-context";
import { getSupervisedAdvisors } from "@/features/team-today/server/get-team-today";
import { requireCommercialAccess } from "@/server/auth/access";

import type { MyDayData } from "@/features/my-day/server/get-my-day";
import type { MyDayEntry } from "@/features/my-day/my-day-types";

const todayFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Los enlaces de «Mi día» vuelven a «Mi día» (`from=mi-dia`); desde aquí la
 * ficha debe volver a su lugar de siempre, no al día del supervisor.
 */
function withoutMyDayOrigin(entries: MyDayEntry[]): MyDayEntry[] {
  return entries.map((entry) => ({
    ...entry,
    href: entry.href.replace(/[?&]from=mi-dia$/, ""),
  }));
}

/**
 * Ver su día — SPEC-069 fase 2 (BR-006). El supervisor abre el «Mi día» de
 * un asesor de su equipo tal como lo ve él, en solo lectura: la misma lista,
 * sin editor. Sirve para acompañar sin preguntarle qué tiene pendiente. Solo
 * los asesores que acompaña: cualquier otro identificador no existe aquí.
 */
export default async function AdvisorDayPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { session, membership } = await requireCommercialAccess();

  if (membership.role === "ADMIN") redirect("/orders");
  if (membership.role !== "SUPERVISOR") redirect("/access-denied");

  const { userId } = await params;
  const { advisors } = await getSupervisedAdvisors(
    membership.organization.id,
    session.user.id,
  );
  const advisor = advisors.find((item) => item.userId === userId);

  if (!advisor) notFound();

  const day = await getMyDay(membership.organization.id, advisor.userId);
  const data: MyDayData = {
    ...day,
    now: withoutMyDayOrigin(day.now),
    later: withoutMyDayOrigin(day.later),
    cold: withoutMyDayOrigin(day.cold),
  };
  const today = todayFormatter.format(data.generatedAt);

  return (
    <CampaignDraftProvider>
      <div className="ui-page-stack">
        <MyDayRefresh />
        <PageHeader
          eyebrow={today.charAt(0).toUpperCase() + today.slice(1)}
          meta={
            <Link
              className="text-ui-accent underline-offset-2 hover:underline"
              href="/team/today"
            >
              ← Hoy en mi equipo
            </Link>
          }
          title={`El día de ${advisor.name}`}
        />
        <p className="rounded-lg border border-ui-border bg-ui-surface px-4 py-2 text-xs text-ui-muted">
          Lo que {advisor.name} ve en su «Mi día». Aquí solo se mira: para
          reasignar una venta caída, ábrela en Recupero de ventas.
        </p>

        <MyDayBody
          campaignHref={`/recovery/follow-up?advisor=${advisor.userId}`}
          data={data}
          readOnly
        />
      </div>
    </CampaignDraftProvider>
  );
}
