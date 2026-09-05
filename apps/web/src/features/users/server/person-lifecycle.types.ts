export interface PersonLifecycleActionState {
  type: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
}

/** Lo que el formulario anticipa antes de confirmar (SPEC-042 BR-006). */
export interface PersonLifecycleOverview {
  /** Ventas abiertas a su nombre: se quedan con él (BR-004). */
  openOrders: number;
  /** Casos del carril interno asignados: se liberan o se entregan (BR-005). */
  internalCases: number;
  /** Casos de Campañas asignados: vuelven al pool de su equipo. */
  campaignCases: number;
}

export interface PersonLifecycleHistoryItem {
  action: "DISABLED" | "REENTERED" | "PROMOTED";
  label: string;
  reason: string;
  actorName: string;
  createdAtLabel: string;
  /** Resumen legible de lo que la acción tocó, si aplica. */
  summary: string | null;
}
