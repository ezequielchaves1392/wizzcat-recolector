// ==========================================================================
// Cyber-Forge · Tipos del dominio
//
// Un único lugar donde vive la forma de los datos. Antes cada módulo declaraba
// su propia versión de `CollectorItem` con campos distintos, y el guardado en
// Firestore terminaba guardando objetos que ningún módulo sabía leer.
// ==========================================================================

/** Rareza. El orden importa: se usa para ordenar y para el índice de color. */
export type Rarity = 'Común' | 'Raro' | 'Épico' | 'Legendario' | 'Mítico' | 'Divino' | 'Sobrecargado';

export const RARITY_ORDER: Rarity[] = [
  'Común', 'Raro', 'Épico', 'Legendario', 'Mítico', 'Divino', 'Sobrecargado'
];

/** Atributo que un recolector crafteado hereda de sus materiales. */
export interface Affix {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  /** Efecto numérico que se aplica al calcular el valor y el daño. */
  effect: {
    /** Multiplicador de daño de click, 0.15 = +15% */
    clickMult?: number;
    /** Multiplicador de ingreso pasivo, 0.20 = +20% */
    passiveMult?: number;
    /** +n al daño de click plano */
    flatDamage?: number;
    /** +n al ingreso pasivo plano */
    flatPassive?: number;
    /** Probabilidad extra de crítico */
    critChance?: number;
    /** Multiplicador de la probabilidad de crafteo */
    craftLuck?: number;
  };
}

export interface CollectorItem {
  id: string;
  name: string;
  type: 'collector';
  details: string;
  rarity: Rarity;
  tier: number;
  level: number;
  damage: number;
  /** Techo de nivel. Las recolectores crafteadas pueden superar el 20 normal. */
  maxLevel?: number;
  /** Potencia acumulada de la fusión, 1..5. Solo en recolectores crafteadas. */
  potential?: number;
  /** Atributos heredados. Solo en recolectores crafteadas. */
  affixes?: string[];
  /** Usuario que la forjó. La torna única e irrepetible. */
  forgedBy?: string;
  /** Fecha de forja, para mostrar antigüedad en el mercado. */
  forgedAt?: number;
  /** Marca de recolector sobrecargado de caja. */
  overclock?: boolean;
  /** Rareza de los materiales con los que se forjó, para el valor. */
  lineage?: Rarity[];
  equipped?: boolean;
  sellPrice?: number;
}

export interface CompanionItem {
  id: string;
  name: string;
  type: 'companion';
  details: string;
  rarity: Rarity;
  tier?: number;
  sellPrice?: number;
}

export interface StackableItem {
  id: string;
  name: string;
  type: 'crate' | 'consumable' | 'key' | 'crystal';
  details: string;
  rarity: Rarity;
  /** Identificador estable del efecto, para buffs y consumibles de crafteo. */
  buffId?: string;
  stackable: true;
  stackCount: number;
  sellPrice?: number;
  /** Rareza del loot, para mostrar el destello en el almacén. */
  exclusive?: boolean;
  sellable?: boolean;
}

export type WarehouseItem = CollectorItem | CompanionItem | StackableItem;

// --------------------------------------------------------------------------
// Prestige
// --------------------------------------------------------------------------

/** Bonificación agregada de todos los nodos comprados. */
export interface PassiveBonuses {
  /** Multiplicador de daño de click. 0.5 = +50%. */
  clickMult: number;
  /** Multiplicador de ingreso pasivo. */
  passiveMult: number;
  /** Reducción de coste. 0.25 = -25% (se aplica como ×0.75). */
  costReduction: number;
  /** Multiplicador del precio de venta. */
  sellMult: number;
  /** Bonificación a la probabilidad de crafteo (fracción). */
  craftLuck: number;
  /** Esquirlas extra por fallo de crafteo (fracción). */
  shardBonus: number;
  /** Clics automáticos por segundo. */
  autoClick: number;
  /** Horas extra de AFK por tarjeta. */
  afkHours: number;
  /** Clics extra garantizados al cargar. */
  offlineClicks: number;
  /** Bonificación a la suerte de las cajas. */
  crateLuck: number;
  /** Núcleos ganados por reinicio (fracción). */
  coreGain: number;
  /** Ranuras extra de inventario. */
  storageSlots: number;
  /** Ranuras extra de compañeros equipables. */
  companionSlots: number;
}

export type NodeCategory = 'automatizacion' | 'multiplicador' | 'economia' | 'crafteo' | 'exclusivo';

export interface TreeNode {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: NodeCategory;
  /** Tiers desbloqueables: 0 = nodo raíz sin requisitos. */
  tier: number;
  /** ids de nodos que deben estar comprados. */
  requires: string[];
  /** Coste en Núcleos para el primer nivel. */
  baseCost: number;
  /** Coste en Núcleos para cada nivel siguiente (1.55x). */
  costGrowth: number;
  /** Niveles máximos. */
  maxLevel: number;
  /** Bonificación por nivel. */
  bonus: Partial<PassiveBonuses>;
  /** Posición en el árbol (columna = tier). */
  x: number;
  y: number;
}

// --------------------------------------------------------------------------
// Cosméticos
// --------------------------------------------------------------------------

export type CosmeticType = 'title' | 'frame' | 'banner';

export type UnlockKind = 'cores' | 'achievement' | 'ranking' | 'crate' | 'secret' | 'default';

export interface Cosmetic {
  id: string;
  type: CosmeticType;
  name: string;
  description: string;
  rarity: Rarity;
  unlock: {
    kind: UnlockKind;
    /** cores | id de logro | posición en el ranking | rareza de caja */
    value: number | string;
    /** Pista para los desbloqueos secretos. */
    hint?: string;
  };
  style: Record<string, string>;
}

// --------------------------------------------------------------------------
// Progresión guardada
// --------------------------------------------------------------------------

export interface PrestigeState {
  /** Núcleos disponibles para gastar. */
  cores: number;
  /** Núcleos ganados historicamente. */
  totalCores: number;
  /** Número de reinicios. */
  resets: number;
  /** ids de nodos comprados. */
  unlockedNodes: string[];
  /** Nivel por nodo: `{ nodeId: level }`. */
  nodeLevels: Record<string, number>;
  /** Esquirlas de crafteo acumuladas. */
  shards: number;
  /** Recolectores crafteadas por el jugador. */
  forgedCount: number;
}

export interface CosmeticState {
  title: string;
  frame: string;
  banner: string;
  unlocked: string[];
}

export interface ProfileState {
  displayName: string;
  title: string;
  frame: string;
  banner: string;
  bio?: string;
  createdAt?: number;
  /** Logros públicos: id de logro -> fecha. Secretos: solo el contador. */
  achievements: Record<string, number>;
  secretAchievements: string[];
  forgedCollectors: number;
  bestCollector?: { name: string; damage: number; tier: number };
}
