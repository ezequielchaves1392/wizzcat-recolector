import { GameState } from './types';

export const defaultState: GameState = {
  nanites: 0,
  totalNanitesProduced: 0,
  clickPower: 1,
  factories: {
    drone: 0,
    assembler: 0,
    colossus: 0
  },
  lastUpdate: Date.now(),
  keys: 0,
  upgradeCrystals: 0,
  warehouseCapacity: 20,
  maxCompanionSlots: 3,
  crates: {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0
  },
  collectors: {
    blaster: { level: 0, equipped: false },
    plasmaCannon: { level: 0, equipped: false },
    quantumDisruptor: { level: 0, equipped: false }
  },
  companions: [],
  activeCompanions: [],
  warehouse: [],
  buffs: {
    clickBoostExpiresAt: 0,
    passiveBoostExpiresAt: 0
  },
  totalClicks: 0,
  totalInfraestructure: 0,
  cratesOpened: 0,
  passiveIncome: 0
};

// Los datos del juego se guardan en Firestore (users/{uid})
