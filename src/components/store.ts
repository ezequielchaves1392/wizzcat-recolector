// ==========================================================================
// Mercado · Tienda
//
// 1. PRECIO REAL. La tarjeta mostraba `item.cost` y el game loop cobraba lo
//    mismo. Al añadir la reducción de coste del árbol, si la tarjeta siguiera
//    mostrando el precio base el jugador pagaría más de lo que ve. Ahora
//    ambos salen del mismo número, calculado en un único sitio.
//
// 2. CATEGORÍAS CON ICONOS. Las etiquetas eran "📦 Cajas", "⚡ Recursos"... Los
//    emojis se veían distintos según el sistema operativo, así que se
//    sustituyeron por iconos SVG del mismo set que el resto del juego.
//
// 3. DESCRIPCIONES REALES. Antes una caja decía "Contiene recompensas básicas",
//    que no dice nada: el jugador no tenía forma de saber si le convenía.
//    Ahora cada producto tiene una descripción de dos líneas que explica qué
//    hace y qué trae, y al tocar la tarjeta se abre el detalle completo.
//
// 4. BOTÓN "COMPRAR" FIJO. Cuando no hay nanitas suficientes el botón decía
//    "Sin nanitas", y el texto cambiando impedía reconocerlo como la misma
//    acción. Ahora siempre dice "Comprar" y lo que cambia es su aspecto.
//
// 5. PESTAÑAS CON INDICADOR. La categoría activa se pintaba cambiando las
//    clases del botón, lo que además obligaba a re-renderizar la lista entera.
//    Ahora hay un indicador que se desplaza, y las pestañas no cambian de
//    ancho al activarse.
//
// 6. LA PESTAÑA ACTIVA AL COMIENZO. Siete pestañas no caben en un móvil, así
//    que elegir "Compañeros" dejaba el indicador resaltando un botón fuera de
//    pantalla. Ahora la tira se desplaza y deja la categoría activa en el
//    primer botón, que es donde el jugador está mirando.
// ==========================================================================

import { formatNumber } from '../utils/format';
import { ic, type IconName } from '../ui/icons';
import { pageShell, mountInto, wireNav, statStrip } from '../ui/pageShell';
import { TIER_SYSTEM, lorePara, lineaTipoCompanion } from '../data/tiers';
import { STORE_ITEMS, CRATE_TYPES, RANURA_POR_CARTA, COMPANION_SLOT_BUY, EXPANSOR_TIERS, WAREHOUSE_MAX_CAP, WAREHOUSE_BASE_CAP, costeDeCaja, type CrateType } from '../data/store';
import { PIEDRA_PUNTOS, pctDe, BONO_ETTER } from '../data/constants';
import { MAX_PIEDRAS_POR_FUSION } from '../data/crafting';
import { sfx } from '../utils/audio';
import { showToast } from '../utils/toast';
import { showConfirmModal } from '../utils/modal';
import { rarityClass, raritySlug, RARITY_TEXT } from './crateLoot';
import { countOccupiedSlots } from '../data/stacking';

export interface Category {
  id: string;
  label: string;
  icon: string;
  items: string[];
}

/**
 * F31 · LAS CATEGORÍAS DE LA TIENDA, Y LO QUE YA NO ESTÁ.
 *
 * Desaparecen dos categorías enteras —**Compañeros** y **Recolectores**, veinte
 * cartas de 900 a 193.850— y la de **Cajas** se queda con una sola carta. Ese es
 * el recorte que hace F31, y es el más grande del lote: mientras la carta del T8
 * esté a la venta, la caja alta es un adorno y abrir cofres no progresa nada.
 *
 * Lo que queda es lo que de verdad es el arranque y el sostenimiento: **la caja
 * T1**, las ranuras, los expansores y las tarjetas. Las nueve cajas siguientes salen
 * de abrir la anterior, así que la tienda solo tiene que vender la primera; y ya
 * **no hay llave que compre por delante**, porque la caja se abre sola.
 */
/**
 * Los expansores que están en la tienda, por orden de tier.
 *
 * Sale de `EXPANSOR_TIERS` filtrando los que tienen precio, que es la misma
 * condición que usa `STORE_ITEMS` para construirlos. **Si las dos listas se
 * construyen con el mismo filtro, no pueden separarse**: la categoría no puede
 * enseñar una carta que no existe ni dejar de enseñar una que sí.
 */
const EXPANSORES_EN_VENTA = EXPANSOR_TIERS
  .filter(e => e.cost !== null)
  .map(e => e.buffId)
  .sort();

/**
 * Las baldas de la tienda.
 *
 * **EXPORTADAS COMO `DESCRIPTIONS`, Y POR EL MISMO MOTIVO:** un banco las
 * contrasta con el código. Sin leerlas desde fuera, que el Éter de
 * Refinamiento esté en la balda "Forja" y en ninguna otra es una línea que
 * nadie comprueba: un consumible fuera de su balda es un producto que nadie
 * encuentra, y uno repetido se anuncia dos veces.
 */
export const CATEGORIES: Category[] = [
  { id: 'cajas', label: 'Cajas', icon: 'crate', items: ['crateT1', 'crateT2', 'crateT3'] },
  // F47 · **EL CRISTAL SOLO EN RECURSOS.** Los expansores estaban aquí con él porque
  // los dos se compran con lo que produce el juego, pero no son un recurso: no se
  // gastan, no se acumulan y no se venden, **se usan** para abrir el almacén, y la
  // pestaña donde estaban—"Recursos"— solo tenía una carta que lo era. El expansor
  // es lo mismo que las cartas de ranura: una mejora de la partida. Ahora están en
  // "Mejoras", con ellas, y donde se buscan.
  { id: 'recursos', label: 'Recursos', icon: 'crystal', items: ['upgradeCrystal'] },
  // F4 · Solo las tres tarjetas. `clickBuff` y `passiveBuff` se han retirado de la
  // lista: la categoría ya no puede nombrarlos porque no existen, y
  // `STORE_ITEMS` no los tiene, así que una carta ahí daría un error de
  // `undefined` al pintar.
  { id: 'cartas', label: 'Cartas', icon: 'card', items: ['afkCard', 'clickX2Card'] },
  { id: 'forja', label: 'Forja', icon: 'flask', items: ['calibrationStone', 'stabilityNano', 'refiningEther'] },
  // Los expansores que se venden salen de `EXPANSOR_TIERS`, no de una lista escrita.
  // Con diez expansores y cuatro a la venta, escribirlos aquí era otro sitio donde
  // olvidarse de uno; y si mañana se vendiera el T5, esta línea seguiría enseñando
  // cuatro. El filtro es el mismo que usa `STORE_ITEMS` para construirlos, así que
  // la categoría no puede enseñar una carta que no existe ni dejar de enseñar una
  // que sí.
  { id: 'mejoras', label: 'Mejoras', icon: 'layers', items: [...Object.keys(RANURA_POR_CARTA), ...EXPANSORES_EN_VENTA] }
];

