"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ThemeControl } from "@repo/ui/theme-control";

import { PresencePing } from "./presence-ping";

export type Section =
  | "inbox"
  | "pipeline"
  | "calendar"
  | "orders"
  | "broadcasts"
  | "templates"
  | "agents"
  | "workflows"
  | "reports"
  | "settings";

const SECTION_BY_PREFIX: readonly (readonly [string, Section])[] = [
  ["/inbox", "inbox"],
  ["/pipeline", "pipeline"],
  ["/calendar", "calendar"],
  ["/orders", "orders"],
  ["/broadcasts", "broadcasts"],
  ["/templates", "templates"],
  ["/agents", "agents"],
  ["/workflows", "workflows"],
  ["/reports", "reports"],
  ["/settings", "settings"],
];

export function sectionForPath(pathname: string): Section {
  const match = SECTION_BY_PREFIX.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ? match[1] : "inbox";
}

const roleLabels: Record<string, string> = {
  OWNER: "Dueño del negocio",
  SUPERVISOR: "Supervisor",
  AGENT: "Asesor",
  BACKOFFICE: "Back office",
};

interface NavEntry {
  section: Section;
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: ReactNode;
  roles?: string[];
}

const icon = (paths: ReactNode) => (
  <span aria-hidden="true" className="app-nav-item__icon">
    <svg viewBox="0 0 20 20">{paths}</svg>
  </span>
);

