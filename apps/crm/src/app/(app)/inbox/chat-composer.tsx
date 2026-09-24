"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import type { ActionState } from "@/server/forms";
import { addNote, sendTemplate, sendText } from "@/server/inbox/actions";
import { applyQuickReply, matchQuickReplies, type QuickReplyOption } from "@/server/inbox/rules";
import { renderTemplateBody, type TemplateVariable } from "@/server/templates/render";

export interface ComposerTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  components: unknown;
  variables: unknown;
}

type Mode = "message" | "note" | "template";

/**
 * Cuadro de escritura (SPEC-054 BR-010 a BR-012). Con la ventana abierta se
 * escribe libre; cerrada, solo plantillas. La nota interna siempre está a mano
 * y nunca sale a WhatsApp.
 */
export function ChatComposer({
  conversationId,
  canWriteFreely,
  quickReplies,
  templates,
  contactName,
  contactPhone,
  advisorName,
}: {
  conversationId: string;
  canWriteFreely: boolean;
  quickReplies: QuickReplyOption[];
  templates: ComposerTemplate[];
  contactName: string;
  contactPhone: string;
  advisorName: string;
}) {
  const [mode, setMode] = useState<Mode>(canWriteFreely ? "message" : "template");

  useEffect(() => {
    setMode((current) => (current === "message" && !canWriteFreely ? "template" : current));
  }, [canWriteFreely]);

  return (
    <div className="chat-composer">
      <div className="chat-composer__mode">
        {canWriteFreely ? (
          <button aria-pressed={mode === "message"} className="ui-button ui-button--quiet" onClick={() => setMode("message")} type="button">
            Mensaje
          </button>
        ) : (
          <button aria-pressed={mode === "template"} className="ui-button ui-button--quiet" onClick={() => setMode("template")} type="button">
            Plantilla
          </button>
        )}
        <button aria-pressed={mode === "note"} className="ui-button ui-button--quiet" onClick={() => setMode("note")} type="button">
          Nota interna
        </button>
      </div>

      {mode === "note" ? (
        <NoteForm conversationId={conversationId} />
      ) : mode === "message" ? (
        <TextForm
          advisorName={advisorName}
          contactName={contactName}
          conversationId={conversationId}
          quickReplies={quickReplies}
        />
      ) : (
        <TemplateForm
          advisorName={advisorName}
          contactName={contactName}
          contactPhone={contactPhone}
          conversationId={conversationId}
          templates={templates}
        />
      )}
    </div>
  );
}

