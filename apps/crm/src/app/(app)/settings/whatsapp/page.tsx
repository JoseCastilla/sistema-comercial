import Link from "next/link";

import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { formatDateTime } from "@/lib/time";
import { requireManager } from "@/server/auth/access";
import { database } from "@/server/database";
import { metaConfigStatus, webhookUrl } from "@/server/meta/config";
import { messagingLimitText, numberStatusText, qualityText } from "@/server/meta/status-text";

import { connectManually, disconnect, refreshNumberStatus, saveDefaultAgent } from "./actions";
import { EmbeddedSignupButton } from "./embedded-signup";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  MANUAL: "Conectado a mano con un token",
  EMBEDDED_SIGNUP: "Conectado desde Meta (Embedded Signup)",
};

export default async function WhatsappSettingsPage() {
  const access = await requireManager();
  const isOwner = access.role === "OWNER";
  const [numbers, agents] = await Promise.all([
    database.whatsappNumber.findMany({ where: { organizationId: access.organizationId }, orderBy: { createdAt: "asc" } }),
    database.aiAgent.findMany({
      where: { organizationId: access.organizationId, status: { not: "PAUSED" } },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const config = metaConfigStatus();
  const hookUrl = webhookUrl();

  return (
    <>
      <PageHeader
        eyebrow="Ajustes"
        title="WhatsApp"
        description="El número por el que escriben tus clientes. Aquí se conecta con Meta y se ve si puedes seguir enviando."
      />

      <SectionPanel
        title={`Números (${numbers.length})`}
        description="Lo que Meta dice de cada número. Si algo cambia, actualiza el estado para verlo aquí."
      >
        {numbers.length === 0 ? (
          <EmptyState
            title="Todavía no hay ningún número"
            description="Sin un número conectado no entra ni sale ningún mensaje. Conéctalo abajo."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {numbers.map((number) => {
              const quality = qualityText(number.qualityRating);
              const status = numberStatusText(number.status);
              return (
                <article key={number.id} className="ui-surface ui-surface--padded flex flex-col gap-3">
                  <header className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{number.verifiedName ?? "Sin nombre aprobado por Meta"}</h3>
                      <p className="text-xs text-ui-muted">
                        {number.displayPhoneNumber ?? "Sin teléfono visible"} · {METHOD_LABEL[number.connectionMethod] ?? number.connectionMethod}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      <StatusBadge tone={quality.tone}>{`Calidad: ${quality.label}`}</StatusBadge>
                    </div>
                  </header>

                  <dl className="ui-order-detail-grid">
                    <div>
                      <dt className="ui-label-eyebrow">Cuántas personas puedes contactar</dt>
                      <dd>{messagingLimitText(number.messagingLimitTier)}</dd>
                    </div>
                    <div>
                      <dt className="ui-label-eyebrow">Qué significa su calidad</dt>
                      <dd>{quality.detail ?? status.detail ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="ui-label-eyebrow">Conectado desde</dt>
                      <dd>{formatDateTime(number.connectedAt, access.timezone)}</dd>
                    </div>
                    <div className="ui-order-detail-grid__item--wide">
                      <dt className="ui-label-eyebrow">Último problema</dt>
                      <dd>{number.lastError ?? "Ninguno."}</dd>
                    </div>
                  </dl>

                  <ActionForm
                    action={saveDefaultAgent}
                    className="flex flex-wrap items-end gap-2"
                    submitLabel="Guardar asistente"
                    variant="secondary"
                  >
                    <input name="numberId" type="hidden" value={number.id} />
                    <label className="ui-field ui-form-row__grow">
                      <span className="ui-field__label">Quién contesta primero en este número</span>
                      <select className="ui-control ui-control--select" defaultValue={number.defaultAiAgentId ?? ""} name="aiAgentId">
                        <option value="">Nadie: la conversación espera a un asesor</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                            {agent.status === "DRAFT" ? " (todavía en borrador)" : ""}
                          </option>
                        ))}
                      </select>
                      <span className="ui-field__hint">
                        {agents.length === 0
                          ? "Todavía no creaste ningún asistente: las conversaciones nuevas esperarán a un asesor."
                          : "El asistente contesta y le pasa la conversación a un asesor cuando hace falta."}
                      </span>
                    </label>
                  </ActionForm>

                  <div className="flex flex-wrap items-center gap-2">
                    <ActionForm action={refreshNumberStatus} className="contents" submitLabel="Actualizar estado" variant="quiet">
                      <input name="numberId" type="hidden" value={number.id} />
                    </ActionForm>
                    {isOwner ? (
                      <ActionForm
                        action={disconnect}
                        className="contents"
                        confirm="Vas a desconectar el número: dejarán de entrar y salir mensajes. Las conversaciones y plantillas ya registradas se conservan. ¿Sigues?"
                        submitLabel="Desconectar"
                        variant="danger"
                      >
                        <input name="numberId" type="hidden" value={number.id} />
                      </ActionForm>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionPanel>

      {isOwner ? (
        <SectionPanel
          title="Conectar desde Meta"
          description="La forma recomendada: Meta pide los permisos y devuelve el número ya listo."
        >
          {config.canEmbeddedSignup && config.appId && config.configId ? (
            <EmbeddedSignupButton appId={config.appId} configId={config.configId} graphVersion={config.graphVersion} />
          ) : (
            <div className="ui-form-stack">
              <p>
                Este camino todavía no está disponible porque falta configurar la app de Meta. Completa en el archivo{" "}
                <code>apps/crm/.env</code>:
              </p>
              <ul className="list-disc pl-5 text-sm">
                {config.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="text-sm text-ui-muted">
                Los valores se sacan de la app en developers.facebook.com: el identificador y la clave secreta en «Configuración
                básica», y la configuración de Embedded Signup en «WhatsApp → Configuración».
              </p>
            </div>
          )}

          <div className="ui-order-disclosure ui-order-disclosure--info mt-4">
            <p>
              <strong>Lo que Meta te va a exigir antes de operar para otras empresas:</strong>
            </p>
            <ul className="list-disc pl-5 text-sm">
              <li>Verificar tu empresa en el Administrador Comercial (documentos a nombre del negocio).</li>
              <li>
                Pasar la revisión de la app (App Review) con los permisos <code>whatsapp_business_management</code> y{" "}
                <code>whatsapp_business_messaging</code>.
              </li>
              <li>Aceptar los términos de proveedor de soluciones y configurar la facturación de la cuenta.</li>
              <li>
                Dejar el webhook apuntando a <code>{hookUrl}</code> con el token de verificación que pusiste en{" "}
                <code>META_WEBHOOK_VERIFY_TOKEN</code>, y suscribir los campos <code>messages</code>,{" "}
                <code>message_template_status_update</code>, <code>template_category_update</code>,{" "}
                <code>message_template_quality_update</code>, <code>phone_number_quality_update</code>,{" "}
                <code>account_update</code> y <code>user_preferences</code>.
              </li>
            </ul>
            <p className="text-sm">
              {config.canReceiveWebhooks
                ? "El webhook ya puede validarse: Meta responderá al reto y las firmas se comprueban."
                : "Mientras falten META_APP_SECRET o META_WEBHOOK_VERIFY_TOKEN, el webhook rechaza todo lo que llega y no entrará ningún mensaje."}
            </p>
          </div>
        </SectionPanel>
      ) : null}

      {isOwner ? (
        <SectionPanel
          title="Conexión manual"
          description="Para un número que ya está en tu propia cuenta de Meta. Antes de guardar comprobamos el número y suscribimos la app; si Meta se niega, no se guarda nada."
        >
          <ActionForm action={connectManually} submitLabel="Conectar número" pendingLabel="Comprobando con Meta…">
            <div className="ui-form-row">
              <label className="ui-field ui-form-row__grow">
                <span className="ui-field__label">Identificador de la cuenta de WhatsApp (WABA id)</span>
                <input className="ui-control" name="wabaId" required />
                <span className="ui-field__hint">Está en WhatsApp Manager, en «Configuración de la cuenta».</span>
              </label>
              <label className="ui-field ui-form-row__grow">
                <span className="ui-field__label">Identificador del número (phone number id)</span>
                <input className="ui-control" name="phoneNumberId" required />
              </label>
            </div>
            <label className="ui-field">
              <span className="ui-field__label">Token del usuario de sistema</span>
              <input autoComplete="off" className="ui-control" name="token" required type="password" />
              <span className="ui-field__hint">
                Se guarda cifrado y nunca vuelve a mostrarse. Necesita los permisos whatsapp_business_management y
                whatsapp_business_messaging.
              </span>
            </label>
          </ActionForm>
        </SectionPanel>
      ) : null}

      <SectionPanel title="Plantillas" description="Los mensajes que puedes enviar cuando pasaron más de 24 horas.">
        <p>
          Se administran en <Link href="/templates">Plantillas</Link>.
        </p>
      </SectionPanel>
    </>
  );
}
