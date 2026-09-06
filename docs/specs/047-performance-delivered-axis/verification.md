# SPEC-047 — Verificación

## Fase 1 (06/09/2026)

**Pruebas**: `@repo/validation` 318 en verde; web 202 (6 nuevas en
`rendimiento-entregadas`: entregadas por operación, entregada sin fecha no
cuenta, venta ingresada el 31/08 y entregada el 02/09 es entregada de la
cohorte de agosto, corte de maduración al día 6, orden por defecto
`ENTREGADAS`, filtro `SIN_ENTREGAS`, `orden=PAGABLES` viaja y `ENTREGADAS`
no). Tipos y lint limpios.

**Local, agosto de 2026 (mes cerrado), sesión de administrador**:

- AC-001 / AC-007: «Ventas entregadas 118» (112 portabilidades y 6 altas
  nuevas) abre Pedidos con `status=DELIVERED` y **118 encontradas**.
- AC-002: en setiembre (mes en curso, sin ventas en local) el pie dice «0
  frente a 1 entregadas hasta el día 6 del mes pasado (-100%) · esa cohorte
  terminó con 87»; en agosto, «118 este mes; sin entregas el mes pasado para
  comparar».
- AC-003: sin `orden=` el desglose va 23 → 21 → 17 → 14 entregadas.
- AC-004: equipos 101 + 9 + 6 + 1 + «Sin equipo asignado» 1 = 118 = tarjeta;
  la columna «Entregadas» está en equipos y asesores.
- AC-005: `gestion=SIN_ENTREGAS` muestra su definición y «1 de 14 asesores».
- AC-006: prueba del cruce de meses en verde.
- BR-006: cinco bloques declaran su fecha (resumen por equipo, desglose,
  actividad diaria, matriz, conversión).

**Producción**: pendiente.

## Fase 2

Pendiente.

## Fase 3

Pendiente.
