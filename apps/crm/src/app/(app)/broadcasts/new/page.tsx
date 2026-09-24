import Link from "next/link";

import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { formatDate, zonedTimeToUtc } from "@/lib/time";
import { requireManager } from "@/server/auth/access";
import {
  dailyLimitForTier,
  dailyLimitIsAssumed,
  EXCLUSION_TEXT,
  withinSendWindow,
  type ExclusionReason,
} from "@/server/broadcasts/rules";
import { describeSegment, parseStoredSegment } from "@/server/broadcasts/segments";
import {
  connectedNumbers,
  contactLabels,
  countSegment,
  getBroadcast,
  previewBroadcast,
  usableTemplates,
} from "@/server/broadcasts/service";
import { templateBodyText } from "@/server/templates/render";

import { createDraft, saveSegmentStep, saveTemplateStep, scheduleFromWizard } from "../actions";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function one(search: Search, key: string): string {
  const value = search[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

const STAGE_OPTIONS = [
  ["NUEVO", "Nuevo"],
  ["EN_CONTACTO", "En contacto"],
  ["CALIFICADO", "Calificado"],
  ["PROPUESTA", "Propuesta"],
  ["EN_CIERRE", "En cierre"],
  ["GANADA", "Ganada"],
  ["PERDIDA", "Perdida"],
] as const;

const ORIGIN_OPTIONS = [
  ["AD", "Anuncio"],
  ["BROADCAST", "Difusión"],
  ["REFERRAL", "Referido"],
  ["ADVISOR", "Asesor"],
  ["ORGANIC", "Escribió solo"],
  ["UNKNOWN", "No se sabe"],
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: "Promoción",
  UTILITY: "Aviso",
  AUTHENTICATION: "Código de acceso",
};

const STEPS = [
  [1, "A quiénes"],
  [2, "Qué les dices"],
  [3, "Cuándo sale"],
  [4, "Revisar y programar"],
] as const;

function StepNav({ id, step }: { id: string; step: number }) {
  return (
    <nav className="ui-segmented ui-segmented-scroll">
      {STEPS.map(([number, label]) => (
        <Link
          aria-current={number === step ? "page" : undefined}
          className="ui-segmented__item"
          href={`/broadcasts/new?id=${id}&paso=${number}`}
          key={number}
        >
          {number}. {label}
        </Link>
      ))}
    </nav>
  );
}

function variablesOf(value: unknown): { index: number; source: string; label?: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const record = entry as Record<string, unknown>;
      const index = Number(record.index);
      if (!Number.isFinite(index)) return [];
      return [{ index, source: String(record.source ?? "manual"), label: typeof record.label === "string" ? record.label : undefined }];
    })
    .sort((a, b) => a.index - b.index);
}

const SOURCE_LABEL: Record<string, string> = {
  "contact.name": "el nombre de la persona (lo pone el sistema)",
  "contact.phone": "su teléfono (lo pone el sistema)",
  "advisor.name": "el nombre del asesor (en una difusión no hay: escríbelo abajo)",
  manual: "lo escribes tú, igual para todos",
};

