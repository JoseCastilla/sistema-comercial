# SPEC-039 — Lenguaje visual del Sistema Comercial

**Estado:** `DRAFT`
**Versión:** 1.1
**Fecha:** 2026-09-01
**Responsable de producto:** José Castilla

## 1. Origen

José construyó Workflow Delivery (`recuperos-movistar-tdp.netlify.app`), su
módulo de reagendamiento de ventas, y su estilo es la referencia para la
plataforma: **denso sin sobrecargar, sin mensajes redundantes, con la
información una sola vez**. Esta spec no copia sus rasgos: identifica los
principios que los hacen funcionar (medidos y analizados el 01/09/2026) y
deriva de ellos las reglas. Cuando una pantalla futura plantee un caso que
las reglas no cubren, se decide desde el principio, no por imitación.

## 2. Principios — por qué funciona

- **P-1 · La frecuencia de uso invierte la jerarquía.** Un título enorme
  orienta al visitante nuevo; un operador que abre la vista 50 veces al día
  solo necesita confirmación. El peso visual se asigna al valor de decisión
  (el número que se mira, la alerta que se atiende), no a la estructura del
  documento. Corolario: la densidad es proporcional a la frecuencia de uso —
  la cola del asesor se optimiza para el uso número 50; la configuración
  del admin, para el uso número 1.
- **P-2 · Cada canal visual codifica una sola cosa.** Tamaño = importancia;
  mayúsculas pequeñas con peso = andamiaje (etiquetas, estructura);
  monoespaciada = dato del mundo real; color = estado, y nada más. Con los
  canales disciplinados, el usuario decodifica sin leer: entrecerrando los
  ojos ve los datos, mirando de cerca aparece la estructura. El color solo
  puede gritar porque casi nunca habla; la monoespaciada es una señal de
  categoría ("carga útil, no interfaz") que permite eliminar etiquetas.
- **P-3 · Economía de confianza del texto.** Cada palabra redundante entrena
  al usuario a saltarse palabras, y quien aprende a saltar se salta también
  la que importaba. Cada dato vive en exactamente un lugar; así leer nunca
  es en vano y todo lo escrito se sigue leyendo.
- **P-4 · Unidad de pensamiento = unidad de layout.** Lo que se decide junto
  se muestra junto: un KPI y su comparador ("Objetivo ≥ 95%") en la misma
  fijación de la vista; los estados anexos (riesgo, demora) como chips
  dentro de la tarjeta cuya pregunta responden. Tarjetas separadas implican
  preguntas separadas.
- **P-5 · Memoria muscular sobre lectura.** El operador diario no lee la
  interfaz: la opera por memoria espacial. Filtros idénticos en todas las
  vistas y opciones visibles (botones segmentados) comparten la raíz:
  mostrar estado cuesta píxeles; esconderlo cuesta clics, memoria y una
  relectura por visita.

## 3. Evidencia medida en la referencia

Tipografía computada en el navegador el 01/09/2026:

| Elemento | Referencia | Sistema Comercial hoy |
|---|---|---|
| Título de página | ~20px, peso 800 | **32.6px** |
| Título de sección | 14px, peso 800, MAYÚSCULAS + icono | 15.2px, peso 700 |
| Etiqueta de campo/KPI | 10px, peso 700, MAYÚSCULAS, atenuada | 11.2px similar |
| Datos e inputs | 12px monoespaciada | 14px sans (mono solo en líneas) |
| Navegación | 14px, peso 700 | 16px, peso 400 |

Composición observada: tarjeta por grupo con encabezado de una línea; KPI =
etiqueta + número grande mono + una línea de contexto con chips de estado
integrados; barra de filtros idéntica entre vistas; contadores como badge
junto al título; estado vacío de dos líneas; un solo callout de guía por
pantalla, con ejemplo concreto; SLA y hora una sola vez, en la barra del
sidebar; color únicamente semántico.

## 4. Lo que se adopta con corrección — análisis, no copia

- **Piso tipográfico 11px, no 10px.** La referencia vive en un monitor
  conocido; la plataforma tiene asesores en móvil y pantallas variadas. El
  principio (subordinar el andamiaje, P-2) se cumple igual con un punto más
  de margen de legibilidad.
- **Una sola familia tipográfica** (decidido el 01/09/2026 al verlo
  aplicado). La referencia usa monoespaciada para datos e inputs; en el
  Sistema Comercial esa segunda familia se leía como un cuerpo extraño
  dentro de la pantalla. El canal de P-2 se conserva con otros medios
  —cifras tabulares, alineación a la derecha, etiqueta pequeña—, que
  distinguen el dato sin fracturar la página. La monoespaciada queda donde
  el carácter individual importa: números de línea, DNI copiables y las
  listas de configuración.
- **Densidad por frecuencia, no densidad uniforme.** La referencia tiene un
  solo tipo de usuario; la plataforma tiene varios (P-1, corolario). La cola
  del asesor merece la densidad máxima; una pantalla de configuración puede
  respirar.

## 5. Reglas

