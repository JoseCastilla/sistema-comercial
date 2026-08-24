# SPEC-029 — Recuperación logística AGR

**Estado:** `READY_FOR_VALIDATION`
**Versión:** 1.0
**Fecha:** 2026-08-23
**Responsable de producto:** José Castilla

## 1. Problema

El Sistema Comercial conoce el estado que el asesor informa manualmente y el que
llega desde DITO, pero no sabe qué ocurrió con la entrega física. Cuando un
pedido no se entrega, la razón vive en AGR, una plataforma logística externa que
el equipo consulta a mano y pedido por pedido.

Esto produce tres pérdidas concretas:

- una entrega fallida por ausencia del cliente se descubre días después, cuando
  ya no es reagendable;
- una cancelación llega sin motivo, así que nadie sabe si era recuperable;
- el asesor no distingue un caso que debe contactar de uno que debe cerrar.

## 2. Objetivo

Consultar desde el Sistema Comercial el estado logístico de las ventas
registradas desde el 10/08/2026 y presentar únicamente las señales que permitan
**reagendar una entrega o entender un rechazo**, sin convertir AGR en una
segunda fuente de verdad del estado comercial.

## 3. Alcance

- Integración de solo lectura contra AGR, autenticada con una cookie de sesión
  que un administrador pega y el sistema valida.
- Consulta dirigida por `order_id`, pedido por pedido, sobre las ventas propias
  del sistema que siguen siendo accionables.
- Instantánea del último estado externo por orden, más historial de cambios.
- Filtro `Oportunidades logísticas` en Pedidos y columna `Estado AGR` en la
  tabla.
- Módulo `/admin/logistics` para administrar la credencial y sincronizar.

### Fuera de alcance

- Importar o recorrer toda la base externa de AGR.
- Escribir hacia AGR.
- Modificar automáticamente el estado comercial, la entrega o el cierre de una
  orden a partir de lo que informe AGR.
- Consultar ventas anteriores al 10/08/2026.

## 4. Reglas de negocio

### Credencial

- **BR-001:** la cookie de sesión se recibe únicamente en el servidor, se cifra
  con AES-256-GCM y nunca se devuelve al navegador después de guardarla. La
  interfaz solo muestra los últimos cuatro caracteres como pista.
- **BR-002:** en producción se requiere `AGR_DELIVERY_ENCRYPTION_KEY` con 32
  bytes en base64 o 64 caracteres hexadecimales. Fuera de producción se deriva
  una llave local de desarrollo.
- **BR-003:** la cookie se acepta solo después de validarla contra un pedido
  real de la organización. Una credencial que no supera la prueba no se guarda.
- **BR-004:** si la fuente responde 401 o 403, la credencial queda `EXPIRED` y
  las sincronizaciones se detienen. La última información obtenida se conserva
  hasta que un administrador pegue y valide una nueva cookie.
- **BR-005:** solo `ADMIN` administra la credencial y dispara sincronizaciones
  manuales.

### Elegibilidad y cadencia

- **BR-006:** solo se consultan pedidos propios del sistema, uno por uno
  mediante `order_id`. No se recorre ni se importa la base externa.
- **BR-007:** una venta registrada antes del 10/08/2026 nunca se consulta.
- **BR-008:** una venta cerrada o entregada internamente no se consulta.
- **BR-009:** un estado externo `ENTREGADO` o `CERRADO` detiene las consultas
  futuras de esa orden.
- **BR-010:** una orden cancelada se sigue consultando hasta obtener el motivo
  de rechazo; una vez obtenido, deja de consultarse.
- **BR-011:** cada corrida consulta como máximo 250 candidatos, en lotes de 10
  solicitudes concurrentes, priorizando las ventas más antiguas.
- **BR-012:** el primer acceso a Pedidos después de las 08:15, 13:15 y 18:15
  (hora de Lima) inicia una sincronización en segundo plano. La llave de horario
  `AAAA-MM-DD-HHMM` es única por organización e impide ejecuciones duplicadas.
- **BR-013:** la sincronización nunca bloquea el renderizado de Pedidos; se
  ejecuta después de responder y su fallo no afecta la bandeja.

### Estado externo

- **BR-014:** el estado AGR se conserva separado del estado comercial y nunca lo
  modifica automáticamente. La única escritura sobre la orden es su `updatedAt`,
  para que el canal en tiempo real refresque las bandejas abiertas.
- **BR-015:** cada cambio de la respuesta externa deja un registro histórico. El
  cambio se detecta comparando la huella `sha256` de la respuesta completa.
- **BR-016:** la respuesta original se conserva íntegra como evidencia en
  `rawPayload`.
