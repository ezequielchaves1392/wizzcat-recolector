import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

function formatNumber(num: number): string {
  const floored = Math.floor(num);
  if (floored >= 1e9) return (floored / 1e9).toFixed(2) + ' B';
  if (floored >= 1e6) return (floored / 1e6).toFixed(2) + ' M';
  if (floored >= 1e3) return (floored / 1e3).toFixed(2) + ' K';
  return floored.toString();
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  // Usar modal de confirmación en lugar de toast flash
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
  overlay.id = 'toast-modal-overlay';
  const modal = document.createElement('div');
  const colors = {
    success: 'border-emerald-500/40 text-emerald-300',
    error: 'border-red-500/40 text-red-300',
    info: 'border-blue-500/40 text-blue-300'
  };
  modal.className = `card-glass border rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 ${colors[type]}`;
  const messageEl = document.createElement('p');
  messageEl.className = 'text-sm font-mono text-center';
  messageEl.textContent = message;
  const btn = document.createElement('button');
  btn.className = 'py-2.5 accent-bg text-slate-950 font-[\'Orbitron\'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer';
  btn.textContent = 'Aceptar';
  btn.addEventListener('click', () => overlay.remove());
  modal.appendChild(messageEl);
  modal.appendChild(btn);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  // Cerrar con Escape
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

const SAVE_VERSION = 6;
const MAX_BUFF_DURATION_MS = 8 * 60 * 60 * 1000;
const MAX_CARD_BUFF_DURATION_MS = 30 * 60 * 1000; // Máximo 30 minutos para buffs de tarjetas
const MAX_STACK_SIZE = 100;

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
  passiveBuff: { cost: 1500, durationMs: 60 * 60 * 1000, label: 'Buff Pasivo x2 + Excepción AFK (1h)' },
  // Nuevos items
  backpackExpander: { cost: 20000, label: 'Expansor de Almacén (+1 slot)' },
  companionSlot1: { cost: 50000, label: 'Slot de Compañero 1' },
  companionSlot2: { cost: 200000, label: 'Slot de Compañero 2' },
  afkCard: { cost: 10000, label: 'Tarjeta AFK Básica (10 min, acumulable x3)' },
  clickX2Card: { cost: 5000, durationMs: 30000, label: 'Tarjeta Click x2 (30s)' },
  clickX3Card: { cost: 15000, durationMs: 30000, label: 'Tarjeta Click x3 (30s)' },
  companionCardT1: { cost: 2000, label: 'Compañero Tier 1' },
  companionCardT2: { cost: 4000, label: 'Compañero Tier 2' },
  companionCardT3: { cost: 8000, label: 'Compañero Tier 3' },
  companionCardT4: { cost: 16000, label: 'Compañero Tier 4' },
  companionCardT5: { cost: 32000, label: 'Compañero Tier 5' },
  companionCardT6: { cost: 64000, label: 'Compañero Tier 6' },
  companionCardT7: { cost: 128000, label: 'Compañero Tier 7' },
  companionCardT8: { cost: 256000, label: 'Compañero Tier 8' },
  companionCardT9: { cost: 512000, label: 'Compañero Tier 9' },
  companionCardT10: { cost: 1024000, label: 'Compañero Tier 10' },
  weaponCardT1: { cost: 1000, label: 'Arma Tier 1' },
  weaponCardT2: { cost: 2000, label: 'Arma Tier 2' },
  weaponCardT3: { cost: 4000, label: 'Arma Tier 3' },
  weaponCardT4: { cost: 8000, label: 'Arma Tier 4' },
  weaponCardT5: { cost: 16000, label: 'Arma Tier 5' },
  weaponCardT6: { cost: 32000, label: 'Arma Tier 6' },
  weaponCardT7: { cost: 64000, label: 'Arma Tier 7' },
  weaponCardT8: { cost: 128000, label: 'Arma Tier 8' },
  weaponCardT9: { cost: 256000, label: 'Arma Tier 9' },
  weaponCardT10: { cost: 512000, label: 'Arma Tier 10' }
};

export const COMPANION_SLOT_COSTS = [0, 1000, 5000, 20000, 75000];

