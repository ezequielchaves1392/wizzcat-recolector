# Reglas y tecnologías del proyecto
sin resolver.
| `balanceCheck` | **Que el precio siga al poder, y que no se rompa en silencio.** El coste por punto de poder es la regla entera: tiene que SUBIR con el tier —150 en T1 hasta ~416 en T10, el sobreprecio deliberado del que habla el código—, y **un tier superior NUNCA puede salir mejor por punto que el anterior**. Esa segunda regla es la que ata el bug real: los precios escalaban 1.5x y el poder 1.62x, así que el T10 salía a 38 por punto contra 142 del T1, y comprarlo era 3.7x más rentable que comprar T1. También que compañero y recolector cuesten lo mismo (mismo `TIER_SYSTEM.ranges`), que el final de la partida se estire (los dos últimos tiers son más de la mitad del total) y que sintonizar no sea un botón (nivel 20 cuesta ~47% del recolector, no un 4%). | 29 |
# Reglas y tecnologías del proyecto

Este fichero tiene dos mitades: **con qué está construido** (la parte estable) y
**con qué reglas se escribe** (la parte que hay que respetar para no romper lo
que ya funciona).

Las reglas no están en un `.editorconfig` ni en un linter: están **en el código**.
Cada módulo abre con una cabecera `// ===...===` y cada función no obvia tiene un
JSDoc que explica la alternativa que se descartó y por qué. Este documento las
recoge para no tener que leer 3.500 líneas para saber cómo escribir la siguiente.

---

# PARTE 1 — TECNOLOGÍAS

## 1.1 Stack

| Capa | Elección | Versión | Nota |
|---|---|---|---|
| Build | Vite | `^8.3.1` (8.3.1) | **Sin plugins.** Solo el `input` multipágina. |
| Lenguaje | TypeScript | `^5.3.3` (5.9.3) | `strict: true`. `noUnusedLocals/Parameters: false` **a propósito**. |
| Estilos | Tailwind CSS | `^3.4.1` (3.4.19) | Va como dependencia normal, no de desarrollo. |
| PostCSS | `postcss` + `autoprefixer` | 8.5.28 / 10.6.1 | Sin opciones. |
| Backend | Firebase 10 (`firebase`) | `^10.8.0` (10.14.1) | Auth + Firestore, **solo SDK cliente**. |
| Audio | Web Audio API | — | Sin ficheros. Música generativa. |
| Iconos | SVG generados en código | — | Sin peticiones de red. |

**No hay:** framework de UI, router de URLs, Gestor de estado, librería de
tests, linter, formateador, CI, ni aliases de import.

**Entorno:** Node 22.x (observado 22.16.0). ESL y LF↔CRLF en Windows: Git avisa
en cada `git diff`, es ruido, no lo arregles.

## 1.2 Scripts

```bash
npm run dev       # vite
npm run build     # tsc && vite build   ← el type-check es puerta de entrada
npm run preview   # vite preview
npm run verify    # bundle de los bancos de pruebas + runner en Node
```

No hay `npm test` ni `npm run lint`. `verify` **es** el test.

## 1.3 Por qué no hay framework

No es que no llegara: es una decisión. Añadir React habría significado cambiar el
patrón de render (que es `innerHTML` + un nodo reemplazable), el patrón de estado
(que es una closure) y el modelo de eventos. Un framework pequeño como Preact
habría obligado a reescribir `pageShell`, `warehouse` y `store` entero para
ganar poco. **Antes de proponer un framework, el coste de migración es del tamaño
del proyecto.**

## 1.4 Entry points

`vite.config.ts` existe **solo** por el multipágina. Nada más. Nada de plugins,
aliases ni formatos raros — está escrito así a propósito en la cabecera.

| HTML | Script | ¿Se construye? | Qué es |
|---|---|---|---|
| `index.html` | `src/main.ts` | Sí | El juego. |
| `admin.html` | `src/admin.ts` | Sí | Terminal de administración. **No publicar.** |
| `preview.html` | `src/preview.ts` | No | Monta cualquier pantalla con datos de ejemplo. |
| `auth-preview.html` | `src/authPreview.ts` | No | Escena de la pantalla de acceso. |
| `nav-test.html` | `src/navTest.ts` | No | Recorrido automático de navegación. |
| `drag-test.html` | `src/dragTest.ts` | No | Escenarios de arrastre con DOM real. |
| `ruleta-preview.html` | `src/ruletaPreview.ts` | No | Las dos ruletas, aisladas: la de las cajas y la del sintonizador. `?sintonizador=1` y `?sintonizador=0` abren la segunda con cada desenlace. |

De estos cinco últimos, `.gitignore` recoge **los cinco enteros**, HTML y script:
`preview.html`, `auth-preview.html`, `nav-test.html`, `drag-test.html` y
`ruleta-preview.html` con sus `src/`. Antes dejaban cuatro fuera
(`drag-test.html`, `src/dragTest.ts`, `ruleta-preview.html`, `src/ruletaPreview.ts`),
que quedaban **sin seguimiento pero no ignorados** — la peor de las dos
situaciones: `git status` los anunciaba como código nuevo cada vez que alguien
montaba el utillaje con `npx vite`. La regla que está escrita en el propio
fichero es la que manda:

> O el utillaje está ignorado entero, o se versiona entero.

**Consecuencia práctica:** nada de lo que sirve para mirar la pantalla está en
el historial. Si hace falta revisar el render de la ruleta hay que montarlo con
`npx vite ruleta-preview.html`; no se puede leer del `git show`.

> `admin.html` se construye porque es útil, pero **construido ≠ publicado**. La
> seguridad la ponen las reglas de Firestore, no el HTML.

## 1.5 Firebase

