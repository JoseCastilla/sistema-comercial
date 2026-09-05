import Link from "next/link";

export type CampaignSurface =
  "preparar" | "revisar" | "repartir" | "seguimiento" | "tablero";

const surfaces: ReadonlyArray<{
  key: CampaignSurface;
  label: string;
  href: string;
  /** Quién ve la pestaña. El asesor no entra aquí: su carril es la bandeja. */
  roles: ReadonlySet<string>;
}> = [
  {
    key: "preparar",
    label: "Preparar",
    href: "/admin/recovery-base",
    roles: new Set(["ADMIN", "BACKOFFICE"]),
  },
  {
    key: "revisar",
    label: "Revisar",
    href: "/recovery/triage",
    roles: new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]),
  },
  {
    key: "repartir",
    label: "Repartir",
    href: "/recovery/distribute",
    roles: new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]),
  },
  {
    key: "seguimiento",
    label: "Seguimiento",
    href: "/recovery/follow-up",
    roles: new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]),
  },
  {
    key: "tablero",
    label: "Tablero",
    href: "/recovery/board",
    roles: new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]),
  },
];

/**
 * El carril de Campañas, siempre en el mismo sitio — fase 4 del plan de
 * usabilidad (SPEC-030 BR-093).
 *
 * Preparar, revisar, repartir, seguir y medir son cinco pasos del mismo
 * trabajo, pero cada pantalla los enlazaba con botones distintos en sitios
 * distintos: «Tablero del día» aparecía en tres lugares y «Seguimiento» en
 * dos, y para volver a Preparar había que pasar por el menú. Una barra
 * idéntica bajo la cabecera de las cinco pantallas convierte el recorrido
 * en algo que se aprende una vez. Se muestran solo las superficies que el
 * rol puede abrir: una pestaña que lleva a «acceso denegado» es peor que
 * ninguna.
 */
export function CampaignNav({
  current,
  role,
}: {
  current: CampaignSurface;
  role: string;
}) {
  const visible = surfaces.filter((surface) => surface.roles.has(role));

  if (visible.length < 2) return null;

  return (
    <nav aria-label="Pasos de la campaña" className="ui-segmented-scroll">
      <div className="ui-segmented">
        {visible.map((surface) => (
          <Link
            aria-current={surface.key === current ? "page" : undefined}
            className="ui-segmented__item"
            href={surface.href}
            key={surface.key}
          >
            {surface.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
