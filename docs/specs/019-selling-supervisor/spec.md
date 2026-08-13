# SPEC-019: Supervisor que también vende

## Estado

IMPLEMENTED, pendiente de verificación operativa local y despliegue.

## Problema

Un asesor promovido a supervisor pierde la asignación automática de nuevas
ventas, su bandeja personal y su lectura individual de rendimiento. Si solo se
cambia el rol también puede cerrar sus propias ventas, debilitando la separación
de funciones.

## Decisión

La autoridad se conserva en `OrganizationMember.role`; la capacidad comercial
se expresa con `CommercialTeamMember.salesEnabled`. No se crea un rol combinado.

## Reglas

- Todo asesor activo tiene una única membresía comercial primaria activa.
- Un supervisor puede tener `salesEnabled=true` en su equipo principal.
- El correo corporativo de un supervisor vendedor continúa resolviendo asesor y
  equipo para extensión, importación y asignación manual.
- Un supervisor vendedor ve sus ventas históricas y nuevas, además de sus
  equipos supervisados y el pool permitido.
- Nunca puede cerrar, cancelar o aprobar la cancelación de su propia venta.
- Puede solicitar cancelación de sus propias ventas y operar estados no
  terminales.
- Puede alternar en Rendimiento entre `Mi rendimiento` y `Mi equipo`.
- Retirar `salesEnabled` no altera ventas ni métricas históricas.

## Criterios de aceptación

1. La promoción y activación comercial ocurren en una transacción.
2. La siguiente venta recibida por correo queda asignada al supervisor vendedor.
3. Sus ventas previas siguen visibles.
4. El servidor rechaza cierre y cancelación directa de una venta propia.
5. La bandeja permite solicitar cancelación propia.
6. Rendimiento ofrece ambas vistas sin mezclar comisiones personales y equipo.
