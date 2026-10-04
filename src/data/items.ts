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
// cosas, y **el cristal ha vuelto a ser un contador por la puerta de atrás**: ya no
// es un item, es `state.crystals`, y el motivo por el que se hizo item —que se podía
// ver, ordenar y guardar— ya no se aplica porque no hay item que guardar.
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
 * EL CRISTAL DE MEJORA, Y POR QUÉ YA NO TIENE NIVELES.
 *
 * **LO QUE HABÍA AQUI:** una tabla de diez niveles con nombre, rareza,
 * multiplicador de probabilidad y precio. El multiplicador era lo que el jugador
 * elegía sin elegir: con F26 el cristal tenía que ser del mismo nivel que el item,
 * así que la pregunta "qué multiplicador gasto" no tenía respuesta.
 *
 * **LO QUE HAY AHORA:** un recurso. Un nombre, un número y nada más.
 *
 * · El **coste** lo pone el nivel del item que subes, y sale de
 *   `valorDeUnCristal()` en `crafting.ts`. Un T10 cuesta muchísimos más que un
 *   T1, y no porque el cristal sea distinto: porque no hay cristal distinto.
 * · La **probabilidad** la pone el nivel al que ya estás subiendo, y esa función
 *   es la de más abajo. Un solo cristal significa una sola probabilidad.
 * · Y ya **no es un item**: no está en el almacén, no ocupa ranura y no se puede
 *   vender. Es un número en `state.crystals`, como las nanitas.
 *
 * **LO QUE SE PIERDE, DICHO PARA QUE NO SE PIERDA DE VISTAS:** el multiplicador.
 * Antes un cristal T5 multiplicaba la probabilidad por 2,2 y eso era una decisión
 * con contenido. Con un solo recurso, la sintonización **es determinista dado el
 * nivel**: en el nivel 15 acierta el 50 % y siempre. El riesgo que queda es el del
 * nivel, que es real y sube con cada subida.
 *
 * Eso es coherente con "un recurso", pero es un cambio de cómo se siente gastar,
 * y la razón está escrita aquí para que no parezca un descuido.
 */
export const CRISTAL_NOMBRE = 'Cristal de Mejora';

/**
 * El color del cristal. Sale de la rareza más baja porque ya no hay niveles a los
 * que asignar una rareza distinta.
 */
export const CRISTAL_RAREZA: Rarity = 'Raro';

/**
 * La probabilidad de que una sintonización acierte, y su único contenido.
 *
 * Fórmula: `95 - nivel·3`, con suelo en 35 y techo en 95. Alta al principio y
 * estrecha al final, así que el jugador sube deprisa las primeras niveles y tiene
 * que decidir cuánto arriesgar en las últimas.
 *
 * **EL TECHO DEL 95 % ES INTENCIONADO**: nunca hay fallo garantizado, solo
 * improbable, para que la mejora siempre se sienta posible.
 *
 * **YA NO MULTIPLICA POR EL CRISTAL.** Antes esta función era
 * `crystalSuccessChance(level, power)` y `power` venía de la tabla de niveles, de 1
 * a 6. Con un solo recurso no hay de dónde sacarlo, y **no se ha inventado otro
 * factor**: un multiplicador nuevo habría sido una economía nueva escrita sin que
 * nadie la pidiera, en la función que decide si una mejora funciona.
 *
 * El suelo del 35 % es lo que hace que subir un item al tope siga siendo posible:
 * en el último nivel se acierta una de cada tres, y eso es una escalera con final.
 */
export function chanceDeSintonizacion(level: number): number {
  const base = Math.max(35, 95 - Math.max(0, Math.floor(level) || 0) * 3);
  return Math.min(95, base);
}

/**
 * Los tres tramos en los que se lee una probabilidad, y el número que separa cada uno.
 *
 * **POR QUÉ ESTÁN AQUÍ Y NO EN LA VISTA.** Lo que se pinta es el color, que es una
 * decisión de aspecto; lo que decide el color es **qué porcentaje cuenta como buena**,
 * y eso es una regla del juego, igual que el 35 % del suelo o el 95 % del techo. Si el
 * corte viviera en el componente, el mismo número sería rojo en la hoja de sintonización
 * y verde en la forja, y no habría ninguna forma de comprobarlo con un banco. Aquí vive
 * la regla y en la vista solo hay un `switch` que traduce el tramo a una clase, que es lo
 * único que una vista puede inventarse.
 *
 * **LOS CORTES, Y POR QUÉ SON ESTOS.** De verde a partir de 80, de 50 a 80 en ámbar, y
 * por debajo de 50 en rojo. No son redondos por gusto: 50 es donde una tirada deja de
 * ser una moneda al aire y pasa a tener mal sabor, y 80 es donde se puede decir sin
 * mentir que sale casi siempre. Un 78 en ámbar y un 82 en verde, que es exactamente lo
 * que se busca: el corte se nota y el número manda.
 *
 * **OJO CON EL 80, QUE ESTÁ EN EL LÍMITE.** La banda alta es `>= 80`, o sea que 80 es
 * verde y 79,999 es ámbar. Con la probabilidad de sintonización, que es entera, eso
 * nunca se nota; pero un banco mide el corte exacto y por eso está escrito con `>=` y no
 * con `>`.
 */
export const CORTE_PROBABILIDAD_ALTA = 80;
export const CORTE_PROBABILIDAD_MEDIA = 50;

export type BandaDeProbabilidad = 'alta' | 'media' | 'baja';

/**
 * En qué tramo cae una probabilidad en porcentaje.
 *
 * Un número que no es un número es **baja**, que es la banda que no promete: si el
 * motor devolviera un `NaN` por un fallo suyo, la vista tiene que enseñarlo como lo
 * peor y no como "no se sabe". Un `NaN` comparado con `80` es `false` y con `50` también,
 * así que el primer corte se come los dos; el `|| 0` de la entrada es lo que lo deja
 * escrito y no heredado.
 */
export function bandaDeProbabilidad(prob: number): BandaDeProbabilidad {
  const p = Number(prob) || 0;
  if (p >= CORTE_PROBABILIDAD_ALTA) return 'alta';
  if (p >= CORTE_PROBABILIDAD_MEDIA) return 'media';
  return 'baja';
}

/*
 * BORRADO DE ESTE FICHERO, Y POR QUÉ NO SE DEJA "POR SI ACASO":
 *
 * · `CRYSTAL_DEFS` y `CrystalDef`. Los diez niveles y sus multiplicadores.
 * · `MAX_CRYSTAL_TIER`. Solo lo usaba la comprobación de "este cristal no supera el
 *   nivel más alto que existe", que ya no tiene sentido: no hay niveles.
 * · `crystalPowerFromName()`. Leía el multiplicador del nombre.
 * · El `power` que `upgradeEquippedCollector` recibía y que el motor descartaba.
 *
/**
 * El nivel de un cristal a partir de su etiqueta.
 *
 * **ESTO SOLO LO USA LA REDENCIÓN, Y POR QUÉ SIGUE AQUÍ.** El juego ya no tiene
 * niveles de cristal, así que no hay a quién preguntarle. Pero una partida guardada
 * antes del cambio **sí tiene** items de cristal en el almacén, con nombre y sin
 * otra cosa, y para convertirlos en el recurso único hay que saber qué nivel eran
 * —porque un cristal T5 no vale lo mismo que uno T1, y ahora eso lo dice
 * `valorDeUnCristal()`.
 *
 * Se puede borrar en cuanto la redención se borre, y no antes.
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

