# Pendientes y features — ARCHIVO

> **Este fichero es el historial largo, no la lista de trabajo.** La lista corta y viva es
> [`PENDIENTES.md`](./PENDIENTES.md), que tiene lo que falta, en qué orden y por qué. Aquí
> está el mismo contenido con la cuenta a la vista, los `file:line` y el razonamiento de
> cada decisión.
>
> **Se lee cuando haya que recuperar el porqué de algo**, no para saber qué toca. Se conserva
> entero porque es la memoria de lo que se quiso hacer, y un descarte escrito vale más que
> la lista de "hecho".
>
> **Aviso sobre una cosa que aquí está mal y ya no se quiere:** varios apartados tratan el
> despliegue en GitHub Pages como algo pendiente de activar, y `AGENTS.md` llegó a decir que
> el juego estaba publicado allí. **No es el caso y no se quiere**: Pages no está activado en
> el repo, `/pages` da 404, y la decisión es no publicar allí. Lo que queda es borrar
> `.github/workflows/publicar.yml`, no activar nada.

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

### F8 · En el ranking sale el título, pero no el marco ni el banner — HECHO

Ver el ranking solo se esta mostrando un tipo de ribbon.

> **Hecho. Eran las dos mitades a la vez, como decía el diagnóstico.**
>
> - Al **guardar** (`gameLoop.ts`): el documento `rankings/{uid}` ahora escribe
>   `frame` y `banner` en plano, más el objeto `cosmetics` con los tres juntos.
>   Los planos mandan y `cosmetics` queda como lectura de reserva, porque el tipo
>   `LeaderboardEntry.cosmetics` lo declaraba desde que se escribió y nadie lo
>   rellenaba (B2 se cierra solo con esto).
> - Al **pintar** (`rankings.ts`): la fila lleva el avatar de 32 px con su marco
>   al lado del nombre —la capa que ya existía montada en `profilePage.ts` como
>   `identityCard()`— y el banner como halo tenue detrás del avatar. En una fila
>   de 40 px no cabe un fondo de banner entero, así que el banner vive en el
>   avatar y no en la fila.
>
> **Decisión tomada (era la reservada al jugador):** avatar con marco + halo del
> banner. La rejilla pasa de 3 a 4 columnas (`2.25rem auto 1fr auto`) y el
> esqueleto de carga pinta el círculo fantasma para no descuadrar.
>
> Cubre `identidadCheck` (8 pruebas), nuevo: lo equipado por la API llega al
> documento y sobrevive a la recarga. El pintado queda fuera del banco a
> propósito y es `preview.html`.

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
>
> **CERRADO con F8.** El guardado escribe `frame`, `banner` y el objeto
> `cosmetics`; la fila los lee (planos primero, `cosmetics` como reserva) y el
> tipo ya no miente.

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

**Las cuatro decisiones ya están tomadas.** Con F34 cerrada, **ninguna de las trece
peticiones necesita una respuesta para empezar a programar**; lo que queda es trabajo y
tres números:

| # | Número abierto |
|---|---|
| **F36** | **Nada abierto.** Los tres están determinados con la cuenta a la vista: items y cristales hasta el **30**, cristales de **uno por tier sin bandas**, forja hasta **T10**. La curva de probabilidad (60/68/75%) es lo único que espera tu visto bueno. |

**Lo que queda por decidir es una sola cosa, y es tuya:** la curva de probabilidad por debajo del 20 (60% / 68% / 75%), que está propuesta en **F34** y razonada en **F36**. Todo lo demás tiene número.

**Y cuatro decisiones que ya están tomadas** (respondidas, medido lo que se puede medir):

| # | Decisión | Qué implica |
|---|---|---|
| **F23** | **Negarse a entrar**, no expulsar al otro | Nadie pierde la partida en curso. La otra sesión sigue viva hasta que se cierre sola. |
| **F26** | **El cristal tiene que ser del mismo tier del item, estrictamente.** La progresión se mantiene como está, así que el fallo sigue existiendo. | No cambia la economía, pero **obliga a que existan 10 niveles de cristal**: hoy solo hay 4 definidos y **solo 2 obtenibles**. Si el T8 pide cristal T8 y ese cristal no sale de ninguna caja, el T8 es un muro. |
| **F29** | **Los núcleos entran en el cálculo del definitivo Y tienen pestaña aparte** | Puntúan y además se ven. |
| **F31** | **El tier sube por forja o por caja, y la tienda solo vende cajas básicas** ("aún no empiezan los tiers ahí") | Dos vías. **Las llaves pueden venderse todas**: la puerta es la caja, no la llave. |

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

### B10 · En AFK por inactividad no sale el cartel, y el botón sigue animado — HECHO

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
>
> > **Hecho, las dos mitades.**
> >
> > 1. **El cartel** (`#afk-banner` en la base): "En pausa por inactividad — pulsa
> >    para seguir cobrando", con `role="status"`. Antes lo único que cambiaba
> >    era el "+0 /s" y no se sabía por qué no entraba nada.
> > 2. **La animación** (`#app[data-afk]` en `style.css`): congela el botón y sus
> >    hijos con `animation-play-state: paused` —congelada, no quitada, para que
> >    al volver siga desde el fotograma donde estaba—.
> >
> > **Las tres cosas van con la MISMA expresión** (`isAfk && !hasPassiveBuff`, la
> > que deja el contador en +0/s): cartel, botón y número no pueden
> > contradecirse. Por eso no hay banco: no hay regla nueva que atar, y un banco
> > comprueba si la clase está puesta —que lo estará sí o sí— y no si el píxel
> > se mueve. Se mira en `preview.html` a 390×844 con el reloj corriendo.

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

### B12 · El segundo prestigio dice "produce 0 más" y no dice cuánto falta — HECHO

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
> **Arreglado. Causa raíz: la vista restaba el umbral del PRIMER núcleo
> (`PRESTIGE_MIN_NANITES - producido`) en vez del umbral del siguiente, que
> descuenta el histórico (`nextCores`).** Es bug de valor, no de flujo: el motor
> cobraba bien y la pantalla enseñaba otro número. Con 1 M producido en la
> segunda vuelta (histórico 8) la resta da 0 con el botón apagado.
>
> **Y `coreProgress()` no solo estaba sin usar: estaba al revés.** Devolvía
> `totalCores / total`, que BAJA al producir (1 con 1 M, 0,67 con 2 M). Ahora
> mide esfuerzo (`producido / umbral del siguiente`) y sube siempre.
>
> **El número nuevo vive en el motor, no en la vista** (R2/R3):
> `nanitesForCores()` (inversa exacta de `pendingCores`, con ajuste por el
> `floor`), `nanitesToNextCore()` y `coreProgress()` en `data/prestige.ts`. La
> página pinta "Produce 217 K más para el **siguiente** núcleo" con barra al
> 82% en ese caso, y "primer" solo sin histórico. La primera vuelta no cambia:
> el umbral sigue siendo 1 M.
>
> Cubre `stateCheck` (+7: el faltante es >0, producirlo da exactamente 1 núcleo
> y uno menos da 0, la barra sube, y todo sobrevive a la recarga).

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

### B5 · Las tarjetas de la tienda contaban cómo está hecho el trompo — HECHO

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

### F12 · Ver qué compañero o recolector te ha tocado al comprarlo — HECHO

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
>
> > **Hecho, junto con F13.** Al comprar sale un cartel con nombre, poder, rareza
> > y lore: es un veredicto como el de la ruleta (nada que confirmar, solo
> > CONTINUAR), y por eso es un overlay propio y no `showConfirmModal`. La cifra
> > es la del item sorteado, no el rango de la tarjeta. El resto de cartas sigue
> > con su aviso de siempre.

### F13 · Que los compañeros y recolectores tengan lore — HECHO

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
>
> > **Hecho. 67 fichas** (`LORE` en `data/tiers.ts`): los 60 nombres de tier, los
> > 6 exclusivos de caja y el Artillero Táctico, que solo sale de la rara. Se
> > enseña en el modal de compra (F12) y en la ficha del almacén.
> >
> > **El tipo va AL LADO y no dentro** (`lineaTipoCompanion`): el lore es sabor y
> > la línea de tipo lleva la cifra que se cobra —el `multiplier` enseña su × y
> > no un +N que nadie cobra—. Un texto de sabor que cargue con la mecánica se
> > desactualiza con ella; separados, cada uno cambia por su lado.
> >
> > Cubre `loreCheck` (11 pruebas), nuevo: todo nombre tiene lore, ningún lore
> > sobra (las dos mitades de D4), el SOBRECARGADO hereda el de su base y la
> > línea de tipo dice lo que se cobra.

