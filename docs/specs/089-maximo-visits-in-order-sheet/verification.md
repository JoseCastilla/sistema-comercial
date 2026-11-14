# Verificación — SPEC-089

## Automatizada — 13/11/2026 (local)

- [x] **AC-001 a AC-007:** `apps/web/src/__tests__/visitas-maximo.test.ts`
      (8 pruebas: 2 NO ENTREGADO con «EXCEDE 3 VISITAS», 3 con el mismo
      motivo, 1 con «NO RECUPERABLE», PRECANCELADO → CANCELADO, sin
      historial, evento sin fecha o ilegible, comentario vacío y largo,
      frase y fechas sueltas).
- [x] Componente: `visitas-maximo-bloque.test.tsx` (3 pruebas: 2 visitas y
      rechazo, sin historial, campos sueltos sin repetir).
- [x] Ajustadas al tipo nuevo: `historial-maximo.test.ts` (además lee la
      foto por visitas), `hoja-pedidos.test.tsx` (la región se llama
      «Entrega según Máximo»), `lista-asesor.test.ts`.
- [x] `pnpm --filter web check-types`, `lint` y `test`: 53 archivos, 338
      pruebas en verde.
- [x] `pnpm --filter @repo/ui check-types` y `lint` sin errores.
- [x] **AC-009:** solo por lectura de código y tipos (la página es de
      servidor y no tiene prueba).

## Sin comprobar

No hay base de datos local levantada (puerto 5433 cerrado): **nadie ha
visto el bloque en un navegador**. Tampoco hay valores reales de
`usuario`, `distancia`, `tiempo_hrs` ni `comentario`; las pruebas usan
datos ficticios con la forma de `/api/order-history`.

## Recorrido visual pendiente

En `/orders` (panel derecho, ~258 px) y en `/recovery/sales/<caso>`:

- [ ] Modo día y modo noche: cabecera, motivos, comentarios en cursiva,
      línea secundaria y pie legibles; borde izquierdo de las visitas
      visible en ambos.
- [ ] Celular (375 px): nada se sale del bloque; el pedido con su botón de
      copiar parte bien junto a «Último movimiento»; sin scroll horizontal.
- [ ] Pedido sin historial (foto anterior al 23/10/2026): solo cabecera,
      último movimiento y pedido, motivo y consultado.
- [ ] Pedido con 1-2 visitas: el bloque no mide más de ~418 px y «¿En qué
      va?» sigue a la vista como antes o mejor (AC-008).
- [ ] Pedido con 3 visitas y cierre: se lee en orden; «Ver todos los
      movimientos» abre y cierra con teclado y ratón.
- [ ] Comentario largo (200+ caracteres) y texto sin espacios: se recorta
      con «…» o parte la palabra sin desbordar.
- [ ] Copiar el pedido de Máximo: «✓ copiado» y el número en el
      portapapeles.
- [ ] Ficha del asesor (SPEC-080), del supervisor y del administrador: el
      mismo bloque.
- [ ] Dato viejo (pedido cerrado o entregado): «Último dato de Máximo» y
      pie «Del … Ya no se consulta».
- [ ] Logística: con una corrida con errores, «Con error» en rojo y el
      mensaje en recuadro rojo; sin errores, nada destacado.

## Lectura de producción — 13/11/2026, 20:55 a 21:05

Con sesión de administrador, tras entregar `main` en `8bb670e`. Solo
lectura. Modo día, escritorio (1 197 × 846).

- [x] `/orders?period=MONTH&status=LOGISTICS`: el bloque «Entrega según
      Máximo» sale en los 50 pedidos fallidos de la primera página; los 50
      traen al menos una visita y 17 muestran «Máximo dice 3 visitas;
      registra 2».
- [~] **AC-008 (alto):** entre 304 y 474 px, mediana 397, a 258 px de
      ancho. El bloque anterior midió ~418 px en un pedido. La mediana
      baja; el máximo sube.
- [x] `/recovery/sales/<caso>`: el mismo bloque, a 846 px de ancho.
- [x] **AC-009:** Logística muestra la última corrida completa (87
      consultadas, 54 encontradas, 46 con cambios, 15 oportunidades, 0 con
      error). No se vio una corrida con errores.
- Primeros valores reales: `usuario` es un código de flota por ciudad
  (p. ej. `FLEETPIUC`) en las visitas y `D-<número>` en el cierre;
  `distancia` es un número sin unidad (33 a 457 en la muestra, 0 en los
  cierres); `tiempo_hrs` llega como «01:22» o «50:35:00»; `comentario` vino
  vacío en los 50.
- Costo: la página de 50 fallidos pesa ~420 KB frente a ~335 KB antes,
  porque la lectura viaja para toda la lista y no solo para el pedido
  abierto.
- Sin mirar: celular, modo noche dentro de la aplicación, fichas de asesor
  y supervisor, pedido sin historial, copiar el pedido.

## Ajuste del 13/11/2026: la distancia va en metros

José confirmó que `distancia` son metros. `formatAgrDistance` la muestra
redondeada («46.49» → «46 m»; sobre 1 000, en km), omite el «0» de los
cierres hechos desde la mesa y deja tal cual lo que no sea un número.
`pnpm --filter web test`: 53 archivos, 340 pruebas en verde;
`check-types` y `lint` en verde. Sin desplegar al escribir esta nota.
