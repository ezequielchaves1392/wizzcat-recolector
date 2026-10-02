// ==========================================================================
// Crafteo de recolectores · Fusión, autoría y potencial
//
// Reglas de diseño que sostienen el sistema:
//
//  1. FUSIÓN: 3 recolectores del mismo tier T -> 1 recolector de tier T+1. Tres en vez de
//     dos porque con dos el jugador solo tiene una decisión binaria; con tres
//     puede elegir CUALES tres, y eso importa cuando hay afijos en juego.
//
//  2. AUTORÍA: todo recolector crafteado registra quién la forjó. Es lo que hace que
//     dos recolectores del mismo tier no sean el mismo objeto. Un recolector de otro
//     jugador vale más en el mercado, pero no rinde más: son dos ejes separados.
//
//  3. POTENCIAL: 1..5 estrellas, determinado por la rareza de los materiales,
//     su nivel y el uso de Piedras de Calibración. El potencial sube el techo
//     de nivel (20 normal, hasta 35 con 5 estrellas) y multiplica el valor:
//     es lo que hace que un recolector crafteado sea claramente superior a una de
//     tienda del mismo tier.
//
//  4. HERENCIA: la nueva recolector conserva 1..3 afijos de los materiales. Con
//     más estrellas, más afijos. Los afijos se eligen al azar del pool, pero
//     con pesos: los raros pesan menos.
//
//  5. IDENTIDAD: cada recolector conserva quién la forjó, para que el objeto sea
//     único y el mercado tenga historia. Un recolector hecha por alguien conocido
//     vale más en la tienda, pero rinde lo mismo en tu daño: son dos ejes
//     separados a propósito, para que la fama no se compre con dinero.
//
//  6. COMPENSACIÓN POR FALLO: al fallar se pierden los tres materiales, pero
//     se ganan esquirlas proporcionales al tier. Sin esto, una racha mala
//     vacía el almacén y el jugador deja de intentarlo; con esto, cada fallo
//     acerca un poco la garantía del siguiente intento.
// ==========================================================================

import type { Affix, Rarity, CollectorItem } from '../types/domain';
import { rangoDePoder, rarezaDeTier } from './tiers';

// --------------------------------------------------------------------------
// Atributos
// --------------------------------------------------------------------------

// ==========================================================================
//  Atributos
//
//  **NINGÚN afijo da daño plano, y no es una preferencia de redacción.** Cuatro de
//  ellos lo hagan (`flatDamage` / `flatPassive`: +60, +40, +8 y +18) y rompen
//  items de tier bajo sin avisar: un "+60 de daño plano" en un T1, cuya base es 5,
//  más que triplica el item. Y no se ve en el banco, porque el banco comprueba
//  que el afijo exista, no que el item al que se lo pone siga siendo razonable.
//
//  Por eso TODOS son porcentajes, o porcentajes por nivel. Un +35% da 1,75 en un
//  T1 y 238 en un T10: escala con el item, no lo rompe. Los que dependen del
//  nivel (`clickMultPorNivel`, `passiveMultPorNiveles`) también son porcentajes,
//  así que subir de nivel sigue valiendo pero nunca se sale del item.
// ==========================================================================

