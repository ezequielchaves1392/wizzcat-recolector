---
description: Trabaja la siguiente feature de docs/PENDIENTES.md
---

Trabaja la siguiente feature.

Lee `docs/PENDIENTES.md` y quédate con la **sección Features**. Cada idea tiene un
identificador (`F1`, `F2`...) y **tu texto original debajo del título**: usa ese
texto, no el título, porque el título lo puse yo al ordenar la lista.

Elige **una** feature. Si no digo cuál, coge la primera que quede pendiente, pero
antes de empezar comprueba en el apartado **Plan de trabajo** si esa feature tiene
un orden asignado: el plan manda sobre el orden de la lista, porque existe para
no empezar por lo que toca más ficheros.

Lista de comprobación, en este orden:

1. `git status` y `LastWriteTime` de los ficheros que vas a tocar. Si hay otro
   agente trabajando ahí, **no los edites**: dilo y para. Las features de esta
   lista tocan casi todas `src/gameLoop.ts`, que es de donde vienen los choques.
2. `npm run build` + `npm run verify` como línea base (**20 bancos, 1340
   pruebas**, ±1).
3. Antes de escribir, busca si la regla que necesitas ya existe en `src/data/`.
   Si no está, **va a `src/data/`**, no al game loop ni a la vista (R2). Y el
   número que se pinte sale de una función del motor, nunca de una copia en la
   vista (R3).
4. Implementa **una sola** feature.
5. Si la feature es de economía o guardado, **una prueba nueva** en el banco que
   corresponda, y cada comprobación acaba en `reload()`.
6. `npm run build` + `npm run verify`.
7. Lo que `verify/` no cubre, míralo a mano en `preview.html` (con viewport real,
   390×844 y 1440×900). Si toca el render de una ruleta, en `ruleta-preview.html`.
8. Mueve la feature a **Hecho** en `PENDIENTES.md` con su commit, y **añade al
   final** lo que descubrieras por el camino.
9. Commit con el estilo del proyecto y `git push`.

Si al terminar una feature el **Plan de trabajo** deja de ser válido, corrígelo
y explica por qué en una línea.