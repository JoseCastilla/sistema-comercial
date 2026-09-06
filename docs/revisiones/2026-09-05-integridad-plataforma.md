# Revisión de integridad de la plataforma — 05/09/2026

Estado de `main`: `802644a`, tras las entregas de SPEC-040 a SPEC-044. Revisión
de solo lectura sobre documentación (44 specs), código (`apps/web`,
`packages/validation`, `packages/ui`), datos (`packages/database`) e
infraestructura (`apps/api`, `apps/worker`, `apps/dito-extension`, Docker,
EasyPanel). Cada hallazgo se contrastó con el archivo y la línea antes de
anotarse.

## 1. En qué etapa está el negocio

**Distribuidor Online** es una agencia del canal de Movistar Perú (portabilidades
hacia Movistar; Claro, Entel y Bitel son siempre cedentes) que opera un call
center de ventas. El Sistema Comercial reemplaza hojas de cálculo en toda la
cadena: captura de la venta (extensión DITO e importación XLSX), bandeja de
pedidos con cierre y cancelación controlados, seguimiento de la entrega con el
operador logístico (AGR/Máximo), dos carriles de recupero (ventas caídas y
campañas sobre base nacional), escalamiento de incidencias, consultas por DNI,
personas y equipos con ciclo de vida, y un tablero de rendimiento con cuotas,
aceleradores y conciliación de comisiones.

**Etapa:** herramienta interna en producción con uso diario real, construida con
disciplina de producto (aislamiento por organización en los 40 modelos de
negocio, evidencia inmutable, reglas puras versionadas, specs por incremento).
La ambición de venderla a otros proveedores de Movistar existe en las notas de
trabajo, no en las specs: ninguna menciona un segundo cliente y SPEC-001 deja
«múltiples organizaciones» fuera de alcance. Es la decisión correcta para hoy
(«utilidad antes que generalidad»), pero marca el límite: el sistema es
multiempresa como frontera de seguridad, no como funcionalidad.

**Ritmo:** 238 commits en un mes, 74 solo el 05/09. La velocidad de entrega ha
superado a la de consolidación, y eso es lo que esta revisión encuentra: el
producto funciona, la documentación y la operación no lo han alcanzado.

## 2. Qué está bien y no hay que perder

- Multiempresa real: `organizationId` en todos los modelos de negocio y en
  cada `where` de las 37 acciones de servidor; cero relaciones sin `onDelete`.
- Trece tablas de evidencia sin ningún camino de mutación en el código.
- Idempotencia en las cuatro puertas de entrada (evento, código de pedido,
  hash de archivo, id de solicitud del cliente).
- Migraciones antes de aceptar tráfico, con healthcheck que hace efectiva la
  reversión; secretos comparados con `timingSafeEqual`; credencial AGR cifrada.
- Código limpio: cero `any`, cero `TODO`, cero `eslint-disable`, lint con
  `--max-warnings 0` en web y ui; 180 pruebas en web y 334 en validation.
- Lenguaje de la interfaz consistentemente en español y directo.

## 3. Hallazgos por gravedad

### 3.1 Operación: lo que puede perder datos o incumplir reglas en silencio

1. **No hay copias de seguridad.** Ni script, ni programación, ni política en
   `docs/specs/004-*`. EasyPanel conserva el contenedor anterior, no los datos.
2. **No hay proceso de fondo.** `apps/worker` son 21 líneas que registran
   «listo» y «detenido»; sin base de datos ni Dockerfile. Toda tarea periódica
   corre montada sobre el render de una página: la sincronización AGR de
   08:15/13:15/18:15 solo ocurre si alguien abre `/orders` después de la hora
   (`apps/web/src/app/orders/page.tsx`, `after()` con `.catch(() => undefined)`);
   el vencimiento de 7 días, la liberación de casos en espera y el retorno al
   pool corren al abrir `/admin/recovery-base` o `/recovery/campaigns`. Un día
   sin tráfico y la regla no se cumple, sin registro.
