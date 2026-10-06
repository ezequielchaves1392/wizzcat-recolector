# Pendientes

> **Para el jugador:** esta es tu lista. Escribe en el apartado que toque, con tus
> palabras. No hace falta que sea técnico ni marcar casillas.
>
> **Cómo se elige por dónde empezar:** hay un **Plan de trabajo** más abajo con el orden y
> el porqué. Ese orden va por **dependencias**, no por urgencia: está para no hacer una
> feature que deja el juego en un estado raro. **Pero quien elige eres tú**: si dices
> "sigamos con pendientes", lo que sale es **la lista**, y se ejecuta la que elijas. El plan
> avisa de si algo depende de otra cosa, no quita la decisión. Si algo cambia de sitio, se
> actualiza.
>
> **Una idea está pendiente mientras siga en estos apartados.** Cuando se termine se
> mueve a **Hecho**, y si se decide que no, a **Descartado** con el motivo en una línea.
>
> **Este fichero es la lista entera, corta a propósito.** Cuando hace falta recuperar el
> porqué a fondo de una decisión —la cuenta, los `file:line`, el diagnóstico completo— está
> en el historial de git, en el commit que lo rationaleó. No se borra al decidir algo: se
> mueve a **Hecho** y se deja escrito el motivo, que es lo que impide que la idea vuelva a
> aparecer.


---
## GDD · Lo que pediste, ordenado
_Tiene fecha la versión de este encargo. Está **ordenado por mi criterio**, no por el orden
en que venía el texto: primero lo que **miente o se pierde**, despu&eacute;s lo que **rompe un
invariant** sin el cual lo demas queda raro, despues las features y al final la estetica._

**El criterio, en cuatro reglas:**

1. **Un bug antes que una feature.** Un número que se ve mal o un progreso que no se guarda
   es peor que una feature que falta, porque el jugador no puede ni jugar mal.
2. **Un invariant antes que dos features.** Si una regla base no está, cualquier feature que
   dependa de ella se hace sobre arena. Y **escribí la regla una vez**, en un banco, o el
   próximo que la toque la vuelve a escribir.
3. **Lo que prestigea, despues de lo que prestigea.** El Vault y el Prestigio tocan el estado
   entero, así que van **antes** de las features que dependen de lo que ellos conservan.
4. **La estética al final**, salvo que sea una cosa rota de verdad.

---

### Lote 1 · BUGS QUE MIENTEN O SE PIERDEN

- [x] **G1 · "Sin guardar en el servidor" aparecía sin motivo.** El aviso se encendía con
      **cualquier** fallo de guardado, y `saveToFirebase()` hace **dos** escrituras: el
      documento de la partida y el del ranking. Si la segunda fallaba, la partida **sí**
      estaba guardada y el jugador leía "sin guardar" igual. Y un `undefined` en cualquier
      item del almacén hacía que Firestore **rechazase el documento entero**.
      **Causa raíz: dos escrituras en un solo `try`.** Ahora cada una tiene su sitio, el
      indicador grande solo se enciende si falla `users/{uid}`, el ranking tiene su propio
      aviso, y `src/firebase.ts` usa `initializeFirestore` con `ignoreUndefinedProperties`
      (en el SDK modular no es opción por escritura, es de la instancia: ponerlo en cada
      `setDoc` ni siquiera compila).
- [x] **G2 · El Ascenso te sacaba del ranking y te mataba el segundo Ascenso.** El
      documento de `rankings/{uid}` guardaba `score: state.nanites`, o sea **el saldo**, que
      la Ascensión reinicia: ascendías y caías al último puesto, siendo el jugador que más
      había jugado el que más perdía. Y lo grave, encontrado de paso: **la Ascensión
      reiniciaba `totalNanitesProduced`**, y los núcleos del siguiente ascenso son
      `max(0, pendingCores(totalNanitesProduced) − totalCores)`; con el contador a cero,
      `pendingCores(0)` es cero y **el segundo Ascenso no existía**, con el botón en
      "Necesitas producir más para reciclar" y ninguna explicación.
      **Causa raíz: confundir "progreso de esta subida" con "la marca de haber jugado".**
      Los históricos (`totalNanitesProduced`, `totalClicks`, `cratesOpened`) ya no se
      reinician, y **el ranking lleva lo producido**. De paso: `maxCompanionSlots` se
      reiniciaba a 1 y eran **ranuras compradas con recurso** —cobrar y perderlas al
      ascender—; las del árbol nunca se perdían porque viven en `nodeLevels`.
- [x] **G3 · El stack de cajas.** Pides el tope a 99, y el síntoma que describías
      (`120/20`) era de **pintado**, no de almacenamiento. **Causa raíz: hay DOS topes y
      uno se quedó atrás.** `TOPE_PILA` (cómo se guarda) estaba a 20 y `MAX_STACK` (qué
      número se pinta en la esquina) también, pero el motor partía por un lado y la rejilla
      pintaba por otro: una celda con 99 cajas enseñaba "20+". El motor y la compra en lote
      **ya respetaban el tope** —`planDeEntrada()` lo calcula y lo reparte bien—, así que
      `120/20` no era un bug de compra sino dos números distintos en pantalla y nadie
      sabiendo cuál era el bueno.
      **Los dos topes suben a 99 y ahora hay una prueba que los ata**, porque una igualdad
      entre dos tablas que viven en el mismo fichero y no se obligan entre sí no la
      comprueba nadie. De paso: el tope de **apertura** se queda en 20 y ya **no es el mismo
      número** a propósito —es cuántas aperturas de golpe se le ofrecen a alguien, no cuántas
      caben en una celda—, pero mantiene la garantía de caber en una sola pila. Y la regla
      que lo decide estaba **suelta dentro de un manejador de clic**, donde ningún banco
      puede llegar: ahora es `maximoDeApertura()`, en `crateSummary.ts`, y sí se prueba.

### Lote 2 · INVARIANTES DE LOS OBJETOS

- [x] **G4 · Todo item tiene potencial, y su daño es el de sus estrellas.** Era el punto
      que pediste y era **medio bug y medio feature**.
  - **Los items escritos a mano no salen de ningún generador**, y por eso a nadie se le
       lzaba mirar. El Blaser Láser de partida venía con `damage: 5` y sin campo, y su
      texto decía "+5"; con ★3 su daño debería ser 8. **La partida nueva y el reinicio
      del Ascenso tenían cada uno su propia copia escrita a mano**, con reglas distintas:
      ascender cambiaba el número del Blaser sin avisar. Ahora los dos salen de las mismas
      dos fábricas, y son **funciones** y no constantes para que las copias no se
      compartan (el motor muta `damage` al subir de nivel con cristales).
  - **Un item sin potencial se pintaba SIN NINGUNA ESTRELLA**, no con cero. Siete
      plantillas tenían su propio `${item.potential ? '★'.repeat(...) : ''}`, y eso es
      R2 en la forma más silenciosa: la regla estaba **copiada siete veces y en ninguna
      era comprobable**, porque `verify/` prueba el motor y no el HTML. Ahora hay una
      regla, `estrellasDe()`, que siempre da de 1 a 5.
  - **La migración rellenaba el campo sin ajustar el daño.** `migratePotential()` le ponía
      ★3 a un item con daño 5 y lo dejaba en 5: **las estrellas decían una cosa y el daño
      otra**, que es justo para lo que sirven. Ahora `migraPotenciales()` escribe el campo
      **y deja el daño de acuerdo**, y se aplica en **cada carga**, no solo al subir de
      versión: una partida guardada a medio camino podía traer un ★5 con el daño de un ★1.
  - **Y la valoración cobraba por un ★1 un item que hace como un ★3**:
      `potentialValueMult()` devolvía 1 para cualquier potencial ausente, que es el precio
      de un ★1, mientras el item se pintaba y pegaba como un ★3. El número del diálogo y
      el del daño eran de dos juegos distintos.
- [x] **G5 · La forja: exactamente 2 del mismo tier, potencial medio y afijos por
      linaje.** Lo que faltaba de tu lista era **solo la cantidad de afijos**: el motor ya
      exigía 2 exactos, distintos y del mismo tier, y ya sacaba el potencial de la **media**
      de los dos. Lo que no existía era la parte de "sumando algún afijo aleatorio
      adicional".
  - **Con un número fijo, los dos materiales solo decidían _cuáles_ afijos.** El item
       forjado llevaba los que le tocaban por rareza, y los padres solo servían para elegir
       de la lista. Se podían haber gastado en cualquier otra cosa. Ahora
       `rangoDeAfijosForjados()` da un **suelo** (el de la rareza, que no se negocia) y un
       **techo** (lo que arrastra el linaje), y se tira el dado entre los dos: dos
       materiales con buenos afijos pueden dar un item con más afijos.
  - **El techo es la MEDIA de los dos, no el mejor.** Con el mejor, un solo material
       perfecto bastaría y el otro sería decorativo, que es justo lo que la forja no debe
       ser: los dos importan. Y **la nanopartícula sube los dos lados**, no solo lo
       garantizado: es lo que justifica pagar 90.000 por ella.
  - **Y la forja no tenía banco.** `stateCheck` la rozaba seis veces para el techo de nivel y
       nada más, así que las reglas más finas del juego no las comprobaba nadie. Hay
       `forjaCheck`, con 33 pruebas.
  - **Para poder comprobarlo hizo falta quitarle el azar.** `attemptForge()` tiraba
       `Math.random()` seis veces sueltas —el acierto, el nombre, el número de afijos y los
       dos pasos de la mezcla—, y eso convertía la forja en lo único que **no se podía
       probar**: cualquier medición acababa siendo "esta vez salió". Ahora acepta `rng`, como
       `rollPotentialFrom()`, `forgeCollectorName()` y los dos generadores ya hacían.
- [x] **G6 · Los botones de forja y de sus compras, solo cuando están desbloqueados.** La
      Forja desaparece de **las dos barras** —la de abajo y la de escritorio—, entrar por la
      ruta se **nega diciendo por qué**, y la sección de la tienda **deja de pintar las
      tarjetas**: antes se podían **comprar** piedras de calibración sin tener la forja, y
      el dinero se iba a un inventario donde nadie podía gastarlo.
  - **La regla estaba escrita a mano en dos sitios** —el motor y la tienda— y esto iba a ser
       el tercero. Con tres copias de "¿tengo el nodo?" es como dos de ellas dejan de estar de
       acuerdo. Ahora vive en `data/tree.ts`, junto al nodo, y los tres la llaman: por eso el
       banco puede comprobar que el motor y la interfaz dicen lo mismo.
  - **Ocultar el botón no es negarse a entrar.** El `data-nav` puede venir de un enlace, de
       otra página o de la pila de navegación, así que si la ruta siguiera respondiendo el
       botón escondido no valdría para nada: habría una pantalla inservible a un clic. Es la
       misma regla preguntada dos veces, y en el router —no en la barra— para que las dos
       barras no se separen.
  - **El cartel se queda, las tarjetas no.** Una categoría que desaparece sin más no se
       diferencia de una que nunca existió.

### Lote 3 · PRESTIGIO, VAULT Y LA PASIVA OFFLINE

- [ ] **F40 · Vault.** Se desbloquea en el árbol, llega a **nivel 10** y lo que guarda
      sobrevive al Prestigio. **Decisión tuya:** ¿se sube con núcleos o con items de caja?
- [ ] **F41 · Prestigio: qué se conserva y qué no.** Ya se conservan logros, núcleos,
      cosméticos y el histórico; falta **la lista escrita** y un banco que la compruebe.
- [x] **F42 · Fuera la pasiva offline.** Hecho, y era **la tercera de las tres**, que es la
      que de verdad daba dinero. Las otras dos ya estaban: sin presencia no hay tick, y sin
      tick no hay ingreso. La que faltaba era **el cobro al volver**: `grantAfkCatchUp()`
      pagaba el pasivo acumulado del tiempo ausente mientras la tarjeta AFK estaba puesta.
      Eso es ingreso sin mirar la pantalla, que es exactamente lo que la regla prohíbe.
      **Se borra la función entera y no solo su llamada**, porque dejar una función sin
      usar es dejar la puerta abierta con el nombre puesto —y el nombre ("catch up",
      "ponerse al día") decía justo lo contrario de su efecto, que es la forma más fácil de
      que alguien la deje ahí "porque parece justo".
      **Lo que NO se toca es el reloj**: la tarjeta AFK sigue comprando tiempo, que es lo
      que es, y sus topes siguen vivos. Lo que no existe es que ese tiempo se convierta solo
      en nanitas: para eso hay que pulsar. `tickCheck` (+8), y en el propio bloque se dice
      **qué no está verificado**: el manejador de presencia no se puede lanzar desde un
      banco porque `domStub.ts` tiene `addEventListener` como no-op, y fabricar una API de
      pruebas para comprobar que no hay código sería añadir código al motor para eso.

### Lote 4 · CONSUMIBLES

- [x] **F43 · Usar N de golpe.** Hecho. El diálogo de usar un consumible **pregunta cuántas**
      cuando el tope deja más de una, y el motor cobra y aplica ese mismo número:
      `planUseConsumable()` es la única fuente del tope y `useConsumable(id, n)` lo consulta
      **antes** de aplicar nada, con el `switch` de siempre en un bucle. El expansor calcula
      su tope aparte, porque el suyo no es un tiempo sino el almacén. Con lo que había antes,
      con veinte tarjetas AFK en la pila eran veinte confirmaciones para un efecto que el
      juego limita a tres; y una tarjeta que no cabía **se cobraba igual** (el tope vivía
      dentro del `case` que aplicaba el efecto). `consumableCheck` (+20).
      **Ojo con la cifra del doc:** aquí decía "click x2/x3, 5 minutos" y el juego tiene 30
      desde el principio. Mandó el código, que es el que comprueban las pruebas.
- [ ] **F43b · Cuántos de cada tope.** Dejar los topes en un sitio solo ya está hecho
      (`topeDeConsumible()`), pero los **números en sí** son decisión de equilibrio: los 30
      minutos de la x2 y la x3 hacen que tres tarjetas de la x2 indistinguibles de una, y
      el AFK de tres tarjetas se puede ampliar con el árbol. Nada de esto lo toco sin que
      lo decidas.

### Lote 5 · EXPANSORES Y ALMACÉN

- [ ] **F44 · Expansores hasta T30.** Pides "hasta T30" y el juego tiene **10 cajas**: los
      expansores de T11 a T30 no tienen de dónde salir. **Decisión tuya:** ¿se suben las
      cajas a 30, o los expansores altos salen de otra parte?
- [x] **F45 · Buscador en el almacén.** Hecho. Un campo antes del selector de orden, y la
      **búsqueda se compone con el filtro de tipo** en vez de sustituirlo: buscar dentro
      de "Recolectores" sale distinto de buscarlo en "Todo". Busca por **nombre, detalle,
      rareza, tipo y tier**, sin tildes y sin distinguir mayúsculas.
      **Lo que más cuesta decidir es qué es una coincidencia, y por eso hay dos reglas y
      no una:** un término **con letras** es prefijo de una palabra —"ak" tiene que
      encontrar "Ak-7" y "Ak-10"— y un término **con números** es el **tier exacto** —
      "t1" devuelve el T1 y **no** el T10—. Un prefijo también en los números es el
      error clásico: quince resultados que no son los que se han pedido, sin explicación
      posible. Y varios términos son "y", no "o": "ak 7" son dos y quiere los dos.
      **La rejilla vacía dice las dos cosas que pueden estar pasando** —que no hay nada de
      ese tipo, o que hay y no es lo que se busca— con el botón de quitar la búsqueda, y
      **eso hubo que hacerlo sobre `celdas.length === 0` y no sobre el HTML vacío**: la
      rejilla se rellena con celdas de capacidad libre hasta el tope del almacén, así
      que con la condición sobre el html el mensaje no salía nunca y lo que se veía al
      buscar algo inexistente era una pantalla entera de "+", que es la misma imagen que
      un almacén vacío.
      `filterCheck` (+17), que es el banco que ya comprobaba el filtro y el agrupado.
- [-] **F46 · Orden personalizado** — **descartada, ya no hay nada que ordenar a mano.**
      El arrastre y "Mi orden" se quitaron en `26171d1`: quedaban huecos entre celdas, que
      son huecos de verdad, y con ellos "colocar el almacén" era una disposición y no un
      orden. Lo que queda es "Como llegó", que es el orden de entrada y **la única manera
      de volver al estado natural** sin recargar la página. Si algún día vuelve a hacer
      falta, es una feature de verdad, no un arreglo.
- [x] **F47 · Los expansores a "Mejoras"**, no a recursos. Hecho: "Recursos" se queda
      solo con el cristal, que es el único que lo es, y los expansores se van con las
      cartas de ranura. No es un cambio de sitio: es que **la categoría se llama así porque
      es lo que hay dentro**, y "Recursos" tenía tres cartas de las que dos no son
      recursos: no se gastan, no se acumulan, se **usan**.
- [x] **Escalera de expansores a +10 y a la venta el T3 y el T4.** Decisión tuya, aplicada:
      el T1 vale hasta 25, el T2 hasta 35 y así de diez en diez hasta el T10 en 115; y
      **cada expansor da +1 ranura**, no el peldaño entero. Son dos reglas distintas y
      ahora viven en dos números distintos (`RANURAS_POR_ESCALON` y
      `RANURAS_POR_EXPANSOR`), porque juntas se movieron las dos y los techos quedaron
      en 16, 17, 18 y 19. Con +1 un peldaño son diez usos, que es justo lo que hace el
      uso en lote de F43 cómodo de usar.

### Lote 6 · RULETA, CRISTALES Y NÚMEROS

- [x] **F48 · El check de saltar animaciones va en la ruleta**, no en el perfil. Ya
      estaba, y en el sitio correcto: `getSkipRoulette()` lo leen **las tres** ruletas —
      la de cajas, la de sintonización y la de la forja—, y el conmutador está en Ajustes
      de la cabecera, o sea fuera del perfil. No estaba marcado porque el banco solo
      llegaba a la mitad: `rouletteCheck` comprueba que la preferencia exista, **persista,
      sobreviva a la recarga y coaccione** —un valor raro es "no saltar", nunca un trompo
      a medias—, que es lo que se puede comprobar sin DOM. Lo que no comprueba es que las
      tres ruletas la lean, porque eso es leer código y una prueba que lee código no lo
      comprueba: lo lee. Anotado abajo como pendiente de banco.
- [x] **F49 · Mejora automática de cristales** hasta agotarlos. Hecho, y lo que salió es
      que **no es una ruleta más**: es el mismo intento repetido, y esa es toda la
      diferencia que importa.
      - **No puede ser peor que gastar a pulso, y se demuestra.** Un fallo **no baja el
        nivel** —eso estaba escrito a propósito para que la escalera no tuviera
        retorno— y el cristal no tiene otro uso en el juego: su única función es pagar un
        intento. De las dos cosas sale que un cristal gastado en automático y otro gastado
        a mano valen lo mismo. **El automático no cambia la economía: cambia quién
        pulsa**, y por eso no necesita más permiso que el botón.
      - **El botón usa el modo sin guardado y sin repintado.** `saveToFirebase()` escribe
        en local y en la red, y `onUpdate()` repinta la página entera: hacer eso por
        intento serían decenas de escrituras sobre el mismo documento para acabar en el
        mismo sitio. Con el automático ocurren **una vez, al final**.
      - **El bucle para por una razón y no por un número de vueltas.** Sale cuando ya no
        se puede intentar —sin saldo o en el techo— y **un fallo no lo para**: es un
        intento más. Si saliera en el primer fallo, gastar doscientos cristales sería un
        intento y medio, que es lo contrario de "automático".
      - **Hay tope de intentos, y avisa.** El nivel tiene techo y el cristal no, así que
        con una cantidad enorme el bucle se comería la pestaña. Cuando llega al tope
        **para y lo dice**: el mensaje lleva los intentos, los aciertos y los cristales
        que quedan. Un tope callado sería un "hasta agotar" que miente.
      - **El automático no tiene ruleta.** Un intento se enseña con la ruleta porque es
        **un evento**; setenta y nueve intentos son un resultado. El resumen lo devuelve
        el motor, no lo calcula la vista, y el botón **no promete a qué nivel sube**
        porque eso depende de un dado.
      - **Solo para recolectores.** `upgradeCompanion()` no tiene modo automático y no se
        ofrece uno a medias: un botón que pregunta si quieres automático para después
        decirte que no es peor que no ofrecerlo.
      `potencialCheck` +7: equivalencia con el pulso con el mismo dado, que para con menos
      de lo que cuesta el siguiente intento, que el resumen cuadra con el estado, que un
      fallo no para el bucle, que sin cristales no hace nada y lo dice, que el techo sigue
      siendo el techo y que un id que no existe se niega.
- [x] **F50 · Precisión de los contadores.** Estaba arreglado —tres decimales en vez de
      dos, que era lo que congelaba el saldo con pocas nanitas— pero **nunca se marcó
      porque no había banco**, y eso es justo lo que hizo que pasara inadvertido tanto
      tiempo. El banco nuevo (`contadorCheck`, 11 pruebas) encontró **dos bugs de verdad**:
      - **El separador decimal no era el del juego.** `toFixed` devuelve punto, y en
        español el punto es el separador de miles: la rama de los enteros escribe
        `1.234` y la abreviatura escribía `1.000 K`. El mismo carácter significando dos
        cosas distintas en la misma pantalla. Ahora la coma es la regla, también en la
        notación exponencial.
      - **El tramo se calculaba con `Math.log10`, que falla en la frontera.** Con
        999.999.999.999.999 el contador enseñaba `1.000 Qa`: **mil veces el saldo**, y
        por encima de cualquier tolerancia de redondeo. Un logaritmo devuelve un `double`
        y en la frontera el redondeo decide, y decide hacia arriba. Ahora es una
        estimación con corrección exacta contra `Math.pow(1000, tramo)`.
      Y de paso: **`formatCompact()` hacía lo contrario de lo que decía su nombre.**
      Documentaba "sin abreviar" y llamaba a `formatNumber`. No lo usaba nadie, que es
      por lo que nadie se enteró; el banco compara las dos funciones y ahora sí hace lo
      que promete.
      El banco mide tres cosas: que un incremento de una cifra mueva el número en cada
      tramo, que lo que se lee sea lo que hay con el error del redondeo, y que cada
      tramo enseñe su unidad sin adelantarse.

### Lote A · BUGS Y VERDADES (encargo del 3 de octubre)

- [x] **A1 · La forja NO SE PODÍA USAR.** El más gordo del encargo y no se veía desde el código:
      la página pedía **3 materiales** y el motor exige **2**. Con eso los dos huecos del yunque
      se llenaban, `ready` nunca se cumplía y **el botón FORJAR se quedaba inactivo para
      siempre**. Si se llegaba a seleccionar un tercero —no había tope al añadir—, el motor
      rechazaba la fusión con "se necesitan 2". Y el propio modal decía "Dos recolectores de
      tier N", así que la página se contradecía en la misma frase.
      **No se rompía de forma ruidosa**: un botón gris es exactamente lo que parece un botón que
      aún no cumples sus requisitos, y el jugador leería "me falta un tercer material" sin
      encontrar dónde cogerlo.
      Ahora el número es `MATERIALES_POR_FUSION`, en el módulo que lo impone, y lo leen los seis
      sitios de la página. **Una receta no se escribe en dos sitios.**
