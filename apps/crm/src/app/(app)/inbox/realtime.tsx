"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Tiempo real de la bandeja (SPEC-054 BR-021). Un evento del canal vuelve a
 * pedir la página (con un pequeño margen para agrupar ráfagas). Con la pestaña
 * oculta, el título muestra cuántos mensajes llegaron y, si el navegador lo
 * permite, avisa con una notificación.
 */
const REFRESH_DEBOUNCE_MS = 300;

interface ConversationChange {
  conversationId: string;
  reason: string;
  contactName?: string;
  preview?: string | null;
}

export function InboxRealtime() {
  const router = useRouter();

  useEffect(() => {
    const baseTitle = document.title.replace(/^\(\d+\)\s*/, "");
    let hiddenCount = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingWhileHidden = false;

    const scheduleRefresh = () => {
      if (document.visibilityState !== "visible") {
        pendingWhileHidden = true;
        return;
      }
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const notify = (change: ConversationChange) => {
      if (document.visibilityState === "visible") return;
      hiddenCount += 1;
      document.title = `(${hiddenCount}) ${baseTitle}`;
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          const notification = new Notification(change.contactName ?? "Mensaje nuevo", { body: change.preview ?? "Te escribieron por WhatsApp", tag: change.conversationId });
          notification.onclick = () => {
            window.focus();
            window.location.assign(`/inbox/${change.conversationId}`);
          };
        } catch {
          // Algunos navegadores bloquean notificaciones sin gesto del usuario.
        }
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      hiddenCount = 0;
      document.title = baseTitle;
      if (pendingWhileHidden) {
        pendingWhileHidden = false;
        scheduleRefresh();
      }
    };

    const source = new EventSource("/api/events/stream");
    source.addEventListener("conversation", (event) => {
      let change: ConversationChange | null = null;
      try {
        change = JSON.parse((event as MessageEvent<string>).data) as ConversationChange;
      } catch {
        change = null;
      }
      if (change?.reason === "inbound") notify(change);
      scheduleRefresh();
    });
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      source.close();
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimer) clearTimeout(refreshTimer);
      document.title = baseTitle;
    };
  }, [router]);

  return null;
}

/** Botón discreto para pedir permiso de notificaciones; desaparece cuando ya se decidió. */
export function NotificationPermissionButton() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  if (permission !== "default") return null;
  return (
    <button
      className="ui-button ui-button--quiet inbox-quiet-button"
      onClick={() => void Notification.requestPermission().then(setPermission)}
      title="Avisar con una notificación cuando llegue un mensaje y esta pestaña no esté a la vista"
      type="button"
    >
      Activar avisos
    </button>
  );
}
