"use client";

import { useMemo, useState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import {
  BOOLEAN_CONDITION_FIELDS,
  CONDITION_FIELD_LABELS,
  describeStep,
  describeTrigger,
  ORDER_STATUS_LABELS,
  STAGE_LABELS,
  STEP_LABELS,
  TRIGGER_LABELS,
} from "@/server/workflows/describe";
import {
  CONDITION_FIELDS,
  MANUAL_STAGES,
  ORDER_STATUSES,
  STEP_TYPES,
  TRIGGER_KINDS,
  type StepType,
  type TriggerKind,
  type WorkflowDefinition,
  type WorkflowStep,
  type WorkflowTrigger,
} from "@/server/workflows/schema";
import type { TemplateOption } from "@/server/workflows/service";
import { JUMP_FIELDS, readJump, validateWorkflow, writeJump, type WorkflowProblem } from "@/server/workflows/validate";

import { saveWorkflowAction } from "../actions";

/**
 * Editor de un flujo: disparador arriba y pasos en lista, con los saltos
 * elegidos por nombre de paso. Valida mientras se arma y avisa en lenguaje
 * directo lo que impide activarlo.
 */

export interface EditorWorkflow {
  id: string;
  name: string;
  description: string;
  status: string;
  version: number;
  priority: number;
}

interface Props {
  workflow: EditorWorkflow;
  definition: WorkflowDefinition;
  templates: TemplateOption[];
  advisors: { id: string; name: string }[];
  tags: string[];
}

const TRIGGER_HINTS: Record<TriggerKind, string> = {
  INBOUND_MESSAGE: "Cada mensaje que escribe el cliente. Los filtros acotan cuáles.",
  CONVERSATION_UNANSWERED: "Cuando la conversación pasa el tiempo de respuesta sin que nadie conteste.",
  CLIENT_SILENT: "Conversación abierta en la que el cliente lleva horas sin contestar y el último mensaje fue nuestro.",
  OPPORTUNITY_STAGE: "Cuando alguien mueve la oportunidad a esa etapa.",
  APPOINTMENT_CREATED: "Al agendar una cita.",
  APPOINTMENT_DUE: "Cuando faltan esas horas para una cita pendiente.",
  ORDER_STATUS: "Cuando el pedido pasa a ese estado.",
  CONTACT_TAGGED: "Cuando alguien le pone esa etiqueta al contacto.",
};

function defaultTrigger(kind: TriggerKind): WorkflowTrigger {
  switch (kind) {
    case "INBOUND_MESSAGE":
      return { kind, filters: {} };
    case "CONVERSATION_UNANSWERED":
      return { kind, filters: { minutes: 15 } };
    case "CLIENT_SILENT":
      return { kind, filters: { hours: 20 } };
    case "OPPORTUNITY_STAGE":
      return { kind, filters: { stage: "PROPUESTA" } };
    case "APPOINTMENT_CREATED":
      return { kind, filters: {} };
    case "APPOINTMENT_DUE":
      return { kind, filters: { hoursBefore: 2 } };
    case "ORDER_STATUS":
      return { kind, filters: { status: "ENTREGADO" } };
    case "CONTACT_TAGGED":
      return { kind, filters: { tag: "" } };
  }
}

function newStep(type: StepType, id: string): WorkflowStep {
  switch (type) {
    case "send_text":
      return { id, type, params: { text: "" } };
    case "send_template":
      return { id, type, params: { templateId: "", values: {} } };
    case "send_buttons":
      return { id, type, params: { text: "", buttons: [{ id: "si", title: "Sí" }] } };
    case "wait_reply":
      return { id, type, params: { hours: 24 } };
    case "wait":
      return { id, type, params: { minutes: 60 } };
    case "assign_advisor":
      return { id, type, params: { mode: "round_robin" } };
    case "hand_to_ai":
      return { id, type, params: {} };
    case "require_advisor":
      return { id, type, params: { note: "" } };
    case "add_tag":
      return { id, type, params: { tag: "" } };
    case "set_stage":
      return { id, type, params: { stage: "EN_CONTACTO" } };
    case "condition":
      return { id, type, params: { field: "contact.tag", op: "eq", value: "" }, onTrue: undefined, onFalse: undefined };
    case "notify":
      return { id, type, params: { text: "" } };
    case "end":
      return { id, type, params: {} };
  }
}

function nextStepId(steps: WorkflowStep[]): string {
  const used = new Set(steps.map((step) => step.id));
  for (let index = 1; index < 200; index += 1) {
    const candidate = `p${index}`;
    if (!used.has(candidate)) return candidate;
  }
  return `p${Date.now()}`;
}

function stepLabel(steps: WorkflowStep[], id: string): string {
  const index = steps.findIndex((step) => step.id === id);
  const step = steps[index];
  return step ? `${index + 1}. ${STEP_LABELS[step.type]}` : id;
}

export function WorkflowEditor({ workflow, definition: initial, templates, advisors, tags }: Props) {
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description);
  const [priority, setPriority] = useState(workflow.priority);
  const [trigger, setTrigger] = useState<WorkflowTrigger>(initial.trigger);
  const [steps, setSteps] = useState<WorkflowStep[]>(initial.steps);
  const [adding, setAdding] = useState<StepType>("send_text");

  const definition = useMemo<WorkflowDefinition>(() => ({ trigger, steps }), [trigger, steps]);
  const problems = useMemo(() => validateWorkflow(definition, templates), [definition, templates]);
  const blocking = problems.filter((problem) => problem.level === "error");
  const templateName = (id: string) => templates.find((template) => template.id === id)?.name;
  const advisorName = (id: string) => advisors.find((advisor) => advisor.id === id)?.name;

  const update = (index: number, next: WorkflowStep) => setSteps((current) => current.map((step, position) => (position === index ? next : step)));
  const move = (index: number, delta: number) =>
    setSteps((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved!);
      return copy;
    });
  const remove = (index: number) => setSteps((current) => current.filter((_, position) => position !== index));
  const add = () => setSteps((current) => [...current, newStep(adding, nextStepId(current))]);

  return (
    <div className="ui-page-stack">
      <datalist id="etiquetas-flujo">
        {tags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <section className="ui-section-panel">
        <header className="ui-section-panel__header">
          <div>
            <h2 className="ui-section-panel__title">Cuándo se ejecuta</h2>
            <p className="ui-section-panel__description">{describeTrigger(trigger)}</p>
          </div>
        </header>
        <div className="ui-section-panel__body">
          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Disparador</span>
              <select
                className="ui-control ui-control--select"
                onChange={(event) => setTrigger(defaultTrigger(event.target.value as TriggerKind))}
                value={trigger.kind}
              >
                {TRIGGER_KINDS.map((kind) => (
                  <option key={kind} value={kind}>{TRIGGER_LABELS[kind]}</option>
                ))}
              </select>
              <span className="ui-field__hint">{TRIGGER_HINTS[trigger.kind]}</span>
            </label>
          </div>
          <TriggerFilters onChange={setTrigger} trigger={trigger} />
        </div>
      </section>

      <section className="ui-section-panel">
        <header className="ui-section-panel__header">
          <div>
            <h2 className="ui-section-panel__title">Pasos ({steps.length})</h2>
            <p className="ui-section-panel__description">Se recorren en orden. Si un salto queda en «el siguiente de la lista», pasa al de abajo; si no hay ninguno, el flujo termina.</p>
          </div>
        </header>
        <div className="ui-section-panel__body">
          {steps.length === 0 ? <p className="text-sm text-ui-muted">Todavía no hay pasos: agrega el primero abajo.</p> : null}
          <div className="grid gap-3">
            {steps.map((step, index) => (
              <StepCard
                advisorName={advisorName}
                advisors={advisors}
                index={index}
                key={step.id}
                onChange={(next) => update(index, next)}
                onMove={(delta) => move(index, delta)}
                onRemove={() => remove(index)}
                problems={problems.filter((problem) => problem.stepId === step.id)}
                step={step}
                steps={steps}
                templateName={templateName}
                templates={templates}
              />
            ))}
          </div>
          <div className="ui-form-row mt-3">
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Agregar paso</span>
              <select className="ui-control ui-control--select" onChange={(event) => setAdding(event.target.value as StepType)} value={adding}>
                {STEP_TYPES.map((type) => (
                  <option key={type} value={type}>{STEP_LABELS[type]}</option>
                ))}
              </select>
            </label>
            <div className="ui-field ui-form-row__fixed">
              <span className="ui-field__label">&nbsp;</span>
              <button className="ui-button ui-button--secondary" onClick={add} type="button">Agregar</button>
            </div>
          </div>
        </div>
      </section>

      <section className="ui-section-panel">
        <header className="ui-section-panel__header">
          <div>
            <h2 className="ui-section-panel__title">Revisión</h2>
            <p className="ui-section-panel__description">
              {blocking.length === 0 ? "Nada impide activarlo." : `${blocking.length} ${blocking.length === 1 ? "cosa impide" : "cosas impiden"} activarlo.`}
            </p>
          </div>
        </header>
        <div className="ui-section-panel__body">
          {problems.length === 0 ? (
            <p className="text-sm text-ui-muted">El flujo está completo.</p>
          ) : (
            <ul className="grid gap-2">
              {problems.map((problem, index) => (
                <li className="ui-feedback" data-tone={problem.level === "error" ? "danger" : "warning"} key={`${problem.stepId ?? "flujo"}-${index}`}>
                  {problem.stepId ? `${stepLabel(steps, problem.stepId)}: ` : ""}
                  {problem.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="ui-section-panel">
        <header className="ui-section-panel__header">
          <div>
            <h2 className="ui-section-panel__title">Guardar</h2>
            <p className="ui-section-panel__description">
              {workflow.status === "ACTIVE"
                ? "Este flujo está activo: al guardar se publica una versión nueva y lo que ya está en curso termina con la versión con la que empezó."
                : "Guardar no lo activa: sigue apagado hasta que lo actives."}
            </p>
          </div>
        </header>
        <div className="ui-section-panel__body">
          <ActionForm action={saveWorkflowAction} submitLabel="Guardar flujo">
            <input name="workflowId" type="hidden" value={workflow.id} />
            <input name="definition" type="hidden" value={JSON.stringify(definition)} />
            <div className="ui-form-row">
              <label className="ui-field ui-form-row__grow">
                <span className="ui-field__label">Nombre</span>
                <input className="ui-control" maxLength={160} name="name" onChange={(event) => setName(event.target.value)} required value={name} />
              </label>
              <label className="ui-field ui-form-row__fixed">
                <span className="ui-field__label">Prioridad</span>
                <input className="ui-control" max={999} min={1} name="priority" onChange={(event) => setPriority(Number(event.target.value))} type="number" value={priority} />
                <span className="ui-field__hint">Si dos flujos caen en la misma conversación, gana el número más bajo.</span>
              </label>
            </div>
            <label className="ui-field">
              <span className="ui-field__label">Para qué sirve</span>
              <textarea className="ui-control" maxLength={500} name="description" onChange={(event) => setDescription(event.target.value)} rows={2} value={description} />
            </label>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}

function TriggerFilters({ trigger, onChange }: { trigger: WorkflowTrigger; onChange: (next: WorkflowTrigger) => void }) {
  switch (trigger.kind) {
    case "INBOUND_MESSAGE":
      return (
        <div className="grid gap-2">
          <label className="ui-field">
            <span className="ui-field__label">Palabra en el mensaje</span>
            <input
              className="ui-control"
              maxLength={80}
              onChange={(event) => onChange({ ...trigger, filters: { ...trigger.filters, keyword: event.target.value } })}
              placeholder="Por ejemplo: porta"
              value={trigger.filters.keyword ?? ""}
            />
            <span className="ui-field__hint">Vacío: cualquier mensaje. No distingue mayúsculas ni tildes.</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input checked={Boolean(trigger.filters.firstMessageOnly)} onChange={(event) => onChange({ ...trigger, filters: { ...trigger.filters, firstMessageOnly: event.target.checked } })} type="checkbox" />
            Solo el primer mensaje de la conversación
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input checked={Boolean(trigger.filters.fromAd)} onChange={(event) => onChange({ ...trigger, filters: { ...trigger.filters, fromAd: event.target.checked } })} type="checkbox" />
            Solo si viene de un anuncio
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input checked={Boolean(trigger.filters.outsideBusinessHours)} onChange={(event) => onChange({ ...trigger, filters: { ...trigger.filters, outsideBusinessHours: event.target.checked } })} type="checkbox" />
            Solo fuera del horario de atención
          </label>
        </div>
      );
    case "CONVERSATION_UNANSWERED":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Minutos sin respuesta</span>
          <input className="ui-control" max={1440} min={1} onChange={(event) => onChange({ ...trigger, filters: { minutes: Number(event.target.value) } })} type="number" value={trigger.filters.minutes} />
        </label>
      );
    case "CLIENT_SILENT":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Horas sin que el cliente conteste</span>
          <input className="ui-control" max={720} min={1} onChange={(event) => onChange({ ...trigger, filters: { hours: Number(event.target.value) } })} type="number" value={trigger.filters.hours} />
          <span className="ui-field__hint">Pasadas 24 h ya no se le puede escribir libremente: usa una plantilla.</span>
        </label>
      );
    case "OPPORTUNITY_STAGE":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Etapa</span>
          <select className="ui-control ui-control--select" onChange={(event) => onChange({ ...trigger, filters: { stage: event.target.value as (typeof MANUAL_STAGES)[number] } })} value={trigger.filters.stage}>
            {MANUAL_STAGES.map((stage) => (
              <option key={stage} value={stage}>{STAGE_LABELS[stage] ?? stage}</option>
            ))}
          </select>
        </label>
      );
    case "APPOINTMENT_DUE":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Horas antes de la cita</span>
          <input className="ui-control" max={168} min={0.25} onChange={(event) => onChange({ ...trigger, filters: { hoursBefore: Number(event.target.value) } })} step={0.25} type="number" value={trigger.filters.hoursBefore} />
        </label>
      );
    case "ORDER_STATUS":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Estado del pedido</span>
          <select className="ui-control ui-control--select" onChange={(event) => onChange({ ...trigger, filters: { status: event.target.value as (typeof ORDER_STATUSES)[number] } })} value={trigger.filters.status}>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>{ORDER_STATUS_LABELS[status] ?? status}</option>
            ))}
          </select>
        </label>
      );
    case "CONTACT_TAGGED":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Etiqueta</span>
          <input className="ui-control" list="etiquetas-flujo" maxLength={60} onChange={(event) => onChange({ ...trigger, filters: { tag: event.target.value } })} value={trigger.filters.tag} />
        </label>
      );
    default:
      return null;
  }
}

