import Link from "next/link";
import { notFound } from "next/navigation";

import { CommercialAppShell } from "@/components/layout/commercial-app-shell";
import { CopyValue } from "@/features/recovery/components/copy-value";
import { RegisterAttemptForm } from "@/features/recovery/components/register-attempt-form";
import { ResolveCaseForm } from "@/features/recovery/components/resolve-case-form";
import { RevealSensitiveForm } from "@/features/recovery/components/reveal-sensitive-form";
import { getCampaignCase } from "@/features/recovery/server/get-campaign-case";
import { requireCommercialAccess } from "@/server/auth/access";

import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import { SignOutButton } from "@/app/orders/sign-out-button";

const attemptResultLabels: Record<string, string> = {
  SIN_RESPUESTA: "Sin respuesta",
  INTERESADO: "Interesado",
  RECHAZA: "Rechaza",
  AGENDA: "Agenda",
  NUMERO_ERRADO: "Número errado",
  NO_CUMPLE_30D: "No cumple 30 días",
  YA_ACTIVO: "Ya activo",
  DATOS_INVALIDOS: "Datos inválidos",
  VENDIDO: "Vendido",
};

const portabilityLabels: Record<string, string> = {
  PORTADO: "Portado",
  NO_PORTADO: "No portado",
  PROGRAMADO: "Programado",
  DESCONOCIDO: "Sin consulta",
};

