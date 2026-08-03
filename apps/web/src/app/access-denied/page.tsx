export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-5">
      <section className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-950">
          Acceso no autorizado
        </h1>

        <p className="mt-3 text-sm leading-6 text-neutral-600">
          Tu cuenta no tiene una organización activa o no posee permisos para
          acceder al Sistema Comercial.
        </p>
      </section>
    </main>
  );
}