interface StepCardProps {
  step: WorkflowStep;
  steps: WorkflowStep[];
  index: number;
  problems: WorkflowProblem[];
  templates: TemplateOption[];
  advisors: { id: string; name: string }[];
  templateName: (id: string) => string | undefined;
  advisorName: (id: string) => string | undefined;
  onChange: (next: WorkflowStep) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

function StepCard({ step, steps, index, problems, templates, advisors, templateName, advisorName, onChange, onMove, onRemove }: StepCardProps) {
  const blocking = problems.some((problem) => problem.level === "error");
  return (
    <article className="ui-surface ui-surface--padded" data-tone={blocking ? "danger" : undefined}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{index + 1}. {STEP_LABELS[step.type]}</p>
          <p className="text-sm text-ui-muted">{describeStep(step, { templateName, userName: advisorName })}</p>
        </div>
        <div className="flex gap-1">
          <button aria-label="Subir" className="ui-button ui-button--quiet" onClick={() => onMove(-1)} type="button">↑</button>
          <button aria-label="Bajar" className="ui-button ui-button--quiet" onClick={() => onMove(1)} type="button">↓</button>
          <button className="ui-button ui-button--quiet" onClick={onRemove} type="button">Quitar</button>
        </div>
      </header>
      <div className="mt-3 grid gap-2">
        <StepFields advisors={advisors} onChange={onChange} step={step} templates={templates} />
        {JUMP_FIELDS[step.type].map((field) => (
          <label className="ui-field" key={field.key}>
            <span className="ui-field__label">{field.label}</span>
            <select
              className="ui-control ui-control--select"
              onChange={(event) => onChange(writeJump(step, field.key, event.target.value))}
              value={readJump(step, field.key) ?? ""}
            >
              <option value="">El siguiente de la lista</option>
              {steps
                .filter((candidate) => candidate.id !== step.id)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{stepLabel(steps, candidate.id)}</option>
                ))}
            </select>
          </label>
        ))}
        {problems.map((problem, position) => (
          <p className="ui-feedback" data-tone={problem.level === "error" ? "danger" : "warning"} key={position}>{problem.message}</p>
        ))}
      </div>
    </article>
  );
}

