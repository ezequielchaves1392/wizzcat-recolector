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

### F8 · En el ranking sale el título, pero no el marco ni el banner

Ver el ranking solo se esta mostrando un tipo de ribbon.

> **Por qué solo uno:** por los dos lados a la vez, que es lo que hace que esto no
> sea un arreglo de una línea.
>
> - Al **guardar** (`gameLoop.ts:1865`): el documento `rankings/{uid}` solo
>   escribe `title`. El marco y el banner se quedan en `users/{uid}` (`1850`), que
>   es otro documento y otra colección: la consulta del ranking no los ve nunca.
> - Al **pintar** (`rankings.ts:147`): la fila solo busca `r.title`. Y el tipo
>   `LeaderboardEntry.cosmetics` (`rankingService.ts:52`) declara
>   `{ title, frame, banner }` pero **nadie lo rellena**: es un campo muerto desde
>   que se escribió.
>
> Hay 9 marcos y 11 banners en `data/cosmetics.ts` y en la tabla no se ve ninguno.
>
> **Lo que hay que decidir antes de escribir código:** en una fila de 40 px no cabe
> un fondo de banner. Lo razonable es el avatar con su marco al lado del nombre —que
> es una capa de 32 px y ya existe montada en `profilePage.ts` como
> `identityCard()`— y dejar el banner para la ficha del jugador. Pero en qué fila
> se ve el marco, y si el banner sale en algún sitio dentro del ranking, es cosa
> tuya. Está en Features y no en Bugs por eso.

### F9 · Los logros tienen que decir qué falta

Quiero que los logros den una "pista" de lo necesario para cumplirlos.

> **La pista YA EXISTE, y es completa.** En Perfil → Logros cada logro enseña su
> progreso con `actual/objetivo` y una barra de avance (`profilePage.ts:175-202`),
> y los datos salen del motor por `getAchievements()` (`gameLoop.ts:2270`), que
> devuelve `current` y `target` de la misma función que decide si el logro está
> cumplido. La pista no es inventada ni una copia: es el número real.
>
> **Lo que no sabías es que estaba ahí**, porque esperabas un cartel que nunca llega
> (B3). Con el cartel arreglado, esta petición puede quedar en nada.
>
> **Si aun así quieres la pista fuera del Perfil, esto es lo que hay que decidir:**
> dónde se enseña y cuánta. Lo cierto es que el Perfil es el único sitio donde
> caben quince logros con su barra, y que un "Logro más cercano: 15/20" en el panel
> principal es un número que cambia cada pocos minutos y hay que decidir si
> compensa esa luz. Hay tres sitios posibles y cada uno tiene un coste distinto.

### F10 · Que el trompo sea el que sortea

La descripción dice que ya está decidido y en realidad se debería mostrar el tiro y
decidirlo luego de comprarlo.

> **Esto es justo lo contrario de lo que hace el código, y el código lo hace a
> propósito en seis sitios.** El motor sortea **y aplica el botín** en el mismo
> instante (`gameLoop.ts:2966`), y el trompo solo lo enseña. El motivo está escrito
> en `crateLoot.ts:7`: "la ruleta NO decide el premio. Si se invirtiera, la ruleta
> estaría mintiendo sobre las probabilidades reales".
>
> Y no es una superstición: la cinta se monta antes de girar, con el premio ya
> puesto en `winIndex`. Si el trompo decidiera, la casilla que se parase tendría que
> ser la que el azar eligió al principio de la animación; o el premio se aplicaría
> después de parar, y entonces **la casilla que enseña y el botín que entra son dos
> cosas distintas**. Es el fallo que el propio código ya cometió una vez con las
> llaves: la legendaria anunciaba "Llave Rúnica" y entregaba una Llave Reforzada
> (`gameLoop.ts:2968-2980`).
>
> **Mi recomendación: no tocar la mecánica.** Lo que faltaba era la explicación, y
> se ha arreglado (B5). Si aun así quieres que el sorteo ocurra al final del trompo,
> hay que rehacer el modelo de la cinta y aceptar que el premio se aplica después de
> la animación: eso abre la puerta a que el jugador cierre el overlay a mitad y se
> lleve una caja sin nada dentro.

---

## Bugs y cosas que se han visto

### B1 · El primer slot de compañero no muestra su daño — ARREGLADO

