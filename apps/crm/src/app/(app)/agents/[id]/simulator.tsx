"use client";

import { useState, useTransition } from "react";

import type { SandboxState } from "@/server/ai/sandbox";

import { simulateTurn } from "../actions";

/**
 * Conversar con el borrador como si fuera un cliente (SPEC-058 BR-018).
 * No manda nada a WhatsApp ni toca fichas reales: las herramientas trabajan
 * sobre un contexto ficticio que va y vuelve con cada turno.
 */

interface Bubble {
  role: "user" | "assistant";
  text: string;
  toolCalls?: { name: string; result: string; isError: boolean }[];
  costUsd?: number;
  handoff?: boolean;
}

export function Simulator({ agentId }: { agentId: string }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [state, setState] = useState<SandboxState | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const totalCost = bubbles.reduce((total, bubble) => total + (bubble.costUsd ?? 0), 0);

  function send() {
    const message = draft.trim();
    if (!message || pending) return;
    const history = bubbles.map((bubble) => ({ role: bubble.role, text: bubble.text }));
    setBubbles((current) => [...current, { role: "user", text: message }]);
    setDraft("");
    setError(null);
    startTransition(async () => {
      const result = await simulateTurn({ agentId, history, state, message });
      if (!result.ok) {
        setError(result.error ?? "El simulador falló.");
        return;
      }
      setState(result.state ?? null);
      setBubbles((current) => [
        ...current,
        {
          role: "assistant",
          text: result.text || "(no respondió nada)",
          toolCalls: result.toolCalls,
          costUsd: result.costUsd,
          handoff: result.handoff,
        },
      ]);
    });
  }

  function reset() {
    setBubbles([]);
    setState(null);
    setError(null);
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {bubbles.length === 0 ? (
          <p className="text-sm text-ui-muted">Escribe abajo lo que escribiría un cliente. Nada de esto sale a WhatsApp.</p>
        ) : null}
        {bubbles.map((bubble, index) => (
          <div className="ui-surface ui-surface--padded" key={index}>
            <p className="text-xs font-medium text-ui-muted">{bubble.role === "user" ? "Cliente (tú)" : "Asistente"}</p>
            <p className="text-sm whitespace-pre-wrap">{bubble.text}</p>
            {bubble.toolCalls?.length ? (
              <ul className="mt-2 grid gap-1 text-xs text-ui-muted">
                {bubble.toolCalls.map((call, position) => (
                  <li key={position}>
                    <span className="font-medium">{call.name}</span>
                    {call.isError ? " (no pudo) " : " "}
                    {call.result}
                  </li>
                ))}
              </ul>
            ) : null}
            {bubble.role === "assistant" ? (
              <p className="mt-2 text-xs text-ui-muted">
                {bubble.handoff ? "Derivó a un asesor. " : ""}
                Costó US$ {(bubble.costUsd ?? 0).toFixed(4)}.
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {error ? (
        <p className="ui-feedback" data-tone="danger" role="alert">
          {error}
        </p>
      ) : null}

      <label className="ui-field">
        <span className="ui-field__label">Mensaje del cliente</span>
        <textarea
          className="ui-control"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          rows={2}
          value={draft}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button className="ui-button ui-button--primary" disabled={pending || !draft.trim()} onClick={send} type="button">
          {pending ? "Respondiendo…" : "Enviar"}
        </button>
        <button className="ui-button ui-button--quiet" disabled={pending || bubbles.length === 0} onClick={reset} type="button">
          Empezar de nuevo
        </button>
        <span className="text-xs text-ui-muted">Esta conversación de prueba lleva US$ {totalCost.toFixed(4)}.</span>
      </div>

      {state ? (
        <p className="text-xs text-ui-muted">
          Ficha de prueba: {state.contact.nombre ?? "sin nombre"} · DNI {state.contact.dni ?? "—"} · {state.contact.operador ?? "sin operador"} ·{" "}
          {state.contact.distrito ?? "sin distrito"} · etapa {state.etapa}
          {state.citaIso ? ` · cita ${new Date(state.citaIso).toLocaleString("es-PE")}` : ""}
          {state.handoff ? ` · derivada (${state.handoff.motivo})` : ""}
        </p>
      ) : null}
    </div>
  );
}
