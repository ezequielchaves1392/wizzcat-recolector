// Logros del juego.
//
// Antes este archivo no lo importaba nadie y sus condiciones miraban
// `state.factories`, un campo que ya no existe: los logros no se evaluaban nunca.
// Las recompensas son pasivas (multiplicador de click y de pasivo) y se aplican
// al recalcular, así que no necesitan escribirse en el estado del jugador.

import { ACHIEVEMENT_REWARDS, type AchievementId } from './data/achievements';
import { TREE_BY_ID } from './data/tree';
import { techoDeExpansor, EXPANSOR_TIERS } from './data/store';
import { POTENTIAL_MAX } from './data/crafting';
// **EL TECHO DE LA ESCALERA Y EL TOPE DE AFIJOS, NO LOS NÚMEROS ESCRITOS.** El logro del
// almacén pide 115 porque eso dice `techoDeExpansor(10)`, y el de los perfectos pide 10
// ítems ★5 porque ★5 es `POTENTIAL_MAX`. Los dos números que se pueden mover están en
// `data/`: escribirlos en el logro y en la regla esotería de dos sitios, y el día que
// se quede viejo es el del logro, que es el que no se ve.

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
  /** Recompensa legible, para mostrarla en la tarjeta */
  rewardText: string;
  /** Recompensa pasiva aplicada por el game loop */
  reward: { clickBonus: number; passiveBonus: number };
  /** Devuelve el progreso 0..1 y si ya se completó */
  progress: (state: any) => { current: number; target: number };
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_click',
    title: 'Primer Enlace',
    description: 'Extrae 100 Nanitas en total',
    icon: 'bolt',
    rewardText: '+2% poder de click',
    reward: { clickBonus: 0.02, passiveBonus: 0 },
    progress: (s) => ({ current: Math.min(s.totalNanitesProduced ?? 0, 100), target: 100 })
  },
  {
    id: 'collector_10',
    title: 'Táctico',
    description: 'Sube un recolector al nivel 10',
    icon: 'medal',
    rewardText: '+5% poder de click',
    reward: { clickBonus: 0.05, passiveBonus: 0 },
    progress: (s) => ({
      current: Math.max(0, ...(s.warehouse ?? []).filter((w: any) => w.type === 'collector').map((w: any) => w.level || 0)),
      target: 10
    })
  },
  {
    id: 'swarm',
    title: 'Enjambre Autómata',
    description: 'Equipa 3 compañeros a la vez',
    icon: 'companion',
    rewardText: '+8% ingreso pasivo',
    reward: { clickBonus: 0, passiveBonus: 0.08 },
    progress: (s) => ({ current: Math.min(s.activeCompanions?.length ?? 0, 3), target: 3 })
  },
  {
    // F33 · EL PRIMER ITEM PERFECTO.
    //
    // **ESTE LOGRO ERA "CONSIGUE UN RECOLECTOR SOBRECARGADO" Y SE QUEDA CON EL
    // MISMO ID Y LA MISMA RECOMPENSA, PERO OTRA CONDICIÓN.** El id no cambia por
    // dos razones: una partida vieja que ya lo tiene desbloqueado no pierde la
    // bonificación de +10% de click que ya se le está pagando, y el banco de
    // logros compara ids contra una lista que sigue teniendo el mismo tamaño.
    //
    // Y la condición es la que le corresponde ahora: un item con potencial 5, que
    // es la perfección del 100%. Es el mismo logro con otro nombre —"salir de
    // especificación" es tener algo que no debería existir todavía—, y sigue
    // siendo alcanzable, que es lo que importa: si solo se hubiera borrado,
    // este logro se quedaba puesto para siempre en el perfil de quien ya lo tenía
    // y se volvía imposible para el resto.
    id: 'overclocked',
    title: 'Fuera de Especificación',
    description: 'Consigue un item con 5 estrellas de potencial',
    icon: 'flame',
    rewardText: '+10% poder de click',
    reward: { clickBonus: 0.10, passiveBonus: 0 },
    progress: (s) => ({
      current: (s.warehouse ?? []).some((w: any) => (w.potential ?? 0) >= 5) ? 1 : 0,
      target: 1
    })
  },
  {
    id: 'crate_opener',
    title: 'Descifrador',
    description: 'Abre 25 cajas',
    icon: 'crate',
    rewardText: '+12% ingreso pasivo',
    reward: { clickBonus: 0, passiveBonus: 0.12 },
    progress: (s) => ({ current: Math.min(s.cratesOpened ?? 0, 25), target: 25 })
  },
  {
    id: 'jackpot',
    title: 'Fortuna Divina',
    description: 'Consigue un compañero Mítico o Divino de caja',
    icon: 'crown',
    rewardText: '+15% poder de click',
    reward: { clickBonus: 0.15, passiveBonus: 0 },
    progress: (s) => ({
      current: (s.companions ?? []).some((c: any) => c.rarity === 'Mítico' || c.rarity === 'Divino') ? 1 : 0,
      target: 1
    })
  },
  {
    id: 'rich',
    title: 'M magnate',
    description: 'Acumula 250.000 Nanitas',
    icon: 'graph',
    rewardText: '+15% ingreso pasivo',
    reward: { clickBonus: 0, passiveBonus: 0.15 },
    progress: (s) => ({ current: Math.min(Math.floor(s.nanites ?? 0), 250000), target: 250000 })
  },
  {
    id: 'full_squad',
    title: 'Escuadrón Completo',
    description: 'Equipa 5 compañeros a la vez',
    icon: 'chip',
    rewardText: '+20% ingreso pasivo',
    reward: { clickBonus: 0, passiveBonus: 0.20 },
    progress: (s) => ({ current: Math.min(s.activeCompanions?.length ?? 0, 5), target: 5 })
  },
  {
    id: 'deep_pockets',
    title: 'Almacén Masivo',
    description: 'Amplía el almacén a 20 slots',
    icon: 'warehouse',
    rewardText: '+25% poder de click',
    reward: { clickBonus: 0.25, passiveBonus: 0 },
    // B4 · LA CAPACIDAD QUE MIDE TIENE QUE SER LA QUE EL JUGADOR VE.
    //
    // Antes medía `s.warehouseCapacity`, que es solo la base del save. La que ve el
    // jugador es la base **más** `bonus.storageSlots` del árbol de pasivas (`+3` y
    // `+8`), y con los dos nodos el almacén tiene 26 slots mientras el logro
    // enseñaba 15/20 para siempre. Es el mismo sitio donde el árbol de pasivas
    // hace `effectiveWarehouseCapacity()`; esta cifra sale de la misma regla (R3).
    //
    // Y con esto el logro se cumple **por la vía del árbol**, que es la que el
    // jugador ve funcionar. Antes solo se cumplía comprando una ampliación de
    // tienda, y solo si ninguna de las dos vías tenía ya la base a 20 — o sea que
    // había una partida donde un árbol comprado al principio dejaba el logro
    // bloqueado para siempre.
    progress: (s) => ({
      current: Math.min((s.warehouseCapacity ?? 0) + (s.bonus?.storageSlots ?? 0), 20),
      target: 20
    })
  },
  {
    id: 'tycoon',
    title: 'Barón de Nanobots',
    description: 'Alcanza 5.000 Nanitas por segundo',
    icon: 'sparkle',
    rewardText: '+30% poder de click y +30% pasivo',
    reward: { clickBonus: 0.30, passiveBonus: 0.30 },
    progress: (s) => ({ current: Math.min(Math.floor(s.passiveIncome ?? 0), 5000), target: 5000 })
  },
  {
    id: 'first_forge',
    title: 'Primera Chispa',
    description: 'Forja tu primer recolector',
    icon: 'collector',
    rewardText: '+5% poder de click · Título "Aprendiz de Forja"',
    reward: { clickBonus: 0.05, passiveBonus: 0 },
    progress: (s) => ({ current: Math.min(s.forgedCount ?? 0, 1), target: 1 })
  },
  // ------------------------------------------------------------------
  //  F97 · LOS CINCO DEL ÁRBOL NUEVO
  //
  //  Uno por mecánica nueva, y cada condición mide lo que el jugador ve:
  //  el keystone comprado en su pestaña, los nodos con nivel en la rama, la
  //  firma en la ficha del almacén, y los contadores de salto y eco que la
  //  tarjeta de la caja anuncia. Nada de campos que no se puedan perseguir.
  // ------------------------------------------------------------------
  {
    id: 'primera_maestria',
    title: 'Primera Maestría',
    description: 'Compra tu primer keystone del árbol',
    icon: 'medal',
    rewardText: '+3% ingreso pasivo · Banner "Maestría"',
    reward: { clickBonus: 0, passiveBonus: 0.03 },
    // Los cuatro keystones, por id: el que esté comprado vale.
    progress: (s) => ({
      current: ['sobrecarga', 'colmena', 'jackpot', 'obra_maestra']
        .some(k => ((s.nodeLevels ?? {})[k] ?? 0) > 0) ? 1 : 0,
      target: 1
    })
  },
  {
    id: 'rama_completa',
    title: 'Rama Completa',
    description: 'Ten los 15 nodos de una rama comprados',
    icon: 'sparkle',
    rewardText: '+5% poder de click · Banner "Cima"',
    reward: { clickBonus: 0.05, passiveBonus: 0 },
    // Nodos con al menos un nivel, por rama; vale la que más tenga. La
    // categoría sale de la tabla, no de un prefijo del id: un renombre no
    // puede dejar una rama incompletable.
    progress: (s) => {
      const porRama: Record<string, number> = {};
      for (const [id, nivel] of Object.entries(s.nodeLevels ?? {})) {
        if ((nivel as number) > 0) {
          const rama = TREE_BY_ID[id]?.category ?? 'otra';
          porRama[rama] = (porRama[rama] ?? 0) + 1;
        }
      }
      return { current: Math.min(Math.max(0, ...Object.values(porRama)), 15), target: 15 };
    }
  },
  {
    id: 'obra_firmada',
    title: 'Obra Firmada',
    description: 'Forja una Obra Maestra',
    icon: 'collector',
    rewardText: '+5% poder de click · Banner "Firma"',
    reward: { clickBonus: 0.05, passiveBonus: 0 },
    // La firma vive en la ficha del almacén, como el potencial: si está, se
    // forjó. Una vez desbloqueado el logro no se pierde al venderla.
    progress: (s) => ({
      current: (s.warehouse ?? []).some((w: any) => w?.obraMaestra === true) ? 1 : 0,
      target: 1
    })
  },
  {
    id: 'suerte_doble',
    title: 'Suerte Doble',
    description: 'Sube un premio de caja con el Jackpot',
    icon: 'crate',
    rewardText: '+3% ingreso pasivo · Banner "Doble"',
    reward: { clickBonus: 0, passiveBonus: 0.03 },
    progress: (s) => ({ current: Math.min(s.jackpots ?? 0, 1), target: 1 })
  },
  {
    id: 'doble_eco',
    title: 'Doble Eco',
    description: 'Saca un botín doble con el Eco',
    icon: 'gem',
    rewardText: '+3% ingreso pasivo · Banner "Eco"',
    reward: { clickBonus: 0, passiveBonus: 0.03 },
    progress: (s) => ({ current: Math.min(s.ecos ?? 0, 1), target: 1 })
  },
  {
    id: 'smith_25',
    title: 'Maestro de Forja',
    description: 'Forja 25 recolectores con éxito',
    icon: 'collector',
    rewardText: '+10% click y +10% pasivo · Marco "Brasa"',
    reward: { clickBonus: 0.10, passiveBonus: 0.10 },
    progress: (s) => ({ current: Math.min(s.forgedCount ?? 0, 25), target: 25 })
  },
  {
    id: 'ascendant',
    title: 'Ascendido',
    description: 'Recicla tu progreso 5 veces',
    icon: 'sparkle',
    rewardText: '+20% click y +20% pasivo · Banner "Carmesí"',
    reward: { clickBonus: 0.20, passiveBonus: 0.20 },
    progress: (s) => ({ current: Math.min(s.resets ?? 0, 5), target: 5 })
  },
