import { showToast } from './utils/toast';
import { formatNumber } from './utils/format';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
import { attemptForge, AFFIX_BY_ID } from './data/crafting';
import { sellPrice, weaponValue } from './data/valuation';


// Antes esto era un modal con botón "Aceptar" para avisos como "Almacén lleno":
// bloqueaba la partida por un mensaje informativo. Ahora es un toast no bloqueante.

const SAVE_VERSION = 6;
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
  // Armas: el precio sigue al DAÑO, no al número de tier.
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
  weaponCardT1: { cost: 850, label: 'Arma Tier 1' },
  weaponCardT2: { cost: 1600, label: 'Arma Tier 2' },
  weaponCardT3: { cost: 2500, label: 'Arma Tier 3' },
  weaponCardT4: { cost: 3700, label: 'Arma Tier 4' },
  weaponCardT5: { cost: 5300, label: 'Arma Tier 5' },
  weaponCardT6: { cost: 7200, label: 'Arma Tier 6' },
  weaponCardT7: { cost: 9400, label: 'Arma Tier 7' },
  weaponCardT8: { cost: 11900, label: 'Arma Tier 8' },
  weaponCardT9: { cost: 14600, label: 'Arma Tier 9' },
  weaponCardT10: { cost: 17500, label: 'Arma Tier 10' }
};

// Coste de cada slot de compañero adicional (índice = slots ya poseídos).
// 5 slots es el techo: es lo que hace que los slots valgan más que los tiers.
// Se llega hasta 9 slots: 5 de tienda + hasta 4 del nodo "Cuadrilla".
export const COMPANION_SLOT_COSTS = [0, 1200, 4500, 16000, 55000, 180_000, 520_000, 1_400_000, 3_600_000, 9_000_000];

// Mejora de arma: 20 niveles, coste creciente en cristales y éxito decreciente.
export const MAX_WEAPON_LEVEL = 20;
export function weaponUpgradeCost(level: number): number {
  // 1,1,2,2,3,3,4,5,6,7,8,9,11,13,15,18,21,25,30,35 -> ~190 cristales en total
  return Math.max(1, Math.floor(1.2 * Math.pow(1.14, level)));
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
  stabilityNano: { name: 'Nanopartícula de Estabilidad', details: 'Deja el arma forjada con un afijo extra garantizado', rarity: 'Legendario', buffId: 'stabilityNano' }
} as const;

