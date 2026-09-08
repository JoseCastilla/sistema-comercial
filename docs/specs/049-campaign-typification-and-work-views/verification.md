# SPEC-049 — Verificación

Sin evidencia todavía: la spec está en `BORRADOR`. Fija qué se comprueba y
cómo, para que cada casilla de `tasks.md` tenga su prueba.

## Lista de validación de la propuesta

Con una cuenta de asesor de prueba ficticia; nunca con una persona real.

1. Guardar una agenda retira el caso de Trabajar ahora y lo muestra en Mi
   agenda a su hora (AC-001): pendiente.
2. Un teléfono errado queda tachado, el siguiente pasa a primero y el caso
   sigue trabajable; con todos errados pasa a Por completar (AC-002):
   pendiente.
3. Una aceptación sin orden permanece visible en Por completar; vincular la
   orden la lleva a Historial (AC-003): pendiente.
4. Una verificación desmentida devuelve el caso con «Devuelto de
   verificación: sigue portable», quién y cuándo (AC-004): pendiente.
5. Un caso aparecido hoy se ordena sobre uno de hace tres días; una cita
   vencida sobre ambos (AC-005): pendiente.
6. Una rectificación no incrementa intentos, conserva el original y deja
   autor, motivo y momento (AC-006): pendiente.
7. Bandeja, ficha y agenda muestran la misma siguiente acción (AC-007):
   pendiente.

## Por fase

| Fase | Comprobación | Cómo | Resultado |
|---|---|---|---|
| 1 | Cada resultado ofrecido tiene consecuencia declarada y `CANCELADO` no se ofrece; no contesta sigue la cadencia; interesado con hora crea cita, con fecha seguimiento, sin nada cadencia; no interesado pausa; no contactar y aceptar van a Por completar; número errado marca el teléfono y sin válidos va a Por completar; no cumple antigüedad espera solo sin otra línea trabajable; tiene pedido es seguimiento ordinario; impedimento no es rechazo; campos requeridos por resultado; vista previa sin datos del servidor | `packages/validation/test/recovery-attempt-consequences.test.mjs` | **En verde** (08/09/2026): 9 pruebas, 357 en el paquete. |
| 1 | El formulario abre sin resultado y no guarda sin elegir; la tecla N elige «No contesta» y muestra la consecuencia; «No interesado» muestra la pausa y «pausado hasta»; «Pide que no lo llamen» exige la observación; «Interesado» pregunta qué sigue y con llamada acordada pide la hora; «Cancelado» no se ofrece (AC-008) | `apps/web/src/__tests__/campanas-gestion-en-fila.test.tsx` | **En verde** (08/09/2026): 6 pruebas nuevas, 18 en el archivo, 214 en la web; tipos y lint de web y api limpios. |
| 1 | «No cumple antigüedad» con fecha informada la guarda como informada y calcula la habilitación; sin fecha deja la tarea (AC-009) | recorrido y consulta a `recovery_case_services` | pendiente |
| 1 | Producción: distribución de `reason` en `SIN_RESPUESTA` y teléfonos marcados | consulta tras el despliegue | pendiente |
| 2 | Un caso abierto está en exactamente una vista; los contadores suman la cartera abierta más 30 días de resueltos (AC-011) | pruebas puras y lectura de producción | pendiente |
| 2 | Orden de Trabajar ahora: citas vencidas, habilitaciones, devueltos, recientes primero | prueba pura | pendiente |
| 3 | «Guardar y siguiente» avanza solo tras confirmación; doble envío sin duplicado; caso ajeno devuelve «actualiza la cola» sin perder el borrador (AC-010) | prueba de componente y recorrido con dos pestañas | pendiente |
| 4 | `effectiveAttempts`: la cadencia, la cobertura y las puertas leen el resultado efectivo; la rectificación no cuenta como contacto | pruebas puras | pendiente |
| 4 | Ventana de rectificación por rol en hora de Lima; caso resuelto no se rectifica | pruebas puras y recorrido | pendiente |
| 5 | La consulta de discrepancias no cambia nada; la vista de Seguimiento enlaza a la ficha | lectura de producción y recorrido con supervisor | pendiente |
