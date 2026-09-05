export interface RecoveryPreviewActionState {
  type: "idle" | "error";
  message: string;
}

export interface RecoveryAdminActionState {
  type: "idle" | "success" | "error" | "conflict";
  message: string;
}

export interface RecoveryTriageActionState {
  type: "idle" | "success" | "error";
  message: string;
}

export interface SendOrderToRecoveryActionState {
  type: "idle" | "success" | "error";
  message: string;
}

/**
 * Estado de la gestión registrada desde la bandeja (BR-090). Trae los datos
 * confirmados por el servidor para que la fila se actualice con ellos y no
 * con lo que el asesor escribió: lo que vale es lo que quedó guardado.
 */
export interface CampaignAttemptInlineState {
  type: "idle" | "success" | "error";
  message: string;
  /** Consecuencia operativa del resultado, si la hay. */
  detail?: string;
  /** El caso dejó de ser gestionable por quien lo intenta. */
  unmanageable?: boolean;
  attempt?: {
    result: string;
    observation: string | null;
    phoneUsed: string | null;
    status: string;
    attemptsToday: number | null;
    nextActionAtLabel: string | null;
    mustResolve: boolean;
  };
}
