# Contexto del juego — Cyber-Forge: Imperio de Nanobots

> **Estado de este documento:** refleja el árbol de trabajo tal y como estaba cuando
> se escribió. Ojo: hay otro agente editando `src/` y `verify/` en este mismo
> directorio de forma activa, así que el contenido puede quedar viejo en horas.
> Si algo no cuadra con el código, el código manda.

---

## 1. Qué es

Un **juego incremental web** (tipo clicker/idle) en español. El jugador recolecta
**nanitas**, las gasta en una tienda, las deja producir solas, acumula
recolectores y compañeros, y de vez en cuando reinicia todo (**Ascensión**) a
cambio de núcleos que desbloquean un árbol de pasivas permanente.

- **Dónde se juega:** navegador, una sola página, sin instalación.
- **Cómo se guarda:** en Firestore, por usuario. No hay servidor propio.
- **Cómo se entra:** Firebase Auth. El "nombre" del jugador se convierte en un
  email interno (`<nombre>@cyberforge.game`) con contraseña.
- **Idioma:** todo el texto de cara al jugador es español, incluidos errores y
  avisos. No hay i18n y no hay intención de añadirlo.
- **Dónde NO se juega:** `admin.html` es una terminal de administración aparte,
  con su propio entry de Vite. No es una vista del juego.

## 2. La pantalla

Siete vistas enrutadas, sin URLs — el estado vive en un único objeto guardado,
así que recargar tiene que devolver exactamente lo mismo (`src/ui/router.ts:1-22`).

| Ruta | Nombre | Qué se hace ahí |
|---|---|---|
| `base` | Base | El recolector grande que se clickea, el escuadrón, el HUD de buffs y el ingreso pasivo. Es la única vista con el botón de recolector. |
| `almacen` | Almacén | Rejilla de celdas con arrastre, filtros, orden, venta, uso, apertura de cajas y huecos. |
| `tienda` | Mercado | 7 categorías: cajas, recursos, cartas, forja, mejoras, compañeros, recolectores. |
| `forja` | Forja | 3 materiales → 1 recolector, con probabilidad visible antes de confirmar. |
| `perfil` | Perfil | Tarjeta de identidad (título/marco/banner), mejor recolector, logros, cosméticos. |
| `prestigio` | Ascensión | Núcleos, qué se pierde y qué se conserva, y el árbol de 24 nodos. |
| `ranking` | Ranking | 4 tablas globales. Solo accesible desde la cabecera. |

En móvil la navegación es una **barra inferior de 5 destinos** (Base, Almacén,
Forja, Tienda, Perfil) y en escritorio pasa a la cabecera. Ranking y Ascensión se
alcanzan desde arriba. La barra vive en `pageShell`, así que **las seis páginas
secundarias también la tienen** (`ui/pageShell.ts`).

**El tick del juego (500 ms) nunca se detiene al navegar.** Sigue corriendo en
cualquier vista. Esto se corrigió explícitamente: antes se congelaba al entrar al
almacén.

## 3. El bucle de juego

### 3.1 Las dos fuentes de ingreso

- **Click** — `getClickDamage()` es el número que la UI tiene que mostrar. Nunca
  recalcularlo en la vista.
- **Pasivo** — los compañeros activos suman `passiveIncome`, y se cobra **una vez
  por segundo y entero**, aunque el tick corra a 500 ms. El HUD lo anuncia como
  "+5 / segundo", y el número grande tiene que moverse de 5 en 5: al cobrar la
  fracción del tick el saldo subía 2,5 por vuelta y `Math.floor` lo pintaba como
  una alternancia de +2 y +3 (307 → 309 → 312 → 314), que se leía como tirón. Lo
  cubre `tickCheck`.

Ambos multiplican por: compañeros tipo `multiplier` → logros → árbol de pasivas →
afijos del recolector equipado. El orden está en `calculateClickDamage()`
(`gameLoop.ts:1479-1494`) y en `recalculatePassiveIncome()` (`gameLoop.ts:1435-1455`).

### 3.2 El tiempo que no corre

Este es el eje del que más se ha hablado en el proyecto, y la regla es tajante:

> **Nada de ingreso pasivo si el jugador no está mirando la pantalla.**

Se unificó en `isPlayerPresent()`: pestaña visible **Y** ventana con foco. Se
cubre `blur/focus`, `visibilitychange`, `pageshow/pagehide` y Page Lifecycle
(`freeze`/`resume`). El tick se detiene al ausentarse y el watchdog comprueba la
presencia en cada tick, por si se pierde algún evento del sistema operativo.

Cuando el jugador vuelve, el cobro del tiempo ausente usa **`performance.now()`**
(reloj monótono): cambiar la hora del sistema no puede inflarlo. Y se acota por
tres independientes: el buff AFK restante, y el tope duro de 30 minutos.

