import { showToast } from './utils/toast';
import { formatNumber } from './utils/format';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { anotarPendiente, hayPendientes, leerCola, vaciarCola } from './services/naniteQueue';
import { rollCrateReward } from './components/crateLoot';
import { evaluateAchievements, createAchievementState, ACHIEVEMENTS, type Achievement } from './achievements';
import type { AchievementId } from './data/achievements';
import { SECRET_ACHIEVEMENTS } from './data/achievements';
// Los tiers viven en data/ porque los usan también el crafteo, el mercado y la
// valoración. Se re-exportan aquí para no romper los imports existentes.
export { TIER_SYSTEM, TIER_POWER } from './data/tiers';
import { TIER_SYSTEM, TIER_POWER } from './data/tiers';
import { aggregateBonuses, canBuyNode, pendingCores, nextCores } from './data/prestige';
import { TREE_BY_ID, nodeCost } from './data/tree';
import { attemptForge, AFFIX_BY_ID, collectorMaxLevel } from './data/crafting';
import { sellPrice, collectorValue } from './data/valuation';
import { countOccupiedSlots, isStackable, mergeStacks, stackUnits } from './data/stacking';
import {
  KEY_DEFS, KEY_TIER_ORDER, CRYSTAL_DEFS, CRATE_KEY_TIER,
  crystalSuccessChance, crystalPowerFromName, keyTierFromName, keyOpens,
  type KeyTier, type KeyDef, type CrystalDef
} from './data/items';


// Antes esto era un modal con botón "Aceptar" para avisos como "Almacén lleno":
// bloqueaba la partida por un mensaje informativo. Ahora es un toast no bloqueante.

// La 7 es la del renombre `weapon` -> `collector`. La 6 no avisó de nada: el
// código pasó a esperar 'collector' y las partidas que ya existían se quedaron
// con 'weapon' guardado, que no es un tipo que reconozca nadie. Por eso esta
// versión no sube por el formato del documento sino por un cambio de NOMBRES
// dentro de él, y por eso las migraciones de abajo se aplican solo al cruzarla.
//
// Una partida sin `saveVersion` (o con 0) se trata como anterior a la 7: es lo
// que quiere decir no haber pasado nunca por este código.
const SAVE_VERSION = 7;

/**
 * Tope de seguridad de celdas de hueco guardadas.
 *
 * No es el limite real -ese es el tablero, y lo calcula la vista-, sino un
 * cortafuegos contra un documento manipulado que traiga un numero disparatado y
 * empuje todos los items fuera de la rejilla. Muy por encima de cualquier
 * almacen real: un tablero de 200 celdas es un almacen de 200 items.
 */
const TOPE_CELDAS_HUECO = 200;

/**
 * Normaliza una fecha guardada a milisegundos.
 *
 * El juego escribe `updatedAt` como `new Date()`, que Firestore convierte en un
 * `Timestamp`; pero `rankingService` escribe el suyo como `Date.now()`, un
 * número pelado, y en una partida larga hay documentos escritos por los dos
 * caminos. La cola de nanitas compara su marca con este campo para decidir cuál
 * de los dos es más nuevo, así que un `toDate()` a medias reventaría con el
 * segundo.
 */
function aMilis(valor: any): number {
  if (valor == null) return 0;
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') {
    const t = Date.parse(valor);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (typeof valor.seconds === 'number') return valor.seconds * 1000;
  return 0;
}

/**
 * Tipos de item que se renombraron, del nombre viejo al nuevo.
 *
 * `weapon` pasó a llamarse `collector` cuando las armas se convirtieron en
 * recolectores. El nombre viaja en el guardado, no en el código, así que el
 * cambio no alcanzó a las partidas que ya estaban escritas.
 *
 * No se puede arreglar en la vista, porque el objeto no está mal: es el mismo
 * Blaster Láser con la etiqueta vieja. Y el tipo es la clave de todo lo
 * demás —la pestaña del filtro, el botón de equipar, la forja, el precio de
 * venta, la protección de "no vendas el último"—, así que un item con el tipo
 * viejo desaparece de "Recolectores", no se puede equipar y el detalle acaba
 * pintando la etiqueta cruda: "weapon".
 *
 * Se traduce una vez al cargar y se guarda el resultado.
 */
const LEGACY_ITEM_TYPES: Record<string, string> = {
  weapon: 'collector'
};

/** Traduce los tipos renombrados de un almacén. Devuelve si ha tocado algo. */
function migrateItemTypes(warehouse: any[]): boolean {
  let changed = false;
  for (const item of warehouse) {
    const moderno = LEGACY_ITEM_TYPES[item.type];
    if (!moderno) continue;
    item.type = moderno;
    changed = true;
  }
  return changed;
}

/**
 * Deja `equippedCollectorId` y la bandera `equipped` de los items diciendo lo
 * mismo.
 *
 * Son la misma información en dos sitios, y una partida vieja no siempre tiene
 * los dos: con la bandera puesta y el id vacío, la rejilla marcaba el item como
 * equipado y el juego no leía su daño, así que el click se quedaba a cero sin
 * decir nada. Al revés, el detalle ofrecía "Desequipar" sobre un item que nadie
 * tenía puesto.
 *
 * El id manda porque es lo que lee el cálculo de daño, y la bandera se recalcula
 * a partir de él. Un id que ya no apunta a ningún recolector se descarta en vez
 * de dejar el estado apuntando al vacío.
 */
function reconcileEquippedCollector(
  warehouse: any[],
  equippedId: string | null,
  adoptarBandera = true
): { id: string | null; changed: boolean } {
  let id = equippedId;
  if (id && !warehouse.some((w: any) => w.id === id && w.type === 'collector')) id = null;
  // Sin id, la bandera puesta es lo único que dice qué llevaba equipado. Solo
  // se adopta si hay un único candidato: con dos, no hay forma de saber cuál.
  //
  // Esto es un RESCATE de guardado viejo y por eso es opcional: quien
  // desequipa está diciendo que no lleva ninguno, así que no puede querer que
  // su propio clic le vuelva a poner la bandera como equipado. Sin el
  // interruptor, Desequipar no hacía nada y la bandera no bajaba nunca.
  if (!id && adoptarBandera) {
    const marcados = warehouse.filter((w: any) => w.type === 'collector' && w.equipped);
    if (marcados.length === 1) id = marcados[0].id;
  }

  let changed = id !== equippedId;
  for (const w of warehouse) {
    const debeSer = w.type === 'collector' && w.id === id;
    if (!!w.equipped === debeSer) continue;
    w.equipped = debeSer;
    changed = true;
  }
  return { id, changed };
}

export const AFK_CARD_DURATION_MS = 10 * 60 * 1000; // Cada tarjeta AFK da 10 min
export const MAX_AFK_BUFF_DURATION_MS = 30 * 60 * 1000; // Máximo acumulable (3 tarjetas)

// Buffs que se pueden cancelar desde la interfaz. El buff AFK vive fuera de
// `state.buffs`, por eso tiene su propio campo.
export const BUFF_FIELDS = {
  clickBoost: 'clickBoostExpiresAt',
  clickX2: 'clickX2ExpiresAt',
  clickX3: 'clickX3ExpiresAt',
  passiveBoost: 'passiveBoostExpiresAt'
} as const;

export type BuffKey = keyof typeof BUFF_FIELDS | 'afk';

export const COLLECTOR_BASE_COSTS = {
  blaster: 20,
  plasmaCannon: 150,
  quantumDisruptor: 1200
};

export const STORE_ITEMS = {
  key: { cost: 250, label: 'Llave de Cifrado' },
  upgradeCrystal: { cost: 60, label: 'Cristal de Mejora' },
  warehouseSlot: { cost: 6000, label: 'Ampliar Almacén (+5 slots)' },
  commonCrate: { cost: 500, label: 'Caja Común' },
  rareCrate: { cost: 1500, label: 'Caja Rara' },
  epicCrate: { cost: 5500, label: 'Caja Épica' },
  legendaryCrate: { cost: 21000, label: 'Caja Legendaria' },
  clickBuff: { cost: 800, durationMs: 30 * 60 * 1000, label: 'Buff Clicks x2 (30m)' },
  passiveBuff: { cost: 1500, durationMs: 60 * 60 * 1000, label: 'Buff Pasivo x2 (1h)' },
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
  // Escala 1.5x por tier. El poder por tier crece algo más rápido (1.62x) para
  // que el coste por punto de poder no se dispare: en T10 sale ~1.3x mejor que
  // en T1, no 32x peor como antes.
  companionCardT1: { cost: 900, label: 'Compañero Tier 1' },
  companionCardT2: { cost: 1600, label: 'Compañero Tier 2' },
  companionCardT3: { cost: 2700, label: 'Compañero Tier 3' },
  companionCardT4: { cost: 4500, label: 'Compañero Tier 4' },
  companionCardT5: { cost: 7400, label: 'Compañero Tier 5' },
  companionCardT6: { cost: 12000, label: 'Compañero Tier 6' },
  companionCardT7: { cost: 19500, label: 'Compañero Tier 7' },
  companionCardT8: { cost: 31000, label: 'Compañero Tier 8' },
  companionCardT9: { cost: 49000, label: 'Compañero Tier 9' },
  companionCardT10: { cost: 77000, label: 'Compañero Tier 10' },
  // Recolectores: el precio sigue al DAÑO, no al número de tier.
  //
  // Antes escalaba 1.5x por tier igual que los compañeros, y ahí estaba
  // el error: el daño va de 5 a 77 entre T1 y T10 (15.4x) mientras el
  // precio iba 39x. El coste por punto de daño pasaba de 166 (T1) a 506
  // (T10): comprar un T10 era 3x peor que comprar un T1, así que el
  // jugador se compraba siempre T1. Los tiers altos eran una trampa
  // invisible, porque el número grande siempre parecía mejor.
  //
  // Ahora el coste por punto de daño se mantiene entre 170 y 235 en todo
  // el rango: 1.38x de dispersión. Subir de tier sigue siendo algo peor
  // que comprar muchos T1, y ese sobreprecio es deliberado: el T10 es
  // un objeto de escaparate, no una optimización.
  collectorCardT1: { cost: 850, label: 'Recolector Tier 1' },
  collectorCardT2: { cost: 1600, label: 'Recolector Tier 2' },
  collectorCardT3: { cost: 2500, label: 'Recolector Tier 3' },
  collectorCardT4: { cost: 3700, label: 'Recolector Tier 4' },
  collectorCardT5: { cost: 5300, label: 'Recolector Tier 5' },
  collectorCardT6: { cost: 7200, label: 'Recolector Tier 6' },
  collectorCardT7: { cost: 9400, label: 'Recolector Tier 7' },
  collectorCardT8: { cost: 11900, label: 'Recolector Tier 8' },
  collectorCardT9: { cost: 14600, label: 'Recolector Tier 9' },
  collectorCardT10: { cost: 17500, label: 'Recolector Tier 10' }
};

// Coste de cada slot de compañero adicional (índice = slots ya poseídos).
// 5 slots es el techo: es lo que hace que los slots valgan más que los tiers.
// Se llega hasta 9 slots: 5 de tienda + hasta 4 del nodo "Cuadrilla".
export const COMPANION_SLOT_COSTS = [0, 1200, 4500, 16000, 55000, 180_000, 520_000, 1_400_000, 3_600_000, 9_000_000];

// Mejora de recolector: coste creciente en cristales y éxito decreciente.
//
// El TECHO de niveles no vive aquí. Vive en `data/crafting.ts` como
// `collectorMaxLevel()`, junto a la fórmula que crea el `maxLevel` de un
// recolector forjado, y se llama desde el game loop y desde las vistas. Aquí
// hubo un `MAX_COLLECTOR_LEVEL = 20` que solo usaba este fichero, y mientras
// estuvo el techo mirando solo a 20 la mitad de los recolectores del juego
// tenían un límite que su propia ficha no enseñaba.
export function collectorUpgradeCost(level: number): number {
  // 1,1,2,2,3,3,4,5,6,7,8,9,11,13,15,18,21,25,30,35 -> ~190 cristales en total
  return Math.max(1, Math.floor(1.2 * Math.pow(1.14, level)));
}

/**
 * Probabilidad de éxito con un cristal concreto, en porcentaje.
 *
 * Es el mismo número que usa `upgradeEquippedCollector`, expuesto para que las
 * vistas puedan enseñarlo ANTES de que el jugador gaste. La regla del juego es
 * que ninguna probabilidad se muestra después de confirmar.
 */
export function previewUpgradeChance(level: number, crystalPower: number): number {
  return crystalSuccessChance(level, crystalPower);
}

/**
 * Coste de la sintonización al nivel dado, en unidades de cristal.
 *
 * Igual que el anterior: el juego cobra esto, la vista lo enseña. Duplicar el
 * cálculo en la interfaz sería una forma de que el botón dijera una cifra y el
 * cobro otra.
 */
export function previewUpgradeCost(level: number): number {
  return collectorUpgradeCost(level);
}

// Consumibles de la tienda. `buffId` es el identificador estable que usa el
// almacén para aplicar el efecto: cambiar un nombre no puede romper el buff.
const CONSUMABLES = {
  clickBuff: { name: 'Buff Clicks x2', details: 'Otorga x2 al click por 30 minutos', rarity: 'Raro', buffId: 'clickBoost' },
  passiveBuff: { name: 'Buff Pasivo x2', details: 'Otorga x2 al ingreso pasivo por 60 minutos', rarity: 'Épico', buffId: 'passiveBoost' },
  backpackExpander: { name: 'Expansor de Almacén', details: 'Aumenta el almacén +1 slot (máx 20)', rarity: 'Raro', buffId: 'warehouseExpander' },
  afkCard: { name: 'Tarjeta AFK', details: 'Permite juego sin la ventana activa 10 min (acumulable x3)', rarity: 'Raro', buffId: 'afk' },
  clickX2Card: { name: 'Tarjeta Click x2', details: 'Otorga x2 al click por 30 segundos', rarity: 'Raro', buffId: 'clickX2' },
  clickX3Card: { name: 'Tarjeta Click x3', details: 'Otorga x3 al click por 30 segundos', rarity: 'Épico', buffId: 'clickX3' },
  calibrationStone: { name: 'Piedra de Calibración', details: 'Sube 12 puntos la probabilidad de la próxima fusión', rarity: 'Raro', buffId: 'calibrationStone' },
  stabilityNano: { name: 'Nanopartícula de Estabilidad', details: 'Deja el recolector forjado con un afijo extra garantizado', rarity: 'Legendario', buffId: 'stabilityNano' }
} as const;

// Definición de cada tipo de caja. La fuente de verdad es el item del almacén,
// `state.crates` se mantiene sincronizado como contador para las migraciones.
//
// `details` dice qué trae y qué llave abre. Antes decía "contiene
// recompensas básicas", que no dice nada: el jugador no tenía forma de saber
// si le convenía ni de qué llave necesitaba.
const CRATE_TYPES = {
  common: {
    name: 'Caja Común',
    rarity: 'Común',
    details: 'Recompensas de partida temprana: nanitas, cristales, algún dron T1. Abre con una Llave de Cifrado.'
  },
  rare: {
    name: 'Caja Rara',
    rarity: 'Raro',
    details: 'Material de forja y compañeros T3, con algún recolector T4 sobrecargado. Abre con una Llave Reforzada.'
  },
  epic: {
    name: 'Caja Épica',
    rarity: 'Épico',
    details: 'Compañeros T6 y recolectores T6, con piedras de calibración. Abre con una Llave Rúnica.'
  },
  legendary: {
    name: 'Caja Legendaria',
    rarity: 'Legendario',
    details: 'Recolectores T8 y compañeros Divinos que no se compran. Sale la Nanopartícula de Estabilidad. Abre con una Llave del Vacío.'
  }
} as const;

export type CrateType = keyof typeof CRATE_TYPES;

// Deduce el buffId de un consumible guardado antes de que existiera el campo.
// Se usa una sola vez, al migrar saves antiguos.
function inferBuffIdFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes('expansor')) return 'warehouseExpander';
  if (lower.includes('afk')) return 'afk';
  if (lower.includes('click x3')) return 'clickX3';
  if (lower.includes('click x2')) return 'clickX2';
  if (lower.includes('pasivo')) return 'passiveBoost';
  if (/clics?\s*x2/.test(lower)) return 'clickBoost';
  return null;
}

