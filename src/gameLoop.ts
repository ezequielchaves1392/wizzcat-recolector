import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const SAVE_VERSION = 4;
const MAX_BUFF_DURATION_MS = 8 * 60 * 60 * 1000;

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
  clickBuff: { cost: 800, durationMs: 30 * 60 * 1000, label: 'Buff Clics x2 (30m)' },
  passiveBuff: { cost: 1500, durationMs: 60 * 60 * 1000, label: 'Buff Pasivo x2 + Excepción AFK (1h)' }
};

export const COMPANION_SLOT_COSTS = [0, 1000, 5000, 20000, 75000];

export async function createGameLoop(user: any, onUpdate: (state: any, isAfkPaused?: boolean) => void) {
  const baseCompanion = {
    id: 'companion_base_001',
    name: 'Dron Explorador',
    type: 'passive' as const,
    power: 1,
    rarity: 'Común'
  };

  let state = {
    saveVersion: SAVE_VERSION,
    nanites: 0,
    passiveIncome: 0,
    totalClicks: 0,
    totalInfraestructure: 0,
    cratesOpened: 0,
    keys: 3,
    upgradeCrystals: 5,
    warehouseCapacity: 15,
    maxCompanionSlots: 1,
    crates: {
      common: 2,
      rare: 0,
      epic: 0,
      legendary: 0
    },
    collectors: {
      blaster: { level: 0, equipped: false },
      plasmaCannon: { level: 0, equipped: false },
      quantumDisruptor: { level: 0, equipped: false }
    },
    companions: [baseCompanion] as Array<{ id: string; name: string; type: 'click' | 'passive' | 'multiplier'; power: number; rarity: string }>,
    activeCompanions: [] as string[],
    warehouse: [
      { id: 'weapon_blaster_001', name: 'Blaster Láser', type: 'weapon', details: 'Daño: +1', rarity: 'Común' },
      { id: 'companion_base_001', name: 'Dron Explorador', type: 'companion', details: '+1/s', rarity: 'Común' }
    ] as Array<{ id: string; name: string; type: string; details: string; rarity: string }>,
    buffs: {
      clickBoostExpiresAt: 0,
      passiveBoostExpiresAt: 0
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
      state.collectors = data.collectors ?? state.collectors;
      state.companions = data.companions ?? [];
      state.activeCompanions = data.activeCompanions ?? [];
      state.warehouse = data.warehouse ?? [];
      state.buffs = {
        clickBoostExpiresAt: data.buffs?.clickBoostExpiresAt ?? 0,
        passiveBoostExpiresAt: data.buffs?.passiveBoostExpiresAt ?? 0
      };
      // Asegurar que el recolector equipado tenga level definido
      Object.values(state.collectors).forEach((c: any) => {
        if (c.level === undefined) c.level = 0;
      });
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
        crates: state.crates,
        collectors: state.collectors,
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
          details: comp.type === 'click' ? `+${comp.power} Daño de Clic` : comp.type === 'passive' ? `+${comp.power} Pasivo/s` : `+${comp.power * 100}% Multiplicador`,
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
    let collectorDamageBonus = 0;
    // SOLO el recolector equipado suma a la recolección por click
    Object.entries(state.collectors).forEach(([key, c]: [string, any]) => {
      if (c.equipped) {
        const baseDmg = key === 'blaster' ? 1 : key === 'plasmaCannon' ? 5 : 25;
        const levelMultiplier = 1 + ((c.level || 0) * 0.10);
        collectorDamageBonus += baseDmg * levelMultiplier;
      }
    });

    return Math.floor(collectorDamageBonus);
  }

  function calculateMultiplier() {
    let multiplier = 1;
    if (Date.now() < state.buffs.clickBoostExpiresAt) {
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
        crates: state.crates,
        collectors: state.collectors,
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
      isAfk = true;
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
    lastActiveTimestamp = Date.now();
    if (isAfk) {
      isAfk = false;
      // Activar estado de espera de click para retomar pasivos
      awaitingClickAfterAfk = true;
      onUpdate(state, false);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('mousemove', handleUserActivity);
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

  const gameInterval = setInterval(() => {
    recalculatePassiveIncome();
    const now = Date.now();
    const hasPassiveBuffActive = now < state.buffs.passiveBoostExpiresAt;
    const isEffectivelyAfk = isAfk && !hasPassiveBuffActive;

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
    onUpdate(state, isAfk && hasPassiveBuffActive);
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
    buyCollectorLevel: (collectorKey: 'blaster' | 'plasmaCannon' | 'quantumDisruptor') => {
      handleUserActivity();
      const baseCost = COLLECTOR_BASE_COSTS[collectorKey];
      const collector = state.collectors[collectorKey];
      if (!collector || collector.level >= 3) return false; // Solo se pueden comprar 3 niveles base directos en la tienda

      const cost = Math.floor(baseCost * Math.pow(1.5, collector.level));
      if (state.nanites >= cost) {
        state.nanites -= cost;
        collector.level += 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return true;
      }
      return false;
    },
    upgradeCollectorGacha: (collectorKey: 'blaster' | 'plasmaCannon' | 'quantumDisruptor') => {
      handleUserActivity();
      const collector = state.collectors[collectorKey];
      if (!collector || collector.level >= 20) return { success: false, msg: 'Recolector al nivel máximo (+200%).' };
      if (state.upgradeCrystals < 1) return { success: false, msg: 'Requiere al menos 1 Cristal de Mejora.' };

      state.upgradeCrystals -= 1;

      // Probabilidad de éxito disminuye conforme sube de nivel (ej. 90% en nivel 3 hasta 40% en nivel 19)
      const successChance = Math.max(40, 95 - (collector.level * 2.5));
      const roll = Math.random() * 100;

      if (roll <= successChance) {
        collector.level += 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { success: true, msg: `¡Mejora exitosa! Recolector ascendió al nivel ${collector.level}.` };
      } else {
        // Falló: baja de nivel (si es mayor a 0 y mayor al nivel base comprado, o baja 1 nivel respetando mínimo 0)
        if (collector.level > 0) {
          collector.level -= 1;
        }
        onUpdate(state, isAfk);
        saveToFirebase();
        return { success: false, msg: `Fallo en el sintonizador. El recolector retrocedió al nivel ${collector.level}.` };
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
    equipCollector: (collectorId: string) => {
      handleUserActivity();
      // Buscar el item en el warehouse
      const item = state.warehouse.find((w: any) => w.id === collectorId);
      if (!item || item.type !== 'weapon') return false;

      // Si ya está equipado, desequiparlo
      if ((item as any).equipped) {
        (item as any).equipped = false;
        Object.values(state.collectors).forEach((c: any) => c.equipped = false);
        onUpdate(state, isAfk);
        saveToFirebase();
        return true;
      }

      // Desequipar todos los recolectores del warehouse
      state.warehouse.forEach((w: any) => {
        if (w.type === 'weapon') w.equipped = false;
      });

      // Desequipar todos los recolectores del state
      Object.values(state.collectors).forEach((c: any) => c.equipped = false);

      // Determinar el tipo de recolector basado en el nombre
      const itemName = (item as any).name.toLowerCase();
      let collectorKey = '';
      if (itemName.includes('blaster')) {
        collectorKey = 'blaster';
      } else if (itemName.includes('plasma')) {
        collectorKey = 'plasmaCannon';
      } else if (itemName.includes('quantum') || itemName.includes('disruptor')) {
        collectorKey = 'quantumDisruptor';
      }

      // Buscar el recolector con el nivel más cercano al item
      if (collectorKey) {
        const collector = (state.collectors as any)[collectorKey];
        if (collector) {
          collector.equipped = true;
          (item as any).equipped = true;
          // Actualizar el nivel del recolector para que coincida con el item
          collector.level = (item as any).level || collector.level;
        }
      }

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

      state.nanites -= item.cost;

      if (itemKey === 'key') {
        state.keys += 1;
      } else if (itemKey === 'upgradeCrystal') {
        state.upgradeCrystals += 1;
      } else if (itemKey === 'warehouseSlot') {
        state.warehouseCapacity += 5;
      } else if (itemKey === 'commonCrate') {
        state.crates.common += 1;
      } else if (itemKey === 'rareCrate') {
        state.crates.rare += 1;
      } else if (itemKey === 'epicCrate') {
        state.crates.epic += 1;
      } else if (itemKey === 'legendaryCrate') {
        state.crates.legendary += 1;
      } else if (itemKey === 'clickBuff') {
        const now = Date.now();
        const currentExpires = Math.max(now, state.buffs.clickBoostExpiresAt);
        state.buffs.clickBoostExpiresAt = Math.min(currentExpires + (item as any).durationMs, now + MAX_BUFF_DURATION_MS);
      } else if (itemKey === 'passiveBuff') {
        const now = Date.now();
        const currentExpires = Math.max(now, state.buffs.passiveBoostExpiresAt);
        state.buffs.passiveBoostExpiresAt = Math.min(currentExpires + (item as any).durationMs, now + MAX_BUFF_DURATION_MS);
        recalculatePassiveIncome();
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
            state.warehouse.push({ id: comp.id, name: comp.name, type: 'companion', details: '+10 Daño de Clic', rarity: comp.rarity });
            state.companions.push(comp);
            reward = { type: 'companion', amount: 1, label: 'Compañero: Artillero Táctico (+10 Clic)' };
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