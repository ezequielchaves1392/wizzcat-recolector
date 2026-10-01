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

### F4 · Solo tarjetas de buff, fuera los buffs pasivos

Sacar los buffs pasivos y dejar las tarjetas únicamente.

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

### F6 · Probabilidad baja de botín de tier superior en las cajas

En las cajas debe haber una probabilidad baja de obtener cosas del tier superior.

### F7 · Tope de 6 compañeros y precio de ranura balanceado — ACTUALIZADO

El máximo de compañeros quiero que sea ~~3~~ **6**. La segunda compra de slot no debe
dar +3. Balancear el precio.

> **Actualizado el 20 de octubre: el tope pasa de 3 a 6**, y con él se cuela la
> revisión de las mejoras de ranura, que es la misma pregunta. Todo el detalle
> medido está en **F11**, que es la versión desarrollada de esta entrada. Aquí queda
> el resumen para no tener dos fuentes: base 1 ranura, compra 1 → 2 (1.200), compra 2
> → 5 (16.000), y el árbol de pasivas añade más aparte. Con tope 6 falta una tercera
> compra, o el segundo slot sube a 6.

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

### F11 · Escuadrón de 6 y revisar las mejoras de ranura

Aumentar el máximo del escuadrón a 6 y verificar las mejoras de aumento de slots.

> **Ojo: esto actualiza F7**, que pedía el tope en 3. F7 queda con el tope en 6 y
> apuntando aquí, porque es la misma pregunta: cuántas ranuras y a qué precio.
>
> **Lo que hay hoy, medido:** base 1 ranura, `companionSlot1` (1.200) → 2, y
> `companionSlot2` (16.000) → **5 de golpe** (`gameLoop.ts:2694-2703`). El árbol de
> pasivas añade `companionSlots` aparte, así que el total puede pasar de 5 sin tocar
> la tienda. Con el tope en 6 falta una tercera compra, o el segundo slot sube a 6.
>
> **Los tres números que hay que revisar, y son los que F7 ya señalaba:**
> - El salto de 2 a 5 son **+3 ranuras por 16.000**, y el precio por ranura se
>   multiplica por 5,3 entre la primera y la segunda compra. Si sube a 6, ese salto
>   son +4.
> - `COMPANION_SLOT_COSTS` tiene **10 huecos** (`data/store.ts:166`) y solo se usan
>   dos: es una tabla que se llenó para un modelo que no llegó a existir.
> - La tarjeta de `companionSlot2` dice "Abre hasta **3** ranuras" (`store.ts:141`) y
>   el motor da 5. Otro texto que no es el número que se cobra (R3).

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

### F22 · Sin poder comparar, media lista es trabajo a medias

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

### D1 · Un compañero existe pero no se puede conseguir

El **Espectro Azulado** (Épico, `passive`, power 18) está en `CRATE_ONLY_COMPANIONS`
como índice 5, y **la tabla de botín no lo usa**: solo se referencian los índices
0 a 4. Está definido y es inalcanzable.

> Apuntado mientras se buscaba B1, no es un bug de juego sino de contenido. Las
> dos salidas posibles: meterlo en la tabla de botín, o borrarlo del array para
> que no invente una recompensa que no existe.