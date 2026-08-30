import { ExternalToolsNavigation } from "@/features/external-tools/components/external-tools-navigation";
import { PortabilityFrame } from "@/features/external-tools/components/portability-frame";

import { PageHeader } from "@repo/ui/page-header";

export default function PortabilityPage() {
  return (
    <div className="ui-page-stack">
      <PageHeader
        eyebrow="Consultas externas"
        title="Consulta portabilidad"
        description="Accede al portal oficial para consultar el estado y operador de un número."
      />
      <ExternalToolsNavigation activeTool="portability" />
      <PortabilityFrame />
    </div>
  );
}
