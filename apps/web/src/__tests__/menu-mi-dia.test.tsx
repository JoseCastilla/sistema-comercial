import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CommercialAppShell } from "@/components/layout/commercial-app-shell";

/**
 * SPEC-063 fase 5: «Mi día» es de quien vende. El asesor y el supervisor
 * vendedor lo tienen en el menú; el supervisor que no vende y los demás
 * roles, no.
 */
vi.mock("next/navigation", () => ({
  usePathname: () => "/my-day",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

// El selector de tema lee la preferencia del sistema; jsdom no la tiene.
Object.defineProperty(window, "matchMedia", {
  value: () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
});

// El aviso flotante consulta la API: aquí no importa.
vi.mock("@/components/layout/escalation-notification", () => ({
  EscalationNotification: () => null,
}));

function renderShell(role: string, sells: boolean) {
  render(
    <CommercialAppShell
      organizationName="Distribuidor Online"
      role={role}
      sells={sells}
      signOut={null}
      userName="Persona de prueba"
    >
      <p>contenido</p>
    </CommercialAppShell>,
  );
}

const miDia = () => screen.queryAllByRole("link", { name: /Mi día/ });

describe("Menú · Mi día", () => {
  it("el asesor lo tiene en el menú lateral y en el móvil", () => {
    renderShell("AGENT", true);
    expect(miDia()).toHaveLength(2);
  });

  it("el supervisor que vende también", () => {
    renderShell("SUPERVISOR", true);
    expect(miDia()).toHaveLength(2);
  });

  it("el supervisor que no vende, no", () => {
    renderShell("SUPERVISOR", false);
    expect(miDia()).toHaveLength(0);
  });

  it("el administrador, no", () => {
    renderShell("ADMIN", false);
    expect(miDia()).toHaveLength(0);
  });
});