export const AFFIXES: Affix[] = [
  { id: 'aff_sharp', name: 'Afilado', description: '+18% al daño de click.', rarity: 'Raro',
    effect: { clickMult: 0.18 } },
  { id: 'aff_rapid', name: 'Cadencia', description: '+12% al daño de click.', rarity: 'Raro',
    effect: { clickMult: 0.12 } },
  { id: 'aff_yield', name: 'Rendimiento', description: '+20% al ingreso pasivo.', rarity: 'Raro',
    effect: { passiveMult: 0.20 } },
  { id: 'aff_flow', name: 'Flujo', description: '+14% al ingreso pasivo.', rarity: 'Raro',
    effect: { passiveMult: 0.14 } },
  { id: 'aff_bulwark', name: 'Baluarte', description: '+35% al daño de click.', rarity: 'Épico',
    effect: { clickMult: 0.35 } },
  { id: 'aff_core', name: 'Núcleo', description: '+25% al ingreso pasivo.', rarity: 'Épico',
    effect: { passiveMult: 0.25 } },
  { id: 'aff_crit', name: 'Crítico', description: '+8% de probabilidad de crítico (×2 daño).', rarity: 'Épico',
    effect: { critChance: 0.08 } },
  { id: 'aff_focus', name: 'Foco', description: '+14% de probabilidad de crítico.', rarity: 'Legendario',
    effect: { critChance: 0.14 } },
  { id: 'aff_luck', name: 'Suerte de Forja', description: '+10% a la probabilidad de crafteo del recolector.', rarity: 'Legendario',
    effect: { craftLuck: 0.10 } },
  { id: 'aff_ephemeral', name: 'Efenéreo', description: '+35% a ambos multiplicadores.', rarity: 'Legendario',
    effect: { clickMult: 0.35, passiveMult: 0.35 } },
  { id: 'aff_eternal', name: 'Eterno', description: '+2% de daño por cada nivel del recolector.', rarity: 'Mítico',
    effect: { clickMultPorNivel: 0.02 } },
  { id: 'aff_absorb', name: 'Absorción', description: '+5% de ingreso por cada 5 niveles.', rarity: 'Mítico',
    effect: { passiveMultPorNiveles: 0.05 } },
  { id: 'aff_prime', name: 'Primo', description: '+55% a todos los multiplicadores del recolector.', rarity: 'Mítico',
    effect: { clickMult: 0.55, passiveMult: 0.55 } },
  { id: 'aff_void', name: 'Vacío Devorador', description: '+25% al daño, +25% al pasivo, +10% crítico.', rarity: 'Divino',
    effect: { clickMult: 0.25, passiveMult: 0.25, critChance: 0.10 } }
];

export const AFFIX_BY_ID: Record<string, Affix> = Object.fromEntries(AFFIXES.map(a => [a.id, a]));

/** Techo de nivel de un recolector que no lo trae: los de la tienda. */
export const BASE_COLLECTOR_MAX_LEVEL = 20;

/** Cuántos niveles extra da cada estrella de potencial. */
const MAX_LEVEL_PER_POTENTIAL = 3;

/**
 * El techo de niveles de un recolector.
 *
 * Recibe el `maxLevel` del item y no el item entero. Una razón es que la regla es
 * sobre un número y no necesita conocer la forma del item. La otra es la que
 * cuesta: `{ maxLevel?: number }` es un *weak type* —todos sus campos opcionales—
 * y TypeScript rechaza con TS2559 cualquier objeto que no comparta ninguna
 * propiedad con él, así que un `WarehouseItem` no se le puede pasar ni con el
 * tipo bien puesto.
 *
 * POR QUÉ ESTA FUNCIÓN Y NO UN `?? 20` EN CADA SITIO. El techo se escribía a mano
 * en cinco sitios y los cinco no coincidían: la ficha del almacén, el panel del
 * jugador, la valoración y el desglose usaban `item.maxLevel ?? 20`, el game loop
 * comparaba contra una constante de 20 y el selector de cristales contra un 35 a
 * pelo. De ahí dos bugs que no se parecían: un recolector forjado con techo 28
 * llegaba al 20 y el juego respondía "ya no puedes" mientras la barra de la ficha
 * seguía llegando a 28; y un recolector de la tienda en su nivel 20 abría el
 * selector, gastaba el cristal y le rechazaban la sintonización.
 *
 * El techo pertenece a la MISMA regla que lo crea —`maxLevel: 20 + potencial * 3`
 * más abajo en este mismo fichero—, así que vive aquí y lo leen el motor y las
 * vistas por igual. Una regla compartida escrita cinco veces no está compartida:
 * está copiada, y las copias divergen.
 *
 * Si el item no trae `maxLevel` es que viene de la tienda, y esos topan en 20. Un
 * `maxLevel` de 0 o negativo también cae al de base: es dato corrupto, y tratarlo
 * como "techo cero" dejaría al recolector sin poder subir nunca.
 */
export function collectorMaxLevel(maxLevel?: number | null): number {
  if (typeof maxLevel === 'number' && maxLevel > 0) return maxLevel;
  return BASE_COLLECTOR_MAX_LEVEL;
}