### 3.3 El almacén

- Capacidad en **pilas**, no en entradas del array. 20 llaves apiladas = 1 ranura.
- Tres tipos de objeto: `collector`, `companion`, y apilables (`crate`,
  `consumable`, `key`, `crystal`).
- **Huecos**: el jugador puede dejar celdas vacías a propósito antes de un item
  (`warehouseGaps`). Es una preferencia de disposición, **no consume capacidad**.
  Se crean arrastrando un item a cualquier celda vacía de la rejilla, que es un
  tablero: el item cae exactamente donde se señala y los demás no se mueven.
  Especificación completa en `docs/huecos-almacen.md`.

## 4. Los sistemas

| Sistema | Qué hace | Dónde vive |
|---|---|---|
| **Recolectores** | Clickers equipables. Daño × nivel. Se afinan con cristales (sube el nivel, puede fallar). T1-T10. | `gameLoop.ts`, `data/tiers.ts` |
| **Compañeros** | Aportan ingreso. Tipos `click` / `passive` / `multiplier`. 1 ranura de base, 5 de tope. | `gameLoop.ts`, `data/tiers.ts` |
| **Cajas** | 4 tipos (común/rara/épica/legendaria). Necesita llave de nivel igual o superior. Tabla de botín con pesos en `crateLoot.ts`. | `components/crateLoot.ts` |
| **Ruleta de cajas** | 21-31 casillas según la ventana, 5.2 s. **Solo muestra**: el premio ya está decidido antes de girar. | `components/rouletteSpin.ts` (los números), `rouletteStrip.ts` (el carril), `crateRoulette.ts` (el cartel) |
| **Sintonizador** | 17-25 casillas, 2.4 s, 2 vueltas. **También solo muestra**: el motor tira el dado y la ruleta enseña el `success` que ya vino. | `components/tuningRoulette.ts`, `crystalPicker.ts` |
| **Forja** | 3 recolectores del mismo tier → 1 del siguiente. Potencial 1-5, afijos heredados, autor, fecha. | `data/crafting.ts`, `ui/forgePage.ts` |
| **Afijos** | 14 afijos en 6 rarezas. Modifican daño, pasivo y suerte de forja. | `data/crafting.ts:42-71` |
| **Valoración** | El precio es dinámico: tier × nivel × rareza × potencial × afijos × fama × antigüedad. El jugador se queda el 42 %. | `data/valuation.ts` |
| **Ascensión** | Reinicia progreso a cambio de núcleos. Umbral: 1 M de producción. Curva `(produccion / 1e6)^0.6`. | `data/prestige.ts`, `ui/prestigePage.ts` |
| **Árbol de pasivas** | 24 nodos, 5 columnas, requisitos cruzados. Se paga con núcleos. | `data/tree.ts`, `ui/prestigePage.ts` |
| **Logros** | 15 (13 públicos + 2 secretos). Recompensa pasiva de click y pasivo. | `achievements.ts`, `data/achievements.ts` |
| **Cosméticos** | 34: 10 títulos, 7 marcos, 8 banners y 9 de caja. Casi nada se vende: se obtiene con logros, núcleos, ranking o cajas. | `data/cosmetics.ts` |
| **Ranking** | 4 tablas. Puntuación = nanitas + logros×50 000 + secretos×250 000 + firmas×20 000. Se reordena en cliente. | `services/rankingService.ts`, `components/rankings.ts` |
| **Cola offline** | Write-ahead log en `localStorage`. Antes de tocar la red, el saldo está en disco. | `services/naniteQueue.ts` |
| **Bloqueo** | Un admin puede suspender una cuenta. Fail-open a propósito. | `services/bloqueoService.ts` |
| **Terminal admin** | Otorgar/fijar nanitas, editar campos, bloquear, borrar. | `src/admin.ts`, `services/adminService.ts` |

### 4.1 La Ascensión: qué se pierde y qué se conserva

Esto se muestra explícitamente al jugador en la página, y es la decisión de
diseño más discutida del proyecto.

**Se pierde:** nanitas, producción total, ingreso pasivo, clics, cajas abiertas,
llaves, cristales, **toda** la capacidad del almacén (vuelve a 15), las ranuras de
compañero (vuelve a 1), las tarjetas AFK, el recolector equipado, todos los
compañeros menos el de inicio, **y el almacén entero — incluidos los recolectores
forjados a mano**.

**Se conserva:** núcleos, `totalCores`, número de reinicios, el árbol de pasivas,
esquirlas, firmas realizadas, logros y cosméticos.

El almacén vacío después de la Ascensión es intencionado. Forjar de nuevo es el
bucle de progresión.

## 5. Guardado y su red de seguridad

