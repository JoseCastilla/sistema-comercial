import Link from "next/link";

import { Button } from "@/components/ui/button";

import { MyDayFlatList, MyDayList } from "./my-day-list";
import { MyDayProgressPanel } from "./my-day-progress";

import type { MyDayData } from "../server/get-my-day";

/**
 * El cuerpo de «Mi día»: progreso, «Ahora», «Más tarde hoy» y las ventas
 * antiguas. Lo usan la página del asesor y «Ver su día» del supervisor
 * (SPEC-069 BR-006), que lo muestra igual pero sin editor: el supervisor ve
 * lo que el asesor ve, y abre los casos en lugar de gestionarlos.
 */
export function MyDayBody({
  data,
  readOnly = false,
  campaignHref = "/recovery/campaigns",
}: {
  data: MyDayData;
  readOnly?: boolean;
  /** A dónde lleva la campaña: la cola del asesor o su Seguimiento. */
  campaignHref?: string;
}) {
  return (
    <>
      {/* El progreso en una franja: el trabajo («Ahora») queda a la vista. */}
      <MyDayProgressPanel
        progress={data.progress}
        sales={data.sales}
        voice={readOnly ? "su" : "tu"}
      />

      <section aria-labelledby="mi-dia-ahora" className="grid gap-4">
        <h2 className="text-lg font-bold text-ui-text" id="mi-dia-ahora">
          Ahora
        </h2>
        {data.now.length > 0 ? (
          <MyDayList
            campaignLink={
              readOnly
                ? { href: campaignHref, label: "Ver su cartera en Seguimiento" }
                : undefined
            }
            campaignTotal={data.campaign.total}
            entries={data.now}
            readOnly={readOnly}
          />
        ) : readOnly ? (
          <p className="rounded-lg border border-dashed border-ui-border-strong bg-ui-surface p-6 text-sm text-ui-muted">
            Nada pendiente por ahora: no tiene citas, ventas caídas ni pedidos
            que lo esperen.
          </p>
        ) : (
          <div className="rounded-lg border border-dashed border-ui-border-strong bg-ui-surface p-6">
            <p className="text-base font-semibold text-ui-text">
              Nada pendiente por ahora.
            </p>
            <p className="mt-1 text-sm text-ui-muted">
              No tienes citas, ventas caídas ni pedidos que te esperen. Puedes
              tomar clientes nuevos de tu equipo en tu cola de campaña.
            </p>
            <Button asChild className="mt-3">
              <Link href="/recovery/campaigns">Ir a mi cola de campaña</Link>
            </Button>
          </div>
        )}
      </section>

      {data.later.length > 0 ? (
        <details className="rounded-lg border border-ui-border bg-ui-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ui-text">
            Más tarde hoy{" "}
            <span className="font-medium text-ui-soft">{data.later.length}</span>
          </summary>
          <div className="px-4 pb-4">
            <MyDayFlatList entries={data.later} readOnly={readOnly} />
          </div>
        </details>
      ) : null}

      {data.cold.length > 0 ? (
        <details className="rounded-lg border border-ui-border bg-ui-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ui-text">
            Ventas antiguas por recuperar{" "}
            <span className="font-medium text-ui-soft">{data.cold.length}</span>
            <span className="mt-0.5 block text-xs font-normal text-ui-muted">
              Clientes de ventas de hace más de 7 días. Siguen siendo una
              oportunidad, pero lo caliente va primero.
            </span>
          </summary>
          <div className="px-4 pb-4">
            <MyDayFlatList entries={data.cold} readOnly={readOnly} />
          </div>
        </details>
      ) : null}
    </>
  );
}
