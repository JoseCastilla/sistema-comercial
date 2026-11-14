# Auditoría de recupero y seguimiento de ventas — 13/11/2026

Pedido de José: «tenemos que mejorar el recupero y seguimiento de las ventas;
no estamos siendo eficientes y en muchos casos tenemos funciones que no estamos
usando».

**Cómo se hizo.** Tres agentes de Claude Opus 5.5 leyeron el código en paralelo
(recupero, seguimiento de ventas, inventario de funciones). Sus afirmaciones
centrales se contrastaron una por una contra el código y contra producción
(`app.distribuidoronline.com`, sesión de administrador, solo lectura, 13/11
entre las 18:55 y las 19:10 de Lima). Las cifras de este informe son de esa
lectura; lo inferido va marcado.

Después se recorrió la vista de asesor (Mi día, Recupero, Campañas, agenda y
Pedidos, solo lectura, 19:09 a 19:15) con la sesión que abrió José: es la
cuenta de una asesora real, la de más ventas del mes. Ver §4 bis.

Por último se recorrió la vista de supervisor del equipo HUANCAYO - EL TAMBO
(19:15 a 19:20). Ver §4 ter.

**No se hizo:** las consultas de uso no se han corrido en la base.

## 1. Veredicto

El sistema consulta a Máximo cuatro veces al día y **sabe** qué pasó con cada
pedido. Pero usa ese dato solo para mostrarlo: no cambia el estado del pedido,
no registra la entrega, no abre el caso de recupero y no lo cierra. Todo eso
espera a que una persona lo teclee, y la gente no lo teclea.

De ahí salen los tres problemas que José describe:

- **Seguimiento ineficiente:** de las 156 entregas fallidas que siguen como
  «Enviado», solo 6 tienen un subestado que coincide con Máximo.
- **Recupero que no recupera:** cuando el caso llega a la cola, el pedido ya
  está rechazado o cancelado. 94 calientes, ninguna con una sola gestión, 0
  recuperadas en el mes.
- **Funciones sin uso:** se construyeron pantallas para trabajar una cartera
  que nace tarde, no se depura y no dice qué hacer con cada caso.

La mejora no es otra pantalla. Es que **Máximo mande**: que su estado mueva el
pedido y el caso, y que a la persona le quede solo lo que exige criterio.

## 2. La foto de hoy

### 2.1 Noviembre (días 1 al 13)

| | Hoy | Mismo día de octubre |
|---|---|---|
| Ventas ingresadas | 624 | 575 (+8,5 %) |
| Ventas entregadas | 297 (47,6 %) | 361 (−17,7 %) |
| Entregas fallidas | 227 (36,4 %) | — |
| Por entregar | 43 | — |
| Falta activar | 19 | — |

Entran más ventas y se entregan menos. Más de una de cada tres falla.

### 2.2 Las 227 entregas fallidas, pedido por pedido

Estado que muestra el sistema (tecleado) frente al que reporta Máximo:

| El sistema dice | Máximo: RECHAZADO | Máximo: CANCELADO | Máximo: NO ENTREGADO | Total |
|---|---|---|---|---|
| Enviado · Agendado | 44 | 11 | 7 | 62 |
| Enviado · Asignado | 14 | 6 | 5 | 25 |
| Enviado · sin reporte | 2 | 0 | 0 | 2 |
| Enviado · No entregado | 44 | 17 | 4 | 65 |
| Enviado · Rechazado | 2 | 0 | 0 | 2 |
| Cancelado | 30 | 33 | 6 | 69 |
| Abierto | 0 | 2 | 0 | 2 |
| **Total** | **136** | **69** | **22** | **227** |

Lo que dice la tabla:

- **205 de 227 (90 %) ya son terminales en Máximo.** Solo 22 siguen en
  «No entregado», que es el único estado donde todavía se puede reagendar.
