# SPEC-002 — Plan

## 1. Estrategia

Implementar una transición compatible:

1. API acepta envelopes 1.0 y 2.0.
2. Persistencia incorpora identidad del remitente como campos opcionales.
3. La resolución 2.0 usa correo y equipo; nunca alias.
4. La resolución 1.0 mantiene temporalmente el comportamiento heredado.
5. Extensión y n8n migran después de desplegar primero el backend compatible.

## 2. Persistencia

Añadir a `DitoOrder`:

- `submitterInstallationId` UUID opcional;
- `submitterEmailRaw` opcional;
- `submitterEmailNormalized` opcional;
- índice por organización e instalación;
- índice por organización y correo normalizado.

La primera versión detectará conflictos consultando órdenes previas de la misma
instalación. Una entidad administrable de instalaciones podrá incorporarse cuando
la operación necesite revocación centralizada.

## 3. Resolución

La consulta por correo debe comprobar en una sola operación lógica:

- organización;
- usuario activo;
- membresía organizacional `AGENT`;
- una membresía primaria activa;
- equipo activo.

El resultado devuelve `{ userId, teamId }` o `null`.

## 4. Despliegue

1. Desplegar migración y API compatible.
2. Actualizar normalizador n8n para producir 2.0.
3. Actualizar extensión para capturar nombre, correo e instalación una vez.
4. Validar piloto con dos correos distintos y un conflicto controlado.
5. Medir uso residual de 1.0 antes de retirar alias automático.

## 5. Seguridad

El correo es una señal operativa de identidad, no autenticación criptográfica.
El secreto compartido del webhook continúa protegiendo el endpoint. Un futuro
registro de instalaciones podrá emitir credenciales individuales revocables.
