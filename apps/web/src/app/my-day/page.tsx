import { redirect } from "next/navigation";

import { PageHeader } from "@repo/ui/page-header";

import { MyDayBody } from "@/features/my-day/components/my-day-body";
import { MyDayRefresh } from "@/features/my-day/components/my-day-refresh";
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
        {/* Sin subtítulo: el asesor abre esta pantalla decenas de veces al día. */}
        <PageHeader
          eyebrow={today.charAt(0).toUpperCase() + today.slice(1)}
          title={`Mi día, ${firstName}`}
        />

        <MyDayBody data={data} />
      </div>
    </CampaignDraftProvider>
  );
}
