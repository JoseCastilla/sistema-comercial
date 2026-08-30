import { ExternalToolsNavigation } from "@/features/external-tools/components/external-tools-navigation";
import { PortabilityFrame } from "@/features/external-tools/components/portability-frame";

import { PageHeader } from "@repo/ui/page-header";

export default function PortabilityPage() {
  return (
    <div className="ui-page-stack">
      <PageHeader
        eyebrow="Consultas externas"
        title="Consulta portabilidad"
        description="El asesor ingresa el número y realiza la consulta en el portal autorizado desde el sistema comercial."
      />
      <ExternalToolsNavigation activeTool="portability" />
      <PortabilityFrame />
    </div>
  );
}
