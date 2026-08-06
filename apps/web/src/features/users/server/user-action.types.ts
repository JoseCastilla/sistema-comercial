export interface CreateUserActionState {
  type: "idle" | "success" | "error";

  message: string;

  fieldErrors?: {
    name?: string;
    email?: string;
    role?: string;
    password?: string;
  };
}
export interface ResetUserPasswordActionState {
  type: "idle" | "success" | "error";

  message: string;

  fieldErrors?: {
    newPassword?: string;
    confirmPassword?: string;
  };
}
export interface AssignAgentAliasActionState {
  type: "idle" | "success" | "error";

  message: string;

  fieldErrors?: {
    alias?: string;
  };
}
