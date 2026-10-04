import { showToast } from './utils/toast';
import { formatNumber } from './utils/format';
import { db } from './firebase';
import { doc, getDoc, setDoc, deleteField } from 'firebase/firestore';
import { anotarPendiente, hayPendientes, leerCola, confirmarCola } from './services/naniteQueue';
import { rollCrateReward } from './components/crateLoot';
import { evaluateAchievements, createAchievementState, ACHIEVEMENTS, type Achievement } from './achievements';
import type { AchievementId } from './data/achievements';
import { cosmeticsAlcanzables } from './data/cosmetics';
import { SECRET_ACHIEVEMENTS } from './data/achievements';
// Los tiers viven en data/ porque los usan también el crafteo, el mercado y la
// valoración. Se re-exportan aquí para no romper los imports existentes.
export { TIER_SYSTEM, TIER_POWER } from './data/tiers';
import { TIER_SYSTEM, TIER_POWER } from './data/tiers';
import { aggregateBonuses, canBuyNode, pendingCores, nextCores } from './data/prestige';

import { TREE_BY_ID, nodeCost, coresGastadosEnArbol } from './data/tree';
import { attemptForge, attemptForgeCompanion, baseSuccessChance, AFFIX_BY_ID, collectorMaxLevel, potencialDeDanio, danioDeRango, migraPotenciales, migraPotencialesDeCompaneros, migraNivelesDeCompaneros, poderDeCompanero, nivelMaximoDeCompanio, costeDeNivelDeCompanio, multiplicadorDeNivel, poderEfectivoDeCompanio, potencialNormalizado, desgloseDeStat } from './data/crafting';
import { sellPrice, collectorValue } from './data/valuation';
import { countOccupiedSlots, isStackable, partirPilas, stackUnits, topeDePila, pilasNecesarias, stackKey } from './data/stacking';
import { MATERIALES_POR_FUSION } from './data/crafting';

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
  STORE_ITEMS, CRATE_TYPES, CRATE_TIERS, MAX_CRATE_TIER, costeDeCaja, COSTE_POR_TIER,
  CONSUMABLES, COLLECTOR_BASE_COSTS,
  COMPANION_SLOT_COSTS, RANURA_POR_CARTA, EXPANSOR_TIERS, WAREHOUSE_MAX_CAP,
  expansorPorBuff, type CrateType
} from './data/store';
import { AFK_CARD_DURATION_MS, MAX_AFK_BUFF_DURATION_MS, BUFF_FIELDS, type BuffKey } from './data/buffs';
import {
  cuantasVecesCabe, pasoDeConsumible, anotaTotalDeBuff,
  BUFF_TOTAL_CAMPOS, BUFF_TOTAL_FIELDS
} from './data/buffs';
import {
  AUTO_VENTA_POR_DEFECTO, coaccionaAutoVenta, debeVenderseAuto,
  type ConfigAutoVenta, type TipoDeVentaAuto
} from './data/autoventa';
import { generateCompanionByTier, generateCollectorByTier } from './data/generators';
import { costeDeNivel, valorDeUnCristal } from './data/crafting';

// Se re-exportan las que el resto del juego ya importaba de aquí, con el mismo
// motivo que `TIER_SYSTEM` unas líneas más arriba: romper diez imports de golpe
// no aporta nada y hace la mudanza más difícil de revisar. Lo que importa es que
// quien los use los use para lo que sirven —una tabla o una fórmula—, no para
// llegar al motor.
export { STORE_ITEMS, CRATE_TYPES, COLLECTOR_BASE_COSTS, COMPANION_SLOT_COSTS };
export { AFK_CARD_DURATION_MS, MAX_AFK_BUFF_DURATION_MS, BUFF_FIELDS };
export { costeDeNivel, valorDeUnCristal };
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
export function previewUpgradeChance(level: number): number {
  return chanceDeSintonizacion(level);
}

/**
 * Coste de la sintonización, en unidades del recurso de cristal.
 *
 * Igual que el anterior: el juego cobra esto, la vista lo enseña. Duplicar el
 * cálculo en la interfaz sería una forma de que el botón dijera una cifra y el
 * cobro otra.
 *
 * **Y POR QUÉ AHORA NECESITA EL TIER.** Antes no lo necesitaba porque el coste era
 * el mismo para todos los items: el nivel del cristal, no el del item, era lo que se
 * pagaba. Con un solo cristal el nivel del item **es** el eje del precio, así que una
 * función de un solo argumento sería media regla: la vista no podría enseñar el
 * botón sin saber qué item tiene delante, y acabaría enseñando el coste de otro.
 */
export function previewUpgradeCost(tier: number, level: number): number {
  return costeDeNivel(tier, level);
}
// `KeyDef` y `CrystalDef` se importaban aquí y ya no se usan: el precio de
// reventa del material salía de `def.cost`, y al salir de `STORE_ITEMS` se han
// quedado sin uso. Se borran en vez de dejarlos, porque un tipo importado que
// no lee nadie es la señal de que la regla se movió y nadie lo anotó.
//
// **`keyTierFromName` SIGUE IMPORTADO, Y SOLO PARA LA REDENCIÓN.** No queda ni una
// regla de llaves en el juego, pero una partida guardada antes de quitarlas tiene
// llaves en el almacén, y hay que saber cuántas para redimirlas. Es el único sitio
// donde sobrevive algo del sistema, y por eso el motivo va aquí y no dentro de la
// migración: si algún día se borra la redención, este import se puede borrar con
// ella —y no antes.
import {
  CRISTAL_NOMBRE, crystalTierFromName, chanceDeSintonizacion, keyTierFromName
} from './data/items';


// Antes esto era un modal con botón "Aceptar" para avisos como "Almacén lleno":
// bloqueaba la partida por un mensaje informativo. Ahora es un toast no bloqueante.

// Las migraciones se anotan de más nueva a más vieja.
//
// La 10 es la de la **redención de los cristales**. Los cristales dejan de ser items
// con diez niveles y pasan a ser un recurso, un número, como las nanitas. Una
// partida vieja tiene pilas de cristal en el almacén con su nivel, y hay que
// convertirlas en unidades **por lo que valían**: un cristal de nivel n valía un
// intento de subida y ahora un intento cuesta `valorDeUnCristal(n)`, así que la
// conversión es exacta. Está junto a la de las llaves, y por el mismo motivo.
//
// La 9 es la de la **redención de las llaves**. Una partida guardada antes de
// quitarlas tiene llaves en el almacén, y en el mejor de los casos muchas: la
// tienda las vendía y cada caja soltaba una o dos. Se **venden solas** por lo que
// valían, porque borrarlas es robarle al jugador algo que pagó y dejarlas es
// llenar el almacén de objetos que no sirven para nada. El precio sale del mismo
// sitio del que salía el precio viejo —un tercio del par caja+llave—, así que no
// es una aproximación. Está al final de este bloque, con su motivo.
//
// La 8 es la del `potential` en los recolectores. Antes el potencial solo
// vivía en los items forjados y lo tiraba la rareza; ahora es la escala 1..5
// que decide el daño de TODO recolector, y los items viejos lo reciben deducido
// de su propio daño para que ninguno cambie de estadísticas al migrar.
//
// La 7 es la del renombre `weapon` -> `collector`. La 6 no avisó de nada: el
// código pasa a esperar 'collector' y las partidas que ya existían se quedaron
// con 'weapon' guardado, que no es un tipo que reconozca nadie. Por eso esa
// versión no sube por el formato del documento sino por un cambio de NOMBRES
// dentro de él, y por eso su migración se aplica solo al cruzarla.
//
// Una partida sin `saveVersion` (o con 0) se trata como anterior a la 7: es lo
// que quiere decir no haber pasado nunca por este código.
//
// **ESTE NÚMERO ESTÁ EXPORTADO PORQUE HAY UN BANCO QUE LO COMPARA, Y POR QUÉ ESO
// IMPORTA MÁS DE LO QUE PARECE.** `sellCheck` comprueba que la migración **se
// escribe**: que el documento guardado trae la versión nueva y no la que tenía
// antes. Eso solo se puede comprobar contra la constante. Contra un número escrito
// a mano significa que **cada vez que sube la versión hay que acordarse de ir a
// editar el banco**, y no es un problema teórico: ha pasado en las últimas
// versiones, y el banco dio rojo con un `saveVersion=9` en el documento mientras la
// constante valía 9 y la aserción comparaba contra 8.
//
// Un número que hay que ir a cambiar a mano en dos sitios es un número que algún
// día se cambia en uno y se olvida del otro.
export const SAVE_VERSION = 10;

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
// Se usa una sola vez, al migrar saves antiguas.
function inferBuffIdFromName(name: string): string | null {
  const lower = name.toLowerCase();
  // Los tipos van antes que el genérico: un "Expansor T7" sin `buffId` es un
  // T7, no el +1 viejo. El genérico queda para el stock de antes de los tipos.
  //
  // **Y EL NÚMERO SE SACA CON UNA EXPRESIÓN, NO CON DIEZ `if`.** Antes había tres líneas para tres expansores y con diez habría sido una línea por tier, que
  // es exactamente el sitio donde un expansor nuevo nace sin migrar: el item
  // guardado se leería como el +1 viejo y aplicaría una ranura en vez de cinco.
  // Un `match` sobre el número del nombre no puede quedarse atrás.
  const tierDeNombre = lower.match(/expansor t(\d+)/);
  if (tierDeNombre) return `expansorT${Number(tierDeNombre[1])}`;
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
  return {
    id: `crate_${crateType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: def.name,
    type: 'crate' as const,
    details: def.details,
    rarity: def.rarity,
    tier: 0,
    // La reventa es la cuarta parte del valor, y el valor sale de `store.ts`. La
    // carta de tienda ya no existe para las cajas altas (F31 quita las tres), así
    // que antes el precio de una caja legendaria no lo tenía nadie: se leía de
    // `STORE_ITEMS.legendaryCrate` para la tienda y de `CRATE_META` para la
    // reventa, y eran dos números.
    sellPrice: Math.floor(costeDeCaja(crateType) / 4),
    stackable: true,
    stackCount: quantity
  };
}

/** Un contador de cajas con los diez niveles a cero. Nunca diez líneas a mano. */
export function contadorDeCajasVacio(): Record<CrateType, number> {
  return Object.fromEntries(CRATE_TIERS.map(t => [t, 0])) as Record<CrateType, number>;
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

  /**
   * ¿Venía cola de la sesión anterior?
   *
   * Se pregunta **aquí**, antes de cargar, y no junto al `setTimeout` que la
   * sube. La razón está escrita allí: para entonces el guardado de carga ya ha
   * anotado su propia entrada y la pregunta daría cierto siempre, que es lo que
   * pasaba. Esta línea es la que dice lo que su nombre dice.
   *
   * Y se declara antes de la carga por el mismo motivo que `achievementState`:
   * `recalculatePassiveIncome` se llama durante la carga y `user` aún no está.
   */
  const habiaColaAlArrancar = user ? hayPendientes(user.uid) : false;

  // El potencial de los items de partida: **1**.
  //
  // Lo eligen las dos fábricas de abajo y por eso es una constante y no un 1
  // escrito en cuatro sitios. Con un 1 suelto en cada sitio, el día que se
  // cambiara habría cuatro que cambiar y bastaría con olvidar uno para tener un
  // item con ★1 y el daño de ★3, que es el bug que G4 arregló.
  //
  // **★1 Y NO ★3, Y ES UNA DECISIÓN DE ENTRADA, NO UN AZAR.** El potencial es la
  // escala que hace que buscar un item bueno sea una búsqueda: si el item de
  // partida ya viniera en el punto medio, el jugador empezaría con un ★3 sin haber
  // hecho nada y no tendría nada que mejorar hacia abajo. Con ★1 tiene **todo el
  // recorrido por delante** y el primer ★3 que encuentre en una caja se sentirá
  // como una mejora de verdad.
  const POTENCIAL_BASE = 1;

  // El compañero inicial es un T1 real: mismo poder que compra el jugador, para
  // que la decisión "comprar otro T1 o guardar" tenga sentido desde el segundo 1.
  const baseCompanion = {
    id: 'companion_base_001',
    name: 'Dron Explorador',
    type: 'click' as const,
    // El compañero de partida con **potencial 3**, que es el punto medio del
    // rango del T1. Antes su poder era un 5 escrito a mano, que es un T2 en el
    // rango del T1 y por eso el "compañero inicial es un T1 real" del comentario
    // no era cierto. Ahora sale de `poderDeCompanero(1, 3)` y por construcción es
    // el T1 de la mitad, que es lo que dice el comentario.
    power: poderDeCompanero(1, POTENCIAL_BASE),
    rarity: 'Común',
    tier: 1,
    potential: POTENCIAL_BASE
  };

  /**
   * El recolector de partida, y su ficha en el almacén.
   *
   * **UNA FÁBRICA Y DOS LLAMADAS, Y POR QUÉ NO UN OBJETO COMPARTIDO.** El estado
   * nuevo y el reinicio del Ascenso necesitan las dos cosas, y antes cada uno se
   * escribía a mano. El resultado eran dos item que se llamaban igual, con ids
   * distintos, y **cifras distintas**: la ficha decía "+5/s" mientras el
   * compañero real valía 6, y el recolector decía `damage: 5` con lo que su
   * potencial 3 valía 8. Dos objetos que son lo mismo y no lo son.
   *
   * **Y POR QUÉ SON FUNCIONES Y NO CONSTANTES.** Dos item que comparten el mismo
   * objeto son un bug esperando: el motor mueve `damage` al subir de nivel con
   * cristales, `level` al forjar, `affixes`… y mutaría **las dos copias a la vez**,
   * que es como el almacén acaba teniendo un solo Blaser en dos sitios. Una
   * llamada devuelve objetos nuevos y las copias no se tocan.
   */
  const nuevoBaseCompanion = () => ({
    id: baseCompanion.id,
    name: baseCompanion.name,
    type: baseCompanion.type,
    power: baseCompanion.power,
    rarity: baseCompanion.rarity,
    tier: baseCompanion.tier,
    potential: baseCompanion.potential
  });

  const nuevoBaseRecolector = () => ({
    id: 'collector_blaster_001',
    name: 'Blaster Láser',
    type: 'collector',
    // El daño sale de `danioDeRango` y el `details` sale de ESE número, no al
    // revés. Escritos a mano eran `damage: 5` y `details: '+5'`, que casaban
    // entre sí pero no con el potencial 3 que el item no tenía: al añadirle las
    // estrellas, un ★3 con daño 5 se vio enseguida que era mentira.
    damage: danioDeRango(1, POTENCIAL_BASE),
    details: `Recolección por click: +${danioDeRango(1, POTENCIAL_BASE)}`,
    rarity: 'Común',
    tier: 1,
    level: 0,
    potential: POTENCIAL_BASE,
    sellPrice: 250
  });

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
    forgedCount: 0, // Recolectores forjadas con exito
    // --- Bonificaciones agregadas del arbol (se recalculan al cargar) ---
    bonus: {
      clickMult: 0, passiveMult: 0, costReduction: 0, sellMult: 0,
      craftLuck: 0, consolationBonus: 0, autoClick: 0, afkHours: 0,
      offlineClicks: 0, crateLuck: 0, coreGain: 0, storageSlots: 0, companionSlots: 0
    },
    // --- Cosméticos equipados ---
    cosmetics: {
      title: 'title_default',
      frame: 'frame_none',
      banner: 'banner_none',
      unlocked: ['title_default', 'frame_none', 'banner_none'] as string[]
    },
    crystals: 5,
    /**
     * EL FILTRO DE AUTO-VENTA AL ABRIR CAJAS.
     *
     * **Viene apagado y con los tres tipos apagados, y no es pereza: es la única forma
     * de que un filtro de venta sea seguro.** Encenderlo destruye objetos sin aviso y el
     * juego no tiene deshacer, así que nace en la posición en la que no hace nada y el
     * jugador lo enciende sabiendo lo que hace.
     *
     * Se guarda en la partida y no en el navegador por una razón concreta: **si el
     * filtro no coincide con lo que el jugador está viendo, el número que le sale es de
     * otro juego.** La regla y el filtro tienen que viajar juntos para que la coacción de
     * la carga pueda volver a ponerlos de acuerdo antes de abrir la primera caja.
     *
     * La forma y la coacción están en `data/autoventa.ts`; aquí solo el valor.
     */
    autoVenta: { ...AUTO_VENTA_POR_DEFECTO, tipos: { ...AUTO_VENTA_POR_DEFECTO.tipos } },
    warehouseCapacity: 15,
    maxCompanionSlots: 1,
    /**
     * IDs de items delante de los cuales el jugador había dejado un hueco.
     *
     * **ESTE CAMPO AHORA ES SOLO DATOS HEREDADOS, Y POR QUÉ SIGUE AQUÍ.** El almacén
     * ya no se coloca a mano —no hay arrastre ni huecos—, así que nada crea esta lista.
     * Se conserva por dos razones que no son pereza: una partida guardada antes del
     * cambio trae el campo, y borrarlo del estado sería perderlo sin aviso; y la
     * coacción de la carga lo filtra contra los items que existen de verdad, así que un
     * hueco anclado a algo que ya no está **se cae solo** en cada carga.
     *
     * La Y no lo lee nadie mas: la vista no lo pinta, y `apilar()` solo lo mantiene
     * para que esas partidas viejas no guarden una lista que crece. Es una migración,
     * no una función, y por eso el comentario lo dice.
     */
    warehouseGaps: [] as string[],
    afkCards: 0, // Tarjetas AFK acumuladas (máx 3)
    afkExpiresAt: 0, // Tiempo de expiración del buff AFK (10 min por tarjeta)
    // F31 · Diez niveles, todos a cero menos el T1, que es la caja de arranque.
    crates: { ...contadorDeCajasVacio(), 1: 2 },
    // El cristal ya no tiene contadores derivados: **es un número**, como las
    // nanitas. Antes eran tres cosas —`crystalsByTier` (diez cubos), `crystalTotal` y
    // `upgradeCrystals`— y los tres los recalculaba `syncMaterialCounters()` a partir
    // de los items del almacén. Con un recurso no hay de dónde derivar: el número ES
    // la verdad, y por eso no hay nada que pueda desincronizarse.
    // **LOS DOS ITEM DE PARTIDA VAN EQUIPADOS DE ORIGEN.** Antesepersiana
    // equiparlos, y el efecto era que un jugador nuevo veía su recolector y su
    // compañero en el almacén, sin puesta ninguna, sin ingreso y sin un botón que
    // pulsara: el primer minuto era un contador a cero esperando a que el jugador
    // adivinara que tenía que hacer clic en el arma. Equipado de origen, el primer
    // clic ya cobra y la pantalla enseña cómo se ve cuando está funcionando.
    equippedCollectorId: 'collector_blaster_001' as string | null,
    companions: [baseCompanion] as Array<{ id: string; name: string; type: 'click' | 'passive' | 'multiplier'; power: number; rarity: string; tier?: number; potential?: number; level?: number; maxLevel?: number }>,
    activeCompanions: ['companion_base_001'] as string[],
    warehouse: [
      // Las dos fichas salen de las fábricas de arriba, no de números escritos.
      // Antes esta era la única copia "escrita a mano" que sobrevivía al
      // Ascenso: el reinicio ya se construía desde `baseCompanion`, pero el
      // estado inicial no. Dos sitios con el mismo item y reglas distintas.
      nuevoBaseRecolector(),
      {
        id: baseCompanion.id,
        name: baseCompanion.name,
        type: 'companion',
        // El `details` sale del poder REAL del compañero. Estaba escrito como
        // "+5/s" cuando `poderDeCompanero(1, 3)` da 6: la ficha y el compañero
        // eran el mismo objeto con dos números distintos, y solo se pintaba uno.
        details: `Recolección por segundo: +${baseCompanion.power}/s`,
        rarity: baseCompanion.rarity,
        tier: baseCompanion.tier,
        potential: baseCompanion.potential,
        sellPrice: 250
      }
    ] as Array<{ id: string; name: string; type: string; details: string; rarity: string; tier?: number; level?: number; damage?: number; potential?: number; equipped?: boolean; sellPrice?: number; stackable?: boolean; stackCount?: number }>,
    buffs: {
      clickBoostExpiresAt: 0,
      passiveBoostExpiresAt: 0,
      clickX2ExpiresAt: 0, // Tarjeta Click x2 (30s)
      clickX3ExpiresAt: 0, // Tarjeta Click x3 (30s)
      // **Y LO QUE SE CONCEDIÓ EN EL ÚLTIMO USO, QUE ES EL DENOMINADOR DE LA BARRA.**
      // La barra del HUD es `restante / esto`, y con la duración de una tarjeta el
      // denominador es treinta segundos para un buff que dura treinta minutos: la
      // barra se queda clavada en el 100 % y parece muerta. El comentario largo está
      // en `data/buffs.ts`; aquí solo está el hueco.
      clickBoostTotalMs: 0,
      passiveBoostTotalMs: 0,
      clickX2TotalMs: 0,
      clickX3TotalMs: 0
    },
    /** Lo mismo para el AFK, que vive fuera de `buffs`. La barra también lo mira. */
    afkTotalMs: 0
  };

/**
 * Precio de venta de un item del almacén.
 *
 * Vive fuera del objeto devuelto porque lo necesitan dos sitios: la vista, que
 * lo pinta, y `sellItem()`, que lo cobra. Con la fórmula duplicada, la tarjeta
 * podía enseñar un precio y el cobro aplicar otro.
 *
 * **Y `sellPriceTope` ES UN TECHO, NO UN PRECIO.** Existe para una cosa muy
 * concreta: que **un premio de caja no valga más vendido que la caja y la llave
 * que lo dieron**. Medido, el recolector sobrecargado de la caja T10 se vendía
 * por 457.800 con un par caja+llave de 145.388: **×3,15 de imprimir**, en el 15%
 * de las cajas. Es decir, comprar cajas y abrirlas era un negocio mejor que
 * jugar, y la economía del juego se rompía sola.
 *
 * La causa era que el recolector se valoraba por su rareza y su potencial
 * (Sobrecargado ×2,4 y potencial 5 ×2,8) sin que nadie lo contrastara con lo que
 * cuesta conseguirlo de una caja. Un tope por item lo dice sin tocar la
 * valoración, que es correcta para lo que el jugador ha forjado durante horas.
 *
 * El tope se aplica DESPUÉS de la bonificación de venta del árbol, y también se
 * multiplica por ella, para que el bonus siga sirviendo para algo: si se
 * recortara el precio final, el jugador notaría que su bonificación no hace nada
 * con los premios de caja, y si no se multiplicara, bastarían cuatro núcleos para
 * volver a imprimir.
 */
function getSellPriceFor(item: any): number {
  const conBonus = (base: number) => {
    const precio = Math.floor(base * (1 + state.bonus.sellMult));
    const tope = item?.sellPriceTope;
    if (typeof tope !== 'number' || !Number.isFinite(tope) || tope <= 0) return precio;
    return Math.min(precio, Math.floor(tope * (1 + state.bonus.sellMult)));
  };

  if (item.type === 'collector') {
    return conBonus(sellPrice(item, { sellMult: 1 + state.bonus.sellMult }));
  }
  return conBonus(item.sellPrice || 0);
}

/**
 * LO QUE SE PUEDE VENDER DE UNA SELECCIÓN, Y LO QUE NO.
 *
 * **POR QUÉ UN PLAN Y NO SELLAR Y YA.** Vender veinte celdas de un golpe necesita una
 * respuesta a dos preguntas que la vista no puede responder por su cuenta: cuánto se
 * cobra y **qué se queda fuera**. Lo segundo no es hipotético: el mismo "no puedes
 * vender el último de su tipo" que ya existía para uno solo se vuelve **colectivo** en
 * una selección, porque el critério es "que quede alguno", y con cinco recolectores
 * marcados se puede vender cuatro y no el quinto.
 *
 * Y si la vista calculara eso, tendría la regla duplicada —y además la versión
 * equivocada, que solo miraría un item cada vez—. Así que el plan **lo dice el motor**:
 * la barra de la selección pinta `plan.total`, y `sellMany()` vende exactamente lo que
 * el plan aprueba. Si los dos usaran expresiones distintas, el botón anunciaría una cifra
 * y el cobro aplicaría otra (R3), y esa es la clase de fallo que ya se pagó una vez con
 * el botón de vender que pintaba el precio unitario de una pila.
 *
 * **LO QUE BLOQUEA, Y SON CUATRO COSAS, NO UNA.** Lo que no está, lo que está equipado,
 * lo que daría cero unidades y **lo que dejaría a un tipo sin ninguno**. Las tres primeras
 * son las de siempre. La cuarta es la nueva, y es la que hace que un plan pueda tener
 * una lista de descartes: si el jugador marcó los tres recolectores que tiene, dos se
 * venden y el tercero no, y el motivo tiene que salir con el resultado.
 */
function planDeVenta(ids: string[]): {
  vendibles: Array<{ id: string; units: number; total: number }>;
  bloqueados: Array<{ id: string; motivo: string }>;
  total: number;
} {
  const venta: Array<{ id: string; units: number; total: number }> = [];
  const bloqueados: Array<{ id: string; motivo: string }> = [];

  // Cuántos quedan de cada tipo **si se vendiera todo lo marcado**, que es la pregunta
  // que decide el descarte. Cuenta ITEMS y no unidades, como `sellItem()`: recolectores y
  // compañeros no son apilables, así que una unidad es un item.
  const restantes = new Map<string, number>();
  for (const w of state.warehouse as any[]) {
    restantes.set(w.type, (restantes.get(w.type) ?? 0) + 1);
  }
  for (const id of ids) {
    const item: any = (state.warehouse as any[]).find((w: any) => w.id === id);
    if (!item) {
      bloqueados.push({ id, motivo: 'ya no está en el almacén' });
      continue;
    }
    const esEquipado = (item.type === 'collector' && state.equippedCollectorId === item.id) ||
      (item.type === 'companion' && state.activeCompanions.includes(item.id));
    if (esEquipado) {
      bloqueados.push({ id, motivo: 'está equipado' });
      continue;
    }
    const units = unidadesVendibles(item, undefined);
    if (units <= 0) {
      bloqueados.push({ id, motivo: 'no queda nada por vender' });
      continue;
    }
    if (item.type === 'collector' || item.type === 'companion') {
      const queda = (restantes.get(item.type) ?? 0) - 1;
      restantes.set(item.type, queda);
      if (queda <= 0) {
        bloqueados.push({ id, motivo: 'es el último de su tipo' });
        continue;
      }
    }
    venta.push({ id, units, total: Math.floor(getSellPriceFor(item) * units) });
  }
  return { vendibles: venta, bloqueados, total: venta.reduce((a, v) => a + v.total, 0) };
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
 * Qué cartas se compran en lote: una lista de CARTAS, no un patrón de nombre.
 *
 * Solo lo apilable se compra en lote (llaves, cristales, cajas y consumibles):
 * una carta de ranura o una carta de tier son únicas y siempre valen una, pida
 * lo que pida la vista.
 *
 * **ESTO ESTABA EN UN `endsWith` Y POR ESO LAS CAJAS NO SE COMPRABAN EN LOTE.**
 * Decía `itemKey.endsWith('Crate')`, que era el nombre de la carta antes de F31
 * (`commonCrate`, `rareCrate`…). Con una caja por tier la carta se llama
 * `crateT1`, no acaba en `Crate`, y la condición dejó de cumplirse en silencio:
 * `getBulkMax` devolvía 1, la tarjeta no pintaba el selector de cantidad y
 * comprar cinco cajas eran cinco viajes a la tienda.
 *
 * El bug no lanzaba ningún error —un `if` que ya no se cumple es el peor sitio
 * para un cambio de nombre— y además el mismo `endsWith` estaba copiado en la
 * vista, para elegir el sustantivo del selector ("¿cuántas **cajas**?"). Por eso
 * las dos cosas salen de aquí: la lista y el nombre.
 */
/**
 * POR QUÉ NO SE USA UN EXPANSOR, EN UNA FRASE, PARA LOS DOS SITIOS QUE LO PREGUNTAN.
 *
 * Lo preguntan dos: el botón, que necesita un motivo para apagarse, y el motor, que
 * necesita negarse. Y **el mensaje es la mitad de la regla**: un "no se usa" sin decir
 * cuál expansor falta deja al jugador adivinando qué comprar, que es justo lo que esta
 * regla pretendía resolver. Por eso el texto sale de aquí y no de dos sitios.
 *
 * @param tipo El expansor de la tabla. `null` es el antiguo `warehouseExpander`, que no
 *             tiene escalón siguiente.
 */
function motivoDeExpansorAlTope(tipo: any, capacidad: number): string {
  if (!tipo) return `Almacén al máximo (${WAREHOUSE_MAX_CAP}).`;
  const siguiente = EXPANSOR_TIERS.find((t) => t.tier === tipo.tier + 1);
  return siguiente
    ? `Tu almacén ya está en ${capacidad} y el ${tipo.name} solo vale hasta ${tipo.maxCap}. Necesitas un ${siguiente.name} (hasta ${siguiente.maxCap}).`
    : `Tu almacén ya está en ${capacidad}, que es todo lo que da el ${tipo.name}. No hay expansor por encima.`;
}

function esCartaEnLote(itemKey: string): boolean {
  return itemKey === 'upgradeCrystal'
    || itemKey === 'crateT1'
    || !!CONSUMABLES[itemKey as keyof typeof CONSUMABLES];
}

/** Cómo llama la vista a una unidad de esta carta: "elige cuántas **cajas**". */
function nombreDeUnidad(itemKey: string): string {
  if (itemKey === 'upgradeCrystal') return 'cristal';
  if (itemKey === 'crateT1') return 'caja';
  return 'unidad';
}

/**
 * Cuántas unidades se compran, ya recortadas a lo válido.
 *
 * Un 0, un negativo o un NaN es "cantidad no válida" y vale 0, que `buyStoreItem`
 * rechaza sin cobrar —igual que `unidadesVendibles` en la venta—.
 */
function unidadesCompra(itemKey: string, pedidas?: number): number {
  if (!esCartaEnLote(itemKey)) return 1;
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
 * Un apilable se suma a la primera pila del mismo tipo y nombre **que tenga hueco**,
 * y lo que no quepa en ninguna abre piling nuevas del tamaño del tope. Un item
 * que no es apilable siempre entra con su propio id, porque dos recolectores son
 * dos cosas distintas aunque se llamen igual.
 *
 * **UNA COMPRA EN LOTE PUEDE TRAER MÁS DE UNA PILA.** Comprar 250 cajas con el
 * almacén vacío mete un item de 250 y lo repartía en una sola pila de 250 —por
 * encima del tope de 99 que el jugador ve en la rejilla—. Ahora las abre de
 * tope en tope y las sobrantes reciben un id con sufijo. El reparto lo
 * decide `planDeEntrada()`, el mismo que usa `cabeEnAlmacen()`, y esa es la razón
 * de que sea un plan y no un `if`: **las dos preguntas tienen que dar el mismo
 * número de ranuras**, porque si no el diálogo ofrece una cantidad que el motor
* rechaza después de haber cobrado el precio.
 *
 * Devuelve false si no había hueco. No avisa: quien llama decide, porque hay
 * sitios que compensan en nanitas y sitios que pierden el botín a propósito.
 */
function addToWarehouse(item: any): boolean {
  const unidades = stackUnits(item);

  if (!isStackable(item)) {
    if (countOccupiedSlots(state.warehouse) >= effectiveWarehouseCapacity()) return false;
    state.warehouse.push(item);
    return true;
  }

  const plan = planDeEntrada(item, unidades);
  if (countOccupiedSlots(state.warehouse) + plan.ranurasNuevas > effectiveWarehouseCapacity()) {
    return false;
  }

  // Se reparte: primero a las pilas que ya tienen hueco, y lo que sobre a piles
  // nuevas del tamaño del tope. La primera pila nueva conserva el id del item
  // recibido, que es el que el llamante devuelve a la vista.
  let quedan = unidades;
  for (const h of plan.huecos) {
    if (quedan <= 0) break;
    const take = Math.min(h.libre, quedan);
    h.pila.stackCount = stackUnits(h.pila) + take;
    quedan -= take;
  }

  const tope = topeDePila(item.type);
  let n = 0;
  while (quedan > 0) {
    const take = tope === Infinity ? quedan : Math.min(tope, quedan);
    const copia: any = { ...item, stackCount: take };
    if (n > 0) copia.id = `${item.id}#${n + 1}`;
    state.warehouse.push(copia);
    quedan -= take;
    n++;
  }
  return true;
}

