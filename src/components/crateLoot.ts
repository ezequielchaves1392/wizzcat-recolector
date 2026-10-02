// Tabla de botín de las cajas y generador de recompensas.
//
// Reglas de diseño que sostiene este archivo:
//  1. La caja es la UNICA fuente de los compañeros multiplicadores y de las recolectores
//     sobrecargadas. No se pueden comprar, por eso la ruleta tiene valore real.
//  2. Todo drop que no cabe en el almacén se compensa en nanitas, nunca se pierde.
//  3. La ruleta NO decide el premio: `rollCrateReward` decide y la animación solo
//     lo muestra. Si se invirtiera, la ruleta estaría mintiendo sobre las probabilidades.

import { TIER_SYSTEM } from '../data/tiers';
import { EXPANSOR_TIERS, type ExpansorTier } from '../data/store';
import type { CrateType } from '../data/store';
import { crateCosmetics, type CrateCosmeticSource } from '../data/cosmetics';
// `CRATE_KEY_TIER` y `KEY_DEFS` entran como VALOR porque la entrada de llaves de
// cada caja se construye desde ellos. Antes iban escritos a mano y por eso la
// llave del Vacío no salía de ninguna parte: la caja legendaria era imposible
// de abrir (B6). Ver `buildKeyLoot`.
import { CRATE_KEY_TIER, KEY_DEFS, type KeyTier } from '../data/items';
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
function buildExpansorLoot(tier: 1 | 2 | 3): LootEntry {
  const def = EXPANSOR_TIERS.find(t => t.tier === tier) as ExpansorTier;
  const rarity = tier === 1 ? 'Raro' : tier === 2 ? 'Épico' : 'Legendario';
  return {
    id: 'expansor',
    weight: 6,
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
    weight: UP_WEIGHTS[crateType],
    // sube UN peldaño (`subirNTier(crateType, 1)`), no "lo que salga"
    build: () => subirNTier(crateType, 1)
  };
}

/** Pesos del salto, por caja. Medidos, no redondeados. */
const UP_WEIGHTS: Record<CrateType, number> = { common: 6, rare: 5, epic: 4, legendary: 4 };

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
  return UP_WEIGHTS[crateType] / total;
}

/** Tirar el salto a mano. Solo para bancos; el juego usa la entrada de la tabla. */
export function tocaElSalto(crateType: CrateType): boolean {
  return Math.random() < probabilidadDeSalto(crateType);
}

/**
 * Un nombre del tier de arriba, elegido al azar entre los tres.
 *
 * El `as Record<number, string[]>` está porque `companionNames` está tipado con las
 * claves literales 1..10 y aquí el índice llega como `number` (sale de
 * `TIER_PROPIO[c] + 1`, y `TIER_PROPIO` es un `Record<CrateType, number>`). El
 * índice es correcto: `Math.min(10, ...)` lo deja siempre en rango.
 */
function nombreDeArriba(origen: 'companion' | 'collector', tier: number): string {
  const tablas = TIER_SYSTEM.companionNames as Record<number, string[]>;
  const lista = origen === 'companion'
    ? tablas[tier]
    : (TIER_SYSTEM.collectorNames as Record<number, string[]>)[tier];
  return lista[rand(0, lista.length - 1)];
}

/**
 * El premio del salto: un tier por encima del que le tocaría a la caja.
 *
 * O sea: una caja común da un T2 (le tocaría T1), una rara da un T4, una épica da
 * un T8 y una legendaria da un T10. La razón de "+1" y no "+2" es que el salto se
 * note sin dejar de ser del mismo juego: un T4 dentro de una caja rara ya es
 * imposible por el precio (4.500 contra 1.500 de la caja) y ya es un premio.
 */