// Definición de cada tipo de caja. La fuente de verdad es el item del almacén,
// `state.crates` se mantiene sincronizado como contador para las migraciones.
const CRATE_TYPES = {
  common: { name: 'Caja Común', rarity: 'Común', details: 'Contiene recompensas básicas' },
  rare: { name: 'Caja Rara', rarity: 'Raro', details: 'Contiene recompensas mejores' },
  epic: { name: 'Caja Épica', rarity: 'Épico', details: 'Contiene recompensas altas' },
  legendary: { name: 'Caja Legendaria', rarity: 'Legendario', details: 'Contiene recompensas máximas' }
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

// Función para generar un arma aleatoria por tier
export function generateWeaponByTier(tier: number): { id: string; name: string; type: string; details: string; rarity: string; tier: number; level: number; damage: number } {
  const range = TIER_SYSTEM.ranges[tier as keyof typeof TIER_SYSTEM.ranges] || [1, 5];
  const power = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  const names = TIER_SYSTEM.weaponNames[tier as keyof typeof TIER_SYSTEM.weaponNames] || ['Blaster Láser'];
  const name = names[Math.floor(Math.random() * names.length)];
  const rarity = TIER_SYSTEM.rarityByTier[tier as keyof typeof TIER_SYSTEM.rarityByTier] || 'Común';
  
  return {
    id: `weapon_t${tier}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    type: 'weapon',
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
  const displayName = user.displayName || username || '';
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
    forgedCount: 0, // Armas forjadas con exito
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
    afkCards: 0, // Tarjetas AFK acumuladas (máx 3)
    afkExpiresAt: 0, // Tiempo de expiración del buff AFK (10 min por tarjeta)
    crates: {
      common: 2,
      rare: 0,
      epic: 0,
      legendary: 0
    },
    equippedWeaponId: null as string | null,
    companions: [baseCompanion] as Array<{ id: string; name: string; type: 'click' | 'passive' | 'multiplier'; power: number; rarity: string; tier?: number }>,
    activeCompanions: [] as string[],
    warehouse: [
      { id: 'weapon_blaster_001', name: 'Blaster Láser', type: 'weapon', details: 'Recolección por click: +5', rarity: 'Común', tier: 1, level: 0, damage: 5, sellPrice: 250 },
      { id: 'companion_base_001', name: 'Dron Explorador', type: 'companion', details: 'Recolección por segundo: +5/s', rarity: 'Común', tier: 1, sellPrice: 250 }
    ] as Array<{ id: string; name: string; type: string; details: string; rarity: string; tier?: number; level?: number; damage?: number; equipped?: boolean; sellPrice?: number; stackable?: boolean; stackCount?: number }>,
    buffs: {
      clickBoostExpiresAt: 0,
      passiveBoostExpiresAt: 0,
      clickX2ExpiresAt: 0, // Tarjeta Click x2 (30s)
      clickX3ExpiresAt: 0  // Tarjeta Click x3 (30s)
    }
  };

  let isAfk = false;
  let lastActiveTimestamp = Date.now();
  // Momento (reloj monótono) en que el jugador dejó de estar presente en la pantalla.
  // 0 = está presente. Se usa performance.now() porque no lo afecta cambiar la
  // hora del sistema, a diferencia de Date.now().
  let awayAt = 0;
  const AFK_THRESHOLD_MS = 45000;

  const userRef = doc(db, 'users', user.uid);
  const rankingRef = doc(db, 'rankings', user.uid);

  try {
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
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
      state.equippedWeaponId = data.equippedWeaponId ?? null;
      state.companions = data.companions ?? [];
      state.activeCompanions = data.activeCompanions ?? [];
      state.warehouse = data.warehouse ?? [];
      // Migración: agregar 'damage' y actualizar descripción a armas viejas
      let warehouseNeedsMigration = false;
      state.warehouse.forEach((w: any) => {
        if (w.type === 'weapon') {
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
        // Migración: consumibles antigos sin buffId (creados antes de existir el campo)
        if (w.type === 'consumable' && !w.buffId) {
          const buffId = inferBuffIdFromName(w.name || '');
          if (buffId) {
            w.buffId = buffId;
            warehouseNeedsMigration = true;
          }
        }
      });
      if (warehouseNeedsMigration) {
        saveToFirebase();
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
      recalculatePassiveIncome();
    } else {
      // Crear documento del usuario
      await setDoc(userRef, {
        saveVersion: SAVE_VERSION,
        userId: user.uid,
        username: user.displayName || 'Operativo',
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
        equippedWeaponId: state.equippedWeaponId,
        companions: state.companions,
        activeCompanions: state.activeCompanions,
        warehouse: state.warehouse,
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
      if (!exists && state.warehouse.length < effectiveWarehouseCapacity()) {
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
   * Recorta el almacén respetando una prioridad. Antes se hacía
   * `slice(0, capacity)`, que destruía el último item de la lista sin aviso y
   * podía borrar el arma equipada o un compañero activo.
   *
   * Prioridad de conservación:-inducing el arma equipada, los compañeros activos
   * y los companions con item. Lo que se descarta es lo más reciente y menos
   * ligado a la progresión.
   */
  function enforceWarehouseCapacity() {
    const capacity = effectiveWarehouseCapacity();
    if (state.warehouse.length <= capacity) return;

    const score = (w: any): number => {
      if (w.id === state.equippedWeaponId) return 1000;
      if (w.equipped) return 900;
      if (state.activeCompanions.includes(w.id)) return 800;
      // Un arma crafteada vale más que una de tienda: se conserva antes
      if (w.type === 'weapon') return 500 + (w.tier || 0) + (w.potential || 0) * 50;
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

  // `state.crates` es un contador derivado: el almacén es la fuente de verdad.
  // Convierte contadores huérfanos de saves antiguos en items reales.
  function syncCrateCounters() {
    const counts: Record<CrateType, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };

    state.warehouse.forEach((w: any) => {
      if (w.type !== 'crate') return;
      const crateType = getCrateTypeFromName(w.name || '');
      if (!crateType) return;
      // Un item apilado (stackCount) representa varias cajas
      counts[crateType] += (w.stackCount || 1);
    });

    (Object.keys(CRATE_TYPES) as CrateType[]).forEach(crateType => {
      const missing = (state.crates[crateType] || 0) - counts[crateType];
      if (missing <= 0) return;
      // Materializar lo que falte, respetando la capacidad del almacén
      const free = effectiveWarehouseCapacity() - state.warehouse.length;
      const toCreate = Math.min(missing, Math.max(0, free));
      for (let i = 0; i < toCreate; i++) {
        state.warehouse.push(createCrateItem(crateType) as any);
      }
      counts[crateType] += toCreate;
    });

    state.crates = counts;
  }

  // Actualiza el contador de tarjetas AFK a partir de las que hay en el almacén
  function refreshAfkCardCount() {
    state.afkCards = state.warehouse.filter((w: any) => w.name.includes('AFK')).length;
  }

  // Sincronizar compañeros con el warehouse después de inicializar
  recomputeBonuses();
  rebuildAchievementBonuses();
  syncCompanionsToWarehouse();
  syncCrateCounters();
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
   * Bonificaciones de los afijos del arma equipada. Se suman al daño aquí y no
   * se hornean en `item.damage`: si se guardaran, vender y volver a comprar el
   * mismo objeto cambiaría su estadística.
   */
  function equippedAffixEffect(): { clickMult: number; passiveMult: number; flat: number } {
    const out = { clickMult: 0, passiveMult: 0, flat: 0 };
    if (!state.equippedWeaponId) return out;
    const item: any = state.warehouse.find((w: any) => w.id === state.equippedWeaponId);
    if (!item?.affixes?.length) return out;
    for (const affixId of item.affixes) {
      const affix = AFFIX_BY_ID[affixId];
      if (!affix) continue;
      out.clickMult += affix.effect.clickMult || 0;
      out.passiveMult += affix.effect.passiveMult || 0;
      // Los afijos planos escalan con el nivel del arma: es lo que hace que
      // subir un arma crafteada siga valiendo algo.
      out.flat += (affix.effect.flatDamage || 0) * (1 + (item.level || 0) * 0.08);
    }
    return out;
  }

  function calculateClickDamage() {
    if (!state.equippedWeaponId) return 0;
    const item: any = state.warehouse.find((w: any) => w.id === state.equippedWeaponId);
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
    try {
      const gameData = {
        saveVersion: SAVE_VERSION,
        userId: user.uid,
        username: user.displayName || 'Operativo',
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
        equippedWeaponId: state.equippedWeaponId,
        companions: state.companions,
        activeCompanions: state.activeCompanions,
        warehouse: state.warehouse,
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
    } catch (error) {
      console.error("Error al guardar en Firebase:", error);
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

  return {
    getState: () => state,
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
    updateState: (newState: any) => {
      Object.assign(state, newState);
      enforceWarehouseCapacity();
      syncCompanionsToWarehouse();
      syncCrateCounters();
      refreshAfkCardCount();
      rebuildAchievementBonuses();
      recalculatePassiveIncome();
      checkAchievements();
      onUpdate(state, isAfk);
      saveToFirebase();
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
    upgradeEquippedWeapon: () => {
      handleUserActivity();
      if (!state.equippedWeaponId) return { success: false, msg: 'No hay ningún arma equipada.' };
      const item = state.warehouse.find((w: any) => w.id === state.equippedWeaponId);
      if (!item) return { success: false, msg: 'Arma no encontrada.' };
      const level = item.level || 0;
      if (level >= MAX_WEAPON_LEVEL) return { success: false, msg: `Arma al nivel máximo (+${MAX_WEAPON_LEVEL * 10}%).` };

      // Coste en cristales creciente: antes era 1 por nivel, así que 20 niveles
      // salían por 20 cristales y el timing de mejora era irrelevante
      const crystalCost = weaponUpgradeCost(level);
      if (state.upgradeCrystals < crystalCost) {
        return { success: false, msg: `Requiere ${crystalCost} Cristales de Mejora (tienes ${state.upgradeCrystals}).` };
      }

      state.upgradeCrystals -= crystalCost;

      // Probabilidad de éxito: alta al principio, se estrecha al final
      const successChance = Math.max(35, 95 - level * 3);
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
    toggleCompanionActive: (compId: string) => {
      handleUserActivity();
      const index = state.activeCompanions.indexOf(compId);
      if (index > -1) {
        state.activeCompanions.splice(index, 1);
      } else {
        // Verificar si hay espacio disponible
        if (state.activeCompanions.length < effectiveCompanionSlots()) {
          // Insertar en el primer slot vacío (mantener orden)
          state.activeCompanions.push(compId);
          state.activeCompanions.sort((a, b) => {
            const compA = state.companions.find((c: any) => c.id === a);
            const compB = state.companions.find((c: any) => c.id === b);
            return (compA?.tier || 0) - (compB?.tier || 0);
          });
        } else {
          // No hay espacio, no se puede equipar
          return false;
        }
      }
      recalculatePassiveIncome();
      onUpdate(state, isAfk);
      saveToFirebase();
      return true;
    },
    equipCollector: (itemId: string) => {
      handleUserActivity();
      // Buscar el item en el warehouse
      const item = state.warehouse.find((w: any) => w.id === itemId);
      if (!item || item.type !== 'weapon') return false;

      // Si ya está equipado, desequiparlo
      if (item.equipped) {
        item.equipped = false;
        state.equippedWeaponId = null;
        onUpdate(state, isAfk);
        saveToFirebase();
        return true;
      }

      // Desequipar cualquier arma equipada actualmente
      state.warehouse.forEach((w: any) => {
        if (w.type === 'weapon') w.equipped = false;
      });

      // Equipar el nuevo item
      item.equipped = true;
      state.equippedWeaponId = item.id;
      onUpdate(state, isAfk);
      saveToFirebase();
      return true;
    },
    equipCompanion: (compId: string) => {
      handleUserActivity();
      const index = state.activeCompanions.indexOf(compId);
      if (index > -1) {
        state.activeCompanions.splice(index, 1);
      } else {
        if (state.activeCompanions.length < effectiveCompanionSlots()) {
          state.activeCompanions.push(compId);
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

      // Validar mochila llena (excepto para items que no ocupan espacio en el almacén)
      const needsWarehouseSpace = !['key', 'upgradeCrystal', 'warehouseSlot', 'companionSlot1', 'companionSlot2'].includes(itemKey as string);
      if (needsWarehouseSpace && state.warehouse.length >= effectiveWarehouseCapacity()) {
        showToast('Almacén lleno. No puedes comprar más items.', 'error');
        return false;
      }

      state.nanites -= cost;

      if (itemKey === 'key') {
        state.keys += 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { id: `key_${Date.now()}`, name: 'Llave', type: 'key', details: 'Abre cajas en el almacén', rarity: 'Común', tier: 0 };
      } else if (itemKey === 'upgradeCrystal') {
        state.upgradeCrystals += 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { id: `crystal_${Date.now()}`, name: 'Cristal de Mejora', type: 'crystal', details: 'Mejora el arma equipada', rarity: 'Raro', tier: 0 };
      } else if (itemKey === 'warehouseSlot') {
        state.warehouseCapacity += 5;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { id: `slot_${Date.now()}`, name: 'Espacio de Almacén', type: 'upgrade', details: '+5 espacios de almacén', rarity: 'Raro', tier: 0 };
      } else if (itemKey === 'commonCrate' || itemKey === 'rareCrate' || itemKey === 'epicCrate' || itemKey === 'legendaryCrate') {
        // La caja es un item real del almacén: sin esto no se puede abrir
        const crateType = itemKey.replace('Crate', '').toLowerCase() as CrateType;
        const warehouseItem = createCrateItem(crateType);
        state.warehouse.push(warehouseItem as any);
        syncCrateCounters();
        onUpdate(state, isAfk);
        saveToFirebase();
        return warehouseItem;
      } else if (CONSUMABLES[itemKey as keyof typeof CONSUMABLES]) {
        if (state.warehouse.length < effectiveWarehouseCapacity()) {
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
          state.warehouse.push(warehouseItem as any);
          refreshAfkCardCount();
          onUpdate(state, isAfk);
          saveToFirebase();
          return warehouseItem;
        }
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
        if (state.warehouse.length < effectiveWarehouseCapacity()) {
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
          state.warehouse.push(warehouseItem);
          onUpdate(state, isAfk);
          saveToFirebase();
          return warehouseItem;
        }
      } else if (itemKey.startsWith('weaponCardT')) {
        const tier = parseInt(itemKey.replace('weaponCardT', ''));
        const weapon = generateWeaponByTier(tier);
        if (state.warehouse.length < effectiveWarehouseCapacity()) {
          const warehouseItem = {
            ...weapon,
            sellPrice: Math.floor(item.cost / 4)
          };
          state.warehouse.push(warehouseItem);
          onUpdate(state, isAfk);
          saveToFirebase();
          return warehouseItem;
        }
      }

      // Si llegamos aquí el item no ocupa espacio (llave, cristal, slot, +5 almacén).
      // La compra ya está cobrada, así que se devuelve true sin item que mostrar.

      onUpdate(state, isAfk);
      saveToFirebase();
      return true;
    },
    openCrateBox: (crateType: CrateType) => {
      handleUserActivity();
      if (state.keys < 1 || state.crates[crateType] < 1) return null;

      state.keys -= 1;
      state.crates[crateType] -= 1;
      state.cratesOpened += 1;

      // El botin lo decide la tabla (crateLoot) y se aplica aqui. La ruleta solo
      // lo muestra: si la animacion decidiera, mentiria sobre las probabilidades.
      const reward = rollCrateReward(crateType, {
        nanites: (n) => { state.nanites += n; },
        crystals: (n) => { state.upgradeCrystals += n; },
        keys: (n) => { state.keys += n; },
        hasSpace: () => state.warehouse.length < effectiveWarehouseCapacity(),
        addItem: (item) => {
          if (state.warehouse.length >= effectiveWarehouseCapacity()) return false;
          state.warehouse.push(item as any);
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

      syncCrateCounters();
      recalculatePassiveIncome();
      onUpdate(state, isAfk);
      saveToFirebase();
      return reward;
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
     * Recicla el progreso: devuelve nanitas, armas, compañeros e infraestructura
     * a cambio de núcleos.
     *
     * Un detalle que parece obvio y no lo es: las armas que el jugador ya
     * forjó también se pierden, porque viven en el almacén. Se conserva a
     * propósito solo lo que importa como identidad (cuántas forjó), no el
     * inventario. Si se conservaran los objetos, la forja dejaría de ser una
     * apuesta y `forgedCount` no significaría nada.
     *
     * Lo que NO se pierde: núcleos, nodos del árbol, cosméticos, logros,
     * esquirlas y el contador de armas forjadas. Esa es toda la promesa del
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
      const keptTotalCores = state.totalCores;
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
        equippedWeaponId: null,
        companions: [baseCompanion],
        activeCompanions: [],
        warehouse: [
          { id: 'weapon_blaster_001', name: 'Blaster Láser', type: 'weapon', details: 'Recolección por click: +5', rarity: 'Común', tier: 1, level: 0, damage: 5, sellPrice: 250 },
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
      syncCrateCounters();
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
     * Fusiona 3 armas del mismo tier en una de tier+1.
     * `stonesUsed` es cuántas Piedras de Calibración se consumen: cada una
     * sube 12 puntos la probabilidad, hasta 5.
     */
    forgeWeapon: (materialIds: string[], stonesUsed = 0, nanoUsed = 0) => {
      handleUserActivity();
      if ((state.nodeLevels.blueprint || 0) < 1) {
        return { success: false, msg: 'Necesitas el nodo "Planos Viejos" para craftear.' };
      }
      if (materialIds.length !== 3) {
        return { success: false, msg: 'Selecciona exactamente 3 armas.' };
      }
      const materials = materialIds
        .map(id => state.warehouse.find((w: any) => w.id === id))
        .filter((w: any): w is any => !!w);
      if (materials.length !== 3) return { success: false, msg: 'Material no encontrado.' };
      if (materials.some((m: any) => m.type !== 'weapon')) {
        return { success: false, msg: 'Solo se pueden fusionar armas.' };
      }
      const tier = materials[0].tier || 1;
      if (materials.some((m: any) => (m.tier || 1) !== tier)) {
        return { success: false, msg: 'Las 3 armas deben ser del mismo tier.' };
      }
      // El arma equipada no se puede consumir: perderla sería un castigo doble
      if (materials.some((m: any) => m.equipped || m.id === state.equippedWeaponId)) {
        return { success: false, msg: 'No puedes fusionar el arma equipada. Desequípala primero.' };
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

      if (result.success && result.weapon) {
        const w = result.weapon;
        w.sellPrice = sellPrice(w as any, { sellMult: 1 + state.bonus.sellMult });
        // Restar 2 y devolver 1 en lugar de perder las tres: la tensión se
        // mantiene (pierdes 2 armas) sin que un mal rollo vacíe el almacén.
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
          weapon: w,
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

    /** Precio de venta actual del item, con la bonificación del árbol. */
    getSellPrice: (itemId: string): number => {
      const item: any = state.warehouse.find((w: any) => w.id === itemId);
      if (!item) return 0;
      if (item.type === 'weapon') {
        return sellPrice(item, { sellMult: 1 + state.bonus.sellMult });
      }
      return Math.floor((item.sellPrice || 0) * (1 + state.bonus.sellMult));
    },

    getWeaponValue: (itemId: string) => {
      const item: any = state.warehouse.find((w: any) => w.id === itemId);
      if (!item || item.type !== 'weapon') return 0;
      return weaponValue(item, { sellMult: 1 + state.bonus.sellMult });
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
    unlockCosmetic: (cosmeticId: string) => {
      if (state.cosmetics.unlocked.includes(cosmeticId)) return false;
      state.cosmetics.unlocked.push(cosmeticId);
      return true;
    },

    // ======================================================================
    //  CAPACIDADES EFECTIVAS (la UI debe usar estas, no el valor base)
    // ======================================================================

    getCapacity: () => effectiveWarehouseCapacity(),
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
      await saveToFirebase();
    }
  };
}