### F14 · Comprar por cantidad en el almacén — HECHO

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
>
> > **Hecho. La mitad del trabajo no existía:** como una pila es una ranura, las
> > unidades no piden sitio nuevo —si cabe una caben N— y la pregunta de espacio
> > es la misma de siempre (`cabeLaCompra`). Lo que faltaba era el precio del
> > lote y su tope, y los dos salen del motor:
> >
> > - `buyStoreItem(key, n)` cobra N veces el unitario (lo mismo que N compras
> >   de una) y entrega las N fundidas en la pila que haya. Sin saldo para el
> >   total no hay compra parcial: o las N o ninguna, sin cobrar. Solo lo
> >   apilable acepta N; lo demás siempre vale una, y un 0/negativo/NaN se
> >   rechaza sin cobrar.
> > - `getBulkCost` (el total que pinta el diálogo) y `getBulkMax` (el tope: lo
> >   que alcanza con el saldo) hacen la misma cuenta que el cobro. Y de paso la
> >   tarjeta dejó de calcularse el precio a mano: lo pide con `getStoreUnitCost`.
> >
> > En la vista, el diálogo de cantidad es el de la venta con `verbo: 'comprar'`.
> > Cubre `buyCheck` (+14). El diálogo en pantalla se mira en `preview.html`.

### F15 · En el perfil, cuántos Títulos, Marcos y Banners tienes — HECHO

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
>
> > **Hecho. El encabezado dice `Títulos 7/14 · Marcos 4/9 · Banners 2/11`** en
> > vez del total mezclado, contado desde `COSMETICS_BY_TYPE()`. Sin banco: es
> > pintado puro sobre datos que ya viajan, y lo que hay que mirar es que no
> > rompa a 390 px (`preview.html`).

### F16 · El desbloqueo se ve en el perfil, en el ranking y arriba a la izquierda — HECHO

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
>
> > **Hecho. La cabecera enseña avatar con marco + nombre + título** (`#nav-identity`).
> > El perfil ya lo tenía y el ranking lo tiene desde F8; faltaba la tercera.
> >
> > **Una sola fuente para no repetir F8:** `miniIdentity()` en `ui/identity.ts`
> > la usan la cabecera y las filas del ranking, y el estilo del título
> > (`titleStyleFor`) lo reutiliza la tarjeta del Perfil. Tres tamaños, una regla.
> >
> > **Se parchea en caliente al equipar**, sin reconstruir la cabecera —equipar
> > desde el Perfil no navega— y solo si algo cambió (marca por nombre + tres
> > cosméticos), para no reescribir DOM en cada tick. El "Sin título" por
> > defecto no sale en la cabecera; en el ranking sale lo equipado tal cual.
> >
> > Cubre `identidadCheck` (+6: el helper pinta iniciales, título, marco y halo,
> > esconde el defecto y aguanta ids desconocidos). La cabecera a 390 px se mira
> > en `preview.html`.

### F17 · Saltarse la animación de la ruleta — HECHO

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
>
> > **Hecho. Saltar es ir directo al cartel, sin montar la cinta.** El premio ya
> > está decidido y aplicado antes del trompo (F10), así que no hay transición
> > que "terminar": el final del trompo ES el cartel, con su sonido de
> > confirmación. Cada premio sigue teniendo su propio overlay y su CONTINUAR,
> > así que saltar uno no se come los de debajo (el riesgo del doble clic).
> >
> > **Dos decisiones que no estaban en la petición:**
> > - El check vive en **Perfil → Ajustes**, no en el panel de tema: ese panel es
> >   solo móvil y el check tiene que existir en las dos versiones. Es un `input`
> >   real con `label` y 44 px de zona táctil.
> > - La preferencia va en **`localStorage`, como el tema**, no en Firestore: es
> >   vista por dispositivo, no progreso. Y que sea por dispositivo es lo
> >   correcto con F28 (el trompo no va igual en todos). `roulettePrefs.ts` con
> >   coacción: cualquier valor raro es "no saltar".
> >
> > Cubre `rouletteCheck` (+4: defecto, persistencia, coacción y recarga). El
> > cartel sin cinta se mira en `ruleta-preview.html`, porque el banco no puede
> > ver una cinta quieta que no debería estar.

### F18 · Abrir varias cajas de golpe — HECHO

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
>
> > **Hecho, por la opción 1: abrir las que quepan y decir cuántas sobraron.** Sin
> > pila no hay selector (igual que la venta: con una sola unidad no hay nada que
> > decidir). Con pila, el diálogo pregunta cuántas con el tope honesto —cajas Y
> > llaves, lo menor— y el importe enseña `N × llave` en vez de nanitas (el `◆`
> > del modal mentiría: aquí no se cobra nada).
> >
> > **El lote son N llamadas enteras a `openCrateBox`**, no una operación con
> > multiplicador: cada una consume, sortea y aplica. Si una falla a mitad, se
> > para y se dice `Se abrieron N de M: motivo`. Cada premio conserva su overlay
> > y su CONTINUAR en orden —con F17 son N carteles seguidos sin espera— y por
> > eso no hay doble clic que se coma carteles.
> >
> > **De paso, el modal de cantidad aprendió verbo:** sus textos eran todos de
> > venta ("a vender", el `◆`). Ahora `quantity` lleva `verbo` y `sufijoImporte`
> > opcionales (`vender` + ` ◆` por defecto, así que la venta no cambia).
> >
> > Cubre `stateCheck` (+7: tres seguidas ok, contador +3, llave exacta,
> > producido que no baja, recarga, y la condición de parada sin cajas).
> > El encadenado de carteles se mira en `preview.html`, porque el banco no
> > monta overlays.

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


