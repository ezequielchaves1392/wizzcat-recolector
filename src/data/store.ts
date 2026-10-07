// ==========================================================================
//  La tienda: precios, tipos de caja y ranuras de compañero
// ==========================================================================
//  POR QUÉ ESTO NO VIVE EN `gameLoop.ts`.
//
//  Son tablas y nada más: no tocan `state`, no tocan Firebase, no dependen de
//  nada. Y estaban en un fichero de 3.352 líneas, lo que obligaba a cuatro
//  ficheros a importarlos de allí para leer un número: `store.ts`,
//  `valuation.ts`, `crystalPicker.ts` e `items.ts`. Un fichero de datos que
//  depende del motor es justo lo que R29 prohíbe — y era también la causa de que
//  `data/items.ts` tuviera que hacer `import type { CrateType } from
//  '../gameLoop'`, un `data/` que dependía de donde vive el estado.
//
//  La mudanza es LITERAL: las mismas tablas, los mismos números. Lo único que
//  cambia es dónde viven, y eso `balanceCheck` lo verifica a posteriori: si una
//  cifra se hubiera movido de sitio por accidente, el banco lo canta.
//
//  LO QUE SIGUE SIN ESTAR AQUÍ, a propósito: las funciones que aplican un
//  buff, las que consumen un item y las que cobran. Esas necesitan el estado, así
//  que son del motor. Lo de aquí es lo que se puede decidir sin mirar la partida.
// ==========================================================================

import { PIEDRA_PUNTOS } from './constants';

// ==========================================================================
//  Consumibles
// ==========================================================================
//  `buffId` es el identificador estable que usa el almacén para aplicar el
//  efecto: cambiar un nombre no puede romper el buff. Por eso el buff se busca
//  por `buffId` y nunca por el texto.
// F4 · `clickBuff` y `passiveBuff` ESTÁN FUERA, Y NO ES UNA BORRADURA.
//
// Los dos eran consumibles que se compraban, se gastaban y dejaban un buff de 30
// o 60 minutos. Las tres tarjetas (`afkCard`, `clickX2Card`, `clickX3Card`) siguen
// ahí, y son las que se acumulan y las que se pueden cancelar desde el HUD.
//
// **LO QUE HAY QUE TENER CUIDADO NO ES BORRARLOS DEL TEXTO.** Un buff pasivo de 30
// minutos que se compra con nanitas rompe la regla de R10 por la puerta de atrás: el
// juego promise ingreso sin que el jugador esté mirando y luego lo cobra.
// `recalculatePassiveIncome` multiplicaba por 2 mientras el buff estuviera vivo,
// o sea que el AFK automático de B9 podía deixar de cortar el ingreso con una
// tarjeta comprada hace diez minutos. Las tarjetas de 30 segundos casi no lo
// notarían, y esa es exactamente la diferencia entre las dos cosas.
//
// Y el resto del buff se queda: los `state.buffs.clickBoostExpiresAt` y
// `passiveBoostExpiresAt` **no se tocan**, porque vienen en el guardado de partidas
// viejas. Un jugador que los tenga activos sigue cobrando hasta que expiren, y es
// la opción que no le quita nada a nadie.
//
// O sea: se retiran de la tienda y no se pueden comprar, pero no se toca el estado.
// Es lo mismo que se hizo con las ampliaciones de huecos del almacén.
export const CONSUMABLES_SIN_EXPANSOR = {
  afkCard: { name: 'Tarjeta AFK', details: 'Permite juego sin la ventana activa 10 min (acumulable x3)', rarity: 'Raro', buffId: 'afk' },
  clickX2Card: { name: 'Tarjeta Click x2', details: 'Otorga x2 al click por 30 segundos', rarity: 'Raro', buffId: 'clickX2' },
  clickX3Card: { name: 'Tarjeta Click x3', details: 'Otorga x3 al click por 30 segundos', rarity: 'Épico', buffId: 'clickX3' },
  calibrationStone: { name: 'Piedra de Calibración', details: `Sube ${PIEDRA_PUNTOS} puntos la probabilidad de la próxima fusión`, rarity: 'Raro', buffId: 'calibrationStone' },
  stabilityNano: { name: 'Nanopartícula de Estabilidad', details: 'En un recolector, un afijo extra garantizado; en un compañero, +1 de potencial', rarity: 'Legendario', buffId: 'stabilityNano' }
} as const;

// ==========================================================================
//  Tipos de caja
// ==========================================================================
//  Definición de cada tipo de caja. La fuente de verdad es el item del almacén,
//  `state.crates` se mantiene sincronizado como contador para las migraciones.
//
//  F31 · UNA CAJA POR TIER. Antes había cuatro cajas —común, rara, épica y
//  legendaria— y ninguna se corresponded con un tier: la legendaria soltaba
//  recolectores T8 y no había caja que diera un T9. El jugador tenía que
//  comprarlos en la tienda, así que la caja alta era un adorno: se abría por
//  gusto, no para progresar.
//
//  Ahora hay una caja por tier y el `CrateType` ES el tier. Eso no es una
//  comodidad de código: es lo que hace que la regla "la caja N suelta el cristal
//  N, el expansor N y la caja N+1" se pueda escribir **una vez** y valga para las
//  diez. Con cuatro tablas escritas a mano, esas reglas eran cuatro copias que
//  se separaron en el primer rebalanceo — que es literalmente B6—.
//
//  Y el nombre lo dice: `Caja T7` no promete una rareza que puede no ser la del
//  botín, y `inferCrateType()` pasa a ser leer un número del texto en vez de
//  adivinar por palabra suelta. Antes caía en "legendaria" con cualquier
//  nombre que no reconociera, así que un item mal escrito se abría como el
//  mejor cofre del juego.
/**
 * LA LEYENDA DE UNA CAJA, UNA Y LA MISMA PARA LAS DIEZ.
 *
 * **ANTES ENUMERABA LO QUE ABRÍA, Y ESO ES UNA COPIA DEL BOTÍN QUE SE QUEMA.**
 * Cada caja tenía su texto escrito a mano —"Nanitas, cristal T7, un recolector T7
 * y la llave de la T8"— y era la misma clase de problema que B6 en las llaves:
 * una lista escrita al lado de la tabla que genera esa lista. Cuando la tabla
 * cambió, los textos no. Con diez cajas había diez textos que se habían quedado
 * mintiendo: la T4 decía "material de T4" (que no existe: los cristales se
 * llaman por su nombre), la T6 decía "piedras de calibración" sin decir cuántas, y
 * ninguna mencionaba el expansor, el salto ni el cosmético.
 *
 * **LO QUE DICE AHORA ES LA REGLA, Y ES LO ÚNICO QUE EL JUGADOR NECESITA ANTES
 * DE ABRIR:** qué llave la abre. El contenido se ve cuando sale, que es cuando
 * importa, y está en la misma pantalla que el resto del lote.
 *
 * Y es la misma frase en las diez, lo cual es la prueba de que no puede quedar
 * vieja: si algún día una caja necesita un texto propio, es que ha dejado de
 * seguir la regla de "una caja por tier".
 */

