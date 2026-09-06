/**
 * SPEC-045 PL-03: una sola población, un solo nombre, en las tres etapas que
 * la muestran (Preparar, Revisar, Repartir). Antes «Por revisar» (Preparar)
 * agrupaba verificados y sin consultar, «Listos para repartir» (Revisar) y
 * «Disponible» (Repartir) sonaban a lo mismo sin serlo: los verificados
 * siguen en revisión hasta que alguien los entrega; los disponibles ya están
 * en la cola para asignar.
 */
export const campaignStageLabels = {
  /** TRIAGE con alguna línea sin consultar portabilidad. */
  unverified: "Falta consultar",
  /** TRIAGE con todas las líneas consultadas: pendientes de entregar a un equipo. */
  verified: "Verificados por entregar",
  /** WAITING: su pedido avanza solo. */
  waiting: "Con pedido en curso",
  /** OPEN: en la cola, sin dueño, listos para asignar. */
  open: "Disponibles para asignar",
  /** ASSIGNED sin intentos. */
  assignedUnworked: "Asignados sin gestión",
  /** ASSIGNED con intentos, IN_PROGRESS, SCHEDULED. */
  managed: "En gestión",
  recovered: "Recuperados",
} as const;

export const campaignStageHints = {
  unverified: "Hay que cruzar portabilidad antes de decidir",
  verified: "Revisar y entregar a un equipo desde «Revisar»",
  waiting: "Su pedido avanza solo",
  open: "Sin dueño; se asignan desde «Repartir»",
  assignedUnworked: "Tienen dueño y nadie los ha llamado",
  managed: "Con al menos un intento registrado",
} as const;

/** Cada contador abre la etapa donde esa población se trabaja. */
export const campaignStageHrefs = {
  unverified: "/recovery/triage?view=pendientes",
  verified: "/recovery/triage?view=listos",
  waiting: "/recovery/triage?view=espera",
  open: "/recovery/distribute?view=open",
  assignedUnworked: "/recovery/distribute?view=unworked",
  managed: "/recovery/follow-up",
} as const;
