# Cambios macro por actualización

Historial **macro**: qué cambió de verdad en el juego y por qué, no el detalle de
fichero. El detalle está en los mensajes de commit (`git log`) y en las cabeceras
`// ===...===` de cada módulo.

Rama: `main`. Último commit: `ce3a346` (fase 8).

> **Aviso importante sobre el estado del repositorio.** A la hora de escribir esto
> el árbol de trabajo tenía **un lote sin commitear** —la fase 8: la ruleta del
> sintonizador, la refactorización de la ruleta de cajas y la retirada del botón
> de huecos—, y buena parte de lo que se describe más abajo como "estado actual"
> **no estaba en el historial**. Ya se ha subido. Aun así, y porque durante esa
> fase pasó justo eso: **antes de investigar un comportamiento raro, comprueba
> `git status`.** Puede que lo que buscas esté solo en el working tree.

---

## Fase 0 — Cimientos (2026-09-28, `1e94510`, `87c8370`)

El juego nace con lo imprescindible: Firebase Auth, recolección por click y
pasiva, recolectores y compañeros, almacén con venta, rankings y temas.

La decisión que acabó siendo la más cara del proyecto ya estaba aquí: **el
estado vive en un objeto guardado en Firestore, no en URLs**. Por eso el router
es una pila y no un enrutador de rutas, y por eso recargar tiene que devolver
exactamente lo mismo.

`87c8370` añade tienda con filtros, modales y menú móvil.

## Fase 1 — Correr la economía (2026-09-30, `4440ff4`, `9318050`, `4ac6213`)

Cuatro commits seguidos de puro "esto no cuadra". Los cuatro tocaron
`gameLoop.ts` y destaparon la misma clase de problema una y otra vez:

**El gasto sin entrega.** Se cobraba y no se entregaba, o se entregaba y se
cobraba de más. La causa raíz era siempre la misma: **la vista mutaba el estado y
el contador se recalculaba antes de tiempo**. La solución que cerraría el
problema no llegó hasta `f4184fb` (fase 4): la vista deja de mutar.

**Los compañeros contaban dos veces.** Un compañero tipo `click` sumaba pasivo *y*
tenía su propio intervalo de 1 s. Se eliminado el doble conteo.

**Los multiplicadores no multiplicaban.** Un compañero tipo `multiplier` con
`power 0.5` sumaba 0.5 nanitas por segundo en vez de multiplicar por 1.5. Ahora
`passiveMultiplier = max(1, 1 + Σ power)`.

**La capacidad se cobraba sin entregar.** Comprar un slot de compañero con el
almacén lleno cobraba y no daba nada.

**El AFK no tenía duración real.** Ahora son 10 min por tarjeta con tope de 30,
`afkExpiresAt` persistido, y al volver de la pestaña se cobra el tramo oculto
**por diferencia de tiempo** — inmune al throttling del navegador.

**`getClickDamage()` nace aquí**, precisamente para que la UI muestrase el valor
real en vez de recalcular uno.

## Fase 2 — Presencia y honestidad (2026-09-30, `c67f94c`)

El commit más importante en la dirección del proyecto. Establece la regla:

> **Nada de ingreso pasivo si el jugador no está mirando la pantalla.**

- `isPlayerPresent()` unifica pestaña visible **Y** ventana con foco, y cubre
  `blur/focus`, `visibilitychange`, `pageshow/pagehide` y `freeze/resume`.
- El watchdog comprueba presencia en cada tick, porque se pueden perder eventos
  del sistema operativo.
- El cobro del tiempo ausente usa `performance.now()` (monótono): cambiar la hora
  del sistema no puede inflarlo.
- Se tapa una **fuga del listener `mousemove`** en `cleanup()`.

También trae el `buffId` estable: hasta aquí el almacén decidía el efecto de un
consumible **comparando su nombre**, lo que producía bugs como "Buff Clicks x2
nunca activaba su buff" (el `else if` pedía `'Clics'` y la comprobación de
`'Click x2'` se adelantaba). Los buffs pasan a **acumular tiempo** en vez de
reiniciarse, y se pueden **cancelar** con confirmación.

## Fase 3 — Contenido y rebalanceo (2026-09-30, `f5991a6`)

