import { redirect } from "next/navigation";

import { database } from "@/server/database";
import { getCurrentSession } from "@/server/auth/access";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const organizations = await database.organization.count();
  if (organizations === 0) redirect("/setup");
  const session = await getCurrentSession();
  redirect(session ? "/inbox" : "/login");
}
