# SPEC-029 — Verificación

**Estado:** `READY_FOR_VALIDATION`
**Fecha de verificación local:** 2026-08-23

> **Alcance de esta evidencia.** Todo lo registrado en las secciones 1 a 5
> proviene del **entorno local**, con su propia base de datos. La base local y la
> de producción son independientes y no deben combinarse ni compararse como si
> fueran el mismo conjunto de datos.
>
> En particular, las 41 instantáneas AGR, las 3 corridas y la credencial cargada
> existen **solo en local**. La migración crea las cuatro tablas vacías en
> producción: allí no habrá instantáneas hasta que un administrador cargue una
> credencial propia y ejecute la primera sincronización. Los números de esta
> verificación no son una predicción de los de producción.

## 1. Evidencia automatizada (local)

| Comprobación | Resultado |
|---|---|
| `prisma generate` | Cliente regenerado; el error `Unknown argument agrDeliverySnapshot` desapareció |
| `db:migrate:status` | 28 migraciones aplicadas, esquema al día |
| `pnpm check-types` | 7 de 7 paquetes |
| `pnpm lint` | 7 de 7 paquetes |
| `@repo/validation test` | 129 pruebas, 23 suites |
| `api test` | 89 pruebas, 15 suites |
| Imagen Linux de Web | Compilada, 407 MB |

### Empaquetado en Windows

`pnpm build` falla en la máquina local al generar el paquete `standalone`:

```text
EPERM: operation not permitted, symlink '@swc+helpers' -> .next/standalone/...
```

Es la misma limitación registrada en SPEC-027: la cuenta local no tiene permiso
para crear enlaces simbólicos. La compilación, TypeScript y las 13 páginas
estáticas se completan antes del fallo. La imagen Linux, que es el empaquetado
real del despliegue, sí finaliza. El camino de Windows no se considera evidencia
válida para publicar.

### Contenido de la imagen

- `apps/web/.next/server/app/admin/logistics/page.js` presente.
- `NODE_ENV=production` confirmado dentro del contenedor. Esto es relevante para
  **BR-002**: la llave de desarrollo derivada localmente no puede activarse en el
  contenedor publicado, por lo que la ausencia de `AGR_DELIVERY_ENCRYPTION_KEY`
  fallará de forma explícita en lugar de cifrar con una llave débil.

## 2. Evidencia de reglas sobre datos reales (base local)

Se evaluaron las 41 instantáneas almacenadas en la base local, recalculando las
reglas sobre el `rawPayload` original y comparándolas con lo persistido.

- **BR-017 / AC-012:** 41 instantáneas evaluadas, **0 desajustes** entre el valor
  guardado de `isRecoveryOpportunity` y su recálculo.
- **Estados externos observados:** `ENTREGADO` 32, `RECHAZADO` 8, `CANCELADO` 1.
- **BR-018 · distribución de acciones sobre las 9 oportunidades:**

  | Acción | Casos |
  |---|---|
  | `RESCHEDULE` | 5 |
  | `NOT_RECOVERABLE` | 2 |
  | `REVIEW_CANCELLATION` | 1 |
  | `CONTACT` | 1 |

- **BR-007:** 0 instantáneas de ventas anteriores al 10/08/2026.
- **BR-008:** 9 oportunidades accionables, 0 con orden cerrada o entregada
  internamente.
- **BR-020:** el alcance completo devuelve 9 casos repartidos entre 4 asesores
  (4, 1, 2 y 2), por lo que un `AGENT` solo puede ver su subconjunto.
- **BR-015:** 41 registros de historial, exactamente igual a la suma de
  `changedOrders` de las tres corridas (41 + 0 + 0). No hay duplicación.

## 3. Evidencia de corridas (base local)

| Llave de horario | Disparo | Estado | Candidatas | Consultadas | Encontradas | Cambiadas | Oportunidades | Errores |
|---|---|---|---|---|---|---|---|---|
| `manual-1787524545598-…` | MANUAL | COMPLETED | 42 | 42 | 41 | 41 | 9 | 0 |
| `2026-08-23-1315` | SCHEDULED | COMPLETED | 10 | 10 | 9 | 0 | 9 | 0 |
| `2026-08-23-1815` | SCHEDULED | COMPLETED | 10 | 10 | 9 | 0 | 9 | 0 |

