"use client";

import { useEffect, useState } from "react";

import { markRead } from "@/server/inbox/actions";
import { windowTone } from "@/server/inbox/rules";
import { describeWindow } from "@/server/messaging/windows";

/** Abrir una conversación es leerla: se pone el contador en cero al montar. */
export function MarkReadOnOpen({ conversationId, unreadCount }: { conversationId: string; unreadCount: number }) {
  useEffect(() => {
    if (unreadCount <= 0) return;
    const formData = new FormData();
    formData.set("conversationId", conversationId);
    void markRead({}, formData);
  }, [conversationId, unreadCount]);
  return null;
}

/**
 * Estado de la ventana de 24 h. El texto inicial llega calculado del servidor
 * (misma marca en la hidratación) y desde ahí se recalcula cada 30 segundos
 * para que el contador de la última hora no mienta.
 */
export function WindowBar({
  initialText,
  initialTone,
  lastInboundAt,
  freeUntil,
}: {
  initialText: string;
  initialTone: "neutral" | "warning" | "danger";
  lastInboundAt: string | null;
  freeUntil: string | null;
}) {
  const [bar, setBar] = useState({ text: initialText, tone: initialTone });

  useEffect(() => {
    const inbound = lastInboundAt ? new Date(lastInboundAt) : null;
    const free = freeUntil ? new Date(freeUntil) : null;
    const tick = () => {
      const now = new Date();
      setBar({ text: describeWindow(inbound, free, now), tone: windowTone(inbound, now) });
    };
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [lastInboundAt, freeUntil]);

  return (
    <p className="chat-window-bar" data-tone={bar.tone}>
      <span>{bar.text}</span>
    </p>
  );
}

/** Muestra u oculta la ficha del cliente en pantallas donde no cabe siempre. */
export function AsideToggle() {
  return (
    <button
      className="ui-button ui-button--secondary inbox-aside-toggle"
      onClick={() => {
        const aside = document.getElementById("inbox-aside");
        if (aside) aside.dataset.open = aside.dataset.open === "true" ? "false" : "true";
      }}
      type="button"
    >
      Ficha
    </button>
  );
}

export function AsideClose() {
  return (
    <button
      className="ui-button ui-button--quiet inbox-aside__close"
      onClick={() => {
        const aside = document.getElementById("inbox-aside");
        if (aside) aside.dataset.open = "false";
      }}
      type="button"
    >
      Cerrar
    </button>
  );
}
