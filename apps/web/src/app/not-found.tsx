import Link from "next/link";

import { StatePanel } from "@repo/ui/state-panel";

import { Button } from "@/components/ui/button";

/**
 * Lo que no existe, en español y con una salida. Antes se veía la página
 * genérica de Next en inglés, por ejemplo al abrir el día de un asesor que no
 * es del equipo (SPEC-069).
 */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <StatePanel
        action={
          <Button asChild>
            <Link href="/">Ir al inicio</Link>
          </Button>
        }
        description="La dirección no existe o lo que buscas no está a tu alcance."
        title="No encontramos esta página"
      />
    </main>
  );
}
