# SPEC-014 — Desempeño y comisiones del contact center

**Estado:** `IN_PROGRESS`
**Versión:** 1.0
**Fecha:** 2026-08-09

## Incremento: pulso diario del asesor

- **BR-013:** la actividad diaria se atribuye por `registeredAt`. El potencial
  aplica la tarifa base de la operación, pero no es comisión confirmada.
- **BR-014:** la base confirmada del día se atribuye por `closedAt` y exige que
  la orden sea pagable. Puede confirmar hoy una venta ingresada antes.
- **BR-015:** cohorte mensual y aceleradores conservan `registeredAt`; la vista
  diaria no cambia el período económico de la venta.
- **AC-011:** el pulso aparece en el mes vigente para todos los roles, respetando
  su alcance y el equipo seleccionado. El texto mantiene una variante personal
  para AGENT y una variante agregada para los demás roles.
- **AC-012:** una venta ingresada suma actividad y potencial; solo confirma base
  cuando está entregada, cerrada y es pagable.
- **AC-013:** los siete días y sus límites se resuelven en `America/Lima`.
- **BR-016:** “cerradas por día” cuenta órdenes con `status = CLOSED` y
  `closedAt` dentro del día consultado. Es una métrica de evento y no cambia la
  cohorte económica determinada por `registeredAt`.
- **AC-014:** cada día muestra ingresadas y cerradas como series separadas; las
  pagables continúan siendo un subconjunto de las cerradas.
- La interfaz separa potencial, confirmado y estimación mensual, sin rankings
  diarios ni nuevos botones que compitan con las acciones operativas.

## Problema

La bandeja permite operar órdenes, pero no explica si el asesor, el equipo y la
organización están convirtiendo ventas en activaciones pagables. Los contadores
actuales mezclan carga operativa con resultados comerciales y no ofrecen una
ruta directa para actuar sobre pérdidas, atrasos o datos incompletos.

## Objetivo

Crear una vista de desempeño por rol que convierta el ciclo de cada orden en
indicadores comparables, accionables y auditables, sin alterar la bandeja ni
permitir que el usuario modifique los resultados calculados.

## Glosario canónico

- **Ingresada:** orden cuyo `registeredAt` pertenece al período consultado.
- **Entregada:** orden con `deliveryStatus = DELIVERED` y `deliveredAt`.
- **Activada:** orden con `status = CLOSED`, `closedAt` y cierre independiente.
- **Pagable:** portabilidad prepago o postpago entregada y activada, sin una
  exclusión de pago vigente.
- **Entregada sin activar:** entregada que todavía no fue cerrada o cuya
  activación fue observada. No debe llamarse pérdida mientras siga madurando.
- **Alta nueva:** `commercialOperation = NEW_LINE`; aporta carga y volumen, pero
  no comisión bajo la política actual.
- **Cohorte:** órdenes agrupadas por fecha de ingreso. Las tasas de conversión
  usan siempre una cohorte, no eventos ocurridos en fechas diferentes.

## Reglas de negocio

- **BR-001:** todas las fechas de negocio se resuelven en `America/Lima` y los
  intervalos son semiabiertos `[inicio, fin)`.
- **BR-002:** volumen y conversión se atribuyen al `agentUserId` responsable y
  al `assignedTeamId`; el remitente de la extensión no determina desempeño.
- **BR-003:** una orden huérfana integra calidad de datos, pero no el desempeño
  de un asesor hasta ser asignada.
- **BR-004:** el funnel de una cohorte es: ingresadas, entregadas, activadas y
  pagables. Cada etapa debe poder abrir las órdenes que la componen.
- **BR-005:** `DELIVERED` no equivale a `CLOSED` ni a pagable.
- **BR-006:** el comparativo mensual utiliza el mes calendario anterior. Si no
  existe base comparable, se muestra “Sin base comparable”; nunca se sustituye
  por el mes actual.
- **BR-007:** las métricas en curso se identifican como provisionales porque las
  órdenes pueden entregarse o activarse después del período de ingreso.
- **BR-008:** una corrección, reasignación, cancelación, cierre o exclusión de
  pago debe reflejarse en métricas y conservar trazabilidad.
- **BR-009:** las métricas respetan el mismo aislamiento organizacional y alcance
  por rol que la bandeja: AGENT propio, SUPERVISOR equipos supervisados,
  ADMIN/BACKOFFICE organización.
- **BR-010:** BACKOFFICE ve operación, calidad y SLA, pero no montos de comisión.
- **BR-011:** AGENT ve únicamente su estimación; SUPERVISOR ve el total estimado
  de sus equipos, sin revelar el pago individual; ADMIN puede conciliar el
  detalle financiero.
