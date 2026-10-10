// ==========================================================================
// Prestige · Reciclaje y Núcleos
//
// Por qué existe: el ingreso es lineal con la inversión y el precio de los
// upgrades crece, así que sin un reinicio el jugador llega al techo en
// ~2 horas y se queda sin nada que comprar. El reinicio convierte "tiempo
// jugado" en una moneda permanente.
//
// Fórmula en dos niveles (F70):
//   base     = floor(8 · (totalProducido / 1e6)^0.6): lo justificado, sin bonus.
//   ganancia = max(0, base − histórico) + floor(max(0, base − max(histórico, foto)) × tasa).
// El primer sumando es lo nuevo de verdad; el segundo es el nodo Rendimiento
// del Núcleo, que solo premia lo justificado DESPUÉS de comprarlo (la foto).
// Comprar no mueve la ganancia y reciclar la suma entera al histórico, que es
// de donde sale la escalada: cada vuelta tiene que superar a la anterior.
//
// El exponente 0.6 está calibrado contra el árbol, no elegido al azar:
//   1 M  →    8 núcleos  (lo justo: blueprints + 3 nodos)
//  10 M  →   32 núcleos
// 100 M  →  127 núcleos  (tier 3)
//   1 G  →  507 núcleos  (Singularidad, el nodo de 220)
//  10 G  → 2013 núcleos
//
// Con la raíz cuadrada (exponente 0.5) a 412 M se daban 162 núcleos de golpe:
// el jugador podía comprar media rama alta en su segundo reinicio y el árbol
// dejaba de ser una progresión para volverse un menú. Con 0.6 hay que producir
// bastante más para el mismo número, que es lo que se quiere: que el árbol se
// pague con tiempo jugado y no con un salto.
// ==========================================================================

import type { PassiveBonuses, TreeNode } from '../types/domain';
import { TREE_BY_ID, TREE_NODES, TREE_CATEGORY_META, nodeCost } from './tree';

export const EMPTY_BONUSES: PassiveBonuses = {
  clickMult: 0,
  clickPorForja: 0,
  passiveMult: 0,
  costReduction: 0,
  sellMult: 0,
  craftLuck: 0,
  forgePotential: 0,
  consolationBonus: 0,
  autoClick: 0,
  afkHours: 0,
  offlineClicks: 0,
  crateLuck: 0,
  coreGain: 0,
  storageSlots: 0,
  companionSlots: 0,
  sobrecargaCada: 0,
  sobrecargaMult: 0,
  colmenaPorComp: 0,
  jackpotChance: 0,
  obraMaestra: 0,
  licenciaT2: 0,
  licenciaT3: 0,
  ecoDoble: 0,
  compPasivo: 0,
  compClick: 0,
  compMulti: 0,
  compDescuento: 0,
  compPassivoBuffMult: 0,
  compClickBuffMult: 0,
  compGlobalBuffMult: 0,
  critChance: 0,
  nanoPerCrate: 0
};

/** Umbral mínimo de producción para que un reinicio tenga sentido. */
export const PRESTIGE_MIN_NANITES = 1_000_000;

/**
 * TOPES DEL MOTOR (F102). Ningún árbol, por muchos nodos que sume, puede pasar
 * de aquí: son la red que impide que un rebalanceo futuro reabra los exploits
 * sin que nadie lo note. Los lee el game loop y los ata `equilibrioCheck`.
 */
export const TOPE_CRITICO = 0.5;
export const TOPE_DESCUENTO = 0.5;
export const TOPE_COMP_DESCUENTO = 0.5;

/** Núcleos que se ganarían con el estado actual. */
export function pendingCores(totalProduced: number, coreGainBonus = 0): number {
  if (totalProduced < PRESTIGE_MIN_NANITES) return 0;
  const raw = 8 * Math.pow(totalProduced / 1_000_000, 0.6);
  return Math.floor(raw * (1 + coreGainBonus));
}

/**
 * Lo justificado por la producción, SIN bonus: la base sobre la que todo lo
 * demás se calcula. `pendingCores(p, 0)` con nombre de lo que es, para que
 * `nextCores` no tenga que repetir el `, 0` que lo hace puro.
 */
function baseJustificada(totalProduced: number): number {
  return pendingCores(totalProduced, 0);
}

/**
 * La foto con la que arranca quien no tiene foto guardada: lo justificado
 * ahora o el histórico, lo que sea mayor. Una sola fuente (R2): la usan la
 * carga de partidas viejas y `fotoEfectiva()`, y las dos niegan lo mismo —
 * el regalo retroactivo—.
 */
