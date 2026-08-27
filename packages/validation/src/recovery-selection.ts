/**
 * Selección masiva del triage (AC-043): clic normal alterna un elemento; clic
 * con Shift extiende desde el último clic, aplicando a todo el rango el estado
 * del elemento clicado — la semántica de un explorador de archivos.
 */
export interface RangeSelectionInput {
  orderedIds: string[];
  selected: ReadonlySet<string>;
  clickedIndex: number;
  lastClickedIndex: number | null;
  shiftKey: boolean;
}

export interface RangeSelectionResult {
  selected: Set<string>;
  lastClickedIndex: number;
}

export function computeRangeSelection(
  input: RangeSelectionInput,
): RangeSelectionResult {
  const next = new Set(input.selected);
  const clickedId = input.orderedIds[input.clickedIndex];

  if (clickedId === undefined) {
    return {
      selected: next,
      lastClickedIndex: input.lastClickedIndex ?? input.clickedIndex,
    };
  }

  const willSelect = !next.has(clickedId);

  if (input.shiftKey && input.lastClickedIndex !== null) {
    const start = Math.min(input.lastClickedIndex, input.clickedIndex);
    const end = Math.max(input.lastClickedIndex, input.clickedIndex);

    for (let cursor = start; cursor <= end; cursor += 1) {
      const id = input.orderedIds[cursor];

      if (id === undefined) continue;

      if (willSelect) {
        next.add(id);
      } else {
        next.delete(id);
      }
    }
  } else if (willSelect) {
    next.add(clickedId);
  } else {
    next.delete(clickedId);
  }

  return { selected: next, lastClickedIndex: input.clickedIndex };
}
