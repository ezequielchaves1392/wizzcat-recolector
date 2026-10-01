---
description: Sigue el plan de trabajo de docs/PENDIENTES.md
---

Sigue el plan de trabajo.

Lee `docs/PENDIENTES.md` entero, en especial el apartado **Plan de trabajo**, y
haz el paso que toque según ese plan. Si el plan y la lista no coinciden, gana el
plan: está ahí para no empezar por lo que toca primero en el fichero, sino por lo
que desbloquea lo demás.

Empieza por estos pasos, en orden, y **no los saltes**:

1. Lee el plan y las ideas de `PENDIENTES.md`.
2. `git status` y `LastWriteTime` de `src/**/*.ts` y `verify/*.ts`: si hay otro
   agente trabajando en el mismo fichero, **no lo edites**, dilo y para.
3. `npm run build` y `npm run verify` para tener la línea base. Ahora son **19
   bancos, 1293 pruebas** (el total varía ±1: `playthroughCheck` tiene un `check()`
   condicional).
4. Haz **un** paso. No dos, no "de paso" nada más.

Cuando termines:

- `npm run build` + `npm run verify`, los dos.
- Si tocaste economía o guardado: **una prueba nueva** en el banco que
  corresponda.
- Actualiza `docs/PENDIENTES.md`: lo hecho se mueve a **Hecho** con su commit, y
  **lo que descubrieras haciendo otra cosa se añade al final** de "Tareas
  añadidas durante el trabajo".
- Si el plan cambió (porque un paso te dio información que invalida el siguiente),
  actualiza el apartado **Plan de trabajo** y di por qué.
- Commit con el estilo del proyecto: imperativo, alcance declarado, el porqué, y
  qué se comprobó y cómo.