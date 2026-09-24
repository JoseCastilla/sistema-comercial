import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";

import { requireManager } from "@/server/auth/access";
import { AgentServiceError, getAgentDetail } from "@/server/ai/service";

import { ConfigTab } from "./config-tab";
import { ExamplesTab } from "./examples-tab";
import { KnowledgeTab } from "./knowledge-tab";
import { MetricsTab } from "./metrics-tab";
import { SimulatorTab } from "./simulator-tab";
import { TestsTab } from "./tests-tab";
import { ToolsTab } from "./tools-tab";
import { VersionsTab } from "./versions-tab";

export const dynamic = "force-dynamic";

const TABS = [
  ["configuracion", "Configuración"],
  ["conocimiento", "Conocimiento"],
  ["ejemplos", "Ejemplos"],
  ["herramientas", "Herramientas"],
  ["pruebas", "Pruebas"],
  ["simulador", "Simulador"],
  ["versiones", "Versiones"],
  ["metricas", "Métricas"],
] as const;

type TabKey = (typeof TABS)[number][0];

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  PUBLISHED: { label: "Responde", tone: "success" },
  PAUSED: { label: "Pausado", tone: "warning" },
  DRAFT: { label: "Sin publicar", tone: "neutral" },
};

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const access = await requireManager();
  const { id } = await params;
  const { tab } = await searchParams;
  const current: TabKey = (TABS.find(([key]) => key === tab)?.[0] ?? "configuracion") as TabKey;

  let agent;
  try {
    agent = await getAgentDetail(access.organizationId, id);
  } catch (error) {
    if (error instanceof AgentServiceError) notFound();
    throw error;
  }
  const status = STATUS[agent.status] ?? STATUS.DRAFT!;

  return (
    <>
      <PageHeader
        description={
          agent.publishedVersionNumber
            ? `Responde la versión ${agent.publishedVersionNumber}. Lo que edites aquí queda en borrador hasta que publiques.`
            : "Todavía no hay una versión publicada: el asistente no le contesta a nadie."
        }
        eyebrow="Agente de IA"
        meta={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
        title={agent.name}
      />

      <nav aria-label="Secciones del agente" className="ui-segmented-scroll">
        <div className="ui-segmented">
          {TABS.map(([key, label]) => (
            <Link aria-current={key === current ? "page" : undefined} className="ui-segmented__item" href={`/agents/${agent.id}?tab=${key}`} key={key}>
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {current === "configuracion" ? <ConfigTab agent={agent} /> : null}
      {current === "conocimiento" ? <KnowledgeTab agentId={agent.id} organizationId={access.organizationId} timezone={access.timezone} /> : null}
      {current === "ejemplos" ? <ExamplesTab agentId={agent.id} organizationId={access.organizationId} timezone={access.timezone} /> : null}
      {current === "herramientas" ? <ToolsTab agent={agent} /> : null}
      {current === "pruebas" ? <TestsTab agent={agent} organizationId={access.organizationId} timezone={access.timezone} /> : null}
      {current === "simulador" ? <SimulatorTab agent={agent} /> : null}
      {current === "versiones" ? <VersionsTab agent={agent} organizationId={access.organizationId} role={access.role} timezone={access.timezone} /> : null}
      {current === "metricas" ? <MetricsTab agent={agent} organizationId={access.organizationId} timezone={access.timezone} /> : null}
    </>
  );
}