/**
 * LA FRASE QUE DICEN LAS DIEZ CAJAS, Y POR QUÉ ESTA ES LA NUEVA.
 *
 * **LA VIEJA ERA "Se abre con la llave de su tier o de un tier superior", Y ERA
 * MENTIRA DESDE HACE UN RATO.** No porque la regla fuera falsa —la llave de
 * nivel alto sí abría las cajas de abajo, y eso era verdad— sino porque ya no hay
 * llave que abra nada. El texto era correcto y el juego ya no, y esa es la forma
 * peor de que un texto se quede viejo: **nadie lo revisa porque sigue leyéndose
 * bien.**
 *
 * La de ahora es "Se abre sola", que es lo que hace y lo que el jugador tiene que
 * hacer. Es más corta que la vieja, y no por brevedad: es que ya no tiene nada que
 * decir. Cuando un texto se queda sin contenido, se le quita el contenido; no se
 * le cambian cuatro palabras para que parezca nuevo.
 *
 * **Y ESTO LO HA ENCONTRADO UN BANCO, NO UN REPASO.** El banco nuevo mira el
 * botín construido de las diez cajas y pregunta si alguno habla de una llave.
 * Un repaso lee el código buscando llaves, y esta frase ya no tiene la palabra
 * "llave" en ninguna forma que la búsqueda entendería: se lee bien y no dice nada
 * raro. Un banco pregunta por lo que el juego **hace**, y por eso lo pilla.
 */
const DETALLES_DE_CAJA = 'Se abre sola.';
export const CRATE_TYPES: Record<CrateType, { name: string; rarity: string; details: string }> = {
  1: { name: 'Caja T1', rarity: 'Común',     details: DETALLES_DE_CAJA },
  2: { name: 'Caja T2', rarity: 'Común',     details: DETALLES_DE_CAJA },
  3: { name: 'Caja T3', rarity: 'Raro',      details: DETALLES_DE_CAJA },
  4: { name: 'Caja T4', rarity: 'Raro',      details: DETALLES_DE_CAJA },
  5: { name: 'Caja T5', rarity: 'Épico',     details: DETALLES_DE_CAJA },
  6: { name: 'Caja T6', rarity: 'Épico',     details: DETALLES_DE_CAJA },
  7: { name: 'Caja T7', rarity: 'Legendario', details: DETALLES_DE_CAJA },
  8: { name: 'Caja T8', rarity: 'Legendario', details: DETALLES_DE_CAJA },
  9: { name: 'Caja T9', rarity: 'Mítico',    details: DETALLES_DE_CAJA },
  10: { name: 'Caja T10', rarity: 'Divino',  details: DETALLES_DE_CAJA }
};

/**
 * Los diez niveles de caja, de menor a mayor.
 *
 * Lo leen el Component, el almacén y el costeo, y sale de aquí para que no
 * puedan discrepar sobre cuántas cajas hay. El tipo es el número, que es la
 * decisión de F31: hace que "el tier de la caja" no sea un dato aparte del
 * "nivel", y por eso no hay forma de que los dos se contradigan.
 */
export const CRATE_TIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** El nivel más alto de caja que existe. */
export const MAX_CRATE_TIER = 10;

/**
 * El tipo de caja ES su nivel.
 *
 * Antes era `'common' | 'rare' | 'epic' | 'legendary'`, y el nivel del botín
 * viajaba aparte en `TIER_PROPIO` (`crateLoot.ts`): una quinta copia de una
 * regla que se puede deducir del propio tipo. Numerándolo, la regla del botín
 * se escribe una vez y no puede quedar anticuada.
 */
export type CrateType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// ==========================================================================
//  Precios
// ==========================================================================
//  Los costes base de los tres recolectores iniciales, que no son cartas: se
//  compran por su nombre y su poder viene fijo.
export const COLLECTOR_BASE_COSTS = {
  blaster: 20,
  plasmaCannon: 150,
  quantumDisruptor: 1200
};

/**
 * F31 · LO QUE CUESTA UN TIER, Y LO USA TODO EL MUNDO.
 *
 * Antes esta curva estaba escrita tres veces: en `companionCardT1..T10`, en
 * `collectorCardT1..T10` y en el precio de las cuatro cajas. Tres copias que
 * además no coincidían —la caja común costaba 500 y el compañero T1 900, sin
 * que nadie supiera cuál era el número bueno—.
 *
 * Ahora hay UNA tabla, y sale de ella:
 *
 *    · la carta de compañero T{n} y la de recolector T{n};
 *    · el valor de la caja T{n} (`CRATE_COSTS`), que es lo que vale de reventa
 *      y lo que paga la compensación si la caja no da nada countable;
 *    · el precio de la llave T{n} (`KEY_COSTS`), que es la mitad, y por qué
 *      está en `items.ts` con su comentario entero.
 *
 * Que las cajas valgan lo que un objeto de su tier es lo que hace que la ruleta
 * pueda enseñar el coste de la caja sin que sea un número inventado: el
 * jugador ya sabe cuánto cuesta un T7 porque lo ha visto en la tienda.
 */
export const COSTE_POR_TIER: readonly number[] = [
  900, 1_700, 3_000, 5_500, 9_900, 18_000, 32_550, 59_050, 106_950, 193_850
];

