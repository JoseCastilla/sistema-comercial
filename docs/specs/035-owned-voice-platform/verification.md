# Verificación — SPEC-035

**Estado:** `DISCOVERY — SIN IMPLEMENTACIÓN`

## Evidencia disponible — 31/08/2026

- [x] El repositorio es un monorepo TypeScript con Next.js, NestJS, Prisma y
      PostgreSQL, desplegado como monolito modular.
- [x] La organización y el usuario ya son fronteras de autorización usadas por
      todos los dominios comerciales.
- [x] `RecoveryCaseAttempt` ya distingue el canal `LLAMADA`, pero representa un
      registro manual y no contiene evidencia técnica de telefonía.
- [x] No existe una integración SIP, WebRTC, almacenamiento de grabaciones ni
      bus distribuido que deba preservarse.
- [x] La documentación oficial confirma que ARI ofrece control REST de canales
      y puentes y eventos asíncronos por WebSocket.
- [x] La documentación oficial confirma que Asterisk/PJSIP puede terminar
      clientes WebRTC mediante WSS, ICE y DTLS-SRTP.
- [x] La documentación oficial mantiene Asterisk 22 como versión LTS con soporte
      completo previsto hasta octubre de 2028.
- [x] ARI permite grabar el audio mezclado de un puente, necesario para capturar
      ambos participantes de una conversación.
- [x] El carrier fue identificado como una instancia OV500 Class 4 con host SIP
      separado del portal de administración.
- [x] El proveedor informó soporte de autenticación por IP y SIP digest, G.711
      µ-law/A-law, G.729 y DTMF RFC 2833.
- [x] El portal respondió por HTTPS, pero su certificado no encadenó a una raíz
      confiable; no es apto para automatización desatendida en su estado actual.

## Evidencia requerida para aprobar V0

- [ ] INVITE saliente aceptado por el proveedor y audio bidireccional.
- [ ] Caller ID saliente presentado como fue autorizado.
- [ ] DTMF, codecs y causas SIP/Q.850 documentados.
- [ ] Llamada WebRTC estable desde una red corporativa y una red doméstica.
- [ ] Captura de red confirma el transporte y cifrado negociados.
- [ ] Prueba de concurrencia dentro del límite contratado.
- [ ] Matriz de capacidades aprobada por producto y operación.

## Evidencia requerida para aprobar V1

- [ ] Todos los criterios AC-001 a AC-014 automatizados o verificados con
      evidencia reproducible.
- [ ] Prueba de carrera sobre `Idempotency-Key` sin llamadas duplicadas.
- [ ] Pruebas de alcance AGENT/SUPERVISOR/ADMIN/BACKOFFICE.
- [ ] Prueba de reconexión ARI y reconciliación de una llamada activa.
- [ ] Prueba de falla de subida de grabación y reintento seguro.
- [ ] Recalcular SHA-256 del audio contractual descargado y compararlo con el
      manifiesto almacenado.
- [ ] Probar que el original no puede sobrescribirse y que un derivado no lo
      reemplaza.
- [ ] Probar auditoría de reproducción/descarga permitida y rechazada.
- [ ] Auditoría de secretos, logs, URLs firmadas y acceso a grabaciones.
- [ ] Conciliación entre eventos propios, CDR/CEL y reporte del proveedor.
- [ ] Build, tipos, lint, migraciones y pruebas del monorepo sin errores.

## Riesgos abiertos

- La instancia OV500 aún puede no soportar TLS, SRTP o causas suficientes para
  el diseño ideal; las capacidades generales del producto no certifican esta
  instalación particular.
- La credencial compartida por un canal no seguro debe rotarse y no puede
  utilizarse para el laboratorio.
- EasyPanel debe permitir UDP/TCP y un rango RTP explícito; un despliegue pensado
  solo para HTTP no basta para medios en tiempo real.
- La calidad depende de NAT, jitter, auriculares y redes de los asesores, no
  únicamente del código.
- La grabación requiere una política legal y operativa aprobada antes de
  activarse.
- Asterisk es infraestructura con estado en tiempo real; su HA no se obtiene
  simplemente aumentando réplicas de un contenedor.

## Decisión actual

La arquitectura es suficientemente concreta para iniciar V0, pero la SPEC no
puede pasar a `APPROVED` ni generar implementación productiva hasta completar
el contrato del proveedor, las pruebas de laboratorio y la política de
grabación.