- **89 pedidos figuran como agendados, asignados o sin reporte** cuando Máximo
  ya los dio por fallidos. Para quien mira Pedidos, esas ventas «van bien».
- **Esos 89 más los 2 abiertos no tienen caso de recupero** (inferido de la
  regla: el caso solo nace con «Cancelado» o «Enviado · No entregado»,
  `recovery-internal-gate.ts:56-61`). Cuatro de cada diez fallidas nunca
  entran a la cola.
- **61 dicen «No entregado» (reintentable) y ya están rechazadas o
  canceladas.** El asesor que abra el caso va a llamar para reagendar algo que
  ya no se puede reagendar.
- 6 se cancelaron en el sistema cuando Máximo solo decía «No entregado».
  Conviene mirarlas: o Máximo quedó atrás o se cancelaron antes de tiempo.

### 2.3 Recupero de ventas

| | 14/10 | 13/11 |
|---|---|---|
| Calientes (ventas de 7 días) | 70 | **94** |
| Calientes con alguna gestión | 0 | **0** |
| Vencidas | — | 86 |
| Antiguas | 486 | **988** |
| Recuperadas en el mes | 0 | **0** |
| Casos abiertos en total | — | 1 082 |

De las 94 calientes, 60 traen dato de Máximo: 28 rechazadas, 24 canceladas y
8 no entregadas. Por motivo:

| Motivo en Máximo | Casos | Qué cabe hacer |
|---|---|---|
| Cliente ausente, excede 3 visitas | 17 | Reingresar como venta nueva si el cliente aún quiere |
| Portabilidad rechazada (servicio suspendido 4, teléfono no en servicio 4, no corresponde al DNI 3, tiempo mínimo 2, otra porta 1) | 14 | Corregir la causa y reingresar; algunas tienen fecha (30 días) |
| Cliente no desea · NO RECUPERABLE | 12 | Decisión de José (§6, D2) |
| Huella no corresponde | 9 | Reingresar con otra validación |
| No entregado · cliente ausente | 6 | **Reagendar hoy** |
| No entregado · otros | 2 | Llamar |

Las 86 vencidas dicen todas «Llamar ya». La página pesa 997 KB.

### 2.4 Lo demás

| Función | 14/10 | 13/11 |
|---|---|---|
| Campañas: casos asignados sin tocar | 1 876 | **1 873**; última gestión 01/09 (73 días); última base cargada 10/09 |
| Campañas: citas vencidas | — | 70 |
| Campañas: recuperados | 4 de 9 914 | 4 de 9 914 |
| Entregas fallidas de meses anteriores | 761 | **1 269** |
| Pedidos abiertos de meses anteriores | 178 | **432** |
| Importador DITO | 0 cargas | **0 cargas** |
| Cuotas asignadas | 0 | **0** (990 por defecto) |
| Equipos sin supervisor | 1 | **2**; MAGISTERIAL 01 hace 410 de las 624 ventas |

Mejoró: la consulta a Máximo ya no topa su límite (87 de 87), el saldo de DNI
está holgado (1 483) y la API lleva 19 días sin caerse.

## 3. Seguimiento de ventas

**S1. Todo el ciclo del pedido se teclea.** Enviado, Asignado, Agendado, No
entregado, Rechazado, Entregado y Cerrar son botones
(`order-next-step.tsx:33-87`, `order-status-change.ts:367-405`). La consulta a
Máximo guarda la foto y solo mueve `updatedAt`
(`agr-delivery-sync.ts:362-371`). Son 3 a 5 toques por pedido entregado y más
por uno fallido; con 624 ventas en 13 días, unos 2 000 a 3 000 toques al mes
que repiten lo que Máximo ya dijo.

**S2. La fecha de entrega es la hora del clic**, no la de Máximo
(`order-status-change.ts:361-365`). Cuota, comisión y la tendencia de
Rendimiento se miden sobre esa fecha. El día 8 figura 1 entrega y el 11
figuran 51: eso es cuándo se registró, no cuándo se entregó.