El click automático de los compañeros no siempre muestra el valor. Equipé un Épico
puntualmente y no mostraba el valor del daño, uno común anda. Otro dato es que el
segundo compañero sí muestra el daño. A lo mejor es un problema con el primer slot.

> **La sospecha inicial era falsa**, y conviene dejarla escrita para que no se
> repita: no era que el daño se calculara sobre el recolector. Se reprodujo con
> siete casos (uno solo, dos juntos, `power` 0, orden de slots) y el reparto salió
> bien en todos.
>
> **La causa real:** la vista filtraba por `type === 'click'` para pintar los "+N".
> Los compañeros `passive` **no anunciaban nunca**. De los cinco de caja, tres son
> `passive` —y entre ellos el **Avatar del Vacío, power 65, el mayor ingreso
> individual del juego**—, así que comprarlo y equiparlo no producía ninguna
> señal. No tenía nada que ver con el primer slot: dependía del TIPO.
>
> **Arreglado:** la regla es "anuncia quien paga directo". `passive` y `click`
> avisan; `multiplier` no, porque multiplica a los demás y no tiene cifra propia.
> Y la decisión la toma el motor (`getAnunciablesIngreso`), no la vista, que es
> lo que la hace comprobable.
>
> Cubre `senalCheck` (6 pruebas nuevas).

### B2 · El ranking escribe un campo que nadie lee

`rankings.ts:147` solo pinta `r.title`, y el campo `LeaderboardEntry.cosmetics` de
`rankingService.ts:52` —que declara `title`, `frame` y `banner`— no lo rellena
ningún sitio. El tipo promete tres cosas y entrega una.

Peor: el comentario de `profilePage.ts:5` dice que la tarjeta de identidad
"(título, marco, banner) sale en el ranking". No sale. La función que la pinta
(`identityCard()`) existe, funciona y **no se usa nunca en el ranking**: el perfil
se la monta él mismo.

> **Causa raíz:** el documento `rankings/{uid}` y la vista se escribieron y se
> leyeron el uno al otro campo `title`, y el resto de la identidad se quedó en
> `users/{uid}`. Ningún banco lo detecta: los bancos comprueban números, y aquí lo
> que falta es una lectura.
>
> **Es la misma cosa que F8 vista desde los dos lados:** B2 es el defecto y F8 la
> decisión de qué tiene que verse en la fila. Si se arregla F8, B2 se cierra solo.

### B3 · El logro del almacén a 20 no da cartel

Obtuve el logro del almacen en 20 y no me salió un cartel.

> **Causa raíz, y son DOS, no una.** Por eso está en bugs y no en features: el
> cartel existe, está montado y es correcto. Lo que falla es que no se llama.
>
> 1. **La compra que completa el logro no evalúa los logros.**
>    `buyStoreItem` con `warehouseSlot` sube la capacidad y sale
>    (`gameLoop.ts:2821-2825`): `warehouseCapacity += 5`, `onUpdate`,
>    `saveToFirebase` y sale. **No hay `checkAchievements()`.** Las ocho rutas que
>    sí lo llaman están en `gameLoop.ts` (1594, 2179, 2317, 2472, 2543, 2560, 3140,
>    3258) y esa no está. Justo la acción que cumple "Almacén Masivo" es la única
>    que no lo comprueba.
> 2. **Al cargar, el cartel es mudo siempre.** `checkAchievements()` se llama
>    durante la carga (`gameLoop.ts:1594`), o sea dentro del `await
>    createGameLoop(...)` de `main.ts:323`. `showAchievementPopup` busca
>    `#achievement-stack` con `querySelector` y **si no está, se sale sin hacer
>    ruido** (`main.ts:66-67`). Ese contenedor lo pinta `renderLayoutHTML`
>    (`layout.ts:353`), que se ejecuta en el `requestAnimationFrame` **posterior**
>    a que `createGameLoop` termine (`main.ts:336-338`). A la hora del logro, el
>    `#app` todavía no tiene layout. Por eso no hay ni un solo cartel de logro en
>    toda la partida: los que se detectan en vivo también caen en el mismo `return`.
>
> **Por qué ningún banco lo pilla:** `evaluateAchievements` es una función pura y
> se puede probar (y se prueba), pero **la cadena que tiene que existir —que el
> callback llegue a un nodo que está en el documento— no**. Es un fallo de cableado,
> y un banco de números no lo ve.
>
> **Cómo se comprueba al arreglar:** meter el callback en una cola si el contenedor
> no existe, y vaciarla en cuanto se pinte el layout. Con eso los logros de la carga
> también salen, y hay que decidir si con retraso o solo los de en vivo.