Lecturas que confirman criterios:

- **AC-003:** la corrida manual reportó órdenes consultadas y oportunidades.
- **AC-004:** dos tramos horarios distintos produjeron exactamente una corrida
  cada uno. La llave única impidió repeticiones dentro del mismo tramo.
- **BR-009:** las candidatas cayeron de 42 a 10 después de la primera corrida.
  Las 32 órdenes con estado externo `ENTREGADO` dejaron de recorrerse
  (42 − 32 = 10). El recorrido se auto-reduce como estaba previsto.
- **BR-015:** las corridas segunda y tercera detectaron 0 cambios sobre
  respuestas idénticas, así que la huella `sha256` discrimina correctamente.
- **AC-001:** la credencial quedó `ACTIVE`, con pista `••••ASPo`, validada y
  atribuida a Jose Castilla.
- 0 errores de orden en las tres corridas.

## 4. No interferencia con el estado comercial (base local)

**AC-011.** En la ventana de las corridas (22:35–23:15 del 23/08) se
registraron 31 cierres de orden y 31 filas de historial de estado. Se verificó
su autoría:

- las 31 filas están atribuidas a **Jose Castilla**, con `newStatus = CLOSED`;
- son gestión manual del administrador durante la misma sesión de trabajo, no
  escrituras de la sincronización;
- `DitoOrderStatusHistory.changedByUserId` es **no nulable**, por lo que la
  sincronización, que no opera bajo ninguna identidad de usuario, es
  estructuralmente incapaz de crear historial de estado comercial;
- 0 órdenes canceladas fueron tocadas.

**BR-014.** 41 órdenes recibieron `updatedAt` renovado. Es el comportamiento
buscado: dispara la notificación transaccional de SPEC-008 para que las bandejas
abiertas se refresquen, sin alterar ningún campo comercial.

## 5. Rutas y permisos (servidor local)

Servidor local en `http://localhost:3100`:

| Ruta | Respuesta |
|---|---|
| `/api/health` | 200 |
| `/login` | 200 |
| `/orders` | 307 → `/login` |
| `/admin/logistics` | 307 → `/login` |

Ambas rutas protegidas redirigen sin sesión, confirmando `requireCommercialAccess`
y `requireAdminAccess` (**BR-005**).

## 6. Recorrido visual con sesión `ADMIN` (local)

Realizado el 23/08/2026 sobre `localhost:3100`, tema oscuro, viewport 1439 px.

| Criterio | Observado |
|---|---|
| AC-001 | Credencial `Activa`, pista `••••ASPo`, "actualizada por Jose Castilla el 23/08/26, 5:35 p. m." |
| AC-003 | Última corrida: `Completada`, "10 de 10" consultadas, 9 oportunidades |
| AC-006 | Cabecera "Oportunidades logísticas desde el 10/08" y "Última consulta: 23/08/2026, 18:15" |
| AC-007 | Panel con acción recomendada, `AGR · RECHAZADO` y motivo "CLIENTE AUSENTE EXCEDE 3 VISITAS" |
| AC-008 | Etiqueta `AGR · Reagendar` junto a `Abierto` en la columna `Estado` |
| AC-009 | 9 casos = 5 reagendar + 1 contactar + 3 revisar o cerrar |
| AC-010 | Alerta "9 casos requieren revisión logística → Revisar" |

Los conteos de la interfaz coinciden exactamente con los recalculados en la
sección 2. El reparto por asesor observado en el filtro —Alexandra H. 4,
Francesco G. 2, Jimena C. 2, Angieska D. 1— reproduce el de la base.

### Ajustes derivados del recorrido

1. **Panel de acción reducido.** Se retiraron `Entrega pactada`,
   `Gestión logística` y la leyenda de frescura por pedido, por no aportar a la
   decisión. El panel queda en acción recomendada, estado externo y motivo.
   Sobre las 9 oportunidades reales, `motivo/submotivo` está presente en las 9,
   mientras que `resultado`, `próxima acción` y `fecha de compromiso` están
   vacíos en las 9, coherente con que las 9 tengan gestión `Sin gestión`. Esos
   tres campos permanecen en el panel de forma condicional: se poblarán cuando
   el equipo logístico gestione el caso.
