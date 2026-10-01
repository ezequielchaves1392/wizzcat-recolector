# Cambios macro por actualización

Historial **macro**: qué cambió de verdad en el juego y por qué, no el detalle de
fichero. El detalle está en los mensajes de commit (`git log`) y en las cabeceras
`// ===...===` de cada módulo.

Rama: `main`. Último commit: `d3c71ef`.

> **Aviso importante sobre el estado del repositorio.** El árbol de trabajo tiene
> **un lote grande sin commitear**: 23 ficheros modificados (+3631/−703) y 17
> sin seguimiento. Ese lote contiene la terminal de administración, la cola offline
> de nanitas, el módulo de apilado, los huecos del almacén, las reglas de
> Firestore y **toda** la suite `verify/`. Es decir, buena parte de lo que se
> describe abajo como "estado actual" **no está en el historial todavía**.
> Antes de investigar un comportamiento raro, comprueba `git status`: puede que lo
> que buscas esté solo en el working tree.

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

Y por fin se arregla la causa raíz de la fase 1:

> **`consumeWarehouseItem()` pasa a ser la única vía de borrado.** `sellItem`,
> `useConsumable` y `openCrateBox` viven en el game loop en vez de mutar el estado
> desde cada vista.

Las llaves y cristales dejan de ser contadores y pasan a ser **items físicos por
nivel**, con migración del saldo viejo.

## Fase 7 — Cierre (2026-09-30, `d3c71ef`) + lote sin commitear

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

### El lote sin commitear

Después de `d3c71ef`, sin commitear. Tres cosas de aquí merecen un párrafo propio,
porque son decisiones y no solo código:

**La suite de pruebas.** Nace entera en este lote y es lo que sostiene todo lo
demás: **11 bancos, 806 pruebas**, sobre el game loop real con Firebase sustituido
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
| **Suite de pruebas** | `verify/` completa (**11 bancos**, kit, stubs) |
| Mejoras varias | `auth.ts`, `store.ts`, `warehouse.ts`, `rankings.ts`, `main.ts`, `layout.ts`, `pageShell.ts`, `router.ts`, `audio.ts`, `theme.ts`, `style.css`, `style.modules.css` |
| Configuración | `vite.config.ts` (multipágina), `tailwind.config.js` |
| Bancos de pruebas visuales | `ruleta-preview.html`, `src/ruletaPreview.ts`, `drag-test.html`, `src/dragTest.ts` |
| Documentación | `AGENTS.md` + `docs/` |

Volumen actual: **24 ficheros modificados (+3925/−732) y 17 sin seguimiento.**

El working tree es la referencia, **no el último commit**. Antes de investigar un
comportamiento raro o de escribir un informe, `git status` y `git diff` van primero.

De los bancos de pruebas visuales, `.gitignore` recoge `preview.html`,
`src/preview.ts`, `auth-preview.html`, `src/authPreview.ts`, `src/previewAudio.ts`
y `nav-test.html` (líneas 39-44). **No** recoge `drag-test.html`, `src/dragTest.ts`,
`ruleta-preview.html` ni `src/ruletaPreview.ts`: esos cuatro están sin seguimiento
en git pero no ignorados, lo que es una inconsistencia del `.gitignore`. O el utillaje
de desarrollo debería estar ignorado entero, o ninguno.

---

## La forma de los commits

Vale la pena copiar este estilo, porque es el que hace legible el historial:

- **Asunto en imperativo y con alcance declarado**: `fix: las cajas se consumen de verdad, inventario libre y cristales por nivel`. Dice *qué* pasó, no *qué fichero* se tocó.
- **Cuerpo en listas agrupadas por tema** (`Economia:`, `Cajas:`, `AFK:`, `Rebalanceo:`, `Bugs:`), no en párrafos.
- **Se explica el porqué, incluso de lo evidente.** Por qué la ruleta no decide, por qué la cola guarda un snapshot, por qué `.rarity-*` se centralizó.
- **Los bugs se documentan por su causa raíz**, no por su síntoma: "el `else if` pedía 'Clics' y la comprobación de 'Click x2' se adelantaba".
- **Se declara lo que se comprobó y cómo**: "0px de overflow en las 7 páginas a 390×844 y a 1440×900, en 4 temas".