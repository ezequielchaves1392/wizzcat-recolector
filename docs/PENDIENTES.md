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

**Antes de empezarlas hay tres datos que solo tú tienes** y que evitan adivinar:

1. **Forja (F24):** ¿el detalle enseña **1** y has metido 3 de verdad, o enseña 3 y has
   metido 1? De eso depende que el arreglo sea una línea de vista o una migración de
   partidas ya tocadas.
2. **Sesión y theme (B11):** ¿el botón de cerrar sesión **está** y no responde, o **no
   está**? Y en el mismo móvil, ¿pasa en horizontal y en vertical?
3. **Almacén (F27):** ¿sabes si alguna partida tuya ya pasó de 50 ranuras? Decide si hace
   falta migración.

**Y cuatro decisiones que son tuyas, no código:**

| # | La decisión | Por qué no es un ajuste |
|---|---|---|
| **F23** | ¿Expulsa al otro dispositivo o se niega a entrar? | Cambia quién pierde la partida en curso. |
| **F26** | ¿La cantidad la fija el tipo de cristal, o el tipo solo multiplica? | Decide cuánto pesa el final de partida. |
| **F29** | ¿Los núcleos entran en la puntuación o van solo en su pestaña? | Si puntúan, el reinicio pasa a ser rentable. |
| **F31** | ¿Cómo se sube de tier: forja o cajas? | Es la petición que cambia de dónde sale el poder. |

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
> - **Que no haya camino hasta él.** Que cerrar sesión esté en una página a la que no se
>   llega, o detrás de un menú que no cabe en 390 px.
> - **Que el botón no exista en ese build.** Menos probable, pero es lo primero que
>   descartaría.
>
> **Lo que necesito de ti para no adivinar:** ¿el botón **está** y no responde, o **no
> está**? Con eso se separa el caso de layout del caso de que falte el camino. Y si
> pasa en horizontal y en vertical por igual, eso apunta a `safe-area`; si solo en
> vertical, a la altura.

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
> **LO QUE HAY QUE DECIDIR, Y ES TUYO:**
> - **¿Expulsar al otro o negarse a entrar?** Si el nuevo **expulsa** al viejo, es lo
>   más cómodo para quien juega y lo más agresivo para quien tenía el juego abierto
>   en otra pestaña. Si **se niega a entrar**, nadie se queda sin su partida a medias
>   pero hay que reintentar.
> - **Y en el mismo dispositivo, dos pestañas** es el caso raro pero el que más
>   gente se va a encontrar. Con `sessionStorage` en vez de `localStorage`, cada
>   pestaña tiene su id y el caso se resuelve solo.

### F24 · La forja: tocar un item gasta los 3 y no se puede desequipar

Ver funcionamiento de la forja. Al tocar un item me toma como si cargué los 3. Necesito 3
items. No puedo desequipar material que ingresé en la forja.

> **Son dos cosas distintas y hay que separarlas, porque una puede ser un dato
> perdido y la otra es un botón que falta.**
>
> **1 · "Al tocar un item me toma como si cargué los 3".** Aquí **no he medido nada**,
> y por eso no te voy a inventar la causa: no sé si la forja guarda 3 unidades de lo
> que tocaste, o si solo lo muestra así. **La diferencia es enorme**: si solo es el
> pintado, es R3 —lo que se ve no es lo que hay— y se arregla en una vista; si guarda 3,
> entonces cada toque de un solo item **destruye dos**, y eso no es un bug de texto sino
> de economía, y las partidas que ya has jugado están tocadas.
>
> **Lo que sí se puede decir del síntoma:** "necesito 3 items" y "al tocar uno me toma
> los 3" apuntan a que la casilla **no tiene cantidad**: o está llena o vacía. Si
> hubiera un "x1/x2/x3" en la casilla, el jugador vería que solo ha cargado una.
>
> **Para cerrarlo hace falta un dato que solo tú tienes:** ¿el detalle de la forja
> enseña **1** y has metido 3 de verdad, o enseña 3 y solo has metido 1? Con eso se
> sabe si hay que tocar la vista o el motor.
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

### F26 · Las mejoras de nivel piden cristales mejores, no solo más de los mismos

Los tienes superiores requieren o cristales de distintos tipos o más cristales base para
mejorarse.

> **Revisado, y tu intuición es correcta pero a medias: los dos sistemas YA existen,
> solo que no se hablan.**
>
> - **El multiplicador ya es por tipo de cristal.** `CRYSTAL_DEFS` tiene cuatro
>   niveles: Afino (x1, el que se compra), Fase (x1,75), Entropía (x2,75) y Singular
>   (x4). Los tres últimos **salen de las cajas altas**. O sea que **un nivel alto ya
>   necesita un cristal mejor**: es lo que hace `crystalSuccessChance`.
> - **La cantidad es plana.** `collectorUpgradeCost` multiplica 1,26 por nivel y
>   **siempre del mismo cristal**. Ahí no hay tipo.
>
> Traducido: hoy el cristal decide **si** mejoras y cuánto cobra, pero **no qué**
> gastas. Un jugador con 40 Entropía tiene que gastar 40 Afino, y los Afino son los
> que se compran.
>
> **Y lo que hay que decidir es el punto dulce, y no sé cuál prefieres:**
> - **(a) La cantidad también la fija el tipo** (un T8 pide 3 Singular, no 400
>   Afino). El inventario pesa mucho menos y el final de partida se acelera, lo que
>   va contra P1-P2 y contra "que el juego no se termine en un día".
> - **(b) El tipo solo multiplica y la cantidad sigue subiendo** (lo que hay), y solo
>   se **dice mejor** en la ficha qué cristal conviene.
>
> Yo haría una mezcla: **el tipo fija la cantidad a partir de cierto nivel** y por
> debajo sigue siendo el básico. Pero es justo lo que decide el ritmo del final de
> partida, así que es tuyo.

