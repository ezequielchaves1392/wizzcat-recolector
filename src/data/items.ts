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
import { CRATE_TYPES, KEY_COSTS, KEY_NAMES, type CrateType } from './store';

/**
 * F31 · EL NIVEL DE LLAVE **ES** EL TIER DE LA CAJA QUE ABRE.
 *
 * Antes eran cuatro niveles numerados 0 a 3 y cuatro cajas que no eran cuatro
 * tiers: la legendaria soltaba T8 y no había caja para el 9. El nivel de la
 * llave y el nivel del botín eran dos números que solo se parecían, y por eso
 * `TIER_PROPIO` en `crateLoot.ts` era otra copia de la regla.
 *
 * Ahora hay diez llaves y la llave N abre la caja N, y nada más que eso. El
 * nombre lo dice, el nivel lo dice y la caja lo dice, así que un cambio de tier
 * no puede dejar una llave apuntando a una caja que ya no existe.
 */
export type KeyTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Cuántas llaves hay, de menor a mayor. */
export const KEY_TIERS: readonly KeyTier[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

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
export const KEY_TIER_ORDER: KeyTier[] = [...KEY_TIERS];

/**
 * Qué llave necesita cada cofre.
 *
 * F31 · **LA MISMA, Y POR ESO ESTÁ CONSTRUIDA.** Antes era un `Record` de cuatro
 * pares escritos a mano: `common: 0`, `rare: 1`... Una quinta copia de la regla
 * "la caja N la abre la llave N", y por eso las cuatro entradas mentían cuando
 * la tabla de botín se movió (B6). Ahora sale de los dos números que ya existen:
 * la caja es su nivel y la llave es su nivel.
 */
export const CRATE_KEY_TIER: Record<CrateType, KeyTier> = Object.fromEntries(
  Object.keys(CRATE_TYPES).map(t => [t, Number(t) as KeyTier])
) as Record<CrateType, KeyTier>;

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
  return KEY_TIERS.filter(c => keyOpens(keyTier, CRATE_KEY_TIER[c]));
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
 * POR QUÉ LAS DIEZ SON COMPRABLES. La cadena de llaves era una escalera
 * imposible (B6): la del Vacío no salía de ninguna parte, así que la caja
 * legendaria no se podía abrir nunca, y la Rúnica solo salía de la legendaria.
 * Cerrar el botín arregla medio problema, pero deja la tienda como una red de
 * seguridad cara: si un jugador llega a la legendaria sin llave, tiene que poder
 * comprarla. Con las diez a la venta, ningún cofre es inalcanzable por
 * defecto y la tienda deja de ser un callejón sin salida.
 *
 * Y F31 no cambia eso, aunque quite las cajas altas de la tienda: comprar la
 * llave T9 sin tener la caja T9 no es tirar el dinero, es tenerla guardada. La
 * puerta es la caja, y la caja llega por la anterior.
 *
 * POR QUÉ EL NOMBRE Y EL PLURAL ESTÁN ESCRITOS Y NO CALCULADOS. Porque en
 * español el plural no es "la singular con una s": de "Llave Rúnica" sale
 * "Llaves Rúnicas", con la s en el adjetivo, y de "Llave de Cifrado" sale
 * "Llaves de Cifrado", sin nada que cambiar al final. Una regla que los
 * compusiera leía "+2 Llaves Rúnica", que está mal, y un banco que solo miraba
 * si la etiqueta contenía "Llaves" lo daba por bueno. Por eso nombre y plural
 * viven en `KEY_NAMES` (`store.ts`) y no se calculan aquí.
 */
export const KEY_DEFS: Record<KeyTier, KeyDef> = Object.fromEntries(
  KEY_NAMES.map((k, i) => {
    const tier = (i + 1) as KeyTier;
    return [tier, {
      tier,
      name: k.name,
      namePlural: k.namePlural,
      // El texto sale de la MISMA regla que decide si la llave abre la caja: un
      // texto derivado no puede mentir (B6), y esta es la razón por la que los
      // cuatro textos antiguos —que los cuatro mentían— ya no están escritos a
      // mano.
      details: detailsDeLlave(tier),
      rarity: k.rarity as Rarity,
      buyable: true,
      cost: KEY_COSTS[i]
    }];
  })
) as Record<KeyTier, KeyDef>;

/**
 * Qué carta de la tienda vende cada llave: `keyT1` → nivel 1, y así.
 *
 * ESTE MAPA ES LO QUE ARREGLA B7, y existe para que nadie tenga que escribir el
 * nivel otra vez. El fallo era que la compra usaba un `STORE_MATERIAL_TIER`
 * único para todas las llaves: una sola carta, un solo nivel, y el nombre de la
 * carta no tenía nada que ver con lo que entraba al almacén. Con el nivel
 * saliendo del nombre de la carta, el nombre y el item son lo mismo por
 * construcción.
 *
 * Va al revés que un parseo de nombre: aquí el nombre de la carta decide el
 * nivel y el nivel decide el nombre del item, en vez de adivinar el nivel a
 * partir del nombre del item. Un item guardado por una partida vieja puede
 * tener cualquier nombre; una carta de tienda es de este fichero.
 *
 * Y sale de `KEY_TIERS` en vez de ser diez líneas: con cuatro llaves, cuatro
 * líneas eran manejables; con diez, la novena se olvidaba y la tienda vendía una
 * carta que entregaba un nivel que no era el suyo. Un mapa que se construye solo
 * no se puede desincronizar del nivel, porque su contenido ES el nivel.
 */
export const STORE_KEY_TIER: Record<string, KeyTier> = Object.fromEntries(
  KEY_TIERS.map(t => [`keyT${t}`, t])
) as Record<string, KeyTier>;

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
