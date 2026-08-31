import { ChecaTusLineasFrame } from "@/features/external-tools/components/checa-tus-lineas-frame";

import { PageHeader } from "@repo/ui/page-header";

export default function ChecaTusLineasPage() {
  return (
    <div className="ui-page-stack">
      <PageHeader
        eyebrow="Consulta externa"
        title="Checa tus líneas"
        description="Consulta el portal oficial sin abandonar el espacio de trabajo del sistema comercial."
      />
      <ChecaTusLineasFrame />
    </div>
  );
}
