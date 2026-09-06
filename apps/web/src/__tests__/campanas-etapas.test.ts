import { describe, expect, it } from "vitest";

import {
  campaignStageHrefs,
  campaignStageLabels,
} from "@/features/recovery/campaign-stage-labels";

/**
 * SPEC-045 PL-03: cada población de la campaña tiene un solo nombre y abre
 * la etapa donde se trabaja.
 */
describe("Etapas de la campaña", () => {
  it("verificados y disponibles no se confunden y cada uno abre su etapa", () => {
    expect(campaignStageLabels.verified).toBe("Verificados por entregar");
    expect(campaignStageLabels.open).toBe("Disponibles para asignar");
    expect(campaignStageLabels.verified).not.toBe(campaignStageLabels.open);
    expect(campaignStageHrefs.verified).toBe("/recovery/triage?view=listos");
    expect(campaignStageHrefs.open).toBe("/recovery/distribute?view=open");
    expect(campaignStageHrefs.unverified).toBe(
      "/recovery/triage?view=pendientes",
    );
  });

  it("ningún nombre se repite entre poblaciones", () => {
    const labels = Object.values(campaignStageLabels);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
