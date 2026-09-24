# SPEC-062 — CRM MVP aislado (`apps/crm`)

**Estado:** `EN_CURSO` — MVP versionado en git como laboratorio el 24/09/2026, no desplegado (EasyPanel solo construye api y web); pendiente el setup real de José con número y clave de Meta (24/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-12

> Versión local y aislada del CRM descrito en SPEC-052 a SPEC-061. Vive en
> `apps/crm` con su propia base de datos (`crm_local`) y no toca `apps/web`,
> `apps/api` ni `packages/database`. Cuando funcione, se acopla al Sistema
> Comercial (pedidos DITO, equipos, agenda) en una spec posterior.

## 1. Qué pidió José

Un MVP, **sin inventar datos**, que cubra lo que hoy usa en GoHighLevel:

1. Cuentas: dueño del negocio, supervisores, asesores y back office.
2. Conexión de WhatsApp con las integraciones de Meta, demostrando que
   podemos actuar como proveedor tecnológico.
3. Campañas de Meta hacia WhatsApp (los leads llegan a la plataforma).
4. Flujos de trabajo a medida: recibir leads, asignarlos, etc.
5. Bandeja donde los asesores conversan con los leads.
6. Tablero Kanban con el embudo de venta.
7. Agente de IA entrenado con información del negocio, que califica o agenda;
   con distintos modelos disponibles.
8. El asesor puede interrumpir al agente.
9. Plantillas para continuar después de la ventana de 24 h.
10. Pedidos asociados al chat para separar ventas de campaña y de base.
11. Difusión masiva.
12. Calendarios.

## 2. Decisiones del MVP (con recomendación, avanzadas)

| # | Decisión | Qué se hizo | Por qué |
|---|---|---|---|
| M-01 | Dónde vive | `apps/crm`, Next.js 16 con acciones de servidor y rutas API; base de datos propia | Mismo stack que `apps/web`, aislamiento real, acople barato |
| M-02 | Sin datos inventados | No hay semillas. La primera ejecución abre `/setup` para crear la empresa y al dueño. Todo lo demás nace de la operación o de la conexión con Meta | Pedido explícito |
| M-03 | Procesos de fondo | Bucles en el mismo proceso de Next (`instrumentation.ts`): envío, flujos, difusiones, plazos | Un solo proceso en local; al acoplar pasan al worker |
| M-04 | Tiempo real | Emisor de eventos en proceso + SSE | Un solo proceso; al acoplar, `LISTEN/NOTIFY` como en pedidos |
| M-05 | Archivos | Carpeta local `storage/` servida con sesión | Sin S3 en local |
| M-06 | Pedidos | Entidad mínima `Order` registrada a mano (número, DNI, plan, cargo fijo, estado) y vinculada a la oportunidad | En el acople la reemplaza `DitoOrder` |
| M-07 | Proveedor tecnológico | Embedded Signup v4 (SDK de Facebook + canje de código en el servidor + suscripción de webhooks + registro del número) **y** conexión manual con identificadores y token | Demostrar el flujo de Tech Provider sin bloquear el uso propio |
| M-08 | Modelos de IA | Interfaz de proveedor con Anthropic (Claude) implementado; el modelo se elige por agente desde la lista real de la API | Un proveedor validado; la interfaz deja entrar otros |
| M-09 | Flujos | Editor de pasos en lista (disparador + pasos + ramas «respondió / no respondió») sobre catálogo cerrado; sin lienzo | Cubre «recibir, asignar, atender» en el MVP |
| M-10 | Roles | `OWNER`, `SUPERVISOR`, `AGENT`, `BACKOFFICE`; sin equipos en el MVP (el supervisor ve toda la organización) | Equipos llegan con el acople a `CommercialTeam` |

Las reglas de negocio son las de SPEC-053 a SPEC-061; esta spec no las
repite. Donde el MVP recorta, lo dice en §4.

## 3. Criterios de aceptación

- **AC-001:** con la base vacía, la app abre `/setup`; crear empresa y dueño
  deja una sola organización y una sola membresía `OWNER`. `/setup` deja de
  existir después.
- **AC-002:** el dueño crea usuarios de los cuatro roles con contraseña
  inicial; un asesor no puede entrar a administración.
- **AC-003:** conectar WhatsApp a mano con token inválido no guarda nada y
  explica el error; con datos válidos muestra nombre, calidad y límite.
- **AC-004:** la página de Embedded Signup carga el SDK con `META_APP_ID` y
  `META_CONFIG_ID`, y el canje de código en el servidor guarda el número.
- **AC-005:** `GET /api/webhooks/meta` responde al reto de verificación;
  `POST` con firma inválida devuelve 401 y no guarda; con firma válida guarda
  una sola vez aunque se reenvíe.
- **AC-006:** un mensaje entrante crea contacto, conversación y mensaje, y
  aparece en la bandeja sin recargar.
- **AC-007:** responder desde la bandeja encola el envío; el estado del mensaje
  avanza con los webhooks de estado.
- **AC-008:** con la ventana de 24 h cerrada, la bandeja solo permite plantillas.
- **AC-009:** el tablero muestra la oportunidad abierta por el primer mensaje;
  arrastrarla cambia la etapa; `GANADA` solo se alcanza vinculando un pedido.
- **AC-010:** registrar un pedido con el DNI del contacto lo vincula y el
  reporte separa ventas de campaña (origen anuncio) y de base.
- **AC-011:** un agente publicado responde en el simulador y en una
  conversación en `IA_ACTIVA`; «Tomar control» lo detiene y cancela lo pendiente.
- **AC-012:** una plantilla creada desde la app se envía a Meta y su estado
  cambia por webhook; la lista se sincroniza con la WABA.
- **AC-013:** un flujo «lead nuevo → asignar → atender con agente» se ejecuta
  al llegar un mensaje y deja su registro paso a paso.
- **AC-014:** una difusión sobre un segmento excluye a quien no tiene
  consentimiento de marketing y muestra sus resultados.
- **AC-015:** una cita creada por el agente aparece en el calendario del asesor
  en una franja con cupo.
- **AC-016:** tipos, lint y pruebas de `apps/crm` en verde.

## 4. Fuera del MVP

- Equipos, permisos por equipo y reparto por especialidad.
- Coexistencia con la app WhatsApp Business.
- Eventos de conversión a Meta (SPEC-057) y lectura de gasto publicitario
  (SPEC-056 fase A): quedan para después del piloto.
- Lienzo visual de flujos.
- Multiempresa comercial (planes, cuotas, alta autónoma).
- Ingreso de pedidos en DITO desde la plataforma.
