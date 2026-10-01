# Pendientes y features

> **Para el jugador:** esta es tu lista. Escribe en el apartado que toque, con
> tus palabras. No hace falta que sea técnico ni marcar casillas.
>
> **Cómo se elige por dónde empezar:** hay un apartado **Plan de trabajo** más
> abajo con el orden y el porqué. Está ahí para que no se empiece por lo que toca
> primero en el fichero, sino por lo que desbloquea lo demás. Si algo de lo que
> hay ahí cambia de sitio, se actualiza.
>
> **Una idea está pendiente mientras siga en estos apartados.** Cuando se termine
> se mueve a **Hecho**, y si se decide que no, a **Descartado** con el motivo en
> una línea. Así que lo único que hay que hacer al acabar algo es **moverlo**, y no
> se pierde ninguna idea.
>
> **El fichero no se borra.** Es la memoria de lo que se quiso hacer. Un descarte
> escrito vale más que la lista de "hecho": una idea que se rechazó con un motivo
> no vuelve a proponerla nadie.

---

## Features

_Cosas que quieres que existan._

### F1 · Ver la valoración sin abrir la flechita

La valoración por defautl se muestra, no hace falta abrir la flechita.

### F2 · La valoración también en el panel principal

La valoración se debe mostrar en el panel principal, en el sector de recolector.

### F3 · Desglosar la recolección por click

La recolección x click debe mostrar el base + el aumento por la mejora x nivel.
Ej: `Recolección por click: +20 (5 base +15 por mejora)`

### F4 · Solo tarjetas de buff, fuera los buffs pasivos

Sacar los buffs pasivos y dejar las tarjetas únicamente.

### F5 · Una llave por tipo de caja, con precio creciente

Debe existir una llave para cada tipo de caja y crece el precio de las mismas.

### F6 · Probabilidad baja de botín de tier superior en las cajas

En las cajas debe haber una probabilidad baja de obtener cosas del tier superior.

### F7 · Tope de 3 compañeros y precio de ranura balanceado

El máximo de compañeros quiero que sea 3. La segunda compra de slot no debe dar
+3. Balancear el precio.

---

## Bugs y cosas que se han visto

### B1 · El primer slot de compañero no muestra su daño

El click automático de los compañeros no siempre muestra el valor. Equipé un Épico
puntualmente y no mostraba el valor del daño, uno común anda. Otro dato es que el
segundo compañero sí muestra el daño. A lo mejor es un problema con el primer slot.

> Sospecha del jugador, no confirmada. Encaja con que el daño se calcule sobre el
> recolector equipado y no sobre el compañero, así que el primer slot puede estar
> leyéndose antes de que exista ese valor.

---

## Balance y dificultad

_Preguntas sobre si el juego va bien de ritmo. No son bugs: son decisiones tuyas
sobre cuánto debería costar._

### P1 · Se llega muy rápido a compañeros de tier 6

Llegué muy rápido a los compañeros tier 6... ¿está bien el balance? ¿podrás ver?

### P2 · Se llega muy rápido a recolectores de tier 7

Lo mismo que a los recolectores, llegué muy rápido al recolector tier 7.

### P3 · Los cristales de mejora son muy baratos

Los cristales de mejora valen muy baratos, es muy fácil mejorar los ítems...

---

## Tareas añadidas durante el trabajo

_Cualquier cosa que surja implementando otra cosa y haga falta decidir. Se van
apilando aquí al final, y se suben a "Features" cuando toca hacerlas._

---

## Plan de trabajo

_El orden que se va a seguir, y por qué en ese orden. Es una decisión, no una
prioridad intangible: cambia si P1-P3 dan información que hace falta antes de
programar F7._

### El cuello de botella no son las features: es un fichero

`src/gameLoop.ts` tiene **3.352 líneas y 38 métodos de API**. Las nueve ideas de
arriba lo tocan **todas**:

