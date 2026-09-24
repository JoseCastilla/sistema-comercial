# Plan — SPEC-052

Spec rectora: su plan es el orden y las condiciones de paso entre specs, no
una construcción propia.

## Etapas y condición de paso (v0.2)

| Paso | Etapa | Spec | Empieza cuando | Termina cuando |
|---|---|---|---|---|
| 0 | — | Prerrequisitos (§7) | José confirma D-01 a D-16 | Portafolio verificado, número nuevo, WABA con pago, trámite de Tech Provider iniciado |
| 1 | 1 | SPEC-053 | Paso 0 con número y token | Mensaje de prueba ida y vuelta guardado, con consentimiento y baja funcionando |
| 2 | 1 | SPEC-061 fases 1-3 | 053 fase 1 | Oportunidad abierta por mensaje, toques y vínculo con pedido ficticio |
| 3 | 1 | SPEC-054 | 053 `ENTREGADA` | Dos asesores ficticios atienden en paralelo sin respuestas dobles; «Tomar control» cancela pendientes; copia fuera del servidor activa |
| 4 | 1 | SPEC-055 | 053 `ENTREGADA` (en paralelo con 054) | Plantilla creada, aprobada y enviada |
| 5 | 1 | SPEC-061 fases 4-6 y SPEC-056 fase A | 054 y 055 `ENTREGADA` | **Piloto:** campaña pequeña; tablero por etapas y costo por pedido con datos reales |
| 6 | 2 | SPEC-058 | Etapa 1 `VERIFICADA` y catálogo cargado | Agente publicado con evaluación aprobada, en horario nocturno |
| 7 | 2 | SPEC-060 fases 1-4 | 054 `VERIFICADA` | Seis automatizaciones predefinidas en producción |
| 8 | 2 | SPEC-057 | 056 fase A `ENTREGADA` | Eventos visibles en el dataset de Meta |
| 9 | 3 | SPEC-059, SPEC-060 fase 5, SPEC-056 fase B | Etapa 2 `VERIFICADA` | Primera difusión con consentimiento; primer flujo diseñado en el lienzo |
| 10 | — | Retiro de captación GHL (spec nueva) | 053 a 056 y 061 `VERIFICADA` | Número de GHL migrado; GHL sin tráfico de WhatsApp |
| 11 | 4 | Programa de comercialización (spec nueva) | Decisión de José de vender | Primera empresa externa operando |

## Piezas transversales que se construyen una vez

- **Adaptador de Meta** (`apps/api/src/modules/meta/`): cliente de Graph API
  con versión fija, verificación de firma, cifrado de tokens (AES-GCM, igual
  que `AgrDeliveryIntegration`). Lo crea SPEC-053; lo reutilizan 055, 056 y 057.
- **Outbox y bucle del worker**: lo crea SPEC-053; lo reutilizan 058, 059 y 060.
- **Almacenamiento de objetos**: lo crea SPEC-053 (media); lo reutiliza SPEC-035.
- **Reglas puras** en `packages/validation/src/` (ventanas, consentimiento,
  derivación de etapa, emparejamiento pedido ↔ conversación), con pruebas
  `node --test`, antes de cualquier pantalla.
