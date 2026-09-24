"use client";

import { useMemo, useState } from "react";

import { detectVariables, promotionalWordsIn } from "@/server/templates/render";
import { TEMPLATE_LIMITS, VARIABLE_SOURCES, type TemplateCategoryValue } from "@/server/templates/validation";

/**
 * Campos del editor de plantillas. Es cliente porque las variables aparecen
 * mientras se escribe: por cada {{n}} del cuerpo hay que decir de dónde sale
 * el dato y dar un ejemplo, que Meta exige para revisarla.
 */

const CATEGORY_HELP: { value: TemplateCategoryValue; title: string; help: string }[] = [
  {
    value: "UTILITY",
    title: "Aviso de algo que ya pidió",
    help: "Su entrega, su cita, su pedido. Sin ofertas. Es gratis si la persona te escribió en las últimas 24 horas.",
  },
  {
    value: "MARKETING",
    title: "Oferta o volver a contactar",
    help: "Promociones o retomar a alguien que no compró. Meta cobra cada envío.",
  },
];

function counter(text: string, limit: number): { text: string; over: boolean } {
  const length = [...text].length;
  return { text: `${length} / ${limit}`, over: length > limit };
}

export function TemplateFields({ numbers }: { numbers: { id: string; label: string }[] }) {
  const [category, setCategory] = useState<TemplateCategoryValue>("UTILITY");
  const [header, setHeader] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [buttonCount, setButtonCount] = useState(0);
  const [examples, setExamples] = useState<Record<number, string>>({});

  const variables = useMemo(() => detectVariables(body), [body]);
  const promotional = useMemo(
    () => (category === "UTILITY" ? promotionalWordsIn(`${header} ${body} ${footer}`) : []),
    [category, header, body, footer],
  );
  const preview = useMemo(() => {
    const filled = body.replace(/\{\{(\d+)\}\}/g, (_match, index: string) => examples[Number(index)]?.trim() || `{{${index}}}`);
    return [header.trim(), filled.trim(), footer.trim()].filter(Boolean).join("\n\n");
  }, [header, body, footer, examples]);

  const bodyCount = counter(body, TEMPLATE_LIMITS.body);
  const headerCount = counter(header, TEMPLATE_LIMITS.header);
  const footerCount = counter(footer, TEMPLATE_LIMITS.footer);

  return (
    <>
      <div className="ui-form-row">
        <label className="ui-field ui-form-row__grow">
          <span className="ui-field__label">Desde qué número se enviará</span>
          <select className="ui-control ui-control--select" name="whatsappNumberId" required>
            {numbers.map((number) => (
              <option key={number.id} value={number.id}>{number.label}</option>
            ))}
          </select>
        </label>
        <label className="ui-field ui-form-row__grow">
          <span className="ui-field__label">Nombre interno</span>
          <input className="ui-control" name="name" pattern="[A-Za-z0-9 _-]+" placeholder="recordatorio_de_cita" required />
          <span className="ui-field__hint">Solo minúsculas, números y guiones bajos. Lo que escribas se acomoda solo.</span>
        </label>
        <label className="ui-field ui-form-row__fixed">
          <span className="ui-field__label">Idioma</span>
          <select className="ui-control ui-control--select" defaultValue="es" name="language">
            <option value="es">Español (es)</option>
            <option value="es_MX">Español de México (es_MX)</option>
            <option value="en_US">Inglés (en_US)</option>
          </select>
        </label>
      </div>

      <fieldset className="ui-field">
        <legend className="ui-field__label">¿Para qué sirve esta plantilla?</legend>
        {CATEGORY_HELP.map((option) => (
          <label key={option.value} className="flex items-start gap-2 py-1">
            <input
              checked={category === option.value}
              name="category"
              onChange={() => setCategory(option.value)}
              type="radio"
              value={option.value}
            />
            <span>
              <strong>{option.title}</strong>
              <span className="block text-xs text-ui-muted">{option.help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="ui-field">
        <span className="ui-field__label">Encabezado (opcional)</span>
        <input className="ui-control" maxLength={TEMPLATE_LIMITS.header} name="header" onChange={(event) => setHeader(event.target.value)} value={header} />
        <span className="ui-field__hint" data-tone={headerCount.over ? "danger" : undefined}>
          Texto fijo, sin variables. {headerCount.text}
        </span>
      </label>

      <label className="ui-field">
        <span className="ui-field__label">Mensaje</span>
        <textarea
          className="ui-control"
          name="body"
          onChange={(event) => setBody(event.target.value)}
          placeholder="Hola {{1}}, tu chip llega el {{2}}. Si no vas a estar, respóndenos y lo movemos."
          required
          rows={5}
          value={body}
        />
        <span className="ui-field__hint">
          Escribe {"{{1}}"}, {"{{2}}"}… donde vaya un dato que cambia en cada envío. {bodyCount.text}
        </span>
      </label>

      {promotional.length ? (
        <p className="ui-feedback" data-tone="warning">
          Dice «{promotional.join("», «")}»: Meta va a pasar esta plantilla a Marketing y te cobrará cada envío. Si es un aviso
          de algo que la persona ya pidió, quita esas palabras.
        </p>
      ) : null}

      {variables.length ? (
        <div className="ui-form-stack">
          <p className="ui-label-eyebrow">De dónde sale cada dato</p>
          {variables.map((index) => (
            <div key={index} className="ui-form-row">
              <label className="ui-field ui-form-row__fixed">
                <span className="ui-field__label">{`{{${index}}} sale de`}</span>
                <select className="ui-control ui-control--select" defaultValue="manual" name={`variableSource_${index}`}>
                  {VARIABLE_SOURCES.map(([source, label]) => (
                    <option key={source} value={source}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="ui-field ui-form-row__grow">
                <span className="ui-field__label">Cómo llamarlo</span>
                <input className="ui-control" defaultValue={`Variable ${index}`} name={`variableLabel_${index}`} />
              </label>
              <label className="ui-field ui-form-row__grow">
                <span className="ui-field__label">Ejemplo para Meta</span>
                <input
                  className="ui-control"
                  name={`variableExample_${index}`}
                  onChange={(event) => setExamples((current) => ({ ...current, [index]: event.target.value }))}
                  required
                  value={examples[index] ?? ""}
                />
              </label>
            </div>
          ))}
        </div>
      ) : null}

      <label className="ui-field">
        <span className="ui-field__label">Pie (opcional)</span>
        <input className="ui-control" maxLength={TEMPLATE_LIMITS.footer} name="footer" onChange={(event) => setFooter(event.target.value)} value={footer} />
        <span className="ui-field__hint" data-tone={footerCount.over ? "danger" : undefined}>
          Una línea corta, por ejemplo el nombre del negocio. {footerCount.text}
        </span>
      </label>

      <div className="ui-form-stack">
        <p className="ui-label-eyebrow">Botones (hasta {TEMPLATE_LIMITS.buttons})</p>
        {Array.from({ length: buttonCount }, (_value, position) => position + 1).map((index) => (
          <div key={index} className="ui-form-row">
            <label className="ui-field ui-form-row__fixed">
              <span className="ui-field__label">Qué hace</span>
              <select className="ui-control ui-control--select" defaultValue="QUICK_REPLY" name={`buttonType_${index}`}>
                <option value="QUICK_REPLY">Responde con este texto</option>
                <option value="URL">Abre una página</option>
              </select>
            </label>
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Texto del botón</span>
              <input className="ui-control" maxLength={TEMPLATE_LIMITS.buttonText} name={`buttonText_${index}`} />
            </label>
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Dirección (solo si abre una página)</span>
              <input className="ui-control" name={`buttonUrl_${index}`} placeholder="https://" type="url" />
            </label>
          </div>
        ))}
        <div className="flex gap-2">
          {buttonCount < TEMPLATE_LIMITS.buttons ? (
            <button className="ui-button ui-button--quiet" onClick={() => setButtonCount((count) => count + 1)} type="button">
              Agregar botón
            </button>
          ) : null}
          {buttonCount > 0 ? (
            <button className="ui-button ui-button--quiet" onClick={() => setButtonCount((count) => count - 1)} type="button">
              Quitar el último
            </button>
          ) : null}
        </div>
      </div>

      {preview ? (
        <div className="ui-surface ui-surface--padded">
          <p className="ui-label-eyebrow">Así lo verá la persona</p>
          <p className="whitespace-pre-line">{preview}</p>
        </div>
      ) : null}
    </>
  );
}
