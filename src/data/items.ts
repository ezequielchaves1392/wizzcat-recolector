// ==========================================================================
// Cofres y cristales de mejora
//
// **LO QUE QUEDA EN ESTE FICHERO, Y POR QUÉ.** Los cristales de mejora: su tabla
// de niveles, sus nombres, sus rarezas, su multiplicador de éxito y la función
// que deduce el nivel de un nombre viejo. Más dos restos de las llaves, que se
// explican donde están.
//
// ANTES, aquí también estaban las llaves, y eran CONTADORES sueltOS
// (`state.keys`, `state.upgradeCrystals`) que no ocupaban ranura. Eso rompía tres
// cosas:
//
//   1. no se podían ordenar ni ver: eran un número suelto en la cabecera
//   2. al vender o abrir algo, el contador y el almacén se desincronizaban
//   3. no había forma de gastar una llave "de más" en un cofre correcto
//
// Después fueron ÍTEMS FÍSICOS del almacén, y ahora **no existen**: la caja se abre
// sola. El cristal sigue siendo un item físico, y el almacén sigue siendo la
// única fuente de verdad: el contador es una vista derivada que se recalcula,
// igual que ya se hacía con las cajas.
//
// Lo que se conserva de las llaves es una cosa: `KeyTier` y `keyTierFromName()`,
// que usa la redención para entender los items de una partida guardada antes del
// cambio. Están con su motivo, unas líneas más abajo.
// ==========================================================================

import type { Rarity } from '../types/domain';

/**
 * Tipos de cofre y sus nombres.
 *
 * Se importan como VALOR, no solo como tipo.
 *
 * **LO QUE LEÍA DE AQUÍ ANTES, Y QUE YA NO LEE NADA.** El `details` de cada caja
 * se escribía solo con la mitad de la frase de aquí y la otra mitad venía de
 * `CRATE_KEY_TIER`, que vivía en este mismo fichero. Ese es el motivo de que el
 * import fuera de VALOR y no solo de tipo, y **es también el motivo de que ya no
 * tenga que serlo**: la frase entera ("Se abre sola") cabe en la otra tabla.
 *
 * Se queda el import porque `CrateType` sigue haciendo falta, y porque este módulo
 * ya dependía de `store.ts` por el tipo: la flecha va en el mismo sentido, y quitar
 * la segunda mitad de una frase no crea ni quita un ciclo.
 */
import { CRATE_TYPES, type CrateType } from './store';

/**
 * Llaves.
 *
 * El tipo de la llave. **Solo lo leen `keyTierFromName()` y la redención**, que
 * convierte en nanitas las que encuentre en una partida guardada antes del
 * cambio. Se pueden borrar las dos cuando la redención se borre, y no antes.
 */
export type KeyTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * La forma que tenía una llave.
 *
 * **NO LA USA NADIE, Y ES A PROPÓSITO.** La leía la tienda para sacar el nombre,
 * la rareza y el precio de cada carta, y el almacén para el texto del botón. Sin
 * llaves no hay cartas ni botón, así que sus campos no tienen dónde caer.
 *
 * Se deja el tipo entero en vez de borrar sus campos uno a uno porque **es la
 * definición de lo que una llave era**, y la redención la necesita para leer el
 * nivel de los items viejos. Si algún día hay que tocarla, el motivo de que siga
 * aquí está arriba.
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
  /**
   * QUITADO `dropRate` (F31).
   *
   * Decía "probabilidad de que una caja la suelte" y no lo decía de nadie: ni una
   * tabla de botín lo leía, ni la vista, ni un banco. Cuatro números escritos a
   * mano (0, 22, 14 y 4) que además ya no describían nada, porque las cajas
   * pasaron a ser diez y la tabla de botín se escribe sola.
   *
   * Un campo que nadie lee no es documentación: es un sitio donde el próximo que
   * toque la tabla pone un número y cree que significa algo. Si algún día hace
   * falta, sale de `tablaDePesos()`, que es la cuenta real, y no de aquí.
   */
}

/**
 * El nivel de llave se compara por índice, no por rareza textual: "Épico" no
 * ordena de forma fiable entre idiomas y es un dato editable desde Firestore.
 */
