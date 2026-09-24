# Plan — SPEC-058

## Modelo

- `AiAgent` — `organizationId`, nombre, `publishedVersionId`, `draftVersionId`,
  `monthlyBudgetPen`, `enabled`.
- `AiAgentVersion` — configuración (JSONB: identidad, objetivo, tono, debe,
  nunca, datos a reunir, horario), herramientas activas, modelo, esfuerzo,
  `publishedAt`, `publishedByUserId`, `publishReason`, resultado de pruebas.
  Inmutable al publicarse.
- `KnowledgeArticle` y `KnowledgeArticleRevision` — título, contenido,
  `validFrom`, `validUntil`; la versión del agente fija las revisiones usadas.
- `AiAgentExample` — tramo anonimizado, calificación (bueno/malo), nota.
- `AiAgentTestCase` — entrada, expectativas, `critical`.
- `AiAgentTestRun` y `AiAgentTestResult`.
- `AiAgentTurn` — `conversationId`, `agentVersionId`, `model`, artículos,
  llamadas a herramientas (entrada/salida), tokens de entrada, salida y caché,
  costo, `stopReason`. Inmutable.
- `AiAgentFeedback` — respuesta marcada incorrecta con motivo.
- `DeliveryZone` — distritos con reparto (para la herramienta de cobertura;
  se alimenta de la operación AGR).
- `TeamBookingSlotRule` — franjas y cupo por equipo (BR-022).
- Precios: el catálogo de SPEC-061 (`PlanCatalogItem`); ningún precio en
  `KnowledgeArticle`.

## Motor (`apps/api/src/modules/ai-agent/`)

- SDK oficial `@anthropic-ai/sdk` (TypeScript), Messages API con herramientas
  propias definidas con esquema estricto (`strict: true`).
- Orden del prompt para caché por prefijo: herramientas → instrucciones de la
  versión → base de conocimiento vigente → ejemplos (bloque estable con
  `cache_control`) → historial de la conversación → mensaje nuevo.
- La vigencia de artículos se resuelve **por día** para no invalidar la caché
  en cada turno.
- Pensamiento adaptativo con `effort` bajo; `max_tokens` acotado a respuestas
  de WhatsApp.
- Manejo de `stop_reason: "refusal"` con el parámetro de respaldo del
  servidor recomendado para `claude-opus-5`, y derivación a asesor si aun así
  no hay respuesta.
- Bucle de herramientas con tope de iteraciones por turno; cada herramienta
  valida organización, conversación y permisos antes de actuar.
- Anonimización de ejemplos (BR-005) con reglas deterministas (DNI, teléfono,
  nombre del contacto), no con el modelo.

## Evaluación

- Corredor de pruebas en el worker: cada caso se ejecuta contra el borrador
  con herramientas simuladas; las expectativas se verifican con reglas
  (herramienta llamada, texto prohibido, derivación) y, para tono, con un
  juez del mismo proveedor marcado como no crítico.
- El costo de cada corrida se muestra antes de lanzarla.

## Pantallas (`/conversations/agents`)

Lista de agentes → agente con pestañas: Configuración, Conocimiento,
Ejemplos, Herramientas, Pruebas, Simulador, Versiones, Métricas.

## Fases

1. Modelo, motor con herramientas de lectura y derivación, simulador.
2. Conocimiento con vigencia y caché; ejemplos anonimizados.
3. Pruebas, publicación con pruebas y vuelta atrás.
4. Conexión con la bandeja (BR-009, BR-015), evidencia y «¿por qué?».
5. Tope de gasto y métricas.
6. Piloto nocturno en el número nuevo.

## Variables de entorno nuevas

`ANTHROPIC_API_KEY` (solo `apps/api`).