/**
 * Dónde irían estas unidades: las pilas con hueco y cuántas ranuras nuevas hay
 * que abrir.
 *
 * **ESTO ES UN PLAN, NO UNA EJECUCIÓN**, y por eso lo comparten `addToWarehouse()`
 * y `cabeEnAlmacen()`: las dos preguntas —"¿cabe?" y "¿dónde va?"— tienen que dar
 * el mismo número de ranuras. Si cada una contara por su cuenta, el diálogo
 * ofrecería una cantidad que el motor rechazaría, que es la peor forma de fallar:
 * el jugador cobra una idea y paga una decepción.
 *
 * Y la parte que hace que el tope de pila signifique algo: una pila llena no
 * admite ni una unidad más aunque el almacén esté vacío, así que **"caber" es
 * "cuántas ranuras nuevas necesitas"**, no "¿queda alguna libre?".
 */
function planDeEntrada(
  item: any, unidades: number
): { huecos: Array<{ pila: any; libre: number }>; ranurasNuevas: number } {
  const tope = topeDePila(item.type);
  const clave = `${item.type}::${item.name}`;

  const huecos: Array<{ pila: any; libre: number }> = [];
  let cabenEnHuecos = 0;
  for (const w of state.warehouse as any[]) {
    if (!isStackable(w) || `${w.type}::${w.name}` !== clave) continue;
    const libre = topeDePila(w.type) - stackUnits(w);
    if (libre <= 0) continue;
    huecos.push({ pila: w, libre });
    cabenEnHuecos += libre;
  }

  const enHuecos = Math.min(unidades, cabenEnHuecos);
  const nuevas = unidades - enHuecos;

  // `nuevas <= 0` son cero ranuras, y hace falta el `if` porque
  // `pilasNecesarias(0, ...)` devuelve 1 por construcción: su pregunta es
  // "cuántas pilas necesito para estas unidades" y de cero unidades la respuesta
  // mínima razonable es una. Aquí la pregunta es la otra —"cuántas tengo que
  // abrir"—, y de cero unidades es cero.
  //
  // **SIN ESTE `if`, NADA QUE SUMARA A UNA PILA PODRÍA COMPRARSE CON EL ALMACÉN
  // LLENO**: un almacén con una pila de cajas y ni una ranura libre daría
  // "no cabe" para una caja que se suma a la pila sin ocupar nada. Es el bug que
  // este `if` arregla, y el que hacía que "el lote se suma a la pila, no abre
  // otra" no funcionara con el almacén lleno.
  const ranurasNuevas = nuevas <= 0
    ? 0
    : (tope === Infinity ? 1 : pilasNecesarias(nuevas, item.type));

  return { huecos, ranurasNuevas };
}

/**
 * ¿Cabe este item en el almacén con ESTAS unidades?
 *
 * La respuesta no es sí/no para un item suelto: 250 cajas necesitan tres ranuras y
 * no caben en un almacén con dos libres. Por eso delega en el mismo plan que
 * usa `addToWarehouse()` y solo compara el número de ranuras nuevas con las
 * que quedan.
 */
