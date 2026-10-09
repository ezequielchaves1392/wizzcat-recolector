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
  crystals: 0,
  warehouseCapacity: 20,
  maxCompanionSlots: 3,
  crates: {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0
  },
  equippedCollectorId: null,
  companions: [],
  activeCompanions: [],
  warehouse: [],
  buffs: {
    clickBoostExpiresAt: 0,
    clickX2ExpiresAt: 0,
    clickX3ExpiresAt: 0,
    passiveBoostExpiresAt: 0,
    compPassiveBoostExpiresAt: 0,
    compClickBoostExpiresAt: 0,
    compGlobalBoostExpiresAt: 0,
    clickBoostTotalMs: 0,
    clickX2TotalMs: 0,
    clickX3TotalMs: 0,
    passiveBoostTotalMs: 0,
    compPassiveBoostTotalMs: 0,
    compClickBoostTotalMs: 0,
    compGlobalBoostTotalMs: 0
  },
  totalClicks: 0,
  totalInfraestructure: 0,
  cratesOpened: 0,
  passiveIncome: 0
};

// Los datos del juego se guardan en Firestore (users/{uid})
