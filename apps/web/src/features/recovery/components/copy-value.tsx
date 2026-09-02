"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Valor que se copia al portapapeles con un clic. Pensado para el DNI en el
 * triage: el chequeo manual exige pegarlo en otro sistema, así que copiar no
 * puede costar más que un clic.
 */
export function CopyValue({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  async function copy(event: React.MouseEvent) {
    // La fila entera selecciona al cliente; copiar el dato no debe además
    // marcarlo.
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }

    setCopied(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-transparent px-1 py-0.5 font-mono text-xs text-ui-text hover:border-ui-border-strong hover:bg-ui-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent"
      onClick={copy}
      title={`Copiar ${label ?? "valor"}`}
      type="button"
    >
      {value}
      <span aria-live="polite" className="text-[10px] text-ui-muted">
        {copied ? "✓ copiado" : "⧉"}
      </span>
    </button>
  );
}
