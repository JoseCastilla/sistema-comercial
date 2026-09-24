import Link from "next/link";

import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";

import type { ContactOrigin, CustomerRelation, OpportunityStage } from "@/generated/prisma/enums";
import { requireAccess } from "@/server/auth/access";
import { assignableMembers, listPipeline } from "@/server/opportunities/queries";
import { GROUP_LABELS, GROUP_ORIGINS, type ResultGroup } from "@/server/opportunities/results";
import { ALL_STAGES, OPEN_STAGES, ORIGIN_LABELS, RELATION_LABELS, STAGE_LABELS } from "@/server/opportunities/rules";

import { PipelineBoard } from "./board";

import "./pipeline.css";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function one(search: Search, key: string): string {
  const value = search[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Fecha «2026-09-01» a instante UTC del inicio de ese día en Lima. */
function dayStart(value: string, offsetDays = 0): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00-05:00`);
  if (Number.isNaN(date.getTime())) return null;
  return offsetDays ? new Date(date.getTime() + offsetDays * 86_400_000) : date;
}

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Search> }) {
  const access = await requireAccess();
  const search = await searchParams;

  const view = one(search, "vista") === "lista" ? "lista" : "tablero";
  const showClosed = one(search, "cerradas") === "1";
  const asesor = one(search, "asesor");
  const origen = one(search, "origen");
  const relacion = one(search, "relacion");
  const etapa = one(search, "etapa");
  const desde = one(search, "desde");
  const hasta = one(search, "hasta");

  const grupo = one(search, "grupo").toUpperCase();
  const groupOrigins = grupo in GROUP_ORIGINS ? GROUP_ORIGINS[grupo as ResultGroup] : null;
  const stageFilter = (ALL_STAGES as readonly string[]).includes(etapa) ? (etapa as OpportunityStage) : null;
  const cards = await listPipeline(access, {
    assignedUserId: asesor || null,
    origin: origen ? (origen as ContactOrigin) : null,
    origins: groupOrigins,
    relation: relacion ? (relacion as CustomerRelation) : null,
    stage: stageFilter,
    includeClosed: showClosed || Boolean(stageFilter),
    reachedQualified: one(search, "alcanzo") === "CALIFICADO",
    openedFrom: dayStart(desde),
    openedTo: dayStart(hasta, 1),
  });

  const members = access.role === "AGENT" ? [] : await assignableMembers(access.organizationId);
  const columns: OpportunityStage[] = stageFilter ? [stageFilter] : showClosed ? [...ALL_STAGES] : [...OPEN_STAGES];
  const reached = one(search, "alcanzo") === "CALIFICADO";
  const filtered = Boolean(asesor || origen || relacion || stageFilter || desde || hasta || reached || groupOrigins);

  return (
    <div className="ui-page-stack">
      <PageHeader
        description={
          access.role === "AGENT"
            ? "Tus oportunidades, una por cliente. Arrastra la tarjeta cuando el trato avance."
            : "Una oportunidad abierta por cliente. Arrastra la tarjeta cuando el trato avance; la venta se gana sola al vincular el pedido."
        }
        eyebrow="CRM"
        meta={<Link className="ui-button ui-button--quiet" href="/reports">Ver resultados</Link>}
        title="Embudo"
      />

      <form action="/pipeline" className="ui-surface ui-surface--padded pipeline-toolbar" method="get">
        {members.length > 0 ? (
          <label className="ui-field">
            <span className="ui-field__label">Responsable</span>
            <select className="ui-control ui-control--select" defaultValue={asesor} name="asesor">
              <option value="">Todos</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="ui-field">
          <span className="ui-field__label">Origen</span>
          <select className="ui-control ui-control--select" defaultValue={origen} name="origen">
            <option value="">Todos</option>
            {(Object.keys(ORIGIN_LABELS) as ContactOrigin[]).map((origin) => (
              <option key={origin} value={origin}>
                {ORIGIN_LABELS[origin]}
              </option>
            ))}
          </select>
        </label>
        <label className="ui-field">
          <span className="ui-field__label">Relación</span>
          <select className="ui-control ui-control--select" defaultValue={relacion} name="relacion">
            <option value="">Todas</option>
            {(Object.keys(RELATION_LABELS) as CustomerRelation[]).map((relation) => (
              <option key={relation} value={relation}>
                {RELATION_LABELS[relation]}
              </option>
            ))}
          </select>
        </label>
        <label className="ui-field">
          <span className="ui-field__label">Vista</span>
          <select className="ui-control ui-control--select" defaultValue={view} name="vista">
            <option value="tablero">Tablero</option>
            <option value="lista">Lista</option>
          </select>
        </label>
        {stageFilter ? <input name="etapa" type="hidden" value={stageFilter} /> : null}
        {reached ? <input name="alcanzo" type="hidden" value="CALIFICADO" /> : null}
        {groupOrigins ? <input name="grupo" type="hidden" value={grupo} /> : null}
        {desde ? <input name="desde" type="hidden" value={desde} /> : null}
        {hasta ? <input name="hasta" type="hidden" value={hasta} /> : null}
        <label className="ui-field">
          <span className="ui-field__label">Mostrar cerradas</span>
          <span className="pipeline-list__move">
            <input defaultChecked={showClosed} name="cerradas" type="checkbox" value="1" />
            <span>Ganadas y perdidas</span>
          </span>
        </label>
        <div className="pipeline-toolbar__grow" />
        <button className="ui-button ui-button--secondary" type="submit">
          Aplicar
        </button>
        {filtered ? (
          <Link className="ui-button ui-button--quiet" href="/pipeline">
            Quitar filtros
          </Link>
        ) : null}
      </form>

      {cards.length === 0 && !filtered ? (
        <EmptyState
          description="Se abre sola cuando alguien escribe por WhatsApp y no tiene un pedido en curso. Conecta el número y responde el primer mensaje."
          title="Todavía no hay oportunidades"
        />
      ) : (
        <>
          {stageFilter || reached || groupOrigins ? (
            <p className="ui-feedback" data-tone="info">
              {stageFilter ? `Viendo solo la etapa ${STAGE_LABELS[stageFilter]}. ` : ""}
              {reached ? "Viendo las que llegaron a Calificado o más, estén donde estén hoy. " : ""}
              {groupOrigins ? `Viendo solo el grupo ${GROUP_LABELS[grupo as ResultGroup]}. ` : ""}
              <Link href="/pipeline">Ver todo el embudo</Link>
            </p>
          ) : null}
          <PipelineBoard canMove={access.role !== "BACKOFFICE"} cards={cards} columns={columns} timezone={access.timezone} view={view} />
        </>
      )}
    </div>
  );
}