/** El precio de la caja de un tier. Índice 0 = T1. */
export function costeDeCaja(tier: number): number {
  return CRATE_COSTS[Math.min(CRATE_COSTS.length, Math.max(1, Math.floor(tier))) - 1];
}

// ==========================================================================
//  LA CURVA DE LAS CARTAS, que es donde vive el balance entero.
//
//  Escala 1.62x por tier, IGUAL que el poder, y el coste por punto SUBE un 12%
//  en cada salto. Esa es toda la regla, y son las dos mitades de lo mismo:
//
//    · Escalar IGUAL que el poder mantiene el coste por punto plano, así que
//      subir de tier nunca es una optimización.
//    · El 12% por tier es el SOBREPRECIO DELIBERADO: el T10 cuesta 416 por
//      punto y el T1 150. Subir de tier da un número más grande y peor valor, y
//      esa es la promesa del juego: el T10 es un objeto de escaparate.
//
//  POR QUÉ EL 12% Y NO UN NÚMERO PLANO. Con coste por punto constante el tiempo
//  para cada tier también es constante, y el juego se terminaba en un rato:
//  medido sobre una partida real, los diez tiers se compraban en 20 minutos. Con
//  el sobreprecio el último tier cuesta 193 850 y el acumulado llega a 431 400,
//  así que la partida se estira sola hacia el final sin tocar el ingreso.
//
//  Y las dos curvas —compañero y recolector— usan la MISMA tabla porque el poder
//  sale de `TIER_SYSTEM.ranges` en los dos: mismo poder, mismo precio.
//  LOS PRECIOS DE LAS LLAVES, y son de aquí y no de `items.ts` porque este es el
//  fichero de los precios: `KEY_DEFS` los lee, y las cuatro cartas de la tienda
//  los usan. Con el precio en dos sitios fue como la tienda acabó vendiendo una
//  carta llamada "Llave de Cifrado" que entregaba la Reforzada (B7).
//
//  Cada llave cuesta algo menos que la caja que abre (250 / 1.500 / 5.500 /
//  21.000), y por dos motivos. Primero, si la llave costara MÁS que la caja, la
//  caja sería la mitad barata del par y comprarla sin llave sería tirar el
//  dinero: una forma muy clara de confuso en una tienda. Segundo, como cada caja
//  suelta llaves de su nivel, comprar llave y caja sale siempre más caro que
//  abrir cajas. La tienda nunca es el camino bueno, que es lo que hace que abrir
//  un cofre siga siendo una decisión y no una tarea.
//  Y las cuatro son comprables porque la cadena de llaves era una escalera
//  imposible (B6) y la tienda tiene que poder ser la red de seguridad de un
//  jugador al que le faltan llaves.
//
//  F31 · AHORA HAY DIEZ Y LOS DOS PRECIOS SALEN DE LA CURVA DE TIERS.
//
//  La caja vale **la mitad** de un objeto de su tier y la llave **la mitad de
//  la caja**, y las dos mitades son el número que importa. Si la llave costara
//  más que la caja, comprar caja y llave sería tirar el dinero; si costara lo
//  mismo, da igual. Con la mitad, comprar llave y caja sale siempre más caro que
//  abrir cajas, así que la tienda nunca es el camino bueno — que es lo que hace
//  que abrir un cofre siga siendo una decisión y no una tarea.
//
//  **LA CAJA T1 BAJA DE 500 A 450.** No es un redondeo: la caja común valía 500
//  y su llave 250, y el par salía en 750. Con la curva son 450 y 225, o sea
//  675. F31 quita veinte cartas de la tienda, y subirle el precio a quien está
//  en el primer minuto sería cobrarle el recorte.
//
//  **Y LAS DIEZ LLAVES SE VENDEN, QUE ES LA DECISIÓN.** F31 quita las cajas
//  altas de la tienda pero deja todas las llaves a la venta, y suena a
//  contradicción: si compro la llave T9 y no tengo la caja T9, ¿qué hago? La
//  respuesta es que no pierdo nada, porque la llave no es la puerta: **la puerta
//  es la caja.** La T9 sale de abrir la T8, y la T8 sale de abrir la T7. Comprar
//  la llave T9 es tenerla guardada para cuando llegue, que es lo que hace un
//  jugador con una caja comprada. La alternativa —llaves altas solo de caja— es
//  la que deja la tienda inservible para un jugador al que le faltan llaves, que
//  es lo que B6 señalaba.
/**
 * EL PRECIO DE LA CAJA, Y POR QUÉ ES `3/4` Y NO `1/2`.
 *
 * **EL MOTIVO POR EL QUE SE PUEDE BORRAR LAS LLAVES SIN MOVER UN NANITO.**
 *
 * Antes el jugador pagaba dos cosas por abrir una caja: la caja, que costaba
 * `COSTE/2`, y la llave, que costaba la mitad de la caja, o sea `COSTE/4`. En total,
 * `3/4` del valor del objeto de su tier.
 *
 * Ahora la caja se abre sola. **Si su precio se quedaba en `COSTE/2`, las cajas
 * habría salido un 33 % más baratas** y todo el economy se desplazaba con ellas: el
 * premio de nanitas, el techo de reventa de lo que sale de un cofre y el
 * inventario que ocupa cada caja.
 *
 * Así que **la caja pasa a costar lo que costaba el par entero**: `3/4`. Con eso:
 *
 * · el jugador paga **lo mismo** por abrir una caja,
 * · `topeDeVenta()` —que era `costeDeCaja + costeDeLlave`— **vale lo mismo**, porque
 *   pasa a ser solo `costeDeCaja` y los dos números coinciden,
 * · el premio de nanitas de cada caja, que es un porcentaje de ese tope, **no se
 *   mueve**,
 * · y el techo de reventa de un recolector o un compañero que sale de un cofre
 *   **tampoco**.
 *
 * O sea: **eliminar las llaves es neutro**. No es un regalo ni un castigo, es
 * quitar un paso. La única cifra que sí cambia es la compensación de "no te ha
 * salido nada countable", que es un múltiplo del precio de la caja y sube con ella
 * —y tiene que subir, porque es la caja la que ahora cuesta más.
 *
 * El tres cuartos está escrito como fracción y no como un número porque
 * `COSTE_POR_TIER` es la única lista que hay que tocar al rebalancear: el
 * multiplicador va con ella.
 */