**Ruleta de cajas.** El principio que la define:

> Si la ruleta decidiera, mentiría sobre las probabilidades reales.

Así que la ruleta **solo muestra**: el premio sale de la tabla de botín con pesos
declarados en `crateLoot.ts`, y la animación es decorativa (y por CSS, no por
`rAF`, porque `rAF` no corre en pestañas ocultas).

Nace el concepto de **exclusivo de caja**: 6 compañeros y recolectores
"sobrecargados" que **no se compran**. Eso es lo que le da valor a la ruleta.

**Rebalanceo, y aquí está el patrón del proyecto.** Se descubrió que el coste por
punto de poder era **32× peor en T10 que en T1**, así que el jugador óptimo solo
compraba T1 y los 18 items de tier alto eran trampas. La curva se aplanó a
150-177 coste por punto en todo el rango. Lo mismo se repitió en `f90abea` con las
armas (166 → 506) y en los slots del almacén (el item "caro" era 40× peor que el
barato).

**Logros y audio.** Los logros existían pero `achievements.ts` **no lo importaba
nadie** y miraba `state.factories`, un campo inexistente. Se conectan de verdad, se
guardan y avisan. El audio nace con Web Audio API, sin ficheros externos.

Se arregla también que **el almacén se recortaba con `slice` y destruía items en
silencio**, incluido el arma equipada. Ahora `enforceWarehouseCapacity` prioriza.

## Fase 4 — El giro al diseño real (2026-09-30, `fb6f0b7`, `f90abea`)

`fb6f0b7` es el giro visual: sistema de diseño con tokens por tema, **iconos SVG
propios** que sustituyen a los emoji (que se renderizaban distinto en cada SO —
el 🕳️ salía como un óvalo negro en Windows), layout mobile-first con `dvh`,
`env(safe-area-inset-*)` y `overscroll-contain`. `main.ts` baja de 753 a 400
líneas separando presentación de lógica.

Bug de fondo que vale la pena recordar: `.app-bg` declaraba `position: relative` y
anulaba el `fixed` del contenedor raíz. El documento medía 842 px en una ventana de
526 px y rompía el layout móvil.

`f90abea` implementa **los ocho módulos** del diseño pedido:

| # | Módulo |
|---|---|
| 1 | Arquitectura multipágina con router propio |
| 2 | 25 cosméticos |
| 3 | Árbol de 24 pasivas en 5 tiers |
| 4 | Almacén con arrastre real por Pointer Events |
| 5 | Forja con potencial y afijos |
| 6 | Probabilidades visibles antes de confirmar |
| 7 | Valoración dinámica |
| 8 | Logros con peso en el ranking |

Tres correcciones sueltas de `f90abea` son la prueba de que el proyecto se depura
mirando el resultado, no el código:

- `rarityClass()` devolvía utilidades de Tailwind en vez del slug, así que
  `ring-${rarityClass()}` generaba clases inexistentes. Añadido `raritySlug()`.
- El estado de interfaz vivía **dentro de la función que se re-pinta**, así que se
  reiniciaba en cada render: en la Forja marcar tres piedras se alternaba hasta
  cero, y en el Perfil las pestañas nunca cambiaban. **Movido a nivel de módulo.**
- Los listeners **se acumulaban** en `#app` en cada render y una acción se
  ejecutaba N veces. Nace **`mountInto()`**, que reemplaza solo un nodo interno
  (`[data-page-root]`) para borrarlos todos de golpe.

Ese último es el patrón que sostiene todo lo demás: el contenedor `#app` **nunca**
se sustituye, porque `main.ts` lo cachea una vez.

## Fase 5 — Pulido de uso (2026-09-30, `ecac6e3`)

Seis problemas reportados **en navegador**, no en tests:

1. El panel de detalle del almacén era un overlay `fixed` que con `lg:static`
   se convertía en un hijo más de la columna y caía debajo de la rejilla. Ahora
   son dos columnas de verdad, con un **único** `detailContent()` que comparten
   ambas Plantillas.
2. La barra inferior solo existía en la vista principal: desde cualquier otra
   página la única salida era el botón `‹` de la esquina superior — **justo donde
   el pulgar no llega**. La barra se movió a `pageShell`.