2. **Columna `Estado AGR` retirada.** Ver la sección 8 de `spec.md`. La medición
   mostró que solo 4 de 9 columnas quedaban visibles y que la columna nueva
   exigía 604 px de desplazamiento. El ancho de tabla vuelve de 1253 px a
   1108 px, su valor previo a este incremento.

## 7. Pendientes antes de marcar `VERIFIED`

Estos puntos quedan abiertos y son la razón por la que la especificación
permanece en `READY_FOR_VALIDATION`:

1. **Verificación visual con sesión iniciada.** El filtro `Oportunidades
   logísticas`, la columna `Estado AGR`, el panel de acción recomendada y los
   indicadores no se recorrieron visualmente en esta sesión. Requiere una sesión
   autenticada. Los criterios AC-006 a AC-010 están respaldados por la evidencia
   de datos, no por inspección de pantalla.
2. **Verificación con roles `AGENT` y `SUPERVISOR`.** El reparto de las 9
   oportunidades entre 4 asesores permite comprobar el aislamiento por alcance.
3. **Despliegue de la integración inerte y verificación productiva.**
4. **Activación en producción**, diferida: registro de
   `AGR_DELIVERY_ENCRYPTION_KEY` y carga de la primera credencial. Hasta
   entonces la especificación no puede pasar a `VERIFIED`, porque los criterios
   AC-001 a AC-005 no son observables en producción.

## 7. Riesgos y deuda aceptada

- **Sin cobertura automatizada de las reglas nuevas.** `isAgrRecoveryOpportunity`
  y `getAgrAction` son funciones puras y deterministas, exactamente el tipo de
  regla que el repositorio mantiene probada en `@repo/validation`. Hoy viven en
  `apps/web` y no tienen pruebas. Se validaron manualmente contra 41 registros
  reales con 0 desajustes, pero esa evidencia es una foto, no una red de
  seguridad. Moverlas a `@repo/validation` con pruebas es el seguimiento
  recomendado, y se dejó fuera de este incremento por no introducir un refactor
  en la víspera de un despliegue.
- **Clasificación por expresiones regulares sobre texto libre externo.** Un
  vocabulario nuevo de AGR cae en `CONTACT`, que pide validar en lugar de cerrar.
  La degradación es hacia el lado seguro, pero la cobertura de motivos debe
  revisarse periódicamente contra los estados reales observados.
- **Credencial de sesión de usuario, no de servicio.** Vencerá con regularidad.
  El sistema degrada a solo lectura de la última información y avisa al
  administrador; no falla la bandeja.
- **La sincronización la dispara cualquier rol.** El primer acceso a Pedidos
  después de un tramo horario inicia la corrida de toda la organización, aunque
  quien entre sea un asesor. Es intencional —maximiza la frescura sin un proceso
  programado— pero significa que el costo de la consulta externa lo paga la
  primera visita del tramo.
- **Activación diferida por decisión de producto.** `AGR_DELIVERY_ENCRYPTION_KEY`
  no se registrará en EasyPanel durante este despliegue. La integración se
  publica **inerte** y eso es seguro: sin fila en `agr_delivery_integrations`,
  `runAgrDeliverySync` retorna en su primera comprobación y nunca alcanza el
  descifrado; el cifrado solo se ejecuta al enviar el formulario de credencial.
  La bandeja, las métricas y el rendimiento no se ven afectados.

  La consecuencia a recordar es que **el módulo no podrá activarse** hasta que la
  variable exista: al pegar una cookie válida en producción, la validación contra
  AGR tendrá éxito pero el guardado fallará con
  `AGR_DELIVERY_ENCRYPTION_KEY no está configurada.` y la credencial no se
  persistirá. Comprobado replicando `encryptionKey()` con `NODE_ENV=production`
  y sin la variable.

## 8. Decisión

El incremento está listo para validación funcional con sesión iniciada y, tras
ella, para despliegue. La integración es aditiva, no altera el estado comercial y
degrada de forma segura ante el vencimiento de la credencial externa.