**S3. Nada cierra ni cancela solo.** El dominio dice: portabilidad entregada
cierra al día siguiente; sin entregar se cancela a los 4–5 días. El
mantenimiento automático corre cuatro trabajos y ninguno es de Pedidos
(`api/internal/maintenance/route.ts:33-36`). SPEC-079 (cierre en bloque) hizo
falta porque una persona cerró 661 de 863 pedidos uno por uno. Resultado:
1 269 fallidas y 432 abiertos de meses anteriores que ya son historia.

**S4. «Fuera de plazo» mide contra una fecha vieja.** Se calcula con el plazo
fijado al entrar la venta (`dito-sla.ts:191,225`) y no se recalcula; la fecha
pactada de Máximo se guarda y no se usa (`agr-delivery-sync.ts:495-496`).

**S5. El sistema ya sabe qué hacer con cada fallida y no lo dice.**
`getAgrAction` (`get-order-inbox.ts:766-930`) cruza estado × motivo y decide
reagendar, reingresar o conversar, pero solo se usa para ordenar la lista.

**S6. Dos clasificadores que se contradicen.** Pedidos usa `getAgrAction`;
Recupero usa expresiones regulares sobre el motivo sin mirar el estado
(`recovery-internal-gate.ts:68-124`). «Cliente ausente» terminal es
«reingresar» en Pedidos y «no entregado, prioridad alta» en Recupero.

**S7. Al cambiar de mes se pierde el seguimiento.** La consulta solo mira el
mes en curso (`consultation.ts:16-18`): el día 1 dejan de consultarse las
enviadas de fin de mes que aún no se entregan (inferido del código; no
observado).

**S8. El importador DITO no aporta al seguimiento.** El reporte trae «Estado
Pedido WC» y se guarda solo como dato adicional
(`dito-import-confirmation.service.ts:508,649-673`). José confirmó el 13/11
que el módulo no se necesita: se retira (§5).

## 4. Recupero de ventas

**R1. El caso nace tarde o no nace.** Solo se abre cuando alguien cambia el
estado en Pedidos (`order-status-change.ts:481-488`), cancela, o pulsa
«Enviar a recupero». La decisión de José del 30/08 (SA-005) fue que el caso
nazca en el primer intento fallido del courier: el código lo cumple solo si
una persona lo teclea a tiempo.

**R2. El reloj de dos horas cuenta desde el clic, no desde la novedad**
(`recovery-internal-gate.ts:166-173`), corre de noche y aplica igual a un
caso que no puede moverse hasta cumplir 30 días.

**R3. «Llamar ya» a todo.** La etiqueta no mira motivo ni estado
(`sales-recovery-work.ts:77-85`). «Cliente no desea NO RECUPERABLE» no
coincide con ninguna regla y cae en «Otro», prioridad media, dos horas.

**R4. No existe la salida «reagendada».** Dar un caso por recuperado exige
elegir una orden **nueva** del mismo DNI
(`resolve-recovery-case-action.ts:128-165`). Una venta salvada reprogramando
la visita —el caso más frecuente y más barato— no cuenta como recuperada: se
cierra como «descartada» cuando alguien marca la entrega. «Recuperadas este
mes: 0» puede estar subestimando; hoy no hay forma de saberlo.

**R5. No hay acción de reagendar.** El asesor necesita el número de pedido de
Máximo (`order.pedido`); el sistema lo tiene y no lo pone a mano.

**R6. Nada caduca.** La limpieza automática (vencer, liberar, devolver) filtra
solo Campañas (`expire-unverified-cases.ts:26`,
`return-stale-base-cases.ts:28`, `release-stale-cases-action.ts:60`). Las
antiguas pasaron de 486 a 988 en un mes.