function createCrateItem(crateType: CrateType, quantity: number = 1) {
  const def = CRATE_TYPES[crateType];
  const storeItem = (STORE_ITEMS as Record<string, { cost: number }>)[`${crateType}Crate`];
  return {
    id: `crate_${crateType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: def.name,
    type: 'crate' as const,
    details: def.details,
    rarity: def.rarity,
    tier: 0,
    sellPrice: Math.floor(storeItem.cost / 4),
    stackable: true,
    stackCount: quantity
  };
}


// Función para generar un compañero aleatorio por tier
export function generateCompanionByTier(tier: number): { id: string; name: string; type: 'click' | 'passive' | 'multiplier'; power: number; rarity: string; tier: number } {
  const range = TIER_SYSTEM.ranges[tier as keyof typeof TIER_SYSTEM.ranges] || [1, 5];
  const power = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  const names = TIER_SYSTEM.companionNames[tier as keyof typeof TIER_SYSTEM.companionNames] || ['Dron Explorador'];
  const name = names[Math.floor(Math.random() * names.length)];
  const rarity = TIER_SYSTEM.rarityByTier[tier as keyof typeof TIER_SYSTEM.rarityByTier] || 'Común';
  
  return {
    id: `comp_t${tier}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    type: 'click',
    power,
    rarity,
    tier
  };
}

// Función para generar un recolector aleatoria por tier
export function generateCollectorByTier(tier: number): { id: string; name: string; type: string; details: string; rarity: string; tier: number; level: number; damage: number } {
  const range = TIER_SYSTEM.ranges[tier as keyof typeof TIER_SYSTEM.ranges] || [1, 5];
  const power = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  const names = TIER_SYSTEM.collectorNames[tier as keyof typeof TIER_SYSTEM.collectorNames] || ['Blaster Láser'];
  const name = names[Math.floor(Math.random() * names.length)];
  const rarity = TIER_SYSTEM.rarityByTier[tier as keyof typeof TIER_SYSTEM.rarityByTier] || 'Común';
  
  return {
    id: `collector_t${tier}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    type: 'collector',
    details: `Recolección por click: +${power}`,
    rarity,
    tier,
    level: 0,
    damage: power
  };
}

export async function createGameLoop(
  user: any,
  onUpdate: (state: any, isAfkPaused?: boolean) => void,
  username?: string,
  onAchievement?: (achievement: Achievement) => void
) {
  // Se declara antes de la carga de Firestore: `recalculatePassiveIncome` se llama
  // durante la carga y lee este estado (TDZ si se declarase más abajo).
  // `unlocked` se sincroniza con state.unlockedAchievements en cada rebuild.
  const achievementState = createAchievementState();

  // El compañero inicial es un T1 real: mismo poder que compra el jugador, para
  // que la decisión "comprar otro T1 o guardar" tenga sentido desde el segundo 1.
  const baseCompanion = {
    id: 'companion_base_001',
    name: 'Dron Explorador',
    type: 'click' as const,
    power: 5,
    rarity: 'Común',
    tier: 1
  };

  // Bonus especial para usuarios de prueba
  // El nombre llega resuelto desde `main.ts`, que ya lo ha buscado en la
  // sesión, en el registro y en la partida guardada. Aquí solo se normaliza.
  // Antes se leía solo `user.displayName`, que Firebase puede devolver vacío
  // tras renovar el token: el juego arrancaba como "Operativo" y el nombre
  // bueno se perdía en el siguiente guardado.
  const displayName = (user.displayName || username || 'Operativo').trim();
  const isBlanquician = displayName.toLowerCase() === 'blanquician';
  const isAdmin = displayName.toLowerCase() === 'admin';
  const initialNanites = (isBlanquician || isAdmin) ? 100000000 : 0;

  let state = {
    saveVersion: SAVE_VERSION,
    nanites: initialNanites,
    totalNanitesProduced: initialNanites,
    passiveIncome: 0,
    passiveMultiplier: 1, // Multiplicador global aportado por los compañeros tipo 'multiplier'
    totalClicks: 0,
    totalInfraestructure: 0,
    cratesOpened: 0,
    unlockedAchievements: [] as AchievementId[],
    // --- Prestige ---
    cores: 0, // Núcleos disponibles
    totalCores: 0, // Núcleos ganados historicamente
    resets: 0, // Veces que se ha reciclado el progreso
    unlockedNodes: [] as string[], // Nodos comprados
    nodeLevels: {} as Record<string, number>, // Nivel por nodo
    shards: 0, // Esquirlas de crafteo
    forgedCount: 0, // Recolectores forjadas con exito
    // --- Bonificaciones agregadas del arbol (se recalculan al cargar) ---
    bonus: {
      clickMult: 0, passiveMult: 0, costReduction: 0, sellMult: 0,
      craftLuck: 0, shardBonus: 0, autoClick: 0, afkHours: 0,
      offlineClicks: 0, crateLuck: 0, coreGain: 0, storageSlots: 0, companionSlots: 0
    },
    // --- Cosméticos equipados ---
    cosmetics: {
      title: 'title_default',
      frame: 'frame_none',
      banner: 'banner_none',
      unlocked: ['title_default', 'frame_none', 'banner_none'] as string[]
    },
    keys: 3,
    upgradeCrystals: 5,
    warehouseCapacity: 15,
    maxCompanionSlots: 1,
    // Ids de items delante de los cuales el jugador ha dejado un hueco. Ver
    // `setWarehouseGaps`. El array sigue Empaquetado: un hueco es una
    // preferencia de disposición, no una posición, y por eso va anclado a un id
    // y no a un índice de celda.
    warehouseGaps: [] as string[],
    afkCards: 0, // Tarjetas AFK acumuladas (máx 3)
    afkExpiresAt: 0, // Tiempo de expiración del buff AFK (10 min por tarjeta)
    crates: {
      common: 2,
      rare: 0,
      epic: 0,
      legendary: 0
    },
    // Contadores DERIVADOS del almacén. Los calcula `syncMaterialCounters()`.
    // Se guardan porque el árbol de pasivas los lee y porque las partidas
    // viejas los traen; nunca son la fuente de verdad.
    keysByTier: { 0: 3, 1: 0, 2: 0, 3: 0 } as Record<number, number>,
    crystalsByTier: { 1: 5 } as Record<number, number>,
    crystalTotal: 5,
    equippedCollectorId: null as string | null,
    companions: [baseCompanion] as Array<{ id: string; name: string; type: 'click' | 'passive' | 'multiplier'; power: number; rarity: string; tier?: number }>,
    activeCompanions: [] as string[],
    warehouse: [
      { id: 'collector_blaster_001', name: 'Blaster Láser', type: 'collector', details: 'Recolección por click: +5', rarity: 'Común', tier: 1, level: 0, damage: 5, sellPrice: 250 },
      { id: 'companion_base_001', name: 'Dron Explorador', type: 'companion', details: 'Recolección por segundo: +5/s', rarity: 'Común', tier: 1, sellPrice: 250 }
    ] as Array<{ id: string; name: string; type: string; details: string; rarity: string; tier?: number; level?: number; damage?: number; equipped?: boolean; sellPrice?: number; stackable?: boolean; stackCount?: number }>,
    buffs: {
      clickBoostExpiresAt: 0,
      passiveBoostExpiresAt: 0,
      clickX2ExpiresAt: 0, // Tarjeta Click x2 (30s)
      clickX3ExpiresAt: 0  // Tarjeta Click x3 (30s)
    }
  };

/**
 * Precio de venta de un item del almacén.
 *
 * Vive fuera del objeto devuelto porque lo necesitan dos sitios: la vista, que
 * lo pinta, y `sellItem()`, que lo cobra. Con la fórmula duplicada, la tarjeta
 * podía enseñar un precio y el cobro aplicar otro.
 */function getSellPriceFor(item: any): number {
  if (item.type === 'collector') {
    return sellPrice(item, { sellMult: 1 + state.bonus.sellMult });
  }
  return Math.floor((item.sellPrice || 0) * (1 + state.bonus.sellMult));
}

/**
 * Mete un item en el almacén, sumándolo a la pila que ya hubiera.
 *
 * Es la ÚNICA forma de añadir un item al almacén, y el motivo de que exista es
 * que antes no lo había: cada sitio hacía `state.warehouse.push(item)`, así que
 * una caja que soltaba una llave metía un item NUEVO en vez de sumar una unidad a
 * la pila de llaves que el jugador ya tenía. Cada llave ocupaba su propia
 * ranura, la rejilla las agrupaba en una celda con un "19" y el contador pedía
 * 19 ranuras por un item que el jugador nunca había visto duplicado.
 *
 * Un apilable se suma a la primera pila del mismo tipo y nombre; si no cabe en
 * ella, se abre una pila nueva. Un item que no es apilable siempre entra con su
 * propio id, porque dos recolectores son dos cosas distintas aunque se llamen
 * igual.
 *
 * Devuelve false si no había hueco. No avisa: quien llama decide, porque hay
 * sitios que compensan en nanitas y sitios que pierden el botín a propósito.
 */
function addToWarehouse(item: any): boolean {
  const pila = pilaPara(item);
  if (pila) {
    pila.stackCount = stackUnits(pila) + stackUnits(item);
    return true;
  }

  if (countOccupiedSlots(state.warehouse) >= effectiveWarehouseCapacity()) return false;
  state.warehouse.push(item);
  return true;
}

/**
 * La pila a la que se sumaría este item, o null si no hay ninguna.
 *
 * Es la pregunta "¿necesita ranura nueva?" y tiene que ser la MISMA que se hace
 * en `addToWarehouse`. Si se respondiera solo mirando si el almacén está lleno,
 * una compra de algo que cabe en una pila existente se rechazaría con el almacén
 * lleno: el jugador vería "Almacén lleno" por un item que no ocupa ni una ranura
 * y perdería las nanitas.
 */
function pilaPara(item: any): any {
  if (!isStackable(item)) return null;
  const clave = `${item.type}::${item.name}`;
  return state.warehouse.find((w: any) => isStackable(w) && `${w.type}::${w.name}` === clave) ?? null;
}

/** ¿Cabe este item en el almacén, fundiéndolo en una pila si se puede? */
function cabeEnAlmacen(item: any): boolean {
  return !!pilaPara(item) || countOccupiedSlots(state.warehouse) < effectiveWarehouseCapacity();
}

/**
 * Productos que no meten nada en el almacén: son permisos, no objetos.
 *
 * Ampliar el almacén o añadir huecos de compañero no guarda un item, así que
 * no tiene por qué haber hueco. Lo que no está en esta lista SÍ es un objeto
 * físico y necesita su sitio: llaves y cristales incluidos.
 */
const NO_OCUPA_RANURA = ['warehouseSlot', 'backpackExpander', 'companionSlot1', 'companionSlot2'];

/**
 * ¿Se puede comprar este producto sin que el almacén se desborde?
 *
 * La respuesta la necesita la TIENDA para decidir si pinta el botón como
 * "Almacén lleno", y la necesita `buyStoreItem` para no cobrar. Son la misma
 * pregunta, y por eso vive aquí: con dos copias, el botón se deshabilitaba para
 * algo que la compra sí dejaba pasar.
 *
 * Y una ranura es una PILA, no una unidad: 19 llaves ocupa la misma ranura que
 * una. La pregunta no es "¿quedan ranuras?" sino "¿cabe ESTE item?". Preguntar
 * solo por el fullness rechazaba comprar una caja con el almacén lleno, aunque
 * se fuera a sumar a la pila de cajas que ya había.
 */
function cabeLaCompra(itemKey: string): boolean {
  if (NO_OCUPA_RANURA.includes(itemKey)) return true;
  return cabeEnAlmacen(previewStoreItem(itemKey));
}

/**
 * El nivel de llave y de cristal que entrega la TIENDA.
 *
 * Vive aquí y no en los dos sitios que lo necesitan porque es exactamente la
 * clase de dato que se duplica sin que nadie se entere: `previewStoreItem`
 * anunciaba nivel 0 mientras `buyStoreItem` creaba nivel 1. Con eso, un jugador
 * con el almacén lleno y una pila de "Llave de Cifrado" veía el botón de
 * comprar llave encendido —porque la preview encontraba su pila— y al pulsarlo
 * la compra fallaba, porque lo que de verdad se crea es una "Llave Reforzada",
 * que necesita ranura nueva. Botón y cargo discrepando (R3).
 *
 * OJO: el nivel 1 es una discrepancia conocida del juego
 * (`docs/CONTEXTO-JUEGO.md` nº 1): la carta pone "Llave de Cifrado" y entrega una
 * de nivel 1. Arreglar eso cambia la economía y no es de aquí; lo que se
 * arregla aquí es que la pregunta "¿cabe?" mire la misma llave que se entrega.
 */
const STORE_MATERIAL_TIER = 1;

/**
 * Cómo se llamaría y de qué tipo sería el item de una compra, sin crearlo.
 *
 * La comprobación de "¿queda hueco?" va ANTES de cobrar, así que no puede
 * llamar a los generadores: `generateCollectorByTier` y compañía gastan un id
 * único y habría que tirar el item solo por mirarlo. Y no hace falta: para
 * decidir si algo se funde con una pila basta su tipo y su nombre, que es
 * justamente lo único que mira `pilaPara`.
 *
 * Devuelve null para las compras que no meten nada en el almacén (ampliaciones y
 * huecos), que no ocupan ranura por ser permisos.
 */
function previewStoreItem(itemKey: string): any {
  if (itemKey === 'key') return { type: 'key', name: KEY_DEFS[STORE_MATERIAL_TIER].name, stackable: true };
  if (itemKey === 'upgradeCrystal') return { type: 'crystal', name: CRYSTAL_DEFS[STORE_MATERIAL_TIER].name, stackable: true };
  if (itemKey.endsWith('Crate') && CRATE_TYPES[itemKey.replace('Crate', '').toLowerCase() as CrateType]) {
    const t = itemKey.replace('Crate', '').toLowerCase() as CrateType;
    return { type: 'crate', name: CRATE_TYPES[t].name, stackable: true };
  }
  const consumable = CONSUMABLES[itemKey as keyof typeof CONSUMABLES];
  if (consumable) return { type: 'consumable', name: consumable.name, stackable: true };
  if (itemKey.startsWith('companionCardT')) return { type: 'companion' };
  if (itemKey.startsWith('collectorCardT')) return { type: 'collector' };
  return null;
}

/**
 * Quita una cantidad de un item del almacén.
 *
 * Es la ÚNICA forma de consumir un item, y por eso vive aquí y no repartida
 * entre las vistas. El bug que arreglar era precisamente ese: cada pantalla
 * mutaba `state.warehouse` por su cuenta con su propia idea de cómo restar una
 * unidad, y después no recalculaba los contadores derivados.
 *
 * Si el item es apilable y le quedan unidades, baja el contador; si se acaba,
 * desaparece del array. Devuelve cuántas unidades quedan, o 0 si no estaba.
 */
function consumeWarehouseItem(itemId: string, amount = 1): number {
  const idx = state.warehouse.findIndex((w: any) => w.id === itemId);
  if (idx < 0) return 0;

  const item = state.warehouse[idx];

  if (item.stackable && (item.stackCount || 1) > amount) {
    item.stackCount = (item.stackCount || 1) - amount;
    return item.stackCount;
  }

  state.warehouse.splice(idx, 1);
  return 0;
}

/**
 * Añade N llaves o N cristales del nivel indicado.
 *
 * Si el almacén tiene hueco se mete un item apilado; si está lleno, el botín
 * se pierde. Se avisa por consola porque es el momento donde el jugador pierde
 * algo sin haberlo decidido, y no hay dónde ponerlo en un aviso en pantalla.
 */
function grantKeys(tier: KeyTier, amount: number) {
  grantMaterial('key', tier, amount);
}

function grantCrystals(tier: number, amount: number) {
  grantMaterial('crystal', tier, amount);
}

/**
 * Desbloquea un cosmético. Idempotente: `false` si ya lo tenía.
 *
 * Vive a nivel de módulo, y no como método suelto del objeto del juego, porque
 * lo necesitan dos sitios: el método público `unlockCosmetic` y el `applier` que
 * `openCrateBox` pasa al sorteo de las cajas. Dentro de un objeto, un hermano no
 * se ve a otro por su nombre: habría que escribir `this.unlockCosmetic`, y
 * `this` no existe dentro de una función que se pasa como callback. Con la
 * función aparte, los dos caminos llaman a la misma y no pueden divergir.
 */
function desbloquearCosmetico(cosmeticId: string): boolean {
  if (state.cosmetics.unlocked.includes(cosmeticId)) return false;
  state.cosmetics.unlocked.push(cosmeticId);
  return true;
}

function grantMaterial(kind: 'key' | 'crystal', tier: number, amount: number) {
  if (amount <= 0) return;

  const item = createMaterialItem(kind, tier);
  item.stackCount = amount;

  if (!addToWarehouse(item)) {
    console.warn('[inventario] Sin hueco en el almacén: se pierden ' + amount + ' x ' + kind + ' T' + tier + '.');
  }
}

/**
 * Crea un item de llave o cristal listo para el almacén.
 *
 * Los tres viven aquí y no en `data/items.ts` porque necesitan un id único y
 * un precio de reventa, y el precio depende de `STORE_ITEMS`, que está en este
 * archivo. La tabla de niveles y probabilidades sí está en `data/items.ts`.
 */
function createMaterialItem(kind: 'key' | 'crystal', tier: number): any {
  const esLlave = kind === 'key';
  const def = esLlave ? KEY_DEFS[tier as KeyTier] : CRYSTAL_DEFS[tier];
  const prefijo = esLlave ? 'key' : 'crystal';
  const sellPrice = esLlave
    ? Math.floor((def as KeyDef).cost ?? 1200)
    : Math.floor((def as CrystalDef).cost ?? 2400) * 3;

  return {
    id: `${prefijo}_t${tier}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: def.name,
    type: esLlave ? 'key' : 'crystal',
    details: def.details,
    rarity: def.rarity,
    // El nivel viaja en el item para poder ordenar y filtrar sin releer el
    // nombre. Las partidas viejas no lo tienen: se rellena al migrar.
    tier,
    sellPrice,
    stackable: true,
    stackCount: 1
  };
}

