import { EmptyState } from "@repo/ui/empty-state";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { formatDateTime } from "@/lib/time";
import { listExamples } from "@/server/ai/service";

import { addExampleAction, deleteExampleAction } from "../actions";

/**
 * Pestaña de ejemplos: tramos reales marcados como «así sí» o «así no»
 * (SPEC-058 BR-005). Los datos personales se reemplazan por marcadores antes
 * de guardarse.
 *
 * La bandeja todavía no tiene el botón «guardar como ejemplo» que llama a
 * `addExampleAction`: mientras tanto, el tramo se agrega pegando los
 * identificadores de la conversación y de los mensajes.
 */
export async function ExamplesTab({ agentId, organizationId, timezone }: { agentId: string; organizationId: string; timezone: string }) {
  const examples = await listExamples(organizationId, agentId);

  return (
    <>
      <SectionPanel description="El asistente los lee en cada conversación para imitar los buenos y evitar los malos." title={`Ejemplos (${examples.length})`}>
        {examples.length === 0 ? (
          <EmptyState
            description="Cuando veas una conversación que salió como querías, guárdala aquí. También sirven las que salieron mal."
            title="Todavía no hay ejemplos"
          />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Tramo</th>
                  <th>Marca</th>
                  <th>Nota</th>
                  <th>Guardado</th>
                  <th>Quitar</th>
                </tr>
              </thead>
              <tbody>
                {examples.map((example) => (
                  <tr key={example.id}>
                    <td>
                      <div className="grid gap-1 text-xs">
                        {example.parsedTurns.map((turn, index) => (
                          <div key={index}>
                            <span className="font-medium">{turn.role === "user" ? "Cliente" : "Asistente"}: </span>
                            {turn.text}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <StatusBadge tone={example.kind === "GOOD" ? "success" : "danger"}>{example.kind === "GOOD" ? "Así sí" : "Así no"}</StatusBadge>
                    </td>
                    <td className="text-xs">{example.note ?? "—"}</td>
                    <td className="text-xs text-ui-muted">{formatDateTime(example.createdAt, timezone)}</td>
                    <td>
                      <ActionForm action={deleteExampleAction} confirm="¿Quitamos este ejemplo?" submitLabel="Quitar" variant="quiet">
                        <input name="agentId" type="hidden" value={agentId} />
                        <input name="exampleId" type="hidden" value={example.id} />
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

      <SectionPanel
        description="Los identificadores salen de la conversación en la bandeja. El botón para hacerlo con un clic desde el chat todavía no está: esta es la vía mientras tanto."
        title="Guardar un tramo real como ejemplo"
      >
        <ActionForm action={addExampleAction} submitLabel="Guardar ejemplo">
          <input name="agentId" type="hidden" value={agentId} />
          <label className="ui-field">
            <span className="ui-field__label">Conversación</span>
            <input className="ui-control" name="conversationId" placeholder="Identificador de la conversación" required />
          </label>
          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Primer mensaje del tramo</span>
              <input className="ui-control" name="fromMessageId" required />
            </label>
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Último mensaje del tramo</span>
              <input className="ui-control" name="toMessageId" />
              <span className="ui-field__hint">Vacío: solo el primero.</span>
            </label>
            <label className="ui-field ui-form-row__fixed">
              <span className="ui-field__label">Marca</span>
              <select className="ui-control ui-control--select" defaultValue="GOOD" name="kind">
                <option value="GOOD">Así sí</option>
                <option value="BAD">Así no</option>
              </select>
            </label>
          </div>
          <label className="ui-field">
            <span className="ui-field__label">Nota</span>
            <input className="ui-control" name="note" placeholder="Qué hay que imitar o qué estuvo mal" />
          </label>
          <p className="ui-field__hint">Al guardarlo se reemplazan nombre, DNI y teléfono por marcadores.</p>
        </ActionForm>
      </SectionPanel>
    </>
  );
}
