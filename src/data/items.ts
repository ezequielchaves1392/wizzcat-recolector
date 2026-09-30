// ==========================================================================
// Llaves, cofres y cristales de mejora
//
// ANTES: llaves y cristales eran CONTADORES sueltOS (`state.keys`,
// `state.upgradeCrystals`) que no occupaban ranura. Eso rompía tres cosas:
//
//   1. no se podían ordenar ni ver: eran un número suelto en la cabecera
//   2. al vender o abrir algo, el contador y el almacén se desincronizaban
//   3. no había forma de gastar una llave "de más" en un cofre correcto
//
// AHORA: llaves y cristales son ÍTEMS FÍSICOS del almacén. Cada cofre declara
// qué llave abre, y cada cristal tiene su propio multiplicador de éxito. El
// almacén es la única fuente de verdad; el contador es una vista derivada que
// se recalcula, igual que ya se hacía con las cajas.
//
// Decisión de diseño: la llave BASE sí se compra en la tienda, porque es la
// moneda de arranque. Las demás salen de las cajas. Así la tienda no dice
// "llave" y sí te lo pone fácil, pero elfarmeo sigue teniendo peso.
// ==========================================================================

import type { Rarity } from '../types/domain';

/**
 * Tipos de cofre.
 *
 * No se reexportan aquí: viven en `gameLoop` porque `CRATE_TYPES` —el objeto
 * que las describe— está acoplado al botín. Este módulo lo importa para leer
 * `CRATE_KEY_TIER` sin crear un ciclo con el game loop.
 */
import type { CrateType } from '../gameLoop';

/** Nivel de llave: 0 = base (comprable), 1+ = solo de cajas. */
export type KeyTier = 0 | 1 | 2 | 3;

/**
 * Llaves.
 *
 * El nombre de la llave incluye el nivel, y el cofre declara el suyo. Abrir
 * un cofre con llave equivocada no es un error: no pasa nada y el juego lo
 * dice, para que el jugador aprenda qué caja necesita.
 *
 * `onlyKeyTier` es el nivel de llave que abre ESTE cofre. Un cofre también
 * acepta cualquier llave de nivel igual o SUPERIOR: una llave legendaria abre
 * una caja común. Al revés no, porque entonces la rarerza de la llave no
 * diría nada.
 */
export interface KeyDef {
  tier: KeyTier;
  name: string;
  details: string;
  rarity: Rarity;
  /** ¿Se puede comprar en la tienda? */
  buyable: boolean;
  /** Precio en nanitas, o null si no se vende. */
  cost: number | null;
  /** Probabilidad de que una caja de este tipo la suelte, en porcentaje. */
  dropRate: number;
}

/**
 * El nivel de llave se compara por índice, no por rareza textual: "Épico" no
 * ordena de forma fiable entre idiomas y es un dato editable desde Firestore.
 */
export const KEY_TIER_ORDER: KeyTier[] = [0, 1, 2, 3];

export const KEY_DEFS: Record<KeyTier, KeyDef> = {
  0: {
    tier: 0,
    name: 'Llave de Cifrado',
    details: 'Abre Cofres Comunes y Raros.',
    rarity: 'Común',
    buyable: true,
    cost: 480,
    dropRate: 0
  },
  1: {
    tier: 1,
    name: 'Llave Reforzada',
    details: 'Abre Cofres Raros, Épicos y Legendarios.',
    rarity: 'Raro',
    buyable: false,
    cost: null,
    dropRate: 22
  },
  2: {
    tier: 2,
    name: 'Llave Rúnica',
    details: 'Abre Cofres Épicos y Legendarios.',
    rarity: 'Épico',
    buyable: false,
    cost: null,
    dropRate: 14
  },
  3: {
    tier: 3,
    name: 'Llave del Vacío',
    details: 'Abre cualquier cofre. La más rara.',
    rarity: 'Legendario',
    buyable: false,
    cost: null,
    dropRate: 4
  }
};

/** Qué llave necesita cada cofre. */
export const CRATE_KEY_TIER: Record<CrateType, KeyTier> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3
};

/**
 * Cristales de mejora.
 *
 * Cada nivel multiplica la probabilidad de éxito de la sintonización. El
 * cristal básico se compra; los superiores salen de las cajas altas.
 *
 * El multiplicador está en pasos discretos, no en un porcentaje arbitrario:
 * el jugador puede calcular mentalmente "mi cristal da x2" y decidir sin
 * hacer cuentas. Un 1.87x o un 2.14x obligaría atrustar el número de la
 * interfaz.
 */
