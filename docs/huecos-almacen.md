# Huecos reales en el almacén

Estado: **diseño cerrado, sin implementar.** Motivo: hay otro agente editando
`src/` en este mismo directorio. Implementar esto ahora es garantizar un conflicto
sobre `gameLoop.ts` y `warehouse.ts`.

El problema que resuelve: el almacén es un array empaquetado, así que "un hueco" no
existe como posición. Soltar un item en una celda vacía solo puede significar "ponlo
al final", y si ya estaba al final no pasa nada. El jugador quiere **dejar un
agujero** y que el item ocupe ese espacio.

---

## 1. Modelo de datos

Un campo nuevo en el guardado:

```ts
/** Hay un hueco inmediatamente ANTES de este item. */
warehouseGaps: string[]
```

**Por qué se ancla a un id de item y no a un índice de celda.** Los índices de
celda se mueven con cada compra, venta, caja abierta y reordenación. Un hueco
guardado como "celda 5" se deslizaría a un item distinto después de la primera
compra, sin avisar. Anclado a un item, el hueco se queda pegado a él para siempre:

- se vende el item → el hueco se queda sin ancla y desaparece con él
- se compra un item nuevo → entra al final, y el hueco sigue donde el jugador lo puso

El array **sigue empaquetado**. Eso es lo que mantiene el riesgo bajo: capacidad,
`buyItem`, `sellItem`, la valoración y los contadores no llegan a ver un hueco
nunca, porque un hueco no es un item.

## 2. Pintado

`visibleStacks()` ya devuelve las celdas en orden. El pintor intercala una celda de
hueco antes de cualquier celda cuyo `item.id` esté en el conjunto:

```ts
for (const c of celdas) {
  if (huecosAntes.has(c.item.id)) pintada.push({ tipo: 'hueco' });
  pintada.push({ tipo: 'celda', celda: c });
}
```

Las celdas de hueco llevan `data-gap="1"` y **no** llevan `data-cell`. Así el
índice `data-cell` sigue siendo el índice dentro de `celdas` y todo lo que ya
habla ese idioma (`pointerdown`, `pointermove`, `is-over`) sigue funcionando sin
cambios: una celda de hueco simplemente no es un `data-cell`.

La celda de hueco tiene que **pintarse distinta** de la capacidad libre. Las de
capacidad van a `opacity-25`; un hueco del jugador va a opacidad completa con
borde discontinuo. Si se ven igual, el jugador no puede distinguir "esto lo dejé
vacío a propósito" de "esto está libre porque no me cabe más".

> **Cambiado al implementar.** El mockup del jugador muestra el hueco con el
> MISMO aspecto que la capacidad libre, así que se dejó igual: para el jugador es
> la misma cosa —"aquí no hay nada y puedo soltar"—, y ambos destinos son válidos.
> Distinguirlos por el estilo convertiría una diferencia que no le importa en un
> concepto más que recordar.

## 3. Soltar en un hueco: intercambio

El gesto "suelta el dron en el hueco de la celda 5" se interpreta como *el item
ocupa el hueco y el hueco queda donde estaba el item*:

1. Se mueve el grupo para quedar justo delante del item que ancla el hueco
   (`moveItems(grupo, idAncla, 'antes')`).
2. Se registra un hueco delante del item que ahora precede al grupo. Si no había
   nada detrás —el grupo era el último—, el hueco cae en la cola libre, que ya se
   pinta vacía sola y no necesita ancla.
3. Si el grupo **ya** estaba justo delante del ancla, o el ancla es parte del
   propio grupo, no hay nada que colocar: se rechaza con un aviso para que el
   gesto no parezca ignorado.

Es el mismo comportamiento que en Stardew, y es un intercambio: el número de huecos
no cambia al arrastrar.

## 3-bis. Cómo se CREA el primer hueco (añadido al implementar)

Un hueco solo puede aparecer **entre** dos items, y una lista empaquetada no tiene
ninguna posición libre entre dos items: toda celda vacía está detrás de la última.
Arrastrar, por tanto, **nunca puede crear un hueco** — el arrastre solo puede
rellenar uno que ya exista. Sin un gesto adicional, el primer hueco sería imposible
de crear y la función entera inalcanzable.

El gesto es un botón en la ficha del item: **"Dejar un hueco aquí"** /
**"Quitar el hueco de aquí"**. Explícito, y funciona igual en móvil. Va en la ficha
y no en la rejilla porque "dejar un hueco *aquí*" es una frase sobre un item, y un
botón en la rejilla sería una segunda cosa que acertar en una celda pequeña.

El botón lee los huecos del estado guardado y no de la rejilla: un hueco creado
en "Todo" no puede desaparecer de las opciones en cuanto se activa un filtro.

## 4. Reglas

- **Con filtro o con orden activo no se pintan huecos.** El acomodo elegido solo
  tiene sentido en "Mi orden" sin filtro; dibujado sobre un filtro seria una
  mentira, porque la posición depende de qué se esté viendo.
- **Un hueco no consume capacidad.** `warehouse.length >= capacity` sigue siendo lo
  que impide comprar. Un hueco es una preferencia de disposición, no una ranura.
