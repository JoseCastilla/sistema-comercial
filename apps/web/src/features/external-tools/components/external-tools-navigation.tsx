import Link from "next/link";

export function ExternalToolsNavigation({
  activeTool,
}: {
  activeTool: "lines" | "portability";
}) {
  return (
    <nav
      aria-label="Herramientas de consulta"
      className="grid gap-2 rounded-2xl border border-ui-border bg-ui-surface p-2 shadow-sm sm:grid-cols-2"
    >
      <ToolLink
        active={activeTool === "lines"}
        description="Líneas asociadas a un documento"
        href="/tools/lines"
        label="Checa tus líneas"
      />
      <ToolLink
        active={activeTool === "portability"}
        description="Estado y operador de un número"
        href="/tools/portability"
        label="Consulta portabilidad"
      />
    </nav>
  );
}

function ToolLink({
  active,
  description,
  href,
  label,
}: {
  active: boolean;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`rounded-xl border px-4 py-3 transition ${
        active
          ? "border-ui-accent bg-ui-subtle text-ui-text"
          : "border-transparent text-ui-muted hover:border-ui-border hover:bg-ui-subtle hover:text-ui-text"
      }`}
      href={href}
    >
      <span className="block text-sm font-bold">{label}</span>
      <span className="mt-1 block text-xs leading-5">{description}</span>
    </Link>
  );
}
