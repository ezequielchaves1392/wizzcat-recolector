// Tabla de botín de las cajas y generador de recompensas.
//
// Reglas de diseño que sostiene este archivo:
//  1. La caja es la UNICA fuente de los compañeros multiplicadores y de las armas
//     sobrecargadas. No se pueden comprar, por eso la ruleta tiene valore real.
//  2. Todo drop que no cabe en el almacén se compensa en nanitas, nunca se pierde.
//  3. La ruleta NO decide el premio: `rollCrateReward` decide y la animación solo
//     lo muestra. Si se invirtiera, la ruleta estaría mintiendo sobre las probabilidades.

import { TIER_SYSTEM, type CrateType } from '../gameLoop';
import type { WarehouseItem } from '../types';

export type LootKind = 'nanites' | 'crystals' | 'keys' | 'companion' | 'weapon' | 'crate' | 'consumable';

export interface CrateReward {
  kind: LootKind;
  amount: number;
  name: string;
  label: string;
  details: string;
  rarity: string;
  tier?: number;
  /** Nombre del icono SVG, no un emoji: ver CRATE_ONLY_COMPANIONS */
  icon: string;
  /** Relleno si el drop se materializó como item del almacén */
  item?: any;
  /** Exclusivo de caja: no se puede comprar en la tienda */
  exclusive: boolean;
}

// Colores de rareza. Devolvemos la clase de texto y la de borde por separado:
// combinarlas en un único string hacía que `border-*`Competía con `text-*` y que
// uno de los dos se perdiera según el orden de las clases.
export const RARITY_TEXT: Record<string, string> = {
  'Común': 'text-slate-400',
  'Raro': 'text-blue-400',
  'Épico': 'text-purple-400',
  'Legendario': 'text-amber-400',
  'Mítico': 'text-rose-400',
  'Divino': 'text-yellow-300',
  'Sobrecargado': 'text-fuchsia-300'
};

export const RARITY_BORDER: Record<string, string> = {
  'Común': 'border-slate-500/40',
  'Raro': 'border-blue-500/40',
  'Épico': 'border-purple-500/40',
  'Legendario': 'border-amber-500/50',
  'Mítico': 'border-rose-500/50',
  'Divino': 'border-yellow-400/60',
  'Sobrecargado': 'border-fuchsia-400/60'
};

/** Clase de glow. Se escriben completas para que Tailwind las vea. */
export const RARITY_GLOW: Record<string, string> = {
  'Común': '',
  'Raro': 'rarity-glow-raro',
  'Épico': 'rarity-glow-epico',
  'Legendario': 'rarity-glow-legendario',
  'Mítico': 'rarity-glow-mitico',
  'Divino': 'rarity-glow-divino',
  'Sobrecargado': 'rarity-glow-sobrecargado'
};

/** Atajo: color + borde en una sola clase, para las casillas de la ruleta. */
export function rarityClass(rarity: string): string {
  return `${RARITY_TEXT[rarity] || RARITY_TEXT['Común']} ${RARITY_BORDER[rarity] || RARITY_BORDER['Común']}`;
}

export const RARITY_RANK: Record<string, number> = {
  'Común': 0, 'Raro': 1, 'Épico': 2, 'Legendario': 3, 'Mítico': 4, 'Divino': 5, 'Sobrecargado': 6
};

export const CRATE_META: Record<CrateType, { name: string; icon: string; accent: string; cost: number }> = {
  common:    { name: 'Caja Común',      icon: 'crate', accent: 'text-slate-300',  cost: 400 },
  rare:      { name: 'Caja Rara',       icon: 'crate', accent: 'text-blue-400',   cost: 1200 },
  epic:      { name: 'Caja Épica',      icon: 'crystal', accent: 'text-purple-400', cost: 4500 },
  legendary: { name: 'Caja Legendaria', icon: 'trophy', accent: 'text-amber-400',  cost: 18000 }
};

// Companiaexclusive de caja. No existe en la tienda: es el motivo por el que
// la ruleta se siente como algo mas que unaanimacion.
// Iconos: se usa el set SVG en vez de emoji. Los emoji se renderizan distinto
// en cada SO (el 🕳️ salía como un óvalo negro en Windows) y rompen la paleta.
export const CRATE_ONLY_COMPANIONS = [
  { name: 'Fantasma Cuántico', type: 'multiplier', power: 0.35, rarity: 'Mítico',    icon: 'sparkle' },
  { name: 'Oráculo Tribal',    type: 'multiplier', power: 0.75, rarity: 'Legendario', icon: 'crystal' },
  { name: 'Avatar del Vacío',  type: 'passive',    power: 65,   rarity: 'Divino',     icon: 'globe' },
  { name: 'Fénix de Datos',    type: 'passive',    power: 40,   rarity: 'Mítico',     icon: 'bolt' },
  { name: 'Centinela Eterno',  type: 'click',      power: 32,   rarity: 'Legendario', icon: 'shield' },
  { name: 'Espectro Azulado',  type: 'passive',    power: 18,   rarity: 'Épico',      icon: 'companion' }
] as const;