/**
 * Cristales de mejora.
 *
 * F26 · **UN CRISTAL POR TIER, Y ESE ES EL ÚNICO QUE VALE.**
 *
 * Antes había cuatro cristales y la elección del jugador era "qué multiplicador
 * gasto", que es una pregunta de cuenta: con un T7 en la mano, un x2.2 y un x4
 * parecían lo mismo y no había forma de decidir sin hacer cuentas. Y, peor: los
 * cuatro estaban escritos y **solo dos se podían conseguir**. El 3 y el 4
 * tenían nombre, multiplicador y probabilidad, y no los sacaba nadie de ninguna
 * caja — con la regla estricta de F26, eso los habría convertido en el contenido
 * que bloquea la progresión, no en una recompensa.
 *
 * Ahora el cristal que sirve es **el del mismo tier del recolector**, sin
 * excepciones ni "igual o superior". Tres cosas se arreglan a la vez:
 *
 *    · la elección es legible: el botón dice "necesitas cristal T7" y no hay que
 *      comparar dos números para saber cuál es;
 *    · el cristal deja de ser un multiplicador suelto y pasa a ser **la llave de
 *      la progresión**, que es lo que pedía F31: si el T8 exige cristal T8 y ese
 *      cristal sale de las cajas T8, las cajas dejan de ser un adorno;
 *    · los cuatro cristales muertos pasan a ser diez vivos, porque la caja T{n}
 *      suelta el cristal T{n} por construcción y no por una línea a mano.
 *
 * El multiplicador sigue ahí y sigue siendo lo que compra el cristal caro, pero
 * ya no es la decisión: es el premio. Y sigue en pasos redondos —x1, x1.4, x2.2—
 * para que el jugador sepa de un vistazo cuánto riesgo se quita.
 *
 * EL COSTE EN UNIDADES NO SUBE CON EL NIVEL DEL CRISTAL, y es deliberado: son
 * siempre `collectorUpgradeCost(level)`. La escasez la pone la caja, no el
 * precio: un cristal T10 cuesta lo mismo en unidades que uno T1 y sale de un
 * cofre T10, que sale de un T9, que sale de un T8. Si además costara más, la
 * última etapa sería una cuenta y no una escalera que hay que subir.
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
  /** QUITADO `dropRate`: no lo leía nadie (ver `KeyDef.dropRate` en este mismo fichero). */
}

export const CRYSTAL_DEFS: Record<number, CrystalDef> = {
  1: { tier: 1, name: 'Cristal de Afino', details: 'x1 a la probabilidad de mejora.', rarity: 'Común', buyable: true, cost: 1_440, power: 1 },
  2: { tier: 2, name: 'Cristal de Fase', details: 'x1.4 a la probabilidad de mejora.', rarity: 'Raro', buyable: false, cost: null, power: 1.4 },
  3: { tier: 3, name: 'Cristal de Entropía', details: 'x1.8 a la probabilidad de mejora.', rarity: 'Épico', buyable: false, cost: null, power: 1.8 },
  4: { tier: 4, name: 'Cristal Singular', details: 'x2.2 a la probabilidad de mejora.', rarity: 'Legendario', buyable: false, cost: null, power: 2.2 },
  5: { tier: 5, name: 'Cristal Espectral', details: 'x2.6 a la probabilidad de mejora.', rarity: 'Legendario', buyable: false, cost: null, power: 2.6 },
  6: { tier: 6, name: 'Cristal Cuántico', details: 'x3 a la probabilidad de mejora.', rarity: 'Mítico', buyable: false, cost: null, power: 3 },
  7: { tier: 7, name: 'Cristal Prismático', details: 'x3.5 a la probabilidad de mejora.', rarity: 'Mítico', buyable: false, cost: null, power: 3.5 },
  8: { tier: 8, name: 'Cristal del Vacío', details: 'x4 a la probabilidad de mejora.', rarity: 'Divino', buyable: false, cost: null, power: 4 },
  9: { tier: 9, name: 'Cristal de la Singularidad', details: 'x5 a la probabilidad de mejora.', rarity: 'Divino', buyable: false, cost: null, power: 5 },
  10: { tier: 10, name: 'Cristal Primordial', details: 'x6 a la probabilidad de mejora.', rarity: 'Divino', buyable: false, cost: null, power: 6 }
};