### F27 · El almacén necesita un tope y las ampliaciones deben escalarse por tipo — HECHO

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
>
> > **Hecho. Tres tipos en `EXPANSOR_TIERS` (`data/store.ts`), que es donde está
> > el número:** T1 +2 por 3.000 (vale hasta 120), T2 +5 por 18.000 (hasta 300)
> > y T3 +10 solo de cajas épicas y legendarias (hasta el tope, 600). Solo techo
> > por arriba y no bandas cerradas: un T3 en un almacén pequeño sirve, lo que
> > no puede es un T1 barato donde toca un T2.
> >
> > - **Un solo camino:** se compra el expansor y se usa desde el almacén. La
> >   carta `warehouseSlot` (+5 sin tope) desaparece, y con ella el segundo
> >   producto sin reglas. El +1 viejo sigue usándose con el tope nuevo (stock
> >   finito, no un cuarto tipo).
> > - **El tope frena, no recorta:** quien pasó de 600 con la carta vieja
> >   conserva cada ranura. La presión viene del precio y de las cajas.
> > - **De paso, dos muertos:** `expandWarehouse()` (+5 por 500) y
> >   `unlockCompanionSlot()` (tope 5, que contradecía el 6 de F11) no los
> >   llamaba ninguna vista —solo los bancos— y se borran. Y `companionSlot3`
> >   faltaba en `NO_OCUPA_RANURA`: la 3ª ranura pedía hueco con el almacén
> >   lleno. También la cola de `buyStoreItem`, que cobraba sin entregar para
> >   claves sin rama: ahora devuelve lo cobrado con `false`.
> >
> > Cubre `buyCheck` (+6), `stateCheck` (tipos, tope, legado),
> > `consumableCheck` (+2), `toastCheck` (+1, el logro por la vía nueva) y
> > `playthroughCheck` (un solo camino). La tanda queda en **24 bancos, 1542
> > pruebas**. Con esto F31 deja de estar bloqueado por el almacén.

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
> **LO QUE HAY QUE DECIDIR, Y ESTÁ DECIDIDO: la tienda solo vende cajas tier 0, las
> básicas, "aún no empiezan los tiers ahí".**
>
> **Y FUNCIONA POR UNA RAZÓN QUE NO ERA LA QUE YO TEMÍA.** Yo temía que hubiera que
> quitar también las llaves altas, y **no hace falta**: **la puerta es la caja, no la
> llave**. Si la tienda vende la llave T9 pero no la caja T9, esa llave **no sirve para
> nada** hasta que una caja T9 salga de una T8. El jugador puede tener las diez llaves y
> seguir necesitando la caja, que es justo lo que tiene que pasar.
>
> Traducido: **las llaves pueden venderse todas, y las cajas solo las básicas.** Es un
> matiz pequeño y evita un problema grande, porque las llaves caras son la compra que el
> jugador quiere hacer (no quiere la caja, quiere abrirla).
>
> **LO QUE SÍ HAY QUE QUITAR, Y ES LO MÁS GRANDE DE ESTA DECISIÓN:** las **veinte cartas
> de tier**. Hoy la tienda vende `companionCardT1..T10` y `collectorCardT1..T10`, de 900 a
> 193.850. Si los tiers altos dejan de estar a la venta, **la tienda pasa de 20 cartas a
> 2**, y esas dos son la T1 de compañero y la T1 de recolector. Es el mayor recorte
> de contenido del lote, y es correcto: mientras la carta T8 esté a la venta, las cajas
> no son necesarias.
>
> ---
>
> **Y UN NÚMERO QUE HAY QUE MIRAR ANTES, porque la forja puede no llegar al final.**
>
> La forja hace **3 de un tier → 1 del siguiente**, y con suerte **devuelve 1 de los 3**
> (consumes 2 netos). Con la T1 a 900, y subiendo por niveles:
>
> | De | A | Coste neto en T1 |
> |---|---|---|
> | T1 | T2 | 1.800 |
> | T2 | T3 | 3.600 |
> | T4 | T5 | 28.800 |
> | T7 | T8 | 460.800 |
> | T9 | T10 | **14.745.600** |
>
> Eso es **2ⁿ**, o sea exponencial. Una carta de T10 cuesta 193.850: forjar hasta T10
> cuesta unas **75 veces** más que comprarla. **Con la tienda limitada al tier 0, la forja
> no puede ser el camino hasta el final o el juego no tiene final.**
>
> **Y no creo que sea un problema —creo que es lo que quieres—, pero conviene decirlo:**
> la forja es **el camino de los tramos bajos** (T1 a T4 sale bien de precio) y a partir
> de ahí **toman el relevo las cajas**. Eso encaja con F31, donde elegiste que el tier se
> suba "por forja **o** por caja". Lo que hay que decidir es **dónde está el punto de
> cambio**, y si la forja tiene un techo explícito más bajo que T10 para que el jugador no
> la use para algo que no puede pagar.
>
> **Lo que la forja necesita además, y que ya no es opcional:** con la tienda cerrada al
> tier alto, **la forja es la única vía de progreso de los primeros tiers**, así que el
> botón de **quitar material** (F24) pasa de "queda bien" a "imprescindible": un jugador
> que mete mal un material y no puede sacarlo se queda **atascado sin ninguna salida**.
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

### F33 · La forja es el camino a los items perfectos: hereda cómo salieron los stats

Lo que tiene la forma de beneficio es que se puede forjar un item perfecto. Si los items
de tier 1 que mezclo están al máximo, su mezcla va a ser un tier 2 al máximo; y a su vez
va a tener un plus de forja. La idea es obtener tiers, buscar los perfectos y tratar de
forjarlos.

Una cosa es el nivel del objeto y otro "qué tan bien salieron los stats": cuando se
generan van de un rango mínimo al máximo. Eso es lo que se mezcla al forjar. Si los dos
están al máximo, el tier nuevo está al máximo, pero **el nivel es 0 y se pierde la subida
por cristales**. Y la forja debe pedir **dos** items del mismo tier, no tres.

> **CORRECCIÓN IMPORTANTE: yo lo había leído mal.** Hay **dos cosas distintas** y las
> había mezclado:
>
> | | Qué es | Cómo se obtiene |
> |---|---|---|
> | **El nivel** | 0 a 20 (o 35 con 5 estrellas) | **Cristales**, nivel a nivel |
> | **El stat** | Dónde cayó dentro del rango de su tier (`TIER_SYSTEM.ranges`) | **Al generarse**, al azar dentro del rango |
>
> **Lo que se hereda es el STAT, no el nivel**, y el nivel a 0 **es lo que se quiere**: la
> subida por cristales se pierde al forjar y hay que rehacerla. Eso no es un defecto, es la
> decisión, y hace que **F26 y F33 sean el mismo bucle**: la forja da el mejor stat y la
> sintonización da el nivel, y son cosas distintas.
>
> ---
>
> **LO QUE HAY HOY, Y SON DOS COSAS QUE PARECEN LA MISMA.**
>
> **1 · Los items de tienda y de caja sí tiran dentro del rango.** `poderDe(tier, rng)`
> genera la potencia con el `rng`, así que un T10 de la tienda cae entre 373 y 559, y dos
> T10 de la tienda son distintos entre sí.
>
> **2 · Los items forjados NO. Nunca.** En `attemptForge()`:
>
> ```ts
> const baseRange = TIER_SYSTEM.ranges[Math.min(newTier, 10)];
> const baseDamage = Math.round((baseRange[0] + baseRange[1]) / 2);   // el PUNTO MEDIO
> ```
>
> O sea que **un item forjado sale siempre en el medio de su rango**, no en un punto
> tirado. Nunca da el máximo, ni por casualidad ni con materiales perfectos.
>
> **CONSECUENCIA, Y ES EL NÚMERO:** un T10 forjado sale en **466** (el medio de 373-559),
> mientras que un T10 de la tienda puede caer en **559**. O sea que **hoy el mejor item
> forjado es PEOR que un item de tienda tirado con suerte**, que es justo lo contrario de
> lo que pides. Y lo único que hoy mueve al item forjado es
> `potentialMult = 1 + (potencial - 1) × 0,12`, que sale de la **rareza** de los
> materiales —no de dónde cayó su stat—, así que subir a potencial 5 con materiales raros
> es como se llega a un forjado bueno.
>
> **LO QUE HAY QUE AÑADIR, y es una tirada con entrada:**
>
> ```
> posicionDeLosMateriales = (danoDeA - minDeA) / (maxDeA - minDeA)     // 0..1
> posicionNueva = posicionMedia(materiales) + plusDeForja              // 0..1
> statNuevo = minNuevo + posicionNueva × (maxNuevo - minNuevo)
> ```
>
> Con los dos materiales al máximo la posición es ~1 y el forjado cae en el máximo del
> nuevo rango. Con uno al 30% y otro al 80% sale en el ~55%: **mezclar es promediar, y por
> eso vale la pena buscar los perfectos** en vez de conformarse con los primeros.
>
> **Y EL "PLUS DE FORJA" ES LO QUE HACE QUE PROMEDIAR NO SEA UNA TRAMPA:** si dos
> materiales perfectos dieran exactamente el máximo, el jugador **nunca rechazaría** un
> material bueno y buscar los perfectos dejaría de ser una decisión. El plus tiene que
> poder **compensar** un material flojo, para que la pregunta sea "¿me vale esto o busco
> otro?" y no "siempre sí".
>
> ---
>
> **Y EL OTRO CAMBIO, QUE ES EL QUE ARREGLA EL PRECIO: DOS MATERIALES EN VEZ DE TRES.**
>
> Pedir 2 en vez de 3 **no es un detalle de ergonomía: es la mitad del exponente.** Con la
> T1 a 900, llegar a un T10 por forja cuesta:
>
> | Materiales | T1 para un T10 | En nanitas | Contra la carta T10 (193.850) |
> |---|---|---|---|
> | **3** (hoy) | 3⁹ = 19.683 | 17.714.700 | **91×** — absurdo |
> | **2** (lo que pides) | 2⁹ = 512 | **460.800** | **2,4×** — justificable |
>
> **Con dos materiales, forjar sale 2,4 veces la carta y a cambio das el mejor stat
> posible del tier.** Eso es un precio justo por una ventaja que ni la tienda ni la caja
> dan con seguridad. **Con tres sigue siendo 91 veces y nadie lo usa.** Tu instinto era
> correcto, y la razón es aritmética.
>
> **Con esto el techo de forja deja de ser un problema:** si la forja es el camino a la
> calidad y no al nivel, no necesita subir de T10. Hay que decidir si llega a T10 o se
> queda antes.
>
> ---
>
> **Y F32 SIGUE SIENDO LA SINTONIZACIÓN, no la forja**, que ya era la conclusión anterior
> y ahora además es obligatoria: la forja no tiene "acierto", tiene "sale bien o sale mal",
> así que **perder niveles no puede ser ahí**.