`saveToFirebase()` es un protocolo de tres pasos (`gameLoop.ts:1510-1607`):

1. **`localStorage` primero, síncrono.** El saldo queda en disco antes de tocar
   la red. Esto es lo que hace que un fallo de red cueste cero.
2. **`setDoc(users/{uid})` + `setDoc(rankings/{uid})`**, con `merge: true`.
3. **Solo si ambos confirman, se vacía la cola.**

La cola guarda un **snapshot absoluto con marca de tiempo**, no un incremento.
Por eso un reinicio de prestigio no se deshace al recargar sin red, y por eso un
documento más nuevo (otro dispositivo) gana. La mitad de `queueCheck` son
pruebas de *abuso*: casos en los que la cola **no** debe aplicarse.

Un fallo de guardado **nunca** propaga: se registra, se avisa **una sola vez** y
el juego sigue. La cola conserva el saldo para el siguiente intento.

## 6. Discrepancias conocidas

Documentadas a propósito. No son secretos que arreglar de golpe: son trampas
conocidas, y escribirlas aquí es más útil que olvidarlas.

1. **La "Llave de Cifrado" de la tienda es en realidad una llave de nivel 1.**
   La carta pone `label: 'Llave de Cifrado'` y lo que entra es una de nivel 1
   ("Llave Reforzada"): el jugador paga por una llave y recibe otra, y por poco
   (`cost: 480` en `KEY_DEFS[1]` frente a los 250 que cobra la carta).
   **Lo que sí se arregló** fue la mitad que rompía la coherencia de la pantalla:
   `previewStoreItem` anunciaba `KEY_DEFS[0]` (nivel 0) mientras la compra creaba
   nivel 1, así que la pregunta "¿cabe esto en el almacén?" miraba una pila que
   no era la del item entregado. Con el almacén lleno y una pila de nivel 0, el
   botón se encendía y al pulsarlo la compra fallaba (R3). Ahora las dos rutas
   leen `STORE_MATERIAL_TIER`. Lo cubre `stackCheck`.
2. ~~**El nivel de llave/cristal se pierde al aplicarlo desde una caja.**~~
   **ARREGLADO.** `rollCrateReward` pasa `keyTier`/`materialTier` y ahora el
   aplicador los respeta: `crystals: (n, materialTier) => grantCrystals(materialTier, n)`
   y `keys: (n, keyTier) => grantKeys(keyTier, n)`. El tipo `LootApplier` pasó a
   declarar `keys: (n, tier: KeyTier)` y `CrateReward.keyTier` a `KeyTier`, para
   que el compilador vigile el nivel en vez de aceptar cualquier `number`.

   El síntoma era la ruleta mintiendo: la legendaria anuncia "+N Llaves Rúnicas"
   (nivel 2) y "Cristales de Fase" (nivel 2), y llegaban Reforzadas y de Afino
   (nivel 1). Con el módulo de apilado era peor: todas las llaves de caja caían
   en nivel 1 y se fundían en una sola pila, así que la rúnica acababa en la
   misma celda que la de Cifrado sin forma de separarlas. Lo cubren seis pruebas
   nuevas en `stateCheck`, que clavan el dado con `rollPara()` para mirar la fila
   exacta de la tabla en vez de confiar en el sorteo.
3. ~~**`crystalPicker` lee el flag equivocado.**~~ **ARREGLADO.**
   `upgradeEquippedCollector` devuelve `{success, msg}` y la vista ramificaba
   sobre `res.ok`, que en ese objeto es `undefined`: `!undefined` es `true`, así
   que **toda** sintonización caía en la rama de error. Un acierto pintaba un
   toast rojo de "error" con el texto "¡Mejora exitosa!" dentro y sonaba el
   sonido de fallo; el fallo sí se veía bien, pero por casualidad.

   La causa raíz es que el game loop tiene **dos** convenciones de resultado y
   no están unificadas: `sellItem`, `useConsumable` y `openCrateBox` devuelven
   `{ ok, msg }`, mientras que `upgradeEquippedCollector`, la Forja y la Ascensión
   devuelven `{ success, msg }`. Unificarlo es lo pendiente.

   No lo detectó ningún banco porque `verify/` no tenía forma de mirar el
   ACIERTO: la sintonización tira un dado y las pruebas solo comprobaban los
   rechazos, que son deterministas porque no llegan al dado. Se añadió
   `conRoll()` al kit y se cubren las dos ramas, con `reload()` al final.
4. **Dos tablas de precio de caja.** `STORE_ITEMS` (500/1500/5500/21000) frente a
   `CRATE_META` (`crateLoot.ts:113-116` = 400/1200/4500/18000). La segunda es la
   que manda en los drops de nanitas y en la compensación cuando el almacén está
   lleno.