**R7. El editor de gestión es el de Campañas.** Ofrece 13 resultados de la
base nacional («ya es Movistar», «tiene pedido de otra agencia») que no
aplican a una venta propia caída.

**R8. El aviso de vencidas sale en todas las pantallas del administrador**
(`commercial-app-shell.tsx:442`), que no puede trabajarlas. Marca 86 siempre.

**R9. Las tres primeras causas son prevenibles antes del despacho**, no
recuperables después: cliente ausente (confirmar la cita cuando Máximo dice
AGENDADO), portabilidad rechazada (validar 30 días, deuda y titularidad al
vender) y huella. El recupero las ve cuando ya murieron.

## 4 bis. Lo que ve la asesora que más vende

Al entrar, Mi día le dice: «Hoy 7 ventas · 0 gestiones», y debajo, bajo el
título «Ahora»:

| Lista | Elementos |
|---|---|
| Ventas caídas por salvar | 14 |
| Pedidos que te necesitan | 16 |
| Campaña | 129 |
| Ventas antiguas por recuperar | 112 (Recupero dice 78 para la misma persona) |

Son 271 tareas «para ahora» a quien registra 7 ventas al día. Su mes: 86
ventas, 41 entregadas, 33 fallidas.

**A1. El recupero sí se hace, pero fuera del módulo.** En 3 de sus 14 casos la
nota del pedido dice «reingresado» o «CANCELADO - SE REINGRESÓ»: la asesora
ya volvió a ingresar la venta en DITO. El caso sigue abierto, vencido y con
«Llamar ya», porque el sistema no une la venta nueva con el caso (la
sugerencia por DNI existe, pero solo dentro de la ficha y hay que elegirla a
mano). «0 gestiones, 0 recuperadas» mide que nadie registra, no que nadie
recupere. Es la corrección más importante a este informe: **el trabajo
existe; lo que falta es que el sistema lo reconozca solo.**

**A2. El mismo cliente sale dos veces.** 5 de sus 14 ventas caídas aparecen
también en «Pedidos que te necesitan», con otro número de pedido: la venta
original en una lista y su reingreso en la otra. En dos de esos casos el
reingreso también fue rechazado, y nada lo relaciona con el primer intento.

**A3. «Entrega fallida: llama al cliente» encabeza sus 33 fallidas.** De las
32 con dato de Máximo, 29 ya son terminales. Por motivo: cliente ausente tras
3 visitas 14, cliente no desea 7, portabilidad rechazada 7, huella 2, y solo
2 «solicita reagendamiento», que son las únicas donde llamar hoy cambia algo.
Están arriba de la lista, pero con el mismo título que las otras 31.

**A4. Casi la mitad de sus fallidas son «cliente ausente, excede 3
visitas»** (14 de 32). No es una asesora que venda mal: es una entrega que
nadie coordina entre la primera visita fallida y la tercera.

**A5. Tres de sus casos dicen «cancelado, no hay info en CGC».** CGC es como
el equipo llama al sistema que informa el estado de los pedidos, es decir
Máximo (José, 13/11). O sea: la asesora canceló porque Máximo no tenía el
pedido. Es el mismo caso que la alerta «Enviadas que no están en Máximo»
(SPEC-086), que hoy marca 0: la alerta solo mira las que siguen enviadas, y
estas ya se cancelaron a mano. Una venta que logística nunca recibió no es
una venta caída por el cliente: se reingresa, no se «llama ya».

**A6. Campañas le pide «ciérralo o agenda una fecha» en 129 casos** cuya
última gestión es de septiembre, y «0 de 3 intentos hoy» en cada uno. Mi
agenda está vacía. Es ruido puro en su pantalla de trabajo.

**A7. La ficha de una venta caída ofrece resultados de la base nacional**
(«Ya está activo en Movistar», «No cumple los 30 días») y, para cerrarla,
solo «Recuperado: hay una venta nueva» o «Perdido». No hay «reagendada» ni
«ya la reingresé».