export function fotoInicial(totalCores: number, totalProduced: number): number {
  return Math.max(
    Math.max(0, Math.floor(Number(totalCores) || 0)),
    baseJustificada(Math.max(0, Number(totalProduced) || 0))
  );
}

/**
 * La foto efectiva del bonus: lo justificado cuando se compró el nodo.
 *
 * Si el save no la trae (partida anterior a F70) o trae basura, vale lo
 * justificado ahora mismo o el histórico, lo que sea mayor: con eso el bonus
 * arranca en cero y solo premia producción nueva. La alternativa —foto en el
 * histórico— regalaría de golpe el bonus sobre el marginal ya producido, que
 * es justo el exploit que esto viene a cerrar.
 */
function fotoEfectiva(state: {
  totalNanitesProduced: number;
  totalCores: number;
  baseAlComprar?: number;
}): number {
  const f = state.baseAlComprar === undefined || state.baseAlComprar === null
    ? NaN
    : Math.floor(Number(state.baseAlComprar));
  if (Number.isFinite(f) && f >= 0) return f;
  return fotoInicial(state.totalCores, state.totalNanitesProduced);
}

/**
 * Núcleos que daría reciclar AHORA.
 *
 * F70: el bonus (`coreGain`, nodo Rendimiento del Núcleo) ya NO multiplica
 * todo lo justificado. Son dos sumandos:
 *
 *   marginal    = max(0, base − histórico): lo nuevo de verdad en esta subida.
 *   extra       = floor(max(0, base − max(histórico, foto)) × tasa): el bonus,
 *                 solo sobre lo justificado con producción POSTERIOR a la
 *                 compra del nodo.
 *
 * Comprar el nodo no mueve el pendiente ni un núcleo: en ese instante la base
 * es la foto y el segundo sumando es cero. Y reciclar suma los dos al
 * histórico, que es de donde sale la escalada: cada vuelta tiene que superar
 * a la anterior porque el histórico solo sube.
 *
 * Sin bonus (tasa 0) es `max(0, base − histórico)`, la cuenta de siempre: la
 * foto no existe para quien no compró el nodo.
 */
export function nextCores(state: {
  totalNanitesProduced: number;
  totalCores: number;
  coreGain: number;
  baseAlComprar?: number;
}): number {
  const base = baseJustificada(state.totalNanitesProduced);
  const foto = fotoEfectiva(state);
  const marginal = Math.max(0, base - state.totalCores);
  const bonificable = Math.max(0, base - Math.max(state.totalCores, foto));
  return marginal + Math.floor(bonificable * state.coreGain);
}

/**
 * Producción total necesaria para justificar `nucleos` núcleos.
 *
 * Es la inversa de `pendingCores`: el mínimo `p` con `pendingCores(p) >= nucleos`.
 * Vive aquí y no en la vista (R2/R3): la página de Ascensión y el banco leen el
 * mismo número, así que lo que se enseña es lo que se cobra.
 */
export function nanitesForCores(nucleos: number, coreGainBonus = 0): number {
  if (nucleos <= 0) return 0;
  const mult = 1 + coreGainBonus;
  // Inversión directa de `8·(p/1e6)^0.6·mult >= nucleos`.
  // Se arranca en el umbral mínimo: por debajo de él `pendingCores` devuelve 0
  // siempre (los núcleos 1..7 no existen sueltos: el primero que se justifica
  // es el 8º, con 1 M), así que sin el tope el ajuste de abajo caminaría ~1 M
  // de uno en uno.
  let p = Math.max(
    PRESTIGE_MIN_NANITES,
    Math.ceil(1_000_000 * Math.pow(nucleos / (8 * mult), 1 / 0.6))
  );
  // Ajuste por el `floor` y el redondeo: como mucho unos pocos pasos.
  while (p > 0 && pendingCores(p - 1, coreGainBonus) >= nucleos) p--;
  while (pendingCores(p, coreGainBonus) < nucleos) p++;
  return p;
}

/**
 * La ganancia con una producción dada, con el resto fijo: la función que la
 * inversión recorre. Es monótona no decreciente en `p` —más producción nunca
 * da menos núcleos—, que es lo que hace que la bisección termine.
 */
function gananciaEn(
  p: number,
  totalCores: number,
  coreGain: number,
  baseAlComprar: number | undefined
): number {
  return nextCores({
    totalNanitesProduced: Math.max(0, Math.floor(Number(p) || 0)),
    totalCores,
    coreGain,
    baseAlComprar
  });
}