5. **La nanopartícula cuesta 90 000 en la tienda (`gameLoop.ts:186`) y 220 000 en
   `valuation.ts:145`.** El valor de la tienda es el que se cobra.
6. ~~**Los cosméticos nunca se desbloquean.**~~ **ARREGLADO.** `unlockCosmetic` ya
   tiene llamadores (`gameLoop.ts:2550` y `:2873`) y las cajas reparten cosméticos
   vía `crateCosmetics` (`data/cosmetics.ts:173`). Lo cubre `lootCheck`.
7. **Las esquirlas se acumulan y nunca se gastan**, aunque el JSDoc de
   `getForgeInfo` prometa lo contrario.
8. **Bonificaciones que no se consumen:** `crateLuck`, `offlineClicks`, y el
   `critChance` / `passiveMult` de los afijos en el ingreso pasivo.
9. **Código muerto:** `state.totalInfraestructure`, `COLLECTOR_BASE_COSTS`,
   `TIER_POWER`, `types.ts` (`GameState`, `defaultState`), `ProfileState`,
   `UserProfile`, y las pantallas `components/crates.ts` y
   `components/upgrades.ts` (huérfanas desde `f90abea`).
10. ~~**`MAX_COLLECTOR_LEVEL = 20` ignora `item.maxLevel`.**~~ **ARREGLADO**, y
    era **peor de lo que parecía**. La regla del techo de niveles estaba escrita a
    mano en **cinco** sitios y los cinco no coincidían:
    | Sitio | Qué usaba |
    |---|---|
    | Ficha del almacén, panel del jugador, valoración, desglose | `item.maxLevel ?? 20` |
    | `upgradeEquippedCollector` (game loop) | constante `MAX_COLLECTOR_LEVEL = 20` |
    | Selector de cristales | un **35** a pelo |

    De ahí dos bugs que no se parecían en nada. Un recolector forjado nace con
    `maxLevel: 20 + potencial * 3` (`data/crafting.ts`), o sea 23-35, y su ficha
    enseñaba una barra hasta 28: el jugador subía al 20, gastaba un cristal más y
    el juego le respondía "ya no puedes". Y al revés: un recolector de la tienda
    (techo 20) abría el selector de cristales, el jugador elegía, pagaba, y la
    sintonización se le rechazaba. Dos números distintos para la misma regla en la
    misma partida.

    Ahora el techo es `collectorMaxLevel()` en `data/crafting.ts`, junto a la
    fórmula que lo crea, y lo leen el motor y las tres vistas. Se borra
    `MAX_COLLECTOR_LEVEL` del game loop: dejar dos nombres para el mismo 20 es
    dejar la divergencia preparada.
11. **`syncWarehouseGaps()` está documentado en inglés** (`gameLoop.ts:1188-1200`),
    el único bloque del juego en ese idioma. Cosmético, pero rompe el patrón.
12. ~~**`docs/huecos-almacen.md` dice "sin implementar"**~~ **ARREGLADO.** La
    funcionalidad está implementada y cubierta por `gapCheck.ts`. El fichero se
    escribió para advertir de que otro agente editaba `src/` y `verify/` en el
    mismo directorio, y el aviso se quedó pegado al estado de la funcionalidad.
13. **La forja pierde valor total en T1-T4 y lo gana de T5 en adelante.**
    **No es un bug: es el cambio de cantidad a calidad, y está medido.** La curva
    de valor total (salida ÷ suma de las tres entradas) medida sobre el juego real
    es T1 0.64, T2 0.83, T3 0.83, T4 0.96, T5 1.08, T6 1.55, T7 1.38, T8 1.55.
    Es decir, fundir 3 de T1 (1.122 en tres ranuras) da 1 de T2 por 778: se pierde
    un 36% del total y se gana un 108% **por ranura**.

    Lo que sostiene el módulo es la densidad por ranura, y esa sube 1.68x a 3.92x
    en todos los tiers, con margen de sobra sobre el 15%. Está comprobado por
    `stateCheck` en los nueve tiers.

    Aquí estaba el agujero real: `valuation.ts` tenía `fusionIsProfitable()`, que
    afirmaba que la salida debe valer más que la entrada, con un comentario que
    decía "se usa en los tests". **No la usaba nadie y ningún test la usaba.** La
    regla que el proyecto creía tener escrita nunca se validó, y escrita como
    estaba era falsa. Ahora la función es `fusionImprovesDensity()` y mide lo que
    de verdad se sostiene. Si alguien rebalancea la forja, que sepa que subir el
    valor total del todo haría de fusionar la única acción óptima y el juego
    perdería la tensión de ranuras.