export default async function CampaignCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { session, membership } = await requireCommercialAccess();
  const { caseId } = await params;

  const detail = await getCampaignCase(
    membership.organization.id,
    {
      userId: session.user.id,
      role: membership.role as "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE",
    },
    caseId,
  );

  if (!detail) {
    notFound();
  }

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
          title={detail.holderName}
          description={`Caso de base nacional · ${detail.teamName ?? "sin equipo"} · visto por última vez el ${detail.lastSightingLabel}${
            detail.sightingCount > 1
              ? ` · ${detail.sightingCount} apariciones`
              : ""
          }`}
        />

        <p className="text-sm">
          <Link
            className="text-ui-accent underline-offset-2 hover:underline"
            href="/recovery/campaigns"
          >
            ← Volver a mi cola
          </Link>
        </p>

        {detail.isResolved ? (
          <SectionPanel title="Caso resuelto" description={detail.resolutionLabel ?? ""}>
            <p className="text-sm text-ui-muted">
              El historial queda como evidencia; un caso resuelto no se reabre.
            </p>
          </SectionPanel>
        ) : null}

        {detail.resolutionDue && !detail.isResolved ? (
          <SectionPanel
            title="Resolución obligatoria"
            description="Séptimo día de gestión sin venta ni agenda vigente: resuelve o agenda con fecha concreta hoy."
          >
            <p className="text-sm text-ui-danger">
              Si no actúas hoy, el caso escala a tu supervisor.
            </p>
          </SectionPanel>
        ) : null}

        <SectionPanel
          title="Cliente y líneas"
          description={`Responsable: ${detail.assignedToName ?? "sin asignar"}${
            detail.claimedAtLabel ? ` · asignado el ${detail.claimedAtLabel}` : ""
          }`}
        >
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <span>
              DNI: <CopyValue label="DNI" value={detail.documentNumber} />
            </span>
            <span className="text-ui-muted">
              Departamento: {detail.department ?? "—"}
            </span>
            <span className="text-ui-muted">
              Intentos hoy: {detail.attemptsToday} /{" "}
              {detail.minimumDailyAttempts}
            </span>
            {detail.nextActionAtLabel ? (
              <span
                className={
                  detail.nextActionOverdue
                    ? "font-semibold text-ui-danger"
                    : "text-ui-muted"
                }
              >
                Próxima acción: {detail.nextActionAtLabel}
              </span>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-ui-border">
            <table className="min-w-full divide-y divide-ui-border text-sm">
              <thead className="bg-ui-surface-muted text-left text-xs uppercase tracking-wide text-ui-muted">
                <tr>
                  <th className="px-3 py-2">Línea a portar</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Cedente</th>
                  <th className="px-3 py-2">Portabilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border bg-ui-surface">
                {detail.services.map((service) => (
                  <tr
                    className={service.discarded ? "opacity-50" : undefined}
                    key={service.serviceNumber}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      <CopyValue
                        label="Línea"
                        value={service.serviceNumber}
                      />
                      {service.isPlantLine ? (
                        <span className="ml-2 text-[11px] text-ui-muted">
                          planta
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-ui-muted">
                      {service.planRaw ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {service.carrierRaw ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-ui-muted">
                      {service.discarded
                        ? "Descartada"
                        : (portabilityLabels[service.portabilityState ?? ""] ??
                          "Sin consulta")}
                      {service.portabilityEligibleLabel
                        ? ` · habilitada el ${service.portabilityEligibleLabel}`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {detail.contactPhones.length > 0 ? (
            <p className="text-sm text-ui-muted">
              Teléfonos de contacto:{" "}
              {detail.contactPhones.map((phone, index) => (
                <span key={phone}>
                  {index > 0 ? " · " : ""}
                  <CopyValue label="Teléfono" value={phone} />
                </span>
              ))}
            </p>
          ) : null}
        </SectionPanel>

        {detail.sensitive.requiresValidation ? (
          <SectionPanel
            title="Validación de identidad"
            description="Datos sensibles del titular: se revelan solo al asesor asignado y tras un intento con resultado INTERESADO."
          >
            {detail.sensitive.revealed ? (
              <div className="space-y-1 text-sm">
                <p>Padre: {detail.sensitive.fatherName ?? "—"}</p>
                <p>Madre: {detail.sensitive.motherName ?? "—"}</p>
                <p>Nacimiento: {detail.sensitive.birthPlace ?? "—"}</p>
                <p className="text-xs text-ui-muted">
                  Revelados el {detail.sensitive.revealedAtLabel}.
                </p>
              </div>
            ) : detail.sensitive.canReveal ? (
              <RevealSensitiveForm caseId={detail.id} />
            ) : (
              <p className="text-sm text-ui-muted">
                {detail.sensitive.revealMissing ??
                  "Los datos permanecen ocultos en este caso."}
              </p>
            )}
          </SectionPanel>
        ) : null}

        {detail.canManage && !detail.isResolved ? (
          <SectionPanel
            title="Registrar intento"
            description="El intento es inmutable. Sin respuesta exige tres intentos en el día; una agenda suspende la cadencia hasta la fecha acordada."
          >
            <RegisterAttemptForm caseId={detail.id} />
          </SectionPanel>
        ) : null}

        <SectionPanel
          title="Historial de intentos"
          description={`${detail.attempts.length} intento(s) registrados.`}
        >
          {detail.attempts.length === 0 ? (
            <p className="text-sm text-ui-muted">
              Todavía no hay gestión sobre este caso.
            </p>
          ) : (
            <ul className="space-y-2">
              {detail.attempts.map((attempt) => (
                <li
                  className="rounded-xl border border-ui-border p-3 text-sm"
                  key={attempt.id}
                >
                  <p className="font-medium text-ui-text">
                    {attemptResultLabels[attempt.result] ?? attempt.result}
                    <span className="ml-2 text-xs font-normal text-ui-muted">
                      {attempt.channel} · {attempt.createdAtLabel} ·{" "}
                      {attempt.actorName}
                      {attempt.phoneUsed ? ` · ${attempt.phoneUsed}` : ""}
                    </span>
                  </p>
                  {attempt.observation ? (
                    <p className="mt-1 text-xs text-ui-muted">
                      {attempt.observation}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>

        {detail.canManage && !detail.isResolved ? (
          <SectionPanel
            title="Resolver el caso"
            description="Recuperado exige vincular la orden DITO nueva; perdido exige motivo estructurado con su criterio cumplido."
          >
            <ResolveCaseForm
              canUseOther={detail.canResolveOther}
              caseId={detail.id}
              gates={detail.lossReasonGates}
              suggestions={detail.recoveredOrderSuggestions}
            />
          </SectionPanel>
        ) : null}
      </div>
    </CommercialAppShell>
  );
}
