# SPEC-029 — Tareas

## Modelo y migración

- [x] Definir credencial, bitácora de corridas, instantánea e historial.
- [x] Declarar relaciones inversas en `Organization`, `User` y `DitoOrder`.
- [x] Migración aditiva `20260824010000_add_agr_delivery_recovery_sync`.
- [x] Registrar `AGR_DELIVERY_ENCRYPTION_KEY` en `globalEnv` de `turbo.json`.

## Integración

- [x] Cifrado y descifrado AES-256-GCM de la cookie de sesión.
- [x] Consulta dirigida por `order_id` con tiempo límite y normalización.
- [x] Detección de credencial vencida ante 401 y 403.
- [x] Selección de candidatos elegibles con corte del 10/08.
- [x] Detención de consultas ante estado externo terminal.
- [x] Persistencia de cancelaciones hasta obtener el motivo de rechazo.
- [x] Huella `sha256` para detectar cambios reales.
- [x] Historial por cambio, dentro de la transacción de la instantánea.
- [x] Llave de horario Lima idempotente para 08:15, 13:15 y 18:15.
- [x] Disparo en segundo plano desde Pedidos mediante `after()`.
- [x] Emisión de tiempo real al detectar cambios.

## Administración

- [x] Acción de servidor para guardar la credencial validándola antes.
- [x] Acción de servidor para sincronizar manualmente.
- [x] Página `/admin/logistics` con estado, contadores y última corrida.
- [x] Entrada de navegación visible solo para `ADMIN`.

## Bandeja

- [x] Filtro `LOGISTICS` con alcance por rol y equipo.
- [x] Columna `Estado AGR` en la tabla de escritorio.
- [x] Panel de acción recomendada en la tarjeta de gestión.
- [x] Indicadores por reagendar, contactar y revisar o cerrar.
- [x] Alerta enlazada desde la bandeja general.
- [x] Prioridad de ordenamiento para casos logísticos.

## Verificación local

- [x] Regenerar cliente Prisma y confirmar estado de migraciones.
- [x] Tipos y lint del monorepo.
- [x] Suites de `@repo/validation` y `api`.
- [x] Compilación de la imagen Linux de Web y presencia de la ruta nueva.
- [x] Guardado y validación de credencial por `ADMIN`.
- [x] Corrida manual y corridas programadas idempotentes.
- [x] Recálculo de las reglas contra las instantáneas almacenadas.
- [x] Confirmación de que la sincronización no altera el estado comercial.
- [x] Redirección de rutas protegidas sin sesión.
- [ ] Recorrido visual del filtro, la columna y el panel con sesión iniciada.
- [ ] Verificación con roles `AGENT` y `SUPERVISOR`.

## Pendientes de producción

- [ ] Registrar `AGR_DELIVERY_ENCRYPTION_KEY` en EasyPanel.
- [ ] Desplegar por `main` y confirmar salud de Web y API.
- [ ] Cargar credencial propia de producción y sincronizar por primera vez.
- [ ] Verificación productiva y paso a `VERIFIED`.

## Seguimiento posterior

- [ ] Mover `isAgrRecoveryOpportunity` y `getAgrAction` a `@repo/validation` con
      cobertura automatizada.
