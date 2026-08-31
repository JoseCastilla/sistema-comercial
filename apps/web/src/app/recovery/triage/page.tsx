import { redirect } from "next/navigation";

import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import {
  RecoveryTriageForm,
  type RecoveryTriageRow,
  type RecoveryTriageTeamOption,
} from "@/features/recovery/components/recovery-triage-form";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import { SignOutButton } from "@/app/orders/sign-out-button";

const triageRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  dateStyle: "short",
  timeStyle: "short",
});

function summarizePlan(planRaw: string | null): string {
  if (!planRaw) return "—";

  const match = planRaw.match(/S\/\s?\d+(?:\.\d+)?/);

  return match ? `Máximo ${match[0]}` : planRaw;
}

export default async function RecoveryTriagePage() {
  const { session, membership } = await requireCommercialAccess();

  if (!triageRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const isSupervisor = membership.role === "SUPERVISOR";

  /**
   * BR-022b/BR-029: un supervisor solo ve el triage de la base que le fue
   * entregada — los casos asignados a sus equipos. ADMIN y BACKOFFICE ven la
   * organización completa y son quienes reparten bloques entre equipos.
   */
  const supervisedTeamIds = isSupervisor
    ? (
        await database.commercialTeamMember.findMany({
          where: {
            organizationId: membership.organization.id,
            userId: session.user.id,
            memberRole: "SUPERVISOR",
            isActive: true,
            team: { status: "ACTIVE" },
          },
          select: { teamId: true },
        })
      ).map((item) => item.teamId)
    : null;

  const caseScope = {
    organizationId: membership.organization.id,
    status: { in: ["TRIAGE", "WAITING"] as ("TRIAGE" | "WAITING")[] },
    ...(supervisedTeamIds ? { assignedTeamId: { in: supervisedTeamIds } } : {}),
  };

  const [cases, teams] = await Promise.all([
    database.recoveryCase.findMany({
      where: caseScope,
      orderBy: [{ status: "asc" }, { lastSightingAt: "desc" }],
      take: 500,
      select: {
        id: true,
        holderName: true,
        documentNumber: true,
        status: true,
        lastSightingAt: true,
        assignedTeam: { select: { name: true } },
        services: {
          select: { serviceNumber: true, planRaw: true, carrierRaw: true },
        },
        _count: { select: { sightings: true } },
      },
    }),
    isSupervisor
      ? Promise.resolve([])
      : database.commercialTeam.findMany({
          where: {
            organizationId: membership.organization.id,
            status: "ACTIVE",
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
  ]);

  const rows: RecoveryTriageRow[] = cases.map((recoveryCase) => ({
    id: recoveryCase.id,
    holderName: recoveryCase.holderName,
    documentNumber: recoveryCase.documentNumber,
    status: recoveryCase.status === "WAITING" ? "WAITING" : "TRIAGE",
    serviceNumbers: recoveryCase.services.map(
      (service) => service.serviceNumber,
    ),
    planSummary: summarizePlan(recoveryCase.services[0]?.planRaw ?? null),
    carrierSummary: [
      ...new Set(
        recoveryCase.services
          .map((service) => service.carrierRaw)
          .filter((value): value is string => value !== null),
      ),
    ].join(", "),
    teamName: recoveryCase.assignedTeam?.name ?? null,
    lastSightingLabel: dateTimeFormatter.format(recoveryCase.lastSightingAt),
    sightingCount: recoveryCase._count.sightings,
  }));

  const teamOptions: RecoveryTriageTeamOption[] = teams;
  const triageTotal = rows.filter((row) => row.status === "TRIAGE").length;
  const waitingTotal = rows.filter((row) => row.status === "WAITING").length;

  return (
    <CommercialAppShell
      activeSection="recovery"
      organizationName={membership.organization.name}
      role={membership.role}
      signOut={<SignOutButton />}
      userName={session.user.name}
    >
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="Campañas"
          title={isSupervisor ? "Triage de mi bloque" : "Triage de campaña"}
          description={
            isSupervisor
              ? "Esta es la base entregada a tus equipos. Marca en lote el resultado del chequeo manual: con pedido en curso a espera, sin pedido a la cola de asignación."
              : "Reparte bloques a los equipos o marca en lote el resultado del chequeo manual. El DNI se copia con un clic para pegarlo en el sistema de consulta."
          }
        />

        <MetricGroup>
          <Metric label="Por revisar" value={triageTotal} />
          <Metric label="En espera" value={waitingTotal} />
        </MetricGroup>

        <SectionPanel
          title="Casos pendientes"
          description="Se muestran hasta 500 casos, primero los del último lote. La selección admite rango con Shift y selección por cantidad."
        >
          <RecoveryTriageForm
            canAssignTeams={!isSupervisor}
            rows={rows}
            teams={teamOptions}
          />
        </SectionPanel>
      </div>
    </CommercialAppShell>
  );
}