export const CRATE_COSTS: readonly number[] = COSTE_POR_TIER.map(c => Math.round(c * 3 / 4));

// ==========================================================================
//  Expansores de almacén: cuatro tramos, cada uno con su techo
// ==========================================================================
//
//  EL MODELO: **cuatro expansores, y cada uno tiene un TECHO de capacidad.**
//  Un expansor solo sirve mientras el almacén esté por debajo de su techo;
//  cuando ya lo has alcanzado, **no se puede usar** y hay que buscar el
//  siguiente, que llega más lejos.
//
//      Expansor Inicial     →  hasta 60 ranuras   (tienda, y cajas T1-T2)
//      Expansor Intermedio  →  hasta 120          (cajas T3-T6)
//      Expansor Avanzado    →  hasta 180          (cajas T7-T9)
//      Expansor Supremo     →  hasta 240          (caja T10)
//
//  POR QUÉ UNO SOLO AL PRINCIPIO. Antes eran diez —uno por tier, de diez en
//  diez— y cada uno daba +1: el T1 llevaba a 25, el T2 a 35 y así. Con +1 por
//  uso, esperar al último salía igual que ir uno por uno pero sin pagar los
//  anteriores, así que los tres primeros eran una trampa: convenía saltárselos
//  y los otros se volvían irrelevantes. Un solo Inicial hasta 60 quita la
//  decisión falsa, y el siguiente ya no se compra: sale de las cajas T3 en
//  adelante, que es lo que hace que subir de caja siga siendo la decisión buena.
//
//  **EL PASO SIGUE SIENDO +1.** El Inicial son 45 usos, el resto 60 cada uno.
//  Dar el tramo entero de una vez haría que el primer tramo quedara por detrás
//  de un botón barato, que es justo lo que se evitó al poner el +1.
//
//  SOLO TOPE POR ARRIBA Y NO BANDAS CERRADAS, COMO ANTES. Un Intermedio en un
//  almacén de 20 tiene que servir: si solo valiera a partir de 60, sería botín
//  muerto para quien no llega. Lo que no puede es un Inicial barato donde toca
//  un Avanzado: por eso cada uno tiene su techo y no su suelo.
//
//  EL TECHO FRENA EL CRECIMIENTO, NO RECORTA LO QUE HAY. Esto es lo importante
//  para las partidas viejas: un jugador con 300 de capacidad no pierde nada, sus
//  expansores simplemente no sirven. **Bajar `WAREHOUSE_MAX_CAP` a 240 y
//  `enforceWarehouseCapacity()` empezaría a BORRARLE items del almacén**, que es
//  justo lo que la regla "la migración no quita nada" prohíbe. Por eso
//  `WAREHOUSE_MAX_CAP` sigue siendo 600: es el suelo de seguridad para el stock
//  viejo, no el techo de la escalera nueva.
//
//  LO VIEJO SIGUE SIRVIENDO. Los diez `expansorT{n}` de antes de F66 siguen
//  dando +1 hasta su techo de siempre (`EXPANSOR_LEGACY`), y el
//  `warehouseExpander` (+1) hasta 600. Son stock finito de antes de los tramos,
//  no tipos encubiertos.
// ==========================================================================

/**
 * Tope duro de capacidad base del almacén. Los slots del árbol suman encima.
 *
 * **NO ES EL TECHO DE LA ESCALERA DE EXPANSORES**, que son 240. Este es 600 a
 * propósito, para que las partidas que ya pasaron de 240 no pierdan items: el
 * borrow del almacén solo recorta si la capacidad baja, y bajarla sería cambiar
 * el progreso de un jugador que hizo todo lo que el juego le dejó hacer.
 */
export const WAREHOUSE_MAX_CAP = 600;

/** Capacidad de partida, de la que sale la escalera de expansores. */
export const WAREHOUSE_BASE_CAP = 15;

/**
 * Cuántas ranuras añade cada expansor: **una**.
 *
 * ## POR QUÉ UNO Y NO UNO POR TRAMO
 *
 * Las dos mitades de la regla son **cuánto da** y **hasta dónde sirve**, y son
 * independientes. Si el expansor diera el tramo entero, el Inicial llevaría el
 * almacén de 15 a 60 de una vez y las primeras cajas del juego quedarían por
 * detrás de un botón barato: comprar el expansor sería mejor que abrir cajas.
 *
 * Con +1 el expansor es **un poco cada vez**: la tienda da el primer tramo, el
 * botín de las cajas da el resto, y subir de caja sigue siendo la decisión
 * buena. Y el lote lo hace cómodo: `planUseConsumable()` dice cuántas caben
 * hasta el techo, así que los 45 usos del primer tramo son un diálogo y no 45
 * viajes al almacén.
 */
export const RANURAS_POR_EXPANSOR = 1;

/** El techo del tramo n de la escalera nueva: 60, 120, 180 y 240. */
const TECHOS_DE_TRAMO = [60, 120, 180, 240] as const;

/**
 * El techo del expansor del tramo n.
 *
 * Sale de la tabla y no de una fórmula, porque los tramos no son regulares:
 * el primero son 45 ranuras y el resto 60. Una fórmula los igualaría y el
 * Inicial dejaría de llegar a 60.
 */
export function techoDeExpansor(tramo: number): number {
  const e = EXPANSOR_TIERS.find((t) => t.tier === Math.floor(tramo));
  return e ? e.maxCap : TECHOS_DE_TRAMO[TECHOS_DE_TRAMO.length - 1];
}

export interface ExpansorTier {
  tier: number;
  /** Ranuras que da al usarse. */
  slots: number;
  /** Precio en tienda, o `null` si solo sale de cajas. */
  cost: number | null;
  /** Reventa unitaria: un cuarto del precio (R18), o directa si no se vende. */
  resale: number;
  /** Capacidad base hasta la que sirve. */
  maxCap: number;
  /** El `buffId` del consumible que lo aplica. */
  buffId: string;
  name: string;
  /** Rareza que se enseña en la carta y en el botín. Sale de la caja que lo suelta. */
  rareza: string;
}