/**
 * Descripciones de producto. El texto responde a las dos preguntas que el
 * jugador se hace al mirar una tarjeta: "¿qué me da?" y "¿me compensa?".
 */
/**
 * Las leyendas de las tarjetas, en bruto.
 *
 * **EXPORTADAS PORQUE UN BANCO LAS CONTRASTA CON EL CÓDIGO.** `leyendaCheck`
 * comprueba que ninguna diga una cosa distinta de la que el juego hace, y para
 * eso tiene que leerlas. Y como no era necesaria, la lista era la copia del botín
 * que `data/store.ts` ya había proibido para las cajas, y nadie lo vio porque
 * nadie la leía con la tabla al lado.
 */
/**
 * Cuántos cristales entrega un pack, que es `valorDeUnCristal(1)`.
 *
 * **NO ES UN NÚMERO ESCRITO Y POR ESO NO MIENTE.** El pack entrega exactamente lo que
 * vale un cristal de T1, que es `costeDeCaja(1)`. Escribir "675" aquí y en la lógica
 * serían dos fuentes del mismo número, y el día que la curva cambie el texto seguiría
 * diciendo 675. Se lee de la tabla que usan la compra y el botín.
 */
const CRISTALES_POR_PACK = costeDeCaja(1);

export const DESCRIPTIONS: Record<string, { what: string; detail: string }> = {
  // **ESTA TARJETA NO ENUMERA EL BOTÍN, Y SIGUE SIN HACERLO.** Decía "da
  // nanitas, cristal T1, un compañero T1, su llave y —a veces— la caja T2",
  // que son cinco cosas y **no incluían el recolector**: quien reportaba que
  // las cajas T1 no tiraban armas no se equivocaba, se fiaba de la carta. Una
  // lista escrita al lado de la tabla que genera esa lista es una segunda
  // fuente de verdad. `leyendaCheck` la comprueba.
  crateT1: {
    what: 'La caja con la que se empieza.',
    // F97 Lote 2c · La T2 y la T3 también se venden (con licencia), así que el
    // texto viejo mentía. No nombra tiers con número: la leyenda de la tienda
    // no distingue cartas por su cifra, y "caja T2" en la tarjeta de la T1 es
    // la confusión que el banco vigila.
    detail: 'Las siguientes salen de abrir la anterior; algunas también se venden con licencia del árbol.'
  },
  crateT2: {
    what: 'Un tier por encima de la básica.',
    detail: 'Pide licencia del árbol para comprarla; si no, sale de abrir la anterior.'
  },
  crateT3: {
    what: 'Dos tiers por encima de la básica.',
    detail: 'Pide su propia licencia del árbol; si no, sale de abrir la anterior.'
  },

    // POR QUÉ AQUÍ NO SE DICE CÓMO ESTÁ HECHA LA TIRADA. Antes decía "con el
    // botín ya decidido antes de girar", que era verdad y no era lo que había que
    // contar: es hablar como si la ruleta no sorteara nada, y el jugador leía que
    // el trompo es un adorno y que el premio ya estaba escrito. Lo que el jugador
    // vive es al revés de lo que dice la frase: él no sabe qué va a salir hasta
    // que la casilla se para. Ese es el trompo, y es lo único que esta tarjeta
    // tiene que contar.
  upgradeCrystal: {
    what: `Un pack de cristales: ${formatNumber(CRISTALES_POR_PACK)} de golpe, que suben de nivel a recolectores y compañeros.`,
    // **ESTE TEXTO YA NO HABLA DE NIVELES PORQUE NO LOS HAY.** Antes decía "cada
    // recolector se sintoniza con el cristal de SU MISMO tier" y enumeraba de dónde
    // salían los otros nueve: eso era F26, que era una regla del sistema de las
    // llaves y del material. Con un solo recurso las dos mitades se han ido.
    //
    // Y hay una regla nueva que sí hay que decir, porque no se deduce solo: **un
    // T10 cuesta mucho más que un T1**, y eso es lo que hace que subir un item
    // alto sea una decisión y no un trámite.
    detail: `La carta se compra por packs: cada pack entrega ${formatNumber(CRISTALES_POR_PACK)} cristales de una vez. Sube el nivel de un recolector o un compañero; cuanto mayor es el nivel del item, más cuesta cada nivel, y el coste sube en cada subida. La probabilidad de acierto baja con el nivel y no hay forma de comprarse más suerte.`
  },

  afkCard: {
    what: 'Permite seguir cobrando con la ventana cerrada o en otra aplicación.',
    detail: 'El tiempo de la tarjeta se suma, hasta un máximo de 3 tarjetas a la vez. Cuanto más invertido tengas en compañeros activos, más rinde.'
  },
  clickBuff: {
    what: 'x2 a la recolección por click durante 30 minutos.',
    detail: 'Afecta al recolector, no a la recolección por segundo. Conviene usarlo cuando vas a dedicate a pulsar en vez de a mirar los números.'
  },
  passiveBuff: {
    what: 'x2 a toda la recolección por segundo durante 1 hora.',
    detail: 'Multiplica a los compañeros activos, no a la recolección por click. Es la mejor carta si tu estilo es dejar que trabajen solos.'
  },
  clickX2Card: {
    what: 'x2 al click durante 30 segundos.',
    detail: 'Muy corta a propósito: para gastarla en el pico de una racha de clicks, no para llevarla puesta.'
  },
  clickX3Card: {
    what: 'x3 al click durante 30 segundos.',
    detail: 'El doble de efecto que la x2 por cinco veces el precio. Solo sale rentable con muchos clicks por segundo.'
  },

  calibrationStone: {
    what: `Sube ${PIEDRA_PUNTOS} puntos la probabilidad de la próxima fusión.`,
    detail: `Se usa en la Forja y se puede gastar más de una por intento, hasta ${MAX_PIEDRAS_POR_FUSION}. Cuantas más gastes en una tirada, más riesgo que asumes.`
  },
  stabilityNano: {
    what: 'Sube la rareza del recolector forjado un escalón, la mitad de las veces.',
    detail: 'Solo sirve en la forja de recolectores: ahí decide la rareza del resultado —y la rareza es la que pone el número de afijos—, y en compañeros no hace nada porque su rareza la pone el tier. Sube hasta Divino. Sale de las cajas desde la T3.'
  },
  refiningEther: {
    what: `Añade ${pctDe(BONO_ETTER)} puntos a la probabilidad de que la fusión suba el potencial una estrella.`,
    detail: 'Se usa en la Forja de recolectores y de compañeros, y se gasta aunque la tirada falle o la fusión falle. La probabilidad existe sin Éter y baja al subir de estrella; el Éter la sube. Sale de las cajas desde la T3.'
  },

  companionSlot1: {
    what: 'Una ranura más de compañero activo.',
    detail: 'Los compañeros activos son los que generan recolección por segundo. Con más ranuras puedes usar a los que tengas, pero también subirlos de tier.'
  },
  companionSlot2: {
    what: 'Abre hasta 3 ranuras de compañero de golpe.',
    detail: 'Sale mucho más barato por ranura que comprar la ranura suelta, pero solo tiene sentido si ya usas las 2 primeras.'
  }
};

