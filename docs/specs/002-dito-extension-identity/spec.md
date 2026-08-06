# SPEC-002 — Identidad del remitente de la extensión DITO

**Estado:** `APPROVED`  
**Versión:** 1.0  
**Fecha:** 2026-08-05  
**Fecha de aprobación:** 2026-08-05  
**Responsable de producto:** José Castilla

## 1. Problema

El formato operativo `PrimerNombre InicialApellido` no identifica de manera
inequívoca a un asesor. Carmen Ramírez y Carmen Rivas pueden producir el mismo
alias `CARMEN R.`. La extensión conoce además el correo corporativo configurado
durante su instalación y puede enviar una identidad más fuerte.

## 2. Objetivos

1. Identificar al remitente por correo corporativo único.
2. Conservar el nombre DITO como evidencia original, no como identidad primaria.
3. Identificar cada instalación mediante un UUID estable.
4. Detectar instalaciones reutilizadas con otro correo.
5. Mantener compatibilidad temporal con envelopes DITO 1.0.
6. Asignar simultáneamente agente y equipo cuando la identidad sea válida.

## 3. Contrato

El envelope 2.0 añade:

```json
{
  "schema_version": "2.0",
  "source": "DITO_EXTENSION",
  "submitted_by": {
    "installation_id": "uuid",
    "email": "carmen.ramirez@distribuidoronline.com"
  },
  "agent": {
    "name_raw": "CARMEN R."
  }
}
```

El resto de la estructura comercial permanece igual al envelope 1.0.

## 4. Reglas de negocio

- **BR-001:** el correo se normaliza con `trim().toLowerCase()`.
- **BR-002:** el envelope 2.0 solo acepta correos `@distribuidoronline.com`.
- **BR-003:** el correo debe corresponder a un único usuario activo de la organización.
- **BR-004:** el usuario debe tener rol `AGENT` y equipo primario activo.
- **BR-005:** una asignación válida persiste simultáneamente `agentUserId` y `assignedTeamId`.
- **BR-006:** cuando llega identidad 2.0 no se usa alias como fallback automático.
- **BR-007:** una identidad inválida deja la orden sin responsable y equipo.
- **BR-008:** `agentNameRaw`, correo recibido e instalación se conservan para auditoría.
- **BR-009:** una instalación vinculada previamente a otro correo no asigna automáticamente.
- **BR-010:** envelopes 1.0 continúan aceptándose durante la transición.
- **BR-011:** el flujo 1.0 conserva su resolución heredada por alias hasta retirar la compatibilidad.
- **BR-012:** recibir un correo desconocido nunca crea usuarios automáticamente.

## 5. Invariantes

- **INV-001:** ninguna resolución cruza organizaciones.
- **INV-002:** una orden nunca queda con agente sin equipo por una resolución 2.0.
- **INV-003:** la identidad recibida permanece separada de la responsabilidad actual.
- **INV-004:** un conflicto de instalación no se resuelve silenciosamente por nombre.
- **INV-005:** el cambio no interrumpe la ingesta productiva 1.0.

## 6. Criterios de aceptación

- **AC-001:** dos agentes con alias `CARMEN R.` se resuelven correctamente por correos distintos.
- **AC-002:** un correo desconocido produce una orden sin asignación automática.
- **AC-003:** un agente sin equipo activo no recibe la orden.
- **AC-004:** una instalación vinculada a otro correo produce revisión.
- **AC-005:** el correo y `installation_id` quedan auditables en la orden.
- **AC-006:** un envelope 1.0 válido continúa siendo aceptado.
- **AC-007:** un correo externo al dominio corporativo es rechazado por validación.
- **AC-008:** ningún dato recibido crea o modifica usuarios.

## 7. Fuera de alcance

- autenticación criptográfica individual de la extensión;
- administración remota de instalaciones;
- actualización automática de la extensión;
- eliminación inmediata de compatibilidad con alias;
- cambios al contenido comercial extraído desde DITO.