`src/firebase.ts` son 20 líneas: `initializeApp` con la config **en el código**
(proyecto `chronos-tap`), y exportar `auth` y `db`. No hay variables de entorno.
La config de un cliente web de Firebase es pública por definición; lo que protege
el juego son las reglas.

### Reglas de Firestore (`firestore.rules`)

| Colección | Lee | Escribe |
|---|---|---|
| `users/{uid}` | dueño o admin | dueño (crear/actualizar), admin (borrar) |
| `rankings/{uid}` | cualquier autenticado | solo el dueño; admin borra |
| `admins/{uid}` | admin | admin |
| `bloqueos/{uid}` | dueño o admin | solo admin |
| todo lo demás | `if false` | `if false` |

Dos decisiones que hay que entender antes de tocar esto:

- **`bloqueos` es legible por el propio usuario.** A propósito: si no puede leer
  su propio bloqueo, no puede saber por qué le rechazan el acceso.
- **Las reglas no pueden revocar sesiones ni borrar cuentas de Auth.** Eso
  necesita Admin SDK en servidor. Está escrito en la cabecera del fichero.

## 1.6 La suite `verify/`

Un banco de pruebas **propio**. Sin Vitest, sin Jest, sin Playwright.

```
npm run verify
  = vite build --config verify/vite.config.ts   # 17 entries -> verify/out/
  && node verify/run.mjs                        # entorno + importa todos
```

**Cómo funciona.** `verify/vite.config.ts` tiene **un único plugin**,
`sustituirFirebase()`, que redirige `firebase/firestore`, `firebase/app` y
`firebase/auth` a los stubs de `verify/stubs/`. El stub de Firestore usa
`globalThis.__MEM_DB__` y **respeta `{merge: true}`** — a propósito, porque si no
una regresión del tipo "dejamos de guardar `equippedCollectorId`" pasaría
inadvertida.

El entorno mínimo (DOM, `localStorage` que **guarda de verdad**, `performance`,
`setInterval` anulado y los manejadores de fallo del proceso) vive en
**`verify/entorno.mjs`** y lo comparten `run.mjs` y `one.mjs`. Antes estaba
duplicado en los dos, y las copias se separaron: a `one.mjs` le faltaban
`querySelector` y `classList`, con lo que **cuatro de los once bancos no se podían
ejecutar en solitario** y uno no imprimía nada. El síntoma era siempre un error que
señalaba a otro sitio: `document.querySelector is not a function` dentro del
`catch` que informa de fallos de red (un guardado correcto anunciado como
perdido), y `reading 'remove'` en un `setTimeout` de los avisos. Más el
`localStorage` que devolvía `null` siempre, con el que la cola de nanitas no se
podía ni escribir.

**Un banco que funciona con el runner tiene que funcionar con el depurador.** Por
eso el entorno es un módulo y no dos. Léelo antes de tocarlo: **un stub que no
cubre lo que el código toca no es un stub más pequeño, es un banco que se apaga
solo.**

Y tiene una segunda mitad, que salió al escribir `toastCheck`: **un stub que
cubre de más tampoco vale.** `appendChild` era una sinónima porque hasta ahora
nadie miraba el DOM, y no mirarlo era correcto. En cuanto un banco afirma sobre
nodos, ese no-op deja de ser inocuo y pasa a ser una mentira: el banco se puede
llamar "pila que no se pisa" y estar contando una lista siempre vacía. Ampliar el
stub cuando aparece el primer banco que lo necesita es más barato que descubrirlo
en producción.

### Los 19 bancos

