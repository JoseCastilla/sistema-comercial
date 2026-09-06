import { ChecaTusLineasFrame } from "@/features/external-tools/components/checa-tus-lineas-frame";

import { PageHeader } from "@repo/ui/page-header";

export default function ChecaTusLineasPage() {
  return (
    <div className="ui-page-stack">
      <PageHeader
        eyebrow="Consulta externa"
        title="Checa tus líneas"
        description="Consulta el portal de OSIPTEL sin salir del sistema. Lo que veas aquí no queda guardado ni auditado, a diferencia de la consulta por DNI: si necesitas dejar constancia, anótalo en el pedido o en el caso."
      />
      <ChecaTusLineasFrame />
    </div>
  );
}