/**
 * La ficha de un expansor, GENERADA desde `EXPANSOR_TIERS`.
 *
 * Las dos estaban escritas a mano con los tres números dentro —"añade 2 ranuras",
 * "vale hasta 120", "sube al T2"— y por eso eran la tercera copia de la misma
 * regla en el mismo repo (la tabla, el consumible y la ficha). Con diez tiers eso
 * ya no es mantenible, y además lo que contestaban mal era **la pregunta que el
 * jugador se hace al mirarlas**: "¿me sirve?", que es si su almacén está por
 * debajo del techo.
 *
 * Por eso el texto dice **qué hace falta para que sirva**, no solo cuántas
 * ranuras da: "si tu almacén ya está en N o más, necesitas el tramo siguiente".
 * Con eso la tarjeta contesta la pregunta sin que haya que abrir nada.
 */
function descDeExpansor(e: typeof EXPANSOR_TIERS[number]): { what: string; detail: string } {
  const siguiente = EXPANSOR_TIERS.find(x => x.tier === e.tier + 1);
  const unidad = e.slots === 1 ? 'ranura' : 'ranuras';
  const usos = e.maxCap - WAREHOUSE_BASE_CAP;
  return {
    // **"UNA RANURA, HASTA 25" Y NO "UNA, HASTA 25":** el singular y el plural salen de
    // la tabla, igual que los números. Y se dice cuántas veces se puede usar, que es lo
    // que el jugador no puede calcular: diez usos para el primer peldaño, y a partir de
    // ahí el expansor siguiente.
    what: `Añade ${e.slots} ${unidad} permanente${e.slots === 1 ? '' : 's'} al almacén, ${usos} veces hasta llegar a ${e.maxCap}.`,
    detail: siguiente
      ? `Se usa desde el almacén. Si ya llegas a ${e.maxCap}, deja de servir: necesitas el ${siguiente.name}, que llega hasta ${siguiente.maxCap}.`
      : `Se usa desde el almacén. Es el último: llega hasta ${e.maxCap} y no hay nada por encima.`
  };
}

/** La carta de un expansor, o `undefined` si no lo es. */
function expansorDeCarta(itemKey: string): typeof EXPANSOR_TIERS[number] | undefined {
  return EXPANSOR_TIERS.find(e => e.buffId === itemKey);
}

/** Descripción de las tarjetas de tier, generada: cambia el número, no la idea. */
function tierDescription(kind: 'companion' | 'collector', tier: number): { what: string; detail: string } {
  const range = tierRange(tier);
  const r = tierRarity(tier);
  if (kind === 'companion') {
    return {
      what: `Compañero de tier ${tier} (${r}): entre +${range[0]} y +${range[1]} de recolección por segundo.`,
      detail: 'Solo cuenta si lo equipas en una ranura activa. El nombre, el poder exacto y la rareza se sortean al comprarlo.'
    };
  }
  return {
    what: `Recolector de tier ${tier} (${r}): entre +${range[0]} y +${range[1]} de recolección por click.`,
    detail: 'La recolección por click y la rareza se sortean al comprarlo. Los tiers altos suben de precio por estilo, no por ser objetivamente mejores: el coste por punto se mantiene plano en toda la curva.'
  };
}

/** Rango de poder de un tier, para la línea de detalle de las tarjetas. */
function tierRange(tier: number): [number, number] {
  return (TIER_SYSTEM.ranges as Record<number, [number, number]>)[tier] ?? [1, 5];
}

function tierRarity(tier: number): string {
  return (TIER_SYSTEM.rarityByTier as Record<number, string>)[tier] ?? 'Común';
}

/** Estado de la pantalla. Sobrevive a los re-renders. */
const ui = {
  category: 'cajas',
  detail: null as string | null,
  /** Desplazamiento horizontal de la tira de pestañas antes del último render. */
  stripScroll: 0
};

/** Icono del producto según su clave. */
function iconFor(itemKey: string): IconName {
  // F97 Lote 2c · Todas las cartas de caja comparten icono: el `if` de antes
  // solo conocía la T1 y la T2 salía con el genérico de tienda.
  if (/^crateT\d+$/.test(itemKey)) return 'crate';
  const map: Record<string, IconName> = {
    upgradeCrystal: 'crystal',
    // Los expansores comparten icono: los diez son el mismo objeto con distinto
    // techo, y el icono lo dice mejor así que un icono por tier.
    ...Object.fromEntries(EXPANSOR_TIERS.map(e => [e.buffId, 'warehouse' as IconName])),
    afkCard: 'clock', clickX2Card: 'bolt', clickX3Card: 'bolt',
    calibrationStone: 'flask', stabilityNano: 'flask', refiningEther: 'flask',
    // Las cartas de ranura salen de la tabla, no de una entrada por carta. Con una
    // entrada por carta, una ranura nueva nace sin icono y con el de la última.
    ...Object.fromEntries(Object.keys(RANURA_POR_CARTA).map(k => [k, 'layers']))
  };
  return map[itemKey] ?? 'store';
}

/**
 * Cómo se llama una unidad de esta carta en el almacén, en singular y en plural.
 *
 * "En almacén: 1 caja" y "En almacén: 3 cajas" tienen que concordar, y con una sola
 * forma salía "1 cajas". El número sale del motor (`getOwnedCount`); la palabra, de
 * aquí, que es la vista.
 */
function singularDeUnidad(itemKey: string): string {
  if (/^crateT\d+$/.test(itemKey)) return 'caja';
  return 'unidad';
}
function pluralDeUnidad(itemKey: string): string {
  if (/^crateT\d+$/.test(itemKey)) return 'cajas';
  return 'unidades';
}

/**
 * El nombre en plural del cristal.
 *
 * "Cristal de Mejora" en plural no se forma añadiendo una ese a la última palabra
 * ("Cristal de Mejoras" suena mal): el plural es del núcleo, "cristales". Como el
 * singular del item vive en `data/items.ts`, aquí se dice solo el plural y un
 * renombrado no lo deja mintiendo.
 */
const CRISTAL_PLURAL = 'cristales';