| Banco | Qué verifica | Pruebas |
|---|---|---|
| `sellCheck` | `sellItem` borra de verdad y no resucita al re-sincronizar ni al recargar. Cajas, llaves, cristales, consumibles, compañeros, recolectores, migraciones de contadores, renombre `weapon`→`collector`, que **el total que enseña el botón sea el que entra en la cuenta**, y la **venta por unidades**: qué queda en la pila, qué sobrevive a la recarga, que pedir más de lo que hay se recorta en vez de fabricar dinero, y que 0, negativos, `NaN` e `Infinity` se rechazan sin cobrar. | 121 |
| `equipCheck` | Equipar/desequipar, y que **un click llega al manejador exactamente una vez** por muchos renders. Nodo falso con `addEventListener`/`click()` reales para contar acumulación. | 24 |
| `buyCheck` | `buyStoreItem` y `buyNode`: **lo que se cobra es lo que se muestra**, lo que se paga llega, y lo que no cabe no se compra. Sobrevive a la recarga. | 148 |
| `filterCheck` | `matchesFilter`, `visibleStacksFor` y `moveItemTo` **juntas**, porque la rejilla que ve el jugador y la que usa el arrastre tienen que ser la misma. Los 5 órdenes. | 67 |
| `moveCheck` | `moveItems` **reordena, nunca edita**: ni número de items, ni nanitas, ni contadores. El destino imposible se rechaza en vez de corromper. | 54 |
| `stackCheck` | Una pila es una ranura. Comprar y abrir van a la pila existente. La migración colapsa saves viejos sin perder unidades. Que el botón de la tienda y el cobro pregunten lo mismo. **Las cuatro cartas de llave por separado**, una partida por carta: que dos unidades del mismo nivel caigan en una pila vale para las cuatro, y medirlas todas en una partida compartida mide cuatro llaves de tres niveles distintos. | 71 |
| `consumableCheck` | `useConsumable`, la operación más condicional. Tres fallos con nombre: gastar sin aplicar, aplicar sin gastar, romper el tope. | 88 |
| `stateCheck` | Lo que no se rompe en una partida de 2 minutos: defaults, guardado, migraciones, trim por prioridad, precio mostrado == precio cobrado, **sintonización del recolector** (el acierto, el fallo que no retrocede, y los tres rechazos), prestige, forja, ciclo mixto de 20 operaciones. **Cada comprobación acaba en `reload()`.** | 212 |
| `gapCheck` | Los huecos del almacén. El ancla es el **id del item**, nunca un índice de celda. Reimplementa el criterio del pintor a propósito, para que el test no sea tautológico. | 65 |
| `lootCheck` | **Que la ruleta no mienta**: la cifra que enseña la casilla y la que entra en la cuenta son la misma. Y que los cosméticos de caja entren sin perderse (un cosmético no es un item: no ocupa ranura, no se vende, y repetir uno que ya tienes no puede ser el premio). | 19 |
| `tickCheck` | El ritmo del ingreso pasivo: entra **entero y de una vez**, una vez por segundo, aunque el tick sea de 500 ms. Con ingreso impar (7/s daba +3 y +4). Todos los orígenes, incluido el compañero de tipo `click`. Nada sin mirar. Y sobre todo que **el ingreso por segundo no cambia**: diez ticks son cinco cobros. |
| `queueCheck` | La cola de nanitas pendientes: se anota antes de la red, se vacía al confirmar, sobrevive a la caída, y **no se aplica cuando no debe** (reinicio de prestigio —saldo Y núcleos—, segundo dispositivo, registro corrupto, cuenta ajena). | 42 |
| `playthroughCheck` | **La partida entera de un jugador nuevo**, de principio a fin y sin reiniciar en medio: nacer, clickear, comprar, equipar recolector y compañero, almacén y apilado, ampliar, vender, cajas y ruleta, buffs, curva de poder entre tiers y Ascensión. Cada apartado acaba en `reload()`. Mide el CAMINO, no el equilibrio: un camino que pasa no dice que el juego esté bien de balance. | 98 |
| `toastCheck` | **La pila de avisos flotantes.** `showToast` es el overlay más llamado del juego (71 llamadas entre las siete pantallas, la terminal y el propio `gameLoop`) y no estaba cubierto por nada. Que no haya un nodo por aviso, que lo repetido se cuente (`×5`) en vez de apilar cinco iguales, el tope de cuatro vivos, que se coloque midiendo la cabecera y no con una constante, y que lo retirado no se quede apuntado en la lista. **Y los logros (B3-B4)**, que son un aviso más y compartían el mismo fallo silencioso: que `buyStoreItem('warehouseSlot')` emita el logro (era la única de las diez rutas que no evaluaba logros), que no lo emita dos veces, y que la pista mida la capacidad real con el árbol en vez de la base sola. La pista se compara **alcanzando el tope**, no igualando cifras: va topeada a 20 y la capacidad no, y comparar `20 === 26` fallaría con un bug inexistente. Ver abajo, porque necesita un stub con DOM de verdad. | 31 |
| `rouletteCheck` | **La matemática del trompo.** Que la curva frene de verdad —es el ajuste de `2t - t²`, deceleración constante— y no un `ease-out` cualquiera, que `instante()` la deshaga, que **la casilla ganadora para en el marcador**, que las vueltas se cuenten en ventanas visibles para que el trompo dure igual en móvil y en escritorio, y que **cada chasquido caiga en una frontera de casilla** con los intervalos espaciándose al frenar. Es la otra mitad de "que la ruleta no mienta": `lootCheck` comprueba que el número de la casilla sea el que entra en la cuenta, este que el desplazamiento deje esa casilla bajo la aguja. Y una segunda mitad, la **ruleta del sintonizador**: que el motor distinga *el dado salió mal* de *no se llegó a tirar* (`rolled`), que un rechazo no gaste cristal ni mueva el nivel, y que la flecha del acierto sea `4 → 5` y no el `5 → 5` que sale de releer el item después del sorteo. | 59 |

| `tickCheck` | **El ritmo del cobro pasivo.** Que el ingreso entre ENTERO y de una vez, no la mitad del tick: el HUD anuncia "+5 / segundo" y con un tick de 500 ms el saldo subía 2,5, así que el entero alternaba +2 y +3. Y la que no se puede perder de vista: **el ingreso por segundo NO cambia** —diez ticks son cinco segundos y tienen que haber dado cinco cobros—, porque un arreglo de ritmo visual que de paso inflara o recortara la economía se vería igual de bonito y sería un desastre. También que un compañero de tipo `click` cuente igual, y que con la pestaña oculta no entre nada ni se acumule para después. **Y el AFK solo (B9)**: mirando la pantalla y sin hacer nada, el ingreso se corta al pasar el umbral, sin que ningún evento de presencia se dispare; que los clicks del árbol **no** lo despierten, y que el corte los alcance a ellos también. La del árbol se mide por el saldo quieto con el árbol tirando, no por "el árbol produjo": con el árbol dormido el AFK entraría igual y la prueba pasaría sin comprobar lo que dice comprobar. | 20 |
| `senalCheck` | **Que lo que se enseña sea lo que se cobra.** El `tickCheck` ata el ritmo del bloque entero; este ata **el reparto dentro de ese bloque**. Que las fichas sumen EXACTAMENTE `state.passiveIncome` —ni un nanita de más ni de menos— y que no se pueda deshacer repartiendo `floor(power × multiplicadores)` por separado, porque los floors no suman: con dos compañeros de 3 y ×1,5 el ingreso es 9 y los floors son 4 y 4. Que el `+N` flotante y la ficha digan 9 y no el `power` desnudo. Y que los **clics del árbol tengan señal**, que no la tenían: entran en la cuenta, suman `totalClicks` y no se veían por ningún lado, así que de las tres fuentes del contador solo dos tenían cartel. | 26 |
| `balanceCheck` | **Que el precio siga al poder, y que no se rompa en silencio.** El coste por punto de poder es la regla entera de las cartas: tiene que SUBIR con el tier —150 en T1 hasta ~416 en T10, el sobreprecio deliberado del que habla el código—, y **un tier superior NUNCA puede salir mejor por punto que el anterior**. Esa segunda regla es la que ata el bug real: los precios escalaban 1.5x y el poder 1.62x, así que el T10 salía a 38 por punto contra 142 del T1 y comprarlo era 3.7x más rentable que comprar T1. También que compañero y recolector cuesten lo mismo (mismo `TIER_SYSTEM.ranges`), que el final de la partida se estire (los dos últimos tiers son más de la mitad del total) y que sintonizar no sea un botón (nivel 20 cuesta ~47% del recolector, no un 4%). | 29 |

