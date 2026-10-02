---
description: Lista los pendientes de docs/PENDIENTES.md para que el jugador elija
---

**El jugador elige. No elijas tú.**

Este comando **no hace trabajo**: enseña la lista de pendientes y para. El jugador
dice cuál sigue, y entonces se ejecuta ese con `/feature`, `/bug` o lo que toque.

## Qué hacer

1. Lee `docs/PENDIENTES.md` — el corto. `docs/PENDIENTES-ARCHIVO.md` es el
   historial largo y **no hace falta para listar**.

2. Presenta el listado **con estas cuatro cosas delante**, que es lo que hace falta
   para decidir:

   - **Qué es** cada pendiente, en una línea.
   - **Qué falta para hacerlo**: si es tuyo (una decisión, un número, un "sí"), o si
     se puede programar tal cual.
   - **Qué desbloquea**, y **qué lo bloquea**. Si algo depende de otra cosa que aún
     no está, dilo: es la razón de que el orden del plan sea ese y no otro.
   - **El coste**, cuando se sepa: cuántos commits, si toca el motor, y si necesita
     una prueba nueva.

3. Separa en tres grupos, porque no son lo mismo:

   - **Bloqueados por ti.** No se puede tocar hasta que respondas. Son los de
     "Lo único que espera tu respuesta".
   - **Listos para empezar.** Se pueden hacer ya, sin ninguna respuesta.
   - **Descartables o cerrados**, solo para que sepas que ya no cuentan.

4. Si el listado tiene más de unas pocas líneas, **no lo implements** y no empieces
   por el primero aunque parezca obvio. Pregunta.

5. Si hay trabajo de otro agente en marcha, dilo antes de nada:

   ```bash
   Get-ChildItem src/**/*.ts, verify/*.ts | Sort-Object LastWriteTime -Descending | Select-Object -First 5 LastWriteTime, Name
   ```

## Por qué este comando no avanza solo

El plan de trabajo está escrito por **dependencias**, no por urgencia: F24 antes que
F31 porque sin poder quitar material la forja deja gente atascada; F23 antes que F29
porque si los núcleos puntúan y no hay bloqueo de sesión, abrir dos pestañas es la
forma más rentable de farmear. Ese orden evita que se haga una feature que deja el
juego en un estado raro.

**Un orden correcto no es una razón para quitárselo al jugador.** Lo que evita es que
tú lo elijas por él. Si va a hacer algo de más, que sea porque te lo pidió.

## Cuando el jugador ya ha elegido

Entonces sí, y el procedimiento es el de `/feature` o `/bug`:

1. `git status` y `LastWriteTime` de `src/**/*.ts` y `verify/*.ts`: si hay otro
   agente trabajando en el mismo fichero, **no lo edites**, dilo y para.
2. `npm run build` y `npm run verify` para tener la línea base. Ahora son **24 bancos,
   1549 pruebas** (el total varía ±1: `playthroughCheck` tiene un `check()` condicional).
3. Haz **un** paso. No dos, no "de paso" nada más.

Al terminar:

- `npm run build` + `npm run verify`, los dos.
- Si tocaste economía o guardado: **una prueba nueva** en el banco que corresponda.
- Actualiza `docs/PENDIENTES.md`: lo hecho se mueve a **Hecho** con su commit, y lo
  que descubrieras haciendo otra cosa se añade a "Ideas sueltas y descubiertos".
- Si algo cambió de sitio o de prioridad, actualiza el **Plan de trabajo** y di por qué.
- Commit con el estilo del proyecto: imperativo, alcance declarado, el porqué, y qué se
  comprobó y cómo.