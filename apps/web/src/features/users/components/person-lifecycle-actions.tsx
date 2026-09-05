"use client";

import { useActionState, useState } from "react";

import { personDisableReasonOptions } from "@repo/validation";

import { disablePersonAction } from "../server/disable-person-action";
import { promotePersonAction } from "../server/promote-person-action";
import { reenterPersonAction } from "../server/reenter-person-action";

import type {
  PersonLifecycleActionState,
  PersonLifecycleHistoryItem,
  PersonLifecycleOverview,
} from "../server/person-lifecycle.types";

const initialState: PersonLifecycleActionState = { type: "idle", message: "" };

type Panel = "baja" | "promover" | "reingresar" | "historial";

export interface PersonLifecyclePerson {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";
  status: "INVITED" | "ACTIVE" | "DISABLED";
  primaryTeamId: string | null;
  primaryTeamName: string | null;
  /** Equipos que quedarían sin ningún supervisor si esta persona se va. */
  teamsLeftWithoutSupervisor: string[];
}

const inputClass =
  "w-full rounded-lg border border-ui-border-strong bg-ui-surface px-3 py-2 text-sm text-ui-text outline-none focus:ring-2 focus:ring-ui-border";
const toggleClass =
  "rounded-lg border border-ui-border-strong bg-ui-surface px-3 py-2 text-xs font-medium text-ui-muted transition hover:bg-ui-subtle";