3. El contador de nanitas usaba `hidden sm:inline` en el almacén: invisible en
   móvil.
4. La pestaña activa de la tienda cambiaba de clases, lo que además obligaba a
   re-renderizar la lista entera. Ahora hay un indicador que se desplaza.
5. El botón de compra decía "Sin nanitas" y el texto cambiante impedía
   reconocerlo como la misma acción.
6. Las descripciones eran rótulos vacíos ("Contiene recompensas básicas").

Y el patrón de fondo, otra vez: **el estado bloqueado viaja en `data-blocked`, no
en una clase.** Antes el manejador hacía `className.includes('opacity-50')`, así
que cambiar el estilo de un botón rompía en silencio la lógica de la compra.

## Fase 6 — La mudanza de "weapon" a "collector" (2026-09-30, `f4184fb`)

`weapon` → `collector` en **25 ficheros**, con concordancia de género corregida a
mano. No es cosmético: la migración `saveVersion < 7` reescribe `type:'weapon'` y
adopta el antiguo `equippedWeaponId`.

También nace la **cola de nanitas pendientes** (`services/naniteQueue.ts`), que es
la pieza de ingeniería más cuidadosa del proyecto:

- Se escribe en `localStorage` **de forma síncrona, antes de tocar la red**.
- Se vacía **solo** cuando los dos `setDoc` confirman.
- Guarda un **snapshot absoluto con marca de tiempo**, no un incremento.
- Al cargar, `nanites` se **reemplaza** por el de la cola (no se suma) si la cola
  es más reciente; `totalNanitesProduced` y `totalClicks` solo suben con `Math.max`.

Guardar un incremento habría sido un **truco para farmear núcleos**: prestige a
cero, se corta la red, se recarga, y el jugador se quedaba con los núcleos *y* el
saldo.

---

## Fase 7 — Cierre (2026-09-30, `d3c71ef`) + el lote que lo cerraba

`d3c71ef` arregla tres cosas:

- **Las cajas no se consumían.** La vista restaba el item y luego llamaba a
  `updateState`, cuyo `syncCrateCounters()` se ejecutaba **antes**. El contador se
  recalculaba contando una caja que ya no existía y el siguiente guardado la
  volvía a materializar. Ahora el game loop consume **después** de aplicar el botín.
- **Inventario libre.** El arrastre a un hueco no funcionaba porque era un
  intercambio, y un intercambio necesita dos items. Ahora es una **inserción**, así
  que cualquier celda vale, incluidas las vacías. `visibleStacks()` pasa a ser la
  **única** fuente de filtro y orden, para el pintado y para el arrastre.
- **Cristales por nivel.** Cada cristal multiplica la probabilidad (×1 / ×1.75 /
  ×2.75 / ×4) y el selector enseña coste y probabilidad **antes** de confirmar,
  con números que salen del game loop, no de una copia en la vista.

### El lote que cerraba la fase 7

Después de `d3c71ef` y antes de la fase 8, sin commitear durante un rato.
**Hoy está todo versionado**; lo que sigue es el índice de qué entró y por qué.
Tres cosas de aquí merecen un párrafo propio, porque son decisiones y no solo
código:

**La suite de pruebas.** Nace entera en este lote y es lo que sostiene todo lo
demás: bancos que crecen con cada tanda, sobre el game loop real con Firebase sustituido
por un store en memoria. La regla que la gobierna es que **cada comprobación
termina en `reload()`**, porque lo que solo vive en memoria es el bug que más
veces ha llegado a producción. `queueCheck` es el ejemplo de por qué: la mitad de
sus pruebas son de **abuso**, casos en los que la cola de nanitas **no** debe
aplicarse. Un arreglo de guardado que funciona de más es peor que uno que no
funciona, porque fabrica dinero.

**Los cosméticos de caja.** Un cosmético **no es un item**: no ocupa ranura, no se
vende y no puede pasar por la compensación de "almacén lleno". Por eso el botín
gana una vía nueva (`applier.unlockCosmetic`, `crateCosmetics`) separada de
`addItem`, y por eso repetir uno que ya tienes no puede ser el premio. Eso lo fija
`lootCheck`.

