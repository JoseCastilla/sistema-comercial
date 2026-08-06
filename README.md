# Sistema Comercial Omnicanal

Plataforma comercial multiempresa para centralizar la ingesta, supervisión y
auditoría de leads de GHL y órdenes de DITO. El MVP reemplaza progresivamente
Google Sheets/Excel como almacenamiento operativo, sin escribir todavía de
regreso a GHL.

## Estado actual

- Ingesta idempotente de contactos y oportunidades desde GHL.
- Ingesta idempotente de órdenes DITO y detección de reenvíos modificados.
- Autenticación web, organizaciones, roles y autorización server-side.
- Bandeja `/orders` con seguimiento manual e historial de estados.
- Administración de usuarios y vínculos de alias DITO.
- SPEC-001 aprobada para equipos comerciales, visibilidad y reasignación.
- Esquema y migración de persistencia de SPEC-001 preparados; aplicación local
  y servicios de negocio todavía pendientes.

El contexto funcional consolidado se mantiene fuera del repositorio en
`PLATAFORMA_COMERCIAL_CONTEXTO_MAESTRO_V20.md`. Las decisiones ejecutables y su
trazabilidad viven en [`docs/specs`](docs/specs).

## Arquitectura

Monorepo TypeScript administrado con pnpm y Turborepo:

```text
apps/
├── api       API NestJS y webhooks
├── web       Aplicación Next.js
└── worker    Proceso NestJS standalone

packages/
├── contracts
├── database  Prisma y PostgreSQL
├── validation
└── ui
```

La aplicación se mantiene como monolito modular. PostgreSQL guarda instantes en
UTC y la operación comercial usa `America/Lima`.

## Requisitos

- Node.js `>=22.13.1 <23`
- pnpm `11.18.0`
- PostgreSQL 17
- Docker, para el entorno local recomendado

Las versiones son deliberadamente estrictas para que la evidencia de pruebas y
migraciones sea reproducible.

## Comandos principales

```sh
pnpm install
pnpm build
pnpm lint
pnpm check-types
pnpm dev
```

La aplicación web de desarrollo se abre en `http://localhost:3100`. Las rutas
principales para revisar la experiencia actual son `/orders`, `/admin/users` y
`/admin/teams`.

Validación de base de datos:

```sh
pnpm --filter @repo/database db:generate
pnpm --filter @repo/database db:migrate:status
pnpm --filter @repo/database db:migrate:dev
```

Pruebas del dominio compartido:

```sh
pnpm --filter @repo/validation test
```

## Desarrollo guiado por especificaciones

Cada incremento debe conservar cuatro artefactos en `docs/specs/<incremento>`:

1. `spec.md`: problema, alcance, reglas, invariantes y criterios de aceptación.
2. `plan.md`: arquitectura, seguridad, migración, pruebas y despliegue.
3. `tasks.md`: ejecución ordenada y estado real de cada tarea.
4. `verification.md`: evidencia automatizada y operativa, riesgos y decisión.

Una tarea se marca completada solo cuando existe el artefacto y la evidencia
proporcional. Una especificación pasa a `VERIFIED` únicamente después de validar
todos sus criterios obligatorios o documentar excepciones aceptadas.

## Límites vigentes

- No hay escritura desde el Sistema Comercial hacia GHL.
- Una orden DITO cancelada o rechazada no convierte automáticamente el lead en
  perdido.
- El alias original recibido desde DITO es evidencia inmutable.
- La asociación entre órdenes DITO y casos comerciales requiere confirmación
  humana.
- Toda consulta y mutación debe aislar primero por organización.
