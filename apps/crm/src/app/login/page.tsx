import { redirect } from "next/navigation";

import { database } from "@/server/database";
import { getCurrentSession } from "@/server/auth/access";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if ((await database.organization.count()) === 0) redirect("/setup");
  const session = await getCurrentSession();
  if (session) redirect("/inbox");
  return (
    <main className="flex min-h-screen items-center justify-center bg-ui-subtle px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-ui-border bg-ui-surface p-7 shadow-sm sm:p-9">
        <div className="mb-8 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ui-text">CRM</h1>
          <p className="text-sm leading-6 text-ui-muted">Ingresa con la cuenta que te asignaron.</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
