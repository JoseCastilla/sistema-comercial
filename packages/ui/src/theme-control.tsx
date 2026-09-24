"use client";

import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";
type Theme = "light" | "dark";

const storageKey = "sistema-comercial-theme";
const themeEvent = "sistema-comercial-theme-change";

/** El color de la barra del navegador: el fondo de la app en cada tema. */
const themeColors: Record<Theme, string> = {
  light: "#f3f5f8",
  dark: "#0d1117",
};

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(preference: ThemePreference) {
  const theme = resolveTheme(preference);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", themeColors[theme]);
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function storePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(storageKey, preference);
  } catch {
    // El tema sigue funcionando durante la sesión aunque el navegador bloquee el almacenamiento.
  }
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M15.8 12.5A6.4 6.4 0 0 1 7.5 4.2 6.4 6.4 0 1 0 15.8 12.5Z" />
    </svg>
  );
}

/**
 * Día o noche, con un clic (propuesta de José del 24/09/2026). Antes eran una
 * etiqueta «Apariencia» y una lista con Sistema, Claro y Oscuro.
 *
 * Mientras nadie elija, sigue al sistema y marca el tema que se está viendo.
 * Con el menú contraído y en la cabecera móvil es un solo botón que cambia al
 * otro tema.
 */
export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const initialPreference = readStoredPreference();
    setTheme(resolveTheme(initialPreference));
    applyTheme(initialPreference);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (readStoredPreference() !== "system") return;
      applyTheme("system");
      setTheme(resolveTheme("system"));
    };
    // Los controles del menú lateral y de la cabecera móvil se enteran entre sí.
    const handleThemeChange = (event: Event) => {
      setTheme((event as CustomEvent<Theme>).detail);
    };

    media.addEventListener("change", handleSystemChange);
    window.addEventListener(themeEvent, handleThemeChange);
    return () => {
      media.removeEventListener("change", handleSystemChange);
      window.removeEventListener(themeEvent, handleThemeChange);
    };
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    storePreference(next);
    applyTheme(next);
    window.dispatchEvent(new CustomEvent<Theme>(themeEvent, { detail: next }));
  }

  if (compact) {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const label = next === "dark" ? "Cambiar a modo noche" : "Cambiar a modo día";

    return (
      <button
        aria-label={label}
        className="ui-theme-toggle"
        onClick={() => choose(next)}
        title={label}
        type="button"
      >
        {next === "dark" ? <MoonIcon /> : <SunIcon />}
      </button>
    );
  }

  return (
    <div aria-label="Apariencia" className="ui-theme-control" role="group">
      <button
        aria-pressed={theme === "light"}
        onClick={() => choose("light")}
        type="button"
      >
        <SunIcon />
        Día
      </button>
      <button
        aria-pressed={theme === "dark"}
        onClick={() => choose("dark")}
        type="button"
      >
        <MoonIcon />
        Noche
      </button>
    </div>
  );
}
