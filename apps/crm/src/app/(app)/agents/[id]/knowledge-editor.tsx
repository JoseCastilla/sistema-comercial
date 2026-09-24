"use client";

import { useState } from "react";

/**
 * Editor de un artículo. Avisa mientras se escribe si el texto trae montos:
 * los precios viven en el catálogo de planes, no en un documento que se
 * desactualiza solo (SPEC-058 BR-004).
 */
export function KnowledgeEditor({ defaultTitle = "", defaultContent = "" }: { defaultTitle?: string; defaultContent?: string }) {
  const [content, setContent] = useState(defaultContent);
  const mentionsMoney = /S\/|soles/i.test(content);

  return (
    <>
      <label className="ui-field">
        <span className="ui-field__label">Título</span>
        <input className="ui-control" defaultValue={defaultTitle} maxLength={200} name="title" placeholder="Requisitos de portabilidad" required />
      </label>
      <label className="ui-field">
        <span className="ui-field__label">Contenido</span>
        <textarea
          className="ui-control"
          name="content"
          onChange={(event) => setContent(event.target.value)}
          required
          rows={6}
          value={content}
        />
        {mentionsMoney ? (
          <span className="ui-field__error">
            Este texto tiene montos. Quítalos: el precio que diga el asistente sale del catálogo de planes, así que aquí quedaría viejo sin que nadie se dé cuenta.
          </span>
        ) : (
          <span className="ui-field__hint">Corto y de un solo tema. Sin precios, promociones ni plazos: eso lo consulta el asistente en el catálogo.</span>
        )}
      </label>
    </>
  );
}
