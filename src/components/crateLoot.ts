// Tabla de botín de las cajas y generador de recompensas.
//
// Reglas de diseño que sostiene este archivo:
//  1. La caja es la UNICA fuente de los compañeros multiplicadores. No se pueden
//     comprar, por eso la ruleta tiene valor real.
//  2. Todo drop que no cabe en el almacén se compensa en nanitas, nunca se pierde.
//  3. La ruleta NO decide el premio: `rollCrateReward` decide y la animación solo
//     lo muestra. Si se invirtiera, la ruleta estaría mintiendo sobre las probabilidades.
//  4. LA CALIDAD DE UN ITEM LA DICE SU POTENCIAL, DE 1 A 5. No hay una rareza por
//     encima de `Divino` ni una marca de "sobrecargado": eran una segunda escala
//     de calidad que competía con el potencial, y los dos podían decir cosas
//     distintas del mismo objeto.

import { TIER_SYSTEM } from '../data/tiers';
import { rollPotentialFrom, poderDeCompanero, valorDeUnCristal } from '../data/crafting';
import { generateCollectorByTier } from '../data/generators';
import { EXPANSOR_TIERS, CRATE_TIERS, CRATE_TYPES, MAX_CRATE_TIER, CONSUMABLES, costeDeCaja, textoDeExpansor, type ExpansorTier } from '../data/store';
import type { CrateType } from '../data/store';
import { crateCosmetics, type CrateCosmeticSource } from '../data/cosmetics';
import { CRISTAL_NOMBRE, CRISTAL_RAREZA } from '../data/items';
import { formatNumber } from '../utils/format';
import type { WarehouseItem } from '../types';

export type LootKind = 'nanites' | 'crystals' | 'companion' | 'collector' | 'crate' | 'consumable' | 'cosmetic';

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
  'Divino': 'text-yellow-300'
};

export const RARITY_BORDER: Record<string, string> = {
  'Común': 'border-slate-500/40',
  'Raro': 'border-blue-500/40',
  'Épico': 'border-purple-500/40',
  'Legendario': 'border-amber-500/50',
  'Mítico': 'border-rose-500/50',
  'Divino': 'border-yellow-400/60'
};

/** Clase de glow. Se escriben completas para que Tailwind las vea. */
export const RARITY_GLOW: Record<string, string> = {
  'Común': '',
  'Raro': 'rarity-glow-raro',
  'Épico': 'rarity-glow-epico',
  'Legendario': 'rarity-glow-legendario',
  'Mítico': 'rarity-glow-mitico',
  'Divino': 'rarity-glow-divino'
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
  'Común': 0, 'Raro': 1, 'Épico': 2, 'Legendario': 3, 'Mítico': 4, 'Divino': 5
};

/**
 * F31 · LA CARA DE LAS DIEZ CAJAS, GENERADA POR SU RAREZA.
 *
 * Antes eran cuatro líneas escritas a mano con el nombre, el icono, el color y
 * el precio dentro —cuatro copias del mismo dato que ya estaba en `CRATE_TYPES`
 * y en `STORE_ITEMS`—. Con diez cajas, diez líneas escritas a mano son diez
 * oportunidades de que una se quede sin precio o con el color de la vecina.
 *
 * Ahora sale de la rareza, y la rareza sale de `CRATE_TYPES`. Un solo dato por
 * caja, y lo que se pinta sale de él.
 *
 * EL ICONO Y EL COLOR SUBEN CON LA RAREZA, no con el tier: una caja T10 es Divina
 * y tiene que leerse como tal en la carta, aunque su botín incluya al T10. Que
 * la carta muestre el nivel y no la rareza es lo que hace que el jugador sepa si
 * abrir le va a servir para algo antes de gastar la llave.
 */
const CRATE_ACCENT: Record<string, string> = {
  'Común': 'text-slate-300',
  'Raro': 'text-blue-400',
  'Épico': 'text-purple-400',
  'Legendario': 'text-amber-400',
  'Mítico': 'text-fuchsia-400',
  'Divino': 'text-rose-400'
};

const CRATE_ICON: Record<string, string> = {
  'Común': 'crate',
  'Raro': 'crate',
  'Épico': 'crate',
  'Legendario': 'crystal',
  'Mítico': 'trophy',
  'Divino': 'trophy'
};

export const CRATE_META: Record<CrateType, { name: string; icon: string; accent: string; cost: number }> =
  Object.fromEntries(CRATE_TIERS.map(t => {
    const rar = CRATE_TYPES[t].rarity;
    return [t, {
      name: CRATE_TYPES[t].name,
      icon: CRATE_ICON[rar] ?? 'crate',
      accent: CRATE_ACCENT[rar] ?? 'text-slate-300',
      // El precio sale de `store.ts`, que es el fichero de los precios. Estaba
      // duplicado aquí y en `STORE_ITEMS`, y eran dos números que nadie comparaba.
      cost: costeDeCaja(t)
    }];
  })) as Record<CrateType, { name: string; icon: string; accent: string; cost: number }>;

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

/**
 * Cuánto pesa una entrada POR su rareza. Más rareza, menos probabilidad.
 *
 * El multiplicador vive AQUÍ y no en el `weight` de cada entrada, que es la única
 * forma de que la regla no se rompa en la siguiente caja que se añada. Los pesos
 * de la tabla son "cuánto tira de esto" —el tipo de premio que es— y la rareza lo
 * baja después.
 *
 * **La escalera es fuerte a propósito** (de 1,00 a 0,03), porque si fuera suave
 * los pesos de autor —que están escritos por "qué premio es", no por "qué tan
 * raro"— mandarían sobre ella y la regla no se cumpliría. Con los números
 * medidos, la entrada Común más pesada pesa 34 y la Legendaria más pesada 3,7:
 * un salto de 9x, que es lo que hace que abrir una legendaria se sienta distinto.
 */
/**
 * Cuántas veces menos se reparte una rareza respecto a la anterior. 3,5 quiere
 * decir que la Raro se lleva la tercera parte de la Común, la Épica la novena...
 *
 * Está medido contra el salto de caja, que es la única referencia real que hay: el
 * botín de arriba tiene que seguir saliendo, porque un salto del 0% convierte el
 * cofre en una garantía y la ruleta deja de ser una ruleta.
 */
const FALLO_POR_RAREZA = 3.5;

/**
 * El suelo de una entrada, en bolsas Comunes. Es un 0,8% de la caja como mínimo
 * para cualquier premio: por debajo, el premio es prácticamente inexistente y la
 * caja anuncia algo que no da.
 *
 * **No lo necesita el salto**, que pesa por su peso de autor y ya lo mide
 * `saltoCheck`. Está para los premios que son el único miembro de una rareza alta
 * —el Espectro Azulado es el caso real— y que sin él se llevarían el 100% de una
 * bolsa pequeña y dejarían de ser exclusivos.
 */
const PESO_MINIMO_POR_ENTRADA = 0.008;

/**
 * La bolsa de los exclusivos. No es una rareza: son las entradas que se sortean
 * por su peso de autor contra la caja entera, y son dos cosas por dos razones
 * distintas que se pueden leer en `tablaDePesos`.
 */
const BOLSA_EXCLUSIVO = '__exclusivo__';

/**
 * La bolsa de los exclusivos, en la misma escala que la rareza Común (1,00). Es
 * "la caja de los exclusivos": por dentro se reparten por su peso de autor —el
 * Espectro con el 5 se lleva la menor parte— y contra el resto de la caja vale lo
 * que el multiplicador dice.
 *
 * El 0,06 sale de medir lo que se necesita: los seis exclusivos de la legendaria
 * con sus pesos de autor tienen que quedar en el 5-20% de la caja, no en el 99%
 * ni en el 2%. Y con el Espectro al 2,6% sale lo que `saltoCheck` pide.
 */
const BOLSA_EXCLUSIVOS = 0.025;