3. **Eventos de webhook fallidos que nadie reintenta ni diagnostica.**
   `claimForProcessing` admite reintentar desde `FAILED` pero nadie lo llama;
   `markFailed` no escribe `lastError` (columna siempre nula). Una venta que
   falla al proyectarse se pierde sin rastro.
4. **Tablas huérfanas con credenciales y teléfonos.** `mobile_debt_integrations`
   y `mobile_debt_lookup_events` existen en producción desde el 30/08 sin
   modelo Prisma, sin código y sin migración de borrado. El próximo
   `prisma migrate dev` propondrá eliminarlas.
5. **Diez restricciones `NOT VALID` nunca validadas** (`20260809200000`,
   `20260813120000`): el histórico anterior al 09/08 nunca se auditó; un
   restore no garantiza integridad.
6. **Login sin MFA y con el límite de intentos solo por defecto.** Better
   Auth sí limita en producción sin configurarlo (3 intentos de acceso cada
   10 s por IP), pero no estaba escrito ni decidido; sin `twoFactor`; cuentas
   ADMIN con acceso a datos RENIEC y credenciales AGR protegidas solo por
   contraseña de 12 caracteres y sesión de 12 h. *(Corregido el 06/09: el
   límite existía por defecto; SPEC-046 lo deja explícito.)*
7. **Script que borra órdenes contra la base que apunte `DATABASE_URL`**
   (`packages/database/scripts/test-orphan-claim-concurrency.mjs`), sin
   comprobar que no sea producción; por el `Cascade` arrastra el historial de
   asignación.
8. **Sin `.env.example`** y `turbo.json` desincronizado (`AUTH_BOOTSTRAP_TOKEN`
   declarado y sin uso; seis variables reales sin declarar). El incidente del
   01/09 (`DITO_IMPORT_API_URL` a `127.0.0.1`) es el fallo que esto habría
   evitado.
9. **Webhook de n8n sin autenticación de origen**: la extensión postea sin
   token; cualquiera con la URL puede inyectar ventas a nombre de un asesor. Se
   detecta después (conflicto instalación↔correo), no se previene.
10. Menores: contenedor de API como root y sin multi-stage; `proxy.ts` solo
    cubre `/orders`; volcado `prod_para_local.sql` (19 MB, con datos
    personales) en el árbol de trabajo.

### 3.2 Documentación: la trazabilidad que José usa como base del producto

11. **Dos campos «Estado» que divergen y nueve specs sin estado** (020–027,
    031). Vocabulario abierto: `APPROVED`, `VERIFIED`, `IMPLEMENTED`,
    `IMPLEMENTED_LOCAL`, `READY_FOR_VALIDATION`, `IN_PROGRESS`, `DRAFT`… más
    texto libre desde la 040.
12. **Estados falsos.** SPEC-030 sigue `DRAFT` con 151 tareas hechas y lecturas
    de producción; SPEC-015, 018, 019, 032, 033, 036, 038 y 041 declaran menos
    de lo que ya está en producción.
13. **Visibilidad de importes del supervisor en tres redacciones muertas.**
    SPEC-014 BR-011, SPEC-034 BR-006/AC-005 y SPEC-038 BR-016 dicen que el
    supervisor no ve el importe individual; SPEC-014 BR-019 (31/08) y el código
    dicen que sí. Es la única contradicción que afecta datos de pago.
14. **Semana comercial contradictoria:** SPEC-005 (nunca cruza de mes) frente a
    SPEC-022 (sí cruza). Pedidos y Rendimiento cuentan poblaciones distintas
    los primeros días de cada mes.
15. Otras reglas pisadas: SPEC-010 BR-003 no contempla al supervisor vendedor;
    SPEC-011 BR-005 sustituida por SPEC-041 sin anotarlo; cuatro definiciones
    de «por recuperar» (016/027/030/044); SPEC-030 AC-021 exige revelación por
    pasos que BR-045/046 retiraron; SPEC-039 BR-003 contra BR-005.