| `desgloseCheck` | **Que las partes del daño sumen el total.** El panel enseña el click partido en base, nivel y bonos, y el reparto sale del motor. Que `base + nivel + bonos` sea **exactamente** `getClickDamage()` en cinco casos raros, con buff x2 puesto y al expirar, y que ninguna parte salga negativa. Y la que no es cosmética: **con buff la parte de nivel no se mueve**. El buff multiplica el total entero, así que adjudicárselo a "nivel" hacía que el panel dijera "+200 nivel" para un item cuyo nivel vale 50, y se leía que subir de nivel rendía el doble. El efecto entero del buff tiene que caer en "bonos", que es donde uno lo espera. | 31 |
| `llaveCheck` | **Que el sistema de llaves cerrara.** Tres mitades que fallaban a la vez: la **cadena** (la del Vacío no salía de ninguna parte y la caja legendaria era imposible de abrir; la Rúnica solo salía de la legendaria; la épica no soltaba llave ninguna — tres peldaños y faltaban los tres), el **texto** (los cuatro `details` mentían) y la **tienda** (una carta que entregaba otra llave, con el precio en un tercer sitio). Comprueba que cada caja suelte la llave que la abre, por **las dos vías**: botín y tienda, porque una llave que solo existe en la tienda y una que solo sale de cajas dejan de ser el mismo sistema. Que el texto no prometa ninguna caja que la llave no abra, en las dos direcciones. Que cada carta entregue la llave que dice. Y que el botín no anuncie una llave que no entrega, con el **plural entero**: una versión anterior miraba `includes('Llaves')` y daba por buena una etiqueta que decía "+2 Llaves Rúnica". | 92 |

Además, fuera del runner automático: `reproStack.ts` (repro manual del bug de las
19 llaves apiladas, con DOM real vía `domStub.ts`).

### El primer banco que necesita DOM de verdad, y lo que costó

`toastCheck` es el primero que **mira nodos en vez de mirar números**. Los doce
anteriores afirmaban sobre el estado del juego, que es JavaScript puro, y por eso
el `elementoFalso()` de `entorno.mjs` podía quedarse en `appendChild() {}`: no
había nada que.appendear.

Para comprobar que los avisos no se pisan hay que contar hijos, y con un
`appendChild` que no hace nada el banco se podía llamar "pila que no se pisa"
**sin estar mirando una pila**. El stub se amplió con `children`, `appendChild`,
`removeChild`, `remove`, `parentElement` y `firstChild`, y `document.body` pasó a
ser un nodo de verdad. Todo lo anterior sigue igual: los doce bancos siguen dando
el mismo número de pruebas.

Y se añadió `__DOM__`, el mismo truco que `__MEM_DB__` para Firestore: un banco
publica en `__DOM__['header']` la cabecera que quiera, con su borde inferior, y
`document.querySelector` la devuelve. `syncToastOffset()` coloca la pila midiendo
el `<header>`, así que sin esto no había forma de mirar esa regla: solo se podía
comprobar el camino de reserva, que es el que se usa cuando **no** hay cabecera.

**LO QUE ESTE BANCO ENSEÑÓ AL ESCRIBIRLO, y que no se habría visto mirando la
pantalla:**

- Al expulsar un aviso **no se borra en el acto**: se va desvaneciéndose 300 ms,
  así que hay cinco hijos durante ese instante. El tope de cuatro es correcto; la
  aserción que lo comprueba tiene que mirar después del desvanecido, no durante.
- Los bancos **comparten el módulo `toast.ts`**, porque es uno solo en el proceso.
  Al empezar la sección de la retirada, la pila ya tenía dentro lo que fue
  dejando la cola de nanitas de los bancos anteriores (`Guardado. Tu progreso ya
  está en la nube`, `Recuperadas 3.24 K nanitas...`). No es un residuo del stub:
  es el juego funcionando. `vaciarPila()` los espera en vez de borrarlos a golpes.

Las dos cosas son la misma lección: **un banco que mira el DOM hereda el estado
que dejaron los demás**, y por eso necesita vaciar lo que encuentra antes de
afirmar sobre lo que acaba de poner.

### Cómo se añade un banco

**Exactamente dos ficheros**, y es deliberado: añadir uno no debe obligar a tocar
el runner.

1. `verify/vite.config.ts` → `build.lib.entry`.
2. `verify/run.mjs` → el array `for (const banco of [...])`.

Y el banco exporta **`export default main();`** — la llamada, no la función.
Ver "Debilidad conocida" más abajo: con `export default main;` el banco terminaba
en silencio. Los bancos antiguos (`sellCheck`, `equipCheck`) definen su propio
`check`/`resumen` en vez de usar el kit; es historia, no lo imites.

### Debilidad conocida del banco

`check()` **no imprime**: solo apila en `rows`. `resumen()` imprime al final. Si
un banco **no llega a su `resumen()`**, no imprime absolutamente nada.

Por eso `run.mjs` envuelve cada banco en un `try/catch` que dice qué banco ha
reventado, y **el banco exporta `main()` ya invocada** (`export default main();`,
no `export default main;`). Con la función suelta, el `await` del runner recibía
un *function object*, que se resuelve en sí mismo sin ejecutar nada: el banco
terminaba en silencio, sin una línea y sin error. Pasó con `queueCheck` y costó
un rato. **Un banco que no imprime no es un banco que pasa.** Si añades uno y no
ves su resumen, investiga antes de dar la tanda por buena.