function rarityOf(itemKey: string): string | null {
  // F31 · Y la de la caja sale de ``CRATE_TYPES``, que es donde vive su nombre.
  // Antes era un objeto de cuatro pares en línea, aquí, que con diez cajas solo
  // habría acertado en cuatro. F97 Lote 2c: las tres cartas leen su tier.
  const mCaja = /^crateT(\d+)$/.exec(itemKey);
  if (mCaja) return (CRATE_TYPES as Record<number, { rarity: string }>)[Number(mCaja[1])]?.rarity ?? null;
  const map: Record<string, string> = {
    upgradeCrystal: 'Raro',
    // La rareza de un expansor es la de su tramo, que vive en la tabla: es un
    // item del tramo que lo suelta. Antes salía de la caja T{n}, que con cuatro
    // tramos daría dos Comunes seguidos y el Intermedio no se distinguiría del
    // Inicial. Dos sitios con dos rarezas para lo mismo es D4.
    ...Object.fromEntries(EXPANSOR_TIERS.map(e => [e.buffId, e.rareza])),
    // F4 · Sin `clickBuff` ni `passiveBuff`: no hay carta, no hay rareza.
    afkCard: 'Raro', clickX2Card: 'Raro', clickX3Card: 'Épico',
    calibrationStone: 'Raro', stabilityNano: 'Legendario', refiningEther: 'Legendario',
    // La rareza de una ranura sale de su posición en la tabla: cuanto más cara,
    // más alta. Es una regla y por eso se calcula; escribirla a mano por carta
    // era otra cosa que hay que acordarse de tocar al añadir una.
    ...Object.fromEntries(COMPANION_SLOT_BUY.map((_, i) => [
      `companionSlot${i + 1}`,
      i >= 1 ? 'Legendario' : 'Épico'
    ]))
  };
  return map[itemKey] ?? null;
}

function descFor(itemKey: string): { what: string; detail: string } {
  // El expansor se genera aquí y no está en `DESCRIPTIONS`, porque su texto lleva
  // el número de su techo y el del siguiente: dos números que antes estaban
  // escritos a mano en la ficha, en el consumible y en la tabla.
  const expansor = expansorDeCarta(itemKey);
  if (expansor) return descDeExpansor(expansor);
  if (DESCRIPTIONS[itemKey]) return DESCRIPTIONS[itemKey];
  return { what: '', detail: '' };
}

/** Estado del producto dentro de la partida. */
function statusOf(itemKey: string, state: any, game: any): { disabled: boolean; reason: string | null } {
  const effSlots = game.getCompanionSlots?.() ?? state.maxCompanionSlots;
  // F97 Lote 2c · SIN LICENCIA NO SE VENDE, Y SE DICE. La T2 y la T3 se
  // enseñan bloqueadas en vez de esconderse: la licencia se compra en el árbol
  // y el jugador tiene que saber que existe. El motivo sale del motor, que es
  // quien cobra; la vista solo lo pinta.
  const motivoLicencia = game.motivoLicenciaCaja?.(itemKey);
  if (motivoLicencia) return { disabled: true, reason: motivoLicencia };
  // F7/F11 · El tope de esta carta sale de la fila de la tabla, no de un `if` por
  // carta. Con tres cartas y tres `if` escritos a mano, añadir la cuarta era
  // acordarse de los tres sitios; con la tabla es una fila.
  const ranura = RANURA_POR_CARTA[itemKey];
  if (ranura && effSlots >= ranura.da) return { disabled: true, reason: 'Comprado' };
  // **UN EXPANSOR AL MÁXIMO SE COMPRA IGUAL, Y LO QUE NO SE PUEDE ES USARLO.**
  //
  // Antes la tarjeta se apagaba con "Pide T{n+1}" y el expansor se salía del catálogo sin
  // explicación: el jugador veía una cosa que no podía comprar y no había forma de saber si
  // era un tope, un error o que le faltaba algo.
  //
  // Ahora **se compra siempre** —el techo lo rechaza `useConsumable` al usarlo, que es donde
  // está el número de verdad— y **el botón sigue enseñando el precio**, como los demás. El
  // aviso de que no va a hacer nada va en la descripción de la tarjeta, no en el botón: el
  // botón es el precio, y taparlo para poner una frase larga es peor que no avisar.
  const expansor = expansorDeCarta(itemKey);
  void expansor;
  // "¿Cabe esta compra?" lo contesta el game loop, que es quien cobra. Preguntar
  // aquí solo por el fullness del almacén apagaba el botón de una caja que sí
  // cabía en la pila de cajas que ya había, y al revés: dejaba encendido lo
  // que `buyStoreItem` iba a rechazar. Una ranura es una pila, no una unidad.
  if (game.canBuyStoreItem?.(itemKey) === false) return { disabled: true, reason: 'Almacén lleno' };
  // **EL BOTÓN NO LLEVA NADA DE ESTO.** Lleva el precio, como los demás, y el motivo de que
  // un expansor al máximo no haga nada va en la descripción de arriba. Ponerlo en el botón
  // —que es donde está el precio— es taparle el precio al jugador para darle una frase que
  // ya tiene justo encima.
  return { disabled: false, reason: null };
}