**Que la ruleta no mienta.** `lootCheck` existe por una razón concreta: una casilla
podía prometer "+350 nanitas" mientras el saldo subía 11.667, porque la cifra que
enseña la ruleta y la que entra en la cuenta venían por caminos distintos. El banco
monta un aplicador que **cuenta lo aplicado de verdad** y lo compara con lo que
enseña la tira.

| Qué | Ficheros |
|---|---|
| Terminal de administración | `admin.html`, `src/admin.ts`, `src/services/adminService.ts`, `firestore.rules` |
| Cuenta suspendida | `src/components/blocked.ts`, `src/services/bloqueoService.ts` |
| Cola offline de nanitas | `src/services/naniteQueue.ts` |
| Módulo de apilado | `src/data/stacking.ts` |
| Huecos del almacén | `warehouseGaps` en types/gameLoop/warehouse, `src/dragTest.ts` |
| Cosméticos de caja | `src/data/cosmetics.ts` (`crateCosmetics`), `crateLoot.ts`, `gameLoop.ts` |
| **Suite de pruebas** | `verify/` completa (kit, stubs, bancos de pantalla y de economía) |
| Mejoras varias | `auth.ts`, `store.ts`, `warehouse.ts`, `rankings.ts`, `main.ts`, `layout.ts`, `pageShell.ts`, `router.ts`, `audio.ts`, `theme.ts`, `style.css`, `style.modules.css` |
| Configuración | `vite.config.ts` (multipágina), `tailwind.config.js` |
| Bancos de pruebas visuales | `ruleta-preview.html`, `src/ruletaPreview.ts`, `drag-test.html`, `src/dragTest.ts` |
| Documentación | `AGENTS.md` + `docs/` |

> **Este lote ya está en el historial.** Cuando se escribió esto eran 24
> ficheros modificados y 17 sin seguimiento; hoy la tabla de arriba describe
> código **versionado**, y lo único que queda sin commitear es la fase 8. La
> tabla se conserva porque es el índice de qué acabó en qué sitio, no porque
> describa el árbol de trabajo.

**Y los bancos de pruebas visuales no están en git, ni siquiera ahora.**
`.gitignore` los recoge **enteros** —HTML y script, los cinco pares—, con la
regla escrita en su propio comentario: *o el utillaje está ignorado entero, o se
versiona entero*. Antes dejaban fuera `drag-test.html`, `ruleta-preview.html` y
sus dos `src/`, que quedaban sin seguimiento **y** sin ignorar: la peor de las
dos situaciones, porque `git status` los anunciaba como código nuevo cada vez que
alguien montaba el utillaje con `npx vite`. Consecuencia: mirar el render de la
ruleta hay que hacerlo en local, no se puede leer de un `git show`.

---

## Fase 8 — La ruleta se parte en dos (2026-10-01, `ce3a346`)

Tres trabajos que chocaron en paralelo sobre la misma ruleta. Lo que tienen en
común es que los tres son **la misma promesa, aplicada a tres sitios**: lo que el
jugador ve bajo la aguja tiene que ser lo que el motor aplicó. El primero la
incumplía sin que nadie se diera cuenta, el segundo se la jugaba sin tenerla, y
el tercero sobraba.

### 8.1 La ruleta del sintonizador

Sintonizar un recolector era el **único punto del juego donde el jugador arriesga
un recurso a una tirada**, y el resultado llegaba en un toast: "¡Mejora exitosa!".
Una tirada que solo se comunica con una línea de texto no se siente como una
tirada. Ahora hay trompo, con la misma ventana y el mismo marcador que la de las
cajas —a propósito: el jugador ya sabe leer esa ruleta, y reutilizar el lenguaje
hace que la segunda no sea un objeto nuevo que hay que aprender.

**El cambio de contrato en el motor es lo que no se ve.** `upgradeEquippedCollector`
devolvía `success: false` para dos cosas opuestas: *el dado salió mal* (se gastó
el cristal) y *la operación se rechazó antes de tirar* (no se gastó nada). Para el
jugador son lo contrario, pero el motor devolvía lo mismo, y con una sola bandera
un rechazo hacía girar la ruleta entera con un cartel de "FALLO" y un mensaje que
hablaba de otra cosa ("Necesitas 4 x Cristal de Afino").