16. Reglas repetidas con redacción propia en varias specs (alcance por rol en
    nueve, cohortes Lima en diez, glosario del embudo en cuatro, cadencia de
    recupero en tres). Fuentes únicas propuestas: SPEC-001 §10 (permisos),
    SPEC-005 (glosario temporal), SPEC-014 § Glosario (embudo), SPEC-026
    (recupero), SPEC-033 (economía y visibilidad), SPEC-039 (patrones de
    interacción).
17. SPEC-037 (residuos) sin plan ni verificación; SPEC-039 (lenguaje visual)
    solo con `spec.md` aunque ya se aplica desde otras specs.

### 3.3 Código: coherencia y protección

18. **Cuatro barras de filtro que implementan la misma máquina**
    (`DirectoryFilters`, `QueueFilters`, `CampaignInboxFilters`,
    `OrderScopeFilters`; umbral de búsqueda 2 en una y 3 en otra) y dos
    pantallas que siguen con `<Form>` + «Aplicar»: `/performance/quotas` y
    `/performance/reconciliation`, hermanas de un `/performance` que ya filtra
    en vivo. `/orders` conserva además dos formularios con inputs ocultos.
19. **Parámetros de URL en dos idiomas** para el mismo dominio: `status/team/
    reason` en unas rutas, `estado/equipo/motivo/prioridad/vence` en otras;
    `/recovery/follow-up` en inglés y `/recovery/sales` en español.
20. **Helpers duplicados:** 25 `Intl.DateTimeFormat` locales (`@repo/ui/format`
    solo cubre números); `readText` idéntico en 8 archivos; `firstValue` en 6
    páginas con dos firmas; `toMetricInput` dos veces; `readApiError` dos veces.
21. **Regex de UUID divergente:** `register-recovery-attempt-action.ts:80`
    acepta versiones 1–5 y `assign-agent-alias-action.ts:19` acepta 1–8. Si el
    cliente genera UUID v7, `clientRequestId` cae a `null` y la idempotencia
    de intentos (BR-090) deja de funcionar.
22. **36 exportaciones muertas en `packages/validation`**, incluido
    `domain-schemas.ts` completo y tres reglas con 51 casos de prueba que
    ningún camino de la app ejecuta (`resolveCommercialContextAccess`,
    `canReassignDitoOrder`, `canResolveAutomaticDitoAssignment`).
23. **Archivos «dios»:** `performance-dashboard.tsx` 1 785 líneas y 22
    componentes que reciben `data` completo; `order-inbox.tsx` 1 663;
    `get-order-inbox.ts` 1 679 mezclando presentación, SLA, orden y `where`;
    páginas de 800 líneas en `/recovery/board` y `/admin/recovery-base`.
24. **Pruebas:** 27 de 37 acciones de servidor sin prueba (entre ellas
    `update-order-status-action`, `distribute-recovery-cases-action`, las 7 de
    importación DITO y las 2 de AGR); las acciones se mockean en las pruebas de
    componentes, así que la matriz de alcance AGENT/SUPERVISOR/ADMIN no tiene
    ninguna prueba de integración; los cuatro esquemas de ingesta externa
    (`ghl-snapshot`, `webhook-envelope`, `dito-order`, `dito-order-correction`)
    no tienen prueba.
25. **Alcance:** sólido en páginas y acciones (todas verifican organización y
    rol en servidor). Una excepción: el SSE de `/api/orders/stream` emite
    `orderId` y operación de toda la organización a cualquier rol, incluido un
    asesor que solo debería ver lo suyo.
26. **Rendimiento:** `recovery/board/page.tsx` (7 `findMany` sin `take`, entre
    ellos todos los intentos del período), `get-performance-dashboard.ts`
    (todas las órdenes de dos meses en memoria), la descarga de
    `recovery-base/numbers` sin techo cuando `take = 0`; un N+1 real en
    `assign-shared-dito-import-rows-action.ts` (una consulta por fila dentro de
    la transacción).
27. **Accesibilidad:** 13 tablas sin `scope`, 4 `select` de distribución y
    triaje sin etiqueta accesible, definiciones que solo viven en `title`
    (cohorte de cuota, filtros de gestión, enlaces con solo una cifra en el
    tablero de recupero). `performance-dashboard.tsx` muestra que el equipo
    sabe hacerlo; falta propagarlo.
