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
export const CONSUMABLES = {
  clickBuff: { name: 'Buff Clicks x2', details: 'Otorga x2 al click por 30 minutos', rarity: 'Raro', buffId: 'clickBoost' },
  passiveBuff: { name: 'Buff Pasivo x2', details: 'Otorga x2 al ingreso pasivo por 60 minutos', rarity: 'Épico', buffId: 'passiveBoost' },
  backpackExpander: { name: 'Expansor de Almacén', details: 'Aumenta el almacén +1 slot (máx 20)', rarity: 'Raro', buffId: 'warehouseExpander' },
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
//  `details` dice qué trae y qué llave abre. Antes decía "contiene
//  recompensas básicas", que no dice nada: el jugador no tenía forma de saber si
//  le convenía ni de qué llave necesitaba.
export const CRATE_TYPES = {
  common: {
    name: 'Caja Común',
    rarity: 'Común',
    // POR QUÉ AQUÍ NO DICE "Abre con una Llave de Cifrado". Lo decía, escrito a
    // mano, y era una quinta copia de la regla de qué llave abre qué (B6): los
    // cuatro textos de las llaves mentían, y este también. La llave que hace
    // falta se enseña en la tarjeta del cofre, y sale de `KEY_DEFS` +
    // `CRATE_KEY_TIER` —una sola vez—, así que aquí solo va lo que es botín.
    details: 'Recompensas de partida temprana: nanitas, cristales, algún dron T1.'
  },
  rare: {
    name: 'Caja Rara',
    rarity: 'Raro',
    details: 'Material de forja y compañeros T3, con algún recolector T4 sobrecargado.'
  },
  epic: {
    name: 'Caja Épica',
    rarity: 'Épico',
    details: 'Compañeros T6 y recolectores T6, con piedras de calibración.'
  },
  legendary: {
    name: 'Caja Legendaria',
    rarity: 'Legendario',
    details: 'Recolectores T8 y compañeros Divinos que no se compran. Sale la Nanopartícula de Estabilidad.'
  }
} as const;

export type CrateType = keyof typeof CRATE_TYPES;

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
export const KEY_COSTS = [250, 900, 3_000, 11_000] as const;

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

export const STORE_ITEMS = {
  keyT0: { cost: KEY_COSTS[0], label: 'Llave de Cifrado' },
  keyT1: { cost: KEY_COSTS[1], label: 'Llave Reforzada' },
  keyT2: { cost: KEY_COSTS[2], label: 'Llave Rúnica' },
  keyT3: { cost: KEY_COSTS[3], label: 'Llave del Vacío' },
  upgradeCrystal: { cost: 200, label: 'Cristal de Mejora' },
  warehouseSlot: { cost: 6000, label: 'Ampliar Almacén (+5 slots)' },
  commonCrate: { cost: 500, label: 'Caja Común' },
  rareCrate: { cost: 1500, label: 'Caja Rara' },
  epicCrate: { cost: 5500, label: 'Caja Épica' },
  legendaryCrate: { cost: 21000, label: 'Caja Legendaria' },
  clickBuff: { cost: 800, durationMs: 30 * 60 * 1000, label: 'Buff Clics x2' },
  passiveBuff: { cost: 1500, durationMs: 60 * 60 * 1000, label: 'Buff Pasivo x2' },
  // Nuevos items
  backpackExpander: { cost: 1400, label: 'Expansor de Almacén (+1 slot)' },
  // Las tres cartas de ranura salen de `defDeRanura()`, que es donde está el
  // número de ranuras que da cada una. La tarjeta no pone "+N" escrito: lo dice
  // la tabla, que es la misma que lee el motor (R3).
  companionSlot1: defDeRanura(1),
  companionSlot2: defDeRanura(2),
  companionSlot3: defDeRanura(3),
  afkCard: { cost: 10000, label: 'Tarjeta AFK Básica (10 min, acumulable x3)' },
  clickX2Card: { cost: 5000, durationMs: 30000, label: 'Tarjeta Click x2 (30s)' },
  clickX3Card: { cost: 15000, durationMs: 30000, label: 'Tarjeta Click x3 (30s)' },
  // Consumibles de crafteo. Caros a propósito: la forja debe seguir siendo
  // una decisión, no algo que se compre en masa y se gaste sin pensar.
  calibrationStone: { cost: 45000, label: 'Piedra de Calibración (+12% de éxito)' },
  stabilityNano: { cost: 90000, label: 'Nanopartícula de Estabilidad (+8% y un afijo extra)' },
  companionCardT1: { cost: 900, label: 'Compañero Tier 1' },
  companionCardT2: { cost: 1700, label: 'Compañero Tier 2' },
  companionCardT3: { cost: 3000, label: 'Compañero Tier 3' },
  companionCardT4: { cost: 5500, label: 'Compañero Tier 4' },
  companionCardT5: { cost: 9900, label: 'Compañero Tier 5' },
  companionCardT6: { cost: 18000, label: 'Compañero Tier 6' },
  companionCardT7: { cost: 32550, label: 'Compañero Tier 7' },
  companionCardT8: { cost: 59050, label: 'Compañero Tier 8' },
  companionCardT9: { cost: 106950, label: 'Compañero Tier 9' },
  companionCardT10: { cost: 193850, label: 'Compañero Tier 10' },
  // Recolectores: la MISMA tabla que los compañeros.
  //
  // Comparten precio a propósito, y no por pereza: `generateCollectorByTier()` y
  // `generateCompanionByTier()` sacan el poder del mismo `TIER_SYSTEM.ranges`, así
  // que un T10 de uno y un T10 del otro dan exactamente el mismo poder. Que
  // costaran distinto haría que el jugador pagara un sobreprecio invisible por un
  // número que no existe.
  //
  // El precio sigue al DAÑO y sube con el tier. Antes escalaba 1.5x por tier
  // mientras el poder iba 1.62x, con lo que el coste por punto bajaba y el T10
  // acababa siendo 3x peor que el T1: una trampa invisible detrás de un número
  // grande. Con la tabla de arriba el sobreprecio es al revés y a propósito.
  collectorCardT1: { cost: 900, label: 'Recolector Tier 1' },
  collectorCardT2: { cost: 1700, label: 'Recolector Tier 2' },
  collectorCardT3: { cost: 3000, label: 'Recolector Tier 3' },
  collectorCardT4: { cost: 5500, label: 'Recolector Tier 4' },
  collectorCardT5: { cost: 9900, label: 'Recolector Tier 5' },
  collectorCardT6: { cost: 18000, label: 'Recolector Tier 6' },
  collectorCardT7: { cost: 32550, label: 'Recolector Tier 7' },
  collectorCardT8: { cost: 59050, label: 'Recolector Tier 8' },
  collectorCardT9: { cost: 106950, label: 'Recolector Tier 9' },
  collectorCardT10: { cost: 193850, label: 'Recolector Tier 10' }
};