- **BR-017:** un pedido es oportunidad de recuperación cuando su estado externo
  no es `ENTREGADO` ni `CERRADO` y además presenta motivo o submotivo de
  rechazo, un estado que indica no entrega, rechazo, cancelación, anulación o
  devolución, o gestión `SIN GESTIÓN` sin fecha de toma de pedido.

### Acción recomendada

- **BR-018:** cada oportunidad se traduce a una única acción recomendada,
  resuelta sobre estado, motivo y submotivo:

  | Señal | Acción | Etiqueta |
  |---|---|---|
  | `NO RECUPERABLE` | `NOT_RECOVERABLE` | Confirmar cierre como no recuperable |
  | `CANCEL`, `PORTABILIDAD RECHAZADA`, `ANULAD` | `REVIEW_CANCELLATION` | Revisar el motivo de cancelación |
  | `AUSENTE`, `NO VISIT`, `EXCEDE … VISITA`, `NO TOMA` | `RESCHEDULE` | Contactar al cliente para reagendar |
  | cualquier otra | `CONTACT` | Contactar al cliente y validar el caso |

- **BR-019:** la acción es una recomendación. Ejecutarla sigue exigiendo los
  permisos comerciales vigentes: el asesor no cierra ni cancela su propia venta.

### Visibilidad

- **BR-020:** el filtro `Oportunidades logísticas` respeta el alcance vigente:
  `AGENT` sus ventas, `SUPERVISOR` sus equipos y el pool permitido, `ADMIN` y
  `BACKOFFICE` la organización completa.
- **BR-021:** el filtro ignora el período seleccionado, porque una entrega
  fallida sigue siendo recuperable aunque la venta pertenezca a un mes anterior.
- **BR-022:** la interfaz comunica que AGR es una fuente estática actualizada
  tres veces al día, indicando la hora de la última consulta.

## 5. Criterios de aceptación

- **AC-001:** un administrador pega una cookie en `/admin/logistics`, el sistema
  la valida contra un pedido real y la guarda cifrada; la pantalla muestra
  `••••` más cuatro caracteres y quién la actualizó.
- **AC-002:** una cookie con formato inválido o que la fuente rechaza no se
  guarda y devuelve un mensaje accionable.
- **AC-003:** la sincronización manual reporta cuántas órdenes consultó y
  cuántas oportunidades encontró.
- **AC-004:** el primer acceso a Pedidos posterior a un horario programado
  dispara la sincronización; los accesos siguientes del mismo tramo no la
  repiten.
- **AC-005:** una respuesta 401 o 403 marca la credencial como vencida, deja de
  consultar y conserva la información previa visible.
- **AC-006:** el filtro `Oportunidades logísticas` lista únicamente pedidos con
  acción pendiente y muestra la hora de la última consulta.
- **AC-007:** cada pedido del filtro presenta estado, motivo, próxima acción y
  hora de consulta en la tarjeta de gestión.
- **AC-008:** la columna `Estado AGR` distingue oportunidad, estado terminal y
  ausencia de consulta.
- **AC-009:** los indicadores del filtro separan por reagendar, contactar y
  revisar o cerrar.
- **AC-010:** una alerta en la bandeja general enlaza al filtro cuando existen
  casos, conservando equipo y período.
- **AC-011:** sincronizar no cambia `status`, `sentSubstatus`, `deliveryStatus`
  ni `closedAt` de ninguna orden.
- **AC-012:** un cambio en la respuesta externa crea historial; una respuesta
  idéntica no lo duplica.
- **AC-013:** las bandejas abiertas se refrescan mediante el canal en tiempo
  real existente cuando la sincronización detecta cambios.

## 6. Cambios de experiencia incluidos

Estos ajustes viajan en el mismo incremento porque la columna y el filtro nuevos
los hacían necesarios:

- La bandeja abre en `Activas` para `AGENT` y en `Todas` para los demás roles,
  en lugar de abrir siempre en `Todas`.
- El panel de escalamiento sale de la fila de etiquetas y pasa a ser una sección
  propia de la tarjeta de gestión; en la tabla queda una etiqueta `Escalada` de
  solo lectura.
- `Metric` admite los tonos `warning` y `success`.
- La tabla de pedidos incorpora la columna `Estado AGR` y amplía su ancho
  mínimo.
- `/admin/logistics` se agrega a la navegación de escritorio y móvil, visible
  solo para `ADMIN`.

## 7. Invariantes preservados

- Toda consulta y mutación aísla primero por organización.
- El estado comercial solo cambia por acción humana autorizada.
- La evidencia original recibida de la fuente externa permanece inmutable.
- PostgreSQL guarda instantes en UTC; la operación se resuelve en `America/Lima`.
