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
      estaba, y en el sitio correcto... **y ya no existe, con la ruleta (B17).**
      Sin giro no hay nada que saltar: el conmutador se ha ido de Ajustes con
      ella, y el banco que lo comprobaba también. Lo que queda es el check de
      notas, que ahora sí guarda (antes tampoco guardaba nada: B17).
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
        arreglar esto: navegar vacía app antes de montar, así que `mountInto` no
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
- [ ] **B10 · Que dentro de un mismo tier haya bases distintas.** *(Ahora es F74, y
      está en marcha: desde `c28dd5e` el daño y el poder pasan por una base oculta
      —peso de 0,92 a 1,10—, así que **dos ★5 del T1 al T3 ya no son el mismo
      objeto**. Lo que queda —contenido T4–T10 y qué base suelta cada caja— está
      escrito en F74. El texto de abajo describe el estado anterior al commit.)*
      Hoy **no las hay**:
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
- [ ] **F84 · El contador de ranuras del almacén, más grande o recuadrado.** *(Para después, 9 de octubre, con captura.)*
      > "hacer este texto del almacen mas grande o recuadrarlo"
      *La captura: "91/94 (60+34) ranuras" en texto chico y sin caja, al pie del almacén. Lo pinta la línea de capacidad del almacén.*
- [ ] **F85 · El tier en la ficha del compañero, ajena y propia.** *(Para después, 9 de octubre, con dos capturas.)*
      > "falta mostrar el tier de los compañeros , al igual que en la base"
      *La tarjeta ajena enseña nombre, rareza e ingreso pero no el tier; el recolector de al lado sí lleva su pastilla T4. En la rejilla de Escuadrón de la base tampoco sale. El dato viaja en los dos sitios (`tier` en la tarjeta y en el item), solo falta pintarlo.*

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

### Lote C · ENCARGO DEL 7 DE OCTUBRE

*Lo pedido, con tus palabras. Sin tocar todavía: se escribe aquí antes de
programarlo, para que no viva solo en una conversación. Los bugs van primero
(criterio 1 del GDD): un número que se ve mal es peor que una feature que falta.*

**Bugs (se elige uno y se reproduce antes de arreglar):**

- [x] **B14 · Núcleos duplicados en el nav.** Hecho en v1.7.1.
      > "Los nucleos se muestran dos veces en el nav (sector ascensión)"
      > **Causa raíz: la página pasaba su propia píldora en `actions` y la
      > cabecera ya los enseña en su franja.** Dos cifras del mismo saldo en la
      > misma fila. Se quita la píldora; la cabecera es la fuente única.
- [x] **B15 · El buscador del almacén pierde el foco.** Hecho en v1.7.2.
      > "El buscador en el almacen tiene un placeholder cortado que sea 'buscar...' y al poner la primera letra pierde el foco del input"
      > **Causa raíz: el `focus()` se pedía al `root` viejo.** `redraw()` sustituye
      > ese nodo vía `mountInto`, así que el foco caía en el input desmontado y no
      > hacía nada. Se pregunta al contenedor (`#app`), que sobrevive a los
      > renders. Medido en `preview.html?vista=almacen` a 390×844: antes foco a
      > `BODY` tras la primera letra, ahora foco en `wh-buscar` con "a" y "ak".
      > Sin banco: es DOM real y en el stub pasaría en verde sin comprobar nada
      > (precedente A5).
- [x] **B16 · El daño crítico no funciona.** Hecho en v1.7.3.
      > "Ver el daño critico, no esta funcionando"
      > **Causa raíz: el dado no existía.** `equippedAffixEffect()` no leía
      > `critChance` y ningún cálculo lo tiraba: el afijo se enseñaba y se
      > valoraba pero nunca disparaba. Ahora `click()` tira con la probabilidad
      > del equipado y paga ×2, y devuelve `{ cantidad, critico }` para que la
      > vista lo pinte distinto ("¡CRÍT!" dorado). El crítico es del click del
      > jugador: los automáticos del árbol no critican.
- [x] **B17 · Fuera la ruleta entera.** Hecho en v1.8.0.
      > "Al deshabilitar los settings de ruleta y notas, se vuelven por default al hacer un tiro de ruleta." + "Quitar la ruleta"
      > **Causa raíz doble.** El reseteo: los dos checks se importaban pero nadie
      > los llamaba —no había manejador `change` en ningún sitio—, así que la
      > casilla se pintaba, no se guardaba, y el primer re-render la repintaba
      > con el valor viejo. La ruleta: sobraba entera, y con ella su ajuste, su
      > banco, sus dos previews y su sonido. Ahora abrir, sintonizar y forjar van
      > directo al cartel (era el camino del "saltar", ahora el único), el check
      > de notas sí guarda, y los tests del contrato del cartel viven en
      > `potencialCheck`. Se borran `rouletteSpin`, `rouletteStrip`,
      > `roulettePrefs`, `ruletaPreview`, `rouletteCheck` y `forgeTick`.
- [x] **B18 · "Ojo de Caja" no dice el 10% de qué.** Hecho en v1.8.1.
      > "'Ojo de caja' que hace puntualmente? 10% de que? especificar"
      > **Causa raíz: el bonus no hacía nada.** `crateLuck` se cobraba y ninguna
      > lógica lo leía (discrepancia 8). Ahora multiplica la parte del salto en
      > la tabla: +10% de probabilidad de que la caja dé un tier más, por nivel.
      > Sin nodo el sorteo no cambia ni un decimal (la caché sigue siendo la
      > tabla base y la suerte no se cachea). Lo cubre `saltoCheck` (+6).
- [x] **B19 · Con tarjeta AFK viva se sigue mostrando el cartel de pausa.** Hecho en v1.8.2.
      > "para despues, estoy afk y se sigue mostrando el cartel... la carta afk lo que hace es permitir que los pasivos de ingreso por segundo puedan continuar hasta que se termine el tiempo de la tarjeta"
      > **Causa raíz: la vista preguntaba otra cosa que el tick.** El tick corta
      > con `isEffectivelyAfk` (descuenta la tarjeta) y la vista con `isAfk &&
      > !hasPassiveBuff` (no la descuenta): cartel, botón parado y cero con el
      > ingreso entrando. Ahora la vista lee `estaPausado()` del motor, la misma
      > pregunta del tick. Lo cubre `tickCheck` (+5).

**Features (después de los bugs que elijas):**

- [x] **F59 · Filtros del almacén que solo enseñan lo aplicable, más filtro por tipo.** Hecho en v1.9.0.
      > "En el filtro, mostrar los filtros que puedo realizar ej: si tengo recolectores seleccionado no mostrar ordenar por click por segundo porque es un valor único de los compañeros."
      > "Falta un filtro por tipo --- es decir primero los compañeros dsp los recolectores etc..."
      > **Causa raíz: el selector era fijo y el orden por tipo no existía.** Las
      > ocho opciones salían siempre, así que elegir "por segundo" con
      > recolectores no ordenaba nada y parecía roto. Ahora cada eje sale donde
      > tiene cifras (`ORDENES_ALMACEN`), el orden por tipo agrupa compañeros,
      > recolectores, cajas y resto, y cambiar de filtro devuelve a Default si
      > el orden deja de aplicar. Lo cubre `filterCheck` (+9).
- [x] **F60 · La forja hereda rareza y afijos por probabilidad.** Hecho en v1.10.0.
      > "En la forja considerar la rareza y los afijos para la combinación final, dos comunes probablemente hagan uno común, dos objetos con 'baluarte' por ejemplo tiene altas chances de salir con ese afijo... hagamos esto para que el jugador pueda 'forzar' por probabilidades un afijo"
      > **Dos reglas nuevas, las dos en datos.** Rareza compartida: se conserva
      > 3 de cada 4 (`PROB_CONSERVA_RAREZA`); si no comparten sale la calculada.
      > Afijos compartidos: entran primero, en orden de aparición, mientras haya
      > hueco. Los compañeros quedan fuera: su eje es el potencial (diseño B2).
      > La página lo enseña antes de tirar. Lo cubre `forjaCheck` (+12).
- [-] **F61 · Apilar cajas, no solo consumibles.** Descartada: probado con sonda
      (dos pilas sueltas del mismo tier se funden al cargar y el botón las
      cuenta); el motor apila cajas en carga, alta y botón. Confusión del jugador.
- [x] **F62 · Ver el árbol pagado de cada jugador en su perfil.** Hecho en v1.11.0.
      > "cuando termines : en la parte del perfil del jugador me gustaría que se pueda ver el arbol de pasivas que tiene 'pagado' para ver que build se está armando cada jugador"
      > **Causa raíz: cable suelto.** El dato viajaba y `bloqueDeNodos()` existía,
      > pero `cuerpoDeTarjeta()` no lo llamaba. Ahora la tarjeta ajena enseña
      > "Pasivas pagadas" agrupadas por categoría, entre compañeros y logros. Lo
      > cubre `perfilCheck` (+3, a través del cuerpo renderizado).
- [x] **F63 · Dar formato al cartel de forja en serie.** Hecho en v1.12.0.
      > "para despues: este cartel ordenarlo un poco darle identacion, colores, formato, esta todo muy plano"
      > **Era un párrafo plano con cinco datos.** Ahora cada dato va en su fila
      > con etiqueta (Entran, Tiradas, Sobran, Piedras, Nano) y lo que avisa va
      > en el subtítulo. Los números siguen saliendo del preview del motor.
      > Sin banco: estructura de diálogo sobre números ya comprobados.
- [x] **F64 · El potencial en el resumen de apertura.** Hecho en v1.13.0.
      > "para despues : aca me gustaria que en los drones y los recolectores salga el potencial"
      > **Las filas de objeto enseñan sus estrellas.** Salen de `estrellasDe()`,
      > la misma de la rejilla, y solo si el premio trae el campo. Lo cubre
      > `loteCheck` (+4, vía `estrellasDeFila()`).
- [x] **F65 · Elegir si la serie usa consumibles.** Hecho en v1.15.0, con **dos
      checks por separado** como pediste: piedras y nano.
      > "para despues, aca poder tener un check para usar o no consumibles... piedras de mejora y nanoparticulas"
      > "En la forja automática agregar un check si quiere usar nanopartículas y piedras de calibración"
      La serie hoy gastaba piedras siempre y nano si el yunque lo tenía marcado.
      Ahora `autoForgePreview()` y `autoForge()` reciben los dos flags, y el
      diálogo promete y cobra con los mismos: con piedras apagadas el total es
      cero aunque haya stock, y con nano puesta gasta una por tirada. Si la nano
      no alcanza, esas parejas fallan **sin perder materiales**, el diálogo lo
      avisa con el stock, y el total cuenta lo cobrado de verdad (antes contaba
      lo planeado). El `stonesUsed` que se aceptaba y se ignoraba se va con el
      cambio. `forjaCheck` (+10: preview a cero, serie sin gasto con stock,
      +1 de potencial con nano, media sin nano, y corto de nano).

**Hecho y commiteado en v1.7.0:**
paginador de cosméticos/logros de a 10 con las flechas arriba, stock en cartas
del mercado (`getOwnedCount`, incluida la AFK que hacía sombra con su nota de
duración), pack de cristal de 675 con unidades totales en el lote, y nodo
`offline_ops` fuera del árbol. `buyCheck` +6, `arbolLoreCheck` +2.
**Consecuencia aceptada:** quien tuviera niveles de `offline_ops` comprados los
conserva guardados pero sin bonus (el agregador ignora nodos fuera del catálogo).

**Descubierto haciendo esto (arreglado en el mismo commit):** `sessionCheck` y
`perfilCheck` eran los únicos dos bancos sin `export default main()`, y el runner
hace `await` sobre ese `default`: sin export el banco corría en fondo mezclando
sus filas con los vecinos, y el conteo de sesión variaba entre corridas (11, 4,
50) sin fallar nunca. Ahora los 34 bancos dan 2184 dos veces seguidas.

### Lote D · ENCARGO DEL 7 DE OCTUBRE (segunda parte)

*Lo pedido, con tus palabras. Se escribe aquí antes de programarlo, para que no
viva solo en una conversación.*

- [x] **F66 · Unificar los expansores de mochila.** Hecho en v1.14.0.
      > "Unificar el expansor de mochila inicial... hasta 60... en definitiva conviene esperar y comprar el ultimo... y los otros se vuelven irrelevantes asi que dejemos uno... y el próximo de 60 a 100 aparece en t3 en adelante..."
      > "Unifiquemos las cartas existentes en expansor inicial, el siguiente expansor que sea intermedio por ejemplo que vaya de 60 a 120 y que salga en cajas t3 recien, y otro que salga en cajas tier 7 que llegue a 180 y asi" + "se puede llegar hasta un maximo de 240"
      **Cuatro tramos de +1 con solo techo** (sin banda mínima, como antes):
      **Inicial** hasta 60 (la única carta en tienda, 425; también en cajas
      T1-T2), **Intermedio** hasta 120 (cajas T3-T6), **Avanzado** hasta 180
      (cajas T7-T9) y **Supremo** hasta 240 (caja T10). El reparto caja→tramo
      vive en `expansorDeCaja()`. Los diez `expansorT{n}` viejos y el
      `warehouseExpander` siguen sirviendo con su techo de siempre, y el mensaje
      al llegar a un techo pide el tramo nuevo que cubre ese número (un T7 viejo
      en 85 pide el Intermedio, no un T8 que ya no sale). El logro pasa a 240.
      `consumableCheck` reescrito a los cuatro tramos + legado, `potencialCheck`
      §5 al reparto por tramos, y el resto de bancos a la carta única.
- [x] **B20 · Tope de compra de cajas y apilado.** Verificado y fijado en v1.14.0.
      > "Verificar que al comprar cajas los slots máximos que pueda comprar entren en el almacen ejemplo si tengo 10 espacios, debo poder comprar máximo 990 que equivalen a 10 stacks … Si toco apilar se deben apilar también las cajas."
      **Reproducido con sonda: no había bug en ninguno de los dos.** Con 10
      espacios libres `getBulkMax` da 990, la compra entra en 10 pilas y sobrevive
      a la recarga; y `apilar()` ya funde cajas (40+40 en una de 80, 50+50 en
      99+1 respetando el tope). Queda fijado con pruebas: el 10→990 en `buyCheck`
      (al lado del 4→297 que ya había) y el apilado de cajas en `stackCheck` §7
      (funde, respeta el tope y no mezcla tiers).

### Lote E · ENCARGO DEL 7 DE OCTUBRE (tercera parte)

*Lo pedido, con tus palabras. Sin tocar todavía: se escribe aquí antes de
programarlo, para que no viva solo en una conversación.*

- [x] **F67 · Última conexión en el punto de presencia del ranking.** Hecho en v1.15.0.
      > "Al offline agregarle la ultima conexión... que se muestre en minutos, horas, días … para evitar por ejemplo 1000000 minutos."
      Donde la fila decía "offline" a secas, ahora dice hace cuánto con el
      latido que ya trae (`textoUltimaConexion()`, al lado de `estaOnline()`):
      minutos hasta 59, horas hasta 23, días hasta 29 y después "hace más de un
      mes", así que un número absurdo no puede salir nunca. Sin latido se queda
      el "offline" de siempre. `sessionCheck` (+14: los tramos, el millón de
      minutos, el futuro, y el punto en sus tres estados).

### Lote F · ENCARGO DEL 7 DE OCTUBRE (cuarta parte)

*Lo pedido, con tus palabras. Sin tocar todavía.*

- [x] **F68 · La tarjeta ajena enseña el menú principal con sus buffs.**
      > "En el perfil del jugador en rankings me tiene que aparecer una preview del menú principal del jugador con lso buffs aplicados."
      La tarjeta ya trae el recolector equipado, los compañeros activos, los
      nodos y los logros, pero **no trae buffs ni los dos números de la base**
      (daño de click e ingreso pasivo). Hay que publicar el snapshot de buffs
      activos (`perfiles/{uid}`, con coacción y reglas si hace falta) y pintar
      el bloque "así juega ahora" en la tarjeta ajena, diciendo que es al
      guardar (los buffs caducan y la tarjeta no).
      **Visto bueno el 9 de octubre: se queda como está, sin snapshot de buffs.**
- [x] **F69 · Diez piedras por fusión, cada una más suave.** Hecho y **superado** en
      v1.15.14.
      > "Ahora se pueden agregar hasta 10 piedras de calibración reducir la probabilidad base que aumenta cada una..."
      El tope de 10 **ya estaba** (`maximoDePiedras()`), y se queda. Lo que hizo el
      encargo del 8 de octubre es bajar el aporte a **1,2 puntos** por piedra —
      diez suman 12—, no a 7 como decía este plan: con 7 cualquier tirada alta
      quedaba casi segura y la piedra dejó de ser una decisión. Ahora el botón de
      las necesarias enseña la probabilidad real cuando el 95 % ya no se alcanza.
      El plan de bajar a 7 queda escrito en el commit que lo superó.
- [ ] **F70 · Cada Ascensión pide más, y los núcleos no compran núcleos.**
      > "Ver que cada reinicio o ascensión en base a los nucleos obtenidos me vaya pidiendo mas nanitas para el próximo reset, balancerlo lo mejor posible para evitar exploits."
      Dos mitades: (a) el escalado por `totalCores` **ya existe** (cada reset
      pide `nanitesForCores(totalCores+1)`, estrictamente más que el anterior)
      y hay que fijarlo con banco; (b) **el exploit sí existe**: `core_yield`
      (+20 %/nivel) se aplica a TODA la producción histórica, así que comprar
      el nodo paga núcleos gratis sin producir. Al subir `coreGain`, lo
      retroactivo se anula en una base aparte (la cartera no se toca y el
      pendiente no se mueve: el bonus rige desde ahora). Sin campo nuevo no se
      puede: `?? 0` y las partidas viejas conservan lo ya cobrado.