14. **Dos guardados a la vez se llevaban por delante la red de seguridad.**
    **ARREGLADO.** `saveToFirebase` no se espera en ninguno de los treinta sitios
    que la llaman, más un intervalo de 15 s y un `beforeunload`. Dos guardados
    solapados eran la norma, no el caso raro: el jugador compra mientras el
    guardado anterior sigue en el aire.

    El guardado A confirmaba su operación y vaciaba la cola **a pelo**, así que
    se llevaba la anotación de un guardado más nuevo que había fallado. El
    resultado depende del orden:
    - Si el más nuevo falla, se **fabrica** dinero: la compra que no se subió se
      olvida y el jugador se queda con el item.
    - Si el más viejo falla, se **pierde** dinero: el documento queda con la cifra
      vieja y no queda cola de la que recuperar.

    Ahora `anotarPendiente()` devuelve la marca que escribió y `confirmarCola(ts)`
    solo vacía si el registro que hay dentro es ese o uno más viejo. Cubierto por
    ocho pruebas nuevas en `queueCheck`, que comprueban **la regla** y no la
    carrera: la carrera se probó primero inyectando un retraso en el stub
    (`__MEM_DB__.retrasar`) y era **intermitente**, porque el retraso lo consumía
    el primer `setDoc` que llegara y en el runner completo eso es un guardado de
    una prueba anterior todavía vivo. Pasaba en `one.mjs` y fallaba en `run.mjs`.

    **Lo que esto NO arregla, y sigue abierto:** dos guardados que los dos
    terminan bien pueden escribirse en orden inverso, y el `setDoc` que lleva el
    snapshot viejo se escribiría después, dejando el documento unos segundos por
    detrás. Esa carrera se cura sola en el siguiente guardado —cada compra y el
    intervalo de 15 s—, mientras que la que se arregla aquí no se curaba nunca,
    porque la red de seguridad ya no estaba. La solución completa sería
    serializar los guardados, pero se probó y **empeora el juego**: aplazar la
    escritura hace que "comprar y recargar al instante" pierda datos.

15. **Recargar duplicaba el material: llaves y cristales de más.**
    **ARREGLADO.** `saveToFirebase` escribía `keys` (el total) pero **no**
    `keysByTier` ni `crystalsByTier`. Y al cargar, la migración reparte el material
    con esos cubos por nivel: `data.keys` es un TOTAL, así que meterlo en el cubo
    del nivel 0 compara un total contra una parte y siempre sobraba. Resultado: en
    cada recarga se materializaba material de más. La llave que acababas de gastar
    al abrir una caja volvía.

    El propio código lo describe en `gameLoop.ts:980-987` y hasta explica por qué
    existe el reparto por niveles: **el arreglo estaba escrito pero el campo que lo
    sostén no se guardaba**, así que solo vivía mientras la partida no se
    recargara. Ahora los dos cubos van en el guardado, también en el del reinicio
    de Ascensión.

    **No lo detectó ningún banco porque dos pruebas eran vacías.** El stub de
    Firestore guardaba el documento con una copia superficial, así que
    `__MEM_DB__.warehouse` era la MISMA matriz que `state.warehouse`: comparar el
    almacén tras recargar era comparar un array consigo mismo. Al hacer que el
    stub serialice como Firestore, dos pruebas se pusieron a mirar de verdad y una
    falló. Ver discrepancia 16.

16. **El stub de Firestore guardaba referencias vivas, no datos.**
    **ARREGLADO.** `setDoc` hacía `{...previo, ...data}`, una copia superficial: el
    documento retenía una referencia al array `warehouse` del juego. Un bucle que
    mutase su memoria reescribía el documento de otro sin guardar nada. Una
    prueba podía pasar por un estado que el juego nunca escribió, y una regresión
    de guardado podía esconderse detrás de un mutuo secreto entre dos bucles.

    Ahora clona al escribir y al leer, como serializa Firestore. Salió esto solo, y
    fue la causa de que la discrepancia 15 estuviera oculta durante tanto.

17. **La curva de poder por tier no está aplanada como dice la documentación.**
    **Medido, no arreglado: es una decisión de balance que no me corresponde.**
    `CAMBIOS-MACRO.md` cuenta que el coste por punto de poder era 32× peor en T10
    que en T1, y que tras el aplanado T10 salía "~1,3× mejor". Medido hoy con
    `getClickDamage()` sobre las diez cartas, la curva es: T1 9,4 · T2 7,5 · T3 8,8
    · T4 8,4 · T5 8,5 · T6 10,7 · T7 12,9 · T8 22,4 · T9 28,5 · T10 38,7. Es decir
    **T10 entrega ~5× más poder por nanita que el peor tier**, y la curva es una
    escalera que se dispara a partir de T8.

    La consecuencia es la del bug original, del revés: las cartas de tier bajo son
    trampas y no se compran nunca. `playthroughCheck` lo mide y lo deja como dato,
    con un guardia de 6× puesto por encima del valor real para que una subida de
    precios no lo dispare en silencio.

