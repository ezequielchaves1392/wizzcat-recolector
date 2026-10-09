// ==========================================================================
// Árbol de Pasivas · Núcleos
//
// Por qué existe: sin un término exponencial en el ingreso, cualquier curva de
// precios topa. El árbol es ese término. Los nodos no dan "números grandes",
// dan multiplicadores que se aplican a otros multiplicadores, así que el
// crecimiento es compuesto en vez de aditivo.
//
// Estructura deliberada (F97):
//   - 4 RAMAS (Asalto / Manada / Fortuna / Forja), una por forma de jugar. La
//     pestaña enseña una rama y sus flechas no salen de ella: lo que se ve es
//     lo que hay que decidir.
//   - 5 TIERS por rama. El tier NO se abre por nodos sueltos sino por PUNTOS
//     gastados en la rama (niveles comprados): 0/1/3/6/9. La columna vertebral
//     de cada rama es barata y el fondo es caro.
//   - Cada rama tiene un nodo raíz sin requisitos, así que siempre hay algo
//     comprable desde el primer reinicio: nunca hay un minuto sin objetivo.
//   - Los `requires` son intra-rama a propósito: un requisito de otra pestaña
//     obligaría a comprar a ciegas lo que no se ve. Los cruces murieron con las
//     columnas; lo que obliga a decidir ahora es repartir los núcleos entre
//     ramas, porque completar las cuatro cuesta cuatro veces.
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
    icon: 'chip', category: 'manada', tier: 0, requires: [],
    baseCost: 1, costGrowth: G, maxLevel: 10,
    bonus: { passiveMult: 0.08 }, x: 0, y: 0
  },
  {
    id: 'core_edge', name: 'Filo Afilado', description: '+8% al daño de click por nivel.',
    lore: 'El filo se afila solo. Solo hay que acordarse de no cortarse con el.',
    icon: 'collector', category: 'asalto', tier: 0, requires: [],
    baseCost: 1, costGrowth: G, maxLevel: 10,
    bonus: { clickMult: 0.08 }, x: 0, y: 1
  },
  {
    id: 'scrapyard', name: 'Chatarrería', description: '+12% al precio de venta por nivel.',
    lore: 'Nada sobra si sabes donde mirar. El mismo monton de acero vale mas si buscas donde toca.',
    icon: 'trash', category: 'fortuna', tier: 0, requires: [],
    baseCost: 2, costGrowth: G, maxLevel: 5,
    bonus: { sellMult: 0.12 }, x: 0, y: 2
  },
  {
    id: 'refinery', name: 'Refinado', description: '-4% al coste de la tienda por nivel.',
    lore: 'La chatarra cruda no se vende: se depura. Lo que sale de aqui pesa menos y vale mas.',
    icon: 'crystal', category: 'fortuna', tier: 0, requires: [],
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
    icon: 'bolt', category: 'asalto', tier: 1, requires: ['core_edge'],
    baseCost: 3, costGrowth: 1.6, maxLevel: 10,
    bonus: { autoClick: 0.5 }, x: 1, y: 0
  },
  {
    id: 'passive_loop', name: 'Bucle de Extracción', description: '+10% al ingreso pasivo por nivel.',
    lore: 'El circuito se cierra solo: lo que extrae vuelve a entrar en vez de quedarse en el suelo.',
    icon: 'companion', category: 'manada', tier: 1, requires: ['core_sink'],
    baseCost: 3, costGrowth: G, maxLevel: 8,
    bonus: { passiveMult: 0.10 }, x: 1, y: 1
  },
  {
    id: 'forge_luck', name: 'Instinto de Forja', description: '+2% a la probabilidad de crafteo por nivel.',
    lore: 'Treinta anos de golpear metal frio hasta que el hierro decide colaborar.',
    icon: 'sparkle', category: 'forja', tier: 1, requires: [],
    baseCost: 4, costGrowth: 1.5, maxLevel: 5,
    bonus: { craftLuck: 0.02 }, x: 1, y: 2
  },
  {
    // EL IDENTIFICADOR SE LLAMA TODAVÍA `shard_sifter` Y NO SE CAMBIA, PORQUE ES UNA
    // LLAVE GUARDADA. `nodeLevels` guarda el nivel por identificador, así que renombrarlo
    // le quitaría la bonificación de golpe a quien ya lo tenga comprado. El nombre y lo
    // que hace sí cambian: las esquirlas ya no existen, y lo que este nodo multiplica es
    // el premio del fallo de forja, que son los cristales.
    id: 'shard_sifter', name: 'Alcornoque', description: '+25% de cristales por fallo de forja.',
    lore: 'Ceniza de un horno que fallo. Toda ceniza guarda algo: solo hay que cribarla.',
    icon: 'crystal', category: 'forja', tier: 0, requires: [],
    baseCost: 3, costGrowth: G, maxLevel: 4,
    bonus: { consolationBonus: 0.25 }, x: 1, y: 3
  },
  {
    id: 'storage_rack', name: 'Estantería Extra', description: '+3 ranuras de almacén por nivel.',
    lore: 'Otro estante. El problema nunca fue el espacio, era que no habia donde colgarlo.',
    icon: 'warehouse', category: 'fortuna', tier: 1, requires: ['scrapyard'],
    baseCost: 3, costGrowth: G, maxLevel: 6,
    bonus: { storageSlots: 3 }, x: 1, y: 4
  },

  // ---------------------------------------------------------------- TIER 2
  {
    id: 'auto_clicker2', name: 'Dedo de Acero', description: '+1.5 clics automáticos por segundo.',
    lore: 'Cuatro brazos mas y el mismo gesto. La cadencia ya no la marca una persona.',
    icon: 'bolt', category: 'asalto', tier: 2, requires: ['auto_clicker'],
    baseCost: 10, costGrowth: 1.7, maxLevel: 8,
    bonus: { autoClick: 1.5 }, x: 2, y: 0
  },
  {
    id: 'multiplier_amp', name: 'Amplificador de Asalto', description: '+6% al daño de click por nivel.',
    lore: 'Todo el ruido del taller metido en un solo golpe. No hace más cosas: hace una, más fuerte.',
    icon: 'sparkle', category: 'asalto', tier: 2, requires: ['core_edge'],
    baseCost: 12, costGrowth: 1.65, maxLevel: 8,
    bonus: { clickMult: 0.06 }, x: 2, y: 1
  },
  {
    id: 'crate_sight', name: 'Ojo de Caja', description: '+10% de probabilidad de que la caja dé un tier más por nivel.',
    lore: 'Ver la costura antes de que se abra. La caja siempre ha dado lo que tenia; ahora lo ves venir.',
    icon: 'crate', category: 'fortuna', tier: 2, requires: ['bulk_buy'],
    baseCost: 8, costGrowth: G, maxLevel: 5,
    bonus: { crateLuck: 0.10 }, x: 2, y: 2
  },
  {
    id: 'bulk_buy', name: 'Compra a Granel', description: '-5% adicional al coste de tienda.',
    lore: 'Comprar por docenas mejora el precio de la unidad sin tocar el de venta. El margen esta en el medio.',
    icon: 'store', category: 'fortuna', tier: 2, requires: ['refinery', 'scrapyard'],
    baseCost: 9, costGrowth: G, maxLevel: 5,
    bonus: { costReduction: 0.05 }, x: 2, y: 3
  },
  {
    id: 'squad_slots', name: 'Cuadrilla', description: '+1 ranura de compañero activa.',
    lore: 'Uno mas que dispara. No es un Companero nuevo: es sitio para el que ya tienes.',
    icon: 'companion', category: 'manada', tier: 2, requires: ['passive_loop'],
    baseCost: 25, costGrowth: 1, maxLevel: 4,
    bonus: { companionSlots: 1 }, x: 2, y: 4
  },

  // ---------------------------------------------------------------- TIER 3
  //
  // ---------------------------------------------------------------------------
  //  `offline_ops` YA NO ESTA, Y EL PORQUE ESTA AQUI
  // ---------------------------------------------------------------------------
  //
  // Era "Operaciones Offline": +2 min de clics automaticos al volver, con
  // `bonus: { offlineClicks: 120 }`. **Era una promesa de ingreso sin mirar**, que es
  // justo lo que R10 prohibe, y ademas nunca se consumia: el campo `offlineClicks`
  // existia en el estado y en `PassiveBonuses` y no lo leia el motor. Un nodo que
  // cobra nucleos por una bonificacion que no hace nada es una trampa.
  //
  // Se borra el nodo, no el campo: las partidas viejas que lo tuvieran comprado
  // conservan su nivel guardado (igual que con `blueprint`), y el campo
  // `offlineClicks` se queda en el tipo para no romper su carga. Lo que desaparece es
  // la forma de comprarlo.
  //
  // **`full_automation` NO SE QUEDA HUERFANO.** Lo tenia en `requires`, asi que se le
  // cambia la puerta por la que tenia `offline_ops` (`auto_clicker2`), que es su rama:
  // sin eso, el nodo seria inalcanzable para quien no lo tuviera ya comprado.
  // ---------------------------------------------------------------------------
  {
    id: 'quantum_amp', name: 'Amplificador de Manada', description: '+10% al ingreso pasivo por nivel.',
    lore: 'El gemelo tranquilo del de asalto: no toca tu mano, toca tu enjambre.',
    icon: 'crystal', category: 'manada', tier: 3, requires: ['passive_loop'],
    baseCost: 60, costGrowth: 1.75, maxLevel: 6,
    bonus: { passiveMult: 0.10 }, x: 3, y: 1
  },
  {
    id: 'afk_extend', name: 'Suspensión Prolongada', description: '+30 min de buff AFK por tarjeta por nivel.',
    lore: 'La tarjeta caducaba siempre a mitad del segundo que mas falta hacia. Ahora dura un poco mas.',
    icon: 'card', category: 'fortuna', tier: 3, requires: ['refinery'],
    baseCost: 20, costGrowth: G, maxLevel: 4,
    bonus: { afkHours: 0.5 }, x: 3, y: 2
  },
  {
    id: 'master_smith', name: 'Maestro Forjador', description: '+2,5% a la probabilidad de crafteo por nivel.',
    lore: 'El taller ya no es un homogeneity con dos cosas. Hay alguien que ha tardado.',
    icon: 'collector', category: 'forja', tier: 3, requires: ['forge_luck'],
    baseCost: 45, costGrowth: 1.7, maxLevel: 5,
    bonus: { craftLuck: 0.025 }, x: 3, y: 3
  },
  {
    id: 'core_yield', name: 'Rendimiento del Núcleo', description: '+20% de núcleos por reinicio.',
    lore: 'Reciclar no es tirar: es traducir. Con el mismo monton sale mas si sabes lo que haces.',
    icon: 'sparkle', category: 'fortuna', tier: 3, requires: ['bulk_buy'],
    baseCost: 40, costGrowth: 1.8, maxLevel: 5,
    bonus: { coreGain: 0.20 }, x: 3, y: 4
  },

  // ---------------------------------------------------------------- TIER 4
  {
    id: 'singularity', name: 'Singularidad', description: '+18% a todos los multiplicadores. No tiene tope.',
    lore: 'El ultimo nodo del arbol. Ponerlo es una decision: para por aqui.',
    icon: 'sparkle', category: 'asalto', tier: 4, requires: ['multiplier_amp'],
    baseCost: 220, costGrowth: 2.0, maxLevel: 5,
    bonus: { clickMult: 0.18, passiveMult: 0.18 }, x: 4, y: 1
  },
  {
    id: 'full_automation', name: 'Automatización Total', description: '+1 clic automático por segundo.',
    lore: 'Que la base juegue sola. Se ha arreglado todo lo que hacia falta para dejarlo.',
    icon: 'bolt', category: 'asalto', tier: 4, requires: ['auto_clicker2'],
    baseCost: 180, costGrowth: 1.9, maxLevel: 3,
    bonus: { autoClick: 1 }, x: 4, y: 0
  },
  {
    id: 'void_hoard', name: 'Almacén del Vacío', description: '+8 ranuras de almacén por nivel.',
    lore: 'Un almacen que no necesita ranuras porque no guarda: Fabrica el hueco.',
    icon: 'warehouse', category: 'fortuna', tier: 4, requires: ['storage_rack', 'core_yield'],
    baseCost: 90, costGrowth: 1.7, maxLevel: 5,
    bonus: { storageSlots: 8 }, x: 4, y: 2
  },
  {
    id: 'chaos_forge', name: 'Forja del Caos', description: '+3% a la probabilidad de crafteo por nivel, el peldaño más alto.',
    lore: 'La forja ya sin red de seguridad. Sale lo que sale.',
    icon: 'collector', category: 'forja', tier: 4, requires: ['master_smith'],
    baseCost: 260, costGrowth: 2.1, maxLevel: 4,
    bonus: { craftLuck: 0.03 }, x: 4, y: 3
  },
  // ---------------------------------------------------------------- TIER 4 · KEYSTONES (F97 Lote 2b)
  //
  // Uno por rama, al fondo de cada una: son la maestría de la rama, no un
  // número más. Cada uno trae UNA mecánica con sus cifras dentro del bonus —
  // la descripción las nombra y el banco las lee de ahí—, y todos son de un
  // solo nivel: un keystone no se sube, se consigue.
  {
    id: 'sobrecarga', name: 'Sobrecarga', description: 'Cada 50 clics, el siguiente critica ×3.',
    lore: 'Cincuenta golpes cargando el mismo condensador. El cincuenta y uno no golpea: detona.',
    icon: 'bolt', category: 'asalto', tier: 4, requires: ['singularity'],
    baseCost: 300, costGrowth: 1, maxLevel: 1,
    bonus: { sobrecargaCada: 50, sobrecargaMult: 3 }, x: 4, y: 4
  },
  {
    id: 'colmena', name: 'Mente Colmena', description: '+4% al ingreso por cada compañero activo además del primero.',
    lore: 'Ninguna abeja hace miel sola. Cada una que se suma endulza el trabajo de las demás.',
    icon: 'companion', category: 'manada', tier: 4, requires: ['quantum_amp'],
    baseCost: 280, costGrowth: 1, maxLevel: 1,
    bonus: { colmenaPorComp: 0.04 }, x: 4, y: 4
  },
  {
    id: 'jackpot', name: 'Jackpot', description: 'Un 1% de las cajas sube un tier su premio.',
    lore: 'A veces la caja se equivoca a tu favor. Nadie reclama.',
    icon: 'crate', category: 'fortuna', tier: 4, requires: ['void_hoard'],
    baseCost: 320, costGrowth: 1, maxLevel: 1,
    bonus: { jackpotChance: 0.01 }, x: 4, y: 4
  },
  {
    id: 'obra_maestra', name: 'Obra Maestra', description: 'Fundir dos potenciales máximos en otro firma una Obra Maestra.',
    lore: 'El yunque también firma. Cuando dos perfectos se vuelven uno, lo saben todos.',
    icon: 'collector', category: 'forja', tier: 4, requires: ['chaos_forge'],
    baseCost: 350, costGrowth: 1, maxLevel: 1,
    bonus: { obraMaestra: 1 }, x: 4, y: 4
  }
];

export const TREE_BY_ID: Record<string, TreeNode> = Object.fromEntries(
  TREE_NODES.map(n => [n.id, n])
);

export const TREE_TIERS = [0, 1, 2, 3, 4];

export const TREE_CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  asalto: { label: 'Asalto', color: 'text-red-400', icon: 'bolt' },
  manada: { label: 'Manada', color: 'text-emerald-400', icon: 'companion' },
  fortuna: { label: 'Fortuna', color: 'text-amber-400', icon: 'store' },
  forja: { label: 'Forja', color: 'text-rose-400', icon: 'collector' }
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
