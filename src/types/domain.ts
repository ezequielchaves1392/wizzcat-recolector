// ==========================================================================
// Cyber-Forge · Tipos del dominio
//
// Un único lugar donde vive la forma de los datos. Antes cada módulo declaraba
// su propia versión de `CollectorItem` con campos distintos, y el guardado en
// Firestore terminaba guardando objetos que ningún módulo sabía leer.
// ==========================================================================

/**
 * Rareza. El orden importa: se usa para ordenar y para el índice de color.
 *
 * **YA NO HAY UNA RAREZA POR ENCIMA DE `Divino`.** Existía `Sobrecargado`, una
 * séptima rareza que solo se obtenía del recolector sobrecargado de las cajas, y
 * que era una segunda escala de calidad **además del potencial**: un item podía
 * ser `Divino` por tier y `Sobrecargado` por sobrecarga, y entonces la rareza
 * decía una cosa y el potencial otra. Como el potencial ya es la escala de
 * calidad de 1 a 5, y además decide el poder de los compañeros, la sobrecarga se
 * va: **un item es tan bueno como su potencial**, y la rareza solo dice de qué
 * tier viene.
 */
export type Rarity = 'Común' | 'Raro' | 'Épico' | 'Legendario' | 'Mítico' | 'Divino';

export const RARITY_ORDER: Rarity[] = [
  'Común', 'Raro', 'Épico', 'Legendario', 'Mítico', 'Divino'
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
    /**
     * +n% al daño de click POR CADA NIVEL del recolector, 0.02 = +2% por nivel.
     *
     * Es un porcentaje y no un número plano a propósito: un "+8 de daño por
     * nivel" le da 160 a un item de nivel 20, y a un T1 eso es más de treinta
     * veces su base. En porcentaje escala con el item y no lo rompe.
     */
    clickMultPorNivel?: number;
    /** +n% al ingreso pasivo por cada 5 niveles, 0.05 = +5% por cada 5. */
    passiveMultPorNiveles?: number;
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
  /**
   * Potencial 1..5, y con él el poder sale de la posición dentro del rango del
   * tier. **Es la misma escala que la del recolector y la misma que decide el
   * daño del click**: aquí decide el ingreso.
   *
   * Solo lo llevan los compañeros cuyo poder sale del rango de su tier —los de
   * tienda y los de caja—. Los seis compañeros exclusivos de caja tienen un
   * poder escrito a mano y no de tier, así que escalarlos por tier los
   * destrozaría; esos vienen sin estrellas y con su número de siempre.
   */
  potential?: number;
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
  /** Cristales extra por fallo de forja, como fracción. */
  consolationBonus: number;
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
  /**
   * Una frase de sabor sobre QUE ES ESTA PASIVA Y POR QUE EXISTE.
   *
   * No es decoracion: description dice el numero y esto dice para que sirve, que es
   * lo que el jugador no puede deducir de un +8 %. La hoja del nodo las ensena las dos.
   */
  lore?: string;
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
  /** Estilo del borde del avatar cuando este cosmético es un banner. */
  frameStyle?: Record<string, string>;
  /** Color del icono del avatar cuando este cosmético es un banner. */
  iconColor?: string;
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
