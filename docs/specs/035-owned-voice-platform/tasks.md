# Tasks — SPEC-035

## Descubrimiento y decisiones

- [x] Auditar stack, despliegue, autenticación y aislamiento multiempresa del
      Sistema Comercial.
- [x] Delimitar “Twilio propio” como una capa de control propia sobre SIP, no
      como una réplica total de un CPaaS global.
- [x] Separar plano de control y plano de medios.
- [x] Seleccionar Asterisk 22 LTS + PJSIP + ARI como hipótesis técnica inicial.
- [x] Diseñar el primer corte vertical como click-to-call WebRTC asesor-primero.
- [x] Confirmar outbound como objetivo de la etapa y relegar entrada/IVR/colas.
- [x] Incorporar audio contractual original, hash, manifiesto y descarga
      auditada como capacidades centrales de V1.
- [x] Definir la frontera futura con WhatsApp mediante una proyección común, no
      tablas de transporte compartidas.
- [x] Identificar OV500, host SIP, puerto, codecs, DTMF y métodos de
      autenticación informados por el proveedor.
- [x] Crear la matriz inicial `provider-capabilities.md` sin credenciales.
- [ ] Rotar la credencial expuesta antes de cualquier uso.
- [ ] Completar las respuestas bloqueantes de la matriz durante V0.
- [ ] Aprobar política de grabación, aviso, acceso y retención.
- [ ] Confirmar volumen, concurrencia y prioridad de llamadas entrantes.

## V0 — Laboratorio SIP

- [ ] Preparar red aislada, DNS/TLS y reglas explícitas de señalización/RTP.
- [ ] Provisionar una IP pública fija para Asterisk y enviarla al proveedor
      para whitelisting.
- [ ] Desplegar una versión fijada de Asterisk 22 LTS con configuración mínima.
- [ ] Configurar troncal mediante secretos de despliegue.
- [ ] Probar salida y entrada con números de laboratorio.
- [ ] Verificar caller ID, codecs, DTMF, NAT, TLS/SRTP y causas de hangup.
- [ ] Probar WebRTC WSS/DTLS-SRTP desde las redes reales de los asesores.
- [ ] Documentar límites de canales/CPS y procedimiento de escalamiento.
- [ ] Obtener evidencia de calidad y decidir si hace falta TURN.

## V1 — Núcleo de control

- [ ] Crear `apps/voice` como servicio NestJS independiente.
- [ ] Incorporar modelos Prisma de voz y migración aditiva.
- [ ] Implementar máquina de estados pura con pruebas de transiciones.
- [ ] Implementar comandos idempotentes y autenticación interna firmada.
- [ ] Implementar inbox ARI, evento normalizado y outbox transaccional.
- [ ] Implementar cliente ARI, reconexión y reconciliación al iniciar.
- [ ] Implementar adaptador de ruta SIP sin exponer detalles al dominio.
- [ ] Implementar sesiones WebRTC individuales mediante PJSIP Realtime.
- [ ] Crear softphone SIP.js y estado en tiempo real en `apps/web`.
- [ ] Integrar click-to-call en un caso de recupero autorizado.
- [ ] Crear `RecoveryCaseAttempt` automático sin duplicar la disposición.
- [ ] Implementar grabación detrás de feature flag y object storage.
- [ ] Implementar modo `CONTRACT`, preflight y estado de evidencia.
- [ ] Preservar original inmutable y generar manifiesto SHA-256 verificable.
- [ ] Implementar reproducción y descarga como permisos separados.
- [ ] Auditar descargas exitosas y rechazadas con motivo.
- [ ] Implementar salud, métricas y panel operativo mínimo.
- [ ] Ejecutar pruebas unitarias, de integración SIP y de aislamiento tenant.

## Piloto

- [ ] Activar una organización y un grupo pequeño de usuarios.
- [ ] Configurar concurrencia, duración y destinos con límites conservadores.
- [ ] Validar calidad desde redes reales y navegadores soportados.
- [ ] Probar caída de ARI, Asterisk, PostgreSQL y object storage.
- [ ] Auditar que logs/HTML no contengan secretos, SDP ni teléfonos completos.
- [ ] Comparar CDR/CEL del motor con `VoiceCall` y la factura del proveedor.
- [ ] Documentar runbook, rollback y guardia operativa.

## Fases posteriores

- [ ] V2+: evaluar DID, horarios, colas y disponibilidad solo cuando outbound
      esté estable y producto lo priorice.
- [ ] V2: transferencias ciegas/atendidas y devolución de llamada.
- [ ] V3: supervisión auditada, campañas progresivas y analítica.
- [ ] Publicar webhooks/API externa solo después de estabilizar el contrato
      interno.
