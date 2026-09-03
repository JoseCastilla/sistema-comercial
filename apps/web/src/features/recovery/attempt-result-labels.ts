/**
 * Rótulos en español para el resultado de un intento de recuperación.
 *
 * Los valores persistidos siguen siendo el enum crudo; esto es solo para
 * mostrar. Vivían duplicados en tres pantallas —la ficha de campaña, la ficha
 * de recupero de ventas y el formulario de registro— así que un rótulo podía
 * cambiar en una y quedar viejo en las otras dos.
 */
export const attemptResultLabels: Record<string, string> = {
  SIN_RESPUESTA: "No contesta",
  INTERESADO: "Interesado",
  INTERESADO_CON_PEDIDO: "Interesado · tiene pedido en curso",
  RECHAZA: "No interesado",
  AGENDA: "Agenda una próxima llamada",
  CANCELADO: "Cancelado",
  NUMERO_ERRADO: "Número errado",
  NO_CUMPLE_30D: "No cumple los 30 días de porta",
  YA_ACTIVO: "Ya está activo en Movistar",
  DATOS_INVALIDOS: "Datos inválidos",
  VENDIDO: "Vendido: aceptó de nuevo",
};

/**
 * Rótulo con la consecuencia operativa, para el desplegable donde el asesor
 * elige qué pasó: ahí sí importa saber que la cadencia se pausa.
 */
export const attemptResultChoiceLabels: Record<string, string> = {
  ...attemptResultLabels,
  RECHAZA: "No interesado (pausa 1–2 días)",
  CANCELADO: "Cancelado (pausa 1–2 días)",
  YA_ACTIVO: "Ya está activo en Movistar (pasa a verificación)",
};

/**
 * Tono con el que se pinta la fila una vez registrado el resultado, para que
 * el asesor reconozca de un vistazo en qué quedó cada caso de su cola.
 */
export const attemptResultTones: Record<
  string,
  "success" | "warning" | "danger" | "info" | "neutral"
> = {
  VENDIDO: "success",
  INTERESADO: "success",
  INTERESADO_CON_PEDIDO: "info",
  AGENDA: "info",
  SIN_RESPUESTA: "warning",
  NO_CUMPLE_30D: "warning",
  YA_ACTIVO: "warning",
  RECHAZA: "danger",
  CANCELADO: "danger",
  NUMERO_ERRADO: "danger",
  DATOS_INVALIDOS: "danger",
};
