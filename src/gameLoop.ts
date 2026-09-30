import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { rollCrateReward } from './components/crateLoot';
import { showToast } from './utils/toast';
import { evaluateAchievements, createAchievementState, ACHIEVEMENTS, type Achievement } from './achievements';
import type { AchievementId } from './data/achievements';

function formatNumber(num: number): string {
  const floored = Math.floor(num);
  if (floored >= 1e9) return (floored / 1e9).toFixed(2) + ' B';
  if (floored >= 1e6) return (floored / 1e6).toFixed(2) + ' M';
  if (floored >= 1e3) return (floored / 1e3).toFixed(2) + ' K';
  return floored.toString();
}

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
  warehouseSlot: { cost: 500, label: 'Ampliar Almacén (+5 slots)' },
  commonCrate: { cost: 400, label: 'Caja Común' },
  rareCrate: { cost: 1200, label: 'Caja Rara' },
  epicCrate: { cost: 4500, label: 'Caja Épica' },
  legendaryCrate: { cost: 18000, label: 'Caja Legendaria' },
  clickBuff: { cost: 800, durationMs: 30 * 60 * 1000, label: 'Buff Clicks x2 (30m)' },
  passiveBuff: { cost: 1500, durationMs: 60 * 60 * 1000, label: 'Buff Pasivo x2 (1h)' },
  // Nuevos items
  backpackExpander: { cost: 20000, label: 'Expansor de Almacén (+1 slot)' },
  companionSlot1: { cost: 1200, label: 'Slot de Compañero 2' },
  companionSlot2: { cost: 16000, label: 'Ranura de Escuadrón (+3 slots)' },
  afkCard: { cost: 10000, label: 'Tarjeta AFK Básica (10 min, acumulable x3)' },
  clickX2Card: { cost: 5000, durationMs: 30000, label: 'Tarjeta Click x2 (30s)' },
  clickX3Card: { cost: 15000, durationMs: 30000, label: 'Tarjeta Click x3 (30s)' },
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
  weaponCardT1: { cost: 1000, label: 'Arma Tier 1' },
  weaponCardT2: { cost: 1500, label: 'Arma Tier 2' },
  weaponCardT3: { cost: 2250, label: 'Arma Tier 3' },
  weaponCardT4: { cost: 3400, label: 'Arma Tier 4' },
  weaponCardT5: { cost: 5100, label: 'Arma Tier 5' },
  weaponCardT6: { cost: 7600, label: 'Arma Tier 6' },
  weaponCardT7: { cost: 11500, label: 'Arma Tier 7' },
  weaponCardT8: { cost: 17200, label: 'Arma Tier 8' },
  weaponCardT9: { cost: 25800, label: 'Arma Tier 9' },
  weaponCardT10: { cost: 39000, label: 'Arma Tier 10' }
};

// Coste de cada slot de compañero adicional (índice = slots ya poseídos).
// 5 slots es el techo: es lo que hace que los slots valgan más que los tiers.
export const COMPANION_SLOT_COSTS = [0, 1200, 4500, 16000, 55000];

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
  clickX3Card: { name: 'Tarjeta Click x3', details: 'Otorga x3 al click por 30 segundos', rarity: 'Épico', buffId: 'clickX3' }
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

// Sistema de Tiers para compañeros y armas.
//
// Curva de poder POR TIER (no por nivel). Antes cada tier daba +5 fijos mientras
// el coste se duplicaba: el coste por punto de poder pasaba de 667 (T1) a 21.333
// (T10), 32x peor, así que el jugador óptimo solo compraba T1 y los tiers altos
// eran trampas. Ahora el poder crece ~1.62x por tier, ligeramente por encima
// del 1.5x del coste, para que subir de tier siga mereciendo la pena.
export const TIER_POWER = [
  { tier: 1, base: 6 },
  { tier: 2, base: 10 },
  { tier: 3, base: 16 },
  { tier: 4, base: 26 },
  { tier: 5, base: 42 },
  { tier: 6, base: 68 },
  { tier: 7, base: 110 },
  { tier: 8, base: 178 },
  { tier: 9, base: 288 },
  { tier: 10, base: 466 }
];