- [ ] **F71 · Tarjetas x1.5 (tienda) y x2 (cajas) para compañeros.** Decidido el
      7 de octubre: **x1.5 comprable, x2 solo de cajas, 30 segundos cada una.**
      > "Que existan cards igual al x2 y x3 de clicks pero que apliquen a los compañeros, ver algo balanceado. no se si un x2 x3 seria demasiado."
      **Por qué 30 segundos y no 30 minutos:** reabrir el buff pasivo comprable
      choca con F4 (tapaba el corte del AFK). Con 30 s por carta y tope total de
      30 s no puede cubrir una ausencia (el corte es a 60 s): lo máximo que
      cubre son 29 s usándola justo antes de irse, con juego activo para
      usarla. `tarjetaCheck` se reescribe a esa invariante ("comprable ⇒ dura
      y topa por debajo de 60 s") en vez de "ninguno comprable". Precio x1.5
      por fijar contra la curva (el x2 de click vale 5000).
- [ ] **F72 · Iconos de caja distintos por tier, con brillo y color.**
      > "Hacer diferentes los iconitos de las cjas, podermos cambiarlos con mas brillo distinto colro, azul, rojo, violeta..."
      Hoy `CRATE_ICON` mapea por rareza y T1-T2 comparten cara (Común y Raro
      son el mismo 'crate'). Hay que llevar icono+acento **por tier** en
      `CRATE_META` (azul, rojo, violeta...) con el set SVG que ya existe, y un
      banco que ate que los diez se distinguen y que cada icono existe.
- [x] **F73 · El tier en las filas del resumen de apertura.** Hecho en v1.15.1.
      > "para dsp, que aca aparezca el tier de los compañeros y recolectores"
      **La línea de abajo pasa de "Común" a "Común · T1", y solo en las filas que
      lo tienen.** Las estrellas (F64) dicen *dónde cayó dentro del tier* y el tier
      dice *cuál es*: son las dos dimensiones del objeto y sin las dos veinte "Dron
      Centinela" de una caja T1 son veinte filas idénticas, y no hay forma de
      compararlas sin abrir el almacén, que es justo lo que el resumen viene a
      evitar.
      **LO QUE NO LLEVA TIER Y POR QUÉ.** Las nanitas y los cristales no son
      objetos de un tier, y las cajas ya lo dicen en su nombre ("Caja T2"): ponerle
      un T a una moneda sería inventar el dato, que es lo que este resumen no hace
      nunca. **Y EL SALTO SÍ LO LLEVA, y por eso tiene su propio `if`:** es el
      premio de la caja, y sin esto sería la única fila sin nivel — la que más
      importa y la única que se quedaría a medias.
      El orden es el de las preguntas del jugador: qué es (nombre) → de qué calidad
      (rareza y tier) → de qué clase de premio es (la unidad). `tierDeFila()` está
      exportada para el banco por el mismo motivo que `estrellasDeFila()`: la regla
      es qué fila lleva tier, y una prueba que la escribiera a mano sería su segunda
      copia. `loteCheck` (+8), incluido el tier corrupto que cae a nada y no a "T0".

### Lote G · ENCARGO DEL 7 DE OCTUBRE (quinta parte)

*Lo pedido, con tus palabras. **El diseño está cerrado en conversación y esto es
su transcripción**: una decisión que solo vive en un mensaje no existe dentro de
tres meses, y esta toca la economía entera.*

- [x] **F74 · Diez bases por tier, ocultas, con más cuanto más raras.** Hecho en v1.15.17:
      200 bases por lado y tier con nombre y lore, sorteo ponderado en generación, forja que
      promedia posiciones, migración con sorteo y recalcula, y techo con base. Banco nuevo
      `basesCheck` (29) con contenido, sorteo, forja, migración y las cinco invariantes de
      balance; la tabla de la entrada se corrigió con números medidos (el god fresco no gana
      al vecino: manda el redondeo de tiers bajos). `leyendaCheck` sigue en verde.
      > "podremos hacer que para cada Tier existan 10 bases distintas tanto de compañeros como de recolectores... y entre ellas algunas mas dificiles de conseguir porque tienen mejores bases? entre uno de ellos va estar el mejor de ellos con la menor probabilidad , cosa de hacer divertido que los jugadores busquen las bases... de paso esto va a modificar la forja... cada Base de cada tier va a tener un peso y depende lo que combine va a dar mejor o menor resultado"
      > "primero calculamos la base y dsp le aplicamos potencia y niveles"
      > "creería que si fijate que nada se desbalancee... y me gustaría que un tier inferior mejorado pueda llegar a superar una base superior... si no el jugador tiene a esperar el siguiente tier y listo"
      > "no hace falta mostrarlo , que quede oculto esta bien para que los jugadores se den cuenta solos"
      > "y si , seria lo mismo para los compañeros"

#### EL MODELO, QUE SON TRES COSAS DISTINTAS Y UNA DE ELLAS YA EXISTÍA

**LA BASE DEJA DE SER EL NOMBRE.** Hoy `nombreDeArriba()` elige entre **tres** nombres
del tier **parejo** (`rand(0, lista.length - 1)`), y el nombre no cambia nada del
item: el daño sale de `danioDeRango(tier, potencial)` y el poder del compañero de
`poderDeCompanero(tier, potencial)`. O sea que **dos T1 con el mismo potencial son el
mismo objeto con dos nombres distintos**, y eso es la mitad de B10.

Con F74 hay **diez bases por tier y por lado** —200 en total—, y cada base lleva
**dos números que no son el mismo**:

| Número | Qué es | Para qué |
|---|---|---|
| **Peso de stat** | Cuánta recolección trae (daño por clic / ingreso por segundo) | **La caza.** Es lo que el jugador busca |
| **Peso de drop** | Qué tan rara sale de la caja | La hacen rara sin que nadie lo diga |

**El mejor stat es el de menor probabilidad**, que es lo que se pidió: el premio de
la caja es una base buena, y nadie la compra porque no se vende.

#### EL POTENCIAL SIGUE SIENDO UN STAT APARTE, Y MULTIPLICA

> "quiero que la potencia siga siendo un stat aparte que multiplica para hacer mas variado los items"

Esto es lo que **resuelve B10 en limpio**: el problema viejo era que el potencial
**decía ser** el stat y la posición en el rango también lo era, y los dos no
pueden serlo. Aquí cada uno tiene su rol y ninguno pisa al otro.

```
1.  baseDelTier × multiplicadorDeBase(base oculta)      →  la caza
2.  × multiplicadorDePotencial(★1..★5)                  →  lo que se ve
3.  × multiplicadorDeNivel(nivel)                       →  los cristales, al final
```

**El orden lo pidió el jugador** ("primero calculamos la base y dsp le aplicamos
potencia y niveles"), y el nivel **al final** es lo que hace que la caza premie dos
veces: un god-roll no solo pega más, es que **aprovecha más cada nivel**. Con el
nivel antes, los dos ejes se mezclarían y no se sabría cuál de los dos premia.

**Escala del potencial (la implementada):** ★1 ×1,2 · ★2 ×1,4 · ★3 ×1,6 · ★4 ×1,8 ·
★5 ×2,0, o sea `1 + 0,2 × potencial`. El plan decía ×1,0–×2,0 pero el motor multiplica
desde ×1,2: no se toca la fórmula, se corrige la línea.

**Y LA BASE ES ±10% ALREDEDOR:** de ×0,92 a ×1,10. Suficiente para que dos T1 ★3
se noten distintos al pegarlos, sin destronar a las estrellas. Si la base moviera
mucho, el potencial dejaría de importar y volvemos al problema de "dos stats".

#### LA FORJA: PROMEDIO, Y DE LAS DOS COSAS

Lo que el jugador escribió: *"supongamos que tenemos dos T1 cuya ponderacion es 5
porque son los de la mitad del tier... en ese caso va a salir un tier 2 con
ponderacion 5 o a mitad de base"*.

**La respuesta es ponderación 5**, porque 5 es el medio de 1..10: la base media es
media de base, no "media del tier". Y **el potencial se promedia aparte**, cada uno
en su escala, porque son dos ejes distintos y promediar los dos juntos daría un
número que no es ninguno de los dos.

```
baseForjada       = media(baseDeLosDosMateriales)          → 1..10
potencialForjado  = potencialFusionado([p1, p2])           → ya existe, no se toca
```

**Y CON SECUENCIA, PORQUE ES LA CONSECUENCIA DE LA REGLA.** La ea de la base es
**media, y sin bonus**: dos bases 10 dan un 10, y dos 5 dan un 5. Es coherente con
la regla del potencial (`promediar nunca sube`, documentada en `potencialFusionado`)
y con lo que la forja es: **conservar lo que ya tienes**, no mejorarlo. Si algún día
quiere un plus de forja, es una decisión aparte y **tiene que poder compensar un
material flojo**, que es lo que hace que la pregunta sea "¿me vale esto o busco
otro?" en vez de "nunca rechazo nada".

**Y ROMPE EL TECHO DE NIVEL DE LOS MATERIALES.** `collectorMaxLevel()` es
`20 + potencial × 3`, así que un ★5 se más bricks arriba. Con la base como segundo
eje, el techo debería pasar a depender de los dos, y **eso es una decisión de
equilibrio** que está sin tomar: hoy un 10/10 con ★1 subiría mucho menos que un 5/5
con ★5.

#### EL BALANCE: MEDIDO ANTES DE PROGRAMAR

**Tu condición —"un tier inferior mejorado pueda superar una base superior"— se
cumple con holgura, y era lo que había que comprobar antes de escribir nada.**

Medido con las fórmulas reales (`danioDeRango`, `multiplicadorDeNivel`,
`rangoDePoder`) y la fórmula nueva. Medido de verdad en `basesCheck`: el salto
entre tiers es ×1,75 (no ×1,62) y el redondeo de tiers bajos se come el solape en
fresco —un T1 god fresco pierde con un T2 flojo por uno—. Donde la caza decide de
verdad es con niveles: el maxeado gana al vecino en los nueve saltos.

| Caso | Resultado | Por qué |
|---|---|---|
| **T1 god-roll fresco (10/★5) vs T2 flojo (1/★1)** | 11 vs 12 — **gana el T2** | En fresco manda el redondeo de tiers bajos, no la caza |
| **T1 god-roll fresco vs T3 flojo** | 11 vs 25 — **gana el T3** | **No salta dos tiers** |
| **T1 maxeado (10/★5/nivel 35) vs T2 recién salido** | 59 vs 9 — gana ×6 | La inversión premia |
| **T1 maxeado vs T6 flojo** | 59 vs ~85 — gana el T6 | La escalera se conserva arriba |
| **Medio vs medio (5/★3)** | **el tier de arriba siempre gana** | La escalera no se rompe |

**Y ESTO YA ERA ASÍ HOY.** Con la fórmula actual, un T1 ★5 al techo (45) también
aplasta a un T2 flojo (13): era la mitad de B9 que sí se cumplía y la otra mitad
—the gap vs el potencial— la que no. **F74 no inventa la propiedad: la conserva y
le suma la caza de bases.** Es importante decirlo porque significa que el riesgo
de desbalance de F74 es **menor** que el de abrir el abanico del potencial, y ese es
el que hay que vigilar.

#### LO QUE TIENE QUE FIJAR EL BANCO

`balanceCheck` se reescribe con **tres invariantes**, y las tres son lo contrario de
`basesCheck` fija **cinco invariantes** (no `balanceCheck`, que es de precios), y son lo contrario de
"el tier manda":
- **Medio contra medio, el tier de arriba gana.** La escalera no se deshace.
- **Maxeado contra flojo, el de abajo gana.** Invertir tiene que seguir valiendo.
- **Fresco contra fresco no salta dos tiers, y maxeado contra flojo gana el de abajo en los nueve saltos.** El cazador no puede saltarse el peldaño, y la inversión siempre paga.

**Y DOS MÁS QUE SON DEL SISTEMA NUEVO, no del rebalanceo:**

- **La mejor base sale menos que la peor**, y por un margen medido, no por
 дельность. Es la invariante de la caza.
- **La base y el potencial son ejes independientes**: dos items con la misma base y
  distinto potencial tienen que pegarle distinto, y dos con el mismo potencial y
  distinta base también. Si alguna vez coinciden los dos, la base **no se está
  aplicando** y el banco lo canta.

#### LO QUE FALTA DECIDIR ANTES DE EMPEZAR

**NINGUNA: las cinco están decididas (3 en `[v1.15.14]`, 2 el 9 de octubre).**

| # | Decisión | Por qué esta |
|---|---|---|
| **1** | **Techo de nivel: `20 + potencial × 2 + base × 0,5`** | Baja el peso del potencial de `×3` a `×2` **a propósito**: la base es el eje nuevo y si el techo no lo mirara, invertir en una base buena no rinde nada. El `×0,5` es suave porque **la base solo mueve ±10%**: si contara igual que el potencial, una base buena en un ★1 superaría a una base floja en un ★5 y volveríamos al problema de "dos stats". Que la base suba **un punto de nivel por cada dos puntos de base** hace que cazarla valga, sin que el techo lo sea todo. |
| **2** | **Curva de drop lineal, `11 − posición`** | La mejor base (posición 10) sale con **peso 1** y la peor (posición 1) con **peso 10**: diez veces menos. Es lo que pidió el jugador —"va estar el mejor de ellos con la menor probabilidad"— y una exponencial lo habría hecho tan raro que nadie lo vería salir. **Lineal se nota en una tarde de cajas; exponencial se nota en un mes.** Y el techo es el mismo para todos, así que el peso **no se inventa**: solo reparte. |
| **3** | **Las diez de golpe, sin fases** | Decidido por el jugador, con la recomendación contraria escrita: 200 bases + 200 lores es **el lote de contenido más grande del proyecto**. Se hace entero **porque F74 toca a la vez la generación, el botín, la forja, el techo y la migración**, y una versión a medias de eso no se puede medir: o el mecanismo entra completo y se mide la caza, o no hay nada que medir. **El riesgo es de contenido, no de código.** |
| **4** | **Por lado: 200 en total, no tabla compartida** | Decidido por el jugador el 9 de octubre: recolectores y compañeros cazan en tablas separadas con su propio tema por tier. Las 30 de T1–T3 quedaron en recolectores y se escribieron sus 30 de compañeros. |
| **5** | **Migración con sorteo y recalcula** | Decidido por el jugador el 9 de octubre: lo viejo sin base recibe una sorteada con sus pesos y su daño/poder pasa por ella (±10%). Sin sorteo la caza no valdría para lo que ya tienes. El nivel no se toca aunque quede por encima del techo nuevo. |

**Y POR QUÉ ESTA TABLA ESTABA SIN RELLENAR.** Las tres se decidieron en la conversación y
**no se llegaron a escribir aquí**, así que el siguiente las habría vuelto a abrir. Un
acuerdo que vive solo en un chat es un acuerdo que se pierde.

#### LO QUE HAY QUE MIRAR JUGANDO

**`balanceCheck` comprueba que los números encajen entre sí, no que la partida
dura lo que tiene que durar** (P4). Y F74 cambia las dos cosas de las que la partida
depende: **qué se compra** (ahora hay una caza dentro de cada tier) y **qué se
forja** (ahora importa la base de los padres). La cuenta de arriba dice que no se
rompe el equilibrio; el ritmo de partida no lo dice nadie y solo se mide jugando.

---

### Lote H · ENCARGO DEL 7 DE OCTUBRE (sexta parte)

*Lo pedido, con tus palabras. **Va después de F74**, que está ya en marcha: las
tres primeras piezas del expansor tocan el mismo código que F66 dejó escrito, y
mezclarlas con el cambio de bases haría imposible atribuir un fallo.*

**Bugs primero (criterio 1 del GDD: un número que se ve mal es peor que una
feature que falta):**

- [x] **B22 · La forja falla y aun así entrega el item.** Hecho en v1.15.1. **No
      era un bug del motor: era un rechazo pintado como un fallo.**
      > "A veces la forja falla y sin embargo me da el item… ver por favor es un gran bug.(Cuando lo hago manualmente)"
      > "cuando forjo manualmente me aparece un cartel de fallo pero dsp un flash verde y en el almacen se crea el item"
      **Lo que se midió antes de tocar nada, porque "a veces" en un bug de dado
      significa que la prueba pasa sola:** con el dado fijado a fallar, ni
      `attemptForge` ni `forgeCollector` entregan item —`success:false` sin
      collector, materiales fuera y consuelo—; en el navegador un click da **un**
      cartel y **un** aviso, no dos; y `root` no acumula listeners (un aviso tras
      tres redraws). **Ninguna de las tres hipótesis de la lista cabía.**
      **LA CAUSA RAÍZ: EL MOTOR DEVOLVE `success:false` EN TRES CASOS Y LOS TRES
      PINTABAN LO MISMO.**

      | Caso | ¿Hubo tirada? | ¿Materiales? | Qué pintaba la card |
      |---|---|---|---|
      | Materiales que no valen / no hay piedras | **No** | **No se gastan** | "Forja fallida · los materiales se gastan igual" |
      | La tirada salió mal | Sí | Se gastan | "Forja fallida · los materiales se gastan igual" |
      | Acierto | Sí | Se gastan | "Forja completada" + item |

      **LA CARD AFIRMABA UNA COSA FALSA EN DOS DE LOS TRES, Y `msg` —EL MOTIVO
      EXACTO— NO LO LEÍA NADIE.** El jugador ve el fallo rojo, cierra, y sus dos
      materiales siguen en el almacén: su lectura es que la forja le dio algo.
      **El discriminante ya existía en el contrato y no se usaba:** el motor pone
      `chance` cuando hubo tirada y no lo pone cuando el rechazo fue anterior, así
      que `typeof result.chance === 'number'` separa los dos sin un campo nuevo.
      **La card del rechazo dice el motivo y que el yunque quedó intacto**, y suena
      el error de botón y no el golpe de forja (un rechazo no ha tocado el yunque).
      `forjaCheck` (+7): que el fallo trae `chance` y el rechazo no, que ninguno
      trae item, que el motivo nombra lo que falta y que **el rechazo no gasta los
      materiales**.
      **Lo que sigue sin poder comprobarse aquí:** el pintado de la card es DOM, y
      lo que se mira es la fila que dice "Intacto. No se gastó ningún material".
- [x] **B23 · La Tarjeta AFK no desactivaba una de las siete puertas.** `[v1.15.13]`
      > "La tarjeta afk no esta funcionando correctamente , debería deshabilitar todas las funciones que habilita el afk. El cartel que muestra el afk , el bloqueo de la ganancia pasiva , el bloqueo por espera , el bloqueo por pestaña , el bloqueo por ventan y todo lo demás que habilite el afk."
      **La lista del jugador era la especificación, y el banco la recorre entera.** Hecho: el
      tick tiene **cuatro puertas** al ingreso y **ahora las cuatro preguntan a la tarjeta**.
      **LA QUE SE QUEDABA ERA LA ESPERA POR CLIC.** Se llama así porque es el peaje que se
      paga al volver de estar ausente: el tick había acumulado medio segundo de más y sin un
      click de verdad se contaría tiempo que no le corresponde. **Con la tarjeta puesta el
      ingreso nunca se cortó, así que no había peaje que pagar** —y se estaba cobrando igual.
      **LO IMPORTANTE ES QUE ARREGLARLA EN UN SOLO SITIO NO BASTABA.** Poner la condición en
      la puerta del tick deja `awaitingClickAfterAfk` **colgada**: ya no hay puerta que la
      mire, pero el clic se la lleva, y el jugador pierde ingreso justo en el caso contrario,
      cuando la tarjeta **ha caducado** y sí tendría que esperar. Por eso la espera **deja de
      crearse** cuando hay tarjeta, y no solo de aplicarse: **dos sitios con la misma pregunta
      y la misma respuesta, o la contradicción vuelve.**
      **LO MEDIDO, Y SALIÓ EN EL DETALLE DE UNA COMPROBACIÓN:** sin tarjeta el watchdog corta
      el intervalo y el tick deja de correr (`isAfk=false`, saldo 0). **Con tarjeta el tick
      sigue vivo** (`isAfk=true`, saldo 110). Eso **es** el bug, visto de lado.
      **LO QUE ESTA COMPROBADO Y LO QUE NO, Y POR QUÉ.** El banco comprueba el **efecto**
      (entra dinero / no entra) y **no** la bandera interna, porque `estaPausado()` empieza
      con `if (!isAfk) return false` y responde por **este instante**. Y **el disparo exacto
      del bug —volver con una tecla en vez de con un clic— no se puede probar**: el `domStub`
      de `verify/` tiene `addEventListener() {}`, **no guarda los listeners**, así que un banco
      no puede lanzar un `keydown`. Se comprueba **la condición que usa el arreglo**, y está
      escrito por qué.
      **Y HACÍA FALTA TIEMPO REAL, NO TICKS.** El ingreso pasivo se cobra por **segundos
      enteros** (`msParaCobroPasivo`), así que correr los ticks con esperas de 0 **no pasa ni
      un segundo**: el saldo se quedaba en 0 con y sin tarjeta y la comprobación daba falso
      **por el reloj del banco, no por el motor**. El motor cuenta con `Date.now()` para que
      el navegador no le engañe; **el banco tampoco puede engañarse a sí mismo**.
      `tarjetaPuertasCheck` (nuevo, 5): **sin tarjeta el ingreso se sigue cortando** (R10
      intacto, y va **primero** a propósito), con tarjeta entra; la espera por clic no se crea
      con la tarjeta puesta; **si la tarjeta caduca mientras estás fuera el corte vuelve**; y
      **la tarjeta sigue durando 10 minutos**, porque arreglar una puerta no puede ser tocar el
      reloj de la otra.
      **Y UN BANCO MUDO QUE PARECÍA UNO VERDE:** la primera versión **no exportaba
      `default`**, así que el runner importaba `undefined`, `await undefined` no lanzaba nada
      y el banco salía con `exit=0`. **Un banco que no existe y uno que pasa se ven igual**,
      que es el mismo agujero que `run.mjs` con los bancos ausentes de la lista.
      > "La tarjeta afk no esta funcionando correctamente , debería deshabilitar todas las funciones que habilita el afk. El cartel que muestra el afk , el bloqueo de la ganancia pasiva , el bloqueo por espera , el bloqueo por pestaña , el bloqueo por ventan y todo lo demás que habilite el afk."
      **Ojo al nombre: B9 y B19 ya arreglaron la mitad de esto** (el cartel y el
      botón parado leen `estaPausado()`, la misma pregunta del tick). Lo que queda es
      que la tarjeta **anula el corte** y con ella todo lo que el corte frenaba.
      La lista del jugador es la lista de cosas que hay que comprobar una por una,
      y **`tarjetaCheck` es el banco que las tiene que recorrer todas** —no solo la
      duración (F71)—: con la tarjeta puesta, ninguna de esas siete puede cortar el
      ingreso, y sin ella, todas cortan.
- [x] **B24 · Un consumible decía "no tiene efecto conocido".** `[v1.15.12]`
      > "me dice este consumible no tiene efecto desconocido lo podríamos arreglar?"
      **LA HIPÓTESIS DE AQUÍ ERA FALSA, Y CORREGIRLA ES LA MITAD DEL TRABAJO.** Apuntaba a
      que `EXPANSOR_CONSUMABLES` se construye con `Object.fromEntries` sobre
      `EXPANSOR_TIERS` y a que el `switch` seguía hablando de `expansorT{n}`. **Las dos cosas
      son ciertas y ninguna es el fallo**: los cuatro `buffId` nuevos están bien, el `switch`
      los tiene escritos uno a uno (`gameLoop.ts:5106`), el botín de las cajas mete
      `buffId: def.buffId`, y hasta **un expansor viejo sin `buffId` guardado resuelve por el
      nombre**. Trece comprobaciones sobre expansores, todas en verde.
      **LA PISTA ESTABA EN LA FRASE DEL JUGADOR Y LA PASÉ POR ALTO DOS VECES:** dijo "**este
      consumible**", no "el expansor". Los expansores no eran el problema.
      **EL CULPABLE: F4 RETIRÓ `clickBuff` Y `passiveBuff`, Y NO LOS SACÓ DEL `switch`.** F4
      quitó los dos amplificadores de la tienda porque un buff pasivo comprado rompe R10. Se
      borraron del catálogo, de la inferencia por nombre y de la barra asignable: todo bien.
      **Pero el `switch` de `useConsumable` no tiene `case` para los dos**, y un item de un
      guardado anterior a F4 llega con `buffId: 'clickBuff'`, que **es un `buffId`
      verdadero**, así que pasa la puerta de la línea 5063 y cae en el `default` de la 5186.
      **Y POR QUÉ A UNO SÍ Y A OTRO NO:** el item viene de una partida vieja. **Un jugador
      nuevo no lo ve nunca**, porque nadie le da ese item, y por eso ninguna prueba de
      partida nueva lo detecta.
      **LO QUE NO SE HIZO, Y ES LA DECISIÓN.** Devolver el buff sería **deshacer F4**: un x2
      o x3 al click o al pasivo comprado con nanitas es justo lo que R10 prohíbe. **El item ya
      no sirve y hay que decirlo, pero diciendo qué es**: ahora el mensaje explica que se
      retiró, qué multiplicaba y que no vuelve, en vez de un "no tiene efecto conocido" que
      no explicaba nada.
      **Y MI PRIMERA COMPROBACIÓN PASABA EN FALSO, QUE ES PEOR QUE NO TENERLA.** Buscaba
      `/efecto desconocido/i`; el mensaje real dice "no tiene efecto **conocido**". La
      expresión no coincidía con nada, el `!` daba `true` y el banco daba verde **sin haber
      comprobado el fallo que existía**. Ahora va **la cadena literal del motor**. **Una
      comprobación que pasa porque su patrón no encuentra nada parece que vigila y no vigila
      nada.**
      `expansorCheck` (nuevo, 15): los cuatro expansores están en la tabla, **resuelven a su
      tramo con su techo**, **se usan de verdad y suben la capacidad**; un expansor viejo sin
      `buffId` guardado también se usa; y los dos amplificadores retirados **no dicen "no tiene
      efecto conocido"** sino lo que pasó.
- [x] **B27 · Una lectura a medias dejaba al jugador sin partida.** Hecho en v1.15.1.
      **NO HABÍA NADA PERDIDO.** El jugador se encontró con una partida en blanco (140
      nanitas, Blaser de partida, 0 núcleos) y en la consola de Firestore sus datos
      estaban **enteros**: 1.687 millones de nanitas, 2012 forjadas, 3984 cajas.
      Nunca se perdió nada: **el juego no llegó a leerlos.**
      > "algo reinicio mi cuenta se me reinicio el perfil incluso, le pasa a otro usuarios igual"
      **LA CONSOLA DIJO TODO:**
      `FirebaseError: [code=resource-exhausted]: Quota exceeded.` seguido de
      `Using maximum backoff delay` y de
      `TypeError: Cannot read properties of undefined (reading 'some') at gameLoop.ts:1534`.
      **LA CUOTA DE FIRESTORE SE AGOTÓ, LA LECTURA LLEGÓ A MEDIAS, Y UNA LÍNEA DE LA
      CARGA ASUMÍA QUE EL ALMACÉN VENÍA.** El `TypeError` tumbó la carga entera, el
      `catch` puso `partidaNoCargada` —que desactiva el guardado, y por eso no se
      pisó nada— y el jugador se quedó con los defaults de un motor al que nunca le
      dejaron leer el documento. **Y "le pasa a otros usuarios igual" no era un misterio:
      era la cuota, que es del proyecto entero.**
      - **La línea era `(data.warehouse as any[]).some(...)`**, y `data.warehouse`
        puede no venir. Ahora coacciona, que es R11 ("coacciona al cargar").
      - **Y EL SEGUNDO ARREGLO, QUE ES EL IMPORTANTE.** Arreglar solo el crash es
        **peor**: la carga dejaría de reventar, el juego creería que ha cargado bien y
        **sí guardaría**, escribiendo una partida en blanco encima de la buena. El
        crash estaba haciendo de red de seguridad sin que nadie lo supiera. Así que
        ahora una carga a medias **marca `partidaNoCargada` y no guarda**, con un
        `console.error` que dice qué campos faltaron y por qué se sospecha de la cuota.
      `cargaIncompletaCheck` (nuevo, 11): la carga no revienta, los cuatro campos que
      pueden faltar no la tumban, **la carga a medias no deja guardar**, y una partida
      normal sigue sobreviviendo a la recarga.
      **LO QUE QUEDA, Y ES LO DE VERDAD:** la causa raíz es **la cuota de Firestore
      agotada**, y eso no lo arregla este commit. El plan Spark da 50.000 lecturas y
      20.000 escrituras al día. **La parte de la partida está resuelta en B28** (no se
      escribe cuando el documento no ha cambiado; una hora mirando pasa de 120 escrituras
      a cero). **Lo que queda son los relojes que no son la partida** —el latido de
      sesión y la presencia—, que viven fuera del motor y siguen escribiendo en idle.
      **Sin una subida de plan o sin tocar esos relojes, esto vuelve**, y esta vez sin la
      red de seguridad del crash.
- [x] **B28 · Bajar el ritmo de escritura, que es lo que agotó la cuota.** `[v1.15.2]`
      **Sale de B27 y era la mitad que de verdad importaba**, porque B27 solo quita el
      síntoma. Hecho: **el guardado no escribe si el documento no ha cambiado**, que es
      la palanca que ya se usaba con el ranking y que no se usaba con la partida.
      **LO QUE DECÍA ESTA ENTRADA Y ERA FALSO, Y POR QUÉ IMPORTA.** Escribía "el
      guardado, cada 15 segundos" y "el latido, cada 15 segundos". **Los dos están mal**:
      el guardado va **cada 30 s** (`RITMO_GUARDADO_MS`, ya subido antes a propósito) y
      el latido va **cada 22,5 s** (`VENTANA_MS / 2`, la mitad de la ventana de 45 s).
      Una cuenta hecha sobre números inventados da una cifra con aspecto de exacta, así
      que los números se **midieron** en vez de multiplicarse: `cuotaCheck` cuenta lo que
      el stub de Firestore ha visto de verdad.
      **LA CUENTA, YA MEDIDA.** El arranque cuesta **5** escrituras, una compra **1**, y
      **un tick del juego, 0** —el motor ya no escribe por su cuenta. El caso que quemaba
      la cuota era el guardado automático: **una pestaña abierta mirando el almacén sin
      tocar nada eran 120 escrituras de la nada por hora**, y la cuota es de 20.000 al día
      **para el proyecto entero**, no por jugador. Ahora esa hora cuesta **cero**.
      **LA PALANCA, Y POR QUÉ NO BAJAR EL INTERVALO.** Bajar el guardado a 60 s sin más
      empeora justo lo que el guardado protege: comprar y recargar al instante perdería la
      compra. La pregunta que sí vale es "¿ha cambiado el documento?", y esa se hace
      **comparando el documento entero**, no enumerando campos.
      **DOS ERRORES PROPIOS QUE SALIERON HACIÉNDOLO, Y LOS DOS ESTABAN EN EL BANCO.**
      · **La firma iba en el sitio equivocado.** Firmaba **antes** del `setDoc`, con lo
        que al escribir se confirmaba una escritura que quizá ni ocurrió: con la red
        caída, el fallo dejaba la firma puesta y **el reintento de quince segundos —que
        existe justo para eso— se saltaba**. La partida se quedaba sin guardar hasta que
        el jugador moviera algo. Ahora **se firma después del `setDoc`**, y hay dos
        pruebas que lo atan en los dos sentidos.
      · **Enumerar campos no funciona.** La primera versión firmaba "saldo, producción y
        clics" y **se olvidaba de los buffs**: la Tarjeta AFK se usaba, el buff se
        aplicaba y la firma no se enteraba. **Siete pruebas del guardado se pusieron
        rojas y tenían razón.** La regla que sale de ahí: **no se escribe una lista de lo
        que importa, se compara lo que se va a escribir entero.** Una lista se queda
        corta en cuanto alguien añade un campo, y el olvido es silencioso.
      `cuotaCheck` (nuevo, 10) y `guardadoCheck`/`queueCheck` actualizados: una hora
      mirando cuesta 0 escrituras; el pasivo y el clic **sí** se guardan; un guardado
      **fallido se reintenta** al volver la red; y con la red aún caída **se sigue
      intentando**, porque el documento no está en el servidor.
      **LO QUE QUEDA, Y NO ES DE ESTE COMMIT.** La presencia (60 s) vive en
      `sessionService`, fuera del motor, y **sigue escribiendo con la pestaña en idle**: son
      60 por hora que este commit **no toca**. **El latido sí está resuelto, en B30.**
      Sin una subida de plan, B27 **vuelve**, y esta vez sin el crash que hacía de red de
      seguridad.
- [x] **B30 · El latido de sesión no necesita su propio viaje.** `[v1.15.3]`
      > "hay forma de mejorar esto para evitar 20k diarios?"
      > "necesito si o si bajar ese rate porque tengo 20k diarios"
      **Sale de B28, que quitó las escrituras del guardado en reposo pero dejó el latido
      entero.** Hecho: **el latido viaja dentro del documento de la partida**, que se
      estaba escribiendo igual cada 30 segundos. **Una pestaña que 24 horas seguidas gastaba
      8.160 escrituras; ahora gasta 5.280**, y el ahorro es entero de un solo sitio.
      **LA CUENTA ANTES, MEDIDA Y NO ESTIMADA.** Por hora y por pestaña: **160 del latido,
      60 de la presencia y 120 del guardado** = 340. El latido se llevaba **casi la mitad**,
      y era **gasto puro**: `anotarLatido()` hacía un `setDoc` con `merge: true` en
      `users/{uid}`, y el guardado hacía otro `setDoc` con `merge: true` en **`users/{uid}`**.
      **El mismo documento.** Firestore cobra una escritura por documento, así que el
      latido pagaba un viaje entero para mover un campo que ese viaje ya movía.
      **POR QUÉ NO SE PUEDE SIMPLEMENTE BAJAR EL RITMO DEL LATIDO.** Porque el latido es un
      cerrojo con `VENTANA_MS = 45 s`: bajarlo alarga el tiempo que el jugador espera
      después de cerrar el portátil, y eso es un fallo visible. La ventana **no se toca**.
      **LO QUE SE HACE ES QUE EL LATIDO DEJE DE ESCRIBIRSE SOLO**, no que se escriba
      menos: conserva su reloj de 22,5 s y su `setDoc` propio para cuando el guardado no
      está pagando un viaje, y **se sube al barco cuando ya se está pagando**.
      **LO QUE NO SE ROMPE, Y ESTA ES LA PARTE QUE IMPORTABA.** El latido **no** puede
      depender solo del guardado, porque B28 dejó de guardar cuando nada cambia: con la
      pestaña en reposo el documento no se escribiría nunca, el cerrojo caducaría a los 45
      segundos y **el jugador encontraría su cuenta libre desde el móvil**. Por eso el
      campo lo pide el servicio (que es quien sabe si toca) y el motor solo lo lleva. El
      banco mide que el reloj propio sigue dando el campo, no solo el guardado.
      **UN BUG PROPIO, Y ES EL TERCER VECZ QUE SALE EL MISMO ERROR.** El reloj del latido
      lo puse **antes** de escribir, "para no repetir el trabajo de comparar si se
      repite". Con la red en su sitio daba igual. **Con la red caída es un agujero**: el
      `setDoc` lanzaba, el reloj **ya estaba puesto**, y durante los siguientes 45 segundos
      —justo la ventana del cerrojo— la cuenta se creía viva sin estarlo. **El que pierde la
      partida es el que no tiene red, que es el que más lo necesita.** Ahora el reloj se
      mueve en `confirmarLatido()`, que se llama **después** del `setDoc`. Es la misma regla
      que B28 con la firma de la partida: **firmar antes de escribir es afirmar que algo
      está en el servidor cuando no lo está.**
      **Y UN BUG QUE NO ERA DE ESCRITURAS, PERO SÍ DE DINERO.** En `esperarSesion()`
      había **tres** temporizadores para lo mismo, y solo se paraba uno: un `setTimeout`
      con el resto de la ventana, **otro `setTimeout` a `REINTENTO_MS`** y un `setInterval`
      a `REINTENTO_MS`. O sea que **el primer reintento se lanzaba dos veces**, y los dos
      `setTimeout` **no se paraban nunca** —seguían consultando después de que el jugador
      ya hubiera entrado, y solo se acababan al cerrar la pestaña—. Cada `probar()` es una
      **lectura**, y con la cuota al límite eso no era un detalle.
      `costeJuegoCheck` (nuevo, 8): el latido de viaje quita escrituras de verdad, el reloj
      propio sigue escribiendo, un latido recién escrito no se vuelve a pagar, y **diez
      minutos de clics seguidos no cuestan más que uno**, porque los clics se agrupan en el
      guardado.
      **LO QUE SIGUE GASTANDO, Y NO ES POCO.** La **presencia** (60 por hora y pestaña) y
      el **ranking** (12 por hora) siguen escribiendo en idle. Con 20.000 al día, esta
      versión aguanta **unas 3 pestañas o 3 jugadores**; **con un plan pagado, el problema
      desaparece de raíz** y esto es solo red de seguridad.
      **Y LO QUE EL JUGADOR PREGUNTÓ, CONTESTADO CON LA CUENTA.** Se propuso **combinar
      Firestore con `localStorage` cifrado**, y **no baja ni una escritura**: el cifrado
      protege los datos en el disco del navegador, y la cuota la cobra el servidor. La cola
      local **ya existe** (`queueCheck`) y es síncrona y sobrevive al cierre; lo que se ha
      hecho es **dejar de pagar en la red lo que la local ya sabe**.
- [x] **B31 · Desarrollo contra el emulador, para no gastar cuota probando.** `[v1.15.4]`
      > "tambien si estoy gastando en pruebas locales si se puede hacer algo"
      **SÍ, Y ERA LA MITAD DEL PROBLEMA.** El emulador estaba **declarado** en
      `firebase.json` desde el principio y **nadie lo conectaba**: `connectFirestoreEmulator`
      no aparecía en todo `src/`. O sea que **`npm run dev` escribía en el proyecto de
      producción**, con la cuenta de verdad, y **cada recarga costaba parte del presupuesto
      de los 20.000** que comparten los jugadores. Medido: **5 escrituras por recarga**,
      más **~200 por hora** mientras la pestaña está abierta.
      **LAS DOS CONDICIONES, Y CADA UNA IMPIDE UNA COSA DISTINTA.** El emulador se conecta
      solo si `import.meta.env.DEV` **y** `VITE_EMULADOR === '1'`. Con solo `DEV`, cualquier
      `npm run dev` apuntaría al cubo y nadie podría probar contra el proyecto real; con
      solo la variable, **un build de producción en una máquina que la tenga puesta
      apuntaría al emulador y la partida de todos iría a un cubo en localhost**. **Las dos
      juntas cierran las dos puertas, y la primera sola ya elimina el código del bundle.**
      **Y AUTH TAMBIÉN, O NO SIRVE.** El juego entra con correo y contraseña. Si solo se
      conectara Firestore, el acceso seguiría yendo al proyecto real: se entraría con la
      cuenta de verdad y se guardaría en el cubo. **Dos bases de datos mezcladas es peor que
      no tener emulador**, porque parece que funciona.
      **LA COMPROBACIÓN ESTÁ EN `run.mjs` Y NO EN UN BANCO, Y ESO NO ES UN DETALLE DE
      ORGANIZACIÓN.** Un banco se empaqueta con Vite, y **Vite compila sin saber que lo
      ejecuta `node`**: resuelve `node:fs` como si fuera de navegador y `readFileSync` llega
      vacío. Se probaron cuatro caminos —import estático, dinámico, `import.meta.dirname` y
      marcar los builtins externos— y **los cuatro fallaron**. `run.mjs` lo ejecuta `node`
      directamente, así que sus imports **sí** funcionan. **Y hace falta que lea `dist/`**,
      porque la protección **es invisible leyendo la fuente**: el `if` con `DEV` desaparece
      del bundle por código muerto, y **esa eliminación es la protección**. Comprobado
      compilando **con `VITE_EMULADOR=1` puesta**: `dist/` no lleva ni el aviso ni los puertos.
      Uso: `npm run dev:emulador` en una terminal, `$env:VITE_EMULADOR="1"; npm run dev` en
      otra.
- [ ] **B32 · La cifra que dije en voz alta era una estimación, y ya está medida.**
      > "podrias analizarlo y me decis cuanto gastaria un jugador jugando no se 2 o 4 horas diarias"
      **MEDIDO CON EL RELOJ DE VERDAD, y sale menos de lo que dije.** La nota de B30 decía
      5.280 escrituras al día por pestaña y **era una resta, no una medición**: suponía que
      el latido bajaría a 40 por hora sin comprobarlo. `costeRealCheck` deja correr los
      relojes de verdad durante cuatro minutos y cuenta con el contador del stub.
      **EL NÚMERO: 195–210 escrituras por hora y pestaña**, con la partida quieta, que es
      **el mínimo** porque el guardado se salta. Desglose: **160 del latido** (67%), **60 de
      la presencia** (24%) y **0 del guardado**, que es lo que consiguió B28.
      **POR JUGADOR Y DÍA:** 1 h ≈ 210 · **2 h ≈ 420 (2%)** · **4 h ≈ 840 (4%)** · 8 h ≈
      1.680 (8%). **Con 2 h al día caben unos 47 jugadores; con 4 h, unos 23.**
      **LO QUE ESTO DICE Y NO DICE.** El presupuesto **no lo exhaustion un jugador**: lo
      agotan las **pestañas abiertas sin hacer nada** y las **pruebas locales**, que eran
      producción de verdad. Con B28 + B30 + B31, un jugador normal **no vuelve a acercarse
      al tope por su cuenta**.
      **LO QUE SIGUE GASTANDO, Y ES LO QUE QUEDA SI NO HAY PLAN DE PAGO.** El latido (160/h)
      y la presencia (60/h) son **el 91% de lo que queda**. Bajarlos choca con dos cosas que
      **no son de cuota**: el cerrojo entre pestañas (45 s) y el punto rojo del ranking. **Si
      hay un plan de pago, esto deja de ser un problema**; si no lo hay, el camino es
      agrupan latido y presencia en el mismo documento, que es el mismo truco que B30 y que
      **no se ha hecho porque toca el diseño del cerrojo**.
- [ ] **B37 · En el menú no salen bien los núcleos al reiniciar.** *(Para después,
      reportado el 9 de octubre con dos capturas.)*
      > "en el menu principal no me salen correctamente los nucleos al reiniciar"
      *La evidencia: la pantalla de Ascensión dice "AL REINICIAR +1,166 K" y el botón
      "RECICLAR Y GANAR 1,166 K NÚCLEOS" (producido 10,769 B, 5 reinicios), pero el
      menú dice "Ascensión: 2 núcleos disponibles".*
      **El mecanismo, sin reproducir todavía:** la píldora (`#prestige-hint`) enseña el
      **saldo** (`state.cores`) cuando es mayor que cero, y solo si es cero enseña el
      **pendiente**. Con 2 en cartera y 1,166 K por ganar, el pendiente queda oculto en
      el menú. Falta reproducir y decidir si se enseñan los dos o el pendiente manda.
- [ ] **B38 · El daño de la fila del ranking está mal.** *(Para después, reportado el
      9 de octubre con captura.)*
      > "ahi aparece el daño esta mal jaja"
      *La evidencia: la fila propia ("TÚ", Blanqui) dice "Daño +884" y no cuadra.*
      **Candidatos sin reproducir:** foto vieja (la fila se publica cada minutos y el
      arma sube entre publicaciones), o descuadre entre lo publicado (`danoFinal`) y
      la ficha viva. Falta reproducir comparando la fila con la ficha en el momento.

- [x] **B33 · El cerrojo se apaga cuando no hay nadie mirando.** `[v1.15.5]`
      > "hace lo que creas mas conveniente y que mejore esta situacion"
      **Hecho, y son las dos cosas que se propusieron. Con 3 jugadores, la cuenta sale así:**
      antes **16.800/día (84%)**, y **cabe**, pero justa y con la condición de que nadie
      tenga una pestaña zombi. Ahora hay margen de sobra.
      **1 · LA PRESENCIA, DE 60 s A 5 MIN.** Escribía **60 veces por hora para pintar un
      punto verde en el ranking**, y el juego abierto ya dice "estoy aquí" con el latido.
      Medido: el coste por hora y pestaña pasa de **~210 a ~165**.
      **2 · EL LATIDO SOLO CUANDO HAY ALGUIEN MIRANDO, QUE ES EL ARREGLO DE FONDO.** Con la
      pestaña oculta **deja de latir**, no latir menos: la ventana de 45 s **caduca sola** y
      la cuenta queda libre. Ahorra **hasta 160/h en las horas muertas**, que es donde se
      comía el presupuesto.
      **POR QUÉ NO SE BAJA EL RITMO, Y ES LA DECISIÓN QUE MÁS IMPORTÓ.** Se podía haber
      alargado la ventana de 45 s a dos minutos y el ahorro habría sido mayor, pero **eso le
      cobra al jugador**: tras cerrar el portátil esperaría dos minutos para entrar desde el
      móvil en vez de menos de uno. **El ahorro es del jugador, pero la espera también.**
      Por eso el ahorro sale de **no escribir de más**, no de empeorar la espera.
      **Y ESTO NO ES SOLO UN AHORRO: ARREGLA UN FALLO DE FONDO.** Antes, la pestaña dormida
      seguía batiendo el latido **para siempre**, así que **la cuenta no se liberaba nunca**
      y **no había manera de entrar desde otro dispositivo**. El cerrojo estaba protegiendo
      contra la construcción durante el sueño, que no es una amenaza. **Ahora protege contra
      lo único que es real —dos sesiones activas a la vez— y ese hueco es el que se cierra.**
      **EL RIESGO QUE HAY QUE NOMBRAR, Y POR QUÉ ESTÁ CUBIERTO.** Si el latido se calla y al
      volver **no se comprueba nada**, la pestaña que vuelve **cree que tiene la cuenta y
      guarda encima** de lo del otro dispositivo: dos sesiones escribiendo, y la que vuelve
      **pisa** a la otra con una partida viejo. Eso no es cuota, es **pérdida de progreso**.
      Por eso al volver **se vuelve a preguntar** (`consultarSesion`) y, si la cuenta la tiene
      otro, **cede**: no escribe y enseña el aviso. **Solo parar el latido habría sido un
      ahorro que rompía el juego.**
      **"OCULTA" ES `document.hidden`, NO LA FOCO, Y ES A PROPÓSITO.** Un jugador puede tener
      la ventana visible detrás de otra y **seguir jugando**, y ese no puede perder el
      cerrojo. Es la misma pregunta que ya hace el ingreso pasivo.
      **LO QUE NO SE TOCA.** La ventana de 45 s, el aviso de "abierto en otro sitio", el
      latido del motor dentro del documento de la partida (ese no depende de este intervalo)
      y la espera entre pestaña dormida y jugador que entra: seguiría siendo de 45 s.
      `cerrojoCheck` (nuevo, 6): la ventana caduca —que es lo que hace que parar libere—,
      no se toca su duración, y la decisión tiene las tres ramas correctas **más el caso en
      que oculta y ocupada van a la vez**, que es el que se rompería si alguien escribiera
      `if (!oculta) escribir()`: se gastaría **y** se pisaría a la vez.
      `sessionCheck` intacto: 39/39, el cerrojo sigue bloqueando igual.
- [x] **B34 · Pantalla completa cuando la cuota se agota de verdad.** `[v1.15.6]`
      > "Using maximum backoff delay to prevent overloading the backend. hace una pantalla que indique que firestore llego a su maximo y que para continuar hay que pagar una la version premium del juego"
      **LO QUE SE PIDIÓ Y LO QUE SE CONSTRUYE, Y POR QUÉ NO SON LO MISMO.** Se pidió una
      pantalla de pago. Se hace una pantalla **honesta, sin pago**, por dos razones que
      ninguna son de gusto:
      · **El mensaje que se pegó NO es un error de cuota.** `Using maximum backoff delay`
        significa **"todavía no"**, no "no": la petición se queda esperando, no se rechaza.
        **Esa frase aparece a diario con el juego funcionando bien**, así que una pantalla
        de pago atada a ella **estaría cobrando por una espera de segundos**. La señal de
        cuota agotada de verdad es otra, y ya existe: `esCuotaAgotada()` busca
        `resource-exhausted`.
      · **Un muro de pago no funcionaría con el diseño actual.** La pantalla, el pago y su
        confirmación se guardan **en la misma base de datos** que está saturada: con la
        cuota agotada **el pago tampoco llega**. Un bloqueo que no se puede ni cobrar es un
        bloqueo, no una venta.
      **ADEMÁS, LA PANTALLA DE PAGO MENTIRÍA.** El límite **se repone solo cada día**. Pedir
      dinero para continuar por algo que va a funcionar igualmente en unas horas es cobrar
      por el reloj. **La pantalla que había ya decía la verdad** —"tu partida sigue intacta,
      el límite se repone"— y por eso el cambio es de **fondezuelo y de enganche**, no de
      texto: hoy es un aviso flotante que se va solo, y lo que hace falta es una pantalla
      que **quede**, explique y ofrezca reintentar.
      **LO QUE SE CONSTRUYE, Y YA ESTÁ.** Pantalla completa con el motivo real
      (`resource-exhausted`), que la partida **está intacta** y que **el límite se repone
      solo**, y un botón de reintentar. **Cuesta 0€ al jugador.** Se muestra **una sola vez**,
      porque el guardado reintenta cada 30 s y sin un flag la pantalla parpadearía cada medio
      minuto; y **va dentro de un `try/catch`**, porque se pinta **desde el `catch` del
      guardado**, que es el peor sitio: si la pantalla lanzara, el jugador se quedaría **sin
      guardar y sin aviso**.
      **COMPROBADO.** `cuotaPantallaCheck` (6): la señal de verdad la abre y los tres falsos
      **no** —el "todavía no", la caída de red y el fallo de permisos—, que es lo que evita
      enseñarle un problema a quien no lo tiene; y el motor **sobrevive a tres fallos
      seguidos** y **vuelve a guardar** cuando la red vuelve, que es lo que hace que la
      pantalla no pueda costarle la partida. Medido en `preview.html?vista=cuota` a **390×844**:
      **0 px de desbordamiento horizontal y el botón dentro de la pantalla**.
      **LA REGLA QUE SALE DE AQUÍ, Y ES LA QUE MANTIENE ESTO HONESTO.** El aviso de cuota
      **solo aparece con el código de verdad**, nunca por un fallo genérico ni por un
      tiempo de espera agotado: `sessionCheck` y `blocked.ts` ya separan los tres casos
      (cuota, sin respuesta, otro) porque **darle a alguien el mensaje equivocado lo
      manda a esperar lo que no toca**.
- [x] **B35 · Una carga a medias te dejaba jugar con el almacén vacío.** `[v1.15.7]`
      > "me esta dejando entrar" + consola con `resource-exhausted`, `[carga] El documento
      > existe pero llegó incompleto... Faltan: warehouse, nanites`
      **Sí, y era un bug real de B27 a medias.** El motor detectaba la lectura recortada y
      hacía bien —`partidaNoCargada`, sin guardar para no pisar la partida buena—, **pero no
      lanzaba nada**. Y como la pantalla de fallo solo salía **ante una excepción**, **el
      juego se montaba entero con el almacén vacío**, con el saldo de la cola local encima.
      **LO PEOR NO ES QUE ENTRASES: ES QUE PARECÍA QUE HABÍAS PERDIDO LA PARTIDA.** Tus
      objetos estaban **intactos en el servidor** y tú veías un almacén vacío. Y el guardado
      estaba deshabilitado, así que **lo que jugaras ahí tampoco se guardaba**: las dos
      cosas mal a la vez. Cerrar el portátil con esa pantalla es la forma más rápida de
      perderla de verdad.
      **LO QUE FALTA Y SE AÑADE: NO MONTAR.** Después de crear el motor y **antes del
      primer `renderRoute`**, se pregunta por `cargaFallida()` y, si es cierto, se enseña la
      pantalla de cuota en vez del juego. Va antes del render **para que no haya ni un
      fotograma con el almacén vacío**: o se ve el aviso o se ve el juego.
      **LA PANTALLA ES LA DE CUOTA, Y POR QUÉ.** Se fabrica el error con
      `resource-exhausted` y se reutiliza `renderErrorDeCarga()` tal cual, sin duplicar
      textos: es la que dice **"tu partida está intacta y el límite se repone solo"**. Un
      fallo genérico haría al jugador esperar un reintento que igual no arregla nada.
      `cargaCortaCheck` (nuevo, 4) y **el caso que hay que mirar dos veces**: una partida
      **nueva** con `warehouse: []` **sí monta el juego**, porque un jugador que se registra
      tiene el almacén vacío de verdad y **no se le puede decir que hay un problema**. La
      diferencia entre "vacío" y "vino recortado" es si la **clave existe**, y confundirlas
      rompería a los jugadores nuevos. También se comprueba que con la carga a medias **no se
      escribe nada**.
- [x] **B36 · Un comando para levantar el entorno de pruebas.** `[v1.15.8]`
      > "me armas un comando /dev para poder levantar un local de pruebas?"
      Hecho: `/dev` documenta el procedimiento y `npm run dev:emulador` lo levanta solo.
      **LO QUE HAY QUE TENER INSTALADO, Y NO LO TENÍA: JAVA.** El emulador de Firestore
      necesita Java, y sin él **no da un error útil**: dice `Could not spawn 'java -version'`
      y se queda esperando, que es lo que hace pensar que el proyecto está roto. Instalado
      el **OpenJDK 21** con `winget`.
      **Y EL CASO QUE DE VERDAD FALLABA, QUE NO ES "NO TENER JAVA".** Java **se instala y
      aun así `java` no existe**, porque el PATH de la terminal ya abierta no se actualiza.
      El script lo detecta: **si no está en el PATH, lo busca en disco** en
      `C:\Program Files\Microsoft\jdk-*` y se añade a la sesión. Decir "instala Java"
      cuando ya está instalado hace perder media hora.
      **ADEMÁS COMPRUEBA LOS PUERTOS ANTES DE LEVANTAR.** Si el emulador de ayer sigue
      vivo, el de hoy falla hablando de "otro proceso" y **lo que se acaba viendo son los
      datos de la sesión anterior** en vez de una base vacía —justo lo que no se espera al
      probar una carga nueva—. Se comprobó: el script detectó el emulador que había dejado
      una prueba anterior.
      **Y NO HAY INTERFAZ WEB DEL EMULADOR.** Se pidió con `--only firestore,auth` y **el
      puerto 4000 no levanta**, así que el comando **no la anuncia**: prometer una pantalla
      que no abre es peor que no tenerla. Para ver los documentos, la consola.
      `npm run dev:emulador` y `$env:VITE_EMULADOR="1"; npm run dev`. **41 bancos = 2311
      pruebas, en verde.**
- [x] **B26 · La tarjeta AFK dura más de lo que el tope dice.** `[v1.15.9]`
      > "el tiempo afk esta mal me dejo pasarme de lo 30 min ... tengo un pasivo que sube 30 min lo pague y deberia tener una hora . pero tengo una hora y media... lo vemos?"
      **Arreglado, y era peor de lo que parecía la captura: con el nodo al máximo el tope
      eran 6 h 30 min, trece veces la base.** La captura enseñaba 1:55:46 porque el
      jugador tenía el nodo a un nivel; el multiplicador grows de ahí para arriba.
      **EL BUG NO ERA NINGUNA DE LAS TRES HIPÓTESIS QUE HABÍA AQUÍ.** Las tres apuntaban a
      que el `+30 min` se contara de más. **El sospechoso era el `×3`.**
      · `afk_extend` da `afkHours: 0.5` = **+30 min por nivel**, `maxLevel: 4`.
      · `afkCardDurationMs()` = **10 min + extra** — el extra va en el **paso**, correcto.
      · `topeDeConsumible('afk', afkMs)` era **`TOPE_DE_TARJETA_AFK * afkMs`** = `3 × afkMs`.
      **O sea que el extra entraba DOS veces**, y además **`TOPE_DE_TARJETA_AFK = 3` es un
      número de TARJETAS** usado como multiplicador de un **TIEMPO**: dos magnitudes
      distintas que el `*` confunde. Con un nivel: tarjeta de 40 min, tope de **120** en
      vez de 60. Al máximo del nodo, **390 min**.
      **POR QUÉ NO SE VIO NUNCA, Y ES LA LECIÓN.** Sin nivel del nodo, `3 × 10 min` da
      exactamente los mismos `30 min` que `MAX_AFK_BUFF_DURATION_MS`: **las dos
      definiciones coincidían de milagro**. Un número que solo se rompe cuando otro camino
      lo toca **no está protegido por el banco que no lo toca**.
      **EL `×3` ESTABA COPIADO EN DOS SITIOS, Y ESO ES LO QUE CASI SE ESCAPA.** No solo en
      `topeDeConsumible()`: también en el `case 'afk'` del motor, que era
      `Math.min(base + afkMs, ahora + afkMs * 3)` y es **el camino que de verdad mueve
      `state.afkExpiresAt`**. Arreglando solo la función, el `case` seguiría aplicando tres
      tarjetas y el banco lo daría por bueno. Ahora **el `case` pregunta a
      `topeDeConsumible()`**, así que los dos caminos **no pueden volver a separarse**. Los
      otros cuatro consumibles tienen su tope escrito como **tiempo fijo**, que es la
      magnitud correcta, y por eso el fallo era del AFK.
      **LO QUE NO SE TOCÓ, Y POR QUÉ SE COMPRUEBA IGUAL.** El **paso** sigue llevando el
      extra, porque es lo que compró el jugador. Un arreglo rápido podía "arreglarlo"
      bajando el paso y **quitarle lo que pagó**.
      `afkTopeCheck` (nuevo, 13): el tope es 30 base + 30 del nodo; el extra cuenta una vez;
      sube de uno en uno y no se multiplica (×5 al máximo, antes ×13); **sin nodo sigue
      siendo 30 min**, que es donde se escondía; **usando tarjetas de verdad con el motor**,
      caben dos y las sobrantes **no se gastan**; y el paso no se ha tocado.
      **UNA COMPROBACIÓN MÍA SE EQUIVOCÓ Y ESTÁ ESCRITO.** La primera versión esperaba 80
      min (dos tarjetas de 40) y el motor dio 60. **El motor tenía razón**: la segunda
      tarjeta **se recorta al tope**, que es el comportamiento escrito en `cuantasVecesCabe()`.
      Se corrigió la afirmación, no el código.
      **Lo que ve el jugador a partir de ahora:** con el nodo a un nivel, el tope es de
      **1 hora**, no de 2. La cola que ya tenía puesta **no se toca**: al recargar, el
      tiempo que le quedaba se respeta hasta que caduca.
- [x] **B25 · Los clics pasivos no critican.** `[v1.15.10]`
      > "Los clicks pasivos también deberían hacer críticos"
      Hecho: **los clics automáticos del árbol ya critican**, con la misma probabilidad y el
      mismo multiplicador ×2 que el click del jugador, y se ven igual: `¡CRÍT! +N` en el
      dorado de la forja.
      **LA PROPUESTA DE AQUÍ PARTÍA DE UNA PREMISA FALSA, Y ES LO PRIMERO QUE HAY QUE
      DECIR.** Decía que los compañeros de tipo `click` "sí cobran por clic". **No lo hacen.**
      Su poder entra en `recalculatePassiveIncome()` como **una tasa por segundo**, dentro
      de `state.passiveIncome`, junto a los `passive`. **No hay ningún evento al que
      tirarle un dado.** Ponerle un crítico ahí no sería un evento: sería **más ingreso de
      golpe**, que es otra cosa —y que cobraría **sin que el jugador esté mirando la
      pantalla**, que es justo lo que R10 prohíbe—. **Se quedan fuera a propósito.**
      **LOS QUE SÍ SON CLICS SON LOS NODOS `autoClick`.** El motor cuenta `totalClicks` por
      cada uno, cada vuelta del bucle es un click y cada click tiene su flotante. Que no
      pudieran criticar era **la excepción sin motivo**: es la misma acción que el click del
      jugador, así que **el afijo de crítico tiene que aplicar a los dos o miente sobre lo que
      afecta**.
      **EL DADO ESTÁ EN EL BUCLE Y NO EN `calculateClickDamage()`, Y ESO ES LO QUE MANTIENE
      VIVO B16.** B16 dejó escrito que esa función no puede tirar el dado porque la leen el
      panel y el desglose, y **un dado dentro haría que el número que se enseña cambiara en
      cada lectura**. Meterlo ahí habría hecho que el automático **criticara** —el arreglo
      habría funcionado— **y habría roto el panel**. Por eso va en el bucle, que es donde ya
      se ha decidido que esto **es** un click, y la función sigue siendo pura.
      `criticoAutoCheck` (nuevo, 6), y atan **las dos mitades**: el automático crítico pega
      **exactamente el doble del daño puro**; **la función pura da la misma cifra con dados
      distintos**, que es la mitad que el arreglo fácil rompe; el evento **lleva la marca**
      `critico` y **no la lleva cuando no es crítico** —un evento que siempre dice que sí no
      es una señal, es ruido—; y el compañero `click` **suma tasa y no genera eventos**.
      **DOS ERRORES PROPIOS EN ESTE BANCO, Y LOS DOS ERAN DE LA PRUEBA, NO DEL MOTOR.**
      · **No llevaba recolector equipado**, así que `critChance` era `0` y `Math.random() < 0`
        **nunca** daba crítico: las comprobaciones salían a cero con el motor correcto.
        **Una comprobación que clava el dado tiene que tener de dónde salga el crítico.**
      · Medí sobre `state.nanites`, que **suma también el ingreso pasivo**, que no critica, y
        por eso salía 32 contra 18 en vez de 36 contra 18: **la cuenta estaba mal, no el
        motor.** Ahora se mide la suma de los eventos, que son solo clics automáticos.
      · Y el `setInterval` del juego **no arranca en los bancos** (`entorno.mjs`): la primera
        versión llamaba a un `tick()` que no existe y daba cero y `undefined`. El truco es el
        de `tickCheck`, y está copiado con el motivo escrito.
      · **Y UNA CUARTA, QUE ES LA QUE DE VERDAD ENSEÑA:** la comprobación de la magnitud
        **pasaba en solitario y fallaba en la suite**, con el motor correcto. Daba 32 contra
        16 medido sobre `state.nanites`; luego 32 contra 18 con el promedio, y **18 es
        IMPOSIBLE** si los únicos valores posibles son 8 y 16 — eso delató que **entre el
        drenaje y los `tick()` manuales entra un tick de verdad**, con su `Math.random` sin
        clavar y su acumulador ya avanzado desde el arranque. **El experimento no estaba
        controlado y el total no significaba nada.** Ahora se afirma **la relación con el
        daño puro**: el mayor evento es exactamente el doble de `getClickDamage()`, y sin
        crítico ninguno lo supere. Es cierto llegue la cantidad de clics que llegue.
        **Una comprobación que depende de cuántos eventos han pasado no comprueba el
       _arranque; pide suerte.**

**Features:**

- [ ] **F78 · Los checks de consumibles van DENTRO del modal del forja múltiple.**
      > "para despues : esos checks deben estar dentro del modal que abre cuando todo el forjar multiple"
      **Lo que hay hoy:** los checks (piedras / nanopartícula) están en la **página**,
      y el modal solo **lee** el estado y lo enseña como filas de texto. O sea que
      para ver qué va a gastar hay que decidir en un sitio y confirmar en otro, y el
      modal se abre después de que ya no se puede cambiar nada.
      **Y POR QUÉ EL MODAL ES EL SITIO BUENO, Y NO UNA COSA DE ORDEN.** El modal es
      el último momento en el que el jugador todavía puede **cancelar sin gastar**, y
      es donde ya se ha escrito el "Forjar 7 · 3 tiradas". Meter el check ahí es
      cambiar un dato de una fila que ya se pintó por un control que la cambia, y es
      **la misma decisión con su coste al lado**.
      **Lo que hay que tener cuidado, y es la razón de que esto sea una feature y no
      un arrastre:** `confirmAutoForge()` calcula el plan con
      `autoForgePreview(...)` **antes** de abrir el modal, así que cambiar un check
      dentro **obliga a recalcular el plan y a reescribir el botón de confirmar**.
      Si el texto del botón dice "Forjar 7 · 3 tiradas" y el check lo cambia a 2, ese
      número es una promesa y tiene que moverse con él (R3). El resumen del modal
      (`autoForgePreview`) es la única fuente, y el plan se vuelve a pedir al motor
      en cada cambio: **nada de recalcular la probabilidad en la vista.**
      Los checks se quedan en la página además: quien ya sabe lo que va a gastar no
      debería tener que abrir nada.
- [ ] **F79 · El modal de la forja simple se parece al de la serie.**
      > "emprolijemos este texto demosle , el segundo me gusta como esta formateado hagamos algo asi"
      **El de la serie ya está como se pide (F63) y el simple no.** Los dos son
      `showConfirmModal` y los dos salen del mismo `case 'forge'` / `case
      'auto-forge'`, así que **la diferencia de formato es una decisión de la página**,
      no una limitación del diálogo: `showConfirmModal` ya acepta un nodo en vez de
      una cadena (`htmlToNode`), y la serie lo usa.
      **EL POR QUÉ ES DE LECTURA, NO DE ESTILO.** El simple tiene **un párrafo de
      tres frases con números dentro**: "Dos recolectores de tier 1 se funden en uno
      de tier 2. El potencial del nuevo es la media de los dos, y los dos se
      consumen." Son cuatro datos (tier de entrada, tier de salida, la regla del
      potencial, y que se gastan) embaldosados en una frase que se lee entera antes
      de entender nada. **La serie lo hace al revés: una fila por dato, con la
      etiqueta a la izquierda y el número a la derecha**, y se lee de un vistazo.
      **Ojo con el orden de las etiquetas de la serie**: "Entran / Tiradas /
      Sobran / Piedras" es el orden de las *preguntas del jugador* —qué pongo, cuántas
      veces, qué me queda, qué me cuesta—, y ese es el criterio que hay que copiar al
      simple. **NO es "mismo número de filas": es el mismo criterio para escolher las
      filas.**
      **Las filas del simple serían cuatro, por el mismo orden:**
      Entran (los dos y su tier) · Sale (el tier nuevo) · Sale el potencial
      (la media, y **con la consecuencia**: promediar nunca sube) · Coste (las
      piedras y la nano que van, o que no van y por qué).
      **Y HAY TRES COSAS QUE EL SIMPLE NO DICE Y QUE LA SERIE SÍ, Y QUE NO SON
      COSMÉTICAS:**
      - **Qué pasa si sale bien y qué pasa si sale mal.** El simple promete una
        fusión y no dice que un fallo **gasta los dos materiales igual**. Es la
        duda más cara de la pantalla y está en un sitio donde nadie la mira.
      - **Qué pasa con las piedras.** La serie tiene su fila "Piedras: no gastas: no
        tienes o no hacen falta"; el simple no dice nada y deja que el jugador
        descubra en el cartel de resultado —que hasta B22 era un "fallo" ambiguo—
        que se le cobran igual.
      - **El nombre del autor.** La serie es "Por ti" porque no hay autor; el simple
        sí lo pone en la card de resultado, y en el momento de decidir no.
      **Sin banco, y hay que decirlo:** es estructura de diálogo sobre números que ya
      están comprobados. Lo que sí se mide a mano es el ancho: cuatro filas con
      etiquetas largas **en el hueco de un `max-w-sm`**, que es el que usa
      `showConfirmModal`. A 390 px, "Entran / 7 recolectores del tier 1, de dos en dos
      y por potencial" no cabe en una línea y **un modal que se parte en tres es peor
      que el párrafo**.
- [x] **F80 · La tarjeta ajena enseña el perfil entero, y sustituye a los bloques
      que ya tiene.**
      > "quiero que eso se vea en el perfil del jugador cuando otro lo abre desde el ranking asi tal cual con los mismos datos, deberias solo reemplazar lo que esta por esas vistas"
      *Con tus tres capturas: el bloque del RECOLECTOR con su desglose entero, el de
      COMPAÑEROS con su ingreso, y el ÁRBOL DE PASIVAS completo con sus niveles.*

      **LO QUE HAY HOY, Y POR QUÉ ESTE ENCARGO ES "SUSTITUIR" Y NO "AÑADIR".**
      `cuerpoDeTarjeta()` ya monta cuatro bloques dentro de una sola sección, "Lo que
      tiene puesto": `bloqueDeRecolectores`, `bloqueDeCompaneros`, `bloqueDeNodos` y
      `bloqueDeLogros`. **Los tres primeros son precisamente las capturas**, pero en
      versión corta: una tarjeta con nombre, rareza y cifra, en vez del bloque entero.
      O sea que **esto no es enseñar datos nuevos: es pintar con la misma forma los
      datos que ya viajan**, y por eso el encargo dice sustituir.

      **EL ÁRBOL ES LA ÚNICA PARTE QUE HAY QUE PENSAR DE VERDAD, Y ES LO MÁS
      CARO.** En el perfil el árbol es un `svg` con las líneas de dependencia
      dibujadas y los niveles como puntos de un color. En la tarjeta **no hay a qué
      colgar las líneas**: es una columna con scroll, no una rejilla de 5 columnas, y
      las líneas son geometría de una rejilla. O sea que hay **tres salidas** y cada
      una es una decisión:
      - **La rejilla entera dentro de la tarjeta**, con su `svg` de líneas. Es lo que
        pediste "tal cual", pero son cinco columnas en un `max-w-md` de móvil: **a
        390 px sale ilegible**, y una rejilla ilegible es peor que no tenerla.
      - **Las columnas en fila y scroll horizontal.** Keeps la forma, gasta el ancho.
      - **La lista que ya hay, pero con los niveles.** Hoy `bloqueDeNodos()` agrupa por
        categoría y enseña lo pagado. Añadir el nivel es barato.
      **Y HAY UNA CUARTA COSA QUE NO ES ESTÉTICA:** el árbol tiene **requisitos
      cruzados**, así que ver los niveles sueltos enseña una partida que no se puede
      leer. Sin las líneas, el jugador ve "tiene Chatarra 2 y Estantería 1" y no puede
      deducir que el segundo depende del primero.

      **LO QUE HAY QUE PUBLICAR, Y ES EL RIESGO REAL DE ESTE ENCARGO.** La tarjeta
      es `perfiles/{uid}`, un documento que el dueño publica con lo que decide enseñar,
      y hoy **`cifrasDeTarjeta()` y los cuatro bloques ya funcionan**. Añadir el
      desglose del click significa publicar **la cuenta completa de por qué ese
      jugador pega lo que pega**: base del item, potencial, nivel, afijos, logros,
      árbol y buff.
      - **Lo que NO es problema:** nada de eso es dinero guardado ni inventario. El
        **nivel del recolector** y sus afijos son públicos por definición —los llevas
        puestos—, y el árbol ya se publica. La privacidad ya está resuelta y bien.
      - **Lo que SÍ es un problema, y es el buff:** la fila "Buff de click · temporal"
        vale **+106.931 K**, y **los buffs caducan**. Publicar el buff es publicar
        un número que **se queda en la tarjeta después de caducar**, o sea un número
        que miente a quien la mire mañana. Hay que decidir: o no se publica, o se
        publica **con la fecha de caducidad y la tarjeta avisa de que es al guardar**.
      - **Y el desglose se puede RECALCULAR o PUBLICAR.** Si se publica el item con
        su potencial y su nivel, la vista puede componer el desglose con las mismas
        funciones del perfil —y entonces el número que ve el otro **es el número que
        cobra la partida**. Si se publica el desglose hecho, es una foto y se queda
        vieja en cuanto el otro suba de nivel. **La segunda es una partida desincronizada
        esperando a pasarle mal.**

      **LO QUE NO SE TOCA.** `cifrasDeTarjeta()` y `bloqueDeLogros()` se quedan:
      el encargo dice sustituir los tres bloques, no borrar el resto, y los logros no
      tienen versión "corta" que arreglar.

      **Banco:** `perfilCheck` mide qué se publica y qué no. Si esto se hace, la
      invariante que hay que añadir es **que lo que la tarjeta muestra se puede
      recomponer con las funciones del perfil**, no que coincida por suerte. Es la
      diferencia entre una tarjeta y una foto.

      **Y EL ORDEN.** Va **después de F74**, porque con las bases las tres capturas
      enseñan un stat más cada una, y si esto se programa antes se programa dos
      veces.
      **Visto bueno el 9 de octubre: el jugador lo ve bien como está, sin cambios.**
- [ ] **F81 · El resumen de la forja en serie enseña el item entero.**
      > "aca tambien mostrar bien los iconos , el potencial y el tier que sale el arma y si tiene afijos poner el tag"
      Hoy cada fila de la serie es **una sola línea**: el número, una casilla con un
      icono `sparkle` genérico, y el nombre. Todo lo demás está en el `item` que el
      motor ya trae entero por resultado —`r.collector`/`r.companion`, con su
      `potential`, su `tier` y su `affixes`— y **la vista no lo lee**.
      **Lo que le falta a la fila, y por qué cada cosa está pedida:**
      - **El icono de verdad.** Es `sparkle` en todos los acierto, así que un
        recolector y un compañero salen con la misma cara. Y el color sí sale de la
        rareza (`rarityClass`), o sea que la fila tiene el color del objeto y no su
        forma: es media ficha.
      - **Las estrellas.** Son el potencial, y son **la mitad de la calidad** del
        item: sin ellas, dos filas del mismo nombre no se distinguen.
      - **El tier.** Es la otra mitad, y es lo mismo que se acaba de pedir en el
        resumen de apertura (F73): **las dos dimensiones del objeto**, y esta fila
        no tenía ninguna.
      - **Los afijos como tag**, y no como texto: son hasta seis, y en texto se
        comen la fila entera. Como tags se leen de un vistazo y son los que el
        jugador va a comparar entre las dos filas de la serie.
      **El fallo NO cambia**, y es lo que hay que tener cuidado: una fila de fallo no
      tiene item, y las cuatro cosas de arriba tienen que salir vacías sin dejar
      separadores sueltos. Lo dice el mismo criterio que `tierDeFila()` en el resumen
      de apertura.
      **Para después (9 de octubre, con captura): que salga la rareza y el icono vaya
      en su color, como en el almacén.** La fila ya trae icono, estrellas, tier y tags
      de afijos, pero no la rareza en texto; y el icono lleva `rarityClass` tapado por
      el fondo de acento. El dato viaja (`it.rarity`), solo falta pintarlo.
- [ ] **F75 · Los expansores viejos se convierten en Inicial.**
      > "Converti las antiguas t1 , t2 , t3 y t4 que posean los usuarios a iniciales."
      **Cuidado, que "convertir" tiene dos lecturas y la mala rompe partidas:**
      (a) que a partir de ahora el expansor T1 sea el Inicial, y (b) **reescribir
      el item guardado** de quien tiene `expansorT1..T4`. **(a) es lo que pidió el
      jugador**, y además es lo que evita el problema: si el expansor viejo queda
      con su techo de 25-55 y el Inicial llega a 60, los tres primeros se vuelven
      irrelevantes, que es exactamente la trampa que F66 cerró. O sea: **`expansorT1..T4`
      se pasan a resolver como el Inicial** (mismo `buffId` efectivo, techo 60), y
      `TECHOS_VIEJOS` queda solo para `expansorT5..T10`, que sí son de tramo
      distinto. **Un banco:** un item `expansorT3` guardado sube hasta 60, no hasta 45.
- [x] **F76 · En la forja se ve el potencial y la rareza de lo crafteado.**
      > "En la forja también se tiene que ver el potencial y la rareza de lo crafteado"
      Hecho en v1.15.15. Medido primero, como pedía la entrada: el potencial promedio
      ya salía y la rareza compartida tambien, pero **la rareza del resultado no salía en
      ningún sitio**. Ahora sale al lado del potencial: en recolectores la calculada con
      el promedio del yunque —dice "calculada" porque los tres dados que faltan (conservar
      la compartida, subir la estrella y la Nano) solo la mejoran, nunca la empeoran—, y en
      compañeros la del tier, que no tiene dado. Los dos números salen de las mismas
      funciones que los estampan al forjar, y un banco ata que lo anunciado y lo forjado
      coinciden.
- [x] **F77 · El compañero enseña su potencial y su rareza en la descripción.**
      > "Los compañeros también deben dar una descripción de donde sale el daño: Potencial / Rareza en su descripción"
      Hecho en v1.15.15, junto con F76: era la misma línea en dos sitios. Y al medirla
      salió un bug de verdad: el desglose "De dónde sale" del compañero usaba la cuenta
      del recolector (+20 % por estrella) y no traía la rareza, así que un Divino de 5
      estrellas anunciaba "+100 %" donde el cobro pone x1,06 de potencial y x1,60 de
      rareza. **Causa raíz:** la lista común no sabía que el potencial del compañero ya
      va dentro del poder y que la rareza sí multiplica. Ahora la lista sale de las mismas
      funciones que el cobro, fila por fila, y un banco comprueba que suma el stat. La
      decisión grande —si la rareza pasa a derivarse de la base— sigue abierta, y es
      economy, no texto: no se toca aquí.

- [x] **[PRIORIDAD] F83 · El daño final suma arma y buffs, y se ve en ranking y menú.** Hecho en v1.15.16.
      > "El daño del arma debe sumar tambien al daño final la influencia de los pasivos, en el perfil se esta haciendo bien en el resto de lados no., en el ranking al igual que en el menu principal se debe mostrar el daño del arma mas las bonificaciones de las partidas del jugador en cuestion y el daño final, y al apoyarme decirme cuanto es de arma y cuanto de buffs, con el detalle como en el main o la base."
      **Para después, con prioridad: pedido el 8 de octubre con tres capturas.** La ficha
      del almacén y la tarjeta de MEJOR RECOLECTOR FORJADO enseñan +689, que es solo el
      arma (base 382 + potencial 307): los pasivos no entran. El menú principal sí los
      cuenta, porque el daño del clic sale de la cuenta con bonos. Lo pedido: que el
      ranking y el menú muestren arma + bonos = final, y que al apoyar parta cuánto es de
      arma y cuánto de buffs, con el mismo detalle del main.
      **Dos preguntas abiertas para cuando se programe, no para ahora:** (1) los bonos
      del JUGADOR EN CUESTIÓN —la tarjeta ajena trae su partida? F80 (perfil entero) sigue
      pendiente y es la que trae esos datos; sin ella no hay de dónde leerlos. (2) La
      tarjeta MEJOR RECOLECTOR muestra el arma, no el arma EQUIPADA: el daño final solo
      existe del equipado, y arma + bonos de una no equipada es un número hipotético que
      habría que rotular como tal o no mostrar. **Y dos precisiones del 9 de octubre:** el arma no
      equipada cuenta sus propios afijos (es el valor al equiparla) y el ranking compara
      sin buffs temporales para todos —con ellos solo la Base, que es donde se cobran—,
      porque un temporal caducado en una foto de hace minutos es un número que nadie pega.
      **Hecho en v1.15.16, con las dos decisiones del 9 de octubre.** El número grande
      de la ficha es el final y su lista llega hasta él: una sola cadena (`filasDeRecolector`)
      para el hover y el número, y el pie parte arma y partida. La cuenta del clic delega
      en la misma función pura, así que lo cobrado y lo enseñado no se separan.
      **Dos ajustes honestos:** el ranking compara sin temporales para todos —con ellos
      solo la Base, donde se cobran—, y lo ajeno se recalcula de su tarjeta (los bonos
      salían todos publicados menos el tipo real del compañero, que se arregló) sin
      temporales porque no se publican, y rotulado. Un banco ata el ida y vuelta:
      tarjeta recalculada, clic, ficha y fila del ranking dan el mismo número.
      **Decidido el 9 de octubre: el daño final del arma es base + potencia +
      pasivos, y así se ve en almacén y perfil; en la Base y en el ranking se ve
      con los buffs de partida aplicados.** Los pasivos permanentes van con el
      arma en su ficha; los temporales solo donde se cobran (Base propia y fila
      propia del ranking). Propio y ajeno: lo ajeno se recalcula desde su tarjeta
      pública, sin buffs temporales porque no se publican, y rotulado.

### Lote I · ENCARGO DEL 8 DE OCTUBRE

*El reequilibrio de la forja que quedó aprobado. **Fue una sola conversación de
balance**: cada pieza sin la otra deja la forja anunciando un número que no cobra,
así que las cuatro se hacen y se commitean juntas.*

- [x] **F82 · Reequilibrio de los consumibles de forja, y el Éter de Refinamiento
      nuevo.** Hecho en v1.15.14, en un commit solo.
      **Las cuatro piezas, y por qué cada una:**
      - **La piedra pasa a 1,2 puntos: diez suman 12.** Antes cada una daba 7
        puntos y diez sumaban 70 —casi cualquier tirada quedaba segura—, así que
        la piedra dejó de ser una decisión y pasó a ser un impuesto. Ahora la
        cuenta de "las necesarias" vuelve a elegir. **Y el 95 % deja de ser
        alcanzable en ningún tier sin suerte del árbol ni afijos**: por eso el
        botón enseña la probabilidad real con esas piedras y solo dice "para el
        95 %" cuando de verdad se llega —anteayer el botón prometía un 95 % que
        en varios tiers era inalcanzable—. El tope sigue en diez por tirada, que
        ahora es el tope de la mano.
      - **La nanopartícula sube la rareza un escalón el 50 % de las veces, y es
        solo de recolectores.** La rareza del compañero la pone su tier, así que
        en compañeros no hace nada: la vista no la ofrece, el plan de serie la
        fuerza a cero y el motor no la cobra. Antes daba +1 al potencial en
        compañeros; ahora el consumible de 90 000 nanitas ya no se cobra sin
        efecto en ningún sitio.
      - **Nuevo: Éter de Refinamiento.** Suma 20 puntos a la probabilidad de que
        la fusión suba una estrella de potencial —la tirada que siempre existió,
        20/15/10/5 % por ★4 a ★1—, y sirve en las dos forjas. **Se gasta aunque
        la tirada salga en blanco**, como las piedras: si solo se cobrara al
        subir, sería una apuesta y no un consumible. 60 000 nanitas en la balda
        "Forja", entre la piedra y la nanopartícula.
      - **Las cajas con sus puertas:** la piedra desde la T2 —en la T1 aún no hay
        a quién forjar—; nanopartícula y Éter desde la T3, con el Éter pesando
        `tier - 2`, que es la forma de que el más reciente sea el que menos sale
        sin bajar el peso de nadie más.
      **Lo que se comprobó con bancos nuevos** (el total pasó de 2351 a 2382):
      diez piedras suman exactamente 12 y una suma 1,2; en cada tier las
      necesarias son el tope y con ellas **no** se promete el 95 %; el Éter mueve
      la tirada —mismo dado, con y sin él— y se gasta al fallar; la
      nanopartícula no se cobra en compañeros ni en su serie; el Éter no se usa
      desde el almacén; los tres a su precio, cada uno con su buffId y en su
      balda, sin duplicarse en otra; y los pesos de caja con sus puertas.
      **Lo que se descubrió haciendo esto:** (1) la forja ahora tira **dos**
      dados —acierto y potencial—, así que todos los bancos que fijaban "el"
      dado con un número único estaban fijando también la subida de potencial
      sin saberlo: `conSec(primero, resto)` es el helper nuevo que separa los
      dos. (2) Dos pruebas viejas de "un rechazo no cobra nada" **pasaban
      vacías**: los materiales que usaban eran de tiers distintos, así que el
      rechazo era de materiales y el cobro no se llegaba a mirar. (3) El Éter
      necesitaba su propia línea de lore, que `loreCheck` pidió en rojo.
      **Y una enmienda que va con esto:** la forja **consolida y no crea** —
      fusionar dos objetos da uno nuevo y los dos materiales se van—, que es la
      lectura que aceptaste. Está escrita en `docs/CONTEXTO-JUEGO.md`.

### Lote J · WIKI Y PROBADOR DE BUILDS (encargo del 9 de octubre)

*Lo pedido, con tus palabras: "una seccion Wiki para tener la base de conocimiento ahi
explicando las mecanicas, las probabilidades, los items que salen de cada caja, los nombres
de las bases y sus valores, todos los items del juego, los logros, las pasivas existentes...
tambien alguna herramienta para probar builds (eso luego)". La Wiki va ahora, con las seis
secciones; el probador queda anotado y no se toca.*

- [x] **F86 · Wiki en pestaña aparte, con las seis secciones.** Hecha en v1.15.19:
      Mecánicas, Cajas, Bases, Items, Logros y Pasivas, en `wiki.html`, una entrada
      propia **sin game loop, sin Firebase y sin auth**: es solo lectura y se puede abrir
      sin cuenta, desde el acceso o desde el botón de la cabecera. Abrirla no interfiere
      con la partida —la pestaña del juego queda oculta y el juego se pausa solo por
      presencia—. Por eso **no es una ruta del router** (las rutas son del juego) y la
      barra inferior sigue en 5. Ningún número está escrito a mano: precios de
      `costeDeCaja()`, porcentajes de `tablaDePesos()`, salto de `probabilidadDeSalto()`,
      costes de `nodeCost()` y núcleos de `pendingCores()`. Banco nuevo `wikiCheck` con
      el contrato (sin ruta en el juego, botón en la cabecera, diez cajas que reparten el
      100 %, salto en banda y sin salto en T10, seis exclusivos cada uno en su caja,
      doscientas bases con stat y sorteo en regla, 27 logros con difíciles sin bonus,
      árbol sin requisitos imposibles). Lo visual (`wiki.html` en el navegador, a
      390×844 y a 1440×900) no lo cubre ningún banco, a propósito.
      **Iconos del juego y sección Versiones, con regla R32:** cada fila pinta su icono
      de verdad (cara de cada caja con su acento, icono de cada logro y nodo, color de
      cada rareza) y el banco ata que existan en el set; la séptima pestaña lista todos
      los parches desde la 1.1.0 leyendo `NOTAS`, sin segunda lista. Y cada commit que
      toque reglas tiene que releer la sección que lo enseña: está escrito en R32, y el
      banco canta si la regla cambió y la Wiki no.
      **Descubierto haciendo esto (no es de la Wiki, queda anotado):** `sellCheck`
      §11 (`renombre`) es intermitente desde F74: la migración sortea la base oculta
      con `Math.random` sin fijar y el test espera el daño exacto sin base, así que
      una de cada ~55 corridas sale la base 10 y da 7 en vez de 6. Reproducido en
      una corrida completa (140/141) y ausente en 8 sueltas. No se toca: el arreglo
      es fijar el dado en el test, no relajar la migración.
- [ ] **F87 · Probador de builds.** Anotado y sin empezar, como pediste ("eso luego"):
      elegir recolector/compañero con nivel, estrellas, afijos y base, más nodos del árbol
      y logros, y que el daño y el pasivo los calcule el motor de verdad
      (`getClickDamage` y el reparto del pasivo), no una copia. Si calcula por su cuenta,
      es la segunda fuente que se queda vieja.
- [x] **F95 · Buscador en la Wiki y enlaces entre conceptos.** Hecha en v1.15.21, con el
      documento entero enriquecido de paso (era lo pedido: no solo un sector).
      > "Meter un buscador en la wiki, y moverse automáticamente a conceptos por hipervinculos"
      Un campo encima de las pestañas que busca en las siete secciones a la vez —
      cajas, bases por nombre, items, afijos, logros, nodos y parches—, sin tildes
      y sin mayúsculas y con "y" entre términos como el del almacén. Pulsar un
      resultado o darle a Enter lleva a su sección, abre el desplegable si vive
      en uno cerrado y lo deja señalado; la dirección queda en el hash para
      copiarla. Y las menciones dentro de los textos son enlaces: la Piedra en
      la forja lleva a su ficha en Items. Los conceptos van como subtítulos con
      su descripción debajo en todo el documento; el reparto de cada caja lleva
      su icono, cada tier de bases señala a la mejor, y expansores y afijos
      llevan el color de su rareza. El índice es `src/data/wikiIndex.ts`, puro y
      desde las mismas tablas, con las anclas en un solo sitio para que página
      y buscador no diverjan; `wikiCheck` 106 → 129 (+23: cobertura por grupo,
      integridad de anclas y comportamiento). El campo vive fuera del repintado
      para no repetir el B15. La explicación de afijos se lee de
      `explicacionDeAfijos()`: con el rebalanceo en curso decir "solo la forja"
      ya era mentira.
      **Descubierto haciendo esto (no es de la Wiki):** `senalCheck`
      "sin afijo no hay crítico" cae con 25/200 —hay una probabilidad base de
      crítico nueva en la rama del refactor de afijos—. Y un apaño documentado
      en el propio banco: importar `CONSUMABLES` a la vez directo y vía
      `wikiIndex` dejaba el nombre sin declarar en el bundle, así que va con
      alias (`CONSUMIBLES`).

### Lote L · HERRAMIENTAS DE LA WIKI (encargo del 10 de octubre)

*Lo pedido, con tus palabras. Se escribe aquí antes de programarlo, para que no
viva solo en una conversación.*
- [x] **F98 · Sección Herramientas en la Wiki: simulador de árbol y simulador de base.** Hecho en v1.15.33.
      > "en la wiki quiero agregar una seccion de herramientas, donde voy a tener un simulador de Skill tree, donde puedo gastar puntos y ver el resumen de lo que otorga y lo que me va a costar en nucleos, determinando aprox los reset necesarios etc... tambien poder seleccionar una base y ver como quedaría con en distintos potenciales, niveles y afijos"
      > "en la wiki quiero agregar una seccion de herramientas, donde voy a tener un simulador de Skill tree, donde puedo gastar puntos y ver el resumen de lo que otorga y lo que me va a costar en nucleos, determinando aprox los reset necesarios etc... tambien poder seleccionar una base y ver como quedaría con en distintos potenciales, niveles y afijos"
      > "me referia a que se le de una idea de cuantos resets iba a necesitar aproximadamente para lograr la build que arme... empieza de 0 y la puede reiniciar infinitas veces... puede ver el daño final sin la forja, puede elegir todo lo que quiera directamente"
      > "acordate de usar iconos, colores, previews del juego original, etc..."
      Dos sub-herramientas, las dos solo lectura sobre `src/data/`, sin game loop
      ni Firebase (la Wiki ya vive así):
      (a) **Simulador de árbol:** empieza de 0, +/− por nodo respetando
      `canBuyNode()` (requisitos + puntos por rama), reinicio infinito del
      simulador, y resumen con `coresGastadosEnArbol()` + `aggregateBonuses()`.
      Lo de "cuántos resets" no existe como número único (cada Ascensión tiene
      que producir más que la anterior: `nextCores` resta el histórico), así que
      se enseña la cota honesta: la build cuesta C núcleos ≈ producir
      `nanitesForCores(C)` en una sola run, más un "produzco ~X" que dice
      cabe/no cabe (`pendingCores(X)`), sin prometer nº de runs.
      (b) **Simulador de base:** tier, lado, base, potencial, nivel (capado al
      `techoDeNivel()` real) y afijos a elección libre; enseña el daño/poder
      final con `danioDeRango()`/`poderDeCompanero()` × `multiplicadorDeNivel()`
      × afijos, rotulado como ilustrativo (la forja sortea).
      Visual: iconos del set (`icSafe`), colores de rama y rareza, y las mismas
      piezas (chips de bonus, `.wiki-box`, `estrellasDe()`, `formatNumber()`).
      Banco: `wikiCheck` ata que todo número salga de la regla (R32).
      **Hecho:** octava pestaña con las dos sub-herramientas en `wikiTools.ts`
      (nuevo, solo lectura sobre `data/`), cableada en `wikiPage.ts` por zonas
      (cada toque repinta su zona, sin volver arriba ni robar foco: A5/B15), con
      `bonusLabel()` mudado a `bonusLabels.ts` para no duplicar textos entre
      Prestigio y Wiki. `wikiCheck` 129 → 148 (+19: contratos del simulador,
      índice de ocho secciones y buscador de "simulador"). `build` + `verify`
      en verde: 49 bancos, 2739 pruebas.
- [x] **F99 · Pasivas de la Wiki por ramas, como las pestañas del juego.** Hecho en v1.15.34.
      > "me gustaría que esten divididos como en el juego las pestañas: y explicar en que se enfoca cada rama ej: Asalto: rama especializada en mejora de recolectores y click bla bla bla... y poner todos los skills de esa rama, es reacomodar esa seccion"
      Cuatro bloques (Asalto, Manada, Fortuna, Forja) en el orden del catálogo, cada uno
      con su enfoque en prosa y todos sus nodos por tier (descripción, lore, Máx, coste
      base de `nodeCost()` y requisitos). Los umbrales de fila salen de
      `UMBRAL_PUNTOS_RAMA`, sin cifras a mano (R32). De paso, la etiqueta de
      `herramientas` que le faltaba a `ETIQUETA_SECCION` y rompía el `build` del lote F98.

### Lote M · SEGUNDO SERVIDOR (encargo del 10 de octubre)

*Lo pedido, con tus palabras. Se escribe aquí antes de programarlo, para que no
viva solo en una conversación.*
- [x] **F100 · Dos servidores distintos con la misma app.** Hecho en v1.15.36.
      > "quiero que tengas dos credenciales distintas para dos proyectos distintos pero que usen la misma app"
      > "son dos server del juego distintos, los jugadores son nuevos"
      La app apunta a un solo backend por build: `chronos-tap` (servidor 1, el de
      siempre) salvo `VITE_FIREBASE_SERVIDOR=2`, que apunta a `pet-project-aef10`
      (servidor 2, jugadores nuevos). Sin selector en el juego a propósito: `auth`
      y `db` son singletons y un cambio en caliente obligaría a dos sesiones vivas
      a la vez. El 2 es opt-in explícito (mismo criterio que `VITE_EMULADOR`): un
      build sin la variable es el 1, sin que nadie se acuerde. Reglas del 2 con
      `npm run rules:server2` (las de `rules` siguen yendo al 1 por `.firebaserc`).
      El proyecto nuevo necesita Auth por correo, Firestore creado, reglas
      publicadas y su `admins/{uid}`; los datos no migran. Sin banco: es cableado
      de config y `verify/` sustituye Firebase por stubs.

### Lote K · ENCARGO DEL 9 DE OCTUBRE (ideas nocturnas del jugador)

*Lo pedido, con tus palabras. Sin tocar todavía: se escribe aquí antes de
programarlo, para que no viva solo en una conversación. Los bugs van primero
(criterio 1 del GDD). No entran "refactor de pasivas" ni "comprar cajas de tier
más alto": los estás haciendo tú.*

**Bugs (se elige uno y se reproduce antes de arreglar):**

- [x] **B41 · Resto del afijo 10 % de forja en el mock de tarjeta.**
      > "los recolectores tienen un afijo 10% de forja es mucho no me gusta sacalo... porque aparte se pueden guardar ese afijo y equipar y desequipar a gusto"
      El afijo ya está fuera del catálogo justo por ese motivo (swap: equiparlo
      solo para tirar) y la migración lo quita de los saves viejos. Lo que queda
      es el mock de `previewTarjeta.ts`, que lo mete a mano. Si además se quiere
      quitar el +2 % por afijo del material, es decisión de balance con banco,
      no limpieza.
      Hecho en v1.15.22 con el Lote 0 de F97: fuera del catálogo, fuera del
      mock y fuera de los saves viejos; no queda ningún `aff_luck` en código.
- [ ] **B42 · La barra de próximo prestigio queda al máximo.**
      > "La barra de progreso para proximo prestigio debe mostrar cuanto necesito para el que sigue ... actualmente queda al maximo"
      Un progreso clavado al 100 % es un número que miente (criterio 1): tiene
      que mostrar lo que falta para el siguiente, y salir del mismo
      `pendingCores()` que cobra el botón.

**Features (después de los bugs que elijas):**

- [ ] **F88 · Expansores más caros, y los espacios persisten en el prestigio.**
      > "Aumentar el precio de los expansores de almacen, enseguida el jugador puede llegar al máximo. (Al hacer prestigio se deben mantener los espacios que haya comprado anteriormente el jugador)"
      Dos mitades: (a) la curva de precio, contra F66 (cuatro tramos hasta 240);
      (b) el prestigio conserva los espacios comprados, que hoy vuelve a 15 y
      reescribe F41. Con banco que acabe en `reload()`.
- [ ] **F89 · Rareza y afijos en las cards de ítems.**
      > "Que aparezca la rareza y los afijos en las cards de ítems: en almacen, en forja, en forja automática, en apertura de cajas"
      Los cuatro sitios leen el mismo `item`, solo falta pintarlo. Continúa
      F64/F73/F76/F77/F81.
- [ ] **F90 · La forja enseña la posible combinación antes de tirar.**
      > "Que la forja me de la posible combinación en el texto, ejemplo: Tier 2, Base Normal (%) / buena (%) / mejor (%), Potencial 2-3, Afijos afijo 1 (%)..., Rareza Comun+Comun=Comun (%) o Raro (%). Armemos este texto bien identado con colores, bolds, etc."
      Sale del preview del motor, no calculado en la vista (R3). Depende de F74
      (bases), F60 (rareza/afijos) y F82 (probabilidades).
- [ ] **F91 · Los logros de tiempo muestran lo que falta.**
      > "Los logros referidos a tiempo que muestren el tiempo faltante (1 dia estando top 1 ejemplo)"
      Ojo: la vía `ranking` sigue sin resolverse (discrepancia 6): "7 días top 1"
      no se responde con el estado solo.
- [ ] **F92 · Tarjetas x2 y x3 de daño de compañeros.**
      > "Nuevo item: Tarjeta x2 daño de compañeros y x3 - mismo funcionamiento que las de click, pueden salir en cajas, las x3 unicamente salen en cajas tier 3 o superior"
      **Choca con F71 decidido** (x1.5 tienda + x2 solo cajas, 30 s por R10/AFK).
      Hay que reescribir F71 o descartar: duración y tope por fijar.
- [ ] **F93 · Banner visible en perfil y de fondo en el nav.**
      > "En el perfil no se ve el banner, reescalar, tambien que se vea el banner en el fondo del nav de la pagina principal."
      Estética (criterio 4). Continúa F53/F54. Solo `preview.html`, sin banco.
- [ ] **F94 · Eventos por ventana de tiempo.**
      > "una idea para que los jugadores puedan meterse en un evento a tal hora donde el que mas nanitas saque en un tiempo gane por ejemplo, banners, logros, cajas tier alto, items valiosos, etc..."
      Feature grande: ventana/hora, métrica (producidas en la ventana, no saldo,
      si no gana el que ya era rico), ranking temporal y reparto de premios.
      Faltan duración, inscripción y anti-AFK.

- [x] **F96 · Contador de operaciones en vivo (ritmos y picos mientras se juega).**
      > "si encontras alguna estrategia para medir ritmos o picos de escrituras mientras alguien este jugando es bienvenido"
      **Hecho en v1.15.21.** Lo pedido más dos cosas que
      se decidieron en conversación: el numerito estilo FPS con semáforo
      (verde ≤6, naranja 7–12, rojo >12, con histéresis de 3 s) y `window.__ops()`.
      **De dónde sale:** captura del 9 de octubre, ~10 min solo AFK sin forjar ni
      clickear ni abrir rankings: **48 lecturas / 46 escrituras** en total. Medido
      contra el código, las escrituras son normales (~4-5/min: guardado 1 + ranking
      y tarjeta 1 + latido ~2 + presencia), pero el pico de lecturas (~27+14 en los
      primeros minutos) **no sale del juego idle**, que al arrancar hace ~4
      (`consultarSesion` ×2, `consultarBloqueo`, carga). Candidatos: una apertura
      de ranking (`getTopRankings` con `limit(40)`: N filas = N lecturas) o la
      consola de Firebase abierta en otra pestaña, que contamina el mismo gráfico
      del proyecto.
      **La estrategia, sin gastar cuota:** `src/services/contadorOps.ts`, contador
      en memoria y cero escrituras. Cada sitio real lo llama con su motivo
      (`guardado-users`, `guardado-ranking`, `tarjeta`, `latido`, `presencia`,
      `carga`, `bloqueo`, `sesion-check`, `ranking-tabla`): son ~8 líneas, una por
      sitio. Ring buffer de timestamps (30 min) + resumen por minuto y por motivo,
      expuesto como `window.__ops()` y overlay con `?ops=1`. Medir no puede costar
      lecturas: nada de listeners. **Y banco nuevo** con reloj falso que afirma el
      techo (≤6 escrituras/min en idle): si un cambio futuro mete un `setDoc` por
      tick, el banco lo caza en vez de la consola.
      **Lo construido:** `services/contadorOps.ts` (registro en memoria, cero
      operaciones), 12 motivos anotados en sus sitios (carga, guardado-users,
      guardado-ranking, tarjeta, tarjeta-lectura, visita, latido, presencia,
      soltar-sesion, sesion-check, bloqueo, ranking-tabla con su nº de filas),
      `ui/opsOverlay.ts` (píldora `W4·R0` fuera de `#app`, solo con `?ops=1`,
      detalle al tocar), y banco nuevo `opsCheck` (14: el reposo no se inventa
      nada, el semáforo, el pico que se abre en rojo y se cierra en verde, y la
      tabla que dice sus 27 filas).
      **Lo que el banco ya enseñó:** el arranque escribe 3 documentos
      (users+rankings+perfiles), no 1.
      **Cómo se usa:** abrir el juego con `?ops=1` y jugar normal; en rojo,
      tocar el numerito dice el motivo y la hora del pico.

### Ya encargo y repetido

- [ ] **F72 · Iconos de caja distintos por tier, con brillo y color.** *(Ya estaba en
      el lote F, aquí solo porque lo volviste a pedir: es el mismo encargo.)*

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

**Son dos cosas, y las dos son tuyas. Nada de la lista de abajo se puede
programar bien hasta que estén.**

| # | Qué | Por qué bloquea |
|---|---|---|
| **1** | **La curva de probabilidad de forja por debajo del T20.** Propuesta: **60% / 68% / 75%** (tramos 1-9 / 10-19 / 20+). Hoy está al revés: 78% en T1 bajando a 33% en T10. | Es un **cambio de signo** en la curva, y es lo que da forma al tramo alto de la forja. Sin tu "sí" el forjado sigue siendo más difícil cuanto más alto, que es lo contrario de lo que pediste. |
| **2** | **F19 · Lo que falta: si los logros seguros se tradean.** Decidido el 9 de octubre: el item se da y vale nanitas en cantidad buena, balanceada por logro. | Sin eso no se cierra el modelo de logros como items. |

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
| **9** | **F20, F22** · Avatar propio y comparar partidas | Desbloqueados el 9 de octubre (B8 confirmado): el avatar ya se puede leer de otro jugador. |

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

**Decidido el 9 de octubre: el item se da y vale nanitas en cantidad buena, balanceada por logro.** Lo que sigue abierto es solo si los seguros se tradean.

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

**Confirmado por el jugador el 9 de octubre: la tarjeta pública está bien así.** Desbloquea F20 y F22.

**Son dos los bugs abiertos del juego: B11 y B21.** Todos los demás están cerrados y con banco.

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

### B21 · El título "Mil Millones" no aparece — HECHO (sin versión: sale en la próxima)

> "para dsp, el titulo mil millones no aparece"

**Causa raíz: el degradado no tenía fondo.** Cinco títulos equipados no se
veían en ningún sitio que pinta con `titleStyleFor()` (cabecera del perfil,
cabecera, filas del ranking, tarjeta ajena): el estilo ponía
`color:transparent` con `background-clip:text` pero ningún `background-image`
que recortar, y el texto quedaba invisible. La carta del catálogo sí lo
enseñaba, en plano, porque ese camino nunca ponía el transparente: dos copias
de la regla que ya decían cosas distintas. Ahora la bandera `gradient` se
traduce a `background-image` en la única función (el valor tal cual si es un
degradado, brillo del propio color si es `'true'`), y la carta usa esa misma
función. `identidadCheck` (+4, con la invariante "transparente ⇒ con fondo"
sobre los 20 títulos).

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

**Confirmado por el jugador el 9 de octubre: el ritmo está bien.**

### P4 · Verificar en partida real — DESCARTADO

**Sacado de la lista a petición del jugador (9 de octubre):** no se va a jugar
otra partida para medir el ritmo. Se queda escrito que la duración real nunca se
midió: la cifra de "hasta dónde se llega" no existe y nadie la inventa.

---

## Hecho

_Lo terminado, una línea y el commit. La cifra viva del proyecto: **49 bancos, 2719**, todas en verde._

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
- [ ] **La rareza de un compañero forjado de T11 en adelante dice dos cosas distintas
      según quién la lea** *(descubierto haciendo F76, 8 de octubre de 2026)*.
      `crearCompanioDeTier()` estampa `TIER_SYSTEM.rarityByTier[tier] || 'Común'` y
      `rarezaDeTier()` devuelve `'Divino'` para el mismo tier: un T11 forjado sale
      Común mientras todo lo demás de ese tier es Divino, y su ingreso paga ×1,00
      en vez de ×1,60. **No se toca aquí a propósito:** cambiarlo es ×1,6 de ingreso
      para esos compañeros, y eso es balance, no texto. La pantalla de forja anuncia
      lo que el motor estampa —las dos salen de `rarezaDeCompanionForjado()`—, así que hoy nadie miente; lo que queda es decidir cuál de las dos reglas
      es la buena.
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
        consola, y el jugador se quedaba con un app vacío. Ahora hay una pantalla que
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
### La columna del cartel de la base no llega a su contenido a 390

- Al anadir la barra de consumibles se vio que el `<section>` del contador mide 328 px y su
  contenido pasa de eso: el boton RECOLECTAR es de 128 px y por encima y por debajo hay el
  numero, el ingreso, el dano por click, el aviso de ascension y ahora la barra. El `section`
  es `flex flex-col justify-center min-h-0` dentro de una rejilla, asi que el desborde se
  reparte por los dos lados y **la barra se sale por abajo de la tarjeta**. A 1440 no pasa.
- **No lo creo la barra.** La columna ya venia justa, y esto solo se ve a 390, que es el ancho
  en el que se juega de verdad. Es una decision de layout, no un parche: o el boton RECOLECTAR
  cede tamano a 390 (`max-h-[38vh]` ya esta puesto, pero 38vh de 844 son 320 px y sobra margen),
  o el `<section>` crece y deja de medir lo que mide.
- Lo que **no** se debe hacer es dejar la barra con `absolute` o con margen negativo para que
  "entre": es tapar el desborde en vez de arreglarlo, y el siguiente elemento que se anada
  vuelve a salir.
### La barra de consumibles: tres buffs para tres ranuras, y el tope sale solo

- Se pueden asignar tres buffs (`afk`, `clickX2`, `clickX3`) a tres ranuras y nada puede
  estar en dos ranuras. **Quiere decir que la barra se llena del todo o no se llena:**
  o las tres ranuras tienen uno de los tres, o sobran huecos que no se pueden tapar.
- Es lo que se pidió y es coherente —un mismo consumible en dos huecos gastaría el mismo
  item desde dos sitios—, pero tiene una consecuencia que conviene tener presente: **no hay
  estado intermedio que sirva para algo.** Si sale un cuarto buff asignable, se puede
  repetir y tener dos ranuras con lo mismo (que es justo lo prohibido), o sube el número
  de ranuras y se rompe la rejilla de tres. **Ninguna de las dos se decide sin decirlo.**
- Lo que sí está resuelto: la lista es de `buffId`, no de item, así que añadir un
  consumible nuevo es tocar `CONSUMIBLES_ASIGNABLES` y la puerta se abre sola para
  selector, validación y coacción. No hay un segundo sitio donde estén escritos.

### Sin comprobar en el navegador: que la hoja se cierre al elegir y quitarla con la cruz

- `showConfirmModal()` ahora **devuelve su `close()`**, porque un diálogo con botones
  propios en el contenido no lo cierra el `close()` de `confirmar()`: elegir un
  consumible lo asignaba y dejaba la hoja encima, tapando la barra que acababas de
  cambiar. El valor de vuelta es un modo nuevo solo para quien lo use.
- Lo que **no** se pudo ver: que la hoja se cierre de verdad al pulsar una opción, ni que
  la ✕ de la esquina quite el consumible. El banco visual se quedó sin poder medirlo
  porque `preview.html` con `embedded=1` es una carrera con la medición y el iframe
  desaparece entre llamadas. Las dos rutas están cubiertas por pruebas del motor, pero
  **el efecto visual del cierre no**. Es lo primero que hay que mirar en una partida real.
- De paso: **el servidor de desarrollo se wedgea.** Tras horas sirviendo el mismo módulo
  con decenas de cambios, `preview.html` se quedó con app vacío sin ningún error en
  el log. Reiniciarlo lo arregló. Cuando el preview "no pinta", reiniciar el servidor
  antes de culpar al código: se pierde mucho tiempo buscando un fallo que no existe.

### El brillo: el numero, el efecto, y lo que no se ha podido mirar

- **Hecho: el numero.** `src/data/brillo.ts` calcula un entero del 0 al 4 a partir del
  potencial, del nivel y del tope que pone la rareza, con `tieneEfectoPropio()` para el
  efecto propio y `etiquetaDeBrillo()` para el texto. 27 pruebas en `brilloCheck`, que es
  el banco 33. Es dato puro, sin una clase de Tailwind.
- **Hecho: el efecto.** `ui/brillo.ts` viste ese numero y lo pintan las tres pantallas:
  el icono de la celda del almacen, la ficha del recolector en la base y la tarjeta del
  ranking. Las tres salen de la misma funcion, asi que no pueden discrepar.
- **La decision que se tomo, y por que.** CSS puro, sin imagenes. El color es el de la
  rareza por currentColor, para que el brillo diga cuanto y la rareza siga diciendo que.
  El anillo va en un span aparte porque animar box-shadow repinta la celda cada fotograma.
  El escalon 1 no se mueve: con veinte Comunes latiendo a la vez seria ruido. Y el
  barrido del 4 **reutiliza `rareSweep`**, que ya existia para los estados raros, en vez
  de inventar una animacion nueva.
- **No esta hecho, y se dejo sin hacer a proposito:** el brillo del companero. El teorema
  es el mismo, pero habria que publicar level y potential en la ficha del companero, que
  hoy no los tiene. Lo que se pidio fueron "las armas", y un companero no es un arma.

#### Lo que solo se puede mirar con el ojo, y sigue sin mirarse

- Que el escalon 1 **no se mueva** es una decision de gusto y aqui no hay forma de
  comprobar que un halo quieto se lee mejor que uno que late.
- Que **ocho segundos entre barridos** sea el intervalo. Si se ve poco raro, se baja.
- Que el escalon 4 se distinga de un 3 **de un vistazo**: los dos tienen anillo y los dos
  laten, y lo unico que los separa es el barrido, que aparece una vez cada ocho segundos.
  Puede que no baste.

#### Una nota de medicion que aplica a todo lo que se anime

- El navegador del banco visual **reporta movimiento reducido**, asi que las animaciones
  salen a 0,00001s. Alli solo se puede medir la geometria: que el anillo rodea al icono,
  que no desborda la pantalla ni su celda, y que no intercepta el clic. **El movimiento
  no se ha visto**: hay que mirarlo en una partida de verdad.
- Por eso el CSS no depende de nada que solo se vea en movimiento. El anillo tiene su
  forma en reposo, y con movimiento reducido se queda en ella.

### Un fallo que solo apareció porque el banco miraba lo que no era un item

- `techoDeNivel()` devolvía el techo del recolector para **todo lo que no fuera compañero**,
  así que un material de forja con un `level` de 99 (lo que deja un guardado viejo)
  quedaba por encima del techo y se llevaba los dos puntos. **Un material podia llevar el
  efecto propio.**
- Lo corrigió el banco, no el ojo: la prueba de "un material no lleva nunca el efecto
  propio" falló con un 4 en la mano, y el arreglo es de una línea (`return 0` para lo que
  no es recolector ni compañero). **Lo que no tiene nivel no puede estar al tope de
  él**, que es la frase que hay que dejar escrita para el siguiente.
