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

## Lo único que espera tu respuesta

**Son cuatro cosas, y las cuatro son tuyas, no mías. Nada de la lista de abajo se puede
programar bien hasta que estén.**

| # | Qué | Por qué bloquea |
|---|---|---|
| **1** | **La curva de probabilidad de forja por debajo del T20.** Propuesta: **60% / 68% / 75%** (tramos 1-9 / 10-19 / 20+). Hoy está al revés: 78% en T1 bajando a 33% en T10. | Es un **cambio de signo** en la curva, y es lo que da forma al tramo alto de la forja. Sin tu "sí" el forjado sigue siendo más difícil cuanto más alto, que es lo contrario de lo que pediste. |
| **2** | **B8 · Ver el perfil de otro jugador.** ¿Se publica una **tarjeta pública** nueva, o se abre `users/{uid}` a lectura? | **Es privacidad, y no lo debe decidir un agente.** Recomiendo la tarjeta pública: lo no recomendable es abrir el documento privado, porque un incremental te enseña el gasto y el inventario de tu competencia. Bloquea F20 y F22. |
| **3** | **P4 · Jugar otra partida y decir hasta dónde llegas.** | `balanceCheck` comprueba que los números encajen entre sí, no que la partida dure lo que tiene que durar. Eso solo se mide jugando. |
| **4** | **F19 · Dos cosas de los logros como items.** Qué pasa con el item si ya tienes el logro (¿se vende, se guarda, no se usa dos veces?), y si los logros **seguros** son tradeares o solo los de caja. | Cambia el modelo de logros entero. Es la última cosa del lote a propósito. |

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
| **3** | **F33** · Forja de 2 materiales que hereda el stat | **No espera ninguna respuesta tuya**: toca la cantidad de materiales y de dónde sale el stat, no la probabilidad. **Con 2 materiales un T10 sale 2,4× la carta; con 3 salen 91× y nadie lo usa.** El instinto era correcto y el motivo es aritmética. La curva de 60/68/75 es **otra cosa** (F34) y es independiente de esta. |
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

### F26 · El cristal tiene que ser del mismo tier del item, estrictamente

> Arreglarlo para que necesite cristales del mismo tier del item que estoy mejorando estrictamente, y que la progresión se mantenga como está ahora para que haya fallo.

**DECIDIDO, y es mejor que la variante que yo había propuesto.** Tres razones: es **mucho
menos invasivo** (no cambia la economía, el cristal sigue siendo lo que multiplica la
probabilidad); **el fallo se conserva**, que es lo que salva a F32; y **hace legible la
elección** — con la regla estricta no hay que hacer cuentas, el botón dice "necesitas
Cristal T8".

**Y tiene un efecto secundario que va justo a donde quieres con F31:** si un T8 **exige**
cristal T8 y ese cristal sale de las cajas altas, **las cajas dejan de ser un adorno y
pasan a ser obligatorias para progresar**.

**El problema que destapa, y es el tercero del mismo tipo:** la regla estricta necesita
cristales de nivel 1 a 10, y hoy hay **4 declarados y solo 2 obtenibles**. El 3 y el 4
tienen nombre, multiplicador y probabilidad escritas, y **no los saca nadie**. Si el T8
pide cristal T8 y ese cristal no sale de ninguna caja, el T8 no es contenido
inalcanzable: **es un muro**. Resuelto en F31/F36: un nivel por tier, hasta 30.

### F28 · La ruleta va demasiado rápido en el navegador y bien en el celular

> En el navegador la ruleta se ejecuta muy rápido, en celular anda bien. A lo mejor con un delta time.

**Tu hipótesis es la correcta, y hay un sitio donde ya está escrito por qué debería
funcionar — por eso es raro que no funcione.** El diseño ya cuenta **ventanas de tiempo
visibles**, no vueltas, y `rouletteCheck` lo comprueba. Si en el navegador va más rápido,
es que algo por debajo cuenta otra cosa.

**La causa más probable es exactamente la que dices:** si la animación avanza contando
**frames**, un monitor de 144 Hz hace la misma animación en la mitad de tiempo real que
uno de 60 Hz. En el móvil el navegador baja a 60, así que **allá va "bien" por
accidente**. El síntoma —"rápido justo donde hay más potencia"— encaja con esto mejor que
con ninguna otra explicación. Y sí: **delta time**.

**Ningún banco lo cubre:** `rouletteCheck` mide la matemática de la curva, no cuánto
tarda en pantalla. Es caso de `ruleta-preview.html` con un reloj al lado.

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

