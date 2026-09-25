import Link from "next/link";
import { notFound } from "next/navigation";

import { campaignResolutionNote } from "@repo/validation";

import {
  CaseWorkCard,
  type CaseWorkNote,
} from "@/features/recovery/components/case-work-card";
import { CopyValue } from "@/features/recovery/components/copy-value";
import { CorrectAttemptForm } from "@/features/recovery/components/correct-attempt-form";
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
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{
    q?: string;
    department?: string;
    plan?: string;
    page?: string;
    from?: string;
    team?: string;
    advisor?: string;
    result?: string;
    next?: string;
    contact?: string;
    worked?: string;
    status?: string;
  }>;
}) {
  const { session, membership } = await requireCommercialAccess();
  const { caseId } = await params;
  const context = await searchParams;

  /**
   * La cola llega en el enlace para poder devolver al asesor a donde estaba:
   * su búsqueda, sus filtros y su página. Llegar a la ficha por un enlace
   * suelto no trae nada, y entonces «Volver a mi cola» abre la bandeja
   * normal, que es lo correcto. `visto` marca este caso al volver, y el
   * ancla lo pone en pantalla sin depender de una altura que ya cambió.
   */
  const queue = new URLSearchParams();
  if (context.q) queue.set("q", context.q.slice(0, 80));
  if (context.department) queue.set("department", context.department);
  if (context.plan) queue.set("plan", context.plan.slice(0, 100));
  if (context.page) queue.set("page", context.page);
  // SPEC-040 BR-009: si vino de Seguimiento, vuelve a Seguimiento con sus
  // filtros; la bandeja del asesor no es su sitio.
  const fromFollowUp = context.from === "follow-up";
  for (const key of [
    "team",
    "advisor",
    "result",
    "next",
    "contact",
    "worked",
    "status",
  ] as const) {
    const value = context[key];
    if (fromFollowUp && value) queue.set(key, value.slice(0, 40));
  }
  queue.set("visto", caseId);
  // SPEC-048 BR-013: desde Mi agenda se vuelve a la misma vista y fecha.
  const fromAgenda = context.from === "agenda";
  const fromMyDay = context.from === "mi-dia";
  const agendaContext = new URLSearchParams();
  if (fromAgenda) {
    for (const key of ["view", "fecha", "q", "age", "tipo", "estado", "cita"]) {
      const value = (context as Record<string, string | undefined>)[key];
      if (value) agendaContext.set(key, value.slice(0, 40));
    }
  }
  const backBase = fromMyDay
    ? "/my-day"
    : fromAgenda
    ? "/recovery/agenda"
    : fromFollowUp
      ? "/recovery/follow-up"
      : "/recovery/campaigns";
  const backLabel = fromMyDay
    ? "← Volver a Mi día"
    : fromAgenda
    ? "← Volver a mi agenda"
    : fromFollowUp
      ? "← Volver a Seguimiento"
      : "← Volver a mi cola";
  const backHref = fromMyDay
    ? `/my-day#mi-dia-${caseId}`
    : fromAgenda
    ? `${backBase}?${agendaContext.toString()}`
    : `${backBase}?${queue.toString()}#caso-${caseId}`;

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

  const workPhones = [
    ...detail.contactPhones,
    ...detail.activeServiceNumbers.filter(
      (line) => !detail.contactPhones.includes(line),
    ),
  ];
  const noValidPhones = workPhones.length === 0;
  const notes: CaseWorkNote[] = [];
  if (detail.resolutionDue && !detail.isResolved) {
    notes.push({
      text: `${campaignResolutionNote}; si no, pasa a tu supervisor.`,
      tone: "warning",
    });
  }
  if (detail.interestedWithOrder && !detail.isResolved) {
    notes.push({
      text: "Tenía pedido en curso con otra agencia: pregunta si se cayó. Si se cayó y compra, registra «Vendido» y vincula la venta nueva.",
      tone: "accent",
    });
  }
  if (detail.work?.note) notes.push({ text: detail.work.note });
  if (noValidPhones && !detail.isResolved) {
    notes.push({
      text: "No quedan teléfonos válidos: ciérralo como datos inválidos.",
      tone: "warning",
    });
  }
  const attemptsWord = (count: number) =>
    `${formatCount(count)} ${count === 1 ? "gestión registrada" : "gestiones registradas"}`;

  return (
    <>
      <div className="ui-page-stack">
        {/* SPEC-067 BR-014: el encabezado sin jerga; lo demás, en los datos. */}
        <PageHeader
          eyebrow="Campañas"
          title={detail.holderName}
          description={`Campaña · ${detail.teamName ?? "sin equipo"}`}
        />

        <p className="text-sm">
          <Link
            className="text-ui-accent underline-offset-2 hover:underline"
            href={backHref}
          >
            {backLabel}
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

        {/* SPEC-067 BR-001, BR-007 a BR-009: arriba, la tarjeta de «Mi día». */}
        {detail.isResolved ? null : (
          <CaseWorkCard
            action={detail.work?.action ?? "Sin acción pendiente"}
            canManage={detail.canManage}
            caseId={detail.id}
            due={detail.work?.due ?? null}
            holderName={detail.holderName}
            lastObservation={detail.lastObservation}
            lastResult={detail.lastResult}
            meta={`${detail.attemptsToday} de ${detail.minimumDailyAttempts} intentos hoy`}
            notes={notes}
            phone={workPhones[0] ?? null}
            phoneOptions={workPhones}
            serviceNumbers={detail.activeServiceNumbers}
          />
        )}

        {/* SPEC-067 BR-012: lo de consulta, plegado; el mapa, a un clic. */}
        <details className="rounded-lg border border-ui-border bg-ui-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ui-text">
            Datos del cliente
          </summary>
          <div className="grid gap-5 border-t border-ui-border p-4 text-sm sm:grid-cols-2">
            <section className="grid gap-1">
              <h2 className="ui-label-eyebrow">Identidad del titular</h2>
              <p>
                DNI <CopyValue label="DNI" value={detail.documentNumber} />
              </p>
              <p className="text-ui-muted">
                Padre: {detail.sensitive.fatherName ?? "—"} · Madre:{" "}
                {detail.sensitive.motherName ?? "—"} · Nacimiento:{" "}
                {detail.sensitive.birthPlace ?? "—"}
              </p>
              {detail.sensitive.revealedAtLabel ? (
                <p className="text-xs text-ui-muted">
                  Este caso registra una revelación auditada el{" "}
                  {detail.sensitive.revealedAtLabel}.
                </p>
              ) : null}
            </section>

            <section className="grid gap-1">
              <h2 className="ui-label-eyebrow">Teléfonos de contacto</h2>
              {detail.contactPhones.length > 0 ? (
                <ul className="grid gap-1">
                  {detail.contactPhones.map((phone) => (
                    <li key={phone}>
                      <CopyValue label="Teléfono" value={phone} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ui-muted">Sin teléfono de contacto.</p>
              )}
              {detail.invalidPhones.length > 0 ? (
                <p className="text-xs text-ui-muted">
                  Errados:{" "}
                  {detail.invalidPhones.map((phone, index) => (
                    <span key={phone}>
                      {index > 0 ? " · " : ""}
                      <s>{phone}</s>
                    </span>
                  ))}
                </p>
              ) : null}
            </section>

            <section className="grid gap-1">
              <h2 className="ui-label-eyebrow">Dónde entregar</h2>
              <p>
                {[detail.department, detail.province, detail.district]
                  .filter(Boolean)
                  .join(" · ") || "Sin ubicación en la base"}
              </p>
              {detail.address ? (
                <p className="text-ui-muted">{detail.address}</p>
              ) : null}
              {detail.reference ? (
                <p className="text-ui-muted">Referencia: {detail.reference}</p>
              ) : null}
              {detail.deliveryInstructions ? (
                <p className="text-ui-muted">
                  Indicaciones: {detail.deliveryInstructions}
                </p>
              ) : null}
              {detail.mapsUrl ? (
                <a
                  className="text-ui-accent underline-offset-2 hover:underline"
                  href={detail.mapsUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Ver en el mapa ↗
                </a>
              ) : null}
              {detail.osmEmbedUrl ? (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-ui-accent">
                    Mostrar el mapa aquí
                  </summary>
                  <iframe
                    className="mt-2 h-64 w-full rounded-lg border border-ui-border"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    src={detail.osmEmbedUrl}
                    title={`Ubicación de entrega de ${detail.holderName}`}
                  />
                </details>
              ) : null}
            </section>

            <section className="grid gap-1">
              <h2 className="ui-label-eyebrow">Líneas a portar</h2>
              <ul className="grid gap-2">
                {detail.services.map((service) => (
                  <li
                    className={service.discarded ? "opacity-50" : undefined}
                    key={service.serviceNumber}
                  >
                    <CopyValue label="Línea" value={service.serviceNumber} />
                    <span className="block text-xs text-ui-muted">
                      {[
                        service.originOperator,
                        service.originDetail,
                        service.planRaw,
                        service.isPlantLine
                          ? "línea de planta (nunca ha portado)"
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="block text-xs text-ui-muted">
                      {service.discarded
                        ? "Descartada"
                        : (portabilityLabels[service.portabilityState ?? ""] ??
                          "Aún no consultada")}
                      {service.portabilityEligibleLabel
                        ? ` · puede portar desde el ${service.portabilityEligibleLabel}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="text-xs text-ui-muted sm:col-span-2">
              Responsable: {detail.assignedToName ?? "sin asignar"}
              {detail.claimedAtLabel
                ? ` · asignado el ${detail.claimedAtLabel}`
                : ""}{" "}
              ·{" "}
              {detail.sightingCount > 1
                ? `apareció ${detail.sightingCount} veces en la base; la última el ${detail.lastSightingLabel}`
                : `apareció en la base el ${detail.lastSightingLabel}`}
            </p>
          </div>
        </details>

        {detail.pendingCommitment || detail.commitments.length > 0 ? (
          <SectionPanel
            title="Llamada acordada"
            description={
              detail.pendingCommitment
                ? detail.pendingCommitment.overdue
                  ? `Acordada para el ${detail.pendingCommitment.scheduledAtLabel}: ya pasó y sigue pendiente hasta que registres el resultado.`
                  : `Acordada con el cliente para el ${detail.pendingCommitment.scheduledAtLabel}. Hasta entonces no exige gestión.`
                : "Sin cita vigente."
            }
          >
            {detail.pendingCommitment && detail.isAssignedToViewer ? (
              <p className="mb-2 text-sm">
                <Link
                  className="text-ui-accent underline-offset-2 hover:underline"
                  href={`/recovery/agenda?cita=${detail.pendingCommitment.id}`}
                >
                  Reprogramar o cancelar en mi agenda
                </Link>
              </p>
            ) : null}
            <ul className="space-y-2">
              {detail.commitments.map((commitment) => (
                <li
                  className="rounded-xl border border-ui-border p-3 text-sm"
                  key={commitment.id}
                >
                  <p className="font-medium text-ui-text">
                    {commitment.scheduledAtLabel}
                    <span className="ml-2 text-xs font-normal text-ui-muted">
                      {commitment.stateLabel} · acordada el{" "}
                      {commitment.createdAtLabel} · {commitment.createdByName}
                      {commitment.closedAtLabel
                        ? ` · cerrada el ${commitment.closedAtLabel}`
                        : ""}
                    </span>
                  </p>
                  {commitment.reason ? (
                    <p className="mt-1 text-xs text-ui-muted">
                      {commitment.reason}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </SectionPanel>
        ) : null}

        {/* SPEC-067 BR-013: gestiones, como el botón que las registra. */}
        <SectionPanel
          title="Historial de gestiones"
          description={`${attemptsWord(detail.attempts.length)}. No se pueden editar y queda quién las hizo.`}
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
                    {attempt.correction ? (
                      <s className="mr-2 font-normal text-ui-muted">
                        {attemptResultLabels[attempt.originalResult] ??
                          attempt.originalResult}
                      </s>
                    ) : null}
                    {attemptResultLabels[attempt.result] ?? attempt.result}
                    {attempt.reasonLabel ? (
                      <span className="ml-1 font-normal text-ui-muted">
                        · {attempt.reasonLabel}
                      </span>
                    ) : null}
                    <span className="ml-2 text-xs font-normal text-ui-muted">
                      {channelLabels[attempt.channel] ?? attempt.channel} ·{" "}
                      {attempt.createdAtLabel} · {attempt.actorName}
                      {attempt.phoneUsed ? ` · ${attempt.phoneUsed}` : ""}
                    </span>
                  </p>
                  {attempt.observation ? (
                    <p className="mt-1 text-xs text-ui-muted">
                      «{attempt.observation}»
                    </p>
                  ) : null}
                  {attempt.correction ? (
                    <p className="mt-1 text-xs text-ui-muted">
                      Rectificado por {attempt.correction.actorName} el{" "}
                      {attempt.correction.createdAtLabel}:{" "}
                      {attempt.correction.correctionReason}
                    </p>
                  ) : attempt.canCorrect.allowed ? (
                    <CorrectAttemptForm
                      attemptId={attempt.id}
                      originalLabel={
                        attemptResultLabels[attempt.originalResult] ??
                        attempt.originalResult
                      }
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>

        {detail.canManage && !detail.isResolved ? (
          <div id="resolver">
            <SectionPanel
              title="Cerrar el caso"
              description="Recuperado pide la venta nueva del cliente; perdido pide el motivo y lo que ese motivo exige."
            >
              <ResolveCaseForm
                canUseOther={detail.canResolveOther}
                caseId={detail.id}
                gates={detail.lossReasonGates}
                suggestions={detail.recoveredOrderSuggestions}
              />
            </SectionPanel>
          </div>
        ) : null}
      </div>
    </>
  );
}
