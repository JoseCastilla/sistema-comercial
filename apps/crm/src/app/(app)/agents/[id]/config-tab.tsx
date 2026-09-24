import { SectionPanel } from "@repo/ui/section-panel";

import { ActionForm } from "@/components/forms/action-form";
import { SCHEDULE_HINTS, SCHEDULE_LABELS, scheduleModes } from "@/server/ai/prompt";
import { listModelOptions, type AgentDetail } from "@/server/ai/service";

import { saveConfigAction } from "../actions";

const EFFORTS = [
  ["low", "Bajo: rápido y barato. El punto de partida."],
  ["medium", "Medio: piensa un poco más en cada respuesta."],
  ["high", "Alto: para casos difíciles. Cuesta más por conversación."],
] as const;

/** Pestaña de configuración: identidad, límites, datos a reunir, horario, modelo y tope. */
export async function ConfigTab({ agent }: { agent: AgentDetail }) {
  const models = await listModelOptions();
  const knownModel = models.options.some((option) => option.id === agent.modelId);

  return (
    <>
      <SectionPanel
        description="Todo lo de esta pestaña queda en el borrador. El asistente sigue respondiendo con la versión publicada hasta que publiques una nueva."
        title="Cómo se presenta y qué busca"
      >
        <ActionForm action={saveConfigAction} submitLabel="Guardar borrador">
          <input name="agentId" type="hidden" value={agent.id} />

          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Nombre interno</span>
              <input className="ui-control" defaultValue={agent.name} maxLength={120} name="name" required />
              <span className="ui-field__hint">Con este lo reconoce el equipo en la lista.</span>
            </label>
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Nombre con el que se presenta</span>
              <input className="ui-control" defaultValue={agent.config.displayName} maxLength={120} name="displayName" placeholder="Sofía, asistente virtual" />
              <span className="ui-field__hint">Siempre dice que es un asistente virtual, aunque tenga nombre propio.</span>
            </label>
          </div>

          <label className="ui-field">
            <span className="ui-field__label">Objetivo, en una frase</span>
            <input className="ui-control" defaultValue={agent.config.objective} maxLength={600} name="objective" placeholder="Reunir los datos para evaluar y agendar la llamada del asesor" />
          </label>

          <label className="ui-field">
            <span className="ui-field__label">Tono</span>
            <input className="ui-control" defaultValue={agent.config.tone} maxLength={300} name="tone" placeholder="Cercano, breve, sin tecnicismos" />
          </label>

          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Lo que debe hacer</span>
              <textarea className="ui-control" defaultValue={agent.config.must.join("\n")} name="must" rows={5} />
              <span className="ui-field__hint">Una indicación por línea.</span>
            </label>
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Lo que nunca debe hacer</span>
              <textarea className="ui-control" defaultValue={agent.config.never.join("\n")} name="never" rows={5} />
              <span className="ui-field__hint">Una por línea. Las reglas de la empresa se suman a las que el asistente ya cumple siempre.</span>
            </label>
          </div>

          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Datos a reunir, en orden</span>
              <textarea className="ui-control" defaultValue={agent.config.dataToCollect.join("\n")} name="dataToCollect" rows={5} />
              <span className="ui-field__hint">Uno por línea. Los pide en ese orden, uno por mensaje.</span>
            </label>
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Etiquetas permitidas</span>
              <textarea className="ui-control" defaultValue={agent.config.allowedTags.join("\n")} name="allowedTags" rows={5} />
              <span className="ui-field__hint">Una por línea. Solo puede poner estas; nunca borra ninguna.</span>
            </label>
          </div>

          <label className="ui-field">
            <span className="ui-field__label">Qué dice al pasar a un asesor</span>
            <input className="ui-control" defaultValue={agent.config.handoffMessage} maxLength={400} name="handoffMessage" placeholder="Te paso con un asesor; te escribe en unos minutos" />
          </label>

          <label className="ui-field">
            <span className="ui-field__label">Cuándo contesta</span>
            <select className="ui-control ui-control--select" defaultValue={agent.schedule.mode} name="scheduleMode">
              {scheduleModes.map((mode) => (
                <option key={mode} value={mode}>
                  {SCHEDULE_LABELS[mode]}
                </option>
              ))}
            </select>
            <span className="ui-field__hint">{SCHEDULE_HINTS[agent.schedule.mode]}</span>
          </label>

          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Modelo</span>
              <select className="ui-control ui-control--select" defaultValue={agent.modelId} disabled={!models.configured} name="modelId">
                {!knownModel ? <option value={agent.modelId}>{agent.modelId}</option> : null}
                {models.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {models.problem ? <span className="ui-field__error">{models.problem}</span> : null}
            </label>
            <label className="ui-field ui-form-row__fixed">
              <span className="ui-field__label">Cuánto piensa</span>
              <select className="ui-control ui-control--select" defaultValue={agent.effort} name="effort">
                {EFFORTS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-field ui-form-row__fixed">
              <span className="ui-field__label">Tope del mes (soles)</span>
              <input
                className="ui-control"
                defaultValue={agent.monthlyBudgetPen ?? ""}
                inputMode="decimal"
                name="monthlyBudgetPen"
                placeholder="Sin tope"
              />
              <span className="ui-field__hint">Al 80 % avisa; al llegar al tope deja de contestar y todo va a la cola.</span>
            </label>
          </div>
        </ActionForm>
      </SectionPanel>

      <SectionPanel description="Estas reglas se aplican siempre, escriba lo que escriba la configuración." title="Lo que el asistente cumple pase lo que pase">
        <ul className="grid list-disc gap-1 pl-5 text-sm text-ui-muted">
          <li>Se identifica como asistente virtual y siempre ofrece hablar con una persona.</li>
          <li>No habla de temas ajenos al negocio.</li>
          <li>No dice ningún precio, promoción ni plazo que no venga del catálogo o de una herramienta.</li>
          <li>No pide tarjetas ni claves.</li>
          <li>No ingresa pedidos, no consulta el DNI pagado, no cambia de asesor y no envía plantillas.</li>
        </ul>
      </SectionPanel>
    </>
  );
}