/**
 * Cristales que cuesta subir del nivel dado al siguiente.
 *
 * Vive AQUÍ y no en `gameLoop.ts` por una razón concreta: es la mitad de la
 * sintonización, y la otra mitad —la probabilidad de éxito,
 * `crystalSuccessChance()` en `data/items.ts`— ya vivía en `data/`. Una regla
 * partida en dos sitios es una regla que se puede tocar por un lado y olvidar por
 * el otro.
 *
 * 1,1,2,2,3,3,5,6,8,9,11,14,17,21,26,32,40,50,63,79 -> 456 cristales en total,
 * 91 200 nanitas con el cristal a 200.
 *
 * POR QUÉ SUBIÓ DE 1.14 A 1.26. Antes subir a nivel 20 costaba 100 cristales, que
 * a 60 cada uno salían 6 000 nanitas: menos del 4% de un T10. No había nada que
 * decidir, era un botón. Ahora subir al máximo cuesta la mitad del recolector,
 * que es la relación que hace que "¿llevo esto a 15 o a 16?" sea una pregunta de
 * verdad.
 *
 * Y por qué NO depende del tier del recolector, que es lo tentador: porque el
 * coste es POR INTENTO, no por item. Sube un T1 y sale carísimo; sube un T10 y
 * sale la mitad de su precio. La consecuencia buscada es que no se desperdicie
 * cristal en un recolector malo, que es justo lo que se quiere: el jugador
 * invierte en lo que le va a durar la partida.
 */
export function collectorUpgradeCost(level: number): number {
  return Math.max(1, Math.floor(1.2 * Math.pow(1.26, level)));
}

// --------------------------------------------------------------------------
// Probabilidad de éxito
// --------------------------------------------------------------------------

/**
 * La BASE de recolección de un tier: el daño de un item antes de que el
 * potencial le sume nada.
 *
 * Es el mínimo del rango que ya tenía cada tier, y no un número nuevo: así el
 * precio de la carta, que se calibró contra ese rango, y el daño del item salen
 * del mismo sitio (R2). `rangoDePoder` pasa a ser la referencia de precio y la
 * tabla que el jugador ve, y el daño sale de aquí.
 *
 * Y hay que subirla un poco, y el motivo es la única cosa rota que traen los
 * multiplicadores: **con la base en el mínimo del rango, los tiers se solapan**.
 * El T1 va de 6 (★1) a 10 (★5) y el T2 de 10 (★1) a 16 (★5), así que un T1
 * perfecto iguala a un T2 normal, y "más tier es más daño" deja de ser cierto.
 * Compra por probabilidad, no por tier.
 *
 * Por eso se sube un 20% la base de cada tier por encima del mínimo del rango:
 * el T1 pasa a 7-14 y el T2 a 11-22, y ahora **el peor T2 supera al mejor T1**.
 * Que la progresión sea legible vale más que encajar el daño con una tabla que
 * estaba calibrada cuando el daño no tenía azar.
 */
export function baseDeTier(tier: number): number {
  const t = Math.max(1, tier);
  const minT1 = rangoDePoder(1)[0];
  // Razón por tier. El rango crece ×1,62, que es MENOS de 1,67, y como el
  // potencial llega a ×2,0 dos tiers atrás empatan con este de aquí. Con 1,75
  // hay separación real, y la progresión se lee: subir de tier siempre mejora,
  // potential o no.
  const RAZON = 1.75;
  const ideal = minT1 * Math.pow(RAZON, t - 1);
  if (t === 1) return Math.round(ideal);
  // El `+1` es para el redondeo. En los tiers bajos —donde los números son de
  // una o dos cifras— 18 redondeados se empatan con 18 redondeados, y eso es un
  // empate real, no un detalle de la tabla: sin él un T3 con ★1 igualaría a un
  // T2 con ★5 y volvería a comprarse por potencial en vez de por tier.
  const minimo = baseDeTier(t - 1) * 2 + 1;
  return Math.max(Math.round(ideal), minimo);
}