/**
 * Los compañeros EXCLUSIVOS de caja (`exclusive: true`) tampoco compiten por la
 * bolsa de su rareza, por la misma razón que el salto: son el único miembro de
 * su rareza en la caja, así que dentro del reparto se llevarían la bolsa entera.
 *
 * El caso real es el Espectro Azulado, que es el único Épico de la legendaria y
 * con bolsa se llevaba el 53% de la caja — un compañero exclusivo que salía una
 * de cada dos veces y había dejado de serlo. Y no es que el modelo esté mal: es
 * que **"único de su rareza" y "exclusivo" son la misma cosa**, y las dos
 * necesitan que su peso sea propio y no el de un grupo.
 *
 * Su peso de autor sigue mandando: el 5 de la tabla, que es el más bajo de la
 * legendaria, y es el 1-5% que `saltoCheck` mide.
 */

/**
 * El salto de tier va FUERA de las bolsas de rareza, y esto es lo que evita que
 * se llevara el 100% de la suya.
 *
 * El salto es la entrada más repetida de todas: es la única que aparece en las
 * cuatro cajas y su rareza nominal es la más alta de cada una. Si repartiera por
 * rareza como las demás, en la legendaria sería el único Legendario y se llevaría
 * la bolsa entera —73% de la caja— que es justo lo contrario de "un peldaño de
 * sorpresa".
 *
 * La rareza del salto está dentro de la caja por construcción, y su rareza nominal
 * no significa nada: el salto del tier 2 no es más raro que el del 9. Por eso
 * lleva un peso propio y absolute, y `faseDeRareza` le devuelve una bolsa neutra.
 */
/**
 * El peso de una rareza respecto a la anterior: 1 para la Común, `1/3,5` para la
 * Raro, `1/3,5²` para la Épica. Se exporta para que el banco pueda comprobar la
 * escalera que usa el sorteo sin tener que copiarla.
 */
export function pesoDeRareza(rank: number): number {
  return 1 / Math.pow(FALLO_POR_RAREZA, rank);
}

/**
 * F31 · HASTA QUÉ RAREZA LLEGA CADA CAJA, Y SE SACA DE SU NOMBRE.
 *
 * Antes era un `Record<CrateType, number>` con cuatro números escritos a mano:
 * `common: 1, rare: 2, epic: 3, legendary: 4`. Es decir, **el rango de rareza
 * del botín estaba decidido dos veces** —aquí y en el nombre de la caja—, y con
 * diez cajas serían veinte números que ningún banco comparaba. Cuando se movió el
 * peso de una caja, esta tabla se quedó atrás y el reparto dejó de ser el que la
 * ruleta prometía.
 *
 * Ahora sale de `RARITY_RANK[CRATE_TYPES[n].rarity]`, que es el mismo dato que
 * pinta la carta. Una sola fuente por regla (R2).
 */
function rangoDeCaja(crateType: CrateType): number {
  return RARITY_RANK[CRATE_TYPES[crateType].rarity] ?? 0;
}

/**
 * La rareza que DECIDE el peso de una entrada: la nominal **acotada a su caja**.
 *
 * Sin el recorte, el salto de una caja baja —que trae un item del tier de
 * arriba— pesaría por debajo del "Épico" que le toca, y la caja común tendría el
 * premio más caro con el peso más bajo. Acotada, la caja se parece a lo que es.
 */
function rarezaAcotada(crateType: CrateType, rarity: string): string {
  const tope = rangoDeCaja(crateType);
  const r = RARITY_RANK[rarity] ?? 0;
  if (r <= tope) return rarity;
  for (const [nombre, rango] of Object.entries(RARITY_RANK)) {
    if (rango === tope) return nombre;
  }
  return rarity;
}

/**
 * La rareza que DECIDE el peso de cada entrada de una caja. Se exporta para que
 * el banco mida la misma cifra que usa el sorteo, y no una copia de ella.
 */
export function rarezaDeTabla(crateType: CrateType): string[] {
  const guardado = RARIDAD_CACHE[crateType];
  if (guardado) return guardado;
  const tabla = CRATE_LOOT[crateType];
  // El salto (`up`) NO compite por rareza, por una razón concreta: su rareza
  // nominal es la más alta de su caja, pero eso no significa que sea el premio
  // más raro. El salto del tier 2 no es más raro que el del 9.
  //
  // Se marca como `'salto'` —una bolsa propia— en vez de como Común o como su
  // rareza nominal, porque las dos otras opciones fallaban y las dos están medidas
  // en `saltoCheck`:
  //
  //   - Como su rareza nominal, se quedaba solo en su bolsa y se llevaba el 70% de
  //     la caja (es el único Legendario de la legendaria, el único Épico de la
  //     rara). Eso es un "premio garantizado", no un peldaño de sorpresa.
  //   - Como Común, pasaba lo mismo pero en la bolsa grande: se llevaba el 73-87%.
  //
  // Con bolsa propia, lo que pesa es su `weight` de autor contra el total de la
  // caja, que es el 1-8% de siempre y lo que la ruleta le promete al jugador.
  const salida = tabla.map(e => {
    if (e.id === 'up') {
      // El salto no va en las bolsas de rareza (se reparte aparte, abajo) pero su
      // rareza es la de su caja, para que el banco lo pueda mostrar.
      return Object.keys(RARITY_RANK).find(k => RARITY_RANK[k] === rangoDeCaja(crateType)) ?? 'Común';
    }
    // Los exclusivos tampoco, por lo mismo que el salto (ver `PESO_EXCLUSIVO`).
    if (e.exclusivo) return BOLSA_EXCLUSIVO;
    if (e.pesoComo) return rarezaAcotada(crateType, e.pesoComo);
    let nominal = 'Común';
    try {
      nominal = e.build({} as any)?.rarity ?? 'Común';
    } catch {
      nominal = 'Común';
    }
    return rarezaAcotada(crateType, nominal);
  });
  RARIDAD_CACHE[crateType] = salida;
  return salida;
}

/**
 * Los pesos de una caja con la rareza ya aplicada, calculados UNA vez.
 *
 * El motivo de memorizarlos es que la rareza de varias entradas vive dentro del
 * `build()` —que tira el dado—, así que sacarla por entrada y por tirada haría que
 * el peso dependiera del azar. Y eso rompería la regla que la tabla tiene que
 * cumplir: la ruleta **enseña** la casilla que sale. Se calcula una vez y se
 * cachea, así que el peso es el mismo en todas las cajas de la partida.
 */
const PESOS_CACHE: Partial<Record<CrateType, number[]>> = {};
const RARIDAD_CACHE: Partial<Record<CrateType, string[]>> = {};

