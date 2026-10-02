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

export const AFFIXES: Affix[] = [
  { id: 'aff_sharp', name: 'Afilado', description: '+18% al daño de click.', rarity: 'Raro',
    effect: { clickMult: 0.18 } },
  { id: 'aff_rapid', name: 'Cadencia', description: '+12% al daño de click.', rarity: 'Raro',
    effect: { clickMult: 0.12 } },
  { id: 'aff_yield', name: 'Rendimiento', description: '+20% al ingreso pasivo.', rarity: 'Raro',
    effect: { passiveMult: 0.20 } },
  { id: 'aff_flow', name: 'Flujo', description: '+14% al ingreso pasivo.', rarity: 'Raro',
    effect: { passiveMult: 0.14 } },
  { id: 'aff_bulwark', name: 'Baluarte', description: '+60 de daño plano.', rarity: 'Épico',
    effect: { flatDamage: 60 } },
  { id: 'aff_core', name: 'Núcleo', description: '+40 de ingreso pasivo plano.', rarity: 'Épico',
    effect: { flatPassive: 40 } },
  { id: 'aff_crit', name: 'Crítico', description: '+8% de probabilidad de crítico (×2 daño).', rarity: 'Épico',
    effect: { critChance: 0.08 } },
  { id: 'aff_focus', name: 'Foco', description: '+14% de probabilidad de crítico.', rarity: 'Legendario',
    effect: { critChance: 0.14 } },
  { id: 'aff_luck', name: 'Suerte de Forja', description: '+10% a la probabilidad de crafteo del recolector.', rarity: 'Legendario',
    effect: { craftLuck: 0.10 } },
  { id: 'aff_ephemeral', name: 'Efenéreo', description: '+35% a ambos multiplicadores.', rarity: 'Legendario',
    effect: { clickMult: 0.35, passiveMult: 0.35 } },
  { id: 'aff_eternal', name: 'Eterno', description: '+8 de daño por cada nivel del recolector.', rarity: 'Mítico',
    effect: { flatDamage: 8 } },
  { id: 'aff_absorb', name: 'Absorción', description: '+18 de ingreso pasivo por cada 5 niveles.', rarity: 'Mítico',
    effect: { flatPassive: 18 } },
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
 * El potencial es la escala 1..5 de un item, y **define su daño**: dentro del
 * rango de su tier, 1 pega en el mínimo y 5 pega en el máximo. 5 es perfección
 * del 100%, y da exactamente el tope, sin redondeos que lo dejen un pelo por
 * debajo.
 *
 * Antes el daño no salía de aquí: el forjado usaba el PUNTO MEDIO del rango y la
 * tienda tiraba un número suelto. Eso es lo que hacía que el mejor item forjado
 * quedara por debajo de uno de tienda con suerte. Ahora los dos caminos salen de
 * `danioDeRango`, y por eso el potencial y el daño no pueden separarse.
 */
export function danioDeRango(tier: number, potential: number): number {
  const r = rangoDePoder(Math.max(1, tier));
  const p = Math.max(1, Math.min(5, Math.round(potential) || 3));
  return Math.round(r[0] + ((p - 1) / 4) * (r[1] - r[0]));
}

/**
 * El potencial que explica el daño que un item YA tiene.
 *
 * Va al revés que `danioDeRango` a propósito, y es la misma regla en las dos
 * direcciones. Se usa para deducir el potencial de los items que ya estaban
 * guardados antes de que existiera el campo.
 */
export function potencialDeDanio(item: CollectorItem): number {
  const r = rangoDePoder(Math.max(1, item.tier || 1));
  const span = r[1] - r[0];
  if (span <= 0) return 3;
  const pos = ((item.damage ?? r[0]) - r[0]) / span;
  return Math.max(1, Math.min(5, Math.round(pos * 4) + 1));
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
 * Potencial 1..5 al crear un item nuevo.
 *
 * Sale del dado: es la lotería de la tienda y de las cajas. **La forja no lo
 * tira, lo promedia**, y esa es justo la diferencia entre las dos vías.
 *
 * El 5 es el más raro a propósito. Con un reparto plano, uno de cada cinco items
 * sería perfecto y buscarlo dejaría de ser nada; así que el 5 sale un 10%.
 */
export function rollPotentialFrom(rng: () => number = Math.random): number {
  if (rng() < 0.10) return 5; // 10% perfección
  return 1 + Math.floor(rng() * 4); // 1..4, el 90% restante
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

  // El daño sale del potencial y del rango del tier nuevo. Una sola función, y
  // la misma que usa la tienda, así que potencial y daño no pueden separarse.
  const baseDamage = danioDeRango(newTier, potential);

  // Cuántos afijos hereda según potencial. La nanopartícula sube el tope a 4:
  // es su segundo efecto, el que justifica pagar 90.000 por ella.
  const baseAffixCount = Math.min(3, Math.max(1, potential - 1));
  const affixCount = Math.min(4, baseAffixCount + (nanoUsed > 0 ? 1 : 0));
  const affixes = pickAffixes(affixCount, materials);

  // F33 · El daño ES el del rango para este potencial. Ya no se multiplica por
  // `potentialMult`: el potencial ya elegía DÓNDE cae el stat dentro del rango, y
  // aplicarle encima otro 12% por estrella hacía que el mismo número mandara dos
  // veces en el mismo daño.
  const damage = baseDamage;

  const rarity = collectorRarity(newTier, potential);

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

/** Elige N afijos distintos, con pesos inversos a la rareza. */
function pickAffixes(count: number, materials: CollectorItem[]): string[] {
  // Un afijo "semilla" por material, para que la herencia tenga sentido
  const candidates = AFFIXES.slice();
  const picked: string[] = [];

  for (let i = 0; i < count && candidates.length > 0; i++) {
    // Peso: los afijos más raros pesan menos (1/pesoRareza)
    const weights = candidates.map(a => {
      const rw = RARITY_WEIGHT[a.rarity] ?? 1;
      return 1 / (0.5 + rw);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    let idx = 0;
    for (; idx < weights.length - 1; idx++) {
      roll -= weights[idx];
      if (roll <= 0) break;
    }
    picked.push(candidates[idx].id);
    candidates.splice(idx, 1);
  }
  return picked;
}
