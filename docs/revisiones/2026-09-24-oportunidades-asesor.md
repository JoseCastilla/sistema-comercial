# Oportunidades: que el asesor quiera vivir en el Sistema Comercial — 24/09/2026

Complemento de `2026-09-24-auditoria-integral.md`. Aquella lista defectos; esta
propone cambios de **enfoque, herramienta o framework** que hacen mejor la
experiencia desde la raíz. El criterio que la ordena es el de José: *el sistema
debe ser el lugar donde el asesor quiera convivir, y debe hacerlo productivo.*

## 1. Diagnóstico: un sistema de registro, no un lugar de trabajo

El sistema nació para **controlar y medir** la venta, y se nota:

- **El asesor tiene cinco módulos organizados por tipo de dato** (Rendimiento,
  Pedidos, DNI, Recupero, Campañas), no por su tarea. Para saber qué le toca
  hoy tiene que revisar su cola y su agenda en Campañas, sus casos en Recupero,
  las entregas fallidas en Pedidos y su avance en Rendimiento. Cuatro lugares
  para una sola pregunta: «¿qué hago ahora?».
- **Entra a Pedidos** (`app/page.tsx:8`), una bandeja de supervisión con 9
  pestañas cuyo título dice «Revisa incidencias, recupera pedidos y actualiza
  el avance comercial».
- **Su día real transcurre fuera:** conversa con el lead en GoHighLevel, vende
  en el portal DITO de Movistar, llama desde el teléfono y consulta líneas en
  OSIPTEL. El sistema recibe el resultado después, y el asesor lo alimenta a
  mano: tipifica cada intento y pulsa la extensión en cada venta.
- **Lo que más le importa —cuánto va ganando— está en el tablero del
  supervisor**, entre tarjetas con párrafos de cuatro cifras.
- **La interfaz está hecha a mano sin librerías de componentes**: 4 580 líneas
  de CSS propio (`patterns.css` 2 846) y 18 componentes en `@repo/ui`. Es
  disciplinado, pero cada necesidad nueva (tabla, filtro, diálogo, ayuda
  emergente, selector con búsqueda) se reinventa. De ahí salen las 7 barras de
  filtro, los 3 tipos de botón, las 5 formas de avisar, las tablas de `div` y
  las definiciones escondidas en `title`. Los parches no lo cierran: vuelve a
  aparecer con la siguiente pantalla.

**Principio rector propuesto:** *el asesor abre el sistema al llegar y no
necesita salir hasta irse.* Cada oportunidad se mide contra eso.

## 2. Oportunidades de enfoque de producto (las que cambian el día del asesor)

### 2.1 «Mi día»: una sola bandeja de trabajo, ordenada por lo que vence

Reemplaza los cinco módulos como puerta de entrada del asesor. Una lista que
responde «qué hago ahora» mezclando todas las fuentes que ya existen:

- citas acordadas que vencen (SPEC-048),
- casos de recupero a su cargo con plazo (SPEC-030 fase 5),
- entregas fallidas e incidencias de **sus** ventas (Pedidos),
- su cola de Campañas, solo cuando no hay nada más urgente.

Cada elemento trae **una acción principal** (llamar, agendar, tipificar,
reagendar la entrega) y se resuelve sin cambiar de pantalla. Arriba, una
franja: «Hoy: 3 ventas · 12 gestiones · te faltan 2 para el acelerador».

Es el patrón de las bandejas que la gente elige usar (Linear, Superhuman, el
«Today» de Salesforce): una lista que se vacía. Los datos y las reglas ya
existen; falta el lugar que los reúne. **Retorno: el más alto de este
documento**, porque convierte cuatro visitas en una y hace visible el progreso.

### 2.2 Ficha única del cliente

Hoy el mismo cliente vive en cuatro sitios sin unir: `DitoOrder`,
`RecoveryCase` con sus teléfonos, `DniPersonSnapshot` y `Contact` de GHL
(SPEC-052 §2 lo reconoce). Una ficha por DNI o teléfono que muestre en una
línea de tiempo sus pedidos y su estado de entrega, sus líneas, sus intentos y
citas, la consulta RENIEC y, más adelante, la conversación. **Todo camino
lleva a ella:** una búsqueda, una fila de la cola, una notificación.

Es también la base que el programa CRM necesita (la identidad común de
SPEC-052), así que no es trabajo extra: es el primer paso de ese programa.

### 2.3 Buscador universal con `Ctrl + K`

Un cliente llama y el asesor tiene dos segundos para ubicarlo. Una paleta de
comandos (librería `cmdk`) accesible desde cualquier pantalla:

- escribe un teléfono, DNI o código de pedido y va a la ficha;
- escribe «agendar», «consultar DNI» o «nueva gestión» y lo hace.