/**
 * LOS CUATRO EXPANSORES, ESCRITOS.
 *
 * Diez salían generados de `techoDeExpansor()` y de `COSTE_POR_TIER`, porque con
 * diez tiers una tabla escrita a mano son treinta números que se descuadran.
 * Con cuatro tramos irregulares (45 + 60 + 60 + 60) la generación ya no ahorra
 * nada: una fórmula los igualaría y el Inicial dejaría de llegar a 60. Cuatro
 * filas escritas se leen de un vistazo y no se pueden "olvidar de añadir" al
 * añadir un tier de caja, porque ya no hay un expansor por tier.
 *
 * EL PRECIO del Inicial sale de la curva de tiers por un cuarto, que es la
 * misma regla que la reventa de todo lo demás (R18): es el precio del T2
 * (425), más barato que una caja, porque es la red de seguridad del arranque.
 * La reventa de los tres de caja sale del tier de la primera caja que los
 * suelta (T3, T7 y T10), por la misma regla.
 */
export const EXPANSOR_TIERS: ExpansorTier[] = [
  { tier: 1, slots: RANURAS_POR_EXPANSOR, cost: Math.floor(COSTE_POR_TIER[1] / 4), resale: Math.floor(COSTE_POR_TIER[1] / 16), maxCap: 60, buffId: 'expansorInicial', name: 'Expansor Inicial', rareza: 'Común' },
  { tier: 2, slots: RANURAS_POR_EXPANSOR, cost: null, resale: Math.floor(COSTE_POR_TIER[2] / 16), maxCap: 120, buffId: 'expansorIntermedio', name: 'Expansor Intermedio', rareza: 'Raro' },
  { tier: 3, slots: RANURAS_POR_EXPANSOR, cost: null, resale: Math.floor(COSTE_POR_TIER[6] / 16), maxCap: 180, buffId: 'expansorAvanzado', name: 'Expansor Avanzado', rareza: 'Legendario' },
  { tier: 4, slots: RANURAS_POR_EXPANSOR, cost: null, resale: Math.floor(COSTE_POR_TIER[9] / 16), maxCap: 240, buffId: 'expansorSupremo', name: 'Expansor Supremo', rareza: 'Divino' },
];

/**
 * QUÉ EXPANSOR SUELTA CADA CAJA, EN UNA FUNCIÓN.
 *
 * Antes era "la caja T{n} suelta el expansor T{n}", que con diez expansores se
 * escribía solo. Con cuatro tramos, el reparto se escribe aquí y en ningún otro
 * sitio: ni en el botín ni en la tienda. Si mañana el Intermedio pasa a salir
 * en la T2, se cambia esta función y las diez cajas lo heredan.
 */
export function expansorDeCaja(tier: number): ExpansorTier {
  if (tier >= 10) return EXPANSOR_TIERS[3];
  if (tier >= 7) return EXPANSOR_TIERS[2];
  if (tier >= 3) return EXPANSOR_TIERS[1];
  return EXPANSOR_TIERS[0];
}

/**
 * LOS DIEZ ANTERIORES, SOLO PARA LAS PARTIDAS VIEJAS.
 *
 * Un almacén guardado antes de F66 tiene `expansorT1`..`expansorT10` con sus
 * techos de 25 a 115. Borrarlos de la tabla los dejaría sin efecto conocido y
 * `useConsumable` los rechazaría: el jugador perdería items que pagó. Así que
 * siguen resolviendo, con su techo de siempre, pero **ya no se venden ni salen
 * de cajas**: no están en `STORE_ITEMS` ni los suelta `expansorDeCaja()`.
 */
const TECHOS_VIEJOS: Record<string, number> = {
  expansorT1: 25, expansorT2: 35, expansorT3: 45, expansorT4: 55, expansorT5: 65,
  expansorT6: 75, expansorT7: 85, expansorT8: 95, expansorT9: 105, expansorT10: 115,
};

/**
 * LO QUE DICE UN EXPANSOR, EN UNA FRASE, PARA LOS CUATRO SITIOS QUE LO DICEN.
 *
 * La tarjeta de la tienda, la ficha, el item del almacén y el premio de la caja
 * escribían la misma frase con cuatro plantillas distintas, y las cuatro tenían el número
 * de ranuras pegado: "+**n** ranuras", "+n ranuras." y "+n". Con `slots = 1` eso da además
 * "+1 ranuras", que es la clase de error que no rompe nada y se lee en todas partes a la
 * vez. Aquí el texto sale de la tabla, que es la única que tiene los números, y el
 * singular se decide aquí.
 */
export function textoDeExpansor(e: ExpansorTier): string {
  return `Amplía el almacén +${e.slots} ${e.slots === 1 ? 'ranura' : 'ranuras'}. Vale hasta ${e.maxCap} de capacidad.`;
}

/**
 * LOS EXPANSORES, COMO CONSUMIBLES. SALEN DE LA MISMA TABLA.
 *
 * **ESTAS ENTRADAS ESTABAN ESCRITAS A MANO Y MENTÍAN.** Decían "+2 slots,
 * vale hasta 120" y "+5 slots, vale hasta 300" mientras la tabla decía otra
 * cosa, y cuando los tres números cambiaron a la vez no había nada que impidiera
 * que se quedaran atrás: es la misma trampa que B6 y que la leyenda de las cajas,
 * y por eso aquí no hay ningún número escrito.
 *
 * La rareza sale del tramo, que es lo que el expansor representa: el
 * Intermedio es un item de caja T3. Y el texto **enseña el
 * techo**, que es la mitad de la regla y lo que el jugador necesita para decidir
 * si le sirve: "vale hasta 60" contesta a "¿me sirve?" sin que tenga que abrir la
 * ficha del almacén.
 */
export const EXPANSOR_CONSUMABLES = Object.fromEntries(
  EXPANSOR_TIERS.map(e => [e.buffId, {
    name: e.name,
    details: textoDeExpansor(e),
    rarity: e.rareza,
    buffId: e.buffId
  }])
) as Record<string, { name: string; details: string; rarity: string; buffId: string }>;