/**
 * Cuenta el almacén por tipo de material y reconstruye los contadores.
 *
 * Los contadores `state.keys` y `state.upgradeCrystals` ya no son la fuente de
 * verdad —lo es el almacén—, pero se siguen manteniendo porque el árbol de
 * pasivas y las compras los leen, y porque las partidas viejas los traen.
 *
 * Convivir con un valor desincronizado es exactamente el bug que había con las
 * cajas, así que aquí NO hay conversión de "huérfanos a items": si el contador
 * dice más de lo que hay en el almacén, se ajusta el contador. El almacén gana
 * siempre.
 */
function syncMaterialCounters() {
  const keyByTier: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const crystalByTier: Record<number, number> = {};
  let crystalTotal = 0;

  state.warehouse.forEach((w: any) => {
    if (w.type === 'key') {
      const t = typeof w.tier === 'number' ? w.tier : keyTierFromName(w.name || '');
      keyByTier[t] = (keyByTier[t] || 0) + (w.stackCount || 1);
    } else if (w.type === 'crystal') {
      const t = typeof w.tier === 'number' ? w.tier : 1;
      crystalByTier[t] = (crystalByTier[t] || 0) + (w.stackCount || 1);
      crystalTotal += (w.stackCount || 1);
    }
  });

  state.keys = keyByTier[0] + keyByTier[1] + keyByTier[2] + keyByTier[3];
  state.keysByTier = keyByTier;
  state.crystalsByTier = crystalByTier;

  // El cristal básico es el único que se compra, así que es el que se gasta en
  // las sintonizaciones: los superiores son de premio y el jugador elige.
  state.upgradeCrystals = crystalByTier[1] || 0;
  state.crystalTotal = crystalTotal;

  // Rellena el campo `tier` de los items guardados antes de que existiera.
  state.warehouse.forEach((w: any) => {
    if (w.type === 'key' && typeof w.tier !== 'number') w.tier = keyTierFromName(w.name || '');
    if (w.type === 'crystal' && typeof w.tier !== 'number') w.tier = crystalPowerFromName(w.name || '') === 1 ? 1 : 2;
  });
}

  let isAfk = false;
  let lastActiveTimestamp = Date.now();
  // Momento (reloj monótono) en que el jugador dejó de estar presente en la pantalla.
  // 0 = está presente. Se usa performance.now() porque no lo afecta cambiar la
  // hora del sistema, a diferencia de Date.now().
  let awayAt = 0;
  const AFK_THRESHOLD_MS = 45000;

  const userRef = doc(db, 'users', user.uid);
  const rankingRef = doc(db, 'rankings', user.uid);

  /**
   * El último guardado falló.
   *
   * Se usa para avisar UNA vez, no en cada intento. Un `setDoc` sin red reintenta
   * durante unos diez segundos antes de rendirse, y el intervalo de guardado es
   * de quince: sin este flag, una desconexión de un minuto llenaba la pantalla de
   * avisos idénticos superpuestos, tapando el juego.
   */
  let guardadoFallando = false;

  /**
   * Enciende o apaga el aviso de "sin guardar".
   *
   * No es decoración. Con esta cola, "el número que veo no está en el servidor"
   * pasa a ser una situación real y constante, y el jugador no tiene forma de
   * saberlo: el contador sigue subiendo igual de contento. Un indicador que se
   * enciende al perder la conexión y se apaga al recuperarla convierte la
   * incertidumbre en un dato.
   */
  function marcarPendiente(pendiente: boolean) {
    // `document` puede no existir: el banco de pruebas arranca el bucle en Node
    // con un DOM mínimo que no tiene este elemento, y sin esta guarda el fallo
    // salía justo DENTRO del `catch` —que es el único sitio donde este aviso
    // importa— y se comía el error de red que estaba avisando.
    if (typeof document === 'undefined') return;
    const el = document.querySelector('#pending-save-indicator');
    if (!el) return;
    el.classList.toggle('hidden', !pendiente);
  }

  /**
   * El servidor se quedó con el saldo: se avisa y se baja el contador de fallos.
   *
   * Sin este aviso, el jugador que pasó un rato sin red ve como su saldo "de
   * repente" deja de crecer en el servidor y no entiende por qué. Con él, la
   * desconexión tiene final y se siente resuelta en vez de abandonada.
   */
  function pendingWasFlushed() {
    marcarPendiente(false);
    if (!guardadoFallando) return;
    guardadoFallando = false;
    showToast('Guardado. Tu progreso ya está en la nube.', 'success');
  }

  try {
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // La versión que TRAJO el documento, no la que va a salir de aquí. Es lo
      // único que distingue "partida vieja" de "partida ya migrada", y evita que
      // una migración sea idempotente por casualidad y no por decisión.
      const savedVersion = typeof data.saveVersion === 'number' ? data.saveVersion : 0;
      state.saveVersion = SAVE_VERSION;
      state.nanites = data.nanites ?? 0;
      state.totalNanitesProduced = data.totalNanitesProduced ?? data.nanites ?? 0;
      state.totalClicks = data.totalClicks ?? 0;
      state.unlockedAchievements = data.unlockedAchievements ?? [];
      state.totalInfraestructure = data.totalInfraestructure ?? 0;
      state.cratesOpened = data.cratesOpened ?? 0;
      state.keys = data.keys ?? 3;
      state.upgradeCrystals = data.upgradeCrystals ?? 5;
      state.warehouseCapacity = data.warehouseCapacity ?? 15;
      state.maxCompanionSlots = data.maxCompanionSlots ?? 1;
      state.crates = {
        common: data.crates?.common ?? 2,
        rare: data.crates?.rare ?? 0,
        epic: data.crates?.epic ?? 0,
        legendary: data.crates?.legendary ?? 0
      };
      state.equippedCollectorId = data.equippedCollectorId ?? null;
      state.companions = data.companions ?? [];
      state.activeCompanions = data.activeCompanions ?? [];
      state.warehouse = data.warehouse ?? [];
      // Huecos de disposición. Un guardado viejo no trae el campo, y uno
      // manipulado puede traer cualquier cosa, así que se coacciona a una lista
      // de ids que existen de verdad en el almacén: un hueco anclado a un item
      // que no está no tiene dónde pintarse y solo ensuciaría el recuento.
      state.warehouseGaps = Array.isArray(data.warehouseGaps)
        ? data.warehouseGaps.filter((id: any): id is string =>
          typeof id === 'string' && state.warehouse.some((w: any) => w.id === id))
        : [];
      // Migración: agregar 'damage' y actualizar descripción a recolectores viejas
      let warehouseNeedsMigration = false;

      /**
       * Renombre de 'weapon' a 'collector'. Va PRIMERO, antes de cualquier otra
       * migración, porque todas las de abajo decide si tocan un item mirando su
       * `type`: con el tipo viejo no se reconocían ni como recolectores y se
       * pasaban de largo sin arreglar nada.
       *
       * El id del recolector equipado se renombró a la vez. Sin adoptarlo,
       * quien lo tenía puesto se lo perdía en silencio: `equippedWeaponId` no lo
       * leía nadie y el click se quedaba a cero.
       *
       * Se aplica solo al cruzar de la versión 6 a la 7. No por miedo a repetirla
       * —es idempotente— sino porque `equippedWeaponId` se queda en el documento
       * para siempre: `setDoc` con `merge: true` no borra las claves que ya no
       * se envían. Si se leyera siempre, desequipar en la versión 7 no serviría
       * de nada, porque al siguiente arranque el id viejo volvería a equipar el
       * recolector que el jugador acababa de quitar.
       */
      if (savedVersion < 7) {
        if (migrateItemTypes(state.warehouse)) warehouseNeedsMigration = true;
        if (!state.equippedCollectorId && typeof data.equippedWeaponId === 'string') {
          state.equippedCollectorId = data.equippedWeaponId;
          warehouseNeedsMigration = true;
        }
      }

      // El id equipado y la bandera `equipped` son la misma información en dos
      // sitios. Se pone de acuerdo antes de que nada la lea: el cálculo de daño
      // usa el id y la rejilla usa la bandera, así que discrepar se ve como un
      // item equipado que no hace nada o como un "Desequipar" que no desequipa.
      const equipado = reconcileEquippedCollector(state.warehouse, state.equippedCollectorId);
      state.equippedCollectorId = equipado.id;
      if (equipado.changed) warehouseNeedsMigration = true;

      state.warehouse.forEach((w: any) => {
        if (w.type === 'collector') {
          if (w.damage === undefined) {
            const tier = w.tier || 1;
            const range = TIER_SYSTEM.ranges[tier as keyof typeof TIER_SYSTEM.ranges] || [1, 5];
            w.damage = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
            warehouseNeedsMigration = true;
          }
          // Actualizar descripción al nuevo formato
          const expectedDetails = `Recolección por click: +${w.damage}`;
          if (w.details !== expectedDetails) {
            w.details = expectedDetails;
            warehouseNeedsMigration = true;
          }
        }
        // Migración: consumibles antiguos sin buffId (creados antes de existir el campo)
        if (w.type === 'consumable' && !w.buffId) {
          const buffId = inferBuffIdFromName(w.name || '');
          if (buffId) {
            w.buffId = buffId;
            warehouseNeedsMigration = true;
          }
        }
        // El nivel de llave y de cristal no existía antes. Sin él no se puede
        // saber qué cofre abre cada llave ni cuánto mejora cada cristal, así que
        // se deduce del nombre una sola vez.
        if ((w.type === 'key' || w.type === 'crystal') && typeof w.tier !== 'number') {
          w.tier = w.type === 'key'
            ? keyTierFromName(w.name || '')
            : (crystalPowerFromName(w.name || '') === 1 ? 1 : 2);
          warehouseNeedsMigration = true;
        }
      });

      /**
       * MIGRACIÓN: contadores de llaves y cristales a items del almacén.
       *
       * Antes eran contadores sueltos. Si el contador dice 7 llaves y el almacén
       * está vacío, esas 7 llaves existen en la partida y hay que
       * materializarlas: si no, el jugador las pierde en el guardado siguiente,
       * cuando `syncMaterialCounters` ajustaría el contador a cero.
       *
       * Aquí se hace al revés que con las cajas, a propósito. Con las cajas el
       * almacén era la fuente y el contador podía quedar inflado, así que se
       * ajustaba el contador. Con las llaves el saldo es real y no se puede
       * volver a contarlo, porque detrás no hay ningún item.
       *
       * Llaves y cristales se materializan con la MISMA función, y ya no puede
       * ser de otra manera: las llaves se guardaban de una en una, una ranura
       * por llave, y los cristales de golpe en una sola pila. Un jugador con 19
       * llaves de Cifrado tenía 19 ranuras ocupadas por un item que la rejilla
       * pintaba en una sola celda.
       */
      let materialNeedsMigration = false;

      /**
       * Cuántas unidades de un material HAY ya en el almacén, por nivel.
       *
       * Es lo que hace que esta migración no se ejecute en cada arranque. La
       * migración es para partidas viejas, donde el contador era un número suelto
       * sin ningún item detrás. En una partida que YA tiene items de llave, el
       * contador y el almacén dicen lo mismo, y materializar el contador entero
       * cada vez que se carga metía un item más por unidad: recargar la página
       * duplicaba las llaves, y a la tercera recarga el almacén estaba lleno de
       * llaves que el jugador nunca pidió. Con los cristales, igual.
       *
       * Lo que hay que materializar es la DIFERENCIA entre lo que promete el
       * contador y lo que ya está: los huérfanos. El bucle de arriba acaba de
       * resolver el `tier` de los items viejos, así que aquí ya se puede contar.
       */
      const yaEnAlmacen = (kind: 'key' | 'crystal', tier: number): number => {
        let total = 0;
        for (const w of state.warehouse as any[]) {
          if (w.type !== kind) continue;
          const t = typeof w.tier === 'number'
            ? w.tier
            : kind === 'key' ? keyTierFromName(w.name || '') : (crystalPowerFromName(w.name || '') === 1 ? 1 : 2);
          if (t !== tier) continue;
          total += w.stackable ? (w.stackCount || 1) : 1;
        }
        return total;
      };

      const meterMaterial = (kind: 'key' | 'crystal', tier: number, cantidad: number) => {
        const huerfanos = Math.max(0, cantidad - yaEnAlmacen(kind, tier));
        if (huerfanos <= 0) return;
        const item = createMaterialItem(kind, tier);
        item.stackCount = huerfanos;
        // `addToWarehouse` y no `push`: las huerfanas van a la pila de llaves que
        // ya hubiera, y solo abren una nueva si de verdad no cabe en ninguna.
        if (!addToWarehouse(item)) return;
        materialNeedsMigration = true;
      };
      // `data.keys` es el TOTAL de llaves del guardado, no las de nivel 0. Pasar
      // ese total al nivel 0 y luego restar lo que hay en el nivel 0 compara un
      // total contra una parte, y siempre sobra: con una llave de nivel 1 en el
      // almacén —que es justo la que crea la tienda, aunque se venda como "Llave
      // de Cifrado"— la resta daba 0 y se materializaba una llave de nivel 0 de
      // más en cada recarga. El nivel 0 usa su propio cubo cuando el guardado lo
      // trae, y el total solo como reserva para las partidas viejas, que no
      // tenían cubos.
      meterMaterial('key', 0, data.keysByTier ? (data.keysByTier[0] ?? 0) : (data.keys ?? 3));
      meterMaterial('key', 1, data.keysByTier?.[1] ?? 0);
      meterMaterial('key', 2, data.keysByTier?.[2] ?? 0);
      meterMaterial('key', 3, data.keysByTier?.[3] ?? 0);

      meterMaterial('crystal', 1, data.upgradeCrystals ?? 5);
      meterMaterial('crystal', 2, data.crystalsByTier?.[2] ?? 0);
      meterMaterial('crystal', 3, data.crystalsByTier?.[3] ?? 0);
      meterMaterial('crystal', 4, data.crystalsByTier?.[4] ?? 0);
      if (materialNeedsMigration) warehouseNeedsMigration = true;

      /**
       * MIGRACIÓN: fusionar las pilas repetidas de las partidas ya jugadas.
       *
       * Cada botín de llave, cristal, caja o consumible se guardaba como un item
       * NUEVO en vez de sumar sus unidades a la pila que ya había. Una partida
       * con 19 llaves de Cifrado tenía 19 entradas: la rejilla las agrupaba en
       * una celda con un "19" y el contador pedía 19 ranuras por ellas. El
       * almacén se llenaba de botín que el jugador nunca había decidido guardar.
       *
       * Esas entradas pasan aquí a ser una sola pila con `stackCount: 19`, que
       * es exactamente lo que el jugador ya veía en la celda. No se pierde
       * ninguna unidad: se suman, y `syncMaterialCounters` sigue leyendo el
       * mismo total de llaves.
       *
       * Va DESPUÉS de materializar los contadores, no antes. `addToWarehouse` ya
       * suma a la pila existente, así que fusionar antes sería deshacer lo que
       * la migración acaba de apilar.
       */
      const fusionado = mergeStacks(state.warehouse);
      if (fusionado.changed) {
        state.warehouse = fusionado.items;
        warehouseNeedsMigration = true;
      }

      state.afkCards = data.afkCards ?? 0;
      state.afkExpiresAt = data.afkExpiresAt ?? 0;
      // --- Prestige y cosméticos ---
      state.cores = data.cores ?? 0;
      state.totalCores = data.totalCores ?? 0;
      state.resets = data.resets ?? 0;
      state.unlockedNodes = data.unlockedNodes ?? [];
      state.nodeLevels = data.nodeLevels ?? {};
      state.shards = data.shards ?? 0;
      state.forgedCount = data.forgedCount ?? 0;
      state.cosmetics = {
        title: data.cosmetics?.title ?? 'title_default',
        frame: data.cosmetics?.frame ?? 'frame_none',
        banner: data.cosmetics?.banner ?? 'banner_none',
        // Los tres por defecto siempre están disponibles aunque el save sea viejo
        unlocked: Array.from(new Set([
          'title_default', 'frame_none', 'banner_none',
          ...(data.cosmetics?.unlocked ?? [])
        ]))
      };
      // `totalCores` ausente en saves anteriores a la librería de restarting.
      // Se reconstruye del mejor valor posible para no perder el histórico.
      if (!data.totalCores) {
        state.totalCores = pendingCores(state.totalNanitesProduced);
      }
      state.buffs = {
        clickBoostExpiresAt: data.buffs?.clickBoostExpiresAt ?? 0,
        passiveBoostExpiresAt: data.buffs?.passiveBoostExpiresAt ?? 0,
        clickX2ExpiresAt: data.buffs?.clickX2ExpiresAt ?? 0,
        clickX3ExpiresAt: data.buffs?.clickX3ExpiresAt ?? 0
      };

      /**
       * COLA DE LA SESIÓN ANTERIOR.
       *
       * Va AQUÍ, al final de la carga, y no donde se leen las nanitas. Cada
       * bloque de arriba rellena su parte del estado desde el documento, así
       * que aplicar la cola a mitad de carga garantiza que algo la pise después:
       * los núcleos se leen treinta líneas más abajo y dejaban a cero los que
       * el prestige había pagado, que es justo lo que la cola existe para
       * evitar.
       *
       * La regla NO es "si hay algo pendiente, súmalo". Es "usa lo que sea más
       * nuevo, y solo eso". La diferencia no es de estilo: el reinicio de
       * prestigio pone el saldo a cero, y una cola que se sumara sin más
       * devolvería ese dinero después de reiniciar — con el agravante de que el
       * jugador conservaría los núcleos, y se podría repetir sin límite.
       *
       * El documento trae `updatedAt` y la cola trae su propia marca. Se
       * comparan y gana la más reciente:
       *
       *   · Gana la cola → el último guardado no llegó (o hubo un reinicio que
       *     tampoco llegó). Se adopta entero, incluido si vale cero.
       *   · Gana el documento → otro dispositivo del jugador ha seguido jugando
       *     más tarde, o la cola es de una sesión vieja. Se descarta entera, y
       *     no se mezclan: quedarse con el mayor de los dos produciría saldos
       *     que ninguna de las dos sesiones vio nunca.
       */
      const cola = leerCola(user.uid);
      if (cola.existe) {
        if (cola.ts > aMilis(data.updatedAt)) {
          const diferencia = cola.nanites - state.nanites;
          state.nanites = cola.nanites;
          // El histórico y los clics se adoptan tal cual, sin máximo. Si la
          // cola es la más nueva, sus valores son los buenos; aplicar un
          // `Math.max` dejaría subir un reinicio de prestigio que los dejó a
          // cero a propósito.
          state.totalNanitesProduced = cola.producidas;
          state.totalClicks = cola.clics;

          // Y los núcleos, que son el otro lado del reinicio.
          //
          // El prestige PAGA con núcleos y borra las nanitas. Si un jugador lo
          // hace sin conexión y cierra la pestaña, sin esto vuelve con el saldo
          // a cero —correcto— y sin los núcleos: se había reiniciado para nada.
          // Es lo más caro que puede perder la cola, porque el prestige es la
          // partida entera.
          state.cores = cola.nucleos;
          state.totalCores = cola.totalNucleos;
          state.resets = cola.reinicios;

          if (diferencia > 0) {
            console.info('[cola] Recuperadas ' + formatNumber(diferencia) + ' nanitas sin confirmar.');
            showToast(
              'Recuperadas ' + formatNumber(diferencia) + ' nanitas que no se habían guardado.',
              'success'
            );
          } else if (diferencia < 0) {
            // El caso del reinicio: el servidor tenía más de lo que este
            // dispositivo vio. No es una pérdida, es una operación que sí se
            // quiere conservar.
            console.info('[cola] Adoptado un saldo más bajo (' + formatNumber(diferencia) + ').');
          }
        } else {
          console.info('[cola] Descartada: el documento del servidor es más reciente.');
          vaciarCola();
        }
      }

      // EL GUARDADO DE LA MIGRACIÓN, AQUÍ Y NO ANTES.
      //
      // Estaba unas treinta líneas más arriba, junto al resto de migraciones, y
      // eso lo convertía en un destructor: `setDoc` con `merge: true` escribe
      // `cores: state.cores`, y en ese punto los núcleos todavía no se habían
      // leído del documento, así que valían 0. Una partida con un item que
      // necesitaba migración (un `weapon` viejo, una llave sin nivel, una pila
      // por fusionar) perdía los núcleos y el contador de reinicios en CADA
      // arranque, de forma silenciosa: el documento se sobrescribía a cero con
      // datos que sí estaban bien.
      //
      // Solo se nota con un almacén no vacío, y por eso llevaba tanto tiempo
      // escondido: una partida nueva no dispara migraciones.
      //
      // Va DESPUÉS de la cola, y no antes, por un motivo que se solapa con el
      // suyo: si la migración guardara antes de aplicar la cola, escribiría el
      // saldo viejo del servidor por encima del que el jugador tenía en
      // pantalla, y la cola quedaría desfasada para siempre.
      if (warehouseNeedsMigration) {
        saveToFirebase();
      }

      recalculatePassiveIncome();
    } else {
      // Crear documento del usuario
      await setDoc(userRef, {
        saveVersion: SAVE_VERSION,
        userId: user.uid,
        username: displayName,
        nanites: state.nanites,
        totalNanitesProduced: state.totalNanitesProduced,
        totalClicks: 0,
        totalInfraestructure: 0,
        cratesOpened: 0,
        keys: state.keys,
        upgradeCrystals: state.upgradeCrystals,
        warehouseCapacity: state.warehouseCapacity,
        maxCompanionSlots: state.maxCompanionSlots,
        afkCards: state.afkCards,
        afkExpiresAt: state.afkExpiresAt,
        crates: state.crates,
        equippedCollectorId: state.equippedCollectorId,
        companions: state.companions,
        activeCompanions: state.activeCompanions,
        warehouse: state.warehouse,
        warehouseGaps: state.warehouseGaps,
        buffs: state.buffs,
        unlockedAchievements: state.unlockedAchievements,
        cores: state.cores,
        totalCores: state.totalCores,
        resets: state.resets,
        unlockedNodes: state.unlockedNodes,
        nodeLevels: state.nodeLevels,
        shards: state.shards,
        forgedCount: state.forgedCount,
        cosmetics: state.cosmetics,
        updatedAt: new Date()
      });
      // Crear documento de ranking
      await setDoc(rankingRef, {
        userId: user.uid,
        username: user.displayName || 'Operativo',
        score: state.nanites,
        totalClicks: 0,
        achievements: 0,
        secretAchievements: 0,
        forgedCount: 0,
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error("Error al sincronizar con Firebase:", error);
  }

  function syncCompanionsToWarehouse() {
    // Asegurar que todos los compañeros tengan un item correspondiente en el warehouse
    state.companions.forEach((comp: any) => {
      const exists = state.warehouse.some((w: any) => w.id === comp.id);
      if (!exists && countOccupiedSlots(state.warehouse) < effectiveWarehouseCapacity()) {
        state.warehouse.push({
          id: comp.id,
          name: comp.name,
          type: 'companion',
          details: `Recolección por segundo: +${comp.power}/s`,
          rarity: comp.rarity,
          sellPrice: comp.rarity === 'Común' ? 100 : comp.rarity === 'Raro' ? 500 : comp.rarity === 'Épico' ? 2000 : 10000
        } as any);
      }
    });
    enforceWarehouseCapacity();
  }

  /**
   * Forget the gaps anchored to items that are no longer in the warehouse.
   *
   * A gap lives in the VIEW, not in the array: `warehouseGaps` is the list of
   * ids that have a hole painted right before them. The array itself stays
   * packed, so a hole can never be sold, moved or counted as a slot — which is
   * exactly why this cleanup is all it needs. If an item leaves the warehouse
   * (sold, consumed, recycled by a prestige) its gap has nothing to be painted
   * in front of, so it goes with it. Anything left dangling would be a hole
   * that reappears somewhere the player never asked for as soon as an item with
   * that id showed up again.
   *
   * Called from every path that removes an item. Cheap: it only walks a handful
   * of ids, not the whole warehouse.
   */
  function syncWarehouseGaps() {
    const limpio = normalizaGaps(state.warehouseGaps);
    if (limpio.join(',') !== (state.warehouseGaps || []).join(',')) {
      state.warehouseGaps = limpio;
    }
  }

  /**
   * Limpia la lista de huecos: solo ids que existen en el almacen, y sin pasar
   * de un tope de seguridad.
   *
   * POR QUE NO HAY UN TOPE DE "UN HUECO POR CELDA". Se puso ese limite, y hacia
   * justo lo contrario de lo que el jugador pide: con 3 celdas ocupadas y 18
   * libres, solo dejaba mover un item hasta la celda 5, cuando las 18 celdas
   * vacias son sitios tan validos como las ocupadas. El limite de verdad no es
   * este: es el TABLERO, y lo calcula la vista (`totalCeldasPintadas`), que es la
   * unica que sabe cuantas celdas se dibujan. Por arrastre nunca se pasa de ahi.
   *
   * Lo que queda aqui es un cortafuegos contra un documento manipulado: si
   * alguien edita la partida y mete 100.000 celdas de hueco, aqui se recorta.
   * El recorte no pierde nada —cada hueco es una celda vacia de adorno— pero
   * evita pintar una rejilla gigante.
   */
  function normalizaGaps(ids: any): string[] {
    if (!Array.isArray(ids)) return [];
    const existentes = new Set(state.warehouse.map((w: any) => w.id));
    const salida: string[] = [];
    for (const id of ids) {
      if (typeof id !== 'string' || !existentes.has(id)) continue;
      salida.push(id);
      if (salida.length >= TOPE_CELDAS_HUECO) break;
    }
    return salida;
  }

  /**
   * Deja las celdas de hueco indicadas, una por repetición de id.
   *
   * `ids` es la lista COMPLETA, no una operación de "añadir": quien llama es la
   * vista, que es la única que sabe qué hueco se está moviendo al soltar un item
   * dentro de otro. El juego solo guarda y limpia, igual que con el orden: la
   * disposición es del jugador, no del juego.
   *
   * LA MULTIPLICIDAD ES EL CONTENIDO. Un hueco puede ocupar varias celdas seguidas
   * y eso se cuenta con repeticiones: `['b','b','c']` son dos celdas vacías antes
   * de `b` y una antes de `c`. Por eso aquí NO se deduplica con un `Set` —que
   * fundiría las repeticiones en una y dejaría al item a la izquierda de donde se
   * soltó—, y por eso la lista se guarda tal cual, en orden.
   *
   * Un hueco NO es una ranura. No cuenta para `warehouse.length`, no bloquea una
   * compra y no se puede vender: solo desplaza lo que se ve. Por eso el array
   * sigue empaquetado y por eso esta función no toca `state.warehouse`.
   */
  function setWarehouseGaps(ids: string[]): boolean {
    const limpio = normalizaGaps(ids);
    const antes = (state.warehouseGaps || []).join(',');
    state.warehouseGaps = limpio;
    if (antes === limpio.join(',')) return false;
    saveToFirebase();
    return true;
  }

  /**
   * Recorta el almacén respetando una prioridad. Antes se hacía
   * `slice(0, capacity)`, que destruía el último item de la lista sin aviso y
   * podía borrar el recolector equipado o un compañero activo.
   *
   * Prioridad de conservación:-inducing el recolector equipado, los compañeros activos
   * y los companions con item. Lo que se descarta es lo más reciente y menos
   * ligado a la progresión.
   */
  function enforceWarehouseCapacity() {
    const capacity = effectiveWarehouseCapacity();
    if (countOccupiedSlots(state.warehouse) <= capacity) return;

    const score = (w: any): number => {
      if (w.id === state.equippedCollectorId) return 1000;
      if (state.activeCompanions.includes(w.id)) return 800;
      // Un recolector crafteado vale más que una de tienda: se conserva antes
      if (w.type === 'collector') return 500 + (w.tier || 0) + (w.potential || 0) * 50;
      if (w.type === 'companion') return 400 + (w.tier || 0);
      if (w.type === 'crate') return 300;
      if (w.type === 'consumable') return 200;
      return 100;
    };

    // Mantiene los mejor valorados; ante empate, los más antiguos
    const kept = state.warehouse
      .map((w: any, index: number) => ({ w, index, s: score(w) }))
      .sort((a, b) => (b.s - a.s) || (a.index - b.index))
      .slice(0, capacity)
      .sort((a, b) => a.index - b.index)
      .map(x => x.w);

    state.warehouse = kept;
    // Recortar el almacén puede llevarse el item al que estaba anclado un hueco.
    syncWarehouseGaps();
  }

  // Detecta el tipo de caja a partir del nombre del item
  function getCrateTypeFromName(name: string): CrateType | null {
    const lower = name.toLowerCase();
    if (lower.includes('común')) return 'common';
    if (lower.includes('rara')) return 'rare';
    if (lower.includes('épica')) return 'epic';
    if (lower.includes('legendaria')) return 'legendary';
    return null;
  }

  /**
   * Cuántas cajas hay en el almacén, por tipo. Solo lee: no toca nada.
   *
   * Vive aparte de `syncCrateCounters` porque `materializePendingCrates` necesita
   * el recuento ANTES de escribir nada, para no contar dos veces lo que acaba de
   * crear.
   */
  function countCratesInWarehouse(): Record<CrateType, number> {
    const counts: Record<CrateType, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };

    state.warehouse.forEach((w: any) => {
      if (w.type !== 'crate') return;
      const crateType = getCrateTypeFromName(w.name || '');
      if (!crateType) return;
      // Un item apilado (stackCount) representa varias cajas
      counts[crateType] += (w.stackCount || 1);
    });

    return counts;
  }

  /**
   * `state.crates` es un contador DERIVADO: el almacén es la fuente de verdad.
   * Esta función solo lo recalcula. NO crea items.
   *
   * Antes esta función hacía dos trabajos incompatibles: contar y materializar.
   * La materialización comparaba `state.crates` —el valor del guardado anterior,
   * porque aquí todavía no se había reescrito— contra el almacén recién contada.
   * Después de vender o abrir la ÚLTIMA caja de un tipo, el contador viejo
   * decía 1 y el almacén decía 0, así que `missing` salía positivo y la función
   * metía la caja otra vez en el almacén. El jugador cobraba las nanitas, veía
   * el aviso de vendido, y la caja seguía ahí con otro id. Abrir una caja
   * suffería exactamente lo mismo, y también `updateState()`.
   *
   * Crear items es trabajo de `materializePendingCrates`, que solo se llama
   * donde tiene sentido: al cargar una partida y al reiniciar por prestigio.
   */
  function syncCrateCounters() {
    state.crates = countCratesInWarehouse();
  }

  /**
   * Convierte en cajas reales lo que el contador dice y el almacén no respalda.
   *
   * Solo tiene sentido en dos momentos concretos, y en ninguno más:
   *
   *   - Al cargar. Una partida antigua puede tener `crates: { common: 5 }` sin
   *     un solo item de caja en el almacén. Si no se materializan, el jugador
   *     las pierde sin haber jugado: es saldo real detrás del que no hay
   *     ningún item.
   *   - Al reiniciar por prestigio, donde `crates: { common: 2 }` son las cajas
   *     de partida nueva, no un residuo de la anterior.
   *
   * En cualquier otro momento, este cálculo es un error: el contador va
   *siempre retrasado una operación respecto al almacén, así que compararlo
   * con el almacén no mide lo que falta, mide lo que se acaba de gastar.
   */
  function materializePendingCrates() {
    const counts = countCratesInWarehouse();

    (Object.keys(CRATE_TYPES) as CrateType[]).forEach(crateType => {
      const missing = (state.crates[crateType] || 0) - counts[crateType];
      if (missing <= 0) return;
      // Materializar lo que falte, respetando la capacidad del almacén
      const free = effectiveWarehouseCapacity() - countOccupiedSlots(state.warehouse);
      const toCreate = Math.min(missing, Math.max(0, free));
      for (let i = 0; i < toCreate; i++) {
        // `addToWarehouse`: si ya hay una pila de este tipo de caja, las nuevas
        // se suman a ella y no gastan una ranura cada una.
        if (!addToWarehouse(createCrateItem(crateType) as any)) break;
      }
      counts[crateType] += toCreate;
    });

    state.crates = counts;
  }

  /**
   * Recuento de tarjetas AFK que hay en el almacén.
   *
   * Este contador tenía dos fallos, y los dos venían de lo mismo: no trataba el
   * almacén como lo que es.
   *
   * 1. Contaba ITEMS, no unidades. Las tarjetas son apilables, así que tres
   *    tarjetas en una sola pila se contaban como una. `syncMaterialCounters`
   *    suma `stackCount` justo por eso; aquí faltaba.
   * 2. Las localizaba por el NOMBRE. El almacén lleva su `buffId` desde hace
   *    tiempo, y es el mismo campo que usa `useConsumable` para decidir el
   *    efecto: leer el nombre en un sitio y el campo en otro es exactamente la
   *    desincronización que los contadores derivados evitan a propósito. El día
   *    que la tarjeta se renombre, este contador se queda a cero sin avisar. Las
   *    partidas viejas no tienen `buffId`, así que aquí se deduce del nombre
   *    igual que allí, una vez y solo al leer.
   *
   * Se filtra por `type` además de por `buffId`: es lo que hace el resto del
   * archivo y evita que un item de otro tipo con el mismo campo se cuente.
   */
  function refreshAfkCardCount() {
    let total = 0;

    state.warehouse.forEach((w: any) => {
      if (w.type !== 'consumable') return;
      const buffId = w.buffId ?? inferBuffIdFromName(w.name || '');
      if (buffId !== 'afk') return;
      total += w.stackable ? (w.stackCount || 1) : 1;
    });

    state.afkCards = total;
  }

  // Sincronizar compañeros con el warehouse después de inicializar
  recomputeBonuses();
  rebuildAchievementBonuses();
  syncCompanionsToWarehouse();
  // Al cargar SÍ se materializan las cajas que el contador promete: es la
  // migración de partidas antiguas y el regalo de partida nueva. A partir de
  // aquí, `state.crates` solo se recalcula.
  materializePendingCrates();
  syncMaterialCounters();
  // Las tarjetas AFK también se derivan del almacén al cargar. Antes se leía
  // `afkCards` del guardado y ya está: como el contador contaba items en vez de
  // unidades, quien tuviera tarjetas apiladas arrastraba el error indefinidamente,
  // guardado a guardado. Derivar al cargar lo deja bien sin tocar los items.
  refreshAfkCardCount();
  checkAchievements();

  // Guardar inmediatamente al iniciar sesión
  await saveToFirebase();

  // Los compañeros tipo 'multiplier' no aportan nanitas: multiplican el rendimiento.
  // power es el factor extra (0.5 = +50%, 2.0 = +200%)
  // `state.unlockedAchievements` es la ÚNICA fuente de verdad. Antes también se
  // llevaba una copia en achievementState.unlocked, y si ambas se
  // desincronizaban (un reset o un guardado fallido) los logros ya evaluationados
  // no volvían a aparecer nunca.
  function rebuildAchievementBonuses() {
    achievementState.unlocked = state.unlockedAchievements;
    achievementState.clickBonus = 0;
    achievementState.passiveBonus = 0;
    for (const ach of ACHIEVEMENTS) {
      if (!state.unlockedAchievements.includes(ach.id)) continue;
      achievementState.clickBonus += ach.reward.clickBonus;
      achievementState.passiveBonus += ach.reward.passiveBonus;
    }
  }

  function checkAchievements() {
    const newly = evaluateAchievements(state, achievementState);
    if (newly.length === 0) return;
    for (const ach of newly) {
      if (!state.unlockedAchievements.includes(ach.id)) state.unlockedAchievements.push(ach.id);
      onAchievement?.(ach);
    }
    recalculatePassiveIncome();
    saveToFirebase();
  }

  function calculateCompanionMultiplier(): number {
    let multiplier = 1;
    state.activeCompanions.forEach(compId => {
      const comp = state.companions.find(c => c.id === compId);
      if (comp && comp.type === 'multiplier') {
        multiplier += comp.power;
      }
    });
    return Math.max(1, multiplier);
  }

  /**
   * Recalcula `state.bonus` desde los nodos comprados. Se llama en cada cambio
   * de nodos y una vez al cargar.
   *
   * Importante: los derivados (capacidad, slots, duración AFK) se guardan como
   * base en el save y el bonus se aplica encima, en vez de escribirse en el
   * estado. Si se escribieran, comprar un nodo de almacenamiento sería
   * irreversible al reiniciar: el jugador pagaría dos veces.
   */
  function recomputeBonuses() {
    state.bonus = aggregateBonuses(state.nodeLevels);
    // `nodeLevels` es la fuente de verdad; `unlockedNodes` es su proyección
    state.unlockedNodes = Object.keys(state.nodeLevels).filter(id => (state.nodeLevels[id] || 0) > 0);
  }

  /** Capacidad real del almacén: base del save + ranuras del árbol. */
  function effectiveWarehouseCapacity(): number {
    return state.warehouseCapacity + state.bonus.storageSlots;
  }

  /** Slots de compañero reales: base del save + cuadrilla. */
  function effectiveCompanionSlots(): number {
    return state.maxCompanionSlots + state.bonus.companionSlots;
  }

  /** Duración de una tarjeta AFK: 10 min base + extra del árbol. */
  function afkCardDurationMs(): number {
    return AFK_CARD_DURATION_MS + state.bonus.afkHours * 3600_000;
  }

  function recalculatePassiveIncome() {
    let base = 0;
    // SOLO los compañeros activos suman recursos por segundo.
    // Los de tipo 'click' cuentan aquí: es su único origen de ingresos.
    state.activeCompanions.forEach(compId => {
      const comp = state.companions.find(c => c.id === compId);
      if (comp && comp.type !== 'multiplier') {
        base += comp.power;
      }
    });

    if (Date.now() < state.buffs.passiveBoostExpiresAt) {
      base *= 2;
    }

    state.passiveMultiplier = calculateCompanionMultiplier();
    const withAchievements = base * state.passiveMultiplier
      * (1 + achievementState.passiveBonus)
      * (1 + state.bonus.passiveMult);
    state.passiveIncome = Math.floor(withAchievements);
  }

  /**
   * Bonificaciones de los afijos del recolector equipado. Se suman al daño aquí y no
   * se hornean en `item.damage`: si se guardaran, vender y volver a comprar el
   * mismo objeto cambiaría su estadística.
   */
  function equippedAffixEffect(): { clickMult: number; passiveMult: number; flat: number } {
    const out = { clickMult: 0, passiveMult: 0, flat: 0 };
    if (!state.equippedCollectorId) return out;
    const item: any = state.warehouse.find((w: any) => w.id === state.equippedCollectorId);
    if (!item?.affixes?.length) return out;
    for (const affixId of item.affixes) {
      const affix = AFFIX_BY_ID[affixId];
      if (!affix) continue;
      out.clickMult += affix.effect.clickMult || 0;
      out.passiveMult += affix.effect.passiveMult || 0;
      // Los afijos planos escalan con el nivel del recolector: es lo que hace que
      // subir un recolector crafteado siga valiendo algo.
      out.flat += (affix.effect.flatDamage || 0) * (1 + (item.level || 0) * 0.08);
    }
    return out;
  }

  function calculateClickDamage() {
    if (!state.equippedCollectorId) return 0;
    const item: any = state.warehouse.find((w: any) => w.id === state.equippedCollectorId);
    if (!item) return 0;

    const affixes = equippedAffixEffect();
    const baseDmg = (item.damage || 0) + affixes.flat;
    const levelMultiplier = 1 + ((item.level || 0) * 0.10);
    const total = baseDmg
      * levelMultiplier
      * calculateCompanionMultiplier()
      * (1 + achievementState.clickBonus)
      * (1 + state.bonus.clickMult)
      * (1 + affixes.clickMult);
    return Math.floor(total);
  }

  function calculateMultiplier() {
    let multiplier = 1;
    const now = Date.now();
    if (now < state.buffs.clickBoostExpiresAt) {
      multiplier = 2;
    }
    if (now < state.buffs.clickX3ExpiresAt) {
      multiplier = 3;
    } else if (now < state.buffs.clickX2ExpiresAt) {
      multiplier = 2;
    }
    return multiplier;
  }

  async function saveToFirebase() {
    if (!user) return;

    /**
     * PASO 1 · LA COLA.
     *
     * Antes de tocar la red. Es una escritura local y síncrona, así que cuando
     * esta línea termina, el saldo está en el disco. Si todo lo que viene
     * después falla —sin red, regla cambiada, pestaña cerrada a medias— el
     * jugador sigue teniendo su dinero, y lo recuperará al recargar.
     */
    anotarPendiente(
      user.uid,
      state.nanites,
      state.totalNanitesProduced,
      state.totalClicks,
      state.cores,
      state.totalCores,
      state.resets
    );

    try {
      const gameData = {
        saveVersion: SAVE_VERSION,
        userId: user.uid,
        username: displayName,
        nanites: state.nanites,
        totalNanitesProduced: state.totalNanitesProduced,
        totalClicks: state.totalClicks,
        totalInfraestructure: state.totalInfraestructure,
        cratesOpened: state.cratesOpened,
        keys: state.keys,
        upgradeCrystals: state.upgradeCrystals,
        warehouseCapacity: state.warehouseCapacity,
        maxCompanionSlots: state.maxCompanionSlots,
        afkCards: state.afkCards,
        afkExpiresAt: state.afkExpiresAt,
        crates: state.crates,
        equippedCollectorId: state.equippedCollectorId,
        companions: state.companions,
        activeCompanions: state.activeCompanions,
        warehouse: state.warehouse,
        warehouseGaps: state.warehouseGaps,
        buffs: state.buffs,
        unlockedAchievements: state.unlockedAchievements,
        cores: state.cores,
        totalCores: state.totalCores,
        resets: state.resets,
        unlockedNodes: state.unlockedNodes,
        nodeLevels: state.nodeLevels,
        shards: state.shards,
        forgedCount: state.forgedCount,
        cosmetics: state.cosmetics,
        updatedAt: new Date()
      };
      // Guardar datos del juego en users/{uid}
      await setDoc(userRef, gameData, { merge: true });
      // Guardar solo datos de ranking en rankings/{uid}
      await setDoc(rankingRef, {
        userId: user.uid,
        username: user.displayName || 'Operativo',
        score: state.nanites,
        totalClicks: state.totalClicks,
        // Módulo 8: el ranking refleja logros y firmas de autor
        achievements: state.unlockedAchievements.filter(id => !SECRET_ACHIEVEMENTS.includes(id as AchievementId)).length,
        secretAchievements: state.unlockedAchievements.filter(id => SECRET_ACHIEVEMENTS.includes(id as AchievementId)).length,
        forgedCount: state.forgedCount,
        title: state.cosmetics.title,
        updatedAt: new Date()
      }, { merge: true });

      /**
       * PASO 2 · EL SERVIDOR CONFIRMA.
       *
       * Solo aquí, y solo ahora que las dos escrituras han ido bien, se vacía
       * la cola. Este es el punto más delicado de todo el mecanismo: vaciarla
       * antes de tiempo perdería nanitas (el documento se queda con la cifra
       * vieja y la cola con la nueva, y nadie suma las dos), y no vaciarla
       * nunca las duplicaría en la siguiente recarga.
       */
      vaciarCola();
      pendingWasFlushed();
    } catch (error) {
      /**
       * PASO 3 · FALLO.
       *
       * No se hace nada, y esa es la decisión. La cola se escribió antes de
       * intentarlo y sigue ahí con el saldo, así que no hay nada que
       * recuperar. El siguiente guardado lo reintenta solo.
       *
       * Lo que sí se avisa es el estado, porque "no se está guardando" y
       * "no se está jugando" parecen lo mismo desde fuera y no lo son: el
       * jugador puede estar jugando diez minutos que se perderían si cerrara.
       */
      console.error("Error al guardar en Firebase:", error);
      marcarPendiente(true);
      if (!guardadoFallando) {
        guardadoFallando = true;
        showToast(
          'Sin conexión con el servidor. Tu progreso se guarda en este dispositivo ' +
          'y se subirá solo al volver.',
          'error'
        );
      }
    }
  }

  // El jugador solo está "presente" si la pestaña es visible Y la ventana tiene el
  // foco. Cubre todos los casos en los que no está mirando el juego:
  //   - otra pestaña o ventana del navegador (visibilitychange)
  //   - otra aplicación delante, ventana minimizada o en segundo plano (blur)
  //   - pantalla bloqueada, suspensión del sistema o móvil en reposo
  //   - navegación fuera de la página (pagehide)
  function isPlayerPresent(): boolean {
    return document.visibilityState === 'visible' && document.hasFocus();
  }

  // Cobra el pasivo del tiempo que el jugador estuvo ausente, pero solo si había
  // un buff AFK vigente. Se acota por tres lados para que no se pueda inflar:
  //   - tiempo real ausente medido con reloj monótono (no manipulable con la hora)
  //   - parte restante real del buff AFK
  //   - tope absoluto del buff (30 min)
  function grantAfkCatchUp(fromAwayAt: number) {
    const awayMs = performance.now() - fromAwayAt;
    const buffRemainingMs = Math.max(0, state.afkExpiresAt - Date.now());
    const grantMs = Math.min(awayMs, buffRemainingMs, MAX_AFK_BUFF_DURATION_MS);
    if (grantMs <= 0) return;

    recalculatePassiveIncome();
    if (state.passiveIncome <= 0) return;
    state.nanites += (grantMs / 1000) * state.passiveIncome;
  }

  const handlePresenceChange = () => {
    if (!isPlayerPresent()) {
      if (awayAt === 0) {
        awayAt = performance.now();
        isAfk = true;
        // Sin tick no hay income pasivo: el juego está "detenido" mientras no se mira
        if (gameInterval) { clearInterval(gameInterval); gameInterval = null; }
        // Un último render para que la interfaz muestre la pausa
        onUpdate(state, true);
      }
      return;
    }

    // El jugador volvió a la pantalla
    if (awayAt > 0) {
      grantAfkCatchUp(awayAt);
      awayAt = 0;
    }
    const elapsed = Date.now() - lastActiveTimestamp;
    isAfk = elapsed > AFK_THRESHOLD_MS;
    lastActiveTimestamp = Date.now();
    if (!gameInterval) startGameIntervals();
  };

  const handleUserActivity = (e?: Event) => {
    // Evitar que Enter, Espacio o Intro sumen clicks (anti-trampas)
    if (e && e instanceof KeyboardEvent && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) {
      return;
    }
    // Solo actualizar timestamp con click real (no con mousemove)
    if (e && e.type === 'click') {
      lastActiveTimestamp = Date.now();
      if (isAfk) {
        isAfk = false;
        // Activar estado de espera de click para retomar pasivos
        awaitingClickAfterAfk = true;
        onUpdate(state, false);
      }
    }
  };

  const handleMouseMove = () => { lastActiveTimestamp = Date.now(); };

  // Page Lifecycle API: el navegador congela la página en segundo plano. Es la
  // única señal fiable cuando el sistema suspende o la pantalla se bloquea.
  const docWithLifecycle = document as Document & {
    addEventListener(type: string, listener: () => void, options?: any): void;
    removeEventListener(type: string, listener: () => void, options?: any): void;
  };

  document.addEventListener('visibilitychange', handlePresenceChange);
  window.addEventListener('focus', handlePresenceChange);
  window.addEventListener('blur', handlePresenceChange);
  window.addEventListener('pageshow', handlePresenceChange);
  // Al navegar fuera no hay vuelta: se marca ausencia y se para el tick
  window.addEventListener('pagehide', handlePresenceChange);
  docWithLifecycle.addEventListener('freeze', handlePresenceChange);
  docWithLifecycle.addEventListener('resume', handlePresenceChange);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('keydown', handleUserActivity);
  window.addEventListener('click', handleUserActivity);

  const saveInterval = setInterval(saveToFirebase, 15000);
  const handleUnload = () => { saveToFirebase(); };
  window.addEventListener('beforeunload', handleUnload);

  /**
   * REINTENTOS DE LA COLA.
   *
   * El intervalo de 15 segundos ya reintenta solo, pero hay tres momentos en
   * los que esperar quince segundos no es aceptable:
   *
   *  1. Vuelve la red. El evento `online` del navegador salta en cuanto se
   *     recupera la conexión, y es el momento exacto en que el jugador está a
   *     punto de cerrar la pestaña. Sin esto, esos quince segundos son
   *     exactamente los que se pierden.
   *  2. Vuelve el jugador. Si estuvo en otra pestaña con el wifi apagado, al
   *     enfocar esta se reintenta en el acto.
   *  3. Hay cola de la sesión anterior. Al arrancar, este es el momento de
   *     subarla: el jugador acaba de recuperar esas nanitas y quiere verlas
   *     confirmadas, no dentro de medio minuto.
   */
  const reintentarSiHayCola = () => {
    if (!user) return;
    if (hayPendientes(user.uid)) void saveToFirebase();
  };

  window.addEventListener('online', reintentarSiHayCola);
  window.addEventListener('focus', reintentarSiHayCola);
  // BFCache: al volver atrás en el historial la página se restaura sin recargarse,
  // y el guardado anterior pudo quedar a medias.
  window.addEventListener('pageshow', reintentarSiHayCola);

  // La subida de la cola heredada del arranque anterior. Va después de los
  // listeners para que el resto de la inicialización esté montado cuando llegue
  // la respuesta, y con un margen corto para no competir con el guardado de
  // carga, que acaba de occurrir.
  if (user && hayPendientes(user.uid)) {
    setTimeout(() => { void saveToFirebase(); }, 1200);
  }

  // Intervalo de 500ms para actualización fluida sin parpadeo
  const TICK_RATE_MS = 500;
  const TICKS_PER_SECOND = 1000 / TICK_RATE_MS;

  // Estado para manejar el regreso del AFK
  let awaitingClickAfterAfk = false;
  // Resto fraccionario de los clics automáticos (ver el tick)
  let autoClickAccumulator = 0;

  // Variables para intervalos (pueden detenerse y reiniciarse)
  let gameInterval: ReturnType<typeof setInterval> | null = null;

  function startGameIntervals() {
    // Detener intervalos existentes si los hay
    if (gameInterval) clearInterval(gameInterval);

    // Intervalo principal del juego
    gameInterval = setInterval(() => {
      // Watchdog: si el jugador dejó de estar presente sin que llegara el evento
      // (minimizar desde el SO, bloqueo de pantalla, etc.), esta comprobación
      // para el tick antes de que accrue nada.
      if (!isPlayerPresent()) {
        handlePresenceChange();
        return;
      }

      recalculatePassiveIncome();
      const now = Date.now();
      const hasPassiveBuffActive = now < state.buffs.passiveBoostExpiresAt;
      const hasAfkBuff = now < state.afkExpiresAt;
      const isEffectivelyAfk = isAfk && !hasPassiveBuffActive && !hasAfkBuff;

      if (isEffectivelyAfk) {
        onUpdate(state, true);
        return;
      }

      if (awaitingClickAfterAfk) {
        onUpdate(state, false);
        return;
      }

      if (state.passiveIncome > 0) {
        const gained = state.passiveIncome / TICKS_PER_SECOND;
        state.nanites += gained;
        state.totalNanitesProduced += gained;
      }

      // Clics automáticos del árbol de pasivas. Se acumulan como resto entre
      // ticks en vez de redondear cada tick: a 0.5 clics/s y un tick de 500 ms
      // el redondeo por tick perdería la mitad de la producción.
      if (state.bonus.autoClick > 0) {
        autoClickAccumulator += state.bonus.autoClick * (TICK_RATE_MS / 1000);
        while (autoClickAccumulator >= 1) {
          autoClickAccumulator -= 1;
          const dmg = calculateClickDamage() * calculateMultiplier();
          state.nanites += dmg;
          state.totalNanitesProduced += dmg;
          state.totalClicks += 1;
        }
      }
      // Los logros se comprueban en el tick: así se desbloquean solos sin que
      // el jugador tenga que tocar nada
      checkAchievements();
      onUpdate(state, isAfk && (hasPassiveBuffActive || hasAfkBuff));
    }, TICK_RATE_MS);
  }

  // Iniciar intervalos solo si el jugador está mirando el juego. Si se abrió en
  // segundo plano, arrancarán solos en el primer focus/visibilitychange.
  if (isPlayerPresent()) {
    startGameIntervals();
  }

  const estado = {
    getState: () => state,
    /**
     * Nombre del jugador ya resuelto (`user.displayName` → nombre de registro →
     * "Operativo"). Vive en la API en vez de en `state` porque no es progreso
     * guardado: es identidad de la SESIÓN.
     *
     * El perfil lo pintaba desde `state.__username`, un campo que no existe en
     * ningún sitio, así que la tarjeta de identidad caía siempre en el texto de
     * reserva "Operativo" aunque el nombre bueno estuviera resuelto. Al ser la
     * misma variable que ya se envía al ranking, ahora no puede desincronizarse.
     */
    getDisplayName: () => displayName,
    isAfk: () => isAfk,
    isPresent: () => isPlayerPresent(),
    // Daño por click ya con nivel, multiplicador de compañeros y buffs aplicados.
    // La UI debe usar esta función para no mostrar un valor distinto al real.
    getClickDamage: () => Math.floor(calculateClickDamage() * calculateMultiplier()),
    getAchievements: () => ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: state.unlockedAchievements.includes(a.id),
      current: a.progress(state).current,
      target: a.progress(state).target
    })),
    // Cancela un buff activo. El tiempo restante se pierde, no se devuelve el item.
    cancelBuff: (buffKey: BuffKey) => {
      handleUserActivity();
      const labels: Record<BuffKey, string> = {
        clickBoost: 'Clics x2',
        clickX2: 'Clics x2 (tarjeta)',
        clickX3: 'Clics x3 (tarjeta)',
        passiveBoost: 'Pasivo x2',
        afk: 'AFK'
      };
      if (buffKey === 'afk') {
        if (state.afkExpiresAt <= Date.now()) return false;
        state.afkExpiresAt = 0;
      } else {
        const field = BUFF_FIELDS[buffKey];
        if (state.buffs[field] <= Date.now()) return false;
        state.buffs[field] = 0;
      }
      recalculatePassiveIncome();
      onUpdate(state, isAfk);
      saveToFirebase();
      return labels[buffKey];
    },
    /**
     * Adopta un estado completo de golpe.
     *
     * `syncCrateCounters` y no `materializePendingCrates`: esto no es importar una
     * partida guardada, es sustituir el estado en caliente. El almacén que llega
     * es el estado real, y de un almacén real no se fabrican cajas que el
     * jugador ya no tiene.
     */
    updateState: (newState: any) => {
      Object.assign(state, newState);
      enforceWarehouseCapacity();
      syncCompanionsToWarehouse();
      syncWarehouseGaps();
      syncCrateCounters();
      syncMaterialCounters();
      refreshAfkCardCount();
      rebuildAchievementBonuses();
      recalculatePassiveIncome();
      checkAchievements();
      onUpdate(state, isAfk);
      saveToFirebase();
    },

    /**
     * Reordena el almacén.
     *
     * La libertad de acomodo es del jugador, no del juego, así que aquí no se
     * decide NADA sobre el destino: se le pasa el item al que tiene que quedar
     * pegado el bloque que se mueve y el juego se limita a ponerlo delante. Con
     * `anchorId = null` el bloque va al final del almacén.
     *
     * `lado` dice de qué lado del ancla entra el bloque. No es un detalle: sin
     * él el bloque siempre caía DELANTE del ancla, y como el ancla es el item de
     * la celda señalada, el bloque acababa una celda a la IZQUIERDA de donde el
     * jugador había soltado. Peor: soltar encima del vecino inmediato era un
     * no-op exacto —el bloque ya estaba delante del ancla— así que arrastrar una
     * celda sobre la de al lado no movía absolutamente nada, y la conclusión del
     * jugador era que mover no funcionaba.
     *
     * El que llama sabe en qué dirección se señala el destino (el número de celda
     * de origen y el de destino), así que el juego no tiene que adivinarlo y no
     * puede equivocarse.
     *
     * POR QUÉ UN ANCLA Y NO UN ÍNDICE. El número de celda de la rejilla no es un
     * índice del array: una celda puede representar tres cajas apiladas. Al
     * quitar el grupo arrastrado, todas las celdas que hubiera detrás cambian de
     * sitio, así que un destino traducido a índice ANTES de quitar nada caía
     * una celda más allá de donde se había soltado en cuanto había una pila por
     * medio, y al soltar en uno de los huecos del final directamente no pasaba
     * nada, porque el hueco no tiene índice y se recortaba a la última celda
     * ocupada —que era justo la celda de origen—. Buscando el ancla por id DESPUÉS
     * de quitar, da igual cuántas cosas hubiera detrás.
     *
     * `ids` puede traer varios items porque una pila es una sola celda: si se
     * arrastra una pila de 5, los 5 van juntos y en el mismo orden. Mover solo el
     * que representaba la celda dejaba la celda igual de llena, así que el
     * jugador veía un arrastre que no había movido nada.
     */
    moveItems: (
      ids: string[],
      anchorId: string | null,
      lado: 'antes' | 'despues' = 'antes'
    ): boolean => {
      const wh = state.warehouse;
      if (!ids.length) return false;

      // Índices de los que se mueven, de izquierda a derecha. Los ids que no
      // estén en el almacén se ignoran en vez de abortar: uno que ya no existe
      // no puede volver a bloquear el movimiento de los otros.
      const origen = ids
        .map(id => wh.findIndex((w: any) => w.id === id))
        .filter(i => i >= 0)
        .sort((a, b) => a - b);
      if (!origen.length) return false;

      const seMueven = new Set(origen);

      // El ancla tiene que ser un item que se queda donde está. Si no está, o si
      // es parte del bloque que se mueve (soltar una pila sobre sí misma), no hay
      // reordenación que hacer.
      const ancla = anchorId == null ? -1 : wh.findIndex((w: any) => w.id === anchorId);
      if (anchorId != null && ancla < 0) return false;
      if (ancla >= 0 && seMueven.has(ancla)) return false;

      const bloque = origen.map(i => wh[i]);
      for (let k = origen.length - 1; k >= 0; k--) wh.splice(origen[k], 1);

      // Con el bloque ya fuera, el ancla se busca otra vez: sus índices ya no son
      // los de antes. `ancla < 0` significa "sin ancla" = al final.
      if (ancla < 0) {
        wh.push(...bloque);
      } else {
        const i = wh.findIndex((w: any) => w.id === anchorId);
        wh.splice(lado === 'despues' ? i + 1 : i, 0, ...bloque);
      }

      onUpdate(state, isAfk);
      saveToFirebase();
      return true;
    },

    /**
     * Huecos de disposición. Ver `setWarehouseGaps`.
     *
     * Se expone como lista completa porque el intercambio de "item entra en el
     * hueco y el hueco va a donde estaba el item" lo decide la vista, que es la
     * que ve la rejilla. Aquí solo se guarda, se limpia y se persiste.
     */
    getWarehouseGaps: (): string[] => [...(state.warehouseGaps || [])],
    setWarehouseGaps,

    /**
     * Vende un item del almacén.
     *
     * Todo el borrado ocurre aquí, no en la vista. Antes cada pantalla restaba
     * el item por su cuenta y luego llamaba a `updateState`, que recalculaba
     * los contadores ANTES de que el item se hubiera quitado de verdad en
     * algunos caminos: el item volvía a aparecer en el siguiente guardado.
     *
     * Para las cajas el bucle era más corto: `syncCrateCounters()` recreaba el
     * item recién vendido porque comparaba el contador del guardado anterior
     * contra el almacén. Ver `materializePendingCrates`.
     */
    sellItem: (itemId: string): { ok: boolean; msg?: string; gained?: number } => {
      handleUserActivity();
      const idx = state.warehouse.findIndex((w: any) => w.id === itemId);
      if (idx < 0) return { ok: false, msg: 'Ese item ya no está en el almacén.' };

      const item = state.warehouse[idx];
      const esEquipado = (item.type === 'collector' && state.equippedCollectorId === item.id) ||
        (item.type === 'companion' && state.activeCompanions.includes(item.id));
      if (esEquipado) return { ok: false, msg: 'Desequípalo antes de venderlo.' };

      // No se puede quedar sin la última unidad de un tipo que produce ingreso
      if (item.type === 'collector' || item.type === 'companion') {
        const quedan = state.warehouse.filter((w: any) => w.type === item.type).length;
        if (quedan <= 1) return { ok: false, msg: 'No puedes vender el último de su tipo.' };
      }

      const qty = stackUnits(item);
      const unitario = getSellPriceFor(item);
      const ganado = Math.floor(unitario * qty);

      state.nanites += ganado;

      consumeWarehouseItem(item.id, qty);
      syncWarehouseGaps();

      if (item.type === 'companion') {
        state.companions = state.companions.filter((c: any) => c.id !== item.id);
        state.activeCompanions = state.activeCompanions.filter((id) => id !== item.id);
      }

      syncCrateCounters();
      syncMaterialCounters();
      refreshAfkCardCount();
      syncCompanionsToWarehouse();
      recalculatePassiveIncome();
      checkAchievements();
      onUpdate(state, isAfk);
      saveToFirebase();
      return { ok: true, gained: ganado };
    },

    /**
     * Consume un consumible del almacén y aplica su efecto.
     *
     * El efecto se calcula con la MISMA función que la vista usaba antes, pero
     * aquí se aplica al estado y después se consume el item. El orden importa:
     * primero se resuelve el buff, y solo si se ha aplicado bien se gasta.
     */
    useConsumable: (itemId: string): { ok: boolean; msg?: string } => {
      handleUserActivity();
      const item: any = state.warehouse.find((w: any) => w.id === itemId);
      if (!item) return { ok: false, msg: 'Ese item ya no está en el almacén.' };
      if (item.type !== 'consumable') return { ok: false, msg: 'Esto no se puede usar.' };

      // Las partidas viejas no tienen el campo `buffId`: se deduce del nombre.
      const buffId = item.buffId ?? inferBuffIdFromName(item.name || '');
      if (!buffId) return { ok: false, msg: 'Este consumible no tiene efecto conocido.' };

      const ahora = Date.now();
      const afkMs = afkCardDurationMs();
      let nuevoItem = true;

      switch (buffId) {
        case 'warehouseExpander':
          if (state.warehouseCapacity >= 50) return { ok: false, msg: 'Almacén al máximo.' };
          state.warehouseCapacity += 1;
          break;
        case 'afk': {
          const base = Math.max(ahora, state.afkExpiresAt || 0);
          // Tope 3 tarjetas: más allá el AFK es infinita y rompe el ritmo
          state.afkExpiresAt = Math.min(base + afkMs, ahora + afkMs * 3);
          break;
        }
        case 'clickBoost': {
          const base = Math.max(ahora, state.buffs.clickBoostExpiresAt);
          state.buffs.clickBoostExpiresAt = Math.min(base + 30 * 60_000, ahora + 60 * 60_000);
          break;
        }
        case 'passiveBoost': {
          const base = Math.max(ahora, state.buffs.passiveBoostExpiresAt);
          state.buffs.passiveBoostExpiresAt = Math.min(base + 60 * 60_000, ahora + 2 * 60 * 60_000);
          break;
        }
        case 'clickX2': {
          const base = Math.max(ahora, state.buffs.clickX2ExpiresAt);
          state.buffs.clickX2ExpiresAt = Math.min(base + 30_000, ahora + 30 * 60_000);
          break;
        }
        case 'clickX3': {
          const base = Math.max(ahora, state.buffs.clickX3ExpiresAt);
          state.buffs.clickX3ExpiresAt = Math.min(base + 30_000, ahora + 30 * 60_000);
          break;
        }
        case 'calibrationStone':
        case 'stabilityNano':
          // No se usan desde el almacén: se consumen en la Forja
          return { ok: false, msg: 'Este consumible se usa en la Forja.' };
        default:
          return { ok: false, msg: 'Este consumible no tiene efecto conocido.' };
      }

      consumeWarehouseItem(item.id, 1);
      syncWarehouseGaps();

      refreshAfkCardCount();
      recalculatePassiveIncome();
      checkAchievements();
      onUpdate(state, isAfk);
      saveToFirebase();
      return { ok: true, msg: `${item.name}: aplicado` };
    },
    click: () => {
      handleUserActivity();
      // Si estábamos esperando un click después del AFK, retomar pasivos
      if (awaitingClickAfterAfk) {
        awaitingClickAfterAfk = false;
      }
      const collectorDamage = calculateClickDamage();
      const multiplier = calculateMultiplier();
      const totalGain = Math.floor(collectorDamage * multiplier);
      state.nanites += totalGain;
      state.totalNanitesProduced += totalGain;
      state.totalClicks += 1;
      checkAchievements();
      onUpdate(state, isAfk);
    },
    upgradeEquippedCollector: (crystalTier = 1) => {
      handleUserActivity();
      if (!state.equippedCollectorId) return { success: false, msg: 'No hay ningún recolector equipado.' };
      const item = state.warehouse.find((w: any) => w.id === state.equippedCollectorId);
      if (!item) return { success: false, msg: 'Recolector no encontrado.' };
      const level = item.level || 0;
      // EL TOPE LO PONE EL RECOLECTOR, Y LO PONE LA MISMA REGLA QUE LO CREA.
      //
      // Antes se comparaba contra un `MAX_COLLECTOR_LEVEL = 20` fijo de este
      // fichero, mientras un recolector forjado nace con `maxLevel: 20 + potencial
      // * 3`, o sea entre 23 y 35. El jugador veía una barra que llegaba a 28, el
      // botón de sintonizar aceptaba el gasto del cristal, y a partir del 20 el
      // juego respondía "ya no puedes". Un techo que la pantalla no enseña es peor
      // que uno pequeño, porque el jugador gasta para llegar a algo que no existe.
      // El `as any` es R24 aplicado a un caso concreto: `state.warehouse` está
      // anotado con el `WarehouseItem` de `types.ts`, que es VESTIGIAL y no
      // declara `maxLevel`, mientras que el modelo que de verdad describe el
      // dominio (`types/domain.ts`) sí lo tiene y `data/crafting.ts` lo rellena.
      // Los dos modelos de tipos conviven y no se van a fusionar aquí; lo que no
      // vale es que el motor no pueda leer un campo que el juego escribe.
      const tope = collectorMaxLevel((item as any).maxLevel);
      if (level >= tope) return { success: false, msg: `Recolector al nivel máximo (+${tope * 10}%).` };

      // El cristal se busca por nivel en el almacén, no en un contador suelto.
      // Un cristal de nivel 3 no se gasta por uno de nivel 1: por eso hay que
      // encontrar el item exacto y consumirlo, en vez de restar una unidad.
      const crystal = state.warehouse.find((w: any) =>
        w.type === 'crystal' && (typeof w.tier === 'number' ? w.tier : 1) === crystalTier);
      if (!crystal) {
        const nombre = CRYSTAL_DEFS[crystalTier]?.name ?? 'Cristal';
        return { success: false, msg: `No tienes ${nombre}.` };
      }

      // Coste en cristales creciente: antes era 1 por nivel, así que 20 niveles
      // salían por 20 cristales y el timing de mejora era irrelevante
      const crystalCost = collectorUpgradeCost(level);
      const units = crystal.stackCount || 1;
      if (units < crystalCost) {
        return {
          success: false,
          msg: `Necesitas ${crystalCost} x ${CRYSTAL_DEFS[crystalTier].name} (tienes ${units}).`
        };
      }

      consumeWarehouseItem(crystal.id, crystalCost);
      syncWarehouseGaps();
      syncMaterialCounters();

      // La probabilidad la fija el cristal: mejor cristal, más probabilidad.
      const successChance = crystalSuccessChance(level, CRYSTAL_DEFS[crystalTier]?.power ?? 1);
      const roll = Math.random() * 100;

      if (roll <= successChance) {
        item.level = level + 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { success: true, msg: `¡Mejora exitosa! ${item.name} ascendió al nivel ${item.level}.` };
      } else {
        // Fallo: conserva el nivel y el cristal gastado. Antes retrocedía un
        // nivel, y con el coste creciente eso era una escalera sin retorno:
        // el jugador que fallaba dos veces quedaba atrapado para siempre.
        // La pérdida real es el cristal, que es el coste que se eligió arriesgar.
        onUpdate(state, isAfk);
        saveToFirebase();
        return { success: false, msg: `Fallo en el sintonizador. ${item.name} se mantiene en nivel ${level}. (-${crystalCost} cristales)` };
      }
    },
    expandWarehouse: () => {
      handleUserActivity();
      const cost = Math.floor(500 * (1 - state.bonus.costReduction));
      // El tope es sobre la base guardada, no sobre el total efectivo: los
      // slots del árbol no se "gastan" al comprar una expansión.
      if (state.nanites >= cost && state.warehouseCapacity < 50) {
        state.nanites -= cost;
        state.warehouseCapacity += 5;
        onUpdate(state, isAfk);
        saveToFirebase();
        return true;
      }
      return false;
    },
    unlockCompanionSlot: () => {
      handleUserActivity();
      // Tope duro: 5 slots comprables en tienda. Los extra salen del árbol.
      if (state.maxCompanionSlots >= 5) return false;
      // Se cobra sobre el total efectivo (tienda + cuadrilla): si el árbol ya
      // dio 2 slots, el siguiente de tienda cuesta el del escalón 4.
      const cost = Math.floor(COMPANION_SLOT_COSTS[effectiveCompanionSlots()] ?? 9_000_000);
      if (state.nanites >= cost) {
        state.nanites -= cost;
        state.maxCompanionSlots += 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return true;
      }
      return false;
    },
    /**
     * Alias de `equipCompanion`. Se conserva porque el guardado y el HTML
     * histórico lo nombran así, pero ya no tiene lógica propia: mantener dos
     * implementaciones de "activar/desactivar compañero" es justo lo que dejó
     * los dos caminos haciendo cosas distintas.
     */
    toggleCompanionActive: (compId: string) => estado.equipCompanion(compId),
    equipCollector: (itemId: string) => {
      handleUserActivity();
      const item = state.warehouse.find((w: any) => w.id === itemId);
      if (!item || item.type !== 'collector') return false;

      // ¿Está YA equipado? Se pregunta por el ID, no por la bandera.
      //
      // La bandera es una proyección de este campo y puede haberla descolocado
      // un guardado viejo. Preguntar por ella hacía dos cosas malas: si la
      // bandera estaba puesta y el id vacío,Equipar en vez de Desequipar (y
      // el jugador veía el botón al revés); y al desequipar, este `null`
      // borraba el equipado de verdad sin mirar cuál era, dejando al jugador
      // sin recolector.
      const yaEquipado = state.equippedCollectorId === item.id;

      // El id manda y la bandera se recalcula a partir de él, siempre. Esta
      // llamada es la que deja los dos sitios diciendo lo mismo.
      //
      // `adoptarBandera` va en false al desequipar: el rescate de bandera
      // existe para arreglar guardados viejos al cargar, y si se aplicara aquí
      // el propio clic de "Desequipar" volvería a marcar el item y no
      // bajaría la bandera. El jugador lo vería como un botón que no hace
      // nada —que es el mismo síntoma que se estaba reportando.
      const { id } = reconcileEquippedCollector(
        state.warehouse,
        yaEquipado ? null : item.id,
        !yaEquipado
      );
      state.equippedCollectorId = id;

      recalculatePassiveIncome();
      onUpdate(state, isAfk);
      saveToFirebase();
      return true;
    },
    /**
     * Activa o desactiva un compañero.
     *
     * Es la ÚNICA implementación. Antes convivía con `toggleCompanionActive`,
     * que hacía lo mismo con una diferencia: ordenaba la lista por tier al
     * insertar. Dos caminos para lo mismo, y el que usaba la vista era el que
     * no ordenaba, así que el orden de la lista dependía de por dónde se
     * hubiera equipado. Ahora `toggleCompanionActive` es un alias de aquí.
     *
     * El id se valida contra `state.companions` antes de gastarle una ranura:
     * `activeCompanions` es una lista de ids y el ingreso se calcula cruzando
     * con `state.companions`. Sin esta comprobación, un id que no está ahí
     * ocupaba una de las pocas ranuras y no pagaba nada, sin avisar — con tres
     * ranuras, un id colado era un tercio del ingreso pasivo evaporado en
     * silencio.
     */
    equipCompanion: (compId: string) => {
      handleUserActivity();
      const index = state.activeCompanions.indexOf(compId);
      if (index > -1) {
        state.activeCompanions.splice(index, 1);
      } else {
        if (!state.companions.some((c: any) => c.id === compId)) return false;
        if (state.activeCompanions.length < effectiveCompanionSlots()) {
          state.activeCompanions.push(compId);
          // Orden estable por tier: la lista se pinta en este orden y el
          // jugador la coloca a mano esperando verla así.
          state.activeCompanions.sort((a, b) => {
            const compA = state.companions.find((c: any) => c.id === a);
            const compB = state.companions.find((c: any) => c.id === b);
            return (compA?.tier || 0) - (compB?.tier || 0);
          });
        } else {
          return false;
        }
      }
      recalculatePassiveIncome();
      onUpdate(state, isAfk);
      saveToFirebase();
      return true;
    },
    buyStoreItem: (itemKey: keyof typeof STORE_ITEMS) => {
      handleUserActivity();
      const item = STORE_ITEMS[itemKey];
      if (!item) return false;

      // El árbol de pasivas abarata la tienda. El descuento se aplica al
      // cobrar, no al mostrar: así el precio de la carta y el cobrado salen
      // siempre del mismo número.
      const cost = Math.floor(item.cost * (1 - state.bonus.costReduction));
      if (state.nanites < cost) return false;

      // Validar antes de cobrar: los slots son únicos y no se pueden repetir.
      // Se comparan sobre el total efectivo para que un slot del árbol no
      // "bloquee" la compra del siguiente de tienda.
      const effSlots = effectiveCompanionSlots();
      if (itemKey === 'companionSlot1' && effSlots >= 2) return false;
      if (itemKey === 'companionSlot2' && effSlots >= 5) return false;

      // Validar mochila llena.
      //
      // Llaves y cristales AHORA SÍ ocupan ranura: son items físicos. Lo que no
      // ocupa espacio son las Ampliaciones de almacén y los Huecos de
      // compañero, porque no son objetos que se guarden: son permisos.
      if (!cabeLaCompra(itemKey as string)) {
        showToast('Almacén lleno. No puedes comprar más items.', 'error');
        return false;
      }

      state.nanites -= cost;

      // A partir de aquí la compra está cobrada. Si `addToWarehouse` dice que no
      // cabe, hay que DEVOLVER el dinero antes de salir: un "no compres" que
      // descuenta las nanitas es peor que un bug visible, porque el jugador
      // pierde el saldo sin ver por qué.
      if (itemKey === 'key' || itemKey === 'upgradeCrystal') {
        // Llaves y cristales son items del almacén. Antes eran solo contadores:
        // el jugador no los veía, no los podía ordenar y no ocupaban ranura.
        const esLlave = itemKey === 'key';
        const item = createMaterialItem(esLlave ? 'key' : 'crystal', STORE_MATERIAL_TIER);
        if (!addToWarehouse(item)) { state.nanites += cost; return false; }
        syncMaterialCounters();
        onUpdate(state, isAfk);
        saveToFirebase();
        return item;
      } else if (itemKey === 'warehouseSlot') {
        state.warehouseCapacity += 5;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { id: `slot_${Date.now()}`, name: 'Espacio de Almacén', type: 'upgrade', details: '+5 espacios de almacén', rarity: 'Raro', tier: 0 };
      } else if (itemKey === 'commonCrate' || itemKey === 'rareCrate' || itemKey === 'epicCrate' || itemKey === 'legendaryCrate') {
        // La caja es un item real del almacén: sin esto no se puede abrir
        const crateType = itemKey.replace('Crate', '').toLowerCase() as CrateType;
        const warehouseItem = createCrateItem(crateType);
        if (!addToWarehouse(warehouseItem as any)) { state.nanites += cost; return false; }
        syncCrateCounters();
        onUpdate(state, isAfk);
        saveToFirebase();
        return warehouseItem;
      } else if (CONSUMABLES[itemKey as keyof typeof CONSUMABLES]) {
        const def = CONSUMABLES[itemKey as keyof typeof CONSUMABLES];
        const warehouseItem = {
          id: `cons_${itemKey}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: def.name,
          type: 'consumable' as const,
          details: def.details,
          rarity: def.rarity,
          tier: 0,
          sellPrice: Math.floor(item.cost / 4),
          stackable: true,
          stackCount: 1,
          // Identificador estable: el almacén decide el efecto por este campo,
          // no por el nombre (los nombres ya han cambiado varias veces)
          buffId: def.buffId
        };
        // `addToWarehouse` y no un `if` de capacidad: tres tarjetas AFK son
        // una ranura, así que la tercera se compra con el almacén lleno. Con el
        // `if` de antes la compra caía al final de la función, devolvía true y
        // el jugador pagaba por nada.
        if (!addToWarehouse(warehouseItem as any)) {
          state.nanites += cost;
          return false;
        }
        refreshAfkCardCount();
        onUpdate(state, isAfk);
        saveToFirebase();
        return warehouseItem;
      } else if (itemKey === 'companionSlot1') {
        state.maxCompanionSlots = 2;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { id: `slot2_${Date.now()}`, name: 'Slot de Compañero 2', type: 'upgrade', details: '2 slots de compañero activos', rarity: 'Épico', tier: 0 };
      } else if (itemKey === 'companionSlot2') {
        state.maxCompanionSlots = 5;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { id: `slot5_${Date.now()}`, name: 'Ranura de Escuadrón', type: 'upgrade', details: '5 slots de compañero activos', rarity: 'Legendario', tier: 0 };
      } else if (itemKey.startsWith('companionCardT')) {
        const tier = parseInt(itemKey.replace('companionCardT', ''));
        const comp = generateCompanionByTier(tier);
        state.companions.push(comp);
        const warehouseItem = {
          id: comp.id,
          name: comp.name,
          type: 'companion' as const,
          details: `Recolección por segundo: +${comp.power}/s`,
          rarity: comp.rarity,
          tier: comp.tier,
          sellPrice: Math.floor(item.cost / 4)
        };
        // Un compañero SIEMPRE necesita ranura propia —dos Dron Explorador son
        // dos celdas, para que el jugador pueda elegir cuál equipar—, así que
        // aquí `addToWarehouse` no tiene pila a la que fundirse y decide.
        if (!addToWarehouse(warehouseItem)) {
          state.companions.pop();
          state.nanites += cost;
          return false;
        }
        onUpdate(state, isAfk);
        saveToFirebase();
        return warehouseItem;
      } else if (itemKey.startsWith('collectorCardT')) {
        const tier = parseInt(itemKey.replace('collectorCardT', ''));
        const collector = generateCollectorByTier(tier);
        const warehouseItem = {
          ...collector,
          sellPrice: Math.floor(item.cost / 4)
        };
        if (!addToWarehouse(warehouseItem)) {
          state.nanites += cost;
          return false;
        }
        onUpdate(state, isAfk);
        saveToFirebase();
        return warehouseItem;
      }

      // Aquí solo llegan Ampliaciones de almacén y Huecos de compañero: no son
      // objetos que se guarden, son permisos, así que no hay item que devolver.
      // La compra ya está cobrada y el efecto ya se aplicó más arriba.

      onUpdate(state, isAfk);
      saveToFirebase();
      return true;
    },

    /**
     * Abre una caja del almacén consumiendo la llave correcta.
     *
     * ANTES: `openCrateBox(crateType)` solo miraba `state.keys`. El almacén no
     * participaba: el botón de la vista restaba una unidad del item Y el juego
     * restaba una del contador, sin que nadie se enterara. Resultado: la caja
     * se quedaba en la rejilla y el contador bajaba, o al revés.
     *
     * AHORA: se pasa el ID de la caja y el de la llave. El game loop busca
     * ambos items, valida que la llave sirva para ese cofre, y los consume a
     * los dos en la misma operación. Si algo falla, no se toca nada.
     */
    openCrateBox: (crateId: string, keyId: string): { ok: boolean; msg?: string; reward?: any; crateType?: CrateType } => {
      handleUserActivity();

      const caja = state.warehouse.find((w: any) => w.id === crateId && w.type === 'crate');
      if (!caja) return { ok: false, msg: 'La caja ya no está en el almacén.' };

      const crateType = getCrateTypeFromName(caja.name || '') as CrateType | null;
      if (!crateType) return { ok: false, msg: 'No se reconoce el tipo de esta caja.' };

      const llave = state.warehouse.find((w: any) => w.id === keyId && w.type === 'key');
      if (!llave) return { ok: false, msg: 'Ya no tienes esa llave.' };

      const llaveTier = (typeof llave.tier === 'number' ? llave.tier : keyTierFromName(llave.name || '')) as KeyTier;
      const necesaria = CRATE_KEY_TIER[crateType];

      if (!keyOpens(llaveTier, necesaria)) {
        return {
          ok: false,
          msg: `${llave.name} no abre ${CRATE_TYPES[crateType].name}. Necesitas ${KEY_DEFS[necesaria].name}.`
        };
      }

      // Se consumen los dos items ANTES de sortear. Si el sorteo fallara por
      // una excepción, el jugador ya habria perdido la caja sin recibir nada:
      // peor que un bug visible.
      consumeWarehouseItem(caja.id, 1);
      consumeWarehouseItem(llave.id, 1);
      syncWarehouseGaps();
      state.cratesOpened += 1;

      // El botín lo decide la tabla (crateLoot) y se aplica aquí. La ruleta solo
      // lo muestra: si la animación decidiera, mentiría sobre las probabilidades.
      const premio = rollCrateReward(crateType, {
        nanites: (n) => { state.nanites += n; state.totalNanitesProduced += n; },
        // El segundo argumento es el NIVEL que anuncia el botín, y se respetaba antes.
        // Aquí se tiraba: eran `grantCrystals(1, n)` y `grantKeys(1, n)` con el 1
        // fijo. Consecuencia: una caja legendaria, que anuncia "Llave Rúnica"
        // (nivel 2) y "Cristales de Fase" (nivel 2), entregaba una Llave
        // Reforzada y un Cristal de Afino, ambos de nivel 1. El jugador veía un
        // nombre y recibía otro, que es exactamente lo que la ruleta no debe
        // hacer: Decide el premio y solo lo MUESTRA, así que el nombre que
        // enseña y el item que entra tienen que ser el mismo.
        //
        // Con el módulo de apilado el efecto era peor que cosmético: como todas
        // las llaves de caja caían en nivel 1, se fundían en UNA sola pila. La
        // rúnica de la legendaria entraba en la misma celda que la de Cifrado de
        // la común y no había forma de separarlas ni de recuperarlas.
        crystals: (n, materialTier) => { grantCrystals(materialTier, n); },
        keys: (n, keyTier) => { grantKeys(keyTier, n); },
        hasSpace: () => countOccupiedSlots(state.warehouse) < effectiveWarehouseCapacity(),
        // El cosmético no es un item: no pasa por `addItem` ni por el almacén.
        // Se desbloquea aquí y lo persiste el `saveToFirebase` de más abajo, que
        // corre en la misma operación que el resto del botín.
        unlockCosmetic: (cosmeticId) => desbloquearCosmetico(cosmeticId),
        ownedCosmetics: () => state.cosmetics.unlocked,
        addItem: (item) => {
          if (!addToWarehouse(item as any)) return false;
          // El item trae `companionType` y `power` ya resueltos por crateLoot.
          // Antes se deducían parseando `details` con regex y el multiplicador
          // 0.75 se guardaba como 0.5.
          if (item.type === 'companion' && !state.companions.some((c: any) => c.id === item.id)) {
            state.companions.push({
              id: item.id,
              name: item.name,
              type: item.companionType || 'passive',
              power: typeof item.power === 'number' ? item.power : 1,
              rarity: item.rarity,
              tier: item.tier
            });
          }
          return true;
        }
      });

      // Los contadores se recalculan DESPUÉS de aplicar el botín, para que
      // incluyan lo que acaba de caer. Recalcularlos antes era lo que dejaba el
      // almacén y los contadores desincronizados.
      syncCrateCounters();
      syncMaterialCounters();
      refreshAfkCardCount();
      recalculatePassiveIncome();
      onUpdate(state, isAfk);
      saveToFirebase();
      return { ok: true, reward: premio, crateType };
    },

    // ======================================================================
    //  PRESTIGIO
    // ======================================================================

    /** Núcleos disponibles y los que daría el siguiente reinicio. */
    getPrestigeInfo: () => ({
      cores: state.cores,
      totalCores: state.totalCores,
      pending: nextCores({
        totalNanitesProduced: state.totalNanitesProduced,
        totalCores: state.totalCores,
        coreGain: state.bonus.coreGain
      }),
      resets: state.resets,
      totalProduced: state.totalNanitesProduced,
      bonus: state.bonus
    }),

    /**
     * Recicla el progreso: devuelve nanitas, recolectores, compañeros e infraestructura
     * a cambio de núcleos.
     *
     * Un detalle que parece obvio y no lo es: las recolectores que el jugador ya
     * forjó también se pierden, porque viven en el almacén. Se conserva a
     * propósito solo lo que importa como identidad (cuántas forjó), no el
     * inventario. Si se conservaran los objetos, la forja dejaría de ser una
     * apuesta y `forgedCount` no significaría nada.
     *
     * Lo que NO se pierde: núcleos, nodos del árbol, cosméticos, logros,
     * esquirlas y el contador de recolectores forjadas. Esa es toda la promesa del
     * reinicio, así que el estado se construye explícitamente en vez de
     * hacer `Object.assign` con un reset parcial: si mañana se añade un campo
     * al save, el reinicio lo limpia solo.
     */
    prestige: () => {
      handleUserActivity();
      const gained = nextCores({
        totalNanitesProduced: state.totalNanitesProduced,
        totalCores: state.totalCores,
        coreGain: state.bonus.coreGain
      });
      if (gained <= 0) {
        return { success: false, gained: 0, msg: 'Necesitas producir más para reciclar.' };
      }
      if (!state.totalCores) {
        state.totalCores = pendingCores(state.totalNanitesProduced);
      }

      const keptShards = state.shards;
      const keptForged = state.forgedCount;
      const keptAchievements = [...state.unlockedAchievements];
      const keptCores = state.cores + gained;
      // `totalCores` es el HISTÓRICO de núcleos ganados, y tiene que incluir los
      // que se acaban de ganar. `nextCores` lo resta del total que la producción
      // actual justifica (`pendingCores`), así que si aquí no se sumaran, el
      // histórico se quedaría congelado en el primer reinicio: cada vez daría los
      // núcleos de la primera vez, en vez de la diferencia, y la barra de progreso
      // del prestigio nunca avanzaría de 0.
      const keptTotalCores = state.totalCores + gained;
      const keptResets = state.resets + 1;
      const keptNodes = { ...state.nodeLevels };
      const keptCosmetics = { ...state.cosmetics, unlocked: [...state.cosmetics.unlocked] };

      // Reinicio total
      Object.assign(state, {
        nanites: 0,
        totalNanitesProduced: 0,
        passiveIncome: 0,
        passiveMultiplier: 1,
        totalClicks: 0,
        totalInfraestructure: 0,
        cratesOpened: 0,
        keys: 3,
        upgradeCrystals: 5,
        warehouseCapacity: 15,
        maxCompanionSlots: 1,
        afkCards: 0,
        afkExpiresAt: 0,
        crates: { common: 2, rare: 0, epic: 0, legendary: 0 },
        equippedCollectorId: null,
        companions: [baseCompanion],
        activeCompanions: [],
        warehouse: [
          { id: 'collector_blaster_001', name: 'Blaster Láser', type: 'collector', details: 'Recolección por click: +5', rarity: 'Común', tier: 1, level: 0, damage: 5, sellPrice: 250 },
          { id: 'companion_base_001', name: 'Dron Explorador', type: 'companion', details: 'Recolección por segundo: +5/s', rarity: 'Común', tier: 1, sellPrice: 250 }
        ],
        buffs: { clickBoostExpiresAt: 0, passiveBoostExpiresAt: 0, clickX2ExpiresAt: 0, clickX3ExpiresAt: 0 },
        // Lo permanente
        cores: keptCores,
        totalCores: keptTotalCores,
        resets: keptResets,
        nodeLevels: keptNodes,
        unlockedNodes: Object.keys(keptNodes),
        shards: keptShards,
        forgedCount: keptForged,
        unlockedAchievements: keptAchievements,
        cosmetics: keptCosmetics
      });

      recomputeBonuses();
      rebuildAchievementBonuses();
      syncCompanionsToWarehouse();
      // Aquí `crates: { common: 2 }` son las cajas de partida nueva que acaba de
      // escribir el reinicio: hay que convertirlas en items de verdad.
      materializePendingCrates();
      recalculatePassiveIncome();
      checkAchievements();
      onUpdate(state, isAfk);
      saveToFirebase();
      return { success: true, gained, msg: `+${gained} núcleos` };
    },

    /** Compra un nivel de un nodo del árbol. */
    buyNode: (nodeId: string) => {
      handleUserActivity();
      const check = canBuyNode(nodeId, state.nodeLevels, state.cores);
      if (!check.ok) return { success: false, msg: check.reason ?? 'No se puede comprar.' };

      const node = TREE_BY_ID[nodeId];
      const level = state.nodeLevels[nodeId] || 0;
      const cost = nodeCost(node, level);
      state.cores -= cost;
      state.nodeLevels[nodeId] = level + 1;
      recomputeBonuses();
      recalculatePassiveIncome();
      onUpdate(state, isAfk);
      saveToFirebase();
      return { success: true, msg: `${node.name} → nivel ${level + 1}` };
    },

    // ======================================================================
    //  CRAFTEO
    // ======================================================================

    /**
     * Fusiona 3 recolectores del mismo tier en una de tier+1.
     * `stonesUsed` es cuántas Piedras de Calibración se consumen: cada una
     * sube 12 puntos la probabilidad, hasta 5.
     */
    forgeCollector: (materialIds: string[], stonesUsed = 0, nanoUsed = 0) => {
      handleUserActivity();
      if ((state.nodeLevels.blueprint || 0) < 1) {
        return { success: false, msg: 'Necesitas el nodo "Planos Viejos" para craftear.' };
      }
      if (materialIds.length !== 3) {
        return { success: false, msg: 'Selecciona exactamente 3 recolectores.' };
      }
      const materials = materialIds
        .map(id => state.warehouse.find((w: any) => w.id === id))
        .filter((w: any): w is any => !!w);
      if (materials.length !== 3) return { success: false, msg: 'Material no encontrado.' };
      if (materials.some((m: any) => m.type !== 'collector')) {
        return { success: false, msg: 'Solo se pueden fusionar recolectores.' };
      }
      const tier = materials[0].tier || 1;
      if (materials.some((m: any) => (m.tier || 1) !== tier)) {
        return { success: false, msg: 'Las 3 recolectores deben ser del mismo tier.' };
      }
      // El recolector equipado no se puede consumir: perderla sería un castigo doble
      if (materials.some((m: any) => m.equipped || m.id === state.equippedCollectorId)) {
        return { success: false, msg: 'No puedes fusionar el recolector equipado. Desequípala primero.' };
      }
      if (tier >= 11) {
        return { success: false, msg: 'T11 es el techo de la forja.' };
      }

      // Consumir piedras
      const stonesToUse = Math.max(0, Math.min(5, stonesUsed));
      if (stonesToUse > 0) {
        const stone = state.warehouse.find(
          (w: any) => w.type === 'consumable' && w.buffId === 'calibrationStone'
        );
        if (!stone) return { success: false, msg: 'No tienes Piedras de Calibración.' };
        const available = stone.stackCount || 1;
        if (available < stonesToUse) {
          return { success: false, msg: `Solo tienes ${available} Piedra(s) de Calibración.` };
        }
        stone.stackCount = available - stonesToUse;
        if (stone.stackCount <= 0) {
          state.warehouse = state.warehouse.filter((w: any) => w.id !== stone.id);
        }
      }

      // Consumir la nanopartícula, como mucho una por fusión
      const nanoToUse = nanoUsed > 0 ? 1 : 0;
      if (nanoToUse > 0) {
        const nano = state.warehouse.find(
          (w: any) => w.type === 'consumable' && w.buffId === 'stabilityNano'
        );
        if (!nano) return { success: false, msg: 'No tienes Nanopartículas de Estabilidad.' };
        const available = nano.stackCount || 1;
        if (available < nanoToUse) {
          return { success: false, msg: `Solo tienes ${available} Nanopartícula(s).` };
        }
        nano.stackCount = available - nanoToUse;
        if (nano.stackCount <= 0) {
          state.warehouse = state.warehouse.filter((w: any) => w.id !== nano.id);
        }
      }

      const author = user.displayName || username || 'Anónimo';
      const result = attemptForge(materials, tier, author, {
        craftLuck: state.bonus.craftLuck,
        shardBonus: state.bonus.shardBonus,
        stonesUsed: stonesToUse,
        nanoUsed: nanoToUse
      });

      if (result.error) {
        return { success: false, msg: result.error };
      }

      if (result.success && result.collector) {
        const w = result.collector;
        w.sellPrice = sellPrice(w as any, { sellMult: 1 + state.bonus.sellMult });
        // Restar 2 y devolver 1 en lugar de perder las tres: la tensión se
        // mantiene (pierdes 2 recolectores) sin que un mal rollo vacíe el almacén.
        const keep = materials.reduce((a: any, m: any) => (a.damage < m.damage ? a : m), materials[0]);
        state.warehouse = state.warehouse.filter(
          (x: any) => !materialIds.includes(x.id) || x.id === keep.id
        );
        state.warehouse.push(w as any);
        state.forgedCount += 1;
        recalculatePassiveIncome();
        checkAchievements();
        onUpdate(state, isAfk);
        saveToFirebase();
        return {
          success: true,
          collector: w,
          chance: result.chanceUsed,
          msg: `${w.name} forjada`
        };
      }

      // Fallo: se pierden las 3 y se ganan esquirlas
      state.warehouse = state.warehouse.filter((x: any) => !materialIds.includes(x.id));
      state.shards += result.shards || 0;
      onUpdate(state, isAfk);
      saveToFirebase();
      return {
        success: false,
        shards: result.shards,
        chance: result.chanceUsed,
        msg: `Fallo en la forja: +${result.shards} esquirlas`
      };
    },

    /** Cuántas esquirlas hacen falta para garantizar el próximo intento. */
    getForgeInfo: () => ({
      shards: state.shards,
      craftLuck: state.bonus.craftLuck,
      forgeUnlocked: (state.nodeLevels.blueprint || 0) > 0,
      baseChance: (fromTier: number) => {
        const b = 0.78 - (fromTier - 1) * 0.05;
        return Math.min(0.95, Math.max(0.30, b) + state.bonus.craftLuck);
      }
    }),

    // ======================================================================
    //  VALORACIÓN Y VENTA
    // ======================================================================

    /**
     * Precio de venta de UNA UNIDAD, con la bonificación del árbol.
     *
     * Ojo al nombre: es el precio unitario. Para una pila de 19 llaves son 480,
     * no lo que se cobra por venderla. Para el total está `getSellTotal`.
     */
    getSellPrice: (itemId: string): number => {
      const item: any = state.warehouse.find((w: any) => w.id === itemId);
      if (!item) return 0;
      return getSellPriceFor(item);
    },

    /**
     * Lo que cobra `sellItem` por este item: unidad × unidades.
     *
     * Existe porque `getSellPrice` es el UNITARIO y esa distinción se ha
     * perdido ya una vez: el botón "Vender" pintaba `getSellPrice` sin
     * multiplicar, así que con una pila de 20 llaves decía "Vender · 480 ◆" y el
     * modal de al lado decía "por 9.600 nanitas". El jugador ve un número, lo
     * acepta y se le cobra otro (R3).
     *
     * Vive aquí y no en la vista para que el botón, el modal y el cobro no puedan
     * discrepar por redondeo o por una pila olvidada: es la misma expresión que
     * usa `sellItem`, y si algún día cambia la fórmula cambia en los tres sitios
     * porque son el mismo código.
     */
    getSellTotal: (itemId: string): number => {
      const item: any = state.warehouse.find((w: any) => w.id === itemId);
      if (!item) return 0;
      return Math.floor(getSellPriceFor(item) * stackUnits(item));
    },

    getCollectorValue: (itemId: string) => {
      const item: any = state.warehouse.find((w: any) => w.id === itemId);
      if (!item || item.type !== 'collector') return 0;
      return collectorValue(item, { sellMult: 1 + state.bonus.sellMult });
    },

    // ======================================================================
    //  COSMÉTICOS
    // ======================================================================

    equipCosmetic: (slot: 'title' | 'frame' | 'banner', cosmeticId: string) => {
      handleUserActivity();
      if (!state.cosmetics.unlocked.includes(cosmeticId)) return false;
      state.cosmetics[slot] = cosmeticId;
      onUpdate(state, isAfk);
      saveToFirebase();
      return true;
    },

    /** Marca un cosmético como desbloqueado. Idempotente. */
    unlockCosmetic: (cosmeticId: string) => desbloquearCosmetico(cosmeticId),

    // ======================================================================
    //  CAPACIDADES EFECTIVAS (la UI debe usar estas, no el valor base)
    // ======================================================================

    getCapacity: () => effectiveWarehouseCapacity(),
    /**
     * ¿Cabe este producto en el almacén?
     *
     * Lo lee la tienda para decidir si el botón va como "Almacén lleno". Va aquí
     * y no en la vista porque es la misma pregunta que se hace `buyStoreItem`
     * antes de cobrar: si las dos no coinciden, el jugador ve un botón apagado
     * para algo que sí podría comprar, o uno encendido que al pulsarlo no da
     * nada.
     */
    canBuyStoreItem: (itemKey: string): boolean => cabeLaCompra(itemKey),
    getCompanionSlots: () => effectiveCompanionSlots(),
    getAfkDurationMs: () => afkCardDurationMs(),

    cleanup: async () => {
      if (gameInterval) clearInterval(gameInterval);
      clearInterval(saveInterval);
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handlePresenceChange);
      window.removeEventListener('focus', handlePresenceChange);
      window.removeEventListener('blur', handlePresenceChange);
      window.removeEventListener('pageshow', handlePresenceChange);
      window.removeEventListener('pagehide', handlePresenceChange);
      docWithLifecycle.removeEventListener('freeze', handlePresenceChange);
      docWithLifecycle.removeEventListener('resume', handlePresenceChange);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      // Los de la cola. Sin estos, cerrar sesión y volver a entrar dejaba tres
      // manejadores apuntando al bucle anterior, y un `online` disparaba un
      // guardado de una partida que ya no existía.
      window.removeEventListener('online', reintentarSiHayCola);
      window.removeEventListener('focus', reintentarSiHayCola);
      window.removeEventListener('pageshow', reintentarSiHayCola);
      await saveToFirebase();
    },

    /**
     * Guarda sin detener nada.
     *
     * Existe para el cierre de sesión: `cleanup` para los timers, pero ahí el
     * guardado ocurre DESPUÉS de quitar los escuchas y justo antes de cerrar
     * la sesión de Firebase, que ya deja `setDoc` sin permiso. `flush` fuerza
     * la escritura mientras la sesión sigue viva.
     */
    flush: () => {
      void saveToFirebase();
    }
  };

  return estado;
}
