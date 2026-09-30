// ==========================================================================
// Valoración dinámica de armas
//
// El precio de venta ya no es un número escrito en el item: se calcula. Eso
// hace que dos armas del mismo tier puedan valer muy distinto, y que mejorar
// una arma tenga un valor de reventa que sube con ella.
//
// Fórmula base:  valor = tierBase × nivelMult × rarezaMult × potencialMult
//                       × afijos × autor × mercado
//
// La compra de material de crafteo se compara contra el valor de SALIDA del
// producto, no contra un número fijo. Así el equilibrio de la forja se puede
// verificar con aritmética en vez de jugando 200 fusiones.
// ==========================================================================

import type { Rarity, WeaponItem } from '../types/domain';
import { AFFIX_BY_ID } from './crafting';
import { TIER_SYSTEM } from './tiers';

/** Valor de referencia de un arma base de cada tier (sin nivel ni afijos). */
const TIER_BASE_VALUE: Record<number, number> = {
  1: 220, 2: 480, 3: 1000, 4: 2100, 5: 4400,
  6: 9200, 7: 19000, 8: 39000, 9: 80000, 10: 162000, 11: 330000
};

/**
 * Multiplicador de valor por rareza.
 *
 * Calibrado contra la forja: si la rareza multiplica demasiado, la fusión pasa
 * de "rentable" (1.8x) a "imprescindible" (10x) y el crafteo se traga el juego.
 * Con estos valores la rentabilidad está entre 1.3x y 2.2x en todo el rango:
 * merece la pena, pero no rompe nada.
 */
const RARITY_VALUE_MULT: Record<Rarity, number> = {
  'Común': 1.00,
  'Raro': 1.30,
  'Épico': 1.70,
  'Legendario': 2.20,
  'Mítico': 2.80,
  'Divino': 3.60,
  'Sobrecargado': 2.40
};

/** Cada nivel del arma suma un porcentaje creciente del valor base. */
export function levelValueMult(level: number, maxLevel = 20): number {
  if (level <= 0) return 1;
  // 0.06 por nivel hasta la mitad, 0.10 después: premia llevar el arma lejos
  const half = maxLevel / 2;
  let mult = 1;
  for (let i = 0; i < level; i++) {
    mult += i < half ? 0.06 : 0.10;
  }
  return mult;
}

export function potentialValueMult(potential: number): number {
  if (!potential) return 1;
  return 1 + (potential - 1) * 0.45;
}

export function affixValueMult(weapon: WeaponItem): number {
  if (!weapon.affixes?.length) return 1;
  let mult = 1;
  for (const id of weapon.affixes) {
    const a = AFFIX_BY_ID[id];
    if (!a) continue;
    // Cada afijo aporta según lo que hace, no por su rareza nominal
    let contrib = 0;
    if (a.effect.clickMult) contrib += a.effect.clickMult * 0.8;
    if (a.effect.passiveMult) contrib += a.effect.passiveMult * 0.8;
    if (a.effect.flatDamage) contrib += Math.min(0.5, a.effect.flatDamage / 400);
    if (a.effect.flatPassive) contrib += Math.min(0.5, a.effect.flatPassive / 400);
    if (a.effect.critChance) contrib += a.effect.critChance * 2.5;
    if (a.effect.craftLuck) contrib += a.effect.craftLuck * 1.5;
    mult += contrib;
  }
  return mult;
}

/**
 * Prima de fama: un arma forjada por alguien conocido vale más, pero no rinde
 * más. Es el separador entre "objeto" y "trofeo".
 */
export function fameValueMult(authorRank: number | null): number {
  if (authorRank === null) return 1;
  // Top 1 → ×2.2, Top 10 → ×1.5, Top 100 → ×1.2
  if (authorRank <= 1) return 2.2;
  if (authorRank <= 3) return 1.8;
  if (authorRank <= 10) return 1.5;
  if (authorRank <= 50) return 1.3;
  if (authorRank <= 100) return 1.2;
  return 1.05;
}