/**
 * El daño BASE de un item: su base de tier por el potencial.
 *
 * Cada estrella es un 20%, y **el potencial 1 ya es +20%** — o sea que ★5 es
 * exactamente el doble de la base, que es la perfección del 100%. El ejemplo que
 * lo fija: base 5 con ★5 da 10.
 *
 *   ★1 = ×1,2 · ★2 = ×1,4 · ★3 = ×1,6 · ★4 = ×1,8 · ★5 = ×2,0
 *
 * **Esto es el daño del item, no el del click.** Sobre él siguen actuando el
 * nivel (los cristales), la rareza y los afijos. Aquí no hay ninguno de esos, y
 * deliberadamente: el potencial es la ÚNICA escala que multiplica la base, y por
 * eso no lleva además un segundo multiplicador encima — ese error sí estaba, y
 * por eso el potencial nunca llegaba a ×2.
 *
 * **Consecuencia de balance:** como esto es un multiplicador y el rango viejo no
 * lo era, el techo de daño de cada tier **se multiplica por 2**. El T5 pasa de un
 * rango de 34-50 a una base de 34 que con ★5 da 68. Las proporciones entre tiers
 * se conservan porque todos se mueven igual, pero el precio por punto baja en
 * todos a la vez, y `balanceCheck` mide esa banda.
 */
export function danioDeRango(tier: number, potential: number): number {
  return Math.round(baseDeTier(tier) * (1 + 0.2 * potencialNormalizado(potential)));
}

/** El potencial entero 1..5, para que nadie tenga que repetir el recorte. */
export function potencialNormalizado(potential: number | undefined): number {
  const p = Math.round(Number(potential));
  return Number.isFinite(p) && p >= 1 && p <= 5 ? p : 3;
}

/**
 * El daño que explica el que un item YA tiene.
 *
 * Va al revés que `danioDeRango` a propósito, y es la misma regla en las dos
 * direcciones. Se usa para deducir el potencial de los items que ya estaban
 * guardados antes de que existiera el campo.
 */
export function potencialDeDanio(item: CollectorItem): number {
  const base = baseDeTier(item.tier);
  if (base <= 0) return 3;
  return potencialNormalizado(((item.damage ?? base) / base - 1) / 0.2);
}

/**
 * El potencial que trae un item, deducido del daño si no lo trae.
 *
 * Los items viejos no tienen el campo, y ponerles un 3 a pelo cambiaría su
 * daño al punto medio al abrir la partida —eso sí sería tocarle el progreso al
 * jugador. Deducirlo del daño que ya tienen los deja intactos.
 */
export function potencialDe(item: CollectorItem): number {
  const p = item.potential;
  return typeof p === 'number' && p >= 1 && p <= 5 ? p : potencialDeDanio(item);
}

/**
 * La probabilidad de cada potencial, y es **decreciente a propósito**: sacar un
 * ★1 tiene que ser mucho más fácil que sacar un ★5, porque el ★5 es ×2 y el ★1
 * es ×1,2. Con un reparto plano, uno de cada cinco items sería perfecto y buscar
 * uno dejaría de ser una búsqueda.
 *
 * `★5` sale un 3%: con la forja promediando, dos ★5 son el camino al item
 * perfecto, y por eso tiene que ser raro y no regalado.
 */
export const POTENTIAL_WEIGHTS: Record<number, number> = {
  1: 0.50, 2: 0.25, 3: 0.15, 4: 0.07, 5: 0.03
};

/**
 * Potencial 1..5 al crear un item nuevo.
 *
 * Sale del dado: es la lotería de la tienda y de las cajas. **La forja no lo
 * tira, lo promedia**, y esa es justo la diferencia entre las dos vías.
 */
export function rollPotentialFrom(rng: () => number = Math.random): number {
  const t = rng();
  let acum = 0;
  for (let p = 1; p <= 5; p++) {
    acum += POTENTIAL_WEIGHTS[p];
    if (t < acum) return p;
  }
  return 5;
}

/**
 * Dónde cayó un material dentro del rango de su tier, de 0 a 1.
 *
 * Es la regla de F33: lo que se mezcla al forjar **no es el daño, es la
 * posición**. Un T10 tirado en 373 y otro en 559 no valen lo mismo aunque los dos
 * sean T10, y esa diferencia es la que hace que buscar el item perfecto sea una
 * decisión y no una casualidad.
 *
 * **Se recorta a 0..1 a propósito**, y por dos motivos que no son hipotéticos:
 * el daño de un item sube con el potencial y con los afijos, y el de uno ya
 * sintonizado sube con el nivel. Sin el recorte, un T5 de nivel 20 daría una
 * posición de 4 y el forjado siempre saldría en el tope — o sea, la forja
 * premiaría haber invertido antes en vez de en elegir bien el material.
 */
