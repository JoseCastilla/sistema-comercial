export interface DitoImportPreviewActionState {
  type: "idle" | "error";
  message: string;
}

export interface DitoImportAdminActionState {
  type: "idle" | "success" | "error" | "conflict";
  message: string;
}
