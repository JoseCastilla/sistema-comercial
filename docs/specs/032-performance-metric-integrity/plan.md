# Plan — SPEC-032

1. **Unificar la elegibilidad de pago.** `calculatePerformanceMetrics` deja de
   duplicar la regla en línea y deriva `payable` y `baseCommissionCents` de
   `evaluatePerformanceOrderPayment`, que ya excluye `UNASSIGNED`.
2. **Exponer helpers puros de calendario.** `getLimaDayOfMonth` y
   `filterOrdersRegisteredThroughLimaDay` en `performance-metrics.ts` para que
   el recorte pro-rata sea testeable sin base de datos.
3. **Corregir el traductor de alcance.** `getAccessWhere` recibe
   `salesEnabled`, traduce `SUPERVISED_TEAMS_WITH_OWN_AND_ORPHANS` igual que la
   bandeja y niega por defecto cualquier tipo no reconocido.
4. **Incluir al supervisor vendedor en cobertura.** La consulta de vendedores
   primarios agrega `userId = actor` cuando el rol es SUPERVISOR.
5. **Comparación pro-rata.** En el mes en curso, el servidor filtra la cohorte
   del mes anterior hasta el día transcurrido y expone
   `comparison.comparedThroughDay` para que la UI etiquete el delta.
6. **Fila "Sin asesor".** El servidor agrega las órdenes sin asesor como bloque
   propio (`unattributed`) y la tabla lo presenta como fila de alerta al final
   del análisis detallado.
7. **Pruebas y verificación.** Casos nuevos en
   `packages/validation/test/performance-metrics.test.mjs`; typecheck y lint de
   Web y validation; validación visual por rol.
