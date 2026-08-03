import { redirect } from "next/navigation";

import { getCurrentSession } from "@/server/auth/access";

export default async function HomePage() {
  const session = await getCurrentSession();

  redirect(session ? "/orders" : "/login");
}