/**
 * Todos los consumibles, con los expansores dentro.
 *
 * Se declara aquí y no arriba porque `EXPANSOR_TIERS` vive más abajo en el
 * fichero: un `const` que leyese una tabla declarada después daría error de
 * zona muerta temporal, que es un fallo que solo aparece al importar el módulo
 * y no al compilarlo.
 */
export const CONSUMABLES = {
  ...CONSUMABLES_SIN_EXPANSOR,
  ...EXPANSOR_CONSUMABLES
} as const;

/** El tipo de expansor de un `buffId`, o `undefined` si no es un expansor. */
export function expansorPorBuff(buffId: string): ExpansorTier | undefined {
  const nuevo = EXPANSOR_TIERS.find(t => t.buffId === buffId);
  if (nuevo) return nuevo;
  // Stock de antes de F66: resuelve con su techo de siempre, para que una
  // partida vieja no pierda lo que pagó. No se vende ni sale de cajas.
  const techo = TECHOS_VIEJOS[buffId];
  if (techo === undefined) return undefined;
  const n = Number(buffId.replace('expansorT', ''));
  return {
    tier: n, slots: RANURAS_POR_EXPANSOR, cost: null,
    resale: Math.floor(COSTE_POR_TIER[Math.min(COSTE_POR_TIER.length, Math.max(1, n)) - 1] / 16),
    maxCap: techo, buffId, name: `Expansor T${n}`,
    rareza: CRATE_TYPES[Math.min(MAX_CRATE_TIER, Math.max(1, n)) as CrateType]?.rarity ?? 'Raro'
  };
}

// ==========================================================================
//  Barra de acceso rápido: qué consumibles pueden occupants las ranuras
// ==========================================================================
//
//  **LO QUE VA EN LA BARRA LO DECIDE EL JUGADOR, Y LO QUE PUEDE ENTRAR ESTA
//  LISTA.** Son dos cosas distintas y por eso viven en dos sitios: la lista es
//  la regla del juego, y lo que el jugador pone en cada ranura es su guardado.
//
//  **Y POR QUÉ SOLO TRES, Y NO TODOS LOS CONSUMIBLES.** Al principio la barra
//  rellenaba sola con lo más caro que hubiera, y el primer resultado fue ver una
//  Piedra de Calibración en una ranura: es un consumible de **Forja**, y desde la
//  base no hace nada. Peor: se podía gastar desde ahí algo cuyo único sitio es
//  la Forja. La lista no es una lista de "los que se pueden usar", es la lista de
//  los que **se pueden usar desde aquí**, y los tres expansores tampoco entran
//  porque gastar una ranura del almacén sin querer es el peor sitio posible para
//  ese botón.
//
//  Ahora la ranura la elige el jugador, así que el filtro deja de ser un problema
//  de lo que se muestra y pasa a ser una pregunta de qué se puede asignar. Por eso
//  esta lista es la **puerta**: un consumible que no esté aquí no puede llegar a
//  una ranura ni aunque alguien lo escriba en el guardado.
//
//  Y sale de `CONSUMABLES` el nombre y la descripción, para que el texto del
//  selector no se escriba dos veces (R2).
export const RANURAS_BARRA = 3;

/** Los `buffId` que se pueden asignar a una ranura de la barra, y solo ellos. */
export const CONSUMIBLES_ASIGNABLES = ['afk', 'clickX2', 'clickX3'] as const;

export type BuffAsignable = (typeof CONSUMIBLES_ASIGNABLES)[number];

/**
 * La ficha de un consumible asignable, por `buffId`.
 *
 * Devuelve `null` para cualquier cosa que no esté en la lista, y eso es
 * deliberado: la función es la puerta, así que quien la use para pintar no tiene
 * que comprobar la lista aparte.
 */
export function consumibleAsignable(buffId: string | null | undefined):
  { buffId: string; name: string; details: string } | null {
  if (!buffId) return null;
  if (!(CONSUMIBLES_ASIGNABLES as readonly string[]).includes(buffId)) return null;
  for (const def of Object.values(CONSUMABLES) as any[]) {
    if (def.buffId === buffId) {
      return { buffId, name: def.name, details: def.details };
    }
  }
  return null;
}

// ==========================================================================
//  Ranuras de compañero (F7 y F11)
// ==========================================================================
//
//  EL MODELO ENTERO CAMBIA, Y POR QUÉ NO ERA EL DE DOS CARTAS.
//
//  Había dos cartas fijas (`companionSlot1` y `companionSlot2`) y el motor
//  escribía un número en cada una: `= 2` y `= 5`. Es decir, **dos valores
//  escritos a mano en el motor y el precio en un tercero**, y de ahí salía todo lo
//  que F7 señalaba:
//
//    · el +3 de golpe de la segunda compra, que es un salto de 2 a 5 sin nada en
//      medio, y hace que el precio por ranura se multiplique por 5,3 entre una
//      compra y la siguiente;
//    · la tarjeta decía "Abre hasta 3 ranuras" y el motor daba 5 (R3);
//    · `COMPANION_SLOT_COSTS` tenía diez huecos y solo se usaban dos: una tabla
//      escrita para un modelo que no llegó a existir.
//
//  Ahora las tres cartas salen de UNA tabla: cada compra da un número de ranuras y
//  ese número es el que dice la tarjeta. El tope es 6 (F7 lo sube de 3 a 6), y las
//  tres compras lo llegan: 1 → 2 → 4 → 6. Ni +3 de golpe ni un +2 al final que no
//  compensa.
//
//  LA TABLA DE PRECIOS. El coste se lee de `COMPANION_SLOT_COSTS` por el índice que
//  corresponda a la carta, así que añadir una compra es añadir una fila y ya. Los
//  precios crecen ×3,8 y luego ×3,4: el ritmo de la curva de cartas de tier, que es
//  lo que hace que a partir del cuarto compañero una ranura se siente más cara que
//  un compañero entero. Ese es el objetivo de la tabla: que el escuadrón grande sea
//  una decisión de final de partida, no una compra de mitad.
//
//  Y con el árbol de pasivas el total puede pasar de 6 (`bonus.companionSlots`), así
//  que el tope de la tienda no es el tope del juego. Igual que con el almacén.
//
//  ESTAS DEFINICIONES VAN ANTES DE `STORE_ITEMS` A PROPÓSITO. `STORE_ITEMS` llama a
//  `defDeRanura()` al construirse, y `defDeRanura` lee `COMPANION_SLOT_BUY` y
//  `COMPANION_SLOT_COSTS`. Si estas tablas estuvieran debajo, el módulo leería dos
//  `const` antes de inicializarse y tiraría un `ReferenceError` al importar — el
//  fallo más estúpido posible y el más difícil de ver, porque el error no señala
//  nada de ranuras de compañero: señala el final del fichero.
export const COMPANION_SLOT_COSTS = [0, 1200, 4500, 16000, 55000, 180_000, 520_000, 1_400_000, 3_600_000, 9_000_000];