- [x] **A2 · Una caja T1 no podía dar un arma T1.** La entrada de recolector estaba detrás de un
      `if (tier >= 3)`. La consecuencia no era "la caja T1 es más pobre": el jugador que **solo
      puede comprar cajas T1 no tenía forma de conseguir material para la forja**, porque no se
      compra en la tienda y la caja era la única puerta. Y la forja son dos del mismo tier.
- [x] **A3 · Más armas y compañeros en las cajas.** `PESO_RECOLECTOR` y `PESO_COMPANERO`, con
      nombre propio. Subir un peso sube su probabilidad y **baja la de todo lo demás**, que es lo
      pedido, pero también sube la del salto: comparten tabla. Con un número suelto en `weight:`
      nadie ve esa relación.
- [x] **A4 · El jugador nuevo nace con los dos items PUESTOS y en ★1.** Antes los veía en el
      almacén sin poner, con ingreso a cero y sin ningún botón que pulsara: todo era adivinarlo.
      **★1 y no ★3, y es una decisión de entrada**: si el item de partida viniera en el punto
      medio, el jugador empezaría con un ★3 sin haber hecho nada y no tendría nada que mejorar
      hacia abajo. La **Ascensión también los deja puestos**, porque reconstruye la partida de
      partida: si no, ascender desequiparía todo sin avisar.
- [x] **A5 · La Forja: el selector de orden no se podía usar, y cada cambio devolvía la
      página al principio.** Reportado el 4 de octubre: "lo toco y me sube al principio y no
      puedo cambiarlo", y lo mismo al marcar un material. **Eran dos bugs con la misma
      causa de fondo, y los dos estaban donde nadie mira porque el código se lee bien.**
      - **El `<select>` de orden estaba en `click`.** Su propio comentario decía "es un
        `change` y no un `click`" —y el código estaba en `click`. Un `click` en un select
        es "han tocado el control", no "han elegido algo": el delegado lo tomaba por un
        cambio de orden y llamaba a `redraw()`, que **sustituía el nodo entero, incluido el
        propio `<select>`**. El desplegable se cerraba antes de llegar a abrirse. Ahora va
        en `change`, que solo salta cuando el valor **ha** cambiado. El almacén ya lo tenía
        bien; la Forja era el único sitio con el patrón equivocado.
      - **Cualquier re-render devolvía la página al scroll 0.** `mountInto()` hacía
        `replaceWith`, que **quita el nodo viejo antes de insertar el nuevo**: entre las dos
        operaciones el contenedor se queda sin contenido, el navegador ve una página de
        altura cero y recorta el `scrollTop` a 0. Cuando la página volvía a crecer ya no
        había a qué volver, así que el salto era definitivo. Medido en la forja: 120 px al
        cambiar el orden, 0 px después; y lo mismo al marcar el primer y el segundo
        material.
        Ahora inserta **antes** de quitar, y además devuelve los scrolls del árbol nuevo
        usando la ruta de índices del nodo viejo —porque el `<main>` que scrollea está
        **dentro** del nodo que se sustituye, no en sus antepasados, y esa fue la dirección
        equivocada en el primer intento.
      - **Y cambiar de página sigue empezando arriba**, que es lo que había que evitar al
        arreglar esto: navegar vacía `#app` antes de montar, así que `mountInto` no
        encuentra nodo previo y no conserva nada. Solo se conserva en el repintado de la
        misma página, que es el único caso en el que conservarlo es lo correcto.
      **Lo que no hay aquí: banco.** El comportamiento del scroll es de layout, y
      `domStub.ts` no tiene layout —`scrollTop` siempre es 0—, así que una prueba escrita
      ahí pasaría en verde sin comprobar nada. Está medido en `preview.html` con viewport
      real (cambio de orden 120 → 120, primer material 150 → 150, segundo 160 → 160, cambio
      de tier 140 → 140, y el `click` del select ya no redibuja nada).

### Lote B · ENCARGO DEL 3 DE OCTUBRE, SEGUNDA TANDA

