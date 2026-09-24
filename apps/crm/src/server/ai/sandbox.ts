/**
 * Contexto ficticio del simulador y de las pruebas (SPEC-058 BR-018).
 *
 * Vive en memoria y viaja entre el navegador y el servidor en cada turno del
 * simulador: nada de esto toca fichas reales. Módulo puro para que también lo
 * pueda tipar el componente de cliente.
 */
export interface SandboxState {
  contact: { nombre: string | null; dni: string | null; operador: string | null; distrito: string | null; etiquetas: string[] };
  lineas: number | null;
  planInteres: string | null;
  etapa: string;
  citaIso: string | null;
  bajaMarketing: boolean;
  handoff: { resumen: string; motivo: string } | null;
}

/** Lo que devuelve un turno del simulador al navegador. */
export interface SimulationResult {
  ok: boolean;
  error?: string;
  text?: string;
  toolCalls?: { name: string; result: string; isError: boolean }[];
  costUsd?: number;
  handoff?: boolean;
  state?: SandboxState;
}

export function emptySandboxState(): SandboxState {
  return {
    contact: { nombre: null, dni: null, operador: null, distrito: null, etiquetas: [] },
    lineas: null,
    planInteres: null,
    etapa: "NUEVO",
    citaIso: null,
    bajaMarketing: false,
    handoff: null,
  };
}
