"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Una sola gestión abierta a la vez en la bandeja (BR-090).
 *
 * El borrador vive por encima de las filas porque su dueño no es una fila: es
 * la bandeja entera. Que solo haya una fila en edición, que cambiar de
 * cliente con cambios sin guardar pregunte antes, y que los filtros o la
 * paginación no se lleven el borrador en silencio son la misma regla vista
 * desde tres sitios, y tienen que compartir el mismo estado.
 */
interface CampaignDraftState {
  /** Caso cuya fila está en edición, si hay alguna. */
  editingId: string | null;
  /** El borrador tiene algo que perder. */
  dirty: boolean;
  /**
   * El asesor pidió abrir otro cliente con un borrador sucio. La fila en
   * edición muestra las tres salidas —guardar, descartar, seguir— y no se
   * cambia hasta que elija.
   */
  pendingSwitchId: string | null;
  startEditing: (caseId: string) => void;
  stopEditing: () => void;
  setDirty: (dirty: boolean) => void;
  /** Descarta el borrador y cambia al cliente que estaba esperando. */
  discardAndSwitch: () => void;
  /** Tras guardar con éxito, completa el cambio pendiente si lo había. */
  finishAfterSave: () => void;
  /** Cancela el cambio pendiente: el asesor sigue editando. */
  staySwitching: () => void;
  /**
   * Antes de salir por una navegación de dos vías —filtros, paginación—.
   * Devuelve `true` si se puede continuar.
   */
  confirmLeave: () => boolean;
}

const CampaignDraftContext = createContext<CampaignDraftState | null>(null);

const leaveMessage =
  "Tienes una gestión sin guardar. ¿Descartarla y continuar?";

export function CampaignDraftProvider({ children }: { children: ReactNode }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dirty, setDirtyState] = useState(false);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);

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

  const startEditing = useCallback(
    (caseId: string) => {
      if (editingId === caseId) return;

      if (editingId !== null && dirty) {
        setPendingSwitchId(caseId);
        return;
      }

      setEditingId(caseId);
      setDirtyState(false);
      setPendingSwitchId(null);
    },
    [dirty, editingId],
  );

  const stopEditing = useCallback(() => {
    setEditingId(null);
    setDirtyState(false);
    setPendingSwitchId(null);
  }, []);

  const discardAndSwitch = useCallback(() => {
    setEditingId(pendingSwitchId);
    setDirtyState(false);
    setPendingSwitchId(null);
  }, [pendingSwitchId]);

  const finishAfterSave = useCallback(() => {
    setDirtyState(false);

    if (pendingSwitchId !== null) {
      setEditingId(pendingSwitchId);
      setPendingSwitchId(null);
    }
  }, [pendingSwitchId]);

  const staySwitching = useCallback(() => setPendingSwitchId(null), []);

  const confirmLeave = useCallback(() => {
    if (!dirty) return true;

    const leave = window.confirm(leaveMessage);

    if (leave) stopEditing();

    return leave;
  }, [dirty, stopEditing]);

  const value = useMemo<CampaignDraftState>(
    () => ({
      editingId,
      dirty,
      pendingSwitchId,
      startEditing,
      stopEditing,
      setDirty: setDirtyState,
      discardAndSwitch,
      finishAfterSave,
      staySwitching,
      confirmLeave,
    }),
    [
      editingId,
      dirty,
      pendingSwitchId,
      startEditing,
      stopEditing,
      discardAndSwitch,
      finishAfterSave,
      staySwitching,
      confirmLeave,
    ],
  );

  return (
    <CampaignDraftContext.Provider value={value}>
      {children}
    </CampaignDraftContext.Provider>
  );
}

/**
 * Fuera del proveedor —la ficha, otras colas— no hay borrador que proteger,
 * así que se devuelve un estado inerte en vez de fallar: los componentes
 * compartidos no tienen que saber dónde están montados.
 */
const inertDraft: CampaignDraftState = {
  editingId: null,
  dirty: false,
  pendingSwitchId: null,
  startEditing: () => undefined,
  stopEditing: () => undefined,
  setDirty: () => undefined,
  discardAndSwitch: () => undefined,
  finishAfterSave: () => undefined,
  staySwitching: () => undefined,
  confirmLeave: () => true,
};

export function useCampaignDraft(): CampaignDraftState {
  return useContext(CampaignDraftContext) ?? inertDraft;
}

/**
 * Enlace que pregunta antes de llevarse un borrador sin guardar. Para la
 * paginación de la bandeja, que de otro modo perdería la gestión a medias
 * sin decir nada.
 */
export function GuardedLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const { confirmLeave } = useCampaignDraft();

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
