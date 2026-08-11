# SPEC-016 — Verificación

**Estado:** `READY_FOR_VALIDATION`
**Fecha:** 2026-08-11

## Evidencia esperada

- Una orden no entregada de un día o semana anterior del mes aparece en el
  contador operativo.
- Una orden cancelada del mes también aparece en Recuperación.
- Una orden de un mes anterior no se mezcla en ese contador.
- La acción abre el mes actual con filtro Recuperación.
- Una orden rechazada no aparece en Recuperación y sí permanece en Incidencias.
- AGENT no observa pedidos de otros asesores.
- El cambio de estado en tiempo real retira la orden cuando deja de ser no
  entregada.
- No se agregan tablas, columnas ni procesos manuales de producción.

## Evidencia local obtenida

- `pnpm check-types`: aprobado en los nueve paquetes del monorepo.
- `pnpm lint`: aprobado sin advertencias.
- 112 pruebas del dominio compartido aprobadas, incluida la regla que suma no
  entregados y cancelados y excluye rechazados.
- La imagen Docker de Web compiló correctamente con el mismo flujo de
  producción; el respaldo SQL quedó fuera del contexto de compilación.
- La copia local de producción identifica 79 candidatos del mes: 8 no
  entregados y 71 cancelados; el rechazado permanece en Incidencias.
- El acceso principal fuerza `MONTH` al elegir Recuperación desde la bandeja.
- Los enlaces de Desempeño conservan `RANGE`, `from` y `to`, evitando abrir un
  mes diferente al que produjo la métrica.
- El contador mensual reutiliza exactamente el alcance por usuario y equipo de
  la bandeja; no abre un camino alternativo de visibilidad.
- La validación visual con AGENT queda pendiente porque la sesión local se
  encuentra en la pantalla de acceso.

## Calidad de la causa de cancelación

La auditoría agregada de las 71 cancelaciones encontró 6 sin motivo y 65 con
texto libre. Solo 3 textos pueden reconocerse de forma directa como deuda o
antigüedad y ninguno como logística mediante palabras evidentes. No corresponde
automatizar esa clasificación con expresiones regulares ni corregirla en DBGate.
