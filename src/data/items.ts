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
 * Tipos de cofre y sus nombres.
 *
 * Se importan como VALOR, no solo como tipo, y es lo que hace que el `details` de
 * una llave pueda escribirse solo: el texto sale de `CRATE_TYPES`, que es donde
 * vive el nombre de cada caja, y de `CRATE_KEY_TIER`, que es donde vive la regla
 * de qué llave la abre. Las dos mitades de la frase salen de las dos tablas que
 * ya existían y no se añade ninguna tercera.
 *
 * Este módulo ya dependía de `store.ts` (por el tipo `CrateType`), así que esto
 * no crea un ciclo nuevo: la flecha va en el mismo sentido.
 */
import { CRATE_TYPES, KEY_COSTS, type CrateType } from './store';

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
  /**
   * El nombre en plural, y va aparte a propósito.
   *
   * No sale de `name` con un regla, porque el plural en español no lo es: de
   * "Llave Rúnica" sale "Llaves Rúnicas" (con la "s" en el adjetivo) y de
   * "Llave de Cifrado" sale "Llaves de Cifrado" (sin nada que cambiar al final).
   * Añadirle una "s" a la primera palabra leyó "+2 Llaves Rúnica", que está mal,
   * y un banco que solo miraba si la etiqueta contenía "Llaves" lo daba por
   * bueno. Es un nombre, y un nombre se escribe entero.
   */
  namePlural: string;
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

/** Qué llave necesita cada cofre. */
export const CRATE_KEY_TIER: Record<CrateType, KeyTier> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3
};

/**
 * Los cofre que abre una llave de este nivel, de menor a mayor.
 *
 * ES LA MISMA PREGUNTA QUE `keyOpens`, CON EL MISMO CRITERIO, y por eso no es
 * una segunda regla: sale de llamar a `keyOpens`. Antes esta lista estaba
 * escrita a mano en el `details` de cada llave, y las cuatro mentían (B6): la
 * Cifrada decía "Comunes y Raros" sin abrir las raras, y la Rúnica decía
 * "Épicos y Legendarios" sin abrir las legendarias. Un texto derivado no puede
 * mentir porque no hay nadie que lo escriba.
 */
export function cratesOpenedBy(keyTier: KeyTier): CrateType[] {
  return (Object.keys(CRATE_KEY_TIER) as CrateType[])
    .filter(c => keyOpens(keyTier, CRATE_KEY_TIER[c]))
    .sort((a, b) => CRATE_KEY_TIER[a] - CRATE_KEY_TIER[b]);
}

/** El `details` de una llave, generado con el mismo criterio que la regla. */
function detailsDeLlave(keyTier: KeyTier): string {
  const nombres = cratesOpenedBy(keyTier).map(c => CRATE_TYPES[c].name);
  if (nombres.length === 0) return 'No abre ningún cofre.';
  if (nombres.length === 1) return `Abre ${nombres[0]}.`;
  const ultimo = nombres.pop();
  return `Abre ${nombres.join(', ')} y ${ultimo}.`;
}

/**
 * Las cuatro llaves, con su texto generado. Su PRECIO no está aquí: está en
 * `KEY_COSTS` (`data/store.ts`), que es el fichero de los precios, y las cuatro
 * cartas de la tienda lo leen de ahí. Con el precio en dos sitios fue como la
 * tienda acabó vendiendo una carta llamada "Llave de Cifrado" que entregaba la
 * Reforzada (B7): nombre en un sitio, entrega en otro, precio en un tercero.
 *
 * POR QUÉ LAS CUATRO SON COMPRABLES. La cadena de llaves era una escalera
 * imposible (B6): la del Vacío no salía de ninguna parte, así que la caja
 * legendaria no se podía abrir nunca, y la Rúnica solo salía de la legendaria.
 * Cerrar el botín arregla medio problema, pero deja la tienda como una red de
 * seguridad cara: si un jugador llega a la legendaria sin llave, tiene que poder
 * comprarla. Con las cuatro a la venta, ningún cofre es inalcanzable por
 * defecto y la tienda deja de ser un callejón sin salida.
 */