export function tablaDePesos(crateType: CrateType): number[] {
  const guardado = PESOS_CACHE[crateType];
  if (guardado) return guardado;
  const tabla = CRATE_LOOT[crateType];
  const pesos = new Array<number>(tabla.length).fill(0);

  // =====================================================================
  //  EL REPARTO DE UNA CAJA, QUE YA NO ES POR BOLSAS DE RAREZA
  // =====================================================================
  //
  // **POR QUÉ CAMBIÓ, Y SE MEDIÓ ANTES.** El reparto era por bolsas: cada rareza
  // se llevaba `1 / 3,5^rango` y dentro de la bolsa mandaban los pesos de autor.
  // Eso funcionaba con cuatro cajas, porque cada caja tenía **varias** rarezas
  // dentro: la común tenía nanitas, dron y llave, las tres Comunes.
  //
  // Con una caja por tier, **todas las entradas de la caja tienen la misma
  // rareza**, y el modelo se rompe por los dos lados:
  //
  //    · Una bolsa con UNA SOLA entrada se lleva el 100% de su bolsa. Con las
  //      nanitas solas en la bolsa Común y todo lo demás Legendario, la caja T7
  //      daba **92,45% de nanitas** y 0,74% a cada premio de verdad. La caja
  //      alta era un regalo de nanitas.
  //    · Y en el otro extremo, la bolsa entera de la caja colapsaba: la T10 es
  //      Divina, y `1 / 3,5⁵` es el 0,19%. Una bolsa que vale el 0,19% al lado de
  //      la de los exclusivos —que vale el 2,5%— se lleva el 7% de la caja.
  //
  // **LO QUE QUEDA ES MÁS SIMPLE Y ES LO CORRECTO.** Dentro de una caja manda el
  // peso de autor, y la rareza decide lo que decide de verdad cuando hay una caja
  // por tier: **qué rareza anuncia cada premio**. El compañero de la caja T1 es
  // Común y el de la T10 es Divino, y eso es lo que el jugador lee en la ruleta,
  // en la carta y en el resumen. La rareza pesa entre cajas, no dentro de una.
  //
  // Y eso no deja a nadie sin su regla: el **salto** y los **exclusivos** tienen
  // su parte reservada, que es exactamente la parte que no puede depender del
  // autor. Se calculan abajo.
  //
  // EL REPARTO NORMAL ES POR PESO DE AUTOR, y los pesos son los que ya estaban
  // medidos: 34/26/22/20/12/10/6/6/5 dan en la caja T7 un 24% de nanitas, un 19%
  // de cristal, un 16% de compañero y un 4% de expandido. La caja se lee bien y
  // el premio grande es raro sin ser inalcanzable.

  // El salto se lleva una parte fija, y la parte sale de su peso de autor frente
  // a un peso de referencia de 100. Con los valores de `upWeight()` —de 6 en la
  // T1 a 2 en la T9— eso da del 5,7% al 1,9%: la banda de siempre, sin tocar el
  // `pesoDeRareza`, que ya no hacía falta para sujetarlo.
  const ref = 100;
  const pesoSalto = tabla.some(e => e.id === 'up') ? upWeight(crateType) / (ref + upWeight(crateType)) : 0;

  // Los exclusivos se reparten la bolsa de los exclusivos. Sigue siendo el 2,5%
  // que se calibró contra el salto del banco, y ahora hay hasta DOS por caja en
  // las altas: cada uno se queda la mitad, o sea 1,25%, que es más raro todavía.
  const exclusivos = tabla.map((e, i) => (e.exclusivo ? i : -1)).filter(i => i >= 0);
  const pesoExclusivo = exclusivos.length > 0 ? BOLSA_EXCLUSIVOS : 0;

  const parteNormal = Math.max(0, 1 - pesoSalto - pesoExclusivo);
  const normales = tabla.map((e, i) => (e.id !== 'up' && !e.exclusivo ? i : -1)).filter(i => i >= 0);
  const sumaNormales = normales.reduce((s, i) => s + tabla[i].weight, 0) || 1;
  for (const i of normales) pesos[i] = (tabla[i].weight / sumaNormales) * parteNormal;

  const idxSalto = tabla.findIndex(e => e.id === 'up');
  if (idxSalto >= 0) pesos[idxSalto] = pesoSalto;
  for (const i of exclusivos) pesos[i] = pesoExclusivo / exclusivos.length;

  // Ningún premio se queda en cero aunque la parte normal sea microscópica. El
  // suelo es una fracción de la parte normal y no del 0,8% absoluto de antes:
  // medido contra el total, un suelo absoluto de 0,8% aplastaba los pesos de
  // autor de las cajas altas y las dejaba a todas iguales.
  if (parteNormal > 0) {
    const suelo = parteNormal / (normales.length || 1) / 8;
    for (const i of normales) pesos[i] = Math.max(pesos[i], suelo);
    const total = pesos.reduce((s, w) => s + w, 0) || 1;
    for (let i = 0; i < pesos.length; i++) pesos[i] /= total;
  }

  PESOS_CACHE[crateType] = pesos;
  return pesos;
}

/**
 * EL RECOLECTOR DE UNA CAJA: UN RECOLECTOR NORMAL, CON SU POTENCIAL TIRADO.
 *
 * **ESTO ERA `makeOverclockCollector()`, Y ERA LA ÚNICA RAZA POR ENCIMA DE
 * `Divino`.** Sobrecargado sonaba a premio mayor, pero medido era lo contrario:
 * el sobrecargado de la T10 se vendía por 457.800 con un par caja+llave de
 * 145.388 —**×3,15 de imprimir**— y salía en el 15% de las cajas desde la T3.
 *
 * Y el problema de fondo no era el precio: era que **`Sobrecargado` era una
 * segunda escala de calidad encima del potencial**. El item llevaba `potential:
 * 5` —es decir, era un item perfecto— y además una rareza propia, así que la
 * rareza y el potencial decían dos cosas distintas sobre el mismo objeto, y
 * cualquiera de las dos se podía desincronizar.
 *
 * **LO QUE QUEDA ES UNA SOLA ESCALA: el potencial.** La caja da un recolector de
 * su tier con el potencial tirado por `rollPotentialFrom()` —los mismos pesos
 * que la tienda y que la forja promedia—, así que un ★5 de caja es el item
 * perfecto y hay que buscarlo, en vez de regalarse en una de cada siete cajas.
 * La fuerza la pone el potencial, la rareza solo dice de qué tier viene.
 *
 * Y sale de `generateCollectorByTier()`, que es el mismo generador que usa la
 * tienda: un T7 de la caja y un T7 comprado se construyen con la misma función,
 * que es la regla de R2 aplicada a un objeto que antes tenía regla propia.
 */