// =========================================================================
  //  2 · LOS DIFÍCILES
  //
  //  Los de arriba son **cortos**: uno por sistema, y un jugador activo los saca en una
  //  tarde. Estos son otra cosa —**lotes**—: hay que llegar muy lejos o tener muchos a la
  //  vez, y varios no se pueden hacer por vías distintas porque el juego solo tiene una.
  //
  //  **SUS PREMIOS SON COSMÉTICOS Y NADA MÁS.** El `reward` de los doce es `0, 0` y el
  //  premio de verdad está en el `rewardText`, como el marco de Brasa y el banner de
  //  Carmesí. Es una decisión que se puede leer en una tabla
  //  (`sumaDeBonificacion()`) y no en un comentario: añadir un +5 % a un logro difícil
  //  es tocar el equilibrio, y eso es tuyo.
  //
  //  **Y CADA CONDICIÓN MIDE LO QUE EL JUGADOR VE, NO UN CONTADOR INTERNO.** La
  //  capacidad es la base **más** los slots del árbol, que es lo que ve en la esquina;
  //  el almacén se cuenta con los afijos incluidos, que es lo que ocupa; y el árbol se
  //  cuenta por nodos comprados, no por ramas abiertas. Una condición que mide un campo
  //  que el jugador no puede ver es un logro que no se puede Perseguir.
  // =========================================================================
  {
    id: 'vault_115',
    title: 'Almacén Definitivo',
    description: 'Amplía el almacén a 240 ranuras',
    icon: 'warehouse',
    rewardText: 'Marco "Ónix"',
    reward: { clickBonus: 0, passiveBonus: 0 },
    // **240 ES LA CIMA DE LA ESCALERA**, `techoDeExpansor(4)`, y sale de ahí en vez de
    // estar escrito a mano: si la escalera sube, el logro sube con ella y no se queda
    // pidiendo algo que ya no existe. El `id` conserva el 115 para no mover los
    // guardados que ya lo tienen: lo que se enseña es la descripción, no la clave.
    progress: (s) => ({
      current: Math.min(
        (s.warehouseCapacity ?? 0) + (s.bonus?.storageSlots ?? 0),
        techoDeExpansor(EXPANSOR_TIERS.length)
      ),
      target: techoDeExpansor(EXPANSOR_TIERS.length)
    })
  },
  {
    id: 'perfect_10',
    title: 'Diez Perfectos',
    description: 'Ten 10 items con 5 estrellas a la vez',
    icon: 'flame',
    rewardText: 'Banner "Espectro"',
    reward: { clickBonus: 0, passiveBonus: 0 },
    // ★5 es el 100 % del item, y **tenerlos a la vez** es lo que lo hace difícil: se
    // hace difícil: se pueden vender entre medias. El almacén es el único sitio donde
    // "a la vez" existe.
    progress: (s) => ({
      current: (s.warehouse ?? []).filter((w: any) => (w.potential ?? 0) >= POTENTIAL_MAX).length,
      target: 10
    })
  },
  {
    id: 'relicario',
    title: 'Relicario',
    description: 'Consigue un recolector Divino',
    icon: 'crown',
    rewardText: 'Título "Relicario"',
    reward: { clickBonus: 0, passiveBonus: 0 },
    // **Divino, no Mítico como el jackpot.** El `jackpot` viejo mira compañeros Míticos o
    // Divinos y por eso este no lo repite: este mira un **recolector** Divino, que sale
    // de fundir dos ★5 y es el objeto más completo del juego.
    progress: (s) => ({
      current: (s.warehouse ?? []).some((w: any) => w.type === 'collector' && w.rarity === 'Divino') ? 1 : 0,
      target: 1
    })
  },
  {
    id: 'squad_12',
    title: 'Doce en Pie',
    description: 'Equipa 12 compañeros a la vez',
    icon: 'companion',
    rewardText: 'Marco "Legión"',
    reward: { clickBonus: 0, passiveBonus: 0 },
    // Hay 17 ranuras de compañero en el juego (1 de partida + 12 de tienda + 4 del árbol),
    // así que 12 activas es casi todo el tablero lleno.
    progress: (s) => ({ current: Math.min(s.activeCompanions?.length ?? 0, 12), target: 12 })
  },
  {
    id: 'cores_10k',
    title: 'Diez Mil Núcleos',
    description: 'Gana 10.000 núcleos en total entre todas tus ascensiones',
    icon: 'core',
    rewardText: 'Banner "Mosaico"',
    reward: { clickBonus: 0, passiveBonus: 0 },
    // **`totalCores` y no `cores`**, que es el saldo y baja al comprar un nodo: medido con
    // el saldo, el logro se desactiva solo en cuanto inviertes.
    progress: (s) => ({ current: Math.min(s.totalCores ?? 0, 10000), target: 10000 })
  },
  {
    id: 'eternidad',
    title: 'Eternidad',
    description: 'Recicla tu progreso 20 veces',
    icon: 'recycle',
    rewardText: 'Título "Eternidad"',
    reward: { clickBonus: 0, passiveBonus: 0 },
    progress: (s) => ({ current: Math.min(s.resets ?? 0, 20), target: 20 })
  },
  {
    id: 'mil_millones',
    title: 'Mil Millones',
    description: 'Produce 1.000.000.000 de nanitas en total',
    icon: 'graph',
    rewardText: 'Título "Mil Millones"',
    reward: { clickBonus: 0, passiveBonus: 0 },
    // **`totalNanitesProduced` y no `nanites`**: el saldo baja al comprar y al ascender, y
    // un logro que se desactiva al gastar es un logro que no es un logro.
    progress: (s) => ({ current: Math.min(s.totalNanitesProduced ?? 0, 1_000_000_000), target: 1_000_000_000 })
  },
  {
    id: 'incesante',
    title: 'Incesante',
    description: 'Alcanza 100.000 nanitas por segundo',
    icon: 'bolt',
    rewardText: 'Banner "Aurora Alta"',
    reward: { clickBonus: 0, passiveBonus: 0 },
    progress: (s) => ({ current: Math.min(Math.floor(s.passiveIncome ?? 0), 100000), target: 100000 })
  },
  {
    id: 'cantera',
    title: 'Cantera',
    description: 'Abre 500 cajas',
    icon: 'crate',
    rewardText: 'Título "Cantera"',
    reward: { clickBonus: 0, passiveBonus: 0 },
    // **Cincocientas, contando las que no sale nada**, que es el 99 % de la caja T1. El
    // logro viejo pedía veinticinco; este pide la cantera entera.
    progress: (s) => ({ current: Math.min(s.cratesOpened ?? 0, 500), target: 500 })
  },
  {
    id: 'ninguna_bala',
    title: 'Ninguna Bala',
    description: 'Acumula 100.000 clics',
    icon: 'power',
    rewardText: 'Título "Ninguna Bala"',
    reward: { clickBonus: 0, passiveBonus: 0 },
    progress: (s) => ({ current: Math.min(s.totalClicks ?? 0, 100000), target: 100000 })
  },
  {
    id: 'doblaje',
    title: 'Doblaje',
    description: 'Duplica el ingreso pasivo con compañeros multiplicadores',
    icon: 'scale',
    rewardText: 'Marco "Prisma"',
    reward: { clickBonus: 0, passiveBonus: 0 },
    // **El multiplicador global, no el ingreso**: es lo que hacen cinco compañeros
    // multiplicadores, y es la única forma de llegar a ×2 sin tocar la forja.
    //
    // **Y SE MIDE LA DIFERENCIA, NO EL VALOR.** `passiveMultiplier` **empieza en 1**, así
    // que medirlo tal cual leía 1 de 2 en una partida recién creada: la barra del logro
    // nacía al 50 %, con el marco ya a medio camino, antes de haber hecho nada. Un
    // progreso que no empieza en cero es un progreso que miente. Por eso el objetivo es
    // 1 —*cuánto falta por multiplicar*— y no 2, y lo que se resta es la base.
    //
    // El `Math.floor` de centésimas es porque los compañeros multiplican por factores con
    // decimales: sin él la barra daría 0,4375 y el jugador ve un porcentaje que no
    // corresponde a nada.
    progress: (s) => ({
      current: Math.min(Math.max(0, Math.round(((s.passiveMultiplier ?? 1) - 1) * 100) / 100), 1),
      target: 1
    })
  },
  {
    id: 'custodio',
    title: 'Custodio',
    description: 'Compra 20 nodos del árbol de pasivas',
    icon: 'tree',
    rewardText: 'Banner "Escaneo"',
    reward: { clickBonus: 0, passiveBonus: 0 },
    // **`unlockedNodes` y no `nodeLevels`**: son los nodos **comprados**, que es lo que el
    // jugador cuenta en el árbol. Los niveles se pueden subir gastando núcleos otra vez.
    progress: (s) => ({ current: Math.min((s.unlockedNodes ?? []).length, 20), target: 20 })
  },
  // ------------------------------------------------------------- Secretos
  // ------------------------------------------------------------- Secretos
  {
    id: 'ghost',
    title: '???',
    description: 'Un logro que nadie te pidió completar.',
    icon: 'sparkle',
    rewardText: 'Título oculto',
    reward: { clickBonus: 0, passiveBonus: 0 },
    progress: (s) => ({
      // Afijo Divino en un recolector: casi imposible por azar
      current: (s.warehouse ?? []).some((w: any) => (w.affixes || []).includes('aff_void')) ? 1 : 0,
      target: 1
    })
  },
  {
    id: 'hidden',
    title: '???',
    description: 'Cien cajas. Ni una más.',
    icon: 'crate',
    rewardText: 'Banner oculto',
    reward: { clickBonus: 0, passiveBonus: 0 },
    progress: (s) => ({ current: Math.min(s.cratesOpened ?? 0, 100), target: 100 })
  }
];

export interface AchievementState {
  unlocked: AchievementId[];
  /**-click y pasivo acumulados de los logros ya desbloqueados */
  clickBonus: number;
  passiveBonus: number;
}

export function createAchievementState(): AchievementState {
  return { unlocked: [], clickBonus: 0, passiveBonus: 0 };
}

/** Recalcula el progreso de todos los logros y devuelve los recién desbloqueados. */
export function evaluateAchievements(state: any, achState: AchievementState): Achievement[] {
  const newlyUnlocked: Achievement[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (achState.unlocked.includes(ach.id)) continue;
    const { current, target } = ach.progress(state);
    if (current >= target) {
      achState.unlocked.push(ach.id);
      achState.clickBonus += ach.reward.clickBonus;
      achState.passiveBonus += ach.reward.passiveBonus;
      newlyUnlocked.push(ach);
    }
  }
  return newlyUnlocked;
}
