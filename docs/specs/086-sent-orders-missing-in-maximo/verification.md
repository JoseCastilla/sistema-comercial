# SPEC-086 — Verificación

- **23/10/2026** — Web: tipos, lint y pruebas. Cuatro pruebas de la regla y
  de la hora de importación; dos de la bandeja, con franja, enlace, insignia
  y aviso.
- **No se levantó en local**, por decisión de José: la base local no tiene
  datos actuales. La migración no se probó contra una base; es una tabla
  nueva sin relleno.
- **23/10/2026, producción, corrida automática de las 12:00** (primera con
  el código nuevo, con la clave guardada el 15/10): 129 consultadas de 129,
  61 oportunidades, 11 enviadas en alerta. La franja, el filtro, la insignia
  y la lista de Logística se vieron bien.
  - **10 de las 11 eran falsas:** enviadas entre el 29/08 y el 29/09, con
    subestado «No entregado», es decir, que sí pasaron por logística.
    Consultadas a mano, Máximo responde `found: false`: su historial solo
    trae tomas desde el 16/10. Se corrigió BR-001 y BR-003.
  - **La real es 1977220838**, enviada el 19/10, la misma que faltaba en el
    Excel de José.
- **23/10/2026, 12:17, sincronización manual con la primera corrección:** 71
  consultadas, en lugar de 129, porque ya no se pregunta por lo terminado
  (SPEC-087). Alertas: 0, y se apagó también la real. Causa: la cobertura
  salía de la toma más antigua devuelta, y sin lo terminado solo vuelve lo
  reciente. Se agregó el mínimo de 6 días desde la importación.
- **23/10/2026, 12:30, sincronización manual con la segunda corrección:** 74
  consultadas de 74, 1 alerta: 1977220838, enviada el 19/10. Las 10 de
  septiembre ya no aparecen. AC-001 cumplido en producción.
- **23/10/2026, cobertura del historial validada en producción.** Ventas
  cerradas de cada día, consultadas una por segundo:

  | Día de la venta | Encontradas |
  |---|---|
  | 26/09 | 0 de 4 |
  | 29/09 | 0 de 4 |
  | 30/09 | 0 de 6 |
  | 01/10 | 4 de 4 |
  | 03/10, 05/10, 07/10 | 12 de 12 |
  | 08/10 al 17/10 | todas las consultadas |

  El historial cubre el **mes en curso**, no los últimos 7 días. La cobertura
  pasa a ser el inicio del mes de la importación.
- **23/10/2026, 12:42 a 12:46:** Máximo respondió «no encontrado» para todo,
  con la misma importación de las 06:37, y volvió solo. Desde ahora, una
  corrida que no encuentra ninguna venta no registra ausencias ni alertas.
- **23/10/2026, 13:02, tras el cambio al mes en curso:** Logística mostró
  308 por gestionar, la cifra del mes, y 5 alertas. Cuatro eran ventas
  enviadas a las 10:13 y 10:43 de ese día que Máximo ya tenía a las 13:03,
  con la importación «HISTORIAL12PM» de las 12:49. La 1977220838 seguía
  sin aparecer. Se agregó BR-003: dos importaciones.
- **23/10/2026, 13:14, sincronización manual con BR-003:** 65 consultadas,
  11 oportunidades, 1 alerta: 1977220838. Las cuatro de ese día ya no
  aparecen. Logística muestra 319 por gestionar, todas del mes.
- También en producción: la ficha de 1978945485 muestra «RECHAZADO · CLIENTE
  NO DESEA NO RECUPERABLE», con recorrido, intentos y pedido, aunque el
  resumen de la fuente seguía en NO ENTREGADO (SPEC-029 §13).
- **Pendiente en producción (original):** que, tras la primera sincronización, las
  enviadas ausentes aparezcan con la insignia y en la lista de Logística, y
  que 1977220838 y 1978410063 figuren si siguen enviadas y fuera de Máximo.
