// ==========================================================================
// Árbol de Pasivas · Núcleos
//
// Por qué existe: sin un término exponencial en el ingreso, cualquier curva de
// precios topa. El árbol es ese término. Los nodos no dan "números grandes",
// dan multiplicadores que se aplican a otros multiplicadores, así que el
// crecimiento es compuesto en vez de aditivo.
//
// Estructura deliberada:
//   - 5 columnas (tiers). El columnado vertical es el tiempo de una partida.
//   - Cada rama tiene un nodo raíz sin requisitos, así que siempre hay algo
//     comprable desde el primer reinicio: nunca hay un minuto sin objetivo.
//   - Las ramas caras exigen dos ramas distintas abiertas (requisitos
//     cruzados). Es lo que impide que se haga "todo click" y obliga a decidir.
//
// Económicamente: el coste crece 1.55x por nivel, pero los niveles 2..5 de un
// nodo cuestan la mitad por unidad de bonificación que el nivel 1. Se premia
// seguir en una rama sin castigar la primera decisión.
// ==========================================================================

import type { TreeNode } from '../types/domain';

const G = 1.55;

export const TREE_NODES: TreeNode[] = [
  // ---------------------------------------------------------------- TIER 0
  {
    id: 'core_sink', name: 'Sumidero de Núcleos', description: '+8% al ingreso pasivo por nivel.',
    lore: 'Un pozo que no se llena: todo lo que cae por el, se queda. Cuanto mas hondo, mas fondo traga.',
    icon: 'chip', category: 'multiplicador', tier: 0, requires: [],
    baseCost: 1, costGrowth: G, maxLevel: 10,
    bonus: { passiveMult: 0.08 }, x: 0, y: 0
  },
  {
    id: 'core_edge', name: 'Filo Afilado', description: '+8% al daño de click por nivel.',
    lore: 'El filo se afila solo. Solo hay que acordarse de no cortarse con el.',
    icon: 'collector', category: 'multiplicador', tier: 0, requires: [],
    baseCost: 1, costGrowth: G, maxLevel: 10,
    bonus: { clickMult: 0.08 }, x: 0, y: 1
  },
  {
    id: 'scrapyard', name: 'Chatarrería', description: '+12% al precio de venta por nivel.',
    lore: 'Nada sobra si sabes donde mirar. El mismo monton de acero vale mas si buscas donde toca.',
    icon: 'trash', category: 'economia', tier: 0, requires: [],
    baseCost: 2, costGrowth: G, maxLevel: 5,
    bonus: { sellMult: 0.12 }, x: 0, y: 2
  },
  {
    id: 'refinery', name: 'Refinado', description: '-4% al coste de la tienda por nivel.',
    lore: 'La chatarra cruda no se vende: se depura. Lo que sale de aqui pesa menos y vale mas.',
    icon: 'crystal', category: 'economia', tier: 0, requires: [],
    baseCost: 3, costGrowth: G, maxLevel: 6,
    bonus: { costReduction: 0.04 }, x: 0, y: 3
  },
  //
  // ---------------------------------------------------------------------------
  //  `blueprint` YA NO ESTA, Y EL PORQUE ESTA AQUI PORQUE SE VA A PREGUNTAR
  // ---------------------------------------------------------------------------
  //
  // Era la raiz de la rama de crafteo: `forge_luck` y `shard_sifter` lo tenian en
  // `requires`. Antes de eso habia sido la PUERTA de la forja, y cuando la forja se
  // abrio desde el inicio se convirtio en un nodo de 4 nucleos al que no le quedaba
  // nada que abrir, asi que se le puso un +3% de `craftLuck` para que no fuera una
  // trampa.
  //
  // **SE HA BORRADO PORQUE SU TRABAJO YA NO EXISTE.** El nodo pagaba por una
  // restriccion que se borro, y una restriccion que ya no esta no puede seguir cobrando
  // por quitarla: el jugador ve una condicion que nunca se cumple.
  //
  // **LO IMPORTANTE: A LOS DOS HIJOS NO SE LES HA QUITADO LA PUERTA, SE LES HA QUITADO
  // LA CONDICION.** `requires: []` en vez de `requires: ['blueprint']`. Borrar el nodo
  // sin tocar eso deja los dos **inalcanzables** para el que no lo tenia comprado, con
  // sus bonificaciones desaparecidas de golpe --y `shard_sifter` todavia es la clave
  // guardada de un arbol de esquirlas que ya no existe, asi que ese identificador no
  // se toca--. Los dos siguen dando lo que dan y ahora se compran directamente.
  //
  // **Y QUIEN LO TUVIERA COMPRADO PIERDE EL 3%**, y eso es lo correcto: era el
  // precio de una puerta que ya no esta. Si alguna vez se quiere compensar, el sitio
  // es este parrafo y no una excepcion en el codigo.
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------- TIER 1
  {
    id: 'auto_clicker', name: 'Autómata de Clicks', description: '+0.5 clics automáticos por segundo.',
    lore: 'Un brazo mecanico que golpea aunque nadie este delante. No se cansa y no mira el reloj.',
    icon: 'bolt', category: 'automatizacion', tier: 1, requires: ['core_edge'],
    baseCost: 3, costGrowth: 1.6, maxLevel: 10,
    bonus: { autoClick: 0.5 }, x: 1, y: 0
  },
  {
    id: 'passive_loop', name: 'Bucle de Extracción', description: '+10% al ingreso pasivo por nivel.',
    lore: 'El circuito se cierra solo: lo que extrae vuelve a entrar en vez de quedarse en el suelo.',
    icon: 'companion', category: 'multiplicador', tier: 1, requires: ['core_sink'],
    baseCost: 3, costGrowth: G, maxLevel: 8,
    bonus: { passiveMult: 0.10 }, x: 1, y: 1
  },
  {
    id: 'forge_luck', name: 'Instinto de Forja', description: '+6% a la probabilidad de crafteo.',
    lore: 'Treinta anos de golpear metal frio hasta que el hierro decide colaborar.',
    icon: 'sparkle', category: 'crafteo', tier: 1, requires: [],
    baseCost: 4, costGrowth: 1.5, maxLevel: 5,
    bonus: { craftLuck: 0.06 }, x: 1, y: 2
  },
  {
    // EL IDENTIFICADOR SE LLAMA TODAVÍA `shard_sifter` Y NO SE CAMBIA, PORQUE ES UNA
    // LLAVE GUARDADA. `nodeLevels` guarda el nivel por identificador, así que renombrarlo
    // le quitaría la bonificación de golpe a quien ya lo tenga comprado. El nombre y lo
    // que hace sí cambian: las esquirlas ya no existen, y lo que este nodo multiplica es
    // el premio del fallo de forja, que son los cristales.
    id: 'shard_sifter', name: 'Alcornoque', description: '+25% de cristales por fallo de forja.',
    lore: 'Ceniza de un horno que fallo. Toda ceniza guarda algo: solo hay que cribarla.',
    icon: 'crystal', category: 'crafteo', tier: 1, requires: [],
    baseCost: 3, costGrowth: G, maxLevel: 4,
    bonus: { consolationBonus: 0.25 }, x: 1, y: 3
  },
  {
    id: 'storage_rack', name: 'Estantería Extra', description: '+3 ranuras de almacén por nivel.',
    lore: 'Otro estante. El problema nunca fue el espacio, era que no habia donde colgarlo.',
    icon: 'warehouse', category: 'economia', tier: 1, requires: ['scrapyard'],
    baseCost: 3, costGrowth: G, maxLevel: 6,
    bonus: { storageSlots: 3 }, x: 1, y: 4
  },

  // ---------------------------------------------------------------- TIER 2
  {
    id: 'auto_clicker2', name: 'Dedo de Acero', description: '+1.5 clics automáticos por segundo.',
    lore: 'Cuatro brazos mas y el mismo gesto. La cadencia ya no la marca una persona.',
    icon: 'bolt', category: 'automatizacion', tier: 2, requires: ['auto_clicker'],
    baseCost: 10, costGrowth: 1.7, maxLevel: 8,
    bonus: { autoClick: 1.5 }, x: 2, y: 0
  },
  {
    id: 'multiplier_amp', name: 'Amplificador Global', description: '+6% a TODOS los multiplicadores por nivel.',
    lore: 'Un amplificador que no amplifica una cosa: amplifica todo lo que ya tengas. Por eso se paga tan caro.',
    icon: 'sparkle', category: 'multiplicador', tier: 2, requires: ['passive_loop', 'core_edge'],
    baseCost: 12, costGrowth: 1.65, maxLevel: 8,
    bonus: { clickMult: 0.06, passiveMult: 0.06 }, x: 2, y: 1
  },
  {
    id: 'crate_sight', name: 'Ojo de Caja', description: '+10% de suerte en las cajas por nivel.',
    lore: 'Ver la costura antes de que se abra. La caja siempre ha dado lo que tenia; ahora lo ves venir.',
    icon: 'crate', category: 'economia', tier: 2, requires: ['shard_sifter'],
    baseCost: 8, costGrowth: G, maxLevel: 5,
    bonus: { crateLuck: 0.10 }, x: 2, y: 2
  },
  {
    id: 'bulk_buy', name: 'Compra a Granel', description: '-5% adicional al coste de tienda.',
    lore: 'Comprar por docenas mejora el precio de la unidad sin tocar el de venta. El margen esta en el medio.',
    icon: 'store', category: 'economia', tier: 2, requires: ['refinery', 'scrapyard'],
    baseCost: 9, costGrowth: G, maxLevel: 5,
    bonus: { costReduction: 0.05 }, x: 2, y: 3
  },
  {
    id: 'squad_slots', name: 'Cuadrilla', description: '+1 ranura de compañero activa.',
    lore: 'Uno mas que dispara. No es un Companero nuevo: es sitio para el que ya tienes.',
    icon: 'companion', category: 'exclusivo', tier: 2, requires: ['passive_loop'],
    baseCost: 25, costGrowth: 1, maxLevel: 4,
    bonus: { companionSlots: 1 }, x: 2, y: 4
  },

  // ---------------------------------------------------------------- TIER 3
  {
    id: 'offline_ops', name: 'Operaciones Offline', description: 'Los clics automáticos siguen funcionando 2 min al volver.',
    lore: 'La base no duerme, pero tampoco rinde. Estos dos minutos son los que aguanta hasta que vuelves.',
    icon: 'clock', category: 'automatizacion', tier: 3, requires: ['auto_clicker2'],
    baseCost: 25, costGrowth: 1.8, maxLevel: 5,
    bonus: { offlineClicks: 120 }, x: 3, y: 0
  },
  {
    id: 'quantum_amp', name: 'Amplificador Cuántico', description: '+10% a todos los multiplicadores.',
    lore: 'La misma idea del amplificador, pero medida en otro sitio: aqui no hay midiendo nada.',
    icon: 'crystal', category: 'multiplicador', tier: 3, requires: ['multiplier_amp', 'crate_sight'],
    baseCost: 60, costGrowth: 1.75, maxLevel: 6,
    bonus: { clickMult: 0.10, passiveMult: 0.10 }, x: 3, y: 1
  },
  {
    id: 'afk_extend', name: 'Suspensión Prolongada', description: '+30 min de buff AFK por tarjeta por nivel.',
    lore: 'La tarjeta caducaba siempre a mitad del segundo que mas falta hacia. Ahora dura un poco mas.',
    icon: 'card', category: 'automatizacion', tier: 3, requires: ['shard_sifter', 'refinery'],
    baseCost: 20, costGrowth: G, maxLevel: 4,
    bonus: { afkHours: 0.5 }, x: 3, y: 2
  },
  {
    id: 'master_smith', name: 'Maestro Forjador', description: '+12% a la probabilidad de crafteo.',
    lore: 'El taller ya no es un homogeneity con dos cosas. Hay alguien que ha tardado.',
    icon: 'collector', category: 'crafteo', tier: 3, requires: ['forge_luck', 'multiplier_amp'],
    baseCost: 45, costGrowth: 1.7, maxLevel: 5,
    bonus: { craftLuck: 0.12 }, x: 3, y: 3
  },
  {
    id: 'core_yield', name: 'Rendimiento del Núcleo', description: '+20% de núcleos por reinicio.',
    lore: 'Reciclar no es tirar: es traducir. Con el mismo monton sale mas si sabes lo que haces.',
    icon: 'sparkle', category: 'economia', tier: 3, requires: ['core_sink', 'bulk_buy'],
    baseCost: 40, costGrowth: 1.8, maxLevel: 5,
    bonus: { coreGain: 0.20 }, x: 3, y: 4
  },

  // ---------------------------------------------------------------- TIER 4
  {
    id: 'singularity', name: 'Singularidad', description: '+18% a todos los multiplicadores. No tiene tope.',
    lore: 'El ultimo nodo del arbol. Ponerlo es una decision: para por aqui.',
    icon: 'sparkle', category: 'multiplicador', tier: 4, requires: ['quantum_amp', 'master_smith'],
    baseCost: 220, costGrowth: 2.0, maxLevel: 5,
    bonus: { clickMult: 0.18, passiveMult: 0.18 }, x: 4, y: 1
  },
  {
    id: 'full_automation', name: 'Automatización Total', description: '+4 clics automáticos por segundo.',
    lore: 'Que la base juegue sola. Se ha arreglado todo lo que hacia falta para dejarlo.',
    icon: 'bolt', category: 'automatizacion', tier: 4, requires: ['offline_ops', 'multiplier_amp'],
    baseCost: 180, costGrowth: 1.9, maxLevel: 5,
    bonus: { autoClick: 4 }, x: 4, y: 0
  },
  {
    id: 'void_hoard', name: 'Almacén del Vacío', description: '+8 ranuras de almacén por nivel.',
    lore: 'Un almacen que no necesita ranuras porque no guarda: Fabrica el hueco.',
    icon: 'warehouse', category: 'economia', tier: 4, requires: ['storage_rack', 'core_yield'],
    baseCost: 90, costGrowth: 1.7, maxLevel: 5,
    bonus: { storageSlots: 8 }, x: 4, y: 2
  },
  {
    id: 'chaos_forge', name: 'Forja del Caos', description: '+20% a la probabilidad de crafteo, el peldaño más alto.',
    lore: 'La forja ya sin red de seguridad. Sale lo que sale.',
    icon: 'collector', category: 'crafteo', tier: 4, requires: ['master_smith', 'core_yield'],
    baseCost: 260, costGrowth: 2.1, maxLevel: 4,
    bonus: { craftLuck: 0.20 }, x: 4, y: 3
  }
];

