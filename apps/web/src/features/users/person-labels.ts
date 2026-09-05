/** Rótulos compartidos por el directorio y el panel de la persona (SPEC-043). */
export const personRoleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  BACKOFFICE: "Back office",
  AGENT: "Asesor",
};

export const personStatusLabels: Record<string, string> = {
  ACTIVE: "Activo",
  INVITED: "Invitado",
  DISABLED: "Deshabilitado",
};

export const personStatusTones: Record<
  string,
  "success" | "warning" | "neutral"
> = {
  ACTIVE: "success",
  INVITED: "warning",
  DISABLED: "neutral",
};