### F35 · Los items se mezclan en la forja, los cristales van por tier, y el máximo sale de las dos vías

Los items de tier se pueden mezclar en la forja para hacer un tier superior. Los cristales
son de tier 1, 2, 3 … máx. Y obtengo los máximos de mezcla **y** de cajas.

> **Esto aclara dos cosas que estaban escritas mal, y una es importante.**
>
> **1 · LAS CAJAS YA DAN EL MÁXIMO, y eso hace que la forja no sea el único camino.**
> Es lo que dice `makeOverclockCollector()`: las sobrecargadas de caja son
> **`máximo del rango × 1,25`** — "claramente mejor que su versión de tienda", está
> escrito en el propio comentario. O sea que **una caja da un item mejor que el
> perfecto de la forja**, y no por casualidad: por diseño.
>
> **Y eso corrige una afirmación que hice en F33.** Yo escribí que "un T10 forjado sale en
> 466 y un T10 de tienda puede caer en 559, así que el mejor forjado es peor que uno de
> tienda". Es cierto **para la tienda**, y por eso la herencia de stat era necesaria. Pero
> **para las cajas es falso desde antes de este lote**: la sobrecargada de caja es
> `559 × 1,25 = 699`, o sea **un 25% mejor que el techo**. La conclusión correcta es:
>
> | Vía | Qué da | Cuánto cuesta |
> |---|---|---|
> | **Caja** | El **máximo** × 1,25, o sea el mejor item del tier | Una caja y su llave |
> | **Forja** | El máximo, y **decides tú** cuáles son tus dos mejores | 2ⁿ materiales |
>
> **Lo que hace la forja no es "conseguir un item mejor", es "conseguir el item que
> quieres".** La caja es la lotería buena y barata; la forja es la que elimina la
> lotería. Y esa es la razón por la que el jugador la va a usar aunque cueste 2ⁿ: no es
> que la caja no pueda darle un T8 perfecto, es que **la caja no puede darle el T8
> perfecto que tú ya tienes en la cabeza**.
>
> **Y esto encaja con F31**, donde elegiste que el tier suba "por forja **o** por caja".
> Ahora está claro que las dos vías llegan y que compiten en precio, no en resultado.
>
> **2 · LOS CRISTALES VAN POR TIER, CON MÁXIMO.** Es F26 aplicado, y el "máx" importa
> más de lo que parece: **los items pueden ser de tier infinito (F34) pero los cristales
> tienen tope**, y por lo tanto **un item de tier altísimo no se puede subir de nivel**.
>
> Eso es una decisión de diseño y funciona —el stat alto sustituye al nivel en el tramo
> final—, pero hay que **decirla**, porque un jugador que llegue a un T30 verá que no puede
> mejorarlo y no sabrá por qué. **La respuesta tiene que estar en la ficha**: "necesitas
> cristal T30" cuando el cristal T30 no existe. Y ese caso es exactamente el **muro de
> F26**: hay que comprobar que **toda caja existe hasta el tope de cristal**, o el tramo
> final es inalcanzable.
>
> **Y OJO CON LA INTERSECCIÓN, porque ahí está el bug que ya vimos:** si los items van a
> tier infinito y los cristales tienen máximo, entonces **un item por encima del máximo de
> cristal es un item que no se puede mejorar nunca**. Con los dos topes en 10 eso no pasa;
> con uno infinito y otro topado, pasa desde el primer tier por encima del tope de cristal.
> **Los dos topes tienen que ser coherentes entre sí** — resuelto en **F36**, con los tres
> números que quedaban, delegated.

### F36 · Los tres números que quedaban, determinados con la cuenta a la vista

Delegados ("sí"). Van aquí con la cuenta, para que se puedan cambiar sin volver a razonarlos.

> **1 · LOS TOPES: items hasta el 30 y cristales hasta el 30. Cohesentes.**
>
> La pregunta era hasta dónde llega cada uno, y la respuesta sale de un solo número: **el
> precio**. Con 2 materiales por forja, un item de tier T cuesta **2^(T-1) materiales de
> T1**, y la T1 cuesta 900:
>
> | Item | T1 necesarias | En nanitas |
> |---|---|---|
> | T10 | 512 | 460.800 |
> | T15 | 16.384 | 14.745.600 |
> | T20 | 524.288 | 471.859.200 |
> | **T25** | 16.777.216 | **15 billones** |
> | **T30** | 536.870.912 | **483 billones** |
>
> **Ahí está el final, y no lo pone un tope: lo pone la aritmética.** Un T25 cuesta 15
> billones y un T30 **483 billones**. El juego puede *decir* "tiers infinitos" porque la
> forja **no rechaza ningún tier** —y eso es lo que hay que implementar—, pero nadie llega
> al 25 por la forja. Se llega antes por cajas, y eso es lo correcto.
>
> **Y los cristales llegan al 30.** Dos razones, y la segunda es la que manda:
> - **Coherencia:** si el tope de cristal fuera 10 y los items llegaran a 30, habría veinte
>   tiers **imposibles de mejorar**. Con los dos en 30 **no hay ningún tier muerto** — que
>   es justo lo que sale mal en el patrón de D4.
> - **El trade-off es real:** un T30 sin nivel es **más débil que un T10 con nivel**, porque
>   el nivel multiplica ×3 y el stat ×1,62 por tier. O sea que **el nivel gana hasta el
>   tier 6-7 y después el stat toma el relevo**. Con los dos topes en 30, un jugador en el
>   final tiene que elegir: **bajar a los items que puede nivelar**, o **quedarse arriba con
>   el stat y sin niveles**. **Esa es una decisión buena**, no un descuido.
>
> **Y AQUÍ ESTÁ EL NÚMERO QUE HACE QUE 30 SEA 30, Y NO 25 NI 50:** el techo de la forja
> es 75% desde el tier 20 (F34). Si el tope de item fuera 25, **el tramo donde falla la
> forja sería el tramo final**, y el jugador acabaría la partida. **Con el item en 30 hay un
> tramo entero (25-30) donde la forja es segura pero carísima**, que es donde el juego
> quiere que estés.
>
> **2 · CRISTALES: UNO POR TIER, 30 niveles, sin bandas.**
>
> Sin bandas porque **la regla estricta de F26 ya no deja sitio para ellas**: la regla es
> "el cristal del mismo tier", y una banda obligaría a que un T7 pudiera usar cristal T8,
> que es justo lo que pediste evitar. **Un nivel por tier es la consecuencia directa de la
> regla estricta.**
>
> En los multiplicadores, una decisión que hay que tomar porque no es automática: **los 10
> nombres que ya existen conservan su nombre y su multiplicador** (Afino, Fase, Entropía,
> Singular…) y **el multiplicador se queda en cuatro escalones**; los 20 nuevos reutilizan
> el del grupo al que pertenecen. Motivo: `crystalSuccessChance` solo multiplica **la
> probabilidad**, y si el multiplicador creciera sin límite **el 75% de la forja se rompería
> en los tiers altos** — que es precisamente lo que se pidió. **El multiplicador mueve la
> segunda ruleta (la del stat) y no toca la primera (la del forjado).** Esa separación es
> lo que mantiene con sentido las piedras de forja en el tramo 20+.
>
> **3 · LA FORJA LLEGA A T10, Y NO MÁS.**
>
> Por una razón que sale de F33: **la forja da el máximo y el jugador elige sus dos
> materiales**. Un T11 forjado sería un T11 perfecto, y a partir de ahí **la caja —que da
> el máximo ×1,25— ganaría a la forja siempre**. Si la forja llegara más lejos que la caja,
> **dejaría de usarse**, que es lo contrario de lo que se pidió.
>
> El techo actual (`maxTier = 11`, que rechaza `tier >= 11`) **ya es T10**: solo hay que
> **quitar el `Math.min(tier, 10)`** de la rareza, para que un T10 forjado no salga con la
> rareza recortada a Divino de T9.