- **BR-001 (P-1):** el título de página baja a escala compacta (≈20–22px) y
  cede el protagonismo al contenido; la descripción bajo el título es una
  sola línea.
- **BR-002 (P-3):** cada `SectionPanel` lleva a lo sumo una línea de
  descripción; si la explicación ya vive en el botón, el tooltip o el estado
  vacío, no se repite. Ninguna información aparece dos veces en la misma
  pantalla.
- **BR-003 (P-2)** (revisado el 01/09/2026): la plataforma conserva **una
  sola familia tipográfica**, la de la interfaz. Los datos operativos en
  tablas y cifras usan `font-variant-numeric: tabular-nums` para que las
  columnas alineen, pero **no** cambian de familia: al probarlo, la
  monoespaciada introducía una tipografía ajena que competía con el resto
  de la pantalla. La monoespaciada se reserva para lo que ya la usaba y
  donde el carácter individual importa —números de línea, DNI copiables y
  las listas de configuración—, no para todo dato tabular. El canal de
  P-2 que distingue "dato" de "interfaz" lo sostienen el peso, la
  alineación a la derecha y la etiqueta pequeña.
- **BR-004 (P-2):** etiquetas de campos y KPI en 11px, peso fuerte,
  mayúsculas, color atenuado, uniforme en toda la plataforma.
- **BR-005 (P-4):** los KPI usan etiqueta + número grande monoespaciado +
  una línea de contexto con objetivo o delta; los estados asociados son
  chips dentro de la misma tarjeta.
- **BR-006 (P-5):** la barra de filtros usa el mismo orden y componentes en
  todas las vistas que filtran (bandeja, triage, distribución, rendimiento).
- **BR-007 (P-5):** una elección de dos o tres opciones se presenta como
  botones segmentados con el estado visible, no como select desplegable.
- **BR-008 (P-3):** los estados vacíos son dos líneas: qué no hay y qué
  acción lo produce, con su enlace.
- **BR-009 (P-3):** máximo un callout de guía por pantalla, con ejemplo
  concreto; se elimina todo texto que repita lo que otro elemento ya dice.
- **BR-010 (P-2):** el color es solo semántico — verde correcto, ámbar
  riesgo, rojo vencido — sobre base neutra. El modo oscuro se conserva
  (SPEC-018): estas reglas gobiernan escala, densidad y jerarquía, no la
  paleta.
- **BR-011 (P-1):** la densidad se calibra por frecuencia de uso de la
  vista: máxima en las colas operativas diarias, relajada en configuración
  y administración ocasional.
- **BR-012 (P-3)** (01/09/2026): una columna cuyas celdas dicen todas lo
  mismo no se muestra. No informa, ocupa ancho y obliga a leerla para
  descubrir que no aporta nada — "Equipo: sin equipo" repetido en 250 filas
  del triage es ruido, no dato. La columna aparece sola en cuanto empieza a
  distinguir. Vale para toda tabla con columnas que solo se llenan en una
  etapa posterior del flujo.

## 6. Alcance de aplicación

Primera pasada sobre las superficies de mayor uso diario, en este orden:

1. **Preparar campaña (`/admin/recovery-base`) — aplicado el 01/09/2026.**
   Cada formulario ocupaba el ancho completo con su botón a página entera;
   ahora carga de base y cruce de portabilidad caben en una línea
   (`.ui-form-row`), las cifras del lote son una tira compacta con número
   monoespaciado, las tablas alinean sus números a la derecha en
   monoespaciada con fecha de 24 horas, los filtros pasan a rejilla de dos
   columnas y se retiraron las explicaciones duplicadas. Siete paneles
   quedaron en cuatro.
2. Campañas: triage, distribución y cola del asesor.
3. Bandeja de pedidos y rendimiento.
4. Administración (importaciones, logística, personas, equipos).

### Piezas compartidas creadas

- `.ui-form-row` / `.ui-form-row__grow` / `.ui-form-row__fixed`: acción de
  una línea que se apila sola en móvil (BR-001).
- `.ui-label-eyebrow`: etiqueta de andamiaje en 11px, versales, atenuada
  (BR-004).
- `.ui-data`: dato operativo en monoespaciada con cifras tabulares (BR-003).
- `.ui-file-input`: selector de archivo compacto y legible en ambos temas.

## 7. Criterios de aceptación

- **AC-001:** ninguna página repite la misma explicación en dos elementos.
- **AC-002:** las columnas de números alinean por cifras tabulares y ninguna
  vista introduce una familia tipográfica distinta a la de la interfaz.
- **AC-003:** títulos de página en escala compacta y etiquetas en 11px en
  toda la plataforma.
- **AC-004:** las barras de filtro de las vistas listadas comparten orden y
  componentes.
- **AC-005:** la verificación visual se hace en claro y oscuro, y en móvil
  para la cola del asesor.

## 8. Fuera de alcance

- Rediseñar la marca, la paleta o el sistema de temas.
- Copiar componentes exactos de la referencia; se adoptan sus principios.
