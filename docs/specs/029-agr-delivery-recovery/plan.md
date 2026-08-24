# SPEC-029 — Plan

## 1. Arquitectura

La integración vive completa en la aplicación Web, como feature
`apps/web/src/features/agr-delivery`, porque su disparo depende del acceso a
Pedidos y no de un proceso programado independiente.

```text
/orders (Server Component)
  └─ after() → maybeRunScheduledAgrDeliverySync(organizationId)
                 └─ runAgrDeliverySync
                      ├─ candidatos elegibles (DitoOrder)
                      ├─ fetchAgrDeliveryRecord  ── AGR /api/records
                      ├─ AgrDeliveryOrderSnapshot (upsert)
                      ├─ AgrDeliveryOrderHistory  (solo si cambió)
                      └─ AgrDeliverySyncRun       (contadores)
```

`after()` garantiza que la sincronización se ejecute después de responder la
página, de modo que la bandeja nunca espera por la fuente externa.

### Modelo de datos

Cuatro tablas nuevas en `packages/database/prisma/schema/agr-delivery.prisma`:

| Tabla | Propósito |
|---|---|
| `agr_delivery_integrations` | Credencial cifrada por organización, estado y última validación |
| `agr_delivery_sync_runs` | Bitácora de corridas con contadores y llave de horario |
| `agr_delivery_order_snapshots` | Último estado externo por orden, 1:1 con `DitoOrder` |
| `agr_delivery_order_history` | Registro por cada cambio detectado |

`AgrDeliveryOrderSnapshot` es una tabla satélite: `DitoOrder` la referencia como
relación opcional y ninguna columna del estado comercial se toca. Esto mantiene
la separación exigida por BR-014 y permite retirar la integración sin migrar
datos comerciales.

Las columnas del snapshot conservan el vocabulario de la fuente
(`estadoPedido`, `motivoRechazo`, `proximaAccion`) porque son evidencia externa,
no dominio propio. La traducción a acción comercial ocurre en la capa de lectura.

## 2. Seguridad

- La cookie se cifra con AES-256-GCM antes de persistirse. El formato almacenado
  es `iv.tag.ciphertext` en base64url.
- La llave se resuelve desde `AGR_DELIVERY_ENCRYPTION_KEY` y acepta 64
  caracteres hexadecimales o 32 bytes en base64. En producción, su ausencia es
  un error explícito; fuera de producción se deriva una llave local para no
  bloquear el desarrollo.
- El descifrado ocurre solo dentro de `runAgrDeliverySync`, en el servidor. No
  existe ninguna ruta que devuelva la cookie.
- La interfaz persiste únicamente `credentialHint` con los últimos cuatro
  caracteres, más quién la actualizó y cuándo.
- Ambas acciones de servidor exigen `requireAdminAccess()`.
- El registro histórico y la instantánea guardan `rawPayload` completo; contiene
  datos del pedido ya presentes en el sistema, no credenciales.

## 3. Idempotencia y concurrencia

- `agr_delivery_sync_runs` tiene índice único `(organizationId, scheduleKey)`.
  La creación de la corrida es la que gana la carrera: si dos accesos simultáneos
  a Pedidos caen en el mismo tramo horario, el segundo falla al crear la fila y
  aborta sin consultar la fuente.
- La llave de horario se calcula en `America/Lima` como `AAAA-MM-DD-HHMM` sobre
  el último tramo alcanzado (0815, 1315, 1815). Antes de las 08:15 no hay tramo
  y no se sincroniza.
- Las corridas manuales usan una llave `manual-<timestamp>-<uuid>` para no
  colisionar con las programadas.
- El snapshot se escribe con `upsert` sobre `ditoOrderId`, que es único.
- Snapshot e historial se escriben dentro de una misma transacción por orden.

## 4. Carga sobre la fuente externa

- Máximo 250 candidatos por corrida, ordenados por `registeredAt` ascendente.
- Lotes de 10 solicitudes concurrentes, secuenciales entre lotes.
- Tiempo límite de 15 segundos por solicitud.
- Los criterios de elegibilidad reducen el conjunto de forma acumulativa: una
  orden entregada o cerrada, interna o externamente, sale del recorrido para
  siempre.
- Un error aislado de una orden incrementa el contador de errores y no detiene
  la corrida. Solo un `AgrCredentialError` la aborta.

## 5. Integración con la bandeja

- `OrderFilter` incorpora `LOGISTICS`. Como `ESCALATIONS`, ignora el filtro de
  período: una entrega fallida sigue siendo trabajo pendiente.