### B4 · La pista del logro del almacén cuenta slots que no tienes

Relacionado con lo que dijiste de la "pista": el progreso de "Almacén Masivo"
miente.

> `deep_pockets` mide `s.warehouseCapacity` (`achievements.ts:112`), que es la base
> sola. La capacidad que ve el jugador es `warehouseCapacity + bonus.storageSlots`
> (`gameLoop.ts:1654-1656`), y el árbol de pasivas da +3 y +8 (`data/tree.ts:87` y
> `171`). Con los dos nodos el almacén tiene **26 slots** y el logro enseña
> **15/20** para siempre. Lo mismo le pasa a cualquier otro logro que mida algo
> compuesto: la pista y el almacén tienen que salir de la misma regla (R3), y aquí
> salen de dos.
>
> El logro tampoco se cumple por la vía del árbol, que es la que el jugador ve
> funcionar. Se cumple comprando una ampliación de tienda (+5), y solo si ninguna de
> las dos vías tiene ya la base a 20.

### B5 · Las tarjetas de la tienda contaban cómo está hecho el trompo

Este es el texto de la imagen: "Abrir una da una tirada de ruleta con el botín ya
decidido antes de girar".

> **Lo que falla no es la frase: es que una frase interna se enseñaba al jugador.**
> Estaba en dos sitios, los dos a la vista: la tarjeta de la llave en la tienda
> (`store.ts:83`) y el modal de confirmación de abrir caja (`warehouse.ts:1276`).
>
> Decir "el botín ya está decidido" convierte cada tirada en la promesa de que el
> trompo no sortea nada. Y el jugador llegó a la conclusión correcta a partir de un
> texto: que la ruleta era un adorno. No lo era —la casilla que se para y el botín
> que entra son lo mismo— pero el texto lo decía.
>
> **POR QUÉ CUENTA COMO BUG Y NO COMO GUSTO.** Hay una regla del proyecto que va
> exactamente de esto: *no se enseña al jugador cómo está hecho por dentro*. El
> orden interno de un sorteo es información de diseño, igual que el seed o la tabla
> de probabilidades. En un sitio es documentación —y tiene que estar, porque es lo
> que impide que alguien invierta la ruleta sin querer—; en el otro es texto de
> producto.
>
> **Arreglado:** los dos textos ahora cuentan lo que vive el jugador. `build` en
> verde y la ruleta comprobada en `ruleta-preview.html`: gira, frena en la aguja y
> la casilla y el cartel dicen lo mismo. La mecánica no se ha tocado (F10 explica
> por qué no).

---

## Balance y dificultad

_Preguntas sobre si el juego va bien de ritmo. No son bugs: son decisiones tuyas
sobre cuánto debería costar._

### P1 · Se llega muy rápido a compañeros de tier 6 — ARREGLADO

Llegué muy rápido a los compañeros tier 6... ¿está bien el balance? ¿podrás ver?

> **Causa:** el precio por punto de poder BAJABA al subir de tier, porque los
> precios escalaban 1.5x y el poder 1.62x. El T10 salía a 38 por punto contra
> 150 del T1. Medido sobre 20 minutos de partida real: los diez tiers, comprados.
>
> **Arreglado:** el coste por punto sube ahora con el tier (150 → 416), que es el
> sobreprecio deliberado que el propio código promete. La partida se estira sola
> hacia el final. Cubre `balanceCheck`.

### P2 · Se llega muy rápido a recolectores de tier 7 — ARREGLADO

Lo mismo que a los recolectores, llegué muy rápido al recolector tier 7.

> **Causa:** la misma, y aquí era más grave. Los recolectores escalaban 1.5x
> igual, pero el daño real va de 6 a 466 (78x, por `TIER_SYSTEM.ranges`) y el
> precio iba de 850 a 17 500 (20.6x). El comentario del código decía "el coste
> por punto se mantiene entre 170 y 235" y era falso: medido, T10 salía a 38.
>
> **El arreglo anterior no estaba mal, quedó viejo.** Se hizo cuando el daño iba
> de 5 a 77; luego el daño se abrió a 466 y los precios no se tocaron. Por eso
> los dos reparos coinciden ahora en una tabla.
>
> **Arreglado:** recolector y compañero cuestan lo mismo. Cubre `balanceCheck`.

