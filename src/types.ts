export interface Collector {
  level: number;
  equipped: boolean;
}

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
  type: 'weapon' | 'companion' | 'crate' | 'key' | 'crystal' | 'consumable';
  details: string;
  rarity: string;
  level?: number;
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
  upgradeCrystals: number;
  warehouseCapacity: number;
  maxCompanionSlots: number;
  crates: {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  collectors: {
    blaster: Collector;
    plasmaCannon: Collector;
    quantumDisruptor: Collector;
  };
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
