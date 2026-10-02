// Tabla de botín de las cajas y generador de recompensas.
//
// Reglas de diseño que sostiene este archivo:
//  1. La caja es la UNICA fuente de los compañeros multiplicadores y de las recolectores
//     sobrecargadas. No se pueden comprar, por eso la ruleta tiene valore real.
//  2. Todo drop que no cabe en el almacén se compensa en nanitas, nunca se pierde.
//  3. La ruleta NO decide el premio: `rollCrateReward` decide y la animación solo
//     lo muestra. Si se invirtiera, la ruleta estaría mintiendo sobre las probabilidades.

import { TIER_SYSTEM } from '../data/tiers';
import { EXPANSOR_TIERS, CRATE_TIERS, CRATE_TYPES, MAX_CRATE_TIER, CONSUMABLES, costeDeCaja, type ExpansorTier } from '../data/store';
import type { CrateType } from '../data/store';
import { crateCosmetics, type CrateCosmeticSource } from '../data/cosmetics';
// `CRATE_KEY_TIER` y `KEY_DEFS` entran como VALOR porque la entrada de llaves de
// cada caja se construye desde ellos. Antes iban escritos a mano y por eso la
// llave del Vacío no salía de ninguna parte: la caja legendaria era imposible
// de abrir (B6). Ver `buildKeyLoot`.
import { CRATE_KEY_TIER, KEY_DEFS, CRYSTAL_DEFS, type KeyTier } from '../data/items';
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
 * Sin el recorte, el salto de una caja común —que es un Sobrecargado por diseño—
 * pesaría por debajo del Épico que le toca, y la caja común tendría el premio
 * más caro con el peso más bajo. Acotada, la caja se parece a lo que es.
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
  const rarezas = rarezaDeTabla(crateType);
  const brutos = tabla.map(e => e.weight);

  // Cada rareza se lleva una BOLSA de peso, y las bolsas son más pequeñas
  // cuanto más rara. Así la regla es cierta POR CONSTRUCCIÓN y no porque los
  // pesos de autor happen to estar ordenados: la rareza decide cuánto se reparte
  // el grupo entero, y los `weight` de autor solo ordenan DENTRO de cada grupo.
  //
  // La razón de hacerlo así, y no con un multiplicador por entrada: una caja
  // tiene cuatro entradas Comunes y una Mítica, y con multiplicador por entrada
  // la suma de las Comunes siempre le ganaba a la Mítica. Eso no es un bug de
  // números, es que se estaba comparando el número de entradas de cada rareza
  // con su peso. Repartir por bolsa compara lo que pediste: **cuánto se reparte
  // más rareza, menos**.
  const porRareza: Record<string, number[]> = {};
  rarezas.forEach((rar, i) => {
    if (tabla[i].id === 'up') return;
    if (tabla[i].exclusivo) return;
    (porRareza[rar] ??= []).push(i);
  });
  // La rareza con la que el salto COMPITE, que es su rareza nominal acotada.
  const rarezaDeSalto = (c: CrateType): string =>
    Object.keys(RARITY_RANK).find(k => RARITY_RANK[k] === rangoDeCaja(c)) ?? 'Común';

  // El salto entra en el reparto de su rareza como cualquier otra entrada, con su
  // peso de autor, y por eso se queda en el 1-8% que siempre tuvo. Sacarlo de su
  // bolsa —que es lo que se probó— lo convertía en el 80% de la caja, porque al
  // quedarse solo en la suya se llevaba el 100% de una bolsa que era el 80% del
  // total. Ver `saltoCheck`, que es el banco que mide esto.
  // Una rareza con UNA SOLA entrada se llevaría el 100% de su bolsa, que es el
  // caso real del salto de la legendaria y del Espectro Azulado. Con eso el salto
  // bajaba al 0,2% (un premio que nunca sale) y el Espectro subía al 73% (un
  // compañero exclusivo que deja de serlo), que es justo el daño que esta regla
  // iba a evitar.
  //
  // Por eso la bolsa se reparte entre las entradas de la rareza CON SU PESO DE
  // AUTOR en lugar de por partes iguales: con partes iguales, una entrada sola se
  // lleva todo, y con el peso de autor sigue llevándose la bolsa (que ya es
  // pequeña) pero competiría con las de su misma rareza si alguna vez hay más de
  // una. El suelo de `PESO_MINIMO_POR_ENTRADA` es lo que evita que una bolsa
  // pequeña se convierta en una probabilidad tan baja que el premio desaparece.
  const pesos = new Array<number>(tabla.length).fill(0);
  for (const [nombre, indices] of Object.entries(porRareza)) {
    const bolsa = pesoDeRareza(RARITY_RANK[nombre] ?? 0);
    const suma = indices.reduce((s, i) => s + brutos[i], 0) || 1;
    for (const i of indices) pesos[i] = (brutos[i] / suma) * bolsa;
  }
  const exclusivos = tabla.map((e, i) => (e.exclusivo ? i : -1)).filter(i => i >= 0);
  if (exclusivos.length > 0) {
    const sumaExcl = exclusivos.reduce((s, i) => s + brutos[i], 0) || 1;
    for (const i of exclusivos) pesos[i] = (brutos[i] / sumaExcl) * BOLSA_EXCLUSIVOS;
  }
  // El salto se reparte dentro de la bolsa de SU rareza nominal, junto a las
  // entradas de esa rareza y con su peso de autor, que es lo que lo deja en el
  // 1-8% de siempre. La rareza nominal del salto es la más alta de su caja
  // (`rarezaAcotada` la deja donde está), así que compite contra los premios
  // buenos de esa caja, que es exactamente lo que es un peldaño de sorpresa.
  //
  // Y NO lleva bolsa propia: con bolsa propia, su peso de autor (4-6) competía
  // contra las bolsas ya divididas por 3,5 y se llevaba el 90% de la caja.
  const indiceSalto = tabla.findIndex(e => e.id === 'up');
  if (indiceSalto >= 0) {
    const nominal = rarezaDeSalto(crateType);
    const bolsa = pesoDeRareza(RARITY_RANK[nominal] ?? 0);
    const companeros = porRareza[nominal] ?? [];
    const suma = (brutos[indiceSalto] + companeros.reduce((s, i) => s + brutos[i], 0)) || 1;
    pesos[indiceSalto] = (brutos[indiceSalto] / suma) * bolsa;
  }
  // Ningún premio baja del suelo: por debajo, la caja anuncia algo que no da.