### F31 · La tienda solo vende tier 0; los siguientes, por fusión o cajas

> Reestructuramos el sistema para que de la tienda solo se puedan comprar los tier 0 y mediante fusión o cajas se puedan comprar los siguientes tiers.

**DECIDIDO: la tienda solo vende cajas tier 0, las básicas, "aún no empiezan los tiers
ahí".** Y funciona por una razón que no era la que yo temía: **la puerta es la caja, no
la llave**. Si la tienda vende la llave T9 pero no la caja T9, esa llave **no sirve para
nada** hasta que una caja T9 salga de una T8. El jugador puede tener las diez llaves y
seguir necesitando la caja. **Traducido: las llaves pueden venderse todas, y las cajas
solo las básicas.**

**Lo que sí hay que quitar es lo más grande de la decisión:** las **veinte cartas de
tier** (de 900 a 193.850). La tienda pasa de 20 cartas a 2. Es el mayor recorte de
contenido del lote, y es correcto: mientras la carta T8 esté a la venta, las cajas no son
necesarias.

**La variante que lo simplifica todo: una caja por tier.** Diez cajas en vez de cuatro,
cada una con su llave, y **una sola pieza resuelve cuatro peticiones**:

| Petición | Cómo la resuelve una caja por tier |
|---|---|
| **F26** cristal del mismo tier | La caja T8 suelta **cristal T8**. Hoy es un muro; aquí sale de la caja correcta por construcción. |
| **F27** expansores por tipo | La caja T8 suelta el **Expansor T8**. Ya pediste que algunos fuesen solo de cajas. |
| **F31** subir de tier | La caja T8 suelta la **llave y la caja T9**. Es la cadena. |
| **D4** el patrón | Dejas de tener el problema: cada caja tiene su fila y cada fila suelta lo que debe. |

**Y el efecto de columna vertebral es lo que lo justifica:** la tienda vende la caja T1 y
la llave T1, y de ahí en adelante **se sube encadenando**. Un camino único y legible, y
cada caja es a la vez un premio y una llave.

**Lo que sale bien, medido:** con 2 materiales por forja, un T10 por forja sale 2,4× la
carta y un T25 cuesta 15 billones. **El final lo pone la aritmética, no un tope**, que es
lo que hace que la forja infinita funcione.

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

### F33 · La forja es el camino a los items perfectos

> Si los items de tier 1 que mezclo están al máximo, su mezcla va a ser un tier 2 al máximo. [...] Una cosa es el nivel del objeto y otro "qué tan bien salieron los stats" [...]. Si los dos están al máximo, el tier nuevo está al máximo, pero el nivel es 0 y se pierde la subida por cristales. Y la forja debe pedir **dos** items del mismo tier, no tres.

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

### F36 · Los tres números que quedaban

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

### P4 · Verificar en partida real

**Pendiente de tu lado** (es el nº3 de lo que espera tu respuesta). El banco comprueba que
los números encajen entre sí, no que la partida dure lo que tiene que durar. Para eso hace
falta jugarla: otra partida nueva y decir hasta dónde llegas y en cuánto tiempo.

---

## Hecho

_Lo terminado, una línea y el commit. La cifra viva del proyecto: **24 bancos, 1552
pruebas**, todas en verde._

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
- [x] **Forja infinita, corte 1 · fórmulas 11+ y sin techo** (`d5daee3`). `rangoDePoder()`,
      `rarezaDeTier()` y `valorBaseTier()`; T10→T11 y T11→T12 comprobados.
      `stateCheck` 225 → 232. **Sin curva de probabilidad: esa sigue esperando tu sí.**

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

- [x] **`AGENTS.md` decía "22 bancos = 1399 pruebas".** Corregido a **24 bancos y 1549**,
      que es lo que da `npm run verify` hoy. También afirmaba que `v1.1.0` estaba
      "publicado en GitHub Pages", y **eso es falso**: Pages no está activado en el repo,
      `/pages` da 404 y la URL del juego da 404. Corregido: el tag existe, el juego vive en
      el repo, y **no se quiere publicar en Pages**.
- [ ] **`.github/workflows/publicar.yml` se puede borrar.** Como no hay Pages y no se
      quiere, este workflow solo consigue que **todos los pushes salgan en rojo** en
      `configure-pages`. Los pasos que dependen del código (`tsc` y el que falla la
      publicación si existe `dist/admin.html`) están los dos en verde; lo único que falla es
      la activación manual, que no se va a hacer. Borrarlo quita el ruido sin tocar el juego.
      _Pendiente de que lo confirmes: implica borrar un fichero del repo._