export const KEY_DEFS: Record<KeyTier, KeyDef> = {
  0: {
    tier: 0,
    name: 'Llave de Cifrado',
    namePlural: 'Llaves de Cifrado',
    details: detailsDeLlave(0),
    rarity: 'Común',
    buyable: true,
    cost: KEY_COSTS[0],
    dropRate: 0
  },
  1: {
    tier: 1,
    name: 'Llave Reforzada',
    namePlural: 'Llaves Reforzadas',
    details: detailsDeLlave(1),
    rarity: 'Raro',
    buyable: true,
    cost: KEY_COSTS[1],
    dropRate: 22
  },
  2: {
    tier: 2,
    name: 'Llave Rúnica',
    namePlural: 'Llaves Rúnicas',
    details: detailsDeLlave(2),
    rarity: 'Épico',
    buyable: true,
    cost: KEY_COSTS[2],
    dropRate: 14
  },
  3: {
    tier: 3,
    name: 'Llave del Vacío',
    namePlural: 'Llaves del Vacío',
    details: detailsDeLlave(3),
    rarity: 'Legendario',
    buyable: true,
    cost: KEY_COSTS[3],
    dropRate: 4
  }
};

/**
 * Qué carta de la tienda vende cada llave: `keyT0` → nivel 0, y así.
 *
 * ESTE MAPA ES LO QUE ARREGLA B7, y existe para que nadie tenga que escribir el
 * nivel otra vez. El fallo era que la compra usaba un `STORE_MATERIAL_TIER`
 * único para todas las llaves: una sola carta, un solo nivel, y el nombre de la
 * carta ('Llave de Cifrado') no tenía nada que ver con lo que entraba al
 * almacén. Con el nivel saliendo del nombre de la carta, el nombre y el item
 * son lo mismo por construcción.
 *
 * Va al revés que un parseo de nombre: aquí el nombre de la carta decide el
 * nivel y el nivel decide el nombre del item, en vez de adivinar el nivel a
 * partir del nombre del item. Un item guardado por una partida vieja puede
 * tener cualquier nombre; una carta de tienda es de este fichero.
 */
export const STORE_KEY_TIER: Record<string, KeyTier> = {
  keyT0: 0,
  keyT1: 1,
  keyT2: 2,
  keyT3: 3
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
 *
 * Y LA REGLA NO ES EL BUG DE B6, aunque lo parecía. Con "igual o superior" la
 * Reforzada no abre la épica (1 < 2) ni la legendaria, así que **cada nivel
 * sigue siendo el único que abre su caja** y no hay contenido muerto. Lo que
 * estaba roto era otra cosa, y son tres cosas distintas:
 *
 *   1. los cuatro `details` estaban escritos a mano y los cuatro mentían
 *      (ahora se generan con esta misma función, así que no pueden);
 *   2. la llave del Vacío no salía de ninguna parte, así que la caja
 *      legendaria era imponible de abrir (B6);
 *   3. la tienda vendía una sola llave, con un nombre y un precio que no eran
 *      los de la llave que entregaba (B7).
 *
 * Dejar la regla como estaba, y documentar por qué, aunque cueste leerlo. Se
 * probó la igualdad exacta ("una llave, una caja") y se volvió atrás: rompe a
 * propósito que la llave del Vacío sirva para las cajas de abajo, que es la
 * mitad de la comodidad del sistema, y F5 no la pedía — pedía que exista una
 * llave por tipo de caja, y con cuatro llaves y cuatro cajas eso ya se cumple.
 */
export function keyOpens(keyHeld: KeyTier, keyNeeded: KeyTier): boolean {
  return KEY_TIER_ORDER.indexOf(keyHeld) >= KEY_TIER_ORDER.indexOf(keyNeeded);
}

/** Mismo criterio, sobre nombres. Pensado para pintar el botón de abrir. */
export function keyNameOpensCrate(keyName: string, crateType: CrateType): boolean {
  return keyOpens(keyTierFromName(keyName), CRATE_KEY_TIER[crateType]);
}