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
        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
        onClick={() => {
          setOpen((current) => !current);
        }}
        type="button"
      >
        {open ? "Cerrar" : "Restablecer contraseña"}
      </button>

      {open ? (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-left sm:min-w-72">
          <p className="text-xs font-medium text-neutral-800">
            Nueva contraseña para
          </p>

          <p className="mt-1 break-all text-xs text-neutral-500">{userEmail}</p>

          {isCurrentUser ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              Estás modificando tu propia cuenta. Al guardar, tu sesión actual
              será revocada y tendrás que iniciar sesión nuevamente.
            </p>
          ) : (
            <p className="mt-3 text-xs leading-5 text-neutral-500">
              Todas las sesiones activas de este usuario serán cerradas.
            </p>
          )}

          <form action={formAction} className="mt-3 space-y-3" ref={formRef}>
            <input name="userId" type="hidden" value={userId} />

            <label className="block space-y-1 text-xs">
              <span className="font-medium text-neutral-700">
                Nueva contraseña
              </span>

              <input
                autoComplete="new-password"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                disabled={pending}
                maxLength={128}
                minLength={12}
                name="newPassword"
                required
                type="password"
              />

              {state.fieldErrors?.newPassword ? (
                <span className="text-red-600">
                  {state.fieldErrors.newPassword}
                </span>
              ) : null}
            </label>

            <label className="block space-y-1 text-xs">
              <span className="font-medium text-neutral-700">
                Confirmar contraseña
              </span>

              <input
                autoComplete="new-password"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                disabled={pending}
                maxLength={128}
                minLength={12}
                name="confirmPassword"
                required
                type="password"
              />

              {state.fieldErrors?.confirmPassword ? (
                <span className="text-red-600">
                  {state.fieldErrors.confirmPassword}
                </span>
              ) : null}
            </label>

            <p
              aria-live="polite"
              className={
                state.type === "error"
                  ? "text-xs leading-5 text-red-600"
                  : state.type === "success"
                    ? "text-xs leading-5 text-emerald-700"
                    : "text-xs text-neutral-500"
              }
            >
              {state.message}
            </p>

            <button
              className="w-full rounded-lg bg-neutral-950 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
