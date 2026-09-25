"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { attemptResultLabels } from "../attempt-result-labels";
import {
  CampaignAttemptEditor,
  type ConfirmedAttempt,
} from "./campaign-attempt-editor";
import { CampaignDraftProvider, useCampaignDraft } from "./campaign-draft-context";
import { PhoneNumber } from "./phone-number";

export interface CaseWorkNote {
  text: string;
  /** Ámbar para lo que exige algo hoy; acento para una pista; gris lo demás. */
  tone?: "warning" | "accent" | "muted";
}

export interface CaseWorkCardProps {
  caseId: string;
  holderName: string;
  phone: string | null;
  phoneOptions: string[];
  serviceNumbers: string[];
  lastResult: string | null;
  lastObservation: string | null;
  /** El plazo con la misma regla que «Mi día» y la cola. */
  due: { label: string; tone: "danger" | "warning" | "neutral" } | null;
  /** Qué hacer, en una frase. */
  action: string;
  /** Una línea de contexto: la venta y el pedido, el equipo. */
  meta?: ReactNode;
  notes?: CaseWorkNote[];
  canManage: boolean;
}

const noteTone: Record<NonNullable<CaseWorkNote["tone"]>, string> = {
  warning: "font-medium text-ui-warning",
  accent: "text-ui-accent",
  muted: "text-ui-muted",
};

/**
 * La parte de arriba de la ficha (SPEC-067 BR-007 y BR-008): la tarjeta de
 * «Mi día». Plazo, qué hacer, el número al que llamar y el editor de botones,
 * abierto, con el teléfono ya elegido. Antes el registro era un formulario
 * de cuatro campos a dos pantallas de distancia, con el teléfono vacío.
 */
export function CaseWorkCard(props: CaseWorkCardProps) {
  return (
    <CampaignDraftProvider>
      <CaseWorkCardBody {...props} />
    </CampaignDraftProvider>
  );
}

function CaseWorkCardBody({
  caseId,
  holderName,
  phone,
  phoneOptions,
  serviceNumbers,
  lastResult,
  lastObservation,
  due,
  action,
  meta,
  notes = [],
  canManage,
}: CaseWorkCardProps) {
  const draft = useCampaignDraft();
  const router = useRouter();
  const editing = draft.editingId === caseId;
  const [saved, setSaved] = useState<ConfirmedAttempt | null>(null);
  const [unmanageable, setUnmanageable] = useState<string | null>(null);
  const { startEditing } = draft;

  // En la ficha se viene a registrar: el editor abre solo, una vez. Si el
  // asesor lo cierra, queda cerrado.
  const openedOnce = useRef(false);
  useEffect(() => {
    if (!canManage || openedOnce.current) return;
    openedOnce.current = true;
    startEditing(caseId);
  }, [canManage, caseId, startEditing]);

  // Lo guardado cambia el historial y lo que toca: la ficha se vuelve a leer.
  const handleSaved = useCallback(
    (attempt: ConfirmedAttempt) => {
      setSaved(attempt);
      router.refresh();
    },
    [router],
  );

  return (
    <section
      aria-label="Qué hacer ahora"
      className="rounded-lg border border-ui-border bg-ui-surface"
    >
      <div className="grid gap-1 p-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ui-soft">
          {saved ? (
            <Badge tone="success">
              Gestionado: {attemptResultLabels[saved.result] ?? saved.result}
            </Badge>
          ) : due ? (
            <Badge tone={due.tone}>{due.label}</Badge>
          ) : null}
          {meta ? <span>{meta}</span> : null}
        </p>
        <p className="text-base font-semibold text-ui-text">
          {saved
            ? saved.nextActionAtLabel
              ? `Próxima acción: ${saved.nextActionAtLabel}`
              : "Gestión registrada"
            : action}
        </p>
        {phone ? (
          <p className="flex flex-wrap items-baseline gap-2 text-sm text-ui-muted">
            Llamar al <PhoneNumber phone={phone} />
          </p>
        ) : (
          <p className="text-sm text-ui-muted">Sin teléfono válido.</p>
        )}
        {unmanageable ? (
          <p className="text-xs text-ui-danger">{unmanageable}</p>
        ) : null}
        {saved
          ? null
          : notes.map((note) => (
              <p
                className={`text-xs ${noteTone[note.tone ?? "muted"]}`}
                key={note.text}
              >
                {note.text}
              </p>
            ))}
        {canManage && !editing && !unmanageable ? (
          <div className="mt-2">
            <Button
              aria-label={`Registrar gestión: ${holderName}`}
              onClick={() => startEditing(caseId)}
              type="button"
            >
              {saved ? "Otra gestión" : "Registrar gestión"}
            </Button>
          </div>
        ) : null}
      </div>
      {canManage && editing && !unmanageable ? (
        <div className="border-t border-ui-border bg-ui-subtle p-4">
          <CampaignAttemptEditor
            caseId={caseId}
            defaultPhone={phone}
            holderName={holderName}
            lastObservation={saved ? saved.observation : lastObservation}
            lastResult={saved ? saved.result : lastResult}
            onCancel={draft.stopEditing}
            onSaved={handleSaved}
            onUnmanageable={setUnmanageable}
            phoneOptions={phoneOptions}
            serviceNumbers={serviceNumbers}
          />
        </div>
      ) : null}
    </section>
  );
}