- **BR-012:** ninguna métrica ni comisión se edita directamente. Toda cifra se
  deriva de órdenes, reglas versionadas y eventos auditados.

## Métricas por rol

### AGENT — orientar la siguiente acción

- Ingresadas, entregadas, activadas/pagables y altas del mes.
- Conversión a entrega y activación de la cohorte.
- Comisión base estimada y progreso provisional de aceleradores.
- Pendientes de entrega, entregadas por activar e incidencias recuperables.
- Comparación mensual solo cuando existe una base válida.

### SUPERVISOR — corregir desvíos del equipo

- Funnel agregado de equipos supervisados y desglose operativo por asesor.
- Backlog por antigüedad, SLA, incidencias y órdenes huérfanas.
- Asesores con baja conversión o sin actividad, con tamaño de muestra visible.
- Comisión estimada agregada por equipo.

### ADMIN — dirigir y conciliar el negocio

- Funnel organizacional, tendencia mensual, comparación por equipo y zona.
- Volumen pagable, no pagable y en maduración.
- Costo estimado de comisión y conciliación por orden.
- Calidad de datos y pendientes de períodos anteriores.

### BACKOFFICE — resolver la operación

- SLA, atrasos, incidencias, no entregas y entregadas pendientes de cierre.
- Importaciones en conflicto, identidades no resueltas y tiempos operativos.
- Enlaces directos a la bandeja filtrada para resolver cada grupo.

## Política de comisiones propuesta

- Base: postpago S/ 25, prepago S/ 12.50 y alta nueva S/ 0 por orden pagable.
- Las tarifas y aceleradores se versionan por vigencia; un cambio futuro no
  reescribe liquidaciones cerradas.
- Cada cálculo genera líneas por orden con beneficiario, equipo, regla, importe
  y razón de inclusión o exclusión.
- Una liquidación mensual pasa por `DRAFT`, `REVIEWED`, `APPROVED` y `LOCKED`.
- Los aceleradores conservan la cohorte por `registeredAt`, pero muestran por
  separado ventas ingresadas elegibles y ventas ya confirmadas como pagables.

## Reglas económicas confirmadas

- El acelerador 1 usa la cohorte de portabilidades ingresadas del día 1 al 15.
  Solo se confirman las que finalmente quedan entregadas y cerradas, aunque el
  cierre ocurra después del día 15.
- El bono 1 es S/ 200 entre 30–39 confirmadas, S/ 300 al llegar a 40 y luego
  `S/ 300 + S/ 10 × (confirmadas - 40)`. Por tanto, 41 equivalen a S/ 310.

## Decisiones económicas pendientes

1. Si el bono 2 es S/ 100 al llegar a 15 y luego
   `S/ 100 + S/ 10 × (pagables - 15)`.
2. Si las ventanas 1–15 y 25–30 excluyen deliberadamente los días 16–24 y 31.
3. Hasta qué fecha puede madurar una orden después de terminar el mes antes de
   bloquear la liquidación.
4. Si el SUPERVISOR puede ver importes individuales o únicamente totales del
   equipo, como recomienda esta especificación.

## Experiencia de usuario

- Crear `/performance` como espacio separado de `/orders`.
- Resumen inicial de máximo seis indicadores; el detalle aparece por
  exploración progresiva, no como una cuadrícula de botones.
- Cada alerta relevante abre `/orders` conservando período, equipo y filtro.
- Las tasas muestran numerador, denominador y tamaño de muestra.
- Los estados provisionales, confirmados y conciliados tienen etiquetas claras.
- En móvil se priorizan “qué requiere atención” y “cómo voy”; tablas comparativas
  quedan para pantallas amplias.

## Criterios de aceptación de la primera entrega

- **AC-001:** cada rol ve únicamente su alcance permitido.
- **AC-002:** el dashboard permite mes actual, mes anterior y rango, usando Lima.
- **AC-003:** funnel y tasas usan cohortes por fecha de ingreso.
- **AC-004:** entregadas y activadas se presentan como conceptos distintos.
- **AC-005:** cada métrica accionable enlaza a las órdenes que la explican.
- **AC-006:** las órdenes huérfanas no se atribuyen a asesores.
- **AC-007:** un período sin comparación muestra “Sin base comparable”.
- **AC-008:** cambios de orden actualizan la vista sin recarga manual completa.
- **AC-009:** pruebas de dominio verifican límites mensuales, roles y fórmulas.
- **AC-010:** la primera entrega no presenta una comisión como confirmada.

## Fuera de alcance inicial

- Nómina, transferencias o integración contable.
- Metas individuales editables y gamificación.
- Pronósticos basados en inteligencia artificial.
- Cálculo definitivo de aceleradores antes de cerrar sus decisiones económicas.
