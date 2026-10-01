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
  companionSlot1: { cost: 1200, label: 'Slot de Compañero 2' },
  companionSlot2: { cost: 16000, label: 'Ranura de Escuadrón (+3 slots)' },
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

// ==========================================================================
//  Ranuras de compañero
// ==========================================================================
//  Coste de cada slot adicional (índice = slots ya poseídos). 5 slots es el
//  techo de la tienda: es lo que hace que los slots valgan más que los tiers.
//  Se llega hasta 9: 5 de tienda + hasta 4 del nodo "Cuadrilla".
export const COMPANION_SLOT_COSTS = [0, 1200, 4500, 16000, 55000, 180_000, 520_000, 1_400_000, 3_600_000, 9_000_000];