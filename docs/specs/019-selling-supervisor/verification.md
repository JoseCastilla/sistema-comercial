# Verificación

## Evidencia automatizada

- Prisma Client generado correctamente.
- `@repo/validation`: 118 pruebas aprobadas.
- `apps/web`: verificación TypeScript aprobada.
- `apps/api`: verificación TypeScript aprobada.
- API DITO: 15 pruebas aprobadas en asociación por correo, vista previa y
  confirmación de importaciones.
- ESLint aprobado en web, API y validación.
- Esquema Prisma válido y base local con las 25 migraciones al día.
- Recorrido administrativo aprobado en `/orders`, `/admin/teams`,
  `/admin/users` y `/performance`; todas respondieron correctamente.

## Casos de seguridad cubiertos

- Supervisor vendedor ve una orden propia de su equipo anterior.
- Supervisor vendedor no puede cerrar su propia orden.
- Supervisor vendedor solicita, pero no aplica, su propia cancelación.
- La asignación automática acepta SUPERVISOR solo con venta primaria activa.
- Un usuario sin capacidad comercial no recibe nuevas ventas.

## Pendiente operativo

Crear o elegir un asesor de prueba, ejecutar la promoción y enviar una captura
de prueba por su correo antes de autorizar producción. La interfaz administrativa
y sus consultas ya fueron verificadas.