export const TIER_SYSTEM = {
  // Rango de poder por tier: [min, max]
  ranges: {
    1: [5, 7],
    2: [8, 12],
    3: [13, 19],
    4: [21, 31],
    5: [34, 50],
    6: [55, 81],
    7: [88, 132],
    8: [142, 214],
    9: [230, 346],
    10: [373, 559]
  } as Record<number, [number, number]>,
  // Nombres de compañeros por tier (de base a imponente)
  companionNames: {
    1: ['Dron Explorador', 'Dron Centinela', 'Dron Mensajero'],
    2: ['Cazador Nocturno', 'Rastreador Fantasma', 'Explorador Estelar'],
    3: ['Guerrero Mecánico', 'Titán de Acero', 'Coloso de Batalla'],
    4: ['Señor de la Guerra', 'Destruyente Imperial', 'Aniquilador Prime'],
    5: ['Avatar del Caos', 'Heraldo del Vacío', 'Portador del Trueno'],
    6: ['Supremo Estratega', 'Maestro de Batallas', 'General Supremo'],
    7: ['Forjador de Mundos', 'Creador de Imperios', 'Arquitecto Cósmico'],
    8: ['Devorador de Estrellas', 'Señor del Tiempo', 'Amo del Espacio'],
    9: ['Entidad Primordial', 'Ser Trascendente', 'Conciencia Universal'],
    10: ['Dios de la Guerra', 'El Omnipotente', 'El Infinito']
  },
  // Nombres de armas por tier
  weaponNames: {
    1: ['Blaster Láser', 'Pistola de Plasma', 'Rifle de Pulso'],
    2: ['Cañón de Partículas', 'Lanzador de Energía', 'Desintegrador Táctico'],
    3: ['Aniquilador Cuántico', 'Devorador de Materia', 'Coloso de Fuego'],
    4: ['Guadaña del Vacío', 'Maldición Estelar', 'Juicio Final'],
    5: ['Apocalipsis', 'Armagedón', 'Ragnarök'],
    6: ['Excalibur', 'Mjolnir', 'Gungnir'],
    7: ['Lanza del Destino', 'Espada del Crepúsculo', 'Hacha del Caos'],
    8: ['Corte del Tiempo', 'Filo del Infinito', 'Navaja Cósmica'],
    9: ['Arma del Apocalipsis', 'Instrumento de la Muerte', 'Herencia de los Dioses'],
    10: ['El Principio y El Fin', 'La Última Palabra', 'El Todo y La Nada']
  },
  // Rareza por tier
  rarityByTier: {
    1: 'Común',
    2: 'Común',
    3: 'Raro',
    4: 'Raro',
    5: 'Épico',
    6: 'Épico',
    7: 'Legendario',
    8: 'Legendario',
    9: 'Mítico',
    10: 'Divino'
  }
};

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
        updatedAt: new Date()
      });
      // Crear documento de ranking
      await setDoc(rankingRef, {
        userId: user.uid,
        username: user.displayName || 'Operativo',
        score: state.nanites,
        totalClicks: 0,
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
      if (!exists && state.warehouse.length < state.warehouseCapacity) {
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
    if (state.warehouse.length <= state.warehouseCapacity) return;

    const score = (w: any): number => {
      if (w.id === state.equippedWeaponId) return 1000;
      if (w.equipped) return 900;
      if (state.activeCompanions.includes(w.id)) return 800;
      if (w.type === 'weapon') return 500 + (w.tier || 0);
      if (w.type === 'companion') return 400 + (w.tier || 0);
      if (w.type === 'crate') return 300;
      if (w.type === 'consumable') return 200;
      return 100;
    };

    // Mantiene los mejor valorados; ante empate, los más antiguos
    const kept = state.warehouse
      .map((w: any, index: number) => ({ w, index, s: score(w) }))
      .sort((a, b) => (b.s - a.s) || (a.index - b.index))
      .slice(0, state.warehouseCapacity)
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
      const free = state.warehouseCapacity - state.warehouse.length;
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
    // El bonus de logros entra aquí: son pasivos, noNanitas directas
    const withAchievements = base * state.passiveMultiplier * (1 + achievementState.passiveBonus);
    state.passiveIncome = Math.floor(withAchievements);
  }

  function calculateClickDamage() {
    if (!state.equippedWeaponId) return 0;
    const item = state.warehouse.find((w: any) => w.id === state.equippedWeaponId);
    if (!item) return 0;

    const baseDmg = item.damage || 0;
    const levelMultiplier = 1 + ((item.level || 0) * 0.10);
    const total = baseDmg * levelMultiplier * calculateCompanionMultiplier() * (1 + achievementState.clickBonus);
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
      const cost = 500;
      if (state.nanites >= cost && state.warehouse.length < 50) {
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
      if (state.maxCompanionSlots >= 5) return false;
      const cost = COMPANION_SLOT_COSTS[state.maxCompanionSlots];
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
        if (state.activeCompanions.length < state.maxCompanionSlots) {
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
        if (state.activeCompanions.length < state.maxCompanionSlots) {
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
      if (!item || state.nanites < item.cost) return false;

      // Validar antes de cobrar: los slots son únicos y no se pueden repetir
      if (itemKey === 'companionSlot1' && state.maxCompanionSlots !== 1) return false;
      if (itemKey === 'companionSlot2' && state.maxCompanionSlots !== 3) return false;

      // Validar mochila llena (excepto para items que no ocupan espacio en el almacén)
      const needsWarehouseSpace = !['key', 'upgradeCrystal', 'warehouseSlot', 'companionSlot1', 'companionSlot2'].includes(itemKey as string);
      if (needsWarehouseSpace && state.warehouse.length >= state.warehouseCapacity) {
        showToast('⚠️ Almacén lleno. No puedes comprar más items.', 'error');
        return false;
      }

      // Confirmar compra
      // Toast de compra eliminado - la card de item es suficiente

      state.nanites -= item.cost;

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
        if (state.warehouse.length < state.warehouseCapacity) {
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
        if (state.warehouse.length < state.warehouseCapacity) {
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
        if (state.warehouse.length < state.warehouseCapacity) {
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
        hasSpace: () => state.warehouse.length < state.warehouseCapacity,
        addItem: (item) => {
          if (state.warehouse.length >= state.warehouseCapacity) return false;
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