/** Armas sobrecargadas: mismo tier, daño por encima del rango normal del tier. */
export function makeOverclockWeapon(tier: number): { item: any; name: string; rarity: string; details: string } {
  const range = TIER_SYSTEM.ranges[tier as keyof typeof TIER_SYSTEM.ranges] || [1, 5];
  const top = range[1];
  // +25% sobre el máximo del tier: claramente mejor que su versión de tienda
  const damage = Math.round(top * 1.25);
  const names = TIER_SYSTEM.weaponNames[tier as keyof typeof TIER_SYSTEM.weaponNames] || ['Blaster Láser'];
  const name = names[Math.floor(Math.random() * names.length)];
  const rarity = RARITY_RANK[tier >= 9 ? 'Divino' : tier >= 7 ? 'Mítico' : 'Legendario'] !== undefined
    ? (tier >= 9 ? 'Divino' : tier >= 7 ? 'Mítico' : 'Legendario')
    : 'Legendario';
  return {
    name: `${name} SOBRECARGADO`,
    rarity: 'Sobrecargado',
    details: `Recolección por click: +${damage} (base T${tier}: ${top})`,
    item: {
      id: `oc_weapon_t${tier}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: `${name} SOBRECARGADO`,
      type: 'weapon',
      details: `Recolección por click: +${damage} (base T${tier}: ${top})`,
      rarity: 'Sobrecargado',
      tier,
      level: 0,
      damage,
      overclock: true,
      sellPrice: Math.round(CRATE_META.legendary.cost * 0.4)
    }
  };
}

export function makeCrateOnlyCompanion(entry: typeof CRATE_ONLY_COMPANIONS[number]) {
  const id = `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const details = entry.type === 'multiplier'
    ? `Multiplicador global: x${(1 + entry.power).toFixed(2).replace(/\.?0+$/, '')}`
    : `Recolección por segundo: +${entry.power}/s`;
  return {
    companion: { id, name: entry.name, type: entry.type, power: entry.power, rarity: entry.rarity },
    item: {
      id,
      name: entry.name,
      type: 'companion',
      details,
      rarity: entry.rarity,
      // `companionType` y `power` viajan en el item: el game loop ya no tiene
      // que deducirlos parseando el texto, que es donde se perdían los valores
      companionType: entry.type,
      power: entry.power,
      exclusive: true,
      sellPrice: 0
    }
  };
}

// ---------------------------------------------------------------------------
// Tablas de botín. `weight` es peso relativo dentro de la caja.
// ---------------------------------------------------------------------------

interface LootEntry {
  id: string;
  weight: number;
  /** Construye el premio. `exclusive: true` marca lo que no se puede comprar. */
  build: () => Omit<CrateReward, 'exclusive'> & { exclusive?: boolean };
}

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export const CRATE_LOOT: Record<CrateType, LootEntry[]> = {
  common: [
    { id: 'nanites', weight: 34, build: () => { const a = rand(250, 400); return { kind: 'nanites', amount: a, name: 'Nanitas', label: `+${a} Nanitas`, details: 'Materia prima básica', rarity: 'Común', icon: 'bolt' }; } },
    { id: 'crystals', weight: 26, build: () => { const a = rand(2, 4); return { kind: 'crystals', amount: a, name: 'Cristales de Mejora', label: `+${a} Cristales`, details: 'Sube el nivel del recolector', rarity: 'Raro', icon: 'crystal' }; } },
    { id: 'dron', weight: 22, build: () => ({ kind: 'companion', amount: 1, name: 'Dron Explorador', label: 'Dron Explorador', details: 'Recolección por segundo: +2/s', rarity: 'Común', icon: 'companion', tier: 1, item: { id: `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Dron Explorador', type: 'companion', details: 'Recolección por segundo: +2/s', rarity: 'Común', companionType: 'passive', power: 2, sellPrice: 100 } }) },
    { id: 'keys', weight: 12, build: () => { const a = rand(1, 2); return { kind: 'keys', amount: a, name: 'Llave de Cifrado', label: `+${a} Llave${a > 1 ? 's' : ''}`, details: 'Abre otra caja', rarity: 'Raro', icon: 'key' }; } },
    { id: 'expander', weight: 6, build: () => ({ kind: 'consumable', amount: 1, name: 'Ranura de Almacén', label: '+1 ranura de almacén', details: 'Amplía el almacén +1 slot', rarity: 'Raro', icon: 'plus', item: { id: `crate_slot_${Date.now()}`, name: 'Ranura de Almacén', type: 'consumable', details: 'Amplía el almacén +1 slot', rarity: 'Raro', buffId: 'warehouseExpander', stackable: true, stackCount: 1, sellPrice: 125 } }) }
  ],
  rare: [
    { id: 'crystals', weight: 26, build: () => { const a = rand(6, 10); return { kind: 'crystals', amount: a, name: 'Cristales de Mejora', label: `+${a} Cristales`, details: 'Sube el nivel del recolector', rarity: 'Épico', icon: 'crystal' }; } },
    { id: 'companion_t3', weight: 24, build: () => { const t = TIER_SYSTEM.ranges[3]; const p = rand(t[0], t[1]); return { kind: 'companion', amount: 1, name: 'Artillero Táctico', label: 'Artillero Táctico', details: `Recolección por segundo: +${p}/s`, rarity: 'Épico', icon: 'bolt', tier: 3, item: { id: `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Artillero Táctico', type: 'companion', details: `Recolección por segundo: +${p}/s`, rarity: 'Épico', tier: 3, companionType: 'passive', power: p, sellPrice: 400 } }; } },
    { id: 'weapon_t4', weight: 20, build: () => { const w = makeOverclockWeapon(4); return { kind: 'weapon', amount: 1, name: w.name, label: w.name, details: w.details, rarity: w.rarity, icon: 'weapon', tier: 4, item: w.item }; } },
    { id: 'epic_crate', weight: 16, build: () => ({ kind: 'crate', amount: 1, name: 'Caja Épica', label: '+1 Caja Épica', details: 'Abre una caja de botín superior', rarity: 'Épico', icon: 'crystal', item: { id: `crate_epic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Caja Épica', type: 'crate', details: 'Contiene recompensas altas', rarity: 'Épico', tier: 0, sellPrice: 1125, stackable: true, stackCount: 1 } }) },
    { id: 'keys', weight: 14, build: () => { const a = rand(2, 4); return { kind: 'keys', amount: a, name: 'Llave de Cifrado', label: `+${a} Llaves`, details: 'Abre otra caja', rarity: 'Épico', icon: 'key' }; } }
  ],
  epic: [
    { id: 'crystals', weight: 24, build: () => { const a = rand(16, 24); return { kind: 'crystals', amount: a, name: 'Cristales de Mejora', label: `+${a} Cristales`, details: 'Sube el nivel del recolector', rarity: 'Legendario', icon: 'crystal' }; } },
    { id: 'companion_t6', weight: 22, build: () => { const t = TIER_SYSTEM.ranges[6]; const p = rand(t[0], t[1]); return { kind: 'companion', amount: 1, name: 'Titán de Acero', label: 'Titán de Acero', details: `Recolección por segundo: +${p}/s`, rarity: 'Legendario', icon: 'companion', tier: 6, item: { id: `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Titán de Acero', type: 'companion', details: `Recolección por segundo: +${p}/s`, rarity: 'Legendario', tier: 6, companionType: 'passive', power: p, sellPrice: 2500 } }; } },
    { id: 'weapon_oc6', weight: 18, build: () => { const w = makeOverclockWeapon(6); return { kind: 'weapon', amount: 1, name: w.name, label: w.name, details: w.details, rarity: w.rarity, icon: 'weapon', tier: 6, item: w.item }; } },
    { id: 'ghost', weight: 14, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[0]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'sparkle', item: c.item, exclusive: true }; } },
    { id: 'phoenix', weight: 12, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[3]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'bolt', item: c.item, exclusive: true }; } },
    { id: 'legendary_crate', weight: 10, build: () => ({ kind: 'crate', amount: 1, name: 'Caja Legendaria', label: '+1 Caja Legendaria', details: 'Abre una caja de botín máximo', rarity: 'Legendario', icon: 'trophy', item: { id: `crate_legendary_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Caja Legendaria', type: 'crate', details: 'Contiene recompensas máximas', rarity: 'Legendario', tier: 0, sellPrice: 4500, stackable: true, stackCount: 1 } }) }
  ],
  legendary: [
    { id: 'crystals', weight: 22, build: () => { const a = rand(45, 65); return { kind: 'crystals', amount: a, name: 'Cristales de Mejora', label: `+${a} Cristales`, details: 'Sube el nivel del recolector', rarity: 'Mítico', icon: 'crystal' }; } },
    { id: 'weapon_oc8', weight: 20, build: () => { const w = makeOverclockWeapon(8); return { kind: 'weapon', amount: 1, name: w.name, label: w.name, details: w.details, rarity: w.rarity, icon: 'weapon', tier: 8, item: w.item }; } },
    { id: 'avatar', weight: 18, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[2]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'globe', item: c.item, exclusive: true }; } },
    { id: 'oracle', weight: 16, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[1]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'crystal', item: c.item, exclusive: true }; } },
    { id: 'sentinel', weight: 14, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[4]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'shield', item: c.item, exclusive: true }; } },
    { id: 'keys', weight: 10, build: () => { const a = rand(5, 8); return { kind: 'keys', amount: a, name: 'Llave de Cifrado', label: `+${a} Llaves`, details: 'Abre otra caja', rarity: 'Legendario', icon: 'key' }; } }
  ]
};

/** Compra una entrada por peso. */
export function pickLoot(crateType: CrateType, weights?: number[]): LootEntry {
  const table = CRATE_LOOT[crateType];
  const w = weights ?? table.map(e => e.weight);
  const total = w.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < table.length; i++) {
    roll -= w[i];
    if (roll <= 0) return table[i];
  }
  return table[table.length - 1];
}

export type LootApplier = {
  nanites: (n: number) => void;
  crystals: (n: number) => void;
  keys: (n: number) => void;
  addItem: (item: any) => boolean;
  hasSpace: () => boolean;
};

/**
 * Decide el premio y lo aplica. Si el almacén está lleno y el drop es un item,
 * se compensa en nanitas para no perderlo nunca.
 */
export function rollCrateReward(crateType: CrateType, applier: LootApplier): CrateReward {
  const entry = pickLoot(crateType);
  const built = entry.build();
  const reward: CrateReward = { ...built, exclusive: built.exclusive ?? false };

  switch (reward.kind) {
    case 'nanites': {
      const value = Math.round(reward.amount * CRATE_META[crateType].cost / 12);
      applier.nanites(value);
      return { ...reward, amount: value, label: `+${value} Nanitas` };
    }
    case 'crystals': {
      const value = Math.round(reward.amount * (1 + RARITY_RANK[reward.rarity] * 0.25));
      applier.crystals(value);
      return { ...reward, amount: value, label: `+${value} Cristales de Mejora` };
    }
    case 'keys': {
      applier.keys(reward.amount);
      return reward;
    }
    default: {
      // El resto son items: entran al almacén o se compensan
      const stored = reward.item ? applier.addItem(reward.item) : false;
      if (stored) return reward;
      const compensation = Math.round(CRATE_META[crateType].cost * 1.5);
      applier.nanites(compensation);
      return {
        ...reward,
        kind: 'nanites',
        item: undefined,
        amount: compensation,
        name: 'Compensación',
        label: `Almacén lleno: +${compensation} Nanitas`,
        details: 'No cabía el objeto, se compensó en nanitas',
        rarity: 'Común',
        icon: 'bolt'
      };
    }
  }
}

/**
 * Tira de casillas para la ruleta. El premio real va en `winIndex`; el resto son
 * distracciones sacadas de la misma tabla, con los exclusivos diluidos para que
 * el jackpot se sienta ganado y no regalado.
 */
export function buildRouletteStrip(crateType: CrateType, length = 26) {
  const table = CRATE_LOOT[crateType];
  const tiles: { label: string; sub: string; rarity: string; icon: string }[] = [];

  // Sesgo hacia lo común: los exclusivos aparecen menos en la tira que en la
  // probabilidad real, así el final se lee como "ha estado a punto"
  const exclusiveIds = ['ghost', 'phoenix', 'avatar', 'oracle', 'sentinel', 'weapon_oc6', 'weapon_oc8', 'weapon_t4'];
  const exclusiveEntries = table.filter(e => exclusiveIds.includes(e.id));

  for (let i = 0; i < length; i++) {
    // Muy bajo a proposito: si la tira muestra muchos exclusivos, el jackpot
    // deja de sentirse raro y el "casi me toca" se pierde
    const useExclusive = exclusiveEntries.length > 0 && Math.random() < 0.07;
    const src = useExclusive
      ? exclusiveEntries[Math.floor(Math.random() * exclusiveEntries.length)]
      : table[Math.floor(Math.random() * table.length)];
    const preview = src.build();
    tiles.push({
      label: preview.name.length > 16 ? preview.name.slice(0, 15) + '…' : preview.name,
      sub: preview.rarity,
      rarity: preview.rarity,
      icon: preview.icon
    });
  }
  return { tiles };
}
