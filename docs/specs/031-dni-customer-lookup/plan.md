# Plan — SPEC-031

1. Crear una instantanea RENIEC por organizacion y DNI, mas un evento por cada
   acceso exitoso.
2. Normalizar y probar el contrato externo sin confiar en tipos de la API.
3. Resolver la consulta desde una Server Action autenticada. Usar un advisory
   lock transaccional para cerrar la carrera entre dos misses simultaneos.
4. Exponer `/dni` para todos los roles comerciales y organizar los datos por
   relevancia con divulgacion progresiva.
5. Validar Prisma, pruebas de dominio, tipos, lint y build.

## Configuracion

- `DNI_LOOKUP_API_TOKEN`: token secreto de la API (obligatorio).
- `DNI_LOOKUP_API_URL`: URL opcional; por defecto usa el endpoint RENIEC actual.

El token expuesto anteriormente en Apps Script debe rotarse antes del
despliegue.
