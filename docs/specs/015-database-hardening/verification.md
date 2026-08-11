# Verificación — SPEC-015

## Estado

VERIFIED_LOCAL — pendiente producción.

## Evidencia local

- Prisma Client 7.9.1 generado correctamente.
- Las dos migraciones se aplicaron con `prisma migrate deploy`, sin reset.
- 31 órdenes existentes conservaron su código original y normalizado.
- Las 31 quedaron `commercialLinkStatus = UNMATCHED`; ninguna tenía
  `commercialServiceId`.
- Todas las membresías existentes recibieron organización desde su equipo.
- El cliente nuevo ignora las columnas antiguas. PostgreSQL las conserva durante
  un ciclo de despliegue para que una instancia previa no falle; su contracción
  queda explícitamente pendiente.
- Las restricciones se crean como `NOT VALID`, por diseño, y las ocho fueron
  validadas correctamente contra todos los datos locales.
- Las 7 membresías locales tienen organización y ninguna contradice a su equipo.
- `pnpm check-types`: aprobado.
- API: 15 suites y 77 pruebas aprobadas.
- Dominio compartido: 111 pruebas aprobadas.
- `pnpm lint`: aprobado en los 7 paquetes ejecutables.
- Imagen Docker web: construida correctamente con Next.js 16.2.0.
- Imagen Docker API: construida correctamente con NestJS y Prisma 7.9.1.
- `prisma migrate status`: 24 migraciones, esquema local actualizado.
- Las 24 migraciones se aplicaron desde cero sobre una base temporal aislada;
  se confirmó vínculo comercial nuevo, columnas de compatibilidad y clave
  foránea multiempresa. La base temporal fue eliminada al terminar.

El build nativo de Next.js compiló y generó las páginas, pero Windows impidió
crear un enlace simbólico dentro de `.next/standalone`. El build equivalente en
el contenedor Linux de producción finalizó correctamente; por tanto no se
clasifica como defecto del código.

## Pendiente antes de producción

- Confirmar migraciones pendientes y ausencia de deriva en una copia de
  producción.
- Auditar filas históricas y ejecutar `VALIDATE CONSTRAINT`.
- Capturar `pg_stat_user_indexes` antes de proponer eliminación de índices.
- Confirmar que no quedan instancias anteriores antes de retirar columnas de
  compatibilidad.