export function posicionEnRango(item: CollectorItem): number {
  return (potencialDeDanio(item) - 1) / 4;
}

/** Probabilidad base de éxito de una fusión de tier T → T+1. */
export function baseSuccessChance(fromTier: number): number {
  // T1 78% → T10 33%. Del T11 en adelante pisa el suelo del 30%: la curva
  // creciente de F34 (60/68/75) está propuesta pero sin visto bueno, así que
  // no se toca el signo hasta que lo haya. El suelo evita el absurdo de una
  // probabilidad negativa en tiers altos.
  return Math.max(0.30, 0.78 - (fromTier - 1) * 0.05);
}

/** Chance final = base + pasivas + piedras, topado a 95%. */
export function successChance(
  fromTier: number,
  craftLuck: number,
  stonesUsed: number,
  affixLuck: number,
  nanoUsed = 0
): number {
  const base = baseSuccessChance(fromTier);
  // Cada piedra: +12%. Se topan a 5 piedras por fusión.
  const stones = Math.min(5, stonesUsed) * 0.12;
  // La nanopartícula da +8% y además garantiza un afijo extra. Aporta menos
  // puntos que una piedra pero hace dos cosas, que es la razón por la que es
  // un objeto raro y no un consumible más.
  const nano = nanoUsed > 0 ? 0.08 : 0;
  const total = base + craftLuck + stones + affixLuck + nano;
  return Math.min(0.95, total);
}

// --------------------------------------------------------------------------
// Potencial
// --------------------------------------------------------------------------

/**
 * Potencial 1..5. Sube con:
 *  - Materiales de rareza alta (sobrecargados/míticos)
 *  - Recolectores de nivel alto (invertidas en experiencia, no en dinero)
 *  - Piedras de Calibración usadas
 */
export function rollPotential(materials: CollectorItem[], stonesUsed: number): number {
  let score = 1;

  // Cada material aporta según rareza y nivel
  for (const m of materials) {
    const rarityScore = RARITY_WEIGHT[m.rarity] ?? 0;
    const levelScore = (m.level || 0) * 0.06;
    score += rarityScore * 0.4 + levelScore;
  }

  score += stonesUsed * 0.25;

  // Redondea a potencial entero con algo de azar para que no sea determinista
  const jitter = (Math.random() - 0.5) * 0.8;
  return Math.max(1, Math.min(5, Math.round(score + jitter - 0.5)));
}

const RARITY_WEIGHT: Record<Rarity, number> = {
  'Común': 0, 'Raro': 0.5, 'Épico': 1, 'Legendario': 1.6, 'Mítico': 2.4, 'Divino': 3.2, 'Sobrecargado': 2.8
};

// --------------------------------------------------------------------------
// Nombres de recolectores crafteadas
// --------------------------------------------------------------------------

const FORGE_PREFIX = ['Forja de', 'Espuela de', 'Nucleo de', 'Herencia de', 'Sello de', 'Yunque de'];
const FORGE_NOUN = ['Vórtice', 'Éclipsis', 'Confín', 'Ceniza', 'Éter', 'Nébula', 'Duna', 'Ónix', 'Zafiro', 'Cobalto'];

/** Nombre generado: "Forja de Ceniza" + sufijo de linaje. */
export function forgeCollectorName(potential: number, tier: number, rng = Math.random): string {
  const p = FORGE_PREFIX[Math.floor(rng() * FORGE_PREFIX.length)];
  const n = FORGE_NOUN[Math.floor(rng() * FORGE_NOUN.length)];
  const tierSuffix = tier >= 11 ? ' PRIMIGENIA' : tier >= 9 ? ' SINGULAR' : '';
  const potSuffix = potential >= 5 ? '·Absoluta' : potential >= 4 ? '·Prima' : '';
  return `${p} ${n}${tierSuffix}${potSuffix}`;
}

// --------------------------------------------------------------------------
// Fusión
// --------------------------------------------------------------------------

export interface ForgeResult {
  success: boolean;
  collector?: CollectorItem;
  /** Esquirlas ganadas por el fallo. */
  shards?: number;
  chanceUsed?: number;
  error?: string;
}