Sustituye la búsqueda que hoy hay dentro de cada filtro, cada una con su
mínimo de caracteres distinto.

### 2.4 Registrar sin teclear: la llamada crea el intento

La tipificación manual es la tarea más repetida y la que menos valor agrega.
SPEC-035 (voz propia sobre troncal SIP) ya imagina la superficie omnicanal. El
paso intermedio, sin esperar la troncal propia, es **llamar con un clic desde
la fila** a través de un proveedor con API (softphone WebRTC). La llamada
registra sola el intento con su hora y su duración, y el asesor solo elige el
resultado. Eso quita trabajo, y además hace verdaderos los indicadores de
contacto que hoy dependen de que el asesor recuerde tipificar.

Con el mismo espíritu, la extensión DITO puede invertirse: además de
*extraer* la venta del portal, *prellenar* el portal con los datos que el
sistema ya tiene (DNI consultado, dirección, plan). Hay que confirmarlo
contra las condiciones de uso del portal de Movistar antes de construirlo.

### 2.5 El progreso y la comisión, a la vista y en vivo

El asesor cobra por comisión: «cuánto llevo ganado» es el motivo más fuerte
para abrir el sistema. La política ya está centralizada (SPEC-033: cuotas,
aceleradores, pagables). Propuesta:

- una franja fija en «Mi día» con la meta, lo logrado y el siguiente tramo;
- un aviso cuando una venta suya pasa a entregada o a pagable («+S/ 45»);
- una vista personal simple (mis ventas del mes, su estado y cuánto vale cada
  una), en lugar del tablero del supervisor recortado.

Es la decisión de producto más sensible (ver §6), pero también la que más
cambia la relación del asesor con el sistema.

### 2.6 Avisos que respetan el foco

Hoy hay un aviso flotante permanente que dice 316 y tapa la cabecera. Un aviso
que siempre muestra cientos deja de leerse. Propuesta:

- centro de notificaciones con lo **nuevo y propio** (la cita en 10 minutos,
  la entrega que falló, el caso que te asignaron);
- **notificación del navegador** (PWA con Web Push) para la cita que vence
  aunque el asesor esté en otra pestaña (en DITO o en GHL). Es el puente
  mientras el trabajo siga repartido;
- el acumulado es un indicador del supervisor, no una alarma del asesor.

### 2.7 La conversación dentro, no en otra aplicación

El programa CRM (SPEC-052 a 062) es la pieza que cierra el «no salir». Pero el
MVP se construyó como aplicación y base separadas (`apps/crm`, `crm_local`).
Para el asesor eso sería **una pestaña más**, es decir, lo contrario de este
principio. La recomendación es que la bandeja de conversaciones sea una
sección de «Mi día» y de la ficha del cliente, sobre la misma identidad y
sesión. El MVP separado sirve como laboratorio de la integración con Meta, no
como destino.

## 3. Oportunidades de herramienta y framework (cómo construirlo sin reinventar)

La pila actual (Next.js 16, React 19, Tailwind 4, tokens `--ui-*`, zod 4 en
`@repo/validation`) es moderna y se conserva. Lo que falta son **piezas
probadas para lo que hoy se hace a mano**. Recomendación por necesidad:

| Necesidad | Hoy | Recomendación | Por qué esta |
|---|---|---|---|
| Diálogos, menús, pestañas, ayudas emergentes, selector con búsqueda, panel lateral | A mano; `window.confirm`; definiciones en `title`; `select` nativo con 14+ asesores | **shadcn/ui sobre Radix** | El código se copia al repo y es propio (encaja con la disciplina actual); usa Tailwind 4 y variables CSS, así que se mapea a los tokens `--ui-*` sin cambiar el aspecto; accesibilidad y teclado resueltos |
| Tablas de trabajo (cola, pedidos, tableros) | `div` sin semántica, columnas fijas a mano, paginación de 50 | **TanStack Table + TanStack Virtual** | Sin estilos propios (usa los tokens); columnas fijas, visibles y con densidad elegidas por usuario; navegación por teclado entre filas; miles de filas sin paginar |
| Filtros y estado en la URL | 4 barras + 3 formularios, dos idiomas | **nuqs** | Parámetros tipados con un solo parser por pantalla y demora incluida; un hook `useFilters` sobre nuqs reemplaza las siete implementaciones y obliga a decidir un idioma |
| Avisos tras guardar | 5 mecanismos | **Sonner** (viene con shadcn) | Uno solo, apilable, accesible |
| Búsqueda y comandos | Búsqueda dentro de cada filtro | **cmdk** (el `Command` de shadcn) | §2.3 |
| Gráficos de rendimiento | Barras de CSS a mano | **Charts de shadcn (Recharts)** | Ayuda emergente con el dato exacto, leyendas y accesibilidad, con los mismos tokens |
| Formularios de servidor | Lectura manual de `FormData`, validación solo en servidor | **Conform + zod** | Hecho para server actions: los mismos esquemas de `@repo/validation` validan en el cliente mientras se escribe y en el servidor al guardar |
| Guardar y seguir sin esperar | Espera la respuesta del servidor | **`useOptimistic` de React 19** | «Guardar y siguiente» pasa al siguiente caso al instante y revierte si el servidor rechaza |
| Tableros pesados | Una página de 2 422 líneas que carga todo junto | **Suspense por panel** | Cada panel aparece cuando está listo; el asesor ve su franja primero |
| Atajos de teclado | Sueltos en el editor de Campañas | **Un mapa de atajos global con ayuda en `?`** | Quien trabaja 8 horas en una cola trabaja con el teclado |

