"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { ThemeControl } from "@repo/ui/theme-control";

import { EscalationNotification } from "./escalation-notification";

type ActiveSection =
  | "performance"
  | "orders"
  | "dni"
  | "tools"
  | "sales-recovery"
  | "recovery"
  | "imports"
  | "logistics"
  | "people"
  | "teams";
type IconName =
  | "home"
  | "orders"
  | "identity"
  | "tools"
  | "recovery"
  | "sales"
  | "logistics"
  | "people"
  | "teams";

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
    identity: (
      <>
        <rect height="13" rx="1.5" width="16" x="2" y="3.5" />
        <circle cx="7" cy="9" r="2" />
        <path d="M4.5 14c.4-1.8 1.2-2.7 2.5-2.7s2.1.9 2.5 2.7M12 8h3M12 11h3" />
      </>
    ),
    tools: (
      <>
        <circle cx="6" cy="7" r="2.5" />
        <circle cx="14" cy="13" r="2.5" />
        <path d="M8.5 7h6M5.5 9.5V14h6" />
      </>
    ),
    sales: (
      <>
        <path d="M4 16V9m6 7V4m6 12v-6" />
      </>
    ),
    logistics: (
      <>
        <path d="M3 6h9v8H3zM12 9h3l2 2v3h-5z" />
        <circle cx="6" cy="15.5" r="1.5" />
        <circle cx="14.5" cy="15.5" r="1.5" />
      </>
    ),
    recovery: (
      <>
        <path d="M15.5 8.5A6 6 0 1 0 16 11" />
        <path d="M16 5v4h-4" />
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
      title={label}
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
  const canTriageRecovery =
    role === "ADMIN" || role === "BACKOFFICE" || role === "SUPERVISOR";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(role === "AGENT");

  useEffect(() => {
    const storedPreference = window.localStorage.getItem(
      "commercial-sidebar-collapsed",
    );
    if (storedPreference !== null) {
      setSidebarCollapsed(storedPreference === "true");
    }
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("commercial-sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <div
      className="app-shell"
      data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
    >
      <EscalationNotification role={role} />
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <div className="app-shell__mark">DO</div>
          <div className="app-shell__brand-copy min-w-0">
            <p className="app-shell__brand-name">Distribuidor Online</p>
            <p className="app-shell__brand-product">Sistema Comercial</p>
          </div>
          <button
            aria-label={sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
            aria-pressed={sidebarCollapsed}
            className="app-shell__collapse"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
            type="button"
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
              <path
                d="m12 6-4 4 4 4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
              />
            </svg>
          </button>
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
            active={activeSection === "dni"}
            description="Identidad y dirección RENIEC"
            href="/dni"
            icon="identity"
            label="Consulta DNI"
          />
          <NavigationItem
            active={activeSection === "tools"}
            description="Líneas y portabilidad"
            href="/tools/lines"
            icon="tools"
            label="Consultas externas"
          />
          <NavigationItem
            active={activeSection === "sales-recovery"}
            description="Ventas caídas por salvar"
            href="/recovery/sales"
            icon="recovery"
            label="Recupero de ventas"
          />
          {canTriageRecovery ? (
            <NavigationItem
              active={activeSection === "recovery"}
              description="Campañas sobre base fría"
              href={isAdmin ? "/admin/recovery-base" : "/recovery/triage"}
              icon="recovery"
              label="Base nacional"
            />
          ) : null}
          {isAdmin ? (
            <>
              <NavigationItem
                active={activeSection === "imports"}
                description="Carga y revisión DITO"
                href="/admin/dito-imports"
                icon="sales"
                label="Ventas"
              />
              <NavigationItem
                active={activeSection === "logistics"}
                description="Estados Máximo y recuperación"
                href="/admin/logistics"
                icon="logistics"
                label="Logística"
              />
              <NavigationItem
                active={activeSection === "people"}
                description="Usuarios, roles y vínculos DITO"
                href="/admin/users"
                icon="people"
                label="Personas"
              />
              <NavigationItem
                active={activeSection === "teams"}
                description="Supervisores y asesores"
                href="/admin/teams"
                icon="teams"
                label="Equipos"
              />
            </>
          ) : null}
        </nav>
        <div className="app-shell__account">
          <div className="app-shell__account-card">
            <div className="app-shell__avatar">
              {userName.slice(0, 1).toUpperCase()}
            </div>
            <div className="app-shell__account-copy min-w-0">
              <p className="app-shell__user-name">{userName}</p>
              <p className="app-shell__user-role">{roleLabel}</p>
            </div>
            <div className="app-shell__theme">
              <ThemeControl compact={sidebarCollapsed} />
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
          <div className="app-shell__mobile-actions">
            <ThemeControl compact />
            {signOut}
          </div>
        </header>
        <main className="app-shell__main">{children}</main>
      </div>
      <nav
        aria-label="Navegación móvil"
        className="app-shell__mobile-nav"
        data-items={isAdmin ? "9" : canTriageRecovery ? "5" : "4"}
      >
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
          active={activeSection === "dni"}
          href="/dni"
          icon="identity"
          label="DNI"
        />
        <MobileNavigationItem
          active={activeSection === "tools"}
          href="/tools/lines"
          icon="tools"
          label="Consultas"
        />
        <MobileNavigationItem
          active={activeSection === "sales-recovery"}
          href="/recovery/sales"
          icon="recovery"
          label="Recupero"
        />
        {canTriageRecovery ? (
          <MobileNavigationItem
            active={activeSection === "recovery"}
            href={isAdmin ? "/admin/recovery-base" : "/recovery/triage"}
            icon="recovery"
            label="Base"
          />
        ) : null}
        {isAdmin ? (
          <>
            <MobileNavigationItem
              active={activeSection === "imports"}
              href="/admin/dito-imports"
              icon="sales"
              label="Ventas"
            />
            <MobileNavigationItem
              active={activeSection === "logistics"}
              href="/admin/logistics"
              icon="logistics"
              label="Logística"
            />
            <MobileNavigationItem
              active={activeSection === "people"}
              href="/admin/users"
              icon="people"
              label="Personas"
            />
            <MobileNavigationItem
              active={activeSection === "teams"}
              href="/admin/teams"
              icon="teams"
              label="Equipos"
            />
          </>
        ) : null}
      </nav>
    </div>
  );
}
