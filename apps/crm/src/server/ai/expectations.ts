import { z } from "zod";

/**
 * Qué se espera de un caso de prueba y cómo se decide si pasó
 * (SPEC-058 BR-016). Función pura: recibe lo que hizo el agente en el caso y
 * devuelve el veredicto con el motivo escrito para que se lea en pantalla.
 */

export const expectationsSchema = z.object({
  /** Herramienta que tiene que haber llamado. */
  mustCallTool: z.string().trim().max(60).optional(),
  /** Herramienta que no puede haber llamado. */
  mustNotCallTool: z.string().trim().max(60).optional(),
  /** Textos que la respuesta debe contener. */
  mustContain: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
  /** Textos que la respuesta no puede contener (por ejemplo «S/»). */
  mustNotContain: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
  /** Tiene que haber derivado a un asesor. */
  mustHandoff: z.boolean().optional(),
});

export type Expectations = z.infer<typeof expectationsSchema>;

export function parseExpectations(value: unknown): Expectations {
  const parsed = expectationsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export interface TestOutcome {
  /** Todo lo que respondió el agente en el caso, concatenado. */
  text: string;
  /** Nombres de las herramientas que llamó, en orden. */
  toolNames: string[];
  handoff: boolean;
}

export interface Verdict {
  passed: boolean;
  /** Motivos del fallo, en lenguaje directo. Vacío si pasó. */
  problems: string[];
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function contains(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

export function evaluateExpectations(outcome: TestOutcome, expectations: Expectations): Verdict {
  const problems: string[] = [];
  if (expectations.mustCallTool && !outcome.toolNames.includes(expectations.mustCallTool)) {
    problems.push(`No usó «${expectations.mustCallTool}».`);
  }
  if (expectations.mustNotCallTool && outcome.toolNames.includes(expectations.mustNotCallTool)) {
    problems.push(`Usó «${expectations.mustNotCallTool}» y no debía.`);
  }
  for (const needle of expectations.mustContain ?? []) {
    if (!contains(outcome.text, needle)) problems.push(`No dijo «${needle}».`);
  }
  for (const needle of expectations.mustNotContain ?? []) {
    if (contains(outcome.text, needle)) problems.push(`Dijo «${needle}» y no debía.`);
  }
  if (expectations.mustHandoff === true && !outcome.handoff) problems.push("No derivó a un asesor.");
  if (expectations.mustHandoff === false && outcome.handoff) problems.push("Derivó a un asesor y no debía.");
  return { passed: problems.length === 0, problems };
}

/** Resumen de una corrida, para guardarlo en `AiAgentVersion.testSummary`. */
export interface TestSummary {
  runId: string;
  ranAt: string;
  total: number;
  passed: number;
  failed: number;
  criticalFailed: number;
  costUsd: number;
  cases: { id: string; name: string; critical: boolean; passed: boolean; problems: string[] }[];
}
