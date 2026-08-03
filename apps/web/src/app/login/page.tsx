import { redirect } from "next/navigation";

import { LoginForm } from "./login-form";

import { getCurrentSession } from "@/server/auth/access";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/orders");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-8 space-y-2">
          <p className="text-sm font-medium text-neutral-500">
            Distribuidor Online
          </p>

          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
            Sistema Comercial
          </h1>

          <p className="text-sm leading-6 text-neutral-600">
            Ingresa con la cuenta asignada por tu administrador.
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
