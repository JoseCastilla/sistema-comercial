import Link from "next/link";

export type AdvisorCampaignSurface = "cola" | "agenda";

const surfaces: ReadonlyArray<{
  key: AdvisorCampaignSurface;
  label: string;
  href: string;
}> = [
  { key: "cola", label: "Mi cola", href: "/recovery/campaigns" },
  { key: "agenda", label: "Mi agenda", href: "/recovery/agenda" },
];

/**
 * El carril del asesor en Campañas — SPEC-048 §3. Su cola y su agenda son
 * dos lecturas del mismo trabajo (una por prioridad, otra por tiempo), así
 * que van en la misma barra, igual que los pasos de la supervisión en
 * `CampaignNav`.
 */
export function AdvisorCampaignNav({
  current,
}: {
  current: AdvisorCampaignSurface;
}) {
  return (
    <nav aria-label="Mi trabajo de campaña" className="ui-segmented-scroll">
      <div className="ui-segmented">
        {surfaces.map((surface) => (
          <Link
            aria-current={surface.key === current ? "page" : undefined}
            className="ui-segmented__item"
            href={surface.href}
            key={surface.key}
          >
            {surface.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