## 4 ter. Lo que ve la supervisora (HUANCAYO - EL TAMBO)

Recorrido de solo lectura a las 19:15, con la sesión que abrió José.

| Su equipo en noviembre | |
|---|---|
| Ventas ingresadas | 148 |
| Entregadas | 49 (33 %) |
| Entregas fallidas | 60: 28 rechazadas, 24 canceladas, 8 no entregadas |
| Fallidas de meses anteriores | 324 |
| Calientes sin llamar | 28 de 28, y 282 antiguas |
| Campañas | 226 casos, los 226 sin tocar hace 71 días; 10 citas vencidas; 68 por repartir |
| Gestiones hoy | 0 |

**V1. «Hoy en mi equipo» es la mejor pantalla del sistema y dice la verdad.**
Pesa 51 KB, lista a cada asesor con lo que tiene pendiente y enlaza cada
cifra. Lo que muestra es que los seis asesores están «sin gestiones hoy».

**V2. La supervisora ve el problema y no tiene con qué moverlo.** Sus
palancas son «Reasignar» un caso y «Ver su día». No hay nada para empujar: ni
recordar a un asesor, ni reagendar ella, ni cerrar en bloque lo que Máximo ya
dio por perdido. Puede mirar 28 vencidas; no puede hacer que dejen de serlo.

**V3. Su equipo es el que mejor registra y el que peor entrega.** De sus
primeras 50 fallidas, 32 ya están canceladas en el sistema (en la
organización son 69 de 227). Y aun así entrega una de cada tres ventas. El
registro al día no salva ventas si llega cuando Máximo ya cerró.

**V4. Pedidos sí le resume Máximo** («Por revisar 60 · Rechazado 28 ·
Cancelado 24 · No entregado 8»). Es el dato correcto, puesto donde no dispara
nada: las 8 no entregadas son lo único urgente y no tienen lista propia.

**V5. Campañas le ofrece «Devolver N casos a los casos libres» por asesor.**
Un clic por persona limpiaría la cartera detenida. Nadie lo pulsa desde
septiembre; Repartir dice «45 abiertos · 45 vencidos» y sigue ofreciendo
repartir 68 más.

**V6. El aviso «27 ventas calientes vencidas» la sigue por todas las
pantallas**, igual que al administrador.

## 4 quater. Cómo llegan las respuestas de Máximo

Leído en producción con sesión de administrador (19:56 a 20:10): la respuesta
guardada de las 227 entregas fallidas de noviembre, pedido por pedido, desde
la ficha de Pedidos. El código lo leyó un agente y se contrastó aquí.

**Qué se pide y qué llega.** Una petición por venta a
`cgc.alka.net.pe/delivery-next/api/v2/provider/orders?q=<dígitos del pedido>`
con la cookie de sesión, en lotes de 10, sin reintentos
(`agr-delivery-sync.ts:42,99-128`). Máximo devuelve el pedido y su lista de
eventos; cada evento trae estado, fecha, motivo, submotivo, **usuario,
tiempo, distancia y comentario** (`order-history.ts:72-91`). El sistema toma
estado y motivo del último evento y guarda todos los eventos, pero la ficha
los oculta (`agr-delivery-fields.ts:59`): solo muestra el recorrido y el
número de intentos.

**M1. «Excede 3 visitas» se pone con 2.** De 80 pedidos con ese motivo, 72
tienen 2 eventos «no entregado» y 8 tienen 3. El recorrido típico (77 casos):
asignado › agendado › no entregado › asignado › agendado › no entregado ›
asignado › rechazado. No hay tercera cita agendada.

**M2. «No recuperable» se decide tras un intento.** De 54 pedidos «cliente no
desea · no recuperable», 49 tienen un solo «no entregado» antes del rechazo.

