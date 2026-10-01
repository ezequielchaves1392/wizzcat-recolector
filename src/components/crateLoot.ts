// Tabla de botín de las cajas y generador de recompensas.
//
// Reglas de diseño que sostiene este archivo:
//  1. La caja es la UNICA fuente de los compañeros multiplicadores y de las recolectores
//     sobrecargadas. No se pueden comprar, por eso la ruleta tiene valore real.
//  2. Todo drop que no cabe en el almacén se compensa en nanitas, nunca se pierde.
//  3. La ruleta NO decide el premio: `rollCrateReward` decide y la animación solo
//     lo muestra. Si se invirtiera, la ruleta estaría mintiendo sobre las probabilidades.

import { TIER_SYSTEM } from '../data/tiers';
import type { CrateType } from '../data/store';
import { crateCosmetics, type CrateCosmeticSource } from '../data/cosmetics';
import type { KeyTier } from '../data/items';
import { formatNumber } from '../utils/format';
import type { WarehouseItem } from '../types';

export type LootKind = 'nanites' | 'crystals' | 'keys' | 'companion' | 'collector' | 'crate' | 'consumable' | 'cosmetic';

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
  /**
   * Cosmético que se desbloquea con este botín.
   *
   * Viaja aparte de `name`/`rarity` porque el cosmético NO es un item: no ocupa
   * ranura, no se vende y no entra en el almacén. Va directo a
   * `state.cosmetics.unlocked`, y por eso el botín no puede pasar por la
   * compensación de "almacén lleno": no hay nada que no cupiera.
   */
  cosmeticId?: string;
  /** Exclusivo de caja: no se puede comprar en la tienda */
  exclusive: boolean;
  /**
   * Nivel del cristal que se otorga. Los cristales de mejora ahora son
   * materiales por niveles, así que el botín tiene que decir cuál suelta:
   * una caja común da cristal básico y una legendaria, uno de Fase.
   */
  materialTier?: number;
  /**
   * Nivel de llave que otorga el botín. Cada cofre deja la suya.
   *
   * Es `KeyTier` y no `number` a propósito: el botín declara qué llave deja y
   * el aplicador tiene que respetar ese número. Con `number` el compilador
   * aceptaba cualquier valor, y como el aplicador además ignoraba el
   * argumento, una legendaria enseñaba "+N Llaves Rúnicas" y entregaba una
   * Llave Reforzada sin que nada lo impidiera.
   */
  keyTier?: KeyTier;
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

/**
 * Slug de rareza para las clases `.ring-*` y `.rarity-*` del CSS.
 *
 * Existe porque `rarityClass()` devuelve utilidades de Tailwind
 * (`text-blue-400 border-blue-500/40`) y no se pueden componer: no hay forma
 * de extraer de ahí el nombre "raro" para escribir `ring-raro`. Antes de
 * esto el almacén construía `ring-text-blue-400`, una clase que no existe, y
 * todas las celdas salían sin el halo de rareza.
 *
 * `normalize('NFD')` + diacríticos porque 'Épico' y 'Mítico' llevan tilde y la
 * clase CSS no la lleva.
 */