- **Y un aviso sobre el banco de reglas puras.** Las pruebas del nivel y del potencial
  mideban con un Raro, que topa en 2: con el tope puesto, medir el nivel no se ve nada y
  la prueba daba verde **con la regla rota**. Ahora usan un Divino, y el comentario explica
  por qué. Un tope de rareza en medio de la regla es una tapadera, y se descubre solo
  cuando alguien escribe la prueba y se pregunta por qué no se mueve.

### El companero ya paga su rareza: lo que falta mirar

- Hecho: el multiplicador de rareza y el extra por potencial, el ingreso y el stat unificados,
  la ficha del companero con nivel y potencial para el halo, el borde del cajon del recolector
  en el color de su rareza, y el texto "Brillo N de M" fuera de la ficha (se queda en el title).
- **SIN COMPROBAR EN PANTALLA, Y HAY QUE MIRARLO EN UNA PARTIDA DE VERDAD.** El banco visual
  se quedo con `app` a cero y sin un solo error en el log, asi que no hay ni una medicion de
  esto. Concretamente:
  - Que el borde del cajon del icono salga del color de la rareza tambien en la base, que era
    lo que faltaba y no se ha podido ver arreglado.
  - Que el halo del companero salga, y que con un companero Divino al tope de nivel tenga el
    barrido. En el preview no hay ningun companero con nivel y potencial, asi que **su halo no
    sale ni en el banco** hasta que se le pongan a los del ejemplo.
  - Que la linea de la rareza y las estrellas ya no se parte a dos renglones.