export function renderStoreTab(
  container: HTMLElement,
  game: any,
  go?: (r: any) => void
) {
  const state = game.getState();
  const discount = state.bonus?.costReduction || 0;
  const cost = (base: number) => Math.floor(base * (1 - discount));

  const category = CATEGORIES.find(c => c.id === ui.category) ?? CATEGORIES[0];

  const card = (itemKey: string) => {
    const item = (STORE_ITEMS as Record<string, any>)[itemKey];
    if (!item) return '';
    // El precio sale del motor (R3): es el mismo número que cobra
    // `buyStoreItem`. La cuenta local queda de reserva.
    const price = game.getStoreUnitCost?.(itemKey) ?? cost(item.cost);
    const canAfford = state.nanites >= price;
    const { disabled, reason } = statusOf(itemKey, state, game);
    // Bloqueado = no se puede comprar por ESTADO, no por falta de dinero.
    // Los dos casos se muestran distintos: el primero explica el motivo, el
    // segundo solo se atenúa.
    const blocked = disabled || !canAfford;
    const rarity = rarityOf(itemKey);
    const isCheap = discount > 0 && Math.floor(item.cost) > price;

    // Nota contextual: el número que cambia con la partida
    let note = '';
    const expansorNota = expansorDeCarta(itemKey);
    if (expansorNota) {
      // **Y SI YA NO HACE FALTA, SE DICE AQUÍ Y NO EN EL BOTÓN.** El botón lleva el precio y
      // sigue encendido —se compra siempre—, así que el aviso va en la descripción, que es
      // donde se lee antes de decidir. Ponerlo en el botón es taparle el precio.
      const tope = state.warehouseCapacity >= expansorNota.maxCap;
      const siguiente = EXPANSOR_TIERS.find(t => t.maxCap > expansorNota.maxCap);
      // **TEXTO PLANO, SIN NADA DE MARCA.** Aquí no se pone `**`: esta nota se pinta con
      // textContent y un asterisco sale tal cual, que es lo que pasaba — se leía "**Ya no hace
      // nada**" con los dos asteriscos dentro—. Las negritas de verdad usan <strong>.
      //
      // **Y LA CAPACIDAD VA DESGLOSADA, QUE ES LO QUE FALTA Y ES LO QUE SE REPORTÓ.**
      // Decía `Capacidad ${state.warehouseCapacity}` y el almacén enseña el **total**, que
      // incluye lo que da el árbol: un expansor Inicial —"vale hasta 60", y llega hasta
      // 60— se leía contra un contador de 69 y la conclusión era que el expansor hacía
      // más de lo que promete. Los dos números son ciertos y son de sumandos distintos.
      // **El desglose sale del motor** (`getCapacityBreakdown`), no de restar aquí:
      // `aggregateBonuses` es quien decide cuánto da el árbol.
      const desglose = game.getCapacityBreakdown?.();
      const delArbol = desglose?.delArbol ?? 0;
      const capacidad = delArbol > 0
        ? `${desglose!.delExpansor}+${delArbol}`
        : `${state.warehouseCapacity}`;
      note = tope
        ? `Capacidad ${capacidad} · vale hasta ${expansorNota.maxCap}. `
          + (siguiente
            ? `Ya no hace nada: se puede comprar, pero para que sirva habría que ampliar `
              + `hasta el ${siguiente.name}, y hasta entonces no se usa.`
            : `Ya no hace nada: es el último tramo y no hay nada por encima.`)
        : `Capacidad ${capacidad} · vale hasta ${expansorNota.maxCap}`;
    } else if (itemKey === 'afkCard') {
      // **LA DURACIÓN Y EL STOCK, LAS DOS.** Esta rama ponía solo "10 min cada una"
      // y hacía sombra a la genérica de "En almacén: N": la tarjeta decía cuánto dura
      // cada una pero no cuántas tienes guardadas, que es justo la pregunta antes de
      // comprar otra. El número sale del motor, como en el resto de cartas.
      const duracion = `${Math.round((game.getAfkDurationMs?.() ?? 600_000) / 60_000)} min cada una · acumulable ×3`;
      const tieneAfk = game.getOwnedCount?.(itemKey);
      note = typeof tieneAfk === 'number'
        ? `${duracion} · En almacén: ${formatNumber(tieneAfk)} ${tieneAfk === 1 ? 'unidad' : 'unidades'}`
        : duracion;
    } else if (itemKey === 'upgradeCrystal') {
      // **LA CARTA ES UN PACK, NO UN CRISTAL, Y HAY QUE DECIRLO.** El botón pone 200 y el
      // jugador veía "Tienes 4.050 · 6 subidas de T1", sin entender que la carta entrega
      // 675 cristales de golpe. Ahora lo primero es el tamaño del pack: "Pack de 675".
      const porPack = game.getStoreItemYield?.(itemKey)?.unidades ?? 0;
      note = `Pack de ${formatNumber(porPack)} ${CRISTAL_PLURAL} · tienes ${formatNumber(state.crystals ?? 0)}`;
    } else if (RANURA_POR_CARTA[itemKey]) {
      // F7/F11 · CUÁNTAS RANURAS ABRE ESTA CARTA, EN EL NÚMERO.
      //
      // El texto no dice "+N": dice cuántas quedan por abrir, restando las que ya
      // tienes. Esa es la cifra que el jugador está decidiendo, y es la que no
      // puede mentir: sale de la misma tabla que el `if` que desactiva el botón y
      // del mismo número que el motor escribe. Antes ponía "+3" escrito a mano
      // cuando el motor daba 5.
      //
      // Y sale del total EFECTIVO, que incluye el árbol: si el árbol ya te dio la
      // ranura 3 y te queda la 4, la tarjeta tiene que decir 1 y no 2, o el
      // jugador paga por algo que ya tiene.
      const compra = RANURA_POR_CARTA[itemKey];
      const actual = game.getCompanionSlots?.() ?? state.maxCompanionSlots;
      const anade = Math.max(0, compra.da - actual);
      const detalle = anade === 1
        ? 'Abre 1 ranura más de escuadrón'
        : `Abre ${anade} ranuras más de escuadrón`;
      note = `${detalle} · Tienes ${actual}`;
    } else {
      // **"EN ALMACÉN: N" PARA TODO LO QUE SE GUARDA.** Antes solo lo decían las dos
      // piedras de forja, y el jugador miraba la caja o la tarjeta AFK sin saber si
      // ya tenía tres guardadas. El número sale del motor (`getOwnedCount`), que es
      // quien tiene el almacén; `null` significa "esta carta no es un objeto
      // contable" y entonces no se enseña nada, que es distinto de un cero.
      const tiene = game.getOwnedCount?.(itemKey);
      if (typeof tiene === 'number') {
        const unidad = tiene === 1 ? singularDeUnidad(itemKey) : pluralDeUnidad(itemKey);
        note = `En almacén: ${formatNumber(tiene)} ${unidad}`;
      }
    }

    return `
      <button class="card-glass border rounded-xl p-3 flex flex-col gap-2 text-left cursor-pointer
                     transition active:scale-[0.98] hover:border-[var(--accent)] ${disabled ? 'opacity-60' : ''}"
              data-info="${itemKey}" aria-label="Ver detalles de ${item.label}">
        <div class="flex items-start gap-2.5">
          <span class="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0
                       ${rarity ? 'ring-' + raritySlug(rarity) : ''}
                       ${rarity ? rarityClass(rarity) : ''} [&>span>svg]:w-4 [&>span>svg]:h-4">
            ${ic(iconFor(itemKey))}
          </span>
          <div class="flex-1 min-w-0">
            <div class="text-[12px] font-bold text-[var(--text-main)] leading-tight">${item.label}</div>
            ${note ? `<div class="text-[9px] font-mono text-[var(--text-muted)] mt-0.5 leading-snug">${note}</div>` : ''}
          </div>
          <span class="text-[var(--text-muted)] opacity-40 flex-shrink-0 -mr-1 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">
            ${ic('info')}
          </span>
        </div>

        <div class="flex items-end justify-between gap-2 mt-auto pt-1">
          <div>
            <div class="font-['Orbitron'] font-bold text-[14px] accent-text tabular leading-none flex items-baseline gap-1">
              ${formatNumber(price)}
              <span class="accent-text text-[10px] not-italic" aria-hidden="true">◆</span>
            </div>
            ${isCheap
              ? `<div class="text-[9px] font-mono text-emerald-400 line-through leading-none mt-0.5">${formatNumber(item.cost)}</div>`
              : `<div class="text-[9px] font-mono text-[var(--text-muted)] mt-0.5">nanitas</div>`}
          </div>
          <!--
            El estado bloqueado viaja en el atributo data-blocked, no en una
            clase. Antes el manejador sniffaba className, así que cambiar el
            estilo de un botón rompía en silencio la lógica de la compra: se
            veía gris pero dejaba comprar.

            El precio también va en el DOM (data-price) y el aspecto sale de
            .store-buy en CSS: la hoja se refresca sin re-pintarse y asi el
            refresco tiene con comparar precio contra saldo.
          -->
          <span class="store-buy text-[10px] font-mono px-2.5 h-8 rounded-lg
                       grid place-items-center flex-shrink-0"
                data-buy="${itemKey}" data-price="${price}"
                ${blocked ? 'data-blocked="1"' : ''}
                ${canAfford && !disabled ? 'data-afford="1"' : ''}
                role="button" tabindex="0"
                aria-label="${item.label}: ${reason ?? (canAfford ? 'Comprar' : 'No alcanza')}">
            ${reason ?? 'Comprar'}
          </span>
        </div>
      </button>
    `;
  };

  // --- Hoja de detalle ---
  const detail = ui.detail ? detailSheet(ui.detail, cost, state, game) : '';

  const body = `
    <!--
      LA FRANJA DE LA TIENDA, Y POR QUÉ NO EMPIEZA POR LAS NANITAS.

      Lo que queda son dos cosas y ninguna es un saldo: cuántas ranuras quedan y cuánto
      descuenta el árbol. La de nanitas estaba y se ha ido a la cabecera.

      **LO QUE JUSTIFICABA TENERLA AQUÍ, Y POR QUÉ YA NO SOBRA.** El botón de la carta
      enseña lo que cuesta, así que para decidir esa compra el saldo no hace falta: la
      carta ya dice si te llega o no. Y cuando sí hace falta —comparar dos cartas— el
      número de arriba es el mismo.
    -->
    ${statStrip([
      { label: 'Almacén', value: `${countOccupiedSlots(state.warehouse)}/${game.getCapacity?.() ?? state.warehouseCapacity}` },
      { label: 'Descuento', value: discount > 0 ? `−${Math.round(discount * 100)}%` : '—', tone: discount > 0 ? 'text-emerald-400' : undefined }
    ])}

    <div id="cat-tabs" class="relative flex gap-1 mb-3 overflow-x-auto pb-1" role="tablist">
      <span id="cat-pill"
            class="absolute top-0 h-10 rounded-lg accent-bg pointer-events-none z-0"
            style="transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1), width 260ms cubic-bezier(0.16, 1, 0.3, 1); will-change: transform"></span>
      ${CATEGORIES.map(c => `
        <button class="relative z-10 px-3 h-10 rounded-lg text-[10px] font-mono flex-shrink-0
                       transition-colors duration-200 cursor-pointer"
                data-cat="${c.id}" role="tab"
                aria-selected="${c.id === ui.category}"
                style="${c.id === ui.category ? 'color:#06121f;font-weight:700' : 'color:var(--text-muted)'}">
          <span class="inline-flex items-center gap-1.5">
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(c.icon as IconName)}</span>
            ${c.label}
          </span>
        </button>
      `).join('')}
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      ${category.items.map(card).join('')}
    </div>

    ${detail}
  `;

  const root = mountInto(container, pageShell({
    title: 'Mercado',
    icon: 'store',
    route: 'tienda',
    state
  }, body));

  wireNav(root, { go });

  // El indicador se posiciona al montar, una vez que el navegador conoce los
  // anchos. Antes que nada se deja fuera de pantalla: si se pinta en 0 y luego
  // se mide, se ve un destello en la esquina.
  positionPill(root, ui.category);
  scrollStripToStart(root, ui.category);

  root.querySelectorAll<HTMLElement>('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.cat === ui.category) return;
      sfx.nav();
      ui.category = btn.dataset.cat!;
      ui.detail = null;
      // La tira se reconstruye en cada render y nace en scroll 0. Se guarda
      // dónde estaba para que el deslizamiento al inicio se vea como una
      // continuación y no como un salto de vuelta al origen.
      const strip = root.querySelector('#cat-tabs') as HTMLElement | null;
      ui.stripScroll = strip?.scrollLeft ?? 0;
      renderStoreTab(container, game, go);
    });
  });

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // El botón "Comprar" vive DENTRO de la tarjeta. Se detiene la propagación
    // para que comprar no abra a la vez la hoja de detalle.
    const buy = target.closest('[data-buy]') as HTMLElement | null;
    if (buy) {
      e.stopPropagation();
      const key = buy.dataset.buy!;
      if (buy.dataset.blocked) {
        sfx.error();
        const st = statusOf(key, game.getState(), game);
        showToast(st.reason ?? 'No te alcanza', 'info');
        return;
      }
      comprarFlujo(game, key, container, go);
      return;
    }

    const info = target.closest('[data-info]') as HTMLElement | null;
    if (info) {
      sfx.pick();
      ui.detail = ui.detail === info.dataset.info ? null : info.dataset.info!;
      renderStoreTab(container, game, go);
      return;
    }

    if ((target as HTMLElement).closest('[data-detail-close]')) {
      sfx.pick();
      ui.detail = null;
      renderStoreTab(container, game, go);
    }
  });

  startAffordabilityWatch(root, game);
}

