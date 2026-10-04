// ==========================================================================
// Valoración dinámica de recolectores
//
// El precio de venta ya no es un número escrito en el item: se calcula. Eso
// hace que dos recolectores del mismo tier puedan valer muy distinto, y que mejorar
// un recolector tenga un valor de reventa que sube con ella.
//
// Fórmula base:  valor = tierBase × nivelMult × rarezaMult × potencialMult
//                       × afijos × autor × mercado
//
// La compra de material de crafteo se compara contra el valor de SALIDA del
// producto, no contra un número fijo. Así el equilibrio de la forja se puede
// verificar con aritmética en vez de jugando 200 fusiones.
// ==========================================================================

import type { Rarity, CollectorItem } from '../types/domain';
import { AFFIX_BY_ID, collectorMaxLevel, BASE_COLLECTOR_MAX_LEVEL, potencialNormalizado } from './crafting';
import { TIER_SYSTEM } from './tiers';

/** Valor de referencia de un recolector base de cada tier (sin nivel ni afijos). */
const TIER_BASE_VALUE: Record<number, number> = {
  1: 220, 2: 480, 3: 1000, 4: 2100, 5: 4400,
  6: 9200, 7: 19000, 8: 39000, 9: 80000, 10: 162000, 11: 330000
};

/**
 * Valor base de un tier, con fórmula más allá del 11 (forja infinita).
 *
 * 1-11: la tabla, que es el balance medido. 12+: ×2,05 por tier, la razón a
 * la que crece la propia tabla. Sin esto, un T15 forjado valdría lo mismo
 * que un T11 mientras pega ×1,62^4 más: venderlo sería regalarlo.
 */
export function valorBaseTier(tier: number): number {
  const t = Math.max(1, Math.floor(tier) || 1);
  if (TIER_BASE_VALUE[t] !== undefined) return TIER_BASE_VALUE[t];
  return Math.round(330000 * Math.pow(2.05, t - 11));
}

/**
 * Multiplicador de valor por rareza.
 *
 * Calibrado contra la forja: si la rareza multiplica demasiado, la fusión pasa
 * de "rentable" (1.8x) a "imprescindible" (10x) y el crafteo se traga el juego.
 * Con estos valores la rentabilidad está entre 1.3x y 2.2x en todo el rango:
 * merece la pena, pero no rompe nada.
 */
const RARITY_VALUE_MULT: Record<Rarity, number> = {
  'Común': 1.00,
  'Raro': 1.30,
  'Épico': 1.70,
  'Legendario': 2.20,
  'Mítico': 2.80,
  'Divino': 3.60
};

/** Cada nivel del recolector suma un porcentaje creciente del valor base. */
export function levelValueMult(level: number, maxLevel = BASE_COLLECTOR_MAX_LEVEL): number {
  if (level <= 0) return 1;
  // 0.06 por nivel hasta la mitad, 0.10 después: premia llevar el recolector lejos
  const half = maxLevel / 2;
  let mult = 1;
  for (let i = 0; i < level; i++) {
    mult += i < half ? 0.06 : 0.10;
  }
  return mult;
}

/**
 * Lo que el potencial multiplica el valor de un item.
 *
 * **NORMALIZA ANTES DE MULTIPLICAR, Y POR QUÉ ES IMPORTANTE.** Antes devolvía 1
 * para cualquier potencial ausente o cero, que es el precio de un **★1** — y en
 * un item sin potencial, ese item **no es un ★1**: se pintaba como ★3 y pegaba
 * como ★3 (`danioDeRango` normaliza a 3), así que cobraba por un ★1 un item que
 * hace un 90 % más que un ★1. El número del diálogo y el del daño eran de dos
 * juegos distintos.
 *
 * Con `potencialNormalizado()` los tres coinciden: el daño, las estrellas del
 * almacén y el precio salen del mismo número. Y después de `migraPotenciales()`
 * el campo **siempre** está, así que este camino es solo para el item que aún no
 * ha pasado por la carga — donde, mientras tanto, vale lo que vale de verdad.
 */
export function potentialValueMult(potential: number | undefined): number {
  return 1 + (potencialNormalizado(potential) - 1) * 0.45;
}