/** Tope de ranuras que da la tienda, sin contar el árbol de pasivas. */
export const COMPANION_SLOTS_TIENDA = 6;

/**
 * Las tres compras de ranura, y CADA UNA CON EL NÚMERO QUE DA.
 *
 * `da` es lo que el motor escribe en `maxCompanionSlots`. Es lo único que decide
 * cuántas ranuras hay, y la tarjeta lo lee de aquí, así que no puede ser un "+3" en
 * un texto y un `= 5` en el motor: es un número en un sitio.
 *
 * Los saltos son +1, +2 y +2. El +2 del medio sube el total a 4 en vez de a 5, que
 * es lo que hace que la tercera compra quede cerca de la segunda en vez de dejar un
 * +3 y un +1 detrás.
 */
export const COMPANION_SLOT_BUY: { da: number; etiqueta: string }[] = [
  { da: 2, etiqueta: 'Slot de Compañero 2' },
  { da: 4, etiqueta: 'Ranura de Escuadrón (ranuras 3 y 4)' },
  { da: 6, etiqueta: 'Ranura de Escuadrón (ranuras 5 y 6)' }
];

/** La carta de tienda `companionSlotN` (N = 1, 2, 3), con su precio y su etiqueta. */
export function defDeRanura(n: number): { cost: number; label: string } {
  const compra = COMPANION_SLOT_BUY[n - 1];
  return {
    cost: COMPANION_SLOT_COSTS[n] ?? 0,
    label: compra?.etiqueta ?? 'Ranura de escuadrón'
  };
}

/**
 * Qué carta de la tienda es cuál compra de ranura.
 *
 * Se construye de `COMPANION_SLOT_BUY` para que las dos mitades no puedan
 * separarse: si alguien añade una cuarta compra a la tabla, la carta aparece sola
 * y con su número. Es lo mismo que hace `STORE_KEY_TIER` con las llaves (B7), y el
 * motivo por el que aquí se repite: los dos sitios eran el bug.
 */
export const RANURA_POR_CARTA: Record<string, { da: number; etiqueta: string }> =
  Object.fromEntries(COMPANION_SLOT_BUY.map((c, i) => [`companionSlot${i + 1}`, c]));

/**
 * F31 · LA TIENDA SOLO VENDE LA CAJA BÁSICA.
 *
 * Antes vendía cuatro cajas y veinte cartas de tier. Lo que se quita son las
 * veinte cartas —`companionCardT*` y `collectorCardT*`— y las tres cajas
 * altas, y el motivo es el mismo en los dos casos: **mientras el T8 esté a la
 * venta, las cajas no son necesarias.** Se podía abrir una legendaria entera y
 * seguir necesitando la tienda para el tier siguiente, así que la caja alta era
 * un adorno y no una puerta.
 *
 * Lo que queda es **lo que de verdad es el arranque: la caja T1**. Las nueve
 * siguientes salen de abrir la anterior, y ya no hay una llave que compre por
 * delante. Antes la caja T1 venía acompañada de su llave y había que pagar las
 * dos por abrirla; ahora es una sola compra.
 *
 * Los precios salen todos de `COSTE_POR_TIER` y de `defDeRanura()`, y ninguna
 * carta escribe su número: si el precio cambia en un sitio, cambia en los tres
 * (R3).
 */