/**
 * Compra una carta, preguntando cuántas si hay lote (F14 + F12).
 *
 * Con una sola unidad asequible no hay nada que decidir y compra directo, que
 * es el camino de siempre. Si dan las nanitas para más, el diálogo pregunta
 * con el tope honesto (lo que alcanza, del motor) y el total en vivo (también
 * del motor). Al cerrar, lo sorteado se enseña con su modal (F12) y el resto
 * con su aviso.
 */
function comprarFlujo(game: any, itemKey: string, container: HTMLElement, go?: (r: any) => void) {
  const cerrar = (bought: any, units?: number) => {
    if (bought === false) {
      sfx.error();
      showToast('No se pudo completar la compra.', 'error');
      return;
    }
    sfx.buy();
    if (typeof bought === 'object' && bought !== null &&
        (bought.type === 'companion' || bought.type === 'collector')) {
      showPurchaseModal(game, bought, () => renderStoreTab(container, game, go));
      return;
    }
    showToast(units && units > 1 ? `Comprado ×${units}` : 'Comprado', 'success');
    renderStoreTab(container, game, go);
  };

  const max = game.getBulkMax?.(itemKey) ?? 1;
  if (max <= 1) {
    cerrar(game.buyStoreItem(itemKey as any));
    return;
  }
  const label = (STORE_ITEMS as Record<string, any>)[itemKey]?.label ?? itemKey;
  // El sustantivo lo pone el motor, que es quien sabe qué cartas se compran en
  // lote. La vista tenía su propia copia de esa lista —con el mismo
  // `endsWith('Crate')` que ya había fallado una vez en el motor— y con la caja
  // de F31 pasó a decir "elige cuántas **unidad**".
  const unitName = game.getBulkUnitName?.(itemKey) ?? 'unidad';
  // Las unidades totales que entrega el lote, solo para las cartas que dan un recurso
  // (el pack de cristales). Lo dice el motor: 1 unidad entrega `getStoreItemYield`.
  const porUnidad = game.getStoreItemYield?.(itemKey)?.unidades ?? 0;
  const recurso = game.getStoreItemYield?.(itemKey)?.recurso;
  showConfirmModal(
    `Te alcanza para ${max}. Elige cuántas comprar.`,
    (units) => {
      const n = units ?? max;
      cerrar(game.buyStoreItem(itemKey as any, n), n);
    },
    {
      sublabel: label,
      confirmText: 'Comprar',
      quantity: {
        max,
        itemName: label,
        unitName,
        amount: (n) => formatNumber(game.getBulkCost?.(itemKey, n) ?? 0),
        verbo: 'comprar',
        sufijoImporte: ' ◆',
        resumen: porUnidad > 0
          ? (n) => `${n} ${n === 1 ? 'unidad' : 'unidades'} · ${formatNumber(porUnidad * n)} ${recurso ?? 'unidades'}`
          : undefined
      }
    }
  );
}