- El alcance por rol y el filtro de equipo se aplican antes que la condición de
  oportunidad, en la misma consulta.
- `getAgrAction` traduce la evidencia externa a una de cuatro acciones y se
  reutiliza tanto para el resumen agregado como para cada fila.
- La prioridad de ordenamiento coloca `RESCHEDULE` al nivel de una incidencia
  urgente y `CONTACT` en el siguiente escalón, por delante del vencimiento de
  SLA.
- Cuando la corrida detecta cambios, actualiza `updatedAt` de esas órdenes. Eso
  emite la notificación transaccional de PostgreSQL introducida por SPEC-008 y
  las bandejas abiertas se refrescan solas.

## 6. Migración

`20260824010000_add_agr_delivery_recovery_sync` crea los cuatro modelos, sus
enumeraciones y sus índices. Es una migración puramente aditiva: no altera
tablas existentes salvo por las relaciones inversas declaradas en el esquema
Prisma, que no producen cambios físicos en `dito_orders`, `organizations` ni
`users`.

En consecuencia es compatible con el código productivo anterior durante la
sustitución de contenedores, como exige SPEC-004 BR-004.

**La base local y la de producción son independientes.** La migración crea las
cuatro tablas vacías en producción. Ninguna credencial, instantánea, corrida ni
historial del entorno local viaja al despliegue, ni debe copiarse: la credencial
está cifrada con una llave distinta y las instantáneas apuntan a identificadores
de órdenes de la base local. Producción construye su propio historial desde su
primera sincronización.

## 7. Despliegue

El despliegue se hace en dos tiempos por decisión de producto: primero se publica
la integración **inerte**, y la activación queda para después.

### Primer tiempo — publicar inerte

1. Enviar a `main` y dejar que el despliegue automático ejecute
   `prisma migrate deploy` antes de iniciar el proceso nuevo.
2. Verificar salud de Web y API.
3. Confirmar que `/orders` opera sin cambios y que `/admin/logistics` muestra la
   credencial como `Sin configurar`.

Sin fila en `agr_delivery_integrations`, `runAgrDeliverySync` retorna en su
primera comprobación y nunca alcanza el descifrado. El cifrado solo se ejecuta
al enviar el formulario de credencial. Por lo tanto la ausencia de
`AGR_DELIVERY_ENCRYPTION_KEY` no afecta la bandeja, las métricas ni el
rendimiento: la integración queda dormida, con sus cuatro tablas vacías y el
filtro en cero.

### Segundo tiempo — activar

4. Registrar `AGR_DELIVERY_ENCRYPTION_KEY` en EasyPanel para el servicio Web.
   Hasta que exista, guardar una credencial en producción falla con el mensaje
   `AGR_DELIVERY_ENCRYPTION_KEY no está configurada.` y el módulo permanece
   inutilizable, aunque la cookie sea válida.
5. Confirmar que la variable está declarada en `globalEnv` de `turbo.json` para
   que la caché no invalide el build de forma silenciosa.
6. Cargar en `/admin/logistics` de **producción** una credencial obtenida
   iniciando sesión en AGR. No se reutiliza la credencial local: está cifrada con
   otra llave y no es transferible.
7. Ejecutar una sincronización manual y confirmar que las tablas se pueblan desde
   cero con las órdenes productivas.
8. Revisar el filtro `Oportunidades logísticas` con un usuario no administrador.

## 8. Pruebas

- Tipos y lint de todo el monorepo.
- Suite de dominio `@repo/validation` y suite de `api`, para confirmar que el
  incremento no altera reglas existentes.
- Compilación de la imagen Linux de Web, que es el empaquetado real del
  despliegue. El empaquetado `standalone` no finaliza en Windows por permisos de
  enlace simbólico; ese camino no es evidencia válida.
- Verificación funcional manual sobre `/admin/logistics` y `/orders`.

## 9. Riesgos aceptados

- **Fuente externa no oficial.** AGR se consulta con una cookie de sesión de
  usuario, no con una credencial de servicio. Vencerá con regularidad y exigirá
  intervención del administrador. El diseño lo asume: degrada a solo lectura de
  la última información en lugar de fallar.
- **Reglas sin pruebas automatizadas.** `isAgrRecoveryOpportunity` y
  `getAgrAction` son reglas puras que hoy viven en `apps/web`, fuera de
  `@repo/validation`, y por lo tanto sin cobertura. Ver `verification.md`.
- **Clasificación por expresiones regulares.** La traducción a acción depende de
  textos libres de la fuente. Un vocabulario nuevo cae en `CONTACT`, que es el
  camino seguro: pide validar en vez de cerrar.