- **Y una correccion al Metodo.** El `preview` dejo de montar la pagina del todo en la
  ultima tanda, con app a cero y el log limpio, y la causa sigue sin ascertainse. Reiniciar
  el servidor lo habia arreglado la vez anterior; esta vez no se probo. **Cuando el preview no
  pinta, reiniciar el servidor antes que nada.**
- **Y una correccion a un banco, que es de fiar.** Una prueba del multiplicador afirmo que un
  T{n+1} en su peor caso gana siempre a un T{n} en el suyo, y fallo: un T2 con estrella 5 y un
  T3 con estrella 1 empatan en 21, porque los rangos bajos se pisan y el redondeo los junta.
  **Ese empate es anterior a este cambio**: la prueba inventaba una garantia que el rango no
  tiene. Ahora se comprueba a igual potencial, que es lo único que se puede prometer, y se
  dejo escrito por que no se promete mas.


### Tanda del jugador: cuatro cosas sin comprobar en pantalla

- Hecho: la etiqueta "Daño" pasa a "Recolección por click", el numero grande de la ficha es uno solo con
  el desglose en el title, fuera la linea de details del recolector, boton de notas de parche en
  Ajustes, visitas que suma aperturas y filtro de Cajas en el almacen.
- **Solo el filtro se ha podido medir.** En el preview los cinco botones salen y los cuatro se
  reparten la rejilla exacta: Todo 21, Recolectores 9, Companeros 5, Cajas 1, Otros 6, y la suma
  cuadra con el todo. Lo demas no: la ficha con el numero grande, el texto fuera y el boton de las
  notas **hay que mirarlos en una partida de verdad**.

