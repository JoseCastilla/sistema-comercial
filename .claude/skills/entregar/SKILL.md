---
name: entregar
description: Entrega un cambio ya terminado — verifica, commitea en rama, integra en main y publica, todo con un comando. Úsala cuando el usuario diga "despliega", "llévalo a producción", "entrégalo" o "súbelo". No la uses para trabajo a medias.
---

# Entregar un cambio

Toda la secuencia vive en `scripts/entregar.sh`. **Un solo comando**, no diez:
cada llamada de herramienta reenvía la conversación entera, así que encadenar
`git checkout`, `commit`, `push`, `merge` y `push` a mano cuesta lo mismo que
implementar una función pequeña, y no aporta nada.

## Antes de llamarlo

1. **Registra el trabajo en `docs/specs/<incremento>/`** — `tasks.md` con la
   tarea y `verification.md` con la evidencia y sus limitaciones. En este repo
   nada está terminado sin eso, y va dentro del mismo commit.
2. Si corrige algo que ya entregaste, **corrige también lo que registraste**:
   dejar descrita una versión que ya no existe es peor que no describirla.

## El comando

```bash
./scripts/entregar.sh <rama> <<'MSG'
tipo(area): el título en una línea, en español

El porqué del cambio: qué no funcionaba y qué decide ahora.
MSG
```

El script **no vuelca la salida de las herramientas**: en verde imprime una
línea por etapa, y solo si algo falla enseña las últimas 40 líneas y dónde
está el registro completo. Volcar los miles de caracteres de turbo gastaría
en ruido justo lo que este script viene a ahorrar.

Verifica (`pnpm test`, `lint`, `check-types`), crea la rama,
commitea con el `Co-Authored-By`, publica la rama, integra en `main` con
`--no-ff`, **vuelve a verificar sobre main ya integrado** y publica `main`.
Si algo falla, se detiene: `set -e`.

Opciones: `--solo-rama` para dejarlo en revisión sin tocar `main`;
`--sin-verificar` solo para cambios que no son código.

## Lo que el script no hace

**No actualiza el servidor de producción.** El repositorio no tiene pipeline:
publicar en `main` es hasta donde llega. Dilo así al terminar, sin dar por
desplegado lo que solo está en GitHub.
