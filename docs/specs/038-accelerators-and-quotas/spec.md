# SPEC-038 — Segundo acelerador y cuotas asignables

**Estado:** `IN_PROGRESS`
**Versión:** 1.0
**Fecha:** 2026-08-31

## Problema

Tres carencias que se descubrieron juntas al leer la matriz de ventas por
asesor y día:

1. **El segundo acelerador no existe.** SPEC-014 lo dejó como decisión
   económica pendiente desde el 09/08/2026 y nunca se construyó, así que el
   sistema subestima lo que gana cada asesor.
2. **No hay cuotas.** Nadie puede asignar un objetivo a un equipo ni a un
   asesor, así que no existe forma de responder "¿va a llegar?".
3. **El avance no se ve donde importa.** La matriz diaria muestra ventas
   ingresadas, que no es lo que mide ni la cuota ni el acelerador. Un
   supervisor no puede detectar a quien está a dos ventas de un tramo, que es
   justo la persona que vale una llamada.

## Glosario de esta spec

Tres medidas distintas que hasta ahora se mezclaban:

Las tres se cuentan **solo sobre portabilidades**: un alta nueva aporta carga
operativa, pero no comisiona ni cuenta para cuota ni acelerador.

- **Ingresada:** la venta se registró. Es actividad, no resultado.
- **Portabilidad entregada:** el cliente recibió el chip. Es el último paso
  que el asesor puede influir, y por eso **es la medida de la cuota**.
- **Confirmada:** portabilidad entregada y además cerrada. Es cuando el
  negocio cobra, y por eso **es la medida del acelerador**.

La diferencia entre entregada y confirmada es exactamente el pendiente de
activación, que el sistema ya calcula. Hacerla visible convierte un reclamo
—"cumplí mi cuota y no me pagaron el bono"— en una tarea concreta: activar lo
que falta.

## Reglas de negocio

### Aceleradores

- **BR-001:** existen dos ventanas de acelerador sobre la cohorte de
  portabilidades por fecha de ingreso en Lima: la primera del **día 1 al 15**
  y la segunda del **día 25 al último día del mes**. La segunda dura seis o
  siete días según el mes.
- **BR-002:** los días **16 al 24 quedan deliberadamente fuera** de todo
  acelerador. Esas ventas pagan comisión base y ningún bono marginal; el
  incentivo se concentra al inicio y al cierre del mes.
- **BR-003:** una venta cuenta para el acelerador de su ventana cuando queda
  **confirmada** —entregada y cerrada—, aunque el cierre ocurra después de que
  la ventana termine. La cohorte la fija el ingreso; la confirmación solo
  decide si suma.
- **BR-004:** el bono de la primera ventana es S/ 200 entre 30 y 39
  confirmadas, S/ 300 al llegar a 40, y luego `S/ 300 + S/ 10 × (confirmadas −
  40)`.
- **BR-005:** el bono de la segunda ventana es S/ 100 al llegar a 15
  confirmadas, y luego `S/ 100 + S/ 10 × (confirmadas − 15)`.
- **BR-006:** ambos bonos son independientes y se suman. Una misma venta
  pertenece a una sola ventana, la de su fecha de ingreso.

### Cuotas

- **BR-007:** la cuota se mide en **portabilidades entregadas de la cohorte de
  la ventana**: portabilidades ingresadas dentro de la ventana que llegaron a
  entregarse, aunque la entrega ocurra después de que la ventana cierre. Las
  altas nuevas quedan fuera, igual que en el acelerador. Cuota y acelerador
  comparten cohorte y se diferencian solo en el criterio de cumplimiento
  —entregada frente a entregada y cerrada—, de modo que ambos números hablen
  del mismo conjunto de ventas.
- **BR-008:** la cuota por defecto de cada ventana es **el primer tramo de su
  acelerador** —30 en la primera, 15 en la segunda—. El sistema funciona sin
  configurar nada y el objetivo por defecto ya significa dinero.