/** Nivel de cristal más alto conocido. */
export const MAX_CRYSTAL_TIER = 10;

/** Nivel de llave más alto conocido. */
export const MAX_KEY_TIER = 10;

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
 * El nivel de un cristal a partir de su etiqueta.
 *
 * F26 · ANTES NO EXISTÍA, Y ESO ERA EL AGUJERO. El motor no leía el nivel del
 * cristal: leía su **multiplicador** y traducía "x1 o no x1" a "nivel 1 o nivel
 * 2". Con cuatro cristales eso funcionaba por casualidad; con diez, un x1.8 se
 * habría leido como nivel 2, o sea que un T3 exigía el cristal de un T2.
 *
 * Se busca por etiqueta y no por un campo `tier` guardado porque las partidas
 * viejas no tienen ese campo. El orden importa y no es arbitrario: **"Cristal de
 * la Singularidad" contiene "singular"**, así que el T9 se tiene que mirar antes
 * que el T4 o un nombre de nueve se leería como de cuatro. Por eso la lista
 * está del más largo al más corto y no alfabética.
 *
 * Si el nombre no se reconoce se cae al cristal básico: una mejora nunca debe
 * fallar por un dato corrupto, y el T1 siempre está a mano.
 */
const CRISTAL_POR_NOMBRE: [string, number][] = [
  ['singulari', 9],
  ['primordial', 10],
  ['prismátic', 7],
  ['cuántic', 6],
  ['espectral', 5],
  ['singular', 4],
  ['entrop', 3],
  ['fase', 2]
];

export function crystalTierFromName(name: string): number {
  const n = (name || '').toLowerCase();
  for (const [aguja, tier] of CRISTAL_POR_NOMBRE) {
    if (n.includes(aguja)) return tier;
  }
  return 1;
}

/** El multiplicador de un cristal por su etiqueta. Delega en el nivel. */
export function crystalPowerFromName(name: string): number {
  return CRYSTAL_DEFS[crystalTierFromName(name)].power;
}

/**
 * Devuelve el nivel de llave a partir del nombre del item.
 *
 * F31 · La lista está del nombre **más largo al más corto** y no en orden de
 * nivel, por el mismo motivo que en los cristales: "Llave de la Singularidad"
 * contiene "singular" y, si se comprobara antes, el T9 saldría como T8.
 *
 * Y el primer nombre de cada lista es el **legacy**: las partidas viejas tienen
 * 'Llave de Cifrado', 'Reforzada', 'Rúnica' y 'del Vacío' guardadas con su nivel
 * viejo, así que el nombre se lee con los niveles nuevos y es el campo `tier`
 * del item el que manda cuando existe.
 */
export function keyTierFromName(name: string): KeyTier {
  const n = (name || '').toLowerCase();
  if (n.includes('singulari')) return 9;
  if (n.includes('primordial')) return 10;
  if (n.includes('prismátic')) return 7;
  if (n.includes('cuántic')) return 6;
  if (n.includes('espectral')) return 5;
  if (n.includes('vacio') || n.includes('vacío')) return 8;
  if (n.includes('rúnica') || n.includes('runica')) return 3;
  if (n.includes('fase')) return 4;
  if (n.includes('reforzada')) return 2;
  return 1;
}

/**
 * LO QUE QUEDABA DE LAS LLAVES, Y POR QUÉ NO QUEDA NADA.
 *
 * Aquí estaban las tres reglas del sistema de llaves —qué abre cada llave, qué
 * cajas abre una de un tier dado, y el nombre del plural— y las tres se han ido
 * con las llaves. No se dejan "por si acaso": una regla sin nada que la use es un
 * sitio donde meterse a cambiar algo sin que nada se entere.
 *
 * Lo único que sobrevive de esta capa es lo que la migración de partidas viejas
 * necesita leer, y está dos párrafos más abajo con su motivo.
 */

