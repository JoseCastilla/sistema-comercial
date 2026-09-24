import { redirect } from "next/navigation";

import { database } from "@/server/database";

import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

/** Primera ejecución: crea la empresa y al dueño. Después deja de existir (AC-001). */
export default async function SetupPage() {
  if ((await database.organization.count()) > 0) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center bg-ui-subtle px-5 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-ui-border bg-ui-surface p-7 shadow-sm sm:p-9">
        <div className="mb-8 space-y-2">
          <p className="text-sm font-medium text-ui-muted">Primera vez</p>
          <h1 className="text-2xl font-semibold tracking-tight">Crea tu empresa y tu cuenta de dueño</h1>
          <p className="text-sm leading-6 text-ui-muted">No hay datos de ejemplo: todo lo que veas después nace de tu operación y de la conexión con Meta.</p>
        </div>
        <SetupForm />
      </section>
    </main>
  );
}
