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