function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function TextForm({
  conversationId,
  quickReplies,
  contactName,
  advisorName,
}: {
  conversationId: string;
  quickReplies: QuickReplyOption[];
  contactName: string;
  advisorName: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(sendText, {});
  const [draft, setDraft] = useState("");
  const [requestId, setRequestId] = useState(newRequestId);
  const form = useRef<HTMLFormElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const suggestions = useMemo(() => matchQuickReplies(quickReplies, draft), [quickReplies, draft]);

  useEffect(() => {
    if (state.ok) {
      setDraft("");
      setRequestId(newRequestId());
    }
  }, [state]);

  function choose(reply: QuickReplyOption) {
    setDraft(applyQuickReply(reply.body, { nombre: contactName, asesor: advisorName }));
    textarea.current?.focus();
  }

  return (
    <form action={formAction} className="ui-form-stack" ref={form}>
      <input name="conversationId" type="hidden" value={conversationId} />
      <input name="clientRequestId" type="hidden" value={requestId} />
      {suggestions.length > 0 ? (
        <ul className="chat-quick-replies">
          {suggestions.map((reply) => (
            <li key={reply.id}>
              <button onClick={() => choose(reply)} type="button">
                <code>/{reply.shortcut}</code>
                <span>{reply.body}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="chat-composer__row">
        <textarea
          aria-label="Mensaje para el cliente"
          className="ui-control chat-composer__textarea"
          name="body"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (draft.trim()) form.current?.requestSubmit();
            }
          }}
          placeholder="Escribe tu mensaje. Enter envía, Shift+Enter salta de línea. Con «/» aparecen tus respuestas rápidas."
          ref={textarea}
          rows={2}
          value={draft}
        />
        <button className="ui-button ui-button--quiet" disabled title="Adjuntos: próximamente" type="button">
          Adjuntar
        </button>
        <button className="ui-button ui-button--primary" disabled={pending || !draft.trim()} type="submit">
          {pending ? "Enviando…" : "Enviar"}
        </button>
      </div>
      {state.error ? <p className="ui-feedback" data-tone="danger" role="alert">{state.error}</p> : null}
    </form>
  );
}

function NoteForm({ conversationId }: { conversationId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addNote, {});
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (state.ok) setDraft("");
  }, [state]);

  return (
    <form action={formAction} className="ui-form-stack">
      <input name="conversationId" type="hidden" value={conversationId} />
      <div className="chat-composer__row">
        <textarea
          aria-label="Nota interna"
          className="ui-control chat-composer__textarea chat-composer__textarea--note"
          name="body"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Solo la ve el equipo. No llega al teléfono del cliente."
          rows={2}
          value={draft}
        />
        <button className="ui-button ui-button--secondary" disabled={pending || !draft.trim()} type="submit">
          {pending ? "Guardando…" : "Guardar nota"}
        </button>
      </div>
      {state.error ? <p className="ui-feedback" data-tone="danger" role="alert">{state.error}</p> : null}
    </form>
  );
}

function variablesOf(template: ComposerTemplate | undefined): TemplateVariable[] {
  if (!template || !Array.isArray(template.variables)) return [];
  return (template.variables as TemplateVariable[]).slice().sort((a, b) => a.index - b.index);
}

function TemplateForm({
  conversationId,
  templates,
  contactName,
  contactPhone,
  advisorName,
}: {
  conversationId: string;
  templates: ComposerTemplate[];
  contactName: string;
  contactPhone: string;
  advisorName: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(sendTemplate, {});
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [manual, setManual] = useState<Record<string, string>>({});
  const [requestId, setRequestId] = useState(newRequestId);
  const template = templates.find((item) => item.id === templateId);
  const variables = variablesOf(template);

  useEffect(() => {
    if (state.ok) {
      setManual({});
      setRequestId(newRequestId());
    }
  }, [state]);

  const values = variables.map((variable) => {
    if (variable.source === "contact.name") return contactName;
    if (variable.source === "contact.phone") return contactPhone;
    if (variable.source === "advisor.name") return advisorName;
    return manual[String(variable.index)] ?? "";
  });
  const preview = template ? renderTemplateBody(template.components, values) : "";

  if (templates.length === 0) {
    return (
      <p className="chat-hint">
        Ya no puedes escribirle libremente y este número todavía no tiene plantillas aprobadas.{" "}
        <a href="/templates">Crear una plantilla</a>
      </p>
    );
  }

  return (
    <form action={formAction} className="ui-form-stack">
      <input name="conversationId" type="hidden" value={conversationId} />
      <input name="clientRequestId" type="hidden" value={requestId} />
      <label className="ui-field">
        <span className="ui-field__label">Plantilla aprobada</span>
        <select className="ui-control ui-control--select" name="templateId" onChange={(event) => setTemplateId(event.target.value)} value={templateId}>
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.language})
            </option>
          ))}
        </select>
      </label>
      {variables
        .filter((variable) => variable.source === "manual")
        .map((variable) => (
          <label className="ui-field" key={variable.index}>
            <span className="ui-field__label">{variable.label ?? `Dato ${variable.index}`}</span>
            <input
              className="ui-control"
              name={`var_${variable.index}`}
              onChange={(event) => setManual((current) => ({ ...current, [String(variable.index)]: event.target.value }))}
              required
              value={manual[String(variable.index)] ?? ""}
            />
          </label>
        ))}
      <p className="chat-template__preview">{preview || "Esta plantilla no tiene cuerpo de texto."}</p>
      <div className="chat-composer__actions">
        <p className="chat-composer__hint">Cuando la persona conteste, vuelves a escribirle libremente durante 24 horas.</p>
        <button className="ui-button ui-button--primary" disabled={pending || !templateId} type="submit">
          {pending ? "Enviando…" : "Enviar plantilla"}
        </button>
      </div>
      {state.error ? <p className="ui-feedback" data-tone="danger" role="alert">{state.error}</p> : null}
      {state.ok && state.message ? <p className="ui-feedback" data-tone="success">{state.message}</p> : null}
    </form>
  );
}