function Feedback({ state }: { state: PersonLifecycleActionState }) {
  if (state.type === "idle") return null;

  return (
    <p
      aria-live="polite"
      className={
        state.type === "success"
          ? "text-xs font-medium leading-5 text-ui-success"
          : "text-xs font-medium leading-5 text-ui-danger"
      }
      role={state.type === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

/**
 * Baja, reingreso y promoción desde la fila de Personas — SPEC-042.
 *
 * Cada acción se abre al pedirla y, antes de confirmar, dice con números qué
 * va a pasar (BR-006): cuántas ventas se quedan a su nombre, cuántos casos se
 * liberan o a quién se entregan, qué equipos quedan sin supervisor. Nada se
 * ejecuta sin esa confirmación y sin motivo.
 */
export function PersonLifecycleActions({
  person,
  isCurrentUser,
  overview,
  destinationCandidates,
  teams,
  history,
}: {
  person: PersonLifecyclePerson;
  isCurrentUser: boolean;
  overview: PersonLifecycleOverview;
  /** Asesores activos con venta de su mismo equipo, para entregar la cartera. */
  destinationCandidates: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string }>;
  history: PersonLifecycleHistoryItem[];
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const commercial = person.role === "AGENT" || person.role === "SUPERVISOR";
  const canDisable = commercial && person.status === "ACTIVE" && !isCurrentUser;
  const canPromote =
    person.role === "AGENT" &&
    person.status === "ACTIVE" &&
    person.primaryTeamId !== null;
  const canReenter = commercial && person.status === "DISABLED";

  const toggle = (next: Panel) =>
    setPanel((current) => (current === next ? null : next));

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap justify-end gap-1.5">
        {canDisable ? (
          <button
            aria-expanded={panel === "baja"}
            className={toggleClass}
            onClick={() => toggle("baja")}
            type="button"
          >
            {panel === "baja" ? "Cancelar" : "Dar de baja"}
          </button>
        ) : null}
        {canPromote ? (
          <button
            aria-expanded={panel === "promover"}
            className={toggleClass}
            onClick={() => toggle("promover")}
            type="button"
          >
            {panel === "promover" ? "Cancelar" : "Promover a supervisor"}
          </button>
        ) : null}
        {canReenter ? (
          <button
            aria-expanded={panel === "reingresar"}
            className={toggleClass}
            onClick={() => toggle("reingresar")}
            type="button"
          >
            {panel === "reingresar" ? "Cancelar" : "Reingresar"}
          </button>
        ) : null}
        {history.length > 0 ? (
          <button
            aria-expanded={panel === "historial"}
            className={toggleClass}
            onClick={() => toggle("historial")}
            type="button"
          >
            Historial ({history.length})
          </button>
        ) : null}
      </div>

      {panel === "baja" ? (
        <DisablePanel
          destinationCandidates={destinationCandidates}
          overview={overview}
          person={person}
        />
      ) : null}
      {panel === "promover" ? (
        <PromotePanel person={person} teams={teams} />
      ) : null}
      {panel === "reingresar" ? (
        <ReenterPanel person={person} teams={teams} />
      ) : null}
      {panel === "historial" ? (
        <ol className="w-full space-y-1.5 rounded-xl border border-ui-border bg-ui-subtle p-3 text-left text-xs sm:min-w-80">
          {history.map((item, index) => (
            <li key={`${item.createdAtLabel}-${index}`}>
              <span className="font-medium text-ui-text">{item.label}</span>{" "}
              <span className="text-ui-muted">
                · {item.createdAtLabel} · {item.actorName}
              </span>
              <span className="block text-ui-muted">{item.reason}</span>
              {item.summary ? (
                <span className="block text-ui-muted">{item.summary}</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function DisablePanel({
  person,
  overview,
  destinationCandidates,
}: {
  person: PersonLifecyclePerson;
  overview: PersonLifecycleOverview;
  destinationCandidates: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(
    disablePersonAction,
    initialState,
  );
  const [reason, setReason] = useState("");
  const [destination, setDestination] = useState("");
  const total = overview.internalCases + overview.campaignCases;

  return (
    <form
      action={action}
      className="w-full space-y-3 rounded-xl border border-ui-border bg-ui-subtle p-3 text-left sm:min-w-80"
    >
      <input name="userId" type="hidden" value={person.id} />
      <p className="text-xs font-medium text-ui-text">
        Dar de baja a {person.name}
      </p>
      <ul className="space-y-1 text-xs leading-5 text-ui-muted">
        <li>
          Deja de entrar al sistema hoy mismo; sus sesiones abiertas se cierran.
          Nada de su historia se borra.
        </li>
        <li>
          {overview.openOrders === 0
            ? "No tiene ventas abiertas."
            : `${overview.openOrders} venta(s) abiertas siguen a su nombre y en su equipo; el supervisor las gestiona.`}
        </li>
        <li>
          {total === 0
            ? "No tiene casos de recupero asignados."
            : `${overview.internalCases} caso(s) de recupero de ventas ${destination ? "se entregan al asesor elegido" : "quedan sin responsable en su equipo"}; ${overview.campaignCases} de Campañas vuelven al pool del equipo.`}
        </li>
        <li>
          Las ventas que lleguen por su correo entrarán al pool sin asignar.
        </li>
        {person.teamsLeftWithoutSupervisor.length > 0 ? (
          <li className="text-ui-warning">
            {person.teamsLeftWithoutSupervisor.join(", ")} quedaría sin ningún
            supervisor.
          </li>
        ) : null}
      </ul>

      <label className="block space-y-1 text-xs">
        <span className="font-medium text-ui-muted">Motivo</span>
        <select
          className={inputClass}
          name="reason"
          onChange={(event) => setReason(event.target.value)}
          required
          value={reason}
        >
          <option value="">Elige un motivo</option>
          {personDisableReasonOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {state.fieldErrors?.reason ? (
          <span className="text-ui-danger">{state.fieldErrors.reason}</span>
        ) : null}
      </label>

      {reason === "OTRO" ? (
        <label className="block space-y-1 text-xs">
          <span className="font-medium text-ui-muted">Cuál</span>
          <input
            className={inputClass}
            maxLength={160}
            minLength={4}
            name="reasonDetail"
            required
            type="text"
          />
          {state.fieldErrors?.reasonDetail ? (
            <span className="text-ui-danger">
              {state.fieldErrors.reasonDetail}
            </span>
          ) : null}
        </label>
      ) : null}

      {overview.internalCases > 0 && destinationCandidates.length > 0 ? (
        <label className="block space-y-1 text-xs">
          <span className="font-medium text-ui-muted">
            Entregar sus casos de recupero a
          </span>
          <select
            className={inputClass}
            name="destinationUserId"
            onChange={(event) => setDestination(event.target.value)}
            value={destination}
          >
            <option value="">Nadie: quedan sin responsable en su equipo</option>
            {destinationCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.destinationUserId ? (
            <span className="text-ui-danger">
              {state.fieldErrors.destinationUserId}
            </span>
          ) : null}
        </label>
      ) : null}

      <Feedback state={state} />
      <button
        className="rounded-lg bg-ui-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending || state.type === "success"}
        type="submit"
      >
        {pending ? "Dando de baja…" : "Confirmar la baja"}
      </button>
    </form>
  );
}

function PromotePanel({
  person,
  teams,
}: {
  person: PersonLifecyclePerson;
  teams: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(
    promotePersonAction,
    initialState,
  );
  const [teamId, setTeamId] = useState(person.primaryTeamId ?? "");
  const [keepsSelling, setKeepsSelling] = useState(true);
  const movesSale =
    keepsSelling && teamId !== "" && teamId !== person.primaryTeamId;

  return (
    <form
      action={action}
      className="w-full space-y-3 rounded-xl border border-ui-border bg-ui-subtle p-3 text-left sm:min-w-80"
    >
      <input name="userId" type="hidden" value={person.id} />
      <p className="text-xs font-medium text-ui-text">
        Promover a {person.name} a supervisor
      </p>
      <label className="block space-y-1 text-xs">
        <span className="font-medium text-ui-muted">
          Equipo que va a supervisar
        </span>
        <select
          className={inputClass}
          name="teamId"
          onChange={(event) => setTeamId(event.target.value)}
          required
          value={teamId}
        >
          <option value="">Elige el equipo</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.teamId ? (
          <span className="text-ui-danger">{state.fieldErrors.teamId}</span>
        ) : null}
      </label>
      <label className="flex items-start gap-2 text-xs leading-5 text-ui-text">
        <input
          checked={keepsSelling}
          className="mt-1"
          name="keepsSelling"
          onChange={(event) => setKeepsSelling(event.target.checked)}
          type="checkbox"
        />
        <span>
          Sigue vendiendo.{" "}
          <span className="text-ui-muted">
            {keepsSelling
              ? movesSale
                ? `Su venta pasa de ${person.primaryTeamName ?? "su equipo"} al equipo que supervisa; sus ventas anteriores conservan el equipo registrado.`
                : "Las ventas que lleguen por su correo se le siguen asignando; no puede cerrar ni cancelar las suyas."
              : "Su membresía de venta se cierra hoy; las ventas que lleguen por su correo irán al pool. Lo histórico no cambia."}
          </span>
        </span>
      </label>
      <Feedback state={state} />
      <button
        className="rounded-lg bg-ui-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending || state.type === "success"}
        type="submit"
      >
        {pending ? "Promoviendo…" : "Confirmar la promoción"}
      </button>
    </form>
  );
}

function ReenterPanel({
  person,
  teams,
}: {
  person: PersonLifecyclePerson;
  teams: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(
    reenterPersonAction,
    initialState,
  );
  const [role, setRole] = useState<"AGENT" | "SUPERVISOR">(
    person.role === "SUPERVISOR" ? "SUPERVISOR" : "AGENT",
  );

  return (
    <form
      action={action}
      className="w-full space-y-3 rounded-xl border border-ui-border bg-ui-subtle p-3 text-left sm:min-w-80"
    >
      <input name="userId" type="hidden" value={person.id} />
      <p className="text-xs font-medium text-ui-text">
        Reingresar a {person.name}
      </p>
      <p className="text-xs leading-5 text-ui-muted">
        Vuelve la misma persona, con su historia de ventas y gestiones intacta.
        No recupera los casos que se liberaron al darse de baja.
      </p>
      <label className="block space-y-1 text-xs">
        <span className="font-medium text-ui-muted">Rol</span>
        <select
          className={inputClass}
          name="role"
          onChange={(event) =>
            setRole(event.target.value as "AGENT" | "SUPERVISOR")
          }
          value={role}
        >
          <option value="AGENT">Asesor</option>
          <option value="SUPERVISOR">Supervisor</option>
        </select>
      </label>
      <label className="block space-y-1 text-xs">
        <span className="font-medium text-ui-muted">
          {role === "AGENT" ? "Equipo principal" : "Equipo que supervisa"}
        </span>
        <select className={inputClass} defaultValue="" name="teamId" required>
          <option value="">Elige el equipo</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.teamId ? (
          <span className="text-ui-danger">{state.fieldErrors.teamId}</span>
        ) : null}
      </label>
      {role === "SUPERVISOR" ? (
        <label className="flex items-center gap-2 text-xs text-ui-text">
          <input defaultChecked={false} name="keepsSelling" type="checkbox" />
          También vende en ese equipo
        </label>
      ) : null}
      <label className="block space-y-1 text-xs">
        <span className="font-medium text-ui-muted">
          Correo (déjalo vacío para conservar {person.email})
        </span>
        <input
          autoComplete="off"
          className={inputClass}
          maxLength={254}
          name="newEmail"
          placeholder={person.email}
          type="email"
        />
        {state.fieldErrors?.newEmail ? (
          <span className="text-ui-danger">{state.fieldErrors.newEmail}</span>
        ) : null}
      </label>
      <label className="block space-y-1 text-xs">
        <span className="font-medium text-ui-muted">Contraseña nueva</span>
        <input
          autoComplete="new-password"
          className={inputClass}
          maxLength={128}
          minLength={12}
          name="newPassword"
          required
          type="password"
        />
        {state.fieldErrors?.newPassword ? (
          <span className="text-ui-danger">
            {state.fieldErrors.newPassword}
          </span>
        ) : null}
      </label>
      <label className="block space-y-1 text-xs">
        <span className="font-medium text-ui-muted">Repite la contraseña</span>
        <input
          autoComplete="new-password"
          className={inputClass}
          maxLength={128}
          minLength={12}
          name="confirmPassword"
          required
          type="password"
        />
        {state.fieldErrors?.confirmPassword ? (
          <span className="text-ui-danger">
            {state.fieldErrors.confirmPassword}
          </span>
        ) : null}
      </label>
      <Feedback state={state} />
      <button
        className="rounded-lg bg-ui-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending || state.type === "success"}
        type="submit"
      >
        {pending ? "Reingresando…" : "Confirmar el reingreso"}
      </button>
    </form>
  );
}