export default async function NewBroadcastPage({ searchParams }: { searchParams: Promise<Search> }) {
  const access = await requireManager();
  const search = await searchParams;
  const id = one(search, "id");
  const step = Number(one(search, "paso") || "1");

  const [numbers, templates] = await Promise.all([
    connectedNumbers(access.organizationId),
    usableTemplates(access.organizationId),
  ]);

  if (numbers.length === 0) {
    return (
      <div className="ui-page-stack">
        <PageHeader eyebrow="Difusiones" title="Nueva difusión" />
        <SectionPanel title="Falta conectar el WhatsApp">
          <p>Sin un número conectado no hay por dónde enviar. Conéctalo y vuelve acá.</p>
          <p><Link className="ui-button ui-button--primary" href="/settings/whatsapp">Conectar WhatsApp</Link></p>
        </SectionPanel>
      </div>
    );
  }
  if (templates.length === 0) {
    return (
      <div className="ui-page-stack">
        <PageHeader eyebrow="Difusiones" title="Nueva difusión" />
        <SectionPanel title="Falta una plantilla aprobada">
          <p>Fuera de la ventana de 24 horas solo se puede mandar una plantilla que Meta ya aprobó. Crea una y espera su respuesta.</p>
          <p><Link className="ui-button ui-button--primary" href="/templates">Ir a plantillas</Link></p>
        </SectionPanel>
      </div>
    );
  }

  // ── Sin borrador todavía: solo el primer paso ──
  if (!id) {
    return (
      <div className="ui-page-stack">
        <PageHeader
          description="Cuatro pasos: a quiénes, qué les dices, cuándo sale y revisar. Puedes volver atrás mientras sea borrador."
          eyebrow="Difusiones"
          title="Nueva difusión"
        />
        <SectionPanel
          description="Aquí solo entran contactos que ya hablaron contigo. No existe la base nacional de Campañas: esa gente nunca aceptó que le escribas por WhatsApp y usarla te tumba el número."
          title="1. A quiénes le escribes"
        >
          <ActionForm action={createDraft} submitLabel="Guardar y ver a cuántos llega">
            <label className="ui-field">
              <span className="ui-field__label">Nombre de la difusión</span>
              <input className="ui-control" name="name" placeholder="Reintento a cancelados de agosto" required />
            </label>
            <SegmentFields segment={{}} />
          </ActionForm>
        </SectionPanel>
      </div>
    );
  }

  const broadcast = await getBroadcast(access.organizationId, id);
  const segment = parseStoredSegment(broadcast.segment);

  if (broadcast.status !== "DRAFT") {
    return (
      <div className="ui-page-stack">
        <PageHeader eyebrow="Difusiones" title={broadcast.name} />
        <SectionPanel title="Esta difusión ya se programó">
          <p>Los destinatarios están congelados y no se pueden cambiar. Mira cómo va o crea otra.</p>
          <p>
            <Link className="ui-button ui-button--primary" href={`/broadcasts/${broadcast.id}`}>Ver resultados</Link>{" "}
            <Link className="ui-button ui-button--secondary" href="/broadcasts/new">Crear otra</Link>
          </p>
        </SectionPanel>
      </div>
    );
  }

  return (
    <div className="ui-page-stack">
      <PageHeader
        description={describeSegment(segment)}
        eyebrow="Difusiones · borrador"
        meta={<StatusBadge tone="neutral">Borrador</StatusBadge>}
        title={broadcast.name}
      />
      <StepNav id={broadcast.id} step={step} />

      {step === 1 ? <StepSegment access={access} broadcastId={broadcast.id} name={broadcast.name} segment={segment} /> : null}
      {step === 2 ? <StepTemplate broadcast={broadcast} search={search} templates={templates} /> : null}
      {step === 3 ? <StepSchedule broadcast={broadcast} search={search} /> : null}
      {step === 4 ? <StepReview access={access} broadcast={broadcast} search={search} /> : null}
    </div>
  );
}

// ───────────────────────── Paso 1 ─────────────────────────

