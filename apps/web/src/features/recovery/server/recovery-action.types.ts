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
