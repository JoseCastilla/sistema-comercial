"use client";

import { CopyValue } from "./copy-value";

/**
 * El número al que llamar, a la vista (SPEC-063 fase 6, SPEC-065 BR-003): la
 * acción es llamar. En el celular un toque llama; en la computadora un clic
 * lo copia para el teléfono o el marcador.
 */
export function PhoneNumber({ phone }: { phone: string }) {
  return (
    <>
      <a
        className="font-mono text-sm font-semibold text-ui-accent sm:hidden"
        href={`tel:${phone}`}
      >
        {phone}
      </a>
      <span className="hidden sm:inline">
        <CopyValue label="Teléfono" value={phone} />
      </span>
    </>
  );
}
