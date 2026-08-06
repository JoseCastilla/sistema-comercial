"use client";

import { useId, useRef } from "react";

import { Button } from "./button";

export function ConfirmSubmitButton({ triggerLabel, title, description, confirmLabel = "Confirmar" }: { triggerLabel: string; title: string; description: string; confirmLabel?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return <>
    <Button onClick={() => dialogRef.current?.showModal()} type="button" variant="danger">{triggerLabel}</Button>
    <dialog aria-describedby={descriptionId} aria-labelledby={titleId} className="ui-confirm-dialog" ref={dialogRef}>
      <div className="ui-confirm-dialog__content">
        <p className="ui-confirm-dialog__eyebrow">Confirmar acción</p>
        <h2 className="ui-confirm-dialog__title" id={titleId}>{title}</h2>
        <p className="ui-confirm-dialog__description" id={descriptionId}>{description}</p>
        <div className="ui-confirm-dialog__actions">
          <Button onClick={() => dialogRef.current?.close()} type="button" variant="secondary">Cancelar</Button>
          <Button type="submit" variant="danger">{confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  </>;
}
