import Link from "next/link";
import type { ReactNode } from "react";

type ActiveSection = "performance" | "orders" | "imports" | "people" | "teams";
type IconName = "home" | "orders" | "sales" | "people" | "teams";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  BACKOFFICE: "Back office",
  AGENT: "Asesor",
};

function NavigationIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: (
      <>
        <path d="m3 10 7-6 7 6" />
        <path d="M5 9v8h10V9" />
      </>
    ),
    orders: (
      <>
        <path d="M5 3h10v14H5z" />
        <path d="M8 7h4M8 11h5M8 14h3" />
      </>
    ),
    sales: (
      <>
        <path d="M4 16V9m6 7V4m6 12v-6" />
      </>
    ),
    people: (
      <>
        <circle cx="7" cy="7" r="3" />
        <path d="M2.5 17c.4-3 2-4.5 4.5-4.5S11.1 14 11.5 17" />
        <circle cx="14.5" cy="8" r="2.5" />
        <path d="M13 13c2.7-.3 4.2 1 4.5 4" />
      </>
    ),
    teams: (
      <>
        <circle cx="10" cy="6" r="2.5" />
        <circle cx="4.5" cy="10" r="2" />
        <circle cx="15.5" cy="10" r="2" />
        <path d="M5.5 17c.5-3 2-4.5 4.5-4.5s4 1.5 4.5 4M1.5 17c.2-2 1.2-3.2 3-3.5M18.5 17c-.2-2-1.2-3.2-3-3.5" />
      </>
    ),
  };
  return (
    <span aria-hidden="true" className="app-nav-item__icon">
      <svg viewBox="0 0 20 20">{paths[name]}</svg>
    </span>
  );
}

function NavigationItem({
  label,
  description,
  icon,
  active = false,
  href,
}: {
  label: string;
  description: string;
  icon: IconName;
  active?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <NavigationIcon name={icon} />
      <span>
        <span className="app-nav-item__label">{label}</span>
        <span className="app-nav-item__description">{description}</span>
      </span>
    </>
  );
  return href ? (
    <Link
      aria-current={active ? "page" : undefined}
      className="app-nav-item"
      href={href}
    >
      {content}
    </Link>
  ) : (
    <div aria-disabled="true" className="app-nav-item">
      {content}
    </div>
  );
}

function MobileNavigationItem({
  label,
  icon,
  active = false,
  href,
}: {
  label: string;
  icon: IconName;
  active?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <NavigationIcon name={icon} />
      <span>{label}</span>
    </>
  );
  return href ? (
    <Link
      aria-current={active ? "page" : undefined}
      className="app-mobile-nav-item"
      href={href}
    >
      {content}
    </Link>
  ) : (
    <div aria-disabled="true" className="app-mobile-nav-item">
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
  activeSection?: ActiveSection;
}) {
  const roleLabel = roleLabels[role] ?? role;
  const isAdmin = role === "ADMIN";
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <div className="app-shell__mark">DO</div>
          <div className="min-w-0">
            <p className="app-shell__brand-name">Distribuidor Online</p>
            <p className="app-shell__brand-product">Sistema Comercial</p>
          </div>
        </div>
        <div className="app-shell__organization">
          <p className="app-shell__overline">Organización</p>
          <p className="app-shell__organization-name">{organizationName}</p>
        </div>
        <nav className="app-shell__nav" aria-label="Navegación principal">
          <NavigationItem
            active={activeSection === "performance"}
            description="Resultados y oportunidades"
            href="/performance"
            icon="home"
            label="Rendimiento"
          />
          <NavigationItem
            active={activeSection === "orders"}
            description="Seguimiento operativo"
            href="/orders"
            icon="orders"
            label="Pedidos"
          />
          <NavigationItem
            active={activeSection === "imports"}
            description="Carga y revisión DITO"
            href={isAdmin ? "/admin/dito-imports" : undefined}
            icon="sales"
            label="Ventas"
          />
          <NavigationItem
            active={activeSection === "people"}
            description="Usuarios, roles y vínculos DITO"
            href={isAdmin ? "/admin/users" : undefined}
            icon="people"
            label="Personas"
          />
          <NavigationItem
            active={activeSection === "teams"}
            description="Supervisores y asesores"
            href={isAdmin ? "/admin/teams" : undefined}
            icon="teams"
            label="Equipos"
          />
        </nav>
        <div className="app-shell__account">
          <div className="app-shell__account-card">
            <div className="app-shell__avatar">
              {userName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="app-shell__user-name">{userName}</p>
              <p className="app-shell__user-role">{roleLabel}</p>
            </div>
            <div className="app-shell__sign-out">{signOut}</div>
          </div>
        </div>
      </aside>
      <div className="app-shell__content">
        <header className="app-shell__mobile-header">
          <div className="app-shell__mobile-brand">
            <div className="app-shell__mark">DO</div>
            <div className="min-w-0">
              <p className="app-shell__brand-name">Sistema Comercial</p>
              <p className="app-shell__brand-product">{organizationName}</p>
            </div>
          </div>
          {signOut}
        </header>
        <main className="app-shell__main">{children}</main>
      </div>
      <nav className="app-shell__mobile-nav" aria-label="Navegación móvil">
        <MobileNavigationItem
          active={activeSection === "performance"}
          href="/performance"
          icon="home"
          label="Rendimiento"
        />
        <MobileNavigationItem
          active={activeSection === "orders"}
          href="/orders"
          icon="orders"
          label="Pedidos"
        />
        <MobileNavigationItem
          active={activeSection === "imports"}
          href={isAdmin ? "/admin/dito-imports" : undefined}
          icon="sales"
          label="Ventas"
        />
        <MobileNavigationItem
          active={activeSection === "people"}
          href={isAdmin ? "/admin/users" : undefined}
          icon="people"
          label="Personas"
        />
        <MobileNavigationItem
          active={activeSection === "teams"}
          href={isAdmin ? "/admin/teams" : undefined}
          icon="teams"
          label="Equipos"
        />
      </nav>
    </div>
  );
}