- **Soltar en la capacidad libre del final** (sin item detrás) caía en el gesto
  "ponlo al final", como antes. Esto lo cambió la regla del tablero, más abajo.
- **Sincronización:** un hueco anclado a un item que ya no existe se borra. Va un
  `syncWarehouseGaps()` junto a los `syncCrateCounters()` que ya hay, y se llama
  desde `sellItem`, `openCrateBox`, `useConsumable`, `updateState` y al cargar.
- **Migración:** si el documento no trae `warehouseGaps`, o trae basura, se coacciona
  a `[]` con el mismo estilo defensivo que las demás migraciones del game loop.

## 4-bis. La rejilla es un TABLERO, no una lista

> **Cambiado al implementar, a petición del jugador:** *"si tengo 15 espacios en el
> almacén, todos esos espacios son espacios vacíos donde puedo acomodar los items
> internos donde yo quiero"*.

Las reglas de arriba trataban la rejilla como una lista con huecos intercalados, y
de ahí salía un tope que **no tenía motivo ninguno**: como cada hueco necesita un
item al que anclarse, se puso un límite de "un hueco por celda ocupada". Con 3
celdas ocupadas y 18 libres, eso solo dejaba mover un item hasta la celda 5.

Es justo lo contrario de lo pedido, y el tope no venía de nada real. La regla
correcta es más simple y más fuerte:

> **La rejilla es un tablero de N celdas. Cualquier celda vacía vale como destino de
> cualquier item, incluido el último. El item cae exactamente donde se señaló, y los
> demás items no se mueven.**

El modelo que sale de ahí:

- **El tablero** es `totalCeldasPintadas(celdasOcupadas, capacidad)`: una función y
  no un número en línea. Vive en una función **porque el arrastre necesita el mismo
  número que el pintado**; si los dos calcularan distinto, un item podría acabar
  empujado fuera de la rejilla y desaparecer de la vista sin que se hubiera vendido.
- **Soltar en una celda libre** manda el item al final del array y le cuelga a *él
  mismo* los huecos que hagan falta para caer en la celda señalada. Los huecos van
  **solo en el item movido**, y por eso los demás no se desplazan. Los huecos que el
  jugador ya había dejado se respetan tal cual.
- **El único tope real es el tablero.** Más allá de la última celda se recorta, no se
  inventa una posición. Y `normalizaGaps()` ya no recorta por "un hueco por celda": su
  único límite es un cortafuegos de 200 contra un documento manipulado, muy por
  encima de cualquier almacén real.

El botón de la ficha sigue siendo la única forma de dejar un hueco *en medio* de la
lista, porque una lista empaquetada no tiene posición libre entre dos items. Pero
para llevar un item a cualquier celda vacía ya no hace falta: se arrastra y se suelta.

## 5. API nueva en el game loop

```ts
/** Deja un hueco delante de `beforeId` (null = quitar el que haya). */
setWarehouseGaps: (ids: string[]) => boolean
/** Limpia los huecos anclados a items que ya no existen. */
syncWarehouseGaps: () => void
```

La vista decide *qué* huecos quiere y se los pasa entera; el juego solo guarda y
limpia. La decisión de disposición es del jugador, igual que el orden.

## 6. Ficheros a tocar

| Fichero | Qué |
|---|---|
| `src/types.ts` | `warehouseGaps?: string[]` en el tipo de guardado |
| `src/gameLoop.ts` | default `[]`, migración, `setWarehouseGaps`, `syncWarehouseGaps` y sus llamadas |
| `src/components/warehouse.ts` | pintor intercalado, `data-gap`, `moveItemTo` con destino `'celda' \| 'hueco' \| 'final'`, y `finish` distinguiendo los tres |
| `verify/kit.ts` | `warehouseGaps: []` en `baseSave` |
| `verify/vite.config.ts` + `verify/run.mjs` | alta del banco nuevo |

## 7. Pruebas

- un hueco antes de X se pinta en la celda justa y desplaza el resto
- soltar un item en un hueco lo deja delante de X **y** deja un hueco donde estaba
- soltar el item que ya está delante de X mueve el hueco, no el item
- el intercambio es una permutación: no se crea ni se pierde ningún item, y el
  número de huecos no cambia
- un hueco anclado a un item vendido desaparece
- un hueco no consume capacidad: con el almacén lleno se puede seguir metiendo
- con filtro o con orden activo no se pintan huecos
- los huecos sobreviven a recargar
- el arrastre del desfase de una celda (lo ya arreglado) sigue cogiendo la celda
  señalada **con huecos intercalados**, que es justo lo que rompe un `data-cell`
  que se toma como posición pintada

La última es la importante: al intercalar huecos, el índice pintado y el índice
de celda dejan de coincidir, y es donde reaparecen los bugs de una celda de
desfase si se mezclan los dos conceptos.

## 8. Coste

~100-130 líneas entre 4 ficheros de `src/` más un banco de pruebas. Lo que lo hace
acotado es que el array sigue siendo un array: ningún consumidor de la economía ve
un hueco.