### Que todo quepa sin scroll: hecho a medias y sin una sola medicion

- Hecho: se quita el lg:overflow-hidden que cortaba el contenido en escritorio en silencio, el boton
  grande pasa a medirse con clamp sobre vh (104 px de suelo, 26% de la altura, 176 px de techo) y el
  contador igual con suelo de 24 px. Ese era el recorte, y era el que hacia desaparecer cosas.
- **El banco visual NO ESTA DISPONIBLE, y no es un fallo del codigo.** El navegador de medicion
  va por un proxy que devuelve **502 Bad Gateway** al pedir el servidor de desarrollo, mientras
  que PowerShell responde 200 al mismo sitio. Se intento de todo: las dos rutas de preview, las
  siete pantallas, tres viewports, servidor reiniciado y los procesos duplicados cerrados.
  **Cuando aparezca un 502 en el titulo de la pestaña, no es que el preview este roto: es que
  no llega.** Se pierde mucho tiempo persiguiendo un fallo que no existe.
- **Lo que queda:** las otras seis pantallas. Aqui solo se ha tocado la base, porque es la unica
  que se ha podido identificar leyendo el codigo —el recorte y el boton—. Forja, mercado, perfil,
  ranking y ascension tienen tablas largas y rejillas propias, y medirlas sin navegador es
  adivinar. Cuando el banco vuelva, lo primero es un barrido de scrollHeight en las siete a
  1440x900, 1280x800 y 1024x768, y ahi se decide que mas encoger.