function subirNTier(crateType: CrateType, pasos: number): any {
  const propio = TIER_PROPIO[crateType];
  const tier = Math.min(10, propio + pasos);

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
const TIER_PROPIO: Record<CrateType, number> = { common: 1, rare: 3, epic: 6, legendary: 8 };

export const CRATE_LOOT: Record<CrateType, LootEntry[]> = {
  common: [
    { id: 'nanites', weight: 34, build: () => { const a = rand(250, 400); return { kind: 'nanites', amount: a, name: 'Nanitas', label: `+${a} Nanitas`, details: 'Materia prima básica', rarity: 'Común', icon: 'bolt' }; } },
    { id: 'crystals', weight: 26, build: () => { const a = rand(2, 4); return { kind: 'crystals', amount: a, name: 'Cristales de Mejora', label: `+${a} Cristales`, details: 'Sube el nivel del recolector', rarity: 'Raro', icon: 'crystal', materialTier: 1 }; } },
    { id: 'dron', weight: 22, build: () => ({ kind: 'companion', amount: 1, name: 'Dron Explorador', label: 'Dron Explorador', details: 'Recolección por segundo: +2/s', rarity: 'Común', icon: 'companion', tier: 1, item: { id: `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Dron Explorador', type: 'companion', details: 'Recolección por segundo: +2/s', rarity: 'Común', companionType: 'passive', power: 2, sellPrice: 100 } }) },
    buildKeyLoot('common'),
    buildUpLoot('common'),
    buildExpansorLoot(1),
    { id: 'cosmetic', weight: 5, build: (ctx) => rollCrateCosmetic('common', ctx.ownedCosmetics) }
  ],
  rare: [
    { id: 'crystals', weight: 26, build: () => { const a = rand(6, 10); return { kind: 'crystals', amount: a, name: 'Cristales de Mejora', label: `+${a} Cristales`, details: 'Sube el nivel del recolector', rarity: 'Épico', icon: 'crystal', materialTier: 1 }; } },
    { id: 'companion_t3', weight: 24, build: () => { const t = TIER_SYSTEM.ranges[3]; const p = rand(t[0], t[1]); return { kind: 'companion', amount: 1, name: 'Artillero Táctico', label: 'Artillero Táctico', details: `Recolección por segundo: +${p}/s`, rarity: 'Épico', icon: 'bolt', tier: 3, item: { id: `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Artillero Táctico', type: 'companion', details: `Recolección por segundo: +${p}/s`, rarity: 'Épico', tier: 3, companionType: 'passive', power: p, sellPrice: 400 } }; } },
    { id: 'collector_t4', weight: 20, build: () => { const w = makeOverclockCollector(4); return { kind: 'collector', amount: 1, name: w.name, label: w.name, details: w.details, rarity: w.rarity, icon: 'collector', tier: 4, item: w.item }; } },
    { id: 'epic_crate', weight: 16, build: () => ({ kind: 'crate', amount: 1, name: 'Caja Épica', label: '+1 Caja Épica', details: 'Abre una caja de botín superior', rarity: 'Épico', icon: 'crystal', item: { id: `crate_epic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Caja Épica', type: 'crate', details: 'Contiene recompensas altas', rarity: 'Épico', tier: 0, sellPrice: 1125, stackable: true, stackCount: 1 } }) },
    buildKeyLoot('rare'),
    buildUpLoot('rare'),
    buildExpansorLoot(2),
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
    // Esta faltaba: la caja épica no soltaba NINGUNA llave, así que la Rúnica
    // solo se conseguía abriendo una legendaria, que a su vez necesitaba una
    // llave que no salía de ninguna parte. La escalera de B6 era de tres peldaños
    // y faltaban los tres.
    buildKeyLoot('epic'),
    buildUpLoot('epic'),
    buildExpansorLoot(3),
    { id: 'cosmetic', weight: 6, build: (ctx) => rollCrateCosmetic('epic', ctx.ownedCosmetics) }
  ],
  legendary: [
    { id: 'crystals', weight: 20, build: () => { const a = rand(45, 65); return { kind: 'crystals', amount: a, name: 'Cristales de Mejora', label: `+${a} Cristales`, details: 'Sube el nivel del recolector', rarity: 'Mítico', icon: 'crystal', materialTier: 2 }; } },
    { id: 'collector_oc8', weight: 18, build: () => { const w = makeOverclockCollector(8); return { kind: 'collector', amount: 1, name: w.name, label: w.name, details: w.details, rarity: w.rarity, icon: 'collector', tier: 8, item: w.item }; } },
    { id: 'stability_nano', weight: 14, build: () => ({ kind: 'consumable', amount: 1, name: 'Nanopartícula de Estabilidad', label: 'Nanopartícula de Estabilidad', details: 'Deja el recolector forjado con un afijo garantizado', rarity: 'Legendario', icon: 'flask', item: { id: `crate_nano_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: 'Nanopartícula de Estabilidad', type: 'consumable', details: 'Deja el recolector forjado con un afijo garantizado', rarity: 'Legendario', buffId: 'stabilityNano', stackable: true, stackCount: 1, sellPrice: 55000 } }) },
    { id: 'avatar', weight: 16, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[2]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'globe', item: c.item, exclusive: true }; } },
    { id: 'oracle', weight: 14, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[1]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'crystal', item: c.item, exclusive: true }; } },
    { id: 'sentinel', weight: 12, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[4]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'shield', item: c.item, exclusive: true }; } },
    // D1 · EL ESPECTRO AZULADO (índice 5) ESTABA DEFINIDO Y NO LO SACABA NADIE.
    //
    // Los seis compañeros exclusivos de caja: la tabla usaba 0 a 4 y el quinto se
    // quedaba fuera, o sea que era un compañero que existía en el código y no se
    // podía conseguir de ninguna manera. Va con peso 5, el más bajo de la tabla:
    // es el más raro, y por eso mismo no debe desplazar a los que ya salían.
    //
    // El índice 5 NO lo usa nadie más, así que ningún guardado lo apunta y no hay
    // migración que hacer. Si algún día hay que moverlo, esto es el sitio.
    { id: 'espectro', weight: 5, build: () => { const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[5]); return { kind: 'companion', amount: 1, name: c.companion.name, label: c.companion.name, details: c.item.details, rarity: c.companion.rarity, icon: 'sparkle', item: c.item, exclusive: true }; } },
    buildKeyLoot('legendary'),
    buildUpLoot('legendary'),
    buildExpansorLoot(3),
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