export interface CrystalDef {
  tier: number;
  name: string;
  details: string;
  rarity: Rarity;
  buyable: boolean;
  cost: number | null;
  /** Multiplicador de probabilidad de éxito. */
  power: number;
  dropRate: number;
}

export const CRYSTAL_DEFS: Record<number, CrystalDef> = {
  1: {
    tier: 1,
    name: 'Cristal de Afino',
    details: 'x1 a la probabilidad de mejora.',
    rarity: 'Común',
    buyable: true,
    cost: 1_440,
    power: 1,
    dropRate: 0
  },
  2: {
    tier: 2,
    name: 'Cristal de Fase',
    details: 'x1.75 a la probabilidad de mejora.',
    rarity: 'Raro',
    buyable: false,
    cost: null,
    power: 1.75,
    dropRate: 20
  },
  3: {
    tier: 3,
    name: 'Cristal de Entropía',
    details: 'x2.75 a la probabilidad de mejora.',
    rarity: 'Épico',
    buyable: false,
    cost: null,
    power: 2.75,
    dropRate: 12
  },
  4: {
    tier: 4,
    name: 'Cristal Singular',
    details: 'x4 a la probabilidad de mejora. Casi nunca falla.',
    rarity: 'Legendario',
    buyable: false,
    cost: null,
    power: 4,
    dropRate: 4
  }
};

/** Nivel de cristal más alto conocido. */
export const MAX_CRYSTAL_TIER = 4;

/** Nivel de llave más alto conocido. */
export const MAX_KEY_TIER = 3;

/**
 * Probabilidad de éxito de una sintonización con el cristal dado.
 *
 * Fórmula base: `95 - nivel·3`, con suelo en 35. Es alta al principio y se
 * estrecha al final, así que el jugador sube deprisa las primeras niveles y
 * tiene que decidir cuánto arriesgar en las últimas.
 *
 * El cristal multiplica DESPUÉS de aplicar el suelo, no antes. Si
 * multiplicara antes, un cristal x4 con el suelo en 35 daría 140; el recorte
 * al 95 se comería la diferencia casi entera y el cristal caro no valdría su
 * precio. El techo del 95% es intencionado —nunca hay fallo garantizado, solo
 * improbable— para que la mejora siempre se sienta posible.
 */
export function crystalSuccessChance(level: number, crystalPower: number): number {
  const base = Math.max(35, 95 - level * 3);
  return Math.min(95, Math.round(base * crystalPower));
}

/**
 * Devuelve el multiplicador de un cristal por su etiqueta.
 *
 * Se busca por etiqueta y no por un campo `tier` guardado, porque las partidas
 * viejas no tienen ese campo y porque la etiqueta es lo que el jugador ve.
 * Si el nombre no se reconoce, se cae al cristal básico: una mejora nunca
 * debe fallar por un dato corrupto.
 */
export function crystalPowerFromName(name: string): number {
  const n = (name || '').toLowerCase();
  if (n.includes('singular')) return CRYSTAL_DEFS[4].power;
  if (n.includes('entrop')) return CRYSTAL_DEFS[3].power;
  if (n.includes('fase')) return CRYSTAL_DEFS[2].power;
  return CRYSTAL_DEFS[1].power;
}

/** Devuelve el nivel de llave a partir del nombre del item. */
export function keyTierFromName(name: string): KeyTier {
  const n = (name || '').toLowerCase();
  if (n.includes('vacio') || n.includes('vacío')) return 3;
  if (n.includes('rúnica') || n.includes('runica')) return 2;
  if (n.includes('reforzada')) return 1;
  return 0;
}

/**
 * Una llave de nivel `held` ¿abre un cofre de nivel `needed`?
 *
 * La regla es "igual o superior": una llave del Vacío abre una caja común.
 * Al revés no, porque entonces el nivel de la llave no comunicaría nada.
 */
export function keyOpens(keyHeld: KeyTier, keyNeeded: KeyTier): boolean {
  return KEY_TIER_ORDER.indexOf(keyHeld) >= KEY_TIER_ORDER.indexOf(keyNeeded);
}

/** Mismo criterio, sobre nombres. Pensado para pintar el botón de abrir. */
export function keyNameOpensCrate(keyName: string, crateType: CrateType): boolean {
  return keyOpens(keyTierFromName(keyName), CRATE_KEY_TIER[crateType]);
}