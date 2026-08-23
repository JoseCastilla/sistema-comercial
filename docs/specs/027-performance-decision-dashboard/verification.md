# Verificación — SPEC-027

## Automatizada

- [x] TypeScript de Web y paquetes compartidos.
- [x] Lint de Web y sistema visual.
- [x] 12 pruebas de métricas y períodos de rendimiento.
- [x] La compilación optimizada compila, valida TypeScript y genera las 12
      páginas estáticas.
- [ ] El empaquetado `standalone` no finaliza en Windows porque la cuenta local
      no dispone del permiso para crear el enlace simbólico de `@swc/helpers`.
      No es un error del código ni de tipos; debe comprobarse en el contenedor
      Linux del despliegue antes de publicar.

## Visual

1. Filtros y período anteceden a los indicadores.
2. Los KPIs explican numerador, denominador y alcance.
3. Recupero es clicable y conserva mes/equipo.
4. Cobertura muestra activos, con ventas, sin ventas y promedio.
5. Las filas sin producción son visibles sin usar una alarma estridente.
6. El pulso y el mix permanecen disponibles después de la lectura ejecutiva.
7. La vista continúa siendo legible en tema claro, oscuro y móvil.
8. La matriz asesor × día diferencia días futuros y mantiene visibles el asesor
   y el total durante el desplazamiento horizontal.
9. La vista personal presenta avance diario acumulado y mix comercial del mes.
10. La vista de negocio muestra tendencia y oportunidades de intervención antes
    de los análisis detallados.
11. Acción, éxito y series analíticas conservan significados cromáticos
    diferentes en toda la superficie.

## Evidencia local — 22/08/2026

- Sesión ADMIN validada en `/performance` con datos locales reales.
- 85 ventas ingresadas, 62 entregadas, 57 portabilidades pagables y 15 por
  recuperar se presentan con denominadores explícitos.
- La cobertura detectó 13 vendedores activos, los 13 con ventas, y un promedio
  de 6.5 ventas por vendedor.
- Los accesos de recuperación y activación conservan el período consultado.
- La matriz diaria fue validada con los 13 vendedores activos y 31 días del mes;
  los valores coinciden con el total mensual de cada fila.
- La tendencia diaria revela visualmente la concentración de ventas sin
  confundirla con la curva acumulada.

## Evidencia de identidad visual — 23/08/2026

- Se centralizaron fondos, superficies, texto, interacción, estados y cinco
  series analíticas en los tokens compartidos de UI.
- La primera pantalla fue validada a 1569 × 912: encabezado, filtros, cuatro
  KPIs, tendencia y acciones críticas permanecen visibles sin perder contexto.
- El alto total del dashboard administrativo se redujo de aproximadamente
  3140 px a 2324 px al mantener el análisis detallado colapsado.
- Tema claro validado con acción azul, éxito verde y cierres en turquesa.
- Tema oscuro validado con las mismas relaciones semánticas y sin superficies
  o textos heredados del tema claro.
- Vista móvil validada a 390 × 844 sin desbordamiento horizontal del documento;
  KPIs en dos columnas y zona de decisión en una columna.
- Pedidos y Personas fueron revisados como superficies representativas: ambos
  consumen la nueva identidad central, conservan su jerarquía y no presentan
  desbordamiento horizontal a 1280 px.
- Contraste mínimo medido para colores de texto/acción sobre superficie:
  5.21:1 en claro y 7.02:1 en oscuro, superior al umbral AA para texto normal.
- TypeScript de Web y UI, lint de Web y UI, y `git diff --check` finalizaron sin
  errores usando los binarios locales del proyecto.
