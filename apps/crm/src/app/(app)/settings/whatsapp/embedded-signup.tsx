"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Botón de Embedded Signup (SPEC-053). Carga el SDK de Facebook, abre el
 * flujo de Meta y escucha el mensaje `WA_EMBEDDED_SIGNUP` para quedarse con
 * el número y la cuenta que la persona eligió. El código de autorización se
 * canjea en el servidor: aquí nunca hay secretos.
 *
 * https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation
 */

interface SignupResult {
  phoneNumberId?: string;
  wabaId?: string;
  businessId?: string;
}

declare global {
  interface Window {
    FB?: {
      init: (options: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } | null; status?: string }) => void,
        options: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const SDK_ID = "facebook-jssdk";

export function EmbeddedSignupButton({
  appId,
  configId,
  graphVersion,
}: {
  appId: string;
  configId: string;
  graphVersion: string;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const signupRef = useRef<SignupResult | null>(null);

  useEffect(() => {
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion });
      setReady(true);
    };
    if (window.FB) {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion });
      setReady(true);
      return;
    }
    if (!document.getElementById(SDK_ID)) {
      const script = document.createElement("script");
      script.id = SDK_ID;
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onerror = () => setError("No se pudo cargar el conector de Meta. Revisa tu conexión y vuelve a intentar.");
      document.body.appendChild(script);
    }
  }, [appId, graphVersion]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith("facebook.com")) return;
      let data: Record<string, unknown>;
      try {
        data = typeof event.data === "string" ? (JSON.parse(event.data) as Record<string, unknown>) : (event.data as Record<string, unknown>);
      } catch {
        return;
      }
      if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
      // Meta pone el evento en la raíz y los datos en `data`; algunas versiones
      // lo repiten dentro, así que se aceptan las dos formas.
      const payload = (data.data ?? {}) as Record<string, unknown>;
      const kind = String(data.event ?? payload.event ?? "");
      if (kind.startsWith("FINISH")) {
        signupRef.current = {
          phoneNumberId: payload.phone_number_id ? String(payload.phone_number_id) : undefined,
          wabaId: payload.waba_id ? String(payload.waba_id) : undefined,
          businessId: payload.business_id ? String(payload.business_id) : undefined,
        };
        setNotice("Meta terminó su parte. Guardando el número…");
        return;
      }
      if (payload.error_message) {
        setError(`Meta rechazó la conexión: ${String(payload.error_message)}`);
        setBusy(false);
        return;
      }
      if (kind === "CANCEL") {
        setError(`Cerraste la ventana de Meta antes de terminar${payload.current_step ? ` (paso «${String(payload.current_step)}»)` : ""}.`);
        setBusy(false);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const start = useCallback(() => {
    if (!window.FB) {
      setError("El conector de Meta todavía no cargó. Espera unos segundos.");
      return;
    }
    setError(null);
    setNotice(null);
    setPin(null);
    signupRef.current = null;
    setBusy(true);
    window.FB.login(
      (response) => {
        const code = response?.authResponse?.code;
        if (!code) {
          setBusy(false);
          setError("Meta no devolvió la autorización: no se conectó ningún número.");
          return;
        }
        const signup = signupRef.current;
        void fetch("/api/meta/embedded-signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, phoneNumberId: signup?.phoneNumberId, wabaId: signup?.wabaId }),
        })
          .then(async (result) => {
            const body = (await result.json()) as { ok?: boolean; error?: string; pin?: string | null; message?: string };
            if (!result.ok || !body.ok) {
              setError(body.error ?? "No se pudo guardar el número.");
              return;
            }
            setPin(body.pin ?? null);
            setNotice(body.message ?? "Número conectado.");
            // La lista de números se arma en el servidor: hay que recargar.
            setTimeout(() => window.location.reload(), body.pin ? 30_000 : 1_500);
          })
          .catch(() => setError("No se pudo hablar con el servidor para guardar el número."))
          .finally(() => setBusy(false));
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      },
    );
  }, [configId]);

  return (
    <div className="ui-form-stack">
      <button className="ui-button ui-button--primary" disabled={!ready || busy} onClick={start} type="button">
        {busy ? "Conectando con Meta…" : ready ? "Conectar mi número de WhatsApp" : "Cargando el conector de Meta…"}
      </button>
      {error ? <p className="ui-feedback" data-tone="danger" role="alert">{error}</p> : null}
      {notice ? <p className="ui-feedback" data-tone="success">{notice}</p> : null}
      {pin ? (
        <p className="ui-feedback" data-tone="warning" role="alert">
          Anota este PIN de seis dígitos ahora: <strong>{pin}</strong>. Es la verificación en dos pasos de tu número y no se
          vuelve a mostrar. Si lo pierdes, tendrás que cambiarlo desde Meta.
        </p>
      ) : null}
    </div>
  );
}