### F27 · El almacén necesita un tope y las ampliaciones deben escalarse por tipo

El almacén es infinito aparentemente. Ponerle un cupo, hacer que el agrandar almacén sea
un objeto y las mejoras requieran un tipo mayor de mejora de almacén a medida que más
cantidad tengo. Ej: Expansor T1, Expansor T2, etc.

> **Revisado, y tu memoria de "infinito" es casi correcta: el tope existe y es un
> número escrito a mano.**
>
> **Lo que hay:**
> - `state.warehouseCapacity` sube **+5 por ampliación** y **no tiene techo en el
>   motor**. El árbol de pasivas añade `+3` y `+8` aparte.
> - La tienda **sí** tiene un tope visible: `backpackExpander` se apaga con
>   "Al máximo" en `warehouseCapacity >= 50`. **Ese 50 está en la vista**, no en
>   ninguna tabla. O sea que el tope que tú no ves es un número en `store.ts` que
>   nadie puede cambiar sin abrir dos ficheros.
> - **El objeto ya existe**: `Ranura de Almacén` es un consumible que sale de las
>   cajas y da +1. Así que lo de "que sea un objeto" no hay que crearlo.
>
> **Y el segundo problema es más caro que el tope: el precio no escala.** Todas las
> ampliaciones cuestan **6.000**, las que quieras y las que falten. Una carta de T10
> cuesta **193.850**. O sea que ampliar 4 veces son 24.000 por un objeto permanente
> — comparable a una carta entera de tier alto—, y **eso hace que se compre por
> ser barato y no porque lo quieras**. Si además el tope de la vista es un 50 falso,
> el jugador nunca sabe cuánto le queda.
>
> **Lo que hay que hacer, en orden:** (1) el tope sale de una tabla y no de un `50` en
> la vista; (2) **Expansor T1 / T2 / T3** como pides, cada uno con más ranuras y más
> precio —que es lo que hace la forja y no el almacén—; (3) decidir **qué pasa con las
> partidas que ya pasaron del 50**, que es la razón por la que esto necesita una
> migración y no solo un cambio de precios.
>
> **Y una consecuencia de fondo que hay que tener en cuenta:** con un tope de verdad, el
> almacén pasa a ser **un recurso que obliga a vender**. Eso es bueno para el juego
> (F30 quiere que las cajas valgan algo), pero significa que **`sellPrice` deja de ser
> decorativo**: si un jugador no puede crecer porque el almacén está lleno y no le
> compensa vender, está atrapado. Vale la pena decidir cómo es la salida.

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
> **1 · Núcleos en el ranking, como pestaña.** Sale casi gratis: `state.cores` ya está
> en el guardado y `getPrestigeInfo()` lo devuelve. El ranking solo no lo publica, y
> eso es F22 diciendo que no se puede comparar. Y a diferencia de lo que dije de B8,
> **aquí no hay decisión de privacidad**: un número de núcleos es "cuántas veces has
> reiniciado", no tu saldo ni tu inventario.
>
> **2 · "Que no se vea en qué se ganan puntos, que sea un cálculo interno".** Esta es
> la petición que más bien viene. Ahora el ranking **enseña una fórmula**: hay
> `logro pesa 50.000, y uno secreto 250.000` repartidos, y un jugador que lo sepa
> optimiza **la puntuación** en vez de **la partida** —que es justo lo contrario de lo
> que quieres. Y F19 (logros que se regalan) vuelve esto peligroso de verdad: con los
> pesos a la vista, regalar un logro de 250.000 puntos deja de ser un detalle y pasa a
> ser lo más rentable que puede hacer un jugador — y por supuesto te lo haría a ti.
>
> Y **tu frase "va a afectar a la nueva fórmula" es la clave**: los núcleos ya van a
> estar dentro, pero no como un número más de la suma. Si el núcleo **sube la
> puntuación**, entonces reiniciar es una decisión rentable y el prestige deja de ser
> un reinicio para pasar el rato. **Eso es una decisión de economía y es tuya**, y por
> eso lo de la pestaña nueva tiene sentido: **los núcleos se enseñan aparte porque
> no puntúan igual.**

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
> - **(a) ¿Qué es el tier 0?** Hoy el T1 ya está en la tienda a 900. Si "tier 0" es el
>   T1, la tienda pasa de 20 cartas a 2. Si es algo más bajo que aún no existe, hay que
>   inventarlo.
> - **(b) ¿Cómo se sube de tier?** La forja ya existe y mezcla 3 items (F24). Si los
>   tiers altos salen de la forja, **la forja pasa de ser un minijuego a ser el camino**,
>   y eso toca su economía entera, su coste y su tasa de fallo.
> - **(c) ¿Qué dan las cajas?** Hoy dan **poder directo** (`companion_t6`,
>   `collector_oc6`). Si el poder solo llega por fusión, la caja tiene que dar
>   **material**, no compañeros ya montados. Eso es un rediseño del botín entero, no un
>   ajuste de pesos.
>
> Y hay un **cuello de botella que aparece al hacerlo** y que conviene tener en la
> cabeza: si todo el poder pasa por la forja, y la forja consume items, entonces el
> **almacén se llena de material de forja** —y F27 quiere ponerle un tope. Los dos
> cambios juntos se estorban: con el almacén acotado, hacer más poder exige vender más,
> y hay que decidir si el material de forja se puede vender sin perder el progreso.
>
> **Es la petición más grande del lote**: no cambia un número, cambia de dónde sale el
> poder. (b) y (c) son tuyas.

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
