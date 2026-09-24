import { redirect } from "next/navigation";

import { getCurrentSession, requireCommercialAccess } from "@/server/auth/access";

/**
 * La entrada según quién eres (SPEC-063 BR-012): el asesor empieza por lo que
 * le toca hoy; los demás roles, por Pedidos, como siempre. El login vuelve
 * aquí para que la decisión viva en un solo lugar.
 */
export default async function HomePage() {
  const session = await getCurrentSession();

  if (!session) redirect("/login");

  const { membership } = await requireCommercialAccess();

  redirect(membership.role === "AGENT" ? "/my-day" : "/orders");
}
