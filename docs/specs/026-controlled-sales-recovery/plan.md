# Plan — SPEC-026

1. Modelar el caso de recupero, gestiones y vínculo con una nueva orden sin
   duplicar ni reabrir la original.
2. Implementar creación automática desde cancelaciones y no entregados.
3. Implementar permisos y trazabilidad de creación, asignación y resolución.
4. Añadir “Enviar a recupero” en la tarjeta de pedido para excepciones manuales.
5. Evolucionar la bandeja actual con prioridad, responsable, antigüedad y
   próxima acción.
6. Añadir reasignación supervisada y toma atómica dentro de un equipo de
   recuperación autorizado.
7. Implementar resultados `RECOVERED` y `LOST`, con motivos obligatorios.
8. Añadir métricas de velocidad, recuperación y pérdida frente a otra agencia.
9. Validar migración, concurrencia, roles y experiencia local antes de publicar.