export function raritySlug(rarity: string): string {
  return (rarity || 'Común')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

// Icono de cada tipo de cosmético en la ruleta. Sin esto, título, marco y
// banner indistinguishable saldrían todos con el mismo icono y el jugador leería
// tres premios distintos con la misma cara.
const COSMETIC_ICON: Record<string, string> = {
  title: 'medal',
  frame: 'sparkle',
  banner: 'layers'
};

/** Recolectores sobrecargadas: mismo tier, daño por encima del rango normal del tier. */
export function makeOverclockCollector(tier: number): { item: any; name: string; rarity: string; details: string } {
  const range = TIER_SYSTEM.ranges[tier as keyof typeof TIER_SYSTEM.ranges] || [1, 5];
  const top = range[1];
  // +25% sobre el máximo del tier: claramente mejor que su versión de tienda
  const damage = Math.round(top * 1.25);
  const names = TIER_SYSTEM.collectorNames[tier as keyof typeof TIER_SYSTEM.collectorNames] || ['Blaster Láser'];
  const name = names[Math.floor(Math.random() * names.length)];
  const rarity = RARITY_RANK[tier >= 9 ? 'Divino' : tier >= 7 ? 'Mítico' : 'Legendario'] !== undefined
    ? (tier >= 9 ? 'Divino' : tier >= 7 ? 'Mítico' : 'Legendario')
    : 'Legendario';
  return {
    name: `${name} SOBRECARGADO`,
    rarity: 'Sobrecargado',
    details: `Recolección por click: +${damage} (base T${tier}: ${top})`,
    item: {
      id: `oc_collector_t${tier}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: `${name} SOBRECARGADO`,
      type: 'collector',
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

/**
 * Un cosmético de esta caja, de entre los que el jugador todavía no tiene.
 *
 * Filtra por los que ya posee a propósito. Sortear a ciegas entre los que ya
 * tiene convertiría la segunda legendaria de la tarde en un cosmético repetido,
 * y el jugador leería "La Señal" en la ruleta y "ya lo tienes" en el inventario:
 * la casilla volvería a mentir sobre el premio. Con el filtro, la ruleta
 * enseña siempre algo que de verdad entra.
 *
 * `null` si ya los tiene todos, que es la única forma de que esto no dé nada.
 */
function rollCrateCosmetic(crate: CrateType, owned: string[]) {
  const libres = crateCosmetics(crate as CrateCosmeticSource).filter(c => !owned.includes(c.id));
  if (libres.length === 0) return null;
  const cos = libres[Math.floor(Math.random() * libres.length)];
  return {
    kind: 'cosmetic' as const,
    amount: 1,
    name: cos.name,
    label: cos.name,
    details: cos.description,
    rarity: cos.rarity,
    icon: COSMETIC_ICON[cos.type],
    cosmeticId: cos.id,
    exclusive: true
  };
}

// ---------------------------------------------------------------------------
// Tablas de botín. `weight` es peso relativo dentro de la caja.
//
// Las sumas no son 100 y no hace falta que lo sean: `pickLoot` normaliza con el
// total. Al añadir la entrada `cosmetic` el total de cada caja subió, así que
// el resto de botines quedó diluido (en la común, las nanitas pasaron de 34 % a
// 32,4 %). Es el precio de añadir un premio nuevo, y se paga en todo a la vez
// en vez de rebajar a mano una entrada que alguien ajustó a su gusto.
// ---------------------------------------------------------------------------

/**
 * Una casilla de la ruleta. `amount` solo viene en los premios que se cuentan
 * (nanitas, cristales, llaves): es la cifra que el jugador se lleva, no un
 * adorno, y por eso se enseña en la casilla y no solo en el cartel final.
 */
export interface RouletteTile {
  label: string;
  amount?: string;
  sub: string;
  rarity: string;
  icon: string;
  /**
   * Tinte de la casilla para las ruletas que NO son de botín.
   *
   * La ruleta del sintonizador tiene dos casillas —mejora o fallo— y ninguna de
   * las dos es un premio con rareza. Prestarle una ("Legendario" sobre un fallo)
   * haría que el jugador leyera que fallar es un premio. Cuando está, el tinte
   * sustituye a la rareza y el campo `rarity` se rellena igual para que
   * `makeRouletteTile` siga siendo la única constructora de casillas.
   */
  tone?: 'good' | 'bad';
}

interface LootEntry {
  id: string;
  weight: number;
  /**
   * Construye el premio. `exclusive: true` marca lo que no se puede comprar.
   *
   * Devolver `null` significa "esta vez no hay nada que dar": hoy solo lo hace
   * el cosmético cuando el jugador ya tiene todos los de esta caja. No es un
   * fallo del sorteo, es el premio decidido, y quien sortea lo convierte en
   * nanitas para que la ruleta enseñe lo que de verdad se lleva en vez de
   * prometer un cosmético repetido.
   */
  build: (ctx: LootBuildContext) => (Omit<CrateReward, 'exclusive'> & { exclusive?: boolean }) | null;
}

/**
 * Lo que la tabla necesita saber del jugador para construir un premio.
 *
 * Solo se pasa en el sorteo real, nunca al pintar las distracciones de la tira:
 * esas son decorado y pueden enseñar un cosmético que el jugador ya tenga, como
 * se enseña cualquier otra cosa que no va a ganar.
 */
export interface LootBuildContext {
  /** Ids de cosméticos que el jugador ya tiene desbloqueados. */
  ownedCosmetics: string[];
}

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export const CRATE_LOOT: Record<CrateType, LootEntry[]> = {
  common: [
    { id: 'nanites', weight: 34, build: () => { const a = rand(250, 400); return { kind: 'nanites', amount: a, name: 'Nanitas', label: `+${a} Nanitas`, details: 'Materia prima básica', rarity: 'Común', icon: 'bolt' }; } },
    { id: 'crystals', weight: 26, build: () => { const a = rand(2, 4); return { kind: 'crystals', amount: a, name: 'Cristales de Mejora', label: `+${a} Cristales`, details: 'Sube el nivel del recolector', rarity: 'Raro', icon: 'crystal', materialTier: 1 }; } },
    { id: 'dron', weight: 22, build: () => ({ kind: 'companion', amount: 1, name: 'Dron Explorador', label: 'Dron Explorador', details: 'Recolección por segundo: +2/s', rarity: 'Común', icon: 'companion', tier: 1, item: { id: `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Dron Explorador', type: 'companion', details: 'Recolección por segundo: +2/s', rarity: 'Común', companionType: 'passive', power: 2, sellPrice: 100 } }) },
    { id: 'keys', weight: 12, build: () => { const a = rand(1, 2); return { kind: 'keys', amount: a, name: 'Llave de Cifrado', label: `+${a} Llave${a > 1 ? 's' : ''}`, details: 'Abre Cofres Comunes y Raros', rarity: 'Raro', icon: 'key', keyTier: 0 }; } },
    { id: 'expander', weight: 6, build: () => ({ kind: 'consumable', amount: 1, name: 'Ranura de Almacén', label: '+1 ranura de almacén', details: 'Amplía el almacén +1 slot', rarity: 'Raro', icon: 'plus', item: { id: `crate_slot_${Date.now()}`, name: 'Ranura de Almacén', type: 'consumable', details: 'Amplía el almacén +1 slot', rarity: 'Raro', buffId: 'warehouseExpander', stackable: true, stackCount: 1, sellPrice: 125 } }) },
    { id: 'cosmetic', weight: 5, build: (ctx) => rollCrateCosmetic('common', ctx.ownedCosmetics) }
  ],
  rare: [
    { id: 'crystals', weight: 26, build: () => { const a = rand(6, 10); return { kind: 'crystals', amount: a, name: 'Cristales de Mejora', label: `+${a} Cristales`, details: 'Sube el nivel del recolector', rarity: 'Épico', icon: 'crystal', materialTier: 1 }; } },
    { id: 'companion_t3', weight: 24, build: () => { const t = TIER_SYSTEM.ranges[3]; const p = rand(t[0], t[1]); return { kind: 'companion', amount: 1, name: 'Artillero Táctico', label: 'Artillero Táctico', details: `Recolección por segundo: +${p}/s`, rarity: 'Épico', icon: 'bolt', tier: 3, item: { id: `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Artillero Táctico', type: 'companion', details: `Recolección por segundo: +${p}/s`, rarity: 'Épico', tier: 3, companionType: 'passive', power: p, sellPrice: 400 } }; } },
    { id: 'collector_t4', weight: 20, build: () => { const w = makeOverclockCollector(4); return { kind: 'collector', amount: 1, name: w.name, label: w.name, details: w.details, rarity: w.rarity, icon: 'collector', tier: 4, item: w.item }; } },
    { id: 'epic_crate', weight: 16, build: () => ({ kind: 'crate', amount: 1, name: 'Caja Épica', label: '+1 Caja Épica', details: 'Abre una caja de botín superior', rarity: 'Épico', icon: 'crystal', item: { id: `crate_epic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Caja Épica', type: 'crate', details: 'Contiene recompensas altas', rarity: 'Épico', tier: 0, sellPrice: 1125, stackable: true, stackCount: 1 } }) },
    { id: 'keys', weight: 14, build: () => { const a = rand(2, 4); return { kind: 'keys', amount: a, name: 'Llave Reforzada', label: `+${a} Llaves Reforzadas`, details: 'Abre Cofres Raros, Épicos y Legendarios', rarity: 'Épico', icon: 'key', keyTier: 1 }; } },
    { id: 'cosmetic', weight: 5, build: (ctx) => rollCrateCosmetic('rare', ctx.ownedCosmetics) }
  ],
  epic: [
    { id: 'crystals', weight: 22, build: () => { const a = rand(16, 24); return { kind: 'crystals', amount: a, name: 'Cristales de Mejora', label: `+${a} Cristales`, details: 'Sube el nivel del recolector', rarity: 'Legendario', icon: 'crystal', materialTier: 1 }; } },
    { id: 'calibration_stone', weight: 18, build: () => { const a = rand(1, 2); return { kind: 'consumable', amount: a, name: 'Piedra de Calibración', label: `${a} Piedra${a > 1 ? 's' : ''} de Calibración`, details: 'Sube 12 puntos la probabilidad de la próxima fusión', rarity: 'Raro', icon: 'flask', item: { id: `crate_stone_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Piedra de Calibración', type: 'consumable', details: 'Sube 12 puntos la probabilidad de la próxima fusión', rarity: 'Raro', buffId: 'calibrationStone', stackable: true, stackCount: a, sellPrice: 11250 } }; } },
    { id: 'companion_t6', weight: 20, build: () => { const t = TIER_SYSTEM.ranges[6]; const p = rand(t[0], t[1]); return { kind: 'companion', amount: 1, name: 'Titán de Acero', label: 'Titán de Acero', details: `Recolección por segundo: +${p}/s`, rarity: 'Legendario', icon: 'companion', tier: 6, item: { id: `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Titán de Acero', type: 'companion', details: `Recolección por segundo: +${p}/s`, rarity: 'Legendario', tier: 6, companionType: 'passive', power: p, sellPrice: 2500 } }; } },
    { id: 'collector_oc6', weight: 16, build: () => { const w = makeOverclockCollector(6); return { kind: 'collector', amount: 1, name: w.name, label: w.name, details: w.details, rarity: w.rarity, icon: 'collector', tier: 6, item: w.item }; } },
    { id: 'ghost', weight: 12, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[0]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'sparkle', item: c.item, exclusive: true }; } },
    { id: 'phoenix', weight: 10, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[3]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'bolt', item: c.item, exclusive: true }; } },
    { id: 'legendary_crate', weight: 10, build: () => ({ kind: 'crate', amount: 1, name: 'Caja Legendaria', label: '+1 Caja Legendaria', details: 'Abre una caja de botín máximo', rarity: 'Legendario', icon: 'trophy', item: { id: `crate_legendary_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Caja Legendaria', type: 'crate', details: 'Contiene recompensas máximas', rarity: 'Legendario', tier: 0, sellPrice: 4500, stackable: true, stackCount: 1 } }) },
    { id: 'cosmetic', weight: 6, build: (ctx) => rollCrateCosmetic('epic', ctx.ownedCosmetics) }
  ],
  legendary: [
    { id: 'crystals', weight: 20, build: () => { const a = rand(45, 65); return { kind: 'crystals', amount: a, name: 'Cristales de Mejora', label: `+${a} Cristales`, details: 'Sube el nivel del recolector', rarity: 'Mítico', icon: 'crystal', materialTier: 2 }; } },
    { id: 'collector_oc8', weight: 18, build: () => { const w = makeOverclockCollector(8); return { kind: 'collector', amount: 1, name: w.name, label: w.name, details: w.details, rarity: w.rarity, icon: 'collector', tier: 8, item: w.item }; } },
    { id: 'stability_nano', weight: 14, build: () => ({ kind: 'consumable', amount: 1, name: 'Nanopartícula de Estabilidad', label: 'Nanopartícula de Estabilidad', details: 'Deja el recolector forjado con un afijo garantizado', rarity: 'Legendario', icon: 'flask', item: { id: `crate_nano_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Nanopartícula de Estabilidad', type: 'consumable', details: 'Deja el recolector forjado con un afijo garantizado', rarity: 'Legendario', buffId: 'stabilityNano', stackable: true, stackCount: 1, sellPrice: 55000 } }) },
    { id: 'avatar', weight: 16, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[2]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'globe', item: c.item, exclusive: true }; } },
    { id: 'oracle', weight: 14, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[1]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'crystal', item: c.item, exclusive: true }; } },
    { id: 'sentinel', weight: 12, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[4]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'shield', item: c.item, exclusive: true }; } },
    { id: 'keys', weight: 8, build: () => { const a = rand(5, 8); return { kind: 'keys', amount: a, name: 'Llave Rúnica', label: `+${a} Llaves Rúnicas`, details: 'Abre Cofres Épicos y Legendarios', rarity: 'Legendario', icon: 'key', keyTier: 2 }; } },
    { id: 'cosmetic', weight: 6, build: (ctx) => rollCrateCosmetic('legendary', ctx.ownedCosmetics) }
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
  crystals: (n: number, tier: number) => void;
  /** `tier` es el nivel de llave que ANUNCIA el botín. No es opcional: ignorarlo
   *  es lo que hacía que la ruleta prometiese una llave y entregara otra. */
  keys: (n: number, tier: KeyTier) => void;
  addItem: (item: any) => boolean;
  hasSpace: () => boolean;
  /** Desbloquea un cosmético. `false` si ya lo tenía. */
  unlockCosmetic: (cosmeticId: string) => boolean;
  /** Cosméticos que ya tiene, para no sortear un duplicado. */
  ownedCosmetics: () => string[];
};

/**
 * Cuánto vale realmente el botín de una entrada de la tabla.
 *
 * La tabla guarda números "de autor": 250-400 nanitas, 2-4 cristales. Eso es lo
 * que cuesta la caja, no lo que recibe el jugador. La conversión va aquí para
 * que la cifra que la ruleta enseña y la que entra en la cuenta sean SIEMPRE la
 * misma. Si cada sitio calculara su propia versión, la casilla podría prometer
 * +350 y el saldo sumar +11.667, y el jugador no sabría si el número es premio
 * o error.
 *
 * Solo devuelve el botín: aplicarlo es cosa de quien sortea, porque aplicar
 * implica tocar el estado del jugador.
 */
export function resolveLootAmount(crateType: CrateType, entry: Omit<CrateReward, 'exclusive'> & { exclusive?: boolean }): CrateReward {
  const base: CrateReward = { ...entry, exclusive: entry.exclusive ?? false };

  if (base.kind === 'nanites') {
    const value = Math.round(base.amount * CRATE_META[crateType].cost / 12);
    return { ...base, amount: value, label: `+${value} Nanitas` };
  }
  if (base.kind === 'crystals') {
    const value = Math.round(base.amount * (1 + RARITY_RANK[base.rarity] * 0.25));
    return { ...base, amount: value, label: `+${value} Cristales de Mejora` };
  }
  // Las llaves no se reescalan: la entrada ya trae su cantidad y su `label`
  // redactado ("+2 Llaves Reforzadas"). Concatenarle un "s" al nombre salía
  // "Llave de Cifrados", que es peor que no escribir nada.
  return base;
}

/**
 * ¿Este premio tiene una cifra que el jugador debería ver?
 *
 * Las monedas y los materiales siempre (aunque caiga uno solo: "1 llave" sigue
 * siendo una cantidad, y el jugador la contaría con los dedos). Los objetos,
 * solo cuando caen varios de una vez: un "+1 Dron" es ruido, el nombre ya lo
 * dice.
 */
export function isCountedLoot(reward: CrateReward): boolean {
  if (reward.kind === 'nanites' || reward.kind === 'crystals' || reward.kind === 'keys') return true;
  if (reward.kind === 'crate' || reward.kind === 'consumable') return reward.amount > 1;
  return false;
}

/**
 * La cifra del premio, formateada para pantalla: `+250`, `+8.33 K`.
 *
 * Usa el mismo `formatNumber` que los contadores del juego a propósito: si la
 * ruleta escribiera `8.332` y el saldo `8.33 K`, el jugador leería dos números
 * distintos para la misma cantidad.
 *
 * Vive aquí y no en la ruleta porque la usan los tres sitios que enseñan botín
 * (la casilla que gana, el cartel del resultado y las distracciones de la tira).
 * Tres copias de un `toLocaleString` divergen tarde: una se olvidaría del `+` y
 * el jugador leería un gasto donde tenía un premio.
 */
export function lootAmountText(reward: CrateReward): string {
  return `+${formatNumber(reward.amount)}`;
}

/**
 * Decide el premio y lo aplica. Si el almacén está lleno y el drop es un item,
 * se compensa en nanitas para no perderlo nunca.
 */
export function rollCrateReward(crateType: CrateType, applier: LootApplier): CrateReward {
  const entry = pickLoot(crateType);
  const ctx: LootBuildContext = { ownedCosmetics: applier.ownedCosmetics() };
  const built = entry.build(ctx);

  // La entrada sorteó un cosmético que el jugador ya tenía todos. No es un fallo:
  // es el premio que toca, y la ruleta tiene que poder enseñarlo. Se compensa
  // en nanitas con el MISMO criterio que el almacén lleno, para que el jugador
  // no salga peor que si el botín hubiera caído en cualquier otra cosa.
  if (!built) {
    const dup = naniteCompensation(crateType, 'Ya tienes todos los cosméticos de esta caja');
    applier.nanites(dup.amount);
    return dup;
  }

  const reward = resolveLootAmount(crateType, built);

  switch (reward.kind) {
    case 'nanites': {
      applier.nanites(reward.amount);
      return reward;
    }
    case 'crystals': {
      // El botín da el cristal del nivel que declara la entrada. Los
      // superiores no se sortean: son premio de la caja legendaria.
      applier.crystals(reward.amount, reward.materialTier ?? 1);
      return reward;
    }
    case 'keys': {
      applier.keys(reward.amount, reward.keyTier ?? 0);
      return reward;
    }
    case 'cosmetic': {
      // Un cosmético no ocupa ranura ni se vende: va directo a la lista de
      // desbloqueados, así que aquí no cabe la compensación de "almacén lleno".
      if (applier.unlockCosmetic(reward.cosmeticId!)) return reward;
      // Si aun así lo tenía, `ownedCosmetics` mentía o alguien lo desbloqueó
      // entre la consulta y el sorteo. Se compensa igual: no se pierde nada.
      const dup = naniteCompensation(crateType, 'Ya lo tenías');
      applier.nanites(dup.amount);
      return dup;
    }
    default: {
      // El resto son items: entran al almacén o se compensan
      const stored = reward.item ? applier.addItem(reward.item) : false;
      if (stored) return reward;
      const full = naniteCompensation(crateType, 'No cabía el objeto, se compensó en nanitas');
      applier.nanites(full.amount);
      return { ...full, name: 'Compensación', label: `Almacén lleno: +${full.amount} Nanitas` };
    }
  }
}

/**
 * El premio de consolación: las mismas nanitas que dejaría un objeto sin sitio.
 *
 * Una sola función para los dos casos (almacén lleno y cosmético repetido) a
 * propósito. Si cada uno calculara su propio importe, el repetido acabaría
 * pagándose más que el premio de verdad y la ruleta enseñaría un número que
 * contradice a la tabla.
 */
function naniteCompensation(crateType: CrateType, details: string): CrateReward {
  const compensation = Math.round(CRATE_META[crateType].cost * 1.5);
  return {
    kind: 'nanites',
    amount: compensation,
    name: 'Compensación',
    label: `+${compensation} Nanitas`,
    details,
    rarity: 'Común',
    icon: 'bolt',
    exclusive: false
  };
}

/**
 * Tira de casillas para la ruleta. El premio real va en `winIndex`; el resto son
 * distracciones sacadas de la misma tabla, con los exclusivos diluidos para que
 * el jackpot se sienta ganado y no regalado.
 */
export function buildRouletteStrip(crateType: CrateType, length = 26) {
  const table = CRATE_LOOT[crateType];
  const tiles: RouletteTile[] = [];

  // Las distracciones no son premios: se muestran con la lista de cosméticos
  // VACÍA a propósito, para que aparezcan y el jackpot se lea como "ha estado a
  // punto". Una casilla de adorno no puede saber qué tiene el jugador.
  const ctx: LootBuildContext = { ownedCosmetics: [] };

  // Sesgo hacia lo común: los exclusivos aparecen menos en la tira que en la
  // probabilidad real, así el final se lee como "ha estado a punto"
  const exclusiveIds = ['ghost', 'phoenix', 'avatar', 'oracle', 'sentinel', 'collector_oc6', 'collector_oc8', 'collector_t4'];
  const exclusiveEntries = table.filter(e => exclusiveIds.includes(e.id));

  for (let i = 0; i < length; i++) {
    // Muy bajo a proposito: si la tira muestra muchos exclusivos, el jackpot
    // deja de sentirse raro y el "casi me toca" se pierde
    const useExclusive = exclusiveEntries.length > 0 && Math.random() < 0.07;
    const src = useExclusive
      ? exclusiveEntries[Math.floor(Math.random() * exclusiveEntries.length)]
      : table[Math.floor(Math.random() * table.length)];
    // `null` solo si la entrada sorteada no tiene nada que dar, y con la lista
    // vacía eso no ocurre. Aun así se salta: una casilla de adorno no puede
    // quedarse sin contenido y dejar un hueco en la tira.
    const preview = src.build(ctx);
    if (preview) tiles.push(makeRouletteTile(resolveLootAmount(crateType, preview)));
  }
  return { tiles };
}

/** Casilla de la ruleta: nombre, cifra si el botín se cuenta, y rareza. */
export function makeRouletteTile(reward: CrateReward): RouletteTile {
  return {
    label: reward.name.length > 16 ? reward.name.slice(0, 15) + '…' : reward.name,
    amount: isCountedLoot(reward) ? lootAmountText(reward) : undefined,
    sub: reward.rarity,
    rarity: reward.rarity,
    icon: reward.icon
  };
}
