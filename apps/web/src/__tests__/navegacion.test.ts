import { describe, expect, it } from "vitest";

import { sectionForPath } from "@/components/layout/commercial-app-shell";

/**
 * La sección activa se deduce de la ruta desde que dejó de viajar como prop en
 * 19 páginas. Equivocarse acá no rompe nada visible en las pruebas de humo: la
 * pantalla carga igual y solo queda resaltado el elemento equivocado del menú,
 * que es justo el tipo de defecto que nadie reporta y todos sufren.
 */
describe("sectionForPath", () => {
  it("resuelve cada sección desde su ruta raíz", () => {
    expect(sectionForPath("/orders")).toBe("orders");
    expect(sectionForPath("/performance")).toBe("performance");
    expect(sectionForPath("/dni")).toBe("dni");
    expect(sectionForPath("/tools")).toBe("tools");
  });

  it("mantiene la sección en las rutas hijas", () => {
    expect(sectionForPath("/performance/quotas")).toBe("performance");
    expect(sectionForPath("/performance/reconciliation")).toBe("performance");
    expect(sectionForPath("/tools/lines")).toBe("tools");
  });

  it("el prefijo más específico gana sobre el general", () => {
    // Si /recovery se evaluara primero, recupero de ventas quedaría marcado
    // como campañas.
    expect(sectionForPath("/recovery/sales")).toBe("sales-recovery");
    expect(sectionForPath("/recovery/sales/abc-123")).toBe("sales-recovery");
    expect(sectionForPath("/recovery/triage")).toBe("recovery");
    expect(sectionForPath("/recovery/board")).toBe("recovery");
    expect(sectionForPath("/recovery/campaigns")).toBe("recovery");
  });

  it("separa las cuatro superficies de administración", () => {
    expect(sectionForPath("/admin/dito-imports")).toBe("imports");
    expect(sectionForPath("/admin/logistics")).toBe("logistics");
    expect(sectionForPath("/admin/users")).toBe("people");
    expect(sectionForPath("/admin/teams")).toBe("teams");
    // La base de recupero es administración, pero pertenece a Campañas.
    expect(sectionForPath("/admin/recovery-base")).toBe("recovery");
  });

  it("no confunde un prefijo con el comienzo de otro segmento", () => {
    // Se comparan segmentos completos, no cadenas: /dni-lookup no es /dni.
    // Las rutas de prueba evitan a proposito la seccion por defecto, para que
    // el fallback no haga pasar la asercion por el motivo equivocado.
    expect(sectionForPath("/dni-lookup")).toBe("orders");
    expect(sectionForPath("/performance-legacy")).toBe("orders");
    expect(sectionForPath("/recovery-old/sales")).toBe("orders");
  });

  it("cae en pedidos ante una ruta desconocida", () => {
    expect(sectionForPath("/")).toBe("orders");
    expect(sectionForPath("/ruta-que-no-existe")).toBe("orders");
  });
});