export function makeCrateCollector(
  tier: number,
  topeVenta: number,
  rng: () => number = Math.random
): { item: any; name: string; rarity: string; details: string } {
  const base = generateCollectorByTier(tier, rng);
  return {
    name: base.name,
    rarity: base.rarity,
    details: base.details,
    item: {
      ...base,
      // El tope de reventa lo pone `botinDeCaja()`, que es quien sabe qué caja
      // es. Se pasa como argumento y no se lee de aquí porque este módulo no
      // debe saber cuánto cuesta una caja.
      sellPrice: Math.round(costeDeCaja(tier) * 0.5),
      sellPriceTope: topeVenta
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
   * Premio exclusivo de caja: se sortea por su peso de autor contra la caja
   * entera, sin competir en la bolsa de su rareza. Ver `BOLSA_EXCLUSIVO`.
   */
  exclusivo?: boolean;
  /**
   * La rareza con la que PESA esta entrada, cuando la que devuelve el botín no
   * sirve para eso.
   *
   * El caso real es el cosmético: `rollCrateCosmetic` devuelve un cosmético
   * cualquiera, y casi siempre uno Común aunque salga de la caja legendaria. Si se
   * pesara por esa rareza, el cosmético pesaría lo mismo en las cuatro cajas y la
   * legendaria —la caja de los premios raros— tendría el premio más común con el
   * peso más alto. Aquí la rareza es la de la caja de donde sale.
   */
  pesoComo?: string;
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

/**
 * EL EXPANSOR DE CADA CAJA: EL DE SU MISMO TIER.
 *
 * **ANTES LO DABA EL `Math.min(3, tier)`, Y ESO ERA UNA TAPA.** La caja T4 a la
 * T10 soltaban todas el expansor T3, que es el último de la lista. Con la regla
 * del techo —cada expansor sirve hasta un máximo y después necesitas uno de un
 * tier superior— un expansor T3 **solo sirve hasta 30 ranuras**, así que en la
 * caja T7 era un item muerto: salía, se usaba y no pasaba nada.
 *
 * Ahora la caja T{n} suelta el expansor T{n}, y el expansor es exactamente la
 * llave del siguiente peldaño del almacén. Es la regla de F31 aplicada a un
 * objeto más: "la caja N suelta el cristal N, la llave N, el expansor N y la
 * caja N+1".
 *
 * El nombre, las ranuras, el techo y la reventa salen de `EXPANSOR_TIERS`, que
 * los genera para los diez tiers. Si se escribieran a mano aquí, la tabla de la
 * tienda y la del botín se separarían en el primer rebalanceo (D4).
 */
function buildExpansorLoot(tier: number, rarezaDeCaja: string, caja: CrateType): LootEntry {
  const def = EXPANSOR_TIERS.find(t => t.tier === tier);
  if (!def) throw new Error(`No hay expansor T${tier}: la escalera de expansores y la de cajas se han separado.`);
  return {
    id: 'expansor',
    weight: 6,
    // Lo que decide cuánto sale es la CAJA, no el tipo de expansor: por eso el
    // peso es el de la caja. Con diez tiers y un expansor por tier, además, el
    // expansor nunca es más raro que la caja que lo trae, así que la fila de la
    // escalera se lee sin sorpresas.
    pesoComo: rarezaDeCaja,
    build: () => {
      // **LA FRASE VIENE DE LA TABLA, COMO SIEMPRE.** Aquí estaba escrita aparte —y con
      // "+n ranuras" a pelo, que con `slots = 1` da "+1 ranuras"— y el botín de la caja y
      // la ficha del almacén contaban cosas distintas del mismo número.
      const detalles = textoDeExpansor(def);
      return {
        kind: 'consumable', amount: 1, name: def.name, label: `+1 ${def.name}`,
        details: detalles, rarity: rarezaDeCaja, icon: 'plus',
        item: {
          id: `crate_expansor_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: def.name, type: 'consumable', details: detalles,
          rarity: rarezaDeCaja,
          buffId: def.buffId, stackable: true, stackCount: 1,
          sellPrice: def.resale, sellPriceTope: topeDeVenta(caja)
        }
      };
    }
  };
}

/**
 * LA PROBABILIDAD BAJA DE QUE UNA CAJA DÉ ALGO DE ARRIBA (F6).
 *
 * Cada caja tiene su tabla con lo que le corresponde, y en cada una hay una entrada
 * `up` de peso bajo: un tier por encima, o un nivel de caja. No es decoration,
 * es la razón por la que abrir una caja común tiene una sorpresa, aunque sea rara:
 *
 *   común     6%   dron T2 o recolector T2
 *   rara      5%   T6 o recolector T6
 *   épica     4%   T10 o recolector T10
 *   legendaria 4%  compañía exclusiva de caja que no estaba en la tabla
 *
 * **POR QUÉ EL PESO ES BAJO Y NO UNA FRACCIÓN.** El peso es relativo dentro de la
 * caja: un 5% de peso no es un 5% de probabilidad, es `5 / suma`. Con la tabla de la
 * rara sumando 101, sale un 4,95%. Está bien que sea bajo, pero no porque el número
 * lo sea.
 *
 * **POR QUÉ UN SOLO PASO Y NO "LO QUE SALGA".** Si una caja pudiera dar cualquier
 * tier de arriba, la caja común sería una caja legendaria con más pasos. Un solo
 * salto hace que el premio alto siga siendo reconocible ("me ha salido un T6 en una
 * caja rara") y que se pueda razonar: la caja legendaria es donde se busca lo bueno.
 *
 * Y la probabilidad real de un salto **no es el peso**: es `peso / suma de la tabla`,
 * y la suma es distinta en cada caja. Por eso los pesos no son iguales en las cuatro
 * y por eso `llaveCheck`-style, el banco mide las cuatro por separado en vez de mirar
 * el número de la tabla.
 *
 * **Y AQUÍ ESTÁ D1, QUE SE RESUELVE DE PASO.** `CRATE_ONLY_COMPANIONS` tiene seis
 * compañeros y la tabla de la legendaria solo usa los índices 0 a 4: el **Espectro
 * Azulado** (índice 5) estaba definido y era inalcanzable. Se ha metido en la tabla
 * en vez de borrarlo, porque el arreglo de más valor para el jugador es que exista
 * el compañero y que se pueda conseguir, no que el array quede bonito. La entrada
 * baja a 6 y el resto se queda como estaba, así que el índice 5 no se ha movido y
 * ningún guardado lo apunta.
 */
function buildUpLoot(crateType: CrateType): LootEntry {
  return {
    id: 'up',
    weight: upWeight(crateType),
    pesoComo: CRATE_TYPES[crateType].rarity,
    // sube UN peldaño (`subirNTier(crateType, 1)`), no "lo que salga"
    build: () => subirNTier(crateType, 1)
  };
}

/**
 * F31 · EL PESO DEL SALTO BAJA CON EL TIER DE LA CAJA.
 *
 * Antes eran cuatro números escritos a mano (6, 5, 4, 3) para cuatro cajas. Con
 * diez, diez números escritos a mano serían diez sitios donde la caja T6 puede
 * tener un salto más probable que la T5 sin que nadie lo note. Es una función
 * monótona porque la regla que expresa es esa: **cuanto más alta la caja, más
 * raro el salto**, porque el salto es un premio de sorpresa y no puede ser el
 * premio más común de la caja T10.
 *
 * La probabilidad real no es este número: es `peso / suma de la tabla`, y eso lo
 * mide `saltoCheck` caja por caja.
 */
function upWeight(tier: number): number {
  return Math.max(2, Math.round(6 - (tier - 1) * 0.45));
}

/**
 * EL SALTO SE COMPRUEBA AL ABRIR, NO AL CONSTRUIR LA TABLA.
 *
 * Esto es lo que hace que `up` sea una entrada de verdad y no un adorno: `up` está
 * en la tabla con su peso, así que entra en la suma y el sorteo por peso lo elige
 * con la misma probabilidad que cualquier otra cosa. El `tocaElSalto` de abajo es
 * solo para poder MEDIR esa probabilidad en un banco; el juego no lo llama.
 *
 * Y por qué está en la tabla y no en un `if` suelto al abrir: si el salto fuera un
 * `if` aparte, la ruleta no lo enseñaría. La regla del fichero es que la ruleta
 * tiene que enseñar lo que entra, y eso obliga a que el premio sea una entrada de la
 * tabla que la cinta puede pintar.
 */
export function probabilidadDeSalto(crateType: CrateType): number {
  const pesos = tablaDePesos(crateType);
  const tabla = CRATE_LOOT[crateType];
  const total = pesos.reduce((s, w) => s + w, 0);
  return (pesos[tabla.findIndex(e => e.id === 'up')] ?? 0) / total;
}

/** Tirar el salto a mano. Solo para bancos; el juego usa la entrada de la tabla. */
export function tocaElSalto(crateType: CrateType): boolean {
  return Math.random() < probabilidadDeSalto(crateType);
}

/**
 * Un nombre del tier pedido, elegido al azar entre los del catálogo.
 *
 * El `as Record<number, string[]>` está porque `companionNames` está tipado con
 * las claves literales 1..10 y aquí el índice llega como `number`. El índice es
 * correcto: `Math.min(10, ...)` lo deja siempre en rango.
 */
function nombreDeArriba(origen: 'companion' | 'collector', tier: number): string {
  const tablas = TIER_SYSTEM.companionNames as Record<number, string[]>;
  const lista = origen === 'companion'
    ? tablas[tier]
    : (TIER_SYSTEM.collectorNames as Record<number, string[]>)[tier];
  return lista[rand(0, lista.length - 1)];
}

/**
 * F31 · EL SALTO ES "UN TIER POR ENCIMA DE LA CAJA", Y ANTES NO PODÍA SER OTRA
 * COSA.
 *
 * Antes `TIER_PROPIO` decía qué tier le tocaba a cada caja —común 1, rara 3, épica
 * 6, legendaria 8— y el salto era `esos + 1`. O sea que el salto de la legendaria
 * era un T9 y no un T10, porque a la legendaria "le tocaba" el 8. Cuatro números
 * escritos a mano decidían el mejor premio del juego sin que nadie los
 * comprobara, y el salto de la caja más alta no tenía sentido porque la caja más
 * alta ya estaba en el 8 de un salto de diez.
 *
 * Ahora el tier de la caja **es** el tier, así que el salto es `n + 1` y no hay
 * nada que decidir: la caja T7 salta a un T8. Y la T10 no salta a nada porque no
 * hay peldaño por encima del final — y su tabla no incluye la entrada, en vez de
 * incluirla y que salga siempre un T10 sin más.
 *
 * La razón de "+1" y no "+2" es la de siempre: el salto se nota sin dejar de ser
 * del mismo juego. Un T2 dentro de una caja T1 ya es imposible por el precio.
 */
function subirNTier(crateType: CrateType, pasos: number): any {
  const tier = Math.min(MAX_CRATE_TIER, crateType + pasos);

  // Mitad y mitad, y el lado se tira con `Math.random`. Un compañero y un
  // recolector valen cosas distintas (el compañero da ingreso, el recolector daño)
  // y alternar hace que el salto no valga siempre lo mismo.
  //
  // **Y EL SALTO LLEVA TOPE DE REVENTA Y POTENCIAL TIRADO, COMO TODO LO DEMÁS.**
  // El salto es el premio más caro de la caja y se mide como tal: sin tope, el
  // salto de la caja T8 daba un item de T9 que se vendía por 225.960 con un par
  // caja+llave de 44.288. Y el potencial no se fuerza a 5 como antes: el salto
  // tira el dado como cualquier item, porque si no el "sorpresa" es siempre
  // perfecta y deja de serlo.
  const tope = topeDeVenta(crateType);
  if (Math.random() < 0.5) {
    const potential = rollPotentialFrom();
    const p = poderDeCompanero(tier, potential);
    const nombre = nombreDeArriba('companion', tier);
    const detalles = `Recolección por segundo: +${p}/s`;
    return {
      kind: 'companion', amount: 1, name: nombre, label: nombre,
      details: detalles,
      rarity: (TIER_SYSTEM.rarityByTier as Record<number, string>)[tier],
      icon: 'companion', tier, potential,
      item: {
        id: `crate_up_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: nombre, type: 'companion', details: detalles,
        rarity: (TIER_SYSTEM.rarityByTier as Record<number, string>)[tier], tier,
        companionType: 'passive', power: p, potential,
        sellPrice: Math.floor(p * 62), sellPriceTope: tope
      },
      up: true
    };
  }

  const w = makeCrateCollector(tier, tope);
  return {
    kind: 'collector', amount: 1, name: w.name, label: w.name,
    details: w.details, rarity: w.rarity, icon: 'collector', tier,
    potential: w.item.potential,
    item: w.item, up: true
  };
}

/**
 * PESO DE LOS OBJETOS DE TIER EN LA TABLA DE UNA CAJA.
 *
 * **ESTOS DOS NÚMEROS SON LA RESPUESTA A "AUMENTAR EL DROP DE ARMAS Y COMPAÑEROS",
 * Y POR QUÉ ESTÁN ESCRITOS COMO CONSTANTES.**
 *
 * Subir un peso **no** sube su probabilidad en el mundo: los pesos se suman y la
 * probabilidad de cada uno es `peso / suma`. Subir el del arma sube la del arma y
 * baja la de todo lo demás, que es exactamente lo que se pidió —más armas y
 * compañeros, menos nanitas y menos cristales—, pero **es fácil cambiarlo sin
 * querer**: subir el del arma sube también la del salto, porque comparten tabla.
 * Con un número suelto en la línea de `weight:` nadie ve esa relación.
 *
 * Con el total en torno a 200-260, 58 y 62 dejan a los dos objetos de tier en
 * torno al 27 % cada uno, y el resto se reparte entre nanitas, cristales, caja
 * siguiente, salto y expansor. **Subir la T10 por encima de eso no es una mejora: es
 * cambiar la caja.** `saltoCheck` mide los pesos de cada caja y `lootCheck` mide
 * el resultado con 4 000 tiradas por caja, así que el número exacto de aquí está
 * medido, no estimado.
 *
 * **Y POR QUÉ ESTÁN EN DOS CONSTANTES Y NO EN LA LÍNEA DE `weight:`.** Porque los
 * pesos son **relativos**: subir el del arma sube la del arma **y baja la de todo lo
 * demás**, que es justo lo que se pidió, y sube también la del salto, que comparte
 * tabla. Con un número suelto nadie ve esa relación, y el día que alguien lo sube
 * para "que salga más" se lleva por delante el salto y los cristales sin saberlo.
 *
 * La lista de lo que se reparte y la de lo que se sube están juntas, y el banco
 * mide las dos cosas: que la caja siga dando objetos —que es lo que se pidió— y que
 * no deje de darlos, que es lo que se rompió la vez anterior.
 */
const PESO_RECOLECTOR = 58;
const PESO_COMPANERO = 62;

/**
 * F31 · LOS COMPAÑEROS EXCLUSIVOS, REPARTIDOS POR CAJA.
 *
 * Antes los seis estaban entre cuatro tablas escrito uno a uno, y la legendaria
 * usaba los índices 0 a 4: el **Espectro Azulado** (índice 5) estaba definido y
 * no lo sacaba nadie — D1. Con diez cajas el reparto se escribe una vez, aquí, y
 * las seis entradas existen todas por construcción: si alguien añade un séptimo
 * exclusivo y no lo mete en esta tabla, el banco lo canta.
 *
 * EL REPARTO SIGUE LA RAREZA DEL COMPANIÓN, que es lo que el jugador perceives:
 * el Avatar del Vacío es Divino y está en la caja T10, que también lo es; el
 * Espectro Azulado es Épico y está en la T9. No importa para el sorteo —los
 * exclusivos compiten entre ellos por su peso de autor— pero importa para que la
 * caja no prometa una rareza que su mejor premio no tiene.
 */
const EXCLUSIVOS_POR_CAJA: Partial<Record<CrateType, number[]>> = {
  7: [0, 3],
  8: [1, 4],
  9: [5],
  10: [2]
};


/**
 * EL TOPE DE REVENTA DE TODO LO QUE SALGA DE UNA CAJA.
 *
 * El jugador compró una caja y una llave, y lo que sale no puede valer más que
 * eso: si valiera más, comprar cajas y abrirlas sería un negocio con beneficio
 * y el juego dejaría de ser un juego.
 *
 * **MEDIDO ANTES DE PONERLO, Y ERA GRAVE.** El recolector sobrecargado —que sale
 * en el 15% de las cajas desde la T3— se valoraba por rareza y potencial
 * (Sobrecargado ×2,4, potencial 5 ×2,8) y se vendía por 457.800 en la caja T10,
 * con un par caja+llave de 145.388. **×3,15 de imprimir.** Y no era un caso
 * raro: del T3 al T10 el recolector sobraba entre ×1,25 y ×3,15.
 *
 * **POR QUÉ UN TOPE Y NO BAJAR LA VALORACIÓN.** La valoración dinámica es correcta
 * para lo que el jugador ha forjado durante horas, y bajarla para arreglar un
 * problema del botín de las cajas rompería la forja, que es el sistema donde
 * esa valoración se gana. El tope va en el item, que es donde está el problema:
 * un premio de caja no tiene precio de lista, porque no se compra: sale de un cofre.
 *
 * **Y ES EXACTAMENTE EL PAR, NO MENOS.** Si el tope fuera más bajo, la caja sería
 * siempre una pérdida y el jugador sentiría que abrir es tirar el dinero; si
 * fuera más alto, volvería el bucle. Con el tope en el par, el premio mayor de la
 * caja **no pierde y no gana**, y todo lo demás sí pierde: que es la forma
 * honesta de que una caja sea una decisión y no una inversión.
 */
/**
 * EL TOPE DE REVENTA DE LO QUE SALE DE UNA CAJA, Y POR QUÉ AHORA ES LA CAJA SOLA.
 *
 * Antes era `costeDeCaja(tier) + costeDeLlave(tier)`, o sea **las tres cuartas
 * partes del valor del objeto de su tier**. Y sigue valiendo exactamente eso, porque
 * la caja **subió a ese precio** cuando se quitaron las llaves: el jugador pagaba el
 * par y ahora paga la caja, y el par era la caja.
 *
 * O sea que este número **no se ha movido**, y eso es lo que hace que quitar las
 * llaves sea neutro en vez de un regalo: el premio de nanitas de cada caja es un
 * porcentaje de este tope, y el techo de reventa de un recolector o un compañero
 * que sale de un cofre es este mismo número.
 */
function topeDeVenta(tier: number): number {
  return costeDeCaja(tier);
}

/**
 * F31 · LA TABLA DE UNA CAJA. UNA FUNCIÓN, DIEZ CAJAS.
 *
 * ANTES HABÍA CUATRO TABLAS ESCRITAS A MANO, y esa es la razón de que B6
 * existiera: cuatro copias de las mismas reglas —"cada caja suelta su llave",
 * "el expansor es de caja", "el salto es un tier por encima"— que se separaron
 * en el primer rebalanceo. La épica no soltaba ninguna llave, y la del Vacío no
 * salía de ninguna parte, así que la escalera tenía tres peldaños y faltaban
 * los tres.
 *
 * Con diez cajas, diez tablas a mano serían diez veces el mismo problema y diez
 * veces más difícil de ver: nadie lee doscientas líneas buscando por qué la
 * caja T6 no suelta cristal T6. Aquí **la caja T{n} suelta, por construcción**:
 *
 *    · el cristal T{n}, que es lo que hace que F26 no sea un muro;
 *    · la llave T{n}, la suya;
*   · un compañero T{n} y, desde la T3, un recolector T{n};
 *    · la caja T{n+1}, que es la cadena de F31;
 *    · un salto a T{n+1}, que es la sorpresa de F6;
 *    · un expansor, una piedra de calibración desde la T6 y la nanopartícula
 *      desde la T8;
 *    · cosméticos, y los exclusivos que le tocan.
 *
 * Los pesos son los que ya estaban medidos en las cuatro cajas: los mismos
 * números, los mismos repartos dentro de cada caja. Lo que cambia es que ahora
 * hay diez cajas que cumplen la misma fórmula, y que se puede añadir una
 * undécima tocando una línea.
 *
 * **Y LA CANTIDAD DE CRISTALES CRECE CON EL TIER**, que es lo que hace que la
 * regla estricta de F26 no sea una cuenta absurda: sintonizar un T10 cuesta
 * `collectorUpgradeCost(nivel)` unidades y llega a unas 600 a lo largo de toda su
 * vida, así que la caja T10 tiene que dar cristal T10 en cantidad o el T10 sería
 * inalcanzable. La cantidad base es `3n` a `5n` y la rareza de la caja la
 * multiplica después, en `resolveLootAmount`.
 */
function botinDeCaja(tier: CrateType): LootEntry[] {
  const rareza = CRATE_TYPES[tier].rarity;

  // =====================================================================
  //  POR QUÉ TODAS LAS ENTRADAS DE UNA CAJA COMPITEN EN LA MISMA BOLSA
  // =====================================================================
  //
  // **MEDIDO, Y ERA UN BUG GRAVE DE F31.** `tablaDePesos()` reparte por bolsas de
  // rareza, y **una bolsa con una sola entrada se lleva el 100% de su bolsa**. Con
  // las cuatro cajas de antes, la común tenía tres entradas Comunes —nanitas,
  // dron y llave— y la bolsa se repartía entre ellas. Con la tabla generada, la
  // caja T7 tenía **una sola entrada Común, las nanitas**, y todo lo demás era
  // Legendario:
  //
  //     nanitas  92,45%
  //     cristales, compañero, recolector, llave, caja siguiente…  0,74% cada una
  //
  // Es decir, la caja alta **era un regalo de nanitas** con algúnpremio de vez en
  // cuando. Y no lo detectaba ningún banco: `saltoCheck` mide el salto y los
  // exclusivos, y el salto seguía dando el 1-8% porque tenía bolsa propia.
  //
  // LA REGLA QUE QUEDA: **la rareza pesa la caja, y dentro de la caja deciden los
  // pesos de autor.** La escalera de rareza sigue haciendo trabajo en tres sitios
  // que el jugador ve —el salto tiene su propia bolsa, los exclusivos tienen la
  // suya, y la rareza que anuncia cada premio sube con el tier de la caja— pero
  // ya no reparte el botín de una misma caja.
  //
  // El reparto que sale es el de los pesos de autor, que están medidos y suman lo
  // que tienen que sumar: 34/26/22/20/12/10/6/6/5 dan, en la T1, un 28% de
  // nanitas y un 4% de cosméticos, y en la T7 un 23% y un 4%. La caja es legible
  // y el premio grande es raro sin ser inalcanzable.
  //
  // Y `saltoCheck` mide ahora la escalera **entre cajas**, que es donde la rareza
  // decide de verdad: el compañero de la T1 es Común y el de la T10 es Divino.
  const esUltima = tier >= MAX_CRATE_TIER;
  // El tope de reventa de esta caja. Se aplica a TODO lo que salga y se pueda
  // vender, en un solo sitio, para que no dependa de acordarse de ponerlo en cada
  // entrada: un premio nuevo nace topado sin tener que pensarlo.
  const tope = topeDeVenta(tier);
  const tabla: LootEntry[] = [];

  // Las nanitas NO tienen cantidad por tier: `resolveLootAmount` la multiplica
  // por el precio de la caja, así que la caja vale lo que vale y esto es un
  // número fijo. Un solo factor —el precio— en vez de dos que se contradigan.
  tabla.push({
    id: 'nanites', weight: 34, pesoComo: rareza,
    build: () => { const a = rand(250, 400); return { kind: 'nanites', amount: a, name: 'Nanitas', label: `+${a} Nanitas`, details: 'Materia prima básica', rarity: 'Común', icon: 'bolt' }; }
  });

  // LA RAREZA DEL BOTÍN, Y POR QUÉ NO ES LA DE LA CAJA.
  //
  // Todo lo demás de esta tabla usa la rareza de su caja, y lo debería: el jugador ve
  // una caja-divina y espera botín-divino. El cristal es el caso raro, y lo era
  // **antes** de que el cristal fuera un recurso: su rareza venía de
  // `CRYSTAL_DEFS[tier].rarity`, que era una escala propia y distinta de la de las
  // cajas —T4 y T5 eran las dos Legendario, T8, T9 y T10 las tres Divino—.
  //
  // Se conserva esa escala, y no la de la caja, por una razón que no es nostalgia:
  // **`resolveLootAmount()` multiplica la cantidad por la rareza del premio.** Cambiar
  // la rareza del cristal por la de su caja recortaba el botín hasta un 29 % —T4
  // pasaba de 21-35 intentos por caja a 15-25,_ con el precio de la tienda igual, lo
  // que es subir de nivel más lento sin que nadie lo hubiera pedido— y esa cuenta no
  // está escrita en ningún sitio, así que no se habría visto hasta que alguien midiera
  // los diez niveles uno a uno.
  //
  // **LO QUE ESTE NÚMERO ES Y LO QUE NO ES.** Es la rareza **del premio**: lo que
  // tiñe la casilla de la ruleta y lo que escala la cantidad. No dice nada de qué es
  // el cristal, que es un recurso único y se llama siempre igual. Un botín-divino de
  // cristal no es un cristal distinto: es más cantidad del mismo.
  const RAREZA_DEL_BOTIN = [0, 1, 2, 3, 3, 4, 4, 5, 5, 5];

  /** La rareza que llevaba el botín de cristal de ese nivel antes de unificarlo. */
  function rarezaDelBotinDeCristal(tier: number): string {
    const t = Math.max(1, Math.min(RAREZA_DEL_BOTIN.length, Math.floor(tier) || 1));
    return Object.keys(RARITY_RANK).find(k => RARITY_RANK[k] === RAREZA_DEL_BOTIN[t - 1]) ?? 'Raro';
  }

  // LOS CRISTALES QUE SUELTA ESTA CAJA, YA EN UNIDADES DEL RECURSO ÚNICO.
  //
  // **LA CONVERGENCIA ESTÁ AQUÍ Y NO EN EL ALMACÉN, Y ES DONDE TIENE QUE ESTAR.** La
  // cuenta es `rand(3n, 5n) × valorDeUnCristal(n)`: sale la misma cantidad de
  // *números* que antes, y cada uno vale ahora lo que costaba un intento entero en vez
  // de un intento entero entero por uno.
  //
  // La razón de que el número de salida no cambie es justo la que hace el cambio
  // neutro: **una caja de nivel n da los mismos intentos de mejora que daba antes**,
  // porque los dos lados de la división llevan el mismo factor.
  //
  // **Y YA NO HAY NIVEL QUE ANUNCIAR.** Antes la fila decía "Cristal de Fase" y el
  // motor tenía que respetar ese nivel, o el jugador veía un nombre y recibía otro.
  // Con un solo recurso el nombre es único y no hay nada que respetar: **la fila ya no
  // puede mentir porque ya no dice qué nivel es.**
  tabla.push({
    id: 'crystals', weight: 26,
    build: () => {
      const unidades = Math.round(rand(3 * tier, 5 * tier) * valorDeUnCristal(tier));
      return {
        kind: 'crystals', amount: unidades,
        name: CRISTAL_NOMBRE, label: `+${formatNumber(unidades)} ${CRISTAL_NOMBRE}`,
        details: `Sube el nivel de un recolector o un compañero T${tier}`,
        rarity: rarezaDelBotinDeCristal(tier), icon: 'crystal'
      };
    }
  });

  // El compañero del tier de la caja. **El potencial decide su poder**, y sale de
  // `poderDeCompanero()`, que es la misma función que usa la tienda: un T5 de la
  // caja y un T5 comprado hacen exactamente lo mismo (R2). Antes el poder era
  // `rand(min, max)` del rango, o sea que **el compañero de caja no tenía
  // estrellas**: el potencial era una escala de calidad solo del recolector, y
  // en el almacén la mitad de los objetos de tier no la traían.
  tabla.push({
    id: 'companion', weight: PESO_COMPANERO,
    build: () => {
      const potential = rollPotentialFrom();
      const p = poderDeCompanero(tier, potential);
      const nombre = nombreDeArriba('companion', tier);
      const detalles = `Recolección por segundo: +${p}/s`;
      return {
        kind: 'companion', amount: 1, name: nombre, label: nombre,
        details: detalles,
        rarity: rareza, icon: 'companion', tier, potential,
        item: {
          id: `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: nombre, type: 'companion', details: detalles,
          rarity: rareza, tier, companionType: 'passive', power: p, potential,
          sellPrice: Math.floor(p * 62), sellPriceTope: tope
        }
      };
    }
  });

  // El recolector del tier de la caja. **Entra en TODAS las cajas, T1 incluida.**
  //
  // **AQUÍ ESTABA EN `if (tier >= 3)`, Y POR ESO UNA CAJA T1 NO PODÍA DAR UN ARMA
  // T1.** La razón que había escrita —que la caja de los primeros niveles es una
  // caja de material y la de "objetos de tier" empieza en la T3— era una decisión
  // vieja, y su consecuencia era que el jugador que solo puede comprar cajas T1
  // **no tenía forma de conseguir el material para la forja**: ni en la T1 ni en
  // la T2. La forja necesita dos del mismo tier, y la T1 era la única forma
  // segura de llegar. No se puede comprar en la tienda, así que la caja era la
  // única puerta, y estaba cerrada.
  tabla.push({
    id: 'collector', weight: PESO_RECOLECTOR,
    build: () => {
      const w = makeCrateCollector(tier, tope);
      return { kind: 'collector', amount: 1, name: w.name, label: w.name, details: w.details, rarity: w.rarity, icon: 'collector', tier, potential: w.item.potential, item: w.item };
    }
  });

  if (tier >= 3) {
    // **LA TARJETA DE CLICK x3, Y POR QUÉ AQUÍ Y CON PESO 2.**
    //
    // Ha estado en la tienda y solo en la tienda. Se ha sacado de allí —cuesta tres veces
    // más que la de x2 y dura lo mismo, así que comprarla era siempre la mala compra— y su
    // única vía es la caja. **Es lo que el dueño pidió y también lo que encaja:** un
    // consumible que se compra se usa en un momento que el jugador elige, y una tarjeta de
    // medio minuto comprada para "guardarla" vale lo que valga cuando se use.
    //
    // **PESO 2, Y POR QUÉ TAN POCO.** Compite contra un recolector de 58 y un compañero de
    // 62, así que sale de vez en cuando, no de cada tres cajas. Es un golpe de suerte, no una
    // fuente con la que contar. Y sale **a partir de la T3**: en la T1 y la T2 no hay ningún
    // arma de valor contra la que competir y un "sucesor" al que encadenarse, así que
    // meterla ahí solo haría que la caja peor diese más.
    tabla.push({
      id: 'clickX3Card', weight: 2,
      pesoComo: rareza,
      build: () => {
        const def = CONSUMABLES.clickX3Card;
        return {
          kind: 'consumable', amount: 1, name: def.name, label: def.name, details: def.details,
          rarity: def.rarity, icon: 'bolt',
          item: {
            id: `clickx3_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: def.name, type: 'consumable', details: def.details, rarity: def.rarity,
            buffId: def.buffId, stackable: true, stackCount: 1,
            sellPrice: 2500, sellPriceTope: tope
          }
        };
      }
    });
  }

  if (!esUltima) {
    // LA CAJA SIGUIENTE. Esta entrada es la cadena de F31 entera: sin ella, la
    // T2 no llega a la T3 y el jugador se queda en la T10 sin poder. Y no sale de
    // la tienda: **la puerta es la caja**, no la llave.
    tabla.push({
      id: 'nextCrate', weight: 12,
      build: () => {
        const def = CRATE_TYPES[(tier + 1) as CrateType];
        return {
          kind: 'crate', amount: 1, name: def.name, label: `+1 ${def.name}`,
          details: def.details, rarity: def.rarity, icon: CRATE_META[(tier + 1) as CrateType].icon,
          item: {
            id: `crate_${tier + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: def.name, type: 'crate', details: def.details, rarity: def.rarity,
            tier: 0, sellPrice: Math.floor(costeDeCaja(tier + 1) / 4), sellPriceTope: tope,
            stackable: true, stackCount: 1
          }
        };
      }
    });

    // El salto de F6: un tier por encima de la caja. La T10 no lo tiene porque no
    // hay peldaño por encima del final, y no porque su `build` devuelva un T10
    // siempre — eso sería un premio garantizado disfrazado de sorpresa.
    tabla.push(buildUpLoot(tier));
  }

  // El expansor. Sale de `EXPANSOR_TIERS` y el tipo decide la caja: la T1 da el
  // expansor T1, la T2 el T2, y de la T3 en adelante el T3, que es el único que
  // llega al tope de 600 y por eso es el que tiene que venir de las cajas altas.
tabla.push(buildExpansorLoot(tier, rareza, tier));

  if (tier >= 8) {
    tabla.push({
      id: 'stabilityNano', weight: 6,
      // `pesoComo` es la rareza de la CAJA, no la del item, y el motivo es
      // concreto: la nanopartícula es Legendaria lo mismo en la T8 que en la T10.
      // Compitiendo por su rareza propia, una entrada Legendaria suelta dentro de
      // una bolsa Mítica rompe la escalera de rarezas de `saltoCheck` —que exige
      // que más rareza sea menos probabilidad— y además haría que el mismo item
      // pesara distinto según la caja. Su rareza describe el item; lo que decide
      // cuánto sale es la caja.
      pesoComo: rareza,
      build: () => {
        const def = CONSUMABLES.stabilityNano;
        return {
          kind: 'consumable', amount: 1, name: def.name, label: def.name, details: def.details,
          rarity: def.rarity, icon: 'flask',
          item: { id: `crate_nano_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: def.name, type: 'consumable', details: def.details, rarity: def.rarity, buffId: def.buffId, stackable: true, stackCount: 1, sellPrice: 55000, sellPriceTope: tope }
        };
      }
    });
  } else if (tier >= 6) {
    tabla.push({
      id: 'calibrationStone', weight: 6,
      // Como la nanopartícula: compite en la bolsa de la caja, no en la del item.
      pesoComo: rareza,
      build: () => {
        const def = CONSUMABLES.calibrationStone;
        const a = rand(1, 2);
        return {
          kind: 'consumable', amount: a, name: def.name,
          label: `${a} Piedra${a > 1 ? 's' : ''} de Calibración`, details: def.details,
          rarity: def.rarity, icon: 'flask',
          item: { id: `crate_stone_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: def.name, type: 'consumable', details: def.details, rarity: def.rarity, buffId: def.buffId, stackable: true, stackCount: a, sellPrice: 11250, sellPriceTope: tope }
        };
      }
    });
  }

  // Los exclusivos de esta caja, si le tocan.
  for (const idx of EXCLUSIVOS_POR_CAJA[tier] ?? []) {
    const comp = CRATE_ONLY_COMPANIONS[idx];
    tabla.push({
      id: `exclusivo_${idx}`, weight: 3, exclusivo: true,
      build: () => {
        const c = makeCrateOnlyCompanion(comp);
        (c.item as any).sellPriceTope = tope;
        return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: comp.icon, item: c.item, exclusive: true };
      }
    });
  }

  // El cosmético. Su rareza es la de la caja, y `rarezaAcotada` la recorta por si
  // acaso: el peso lo decide la rareza, no la etiqueta que pone aquí.
  //
  // **Y SOLO EN LAS CAJAS QUE TIENEN CATÁLOGO.** El catálogo reparte nueve
  // cosméticos entre las cajas 1, 3, 6 y 10; las otras seis no tienen ninguno. Con
  // cuatro cajas la entrada estaba en las cuatro y no se notaba. Con diez, seis
  // ruletas enseñaban una casilla de cosmético que nunca salía y el sorteo la
  // compensaba en nanitas: una casilla que miente, que es lo que el propio
  // `rollCrateCosmetic` documenta que no puede pasar.
  if (crateCosmetics(tier).length > 0) {
    tabla.push({
      id: 'cosmetic', weight: 5, pesoComo: rareza,
      build: (ctx: LootBuildContext) => rollCrateCosmetic(tier, ctx.ownedCosmetics)
    });
  }

  return tabla;
}

/**
 * Las diez tablas. Se construyen al cargar el módulo y no se tocan después, así
 * que `rand()` dentro de un `build()` sigue tirando de verdad en cada caja: el
 * orden es el de las entradas, y las cantidades se tiran al sortear, no al
 * escribir la tabla.
 */
export const CRATE_LOOT: Record<CrateType, LootEntry[]> = Object.fromEntries(
  CRATE_TIERS.map(t => [t, botinDeCaja(t)])
) as Record<CrateType, LootEntry[]>;

/** Compra una entrada por peso. */
export function pickLoot(crateType: CrateType, weights?: number[]): LootEntry {
  const table = CRATE_LOOT[crateType];
  const w = weights ?? tablaDePesos(crateType);
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
  /**
   * Coloca un item, o lo vende si el filtro de auto-venta lo dice.
   *
   * **POR QUÉ DEVUELVE UN OBJETO Y NO UN BOOLEANO.** Porque "lo he vendido" y "lo he
   * guardado" no se distinguen con `true`, y esa diferencia es justo lo que la ruleta
   * tiene que enseñar: un premio vendido se ve como **las nanitas que entraron**, no
   * como el item que no llegó a existir. Con un `boolean`, el `default:` de más abajo
   * solo podría devolver el item tal cual y el jugador vería "Coloso de Batalla" en la
   * casilla ganadora sin ningún aviso de que no lo tiene.
   *
   * `nanitas` viene **solo cuando se ha vendido**, y es el importe exacto —el mismo
   * que `sellItem()` cobraría, con el tope de precio aplicado—. `ok: false` es lo de
   * siempre: no cabe y toca compensar.
   */
  addItem: (item: any) => { ok: boolean; nanitas?: number };
  /**
   * **ESTE CAMPO ESTABA AQUÍ Y NO LO USABA NADIE.**
   *
   * Parecía una guarda —"¿queda sitio?"— y de hecho era la respuesta a la pregunta
   * equivocada: el sitio no lo decide el sorteo, lo decide quién pide la apertura. Por eso
   * el veto vive en el motor y el tope del lote en `maximoDeApertura()`, y aquí lo que
   * decide es qué hacer con un botín: **`addItem` devuelve `ok: false` cuando no cabe**, y
   * quien llama tiene que resolverlo.
   *
   * Se quitó porque un campo muerto que parece una protección es peor que no tenerlo:
   * quien lo lea lo cuenta como una guarda y no mira más atrás.
   */
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
    // =====================================================================
    //  LAS NANITAS DE UNA CAJA SON UN FRACCIÓN DEL PAR, Y SIEMPOR MENOR
    // =====================================================================
    //
    // **ESTO ERA LA MÁQUINA DE IMPRIMIR, Y LLEVABA DESDE EL PRIMER DÍA.**
    //
    // La fórmula era `amount × costeDeCaja / 12`, con `amount` en 250-400. Eso da
    // entre **21 y 33 veces el precio de la caja**: de la caja T1, que cuesta 450,
    // salían 9.375-15.000 nanitas. Y como la caja T1 cuesta 675 con su llave, el
    // jugador cobraba **×14-22 por abrir**. Comprar cajas y abrirlas era mejor que
    // jugar, y el juego se rompía solo sin que nadie tocara nada más.
    //
    // No era un efecto del precio de F31: en el commit que metió la ruleta las
    // cajas costaban 400/1200/4500/18000 y el multiplicador era el mismo. La
    // cuenta estaba mal desde que se escribió, y ningún banco la miraba porque
    // `medidaVenta` medía compañeros y recolectores, no la.nanita.
    //
    // LA REGLA QUE QUEDA: **el premio de nanitas es del 25% al 40% del par.** El
    // número de autor, 250-400, se lee como tanto por mil del par, así que la caja
    // paga una fracción de lo que cuesta y nunca llega a devolverlo. Sigue
    // escalando con el tier —una caja T10 da mucho más que una T1—, que es lo
    // que hace que subir de caja siga siendo la decisión buena.
    //
    // Y el `Math.min` de debajo no hace falta para que no se imprima: está porque
    // una cifra que no puede superarse por construcción es mejor que una que se
    // comprueba después, y porque el rango de autor puede cambiar sin que nadie
    // tenga que acordarse de este comentario.
    const par = topeDeVenta(crateType);
    const final = Math.max(1, Math.min(Math.round((base.amount / 1000) * par), par));
    return { ...base, amount: final, label: `+${formatNumber(final)} Nanitas` };
  }
  if (base.kind === 'crystals') {
    const value = Math.round(base.amount * (1 + RARITY_RANK[base.rarity] * 0.25));
    // `formatNumber` y no el número en crudo: la etiqueta es lo que lee el jugador, y
    // los -nanitas- de la línea de arriba,_que son la mitad de lo que sale de una caja
    // T10,_ lo formatean. Una casilla con "+1293840 Cristales de Mejora" al lado de otra
    // con "+9.25 K Nanitas" dice que el cristal es otro juego.
    return { ...base, amount: value, label: `+${formatNumber(value)} ${CRISTAL_NOMBRE}` };
  }
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
  if (reward.kind === 'nanites' || reward.kind === 'crystals') return true;
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
      // El botín da el cristal del nivel que declara la entrada, y F26 quiere que
      // ese nivel sea SIEMPRE el de la caja. El `?? 1` es el suelo: una entrada
      // sin `materialTier` es un dato corrupto, y el T1 siempre está a mano.
      applier.crystals(reward.amount, reward.materialTier ?? 1);
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
      // El resto son items: entran al almacén, se venden solos, o se compensan.
      const colocado = reward.item
        ? applier.addItem(reward.item)
        : { ok: false };
      if (colocado.ok) {
        // **LO VENDIDO SE VENDE COMO NANITAS, Y ESTE ES EL MOTIVO DE QUE `addItem`
        // devuelva un objeto.** El premio que se anuncia y el que se aplica tienen que
        // ser la misma cosa: si la casilla ganadora dice "Coloso de Batalla" y lo que ha
        // pasado es que se ha convertido en 3.000 ◆, el jugador ha visto un objeto que
        // no tiene. Se devuelve un premio de tipo `nanites` con el importe **exacto**, no
        // la compensación de "no cabía": esa es para cuando algo se pierde, y aquí el
        // jugador lo ha pedido.
        if (typeof colocado.nanitas === 'number') {
          const porNanitas = formatNumber(colocado.nanitas);
          return {
            kind: 'nanites',
            amount: colocado.nanitas,
            name: 'Vendido',
            label: `+${porNanitas} Nanitas`,
            details: 'Vendido automáticamente',
            rarity: reward.rarity,
            icon: 'bolt',
            exclusive: false
          };
        }
        return reward;
      }
      const full = naniteCompensation(crateType, 'No cabía el objeto, se compensó en nanitas');
      applier.nanites(full.amount);
      return { ...full, name: 'Compensación', label: `Almacén lleno: +${formatNumber(full.amount)} Nanitas` };
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
    label: `+${formatNumber(compensation)} Nanitas`,
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
