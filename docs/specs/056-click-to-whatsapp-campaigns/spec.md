# SPEC-056 — Campañas Click to WhatsApp y resultado por anuncio

**Estado:** `BORRADOR` — en pausa desde el 24/09/2026: el CRM y WhatsApp se replantearán desde cero, según el negocio, cuando José los aborde; esta spec queda como referencia

**Versión:** 0.2
**Fecha:** 2026-09-12

## 1. Problema

Los anuncios Click to WhatsApp (CTWA) de Meta traen los leads, pero hoy nadie
puede responder cuánto costó un **pedido entregado** o una **línea activada**
por anuncio:

- Meta mide mensajes iniciados.
- El sistema mide pedidos DITO.
- GHL guarda el `ctwa_clid`, pero el sistema lo deja enterrado en un JSON
  (SPEC-052 §2).

Sin ese cruce se sigue pagando a los anuncios que traen conversación en vez
de a los que traen ventas.

## 2. Objetivo

Para cada campaña, conjunto y anuncio, ver en una tabla:

- gasto;
- conversaciones;
- leads calificados;
- pedidos ingresados, entregados y activados;
- costo de cada uno.

Desde el sistema también se pueden **crear, pausar y reanudar** campañas CTWA
simples, sin entrar al Administrador de anuncios para lo cotidiano.

## 3. Alcance

**Fase A — medir** (primero):

1. Conexión de la cuenta publicitaria.
2. Guardado del origen del anuncio en cada conversación (SPEC-053 BR-008).
3. Sincronización diaria de la estructura y el gasto desde Marketing API.
4. Embudo por anuncio y costo por etapa.
5. Reglas de ruteo por anuncio a un equipo (SPEC-054 BR-003).

**Fase B — operar:**

6. Crear una campaña CTWA guiada.
7. Pausar y reanudar campañas, conjuntos y anuncios.
8. Editar el presupuesto diario.

## 4. Reglas de negocio

### Medir

- **BR-001:** la cuenta publicitaria se conecta en la misma pantalla de
  integraciones (solo `ADMIN`), con token de usuario de sistema con
  `ads_read`. En la fase B se agrega `ads_management`.
- **BR-002:** la conversación guarda su anuncio de origen desde el `referral`
  del primer mensaje: `source_id` = identificador del anuncio y `ctwa_clid`.
  - Una conversación sin `referral` es **orgánica**.
  - Un anuncio en Estados de WhatsApp no trae `ctwa_clid`: se atribuye por
    `source_id` y se marca «sin identificador de clic» (lo usa SPEC-057).
- **BR-003:** la estructura (campaña → conjunto → anuncio, con nombre, estado,
  objetivo y presupuesto) y el **gasto diario por anuncio** se sincronizan
  desde Marketing API una vez al día a las 06:00 de Lima. Los últimos 7 días
  se vuelven a traer porque Meta los ajusta.
- **BR-004:** el embudo por anuncio cuenta **personas únicas**, no mensajes.
  Etapas:
  1. **Conversaciones:** personas que escribieron desde el anuncio.
  2. **Respondidas en 24 h:** respondidas dentro de la ventana, que conservan
     las 72 h gratis.
  3. **Oportunidades calificadas:** oportunidades con origen en el anuncio
     que llegaron a `CALIFICADO` o más (SPEC-061).
  4. **Ganadas**, y sus pedidos **ingresados**, **entregados** y
     **activados**, más los **cancelados**. Se cuentan en la cohorte del día
     de apertura de la oportunidad.
  5. **Perdidas**, por motivo.
  6. Cada etapa se abre por **relación con el cliente**: nuevo o existente
     (SPEC-061 BR-006). Así se ve cuánto del anuncio es recompra.
- **BR-005:** el pedido se atribuye al **anuncio que abrió su oportunidad**,
  según la regla única de SPEC-061 (BR-011 a BR-013).
  - Los anuncios vistos con la oportunidad ya abierta aparecen como
    «toques» en el tablero, pero no suman el pedido.
  - *Sustituye la regla v0.1 («30 días desde la primera conversación, gana
    el último anuncio»), que atribuía a la conversación y no a la intención
    de compra.*
- **BR-006:** los costos se calculan en la moneda de la cuenta publicitaria.
  - Si es USD, se muestra además en soles con el tipo de cambio del día
    guardado.
  - «Costo por activación» = gasto del período ÷ activaciones de la cohorte
    del período.
  - Una cohorte cuyos pedidos aún pueden activarse se marca «en maduración»
    durante 15 días.