- Y una nota sobre el criterio, para que no se pierda: **el recorte se quita y se deja la barra
  como red, no al reves.** Que haya barra no es el objetivo, pero una red que deja todo
  alcanzable siempre es mejor que un recorte que solo aparece en pantallas que no son las de
  diseño —y el recorte no falla nunca en la pantalla donde se prueba, que es lo que lo
  hace pasar.

### El ranking en movil y el avatar: hecho, sin ver

- Hecho: el ranking deja de salirse por la derecha en pantallas estrechas (minmax(0,...) en las
  columnas que ceden, y las medallas bajan a su propia linea por debajo de 26 rem de ancho), y el
  avatar pasa de iniciales a icono cuadrado con el banner como fondo de verdad.
- **Sin ver, por el 502 del proxy.** El ranking es lo primero que hay que mirar en un movil
  real: si la fila se ve, ya esta; si sigue saliendose, el problema es un ancho fijo mas abajo que
  esta fuera de la cuenta.
- **El icono de los cosmeticos es una decision que se puede rehacer en un commit.** El mapa esta
  en `data/avatarIcons.ts` y cambiar un icono es cambiar una fila. Conviene mirarlos todos en
  el Perfil antes de dar por buena la eleccion de las formas: "Rejilla" por rejilla, "Atardecer"
  por el sol bajo, etc.
