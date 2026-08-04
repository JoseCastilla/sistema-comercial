import Link from "next/link";

import type { ReactNode } from "react";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  BACKOFFICE: "Back office",
  AGENT: "Asesor",
};

function NavigationItem({
  label,
  description,
  active = false,
  href,
}: {
  label: string;
  description: string;
  active?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <span
        className={[
          "grid size-10 shrink-0 place-items-center rounded-xl text-sm font-semibold",
          active
            ? "bg-neutral-950 text-white"
            : "bg-neutral-100 text-neutral-600",
        ].join(" ")}
      >
        {label.slice(0, 1)}
      </span>

      <span className="min-w-0">
        <span
          className={[
            "block text-sm font-medium",
            active ? "text-neutral-950" : "text-neutral-700",
          ].join(" ")}
        >
          {label}
        </span>

        <span className="mt-0.5 block truncate text-xs text-neutral-500">
          {description}
        </span>
      </span>

      {!href ? (
        <span className="ml-auto rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
          Próximamente
        </span>
      ) : null}
    </>
  );

  const classes = [
    "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition",
    active
      ? "bg-neutral-100"
      : href
        ? "hover:bg-neutral-50"
        : "cursor-not-allowed opacity-65",
  ].join(" ");

  if (href) {
    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={classes}
        href={href}
      >
        {content}
      </Link>
    );
  }

  return (
    <div aria-disabled="true" className={classes}>
      {content}
    </div>
  );
}

function MobileNavigationItem({
  label,
  active = false,
  href,
}: {
  label: string;
  active?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <span
        className={[
          "grid size-8 place-items-center rounded-xl text-xs font-semibold",
          active
            ? "bg-neutral-950 text-white"
            : "bg-neutral-100 text-neutral-500",
        ].join(" ")}
      >
        {label.slice(0, 1)}
      </span>

      <span
        className={[
          "text-[11px] font-medium",
          active ? "text-neutral-950" : "text-neutral-500",
        ].join(" ")}
      >
        {label}
      </span>
    </>
  );

  const classes =
    "flex min-w-16 flex-1 flex-col items-center justify-center gap-1 py-2";

  if (href) {
    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={classes}
        href={href}
      >
        {content}
      </Link>
    );
  }

  return (
    <div aria-disabled="true" className={`${classes} opacity-55`}>
      {content}
    </div>
  );
}

export function CommercialAppShell({
  organizationName,
  userName,
  role,
  signOut,
  children,
  activeSection = "orders",
}: {
  organizationName: string;
  userName: string;
  role: string;
  signOut: ReactNode;
  children: ReactNode;
  activeSection?: "orders" | "team";
}) {
  const roleLabel = roleLabels[role] ?? role;

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="border-b border-neutral-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-neutral-950 text-sm font-bold text-white shadow-sm">
              DO
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-950">
                Distribuidor Online
              </p>

              <p className="truncate text-xs text-neutral-500">
                Sistema Comercial
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-400">
            Organización
          </p>

          <p className="mt-2 truncate text-sm font-semibold text-neutral-900">
            {organizationName}
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-5">
          <NavigationItem description="Resumen del negocio" label="Inicio" />

          <NavigationItem
            active={activeSection === "orders"}
            description="Seguimiento operativo"
            href="/orders"
            label="Pedidos"
          />

          <NavigationItem
            description="Clientes y atribución"
            label="Contactos"
          />

          <NavigationItem
            description="Solicitudes y servicios"
            label="Ventas"
          />

          <NavigationItem
            active={activeSection === "team"}
            description="Asesores y permisos"
            href={role === "ADMIN" ? "/admin/users" : undefined}
            label="Equipo"
          />
        </nav>

        <div className="border-t border-neutral-200 p-4">
          <div className="rounded-2xl bg-neutral-50 p-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-neutral-700 shadow-sm">
                {userName.slice(0, 1).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {userName}
                </p>

                <p className="truncate text-xs text-neutral-500">{roleLabel}</p>
              </div>
            </div>

            <div className="mt-3">{signOut}</div>
          </div>
        </div>
      </aside>

      <div className="min-h-dvh lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur lg:hidden">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-neutral-950 text-xs font-bold text-white">
                DO
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-950">
                  Sistema Comercial
                </p>

                <p className="truncate text-xs text-neutral-500">
                  {organizationName}
                </p>
              </div>
            </div>

            <div className="shrink-0">{signOut}</div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-neutral-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.05)] backdrop-blur lg:hidden">
        <MobileNavigationItem label="Inicio" />

        <MobileNavigationItem
          active={activeSection === "orders"}
          href="/orders"
          label="Pedidos"
        />

        <MobileNavigationItem label="Ventas" />

        <MobileNavigationItem
          active={activeSection === "team"}
          href={role === "ADMIN" ? "/admin/users" : undefined}
          label="Equipo"
        />
      </nav>
    </div>
  );
}