const NAV: NavEntry[] = [
  { section: "inbox", href: "/inbox", label: "Conversaciones", shortLabel: "Chats", description: "Atiende a tus leads", icon: icon(<><path d="M3 4h14v9H8l-4 3v-3H3z" /></>) },
  { section: "pipeline", href: "/pipeline", label: "Embudo", shortLabel: "Embudo", description: "Oportunidades por etapa", icon: icon(<><path d="M3 4h14l-5 6v5l-4 2v-7z" /></>) },
  { section: "calendar", href: "/calendar", label: "Calendario", shortLabel: "Agenda", description: "Citas y cupos", icon: icon(<><rect height="13" rx="1.5" width="14" x="3" y="4" /><path d="M3 8h14M7 2v4M13 2v4" /></>) },
  { section: "orders", href: "/orders", label: "Pedidos", shortLabel: "Pedidos", description: "Vincula ventas al chat", icon: icon(<><path d="M5 3h10v14H5z" /><path d="M8 7h4M8 11h5" /></>) },
  { section: "broadcasts", href: "/broadcasts", label: "Difusiones", shortLabel: "Difusión", description: "Plantillas a segmentos", icon: icon(<><path d="M3 8v4h3l6 4V4L6 8z" /><path d="M15 7a4 4 0 0 1 0 6" /></>), roles: ["OWNER", "SUPERVISOR"] },
  { section: "templates", href: "/templates", label: "Plantillas", shortLabel: "Plantillas", description: "Mensajes aprobados por Meta", icon: icon(<><rect height="14" rx="1.5" width="12" x="4" y="3" /><path d="M7 7h6M7 10h6M7 13h3" /></>), roles: ["OWNER", "SUPERVISOR"] },
  { section: "agents", href: "/agents", label: "Agentes de IA", shortLabel: "Agentes", description: "Entrena al asistente", icon: icon(<><circle cx="10" cy="7" r="3" /><path d="M4 17c.5-3 2.7-4.5 6-4.5s5.5 1.5 6 4.5M10 2v2" /></>), roles: ["OWNER", "SUPERVISOR"] },
  { section: "workflows", href: "/workflows", label: "Flujos", shortLabel: "Flujos", description: "Automatiza la operación", icon: icon(<><circle cx="5" cy="5" r="2" /><circle cx="15" cy="10" r="2" /><circle cx="5" cy="15" r="2" /><path d="M7 5h4l2 5-2 5H7" /></>), roles: ["OWNER", "SUPERVISOR"] },
  { section: "reports", href: "/reports", label: "Resultados", shortLabel: "Resultados", description: "Campaña vs base", icon: icon(<><path d="M4 16V9m6 7V4m6 12v-6" /></>), roles: ["OWNER", "SUPERVISOR", "BACKOFFICE"] },
  { section: "settings", href: "/settings", label: "Ajustes", shortLabel: "Ajustes", description: "WhatsApp, usuarios, catálogo", icon: icon(<><circle cx="10" cy="10" r="2.5" /><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.5 1.5M13.5 13.5 15 15M5 15l1.5-1.5M13.5 6.5 15 5" /></>), roles: ["OWNER", "SUPERVISOR"] },
];

export function AppShell({
  organizationName,
  userName,
  role,
  signOut,
  children,
}: {
  organizationName: string;
  userName: string;
  role: string;
  signOut: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current = sectionForPath(pathname);
  const [collapsed, setCollapsed] = useState(role === "AGENT");
  const entries = NAV.filter((entry) => !entry.roles || entry.roles.includes(role));

  useEffect(() => {
    const stored = window.localStorage.getItem("crm-sidebar-collapsed");
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  function toggle() {
    setCollapsed((value) => {
      window.localStorage.setItem("crm-sidebar-collapsed", String(!value));
      return !value;
    });
  }

  const mobileEntries = entries.slice(0, 5);

  return (
    <div className="app-shell" data-sidebar-collapsed={collapsed ? "true" : "false"}>
      <PresencePing />
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <div className="app-shell__mark">{organizationName.slice(0, 2).toUpperCase()}</div>
          <div className="app-shell__brand-copy min-w-0">
            <p className="app-shell__brand-name">{organizationName}</p>
            <p className="app-shell__brand-product">CRM</p>
          </div>
          <button aria-label={collapsed ? "Expandir menú" : "Contraer menú"} aria-pressed={collapsed} className="app-shell__collapse" onClick={toggle} type="button">
            <svg aria-hidden="true" fill="none" viewBox="0 0 20 20"><path d="m12 6-4 4 4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" /></svg>
          </button>
        </div>
        <nav aria-label="Navegación principal" className="app-shell__nav">
          {entries.map((entry) => (
            <Link key={entry.section} aria-current={current === entry.section ? "page" : undefined} className="app-nav-item" href={entry.href} title={entry.label}>
              {entry.icon}
              <span>
                <span className="app-nav-item__label">{entry.label}</span>
                <span className="app-nav-item__description">{entry.description}</span>
              </span>
            </Link>
          ))}
        </nav>
        <div className="app-shell__account">
          <div className="app-shell__account-card">
            <div className="app-shell__avatar">{userName.slice(0, 1).toUpperCase()}</div>
            <div className="app-shell__account-copy min-w-0">
              <p className="app-shell__user-name">{userName}</p>
              <p className="app-shell__user-role">{roleLabels[role] ?? role}</p>
            </div>
            <div className="app-shell__theme"><ThemeControl compact={collapsed} /></div>
            <div className="app-shell__sign-out">{signOut}</div>
          </div>
        </div>
      </aside>
      <div className="app-shell__content">
        <header className="app-shell__mobile-header">
          <div className="app-shell__mobile-brand">
            <div className="app-shell__mark">{organizationName.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0">
              <p className="app-shell__brand-name">CRM</p>
              <p className="app-shell__brand-product">{organizationName}</p>
            </div>
          </div>
          <div className="app-shell__mobile-actions"><ThemeControl compact />{signOut}</div>
        </header>
        <main className="app-shell__main">{children}</main>
      </div>
      <nav aria-label="Navegación móvil" className="app-shell__mobile-nav" data-items={String(mobileEntries.length)}>
        {mobileEntries.map((entry) => (
          <Link key={entry.section} aria-current={current === entry.section ? "page" : undefined} className="app-mobile-nav-item" href={entry.href}>
            {entry.icon}
            <span>{entry.shortLabel}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