**Cómo adoptarlo sin reescribir:** instalar shadcn con los tokens actuales
como variables de su tema, y migrar **pantalla por pantalla, empezando por
las que construye «Mi día»**. Cada pantalla migrada borra su CSS propio de
`patterns.css`. Nada se reescribe de golpe.

## 4. Oportunidades de proceso: saber qué mejorar en lugar de suponerlo

- **Medir el uso real.** Hoy no se sabe qué pantallas usa el asesor, cuánto
  tarda en tipificar ni dónde abandona. **PostHog** (grabación de sesiones con
  todo el texto y los campos enmascarados por defecto, embudos, uso por
  función) responde eso con datos. Por los DNI y teléfonos, el enmascarado
  total es obligatorio.
- **Errores del navegador.** **GlitchTip**, compatible con Sentry y ligero,
  instalado en el mismo VPS con EasyPanel: cada error de pantalla llega con
  usuario, ruta y versión. Cubre además el hallazgo M6 de la auditoría.
- **Que un cambio visual no rompa otra pantalla.** Pruebas de captura con
  **Playwright** en 1 316 × 760, 1 920 × 1 080 y 375 × 812, en claro y oscuro,
  para las pantallas del asesor. Habrían detectado el menú montado y
  «Setiembre De 2026» antes de producción. Se suma **axe** para la
  accesibilidad y `eslint-plugin-jsx-a11y` en el lint.
- **El asesor como co-diseñador.** Un botón «Algo no funciona / tengo una
  idea» que adjunta captura y ruta, y una hora a la semana sentado junto a un
  asesor, cronometrando tareas. Las decisiones de interfaz salen de ahí.

## 5. Cómo sabremos que funciona

- Tiempo desde iniciar sesión hasta la primera gestión.
- Clics y segundos por tipificación (antes y después de §2.4).
- Porcentaje de intentos registrados en el mismo minuto de la llamada.
- Tiempo con el sistema en primer plano frente a GHL y DITO.
- Ventas y gestiones por hora de asesor.
- Una pregunta mensual al asesor: «¿qué te haría trabajar más cómodo?».

## 6. Hoja de ruta propuesta

1. **Base (1 semana):** PostHog enmascarado, GlitchTip en el VPS, pruebas de
   captura con Playwright, shadcn instalado sobre los tokens. Sin pantallas
   nuevas: primero ver.
2. **«Mi día» v1 (2–3 semanas):** bandeja unificada, franja de progreso,
   `Ctrl + K`, ficha del cliente de solo lectura, y el asesor entra ahí.
   Construida ya con shadcn, TanStack Table y nuqs: es la primera pantalla del
   nuevo enfoque y el modelo de las siguientes.
3. **Migración de superficies (continuo):** Mi cola, Pedidos y Rendimiento a
   las mismas piezas, borrando CSS propio en cada paso.
4. **Registrar sin teclear:** llamada con un clic y registro automático del
   intento; avisos del navegador.
5. **Conversación dentro:** la bandeja de WhatsApp como sección de «Mi día» y
   de la ficha, reutilizando lo aprendido en el MVP de `apps/crm`.

## 7. Decisiones de José (24/09/2026)

- **Comisión:** el asesor ve el monto y entiende cómo se calcula. «Mi día»
  muestra lo ganado y el desglose de cada venta según la política de SPEC-033.
- **Conversación:** dentro del sistema, pero al final de la hoja de ruta: aún
  no somos Tech Provider de Meta.
- **Llamadas:** no habrá proveedor intermedio. Se construirá más adelante el
  softphone WebRTC sobre la troncal SIP propia (SPEC-035); §2.4 espera a eso.
- **Medición del uso:** pendiente, tras explicar qué mide cada herramienta
  (uso de la plataforma, llamadas y WhatsApp se miden por caminos distintos).
- **Siguiente paso:** empezar por «Mi día» (§2.1).
