import { EmptyState } from "@repo/ui/empty-state";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { formatDateTime } from "@/lib/time";
import { listArticles } from "@/server/ai/service";

import { retireArticleAction, saveArticleAction } from "../actions";
import { KnowledgeEditor } from "./knowledge-editor";

/**
 * Pestaña de conocimiento: artículos cortos con vigencia. Un artículo vencido
 * deja de usarse solo, sin publicar una versión nueva (SPEC-058 BR-003).
 */
export async function KnowledgeTab({ agentId, organizationId, timezone }: { agentId: string; organizationId: string; timezone: string }) {
  const articles = await listArticles(organizationId, agentId);

  return (
    <>
      <SectionPanel
        description="El asistente responde solo con lo que está aquí. Lo que no esté, lo confirma un asesor."
        title={`Artículos (${articles.filter((article) => article.inForce).length} vigentes de ${articles.length})`}
      >
        {articles.length === 0 ? (
          <EmptyState description="Empieza con los requisitos de portabilidad y las preguntas que más te hacen." title="Todavía no hay artículos" />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Artículo</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  <th>Quitar</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id}>
                    <td>
                      <div className="font-medium">{article.title}</div>
                      <div className="text-xs text-ui-muted">{article.content.slice(0, 180)}</div>
                    </td>
                    <td className="text-xs">
                      Desde {formatDateTime(article.validFrom, timezone)}
                      <div>{article.validUntil ? `hasta ${formatDateTime(article.validUntil, timezone)}` : "sin fecha de fin"}</div>
                    </td>
                    <td>
                      <StatusBadge tone={article.inForce ? "success" : "neutral"}>{article.inForce ? "Se usa" : "Ya no se usa"}</StatusBadge>
                    </td>
                    <td>
                      {article.inForce ? (
                        <ActionForm
                          action={retireArticleAction}
                          confirm="El asistente dejará de usar este artículo desde ahora. ¿Seguimos?"
                          submitLabel="Dejar de usar"
                          variant="quiet"
                        >
                          <input name="agentId" type="hidden" value={agentId} />
                          <input name="articleId" type="hidden" value={article.id} />
                        </ActionForm>
                      ) : (
                        <span className="text-xs text-ui-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

      <SectionPanel description="Un tema por artículo: así el asistente cita bien y tú sabes qué cambiar cuando algo deja de ser cierto." title="Nuevo artículo">
        <ActionForm action={saveArticleAction} submitLabel="Guardar artículo">
          <input name="agentId" type="hidden" value={agentId} />
          <KnowledgeEditor />
          <div className="ui-form-row">
            <label className="ui-field ui-form-row__fixed">
              <span className="ui-field__label">Empieza a usarse</span>
              <input className="ui-control" name="validFrom" type="date" />
              <span className="ui-field__hint">Vacío: desde hoy.</span>
            </label>
            <label className="ui-field ui-form-row__fixed">
              <span className="ui-field__label">Deja de usarse</span>
              <input className="ui-control" name="validUntil" type="date" />
              <span className="ui-field__hint">Vacío: sin fecha de fin.</span>
            </label>
          </div>
        </ActionForm>
      </SectionPanel>
    </>
  );
}
