# Plan — SPEC-015

1. Renombrar `DitoMatchStatus`/`match_status` como vínculo comercial.
2. Reconstruir su valor desde `commercialServiceId` durante la migración.
3. Retirar `passwordHash`, `displayedOrderCode`, `orderCodeSuffix` y el estado
   antiguo del cliente Prisma, manteniendo columnas ignoradas durante una fase
   expand/contract.
4. Añadir `organizationId` a `CommercialTeamMember`, poblarlo desde el equipo y
   reemplazar la unicidad global por organización + usuario.
5. Crear una clave foránea compuesta equipo + organización.
6. Incorporar restricciones `CHECK NOT VALID` para no bloquear un despliegue por
   datos históricos aún no auditados.
7. Actualizar API, importador, bandeja, tipos y pruebas.
8. Aplicar las migraciones en local sin reset y verificar la transformación.
9. Antes de producción, auditar los `CHECK`, validarlos y revisar estadísticas
   reales de índices.
10. Eliminar físicamente las columnas de compatibilidad en un despliegue
    posterior, cuando todas las instancias ejecuten SPEC-015.

## Decisiones de rendimiento

- No dividir `dito_orders`: la bandeja utiliza `select` explícito y los JSON son
  pequeños en la muestra actual.
- No eliminar índices por estadísticas locales; se requiere una ventana real de
  producción.
- No añadir índices para cada campo de búsqueda. Si el volumen lo exige se
  evaluará búsqueda exacta normalizada y `pg_trgm` de forma selectiva.