### Resumen

| # | Discrepancia | Estado |
|---|---|---|
| 1 | La llave de la tienda es de nivel 1, se anuncia de nivel 0 | **parcial**: la incoherencia de "¿cabe?" está arreglada, la etiqueta sigue mintiendo |
| 2 | El nivel de llave/cristal se pierde al aplicar el botín de caja | **arreglada** |
| 3 | `crystalPicker` lee `res.ok` en vez de `res.success` | **arreglada** (queda unificar las dos convenciones de resultado) |
| 4 | Dos tablas de precio de caja | sigue |
| 5 | La nanopartícula cuesta 90 000 en un sitio y 220 000 en otro | sigue |
| 6 | Los cosméticos nunca se desbloquean | **arreglada** |
| 7 | Las esquirlas nunca se gastan | sigue |
| 8 | `crateLuck` y `offlineClicks` no se consumen | sigue |
| 9 | Código muerto | sigue |
| 10 | El techo de niveles estaba escrito en 5 sitios y no coincidían | **arreglada** |
| 11 | Un docblock en inglés | sigue |
| 12 | `huecos-almacen.md` desactualizado | **arreglada** |
| 13 | La forja pierde valor total en T1-T4 | **documentada, no es bug** (la invariante real es por ranura y se cumple) |
| 14 | Un guardado confirmando vaciaba la cola de otro más nuevo | **arreglada** (queda la carrera inversa, que se cura sola) |
| 15 | Recargar duplicaba llaves y cristales | **arreglada** (`keysByTier` no se guardaba) |
| 16 | El stub de Firestore guardaba referencias vivas | **arreglada** (hacía vacuas dos pruebas) |
| 17 | La curva de poder por tier no está aplanada como dice el doc | **medida**: T10 da ~5× el poder por nanita del peor tier, no 1,3× |
| 18 | **Comprar y vender en bucle daba nanitas infinitas** | **arreglada** |
| 19 | El historico de nucleos se contaba dos veces en la primera Ascension | **arreglada** |
| 20 | La Forja y la Ascension se anidaban a si mismas al redibujar | **arreglada** |
| 21 | La sintonizacion no tenia ruleta: solo un toast | **arreglada** (y de paso, `rolled` en el contrato del motor) |
| 22 | El HUD y las fichas de companero enseyan un numero que no es el que entra en la cuenta | **arreglada** |
| 23 | Los clics automaticos del arbol no tenian ninguna senal | **arreglada** |
| 24 | El precio de las cartas NO seguia al poder: el T10 salia 3,7x mas rentable que el T1 | **arreglada** |
| 25 | Sintonizar un recolector a nivel maximo costaba un 4% del item: no habia decision | **arreglada** |
| 26 | Los companeros de tipo `passive` no anunciaban su ingreso: el Avatar del Vacio (power 65) salia de una caja y no mostraba nada | **arreglada** |

### 21. La sintonización no tenía ruleta — ARREGLADA

Gastar un cristal de mejora devolvía un toast: "¡Mejora exitosa!" o "Fallo en el
sintonizador". Era el único punto del juego donde el jugador arriesga un recurso
a una tirada, y se enteraba del resultado por una línea de texto. Una tirada que
solo se comunica así no se siente como una tirada.

Ahora hay ruleta (`src/components/tuningRoulette.ts`), con la misma ventana, el
mismo marcador y el mismo trompo que la de las cajas, y el resultado se enseña en
tres sitios a la vez: la casilla que gana, el cartel y el mensaje del motor. Los
tres tienen que decir lo mismo, que es lo único que sostiene la promesa de la
ruleta.

**EL CAMBIO DE CONTRATO EN EL MOTOR, que es lo que no se ve.** Para poder
enseñar el resultado hubo que separar dos cosas que `upgradeEquippedCollector`
devolvía juntas. `success: false` significaba las dos: *el dado salió mal* y *la
operación se rechazó antes de tirar*. Para el jugador son opuestas —una gastó el
cristal, la otra no gastó nada— pero el motor las devolvía idénticas. Con una
sola bandera, un rechazo hacía girar la ruleta entera por una operación que no
ocurrió, con un cartel de "FALLO" y un mensaje que hablaba de otra cosa.

La solución fue **un tercer estado explícito**: `rolled`, que dice si el dado
llegó a tirarse, más `level`, con el que se quedó. No se deduce en la vista,
porque deducirlo mirando si el cristal se gastó sería repetir en la vista la
regla de consumo del motor (R1 y R2). Lo dice el motor, que es el único que lo
sabe. Un `rolled` que llegue `undefined` —un mock viejo, un motor anterior— se
trata como "no hay ruleta", que es la salida que no le enseña nada falso al
jugador.

