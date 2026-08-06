export interface ResolveOrderAssignmentActionState {
  type: "idle" | "success" | "error" | "conflict";
  message: string;
}