La solución es **un tercer estado explícito**, `rolled`, más `level` con el que se
queda. No se deduce en la vista, porque deducirlo mirando si el cristal se gastó
sería repetir en la vista la regla de consumo del motor (R1 y R2). Un `rolled`
que llegue `undefined` —un mock viejo, un motor anterior— se trata como "no hay
ruleta", que es la salida que no le enseña nada falso al jugador.

**El segundo error, del que solo se dio cuenta el banco.** El game loop sube
`item.level` en el mismo objeto del almacén, así que leer el nivel *después* de
llamarlo devuelve el nivel nuevo en los dos casos: el acierto pintaba "5 → 5", un
número que no existe. Por eso `levelBefore` se lee **antes** de la llamada y
`levelAfter` sale de una relación, no de una segunda lectura. El fallo parecía
correcto por casualidad, porque ahí los dos números coinciden de verdad.

### 8.2 La ruleta de cajas deja de ser una ruleta

`crateRoulette.ts` mezclaba tres cosas en un solo fichero: la matemática del
giro, el DOM del carril y el cartel del premio. Se parte en tres, y el reparto no
es caprichoso:

| Fichero | Qué tiene | Imports |
|---|---|---|
| `rouletteSpin.ts` | La curva, su inversa, la geometría y los chasquidos | **ninguno** |
| `rouletteStrip.ts` | La ventana, el marcador y la transición CSS | `rouletteSpin`, DOM |
| `crateRoulette.ts` | Solo el cartel del botín de las cajas | `rouletteStrip` |

**`rouletteSpin.ts` no importa nada, y esa es la razón de que exista.** Son
números puros, que es justo lo que los hace comprobables: importarlos en Node no
arranca Web Audio ni lee `window.innerWidth`. Si la aritmética del giro se
hubiera quedado dentro de `crateRoulette.ts`, **`rouletteCheck` no podría
existir**: importar ese fichero en Node significaba levantar el audio y el DOM
solo para dividir por dos números.

Y hay una asimetría que conviene no pasar por alto. `tuningRoll()` sí es una
función pura, pero vive en `tuningRoulette.ts`, que **sí** importa audio, iconos
y el carril. `rouletteCheck` la importa igual y funciona, porque
`verify/entorno.mjs` pone los stubs de debajo. Es decir: la mitad derecha del
banco (la geometría) no depende de que el stub esté bien, y la mitad izquierda
(sintetizador) sí. Un stub que estorba en un banco y salva en otro no es un
stub neutro: es deuda que se paga el día que alguien lo recorte.

Tres cosas cambian de verdad, no solo de sitio:

- **La curva.** Era un `cubic-bezier(0.16, 1, 0.3, 1)` elegido a ojo, con el 90%
  del camino en el primer 25% del tiempo: cuatro segundos de trompo eran uno de
  verdad y tres de arrastre, y el ojo abandonaba la tirada mucho antes de que
  acabara. Ahora es el ajuste de `d = 2t - t²` —una rueda a la que se le quita la
  energía poco a poco— y el último medio segundo va casilla a casilla.
- **Los chasquidos.** Iban a un intervalo constante calculado **aparte** de la
  curva (`duracion / casillas`), con lo que el sonido describía el tiempo y no el
  movimiento: callado en el primer segundo, que es donde la cinta vuela, y
  metrónomo en el final. Ahora salen de `instante()` sobre la misma curva, y caen
  **en la frontera de casilla** que cruza el marcador.
- **Las vueltas.** Se contaban en casillas fijas, así que el trompo era corto en
  móvil (4 casillas de ventana) y largo en escritorio (6). Ahora se cuentan en
  **ventanas visibles**, y dura lo mismo en los dos.

Y un detalle que es la mitad de un bug: el carril tenía `px-1`. Cuatro píxeles que
nadie escribió en la fórmula desplazaban la casilla ganadora, así que **el
marcador señalaba una casilla y el cartel anunciaba otra** — el peor fallo posible
en una ruleta. Lo que no está en la aritmética no se pone en la aritmética.

### 8.3 El botón de huecos desaparece

