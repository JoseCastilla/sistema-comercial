"use client";

import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";

const storageKey = "sistema-comercial-theme";
const themeEvent = "sistema-comercial-theme-change";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function applyTheme(preference: ThemePreference) {
  const darkSystem = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme =
    preference === "system" ? (darkSystem ? "dark" : "light") : preference;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#0f1411" : "#eef1ed");
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

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const initialPreference = readStoredPreference();
    setPreference(initialPreference);
    applyTheme(initialPreference);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (readStoredPreference() === "system") applyTheme("system");
    };
    const handleThemeChange = (event: Event) => {
      const nextPreference = (event as CustomEvent<ThemePreference>).detail;
      setPreference(nextPreference);
    };

    media.addEventListener("change", handleSystemChange);
    window.addEventListener(themeEvent, handleThemeChange);
    return () => {
      media.removeEventListener("change", handleSystemChange);
      window.removeEventListener(themeEvent, handleThemeChange);
    };
  }, []);

  return (
    <label
      className="ui-theme-control"
      data-compact={compact ? "true" : "false"}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20">
        <path d="M15.8 12.5A6.4 6.4 0 0 1 7.5 4.2 6.4 6.4 0 1 0 15.8 12.5Z" />
      </svg>
      <span>Apariencia</span>
      <select
        aria-label="Apariencia"
        onChange={(event) => {
          const nextPreference = event.target.value as ThemePreference;
          setPreference(nextPreference);
          storePreference(nextPreference);
          applyTheme(nextPreference);
          window.dispatchEvent(
            new CustomEvent<ThemePreference>(themeEvent, {
              detail: nextPreference,
            }),
          );
        }}
        value={preference}
      >
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
    </label>
  );
}
