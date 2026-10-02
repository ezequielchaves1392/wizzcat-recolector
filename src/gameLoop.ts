import { showToast } from './utils/toast';
import { formatNumber } from './utils/format';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { anotarPendiente, hayPendientes, leerCola, confirmarCola } from './services/naniteQueue';
import { rollCrateReward } from './components/crateLoot';
import { evaluateAchievements, createAchievementState, ACHIEVEMENTS, type Achievement } from './achievements';
import type { AchievementId } from './data/achievements';
import { SECRET_ACHIEVEMENTS } from './data/achievements';
// Los tiers viven en data/ porque los usan también el crafteo, el mercado y la
// valoración. Se re-exportan aquí para no romper los imports existentes.
export { TIER_SYSTEM, TIER_POWER } from './data/tiers';
import { TIER_SYSTEM, TIER_POWER } from './data/tiers';
import { aggregateBonuses, canBuyNode, pendingCores, nextCores } from './data/prestige';
import { TREE_BY_ID, nodeCost } from './data/tree';
import { attemptForge, AFFIX_BY_ID, collectorMaxLevel } from './data/crafting';
import { sellPrice, collectorValue } from './data/valuation';
import { countOccupiedSlots, isStackable, mergeStacks, stackUnits } from './data/stacking';

// ==========================================================================
//  LAS TABLAS Y LAS FUNCIONES PURAS ESTÁN FUERA. AQUÍ ESTÁ POR QUÉ.
//
//  Este fichero tenía 3.352 líneas y las primeras 250 eran datos puros: precios,
//  tipos de caja, buffs y generadores. Cuatro ficheros tenían que importarlo
//  entero —con Firebase y la cola de nanitas dentro— solo para leer un número, y
//  `data/items.ts` acababa haciendo `import type { CrateType } from
//  '../gameLoop'`, que es un `data/` que depende de donde vive el estado. R29
//  dice que las reglas compartidas viven en `data/`, y aquí no era cierto.
//
//  Ahora viven en `data/store.ts`, `data/buffs.ts` y `data/generators.ts`. Lo que
//  queda en este fichero es lo que de verdad necesita la partida.
//
//  Y LA MUDANZA ES LITERAL. Las mismas tablas, los mismos números, las mismas
//  claves: nada de esto cambia una regla. Lo que no se puede comprobar con un
//  banco es que no se haya movido nada que no sea un número, y por eso aquí no
//  hay ninguna decisión nueva que revisar — solo dónde vive cada cosa.
// ==========================================================================
import {
  STORE_ITEMS, CRATE_TYPES, CONSUMABLES, COLLECTOR_BASE_COSTS,
  COMPANION_SLOT_COSTS, RANURA_POR_CARTA, EXPANSOR_TIERS, WAREHOUSE_MAX_CAP,
  expansorPorBuff, type CrateType
} from './data/store';
import { AFK_CARD_DURATION_MS, MAX_AFK_BUFF_DURATION_MS, BUFF_FIELDS, type BuffKey } from './data/buffs';
import { generateCompanionByTier, generateCollectorByTier } from './data/generators';
import { collectorUpgradeCost } from './data/crafting';

// Se re-exportan las que el resto del juego ya importaba de aquí, con el mismo
// motivo que `TIER_SYSTEM` unas líneas más arriba: romper diez imports de golpe
// no aporta nada y hace la mudanza más difícil de revisar. Lo que importa es que
// quien los use los use para lo que sirven —una tabla o una fórmula—, no para
// llegar al motor.
export { STORE_ITEMS, CRATE_TYPES, COLLECTOR_BASE_COSTS, COMPANION_SLOT_COSTS };
export { AFK_CARD_DURATION_MS, MAX_AFK_BUFF_DURATION_MS, BUFF_FIELDS };
export { collectorUpgradeCost };
export type { CrateType, BuffKey };

/**
 * Probabilidad de éxito con un cristal concreto, en porcentaje.
 *
 * Es el mismo número que usa `upgradeEquippedCollector`, expuesto para que las
 * vistas puedan enseñarlo ANTES de que el jugador gaste. La regla del juego es
 * que ninguna probabilidad se muestra después de confirmar.
 *
 * Y por qué sigue aquí y no en `data/`: es un alias de una función pura que ya
 * vive en `crafting.ts`. Mover el alias no quitaría ni una línea, y lo que sí
 * haría es abrir una segunda puerta a la misma regla: alguien lo tocaría creyendo
 * que es la fuente, y no lo es.
 */
export function previewUpgradeChance(level: number, crystalPower: number): number {
  return crystalSuccessChance(level, crystalPower);
}

/**
 * Coste de la sintonización al nivel dado, en unidades de cristal.
 *
 * Igual que el anterior: el juego cobra esto, la vista lo enseña. Duplicar el
 * cálculo en la interfaz sería una forma de que el botón dijera una cifra y el
 * cobro otra.
 */
export function previewUpgradeCost(level: number): number {
  return collectorUpgradeCost(level);
}
// `KeyDef` y `CrystalDef` se importaban aquí y ya no se usan: el precio de
// reventa del material salía de `def.cost`, y al salir de `STORE_ITEMS` se han
// quedado sin uso. Se borran en vez de dejarlos, porque un tipo importado que
// no lee nadie es la señal de que la regla se movió y nadie lo anotó.
import {
  KEY_DEFS, KEY_TIER_ORDER, CRYSTAL_DEFS, CRATE_KEY_TIER, STORE_KEY_TIER,
  crystalSuccessChance, crystalPowerFromName, keyTierFromName, keyOpens,
  type KeyTier
} from './data/items';


// Antes esto era un modal con botón "Aceptar" para avisos como "Almacén lleno":
// bloqueaba la partida por un mensaje informativo. Ahora es un toast no bloqueante.

// La 7 es la del renombre `weapon` -> `collector`. La 6 no avisó de nada: el
// código pasó a esperar 'collector' y las partidas que ya existían se quedaron
// con 'weapon' guardado, que no es un tipo que reconozca nadie. Por eso esta
// versión no sube por el formato del documento sino por un cambio de NOMBRES
// dentro de él, y por eso las migraciones de abajo se aplican solo al cruzarla.
//
// Una partida sin `saveVersion` (o con 0) se trata como anterior a la 7: es lo
// que quiere decir no haber pasado nunca por este código.
const SAVE_VERSION = 7;

/**
 * Tope de seguridad de celdas de hueco guardadas.
 *
 * No es el limite real -ese es el tablero, y lo calcula la vista-, sino un
 * cortafuegos contra un documento manipulado que traiga un numero disparatado y
 * empuje todos los items fuera de la rejilla. Muy por encima de cualquier
 * almacen real: un tablero de 200 celdas es un almacen de 200 items.
 */
const TOPE_CELDAS_HUECO = 200;

/**
 * Normaliza una fecha guardada a milisegundos.
 *
 * El juego escribe `updatedAt` como `new Date()`, que Firestore convierte en un
 * `Timestamp`; pero `rankingService` escribe el suyo como `Date.now()`, un
 * número pelado, y en una partida larga hay documentos escritos por los dos
 * caminos. La cola de nanitas compara su marca con este campo para decidir cuál
 * de los dos es más nuevo, así que un `toDate()` a medias reventaría con el
 * segundo.
 */
function aMilis(valor: any): number {
  if (valor == null) return 0;
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') {
    const t = Date.parse(valor);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (typeof valor.seconds === 'number') return valor.seconds * 1000;
  return 0;
}

/**
 * Tipos de item que se renombraron, del nombre viejo al nuevo.
 *
 * `weapon` pasó a llamarse `collector` cuando las armas se convirtieron en
 * recolectores. El nombre viaja en el guardado, no en el código, así que el
 * cambio no alcanzó a las partidas que ya estaban escritas.
 *
 * No se puede arreglar en la vista, porque el objeto no está mal: es el mismo
 * Blaster Láser con la etiqueta vieja. Y el tipo es la clave de todo lo
 * demás —la pestaña del filtro, el botón de equipar, la forja, el precio de
 * venta, la protección de "no vendas el último"—, así que un item con el tipo
 * viejo desaparece de "Recolectores", no se puede equipar y el detalle acaba
 * pintando la etiqueta cruda: "weapon".
 *
 * Se traduce una vez al cargar y se guarda el resultado.
 */
const LEGACY_ITEM_TYPES: Record<string, string> = {
  weapon: 'collector'
};

/** Traduce los tipos renombrados de un almacén. Devuelve si ha tocado algo. */
function migrateItemTypes(warehouse: any[]): boolean {
  let changed = false;
  for (const item of warehouse) {
    const moderno = LEGACY_ITEM_TYPES[item.type];
    if (!moderno) continue;
    item.type = moderno;
    changed = true;
  }
  return changed;
}

/**
 * Deja `equippedCollectorId` y la bandera `equipped` de los items diciendo lo
 * mismo.
 *
 * Son la misma información en dos sitios, y una partida vieja no siempre tiene
 * los dos: con la bandera puesta y el id vacío, la rejilla marcaba el item como
 * equipado y el juego no leía su daño, así que el click se quedaba a cero sin
 * decir nada. Al revés, el detalle ofrecía "Desequipar" sobre un item que nadie
 * tenía puesto.
 *
 * El id manda porque es lo que lee el cálculo de daño, y la bandera se recalcula
 * a partir de él. Un id que ya no apunta a ningún recolector se descarta en vez
 * de dejar el estado apuntando al vacío.
 */
function reconcileEquippedCollector(
  warehouse: any[],
  equippedId: string | null,
  adoptarBandera = true
): { id: string | null; changed: boolean } {
  let id = equippedId;
  if (id && !warehouse.some((w: any) => w.id === id && w.type === 'collector')) id = null;
  // Sin id, la bandera puesta es lo único que dice qué llevaba equipado. Solo
  // se adopta si hay un único candidato: con dos, no hay forma de saber cuál.
  //
  // Esto es un RESCATE de guardado viejo y por eso es opcional: quien
  // desequipa está diciendo que no lleva ninguno, así que no puede querer que
  // su propio clic le vuelva a poner la bandera como equipado. Sin el
  // interruptor, Desequipar no hacía nada y la bandera no bajaba nunca.
  if (!id && adoptarBandera) {
    const marcados = warehouse.filter((w: any) => w.type === 'collector' && w.equipped);
    if (marcados.length === 1) id = marcados[0].id;
  }

  let changed = id !== equippedId;
  for (const w of warehouse) {
    const debeSer = w.type === 'collector' && w.id === id;
    if (!!w.equipped === debeSer) continue;
    w.equipped = debeSer;
    changed = true;
  }
  return { id, changed };
}

// Deduce el buffId de un consumible guardado antes de que existiera el campo.
// Se usa una sola vez, al migrar saves antiguos.
function inferBuffIdFromName(name: string): string | null {
  const lower = name.toLowerCase();
  // Los tipos van antes que el genérico: un "Expansor T1" sin `buffId` es un
  // T1, no el +1 viejo. El genérico queda para el stock de antes de los tipos.
  if (lower.includes('expansor t3')) return 'expansorT3';
  if (lower.includes('expansor t2')) return 'expansorT2';
  if (lower.includes('expansor t1')) return 'expansorT1';
  if (lower.includes('expansor')) return 'warehouseExpander';
  if (lower.includes('afk')) return 'afk';
  if (lower.includes('click x3')) return 'clickX3';
  if (lower.includes('click x2')) return 'clickX2';
  if (lower.includes('pasivo')) return 'passiveBoost';
  if (/clics?\s*x2/.test(lower)) return 'clickBoost';
  return null;
}