export function affixValueMult(collector: CollectorItem): number {
  if (!collector.affixes?.length) return 1;
  let mult = 1;
  for (const id of collector.affixes) {
    const a = AFFIX_BY_ID[id];
    if (!a) continue;
    // Cada afijo aporta según lo que hace, no por su rareza nominal
    let contrib = 0;
    if (a.effect.clickMult) contrib += a.effect.clickMult * 0.8;
    if (a.effect.passiveMult) contrib += a.effect.passiveMult * 0.8;
    // Los de nivel se valoran por su tope: un afijo que da +2% por nivel llega al
    // +40% en el techo de 20. Es un porcentaje del item, así que no rompe nada.
    if (a.effect.clickMultPorNivel) contrib += a.effect.clickMultPorNivel * 20;
    if (a.effect.passiveMultPorNiveles) contrib += a.effect.passiveMultPorNiveles * 4;
    if (a.effect.critChance) contrib += a.effect.critChance * 2.5;
    if (a.effect.craftLuck) contrib += a.effect.craftLuck * 1.5;
    mult += contrib;
  }
  return mult;
}

/**
 * Prima de fama: un recolector forjado por alguien conocido vale más, pero no rinde
 * más. Es el separador entre "objeto" y "trofeo".
 */
export function fameValueMult(authorRank: number | null): number {
  if (authorRank === null) return 1;
  // Top 1 → ×2.2, Top 10 → ×1.5, Top 100 → ×1.2
  if (authorRank <= 1) return 2.2;
  if (authorRank <= 3) return 1.8;
  if (authorRank <= 10) return 1.5;
  if (authorRank <= 50) return 1.3;
  if (authorRank <= 100) return 1.2;
  return 1.05;
}

/**
 * Deriva del mercado: un recolector recién forjada se vende algo más cara y se
 * estabiliza. Se calcula con la edad, sin estado global.
 */
export function marketAgeMult(forgedAt: number | undefined): number {
  if (!forgedAt) return 1;
  const ageDays = (Date.now() - forgedAt) / 86_400_000;
  if (ageDays < 1) return 1.35;      // frescura
  if (ageDays < 7) return 1.15;
  if (ageDays < 30) return 1.0;
  if (ageDays < 90) return 0.94;
  return 0.88;
}

export interface ValuationOptions {
  /** Posición del autor en el ranking, si el autor es conocido. */
  authorRank?: number | null;
  /** Bonificación de venta del árbol de pasivas. */
  sellMult?: number;
}

export function collectorValue(collector: CollectorItem, opts: ValuationOptions = {}): number {
  const base = valorBaseTier(Math.max(1, collector.tier)) ?? 200;
  const levelMult = levelValueMult(collector.level || 0, collectorMaxLevel(collector.maxLevel));
  const rarityMult = RARITY_VALUE_MULT[collector.rarity] ?? 1;
  const potMult = potentialValueMult(collector.potential);
  const affMult = affixValueMult(collector);
  const fameMult = fameValueMult(opts.authorRank ?? null);
  const ageMult = marketAgeMult(collector.forgedAt);
  const passives = opts.sellMult ?? 1;

  const raw = base * levelMult * rarityMult * potMult * affMult * fameMult * ageMult * passives;
  // Redondeo a 3 cifras significativas: evita precios de 41.337 que rompen la
  // lectura rápida de un inventario
  const magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 2));
  return Math.round(raw / magnitude) * magnitude;
}

/**
 * Precio de venta. El jugador recibe el 42% del valor: el resto cubre el
 * inputs consumidos y deja margen al mercado.
 */
export function sellPrice(collector: CollectorItem, opts: ValuationOptions = {}): number {
  return Math.max(1, Math.floor(collectorValue(collector, opts) * 0.42));
}