function cabeEnAlmacen(item: any, unidades = 1): boolean {
  if (!isStackable(item)) {
    return countOccupiedSlots(state.warehouse) < effectiveWarehouseCapacity();
  }
  // `libres` puede salir 0 o negativo si el contador y la capacidad se han
  // desincronizado; se recorta a 0 y sigue el cálculo. **No se puede volver
  // aquí cuando no hay ranuras libres**, porque eso descartaría justo el caso
  // bueno: un almacén lleno donde la pila de cajas tiene hueco.
  const libres = Math.max(0, effectiveWarehouseCapacity() - countOccupiedSlots(state.warehouse));
  return planDeEntrada(item, unidades).ranurasNuevas <= libres;
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
 *
 * **Y CON TOPE DE PILA HAY QUE PREGUNTAR POR LAS `unidades`, NO POR EL ITEM.**
 * Sin eso, comprar 250 cajas de golpe se daría por bueno con una sola ranura
 * libre —porque la última pila de cajas tiene hueco— y el motor metería las 45
 * en una sola pila de 65, saltándose el tope que el jugador ve en la rejilla. La
 * pregunta "¿cuántas ranuras nuevas necesitas?" es la única que no puede mentir.
 */
function cabeLaCompra(itemKey: string, unidades = 1): boolean {
  if (NO_OCUPA_RANURA.includes(itemKey)) return true;
  const item = previewStoreItem(itemKey);
  // **UNA CARTA QUE NO CREA UN ITEM NO PIDE RANURA, Y ESTA ES LA REGLA, NO UN
  // CASO SUELTO.** `previewStoreItem` devuelve `null` exactamente cuando la carta
  // no mete nada en el almacén, así que la pregunta "¿cabe?" no tiene a qué
  // aplicarse y la respuesta correcta es que sí, siempre.
  //
  // El caso que había era la carta del cristal: antes creaba un item apilable y
  // llenaba el almacén, y ahora suma unidades a `state.crystals`. Sin esta línea,
  // `cabeEnAlmacen(null, n)` caía en `isStackable(null) === false` y comparaba las
  // ranuras ocupadas con la capacidad, así que **con el almacén lleno la compra
  // se rechazaba**: el mismo bug que Justificó quitar el item, reproducido por la
  // puerta de atrás. Un jugador con el almacén lleno se quedaba sin poder comprar
  // el material que necesita para subir de nivel.
  //
  // Y se escribe como regla y no como `if (itemKey === 'upgradeCrystal')` porque la
  // siguiente carta que sea un recurso ——y la habrá—— hereda la respuesta correcta
  // sin tener que acordarse de venir aquí. Una lista de excepciones obliga a
  // recordar; una regla, no.
  if (!item) return true;
  return cabeEnAlmacen(item, unidades);
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
  // **EL CRISTAL NO DEVUELVE NADA AQUÍ, Y ES LA CONSECUENCIA DE QUE SEA UN RECURSO.**
  // Esta función responde "qué item crea esta carta", y la del cristal es "ninguno":
  // la carta suma unidades a `state.crystals`. Antes devolvía un item apilable, y por
  // eso comprar cristales **pedía hueco en el almacén**, que es absurdo: un jugador
  // con las cuatrocientas ranuras llenas no podía comprar el material que necesita
  // para subir de nivel.
  //
  // Devolver `null` es lo que esta función dice cuando una carta no crea un item, así
  // que no hace falta un caso especial.
  // F31 · Una sola carta de caja, `crateT1`. Antes el `if` era "cualquier cosa que
  // acabe en Crate y cuyo nombre sea una caja conocida", lo que servía para cuatro
  // cartas y con diez cajas habría servido para cuatro también, en silencio.
  if (itemKey === 'crateT1') return { type: 'crate', name: CRATE_TYPES[1].name, stackable: true };
  const consumable = CONSUMABLES[itemKey as keyof typeof CONSUMABLES];
  if (consumable) return { type: 'consumable', name: consumable.name, stackable: true };
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
 * Suma unidades de cristal al recurso.
 *
 * **UNA SOLA FUNCIÓN Y UN SOLO ARGUMENTO, Y ANTES HABÍA DOS PARA EL MISMO EFECTO.**
 * Antes había `grantKeys()` y `grantCrystals()`, las dos encima de un
 * `grantMaterial(kind, tier, amount)` que acababa en `createMaterialItem()`. Las
 * llaves se han ido; queda la otra mitad, sin la mitad del código de la otra mitad.
 *
 * **YA NO HAY NIVEL QUE RECIBIR, PORQUE EL RECURSO NO TIENE NIVEL.** Quien llama
 * convierte antes: la caja multiplica por `valorDeUnCristal()` al tirar, y la
 * forja también. Aquí solo se suma, y un número que se suma es difícil de equivocar.
 *
 * Y **el almacén ya no puede estar lleno**, que era el motivo por el que esta función
 * tenía un aviso por consola: un recurso no ocupa ranura.
 */
function grantCrystals(units: number) {
  if (!Number.isFinite(units) || units <= 0) return;
  state.crystals += Math.round(units);
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
 *
 * **Y ESTA FUNCIÓN SE PERDIÓ UNA VEZ EN ESTE MISMO CAMBIO, POR ESO ESTÁ AQUÍ.**
 * El corte que borró el bloque del material buscaba el cierre de
 * `syncMaterialCounters()` aceptando una llave a dos espacios, y se paró en el
 * `  });` de un `forEach`. Como consequence pilló de más y **esta función quedó
 * fuera**, junto con media docena de la carga. Lo que se vio fueron 536 errores de
 * "cannot find name" que no tenían nada que ver con los cristales, y que se
 * tardaron tres pasadas de scripts en encontrar.
 *
 * El arreglo no fue mirar el fichero, sino **reaplicar los cambios de uno en uno
 * desde HEAD comprobando `tsc` con cada uno**, porque un error de sintaxis no
 * señala el sitio donde se cometió el error: señala el final del fichero.
 */
/**
 * LOS GRUPOS QUE SE FUNDEN, PARA QUE EL BOTON DIGA CUANTOS.
 *
 * Sin esto el boton seria un "apilar" sin numero, y un boton de apilar sin numero es
 * una caja deBOTON: el jugador lo aprieta y no sabe si ha servido para algo.
 *
 * Compara por `stackKey()` y no por nombre: dos items con el mismo nombre y distinto
 * `buffId` no son el mismo consumible, y fundirlos seria un bug de inventario. La clave
 * es la que usa `mergeStacks()`, asi que lo que se cuenta es exactamente lo que se
 * fusiona.
 *
 * Y el recuento sale **de la diferencia de celdas**, no de la suma de grupos: fundir
 * cuatro celdas de 15 en una de 20 y otra de 40 son dos grupos y **cero celdas
 * liberadas**, porque el tope de 20 obliga a repartir. Contar grupos diria "2" donde
 * el jugador no ha ganado nada.
 */
function gruposQueSeFunden(antes: any[], despues: any[]): { nombre: string; unidades: number }[] {
  const cuenta = new Map<string, number>();
  const nombreDe = new Map<string, string>();
  for (const w of antes) {
    if (!isStackable(w)) continue;
    const clave = stackKey(w);
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    if (!nombreDe.has(clave)) nombreDe.set(clave, w.name ?? 'Item');
  }
  const salida: { nombre: string; unidades: number }[] = [];
  for (const [clave, celdas] of cuenta) {
    if (celdas < 2) continue;
    const unidades = despues
      .filter((w: any) => isStackable(w) && stackKey(w) === clave)
      .reduce((s: number, w: any) => s + stackUnits(w), 0);
    salida.push({ nombre: nombreDe.get(clave) ?? 'Item', unidades });
  }
  return salida.sort((a, b) => b.unidades - a.unidades);
}

/**
 * La clave de apilado de cada hueco, para poder reconectarlo despues.
 *
 * Un hueco esta anclado al **id** de un item, no a una posicion: por eso puede sobreviver
 * a un cambio de orden. Pero la fusion se queda con el id del primero de cada grupo, y
 * los ids que se van no se van solos.
 */
function anclajesDeHuecos(huecos: string[], almacen: any[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const id of huecos ?? []) {
    const w = almacen.find((x: any) => x.id === id);
    // **SOLO LOS APILABLES.** Un hueco detrás de un recolector no se puede mover: los
    // recolectores no se funden y el hueco se queda donde esta. Anotar los de todos
    // seria trabajo para nada, y el codigo que los reconecta tendria que distinguir dos
    // casos que en la practica son el mismo.
    if (w && isStackable(w)) mapa.set(id, stackKey(w));
  }
  return mapa;
}

/**
 * Devuelve cada hueco a un item que exista.
 *
 * El hueco que no se puede reconectar **se cae**, y no por pereza: un hueco anclado a un
 * id que ya no esta en el documento no tiene donde pintarse, y dejarlo seria un
 * `warehouseGaps` que crece con cada apilado hasta que el guardado pesa lo que el
 * almacen entero.
 *
 * Y el hueco **no se multiplica**: si dos huecos acaban en el mismo item, se queda uno.
 * El jugador pidio una separacion, no dos.
 */
function reconectaHuecos(huecos: string[], anclajes: Map<string, string>, despues: any[]): string[] {
  const salida: string[] = [];
  const visto = new Set<string>();
  for (const id of huecos ?? []) {
    let destino = id;
    if (!despues.some((w: any) => w.id === id)) {
      const clave = anclajes.get(id);
      if (!clave) continue; // el hueco apuntaba a algo que no existe: se cae
      destino = despues.find((w: any) => isStackable(w) && stackKey(w) === clave)?.id ?? '';
      if (!destino) continue;
    }
    if (visto.has(destino)) continue;
    visto.add(destino);
    salida.push(destino);
  }
  return salida;
}

function desbloquearCosmetico(cosmeticId: string): boolean {
  if (state.cosmetics.unlocked.includes(cosmeticId)) return false;
  state.cosmetics.unlocked.push(cosmeticId);
  return true;
}
/*
 * BORRADO ENTERO DE ESTE FICHERO, Y POR QUÉ NO QUEDA NI UNA LÍNEA DE MATERIAL
 *
 * · `grantMaterial()` y `createMaterialItem()`. El camino del cristal como item.
 * · `precioReventaMaterial()`. Reapareció durante el cambio de las llaves, cuando
 *   `key` y `crystal` compartían función, y se va con el cristal: **un recurso no
 *   tiene precio de reventa**, porque no se vende. No se ha dejado ni convertida en
 *   un caso especial.
 * · `syncMaterialCounters()`. La que recountaba el almacén cada vez que algo tocaba
 *   el material, en cinco sitios distintos. Existía porque el almacén era la fuente
 *   de verdad y los contadores una vista; con un recurso **no hay vista que
 *   mantener**, y una función que calcula un número que ya está en `state.crystals`
 *   es un sitio más donde pueden discrepar.
 * · El aviso por consola de "se pierden N cristales sin hueco". El almacén lleno ya
 *   no puede afectar a un recurso, así que el caso que lo justificaba ya no existe.
 *
 * **LO QUE SE CONSERVA, Y ES POR QUÉ ESTE FICHERO SIGUE TENIENDO UN HUECO AQUÍ:**
 * la redención de los items de cristal de una partida vieja, más abajo, que necesita
 * `crystalTierFromName()` para saber qué nivel tenía cada pila. Cuando esa
 * migración se borre, `items.ts` se queda sin niveles de cristal también.
 */

/**
 * LA REDENCIÓN DE LAS LLAVES, Y POR QUÉ NO SE BORRAN.
 *
 * Una partida guardada antes de este cambio tiene llaves en el almacén, y en el
 * mejor de los casos tiene **muchas**: la tienda las vendía, las cajas soltaban
 * una o dos por apertura, y la mayoría de los jugadores tenía un montón.
 *
 * **BORRARLAS ES ROBAR.** El jugador compró cada una de esas llaves con nanitas,
 * se guardó, y un cambio de código le las convierte en nada. No hay forma de
 * argumentar que es "el cambio del juego": desde su punto de vista ayer valían y
 * hoy no, y no ha hecho nada para que pase.
 *
 * **Y TAMPOCO ES DEJARLAS.** Un item que el juego ya no reconoce no es un objeto
 * neutro: ocupa una ranura de la rejilla, aparece en el almacén, y no hay ningún
 * botón que lo haga nada. Es basura que ocupa sitio y que el jugador no puede
 * tirar más que vendiendo por una suma que ya no existe.
 *
 * Así que se venden solas, y por lo que valían.
 *
 * ---------------------------------------------------------------------------
 * EL PRECIO, Y POR QUÉ ES UN TERCIO DEL TECHO DE REVENTA Y NO EL DE LA CAJA
 * ---------------------------------------------------------------------------
 * Antes, abrir una caja costaba **la caja más la llave**. Y el techo de reventa de
 * lo que salía de un cofre era, por construcción, **la caja más la llave**: eso
 * es lo que impedía que un objeto de tier fuera más caro vendido que el cofre
 * entero. O sea que la llave era **un tercio de ese par**.
 *
 * Cuando se quitaron las llaves, **la caja pasó a costar el par entero** — por eso
 * quitar las llaves no movió un nanito de la economía — y el tope de reventa se
 * quedó igual. Así que un tercio del tope es, exactamente, lo que la llave valía
 * dentro de la economía que la creó.
 *
 * **ES GENEROSO PARA LOS NIVELES ALTOS Y CORRECTO PARA LOS BAJOS, Y ESO ES LO
 * QUE PASA.** La llave T1 costaba 225 y el tope de la T1 son 675: un tercio son
 * 225 clavados. En la T10 la llave costaba 48.463 y el tope es 145.388, y un
 * tercio son 48.463 clavados también, porque **el número se deriva del mismo
 * sitio del que salía el precio**. No es una aproximación: es la misma regla.
 *
 * Y el jugador no pierde nada con el cambio, porque la caja que ahora compra
 * cuesta esos mismos nanitas de más. Compra caja y llave por 900; después, caja
 * sola por 900.
 */
function redencionDeUnaLlave(tier: number): number {
  // El tope de reventa es el precio de la caja, que es las tres cuartas partes
  // del valor del objeto de su tier. Se usa `COSTE_POR_TIER` y no el precio de la
  // caja porque la caja **subió** al quitar la llave: el precio viejo de la llave
  // sale de la caja vieja, no de la nueva.
  const costeDelObjeto = COSTE_POR_TIER[Math.min(COSTE_POR_TIER.length, Math.max(1, Math.floor(tier))) - 1];
  const parAntiguo = costeDelObjeto * 3 / 4;
  return Math.max(1, Math.round(parAntiguo / 3));
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
   * El ranking va fallando, y ya se le ha avisado.
   *
   * **SON DOS BANDERAS Y NO UNA, Y POR QUÉ.** La del guardado grande es "tu
   * partida está en peligro": eso solo se enciende si falla el documento de
   * `users/{uid}`. La del ranking es "no hay red con el documento público": el
   * progreso está a salvo y lo único que se pierde es la posición en la tabla.
   *
   * Con una sola bandera, la del ranking encendería el indicador grande y el
   * jugador leería "sin guardar" con la partida guardada — que es exactamente lo
   * que pasaba, y es el aviso que más veces se ha reportado.
   */
  let rankingFallando = false;
  let rankingSeAviso = false;

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
      // **EL CRISTAL SE CARGA DEL CAMPO NUEVO, Y SI NO ESTÁ, DE LA PARTIDA VIEJA.** Una
  // partida de antes no tiene `crystals`: tiene `crystalTotal` y diez cubos. La
  // redemption de más abajo convierte las pilas del almacén, y aquí solo se recurre a
  // los contadores viejos **para una partida que no tuviera ni una sola pila**, que es
  // el caso de las partidas más antiguas, las de antes de que el material fuera item.
  //
  // **Y NO SE SUMAN LOS DOS.** Sumar el contador y las pilas sería darle el doble: el
  // almacén es la fuente de verdad siempre que tenga algo, y el contador solo cuando
  // el almacén está vacío.
  const hayPilasDeCristal = (data.warehouse as any[]).some((w: any) => w.type === 'crystal');
  state.crystals = typeof data.crystals === 'number'
    ? data.crystals
    : (hayPilasDeCristal ? 0 : (data.crystalTotal ?? data.upgradeCrystals ?? 5));
      state.warehouseCapacity = data.warehouseCapacity ?? 15;
      state.maxCompanionSlots = data.maxCompanionSlots ?? 1;
      // F31 · EL CONTADOR DE CAJAS PASA DE CUATRO NOMBRES A DIEZ NIVELES.
      //
      // El guardado viejo trae `{ common: 5, rare: 2 }`, y esas cajas están
      // también en el almacén como items. El contador es un residuo, pero se
      // guarda y `materializePendingCrates` lo lee, así que no se tira: se
      // **traduce** al nivel donde vivía cada caja —común → T1, rara → T3, épica
      // → T6, legendaria → T8— y se suman al contador nuevo. Tirarlo sería
      // desaparecer con cinco cajas que el jugador ya tenía, y esa traducción
      // conserva su sitio en la escalera: el que tenía una legendaria tenía un
      // T8, y sigue teniendo un T8.
      //
      // Y una partida que no trae el campo es una partida nueva, y recibe las dos
      // cajas T1 de siempre.
      const legacyCrates = (data.crates ?? null) as Record<string, number> | null;
      state.crates = contadorDeCajasVacio();
      if (legacyCrates && typeof legacyCrates === 'object') {
        state.crates[1] += legacyCrates.common ?? 0;
        state.crates[3] += legacyCrates.rare ?? 0;
        state.crates[6] += legacyCrates.epic ?? 0;
        state.crates[8] += legacyCrates.legendary ?? 0;
      } else {
        state.crates[1] = 2;
      }
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
      // El filtro de auto-venta, coaccionado campo a campo. Un guardado viejo no lo
      // trae; uno manipulado puede traer `"sí"` en `activa` o `tipos: true` en vez de un
      // objeto de tres banderas, y sin coaccionar eso revienta **a mitad de un sorteo**,
      // que es el peor sitio posible para un dato corrupto. Ver `coaccionaAutoVenta()`.
      state.autoVenta = coaccionaAutoVenta(data.autoVenta);
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

      // G4 · El potencial pasa a ser la escala 1..5 que decide el daño. Antes esto
      // vivía en `migratePotential()` y solo rellenaba el campo: el item pasaba
      // a tener ★3 **sin que su daño cambiara**, así que las estrellas decían una
      // cosa y el daño otra. Un item con daño 5 se pintaba ★3, y ★3 valen 8.
      //
      // Ahora es `migraPotenciales()`, más abajo, y **además del campo ajusta el
      // daño** para que cuadre con el potencial que se deduce. Cada item se mueve
      // como mucho medio escalón porque se elige el potencial más cercano, y es la
      // única forma de que la estrella signifique algo.
      //
      // **OJO: ESO SUBE EL DAÑO DE LAS PARTIDAS VIEJAS, Y NO ES UN RETOQUE.** La base
      // de cada tier subió un 20 % sobre el rango viejo y el potencial llega a ×2,
      // así que el suelo nuevo queda por encima de casi todo lo guardado antes —un
      // T3 viejo iba de 13 a 19 y ahora el suelo es 28—. Se acepta porque la
      // alternativa es un item con ★3 que pega como un ★1, que es peor; y se anota
      // en PENDIENTES.md porque es decisión de balance, no un detalle técnico.
      //
      // **YA NO ESTÁ EN `if (savedVersion < 8)`.** Va siempre, porque un item que
      // ya traía el campo podía traerlo con un daño que no era el suyo —una
      // partida guardada a medio camino de una versión intermedia— y eso no lo
      // arregla esperar a la siguiente subida de versión. `migraPotenciales()`
      // devuelve el MISMO array cuando no toca nada, así que no guarda por las
      // nubes.

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
        // El nivel de cristal no existía antes. Sin él no se puede saber cuánto
        // mejora cada cristal, así que se deduce del nombre una sola vez.
        //
        // **LO DE LAS LLAVES SE HA IDO DE AQUÍ, Y POR QUÉ ESTABA.** Se rellenaba su
        // `tier` para poder contarlas por nivel en la migración de los contadores,
        // que venía justo detrás y las convertía en items. Ese par de migraciones se
        // han ido juntas: ahora las llaves se redimen, y para eso solo hace falta el
        // precio, no el nivel.
        if (w.type === 'crystal' && typeof w.tier !== 'number') {
          w.tier = crystalTierFromName(w.name || '');
          warehouseNeedsMigration = true;
        }
      });

      /**
       * MIGRACIÓN: contadores de cristales a items del almacén.
       *
       * Antes eran contadores sueltos. Si el contador dice 7 cristales y el
       * almacén está vacío, esos 7 cristales existen en la partida y hay que
       * materializarlos: si no, el jugador los pierde en el guardado siguiente,
       * cuando `syncMaterialCounters` ajustaría el contador a cero.
       *
       * Aquí se hace al revés que con las cajas, a propósito. Con las cajas el
       * almacén era la fuente y el contador podía quedar inflado, así que se
       * ajustaba el contador. Con el material el saldo es real y no se puede
       * volver a contarlo, porque detrás no hay ningún item.
       *
       * **LO QUE ESTA FUNCIÓN CONTABA ANTES Y AHORA NO: LAS LLAVES.** Contaba por
       * tipo, así que tenía una regla para las llaves y otra para los cristales, y
       * las dos se materializaban con la misma llamada. Con las llaves fuera, esta
       * migración es de un tipo solo y su nombre de "material" describe exactamente
       * lo que queda: el cristal.
       */
      /*
       * BORRADA: LA MIGRACIÓN DE LOS CONTADORES DE MATERIAL.
       *
       * Convertía `data.upgradeCrystals` y `data.crystalsByTier` —contadores sueltos
       * de partidas antiguas— en items del almacén. Existía porque el material era un
       * item y el almacén era la fuente de verdad.
       *
       * **AHORA EL MATERIAL ES UN RECURSO Y NO HAY CONTADORES.** La carga lee
       * `data.crystals`, y si una partida no lo trae pero trae el almacén con
       * `data.crystalTotal`, es una partida tan vieja que el material todavía no era
       * item — la redención de más abajo no encuentra ninguna pila y el contador es
       * lo único que hay.
       *
       * Lo que **no** hacía falta y no se ha dejado: una función que cuenta el
       * almacén y luego decide cuánto falta. Con un recurso el número del guardado es
       * la verdad, y una vista derivada suyo solo puede estorbarl.
       */


      /**
       * MIGRACIÓN: las llaves se redimen, y no se borran.
       *
       * Una partida guardada antes de quitarlas tiene llaves en el almacén, y en el
       * mejor de los casos muchas. **Borrarlas sería robarle al jugador algo que
       * pagó**; dejarlas sería llenar el almacén de objetos que ocupan una ranura y
       * no sirven para nada, sin ningún botón que los toque.
       *
       * Así que se venden solas, por lo que valían. El precio y su motivo están en
       * `redencionDeUnaLlave()`, unas líneas más arriba, y sale del mismo sitio del
       * que salía el precio viejo: **un tercio del par caja+llave**. No es una
       * aproximación, es la misma regla.
       *
       * **Y POR QUÉ ESTÁ AQUÍ Y NO EN UN `if (savedVersion < 9)`:** porque es
       * idempotente por construcción. Las llaves desaparecen del almacén, así que
       * la segunda carga no encuentra ninguna y no vuelve a pagar nada. Una
       * migración que se apoya en un número de versión depende de que el número se
       * lea bien; una que se apoya en "ya no hay nada que redimir" no depende de
       * nada. La versión sube igualmente, para que el cambio quede anotado.
       *
       * Va **DESPUÉS** de materializar los contadores de material y **ANTES** de
       * partir las pilas. En ese orden, lo único que toca son items que ya no
       * sirven: si se hiciera antes, la partición de pilas contaría llaves que están
       * a punto de convertirse en nanitas.
       */
      {
        const llaves = (state.warehouse as any[]).filter((w: any) => w.type === 'key');
        if (llaves.length > 0) {
          let importe = 0;
          for (const llave of llaves) {
            const tier = typeof llave.tier === 'number' ? llave.tier : keyTierFromName(llave.name || '');
            importe += redencionDeUnaLlave(tier) * (llave.stackable ? (llave.stackCount || 1) : 1);
          }
          // El saldo va al contador y **no** a `totalNanitesProduced`: redimir no es
          // jugar, y sumarlo al total haría subir un logro que mide cuánto ha
          // trabajado el jugador.
          state.nanites += importe;
          state.warehouse = (state.warehouse as any[]).filter((w: any) => w.type !== 'key');
          warehouseNeedsMigration = true;
          console.info(
            `[inventario] Las llaves ya no abren nada: ${llaves.length} pila(s) ` +
            `convertida(s) en ${importe} nanitas.`
          );
        }
      }

/**
 * LA REDENCIÓN DE LOS CRISTALES VIEJOS, Y POR QUÉ NO ES UN SUMARIO.
 *
 * Una partida guardada antes de este cambio tiene **items de cristal en el
 * almacén**, con nombre y con su nivel, y a veces muchos: eran apilables pero
 * siempre cabían en una ranura, así que un jugador que los coleccionaba acababa
 * con diez pilas de nivel distinto.
 *
 * **NO SE PUEDEN DESPERDICAR Y NO SE PUEDEN DEJAR.**
 *
 * Dejarlos sería meter basura en el almacén: objetos que ocupan una ranura, que
 * aparecen en la rejilla y que **no tienen ningún botón**, porque ya no hay un
 * selector de cristal ni un item que gastar. Borrarlos sería robarle al jugador
 * algo que compró y que le costó cajas abrir.
 *
 * Así que se convierten en el recurso, y la cuenta sale de la misma regla que usa
 * el resto del juego:
 *
 *     unidades += unidadesDeLaPila × valorDeUnCristal(nivelDeLaPila)
 *
 * **Y ESO ES EXACTAMENTE LO QUE VALÍAN.** Un cristal de nivel n valía **un intento
 * de subir de nivel** a cualquier item, porque F26 obligaba a que fuera del mismo
 * nivel y el coste no dependía del nivel. Con un recurso único, un intento de nivel
 * 0 sobre un item de nivel n cuesta `valorDeUnCristal(n)`. Los dos lados llevan el
 * mismo número, así que la conversión es exacta y no una aproximación.
 *
 * Un jugador con 5 Cristales Primordiales pasa a tener `5 × 145.388`, y eso le da
 * exactamente los 5 intentos que le daban. Ni uno más ni uno menos.
 *
 * **Y NO USA `if (savedVersion < 10)` POR LA MISMA RAZÓN QUE LA DE LAS LLAVES:** es
 * idempotente por construcción, porque las pilas desaparecen del almacén y la
 * segunda carga no encuentra ninguna. La versión sube igualmente, para que el
 * cambio quede anotado.
 *
 * Va **DESPUÉS** de la redención de las llaves y **ANTES** de partir las pilas, por
 * el mismo motivo que aquella: si se hiciera después, `partirPilas` contaría
 * cristales que están a punto de convertirse en un número.
 */
{
  const pilasDeCristal = (state.warehouse as any[]).filter((w: any) => w.type === 'crystal');
  if (pilasDeCristal.length > 0) {
    let unidades = 0;
    for (const pila of pilasDeCristal) {
      // El nivel sale del campo `tier` o, si no lo tiene —partidas más viejas—, del
      // nombre. Es el mismo criterio que usaba el motor, así que una pila vale
      // aquí lo mismo que valía antes.
      const nivel = typeof pila.tier === 'number' ? pila.tier : crystalTierFromName(pila.name || '');
      unidades += valorDeUnCristal(nivel) * (pila.stackable ? (pila.stackCount || 1) : 1);
    }
    state.crystals += unidades;
    state.warehouse = (state.warehouse as any[]).filter((w: any) => w.type !== 'crystal');
    warehouseNeedsMigration = true;
    console.info(
      `[inventario] Los cristales son ahora un recurso: ${pilasDeCristal.length} pila(s) ` +
      `convertida(s) en ${unidades} unidades.`
    );
  }
}

      /**
       * MIGRACIÓN: fusionar las pilas repetidas de las partidas ya jugadas.
       * Cada botín de cristal, caja o consumible se guardaba como un item NUEVO en
       * vez de sumar sus unidades a la pila que ya había. Una partida con 19
       * cristales de Afino tenía 19 entradas: la rejilla las agrupaba en una celda
       * con un "19" y el contador pedía 19 ranuras por ellas. El almacén se llenaba
       * de botín que el jugador nunca había decidido guardar.
       *
       * Esas entradas pasan aquí a ser una sola pila con `stackCount: 19`, que
       * es exactamente lo que el jugador ya veía en la celda. No se pierde
       * ninguna unidad: se suman, y `syncMaterialCounters` sigue leyendo el
       * mismo total de cristales.
       *
       * Va DESPUÉS de materializar los contadores, no antes. `addToWarehouse` ya
       * suma a la pila existente, así que fusionar antes sería deshacer lo que
       * la migración acaba de apilar.
       */
      const fusionado = partirPilas(state.warehouse);
      if (fusionado.changed) {
        state.warehouse = fusionado.items;
        warehouseNeedsMigration = true;
      }

      /**
       * G4 · TODO ITEM TIENE POTENCIAL, Y SU DAÑO ES EL DE SUS ESTRELLAS.
       *
       * El potencial llegó después que los items, así que hay partidas guardadas
       * con recolectores sin el campo. `potencialDe()` ya los leía como ★3 sin
       * más, y eso era una mentira por la pantalla: un item con daño 5 se pintaba
       * ★3, y ★3 valen 8. El jugador comparaba dos items por un número que no era
       * el de las estrellas, que es justo para lo que sirven las estrellas.
       *
       * Por eso la migración **escribe el potencial Y recalcula el daño**: el
       * potencial más cercano deja el daño casi igual de por sí, así que no le
       * quita nada al jugador y a cambio hace que el número que se pinta y el
       * número que pega sean el mismo.
       *
       * Va después de `partirPilas()` y no antes: partir crea items nuevos
       * —copias— y un item nuevo que sale de una partición tiene que pasar por la
       * migración como cualquier otro.
       */
      const conPotencial = migraPotenciales(state.warehouse);
      if (conPotencial.changed) {
        state.warehouse = conPotencial.items;
        warehouseNeedsMigration = true;
      }
      const compConPotencial = migraPotencialesDeCompaneros(state.companions, state.warehouse);
      if (compConPotencial.changed) {
        state.companions = compConPotencial.companeros;
        state.warehouse = compConPotencial.fichas;
        warehouseNeedsMigration = true;
      }

      // El nivel va ENCIMA de la del potencial, no antes: el techo sale del
      // potencial, y si se calcula antes de rellenarlo, un compañero viejo sin
      // potencial recibe el techo del 3 y ya no se le corrige nunca.
      const compConNivel = migraNivelesDeCompaneros(state.companions, state.warehouse);
      if (compConNivel.changed) {
        state.companions = compConNivel.companeros;
        state.warehouse = compConNivel.fichas;
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
      // **Y NO SE PUEDE ESTIMAR CON `pendingCores`, QUE ES LO QUE HACÍA ANTES.**
      // `pendingCores(producido)` responde a "cuántos núcleos daría si empezara
      // desde cero con esta producción", pero una partida vieja YA GASTÓ
      // producción en sus propias ascensiones. Medido con 412 M y 12 reinicios:
      // la estimación daba 296 núcleos, y como `nextCores` resta el histórico,
      // el siguiente Ascenso pedía **0 más**: el jugador se quedaba **atascado
      // para siempre**, sin Ascensión posible y sin ningún aviso en pantalla.
      //
      // **LO QUE SE USA ES UN DATO EXACTO, Y LA IDEA FUE DEL JUGADOR:** todo
      // núcleo ganado está en un sitio u otro, así que el histórico es
      // `cartera + gastados en el árbol`. Los gastados se pueden sumar nivel a
      // nivel con la MISMA función que cobra la tienda de pasivas, así que no es
      // una estimación sino la cuenta real de lo que se pagó.
      //
      // Y es la única reconstrucción que no puede romper una partida: si el
      // número sale alto, al siguiente Ascenso `nextCores` da 0 y no se rompe
      // nada; y al Ascender, `totalCores` se recalcula con el dato bueno y deja
      // de depender de esto para siempre.
      if (!data.totalCores && (data.resets ?? 0) > 0) {
        const enArbol = coresGastadosEnArbol(data.nodeLevels);
        state.totalCores = (data.cores ?? 0) + enArbol;
        console.info(
          `[migracion] Historico de nucleos reconstruido: ${state.totalCores}`,
          `(cartera ${data.cores ?? 0}, arbol ${enArbol})`
        );
      }
      state.buffs = {
        clickBoostExpiresAt: data.buffs?.clickBoostExpiresAt ?? 0,
        passiveBoostExpiresAt: data.buffs?.passiveBoostExpiresAt ?? 0,
        clickX2ExpiresAt: data.buffs?.clickX2ExpiresAt ?? 0,
        clickX3ExpiresAt: data.buffs?.clickX3ExpiresAt ?? 0,
        // Los totalizadores no se coaccionan aquí sino en el bucle de abajo, con la
        // tabla: escribirlos en los dos sitios es la forma de que se queden a medias.
        clickBoostTotalMs: 0,
        passiveBoostTotalMs: 0,
        clickX2TotalMs: 0,
        clickX3TotalMs: 0
      };

      /**
       * CUÁNTO SE CONCEDIÓ EN EL ÚLTIMO USO, Y POR QUÉ SE COACCIONA (R8).
       *
       * Son campos nuevos y una partida vieja no los tiene: sin `?? 0` quedarían en
       * `undefined`, y el HUD haría `restante / undefined` = `NaN`, que en un `style`
       * es una anchura inválida y la barra desaparece. Con 0, el HUD vuelve a la
       * duración de una tarjeta, que es lo que se pintaba antes de que el campo existiera.
       *
       * Los cinco se coaccionan con el mismo bucle y **no a mano**, porque un campo
       * nuevo que se añade aquí y se escribe en `data/buffs.ts` en dos sitios es un
       * campo que se queda añado en el segundo.
       */
      for (const campo of BUFF_TOTAL_CAMPOS) {
        (state.buffs as any)[campo] = Math.max(0, Number((data.buffs as any)?.[campo]) || 0);
      }
      state.afkTotalMs = Math.max(0, Number(data.afkTotalMs) || 0);

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
        crystals: state.crystals,
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
        forgedCount: state.forgedCount,
        cosmetics: state.cosmetics,
        autoVenta: state.autoVenta,
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
          // **EL POTENCIAL Y EL TIER VIENEN DE LA FICHA, NO SE DEJAN.** Este item
          // es el mismo compañero que `state.companions`, y el del almacén es el
          // que pinta las estrellas y el que se vende: si naciera sin potencial,
          // la rejilla mostraría un compañero sin estrellas que en el panel sí las
          // tiene. Los seis exclusivos de caja no tienen potencial y por eso
          // salen sin él, que es lo correcto y no un olvido.
          tier: comp.tier,
          potential: comp.potential,
          // **EL NIVEL VA TAMBIÉN EN LA FICHA, Y POR LA MISMA RAZÓN QUE EL POTENCIAL.**
          // Esta ficha es la que pinta las estrellas y la que se vende; si el nivel
          // se quedara solo en `state.companions`, el almacén y el panel dirían
          // cosas distintas del mismo objeto.
          level: comp.level ?? 0,
          maxLevel: comp.maxLevel ?? nivelMaximoDeCompanio(comp.potential),
          sellPrice: comp.rarity === 'Común' ? 100 : comp.rarity === 'Raro' ? 500 : comp.rarity === 'Épico' ? 2000 : 10000
        } as any);
      }
    });
    enforceWarehouseCapacity();
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
  }

  /**
   * F31 · EL TIPO DE CAJA SE LEE DEL NOMBRE, Y EL NOMBRE LLEVA EL NÚMERO.
   *
   * Antes eran cuatro palabras sueltas —común, rara, épica, legendaria— y
   * `null` para todo lo demás. Con diez cajas eso no escala, así que la caja se
   * llama `Caja T7` y aquí se lee el número. Tres cosas mejora de golpe: un item
   * mal escrito deja de abrirse como la mejor caja del juego, añadir una caja
   * no obliga a añadir una palabra, y el nombre que ve el jugador es el mismo
   * número que decide el botín.
   *
   * **Y LAS CUATRO CAJAS VIEJAS SIGUEN SIENDO LEGIBLES.** Una partida guardada
   * antes de F31 tiene 'Caja Común', 'Caja Rara', 'Caja Épica' y 'Caja Legendaria'
   * en el almacén, y no hay item nuevo que las sustituya: perderlas sería quitarle
   * al jugador algo que ya tenía. Se mapean a las cajas que eran —común a la T1,
   * rara a la T3, épica a la T6, legendaria a la T8—, que es el tier donde cada
   * una vivía, así que el jugador no pierde su posición en la escalera.
   */
  function getCrateTypeFromName(name: string): CrateType | null {
    const n = (name || '').toLowerCase();
    const moderna = n.match(/caja t(\d+)/);
    if (moderna) {
      const t = Number(moderna[1]);
      return (t >= 1 && t <= MAX_CRATE_TIER) ? (t as CrateType) : null;
    }
    // Legacy: el tier donde vivía cada caja antes de que hubiera una por tier.
    if (n.includes('común')) return 1;
    if (n.includes('rara')) return 3;
    if (n.includes('épica')) return 6;
    if (n.includes('legendaria')) return 8;
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
    // F31 · Se construye vacía y se rellena en el bucle, con una línea por caja
    // escrita a mano. Con diez cajas eran diez líneas que se olvidarían, y la que
    // se olvidara daría `NaN` en el contador —que es un contador que se guarda y
    // se resta.
    const counts = Object.fromEntries(CRATE_TIERS.map(t => [t, 0])) as Record<CrateType, number>;

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

    CRATE_TIERS.forEach(crateType => {
      const missing = (state.crates[crateType] ?? 0) - counts[crateType];
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
  // Las tarjetas AFK también se derivan del almacén al cargar. Antes se leía
  // `afkCards` del guardado y ya está: como el contador contaba items en vez de
  // unidades, quien tuviera tarjetas apiladas arrastraba el error indefinidamente,
  // guardado a guardado. Derivar al cargar lo deja bien sin tocar los items.

  // **Y DESPUÉS DE LOS LOGROS, LOS COSMÉTICOS.** El orden importa: la vía del logro
  // pregunta por `state.unlockedAchievements`, y `checkAchievements()` es lo que la
  // rellena. Al revés, un jugador con logros de hace meses no recuperaría nada nunca,
  // porque la lista ya estaba llena cuando se evaluó.
  reconciliaCosmeticos();
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

/**
   * REPARTE LOS COSMÉTICOS QUE EL CATÁLOGO DECLARA Y NADIE REPARTÍA.
   *
   * El catálogo de cosmeticos tiene **cuatro vías** --logro, núcleo, ranking y caja-- y
   * solo la caja llegaba al jugador. Las otras tres no las leía nadie: el catálogo decía
   * "se desbloquea con un logro" y **el logro no repartía nada**, así que el Tóxico, el
   * Carmesí, el Atardecer y el Neón eran inalcanzables para siempre. El jugador lo ve en la
   * lista de cosméticos del Perfil, con la razón al lado, y no hay forma de llegar.
   *
   * ## POR QUÉ ES UNA RECONCILIACIÓN Y NO UN DESBLOQUEO EN EL MOMENTO
   *
   * Porque **el logro ya estaba en el guardado cuando se escribió esto.** Un jugador que
   * llevaba semanas con el Carmesí bloqueado tiene el logro `ascendant` desbloqueado de
   * hace meses, y un código que solo reparta en el momento del logro no le daría nada
   * nunca: **el logro no vuelve a saltar**. Reconciliar es preguntarle al estado lo mismo
   * que se le pregunta en cada carga, y por eso un cosmético perdido se recupera solo.
   *
   * ## Y POR QUÉ NO AVISA
   *
   * **porque al cargar puede ser un montón.** Un jugador con 30 de núcleos y 12 de logros
   * recibe seis de golpe, y seis avisos apilados tapando la pantalla es peor que ninguno.
   * La lista del Perfil es donde se ven.
   *
   * La regla de quién está entera en `cosmeticsAlcanzables()`, con el motivo de cada
   * vía escrita. Aquí solo se recorre.
   */
  function reconciliaCosmeticos(): string[] {
    const nuevos: string[] = [];
    for (const cos of cosmeticsAlcanzables({
      unlockedAchievements: state.unlockedAchievements,
      totalCores: state.totalCores
    })) {
      if (desbloquearCosmetico(cos.id)) nuevos.push(cos.id);
    }
    return nuevos;
  }

  function checkAchievements() {
    const newly = evaluateAchievements(state, achievementState);
    if (newly.length === 0) return;

    // El logro entra en la lista y **después se reparte lo que ese logro abre.** Al revés, la
    // vía `achievement` miraría una lista a la que todavía no le falta su id, y el cosmético
    // se quedaría bloqueado hasta la siguiente recarga.
    reconciliaCosmeticos();
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

  /**
   * LOS MATERIALES DE UNA FUSIÓN, Y POR QUÉ ESTÁN AQUÍ Y NO EN LA FUNCIÓN.
   *
   * Recolectores y compañeros se fusionan con las mismas cuatro reglas: dos
   * materiales, **distintos**, del mismo tipo y del mismo tier, y ninguno
   * equipado. Escribidas dos veces son dos ocasiones de que una acepte tres
   * materiales y la otra dos, o de que una deje consumir el recolector equipado y
   * la otra no.
   *
   * Va en el cierre de `createGameLoop` y no dentro del objeto que se devuelve,
   * porque **no es parte de la API**: es una cuenta interna que el motor hace
   * antes de gastar nada. Si viviera en el objeto, la vista podría llamarla y
   * saltarse el camino del cobro.
   *
   * **Y VA ANTES DE COBRAR NADA.** Eso no es un detalle de orden, es lo que
   * protege al jugador: un rechazo después del cobro se lleva piedras y
   * nanopartículas por una fusión que no ocurrió. La vista ya no manda
   * duplicados, pero la API no puede fiarse de la vista (R1).
   */
  function materialesDeForja(
    materialIds: string[],
    tipo: 'collector' | 'companion'
  ): { materials?: any[]; tier?: number; error?: string } {
    const nombre = tipo === 'collector' ? 'recolectores' : 'compañeros';
    const uno = tipo === 'collector' ? 'recolector' : 'compañero';
    const equippedIds: string[] = tipo === 'collector'
      ? state.warehouse.filter((w: any) => w.equipped).map((w: any) => w.id)
      : (state.activeCompanions || []);

    if (materialIds.length !== MATERIALES_POR_FUSION) {
      return { error: `Selecciona exactamente ${MATERIALES_POR_FUSION} ${nombre}.` };
    }
    const materials = materialIds
      .map(id => state.warehouse.find((w: any) => w.id === id))
      .filter((w: any): w is any => !!w);
    if (materials.length !== MATERIALES_POR_FUSION) {
      return { error: 'Material no encontrado.' };
    }
    if (materials.some((m: any) => m.type !== tipo)) {
      return { error: `Solo se pueden fusionar ${nombre}.` };
    }
    const tier = materials[0].tier || 1;
    if (materials.some((m: any) => (m.tier || 1) !== tier)) {
      return { error: `Los ${MATERIALES_POR_FUSION} ${nombre} deben ser del mismo tier.` };
    }
    // F24 · Dos POSICIONES no son dos MATERIALES. Sin esto, mandar el mismo id dos
    // veces cuenta como dos: se "fusiona" un solo item y sale otro, ahorrándose un
    // material. El que cuenta es el motor, no la vista.
    if (new Set(materialIds).size !== MATERIALES_POR_FUSION) {
      return { error: `Selecciona ${MATERIALES_POR_FUSION} ${nombre} distintos.` };
    }
    // Lo equipado no se puede consumir: perderlo sería un castigo doble. El
    // recolector se marca con `equipped` en su ficha y además con el id del motor;
    // el compañero con la lista de activos, que es lo único que hay para él.
    if (materials.some((m: any) => equippedIds.includes(m.id))) {
      return { error: `No puedes fusionar el ${uno} equipado. Desequípalo primero.` };
    }
    return { materials, tier };
  }

    /**
   * Las piedras y la nanopartícula, y el orden en que se cobran.
   *
   * **POR QUÉ ESTA FUNCIÓN DEVUELVE EL ERROR EN LUGAR DE TIRAR.** Cobra de verdad:
   * descuenta del almacén. Un cobro a medias —piedras sí, nanopartícula no— dejaría
   * al jugador con la partida peor sin haber fusionsado nada. Así que primero se
   * mira que estén las dos, y solo entonces se toca el almacén.
   *
   * El tope de 5 piedras por fusión es la regla de la forja infinita: a partir de
   * ahí la probabilidad ya está cerca del tope y una más solo cobraría.
   */
  function gastaConsumiblesDeForja(
    stonesUsed: number,
    nanoUsed: number
  ): { stones?: number; nano?: number; error?: string } {
    const stones = Math.max(0, Math.min(5, stonesUsed));
    const nano = nanoUsed > 0 ? 1 : 0;

    // Se declara sin valor y se rellena solo si toca gastar: una ficha puede no
    // existir y eso no es un error si no se pidió ninguna.
    let piedra: any;
    let nanoFicha: any;

    if (stones > 0) {
      piedra = state.warehouse.find(
        (w: any) => w.type === 'consumable' && w.buffId === 'calibrationStone'
      );
      if (!piedra) return { error: 'No tienes Piedras de Calibración.' };
      const available = piedra.stackCount || 1;
      if (available < stones) {
        return { error: `Solo tienes ${available} Piedra(s) de Calibración.` };
      }
    }
    if (nano > 0) {
      nanoFicha = state.warehouse.find(
        (w: any) => w.type === 'consumable' && w.buffId === 'stabilityNano'
      );
      if (!nanoFicha) return { error: 'No tienes Nanopartículas de Estabilidad.' };
      const available = nanoFicha.stackCount || 1;
      if (available < nano) {
        return { error: `Solo tienes ${available} Nanopartícula(s).` };
      }
    }

    // Las dos existen y las dos alcanzan: aquí sí se toca el almacén, y aquí van
    // las dos, no una detrás de otra con una comprobación en medio. Un cobro a
    // medias dejaría al jugador peor sin haber fusionsado nada.
    if (stones > 0) {
      piedra.stackCount = (piedra.stackCount || 1) - stones;
      if (piedra.stackCount <= 0) {
        state.warehouse = state.warehouse.filter((w: any) => w.id !== piedra.id);
      }
    }
    if (nano > 0) {
      nanoFicha.stackCount = (nanoFicha.stackCount || 1) - nano;
      if (nanoFicha.stackCount <= 0) {
        state.warehouse = state.warehouse.filter((w: any) => w.id !== nanoFicha.id);
      }
    }
    return { stones, nano };
  }
/**
   * Lo que se hace con los materiales después de la tirada, sea cual sea el
   * resultado: **en los dos casos se pierden**.
   *
   * F33 · El acierto soltaba 1 de los 2, y eso rompía dos cosas a la vez: la
   * valoración y el banco tratan los materiales como gastados, así que mostraban
   * una densidad un 50 % peor que la real (R3), y con 2 materiales el coste neto
   * por tier caía a 1 y la forja se volvía prácticamente gratis.
   */
  function consumeMaterialesDeForja(materialIds: string[]) {
    state.warehouse = state.warehouse.filter((x: any) => !materialIds.includes(x.id));
    // **Y EL COMPAÑERO TIENE DOS SITIOS, ASI QUE HAY QUE BORRARLO DE LOS DOS.**
    //
    // Un recolector vive solo en el almacén. Un compañero vive en `state.companions` —que
    // es lo que paga el ingreso y lo que ve el panel— y en el almacén, donde solo hay una
    // copia para que se pueda vender y se vea en la rejilla. Esta función quitaba la copia.
    //
    // Y `syncCompanionsToWarehouse()` **crea la entrada de cada compañero que siga en
    // `state.companions`**, así que la copia volvía sola: en el acierto, en la misma
    // llamada, porque el sincronismo se ejecuta justo después de consumir; y en el fallo,
    // en la siguiente acción que sincronice.
    //
    // O sea que **fusionar dos compañeros no costaba los dos**, que era una forja gratis, y
    // las fichas seguían vivas dando ingreso pasivo: un compañero que no está en ningún
    // almacén pero que sigue pagando. Las tres ramas —acierto y fallo— llaman a esta misma
    // función, así que arreglarlo aquí lo arregla en las dos y no cabe arreglarlo dos veces.
    //
    // **Y SE SACA DE LOS ACTIVOS, POR SI ALGUNA VEZ SE LLEGARAN A ESTAR.** Hoy no puede
    // pasar: `materialesDeForja()` rechaza un compañero activo. Se deja la línea porque
    // un id en `activeCompanions` sin ficha es un ingreso fantasma, y si algún día la regla
    // que lo impide se relaja, esta es la línea que lo cierra.
    state.companions = state.companions.filter((c: any) => !materialIds.includes(c.id));
    state.activeCompanions = (state.activeCompanions as string[]).filter(
      (id) => !materialIds.includes(id)
    );
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
        // **EL NIVEL MULTIPLICA AQUÍ, Y NO AL ESCRIBIR `power`.** El poder guardado
        // es `poderDeCompanero(tier, potencial)`, que es lo que comparan los bancos y
        // lo que dice la ficha. Si el nivel se escribiera dentro, ese número dejaría
        // de ser "el poder de un T5 con potencial 3" y pasaría a ser "el poder de
        // uno al que ya le has subido cinco niveles", que es otra pregunta.
        //
        // Y el multiplicador es la MISMA función que usa el recolector, así que un
        // nivel vale lo mismo en los dos y no hay dos reglas que separar.
        base += Math.round((comp.power || 0) * multiplicadorDeNivel(comp.level));
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
  function equippedAffixEffect(): { clickMult: number; passiveMult: number } {
    const out = { clickMult: 0, passiveMult: 0 };
    if (!state.equippedCollectorId) return out;
    const item: any = state.warehouse.find((w: any) => w.id === state.equippedCollectorId);
    if (!item?.affixes?.length) return out;
    const nivel = item.level || 0;
    for (const affixId of item.affixes) {
      const affix = AFFIX_BY_ID[affixId];
      if (!affix) continue;
      out.clickMult += affix.effect.clickMult || 0;
      out.passiveMult += affix.effect.passiveMult || 0;
      // Los que dependen del nivel suman un PORCENTAJE por nivel, no un número
      // plano: es lo que hace que subir de nivel siga valiendo sin que un
      // "+8 por nivel" turned un T1 en un T10. Ver el comentario de AFFIXES.
      out.clickMult += (affix.effect.clickMultPorNivel || 0) * nivel;
      out.passiveMult += (affix.effect.passiveMultPorNiveles || 0) * (nivel / 5);
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
    // **EL SUELO DE 1, Y POR QUÉ ESTÁ AQUÍ Y NO EN UN CANDADO ARRIBA.**
    //
    // Sin recolector equipado no hay de dónde sacar un daño, y antes esta función
    // devolvía el cero de guarda: cero por click, cero ingreso, y como la tienda no
    // vende recolectores, cero forma de comprar la caja que podría dar uno. La partida
    // quedaba bloqueada sin ninguna salida.
    //
    // El suelo lo pone `DANIO_MINIMO_SIN_RECOLECTOR`, que es 1, y **es el mismo número
    // que el daño del recolector más débil que existe**: no hay un estado raro al que
    // llegar, hay el peor objeto del juego sin ninguna ventaja. Lo que se pierde es la
    // razón para no estar sin nada, que es lo que evita que se llegue; a cambio se
    // pierde el modo de quedar atrapado, que es lo único que no tiene arreglo.
    //
    // Y los multiplicadores de buff, nivel, compañero y logros se aplican **encima** de
    // este suelo, sin tocarlo. Un jugador sin recolector que tenga una tarjeta permanente de click x3
    // hace 3 por clic, que es justo lo que hace un jugador con el peor objeto del juego y
    // el misma tarjeta.
    if (!state.equippedCollectorId) return sueloDeClick();
    const item: any = state.warehouse.find((w: any) => w.id === state.equippedCollectorId);
    if (!item) return sueloDeClick();

    const affixes = equippedAffixEffect();
    // `Math.max` y no `|| 0`: un recolector con daño 0 —un guardado raro, un afijo que
    // lo borre— también se queda en el suelo, por el mismo motivo. Con 0 ahí el jugador
    // estaría igual de bloqueado y con un item en la mano, que es más difícil de
    // entender.
    const base = Math.max(DANIO_MINIMO_SIN_RECOLECTOR, item.damage || 0);
    const levelMultiplier = multiplicadorDeNivel(item.level);
    const conNivel = base * levelMultiplier;
    const total = base
      * levelMultiplier
      * calculateCompanionMultiplier()
      * (1 + achievementState.clickBonus)
      * (1 + state.bonus.clickMult)
      * (1 + affixes.clickMult);
    return { total, base, conNivel };
  }

  /**
   * El daño mínimo de un click, y por qué es 1.
   *
   * **ES EL DAÑO DEL RECOLECTOR MÁS DÉBIL DEL JUEGO, NO UN NÚMERO PUESTO PARA QUE
   * CUADRE.** La razón de que sea ese y no otro es que el suelo tiene que ser
   * reconocible: si fuera 1 mientras el peor recolector da 12, el jugador sin nada
   * estaría en un estado que el juego no explica; si es 12, está jugando con el peor
   * objeto, que es un estado que el juego ya conoce y con el que ya hay una ruta de
   * salida.
   *
   * Con el valor en 1 el jugador sin recolector avanza **más despacio que con el peor
   * recolector**, y eso es lo que debe pasar: el suelo quita el bloqueo, no quita la
   * consecuencia de haberlo perdido.
   */
  const DANIO_MINIMO_SIN_RECOLECTOR = 1;

  /** El suelo, pasando por los mismos multiplicadores que un daño normal. */
  function sueloDeClick(): { total: number; base: number; conNivel: number } {
    const base = DANIO_MINIMO_SIN_RECOLECTOR;
    const total = Math.floor(base
      * calculateCompanionMultiplier()
      * (1 + achievementState.clickBonus)
      * (1 + state.bonus.clickMult)
      * (1 + equippedAffixEffect().clickMult));
    return { total, base, conNivel: base };
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

  /**
 * EL DANO DEL RECOLECTOR, PARTIDO EN DOS: LO QUE ES DEL ITEM Y LO QUE ES DE LA PARTIDA.
 *
 * ## LA LINEA QUE LO DEFINE
 *
 * **UN RECOLECTOR PRODUCE UNA CIFRA PROPIA, Y DESPUES LA PARTIDA LE SUMA OTRA.** Un
 * T11 con cinco estrellas en el nivel 12 produce lo que produce por sí mismo —con su
 * potencial, con sus niveles comprados con cristales y con sus afijos—, y aparte el resto
 * de la partida —los compañeros, los logros, el árbol y los buffs— le multiplica. Eso se
 * escribe "30+5": el 30 es el item y el 5 no lo es.
 *
 * **Y LA CORTE ES EL AFILO, QUE ES LO QUE CUESTA CLASIFICAR.** Un afijo parece del item
 * porque va impreso en él y sale de la forja con él, pero **su bonificación solo cuenta
 * mientras esté equipado**, igual que el árbol. Aun así va con el item y no con la
 * partida, porque es una propiedad suya: si el afijo fuera de la partida bastaría con
 * cambiar de recolector para perderlo, y eso no es lo que pasa. Va en el grupo del item y
 * con eso la línea se sostiene —"lo que da este objeto"— en los dos casos.
 *
 * **LO QUE NO ESTÁ Y NO SE PONE: LA RAREZA.** La rareza no multiplica el daño en
 * ninguna parte del juego, solo el precio. Aquí solo hay daño.
 *
 * ## LAS SUMAS CUADRAN CON EL TOTAL, Y ESO SE COMPRUEBA
 *
 * El acumulado va en coma flotante y **lo que se pinta es el suelo**, porque el daño que
 * se cobra también lo es: se trunca. La primera versión redondeaba cada paso y la última
 * fila acababa en un número que no era el de arriba; cuatro redondeos seguidos no son un
 * redondeo, son cuatro. Con el suelo, la base más las filas da exactamente la cifra
 * grande, y la suma de los dos grupos da el mismo número que esa cifra.
 */
  function danosDeClick(): {
    base: number;
    intrinseco: number;
    partida: number;
    total: number;
    filas: Array<{ nombre: string; detalle: string; suma: number; grupo: 'item' | 'partida' }>;
  } {
    const item: any = state.equippedCollectorId
      ? state.warehouse.find((w: any) => w.id === state.equippedCollectorId)
      : null;
    const vacio = { base: 0, intrinseco: 0, partida: 0, total: 0, filas: [] as any[] };
    if (!item) return vacio;

    const pot = potencialNormalizado(item.potential);
    const multPot = 1 + 0.2 * pot;
    // La base se deduce del daño guardado, y por eso puede salir con decimales: es la
    // cifra que hace que el potencial multiplicando dé justo el daño que trae el item.
    const base = Math.max(DANIO_MINIMO_SIN_RECOLECTOR, item.damage || 0) / multPot;
    const filas: Array<{ nombre: string; detalle: string; suma: number; grupo: 'item' | 'partida' }> = [];
    let acum = base;
    let mostrado = Math.floor(acum);
    let delItem = 0;

    const anota = (nombre: string, detalle: string, mult: number, grupo: 'item' | 'partida') => {
      if (Math.abs(mult - 1) <= 0.0001) return;
      acum *= mult;
      const ahora = Math.floor(acum);
      // Un bono que no mueve el suelo no se pinta: una fila con un +0 es ruido.
      if (ahora === mostrado) return;
      const salto = ahora - mostrado;
      filas.push({ nombre, detalle, suma: salto, grupo });
      if (grupo === "item") delItem += salto;
      mostrado = ahora;
    };

    // --- LO QUE ES DEL ITEM ---------------------------------------------------
    // El potencial primero porque es lo primero que se aplicó, y su detalle lleva el
    // porcentaje **sin un "+" delante**: la fila ya tiene su cifra a la derecha, y dos
    // signos más en la misma línea obligan a decidir cuál de los dos leer.
    anota(`Potencial ${pot}★`, `${Math.round((multPot - 1) * 100)}% más de daño`, multPot, "item");
    const nivel = Math.max(0, Math.floor(Number(item.level) || 0));
    if (nivel > 0) anota(`Nivel ${nivel}`, "del recolector", multiplicadorDeNivel(nivel), "item");
    // Los afijos son del item: van con él, salen de la forja con él y solo hay que
    // tenerlo equipado. Por eso no van con el árbol, aunque se comporten igual.
    anota("Afijos", "del item", 1 + equippedAffixEffect().clickMult, "item");

    // --- LO QUE ES DE LA PARTIDA ------------------------------------------------
    anota("Compañeros", "de la partida", calculateCompanionMultiplier(), "partida");
    anota("Logros", "de la partida", 1 + achievementState.clickBonus, "partida");
    anota("Árbol de pasivas", "de la partida", 1 + state.bonus.clickMult, "partida");
    anota("Buff de click", "temporal", calculateMultiplier(), "partida");

    const total = Math.floor(acum);
    return {
      base: Math.floor(base),
      intrinseco: Math.floor(base) + delItem,
      partida: total - Math.floor(base) - delItem,
      total,
      filas
    };
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
        crystals: state.crystals,
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
        forgedCount: state.forgedCount,
        cosmetics: state.cosmetics,
        autoVenta: state.autoVenta,
        updatedAt: new Date(),
        // ======================================================================
        //  EL BORRADO DE LAS ESQUIRLAS, Y POR QUÉ NECESITA SU PROPIA LÍNEA
        // ======================================================================
        //
        //  `setDoc` va con `merge: true`, y con `merge` **lo que no está en el objeto no
        //  se borra**: se queda. Quitar `shards` del estado y de esta lista no lo quita
        //  del documento de nadie, solo deja de escribirlo —que es esconderse, no
        //  borrarse—. Medido con una partida vieja: tras recargar, el documento seguía
        //  teniendo `shards: 9999`.
        //
        //  `deleteField()` es el idiom de Firestore para eso, y por eso se escribe
        //  **explícitamente el nombre del campo viejo**: porque dentro de dos años esto
        //  va a ser lo raro de leer, y lo raro de leer tiene que decir por qué está ahí.
        //
        //  Y es la diferencia entre quitar el concepto y tapar el síntoma. Ya se hizo
        //  antes con `equippedWeaponId` y allí se aceptó el rastro; aquí no, porque aquel
        //  campo lo leía alguien y este ya no lo lee nadie.
        // ======================================================================
        shards: deleteField()
      };
      // ==========================================================================
// ==========================================================================
      //  PASO 1 · EL DOCUMENTO DE LA PARTIDA. ESTE ES EL QUE IMPORTA.
      // ==========================================================================
      //
      //  `ignoreUndefinedProperties` no es un detalle: **sin él, un único
      //  `undefined` en cualquier item del almacén hace que Firestore RECHACE el
      //  documento entero**, y el jugador pierde el progreso entero por un campo
      //  opcional que no existía. Los items vienen de la ruleta, del guardado y
      //  de las migraciones, y los tres ponen y quitan campos: un item de una
      //  partida vieja no tiene `sellPriceTope`, uno nuevo sí lo tiene, y uno de
      //  antes de los potenciales no tiene `potential`.
      //
      //  Con la opción, el campo que falte simplemente no se escribe y el resto
      //  llega igual. Es la diferencia entre "un item sin un número" y "todo el
      //  progreso de la partida".
      await setDoc(userRef, gameData, { merge: true });
// ==========================================================================
      //  PASO 1bis · EL DOCUMENTO DEL RANKING. ES OTRO, Y FALLAR AQUÍ NO ES
      //  PERDER LA PARTIDA.
      // ==========================================================================
      //
      //  **ESTE ES EL MOTIVO DEL AVISO QUE NO TENÍA SENTIDO.** Las dos escrituras
      //  estaban en el mismo `try`, así que un fallo del ranking —que es un
      //  documento público, con reglas de seguridad propias y campos que la
      //  partida no necesita para nada— encendía "Sin guardar en el servidor" con
      //  la partida **perfectamente guardada**. Y como el aviso es lo único que el
      //  jugador ve, la conclusión que sacaba era la contraria de la real: que su
      //  progreso estaba en peligro.
      //
      //  Ahora tienen su propio `try` y su propio aviso, y el indicador grande
      //  solo se enciende si falla **la partida**.
      try {
        await setDoc(rankingRef, {
          userId: user.uid,
          username: displayName || 'Operativo',
          // **EL HISTÓRICO, NO EL SALDO.** Aquí se guarda `state.nanites`, y la
          // Ascensión lo pone a cero: ascend eras y caías al último puesto del
          // ranking, siendo el jugador que más había jugado el que más perdía.
          // Lo que no se reinicia nunca es `totalNanitesProduced`, que es lo que
          // el ranking debe medir: cuánto has producido, no cuánto te queda en el
          // bolsillo. Ver B13.
          score: state.totalNanitesProduced,
          totalClicks: state.totalClicks,
          // Módulo 8: el ranking refleja logros y firmas de autor
          achievements: state.unlockedAchievements.filter(id => !SECRET_ACHIEVEMENTS.includes(id as AchievementId)).length,
          secretAchievements: state.unlockedAchievements.filter(id => SECRET_ACHIEVEMENTS.includes(id as AchievementId)).length,
          forgedCount: state.forgedCount,
          // F29 · Los núcleos van al documento PÚBLICO del ranking. No hay decisión
          // de privacidad: un número de núcleos es "cuántas veces has reiniciado", no
          // el saldo ni el inventario. Y `totalCores`, no `cores`: los núcleos que
          // gastas en el árbol no son menos Ascensión hecha.
          cores: state.totalCores,
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
      } catch (rankingError) {
        // Se avisa por consola y con un aviso propio, y NO se toca el indicador
        // grande. La partida está guardada; lo que falla es una tabla de posiciones.
        //
        // Y el "se ha arreglado" va **fuera** del `catch`: en JavaScript un
        // `catch` no admite `else`, que es un `if/else` disfrazado. La bandera es
        // la forma de decirlo sin reescribir el bloque.
        console.error("Error al guardar en el ranking:", rankingError);
        rankingFallando = true;
      }
      // `rankingSeAviso` es "ya le he dicho al jugador que el ranking falla", para
      // no repetir el mismo aviso cada quince segundos igual que hace el grande.
      if (!rankingFallando && rankingSeAviso) {
        rankingSeAviso = false;
        showToast('Tu posición en el ranking está al día.', 'success');
      } else if (rankingFallando && !rankingSeAviso) {
        rankingSeAviso = true;
        showToast(
          'Tu partida se está guardando bien, pero la tabla de posiciones no responde. ' +
          'Tu progreso no corre riesgo.',
          'info'
        );
      }

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
  // carga, que acaba de ocurrir.
  //
  // **EL "¿QUEDÓ ALGO?" SE PREGUNTÓ ANTES, ARRIBA DEL TODO, Y NO AQUÍ.**
  //
  // Preguntarlo aquí era mentira: el guardado de carga acaba de llamar a
  // `anotarPendiente()`, así que la cola está escrita cuando se llega a esta línea
  // y su confirmación es una promesa que aún no ha resuelto. La condición no decía
  // "quedó algo de la sesión anterior", decía "acabamos de guardar" — y por eso
  // era **cierta en cada carga de página** y programaba un guardado inútil para
  // escribir lo mismo que ya estaba escrito.
  //
  // **Y ESO NO ERA COSA DE NADA: SE COLABA EN MEDIO DE LO QUE ESTÁ PASANDO.** Es
  // un `setTimeout` de 1,2 s que nadie ha pedido, así que puede caer entre dos
  // pulsaciones del jugador: su `anotarPendiente()` se queda con el estado de ese
  // instante y el documento queda guardado a medias. Un banco que recargaba sin
  // volcar antes leyó ese documento a medias y dio un saldo que no correspondía a
  // ningún momento — y por eso era una prueba intermitente, que es la peor clase
  // de prueba: entrena a ignorar el banco entero.
  if (habiaColaAlArrancar) {
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
     * EL DAÑO DEL RECOLECTOR EN DOS PARTES, CON SU DESGLOSE. Ver `danosDeClick()`.
     *
     * **El número grande de la base se escribe "30+5"**, y por eso esto devuelve las dos
     * partes por separado en vez de un total: `intrinseco` es lo que produce el item por sí
     * mismo —potencial, niveles y afijos— y `partida` es lo que le suma el resto —compañeros,
     * logros, árbol y buffs—. Un solo total obligaría al jugador a restar para saber cuánto
     * es suyo, y esa es justo la pregunta que hace alguien que está pensando en
     * reemplazarlo.
     *
     * Y `filas` lleva cada incremento con su grupo, porque la lista tiene que enseñar la
     * misma división: primero lo del item, después lo de la partida, y no mezclados.
     */
    getClickDamageParts: () => danosDeClick(),
    /**
     * EL STAT PRINCIPAL DE UN ITEM, YA SUMADO. Lo que la ficha del almacén enseña en
     * grande: base, potencial y mejora, juntos.
     *
     * ## POR QUÉ ESTO ESTÁ AQUÍ Y NO EN LA VISTA
     *
     * Porque hay una cifra que el juego cobra y otra que se enseña, y solo puede ser
     * una. El daño que se lleva el item es `danioDeRango(tier, potencial)` —la base con
     * el potencial ya aplicado— y lo que la ficha llamaba "daño" era ese número **sin
     * las mejoras de nivel**: el jugador subía con cristales, el número grande no se
     * movía, y el daño de verdad aparecía después, en otro sitio. Dos cifras para la
     * misma cosa, y la que manda no era la que se veía.
     *
     * Aquí se suman con **las mismas funciones con las que el motor calcula el daño**:
     * `multiplicadorDeNivel()`, que es la misma que multiplica el ingreso del compañero,
     * y `poderEfectivoDeCompanio()`, que es la del compañero. Si mañana cambia el 0,10,
     * cambia en los tres sitios a la vez porque los tres llaman.
     *
     * **LO QUE NO ENTRA, Y POR QUÉ NO ENTRA.** Ni los buffs, ni los logros, ni el
     * multiplicador del árbol, ni los afijos, ni los compañeros activos: eso son
     * bonificaciones *de la partida*, no del objeto. Un recolector con tres cartas de
     * clic x2 teachla 24, pero ese 24 no es suyo: es suyo la mitad, y si la ficha lo
     * dijera, cambiar de carta cambiaría el stat del item y no habría forma de comparar
     * dos recolectores. Lo que sí entra es **lo que el item es y lo que se le ha subido
     * con cristales**, que es lo único que hace que un item valga más que otro.
     *
     * `etiqueta` dice **qué es** el número, y no es decorativo: el compañero tiene tres
     * tipos con reglas distintas y sin la etiqueta el 35 del `multiplier` se lee igual
     * que el 35 del `passive`, cuando uno multiplica y el otro produce.
     *
     * `prefijo` y `sufijo` los pone el motor y no la vista, porque **no todas las cifras son
     * de la misma clase**: el multiplicador lleva "×" delante y nada detrás, el compañero
     * lleva "/s" y el recolector nada, porque cobra por clic y no por segundo. Poner el
     * "/s" en la vista lo habría puesto también en el recolector, que es una falsedad
     * —la primera versión de la esquina de la celda lo hizo y cualquier T5 salió con
     * "84/s"— y hace que dos cifras de grandezas distintas parezcan comparables.
     *
     * Y **la unidad va dentro de la etiqueta y no detrás**, para lo que sí la tiene:
     * "Producción en pasivo" + "/s" se lee "Producción en pasivo/s", que no significa
     * nada. El "/s" es de la cifra y la etiqueta es una frase.
     *
     * `desglose` son **los términos de la suma**, en el orden en que se aplican, y es lo
     * que enseña el hover del número grande. Sale de aquí y no de la vista porque los
     * términos **son las reglas**: si la vista los escribiera, habría una segunda copia
     * de la cuenta —base, potencial, nivel— que se separa de la primera el día que
     * cambie el 0,20 o el 0,10, y el jugador vería un hover que no cuadra con el número
     * que tiene encima.
     *
     * Y es la respuesta a una pregunta que el número grande despierta solo: "de dónde
     * sale esto". Un "+13" sin explicación obliga a abrir la caja de la forja para
     * descubrirlo, y la caja no lo dice.
     */
    /**
     * LAS FILAS ADITIVAS DE UN ITEM, Y POR QUÉ COEXISTEN CON `desglose`.
     *
     * `desglose` —lo que devuelve esto mismo hoy— es una lista de **multiplicadores**:
     * "Base T3 23,3 · Potencial ×1,20 · Nivel ×1,24 · Total 39". `filas` es la misma
     * cuenta pero **en sumas**: "Base del item 23 · Potencial 1★ +5 · Nivel 4 +11".
     *
     * ## POR QUÉ NO SUSTITUYE AL OTRO
     *
     * Porque el panel de la base **ya usa la forma de sumas** —la de `danosDeClick()`— y
     * el hover del almacén usaba la de multiplicadores. Dos estilos para la misma cuenta
     * en dos sitios de la misma pantalla: el hover salía con cuatro filas de factor y la
     * base con cuatro de incremento, y el jugador tenía que hacer dos cuentas
     * diferentes para el mismo número. Con `filas`, **el hover pinta exactamente las
     * mismas filas que la card de la base** y no hay dos Criminal: es la misma función
     * con el mismo reparto desde el total hacia atrás, sin redondeos intermedios.
     *
     * Y **SIN el grupo de la partida**, que es lo que el jugador pidió: aquí van solo lo
     * que es del objeto —potencial, nivel y afijos—, porque el número grande de al lado
     * es el del item y no el del click con las bonificaciones. Meter las de la partida
     * sería mostrar en el hover filas cuya suma no da el número que está al lado.
     *
     * La suma se lleva en coma flotante y lo que se pinta es el suelo, igual que en
     * `danosDeClick()`: el daño que se cobra también lo es, y redondear por pasos haría
     * que la última fila no cuadrara con el número grande.
     */
    getStatFilas: (itemId: string): { base: number; total: number; filas: Array<{ nombre: string; detalle: string; suma: number }> } => {
      const w: any = (state.warehouse as any[]).find((x: any) => x.id === itemId);
      const vacio = { base: 0, total: 0, filas: [] as any[] };
      if (!w) return vacio;
      const nivel = Math.max(0, Math.floor(Number(w.level) || 0));
      const pot = potencialNormalizado(w.potential);
      const multPot = 1 + 0.2 * pot;

      const esRecolector = w.type === 'collector';
      // **LA BASE DEL RECOLECTOR ES EL DAÑO GUARDADO PARTIDO POR EL POTENCIAL.** Es el
      // mismo razonamiento que `danosDeClick()`: el campo `damage` ya lleva el potencial
      // aplicado, así que para que "base + potencial = daño guardado" hay que deshacerlo.
      // En el compañero la base es el poder, que no lleva nada aplicado encima.
      const base = esRecolector
        ? Math.max(DANIO_MINIMO_SIN_RECOLECTOR, Number(w.damage) || 0) / multPot
        : Number(w.power) || 0;

      const filas: Array<{ nombre: string; detalle: string; suma: number }> = [];
      let acum = base;
      let mostrado = Math.floor(acum);
      const anota = (nombre: string, detalle: string, mult: number) => {
        if (Math.abs(mult - 1) <= 0.0001) return;
        acum *= mult;
        const ahora = Math.floor(acum);
        // Un bono que no mueve el suelo no se pinta: una fila con un +0 es ruido.
        if (ahora === mostrado) return;
        filas.push({ nombre, detalle, suma: ahora - mostrado });
        mostrado = ahora;
      };

      anota(`Potencial ${pot}★`, `${Math.round((multPot - 1) * 100)}% más`, multPot);
      if (nivel > 0) anota(`Nivel ${nivel}`, esRecolector ? 'del recolector' : 'del compañero', multiplicadorDeNivel(nivel));
      // **LOS AFIJOS NO ESTAN, Y SU AUSENCIA ES LA RAZON DE QUE ESTA LISTA CUADRE.**
      //
      // La primera version metia una fila de afijos, y la cuenta se rompia de la forma
      // mas visible que hay: 23 de base, +14 de potencial, +44 de nivel y +15 de afijos,
      // con un total arriba que decia 81. 23+14+44+15 son **96**. Las filas estan para
      // explicar el numero de al lado, asi que una fila que no esta en ese numero es una
      // mentira con forma de tabla.
      //
      // Y no es que los afijos no cuenten: es que **`getStatPrincipal()` no los
      // incluye, a proposito**. Su total es 'lo que da este objeto por si mismo', y el
      // afijo solo cuenta mientras el objeto esta equipado: si la ficha lo metiera,
      // cambiar de arma cambiaria el stat del item y no habria forma de comparar dos
      // recolectores en el almacen. Los afijos salen en el desglose del **dano del clic**
      // --`getClickDamageParts()`--, que si es el dano real con todo puesto. Son dos
      // preguntas distintas y por eso son dos listas.
      //
      // La regla que queda, y que un banco comprueba: **las filas suman el total**.

      return { base: Math.floor(base), total: Math.floor(acum), filas };
    },
    getStatPrincipal: (itemId: string) => {
      const w: any = (state.warehouse as any[]).find((x: any) => x.id === itemId);
      if (!w) return null;
      if (w.type === 'collector') {
        const base = Math.max(DANIO_MINIMO_SIN_RECOLECTOR, Number(w.damage) || 0);
        const nivel = Math.max(0, Math.floor(Number(w.level) || 0));
        const pot = potencialNormalizado(w.potential);
        return {
          tipo: 'collector' as const,
          valor: Math.round(base * multiplicadorDeNivel(nivel)),
          etiqueta: 'Recolección por click',
          // **EL "+" PORQUE ES LO QUE APORTA, Y NO UNA CIFRA SUELTA.** Un 174 a secas en
          // una esquina de celda se lee como un identificador, como un número de serie o
          // como el precio de algo. "+174" dice que eso es lo que suma, que es la
          // pregunta que uno se hace al mirar un recolector en el almacén.
          prefijo: '+',
          // **SIN UNIDAD, PORQUE NO LA TIENE.** El recolector cobra **por clic** y el
          // compañero **por segundo**: son dos grandezas distintas, y una "/s" detrás
          // del daño del recolector haría comparables dos números que no lo son. La
          // primera versión de la esquina de la celda la puso igual para los dos y
          // cualquier T5 salió con "84/s", que es mentira en la propia etiqueta.
          sufijo: '',
          desglose: desgloseDeStat(w.tier, base, pot, nivel, Math.round(base * multiplicadorDeNivel(nivel)))
        };
      }
      if (w.type === 'companion') {
        const comp: any = (state.companions as any[]).find((c: any) => c.id === w.id);
        const tipo = comp?.type ?? w.companionType ?? 'click';
        const power = Number(comp?.power ?? w.power) || 0;
        const nivel = Math.max(0, Math.floor(Number(w.level) || 0));
        const esMult = tipo === 'multiplier';
        const valor = esMult
          // El multiplicador **no lleva nivel**: multiplicar el ingreso el doble y
          // además por un 1,3 sería una regla nueva que nadie pidió. Sale de aquí y no
          // de la vista porque es el mismo `power` que usa el reparto del ingreso.
          ? Math.round((1 + power) * 100) / 100
          : poderEfectivoDeCompanio({ power, level: nivel });
        return {
          tipo: 'companion' as const,
          subtipo: tipo,
          valor,
          // **LA ETIQUETA LLEVA LA UNIDAD DENTRO Y NO DETRÁS CON UNA "/S".** Se probó
          // "Produce en pasivo" + "/s" y se lee "Produce en pasivo/s", que no significa
          // nada: el "/s" pertenece a la cifra y la etiqueta es una frase. Que la frase
          // diga ya "por segundo" evita el sufijo, y de paso cada etiqueta es
          // autosuficiente si algún día se enseña sin el número al lado.
          etiqueta: esMult ? 'Multiplica el ingreso'
            : tipo === 'passive' ? 'Producción por segundo'
              : 'Ingreso por segundo',
          // El multiplicador lleva "×" delante y no "+": no suma nada, cambia por
          // cuántas veces se cuenta lo de los demás. Ponerle un "+" sería la misma
          // falsedad al revés.
          prefijo: esMult ? '×' : '+',
          sufijo: esMult ? '' : '/s',
          // El multiplicador **no lleva desglose porque no hay suma que desglosar**: sale
          // entero de su `power`. Una lista de un solo término para explicar de dónde
          // sale 1,75 es relleno, y el hover vacío se lee como que falta el dato.
          desglose: esMult ? [] : desgloseDeStat(w.tier, power, potencialNormalizado(w.potential), nivel, valor)
        };
      }
      return null;
    },
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
        // **EL TOTAL TAMBIÉN SE BORRA, Y PORQUE ES LO QUE USA LA BARRA.** Cancelado el
        // buff, la tarjeta se esconde y el total no se ve... hasta que el buff vuelva, y
        // entonces la barra arrancaría con el ancho de un buff que ya no existe.
        state.afkTotalMs = 0;
      } else {
        const field = BUFF_FIELDS[buffKey];
        if (state.buffs[field] <= Date.now()) return false;
        state.buffs[field] = 0;
        state.buffs[BUFF_TOTAL_FIELDS[buffKey]] = 0;
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
      syncCrateCounters();
      refreshAfkCardCount();
      rebuildAchievementBonuses();
      recalculatePassiveIncome();
      checkAchievements();
      onUpdate(state, isAfk);
      saveToFirebase();
    },


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

      if (item.type === 'companion') {
        state.companions = state.companions.filter((c: any) => c.id !== item.id);
        state.activeCompanions = state.activeCompanions.filter((id) => id !== item.id);
      }

      syncCrateCounters();
      refreshAfkCardCount();
      syncCompanionsToWarehouse();
      recalculatePassiveIncome();
      checkAchievements();
      onUpdate(state, isAfk);
      saveToFirebase();
      return { ok: true, gained: ganado, sold: vender };
    },

    /**
     * LO QUE SE PUEDE VENDER DE UNA SELECCIÓN, SIN VENDER NADA.
     *
     * Lo pinta la barra de la selección múltiple y lo usa de paso `sellMany()`, que
     * es la razón de que sea una función aparte: **el botón y el cobro tienen que salir
     * del mismo sitio**. Si la barra sumara precios por su cuenta, bastaría un redondeo
     * distinto para que el botón anunciara una cifra y el cobro otra.
     *
     * Devuelve también **qué queda fuera y por qué**, porque una selección puede
     * contener algo que no se puede vender —el último recolector, un equipado— y sin
     * el motivo el jugador ve que su selección no se vende entera y no sabe cuál es el
     // problema. Ver `planDeVenta()`.
     */
    planSellMany: (itemIds: string[]) => planDeVenta(Array.isArray(itemIds) ? itemIds : []),
    /**
     * APILAR, Y POR QUE HACE FALTA UN BOTON.
     *
     * Las pilas se funden solas en dos caminos: al **cargar** la partida --`partirPilas()`
     * se llama en la migracion-- y al **anadir** un item, porque `addToWarehouse()` suma
     * a la pila que ya existe. Lo que no tiene camino es el item que llega por la puerta
     * de atras: una compra del mercado, un Companion movido de sitio, una partida vieja.
     * Esos se quedan sueltos hasta la recarga, y el jugador ve ocho celdas de Piedra de
     * Calibracion con un 3 en cada una y un almacen que dice que esta lleno.
     *
     * Un boton que lo arregla a voluntad es mejor que una segunda pasada de fusion en cada
     * escritura: la fusion en cada escritura meteria celdas y moveria ids en cosas donde
     * nadie lo ha pedido, y un item que aparece fundido con otro que el jugador queria
     * tener en su sitio es un item que ha cambiado de sitio sin avisar.
     */
    planApilar: () => {
      const antes = state.warehouse.length;
      const { items } = partirPilas(state.warehouse);
      return {
        liberadas: Math.max(0, antes - items.length),
        grupos: gruposQueSeFunden(state.warehouse, items)
      };
    },

    /**
     * Apila de verdad. **Un guardado, un aviso y un repintado**: son tres las cosas que
     * tienen que ocurrir juntas y separarlas es como se pierde una.
     */
    apilar: () => {
      handleUserActivity();
      const antes = state.warehouse.length;
      // **LOS HUECOS SE APUNTAN ANTES, Y SE RECONECTAN DESPUES.** Un hueco esta anclado
      // al id de un item, y la fusion conserva el id del PRIMERO de cada grupo: el hueco
      // que estaba detrás del que desaparece se queda apuntando al aire. Sin esta
      // reconexion el jugador ve su hueco moverse de sitio solo, que es peor que no
      // apilar. Ver `reconectaHuecos()`.
      const anclajes = anclajesDeHuecos(state.warehouseGaps, state.warehouse);
      const { items, changed } = partirPilas(state.warehouse);
      if (!changed) return { ok: false, liberadas: 0, msg: 'Ya esta todo apilado.' };
      state.warehouse = items;
      state.warehouseGaps = reconectaHuecos(state.warehouseGaps, anclajes, items);
      const liberadas = Math.max(0, antes - items.length);
      onUpdate(state, isAfk);
      saveToFirebase();
      return {
        ok: true,
        liberadas,
        msg: liberadas > 0
          ? `${liberadas} celda${liberadas === 1 ? '' : 's'} libre${liberadas === 1 ? '' : 's'}.`
          : 'Todo apilado.'
      };
    },


    /**
     * EL FILTRO DE AUTO-VENTA AL ABRIR CAJAS, Y POR QUÉ SE LEE Y SE ESCRIBE POR AQUÍ.
     *
     * La vista pinta casillas y el motor decide. Un filtro de venta escrito en la hoja de
     * la caja sería la vista cambiando el estado (R1), y además no alcanzaría a las
     * **aperturas en lote**, que son veinte sorteos seguidos sin pasar por un solo clic.
     *
     * Y lo que devuelve el lector está **coaccionado**, no guardado tal cual: es lo que
     * la ruleta y el diálogo enseñan, y tiene que ser la misma forma que decide la venta.
     * Si la vista recibiera el objeto crudo del guardado, podría estar enseñando un
     * filtro que el motor no va a usar —un `"sí"` en `activa`, un tipo desconocido— y
     * esa es la clase de discrepancia que R3 prohíbe.
     */
    getAutoVenta: (): ConfigAutoVenta => coaccionaAutoVenta(state.autoVenta),

    /**
     * Cambia el filtro. `{ tipos }` se **fusiona** campo a campo, no se sustituye: quien
     * enciende el conmutador maestro no quiere desmarcar los tres tipos, y quien marca
     * "solo armas" no quiere perder el tope de tier que ya había puesto.
     *
     * Y **cada cambio se guarda**, aunque el filtro no affecte a nada todavía. Encenderlo
     * es una decisión que se quiere conservar; perderla al recargar convertiría cada
     * sesión en volver a explicar el mismo filtro, que es la forma más lenta de perder la
     * costumbre de usarlo.
     */
    setAutoVenta: (parcial: Partial<ConfigAutoVenta>) => {
      handleUserActivity();
      const actual = coaccionaAutoVenta(state.autoVenta);
      const tipos: Partial<Record<TipoDeVentaAuto, boolean>> = (parcial && parcial.tipos) || {};
      state.autoVenta = coaccionaAutoVenta({
        activa: parcial?.activa ?? actual.activa,
        tipos: {
          collector: tipos.collector ?? actual.tipos.collector,
          companion: tipos.companion ?? actual.tipos.companion,
          consumable: tipos.consumable ?? actual.tipos.consumable
        },
        tierMax: parcial?.tierMax ?? actual.tierMax,
        potencialMax: parcial?.potencialMax ?? actual.potencialMax
      });
      saveToFirebase();
      return state.autoVenta;
    },

    /**
     * Vende una selección entera de una vez, con **un solo guardado**.
     *
     * Y aquí está la razón de que sea un método y no un bucle de `sellItem()` desde la
     * vista: `sellItem()` escribe en Firestore, refresca el ingreso pasivo, comprueba
     * logros y avisa a la pantalla **una vez por item**. Vender veinte celdas por el
     * bucle eran veinte escrituras y veinte comprobaciones de logros para una acción que
     * el jugador hizo una vez, y con veinte `onUpdate()` la barra de progreso se
     * ralentiza sola justo cuando el jugador está haciendo la tarea más repetitiva del
     * juego.
     *
     * **LO QUE NO ES UN BORRADO EN BLANCO.** Se vende exactamente lo que el plan
     * aprueba y se devuelve el resto con su motivo, así que una selección con el último
     * recolector dentro **vende los demás y dice cuál se quedó**. La alternativa —
     * rechazarlo todo en bloque — es peor: el jugador que ha marcado veinte celdas ve
     * que no pasa nada y no sabe por qué, y un fallo de una sola celda le bloquea la
     * venta de las otras diecinueve.
     */
    sellMany: (itemIds: string[]) => {
      handleUserActivity();
      const plan = planDeVenta(Array.isArray(itemIds) ? itemIds : []);
      if (plan.vendibles.length === 0) {
        return {
          ok: false,
          msg: plan.bloqueados.length > 0
            ? `No se puede vender nada: ${plan.bloqueados[0].motivo}.`
            : 'No hay nada seleccionado para vender.',
          gained: 0,
          sold: 0,
          bloqueados: plan.bloqueados
        };
      }

      // El dinero se suma **una vez**, con la suma del plan, y no item a item. Es la
      // diferencia entre 20 redondeos y uno: con veinte items, sumar y redondear veinte
      // veces puede dejar una nanita de diferencia con lo que el botón enseñó.
      const ganado = plan.total;
      state.nanites += ganado;

      for (const v of plan.vendibles) {
        const item: any = (state.warehouse as any[]).find((w: any) => w.id === v.id);
        if (!item) continue;
        consumeWarehouseItem(item.id, v.units);
        if (item.type === 'companion') {
          state.companions = state.companions.filter((c: any) => c.id !== item.id);
          state.activeCompanions = state.activeCompanions.filter((id) => id !== item.id);
        }
      }
      syncCrateCounters();
      refreshAfkCardCount();
      syncCompanionsToWarehouse();
      recalculatePassiveIncome();
      checkAchievements();
      onUpdate(state, isAfk);
      saveToFirebase();
      return {
        ok: true,
        gained: ganado,
        sold: plan.vendibles.length,
        bloqueados: plan.bloqueados
      };
    },

/**
     * CUÁNTOS CONSUMIBLES SE PUEDEN USAR DE UNA VEZ, Y CUÁNTOS.
     *
     * El consumible se usaba de a uno, y con veinte tarjetas AFK en la pila eso son
     * veinte confirmaciones para un efecto que el propio juego limita a tres. El botón
     * dice el tope y el motor lo es, así que **la pregunta y el cobro no pueden ser dos
     * cálculos**: por eso los dos salen de `cuantasVecesCabe()`.
     *
     * **Y EL TOPE DEL EXPANSOR NO ESTÁ AQUÍ SINO EN LA TABLA**, porque es el almacén y no un
     * tiempo: el expansor T{n} vale hasta `maxCap` y el de una partida vieja hasta
     * `WAREHOUSE_MAX_CAP`. La cuenta es un `ceil` porque el expansor **recorta** en vez de
     * rechazar --con 18 de capacidad y un T1 que vale hasta 20, un uso deja 20 y el
     * siguiente ya no cabe-- y por eso "cuántos usos caben" es "cuántas tarjetas hacen
     * falta para llegar al tope", no "cuántas caben enteras". Un `floor` diría 0 y el
     * expansor que el motor acepta parecería no caber.
     *
     * `motivo` es `null` cuando no cabe ni una, y es lo que la vista enseña: sin él el
     * jugador ve un botón apagado sin saber si es que no tiene, que ya está al tope o que
     * ese consumible no se usa desde el almacén.
     */
    planUseConsumable: (itemId: string): { unidades: number; max: number; motivo: string | null } => {
      const item: any = state.warehouse.find((w: any) => w.id === itemId);
      if (!item) return { unidades: 0, max: 0, motivo: 'Ese item ya no está en el almacén.' };
      if (item.type !== 'consumable') return { unidades: 0, max: 0, motivo: 'Esto no se puede usar.' };
      const buffId = item.buffId ?? inferBuffIdFromName(item.name || '');
      if (!buffId) return { unidades: 0, max: 0, motivo: 'Este consumible no tiene efecto conocido.' };
      if (buffId === 'calibrationStone' || buffId === 'stabilityNano') {
        return { unidades: 0, max: 0, motivo: 'Este consumible se usa en la Forja.' };
      }
      const unidades = item.stackable ? (item.stackCount || 1) : 1;
      const ahora = Date.now();
      const afkMs = afkCardDurationMs();

      // **EL EXPANSOR, POR SU VEZ, Y CON SU MISMA TABLA.**
      if (buffId === 'warehouseExpander' || buffId.startsWith('expansorT')) {
        const tipo = buffId === 'warehouseExpander' ? null : expansorPorBuff(buffId);
        if (buffId !== 'warehouseExpander' && !tipo) {
          return {
            unidades: 0,
            max: 0,
            motivo: `No hay expansor ${buffId}: la escalera de expansores y la del almacén se han separado.`
          };
        }
        const tope = tipo ? tipo.maxCap : WAREHOUSE_MAX_CAP;
        const paso = tipo ? tipo.slots : 1;
        const max = state.warehouseCapacity >= tope
          ? 0
          : Math.max(0, Math.min(unidades, Math.ceil((tope - state.warehouseCapacity) / paso)));
        return {
          unidades: max,
          max,
          // El texto sale del helper que usa tambien el `case`: el boton apagado y el
          // motor negandose tienen que decir la misma frase.
          motivo: max > 0 ? null : motivoDeExpansorAlTope(tipo, state.warehouseCapacity),
        };
      }

      // **Y LAS TARJETAS, POR TIEMPO, CON LA MISMA FUNCION QUE APLICA EL CASO.**
      const pasoMs = pasoDeConsumible(buffId, afkMs);
      const expiraEn = buffId === 'afk'
        ? state.afkExpiresAt
        : (state.buffs as any)[`${buffId}ExpiresAt`];
      const max = cuantasVecesCabe({
        buffId, ahora, pasoMs, expiraEn, unidades, afkMs
      });
      return {
        unidades: max,
        max,
        motivo: max > 0
          ? null
          : `El efecto de ${item.name} ya está al tope. No se puede usar más.`
      };
    },

    /**
     * Consume un consumible del almacén y aplica su efecto.
     *
     * El efecto se calcula con la MISMA función que la vista usaba antes, pero
     * aquí se aplica al estado y después se consume el item. El orden importa:
     * primero se resuelve el buff, y solo si se ha aplicado bien se gasta.
     */
    useConsumable: (itemId: string, units = 1): { ok: boolean; msg?: string; usadas?: number } => {
      handleUserActivity();
      const item: any = state.warehouse.find((w: any) => w.id === itemId);
      if (!item) return { ok: false, msg: 'Ese item ya no está en el almacén.' };
      if (item.type !== 'consumable') return { ok: false, msg: 'Esto no se puede usar.' };

      // Las partidas viejas no tienen el campo `buffId`: se deduce del nombre.
      const buffId = item.buffId ?? inferBuffIdFromName(item.name || '');
      if (!buffId) return { ok: false, msg: 'Este consumible no tiene efecto conocido.' };

      // **EL PLAN SE CONSULTA ANTES DE APLICAR NADA, Y POR DOS MOTIVOS.**
      //
      //  El primero es un error que estuvo a punto de ser real: si se preguntara
      //  después del `switch`, el expansor ya habría subido la capacidad, el plan
      //  vería su propio efecto —`20 >= 20`— y el motor se rechazaría a sí mismo
      //  después de haber aplicado la unidad. Con el tope del expansor, eso tiraba
      //  el item sin gastarlo y con la capacidad ya subida.
      //
      //  El segundo es el que manda: es **la misma pregunta que hace el botón**, así
      //  que el máximo del diálogo y el tope del cobro no pueden separarse. Por eso
      //  sale de `planUseConsumable()` y no de una cuenta aquí.
      const pedidas = Math.max(1, Math.floor(Number(units) || 1));
      const plan: { unidades: number; max: number; motivo: string | null } =
        estado.planUseConsumable(itemId);
      // **LO QUE SE GASTA ES LO QUE PIDIÓ EL JUGADOR, RECORTADO CONTRA EL TOPE, Y SI
      // SE RECORTA SE DICE CUÁNTAS.** Gastar un consumible que no hace falta es tirar
      //  el recurso del jugador, y la alternativa —gastarlo y que el `Math.min` del
      //  efecto lo ignore— es el bug de la píldora de AFK otra vez, en un sitio donde
      //  el jugador ya ha confirmado un número.
      const aUsar = Math.max(0, Math.min(pedidas, plan.unidades));
      if (aUsar === 0) {
        return { ok: false, usadas: 0, msg: plan.motivo ?? 'Ese consumible ya no hace nada.' };
      }

      const ahora = Date.now();
      const afkMs = afkCardDurationMs();
      let nuevoItem = true;

      // **UNA UNIDAD, UN EFECTO, Y EL EFECTO SE REPITE LAS VECES QUE DICHA EL PLAN.**
      //  El `switch` es el de antes, sin tocar una coma: lo único nuevo es que vive
      //  dentro de una función y se llama en bucle. Así gastar tres tarjetas de click
      //  da noventa minutos en vez de dar treinta y cobrarse tres.
      const aplicarUna = (): { ok: boolean; msg?: string } => {
        switch (buffId) {
          // Los expansores son diez `case`, uno por tier. Se podrían cubrir con un
          // `default` que preguntara a la tabla, pero entonces un `buffId` mal
          // escrito daría el mensaje de "no sé qué hace" y un expansor nuevo
          // nacía muerto sin que nadie lo notara: **con diez casos escritos, el
          // banco `consumableCheck` ve que los diez buffIds de la tabla tienen su
          // caso**, y un undécimo expansor obliga a tocar este sitio a propósito.
          case 'expansorT1': case 'expansorT2': case 'expansorT3': case 'expansorT4': case 'expansorT5':
          case 'expansorT6': case 'expansorT7': case 'expansorT8': case 'expansorT9': case 'expansorT10': {
            // El tipo sale de la tabla, y con un `case` por buffId no puede ser
            // `undefined` salvo que alguien añada un expansor sin tocar aquí: en ese
            // caso el mensaje lo dice en vez de dar un error de `undefined`.
            const tipo = expansorPorBuff(buffId);
            if (!tipo) {
              return { ok: false, msg: `No hay expansor ${buffId}: la escalera de expansores y la del almacén se han separado.` };
            }
            // **EL TECHO ES LO QUE DECIDE SI SIRVE.** El expansor T{n} vale hasta
            // `techoDeExpansor(n)`; a partir de ahí no se usa y hay que buscar uno
            // de un tier superior. El mensaje dice el número y el nombre del
            // siguiente, para que el rechazo conteste "¿y qué hago?" en vez de
            // dejar al jugador adivinando.
          if (state.warehouseCapacity >= tipo.maxCap) {
            return {
              ok: false,
              msg: motivoDeExpansorAlTope(tipo, state.warehouseCapacity),
            };
          }
            state.warehouseCapacity = Math.min(WAREHOUSE_MAX_CAP, state.warehouseCapacity + tipo.slots);
            break;
          }
          case 'warehouseExpander':
            // Stock de antes de los tipos (+1): sigue sirviendo con el tope
            // nuevo. No es un cuarto tipo —no se vende ni sale de cajas— y por
            // eso no está en la tabla.
            //
            // Y SIGUE SIENDO EL ÚNICO QUE LLEGA MÁS ALLÁ DE LA ESCALERA DE
            // EXPANSORES. Si no existiera, un almacén de 115 se quedaría clavado
            // para siempre; y bajarlo a 115 haría que `enforceWarehouseCapacity()`
            // le borrara items a quien ya pasó de ahí.
            if (state.warehouseCapacity >= WAREHOUSE_MAX_CAP) {
              return { ok: false, msg: `Almacén al máximo (${WAREHOUSE_MAX_CAP}).` };
            }
            state.warehouseCapacity = Math.min(WAREHOUSE_MAX_CAP, state.warehouseCapacity + 1);
            break;
          case 'afk': {
            // Tope 3 tarjetas: más allá el AFK es infinita y rompe el ritmo
            const base = Math.max(ahora, state.afkExpiresAt || 0);
            state.afkExpiresAt = Math.min(base + afkMs, ahora + afkMs * 3);
            break;
          }
          case 'clickBoost': {
            const base = Math.max(ahora, state.buffs.clickBoostExpiresAt);
            state.buffs.clickBoostExpiresAt = Math.min(base + 30 * 60_000, ahora + 30 * 60_000);
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
      return { ok: true };
      };

      // **Y SI UNA DE LAS VARIAS SE RECHAZA A MITAD, SE DICE CUANTAS SE APLICARON.** No
      //  deberia pasar --el plan acaba de comprobar el tope-- pero, si pasara, devolver
      //  `ok: false` sin mas dejaria un efecto aplicado y nada gastado, que es peor que
      //  cualquier discrepancia: el jugador tiene que saber que se ha quedado sin pagar.
      let aplicadas = 0;
      for (let i = 0; i < aUsar; i++) {
        const r = aplicarUna();
        if (!r.ok) {
          return aplicadas === 0
            ? { ok: false, usadas: 0, msg: r.msg }
            : { ok: false, usadas: aplicadas, msg: r.msg };
        }
        aplicadas++;
      }

      // **LO QUE SE CONCEDE SE ANOTA, Y DESPUÉS DEL BUCLE, NO DENTRO.** Es el
      // denominador de la barra del HUD, y con el bucle aplicado tres veces solo
      // importa el último: lo que quedó puesto en total. Anotarlo en cada paso
      // sería lo mismo, porque cada paso parte del anterior, pero anotarlo aquí
      // hace claro que es "lo que hay ahora", no "lo que se ha usado".
      anotaTotalDeBuff(state, buffId, ahora);

      consumeWarehouseItem(item.id, aplicadas);

      refreshAfkCardCount();
      recalculatePassiveIncome();
      checkAchievements();
      onUpdate(state, isAfk);
      saveToFirebase();
      return {
        ok: true,
        usadas: aUsar,
        // **EL MENSAJE DICE CUÁNTAS, PORQUE EL JUGADOR PIDIÓ UN NÚMERO.** Con
        // veinte tarjetas en la pila, "aplicado" no dice si se gastaron tres o veinte.
        msg: aUsar === 1
          ? `${item.name}: aplicado`
          : `${item.name}: ${aUsar} aplicados`
      };
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
/**
     * Sube el nivel de un compañero con el cristal de SU tier.
     *
     * **ES LA MISMA REGLA QUE EL RECOLECTOR, EN TODAS LAS PARTES QUE IMPORTAN.** El
     * cristal lo decide el tier del compañero y no llega como argumento —F26, igual
     * que en el recolector—, el coste sale de la misma curva, la probabilidad sale de
     * `crystalSuccessChance()`, y **fallar no retrocede el nivel**: se pierde el
     * cristal, que es el coste que se eligió arriesgar. Un retroceso con coste
     * creciente es una escalera sin retorno.
     *
     * **LO ÚNICO QUE NO SE COPIA ES LA FIRMA:** el recolector sube el *equipado*
     * porque solo hay uno; el compañero lo elige el jugador, así que el id llega.
     */
    upgradeCompanion: (compId: string) => {
      handleUserActivity();

      const comp = (state.companions as any[]).find((c: any) => c.id === compId);
      if (!comp) return { success: false, rolled: false, msg: 'Compañero no encontrado.' };
      const ficha = (state.warehouse as any[]).find((w: any) => w.id === compId);
      // La ficha es la que pinta las estrellas y la que se vende. Si solo se
      // escribiera el array, el almacén y el panel dirían cosas distintas del mismo
      // objeto, que es el bug que ya se corrigió una vez con el potencial.
      if (!ficha) return { success: false, rolled: false, msg: 'La ficha del compañero no está en el almacén.' };

      const level = Math.max(0, Math.floor(Number(comp.level) || 0));
      const tierItem = Math.max(1, Math.floor(Number(comp.tier) || 1));
      const crystalTier = tierItem;
      // **EL TECHO DE `MAX_CRYSTAL_TIER` SE HA IDO AQUÍ IGUAL QUE EN EL
      // RECOLECTOR, Y POR EL MISMO MOTIVO:** la forja es infinita, así que produce
      // compañeros por encima del T10, y antes **esos no se podían subir de nivel**. El
      // motivo del techo era que no había cristal T11; sin niveles de cristal no hay
      // ese motivo, y un techo cuya razón ha desaparecido es un tope que solo cuesta
      // progreso.
      //
      // Lo que sí se queda es el techo de niveles del compañero, que es otra cosa y
      // lo de más abajo.
      // **EL TECHO LO PONE LA MISMA FUNCIÓN QUE LO APLICA**, con la ficha como
      // fuente. Si la ficha dijera 25 y el motor aceptara 20, el jugador vería una
      // barra que llega a 25 y gastaría cristales en algo que no pasa.
      const tope = nivelMaximoDeCompanio(comp.potential, (ficha as any).maxLevel);
      if (level >= tope) {
        return { success: false, rolled: false, msg: `${comp.name} está al nivel máximo (+${Math.round(tope * 10)}%).` };
      }

      // **EL COSTE ES LA MISMA FUNCIÓN QUE EL DEL RECOLECTOR, CON SU TIER PUESTO.**
      // `costeDeNivelDeCompanio` es un alias de `costeDeNivel`, no una curva propia, y
      // ya no tiene sentido ni tener dos: hay un recurso y una curva.
      const crystalCost = costeDeNivelDeCompanio(tierItem, level);
      const units = state.crystals;
      if (units < crystalCost) {
        return {
          success: false,
          rolled: false,
          msg: `Necesitas ${crystalCost} de ${CRISTAL_NOMBRE} (tienes ${units}).`
        };
      }

      state.crystals -= crystalCost;

      // Y la probabilidad es la misma función por el mismo motivo.
      const successChance = chanceDeSintonizacion(level);
      const roll = Math.random() * 100;

      if (roll <= successChance) {
        const nuevo = level + 1;
        // **LAS DOS MITADES, JUNTAS.** El array paga el ingreso y la ficha lo pinta;
        // escribir una sola deja la partida con dos verdades sobre el mismo objeto.
        state.companions = (state.companions as any[]).map((c: any) =>
          c.id === compId ? { ...c, level: nuevo, maxLevel: tope } : c);
        state.warehouse = state.warehouse.map((w: any) =>
          w.id === compId ? { ...w, level: nuevo, maxLevel: tope } : w);
        recalculatePassiveIncome();
        checkAchievements();
        onUpdate(state, isAfk);
        saveToFirebase();
        return {
          success: true,
          rolled: true,
          level: nuevo,
          msg: `¡Mejora exitosa! ${comp.name} ascendió al nivel ${nuevo}.`
        };
      }

      // Fallo: **el nivel no retrocede**, y el cristal ya está gastado.
      onUpdate(state, isAfk);
      saveToFirebase();
      return {
        success: false,
        rolled: true,
        level,
        msg: `Fallo en el sintonizador. ${comp.name} se mantiene en nivel ${level}. (-${crystalCost} cristales)`
      };
    },
    /**
     * SUBE EL NIVEL DE UN RECOLECTOR, **EL QUE SEA**.
     *
     * ## POR QUÉ ACEPTA UN ID Y NO SOLO "EL EQUIPADO"
     *
     * Antes este método no tenía argumento y mejoraba `state.equippedCollectorId`, y la
     * ficha lo traducía en un botón apagado con "Equípala primero". O sea que **no se
     * podía mejorar un recolector que no estuviera en la mano**: veinte objetos en el
     * almacén, uno equipado, y los otros diecinueve con la mejora bloqueada por dónde
     * estaban colocados. El jugador tenía que equipar cada uno por turnos para subirlo,
     * y el crystal upgrade deja de ser una decisión y pasa a ser un turno de cola.
     *
     * Y no hay ninguna razón de juego detrás: **el nivel es del item, no de la partida**.
     * `getStatPrincipal()` lo lee del objeto, la valoración lo lee del objeto, y subir un
     * recolector que no está equipado no cambia nada más. La restricción era un
     * accidente de la firma del método.
     *
     * ## Y POR QUÉ EL ARGUMENTO ES OPCIONAL
     *
     * Porque media partida ya lo llama sin argumento —todos los bancos y el guardado— y
     * un argumento obligatorio obligaría a tocar veinte llamadas para cambiar una regla
     * que no les afecta. Sin argumento hace lo de siempre: el equipado.
     */
    upgradeCollector: (itemId?: string) => {
      handleUserActivity();
      const objetivo = itemId ?? state.equippedCollectorId;
      if (!objetivo) return { success: false, rolled: false, msg: 'No hay ningún recolector equipado.' };
      const item = state.warehouse.find((w: any) => w.id === objetivo);
      if (!item) return { success: false, rolled: false, msg: 'Recolector no encontrado.' };
      if (item.type !== 'collector') {
        return { success: false, rolled: false, msg: 'Eso no es un recolector.' };
      }
      const level = item.level || 0;

      // =====================================================================
      //  EL CRISTAL ES UN RECURSO, Y EL TIER DEL ITEM ES LO QUE PONE EL PRECIO
      // =====================================================================
      //
      // **LO QUE ESTA FUNCIÓN HACÍA ANTES, EN ORDEN, PARA QUE SE VEA LO QUE SE VA:**
      //
      //   1. Leía el tier del recolector y lo llamaba `crystalTier`, para obligar a que
      //      el cristal fuera del mismo nivel (F26).
      //   2. Rechazaba cualquier item por encima del T10, porque no había cristal T11.
      //   3. Buscaba en el almacén la pila de cristal de ese nivel y la consumía.
      //   4. Cobraba `collectorUpgradeCost(level)` —1, 2, 2, 3…— de esa pila.
      //   5. La probabilidad la multiplicaba el `power` del cristal elegido.
      //
      // **LO QUE HACE AHORA, Y ES MENOS CÓDIGO PORQUE HAY MENOS REGLAS:**
      //
      //   · El precio sale de `costeDeNivel(tierDelItem, level)`, y **el tier del item
      //     sigue siendo lo único que lee de él**, pero ya no para elegir el cristal
      //     sino para decidir cuánto cuesta. Un T10 cuesta mucho más que un T1, que
      //     es exactamente lo que pedía el cambio.
      // · El techo de `MAX_CRYSTAL_TIER` **desaparece**, y no es un descuido: es la
      //     mejor noticia de las dos. La forja es infinita y produce T11 y siguientes;
      //     antes esos items **no se podían subir de nivel**, y el juego respondía con un
      //     mensaje que no admitía arreglo. Ahora un T30 se sube con el mismo recurso
      //     que un T1, por mucho más caro. El techo dejó de ser un sitio donde la
      //     progresión se paraba.
      const tierItem = Math.max(1, Math.floor(Number((item as any).tier) || 1));
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

      // **LO QUE SE COBRA ES UN NÚMERO DE `state.crystals`, NO UN ITEM DEL ALMACÉN.**
      // No hay ni que buscar una pila ni que consumirla: el recurso no está en ninguna
      // parte, y por eso la operación no puede fallar por falta de hueco ni dejar un
      // item a medio gastar.
      const crystalCost = costeDeNivel(tierItem, level);
      const units = state.crystals;
      if (units < crystalCost) {
        return {
          success: false,
          rolled: false,
          msg: `Necesitas ${crystalCost} de ${CRISTAL_NOMBRE} (tienes ${units}).`
        };
      }

      state.crystals -= crystalCost;

      // **LA PROBABILIDAD LA PONE EL NIVEL, Y SOLO EL NIVEL.** Antes el `power` del
      // cristal la multiplicaba y venía a ser lo que el jugador elegía. Con un solo
      // recurso no hay de dónde sacar un factor, y la regla queda a la vista: en el
      // nivel 0 se acierta el 95 % y en el 20 el 35 %. El riesgo es real y sube con
      // cada subida, lo que pasa es que ya **no hay forma de comprar seguridad**.
      //
      // Es la consecuencia de "un recurso", y está escrita aquí para que el día que
      // alguien eche en falta la elección se lea por qué no la hay.
      const successChance = chanceDeSintonizacion(level);
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
    /**
     * Alias de `upgradeCollector()` sin argumento.
     *
     * Se conserva porque el guardado y veinte llamadas de bancos lo nombran así, y
     * porque el nombre dice lo que hace para quien lee un banco viejo. **No tiene lógica
     * propia**: mantener dos implementaciones de "subir el nivel del recolector" es
     * exactamente lo que dejó `toggleCompanionActive` y `equipCompanion` haciendo cosas
     * distintas.
     */
    upgradeEquippedCollector: () => estado.upgradeCollector(),
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
      if (!cabeLaCompra(itemKey as string, n)) {
        showToast('Almacén lleno. No puedes comprar más items.', 'error');
        return false;
      }

      state.nanites -= cost;

      // A partir de aquí la compra está cobrada. Si `addToWarehouse` dice que no
      // cabe, hay que DEVOLVER el dinero antes de salir: un "no compres" que
      // descuenta las nanitas es peor que un bug visible, porque el jugador
      // pierde el saldo sin ver por qué.
      if (itemKey === 'upgradeCrystal') {
        // **ESTA RAMA YA NO CREA NADA EN EL ALMACÉN, Y ESO LA HACE MÁS CORTA QUE
        // NINGUNA OTRA DEL FICHERO.** El cristal es un recurso: la compra suma
        // unidades a `state.crystals` y ya está. No hay item, ni ranura, ni fusión de
        // pilas, ni hueco que comprobar.
        //
        // **Y `previewStoreItem()` devuelve `null` para esta carta**, que es por lo que
        // la pregunta de espacio de más arriba no se ha tenido que tocar: sin item que
        // crear, no hay ranura que pueda faltar.
        //
        // **LO QUE ENTREGA CADA UNIDAD COMPRADA.** La carta cuesta 200 y entrega
        // `valorDeUnCristal(1)` unidades, o sea **un intento entero de subir de nivel
        // un item de T1**. Antes entregaba un cristal de T1, que también era un
        // intento. La tienda cuesta lo mismo y da lo mismo, en número de intentos:
        // el cambio no ha caro ni un intento de mejora al jugador que compraba, que es
        // lo que se comprobaba con 200 nanitas contra una caja de 675 que da 3-5
        // intentos.
        state.crystals += valorDeUnCristal(STORE_MATERIAL_TIER) * n;
        onUpdate(state, isAfk);
        saveToFirebase();
        // **LO QUE DEVUELVE LA COMPRA, Y POR QUÉ NO ES UN ITEM.** La vista usa el
        // valor de retorno para decir "comprado" y para la animación; como no hay item,
        // se devuelve un descriptor con la misma forma que el resto de cartas. Que no
        // tenga `type` ni `id` es lo correcto: no hay nada en el almacén que
        // identificar.
        return { units: valorDeUnCristal(STORE_MATERIAL_TIER) * n, label: CRISTAL_NOMBRE };
      } else if (itemKey === 'crateT1') {
        // F31 · La caja es un item real del almacén: sin esto no se puede abrir.
        // Y es la ÚNICA que se vende. Las otras nueve salen de las anteriores, que
        // es lo que hace que abrir una caja sea progresar y no coleccionar.
        const warehouseItem = createCrateItem(1, n);
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
          // **EL POTENCIAL VIAJA AL ITEM DEL ALMACÉN, COMO EN EL RECOLECTOR.**
          // Sin esta línea el compañero se compraba con potencial en
          // `state.companions` y sin él en el almacén, o sea **el mismo objeto con
          // dos fichas distintas**: la del almacén es la que pinta las estrellas
          // y la que se puede vender. Un item sin estrellas en la rejilla y con
          // estrellas en el panel es el descuadre de R3 en su forma más difícil de
          // ver, porque las dos cifras son del mismo objeto.
          potential: comp.potential,
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
     * Abre una caja del almacén. Sin llave: se busca el item, se comprueba que
     * sea una caja y se consume.
     *
     * **EL HISTORIAL DE ESTA FUNCIÓN DICE POR QUÉ HAY QUE LEERLA ANTES DE TOCARLA.**
     *
     * La primera versión era `openCrateBox(crateType)` y solo miraba
     * `state.keys`. El almacén no participaba: el botón de la vista restaba una
     * unidad del item **y** el juego restaba una del contador, sin que nadie se
     * enterara. La caja se quedaba en la rejilla y el contador bajaba, o al revés.
     *
     * La segunda versión tomaba los dos IDs —caja y llave— y validaba que la llave
     * sirviera para ese cofre. Ese par es el que se quita ahora.
     *
     * **LO QUE NO SE TOCA ES EL ORDEN: LA CAJA SE CONSUME ANTES DE SORTEAR.** Si el
     * sorteo fallara por una excepción, el jugador ya habría perdido la caja sin
     * recibir nada, y eso es peor que un bug visible.
     */
    openCrateBox: (crateId: string): { ok: boolean; msg?: string; reward?: any; crateType?: CrateType } => {
      handleUserActivity();

      const caja = state.warehouse.find((w: any) => w.id === crateId && w.type === 'crate');
      if (!caja) return { ok: false, msg: 'La caja ya no está en el almacén.' };

      const crateType = getCrateTypeFromName(caja.name || '') as CrateType | null;
      if (!crateType) return { ok: false, msg: 'No se reconoce el tipo de esta caja.' };

      // **NO SE ABRE UNA CAJA CUANDO NO CABE SU PREMIO, Y EL VETO ESTÁ ANTES DE COBRAR.**
      //
      // `addToWarehouse()` devuelve `false` cuando el almacén está lleno y el botín se pierde
      // sin avisar: la ruleta enseña un objeto que no ha entrado en ninguna parte. Con el
      // almacén a cero huecos, eso solo puede pasar si la caja está en una pila —entonces la
      // celda se queda al consumir una unidad y no se libera nada—, así que esa es la
      // comprobación y no una más amplia: si la caja está sola, su propia celda se libera y
      // el premio cabe, y aun así se puede abrir.
      //
      // **UN HUECO ES SUFICIENTE, NO UNO POR CAJA.** Cada apertura consume una caja y trae
      // como mucho un item, o sea que lo peor es un hueco por apertura, no más. Por eso con
      // un hueco libre siempre se puede abrir una, y el tope del lote lo calcula
      // `maximoDeApertura()`, que es donde vive la regla.
      const libreAlConsumir = countOccupiedSlots(state.warehouse) < effectiveWarehouseCapacity();
      const enPila = stackUnits(caja) > 1;
      if (!libreAlConsumir && enPila) {
        return { ok: false, msg: 'No queda espacio en el almacén para el botín. Vende o libera una ranura.' };
      }

      consumeWarehouseItem(caja.id, 1);
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
        // **UN ARGUMENTO, Y EL QUE SE CONVIERTE LO ES EL QUE TIRA LA CAJA.** El
        // aplicador ya no recibe el nivel del cristal porque no hay cristales con
        // nivel: `crateLoot` multiplica por `valorDeUnCristal()` al construir el
        // botín, así que el número que llega ya está en unidades y solo se suma.
        //
        // El segundo argumento que quedaba aquí era el que el motor descartaba antes:
        // se traducía a un 1 fijo y la ruleta anunciaba un nivel que el item no
        // tenía. Ahora no hay nada que anunciar.
        crystals: (n) => { grantCrystals(n); },
        // El cosmético no es un item: no pasa por `addItem` ni por el almacén.
        // Se desbloquea aquí y lo persiste el `saveToFirebase` de más abajo, que
        // corre en la misma operación que el resto del botín.
        unlockCosmetic: (cosmeticId) => desbloquearCosmetico(cosmeticId),
        ownedCosmetics: () => state.cosmetics.unlocked,
        addItem: (item) => {
          // **AQUÍ ESTÁ LA PÉRDIDA SILENCIOSA QUE SE HA QUITADO DE ENCIMA.** Con el almacén
          // lleno, `addToWarehouse()` devuelve `false`, el item no entra y la tirada sigue
          // como si nada: el jugador ve un objeto en la ruleta que no tiene en ninguna parte
          // y no hay ningún motivo. Ahora no se puede llegar a ese estado porque
          // `openCrateBox()` veta la apertura cuando el botín no cabe, y el tope del lote
          // sale de `maximoDeApertura()` con los huecos libres. **El retorno se sigue
          // respetando** —un `ok: false` aquí no se ignora— y el veto está un nivel más
          // arriba, donde se puede decir por qué.

          // ---------------------------------------------------------------------------
          //  LA AUTO-VENTA, Y POR QUÉ ESTÁ AQUÍ Y NO EN LA VISTA
          // ---------------------------------------------------------------------------
          //
          // El botín se aplica **dentro** de `rollCrateReward()`, que no sabe nada del
          // filtro. Si el filtro fuera de la vista, la vista tendría que mirar cada
          // premio y decidir: eso es la vista mutando el estado (R1), y además no
          // alcanzaría a las openings en lote, que son veinte de un tirón.
          //
          // **EL IMPORTE ES EL DE `sellItem()`, CON EL TOPE DE PRECIO APLICADO.** Vender
          // automáticamente no cambia de dónde sale el dinero, y `sellPriceTope` existe
          // justo para que un premio de caja no valga más vendido que la caja y la llave
          // que lo dieron. Sin tope, la auto-venta sería **el camino para imprimir**, que
          // es lo que ese tope existe para cerrar.
          //
          // Y **NO SE VENDE SI FUERA EL ÚLTIMO DE SU TIPO**, por la misma razón que en
          // `sellItem()`: un filtro que te deja sin recolectores te deja sin clickedor,
          // y eso no es una venta, es romper la partida. En ese caso el item **entra en el
          // almacén** en vez de negarse: el jugador pidió que se vendiera lo que no
          // cumple, y el premio tiene que entrar igualmente.
          const cfg = coaccionaAutoVenta((state as any).autoVenta);
          if (debeVenderseAuto(item, cfg)) {
            const esUltimo = (item.type === 'collector' || item.type === 'companion') &&
              state.warehouse.filter((w: any) => w.type === item.type).length <= 1;
            if (!esUltimo) {
              const ganado = Math.floor(getSellPriceFor(item));
              state.nanites += ganado;
              // El total producido **también** sube: vender un objeto es cobrar por
              // jugar, no es un premio de caja. Si no contara, la Ascensión — que paga
              // con núcleos y por lo producido — dejaría de reconocer el tiempo que el
              // jugador ha invertido en abrir cajas.
              state.totalNanitesProduced += ganado;
              return { ok: true, nanitas: ganado };
            }
          }

          if (!addToWarehouse(item as any)) return { ok: false };
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
          return { ok: true };
        }
      });

      // Los contadores se recalculan DESPUÉS de aplicar el botín, para que
      // incluyan lo que acaba de caer. Recalcularlos antes era lo que dejaba el
      // almacén y los contadores desincronizados.
      syncCrateCounters();
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
     * el contador de recolectores forjadas. Esa es toda la promesa del
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

      /**
       * LOS HISTÓRICOS. NO SE RECICLAN.
       *
       * Hay dos clases de números en la partida y confundirlas cuesta caro:
       * los que son **de esta subida** —el saldo, los ingestos, los compañeros
       * que llevas puestos— y los que son **de tu historia** —cuánto has producido,
       * cuántos clics llevas, cuántas cajas has abierto, cuántas ranuras
       * compraste—. Los primeros se reinician porque el Ascenso es empezar de
       * cero. Los segundos no, porque **no son progreso: son la marca de haber
       * jugado**, y por eso se publican y por eso se pagan.
       *
       * **El que de verdad rompía el juego era `totalNanitesProduced`.**
       *
       * Los núcleos de la siguiente Ascensión son
       * `nextCores = max(0, pendingCores(totalNanitesProduced) − totalCores)`, y
       * `pendingCores(0)` es **cero**. Con el contador a cero después del primer
       * Ascenso, el segundo Ascenso daba siempre `max(0, 0 − 16) = 0`: el botón
       * se quedaba para siempre en "Necesitas producir más para reciclar" y la
       * partida se acababa para siempre. No era que el segundo Ascenso costara
       * más, era que **no existía**, y no había ningún aviso: el jugador subía y
       * se encontraba con un botón muerto sin explicación.
       *
       * Los otros tres son de la misma familia y más discretos:
       *
       *  - `totalClicks` alimenta la tabla de "Clics". Reiniciarlo te sacaba de
       *    ella, y quien más había hecho clic era quien más perdía.
       *  - `cratesOpened` sale en el panel de administración como "Cajas abiertas".
       *    El logro `crate_opener` no se puede repetir —los logros se conservan—,
       *    así que no regalaba nada: solo hacía que el contador mintiera.
       *  - `maxCompanionSlots` son las ranuras que se **compran con recurso** en la
       *    tienda. Reiniciarlas a 1 era cobrar por algo que el siguiente Ascenso se
       *    llevaba. Las del árbol (`state.bonus.companionSlots`) nunca se pierden,
       *    porque viven en `nodeLevels`; estas eran las únicas que sí.
       *
       * `totalInfraestructure` sí se sigue reiniciando, y no por ser histórica:
       * es un campo muerto que siempre ha valido cero. No se toca porque no hay
       * nada que conserving.
       */
      const keptNanitesProduced = state.totalNanitesProduced;
      const keptClicks = state.totalClicks;
      const keptCratesOpened = state.cratesOpened;
      const keptCompanionSlots = state.maxCompanionSlots;

      // Reinicio total
      Object.assign(state, {
        nanites: 0,
        totalNanitesProduced: keptNanitesProduced,
        passiveIncome: 0,
        passiveMultiplier: 1,
        totalClicks: keptClicks,
        totalInfraestructure: 0,
        cratesOpened: keptCratesOpened,
        // **EL CRISTAL VUELVE AL VALOR INICIAL, COMO TODO LO QUE SE BORRA AQUÍ.**
        // El Ascenso reconstruye la partida desde el estado de partida nueva, y por eso
        // los saldos se escriben con el número con el que empiezan, no con el que
        // tienen: las nanitas a 0 porque empiezan a 0, y el cristal a 5 porque
        // empiezan a 5. Es el mismo kit de arranque, no una decisión sobre cuánto
        // regalarle al jugador.
        //
        // Antes este campo se llamaba `upgradeCrystals` y el motor lo escribía sin
        // tocar el cristal de verdad, que era un item del almacén y lo borraba el
        // `Object.assign` de `warehouse: []` de más abajo. Se notaba al ascender: el
        // contador de una partida nueva ponía 5 y el almacén podía bringir lo que
        // hubiera sobrevivido.
        crystals: 5,
        warehouseCapacity: 15,
        maxCompanionSlots: keptCompanionSlots,
        afkCards: 0,
        afkExpiresAt: 0,
        crates: { ...contadorDeCajasVacio(), 1: 2 },
        // **EQUIPADOS, COMO EN EL ESTADO INICIAL.** El Ascenso reconstruye la partida de
        // partida, y si aquí no se equipan los dos items, **ascender desequipa todo**:
        // el jugador empieza con su arma puesta, Recycla, y se queda sin ingreso y
        // sin saber por qué. Son el mismo estado inicial, así que se escriben con
        // las mismas reglas.
        equippedCollectorId: 'collector_blaster_001',
        companions: [baseCompanion],
        activeCompanions: ['companion_base_001'],
        warehouse: [
          // **LAS DOS FICHAS SALEN DE LAS FÁBRICAS DE ARRIBA, IGUAL QUE EN EL
          // ESTADO INICIAL.** El recolector estaba escrito a mano aquí, con
          // `damage: 5` y sin potencial, mientras la partida nueva usaba otra
          // cosa. Dos copias del mismo item con reglas distintas, y el Ascenso es
          // justo el momento en que se nota: acabas de ascender, tu Blaser ha
          // cambiado de número y nadie te ha dicho por qué.
          nuevoBaseRecolector(),
          // **EL COMPAÑERO DE PARTIDA SE CONSTRUYE DESDE `baseCompanion`, NO CON
          // NÚMEROS ESCRITOS.** Antes la ficha decía "+5/s" y no traía potencial,
          // mientras que la entrada de `state.companions` decía otra cosa: el mismo
          // compañero con dos números distintos en dos sitios, que es R3 en la
          // forma más difícil de ver porque las dos cifras son del mismo objeto y
          // solo una se pinta. Al derivarlo de `baseCompanion` no pueden separarse.
          {
            id: baseCompanion.id,
            name: baseCompanion.name,
            type: 'companion',
            details: `Recolección por segundo: +${baseCompanion.power}/s`,
            rarity: baseCompanion.rarity,
            tier: baseCompanion.tier,
            potential: baseCompanion.potential,
            sellPrice: 250
          }
        ],
        buffs: { clickBoostExpiresAt: 0, passiveBoostExpiresAt: 0, clickX2ExpiresAt: 0, clickX3ExpiresAt: 0 },
        // Lo permanente
        cores: keptCores,
        totalCores: keptTotalCores,
        resets: keptResets,
        nodeLevels: keptNodes,
        unlockedNodes: Object.keys(keptNodes),
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
     * Fusiona 2 recolectores del mismo tier en uno de tier+1.
     * `stonesUsed` es cuántas Piedras de Calibración se consumen: cada una
     * sube 12 puntos la probabilidad, hasta 5.
     */
    forgeCollector: (materialIds: string[], stonesUsed = 0, nanoUsed = 0) => {
      handleUserActivity();

      // Las tres comprobaciones y el cobro salen de las cuentas internas: las
      // mismas que usa la forja de compañeros, porque son las mismas reglas.
      const mat = materialesDeForja(materialIds, 'collector');
      if (mat.error || !mat.materials) return { success: false, msg: mat.error };

      const pago = gastaConsumiblesDeForja(stonesUsed, nanoUsed);
      if (pago.error) return { success: false, msg: pago.error };

      const author = user.displayName || username || 'Anónimo';
      const result = attemptForge(mat.materials, mat.tier!, author, {
        craftLuck: state.bonus.craftLuck,
        consolationBonus: state.bonus.consolationBonus,
        stonesUsed: pago.stones!,
        nanoUsed: pago.nano
      });

      if (result.error) return { success: false, msg: result.error };

      if (result.success && result.collector) {
        const w = result.collector;
        w.sellPrice = sellPrice(w as any, { sellMult: 1 + state.bonus.sellMult });
        consumeMaterialesDeForja(materialIds);
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

      // Fallo: se pierden los 2 y se ganan cristales
      consumeMaterialesDeForja(materialIds);
      // **EL FALLO DEJA CRISTALES, Y POR AQUÍ.**
      //
      // Un fallo cuesta los dos materiales del yunque, que es un objeto de tier:
      // en los niveles altos son miles de nanitas. **Sin nada más, la racha mala
      // vacía el almacén y el jugador deja de intentar**; con una compensación que
      // se lleva, cuesta pero no empobrece.
      //
      // Y **suben con el tier a propósito**, porque el coste del fallo también sube.
      // El número está en `cristalesDeConsuelo()` (`data/crafting.ts`), que es la
      // mitad de la regla del fallo, y es **la misma función para las dos fusiones**.
      //
      // Se entregan por `grantCrystals()`, la misma vía que usan las cajas: así el
      // almacén sigue siendo la fuente de verdad y los contadores se derivan, en
      // vez de escribir un contador suelto que se desincroniza al recargar.
      const intentos = result.crystals || 0;
      // **EL CONSUELLO SE CONVIERTE AQUÍ Y NO EN `cristalesDeConsuelo()`.** Esa
      // función devuelve *intentos de nivel 0*, no unidades, y el que paga el
      // dinero es quien lo entrega. Multiplicar dentro de la regla habría dejado la
      // mitad de los llamadores sin factor, y la forja valdría casi cero en los
      // niveles altos sin que nada lo delatara: es un número que se ve grande y vale
      // poco.
      const consuelo = intentos * valorDeUnCristal(mat.tier!);
      if (consuelo > 0) grantCrystals(consuelo);
      onUpdate(state, isAfk);
      saveToFirebase();
      return {
        success: false,
        crystals: consuelo,
        chance: result.chanceUsed,
        msg: `Fallo en la forja: +${consuelo} cristales`
      };
    },

    /**
     * Fusiona 2 compañeros del mismo tier en uno de tier+1.
     *
     * **ES LA MISMA FORJA, CON LA MISMA PROBABILIDAD Y EL MISCO COBRO.** Todo lo
     * que no es qué se produce sale de las mismas funciones que la de
     * recolectores, y por eso el jugador puede comparar las dos sin aprender dos
     * reglas: dos tiradas cuestan lo mismo y salen igual de bien.
     *
     * **LO QUE CAMBIA ES EL RESULTADO, Y POR QUÉ NO ES UNA COPIA.** El compañero
     * no tiene afijos: su calidad es el potencial, y sale de la media de los dos
     * materiales. La nanopartícula, que en el recolector garantiza un afijo extra,
     * aquí sube **+1 al potencial**, que es lo mismo dicho en el idioma del
     * compañero. Si no hiciera eso, sería el mejor objeto del juego sin efecto
     * ninguno.
     */
    forgeCompanion: (materialIds: string[], stonesUsed = 0, nanoUsed = 0) => {
      handleUserActivity();

      const mat = materialesDeForja(materialIds, 'companion');
      if (mat.error || !mat.materials) return { success: false, msg: mat.error };

      const pago = gastaConsumiblesDeForja(stonesUsed, nanoUsed);
      if (pago.error) return { success: false, msg: pago.error };

      const result = attemptForgeCompanion(mat.materials, mat.tier!, {
        craftLuck: state.bonus.craftLuck,
        consolationBonus: state.bonus.consolationBonus,
        stonesUsed: pago.stones!,
        nanoUsed: pago.nano
      });

      if (result.error) return { success: false, msg: result.error };

      if (result.success && result.companion) {
        const c = result.companion;
        consumeMaterialesDeForja(materialIds);
        // **AL ARRAY DE COMPAÑEROS, Y LUEGO AL ALMACÉN.** Es al revés del
        // recolector, y no por capricho: el compañero tiene una ficha propia que
        // `syncCompanionsToWarehouse()` crea. Si solo se metiera en el almacén,
        // el panel no lo vería; si solo se metiera en el array, la rejilla no
        // enseñaría sus estrellas.
        state.companions.push(c);
        syncCompanionsToWarehouse();
        state.forgedCount += 1;
        recalculatePassiveIncome();
        checkAchievements();
        onUpdate(state, isAfk);
        saveToFirebase();
        return {
          success: true,
          companion: c,
          chance: result.chanceUsed,
          msg: `${c.name} forjado`
        };
      }

      consumeMaterialesDeForja(materialIds);
      // **LO MISMO QUE EN EL RECOLECTOR, Y POR LA MISMA RAZÓN.** El fallo de una
      // fusión de compañeros también cuesta dos objetos de tier, así que también
      // tiene que dejar algo. Y lo deja la misma función, para que las dos
      // compensaciones no puedan separarse.
      const intentos = result.crystals || 0;
      // Y lo mismo en la fusión de compañeros, por el mismo motivo: **las dos
      // ramas de fallo dan lo mismo**, y eso tiene una prueba que las compara.
      const consuelo = intentos * valorDeUnCristal(mat.tier!);
      if (consuelo > 0) grantCrystals(consuelo);
      onUpdate(state, isAfk);
      saveToFirebase();
      return {
        success: false,
        crystals: consuelo,
        chance: result.chanceUsed,
        msg: `Fallo en la forja: +${consuelo} cristales`
      };
    },

    /**
     * Cuánto mejora la tirada la forja.
     *
     * `baseChance` sale de `baseSuccessChance()`, que es donde vive la fórmula.
     * Antes la reescribía aquí con los mismos números, y el `preview.ts` la
     * reescribía por tercera vez: tres copias de una curva que el jugador puede
     * leer, para que en el momento de decidir cuánto paga por una piedra no le
     * digan una cosa y el yunque haga otra.
     */
    getForgeInfo: () => ({
      craftLuck: state.bonus.craftLuck,
      baseChance: (fromTier: number) => baseSuccessChance(fromTier) + state.bonus.craftLuck
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
    /**
     * QUÉ ENTREGA UNA UNIDAD DE ESTA CARTA, Y EN QUÉ UNIDADES DEL RECURSO.
     *
     * ## POR QUÉ ESTE MÉTODO EXISTE
     *
     * Porque la ficha del mercado decía **precio** y **cuánto tienes**, y nada más. Con
     * las dos columnas al lado, un saldo de 213 ◆ al lado de un precio de 200 ◆ no dice si
     * esos 213 son lo que tienes o lo que te dan: comprar y ver el saldo subir a 413 no
     * contesta a la pregunta, y el jugador se queda con la duda de si acaba de comprar
     * una unidad o un montón.
     *
     * **La respuesta la tiene que dar el motor**, porque el es quien escribe
     * `state.crystals += valorDeUnCristal(...) * n`. Si la vista calculara el rendimiento
     * con su propia fórmula, un cambio en la regla tendría dos números y el precio de
     * la tienda y su producto dejarían de cuadrar (R3).
     *
     * `recurso` es `null` para las cartas que no dan un recurso --una caja, una ranura--:
     * esas no tienen nada que sumar y el número no se enseña, en vez de enseñar un 0.
     */
    getStoreItemYield: (itemKey: string): { unidades: number; recurso: string | null } => {
      if (itemKey === 'upgradeCrystal') {
        return {
          unidades: valorDeUnCristal(STORE_MATERIAL_TIER),
          recurso: 'cristales'
        };
      }
      const cons = CONSUMABLES[itemKey as keyof typeof CONSUMABLES];
      if (cons) return { unidades: 1, recurso: null };
      return { unidades: 0, recurso: null };
    },

    getStoreUnitCost: (itemKey: string): number => precioUnitarioTienda(itemKey),

    /**
     * Cuántas unidades se pueden comprar de golpe, ahora mismo (F14).
     *
     * Lo no apilable vale 1: la vista compra directo sin preguntar. Lo apilable
     * vale lo que alcanzan **dos cosas**: el saldo y el espacio.
     *
     * Y EL ESPACIO PUEDE LIMITAR, QUE ANTES NO PASABA. Decía "una pila es una
     * ranura, así que si cabe una caben N", y eso era cierto mientras las
     * pilas no tuvieran tope. Con el tope de 99 cajas, un almacén con una pila
     * de 99 y una ranura libre admite **una** caja más, no mil. Por eso el tope
     * se calcula con `cabeLaCompra(itemKey, n)` en crudo, en vez de comprobar
     * solo "¿cabe una?": si se comprobara solo eso, el diálogo ofrecería 500 cajas
     * y el motor rechazaría la compra con "Almacén lleno", que es la peor forma
     * de fallar.
     *
     * Si no cabe ni una, vale 0 y la vista ni pregunta: deja el camino de
     * siempre para que el motor rechace con su mensaje.
     */
    getBulkUnitName: (itemKey: string): string => nombreDeUnidad(itemKey),

    getBulkMax: (itemKey: string): number => {
      if (unidadesCompra(itemKey, 2) !== 2) return 1;
      const unit = precioUnitarioTienda(itemKey);
      if (unit <= 0) return 1;
      const porDinero = Math.floor(state.nanites / unit);
      if (porDinero < 1 || !cabeLaCompra(itemKey, 1)) return 0;

      // El mayor n tal que n cabe, y la respuesta NO es lineal en las unidades:
      // con el tope de 99 cajas, un almacén con una pila de 99 admite una caja
      // más y ni una de más, aunque el saldo sea de un millón. Por eso no vale
      // una cuenta cerrada.
      //
      // Y POR QUÉ BUSCA Y NO RECORRE. La primera versión subía de uno en uno con
      // `while (max < porDinero && cabe(...))`, que es correcto pero **se
      // atasca**: con el saldo que da la caja T10, `porDinero` es de millones y
      // el bucle se comía el hilo del navegador en una tienda que se acaba de
      // abrir. La respuesta es monótona en n —más unidades nunca necesita menos
      // ranuras—, así que un binary search da el mismo número en 20 pasos.
      let bajo = 1;
      let alto = porDinero;
      while (bajo < alto) {
        const medio = Math.ceil((bajo + alto) / 2);
        if (cabeLaCompra(itemKey, medio)) bajo = medio;
        else alto = medio - 1;
      }
      return bajo;
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