### P3 · Los cristales de mejora son muy baratos — ARREGLADO

Los cristales de mejora valen muy baratos, es muy fácil mejorar los ítems...

> **Causa:** subir a nivel 20 costaba 100 cristales, que a 60 cada uno salían
> 6 000 nanitas: un 4% del recolector. No había nada que decidir, era un botón.
> Y el cristal costaba 60 en `STORE_ITEMS` y 1 440 en `CRYSTAL_DEFS`, que es un
> campo muerto: dos precios para la misma cosa.
>
> **Arreglado:** curva de coste de 1.14 a 1.26 por nivel y el cristal a 200.
> Nivel 20 cuesta ahora ~47% del recolector. Cubre `balanceCheck`.

### P4 · Verificar en partida real

> **Pendiente de tu lado.** El banco comprueba que los números encajen entre sí,
> no que la partida dure lo que tiene que durar. Para eso hace falta jugarla:
> otra partida nueva y decir hasta dónde llegas y en cuánto tiempo.

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

`src/gameLoop.ts` tiene **3.352 líneas y 38 métodos de API**.Casi todas las ideas de
arriba lo tocan:

| Idea | Ficheros |
|---|---|
| F1-F3 valoración | `gameLoop.ts`, `ui/playerPanel.ts`, `data/valuation.ts` |
| F4 buffs | `gameLoop.ts`, `ui/buffHud.ts`, `data/items.ts` |
| F5-F6 cajas y llaves | `gameLoop.ts`, `data/items.ts`, `components/crateLoot.ts` |
| F7 slots de compañero | `gameLoop.ts`, `components/store.ts`, `data/prestige.ts` |
| B1 primer slot | `gameLoop.ts`, `ui/playerPanel.ts` |
| F8-B2 marco y banner | `gameLoop.ts` (un `setDoc`), `components/rankings.ts`, `services/rankingService.ts` |
| **B3-B4 cartel y pista de logros** | `gameLoop.ts` (`checkAchievements`), `main.ts`, `achievements.ts`, `ui/profilePage.ts` |
| P1-P3 balance | `gameLoop.ts`, `data/tiers.ts`, `data/prestige.ts` |

Siete de siete grupos sobre el mismo fichero significa que **con varios agentes a la
vez se pisan**, y un conflicto ahí no es un conflicto de texto: es economía. Un
`Math.floor` que se mueve cambia el juego y los bancos siguen en verde.

**Las dos excepciones, y por eso pueden ir en cualquier momento:** F8-B2 toca
`gameLoop.ts` pero solo en el bloque del `setDoc` de `rankings/{uid}` (dos campos
más), y el resto del trabajo vive en `rankings.ts`. Y **F9-F10 no tocan el motor**:
F9 es una decisión de dónde enseñar una pista que ya existe, y F10 es una decisión
sobre si se toca la mecánica del trompo (mi recomendación es que no).

### Los cuatro pasos

1. ~~**P1-P3 · balance.**~~ **HECHO.** Se midió sobre tu partida de 20 minutos y
   el diagnóstico fue el que sospechábamos pero peor: el precio por punto de
   poder **bajaba** al subir de tier, así que comprar T10 era 3.7x más rentable
   que comprar T1. Corregido, con `balanceCheck` atando que no vuelva a pasar.
   Queda **P4**, que solo se verifica jugando otra vez.
2. ~~**B1 · el bug del primer slot.**~~ **HECHO.** Los compañeros `passive` no
   anunciaban su ingreso: el Avatar del Vacío, power 65, salía de una caja y no
   producía ninguna señal. La regla ahora vive en el motor.
3. ~~**Mudanza de las 230 líneas de datos a `src/data/`.**~~ **HECHO.** Ahora
   viven en `data/store.ts`, `data/buffs.ts`, `data/generators.ts` y en
   `crafting.ts` la fórmula de sintonización. `gameLoop.ts` baja de 3.411 a 3.242
   líneas y **ningún fichero de `data/` importa del motor**: eso era R29 sin
   cumplir, y `data/items.ts` llegaba a hacer `import type { CrateType } from
   '../gameLoop'`.