---

1. Los cristales tienen la misma lógica: **se compran los tier 0 y los otros se obtienen**.
2. La forja permite llegar a **tiers infinitos**.
3. **La probabilidad de forjar SUBE con el tier**, y por eso existen las piedras de forja
   que la aumentan. En tiers altos **no se debe poder llegar al 100%**: un máximo de 75%
   en un tier alto y casi final. Pero que **sea realmente costoso** y **siempre haya
   riesgo**.
4. Y en una mezcla, la calidad del resultante se determina por las características de los
   dos que se usan: si son dos T1 perfectos, el nuevo sale perfecto; si no, **se promedian**.

> **El punto 3 es el que cambia la tensión del juego entero, y va en contra de lo que
> entendí antes.** No es "la misma probabilidad y más cristales": **la probabilidad de
> forjar SUBE con el tier** —los tiers altos son **más fáciles de forjar**— y lo que los
> hace caros son los **cristales**. Las dos cosas se mueven en direcciones opuestas, y
> deliberadamente:
>
> | Sube el tier | ¿Qué pasa? |
> |---|---|
> | Probabilidad de forja | **Sube** (es más fácil sacar el item) |
> | Coste en materiales | **Duplica** (2ⁿ) |
> | Coste en cristales | **Sube**, y no se compran (salen de cajas altas) |
>
> **Y está medido, pero al revés de lo que se pedía.** Hoy `baseSuccessChance()` hace
> `Math.max(0.30, 0.78 - (tier - 1) × 0.05)`: **T1 es 78% y baja a 33% en el T10**. O sea
> que **ahora los tiers altos son MÁS DIFÍCILES de forjar**, y lo que se quiere es lo
> contrario. Es un cambio de signo en la curva, y es lo que da forma al tramo alto.
>
> **Y hay un tope que ya existe y hay que mover.** Hoy `successChance()` acaba en
> `Math.min(0.95, total)`, y el comentario de las piedras lo dice: "topado a 95%". Lo que
> se pide es **75% en un tier alto y casi final**. O sea que **el tope baja**, y eso no es
> un ajuste: es lo que garantiza que **siempre haya riesgo**. Un tope del 95% es un 5% de
> fracaso; uno del 75% es un 25%.
>
> **POR QUÉ ES LA DECISIÓN CORRECTA, y hay un número detrás.** Con 100% de éxito en el
> tramo final, **la partida se acaba y el jugador no tiene nada que hacer**. Con 75%, el
> T20 es un objetivo que se **persigue**: tres o cuatro intentos, uno sale, dos se pierden.
> Y como el material **no se devuelve** —hoy se consumen 3 y en éxito se devuelve 1—, un
> fallo a 75% en el tramo final cuesta **dos materiales de T19**. Eso es coste real con
> riesgo real, que son las dos cosas que se piden en la misma frase.
>
> **DECIDIDO: a partir del tier 20, 75% fijo. Solo sube el coste. delegated a mi.**
>
> > **CORTE 1 HECHO (forja infinita, sin curva).** Decidido "forja infinita": el
> > precio 2^n frena solo. Este corte quita el techo (`tier >= 11` fuera del
> > motor, `maxTier` por defecto a infinito) y pone las fórmulas para que un
> > T11+ salga con poder, rareza, nombre y valor de verdad: `rangoDePoder()`
> > (tabla 1-10 intacta, ×1,62 desde el T10), `rarezaDeTier()` (Divino arriba)
> > y `valorBaseTier()` (×2,05 desde el T11). La curva de probabilidad NO se
> > toca: 60/68/75 sigue sin visto bueno y el suelo del 30% evita el absurdo.
> > Cubre `stateCheck` (+8: T10→T11 y T11→T12 de verdad, continuidad de las
> > tres fórmulas). Queda: curva, 2 materiales + herencia (F33), tienda y
> > cajas (F31), cristales estrictos (F26).
>
> **Y es la decisión correcta por una razón que sale de los números del propio juego, no
> de una preferencia:** el techo de niveles de un recolector es `20 + potencial × 3`, o
> sea **20 sin estrellas y 35 con 5**. El **20 del tope de probabilidad es exactamente el
> nivel base de un item de la tienda**. O sea que la línea cae donde el juego ya tiene una
> frontera que el jugador conoce sin que se la digamos: **el tier 20 es donde un item
> "normal" deja de caber en un item "de la tienda" sin trabajo.** No es un número
> inventado, es la misma frontera de dos sistemas distintos.
>
> **Y QUEDA FIJO PARA SIEMPRE, sin curva que vuelva a bajar.** La razón es la que ya
> estaba escrita en el punto 3: con tiers infinitos, si el techo volviera a bajar en los
> muy altos, el tramo de 2ⁿ se volvería **imposible** —porque no hay final—, y el juego
> tendría un muro sin cartel. Con 75% fijo, la dificultad del tramo alto la pone **el
> precio**, que ya es 2ⁿ y ya es suficiente.
>
> **Y LAS PIEDRAS SIGUEN TENIENDO SENTIDO, que es una pregunta que la decisión deja
> abierta.** Si el tope es fijo, las piedras dejan de servir para "subir el techo" y
> quedan para dos cosas: **bajar la probabilidad de fallo** (misma cosa, al revés) o
> **proteger el resultado**. La segunda es la interesante, y va en la línea de F33: una
> piedra que **garantiza que el item sale perfecto** es una piedra contra la tirada del
> stat, que es el otro azar de la forja. **Si no, en el tramo 20+ con 2 materiales, el
> jugador tiene dos ruletas en la misma pantalla** —¿sale el item? y ¿sale bueno?— y eso
> es demasiado azar para un tramo final. Con la piedra contra el stat, la segunda ruleta
> tiene solución y la primera no, que es exactamente como se reparten las tensiones.
>
> **LO QUE QUEDA, Y ES LA PARTE QUE SÍ NECESITA TU OJO: la curva por debajo del 20.**
> Porque si el 75% es el techo desde el 20, hay que decidir qué pasa del 1 al 20, y aquí
> está el problema que quiero señalar en vez de resolver por mi cuenta:
>
> **Hoy la curva es 78% en T1 bajando a 33% en T10.** Si sube, ¿hasta dónde? Si el techo
> del 75% empieza en el T20, entonces los tiers 10 a 19 están en una zona que **hoy es la
> más dura del juego** (33% a 50%) y que con la curva al revés sería la más fácil. **Eso
> crea una HARD WALL en el tramo medio**: los tiers 1-9 fáciles, un salto, y del 10 al 19
> un bajón en la dificultad.
>
> **Mi propuesta, y es la que pondría en el código si me dijeras que sí:**
>
> | Tier | Probabilidad | Por qué |
> |---|---|---|
> | 1-9 | **60%** | Zona de aprendizaje. Con 2 materiales, un fallo cuesta poco y se vuelve a probar |
> | 10-19 | **68%** | La dificultad la pone el cristal, no la suerte: aquí siguen siendo obtenibles |
> | 20+ | **75%** | Techo. Y el 2ⁿ hace el resto |
>
> **Y el motivo de que la zona 1-9 sea del 60% y no más fácil** es lo que viene de F33:
> como el resultado se promedia, **un fallo no destruye el trabajo**, solo pierde los
> materiales. Si la probabilidad fuera muy alta, el forjado sería un botón y buscar los
> perfectos —que es de lo que va el juego en esta parte— no sería una decisión. **Con 60%,
> tres T1 imperfectos dan un T2 imperfecto con ~82% de seguridad** (0,6² es el fallo doble,
> que es lo que pasa cuando los dos materiales son flojos), y eso obliga a **ir a buscar
> buenos antes que a probar mucho**: la estrategia sale sola de los números.
>
> **Y EL PUNTO 4 ES LA MEJOR COSA DE ESTA RONDA.** El resultado se promedia con los dos
> materiales: dos T1 perfectos dan un T1 perfecto, y si no, el promedio. Eso significa que
> **mezclar no tiene sorpresa**: un jugador que junta dos imperfectos **sabe** que le va
> a salir imperfecto. No hay ruleta en la mezcla, hay **una aritmética visible**, y la
> decisión es "¿tengo dos buenos?". Para un juego de tomar decisiones eso vale más que
> cualquier número de probabilidad.
>
> ---
> ---
>
> **LO QUE "TIERS INFINITOS" COSTA, Y ES TRABAJO REAL, NO UNA FRASE.**
>
> Hoy el tier está escrito en **datos literales**, y todo lo que tiene que dar de sí un
> número que no existe todavía. Con 10 tiers, "no hay más" era una omisión. Con tiers
> infinitos, **cada uno de estos sitios necesita una regla, no un número**:
>
> | Qué | Hoy | Qué necesita "infinito" |
> |---|---|---|
> | **El rango de poder** | `TIER_SYSTEM.ranges` es una tabla literal de 1 a 10 (5-7 … 373-559) | **Una fórmula** para el tier 11 y siguientes |
> | **La rareza** | `rarityByTier` tiene 1-10 y `collectorRarity` hace `Math.min(tier, 10)` | **Dejar de recortar en 10**, o decidir que la rareza sí tiene tope |
> | **El nombre del item** | `collectorNames` y `companionNames` tienen 3 nombres para 1-10 | **Generar** nombres del 11 en adelante |
> | **El techo de la forja** | `maxTier = 11`, y `tier >= 11` se rechaza | **Quitar el rechazo** |
> | **Los saltos de caja** | `TIER_PROPIO` es 1/3/6/8 y el salto es `Math.min(10, ...)` | **Dejar de recortar en 10** |
> | **La carta de tienda** | `collectorCardT1..T10` | No hace falta: con la tienda en tier 0 solo se compra la T1 |
> | **El precio de las cartas** | Curva de 10 valores | **No aplica**: con la tienda en tier 0 solo se compra la T1 |
>
> **Y AQUÍ ESTÁ EL LÍMITE REAL, Y NO ES UN MURO: SON LOS NÚMEROS.**
>
> El poder sube ×1,62 por tier. Con esa razón:
>
> | Tier | Poder del rango | En pantalla |
> |---|---|---|
> | 10 | 373 - 559 | 559 |
> | 20 | ~25.000 - ~38.000 | 38,02 K |
> | 30 | ~1,7 M - ~2,6 M | 2,6 M |
> | 40 | ~120 M - ~180 M | 180 M |
> | 50 | ~8.000 M - ~12.000 M | 12 B |
>
> **`formatNumber` aguanta hasta 1e33** con sufijos cortos, así que **no se rompe**. Pero a
> partir del tier 20 cualquier cifra del juego —el poder, el ingreso, el precio— **está en
> millones**, y las comparaciones dejan de ser intuitivas. **"Infinito" en la práctica acaba
> siendo 25-30 tiers**, no porque haya un tope, sino porque un jugador no puede con un
> 2³⁰ de materiales de T1.
>
> **Y ESO ES BUENO, y conviene decirlo porque es la decisión escondida:** no hace falta un
> tope porque **el precio se encarga**. La forja cuesta 2ⁿ materiales, así que el juego se
> para solo mucho antes de que los números se vuelvan incomprensibles. Un tope explícito
> sería quitarnos esa ayuda.
>
> **El trabajo que sí hay que hacer, y es de una tarde:** una fórmula de poder por tier en
> vez de una tabla, la rareza sin recorte, y **nombres generados del 11 en adelante**. Los
> tres van juntos: si el poder es fórmula pero el nombre no existe, el item forjado del T15
> se llama `undefined` — y eso es el patrón de D4 otra vez.

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

