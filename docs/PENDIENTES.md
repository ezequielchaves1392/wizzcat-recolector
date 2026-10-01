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

### F4 · Solo tarjetas de buff, fuera los buffs pasivos — HECHO

Sacar los buffs pasivos y dejar las tarjetas únicamente.

> **Hecho, y el motivo por el que estaban mal no era "ser buffs pasivos".**
>
> Los dos que se han retirado (`clickBuff`, 30 min, y `passiveBuff`, 60 min) no
> estaban mal por lo que hacían, sino por **cuánto duraban**. Y el efecto es
> medido, no supuesto:
>
> ```
> isEffectivelyAfk = isAfk && !hasPassiveBuffActive && !hasAfkBuff
> ```
>
> **Un buff pasivo activo anula el corte del AFK.** O sea que `clickBuff` no era un
> multiplicador: era un pago por no mirar la pantalla. 800 nanitas por media hora de
> ingreso sin estar delante, y compraba la mitad del AFK de B9 por la puerta de
> atrás. Eso rompe R10, que es una regla, no una opinión.
>
> Las tres tarjetas que quedan duran 10 minutos o 30 segundos, así que no da tiempo a
> instalar esa costura. Y son las que se acumulan y las que se pueden cancelar desde
> el HUD, que es lo que hace que un buff sea una decisión y no una espera.
>
> **Lo que NO se toca: el efecto sigue en el motor.** Hay partidas guardadas con
> `passiveBoostExpiresAt` en el futuro, y ese jugador sigue cobrando su x2 hasta que
> expire. Quitar el efecto le recortaría el ingreso a media partida por un cambio de
> tienda. Se retira la compra, no el buff.
>
> Cubre `tarjetaCheck` (17 pruebas), nuevo. Y dos listas de `buyCheck` que nombraban
> las cartas retiradas.
>
> **La regla que queda escrita**, y que es la que importa para lo que se añada: nada
> comprable puede durar más de 15 minutos. El banco lo comprueba sobre `STORE_ITEMS`,
> así que una carta nueva con una duración larga falla sola.

### F5 · Una llave por tipo de caja, con precio creciente — HECHO

Debe existir una llave para cada tipo de caja y crece el precio de las mismas.

> **Hecho junto con B6 y B7**, que eran las otras dos mitades del mismo problema.
> Hay cuatro cartas de llave en la tienda (`keyT0`..`keyT3`), con precios
> crecientes 250 / 900 / 3.000 / 11.000, y cada una es la llave de su caja.
>
> **El precio tiene una regla y no es "sube": la llave nunca es más cara que la
> caja que abre.** Si lo fuera, la caja sería la mitad barata del par y comprarla
> sin llave sería tirar el dinero. Y como cada caja suelta llaves de su nivel,
> comprar llave y caja sale más caro que abrir cajas: la tienda nunca es el camino
> bueno, que es lo que hace que abrir un cofre siga siendo una decisión.
>
> **Y una decisión que se tomó y se documentó:** se arrived a probar la regla
> "una llave abre exactamente una caja" y se volvió atrás, porque rompe a
> propósito que la Llave del Vacío sirva para las cajas de abajo, que es la mitad
> de la comodidad del sistema. La regla sigue siendo "igual o superior".

### F6 · Probabilidad baja de botín de tier superior en las cajas — HECHO

En las cajas debe haber una probabilidad baja de obtener cosas del tier superior.

