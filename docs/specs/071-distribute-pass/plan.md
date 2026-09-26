# SPEC-071 — Plan

- `DistributeRecoveryForm`: selección arriba, bloque «¿A quién van?» con el
  modo elegido (`mode`), filas compactas. Los campos que viajan al servidor
  son los mismos (`caseIds`, `mode`, `targetUserId`, `poolTeamId`,
  `equitableTeamId`, `participantIds`).
- `/recovery/distribute`: línea de cifras, pestañas de población,
  `QueueFilters` con `moreFilters`.
- `QueueFilters`: con `moreFilters`, plan y antigüedad también se pliegan.
- Prueba: `repartir-base.test.tsx`.
