# SPEC-078 — Pedidos con menos palabras

**Estado:** `VERIFICADA` — mejora de presentación, con la autorización de José del 25/09/2026

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

José: «tenemos oportunidades que no estamos logrando ver, por ejemplo "175
entregas fallidas por gestionar" podría ser lo mismo: "175 entregas
fallidas"».

El criterio: una palabra sobra si el lector ya sabe lo que dice, porque lo
dice un control vecino, el contexto o la naturaleza del dato. Se repasó
todo el texto que la pantalla muestra en producción.

## 2. Cambios

| Antes | Después | Por qué sobraba |
|---|---|---|
| «Entregas fallidas por gestionar» | «Entregas fallidas» | Toda entrega fallida está por gestionar |
| Antetítulo «Operación comercial» sobre «Pedidos» | «Pedidos» | El menú ya ubica la pantalla |
| «Período de ventas · Mes actual» junto a los botones | Solo los botones | El botón elegido ya dice el período; el texto queda para un rango o el histórico |
| «Ventas · Mes actual 404» | «Ventas 404» | Ídem |
| «Bandeja operativa · Entregas fallidas por gestionar desde el 10/08» y una frase | «Desde el 10/08, según Máximo · consultado 19:31» | Un solo renglón |
| «Escalaciones de todas las fechas» y una frase de 20 palabras | «De todas las fechas, hasta que supervisión las resuelva» | Ídem |
| «50 pedidos en esta página de 404 encontrados» | «50 de 404 pedidos» | «En esta página» y «encontrados» no agregan nada |
| Equipo: «Mis equipos + sin asignar» | «Todos» | Como el filtro de Asesor |
| Plazo: «Sin horario asignado», «Todavía sin plazo» | «Sin horario», «Sin plazo» | — |
| Plazo en la fila: «Dentro del plazo» | «Vence 17:27» | La hora dice más |
| «En este estado desde hace 5 h» | «Último cambio hace 5 h» | Más corto y más claro |
| Ficha: «Agente» | «Asesor» | Así se llama en todo el sistema |
| Ficha: «Asignación: Asignado» | Solo cuando falta asignar | Lo normal no se anuncia |
| Máximo: «Motivo de rechazo», «Submotivo de rechazo», «Estado de gestión», «Pedido en Máximo» | «Motivo», «Submotivo», «Gestión», «Pedido» | Ya están dentro del recuadro de Máximo |
| «Nota (opcional)» | «Nota» | Ningún campo del paso es obligatorio |
| «Un toque guarda y pasa al pedido de abajo.» | «Guarda y pasa al siguiente.» | — |
| Recupero en el pedido: «CHRISTIAN HUGO RUIZ COTERA» | «Christian R.» | El mismo nombre corto de la lista |
| Vacíos: «Máximo no reporta pedidos con una acción comercial pendiente.» y otros | «Sin entregas fallidas · Máximo no reporta ninguna», «Nada por mover», «Nada por activar», «Nada escalado», «Sin coincidencias» | Corto, y con las vistas nuevas de SPEC-074 |

| Asesor: «Christian R. · HUANCAYO - EL TAMBO» con un solo equipo | «Christian R.» | El equipo solo distingue cuando hay varios |

`PageHeader` acepta ahora el antetítulo como opcional.

## 3. Criterios de aceptación

- **AC-001**: ningún texto de la tabla aparece con su forma anterior en
  producción.
- **AC-002**: cada vista nueva (Por mover, Falta activar, Cerrados) tiene su
  propio vacío.
