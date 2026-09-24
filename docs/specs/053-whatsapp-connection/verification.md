# Verificación — SPEC-053

Sin evidencia todavía: la spec está en `BORRADOR`.

| AC | Cómo se comprobará | Resultado |
|---|---|---|
| AC-001 | Conexión con token válido e inválido en local contra el número de prueba de Meta | pendiente |
| AC-002 | Mensaje desde teléfono de prueba; reenviar el mismo webhook dos veces | pendiente |
| AC-003 | `POST` con firma alterada; contar filas en `WebhookEvent` | pendiente |
| AC-004 | Envío con doble clic simulado (mismo `clientRequestId`) | pendiente |
| AC-005 | Prueba pura de ventanas con reloj fijo + envío real fuera de ventana | pendiente |
| AC-006 | Anuncio CTWA de prueba o `referral` de ejemplo de la documentación | pendiente |
| AC-007 | Foto y audio entrantes; URL firmada vencida devuelve 403 | pendiente |
| AC-008 | Mensaje «BAJA»; regla pura de consentimiento | pendiente |
| AC-009 | Contacto de prueba ficticio con pedido DITO ficticio | pendiente |
| AC-010 | Prueba de aislamiento con dos organizaciones | pendiente |

Las pruebas usan teléfonos y personas ficticias; nunca clientes reales.
