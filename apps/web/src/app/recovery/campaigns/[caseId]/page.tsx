import Link from "next/link";
import { notFound } from "next/navigation";

import { CopyValue } from "@/features/recovery/components/copy-value";
import { RegisterAttemptForm } from "@/features/recovery/components/register-attempt-form";
import { ResolveCaseForm } from "@/features/recovery/components/resolve-case-form";
import { VerifyReportedForm } from "@/features/recovery/components/verify-reported-form";
import { getCampaignCase } from "@/features/recovery/server/get-campaign-case";
import { requireCommercialAccess } from "@/server/auth/access";

import { formatCount } from "@repo/ui/format";
import { attemptResultLabels } from "@/features/recovery/attempt-result-labels";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

const portabilityLabels: Record<string, string> = {
  PORTADO: "Portado",
  NO_PORTADO: "No portado",
  PROGRAMADO: "Programado",
  DESCONOCIDO: "Aún no consultada",
};

const channelLabels: Record<string, string> = {
  LLAMADA: "Llamada",
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  PRESENCIAL: "Presencial",
  OTRO: "Otro",
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
    <>
      <div className="ui-page-stack">
        <PageHeader
          eyebrow="Campañas"
          title={detail.holderName}
          description={`Caso de base nacional · ${detail.teamName ?? "sin equipo"} · ${
            detail.sightingCount > 1
              ? `apareció ${detail.sightingCount} veces en la base; la última el ${detail.lastSightingLabel}`
              : `apareció en la base el ${detail.lastSightingLabel}`
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
          <SectionPanel
            title="Caso resuelto"
            description={detail.resolutionLabel ?? ""}
          >
            <p className="text-sm text-ui-muted">
              El historial queda como evidencia; un caso resuelto no se reabre.
            </p>
          </SectionPanel>
        ) : null}

        {detail.reportedActive ? (
          <SectionPanel
            title="En verificación: reportado como ya activo en Movistar"
            description="La palabra del asesor no cierra el caso; lo cierra el reporte de portabilidad o esta confirmación."
          >
            {detail.canResolveOther ? (
              <VerifyReportedForm caseId={detail.id} />
            ) : (
              <p className="text-sm text-ui-muted">
                Su número entra en la próxima consulta de portabilidad; ahí se
                confirma, o lo decide tu supervisor. Mientras tanto no exige
                gestión.
              </p>
            )}
          </SectionPanel>
        ) : null}

        {detail.interestedWithOrder && !detail.isResolved ? (
          <SectionPanel
            title="Interesado con pedido en curso"
            description="El cliente quiere, pero otra agencia ya le envió un pedido. Reaparece cada mañana para re-contactar; el cruce lo sigue revisando."
          >
            <p className="text-sm text-ui-muted">
              Si el cliente confirma que el pedido anterior cayó, registra{" "}
              <strong>Vendido</strong> y vincula la orden nueva.
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
            detail.claimedAtLabel
              ? ` · asignado el ${detail.claimedAtLabel}`
              : ""
          }`}
        >
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <span>
              DNI: <CopyValue label="DNI" value={detail.documentNumber} />
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

          <div className="rounded-xl border border-ui-border p-3 text-sm">
            <p className="ui-label-eyebrow">Ubicación</p>
            <p className="text-ui-text">
              {[detail.department, detail.province, detail.district]
                .filter(Boolean)
                .join(" · ") || "Sin ubicación en la base"}
            </p>
            {detail.address ? (
              <p className="mt-1 text-ui-muted">{detail.address}</p>
            ) : null}
            {detail.reference ? (
              <p className="mt-1 text-ui-muted">
                Referencia: {detail.reference}
              </p>
            ) : null}
            {detail.deliveryInstructions ? (
              <p className="mt-1 text-ui-muted">
                Indicaciones: {detail.deliveryInstructions}
              </p>
            ) : null}
            {detail.osmEmbedUrl ? (
              <iframe
                className="mt-2 h-64 w-full rounded-lg border border-ui-border"
                loading="lazy"
                referrerPolicy="no-referrer"
                src={detail.osmEmbedUrl}
                title={`Ubicación de entrega de ${detail.holderName}`}
              />
            ) : null}
            {detail.mapsUrl ? (
              <p className="mt-1">
                <a
                  className="text-ui-accent underline-offset-2 hover:underline"
                  href={detail.mapsUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Ver coordenadas en el mapa ↗
                </a>
              </p>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-ui-border">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Línea a portar</th>
                  <th>Plan</th>
                  <th>Operador actual</th>
                  <th>Portabilidad</th>
                </tr>
              </thead>
              <tbody>
                {detail.services.map((service) => (
                  <tr
                    className={service.discarded ? "opacity-50" : undefined}
                    key={service.serviceNumber}
                  >
                    <td className="font-mono text-xs">
                      <CopyValue label="Línea" value={service.serviceNumber} />
                      {service.isPlantLine ? (
                        <span className="ml-2 text-[11px] text-ui-muted">
                          línea de planta (nunca ha portado)
                        </span>
                      ) : null}
                    </td>
                    <td className="text-xs text-ui-muted">
                      {service.planRaw ?? "—"}
                    </td>
                    <td className="text-xs">
                      <span className="font-medium text-ui-text">
                        {service.originOperator}
                      </span>
                      {service.originDetail ? (
                        <span className="block text-[11px] text-ui-muted">
                          {service.originDetail}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-xs text-ui-muted">
                      {service.discarded
                        ? "Descartada"
                        : (portabilityLabels[service.portabilityState ?? ""] ??
                          "Aún no consultada")}
                      {service.portabilityEligibleLabel
                        ? ` · puede portar desde el ${service.portabilityEligibleLabel}`
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

        <SectionPanel
          title="Identidad del titular"
          description="Datos de RENIEC para confirmar con quién estás hablando."
        >
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="ui-label-eyebrow">Padre</dt>
              <dd>{detail.sensitive.fatherName ?? "—"}</dd>
            </div>
            <div>
              <dt className="ui-label-eyebrow">Madre</dt>
              <dd>{detail.sensitive.motherName ?? "—"}</dd>
            </div>
            <div>
              <dt className="ui-label-eyebrow">Nacimiento</dt>
              <dd>{detail.sensitive.birthPlace ?? "—"}</dd>
            </div>
          </dl>
          {detail.sensitive.revealedAtLabel ? (
            <p className="mt-3 text-xs text-ui-muted">
              Este caso registra una revelación auditada el{" "}
              {detail.sensitive.revealedAtLabel}.
            </p>
          ) : null}
        </SectionPanel>

        {detail.canManage && !detail.isResolved ? (
          <SectionPanel
            title="Registrar intento"
            description="Lo que registres no se puede editar después. Si no contesta, intenta 3 veces en el día; si agendas, se pausa hasta la fecha acordada."
          >
            <RegisterAttemptForm
              caseId={detail.id}
              returnTo="/recovery/campaigns"
            />
          </SectionPanel>
        ) : null}

        <SectionPanel
          title="Historial de intentos"
          description={`${formatCount(detail.attempts.length)} intento(s) registrados.`}
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
                      {channelLabels[attempt.channel] ?? attempt.channel} ·{" "}
                      {attempt.createdAtLabel} · {attempt.actorName}
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
            description="Recuperado exige vincular la orden DITO nueva; para darlo por perdido debes elegir un motivo y cumplir lo que ese motivo pide."
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
    </>
  );
}