- **BR-009:** la cuota baja por una cadena de tres niveles. La **cuota de la
  organización** es el total del período y la fija el dueño del negocio;
  `ADMIN` la reparte entre los equipos; cada `SUPERVISOR` reparte la de su
  equipo entre sus asesores. En cada nivel la interfaz advierte cuando lo
  repartido no cubre el objetivo, pero **no lo impide**: repartir de menos
  puede ser una decisión consciente ante ausencias.
- **BR-009b:** un equipo sin supervisor activo lo reparte `ADMIN`
  directamente entre sus asesores. La interfaz declara en cada equipo quién
  es responsable de su reparto, para que ninguno quede sin dueño.
- **BR-009c:** mientras el sistema no tenga un rol de dueño distinto del
  administrador, la cuota de la organización la fija `ADMIN`. El modelo de
  datos ya la separa de las de equipo, así que introducir ese rol después solo
  cambia quién puede editar esa fila.
- **BR-010b:** una cuota se fija **antes** del período, así que su selector
  admite meses futuros hasta un horizonte de doce meses. El parser del
  dashboard no sirve para esto: recorta al mes actual, porque un mes futuro no
  tiene resultados que mostrar.
- **BR-010:** una cuota se asigna por período y ventana, y **queda congelada
  una vez que el período termina**. Cambiar la cuota de un mes cerrado
  reescribiría la historia de cumplimiento.
- **BR-011:** toda asignación de cuota registra actor, momento y valor previo.
- **BR-012:** la cuota **no genera pago**. Es un objetivo de gestión; lo que
  paga son la comisión base y los aceleradores.

### Visibilidad

- **BR-013:** el asesor ve, por cada ventana vigente: su cuota, cuántas
  entregadas lleva, cuántas confirmadas, cuánto le falta para el siguiente
  tramo del acelerador y **cuánto dinero representa ese tramo**.
- **BR-014:** supervisión y administración ven el avance por asesor de la
  ventana vigente, ordenable, de modo que se identifique de un vistazo a quien
  está cerca de un tramo sin alcanzarlo.
- **BR-015:** fuera de una ventana activa, la superficie muestra el resultado
  de la última ventana cerrada en lugar de un contador vacío.
- **BR-016:** se respetan las reglas económicas de SPEC-014: `BACKOFFICE` no
  ve importes y el supervisor ve el avance de sus asesores sin el importe
  individual de comisión.

### Presentación de nombres

- **BR-017:** las superficies de rendimiento presentan al asesor como
  **"Nombre Apellido"** con inicial mayúscula, resolviendo ambos segmentos
  desde el correo corporativo `nombre.apellido@`, igual que ya hace la forma
  compacta de la bandeja.
- **BR-018:** la normalización es **solo de presentación**. El nombre
  registrado no se modifica: es la identidad legal que necesitará la
  liquidación de comisiones.

## Criterios de aceptación

- **AC-001:** una venta ingresada el día 26 de un mes de 31 días cuenta para
  la segunda ventana; una del día 20 no cuenta para ninguna.
- **AC-002:** 18 confirmadas en la segunda ventana producen S/ 130.
- **AC-003:** los dos aceleradores se suman en la estimación del período.
- **AC-004:** una venta ingresada el día 14 y cerrada el día 22 cuenta para la
  primera ventana.
- **AC-005:** sin cuota configurada, cada ventana muestra su tramo como
  objetivo por defecto.
- **AC-006:** un supervisor solo puede repartir cuota entre asesores de sus
  equipos.
- **AC-007:** repartir menos que la cuota del equipo advierte pero no bloquea.
- **AC-008:** la cuota de un período cerrado no se puede modificar.
- **AC-009:** el asesor ve cuánto le falta para el siguiente tramo y cuánto
  vale.
- **AC-010:** supervisión identifica en una sola lectura a los asesores que
  están cerca de un tramo sin alcanzarlo.
- **AC-011:** los nombres se muestran como "Nombre Apellido" sin alterar el
  dato guardado.

## Fuera de alcance

- La liquidación mensual con estados `DRAFT` a `LOCKED` de SPEC-014.
- Cuotas sobre métricas distintas de las entregadas de la ventana.
- Proyección automática de cierre de mes.