function StepFields({
  step,
  templates,
  advisors,
  onChange,
}: {
  step: WorkflowStep;
  templates: TemplateOption[];
  advisors: { id: string; name: string }[];
  onChange: (next: WorkflowStep) => void;
}) {
  switch (step.type) {
    case "send_text":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Mensaje</span>
          <textarea className="ui-control" maxLength={1024} onChange={(event) => onChange({ ...step, params: { text: event.target.value } })} rows={3} value={step.params.text} />
          <span className="ui-field__hint">Puedes usar {"{nombre}"}, {"{asesor}"} y {"{telefono}"}. Solo sale si aún puedes escribirle libremente.</span>
        </label>
      );
    case "send_buttons":
      return (
        <>
          <label className="ui-field">
            <span className="ui-field__label">Pregunta</span>
            <textarea className="ui-control" maxLength={1024} onChange={(event) => onChange({ ...step, params: { ...step.params, text: event.target.value } })} rows={2} value={step.params.text} />
          </label>
          <div className="grid gap-2">
            {step.params.buttons.map((button, position) => (
              <div className="ui-form-row" key={position}>
                <label className="ui-field ui-form-row__grow">
                  <span className="ui-field__label">Botón {position + 1}</span>
                  <input
                    className="ui-control"
                    maxLength={20}
                    onChange={(event) => {
                      const buttons = step.params.buttons.map((current, other) => (other === position ? { ...current, title: event.target.value } : current));
                      onChange({ ...step, params: { ...step.params, buttons } });
                    }}
                    value={button.title}
                  />
                </label>
                <div className="ui-field ui-form-row__fixed">
                  <span className="ui-field__label">&nbsp;</span>
                  <button
                    className="ui-button ui-button--quiet"
                    disabled={step.params.buttons.length <= 1}
                    onClick={() => onChange({ ...step, params: { ...step.params, buttons: step.params.buttons.filter((_, other) => other !== position) } })}
                    type="button"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
            {step.params.buttons.length < 3 ? (
              <button
                className="ui-button ui-button--quiet"
                onClick={() => onChange({ ...step, params: { ...step.params, buttons: [...step.params.buttons, { id: `b${step.params.buttons.length + 1}`, title: "" }] } })}
                type="button"
              >
                Agregar botón
              </button>
            ) : null}
          </div>
        </>
      );
    case "send_template": {
      const chosen = templates.find((template) => template.id === step.params.templateId);
      const manual = chosen?.variables.filter((variable) => variable.source === "manual") ?? [];
      return (
        <>
          <label className="ui-field">
            <span className="ui-field__label">Plantilla</span>
            <select
              className="ui-control ui-control--select"
              onChange={(event) => onChange({ ...step, params: { templateId: event.target.value, values: {} } })}
              value={step.params.templateId}
            >
              <option value="">Elige una plantilla aprobada</option>
              {templates
                .filter((template) => template.status === "APPROVED")
                .map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.category === "MARKETING" ? "(marketing)" : ""}
                  </option>
                ))}
            </select>
          </label>
          {manual.map((variable) => (
            <label className="ui-field" key={variable.index}>
              <span className="ui-field__label">{variable.label ?? `Variable ${variable.index}`}</span>
              <input
                className="ui-control"
                onChange={(event) => onChange({ ...step, params: { ...step.params, values: { ...step.params.values, [String(variable.index)]: event.target.value } } })}
                value={step.params.values[String(variable.index)] ?? ""}
              />
            </label>
          ))}
        </>
      );
    }
    case "wait_reply":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Horas de espera</span>
          <input className="ui-control" max={720} min={0.25} onChange={(event) => onChange({ ...step, params: { hours: Number(event.target.value) } })} step={0.25} type="number" value={step.params.hours} />
        </label>
      );
    case "wait":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Minutos de pausa</span>
          <input className="ui-control" min={1} onChange={(event) => onChange({ ...step, params: { minutes: Number(event.target.value) } })} type="number" value={step.params.minutes} />
        </label>
      );
    case "assign_advisor":
      return (
        <>
          <label className="ui-field">
            <span className="ui-field__label">Cómo se asigna</span>
            <select
              className="ui-control ui-control--select"
              onChange={(event) => onChange({ ...step, params: { mode: event.target.value as "round_robin" | "specific", userId: undefined } })}
              value={step.params.mode}
            >
              <option value="round_robin">Al asesor disponible con menos carga</option>
              <option value="specific">A una persona en concreto</option>
            </select>
          </label>
          {step.params.mode === "specific" ? (
            <label className="ui-field">
              <span className="ui-field__label">Asesor</span>
              <select className="ui-control ui-control--select" onChange={(event) => onChange({ ...step, params: { ...step.params, userId: event.target.value } })} value={step.params.userId ?? ""}>
                <option value="">Elige a quién</option>
                {advisors.map((advisor) => (
                  <option key={advisor.id} value={advisor.id}>{advisor.name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      );
    case "require_advisor":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Nota para quien lo tome</span>
          <input className="ui-control" maxLength={300} onChange={(event) => onChange({ ...step, params: { note: event.target.value } })} value={step.params.note} />
        </label>
      );
    case "add_tag":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Etiqueta</span>
          <input className="ui-control" list="etiquetas-flujo" maxLength={60} onChange={(event) => onChange({ ...step, params: { tag: event.target.value } })} value={step.params.tag} />
        </label>
      );
    case "set_stage":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Etapa</span>
          <select className="ui-control ui-control--select" onChange={(event) => onChange({ ...step, params: { stage: event.target.value as (typeof MANUAL_STAGES)[number] } })} value={step.params.stage}>
            {MANUAL_STAGES.map((stage) => (
              <option key={stage} value={stage}>{STAGE_LABELS[stage] ?? stage}</option>
            ))}
          </select>
          <span className="ui-field__hint">Un flujo no gana ni cierra ventas: eso lo hace el pedido.</span>
        </label>
      );
    case "condition":
      return (
        <>
          <div className="ui-form-row">
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Qué se mira</span>
              <select
                className="ui-control ui-control--select"
                onChange={(event) => onChange({ ...step, params: { ...step.params, field: event.target.value as (typeof CONDITION_FIELDS)[number], value: "" } })}
                value={step.params.field}
              >
                {CONDITION_FIELDS.map((field) => (
                  <option key={field} value={field}>{CONDITION_FIELD_LABELS[field] ?? field}</option>
                ))}
              </select>
            </label>
            <label className="ui-field ui-form-row__fixed">
              <span className="ui-field__label">Cómo</span>
              <select className="ui-control ui-control--select" onChange={(event) => onChange({ ...step, params: { ...step.params, op: event.target.value as "eq" | "neq" | "has" } })} value={step.params.op}>
                <option value="eq">Sí / es igual</option>
                <option value="neq">No / es distinto</option>
                <option value="has">Lo incluye</option>
              </select>
            </label>
          </div>
          {BOOLEAN_CONDITION_FIELDS.includes(step.params.field) ? null : (
            <label className="ui-field">
              <span className="ui-field__label">Valor</span>
              {step.params.field === "opportunity.stage" ? (
                <select className="ui-control ui-control--select" onChange={(event) => onChange({ ...step, params: { ...step.params, value: event.target.value } })} value={step.params.value ?? ""}>
                  <option value="">Elige la etapa</option>
                  {MANUAL_STAGES.map((stage) => (
                    <option key={stage} value={stage}>{STAGE_LABELS[stage] ?? stage}</option>
                  ))}
                </select>
              ) : (
                <input className="ui-control" list="etiquetas-flujo" maxLength={80} onChange={(event) => onChange({ ...step, params: { ...step.params, value: event.target.value } })} value={step.params.value ?? ""} />
              )}
            </label>
          )}
        </>
      );
    case "notify":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Aviso</span>
          <textarea className="ui-control" maxLength={1024} onChange={(event) => onChange({ ...step, params: { text: event.target.value } })} rows={2} value={step.params.text} />
          <span className="ui-field__hint">Queda en la conversación y en la auditoría. No se le envía al cliente.</span>
        </label>
      );
    case "end":
      return (
        <label className="ui-field">
          <span className="ui-field__label">Motivo del fin</span>
          <input className="ui-control" maxLength={120} onChange={(event) => onChange({ ...step, params: { reason: event.target.value } })} placeholder="Por ejemplo: lead atendido" value={step.params.reason ?? ""} />
        </label>
      );
    case "hand_to_ai":
      return <p className="text-sm text-ui-muted">Si el número no tiene asistente, la conversación queda pendiente de asesor.</p>;
  }
}