| Idea | Ficheros |
|---|---|
| F1-F3 valoración | `gameLoop.ts`, `ui/playerPanel.ts`, `data/valuation.ts` |
| F4 buffs | `gameLoop.ts`, `ui/buffHud.ts`, `data/items.ts` |
| F5-F6 cajas y llaves | `gameLoop.ts`, `data/items.ts`, `components/crateLoot.ts` |
| F7 slots de compañero | `gameLoop.ts`, `components/store.ts`, `data/prestige.ts` |
| B1 primer slot | `gameLoop.ts`, `ui/playerPanel.ts` |
| P1-P3 balance | `gameLoop.ts`, `data/tiers.ts`, `data/prestige.ts` |

Nueve de nueve sobre el mismo fichero significa que **con varios agentes a la vez
se pisan**, y un conflicto ahí no es un conflicto de texto: es economía. Un
`Math.floor` que se mueve cambia el juego y los bancos siguen en verde.

### Los cuatro pasos

1. **P1-P3 · balance.** Son números puros en `data/`, se pueden paralelizar sin
   tocarse, y **dan información**: si el tier 6 llega demasiado rápido, igual F7
   deja de ser una feature y pasa a ser un ajuste. Programar F7 antes de esto es
   adivinar.
2. **B1 · el bug del primer slot.** El único defecto real, y es de los que
   rompen una regla del proyecto: lo que se enseña tiene que ser lo que se cobra.
3. **Mudanza de las 230 líneas de datos a `src/data/`.** Ver abajo. Riesgo casi
   nulo, y de paso cumple R2, que ahora se incumple sin que nadie lo notara.
4. **F1-F7**, que ya tocan menos sitio.

### El paso 3 en detalle: qué se mudaría

Las primeras 380 líneas de `gameLoop.ts` **no son el motor**, son datos puros que
no tocan `state` ni Firebase:

| Qué | Líneas |
|---|---|
| `STORE_ITEMS`, `CRATE_TYPES`, `BUFF_FIELDS` | 155-232 |
| `COMPANION_SLOT_COSTS` | 232 |
| `collectorUpgradeCost`, `previewUpgradeChance`, `previewUpgradeCost` | 242-265 |
| `generateCompanionByTier`, `generateCollectorByTier` | 344-362 |

Son ~230 líneas de tablas y funciones puras. **Cuatro ficheros ya importan de
un fichero de 3.352 líneas para leer una tabla**: `store.ts`, `crateLoot.ts`,
`crystalPicker.ts` e `items.ts`. Y R2 dice que las reglas compartidas viven en
`src/data/` — aquí se está incumpliendo desde antes de que existiera el banco
que lo comprueba.

Además: de 3.352 líneas, solo **54 tocan Firebase**. El 98% es lógica de juego.

### Lo que NO se va a hacer, y por qué

**Partir el motor en varios ficheros de golpe**, confiando en que los bancos lo
detecten. Los bancos comprueban **números, no estructura**: si una mudanza mueve
un `Math.floor`, los 1.123 tests siguen verdes y el juego cambia. Es el modo de
fallo que `huecos-almacen.md` ya documenta — un banco que no mira lo que pasó.

Por eso el paso 3 es una mudanza **literal** (cambiar dónde vive la tabla, no qué
devuelve) y los pasos 1, 2 y 4 van con una prueba nueva en su banco.

---

## Hecho

_Lo terminado, para no perder el hilo. Una línea por cosa y el commit donde entró._

- [x] El contador deja de enseñar números que nadie cobra (`558a394`). La ficha y
      el "+N" de los compañeros ya dicen la cifra que entra de verdad, y los clics
      del árbol tienen señal.
- [x] La ruleta del sintonizador, y la de las cajas partida en tres ficheros
      (`ce3a346`).

---

## Descartado

_Lo que se decidió no hacer, y por qué. Esto vale más que la lista de "hecho":
una idea que se descartó con un motivo escrito no vuelve a proponerla nadie._

_(vacío)_