import { PermissionState } from "@repo/ui/state-panel";

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <PermissionState description="Tu cuenta no tiene una organización activa o no posee permisos para acceder al Sistema Comercial." />
    </main>
  );
}