- **BR-007:** el tablero enlaza cada cifra con sus conversaciones (SPEC-039) y
  permite comparar anuncios en el mismo período. Por defecto está ordenado por
  costo por pedido entregado.
- **BR-008:** **ruteo por anuncio.** Un supervisor o administrador puede
  asignar un anuncio o una campaña a un equipo. Sus conversaciones entran a la
  cola de ese equipo, y un anuncio sin regla usa la regla del número.

### Operar (fase B)

- **BR-009:** crear una campaña CTWA pide solo lo necesario, con valores por
  defecto para Perú:
  - nombre;
  - objetivo: por defecto «Ventas», o «Interacción» si aún no hay eventos de
    conversión;
  - número de WhatsApp;
  - presupuesto diario en la moneda de la cuenta;
  - fechas;
  - ubicación: Perú, con departamentos opcionales;
  - edad;
  - imagen o video;
  - texto principal, título y mensaje de bienvenida con hasta 3 preguntas
    frecuentes;
  - equipo destino.

  Todo lo demás (públicos avanzados, ubicaciones de anuncio, pruebas A/B) se
  hace en el Administrador de anuncios.
- **BR-010:** la campaña se crea **en pausa**. El sistema muestra la vista
  previa de Meta y el administrador la activa con un segundo paso que dice el
  gasto diario máximo.
- **BR-011:** pausar, reanudar o cambiar presupuesto queda registrado con
  autor y valor anterior. Solo `ADMIN` puede aumentar presupuesto; un
  `SUPERVISOR` puede pausar las campañas asignadas a sus equipos.
- **BR-012:** un cambio hecho en el Administrador de anuncios aparece en la
  siguiente sincronización. El sistema no sobreescribe lo que no creó.
- **BR-013:** el texto del anuncio y el nombre visible no pueden presentarse
  como Movistar (política de marca y revisión de Meta). El editor lo recuerda
  en la vista previa.

## 5. Decisiones abiertas, resueltas con recomendación

| Decisión | Recomendación | Por qué |
|---|---|---|
| ¿Medir primero u operar primero? | **Medir (fase A) antes que crear** | Crear anuncios duplica al Administrador de anuncios; lo que nadie da hoy es el costo por venta real |
| Regla de atribución del pedido | **La de SPEC-061: el anuncio que abrió la oportunidad**; los toques posteriores se muestran sin reatribuir | Una sola regla para todo el sistema; separa recompra de venta nueva y no reescribe la historia |
| Etapa principal del tablero | **Costo por pedido entregado** | Ingresado incluye cancelaciones; activado tarda en madurar. Entregado es la cifra estable más cercana al dinero |
| ¿Quién crea y activa? | **Solo ADMIN activa y sube presupuesto; SUPERVISOR pausa las suyas** | El gasto es de la empresa; pausar un anuncio malo no debe esperar |

## 6. Criterios de aceptación

- **AC-001:** conectar una cuenta publicitaria muestra sus campañas CTWA con
  gasto de los últimos 7 días, igual al del Administrador de anuncios (±1 %
  por redondeo).
- **AC-002:** una conversación desde un anuncio de prueba muestra el anuncio
  en la ficha y suma una conversación al embudo de ese anuncio.
- **AC-003:** un pedido ficticio vinculado a una oportunidad abierta por el
  anuncio suma al anuncio. Uno vinculado a una oportunidad orgánica no suma.
- **AC-004:** si la persona vio un segundo anuncio con la oportunidad abierta,
  el pedido suma al primero y el segundo aparece como toque.
- **AC-009:** el embudo del anuncio separa oportunidades de clientes nuevos y
  existentes, y cada cifra abre su lista.
- **AC-005:** cada cifra del tablero abre exactamente sus conversaciones.
- **AC-006:** una regla de ruteo manda las conversaciones del anuncio a la
  cola del equipo elegido.
- **AC-007 (fase B):** una campaña creada desde el sistema aparece en pausa en
  el Administrador de anuncios con los valores cargados. Activarla exige el
  segundo paso.
- **AC-008 (fase B):** un supervisor no puede aumentar presupuesto y sí puede
  pausar una campaña de su equipo; ambas acciones quedan registradas.

## 7. Fuera de alcance

- Anuncios que no son Click to WhatsApp (formularios, sitio web, Messenger,
  Instagram).
- Públicos personalizados desde la base de clientes. **Supuesto:** candidato
  posterior, con consentimiento y hash.
- Creativos generados con IA.
- Optimización automática de presupuesto por reglas.