28. **Ruta `/team` sin `layout.tsx`:** el supervisor pierde la navegación
    lateral al entrar a «Mi equipo».

## 4. Decisiones de negocio abiertas que bloquean módulos

- **Liquidación mensual** (`DRAFT → REVIEWED → APPROVED → LOCKED`) y su **fecha
  de corte**, abiertas desde el 09/08 (SPEC-014); bloquean a SPEC-033 y 038 y
  son el único paso que falta para pagar desde el sistema.
- **Credencial AGR en producción** (`AGR_DELIVERY_ENCRYPTION_KEY` y cookie):
  SPEC-029 lleva semanas «lista para validar» por un acto operativo.
- **Dos equipos sin supervisor** (AYACUCHO - MAGISTERIAL 01 y EXTERNOS): el
  tablero lo señala desde hoy; nadie reparte su cuota ni sigue su recupero.
- **Política de vigencia de la instantánea RENIEC** (SPEC-031) y **unificar
  Consultas** (SPEC-036) siguen sin decisión.
- **Supervisor multiequipo**: la única validación por rol que falta.

## 5. Oportunidades, en orden de retorno

1. **Un proceso de fondo real** (`apps/worker` con Prisma y cron): AGR a sus
   horas, vencimientos y retornos al pool, reintento de webhooks fallidos con
   `lastError`. Convierte promesas de las specs en garantías. Es la deuda que
   más reglas de negocio tiene colgando.
2. **Copias de seguridad programadas y ensayadas** (pg_dump diario, retención,
   un restore probado) y validar las diez restricciones pendientes. Antes que
   cualquier funcionalidad nueva.
3. **Endurecer el acceso**: límite de intentos en login, MFA para ADMIN y
   BACKOFFICE, `proxy.ts` cubriendo todas las rutas autenticadas, filtro por
   rol en el SSE, token en el webhook de n8n.
4. **Higiene documental en una sola pasada** (encaja en SPEC-037): un campo de
   estado con vocabulario cerrado, sincronizar `spec.md` y `verification.md`,
   corregir las tres redacciones muertas de importes, resolver la semana
   comercial, reetiquetar y partir SPEC-030, dotar de plan/tasks a 037 y 039.
5. **Una sola barra de filtros** (`DirectoryFilters` extendida o un núcleo
   compartido) y un solo idioma en los parámetros de URL; llevarla a Cuotas y
   Conciliación y retirar los formularios ocultos de Pedidos.
6. **Módulo compartido de lectura de formularios y fechas** (`readText`,
   `readUuid` único con versiones 1–8, `firstValue`, formateadores Lima en
   `@repo/ui/format`) y borrar las 36 exportaciones muertas.
7. **Pruebas de alcance por rol sobre acciones reales** (una base de prueba
   con AGENT, SUPERVISOR, supervisor vendedor, BACKOFFICE y ADMIN ficticios) y
   pruebas de contrato para los cuatro esquemas de ingesta. Las cuentas de
   prueba desbloquean además las validaciones visuales pendientes en ocho
   specs.
8. **Techos de consulta** (`take`) en el tablero de recupero, el tablero de
   rendimiento y la descarga de números; partir los cuatro archivos «dios»
   por responsabilidad, empezando por `get-order-inbox.ts`.
9. **Accesibilidad de tablas y selectores** en una pasada mecánica.
10. **Cerrar la liquidación mensual**: es la última pieza para que el sistema
    pague, y la decisión pendiente es de negocio, no de código.

## 6. Correcciones a los informes de origen

- El lint de `apps/web` sí está protegido: `eslint --max-warnings 0` en
  `apps/web/package.json`, así que el plugin `only-warn` no anula nada.
- Las «cuatro barras de filtro» comparten mecánica pero no todas comparten
  contrato de parámetros; unificarlas exige primero decidir el idioma de la
  URL (hallazgo 19).
