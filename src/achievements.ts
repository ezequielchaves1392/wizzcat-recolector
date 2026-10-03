// Logros del juego.
//
// Antes este archivo no lo importaba nadie y sus condiciones miraban
// `state.factories`, un campo que ya no existe: los logros no se evaluaban nunca.
// Las recompensas son pasivas (multiplicador de click y de pasivo) y se aplican
// al recalcular, así que no necesitan escribirse en el estado del jugador.

import { ACHIEVEMENT_REWARDS, type AchievementId } from './data/achievements';

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
