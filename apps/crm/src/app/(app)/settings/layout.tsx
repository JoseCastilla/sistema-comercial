import Link from "next/link";
import type { ReactNode } from "react";

import { requireManager } from "@/server/auth/access";

const TABS = [
  ["/settings", "Empresa"],
  ["/settings/users", "Usuarios"],
  ["/settings/whatsapp", "WhatsApp"],
  ["/settings/catalog", "Catálogo de planes"],
  ["/settings/booking", "Cupos de citas"],
  ["/settings/quick-replies", "Respuestas rápidas"],
] as const;

export default async function SettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireManager();
  return (
    <div className="ui-page-stack">
      <nav aria-label="Ajustes" className="ui-segmented-scroll">
        <div className="ui-segmented">
          {TABS.map(([href, label]) => (
            <Link key={href} className="ui-segmented__item" href={href}>{label}</Link>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
