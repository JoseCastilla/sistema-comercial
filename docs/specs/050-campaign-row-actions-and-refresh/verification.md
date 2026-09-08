# SPEC-050 — Verificación

Sin evidencia todavía: la spec está en `BORRADOR`. Reúne además los
recorridos pendientes de SPEC-048 y SPEC-049 (CAM-UX-07), que exigen
aplicar las migraciones en local y cuentas de prueba ficticias.

## Recorridos funcionales (CAM-UX-07), con cuenta de asesor ficticia

| # | Qué comprobar | Cómo | Resultado |
|---|---|---|---|
| 1 | Movimientos entre vistas: agendar saca el caso de Trabajar ahora y lo pone en Mi agenda a su hora; «No interesado» lo pone en En espera con fecha; vendido en Por completar; y los contadores coinciden (SPEC-049 AC-001, AC-011) | bandeja y agenda con el mismo caso | pendiente |
| 2 | Teléfono errado: queda tachado, el siguiente pasa a primero, el caso sigue trabajable; con todos errados pasa a Por completar y la puerta de datos inválidos se habilita (SPEC-049 AC-002) | fila, ficha y resolver | pendiente |
| 3 | Vinculación de orden: «Vendido» sin orden en Por completar; vincular la lleva a Historial como recuperado (SPEC-049 AC-003) | ficha | pendiente |
| 4 | Devolución manual (supervisor desmiente) y por cruce (WAITING → ASSIGNED): la fila dice «devuelto de verificación», origen, fecha y motivo; va en el rango 2 (SPEC-049 AC-004; SPEC-050 AC-004) | cuenta de supervisor y un cruce de prueba | pendiente |
| 5 | Rectificar «No interesado» a «Interesado» levanta la pausa, no incrementa «intentos hoy», conserva el original visible y deja autor, motivo y momento (SPEC-049 AC-006) | ficha | pendiente |
| 6 | Doble envío no duplica; un error conserva el borrador; una cita cerrada en otra pestaña devuelve «esta cita ya cambió» (SPEC-048 AC-009; SPEC-049 AC-010) | dos pestañas | pendiente |
| 7 | Bandeja, ficha y agenda muestran la misma siguiente acción (SPEC-049 AC-007) | las tres pantallas con el mismo caso | pendiente |

## Por fase de esta spec

| Fase | Comprobación | Cómo | Resultado |
|---|---|---|---|
| 1 | Primer contacto sin intentos; devolución por supervisor y por cruce; cruce a `SCHEDULED`, descarte y `TRIAGE` no son devolución (AC-004, AC-005) | pruebas puras | pendiente |
| 2 | Tecla P y la pregunta de interés (AC-001); acción principal por tipo de tarea (AC-002) | pruebas de componente y recorrido | pendiente |
| 3 | La fila aplica lo confirmado y no se mueve; contadores ±1; refresco solo sin gestión abierta (AC-003) | pruebas de componente y recorrido | pendiente |
| 4 | Filtro por tarea con cantidades y «N de M»; alertas visibles con filtros (AC-006); sin desplazamiento horizontal a 1280 px (AC-007) | prueba de componente y captura | pendiente |

## Producción

| Comprobación | Cómo | Resultado |
|---|---|---|
| Discrepancias por tipo (SPEC-049 fase 5) | `docs/operacion/consultas/tipificaciones-discrepantes.sql` completo, en orden | pendiente (la primera ejecución falló por un fragmento erróneo en el mensaje y porque DbGate separa sentencias; el archivo ahora usa una vista temporal) |
| Suma de vistas = cartera abierta + resueltos de 30 días (SPEC-049 AC-011) | lectura con sesión de asesor | pendiente |
