"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { resetUserPasswordAction } from "../server/reset-user-password-action";

import type { ResetUserPasswordActionState } from "../server/user-action.types";

const initialState: ResetUserPasswordActionState = {
  type: "idle",
  message: "",
};

export function ResetUserPasswordForm({
  userId,
  userEmail,
  isCurrentUser,
}: {
  userId: string;
  userEmail: string;
  isCurrentUser: boolean;
}) {
  const [open, setOpen] = useState(false);

  const [state, formAction, pending] = useActionState(
    resetUserPasswordAction,
    initialState,
  );

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.type === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <div className="sm:text-right">
      <button
        aria-expanded={open}
        className="rounded-lg border border-ui-border-strong bg-ui-surface px-3 py-2 text-xs font-medium text-ui-muted transition hover:bg-ui-subtle"
        onClick={() => {
          setOpen((current) => !current);
        }}
        type="button"
      >
        {open ? "Cerrar seguridad" : "Seguridad"}
      </button>

      {open ? (
        <div className="mt-3 rounded-xl border border-ui-border bg-ui-subtle p-3 text-left sm:min-w-72">
          <p className="text-xs font-medium text-ui-text">
            Nueva contraseña para
          </p>

          <p className="mt-1 break-all text-xs text-ui-muted">{userEmail}</p>

          {isCurrentUser ? (
            <p className="mt-3 rounded-lg border border-ui-warning-border bg-ui-warning-soft px-3 py-2 text-xs leading-5 text-ui-warning">
              Estás modificando tu propia cuenta. Al guardar, tu sesión actual
              será revocada y tendrás que iniciar sesión nuevamente.
            </p>
          ) : (
            <p className="mt-3 text-xs leading-5 text-ui-muted">
              Todas las sesiones activas de este usuario serán cerradas.
            </p>
          )}

          <form action={formAction} className="mt-3 space-y-3" ref={formRef}>
            <input name="userId" type="hidden" value={userId} />

            <label className="block space-y-1 text-xs">
              <span className="font-medium text-ui-muted">
                Nueva contraseña
              </span>

              <input
                autoComplete="new-password"
                className="w-full rounded-lg border border-ui-border-strong bg-ui-surface px-3 py-2 text-sm text-ui-text outline-none focus:border-ui-border-strong focus:ring-2 focus:ring-ui-border"
                disabled={pending}
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
              <span className="font-medium text-ui-muted">
                Confirmar contraseña
              </span>

              <input
                autoComplete="new-password"
                className="w-full rounded-lg border border-ui-border-strong bg-ui-surface px-3 py-2 text-sm text-ui-text outline-none focus:border-ui-border-strong focus:ring-2 focus:ring-ui-border"
                disabled={pending}
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

            <p
              aria-live="polite"
              className={
                state.type === "error"
                  ? "text-xs leading-5 text-ui-danger"
                  : state.type === "success"
                    ? "text-xs leading-5 text-ui-success"
                    : "text-xs text-ui-muted"
              }
            >
              {state.message}
            </p>

            <button
              className="w-full rounded-lg bg-ui-strong px-3 py-2 text-xs font-medium text-ui-on-strong disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pending}
              type="submit"
            >
              {pending ? "Restableciendo..." : "Guardar nueva contraseña"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