**LO QUE ESTO NO ESTÁ ARREGLADO, y sigue abierto:** la unificación de las dos
convenciones de resultado que menciona la discrepancia 3. `upgradeEquippedCollector`
devuelve ahora `{ success, rolled, level, msg }`, que es *más* campos que antes
sobre una convención que sigue siendo distinta de `{ ok, msg }`. La entrada nueva
no unifica nada: la hace más difícil de unificar de lo que estaba.

Cubierto por `rouletteCheck`, que además comprueba la geometría del giro. Esa
parte salió de otra sesión: `rouletteSpin.ts` (los números del trompo, sin un
solo import para poder comprobarlos en Node) y `rouletteStrip.ts` (el DOM que
comparten las dos ruletas).

Lo que `verify/` **no** cubre, y se miró a mano en `ruleta-preview.html`: que la
casilla que gana se pare **exactamente** bajo la aguja. Esa comprobación no se
puede escribir en el banco porque necesita medir píxeles. Se midió, y el
desfase es de 0 px.

### 22. Las fichas de compañero enseñaban un número que nadie cobraba — ARREGLADA

El HUD de la base y la ficha del panel pintaban `+{power}/s`, y el "+N" flotante
de cada compañero pintaba `+{power}`: el **valor desnudo** de la ficha. Lo que
entra en la cuenta es ese número después de `passiveMultiplier`, de los logros,
del árbol y del buff ×2. Con un multiplicador de 1,5 la ficha decía "+3 /s" y el
contador subía 4,5.

Es el mismo bug que la discrepancia 21 y el de "que la ruleta no mienta", con otro
disfraz: **la cifra que entra en la cuenta y la que se enseña venían por caminos
distintos**, y el jugador no tenía forma de saber cuál era la buena.

**El reparto no puede ser `floor(power × multiplicadores)` en cada ficha.** Los
floors no suman: con dos compañeros de 3 y ×1,5 el ingreso real es
`floor((3+3) × 1,5) = 9`, pero `floor(3 × 1,5)` son 4 y 4, que son 8. Así que el
motor reparte el ingreso ya entero, en proporción al peso de cada uno, con el
sobrante del redondeo repartido a partes iguales. La suma de las fichas es
exactamente `state.passiveIncome`.

Cubierto por `senalCheck`.

### 23. Los clics del árbol no tenían ninguna señal — ARREGLADA

El saldo subía por tres sitios a la vez: el click del jugador, el ingreso de los
compañeros y los **clics automáticos del árbol** (`auto_clicker` en el árbol de
pasivas). Los dos primeros tenían número flotante; el tercero **no tenía nada**:
entraba en la cuenta, sumaba `totalClicks`, y no se veía por ningún lado.

Ahora el motor anota cada click al cobrarlo, con la cifra ya redondeada que
entró, y la vista los anuncia al vaciar la cola. La cola es **solo de
presentación** —el dinero ya está en el saldo, así que perder un aviso cuesta
cero— y se descarta al volver de una pausa, para que al volver el jugador no
vea de golpe todos los "+N" de un rato entero.

De paso, `click()` ahora **devuelve** lo que entró. Antes la vista lo deducía
restando dos lecturas del estado, y esa resta no es un número que exista en
ningún sitio: con un buff activándose en mitad, la diferencia incluía dinero de
otro origen.

Cubierto por `senalCheck`.



### 18. Comprar y vender en bucle daba nanitas infinitas — ARREGLADA

El precio de reventa del material salia de `KEY_DEFS[tier].cost` y
`CRYSTAL_DEFS[tier].cost`, y en esas tablas `cost` es `null` para todo lo que no
se vende en la tienda, que es justo el material que suelta una caja. Con un numero
inventado en el `??`:

| Compra | Coste | Se revendia a | Ganancia por operacion |
|---|---|---|---|
| Llave de la tienda | 250 | 1.200 | **+950** |
| Cristal de la tienda | 60 | 4.320 | **+4.260** |

No era un desajuste de balance: era una maquina de imprimir nanitas. La causa raiz
es que llaves y cristales eran las **unicas dos cartas que no usaban la regla del
resto** — cajas, consumibles, companeros y recolectores ya vendian por
`Math.floor(cost / 4)`—. Ahora el material tambien, y el precio sale de
`STORE_ITEMS`, que es de donde sale el que se cobra.

**Lo que cambia de verdad, y no es trivial:** una llave suelta por una caja pasa de
valer 1.200 al venderla a 62, y un cristal de 4.320 a 15. Es una nerfee al botin de
caja, y es la consecuencia honesta de que el material es un consumible. Si algun dia
hay que recuperar ese valor, el sitio es `precioReventaMaterial()`: una funcion.

