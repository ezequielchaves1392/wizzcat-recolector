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
  shardBonus: 0,
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

/** Progreso 0..1 hacia el siguiente núcleo, para la barra de la UI. */
export function coreProgress(state: {
  totalNanitesProduced: number;
  totalCores: number;
  coreGain: number;
}): number {
  const total = pendingCores(state.totalNanitesProduced, state.coreGain);
  if (total <= 0) return 0;
  return Math.min(1, state.totalCores / total);
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