/**
 * Intenta fusionar 2 recolectores del mismo tier.
 * - Si tiene éxito: devuelve el nuevo recolector, los 2 materiales se consumen.
 * - Si falla: se consumen los materiales, se devuelven esquirlas.
 */
export function attemptForge(
  materials: CollectorItem[],
  tier: number,
  authorName: string,
  options: {
    craftLuck: number;
    shardBonus: number;
    stonesUsed: number;
    /** 1 si se gasta una Nanopartícula de Estabilidad en esta fusión. */
    nanoUsed?: number;
    maxTier?: number;
  }
): ForgeResult {
  const maxTier = options.maxTier ?? Infinity; // Forja infinita: el precio frena solo

  if (materials.length !== 2) {
    return { success: false, error: 'Se necesitan 2 recolectores del mismo tier.' };
  }
  // F24 · Dos POSICIONES no son dos MATERIALES. Sin esto, mandar el mismo id dos
  // veces cuenta como dos: se "fusiona" un solo recolector y sale otro,
  // ahorrándose un material. El que cuenta es el motor, no la vista.
  if (new Set(materials.map(m => m.id)).size !== 2) {
    return { success: false, error: 'Selecciona 2 recolectores distintos.' };
  }
  if (tier < 1 || tier >= maxTier) {
    return { success: false, error: `No se pueden forjar recolectores de tier ${tier + 1}.` };
  }
  // Todos deben ser del mismo tier
  if (materials.some(m => m.tier !== tier)) {
    return { success: false, error: 'Los 2 recolectores deben ser del mismo tier.' };
  }

  // Probabilidad de afijos heredados (para el cálculo de chance)
  const affixLuck = materials.reduce((acc, m) => acc + (m.affixes?.length || 0) * 0.02, 0);
  const nanoUsed = options.nanoUsed ?? 0;
  const chance = successChance(tier, options.craftLuck, options.stonesUsed, affixLuck, nanoUsed);

  const roll = Math.random();
  if (roll > chance) {
    // Fallo: esquirlas proporcionales al tier y a los materiales
    const baseShards = 8 + tier * 6;
    const matBonus = materials.reduce((a, m) => a + RARITY_WEIGHT[m.rarity] * 4, 0);
    const shards = Math.round((baseShards + matBonus) * (1 + options.shardBonus));
    return { success: false, shards, chanceUsed: chance };
  }

  // Éxito: construir el recolector
  // F33 · El potencial es la MEDIA de los dos materiales, y es el potencial lo
  // que decide el daño. Antes salía de `rollPotential`, que lo tiraba de la
  // rareza, y el daño era el punto medio del rango: un item forjado nunca podía
  // salir en el máximo ni con materiales perfectos.
  //
  // Y ojo con la consecuencia, que es la que hace útil la forja: promediar
  // NUNCA sube el resultado. Un 5 sale de un 5, y un 4 de un 4 y un 5. O sea
  // que la perfección se consigue en la tienda o en las cajas, y la forja es la
  // que **consolida**: te da el potencial que querías sin depender del azar.
  const potential = Math.max(1, Math.min(5, Math.round(
    materials.reduce((acc, m) => acc + potencialDe(m), 0) / materials.length
  )));
  const newTier = tier + 1;
  const name = forgeCollectorName(potential, newTier);

  // El daño sale del potencial y de la base del tier nuevo. Una sola función, y
  // la misma que usa la tienda, así que potencial y daño no pueden separarse.
  const damage = danioDeRango(newTier, potential);

  // La rareza va ANTES que los afijos, porque es lo que decide cuántos lleva: la
  // rareza da el mínimo y el tope es 6 para todos. Antes el número venía del
  // potencial y la rareza no ZEJohinting nada, así que un Divino podía salir con
  // un afijo y un Común con tres.
  const rarity = collectorRarity(newTier, potential);
  const affixes = pickAffixes(materials, rarity, nanoUsed > 0);

  const collector: CollectorItem = {
    id: `forged_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name,
    type: 'collector',
    details: `Daño base: +${damage}`,
    rarity,
    tier: newTier,
    level: 0,
    // El techo sube con potencial: 20 + 3 por estrella (máx 35). Se calcula con la
    // misma regla que lee todo el mundo, para que el techo que se crea y el que
    // se comprueba no puedan separarse.
    maxLevel: BASE_COLLECTOR_MAX_LEVEL + potential * MAX_LEVEL_PER_POTENTIAL,
    potential,
    damage,
    affixes,
    forgedBy: authorName,
    forgedAt: Date.now(),
    lineage: materials.map(m => m.rarity),
    sellPrice: 0 // se calcula dinámicamente
  };

  return { success: true, collector, chanceUsed: chance };
}

function collectorRarity(tier: number, potential: number): Rarity {
  const base = rarezaDeTier(tier) as Rarity ?? 'Común';
  if (potential >= 5 && tier >= 9) return 'Divino';
  if (potential >= 4 && tier >= 7) return 'Mítico';
  if (potential >= 3 && tier >= 5) return 'Legendario';
  if (potential >= 2 && tier >= 3) return 'Épico';
  return (base as Rarity) || 'Común';
}

/** Cuántos afijos lleva como MÍNIMO un item de cada rareza. El tope son 6. */
export const AFIX_MIN_POR_RARIDAD: Record<string, number> = {
  'Común': 0, 'Raro': 1, 'Épico': 2, 'Legendario': 3,
  'Mítico': 4, 'Divino': 5, 'Sobrecargado': 6
};

/** El tope de afijos de un item. Nadie lleva más de estos. */
export const AFIX_MAX = 6;

/**
 * Reparte los afijos del item forjado.
 *
 * **La rareza da el mínimo** y el tope es 6 para todos, así que lararety de un
 * Divino con un afijo —que era lo que pasaba antes— ya no puede salir. La
 * nanopartícula sube el mínimo en uno: es su segundo efecto y el que justifica
 * pagar 90.000 por ella.
 *
 * **La mezcla es en dos pasos, y ese orden es lo que la hace tener sentido:**
 *
 * 1. Primero se cogen afijos **de los dos materiales**, al azar entre los que
 *    tienen entre los dos. Es la herencia: los afijos buenos se transmiten de
 *    verdad, y por eso buscar un item con buenos afijos tiene recompensa.
 * 2. Si aún faltan para llegar al mínimo de la rareza, se rellenan **al azar de
 *    todo el catálogo**, con los raros pesando menos.
 *
 * El paso 1 va primero a propósito. Si rellenara de catálogo y luego heredara,
 * muchas veces no quedaría hueco para heredar y el paso 1 casi no se vería.
 *
 * Con dos materiales no se puede pasar de 12 afijos distintos, pero el tope de 6
 * hace esa cuenta irrelevante.
 */
function pickAffixes(materials: CollectorItem[], rarity: string, nanoparticula: boolean): string[] {
  const minimo = Math.min(
    AFIX_MAX,
    (AFIX_MIN_POR_RARIDAD[rarity] ?? 0) + (nanoparticula ? 1 : 0)
  );
  if (minimo <= 0) return [];

  const picked: string[] = [];
  const usados = new Set<string>();

  // 1 · Herencia: al azar entre los afijos que tienen los dos materiales juntos.
  const heredables: string[] = [];
  for (const m of materials) {
    for (const id of m.affixes ?? []) {
      if (!usados.has(id) && !heredables.includes(id) && AFFIXES.some(a => a.id === id)) {
        heredables.push(id);
      }
    }
  }
  while (picked.length < minimo && heredables.length > 0) {
    const i = Math.floor(Math.random() * heredables.length);
    const id = heredables[i];
    picked.push(id);
    usados.add(id);
    heredables.splice(i, 1);
  }

  // 2 · Relleno del catálogo completo, con los afijos raros pesando menos.
  const restantes = AFFIXES.filter(a => !usados.has(a.id));
  while (picked.length < minimo && restantes.length > 0) {
    const weights = restantes.map(a => 1 / (0.5 + (RARITY_WEIGHT[a.rarity] ?? 1)));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    let idx = 0;
    for (; idx < restantes.length - 1; idx++) {
      roll -= weights[idx];
      if (roll <= 0) break;
    }
    picked.push(restantes[idx].id);
    restantes.splice(idx, 1);
  }

  return picked;
}
