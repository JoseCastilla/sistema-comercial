/**
 * SPEC-045 PL-01 (BR-005): resumen administrativo de pendientes. Cada
 * pendiente dice qué cuenta, desde cuándo, cuánto hay, quién lo resuelve y
 * dónde se abre. Pedidos, casos internos y casos de campaña van en bloques
 * distintos y nunca se suman entre sí: son poblaciones que se solapan (un
 * pedido caído puede ser también un caso) y un total mentiría.
 */
export interface AdminPendingCounts {
  overdueInternalCases: number;
  criticalUnassignedCases: number;
  campaignUnverified: number;
  campaignVerified: number;
  campaignOpen: number;
  campaignAssignedUnworked: number;
  campaignOverdue: number;
  teamsWithoutSupervisor: number;
  activeAgentsWithoutTeam: number;
  openEscalations: number;
  /** `null` cuando no hay integración con Máximo configurada. */
  logisticsPending: number | null;
}

export interface AdminPendingItem {
  key: string;
  label: string;
  definition: string;
  count: number;
  responsible: string;
  href: string;
}

export interface AdminPendingGroup {
  key: string;
  title: string;
  /** Alcance temporal explícito: «ahora», «este mes», «desde el 10/08». */
  scope: string;
  items: AdminPendingItem[];
}

export function describeAdminPending(
  counts: AdminPendingCounts,
): AdminPendingGroup[] {
  const groups: AdminPendingGroup[] = [
    {
      key: "recupero",
      title: "Recupero de ventas",
      scope: "Casos abiertos ahora, de ventas propias caídas",
      items: [
        {
          key: "overdue-internal",
          label: "Casos vencidos",
          definition:
            "Primer contacto, seguimiento o agenda con la fecha ya pasada.",
          count: counts.overdueInternalCases,
          responsible:
            "El responsable del caso; sin responsable, su supervisor",
          href: "/recovery/sales?vence=vencido",
        },
        {
          key: "critical-unassigned",
          label: "Críticas sin responsable",
          definition:
            "Casos de prioridad crítica que nadie ha tomado; el originador no puede tomarlos.",
          count: counts.criticalUnassignedCases,
          responsible: "El supervisor del equipo de origen",
          href: "/recovery/sales?prioridad=CRITICA&estado=OPEN",
        },
      ],
    },
    {
      key: "campanas",
      title: "Campañas",
      scope: "Casos de la base nacional, ahora",
      items: [
        {
          key: "campaign-unverified",
          label: "Falta consultar",
          definition:
            "Casos con alguna línea sin cruzar portabilidad: no se deben repartir.",
          count: counts.campaignUnverified,
          responsible: "Administración (cruce de portabilidad)",
          href: "/recovery/triage?view=pendientes",
        },
        {
          key: "campaign-verified",
          label: "Verificados por entregar",
          definition: "Ya consultados; falta entregarlos a un equipo.",
          count: counts.campaignVerified,
          responsible: "Administración",
          href: "/recovery/triage?view=listos",
        },
        {
          key: "campaign-open",
          label: "Disponibles para asignar",
          definition: "En la cola de su equipo, sin dueño.",
          count: counts.campaignOpen,
          responsible: "El supervisor de cada equipo",
          href: "/recovery/distribute?view=open",
        },
        {
          key: "campaign-unworked",
          label: "Asignados sin gestión",
          definition:
            "Con dueño y sin ningún intento; a los dos días vuelven solos a la cola.",
          count: counts.campaignAssignedUnworked,
          responsible: "El asesor; a los dos días, su supervisor",
          href: "/recovery/distribute?view=unworked",
        },
        {
          key: "campaign-overdue",
          label: "Próxima acción vencida",
          definition: "Casos en gestión cuya siguiente acción ya pasó.",
          count: counts.campaignOverdue,
          responsible: "El asesor; lo vigila su supervisor",
          href: "/recovery/follow-up?next=vencida",
        },
      ],
    },
    {
      key: "personas",
      title: "Personas y equipos",
      scope: "Situación actual",
      items: [
        {
          key: "teams-without-supervisor",
          label: "Equipos sin supervisor",
          definition:
            "Equipos activos sin supervisor activo: administración cubre su cuota y su recupero.",
          count: counts.teamsWithoutSupervisor,
          responsible: "Administración",
          href: "/admin/teams?sinSupervisor=1",
        },
        {
          key: "agents-without-team",
          label: "Asesores activos sin equipo",
          definition:
            "Asesores activos sin equipo principal con venta habilitada: sus ventas no se atribuyen a ningún equipo.",
          count: counts.activeAgentsWithoutTeam,
          responsible: "Administración",
          href: "/admin/users?situacion=sin-equipo",
        },
        {
          key: "open-escalations",
          label: "Incidencias escaladas abiertas",
          definition:
            "Escalamientos de pedidos que un supervisor aún no atendió.",
          count: counts.openEscalations,
          responsible: "El supervisor del equipo",
          href: "/orders?period=MONTH&status=ESCALATIONS",
        },
      ],
    },
  ];

  if (counts.logisticsPending !== null) {
    groups.push({
      key: "logistica",
      title: "Logística",
      scope: "Acumulado desde el 10/08, no solo la última ejecución",
      items: [
        {
          key: "logistics-pending",
          label: "Pedidos que requieren acción",
          definition:
            "Pedidos con oportunidad logística abierta según Máximo, no cerrados ni entregados.",
          count: counts.logisticsPending,
          responsible: "Logística (BACKOFFICE) y el asesor del pedido",
          href: "/orders?status=LOGISTICS",
        },
      ],
    });
  }

  return groups;
}