export const TREE_BY_ID: Record<string, TreeNode> = Object.fromEntries(
  TREE_NODES.map(n => [n.id, n])
);

export const TREE_TIERS = [0, 1, 2, 3, 4];

export const TREE_CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  automatizacion: { label: 'Automatización', color: 'text-cyan-400', icon: 'bolt' },
  multiplicador: { label: 'Multiplicadores', color: 'text-purple-400', icon: 'sparkle' },
  economia: { label: 'Economía', color: 'text-amber-400', icon: 'store' },
  crafteo: { label: 'Crafteo', color: 'text-rose-400', icon: 'collector' },
  exclusivo: { label: 'Exclusivos', color: 'text-emerald-400', icon: 'crystal' }
};

/** Coste del siguiente nivel de un nodo. */
export function nodeCost(node: TreeNode, currentLevel: number): number {
  return Math.ceil(node.baseCost * Math.pow(node.costGrowth, currentLevel));
}

/** Coste de subir al siguiente nivel teniendo `level` niveles comprados. */
export function nextCost(node: TreeNode, level: number): number | null {
  if (level >= node.maxLevel) return null;
  return nodeCost(node, level);
}

/**
 * Cuántos núcleos se han GASTADO en el árbol, nivel a nivel.
 *
 * Es la contraparte exacta de la cartera: **todo núcleo que el jugador ha ganado
 * está en un sitio u otro**, así que `cartera + gastado` es el histórico
 * completo. Y es lo que permite reconstruir el `totalCores` de las partidas
 * viejas, que no lo guardaban.
 *
 * Por qué tiene que ser EXACTO y no una estimación: `nextCores` resta el
 * histórico de lo que daría la producción. Si el histórico se pasa, al jugador
 * se le.apagan las Ascensiones **para siempre** —no es que salga un número raro,
 * es que el Ascenso queda en 0 y no vuelve a salir. Si se queda corto, el
 * siguiente Ascenso lo corrige solo. Un error de un núcleo en este número decide
 * si un jugador veteran puede seguir jugando.
 *
 * El coste de cada nivel sale de `nodeCost`, la misma función que usa la tienda
 * de pasivas para cobrar, así que lo gastado y lo cobrado no pueden separarse.
 */
export function coresGastadosEnArbol(nodeLevels: Record<string, number> | undefined): number {
  if (!nodeLevels) return 0;
  let total = 0;
  for (const nodo of TREE_NODES) {
    const nivel = Math.floor(Number(nodeLevels[nodo.id]) || 0);
    if (nivel <= 0) continue;
    // Los niveles que existen de verdad, no los que diga el save: un guardado
    // manipulado con 99 niveles de un nodo que llega a 5 no puede costar 99
    // niveles, porque nunca se pudieron pagar.
    const comprados = Math.min(nivel, nodo.maxLevel);
    for (let i = 0; i < comprados; i++) total += nodeCost(nodo, i);
  }
  return total;
}
