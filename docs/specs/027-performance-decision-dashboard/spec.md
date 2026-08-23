# SPEC-027 — Dashboard de rendimiento orientado a decisiones

## Problema

El dashboard existente contiene datos correctos, pero el pulso diario domina la
pantalla, la tasa pagable no explica su denominador y la lectura por asesor
omite a vendedores activos sin ventas. Esto dificulta detectar inactividad,
riesgo de recuperación y caída de producción.

## Objetivo

Convertir `/performance` en una superficie para decidir: medir volumen,
conversión, riesgo, cobertura del equipo y evolución individual sin mezclar el
día del ingreso con el día en que se registró un cierre.

La lectura también debe permitir comparar el ritmo de los asesores a lo largo
del mes y ofrecer al vendedor una vista personal de avance diario y composición
de ventas.

## Reglas

- Los indicadores mensuales usan cohortes por `registeredAt` en Lima.
- Conversión de entrega = entregadas / ventas ingresadas.
- Conversión pagable = portabilidades pagables / portabilidades ingresadas.
- Por recuperar = canceladas + enviadas no entregadas de la cohorte.
- Los cierres diarios se atribuyen a `closedAt` y se denominan “cierres
  registrados”.
- La tabla incluye vendedores primarios, activos y habilitados para vender,
  aunque tengan cero ventas en el período.
- Los vendedores históricos con ventas se conservan y se identifican como
  históricos cuando ya no están activos en el alcance.
- La matriz diaria usa `registeredAt` en Lima, mantiene los días futuros
  diferenciados y no los interpreta como días sin producción.
- El avance personal muestra venta diaria, acumulado, días productivos, promedio
  y mejor día del período.
- El mix personal separa alta nueva, portabilidad de origen prepago y
  portabilidad de origen postpago.
- La zona inicial sigue una jerarquía estable: indicadores, tendencia principal
  y decisiones inmediatas. Los análisis detallados aparecen después.
- La vista de equipo responde primero qué se vendió, cómo evoluciona y dónde
  intervenir; la vista personal responde qué logró el asesor, cómo avanza y qué
  debe recuperar.
- Los módulos son composables y reutilizan tokens centrales; no se introducen
  estilos aislados por página.
- La identidad visual del dashboard es una expresión del sistema general: fondo
  neutro, superficies claras, azul para interacción, verde para éxito y colores
  analíticos independientes de los estados operativos.
- Los cambios de color se definen como tokens semánticos para tema claro y
  oscuro y deben poder reutilizarse en Pedidos, Personas, Equipos e
  Importaciones sin duplicar reglas por módulo.
- No se modifican reglas de comisión, estados ni permisos.

## Criterios de aceptación

1. Los filtros aparecen antes de los indicadores.
2. Los cuatro KPIs principales muestran volumen, entrega, pagables y recupero.
3. La tasa pagable declara explícitamente el total de portabilidades.
4. Supervisión y administración ven vendedores activos con cero ventas.
5. La tabla muestra variación de ingresos, entrega, pagables, recupero y
   activaciones pendientes.
6. El pulso diario aparece después de los indicadores mensuales y usa la
   etiqueta “cierres registrados”.
7. Los enlaces de riesgo abren la bandeja con el período y alcance vigentes.
8. La vista de equipo compara asesores contra los días del mes sin superponer
   series difíciles de leer.
9. La vista personal prioriza avance diario y mix antes del detalle operativo.
10. Los KPIs se leen como módulos independientes y la tendencia no compite con
    la matriz detallada.
11. Acción principal y estado exitoso no comparten el mismo color semántico.
12. Las series analíticas usan una paleta propia y conservan contraste en tema
    claro y oscuro.