**M3. Toda venta fallida pasó primero por «no entregado».** Las 227. El
motivo de esa visita (no contesta, punto de encuentro, pide reagendar) es el
dato de primera mano; el motivo final lo reemplaza en la foto y es el único
que ven Pedidos y Recupero.

**M4. Hay dos caminos al final.** Los 136 rechazados salen de
«no entregado › asignado › rechazado» (ausencia o negativa). Las canceladas
pasan por «precancelado» (68 de 69): son huella y portabilidad rechazada.
«Precancelado» es una segunda ventana que el sistema consulta pero no
distingue.

**M5. El rechazo se registra de noche y el sistema mira de día.** De 205
terminales, 186 tienen su último movimiento entre las 19:00 y las 02:59. Las
consultas son a las 08, 12, 15 y 18. Un rechazo se conoce a las 08:00 del día
siguiente, y una visita fallida después de las 18:00 puede no verse nunca
como «no entregado». 85 de 205 llegan a terminal en menos de 12 horas desde
el registro de la venta.

**M6. Una corrida fallida se muestra como buena.** Si Máximo devuelve una
página de ingreso, un 429 o un 5xx, cada consulta suma un error y la corrida
cierra «Completada», con la clave «activa» y «Datos de Máximo al: ahora»
(`agr-delivery-sync.ts:346-349,372-395`). La pantalla no muestra errores ni
encontradas. Además «Datos de Máximo al» es la hora de nuestra consulta, no
la de la importación de Máximo, que llega en la respuesta y no se guarda.

**M7. Lo terminal no se vuelve a mirar**, ni lo que el asesor canceló a mano
una vez conocido el motivo: 4 «no entregado» del mes están congelados desde
el 10/11 o antes. Si Máximo reabre un pedido, nadie se entera.

**M8. Los motivos se guardan tal cual llegan** y las reglas comparan textos
sin tilde (`get-order-inbox.ts:788,801`). En las 227 de noviembre no hubo
tildes ni espacios dobles, así que hoy no falla; fallaría sin aviso el día
que Máximo cambie una grafía.

**Lo que esto cambia.** Para saber si un rechazo es real no hace falta creerle
al motorizado: Máximo ya entrega cuántas visitas hubo, qué se dijo en cada
una, quién la registró y a qué distancia. `docs/operacion/consultas/respuestas-maximo.sql`
abre esos datos (seis consultas, sin correr).

## 5. Funciones que no se usan

| Función | Evidencia | Recomendación |
|---|---|---|
| Campañas completo (Preparar, Revisar, Repartir, Seguimiento, Tablero, calidad, Mi cola, Mi agenda) | 0 gestiones desde septiembre; 1 873 casos detenidos; 70 citas vencidas | Pausar y liberar la cartera; ocultar del menú hasta que se relance (§6, D4) |
| Importador DITO («Ventas») | 0 cargas en toda la historia | **Retirar: José confirmó el 13/11 que no se necesita; todas las ventas entran por la extensión.** Ver nota abajo |
| Cuotas | 0 asignadas; todo es 45 por defecto | Asignarlas el día 1 o dejar de mostrar el porcentaje |
| Tablero de Campañas | Repite Seguimiento; solo se llega por pestaña | Absorberlo en Seguimiento |
| Rectificación de gestiones, calidad de tipificaciones | Sin gestiones, no hay qué rectificar | Queda dormido con Campañas |
| Escaladas | 0 en el mes | Confirmar con la consulta de uso antes de decidir |
| Origen de la venta (SPEC-083) | Se escribe y se muestra; ningún informe lo consume | Llevarlo a Rendimiento (entrega por origen) o dejar de pedirlo |
| Vistas antiguas de Pedidos («Activos», «Incidencias», «Finalizados») | Ningún enlace las abre (`order-inbox.tsx:57-66`) | Retirar |
| `totals.incidents` y `totals.overdue` | Dos consultas por cada carga de Pedidos, sin mostrarse (`get-order-inbox.ts:1334-1346`) | Retirar |
| Filtros por acción | Solo los usa su propia prueba (`order-inbox-filters.ts:26-97`) | Retirar o usar con S5 |
| Historial de Máximo y de DITO por pedido | Se escriben, nadie los lee | Es el dato para medir tiempo real en cada estado: usarlo |
| Pestaña «Preparar» para back office | Lleva a acceso denegado (`campaign-nav.tsx:17`) | Quitarla |
| `assign-agent-alias-form.tsx`, `salesRecoveryFallSelect` | Sin importadores | Retirar |
| `apps/crm/` | Solo `node_modules` y código generado, sin versionar | Borrar la carpeta local |
| Webhook GHL y `commercial-projection` | Sin llamador en el repositorio | Decidir con la fila 33 de la consulta de uso |
| «Hoy en mi equipo» para administración | El administrador cubre dos equipos y la página lo redirige (`team/today/page.tsx:21`) | Abrirla o nombrar supervisores |

