export interface TeamActionState {
  type: "idle" | "success" | "error";
  message: string;
  fieldErrors?: {
    name?: string;
    code?: string;
    teamId?: string;
    userId?: string;
    memberRole?: string;
  };
}
