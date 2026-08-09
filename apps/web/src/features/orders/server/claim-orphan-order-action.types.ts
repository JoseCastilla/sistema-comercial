export interface ClaimOrphanOrderActionState {
  type: "idle" | "success" | "error" | "conflict";
  message: string;
  fieldErrors?: {
    teamId?: string;
    agentUserId?: string;
    reason?: string;
    observation?: string;
  };
}