/*
 * NO PONGA AQUÍ EL PRECIO DE UN CONSUMIBLE DE LA TIENDA.
 *
 * Aquí no hay precios de tienda, y antes sí los había: `CALIBRATION_STONE_COST`
 * (45 000) y `STABILITY_NANOPARTICLE_COST` (220 000). No los usaba nadie, pero
 * como uno coincidía con la tienda y el otro no, parecía un bug de economy:
 * "la nanopartícula cuesta 90 000 en un sitio y 220 000 en otro". No lo era. Los
 * dos eran constantes muertas y el precio que se cobra y se enseña sale de
 * `STORE_ITEMS` en el game loop, como el de cualquier otra carta. Una segunda
 * copia del precio es exactamente el tipo de cosa que R2 prohíbe: cuando las dos
 * se separan, el juego sigue funcionando bien y el aviso aparece en la
 * documentación, donde no lo lee nadie.
 */

/**
 * ¿La fusión mejora la DENSIDAD de valor del almacén?
 *
 * Se compara el valor POR RANURA, no el valor total, y esa es toda la diferencia.
 * La forja convierte tres recolectores en uno, así que el total baja a propósito en
 * los tiers bajos: medido sobre el juego real, fundir 3 de T1 (1.122 de valor en
 * tres ranuras) da 1 de T2 por 778. Pierde un 36% del total y gana un 108% por
 * ranura.
 *
 * La versión anterior de esta función afirmaba lo contrario —"el valor de salida
 * debe superar al input"—, y estaba rota de una forma que no se veía: era código
 * que no usaba nadie, con un comentario que prometía un test que no existía. Nadie
 * validó nunca esa regla. Comparar totales habría dado que la forja entera es una
 * trampa, cuando lo que compra con tres materiales es una ranura liberada y un
 * recolector mejor.
 *
 * La regla que de verdad sostiene el módulo es la de la ranura: fusionar tiene que
 * dejar más valor por celda ocupada. Si alguna vez la densidad no mejora, fusionar
 * sería indistinguible de vender tres y comprar uno, y el módulo perdería su razón
 * de ser.
 *
 * El margen es del 15%, holgado a propósito: la densidad real sube entre 2,5x y
 * 4,6x según el tier, así que un margen amplio sigue detectando un desequilibrio
 * de verdad sin volverse pesimista con el azar de la forja.
 */
export function fusionImprovesDensity(
  inputs: CollectorItem[],
  output: CollectorItem,
  opts: ValuationOptions = {}
): boolean {
  if (inputs.length === 0) return false;
  const densidadEntrada = inputs.reduce((a, w) => a + collectorValue(w, opts), 0) / inputs.length;
  return collectorValue(output, opts) > densidadEntrada * 1.15;
}

/**
 * Resumen legible para la tarjeta del item.
 *
 * **LA LÍNEA DE BASE NO ESTÁ, Y ESTA ES LA RAZÓN.** Se quitó porque la ficha ya enseña
 * el stat principal en grande, y el "Base T2: 480" de la valoración рядía con él: dos
 * números que se llamaban "base" y no eran el mismo. Peor: el de la valoración es el
 * **valor** y el del stat es el **daño**, y son dos grandezas distintas con el mismo
 * nombre. Un jugador que lee "Base 480" debajo de un "+13" no tiene forma de saber que
 * uno son nanitas de venta y el otro daño por clic.
 *
 * Y el daño por clic ya tiene su propio desglose, en el hovering del número grande, que
 * ese sí enseña de dónde sale la suma. Aquí solo queda **por qué vale lo que vale**: los
 * multiplicadores. Una lista de multiplicadores sin el número de partida es exactamente
 * lo que un desglose debe ser, y es lo que se ve.
 */