export const STORE_ITEMS = {
  // **"PACK DE CRISTAL", Y POR QUÉ.** La carta cuesta 200 y entrega `valorDeUnCristal(1)`
  // = 675 cristales de golpe. Llamarla "Cristal de Mejora" hacía que el jugador creyera
  // que compraba UN cristal por 200; el nombre tiene que decir que es un lote, y su
  // cantidad va en la nota de la tarjeta ("Pack de 675 cristales").
  upgradeCrystal: { cost: 200, label: 'Pack de Cristal de Mejora' },
  crateT1: { cost: CRATE_COSTS[0], label: CRATE_TYPES[1].name },
  // F4 · Aquí estaban `clickBuff` (800, 30 min) y `passiveBuff` (1.500, 60 min).
  // Se han retirado de la tienda; ver el comentario en `CONSUMABLES` para el porqué
  // de que el efecto siga en el motor y solo desaparezca la compra.
  // Los expansores que se venden, generados desde `EXPANSOR_TIERS`. Antes eran
  // dos líneas con el precio, el "+N" y el nombre escritos a mano, y el precio
  // no era el de la tabla: la tabla decía 3000 y 18000 y la carta decía 3000 y
  // 18000 por casualidad, no por construcción.
  //
  // **LA TARJETA ENSEÑA EL TECHO, NO SOLO EL "+5".** "Vale hasta 20" es lo que
  // contesta a "¿me sirve?", y sin eso el jugador tiene que abrir el almacén,
  // buscar el expansor y leer su ficha para averiguar que ya no le sirve.
  ...Object.fromEntries(
    EXPANSOR_TIERS
      .filter(e => e.cost !== null)
      .map(e => [e.buffId, {
      cost: e.cost as number,
      // **"+1 ranura" Y NO "+1 ranuras".** El singular va aquí porque el número sale de la
      // tabla y la tabla es la única fuente: ponerlo en la plantilla obligaría a que cada
      // cambio de `slots` la revisara, y es el cambio que se hizo hoy.
      label: `${e.name} (+${e.slots} ${e.slots === 1 ? 'ranura' : 'ranuras'}, hasta ${e.maxCap})`
    }])
  ) as Record<string, { cost: number; label: string }>,
  // Las tres cartas de ranura salen de `defDeRanura()`, que es donde está el
  // número de ranuras que da cada una. La tarjeta no pone "+N" escrito: lo dice
  // la tabla, que es la misma que lee el motor (R3).
  companionSlot1: defDeRanura(1),
  companionSlot2: defDeRanura(2),
  companionSlot3: defDeRanura(3),
  // F4 · Solo tarjetas. `clickBuff` y `passiveBuff` estaban aquí y se han ido; el
  // motivo de por qué están mal y las tarjetas están bien está en `CONSUMABLES`.
  afkCard: { cost: 10000, label: 'Tarjeta AFK Básica (10 min, acumulable x3)' },
  clickX2Card: { cost: 5000, durationMs: 30000, label: 'Tarjeta Click x2 (30s)' },
  // **LA TARJETA DE x3 NO SE VENDE, Y ESTO ES DECISIÓN DEL DUEÑO, NO UN OLVIDO.**
  //
  // Antes estaba aquí con su precio, al lado de la de x2. Se ha sacado del catálogo a
  // propósito: la de x3 vale tres veces más que la de x2 y dura lo mismo —medio minuto—, así
  // que comprarla es siempre la mala compra y la tienda estaba vendiendo un error con un
  // botón. Sigue saliendo de cajas, con poca probabilidad, y `useConsumable` la acepta igual
  // si llega al almacén por ahí.
  //
  // **NO ES "COMPRAR Y GUARDAR PARA DESPUÉS".** Una tarjeta es un consumible que se usa
  // entendiendo el estado que hay en ese momento; comprar una para dentro de tres horas es
  // comprar algo cuyo valor no sabes.
  // Consumibles de crafteo. Caros a propósito: la forja debe seguir siendo
  // una decisión, no algo que se compre en masa y se gaste sin pensar.
  calibrationStone: { cost: 45000, label: `Piedra de Calibración (+${PIEDRA_PUNTOS}% de éxito)` },
  stabilityNano: { cost: 90000, label: 'Nanopartícula de Estabilidad (+8% y afijo o potencial extra)' }
};

/**
 * F31 · LAS CARTAS DE TIER SE GENERAN, NO SE ESCRIBEN.
 *
 * Existían veinte literales —diez de compañero y diez de recolector— con el
 * precio repetido veinte veces, y eran veinte oportunidades de que dos no
 * coincidieran. Ahora se derivan de `COSTE_POR_TIER` y de `TONE_CARD`, que es
 * donde está la diferencia real entre comprar por puntos y comprar por daño.
 *
 * El precio es el del tier Y NO UN POCO MÁS, a propósito. La curva de la tienda
 * es un sobreprecio deliberado: el coste por punto sube ~12% por tier, así que
 * subir de tier da un número más grande y peor valor, y el T10 es un objeto de
 * escaparate en vez de una mejora. Como ya no hay cartas de tier, ese sobreprecio
 * vive ahora en la caja: la caja T{n} cuesta la mitad de un T{n} y da un T{n},
 * así que el mismo criterio sigue aplicando, solo que por el camino largo.
 */
export const TIER_CARD_KIND: Record<`${'companion' | 'collector'}CardT${number}`, string> = {
  companionCardT1: 'Compañero Tier 1', collectorCardT1: 'Recolector Tier 1',
  companionCardT2: 'Compañero Tier 2', collectorCardT2: 'Recolector Tier 2',
  companionCardT3: 'Compañero Tier 3', collectorCardT3: 'Recolector Tier 3',
  companionCardT4: 'Compañero Tier 4', collectorCardT4: 'Recolector Tier 4',
  companionCardT5: 'Compañero Tier 5', collectorCardT5: 'Recolector Tier 5',
  companionCardT6: 'Compañero Tier 6', collectorCardT6: 'Recolector Tier 6',
  companionCardT7: 'Compañero Tier 7', collectorCardT7: 'Recolector Tier 7',
  companionCardT8: 'Compañero Tier 8', collectorCardT8: 'Recolector Tier 8',
  companionCardT9: 'Compañero Tier 9', collectorCardT9: 'Recolector Tier 9',
  companionCardT10: 'Compañero Tier 10', collectorCardT10: 'Recolector Tier 10'
};

export type TierCardKey = keyof typeof TIER_CARD_KIND;

/**
 * La carta de tier que se le puede comprar al jugador, con su precio.
 *
 * F31 · SIGUEN EXISTIENDO COMO DATOS PERO **NO SE VENDEN**: la tienda ya no las
 * ofrece y `buyStoreItem()` las rechaza con un aviso que dice por qué. Se
 * conservan por dos razones, y las dos son de datos y no de interfaz: la curva
 * de tiers hay que poder medirla (`playthroughCheck`, `balanceCheck`) aunque no
 * se venda, y `STORE_KEY_TIER`-style los bancos comparan precios entre sí. El
 * precio y la etiqueta salen de `COSTE_POR_TIER`, o sea de la misma tabla que
 * antes, así que un rebalance los mueve a los veinte a la vez.
 */
export const TIER_CARDS: Record<TierCardKey, { cost: number; label: string }> =
  Object.fromEntries(
    (Object.keys(TIER_CARD_KIND) as TierCardKey[]).map(k => {
      const tier = parseInt(k.replace(/\D+/g, ''), 10);
      return [k, { cost: COSTE_POR_TIER[tier - 1], label: TIER_CARD_KIND[k] }];
    })
  ) as Record<TierCardKey, { cost: number; label: string }>;

/** La carta de tier de una carta de tienda, o `undefined` si no es de tier. */
export function tierCardDe(itemKey: string): TierCardKey | undefined {
  return (TIER_CARDS as Record<string, unknown>)[itemKey]
    ? (itemKey as TierCardKey)
    : undefined;
}