4. **F1-F8**, que ya tocan menos sitio.

### El paso 3 en detalle: qué se mudó

Las primeras 250 líneas de `gameLoop.ts` **no eran el motor**, eran datos puros que
no tocaban `state` ni Firebase. Ahora viven aquí:

| Fichero | Qué tiene |
|---|---|
| `data/store.ts` | `STORE_ITEMS` (con la curva de balance), `CRATE_TYPES`, `CONSUMABLES`, `COLLECTOR_BASE_COSTS`, `COMPANION_SLOT_COSTS`, `CrateType` |
| `data/buffs.ts` | `AFK_CARD_DURATION_MS`, `MAX_AFK_BUFF_DURATION_MS`, `BUFF_FIELDS`, `BuffKey` |
| `data/generators.ts` | `generateCompanionByTier`, `generateCollectorByTier` |
| `data/crafting.ts` | `collectorUpgradeCost` (se suma a las que ya tenía) |

De 3.411 líneas a 3.242, y lo que se va es lo que no era del motor.

**Y el detalle que de verdad merecía la pena:** `data/items.ts` estaba haciendo
`import type { CrateType } from '../gameLoop'`. Eso es un `data/` que depende de
donde vive el estado —R29 incumplido sin que nadie lo notara— y se resolvió solo
al mover `CRATE_TYPES` a su sitio.

**Lo que NO se hizo, y es lo importante:** partir el motor en varios ficheros de
golpe. Los bancos comprueban números, no estructura: si una mudanza mueve un
`Math.floor`, los 1.162 tests siguen verdes y el juego cambia. Aquí no hay ninguna
decisión nueva —solo dónde vive cada cosa— y `balanceCheck` comprueba a posteriori
que ninguna cifra se movió sin querer.

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
- [x] **P1-P3 · balance.** El precio de las cartas sigue al poder y sube con el
      tier; sintonizar ya no es un botón. `balanceCheck` (29) es el banco nuevo.
- [x] **B1 · los compañeros `passive` no anunciaban su ingreso.** Regla movida al
      motor. `senalCheck` pasó de 30 a 36.
- [x] **Paso 3 · las tablas fuera de `gameLoop.ts`.** A `data/store.ts`,
      `data/buffs.ts`, `data/generators.ts` y `crafting.ts`. Ningún `data/` importa
      ya del motor.
- [x] **B5 · el trompo ya no explica cómo está hecho por dentro.** Los dos textos
      que lo hacían —la tarjeta de la llave en la tienda y el modal de confirmar
      abrir caja— cuentan ahora lo que vive el jugador. La mecánica no se ha tocado:
      `ruleta-preview.html` gira, frena y la casilla y el cartel dicen lo mismo.
      Sin commit todavía.

---

## Descartado

_Lo que se decidió no hacer, y por qué. Esto vale más que la lista de "hecho":
una idea que se descartó con un motivo escrito no vuelve a proponerla nadie._

_(vacío)_

### D2 · Un fallo mío en un fichero que no está en git

Un `.Replace()` mal escrito en PowerShell sustituyó **cada `i` por `m`** en
`src/ruletaPreview.ts` y en `src/components/store.ts`. El primero está en
`.gitignore`, así que no hay copia en el historial: se reconstruyó a mano. El
segundo tenía además trabajo sin commitear de otra sesión —el texto de la caja en
la tienda—, que se recuperó de la conversación.

> **El error de fondo no es el carácter: es que edité ficheros en bloque con un
> script en vez de con ediciones exactas.** Un `.Replace()` con el patrón
> equivocado no avisa: escribe. Y en un repo donde `git status` es la única red,
> un fichero ignorado no tiene red. Los tres ficheros se recuperaron, pero
> perdimos una herramienta de revisión visual hasta reconstruirla.

### D1 · Un compañero existe pero no se puede conseguir

El **Espectro Azulado** (Épico, `passive`, power 18) está en `CRATE_ONLY_COMPANIONS`
como índice 5, y **la tabla de botín no lo usa**: solo se referencian los índices
0 a 4. Está definido y es inalcanzable.

> Apuntado mientras se buscaba B1, no es un bug de juego sino de contenido. Las
> dos salidas posibles: meterlo en la tabla de botín, o borrarlo del array para
> que no invente una recompensa que no existe.