// El suelo NO se aplica al salto ni a los exclusivos: los dos pesan por su autor
// contra la caja entera y tienen su propia prueba, y aplicarles el suelo de la
// bolsa Común los subía a todos al mismo valor (el Espectro, que debe ser el más
// raro de la legendaria, quedaba igual que el Avatar).
const suelo = pesoDeRareza(0) * PESO_MINIMO_POR_ENTRADA;
  for (let i = 0; i < pesos.length; i++) {
    if (tabla[i].id === 'up' || tabla[i].exclusivo) continue;
    pesos[i] = Math.max(pesos[i], suelo);
  }

  const total = pesos.reduce((s, w) => s + w, 0);
  const salida = pesos.map(w => w / total);
  PESOS_CACHE[crateType] = salida;
  return salida;
}

/** Recolectores sobrecargadas: mismo tier, daño por encima del rango normal del tier. */
export function makeOverclockCollector(tier: number): { item: any; name: string; rarity: string; details: string } {
  const range = TIER_SYSTEM.ranges[tier as keyof typeof TIER_SYSTEM.ranges] || [1, 5];
  const top = range[1];
  // +25% sobre el máximo del tier: claramente mejor que su versión de tienda.
  //
  // F33 · Lleva `potential: 5`, o sea que ES un item perfecto, y encima el 25% de
  // la sobrecarga. Es la excepción consciente a "el potencial decide el daño": por
  // eso se llama Sobrecargado y es el premio mayor de la caja. Lo que NO puede
  // pasar es que se quede sin potencial, porque entonces al meterlo en la forja
  // se leería como un 3 y perdería tres quintos de su valor al promediar.
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
      potential: 5,
      overclock: true,
      sellPrice: Math.round(costeDeCaja(tier) * 0.5)
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
 * La entrada de llaves de una caja, y sale de `CRATE_KEY_TIER`: **cada caja
 * suelta la llave que la abre**.
 *
 * POR QUÉ ESTA FUNCIÓN Y NO CUATRO ENTRADAS ESCRITAS A MANO. Antes las cuatro
 * estaban escritas una por una, con su nombre, su texto y su nivel, y por eso la
 * cadena era una escalera imposible (B6): la legendaria soltaba la Rúnica, la
 * Rúnica solo salía de la legendaria, y **la del Vacío no salía de ninguna
 * parte**, así que la caja legendaria no se podía abrir nunca. Con la tabla, la
 * leyenda del Vacío sale de la legendaria porque es lo que la tabla dice, no
 * porque alguien lo escribiera.
 *
 * Y EL NOMBRE Y EL TEXTO TAMBIÉN SALEN DE AQUÍ, y no están en la línea de
 * abajo, por la misma razón que la tienda: nombre, texto y nivel tenían tres
 * copias y ninguna se deducía de las otras. Un botín que anuncia una llave con
 * un nombre que no es el de esa llave vuelve a ser el bug, solo que en la
 * ruleta.
 *
 * LA CANTIDAD ES 1 O 2 PARA TODAS, a propósito. Es lo justo para devolver parte
 * de lo que costó la llave y no más: si una caja devolviera la llave entera,
 * comprar llave y caja en la tienda sería indiferente y el cofre dejaría de ser
 * una decisión de riesgo. Con 1 o 2, abrir es siempre una pérdida neta de
 * nanitas y la tienda nunca es el camino bueno.
 */
function buildKeyLoot(crateType: CrateType): LootEntry {
  const tier = CRATE_KEY_TIER[crateType];
  const def = KEY_DEFS[tier];
  return {
    id: 'keys',
    weight: 10,
    // `pesoComo` es la rareza de la CAJA, y el motivo es el mismo que en las
    // piedras: la llave T9 es Divina porque es la novena, no porque el cofre la
    // vuelva especial. Sin esto, la fila de llaves de la caja T9 competía en la
    // bolsa Divina con un peso de autor de 10 sobre una bolsa de 1/150, y medido
    // salía **menos de una vez cada 400 aperturas** — o sea, casi nunca. La
    // cadena de cajas de F31 depende de que cada caja devuelva la llave que la
    // abre, así que un peso que la hace casi inalcanzable no es un desajuste de
    // balance: es la cadena rota por el otro lado.
    pesoComo: CRATE_TYPES[crateType].rarity,
    // LA CANTIDAD SE TIRA AQUÍ DENTRO, y no al construir la tabla. `CRATE_LOOT`
    // se escribe una vez al cargar el módulo, así que un `rand()` al lado de
    // `def` la fijaría para toda la partida: se vería "+1 Llave de Cifrado" en las
    // mil cajas comunes que abrieras. Un banco que mirase una sola tirada no lo
    // vería nunca.
    build: () => {
      const a = rand(1, 2);
      // El plural sale de `def.namePlural` y no de retocar el singular: el plural
      // de "Llave Rúnica" es "Llaves Rúnicas", con la "s" en el adjetivo, y el de
      // "Llave de Cifrado" es "Llaves de Cifrado", sin nada que añadir al final.
      const etiqueta = a > 1 ? def.namePlural : def.name;
      return {
        kind: 'keys',
        amount: a,
        name: def.name,
        label: `+${a} ${etiqueta}`,
        details: def.details,
        rarity: def.rarity,
        icon: 'key',
        keyTier: tier
      };
    }
  };
}

/**
 * EL EXPANSOR DE CADA CAJA (F27).
 *
 * La común suelta el T1, la rara el T2 y la épica y la legendaria el T3: la
 * ampliación grande es recompensa de caja y no compra, que es lo que le da a
 * las cajas el valor que F31 quiere darles. El nombre, las ranuras y la
 * reventa salen de `EXPANSOR_TIERS`: si se escribieran a mano aquí, la tabla
 * de la tienda y la del botín se separarían en el primer rebalanceo (D4).
 */
function buildExpansorLoot(tier: 1 | 2 | 3, rarezaDeCaja: string): LootEntry {
  const def = EXPANSOR_TIERS.find(t => t.tier === tier) as ExpansorTier;
  const rarity = tier === 1 ? 'Raro' : tier === 2 ? 'Épico' : 'Legendario';
  return {
    id: 'expansor',
    weight: 6,
    // Mismo motivo que las llaves y las piedras: el expansor T3 es Legendario en
    // cualquier caja que lo suelte, y con diez cajas eso lo metía en la bolsa
    // Legendaria de la T4…T10 —donde el resto de la tabla está en la bolsa de la
    // caja— y rompía la escalera de rarezas. Lo que decide cuánto sale es la
    // caja, no el tipo de expansor.
    pesoComo: rarezaDeCaja,
    build: () => ({
      kind: 'consumable', amount: 1, name: def.name, label: `+1 ${def.name}`,
      details: `Amplía el almacén +${def.slots} slots`, rarity, icon: 'plus',
      item: {
        id: `crate_expansor_${Date.now()}`, name: def.name, type: 'consumable',
        details: `Amplía el almacén +${def.slots} slots`, rarity,
        buffId: def.buffId, stackable: true, stackCount: 1, sellPrice: def.resale
      }
    })
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
 *   rara      5%   T6 o recolector T6 sobrecargado
 *   épica     4%   T10 o recolector T10 sobrecargado
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
  const tabla = CRATE_LOOT[crateType];
  const total = tabla.reduce((s, e) => s + e.weight, 0);
  return upWeight(crateType) / total;
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
  // recolector valen cosas distintas (la companion da ingreso, el recolector daño)
  // y alternar hace que el salto no valga siempre lo mismo.
  if (Math.random() < 0.5) {
    const t = TIER_SYSTEM.ranges[tier];
    const p = rand(t[0], t[1]);
    const nombre = nombreDeArriba('companion', tier);
    return {
      kind: 'companion', amount: 1, name: nombre, label: nombre,
      details: `Recolección por segundo: +${p}/s`,
      rarity: (TIER_SYSTEM.rarityByTier as Record<number, string>)[tier],
      icon: 'companion', tier,
      item: {
        id: `crate_up_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: nombre, type: 'companion', details: `Recolección por segundo: +${p}/s`,
        rarity: (TIER_SYSTEM.rarityByTier as Record<number, string>)[tier], tier,
        companionType: 'passive', power: p,
        sellPrice: Math.floor(p * 62)
      },
      up: true
    };
  }

  const w = makeOverclockCollector(tier);
  return {
    kind: 'collector', amount: 1, name: w.name, label: w.name,
    details: w.details, rarity: w.rarity, icon: 'collector', tier,
    item: w.item, up: true
  };
}

/** El tier que le "toca" a cada caja, que es la referencia del salto de +1. */
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

/** El expansor que suelta una caja: los tres primeros dan los tres tipos. */
function expansorDeCaja(tier: number): 1 | 2 | 3 {
  return (Math.min(3, tier) as 1 | 2 | 3);
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
 *    · un compañero T{n} y, desde la T3, un recolector T{n} sobrecargado;
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
  const esUltima = tier >= MAX_CRATE_TIER;
  const tabla: LootEntry[] = [];

  // Las nanitas NO tienen cantidad por tier: `resolveLootAmount` la multiplica
  // por el precio de la caja, así que la caja vale lo que vale y esto es un
  // número fijo. Un solo factor —el precio— en vez de dos que se contradigan.
  tabla.push({
    id: 'nanites', weight: 34,
    build: () => { const a = rand(250, 400); return { kind: 'nanites', amount: a, name: 'Nanitas', label: `+${a} Nanitas`, details: 'Materia prima básica', rarity: 'Común', icon: 'bolt' }; }
  });

  // F26 · LA CAJA T{n} SUELTA EL CRISTAL T{n}. Una línea, y es la que convierte
  // la regla estricta en algo alcanzable.
  tabla.push({
    id: 'crystals', weight: 26,
    build: () => {
      const a = rand(3 * tier, 5 * tier);
      const def = CRYSTAL_DEFS[tier];
      return {
        kind: 'crystals', amount: a,
        name: def.name, label: `+${a} ${def.name}`,
        details: `Sube el nivel de un recolector T${tier}`,
        rarity: def.rarity, icon: 'crystal', materialTier: tier
      };
    }
  });

  // El compañero del tier de la caja. El poder sale de `TIER_SYSTEM.ranges`, el
  // mismo del que salen el de la tienda y el del salto, así que un T5 de la caja
  // y un T5 comprado hacen exactamente lo mismo (R2).
  tabla.push({
    id: 'companion', weight: 22,
    build: () => {
      const r = TIER_SYSTEM.ranges[tier];
      const p = rand(r[0], r[1]);
      const nombre = nombreDeArriba('companion', tier);
      return {
        kind: 'companion', amount: 1, name: nombre, label: nombre,
        details: `Recolección por segundo: +${p}/s`,
        rarity: rareza, icon: 'companion', tier,
        item: {
          id: `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: nombre, type: 'companion', details: `Recolección por segundo: +${p}/s`,
          rarity: rareza, tier, companionType: 'passive', power: p,
          sellPrice: Math.floor(p * 62)
        }
      };
    }
  });

  // El recolector sobrecargado entra en la T3. Antes la caja común solo daba un
  // dron y su salto; a partir de la T3 hay dos objetos de tier en la tabla, que
  // es cuando una caja empieza a merecer el nombre de caja de tier y no de caja
  // de.material.
  if (tier >= 3) {
    tabla.push({
      id: 'collector', weight: 20,
      build: () => {
        const w = makeOverclockCollector(tier);
        return { kind: 'collector', amount: 1, name: w.name, label: w.name, details: w.details, rarity: w.rarity, icon: 'collector', tier, item: w.item };
      }
    });
  }

  // La llave de la caja, la suya. Sale de `CRATE_KEY_TIER` y el nombre del
  // `label` sale de `KEY_DEFS`, así que la ruleta no puede anunciar una llave que
  // no sea la que entra.
  tabla.push(buildKeyLoot(tier));

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
            tier: 0, sellPrice: Math.floor(costeDeCaja(tier + 1) / 4),
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
  tabla.push(buildExpansorLoot(expansorDeCaja(tier), rareza));

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
          item: { id: `crate_nano_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: def.name, type: 'consumable', details: def.details, rarity: def.rarity, buffId: def.buffId, stackable: true, stackCount: 1, sellPrice: 55000 }
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
          item: { id: `crate_stone_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: def.name, type: 'consumable', details: def.details, rarity: def.rarity, buffId: def.buffId, stackable: true, stackCount: a, sellPrice: 11250 }
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
      // El botín da el cristal del nivel que declara la entrada, y F26 quiere que
      // ese nivel sea SIEMPRE el de la caja. El `?? 1` es el suelo: una entrada
      // sin `materialTier` es un dato corrupto, y el T1 siempre está a mano.
      applier.crystals(reward.amount, reward.materialTier ?? 1);
      return reward;
    }
    case 'keys': {
      applier.keys(reward.amount, reward.keyTier ?? 1);
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
