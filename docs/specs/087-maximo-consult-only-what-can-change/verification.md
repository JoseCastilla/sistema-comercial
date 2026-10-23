# SPEC-087 — Verificación

- **23/10/2026** — Web: tipos, lint y pruebas, con seis de la regla.
- **Simulación** con las respuestas reales de los 348 pedidos y su estado
  DITO, tras la corrección: los primeros tres días se consultan 50, igual que
  antes; al quinto día, 25, las enviadas. La regla anterior seguía en 50.
  Se supuso que todas cambiaron de estado el día anterior, porque la lista
  no traía esa hora.
- **Costo medido de una consulta** (23/10/2026, 40 pedidos): 2,26 s en
  serie, 0,24 s por venta en lotes de 10, respuesta de 1,5 KB. Una corrida
  de 250 tarda cerca de un minuto.
- No se levantó en local, por decisión de José.
- **23/10/2026, producción:** la corrida de las 12:00, que aún consultaba
  lo terminado según la regla anterior, tuvo 129 candidatas; las manuales
  de las 12:17 y 12:30, con la regla nueva, 71 y 74.