// Sistema de Tiers para compañeros y armas
export const TIER_SYSTEM = {
  // Rango de clicks/seg por tier: [min, max]
  ranges: {
    1: [1, 5],
    2: [5, 10],
    3: [10, 15],
    4: [15, 20],
    5: [20, 25],
    6: [25, 30],
    7: [30, 35],
    8: [35, 40],
    9: [40, 45],
    10: [45, 50]
  },
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

export async function createGameLoop(user: any, onUpdate: (state: any, isAfkPaused?: boolean) => void, username?: string) {
  const baseCompanion = {
    id: 'companion_base_001',
    name: 'Dron Explorador',
    type: 'click' as const,
    power: 1,
    rarity: 'Común'
  };

  // Bonus especial para usuarios de prueba
  const displayName = user.displayName || username || '';
  const isBlanquician = displayName.toLowerCase() === 'blanquician';
  const isAdmin = displayName.toLowerCase() === 'admin';
  const initialNanites = (isBlanquician || isAdmin) ? 100000000 : 0;

  let state = {
    saveVersion: SAVE_VERSION,
    nanites: initialNanites,
    passiveIncome: 0,
    totalClicks: 0,
    totalInfraestructure: 0,
    cratesOpened: 0,
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
      { id: 'weapon_blaster_001', name: 'Blaster Láser', type: 'weapon', details: 'Daño: +1', rarity: 'Común' },
      { id: 'companion_base_001', name: 'Dron Explorador', type: 'companion', details: '+1/s', rarity: 'Común' }
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
  const AFK_THRESHOLD_MS = 45000;

  const userRef = doc(db, 'users', user.uid);
  const rankingRef = doc(db, 'rankings', user.uid);

  try {
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      state.saveVersion = SAVE_VERSION;
      state.nanites = data.nanites ?? 0;
      state.totalClicks = data.totalClicks ?? 0;
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
      });
      if (warehouseNeedsMigration) {
        saveToFirebase();
      }
      state.afkCards = data.afkCards ?? 0;
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
        totalClicks: 0,
        totalInfraestructure: 0,
        cratesOpened: 0,
        keys: state.keys,
        upgradeCrystals: state.upgradeCrystals,
        warehouseCapacity: state.warehouseCapacity,
        maxCompanionSlots: state.maxCompanionSlots,
        afkCards: state.afkCards,
        crates: state.crates,
        equippedWeaponId: state.equippedWeaponId,
        companions: state.companions,
        activeCompanions: state.activeCompanions,
        warehouse: state.warehouse,
        buffs: state.buffs,
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
    // Respetar capacidad máxima
    if (state.warehouse.length > state.warehouseCapacity) {
      state.warehouse = state.warehouse.slice(0, state.warehouseCapacity);
    }
  }

  // Sincronizar compañeros con el warehouse después de inicializar
  syncCompanionsToWarehouse();

  // Guardar inmediatamente al iniciar sesión
  await saveToFirebase();

  function recalculatePassiveIncome() {
    let base = 0;
    // SOLO los compañeros activos suman recursos por segundo
    state.activeCompanions.forEach(compId => {
      const comp = state.companions.find(c => c.id === compId);
      if (comp) {
        base += comp.power;
      }
    });

    if (Date.now() < state.buffs.passiveBoostExpiresAt) {
      base *= 2;
    }
    // Redondear a entero para mantener consistencia
    state.passiveIncome = Math.floor(base);
  }

  function calculateClickDamage() {
    if (!state.equippedWeaponId) return 0;
    const item = state.warehouse.find((w: any) => w.id === state.equippedWeaponId);
    if (!item) return 0;

    const baseDmg = item.damage || 0;
    const levelMultiplier = 1 + ((item.level || 0) * 0.10);
    return Math.floor(baseDmg * levelMultiplier);
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
        totalClicks: state.totalClicks,
        totalInfraestructure: state.totalInfraestructure,
        cratesOpened: state.cratesOpened,
        keys: state.keys,
        upgradeCrystals: state.upgradeCrystals,
        warehouseCapacity: state.warehouseCapacity,
        maxCompanionSlots: state.maxCompanionSlots,
        afkCards: state.afkCards,
        crates: state.crates,
        equippedWeaponId: state.equippedWeaponId,
        companions: state.companions,
        activeCompanions: state.activeCompanions,
        warehouse: state.warehouse,
        buffs: state.buffs,
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

  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Solo marcar AFK si no hay tarjetas AFK activas
      if (state.afkCards <= 0) {
        isAfk = true;
      }
    } else {
      const elapsed = Date.now() - lastActiveTimestamp;
      isAfk = elapsed > AFK_THRESHOLD_MS;
      lastActiveTimestamp = Date.now();
    }
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

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('mousemove', () => { lastActiveTimestamp = Date.now(); });
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

  // Intervalo de 1 segundo para clicks de compañeros y actualización de nanitas
  const companionClickInterval = setInterval(() => {
    const now = Date.now();
    
    // Sumar clicks de compañeros click
    let companionClickPower = 0;
    state.activeCompanions.forEach((compId: string) => {
      const comp = state.companions.find((c: any) => c.id === compId);
      if (comp && comp.type === 'click') {
        companionClickPower += comp.power;
      }
    });
    
    if (companionClickPower > 0) {
      state.nanites += companionClickPower;
      onUpdate(state, false);
    }
  }, 1000);

  const gameInterval = setInterval(() => {
    recalculatePassiveIncome();
    const now = Date.now();
    const hasPassiveBuffActive = now < state.buffs.passiveBoostExpiresAt;
    const hasAfkCards = state.afkCards > 0;
    const isEffectivelyAfk = isAfk && !hasPassiveBuffActive && !hasAfkCards;

    if (isEffectivelyAfk) {
      onUpdate(state, true);
      return;
    }

    // Si estamos esperando un click después del AFK, no sumar pasivo
    if (awaitingClickAfterAfk) {
      onUpdate(state, false);
      return;
    }

    if (state.passiveIncome > 0) {
      // Sumar fracción del ingreso pasivo para animación fluida
      state.nanites += state.passiveIncome / TICKS_PER_SECOND;
    }
    onUpdate(state, isAfk && (hasPassiveBuffActive || hasAfkCards));
  }, TICK_RATE_MS);

  return {
    getState: () => state,
    isAfk: () => isAfk,
    updateState: (newState: any) => {
      Object.assign(state, newState);
      // Respetar capacidad máxima del almacén
      if (state.warehouse.length > state.warehouseCapacity) {
        state.warehouse = state.warehouse.slice(0, state.warehouseCapacity);
      }
      syncCompanionsToWarehouse();
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
      state.totalClicks += 1;
      onUpdate(state, isAfk);
    },
    upgradeEquippedWeapon: () => {
      handleUserActivity();
      if (!state.equippedWeaponId) return { success: false, msg: 'No hay ningún arma equipada.' };
      const item = state.warehouse.find((w: any) => w.id === state.equippedWeaponId);
      if (!item) return { success: false, msg: 'Arma no encontrada.' };
      if ((item.level || 0) >= 20) return { success: false, msg: 'Arma al nivel máximo (+200%).' };
      if (state.upgradeCrystals < 1) return { success: false, msg: 'Requiere al menos 1 Cristal de Mejora.' };

      state.upgradeCrystals -= 1;

      // Probabilidad de éxito disminuye conforme sube de nivel (ej. 90% en nivel 3 hasta 40% en nivel 19)
      const successChance = Math.max(40, 95 - ((item.level || 0) * 2.5));
      const roll = Math.random() * 100;

      if (roll <= successChance) {
        item.level = (item.level || 0) + 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { success: true, msg: `¡Mejora exitosa! ${item.name} ascendió al nivel ${item.level}.` };
      } else {
        // Falló: baja de nivel (si es mayor a 0)
        if ((item.level || 0) > 0) {
          item.level = (item.level || 0) - 1;
        }
        onUpdate(state, isAfk);
        saveToFirebase();
        return { success: false, msg: `Fallo en el sintonizador. ${item.name} retrocedió al nivel ${item.level}.` };
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

      // Validar mochila llena (excepto para items que no ocupan espacio como slots)
      const needsWarehouseSpace = !['companionSlot1', 'companionSlot2', 'backpackExpander'].includes(itemKey as string);
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
      } else if (itemKey === 'commonCrate') {
        state.crates.common += 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { id: `crate_common_${Date.now()}`, name: 'Caja Común', type: 'crate', details: 'Contiene recompensas básicas', rarity: 'Común', tier: 0 };
      } else if (itemKey === 'rareCrate') {
        state.crates.rare += 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { id: `crate_rare_${Date.now()}`, name: 'Caja Rara', type: 'crate', details: 'Contiene recompensas mejores', rarity: 'Raro', tier: 0 };
      } else if (itemKey === 'epicCrate') {
        state.crates.epic += 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { id: `crate_epic_${Date.now()}`, name: 'Caja Épica', type: 'crate', details: 'Contiene recompensas altas', rarity: 'Épico', tier: 0 };
      } else if (itemKey === 'legendaryCrate') {
        state.crates.legendary += 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { id: `crate_legendary_${Date.now()}`, name: 'Caja Legendaria', type: 'crate', details: 'Contiene recompensas máximas', rarity: 'Legendario', tier: 0 };
      } else if (itemKey === 'clickBuff') {
        if (state.warehouse.length < state.warehouseCapacity) {
          const warehouseItem = {
            id: `clickbuff_${Date.now()}`,
            name: 'Buff Clicks x2',
            type: 'consumable' as const,
            details: 'Otorga x2 al click base por 30 minutos',
            rarity: 'Raro',
            tier: 0,
            sellPrice: Math.floor(item.cost / 4),
            stackable: true,
            stackCount: 1
          };
          state.warehouse.push(warehouseItem);
          onUpdate(state, isAfk);
          saveToFirebase();
          return warehouseItem;
        }
      } else if (itemKey === 'passiveBuff') {
        if (state.warehouse.length < state.warehouseCapacity) {
          const warehouseItem = {
            id: `passivebuff_${Date.now()}`,
            name: 'Buff Pasivo x2',
            type: 'consumable' as const,
            details: 'Otorga x2 al ingreso pasivo por 60 minutos',
            rarity: 'Épico',
            tier: 0,
            sellPrice: Math.floor(item.cost / 4),
            stackable: true,
            stackCount: 1
          };
          state.warehouse.push(warehouseItem);
          onUpdate(state, isAfk);
          saveToFirebase();
          return warehouseItem;
        }
      } else if (itemKey === 'backpackExpander') {
        if (state.warehouse.length < state.warehouseCapacity) {
          const warehouseItem = {
            id: `expander_${Date.now()}`,
            name: 'Expansor de Almacén',
            type: 'consumable' as const,
            details: 'Aumenta el almacén +1 slot (máx 20)',
            rarity: 'Raro',
            tier: 0,
            sellPrice: Math.floor(item.cost / 4),
            stackable: true,
            stackCount: 1
          };
          state.warehouse.push(warehouseItem);
          onUpdate(state, isAfk);
          saveToFirebase();
          return warehouseItem;
        }
      } else if (itemKey === 'companionSlot1') {
        if (state.maxCompanionSlots !== 1) return false;
        state.maxCompanionSlots += 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { id: `slot1_${Date.now()}`, name: 'Slot de Compañero 1', type: 'upgrade', details: '+1 slot de compañero', rarity: 'Épico', tier: 0 };
      } else if (itemKey === 'companionSlot2') {
        if (state.maxCompanionSlots !== 2) return false;
        state.maxCompanionSlots += 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { id: `slot2_${Date.now()}`, name: 'Slot de Compañero 2', type: 'upgrade', details: '+1 slot de compañero', rarity: 'Épico', tier: 0 };
      } else if (itemKey === 'afkCard') {
        if (state.warehouse.length < state.warehouseCapacity) {
          const warehouseItem = {
            id: `afk_${Date.now()}`,
            name: 'Tarjeta AFK',
            type: 'consumable' as const,
            details: 'Permite juego sin pestaña activa por 10 min (acumulable x3)',
            rarity: 'Raro',
            tier: 0,
            sellPrice: Math.floor(item.cost / 4),
            stackable: true,
            stackCount: 1
          };
          state.warehouse.push(warehouseItem);
          onUpdate(state, isAfk);
          saveToFirebase();
          return warehouseItem;
        }
      } else if (itemKey === 'clickX2Card') {
        if (state.warehouse.length < state.warehouseCapacity) {
          const warehouseItem = {
            id: `clickx2_${Date.now()}`,
            name: 'Tarjeta Click x2',
            type: 'consumable' as const,
            details: 'Otorga x2 al click base por 30 segundos',
            rarity: 'Raro',
            tier: 0,
            sellPrice: Math.floor(item.cost / 4),
            stackable: true,
            stackCount: 1
          };
          state.warehouse.push(warehouseItem);
          onUpdate(state, isAfk);
          saveToFirebase();
          return warehouseItem;
        }
      } else if (itemKey === 'clickX3Card') {
        if (state.warehouse.length < state.warehouseCapacity) {
          const warehouseItem = {
            id: `clickx3_${Date.now()}`,
            name: 'Tarjeta Click x3',
            type: 'consumable' as const,
            details: 'Otorga x3 al click base por 30 segundos',
            rarity: 'Épico',
            tier: 0,
            sellPrice: Math.floor(item.cost / 4),
            stackable: true,
            stackCount: 1
          };
          state.warehouse.push(warehouseItem);
          onUpdate(state, isAfk);
          saveToFirebase();
          return warehouseItem;
        }
      } else if (itemKey.startsWith('companionCardT')) {
        const tier = parseInt(itemKey.replace('companionCardT', ''));
        const comp = generateCompanionByTier(tier);
        state.companions.push(comp);
        if (state.warehouse.length < state.warehouseCapacity) {
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
      } else if ((itemKey as string) === 'afkCard') {
        if (state.afkCards >= 3) return false;
        state.afkCards += 1;
        // Establecer tiempo de expiración (10 min por tarjeta, acumulable hasta 30 min)
        const now = Date.now();
        const currentExpires = Math.max(now, state.afkExpiresAt);
        state.afkExpiresAt = Math.min(currentExpires + 10 * 60 * 1000, now + 30 * 60 * 1000);
        // Guardar en almacén como consumible
        if (state.warehouse.length < state.warehouseCapacity) {
          state.warehouse.push({
            id: `afk_${Date.now()}`,
            name: 'Tarjeta AFK',
            type: 'consumable',
            details: 'Permite juego sin pestaña activa por 10 min (acumulable x3)',
            rarity: 'Raro',
            sellPrice: Math.floor(item.cost / 4),
            stackable: true,
            stackCount: 1
          });
        }
      }

      onUpdate(state, isAfk);
      saveToFirebase();
      return true;
    },
    openCrateBox: (crateType: 'common' | 'rare' | 'epic' | 'legendary') => {
      handleUserActivity();
      if (state.keys < 1 || state.crates[crateType] < 1) return null;

      state.keys -= 1;
      state.crates[crateType] -= 1;
      state.cratesOpened += 1;

      // Verificar capacidad del almacén antes de añadir items
      if (state.warehouse.length >= state.warehouseCapacity) {
        // Almacén lleno, dar compensación en nanites
        const compensation = crateType === 'common' ? 500 : crateType === 'rare' ? 1500 : crateType === 'epic' ? 5000 : 20000;
        state.nanites += compensation;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { type: 'nanites', amount: compensation, label: `Almacén lleno: +${compensation} Nanitas compensación` };
      }

      const roll = Math.random() * 100;
      let reward: { type: string; amount: number; label: string; itemData?: any };

      if (crateType === 'common') {
        if (roll < 50) reward = { type: 'nanites', amount: 300, label: '+300 Nanitas' };
        else if (roll < 80) {
          state.upgradeCrystals += 2;
          reward = { type: 'crystal', amount: 2, label: '+2 Cristales de Mejora' };
        } else {
          const comp = { id: 'comp_' + Math.random().toString(36).substring(2, 9), name: 'Dron Explorador', type: 'passive' as const, power: 2, rarity: 'Común' };
          if (state.warehouse.length < state.warehouseCapacity) {
            state.warehouse.push({ id: comp.id, name: comp.name, type: 'companion', details: '+2 Pasivo/s', rarity: comp.rarity });
            state.companions.push(comp);
            reward = { type: 'companion', amount: 1, label: 'Compañero: Dron Explorador (+2 Pasivo/s)' };
          } else {
            reward = { type: 'nanites', amount: 500, label: 'Almacén lleno: +500 Nanitas compensación' };
          }
        }
      } else if (crateType === 'rare') {
        if (roll < 40) {
          state.upgradeCrystals += 5;
          reward = { type: 'crystal', amount: 5, label: '+5 Cristales de Mejora' };
        } else if (roll < 80) {
          const comp = { id: 'comp_' + Math.random().toString(36).substring(2, 9), name: 'Artillero Táctico', type: 'click' as const, power: 10, rarity: 'Raro' };
          if (state.warehouse.length < state.warehouseCapacity) {
            state.warehouse.push({ id: comp.id, name: comp.name, type: 'companion', details: '+10 Daño de Click', rarity: comp.rarity });
            state.companions.push(comp);
            reward = { type: 'companion', amount: 1, label: 'Compañero: Artillero Táctico (+10 Click)' };
          } else {
            reward = { type: 'nanites', amount: 1500, label: 'Almacén lleno: +1,500 Nanitas' };
          }
        } else {
          state.crates.epic += 1;
          reward = { type: 'crate', amount: 1, label: '+1 Caja Épica' };
        }
      } else if (crateType === 'epic') {
        if (roll < 45) {
          state.upgradeCrystals += 15;
          reward = { type: 'crystal', amount: 15, label: '+15 Cristales de Mejora' };
        } else if (roll < 85) {
          const comp = { id: 'comp_' + Math.random().toString(36).substring(2, 9), name: 'IA Cuántica', type: 'multiplier' as const, power: 0.5, rarity: 'Épico' };
          if (state.warehouse.length < state.warehouseCapacity) {
            state.warehouse.push({ id: comp.id, name: comp.name, type: 'companion', details: '+50% Multiplicador Global', rarity: comp.rarity });
            state.companions.push(comp);
            reward = { type: 'companion', amount: 1, label: 'Compañero: IA Cuántica (+50% Mult)' };
          } else {
            reward = { type: 'nanites', amount: 5000, label: 'Almacén lleno: +5,000 Nanitas' };
          }
        } else {
          state.crates.legendary += 1;
          reward = { type: 'crate', amount: 1, label: '+1 Caja Legendaria' };
        }
      } else {
        // Legendary
        if (roll < 35) {
          state.upgradeCrystals += 40;
          reward = { type: 'crystal', amount: 40, label: '+40 Cristales de Mejora' };
        } else if (roll < 75) {
          const comp = { id: 'comp_' + Math.random().toString(36).substring(2, 9), name: 'Comandante Supremo', type: 'multiplier' as const, power: 2.0, rarity: 'Legendario' };
          if (state.warehouse.length < state.warehouseCapacity) {
            state.warehouse.push({ id: comp.id, name: comp.name, type: 'companion', details: '+200% Multiplicador Global', rarity: comp.rarity });
            state.companions.push(comp);
            reward = { type: 'companion', amount: 1, label: 'Compañero Supremo (+200% Mult)' };
          } else {
            reward = { type: 'nanites', amount: 20000, label: 'Almacén lleno: +20,000 Nanitas' };
          }
        } else {
          state.keys += 5;
          reward = { type: 'keys', amount: 5, label: '+5 Llaves de Cifrado' };
        }
      }

      recalculatePassiveIncome();
      onUpdate(state, isAfk);
      saveToFirebase();
      return reward;
    },
    cleanup: async () => {
      clearInterval(gameInterval);
      clearInterval(saveInterval);
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      await saveToFirebase();
    }
  };
}