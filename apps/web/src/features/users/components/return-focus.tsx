"use client";

import { useEffect } from "react";

/**
 * Al cerrar el panel de una persona, el foco vuelve a su fila (SPEC-043
 * UX-02). El enlace de cierre lleva `#persona-<id>` o `#equipo-<id>`; aquí se enfoca ese
 * elemento una vez montada la lista, para que quien navega con teclado siga
 * donde estaba y no arriba de la página.
 */
export function ReturnFocus() {
  useEffect(() => {
    if (window.location.hash.length < 2) return;

    const target = document.getElementById(window.location.hash.slice(1));

    if (!(target instanceof HTMLElement)) return;

    target.focus({ preventScroll: false });
  }, []);

  return null;
}
