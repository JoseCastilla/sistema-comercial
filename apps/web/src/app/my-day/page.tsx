import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@repo/ui/page-header";

import { Button } from "@/components/ui/button";

import {
  MyDayFlatList,
  MyDayList,
} from "@/features/my-day/components/my-day-list";
import { MyDayProgressPanel } from "@/features/my-day/components/my-day-progress";
import { MyDayRefresh } from "@/features/my-day/components/my-day-refresh";
import { MyDaySalesPanel } from "@/features/my-day/components/my-day-sales";
import { getMyDay } from "@/features/my-day/server/get-my-day";
import { CampaignDraftProvider } from "@/features/recovery/components/campaign-draft-context";
import { requireCommercialAccess } from "@/server/auth/access";

const todayFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Mi día — SPEC-063. La bandeja de trabajo de quien vende: qué toca ahora,
 * qué viene más tarde hoy y cuánto va ganando. Solo su propio trabajo
 * (BR-003); los roles que no venden tienen su propia entrada.
 */
export default async function MyDayPage() {
  const { session, membership } = await requireCommercialAccess();

  if (membership.role !== "AGENT" && membership.role !== "SUPERVISOR") {
    redirect("/orders");
  }

  const data = await getMyDay(membership.organization.id, session.user.id);
  const firstName = session.user.name.split(" ")[0] ?? session.user.name;
  const today = todayFormatter.format(data.generatedAt);

  return (
    // Una sola gestión abierta a la vez en toda la pantalla (BR-090): el
    // borrador es de «Mi día», no de cada lista.
    <CampaignDraftProvider>
      <div className="ui-page-stack">
        <MyDayRefresh />
        <PageHeader
          description="Lo que te toca ahora, lo que viene más tarde y cuánto vas ganando."
          eyebrow={today.charAt(0).toUpperCase() + today.slice(1)}
          title={`Mi día, ${firstName}`}
        />

        <MyDayProgressPanel progress={data.progress} />

        <MyDaySalesPanel
          monthLabel={data.progress.monthLabel}
          sales={data.sales}
        />

        <section aria-labelledby="mi-dia-ahora" className="grid gap-4">
          <h2 className="text-lg font-bold text-ui-text" id="mi-dia-ahora">
            Ahora
          </h2>
          {data.now.length > 0 ? (
            <MyDayList campaignTotal={data.campaign.total} entries={data.now} />
          ) : (
            <div className="rounded-lg border border-dashed border-ui-border-strong bg-ui-surface p-6">
              <p className="text-base font-semibold text-ui-text">
                Nada pendiente por ahora.
              </p>
              <p className="mt-1 text-sm text-ui-muted">
                No tienes citas, ventas caídas ni pedidos que te esperen. Puedes
                tomar clientes nuevos de tu equipo en tu cola de campaña.
              </p>
              <Button asChild className="mt-3">
                <Link href="/recovery/campaigns">Ir a mi cola de campaña</Link>
              </Button>
            </div>
          )}
        </section>

        {data.later.length > 0 ? (
          <details className="rounded-lg border border-ui-border bg-ui-surface">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ui-text">
              Más tarde hoy{" "}
              <span className="font-medium text-ui-soft">
                {data.later.length}
              </span>
            </summary>
            <div className="px-4 pb-4">
              <MyDayFlatList entries={data.later} />
            </div>
          </details>
        ) : null}

        {data.cold.length > 0 ? (
          <details className="rounded-lg border border-ui-border bg-ui-surface">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ui-text">
              Ventas antiguas por recuperar{" "}
              <span className="font-medium text-ui-soft">
                {data.cold.length}
              </span>
              <span className="mt-0.5 block text-xs font-normal text-ui-muted">
                Clientes de ventas de hace más de 7 días. Siguen siendo una
                oportunidad, pero lo caliente va primero.
              </span>
            </summary>
            <div className="px-4 pb-4">
              <MyDayFlatList entries={data.cold} />
            </div>
          </details>
        ) : null}
      </div>
    </CampaignDraftProvider>
  );
}
