import { distributeCasesEquitably } from "@repo/validation";

/**
 * SPEC-045 PL-04 (BR-006): antes de confirmar un reparto, quién recibiría
 * cuánto y con qué carga quedaría. Usa la misma regla que aplica el servidor
 * (`distributeCasesEquitably`: rotación empezando por quien menos abiertos
 * tiene), así la vista previa y el resultado coinciden. Solo informa: no
 * reasigna nada por ver una carga alta.
 */
export interface LoadParticipant {
  id: string;
  name: string;
  openCases: number;
  unworkedCases: number;
  overdueCases: number;
}

export interface LoadPreviewRow extends LoadParticipant {
  receives: number;
  resulting: number;
}

export function previewEquitableLoad(
  selectedCount: number,
  participants: readonly LoadParticipant[],
): LoadPreviewRow[] {
  if (participants.length === 0) return [];

  const orderedCaseIds = Array.from(
    { length: Math.max(0, selectedCount) },
    (_, index) => `caso-${index}`,
  );
  const assignments = distributeCasesEquitably({
    orderedCaseIds,
    advisors: participants.map((participant) => ({
      userId: participant.id,
      openCases: participant.openCases,
    })),
  });
  const received = new Map<string, number>();
  for (const assignment of assignments) {
    received.set(assignment.userId, (received.get(assignment.userId) ?? 0) + 1);
  }

  return participants.map((participant) => {
    const receives = received.get(participant.id) ?? 0;
    return {
      ...participant,
      receives,
      resulting: participant.openCases + receives,
    };
  });
}

/** Carga de una sola persona si recibiera todo lo seleccionado. */
export function previewDirectLoad(
  selectedCount: number,
  participant: LoadParticipant,
): LoadPreviewRow {
  const receives = Math.max(0, selectedCount);
  return {
    ...participant,
    receives,
    resulting: participant.openCases + receives,
  };
}