/**
 * Deriva del mercado: un arma recién forjada se vende algo más cara y se
 * estabiliza. Se calcula con la edad, sin estado global.
 */
export function marketAgeMult(forgedAt: number | undefined): number {
  if (!forgedAt) return 1;
  const ageDays = (Date.now() - forgedAt) / 86_400_000;
  if (ageDays < 1) return 1.35;      // frescura
  if (ageDays < 7) return 1.15;
  if (ageDays < 30) return 1.0;
  if (ageDays < 90) return 0.94;
  return 0.88;
}

export interface ValuationOptions {
  /** Posición del autor en el ranking, si el autor es conocido. */
  authorRank?: number | null;
  /** Bonificación de venta del árbol de pasivas. */
  sellMult?: number;
}

export function weaponValue(weapon: WeaponItem, opts: ValuationOptions = {}): number {
  const base = TIER_BASE_VALUE[Math.max(1, Math.min(weapon.tier, 11))] ?? 200;
  const levelMult = levelValueMult(weapon.level || 0, weapon.maxLevel ?? 20);
  const rarityMult = RARITY_VALUE_MULT[weapon.rarity] ?? 1;
  const potMult = potentialValueMult(weapon.potential ?? 0);
  const affMult = affixValueMult(weapon);
  const fameMult = fameValueMult(opts.authorRank ?? null);
  const ageMult = marketAgeMult(weapon.forgedAt);
  const passives = opts.sellMult ?? 1;

  const raw = base * levelMult * rarityMult * potMult * affMult * fameMult * ageMult * passives;
  // Redondeo a 3 cifras significativas: evita precios de 41.337 que rompen la
  // lectura rápida de un inventario
  const magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 2));
  return Math.round(raw / magnitude) * magnitude;
}

/**
 * Precio de venta. El jugador recibe el 42% del valor: el resto cubre el
 * inputs consumidos y deja margen al mercado.
 */
export function sellPrice(weapon: WeaponItem, opts: ValuationOptions = {}): number {
  return Math.max(1, Math.floor(weaponValue(weapon, opts) * 0.42));
}

/** Coste de una Piedra de Calibración en la tienda. */
export const CALIBRATION_STONE_COST = 45_000;

/** Coste de una Nanopartícula de Estabilidad (el consumible premium). */
export const STABILITY_NANOPARTICLE_COST = 220_000;

/**
 * Comprueba si una fusión está "razonable" desde el punto de vista económico:
 * el valor de salida debe superar siempre al input. Se usa en los tests.
 */
export function fusionIsProfitable(
  inputs: WeaponItem[],
  output: WeaponItem,
  opts: ValuationOptions = {}
): boolean {
  const inValue = inputs.reduce((a, w) => a + weaponValue(w, opts), 0);
  const outValue = weaponValue(output, opts);
  return outValue > inValue * 1.15;
}

/** Resumen legible para la tarjeta del item. */
export function valuationBreakdown(weapon: WeaponItem, opts: ValuationOptions = {}): string[] {
  const out: string[] = [];
  const base = TIER_BASE_VALUE[Math.max(1, Math.min(weapon.tier, 11))] ?? 200;
  out.push(`Base T${weapon.tier}: ${fmt(base)}`);
  if (weapon.level) out.push(`Nivel ${weapon.level}: ×${levelValueMult(weapon.level, weapon.maxLevel ?? 20).toFixed(2)}`);
  out.push(`Rareza ${weapon.rarity}: ×${(RARITY_VALUE_MULT[weapon.rarity] ?? 1).toFixed(2)}`);
  if (weapon.potential) out.push(`Potencial ${weapon.potential}★: ×${potentialValueMult(weapon.potential).toFixed(2)}`);
  if (weapon.affixes?.length) out.push(`${weapon.affixes.length} afijo(s): ×${affixValueMult(weapon).toFixed(2)}`);
  if (opts.authorRank != null) out.push(`Autor top ${opts.authorRank}: ×${fameValueMult(opts.authorRank).toFixed(2)}`);
  return out;
}

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
  return String(Math.round(n));
}
