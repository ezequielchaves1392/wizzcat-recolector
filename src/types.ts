export interface Companion {
  id: string;
  name: string;
  type: 'click' | 'passive' | 'multiplier';
  power: number;
  rarity: string;
}

export interface WarehouseItem {
  id: string;
  name: string;
  type: 'collector' | 'companion' | 'crate' | 'key' | 'crystal' | 'consumable';
  details: string;
  rarity: string;
  level?: number;
  tier?: number;
  damage?: number;
  equipped?: boolean;
  stackable?: boolean;
  stackCount?: number;
  sellPrice?: number;
}

export interface GameState {
  nanites: number;
  totalNanitesProduced: number;
  clickPower: number;
  factories: {
    drone: number;
    assembler: number;
    colossus: number;
  };
  lastUpdate: number;
  // Inventario y progresión
  keys: number;
  /** Recurso único de mejora. Lo escribe el motor; este tipo es vestigial. */
  crystals: number;
  warehouseCapacity: number;
  maxCompanionSlots: number;
  crates: {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  equippedCollectorId: string | null;
  companions: Companion[];
  activeCompanions: string[];
  warehouse: WarehouseItem[];
  buffs: {
    clickBoostExpiresAt: number;
    passiveBoostExpiresAt: number;
  };
  // Stats
  totalClicks: number;
  totalInfraestructure: number;
  cratesOpened: number;
  passiveIncome: number;
}

export interface UserProfile {
  uid: string;
  username: string;
  score: number;
  updatedAt: number;
}