**Retiro del importador DITO.** Abarca la entrada «Ventas» del menú, la
página `/admin/dito-imports`, el módulo `dito-import` de la API y sus dos
tablas (`dito_import_batches`, `dito_import_rows`), vacías en producción. Una
consecuencia a tener presente: era la vía prevista para reponer ventas cuando
la API se cae (incidente del 16/10). Sin él, la extensión pasa a ser la única
puerta, así que conviene cerrar antes o junto con el retiro los dos riesgos
de §8: que la API arranque aunque la base tarde, y que la extensión no diga
«enviada» cuando la venta no entró.

Menú hoy: asesor 6 entradas, supervisor 7–8, back office 5, administrador 9.
Con Campañas en pausa y Recupero dentro de Pedidos y Mi día, el asesor queda
en 4 (Mi día, Pedidos, Rendimiento, DNI).

**El sistema no mide su propio uso.** No hay último ingreso, ni registro de
pantallas abiertas, ni PostHog. Lo que sí queda son las acciones:
`docs/operacion/consultas/uso-por-funcion.sql` trae ocho consultas de solo
lectura (uso por función en 30 días e histórico, gestiones por persona,
cartera detenida, corridas de Máximo) para correr en DbGate.

## 6. Decisiones que son de José

Cada una con recomendación; ninguna se ejecutó.

**D1. ¿Máximo manda sobre el estado del pedido?** Recomendación: sí. La
consulta escribe subestado y entrega con autor «sistema» e historial; la
persona puede corregir y su corrección queda registrada.

**D2. «Cliente no desea · NO RECUPERABLE».** El código de Pedidos dice que
siempre se conversa; Máximo dice que no hay nada que hacer. Recomendación:
sale de «Llamar ya» a una lista aparte con cierre en un clic; quien quiera
llamar, puede.

**D3. Caducidad.** Recomendación: toda fallida y todo caso de un mes se
cierran solos al terminar la primera semana del mes siguiente, que es lo que
ya dice el ciclo de vida. Hoy limpiaría 1 269 fallidas y la mayoría de las
988 antiguas.

**D4. Campañas.** Recomendación: pausa oficial. Devolver los 1 873 casos al
pool, cancelar las 70 citas vencidas y ocultar el módulo del menú del asesor.
Se relanza cuando haya baja producción, que es para lo que se diseñó.

**D5. Fecha de entrega para cuota y comisión.** Hoy es la del clic.
Recomendación: la de Máximo. Mueve dinero entre días y entre ventanas de
bono, así que la decide José antes de tocar nada.

**D6. Recuperada = reagendada.** Recomendación: una venta caída que termina
entregada cuenta como recuperada para quien la gestionó, sin exigir orden
nueva.

## 7. Propuesta por orden de retorno

**Etapa 1 — Máximo manda** (la que cambia el resultado)

1. La consulta a Máximo escribe subestado y fecha de entrega del pedido (S1,
   S2; depende de D1 y D5).