> **Hecho, y la decisión importante es DÓNDE vive el salto: en la tabla de botín,
> no en un `if` al abrir.**
>
> Si el salto fuera un `if` suelto, seguiría funcionando y nadie lo notaría —saldría
> un 5% de las veces— pero la **primera regla de `crateLoot.ts` es que la ruleta tiene
> que enseñar lo que entra**. Un premio que no está en la tabla no lo puede pintar la
> cinta, así que el jugador vería salir un T6 de una caja común sin que la ruleta
> hubiera mostrado nada. Va como una entrada más, con su peso.
>
> | Caja | Peso | Probabilidad real | Da |
> |---|---|---|---|
> | Común | 6 de 105 | 5,7% | T2 |
> | Rara | 5 de 106 | 4,7% | T4 |
> | Épica | 4 de 128 | 3,1% | T7 |
> | Legendaria | 4 de 119 | 3,4% | T9 |
>
> **Por qué sube UN peldaño y no "lo que salga".** Un salto de cualquier tamaño haría
> de la caja común una caja legendaria con más pasos, y el premio alto dejaría de ser
> reconocible ("me salió un T4 en una caja rara" se puede contar; "me salió un T9 en una
> caja común" no significa nada). Con un solo salto el premio sigue siendo del mismo
> juego, y se puede razonar dónde se busca lo bueno.
>
> **Por qué la probabilidad no es el peso.** Es `peso / suma`, y la suma es distinta en
> cada caja. Por eso los pesos no son iguales en las cuatro. Y por eso `saltoCheck`
> mide las cuatro por tiradas de verdad y no mirando la tabla: un banco que mirase el
> peso estaría midiendo un número que el jugador nunca ve.
>
> Cubre `saltoCheck` (42 pruebas), nuevo. Validado subiendo dos peldaños en vez de
> uno: 4 fallos.

### F7 · Tope de 6 compañeros y precio de ranura balanceado — HECHO

El máximo de compañeros quiero que sea ~~3~~ **6**. La segunda compra de slot no debe
dar +3. Balancear el precio.

> **Hecho con F11**, que es la versión desarrollada de esta entrada y donde está
> todo el detalle. Resumen: el tope es 6 y se llega en tres compras
> (1 → 2 → 4 → 6), ninguna de +3, y el precio por ranura ya no da un salto.
> `ranuraCheck` (34 pruebas).

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

### B3 · El logro del almacén a 20 no da cartel — HECHO

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
>
> **Arreglado las dos mitades.**
>
> 1. `buyStoreItem('warehouseSlot')` ya llama a `checkAchievements()`. Era la única
>    de las diez rutas que no lo evaluaba.
> 2. En `main.ts` hay una **cola de logros pendientes**: `showAchievementPopup` mete
>    el logro en la cola si `#achievement-stack` todavía no está, y la cola se vacía
>    en cuanto `renderRoute` ha montado el layout. El aviso sale en el primer
>    fotograma, así que no hay retraso perceptible.
>
> **El sonido no se reproduce al encolar, a propósito.** Un logro que suena al entrar
> en la aplicación es un ruido en mitad de otra cosa; el cartel visual sí tiene
> sentido, porque el jugador ya está mirando. La cola desemboca en la misma pila que
> los avisos en vivo, así que hereda su tope de tres sin tener uno propio.
>
> **Lo que un banco puede comprobar y lo que no:** que el motor **emita** el logro sí
> (el `onAchievement` es el mismo gancho que `main.ts` le pasa), y que se desbloquee
> una sola vez. Que se pinte no: eso necesita el `#achievement-stack` de verdad, y es
> `preview.html`. La cola está documentada en el código, no en el banco, porque es
> una función local de un módulo que importa Firebase.

---

## Más cosas que pediste — este lote

_Trece peticiones más, con tu texto intacto. Tres son **bugs** y van en el apartado
de Bugs (B10-B12); las otras diez son Features (F23-F31), y dos de ellas son
decisiones grandes, no ajustes._

**Antes de empezarlas, tres datos ya están resueltos** (los has confirmado tú):

1. **Forja (F24):** "enseña 3 y metí 1" → **es la vista mintiendo**, no se pierden datos.
   La causa está localizada: `forgeCollector()` exige tres ids y **no deduplica**.
2. **Sesión y theme (B11):** el botón de cerrar sesión **no está** en móvil → es un
   problema de camino, no de que exista y no responda.
3. **Almacén (F27):** compraste **100** ampliaciones → son +500 ranuras y **600.000
   nanitas**, y hay **dos** productos de ampliación con reglas distintas.

**Y una idea más que salió con las respuestas: F32**, la de que a partir del nivel 10
fallar pueda restar 1 o 2 niveles. Encaja con F31 y explica por qué la forja de T10 es
aburrida hoy: **fallar no cuesta nada**.

**Las cuatro decisiones ya están tomadas** y ya no queda ninguna ambigüedad abierta. Con
F26 cerrada, **ninguna de las trece peticiones necesita una respuesta para empezar a
programar**; lo que queda es trabajo y tres números:

| # | Número abierto |
|---|---|
| **F26** | ¿10 niveles de cristal, o bandas? Y **qué caja suelta cada uno** — hoy solo hay 2 obtenibles de 4. |
| **F31** | **¿El techo de la forja sigue siendo T11?** Hoy `tier >= 11` se rechaza, así que la forja no pasa de T10. |
| **F32** | **¿La probabilidad de fallo sube con el nivel?** Si no sube, la pérdida de niveles solo afecta al tramo 10-20. |

**Y cuatro decisiones que ya están tomadas** (respondidas, medido lo que se puede medir):

| # | Decisión | Qué implica |
|---|---|---|
| **F23** | **Negarse a entrar**, no expulsar al otro | Nadie pierde la partida en curso. La otra sesión sigue viva hasta que se cierre sola. |
| **F26** | **El cristal tiene que ser del mismo tier del item, estrictamente.** La progresión se mantiene como está, así que el fallo sigue existiendo. | No cambia la economía, pero **obliga a que existan 10 niveles de cristal**: hoy solo hay 4 definidos y **solo 2 obtenibles**. Si el T8 pide cristal T8 y ese cristal no sale de ninguna caja, el T8 es un muro. |
| **F29** | **Los núcleos entran en el cálculo del definitivo Y tienen pestaña aparte** | Puntúan y además se ven. |
| **F31** | **El tier sube por forja, o bien una caja inferior puede tirar llaves y cajas de tier superior** | Dos vías, no una. |

**Datos que faltaban y ya han llegado:**

| # | Lo que dijiste | Lo que cambia |
|---|---|---|
| **F24** | Enseña 3 y metí 1 | **No es un dato perdido: es la vista mintiendo.** Ya no hace falta migración. |
| **B11** | El botón no está | Es un problema de **camino**, no de que el botón exista y no responda. |
| **F27** | Compré 100 | Hay **dos** ampliaciones con reglas distintas, y ya pasaste el tope de una. |

**Y un aviso honesto sobre el tamaño:** F31 y F27 se estorban entre sí. Si todo el poder
pasa por la forja y la forja consume items, el almacén se llena de material —y F27
quiere acotarlo—. Con las dos juntas hay que decidir qué pasa con el material que no te
cabe: venderlo rompe tu progreso, y no venderlo te bloquea. **Conviene hacer F27 antes
que F31.**

---

### B10 · En AFK por inactividad no sale el cartel, y el botón sigue animado

El AFK al estar en la pantalla pero estar quieto debe mostrar el cartel y detener la
animación en el botón de recolección.

> **Lo de "debe mostrar el cartel" ya funciona por B9**, y conviene separarlo porque
> son dos mitades que se confundían: ahora, estando quieto en la pantalla, el ingreso
> **se corta solo** y `isAfk` **dice la verdad** — eso es B9, y `tickCheck` lo comprueba
> con el reloj corrido. **Lo que falta es la mitad visual**, que es lo que pides aquí.
>
> **1 · El cartel.** Cuando el AFK salta por inactividad, el tick marca `isAfk` y
> vuelve con `onUpdate(state, true)`, que es lo que repinta la pausa. B9 garantiza que
> la variable es cierta; lo que falta comprobar es que **llegue a pintarse** en el
> punto donde el jugador lo ve. Eso es el mismo reparto que B3: mitad medible, mitad
> cableado.
>
> **2 · La animación del botón de recolección.** Esta es la que de verdad importa, y es
> un caso de **CSS, no de lógica**: si hay una pulsación o una "respiración" cosida con
> `animation: ... infinite`, esa animación **no depende de JavaScript** y sigue
> corriendo con el juego parado. **Ningún banco lo detecta**, porque un banco
> comprueba si la clase está puesta —y la clase va a estar puesta sí o sí— y no si el
> píxel se está moviendo.
>
> **Lo que hay que hacer:** atar la animación a un atributo que el estado controle —un
> `data-afk` en el contenedor, o una clase en `body`— para que el CSS pueda pararla con
> una regla y no con JavaScript. Y **esto hay que verlo en `preview.html` a 390×844 con
> el reloj corriendo**, porque es de los pocos fallos que no se pueden medir con un
> número: hay que mirar.

### B11 · En el celular no se puede cerrar sesión ni cambiar de theme

En celu no puedo cerrar sesión ni cambiar de theme.

> **Sin medir, y por eso no te voy a inventar la causa.** Lo que sí es una pista
> fuerte, y sale del propio código: **el panel de tema está marcado para móvil**.
> En `layout.ts` es `<div id="theme-sheet" class="lg:hidden ...">`, y `hidden` en
> Tailwind es el breakpoint `lg` —ancho de escritorio—, no "tamaño de pantalla". O sea
> que en un móvil **debería** verse, y no verse es un fallo de verdad.
>
> Quedan tres candidatos, y son muy distintos entre sí:
> - **Que el botón esté pero no se pueda tocar.** Si el panel se abre debajo de otro
>   elemento, o `safe-area-inset-bottom` no está contemplado en móvil, el síntoma es
>   exactamente "está ahí y no hace nada".
> **Tu respuesta: el botón NO ESTÁ.** Con eso se descarta el caso de "está y no
> responde" y queda uno solo: **no hay camino hasta él en móvil**. O el control existe
> en el código pero en móvil se pinta en un sitio al que no se llega, o directamente no
> se pinta.
>
> Y eso enlaza con el dato de `layout.ts`: el panel de tema es `lg:hidden`, o sea que
> el **contenedor** está pensado para móvil, pero el **botón que lo abre** puede que sí
> viva en la cabecera de escritorio. Si es así, el fallo es que **el disparador del panel
> tiene que existir en las dos versiones** — y el disparador es lo que hay que mirar
> primero, porque el panel ya está.
>
> **Lo que hay que buscar, en este orden:**
> 1. El **disparador**: dónde se llama `theme-sheet`. Si está dentro de un bloque
>    `hidden lg:flex`, ya está encontrado.
> 2. Lo mismo con **cerrar sesión**: si vive en el perfil o en un menú desplegable, ese
>    es el que hay que replicar en la versión móvil.
> 3. Y una decisión de fondo, porque **cerrar sesión siendo invisible en el móvil es un
>    problema de confianza, no de layout**: si el jugador no puede cerrar sesión, no
>    puede dejar de jugar en el móvil. Eso no se arregla solo moviendo un botón.

### B12 · El segundo prestigio dice "produce 0 más" y no dice cuánto falta

El segundo prestigio dice produce 0 más, pero no indica bien cuánto falta para poder
prestigiar.

> **Este sí está diagnosticado, es un bug real, y hay dos causas distintas. Medido.**
>
> **1 · El "produce 0 más" tiene la causa exacta.** En `prestigePage.ts:169-177` hay un
> `if` que decide qué se pinta, y el caso de "todavía no hay ningún núcleo" dice:
>
> ```
> Produce ${Math.max(0, PRESTIGE_MIN_NANITES - state.totalNanitesProduced)} más
> ```
>
> `PRESTIGE_MIN_NANITES` es 1.000.000 y **es el umbral del PRIMER núcleo**, no el del
> siguiente. En el segundo Ascenso ya lo has superado de sobra, la resta da 0, y el
> texto dice "produce 0 más". La condición no contempla que ya haya núcleos: es un
> caso pensado solo para la partida nueva.
>
> **2 · "No indica cuánto falta" es que el número no se enseña, aunque exista.** Y sí
> existe: `nextCores()` es exactamente `pendingCores(producido) - totalCores`, o sea
> **la diferencia entre lo que tu producción actual daría y lo que ya te llevaste**.
> Está calculada, y se usa para decidir si el botón se enciende (`canRecycle =
> pending > 0`). **Pero nunca se pinta.** El jugador ve un botón que o no se enciende,
> y el motivo es un número que el motor tiene y nadie enseña.
>
> Peor: **`coreProgress()` también existe** y devuelve el progreso 0..1 hacia el
> siguiente núcleo, y **tampoco se usa**. O sea que la barra está escrita y desconectada
> — el mismo patrón que el ranking en B2: un campo que se calcula y nadie lee.
>
> **Lo que hay que hacer es enseñar, no calcular:** el `pending` como cifra y la barra
> de `coreProgress()`. Los dos están listos.
>
> **Y hay una ambigüedad que hay que resolver antes**, porque el arreglo la hace visible:
> `pendingCores()` **devuelve 0 por debajo del umbral**, y ese 0 es correcto para el
> botón pero **no para una barra** — hay que distinguir "todavía no puedes" de "ya
> puedes y esto es lo que te falta". Con el texto actual el jugador no puede saber en
> cuál de los dos está.

### B4 · La pista del logro del almacén cuenta slots que no tienes — HECHO

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
>
> **Arreglado, y el segundo efecto era peor que la pista.** Con la base a 20 y el
> árbol dando ranuras, el logro se quedaba **bloqueado para siempre**: ya estaba en
> `unlockedAchievements`, así que ni la tienda ni el árbol volaban a evaluarlo otra
> vez. Es decir, la misma operación —comprar las dos primeras ampliaciones y el
> árbol— dependiendo del orden daba el logro o lo quemaba para siempre. Y eso queda
> resuelto: comprar la tienda y el árbol da el mismo resultado en las dos
> direcciones.
>
> Ahora la pista mide `warehouseCapacity + bonus.storageSlots`, la misma regla que
> `getCapacity()`, así que el logro se cumple **por la vía que el jugador está
> viendo funcionar**.
>
> **Lo que el banco comprueba, y por qué no compara dos cifras.** La pista va topeada
> a 20 y la capacidad no: con el árbol comprado la capacidad real es 26 y la pista
> marca 20. Comparar `pista === capacidad` falla con un bug que no existe, porque el
> tope es lo correcto —de nada sirve un 26/20—. Así que lo que se mira es que la
> pista **llegue al tope por el árbol** (20 con capacidad 26) y que sin árbol sea
> exactamente la base. `toastCheck` pasó de 25 a 31.

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

### B6 · Las llaves no abren lo que dicen, y las de arriba no se pueden conseguir — HECHO

Me gustaría que hayan distintas llaves que abran distintos tiers. Hoy como está la
cosa esta llave dice que abre épicos y legendarios y no es verdad. Reveamos el
sistema de llaves, ¿está funcionando bien?

> **Revisado: sí funciona el código, y el bug es de LÓGICA, no de texto: la cadena es
> una escalera imposible.** Las cuatro llaves son reales y las cuatro cajas existen,
> pero las llaves de arriba solo se sacan de cajas que ellas mismas abren. Medido:
>
> | Caja | Necesita | De dónde sale esa llave |
> |---|---|---|
> | Común | Cifrada (T0) | **Tienda**, y cajas comunes |
> | Rara | Reforzada (T1) | **Cajas raras** (peso 14) y comunes dan la T0 |
> | Épica | Rúnica (T2) | **Solo cajas legendarias** |
> | Legendaria | Del Vacío (T3) | **No sale de NINGÚN sitio** |
>
> Traducido: la legendaria es **imposible de abrir** — su llave no existe en el
> juego — y la épica solo se abre si primero abres una legendaria. Las cajas
> legendarias se pueden comprar (`data/store.ts` las vende) y no se pueden abrir.
> Eso no es un texto mentiroso: es contenido inalcanzable.
>
> **Por qué la llave dice una cosa y hace otra:** `KEY_DEFS` describe a mano qué
> abre cada llave (`items.ts:70,80,89`) y `CRATE_KEY_TIER` decide de verdad qué
> abre (`items.ts:106`). Son **dos tablas** para la misma regla, y ya no coinciden:
> la Rúnica dice "Abre Épicos y Legendarios" pero `CRATE_KEY_TIER.legendary = 3` y
> la Rúnica es nivel 2, así que **no abre la legendaria**. El texto promete más de
> lo que la regla da.
>
> **La reparación de raíz no es tocar textos: es una sola tabla.** Que
> `details` se genere desde `CRATE_KEY_TIER` con el mismo criterio que usa
> `keyOpens()`, y entonces no puede volver a mentir. Es R2 aplicado a un sitio
> donde la regla estaba partida en dos.
>
> **Lo que tú propones —épicas en las raras, legendarias en las raras, con baja
> probabilidad— es exactamente el desatasco, y encaja con la tabla que hay: la
> rara ya suelta la Reforzada al 14% y la legendaria suelta la Rúnica al 8%. Si la
> legendaria suelta la Del Vacío, la cadena cierra. Probabilidades exactas a
> decidir, y ahí hay que medir cuántas cajas hay que abrir para llegar.
>
> **Arreglado, y el diagnosticado estaba incompleto:** la escalera tenía **tres**
> peldaños rotos, no dos. La del Vacío no salía de ninguna parte, la Rúnica solo
> salía de la legendaria, y **la caja épica no soltaba ninguna llave** — eso no
> estaba medido y fue lo que apareció al arreglarlo.
>
> **La reparación es una tabla, no tocar textos:** ahora cada caja suelta la llave
> que la abre, y sale de `CRATE_KEY_TIER` (`buildKeyLoot` en `crateLoot.ts`). Los
> cuatro `details` de las llaves **se generan** con `cratesOpenedBy()`, que llama a
> `keyOpens()`, así que ya no hay nadie que pueda escribirlos mal. Y las cuatro
> llaves son comprables, para que un jugador al que le falte una pueda
> comprarla en vez de encontrarse con un tramo de juego cerrado.
>
> Cubre `llaveCheck` (92 pruebas), validado-rompiendo el arreglo: con la llave
> fija a propósito, tres de cuatro cajas dan la llave que no es.

### B7 · La tienda dice una llave y entrega otra — HECHO

Aparte de B6, hay un descuadre corto en la misma familia: la carta de la tienda se
llama "Llave de Cifrado" y el motor entrega otra.

> `STORE_ITEMS.key` se llama "Llave de Cifrado" (`data/store.ts:106`), pero la
> compra llama a `createMaterialItem('key', STORE_MATERIAL_TIER)` y
> `STORE_MATERIAL_TIER = 1` (`gameLoop.ts:491`). O sea: **pagas 250 por lo que la
> tarjeta llama Cifrado y entra una Reforzada**, que es la que abre las raras.
>
> El coste del que sí es el nombre correcto está en `KEY_DEFS[0].cost = 480` y no
> lo usa nadie: es el mismo patrón de precio duplicado que ya se corrigió en los
> cristales (P3). Dos precios y dos nombres para la misma compra.
>
> F5 ("una llave por tipo de caja, con precio creciente") toca este mismo sitio, y
> B6-B7 son las dos mitades: **B6 es la regla, F5 es la tienda.** Conviene hacerlas
> juntas o la tienda se arregla dos veces.
>
> **Arreglado con B6 y F5, que es lo que este mismo texto pedía.** Ya no hay
> `STORE_MATERIAL_TIER` para las llaves: el nivel sale de la carta
> (`STORE_KEY_TIER`, `keyT0` → 0), así que el nombre de la carta y el item que
> entra son lo mismo por construcción. El precio vive en `KEY_COSTS`
> (`data/store.ts`), que es el fichero de los precios, y las cuatro cartas lo leen
> de ahí — el `KEY_DEFS[0].cost = 480` que no usaba nadie ya no existe.
>
> **Y un cuarto sitio que nadie había mirado, con el mismo bug:** la reventa. Un
> cuarto del precio de la carta, con carta única para cuatro llaves; ahora es un
> cuarto del precio del nivel. Ese número se toca en `buyCheck` con las cuatro
> cartas, porque un abuso de compra-venta puede salir solo en las caras.

### B8 · No hay forma de ver el perfil de otro jugador

Al tocar en el nombre de un jugador quiero entrar a su perfil y ver su panel
principal y sus estadísticas actuales.

> **No es un bug: es una regla de Firestore, y por eso es una decisión y no un
> arreglo.** `users/{uid}` **solo lo puede leer su dueño o un admin**
> (`firestore.rules:101`). El ranking es legible por cualquiera, así que la fila te
> da nombre, título, logros y puntuación —todo lo que está en `rankings/{uid}`— pero
> **el panel principal y las estadísticas no están en ninguna colección pública**:
> viven en el documento privado de cada jugador.
>
> **Lo que hay que decidir:** o se publica una tarjeta pública nueva —que sería
> exactamente el subconjunto que `rankings.ts` ya sabe pintar más lo que el jugador
> quiera mostrar— o se abre `users/{uid}` a lectura y se acepta que el saldo, los
> inventarios y las compras sean públicos. La segunda es un cambio de privacidad de
> una línea y **no la recomiendo**: un incremental te enseña el gasto de tu
> competencia.
>
> Con la primera no hay problema de seguridad: es un documento que el jugador escribe
> con lo que decide enseñar. Y de paso le daría en qué apoyarse a **F20**: la imagen
> de perfil es justo el dato que hay que poder leer de otro.

### B9 · El AFK no se ponía solo estando en la pantalla — HECHO

El juego también se pone en AFK si el jugador está en la pantalla pero no hace
movimientos durante 1 min al menos.

> **Arreglado, y el diagnóstico tenía dos piezas que faltaban.**
>
> **Lo que sí estaba:** el corte por pestaña oculta. Lo que no ocurría era lo otro.
> `isAfk` se recalculaba **solo** dentro de `handlePresenceChange`, que es el
> manejador de `visibilitychange` / `focus` / `blur` / `pageshow` / `freeze`. Con la
> pestaña visible y el cursor quieto **ninguno de esos eventos se dispara**, así que
> el tick seguía cobrando indefinidamente y **el `isAfk` que ya se pintaba en
> pantalla mentía**: decía AFK cuando el ingreso seguía entrando.
>
> **La pregunta va ahora en el tick**, que es donde ya se decide si entra ingreso;
> ponerla en otro sitio sería abrir una segunda puerta al cobro, que es la forma más
> fácil de que las dos se desincronicen. Y se mide con `Date.now()` y no con un
> contador de ticks: si el navegador congela la pestaña, al volver el tick se
> ejecuta muchas veces seguidas y un contador cruzaría el umbral en un par de
> vueltas.
>
> **La segunda pieza era el `mousemove`, y era peor de lo que parecía.** El handler
> estaba registrado y actualizaba `lastActiveTimestamp` con cada movimiento:
> **cualquier movimiento del ratón sacaba del AFK**. Con eso el AFK no se notaba
> casi nunca, porque el cursor se mueve por la ventana sin hacer nada. Se ha quitado
> el listener entero en vez de dejarlo vacío, porque un listener que no hace nada es
> una línea que se lee y se supone que significa algo. Ahora cuenta un click de
> verdad, que es lo que pasa cuando alguien lee un texto largo.
>
> **El umbral sube de 45 s a 60 s** (lo que pediste) y por el caso de quien está
> leyendo: con 45, una descripción larga de caja lo parte a mitad de lectura y vuelve
> con el ingreso cortado. Son 15 segundos de pasivo a cambio de no perder la partida
> mientras se lee — y el tiempo en AFK no cuesta nada, porque el ingreso está cortado
> (R10).
>
> **El corte alcanza también a los clicks del árbol**, que es lo coherente: si colaran
> mientras el jugador mira sin hacer nada, el AFK sería inútil para siempre.
>
> Cubre `tickCheck` (de 14 a 20 pruebas).

---

## Más cosas que pediste — 20 de octubre

_Lote de trece peticiones. Van con su texto intacto y la clasificación ya decidida:
cada una es cosa de hacer, de contenido, o de una decisión tuya._

### F11 · Escuadrón de 6 y revisar las mejoras de ranura — HECHO

Aumentar el máximo del escuadrón a 6 y verificar las mejoras de aumento de slots.

> **Ojo: esto actualiza F7**, que pedía el tope en 3. F7 queda con el tope en 6 y
> apuntando aquí, porque es la misma pregunta: cuántas ranuras y a qué precio.
>
> **Lo que había, medido:** base 1 ranura, `companionSlot1` (1.200) → 2, y
> `companionSlot2` (16.000) → **5 de golpe**. El árbol de pasivas añadía
> `companionSlots` aparte, así que el total podía pasar de 5 sin tocar la tienda.
>
> **Los tres números que había que revisar, y los tres eran ciertos:**
> - El salto de 2 a 5 eran **+3 ranuras por 16.000**, y el precio por ranura se
>   multiplicaba por 5,3 entre la primera compra y la segunda.
> - `COMPANION_SLOT_COSTS` tenía diez huecos y solo se usaban dos.
> - La tarjeta decía "Abre hasta **3** ranuras" y el motor daba 5.
>
> **Arreglado por la vía que evita el problema entero: que el número viva en una
> tabla.** Los cuatro números a mano (el `if` de la vista, el `if` del motor, el `=`
> que concede y el texto de la tarjeta) se quedan en uno. `COMPANION_SLOT_BUY` dice
> qué da cada carta, y el motor, el botón y la tarjeta lo leen de ahí.
>
> | Carta | Precio | Da | Salto |
> |---|---|---|---|
> | `companionSlot1` | 1.200 | 2 | +1 |
> | `companionSlot2` | 4.500 | 4 | +2 |
> | `companionSlot3` | 16.000 | 6 | +2 |
>
> El precio por ranura queda en 1.200 → 2.250 → 8.000: sube siempre, y ningún
> salto multiplica por más de 4. Antes el segundo multiplicaba por 5,3, que era la
> pared que F7 señalaba. Y la última ranura sale a 8.000, más cara que un compañero
> T1 entero (900): el escuadrón grande es una decisión de final de partida, que es
> de lo que se trata.
>
> **La tarjeta ya no dice "+N" escrito.** Dice cuántas quedan por abrir, restando las
> que ya tienes, y sale del total **efectivo**: si el árbol ya te dio la ranura 3 y
> te falta la 4, la tarjeta dice 1 y no 2.
>
> Cubre `ranuraCheck` (34 pruebas), nuevo. Y las dos aserciones de `buyCheck` que
> decían "lleva los slots a 5" ahora leen la tabla, que es donde está el número.
>
> **Un detalle que salió de paso y no estaba en la petición:** `canBuyStoreItem` solo
> preguntaba "¿cabe en el almacén?", así que una carta ya comprada seguía con el
> botón encendido y el `buyStoreItem` la rechazaba en silencio. Botón que no hace
> nada. Ahora las cartas de ranura preguntan también "¿ya lo tienes?".

### F12 · Ver qué compañero o recolector te ha tocado al comprarlo

Al comprar un compañero se debe mostrar un modal con el compañero que se generó. Al
comprar un recolector, una tarjeta con el recolector que se generó. Esto es porque
se generan al azar, para que el jugador lo sepa: actualmente solo se agregan al
almacén.

> **Esto es R3 aplicado a las cartas de tier, y por eso no es un capricho.** La
> tienda **sí** dice "El nombre, el poder exacto y la rareza se sortean al comprarlo"
> (`store.ts:153`), pero en el momento de cobrar no pasa nada visible: el item entra
> al almacén y el jugador tiene que ir a buscarlo. Paga por una sorpresa y la
> sorpresa se la tiene que buscar él.
>
> **Hay un sitio donde esto ya está resuelto y se puede copiar:** la ruleta de cajas
> monta su cartel de premio con la cifra en grande (`crateRoulette.ts:108-124`). Es
> el mismo problema, resuelto al revés: en la caja el premio se anuncia antes de que
> se vaya la pantalla.
>
> **Lo que hay que decidir:** el caso difícil es la compra, no la caja. En la tienda no
> se ha tirado nada todavía —el sorteo ocurre al comprar—, así que hay que decidir si
> la pantalla se queda en la ficha hasta el clic, o si hay una confirmación de "se va
> a sortear". Con quince cartas de tier, el modal tiene que decir **el nombre, el
> poder y la rareza que salieron**, no solo "ya lo tienes".
>
> **Medido también:** las quince cartas (10 de compañero y 10 de recolector, una por
> tier) no se describen a mano, se generan con `tierDescription()`
> (`store.ts:147-160`). El lore de F13 y este modal tocarán el mismo sitio, así que
> van juntos.

### F13 · Que los compañeros y recolectores tengan lore

Poner descripciones en los recolectores y compañeros para darle lore. Ejemplo tuyo:
*Forjador de Mundos, un compañero Legendario, su poder de extracción es uno nunca
antes visto… la tierra se quiebra a su paso…* (mejóralo, y ponle uno a cada tipo).

> **Es contenido, y son 63 fichas**: 10 tiers × 3 nombres de compañero y 10 × 3 de
> recolector (`data/tiers.ts:42-66`), más los 6 exclusivos de caja. Y el nombre del
> ejemplo es real: "Forjador de Mundos" es el primero del tier 7 (`tiers.ts:49`).
>
> **Lo que ya está resuelto:** `CRATE_ONLY_COMPANIONS` tiene justo la forma que pides
> —nombre, tipo, poder, rareza, icono (`crateLoot.ts:133-140`)—. Lo que les falta a los
> de tier es el texto, porque ahora su único texto es `Recolección por segundo: +N/s`,
> que es un número (F12 lo necesita igual).
>
> **Para que el lore no se contradiga con la mecánica, cada descripción debería decir
> el tipo de compañero** (`passive`, `click` o `multiplier`), que es lo que el jugador
> tiene que entender para decidir si lo equipa. Un texto sobre "la tierra se quiebra" no
> dice si produce mientras no estás o solo al clickear.

### F14 · Comprar por cantidad en el almacén

Comprar por cantidad en el almacén, siempre y cuando haya lugar y nanitas.

> **Vender ya tiene selector de cantidad** (`warehouse.ts:1423-1434`); lo que falta es
> **comprar varias unidades de una vez**.
>
> **La condición "si hay lugar" es donde está el trabajo.** Las llaves y cristales son
> apilables, así que 20 llaves son 1 ranura, no 20: la capacidad se mide por **slots
> ocupados**, no por unidades (`countOccupiedSlots`). Y las cartas de tier y los slots
> de escuadrón **no** se apilan: 5 compañeros son 5 ranuras, y ahí sí tiene que
> bloquearse en cuanto no quepan. El número que se puede comprar sale de las dos
> cosas, y por eso tiene que salir del motor (R1/R3) y no de la vista.

### F15 · En el perfil, cuántos Títulos, Marcos y Banners tienes

En el perfil me tiene que decir la cantidad de Títulos, Marcos y Banners poseídos.

> **Ya hay un contador, pero es único y mezcla las tres cosas**:
> `${unlockedCosmetics.length}/${COSMETICS.length}` (`profilePage.ts:270`) va en el
> encabezado de la sección, y como los secretos van dentro de la misma lista no se
> distingue qué es título y qué es marco. Lo que falta es el desglose: títulos 7/14,
> marcos 4/9, banners 2/11 —que es lo que hay, medido sobre `data/cosmetics.ts`.
>
> Sale casi gratis de `COSMETICS_BY_TYPE()`, que ya está importado. Y de paso resuelve
> media F16: si el número está desglosado, se puede enseñar en la tarjeta de
> identidad sin obligar al jugador a entrar al perfil.

### F16 · El desbloqueo se ve en el perfil, en el ranking y arriba a la izquierda

El desbloqueado se tiene que mostrar tanto en el perfil, como en el ranking, como
arriba a la izquierda en el menú principal.

> **Aquí hay que separar dos cosas que el texto mezcla:**
>
> **Lo desbloqueado** (el título, el marco, el banner equipado) sale en el perfil, y en
> el ranking sale **solo el título** (`rankings.ts:147`). El marco y el banner no salen
> en el ranking, y eso ya es B2. Arriba a la izquierda del menú principal no sale nada.
>
> **Lo que se desbloquea en ese momento** es otra cosa, y esa es la que no existe: es el
> **cartel de logro**, que no se ha visto nunca en toda la partida. Es B3, con sus dos
> causas ya diagnosticadas.
>
> Los sitios posibles para lo recién desbloqueado, de menos a más trabajo: el
> `#achievement-stack` que ya existe (`layout.ts:353`, abajo al centro), la esquina
> superior izquierda como pides, o el panel principal. Arriba a la izquierda es el sitio
> que más se ve, pero también el que más se solapa con el contenido en móvil.

### F17 · Saltarse la animación de la ruleta

Poder skipear la animación de la ruleta con un check.

> **Ojo: el trompo dura 5.200 ms y no es decorativo para el jugador**: es la
> anticipación. El comentario de `crateRoulette.ts:23-43` explica por qué el frenado es
> lo que da emoción y por qué 7.000 ms serían solo más espera.
>
> **Pero el skip no es "quitar la animación": es "saltar al final".** El premio ya está
> decidido y aplicado antes de que empiece el trompo (F10), así que saltar es seguro:
> solo hay que terminar la transición en la casilla ganadora y enseñar el cartel. El
> riesgo real es el doble clic: si se puede saltar, salta **una** ruleta y se come las
> que hay debajo.
>
> El interruptor tiene que ser persistente (un `check`, como pides) y su sitio natural
> es el perfil o un panel de ajustes, no el modal de la ruleta: un control dentro de
> algo que se puede saltar no se alcanza nunca.

### F18 · Abrir varias cajas de golpe

Poder abrir cajas simultáneamente si el espacio del almacén me da.

> **La condición que pones es la correcta y ya está resuelta en el motor:**
> `hasSpace()` (`crateLoot.ts:355`) y `addToWarehouse` son los que deciden, así que "si
> el espacio me da" se puede preguntar antes y no hay que bloquear nada.
>
> **Lo que hay que decidir es qué pasa con las que no caben**, y hay tres lecturas:
> abrir tantas como quepan y decir cuántas sobraron, **parar** en cuanto no quede sitio,
> o **meter en cola** las que no caben para cuando liberes espacio. La tercera es la
> mejor jugable y la más cara, porque necesita un sitio donde vivan las pendientes —y
> ya hay uno: la `materializePendingCrates()` que materializa las cajas al cargar
> (`gameLoop.ts:1587`) arrastra un "pendientes" desde antes de este lote.
>
> **Y ojo con el trompo**: abrir cinco cajas son cinco trompos de 5,2 segundos, que son
> 26 segundos de espera. F17 es la condición para que esto sea usable: sin poder saltar
> el trompo, abrir cajas en lote es un castigo.

### F19 · Los logros de las cajas son un item que hay que usar

Los logros que salen en las cajas son un item que tengo que usar para que me dé el
logro. Esto es así porque más adelante se va a poder tradear.

> **Cambia el modelo entero de logros, no es un ajuste.** Hoy un logro se cumple solo
> cuando se cumple su condición (`achievements.ts:187-198`), y por eso existe un
> logro "Cien cajas. Ni una más." que aparece por abrir cajas. Con esto, **la caja te
> da un item y el logro llega cuando lo usas**: alguien más puede pasártelo y lo
> desbloqueas tú sin abrir 100 cajas.
>
> **El motivo que das —el intercambio— es de peso, pero conviene dejarlo escrito,
> porque tiene un coste:** un logro se puede tirar, y "tirar un logro" es una cosa rara
> que hay que decidir de verdad. Si se puede regalar, alguien puede regalar logros que no
> quiere, y el resumen del perfil y el ranking dirán cosas distintas de lo que el
> jugador hizo (un logro pesa 50.000 puntos, y uno secreto 250.000).
>
> **Lo que hay que decidir antes:** qué pasa con el item si ya tienes el logro (se vende,
> se guarda, no se puede usar dos veces), y si los logros **seguros** son tradeares o
> solo los de caja. Los quince actuales llegan todos por la vía directa.

### F20 · Elegir imagen de perfil: cinco, y packs e logros como fuentes

Permitamos elegir una imagen entre varias 5 a los jugadores en su perfil. Son como
iconos, se pueden desbloquear o comprar en un pack aleatorio, y **algunos salen en
logros**. Se podrá tradear más adelante.

> **El avatar ya existe como sitio, pero no guarda nada:** `identityCard()` monta tres
> capas y el centro son **las dos iniciales del nombre** (`profilePage.ts:54,72`). El
> hueco para la imagen está ahí, y es el `.avatar-core` del `.avatar-stack`
> (`style.modules.css:192`).
>
> **Encaja con el sistema que ya hay:** es un cuarto tipo de cosmético al lado de título,
> marco y banner, y ya están las cuatro piezas que hacen falta: `COSMETICS_BY_TYPE()`
> para la rejilla, `unlockCosmetic()` para el desbloqueo, `rollCrateCosmetic()` para el
> pack, y los logros de caja para los que se ganan jugando. Lo que **no** existe y hay
> que añadir: el "pack aleatorio" como producto comprable (hoy las cajas lo son, y eso ya
> es exactamente lo que se pide) y la fuente de los logros.
>
> **Un aviso de privacidad, porque esto va justo donde B8 y no lo resuelve por
> accidente:** una imagen de perfil es lo primero que se ve de un jugador en el ranking,
> y es **lo primero que hay que poder leer de un documento ajeno**. La arquitectura
> correcta es que la imagen viaje en el documento público de la identidad —el mismo
> donde irá la tarjeta de B8—, no en el guardado privado.

### F21 · Los logros de caja necesitan un nombre y no un "???"

*(Sale de F19.)*

> Los dos secretos (`ghost` y `hidden`) se llaman `???` con la descripción "Un logro
> que nadie te pidió completar." (`achievements.ts:153,167`). Si van a ser **items que
> se usan y se traded**, un logro sin nombre no se puede ni buscar, ni regalar, ni
> revelar. Y la fecha de revelación —al recibirlo, al usarlo, o al intentar usarlo dos
> veces— es una decisión, y es buena: es el momento que hoy no existe.

### F23 · No se pueden abrir dos sesiones a la vez, ni en dos dispositivos

No debería poder abrir dos sesiones en dos dispositivos o en el mismo dispositivo. Si una
está activa, validarlo y no dejar conectar otra hasta que se desloguee la otra.

> **Revisado, y aquí no hay bug: el mecanismo nunca existió. Es una decisión, y una
> de las que tocan la confianza del jugador.**
>
> **Lo que hay hoy, medido:**
> - **No hay ningún bloqueo de sesión.** Ni `deviceId`, ni `heartbeat`, ni "sesión
>   activa" en ningún sitio: `grep` sobre `src/` sale limpio. `firestore.rules` no
>   tiene ninguna regla de sesión.
> - Los dos dispositivos **juegan a la vez** contra el mismo documento
>   `users/{uid}`, y `saveToFirebase()` escribe el estado **completo** con
>   `setDoc(..., { merge: true })` cada 15 segundos. O sea que **se pisan el uno al
>   otro**, sin error y sin aviso.
> - Hay mitigación parcial y funciona: al cargar, la cola local **solo se adopta si es
>   más nueva que el documento**, así que el segundo dispositivo no pisa al primero
>   con datos viejos. Pero eso protege **el arranque**, no la partida en curso.
> - Lo más grave: **la Ascensión paga con núcleos y borra las nanitas.** Si los dos
>  Reinician a la vez, el segundo `prestige()` ve un saldo ya a cero y paga 0 núcleos
>   por un reinicio que no le correspondía. La cola local protege ese caso (por eso
>   existe), pero un prestige **con la pestaña abierta y sin recargar** no pasa por
>   la cola.
>
> **Tu propuesta es la correcta, y tiene una forma que no complica nada:** un
> `deviceId` guardado en `localStorage` (o `sessionStorage`), un `heartbeat` en
> `users/{uid}`, y al arrancar, si el `deviceId` del documento es otro y su latido es
> **reciente**, se rechaza la entrada con un mensaje. "Reciente" es la palabra clave:
> hace falta un reloj de expiración corto (30-60 s) para que **cerrar la pestaña
> libere la cuenta**, o el jugador se quedaría fuera de su propia partida.
>
> **DECIDIDO: negarse a entrar, no expulsar al otro.** Es lo más seguro y es lo que
> has elegido. La otra sesión **sigue viva** hasta que se cierra sola, y el jugador
> que intente entrar recibe un mensaje que explica por qué en vez de una pantalla
> vacía. Dos detalles que hay que decidir al escribirlo:
> - **El mensaje tiene que decir qué hacer.** "Ya tienes la partida abierta en otro
>   sitio" sin más es un callejón: el jugador no sabe si esperar, cerrar el otro
>   dispositivo, o qué.
> - **Y tiene que reintentar solo.** Si abres el móvil con el escritorio abierto, no
>   puedes tener que recargar a mano: el latido se mira al arrancar **y otra vez
>   cuando expire**.
>
> **Y el caso de dos pestañas en el mismo dispositivo** es el raro pero el que más
> gente se va a encontrar, y se resuelve solo con `sessionStorage` en vez de
> `localStorage`: cada pestaña tiene su id y no hay que tratarlo aparte.

### F24 · La forja: tocar un item gasta los 3 y no se puede desequipar

Ver funcionamiento de la forja. Al tocar un item me toma como si cargué los 3. Necesito 3
items. No puedo desequipar material que ingresé en la forja.

> **Son dos cosas distintas y hay que separarlas, porque una puede ser un dato
> perdido y la otra es un botón que falta.**
>
> **1 · "Al tocar un item me toma como si cargué los 3".** **Resuelto: es la vista
> mintiendo**, y es la mejor de las dos respuestas posibles, porque significa que no hay
> datos perdidos ni partidas tocadas.
>
> **La causa está localizada y medida.** `forgeCollector()` acepta
> `materialIds: string[]` y rechaza si `materialIds.length !== 3`. O sea que **el motor
> no sabe contar lo que has metido**: solo mira que le lleguen tres posiciones. Y **no
> deduplica** —no hay ningún `Set` ni comparación de ids—, así que si la vista manda el
> mismo id tres veces el motor ve tres, lo acepta, y la casilla enseña 3.
>
> El fallo es que **la cuenta la hace la vista y el motor no la comprueba**, y se
> arregla en los dos sitios, que son una línea cada uno: la vista manda un id por
> material (no tres por el mismo) y el motor deduplica y cuenta los **únicos** — que es
> exactamente lo que ya dice su propio mensaje de error, "Selecciona exactamente 3
> recolectores".
>
> **Y hay un detalle que sube la gravedad:** como no deduplica, hoy **se puede
> "fusionar" un solo recolector y sacar otro**, porque el mismo id cuenta como tres.
> Eso no es un número mal pintado: **es un atajo que ahorra dos materiales**. Por eso
> el arreglo no puede ser solo de la vista.
>
> **Lo que sí se puede decir del síntoma:** "necesito 3 items" y "al tocar uno me toma
> los 3" apuntan a que la casilla **no tiene cantidad**: o está llena o vacía. Si
> hubiera un "x1/x2/x3" en la casilla, el jugador vería que solo ha cargado una.
>
> **Para cerrarlo hacía falta un dato tuyo, y ya llegó:** "enseña 3 y metí 1".
>
> **2 · "No puedo desequipar material".** Esto es independiente y no necesita
> diagnóstico: **si el material está en un estado aparte del almacén y no hay salida,
> cada intento fallido es una pérdida permanente.** Metes un item que no te vale, lo
> ves fallar, y no puedes sacarlo. Eso es lo que hace que la forja dé miedo de usar, y
> por eso está en Features y no en Bugs: no es que falle, es que **no existe**.
>
> El arreglo barato es un botón de **quitar** por casilla que devuelva el item al
> almacén. Y tiene una decisión de fondo que es tuya: si al quitar se queda sin
> material para completar la receta, ¿se cancela el intento entero o se queda a medias?
> Lo natural es cancelarlo entero, y además evita el estado raro de "intento a medias
> guardado en el save".

### F25 · El mercado va primero, porque siempre lo confundo

Mover el mercado al primer segundo amor porque siempre lo confundo.

> **Lo más barato del lote.** Y lo que hay que decidir es solo **cuál** es el mercado:
> si es la pantalla de venta del almacén o una sección aparte, porque "primer
> segundo" significa distinta cosa en cada caso. Una línea de orden en el array de
> navegación y nada más.
>
> Y es justo la clase de cosa que **no necesita un banco**: es posición en un array.

### F26 · El cristal tiene que ser del mismo tier del item, estrictamente

Arreglarlo para que necesite cristales del mismo tier del item que estoy mejorando
estrictamente, y que la progresión se mantenga como está ahora para que haya fallo.

> **DECIDIDO, y es mejor que la variante que yo había propuesto. Tres razones:**
>
> 1. **Es mucho menos invasivo.** No cambia la economía: el cristal sigue siendo lo que
>    multiplica la **probabilidad de acierto** (`crystalSuccessChance`) y la cantidad
>    sigue siendo `collectorUpgradeCost` con su 1,26 por nivel. No hay que tocar la curva
>    de progresión.
> 2. **El fallo se conserva, y eso salva a F32.** Si el cristal sigue siendo probabilidad
>    y no cantidad, la sintonización **puede fallar**, y entonces tu idea de perder 1 o 2
>    niveles a partir del 10 sigue teniendo dónde aplicarse. Con mi propuesta el azar
>    desaparecía y F32 se quedaba sin sitio.
> 3. **Y hace legible la elección.** Con la regla estricta no hay que hacer cuentas: el
>    botón dice "necesitas Cristal T8" y está claro. Mi versión de "puntos de cristal"
>    obligaba al jugador a dividir para saber qué comprar.
>
> **Y tiene un efecto secundario que va justo a donde quieres con F31:** si un T8
> **exige** cristal T8, y el cristal T8 sale de las cajas altas, **entonces las cajas
> dejan de ser un adorno y pasan a ser obligatorias para progresar**. Eso es la misma cosa
> que pedías en F31, resuelta por otro camino y sin tocar la forja.
>
> ---
>
> **EL PROBLEMA QUE ESTA REGLA DESTAPA, Y ES EL TERCERO DEL MISMO TIPO.**
>
> Con items de tier 1 a 10, **la regla estricta necesita cristales de nivel 1 a 10**. Y
> los que hay hoy son otra cosa:
>
> | Nivel de cristal | Nombre | ¿De dónde sale? |
> |---|---|---|
> | 1 | Afino | **Se compra** (200) y sale de las cajas comunes, raras y épicas |
> | 2 | Fase | **Solo cajas legendarias** |
> | 3 | Entropía (x2,75) | **De ningún sitio** |
> | 4 | Singular (x4) | **De ningún sitio** |
>
> **Medido: las cuatro cajas solo dan `materialTier` 1, y la legendaria da 2.** O sea que
> **`CRYSTAL_DEFS` declara cuatro cristales y el juego solo puede dar dos**. El 3 y el 4
> tienen nombre, multiplicador y probabilidad de caída escritas, y **no los saca nadie**.
>
> **Es el mismo fallo por tercera vez, y ya se puede llamar patrón:** la Llave del Vacío que
> no salía de ninguna parte (**B6**), el Espectro Azulado que no sacaba ninguna tabla
> (**D1**) y ahora los cristales 3 y 4. **Los tres eran una cosa definida y otra cosa que
> nunca se conectaron.** Y aquí pasa a ser grave, porque con la regla estricta **si el T8
> pide cristal T8 y el cristal T8 no existe, el T8 no se puede mejorar**: no es contenido
> inalcanzable, es un **muro**.
>
> **Lo que hay que hacer, y es contenido:**
> - **Un nivel de cristal por tier de item**, o **bandas** si 10 niveles son demasiados. Con
>   10 hay que escribir 10 nombres y 10 descripciones, y decidir qué caja suelta cada uno.
> - **Y hay que decidir de dónde salen los altos**, que es la decisión de verdad: si solo
>   salen de la legendaria, el tramo 8-10 **depende de una caja que cuesta 21.000 más
>   llave**, y eso hay que medirlo. Si hay dos cajas que los sueltan, el tramo alto tiene
>   dos fuentes y el juego no tiene un cuello de botella único.
> - **Y la ficha tiene que decirlo antes**: con la regla estricta, si el jugador tiene
>   Afino y toca un T8, el botón tiene que estar apagado con "necesitas Cristal T8", no
>   enabled y fallando después. Es R3 otra vez, y aquí el coste de no hacerlo es alto: el
>   jugador gasta 200 en cristal que no le sirve para nada.


### F27 · El almacén necesita un tope y las ampliaciones deben escalarse por tipo

El almacén es infinito aparentemente. Ponerle un cupo, hacer que el agrandar almacén sea
un objeto y las mejoras requieran un tipo mayor de mejora de almacén a medida que más
cantidad tengo. Ej: Expansor T1, Expansor T2, etc.

> **Revisado con tu dato ("compré 100"), y sale un dato duro: hay DOS ampliaciones
> con reglas distintas, y tú compraste la que no tiene tope.**
>
> **Lo que hay, medido:**
>
> | Carta | Qué da | Precio | Tope |
> |---|---|---|---|
> | `warehouseSlot` (tienda) | **+5** | 6.000 | **ninguno en el motor** |
> | `backpackExpander` (consumible de caja) | +1 | 1.400 | 50, en la vista |
>
> - El **"Al máximo" a 50** es de `backpackExpander`, y **el 50 está en la vista**
>   (`store.ts:254`), no en una tabla. Ese producto sí tiene tope.
> - **`warehouseSlot` no tiene tope en ninguna parte**: `state.warehouseCapacity += 5`
>   y sale. **Con 100 compras son +500 ranuras**, que es lo que tienes.
> - **Y son 600.000 nanitas.** Contra una carta de T10 a 193.850, has pagado **tres
>   cartas de T10** por espacio de inventario. Ese es el "el precio siempre es el
>   mismo" que decías, y ya no es una impresión: es un número.
>
> **Lo que esto arregla, en orden:**
> 1. **Un solo producto de ampliación**, o dos con reglas declaradas y distintas. Hoy
>    hay dos y el jugador no puede saber cuál compra.
> 2. **Los Expansor T1 / T2 / T3 que pides**, cada uno con más ranuras y más precio —que
>    es lo que hace la forja y no el almacén—. **Y aquí entra tu idea, que es buena:**
>    que **algunos solo se consigan en las cajas**. Así la ampliación grande es una
>    recompensa de caja y no una compra, y eso **le da a las cajas el valor que
>    F31 quiere darles** — que es el mismo problema resuelto dos veces.
> 3. **El tope sale de una tabla** y no de un `50` en la vista.
> 4. **Y hace falta una migración, porque ya pasaste el tope.** No se puede poner un
>    tope de 60 a alguien que tiene 500 sin decidir qué pasa con esas 500. Lo natural
>    es que el tope nuevo sea **alto**, y que la presión venga del precio y de las cajas,
>    no de un muro. Un tope que ahora te sirve a ti con 500 y a un jugador nuevo lo ahoga
>    en su primera hora.
>
> **Y una consecuencia que hay que mirar, porque es de fondo:** con un tope real, el
> almacén pasa a ser **un recurso que obliga a vender**. Si un jugador no puede crecer
> porque está lleno y no le compensa vender, está atrapado. Hay que decidir cómo es la
> salida —y `sellPrice` deja de ser decorativo—.

### F28 · La ruleta va demasiado rápido en el navegador y bien en el celular

En el navegador la ruleta se ejecuta muy rápido, en celular anda bien. A lo mejor con un
delta time.

> **Tu hipótesis es la correcta, y hay un sitio donde ya está escrito por qué debería
> funcionar — y por eso esinteresting que no funcione.**
>
> `crateRoulette.ts` cuenta las vueltas en **ventanas de tiempo visibles**, no en un
> número de vueltas fijo, y `rouletteCheck` lo comprueba. O sea que el diseño ya
> contempla que el trompo dure lo mismo en móvil y en escritorio. **Si en el navegador
> va más rápido, es que algo por debajo cuenta otra cosa.**
>
> **Y la causa más probable es exactamente la que dices**, por una razón concreta: si
> la animación avanza con `requestAnimationFrame` **contando frames**, entonces un
> monitor de 144 Hz hace la misma animación en la mitad de tiempo real que uno de
> 60 Hz. En el móvil el navegador baja a 60 (o a 30 con ahorro de energía), así que
> **allí va "bien" por accidente**. El síntoma —"rápido justo donde hay más potencia"—
> encaja con esto mejor que con ninguna otra explicación.
>
> **Y sí: delta time.** Es la solución estándar. Si ya cuenta milisegundos, entonces el
> problema es otro y hay que mirarlo con un cronómetro: **`rouletteCheck` mide la
> matemática de la curva, no cuánto tarda en pantalla**, así que esto no lo cubre
> ningún banco. Es un caso de `ruleta-preview.html` con un reloj al lado.

### F29 · Los núcleos van al ranking como pestaña nueva, y no como puntos

Agregar al ranking núcleos adquiridos como nueva pestaña. No mostrar en base a qué se ganan
puntos, que sea un cálculo interno; la adquisición de núcleos va a afectar a la nueva
fórmula.

> **Las dos mitades son distintas y la segunda es la buena.**
>
> **DECIDIDO: los núcleos entran en el cálculo del definitivo Y llevan pestaña
> aparte.** Las dos mitades, no una: puntúan y además se ven. Es lo que hace falta
> para que la pestaña tenga sentido —si solo contasen puntos, enseñar el desglose sería
> una comodidad—, y es coherente con que el núcleo sea **la única cosa que no se
> pierde al reiniciar**: si vale puntos, reiniciar es una decisión rentable, que es
> justo lo que un incremental quiere.
>
> **1 · Núcleos en el ranking, como pestaña.** Sale casi gratis: `state.cores` ya está
> en el guardado y `getPrestigeInfo()` lo devuelve. El ranking solo no lo publica, y
> eso es F22 diciendo que no se puede comparar. Y a diferencia de lo que dije de B8,
> **aquí no hay decisión de privacidad**: un número de núcleos es "cuántas veces has
> reiniciado", no tu saldo ni tu inventario.
>
> **2 · "Que no se vea en qué se ganan puntos, que sea un cálculo interno".** Esta es
> la petición que más bien viene, y **es la que hay que hacer con más cuidado**, por
> una razón que no es de visibilidad: ahora el ranking **enseña una fórmula** —hay
> "logro pesa 50.000, y uno secreto 250.000" repartidos—, y un jugador que lo sepa
> optimiza **la puntuación** en vez de **la partida**. Y F19 (logros que se regalan)
> vuelve esto peligroso de verdad: con los pesos a la vista, regalar un logro de
> 250.000 puntos deja de ser un detalle y pasa a ser lo más rentable que puede hacer
> un jugador — y por supuesto te lo haría a ti.
>
> **Y aquí hay un aviso que no está en tu petición pero sale de ella:** si los núcleos
> **puntúan**, F23 y F29 se cruzan. Bloquear la segunda sesión (F23) es lo que impide
> farmear núcleos con dos pestañas a la vez. **O sea que F23 es la condición de que
> F29 sea justo** — sin F23, el nuevo sistema de puntos premia abrir dos veces.
>
> **Y el formato de la pestaña:** desglose, no un número suelto. Total, y de ahí cuánto
> viene de cada cosa. Pero **el desglose solo desde arriba**: "núcleos: 12" sí;
> "núcleos 12 × 340 = 4.080 puntos" no. Es el mismo criterio que la ficha de la caja,
> que enseña **qué** es y no cuánto costó.

### F30 · Al pasar de 99 hay que generar otra pila — y revisar todos los apilables

Al comprar más de 99 llaves se tiene que generar otro stack en el inventario. Lo mismo
con los cristales, checkear los apilables en general.

> **Aquí tu diagnóstico es correcto sobre lo que ves y hay que corregirlo sobre lo que
> pasa.** Y lo importante: **no se pierden llaves.**
>
> `MAX_STACK` es `{ consumable: 20, crate: 20, key: 99, crystal: 99 }`, y el comentario
> del propio fichero lo dice: es un **tope de pintado**, no de almacenamiento. Detrás de
> una pila puede haber 25 cajas y el detalle sigue enseñando las 25. **Comprar 150
> llaves no pierde llaves**; lo que hace es que la esquina se queda en 99.
>
> O sea que hay dos preguntas y **solo una es un bug**:
> 1. **¿Se pierden al pasar de 99?** `stackCheck` comprueba que **no** (19 unidades,
>    una sola pila, `stackCount` correcto, y sobrevive a la recarga). **Con 150 no está
>    comprobado**, porque el banco se detiene en 19, y ese es el número que hay que
>    probar antes de dar esto por cerrado.
> 2. **¿Es correcto que se vea 99 cuando hay 150?** **Aquí tienes razón**, y es R3 otra
>    vez: lo que se ve no es lo que hay. El jugador ve "99" y no tiene forma de saber
>    que hay más ni cuánto. La solución obvia es **"99+"**, o enseñar el número de
>    **pilas** en vez de un tope que parece un recorte.
>
> **Y "checkear los apilables en general" es la parte que más valor da**, porque
> `MAX_STACK` son **cuatro números escritos a mano** y el criterio se repite en tres
> sitios (`warehouse.ts:359`, `:908` y la línea 1344, que es la vista de venta). Tres
> sitios que pueden discrepar. Lo que hay que hacer es **una función de apilado** que
> sea la que decide el tope, el desglose y el número pintado, y que las tres vistas
> llamen — que es exactamente el patrón que se acaba de aplicar a las llaves y a las
> ranuras.

### F31 · La tienda solo vende tier 0; los siguientes, por fusión o cajas

Reestructuramos el sistema para que de la tienda solo se puedan comprar los tier 0 y
mediante fusión o cajas se puedan comprar los siguientes tiers. Puede pasar el juego
sin comprar casi cajas; para darle más valor a las cajas, nivelemos todo.

> **La observación es buena y el número que la sostiene salió de P1-P2, pero falta la
> mitad de la medición.**
>
> Lo que está atado con `balanceCheck`: **el precio por punto de poder sube con el
> tier** (150 → 416), así que la progresión **por compras** está bien. Lo que **no**
> está medido es **cuánto del camino se puede hacer sin abrir una caja** — y eso es
> exactamente lo que estás diciendo. Con veinte cartas de 900 a 193.850 y un almacén
> que se amplía pagando, es plausible que se llegue al final sin abrir ninguna.
>
> **Si es así, las cajas son un adorno con animación**, y eso es un problema de verdad:
> el jugador no ve para qué están.
>
> **Lo que hay que decidir antes de escribir nada, y son tres cosas serias:**
> - **(a) ¿Qué es el tier 0?** *(sin respuesta todavía)* Hoy el T1 ya está en la tienda
>   a 900. Si "tier 0" es el T1, la tienda pasa de 20 cartas a 2. Si es algo más bajo
>   que aún no existe, hay que inventarlo.
> - **(b) ¿Cómo se sube de tier?** **RESUELTO: por forja, o bien una caja inferior puede
>   tirar llaves y cajas de un tier superior.** Son **dos vías**, y esa es la decisión
>   buena: la forja es el camino **preparado** —el jugador que la entiende avanza
>   seguro— y la caja es el atajo **caro y con suerte**. Las dos hacen falta, porque hoy la
>   forja es un minijuego opcional y las cajas dan poder directo.
> - **(c) ¿Qué dan las cajas?** **RESUELTO: llaves y cajas de un tier superior.** La caja
>   deja de dar **poder directo** (`companion_t6`, `collector_oc6`) y pasa a dar **la
>   llave y la caja del siguiente tier**. Es decir: no te da un T8, te da **la llave
>   para abrir una caja que sí puede darte un T8**.
>
> **Y con esto (b) y (c) encajan de una forma que es la clave de todo el diseño:** una
> caja de tier N tira la llave de N+1 **y** la caja de N+1, así que **subir por cajas
> es encadenar**, y cada paso es "abre una caja más cara". Eso es lo que le da valor a
> la caja sin que dé poder directamente, y es la diferencia entre "la caja es un
> adorno" y "la caja es una ruta".
>
> **Lo que queda por decidir ya no es de economía sino de números:**
> - **El techo de la forja es T11** —`tier >= 11` se rechaza—, así que hoy la forja no
>   pasa de T10. Si los tiers altos salen de ella, ese techo tiene que moverse, y es una
>   decisión: ¿el T10 es el final absoluto o la forja sigue subiendo?
> - **La tasa de fallo** de la forja, que es justo donde entra tu idea nueva (**F32**).
>
> **Y hay una variante que lo simplifica TODO, y la propongo aquí porque sale de tus
> propias respuestas: una caja por tier.**
>
> Hoy hay cuatro cajas (común, rara, épica, legendaria) y **cada una está atada a un nivel
> de llave**. Si en vez de eso hay **una caja por tier** —diez cajas, T1 a T10—, cada caja
> lleva su llave, y entonces **una sola pieza resuelve cuatro peticiones**:
>
> | Petición | Cómo la resuelve una caja por tier |
> |---|---|
> | **F26** (cristal del mismo tier) | La caja T8 suelta **cristal T8**. Es el problema que hoy es un muro, y aquí sale de la caja correcta por construcción. |
> | **F27** (expansores por tipo) | La caja T8 suelta **Expansor T8**. Ya pediste que algunos fuesen solo de cajas. |
> | **F31** (subir de tier) | La caja T8 suelta la **llave y la caja T9**. Es la cadena que ya definiste. |
> | **D4** (el patrón) | Dejas de tener el problema: si cada caja tiene su fila y cada fila suelta lo que debe, no hay dos tablas que puedan discrepar. |
>
> **Y el efecto de columna vertebral es lo que lo justifica:** la tienda vende la caja T1 y
> la llave T1, y de ahí en adelante **se sube encadenando**. Es un camino único y legible,
> y cada caja es a la vez un premio y una llave.
>
> ---
>
> **LO QUE HAY QUE DECIDIR, Y ES UNA COSA, PERO ES LA IMPORTANTE:**
>
> **¿La tienda vende las cajas y llaves altas, o solo la T1?**
>
> - **Solo T1** → la cadena **es** el juego. No hay atajo, y el progreso depende de abrir
>   cajas, que es justo lo que pediste.
> - **Todas** → el jugador **se compra el T10 directamente**: llave T10 y caja T10, y se
>   acabó la partida. Las cajas altas serían un adorno con animación, o sea **el mismo
>   problema que querías arreglar, en forma nueva**.
>
> Hoy el atajo ya existe en pequeño —llave 250 y caja común 500— así que la pregunta no
> es nueva; lo que cambia con cajas por tier es que el atajo serían **diez compras** en vez
> de una. **Mi opinión: solo T1 en la tienda**, y el resto se sube jugando.
>
> **Y dos cosas técnicas, que son el trabajo de verdad:**
> - **El tipo de caja se deduce del NOMBRE**, no de un campo: `openCrateBox` hace
>   `getCrateTypeFromName(caja.name)`. Con diez cajas hay que escribir diez nombres y
>   **mantener los cuatro viejos como alias**, o las cajas que ya tienes en el almacén
>   dejan de reconocerse. Es R8: coaccionar al cargar, no confiar en el save.
> - **`createCrateItem` pone `tier: 0` siempre**, y el precio de reventa sale de
>   `STORE_ITEMS[${crateType}Crate].cost`. Diez cajas son diez entradas de tienda, o el
>   reventa de una caja alta revienta con un `undefined`.
>
> ---
>
> Y hay un **cuello de botella que aparece al hacerlo** y que conviene tener en la
> cabeza: si todo el poder pasa por la forja, y la forja consume items, entonces el
> **almacén se llena de material de forja** —y F27 quiere ponerle un tope. Los dos
> cambios juntos se estorban: con el almacén acotado, hacer más poder exige vender más,
> y hay que decidir si el material de forja se puede vender sin perder el progreso.
>
> **Es la petición más grande del lote**: no cambia un número, cambia de dónde sale el
> poder. (b) y (c) ya están decididas y encajan bien.

### F32 · A partir del nivel 10, fallar puede restar 1 o 2 niveles

A partir por ejemplo de la mejora 10 de las armas, al fallar haya probabilidad de bajar de
nivel 1 o 2 niveles, para hacerlo más entretenido y difícil de subir.

> **La idea es buena, y hay un número detrás que la sostiene:** hoy la sintonización
> **fallar no cuesta nada**. El nivel se queda igual (`rolls` distingue acierto de fallo,
> y un fallo no retrocede — hay una prueba que lo comprueba). O sea que a partir del
> nivel 10 **subir es gratis en el peor caso**, y un jugador que llega hasta ahí puede
> subir hasta el tope moviendo una aguja sin riesgo. Eso es lo que hace que el tramo alto
> sea aburrido: no es difícil, es **gratis**.
>
> **Y esto cruza con F31 y por eso va con ella.** Si los tiers altos salen de la forja, la
> forja **es** el tramo alto, y sin coste de fallo el único límite es el tiempo. Con
> pérdida de nivel, la forja tiene la misma tensión que una ruleta —y el jugador ya sabe
> cómo se juega esa tensión.
>
> **LO QUE ESTA IDEA OBLIGA A DECIDIR, Y ES MÁS IMPORTANTE QUE EL NÚMERO:**
> **hoy el cristal mide probabilidad de acierto** (`crystalSuccessChance`), y tu respuesta
> a F26 lo cambia a **medir cuánto progreso**. Si el cristal pasa a ser "cuánto avanza", la
> sintonización **deja de ser un azar**: compras el cristal exacto y mejoras seguro.
> **Y entonces F32 no tiene dónde aplicarse**, porque no se puede perder un nivel en algo
> que nunca falla.
>
> **Los dos juntos piden partir el trabajo en dos ejes, y creo que es lo que quieres:**
> - **El cristal decide CUÁNTO** (eje de progreso).
> - **El nivel decide si ACIERTA y qué pasa si falla** (eje de riesgo), y aquí entra tu
>   pérdida de niveles.
>
> Con eso los dos se entienden y ninguno se pisa. Y es una mejora real: el jugador deja
> de perder 40 cristales a lo loco, y **puede calcular de antemano cuánto le falta**.
>
> **Lo que hay que decidir, y son tres números:**
> - **¿Dónde empieza?** Dices "por ejemplo del 10". Por debajo del 10 la pérdida sería
>   demoledora, porque el jugador acaba de desbloquear eso: perder 2 niveles en el 8 es
>   volver al 6. **Empezar en 10 es el número correcto**, y por una razón concreta:
>   `collectorMaxLevel` va a 20 y a 35 con 5 estrellas, así que el 10 es justo donde
>   empieza el segundo tramo y donde el jugador ya ha invertido.
> - **¿Cuánto?** "1 o 2 niveles" necesita probabilidad por nivel, no un rango. Lo más
>   simple y lo más legible: **-1 es lo normal y -2 es raro**, y el -2 debería subir con
>   el nivel en vez de ser fijo.
> - **¿La probabilidad de fallo sube con el nivel?** Si no sube, F32 solo afecta al 10-20
>   y los niveles bajos siguen siendo gratis. Y si sube mucho, el tramo final se vuelve
>   una ruleta que no se puede empujar. Ese es el número que balancea el tramo alto, y va
>   atado a P1-P2.
>
> **Un aviso que no es tuyo pero sale de esto:** si fallar puede restar niveles, **el
> botón de "restaurar" se vuelve imprescindible**. Un jugador que pierde 2 niveles en un
> T10 y los recuperó en 40 minutos de cristal va a dejar de tocar la forja. Y con eso
> la pérdida de un nivel es aceptable y la de dos, no.

### F22 · Sin poder comparar, media lista es trabajo a medios

*(No es una petición del lote: es la consecuencia de hacerlo todo, y está aquí para que
no se pierda.)*

> Si se pueden abrir cajas en lote (F18), ver el perfil de otro (B8), llevar un avatar
> propio (F20) y tener logros que se regalan (F19), **el juego se vuelve competitivo y no
> hay ninguna forma de comparar tu partida con la de otro**: el ranking solo da una
> puntuación compuesta.
>
> Con los bancos que ya hay sale casi gratis: los 17 bancos miden precios por tier,
> progresión y curvas. Lo que falta es una vista de la partida de un jugador —su mejor
> recolector, sus compañeros, su árbol— con la tuya al lado.

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
| **B6-B7 las llaves** | `data/items.ts`, `data/store.ts`, `components/crateLoot.ts` — **ya no el motor** |
| F7-F11 slots de compañero | `gameLoop.ts`, `components/store.ts`, `data/store.ts` |
| B1 primer slot | `gameLoop.ts`, `ui/playerPanel.ts` |
| F8-B2 marco y banner | `gameLoop.ts` (un `setDoc`), `components/rankings.ts`, `services/rankingService.ts` |
| **B3-B4 cartel y pista de logros** | `gameLoop.ts` (`checkAchievements`), `main.ts`, `achievements.ts`, `ui/profilePage.ts` |
| **B9 AFK solo** | `gameLoop.ts` (el tick), y `AFK_THRESHOLD_MS` |
| F12 modal de compra | `gameLoop.ts` (`buyStoreItem`), `components/store.ts` |
| F14 comprar por cantidad | `gameLoop.ts`, `components/store.ts` |
| F15 desglose de cosméticos | `ui/profilePage.ts` — **no toca el motor** |
| F18 abrir cajas en lote | `gameLoop.ts` (`openCrateBox`), `components/warehouse.ts` |
| P1-P3 balance | `gameLoop.ts`, `data/tiers.ts`, `data/prestige.ts` |

Nueve de nueve grupos sobre el mismo fichero significa que **con varios agentes a la
vez se pisan**, y un conflicto ahí no es un conflicto de texto: es economía. Un
`Math.floor` que se mueve cambia el juego y los bancos siguen en verde.

**Las excepciones, y por eso pueden ir en cualquier momento:** F8-B2 toca
`gameLoop.ts` pero solo en el bloque del `setDoc` de `rankings/{uid}` (dos campos
más), y el resto del trabajo vive en `rankings.ts`. **B6-B7 ya no tocan el motor**:
con la mudanza del paso 3 las llaves viven en `data/items.ts`, así que el nudo de las
llaves se puede desatascar sin tocar el fichero de 3.242 líneas. Y **F9, F10, F13, F15,
F20, F21 y F22 tampoco**: F15 es una línea de `profilePage.ts`, F13 y F20 son
contenido, F9-F10-F21-F22 son decisiones.

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

### Lo que cambió con el lote del 20 de octubre

El paso 3 está hecho, así que **el cuello de botella ya no es el mismo** y el orden
anterior hay que corregirlo:

- **Lo primero ya no es una feature: es B6-B7, las llaves.** ~~Ya no es lo
  primero: están hechas, con F5.~~ No porque fuera la más urgente, sino porque
  era la única que hacía el juego **imposible de completar**: la caja legendaria
  no tenía llave en ninguna parte. Un tramo entero del contenido no existía. Y
  tenía la virtud de que ya no tocaba el motor, así que se pudo hacer con el
  árbol en paz.
- **Después, B9 (AFK solo) y B3 (el cartel de logro).** Los dos son medianeros: son
  medianos y R10, que es una regla, no una opinión.
- **F17 y F18 van juntas, en ese orden.** Abrir cajas en lote sin poder saltar el
  trompo son 26 segundos de espera por tanda: F17 es la condición de F18.
- **F11 antes que F12.** El tope de 6 toca la tabla de ranuras, y F12 necesita la
  tabla de compras que F11 ya toca. Juntas, una sola pasada por `store.ts`.
- **F13 y F20 son contenido, y pueden ir cuando quieras.** No dependen de nada y son
  las que más te pagan.
- **F19 y F21 juntos, y son los últimos.** Cambian el modelo de logros entero, y
  F21 (el nombre de los secretos) sale de F19.
- **B8 es una decisión tuya antes que una línea de código**, porque es una de
  privacidad: es lo único del lote que no debería hacer un agente sin que le digas
  qué has decidido.

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
- [x] **F1-F3 · la valoración y el desglose del daño a la vista.** La valoración
      del almacén va abierta (sigue pudiéndose cerrar) y ahora también está en el
      panel principal. El daño se desglosa en `100 base · +50 nivel · +37 bonos`,
      y las tres partes suman el total exacto porque las calcula el motor, no la
      vista. Banco nuevo: `desgloseCheck` (31). Sin commit todavía.
- [x] **F6 · probabilidad baja de tier superior en las cajas, y D1.** El salto es
      una entrada de la tabla de botín (así la ruleta puede pintarlo), sube un peldaño
      y sale entre el 3% y el 6% real según la caja. El Espectro Azulado ya sale de la
      legendaria. `saltoCheck` (42).
- [x] **F4 · fuera los buffs pasivos, solo tarjetas.** No era que fueran buffs: es
      que un buff pasivo activo anula el corte del AFK, así que compraban ingreso sin
      mirar. El efecto sigue en el motor para las partidas viejas. `tarjetaCheck` (17).
- [x] **F7-F11 · escuadrón de 6 con las ranuras en una tabla.** Tres cartas, tope
      6, ningún salto de +3, y el número de ranuras en un solo sitio. `ranuraCheck`
      (34) es el banco nuevo.
- [x] **B3-B4 · el cartel de logro y su pista.** La compra de ampliar el almacén ya
      evalua logros (era la única de las diez rutas que no), el cartel se encola
      cuando todavía no hay layout y se vacía en cuanto lo hay, y la pista mide la
      capacidad real con el árbol. `toastCheck` pasó de 25 a 31.
- [x] **B9 · el AFK se pone solo estando en la pantalla.** La pregunta va en el
      tick, no en el manejador de presencia; el `mousemove` ha dejado de contar como
      actividad (hacía el AFK inútil); el umbral sube a 60 s. `tickCheck` pasó de 14
      a 20.
- [x] **B6-B7-F5 · las llaves.** La cadena cierra: cada caja suelta la llave que
      la abre, y los cuatro textos se generan con la regla que decide si abre, así
      que no pueden mentir. Cuatro cartas en la tienda con nombres y precios que
      ya son los del item. La caja legendaria se puede abrir. Banco nuevo:
      `llaveCheck` (92).
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

### D3 · La llave de una caja no puede ser más cara que la caja

> Salió al intentar cerrar B6: los primeros precios que puse eran 250 / 1.500 /
> 7.500 / 30.000, y entonces la llave épica (7.500) salía **más cara que su caja**
> (5.500) y la del Vacío (30.000) que la legendaria (21.000).
>
> **El banco lo cazó, y no por el balance: por la regla.** `llaveCheck` comprueba
> que la llave de cada caja cueste menos que la caja, y falló en dos.
>
> **El porqué de la regla:** si la llave cuesta más que la caja, la caja es la
> mitad barata del par, y un jugador que reúna la llave y se quede sin nanitas
> para la caja tiene que elegir entre las dos. La decisión de qué comprar primero
> no es interesante: es un embudo. Y hay algo mejor que una regla de "más cara
> o más barata": **cada caja suelta llaves de su nivel**, así que comprar llave y
> caja en la tienda siempre sale más caro que abrir cajas, y la tienda nunca es
> el camino óptimo por una razón que el jugador puede entender.
>
> El precio final queda en 250 / 900 / 3.000 / 11.000, algo menos de la mitad de
> la caja que abre en los cuatro casos.

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

### D1 · Un compañero existe pero no se puede conseguir — RESUELTO

El **Espectro Azulado** (Épico, `passive`, power 18) está en `CRATE_ONLY_COMPANIONS`
como índice 5, y **la tabla de botín no lo usa**: solo se referencian los índices
0 a 4. Está definido y es inalcanzable.

> Apuntado mientras se buscaba B1, no es un bug de juego sino de contenido. Las
> dos salidas posibles: meterlo en la tabla de botín, o borrarlo del array para
> que no invente una recompensa que no existe.
>
> **Decidido: entra en la tabla**, con peso 5, el más bajo de la legendaria. El motivo
> es que el arreglo de más valor para el jugador es que el compañero exista y se
> pueda conseguir, no que el array quede limpio; borrarlo sería tirar contenido ya
> escrito a cambio de nada.
>
> **Y el índice 5 no lo usaba nadie más**, así que no hay migración que hacer: ningún
> guardado apunta al 5. `saltoCheck` lo comprueba, y comprueba también que los índices
> 0 a 4 **siguen saliendo** — que es lo que rompería un guardado antiguo si alguien
> reordenara el array.

### D4 · El patrón: una cosa definida y otra que nunca se conectaron

*(No es una petición del jugador. Es lo que emerge de los tres bugs anteriores, y está
aquí para que el cuarto no pase.)*

> **Tres veces en este lote, el mismo fallo exacto:**
>
> | | Qué está definido | Qué nunca se conectó |
> |---|---|---|
> | **B6** | La Llave del Vacío, con nombre y rareza | Ninguna caja la soltaba: la legendaria era **imposible de abrir** |
> | **D1** | El Espectro Azulado, con tipo, poder y rareza | Ninguna tabla lo usaba: el índice 5 se saltaba |
> | **F26** | Los cristales 3 y 4, con nombre y multiplicador | Ninguna caja los soltaba: **4 declarados, 2 obtenibles** |
>
> **La forma del fallo es siempre la misma:** hay una **tabla que describe** una cosa
> (llaves, compañeros, cristales) y otra **tabla que la reparte**, y **las dos no tienen
> por qué estar de acuerdo**. Ninguno de los tres casos era un error de cálculo: era una
> lista que declaraba algo y un reparto que nunca lo mencionaba.
>
> **Por qué no lo detecta ningún banco, y esto es lo importante:** los tres eran
> **contenido inalcanzable**, y el juego **funcionaba perfectamente** sin ellos. No había
> ningún número que saliera mal — el saldo cuadraba, el guardado cuadraba, la ruleta
> cuadraba. Lo único que faltaba era una cosa que el jugador nunca iba a ver.
>
> **Y por eso el banco que sirve aquí es uno de cobertura, no de números:** preguntar
> "todo lo que está definido, ¿se puede conseguir?" no es una aserción de que un valor
> sea tal cual, es una pregunta sobre **la unión de dos tablas**. Ninguno de los tres
> bancos que cierran esto (`llaveCheck`, `saltoCheck`, y el que falta para los cristales)
> podría haberlo visto antes de que la regla nueva lo pidiera.
>
> **La regla que sale de esto, para lo que se añada:** cuando se declara una cosa con
> nombre, multiplicador y probabilidad, **tiene que haber un banco que pregunte de dónde
> sale**. No que funcione: que exista. Es barato, y los tres bugs eran gratis de evitar.