Depurar un banco suelto:

```bash
$env:ONE_BANK="gapCheck"; npx vite build --config verify/vite.one.config.ts
node verify/one.mjs gapCheck
```

**Los bancos que disparan el tick funcionan así.** `tickCheck` y `senalCheck`
sustituyen `setInterval` por uno que aparta los callbacks y disparan a mano el de
500 ms: es el tick de verdad —el mismo closure que en el navegador—, y sin esa
sustitución el runner no terminaría nunca. El `boot()` va **dentro** del
sustituto, porque el intervalo solo se registra si el jugador está presente en el
momento de construir el game loop.

Antes no: `one.mjs` arrastraba un entorno más
pobre que `run.mjs` y cuatro bancos morían antes de imprimir, con un error que no
señalaba su causa. Los dos runners toman el entorno de `verify/entorno.mjs`, así
que ya no pueden separarse. Si añades un banco y no se puede depurar en solitario,
no es que el banco sea especial: es que ha salido algo que el entorno no cubre, y
eso se arregla en `entorno.mjs`.

Un banco que no imprime **no** es un banco que pasa. Y un banco que solo funciona
con el runner completo **tampoco**: si falla en solitario, el runner te está
contando que pasa algo que en realidad no has comprobado.

## 1.7 CSS y temas

`src/style.css` define los **tokens** de tema como variables CSS (fondo, acento,
acento-2, bordes, sombras) y tres capas: base → utilidades → animaciones.
`src/style.modules.css` contiene el sistema de diseño de las páginas.

- **Tailwind no tiene tokens**: `theme: { extend: {} }` está vacío **a propósito**.
  El theming es CSS, Tailwind es layout.
- `darkMode: 'class'`.
- `.rarity-*` centraliza el color de cada rareza. Antes estaba duplicado en 5
  ficheros y la ruleta perdía el color por un conflicto de clases `border`/`text`.
- `prefers-reduced-motion` se respeta en CSS **y** en JS. En JS la regla es
  "menos movimiento, **no menos confirmación**": se atenúa el squash a 0.35 pero el
  número flotante sigue saliendo.

---

# PARTE 2 — REGLAS

## 2.1 Arquitectura

### R1. La vista NUNCA muta el estado

Toda mutación pasa por la API de la closure de `createGameLoop()`. Las vistas
reciben `game` y llaman. Si necesitas mutar algo y no hay método para ello,
**el método falta**, no es que la vista tenga que hacerlo.

> Concentrar la mutación en el game loop también evita que la vista y el cálculo
> discrepen.

Esta regla es la que cerró el bug de "las cajas no se consumían": la vista restaba
el item y el contador se recalculaba antes de tiempo.

### R2. Una sola fuente de verdad por regla

Las reglas compartidas viven en `src/data/*`, **no** en el game loop ni en la
vista: `stacking.ts`, `valuation.ts`, `crafting.ts`, `prestige.ts`, `items.ts`,
`tiers.ts`, `tree.ts`, `cosmetics.ts`, `achievements.ts`.

Y **`verify/kit.ts` no reimplementa ninguna regla del juego**, porque una
reimplementación pasa las pruebas justo cuando el juego está roto.

### R3. Muestra el mismo número que cobras

Si la UI enseña un precio, una probabilidad o un coste, ese número sale de una
función del game loop. Nunca de una copia.

`previewUpgradeChance`, `previewUpgradeCost`, `getSellPrice`, `getSellTotal`,
`getClickDamage`, `canBuyStoreItem`, `getCapacity`, `getCompanionSlots`.

El botón y el cargo **no pueden discrepar**. `store.ts` delega en
`game.canBuyStoreItem()` para exactamente eso, y la hoja de detalle del almacén
en `game.getSellTotal()`.

> Un "no compres" que descuenta las nanitas es peor que un bug visible, porque el
> jugador pierde el saldo sin ver por qué.

**Y `getSellPrice` es el UNITARIO, no lo que se cobra por una pila.** Vender una
pila de 19 llaves cobra 19 veces el precio de una. Por eso existe
`getSellTotal()`: el botón "Vender" pintaba el unitario y se cobraba el total, así
que el jugador veía "Vender · 480 ◆" y le cobraban 9.120. Cuando añadas una
pantalla que enseñe un precio, pregunta cuál de los dos necesitas, y no lo
calcules en la vista: la fórmula vive en el game loop y las dos funciones la
comparten.

### R4. Nunca lances al usuario

Las operaciones mutantes devuelven objetos de resultado, no excepciones:
`{ ok, msg? }`, `{ success, msg? }`, `false`, o el item.

```ts
const r = game.sellItem(id);
if (!r.ok) return showToast(r.msg, 'error');
```

Los `try/catch` registran y continúan. Nunca re-lanzan. Prefijos en la consola:
`[auth]`, `[bloqueo]`, `[cola]`, `[audio]`.

**El juego nunca se cae.** Una lectura fallida se traga y se arranca con los
defaults. El modo privado del navegador no puede tumbar la partida.

## 2.2 Render y DOM

### R5. `mountInto()` reemplaza el nodo interno, nunca el contenedor

Este es el patrón que sostiene el render del proyecto entero.

```
#app  (lo cachea main.ts UNA vez — no se sustituye NUNCA)
  └── [data-page-root]   ← esto es lo que mountInto() reemplaza
```

Todos los listeners van **sobre el nodo nuevo**. Si van sobre `#app`, se acumulan
en cada render y una acción se ejecuta N veces. Ese fue el bug de "a veces
funciona y a veces no".