/**
 * Lo que te tocó al comprar una carta de tier: nombre, poder, rareza y lore.
 *
 * F12. La tarjeta avisa de que "el nombre, el poder exacto y la rareza se
 * sortean al comprarlo", pero al cobrar no pasaba nada visible y la sorpresa
 * había que ir a buscarla al almacén. El modal enseña lo sorteado con la
 * cifra que cobra (el poder del item, no el rango de la tarjeta) y el lore
 * (F13), con la línea de tipo al lado para los compañeros: lo que hace falta
 * para decidir si se equipa.
 *
 * Es un overlay propio y no `showConfirmModal` porque no hay nada que
 * confirmar: es un veredicto, como el cartel de la ruleta, con su CONTINUAR.
 */
function showPurchaseModal(game: any, item: any, onClose: () => void) {
  const esCompanero = item.type === 'companion';
  const ficha = esCompanero
    ? (game.getState().companions as any[]).find((c: any) => c.id === item.id)
    : null;
  const tipo = ficha?.type ?? item.companionType ?? 'click';
  const poder = ficha?.power ?? item.power ?? item.damage ?? 0;
  const lineaPoder = esCompanero
    ? lineaTipoCompanion(tipo, poder)
    : `Da +${item.damage ?? poder} de recolección por click`;
  const lore = lorePara(item.name);

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4 app-bg overflow-y-auto';
  overlay.innerHTML = `
    <div class="card-glass-elevated border ${rarityClass(item.rarity)} rounded-2xl px-6 py-5 flex flex-col items-center gap-2 max-w-sm text-center">
      <div class="mb-1 [&>span>svg]:w-12 [&>span>svg]:h-12 ${RARITY_TEXT[item.rarity] || ''}">${ic(esCompanero ? 'companion' : 'collector')}</div>
      <div class="text-[9px] font-mono uppercase tracking-[0.2em]" style="color: var(--text-muted)">
        ${esCompanero ? 'Nuevo compañero' : 'Nuevo recolector'}
      </div>
      <div class="font-['Orbitron'] font-bold text-base ${RARITY_TEXT[item.rarity] || ''}">${item.name}</div>
      <div class="text-[11px] font-mono tabular accent-text">${lineaPoder}</div>
      <div class="text-[10px] font-mono uppercase tracking-wider ${RARITY_TEXT[item.rarity] || ''} opacity-80">
        ${item.rarity}${item.tier ? ` · Tier ${item.tier}` : ''}
      </div>
      ${lore ? `<div class="text-xs italic mt-1" style="color: var(--text-main)">“${lore}”</div>` : ''}
      <div class="text-[10px] font-mono mt-1" style="color: var(--text-muted)">✓ Guardado en el almacén</div>
    </div>`;
  const btn = document.createElement('button');
  btn.textContent = 'CONTINUAR';
  btn.className = 'px-6 py-2.5 mt-4 accent-bg text-slate-950 font-[\'Orbitron\'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer';
  overlay.firstElementChild?.appendChild(btn);
  document.body.appendChild(overlay);

  const finish = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    onClose();
  };
  btn.addEventListener('click', finish);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish();
  };
  document.addEventListener('keydown', onKey);
}

/** Mueve la píldora de la pestaña activa hasta su botón. */function positionPill(root: HTMLElement, activeId: string) {  const pill = root.querySelector('#cat-pill') as HTMLElement | null;
  const btn = root.querySelector(`[data-cat="${activeId}"]`) as HTMLElement | null;
  if (!pill || !btn) return;
  // Se mide en el siguiente frame, cuando el navegador ya calculó el layout.
  requestAnimationFrame(() => {
    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.transform = `translateX(${btn.offsetLeft}px)`;
  });
  // Respaldo para pestañas ocultas, donde rAF no se dispara
  window.setTimeout(() => {
    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.transform = `translateX(${btn.offsetLeft}px)`;
  }, 60);
}

/**
 * Lleva la pestaña activa al comienzo de la tira.
 *
 * Siete categorías no caben en un móvil: "Compañeros" y "Recolectores" quedan
 * fuera de la vista. Antes la píldora se desplazaba hasta ellas y el jugador
 * veía moverse un resaltado hacia un botón que no tenía delante, sin ninguna
 * pista de qué categoría había abierto.
 *
 * El detalle de continuidad importa: `renderStoreTab` reconstruye la tira en
 * cada cambio de categoría y el nodo nuevo nace con `scrollLeft` en 0. Si solo
 * se pidiese el deslizamiento suave, la tira pegaría un tirón al principio y
 * luego se movería, lo que se lee como un fallo. Por eso primero se restaura
 * la posición anterior de forma instantánea y desde ahí se deja que el navegador
 * anime hasta el origen.
 *
 * Si la tira no desborda (pantalla ancha) no hay nada que desplazar y se
 * respeta la posición actual en lugar de forzar un `scrollTo` inútil.
 */
function scrollStripToStart(root: HTMLElement, activeId: string) {
  const strip = root.querySelector('#cat-tabs') as HTMLElement | null;
  const btn = root.querySelector(`[data-cat="${activeId}"]`) as HTMLElement | null;
  if (!strip || !btn) return;
  if (strip.scrollWidth <= strip.clientWidth) return;
  strip.scrollLeft = ui.stripScroll;
  // `offsetLeft` se mide contra la tira, no contra la ventana, así que sigue
  // siendo la posición del botón dentro del contenido aunque esté desplazado.
  strip.scrollTo({ left: btn.offsetLeft, behavior: 'smooth' });
}