- Y lo que **no** esta hecho de lo que se pidio de los cosmeticos: que cada icono lleve su
  propio color en vez del claro fijo. Se puede hacer con una sombra detras y un color por
  cosmetico, pero hay que verlos sobre los catorce fondos antes, porque un color que se lee
  sobre el Abismo no se lee sobre la Torrente.

### Forja: las tres cosas del jugador, hechas

Las tres peticiones de una tacada sobre la forja:

- **Hecho: las piedras llegan al 95 %.** `piedrasParaObjetivo()` en `data/crafting.ts` y el boton
  "gastar las necesarias". El motivo de fondo era que **el tope de cinco piedras impedia llegar al
  95 %**: cinco son un 60 % y la base del T10 es 0,33, o sea 0,93. El tope estaba puesto delante
  del objetivo, y el jugador pagaba cinco por una tirada que ya sabia que no iba a llegar.
- **Hecho: forjarlo todo del tier.** `autoForgePreview()` y `autoForge()`. Reparte los materiales
  del tier por potencial descendente y forja cada pareja; con cuatro en el T1 salen dos tiradas.
  Los resultados salen en una lista, como al abrir cajas, con lo gastado arriba.
- **Hecho: los consumibles se usan solos, hasta el tope.** En el boton de serie no hay escolha de
  piedras: el motor gasta por par las que hagan falta para llegar al 95 %, con los afijos de **ese**
  par. La pregunta que quedaba abierta —si la nanoparticula se puede repetir y apila afijos— resulto
  no hacer falta: en el auto-forge se usa una por tirada, que es lo que la regla ya hacia, y
  `ui.nano` sigue siendo el interruptor de a uno.

