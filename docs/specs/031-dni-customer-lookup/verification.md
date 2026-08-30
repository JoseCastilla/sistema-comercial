# Verificacion — SPEC-031

Estado: IMPLEMENTADO · ACTIVACION PENDIENTE

## Evidencia automatizada

| Comprobacion                        | Resultado                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------- |
| Generacion Prisma 7.9.1             | Correcta; reconoce `DniPersonSnapshot` y `DniLookupEvent`                  |
| Build de `@repo/database`           | Correcto                                                                   |
| Suite `@repo/validation`            | 176 pruebas correctas; 10 pertenecen al contrato DNI                       |
| Tipos de `apps/web`                 | Correctos                                                                  |
| ESLint de `apps/web`                | Correcto, cero advertencias                                                |
| ESLint de `@repo/validation`        | Correcto, cero advertencias                                                |
| Next.js 16.2                        | Compilacion, tipos y 17 paginas estaticas correctas                        |
| Empaquetado `standalone` en Windows | Bloqueado por `EPERM` al crear un symlink de `@swc/helpers`; no por codigo |

## Cobertura funcional

- Normalizacion de ocho digitos y del sufijo visual `DNI-digito`.
- Preservacion de ceros iniciales.
- Rechazo de una respuesta perteneciente a otro DNI.
- Distincion entre no encontrado y respuesta malformada.
- Mapeo de identidad, direccion, registro, familiares, ubigeos y creditos.
- Calculo de edad independiente de la zona horaria del servidor.
- Semaforo probado en los limites 99 (rojo), 100 y 199 (amarillo), y 200
  (verde), ademas del estado sin saldo reportado.
- Cache aislada por organizacion, auditoria por usuario y advisory lock para
  evitar dos consumos simultaneos del mismo DNI.
- La accion elimina `creditsAtFetch` del DTO de persona; solo construye el saldo
  administrativo cuando la membresia es `ADMIN`.
- Cada usuario recibe conteos de hoy, mes y DNI distintos del mes a partir de
  `dni_lookup_events`; los accesos por API y cache cuentan por igual.

## Pendiente operativo

### Activación local — 29/08/2026

- La migración `20260829010000_add_dni_lookup_cache` quedó aplicada en
  `sistema_comercial` local (`127.0.0.1:5433`).
- El token actual quedó únicamente en `.env.development.local`, ignorado por
  Git. Sigue siendo obligatorio rotarlo antes de producción.
- La Web quedó ejecutándose en `http://localhost:3100`.
- `/api/health` respondió `200`.
- `/dni` respondió `307` hacia `/login` sin sesión, como corresponde.
- La pantalla de ingreso se verificó visualmente en el navegador integrado.
- Con una sesión de asesor, `/dni` mostró 2 consultas de hoy, 2 del mes y 1 DNI
  distinto; no mostró saldo, créditos ni el panel administrativo.

No se consumió un crédito real durante la verificación automatizada. El smoke
test API/cache queda en manos del usuario porque requiere ingresar un DNI real
autorizado. Para activar en producción:

1. Rotar el token que estuvo embebido en Apps Script.
2. Configurar `DNI_LOOKUP_API_TOKEN` en el servicio Web; opcionalmente configurar
   `DNI_LOOKUP_API_URL` si cambia el endpoint.
3. Aplicar la migracion `20260829010000_add_dni_lookup_cache`.
4. Consultar un DNI autorizado y repetirlo: la primera respuesta debe indicar
   API y la segunda `Historial · 0 creditos`.
