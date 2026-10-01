// ==========================================================================
// Valoración dinámica de recolectores
//
// El precio de venta ya no es un número escrito en el item: se calcula. Eso
// hace que dos recolectores del mismo tier puedan valer muy distinto, y que mejorar
// un recolector tenga un valor de reventa que sube con ella.
//
// Fórmula base:  valor = tierBase × nivelMult × rarezaMult × potencialMult
//                       × afijos × autor × mercado
//
// La compra de material de crafteo se compara contra el valor de SALIDA del
// producto, no contra un número fijo. Así el equilibrio de la forja se puede
// verificar con aritmética en vez de jugando 200 fusiones.
// ==========================================================================

import type { Rarity, CollectorItem } from '../types/domain';
import { AFFIX_BY_ID, collectorMaxLevel, BASE_COLLECTOR_MAX_LEVEL } from './crafting';
import { TIER_SYSTEM } from './tiers';

/** Valor de referencia de un recolector base de cada tier (sin nivel ni afijos). */
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

/** Cada nivel del recolector suma un porcentaje creciente del valor base. */
export function levelValueMult(level: number, maxLevel = BASE_COLLECTOR_MAX_LEVEL): number {
  if (level <= 0) return 1;
  // 0.06 por nivel hasta la mitad, 0.10 después: premia llevar el recolector lejos
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

export function affixValueMult(collector: CollectorItem): number {
  if (!collector.affixes?.length) return 1;
  let mult = 1;
  for (const id of collector.affixes) {
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
 * Prima de fama: un recolector forjado por alguien conocido vale más, pero no rinde
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
 * Deriva del mercado: un recolector recién forjada se vende algo más cara y se
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

export function collectorValue(collector: CollectorItem, opts: ValuationOptions = {}): number {
  const base = TIER_BASE_VALUE[Math.max(1, Math.min(collector.tier, 11))] ?? 200;
  const levelMult = levelValueMult(collector.level || 0, collectorMaxLevel(collector.maxLevel));
  const rarityMult = RARITY_VALUE_MULT[collector.rarity] ?? 1;
  const potMult = potentialValueMult(collector.potential ?? 0);
  const affMult = affixValueMult(collector);
  const fameMult = fameValueMult(opts.authorRank ?? null);
  const ageMult = marketAgeMult(collector.forgedAt);
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
export function sellPrice(collector: CollectorItem, opts: ValuationOptions = {}): number {
  return Math.max(1, Math.floor(collectorValue(collector, opts) * 0.42));
}

/*
 * NO PONGA AQUÍ EL PRECIO DE UN CONSUMIBLE DE LA TIENDA.
 *
 * Aquí no hay precios de tienda, y antes sí los había: `CALIBRATION_STONE_COST`
 * (45 000) y `STABILITY_NANOPARTICLE_COST` (220 000). No los usaba nadie, pero
 * como uno coincidía con la tienda y el otro no, parecía un bug de economy:
 * "la nanopartícula cuesta 90 000 en un sitio y 220 000 en otro". No lo era. Los
 * dos eran constantes muertas y el precio que se cobra y se enseña sale de
 * `STORE_ITEMS` en el game loop, como el de cualquier otra carta. Una segunda
 * copia del precio es exactamente el tipo de cosa que R2 prohíbe: cuando las dos
 * se separan, el juego sigue funcionando bien y el aviso aparece en la
 * documentación, donde no lo lee nadie.
 */

/**
 * ¿La fusión mejora la DENSIDAD de valor del almacén?
 *
 * Se compara el valor POR RANURA, no el valor total, y esa es toda la diferencia.
 * La forja convierte tres recolectores en uno, así que el total baja a propósito en
 * los tiers bajos: medido sobre el juego real, fundir 3 de T1 (1.122 de valor en
 * tres ranuras) da 1 de T2 por 778. Pierde un 36% del total y gana un 108% por
 * ranura.
 *
 * La versión anterior de esta función afirmaba lo contrario —"el valor de salida
 * debe superar al input"—, y estaba rota de una forma que no se veía: era código
 * que no usaba nadie, con un comentario que prometía un test que no existía. Nadie
 * validó nunca esa regla. Comparar totales habría dado que la forja entera es una
 * trampa, cuando lo que compra con tres materiales es una ranura liberada y un
 * recolector mejor.
 *
 * La regla que de verdad sostiene el módulo es la de la ranura: fusionar tiene que
 * dejar más valor por celda ocupada. Si alguna vez la densidad no mejora, fusionar
 * sería indistinguible de vender tres y comprar uno, y el módulo perdería su razón
 * de ser.
 *
 * El margen es del 15%, holgado a propósito: la densidad real sube entre 2,5x y
 * 4,6x según el tier, así que un margen amplio sigue detectando un desequilibrio
 * de verdad sin volverse pesimista con el azar de la forja.
 */
export function fusionImprovesDensity(
  inputs: CollectorItem[],
  output: CollectorItem,
  opts: ValuationOptions = {}
): boolean {
  if (inputs.length === 0) return false;
  const densidadEntrada = inputs.reduce((a, w) => a + collectorValue(w, opts), 0) / inputs.length;
  return collectorValue(output, opts) > densidadEntrada * 1.15;
}

/** Resumen legible para la tarjeta del item. */
export function valuationBreakdown(collector: CollectorItem, opts: ValuationOptions = {}): string[] {
  const out: string[] = [];
  const base = TIER_BASE_VALUE[Math.max(1, Math.min(collector.tier, 11))] ?? 200;
  out.push(`Base T${collector.tier}: ${fmt(base)}`);
  if (collector.level) out.push(`Nivel ${collector.level}: ×${levelValueMult(collector.level, collectorMaxLevel(collector.maxLevel)).toFixed(2)}`);
  out.push(`Rareza ${collector.rarity}: ×${(RARITY_VALUE_MULT[collector.rarity] ?? 1).toFixed(2)}`);
  if (collector.potential) out.push(`Potencial ${collector.potential}★: ×${potentialValueMult(collector.potential).toFixed(2)}`);
  if (collector.affixes?.length) out.push(`${collector.affixes.length} afijo(s): ×${affixValueMult(collector).toFixed(2)}`);
  if (opts.authorRank != null) out.push(`Autor top ${opts.authorRank}: ×${fameValueMult(opts.authorRank).toFixed(2)}`);
  return out;
}

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
  return String(Math.round(n));
}
