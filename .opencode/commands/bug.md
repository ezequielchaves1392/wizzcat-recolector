---
description: Arregla el siguiente bug de docs/PENDIENTES.md
---

Arregla el siguiente bug.

Lee `docs/PENDIENTES.md`, quédate con la sección **Bugs y cosas que se han visto**
y elige **uno** (identificadores `B1`, `B2`...).

Un bug va por delante de una feature, y esto no es una preferencia de orden: un
defecto rompe una regla del proyecto y una feature la amplía. El más grave de los
dos es el que hace que **la pantalla diga una cosa y la cuenta sea otra**, porque
eso no tiene arreglo manuales: el jugador pierde saldo sin ver por qué.

Procedimiento:

1. **Reproduce el bug antes de tocar nada**, y deja la reproducción escrita. Un
   bug que no se ha visto ocurrir es una hipótesis, y corregir una hipótesis suele
   ser corregir el código equivocado. Si la descripción del jugador trae una
   sospecha —"a lo mejor es el primer slot"— trátala como **pista, no como
   diagnóstico**: verifícala o descarta, y di qué pasó.
2. `git status` y `LastWriteTime` de los ficheros que vas a tocar. Si hay otro
   agente ahí, no los edites.
3. Busca si el fallo es **de flujo** (nadie llama a algo que debería llamarse) o
   **de valor** (se llama, pero con el número equivocado). El segundo es el que
   más se repite en este proyecto.
4. `npm run build` + `npm run verify` de línea base.
5. Arregla **una sola** cosa.
6. **Prueba nueva en el banco que corresponda**, que es obligatoria aquí. Piensa
   en qué habría dado verde con el bug presente: una prueba que pasa antes de
   arreglar no está probando el bug.
7. `npm run build` + `npm run verify`. Si el bug era de render, míralo en
   `preview.html` con viewport real.
8. Mueve el bug a **Hecho** en `PENDIENTES.md` con su commit, con una frase que
   diga **la causa raíz**, no el síntoma. Y **añade al final** lo que descubrieras.
9. Commit con el estilo del proyecto y `git push`.