*Las cinco son tuyas y **ninguna se ha tocado**: se escriben aquí antes de(programarlas, que es
lo que evita que vivan solo en una conversación. Las tres primeras están medidas.*

- [ ] **B9 · Que un T1 al máximo de mejora pueda superar a un T2 flojo.** Lo que dices es
      que, si no, **siempre compensa esperar al tier siguiente** y el sistema de cristales
      deja de tener efecto.
      **Medido, y la mitad es verdad.** Con la regla de hoy (`baseDeTier()` sube ×1,75 por
      tier y `multiplicadorDeNivel()` da +10 % por nivel), un **T1 ★5 subido al techo de
      nivel 35 pega 45** y un **T2 ★1 recién salido pega 13**. O sea que sí lo supera, y
      incluso al T2 ★1 **subido también al techo** (43): 45 contra 43.
      **Y aquí está el problema real:** ese 45 contra 43 son **35 niveles de cristal y un
      +4,7 %**. El nivel compra casi un tier entero de diferencia y el tier vale ×1,75, o
      sea que **el potencial —que es el dado— le gana al sistema de mejora por goleada**, y
      solo en la distancia mínima entre dos estrellas contiguas. Con un T2 ★2 ya subido (54)
      no hay nada que hacer.
      **Lo que hay que decidir no es el número del 10 %:** es si subir de nivel tiene que
      poder competir con **subir de potencial**, porque hoy compiten por la misma reunión y
      el segundo es el que sale de un dado. Subir el 10 % hasta que un T1 ★5 al techo iguale
      a un T2 ★5 al techo (99, o sea ×2,2) es una opción; la otra es reconocer que los
      cristales sirven para **subir el tier que ya tienes** y no para cerrar la distancia de
      potencial. **Y ojo:** subir el multiplicador de nivel sube también el ingreso de los
      compañeros, que usan la misma función, así que es un cambio de economía y no un ajuste
      de la forja.
- [ ] **B10 · Que dentro de un mismo tier haya bases distintas.** Hoy **no las hay**:
      `danioDeRango()` es `base del tier × (1 + 0,2 × potencial)`, y el potencial es un
      entero de 1 a 5. O sea que **dentro de un tier hay exactamente cinco valores**, y dos
      T1 con el mismo potencial son **idénticos**: mismo daño, mismos afijos posibles, misma
      valoración. Dos T1 ★5 son el mismo objeto, y eso hace que buscar una caja sea buscar
      una estrella y no una arma.
      **Lo que falta es una tira continua dentro del rango**, que es justo lo que F33
      describía y que se quitó al decidir que el potencial 1..5 **era** el stat. Las dos
      cosas no pueden ser el stat a la vez: o el potencial decide, o la posición en el rango.
      Si se añade la tira, la forja necesita una regla para promediarla —que es la que F33 ya
      tenía— y las estrellas pasan a ser "de qué parte del rango viene", que es información
      distinta.
- [-] **B11 · En la Forja, "materiales" son "compañeros y armas".** **Dos de las tres partes
      hechas; la tercera ya lo estaba.**
      (a) **El nombre.** La sección se llamaba "Materiales" y el juego no tiene esa palabra:
      el almacén guarda recolectores y compañeros y el interruptor de arriba ya dice
      cuáles. Ahora la cabecera sale de `NOMBRES[ui.tipo]`, el mismo sitio del que salen
      el "queda 1 material" y el "ya hay un T7 en el yunque". Es el mismo fallo del
      "se necesitan 2" de A1 en pequeño: una cabecera que dice una cosa y la lista de
      debajo dice otra obliga al jugador a adivinar si busca una cosa o la misma.
      (c) **Que no se mezclen: ya estaba, pero el aviso no.** El cambio de *tier* vaciaba el
      yunque **con aviso** —"cambiaste de T7 a T10"— y el cambio de *tipo* lo vaciaba **en
      silencio**. Un jugador que llena el yunque de recolectores y toca "Compañeros"
      pierde la selección sin una palabra, y lo único que ve es un yunque vacío. Es el
      mismo síntoma que el "ya está al tope" sin motivo: algo pasa y no se explica.
      (b) **El filtro como el del almacén queda sin hacer.** Es una feature de verdad, con su
      propio diseño, y no la meto de paso en un commit de dos avisos: se queda aquí con
      su número, sin fecha.
- [x] **B12 · El yunque de fusión quedó raro.** **No era estética: era un número escrito en
      un sitio que no lo era.** La rejilla del yunque tenía `grid-template-columns: repeat(3,
      1fr)` en el CSS desde los tiempos de la receta de tres, y cuando la receta pasó a dos
      la rejilla siguió con tres: los dos huecos caían a la izquierda y la tercera columna se
      leía como un campo de texto vacío al lado del yunque. El `MATERIALES_POR_FUSION` lo
      lee la página y el CSS no puede leerlo, así que ahora lo pinta la página en un
      `style` y el CSS solo pone el resto del molde. De paso el ancho de cada hueco está
      acotado a 5,5 rem y centrado, porque con `1fr` en un monitor los dos cuadrados de
      `aspect-ratio: 1` medían medio metro de alto cada uno.
      Y el "2 del mismo tier → 1 del siguiente" de la cabecera también sale de la receta:
      estaba escrito a mano, que es el segundo sitio donde podía quedarse viejo.
      Comprobado en `preview.html?vista=forja` a 390×844 y a 1440×900: dos huecos, centrados,
      sin columna fantasma.
- [x] **B13 · La barra de progreso de los buffs miente cuando usas varios.** **Causa raíz
      confirmada en el motor:** la barra del HUD era `restante / duración de UNA tarjeta`
      (`BUFF_DEFS[].durationMs`), y el motor **acumula**. El caso extremo medido: **sesenta
      tarjetas de click x2 de 30 s son treinta minutos de buff**, y con el denominador de
      30 s la barra daba **6000 %** — es decir, se quedaba clavada en el 100 % con el
      contador corriendo, que es exactamente lo que se veía: una barra muerta al lado de
      un buff vivo. Afectaba a `clickX2`, `clickX3` y `passiveBoost`; el `clickBoost` y el
      AFK casualmente tienen tope igual a una tarjeta y por eso parecían bien.
      **El arreglo es guardar el total concedido**, un campo por buff
      (`BUFF_TOTAL_FIELDS`, más `state.afkTotalMs` para el AFK, que vive fuera de
      `buffs`), que se anota **después** del bucle de usos: con tres unidades aplicadas
      gana la última, que es la que sabe cuánto queda en total. El HUD usa ese campo y no
      el tope —con el tope, una sola tarjeta de 30 s salía al 1,6 % y parecía un buff a
      punto de expirar—, y **con 0 vuelve a la duración de una tarjeta**, que es lo que se
      pintaba antes: una partida vieja no tiene el campo, la carga lo coacciona a 0 y
      nunca sale un `NaN` al `width`, que es lo que hace que una barra desaparezca sin
      motivo. `cancelBuff()` borra el total, o la barra del siguiente buff arrancaría con
      el ancho del anterior. `consumableCheck` (+17).`consumableCheck` (+17).

### Lo que queda de este encargo, en orden

- [x] **B1 · La forja se abre desde el inicio y se elimina el requisito.** La puerta era
      real y estaba en cuatro sitios —el motor la rechazaba, la tienda ocultaba las cartas y
      avisaba, el botón de navegación no salía y el enrutador se negaba a entrar—. Ahora
      **no queda ni una línea de esa regla en el proyecto**: un requisito que ya no existe
      no puede quedarse a medias en cuatro ficheros, porque un semi-requisito es un requisito
      que alguien puede volver a cerrar sin querer.
      **Y `blueprint` NO se ha borrado, y no es casualidad:** es la **raíz de la rama de
      crafteo** —`forge_luck` y `shard_sifter` lo tienen en `requires`—, así que borrarla
      dejaba esos dos inalcanzables y con sus bonificaciones desaparecidas de golpe para
      quien ya los tenía. Se queda como raíz y **ahora da `craftLuck` 3 %**, porque un nodo de
      4 núcleos que no hace nada es una trampa: el jugador lo compra, ve que no cambia nada, y
      pierde la confianza en el árbol entero. Es además el único nodo de la columna 0 que no
      daba bonus. **Si molesta, es ese número y esa línea.**
      Las pruebas que afirmaban la puerta se han ido con ella —una prueba que asegura una regla
      borrada es peor que no tenerla— y en su lugar hay una que verifica que **una partida
      recién creada, sin árbol ninguno, forja**.

- [x] **B2 · La forja fusiona también compañeros.** Dos del mismo tier salen uno del
      siguiente, con **la misma probabilidad, el mismo cobro y el mismo fallo** que dos
      recolectores, y eso no es casualidad: las tres reglas que tienen que coincidir —
      cuántos materiales, que sean distintos y del mismo tier, y cuánto paga el
      fallo — están **en una función cada una** (`validaMateriales()` y `tiraDeForja()`),
      y las dos fusiones las llaman. Escritas dos veces son dos ocasiones de que una
      acepte tres materiales y la otra dos.
      **Y LO QUE SÍ ES DISTINTO ESTÁ DONDE TIENE QUE ESTAR**: qué se produce y de dónde
      sale su calidad. El recolector forjado hereda **afijos**; el compañero no tiene
      afijos, así que su eje es el **potencial**, con la misma regla de la media.
      **La nanopartícula sube +1 al potencial**, y esa es una decisión, no un olvido: si
      no hiciera nada, un consumible de 90 000 nanitas sería **el mejor objeto del juego
      que no hace absolutamente nada**. Y con esa excepción se toca el texto de la tienda,
      que decía "un afijo extra garantizado" y no mencionaba la mitad de lo que hace.
      En la pantalla hay un interruptor arriba —rec collectors / compañeros— y **los
      materiales se filtran por el tipo elegido**: una lista con los dos mezclados
      dejaría meter un recolector en un yunque de compañeros, y lo rechaza el motor, que
      es la peor forma de fallar.

#### Una discrepancia que salió de aquí, y no la había buscado

**EL PROMEDIO DEL POTENCIAL SÍ PUEDE SUBIR, Y EL CÓDIGO LO DECÍA MAL.** El comentario de
`attemptForge()` afirmaba que *"promediar NUNCA sube el resultado: un 5 sale de un 5, y un 4
de un 4 y un 5"*. **Es falso en el empate**: `Math.round(4,5)` es `5` en JavaScript, así que
un 4 con un 5 **da un 5**. Nadie lo miró porque el caso no es raro —es el más común— pero
tampoco lo había fijado ninguna prueba.

No se ha cambiado la regla: se ha **escrito como es** y se ha fijado con pruebas, porque
cambiar el redondeo en la forja alteraría la partida de quien ya tiene objetos forjados. Lo
que sí se ha hecho es sacarlo a `potencialFusionado()`, que ahora usan las dos fusiones, y
dejar escrito qué significa:

- Un **4 solo sirve como material de un 5**. Fusionarlo con otro 4 da 4 y wastea el 4.
- **Un compañero con potencial 4 no tiene a quién fusionarse sin perderlo.**

Es una decisión de diseño discutible, y es tuya. Si se quiere redondear hacia abajo, es
**una línea** en `potencialFusionado()` y las pruebas que la fijan están en `forjaCheck`.

| Lote | Qué | Por qué aquí |
|---|---|---|
| **C** | 1b nav persistente + 1c sin botón de retroceso | UI pura. Riesgo cero para la economía. |
| **D** | 3b cristales unificados + 3c recompensa por fallo | 3c depende de 3b. Migración de guardado: los cristales hoy son por tier. |
| **E** | 1a quitar llaves | El más caro: toca botín, tienda, reventa, el tope que se puso en `b349393` y 220 pruebas de `llaveCheck`. Solo, con todo lo demás verde. |

---

### Lote 7 · INFORMACIÓN

- [x] **F51 · Explicar los afijos.** Hecho, y lo que salió fue **un texto que mentía**
      y una pregunta que no tenía dónde responderse.
      **La respuesta concreta —"¿cuántos afijos puede tener un Mítico?"— es 4, y ahora está
      escrita donde el jugador la lee.** La regla vive en `AFIX_MIN_POR_RARIDAD` y
      `AFIX_MAX`; lo que faltaba no era el número, era que alguien lo dijera, y que lo
      dijera **leyéndose de la tabla** y no con un número escrito al lado: una explicación
      con el 4 a mano es una segunda fuente de la verdad, y es exactamente lo que se
      queda diciendo la regla vieja después de que la regla haya cambiado.
      - **La frase dice "forjado", y no es un adverbio.** Los afijos solo los da la forja:
        ni la tienda ni las cajas los dan, porque `pickAffixes()` es el único sitio que los
        escribe. Un "un Mítico lleva 4 afijos" sin ese matiz es una mentira comprobable en
        diez segundos —abres un Mítico de la tienda, no tiene ninguno, y dejas de fiarte
        de los otros veinte textos—.
      - **Va en la forja, debajo del desglose de probabilidad**, porque es el otro número
        que se está decidiendo en esa pantalla y porque tiene la misma forma: la cifra
        grande es el resultado y la línea de debajo es de dónde sale.
      - **Lo que enseña la forja es lo que APORTAN los materiales, y lo dice con esa
        palabra.** El techo de verdad es el suelo de la rareza más esa aportación, y el
        suelo depende del potencial que todavía no ha salido del dado: **antes de forjar no
        se sabe**. Un banco pilló que mi primer intento enseñaba "hasta 2" cuando la regla
        daba 5, y tenía razón: era un número que no era el del item, y solo por cómo
        estaba redactado parecía que no mentía. La función ahora se llama `aporteDeAfijos`
        y su comentario explica por qué no puede ser el techo.
      - **Y el texto de la forja que sí mentía, corregido.** Decía "El recolector forjado
        hereda los afijos de la rareza de sus materiales", y son dos cosas falsas en una
        frase: el suelo lo pone la rareza **del item que sale**, no la de los materiales,
        y lo que se hereda son los afijos en sí. Un jugador que lo comprobara con dos
        materiales sin afijos concluiría que la rareza no hace nada, y la rareza es la
        mitad de la regla.
      `leyendaCheck` 14 → 21, el bloque quinto de "cada texto dice la regla que el juego
      aplica". Verificado en `preview.html` a 390×844: 0 px de desborde y la línea
      aparecen: la del reparto y la de la regla completa.
- [x] **F52 · Lore de todos los items**, no solo de los que tienen entrada. Hecho, y lo
      que faltaba eran **veintinueve objetos**: las cinco consumibles, los diez expansores,
      las tres tarjetas de ranura, las diez cajas y el cristal. Todos tenían un `details`
      —"Sube 12 puntos la probabilidad"— y nada más.
      **La diferencia entre `details` y lore es la que lo hace un bug y no una mejora de
      estilo.** El `details` dice lo que hace el objeto; el lore dice de dónde sale. En la
      ficha del almacén un recolector enseñaba su línea de sabor y una caja enseñaba solo
      la mecánica, y **una caja es lo que se abre quince veces por hora**: el objeto que
      más se toca era el que no tenía una sola frase de sabor.
      - **La ficha ya no lo esconde detrás de un ternario.** Decía
        `isCollector || isCompanion ? loreLine(...) : ''`, y el ternario era correcto
        cuando solo esos dos tipos tenían lore. La condición ahora es la del propio item:
        si tiene nombre con lore, se enseña. Y como el lore se busca por **nombre** con la
        misma función para todo, no hizo falta tocar el almacén, la forja ni la tienda: una
        entrada en `LORE` y el objeto la encuentra. No hay un segundo sitio donde mirar el
        sabor de un objeto, y no lo hay por casualidad: habría sido donde los dos se
        separan.
      - **Cumplen las reglas de los otros**: ni un número (el stat va al lado, en grande) ni
        una explicación de lo que hace (el `details` la pone justo encima). El banco de
        leyendas ya lo vigila sobre `LORE` entero, así que el bloque nuevo entró sin
        excepciones.
      - **La lista de nombres del banco no está escrita a mano**: sale de `store.ts` y de
        `data/items`. Y dos comprobaciones propias: que los veintinueve tengan lore y que
        **ninguno esté repetido** en la lista —que es como se cuece el error de mirar lo
        mismo dos veces y no mirar lo demás—.
      - **Y el preview fabricaba objetos que el juego no fabrica.** La caja del mock se
        llamaba "Caja Legendaria", que fue su nombre antes de F31, y los cristales del mock
        eran "Cristal de Afino" y "Cristal de Fase", que dejaron de existir cuando los
        cristales dejaron de tener nivel. Con esos nombres **no había forma de revisar
        F52**: el objeto no encontraba su lore y la ficha salía sin él, sin que se pudiera
        saber si el fallo era del mock o del juego. Mismo criterio que el de los bancos que
        fabrican un `Cristal Singular` inexistente, y por el mismo motivo.
      `loreCheck` 11 → 15. Verificado en `preview.html` a 390×844: caja, piedra,
      nanopartícula, tarjeta AFK y cristal muestran su cita en la ficha.

### Lote 8 · APARIENCIA

- [x] **F53 · Banners, marcos y títulos en Perfil, Menú y Ranking.** Hecho, y lo que
      faltaba no era lo que decía el título. El marco y el título **ya llegaban** a la
      cabecera y al ranking, y el Perfil ya tenía la tarjeta grande; lo que faltaba era
      **que el banner se viera**, y en el ranking no se veía: el avatar lo llevaba como
      halo y el halo ocupa 32 px de una fila de 1056. Ahora el banner es **fondo de la tira
      entera**, al 26 %, en una capa `absolute` que no ocupa columna.
      **Y DE PASO, TRES COSAS QUE ESTABAN ROTAS Y NO ERAN DE ESTA:**
      - **Dos banners del catálogo no pintaban nada en ningún sitio.** Escribían
        `backgroundImage` y `backgroundSize`, que no son propiedades CSS, y en un `style` en
        línea una propiedad que no existe **se descarta en silencio**.
      - **Los nueve marcos eran el mismo círculo de un píxel**, porque `glassBase` traía el
        radio y lo heredaban todos. Ahora la base no lo lleva y **cada marco declara su
        forma**: ocho formas distintas, y ninguna pareja copiada.
      - **La vista previa del catálogo enseñaba la mitad de un marco.** Era un círculo
        suelto, y los marcos con relleno `padding-box/border-box` salían como discos
        sólidos. Ahora la carta pinta el componente real: lo que eliges es lo que te pones.
      `identidadCheck` (+18).
- [x] **F54 · Los marcos no desbordan el avatar.** Hecho, y era **el banner, no el
      marco**. El banner se escala a propósito para leerse como halo (`scale(1.32)` si
      es placa, `1.7` si es circular) y el avatar **no recortaba**: medido en la
      tarjeta del Perfil, una caja de 80 px dejaba el halo en **106 px**, o sea **13 px
      por cada lado**. En el Perfil eso cae dentro del padding y no se ve; en la
      cabecera y en el ranking el avatar es de 32 px, el halo sale 10 px y el hueco
      hasta el nombre es de 8: **se comía las primeras letras del nombre**.
      El arreglo es un envoltorio con `overflow: hidden` que recorta **solo el banner**:
      el marco se queda fuera porque su trazo está centrado en el borde de la caja y
      recortarlo dejaría medio píxel de grosor, que se nota más que el desborde que
      arregla. Y el envoltorio necesita `width/height: 100%` porque el avatar es un
      `grid` con `place-items: center` y sus hijos se dimensionan por su contenido: sin
      eso mide 0×0, no recorta nada y **se lleva por delante el núcleo**.
      `identidadCheck` (+4), que comprueba la estructura y no el píxel.
- [ ] **F55 · Logros 100% obtenibles**, con banco que lo compruebe. Aquí hay un
      ~~sorpresa~~: el logro `overclocked` se acaba de reasignar y hay que mirarlo con lupa.
      **Parcialmente cerrado con los doce difíciles** (ver "Lote 7 · INFORMACIÓN", más
      abajo): ya hay banco que demuestra que los doce se pueden completar a la vez, que no
      los completa una partida vacía y que su progreso no se rebasa. Queda `overclocked`.
- [x] **F58 · Doce logros difíciles y trece cosméticos con el estilo diciendo lo que el
      nombre promete.** Hecho en dos mitades, porque son dos cosas que no se tocan igual.
      - **Los doce logros.** Cada uno es un **lote**: hay que llegar muy lejos o tener
        muchos a la vez. Y hay dos reglas que no negocian:
        1. **Ninguno da bonificación numérica.** Los doce dan `0, 0` y su premio es el
        cosmético. Un `clickBonus` aquí sería tocar el equilibrio dentro de un commit de
        contenido, y el equilibrio es tuyo. Está comprobado contra los `Record` que el
        motor suma, no en un comentario.
        2. **Cada uno mide lo que el jugador ve.** Capacidad = base + slots del árbol;
        estrella = potencial del item; Custodio = nodos **comprados** (`unlockedNodes`),
        no niveles; núcleos = `totalCores` y no el saldo, que baja al comprar un nodo.
        Una condición que mide un campo que el jugador no puede ver es un logro que no
        se puede perseguir.
      - **Los trece cosméticos.** La regla que los gobierna es que **el nombre dice lo
        que se ve**, que es lo contrario de lo que había: nueve marcos eran el mismo
        círculo y dos banners no pintaban nada. Así que Arcoíris y Espectro son un
        `conic-gradient` de arcoíris —y el de Espectro **gira**, con una vuelta completa
        de 9 s porque media vuelta de un cónico es la misma imagen—, Mosaico es un damero
        de verdad hecho con dos cónicos superpuestos y `background-blend-mode`, Escaneo
        son líneas de monitor de 2 px, y Ónix es negro con un filo claro y **no brilla**,
        que es lo que lo hace legible. Las texturas salen de **gradientes a capas**, que
        es lo único que cabe en un `style` sin meter un binario en el repositorio.
      - **Un bug real que salió de camino:** el primer pase usaba `AFIX_MAX` para contar
        los items de cinco estrellas. `AFIX_MAX` es el tope de **afijos** y son 6: el
        potencial se queda en 5, así que el logro **no lo podía completar nadie**, sin
        error ni aviso. Ahora `data/crafting.ts` exporta `POTENTIAL_MAX` y los dos topes
        conviven a veinte líneas, con el comentario que explica por qué no son el mismo
        número. Y `Doblaje` medía el multiplicador tal cual, que **empieza en 1**: la
        barra nacía al 50 % del marco antes de hacer nada. Mide la diferencia.
      `identidadCheck` 70 → 79, `leyendaCheck` sube sola (27 logros).

### Lote 9 · CAJAS

- [x] **F56 · Abrir hasta 99 cajas de una vez, y validar el espacio.** Hecho, y lo que
      estaba mal no era el número sino **de dónde salía**.
      - **El 20 era una copia del 99 de la pila que se quedó vieja.** Dos números que
        hablan del mismo tope y que solo se comparaban entre sí el día que alguien los
        miraba juntos. Ahora `MAX_APERTURA_LOTE` **es** `TOPE_PILA.crate`: no hay número
        que mantener y la comparación del banco solo puede decir que coinciden.
      - **El argumento en contra era cierto y la conclusión estaba equivocada.** Decía
        que una lista de cincuenta premios no cabe en una pantalla, y es verdad —pero
        **la lista ya no es una línea por caja**: `resumenDePremios()` agrupa monedas y
        materiales, así que noventa y nueve cajas suelen salir en cuatro o cinco filas. Lo
        que no se agrupa son los objetos, y eso es una columna con scroll, que es lo que
        ha sido siempre.
      - **El espacio sigue mandando, y se nota.** El mínimo de `maximoDeApertura()` es el
        número de huecos y no el de cajas porque lo peor que puede pasar es **un hueco
        más por apertura**. Con cuarenta huecos ofrece cuarenta y no noventa y nueve:
        abrir un tope sin ese mínimo sería una puerta a perder botín en silencio, que es
        la peor clase de fallo de una lotería —el jugador cree que ha perdido el premio
        por mala suerte y la culpa es del inventario—.
      `loteCheck` 75 → 83, con los cuatro casos que importan: almacén entero, un hueco,
      huecos justos y huecos de sobra.
- [ ] **F57 · "Eliminar el sistema de cajas y llaves tradicionales (o unificar su lógica)"**
      — **no está claro qué quieres decir** y es lo más caro de deshacer. Es pregunta tuya.
- [ ] [x] **F58 · Lista consolidada y agrupable.** Hecho en `loteCheck`.

---

### Las dos decisiones que necesito de ti

**Las dos están contestadas (3 de octubre de 2026). Quedan aquí escritas, porque una
decisión que solo vive en un mensaje no existe dentro de tres meses.**

1. **F40 · El Vault se sube con NÚCLEOS.** **Por qué:** el Vault es progreso permanente
   y un Ascenso da justo eso; el árbol ya cobra núcleos, así que no hace falta un item
   nuevo ni un segundo camino de Divisas.
2. **F44 · Los expansores NO llegan a T30.** **Por qué:** el juego tiene 10 cajas, y subir
   a 30 niveles de caja es un rebalance entero. Se queda la escalera de 15 a 65 con diez
   tiers, que ya está puesta y probada. **Consecuencia que hay que aceptar:** el expansor
   más alto abre hasta 115 ranuras, y a partir de ahí el almacén se llena sobre todo con
   expansores.

---


## Lo único que espera tu respuesta

**Son cinco cosas, y las cinco son tuyas, no más. Nada de la lista de abajo se puede
programar bien hasta que estén.**

| # | Qué | Por qué bloquea |
|---|---|---|
| **1** | **La curva de probabilidad de forja por debajo del T20.** Propuesta: **60% / 68% / 75%** (tramos 1-9 / 10-19 / 20+). Hoy está al revés: 78% en T1 bajando a 33% en T10. | Es un **cambio de signo** en la curva, y es lo que da forma al tramo alto de la forja. Sin tu "sí" el forjado sigue siendo más difícil cuanto más alto, que es lo contrario de lo que pediste. |
| **2** | **B8 · Ver el perfil de otro jugador.** Hecho: tarjeta pública `perfiles/{uid}`, se abre tocando un nombre en el ranking, y con contador de visitas que no cuenta al dueño | **Es privacidad, y no lo debe decidir un agente.** Recomiendo la tarjeta pública: lo no recomendable es abrir el documento privado, porque un incremental te enseña el gasto y el inventario de tu competencia. Bloquea F20 y F22. |
| **3** | **P4 · Jugar otra partida y decir hasta dónde llegas.** | `balanceCheck` comprueba que los números encajen entre sí, no que la partida dure lo que tiene que durar. Eso solo se mide jugando. |
| **4** | **F19 · Dos cosas de los logros como items.** Qué pasa con el item si ya tienes el logro (¿se vende, se guarda, no se usa dos veces?), y si los logros **seguros** son tradeares o solo los de caja. | Cambia el modelo de logros entero. Es la última cosa del lote a propósito. |
| **5** | **P5 · Las cajas ya no dan nanitas.** El premio pasó de ×14-22 del par a **25-40%**, porque era una máquina de imprimir. | Cerrar el bucle compra-venta era lo que pediste, y la única palanca que quedaba era la **fórmula** de las nanitas. Con menos nanitas de las cajas, la **forja pasa a ser el ingreso principal** y la partida puede hacerse más lenta. El sitio del ajuste es un número, y cualquier valor sigue teniendo la prueba de que no supera el par. |

**Y una limpieza que ya está hecha:** `.github/workflows/publicar.yml` **está borrado**.
Fallaba en todos los pushes porque Pages no está activado en el repo, y no se quiere
Pages, así que no quedaba nada que arreglar: sobraba el fichero. Con él se va también
el directorio `.github`, que solo contenía esa carpeta.

**Y un número que ya está decidido y solo necesita confirmación:** el **75% fijo desde
el T20**. Es lo que garantiza que siempre haya riesgo; un tope del 95% es un 5% de
fracaso. Está razonado en el archivo y en F36.

---

## Plan de trabajo

**El orden no es por urgencia, es por dependencia.** Tres cosas mandan:

1. **F24 antes que F31.** Si la tienda solo venden tier 1, la forja es la única vía, y
   un jugador que mete mal un material **sin poder sacarlo se queda atascado sin salida
   ninguna**. Con la tienda abierta es una molestia; con la tienda cerrada es un muro.
2. **F23 antes que F29.** Si los núcleos **puntúan**, y no hay bloqueo de sesión, abrir
   dos pestañas es la forma más rentable de farmear. F23 es la condición de que F29 sea
   justo.
3. **F26 con F31, no antes.** El cristal estricto necesita 30 niveles de cristal, y de
   dónde salen los altos es justo lo que resuelve F31. Hacerlos por separado es dejar el
   T8asking por un cristal que no existe.

| Orden | Qué | Por qué aquí |
|---|---|---|
| **1** | ~~**F24** · Quitar material de la forja~~ **HECHO** | Era el atajo del id triplicado + el quitar, que ya existía. `stateCheck` +3. |
| **2** | **F26 + F31** · Cristal del mismo tier + tienda solo en cajas básicas | **La pieza grande.** Una caja por tier resuelve F26 (el cristal sale de la caja correcta), F27 (el expansor alto sale de caja) y F31 (la llave y la caja del siguiente) de una sola vez, y mata el patrón de D4 por construcción. |
| **3** | ~~**F33** · Forja de 2 materiales que hereda el stat~~ **HECHO** (`58d5a4e`) | El potencial 1..5 decide el daño, la forja promedia los dos. `stateCheck` +9. |
| **4** | **F23** · Una sesión por dispositivo | Decidido: **negarse a entrar, no expulsar al otro**. Con reloj de expiración corto (30-60 s) para que cerrar la pestaña libere la cuenta. |
| **5** | **F29** · Núcleos en el ranking + **no enseñar la fórmula de puntos** | Solo justo después de F23. Y lo de esconder la fórmula va en serio: con los pesos a la vista, regalar un logro de 250.000 puntos pasa a ser lo más rentable del juego —y te lo haría a ti. |
| **6** | **F30, F28, F25** · Sueltos y pequeños | No dependen de nada. F30 es un R3 (se ve 99 y hay 150), F28 es delta time, F25 es una línea en un array. |
| **7** | **F37** · Síntesis de items / elegir afijo | **Después de F33 a propósito**: F33 vende la forja como "el item que tú quieres" y una síntesis con afijo sorteado es "el item que te salió", que es la promesa de la caja. No pueden ser el mismo botón. |
| **8** | **F19 + F21** · Logros como items, y el nombre de los secretos | Últimos. Cambian el modelo entero, y F21 sale de F19. |
| **9** | **F20, F22** · Avatar propio y comparar partidas | Dependen de tu respuesta nº2 (B8), porque un avatar es justo el dato que hay que poder leer de otro jugador. |

**F9, F10 y F13 no están en el plan porque ya están resueltos** — mira abajo.

---

## Features pendientes

### F9 · Los logros tienen que decir qué falta

> Quiero que los logros den una "pista" de lo necesario para cumplirlos.

**La pista ya existe y es completa:** en Perfil → Logros cada uno enseña
`actual/objetivo` con su barra, y sale de la misma función del motor que decide si está
cumplido. No es inventada ni una copia.

Lo que no sabías es que estaba ahí, porque esperabas un cartel que nunca llegaba — eso
era B3, ya arreglado.

**Queda una decisión tuya, y es pequeña:** si la quieres **fuera del Perfil**. Perfil es
el único sitio donde caben quince logros con su barra. Un "Logro más cercano: 15/20" en
el panel principal es un número que cambia cada pocos minutos.

### F10 · Que el trompo sea el que sortea

> La descripción dice que ya está decidido y en realidad se debería mostrar el tiro y decidirlo luego de comprarlo.

**Esto es justo lo contrario de lo que hace el código, y el código lo hace a propósito en
seis sitios.** El motor sortea **y aplica el botín** en el mismo instante, y el trompo solo
lo enseña.

No es superstición: la cinta se monta **antes** de girar, con el premio ya puesto en
`winIndex`. Si el trompo decidiera, la casilla que se parase tendría que ser la que el
azar eligió al principio de la animación — o el premio se aplicaría después de parar, y
entonces **la casilla que enseña y el botín que entra serían dos cosas distintas**. Es el
fallo que el propio código ya cometió una vez con las llaves.

**Mi recomendación: no tocar la mecánica.** Lo que faltaba era la explicación, y ya está
arreglado (B5). Si aun así quieres el sorteo al final, hay que rehacer el modelo de la
cinta y aceptar que el premio se aplica después de la animación: eso abre la puerta a que
el jugador cierre el overlay a mitad y se lleve una caja sin nada dentro.

### F23 · No se pueden abrir dos sesiones a la vez

> No debería poder abrir dos sesiones en dos dispositivos o en el mismo dispositivo.

**No es un bug: el mecanismo nunca existió.** Medido: no hay `deviceId`, ni `heartbeat`,
ni nada. Los dos dispositivos **juegan a la vez** contra `users/{uid}` y `saveToFirebase()`
escribe el estado **completo** cada 15 s, así que **se pisan sin error y sin aviso**. Lo
más grave: **la Ascensión paga con núcleos y borra las nanitas**, así que dos reinicios a
la vez pueden dar un reinicio por 0 núcleos.

**DECIDIDO: negarse a entrar, no expulsar al otro.** Nadie pierde su partida. La otra
sesión sigue viva hasta que se cierra sola y quien intente entrar recibe un mensaje que
**dice qué hacer** ("ya tienes la partida abierta en otro sitio" sin más es un callejón).

Dos detalles de la forma que hay que decidir al escribirlo: el latido se mira al arrancar
**y otra vez cuando expire**, para no tener que recargar a mano. Y el caso de **dos
pestañas en el mismo dispositivo** —que es el raro pero el que más gente se va a
encontrar— se resuelve con `sessionStorage` en vez de `localStorage`: cada pestaña tiene
su id y no hay que tratarlo aparte.

### F24 · La forja: quitar material y poder desequiparlo — HECHO

> Al tocar un item me toma como si cargué los 3. No puedo desequipar material que ingresé en la forja.

**1 · "Me toma los 3": era la vista mintiendo, y el motor lo aceptaba.** Tocar el
mismo item tres veces lo ponía en las tres casillas, y el motor contaba posiciones, no
materiales: se "fusionaba" uno solo y salían dos, ahorrándose dos materiales. **Arreglado
en los dos sitios:** la vista no deja subir un id repetido al yunque, y el motor rechaza
`new Set(ids).size !== 3` **antes** de gastar piedras —un rechazo después del cobro se
llevaría los consumibles sin forjar nada. `stateCheck` (+3).

**2 · "No puedo desequipar": ya existía.** Cada casilla del yunque es un botón de quitar
(`data-act="clear"`, con su "Quitar X" para el lector de pantalla), y la selección nunca
sale del almacén: quitar es desmarcar, no devolver nada. El aviso del duplicado además
dice dónde está el quitar. La parte visual se mira en `preview.html`.

### F25 · El mercado va primero, porque siempre lo confundo

> Mover el mercado al primer segundo amor porque siempre lo confundo.

Lo más barato de la lista. Solo hay que decidir **cuál** es el mercado: si es la pantalla
de venta del almacén o una sección aparte, porque "primer segundo" significa otra cosa en
cada caso. Es una línea de orden en el array de navegación, y no necesita banco: es
posición en un array.

### F26 · El cristal tiene que ser del mismo tier del item, estrictamente — HECHO

> Arreglarlo para que necesite cristales del mismo tier del item que estoy mejorando estrictamente, y que la progresión se mantenga como está ahora para que haya fallo.

**HECHO, y no se podía hacer antes que F31.** El orden importa y es el que no vi al
escribir esto: la regla estricta necesita cristales del 1 al 10, y la caja que los suelta
no existía. Aplicarla sola habría convertido el T8 **en un muro**, no en contenido
inalcanzable. Las dos van en el mismo commit porque el estado intermedio no era jugable.

Ahora `upgradeEquippedCollector()` **no recibe el nivel del cristal**: lo deduce del tier
del recolector. No es un valor por defecto ni un parámetro que la vista pueda mandar, así
que la vista no puede proponer un cristal distinto del que se va a gastar (R3). El
selector dejó de ser una lista con dos opciones: es **una fila**, la que tienes o la que
te falta, y dice de qué caja sale.

Lo que de verdad arregla no es la comodidad: es que **el cristal deja de ser un
multiplicador suelto y pasa a ser la llave de la progresión**. Si el T8 exige cristal T8 y
el cristal T8 sale de las cajas T8, abrir cajas deja de ser opcional.

**Y un techo declarado en vez de una regla más blanda:** un T por encima del 10 no se
puede sintonizar, y el juego lo dice ("necesita el Cristal T12, y el más alto que existe
es el T10"). Es lo que produce la forja infinita, y degradar F26 para que un T30 se
subiera con un cristal T1 sería deshacer la regla entera. Ver **F36** para cerrar eso.

### F28 · La ruleta va demasiado rápido en el navegador — RESUELTO (era el navegador)

> En el navegador la ruleta se ejecuta muy rápido, en celular anda bien. A lo mejor con un delta time.

**No era el juego.** Las dos ruletas usan **CSS con duración fija** (`transform 5200ms` y
`forgeSpin 1.9s`), no cuentan frames, así que el frame rate no puede hacerlas más
rápidas: un monitor de 144 Hz no cambia nada. El diagnóstico que estaba aquí era falso y
se queda escrito porque es justo el error que se iba a implementar sin medir.

**Lo que sí se encontró mirando:** con `prefers-reduced-motion: reduce` activo —que es un
ajuste del sistema o una extensión— la transición se anula entera (`transition: none` y
duración `1e-05s`), que se ve como una ruleta que "va demasiado rápido" porque salta de
golpe. Es la misma cuenta que ya hace `spinTrack` a propósito, por R20. Si vuelve a pasar,
es mirar ese ajuste antes que el código.

### F29 · Los núcleos van al ranking como pestaña nueva, y no como puntos

> Agregar al ranking núcleos adquiridos como nueva pestaña. No mostrar en base a qué se ganan puntos, que sea un cálculo interno; la adquisición de núcleos va a afectar a la nueva fórmula.

**DECIDIDO: los núcleos entran en el cálculo del definitivo Y llevan pestaña aparte.** Las
dos mitades, no una: puntúan y además se ven. Si solo contaran puntos, enseñar el desglose
sería una comodidad.

Es coherente con que el núcleo sea **la única cosa que no se pierde al reiniciar**: si
vale puntos, reiniciar es una decisión rentable, que es justo lo que un incremental
quiere. Y aquí no hay decisión de privacidad: un número de núcleos es "cuántas veces has
reiniciado", no tu saldo.

**Lo de "que no se vea en qué se ganan puntos" es lo que hay que hacer con más cuidado**, y
no por visibilidad: ahora el ranking **enseña una fórmula** —"logro pesa 50.000, y uno
secreto 250.000"— y quien lo sepa optimiza **la puntuación** en vez de **la partida**.

**Y el formato de la pestaña:** desglose, no un número suelto. Pero **solo desde arriba**:
"núcleos: 12" sí; "núcleos 12 × 340 = 4.080 puntos" no. Es el criterio de la ficha de la
caja: enseña **qué** es, no cuánto costó.

### F30 · Al pasar de 99 hay que generar otra pila

> Al comprar más de 99 llaves se tiene que generar otro stack en el inventario. Lo mismo con los cristales, checkear los apilables en general.

Tu diagnóstico es correcto sobre lo que ves y hay que corregirlo sobre lo que pasa. **No
se pierden llaves**: `MAX_STACK` es un **tope de pintado**, no de almacenamiento, así que
comprar 150 llaves deja la esquina en 99.

Dos preguntas, y **solo una es un bug**:

1. **¿Se pierden al pasar de 99?** `stackCheck` lo comprueba hasta 19 unidades y dice que
   no. **Con 150 no está comprobado** — el banco se detiene en 19 — y ese es el número que
   hay que probar antes de dar esto por cerrado.
2. **¿Es correcto ver 99 cuando hay 150?** **Aquí tienes razón**, y es R3: lo que se ve no
   es lo que hay. La solución obvia es **"99+"**, o enseñar el número de **pilas**.

**Y "checkear los apilables en general" es la parte que más valor da**, porque `MAX_STACK`
son **cuatro números escritos a mano** y el criterio se repite en **tres** sitios, que
pueden discrepar. Lo que hay que hacer es **una función de apilado** que decida el tope, el
desglose y el número pintado, y que las tres vistas llamen.

### F31 · La tienda solo vende tier 0; los siguientes, por fusión o cajas — HECHO

> Reestructuramos el sistema para que de la tienda solo se puedan comprar los tier 0 y mediante fusión o cajas se puedan comprar los siguientes tiers.

**HECHO: hay una caja por tier, y la tienda solo vende la T1.**

Lo que sale de la tienda: **la caja T1 y las diez llaves**. Lo que se va: **las veinte
cartas de tier** (de 900 a 193.850) y las tres cajas altas. Es el mayor recorte de
contenido del lote, y es correcto: mientras la carta del T8 esté a la venta, las cajas no
son necesarias.

Y funciona por una razón que no era la que yo temía: **la puerta es la caja, no la
llave**. Comprar la llave T9 sin tener la caja T9 no es tirar el dinero, es tenerla
guardada — la T9 llega abriendo la T8. Por eso las diez llaves siguen a la venta.

**La caja T{n} suelta, por construcción:** el cristal T{n} (F26), su llave, un compañero
T{n}, un recolector T{n} sobrecargado desde la T3, la caja T{n+1}, un salto a T{n+1}, un
expansor, y las piedras desde la T6 y la nanopartícula desde la T8.

**Y EL NÚMERO DE TABLAS ES UNO.** Antes había cuatro tablas de botín escritas a mano, que
era exactamente la causa de B6: cuatro copias de "cada caja suelta su llave" que se
separaron en el primer rebalanceo. Ahora hay **una función** (`botinDeCaja`) y diez cajas
que la cumplen, así que añadir una undécima es tocar una línea y no escribir doscientas
líneas buscindo por qué la T6 no suelta cristal T6.

**Cosas que se encontraron al hacerlo y no estaban previstas:**

- **Seis de las diez cajas anunciaban un cosmético que no existe.** El catálogo reparte
  nueve cosméticos entre cuatro cajas, y la entrada `cosmetic` estaba en las diez: seis
  ruletas pintaban una casilla que nunca salía. Con cuatro cajas no se notaba porque las
  cuatro tinham catálogo. Ahora la entrada se pone sola donde hay catálogo, y `lootCheck`
  ata las dos direcciones.
- **La fila de llaves de la caja T9 salía menos de una vez cada 400 aperturas.** Compitía
  por la rareza de la llave (Divina) en vez de por la de la caja, con un peso de autor de
  10 dentro de una bolsa de 1/150. La cadena de cajas depends de que cada caja devuelva
  su llave, así que un peso que la hace casi inalcanzable no era un desajuste de balance:
  era la cadena rota por el otro lado. Lo mismo con los expansores y con las piedras.
- **La caja T10 no tiene salto.** No hay peldaño por encima del final, así que su tabla no
  incluye la entrada `up` — en vez de incluirla y devolver un T10 siempre, que es un
  premio garantizado disfrazado de sorpresa. `saltoCheck` lo ata.
- **`inferCrateType` devolvía `legendary` para cualquier nombre que no reconociera**, o
  sea que un item de caja con el nombre corrupto se proponía como la mejor caja del juego.
  Ahora devuelve `null`.
- **La caja T1 baja de 500 a 450.** F31 quita veinte cartas y subirle el precio a quien
  está en el primer minuto sería cobrarle el recorte. El par caja+llave pasa de 750 a 675.
- **`src/components/crates.ts` se ha borrado.** Estaba muerto desde hacía tiempo (AGENTS.md
  ya lo marcaba como vestigial) y usaba `state.crates.common`, así que con diez niveles
  habría mostrado `undefined` en cuatro tarjetas si alguien lo hubiera importado.

**Lo que sale bien, medido:** con 2 materiales por forja, un T10 por forja sale 2,4× la
carta y un T25 cuesta 15 billones. **El final lo pone la aritmética, no un tope.**

### F32 · A partir del nivel 10, fallar puede restar 1 o 2 niveles

> A partir por ejemplo de la mejora 10 de las armas, al fallar haya probabilidad de bajar de nivel 1 o 2 niveles, para hacerlo más entretenido y difícil de subir.

**Hoy fallar no cuesta nada.** El nivel se queda igual, y hay una prueba que lo comprueba.
O sea que a partir del nivel 10 **subir es gratis en el peor caso**, y eso es lo que hace
que el tramo alto sea aburrido: no es difícil, es **gratis**.

**Lo que obliga a decidir, y es más importante que el número:** tu respuesta a F26 deja el
cristal multiplicando **probabilidad de acierto**, así que la sintonización **sí puede
fallar** y F32 tiene dónde aplicarse. Si algún día el cristal pasa a medir "cuánto
progresa", la sintonización deja de ser un azar y **F32 se queda sin sitio**.

**Y sale un aviso que no es tuyo:** si fallar puede restar niveles, **el botón de
"restaurar" se vuelve imprescindible**. Quien pierda 2 niveles en un T10 y los recuperó en
40 minutos de cristal va a dejar de tocar la forja. Con eso, perder 1 es aceptable y
perder 2, no.

Tres números por decidir: **¿dónde empieza?** (10 es el correcto: por debajo sería
demoledor, y `collectorMaxLevel` va a 20 y a 35 con 5 estrellas, así que el 10 es donde
empieza el segundo tramo). **¿Cuánto?** (-1 lo normal, -2 raro, y el -2 subiendo con el
nivel). **¿La probabilidad de fallo sube con el nivel?** Ese es el número que balancea el
tramo alto.

### F33 · La forja es el camino a los items perfectos — HECHO (`58d5a4e`)

> Si los items de tier 1 que mezclo están al máximo, su mezcla va a ser un tier 2 al máximo. [...] Una cosa es el nivel del objeto y otro "qué tan bien salieron los stats" [...]. Si los dos están al máximo, el tier nuevo está al máximo, pero el nivel es 0 y se pierde la subida por cristales. Y la forja debe pedir **dos** items del mismo tier, no tres.

> **HECHO. La regla es una sola y son tres cosas a la vez:** el item lleva un
> **potencial 1..5** que **es** lo que decide su daño dentro del rango de su tier
> (`danioDeRango`, con 1 en el mínimo y 5 en el máximo exacto), la **tienda y las cajas
> lo tiran**, y la **forja promedia los dos materiales**. Se quitó también el multiplicador
> de daño por potencial, que haría que el mismo número contara dos veces.
>
> **Lo que esto arregla:** un item forjado salía siempre en el punto medio del rango, ni con
> materiales perfectos. Buscar los buenos era tiempo perdido porque daba igual lo que
> metieras. Ahora dos perfectos dan un perfecto y uno flojo baja el resultado.
>
> **La consecuencia que hay que tener presente, porque es diseño y no un detalle: promediar
> nunca sube.** Un 5 sale de un 5, así que **la perfección se consigue en la tienda y en las
> cajas, y la forja es la que conserva la que ya tienes.** Eso es lo que hace que las dos
> vías compitan en precio y no en resultado, que es justo lo que pedía F33.
>
> **Y la receta es de 2 materiales sin devolución**, que era tu decisión. El precio no se
> mueve (2ⁿ por tier). Se quitó la devolución de 1 porque con 2 materiales el coste neto
> caía a 1 y la forja quedaba casi gratis; de paso la valoración tratando los 3 como
> gastados cuando solo se cobraban 2 era R3 roto, y al quitarla la densidad se calcula
> exacta.
>
> **Un dato que cambió y hay que mirar jugando:** la forja antes perdía valor total en los
> tiers bajos y ahora **gana en todos** (márgenes por ranura de 2,5x-4,6x a 2,1x-5,8x). Si
> en una partida se ve que solo conviene forjar y comprar nunca, el número a tocar es el de
> aquí, no el del resto.
>
> Pruebas: `stateCheck` 232 → 241.

**Corrección importante: hay dos cosas distintas y se me habían mezclado.** El **nivel**
(0-20, o 35 con 5 estrellas) sale de **cristales**. El **stat** (dónde cayó dentro del
rango de su tier) sale **al generarse, al azar**. **Lo que se hereda es el stat, y el nivel
a 0 es lo que se quiere.** Eso hace que **F26 y F33 sean el mismo bucle**: la forja da el
mejor stat y la sintonización da el nivel.

**Hoy los items forjados no tiran dentro del rango. Nunca.** Salen siempre en el **punto
medio**: `baseDamage = (min + max) / 2`. Un T10 forjado sale en **466** mientras uno de
tienda puede caer en **559**. O sea que **el mejor item forjado es PEOR que uno de tienda
tirado con suerte**, que es lo contrario de lo que pides. Lo único que hoy mueve al forjado
es la rareza de los materiales.

**Lo que hay que añadir, y es una tirada con entrada:** la posición de cada material
dentro de su rango (0..1) se promedia, más un plus de forja, y eso se proyecta sobre el
rango nuevo. Con los dos materiales al máximo el forjado cae en el máximo. Con uno al 30%
y otro al 80%, en el ~55%: **mezclar es promediar, y por eso vale la pena buscar los
perfectos**.

**Y el plus de forja es lo que hace que promediar no sea una trampa:** si dos materiales
perfectos dieran exactamente el máximo, nunca rechazarías un material bueno y buscar los
perfectos dejaría de ser una decisión. El plus tiene que poder **compensar** un material
flojo, para que la pregunta sea "¿me vale esto o busco otro?".

**El otro cambio, que es el que arregla el precio: DOS materiales en vez de tres.** Pedir 2
no es ergonomía, es **la mitad del exponente**: con 3, un T10 por forja cuesta **91×** la
carta y nadie lo usa; con 2, **2,4×**, y a cambio das el mejor stat posible del tier.

**Y qué da cada vía, que es lo que realmente lo aclara:**

| Vía | Qué da | Cuánto cuesta |
|---|---|---|
| **Caja** | El **máximo × 1,25** — o sea, el mejor item del tier | Una caja y su llave |
| **Forja** | El máximo, y **decides tú cuáles son tus dos mejores** | 2ⁿ materiales |

**Lo que hace la forja no es "conseguir un item mejor", es "conseguir el item que
quieres".** La caja es la lotería buena y barata; la forja es la que elimina la lotería.
Y esa es la razón por la que se va a usar aunque cueste 2ⁿ: no es que la caja no pueda
darte un T8 perfecto, es que **la caja no puede darte el T8 perfecto que tú ya tienes en
la cabeza**.

### F35 · Las dos vías, y los dos topes tienen que ser coherentes

> Los items de tier se pueden mezclar en la forja para hacer un tier superior. Los cristales son de tier 1, 2, 3 … máx. Y obtengo los máximos de mezcla **y** de cajas.

Es la aclaración de F33 + F31, y su advertencia vale por sí sola: **los items pueden ser
de tier infinito y los cristales tienen tope**, así que **un item por encima del máximo de
cristal es un item que no se puede subir de nivel nunca**.

Eso es una decisión de diseño y funciona —el stat alto sustituye al nivel en el tramo
final—, pero hay que **decirla**: un jugador que llegue a un T30 verá que no puede mejorarlo
y no sabrá por qué. La respuesta tiene que estar en la ficha: "necesitas cristal T30"
cuando el cristal T30 no existe.

**Los dos topes tienen que ser coherentes entre sí.** Resuelto en F36: los dos en 30, así
que **no hay ningún tier muerto**.

### F36 · Los tres números que quedaban — PARCIAL

> Delegados ("sí"). Van aquí con la cuenta, para que se puedan cambiar sin volver a razonarlos.

1. **TOPES: items hasta el 30 y cristales hasta el 30. Cohesentes.** El final lo pone el
   precio, no un tope. Un T25 cuesta 15 billones y un T30 **483 billones**: el juego puede
   decir "tiers infinitos" porque **la forja no rechaza ningún tier**, pero nadie llega al
   25 por la forja. Y los cristales llegan al 30 porque, si no, habría veinte tiers
   **imposibles de mejorar**. El trade-off es real y es bueno: un T30 sin nivel es **más
   débil** que un T10 con nivel, así que el final es elegir entre bajar a lo que puedes
   nivelar o quedarte arriba con el stat y sin niveles.
   **Y aquí está el número que hace que 30 sea 30:** el techo de forja del 75% empieza en el
   T20. Si el tope fuera 25, **el tramo donde falla la forja sería el tramo final**. Con 30
   hay un tramo entero (25-30) donde la forja es segura pero carísima.
2. **CRISTALES: uno por tier, 30 niveles, sin bandas.** Sin bandas porque la regla estricta
   de F26 no les deja sitio: una banda obligaría a que un T7 pudiera usar cristal T8, que es
   justo lo que pediste evitar. Los 10 nombres que ya existen conservan nombre y
   multiplicador, y **el multiplicador se queda en cuatro escalones** —si creciera sin
   límite, **el 75% de la forja se rompería en los tiers altos**, que es precisamente lo que
   se pidió.
   **LO HECHO (con F26): hay un cristal por tier del 1 al 10, con nombre propio y sin
   bandas**, y la caja T{n} suelta el cristal T{n}. **LO QUE FALTA: del 11 al 30.** Un
   recolector por encima del T10 se puede forjar pero **no se puede sintonizar**, y el juego
   lo dice en vez de degradar la regla. Es el hueco que deja la forja infinita, y es el
   único sitio donde el juego admite un techo.
3. **LA FORJA.** ~~Llega a T10 y no más~~ → **ANULADO por la decisión de forja infinita**
   (ver F34 y el commit `d5daee3`). El argumento era "si la forja llegara más lejos que la
   caja, dejaría de usarse", pero **la caja da el máximo ×1,25 y la forja da el máximo que
   tú eliges**, así que compiten en precio, no en resultado, y compiten bien. **El techo lo
   pone el 2ⁿ de materiales.**

### F37 · La forja sintetiza items, y el item sale con un bonus con nombre

> Agreguemos que la forja pueda sintetizar items, lo cual me va a otorgar el bonus como por ejemplo "baluarte" del item

**"Baluarte" ya es un afijo, y hay catorce como él.** `AFFIXES` tiene 14 afijos, y el
tercero es `aff_bulwark`: *"Baluarte — +60 de daño plano"*. Y el sistema está **montado y
vivo**: un recolector forjado hereda 1 a 3 afijos según su potencial, el motor los suma al
daño y la ficha los enseña por su nombre. O sea que **eso ya se puede ver hoy**.

**Lo que no existe es que tú lo elijas.** `pickAffixes()` los sortea con pesos inversos a la
rareza. Así que hay dos lecturas: **"que salga con un afijo"** (ya está) y **"que yo elija el
afijo"** (no está, y es una decisión de diseño de verdad).

**"Que la forja pueda sintetizar" tiene tres lecturas y solo una es nueva:**

| Lectura | Estado |
|---|---|
| (a) Unir items para subir de tier | **Ya existe**: la fusión de `attemptForge()`. Y F33 ya decidió que sean **dos** materiales |
| (b) Forjar también **compañeros** | **No existe**: `forgePage.ts` filtra `type === 'collector'`. **La mitad de los items del juego —los compañeros, los que generan el ingreso— no se pueden forjar** |
| (c) Fabricar desde material base, sin item previo | **No existe**: la forja solo acepta recolectores enteros |

**Yo leo que es (b) o (c)**, porque si fuera (a) estarías pidiendo algo que ya se puede
hacer. Si es (b), es la más limpia y encaja con F31: si el tier se sube por forja y solo
hay un camino, los compañeros se quedan fuera del sistema.

**Va después de F33 a propósito** (mira el plan) y hay que decidir si la síntesis es **una
vía más** (una pestaña al lado) o **una alternativa** (el mismo yunque, otro botón),
porque cambia cuántos afijos puede llevar un item y eso lo decide `pickAffixes`.

### F19 · Los logros de las cajas son un item que hay que usar

> Los logros que salen en las cajas son un item que tengo que usar para que me dé el logro. Esto es así porque más adelante se va a poder tradear.

**Cambia el modelo entero de logros, no es un ajuste.** Hoy un logro se cumple solo, y por
eso existe uno de "Cien cajas. Ni una más." Con esto, **la caja te da un item y el logro
llega cuando lo usas**: alguien más puede pasártelo y lo desbloqueas tú sin abrir 100 cajas.

**El motivo que das —el intercambio— es de peso, pero tiene un coste:** un logro se puede
**tirar**, y eso hay que decidirlo de verdad. Si se puede regalar, alguien puede regalar
logros que no quiere, y el perfil y el ranking dirán cosas distintas de lo que el jugador
hizo (un logro pesa 50.000 puntos, y uno secreto 250.000).

Dos decisiones antes de escribir: **qué pasa con el item si ya tienes el logro**, y si los
logros **seguros** son tradeares o solo los de caja.

### F20 · Elegir imagen de perfil

> Permitamos elegir una imagen entre varias 5 a los jugadores en su perfil. Son como iconos, se pueden desbloquear o comprar en un pack aleatorio, y **algunos salen en logros**.

**El sitio ya existe pero no guarda nada:** `identityCard()` monta tres capas y el centro son
**las dos iniciales del nombre**. El hueco para la imagen está ahí.

**Encaja con el sistema que ya hay:** es un cuarto tipo de cosmético al lado de título, marco
y banner, y ya están las cuatro piezas que hacen falta (`COSMETICS_BY_TYPE()` para la
rejilla, `unlockCosmetic()`, `rollCrateCosmetic()` y los logros de caja). Lo que **no**
existe y hay que añadir: el **"pack aleatorio" como producto comprable** y la **fuente de
los logros**.

**Un aviso de privacidad, porque esto va justo donde B8 y no lo resuelve por accidente:** una
imagen de perfil es lo primero que se ve de un jugador en el ranking, y es **lo primero que
hay que poder leer de un documento ajeno**. La arquitectura correcta es que viaje en el
documento **público** de la identidad —el mismo donde irá la tarjeta de B8—, no en el
guardado privado.

### F21 · Los logros de caja necesitan un nombre y no un "???"

*(Sale de F19.)*

Los dos secretos (`ghost` y `hidden`) se llaman `???` con la descripción "Un logro que
nadie te pidió completar." Si van a ser **items que se usan y se traded**, un logro sin
nombre no se puede ni buscar, ni regalar, ni revelar. Y **la fecha de revelación** —al
recibirlo, al usarlo, o al intentar usarlo dos veces— es una decisión, y es buena: es el
momento que hoy no existe.

### F22 · Sin poder comparar, media lista es trabajo a medios

*(No es una petición del lote: es la consecuencia de hacerlo todo, y está aquí para que no
se pierda.)*

Si se pueden abrir cajas en lote (F18), ver el perfil de otro (B8), llevar un avatar propio
(F20) y tener logros que se regalan (F19), **el juego se vuelve competitivo y no hay
ninguna forma de comparar tu partida con la de otro**: el ranking solo da una puntuación
compuesta.

Con los bancos que ya hay sale casi gratis: los 24 bancos miden precios por tier, progresión
y curvas. Lo que falta es una vista de la partida de un jugador —su mejor recolector, sus
compañeros, su árbol— con la tuya al lado.

---

## Bugs abiertos

### B8 · No hay forma de ver el perfil de otro jugador

> Al tocar en el nombre de un jugador quiero entrar a su perfil y ver su panel principal y sus estadísticas actuales.

**No es un bug: es una regla de Firestore, y por eso es una decisión y no un arreglo.**
`users/{uid}` **solo lo puede leer su dueño o un admin**. El ranking es legible por
cualquiera, así que la fila te da nombre, título, logros y puntuación — todo lo que está en
`rankings/{uid}`— pero **el panel principal y las estadísticas no están en ninguna colección
pública**: viven en el documento privado.

**Lo que hay que decidir:** o se publica una **tarjeta pública** nueva, o se abre
`users/{uid}` a lectura. La segunda es un cambio de privacidad de una línea y **no la
recomiendo**. Con la primera no hay problema de seguridad: es un documento que el jugador
escribe con lo que decide enseñar. De paso le daría en qué apoyarse a **F20**, porque la
imagen de perfil es justo el dato que hay que poder leer de otro.

**Es el único bug abierto del juego.** Todos los demás están cerrados y con banco.

### B11 · En el celular no se puede cerrar sesión ni cambiar de theme

> En celu no puedo cerrar sesión ni cambiar de theme.

**Tu respuesta ya lo:visto: el botón NO ESTÁ.** Eso descarta el caso de "está y no responde"
y deja uno solo: **no hay camino hasta él en móvil**. O el control se pinta en un sitio al
que no se llega, o directamente no se pinta.

Y hay un dato del propio código que encaja: el panel de tema es `lg:hidden`, o sea que el
**contenedor** está pensado para móvil, pero el **botón que lo abre** puede que sí viva en
la cabecera de escritorio. **El disparador del panel tiene que existir en las dos
versiones.**

**Lo que hay que buscar, en este orden:**

1. **El disparador** de `theme-sheet`. Si está dentro de un bloque `hidden lg:flex`, ya está
   encontrado.
2. Lo mismo con **cerrar sesión**: si vive en el perfil o en un menú desplegable, ese es el
   que hay que replicar en la versión móvil.
3. Y una decisión de fondo: **cerrar sesión siendo invisible en el móvil es un problema de
   confianza, no de layout**. Si el jugador no puede cerrar sesión, no puede dejar de jugar
   en el móvil. Eso no se arregla solo moviendo un botón.

---

### Lo que salió del Lote 1 y no estaba en el encargo

- [x] **Dos pruebas que fallaban solas, por culpa del azar.** Found while running the suite
      three times. `loteCheck` pedía que de 20 cajas T1 saliera alguna T2, y el peso del salto
      en una T1 da menos del 5 % por apertura: hay un camino real a cero Tiradas. Y
      `sellCheck` pedía que **no quedara ninguna caja** en el almacén después de abrir una,
      cuando el botín puede soltar cajas **por diseño**: el almacenamiento estaba bien y lo
      mal escrito era el recuento. **Las dos ahora miden la regla, no una tirada.**
      Una prueba que se cae sola es peor que no tenerla: entrena a ignorar el banco entero, y
      el día que algo se rompa de verdad nadie va a mirar si era el código o la suerte.
      _Las dos se caían **antes** de este lote; comprobado con `git stash` sobre el código
      original, 1 fallo en 4 corridas._
- [x] **Cuarta prueba intermitente, y era la peor de las cuatro: apoyada en un temporizador.**
      `playthroughCheck` mutaba el estado —equipar un compañero, comprar una llave— y
      recargaba a secas. Recargar lee el documento **tal y como esté**, y lo anterior todavía
      no había llegado al servidor. Lo que tapaba eso era un accidento: el juego programaba un
      `setTimeout(saveToFirebase, 1200)` al arrancar que **se disparaba siempre** (G6 lo
      arregló) y volcaba la partida por el banco sin que nadie lo supiera. Al quitarlo,
      `playthroughCheck` empezó a fallar solo y de vez en cuando. Hay `recargar(g)` en `kit.ts`
      para que la disciplina quede en un sitio.
- [ ] **El resto de bancos que mutan y recargan tienen el mismo agujero.** Solo se han
      arreglado los de `playthroughCheck`. **`reload()` a secas sigue siendo una trampa** y
      cualquiera que la use después de cambiar algo está midiendo la partida anterior. Cuando
      se toque un banco, esta comprobación es lo primero que hay que hacer, no el último.
- [x] **Cada carga de página programaba un guardado inútil, que se colaba en medio de todo.**
      `if (hayPendientes(uid)) setTimeout(saveToFirebase, 1200)` se comprobaba **después** del
      guardado de carga, y ese guardado acaba de anotar la cola: la condición **era cierta
      siempre**. Ahora la pregunta "¿venía cola de la sesión anterior?" se hace **antes de
      cargar**, que es cuando es verdad. Consecuencias: una escritura de sobra en cada carga,
      y un temporizador de 1,2 s que nadie había pedido cayendo entre dos pulsaciones del
      jugador y guardando el estado a medias.
- [ ] **Quedan bancos que tiran dados.** `potencialCheck`, `saltoCheck`, `botinCheck` y el
      resto hacen tiradas reales. No he desmontado todas. **El patrón a seguir es el de G3:
      medir pesos y tablas, que son deterministas, y dejar las tiradas para lo que de verdad
      solo se puede comprobar tirando** —y entonces, muchas veces, no 20 sino las que hagan
      falta para que la probabilidad no deje hueco.
- [x] **Tercera prueba intermitente, y era una carrera, no una tirada.**
      `playthroughCheck` recargaba sin forzar el guardado, así que leía el documento que
      hubiera en ese momento. El `setTimeout(1200)` del arranque —el que sube la cola
      heredada— se colaba en mitad del bucle de clicks y guardaba 13 de 20: el documento
      tenía 104 en vez de 160. **La prueba pasaba por suerte según cuánto tardara el bucle.**
      Ahora vuelca y espera antes de recargar. _Salió porque subí el daño del Blaser de
      partida de 5 a 8: no la rompió G4, la destapó G4.
- [x] **Cada arranque programa un guardado que no hacía falta** _(salió de lo anterior)_.
      La pregunta se hace **antes de cargar**, en `habiaColaAlArrancar`, y el `setTimeout`
      usa ese valor ya copiado. Antes se comprobaba `hayPendientes(uid)` junto al
      `setTimeout`, o sea después del guardado de carga, que ya había anotado su propia
      entrada: la condición **era cierta siempre** y cada carga de página disparaba una
      escritura a Firestore 1,2 s después de abrir para guardar lo que ya estaba guardado.
      No rompía nada —es idempotente— pero era tráfico de sobra, y era lo que se colaba en
      el bucle de clicks. **La casilla se quedó abierta porque el arreglo ya estaba y nadie
      volvió a esta lista.**

### G4 · Balance · ESTA MIGRACIÓN SUBE EL DAÑO DE LAS PARTIDAS VIEJAS

**No es un detalle técnico y por eso está aquí, no en un commit.**

La escala de potencial (F33) subió la base de cada tier un 20 % sobre el mínimo del rango
viejo, y el potencial la multiplica hasta ×2. El efecto es que **el suelo nuevo está
por encima de toda la escala vieja**, y no en un tier suelto:

| | rango del item viejo | escala nueva |
|---|---|---|
| T1 | 5 – 7 | 6 – 10 |
| T3 | 13 – 19 | **28** – 46 |
| T5 | 34 – 50 | **95** – 190 |

Al cargar, un recolector viejo de T5 con daño 40 se queda en **95**: más del doble. Y
como `danioDeRango(tier, potencial)` es lo que manda, es un cambio real, no de pantalla.

**Se acepta**, porque la alternativa es peor: un item con ★3 pegando como un ★1 es un
item donde **las estrellas mienten**, que es lo que el jugador pidió arreglar. Pero es una
decisión tuya y es reversible en un sitio: **`potencialYDanoDe()`**, en
`src/data/crafting.ts`. Si algún día molesta, se cambia esa función y ya está — está
fijado por una prueba (`potencialCheck`, comprobación C) para que nadie lo descubra
demasiado tarde.

**Lo que NO hace la migración, y es lo importante:** no toca el poder de los compañeros,
porque el poder del compañero *es* la posición en el rango y no hay forma exacta de
deducir un potencial de un número suelto. A un compañero viejo se le da ★3 —que es lo
que ya se leía— y **su poder se queda como estaba**. Tocarlo sí le cambiaría el ingreso
a alguien, y eso una migración no puede hacerlo.

---

## Ideas sueltas y descubiertos

_Cosas que no son peticiones tuyas pero que aparecieron haciendo otra cosa, para que no se
pierdan. Cuando toque, se suben a Features._

- **Con tarjeta AFK activa y AFK por inactividad a la vez, el contador dice +0/s mientras
  el ingreso sigue entrando.** `updateUI` apaga el número con `isAfk && !hasPassiveBuff`,
  pero el tick solo corta con `isEffectivelyAfk`, que además descuenta `hasAfkBuff`. Es la
  divergencia de "el número que se enseña no es el que se cobra" con otro disfraz, y **el
  cartel de B10 lo hereda** (usa la misma expresión a propósito). Cuando se toque ese panel,
  la expresión buena es la del tick.
- **El MOCK de `preview.html` (`totalCores: 61`, 412 M producidos) siempre cae en la rama
  "ya puedes reciclar".** La rama del faltante no se puede mirar en el preview sin tocar el
  MOCK.
- **La caja épica no soltaba ninguna llave** — eso no estaba medido y apareció al arreglar
  B6. Si el diagnóstico de una escalera dice "dos peldaños rotos", mira el tercero.

---
- **Una rareza con UNA sola entrada se lleva el 100% de su bolsa, y eso es una trampa
  que ya mordió dos veces.** El reparto de botín era por bolsas de rareza, y con las cuatro
  cajas de antes cada bolsa tenía tres o cuatro entradas. Con una caja por tier (F31) **todas
  las entradas de la caja tienen la misma rareza**, así que la tabla generada dejaba las
  nanitas **solas en la bolsa Común** y la caja T7 daba **92,45% de nanitas** y 0,74% a cada
  premio de verdad. La caja alta era un regalo de nanitas, y **ningún banco lo cantaba**:
  `saltoCheck` mide el salto y los exclusivos, y el salto conservaba su banda porque tenía
  bolsa propia. **Dentro de una caja manda el peso de autor; la rareza pesa entre cajas.**
  Lo que queda de la rareza —el salto y los exclusivos con bolsa reservada— se sigue
 midiendo, y la escalera se ve en la rareza que anuncia cada premio. Si algún día vuelve a
  meterse rareza en el reparto dentro de la caja, hay que comprobar que **ninguna bolsa queda
  con una sola entrada**.
- **`pilasNecesarias(0, tipo)` devuelve 1, y eso no es un error.** Su pregunta es "cuántas
  pilas necesito para GUARDAR esto" y de cero unidades la respuesta mínima razonable es una.
  Quien la llama preguntando "cuántas tengo que ABRIR" tiene que tratar el cero antes, que es
  lo que hace `planDeEntrada()`. Sin ese `if`, **nada que se sumara a una pila podía comprarse
  con el almacén lleno**.
- **Los bancos que reimplementan el sorteo miden su propia idea del sorteo.** `saltoCheck`
  sorteaba con `e.weight` (los pesos de autor) mientras el juego sorteaba con
  `tablaDePesos()`. Las dos cifras salían bien y no decían nada del juego; cuando el reparto
  cambió, el banco falló por 1,1 puntos **midiendo la tabla equivocada**, no el juego.

## Balance y dificultad

### P1 · Se llega muy rápido a compañeros de tier 6 — ARREGLADO

**Causa:** el precio por punto de poder **bajaba** al subir de tier, porque los precios
escalaban 1,5× y el poder 1,62×. El T10 salía a 38 por punto contra 150 del T1.
**Arreglado:** el coste por punto **sube** con el tier (150 → 416). `balanceCheck`.

### P2 · Se llega muy rápido a recolectores de tier 7 — ARREGLADO

**La misma causa, y aquí era más grave:** el daño real va de 6 a 466 (78×) y el precio de
850 a 17.500 (20,6×). El comentario del código decía "el coste por punto se mantiene entre
170 y 235" y era falso. **Arreglado:** recolector y compañero cuestan lo mismo, porque sacan
el poder de la misma tabla. `balanceCheck`.

### P3 · Los cristales de mejora son muy baratos — ARREGLADO

Subir a nivel 20 costaba 100 cristales, que a 60 cada uno salían 6.000 nanitas: **un 4% del
recolector**. No había nada que decidir, era un botón. **Arreglado:** curva de 1,14 a 1,26
por nivel y el cristal a 200. Nivel 20 cuesta ahora ~47% del recolector. `balanceCheck`.

### P5 · Las cajas ya no dan nanitas: eso cambia la partida y es tu decisión

**Lo que era:** la caja T1 devolvía **9.375-15.000 nanitas** con un par caja+llave de 675.
La caja T10 devolvía cientos de miles. Comprar y abrir cajas era **×14 a ×22**, y por eso
la caja era la única fuente de ingresos que hacía falta.

**Lo que es:** el premio de nanitas es del **25% al 40% del par**. La T1 da **169-270** y la
T10 **36.347-58.155**. Todo lo que salga de una caja, vendido, vale como mucho lo que cuesta
abrla.

**Por qué está así y no más suave:** la regla que pediste es "nada de una caja da más que la
caja y la llave". Cualquier valor por debajo del par la cumple; el 25-40% sale de leer el
rango de autor (250-400) como tanto por mil del par, que es la lectura menos inventada que
respeta el rango que ya estaba escrito.

**Lo que hay que mirar:** con menos nanitas de las cajas, **la forja y la tienda pasan a ser
el ingreso principal**, y el ritmo de la partida sube. Si se te hace lento, el sitio del
tope es este número y no el de la reventa: se cambia un `1000` y está. El banco
`loteCheck` mide que el par no se supera en ninguno de los diez tiers, así que cualquier
valor que pongas aquí sigue teniendo una prueba detrás.

### P4 · Verificar en partida real

**Pendiente de tu lado** (es el nº3 de lo que espera tu respuesta). El banco comprueba que
los números encajen entre sí, no que la partida dure lo que tiene que durar. Para eso hace
falta jugarla: otra partida nueva y decir hasta dónde llegas y en cuánto tiempo.

---

## Hecho

_Lo terminado, una línea y el commit. La cifra viva del proyecto: **32 bancos, 2056**, todas en verde._

### El sistema que se ha quitado entero

- [-] **Las esquirlas, como concepto.** Eran **una moneda sin salida**: la forja se paga
      con dos recolectores, no con esquirlas, así que se acumulaban, se guardaban entre
      ascensiones y no se gastaban en nada. Un contador que sube y una palabra nueva que
      aprender, a cambio de nada.
      **El fallo de forja paga ahora una sola cosa, y es la que se puede gastar:
      cristales.** La cifra de los cristales es la de siempre (`2 + tier` intentos, que el
      motor convierte con `valorDeUnCristal()`), así que **el fallo paga menos que antes**:
      lo que ya no se paga era la moneda muerta. Ese es el coste del cambio y conviene
      saberlo, porque el botín del fallo es el único sitio donde se nota.
      Lo que se conserva es lo que sí tenía sentido: el nodo que multiplicaba el premio
      del fallo. **Conserva su identificador, `shard_sifter`, y eso es deliberado**: es la
      clave con la que su nivel está guardado en cada partida, así que renombrarla le
      quitaría la bonificación de golpe a quien ya la tuviera comprada y dejaría
      inalcanzables los dos nodos que la tienen como requisito (`crate_sight` y
      `afk_extend`). Se llama **"Alcornoque"**, dice "+25 % de cristales por fallo de
      forja" y su bonus es ahora `consolationBonus`.
      Fuera del estado, de la regla, de la franja de estadísticas de la Forja, de la
      píldora de la cabecera, del panel de administración, del listado del admin y del
      texto de la Ascensión. La píldora de la Forja **no se queda vacía**: ahora dice
      cuánto paga un fallo en el tier abierto, que es el dato con el que el jugador decide
      si arriesgar los dos materiales —antes ponía el total de esquirlas, que no era lo
      que se ganaba al fallar—. Y el texto de debajo del yunque, que decía "+N esquirlas
      para el siguiente intento", decía una cosa que no era verdad porque las esquirlas no
      se gastaban en el siguiente intento; ahora dice los cristales que deja el fallo.

      **Y BORRARLO NO ERA SUFICIENTE: HABÍA QUE QUE NO SE QUEDARA EN EL DOCUMENTO.** El
      guardado va con `setDoc(..., { merge: true })`, y con `merge` **lo que no está en el
      objeto no se borra, se queda**. Quitar `shards` del estado y de la lista de campos
      lo deja de escribir, que es esconderse, no borrarse. Ahora el documento incluye
      `shards: deleteField()`, que es el idiom de Firestore para eso, y **se ejecuta en el
      guardado de cargar**, o sea que el rastro desaparece solo la primera vez que se entra
      y el jugador no tiene que hacer nada.
      Las dos pruebas que había —"guardar: esquirlas" y "prestigio: se conservan las
      esquirlas"— afirmaban que un contador de una moneda muerta era parte del juego, así
      que se han ido con la moneda. En su lugar hay cuatro que vigilan la frontera: una
      partida vieja con `shards: 9999` carga igual, el estado no las arrastra, el documento
      las pierde al cargar sin tocar nada y no vuelven al recargar.

### Lo que se ha pedido de la ficha y del almacén

- [-] **Equipar desde el propio bloque de la base, con un selector, y que al tocar uno se
      sutituyan.** Se empezó por el motor y se paró a mitad: `equipCollector()` y
      `equipCompanion()` son **conmutadores**, así que elegir lo que ya está puesto lo quitaría,
      y `equipCompanion()` además **ordena la lista por tier** al insertar, de modo que con
      las ranuras llenas la elección del jugador saltaba de sitio. Sustituir no era solo pintar
      un selector: hacía falta una función aparte en el motor, porque el comportamiento de los
      botones no se puede reusar tal cual. **Descartado a petición del jugador.**

- [x] **Ordenar el almacén por el stat, en DOS ejes y no en uno.** "Recolección por click" y
      "Recolección por segundo" son preguntas distintas sobre objetos distintos, así que son
      dos opciones del mismo desplegable.
      **UN RECOLECTOR DE 30 POR CLIC Y UN COMPAÑERO DE 65 POR SEGUNDO NO SE COMPARAN.** El
      clic se repite mil veces en un segundo, así que ordenando por el número "mayor"
      cualquier compañero iría siempre delante y la lista no diría nada. Por eso cada eje
      **solo ordena lo que se puede comparar** y deja lo demás al final, en el orden que ya
      traían: un `null` no es un cero, es "en este eje no hay cifra".
      **Y EL MULTIPLICADOR NO ENTRA EN EL EJE DE POR SEGUNDO.** Su 1,75 no son unidades, son
      1,75 veces lo de los demás; si se tratara como una cifra más saldría el primero por
      error, porque 1,5 es menos que el 20 del de click.
      El stat sale del motor —`getStatPrincipal()`—, o sea que **el orden es el del número que
      se ve en la esquina de la celda**. A igual de stat, delante el de tier más alto: dos
      recolectores con el mismo daño no son iguales, y sin ese desempate el orden dependía del
      guardado y el mismo almacén salía distinto en dos dispositivos. Todo fijo en
      `filterCheck`.

- [x] **La valoracion sin toggle y con estilo, en LOS DOS sitios donde estaba.** Estaba dentro
      de un `<details>` en la ficha del almacén **y otra vez en el panel del jugador**: la
      segunda se había quedado atrás la primera vez. Un acordeón abierto no aporta nada —la
      flechita solo abre y cierra algo que no hace falta cerrar— y en el panel del jugador
      encima ocupaba la misma altura que uno que no se puede cerrar.
      **Y "ESTÁ TODO PLANO" TIENE NOMBRE:** un desglose en una lista de texto donde cada fila
      es "esto es lo que multiplica" y "por cuánto" pegados en la misma línea. Ahora cada fila
      son dos columnas, la etiqueta a la izquierda y el factor a la derecha y en el color del
      acento, con el bloque dentro de una tarjeta con borde y fondo. Medido: los cuatro
      factores alineados en el mismo píxel.

- [x] **Las estrellas solo para lo que tiene potencial, en la rejilla tambien.** La ficha ya
      las condicionaba y **la celda no**, así que una caja, una llave y una carta salian con
      tres estrellas en la rejilla. Y la causa era la misma en los dos sitios: la función de
      estrellas con un potencial ausente devuelve el valor por defecto, que es tres.
      **Y NO ES SOLO LA CELDA: el listado del panel de administración hacía lo mismo.** Los tres
      sitios donde quedan estrellas miran el tipo antes de preguntar. La Forja, el perfil y el
      panel del jugador los dejan como estaban porque solo pintan recolectores y compañeros.

- [x] **Los companions del mock con potencial y los items tambien.** El `preview` los montaba
      sin potencial, así que las estrellas de la ficha salian del valor por defecto de la
      funcion y no del item. Un banco visual aprobando una pantalla que el producto no tiene.
- [x] **El daño del recolector equipado en dos partes: "30+5".** El 30 es lo que produce el
      item —su potencial, sus niveles y sus afijos— y el 5 son los compañeros, los logros,
      el árbol y los buffs. El "+5" va **más pequeño y más apagado** a propósito: es la mitad
      que el jugador no controla con este item, y del mismo tamaño se leería como la misma
      cifra. **La línea que lo sostiene es una, y la corte más difícil es el afijo:** parece
      del item porque va impreso en él y sale de la forja con él, pero su bonificación solo
      cuenta equipado. Va con el item porque es propiedad suya —si fuera de la partida
      bastaría cambiar de recolector para perderlo, y eso no es lo que pasa—, y hay una
      comprobación que lo fija porque es la fila que más se presta a que alguien la mueva.
      **La base se deduce hacia atrás:** el daño guardado ya lleva el potencial dentro, así
      que si la lista empezara por ahí el potencial no tendría fila propia.
      **Y la valoración se ha ido.** Eran los multiplicadores del PRECIO, debajo de un
      número que es daño: dos grandezas con la misma forma de letra. El precio sigue en el
      botón de vender. Y la línea "Base T2" **vuelve** dentro de la lista del almacén: se
      quitó cuando estaba bajo el daño, y con la lista entera en nanitas ya no hay mezcla.
      Ocho comprobaciones nuevas en `stateCheck`, incluidas las dos que atan cada grupo con
      su parte del número grande.

### Lo que sigue esperando tu palabra

- [x] **B8 · Ver el perfil de otro jugador.** *Decidido por el jugador: sí, y con
      contador de visitas.* Se había escrito que "es privacidad y no lo debe decidir un
      agente"; esa decisión está tomada y lo que se hizo es lo que el backlog ya
      recomendaba: **una tarjeta pública nueva, no abrir el documento privado.**
      - **La tarjeta es `perfiles/{uid}`, un documento que el dueño publica a
        propósito**, y no `users/{uid}` abierto a lectura. La diferencia no es de
        estilo: `users/{uid}` es la partida entera, y publicarla enseña el gasto y el
        inventario de tu competencia. Un incremental no se juega así.
      - **Lo que NO se publica, y por qué:** el saldo de nanitas (es el dinero sin
        gastar; el ranking ya publica el histórico, y con eso hay para compararse), los
        cristales del almacén (el mismo dinero en item, y además dicen cuánto tiene
        guardado sin gastarlo) y el detalle de en qué nodos se gastó cada núcleo.
      - **Lo que sí:** recolectores, compañeros, pasivas pagadas agrupadas por categoría,
        logros, título/marco/banner, y las cifras que se preguntan de cualquier partida —
        producidas, clics, ascensiones, forjadas— más todas las que ya había. En
        pantalla, el orden es el de las preguntas: quién es → qué ha hecho → qué tiene →
        qué ha conseguido.
      - **Los secretos no salen, y el total sí los cuenta.** Si el total fuera solo de los
        publicados, se sabría que a alguien le faltan dos secretos sin llegar a saber
        cuáles. Es el mismo cuidado que ya tenía el ranking, y por el mismo motivo.
      - **El contador que se pidió, con las dos mitades del encargo:** el dueño nunca se
        cuenta —ni al abrir su perfil ni al recargar— y **cada persona cuenta una vez**,
        no una por cada vez que mira. Son dos cifras, `visitas` y `visitantes`, y por eso
        son dos: una cuenta aperturas y la otra cuenta gente.
      - **Las reglas de Firestore lo permiten en una sola línea y solo para el contador:**
        `affectedKeys().hasOnly(['visitas', 'visitantes'])` con `uid != auth.uid`. O
        sea que un visitante puede subir el contador de alguien y **nada más**: no toca su
        colección, ni sus logros, ni la borra, ni su propia tarjeta.
      - **La tarjeta se publica dentro del mismo `if` que el ranking, cada cinco
        minutos.** Publicarla en cada guardado la convertía en media partida de las
        escrituras del juego, que es justo lo que se quitó de en medio hace un commit. No
        comparte firma con el ranking a propósito: la colección cambia por muchas razones
        que no mueven el marcador, y con la mejora automática de recolectores que hay,
        compartirla haría escribir las dos en cada mejora.
      **Lo que necesita el jugador, y no lo hace el código:** publicar `firestore.rules`
      en la consola de Firebase. La colección es nueva y todo lo que no esté declarado cae
      en el `match /{document=**}` que cierra la puerta —**es lo mismo que pasó con el
      latido de sesión**—. Hasta que se publiquen, abrir un perfil da "todavía no tiene
      tarjeta pública", que es la respuesta correcta para un documento que no se puede
      leer.
      **Dos cosas que se encontraron de camino y que ya están arregladas:** una
      `nanitasProducidas` que llegaba como cadena se veía **tal cual en la pantalla** —el
      `coaccionaTarjeta()` repartía el documento entero sin tocar los números—, y las
      clases arbitrarias de Tailwind `[&>span>svg]:w-8` **se veían como texto** en el
      navegador al partir el atributo `class`. Las dos las cazó el banco y la segunda, mirando
      la pantalla.
      **Desbloquea F20 (avatar) y F22 (comparar partidas)**, que dependían de esta
      respuesta.


- [x] **El stat principal va en grande, con su etiqueta al lado y dentro de un borde.**
      Y es **el final**: base, potencial y mejora juntos. Antes la ficha enseñaba el daño
      que el item trae guardado, que es la cifra con la que salió de la caja y **no sube
      con los cristales**: subías de nivel y el número no se movía, y el daño de verdad
      aparecía después, en otro sitio. Dos cifras para lo mismo y la que mandaba no era
      la que se veía.
      **El número no se calcula en la vista.** Sale de `game.getStatPrincipal(itemId)`,
      que compone con las mismas funciones con las que el motor cobra el clic
      (`multiplicadorDeNivel()`) y el ingreso del compañero (`poderEfectivoDeCompanio()`).
      La cuenta del click multiplicaba por el 0,10 **escrito en la línea**, y ahora delega
      en la misma función; la razón no es la elegancia, es que el número grande del
      inventario y el del clic solo pueden ser uno si los dos multiplican igual.
      **Y NO LLEGA A IGUALAR AL CLIC, Y ES LO CORRECTO.** El clic multiplica por el árbol,
      los logros, los afijos y los compañeros; el stat es **lo que el objeto es y lo que
      se le ha subido con cristales**. Si llevara lo otro, cambiar de carta cambiaría el
      stat del item y no habría forma de comparar dos recolectores. Comprobado: con la
      partida de prueba el clic es ×1,3 el stat, y la **proporción es la misma** para los
      dos items, que es lo que dice que las dos cuentas no se han separado.

- [x] **La descripción del item es el stat, no un texto con la cifra dentro.**
      `details` es una **cadena escrita al crear el item**, así que para un recolector
      nunca volvía a coincidir con su daño. Con el stat en grande la ficha tenía **dos
      números distintos para lo mismo y uno mentía**. Para el resto de tipos la línea se
      queda, porque ahí no es una cifra: es la única descripción que tienen.

- [x] **Nivel y barra de progreso en los dos, y en el nivel cero.** Antes la barra era
      solo del recolector y solo si el nivel era mayor que cero, así que un compañero —al
      que los cristales también le suben el nivel— no tenía ni una palabra de progreso.
      Y "Nivel 0 / 20" con la barra vacía dice algo que "no hay nivel" no dice: que existe
      un techo.

- [x] **El stat también en la esquina de la celda, para comparar sin abrir.** Con veinte
      objetos en la rejilla, comparar dos era: tocar uno, acordarse del número, tocar el
      otro. Va en `absolute` arriba a la derecha porque **la celda es cuadrada y ya está
      llena** —icono, nombre y tier— y una cuarta fila la desbordaba. La primera versión
      intentó la fila reservada y todos los altos se fueron a 106 y 120 px.
      **Y LA UNIDAD LA PONE EL MOTOR**, porque aquí se repitió el error: la primera
      versión añadía "/s" a todo lo que no fuera multiplicador, y cualquier T5 salió con
      "84/s" cuando el recolector cobra **por clic**. Dos grandezas enseñadas como la misma.

- [x] **El hover del número grande explica de dónde sale la suma.**
      Es CSS pelado, con `group`/`group-hover`, **sin un solo listener**: la ficha se
      repinta en cada cambio y un listener hay que engancharlo otra vez en el nodo que
      `mountInto()` recrea; uno perdido es un hover que a veces funciona, que es la forma
      más difícil de detectar de un bug. **Y abre también con el foco**, porque en móvil no
      hay hover, así que el bloque lleva `tabindex` y un toque lo enfoca.
      La lista **sale al revés**: el potencial es una regla fija y se aplica hacia atrás
      para encontrar la base que el item lleva. La primera versión la leía del tier y con
      un daño guardado que no coincide con la fórmula daba 48 donde el stat ponía 52. Y al
      redondear esa base a entero, 31 × 1,40 × 1,90 daba 82 donde ponía 84: un
      redondeo de un dígito en medio de una suma es justo lo que esa lista existe para
      que no pase, y es el que peor se ve porque los tres números están apilados y parecen
      sumar. Con un decimal, la cuenta cuadra hasta el único redondeo que queda, que es el
      del total.
      Vive en `data/crafting.ts` y no en el motor porque **el preview monta su propio juego
      falso**: con la función dentro de la fábrica, el hover salía en el almacén y no en
      el preview, y parecía un bug de una pantalla.

- [x] **La valoración sin toggle y sin la línea de base.** El `<details>` sobraba dos
      veces: cerrado obligaba a un clic para ver cuánto valía el item, que es justo el
      dato que se pide **antes** de vender, y abierto por defecto lo único que aportaba
      era una flechita para cerrar algo que no hace falta cerrar. Ahora es un bloque fijo
      con borde, la etiqueta a la izquierda y la cifra a la derecha.
      **Y LA LÍNEA "Base T2: 480" NO ESTÁ**, porque el "Base T2" de la valoración es el
      **valor** y el número grande de arriba es el **daño**: dos grandezas distintas con
      el mismo nombre, una debajo de la otra. Aquí quedan solo los multiplicadores, que es
      lo que explica el precio; de dónde sale el daño lo explica el hover, y cada lista
      dice lo suyo.

- [x] **Las estrellas de potencial solo para lo que tiene potencial, y el lore sin
      números ni "qué brinda".** Las estrellas se pintaban siempre, y la función con un
      potencial ausente devuelve tres: **una caja de botín, una llave y una carta salían
      con tres estrellas**, potencial para algo que no se puede subir.
      Del lore, **ninguna de las 67 entradas tenía un número** —esa parte ya estaba bien—,
      pero tres frases decían lo que hace el objeto: un arma que "nunca falla", un
      compañero que "multiplica" y un ítem que se anunciaba como "el mayor ingreso del
      juego". Las tres escritas, y las tres contradichas por la etiqueta que ahora va al
      lado. Ahora las dos reglas están **fijadas con pruebas** en `loreCheck`.

- [x] **El mock del preview se puso al día, tres veces.** Los recolectores y compañeros
      del `preview` no traían potencial y el stat no traía desglose ni unidad, así que el
      banco visual aprobaba una pantalla que el producto no tiene. Es el mismo fallo que el
      recolector equipado que faltaba en el mock.
### La chrome, y por qué se ha medido

- [x] **El nav no se mueve al cambiar de sector.** Medido antes y después en las siete
      pantallas con `getBoundingClientRect()`: **la fila de la cabecera medía 56 px y el
      nav se clavaba en `x = 449` con el borde derecho en 963**, idéntico en las siete.
      Antes la cabecera de la base medía **111 px** y las otras seis **71**, porque eran
      dos cabeceras distintas escritas en dos sitios: la de la base metía la identidad con
      avatar —más alta que un título— y las páginas no llevaban su `flex-1`. El nav era
      el mismo HTML en las siete y aun así se movía, porque lo que lo colocaba era lo que
      hubiera a su izquierda.
      Ahora las dos llaman a `appHeaderHTML()`, que fija la altura de la fila, pone el
      nav **al final** y el `flex-1` en el grupo de la izquierda. Lo último es lo que lo
      deja clavado: el borde derecho del nav es el padding de la cabecera, que es el mismo
      número en las siete, y su anchura depende solo de las etiquetas.

      **Y HABÍA UN SEGUNDO MOTIVO, DE 2 PX, QUE NO SE VE EN EL CÓDIGO.** El botón activo
      usaba `accent-bg`, que no lleva borde, y los otros usan `btn-ghost`, que lleva
      `border: 1px solid`. Medido: el nav medía **512 px con un botón activo y 514 px sin
      ninguno**. Arreglado con `border border-transparent` en el activo, y **no con un
      `min-w`**: reservar un ancho mínimo también funcionaría y sería peor, porque el
      número habría que acertarlo por etiqueta y el día que se añadiera una ruta el nav
      volvería a moverse.

- [x] **El título con su icono a la izquierda, sin la descripción, y la cabecera con la misma
      forma en las ocho pantallas.** Lo que se veía al pasar de la Base al Mercado eran
      **doce píxeles**, y medido resultó que el nav no era lo que se movía —eso ya estaba
      clavado en `x = 679` en las ocho—: lo que se movía era todo lo que hay entre el borde
      izquierdo y la franja de saldos. El grupo de la izquierda medía **352 px en la base y
      364 en las seis páginas**.
      La causa era un hueco: la fila lleva separaciones, y la base pintaba **cinco** hijos —
      con el envoltorio de acciones vacío pero presente, porque pasaba `actions` con un
      espacio en vez de no pasar nada— y las páginas cuatro. Cinco hijos son cuatro
      separaciones y cuatro son tres, y el `flex-1` se queda con el hueco que sobra: una
      separación más son doce píxeles más. **Con el envoltorio siempre presente las ocho
      filas tienen cinco hijos y el grupo mide lo mismo por construcción.** Un envoltorio
      vacío con ancho cero no empuja nada.
      El título y su icono se quedan a la izquierda, en el mismo sitio que el nombre en la
      base. **Centrarlos fue el primer intento y era un error de sitio:** ese hueco no es un
      hueco, es donde van los buffs, y los buffs son de ancho indeterminado —una fila que
      crece con cada carta activa—. Un título anclado al centro se movería cada vez que
      hubiera un buff distinto, que es la misma clase de fallo que ya se arregló con el nav.
      Y sin la descripción, que además desaparece **del tipo**, no solo de la pantalla:
      dejarlo como una opción sin efecto es la forma de que el siguiente lo escriba, no vea
      nada y pierda el rato. No se pierde nada: la única descripción que decía algo era la
      del mercado —el descuento del árbol— y esa ya sale en el panel de la ficha.
      Los iconos de la cabecera salen ahora de una constante cada uno. Los nueve median
      14×14, o sea que **no eran de distinto tamaño**: era que a 14 px al lado de un número
      de 11 px los tres glifos de los saldos no tienen el mismo peso. El de los saldos sube
      a 16 px.
      Medido a 390, 768, 1024, 1100, 1280 y 1440: cero desbordamiento y el título nunca se
      sale de la fila.

- [x] **Nanitas, cristales y núcleos en la cabecera, y en ningún otro sitio.** La franja
      de la cabecera es la única que se refresca en cada tick, así que es la única que no
      puede quedarse congelada. Se fue de la franja de la tienda, de la del perfil, de la
      del prestigio y de la del almacén —que era la peor, porque en el almacén el saldo
      estaba **en la cabecera y en el cuerpo de la misma pantalla**.
      **La excepción, y es una sola: la cifra grande de la base.** El número de nanitas a
      32 px en el centro se queda, porque es la métrica protagonista del incrementador y
      no un saldo que se consulta. Lo que no se queda es la etiqueta "NANITAS" al lado de
      la franja, que sí era la misma cifra otra vez por otro nombre.
      Y el refresco dejó de ser una lista de cinco identificadores escritos a mano en
      `updateUI`: ahora `updateResourceBar()` busca por atributo, así que **la lista
      está en el HTML que se pinta** y no puede quedar desfasada.

- [x] **El ranking era la única pantalla sin saldos: 0 de 3.** No pasaba el estado a la
      cáscara porque su segundo argumento es el usuario de Firebase, y **ese objeto no
      lleva la partida**: no tiene `getState()` ni `state`. El intento de deducirlo de
      ahí no daba `undefined` por accidente, daba `undefined` siempre. El estado entra
      ahora como argumento explícito, que es lo que toca cuando no se puede resolver por
      dentro.

- [x] **Una hoja de ajustes con audio, tema y salida, en las siete pantallas.** El
      engranaje está en la cabecera común, así que el mismo botón abre lo mismo en todas.
      Antes el audio y la salida estaban **solo en la base** y el tema tenía dos sitios —
      un panel en móvil y un selector en escritorio— y los dos estaban en `layout.ts`, o
      sea que **desde un sector no se podía cambiar el tema de ninguna manera**. Tres
      caminos para lo mismo, y uno que no funcionaba.
      Resuelve también el ancho: con los tres controles en línea la fila pasaba a "título,
      saldos, audio, audio, tema, salida, nav" y **el nav volvía a moverse**, porque al
      desbordarse la fila su borde derecho dejaba de ser el padding. Medido antes y
      después a 1200 y 1440: `navX` y el borde derecho son idénticos en las siete.
      Y el tema **no cierra la hoja** al aplicarse: cambiarlo probando cuatro era un bucle.

- [x] **La forja: la regla fijada en los diez niveles, y el yunque que no se contradice.**
      Un "T7 + T7 me dio un T11" que **no se pudo reproducir**: por los diez niveles sale
      T{n+1}, y los dos materiales desaparecen del almacén en acierto y en fallo. Lo más
      probable es la cadena —T7+T7 da T8, T8+T8 da T9, T9+T9 da T10 y T10+T10 da T11—,
      que es la única manera de subir de nivel porque la forja es +1. Aun así ahora hay
      una prueba de los diez niveles, porque "creo que son cuatro" no es una comprobación.
      Y sí había un defecto real alrededor: **puedes cambiar de pestaña de nivel con el
      yunque lleno**, así que la rejilla enseñaba los materiales de un nivel mientras el
      yunque seguía con los del anterior. Ahora la hoja se vacía y **se dice**, porque un
      yunque que se vacía solo parece un fallo.

- [x] **El preview delegaba la cabecera solo en la base.** `wirePreviewAudio()` estaba
      dentro del `default`, así que en el almacén, la Forja o el mercado los
      interruptores y la hoja de ajustes se veían bien y **no hacían nada**. Es el mismo
      fallo que el recolector equipado que faltaba en el mock: el banco visual
      aprobando cosas que el producto no hace. Movido después del `switch`, para las siete.

- [x] **El botón del compañero abre la MISMA hoja que el del recolector.** Antes caían
      en sitios distintos: el del recolector abría la hoja de sintonización —coste, saldo,
      probabilidad y ruleta— y el del compañero un `showConfirmModal` con dos frases. La
      misma acción, dos maneras, y había que aprender la segunda cada vez que cambiabas de
      tipo de objeto. Ahora `showSintonizacion()` recibe a quién va dirigido y lo que
      cambia son **tres cosas**: de dónde sale el item, cuál es su techo y a qué método
      del motor se llama. El resto es el mismo código, y por eso no puede desincronizarse.
      `subirNivelDeCompanio()` está borrada entera.
      La hoja también gana la **ruleta** para los compañeros, que no tenían.

### El sistema que se ha quitado entero

- [x] **El cristal es un recurso, y ya no tiene diez niveles.** Era un item del almacén con
      nombre y rareza propios del T1 al T10, y cada nivel tenía su multiplicador de
      probabilidad, así que gastar un T5 era "mejorar con más probabilidades" y la pregunta
      del jugador era una cuenta y no una decisión. **Ahora es un número,**
      `state.crystals`, como las nanitas: no está en el almacén, no ocupa ranura, no se
      vende y no se puede apilar.
      El coste lo pone **el nivel del item**, y sale del precio de la caja de ese nivel:
      un intento de nivel 0 sobre un T10 cuesta `costeDeCaja(10)`, o sea **lo que una
      caja T10**. Un T1 cuesta 675 y un T10 145 388: doscientas veces más.
      Y de ahí sale la propiedad que hace que el cambio sea neutro y comprobable:
      **una caja T-n da exactamente los mismos intentos de mejora que daba antes**, en los
      diez niveles. Antes soltaba entre 3n y 5n cristales y cada uno era un intento; ahora
      suelta esas mismas unidades ya convertidas y un intento cuesta lo que valía un
      cristal. Fijado con una prueba en `stateCheck`, con la banda del juego viejo escrita
      a mano y los multiplicadores de rareza incluidos.
      Las partidas viejas **se redimen solas** por lo que valían (`SAVE_VERSION` 9  10),
      y la redención es idempotente: las pilas desaparecen, así que recargar no paga dos
      veces.

      **LO QUE SE PIERDE, DICHO PARA QUE NO SE PIERDA DE VISTAS:** el multiplicador. Con
      un solo recurso la sintonización es **determinista dado el nivel** — en el 15 acierta
      el 50 % y siempre —. El riesgo que queda es el del nivel, que sube en cada subida, y
      ya no hay forma de comprarse más suerte.

      **Y LO QUE SE GANA, SIN QUE NADIE LO PIDIERA:** los items por encima del T10 **ya se
      pueden subir de nivel**. La forja es infinita y produce T11, T12, T30, y antes
      todos ellos eran imsubibles con el mensaje *"hace falta el Cristal T11, y el más alto
      que existe es el T10"*. Al no haber niveles de cristal, no hay ese techo. Era un tope
      de progresión y ha desaparecido con el sistema entero.

      **TRES FALLOS QUE EL CAMBIO DEJÓ A LA VISTA, Y QUE NO SON DEL CAMBIO:**

      · **El Ascenso no tocaba el saldo de cristal.** Escribía `upgradeCrystals: 5`, un
        campo que ya no leía nadie, en vez del saldo de verdad: ascendía, el contador nuevo
        ponía 5 y las unidades se quedaban. Y había una prueba que **recogía el
        comportamiento como si fuera intencionado** —decía "el Ascenso no recicla el
        saldo"—, así que el bug estaba escrito en el banco. Ahora el Ascenso reconstruye
        la partida desde el estado de partida nueva, como las nanitas.
      · **Con el almacén lleno no se podían comprar cristales.** La carta ya no crea un
        item, pero `cabeLaCompra()` caía en `isStackable(null) === false` y comparaba
        ranuras ocupadas con capacidad. El bug del item reproducido por la puerta de atrás.
        Ahora es una regla y no un caso: **una carta que no crea un item no pide ranura**,
        así que la siguiente carta que sea un recurso hereda la respuesta correcta.
      · **El botín de cristal se recortaba hasta un 29 %.** La rareza del premio multiplica
        la cantidad, y la rareza del botín de cristal era su propia escala, distinta de la
        de las cajas —T4 y T5 Legendario, T8, T9 y T10 Divino—. Al unificar pasó a ser
        fija y las cajas T3 a T8 dejaron de dar tanto. Restaurada, con la escala escrita
        donde se ve por qué existe.

      **Y UNA PRUEBA QUE PASABA EN VACÍO:** la de `saltoCheck` que afirma "más rareza,
      menos probabilidad" **sumaba** los pesos de cada rareza, que mide cuántos premios hay
      de cada una y no su probabilidad —justo lo que su propio comentario, tres párrafos
      arriba, dice que no hay que medir—. Pasaba porque en las cajas altas no existía
      ninguna entrada Rara, así que la escalera no tenía peldaño con el que comparar.
      Ahora mide la media por entrada, que es lo que el comentario dice.

      **Y DOS FICHEROS QUE CAMBIARON DE NOMBRE, NO SOLO DE CONTENIDO:** `crystalPicker.ts`
      pasó a ser `sintonizacion.ts`, porque ya no elige cristal —enseña el coste y tira—;
      y con un solo recurso el botón del compañero **es la misma hoja que el del
      recolector**, con su ruleta y todo.

- [x] **Las llaves no existen.** La caja se abre con su ID y nada más: sin llave que
      buscar, sin selector, sin llave que no alcance. **Quitarlo no ha movido ni un
      nanito**: la caja pasa a costar `COSTE_POR_TIER * 3/4`, que es exactamente lo que
      costaba la caja más su llave, y como el tope de reventa era esa misma suma, el
      premio de nanitas y el techo de reventa de cada cofre **no se han movido**.
      Comprobado para los diez niveles contra la fórmula vieja reconstruida.
      Las llaves que alguien tuviera **se redimen solas** por un tercio del tope, que es
      lo que valían; la migración es idempotente, así que recargar no paga dos veces.
      `SAVE_VERSION` 8 → 9.
- [x] **Dos leyendas que mentían, y una que se había roto sola.** Las diez cajas
      decían *"Se abre con la llave de su tier o de un tier superior"*: era verdad
      hasta hace una hora. El texto era correcto y el juego ya no, que es la peor forma
      de que un texto se quede viejo. Y un comentario de `components/store.ts` **ya
      estaba roto antes de este cambio**: su frase terminaba en *"con diez llaves,"* y
      ahí se cortaba, en mitad de una frase. Un `/** */` que se corta a mitad de
      frase sigue compilando y sigue cerrándose.
- [x] **`verify/llaveCheck.ts` → `verify/cajasCheck.ts`.** No solo el contenido: un banco
      que se llama `llaveCheck` y comprueba que no hay llaves es peor que no tenerlo,
      porque el nombre dice que el sistema existe. 220 pruebas → 69 que miran lo que
      ahora importa: que las diez cajas abren y se gastan, que cuestan lo mismo que
      antes el par, que las llaves se redimen una sola vez, que no queda ninguna carta,
      entrada de botín ni texto que hable de llaves, y que la cadena T1→T10 sigue
      entera — sin llaves **esa cadena es el contenido de la caja alta**.

### El contenido que no se podía conseguir

- [x] **B6-B7-F5 · las llaves** (`18cf36d`). La cadena cierra: cada caja suelta la llave
      que la abre, y los cuatro textos **se generan** con la regla que decide si abre, así
      que ya no pueden mentir. La escalera tenía **tres** peldaños rotos, no dos. La caja
      legendaria ya se puede abrir. `llaveCheck` (92).
- [x] **F6 · el peldaño de sorpresa de las cajas, y D1** (`42aa3a5`). El salto es una
      entrada más de la tabla de botín —no un `if` al abrir, porque un premio que no está
      en la tabla la ruleta no lo puede pintar— y sube **un** peldaño solo. El Espectro
      Azulado ya sale de la legendaria. `saltoCheck` (42).
- [x] **F27 · tope de almacén y expansores por tipo** (`3b9048a`). T1/T2 en tienda, T3 solo
      de cajas, tope 600 que frena sin recortar. Fuera `warehouseSlot`,
      `expandWarehouse` y `unlockCompanionSlot`. `buyCheck`, `stateCheck`,
      `consumableCheck` y `toastCheck` al día.

### Los medianeros: R10 y el cableado

- [x] **B9 · el AFK se pone solo estando en la pantalla** (`ec3fb01`). La pregunta va en el
      **tick**, no en el manejador de presencia, porque abrir una segunda puerta al cobro es
      la forma más fácil de que las dos se desincronicen. Y el `mousemove` dejó de contar:
      estaba registrado, así que **cualquier movimiento del ratón sacaba del AFK** y el
      corte era casi inútil. El listener se quitó entero y el umbral sube a 60 s.
      `tickCheck` 14 → 20.
- [x] **B10 · cartel AFK y botón parado** (`0f0968a`). `#afk-banner` + `#app[data-afk]`
      que congela la respiración del botón con `animation-play-state: paused` —congelada, no
      quitada. Misma expresión que el +0/s: cartel, botón y número no pueden contradecirse.
- [x] **B3-B4 · el cartel de logro y su pista** (`a04ab9f`). Dos causas, y por eso no había
      **ni un solo cartel en toda la partida**: la compra que amplía el almacén era la única
      de las diez rutas que no evaluaba logros, y el cartel se descartaba en silencio porque
      `#achievement-stack` todavía no estaba en el documento. Ahora hay **cola**. Y la pista
      mide `warehouseCapacity + bonus.storageSlots`, la misma regla que `getCapacity()`.
      `toastCheck` 25 → 31.

### Los que no parecían bugs

- [x] **B1 · los compañeros `passive` no anunciaban su ingreso** (`7b6def9`). La sospecha
      inicial —que fuera el primer slot— era falsa: la vista filtraba por
      `type === 'click'`, y de los cinco compañeros de caja tres son `passive`. Entre ellos
      el **Avatar del Vacío, power 65, el mayor ingreso individual del juego**: comprarlo y
      equiparlo no producía ninguna señal. `senalCheck` 30 → 36.
- [x] **B12 · el segundo prestigio ya dice cuánto falta** (`b3ea2de`). Bug de **valor**, no
      de flujo: la vista restaba el umbral del *primer* núcleo en vez del siguiente. Y
      `coreProgress()` no solo estaba sin usar: estaba **al revés** (bajaba al producir). El
      faltante y el progreso salen de `data/prestige.ts`, así que lo enseñado es lo cobrado.
- [x] **B5 · el trompo ya no explica cómo está hecho por dentro** (`839595b`). Los dos
      textos que lo hacían contaban una frase interna, y el jugador dedujo de un texto que
      la ruleta era un adorno. La mecánica **no se ha tocado** (F10).
- [x] **F4 · fuera los buffs pasivos, solo tarjetas** (`2e42e7d`). No era que fueran
      buffs: `isEffectivelyAfk` anula el corte del AFK si hay un buff pasivo activo, así que
      **un buff pasivo era un pago por no mirar la pantalla**. Eso rompe R10, que es una
      regla. El efecto **sigue en el motor** para las partidas viejas: se retira la compra,
      no el buff. `tarjetaCheck` (17), que ata que nada comprable dure más de 15 minutos.

### Compras, contenido y ritmo

- [x] **F7-F11 · escuadrón de 6 con las ranuras en una tabla** (`77d8f6e`). Tope 6,
      **ningún salto de +3** (antes el segundo compraba 2 → 5 de golpe y el precio por
      ranura se multiplicaba por 5,3), y el número vive en `COMPANION_SLOT_BUY`, que leen el
      motor, el botón y la tarjeta. `ranuraCheck` (34).
- [x] **F8-B2 · el ranking enseña marco y banner, no solo el título** (`3f42920`). El
      documento `rankings/{uid}` escribía solo `title` y el tipo `LeaderboardEntry.cosmetics`
      prometía tres cosas sin rellenar ninguna. `identidadCheck` (8), nuevo.
- [x] **F12-F13 · lo que te tocó y su lore** (`383c6e8`). Comprar tier abre un cartel con
      nombre, poder, rareza y lore (ya no un toast que manda al almacén). 67 fichas, con la
      línea de tipo al lado. `loreCheck` (11), nuevo.
- [x] **F14 · comprar por cantidad** (`1dfe0fd`). Cobra N unitarios y funde las N en la
      pila; `getBulkCost`/`getBulkMax`/`getStoreUnitCost` ponen el número único para
      diálogo, tope y tarjeta. `buyCheck` 140 → 154.
- [x] **F15 · desglose de cosméticos en el perfil** (`f794d44`). El encabezado dice cuántos
      de cada tipo en vez del total mezclado. Solo vista, sin banco.
- [x] **F16 · identidad arriba a la izquierda** (`36001c5`). `#nav-identity` con avatar,
      nombre y título, parcheada en caliente al equipar. `miniIdentity()` compartida con el
      ranking. `identidadCheck` 8 → 14.
- [x] **F17 · saltar la ruleta con un check** (`35acadb`). Las dos ruletas van directo al
      cartel sin montar la cinta. Check en Perfil → Ajustes, preferencia en `localStorage`
      como el tema. `rouletteCheck` 59 → 63.
- [x] **F18 · abrir varias cajas de golpe** (`0a55082`). Selector con tope cajas+llaves, N
      `openCrateBox` enteras con carteles en orden. El modal aprendió `verbo` para no
      prometer `◆` al abrir. `stateCheck` 219 → 226.
- [x] **F24 · deduplicar la forja y el quitar** (paso 1 del plan). La vista no sube
      ids repetidos y el motor rechaza antes de cobrar consumibles. `stateCheck`
      232 → 235. La tanda queda en **24 bancos, 1552 pruebas**.
- [x] **El potencial decide el daño, la rareza pesa menos y ningún afijo rompe items**
      (`e2d1025`). Daño = `base(tier) × (1 + 0,2 × potencial)`, con el ★5 siendo el doble
      de la base. Los **cuatro afijos planos** (`+60` de daño y compañía) se volvieron
      porcentajes: en un T1, que tiene base 5, un "+60" más que triplicaba el item. La
      rareza da los afijos mínimos (tope 6) y la forja hereda primero los de los dos
      materiales. Más rareza = menos probabilidad, repartida por bolsas. Y un arreglo de
      balance que hizo falta: con la base en el mínimo del rango los **tiers se solapaban**
      (un T1 perfecto igualaba a un T2 normal), así que la base crece ×1,75 por tier y el
      peor de un tier supera al mejor del anterior. `stateCheck` +14, `saltoCheck` +6.
- [x] **F31 — una caja por tier, y la tienda solo con la básica** (`3c72fd4`).
      Diez cajas (`Caja T1`…`Caja T10`), diez llaves con nombre propio, y **fuera las veinte
      cartas de tier** y las tres cajas altas. La caja T{n} suelta por construcción el
      cristal T{n}, su llave, un compañero T{n}, un recolector sobrecargado desde la T3, la
      caja T{n+1} y un salto. **Y las diez tablas de botín son una función**, no diez
      listas: era la causa de B6. Precios y reventa salen de una curva de tiers; el par
      caja+llave de la T1 baja de 750 a 675. Fuera `crates.ts`, que estaba muerto.
- [x] **F26 — el cristal es del mismo tier del item, estrictamente** (`3c72fd4`).
      `upgradeEquippedCollector()` **deja de recibir el nivel**: lo deduce del item, así que
      la vista no puede ofrecer un cristal que el motor vaya a rechazar. El selector pasa
      de una lista a **una fila**: la que tienes o la que te falta. Y el cristal deja de ser
      un multiplicador suelto para ser **la llave de la progresión**: el T8 exige cristal T8,
      y el cristal T8 sale de las cajas T8. Un T por encima del 10 se rechaza diciendo
      cuál falta, en vez de degradar la regla.
- [x] **F33 · el potencial decide el daño y la forja promedia los dos** (`58d5a4e`).
      `danioDeRango(tier, potencial)` con 1 en el mínimo y 5 en el máximo exacto;
      la tienda y las cajas lo tiran, la forja promedia los dos materiales. Se fue
      el multiplicador de daño por potencial, que hacía que el mismo número
      contara dos veces. **Promediar nunca sube**, así que la perfección se trae
      de la caja o la tienda y la forja la conserva. La receta son 2 materiales sin
      devolución: el precio sigue en 2ⁿ, y con devolución el coste neto caía a 1.
      Los items viejos lo reciben deducido de su propio daño (`saveVersion` 8), así
      que ninguna partida guardada cambia de estadísticas. `stateCheck` 232 → 241.
- [x] **F28 · la ruleta va demasiado rápido** — **era el navegador, no el juego.** Las dos
      ruletas usan CSS con duración fija, así que el frame rate no puede afectarlas. Lo
      que sí se vio: con `prefers-reduced-motion` activo la transición se anula entera y
      se ve como una ruleta que salta. Sin cambios en el código.
- [x] **F29 · los núcleos al ranking, y el juego deja de enseñar los pesos** (`e04556d`).
      Pestaña propia con los núcleos **ganados** (`totalCores`, no el saldo), que puntúan
      con peso de 5.000. Y fuera los pesos de la pista y de la nota del Definitivo: con la
      receta a la vista, quien la lee sabe qué parte de su puntuación es mashable. **Y un
      bug de verdad que salió al medir**: el histórico de las partidas viejas se estimaba
      con `pendingCores(producido)`, que da "cuántos núcleos daría empezando de cero" — con
      412 M y 12 reinicios salía 296, y como `nextCores` resta el histórico el siguiente
      Ascenso pedía **0**: la partida se quedaba **atascada para siempre**. Ahora se
      reconstruye con `cartera + gastado en el árbol`, que es la cuenta exacta y sale de la
      misma función que cobra la tienda de pasivas. `identidadCheck` 14 → 32.
- [x] **F25 · el mercado va segundo, antes que el almacén** (`32e5339`). Una línea de orden
      en `ROUTES`; el título ya decía "Mercado".
- [x] **F30 · el tope de pintado no recorta lo que hay** (`6c0bb01`). La rejilla hacía
      `Math.min(count, tope)`, así que 150 llaves se pintaban como 99 y el `data-count` que
      leen el arrastre y la selección llegaba recortado. Ahora el número entero y un `+`
      cuando no cabe. `stackCheck` +8, `filterCheck` +2.
- [x] **F23 · una sola sesión por jugador** (`a05849b`). Latido de 45 s en
      `users/{uid}/sesion`: dos dispositivos no se pisan la partida, que era lo grave porque
      la Ascensión borra nanitas y paga con núcleos. El id va en `sessionStorage` para que
      **dos pestañas** también se detecten. Banco nuevo `sessionCheck` (13).
- [x] **Forja infinita, corte 1 · fórmulas 11+ y sin techo** (`d5daee3`). `rangoDePoder()`,
      `rarezaDeTier()` y `valorBaseTier()`; T10→T11 y T11→T12 comprobados.
      `stateCheck` 225 → 232. **Sin curva de probabilidad: esa sigue esperando tu sí.**
- [x] **Cajas: compra en lote, tope de 20 por pila, lista de lo que salió y bucle de
      compra-venta cerrado** (sin commit). Cuatro cosas del mismo encargo, y salían
      de ahí tres bugs que ningún banco miraba.
      - **La caja no se compraba en lote.** La lista decía `itemKey.endsWith('Crate')`, que
        era el nombre de la carta antes de F31. Con una caja por tier la carta se llama
        `crateT1`, la condición dejó de cumplirse **en silencio** y comprar cinco cajas eran
        cinco viajes a la tienda. La misma lista estaba copiada en la vista para elegir el
        sustantivo ("cuántas **unidad**"), y las dos salen ahora de `esCartaEnLote()`.
      - **Las cajas se apilan de 20 en 20.** `TOPE_PILA` es un tope de **almacenamiento**, y
        `MAX_STACK` sigue siendo el de **pintado**: son dos cosas distintas y confundirlas
        cuesta un banco entero. Lo que obliga a que el tope exista es el **lote**: comprar
        25 cajas metía un item de 25 en una sola pila, por encima del 20 que el jugador ve
        en la rejilla. `planDeEntrada()` reparte y `partirPilas()` migra, y los dos lo
        comparten con `cabeEnAlmacen()` porque "**¿cabe?**" y "¿dónde va?" tienen que dar
        el mismo número de ranuras.
      - **Abrir de 20 en 20, con una lista y no veinte ruletas.** El sorteo sigue siendo
        veinte tiradas honestas; lo que cambia es la pantalla. `resumenDePremios()` suma
        monedas y materiales y **no** suma objetos: dos drones son dos filas, porque
        escribirlos "×2" escondería que hay dos celdas ocupadas.
      - **Y el bucle de compra y venta estaba abierto de par en par.** El recolector
        sobrecargado de la T10 se vendía por **457.800** con un par caja+llave de **145.388**
        (×3,15), y las nanitas de una caja T1 salían **9.375-15.000** con un par de 675
        (×14-22): la máquina de imprimir llevaba desde el primer día, y era la **fórmula**
        (`amount × coste / 12` = 21 a 33 veces su propio precio), no el precio. Ahora todo
        premio de caja lleva **tope de reventa = par caja+llave**, y las nanitas son del
        **25% al 40%** del par. `loteCheck`, banco nuevo (71).

- [x] **Fuera la mecánica de sobrecargados, el potencial pasa a los compañeros, la
      leyenda dice la regla y los expansores tienen techo por tier** (sin commit).
      Cuatro cosas del mismo encargo, y las cuatro eran copias del mismo problema:
      **una lista escrita al lado de la tabla que la genera**.
      - **No hay sobrecargados.** La séptima rareza `Sobrecargado` desaparece: del tipo
        `Rarity`, de `RARITY_RANK`, de los tres mapas de color, del multiplicador
        de valor, de la tabla de afijos y de `overclock?: boolean`. Y el motivo
        no es que sobrara: es que **era una segunda escala de calidad encima del
        potencial**, y las dos podían decir cosas distintas del mismo objeto.
        `Divino` se lleva ahora los 6 afijos, que era del peldaño que se iba.
      - **`makeOverclockCollector()` se sustituye por `makeCrateCollector()`**, que
        sale de `generateCollectorByTier()`: un recolector normal de su tier con
        el potencial tirado. El ★5 de caja es ahora el item perfecto y hay que
        buscarlo, en vez de regalarse en una de cada siete cajas.
      - **El potencial decide el poder de los compañeros.** `poderDeCompanero(tier, p)`
        coloca el poder en la posición del rango que le toca a ese potencial: ★1 es
        el suelo y ★5 el techo. **La esperanza no cambia** —el ★3 es el punto
        medio, que es lo que `rand(min, max)` daba de media—, así que la economía
        está intacta y lo que cambia es la diferencia entre dos compañeros del
        mismo tier. Y no es un multiplicador como el del recolector porque el
        techo del rango es lo que se paga: con `danioDeRango()` el T10 salía
        **once veces** más fuerte con la misma carta y `balanceCheck` lo cazaría
        como la trampa que ya cazó una vez.
      - **El salto y la Ascensión dejaron de mentir sobre el compañero de partida.**
        Su poder era un `5` escrito a mano, que es un T2 dentro del rango del T1,
        y el comentario que decía "es un T1 real" mentía. Ahora sale de
        `poderDeCompanero(1, 3)`, y **el item del almacén se construye desde
        `baseCompanion`** en vez de con números: antes la ficha decía "+6/s" y el
        item decía "+5/s" del mismo compañero.
      - **La leyenda de la caja dice la regla, no el botín.** Las diez cajas dicen
        lo mismo —"Se abre con la llave de su tier o de un tier superior"— porque
        antes cada una enumeraba su contenido y **ninguna mencionaba el expansor,
        el salto ni el cosmético**, y dos nombraban un "material de T4" que no
        existe. Y las diez llaves dicen "Abre la caja de su tier y todas las de
        menor", en vez de una línea de ocho nombres.
      - **Diez expansores, uno por tier, y cada uno con su TECHO.** El expansor T{n}
        da +5 ranuras y vale hasta `15 + 5n`: el T1 hasta 20, el T3 hasta 30, el
        T10 hasta 65. **Cuando ya llegas a su techo no se puede usar** y el
        rechazo dice el número y cuál hace falta. Antes eran tres con techos de
        120, 300 y 600, que no frenaban nada: desde 15 de partida el T1 seguía
        sirviendo a los 119.
      - **Y la caja T{n} suelta el expansor T{n}.** Antes lo daba `Math.min(3, tier)`,
        o sea que de la T4 a la T10 salía siempre el T3 —y con el techo nuevo ese
        expansor **solo sirve hasta 30 ranuras**: en la caja T7 era botín muerto.
      - **`WAREHOUSE_MAX_CAP` sigue en 600 a propósito.** Bajarlo a 65 haría que
        `enforceWarehouseCapacity()` **le borrara items del almacén** a quien ya
        pasó de ahí. El techo frena el crecimiento; nunca recorta lo que ya hay.


### La economía y el ritmo (`v1.1.0`)

- [x] **P1-P3 · balance** (`dd12b6e`). El precio por punto de poder **bajaba** con el tier,
      así que el T10 salía 3,7× más rentable que el T1 y la partida se resolvía sola en 20
      minutos. Ahora el coste por punto **sube** 12% por tier (150 → 416), recolector y
      compañero cuestan lo mismo, y sintonizar dejó de ser un botón. `balanceCheck` (29).
- [x] **F1-F3 · la valoración y el desglose del daño a la vista** (`7843a52`). El daño se
      desglosa en `100 base · +50 nivel · +37 bonos` y las tres partes suman el total
      exacto, porque las calcula el motor. `desgloseCheck` (31).
- [x] **Paso 3 · las tablas fuera de `gameLoop.ts`** (`839595b`). A `data/store.ts`,
      `data/buffs.ts`, `data/generators.ts` y `crafting.ts`. Ningún `data/` importa ya del
      motor, que era R29 sin cumplir.

### Antes de todo esto

- [x] **El contador no enseña números que nadie cobra** (`558a394`). El ingreso se repartía
      ya entero entre los que aportan, con el sobrante del redondeo a partes iguales, para
      que la suma de las fichas sea exactamente `state.passiveIncome`. `senalCheck` nace
      aquí.
- [x] **La ruleta del sintonizador, y la de las cajas partida en tres ficheros**
      (`ce3a346`). `rouletteSpin.ts` no importa nada, y esa es la razón de que exista: son
      números puros, que es lo que los hace comprobables en Node.

---

## Descartado

_Lo que se decidió no hacer, y por qué. Esto vale más que la lista de "hecho": una idea
que se descartó con un motivo escrito no vuelve a proponerla nadie._

### D3 · La llave de una caja no puede ser más cara que la caja

Salió al intentar cerrar B6: los primeros precios eran 250 / 1.500 / 7.500 / 30.000, y
entonces la llave épica salía **más cara que su caja** y la del Vacío, más cara que la
legendaria. **El banco lo cazó, y no por el balance: por la regla.**

**El porqué:** si la llave cuesta más que la caja, la caja es la mitad barata del par, y un
jugador que reúna la llave y se quede sin nanitas tiene que elegir. La decisión de qué
comprar primero no es interesante: es un embudo. Y hay algo mejor que una regla de "más
cara o más barata": **cada caja suelta llaves de su nivel**, así que comprar llave y caja
sale siempre más caro que abrir cajas, y la tienda nunca es el camino óptimo por una razón
que el jugador puede entender. Precio final: 250 / 900 / 3.000 / 11.000.

### D4 · El patrón: una cosa definida y otra que nunca se conectaron

*(No es una petición del jugador. Es lo que emerge de los bugs anteriores, y está aquí
para que el cuarto no pase.)*

> **Tres veces en este lote, el mismo fallo exacto:**
>
> | | Qué está definido | Qué nunca se conectó |
> |---|---|---|
> | **B6** | La Llave del Vacío, con nombre y rareza | Ninguna caja la soltaba: la legendaria era **imposible de abrir** |
> | **D1** | El Espectro Azulado, con tipo, poder y rareza | Ninguna tabla lo usaba: el índice 5 se saltaba |
> | **F26** | Los cristales 3 y 4, con nombre y multiplicador | Ninguna caja los soltaba: **4 declarados, 2 obtenibles** |
>
> **La forma del fallo es siempre la misma:** hay una **tabla que describe** una cosa y
> otra **tabla que la reparte**, y **las dos no tienen por qué estar de acuerdo**.
>
> **Por qué no lo detecta ningún banco, y esto es lo importante:** los tres eran
> **contenido inalcanzable**, y el juego **funcionaba perfectamente** sin ellos. No había
> ningún número que saliera mal —el saldo cuadraba, el guardado cuadraba, la ruleta
> cuadraba. Lo único que faltaba era una cosa que el jugador nunca iba a ver.
>
> **Y por eso el banco que sirve aquí es uno de cobertura, no de números:** preguntar *"todo
> lo que está definido, ¿se puede conseguir?"* no es una aserción de que un valor sea tal
> cual, es una pregunta sobre **la unión de dos tablas**. Ninguno de los tres bancos que
> cierran esto podría haberlo visto antes de que la regla nueva lo pidiera.
>
> **La regla que sale de esto:** cuando se declara una cosa con nombre, multiplicador y
> probabilidad, **tiene que haber un banco que pregunte de dónde sale**. No que funcione:
> que exista. Es barato, y los tres bugs eran gratis de evitar.
>
> **Pendiente de este patrón:** el banco de cobertura de los cristales, que sigue faltando
> porque F26 no está hecho.

### D2 · Un fallo mío en un fichero que no está en git

Un `.Replace()` mal escrito en PowerShell sustituyó **cada `i` por `m`** en
`src/ruletaPreview.ts` y en `src/components/store.ts`. El primero está en `.gitignore`, así
que no hay copia en el historial: se reconstruyó a mano. El segundo tenía además trabajo sin
commitear de otra sesión, que se recuperó de la conversación.

**El error de fondo no es el carácter: es que edité ficheros en bloque con un script en vez
de con ediciones exactas.** Un `.Replace()` con el patrón equivocado no avisa: escribe. Y en
un repo donde `git status` es la única red, un fichero ignorado no tiene red.

---

## Deuda: cosas que no son del juego

_Cosas que estorban al trabajo más que al juego._

- [x] **`AGENTS.md` decía "22 bancos = 1399 pruebas".** Corregido. La cifra viva es la que
      da `npm run verify`: **25 bancos y 1649 pruebas**. También afirmaba que `v1.1.0` estaba
      "publicado en GitHub Pages", y **eso es falso**: Pages no está activado en el repo,
      `/pages` da 404 y la URL del juego da 404. Corregido: el tag existe, el juego vive en
      el repo, y **no se quiere publicar en Pages**.
- [x] **`crates.common` salía en `state`, en el componente de cajas y en tres bancos.**
      Con diez niveles de caja era un contador con cuatro claves que ya no cuadraba con
      nada. Ahora `state.crates` es un `Record<CrateType, number>` y se construye con
      `CRATE_TIERS`, así que **añadir una caja no puede olvidarse de tocar el contador**.
      Y las partidas viejas se traducen al nivel donde vivía cada caja (común → T1, rara →
      T3, épica → T6, legendaria → T8), que conserva la posición del jugador en la escalera.
- [x] **`sellCheck` tenía sus propias fábricas de items**, con listas de nombres que no
      eran las del juego, *además* de las de `kit.ts`. Dos copias que ya se habían separado:
      la lista del banco tenía cuatro nombres y el juego tiene diez. Con F26 eso pasó de
      cosmético a bug —un banco que fabrica un `Cristal Singular` que el juego no fabrica
      mide un objeto que no existe—. Ahora las tres vienen de `kit.ts`, que las lee de
      `KEY_DEFS`, `CRYSTAL_DEFS` y `CRATE_TYPES`.
- [x] **`consumable()` tenía dos firmas distintas** en `kit.ts` y en `sellCheck`:
      `(id, stack, over)` frente a `(id, buffId, stack, over)`. Al unificarlas sin querer,
      `consumable('u1', 3)` pasó a significar "tres tarjetas AFK" y catorce bancos se
      cayeron de golpe. Compilaba. Una firma distinta en dos sitios que se llaman igual es
      peor que un nombre distinto.
- [x] **`.github/workflows/publicar.yml` borrado.** Como no hay Pages y no se
      quiere, este workflow solo conseguía que **todos los pushes salgan en rojo** en
      `configure-pages`. Los pasos que dependen del código (`tsc` y el que falla la
      publicación si existe `dist/admin.html`) estaban los dos en verde; lo único que
      fallaba era la activación manual, que no se iba a hacer. Borrarlo quita el ruido sin
      tocar el juego. Con él se va `.github/` entero, que solo contenía esa carpeta.
      **Y QUEDA UNA COSA A PROPÓSITO:** la variable `GH_PAGES` de `vite.config.ts` sigue
      ahí, y sigue haciendo sus dos cosas —`base: './'` y **no construir `admin.html`**—.
      No la pone nadie, así que hoy no hace nada; pero es la red que impide que un
      despliegue público cualquiera termine subido el botón de **borrar la base de
      datos**, y esa red compensa más que el sitio que ocupa. Borrar el fichero de
      despliegue no es lo mismo que borrar la protección.
- [ ] **`Math.min(5, …)` está escrito a mano en seis sitios** y el tope de potencial no
      tenía nombre. Lo pasó a tener (`POTENTIAL_MAX`, en `data/crafting.ts`) porque un
      logro necesitaba compararse con él y no había con qué. Los seis sitios sueltos —
      `preview.ts`, la fusión, la afinidad del cálculo de potencial, las piedras de
      calibración— siguen ahí: es un refactor de bajo riesgo y de bajo interés, y se
      deja para cuando se toque uno de esos ficheros. **Lo que ya no es aceptable es que
      alguien escriba el 5 otra vez**, y por eso el número tiene nombre y el comentario
      al lado del `AFIX_MAX` avisa de que son dos topes distintos.
- [x] **`playthroughCheck` tiene una prueba que depende del dado** y no lo dice:
      `caja: si son nanitas, entran las que dice la etiqueta` solo se ejecuta cuando el
      botín de la caja sale de nanitas, así que el total del banco **varía entre 1964 y
      1965** según la tirada. No es un fallo —por eso `AGENTS.md` avisa de que una prueba
      que depende del dado no se cuenta— pero un banco cuyo total se mueve es un banco
      del que no se puede fiar uno para detectar que le falta una prueba.
      **Hecho.** El dado va fijado con `conRoll(0.01, ...)` en esa apertura, y el `if`
      desapareció: ahora hay **una prueba que avisa** si el botín deja de ser de nanitas,
      con la etiqueta en el mensaje, y otra que se ejecuta siempre. El valor no es una
      constante mágica: es el primer tranche de la tabla de botín de la caja común, que es
      la fila de las nanitas con peso 34 de 143. `playthroughCheck` pasa a 105 y el total
      del banco es 2009 **las dos veces seguidas**, que es lo que no se podía comprobar.
- [ ] **Que las tres ruletas lean la preferencia de saltar, comprobado y no leído.**
      `crateRoulette.ts`, `tuningRoulette.ts` y `forgePage.ts` llaman a
      `getSkipRoulette()`, y el conmutador está en Ajustes de la cabecera. Es cierto, y es
      exactamente el tipo de cosa que se rompe sola: mañana alguien añade una cuarta ruleta
      y no se le ocurre el `getSkipRoulette()`, y el banco no lo dirá porque no lo mide.
      **La forma de medirlo sin leer código es Montarla**: las tres con la preferencia
      apagada y comprobar que no hay cinta en el DOM. Es la clase de prueba que ya está
      escrita a mano en `ruleta-preview.html`, y lo que falta es el mismo caso detrás de un
      `check()`.
- [ ] **El scroll de las páginas no tiene banco, y `domStub` no lo va a tener.**
      A5 arregla un re-render que devolvía al principio, pero lo comprobó `preview.html` con
      viewport real porque `domStub.ts` **no tiene layout**: `scrollTop` siempre es 0 ahí, y
      una prueba escrita sobre ese stub daría verde sin medir nada. Un banco de scroll
      necesita o un navegador o un stub con layout falso que sepa qué elemento se desplaza
      y hasta dónde, y lo segundo es una copia del motor de layout. Lo que sí se puede
      probar sin DOM es lo que hay alrededor: que `mountInto` sustituya el nodo, que lo
      haga antes de quitar el viejo, y que devuelva los scrolls del árbol nuevo por la ruta
      de índices. Esa parte es lógica pura y se puede aislar.

- [x] **Notas de parche al entrar, desactivables en Ajustes.** El encargo: un cartel al
      entrar con los cambios de la versión, con una casilla para callarlo, y **sin cálculos
      internos**: "Se añadieron nuevos compañeros y recolectores", "Se modificó el
      ranking".
      - **La versión sale de `package.json`**, y no de una constante al lado de las notas.
        Es el único sitio donde el número puede ser verdad a la vez: una constante
        escrita a mano se queda vieja el día que se sube la versión y nadie se entera,
        que es justo el fallo que esto vino a arreglar. Publicar un parche son dos
        pasos: subir la versión y añadir la nota.
      - **La marca de "ya visto" guarda una versión, no un sí.** Con un booleano, un
        jugador que desactiva las notas, juega dos meses y las vuelve a activar se
        encuentra con que ya no le aparecen nunca: habría perdido las notas sin saber
        que existían. Desactivado es "no mostrar", no "marcar como visto", así que al
        reactivar aparecen lo pendiente. Un ajuste que se puede volver a poner **tiene**
        que devolver lo que apagó.
      - **Se monta al entrar y no en cada navegación.** `showPatchNotes()` lo pregunta a
        `debeMostrarNotas()`, que son tres condiciones comprobables —hay nota de esta
        versión, la preferencia está activa y no se ha visto— y que el banco puede
        preguntar sin DOM. Un "si la versión es distinta" escrito en el punto de montarlo
        es un "si" que nadie lee dos veces igual.
      - **La regla de contenido es mecánica, no de estilo, y por eso se puede comprobar.**
        El banco vigila que ninguna nota hable de ficheros, funciones ni
        identificadores; que cada línea sea una frase con mayúscula y punto; que no
        lleve cifras internas —un 12 %, un "de 3 a 4"—; que no repita línea; y que la nota
        tenga entre tres y doce líneas. Un cartel de parche lleno de internals es un
        commit log, y todo el mundo deja de leerlo al segundo commit.
      **Lo que no se comprueba, y se dice:** que cada línea nombre algo que exista en la
      pantalla. Eso no es decidible y un banco que fingiera comprobarlo daría la
      impresión de que comprueba algo que no comprueba.
      `leyendaCheck` 21 → 31. Versión subida a 1.2.0 y `preview.html?vista=notas` para
      poder mirarlo sin jugar: vive en `main.ts`, así que sin esa vista no había forma.
- [x] **El ranking enseña quién está en línea.** Punto verde y "en línea", punto rojo y
      "offline", en cada fila. Lo que salió es que **el dato ya existía pero no se podía
      leer desde el ranking**, y la razón es una regla de seguridad:
      - **El latido no puede venir de `users/{uid}/sesion`.** Ahí está, se escribe cada
        quince segundos y es lo que decide si una cuenta está ocupada. **Pero las reglas
        de Firestore dan a `users/{uid}` solo a su dueño y a un admin**, que es
        justamente lo que impide que alguien se entere de que está suspendido. O sea:
        para enseñar la presencia por ahí habría que abrir `users`, y no se abre.
      - **La solución es el documento que la clasificación ya escribe.** `rankings/{uid}` es
        público por definición y su dueño lo puede escribir: es el único sitio donde un
        jugador puede leer el latido de otro sin tocar una regla de seguridad. El
        latido se anota ahí con una escritura **parcial** —solo ese campo, con `merge`—
        piggybackeada en el latido que ya existe, así que no añade esperas ni temporizadores.
      - **"En línea" y "sesión ocupada" son la misma pregunta**, así que `estaOnline()`
        **importa** `VENTANA_MS` de `sessionService` en vez de escribirlo. Con dos
        ventanas habría un momento en que el ranking dijera una cosa y el bloqueo de
        sesión otra, y nadie se enteraría.
      - **Sin latido es offline, no online por defecto.** Es el caso de todo documento
        escrito antes de que esto existiera, y tratarlo como online sería una mentira
        en la fila de arriba.
      - **El punto y la palabra son las dos mitades.** El color se lee de reojo en una
        tabla de cuarenta filas, y la palabra dice lo mismo sin depender de que se
        distinga verde de rojo —que en una clasificación es el único dato que se lee
        de verdad—. El punto es `aria-hidden` y la palabra no: un lector de pantalla lee
        "en línea", no un círculo.
      `sessionCheck` 13 → 20: fresco, borde exacto de la ventana, viejo, sin latido, y un
      latido del futuro —un reloj que va hacia atrás daría `ahora - latido` negativo, y
      "negativo es menor que la ventana" es `true` sin que nadie lo piense—.
      **Lo que no se ha podido mirar:** el píxel. El servidor de desarrollo ha estado
      devolviendo 502 en cuanto a la aplicación entera, y no es del cambio: las filas de
      ejemplo llevan a propósito una en línea y otra con el latido viejo para que se
      vean las dos en cuanto `preview.html?vista=ranking` levante.
- [x] **La ruleta de la forja: no se ve, no se posiciona y avisa dos veces.** Las tres
      cosas eran de la misma familia —**el CSS estaba escrito y el markup no lo
      usaba**—, que es la clase de fallo que no se ve leyendo el código porque lo que
      falla es una conexión entre dos sitios que no están uno al lado del otro.
      - **`reel` era siempre `null`.** La función hacía
        `querySelector('.forge-roulette')` y el `div` de la cinta llevaba
        `id="forge-track"` y **ninguna clase**. Como el elemento no existía, `place()`
        salía en su primera línea y **la cinta no se colocaba nunca**: el desplazamiento
        no se calculaba, la celda ganadora no llegaba a la aguja y la tira se salía por la
        derecha —18 celdas de 56 px son 1116 px en un hueco de 448—. Y el CSS de
        `.forge-roulette`, con su recorte y su aguja, llevaba tiempo en el fichero sin que
        nadie lo notara, **porque una regla que no se aplica no falla: no hace nada.**
      - **Había dos temporizadores idénticos** y los dos llamaban a `onDone()`. Con el
        trompo saltado pasaban los dos —900 ms y 2200 ms—, así que el resultado se
        pasaba de redibujar y de guardar dos veces.
      - **`pl-8` en la cinta y `BASE_PAD` en el cálculo**: el padding venía dos veces.
      - **El resultado es una card y no tres líneas de texto.** El resultado de una
        forja es **un objeto**, y se enseñaba como un nombre, un tier y una lista de
        afijos: la misma información que la ficha del almacén, partida y más pequeña. Y
        eso es justo lo que hacía que no se leyera bien —**una cifra suelta al lado de un
        nombre es una etiqueta, y una etiqueta hay que descifrarla**—. Con la card se ve
        como lo que es: el anillo de la rareza, el nombre, y debajo las líneas con su
        etiqueta al lado. **El fallo también es una card**, que antes salía como un
        mensaje de error en vez de como el resultado de una tirada que no salió.
      - **Con el ajuste de "saltar la ruleta" apagado no se pinta la cinta**, solo la
        card: es lo que esa preferencia significa en las otras dos ruletas.
      - **CORRECCIÓN A LO QUE SE ESCRIBIÓ AL HACER ESTE CAMBIO.** Se puso que al motor
        de ejemplo del preview le faltaba `forgeCollector()` y que por eso el trompo no
        se podía enseñar. **Es falso: ya estaba**, y el botón FORJAR del preview sí
        produce un resultado. Lo que sigue sin comprobarse es el píxel, pero por otro
        motivo y que no es de este cambio: `preview.html?vista=forja` lanza
        `__preview_iframe__`, que es su propio centinela.
        **La causa del desbordamiento sí está localizada y es aritmética**: 18 celdas
        de 56 px en un contenedor de 448.
- [x] **La tarjeta AFK se podía cancelar, y no debía.** Lo pidió el jugador: *"la
      tarjeta afk debería deshabilitar la cancelación de ganancias… no está
      funcionando"*.
      - **La regla vive en `data/buffs.ts`, no en el HUD ni en el motor.**
        `BUFF_CANCELABLE` + `sePuedeCancelar()`, y los dos sitios la leen. Es lo
        importante del arreglo: si el botón de la tarjeta escribiera su propio
        `if (key === 'afk')` y el motor otro, bastaría con que uno de los dos se
        quedara atrás para que el síntoma fuera **un botón que no hace nada**, que es
        peor que no tenerlo porque el jugador no tiene forma de saber por qué.
        La negación **está en el motor** y no solo escondida en el markup: con el
        botón oculto, `cancelBuff('afk')` seguía tirando media hora de tiempo
        acumulado con una sola llamada.
      - **Por qué el AFK y ningún otro.** Cancelar es razonable en una mejora
        temporal: se deja de usar y el tiempo se pierde. El AFK no es una mejora, es
        **lo que permite jugar sin mirar la ventana**, y su tiempo se acumula —tres
        tarjetas son media hora—, así que la × era un botón de veinte píxeles para
        tirar media hora y la tarjeta que la compró. Y hay un efecto que no se ve en
        el botón: **al cancelarlo el HUD lo esconde y no hay ningún sitio donde
        volver a ponerlo sin gastar otra tarjeta**, o sea que la × podía dejar la
        partida en un estado del que no se sale.
      - **La × se quita del markup en vez de apagarse con `disabled`.** Un botón
        apagado encima de una × sigue siendo un botón que parece pulsable.
      - **Dos comprobaciones del banco decían lo contrario y ahora dicen lo nuevo.**
        Una afirmaba que el AFK se podía cancelar, y la otra que cancelarlo ponía su
        barra a cero. Esta última ya no tiene sentido: **el total concedido del AFK se
        limpia al expirar, no al cancelar**, porque cancelar no es una operación que
        exista para él. `consumableCheck` se queda en 136.
      **Comprobado en el píxel** en `preview.html` con los datos de ejemplo: la
      tarjeta AFK se pinta sin `data-cancel` y la de Clics x2 sí lo trae.
- [x] **El juego se quedó en negro y no decia por qué** (`Quota exceeded` de Firestore).
      Le pasó al jugador con la consola abierta. Eran tres fallos, y el tercero es el
      que de verdad importaba.
      - **La ruta del latido de sesión no era válida y la protección contra dos
        pestañas llevaba tiempo muerta sin que se notara.** `doc(db, 'users', uid,
        'sesion')` son **tres** segmentos, y la API pide un número **par** para un
        documento. Las reglas tampoco lo permitían: todo lo que no esté declarado cae en
        el `match /{document=**}` que cierra la puerta. O sea que la escritura fallaba
        siempre, la lectura también, y **las dos van dentro de un `try` que solo avisa**:
        el aviso salía en la consola y el juego seguía como si nada, sin detectar nunca
        una sesión ocupada. Ahora el latido vive en la clave `sesion` del documento de la
        partida, con `merge: true` y un solo campo, así que no puede tocar nanitas.
      - **La presencia iba cada quince segundos, y la cuota de Firestore es diaria y
        compartida.** La clasificación pregunta "está jugando ahora" con una ventana de
        45 segundos, así que **una escritura cada 60 segundos contesta igual y gasta la
        cuarta parte**. El latido de sesión sigue a quince, porque de él depende el
        bloqueo y ese necesita margen; la presencia no bloquea nada.
      - **Y el que de verdad podía borrar una partida: la carga fallida se guardaba.**
        Si la lectura inicial falla, el motor se quedaba con una partida **nueva** en
        memoria, y a los quince segundos el guardado automático escribía esos valores
        encima de la de verdad. **La escritura tiene éxito**, así que no falla, no avisa
        y no hay ni un error en el journey que lo explique: la partida entera desaparece
        en silencio. Ahora el `catch` de la carga pone `partidaNoCargada`, `saveToFirebase()`
        se niega entero mientras siga puesto, y la API lo expone para que el arranque
        avise. **Comprobado quitar el guardia a propósito:** sin él, el banco falla
        diciendo que han cambiado `saveVersion`, `nanites`, `warehouse`, `crates`,
        `companions`, `activeCompanions`, `equippedCollectorId`, `warehouseCapacity`,
        `maxCompanionSlots`, `buffs` y `cosmetics`.
      - **Y la pantalla en negro.** El arranque era una cadena de `await` sin un solo
        `catch`: cualquier fallo iba al `catch` del motor, que escribía una línea en la
        consola, y el jugador se quedaba con un `#app` vacío. Ahora hay una pantalla que
        dice qué ha pasado —**con otro texto si es cuota de Firestore**, que tiene arreglo
        distinto— y un botón de reintentar. Es además el aviso de que no se ha guardado
        nada, que es lo que el jugador necesita saber.
      - Para poder probarlo, el stub de Firestore **sabe hacer fallar la lectura** y no
        solo la escritura, y `boot()` arrastra ese conmutador al reiniciar la base de
        datos: si no, el banco lo pedía y `boot()` se lo borraba, y la prueba pasaba sin
        comprobar nada.
      **Lo que NO arregla el código:** la cuota del proyecto está agotada y es un límite
      **diario** del plan gratuito de Firebase (20.000 escrituras al día). Se repone solo
      a medianoche en el huso del Pacífico, o se quita cambiando el proyecto al plan Blaze,
      que es una decisión suya y no del código.
- [x] **La pantalla seguía en negro después de arreglar lo anterior.** El aviso de error
      no saltaba porque **no había ningún error**: con la cuota agotada, Firestore no
      rechaza la petición, la **retarda** —"Using maximum backoff delay" quiere decir
      "todavía no"—. Una promesa que no contesta no se rechaza nunca, así que el `catch`
      no se ejecutaba, el `await` no terminaba nunca, y el arranque se quedaba esperando
      en silencio para siempre. **Un `catch` no sirve contra una espera que no acaba.**
      - **`src/utils/timeout.ts`, y `conTiempoLimite()` es una regla, no un parche.**
        Convierte "esperar para siempre" en "esperar un rato y fallar". Vive fuera de la
        vista porque los tres que la necesitan —la comprobación de sesión, la anotación
        del latido y la carga de la partida— son **el mismo problema**: una red que no
        contesta. Si el reloj viviera en la pantalla, el cuarto sitio que espera al
        servidor se olvidaría de ponerlo y volvería a dejar la pantalla en negro.
      - **No es una cancelación.** La promesa sigue esperando; el reloj solo decide
        cuándo dejamos de esperar. Por eso el botón de reintentar **recarga la página**:
        es lo único que corta de verdad una petición colgada.
      - **La comprobación de sesión también lleva plazo, y al pasarse se deja entrar.**
        Es la misma política que ya tenía para un corte de red, aplicada al caso que se
        dio: un límite de tiempo es un corte de red que ha decidido no avisar, y **un
        corte de red no puede ser la razón de que un jugador se quede fuera de su
        partida**.
      - **La pantalla tiene ahora TRES textos**, y no son una formalidad: el jugador
        hace una cosa distinta en cada caso. Con la cuota agotada toca **esperar**; si el
        servidor no contesta toca **reintentar**; lo de otra pestaña es lo de siempre.
        Decirle a alguien que espere cuando lo que necesita es reintentar es la forma de
        que se vaya a esperar.
      **Comprobado:** el banco del reloj pide una promesa que **no resuelve nunca** y
      comprueba que sale un error con nombre —y que un fallo de verdad no se disfraza de
      "se acabó el tiempo"—, que es justo el detalle que hace que el texto de la pantalla
      sea el correcto. `sessionCheck` pasa a 25 y el total a 2018.
      **Lo que sigue sin arreglar, y no es del código:** la cuota del proyecto. Con
      esta pantalla ya se ve qué es, pero mientras no se reponga a medianoche (huso del
      Pacífico) el juego no cargará: **el reloj da el aviso, no el servicio.**
- [ ] **Bajar el número de entradas a Firestore.** No es una feature nueva: es la
      consecuencia de que la cuota **sea del proyecto y no del jugador**. Firestore da
      20.000 escrituras al día en el plan gratuito y las gastan a la vez todas las
      pestañas de todas las personas, así que el presupuesto se reparte sin que nadie lo
      sepa. Medido antes del arreglo, **una pestaña abierta escribía 780 documentos a la
      hora**, y eso es la cuota del día entero en cuatro horas.
      - [x] **El ranking ya no se escribe cada quince segundos.** Era **la mitad de
        todas las escrituras del juego**: el guardado escribía dos documentos por
        ticking y el segundo era la tabla de posiciones, que no necesita saber que subes
        un entero por segundo. Ahora se escribe al arrancar, cuando **su fila cambia**, o
        cada cinco minutos. Con lo que se gana: **de 780 a unas 352 escrituras por
        hora**, y un jugador que deja la partida abierta sin hacer nada **deja de
        escribir en el ranking por completo**.
      - [x] **La firma se compara con lo que la fila enseña, no con el estado entero.**
        Cambiar un contador que la fila ni muestra no es un motivo para escribirla, y
        escribir una fila idéntica se cobra igual.
      - [x] **La red de seguridad de la partida pasa de quince a treinta segundos.** No
        se toca el guardado de una compra, una forja o una ascensión: eso sigue siendo en
        el acto. Lo que se alarga es el temporizador de lo que se produce solo, y para
        ese caso está la cola local, que escribe en `localStorage` de forma síncrona en
        cada guardado.
      - [x] **El latido de sesión va a la mitad de la ventana en vez de a un tercio:** 22
        segundos en vez de 15, que es el mínimo para distinguir "esta pestaña viva" de
        "la otra se ha ido".
      - [x] **Y un banco que cuenta las escrituras de verdad**, con contadores en el stub,
        porque un total estimado puede estar mal y seguir pareciendo una cifra exacta.
        Comprueba las dos mitades: que la partida se sigue escribiendo, y que el ranking
        **no** se reescribe si su fila no ha cambiado.
      **Lo que NO se ha hecho, y es deliberado:**
      - **No se toca el guardado de las acciones.** Una compra no puede esperar a que
        pase el rato: si el jugador apaga el portátil en mitad, lo comprado tiene que
        estar en la nube. Reducir eso sí perdería progreso real.
      - **No se fusionan las dos lecturas del arranque.** `consultarSesion()` y la
        carga leen `users/{uid}` dos veces, y se podrían leer una. No está hecho porque
        las lecturas son de 50.000 al día, no de 20.000, y el mezclarse con la comprobación
        de sesión toca el punto más delicado del arranque —el que decide si entras o
        no— a cambio de media lectura por arranque.
      **Y lo que sigue sin arreglar, que no es del código:** la cuota del proyecto. Con
      esto una pestaña abierta unas cuatro horas deja de quemarla, pero varias personas
      a la vez la acaban. Si el juego va a tener más de una persona a la vez de forma
      normal, la solución de verdad es el **plan Blaze**, que cobra solo lo que se pasa
      del límite diario y tiene un aviso antes de cobrar.
      **Y tres cosas más que pidió el jugador al verla, todas por lo mismo:** la ficha
      tenía datos que no servían.
      - **"Solo tiene que verse lo equipado."** Y fue mejor que la versión anterior. La
        colección entera quedaba publicada, y lo puesto se distinguía con una etiqueta
        **PUESTO** y salía ordenado primero: tres apaños para enseñar una idea que se
        resuelve de otra forma. **Ahora el recorte está antes de escribir**: el documento
        `perfiles/{uid}` lleva solo el recolector equipado y los compañeros activos, así que
        la marca **ya no hace falta** —todo lo que sale está puesto— y la ficha se lee de un
        vistazo. También sale menos: en un incremental, enseñar el inventario entero a tu
        competencia es justo lo que no se quería.
      - **"Y no olvidar las visitas que tiene a su perfil."** El contador sigue ahí, pero
        **en una ficha a medias se quita**, y no por descuido: no hay documento del que
        sacarlo, y un "todavía no te ha mirado nadie" en una ficha que no existe afirma
        algo que nadie sabe. Cuando la tarjeta existe, la cuenta está, y la primera línea
        de la ficha es suya.
      - **Los logros salían como ids crudos** (`first_click`, `first_forge`) y **la fecha
        como un número del juego** ("actualizado 1.750 T"). Los dos se transparentan:
        el nombre sale del catálogo, saltando los ids que ya no existen en él, y la fecha
        dice "hace tres días" en vez de un número de nanitas.

## Lo que se descubrió haciendo la ficha, y no estaba en ninguna lista

- **`bootNew()` no esperaba los dos turnos que sí espera `boot()`, y por eso estaba roto.**
  Esto no lo pidió nadie y no se ve en el juego: es un fallo del **banco de pruebas** que
  `perfilCheck` destapó al arrancar una partida montada a mano. `boot()` limpia la cola y
  espera dos turnos **antes de montar el documento**, porque los bucles de pruebas
  anteriores siguen vivos y guardan al recibir su propio evento; sin esa espera, un guardado
  en vuelo escribe encima del documento recién montado. `bootNew()` no hacía ninguna de las
  dos cosas. **No se veía porque ningún banco montaba una partida nueva sin esperar**, y en
  cuanto uno lo hizo, `playthroughCheck` empezó a narrar sin recolector equipado y con
  el ingreso pasivo a cero: tres pruebas de "nacimiento" rotas por un banco que no las toca.
  Un fallo del banco disfrazado de fallo del juego, que es la confusión más cara que hay.
- **Un recorte que no se puede mirar es un recorte que no se puede comprobar.** Por eso el
  recorte de la tarjeta se lee a través de la API del motor (`tarjeta()`) y no
  reimplementado en el banco: si el banco escribiera el estado a mano, estaría probando un
  objeto que el juego nunca construye, y el día que el recorte cambie el banco seguiría en
  verde.
- **El motor tiene banderas de guardado a nivel de módulo, y eso son de todas las partidas
  del proceso.** En el navegador hay una sola partida, así que no se nota; en los bancos hay
  treinta y dos seguidas. Se intentó arreglar por ahí y se volvió atrás: la bandera nueva
  apagaba el guardado de la partida siguiente y rompía bancos que dependían del
  `setTimeout(saveToFirebase, 1200)` del arranque. **Apuntado aquí, no arreglado**, porque
  arreglarlo de verdad es tocar el arranque del motor, y eso merece su propio commit con su
  propio banco.