### F37 · La forja sintetiza items, y el item sale con un bonus con nombre

Agreguemos que la forja pueda sintetizar items , lo cual me va a otorgar el bonus como por ejemplo "baluarte " del item

> **Clasificada como Feature, y no como bug, por una razón medida: la mitad de la
> segunda frase ya existe.** Lo nuevo es "sintetizar"; el "bonus con nombre" ya tiene
> nombre técnico y hay uno que se llama exactamente lo que dices.
>
> **1 · "Baluarte" ya es un bonus del item, y hay catorce como él.** En
> `AFFIXES` (`data/crafting.ts:42-71`) hay 14 **afijos**, y el tercero es
> `aff_bulwark`: *"Baluarte — +60 de daño plano"*, Épico. Los demás son Afilado,
> Cadencia, Rendimiento, Flujo, Núcleo, Crítico, Foco, Suerte de Forja, Efenéreo,
> Eterno, Absorción, Primo y Vacío Devorador.
>
> Y el sistema entero está montado y vivo: un recolector forjado **hereda** 1 a 3
> afijos según su potencial, 4 con la Nanopartícula (`crafting.ts:287-289`), el motor
> los suma al daño en `equippedAffixEffect()` (`gameLoop.ts:1613`) y la ficha del
> almacén los enseña por su nombre (`warehouse.ts:362`). O sea que "forjar y que el
> item salga con un bonus llamado Baluarte" **ya se puede ver hoy**.
>
> **Lo que NO existe es que tú lo elijas.** `pickAffixes()` (`crafting.ts:332`) los
> sortea del pool con pesos inversos a la rareza, y encima cada material aporta 0,02
> a la probabilidad de éxito pero ninguno influye en *qué* afijo sale. Así que hay dos
> lecturas distintas dentro de la misma frase: **"que el item salga con un afijo"**
> (ya está) y **"que yo elija el afijo, o que la síntesis dé uno concreto"**
> (no está, y es una decisión de diseño de verdad).
>
> **2 · "Que la forja pueda sintetizar items" tiene tres lecturas, y solo una es
> nueva.** Lo digo porque "fusionar", "forjar" y "sintetizar" son cosas distintas en
> este juego y el código las separa:
>
> | Lectura | Estado real |
> |---|---|
> | (a) Unir items para subir de tier | **Ya existe**: la fusión 3 → 1 de `attemptForge()`. Y F33 ya decidió que sean **dos** materiales, no tres |
> | (b) Forjar también **compañeros** | **No existe**, y es un hueco real: `forgePage.ts:55` filtra `w.type === 'collector'` y `attemptForge()` recibe `CollectorItem[]`. **La mitad de los items del juego —los compañeros, que son los que generan el ingreso— no se pueden forjar** |
> | (c) Fabricar un item desde material base (cristales, esquirlas, nanitas), sin item previo | **No existe**: la forja solo acepta recolectores enteros como material |
>
> **Yo leo que es (b) o (c)**, porque si fuera (a) estarías pidiendo algo que ya se
> puede hacer. Si es (b), es la más limpia de las tres y encaja con F31: si el tier se
> sube por forja y solo hay un camino, los compañeros se quedan fuera del sistema.
>
> **3 · Dónde se cruza con lo ya decidido, porque no se puede hacer antes.** F33 deja
> la forja con **2 materiales** y hace que herede el stat, y F36 explica el techo de
> **T10** con un motivo que esta idea toca de lleno: *"si la forja llegara más lejos que
> la caja, dejaría de usarse"*. Una síntesis que da **un bonus propio** compite
> exactamente con eso: F33 vende la forja como *"el item que tú quieres"* —materiales
> elegidos a mano— y una síntesis con afijo sorteado es *"el item que te salió"*, que
> es la promesa de la caja. **Las dos cosas no pueden ser el mismo botón.** Por eso
> F37 va después de F33 y F36, y encima conviene decidir si la síntesis es **una vía
> más** (una pestaña al lado de la fusión) o **una alternativa** (el mismo yunque, con
> otro botón), porque cambia el número de afijos que puede llevar un item y eso lo
> decide `pickAffixes`.
>
> **Y un aviso de D4, que sale del punto 1:** los afijos son 14 en `crafting.ts` y el
> que los reparte es `pickAffixes`, dentro del mismo fichero, así que ese par sí está
> sano. Lo que hay que vigilar al añadir una síntesis es que **los afijos que le
> pueda dar a un item existan todos en la tabla** —y que si son afijos nuevos, la regla
> del banco de D4 aplique: preguntar de dónde sale cada uno.

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