El almacén tenía un botón "Dejar un hueco aquí" en la ficha del item, y con él
`alternaHueco()` y dos casos del manejador. **Se retiran a petición del jugador**,
y el motivo es de diseño, no de limpieza:

> En un tablero, "dejar un hueco aquí" es lo mismo que "el item no está aquí", y
> eso ya lo dice el arrastre. Soltar en una celda vacía le cuelga al item los
> huecos que necesite para caer exactamente en la celda señalada, **sin mover a
> nadie más**. El botón era un segundo camino hacia lo mismo.

De paso se arregla el resaltado del arrastre: la condición de `pointermove`
excluía `data-gap` justo cuando el destino era un hueco. El `drop` sí funcionaba
(lo resolvía el `pointerup`); lo que faltaba era la señal visual, y sin ella
arrastrar a un hueco se leía como un arrastre que no iba a hacer nada.

### 8.4 Qué se comprobó

- `npm run build`: `tsc` limpio.
- `npm run verify`: todo en verde. `rouletteCheck` (59) es nuevo en esta fase; el
  total del runner se fue a **16 bancos** con la fase 9, que se mide allí.
- **Medido, no supuesto**, en `ruleta-preview.html`: el desfase entre el centro de
  la casilla ganadora y la aguja es de **0 px** en las tres ruletas (caja épica,
  sintonizador con acierto y sintonizador con fallo), y los tres sitios que
  enseñan el resultado dicen lo mismo —casilla "NIVEL 5", cartel "Nivel 4 → 5" y
  el mensaje del motor.

Lo que `verify/` **no** cubre y no se puede cubrir: el render. La medición de
píxeles y el ancho de la ventana real quedan fuera del banco, y por eso existe el
banco visual.

## Fase 9 — El contador deja de enseñar números que nadie cobra (2026-10-01)

Un lote en dos partes, porque hubo dos autores yCronometrarlo como uno sería
mentir sobre el historial. La parte del tick es de otra sesión; la del reparto y
la señal, de esta. Las dos persiguen lo mismo, y por eso se cuentan juntas.

### 9.1 El pasivo entra entero y a su ritmo

El HUD de la base anunciaba "+5 Nanitas / segundo" y el tick corría a 500 ms. Cobrar
`passiveIncome / TICKS_PER_SECOND` hacía que el saldo subiera 2,5 por tick, y como
`formatNumber` baja el entero, el número grande alternaba +2 y +3 (307 → 309 → 312)
mientras al lado ponía "+5 / segundo". El ritmo que se enseñaba y el que se veía
eran dos, y con cualquier ingreso impar el salto era más feo: 7/s daba +3 y +4.

Ahora se acumula el tiempo de tick y **cada segundo completo entra el segundo
entero de una vez**, con un acumulador que se tira al volver de una pausa para
que el tiempo ausente no se convierta de golpe en un bloque entero. La
alternativa descartada era subir el tick a 1000 ms, que también daría +5 entero,
pero a costa de los buffs, los logros y toda la interfaz, que también viven del
tick: se arreglaba el contador ralentizando media pantalla.

`tickCheck` lo ata, y con una regla que es la importante: **el ingreso por segundo
no cambia**. Diez ticks son cinco segundos y tienen que haber dado cinco cobros.
Un arreglo de ritmo visual que de paso inflara o recortara la economía se vería
igual de bonito y sería un desastre.

### 9.2 Y el reparto dentro de ese bloque

Arreglado el ritmo, quedaba el número. La ficha del panel pintaba
`+{power}/s` y el "+N" flotante pintaba `+{power}`: el **valor desnudo** del
compañero. Lo que entra en la cuenta es ese número después de
`passiveMultiplier`, de los logros, del árbol y del buff ×2. Con un multiplicador
de 1,5 la ficha decía "+3 /s" y el contador subía 4,5.

Es el mismo bug que "que la ruleta no mienta", con otro disfraz: la cifra que
entra en la cuenta y la que se enseña venían por caminos distintos, y el jugador
no tenía forma de saber cuál era la buena.

