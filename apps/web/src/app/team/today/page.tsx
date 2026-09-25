import { redirect } from "next/navigation";

import { TeamToday } from "@/features/team-today/components/team-today";
import { getTeamToday } from "@/features/team-today/server/get-team-today";
import { requireCommercialAccess } from "@/server/auth/access";

const todayFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Hoy en mi equipo — SPEC-069 fase 1. La entrada del supervisor: quién de su
 * equipo necesita que haga algo hoy, y qué.
 */
export default async function TeamTodayPage() {
  const { session, membership } = await requireCommercialAccess();

  if (membership.role === "ADMIN") redirect("/orders");
  if (membership.role !== "SUPERVISOR") redirect("/access-denied");

  const data = await getTeamToday(
    membership.organization.id,
    session.user.id,
  );
  const today = todayFormatter.format(data.generatedAt);

  return (
    <TeamToday
      data={data}
      dateLabel={today.charAt(0).toUpperCase() + today.slice(1)}
    />
  );
}