Excepción: en la vista base se usa `app.onclick = ...` (asignación de propiedad),
que se sustituye en vez de acumularse.

### R6. El estado que sobrevive a un render es de módulo

```ts
// components/store.ts
const ui = { category: 'cajas', detail: null, stripScroll: 0 };
```

Vivir dentro de la función que se re-pinta significa reiniciarse en cada render.
En la Forja, marcar tres piedras se alternaba hasta cero. En el Perfil, las
pestañas nunca cambiaban.

### R7. Los valores calientes se parchean, no se re-renderizan

Cada 500 ms se actualizan valores concretos: `textContent` de una lista de ids
conocidos, `data-*`, `style`. Re-renderizar entero por un número que cambia dos
veces por segundo es lo que hace que un móvil se quede sin batería.

`buffHud.ts` parchea `[data-role="time"|"bar"|"value"]` en sitio, con un flag
`built` para no reconstruir. `store.ts` tiene un intervalo de 400 ms que solo
commuta atributos `data-afford`/`data-blocked` y **se suicida solo** si
`root.isConnected` es falso.

### R8. `data-*` lleva la semántica; las clases llevan el aspecto

Ningún manejador debe leer `className` para decidir lógica. El estado viaja en
`data-blocked`, `data-afford`, `data-gap`, `data-cell`, `data-act`…

> Antes el manejador sniffaba `className.includes('opacity-50')`, así que cambiar
> el estilo de un botón rompía en silencio la lógica de la compra.

La convención es delegación: un solo listener en el nodo recién montado, con
`e.target.closest('[data-x]')`.

### R9. Invariante del almacén: `data-cell` es índice de celda, `data-painted` es posición pintada

Son **conceptos distintos** y confundirlos reintroduce el bug de celda desfasada.

`visibleStacks()` devuelve las celdas en orden. El pintor intercala las celdas de
hueco, así que **el índice pintado y el índice de celda dejan de coincidir**. Por
eso:

- `data-cell` = índice dentro de `celdas`. Solo en items reales.
- `data-painted` = posición real en la rejilla.
- `data-gap` = hueco del jugador anclado al item que sigue. **Lleva `data-gap` y
  NUNCA `data-cell`**, porque un `data-cell` ahí haría que `closest('[data-cell]')`
  resolviera a un item que no existe.

Y `visibleStacks()` es la **única** fuente de filtro y orden: para el pintado y
para el arrastre. Dos fuentes de verdad aquí fue lo que hizo que soltar en la
celda 3 mandara el item a la posición 3 del array con el almacén ordenado por
valor.

### R10. Nada de framework, y no es casual

Template literals con clases de Tailwind → `mountInto()`. Para overlays
(modales, toasts, selectores) se usa `document.createElement` + `appendChild` al
`body`.

## 2.3 Guardado

### R11. Coacciona al cargar. Nunca confíes en el save

Cada lectura de Firestore lleva `?? default` o una guarda explícita
(`Array.isArray`, `typeof`). Cuando el dato se puede deducir de otro, se deduce:

- `tier` ausente en una llave → del nombre.
- `buffId` ausente en un consumible → del nombre.
- `damage` ausente en un recolector → del rango del tier.
- Contadores huérfanos (llaves, cristales) → se materializan como items.

Y `SAVE_VERSION = 7` gobierna las migraciones irreversibles. Se sube **solo** con
una migración escrita, y solo se aplica cuando `savedVersion` es menor.

`setDoc` usa `merge: true`, así que **nunca borra claves**. Por eso el renombre
`weapon`→`collector` no se puede resolver borrando: hay que reescribir.

### R12. La cola se escribe antes de la red, y se vacía después de confirmar

Protocolo de tres pasos de `saveToFirebase()`. La cola guarda un **snapshot
absoluto con marca de tiempo**, no un incremento — y esto no es un detalle de
implementación, es lo que evita el truco de farmear núcleos con un prestige y una
recarga sin red.

### R13. Cada comprobación acaba en `reload()>

Lo que solo vive en memoria no está guardado, y ese es **exactamente** el bug que
más veces ha llegado a producción.

```ts
const g2 = await reload();   // como si el jugador pulsara F5
check('sobrevive', nanites(g2) === 700, 'nanites=' + nanites(g2));
```

## 2.4 Móvil y CSS

### R14. `dvh`, no `vh`

`vh` no cambia al aparecer la barra del navegador en móvil y produce un salto.
`dvh` sí.

### R15. `env(safe-area-inset-*)` en todos los bordes

Notch y barra de gestos. Es lo que separa "se ve bien en mi móvil" de "se ve bien
en el mío".

### R16. Zonas táctiles de 44 px como mínimo

Con `min-width`/`min-height` en línea cuando hace falta. Ningún control accionable
por debajo, y **sin depender de `:hover`**.

### R17. Pointer Events para el arrastre

Un solo camino para dedo, ratón y lápiz. `setPointerCapture`, umbral de 8 px para
que un toque no sea un arrastre, y `touch-action: none` en las celdas para que
2 px de dedo no hagan scroll.

> Si `document.elementFromPoint` no devuelve la celda señalada, el arrastre es un
> no-op aunque la lógica sea perfecta. Por eso `verify/` no lo puede cubrir y
> existe `drag-test.html`.

### R18. `overscroll-contain` en las zonas de scroll

Sin esto, el scroll de una hoja inferior arrastra la página entera detrás.

### R19. Accesibilidad donde se nota, no como decoración

`<label>` reales, `role="alert"` en errores, `aria-label` en botones de solo
icono, `aria-pressed` en toggles, `aria-hidden` en lo decorativo, `role="tablist"`
en pestañas, `aria-current="page"` en la navegación, `role="dialog"` +
`aria-modal` en modales, foco al confirmar y Escape para cerrar.