Tres cosas que salieron haciendo esto y que no estaban previstas:

- **El motor era el que tenia que decidir las piedras, no la vista.** Cada par tiene afijos distintos
  y los afijos bajan el numero de piedras. Una cuenta unica para toda la serie habria gastado de mas
  en las parejas sin afijos, asi que `autoForgePreview()` devuelve `stones[]` y `autoForge()` gasta
  `plan.stones[i]`. La comprobacion que lo ata es "el preview promete el mismo gasto que el cobro":
  si difieren en uno, en cinco tiradas el jugador ha pagado cinco piedras que no le dijeron.
- **El equipado se filtraba de dos formas distintas y no casaban.** La forja manual miraba la marca
  `w.equipped` del almacen; el auto-forge miraba un id suelto del estado. Un recolector con la puesta
  y sin el id se colaba en el reparto, y la tirada reventaba **despues** de haber gastado la anterior.
  Ahora los dos pasan por `idsEquipados()`.
- **La forja manual y el auto-forge no tienen un segundo dado.** Cada tirada de la serie llama a
  `forgeCollector()` o `forgeCompanion()`. Un par ordenado por el boton y el mismo par elegido a mano
  dan el mismo resultado con el mismo cobro, y eso no se decide por comentario: se decide porque no
  hay dos caminos.

Y la nota de metodo, que es la que mas caro sale de las tres:

- **UN BANCO QUE FABRICA DATOS IMPOSIBLES NO FALLA: FALLA MINTIENDO.** Los items se montaban con
  `collector('p1', 1, { potential: 1, damage: 20 })`, y la migracion `migraPotenciales()` deriva el
  potencial **del daño**, porque potencial y daño son dos vistas de lo mismo. Al cargar, el motor
  corrigio los cuatro items a potencial 5, los cuatro quedaron empatados y el reparto salio por id.
  El banco daba verde sobre una afirmacion falsa y el diagnostico apuntaba al motor. Ya habia pasado
  con la rareza del compañero de ejemplo, que hacia que los bancos de ingreso midieran el
  multiplicador. Los datos los pone ahora `recDePotencial()`, que usa `danioDeRango()` —la misma
  funcion del motor— para que un banco no pueda crear un item que la migracion vaya a corregir.
- Y la de la prueba escrita en el tier equivocado: la de la nanoparticula media en el T9, donde cinco
  piedras ya topan el 0,95 y la nano no puede bajar el numero porque ya es el minimo util. En el T10,
  donde si importa, baja de seis a cinco.

**Lo que no se ha podido comprobar: nada en pantalla.** El navegador sigue pasando por un proxy que
devuelve 502 con el servidor de desarrollo en marcha, asi que el boton, la lista de resultados y el
modal de confirmacion estan escritos y tipados, pero nadie los ha visto. Lo que si se ha comprobado
por codigo es que el numero que promete el modal sale del motor y es el que se cobra.


### Cuota: lo que salio del pico de las 23h

- [x] **B39 � El pico se comio la cuota free.** 20K escrituras en el dia con ~8K en una hora y ~3K lecturas. Cuadra con testeo intensivo (1-2 acciones/s entre juego, perfiles y recargas), no con un bug: cada accion guarda, cada perfil ajeno es 1 lectura + 1 escritura, cada ranking hasta 40 lecturas.
  Estrategia (industria: cache con TTL + reutilizar lo leido + coalescing, sin tocar reglas): ranking cacheado 2 min, la visita reutiliza la tarjeta ya leida en vez de releerla, guardado 30s->60s y ranking 5->10 min. Lo calculable no se quita para la cuota: Firestore cobra por documento, no por campo. Hecho en v1.15.18: lo cubre `perfilCheck` (+6, con `lecturas`/`consultas` contadas en el stub). OJO de metodo: el commit `813a5ad` se llevo este codigo dentro con mensaje solo de F74, y `toastCheck` cayo en el run completo por edicion concurrente (33/33 en solitario). Re-correr `npm run verify` entero cuando el otro agente pause.

- [x] **B40 · Modo pruebas que no paga la tabla.** Paso 1 (jugador, sin codigo): 30 min de juego normal contra 30 min de testeo en la consola de Firebase + tamano real del doc `users/{uid}`; si el testeo multiplica x10, hipotesis confirmada. Paso 2 (codigo): flag `cyberforge_modo_pruebas` en `localStorage` que publica la partida igual pero se salta ranking + tarjeta; apagado por defecto, sin UI, con banco en `guardadoCheck`. Hecho en v1.15.20: `guardadoCheck` 40/40 en solitario (+3). Full suite pendiente del otro agente: su refactor F97 de afijos rompe `tsc`, el bundle de `verify` (3 MISSING_EXPORT de `crafting.ts`) y un check de `perfilCheck` (afijos del item forjado, 41/42); nada de eso toca este cambio.

- [x] **B43 · La forja en serie guardaba una vez por pareja.** El pico de la mañana (407 escrituras en una hora, con el pico justo al forjar compañeros): `autoForge()` llamaba a `forgeCollector()/forgeCompanion()` de a una y cada una guardaba y repintaba, más un guardado final. N parejas = N+1 guardados = hasta 2N+2 escrituras, porque cada guardado escribe partida + ranking. Causa raíz: el comentario decía "se guarda una vez al final" pero el código no lo hacía; la mejora automática (F49) ya resolvió lo mismo con `sinGuardar/sinRepintar` y la serie no lo usaba. Hecho en v1.15.24: las dos forjas aceptan `opciones` y la serie guarda y repinta una vez al final; lo cubre `forjaCheck` (+6, con `escrituras`/`filas` contadas en el stub: dos parejas = 3 escrituras y 1 fila). OJO de método: el commit `b014813` del otro agente se llevó dentro la mitad de este cambio (la guarda de `forgeCollector`) con mensaje que decía "sin cambio en forja", porque commiteó en mitad de esta edición; el resto iba en el árbol y no se perdió nada. Se numeró B43 porque B41 ya era otro arreglo (el del afijo en el mock de tarjeta); los comentarios B41 que entraron en `b014813` son este mismo cambio.

### Lote J · ENCARGO DEL 9 DE OCTUBRE (cuatro ramas de pasivas)

*Lo pedido, con tus palabras. **Diseño cerrado en conversación el 9 de octubre**: no
reparte el árbol en cinco filtros sino en **cuatro ramas estilo WoW** (Asalto /
Manada / Fortuna / Forja), cada una con su fantasía y su keystone, con
horizonte de 15 nodos por rama y salida en dos oleadas (10 + 5). La devolución
de núcleos va en el parche grande y es una sola vez.*

- [ ] **F97 · Cuatro ramas + rebalanceo de afijos y autos, con devolución.**
  Decisiones tuyas, ya tomadas:
  1. **Afijos fijos por rareza** (0/1/2/3/4/6) para recolectores de tienda, caja y
     forja. La rareza se sortea y la cantidad sale sola: si un forjado lleva 2
     afijos, es Épico por construcción. El linaje deja de decidir *cuántos* y
     pasa a decidir *cuáles* (los compartidos entran primero, que ya existía).
  2. **Magnitud de afijo por tier**, calculada al usar y no guardada: el mismo
     afijo pega más en tier alto. Sin migración de items; lo guardado cambia de
     número al cargar porque la fórmula cambió, y es rebalanceo declarado.
  3. **Fuera `aff_luck`.** Causa raíz medida antes de tocar nada: su `craftLuck`
     solo lo leía la valoración (precio), ningún cálculo de probabilidad —el
     equipar-des-equipar no hacía nada, pero el texto prometía +10 %. Misma
     clase que B18. La suerte real de los materiales (+2 % por afijo) no se toca.
  4. **Autos domados:** Total a +1/s ×3 y los autos no usan x2/x3; el crítico se
     queda (B25). Techo del árbol ~20/s en vez de 37/s.
  5. **Manada:** buffers nuevos por caja (solo-pasivos, solo-clicks, global) +
     afijos innatos de compañero escalados por tier, sin herencia de forja (la
     forja sigue en potencial).
  6. **Fortuna:** licencias T2/T3 (unlock 0/1) + Eco, doble 2 % ×5 solo
     apilables y con hueco.
  7. **Keystones:** Sobrecarga (cada 50 clics un ×3) / Mente Colmena (+4 % por
     activo) / Jackpot (1 % subir tier) / Obra Maestra (firma ★5×★5).
  8. **Devolución única** en el parche grande: lo gastado vuelve a `cores`,
     árbol vacío, `totalCores` intacto.
  Orden: Lote 0 motor (1+2+3, sin árbol) → Lote 1 autos (4) → Lote 2 parche
  grande atómico (~10 nodos/rama + 5+6+7+8) → Lote 3 las 20 restantes.
  Abierto: sacar `core_yield` o no (F70 sigue abierto); paridad por coste total,
  no por tarjetas (Fortuna nace con 1-2 de más).
   **Lote 0 hecho en v1.15.22** (motor, sin tocar el árbol). **Lote 1 hecho en
   v1.15.23** (autos domados). **Lote 2a hecho en v1.15.25** (ramas, puerta por
   puntos y devolución). **Lote 2b hecho en v1.15.26** (cuatro keystones).
   **Lote 2c hecho en v1.15.27** (licencias y Eco). **Lote 2d (1ª parte) hecho en
   v1.15.28** (afijos de compañero). **Lote 2d (2ª parte) hecho en v1.15.29**
   (buffers de compañero). **Lote 3 hecho en v1.15.31** (15 nodos por rama,
   60 en total). **5 logros+banners hechos en v1.15.32** (uno por mecánica
   nueva). F97 cerrada.

### Encontrado haciendo B43 (9 de octubre, para quien lleve F97)

- [ ] **El orden de forja por stat es lotería desde F97.** `filterCheck` dio 94/96 en la línea base de la mañana (n0=77 por encima de n5=74 con la misma base) y 96/96 en las dos pasadas siguientes, sin tocar nada entre medias. Causa: los fixtures `collector()` son Épicos sin afijos y la migración les sortea 2 con `Math.random` sin semilla al cargar, así que "misma base ⇒ decide el nivel" solo vale cuando el sorteo no pone un afijo de daño en el de nivel bajo. Fijar los afijos del fixture o sembrar el dado lo deja determinista.
  Segunda cara de la misma moneda, encontrada en el banco nuevo de B43: con el dado fijado (`conRoll`), dos forjados seguidos del mismo milisegundo salen con el MISMO id (el sufijo sale del dado y la cabeza de `Date.now()`), así que comparten espejo en el almacén y contar items es otra lotería. El banco cuenta `forgedCount`, que sube uno por acierto sí o sí.
  Tercera instancia en la misma tanda completa: `stateCheck` 305/307 con dos clics que pegan el doble de lo anunciado, un crítico con el dado sin fijar sobre un fixture al que la migración pudo poner afijo de crítico. Ninguna de las tres toca este cambio.

