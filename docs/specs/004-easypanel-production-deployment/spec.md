# SPEC-004 — Despliegue seguro en EasyPanel

**Estado:** `VERIFIED`
**Versión:** 1.0  
**Fecha:** 2026-08-06  
**Responsable de producto:** José Castilla

## Objetivo

Publicar el avance del Sistema Comercial mediante el despliegue automático de
EasyPanel, sin iniciar aplicaciones sobre un esquema de base de datos obsoleto.

## Contexto confirmado

- Repositorio: `JoseCastilla/sistema-comercial`.
- Rama productiva: `main`.
- Build path: `/`.
- Web Dockerfile: `apps/web/Dockerfile`.
- Dominio web: `https://app.distribuidoronline.com`.
- Un envío a `main` inicia el despliegue automático en EasyPanel.

## Reglas

- **BR-001:** ningún envío a `main` se considera una acción rutinaria; equivale a desplegar producción.
- **BR-002:** las migraciones pendientes deben completarse antes de iniciar el nuevo proceso del API.
- **BR-003:** si una migración falla, el proceso nuevo del API debe finalizar con error y no aceptar tráfico.
- **BR-004:** las migraciones deben ser compatibles con los datos y el código productivo anterior durante la sustitución de contenedores.
- **BR-005:** el despliegue se valida con salud del API, carga web e inspección funcional de las rutas críticas.
- **BR-006:** los archivos temporales locales no forman parte del paquete versionado.
- **BR-007:** Web debe recibir una clave estable de Server Actions durante el build para evitar incompatibilidades entre contenedores durante un reemplazo.
- **BR-008** (incidente del 01/09/2026): el servicio Web debe tener
  `DITO_IMPORT_API_URL` apuntando al hostname **interno** del servicio API
  en EasyPanel (`http://<interno-del-api>:3001/api/v1`). El valor por
  defecto `127.0.0.1:3001` solo vale en desarrollo local: en producción
  apunta al propio contenedor web y rompe todo camino web→API — la carga de
  base de campañas, el cruce de portabilidad y la importación DITO por
  Excel del administrador. El síntoma es "No se pudo contactar a la API
  local de importación". Las ventas por webhook no dependen de esta
  variable, por eso el hueco pasó inadvertido.

## Criterios de aceptación

- **AC-001:** el contenedor del API ejecuta `prisma migrate deploy` antes de iniciar NestJS.
- **AC-002:** una migración fallida impide que el contenedor nuevo quede saludable.
- **AC-003:** el esquema final conserva un solo índice parcial para nombres activos de equipos.
- **AC-004:** las comprobaciones de tipos, lint, pruebas y build terminan correctamente.
- **AC-005:** después del envío, `/orders` carga por HTTPS y los servicios Web/API aparecen saludables.
- **AC-006:** equipos, usuarios y órdenes pueden abrirse sin errores de esquema.
- **AC-007:** `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` está configurada en el servicio Web de EasyPanel con una clave base64 válida y estable.

## Fuera de alcance

- Importar o activar el workflow de n8n.
- Publicar la extensión en una tienda de navegadores.
- Cambiar la topología de PostgreSQL o Redis.
