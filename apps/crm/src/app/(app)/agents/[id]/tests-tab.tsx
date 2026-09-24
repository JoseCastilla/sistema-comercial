import { EmptyState } from "@repo/ui/empty-state";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { formatDateTime } from "@/lib/time";
import { estimateCostUsd } from "@/server/ai/provider";
import { lastTestRun, listTestCases, type AgentDetail } from "@/server/ai/service";
import { TOOL_NAMES } from "@/server/ai/tool-definitions";

import { deleteTestCaseAction, runTestsAction, saveTestCaseAction } from "../actions";

/**
 * Pestaña de pruebas (SPEC-058 BR-016, BR-017). El conjunto se corre entero
 * antes de publicar; una prueba crítica fallida solo la puede saltar el dueño.
 */

/** Estimación gruesa por turno: conocimiento en contexto más una respuesta corta. */
const TOKENS_PER_TURN = { input: 3_000, output: 300, cacheRead: 0 };

export async function TestsTab({ agent, organizationId, timezone }: { agent: AgentDetail; organizationId: string; timezone: string }) {
  const [cases, run] = await Promise.all([listTestCases(organizationId, agent.id), lastTestRun(organizationId, agent.id)]);
  const turns = cases.reduce((total, testCase) => total + Math.max(1, testCase.inputs.length), 0);
  const estimate = estimateCostUsd(agent.modelId, {
    input: TOKENS_PER_TURN.input * turns,
    output: TOKENS_PER_TURN.output * turns,
    cacheRead: 0,
  });

  return (
    <>
      <SectionPanel
        description={
          cases.length
            ? `Correrlas cuesta más o menos US$ ${estimate.toFixed(3)} (${turns} mensajes contra ${agent.modelId}).`
            : "Sin casos, publicar no comprueba nada. Empieza por «no debe inventar un precio» y «debe derivar cuando lo piden»."
        }
        title={`Casos de prueba (${cases.length})`}
        aside={
          cases.length ? (
            <ActionForm action={runTestsAction} pendingLabel="Corriendo…" submitLabel="Correr pruebas" variant="secondary">
              <input name="agentId" type="hidden" value={agent.id} />
            </ActionForm>
          ) : null
        }
      >
        {cases.length === 0 ? (
          <EmptyState description="Cada caso es lo que escribe el cliente y lo que esperas que pase." title="Todavía no hay casos" />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Caso</th>
                  <th>Lo que escribe el cliente</th>
                  <th>Lo que se espera</th>
                  <th>Crítico</th>
                  <th>Quitar</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((testCase) => (
                  <tr key={testCase.id}>
                    <td className="font-medium">{testCase.name}</td>
                    <td className="text-xs">
                      {testCase.inputs.map((line, index) => (
                        <div key={index}>«{line}»</div>
                      ))}
                    </td>
                    <td className="text-xs">
                      {testCase.expectations.mustCallTool ? <div>Usa {testCase.expectations.mustCallTool}</div> : null}
                      {testCase.expectations.mustNotCallTool ? <div>No usa {testCase.expectations.mustNotCallTool}</div> : null}
                      {testCase.expectations.mustContain?.length ? <div>Dice: {testCase.expectations.mustContain.join(", ")}</div> : null}
                      {testCase.expectations.mustNotContain?.length ? <div>No dice: {testCase.expectations.mustNotContain.join(", ")}</div> : null}
                      {testCase.expectations.mustHandoff === true ? <div>Deriva a un asesor</div> : null}
                      {testCase.expectations.mustHandoff === false ? <div>No deriva</div> : null}
                    </td>
                    <td>
                      <StatusBadge tone={testCase.critical ? "danger" : "neutral"}>{testCase.critical ? "Sí" : "No"}</StatusBadge>
                    </td>
                    <td>
                      <ActionForm action={deleteTestCaseAction} confirm="¿Quitamos este caso?" submitLabel="Quitar" variant="quiet">
                        <input name="agentId" type="hidden" value={agent.id} />
                        <input name="testCaseId" type="hidden" value={testCase.id} />
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

      <SectionPanel description={run ? `Corrida del ${formatDateTime(run.ranAt, timezone)}.` : undefined} title="Última corrida">
        {!run ? (
          <EmptyState description="Corre las pruebas para ver aquí qué pasó en cada caso." title="Todavía no se corrieron" />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Caso</th>
                  <th>Resultado</th>
                  <th>Qué falló</th>
                  <th>Costo</th>
                </tr>
              </thead>
              <tbody>
                {run.results.map((result) => (
                  <tr key={result.id}>
                    <td>
                      {result.testCase.name}
                      {result.testCase.critical ? <div className="text-xs text-ui-muted">Crítica</div> : null}
                    </td>
                    <td>
                      <StatusBadge tone={result.passed ? "success" : "danger"}>{result.passed ? "Pasó" : "Falló"}</StatusBadge>
                    </td>
                    <td className="text-xs">{result.detail ?? "—"}</td>
                    <td className="text-xs">US$ {Number(result.costUsd ?? 0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

      <SectionPanel description="Los mensajes se envían en orden, como si los escribiera la misma persona." title="Nuevo caso">
        <ActionForm action={saveTestCaseAction} submitLabel="Guardar caso">
          <input name="agentId" type="hidden" value={agent.id} />
          <label className="ui-field">
            <span className="ui-field__label">Nombre del caso</span>
            <input className="ui-control" maxLength={160} name="name" placeholder="Pide hablar con una persona" required />
          </label>
          <label className="ui-field">
            <span className="ui-field__label">Lo que escribe el cliente</span>
            <textarea className="ui-control" name="inputs" placeholder={"Hola, quiero información\nprefiero hablar con una persona"} required rows={4} />
            <span className="ui-field__hint">Un mensaje por línea.</span>
          </label>
          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Debe usar</span>
              <select className="ui-control ui-control--select" defaultValue="" name="mustCallTool">
                <option value="">Cualquiera</option>
                {TOOL_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">No debe usar</span>
              <select className="ui-control ui-control--select" defaultValue="" name="mustNotCallTool">
                <option value="">Ninguna en particular</option>
                {TOOL_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-field ui-form-row__fixed">
              <span className="ui-field__label">¿Deriva?</span>
              <select className="ui-control ui-control--select" defaultValue="" name="mustHandoff">
                <option value="">Da igual</option>
                <option value="SI">Sí, tiene que derivar</option>
                <option value="NO">No, no debe derivar</option>
              </select>
            </label>
          </div>
          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Tiene que decir</span>
              <textarea className="ui-control" name="mustContain" rows={3} />
              <span className="ui-field__hint">Un texto por línea.</span>
            </label>
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">No puede decir</span>
              <textarea className="ui-control" name="mustNotContain" placeholder={"S/\nsoles"} rows={3} />
              <span className="ui-field__hint">Un texto por línea.</span>
            </label>
          </div>
          <label className="ui-field">
            <span className="flex items-center gap-2 font-medium">
              <input name="critical" type="checkbox" />
              Es crítica
            </span>
            <span className="ui-field__hint">Si una crítica falla, solo el dueño puede publicar igual, explicando por qué.</span>
          </label>
        </ActionForm>
      </SectionPanel>
    </>
  );
}
