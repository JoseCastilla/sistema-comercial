"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Protección de borradores en un panel administrativo — SPEC-043 UX-08.
 *
 * El panel contiene varios formularios (baja, promoción, reingreso,
 * contraseña, asignación). Si alguien escribe en uno y cierra el panel o
 * recarga, lo perdería en silencio. Aquí el panel entero observa sus propios
 * campos: cualquier entrada lo marca sucio, cualquier envío lo limpia, y
 * salir con algo sin guardar pregunta antes. Los formularios no tienen que
 * saber nada de esto.
 */
interface PanelDraftState {
  dirty: boolean;
  confirmLeave: () => boolean;
}

const PanelDraftContext = createContext<PanelDraftState>({
  dirty: false,
  confirmLeave: () => true,
});

const leaveMessage =
  "Tienes cambios sin guardar en este panel. ¿Descartarlos y continuar?";

export function PanelDraftGuard({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;

    if (!element) return;

    const markDirty = () => setDirty(true);
    const markClean = () => setDirty(false);

    element.addEventListener("input", markDirty, true);
    element.addEventListener("submit", markClean, true);

    return () => {
      element.removeEventListener("input", markDirty, true);
      element.removeEventListener("submit", markClean, true);
    };
  }, []);

  // Cerrar la pestaña o recargar con un borrador sucio pide confirmación al
  // navegador: es la única salida que el código no puede interceptar.
  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = leaveMessage;
    };

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const confirmLeave = useCallback(
    () => !dirty || window.confirm(leaveMessage),
    [dirty],
  );

  const value = useMemo<PanelDraftState>(
    () => ({ dirty, confirmLeave }),
    [dirty, confirmLeave],
  );

  return (
    <PanelDraftContext.Provider value={value}>
      <div data-dirty={dirty || undefined} ref={container}>
        {children}
      </div>
    </PanelDraftContext.Provider>
  );
}

/** Enlace que pregunta antes de llevarse un borrador sin guardar. */
export function PanelGuardedLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const { confirmLeave } = useContext(PanelDraftContext);

  return (
    <Link
      className={className}
      href={href}
      onClick={(event) => {
        if (!confirmLeave()) event.preventDefault();
      }}
    >
      {children}
    </Link>
  );
}
