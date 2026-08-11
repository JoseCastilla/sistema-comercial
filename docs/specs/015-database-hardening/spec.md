# SPEC-015 — Endurecimiento de base de datos

## Estado

IMPLEMENTED_LOCAL

## Problema

La auditoría estructural detectó conceptos mezclados, campos redundantes y
reglas de integridad que dependían únicamente de la aplicación. En particular,
`matchStatus` se utilizaba tanto para el vínculo comercial como para la
asignación de asesor/equipo, y la membresía primaria de un agente era única de
forma global aunque el dominio admite múltiples organizaciones.

## Alcance

- Separar el vínculo comercial de la asignación operativa.
- Derivar el estado de asignación sin persistir una columna adicional.
- Retirar del cliente nuevo el almacén de contraseña no utilizado y los códigos
  derivados; conservarlos físicamente durante un ciclo de compatibilidad.
- Hacer que la membresía primaria sea única por organización.
- Impedir membresías entre organizaciones y equipos distintos.
- Proteger importes, fechas, coordenadas y contadores con restricciones SQL.
- Conservar índices hasta medir su uso real en producción.

## Reglas e invariantes

- **BR-001:** `commercialLinkStatus` describe exclusivamente el vínculo con
  `CommercialService`.
- **BR-002:** asignar asesor y equipo no modifica `commercialLinkStatus`.
- **BR-003:** la asignación se deriva de `agentUserId`, `assignedTeamId`, correo
  corporativo y `parseStatus`.
- **BR-004:** el código canónico conserva `orderCodeRaw` y
  `orderCodeNormalized`; las representaciones antiguas quedan ignoradas hasta
  la migración de contracción.
- **BR-005:** Better Auth es el único almacén utilizado por la aplicación; la
  columna histórica queda ignorada durante la transición.
- **BR-006:** un agente puede tener una membresía primaria activa por
  organización.
- **INV-001:** la organización de una membresía coincide con la organización de
  su equipo.
- **INV-002:** los importes no son negativos y los días están entre 1 y 31.
- **INV-003:** las coordenadas se guardan en pareja y dentro de sus rangos.
- **INV-004:** el inicio de una ventana de entrega precede a su final.
- **INV-005:** los contadores de importación no son negativos.

## Criterios de aceptación

1. Los datos existentes migran sin reiniciar PostgreSQL y una instancia anterior
   conserva temporalmente las columnas que conoce.
2. Las órdenes sin `commercialServiceId` quedan `UNMATCHED` aunque tengan asesor.
3. La UI muestra un estado de asignación derivado y no el vínculo comercial.
4. Prisma genera el cliente y el monorepo supera tipos, pruebas y lint.
5. Las restricciones nuevas protegen escrituras y el histórico se valida antes
   del despliegue.
