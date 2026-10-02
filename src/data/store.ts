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
export const CONSUMABLES = {
  expansorT1: { name: 'Expansor T1', details: 'Aumenta el almacén +2 slots. Vale hasta 120 de capacidad.', rarity: 'Raro', buffId: 'expansorT1' },
  expansorT2: { name: 'Expansor T2', details: 'Aumenta el almacén +5 slots. Vale hasta 300 de capacidad.', rarity: 'Épico', buffId: 'expansorT2' },
  afkCard: { name: 'Tarjeta AFK', details: 'Permite juego sin la ventana activa 10 min (acumulable x3)', rarity: 'Raro', buffId: 'afk' },
  clickX2Card: { name: 'Tarjeta Click x2', details: 'Otorga x2 al click por 30 segundos', rarity: 'Raro', buffId: 'clickX2' },
  clickX3Card: { name: 'Tarjeta Click x3', details: 'Otorga x3 al click por 30 segundos', rarity: 'Épico', buffId: 'clickX3' },
  calibrationStone: { name: 'Piedra de Calibración', details: 'Sube 12 puntos la probabilidad de la próxima fusión', rarity: 'Raro', buffId: 'calibrationStone' },
  stabilityNano: { name: 'Nanopartícula de Estabilidad', details: 'Deja el recolector forjado con un afijo extra garantizado', rarity: 'Legendario', buffId: 'stabilityNano' }
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
export const CRATE_TYPES: Record<CrateType, { name: string; rarity: string; details: string }> = {
  1: { name: 'Caja T1', rarity: 'Común',     details: 'Nanitas, cristal T1, un compañero T1 y su llave.' },
  2: { name: 'Caja T2', rarity: 'Común',     details: 'Nanitas, cristal T2, un compañero T2 y su llave.' },
  3: { name: 'Caja T3', rarity: 'Raro',      details: 'Nanitas, cristal T3, un compañero T3, un recolector T3 y su llave.' },
  4: { name: 'Caja T4', rarity: 'Raro',      details: 'Nanitas, cristal T4, material de T4, un recolector T4 y su llave.' },
  5: { name: 'Caja T5', rarity: 'Épico',     details: 'Nanitas, cristal T5, material de T5, un recolector T5 y su llave.' },
  6: { name: 'Caja T6', rarity: 'Épico',     details: 'Nanitas, cristal T6, piedras de calibración y un recolector T6.' },
  7: { name: 'Caja T7', rarity: 'Legendario', details: 'Nanitas, cristal T7, un recolector T7 y la llave de la T8.' },
  8: { name: 'Caja T8', rarity: 'Legendario', details: 'Nanitas, cristal T8, la Nanopartícula de Estabilidad y la llave de la T9.' },
  9: { name: 'Caja T9', rarity: 'Mítico',    details: 'Nanitas, cristal T9, un recolector T9 y la llave de la T10.' },
  10: { name: 'Caja T10', rarity: 'Divino',  details: 'Nanitas, cristal T10 y lo mejor de la caja: compañero y recolector T10.' }
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
export const CRATE_COSTS: readonly number[] = COSTE_POR_TIER.map(c => Math.round(c / 2));

export const KEY_COSTS: readonly number[] = CRATE_COSTS.map(c => Math.round(c / 2));

/**
 * F31 · LOS NOMBRES DE LAS DIEZ LLAVES, Y POR QUÉ ESTÁN AQUÍ Y NO EN `items.ts`.
 *
 * `KEY_DEFS` —que vive en `items.ts`— es quien tiene el nombre de cada llave, y
 * `STORE_ITEMS` —que vive aquí— es quien pinta la carta. Antes no había problema:
 * la carta escribía el nombre a mano, cuatro veces, y un banco comprueba que
 * nombre y nombre coincidan. Con diez llaves, escribir diez nombres en dos sitios
 * es escribir veinte.
 *
 * **NO SE PUEDE ARREGLAR IMPORTANDO `KEY_DEFS` AQUÍ**, porque `items.ts` importa
 * este fichero: sería un ciclo. Así que el nombre **se queda en la capa de
 * abajo** y `items.ts` lo lee. Un solo sitio, ninguna flecha nueva y el banco
 * sigue pudiendo comprobar que la carta y el item dicen lo mismo (B7).
 */
export const KEY_NAMES: readonly { name: string; namePlural: string; rarity: string }[] = [
  { name: 'Llave de Cifrado', namePlural: 'Llaves de Cifrado', rarity: 'Común' },
  { name: 'Llave Reforzada', namePlural: 'Llaves Reforzadas', rarity: 'Común' },
  { name: 'Llave Rúnica', namePlural: 'Llaves Rúnicas', rarity: 'Raro' },
  { name: 'Llave de Fase', namePlural: 'Llaves de Fase', rarity: 'Raro' },
  { name: 'Llave Espectral', namePlural: 'Llaves Espectrales', rarity: 'Épico' },
  { name: 'Llave Cuántica', namePlural: 'Llaves Cuánticas', rarity: 'Épico' },
  { name: 'Llave Prismática', namePlural: 'Llaves Prismáticas', rarity: 'Legendario' },
  { name: 'Llave del Vacío', namePlural: 'Llaves del Vacío', rarity: 'Legendario' },
  { name: 'Llave de la Singularidad', namePlural: 'Llaves de la Singularidad', rarity: 'Mítico' },
  { name: 'Llave Primordial', namePlural: 'Llaves Primordiales', rarity: 'Divino' }
];

/** El precio de la llave de una caja. Índice 0 = T1. */
export function costeDeLlave(tier: number): number {
  return KEY_COSTS[Math.min(KEY_COSTS.length, Math.max(1, Math.floor(tier))) - 1];
}

// ==========================================================================
//  Expansores de almacén por tipo (F27)
// ==========================================================================
//
//  EL MODELO: tres tipos con más ranuras y más precio, y cada uno vale hasta
//  una capacidad. Al crecer hay que subir de tipo: el T1 deja de servir a los
//  120 y el T2 a los 300. El T3 no se vende —solo sale de cajas altas— y es
//  el que llega al tope.
//
//  POR QUÉ SOLO TOPE POR ARRIBA Y NO BANDAS CERRADAS. Un T3 en un almacén
//  pequeño tiene que servir: si solo valiera a partir de 300, sería botín
//  muerto para quien no llega. Lo que no puede es un T1 barato donde toca un
//  T2: por eso cada tipo tiene su techo y no su suelo.
//
//  EL TOPE SALE DE AQUÍ Y NO DE LA VISTA. Antes el "Al máximo" era un 50
//  escrito en `store.ts` y otro 50 en `useConsumable`, dos números a mano
//  para la misma regla. Ahora es `WAREHOUSE_MAX_CAP` y lo leen los dos.
//
//  LA MIGRACIÓN NO QUITA NADA. Quien ya pasó el tope (500+ con la carta vieja
//  sin tope) conserva cada ranura: el tope frena lo nuevo, no recorta lo
//  comprado. Y por eso el tope es alto (600) y la presión viene del precio y
//  de las cajas, no de un muro.
//
//  LO VIEJO SIGUE SIRVIENDO. Los `warehouseExpander` (+1) que ya hay en
//  almacenes y botines se usan con el tope nuevo: son stock finito de antes de
//  los tipos, no un cuarto tipo encubierto.
// ==========================================================================

/** Tope de capacidad base del almacén. Los slots del árbol suman encima. */
export const WAREHOUSE_MAX_CAP = 600;

export interface ExpansorTier {
  tier: 1 | 2 | 3;
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
}

export const EXPANSOR_TIERS: ExpansorTier[] = [
  { tier: 1, slots: 2, cost: 3000, resale: 750, maxCap: 120, buffId: 'expansorT1', name: 'Expansor T1' },
  { tier: 2, slots: 5, cost: 18000, resale: 4500, maxCap: 300, buffId: 'expansorT2', name: 'Expansor T2' },
  { tier: 3, slots: 10, cost: null, resale: 9000, maxCap: WAREHOUSE_MAX_CAP, buffId: 'expansorT3', name: 'Expansor T3' }
];

/** El tipo de expansor de un `buffId`, o `undefined` si no es un expansor. */
export function expansorPorBuff(buffId: string): ExpansorTier | undefined {
  return EXPANSOR_TIERS.find(t => t.buffId === buffId);
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
 * Lo que queda es lo que de verdad es el arranque: la caja T1 y las diez llaves.
 * Las llaves siguen todas a la venta y hay que leer bien por qué — está en el
 * comentario de `KEY_COSTS`, y es que la llave no es la puerta, la puerta es la
 * caja. Comprar la llave T9 es tenerla guardada para cuando la T9 llegue, que
 * llega por la T8.
 *
 * Los precios salen todos de `COSTE_POR_TIER` y de `defDeRanura()`, y ninguna
 * carta escribe su número: si el precio cambia en un sitio, cambia en los tres
 * (R3).
 */
export const STORE_ITEMS = {
  ...Object.fromEntries(
    KEY_NAMES.map((k, i) => [`keyT${i + 1}`, { cost: KEY_COSTS[i], label: k.name }])
  ) as Record<`keyT${number}`, { cost: number; label: string }>,
  upgradeCrystal: { cost: 200, label: 'Cristal de Mejora' },
  crateT1: { cost: CRATE_COSTS[0], label: CRATE_TYPES[1].name },
  // F4 · Aquí estaban `clickBuff` (800, 30 min) y `passiveBuff` (1.500, 60 min).
  // Se han retirado de la tienda; ver el comentario en `CONSUMABLES` para el porqué
  // de que el efecto siga en el motor y solo desaparezca la compra.
  // Nuevos items: expansores por tipo (F27). El T3 no tiene carta: solo de cajas.
  expansorT1: { cost: 3000, label: 'Expansor T1 (+2 slots)' },
  expansorT2: { cost: 18000, label: 'Expansor T2 (+5 slots)' },
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
  clickX3Card: { cost: 15000, durationMs: 30000, label: 'Tarjeta Click x3 (30s)' },
  // Consumibles de crafteo. Caros a propósito: la forja debe seguir siendo
  // una decisión, no algo que se compre en masa y se gaste sin pensar.
  calibrationStone: { cost: 45000, label: 'Piedra de Calibración (+12% de éxito)' },
  stabilityNano: { cost: 90000, label: 'Nanopartícula de Estabilidad (+8% y un afijo extra)' }
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
