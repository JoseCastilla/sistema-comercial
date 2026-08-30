# SPEC-031 — Consulta de clientes por DNI

## Problema

La consulta RENIEC se ejecuta hoy desde Google Sheets. El token queda embebido
en Apps Script, la ficha completa es dificil de presentar al asesor y el
historial vive fuera del Sistema Comercial.

## Alcance

- Consulta manual de un DNI peruano para cualquier usuario comercial activo.
- Ejecucion de la API exclusivamente en el servidor.
- Cache por organizacion y DNI: una segunda consulta no consume creditos.
- Auditoria de cada acceso exitoso con usuario, fecha y fuente `API` o `CACHE`.
- Ficha orientada a la tarea: datos esenciales visibles y detalles secundarios
  desplegables.

No se actualizan automaticamente contactos, leads ni pedidos existentes. La
instantanea tampoco se refresca automaticamente: hacerlo consumiria un credito
y requiere una politica posterior de vigencia.

## Reglas

- **BR-001:** solo se aceptan ocho digitos; tambien se tolera el sufijo visual
  `-digito` y se consulta unicamente la parte de ocho digitos.
- **BR-002:** el token nunca se envia al navegador ni se almacena en la base de
  datos; se obtiene de `DNI_LOOKUP_API_TOKEN` en el servidor web.
- **BR-003:** la clave de cache es `(organization_id, dni)` para mantener el
  aislamiento multiempresa.
- **BR-004:** dos primeras consultas concurrentes al mismo DNI se serializan;
  solo una alcanza la API externa.
- **BR-005:** cada respuesta exitosa crea un evento de auditoria. Los intentos
  fallidos no crean una ficha incompleta.
- **BR-006:** la respuesta completa se conserva en `raw_payload` y los campos
  usados por la interfaz se normalizan en columnas consultables.
- **BR-007:** la interfaz indica con claridad si la respuesta vino del historial
  y, por tanto, no consumio credito.
- **BR-008:** la vista principal prioriza nombre, distrito de nacimiento y
  nombres de papa y mama. Direccion, vigencia y restriccion permanecen visibles
  con menor jerarquia; el resto de datos civiles y ubigeos son desplegables.
- **BR-009:** cada usuario ve sus consultas exitosas de hoy, del mes y la
  cantidad de DNI distintos del mes. Una lectura desde cache tambien cuenta
  como consulta operativa.
- **BR-010:** el saldo de creditos nunca se envia al navegador de un usuario que
  no sea `ADMIN`. Miguel conserva visibilidad porque su membresia vigente es
  administrativa.
- **BR-011:** el semaforo administrativo es verde desde 200 creditos, amarillo
  entre 100 y 199, y rojo por debajo de 100 con instruccion de recarga.

## Criterios de aceptacion

- **AC-001:** un asesor autenticado puede abrir `/dni` y consultar ocho digitos.
- **AC-002:** la primera consulta encontrada persiste la ficha y registra fuente
  `API`.
- **AC-003:** repetirla devuelve la misma ficha, registra `CACHE` y no llama a la
  API.
- **AC-004:** un DNI invalido o una respuesta no encontrada muestra un error
  comprensible sin persistir datos.
- **AC-005:** el token solo se configura como secreto de entorno.
- **AC-006:** la ficha completa es utilizable en escritorio y movil sin mostrar
  todos los campos a la vez.
- **AC-007:** un asesor puede consultar su actividad pero no encuentra saldo ni
  referencias a creditos en la ficha o en los mensajes de resultado.
- **AC-008:** un administrador ve el ultimo saldo reportado, su fecha y una
  alerta roja cuando es menor que 100.
