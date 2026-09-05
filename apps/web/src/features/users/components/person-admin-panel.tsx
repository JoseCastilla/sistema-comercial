import Link from "next/link";

import { StatusBadge } from "@repo/ui/status-badge";

import { AssignTeamFromPersonForm } from "@/features/teams/components/assign-team-from-person-form";

import {
  personRoleLabels,
  personStatusLabels,
  personStatusTones,
} from "../person-labels";
import {
  PersonLifecycleActions,
  type PersonLifecyclePerson,
} from "./person-lifecycle-actions";
import { ResetUserPasswordForm } from "./reset-user-password-form";

import type {
  PersonLifecycleHistoryItem,
  PersonLifecycleOverview,
} from "../server/person-lifecycle.types";

export interface PersonAdminPanelPerson extends PersonLifecyclePerson {
  emailVerified: boolean;
  sinceLabel: string;
  /** Equipos que supervisa hoy, por nombre. */
  supervisedTeamNames: string[];
  /** Activo y sin equipo operativo (asesor) o sin equipo a cargo (supervisor). */
  needsTeam: boolean;
}

/**
 * Panel de administración de una persona — SPEC-043 UX-02.
 *
 * La fila del directorio compara; aquí se administra. Una sola persona a la
 * vez, con su nombre y correo siempre visibles, sus relaciones comerciales,
 * las acciones que su estado permite (SPEC-042) y su historial. Abrirlo no
 * cambia nada; cerrarlo devuelve el foco a la fila de origen.
 */
export function PersonAdminPanel({
  person,
  isCurrentUser,
  overview,
  destinationCandidates,
  teams,
  history,
  closeHref,
}: {
  person: PersonAdminPanelPerson;
  isCurrentUser: boolean;
  overview: PersonLifecycleOverview;
  destinationCandidates: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string }>;
  history: PersonLifecycleHistoryItem[];
  closeHref: string;
}) {
  const requiresTeam = person.role === "AGENT" || person.role === "SUPERVISOR";

  return (
    <aside
      aria-labelledby="panel-persona-titulo"
      className="ui-admin-panel"
      id="panel-persona"
    >
      <header className="ui-admin-panel__header">
        <div>
          <p className="ui-admin-panel__eyebrow">Administrar</p>
          <h2 className="ui-admin-panel__title" id="panel-persona-titulo">
            {person.name}
          </h2>
          <p className="ui-admin-panel__email">{person.email}</p>
          <p className="ui-admin-panel__badges">
            <StatusBadge tone="neutral">
              {personRoleLabels[person.role] ?? person.role}
            </StatusBadge>
            <StatusBadge tone={personStatusTones[person.status] ?? "neutral"}>
              {personStatusLabels[person.status] ?? person.status}
            </StatusBadge>
          </p>
        </div>
        <Link className="ui-admin-panel__close" href={closeHref}>
          Cerrar
        </Link>
      </header>

      <section className="ui-admin-panel__section">
        <h3>Identidad</h3>
        <dl>
          <div>
            <dt>Desde</dt>
            <dd>{person.sinceLabel}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>
              {person.emailVerified ? "Verificado" : "Pendiente de verificar"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="ui-admin-panel__section">
        <h3>Relaciones comerciales</h3>
        <dl>
          <div>
            <dt>Equipo comercial</dt>
            <dd>
              {person.primaryTeamName ??
                (requiresTeam ? (
                  <span className="text-ui-warning">Sin equipo operativo</span>
                ) : (
                  "No requiere equipo"
                ))}
            </dd>
          </div>
          {person.role === "SUPERVISOR" ? (
            <div>
              <dt>Supervisa</dt>
              <dd>
                {person.supervisedTeamNames.length > 0
                  ? person.supervisedTeamNames.join(", ")
                  : "Ningún equipo todavía"}
              </dd>
            </div>
          ) : null}
        </dl>
        {/* SPEC-043 UX-04: la persona incompleta se completa desde aquí, con
            la misma acción y las mismas reglas que en Equipos. */}
        {person.needsTeam && teams.length > 0 ? (
          <AssignTeamFromPersonForm
            mode={person.role === "SUPERVISOR" ? "SUPERVISOR" : "AGENT"}
            teams={teams}
            userId={person.id}
          />
        ) : null}
      </section>

      {requiresTeam ? (
        <section className="ui-admin-panel__section">
          <h3>Ciclo de vida</h3>
          <PersonLifecycleActions
            destinationCandidates={destinationCandidates}
            isCurrentUser={isCurrentUser}
            overview={overview}
            person={person}
            teams={teams}
          />
        </section>
      ) : null}

      <section className="ui-admin-panel__section">
        <h3>Seguridad</h3>
        <ResetUserPasswordForm
          isCurrentUser={isCurrentUser}
          userEmail={person.email}
          userId={person.id}
        />
      </section>

      <section className="ui-admin-panel__section">
        <h3>Historial</h3>
        {history.length === 0 ? (
          <p className="text-xs text-ui-muted">
            Sin bajas, reingresos ni promociones registrados.
          </p>
        ) : (
          <ol className="space-y-1.5 text-xs">
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
        )}
      </section>
    </aside>
  );
}