Lo que **no** hay: trampa de foco en las hojas inferiores, ni skip-link.

### R20. Accesibilidad al audio y al reduced-motion

La música se **suspende** al pasar a segundo plano (no es que se ponga a mute: se
desconectan los nodos, sin fugas). Con `prefers-reduced-motion` se atenúa el
squash del recolector a 0.35 y se suprime el anillo, pero **el número flotante
sigue saliendo**: menos movimiento, no menos confirmación.

## 2.5 Código

### R21. Comentarios en español, y argumentos

Es la característica más marcada del repositorio, y no es decoración.

- Cabecera `// ===...===` en casi todos los ficheros: qué es y por qué.
- JSDoc en toda función no obvia, que **menciona la alternativa descartada**:

  > `moveItems()` — POR QUÉ UN ANCLA Y NO UN ÍNDICE. Los índices se mueven con
  > cada venta y reordenación; un hueco guardado como "celda 5" se deslizaría a un
  > item distinto después de la primera compra, sin avisar.

- Comentarios en mayúsculas para las reglas que sostienen el sistema:
  `// POR QUÉ NO SE SUSTITUYE EL CONTENEDOR.`, `// EL TOPE POR QUÉ.`,
  `// LA REGLA DE ORO`.
- Comentarios HTML dentro de los template literals, con la misma función.
- Los datos muertos o duplicados se explican en lugar de borrarse a ciegas.

**Si añades un bloque, que args.** Un comentario que repite el código es ruido.

### R22. Convenciones de nombre

| Cosa | Patrón | Ejemplo |
|---|---|---|
| Módulo | `camelCase.ts` | `gameLoop.ts`, `naniteQueue.ts` |
| Banco de pruebas | `<subject>Check.ts` | `sellCheck.ts`, `gapCheck.ts` |
| Constante | `SCREAMING_SNAKE_CASE` | `STORE_ITEMS`, `MAX_STACK` |
| Tipo | `PascalCase` | `CollectorItem`, `PassiveBonuses` |
| Función | `camelCase` | `sellItem`, `moveItems` |
| Entry point de render | `render<Thing>` | `renderStoreTab`, `renderProfilePage` |
| Overlay | `show<Thing>` | `showToast`, `showConfirmModal` |
| Servicio | verbo primero | `consultarBloqueo`, `anotarPendiente` |

Rutas en HTML: `kebab-case` (`auth-preview.html`). Todo el texto de cara al
jugador y casi todos los comentarios, en español.

### R23. Imports

- **Solo relativos.** No hay aliases y no se añaden.
- **Sin barrels.** No hay `index.ts`.
- **Exports con nombre.** No hay `export default` en `src/`.
- `isolatedModules` está activo: los re-exports de tipo usan `import type`.
- Los ciclos se evitan con `import type` + un comentario que lo dice
  (`data/items.ts` importa `CrateType` desde `../gameLoop` solo como tipo).

### R24. `any` es deliberado en la frontera

`game: any`, `state: any`, `w: any`. El estado real es el objeto literal dentro de
`createGameLoop()`, y los tipos de `types/domain.ts` son el modelo de dominio, no
el tipo de trabajo. **No pases un rato "arreglando" los `any`** sin un plan de
migración; es un cambio de una tarde, no un cleanup.

Lo que sí es un bug: mezclar los dos modelos de tipos. `types.ts` es **vestigial**
y contradice los valores reales (`warehouseCapacity: 20` vs 15, `maxCompanionSlots:
3` vs 1). `state.ts` y su `defaultState` **no los importa nadie**. Si los necesitas,
no te fíes: mira `gameLoop.ts`.

### R25. Nunca confíes en el texto del jugador ni en el del admin

Hay **una** función de escape, en `components/blocked.ts`, y se aplica al motivo
del bloqueo, que lo escribe un admin. En el resto del juego la interpolación de
`item.name` / `item.details` va sin escapar, porque el guardado se considera
confiable.

Si añades un dato de entrada externa, **escápalo**.

### R26. `resolveIcon` / `icSafe` para datos externos

`ic(name)` con un nombre que viene de un achievement o de un nodo del árbol puede
devolver `undefined` y pintar literalmente la palabra "undefined" en el HTML. Para
datos, siempre `icSafe()`, que cae a un icono por defecto.

## 2.6 Anti-regresión

### R27. `npm run build` y `npm run verify`, los dos, antes de dar algo por terminado

`build` hace `tsc` antes de empaquetar: es la puerta de type-check.
`verify` cubre la economía y el guardado. Ninguno de los dos cubre el pintado, y
`verify/` **no está** en el `include` de `tsconfig.json`.

Lo que ninguno de los dos cubre, y hay que mirar a mano o con los bancos
visuales:

| Cosa | Cómo se mira |
|---|---|
| Layout y overflow | `preview.html` con viewport real (390×844 y 1440×900), en varios temas |
| Navegación | `nav-test.html` |
| Arrastre real | `drag-test.html` con `?caso=<n>` |
| La ruleta | `ruleta-preview.html` |
| La pantalla de acceso | `auth-preview.html` |

El render en un iframe es la única forma fiable de comprobar los breakpoints de
Tailwind desde escritorio: redimensionar el documento no dispara los breakpoints.

### R28. Lo que solo vive en memoria es un bug

Ver R13. La mitad de `stateCheck` existe por esto.

### R29. Si una regla compartida cambia, se cambia en `src/data/`

Y si esa regla la necesita una prueba, **la prueba no la reimplementa**: monta
partidas con `verify/kit.ts` y deja que el juego la aplique.

## 2.7 Firestore y admin

### R30. El bloqueo es fail-open a propósito

`consultarBloqueo()` nunca lanza. La contrapartida, escrita en el propio código: un
bloqueo puesto justo en el momento del corte de red no se aplica hasta el
siguiente intento. **Se acepta.**

