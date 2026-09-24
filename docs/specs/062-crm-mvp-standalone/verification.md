# Verificación — SPEC-062

## Base — 12/09/2026

- [x] **AC-001:** con `crm_local` vacía, `/` redirige a `/setup`; crear
      «Empresa de prueba» + dueño de prueba deja 1 organización y 1
      membresía `OWNER`; `/setup` redirige a `/login` después. Registro
      público de Better Auth apagado: la creación usa una instancia interna.
- [x] `/settings/users` lista al dueño y ofrece crear cuentas de los cuatro
      roles (verificado en pantalla).
- [x] `tsc --noEmit`, `eslint --max-warnings 0` y `vitest run` (7 pruebas:
      ventanas y plantillas) en verde.

## Pendiente por módulo

Se completa con los informes de cada módulo y el recorrido final.

## Ola 1 — 12/09/2026 (recorrido con datos ficticios, base reiniciada después)

- [x] **AC-016 (parcial):** tras la ola 1, `tsc --noEmit`, `eslint --max-warnings 0`
      (toda la app) y `vitest run` (19 archivos, 179 pruebas) en verde.
- [x] **AC-005:** `GET /api/webhooks/meta` con el verify token devuelve el
      challenge (200) y 403 con token equivocado; `POST` sin `META_APP_SECRET`
      responde 503; con secreto de prueba y firma HMAC válida, un mismo wamid
      reenviado se guarda una sola vez (`stored: 0` la segunda vez).
- [x] **AC-006:** un mensaje firmado desde un número ficticio (fila insertada
      a mano en `whatsapp_numbers`) creó contacto (BSUID `user_id` + teléfono),
      conversación con `referral` del anuncio (`free_until` a 72 h), dos
      mensajes `RECEIVED` y una oportunidad `NUEVO · AD · NEW`. La bandeja
      mostró la conversación en «Sin tomar» y «Requiere asesor», con ventana
      («Puedes escribirle libremente hasta… · Gratis por anuncio hasta…»),
      ficha con el anuncio (titular, texto, enlace) y oportunidad abierta.
- [x] **AC-007 (parcial):** responder desde el compositor encoló el mensaje,
      asignó la conversación al dueño, la pasó a `CONTROL_HUMANO` y marcó la
      primera respuesta. El bucle de envío lo dejó `FAILED` con «Secreto
      cifrado con formato inválido» (token ficticio): el error se muestra en
      lenguaje directo y no tumba el bucle. El envío real queda pendiente de
      credenciales.
- [x] **AC-013:** flujo prearmado «Recibir lead de anuncio y asignar» creado y
      activado desde la pantalla; con un segundo lead ficticio de anuncio la
      ejecución quedó `DONE` con log: repartida al asesor disponible con menos
      carga → sin asistente en el número: requiere asesor → fin. La
      conversación quedó asignada y en `REQUIERE_ASESOR`.
- [x] Pantallas de embudo, pedidos, calendario, plantillas, resultados y
      `/settings/whatsapp` cargan con estados vacíos útiles; `/api/health`
      muestra los cuatro bucles corriendo sin error; SSE sin sesión → 401.
- Pendiente de credenciales reales: envío a Meta, descarga de adjuntos,
  sincronización y creación de plantillas, Embedded Signup.

## Ola 2 y cierre — 13/09/2026

- [x] **AC-016:** `tsc --noEmit`, `eslint --max-warnings 0` (toda la app) y
      `vitest run` (23 archivos, 256 pruebas) en verde. ~25.800 líneas en
      `apps/crm/src`.
- [x] `/agents` y `/broadcasts` cargan con estados vacíos que explican qué
      falta (sin clave de Anthropic; sin plantilla aprobada).
- [x] Datos ficticios de la prueba (empresa, dueño, número, contacto,
      conversación, flujo) borrados de la base; el secreto de
      prueba de Meta retirado de `.env`. La app vuelve a `/setup`.
- Sin verificar por falta de credenciales: AC-003, AC-004, AC-012 (Meta),
  AC-011 (agente en vivo), AC-014 (difusión real), AC-015 (cita creada por el
  agente). La lógica de cada uno tiene pruebas unitarias.

- **24/09/2026** — Antes de versionarlo en git (decisión de José, opción 1 de
  la auditoría integral):
  - Revisados los archivos que entran: `.env`, `storage/`, `.next` y el
    cliente generado siguen ignorados; `.env.example` sin valores reales; ni
    claves, ni tokens, ni teléfonos o correos reales en el código.
  - **A3 corregido:** `db:reset`, `db:migrate:dev` y `db:migrate:deploy`
    pasan por `scripts/guard-crm-database.mjs`, que resuelve DATABASE_URL
    igual que Prisma y se niega si la base no se llama `crm_…`. Probado:
    rechaza `sistema_comercial` (salida 1) y acepta `crm_local`.
  - **M12 corregido:** `/api/media` ya no toma el tipo de la URL; comprueba
    que el usuario sea de la organización del adjunto y que el adjunto
    exista en un mensaje; solo imagen, audio y video se muestran en línea,
    lo demás se descarga, siempre con `nosniff` y CSP `sandbox`
    (`media-headers.test.ts`, 4 pruebas).
  - CRM: tipos, lint y 260 pruebas en verde. `pnpm install
    --frozen-lockfile` coherente con el lockfile que incluye el CRM.