/**
 * El mínimo producido entero con ganancia >= objetivo.
 *
 * Bisección con sonda exponencial: la ganancia no topa (la base crece sin
 * techo con la producción), así que el `hi` se alcanza doblando como mucho
 * unas sesenta veces, y el tramo se parte a la mitad otras tantas. Cada paso
 * es un `pendingCores` —un `pow` y un `floor`—, barato hasta en el tick de
 * la vista.
 */
function producidoParaGanancia(
  objetivo: number,
  totalCores: number,
  coreGain: number,
  baseAlComprar: number | undefined
): number {
  const obj = Math.max(0, Math.floor(Number(objetivo) || 0));
  if (gananciaEn(0, totalCores, coreGain, baseAlComprar) >= obj) return 0;
  let hi = 1;
  while (gananciaEn(hi, totalCores, coreGain, baseAlComprar) < obj) hi *= 2;
  let lo = 0;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (gananciaEn(mid, totalCores, coreGain, baseAlComprar) >= obj) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * Cuánto falta producir para ganar UN núcleo más de los que ya se ganarían.
 *
 * F70 + B42: con bonus por tramos ya no hay fórmula cerrada que invertir
 * (`nanitesForCores` invertía el `pendingCores` multiplicativo), así que se
 * busca: el mínimo `p` que sube la ganancia en uno, menos lo producido. Por
 * construcción siempre es > 0 y producir justo eso suma uno —el banco lo ata
 * por bracketing, como B12 ataba la resta—.
 */
export function nanitesToNextCore(state: {
  totalNanitesProduced: number;
  totalCores: number;
  coreGain: number;
  baseAlComprar?: number;
}): number {
  const actual = gananciaEn(
    state.totalNanitesProduced, state.totalCores, state.coreGain, state.baseAlComprar);
  const hi = producidoParaGanancia(
    actual + 1, state.totalCores, state.coreGain, state.baseAlComprar);
  return Math.max(0, hi - Math.max(0, Math.floor(Number(state.totalNanitesProduced) || 0)));
}

/**
 * Progreso 0..1 dentro del peldaño actual, para la barra de la UI.
 *
 * F70: el peldaño ya no es "de `nanitesForCores(T)` a `nanitesForCores(T+1)`"
 * en total justificado, sino de ganancia: del primer producido que da lo
 * actual al primero que da uno más. Cada peldaño tiene su propia escala, así
 * que comparar dos peldaños no dice nada; lo que vale en cada uno es subir
 * al producir y no clavarse al tope (B42).
 *
 * Se mide en esfuerzo (producido entre umbrales), no en
 * `totalCores / total`: esa fracción BAJA al producir —con 8 de histórico da 1
 * con 1 M y 0,67 con 2 M—, así que la barra retrocedía cuanto más jugabas.
 */
export function coreProgress(state: {
  totalNanitesProduced: number;
  totalCores: number;
  coreGain: number;
  baseAlComprar?: number;
}): number {
  const p = Math.max(0, Math.floor(Number(state.totalNanitesProduced) || 0));
  const actual = gananciaEn(p, state.totalCores, state.coreGain, state.baseAlComprar);
  const lo = actual <= 0
    ? 0
    : producidoParaGanancia(actual, state.totalCores, state.coreGain, state.baseAlComprar);
  const hi = producidoParaGanancia(actual + 1, state.totalCores, state.coreGain, state.baseAlComprar);
  if (hi <= lo) return 0;
  return Math.min(1, Math.max(0, (p - lo) / (hi - lo)));
}

/**
 * Agrega las bonificaciones de todos los nodos comprados.
 * Se recalcula desde cero en cada cambio: 30 nodos son baratos de sumar y
 * evita el bug clásico de "el bonificador no cuadra con lo comprado" cuando
 * un nodo se satura o se resetea.
 */
export function aggregateBonuses(nodeLevels: Record<string, number>): PassiveBonuses {
  const out: PassiveBonuses = { ...EMPTY_BONUSES };
  for (const [id, level] of Object.entries(nodeLevels)) {
    if (!level) continue;
    const node: TreeNode | undefined = TREE_BY_ID[id];
    if (!node) continue;
    // **EL NIVEL EFECTIVO TOPA EN EL MÁXIMO (F97).** Si un techo baja —`full_automation`
    // pasó de 5 a 3—, quien tenga niveles de más los conserva guardados pero no
    // cobran: es el mismo trato que `offline_ops` y `blueprint`, y evita que una
    // partida vieja rinda por encima del techo que ve en la hoja. Como
    // `coresGastadosEnArbol()`, que ya recortaba por el mismo motivo.
    const efectivo = Math.min(level, node.maxLevel);
    for (const [key, value] of Object.entries(node.bonus)) {
      const k = key as keyof PassiveBonuses;
      if (typeof value !== 'number') continue;
      // `afkHours` y `offlineClicks` son absolutos, el resto son fracciones:
      // sumar funciona igual en ambos casos.
      (out as unknown as Record<string, number>)[k] += value * efectivo;
    }
  }
  return out;
}

/** Un nodo se puede comprar si están comprados todos sus requisitos. */
export function canBuyNode(
  nodeId: string,
  nodeLevels: Record<string, number>,
  cores: number
): { ok: boolean; reason?: string } {
  const node = TREE_BY_ID[nodeId];
  if (!node) return { ok: false, reason: 'Nodo desconocido.' };
  const level = nodeLevels[nodeId] || 0;
  if (level >= node.maxLevel) return { ok: false, reason: 'Nivel máximo alcanzado.' };
  const missing = node.requires.filter(r => !(nodeLevels[r] > 0));
  if (missing.length) {
    const names = missing.map(id => TREE_BY_ID[id]?.name ?? id).join(', ');
    return { ok: false, reason: `Requiere: ${names}` };
  }
  // **LA PUERTA POR PUNTOS (F97).** El tier no se abre por nodos sueltos sino
  // por niveles comprados EN LA RAMA: 0/1/3/6/9 para T0..T4. Es la mitad WoW
  // del rediseño —profundizar en una rama abre su fondo— y va DESPUÉS de los
  // requisitos para que el motivo siga nombrando lo que falta primero: un
  // requisito sin cumplir se dice con su nombre, no con puntos.
  const puntos = puntosEnRama(nodeLevels, node.category);
  const umbral = UMBRAL_PUNTOS_RAMA[node.tier] ?? 0;
  if (puntos < umbral) {
    const nombre = TREE_CATEGORY_META[node.category]?.label ?? node.category;
    return { ok: false, reason: `Requiere ${umbral} puntos en ${nombre} (llevas ${puntos}).` };
  }
  const cost = nodeCost(node, level);
  if (cores < cost) return { ok: false, reason: `Faltan ${cost - cores} núcleos.` };
  return { ok: true };
}

/**
 * PUNTOS QUE HAY QUE TENER EN UNA RAMA PARA ABRIR CADA TIER (F97).
 *
 * Son NIVELES comprados, no núcleos: lo que compromete es quedarse, no pagar.
 * La escala sale del tamaño de las ramas de hoy (~5 nodos): T1 se abre con un
 * nivel de la raíz —la entrada siempre está abierta—, T4 pide 9, que en Forja
 * (16 niveles en total) es más de la mitad de la rama. Si las ramas crecen
 * (Lote 3: 15 nodos), estos mínimos siguen valiendo porque son suelos.
 */
export const UMBRAL_PUNTOS_RAMA: Record<number, number> = { 0: 0, 1: 1, 2: 3, 3: 6, 4: 9, 5: 12, 6: 15 };

/**
 * Niveles comprados en una rama, topados por máximo como el agregador.
 *
 * Un nivel por encima del techo cuenta como el techo: si no, una partida vieja
 * con un máximo recortado abriría filas que la hoja dice cerradas.
 */
export function puntosEnRama(nodeLevels: Record<string, number> | undefined, categoria: string): number {
  if (!nodeLevels) return 0;
  let total = 0;
  for (const nodo of TREE_NODES) {
    if (nodo.category !== categoria) continue;
    const nivel = Math.floor(Number((nodeLevels as Record<string, number>)[nodo.id]) || 0);
    if (nivel <= 0) continue;
    total += Math.min(nivel, nodo.maxLevel);
  }
  return total;
}

/** Nodos cuyo requisito acaba de ser satisfecho, para sugerir el siguiente paso. */
export function availableNodes(nodeLevels: Record<string, number>): string[] {
  return Object.keys(TREE_BY_ID).filter(id => {
    const node = TREE_BY_ID[id];
    const level = nodeLevels[id] || 0;
    if (level >= node.maxLevel) return false;
    return node.requires.every(r => (nodeLevels[r] || 0) > 0);
  });
}

/** Porcentaje de progreso total del árbol, para la barra de la página. */
export function treeCompletion(nodeLevels: Record<string, number>): number {
  const ids = Object.keys(TREE_BY_ID);
  const total = ids.reduce((a, id) => a + TREE_BY_ID[id].maxLevel, 0);
  const done = ids.reduce((a, id) => a + Math.min(nodeLevels[id] || 0, TREE_BY_ID[id].maxLevel), 0);
  return total > 0 ? done / total : 0;
}
