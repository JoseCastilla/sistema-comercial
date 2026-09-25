import Link from "next/link";

import { formatCount } from "@repo/ui/format";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import { attemptResultLabels } from "../attempt-result-labels";
import { buildOrderHref } from "../order-link";

import { CaseWorkCard } from "./case-work-card";
import { CopyValue } from "./copy-value";
import { ResolveCaseForm } from "./resolve-case-form";

import type { SalesRecoveryCaseDetail } from "../server/get-sales-recovery-case";

const channelLabels: Record<string, string> = {
  LLAMADA: "Llamada",
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  PRESENCIAL: "Presencial",
  OTRO: "Otro",
};

/**
 * Ficha de una venta caída (SPEC-067). La misma estructura que la de
 * Campañas: arriba la tarjeta de «Mi día» —plazo, qué hacer, por qué se cayó,
 * el número y el editor de botones—; debajo el historial y, al final, cerrar
 * el caso. Antes eran cuatro tarjetas de cifras («Asignado», el código del
 * pedido en grande), un párrafo de reglas y un formulario de listas recortado
 * por su propio recuadro.
 */
export function SalesRecoveryCaseDetail({
  data,
  from,
}: {
  data: SalesRecoveryCaseDetail;
  /** De dónde vino el asesor, para volver ahí (BR-004). */
  from?: string;
}) {
  const back =
    from === "mi-dia"
      ? { href: `/my-day#mi-dia-${data.id}`, label: "← Volver a Mi día" }
      : { href: "/recovery/sales", label: "← Volver a Recupero de ventas" };
  const count = data.attempts.length;

  return (
    <div className="ui-page-stack">
      <PageHeader
        description={data.isResolved ? (data.resolutionLabel ?? "Caso resuelto") : undefined}
        eyebrow="Venta caída"
        meta={<Link href={back.href}>{back.label}</Link>}
        title={data.holderName}
      />

      {data.isResolved ? null : (
        <CaseWorkCard
          action={data.work?.action ?? "Sin acción pendiente"}
          canManage={data.canManage}
          caseId={data.id}
          due={data.work?.due ?? null}
          holderName={data.holderName}
          lastObservation={data.lastObservation}
          lastResult={data.lastResult}
          meta={
            <>
              {data.saleDayLabel ? `Venta del ${data.saleDayLabel}` : "Venta"}
              {data.orderCode ? (
                <>
                  {" · pedido "}
                  <Link
                    className="text-ui-accent underline-offset-2 hover:underline"
                    href={buildOrderHref(data.orderCode, data.orderRegisteredDay)}
                  >
                    {data.orderCode}
                  </Link>
                </>
              ) : null}
            </>
          }
          notes={data.fallReason ? [{ text: data.fallReason }] : []}
          phone={data.phoneOptions[0] ?? null}
          phoneOptions={data.phoneOptions}
          serviceNumbers={[]}
        />
      )}

      {/* BR-011: la regla del plazo, plegada y en palabras simples. */}
      {data.isResolved ? null : (
        <details className="rounded-lg border border-ui-border bg-ui-surface text-sm">
          <summary className="cursor-pointer px-4 py-3 font-semibold text-ui-text">
            Cómo se calcula el plazo
          </summary>
          <div className="grid gap-1 border-t border-ui-border p-4 text-ui-muted">
            <p>
              Tienes dos horas desde que la venta se cayó para la primera
              llamada. Después, el caso vuelve a tocar al día 1, al 3 y al 7
              desde que lo tomaste.
            </p>
            <p>
              Si acuerdas una llamada con el cliente, se espera esa hora. Si
              dice que no, el caso descansa uno o dos días. Al día 7 hay que
              cerrarlo o agendar una fecha.
            </p>
            {data.claimedAtLabel ? (
              <p>Tomaste este caso el {data.claimedAtLabel}.</p>
            ) : null}
          </div>
        </details>
      )}

      <details className="rounded-lg border border-ui-border bg-ui-surface text-sm">
        <summary className="cursor-pointer px-4 py-3 font-semibold text-ui-text">
          Datos de la venta
        </summary>
        <div className="grid gap-1 border-t border-ui-border p-4 text-ui-muted">
          <p>
            DNI <CopyValue label="DNI" value={data.documentNumber} />
          </p>
          <p>
            {data.originalAgentName
              ? `Venta de ${data.originalAgentName}${data.originalTeamName ? ` · ${data.originalTeamName}` : ""}`
              : "Sin asesor registrado"}
          </p>
          <p>
            Responsable del recupero: {data.assignedToName ?? "sin responsable"}
          </p>
          {data.entryObservation ? (
            <p className="whitespace-pre-wrap">
              Anotado al abrir el caso: {data.entryObservation}
            </p>
          ) : null}
        </div>
      </details>

      {/* BR-013: el historial como lista; «gestiones», como el botón. */}
      <SectionPanel
        title="Historial de gestiones"
        description={`${formatCount(count)} ${count === 1 ? "gestión registrada" : "gestiones registradas"}. No se pueden editar y queda quién las hizo.`}
      >
        {count === 0 ? (
          <p className="text-sm text-ui-muted">
            Todavía no hay gestión sobre este caso.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.attempts.map((attempt) => (
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
                    «{attempt.observation}»
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>

      {data.canManage && !data.isResolved ? (
        <SectionPanel
          title="Cerrar el caso"
          description="Recuperado pide la venta nueva del cliente; perdido pide el motivo y lo que ese motivo exige."
        >
          <ResolveCaseForm
            canUseOther={data.canResolveOther}
            caseId={data.id}
            gates={data.lossReasonGates}
            suggestions={data.recoveredOrderSuggestions}
          />
        </SectionPanel>
      ) : null}
    </div>
  );
}
