import { SectionPanel } from "@repo/ui/section-panel";

import { ActionForm } from "@/components/forms/action-form";
import { ALWAYS_ON_TOOLS, TOOL_LABELS, TOOL_NAMES } from "@/server/ai/tool-definitions";
import type { AgentDetail } from "@/server/ai/service";

import { saveToolsAction } from "../actions";

/** Pestaña de herramientas: qué puede hacer el asistente además de escribir (SPEC-058 BR-007). */
export function ToolsTab({ agent }: { agent: AgentDetail }) {
  const active = new Set(agent.tools);

  return (
    <>
      <SectionPanel description="Lo que no marques aquí, el asistente no puede hacerlo aunque el cliente se lo pida." title="Qué puede hacer">
        <ActionForm action={saveToolsAction} submitLabel="Guardar borrador">
          <input name="agentId" type="hidden" value={agent.id} />
          <div className="grid gap-3">
            {TOOL_NAMES.map((name) => {
              const always = ALWAYS_ON_TOOLS.includes(name);
              return (
                <label className="ui-field" key={name}>
                  <span className="flex items-center gap-2 font-medium">
                    <input defaultChecked={always || active.has(name)} disabled={always} name="tools" type="checkbox" value={name} />
                    {TOOL_LABELS[name].title}
                    {always ? <span className="text-xs text-ui-muted">(siempre disponible)</span> : null}
                  </span>
                  <span className="ui-field__hint">{TOOL_LABELS[name].help}</span>
                </label>
              );
            })}
          </div>
        </ActionForm>
      </SectionPanel>

      <SectionPanel description="No hay forma de activarlas: no existen como herramienta del asistente." title="Lo que el asistente nunca podrá hacer">
        <ul className="grid list-disc gap-1 pl-5 text-sm text-ui-muted">
          <li>Ingresar pedidos.</li>
          <li>Consultar el DNI en el servicio pagado: eso lo hace un asesor, por su costo y su auditoría.</li>
          <li>Cambiar el asesor asignado.</li>
          <li>Enviar plantillas de marketing.</li>
          <li>Borrar información.</li>
        </ul>
      </SectionPanel>
    </>
  );
}
