# Tasks — SPEC-038

## Aceleradores

- [x] Política de comisiones con **ventanas** en lugar de un acelerador único:
      tramos por ventana y cierre abierto al fin de mes (BR-001, BR-002).
- [x] `calculateAcceleratorWindow` genérico: cohorte por ingreso, confirmación
      posterior admitida, tramos ordenados y extra marginal tras el último
      (BR-003 a BR-005).
- [x] Segunda ventana del 25 al último día del mes con bono S/ 100 al llegar
      a 15 y S/ 10 por adicional (BR-005).
- [x] Las métricas exponen todas las ventanas y su total; la estimación del
      período suma ambas (BR-006).
- [x] La agregación por equipo suma ventana por ventana desde el cálculo
      individual, porque el acelerador no es lineal.
- [x] La redacción de importes cubre todas las ventanas (BR-016).
- [x] El panel del asesor muestra ambas ventanas, el pendiente de activación
      de cada una, y cuánto falta y cuánto vale el siguiente tramo (BR-013).
- [x] La cuota cuenta solo portabilidades: un alta nueva entregada no suma
      (BR-007).
- [x] Pruebas de dominio: ventana del 25 al fin de mes, 18 confirmadas igual a
      S/ 130, suma de ambos bonos, días 16–24 sin acelerador, cohorte que
      confirma después del cierre, y la distinción entregadas/confirmadas.

## Nombres

- [x] `formatAdvisorDisplayName` resuelve nombre y apellido desde el correo,
      reconstruye apellidos compuestos y respeta el dato guardado
      (BR-017, BR-018).
- [x] Aplicado a la tabla por asesor y a la matriz diaria.
- [x] Pruebas con los casos reales de la operación.

## Cuotas — pendiente

- [ ] Esquema de cuotas por período y ventana, con destinatario equipo o
      asesor, actor y valor previo (BR-009 a BR-011).
- [ ] Asignación por `ADMIN` a equipos y reparto por `SUPERVISOR` entre sus
      asesores, con aviso —no bloqueo— cuando lo repartido no cubre (BR-009).
- [ ] Cuota por defecto igual al primer tramo de cada ventana (BR-008).
- [ ] Congelar la cuota de un período cerrado (BR-010).
- [ ] Avance de cuota por asesor en la vista de supervisión, legible de un
      vistazo para detectar a quien está cerca de un tramo (BR-014).
- [ ] Resultado de la última ventana cerrada cuando no hay ventana activa
      (BR-015).

## Verificación

- [x] 206 pruebas de dominio en verde.
- [x] TypeScript y lint de `web` y `validation` sin errores.
- [x] Validación visual con datos reales.
- [ ] Validación de las cuotas con sesiones `ADMIN` y `SUPERVISOR`.
