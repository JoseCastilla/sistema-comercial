# Pedidos por rol: qué hace cada uno y qué necesita ver

**Fecha:** 25/09/2026
**Fuente:** los 1402 pedidos de septiembre en producción, con la sesión de
administrador y solo lectura. No se guardó nada. Se usaron los datos que la
bandeja ya entrega: estado, nota, quién cerró y el último dato de Máximo.
**Pedido de José:** «¿Qué significa "por mover"? ¿Qué ve el asesor cuando va
a su hoja de pedidos? Antes analiza cómo es el comportamiento en la gestión
del asesor, del supervisor y del administrador».

## 1. Lo que dicen los datos

| Hecho | Cifra |
|---|---|
| Pedidos del mes | 1402 |
| Cerrados | 863 (62 %) |
| Cancelados | 413 (29 %) |
| En curso (sin entregar ni cancelar) | 94 (7 %) |
| Entregados sin cerrar (esperan activación) | 32 |
| Asesores con ventas en el mes | 17 |
| Pedidos en curso por asesor | 10 como máximo |
| En curso fuera de plazo | 63 de 94 |
| En curso sin cambios hace un día o más | 48 de 94 |
| En curso que Máximo reporta con problema | 46 de 94 |
| Cierres hechos por una sola persona (Miguel Guzman) | 661 de 863 (77 %) |
| Cierres de la supervisora (Erika Lavado) | 141 |
| Pedidos con nota | 804 |
| Notas que solo dicen el origen («BASE», «CAMPAÑA») | 156, más 33 que lo mezclan con otra cosa |
| Notas de cancelados que copian la frase de Máximo que antes traducíamos | ~200 («El cliente no estaba cuando llegó el courier»…) |
| Pedidos cerrados que todavía muestran un estado de Máximo | 451. 267 dicen «AGENDADO» porque Máximo deja de consultarse al cerrar |

## 2. Qué hace cada rol

### Asesor

- **Qué hace:**
  - Vende y la extensión registra el pedido.
  - En la nota escribe de dónde salió la venta («BASE», «CAMPAÑA»), porque
    no hay un campo para eso. También escribe a qué hora se aprueba
    («APROBAR 4 PM»).
  - Cuando la entrega falla, llama al cliente y reagenda o pide la
    cancelación.
  - No cierra pedidos.
- **Cuánto tiene:** entre 1 y 10 pedidos en curso. Casi la mitad falló
  según Máximo.
- **Dónde entra:** a Mi día, que ya le muestra sus entregas fallidas. Va a
  Pedidos para ver sus ventas del mes o para mover una.
- **Qué necesita ver en Pedidos:**
  - Sus ventas en curso y qué pasa con cada una: plazo, qué dice Máximo y
    por qué.
  - El teléfono para llamar.
  - Un botón para decir en qué quedó.
  - Con 10 pedidos no necesita siete pestañas: basta una sola lista
    ordenada por urgencia.

### Supervisor

- **Qué hace:**
  - Mira a su equipo.
  - Cierra pedidos activados de su equipo (141 este mes).
  - Aprueba o rechaza cancelaciones y responde escalaciones.
  - Manda a recupero.
- **Dónde entra:** a Hoy en mi equipo. Va a Pedidos para intervenir.
- **Qué necesita ver en Pedidos:**
  - Su equipo por asesor: quién tiene entregas fallidas o vencidas y
    cuántas.
  - Después, el detalle.
  - Lo que solo él resuelve: cancelaciones por aprobar y escalaciones.

### Administrador y backoffice

- **Qué hacen:**
  - Cierran cuando el operador activa la línea. Casi todo lo hace una
    persona: 661 cierres este mes, uno por uno.
  - Cancelan lo que Máximo reporta como perdido y reingresan pedidos.
  - Cargan ventas de DITO, renuevan la credencial de Máximo y corrigen
    datos.
- **Qué necesitan ver en Pedidos:**
  - La cola de entregados sin cerrar, con selección múltiple para cerrar
    varios a la vez.
  - La cola de entregas fallidas, con el motivo de Máximo, para decidir
    si se cancela o se reingresa.

## 3. «Por mover»

Era un nombre nuestro, sin sentido para el equipo. La vista reúne los
pedidos en curso que todavía no se entregan ni se cancelan y que Máximo no
reporta con problema. Pasa a llamarse **«Por entregar»**.

Qué ve hoy el asesor al entrar a Pedidos:

- Cae en «Por entregar»: sus ventas del mes en curso, que suelen ser menos
  de 10.
- Las pestañas llevan cifra. Las que más usa son «Entregas fallidas» y
  «Falta activar».
- Al elegir un pedido ve «¿En qué va?» con los pasos posibles, la nota, lo
  que dice Máximo y la ficha.

## 4. Errores que el análisis mostró y ya se corrigieron

- **Dato viejo de Máximo en pedidos cerrados o entregados.** Máximo deja
  de consultarse al cerrar (SPEC-029), así que 267 pedidos cerrados seguían
  diciendo «AGENDADO». Ahora la fila no lo muestra y el panel dice «Último
  dato de Máximo · del 20/09. Ya no se consulta: el pedido está cerrado».
- **Pasos ofrecidos con una cancelación pendiente.** El pedido no cambia
  hasta que la revisen (SPEC-013). Ahora el panel lo dice en lugar de
  ofrecer «Enviado».

## 5. Propuestas, en orden de retorno

1. **Cerrar varios a la vez** (administración y backoffice). Selección
   múltiple en «Falta activar» y un botón «Cerrar: ya activaron (N)».
   Hoy son 661 cierres al mes, de a uno, con dos selectores cada uno.
   *Presentación, sin regla nueva: ya pueden cerrar.*
2. **Pedidos del asesor en una sola lista.** Sin pestañas, agrupada por lo
   que toca: «Entrega fallida: llama al cliente», «Por entregar», «Falta
   activar» y «Cerradas», esta última plegada. Con el teléfono para llamar
   y el motivo de Máximo en la fila. *Presentación.*
3. **Equipo por asesor para supervisión.** Arriba, una fila por asesor con
   sus entregas fallidas, vencidas y por activar, que abre su lista. Es lo
   que SPEC-074 dejó como fase 2. *Presentación.*
4. **Un campo «Origen de la venta»** (Base, Campaña, Otro) en lugar de
   escribirlo en la nota. **Decisión de José:** es un dato nuevo del
   pedido. Hoy 189 notas se usan para eso y Rendimiento no puede contar
   por origen.
5. **Cancelación con el motivo de Máximo en un toque** (administración).
   Hoy se copia la frase a mano en unas 200 notas. **Decisión de José:**
   choca con «no interpretar a Máximo» si el motivo se traduce; se podría
   usar el texto original.
