import {
  parsePortabilityReportText,
  type ParsedPortabilityReport,
  type ParsedPortabilityRow,
  type RecoveryPortabilityReportKind,
} from '@repo/validation';

export type {
  ParsedPortabilityReport,
  ParsedPortabilityRow,
  RecoveryPortabilityReportKind,
};

/**
 * Adaptador de plataforma: convierte los bytes subidos a texto y delega en
 * la regla pura de `@repo/validation` (BR-018, BR-018b, BR-018c), donde
 * viven la detección de formato y sus pruebas con los archivos reales.
 */
export function parsePortabilityReport(
  buffer: Buffer,
  options: { quickColumn?: string | null } = {},
): ParsedPortabilityReport {
  return parsePortabilityReportText(buffer.toString('utf8'), options);
}
