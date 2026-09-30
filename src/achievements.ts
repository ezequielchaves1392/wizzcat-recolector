export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rewardText: string;
  condition: (gameState: any) => boolean;
  unlocked: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_click',
    title: 'Primer Enlace',
    description: 'Extrae tus primeras 100 Nanitas Puras.',
    icon: '⚡',
    rewardText: '+5% Poder de Click',
    condition: (state) => state.totalNanitesProduced >= 100,
    unlocked: false
  },
  {
    id: 'drone_swarm',
    title: 'Enjambre Autómata',
    description: 'Posee al menos 10 Nanodrones Recolectores.',
    icon: '🛸',
    rewardText: 'Automatización Activa',
    condition: (state) => state.factories.drone >= 10,
    unlocked: false
  },
  {
    id: 'quantum_leap',
    title: 'Singularidad Cuántica',
    description: 'Acumula un total histórico de 10,000 Nanitas.',
    icon: '🌌',
    rewardText: 'Eficiencia Cuántica',
    condition: (state) => state.totalNanitesProduced >= 10000,
    unlocked: false
  },
  {
    id: 'colossus_awakening',
    title: 'Despertar Titánico',
    description: 'Construye tu primer Coloso de Silicio.',
    icon: '🦾',
    rewardText: 'Poder Supremo',
    condition: (state) => state.factories.colossus >= 1,
    unlocked: false
  }
];

export function checkAchievements(gameState: any, onUnlock: (achievement: Achievement) => void) {
  ACHIEVEMENTS.forEach((ach) => {
    if (!ach.unlocked && ach.condition(gameState)) {
      ach.unlocked = true;
      onUnlock(ach);
    }
  });
}