### R31. La terminal admin no tiene control de acceso propio

Solo las reglas de Firestore deciden. `src/admin.ts` lo dice en su cabecera y lo
repite al final: publicar `admin.html` no concede nada, pero construirlo tampoco lo
protege.

---

# PARTE 3 — MAPA DE FICHEROS

```
index.html / admin.html          Los dos entry points que se construyen.
firestore.rules                  Seguridad de los datos. Comentada en español.
vite.config.ts                   Solo el input multipágina. Sin plugins.

src/
  main.ts                        Composition root: auth → initGame → rutas → updateUI.
  gameLoop.ts                    EL MOTOR. Estado, tick, I/O, migraciones. ~2900 líneas.
  firebase.ts                    initializeApp + auth + db. 20 líneas.
  achievements.ts                Definiciones de logro + evaluador.
  theme.ts                       6 temas, en localStorage.
  state.ts                       VESTIGIAL. No lo importa nadie.
  types.ts                       Tipos legacy/paralelos. Contradice los valores reales.
  admin.ts                       Terminal de administración (entry aparte).
  style.css / style.modules.css  Tokens de tema y sistema de diseño.

  types/domain.ts                El modelo de dominio canónico.
  data/                          LAS REGLAS DEL JUEGO, en datos puros:
    tiers.ts                       Rangos de poder y rareza por tier.
    items.ts                       Llaves, cristales, qué llave abre qué.
    stacking.ts                    Una pila es una ranura.
    valuation.ts                   Precio dinámico.
    crafting.ts                    Forja, potencial, afijos.
    prestige.ts                    Núcleos y agregación del árbol.
    tree.ts                        Los 24 nodos.
    cosmetics.ts                   Los 25 cosméticos.
    achievements.ts                Recompensas y lista de secretos.

  components/                   Pantallas y sus helpers puros.
    warehouse.ts                   El más grande. Rejilla, arrastre, huecos, venta, cajas.
    store.ts / crateLoot.ts / crateRoulette.ts / tuningRoulette.ts
     rouletteStrip.ts            La mecánica del trompo, compartida por las dos
     rouletteSpin.ts             ruletas: ventana, casillas, chasquidos y frenado.
                                SIN imports a propósito: es lo que lo hace
                                comprobable sin navegador (`rouletteCheck`).
    rankings.ts / auth.ts / blocked.ts
    crates.ts / upgrades.ts        HUÉRFANAS. No las importa nadie.

  ui/                           Cromo y páginas.
    router.ts / layout.ts / pageShell.ts
    forgePage.ts / prestigePage.ts / profilePage.ts
    playerPanel.ts / buffHud.ts / icons.ts

  services/                     Backend.
    naniteQueue.ts                 La cola offline. La pieza más cuidadosa.
    rankingService.ts / adminService.ts / bloqueoService.ts

  utils/                        audio.ts, format.ts, modal.ts, toast.ts.

verify/                         El banco de pruebas. No está en tsconfig.
  vite.config.ts / run.mjs / one.mjs / entorno.mjs / kit.ts / domStub.ts / stubs/
  <subject>Check.ts              19 bancos.
docs/                           Este directorio.
```

---

# PARTE 4 — PROTOCOLO DE SESIÓN

**Al abrir cualquier sesión nueva, antes de tocar nada:**

1. **Leer los tres ficheros de `docs/`:**
   - [`CONTEXTO-JUEGO.md`](./CONTEXTO-JUEGO.md) — qué es el juego y cómo funciona.
   - [`REGLAS-Y-TECNOLOGIAS.md`](./REGLAS-Y-TECNOLOGIAS.md) — este fichero.
   - [`CAMBIOS-MACRO.md`](./CAMBIOS-MACRO.md) — por qué es como es.
2. **Si vas a tocar el almacén**, también
   [`huecos-almacen.md`](./huecos-almacen.md).
3. **`git status` y `git diff`** antes de investigar cualquier cosa. El working
   tree tiene un lote grande sin commitear y **el working tree es la referencia,
   no el último commit**.
4. Comprobar si hay **otro agente editando** el directorio. Ocurre:
   `docs/huecos-almacen.md` se escribió precisamente para advertir de ello.
   Revisa `LastWriteTime` de los ficheros antes de asumir que un fichero está quieto.
5. **`npm run build` y `npm run verify`** para tener la línea base antes de
   tocar nada. Los **19 bancos** dan **1293 pruebas**, todas en verde.

   Y el total **varía en ±1 según la ejecución**: `playthroughCheck` tiene un
   `check()` dentro de un `if` que depende de qué botín salió de la caja, así que
   esa prueba solo existe cuando el premio son nanitas. Por eso dos commits
   seguidos discutieron si eran 962 o 963. Un total exacto no es un dato que se
   pueda comprobar: lo que se comprueba es que todos los bancos impriman.

> **Las cifras de la tabla de arriba se comprueban, pero no se acumulan.** Cuando
> se añadió un banco o se amplió una sección, la tabla se quedó con los números
> de entonces en tres filas (`buyCheck`, `stateCheck`, `playthroughCheck`) mientras
> el total de abajo sí se actualizaba, así que la suma de las filas no daba el
> total. Un documento con cifras que no cuadran entre sí enseña a no fiarte de
> las que sí importan. Si añades pruebas, actualiza la fila **y** comprueba que
> la suma da el total.
6. Para lo que `verify/` no cubre: `preview.html`, `nav-test.html`,
   `drag-test.html`, `ruleta-preview.html`.

**Al terminar una sesión:** `npm run build` + `npm run verify`, y si el cambio
toca la economía o el guardado, **una prueba nueva en el banco que corresponda**
más una entrada en la lista de discrepancias de `CONTEXTO-JUEGO.md` si queda algo
sin resolver.
