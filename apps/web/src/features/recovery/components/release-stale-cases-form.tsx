"use client";

import { useActionState, useState } from "react";

import { formatCount } from "@repo/ui/format";
import { recoveryStaleDays } from "@repo/validation";

import { Button } from "@/components/ui/button";

import { releaseStaleCasesAction } from "../server/release-stale-cases-action";

import type { RecoveryTriageActionState } from "../server/recovery-action.types";

const initialState: RecoveryTriageActionState = { type: "idle", message: "" };

/**
 * Devolver a los casos libres del equipo — SPEC-070 BR-010. Mueve casos de un
 * asesor, así que pide confirmar diciendo cuántos y de quién; el servidor
 * vuelve a comprobar cuáles cumplen al momento de hacerlo.
 */
export function ReleaseStaleCasesForm({
  advisorId,
  advisorName,
  count,
}: {
  advisorId: string;
  advisorName: string;
  count: number;
}) {
  const [state, formAction, pending] = useActionState(
    releaseStaleCasesAction,
    initialState,
  );
  const [confirming, setConfirming] = useState(false);
  const cases = `${formatCount(count)} ${count === 1 ? "caso" : "casos"}`;

  if (state.type !== "idle") {
    return (
      <p
        className={`text-xs sm:col-span-2 ${state.type === "error" ? "text-ui-danger" : "text-ui-success"}`}
        role="status"
      >
        {state.message}
      </p>
    );
  }

  if (!confirming) {
    return (
      <Button
        onClick={() => setConfirming(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        Devolver {cases} a los casos libres
      </Button>
    );
  }

  return (
    // En su propia fila: la pregunta no aplasta la línea del asesor.
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-2 rounded-lg bg-ui-subtle p-3 sm:col-span-2"
    >
      <input name="advisorId" type="hidden" value={advisorId} />
      <span className="text-xs text-ui-text">
        ¿Devolver {cases} de {advisorName} que llevan {recoveryStaleDays} días o
        más sin gestión? Dejan de ser suyos y cualquiera del equipo puede
        tomarlos.
      </span>
      <Button disabled={pending} size="sm" type="submit" variant="accent">
        {pending ? "Devolviendo…" : "Sí, devolver"}
      </Button>
      <Button
        disabled={pending}
        onClick={() => setConfirming(false)}
        size="sm"
        type="button"
        variant="ghost"
      >
        Cancelar
      </Button>
    </form>
  );
}
