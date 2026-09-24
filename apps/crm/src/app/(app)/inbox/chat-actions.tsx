import { ActionForm } from "@/components/forms/action-form";
import { canManage } from "@/server/auth/access";
import type { OrganizationRole } from "@/generated/prisma/enums";
import {
  closeConversation,
  handBackToAgent,
  reopenConversation,
  sendToQueue,
  takeControl,
  transfer,
} from "@/server/inbox/actions";

/**
 * Botones de la cabecera del chat (SPEC-054 BR-006, BR-008). Cada uno dice qué
 * pasa al pulsarlo; los que cambian de dueño piden motivo porque queda escrito.
 */
export function ChatActions({
  conversationId,
  status,
  responderState,
  hasAiAgent,
  role,
  members,
  currentUserId,
  assignedUserId,
}: {
  conversationId: string;
  status: "OPEN" | "CLOSED";
  responderState: "IA_ACTIVA" | "REQUIERE_ASESOR" | "CONTROL_HUMANO";
  hasAiAgent: boolean;
  role: OrganizationRole;
  members: { userId: string; name: string; available: boolean }[];
  currentUserId: string;
  assignedUserId: string | null;
}) {
  const hidden = <input name="conversationId" type="hidden" value={conversationId} />;

  if (status === "CLOSED") {
    return (
      <div className="chat-header__actions">
        <ActionForm action={reopenConversation} className="flex" pendingLabel="Reabriendo…" submitLabel="Reabrir" variant="primary">
          {hidden}
        </ActionForm>
      </div>
    );
  }

  const others = members.filter((member) => member.userId !== assignedUserId);

  return (
    <div className="chat-header__actions">
      {responderState !== "CONTROL_HUMANO" || assignedUserId !== currentUserId ? (
        <ActionForm action={takeControl} className="flex" pendingLabel="Tomando…" submitLabel="Tomar control" variant="primary">
          {hidden}
        </ActionForm>
      ) : null}

      {hasAiAgent && responderState !== "IA_ACTIVA" ? (
        <ActionForm action={handBackToAgent} className="flex" pendingLabel="Devolviendo…" submitLabel="Devolver al asistente" variant="secondary">
          {hidden}
        </ActionForm>
      ) : null}

      <details className="chat-reason">
        <summary>Pasar a la cola</summary>
        <div className="chat-reason__panel">
          <ActionForm action={sendToQueue} pendingLabel="Devolviendo…" submitLabel="Devolver a la cola" variant="secondary">
            {hidden}
            <label className="ui-field">
              <span className="ui-field__label">¿Por qué la devuelves?</span>
              <input className="ui-control" name="reason" placeholder="Ej.: es de otra zona" required />
            </label>
          </ActionForm>
        </div>
      </details>

      {canManage(role) && others.length > 0 ? (
        <details className="chat-reason">
          <summary>Transferir a…</summary>
          <div className="chat-reason__panel">
            <ActionForm action={transfer} pendingLabel="Transfiriendo…" submitLabel="Transferir" variant="secondary">
              {hidden}
              <label className="ui-field">
                <span className="ui-field__label">Quién la atiende ahora</span>
                <select className="ui-control ui-control--select" name="toUserId" required>
                  {others.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                      {member.available ? "" : " (no disponible)"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Motivo</span>
                <input className="ui-control" name="reason" placeholder="Ej.: lleva el caso desde ayer" required />
              </label>
            </ActionForm>
          </div>
        </details>
      ) : null}

      <details className="chat-reason">
        <summary>Cerrar</summary>
        <div className="chat-reason__panel">
          <ActionForm action={closeConversation} pendingLabel="Cerrando…" submitLabel="Cerrar conversación" variant="danger">
            {hidden}
            <label className="ui-field">
              <span className="ui-field__label">Cómo terminó (opcional)</span>
              <input className="ui-control" name="reason" placeholder="Ej.: quedó en avisarnos" />
            </label>
            <p className="chat-hint">Sale de «Mías». Si la persona vuelve a escribir, se reabre sola.</p>
          </ActionForm>
        </div>
      </details>
    </div>
  );
}
