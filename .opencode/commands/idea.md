---
description: Apunta una idea nueva en docs/PENDIENTES.md
---

Apunta una idea en la lista de pendientes.

Idea del jugador: **$ARGUMENTS**

Clasifícala en el apartado que le toque de `docs/PENDIENTES.md` — **Features**,
**Bugs**, **Balance y dificultad** o **Tareas añadidas durante el trabajo**— y
dale el siguiente identificador libre (`F8`, `B2`, `P4`...).

**Conserva las palabras del jugador tal cual**, debajo de un título corto que
pongas tú. No las reescribas ni las "mejores": si el texto es mío, la idea pasa a
ser mía, y él es quien decide qué quiere.

Reglas del fichero:

- Una idea está **pendiente mientras siga** en esos apartados. Al terminarla se
  mueve a **Hecho**; si se decide que no, a **Descartado** con el motivo en una
  línea.
- Lo nuevo se **añade al final** de su apartado, nunca en medio: el orden es de
  ideas, no de prioridad.
- Si la idea contradice algo del apartado **Plan de trabajo**, **no la ejecutes**:
  dime la contradicción y propón cómo se ajusta el plan.

Si la idea es ambigua y se podría leer como bug o como feature, **elige una y
dímelo**, para que la mueva si no es la que quería.

Después de escribir el fichero: `node verify/scanTexto.mjs` (el guard de
caracteres mira los `.md`), commit, y `git push`.

Si me pide la idea **implementada** en vez de apuntada, hazlo: pero en ese caso
mueve a **Hecho** y devuélveme el resumen de qué cambió.