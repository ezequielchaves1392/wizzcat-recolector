// ==========================================================================
// Prestige · Reciclaje y Núcleos
//
// Por qué existe: el ingreso es lineal con la inversión y el precio de los
// upgrades crece, así que sin un reinicio el jugador llega al techo en
// ~2 horas y se queda sin nada que comprar. El reinicio convierte "tiempo
// jugado" en una moneda permanente.
//
// Fórmula:  núcleos = floor(8 · (totalProducido / 1e6)^0.6 · (1 + coreGain))
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
import { TREE_BY_ID, nodeCost } from './tree';

export const EMPTY_BONUSES: PassiveBonuses = {
  clickMult: 0,
  passiveMult: 0,
  costReduction: 0,
  sellMult: 0,
  craftLuck: 0,
  consolationBonus: 0,
  autoClick: 0,
  afkHours: 0,
  offlineClicks: 0,
  crateLuck: 0,
  coreGain: 0,
  storageSlots: 0,
  companionSlots: 0
};

/** Umbral mínimo de producción para que un reinicio tenga sentido. */
export const PRESTIGE_MIN_NANITES = 1_000_000;

/** Núcleos que se ganarían con el estado actual. */
export function pendingCores(totalProduced: number, coreGainBonus = 0): number {
  if (totalProduced < PRESTIGE_MIN_NANITES) return 0;
  const raw = 8 * Math.pow(totalProduced / 1_000_000, 0.6);
  return Math.floor(raw * (1 + coreGainBonus));
}

/** Núcleo gained en el siguiente reinicio, descontando lo ya ganado. */
export function nextCores(state: {
  totalNanitesProduced: number;
  totalCores: number;
  coreGain: number;
}): number {
  const total = pendingCores(state.totalNanitesProduced, state.coreGain);
  return Math.max(0, total - state.totalCores);
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

/** Cuánto falta producir para el siguiente núcleo (0 si ya se puede reciclar). */
export function nanitesToNextCore(state: {
  totalNanitesProduced: number;
  totalCores: number;
  coreGain: number;
}): number {
  if (nextCores(state) > 0) return 0;
  const umbral = nanitesForCores(state.totalCores + 1, state.coreGain);
  return Math.max(0, umbral - state.totalNanitesProduced);
}

/**
 * Progreso 0..1 hacia el siguiente núcleo, para la barra de la UI.
 *
 * Se mide en esfuerzo (producido / umbral del siguiente), no en
 * `totalCores / total`: esa fracción BAJA al producir —con 8 de histórico da 1
 * con 1 M y 0,67 con 2 M—, así que la barra retrocedía cuanto más jugabas.
 * La producción se reinicia a 0 en cada Ascenso, así que medir desde 0 es lo
 * que el jugador siente: lo producido entre lo necesario.
 */
export function coreProgress(state: {
  totalNanitesProduced: number;
  totalCores: number;
  coreGain: number;
}): number {
  if (nextCores(state) > 0) return 1;
  const umbral = nanitesForCores(state.totalCores + 1, state.coreGain);
  if (umbral <= 0) return 0;
  return Math.min(1, Math.max(0, state.totalNanitesProduced / umbral));
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
    for (const [key, value] of Object.entries(node.bonus)) {
      const k = key as keyof PassiveBonuses;
      if (typeof value !== 'number') continue;
      // `afkHours` y `offlineClicks` son absolutos, el resto son fracciones:
      // sumar funciona igual en ambos casos.
      (out as unknown as Record<string, number>)[k] += value * level;
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
  const cost = nodeCost(node, level);
  if (cores < cost) return { ok: false, reason: `Faltan ${cost - cores} núcleos.` };
  return { ok: true };
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
