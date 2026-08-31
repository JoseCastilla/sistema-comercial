# Matriz de proveedor — OV500 / troncal outbound

**Estado:** `PARTIAL — REQUIERE CERTIFICACIÓN V0`
**Fecha de revisión:** 2026-08-31

Este documento conserva únicamente información técnica no secreta. Las
credenciales recibidas por un canal no seguro se consideran comprometidas, no
se copian al repositorio y deben rotarse antes del laboratorio.

## Identificación

| Capacidad | Dato conocido | Estado |
| --- | --- | --- |
| Plataforma | OV500 Softswitch Class 4 | Informado por proveedor |
| Rol esperado | Terminación/originación SIP y tarificación | Compatible con outbound |
| Portal de gestión | `https://45.92.19.102/` | Responde; certificado no confiable públicamente |
| Host SIP | `45.92.19.109` | Informado por proveedor |
| Puerto SIP | `5060` | Informado; transporte por confirmar |
| Autenticación digest/registro | Disponible | Credencial debe rotarse |
| Autenticación por IP | Disponible | Preferida para producción |
| DTMF | RFC 2833 | En PJSIP se configura como `rfc4733` |
| Codecs | G.711 µ-law, G.711 A-law, G.729 | Informado; orden real por probar |
| Qualify/OPTIONS | Sugerido por proveedor | Por probar |
| NAT simétrico | Configuración heredada sugiere que sí | Por certificar |
| Caller ID | No informado | Bloqueante V0 |
| Formato de destino | No informado | Bloqueante V0 |
| Canales concurrentes | No informado | Bloqueante piloto |
| CPS | No informado | Bloqueante piloto |
| IP/rango RTP remoto | No informado | Bloqueante de firewall |
| Causas SIP/Q.850 | No informado | Por probar |
| TLS/SRTP | No informado | Por confirmar |

OV500 publica que su plataforma se apoya en Kamailio, FreeSWITCH y RTPProxy y
admite autenticación por IP y usuario SIP. Esto describe capacidades generales
del producto; la instancia del proveedor debe certificarse de forma separada.

Referencias:

- [Repositorio oficial OV500](https://github.com/openvoips/OV500)
- [Introducción oficial de OV500](https://ov500.openvoips.org/documentation/ov500-switch-introduction-and-documentation/)

## Decisión de autenticación

### Producción: IP whitelisting

Es la alternativa preferida si el servidor de voz dispone de una IP pública
fija y exclusiva:

- el proveedor autoriza únicamente esa IP como origen;
- Asterisk identifica el carrier por la IP SIP exacta;
- el firewall admite señalización solo desde/hacia las IP acordadas;
- no se requiere `REGISTER`, salvo que el proveedor lo imponga por otra regla;
- cualquier secreto residual se rota y se guarda fuera del repositorio.

IP whitelisting autentica el origen, pero no cifra la señalización ni el audio.
TLS/SRTP son decisiones independientes que el proveedor debe confirmar.

### Laboratorio temporal: SIP digest

Solo si todavía no existe una IP pública fija. Requiere una credencial nueva,
administrada como secreto de despliegue. El archivo de PJSIP versionado usa
placeholders o generación de configuración y jamás contiene la contraseña.

## Traducción conceptual a PJSIP

La muestra recibida usa `chan_sip`, retirado del diseño. La equivalencia base
para autenticación por IP es:

```ini
; Ejemplo documental: no es todavía configuración productiva.
[ov500-carrier]
type=endpoint
transport=transport-udp
context=from-ov500
disallow=all
allow=ulaw,alaw
dtmf_mode=rfc4733
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
aors=ov500-carrier

[ov500-carrier]
type=aor
contact=sip:45.92.19.109:5060
qualify_frequency=30

[ov500-carrier-identify]
type=identify
endpoint=ov500-carrier
match=45.92.19.109
```

La configuración final necesita transporte confirmado, IP pública local,
rangos de red, caller ID, formato de marcación y resultados del laboratorio.

### Decisiones del ejemplo

- Se comienza con G.711 (`ulaw`, `alaw`) para evitar depender de un módulo G.729
  y reducir transcodificación en el primer laboratorio.
- `direct_media=no` mantiene el RTP en Asterisk, condición necesaria para
  grabación, DTMF, métricas y supervisión posterior.
- `rfc2833` se denomina `rfc4733` en PJSIP moderno.
- `nat=yes` no se copia como una bandera global; se expresa mediante
  `rtp_symmetric`, `force_rport` y `rewrite_contact`, y se valida con captura.
- `insecure=very` no tiene traducción aceptable. La identidad se restringe con
  `identify`, ACL y firewall.

Referencias primarias:

- [Migración de chan_sip a PJSIP](https://docs.asterisk.org/Configuration/Channel-Drivers/SIP/Configuring-res_pjsip/Migrating-from-chan_sip-to-res_pjsip/)
- [PJSIP detrás de NAT](https://docs.asterisk.org/Configuration/Channel-Drivers/SIP/Configuring-res_pjsip/Configuring-res_pjsip-to-work-through-NAT/)
- [Registro saliente PJSIP](https://docs.asterisk.org/Configuration/Channel-Drivers/SIP/Configuring-res_pjsip/Configuring-Outbound-Registrations/)
- [ACL de PJSIP](https://docs.asterisk.org/Latest_API/API_Documentation/Module_Configuration/res_pjsip_acl/)

## Hallazgo sobre el portal HTTPS

El 31/08/2026 el portal respondió `200 OK` mediante nginx al omitir la
validación del certificado. La validación normal falló con una raíz no
confiable. Consecuencias:

- no automatizar login ni API con `curl -k` o validación TLS deshabilitada;
- solicitar un hostname cuyo certificado tenga una cadena pública válida, o
  la CA privada y procedimiento formal de rotación;
- tratar el portal como administración humana hasta que exista documentación
  de API y autenticación independiente.

La troncal SIP no depende de que integremos el portal web. Para V1 basta la
interconexión SIP y nuestra propia conciliación de CDR; una API OV500 puede
evaluarse después.

## Preguntas concretas para el proveedor

1. ¿El puerto `5060` usa UDP, TCP o ambos? ¿Ofrecen SIP-TLS y SRTP?
2. Para IP whitelisting, ¿qué IP pública debemos autorizar y qué IPs/CIDR de
   señalización y RTP debemos permitir nosotros?
3. ¿Cuál es el rango de puertos RTP del proveedor?
4. ¿Debemos enviar destinos como `51XXXXXXXXX`, `+51XXXXXXXXX` o con prefijo
   técnico adicional?
5. ¿Qué caller IDs están autorizados y en qué headers esperan `From`, PAI y RPID?
6. ¿Cuántos canales simultáneos y cuántos intentos por segundo admite la cuenta?
7. ¿Cuál codec prefieren y admiten G.711 sin transcodificación hasta PSTN?
8. ¿Envían early media (`183`), `180 Ringing` y causas Q.850 confiables?
9. ¿Qué intervalo de SIP OPTIONS recomiendan?
10. ¿Disponen de CDR exportable/API y cuál es la zona horaria de sus registros?
11. ¿Pueden asignar un hostname y certificado HTTPS confiable al portal/API?

## Criterio de salida de V0 con este carrier

- IP whitelisting configurado en ambos extremos, o digest nuevo solo para el
  laboratorio.
- INVITE outbound en formato acordado y caller ID correcto.
- Audio bidireccional con G.711 y DTMF RFC 4733.
- Estados `100/180|183/200` y BYE observables, con causa final persistida.
- Grabación completa del puente y hash reproducible después de descargar.
- CDR propio conciliable con el CDR de OV500.
- Prueba controlada de límites sin exceder canales/CPS contratados.

