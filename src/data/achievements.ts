// Tipos compartidos de los logros, para no arrastrar el array completo al
// guardado del jugador.
export type AchievementId =
  | 'first_click'
  | 'collector_10'
  | 'swarm'
  | 'overclocked'
  | 'crate_opener'
  | 'jackpot'
  | 'rich'
  | 'full_squad'
  | 'deep_pockets'
  | 'tycoon';

export const ACHIEVEMENT_REWARDS: Record<AchievementId, { clickBonus: number; passiveBonus: number }> = {
  first_click: { clickBonus: 0.02, passiveBonus: 0 },
  collector_10: { clickBonus: 0.05, passiveBonus: 0 },
  swarm: { clickBonus: 0, passiveBonus: 0.08 },
  overclocked: { clickBonus: 0.10, passiveBonus: 0 },
  crate_opener: { clickBonus: 0, passiveBonus: 0.12 },
  jackpot: { clickBonus: 0.15, passiveBonus: 0 },
  rich: { clickBonus: 0, passiveBonus: 0.15 },
  full_squad: { clickBonus: 0, passiveBonus: 0.20 },
  deep_pockets: { clickBonus: 0.25, passiveBonus: 0 },
  tycoon: { clickBonus: 0.30, passiveBonus: 0.30 }
};