### El despliegue a GitHub Pages falla, y no es el código

Los tres pushes desde `3021eab` han construido bien y **han fallado al
publicar**, siempre en el mismo paso:

```
[5] Construir (solo la página del juego)          -> success
[6] Comprobar que admin.html NO se ha publicado    -> success
[7] actions/configure-pages                       -> FAILURE   <-- aqui
[8] actions/upload-pages-artifact                 -> skipped
```

Los pasos que dependen del código están los dos en verde, y el que falla es el
primero que habla con GitHub. La causa es que **Pages no está activado en el
repo**: la API contesta `has_pages: false` y `/pages` da 404. Y la URL del
juego, `https://ezequielchaves1392.github.io/wizzcat-recolector/`, devuelve
**"Site not found"**.

**Y esto es lo que hay que hacer, y es lo único que falta.** No lo puede hacer
un commit: es un ajuste del repo.

1. **Settings → Pages → Source → *GitHub Actions***. Con eso `configure-pages`
   deja de fallar y los tres pushes siguientes publican solos.
2. **Y el dominio en Firebase Auth → Authorized domains**, porque si no el login
   va a fallar. El juego se sirve desde un subcamino
   (`.../wizzcat-recolector/`), y Firebase compara el dominio entero.

> **Por qué está aquí y no en un commit.** El workflow es correcto y la red que
> tiene encima funciona: `tsc` es puerta de entrada, y hay un paso que **falla
> el despliegue si `dist/admin.html` existe**. Los dos pasaron. Lo único que
> falla es la activación manual, que el commit `3021eab` ya decía en su cuerpo:
> *"Lo que falta y es de la cuenta del usuario"*. Lo que faltaba era mirarlo.

---

## v1.1.0 - 1 de octubre de 2026

**Esta versión cambia el juego en cinco sitios y arregla cinco bugs que no se veían.**
Lo que hay abajo no es una lista de deseos: es lo que **está implementado y verificado**
en el tag `v1.1.0`.

> **Ojo con una cosa que este apartado daba por hecha y no era verdad:** el tag está
> en GitHub, pero **el juego todavía no está publicado**. Los tres pushes han
> fallado en `configure-pages` porque Pages no está activado en el repo. Está
> escrito con el paso a paso en **Tareas añadidas durante el trabajo**.

### Arreglado

- **La caja legendaria ya se puede abrir.** No tenías llave. Ahora existe (18cf36d).
- **El AFK se pone solo** mirando la pantalla, y el ratón deja de despertarlo (ec3fb01).
- **El cartel de logro aparece**, y su pista mide el almacén que ves (a04ab9f).
- **Ya no hay buffs pasivos**, solo tarjetas (2e42e7d).
- **Escuadra de 6 ranuras**, sin el +3 de golpe (77d8f6e).
- **Las cajas tienen un peldaño de sorpresa**, y el Espectro Azulado ya sale (42aa3a5).
- **La valoración y el desglose del daño** están a la vista (7843a52).
- **El segundo prestigio dice cuánto falta** para el siguiente núcleo (b3ea2de).
- **Los compañeros `passive` anuncian su ingreso**, que antes no producían ninguna
  señal (7b6def9).

### Decidido y especificado, sin implementar todavía

Once peticiones que **cambian la economía**, especificadas con la cuenta a la vista en
**F23-F36**: caja por tier, cristal del mismo tier del item, la tienda solo con cajas
básicas, la forja de dos materiales que hereda el stat, techo del 75% desde el tier 20,
y items y cristales hasta el tier 30.

**Por qué no están en el código:** son un cambio de una vez. Hacerlos por partes dejaría
el juego en un estado que no es ni el viejo ni el nuevo, y **los bancos pasarían en verde
mientras el juego no tiene final**. Cuando quieras, se hacen seguidos y en orden.

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
4. ~~**F1-F8**, que ya tocan menos sitio.~~ **HECHO.** F1-F3 (valoración y
    desglose), F4 (tarjetas), F5 (llaves de tienda), F6 (salto), F7 (ranuras) y
    F8 (marco y banner en el ranking) están todos implementados y con banco.

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
Todo lo de abajo está **en el historial y verificado**, no en un árbol sin
commitear. La tabla de bancos y commits se comprobó contra `git log` uno por uno.

### La economía y el ritmo (`v1.1.0`)

- [x] **P1-P3 · balance** (`dd12b6e`). El precio por punto de poder **bajaba** con
      el tier, así que el T10 salía 3,7x más rentable que el T1 y la partida se
      resolvía sola en 20 minutos. Ahora el coste por punto **sube** 12% por tier
      (150 → 416), recolector y compañero cuestan lo mismo porque sacan el poder
      de la misma tabla, y sintonizar dejó de ser un botón. `balanceCheck` (29),
      que ata que un tier superior nunca sea mejor por punto que el anterior.
- [x] **Paso 3 · las tablas fuera de `gameLoop.ts`** (`839595b`). A `data/store.ts`,
      `data/buffs.ts`, `data/generators.ts` y `crafting.ts`. Ningún `data/` importa
      ya del motor, que era R29 sin cumplir.
- [x] **F1-F3 · la valoración y el desglose del daño a la vista** (`7843a52`). La
      valoración del almacén va abierta (sigue pudiéndose cerrar) y ahora también
      está en el panel principal. El daño se desglosa en `100 base · +50 nivel ·
      +37 bonos` y las tres partes suman el total exacto, porque las calcula el
      motor y no la vista. Banco nuevo: `desgloseCheck` (31).

### El contenido que no se podía conseguir

- [x] **B6-B7-F5 · las llaves** (`18cf36d`). La cadena cierra: cada caja suelta la
      llave que la abre, y los cuatro textos **se generan** con la regla que decide
      si abre, así que no pueden volver a mentir. La escalera tenía **tres**
      peldaños rotos, no dos: la Llave del Vacío no salía de ninguna parte, la
      Rúnica solo salía de la legendaria, y la épica no soltaba llave ninguna. La
      caja legendaria ya se puede abrir. Banco nuevo: `llaveCheck` (92).
- [x] **F6 · el peldaño de sorpresa de las cajas, y D1** (`42aa3a5`). El salto es
      una entrada más de la tabla de botín —no un `if` al abrir, porque un premio
      que no está en la tabla la ruleta no lo puede pintar— y sube **un** peldaño
      solo. Sale entre el 3% y el 6% real según la caja, medido con tiradas de
      verdad y no mirando el peso. El Espectro Azulado ya sale de la legendaria.
      Banco nuevo: `saltoCheck` (42).

### Los medianeros: R10 y el cableado

- [x] **B9 · el AFK se pone solo estando en la pantalla** (`ec3fb01`). La pregunta
      va en el **tick**, no en el manejador de presencia, porque abrir una segunda
      puerta al cobro es la forma más fácil de que las dos se desincronicen. Y el
      `mousemove` ha dejado de contar como actividad: estaba registrado, así que
      **cualquier movimiento del ratón sacaba del AFK** y el corte era casi
      inútil. El listener se quitó entero y el umbral sube a 60 s.
      `tickCheck` pasó de 14 a 20.
- [x] **B3-B4 · el cartel de logro y su pista** (`a04ab9f`). Dos causas, y por eso
      no había **ni un solo cartel en toda la partida**: la compra que amplía el
      almacén era la única de las diez rutas que no evaluaba logros, y el cartel se
      descartaba en silencio porque `#achievement-stack` todavía no estaba en el
      documento. Ahora hay **cola**: si no hay dónde pintarlo, espera, y se vacía en
      cuanto hay layout. Y la pista mide `warehouseCapacity + bonus.storageSlots`,
      la misma regla que `getCapacity()`, así que el logro llega por la vía que el
      jugador ve funcionar. `toastCheck` pasó de 25 a 31.

### Los que no parecían bugs

- [x] **B1 · los compañeros `passive` no anunciaban su ingreso** (`7b6def9`). La
      sospecha inicial —que fuera el primer slot— era falsa: la vista filtraba por
      `type === 'click'`, y de los cinco compañeros de caja tres son `passive`.
      Entre ellos el **Avatar del Vacío, power 65, el mayor ingreso individual del
      juego**: comprarlo y equiparlo no producía ninguna señal. La regla
      ("anuncia quien paga directo") vive ahora en el motor. `senalCheck` 30 → 36.