/** Hoja de detalle de un producto. */
function detailSheet(
  itemKey: string,
  cost: (base: number) => number,
  state: any,
  game: any
): string {
  const item = (STORE_ITEMS as Record<string, any>)[itemKey];
  if (!item) return '';
  const price = cost(item.cost);
  const canAfford = state.nanites >= price;
  const { disabled, reason } = statusOf(itemKey, state, game);
  const rarity = rarityOf(itemKey);
  const d = descFor(itemKey);

  return `
    <div class="sheet-overlay z-[60]">
      <div class="absolute inset-0 bg-black/55 pointer-events-auto" data-detail-close></div>
      <div class="sheet-panel card-glass-elevated animate-rise-in">
        <div class="flex items-start gap-3 mb-3">
          <span class="w-12 h-12 rounded-xl grid place-items-center flex-shrink-0
                       ${rarity ? 'ring-' + raritySlug(rarity) : ''}
                       ${rarity ? rarityClass(rarity) : ''} [&>span>svg]:w-6 [&>span>svg]:h-6">
            ${ic(iconFor(itemKey))}
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="font-['Orbitron'] font-bold text-[14px] text-[var(--text-main)] leading-tight">
              ${item.label}
            </h3>
            ${rarity ? `<div class="text-[10px] font-mono mt-0.5 ${rarityClass(rarity)}">${rarity}</div>` : ''}
          </div>
          <button class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                  data-detail-close aria-label="Cerrar">
            <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('close')}</span>
          </button>
        </div>

        <p class="text-[12px] text-[var(--text-main)] leading-relaxed mb-1.5">${d.what}</p>
        <p class="text-[11px] text-[var(--text-muted)] leading-relaxed mb-3">${d.detail}</p>

        <div class="rounded-xl border border-[var(--border-color)] p-3 mb-3 flex items-center justify-between gap-3"
             style="background: color-mix(in srgb, var(--accent) 8%, transparent)">
          <div>
            <div class="label-caps mb-0.5">Precio</div>
            <div class="font-['Orbitron'] font-bold text-lg accent-text tabular flex items-baseline gap-1">
              ${formatNumber(price)}<span class="text-[12px] not-italic" aria-hidden="true">◆</span>
            </div>
          </div>
          <div class="text-right">
            <div class="label-caps mb-0.5">Tienes</div>
            <div class="font-mono text-[12px] text-[var(--text-main)] tabular">
              <span id="store-nanites-sheet">${formatNumber(state.nanites)}</span> ◆
            </div>
            ${(() => {
              // **QUÉ DA ESTA CARTA, Y POR QUÉ NO SE DEDUCE DE LA PRECIO.**
              //
              // Con "Precio 200" y "Tienes 213" al lado, los dos con el mismo símbolo, no
              // hay forma de saber si esos 213 son lo que tienes o lo que te dan. Tras
              // comprar, el saldo sube a 413 y eso tampoco contesta a la pregunta: el
              // jugador se queda con la duda de si compró una unidad o un montón.
              //
              // El número lo pone el motor (`getStoreItemYield()`), que es quien escribe
              // `state.crystals += ...`. Si la vista lo calculara con su propia fórmula,
              // un rebalance dejaría el producto sin cuadrar con el precio (R3).
              //
              // Y solo sale si hay algo que decir: una caja o una ranura no dan un
              // recurso, y teachar "Te da 0" es peor que no teachar nada.
              const y: any = game.getStoreItemYield?.(itemKey) ?? { unidades: 0, recurso: null };
              if (!y || !y.recurso || !(y.unidades > 0)) return '';
              const n = y.unidades;
              return `
                <div class="font-mono text-[10px] text-[var(--text-muted)] tabular mt-0.5">
                  te da ${formatNumber(n)} ${n === 1 ? y.recurso.slice(0, -1) : y.recurso}
                </div>`;
            })()}
          </div>
        </div>

        <button class="store-buy w-full h-12 rounded-xl font-['Orbitron'] font-bold text-[12px] cursor-pointer
                       ${disabled ? 'opacity-50' : ''}"
                data-buy="${itemKey}" data-price="${price}"
                ${canAfford && !disabled ? 'data-afford="1"' : ''}
                ${disabled ? 'disabled' : ''}>
          ${reason ?? 'Comprar'}
        </button>
      </div>
    </div>
  `;
}

// ==========================================================================
//  Refresco de qué se puede comprar
//
//  El mercado se re-pintaba al cambiar de pestaña, al comprar y al abrir o
//  cerrar un detalle. Nunca por tiempo. Y como el saldo decide qué botón está
//  encendido, el efecto era un bloqueo sin explicación: un jugador que se
//  queda esperando a que el ingreso pasivo cubra el precio no podía comprar
//  nunca, porque la página solo se actualizaba al navegar fuera y volver.
//
//  Aquí solo se tocan los atributos data-afford y data-blocked de los botones
//  que ya están en el DOM. No se re-pinta la página, y por eso no se rompen la
//  animación de la pila de pestañas, la hoja de detalle ni el scroll.
// ==========================================================================

/** Cronómetro del refresco. Vive fuera para no dejar ninguno detrás. */
let affordabilityTimer: number | null = null;

/** Periodo del refresco. 400 ms es imperceptible y no satura el DOM. */
const AFFORDABILITY_MS = 400;

/**
 * Pone al día el estado de todos los botones de compra de la hoja.
 *
 * El precio se lee de `data-price` y no se recalcula: el descuento del árbol no
 * cambia entre re-renders, así que el precio del DOM es el bueno, y recalcularlo
 * aquí metería una segunda copia de la regla de descuento en el archivo.
 */
function refreshAffordability(root: HTMLElement, game: any) {
  const state = game.getState();

  root.querySelectorAll<HTMLElement>('[data-buy]').forEach(btn => {
    const key = btn.dataset.buy;
    const price = Number(btn.dataset.price);
    // Sin data-price no hay nada que comparar: se deja como está.
    if (!key || !Number.isFinite(price)) return;

    const { disabled } = statusOf(key, state, game);
    const canAfford = state.nanites >= price;

    if (disabled || !canAfford) btn.setAttribute('data-blocked', '1');
    else btn.removeAttribute('data-blocked');

    if (canAfford && !disabled) btn.setAttribute('data-afford', '1');
    else btn.removeAttribute('data-afford');
  });

  // El saldo aparece dos veces en el mercado: en la franja de arriba y en la
  // hoja de detalle. Las dos se actualizan aquí.
  const value = formatNumber(state.nanites || 0);
  for (const id of ['#store-nanites', '#store-nanites-sheet']) {
    const el = root.querySelector(id);
    if (el) el.textContent = value;
  }
}

/**
 * Arranca el refresco y lo mantiene vivo mientras la hoja esté en pantalla.
 *
 * El temporizador se suicida solo: `root` se recrea en cada re-render y se
 * desconecta del documento al salir del mercado, así que basta con mirar
 * `isConnected`. Es lo único que sobrevive al problema de que `unmount()` no
 * llega a llamarse nunca en este proyecto.
 */
function startAffordabilityWatch(root: HTMLElement, game: any) {
  if (affordabilityTimer !== null) {
    window.clearInterval(affordabilityTimer);
    affordabilityTimer = null;
  }

  affordabilityTimer = window.setInterval(() => {
    if (!root.isConnected) {
      if (affordabilityTimer !== null) window.clearInterval(affordabilityTimer);
      affordabilityTimer = null;
      return;
    }
    refreshAffordability(root, game);
  }, AFFORDABILITY_MS);
}