**El reparto no puede ser `floor(power × multiplicadores)` en cada ficha.** Los
floors no suman: con dos compañeros de 3 y ×1,5 el ingreso real es
`floor((3+3) × 1,5) = 9`, pero `floor(3 × 1,5)` son 4 y 4, que son 8. Así que el
motor reparte el ingreso **ya entero** entre los que aportan, en proporción a su
peso, y el sobrante del redondeo se reparte a partes iguales. La suma de las
fichas es exactamente `state.passiveIncome`, ni un nanita de más ni de menos, y
ningún compañero se queda sin su parte porque otro se comió el redondeo.

`getCompanionOutput()` vive en la API del motor, así que la vista pide el número
y no lo reimplementa (R2). `senalCheck` ata que la suma cuadre, y es la prueba
que falla en silencio si alguien deshace el reparto.

### 9.3 Las tres fuentes del contador, y la que no tenía cartel

El saldo subía por tres sitios a la vez: el click del jugador, el ingreso de los
compañeros y los **clics automáticos del árbol**. Los dos primeros tenían señal;
el tercero **no tenía ninguna** —entraban en la cuenta, sumaban `totalClicks`, y
no se veían por ningún lado—.

Ahora el motor anota cada click del árbol al cobrarlo, con la cifra ya redondeada
que entró en la cuenta, y la vista los anuncia al vaciar la cola. Dos propiedades
de esa cola: es **solo de presentación** (el dinero ya está en el saldo, así que
perder un aviso cuesta cero) y se **descarta al volver de una pausa**, porque si
no el jugador vería de golpe todos los "+N" de un rato entero.

Y el click del jugador ahora **devuelve** lo que entró. Antes la vista lo deducía
restando dos lecturas del estado, y esa resta no es un número que exista en
ningún sitio: con el buff de pasivo activándose en mitad, la diferencia incluía
dinero de otro origen y el "+N" no era el del click.

### 9.4 Un módulo entero que era código muerto

`src/ui/naniteCounter.ts` (241 líneas) implementaba una "cuenta suave" del saldo:
un vuelo interpolado para que el número creciera poco a poco en vez de saltar. Se
verificó contra `HEAD` que **nadie lo importaba nunca** — `updateUI` escribía el
contador directamente — así que estaba commiteado y era inalcanzable.

Se borró en lugar de conectarlo. Su premisa era que el problema era de suavizado,
y el problema real resultó ser de reparto: que el número que se enseñaba no era
el que se cobraba. Suavizar una cifra incorrecta es hacer la mentira más
conveniente.

### 9.5 Qué se comprobó

`npm run build` (tsc limpio) y `npm run verify`: **16 bancos, 1123 pruebas**, todas
en verde. `senalCheck` (26) es nuevo, y `tickCheck` (14) vino con la otra parte
del lote. Los tres fallos que dio al escribirse eran
del banco y no del código, y los tres son el tipo de cosa que este proyecto ya
conoce:

- **`bonus.autoClick` en el save no llega a ninguna parte.** `bonus` es un campo
  derivado: al cargar se recalcula desde `nodeLevels`, que es la fuente de verdad.
  Ponerlo a mano se quedaba pisado y los clicks no ocurrían nunca. El banco
  monta el nodo `auto_clicker`, que es el camino real.
- **Un click automático sin recolector da 0**, porque `calculateClickDamage()` es
  0 sin recolector equipado. El banco tenía razón sobre el código y la partida
  mal montada a la vez.
- **Con 2 clics/s hacen falta dos ticks**, no uno: el acumulador llega a 1
  completo en el segundo. Comparado de uno en uno, el banco daba verde sobre un
  código que solo anotaba el último click.

Lo que `verify/` no cubre y se miró en `preview.html`: que las fichas pinten la
cifra nueva. Con el mock sin multiplicadores el reparto devuelve los mismos
`power` (65+68+40 = 173), que es lo correcto pero **no distingue** una función
conectada de una que no lo está: para eso hace falta el caso con multiplicador, y
ese es el del banco.


## Fase 10 — El precio sigue al poder (2026-10-01)

Una partida se medía en **20 minutos**: los diez tiers de recolector y compañero,
comprados. Eso no es una partida larga, es un formulario.

### La causa era peor de lo que parecía

Los precios de las cartas escalaban **1.5x por tier** y el poder escala **1.62x**.
El coste por punto de poder, entonces, **bajaba** al subir de tier:

| | precio | poder | coste por punto |
|---|---|---|---|
| T1 | 850 | 6 | 142 |
| T6 | 7 200 | 68 | 106 |
| T10 | 17 500 | 466 | **38** |

El T10 salía **3.7x más rentable** que el T1. El juego se resolvía solo.

**Y el comentario que explicaba el arreglo anterior era falso.** Decía "el coste
por punto se mantiene entre 170 y 235 en todo el rango". No era verdad, y no lo
era por un motivo concreto: **ese arreglo se hizo cuando el daño iba de 5 a 77**,
y luego `TIER_SYSTEM.ranges` abrió el T10 a `[373, 559]` sin tocar los precios. El
comentario describía un sistema correcto que ya no era el que corría.

Es la segunda vez en dos días que un comentario afirma algo que el código ya no
hace. Un comentario no se verifica solo. **Esto sí: `balanceCheck`.**

### Qué cambió

- **Una sola tabla** para compañero y recolector, que cuestan lo mismo porque
  sacan el poder del mismo `TIER_SYSTEM.ranges`. Antes el T10 de uno costaba
  77 000 y el del otro 17 500, por el mismo poder.
- **El coste por punto sube 12% por tier**, de 150 en T1 a 416 en T10. Esa
  subida es el **sobreprecio deliberado** que el código promete: el T10 es un
  objeto de escaparate, no una optimización. Y es lo que estira la partida sin
  tocar el ingreso: el total de T1 a T10 pasa de ×21 a ×479, y los dos últimos
  tiers se llevan el 70% de todo.
- **Sintonizar ya no es un botón.** La curva de coste de cristal subió de 1.14 a
  1.26 por nivel y el cristal de 60 a 200. Subir a nivel 20 pasaba a costar un
  4% del recolector —menos que comprarlo— y ahora cuesta el 47%.
- **De paso, una tercera discrepancia de precios**: `CRYSTAL_DEFS[1].cost` decía
  1 440 y `STORE_ITEMS.upgradeCrystal.cost` decía 60. Cobraba el segundo; el
  primero es un campo muerto que nadie lee.

### Lo que rompió, y por qué importa

El cambio tumbó **9 pruebas** de `buyCheck` y `stateCheck` que tenían los precios
escritos a mano (60, 850, 17500, 99 cristales). Ninguna era un bug del juego:
**el test tenía su propia copia de la tabla de precios**, que es exactamente el
error del comentario. Se arreglaron leyendo `STORE_ITEMS` y
`collectorUpgradeCost` en vez del número escrito.

Es la misma lección por tercera vez, y la que más caro sale: **en este proyecto
nadie verifica lo que dice un número**.

### Qué se comprobó

`npm run build` (tsc limpio) y `npm run verify`: **22 bancos, 1391 pruebas**. Los
30 nuevos son de `balanceCheck`, que ata cuatro cosas: la banda de coste por
punto, que **un tier superior nunca sea mejor por punto que el anterior** (esa es
la que habría servido para cazar este bug), que las dos curvas coincidan y que la
partida se estire.

**Lo que el banco NO comprueba, y solo se verifica jugando:** que la partida
dure lo que tiene que durar. Los números pueden encajar entre sí y seguir siendo
una partida de veinte minutos. Queda como **P4** en `PENDIENTES.md`.

---
## La forma de los commits

Vale la pena copiar este estilo, porque es el que hace legible el historial:

- **Asunto en imperativo y con alcance declarado**: `fix: las cajas se consumen de verdad, inventario libre y cristales por nivel`. Dice *qué* pasó, no *qué fichero* se tocó.
- **Cuerpo en listas agrupadas por tema** (`Economia:`, `Cajas:`, `AFK:`, `Rebalanceo:`, `Bugs:`), no en párrafos.
- **Se explica el porqué, incluso de lo evidente.** Por qué la ruleta no decide, por qué la cola guarda un snapshot, por qué `.rarity-*` se centralizó.
- **Los bugs se documentan por su causa raíz**, no por su síntoma: "el `else if` pedía 'Clics' y la comprobación de 'Click x2' se adelantaba".
- **Se declara lo que se comprobó y cómo**: "0px de overflow en las 7 páginas a 390×844 y a 1440×900, en 4 temas".
