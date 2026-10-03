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
      ascender—; las del árbol nunca општились porque viven en `nodeLevels`.
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
- [ ] **F42 · Fuera la pasiva offline.** Se elimina entera: la `grantAfkCatchUp()` y su
      reloj. El juego no da ingreso sin que estés mirando.

### Lote 4 · CONSUMIBLES

- [ ] **F43 · Usar N de golpe.** Que se pueda elegir la cantidad, se descuente esa cantidad
      y se **sume el tiempo**. Topes: AFK **30 minutos** (3 tarjetas) y click x2/x3
      **5 minutos**.

### Lote 5 · EXPANSORES Y ALMACÉN

- [ ] **F44 · Expansores hasta T30.** Pides "hasta T30" y el juego tiene **10 cajas**: los
      expansores de T11 a T30 no tienen de dónde salir. **Decisión tuya:** ¿se suben las
      cajas a 30, o los expansores altos salen de otra parte?
- [ ] **F45 · Buscador** en el almacén.
- [ ] **F46 · Orden personalizado** — hay que mirarlo, porque con el agrupado de pilas que
      se acaba de tocar puede haber pasado a ser incoherente.
- [ ] **F47 · Los expansores a "Mejoras"**, no a recursos.

### Lote 6 · RULETA, CRISTALES Y NÚMEROS

- [ ] **F48 · El check de saltar animaciones va en la ruleta**, no en el perfil.
- [ ] **F49 · Mejora automática de cristales** hasta agotarlos.
- [ ] **F50 · Precisión de los contadores.** Con pocas nanitas el número no se mueve.

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
      cuántos materiales, que sean distintos y del mismo tier, y cuánto esquirlas da el
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

- [ ] **F51 · Explicar los afijos.** Incluye la pregunta concreta: "¿cuántos afijos puede
      tener un Mítico?". La respuesta sale de `AFIX_MIN_POR_RARIDAD` y no está escrita en
      ninguna parte que el jugador pueda leer.
- [ ] **F52 · Lore de todos los items**, no solo de los que tienen entrada.

### Lote 8 · APARIENCIA

- [ ] **F53 · Banners, marcos y títulos en Perfil, Menú y Ranking.**
- [ ] **F54 · Los marcos no desbordan** el avatar.
- [ ] **F55 · Logros 100% obtenibles**, con banco que lo compruebe. Aquí hay un
      ~~sorpresa~~: el logro `overclocked` se acaba de reasignar y hay que mirarlo con lupa.

### Lote 9 · CAJAS

- [ ] **F56 · Validar la apertura masiva** antes de abrir: cajas, llaves y **espacio**.
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
   más alto abre hasta 65 ranuras, y a partir de ahí el almacén se llena solo con expansores.

---


## Lo único que espera tu respuesta

**Son cinco cosas, y las cinco son tuyas, no más. Nada de la lista de abajo se puede
programar bien hasta que estén.**

| # | Qué | Por qué bloquea |
|---|---|---|
| **1** | **La curva de probabilidad de forja por debajo del T20.** Propuesta: **60% / 68% / 75%** (tramos 1-9 / 10-19 / 20+). Hoy está al revés: 78% en T1 bajando a 33% en T10. | Es un **cambio de signo** en la curva, y es lo que da forma al tramo alto de la forja. Sin tu "sí" el forjado sigue siendo más difícil cuanto más alto, que es lo contrario de lo que pediste. |
| **2** | **B8 · Ver el perfil de otro jugador.** ¿Se publica una **tarjeta pública** nueva, o se abre `users/{uid}` a lectura? | **Es privacidad, y no lo debe decidir un agente.** Recomiendo la tarjeta pública: lo no recomendable es abrir el documento privado, porque un incremental te enseña el gasto y el inventario de tu competencia. Bloquea F20 y F22. |
| **3** | **P4 · Jugar otra partida y decir hasta dónde llegas.** | `balanceCheck` comprueba que los números encajen entre sí, no que la partida dure lo que tiene que durar. Eso solo se mide jugando. |
| **4** | **F19 · Dos cosas de los logros como items.** Qué pasa con el item si ya tienes el logro (¿se vende, se guarda, no se usa dos veces?), y si los logros **seguros** son tradeares o solo los de caja. | Cambia el modelo de logros entero. Es la última cosa del lote a propósito. |
| **5** | **P5 · Las cajas ya no dan nanitas.** El premio pasó de ×14-22 del par a **25-40%**, porque era una máquina de imprimir. | Cerrar el bucle compra-venta era lo que pediste, y la única palanca que quedaba era la **fórmula** de las nanitas. Con menos nanitas de las cajas, la **forja pasa a ser el ingreso principal** y la partida puede hacerse más lenta. El sitio del ajuste es un número, y cualquier valor sigue teniendo la prueba de que no supera el par. |

**Y una cosa que no es una decisión, solo una limpieza:** `.github/workflows/publicar.yml`
falla en **todos** los pushes porque Pages no está activado en el repo. **No quieres
Pages**, así que lo razonable es borrar ese workflow y que deje de aparecer rojo. Es una
línea pendiente, no un bloqueo: no toca el juego.

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
- [ ] **Cada arranque programa un guardado que no hacía falta** _(salió de lo anterior)_.
      `if (user && hayPendientes(uid)) setTimeout(saveToFirebase, 1200)` se comprueba
      **después** del guardado de carga, y ese guardado acaba de anotar la cola. Así que
      la condición **es cierta siempre**: cada carga de página dispara una escritura a
      Firestore 1,2 s después de abrir, para guardar lo mismo que ya está guardado. No
      rompe nada —es idempotente— pero es tráfico de sobra, y **es lo que se coló en el
      bucle de clicks**. La condición parece querer decir "quedó algo de la sesión
      anterior"; hay que mirarla antes de tocar `naniteQueue`.

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

_Lo terminado, una línea y el commit. La cifra viva del proyecto: **30 bancos, 1827**, todas en verde._

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
- [ ] **`.github/workflows/publicar.yml` se puede borrar.** Como no hay Pages y no se
      quiere, este workflow solo consigue que **todos los pushes salgan en rojo** en
      `configure-pages`. Los pasos que dependen del código (`tsc` y el que falla la
      publicación si existe `dist/admin.html`) están los dos en verde; lo único que falla es
      la activación manual, que no se va a hacer. Borrarlo quita el ruido sin tocar el juego.
      _Pendiente de que lo confirmes: implica borrar un fichero del repo._