- [x] **B12 · el segundo prestigio ya dice cuánto falta** (`b3ea2de`). Bug de
      **valor**, no de flujo: la vista restaba el umbral del *primer* núcleo en vez
      del siguiente, así que con 1 M producido en la segunda vuelta la resta daba
      0 y el botón se apagaba con el motor cobrando bien. Y `coreProgress()` no
      solo estaba sin usar: estaba **al revés** (1 con 1 M, 0,67 con 2 M). El
      faltante y el progreso salen de `data/prestige.ts`, así que lo enseñado es lo
      cobrado. `stateCheck` 212 → 219.
- [x] **F4 · fuera los buffs pasivos, solo tarjetas** (`2e42e7d`). No era que fueran
      buffs: es que `isEffectivelyAfk` anula el corte del AFK si hay un buff pasivo
      activo, así que **un buff pasivo era un pago por no mirar la pantalla** —800
      nanitas por media hora de ingreso sin estar delante. Eso rompe R10, que es una
      regla. El efecto **sigue en el motor** para las partidas viejas; se retira la
      compra, no el buff. `tarjetaCheck` (17), que además ata que nada comprable
      dure más de 15 minutos.
- [x] **F7-F11 · escuadrón de 6 con las ranuras en una tabla** (`77d8f6e`). Tres
      cartas, tope 6, **ningún salto de +3** (antes el segundo compraba 2 → 5 de
      golpe y el precio por ranura se multiplicaba por 5,3), y el número de ranuras
      vive en `COMPANION_SLOT_BUY`, que leen el motor, el botón y la tarjeta.
      `ranuraCheck` (34).
- [x] **B10 · cartel AFK y botón parado.** `#afk-banner` + `#app[data-afk]` que
      congela la respiración del botón. Misma expresión que el +0/s: cartel,
      botón y número juntos. Solo vista, sin banco (se mira en `preview.html`).
- [x] **F16 · identidad arriba a la izquierda.** `#nav-identity` con avatar,
      nombre y título, parcheada en caliente al equipar. `miniIdentity()`
      compartida con el ranking. `identidadCheck` 8 → 14.
      La tanda queda en **24 bancos, 1448 pruebas**.
- [x] **F15 · desglose de cosméticos en el perfil.** El encabezado dice cuántos
      de cada tipo en vez del total mezclado. Solo vista, sin banco.
- [x] **F14 · comprar por cantidad.** `buyStoreItem(key, n)` cobra N unitarios y
      funde las N en la pila; `getBulkCost`/`getBulkMax`/`getStoreUnitCost` ponen
      el número único para diálogo, tope y tarjeta. `buyCheck` 140 → 154.
      La tanda queda en **24 bancos, 1442 pruebas**.
- [x] **Forja infinita, corte 1: fórmulas 11+ y sin techo.** `rangoDePoder()`,
      `rarezaDeTier()`, `valorBaseTier()`; T10→T11 y T11→T12 comprobados.
      `stateCheck` 225 → 232. Sin curva (pendiente de visto bueno).
      La tanda queda en **24 bancos, 1549 pruebas**.
- [x] **F27 · tope de almacén y expansores por tipo.** T1/T2 en tienda, T3 solo
      de cajas, tope 600 que frena sin recortar. Fuera `warehouseSlot`,
      `expandWarehouse` y `unlockCompanionSlot`. Bancos al día.
      La tanda queda en **24 bancos, 1542 pruebas**.
- [x] **F12-F13 · lo que te tocó y su lore.** Comprar tier abre un cartel con
      nombre, poder, rareza y lore (ya no un toast que manda al almacén). 67
      fichas en `data/tiers.ts`, visibles también en la ficha del almacén, con
      la línea de tipo al lado. `loreCheck` (11), nuevo.
      La tanda queda en **24 bancos, 1428 pruebas**.
- [x] **F18 · abrir varias cajas de golpe.** Selector de cantidad con tope
      cajas+llaves, N `openCrateBox` enteras con carteles en orden, parada con
      aviso si una falla. El modal aprendió `verbo`/`sufijoImporte` para no
      prometer `◆` al abrir. `stateCheck` 219 → 226.
      La tanda queda en **23 bancos, 1417 pruebas**.
- [x] **F17 · saltar la ruleta con un check.** Las dos ruletas van directo al
      cartel sin montar la cinta, con su sonido. Check en Perfil → Ajustes,
      preferencia en `localStorage` como el tema. `rouletteCheck` 59 → 63.
      La tanda queda en **23 bancos, 1410 pruebas**.
- [x] **F8-B2 · el ranking enseña marco y banner, no solo el título.** El
      documento `rankings/{uid}` escribía solo `title` y el tipo
      `LeaderboardEntry.cosmetics` prometía tres cosas sin rellenar ninguna.
      Ahora viajan `frame`, `banner` y el objeto `cosmetics`, y la fila pinta el
      avatar de 32 px con marco + halo del banner. `identidadCheck` (8), nuevo.
      La tanda queda en **23 bancos, 1406 pruebas**.
- [x] **B5 · el trompo ya no explica cómo está hecho por dentro** (`839595b`). Los
      dos textos que lo hacían —la tarjeta de la llave en la tienda y el modal de
      confirmar abrir caja— contaban una frase interna, y el jugador dedujo de un
      texto que la ruleta era un adorno. Ahora cuentan lo que vive el jugador. La
      mecánica **no se ha tocado** (F10 explica por qué). Comprobado en
      `ruleta-preview.html`: la casilla, la aguja y el cartel dicen lo mismo.

### Antes de esto

- [x] **El contador deja de enseñar números que nadie cobra** (`558a394`). El
      ingreso se repartía ya entero entre los que aportan, con el sobrante del
      redondeo a partes iguales, para que la suma de las fichas sea exactamente
      `state.passiveIncome`. Y los clics del árbol, que no tenían cartel, ahora lo
      tienen. `senalCheck` nace aquí.
- [x] **La ruleta del sintonizador, y la de las cajas partida en tres ficheros**
      (`ce3a346`). `rouletteSpin.ts` no importa nada, y esa es la razón de que
      exista: son números puros, que es lo que los hace comprobables en Node.
      `rouletteCheck` (59) no podría existir si la aritmética hubiera quedado
      dentro del fichero que levanta el audio y el DOM.

---

## Descartado

_Lo que se decidió no hacer, y por qué. Esto vale más que la lista de "hecho":
una idea que se descartó con un motivo escrito no vuelve a proponerla nadie._

**Y lo que no es un descarte pero se dejó aquí para que no se pierda:** D1 está
**resuelto** (era un compañero que nadie sacaba) y D4 es **el patrón** que
emerge de tres bugs, no una petición. Los dos son decisiones con su porqué, que
es lo que los hace valiosos aquí.

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

### Descubierto haciendo B10 (medido en el código, no es bug de flujo)

- Con tarjeta AFK activa y AFK por inactividad a la vez, el contador dice +0/s
  **mientras el ingreso sigue entrando**: `updateUI` apaga el número con
  `isAfk && !hasPassiveBuff`, pero el tick solo corta con `isEffectivelyAfk`,
  que además descuenta `hasAfkBuff`. Es la misma divergencia de "el número que
  se enseña no es el que se cobra" con otro disfraz, y el cartel nuevo la
  hereda (usa la misma expresión a propósito). Cuando se toque ese panel, la
  expresión buena es la del tick, no la del contador.

### Descubierto haciendo B12 (no es bug, es para no perderlo)

- El `pending` que el diagnóstico de B12 dice que "nunca se pinta" **sí se pinta**:
  va en el `statStrip` ("Al reiniciar +N") y en el botón de reciclar. Lo que de
  verdad faltaba era el **faltante**, no el pendiente.
- El MOCK de `preview.html` (`totalCores: 61`, 412 M producidos) siempre cae en la
  rama "ya puedes reciclar": la rama del faltante no se puede mirar en el preview
  sin tocar el MOCK. Si se vuelve a tocar ese panel, mirar la rama con un estado
  de segunda vuelta (histórico 8, 1 M producido).