2. La misma consulta abre el caso de recupero en el primer NO ENTREGADO, lo
   cierra si se entrega y lo reclasifica si pasa a terminal (R1).
3. Una sola regla estado × motivo en `packages/validation` que alimente
   Pedidos y Recupero, con cuatro salidas: **reagendar**, **reingresar**,
   **corregir y reingresar el día X**, **cerrar** (S5, S6, R3).
4. La cola del asesor muestra esa acción, con el número de pedido de Máximo a
   la vista para reagendar y el resultado «Reagendada» (R4, R5; D6).
4b. Cuando entra una venta nueva con el mismo DNI de un caso abierto, el caso
   se da por recuperado solo y las dos ventas quedan unidas (A1, A2). Es lo
   que hoy la asesora hace sin que el sistema se entere.
5. Aviso a administración cuando la clave de Máximo caduca: hoy el
   mantenimiento lo reporta como correcto y todo lo anterior dependería de
   esa clave.

**Etapa 2 — Limpiar**

6. Cierre automático de entregadas al día siguiente y caducidad de fallidas y
   casos (S3, R6; D3).
7. Campañas en pausa y cartera liberada (D4).
8. Menú por rol sin lo que no se usa; aviso de vencidas fuera de las
   pantallas del administrador (R8, §5).
9. Retirar el código muerto de §5.

**Etapa 3 — Medir y prevenir**

10. Registro de uso por pantalla y tasa de salvado por estado × motivo.
10b. Dar palancas al supervisor en «Hoy en mi equipo»: lista de «no
    entregadas de hoy» de su equipo y cierre en bloque de lo que Máximo ya dio
    por terminal (V2, V4).
11. Prevención: aviso al asesor cuando su pedido pasa a AGENDADO para que
    confirme la cita con el cliente; validación de 30 días, deuda y
    titularidad al registrar la venta (R9).
12. Mi día con una sola lista por cliente y un tope de lo que es «ahora»
    (§4 bis): hoy son 271 elementos para una persona.

Aparte, y ya decidido: retirar el importador DITO (§5).

Cada punto pide su spec antes de construirse; la etapa 1 cabe en una sola
(SPEC-088) con los puntos 1 a 5 como fases.

## 8. Riesgos abiertos que no son de este pedido

- `scripts/entregar.sh:92` sigue con `git add -A`; hay archivos SQL con
  teléfonos reales sin publicar. Urgente desde el 24/09.
- La API todavía muere si la base no está lista al arrancar
  (`apps/api/Dockerfile:46`): la causa del incidente del 16/10 sigue ahí.
- La extensión dice «Venta enviada correctamente» con cualquier respuesta de
  n8n (`apps/dito-extension/popup.js:158-162`), aunque la venta no entre.
- La clave de Máximo se sigue pegando a mano (hoy 18:01, Miguel Guzman).
- No se pudo confirmar que el worker esté desplegado: Logística sigue
  diciendo «o quien abra Pedidos si el proceso no está».

## 9. Lo que falta verificar

- Las vistas de asesor y de supervisor se leyeron con una cuenta cada una;
  los patrones de §4 bis y §4 ter pueden variar entre personas y equipos.
- «Ver su día» del supervisor no se abrió.
- Las consultas de `uso-por-funcion.sql` están contrastadas con el esquema
  pero no se han corrido.
- Que la consulta a Máximo provoque errores de «modificada por otro usuario»
  al guardar un cambio a las 08, 12, 15 y 18: la consulta mueve `updatedAt`,
  pero no se comprobó que el bloqueo use ese campo.
- Que los 91 pedidos sin caso de §2.2 realmente no lo tengan: es inferencia
  de la regla, no un conteo en la base.
- Cuántas ventas del 16/10 se repusieron: el importador tiene 0 cargas, así
  que o entraron por otra vía o siguen fuera.
