# @repo/ui — Arquitectura visual

Este paquete es la única fuente compartida de decisiones visuales de la
plataforma. No contiene reglas comerciales ni depende de rutas de Next.js.

## Capas

```text
src/styles/
├── tokens.css       colores, radios, elevación, foco y movimiento
├── foundations.css  comportamiento global accesible
├── patterns.css     clases internas usadas por las primitivas
└── index.css        única entrada pública de estilos

src/
├── page-header.tsx  encabezado y contexto de página
├── surface.tsx      superficie estructural
├── metric.tsx       resumen cuantitativo
├── empty-state.tsx  ausencia de información o resultados
├── field.tsx        campos y controles de formulario
├── feedback.tsx     respuesta persistente de acciones
├── section-panel.tsx estructura de secciones
├── state-panel.tsx  carga, conflicto y permisos
└── confirm-submit-button.tsx confirmación destructiva
```

## Dependencias permitidas

```text
tokens → estilos base → primitivas UI → patrones de feature → páginas
```

Una capa nunca importa una capa situada a su derecha. `@repo/ui` no conoce
pedidos, equipos, usuarios, DITO ni roles.

## Reglas para nuevas interfaces

1. Una página compone componentes; no crea un sistema visual propio.
2. Un valor repetido de color, radio o sombra se convierte en token semántico.
3. Un patrón repetido dos veces se evalúa como primitiva o patrón de feature.
4. Las variantes expresan intención (`danger`, `raised`), no colores concretos.
5. Tailwind sigue permitido para composición excepcional y responsive local;
   no para copiar bloques visuales completos entre archivos.
6. Los componentes interactivos complejos usarán Radix Primitives antes de
   implementar manualmente foco, teclado y atributos ARIA.
7. TanStack Table se reserva para bandejas con comportamiento de tabla real.
8. Todo componente define estados de foco, deshabilitado, error y movimiento
   reducido cuando correspondan.

## Consumo

La aplicación importa una sola hoja global:

```css
@import "@repo/ui/styles.css";
```

Los componentes se importan individualmente para preservar límites claros:

```tsx
import { PageHeader } from "@repo/ui/page-header";
```

## Criterio de promoción

- Específico de un dominio: `apps/web/src/features/<dominio>`.
- Reutilizable y sin conocimiento del dominio: `packages/ui`.
- Decisión de marca o tema: token CSS, nunca clase duplicada en páginas.