function createCrateItem(crateType: CrateType, quantity: number = 1) {
  const def = CRATE_TYPES[crateType];
  const storeItem = (STORE_ITEMS as Record<string, { cost: number }>)[`${crateType}Crate`];
  return {
    id: `crate_${crateType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: def.name,
    type: 'crate' as const,
    details: def.details,
    rarity: def.rarity,
    tier: 0,
    sellPrice: Math.floor(storeItem.cost / 4),
    stackable: true,
    stackCount: quantity
  };
}


export async function createGameLoop(
  user: any,
  onUpdate: (state: any, isAfkPaused?: boolean) => void,
  username?: string,
  onAchievement?: (achievement: Achievement) => void
) {
  // Se declara antes de la carga de Firestore: `recalculatePassiveIncome` se llama
  // durante la carga y lee este estado (TDZ si se declarase más abajo).
  // `unlocked` se sincroniza con state.unlockedAchievements en cada rebuild.
  const achievementState = createAchievementState();

  // El compañero inicial es un T1 real: mismo poder que compra el jugador, para
  // que la decisión "comprar otro T1 o guardar" tenga sentido desde el segundo 1.
  const baseCompanion = {
    id: 'companion_base_001',
    name: 'Dron Explorador',
    type: 'click' as const,
    power: 5,
    rarity: 'Común',
    tier: 1
  };

  // Bonus especial para usuarios de prueba
  // El nombre llega resuelto desde `main.ts`, que ya lo ha buscado en la
  // sesión, en el registro y en la partida guardada. Aquí solo se normaliza.
  // Antes se leía solo `user.displayName`, que Firebase puede devolver vacío
  // tras renovar el token: el juego arrancaba como "Operativo" y el nombre
  // bueno se perdía en el siguiente guardado.
  const displayName = (user.displayName || username || 'Operativo').trim();
  const isBlanquician = displayName.toLowerCase() === 'blanquician';
  const isAdmin = displayName.toLowerCase() === 'admin';
  const initialNanites = (isBlanquician || isAdmin) ? 100000000 : 0;

  /**
   * Cuánto del segundo le toca a cada compañero, indexado por su id.
   *
   * POR QUÉ ESTÁ AQUÍ, JUNTO AL ESTADO Y NO JUNTO A SU USUARIO. Se rellena en
   * `repartirPorCompanion()`, que se llama desde `recalculatePassiveIncome()`, y
   * esa función se dispara al construir el estado —y también desde
   * `checkAchievements()` durante esa misma construcción—. Un `const` declarado
   * más abajo del todo es zona temporal muerta en ese punto, y el fallo sale como
   * `Cannot access ... before initialization` desde DENTRO del `try/catch` que
   * informa de fallos de red: un error de código disfrazado de Firebase, que es
   * exactamente el modo de fallo que este módulo ya Suffrió una vez con
   * `one.mjs`.
   */
  const ingresoPorCompanion = new Map<string, number>();

  let state = {
    saveVersion: SAVE_VERSION,
    nanites: initialNanites,
    totalNanitesProduced: initialNanites,
    passiveIncome: 0,
    passiveMultiplier: 1, // Multiplicador global aportado por los compañeros tipo 'multiplier'
    totalClicks: 0,
    totalInfraestructure: 0,
    cratesOpened: 0,
    unlockedAchievements: [] as AchievementId[],
    // --- Prestige ---
    cores: 0, // Núcleos disponibles
    totalCores: 0, // Núcleos ganados historicamente
    resets: 0, // Veces que se ha reciclado el progreso
    unlockedNodes: [] as string[], // Nodos comprados
    nodeLevels: {} as Record<string, number>, // Nivel por nodo
    shards: 0, // Esquirlas de crafteo
    forgedCount: 0, // Recolectores forjadas con exito
    // --- Bonificaciones agregadas del arbol (se recalculan al cargar) ---
    bonus: {
      clickMult: 0, passiveMult: 0, costReduction: 0, sellMult: 0,
      craftLuck: 0, shardBonus: 0, autoClick: 0, afkHours: 0,
      offlineClicks: 0, crateLuck: 0, coreGain: 0, storageSlots: 0, companionSlots: 0
    },
    // --- Cosméticos equipados ---
    cosmetics: {
      title: 'title_default',
      frame: 'frame_none',
      banner: 'banner_none',
      unlocked: ['title_default', 'frame_none', 'banner_none'] as string[]
    },
    keys: 3,
    upgradeCrystals: 5,
    warehouseCapacity: 15,
    maxCompanionSlots: 1,
    // Ids de items delante de los cuales el jugador ha dejado un hueco. Ver
    // `setWarehouseGaps`. El array sigue Empaquetado: un hueco es una
    // preferencia de disposición, no una posición, y por eso va anclado a un id
    // y no a un índice de celda.
    warehouseGaps: [] as string[],
    afkCards: 0, // Tarjetas AFK acumuladas (máx 3)
    afkExpiresAt: 0, // Tiempo de expiración del buff AFK (10 min por tarjeta)
    crates: {
      common: 2,
      rare: 0,
      epic: 0,
      legendary: 0
    },
    // Contadores DERIVADOS del almacén. Los calcula `syncMaterialCounters()`.
    // Se guardan porque el árbol de pasivas los lee y porque las partidas
    // viejas los traen; nunca son la fuente de verdad.
    keysByTier: { 0: 3, 1: 0, 2: 0, 3: 0 } as Record<number, number>,
    crystalsByTier: { 1: 5 } as Record<number, number>,
    crystalTotal: 5,
    equippedCollectorId: null as string | null,
    companions: [baseCompanion] as Array<{ id: string; name: string; type: 'click' | 'passive' | 'multiplier'; power: number; rarity: string; tier?: number }>,
    activeCompanions: [] as string[],
    warehouse: [
      { id: 'collector_blaster_001', name: 'Blaster Láser', type: 'collector', details: 'Recolección por click: +5', rarity: 'Común', tier: 1, level: 0, damage: 5, sellPrice: 250 },
      { id: 'companion_base_001', name: 'Dron Explorador', type: 'companion', details: 'Recolección por segundo: +5/s', rarity: 'Común', tier: 1, sellPrice: 250 }
    ] as Array<{ id: string; name: string; type: string; details: string; rarity: string; tier?: number; level?: number; damage?: number; equipped?: boolean; sellPrice?: number; stackable?: boolean; stackCount?: number }>,
    buffs: {
      clickBoostExpiresAt: 0,
      passiveBoostExpiresAt: 0,
      clickX2ExpiresAt: 0, // Tarjeta Click x2 (30s)
      clickX3ExpiresAt: 0  // Tarjeta Click x3 (30s)
    }
  };

/**
 * Precio de venta de un item del almacén.
 *
 * Vive fuera del objeto devuelto porque lo necesitan dos sitios: la vista, que
 * lo pinta, y `sellItem()`, que lo cobra. Con la fórmula duplicada, la tarjeta
 * podía enseñar un precio y el cobro aplicar otro.
 */function getSellPriceFor(item: any): number {
  if (item.type === 'collector') {
    return sellPrice(item, { sellMult: 1 + state.bonus.sellMult });
  }
  return Math.floor((item.sellPrice || 0) * (1 + state.bonus.sellMult));
}

/**
 * Cuántas unidades de una pila se pueden vender, ya recortadas a lo que hay.
 *
 * Sin `pedidas` devuelve la pila entera: es el comportamiento de siempre, y por
 * eso todos los bancos que llamaban a `sellItem(id)` siguen vendiéndolo todo.
 *
 * POR QUÉ SE RECORTA Y POR QUÉ NO SE RECHAZA. Entre que el jugador abre la ficha
 * y pulsa "Vender" la pila puede haber bajado: abrió una caja, vendió otra cosa,
 * le Reseteó la Ascensión. Recortar devuelve menos de lo que el botón anunciaba,
 * pero el botón se lo pregunta a ESTA misma función, así que el número que se
 * pintó y el que se cobra salen de aquí y no pueden discrepar. Rechazar, en
 * cambio, deja un botón muerto — que es peor que un bug visible, porque el
 * jugador no entiende por qué no ocurre nada.
 *
 * 0 significa "cantidad no válida", que es el único caso que `sellItem` rechaza
 * de verdad: un 0 o un texto no es una intención de compra.
 */
function unidadesVendibles(item: any, pedidas?: number): number {
  const disponibles = stackUnits(item);
  if (pedidas === undefined || pedidas === null) return disponibles;
  const n = Math.floor(Number(pedidas));
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(n, disponibles);
}

/**
 * Precio unitario de una carta de tienda, con el descuento del árbol.
 *
 * Vive junto al estado y no en la vista porque lo necesitan tres: la tarjeta
 * (lo pinta), el diálogo de cantidad (el total) y `buyStoreItem` (lo cobra).
 * Con la fórmula en un solo sitio, el número pintado y el cobrado no pueden
 * separarse (R3). La tarjeta la calculaba a mano con la misma cuenta; ahora la
 * pide aquí.
 */
function precioUnitarioTienda(itemKey: string): number {
  const item = (STORE_ITEMS as Record<string, { cost: number }>)[itemKey];
  if (!item) return 0;
  return Math.floor(item.cost * (1 - state.bonus.costReduction));
}

/**
 * Cuántas unidades se compran, ya recortadas a lo válido.
 *
 * Solo lo apilable se compra en lote (llaves, cristales, cajas y
 * consumibles): una carta de tier o una ranura son únicas y siempre valen
 * una, pida lo que pida la vista. Un 0, un negativo o un NaN es "cantidad no
 * válida" y vale 0, que `buyStoreItem` rechaza sin cobrar —igual que
 * `unidadesVendibles` en la venta—.
 */
function unidadesCompra(itemKey: string, pedidas?: number): number {
  const apilable = STORE_KEY_TIER[itemKey] !== undefined
    || itemKey === 'upgradeCrystal'
    || !!CONSUMABLES[itemKey as keyof typeof CONSUMABLES]
    || (itemKey.endsWith('Crate') && !!(CRATE_TYPES as Record<string, unknown>)[itemKey.replace('Crate', '').toLowerCase()]);
  if (!apilable) return 1;
  if (pedidas === undefined || pedidas === null) return 1;
  const n = Math.floor(Number(pedidas));
  if (!Number.isFinite(n) || n < 1) return 0;
  return n;
}

/**
 * Mete un item en el almacén, sumándolo a la pila que ya hubiera.
 *
 * Es la ÚNICA forma de añadir un item al almacén, y el motivo de que exista es
 * que antes no lo había: cada sitio hacía `state.warehouse.push(item)`, así que
 * una caja que soltaba una llave metía un item NUEVO en vez de sumar una unidad a
 * la pila de llaves que el jugador ya tenía. Cada llave ocupaba su propia
 * ranura, la rejilla las agrupaba en una celda con un "19" y el contador pedía
 * 19 ranuras por un item que el jugador nunca había visto duplicado.
 *
 * Un apilable se suma a la primera pila del mismo tipo y nombre; si no cabe en
 * ella, se abre una pila nueva. Un item que no es apilable siempre entra con su
 * propio id, porque dos recolectores son dos cosas distintas aunque se llamen
 * igual.
 *
 * Devuelve false si no había hueco. No avisa: quien llama decide, porque hay
 * sitios que compensan en nanitas y sitios que pierden el botín a propósito.
 */
function addToWarehouse(item: any): boolean {
  const pila = pilaPara(item);
  if (pila) {
    pila.stackCount = stackUnits(pila) + stackUnits(item);
    return true;
  }

  if (countOccupiedSlots(state.warehouse) >= effectiveWarehouseCapacity()) return false;
  state.warehouse.push(item);
  return true;
}

/**
 * La pila a la que se sumaría este item, o null si no hay ninguna.
 *
 * Es la pregunta "¿necesita ranura nueva?" y tiene que ser la MISMA que se hace
 * en `addToWarehouse`. Si se respondiera solo mirando si el almacén está lleno,
 * una compra de algo que cabe en una pila existente se rechazaría con el almacén
 * lleno: el jugador vería "Almacén lleno" por un item que no ocupa ni una ranura
 * y perdería las nanitas.
 */
function pilaPara(item: any): any {
  if (!isStackable(item)) return null;
  const clave = `${item.type}::${item.name}`;
  return state.warehouse.find((w: any) => isStackable(w) && `${w.type}::${w.name}` === clave) ?? null;
}

/** ¿Cabe este item en el almacén, fundiéndolo en una pila si se puede? */
function cabeEnAlmacen(item: any): boolean {
  return !!pilaPara(item) || countOccupiedSlots(state.warehouse) < effectiveWarehouseCapacity();
}

/**
 * Productos que no meten nada en el almacén: son permisos, no objetos.
 *
 * Ampliar el almacén o añadir huecos de compañero no guarda un item, así que
 * no tiene por qué haber hueco. Lo que no está en esta lista SÍ es un objeto
 * físico y necesita su sitio: llaves y cristales incluidos.
 */
const NO_OCUPA_RANURA = ['companionSlot1', 'companionSlot2', 'companionSlot3'];

/**
 * ¿Se puede comprar este producto sin que el almacén se desborde?
 *
 * La respuesta la necesita la TIENDA para decidir si pinta el botón como
 * "Almacén lleno", y la necesita `buyStoreItem` para no cobrar. Son la misma
 * pregunta, y por eso vive aquí: con dos copias, el botón se deshabilitaba para
 * algo que la compra sí dejaba pasar.
 *
 * Y una ranura es una PILA, no una unidad: 19 llaves ocupa la misma ranura que
 * una. La pregunta no es "¿quedan ranuras?" sino "¿cabe ESTE item?". Preguntar
 * solo por el fullness rechazaba comprar una caja con el almacén lleno, aunque
 * se fuera a sumar a la pila de cajas que ya había.
 */
function cabeLaCompra(itemKey: string): boolean {
  if (NO_OCUPA_RANURA.includes(itemKey)) return true;
  return cabeEnAlmacen(previewStoreItem(itemKey));
}

/**
 * El nivel de llave y de cristal que entrega la TIENDA.
 *
 * Vive aquí y no en los dos sitios que lo necesitan porque es exactamente la
 * clase de dato que se duplica sin que nadie se entere: `previewStoreItem`
 * anunciaba nivel 0 mientras `buyStoreItem` creaba nivel 1. Con eso, un jugador
 * con el almacén lleno y una pila de "Llave de Cifrado" veía el botón de
 * comprar llave encendido —porque la preview encontraba su pila— y al pulsarlo
 * la compra fallaba, porque lo que de verdad se crea es una "Llave Reforzada",
 * que necesita ranura nueva. Botón y cargo discrepando (R3).
 *
 * El nivel 1 de `STORE_MATERIAL_TIER` ya no afecta a las llaves: cada carta
 * `keyT0`..`keyT3` lleva el suyo (B7). La constante se queda para el cristal de
 * mejora, que es el único material que sigue siendo de un solo nivel.
 */
const STORE_MATERIAL_TIER = 1;

/**
 * Cómo se llamaría y de qué tipo sería el item de una compra, sin crearlo.
 *
 * La comprobación de "¿queda hueco?" va ANTES de cobrar, así que no puede
 * llamar a los generadores: `generateCollectorByTier` y compañía gastan un id
 * único y habría que tirar el item solo por mirarlo. Y no hace falta: para
 * decidir si algo se funde con una pila basta su tipo y su nombre, que es
 * justamente lo único que mira `pilaPara`.
 *
 * Devuelve null para las compras que no meten nada en el almacén (ampliaciones y
 * huecos), que no ocupan ranura por ser permisos.
 */
function previewStoreItem(itemKey: string): any {
  // El nivel de la llave sale de la carta, igual que en `buyStoreItem`. Con
  // `STORE_MATERIAL_TIER` fijo aquí, la preview anunciaba nivel 0 mientras la
  // compra creaba nivel 1: botón encendido y compra rechazada (R3).
  if (STORE_KEY_TIER[itemKey] !== undefined) {
    return { type: 'key', name: KEY_DEFS[STORE_KEY_TIER[itemKey]].name, stackable: true };
  }
  if (itemKey === 'upgradeCrystal') return { type: 'crystal', name: CRYSTAL_DEFS[STORE_MATERIAL_TIER].name, stackable: true };
  if (itemKey.endsWith('Crate') && CRATE_TYPES[itemKey.replace('Crate', '').toLowerCase() as CrateType]) {
    const t = itemKey.replace('Crate', '').toLowerCase() as CrateType;
    return { type: 'crate', name: CRATE_TYPES[t].name, stackable: true };
  }
  const consumable = CONSUMABLES[itemKey as keyof typeof CONSUMABLES];
  if (consumable) return { type: 'consumable', name: consumable.name, stackable: true };
  if (itemKey.startsWith('companionCardT')) return { type: 'companion' };
  if (itemKey.startsWith('collectorCardT')) return { type: 'collector' };
  return null;
}

/**
 * Quita una cantidad de un item del almacén.
 *
 * Es la ÚNICA forma de consumir un item, y por eso vive aquí y no repartida
 * entre las vistas. El bug que arreglar era precisamente ese: cada pantalla
 * mutaba `state.warehouse` por su cuenta con su propia idea de cómo restar una
 * unidad, y después no recalculaba los contadores derivados.
 *
 * Si el item es apilable y le quedan unidades, baja el contador; si se acaba,
 * desaparece del array. Devuelve cuántas unidades quedan, o 0 si no estaba.
 */
function consumeWarehouseItem(itemId: string, amount = 1): number {
  const idx = state.warehouse.findIndex((w: any) => w.id === itemId);
  if (idx < 0) return 0;

  const item = state.warehouse[idx];

  if (item.stackable && (item.stackCount || 1) > amount) {
    item.stackCount = (item.stackCount || 1) - amount;
    return item.stackCount;
  }

  state.warehouse.splice(idx, 1);
  return 0;
}

/**
 * Añade N llaves o N cristales del nivel indicado.
 *
 * Si el almacén tiene hueco se mete un item apilado; si está lleno, el botín
 * se pierde. Se avisa por consola porque es el momento donde el jugador pierde
 * algo sin haberlo decidido, y no hay dónde ponerlo en un aviso en pantalla.
 */
function grantKeys(tier: KeyTier, amount: number) {
  grantMaterial('key', tier, amount);
}

function grantCrystals(tier: number, amount: number) {
  grantMaterial('crystal', tier, amount);
}

/**
 * Desbloquea un cosmético. Idempotente: `false` si ya lo tenía.
 *
 * Vive a nivel de módulo, y no como método suelto del objeto del juego, porque
 * lo necesitan dos sitios: el método público `unlockCosmetic` y el `applier` que
 * `openCrateBox` pasa al sorteo de las cajas. Dentro de un objeto, un hermano no
 * se ve a otro por su nombre: habría que escribir `this.unlockCosmetic`, y
 * `this` no existe dentro de una función que se pasa como callback. Con la
 * función aparte, los dos caminos llaman a la misma y no pueden divergir.
 */
function desbloquearCosmetico(cosmeticId: string): boolean {
  if (state.cosmetics.unlocked.includes(cosmeticId)) return false;
  state.cosmetics.unlocked.push(cosmeticId);
  return true;
}

function grantMaterial(kind: 'key' | 'crystal', tier: number, amount: number) {
  if (amount <= 0) return;

  const item = createMaterialItem(kind, tier);
  item.stackCount = amount;

  if (!addToWarehouse(item)) {
    console.warn('[inventario] Sin hueco en el almacén: se pierden ' + amount + ' x ' + kind + ' T' + tier + '.');
  }
}

/**
 * Crea un item de llave o cristal listo para el almacén.
 *
 * Los tres viven aquí y no en `data/items.ts` porque necesitan un id único y
 * un precio de reventa, y el precio depende de `STORE_ITEMS`, que está en este
 * archivo. La tabla de niveles y probabilidades sí está en `data/items.ts`.
 */
function createMaterialItem(kind: 'key' | 'crystal', tier: number): any {
  const esLlave = kind === 'key';
  const def = esLlave ? KEY_DEFS[tier as KeyTier] : CRYSTAL_DEFS[tier];
  const prefijo = esLlave ? 'key' : 'crystal';
  const sellPrice = precioReventaMaterial(kind, tier);

  return {
    id: `${prefijo}_t${tier}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: def.name,
    type: esLlave ? 'key' : 'crystal',
    details: def.details,
    rarity: def.rarity,
    // El nivel viaja en el item para poder ordenar y filtrar sin releer el
    // nombre. Las partidas viejas no lo tienen: se rellena al migrar.
    tier,
    sellPrice,
    stackable: true,
    stackCount: 1
  };
}

/**
 * Lo que se recupera al vender una llave o un cristal.
 *
 * Una cuarta parte del precio de la carta de la tienda, que es la MISMA cuenta
 * que ya usan las cajas, los consumibles y las cartas de compañero y recolector
 * (`Math.floor(cost / 4)`). Material, cajas y consumibles son lo mismo: cosas
 * que se gastan. Por eso comparten la regla, y por eso comprar y vender nunca
 * sale rentable.
 *
 * POR QUÉ NO SALE DE `KEY_DEFS` NI DE `CRYSTAL_DEFS`, QUE ES DONDE ESTÁN LOS
 * PRECIOS. Porque en esas tablas `cost` es `null` para todo lo que no se vende
 * en la tienda, y el material que suelta una caja es justo eso. Con un número
 * inventado en el `??` pasaba esto:
 *
 *   - Llave comprada por 250, revendida por 1.200.  +950 por operación.
 *   - Cristal comprado por 60, revendido por 4.320.  +4.260 por operación.
 *
 * Ninguno de los dos es un desajuste de balance: es una máquina de imprimir
 * nanitas comprando y vendiendo en bucle, sin límite y sin ganar nada. Y ningún
 * banco lo veía, porque `buyCheck` comprueba que el botón y el cargo coincidan —
 * que es otra cosa— y no que vender un item sea una pérdida.
 *
 * El precio de venta tampoco sale de aquí, y a propósito: el juego ya sabe lo
 * que el jugador pagó, porque lo acaba de restar. Lo que no puede saber es de
 * dónde vino un item que no compró, y por eso la reventa es una propiedad del
 * item y no un recuerdo de su procedencia. Una llave de la tienda y una llave de
 * una caja son el mismo objeto y valen lo mismo al venderlo.
 */
function precioReventaMaterial(kind: 'key' | 'crystal', tier: number): number {
  // La reventa sale del precio DEL NIVEL. Antes el cálculo usaba el precio de la
  // carta de llave, que era uno solo para las cuatro; con cuatro llaves distintas
  // eso cobra cuatro veces el mismo cuarto y se convierte en la máquina de
  // imprimir nanitas que este comentario lleva tres versiones avisando.
  const precio = kind === 'key'
    ? KEY_DEFS[(tier ?? 0) as KeyTier].cost
    : STORE_ITEMS.upgradeCrystal.cost;
  if (!precio) return 0;
  return Math.floor(precio / 4);
}

/**
 * Cuenta el almacén por tipo de material y reconstruye los contadores.
 *
 * Los contadores `state.keys` y `state.upgradeCrystals` ya no son la fuente de
 * verdad —lo es el almacén—, pero se siguen manteniendo porque el árbol de
 * pasivas y las compras los leen, y porque las partidas viejas los traen.
 *
 * Convivir con un valor desincronizado es exactamente el bug que había con las
 * cajas, así que aquí NO hay conversión de "huérfanos a items": si el contador
 * dice más de lo que hay en el almacén, se ajusta el contador. El almacén gana
 * siempre.
 */
function syncMaterialCounters() {
  const keyByTier: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const crystalByTier: Record<number, number> = {};
  let crystalTotal = 0;

  state.warehouse.forEach((w: any) => {
    if (w.type === 'key') {
      const t = typeof w.tier === 'number' ? w.tier : keyTierFromName(w.name || '');
      keyByTier[t] = (keyByTier[t] || 0) + (w.stackCount || 1);
    } else if (w.type === 'crystal') {
      const t = typeof w.tier === 'number' ? w.tier : 1;
      crystalByTier[t] = (crystalByTier[t] || 0) + (w.stackCount || 1);
      crystalTotal += (w.stackCount || 1);
    }
  });

  state.keys = keyByTier[0] + keyByTier[1] + keyByTier[2] + keyByTier[3];
  state.keysByTier = keyByTier;
  state.crystalsByTier = crystalByTier;

  // El cristal básico es el único que se compra, así que es el que se gasta en
  // las sintonizaciones: los superiores son de premio y el jugador elige.
  state.upgradeCrystals = crystalByTier[1] || 0;
  state.crystalTotal = crystalTotal;

  // Rellena el campo `tier` de los items guardados antes de que existiera.
  state.warehouse.forEach((w: any) => {
    if (w.type === 'key' && typeof w.tier !== 'number') w.tier = keyTierFromName(w.name || '');
    if (w.type === 'crystal' && typeof w.tier !== 'number') w.tier = crystalPowerFromName(w.name || '') === 1 ? 1 : 2;
  });
}

  let isAfk = false;
  let lastActiveTimestamp = Date.now();
  // Momento (reloj monótono) en que el jugador dejó de estar presente en la pantalla.
  // 0 = está presente. Se usa performance.now() porque no lo afecta cambiar la
  // hora del sistema, a diferencia de Date.now().
  let awayAt = 0;
  // B9 · 60 SEGUNDOS, Y POR QUÉ NO 45.