`buyCheck` gana la **invariante**, que es lo que faltaba: se compran las veinte
cartas que dejan un item en el almacen, se vende lo comprado y se mira el saldo. Si
alguna vez compra+venta deja algo positivo, salta. Ninguna prueba anterior lo
cubria, porque comprueban que el boton y el cargo coincidan —que es otra cosa— y no
que vender un item sea una perdida.

### 19. El historico de nucleos se contaba dos veces en la primera Ascension — ARREGLADA

`totalCores` es el historico de nucleos ganados y `nextCores` lo resta de lo que la
produccion actual justifica, asi que antes del primer reinicio tiene que ser cero.
No lo era, en dos sitios: al reciclar, si venia a cero se rellenaba con
`pendingCores()` —que ya esta incluido en `gained`—, y al cargar, con la misma idea
en `if (!data.totalCores)`. **La segunda es la que mas dolia, porque corre en cada
carga** y llenaba el historico de un jugador que no habia reciclado nunca.

La primera Ascension con 1 M de produccion daba los 8 nucleos correctos y dejaba el
historico en 16. Como `nextCores` resta el historico, el segundo ascenso no daba ni
un nucleo hasta producir **3,17 M en vez de 1 M**, y ninguna pantalla decia por que.

El relleno ahora solo ocurre con `resets > 0`, que es cuando el historico se puede
reconstruir de verdad. `stateCheck` paso de 203 a 212 con el caso que no miraba
nadie: todas las pruebas de prestigio partian de `totalCores: 12`.

### 20. La Forja y la Ascension se anidaban a si mismas al redibujar — ARREGLADA

`mountInto()` sustituye el `[data-page-root]` que es hijo del **contenedor**. Las dos
pantallas montaban bien la primera vez, pero al conectar los manejadores pasaban el
nodo ya montado donde hacia falta el contenedor. En la segunda llamada `mountInto` no
encontraba ninguna raiz hija y hacia `appendChild`: la pagina se metia dentro de si
misma y cada clic anadia una copia entera debajo. En la Ascension era peor, porque el
redraw no repassaba `go`: comprar un nodo montaba la copia sin rutas de navegacion.

Se recupera el contenedor con `root.parentElement`, el mismo truco de
`warehouse.ts`. Verificado en navegador con la condicion comprobable:
`root.querySelector(':scope > [data-page-root]')` devuelve `null` —o sea, el codigo
viejo hacia `appendChild`—, mientras que sobre el padre encuentra el nodo.

`verify/` no cubre esto, y no puede: es exactamente el tipo de cosa que necesita un
DOM de verdad.
## 7. Lo que NO está verificado

`npm run verify` cubre la **economía, el guardado, el botín y el ritmo del cobro**,
no el pintado ni la navegación. **24 bancos, 1542 pruebas.** El total varía en ±1
según la ejecución: `playthroughCheck` tiene un `check()` dentro de un `if` que
depende del botín. Queda fuera a propósito:

- Toda la capa de render (`ui/*`, `components/*` salvo sus helpers puros).
- `forgePage`, `profilePage`, `prestigePage`, `router`, `rankings`, `auth`.
- `services/*` salvo la cola, `theme.ts`, `data/tree`.
- `utils/*` salvo `toast.ts`, que sí tiene banco (`toastCheck`): es el único
  overlay cuyo comportamiento —que no se pisen y que lo repetido se cuente— se
  puede afirmar sin navegador. `modal.ts` sigue sin cubrirse.
- `data/cosmetics` solo está cubierto en lo que toca las cajas (`lootCheck`); los
  Caminos de logros, núcleos y ranking no.
- El **arrastre real por puntero**: solo se prueba a mano con `drag-test.html`,
  porque el destino se lee con `document.elementFromPoint` y si eso no devuelve la
  celda señalada el arrastre es un no-op aunque la lógica sea correcta.

Esos huecos se cubren con bancos de pruebas visuales, no automáticos:
`preview.html` (monta cualquier pantalla con datos de ejemplo y viewport real),
`nav-test.html` (recorrido automático de navegación), `drag-test.html`
(escenarios de arrastre), `auth-preview.html`, `ruleta-preview.html`.

## 8. Antes de tocar nada

Lee [`REGLAS-Y-TECNOLOGIAS.md`](./REGLAS-Y-TECNOLOGIAS.md) (reglas y stack) y
[`CAMBIOS-MACRO.md`](./CAMBIOS-MACRO.md) (por qué el juego es como es). Si vas a
tocar el almacén, lee también [`huecos-almacen.md`](./huecos-almacen.md).

Y antes de nada, `git status`: hay otro agente trabajando en este directorio y el
working tree va muy por delante del último commit.