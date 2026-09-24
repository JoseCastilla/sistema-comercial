import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ui-subtle px-5">
      <section className="max-w-md rounded-2xl border border-ui-border bg-ui-surface p-8 text-center">
        <h1 className="text-xl font-semibold">No tienes acceso a esta parte</h1>
        <p className="mt-2 text-sm text-ui-muted">Tu cuenta no pertenece a una empresa activa o tu rol no permite esta acción. Pide al dueño del negocio que revise tu acceso.</p>
        <Link className="ui-button ui-button--secondary mt-6" href="/login">Volver a ingresar</Link>
      </section>
    </main>
  );
}