/**
 * LA MISMA LISTA, PERO CON LO QUE SUMA CADA COSA EN NANITAS.
 *
 * ## POR QUÉ LA CIFRA ES EN NANITAS Y NO EN DAÑO
 *
 * Porque esta lista **multiplica el valor de venta**, no el daño por clic, y esas dos
 * grandezas no tienen nada que ver. En concreto, **la rareza no toca el daño**: el daño de
 * un clic sale de `danioDeRango(tier, potencial)` y de ahí multiplican el nivel, los
 * compañeros, los logros, el árbol y los afijos. `RARITY_VALUE_MULT` solo aparece en este
 * fichero, en la fórmula del precio. Poner "×1,30 = 2 daño" al lado de la rareza sería una
 * cuenta que no existe: un recolector Raro hace exactamente el daño por clic que uno
 * Común del mismo tier y potencial, y lo único que cambia es cuánto se vende.
 *
 * Por eso cada fila enseña su incremento **en el precio**, y el detalle de lo que sí sube
 * el daño es otra sección, en el panel del jugador, que sale del desglose del clic.
 *
 * **Y EL INCREMENTO, NO EL TOTAL.** "×1,30" es el multiplicador y "+1,2 K" es lo que
 * aporta sobre lo que había antes: es la pregunta que se hace alguien que está pensando
 * si merece la pena el árbol de pasivas o subir el nivel. Un total acumulado al lado de un
 * multiplicador obliga a hacer la resta mental.
 *
 * Se aplica **en el mismo orden que la fórmula**, que es lo único que hace que los
 * incrementos signifiquen algo: son multiplicadores encadenados y el orden decide a quién
 * se le atribuye el efecto redondos. El de la rareza va antes que el de los afijos porque
 * en `collectorValue()` va antes.
 */
export function valuationConCifras(collector: CollectorItem, opts: ValuationOptions = {}): Array<{
  etiqueta: string; mult: number; suma: number;
}> {
  const base = valorBaseTier(Math.max(1, collector.tier)) ?? 200;
  // **LA BASE ES LA PRIMERA FILA Y NO LLEVA MULTIPLICADOR.** Se quitó en su día porque
  // decía "Base T2: 480" debajo del stat grande, que es el **daño**, y dos números
  // llamados "base" con dos grandezas distintas era exactamente el descuadre que había
  // que evitar. Ahora ya no hay mezcla: **esta lista entera es en nanitas** y cada fila
  // enseña su incremento, así que la base es el punto de partida de la cuenta y sin ella
  // los incrementos no se pueden comprobar de cabeza. Es el primero de la suma.
  const filas: Array<{ etiqueta: string; mult: number; suma: number }> = [
    { etiqueta: 'Base T' + Math.max(1, collector.tier), mult: 1, suma: Math.round(base) }
  ];
  let acum = base;

  const anota = (etiqueta: string, mult: number) => {
    if (Math.abs(mult - 1) < 0.0001) return;
    const antes = acum;
    acum = acum * mult;
    filas.push({ etiqueta, mult, suma: Math.round(acum - antes) });
  };

  if (collector.level) anota(`Nivel ${collector.level}`, levelValueMult(collector.level, collectorMaxLevel(collector.maxLevel)));
  anota(`Rareza ${collector.rarity}`, RARITY_VALUE_MULT[collector.rarity] ?? 1);
  if (collector.potential) anota(`Potencial ${collector.potential}★`, potentialValueMult(collector.potential));
  if (collector.affixes?.length) anota(`${collector.affixes.length} afijo(s)`, affixValueMult(collector));
  if (opts.authorRank != null) anota(`Autor top ${opts.authorRank}`, fameValueMult(opts.authorRank));
  if (collector.forgedAt) anota('Antigüedad', marketAgeMult(collector.forgedAt));
  if (opts.sellMult != null && Math.abs(opts.sellMult - 1) > 0.0001) anota('Bonificación de venta', opts.sellMult);

  return filas;
}

export function valuationBreakdown(collector: CollectorItem, opts: ValuationOptions = {}): string[] {
  const out: string[] = [];
  if (collector.level) out.push(`Nivel ${collector.level}: ×${levelValueMult(collector.level, collectorMaxLevel(collector.maxLevel)).toFixed(2)}`);
  out.push(`Rareza ${collector.rarity}: ×${(RARITY_VALUE_MULT[collector.rarity] ?? 1).toFixed(2)}`);
  if (collector.potential) out.push(`Potencial ${collector.potential}★: ×${potentialValueMult(collector.potential).toFixed(2)}`);
  if (collector.affixes?.length) out.push(`${collector.affixes.length} afijo(s): ×${affixValueMult(collector).toFixed(2)}`);
  if (opts.authorRank != null) out.push(`Autor top ${opts.authorRank}: ×${fameValueMult(opts.authorRank).toFixed(2)}`);
  return out;
}

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
  return String(Math.round(n));
}