function SegmentFields({ segment }: { segment: ReturnType<typeof parseStoredSegment> }) {
  return (
    <>
      <div className="ui-form-row">
        <label className="ui-field ui-form-row__grow">
          <span className="ui-field__label">Etiquetas (separadas por coma)</span>
          <input className="ui-control" defaultValue={segment.tags?.join(", ") ?? ""} name="tags" placeholder="cancelado, interesado" />
        </label>
        <label className="ui-field ui-form-row__grow">
          <span className="ui-field__label">Distrito</span>
          <input className="ui-control" defaultValue={segment.district ?? ""} name="district" placeholder="San Juan de Lurigancho" />
        </label>
      </div>

      <fieldset className="ui-field">
        <legend className="ui-field__label">En qué etapa está su oportunidad</legend>
        <div className="flex flex-wrap gap-3">
          {STAGE_OPTIONS.map(([value, label]) => (
            <label className="flex items-center gap-1 text-sm" key={value}>
              <input defaultChecked={segment.stages?.includes(value)} name="stages" type="checkbox" value={value} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="ui-field">
        <legend className="ui-field__label">Cómo llegó</legend>
        <div className="flex flex-wrap gap-3">
          {ORIGIN_OPTIONS.map(([value, label]) => (
            <label className="flex items-center gap-1 text-sm" key={value}>
              <input defaultChecked={segment.origins?.includes(value)} name="origins" type="checkbox" value={value} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="ui-form-row">
        <label className="ui-field ui-form-row__grow">
          <span className="ui-field__label">Te escribió desde</span>
          <input className="ui-control" defaultValue={segment.lastInboundAfter ?? ""} name="lastInboundAfter" type="date" />
        </label>
        <label className="ui-field ui-form-row__grow">
          <span className="ui-field__label">Te escribió hasta</span>
          <input className="ui-control" defaultValue={segment.lastInboundBefore ?? ""} name="lastInboundBefore" type="date" />
        </label>
        <label className="ui-field ui-form-row__fixed">
          <span className="ui-field__label">Oportunidad abierta</span>
          <select
            className="ui-control ui-control--select"
            defaultValue={segment.hasOpenOpportunity === true ? "si" : segment.hasOpenOpportunity === false ? "no" : ""}
            name="hasOpenOpportunity"
          >
            <option value="">Da igual</option>
            <option value="si">Solo con una abierta</option>
            <option value="no">Solo sin ninguna abierta</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={segment.marketingOptInOnly} name="marketingOptInOnly" type="checkbox" />
        Solo quienes ya aceptaron recibir promociones
      </label>
    </>
  );
}

async function StepSegment({
  access,
  broadcastId,
  name,
  segment,
}: {
  access: { organizationId: string };
  broadcastId: string;
  name: string;
  segment: ReturnType<typeof parseStoredSegment>;
}) {
  const count = await countSegment(access.organizationId, segment);
  return (
    <>
      <SectionPanel
        description="Solo contactos de tu empresa que ya hablaron contigo. La base nacional de Campañas no está acá y no debe estarlo: esa gente nunca dio consentimiento de WhatsApp."
        title="1. A quiénes le escribes"
      >
        <ActionForm action={saveSegmentStep} submitLabel="Guardar y volver a contar">
          <input name="id" type="hidden" value={broadcastId} />
          <label className="ui-field">
            <span className="ui-field__label">Nombre de la difusión</span>
            <input className="ui-control" defaultValue={name} name="name" required />
          </label>
          <SegmentFields segment={segment} />
        </ActionForm>
      </SectionPanel>

      <SectionPanel title="Con estos filtros entran hoy">
        <p className="text-2xl font-semibold">{count} {count === 1 ? "persona" : "personas"}</p>
        <p className="text-sm text-ui-muted">
          Es el universo antes de las exclusiones obligatorias. En el paso 4 verás a cuántas se les puede escribir de verdad
          y quiénes quedan fuera, con el motivo.
        </p>
        <p><Link className="ui-button ui-button--primary" href={`/broadcasts/new?id=${broadcastId}&paso=2`}>Siguiente: qué les dices</Link></p>
      </SectionPanel>
    </>
  );
}

// ───────────────────────── Paso 2 ─────────────────────────

type BroadcastDetail = Awaited<ReturnType<typeof getBroadcast>>;
type UsableTemplate = Awaited<ReturnType<typeof usableTemplates>>[number];

function StepTemplate({
  broadcast,
  search,
  templates,
}: {
  broadcast: BroadcastDetail;
  search: Search;
  templates: UsableTemplate[];
}) {
  const chosenId = one(search, "plantilla") || broadcast.templateId;
  const chosen = templates.find((template) => template.id === chosenId) ?? templates[0];
  if (!chosen) return null;
  const variables = variablesOf(chosen.variables);
  const manual = variables.filter((variable) => variable.source === "manual" || variable.source === "advisor.name");
  const saved = (broadcast.variableValues ?? {}) as Record<string, string>;

  return (
    <>
      <SectionPanel
        description="Solo aparecen las que Meta ya aprobó para un número conectado. Si te falta una, créala en Plantillas."
        title="2. Qué les dices"
      >
        <form className="ui-form-stack" method="get">
          <input name="id" type="hidden" value={broadcast.id} />
          <input name="paso" type="hidden" value="2" />
          <label className="ui-field">
            <span className="ui-field__label">Plantilla</span>
            <select className="ui-control ui-control--select" defaultValue={chosen.id} name="plantilla">
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} — {CATEGORY_LABEL[template.category] ?? template.category}
                  {template.whatsappNumber.displayPhoneNumber ? ` (${template.whatsappNumber.displayPhoneNumber})` : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="ui-button ui-button--secondary" type="submit">Ver esta plantilla</button>
        </form>
      </SectionPanel>

      <SectionPanel
        description={chosen.category === "MARKETING"
          ? "Es una promoción: siempre se cobra y solo la puede lanzar el dueño del negocio."
          : "Es un aviso sobre algo que la persona ya pidió: cuesta menos y la puede lanzar un supervisor."}
        title={`Texto de «${chosen.name}»`}
      >
        <pre className="ui-data">{templateBodyText(chosen.components)}</pre>
        <ActionForm action={saveTemplateStep} submitLabel="Guardar plantilla y variables">
          <input name="id" type="hidden" value={broadcast.id} />
          <input name="templateId" type="hidden" value={chosen.id} />
          {variables.length === 0 ? <p className="text-sm text-ui-muted">Esta plantilla no tiene variables: sale igual para todos.</p> : null}
          {variables.map((variable) => (
            <p className="text-sm text-ui-muted" key={`hint-${variable.index}`}>
              {`{{${variable.index}}}`} {variable.label ? `«${variable.label}»` : ""} → {SOURCE_LABEL[variable.source] ?? variable.source}
            </p>
          ))}
          {manual.map((variable) => (
            <label className="ui-field" key={variable.index}>
              <span className="ui-field__label">
                Valor de {`{{${variable.index}}}`}{variable.label ? ` — ${variable.label}` : ""}
              </span>
              <input
                className="ui-control"
                defaultValue={saved[String(variable.index)] ?? ""}
                name={`var_${variable.index}`}
                placeholder="Se manda igual a todas las personas"
                required
              />
            </label>
          ))}
        </ActionForm>
        <p>
          <Link className="ui-button ui-button--primary" href={`/broadcasts/new?id=${broadcast.id}&paso=3`}>Siguiente: cuándo sale</Link>
        </p>
      </SectionPanel>
    </>
  );
}

// ───────────────────────── Paso 3 ─────────────────────────

function StepSchedule({ broadcast, search }: { broadcast: BroadcastDetail; search: Search }) {
  const limit = dailyLimitForTier(broadcast.whatsappNumber.messagingLimitTier);
  const assumed = dailyLimitIsAssumed(broadcast.whatsappNumber.messagingLimitTier);
  return (
    <SectionPanel
      description="Se envía de lunes a sábado, entre las 9:00 y las 20:00 de Lima. El domingo no sale nada."
      title="3. Cuándo sale"
    >
      <p className="text-sm">
        {limit === null
          ? "Meta no te pone tope diario: todos salen el mismo día."
          : `Meta te deja iniciar conversación con ${limit} personas por día${assumed ? " (todavía no fijó tu tope, así que asumimos el más bajo para no arriesgar el número)" : ""}. Si el segmento es más grande, la difusión se reparte en varios días seguidos y se salta los domingos.`}
      </p>
      <form className="ui-form-stack" method="get">
        <input name="id" type="hidden" value={broadcast.id} />
        <input name="paso" type="hidden" value="4" />
        <div className="ui-form-row">
          <label className="ui-field ui-form-row__grow">
            <span className="ui-field__label">Día</span>
            <input className="ui-control" defaultValue={one(search, "fecha")} name="fecha" required type="date" />
          </label>
          <label className="ui-field ui-form-row__grow">
            <span className="ui-field__label">Hora de Lima</span>
            <input className="ui-control" defaultValue={one(search, "hora") || "09:00"} max="19:59" min="09:00" name="hora" required type="time" />
          </label>
        </div>
        <button className="ui-button ui-button--primary" type="submit">Siguiente: revisar</button>
      </form>
    </SectionPanel>
  );
}

// ───────────────────────── Paso 4 ─────────────────────────

async function StepReview({
  access,
  broadcast,
  search,
}: {
  access: { organizationId: string; role: string; timezone: string };
  broadcast: BroadcastDetail;
  search: Search;
}) {
  const day = one(search, "fecha");
  const time = one(search, "hora") || "09:00";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return (
      <SectionPanel title="Falta la fecha">
        <p>Vuelve al paso 3 y elige cuándo sale.</p>
        <p><Link className="ui-button ui-button--secondary" href={`/broadcasts/new?id=${broadcast.id}&paso=3`}>Volver al paso 3</Link></p>
      </SectionPanel>
    );
  }
  const startAt = zonedTimeToUtc(day, time, access.timezone);
  const inWindow = withinSendWindow(startAt, access.timezone);
  const preview = await previewBroadcast(access.organizationId, broadcast.id, { startDate: startAt });
  const labels = await contactLabels(access.organizationId, preview.excluded.flatMap((group) => group.contactIds.slice(0, 50)));
  const isMarketing = preview.category === "MARKETING";
  const blockedByRole = isMarketing && access.role !== "OWNER";

  return (
    <>
      <SectionPanel
        description={`Sale el ${formatDate(startAt, access.timezone)} a las ${time} de Lima con la plantilla «${preview.templateName}».`}
        title="4. Revisa antes de programar"
      >
        {!inWindow ? (
          <p className="ui-feedback" data-tone="danger">
            Esa hora está fuera de la franja permitida (lunes a sábado, 9:00 a 20:00 de Lima). Vuelve al paso 3.
          </p>
        ) : null}
        <MetricGroup label="Resumen de la difusión">
          <Metric
            emphasis="hero"
            hint={`de ${preview.totalInSegment} que entran por los filtros`}
            label="Le llega a"
            value={preview.recipients}
          />
          <Metric hint="por las reglas de abajo" label="Quedan fuera" value={preview.totalInSegment - preview.recipients} />
          <Metric
            hint={`${preview.recipients} × US$ ${preview.ratePerMessageUsd} de ${isMarketing ? "promoción" : "aviso"}`}
            label="Costo aprox."
            value={`S/ ${preview.estimatedCostPen.toFixed(2)}`}
          />
          <Metric
            hint={preview.dailyLimit === null
              ? "sin tope diario"
              : `tope de ${preview.dailyLimit} por día${preview.dailyLimitAssumed ? " (asumido)" : ""}`}
            label="Días de envío"
            value={preview.days.length}
          />
        </MetricGroup>
      </SectionPanel>

      {preview.days.length > 1 ? (
        <SectionPanel description="No caben todos en un día: salen de a tandas, saltando los domingos." title="Cómo se reparte">
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Día</th><th>Cuántos salen</th></tr></thead>
              <tbody>
                {preview.days.map((bucket) => (
                  <tr key={bucket.day}><td>{bucket.day}</td><td>{bucket.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionPanel>
      ) : null}

      <SectionPanel
        description="Estas reglas no se pueden quitar: protegen el número y evitan que alguien reciba lo que pidió no recibir."
        title={`Quiénes quedan fuera (${preview.totalInSegment - preview.recipients})`}
      >
        {preview.excluded.length === 0 ? (
          <p className="text-sm text-ui-muted">Nadie queda fuera con estos filtros.</p>
        ) : (
          preview.excluded.map((group) => (
            <details key={group.reason}>
              <summary>
                <strong>{group.count}</strong> {EXCLUSION_TEXT[group.reason as ExclusionReason] ?? group.reasonText}
              </summary>
              <ul>
                {group.contactIds.slice(0, 50).map((contactId) => (
                  <li key={contactId}>{labels.get(contactId) ?? contactId}</li>
                ))}
                {group.contactIds.length > 50 ? <li className="text-xs text-ui-muted">y {group.contactIds.length - 50} más</li> : null}
              </ul>
            </details>
          ))
        )}
      </SectionPanel>

      <SectionPanel description="Así le va a llegar a tres personas del segmento, con sus datos reales." title="Vistas previas">
        {preview.sample.length === 0 ? (
          <p className="text-sm text-ui-muted">Sin destinatarios no hay nada que previsualizar.</p>
        ) : (
          preview.sample.map((item) => (
            <div key={item.contactId}>
              <p className="ui-label-eyebrow">{item.name}</p>
              <pre className="ui-data">{item.body}</pre>
            </div>
          ))
        )}
      </SectionPanel>

      <SectionPanel title="Programar">
        {blockedByRole ? (
          <p className="ui-feedback" data-tone="danger">
            Es una promoción: la lanza el dueño del negocio. Pídele que entre y la programe.
          </p>
        ) : null}
        {!blockedByRole && inWindow && preview.recipients > 0 ? (
          <ActionForm
            action={scheduleFromWizard}
            confirm={`Se congela la lista de ${preview.recipients} personas y sale el ${day} a las ${time}. ¿Programar?`}
            submitLabel="Programar"
          >
            <input name="id" type="hidden" value={broadcast.id} />
            <input name="fecha" type="hidden" value={day} />
            <input name="hora" type="hidden" value={time} />
          </ActionForm>
        ) : null}
        {preview.recipients === 0 ? (
          <p className="ui-feedback" data-tone="danger">No queda nadie a quien escribirle. Cambia los filtros en el paso 1.</p>
        ) : null}
      </SectionPanel>
    </>
  );
}