//
// El umbral era 45 s y el jugador pidió "1 min al menos". Se sube a 60 s porque
// hay un caso que 45 rompe: alguien leyendo la descripción de una caja larga, o
// un texto de logro, pasa de 45 a 60 s sin hacer nada y volvería a la pantalla
// con el ingreso cortado a mitad de lectura. El coste de esperar 60 en vez de 45
// son 15 segundos de ingreso pasivo; el de 45 es que el jugador pierde la partida
// mientras lee.
//
// Y es un umbral de tiempo **mirando la pantalla**, no de tiempo total: en el
// tiempo que pasa el AFK el ingreso se corta (R10), así que la espera no le
// cuesta nada mientras no mire.
const AFK_THRESHOLD_MS = 60000;

  const userRef = doc(db, 'users', user.uid);
  const rankingRef = doc(db, 'rankings', user.uid);

  /**
   * El último guardado falló.
   *
   * Se usa para avisar UNA vez, no en cada intento. Un `setDoc` sin red reintenta
   * durante unos diez segundos antes de rendirse, y el intervalo de guardado es
   * de quince: sin este flag, una desconexión de un minuto llenaba la pantalla de
   * avisos idénticos superpuestos, tapando el juego.
   */
  let guardadoFallando = false;

  /**
   * Enciende o apaga el aviso de "sin guardar".
   *
   * No es decoración. Con esta cola, "el número que veo no está en el servidor"
   * pasa a ser una situación real y constante, y el jugador no tiene forma de
   * saberlo: el contador sigue subiendo igual de contento. Un indicador que se
   * enciende al perder la conexión y se apaga al recuperarla convierte la
   * incertidumbre en un dato.
   */
  function marcarPendiente(pendiente: boolean) {
    // Lo que se comprueba es `querySelector`, NO `document`. Preguntar por
    // `document` era mirar en el sitio equivocado: un banco de pruebas puede
    // definir `document` a medias, sin `querySelector`, y entonces la guarda
    // pasaba y la llamada reventaba. Y reventaba en el sitio peor: `pendingWasFlushed`
    // la llama DESPUÉS de un guardado correcto, así que el `TypeError` caía en el
    // `catch` que estaba avisando de un fallo de red, y el aviso sale mezclado:
    // "Error al guardar en Firebase: document.querySelector is not a function".
    // Un guardado que funcionaba, anunciado como perdido.
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
    const el = document.querySelector('#pending-save-indicator');
    if (!el) return;
    el.classList.toggle('hidden', !pendiente);
  }

  /**
   * El servidor se quedó con el saldo: se avisa y se baja el contador de fallos.
   *
   * Sin este aviso, el jugador que pasó un rato sin red ve como su saldo "de
   * repente" deja de crecer en el servidor y no entiende por qué. Con él, la
   * desconexión tiene final y se siente resuelta en vez de abandonada.
   */
  function pendingWasFlushed() {
    marcarPendiente(false);
    if (!guardadoFallando) return;
    guardadoFallando = false;
    showToast('Guardado. Tu progreso ya está en la nube.', 'success');
  }

  try {
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // La versión que TRAJO el documento, no la que va a salir de aquí. Es lo
      // único que distingue "partida vieja" de "partida ya migrada", y evita que
      // una migración sea idempotente por casualidad y no por decisión.
      const savedVersion = typeof data.saveVersion === 'number' ? data.saveVersion : 0;
      state.saveVersion = SAVE_VERSION;
      state.nanites = data.nanites ?? 0;
      state.totalNanitesProduced = data.totalNanitesProduced ?? data.nanites ?? 0;
      state.totalClicks = data.totalClicks ?? 0;
      state.unlockedAchievements = data.unlockedAchievements ?? [];
      state.totalInfraestructure = data.totalInfraestructure ?? 0;
      state.cratesOpened = data.cratesOpened ?? 0;
      state.keys = data.keys ?? 3;
      state.upgradeCrystals = data.upgradeCrystals ?? 5;
      state.warehouseCapacity = data.warehouseCapacity ?? 15;
      state.maxCompanionSlots = data.maxCompanionSlots ?? 1;
      state.crates = {
        common: data.crates?.common ?? 2,
        rare: data.crates?.rare ?? 0,
        epic: data.crates?.epic ?? 0,
        legendary: data.crates?.legendary ?? 0
      };
      state.equippedCollectorId = data.equippedCollectorId ?? null;
      state.companions = data.companions ?? [];
      state.activeCompanions = data.activeCompanions ?? [];
      state.warehouse = data.warehouse ?? [];
      // Huecos de disposición. Un guardado viejo no trae el campo, y uno
      // manipulado puede traer cualquier cosa, así que se coacciona a una lista
      // de ids que existen de verdad en el almacén: un hueco anclado a un item
      // que no está no tiene dónde pintarse y solo ensuciaría el recuento.
      state.warehouseGaps = Array.isArray(data.warehouseGaps)
        ? data.warehouseGaps.filter((id: any): id is string =>
          typeof id === 'string' && state.warehouse.some((w: any) => w.id === id))
        : [];
      // Migración: agregar 'damage' y actualizar descripción a recolectores viejas
      let warehouseNeedsMigration = false;

      /**
       * Renombre de 'weapon' a 'collector'. Va PRIMERO, antes de cualquier otra
       * migración, porque todas las de abajo decide si tocan un item mirando su
       * `type`: con el tipo viejo no se reconocían ni como recolectores y se
       * pasaban de largo sin arreglar nada.
       *
       * El id del recolector equipado se renombró a la vez. Sin adoptarlo,
       * quien lo tenía puesto se lo perdía en silencio: `equippedWeaponId` no lo
       * leía nadie y el click se quedaba a cero.
       *
       * Se aplica solo al cruzar de la versión 6 a la 7. No por miedo a repetirla
       * —es idempotente— sino porque `equippedWeaponId` se queda en el documento
       * para siempre: `setDoc` con `merge: true` no borra las claves que ya no
       * se envían. Si se leyera siempre, desequipar en la versión 7 no serviría
       * de nada, porque al siguiente arranque el id viejo volvería a equipar el
       * recolector que el jugador acababa de quitar.
       */
      if (savedVersion < 7) {
        if (migrateItemTypes(state.warehouse)) warehouseNeedsMigration = true;
        if (!state.equippedCollectorId && typeof data.equippedWeaponId === 'string') {
          state.equippedCollectorId = data.equippedWeaponId;
          warehouseNeedsMigration = true;
        }
      }

      // El id equipado y la bandera `equipped` son la misma información en dos
      // sitios. Se pone de acuerdo antes de que nada la lea: el cálculo de daño
      // usa el id y la rejilla usa la bandera, así que discrepar se ve como un
      // item equipado que no hace nada o como un "Desequipar" que no desequipa.
      const equipado = reconcileEquippedCollector(state.warehouse, state.equippedCollectorId);
      state.equippedCollectorId = equipado.id;
      if (equipado.changed) warehouseNeedsMigration = true;

      state.warehouse.forEach((w: any) => {
        if (w.type === 'collector') {
          if (w.damage === undefined) {
            const tier = w.tier || 1;
            const range = TIER_SYSTEM.ranges[tier as keyof typeof TIER_SYSTEM.ranges] || [1, 5];
            w.damage = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
            warehouseNeedsMigration = true;
          }
          // Actualizar descripción al nuevo formato
          const expectedDetails = `Recolección por click: +${w.damage}`;
          if (w.details !== expectedDetails) {
            w.details = expectedDetails;
            warehouseNeedsMigration = true;
          }
        }
        // Migración: consumibles antiguos sin buffId (creados antes de existir el campo)
        if (w.type === 'consumable' && !w.buffId) {
          const buffId = inferBuffIdFromName(w.name || '');
          if (buffId) {
            w.buffId = buffId;
            warehouseNeedsMigration = true;
          }
        }
        // El nivel de llave y de cristal no existía antes. Sin él no se puede
        // saber qué cofre abre cada llave ni cuánto mejora cada cristal, así que
        // se deduce del nombre una sola vez.
        if ((w.type === 'key' || w.type === 'crystal') && typeof w.tier !== 'number') {
          w.tier = w.type === 'key'
            ? keyTierFromName(w.name || '')
            : (crystalPowerFromName(w.name || '') === 1 ? 1 : 2);
          warehouseNeedsMigration = true;
        }
      });

      /**
       * MIGRACIÓN: contadores de llaves y cristales a items del almacén.
       *
       * Antes eran contadores sueltos. Si el contador dice 7 llaves y el almacén
       * está vacío, esas 7 llaves existen en la partida y hay que
       * materializarlas: si no, el jugador las pierde en el guardado siguiente,
       * cuando `syncMaterialCounters` ajustaría el contador a cero.
       *
       * Aquí se hace al revés que con las cajas, a propósito. Con las cajas el
       * almacén era la fuente y el contador podía quedar inflado, así que se
       * ajustaba el contador. Con las llaves el saldo es real y no se puede
       * volver a contarlo, porque detrás no hay ningún item.
       *
       * Llaves y cristales se materializan con la MISMA función, y ya no puede
       * ser de otra manera: las llaves se guardaban de una en una, una ranura
       * por llave, y los cristales de golpe en una sola pila. Un jugador con 19
       * llaves de Cifrado tenía 19 ranuras ocupadas por un item que la rejilla
       * pintaba en una sola celda.
       */
      let materialNeedsMigration = false;

      /**
       * Cuántas unidades de un material HAY ya en el almacén, por nivel.
       *
       * Es lo que hace que esta migración no se ejecute en cada arranque. La
       * migración es para partidas viejas, donde el contador era un número suelto
       * sin ningún item detrás. En una partida que YA tiene items de llave, el
       * contador y el almacén dicen lo mismo, y materializar el contador entero
       * cada vez que se carga metía un item más por unidad: recargar la página
       * duplicaba las llaves, y a la tercera recarga el almacén estaba lleno de
       * llaves que el jugador nunca pidió. Con los cristales, igual.
       *
       * Lo que hay que materializar es la DIFERENCIA entre lo que promete el
       * contador y lo que ya está: los huérfanos. El bucle de arriba acaba de
       * resolver el `tier` de los items viejos, así que aquí ya se puede contar.
       */
      const yaEnAlmacen = (kind: 'key' | 'crystal', tier: number): number => {
        let total = 0;
        for (const w of state.warehouse as any[]) {
          if (w.type !== kind) continue;
          const t = typeof w.tier === 'number'
            ? w.tier
            : kind === 'key' ? keyTierFromName(w.name || '') : (crystalPowerFromName(w.name || '') === 1 ? 1 : 2);
          if (t !== tier) continue;
          total += w.stackable ? (w.stackCount || 1) : 1;
        }
        return total;
      };

      const meterMaterial = (kind: 'key' | 'crystal', tier: number, cantidad: number) => {
        const huerfanos = Math.max(0, cantidad - yaEnAlmacen(kind, tier));
        if (huerfanos <= 0) return;
        const item = createMaterialItem(kind, tier);
        item.stackCount = huerfanos;
        // `addToWarehouse` y no `push`: las huerfanas van a la pila de llaves que
        // ya hubiera, y solo abren una nueva si de verdad no cabe en ninguna.
        if (!addToWarehouse(item)) return;
        materialNeedsMigration = true;
      };
      // `data.keys` es el TOTAL de llaves del guardado, no las de nivel 0. Pasar
      // ese total al nivel 0 y luego restar lo que hay en el nivel 0 compara un
      // total contra una parte, y siempre sobra: con una llave de nivel 1 en el
      // almacén —que es justo la que crea la tienda, aunque se venda como "Llave
      // de Cifrado"— la resta daba 0 y se materializaba una llave de nivel 0 de
      // más en cada recarga. El nivel 0 usa su propio cubo cuando el guardado lo
      // trae, y el total solo como reserva para las partidas viejas, que no
      // tenían cubos.
      meterMaterial('key', 0, data.keysByTier ? (data.keysByTier[0] ?? 0) : (data.keys ?? 3));
      meterMaterial('key', 1, data.keysByTier?.[1] ?? 0);
      meterMaterial('key', 2, data.keysByTier?.[2] ?? 0);
      meterMaterial('key', 3, data.keysByTier?.[3] ?? 0);

      meterMaterial('crystal', 1, data.upgradeCrystals ?? 5);
      meterMaterial('crystal', 2, data.crystalsByTier?.[2] ?? 0);
      meterMaterial('crystal', 3, data.crystalsByTier?.[3] ?? 0);
      meterMaterial('crystal', 4, data.crystalsByTier?.[4] ?? 0);
      if (materialNeedsMigration) warehouseNeedsMigration = true;

      /**
       * MIGRACIÓN: fusionar las pilas repetidas de las partidas ya jugadas.
       *
       * Cada botín de llave, cristal, caja o consumible se guardaba como un item
       * NUEVO en vez de sumar sus unidades a la pila que ya había. Una partida
       * con 19 llaves de Cifrado tenía 19 entradas: la rejilla las agrupaba en
       * una celda con un "19" y el contador pedía 19 ranuras por ellas. El
       * almacén se llenaba de botín que el jugador nunca había decidido guardar.
       *
       * Esas entradas pasan aquí a ser una sola pila con `stackCount: 19`, que
       * es exactamente lo que el jugador ya veía en la celda. No se pierde
       * ninguna unidad: se suman, y `syncMaterialCounters` sigue leyendo el
       * mismo total de llaves.
       *
       * Va DESPUÉS de materializar los contadores, no antes. `addToWarehouse` ya
       * suma a la pila existente, así que fusionar antes sería deshacer lo que
       * la migración acaba de apilar.
       */
      const fusionado = mergeStacks(state.warehouse);
      if (fusionado.changed) {
        state.warehouse = fusionado.items;
        warehouseNeedsMigration = true;
      }

      state.afkCards = data.afkCards ?? 0;
      state.afkExpiresAt = data.afkExpiresAt ?? 0;
      // --- Prestige y cosméticos ---
      state.cores = data.cores ?? 0;
      state.totalCores = data.totalCores ?? 0;
      state.resets = data.resets ?? 0;
      state.unlockedNodes = data.unlockedNodes ?? [];
      state.nodeLevels = data.nodeLevels ?? {};
      state.shards = data.shards ?? 0;
      state.forgedCount = data.forgedCount ?? 0;
      state.cosmetics = {
        title: data.cosmetics?.title ?? 'title_default',
        frame: data.cosmetics?.frame ?? 'frame_none',
        banner: data.cosmetics?.banner ?? 'banner_none',
        // Los tres por defecto siempre están disponibles aunque el save sea viejo
        unlocked: Array.from(new Set([
          'title_default', 'frame_none', 'banner_none',
          ...(data.cosmetics?.unlocked ?? [])
        ]))
      };
      // `totalCores` no venía en las partidas anteriores a la librería de
      // reinicios, así que hay que reconstruirlo.
      //
      // SOLO si el jugador ya recicló alguna vez. Con `resets === 0` el
      // histórico es cero por definición —nadie ha ganado ningún núcleo todavía—
      // y rellenar lo dejaba en un valor que nadie había ganado. El efecto era
      // que `nextCores` restaba ese histórico fantasma y el primer Ascenso, con
      // 1 M de producción, no daba ni un núcleo: el juego pedía 3,17 M y ninguna
      // pantalla decía por qué.
      //
      // Con `resets > 0` el valor es una estimación y no un hecho, porque las
      // partidas viejas no dejaron el dato. Se acepta el riesgo: perder el
      // histórico sería peor que estimarlo, y en cuanto el jugador recicle una
      // vez más el contador ya es real.
      if (!data.totalCores && (data.resets ?? 0) > 0) {
        state.totalCores = pendingCores(state.totalNanitesProduced);
      }
      state.buffs = {
        clickBoostExpiresAt: data.buffs?.clickBoostExpiresAt ?? 0,
        passiveBoostExpiresAt: data.buffs?.passiveBoostExpiresAt ?? 0,
        clickX2ExpiresAt: data.buffs?.clickX2ExpiresAt ?? 0,
        clickX3ExpiresAt: data.buffs?.clickX3ExpiresAt ?? 0
      };

      /**
       * COLA DE LA SESIÓN ANTERIOR.
       *
       * Va AQUÍ, al final de la carga, y no donde se leen las nanitas. Cada
       * bloque de arriba rellena su parte del estado desde el documento, así
       * que aplicar la cola a mitad de carga garantiza que algo la pise después:
       * los núcleos se leen treinta líneas más abajo y dejaban a cero los que
       * el prestige había pagado, que es justo lo que la cola existe para
       * evitar.
       *
       * La regla NO es "si hay algo pendiente, súmalo". Es "usa lo que sea más
       * nuevo, y solo eso". La diferencia no es de estilo: el reinicio de
       * prestigio pone el saldo a cero, y una cola que se sumara sin más
       * devolvería ese dinero después de reiniciar — con el agravante de que el
       * jugador conservaría los núcleos, y se podría repetir sin límite.
       *
       * El documento trae `updatedAt` y la cola trae su propia marca. Se
       * comparan y gana la más reciente:
       *
       *   · Gana la cola → el último guardado no llegó (o hubo un reinicio que
       *     tampoco llegó). Se adopta entero, incluido si vale cero.
       *   · Gana el documento → otro dispositivo del jugador ha seguido jugando
       *     más tarde, o la cola es de una sesión vieja. Se descarta entera, y
       *     no se mezclan: quedarse con el mayor de los dos produciría saldos
       *     que ninguna de las dos sesiones vio nunca.
       */
      const cola = leerCola(user.uid);
      if (cola.existe) {
        if (cola.ts > aMilis(data.updatedAt)) {
          const diferencia = cola.nanites - state.nanites;
          state.nanites = cola.nanites;
          // El histórico y los clics se adoptan tal cual, sin máximo. Si la
          // cola es la más nueva, sus valores son los buenos; aplicar un
          // `Math.max` dejaría subir un reinicio de prestigio que los dejó a
          // cero a propósito.
          state.totalNanitesProduced = cola.producidas;
          state.totalClicks = cola.clics;

          // Y los núcleos, que son el otro lado del reinicio.
          //
          // El prestige PAGA con núcleos y borra las nanitas. Si un jugador lo
          // hace sin conexión y cierra la pestaña, sin esto vuelve con el saldo
          // a cero —correcto— y sin los núcleos: se había reiniciado para nada.
          // Es lo más caro que puede perder la cola, porque el prestige es la
          // partida entera.
          state.cores = cola.nucleos;
          state.totalCores = cola.totalNucleos;
          state.resets = cola.reinicios;

          if (diferencia > 0) {
            console.info('[cola] Recuperadas ' + formatNumber(diferencia) + ' nanitas sin confirmar.');
            showToast(
              'Recuperadas ' + formatNumber(diferencia) + ' nanitas que no se habían guardado.',
              'success'
            );
          } else if (diferencia < 0) {
            // El caso del reinicio: el servidor tenía más de lo que este
            // dispositivo vio. No es una pérdida, es una operación que sí se
            // quiere conservar.
            console.info('[cola] Adoptado un saldo más bajo (' + formatNumber(diferencia) + ').');
          }
        } else {
          console.info('[cola] Descartada: el documento del servidor es más reciente.');
          // También con `confirmarCola`: el documento manda sobre ESTE registro,
          // pero si mientras se comparaba se anotó otro más nuevo, ese no se
          // descarta por la razón anterior. El documento no es más reciente que
          // lo que se acaba de escribir.
          confirmarCola(cola.ts);
        }
      }

      // EL GUARDADO DE LA MIGRACIÓN, AQUÍ Y NO ANTES.
      //
      // Estaba unas treinta líneas más arriba, junto al resto de migraciones, y
      // eso lo convertía en un destructor: `setDoc` con `merge: true` escribe
      // `cores: state.cores`, y en ese punto los núcleos todavía no se habían
      // leído del documento, así que valían 0. Una partida con un item que
      // necesitaba migración (un `weapon` viejo, una llave sin nivel, una pila
      // por fusionar) perdía los núcleos y el contador de reinicios en CADA
      // arranque, de forma silenciosa: el documento se sobrescribía a cero con
      // datos que sí estaban bien.
      //
      // Solo se nota con un almacén no vacío, y por eso llevaba tanto tiempo
      // escondido: una partida nueva no dispara migraciones.
      //
      // Va DESPUÉS de la cola, y no antes, por un motivo que se solapa con el
      // suyo: si la migración guardara antes de aplicar la cola, escribiría el
      // saldo viejo del servidor por encima del que el jugador tenía en
      // pantalla, y la cola quedaría desfasada para siempre.
      if (warehouseNeedsMigration) {
        saveToFirebase();
      }

      recalculatePassiveIncome();
    } else {
      // Crear documento del usuario
      await setDoc(userRef, {
        saveVersion: SAVE_VERSION,
        userId: user.uid,
        username: displayName,
        nanites: state.nanites,
        totalNanitesProduced: state.totalNanitesProduced,
        totalClicks: 0,
        totalInfraestructure: 0,
        cratesOpened: 0,
        keys: state.keys,
        // Los cubos por nivel TIENEN que guardarse, y antes no se guardaban. Al
        // cargar, la migración reparte el material con `data.keysByTier`: `data.keys`
        // es el TOTAL de llaves, y meter un total en el cubo del nivel 0 compara un
        // total contra una parte y siempre sobra, así que en CADA recarga se
        // materializaba una llave y un cristal de más. El reparto por niveles solo
        // vivía mientras la partida no se recargara, que es justo cuando no sirve.
        keysByTier: state.keysByTier,
        crystalsByTier: state.crystalsByTier,
        upgradeCrystals: state.upgradeCrystals,
        warehouseCapacity: state.warehouseCapacity,
        maxCompanionSlots: state.maxCompanionSlots,
        afkCards: state.afkCards,
        afkExpiresAt: state.afkExpiresAt,
        crates: state.crates,
        equippedCollectorId: state.equippedCollectorId,
        companions: state.companions,
        activeCompanions: state.activeCompanions,
        warehouse: state.warehouse,
        warehouseGaps: state.warehouseGaps,
        buffs: state.buffs,
        unlockedAchievements: state.unlockedAchievements,
        cores: state.cores,
        totalCores: state.totalCores,
        resets: state.resets,
        unlockedNodes: state.unlockedNodes,
        nodeLevels: state.nodeLevels,
        shards: state.shards,
        forgedCount: state.forgedCount,
        cosmetics: state.cosmetics,
        updatedAt: new Date()
      });
      // Crear documento de ranking
      await setDoc(rankingRef, {
        userId: user.uid,
        username: user.displayName || 'Operativo',
        score: state.nanites,
        totalClicks: 0,
        achievements: 0,
        secretAchievements: 0,
        forgedCount: 0,
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error("Error al sincronizar con Firebase:", error);
  }

  function syncCompanionsToWarehouse() {
    // Asegurar que todos los compañeros tengan un item correspondiente en el warehouse
    state.companions.forEach((comp: any) => {
      const exists = state.warehouse.some((w: any) => w.id === comp.id);
      if (!exists && countOccupiedSlots(state.warehouse) < effectiveWarehouseCapacity()) {
        state.warehouse.push({
          id: comp.id,
          name: comp.name,
          type: 'companion',
          details: `Recolección por segundo: +${comp.power}/s`,
          rarity: comp.rarity,
          sellPrice: comp.rarity === 'Común' ? 100 : comp.rarity === 'Raro' ? 500 : comp.rarity === 'Épico' ? 2000 : 10000
        } as any);
      }
    });
    enforceWarehouseCapacity();
  }

  /**
   * Forget the gaps anchored to items that are no longer in the warehouse.
   *
   * A gap lives in the VIEW, not in the array: `warehouseGaps` is the list of
   * ids that have a hole painted right before them. The array itself stays
   * packed, so a hole can never be sold, moved or counted as a slot — which is
   * exactly why this cleanup is all it needs. If an item leaves the warehouse
   * (sold, consumed, recycled by a prestige) its gap has nothing to be painted
   * in front of, so it goes with it. Anything left dangling would be a hole
   * that reappears somewhere the player never asked for as soon as an item with
   * that id showed up again.
   *
   * Called from every path that removes an item. Cheap: it only walks a handful
   * of ids, not the whole warehouse.
   */
  function syncWarehouseGaps() {
    const limpio = normalizaGaps(state.warehouseGaps);
    if (limpio.join(',') !== (state.warehouseGaps || []).join(',')) {
      state.warehouseGaps = limpio;
    }
  }

  /**
   * Limpia la lista de huecos: solo ids que existen en el almacen, y sin pasar
   * de un tope de seguridad.
   *
   * POR QUE NO HAY UN TOPE DE "UN HUECO POR CELDA". Se puso ese limite, y hacia
   * justo lo contrario de lo que el jugador pide: con 3 celdas ocupadas y 18
   * libres, solo dejaba mover un item hasta la celda 5, cuando las 18 celdas
   * vacias son sitios tan validos como las ocupadas. El limite de verdad no es
   * este: es el TABLERO, y lo calcula la vista (`totalCeldasPintadas`), que es la
   * unica que sabe cuantas celdas se dibujan. Por arrastre nunca se pasa de ahi.
   *
   * Lo que queda aqui es un cortafuegos contra un documento manipulado: si
   * alguien edita la partida y mete 100.000 celdas de hueco, aqui se recorta.
   * El recorte no pierde nada —cada hueco es una celda vacia de adorno— pero
   * evita pintar una rejilla gigante.
   */
  function normalizaGaps(ids: any): string[] {
    if (!Array.isArray(ids)) return [];
    const existentes = new Set(state.warehouse.map((w: any) => w.id));
    const salida: string[] = [];
    for (const id of ids) {
      if (typeof id !== 'string' || !existentes.has(id)) continue;
      salida.push(id);
      if (salida.length >= TOPE_CELDAS_HUECO) break;
    }
    return salida;
  }

  /**
   * Deja las celdas de hueco indicadas, una por repetición de id.
   *
   * `ids` es la lista COMPLETA, no una operación de "añadir": quien llama es la
   * vista, que es la única que sabe qué hueco se está moviendo al soltar un item
   * dentro de otro. El juego solo guarda y limpia, igual que con el orden: la
   * disposición es del jugador, no del juego.
   *
   * LA MULTIPLICIDAD ES EL CONTENIDO. Un hueco puede ocupar varias celdas seguidas
   * y eso se cuenta con repeticiones: `['b','b','c']` son dos celdas vacías antes
   * de `b` y una antes de `c`. Por eso aquí NO se deduplica con un `Set` —que
   * fundiría las repeticiones en una y dejaría al item a la izquierda de donde se
   * soltó—, y por eso la lista se guarda tal cual, en orden.
   *
   * Un hueco NO es una ranura. No cuenta para `warehouse.length`, no bloquea una
   * compra y no se puede vender: solo desplaza lo que se ve. Por eso el array
   * sigue empaquetado y por eso esta función no toca `state.warehouse`.
   */
  function setWarehouseGaps(ids: string[]): boolean {
    const limpio = normalizaGaps(ids);
    const antes = (state.warehouseGaps || []).join(',');
    state.warehouseGaps = limpio;
    if (antes === limpio.join(',')) return false;
    saveToFirebase();
    return true;
  }

  /**
   * Recorta el almacén respetando una prioridad. Antes se hacía
   * `slice(0, capacity)`, que destruía el último item de la lista sin aviso y
   * podía borrar el recolector equipado o un compañero activo.
   *
   * Prioridad de conservación:-inducing el recolector equipado, los compañeros activos
   * y los companions con item. Lo que se descarta es lo más reciente y menos
   * ligado a la progresión.
   */
  function enforceWarehouseCapacity() {
    const capacity = effectiveWarehouseCapacity();
    if (countOccupiedSlots(state.warehouse) <= capacity) return;

    const score = (w: any): number => {
      if (w.id === state.equippedCollectorId) return 1000;
      if (state.activeCompanions.includes(w.id)) return 800;
      // Un recolector crafteado vale más que una de tienda: se conserva antes
      if (w.type === 'collector') return 500 + (w.tier || 0) + (w.potential || 0) * 50;
      if (w.type === 'companion') return 400 + (w.tier || 0);
      if (w.type === 'crate') return 300;
      if (w.type === 'consumable') return 200;
      return 100;
    };

    // Mantiene los mejor valorados; ante empate, los más antiguos
    const kept = state.warehouse
      .map((w: any, index: number) => ({ w, index, s: score(w) }))
      .sort((a, b) => (b.s - a.s) || (a.index - b.index))
      .slice(0, capacity)
      .sort((a, b) => a.index - b.index)
      .map(x => x.w);

    state.warehouse = kept;
    // Recortar el almacén puede llevarse el item al que estaba anclado un hueco.
    syncWarehouseGaps();
  }

  // Detecta el tipo de caja a partir del nombre del item
  function getCrateTypeFromName(name: string): CrateType | null {
    const lower = name.toLowerCase();
    if (lower.includes('común')) return 'common';
    if (lower.includes('rara')) return 'rare';
    if (lower.includes('épica')) return 'epic';
    if (lower.includes('legendaria')) return 'legendary';
    return null;
  }

  /**
   * Cuántas cajas hay en el almacén, por tipo. Solo lee: no toca nada.
   *
   * Vive aparte de `syncCrateCounters` porque `materializePendingCrates` necesita
   * el recuento ANTES de escribir nada, para no contar dos veces lo que acaba de
   * crear.
   */
  function countCratesInWarehouse(): Record<CrateType, number> {
    const counts: Record<CrateType, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };

    state.warehouse.forEach((w: any) => {
      if (w.type !== 'crate') return;
      const crateType = getCrateTypeFromName(w.name || '');
      if (!crateType) return;
      // Un item apilado (stackCount) representa varias cajas
      counts[crateType] += (w.stackCount || 1);
    });

    return counts;
  }

  /**
   * `state.crates` es un contador DERIVADO: el almacén es la fuente de verdad.
   * Esta función solo lo recalcula. NO crea items.
   *
   * Antes esta función hacía dos trabajos incompatibles: contar y materializar.
   * La materialización comparaba `state.crates` —el valor del guardado anterior,
   * porque aquí todavía no se había reescrito— contra el almacén recién contada.
   * Después de vender o abrir la ÚLTIMA caja de un tipo, el contador viejo
   * decía 1 y el almacén decía 0, así que `missing` salía positivo y la función
   * metía la caja otra vez en el almacén. El jugador cobraba las nanitas, veía
   * el aviso de vendido, y la caja seguía ahí con otro id. Abrir una caja
   * suffería exactamente lo mismo, y también `updateState()`.
   *
   * Crear items es trabajo de `materializePendingCrates`, que solo se llama
   * donde tiene sentido: al cargar una partida y al reiniciar por prestigio.
   */
  function syncCrateCounters() {
    state.crates = countCratesInWarehouse();
  }

  /**
   * Convierte en cajas reales lo que el contador dice y el almacén no respalda.
   *
   * Solo tiene sentido en dos momentos concretos, y en ninguno más:
   *
   *   - Al cargar. Una partida antigua puede tener `crates: { common: 5 }` sin
   *     un solo item de caja en el almacén. Si no se materializan, el jugador
   *     las pierde sin haber jugado: es saldo real detrás del que no hay
   *     ningún item.
   *   - Al reiniciar por prestigio, donde `crates: { common: 2 }` son las cajas
   *     de partida nueva, no un residuo de la anterior.
   *
   * En cualquier otro momento, este cálculo es un error: el contador va
   *siempre retrasado una operación respecto al almacén, así que compararlo
   * con el almacén no mide lo que falta, mide lo que se acaba de gastar.
   */
  function materializePendingCrates() {
    const counts = countCratesInWarehouse();

    (Object.keys(CRATE_TYPES) as CrateType[]).forEach(crateType => {
      const missing = (state.crates[crateType] || 0) - counts[crateType];
      if (missing <= 0) return;
      // Materializar lo que falte, respetando la capacidad del almacén
      const free = effectiveWarehouseCapacity() - countOccupiedSlots(state.warehouse);
      const toCreate = Math.min(missing, Math.max(0, free));
      for (let i = 0; i < toCreate; i++) {
        // `addToWarehouse`: si ya hay una pila de este tipo de caja, las nuevas
        // se suman a ella y no gastan una ranura cada una.
        if (!addToWarehouse(createCrateItem(crateType) as any)) break;
      }
      counts[crateType] += toCreate;
    });

    state.crates = counts;
  }

  /**
   * Recuento de tarjetas AFK que hay en el almacén.
   *
   * Este contador tenía dos fallos, y los dos venían de lo mismo: no trataba el
   * almacén como lo que es.
   *
   * 1. Contaba ITEMS, no unidades. Las tarjetas son apilables, así que tres
   *    tarjetas en una sola pila se contaban como una. `syncMaterialCounters`
   *    suma `stackCount` justo por eso; aquí faltaba.
   * 2. Las localizaba por el NOMBRE. El almacén lleva su `buffId` desde hace
   *    tiempo, y es el mismo campo que usa `useConsumable` para decidir el
   *    efecto: leer el nombre en un sitio y el campo en otro es exactamente la
   *    desincronización que los contadores derivados evitan a propósito. El día
   *    que la tarjeta se renombre, este contador se queda a cero sin avisar. Las
   *    partidas viejas no tienen `buffId`, así que aquí se deduce del nombre
   *    igual que allí, una vez y solo al leer.
   *
   * Se filtra por `type` además de por `buffId`: es lo que hace el resto del
   * archivo y evita que un item de otro tipo con el mismo campo se cuente.
   */
  function refreshAfkCardCount() {
    let total = 0;

    state.warehouse.forEach((w: any) => {
      if (w.type !== 'consumable') return;
      const buffId = w.buffId ?? inferBuffIdFromName(w.name || '');
      if (buffId !== 'afk') return;
      total += w.stackable ? (w.stackCount || 1) : 1;
    });

    state.afkCards = total;
  }

  // Sincronizar compañeros con el warehouse después de inicializar
  recomputeBonuses();
  rebuildAchievementBonuses();
  syncCompanionsToWarehouse();
  // Al cargar SÍ se materializan las cajas que el contador promete: es la
  // migración de partidas antiguas y el regalo de partida nueva. A partir de
  // aquí, `state.crates` solo se recalcula.
  materializePendingCrates();
  syncMaterialCounters();
  // Las tarjetas AFK también se derivan del almacén al cargar. Antes se leía
  // `afkCards` del guardado y ya está: como el contador contaba items en vez de
  // unidades, quien tuviera tarjetas apiladas arrastraba el error indefinidamente,
  // guardado a guardado. Derivar al cargar lo deja bien sin tocar los items.
  refreshAfkCardCount();
  checkAchievements();

  // Guardar inmediatamente al iniciar sesión
  await saveToFirebase();

  // Los compañeros tipo 'multiplier' no aportan nanitas: multiplican el rendimiento.
  // power es el factor extra (0.5 = +50%, 2.0 = +200%)
  // `state.unlockedAchievements` es la ÚNICA fuente de verdad. Antes también se
  // llevaba una copia en achievementState.unlocked, y si ambas se
  // desincronizaban (un reset o un guardado fallido) los logros ya evaluationados
  // no volvían a aparecer nunca.
  function rebuildAchievementBonuses() {
    achievementState.unlocked = state.unlockedAchievements;
    achievementState.clickBonus = 0;
    achievementState.passiveBonus = 0;
    for (const ach of ACHIEVEMENTS) {
      if (!state.unlockedAchievements.includes(ach.id)) continue;
      achievementState.clickBonus += ach.reward.clickBonus;
      achievementState.passiveBonus += ach.reward.passiveBonus;
    }
  }

  function checkAchievements() {
    const newly = evaluateAchievements(state, achievementState);
    if (newly.length === 0) return;
    for (const ach of newly) {
      if (!state.unlockedAchievements.includes(ach.id)) state.unlockedAchievements.push(ach.id);
      onAchievement?.(ach);
    }
    recalculatePassiveIncome();
    saveToFirebase();
  }

  function calculateCompanionMultiplier(): number {
    let multiplier = 1;
    state.activeCompanions.forEach(compId => {
      const comp = state.companions.find(c => c.id === compId);
      if (comp && comp.type === 'multiplier') {
        multiplier += comp.power;
      }
    });
    return Math.max(1, multiplier);
  }

  /**
   * Recalcula `state.bonus` desde los nodos comprados. Se llama en cada cambio
   * de nodos y una vez al cargar.
   *
   * Importante: los derivados (capacidad, slots, duración AFK) se guardan como
   * base en el save y el bonus se aplica encima, en vez de escribirse en el
   * estado. Si se escribieran, comprar un nodo de almacenamiento sería
   * irreversible al reiniciar: el jugador pagaría dos veces.
   */
  function recomputeBonuses() {
    state.bonus = aggregateBonuses(state.nodeLevels);
    // `nodeLevels` es la fuente de verdad; `unlockedNodes` es su proyección
    state.unlockedNodes = Object.keys(state.nodeLevels).filter(id => (state.nodeLevels[id] || 0) > 0);
  }

  /** Capacidad real del almacén: base del save + ranuras del árbol. */
  function effectiveWarehouseCapacity(): number {
    return state.warehouseCapacity + state.bonus.storageSlots;
  }

  /** Slots de compañero reales: base del save + cuadrilla. */
  function effectiveCompanionSlots(): number {
    return state.maxCompanionSlots + state.bonus.companionSlots;
  }

  /** Duración de una tarjeta AFK: 10 min base + extra del árbol. */
  function afkCardDurationMs(): number {
    return AFK_CARD_DURATION_MS + state.bonus.afkHours * 3600_000;
  }

  function recalculatePassiveIncome() {
    let base = 0;
    // SOLO los compañeros activos suman recursos por segundo.
    // Los de tipo 'click' cuentan aquí: es su único origen de ingresos.
    const contributors: any[] = [];
    state.activeCompanions.forEach(compId => {
      const comp = state.companions.find(c => c.id === compId);
      if (comp && comp.type !== 'multiplier') {
        base += comp.power;
        contributors.push(comp);
      }
    });

    // F4 · ESTA LÍNEA SE QUEDA, Y ES LO QUE HACE QUE LA RETIRADA SEA SEGURA.
    //
    // `passiveBuff` ya no se compra (ver `CONSUMABLES` en `data/store.ts`), pero el
    // multiplicador sigue aquí a propósito: hay partidas guardadas con
    // `passiveBoostExpiresAt` en el futuro, y un jugador que lo tenía comprado va a
    // seguir cobrando su x2 hasta que expire. Quitar la línea le recortaría el
    // ingreso a media partida por un cambio de tienda.
    //
    // Y por eso el motivo de retirarlo no es "era mucho": es que un x2 de 30-60
    // minutos comprado con nanitas rompe R10 por la puerta de atrás, porque
    // `isEffectivelyAfk` da por bueno el ingreso mientras el buff siga vivo. Las
    // tres tarjetas que quedan duran 10 minutos o 30 segundos.
    if (Date.now() < state.buffs.passiveBoostExpiresAt) {
      base *= 2;
    }

    state.passiveMultiplier = calculateCompanionMultiplier();
    const withAchievements = base * state.passiveMultiplier
      * (1 + achievementState.passiveBonus)
      * (1 + state.bonus.passiveMult);
    state.passiveIncome = Math.floor(withAchievements);

    repartirPorCompanion(contributors, state.passiveIncome);
  }

  /**
   * Cuánto del segundo le toca a cada compañero, y que la suma sea EXACTAMENTE
   * el ingreso.
   *
   * POR QUÉ NO SE PUEDE BASTAR CON `Math.floor(power * multiplicadores)` EN CADA
   * UNO. Los floors no suman: con dos compañeros de 3 y multiplicador 1,5 el
   * ingreso real es `floor((3+3) * 1,5) = 9`, pero `floor(3 * 1,5)` son 4 y 4,
   * que son 8. El resultado del panel y el "+N" flotante dirían 8 y el contador
   * subiría 9, y volveríamos a tener dos números para la misma cosa.
   *
   * POR QUÉ EL REPARTO ES PROPORCIONAL Y NO "EL PRIMERO SE QUEDA EL RESTO". Se
   * reparte la unidad sobrante a partes iguales entre todos, y cada compañero
   * redondea a entero. Así el más pequeño nunca se queda sin nada porque el más
   * grande se comió el redondeo, y con dos la unidad sobrante se reparte entre
   * los dos en vez de irse entera al primero de la lista.
   *
   * El resultado se guarda en un mapa y no se calcula al pintar: la vista pide el
   * número, no lo reimplementa (R2). Y si algún día el reparto no cuadra, la
   * diferencia se le da al primero a propósito, para que la suma sea exacta y no
   * "casi exacta", y no un entero que cuadre por casualidad.
   */
  function repartirPorCompanion(contributors: any[], total: number) {
    ingresoPorCompanion.clear();
    if (!contributors.length) return;

    const pesos = contributors.map(c => Math.max(0, c.power || 0));
    const sumaPesos = pesos.reduce((a, b) => a + b, 0);
    if (sumaPesos <= 0) return;

    let asignado = 0;
    const partes: number[] = [];
    for (const peso of pesos) {
      const exacto = (total * peso) / sumaPesos;
      const entero = Math.floor(exacto);
      partes.push(entero);
      asignado += entero;
    }
    // Lo que ha sobrado del redondeo, repartido a partes iguales.
    let sobrante = total - asignado;
    for (let i = 0; sobrante > 0; i = (i + 1) % partes.length, sobrante--) {
      partes[i]++;
    }

    contributors.forEach((comp, i) => ingresoPorCompanion.set(comp.id, partes[i]));
  }

  /**
   * Bonificaciones de los afijos del recolector equipado. Se suman al daño aquí y no
   * se hornean en `item.damage`: si se guardaran, vender y volver a comprar el
   * mismo objeto cambiaría su estadística.
   */
  function equippedAffixEffect(): { clickMult: number; passiveMult: number; flat: number } {
    const out = { clickMult: 0, passiveMult: 0, flat: 0 };
    if (!state.equippedCollectorId) return out;
    const item: any = state.warehouse.find((w: any) => w.id === state.equippedCollectorId);
    if (!item?.affixes?.length) return out;
    for (const affixId of item.affixes) {
      const affix = AFFIX_BY_ID[affixId];
      if (!affix) continue;
      out.clickMult += affix.effect.clickMult || 0;
      out.passiveMult += affix.effect.passiveMult || 0;
      // Los afijos planos escalan con el nivel del recolector: es lo que hace que
      // subir un recolector crafteado siga valiendo algo.
      out.flat += (affix.effect.flatDamage || 0) * (1 + (item.level || 0) * 0.08);
    }
    return out;
  }

  /**
   * LA CUENTA DEL CLICK, SIN EL BUFF. La fórmula vive aquí y en ningún otro
   * sitio: la consumen el click mismo, el guardado y el desglose del panel.
   *
   * POR QUÉ ESTA FUNCIÓN EXISTE, Y POR QUÉ NO ES "EL DAÑO". El buff de click se
   * aplica FUERA de la cuenta y en tres sitios distintos: al hacer click, al
   * mostrar el panel y al desglosarlo. Si esta función metiera el buff dentro,
   * el buff se aplicaría dos veces y un buff x2 daría x4 — que es exactamente
   * el bug que rompió `playthroughCheck` al meter el buff aquí dentro. Por eso
   * lo que sale de aquí se llama "sin buff", y quien quiera el buff lo multiplica
   * una vez, a su manera.
   *
   * `conNivel` es el daño después del nivel y antes de los demás multiplicadores,
   * y es lo que permite repartir el total sin inventarse números (ver abajo).
   */
  function cuentaDeClickSinBuff(): { total: number; base: number; conNivel: number } {
    const cero = { total: 0, base: 0, conNivel: 0 };
    if (!state.equippedCollectorId) return cero;
    const item: any = state.warehouse.find((w: any) => w.id === state.equippedCollectorId);
    if (!item) return cero;

    const affixes = equippedAffixEffect();
    const base = item.damage || 0;
    const levelMultiplier = 1 + ((item.level || 0) * 0.10);
    const conNivel = base * levelMultiplier;
    const total = (base + affixes.flat)
      * levelMultiplier
      * calculateCompanionMultiplier()
      * (1 + achievementState.clickBonus)
      * (1 + state.bonus.clickMult)
      * (1 + affixes.clickMult);
    return { total, base, conNivel };
  }

  /** El daño de un click SIN buffs. Quien quiera buffs los aplica encima. */
  function calculateClickDamage(): number {
    return Math.floor(cuentaDeClickSinBuff().total);
  }

  /**
   * De dónde sale el daño de un click, en tres partes que suman el total.
   *
   * POR QUÉ ESTA FUNCIÓN Y NO QUE LA VISTA RESTE. El jugador pidió ver "5 base +
   * 15 por mejora". Restar en la vista daría un número que no existe en ningún
   * sitio, y además se desincronizaría en cuanto un buff activara o expirara
   * entre el pintado y la lectura. Aquí el desglose sale de la MISMA cuenta que
   * cobra el click, que es lo único que garantiza que las tres partes sumen el
   * total (R1, R3).
   *
   * Y POR QUÉ TRES PARTES Y NO DOS. El detalle que obliga: con solo "base" y
   * "por nivel" las cifras NO cuadran. Un T1 de daño 5 en nivel 4 da 5 × 1,4 = 7
   * por nivel, y el total que ve el jugador es 20, porque por en medio están los
   * compañeros, los logros, el árbol y los afijos. Mostrar 5 + 2 = 7 al lado de
   * un 20 es un descuadre del que el jugador vuelve a informar, y con razón.
   *
   * Las partes son:
   *   · base   — el daño que trae el item, tal cual.
   *   · porNivel — lo que suma el nivel. El techo de niveles NO se cuenta aquí:
   *     es un tope, no una bonificación.
   *   · porBonos — compañeros tipo multiplicador, logros, árbol, afijos y el
   *     buff de click activo.
   *
   * Y las tres suman `total` exactamente, porque `total` se calcula después y
   * las partes se derivan de los mismos pasos intermedios, no al revés.
   */
  function desgloseDeClick(): { total: number; base: number; porNivel: number; porBonos: number } {
    const cuenta = cuentaDeClickSinBuff();
    const total = Math.floor(cuenta.total * calculateMultiplier());

    // El reparto se hace desde el total hacia atrás, no desde las partes hacia
    // el total: así el redondeo cae una sola vez y las tres cifras suman lo que
    // se ve. Al revés, tres redondeos sueltos dan un número que no cuadra.
    //
    // Y LA PARTE DE NIVEL SE MIDE SIN EL BUFF, a propósito. El buff de click
    // multiplica el total entero, pero si se adjudicara a "nivel", con el buff
    // puesto el panel diría "+200 nivel" cuando el nivel solo aporta 100, y el
    // jugador leería que subir de nivel vale el doble de lo que vale. Fijando
    // la parte de nivel sin buff, "nivel" dice siempre lo mismo y es el buff
    // entero lo que aparece en "bonos", que es donde un jugador espera verlo.
    const nivelSinBuff = Math.floor(cuenta.conNivel);
    const porNivel = nivelSinBuff - cuenta.base;
    const porBonos = total - nivelSinBuff;
    return { total, base: cuenta.base, porNivel, porBonos };
  }

  function calculateMultiplier() {
    let multiplier = 1;
    const now = Date.now();
    if (now < state.buffs.clickBoostExpiresAt) {
      multiplier = 2;
    }
    if (now < state.buffs.clickX3ExpiresAt) {
      multiplier = 3;
    } else if (now < state.buffs.clickX2ExpiresAt) {
      multiplier = 2;
    }
    return multiplier;
  }

  async function saveToFirebase() {
    if (!user) return;

    /**
     * PASO 1 · LA COLA.
     *
     * Antes de tocar la red. Es una escritura local y síncrona, así que cuando
     * esta línea termina, el saldo está en el disco. Si todo lo que viene
     * después falla —sin red, regla cambiada, pestaña cerrada a medias— el
     * jugador sigue teniendo su dinero, y lo recuperará al recargar.
     */
    const tsAnotado = anotarPendiente(
      user.uid,
      state.nanites,
      state.totalNanitesProduced,
      state.totalClicks,
      state.cores,
      state.totalCores,
      state.resets
    );

    try {
      const gameData = {
        saveVersion: SAVE_VERSION,
        userId: user.uid,
        username: displayName,
        nanites: state.nanites,
        totalNanitesProduced: state.totalNanitesProduced,
        totalClicks: state.totalClicks,
        totalInfraestructure: state.totalInfraestructure,
        cratesOpened: state.cratesOpened,
        keys: state.keys,
        // Los mismos cubos por nivel que en el reinicio, y por el mismo motivo: sin
        // ellos, la migración de carga mete un TOTAL en el cubo del nivel 0 y
        // materializa una llave de más en cada recarga.
        keysByTier: state.keysByTier,
        crystalsByTier: state.crystalsByTier,
        upgradeCrystals: state.upgradeCrystals,
        warehouseCapacity: state.warehouseCapacity,
        maxCompanionSlots: state.maxCompanionSlots,
        afkCards: state.afkCards,
        afkExpiresAt: state.afkExpiresAt,
        crates: state.crates,
        equippedCollectorId: state.equippedCollectorId,
        companions: state.companions,
        activeCompanions: state.activeCompanions,
        warehouse: state.warehouse,
        warehouseGaps: state.warehouseGaps,
        buffs: state.buffs,
        unlockedAchievements: state.unlockedAchievements,
        cores: state.cores,
        totalCores: state.totalCores,
        resets: state.resets,
        unlockedNodes: state.unlockedNodes,
        nodeLevels: state.nodeLevels,
        shards: state.shards,
        forgedCount: state.forgedCount,
        cosmetics: state.cosmetics,
        updatedAt: new Date()
      };
      // Guardar datos del juego en users/{uid}
      await setDoc(userRef, gameData, { merge: true });
      // Guardar solo datos de ranking en rankings/{uid}
      await setDoc(rankingRef, {
        userId: user.uid,
        username: user.displayName || 'Operativo',
        score: state.nanites,
        totalClicks: state.totalClicks,
        // Módulo 8: el ranking refleja logros y firmas de autor
        achievements: state.unlockedAchievements.filter(id => !SECRET_ACHIEVEMENTS.includes(id as AchievementId)).length,
        secretAchievements: state.unlockedAchievements.filter(id => SECRET_ACHIEVEMENTS.includes(id as AchievementId)).length,
        forgedCount: state.forgedCount,
        title: state.cosmetics.title,
        frame: state.cosmetics.frame ?? 'frame_none',
        banner: state.cosmetics.banner ?? 'banner_none',
        cosmetics: {
          title: state.cosmetics.title,
          frame: state.cosmetics.frame ?? 'frame_none',
          banner: state.cosmetics.banner ?? 'banner_none',
        },
        updatedAt: new Date()
      }, { merge: true });

      /**
       * PASO 2 · EL SERVIDOR CONFIRMA.
       *
       * Solo aquí, y solo ahora que las dos escrituras han ido bien, se vacía
       * la cola. Este es el punto más delicado de todo el mecanismo: vaciarla
       * antes de tiempo perdería nanitas (el documento se queda con la cifra
       * vieja y la cola con la nueva, y nadie suma las dos), y no vaciarla
       * nunca las duplicaría en la siguiente recarga.
       *
       * Se vacía con `confirmarCola(tsAnotado)` y no a pelo, porque los guardados
       * se solapan: al llegar aquí, este guardado ha confirmado SU saldo, pero
       * puede que otro más nuevo ya haya escrito en la cola. Vaciarla sin mirar
       * borraba la red de seguridad de ese otro, y el jugador perdía saldo sin
       * forma de recuperarlo. Ver `confirmarCola`.
       */
      if (confirmarCola(tsAnotado)) pendingWasFlushed();
    } catch (error) {
      /**
       * PASO 3 · FALLO.
       *
       * No se hace nada, y esa es la decisión. La cola se escribió antes de
       * intentarlo y sigue ahí con el saldo, así que no hay nada que
       * recuperar. El siguiente guardado lo reintenta solo.
       *
       * Lo que sí se avisa es el estado, porque "no se está guardando" y
       * "no se está jugando" parecen lo mismo desde fuera y no lo son: el
       * jugador puede estar jugando diez minutos que se perderían si cerrara.
       */
      console.error("Error al guardar en Firebase:", error);
      marcarPendiente(true);
      if (!guardadoFallando) {
        guardadoFallando = true;
        showToast(
          'Sin conexión con el servidor. Tu progreso se guarda en este dispositivo ' +
          'y se subirá solo al volver.',
          'error'
        );
      }
    }
  }

  // El jugador solo está "presente" si la pestaña es visible Y la ventana tiene el
  // foco. Cubre todos los casos en los que no está mirando el juego:
  //   - otra pestaña o ventana del navegador (visibilitychange)
  //   - otra aplicación delante, ventana minimizada o en segundo plano (blur)
  //   - pantalla bloqueada, suspensión del sistema o móvil en reposo
  //   - navegación fuera de la página (pagehide)
  function isPlayerPresent(): boolean {
    return document.visibilityState === 'visible' && document.hasFocus();
  }

  // Cobra el pasivo del tiempo que el jugador estuvo ausente, pero solo si había
  // un buff AFK vigente. Se acota por tres lados para que no se pueda inflar:
  //   - tiempo real ausente medido con reloj monótono (no manipulable con la hora)
  //   - parte restante real del buff AFK
  //   - tope absoluto del buff (30 min)
  function grantAfkCatchUp(fromAwayAt: number) {
    const awayMs = performance.now() - fromAwayAt;
    const buffRemainingMs = Math.max(0, state.afkExpiresAt - Date.now());
    const grantMs = Math.min(awayMs, buffRemainingMs, MAX_AFK_BUFF_DURATION_MS);
    if (grantMs <= 0) return;

    recalculatePassiveIncome();
    if (state.passiveIncome <= 0) return;
    state.nanites += (grantMs / 1000) * state.passiveIncome;
  }

  const handlePresenceChange = () => {
    if (!isPlayerPresent()) {
      if (awayAt === 0) {
        awayAt = performance.now();
        isAfk = true;
        // Sin tick no hay income pasivo: el juego está "detenido" mientras no se mira
        if (gameInterval) { clearInterval(gameInterval); gameInterval = null; }
        // Un último render para que la interfaz muestre la pausa
        onUpdate(state, true);
      }
      return;
    }

    // El jugador volvió a la pantalla
    if (awayAt > 0) {
      grantAfkCatchUp(awayAt);
      awayAt = 0;
    }
    const elapsed = Date.now() - lastActiveTimestamp;
    isAfk = elapsed > AFK_THRESHOLD_MS;
    lastActiveTimestamp = Date.now();
    if (!gameInterval) startGameIntervals();
  };

  const handleUserActivity = (e?: Event) => {
    // Evitar que Enter, Espacio o Intro sumen clicks (anti-trampas)
    if (e && e instanceof KeyboardEvent && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) {
      return;
    }
    // Solo actualizar timestamp con click real (no con mousemove)
    //
    // B9 · ESTE ES EL OTRO LADO DE B9, Y HAY QUE MIRAR LOS DOS.
    // Sacar del AFK pide un click, y no con que el ratón se mueva: si el ratón
    // sirviera, bastaría moverlo para que volviera a entrar el ingreso mientras
    // el jugador no ha hecho nada, que es el mismo problema que la otra mitad.
    //
    // Y al volver hay `awaitingClickAfterAfk`: el primer click DESPUÉS de salir
    // del AFK no cobra pasivo, solo limpia la espera. Sin eso, el jugador que
    // vuelve tras una pausa tendría el tick con medio segundo acumulado de
    // cuando estaba en AFK, y cobraría un tiempo que no le corresponde.
    if (e && e.type === 'click') {
      lastActiveTimestamp = Date.now();
      if (isAfk) {
        isAfk = false;
        // Activar estado de espera de click para retomar pasivos
        awaitingClickAfterAfk = true;
        onUpdate(state, false);
      }
    }
  };

  // POR QUÉ NO HAY `mousemove` EN ESTE BLOQUE (B9).
  //
  // Aquí hubo un `handleMouseMove` que hacía `lastActiveTimestamp = Date.now()`, y
  // el listener se quedaba registrado. Se ha quitado el listener entero en vez de
  // dejar una función vacía: un listener que no hace nada es una línea que se lee,
  // se supone que significa algo y no lo significa.
  //
  // Lo que cuenta como actividad es **un click de verdad**, en
  // `handleUserActivity`. Con el ratón contando, el AFK no se notaba casi nunca:
  // bastaba con que el cursor se moviera sobre la ventana sin hacer nada, y el
  // juego seguía cobrando pasivo como si el jugador estuviera leyendo. Y un
  // jugador leyendo un texto largo no mueve el ratón durante minutos, que es
  // justo el caso que el AFK existe para cubrir.
  //
  // Si algún día hace falta distinguir "movió el ratón" de "hizo algo", la pista
  // es este comentario.

  // Page Lifecycle API: el navegador congela la página en segundo plano. Es la
  // única señal fiable cuando el sistema suspende o la pantalla se bloquea.
  const docWithLifecycle = document as Document & {
    addEventListener(type: string, listener: () => void, options?: any): void;
    removeEventListener(type: string, listener: () => void, options?: any): void;
  };

  document.addEventListener('visibilitychange', handlePresenceChange);
  window.addEventListener('focus', handlePresenceChange);
  window.addEventListener('blur', handlePresenceChange);
  window.addEventListener('pageshow', handlePresenceChange);
  // Al navegar fuera no hay vuelta: se marca ausencia y se para el tick
  window.addEventListener('pagehide', handlePresenceChange);
  docWithLifecycle.addEventListener('freeze', handlePresenceChange);
  docWithLifecycle.addEventListener('resume', handlePresenceChange);
  window.addEventListener('keydown', handleUserActivity);
  window.addEventListener('click', handleUserActivity);

  const saveInterval = setInterval(saveToFirebase, 15000);
  const handleUnload = () => { saveToFirebase(); };
  window.addEventListener('beforeunload', handleUnload);

  /**
   * REINTENTOS DE LA COLA.
   *
   * El intervalo de 15 segundos ya reintenta solo, pero hay tres momentos en
   * los que esperar quince segundos no es aceptable:
   *
   *  1. Vuelve la red. El evento `online` del navegador salta en cuanto se
   *     recupera la conexión, y es el momento exacto en que el jugador está a
   *     punto de cerrar la pestaña. Sin esto, esos quince segundos son
   *     exactamente los que se pierden.
   *  2. Vuelve el jugador. Si estuvo en otra pestaña con el wifi apagado, al
   *     enfocar esta se reintenta en el acto.
   *  3. Hay cola de la sesión anterior. Al arrancar, este es el momento de
   *     subarla: el jugador acaba de recuperar esas nanitas y quiere verlas
   *     confirmadas, no dentro de medio minuto.
   */
  const reintentarSiHayCola = () => {
    if (!user) return;
    if (hayPendientes(user.uid)) void saveToFirebase();
  };

  window.addEventListener('online', reintentarSiHayCola);
  window.addEventListener('focus', reintentarSiHayCola);
  // BFCache: al volver atrás en el historial la página se restaura sin recargarse,
  // y el guardado anterior pudo quedar a medias.
  window.addEventListener('pageshow', reintentarSiHayCola);

  // La subida de la cola heredada del arranque anterior. Va después de los
  // listeners para que el resto de la inicialización esté montado cuando llegue
  // la respuesta, y con un margen corto para no competir con el guardado de
  // carga, que acaba de occurrir.
  if (user && hayPendientes(user.uid)) {
    setTimeout(() => { void saveToFirebase(); }, 1200);
  }

  // Intervalo de 500ms para actualización fluida sin parpadeo
  const TICK_RATE_MS = 500;
  const MS_POR_SEGUNDO = 1000;

  // Estado para manejar el regreso del AFK
  let awaitingClickAfterAfk = false;
  // Resto fraccionario de los clics automáticos (ver el tick)
  let autoClickAccumulator = 0;

  /**
   * Clics automáticos del árbol que aún no se han anunciado, y el tope de la
   * cola.
   *
   * POR QUÉ SOLO LOS DEL ÁRBOL Y NO LOS DE LOS COMPAÑEROS. Los del árbol caen
   * donde caiga el acumulador, a cualquier punto del segundo, así que la vista
   * no puede adivinar cuándo fueron: hace falta que el motor se los cuente. Los
   * compañeros van al bloque entero de cada segundo (ver `msParaCobroPasivo`), y
   * ese bloque es su aviso: no hay evento aparte porque no hay instante aparte.
   *
   * POR QUÉ SOLO ES DE PRESENTACIÓN. El dinero ya está en `state.nanites` cuando
   * el evento se encola, así que perder un evento no cuesta ni un nanita: es una
   * nota que se pierde, no una transacción. Por eso el tope puede recortar sin
   * riesgo, y por eso un banco puede vaciar la cola y no perder nada.
   *
   * El tope existe porque `drainClickEvents()` lo llama quien actualiza la
   * pantalla, y si nadie lo llama —una vista donde no hay recolector— la cola
   * crecería sin límite en una partida larga con muchos nodos de autoClick.
   */
  const MAX_CLICKS_PENDIENTES = 40;
  let clicksPendientes: { cantidad: number }[] = [];

  function anotarClickAutomatico(cantidad: number) {
    if (clicksPendientes.length >= MAX_CLICKS_PENDIENTES) clicksPendientes.shift();
    clicksPendientes.push({ cantidad });
  }

  /**
   * POR QUÉ EL PASIVO SE COBRA POR SEGUNDOS Y NO POR TICKS.
   *
   * `state.passiveIncome` es una cifra POR SEGUNDO —ya viene con `Math.floor`, y el
   * HUD la enseña como "+5 / segundo"—, pero el tick corre a 500 ms. Cobrar la
   * fracción del tick dividía por dos lo que toca en cada vuelta: con un
   * compañero de +5/s el saldo subía 2,5 cada 500 ms, y como `formatNumber` baja
   * el entero, el número grande de la base alternaba +2 y +3 (307 → 309 → 312 →
   * 314 → 317 → 319) mientras al lado ponía "+5 / segundo". El ritmo que enseña el
   * HUD y el que se veían eran dos, y con cualquier ingreso impar el salto era más
   * feo: 7/s daba +3 y +4, 9/s daba +4 y +5.
   *
   * La alternativa descartada era subir el tick a 1000 ms, que también daría +5
   * de golpe, pero a costa de la barra de buffs, los logros y el resto de la
   * interfaz, que también viven del tick: se arreglaba el contador ralentizando
   * media pantalla. Aquí solo cambia el instante en que entra el dinero, y el
   * resto de la UI sigue a 500 ms.
   *
   * Se acumula el tiempo de tick y, cada segundo completo, entra el segundo
   * entero de una vez. Es el mismo patrón del acumulador de clics automáticos de
   * abajo, y por el mismo motivo: redondear por tick pierde producción.
   */
  let msParaCobroPasivo = 0;

  // Variables para intervalos (pueden detenerse y reiniciarse)
  let gameInterval: ReturnType<typeof setInterval> | null = null;

  function startGameIntervals() {
    // Detener intervalos existentes si los hay
    if (gameInterval) clearInterval(gameInterval);

    // El resto a medio segundo se tira al (re)arrancar. Si se conservara, al
    // volver de una pausa el primer cobro del pasivo llegaría antes de un
    // segundo entero desde que el jugador ha vuelto, y el segundo siguiente se
    // iría al garete: el dinero se repartiría en trozos desiguales.
    msParaCobroPasivo = 0;
    // Y la cola de avisos con ella. Los clicks del árbol que ya se cobraron
    // mientras no había nadie mirando no tienen a quién avisar: si se
    // conservaran, al volver el jugador vería de golpe todos los "+N" de un
    // rato entero, y el contador daría la sensación de haber cobrado algo que no
    // está.
    clicksPendientes = [];

    // Intervalo principal del juego
    gameInterval = setInterval(() => {
      // Watchdog: si el jugador dejó de estar presente sin que llegara el evento
      // (minimizar desde el SO, bloqueo de pantalla, etc.), esta comprobación
      // para el tick antes de que accrue nada.
      if (!isPlayerPresent()) {
        handlePresenceChange();
        return;
      }

      // B9 · EL AFK SE PONE SOLO, AQUI, Y NO EN EL MANEJADOR DE PRESENCIA.
      //
      // `isAfk` solo se recalculaba dentro de `handlePresenceChange`, que es el
      // manejador de `visibilitychange` / `focus` / `blur` / `pageshow`. Con la
      // pestaña visible y el cursor quieto **ninguno de esos eventos se dispara**,
      // así que el tick seguía cobrando pasivo indefinidamente y el `isAfk` que se
      // pintaba en pantalla mentía: decía AFK cuando el ingreso seguía entrando.
      //
      // La pregunta va aquí porque este es el sitio donde ya se decide si entra
      // ingreso. Ponerla en otro sitio sería abrir una segunda puerta al cobro,
      // que es la forma más fácil de que las dos se desincronicen.
      //
      // Y EL CORTE ALCANZA A TODO, INCLUIDOS LOS CLICS DEL ÁRBOL. No es solo el
      // ingreso pasivo: el tick se va entero por `return` cuando `isAfk` está
      // puesto, así que los clicks automáticos del árbol también dejan de contar.
      // Es lo que pide R10 —nada de ingreso si el jugador no está mirando— y es
      // lo coherente: el árbol genera clicks solo, y si colaran mientras el
      // jugador mira la pantalla sin hacer nada, el AFK sería inútil para siempre.
      //
      // Y POR QUÉ `Date.now()` Y NO EL ACUMULADOR DEL TICK. El tick tiene su
      // ritmo propio (`TICK_RATE_MS`) y puede estirarse: si el navegador congela
      // la pestaña, al volver el tick se ejecuta muchas veces seguidas y un
      // contador iría mucho más rápido que el reloj. `Date.now()` no se salta.
      const inactivoMs = Date.now() - lastActiveTimestamp;
      if (!isAfk && inactivoMs > AFK_THRESHOLD_MS) {
        isAfk = true;
        // El resto del tick va a volver con `onUpdate(state, true)`, que es lo
        // que repinta la pausa. Aquí solo se marca el estado y se tira el medio
        // segundo pendiente: si no, al volver el jugador el primer cobro contaría
        // un tiempo en el que estuvo en AFK.
        msParaCobroPasivo = 0;
      }

      recalculatePassiveIncome();
      const now = Date.now();
      const hasPassiveBuffActive = now < state.buffs.passiveBoostExpiresAt;
      const hasAfkBuff = now < state.afkExpiresAt;
      const isEffectivelyAfk = isAfk && !hasPassiveBuffActive && !hasAfkBuff;

      if (isEffectivelyAfk) {
        onUpdate(state, true);
        return;
      }

      if (awaitingClickAfterAfk) {
        onUpdate(state, false);
        return;
      }

      // El ingreso pasivo entra ENTERO y de una vez: un segundo entero por
      // segundo, no la mitad del tick (ver `msParaCobroPasivo`). El HUD anuncia
      // "+5 / segundo" y ahora el saldo se mueve de 5 en 5, como anuncia.
      msParaCobroPasivo += TICK_RATE_MS;
      while (msParaCobroPasivo >= MS_POR_SEGUNDO) {
        msParaCobroPasivo -= MS_POR_SEGUNDO;
        if (state.passiveIncome > 0) {
          state.nanites += state.passiveIncome;
          state.totalNanitesProduced += state.passiveIncome;
        }
      }

      // Clics automáticos del árbol de pasivas. Se acumulan como resto entre
      // ticks en vez de redondear cada tick: a 0.5 clics/s y un tick de 500 ms
      // el redondeo por tick perdería la mitad de la producción.
      //
      // Cada uno se anota para que la vista lo anuncie: hasta ahora estos clicks
      // entraban en la cuenta y no se veían por ningún lado, así que el jugador
      // tenía tres fuentes alimentando el mismo número —su click, el de sus
      // compañeros y el del árbol— y solo dos tenían señal.
      if (state.bonus.autoClick > 0) {
        autoClickAccumulator += state.bonus.autoClick * (TICK_RATE_MS / 1000);
        while (autoClickAccumulator >= 1) {
          autoClickAccumulator -= 1;
          const dmg = calculateClickDamage() * calculateMultiplier();
          state.nanites += dmg;
          state.totalNanitesProduced += dmg;
          state.totalClicks += 1;
          // La nota lleva la cifra YA redondeada, la misma que entró en la
          // cuenta. Si aquí se guardara el valor sin floor, el "+N" flotante y
          // el saldo divergirían en la fracción, que es justo lo que se está
          // arreglando.
          anotarClickAutomatico(Math.floor(dmg));
        }
      }
      // Los logros se comprueban en el tick: así se desbloquean solos sin que
      // el jugador tenga que tocar nada
      checkAchievements();
      onUpdate(state, isAfk && (hasPassiveBuffActive || hasAfkBuff));
    }, TICK_RATE_MS);
  }

  // Iniciar intervalos solo si el jugador está mirando el juego. Si se abrió en
  // segundo plano, arrancarán solos en el primer focus/visibilitychange.
  if (isPlayerPresent()) {
    startGameIntervals();
  }

  const estado = {
    getState: () => state,
    /**
     * Nombre del jugador ya resuelto (`user.displayName` → nombre de registro →
     * "Operativo"). Vive en la API en vez de en `state` porque no es progreso
     * guardado: es identidad de la SESIÓN.
     *
     * El perfil lo pintaba desde `state.__username`, un campo que no existe en
     * ningún sitio, así que la tarjeta de identidad caía siempre en el texto de
     * reserva "Operativo" aunque el nombre bueno estuviera resuelto. Al ser la
     * misma variable que ya se envía al ranking, ahora no puede desincronizarse.
     */
    getDisplayName: () => displayName,
    isAfk: () => isAfk,
    isPresent: () => isPlayerPresent(),
    // Daño por click ya con nivel, multiplicador de compañeros y buffs aplicados.
    // La UI debe usar esta función para no mostrar un valor distinto al real.
    getClickDamage: () => Math.floor(calculateClickDamage() * calculateMultiplier()),
    /**
     * El daño de un click partida en base, nivel y bonos, para que la vista lo
     * enseñe sin tener que deducirlo restando. Ver `desgloseDeClick()`.
     */
    getClickDamageBreakdown: () => desgloseDeClick(),
    /**
     * Cuánto aporta ESTE compañero al ingreso pasivo, ya con los
     * multiplicadores, y con el reparto justo de la fracción.
     *
     * POR QUÉ ESTA FUNCIÓN EXISTE Y POR QUÉ NO ES `comp.power`. La ficha del
     * panel pintaba `+{power}/s` y el "+N" flotante pintaba `+{power}`, pero el
     * motor cobra `power` después de `passiveMultiplier`, de los logros, del
     * árbol y del buff x2. Con un multiplicador de 1,5 el panel decía "+3 /s"
     * y el contador subía 4,5: dos números para la misma cosa, y el que se
     * equivoca es el que se enseña (R3).
     *
     * El reparto sale de `repartirPorCompanion()`, que reparte el ingreso ENTERO
     * entre los que aportan. Por eso la suma de lo que da esta función es
     * exactamente `state.passiveIncome`, sin un nanita de diferencia: si
     * calculase cada uno por su cuenta, los floors no sumarían y volveríamos al
     * mismo descuadre.
     *
     * Un compañero que no está activo devuelve 0, que es lo que paga.
     */
    getCompanionOutput: (companionId: string) => ingresoPorCompanion.get(companionId) ?? 0,
    /**
     * Qué compañeros anuncian su ingreso, y cuánto.
     *
     * POR QUÉ ESTA FUNCIÓN Y NO UN FILTRO EN LA VISTA. Antes la vista recorría
     * los activos buscando los de tipo `click` y pintaba un "+N" para cada uno.
     * El efecto: **los compañeros `passive` no anunciaban nunca**. De los cinco
     * compañeros de caja, tres son `passive` —y entre ellos el Avatar del
     * Vacío, power 65, el mayor ingreso individual del juego—, así que
     * comprarlo y equiparlo no producía ninguna señal. El jugador veía su
     * ingreso en el HUD y los números flotantes de un compañero que no
     * aparecía, y no tenía forma de saber por qué.
     *
     * La regla es "anuncia quien paga directo". Un `passive` paga, con lo que
     * cobra el bloque de cada segundo. Un `multiplier` NO paga: multiplica el
     * de los demás, así que no tiene cifra propia que enseñar, y por eso sigue
     * fuera.
     *
     * Y que la decisión sea del MOTOR y no de la vista es lo que la hace
     * comprobable: la regla queda en un sitio (R2) y `senalCheck` puede mirarla
     * sin DOM, cosa que un filtro dentro de `updateUI()` no permite.
     */
    getAnunciablesIngreso: (): { id: string; cantidad: number }[] =>
      state.activeCompanions
        .map(id => ({ id, cantidad: ingresoPorCompanion.get(id) ?? 0 }))
        .filter(x => {
          const comp = state.companions.find((c: any) => c.id === x.id);
          return comp && comp.type !== 'multiplier';
        }),
    /**
     * Los clicks del árbol que aún no se han anunciado, y vacía la cola.
     *
     * Vaciar en el mismo acto es lo que evita el doble anuncio: la nota se
     * entrega una vez y se queda sin copia. Si quien llama está en una vista sin
     * recolector puede no llamarla nunca, y eso no cuesta nada —ver
     * `anotarClickAutomatico()`.
     */
    drainClickEvents: (): { cantidad: number }[] => {
      if (!clicksPendientes.length) return [];
      const salida = clicksPendientes;
      clicksPendientes = [];
      return salida;
    },
    getAchievements: () => ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: state.unlockedAchievements.includes(a.id),
      current: a.progress(state).current,
      target: a.progress(state).target
    })),
    // Cancela un buff activo. El tiempo restante se pierde, no se devuelve el item.
    cancelBuff: (buffKey: BuffKey) => {
      handleUserActivity();
      const labels: Record<BuffKey, string> = {
        clickBoost: 'Clics x2',
        clickX2: 'Clics x2 (tarjeta)',
        clickX3: 'Clics x3 (tarjeta)',
        passiveBoost: 'Pasivo x2',
        afk: 'AFK'
      };
      if (buffKey === 'afk') {
        if (state.afkExpiresAt <= Date.now()) return false;
        state.afkExpiresAt = 0;
      } else {
        const field = BUFF_FIELDS[buffKey];
        if (state.buffs[field] <= Date.now()) return false;
        state.buffs[field] = 0;
      }
      recalculatePassiveIncome();
      onUpdate(state, isAfk);
      saveToFirebase();
      return labels[buffKey];
    },
    /**
     * Adopta un estado completo de golpe.
     *
     * `syncCrateCounters` y no `materializePendingCrates`: esto no es importar una
     * partida guardada, es sustituir el estado en caliente. El almacén que llega
     * es el estado real, y de un almacén real no se fabrican cajas que el
     * jugador ya no tiene.
     */
    updateState: (newState: any) => {
      Object.assign(state, newState);
      enforceWarehouseCapacity();
      syncCompanionsToWarehouse();
      syncWarehouseGaps();
      syncCrateCounters();
      syncMaterialCounters();
      refreshAfkCardCount();
      rebuildAchievementBonuses();
      recalculatePassiveIncome();
      checkAchievements();
      onUpdate(state, isAfk);
      saveToFirebase();
    },

    /**
     * Reordena el almacén.
     *
     * La libertad de acomodo es del jugador, no del juego, así que aquí no se
     * decide NADA sobre el destino: se le pasa el item al que tiene que quedar
     * pegado el bloque que se mueve y el juego se limita a ponerlo delante. Con
     * `anchorId = null` el bloque va al final del almacén.
     *
     * `lado` dice de qué lado del ancla entra el bloque. No es un detalle: sin
     * él el bloque siempre caía DELANTE del ancla, y como el ancla es el item de
     * la celda señalada, el bloque acababa una celda a la IZQUIERDA de donde el
     * jugador había soltado. Peor: soltar encima del vecino inmediato era un
     * no-op exacto —el bloque ya estaba delante del ancla— así que arrastrar una
     * celda sobre la de al lado no movía absolutamente nada, y la conclusión del
     * jugador era que mover no funcionaba.
     *
     * El que llama sabe en qué dirección se señala el destino (el número de celda
     * de origen y el de destino), así que el juego no tiene que adivinarlo y no
     * puede equivocarse.
     *
     * POR QUÉ UN ANCLA Y NO UN ÍNDICE. El número de celda de la rejilla no es un
     * índice del array: una celda puede representar tres cajas apiladas. Al
     * quitar el grupo arrastrado, todas las celdas que hubiera detrás cambian de
     * sitio, así que un destino traducido a índice ANTES de quitar nada caía
     * una celda más allá de donde se había soltado en cuanto había una pila por
     * medio, y al soltar en uno de los huecos del final directamente no pasaba
     * nada, porque el hueco no tiene índice y se recortaba a la última celda
     * ocupada —que era justo la celda de origen—. Buscando el ancla por id DESPUÉS
     * de quitar, da igual cuántas cosas hubiera detrás.
     *
     * `ids` puede traer varios items porque una pila es una sola celda: si se
     * arrastra una pila de 5, los 5 van juntos y en el mismo orden. Mover solo el
     * que representaba la celda dejaba la celda igual de llena, así que el
     * jugador veía un arrastre que no había movido nada.
     */
    moveItems: (
      ids: string[],
      anchorId: string | null,
      lado: 'antes' | 'despues' = 'antes'
    ): boolean => {
      const wh = state.warehouse;
      if (!ids.length) return false;

      // Índices de los que se mueven, de izquierda a derecha. Los ids que no
      // estén en el almacén se ignoran en vez de abortar: uno que ya no existe
      // no puede volver a bloquear el movimiento de los otros.
      const origen = ids
        .map(id => wh.findIndex((w: any) => w.id === id))
        .filter(i => i >= 0)
        .sort((a, b) => a - b);
      if (!origen.length) return false;

      const seMueven = new Set(origen);

      // El ancla tiene que ser un item que se queda donde está. Si no está, o si
      // es parte del bloque que se mueve (soltar una pila sobre sí misma), no hay
      // reordenación que hacer.
      const ancla = anchorId == null ? -1 : wh.findIndex((w: any) => w.id === anchorId);
      if (anchorId != null && ancla < 0) return false;
      if (ancla >= 0 && seMueven.has(ancla)) return false;

      const bloque = origen.map(i => wh[i]);
      for (let k = origen.length - 1; k >= 0; k--) wh.splice(origen[k], 1);

      // Con el bloque ya fuera, el ancla se busca otra vez: sus índices ya no son
      // los de antes. `ancla < 0` significa "sin ancla" = al final.
      if (ancla < 0) {
        wh.push(...bloque);
      } else {
        const i = wh.findIndex((w: any) => w.id === anchorId);
        wh.splice(lado === 'despues' ? i + 1 : i, 0, ...bloque);
      }

      onUpdate(state, isAfk);
      saveToFirebase();
      return true;
    },

    /**
     * Huecos de disposición. Ver `setWarehouseGaps`.
     *
     * Se expone como lista completa porque el intercambio de "item entra en el
     * hueco y el hueco va a donde estaba el item" lo decide la vista, que es la
     * que ve la rejilla. Aquí solo se guarda, se limpia y se persiste.
     */
    getWarehouseGaps: (): string[] => [...(state.warehouseGaps || [])],
    setWarehouseGaps,

    /**
     * Vende un item del almacén.
     *
     * Todo el borrado ocurre aquí, no en la vista. Antes cada pantalla restaba
     * el item por su cuenta y luego llamaba a `updateState`, que recalculaba
     * los contadores ANTES de que el item se hubiera quitado de verdad en
     * algunos caminos: el item volvía a aparecer en el siguiente guardado.
     *
     * Para las cajas el bucle era más corto: `syncCrateCounters()` recreaba el
     * item recién vendido porque comparaba el contador del guardado anterior
     * contra el almacén. Ver `materializePendingCrates`.
     */
    /**
     * Vende `units` unidades de un item, o la pila entera si no se dice nada.
     *
     * La cantidad se acepta porque una pila se puede querer a medias: 19 llaves
     * y solo vas a abrir dos cajas, y en los otros 17 quieres otra cosa. Antes
     * la única palanca era vender la pila entera, que para un material de
     * consumo es una decisión equivocada por defecto.
     *
     * `units` llega desde un `<input type=number>`, así que se coacciona y se
     * recorta con `unidadesVendibles()`: el que enseña el botón y el que cobra
     * son la misma expresión, que es lo que R3 exige.
     */
    sellItem: (itemId: string, units?: number): { ok: boolean; msg?: string; gained?: number; sold?: number } => {
      handleUserActivity();
      const idx = state.warehouse.findIndex((w: any) => w.id === itemId);
      if (idx < 0) return { ok: false, msg: 'Ese item ya no está en el almacén.' };

      const item = state.warehouse[idx];
      const esEquipado = (item.type === 'collector' && state.equippedCollectorId === item.id) ||
        (item.type === 'companion' && state.activeCompanions.includes(item.id));
      if (esEquipado) return { ok: false, msg: 'Desequípalo antes de venderlo.' };

      const vender = unidadesVendibles(item, units);
      if (vender <= 0) return { ok: false, msg: 'Elige una cantidad mayor que cero.' };

      // No se puede quedar sin la última unidad de un tipo que produce ingreso.
      // Cuenta ITEMS, no unidades, y sigue valiendo igual: recolectores y
      // compañeros no son apilables, así que `vender` siempre es 1 aquí.
      if (item.type === 'collector' || item.type === 'companion') {
        const quedan = state.warehouse.filter((w: any) => w.type === item.type).length;
        if (quedan <= 1) return { ok: false, msg: 'No puedes vender el último de su tipo.' };
      }

      const ganado = Math.floor(getSellPriceFor(item) * vender);

      state.nanites += ganado;

      consumeWarehouseItem(item.id, vender);
      syncWarehouseGaps();

      if (item.type === 'companion') {
        state.companions = state.companions.filter((c: any) => c.id !== item.id);
        state.activeCompanions = state.activeCompanions.filter((id) => id !== item.id);
      }

      syncCrateCounters();
      syncMaterialCounters();
      refreshAfkCardCount();
      syncCompanionsToWarehouse();
      recalculatePassiveIncome();
      checkAchievements();
      onUpdate(state, isAfk);
      saveToFirebase();
      return { ok: true, gained: ganado, sold: vender };
    },

    /**
     * Consume un consumible del almacén y aplica su efecto.
     *
     * El efecto se calcula con la MISMA función que la vista usaba antes, pero
     * aquí se aplica al estado y después se consume el item. El orden importa:
     * primero se resuelve el buff, y solo si se ha aplicado bien se gasta.
     */
    useConsumable: (itemId: string): { ok: boolean; msg?: string } => {
      handleUserActivity();
      const item: any = state.warehouse.find((w: any) => w.id === itemId);
      if (!item) return { ok: false, msg: 'Ese item ya no está en el almacén.' };
      if (item.type !== 'consumable') return { ok: false, msg: 'Esto no se puede usar.' };

      // Las partidas viejas no tienen el campo `buffId`: se deduce del nombre.
      const buffId = item.buffId ?? inferBuffIdFromName(item.name || '');
      if (!buffId) return { ok: false, msg: 'Este consumible no tiene efecto conocido.' };

      const ahora = Date.now();
      const afkMs = afkCardDurationMs();
      let nuevoItem = true;

      switch (buffId) {
        case 'expansorT1':
        case 'expansorT2':
        case 'expansorT3': {
          // F27 · Cada tipo vale hasta su techo: al crecer hay que subir de
          // tipo. Lo que pide el siguiente lo dice el propio rechazo, para que
          // el jugador no tenga que adivinar qué comprar.
          const tipo = expansorPorBuff(buffId)!;
          if (state.warehouseCapacity >= WAREHOUSE_MAX_CAP) {
            return { ok: false, msg: `Almacén al máximo (${WAREHOUSE_MAX_CAP}).` };
          }
          if (state.warehouseCapacity >= tipo.maxCap) {
            const siguiente = EXPANSOR_TIERS.find(t => t.tier === tipo.tier + 1 as 2 | 3);
            return { ok: false, msg: `Tu almacén necesita un ${siguiente?.name ?? 'expansor mayor'}.` };
          }
          state.warehouseCapacity = Math.min(WAREHOUSE_MAX_CAP, state.warehouseCapacity + tipo.slots);
          break;
        }
        case 'warehouseExpander':
          // Stock de antes de los tipos (+1): sigue sirviendo con el tope
          // nuevo. No es un cuarto tipo —no se vende ni sale de cajas— y por
          // eso no está en la tabla.
          if (state.warehouseCapacity >= WAREHOUSE_MAX_CAP) {
            return { ok: false, msg: `Almacén al máximo (${WAREHOUSE_MAX_CAP}).` };
          }
          state.warehouseCapacity = Math.min(WAREHOUSE_MAX_CAP, state.warehouseCapacity + 1);
          break;
        case 'afk': {
          const base = Math.max(ahora, state.afkExpiresAt || 0);
          // Tope 3 tarjetas: más allá el AFK es infinita y rompe el ritmo
          state.afkExpiresAt = Math.min(base + afkMs, ahora + afkMs * 3);
          break;
        }
        case 'clickBoost': {
          const base = Math.max(ahora, state.buffs.clickBoostExpiresAt);
          state.buffs.clickBoostExpiresAt = Math.min(base + 30 * 60_000, ahora + 60 * 60_000);
          break;
        }
        case 'passiveBoost': {
          const base = Math.max(ahora, state.buffs.passiveBoostExpiresAt);
          state.buffs.passiveBoostExpiresAt = Math.min(base + 60 * 60_000, ahora + 2 * 60 * 60_000);
          break;
        }
        case 'clickX2': {
          const base = Math.max(ahora, state.buffs.clickX2ExpiresAt);
          state.buffs.clickX2ExpiresAt = Math.min(base + 30_000, ahora + 30 * 60_000);
          break;
        }
        case 'clickX3': {
          const base = Math.max(ahora, state.buffs.clickX3ExpiresAt);
          state.buffs.clickX3ExpiresAt = Math.min(base + 30_000, ahora + 30 * 60_000);
          break;
        }
        case 'calibrationStone':
        case 'stabilityNano':
          // No se usan desde el almacén: se consumen en la Forja
          return { ok: false, msg: 'Este consumible se usa en la Forja.' };
        default:
          return { ok: false, msg: 'Este consumible no tiene efecto conocido.' };
      }

      consumeWarehouseItem(item.id, 1);
      syncWarehouseGaps();

      refreshAfkCardCount();
      recalculatePassiveIncome();
      checkAchievements();
      onUpdate(state, isAfk);
      saveToFirebase();
      return { ok: true, msg: `${item.name}: aplicado` };
    },
    click: () => {
      handleUserActivity();
      // Si estábamos esperando un click después del AFK, retomar pasivos
      if (awaitingClickAfterAfk) {
        awaitingClickAfterAfk = false;
      }
      const collectorDamage = calculateClickDamage();
      const multiplier = calculateMultiplier();
      const totalGain = Math.floor(collectorDamage * multiplier);
      state.nanites += totalGain;
      state.totalNanitesProduced += totalGain;
      state.totalClicks += 1;
      checkAchievements();
      onUpdate(state, isAfk);
      // POR QUÉ DEVUELVE EL ENTERO Y NO DEJA QUE LA VISTA LO CALCULE. La vista
      // pintaba `+{formatNumber(estado.nanites - antes)}`: restaba dos lecturas
      // del estado para deducir lo que había entrado, y esa resta no es un número
      // que exista en ningún sitio. Con el buff de pasivoactivatingse en mitad,
      // o con cualquier cobro que lande entre las dos lecturas, la diferencia
      // incluía dinero de otro origen y el "+N" no era el del click.
      //
      // El motor es el único que sabe cuánto entró, así que el motor lo dice
      // (R1, R3). Lo que se paint es lo que se cobró, no una resta.
      return totalGain;
    },
    /**
     * Sintoniza el recolector equipado con un cristal del nivel pedido.
     *
     * EL RESULTADO TIENE TRES ESTADOS, NO DOS, y por eso `rolled` existe.
     *
     * `success` dice si el dado salió bueno, y eso no distingue entre "el dado
     * salió mal" y "no se llegó a tirar el dado". Los dos casos devuelven
     * `success: false`, porque los rechazos (no hay cristal de ese nivel, faltan
     * unidades, ya está en el techo) también son `false`. Para quien llama, sin
     * embargo, son cosas distintas: un fallo del dado GASTA el cristal y la
     * ruleta tiene que girar y decir "has fallado"; un rechazo NO gasta nada y
     * lo que corresponde es un aviso, no un trompo por una operación que no
     * ocurrió.
     *
     * La señal de cuál es cuál es el propio `success`, pero implícita y frágil:
     * dependería de que cada rechazo se olvidara de mandar `success`, y en
     * cuanto uno lo mandara la ruleta giraría por una operación inexistente. Se
     * dice explícitamente con `rolled`, y se dice aquí, en el motor, que es el
     * único que sabe si el dado llegó a tirarse. Que la vista lo deduje
     * mirando si el cristal se gastó sería meter una regla del motor en la
     * vista (R1 y R2), y se rompería en cuanto el consumo dejara de ser una
     * línea recta.
     */
    upgradeEquippedCollector: (crystalTier = 1) => {
      handleUserActivity();
      if (!state.equippedCollectorId) return { success: false, rolled: false, msg: 'No hay ningún recolector equipado.' };
      const item = state.warehouse.find((w: any) => w.id === state.equippedCollectorId);
      if (!item) return { success: false, rolled: false, msg: 'Recolector no encontrado.' };
      const level = item.level || 0;
      // EL TOPE LO PONE EL RECOLECTOR, Y LO PONE LA MISMA REGLA QUE LO CREA.
      //
      // Antes se comparaba contra un `MAX_COLLECTOR_LEVEL = 20` fijo de este
      // fichero, mientras un recolector forjado nace con `maxLevel: 20 + potencial
      // * 3`, o sea entre 23 y 35. El jugador veía una barra que llegaba a 28, el
      // botón de sintonizar aceptaba el gasto del cristal, y a partir del 20 el
      // juego respondía "ya no puedes". Un techo que la pantalla no enseña es peor
      // que uno pequeño, porque el jugador gasta para llegar a algo que no existe.
      // El `as any` es R24 aplicado a un caso concreto: `state.warehouse` está
      // anotado con el `WarehouseItem` de `types.ts`, que es VESTIGIAL y no
      // declara `maxLevel`, mientras que el modelo que de verdad describe el
      // dominio (`types/domain.ts`) sí lo tiene y `data/crafting.ts` lo rellena.
      // Los dos modelos de tipos conviven y no se van a fusionar aquí; lo que no
      // vale es que el motor no pueda leer un campo que el juego escribe.
      const tope = collectorMaxLevel((item as any).maxLevel);
      if (level >= tope) return { success: false, rolled: false, msg: `Recolector al nivel máximo (+${tope * 10}%).` };

      // El cristal se busca por nivel en el almacén, no en un contador suelto.
      // Un cristal de nivel 3 no se gasta por uno de nivel 1: por eso hay que
      // encontrar el item exacto y consumirlo, en vez de restar una unidad.
      const crystal = state.warehouse.find((w: any) =>
        w.type === 'crystal' && (typeof w.tier === 'number' ? w.tier : 1) === crystalTier);
      if (!crystal) {
        const nombre = CRYSTAL_DEFS[crystalTier]?.name ?? 'Cristal';
        return { success: false, rolled: false, msg: `No tienes ${nombre}.` };
      }

      // Coste en cristales creciente: antes era 1 por nivel, así que 20 niveles
      // salían por 20 cristales y el timing de mejora era irrelevante
      const crystalCost = collectorUpgradeCost(level);
      const units = crystal.stackCount || 1;
      if (units < crystalCost) {
        return {
          success: false,
          rolled: false,
          msg: `Necesitas ${crystalCost} x ${CRYSTAL_DEFS[crystalTier].name} (tienes ${units}).`
        };
      }

      consumeWarehouseItem(crystal.id, crystalCost);
      syncWarehouseGaps();
      syncMaterialCounters();

      // La probabilidad la fija el cristal: mejor cristal, más probabilidad.
      const successChance = crystalSuccessChance(level, CRYSTAL_DEFS[crystalTier]?.power ?? 1);
      const roll = Math.random() * 100;

      if (roll <= successChance) {
        item.level = level + 1;
        onUpdate(state, isAfk);
        saveToFirebase();
        return { success: true, rolled: true, level: item.level, msg: `¡Mejora exitosa! ${item.name} ascendió al nivel ${item.level}.` };
      } else {
        // Fallo: conserva el nivel y el cristal gastado. Antes retrocedía un
        // nivel, y con el coste creciente eso era una escalera sin retorno:
        // el jugador que fallaba dos veces quedaba atrapado para siempre.
        // La pérdida real es el cristal, que es el coste que se eligió arriesgar.
        onUpdate(state, isAfk);
        saveToFirebase();
        return { success: false, rolled: true, level, msg: `Fallo en el sintonizador. ${item.name} se mantiene en nivel ${level}. (-${crystalCost} cristales)` };
      }
    },
    // F27 · `expandWarehouse()` (+5 por 500, tope 50) y `unlockCompanionSlot()`
    // (tope 5) estaban aquí sin que ninguna vista los llamara: eran un tercer
    // y cuarto camino de ampliación con reglas distintas —y el tope 5
    // contradecía el 6 de F11—. Solo los usaban los bancos. El único camino es
    // comprar expansores por tipo y usarlos; estos dos se borran en vez de
    // migrarse, porque migrar un camino muerto es conservarlo.
    /**
     * Alias de `equipCompanion`. Se conserva porque el guardado y el HTML
     * histórico lo nombran así, pero ya no tiene lógica propia: mantener dos
     * implementaciones de "activar/desactivar compañero" es justo lo que dejó
     * los dos caminos haciendo cosas distintas.
     */
    toggleCompanionActive: (compId: string) => estado.equipCompanion(compId),
    equipCollector: (itemId: string) => {
      handleUserActivity();
      const item = state.warehouse.find((w: any) => w.id === itemId);
      if (!item || item.type !== 'collector') return false;

      // ¿Está YA equipado? Se pregunta por el ID, no por la bandera.
      //
      // La bandera es una proyección de este campo y puede haberla descolocado
      // un guardado viejo. Preguntar por ella hacía dos cosas malas: si la
      // bandera estaba puesta y el id vacío,Equipar en vez de Desequipar (y
      // el jugador veía el botón al revés); y al desequipar, este `null`
      // borraba el equipado de verdad sin mirar cuál era, dejando al jugador
      // sin recolector.
      const yaEquipado = state.equippedCollectorId === item.id;

      // El id manda y la bandera se recalcula a partir de él, siempre. Esta
      // llamada es la que deja los dos sitios diciendo lo mismo.
      //
      // `adoptarBandera` va en false al desequipar: el rescate de bandera
      // existe para arreglar guardados viejos al cargar, y si se aplicara aquí
      // el propio clic de "Desequipar" volvería a marcar el item y no
      // bajaría la bandera. El jugador lo vería como un botón que no hace
      // nada —que es el mismo síntoma que se estaba reportando.
      const { id } = reconcileEquippedCollector(
        state.warehouse,
        yaEquipado ? null : item.id,
        !yaEquipado
      );
      state.equippedCollectorId = id;

      recalculatePassiveIncome();
      onUpdate(state, isAfk);
      saveToFirebase();
      return true;
    },
    /**
     * Activa o desactiva un compañero.
     *
     * Es la ÚNICA implementación. Antes convivía con `toggleCompanionActive`,
     * que hacía lo mismo con una diferencia: ordenaba la lista por tier al
     * insertar. Dos caminos para lo mismo, y el que usaba la vista era el que
     * no ordenaba, así que el orden de la lista dependía de por dónde se
     * hubiera equipado. Ahora `toggleCompanionActive` es un alias de aquí.
     *
     * El id se valida contra `state.companions` antes de gastarle una ranura:
     * `activeCompanions` es una lista de ids y el ingreso se calcula cruzando
     * con `state.companions`. Sin esta comprobación, un id que no está ahí
     * ocupaba una de las pocas ranuras y no pagaba nada, sin avisar — con tres
     * ranuras, un id colado era un tercio del ingreso pasivo evaporado en
     * silencio.
     */
    equipCompanion: (compId: string) => {
      handleUserActivity();
      const index = state.activeCompanions.indexOf(compId);
      if (index > -1) {
        state.activeCompanions.splice(index, 1);
      } else {
        if (!state.companions.some((c: any) => c.id === compId)) return false;
        if (state.activeCompanions.length < effectiveCompanionSlots()) {
          state.activeCompanions.push(compId);
          // Orden estable por tier: la lista se pinta en este orden y el
          // jugador la coloca a mano esperando verla así.
          state.activeCompanions.sort((a, b) => {
            const compA = state.companions.find((c: any) => c.id === a);
            const compB = state.companions.find((c: any) => c.id === b);
            return (compA?.tier || 0) - (compB?.tier || 0);
          });
        } else {
          return false;
        }
      }
      recalculatePassiveIncome();
      onUpdate(state, isAfk);
      saveToFirebase();
      return true;
    },
    buyStoreItem: (itemKey: keyof typeof STORE_ITEMS, units?: number) => {
      handleUserActivity();
      const item = STORE_ITEMS[itemKey];
      if (!item) return false;

      // F14 · CUÁNTAS. Solo lo apilable se compra en lote; el resto vale una.
      // Un 0 o un texto es cantidad no válida y se rechaza sin cobrar.
      const n = unidadesCompra(itemKey as string, units);
      if (n < 1) return false;

      // El árbol de pasivas abarata la tienda. El descuento se aplica al
      // cobrar, no al mostrar: así el precio de la carta y el cobrado salen
      // siempre del mismo número. En lote es N veces el unitario —lo mismo
      // que N compras de una—, y ese total lo enseña el diálogo con
      // `getBulkCost`, que hace esta misma cuenta.
      const unit = precioUnitarioTienda(itemKey as string);
      const cost = unit * n;
      if (state.nanites < cost) return false;

      // Validar antes de cobrar: los slots son únicos y no se pueden repetir.
      // Se comparan sobre el total efectivo para que un slot del árbol no
      // "bloquee" la compra del siguiente de tienda.
      //
      // F7/F11 · LAS RANURAS SALEN DE LA TABLA, NO DE TRES `if`.
      //
      // Antes había un `if` por carta con su número escrito dentro (`>= 2` y
      // `>= 5`), y el `=` de más abajo también. Cuatro números a mano para lo mismo,
      // y por eso la tarjeta decía "+3" cuando el motor daba 5.
      //
      // Ahora se busca la compra en `COMPANION_SLOT_BUY` y se compara con el número
      // que da ESA fila. Añadir una cuarta ranura es añadir una fila a la tabla y
      // una carta a `STORE_ITEMS`; no es acordarse de un `if`, de un `=` y de un
      // texto. Y si la fila no existe, la carta no existe, así que no hay un
      // camino que conceda ranuras que la tabla no dice.
      const effSlots = effectiveCompanionSlots();
      const compraRanura = RANURA_POR_CARTA[itemKey];
      if (compraRanura && effSlots >= compraRanura.da) return false;

      // Validar mochila llena.
      //
      // Llaves y cristales AHORA SÍ ocupan ranura: son items físicos. Lo que no
      // ocupa espacio son las Ampliaciones de almacén y los Huecos de
      // compañero, porque no son objetos que se guarden: son permisos.
      if (!cabeLaCompra(itemKey as string)) {
        showToast('Almacén lleno. No puedes comprar más items.', 'error');
        return false;
      }

      state.nanites -= cost;

      // A partir de aquí la compra está cobrada. Si `addToWarehouse` dice que no
      // cabe, hay que DEVOLVER el dinero antes de salir: un "no compres" que
      // descuenta las nanitas es peor que un bug visible, porque el jugador
      // pierde el saldo sin ver por qué.
      if (STORE_KEY_TIER[itemKey] !== undefined || itemKey === 'upgradeCrystal') {
        // Llaves y cristales son items del almacén. Antes eran solo contadores:
        // el jugador no los veía, no los podía ordenar y no ocupaban ranura.
        //
        // El nivel de la llave lo dice la CARTA (`keyT2` → nivel 2), no una
        // constante del motor. Con una constante única, la carta se llamaba
        // "Llave de Cifrado" y entregaba la Reforzada: el nombre, el precio y
        // el item eran tres cosas distintas y ninguna se deducía de las otras
        // dos (B7).
        const esLlave = STORE_KEY_TIER[itemKey] !== undefined;
        const tier = esLlave ? STORE_KEY_TIER[itemKey] : STORE_MATERIAL_TIER;
        const item = createMaterialItem(esLlave ? 'key' : 'crystal', tier);
        // F14 · el lote entra de una vez: `addToWarehouse` lo funde con la
        // pila que haya. Las unidades no piden ranura nueva (una pila es una
        // ranura), así que la pregunta de espacio de arriba sigue valiendo.
        item.stackCount = n;
        if (!addToWarehouse(item)) { state.nanites += cost; return false; }
        syncMaterialCounters();
        onUpdate(state, isAfk);
        saveToFirebase();
        return item;
      } else if (itemKey === 'commonCrate' || itemKey === 'rareCrate' || itemKey === 'epicCrate' || itemKey === 'legendaryCrate') {
        // La caja es un item real del almacén: sin esto no se puede abrir
        const crateType = itemKey.replace('Crate', '').toLowerCase() as CrateType;
        const warehouseItem = createCrateItem(crateType, n);
        if (!addToWarehouse(warehouseItem as any)) { state.nanites += cost; return false; }
        syncCrateCounters();
        onUpdate(state, isAfk);
        saveToFirebase();
        return warehouseItem;
      } else if (CONSUMABLES[itemKey as keyof typeof CONSUMABLES]) {
        const def = CONSUMABLES[itemKey as keyof typeof CONSUMABLES];
        const warehouseItem = {
          id: `cons_${itemKey}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: def.name,
          type: 'consumable' as const,
          details: def.details,
          rarity: def.rarity,
          tier: 0,
          sellPrice: Math.floor(item.cost / 4),
          stackable: true,
          stackCount: n,
          // Identificador estable: el almacén decide el efecto por este campo,
          // no por el nombre (los nombres ya han cambiado varias veces)
          buffId: def.buffId
        };
        // `addToWarehouse` y no un `if` de capacidad: tres tarjetas AFK son
        // una ranura, así que la tercera se compra con el almacén lleno. Con el
        // `if` de antes la compra caía al final de la función, devolvía true y
        // el jugador pagaba por nada.
        if (!addToWarehouse(warehouseItem as any)) {
          state.nanites += cost;
          return false;
        }
        refreshAfkCardCount();
        onUpdate(state, isAfk);
        saveToFirebase();
        return warehouseItem;
      } else if (RANURA_POR_CARTA[itemKey]) {
        // F7/F11 · El número que da esta ranura, de la misma tabla que la usa el
        // `if` de arriba. Un solo sitio decide cuántas ranuras hay (R2).
        const compra = RANURA_POR_CARTA[itemKey];
        state.maxCompanionSlots = compra.da;
        onUpdate(state, isAfk);
        saveToFirebase();
        return {
          id: `slots${compra.da}_${Date.now()}`,
          name: compra.etiqueta,
          type: 'upgrade',
          details: `${compra.da} slots de compañero activos`,
          rarity: 'Épico',
          tier: 0
        };
      } else if (itemKey.startsWith('companionCardT')) {
        const tier = parseInt(itemKey.replace('companionCardT', ''));
        const comp = generateCompanionByTier(tier);
        state.companions.push(comp);
        const warehouseItem = {
          id: comp.id,
          name: comp.name,
          type: 'companion' as const,
          details: `Recolección por segundo: +${comp.power}/s`,
          rarity: comp.rarity,
          tier: comp.tier,
          sellPrice: Math.floor(item.cost / 4)
        };
        // Un compañero SIEMPRE necesita ranura propia —dos Dron Explorador son
        // dos celdas, para que el jugador pueda elegir cuál equipar—, así que
        // aquí `addToWarehouse` no tiene pila a la que fundirse y decide.
        if (!addToWarehouse(warehouseItem)) {
          state.companions.pop();
          state.nanites += cost;
          return false;
        }
        onUpdate(state, isAfk);
        saveToFirebase();
        return warehouseItem;
      } else if (itemKey.startsWith('collectorCardT')) {
        const tier = parseInt(itemKey.replace('collectorCardT', ''));
        const collector = generateCollectorByTier(tier);
        const warehouseItem = {
          ...collector,
          sellPrice: Math.floor(item.cost / 4)
        };
        if (!addToWarehouse(warehouseItem)) {
          state.nanites += cost;
          return false;
        }
        onUpdate(state, isAfk);
        saveToFirebase();
        return warehouseItem;
      }

      // Sin rama que lo entregue no hay compra: se devuelve el dinero. Antes se
      // devolvía `true` habiendo cobrado, y una carta retirada de la tienda
      // (o una clave inventada) cobraba sin dar nada. Un "no compres" que
      // descuenta es peor que un bug visible.
      state.nanites += cost;
      return false;
    },

    /**
     * Abre una caja del almacén consumiendo la llave correcta.
     *
     * ANTES: `openCrateBox(crateType)` solo miraba `state.keys`. El almacén no
     * participaba: el botón de la vista restaba una unidad del item Y el juego
     * restaba una del contador, sin que nadie se enterara. Resultado: la caja
     * se quedaba en la rejilla y el contador bajaba, o al revés.
     *
     * AHORA: se pasa el ID de la caja y el de la llave. El game loop busca
     * ambos items, valida que la llave sirva para ese cofre, y los consume a
     * los dos en la misma operación. Si algo falla, no se toca nada.
     */
    openCrateBox: (crateId: string, keyId: string): { ok: boolean; msg?: string; reward?: any; crateType?: CrateType } => {
      handleUserActivity();

      const caja = state.warehouse.find((w: any) => w.id === crateId && w.type === 'crate');
      if (!caja) return { ok: false, msg: 'La caja ya no está en el almacén.' };

      const crateType = getCrateTypeFromName(caja.name || '') as CrateType | null;
      if (!crateType) return { ok: false, msg: 'No se reconoce el tipo de esta caja.' };

      const llave = state.warehouse.find((w: any) => w.id === keyId && w.type === 'key');
      if (!llave) return { ok: false, msg: 'Ya no tienes esa llave.' };

      const llaveTier = (typeof llave.tier === 'number' ? llave.tier : keyTierFromName(llave.name || '')) as KeyTier;
      const necesaria = CRATE_KEY_TIER[crateType];

      if (!keyOpens(llaveTier, necesaria)) {
        return {
          ok: false,
          msg: `${llave.name} no abre ${CRATE_TYPES[crateType].name}. Necesitas ${KEY_DEFS[necesaria].name}.`
        };
      }

      // Se consumen los dos items ANTES de sortear. Si el sorteo fallara por
      // una excepción, el jugador ya habria perdido la caja sin recibir nada:
      // peor que un bug visible.
      consumeWarehouseItem(caja.id, 1);
      consumeWarehouseItem(llave.id, 1);
      syncWarehouseGaps();
      state.cratesOpened += 1;

      // El botín lo decide la tabla (crateLoot) y se aplica aquí. La ruleta solo
      // lo muestra: si la animación decidiera, mentiría sobre las probabilidades.
      const premio = rollCrateReward(crateType, {
        nanites: (n) => { state.nanites += n; state.totalNanitesProduced += n; },
        // El segundo argumento es el NIVEL que anuncia el botín, y se respetaba antes.
        // Aquí se tiraba: eran `grantCrystals(1, n)` y `grantKeys(1, n)` con el 1
        // fijo. Consecuencia: una caja legendaria, que anuncia "Llave Rúnica"
        // (nivel 2) y "Cristales de Fase" (nivel 2), entregaba una Llave
        // Reforzada y un Cristal de Afino, ambos de nivel 1. El jugador veía un
        // nombre y recibía otro, que es exactamente lo que la ruleta no debe
        // hacer: Decide el premio y solo lo MUESTRA, así que el nombre que
        // enseña y el item que entra tienen que ser el mismo.
        //
        // Con el módulo de apilado el efecto era peor que cosmético: como todas
        // las llaves de caja caían en nivel 1, se fundían en UNA sola pila. La
        // rúnica de la legendaria entraba en la misma celda que la de Cifrado de
        // la común y no había forma de separarlas ni de recuperarlas.
        crystals: (n, materialTier) => { grantCrystals(materialTier, n); },
        keys: (n, keyTier) => { grantKeys(keyTier, n); },
        hasSpace: () => countOccupiedSlots(state.warehouse) < effectiveWarehouseCapacity(),
        // El cosmético no es un item: no pasa por `addItem` ni por el almacén.
        // Se desbloquea aquí y lo persiste el `saveToFirebase` de más abajo, que
        // corre en la misma operación que el resto del botín.
        unlockCosmetic: (cosmeticId) => desbloquearCosmetico(cosmeticId),
        ownedCosmetics: () => state.cosmetics.unlocked,
        addItem: (item) => {
          if (!addToWarehouse(item as any)) return false;
          // El item trae `companionType` y `power` ya resueltos por crateLoot.
          // Antes se deducían parseando `details` con regex y el multiplicador
          // 0.75 se guardaba como 0.5.
          if (item.type === 'companion' && !state.companions.some((c: any) => c.id === item.id)) {
            state.companions.push({
              id: item.id,
              name: item.name,
              type: item.companionType || 'passive',
              power: typeof item.power === 'number' ? item.power : 1,
              rarity: item.rarity,
              tier: item.tier
            });
          }
          return true;
        }
      });

      // Los contadores se recalculan DESPUÉS de aplicar el botín, para que
      // incluyan lo que acaba de caer. Recalcularlos antes era lo que dejaba el
      // almacén y los contadores desincronizados.
      syncCrateCounters();
      syncMaterialCounters();
      refreshAfkCardCount();
      recalculatePassiveIncome();
      onUpdate(state, isAfk);
      saveToFirebase();
      return { ok: true, reward: premio, crateType };
    },

    // ======================================================================
    //  PRESTIGIO
    // ======================================================================

    /** Núcleos disponibles y los que daría el siguiente reinicio. */
    getPrestigeInfo: () => ({
      cores: state.cores,
      totalCores: state.totalCores,
      pending: nextCores({
        totalNanitesProduced: state.totalNanitesProduced,
        totalCores: state.totalCores,
        coreGain: state.bonus.coreGain
      }),
      resets: state.resets,
      totalProduced: state.totalNanitesProduced,
      bonus: state.bonus
    }),

    /**
     * Recicla el progreso: devuelve nanitas, recolectores, compañeros e infraestructura
     * a cambio de núcleos.
     *
     * Un detalle que parece obvio y no lo es: las recolectores que el jugador ya
     * forjó también se pierden, porque viven en el almacén. Se conserva a
     * propósito solo lo que importa como identidad (cuántas forjó), no el
     * inventario. Si se conservaran los objetos, la forja dejaría de ser una
     * apuesta y `forgedCount` no significaría nada.
     *
     * Lo que NO se pierde: núcleos, nodos del árbol, cosméticos, logros,
     * esquirlas y el contador de recolectores forjadas. Esa es toda la promesa del
     * reinicio, así que el estado se construye explícitamente en vez de
     * hacer `Object.assign` con un reset parcial: si mañana se añade un campo
     * al save, el reinicio lo limpia solo.
     */
    prestige: () => {
      handleUserActivity();
      const gained = nextCores({
        totalNanitesProduced: state.totalNanitesProduced,
        totalCores: state.totalCores,
        coreGain: state.bonus.coreGain
      });
      if (gained <= 0) {
        return { success: false, gained: 0, msg: 'Necesitas producir más para reciclar.' };
      }
      // POR QUÉ AQUÍ NO HAY NINGÚN RELLENO A CERO.
      //
      // Hubo uno: si `totalCores` venía a cero se rellenaba con
      // `pendingCores(totalNanitesProduced)`, pensando en las partidas viejas que
      // no traían el campo. La idea era que el histórico no se quedara congelado.
      //
      // El problema es que el histórico ANTES de este reinicio ya está incluido en
      // `gained`, y volver a rellenarlo lo contaba dos veces. Con 1 M de producción
      // la primera Ascensión daba 8 núcleos —correcto— y dejaba el histórico en 16.
      // Como `nextCores` RESTA el histórico, el segundo ascenso no daba un núcleo
      // hasta producir 3,17 M en vez de 1 M: el primer reinicio salía por la mitad
      // de precio y no lo decía por ninguna parte.
      //
      // Con `resets > 0` el histórico sí se puede reconstruir; con `resets === 0`
      // es cero y punto, porque el jugador no ha reciclado nunca. Un guardado viejo
      // que no traía el campo se comporta como el que sí: cobra de más una vez, y
      // a partir de ahí el contador ya es real.

      const keptShards = state.shards;
      const keptForged = state.forgedCount;
      const keptAchievements = [...state.unlockedAchievements];
      const keptCores = state.cores + gained;
      // `totalCores` es el HISTÓRICO de núcleos ganados, y tiene que incluir los
      // que se acaban de ganar. `nextCores` lo resta del total que la producción
      // actual justifica (`pendingCores`), así que si aquí no se sumaran, el
      // histórico se quedaría congelado en el primer reinicio: cada vez daría los
      // núcleos de la primera vez, en vez de la diferencia, y la barra de progreso
      // del prestigio nunca avanzaría de 0.
      const keptTotalCores = state.totalCores + gained;
      const keptResets = state.resets + 1;
      const keptNodes = { ...state.nodeLevels };
      const keptCosmetics = { ...state.cosmetics, unlocked: [...state.cosmetics.unlocked] };

      // Reinicio total
      Object.assign(state, {
        nanites: 0,
        totalNanitesProduced: 0,
        passiveIncome: 0,
        passiveMultiplier: 1,
        totalClicks: 0,
        totalInfraestructure: 0,
        cratesOpened: 0,
        keys: 3,
        upgradeCrystals: 5,
        warehouseCapacity: 15,
        maxCompanionSlots: 1,
        afkCards: 0,
        afkExpiresAt: 0,
        crates: { common: 2, rare: 0, epic: 0, legendary: 0 },
        equippedCollectorId: null,
        companions: [baseCompanion],
        activeCompanions: [],
        warehouse: [
          { id: 'collector_blaster_001', name: 'Blaster Láser', type: 'collector', details: 'Recolección por click: +5', rarity: 'Común', tier: 1, level: 0, damage: 5, sellPrice: 250 },
          { id: 'companion_base_001', name: 'Dron Explorador', type: 'companion', details: 'Recolección por segundo: +5/s', rarity: 'Común', tier: 1, sellPrice: 250 }
        ],
        buffs: { clickBoostExpiresAt: 0, passiveBoostExpiresAt: 0, clickX2ExpiresAt: 0, clickX3ExpiresAt: 0 },
        // Lo permanente
        cores: keptCores,
        totalCores: keptTotalCores,
        resets: keptResets,
        nodeLevels: keptNodes,
        unlockedNodes: Object.keys(keptNodes),
        shards: keptShards,
        forgedCount: keptForged,
        unlockedAchievements: keptAchievements,
        cosmetics: keptCosmetics
      });

      recomputeBonuses();
      rebuildAchievementBonuses();
      syncCompanionsToWarehouse();
      // Aquí `crates: { common: 2 }` son las cajas de partida nueva que acaba de
      // escribir el reinicio: hay que convertirlas en items de verdad.
      materializePendingCrates();
      recalculatePassiveIncome();
      checkAchievements();
      onUpdate(state, isAfk);
      saveToFirebase();
      return { success: true, gained, msg: `+${gained} núcleos` };
    },

    /** Compra un nivel de un nodo del árbol. */
    buyNode: (nodeId: string) => {
      handleUserActivity();
      const check = canBuyNode(nodeId, state.nodeLevels, state.cores);
      if (!check.ok) return { success: false, msg: check.reason ?? 'No se puede comprar.' };

      const node = TREE_BY_ID[nodeId];
      const level = state.nodeLevels[nodeId] || 0;
      const cost = nodeCost(node, level);
      state.cores -= cost;
      state.nodeLevels[nodeId] = level + 1;
      recomputeBonuses();
      recalculatePassiveIncome();
      onUpdate(state, isAfk);
      saveToFirebase();
      return { success: true, msg: `${node.name} → nivel ${level + 1}` };
    },

    // ======================================================================
    //  CRAFTEO
    // ======================================================================

    /**
     * Fusiona 3 recolectores del mismo tier en una de tier+1.
     * `stonesUsed` es cuántas Piedras de Calibración se consumen: cada una
     * sube 12 puntos la probabilidad, hasta 5.
     */
    forgeCollector: (materialIds: string[], stonesUsed = 0, nanoUsed = 0) => {
      handleUserActivity();
      if ((state.nodeLevels.blueprint || 0) < 1) {
        return { success: false, msg: 'Necesitas el nodo "Planos Viejos" para craftear.' };
      }
      if (materialIds.length !== 3) {
        return { success: false, msg: 'Selecciona exactamente 3 recolectores.' };
      }
      const materials = materialIds
        .map(id => state.warehouse.find((w: any) => w.id === id))
        .filter((w: any): w is any => !!w);
      if (materials.length !== 3) return { success: false, msg: 'Material no encontrado.' };
      if (materials.some((m: any) => m.type !== 'collector')) {
        return { success: false, msg: 'Solo se pueden fusionar recolectores.' };
      }
      const tier = materials[0].tier || 1;
      if (materials.some((m: any) => (m.tier || 1) !== tier)) {
        return { success: false, msg: 'Las 3 recolectores deben ser del mismo tier.' };
      }
      // El recolector equipado no se puede consumir: perderla sería un castigo doble
      // Forja infinita: sin techo de tier (el `tier >= 11` se fue). El precio
      // (2^n materiales) frena solo, y las fórmulas de poder, rareza y valor
      // ya llegan donde llegue.
      if (materials.some((m: any) => m.equipped || m.id === state.equippedCollectorId)) {
        return { success: false, msg: 'No puedes fusionar el recolector equipado. Desequípala primero.' };
      }

      // Consumir piedras
      const stonesToUse = Math.max(0, Math.min(5, stonesUsed));
      if (stonesToUse > 0) {
        const stone = state.warehouse.find(
          (w: any) => w.type === 'consumable' && w.buffId === 'calibrationStone'
        );
        if (!stone) return { success: false, msg: 'No tienes Piedras de Calibración.' };
        const available = stone.stackCount || 1;
        if (available < stonesToUse) {
          return { success: false, msg: `Solo tienes ${available} Piedra(s) de Calibración.` };
        }
        stone.stackCount = available - stonesToUse;
        if (stone.stackCount <= 0) {
          state.warehouse = state.warehouse.filter((w: any) => w.id !== stone.id);
        }
      }

      // Consumir la nanopartícula, como mucho una por fusión
      const nanoToUse = nanoUsed > 0 ? 1 : 0;
      if (nanoToUse > 0) {
        const nano = state.warehouse.find(
          (w: any) => w.type === 'consumable' && w.buffId === 'stabilityNano'
        );
        if (!nano) return { success: false, msg: 'No tienes Nanopartículas de Estabilidad.' };
        const available = nano.stackCount || 1;
        if (available < nanoToUse) {
          return { success: false, msg: `Solo tienes ${available} Nanopartícula(s).` };
        }
        nano.stackCount = available - nanoToUse;
        if (nano.stackCount <= 0) {
          state.warehouse = state.warehouse.filter((w: any) => w.id !== nano.id);
        }
      }

      const author = user.displayName || username || 'Anónimo';
      const result = attemptForge(materials, tier, author, {
        craftLuck: state.bonus.craftLuck,
        shardBonus: state.bonus.shardBonus,
        stonesUsed: stonesToUse,
        nanoUsed: nanoToUse
      });

      if (result.error) {
        return { success: false, msg: result.error };
      }

      if (result.success && result.collector) {
        const w = result.collector;
        w.sellPrice = sellPrice(w as any, { sellMult: 1 + state.bonus.sellMult });
        // Restar 2 y devolver 1 en lugar de perder las tres: la tensión se
        // mantiene (pierdes 2 recolectores) sin que un mal rollo vacíe el almacén.
        const keep = materials.reduce((a: any, m: any) => (a.damage < m.damage ? a : m), materials[0]);
        state.warehouse = state.warehouse.filter(
          (x: any) => !materialIds.includes(x.id) || x.id === keep.id
        );
        state.warehouse.push(w as any);
        state.forgedCount += 1;
        recalculatePassiveIncome();
        checkAchievements();
        onUpdate(state, isAfk);
        saveToFirebase();
        return {
          success: true,
          collector: w,
          chance: result.chanceUsed,
          msg: `${w.name} forjada`
        };
      }

      // Fallo: se pierden las 3 y se ganan esquirlas
      state.warehouse = state.warehouse.filter((x: any) => !materialIds.includes(x.id));
      state.shards += result.shards || 0;
      onUpdate(state, isAfk);
      saveToFirebase();
      return {
        success: false,
        shards: result.shards,
        chance: result.chanceUsed,
        msg: `Fallo en la forja: +${result.shards} esquirlas`
      };
    },

    /** Cuántas esquirlas hacen falta para garantizar el próximo intento. */
    getForgeInfo: () => ({
      shards: state.shards,
      craftLuck: state.bonus.craftLuck,
      forgeUnlocked: (state.nodeLevels.blueprint || 0) > 0,
      baseChance: (fromTier: number) => {
        const b = 0.78 - (fromTier - 1) * 0.05;
        return Math.min(0.95, Math.max(0.30, b) + state.bonus.craftLuck);
      }
    }),

    // ======================================================================
    //  VALORACIÓN Y VENTA
    // ======================================================================

    /**
     * Precio de venta de UNA UNIDAD, con la bonificación del árbol.
     *
     * Ojo al nombre: es el precio unitario. Para una pila de 19 llaves son 480,
     * no lo que se cobra por venderla. Para el total está `getSellTotal`.
     */
    getSellPrice: (itemId: string): number => {
      const item: any = state.warehouse.find((w: any) => w.id === itemId);
      if (!item) return 0;
      return getSellPriceFor(item);
    },

    /**
     * Lo que cobra `sellItem` por este item: unidad × unidades.
     *
     * Existe porque `getSellPrice` es el UNITARIO y esa distinción se ha
     * perdido ya una vez: el botón "Vender" pintaba `getSellPrice` sin
     * multiplicar, así que con una pila de 20 llaves decía "Vender · 480 ◆" y el
     * modal de al lado decía "por 9.600 nanitas". El jugador ve un número, lo
     * acepta y se le cobra otro (R3).
     *
     * `units` es la cantidad a cotizar. Sin él, la pila entera: es lo que
     * pintan la ficha y el botón. Con él, lo que el jugador está a punto de
     * vender, y lo pinta el selector de cantidad en vivo mientras teclea.
     *
     * Vive aquí y no en la vista para que el botón, el modal y el cobro no puedan
     * discrepar por redondeo o por una pila olvidada: es la misma expresión que
     * usa `sellItem`, y si algún día cambia la fórmula cambia en los tres sitios
     * porque son el mismo código.
     */
    getSellTotal: (itemId: string, units?: number): number => {
      const item: any = state.warehouse.find((w: any) => w.id === itemId);
      if (!item) return 0;
      const vender = unidadesVendibles(item, units);
      return vender > 0 ? Math.floor(getSellPriceFor(item) * vender) : 0;
    },

    /**
     * Lo que cobra `buyStoreItem` por esta carta y estas unidades (F14).
     *
     * El gemelo de `getSellTotal` en la dirección contraria: el diálogo de
     * cantidad lo pinta en vivo y la compra lo cobra, con la misma expresión.
     * Es N veces el unitario —lo mismo que N compras de una—, y una cantidad
     * no válida vale 0, que es lo que `buyStoreItem` rechaza sin cobrar.
     */
    getBulkCost: (itemKey: string, units?: number): number => {
      const n = unidadesCompra(itemKey, units);
      if (n < 1) return 0;
      return precioUnitarioTienda(itemKey) * n;
    },

    /** El unitario de la carta, con descuento: lo pinta la tarjeta (R3). */
    getStoreUnitCost: (itemKey: string): number => precioUnitarioTienda(itemKey),

    /**
     * Cuántas unidades se pueden comprar de golpe, ahora mismo (F14).
     *
     * Lo no apilable vale 1: la vista compra directo sin preguntar. Lo
     * apilable vale lo que alcanza con el saldo, porque el espacio no limita
     * cantidades —una pila es una ranura, así que si cabe una caben N— y la
     * única pregunta binaria (¿cabe?) ya la responde `cabeLaCompra`. Si no cabe
     * ni una, vale 0 y la vista ni pregunta: deja el camino de siempre para
     * que el motor rechace con su mensaje.
     */
    getBulkMax: (itemKey: string): number => {
      if (unidadesCompra(itemKey, 2) !== 2) return 1;
      if (!cabeLaCompra(itemKey)) return 0;
      const unit = precioUnitarioTienda(itemKey);
      if (unit <= 0) return 1;
      return Math.max(1, Math.floor(state.nanites / unit));
    },

    getCollectorValue: (itemId: string) => {
      const item: any = state.warehouse.find((w: any) => w.id === itemId);
      if (!item || item.type !== 'collector') return 0;
      return collectorValue(item, { sellMult: 1 + state.bonus.sellMult });
    },

    // ======================================================================
    //  COSMÉTICOS
    // ======================================================================

    equipCosmetic: (slot: 'title' | 'frame' | 'banner', cosmeticId: string) => {
      handleUserActivity();
      if (!state.cosmetics.unlocked.includes(cosmeticId)) return false;
      state.cosmetics[slot] = cosmeticId;
      onUpdate(state, isAfk);
      saveToFirebase();
      return true;
    },

    /** Marca un cosmético como desbloqueado. Idempotente. */
    unlockCosmetic: (cosmeticId: string) => desbloquearCosmetico(cosmeticId),

    // ======================================================================
    //  CAPACIDADES EFECTIVAS (la UI debe usar estas, no el valor base)
    // ======================================================================

    getCapacity: () => effectiveWarehouseCapacity(),
    /**
     * ¿Cabe este producto en el almacén?
     *
     * Lo lee la tienda para decidir si el botón va como "Almacén lleno". Va aquí
     * y no en la vista porque es la misma pregunta que se hace `buyStoreItem`
     * antes de cobrar: si las dos no coinciden, el jugador ve un botón apagado
     * para algo que sí podría comprar, o uno encendido que al pulsarlo no da
     * nada.
     */
    // "¿Se puede comprar esto ahora?" Lo que la vista usa para apagar el botón.
//
//  `canBuyStoreItem` antes solo preguntaba "¿cabe en el almacén?", así que una
//  carta ya comprada seguía con el botón encendido: el jugador podía pulsar un
//  producto que ya tenía. Para las ranuras era peor, porque `buyStoreItem` sí
//  rechazaba la segunda compra (hay un `if` para eso) y el resultado era un botón
//  que hacía clic sin efecto, o sea R3 al revés: la vista y el motor discrepaban.
//
//  Ahora la pregunta tiene las dos partes, y en este orden: primero "ya lo tengo",
//  que es un rechazo por partida y no de espacio; después "¿cabe?". Un almacén
//  lleno y una ranura ya comprada es "no cabe", no "ya lo tienes".
canBuyStoreItem: (itemKey: string): boolean => {
  const ranura = RANURA_POR_CARTA[itemKey];
  if (ranura && effectiveCompanionSlots() >= ranura.da) return false;
  return cabeLaCompra(itemKey);
},
    getCompanionSlots: () => effectiveCompanionSlots(),
    getAfkDurationMs: () => afkCardDurationMs(),

    cleanup: async () => {
      if (gameInterval) clearInterval(gameInterval);
      clearInterval(saveInterval);
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handlePresenceChange);
      window.removeEventListener('focus', handlePresenceChange);
      window.removeEventListener('blur', handlePresenceChange);
      window.removeEventListener('pageshow', handlePresenceChange);
      window.removeEventListener('pagehide', handlePresenceChange);
      docWithLifecycle.removeEventListener('freeze', handlePresenceChange);
      docWithLifecycle.removeEventListener('resume', handlePresenceChange);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      // Los de la cola. Sin estos, cerrar sesión y volver a entrar dejaba tres
      // manejadores apuntando al bucle anterior, y un `online` disparaba un
      // guardado de una partida que ya no existía.
      window.removeEventListener('online', reintentarSiHayCola);
      window.removeEventListener('focus', reintentarSiHayCola);
      window.removeEventListener('pageshow', reintentarSiHayCola);
      await saveToFirebase();
    },

    /**
     * Guarda sin detener nada.
     *
     * Existe para el cierre de sesión: `cleanup` para los timers, pero ahí el
     * guardado ocurre DESPUÉS de quitar los escuchas y justo antes de cerrar
     * la sesión de Firebase, que ya deja `setDoc` sin permiso. `flush` fuerza
     * la escritura mientras la sesión sigue viva.
     */
    flush: () => {
      void saveToFirebase();
    }
  };

  return estado;
}
