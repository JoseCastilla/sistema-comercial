# Workflows n8n

## Seguimiento de ventas DITO v2

El archivo `MOVISTAR-03-seguimiento-ventas-dito-v2.json` es una copia importable
del workflow productivo con soporte para la identidad de la extensión 2.0.

La copia se entrega inactiva deliberadamente porque conserva el mismo path de
webhook `ventas-televentas`.

### Sustitución segura

1. Importar el workflow v2 en n8n.
2. Verificar que las credenciales de Google Sheets y del header de la API estén
   vinculadas correctamente.
3. Ejecutar una prueba manual con una extensión antigua y confirmar envelope 1.0.
4. Ejecutar una prueba con extensión 2.0 y confirmar `submitted_by`.
5. Desactivar el workflow productivo anterior.
6. Activar inmediatamente el workflow v2.
7. Confirmar que Sheets y la API reciben la misma venta de prueba.

No deben permanecer activos dos workflows con el mismo path de webhook.

### Compatibilidad

- Sin `body.extension`: genera envelope 1.0.
- Con identidad válida: genera envelope 2.0.
- Con bloque de identidad presente pero inválido: conserva la rama de Sheets,
  marca advertencias y no envía a la API.
