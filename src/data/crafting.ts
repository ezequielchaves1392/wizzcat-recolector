// ==========================================================================
// Fusión, autoría y potencial · recolectores y compañeros
//
// Reglas de diseño que sostienen el sistema:
//
//  1. FUSIÓN: **2** recolectores del mismo tier T -> 1 recolector de tier T+1.
//     El número vive en `MATERIALES_POR_FUSION`, y la página de la forja lo lee de
//     ahí en vez de escribirlo.
//
//     **AQUÍ ESTABA EN 3, Y EL MOTOR NUNCA LLEGÓ A TENERLO.** La receta se pasó a
//     dos y solo se actualizó la comprobación del motor; en la página quedaron
//     cinco restos, con lo que **la forja no se podía usar**: los dos huecos del
//     yunque se llenaban y el botón se quedaba inactivo para siempre. El número de
//     materiales de una receta no se escribe en dos sitios. Está escrito aquí el
//     motivo por el que se quedó en 2, porque sigue siendo la decisión viva:
//
//     La razón original de pedir tres era que con dos el jugador solo tiene una
//     decisión binaria, y con tres elige **cuáles** tres. **Esa razón ya no se
//     sostiene**: desde que los afijos los deciden los padres **en cantidad además
//     de en cuáles** (`rangoDeAfijosForjados()`), elegir dos materiales buenos es
//     una decisión con peso, no una moneda. Y tres materiales además de tres
//     confirmaciones y un yunque de tres huecos es más fricción de la que vale.
//
//  2. AUTORÍA: todo recolector crafteado registra quién la forjó. Es lo que hace que
//     dos recolectores del mismo tier no sean el mismo objeto. Un recolector de otro
//     jugador vale más en el mercado, pero no rinde más: son dos ejes separados.
//
//  3. POTENCIAL: 1..5 estrellas, determinado por la rareza de los materiales,
//     su nivel y el uso de Piedras de Calibración. El potencial sube el techo
//     de nivel (20 normal, hasta 35 con 5 estrellas) y multiplica el valor:
//     es lo que hace que un recolector crafteado sea claramente superior a una de
//     tienda del mismo tier.
//
//  4. HERENCIA: la nueva recolector conserva 1..3 afijos de los materiales. Con
//     más estrellas, más afijos. Los afijos se eligen al azar del pool, pero
//     con pesos: los raros pesan menos.
//
//  5. IDENTIDAD: cada recolector conserva quién la forjó, para que el objeto sea
//     único y el mercado tenga historia. Un recolector hecha por alguien conocido
//     vale más en la tienda, pero rinde lo mismo en tu daño: son dos ejes
//     separados a propósito, para que la fama no se compre con dinero.
//
//  6. COMPENSACIÓN POR FALLO: al fallar se pierden los dos materiales, pero
//     se ganan cristales proporcionales al tier. Sin esto, una racha mala
//     vacía el almacén y el jugador deja de intentarlo; con esto, cada fallo
//     acerca un poco la garantía del siguiente intento.
// ==========================================================================

import type { Affix, Rarity, CollectorItem } from '../types/domain';
import { RARITY_ORDER } from '../types/domain';
import { rangoDePoder, rarezaDeTier, TIER_SYSTEM } from './tiers';
import { nombreDe } from './nombres';
// `costeDeCaja` es de la tienda, y la flecha va de aquí hacia allí. **No crea ciclo
// porque `store.ts` no importa nada**: es el fichero más abajo del árbol de datos, y
// esta es la primera vez que se le pide un número desde las reglas de la forja.
import { costeDeCaja } from './store';
import {
  PIEDRA_APORTA, PIEDRA_PUNTOS, pctDe,
  PROB_NANO_SUBE_RAREZA, PROB_SUBE_POTENCIAL, BONO_ETTER
} from './constants';
// F74 · LAS BASES OCULTAS: importamos el multiplicador y el buscador.
import { multiplicadorDeBase, basePorId, basePorPosicion, posicionFusionada, posicionDeBase, baseAleatoriaSegura, BaseOculta } from './bases';

// --------------------------------------------------------------------------
// Atributos
// --------------------------------------------------------------------------

// ==========================================================================
//  Atributos
//
//  **NINGÚN afijo da daño plano, y no es una preferencia de redacción.** Cuatro de
//  ellos lo hagan (`flatDamage` / `flatPassive`: +60, +40, +8 y +18) y rompen
//  items de tier bajo sin avisar: un "+60 de daño plano" en un T1, cuya base es 5,
//  más que triplica el item. Y no se ve en el banco, porque el banco comprueba
//  que el afijo exista, no que el item al que se lo pone siga siendo razonable.
//
//  Por eso TODOS son porcentajes, o porcentajes por nivel. Un +35% da 1,75 en un
//  T1 y 238 en un T10: escala con el item, no lo rompe. Los que dependen del
//  nivel (`clickMultPorNivel`, `passiveMultPorNiveles`) también son porcentajes,
//  así que subir de nivel sigue valiendo pero nunca se sale del item.
// ==========================================================================

export const AFFIXES: Affix[] = [
  { id: 'aff_sharp', name: 'Afilado', description: '+18% a la recolección por click.', rarity: 'Raro',
    effect: { clickMult: 0.18 } },
  { id: 'aff_rapid', name: 'Cadencia', description: '+12% a la recolección por click.', rarity: 'Raro',
    effect: { clickMult: 0.12 } },
  { id: 'aff_yield', name: 'Rendimiento', description: '+20% a la recolección por segundo.', rarity: 'Raro',
    effect: { passiveMult: 0.20 } },
  { id: 'aff_flow', name: 'Flujo', description: '+14% a la recolección por segundo.', rarity: 'Raro',
    effect: { passiveMult: 0.14 } },
  { id: 'aff_bulwark', name: 'Baluarte', description: '+35% a la recolección por click.', rarity: 'Épico',
    effect: { clickMult: 0.35 } },
  { id: 'aff_core', name: 'Núcleo', description: '+25% a la recolección por segundo.', rarity: 'Épico',
    effect: { passiveMult: 0.25 } },
  { id: 'aff_crit', name: 'Crítico', description: '+8% de probabilidad de crítico (×2 a la recolección por click).', rarity: 'Épico',
    effect: { critChance: 0.08 } },
  { id: 'aff_focus', name: 'Foco', description: '+14% de probabilidad de crítico.', rarity: 'Legendario',
    effect: { critChance: 0.14 } },
  // **`aff_luck` YA NO ESTÁ, Y EL PORQUÉ QUEDA ESCRITO.** Era "Suerte de Forja:
  // +10 % a la probabilidad de crafteo", y ese +10 % no lo leía ningún cálculo:
  // `equippedAffixEffect()` y `efectoDeAfijos()` no leen `craftLuck`, y la suerte
  // que la forja sí cobra sale del NÚMERO de afijos de los materiales (+2 % cada
  // uno en `tiraDeForja()`), no de este id. El único lector de su efecto era la
  // valoración (precio), así que el afijo se cobraba y no hacía nada en la
  // partida —la misma clase que `crateLuck` antes de B18—, con el agravante de
  // que invitaba al swap (ponerlo solo para tirar). La migración lo quita de los
  // items guardados; lo que ya filtraba ids desconocidos lo ignora igual.
  { id: 'aff_ephemeral', name: 'Efenéreo', description: '+35% a ambos multiplicadores.', rarity: 'Legendario',
    effect: { clickMult: 0.35, passiveMult: 0.35 } },
  { id: 'aff_eternal', name: 'Eterno', description: '+2% a la recolección por click por cada nivel del recolector.', rarity: 'Mítico',
    effect: { clickMultPorNivel: 0.02 } },
  { id: 'aff_absorb', name: 'Absorción', description: '+5% a la recolección por segundo por cada 5 niveles.', rarity: 'Mítico',
    effect: { passiveMultPorNiveles: 0.05 } },
  { id: 'aff_prime', name: 'Primo', description: '+55% a todos los multiplicadores del recolector.', rarity: 'Mítico',
    effect: { clickMult: 0.55, passiveMult: 0.55 } },
  { id: 'aff_void', name: 'Vacío Devorador', description: '+25% a la recolección por click y por segundo, +10% crítico.', rarity: 'Divino',
    effect: { clickMult: 0.25, passiveMult: 0.25, critChance: 0.10 } }
];

export const AFFIX_BY_ID: Record<string, Affix> = Object.fromEntries(AFFIXES.map(a => [a.id, a]));

/**
 * EL POOL DE AFIJOS DE COMPAÑERO (F97 Lote 2d).
 *
 * El mismo catálogo menos los de crítico puro (`aff_crit`, `aff_focus`): un
 * compañero no critica, así que sortearle un afijo que solo da crítico sería
 * sortearle un hueco vacío. Una sola lista para el sorteo, la migración y el
 * banco: tres filtros escritos a mano son tres ocasiones de que uno incluya lo
 * que los otros quitan.
 */
export const POOL_AFIJOS_COMPANERO: Affix[] = AFFIXES.filter(a => a.id !== 'aff_crit' && a.id !== 'aff_focus');

/**
 * EL MULTIPLICADOR DE CRÍTICO, Y POR QUÉ ES UN NÚMERO Y NO PARTE DE CADA AFIJO.
 *
 * Las tres descripciones que lo prometen dicen "×2 daño". Si el ×2 viviera dentro de
 * cada `effect`, un futuro afijo con ×3 cumpliría su texto y rompería la promesa de
 * los otros dos sin que nadie lo viera: tres números iguales en tres sitios son tres
 * ocasiones de que uno deje de serlo. Aquí hay uno solo, y el motor lo multiplica.
 */
export const MULTIPLICADOR_CRITICO = 2;

/** Techo de nivel de un recolector que no lo trae: los de la tienda. */
export const BASE_COLLECTOR_MAX_LEVEL = 20;

/**
 * EL TOPE DE POTENCIAL, EN ESTRELLAS. Lo exporta porque **un logro necesita compararse
 * con él** y antes no había con qué: `Math.min(5, …)` estaba escrito a mano en media
 * docena de sitios (`preview.ts`, la fusión, la RTP de las piedras, el cálculo de
 * afinidad) y el número solo aparecía dentro de una operación.
 *
 * **Y NO ES `AFIX_MAX`.** Ese es el tope de *afijos* —los modificadores que salen de la
 * forja— y son 6. Confundir los dos da un logro que **nadie puede completar**: el
 * potencial se queda en 5 estrellas y un `potential >= 6` no llega nunca, sin error y sin
 * aviso. Los dos topes conviven a veinte líneas de distancia, que es exactamente por lo
 * que este comentario hace falta.
 *
 * Sustituir los `Math.min(5, …)` sueltos por este nombre es trabajo de otro commit, y
 * está anotado en `PENDIENTES.md`.
 */
export const POTENTIAL_MAX = 5;

/** Cuántos niveles extra da cada estrella de potencial. */
const MAX_LEVEL_PER_POTENTIAL = 3;

/**
 * El techo de niveles de un recolector.
 *
 * Recibe el `maxLevel` del item y no el item entero. Una razón es que la regla es
 * sobre un número y no necesita conocer la forma del item. La otra es la que
 * cuesta: `{ maxLevel?: number }` es un *weak type* —todos sus campos opcionales—
 * y TypeScript rechaza con TS2559 cualquier objeto que no comparta ninguna
 * propiedad con él, así que un `WarehouseItem` no se le puede pasar ni con el
 * tipo bien puesto.
 *
 * POR QUÉ ESTA FUNCIÓN Y NO UN `?? 20` EN CADA SITIO. El techo se escribía a mano
 * en cinco sitios y los cinco no coincidían: la ficha del almacén, el panel del
 * jugador, la valoración y el desglose usaban `item.maxLevel ?? 20`, el game loop
 * comparaba contra una constante de 20 y el selector de cristales contra un 35 a
 * pelo. De ahí dos bugs que no se parecían: un recolector forjado con techo 28
 * llegaba al 20 y el juego respondía "ya no puedes" mientras la barra de la ficha
 * seguía llegando a 28; y un recolector de la tienda en su nivel 20 abría el
 * selector, gastaba el cristal y le rechazaban la sintonización.
 *
 * El techo pertenece a la MISMA regla que lo crea —`maxLevel: 20 + potencial * 3`
 * más abajo en este mismo fichero—, así que vive aquí y lo leen el motor y las
 * vistas por igual. Una regla compartida escrita cinco veces no está compartida:
 * está copiada, y las copias divergen.
 *
 * Si el item no trae `maxLevel` es que viene de la tienda, y esos topan en 20. Un
 * `maxLevel` de 0 o negativo también cae al de base: es dato corrupto, y tratarlo
 * como "techo cero" dejaría al recolector sin poder subir nunca.
 */
export function collectorMaxLevel(maxLevel?: number | null): number {
  if (typeof maxLevel === 'number' && maxLevel > 0) return maxLevel;
  return BASE_COLLECTOR_MAX_LEVEL;
}

/**
 * EL TECHO DE NIVEL MIRA POTENCIAL Y BASE (F74, DECISIÓN 1).
 *
 * `20 + potencial × 2 + posición × 0,5`, hacia abajo. Baja el peso del potencial
 * de ×3 a ×2 a propósito: la base es el eje nuevo y si el techo no la mirara,
 * invertir en una base buena no rendiría nada. El ×0,5 es suave porque la base
 * solo mueve ±10%: si contara igual que el potencial, una base buena en un ★1
 * superaría a una floja en un ★5. Sin posición (item que no la trae) cuenta 6,
 * la neutra de ×1,00 —igual que `posicionFusionada()`—.
 *
 * Vive aquí y se aplica donde nace el item (generación, forja, migración); el
 * getter `collectorMaxLevel()`/`nivelMaximoDeCompanio()` solo lee lo guardado.
 */
export function techoDeNivel(potencial: number | undefined | null, posBase: number | undefined | null): number {
  const p = potencialNormalizado(potencial ?? undefined);
  const b = Math.min(10, Math.max(1, Math.floor(Number(posBase) || 6)));
  return Math.floor(BASE_COLLECTOR_MAX_LEVEL + p * 2 + b * 0.5);
}

/**
 * LOS CRISTALES SON UN RECURSO, Y POR QUÉ LA REGLA DE PRECIO SE ESCRIBE ASÍ
 *
 * ANTES. El cristal era un item del almacén con **diez niveles**: Cristal de Afino,
 * Cristal Rúnico, Cristal Primordial. Cada nivel tenía su propio multiplicador de
 * probabilidad (`power` de 1 a 6), así que gastar un T5 era "mejorar con más
 * probabilidades" y gastar un T1 era "mejorar con menos probabilidades". F26
 * obligaba además a que el cristal fuera **del mismo nivel que el item**, con lo que
 * la pregunta del jugador se convertía en una cuenta y no en una decisión.
 *
 * AHORA. **Un recurso, un número, sin nivel.** Como no hay nivel, el coste tiene que
 * salir de otro sitio, y sale del sitio que el juego ya usa para decir cuánto vale un
 * objeto de un nivel: el precio de la caja de ese nivel.
 *
 *     valor de un cristal de nivel n  =  costeDeCaja(n)
 *     nivel n del nivel k de un item  =  valor(n) * 1,26^k
 *
 * LA PROPIEDAD QUE HACE QUE ESTO NO SEA UN NÚMERO INVENTADO
 * -------------------------------------------------------
 * **Una caja de nivel n da exactamente los mismos intentos de mejora que daba antes.**
 *
 * Antes: la caja de nivel n soltaba `rand(3n, 5n)` cristales de nivel n, y un
 * cristal era un intento. O sea que daba entre 3n y 5n intentos.
 *
 * Ahora: suelta `rand(3n, 5n) × valor(n)` unidades, y el primer nivel de un item de
 * nivel n cuesta `valor(n)`. Se divide y queda lo mismo.
 *
 * Y la cuenta no se puede torcer por el redondeo porque **los dos lados llevan el
 * mismo factor**: el precio viejo de un intento de nivel k era `1,2 × 1,26^k`, y el
 * nuevo es `valor(n) × 1,26^k`. La curva es la misma con un factor delante, así que
 * un item de nivel n completo cuesta en el nuevo sistema exactamente lo mismo que
 * costaba en el viejo, en número de cajas.
 *
 * EL PRECIO DE LA CAJA Y NO OTRO NÚMERO
 * -------------------------------------
 * Porque el precio de la caja es **el único número del juego que ya significa "cuánto
 * vale un objeto de este nivel"**. Poner un 500 ahí, o un 12, sería inventar una
 * economía nueva y dejaría el coste de mejora sin ninguna relación con el precio de
 * las cajas, que es lo que el jugador usa para decidir.
 *
 * Y sale con una frase que no hay que recordar: **un cristal vale lo que una caja**.
 * Si el coste de subir un T1 a nivel 1 es el precio de una caja T1, entonces el jugador
 * puede leer su propio progreso: "me falta una caja" es literalmente lo que dice el
 * número.
 */

/**
 * Cuánto vale un cristal del nivel dado, en unidades del recurso único.
 *
 * **ES LA MISMA FUNCION QUE EL COSTE DEL PRIMER NIVEL, Y NO HAY SEGUNDA.** Se podría
 * escribir al revés, con una que llama a la otra, pero entonces habría dos nombres
 * para el mismo número y el día que una cambiara la otra no se enteraría. Aquí hay
 * una función y dos usos.
 *
 * Vive en `crafting.ts` y no en `items.ts` porque depende de `costeDeCaja()`, que es
 * de la tienda: la flecha va de las reglas de la forja hacia los precios, que es el
 * mismo sentido que ya tiene.
 */
export function valorDeUnCristal(tier: number): number {
  const n = Math.max(1, Math.floor(Number(tier) || 1));
  return costeDeCaja(n);
}

/**
 * UNIDADES QUE CUESTA SUBIR DEL NIVEL `nivel` AL SIGUIENTE UN ITEM DE TIER `tier`.
 *
 * **ES LA FUNCIÓN DE ARRIBA CON UN FACTOR DEL TIER DELANTE, Y POR QUÉ EL FACTOR
 * ESTÁ DENTRO Y NO FUERA.** El coste tiene dos ejes porque hay dos cosas que
 * suben: el **nivel**, que es la curva de siempre (`1,26^nivel`), y el **tier del
 * item**, que es el valor de un cristal de ese nivel.
 *
 * Podría escribirse `valorDeUnCristal(tier) * collectorUpgradeCost(nivel)` y sería
 * casi lo mismo, pero no es lo mismo: `collectorUpgradeCost` trae un `1,2` delante
 * que con un valor de 675 es ruido de redondeo, y con uno de 145.388 se pierde en
 * la cuarta cifra. Traer solo el factor `1,26` deja la curva exactamente donde
 * estaba.
 *
 * **Y EL `max(1, …)` DE ABAJO ES PARA QUE UN ITEM DE TIER 0 NO CUESTE NADA.**
 * Un item sin nivel guardado —una partida vieja, un item de la tienda— tiene tier 0, y
 * `costeDeCaja(0)` está recortado a 1 para no leer `undefined`; sin ese suelo el
 * motor aceptaría una mejora gratuita. Que el suelo sea 1 y no el del T1 es a
 * propósito: el tier 0 no existe de verdad, así que no tiene que costar su precio
 * exacto, solo que no sea gratis.
 */
export function costeDeNivel(tier: number, nivel: number): number {
  const curva = Math.pow(1.26, Math.max(0, Math.floor(Number(nivel) || 0)));
  return Math.max(1, Math.round(valorDeUnCristal(tier) * curva));
}

// --------------------------------------------------------------------------
// Probabilidad de éxito
// --------------------------------------------------------------------------

/**
 * La BASE de recolección de un tier: el daño de un item antes de que el
 * potencial le sume nada.
 *
 * Es el mínimo del rango que ya tenía cada tier, y no un número nuevo: así el
 * precio de la carta, que se calibró contra ese rango, y el daño del item salen
 * del mismo sitio (R2). `rangoDePoder` pasa a ser la referencia de precio y la
 * tabla que el jugador ve, y el daño sale de aquí.
 *
 * Y hay que subirla un poco, y el motivo es la única cosa rota que traen los
 * multiplicadores: **con la base en el mínimo del rango, los tiers se solapan**.
 * El T1 va de 6 (★1) a 10 (★5) y el T2 de 10 (★1) a 16 (★5), así que un T1
 * perfecto iguala a un T2 normal, y "más tier es más daño" deja de ser cierto.
 * Compra por probabilidad, no por tier.
 *
 * Por eso se sube un 20% la base de cada tier por encima del mínimo del rango:
 * el T1 pasa a 7-14 y el T2 a 11-22, y ahora **el peor T2 supera al mejor T1**.
 * Que la progresión sea legible vale más que encajar el daño con una tabla que
 * estaba calibrada cuando el daño no tenía azar.
 */
export function baseDeTier(tier: number): number {
  const t = Math.max(1, tier);
  const minT1 = rangoDePoder(1)[0];
  // Razón por tier. El rango crece ×1,62, que es MENOS de 1,67, y como el
  // potencial llega a ×2,0 dos tiers atrás empatan con este de aquí. Con 1,75
  // hay separación real, y la progresión se lee: subir de tier siempre mejora,
  // potential o no.
  const RAZON = 1.75;
  const ideal = minT1 * Math.pow(RAZON, t - 1);
  if (t === 1) return Math.round(ideal);
  // El `+1` es para el redondeo. En los tiers bajos —donde los números son de
  // una o dos cifras— 18 redondeados se empatan con 18 redondeados, y eso es un
  // empate real, no un detalle de la tabla: sin él un T3 con ★1 igualaría a un
  // T2 con ★5 y volvería a comprarse por potencial en vez de por tier.
  const minimo = baseDeTier(t - 1) * 2 + 1;
  return Math.max(Math.round(ideal), minimo);
}

/**
 * El daño BASE de un item: su base de tier por el potencial.
 *
 * Cada estrella es un 20%, y **el potencial 1 ya es +20%** — o sea que ★5 es
 * exactamente el doble de la base, que es la perfección del 100%. El ejemplo que
 * lo fija: base 5 con ★5 da 10.
 *
 *   ★1 = ×1,2 · ★2 = ×1,4 · ★3 = ×1,6 · ★4 = ×1,8 · ★5 = ×2,0
 *
 * **Esto es el daño del item, no el del click.** Sobre él siguen actuando el
 * nivel (los cristales), la rareza y los afijos. Aquí no hay ninguno de esos, y
 * deliberadamente: el potencial es la ÚNICA escala que multiplica la base, y por
 * eso no lleva además un segundo multiplicador encima — ese error sí estaba, y
 * por eso el potencial nunca llegaba a ×2.
 *
 * **Consecuencia de balance:** como esto es un multiplicador y el rango viejo no
 * lo era, el techo de daño de cada tier **se multiplica por 2**. El T5 pasa de un
 * rango de 34-50 a una base de 34 que con ★5 da 68. Las proporciones entre tiers
 * se conservan porque todos se mueven igual, pero el precio por punto baja en
 * todos a la vez, y `balanceCheck` mide esa banda.
 */
/**
 * EL DAÑO BASE DE UN ITEM: SU BASE DE TIER POR EL POTENCIAL Y LA BASE OCULTA.
 *
 * **EL PEDIDO DEL JUGADOR: "PRIMERO CALCULAMOS LA BASE Y DPS LE APLICAMOS POTENCIA Y NIVELES".**
 *
 * La fórmula es:
 *   daño = baseDeTier(tier) × multiplicadorDeBase(base) × (1 + 0.2 × potencial) × multiplicadorDeNivel(nivel)
 *
 * **LA BASE ES EL EJE DE LA CAZA:** cada base tiene un `pesoStat` de 0.92 a 1.10.
 * El potencial (★1..★5) multiplica ×1.2 .. ×2.0. El nivel multiplica al final.
 *
 * **POR QUÉ EL PARÁMETRO `base` ES OPCIONAL:** La migración de partidas viejas
 * llama a esta función sin conocer la base oculta del item (los items viejos
 * no la traen). En ese caso se usa 1.0 (la media), y `migraPotenciales()` recalcula
 * el daño real cuando carga la partida. Los items forjados **sí** pasan su base.
 */
export function danioDeRango(
  tier: number,
  potential: number,
  base?: BaseOculta | number | null
): number {
  const baseStat = typeof base === 'number' ? base : base?.pesoStat ?? 1.0;
  return Math.round(
    baseDeTier(tier) *
    baseStat *
    (1 + 0.2 * potencialNormalizado(potential))
  );
}

/** El potencial entero 1..5, para que nadie tenga que repetir el recorte. */
export function potencialNormalizado(potential: number | undefined): number {
  const p = Math.round(Number(potential));
  return Number.isFinite(p) && p >= 1 && p <= 5 ? p : 3;
}

/**
 * EL POTENCIAL DE UN ITEM FUSIONADO: LA MEDIA DE LOS MATERIALES.
 *
 * **LA USA LOS DOS, Y POR QUÉ NO ESTÁ ESCRITA DOS VECES.** El recolector y el
 * compañero heredan su calidad de la media de sus dos materiales, y esa es la
 * regla que hace útil la forja. Escrita en los dos sitios, un día una redondea
 * distinto de la otra y el jugador forja un par de recolectores y se encuentra
 * con un compañero que no se parece en nada.
 *
 * **CADA LLAMANTE RESUELVE SUS PROPIOS MATERIALES ANTES DE LLAMAR.** El
 * recolector infiere el potencial del daño cuando no lo tiene guardado —hay
 * items viejos que no lo traían—, y el compañero lo tiene en la ficha. Aquí solo
 * entra una lista de números.
 *
 * **Y EL EMPATE SUBE, QUE ES LO QUE HACE ESTA FUNCIÓN Y NO OTRA.**
 * `Math.round(4,5)` es 5 en JavaScript, así que **fusionar un 4 con un 5 puede
 * dar un 5**. No es un descuido: es lo que hace `Math.round`, y el día que se
 * puso nadie se paró a mirarlo. Las dos consecuencias:
 *
 * - Un 4 solo es material de fusión de un 5, nunca de un 5 con otro 5 —porque
 *   eso da 5 y habrías perdido el 4 por nada.
 * - Un compañero con potencial 4 no tiene a quién fusionarse sin perderlo.
 *
 * Si algún día esto se cambia a redondear hacia abajo, es **esta línea**, y las
 * pruebas que la fijan están en `forjaCheck`. Con 5, 5 sale 5 y con 3, 3 sale 3:
 * eso no cambia con ninguna de las dos reglas.
 */
export function potencialFusionado(pots: Array<number | undefined>): number {
  if (pots.length === 0) return 3;
  // `undefined` entra y `potencialNormalizado()` lo pone a 3, que es lo que hace
  // con cualquier valor fuera del 1..5: un material sin potencial se funde como
  // uno normal, y no se inventa nada.
  const medio = pots.reduce<number>((a, p) => a + potencialNormalizado(p), 0) / pots.length;
  return Math.max(1, Math.min(5, Math.round(medio)));
}

/**
 * LAS ESTRELLAS DE UN ITEM, SIEMPRE 1 A 5.
 *
 * **POR QUÉ ESTA FUNCIÓN Y NO UN `? '★'.repeat(...)` EN CADA PANTALLA.** Porque el
 * bug era justo ese: siete sitios pintaban `${item.potential ? estrellas : ''}`, y
 * un item **sin** potencial —o con un 0— se pintaba **sin ninguna estrella**. No
 * como cero estrellas: como si no tuviera potencial. Y eso es peor que mentir por
 * una unidad, porque un item sin estrellas parece un item viejo o malgenerado, y
 * el jugador lo descarta sin mirar el daño.
 *
 * La diferencia se ve en el caso real: un recolector con daño 5 y potencial 3 se
 * pintaba sin nada, y otro con daño 8 y potencial 3 se pintaba con tres. El jugador
 * los comparaba y no veía ninguna diferencia, cuando uno pega un 60 % más.
 *
 * `potencialNormalizado` es la que hace el trabajo: un potencial ausente, un 0, un
 * 7 o una cadena son todos el mismo caso, y ese caso es ★3. Que se pinte ★3 es
 * decir la verdad, porque después de `migraPotenciales()` el daño de ese item es
 * el de ★3.
 *
 * **Y NINGÚN BANCO PODRÍA HABERLO VISTO.** La lógica estaba en las plantillas, que
 * no se ejecutan: `verify/` prueba el motor, no el HTML. Por eso esta función
 * existe, y por eso los siete sitios la llaman.
 */
export function estrellasDe(potential: number | undefined): string {
  return '★'.repeat(potencialNormalizado(potential));
}

/** Cuántas estrellas tiene, como número. Para leer el techo y las comparaciones. */
export function estrellasNumeroDe(potential: number | undefined): number {
  return potencialNormalizado(potential);
}

/**
 * El potencial Y el daño de un item viejo, siempre de acuerdo entre sí.
 *
 * Va al revés que `danioDeRango` a propósito: se usa para lo que ya estaba
 * guardado antes de que existiera el campo del potencial.
 *
 * **POR QUÉ DEVUELVE LOS DOS Y NO SOLO EL POTENCIAL.** Porque el potencial sin el
 * daño no sirve de nada: si un item tiene ★3 y su daño no es el de ★3, entonces
 * **la estrella miente**. Y una estrella que miente es peor que no tener
 * estrellas, porque el jugador compara dos items por un número que no es el que
 * pinta. Devolver los dos juntos hace que sea imposible separarlos.
 *
 * **EL POTENCIAL ES EL MÁS CERCANO, Y A EMPATES EL MENOR.** Lo segundo evita el
 * regalo: si dos potenciales dan el mismo error, gana el menor, así que un empate
 * nunca **sube** a nadie. Redondear siempre hacia arriba sería un regalo
 * silencioso a todo el que juega desde antes del campo.
 *
 * **LO PRIMERO NO ES «EL CAMBIO MÁS PEQUEÑO», Y HAY QUE DECIRLO.** Elegir el más
 * cercano limita el movimiento a **medio escalón**, pero no lo deja en cero: la
 * base de cada tier subió un 20 % sobre el mínimo del rango viejo y el potencial
 * la multiplica hasta ×2, así que el suelo nuevo queda **por encima** de casi todo
 * lo que había. Concretamente, un recolector T3 del juego viejo iba de 13 a 19 y
 * el suelo nuevo es 28: **casi todos los items viejos suben**, y en el T3 es de
 * unos 15 a 28.
 *
 * Eso no lo decide esta función, lo decidió F33 al subir la escala, y aquí solo se
 * aplica a lo que se guardó antes. La alternativa —dejar el daño viejo y que las
 * estrellas sean una aproximación— deja **un item con ★3 que pega como un ★1**,
 * que es justo lo que hay que arreglar. Corregir el dato para que cumpla la regla
 * es mejor que dejar la regla rota, pero **es una subida de daño para las partidas
 * viejas y es una decisión de balance, no un detalle de migración**: está escrita
 * en PENDIENTES.md para que sea visible y para que el sitio donde se revierte, si
 * algún día toca, sea esta función.
 */
export function potencialYDanoDe(
  tier: number, damage: number
): { potential: number; damage: number } {
  const d = Number(damage);
  if (!Number.isFinite(d) || d <= 0) {
    return { potential: 3, damage: danioDeRango(tier, 3) };
  }
  let potential = 3;
  let mejorError = Infinity;
  for (let p = 1; p <= 5; p++) {
    const error = Math.abs(danioDeRango(tier, p) - d);
    // `<` y no `<=`: a igualdad de error se queda con el potencial MENOR, y así
    // un empate nunca sube a nadie.
    if (error < mejorError) {
      mejorError = error;
      potential = p;
    }
  }
  return { potential, damage: danioDeRango(tier, potential) };
}

/**
 * El daño que explica el que un item YA tiene.
 *
 * Envoltorio delgado sobre `potencialYDanoDe()`, porque la regla tiene que vivir
 * en un sitio. La mitad del daño se tira aquí a propósito: quien solo lee el
 * potencial no debe tener a mano una cifra que no ha recalculado.
 */
export function potencialDeDanio(item: CollectorItem): number {
  return potencialYDanoDe(item.tier, item.damage ?? 0).potential;
}

/**
 * El potencial que trae un item, deducido del daño si no lo trae.
 *
 * Los items viejos no tienen el campo, y ponerles un 3 a pelo cambiaría su
 * daño al punto medio al abrir la partida —eso sí sería tocarle el progreso al
 * jugador. Deducirlo del daño que ya tienen los deja intactos.
 *
 * **ESTO SOLO LEE. Quien vaya a ESCRIBIR tiene que usar `migraPotenciales()`**,
 * que además deja el daño de acuerdo con el potencial. Un item con el potencial
 * deducido y el daño viejo es un item que miente por la pantalla.
 */
export function potencialDe(item: CollectorItem): number {
  const p = item.potential;
  return typeof p === 'number' && p >= 1 && p <= 5 ? p : potencialDeDanio(item);
}

/**
 * Todo recolector con daño tiene potencial, y su daño es el de su potencial.
 *
 * **ES LA MIGRACIÓN, Y ES POR QUÉ EL CAMPO NO ES OPCIONAL.** El potencial apareció
 * después que los items, así que hay partidas guardadas con recolectores sin el
 * campo. `potencialDe()` ya los leía como ★3 sin más, y eso era una mentira
 * silenciosa: un item con daño 5 se pintaba ★3, y ★3 valen 8. El jugador comparaba
 * dos items por un número que no era el de las estrellas.
 *
 * Aquí se escribe el campo **y se recalcula el daño para que cuadre**, que es lo
 * único que hace que las estrellas sean verdad. Cada item se mueve como mucho medio
 * escalón, porque `potencialYDanoDe()` elige el potencial más cercano.
 *
 * **PERO «COMO MUCHO MEDIO ESCALÓN» NO ES «CASI NADA».** La escala nueva está por
 * encima de la vieja en casi todos los tiers —un T3 del juego viejo iba de 13 a
 * 19 y el suelo nuevo es 28—, así que **esta migración sube el daño de los items
 * viejos**. Es aplicar la regla a datos que se guardaron antes de que existiera, y
 * no un retoque: está anotado en PENDIENTES.md porque es decisión de balance y
 * porque el sitio donde se revierte, si algún día toca, es esta función.
 *
 * **COMPRUEBA TAMBIÉN LOS QUE YA LO TIENEN.** Una partida guardada a medio camino
 * de una versión intermedia puede traer un ★5 con el daño de un ★1, y eso no lo
 * arregla esperar a la próxima carga. Cuesta una comparación.
 *
 * **Y DEVUELVE EL MISMO ARRAY CUANDO NO HAY NADA QUE HACER**, para que el
 * llamante pueda usarlo como prueba de "esto no se ha tocado".
 */
export function migraPotenciales(items: any[], rng: () => number = Math.random): { items: any[]; changed: boolean } {
  let changed = false;
  const salida = items.map((w) => {
    if (w?.type !== 'collector') return w;
    const tiene = typeof w.damage === 'number' && Number.isFinite(w.damage) && w.damage > 0;

    // F74 · LA BASE SE SORTEA Y EL DAÑO SE RECALCULA (decidido por el jugador).
    // Un item sin base válida recibe una de su tabla con sus pesos y su daño
    // pasa por ella: los números se mueven ±10% y la caza vale para lo que ya
    // tienes. Con base válida no se toca nada: la migración es idempotente.
    // El nivel no se toca aunque quede por encima del techo nuevo: se pierde
    // la mejora futura, no la ya ganada.
    const tier = w.tier ?? 1;
    const basePrevia = typeof w.baseId === 'string' ? basePorId(w.baseId) : undefined;
    const baseValida = basePrevia && basePrevia.tier === tier ? basePrevia : undefined;
    // Para derivar el potencial se deshace la base que trae, si trae: si no, un
    // daño con base ×1,10 derivaría un potencial más alto en cada carga y el item
    // subiría solo. Con potencial válido no se deriva nada: se confía en él.
    const potencialYaVa = typeof w.potential === 'number' && w.potential >= 1 && w.potential <= 5;
    const { potential } = potencialYaVa
      ? { potential: w.potential }
      : tiene
        ? potencialYDanoDe(tier, w.damage / (baseValida?.pesoStat ?? 1))
        : { potential: potencialNormalizado(w.potential) };
    const base = baseValida ?? baseAleatoriaSegura(tier, 'recolector', rng);
    const baseId = base?.id;
    const damage = danioDeRango(tier, potential, base);
    const maxLevel = techoDeNivel(potential, base?.posicion ?? 6);

    if (potencialYaVa && w.potential === potential && w.damage === damage && w.baseId === baseId && w.maxLevel === maxLevel) return w;

    changed = true;
    // El `details` se rehace porque es lo que se pinta, y un item cuyo texto dice
    // "+5" mientras su daño es 6 es exactamente el bug que se está arreglando.
    return {
      ...w,
      potential,
      damage,
      baseId,
      maxLevel,
      details: damage > 0 ? `Recolección por click: +${damage}` : w.details
    };
  });
  if (!changed) return { items, changed: false };
  return { items: salida, changed: true };
}

/**
 * Lo mismo para los compañeros, cruzando `state.companions` con su ficha.
 *
 * **SON DOS LISTAS Y POR QUÉ.** El poder del compañero vive en `power`, que solo
 * está en `state.companions`; la ficha del almacén no lo tiene, solo el texto de
 * `details`. Un solo recorrido con un `if` por tipo acabaría sirviendo para uno y
 * estropeando al otro.
 *
 * **A UN COMPAÑERO VIEJO SE LE PONE ★3 Y NO SE LE TOCA EL PODER.** El poder del
 * compañero **es** la posición en el rango del tier (`poderDeCompanero`), no una
 * escala aparte, así que de un poder suelto no se puede deducir un potencial
 * exacto: el mismo 6 es ★3 en el T1 y ★1 en otro sitio. ★3 es el punto medio y es
 * lo que ya se leía antes de este cambio. Recalcular el poder sí sería tocarle el
 * ingreso al jugador, y eso no lo hace una migración.
 *
 * **LA FICHA SE CORRIGE DESDE AQUÍ, POR ID, Y NO LEYENDO `details`.** Parsear una
 * cadena para sacar un número es la forma más corta de que un cambio de redacción
 * rompa la migración en silencio. El número de verdad está en el compañero real, y
 * las dos cosas comparten el id justo para poder cruzarlas.
 */
/**
 * LA MIGRACIÓN DEL NIVEL DE LOS COMPAÑEROS, Y POR QUÉ ES ESTA Y NO UNA LECTURA CON
 * `?? 0`.
 *
 * Un compañero guardado antes de que existiera el nivel no lo tiene. **La regla
 * dice que eso es un nivel 0**, así que técnicamente no hace falta migrar: todo lo
 * que lea `comp.level` podría usar `?? 0` y acertaría.
 *
 * Pero el que falta no es solo el nivel: **falta también el techo**, y el techo es
 * lo que el jugador ve. Un botón que enseña un techo calculado con una función y un
 * motor que acepta hasta otro distinto discrepan en la partida que ya estaba
 * empezada, que es la única que importa cuando algo se rompe. Y esa discrepancia no
 * se ve en los bancos, porque los bancos construyen su propio estado.
 *
 * Se migran las **dos mitades**, como se migró el potencial: el compañero de
 * `state.companions` y su ficha en el almacén. Son el mismo objeto y antes se
 * separaban.
 *
 * **Y NO ES UNA ADICIÓN DE NIVELES.** Todo lo que no tiene `level` es un 0, y todo
 * lo que no tiene `maxLevel` recibe el que dice la misma función que usa el resto
 * del juego. Una migración que "arregla" números está cambiando la partida de
 * alguien sin avisar.
 */
export function migraNivelesDeCompaneros(
  companeros: any[], fichas: any[]
): { companeros: any[]; fichas: any[]; changed: boolean } {
  let changed = false;

  const nivelDe = (c: any) =>
    (typeof c?.level === 'number' && c.level >= 0) ? Math.floor(c.level) : 0;

  // **EL ARRAY NO SE FILTRA POR TIPO, Y NO ES UNA COMISIÓN.** En
  // `state.companions` **todo es un compañero**, pero su `type` es el de su
  // ingreso —`click`, `passive` o `multiplier`—, no `'companion'`, que es el
  // tipo de la **ficha** del almacén. Filtrar por `type === 'companion'` aquí
  // saltaba el array entero: la ficha se rellenaba y el compañero no, y quedaban
  // dos verdades sobre el mismo objeto —justo lo que esta migración viene a
  // arreglar—. La migración de los potenciales tiene ese mismo filtro y solo
  // arregla las fichas; aquí se hace bien desde el principio.
  const nuevosComp = (companeros ?? []).map((c) => {
    if (!c || typeof c !== 'object') return c;
    const nivel = nivelDe(c);
    // F74 · El techo mira potencial y base. Si ya trae techo se respeta.
    const techo = typeof c.maxLevel === 'number' && c.maxLevel > 0
      ? c.maxLevel
      : techoDeNivel(c.potential, posicionDeBase(c.baseId));
    if (c.level === nivel && c.maxLevel === techo) return c;
    changed = true;
    return { ...c, level: nivel, maxLevel: techo };
  });

  // La ficha se empareja **por id**, que es lo que hace la de los potenciales. Y el
  // nivel del compañero manda: si los dos disagreean, el del array es el bueno,
  // porque es el que paga el ingreso.
  const porId = new Map<string, number>();
  for (const c of nuevosComp) if (c?.type === 'companion') porId.set(c.id, c.level);

  const nuevasFichas = (fichas ?? []).map((f) => {
    if (f?.type !== 'companion') return f;
    const nivel = porId.has(f.id) ? porId.get(f.id)! : nivelDe(f);
    // F74 · El techo mira potencial y base. Si ya trae techo se respeta.
    const techo = typeof f.maxLevel === 'number' && f.maxLevel > 0
      ? f.maxLevel
      : techoDeNivel(f.potential, posicionDeBase(f.baseId));
    if (f.level === nivel && f.maxLevel === techo) return f;
    changed = true;
    return { ...f, level: nivel, maxLevel: techo };
  });

  return { companeros: nuevosComp, fichas: nuevasFichas, changed };
}

export function migraPotencialesDeCompaneros(
  companeros: any[], fichas: any[], rng: () => number = Math.random
): { companeros: any[]; fichas: any[]; changed: boolean } {
  let changed = false;
  const reparados = new Map<string, number>();
  const bases = new Map<string, string | undefined>();

  // F74 · LA BASE SE SORTEA Y EL PODER SE RECALCULA (decidido por el jugador).
  // Sin base válida: sorteo ponderado de su tabla y poder con base. Cambia el
  // ingreso —a propósito, es la caza valiendo para lo que ya tienes—. Sin tier
  // numérico (exclusivos de caja, de poder fijo) no hay nada que sortear: se
  // dejan como están, con poder de carta y sin estrellas.
  const basePara = (c: any): { baseId?: string; pos: number } => {
    const tier = Number(c?.tier);
    if (!Number.isFinite(tier) || tier < 1 || tier > 10) return { baseId: undefined, pos: 6 };
    const previa = typeof c?.baseId === 'string' ? basePorId(c.baseId) : undefined;
    if (previa && previa.tier === tier) return { baseId: previa.id, pos: previa.posicion };
    const sorteada = baseAleatoriaSegura(tier, 'companero', rng);
    return { baseId: sorteada?.id, pos: sorteada?.posicion ?? 6 };
  };

  const nuevosComp = (companeros ?? []).map((c) => {
    if (!c || typeof c !== 'object') return c;
    const tier = Number(c?.tier);
    if (!Number.isFinite(tier) || tier < 1 || tier > 10) {
      // Sin tier no hay base ni potencial de rango: se deja como está. Esto
      // incluye a los exclusivos de caja (poder fijo, sin estrellas).
      // (OJO: la versión anterior filtraba por `type === 'companion'`, que en
      // este array no existe —los tipos son click/passive/multiplier—, así que
      // el array no se migraba nunca y solo se tocaban las fichas. Con F74 el
      // array sí se migra: sin base en el compañero no hay poder con base.)
      return c;
    }
    // El multiplicador tiene poder FIJO (+50 %, +200 %): no sale del rango del
    // tier y recalcularlo lo rompería. Se deja como está, sin base.
    if (c.type === 'multiplier') return c;
    const tiene = typeof c.potential === 'number' && c.potential >= 1 && c.potential <= 5;
    const potential = tiene ? c.potential : 3;
    const { baseId, pos } = basePara(c);
    const power = poderDeCompanero(tier, potential, baseId ? basePorId(baseId) ?? null : null);
    const maxLevel = techoDeNivel(potential, pos);
    if (tiene) reparados.set(c.id, potential); else { changed = true; reparados.set(c.id, 3); }
    bases.set(c.id, baseId);
    if (tiene && c.power === power && c.baseId === baseId && c.maxLevel === maxLevel) return c;
    changed = true;
    return { ...c, potential, power, baseId, maxLevel };
  });

  // Los ids de multiplicadores, cuyas fichas tampoco se tocan: poder fijo.
  const multIds = new Set<string>();
  for (const c of nuevosComp) {
    if (c && typeof c === 'object' && c.type === 'multiplier' && typeof c.id === 'string') multIds.add(c.id);
  }

  const nuevasFichas = (fichas ?? []).map((f) => {
    if (f?.type !== 'companion') return f;
    if (typeof f?.id === 'string' && multIds.has(f.id)) return f;
    const tiene = typeof f.potential === 'number' && f.potential >= 1 && f.potential <= 5;
    const reparado = reparados.get(f.id);
    const potential = tiene ? f.potential : reparado;
    // Sin potencial ni compañero a la vista no hay de dónde sacarlo: se deja
    // como está, igual que antes.
    if (potential === undefined) return f;
    // La ficha lleva la base de su compañero: son el mismo objeto. Sin
    // compañero a la vista, sorteo propio con su tier, si lo tiene.
    let baseId = bases.has(f.id) ? bases.get(f.id) : undefined;
    const tierF = Number(f?.tier);
    if (baseId === undefined && Number.isFinite(tierF) && tierF >= 1 && tierF <= 10) {
      baseId = basePara(f).baseId;
    }
    const posF = baseId ? (basePorId(baseId)?.posicion ?? 6) : 6;
    const maxLevel = techoDeNivel(potential, posF);
    if (tiene && f.baseId === baseId && f.maxLevel === maxLevel) return f;
    changed = true;
    return { ...f, potential, baseId, maxLevel };
  });

  if (!changed) return { companeros, fichas, changed: false };
  return { companeros: nuevosComp, fichas: nuevasFichas, changed: true };
}

/**
 * La probabilidad de cada potencial, y es **decreciente a propósito**: sacar un
 * ★1 tiene que ser mucho más fácil que sacar un ★5, porque el ★5 es ×2 y el ★1
 * es ×1,2. Con un reparto plano, uno de cada cinco items sería perfecto y buscar
 * uno dejaría de ser una búsqueda.
 *
 * `★5` sale un 3%: con la forja promediando, dos ★5 son el camino al item
 * perfecto, y por eso tiene que ser raro y no regalado.
 */
export const POTENTIAL_WEIGHTS: Record<number, number> = {
  1: 0.50, 2: 0.25, 3: 0.15, 4: 0.07, 5: 0.03
};

/**
 * Potencial 1..5 al crear un item nuevo.
 *
 * Sale del dado: es la lotería de la tienda y de las cajas. **La forja no lo
 * tira, lo promedia**, y esa es justo la diferencia entre las dos vías.
 */
export function rollPotentialFrom(rng: () => number = Math.random): number {
  const t = rng();
  let acum = 0;
  for (let p = 1; p <= 5; p++) {
    acum += POTENTIAL_WEIGHTS[p];
    if (t < acum) return p;
  }
  return 5;
}

/**
 * Dónde cayó un material dentro del rango de su tier, de 0 a 1.
 *
 * Es la regla de F33: lo que se mezcla al forjar **no es el daño, es la
 * posición**. Un T10 tirado en 373 y otro en 559 no valen lo mismo aunque los dos
 * sean T10, y esa diferencia es la que hace que buscar el item perfecto sea una
 * decisión y no una casualidad.
 *
 * **Se recorta a 0..1 a propósito**, y por dos motivos que no son hipotéticos:
 * el daño de un item sube con el potencial y con los afijos, y el de uno ya
 * sintonizado sube con el nivel. Sin el recorte, un T5 de nivel 20 daría una
 * posición de 4 y el forjado siempre saldría en el tope — o sea, la forja
 * premiaría haber invertido antes en vez de en elegir bien el material.
 */
export function posicionEnRango(item: CollectorItem): number {
  return (potencialDeDanio(item) - 1) / 4;
}

/** Probabilidad base de éxito de una fusión de tier T → T+1. */
export function baseSuccessChance(fromTier: number): number {
  // T1 78% → T10 33%. Del T11 en adelante pisa el suelo del 30%: la curva
  // creciente de F34 (60/68/75) está propuesta pero sin visto bueno, así que
  // no se toca el signo hasta que lo haya. El suelo evita el absurdo de una
  // probabilidad negativa en tiers altos.
  return Math.max(0.30, 0.78 - (fromTier - 1) * 0.05);
}

// Re-export para compatibilidad: otros ficheros los importan de aquí.
export { PIEDRA_APORTA, PIEDRA_PUNTOS };

/**
 * El tope de piedras por fusión.
 *
 * **DIEZ DE 1,2 PUNTOS.** El techo de la mano entera es +12 puntos de probabilidad,
 * que es lo que cabe en una fusión sin que la piedra deje de ser una decisión. Ojo
 * con lo que esto implica y ya no es un secreto: **en los tiers medios y altos el 95 %
 * ya no es alcanzable con piedras**, ni con diez ni con veinte. Por eso el botón "las
 * necesarias" enseña ahora el porcentaje al que llegas de verdad en vez de prometer
 * el 95 % —ver `previewPiedrasNecesarias()`—, y por eso las piedras son un bonus de
 * lujo y no la llave del tope.
 */
export function maximoDePiedras(): number {
  return 10;
}

/** El tope de piedras por fusión, redondeado hacia arriba hasta el objetivo. */
export const MAX_PIEDRAS_POR_FUSION = maximoDePiedras();

/**
 * CUÁNTAS PIEDRAS HACEN FALTA PARA LLEGAR A LA PROBABILIDAD OBJETIVO.
 *
 * **ES LA INVERSA DE `successChance()`, Y TIENE QUE ESTAR AQUÍ Y NO EN LA VISTA.** La
 * razón es la de siempre y ya ha salido muchas veces: si la cuenta la hace la pantalla,
 * el botón "gastar las necesarias" puede prometer un número que el motor no va a
 * cobrar, y el jugador gasta y no ve el efecto. Con las dos funciones en el mismo sitio,
 * o el botón dice lo que el motor va a hacer o no se escribe.
 *
 * **Y DEVUELVE 0 CUANDO YA SE LLEGA SIN PIEDRAS.** Con una base alta y las pasivas del
 * árbol, no hace falta gastar ninguna: ofrecer "gastar 2" ahí sería cobrar por nada, que es
 * justo lo que el jugador no perdona en una ruleta.
 *
 * **OJO: EL NÚMERO QUE DEVUELVE NO GARANTIZA EL OBJETIVO.** El tope de diez sumado a
 * 0,012 por piedra es +12 puntos, y con eso el 95 % solo se alcanza en tiers bajos. En
 * los demás, la función devuelve 10 —las que hacen falta para llegar lo lejos que se
 * pueda— y quién enseña el resultado es `previewPiedrasNecesarias()`, que calcula la
 * probabilidad real con esas piedras y la pone en el botón. Si el botón dijera "para el
 * 95 %" con un tope de 12, mentiría con la cifra que más se mira (R3).
 */
export function piedrasParaObjetivo(
  fromTier: number,
  craftLuck: number,
  affixLuck: number,
  objetivo = 0.95
): number {
  const base = baseSuccessChance(fromTier);
  const yaHay = base + craftLuck + affixLuck;
  const faltan = objetivo - yaHay;
  if (faltan <= 0) return 0;
  // `Math.ceil` y no un redondeo: una piedra de menos es una probabilidad de menos, y el
  // botón se llama "las necesarias" — si no llega, miente por una piedra. Y el `Math.min`
  // de al lado es el tope de la mano: si el 95 % pide más de diez, se piden diez, que es
  // lo que se puede gastar.
  return Math.min(MAX_PIEDRAS_POR_FUSION, Math.ceil(faltan / PIEDRA_APORTA));
}

/** Chance final = base + pasivas + piedras, topado a 95%. */
export function successChance(
  fromTier: number,
  craftLuck: number,
  stonesUsed: number,
  affixLuck: number
): number {
  const base = baseSuccessChance(fromTier);
  // Cada piedra aporta lo que dice `PIEDRA_APORTA`, y el tope es el mismo que usa
  // `piedrasParaObjetivo()`: por eso el botón y el motor no pueden separarse.
  const stones = Math.min(MAX_PIEDRAS_POR_FUSION, Math.max(0, stonesUsed)) * PIEDRA_APORTA;
  const total = base + craftLuck + stones + affixLuck;
  return Math.min(0.95, total);
}

// --------------------------------------------------------------------------
// Potencial
// --------------------------------------------------------------------------

/**
 * Potencial 1..5. Sube con:
 *  - Materiales de rareza alta (sobrecargados/míticos)
 *  - Recolectores de nivel alto (invertidas en experiencia, no en dinero)
 *  - Piedras de Calibración usadas
 */
export function rollPotential(materials: CollectorItem[], stonesUsed: number): number {
  let score = 1;

  // Cada material aporta según rareza y nivel
  for (const m of materials) {
    const rarityScore = RARITY_WEIGHT[m.rarity] ?? 0;
    const levelScore = (m.level || 0) * 0.06;
    score += rarityScore * 0.4 + levelScore;
  }

  score += stonesUsed * 0.25;

  // Redondea a potencial entero con algo de azar para que no sea determinista
  const jitter = (Math.random() - 0.5) * 0.8;
  return Math.max(1, Math.min(5, Math.round(score + jitter - 0.5)));
}

const RARITY_WEIGHT: Record<Rarity, number> = {
  'Común': 0, 'Raro': 0.5, 'Épico': 1, 'Legendario': 1.6, 'Mítico': 2.4, 'Divino': 3.2
};

// --------------------------------------------------------------------------
// Nombres de recolectores crafteadas
// --------------------------------------------------------------------------

const FORGE_PREFIX = ['Forja de', 'Espuela de', 'Nucleo de', 'Herencia de', 'Sello de', 'Yunque de'];
const FORGE_NOUN = ['Vórtice', 'Éclipsis', 'Confín', 'Ceniza', 'Éter', 'Nébula', 'Duna', 'Ónix', 'Zafiro', 'Cobalto'];

/** Nombre generado: "Forja de Ceniza" + sufijo de linaje. */
export function forgeCollectorName(potential: number, tier: number, rng = Math.random, obra = false): string {
  const p = FORGE_PREFIX[Math.floor(rng() * FORGE_PREFIX.length)];
  const n = FORGE_NOUN[Math.floor(rng() * FORGE_NOUN.length)];
  const tierSuffix = tier >= 11 ? ' PRIMIGENIA' : tier >= 9 ? ' SINGULAR' : '';
  // La obra firma en el nombre para que se pueda buscar en el almacén: es el
  // mismo sufijo donde ya van `·Absoluta` y `·Prima`, no un campo aparte que
  // solo vería quien abriera la ficha.
  const potSuffix = obra ? '·Obra Maestra' : potential >= 5 ? '·Absoluta' : potential >= 4 ? '·Prima' : '';
  return `${p} ${n}${tierSuffix}${potSuffix}`;
}

/**
 * SI UN FORJADO ES OBRA MAESTRA, Y POR QUÉ SON TRES CONDICIONES Y NO UNA.
 *
 * Hacen falta las tres: el nodo comprado (sin él no hay firma que poner),
 * los dos materiales en ★5 (es lo que la hace obra y no suerte) y el
 * resultado en ★5 (un 4 con un 5 que sube por Éter es un ★5 afortunado, no una
 * obra). Un item viejo sin potencial cuenta como ★3 y no dispara nunca.
 */
export function esObraMaestra(
  materiales: Array<{ potential?: number }>,
  potencialFinal: number,
  activa: boolean
): boolean {
  if (!activa || potencialFinal < 5) return false;
  if (materiales.length !== MATERIALES_POR_FUSION) return false;
  return materiales.every(m => potencialNormalizado(m.potential) === 5);
}

// --------------------------------------------------------------------------
// Fusión
// --------------------------------------------------------------------------

export interface ForgeResult {
  success: boolean;
  collector?: CollectorItem;
  /** Cristales de consuelo que deja el fallo. Los mismos en las dos fusiones. */
  crystals?: number;
  chanceUsed?: number;
  error?: string;
}

/**
 * CUÁNTOS MATERIALES ENTRAN EN UNA FUSIÓN.
 *
 * **ESTE NÚMERO ESTABA ESCRITO A MANO EN SEIS SITIOS, Y CINCO DECÍAN 3.**
 *
 * La receta se cambió de 3 materiales a 2 y solo se actualizó la comprobación del
 * motor. En la página de la forja quedaron cuatro restos: el tope de la selección,
 * la condición de "puedo forjar", el contador `x/3` y el texto "selecciona 3".
 * Con eso **la forja no se podía usar**: los dos huecos del yunque se llenaban,
 * `ready` pedía tres y el botón se quedaba inactivo para siempre. Si se llegaba a
 * tres, el motor rechazaba la fusión con "se necesitan 2". Y el propio modal de
 * confirmación decía "Dos recolectores de tier N", así que la página se contradecía
 * a sí misma en la misma frase.
 *
 * **POR QUÉ ES UNA CONSTANTE Y NO UN 2 SUELTO.** Porque el número que decide cuántos
 * huecos hay, cuántos puedes seleccionar, cuándo se activa el botón y qué comprueba
 * el motor no puede estar escrito en dos sitios: es la misma regla, y cuando se
 * cambiaron las dos copias se olvidó una. Aquí vive porque es **la que impone el
 * motor**: si algún día se cambia la receta, el sitio que se cambia es este y el
 * resto lo lee.
 */
export const MATERIALES_POR_FUSION = 2;



/**

 * EL POTENCIAL DE UN COMPAÑERO: LA POSICIÓN DENTRO DEL RANGO DE SU TIER.

 *

 * **QUÉ SIGNIFICA, DE LA MISMA MANERA QUE EN EL RECOLECTOR.** El potencial va de

 * 1 a 5 y dice **hasta dónde llega este item dentro de lo que su tier puede

 * dar**: ★1 es el suelo del rango y ★5 es el techo. Dos compañeros del mismo

 * tier se comparan con un número, que es lo que hace que buscar uno sea una

 * decisión.

 *

 * **Y POR QUÉ AQUÍ NO ES UN MULTIPLICADOR, COMO EN EL RECOLECTOR.** Porque el

 * poder del compañero **es el rango**: su carta se paga por él, y el rango del

 * tier es lo que fija el precio. Con `danioDeRango()` —base × (1 + 0,2 × p)— el

 * techo de cada tier se multiplicaría otra vez por el potencial, y medido eso

 * da un compañero T10 hasta **once veces** más fuerte que el de ahora con la

 * misma carta: el precio por punto se desploma y el T10 vuelve a ser la trampa

 * que `balanceCheck` ya cazó una vez. Con la regla de la posición, **la

 * esperanza del dado no cambia** (potencial 3 cae en el punto medio, que es lo

 * que `rand(min, max)` daba de media) y lo que cambia es la **diferencia entre

 * dos compañeros del mismo tier**, que es justo lo que el potencial debe hacer.

 *

 * Y el orden entre tiers sigue siendo estricto: el techo del T9 (346) es menor

 * que el suelo del T10 (373), así que subir de tier siempre mejora, con

 * potencial o sin él.

 */

/**
 * EL PODER DE UN COMPAÑERO: SU RANGO DE TIER POR EL POTENCIAL Y LA BASE OCULTA.
 *
 * **LA MISMA PIPELINE QUE EL RECOLECTOR:** base × potencial × baseOculta × nivel.
 * Aquí el nivel no entra (los compañeros no suben de nivel), así que es:
 *   poder = rangoDelTier × (1 + 0.2 × potencial) × baseOculta
 */
export function poderDeCompanero(
  tier: number,
  potential: number,
  base?: BaseOculta | number | null
): number {

  const [min, max] = rangoDePoder(tier);

  const p = potencialNormalizado(potential ?? undefined);
  const baseStat = typeof base === 'number' ? base : base?.pesoStat ?? 1.0;

  return Math.round(
    (min + ((max - min) * (p - 1)) / 4) * baseStat
  );

}


/**
 * Un compañero del tier pedido, con el potencial que se le diga.
 *
 * **ESTA ES LA QUE USA LA FORJA, Y POR QUÉ NO TIRA EL POTENCIAL.** Un compañero
 * forjado no lo sortea: lo **hereda de la media de sus dos materiales**, igual
 * que el recolector forjado. Si esta función lo tirara, la forja de compañeros
 * tendría que construir el objeto a mano, y el día que se añadiese un campo al
 * compañero —potencial, afijo, lo que sea— la forja se quedaría sin él sin que
 * nada lo dijera.
 *
 * Y está junto a `poderDeCompanero` y no en `generators.ts` porque la forja vive
 * en `crafting.ts` y lo necesita: importarlo de `generators.ts` cerraría un
 * ciclo, porque `generators.ts` ya importa de aquí.
 */
export function crearCompanioDeTier(
  tier: number,
  potential: number,
  rng: () => number = Math.random,
  base?: BaseOculta | null
): { id: string; name: string; type: 'click'; power: number; rarity: string; tier: number; potential: number; level: number; maxLevel: number; baseId?: string } {
  const p = potencialNormalizado(potential ?? undefined);
  // F74 · Sin base se sortea de su tabla: todo compañero nace con base, la forja
  // pasa la suya promediada y nadie nace neutro por defecto.
  const baseFinal = base ?? baseAleatoriaSegura(tier, 'companero', rng);
  const posFinal = baseFinal?.posicion ?? 6;
  return {
    id: `comp_t${tier}_${Date.now()}_${Math.floor(rng() * 1e9).toString(36).substring(2, 7)}`,
    name: nombreDe('companion', tier, rng),
    type: 'click',
    power: poderDeCompanero(tier, p, baseFinal),
    // **LA RAREZA LA PONE EL TIER, Y LA PONE ESTA FUNCIÓN.** Estaba escrita a mano
    // (`TIER_SYSTEM.rarityByTier[tier] || 'Común'`) y la pantalla de forja necesita
    // la misma para anunciar el resultado antes de tirar (F76): una sola fuente.
    rarity: rarezaDeCompanionForjado(tier),
    tier,
    potential: p,
    baseId: baseFinal?.id,
    // **NACE CON NIVEL 0 Y SU TECHO PUESTOS, Y POR ESO NO HAY MIGRACIÓN QUE
    // INVENTARLOS.** Un compañero sin nivel es un nivel 0, que es lo que haría
    // cualquier código que lo leyera; y el techo lo pone la misma función que lo
    // aplica, así que no puede haber un compañero cuyo botón diga una cosa y el
    // motor acepte otra.
    level: 0,
    // **LOS ARGUMENTOS EN ORDEN, QUE ESTABON CAMBIADOS Y ERA UN BUG DE JUEGO.**
    //
    // La firma es `nivelMaximoDeCompanio(potential, maxLevel)`, y aquí se llamaba
    // `nivelMaximoDeCompanio(tier, p)`: el tier en el hueco del potencial y el
    // potencial en el del `maxLevel`. La función devuelve el `maxLevel` en cuanto lo
    // recibe como número positivo, así que **el techo de todo compañero forjado era
    // su propio potencial**: un ★1 topaba en nivel 1 y un ★4 en nivel 4, cuando el
    // techo de un ★4 son 32.
    //
    // Lo que se veía en la ficha: "NIVEL 4 / 4" con el botón en "Nivel máximo", y un
    // compañero forjado que ya no subía nunca más. Al lado, uno de caja del mismo ★4
    // con "1 / 32", y la conclusión de que cada compañero tenía un tope arbitrario.
    // No lo tenía: **los de caja bien y los de forja con el potencial por techo**, que
    // es el peor sitio para un fallo porque las dos mitades del juego parecian lo mismo.
    // F74 · El techo mira potencial y base, igual que el recolector.
    maxLevel: techoDeNivel(p, posFinal)
  };
}

/**
 * LOS NIVELES DEL COMPAÑERO, Y POR QUÉ VIVEN AQUÍ Y NO EN SU PÁGINA.
 *
 * El jugador sube el nivel de los recolectores con cristales. **La misma moneda,
 * la misma curva y la misma probabilidad**, y por eso las reglas no son un sitio
 * nuevo: son tres funciones al lado de las del recolector, que es donde ya está
 * escrito por qué el coste vive en `data/` y no en el motor.
 *
 * **LO QUE ES IGUAL A PROPÓSITO.** El coste `1.2 × 1.26^n`, la probabilidad
 * `crystalSuccessChance(nivel, power)`, el `+10 %` por nivel y el techo de
 * `20 + potencial × 3`. Escribir una curva "para el compañero" habría sido el
 * error de siempre: dos números que empiezan iguales y se separan en tres meses,
 * con un jugador que sube el recolector veinte niveles y el compañero cinco y no
 * sabe por qué.
 *
 * **Y LO QUE NO ES IGUAL.** El techo del compañero son **20 niveles base**, como el
 * del recolector, pero el incremento por estrella es el mismo. No hay una razón de
 * juego para que sean distintos todavía; si algún día la hay, es una constante y
 * una línea de comentario, no una función reescrita.
 */

/** El techo de niveles de un compañero, y el mismo reparto por estrella. */
export function nivelMaximoDeCompanio(potential?: number | null, maxLevel?: number | null): number {
  if (typeof maxLevel === 'number' && maxLevel > 0) return maxLevel;
  // Sin techo guardado ni base a la vista, la posición media: es el mismo techo
  // que nace en la forja y la generación para una base 5.
  return techoDeNivel(potential, 5);
}

/**
 * Lo que suma un nivel al ingreso del compañero.
 *
 * **ES EL MISMO +10 % DEL RECOLECTOR, Y SE LLAMA A LA MISMA FUNCIÓN.** No es que
 * los dos trabajos dé 10 y 10 por casualidad: es `multiplicadorDeNivel()`, que
 * comparten las dos fichas. La cuenta del ingreso del compañero vive en
 * `recalculatePassiveIncome()` y el del recolector en `cuentaDeClickSinBuff()`,
 * pero las dos multiplican con esta misma regla.
 *
 * ## POR QUÉ EL RECOLECTOR TAMBIÉN LA LLAMA, Y ESTO NO ERA COSA DE NADA
 *
 * La cuenta del click multiplicaba por 1 + nivel por 0,10 **escrito en la línea**, con
 * su propio redondeo o sin él. Ahora delega aquí. El motivo no es la elegancia: es que
 * la ficha del almacén tenía que enseñar el daño final —base, potencial y mejora
 * juntos—, y la única forma de que el número grande del inventario y el número que se
 * cobra al hacer clic **sean el mismo** es que los dos multiplicen con la misma función.
 * Copiar ese 0,10 en la vista habría sido una segunda regla, y se separaría de la
 * primera en cuanto una de las dos cambie.
 */
export function multiplicadorDeNivel(level: number | undefined | null): number {
  return 1 + Math.max(0, Math.floor(Number(level) || 0)) * 0.10;
}

/**
 * EL SUELO DE DAÑO, Y POR QUÉ ES 1 Y VIVE AQUÍ.
 *
 * Sin recolector equipado no hay de dónde sacar un daño, y con un cero la partida
 * quedaba bloqueada sin salida (la tienda no vende recolectores). El suelo es el
 * daño del recolector más débil que existe: no hay un estado raro al que llegar,
 * hay el peor objeto del juego sin ninguna ventaja. Vive aquí y no en el motor
 * porque el daño final de cualquier arma —equipada o no, propia o ajena— lo usa,
 * y dos unos en dos sitios son dos oportunidades de que uno cambie.
 */
export const DANIO_MINIMO_SIN_RECOLECTOR = 1;

/**
 * LA POTENCIA DE UN AFIJO SEGÚN EL TIER DEL ITEM (F97).
 *
 * El mismo afijo pega más en un tier alto: un Baluarte de T3 no es el de T8.
 * Es lo que hace que los mejores stats salgan en los mejores items, sin guardar
 * nada nuevo en el item —la magnitud se calcula al usar, con el tier que el item
 * ya trae—. Sube 10 puntos por tier desde el 60 %: en T3 (el primer tier con
 * afijos, Raro) el afijo rinde al 80 %, en T5 al 100 % y en T10 al 150 %.
 *
 * **SOLO ESCALA MAGNITUDES, NO PROBABILIDADES.** `critChance` no se toca: una
 * probabilidad no es "más stat", y un Foco de T10 con 21 % de crítico sería otra
 * economía de críticos. Los `clickMult`, `passiveMult` y sus variantes por nivel
 * sí, porque son porcentaje del item.
 */
export function potenciaDeAfijoPorTier(tier: number | undefined | null): number {
  const t = Math.max(1, Math.floor(Number(tier) || 1));
  return 0.5 + t * 0.1;
}

/**
 * EL EFECTO DE UNOS AFIJOS CON UN NIVEL Y UN TIER, SIN MIRAR QUÉ HAY EQUIPADO (F83).
 *
 * Es la cuenta de `equippedAffixEffect()` del motor, sacada a `data/` porque la
 * necesitan tres sitios que no son el equipado: la ficha de un arma no equipada
 * (sus afijos contarían al equiparla), la tarjeta de perfil y el recálculo del
 * daño ajeno desde la tarjeta pública. El motor delega en ella para lo equipado,
 * así que no hay dos cuentas que puedan separarse.
 *
 * **LOS IDS QUE NO ESTÁN EN EL CATÁLOGO NO CUENTAN.** Igual que ya filtraba la
 * herencia de la forja: un afijo inventado no puede multiplicar nada.
 */
export function efectoDeAfijos(
  affixIds: Array<string> | undefined | null,
  nivel: number | undefined | null,
  tier: number | undefined | null = null
): { clickMult: number; passiveMult: number; critChance: number } {
  const out = { clickMult: 0, passiveMult: 0, critChance: 0 };
  const ids = Array.isArray(affixIds) ? affixIds : [];
  const nv = Number(nivel) || 0;
  // Sin tier (item viejo sin el campo) el factor es 1: la cuenta de siempre.
  const potencia = tier === null || tier === undefined ? 1 : potenciaDeAfijoPorTier(tier);
  for (const affixId of ids) {
    const affix = AFFIX_BY_ID[affixId];
    if (!affix) continue;
    out.clickMult += (affix.effect.clickMult || 0) * potencia;
    out.passiveMult += (affix.effect.passiveMult || 0) * potencia;
    out.critChance += affix.effect.critChance || 0;
    // Los que dependen del nivel suman un PORCENTAJE por nivel, no un número
    // plano: es lo que hace que subir de nivel siga valiendo sin que un
    // "+8 por nivel" convierta un T1 en un T10. Ver el comentario de AFFIXES.
    out.clickMult += (affix.effect.clickMultPorNivel || 0) * nv * potencia;
    out.passiveMult += (affix.effect.passiveMultPorNiveles || 0) * (nv / 5) * potencia;
  }
  return out;
}

/**
 * EL DAÑO FINAL DE UN RECOLECTOR, SIN BUFFS TEMPORALES (F83).
 *
 * Daño base por nivel por compañeros por logros por árbol por afijos, con el
 * suelo abajo. Es la cuenta de `cuentaDeClickSinBuff()` del motor, en el mismo
 * orden de factores: el motor la llama para lo equipado y la ficha, el perfil y
 * el ranking la llaman para cualquier arma, y el recálculo ajeno para la de otro
 * jugador. Un solo orden significa que el número de la ficha y el que se cobra
 * no se pueden separar en el último decimal.
 *
 * **LOS PARÁMETROS SON MULTIPLICADORES YA SUMADOS** (`1 + bono`), no bonos: lo
 * que multiplica es lo que entra, y así ni la vista ni el recálculo tienen que
 * saber dónde va el `1 +`.
 *
 * **Y SIN EL BUFF TEMPORAL A PROPÓSITO.** El buff se aplica fuera, una sola vez,
 * donde se cobra (clic y Base). Meterlo aquí lo duplicaría —es el bug que rompió
 * `playthroughCheck` una vez— y haría que una foto del ranking enseñara un x2
 * caducado como si pegara.
 */
export function danoFinalDeRecolector(
  damage: number | undefined | null,
  nivel: number | undefined | null,
  multAfijos: number,
  multCompaneros: number,
  multLogros: number,
  multArbol: number
): number {
  const base = Math.max(DANIO_MINIMO_SIN_RECOLECTOR, Number(damage) || 0);
  return Math.floor(
    base
      * multiplicadorDeNivel(nivel)
      * multCompaneros
      * multLogros
      * multArbol
      * multAfijos
  );
}
/**
 * LOS TÉRMINOS DE LA SUMA DEL STAT, Y POR QUÉ SE DERIVAN Y NO SE REPITEN.
 *
 * Es lo que enseña el hover del número grande: de dónde sale ese "+84". La lista tiene que
 * **cuadrar con el número que tiene encima**, y para eso no puede volver a leer la base del
 * tier por su cuenta. La primera versión lo hacía, y con un daño guardado que no coincide
 * exactamente con la fórmula del tier —y no coincide, porque la carga lo deja en su propio
 * valor— la lista decía "Base T2: 30, Potencial: ×1,60" y daba 48 donde el stat ponía 52.
 * Tres números en la misma ficha y uno que no sale de los otros dos.
 *
 * Así que la lista sale **al revés**: el potencial es una regla fija, se aplica hacia atrás
 * para encontrar la base que el item lleva, y de ahí en adelante todo se multiplica hacia
 * delante.
 *
 * **Y LA BASE NO SE REDONDEA, PORQUE REDONDEARLA ROMPE EL ÚNICO COMPROMISO IMPORTANTE.**
 * La primera versión hacía `Math.round(baseDelItem / multPot)` y con el mismo item la lista
 * daba 31 × 1,40 × 1,90 = 82,4 mientras el número grande ponía 84. Un redondeo de un dígito
 * en el medio de una suma es exactamente el descuadre que esta lista existe para evitar, y
 * el que peor se ve es porque los tres números están uno debajo del otro y parecen sumar.
 * Con un decimal la cuenta cuadra hasta el redondeo final, que es el único redondeo que hay
 * en la cadena y se ve: el total es un entero.
 *
 * **ESTÁ AQUÍ Y NO EN LA VISTA PORQUE LA VISTA NO DEBE PODER INVENTARSE ESTA LISTA.** Y
 * tampoco en el motor: estuvo primero dentro de la fábrica del juego, y el resultado fue
 * el de siempre —que el `preview`, que monta su propio juego falso, no lo tenía, así que el
 * hover salía en el almacén y no en el preview, y parecía un bug de una pantalla—. La regla
 * que describe una suma va junto a la suma.
 *
 * `total` lo pasa quien compone el stat y **no se recalcula aquí**: si esta función
 * redondeara por su cuenta, el hover y el número grande podrían no coincidir en el último
 * dígito, que es el peor sitio para un descuadre de uno.
 */
export function desgloseDeStat(
  tier: number,
  baseDelItem: number,
  potencial: number,
  nivel: number,
  total: number,
  extras?: Array<{ texto: string; valor: string }>
): Array<{ texto: string; valor: string }> {
  const multPot = 1 + 0.2 * potencial;
  const multNivel = multiplicadorDeNivel(nivel);
  // **UN DECIMAL, NUNCA REDONDEO ENTERO.** Ver el comentario de arriba: redondear aquí
  // descuadraba la lista en el dígito que la lista existe para no descuadrar.
  const baseImplicita = baseDelItem / multPot;
  const baseTxt = Number.isInteger(baseImplicita)
    ? String(baseImplicita)
    : String(Number(baseImplicita.toFixed(1)));
  const filas: Array<{ texto: string; valor: string }> = [
    { texto: 'Base T' + Math.max(1, Math.floor(Number(tier) || 1)), valor: baseTxt }
  ];
  // La fila del potencial sale solo si el multiplicador mueve la cifra. Hoy siempre mueve,
  // porque el potencial normalizado da 1,60 con tres estrellas; el caso de un multiplicador
  // de exactamente 1 no ocurre, y está contempla para que no haya que volver a pensarlo.
  if (Math.abs(multPot - 1) > 0.0001) {
    filas.push({ texto: `Potencial ${potencial}★`, valor: '×' + multPot.toFixed(2) });
  }
  if (nivel > 0) {
    filas.push({ texto: 'Nivel ' + nivel, valor: '×' + multNivel.toFixed(2) });
  }
  // F97 Lote 2d · Filas extra ya calculadas (afijos, rama): las pone quien las
  // cobra, con sus números, y aquí solo se colocan antes del total. Sin ellas
  // la lista es la de siempre.
  for (const extra of extras ?? []) {
    filas.push(extra);
  }
  // El último término es el total, y la vista lo pinta en negrita: cierra la cuenta.
  filas.push({ texto: 'Total', valor: String(total) });
  return filas;
}

/**
 * Cristales que cuesta subir del nivel dado al siguiente.
 *
 * **ES LA MISMA CURVA QUE `collectorUpgradeCost()`, Y DELEGA EN ELLA.** Dos
 * funciones con el mismo nombre y la misma fórmula en dos ficheros es la forma más
 * barata de tener dos reglas que un día no coinciden. El coste del compañero es un
 * alias, no una copia: si la curva cambia, cambia para los dos.
 */
export const costeDeNivelDeCompanio = costeDeNivel;

/**
 * El poder que un compañero **rinde** de verdad, con su nivel puesto.
 *
 * **ESTO ES LA PIEZA QUE HACE QUE EXISTA LA FUNCIONALIDAD.** Sin ella, el nivel del
 * compañero sería un número que sube y no hace nada —el peor tipo de progreso: el
 * jugador lo ve crecer y no gana nada—. Y el sitio donde se aplica **no puede ser
 * el que guarda el poder**, porque ese número es el que `poderDeCompanero()` calcula
 * del tier y el potencial, y los bancos comparan contra esa función. Si el nivel se
 * guardara dentro de `power`, dejaría de ser "el poder de un T5 con potencial 3" y
 * pasaría a ser "el poder de un T5 con potencial 3 que ya subiría de nivel", que es
 * otra pregunta con otra respuesta.
 *
 * Por eso el poder guardado es el de base y el multiplicado se aplica al sumar el
 * ingreso.
 */
/**
 * LO QUE PAGAN LA RAREZA Y EL POTENCIAL EN UN COMPAÑERO, Y POR QUÉ ESTÁN SEPARADOS
 * DEL RANGO DEL TIER.
 *
 * **EL POTENCIAL YA HACE UNA COSA, Y HAY QUE DECIR CUÁL.** `poderDeCompanero()` coloca
 * el potencial dentro del rango del tier: un ★5 se acerca al techo de su tier y un ★1 al
 * suelo. Eso **ya es un multiplicador**, aunque no se llame así, y por eso el de aquí es
 * corto a propósito: si la rareza y el potencial pagaran su propio peso entero, el
 * potencial contaría dos veces y un ★5 al tope se iría de la partida.
 *
 * El comentario de `poderDeCompanero()` explica por qué el multiplicador **no** va dentro
 * del rango: con la fórmula del recolector el techo de cada tier se multiplicaba otra vez
 * por el potencial y un T10 salía once veces más fuerte con la misma carta. Aquí es
 * distinto porque va **después** de la carta, como una bonificación del objeto y no de su
 * precio: el precio sigue siendo el del rango y la carta que compras no se encarece sola.
 *
 * **Y NINGÚN MULTIPLICADOR BAJA DE 1.** Con la cuenta del potencial al revés tal cual, un
 * ★1 saldría por debajo de 1 y sería una **pena** para quien ya tiene uno forjado sin que
 * hubiera hecho nada malo. El potencial paga un extra por encima de la media y nunca
 * resta por debajo.
 *
 * Los números no están repartidos a ojo: la rareza es la escala de seis escalones que ya
 * usa el juego, y cada salto da un 10% o un 12% al anterior. Con un Divino en 1,60 y un
 * Mítico en 1,45, un compañero Divino rinde un 10% más que el Mítico de la misma carta:
 * poco, pero bastante para que la rareza deje de ser decorativa.
 */
export const MULTIPLICADOR_POR_RAREZA: Record<string, number> = {
  'Común': 1.00,
  'Raro': 1.10,
  'Épico': 1.20,
  'Legendario': 1.32,
  'Mítico': 1.45,
  'Divino': 1.60
};

/**
 * **EL EXTRA POR POTENCIAL TIENE UN TECHO, Y ESTE ES EL NÚMERO QUE LO DICE.**
 *
 * El primer intento puso ★5 en 1,10 y **invirtió el orden entre tiers**: un T9 con
 * cinco estrellas rendía 609 y un T10 con una sola rendía 597. El comentario de
 * `poderDeCompanero()` existe justamente para que eso no pase — dice que el techo del T9
 * es menor que el suelo del T10, y es la garantía de que el tier alto no sea una trampa—,
 * así que un multiplicador que la rompe está fuera deBounds por mucho que el jugador lo
 * encuentre más justo.
 *
 * El límite sale de esa misma cuenta, y por eso está escrito aquí y no solo en el banco:
 *
 *     techo del T9 (346) x mult(★5)  <  suelo del T10 (373) x mult(★1)
 *
 * con mult(★1) = 1, el extra de ★5 tiene que ser **menor que 373/346 = 1,078**. Se queda
 * en 1,06: por debajo del límite con margen para el redondeo, y suficiente para que un ★5
 * se note sobre un ★3. Si algún día se sube este número, el banco del multiplicador falla
 * antes de que un jugador descubra que su T10 le sale más barato que un T9.
 *
 * Y como la rareza multiplica a los dos por igual en esa comparación, **el límite no
 * depende de ella**: subir la rareza no rompe el orden entre tiers.
 */
export function multiplicadorPorPotencialDeCompanero(potential: number | undefined | null): number {
  const p = potencialNormalizado(potential ?? undefined);
  if (p >= 5) return 1.06;
  if (p === 4) return 1.03;
  return 1;
}

/**
 * El multiplicador de un compañero por su rareza y su potencial, los dos juntos.
 *
 * **UNA RAREZA QUE NO SE CONOCE DALE 1, Y NO "LA DE COMÚN".** Hoy las dos son 1,00, así
 * que la diferencia no se ve; lo que importa es el motivo. Una rareza inventada tiene que
 * poder, no romperse: si mañana se añade una rareza y se olvida esta tabla, el item nuevo
 * no puede dejar debuster ingreso por un `undefined` que se multiplica.
 *
 * Y la lectura es **sin acentos y en minúsculas**, como en `data/brillo.ts`: "Mitica" y
 * "Mítica" tienen que dar el mismo multiplicador. El color del halo y el poder del
 * compañero salen de la misma rareza, y si uno la leyera distinto del otro, el mejor
 * item del juego daría más ingreso del que aparenta.
 *
 * **ESTA FUNCIÓN ES LA SUMA DE DOS, Y CADA UNA SE PUEDE PEDIR SOLA.** La ficha del
 * compañero (F77) explica su número con una fila por multiplicador, y la fila de la
 * rareza necesita este número sin el extra del potencial: por eso la lectura vive en
 * `multiplicadorDeRarezaDeCompanero()` y esta solo multiplica las dos mitades.
 */
export function multiplicadorDeCalidadDeCompanero(
  rarity: string | undefined | null,
  potential: number | undefined | null
): number {
  return multiplicadorDeRarezaDeCompanero(rarity)
    * multiplicadorPorPotencialDeCompanero(potential);
}

/**
 * El multiplicador de un compañero por SU RAREZA SOLA, sin el potencial.
 *
 * **EXISTE POR F77, Y LA LECTURA VIVE AQUÍ UNA SOLA VEZ.** La ficha del compañero
 * explica de dónde sale su número con una fila por multiplicador, y la fila de la
 * rareza necesita este número sin el extra del potencial. La lectura con y sin
 * acentos es la misma que la de `multiplicadorDeCalidadDeCompanero()` —mismo
 * catálogo, mismo plano sin acentos— para que el color del halo, el ingreso que
 * se cobra y la ficha lean la misma rareza de la misma manera.
 *
 * **Y UNA RAREZA QUE NO SE CONOCE DA 1, Y NO "LA DE COMÚN".** Hoy las dos son
 * 1,00, así que la diferencia no se ve; lo que importa es el motivo. Una rareza
 * inventada tiene que poder, no romperse: si mañana se añade una rareza y se
 * olvida esta tabla, el item nuevo no puede dejar de dar ingreso por un
 * `undefined` que se multiplica.
 */
export function multiplicadorDeRarezaDeCompanero(
  rarity: string | undefined | null
): number {
  const clave = String(rarity ?? '').trim();
  const directo = MULTIPLICADOR_POR_RAREZA[clave];
  if (typeof directo === 'number') return directo;
  const plano = clave.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [nombre, valor] of Object.entries(MULTIPLICADOR_POR_RAREZA)) {
    const nombrePlano = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (nombrePlano === plano) return valor;
  }
  return 1;
}

/**
 * El poder que un compañero **rinde** de verdad, con su nivel, su rareza y su potencial.
 *
 * **ESTO ES LA PIEZA QUE HACE QUE EXISTA LA FUNCIONALIDAD.** Sin ella, el nivel del
 * compañero sería un número que sube y no hace nada, que es el peor tipo de progreso: el
 * jugador lo ve crecer y no gana nada. Y el sitio donde se aplica **no puede ser el que
 * guarda el poder**, porque ese número es el que `poderDeCompanero()` calcula del tier y
 * el potencial, y los bancos comparan contra esa función. Si el nivel se guardara dentro
 * de `power`, dejaría de ser "el poder de un T5 con potencial 3" y pasaría a ser "el
 * poder de uno al que ya le has subido cinco niveles", que es otra pregunta.
 *
 * Por eso el poder guardado es el de base y los multiplicadores se aplican al sumar el
 * ingreso.
 *
 * **Y AQUÍ ESTÁ EL MOTIVO DE QUE ESTA FUNCIÓN LLEVE LA RAREZA.** Antes el ingreso se
 * sumaba en `gameLoop.ts` con un `Math.round(power × multiplicadorDeNivel(level))` y el
 * stat se pintaba llamando a esta. **Dos copias del mismo cálculo en dos sitios**, que
 * es justo lo que R3 prohíbe: el día que se añadiese la rareza a una y no a la otra, el
 * número grande y el cobro se separaban sin que nada lo dijera. Ahora los dos llaman
 * aquí, y por eso la firma crece con la rareza y el potencial.
 */
export function poderEfectivoDeCompanio(comp: {
  power?: number;
  level?: number;
  rarity?: string;
  potential?: number;
}, extras?: { multArbol?: number; multAfijos?: number }): number {
  const bruto = (comp.power || 0)
    * multiplicadorDeNivel(comp.level)
    * multiplicadorDeCalidadDeCompanero(comp.rarity, comp.potential)
    // F97 Lote 2d · Los multis de la rama y de los afijos entran aquí para
    // que el número que cobra el ingreso sea el que enseña la ficha: son
    // parámetros opcionales para que los bancos que miden el poder base no
    // cambien. Sin ellos, el poder de siempre.
    * (extras?.multArbol ?? 1)
    * (extras?.multAfijos ?? 1);
  return Math.round(bruto);
}
/**
 * LO QUE LAS DOS FUSIONES TIENEN QUE COMPARECER.
 *
 * La forja fusiona recolectores y también compañeros. Las dos comparten cuatro
 * reglas: cuántos materiales entran, que sean **distintos**, que sean del mismo
 * tier y que la probabilidad y el premio del fallo sean los mismos. **Esas cuatro
 * están aquí, en un sitio**, porque duplicadas son cuatro oportunidades de que una
 * acepte tres materiales y la otra dos, o de que una pague más cristales que la otra.
 *
 * Lo que sí es distinto —qué se produce, de dónde sale su calidad— vive en cada
 * función, que es donde tiene que vivir: un recolector tiene afijos y un
 * compañero no.
 */
interface IntentosDeForja {
  craftLuck: number;
  /** Multiplicador del consuelo en cristales, del nodo del árbol. */
  consolationBonus: number;
  /**
   * Puntos del árbol a la subida de potencial (nodos de Potencial de la
   * Forja). Suman al lado del Éter, no en vez de él: el árbol acerca y el
   * Éter empuja, y ninguno de los dos llega solo a donde llegan juntos.
   */
  forgePotential?: number;
  stonesUsed: number;
  /**
   * 1 si se gasta una Nanopartícula de Estabilidad en esta fusión. Ya **no** toca la
   * probabilidad: su efecto entero es subir un escalón la rareza del recolector, y en
   * la fusión de compañeros no hace nada (la rareza del compañero no existe como eje).
   */
  nanoUsed?: number;
  /**
   * 1 si se gasta un Éter de Refinamiento en esta fusión. No toca la probabilidad de
   * acierto: suma `BONO_ETTER` puntos a la tirada de subida de potencial, que la hace
   * la fusión haya o no Éter.
   */
  eterUsed?: number;
  maxTier?: number;
  /** 1 si el nodo Obra Maestra permite firmar (dos ★5 en un ★5). */
  obraMaestra?: number;
  /** El dado. Sin él ninguna de las dos reglas se puede comprobar. */
  rng?: () => number;
}

/**
 * Las validaciones que no dependen de qué se está forjando.
 *
 * Devuelve el texto del error, o `null` si todo está bien. **Va ANTES de gastar
 * nada**, que es lo que protege al jugador: un rechazo después del cobro se
 * llevaría piedras y nanopartículas por una fusión que no ocurrió.
 */
export function validaMateriales(
  materials: Array<{ id: string; tier?: number; type?: string }>,
  tier: number,
  tipo: 'recolectores' | 'compañeros',
  maxTier = Infinity
): string | null {
  if (materials.length !== MATERIALES_POR_FUSION) {
    return `Se necesitan ${MATERIALES_POR_FUSION} ${tipo} del mismo tier.`;
  }
  // F24 · Dos POSICIONES no son dos MATERIALES. Sin esto, mandar el mismo id dos
  // veces cuenta como dos: se "fusiona" un solo item y sale otro, ahorrándose un
  // material. El que cuenta es el motor, no la vista.
  if (new Set(materials.map(m => m.id)).size !== MATERIALES_POR_FUSION) {
    return `Selecciona ${MATERIALES_POR_FUSION} ${tipo} distintos.`;
  }
  if (tier < 1 || tier >= maxTier) {
    return `No se pueden forjar ${tipo} de tier ${tier + 1}.`;
  }
  if (materials.some(m => (m.tier ?? 1) !== tier)) {
    return `Los ${MATERIALES_POR_FUSION} ${tipo} deben ser del mismo tier.`;
  }
  return null;
}

/**
 * La tirada: la probabilidad, y el premio del fallo.
 *
 * Sale de aquí en las dos fusiones, así que **a igualdad de materiales la
 * probabilidad es la misma** en las dos: el yunque es el mismo y el escribano
 * es el mismo. Lo que cambia son los materiales que cada una acepta, y por eso
 * la suerte de afijos solo cuenta en recolectores (ver abajo).
 */
export function tiraDeForja(
  tier: number,
  materials: Array<{ affixes?: string[]; rarity?: string }>,
  options: IntentosDeForja,
  cuentaAfijos = true
): { acierto: boolean; chance: number; crystals: number } {
  // Los compañeros no tienen afijos, así que aquí aportan cero. No es que se les
  // dé un trato peor: es que no tienen la entrada que suma esto.
  // F97 Lote 2d · Y CON AFIJOS INNATOS, TAMPOCO. Los de compañero son de
  // ingreso y no heredan en la forja (su eje es el potencial): contarlos aquí
  // pagaría suerte por algo que sale gratis en cada caja. Solo cuentan los de
  // recolector, que es lo que el plan de la serie promete al calcular piedras.
  const afixLuck = cuentaAfijos
    ? materials.reduce((acc, m) => acc + (m.affixes?.length || 0) * 0.02, 0)
    : 0;
  const chance = successChance(tier, options.craftLuck, options.stonesUsed, afixLuck);
  const rng = options.rng ?? Math.random;
  if (rng() <= chance) return { acierto: true, chance, crystals: 0 };

  // Fallo: lo único que deja es cristales.
  return {
    acierto: false,
    chance,
    crystals: cristalesDeConsuelo(tier, options.consolationBonus)
  };
}

/**
/**
 * CUÁNTOS CRISTALES DEJA UN FALLO DE FORJA, Y POR QUÉ SON ESTOS Y NO OTROS.
 *
 * **EL MOTIVO POR EL QUE EL FALLO NO PUEDE SER UN CALLEJÓN SIN SALIDA.** Un fallo
 * cuesta los dos materiales del yunque, y eso es un objeto de tier: en los niveles
 * altos es el equivalente a miles de nanitas. Sin más, la racha mala vacía el almacén
 * y el jugador deja de intentar; con algo que se lleva, la racha mala **cuesta pero
 * no empobrece**, y se sigue intentando.
 *
 * **POR QUÉ SUBE CON EL TIER.** Porque el coste del fallo también sube: dos T10
 * duelen mucho más que dos T1, y una compensación plana haría que el fallo fuera una
 * pesadilla al principio y gratis al final.
 *
 * **Y POR QUÉ NO ES TANTA COMO DA UNA CAJA.** Una caja de tier n da entre 3n y 5n
 * cristales, más el multiplicador de rareza. Aquí el fallo da 2 + n. La razón de que
 * la diferencia sea deliberada: **abrir cajas tiene que seguir siendo la forma buena
 * de conseguir cristales**, y la forja es la que se usa cuando ya tienes el material
 * en la mano. Si igualáramos las dos fuentes, las cajas dejarían de tener sentido y con
 * ellas el 30 % del botín que dan.
 *
 * **EL NÚMERO DEVUELTO SON INTENTOS, Y EL MOTOR LOS CONVIERTE.** El recurso es único,
 * así que esta función devuelve "cuántos intentos de nivel 0" y quien entrega los
 * multiplica por `valorDeUnCristal(tier)`. Multiplicar en el motor y no aquí es a
 * propósito: **el dinero lo decide quien lo paga.** Si esta función devolviera
 * unidades, la mitad de los llamadores podrían olvidar el factor y la forja valdría
 * casi cero en los niveles altos sin que nada lo delatara.
 *
 * El número está aquí y no en el motor porque es **la mitad de la regla del fallo**:
 * la otra mitad es la probabilidad, y las dos tienen que estar escritas una al lado de
 * la otra para que se vea que el fallo se paga. Y es **la misma función para las dos
 * fusiones**: si el recolector y el compañero dieran distinto, serían dos reglas.
 *
 * ## POR QUÉ EL FALLO PAGA CRISTALES Y NADA MÁS
 *
 * Antes pagaba **esquirlas y cristales**, y las esquirlas eran una moneda **sin ninguna
 * salida**: se acumulaban, se guardaban entre ascensiones y no se gastaban en nada. La
 * forja se paga con dos recolectores, no con esquirlas. Eran un contador que subía y
 * una palabra nueva que aprender, a cambio de nada.
 *
 * Así que el fallo paga **una sola cosa, y es la que se puede gastar**: cristales, que
 * suben de nivel. Lo que se conserva del reparto viejo es lo que sí tenía sentido —que
 * el nodo `shard_sifter` multiplicase el premio del fallo—, y ahora multiplica estos.
 * Su identificador **no se cambia**, porque es la clave con la que el nivel del nodo está
 * guardado en cada partida: renombrarla le quitaría la bonificación de golpe a quien ya
 * la tuviera comprada, además de dejar inalcanzables los dos nodos que la tienen como
 * requisito.
 *
 * **LO QUE ESTO COBRA, Y SE DICE.** El fallo paga menos que antes, porque lo que ya no se
 * paga era una moneda muerta. La cifra de los cristales es la de siempre y el
 * multiplicador del árbol es el de siempre, así que el cambio se ve en un sitio: en el
 * botín del fallo.
 */
export function cristalesDeConsuelo(tier: number, bonus = 0): number {
  return Math.round((2 + Math.max(1, Math.floor(tier))) * (1 + bonus));
}

/**
 * Intenta fusionar 2 recolectores del mismo tier.
 * - Si tiene éxito: devuelve el nuevo recolector, los 2 materiales se consumen.
 * - Si falla: se consumen los materiales y se pagan cristales de consuelo.
 */
export function attemptForge(
  materials: CollectorItem[],
  tier: number,
  authorName: string,
  options: IntentosDeForja
): ForgeResult {
  const rng = options.rng ?? Math.random;
  const maxTier = options.maxTier ?? Infinity; // Forja infinita: el precio frena solo

  const error = validaMateriales(materials, tier, 'recolectores', maxTier);
  if (error) return { success: false, error };

  const tira = tiraDeForja(tier, materials, options);
  if (!tira.acierto) {
    return { success: false, crystals: tira.crystals, chanceUsed: tira.chance };
  }

  // Éxito: construir el recolector.
  // F33 · El potencial es la MEDIA de los dos materiales, y es el potencial lo
  // que decide el daño. Antes salía de `rollPotential`, que lo tiraba de la
  // rareza, y el daño era el punto medio del rango: un item forjado nunca podía
  // salir en el máximo ni con materiales perfectos.
  //
  // Y ojo con la consecuencia, que era la que hacía útil la forja: promediar
  // NUNCA subía el resultado. Un 5 salía de un 5, y un 4 de un 4 y un 5. O sea
  // que la perfección se conseguía en la tienda o en las cajas, y la forja era
  // la que **consolidaba**: te daba el potencial que querías sin depender del azar.
  //
  // **LA ENMIENDA, Y VA ESCRITA AQUÍ PORQUE ES LA EXCEPCIÓN.** La fusión tira
  // además por subir ese promedio UNA estrella, con `PROB_SUBE_POTENCIAL` —20 % de
  // ★1 a ★2, bajando hasta 5 % de ★4 a ★5—, y el Éter de Refinamiento suma
  // `BONO_ETTER` puntos a esa probabilidad. F102: los nodos de Potencial del
  // árbol (`options.forgePotential`) suman los suyos a la misma tirada, en las
  // dos fusiones. La media sigue saliendo en la tirada
  // normal: lo que pasa es que ahora hay una tirada más, y es la única vía con la
  // que la forja pone algo por encima de lo que ya había. El ★5 no sube —no hay
  // escalón encima—, y el Éter se gasta aunque la tirada falle, igual que las piedras.
  let potential = potencialFusionado(materials.map((m) => potencialDe(m)));
  if (potential < 5) {
    const probSubida = (PROB_SUBE_POTENCIAL[potential] ?? 0)
      + ((options.eterUsed ?? 0) > 0 ? BONO_ETTER : 0)
      + (options.forgePotential ?? 0);
    if (rng() < probSubida) potential += 1;
  }
  const newTier = tier + 1;
  const obra = esObraMaestra(materials, potential, (options.obraMaestra ?? 0) > 0);
  const name = forgeCollectorName(potential, newTier, rng, obra);

  // F74 · LA BASE FORJADA ES LA MEDIA DE LAS POSICIONES. Dos bases 10 dan un 10
  // y dos 5 dan un 5: promediar nunca sube, igual que el potencial. Si el tier
  // nuevo no tiene tabla (T11+), no hay base: el item sale neutro, no roto.
  const posNueva = posicionFusionada(
    posicionDeBase(materials[0]?.baseId),
    posicionDeBase(materials[1]?.baseId)
  );
  const baseNueva = basePorPosicion(newTier, posNueva, 'recolector') ?? null;

  // El daño sale del potencial, de la base del tier nuevo y de la base forjada.
  // Una sola función, y la misma que usa la tienda, así que potencial, base y
  // daño no pueden separarse.
  const damage = danioDeRango(newTier, potential, baseNueva);

  // La rareza va ANTES que los afijos, porque es lo que decide cuántos lleva: la
  // rareza da el mínimo y el tope es 6 para todos.
  //
  // **Y LA RAREZA SALE DE LOS MATERIALES, NO SOLO DEL TIER (F60).** Si los dos
  // comparten rareza, el resultado la conserva 3 de cada 4 veces: dos Comunes
  // dan un Común casi siempre. Si no comparten, sale la calculada de siempre.
  let rarity = rarezaFusionada(materials[0]?.rarity, materials[1]?.rarity, collectorRarity(newTier, potential), rng);
  // **LA NANOPARTÍCULA ES ESTA TIRADA, Y SOLO ESTA.** Ya no toca la probabilidad
  // de acierto ni los afijos: su efecto entero es subir un escalón la rareza del
  // resultado, la mitad de las veces, topado en Divino. Y va DESPUÉS de la rareza
  // decidida porque se aplica encima de ella, no en su lugar: conservar la
  // compartida y subirla después son las dos cosas, en ese orden.
  if ((options.nanoUsed ?? 0) > 0 && rng() < PROB_NANO_SUBE_RAREZA) {
    rarity = subirRareza(rarity);
  }
  const affixes = pickAffixes(materials, rarity, rng);

  const collector: CollectorItem = {
    id: `forged_${Date.now()}_${rng().toString(36).substring(2, 8)}`,
    name,
    type: 'collector',
    details: `Recolección por click: +${damage}`,
    rarity,
    tier: newTier,
    level: 0,
    // El techo mira potencial y base (F74): 20 + 2 por estrella y medio punto por
    // posición de base. La misma regla que lee todo el mundo, para que el techo
    // que se crea y el que se comprueba no puedan separarse.
    maxLevel: techoDeNivel(potential, posNueva),
    potential,
    damage,
    baseId: baseNueva?.id,
    affixes,
    forgedBy: authorName,
    forgedAt: Date.now(),
    lineage: materials.map(m => m.rarity),
    sellPrice: 0, // se calcula dinámicamente
    ...(obra ? { obraMaestra: true as const } : {})
  };

  return { success: true, collector, chanceUsed: tira.chance };
}

/**
 * Intenta fusionar 2 compañeros del mismo tier.
 *
 * **LO QUE PRODUCE Y DE DÓNDE SALE SU CALIDAD, Y POR QUÉ NO ES IGUAL AL
 * RECOLECTOR.** El recolector forjado hereda **afijos** de la rareza de sus
 * materiales. El compañero no tiene afijos: su eje de calidad es el
 * **potencial**, y sale de la media de los dos, con la misma regla que el del
 * recolector —promediar no sube por sí solo—, **más la misma tirada de
 * potencial** que tira la de recolectores: una estrella más con
 * `PROB_SUBE_POTENCIAL`, y `BONO_ETTER` puntos si se gasta Éter.
 *
 * **QUÉ PASA AHORA CON LA NANOPARTÍCULA AQUÍ: NO HACE NADA, Y NO SE COBRA.**
 * Antes su efecto en el compañero era +1 de potencial; con la nanopartícula
 * pasando a subir la rareza —que en un compañero no existe como eje, la suya la
 * pone el tier—, no le queda ningún efecto. La vista no la ofrece para esta
 * fusión y el motor la ignora sin cobrarla: cobrar 90 000 nanitas por nada es
 * exactamente el engaño que no se perdona. Lo único que sube el potencial por
 * encima de la media en esta fusión es la tirada, con o sin Éter.
 */
export function attemptForgeCompanion(
  materials: Array<{ id: string; tier?: number; rarity?: string; potential?: number; baseId?: string }>,
  tier: number,
  options: IntentosDeForja
): { success: boolean; companion?: any; error?: string; crystals?: number; chanceUsed?: number } {
  const rng = options.rng ?? Math.random;
  const maxTier = options.maxTier ?? Infinity;

  const error = validaMateriales(materials, tier, 'compañeros', maxTier);
  if (error) return { success: false, error };

  // Sin suerte de afijos: los innatos del compañero son de ingreso y no
  // heredan, y contarlos pagaría probabilidad por algo gratis.
  const tira = tiraDeForja(tier, materials, options, false);
  if (!tira.acierto) {
    return { success: false, crystals: tira.crystals, chanceUsed: tira.chance };
  }

  const newTier = tier + 1;

  // **LA MEDIA PRIMERO Y LA TIRADA ENCIMA.** El orden es el de siempre: si el
  // ascenso entrara antes de promediar, dos 5 subirían a 6 y `potencialNormalizado(6)`
  // no es un 6, es un 3 —dos 5 salían peor que sin Éter, sin decir nada—. Promediar
  // primero y tirar después mantiene que la media es lo que sale, con el ascenso como
  // lo único que la puede superar.
  let potential = potencialFusionado(materials.map((m) => m.potential));
  if (potential < 5) {
    const probSubida = (PROB_SUBE_POTENCIAL[potential] ?? 0)
      + ((options.eterUsed ?? 0) > 0 ? BONO_ETTER : 0)
      + (options.forgePotential ?? 0);
    if (rng() < probSubida) potential += 1;
  }

  // F74 · La base forjada es la media de las posiciones, igual que el recolector.
  const posNueva = posicionFusionada(
    posicionDeBase(materials[0]?.baseId),
    posicionDeBase(materials[1]?.baseId)
  );
  const baseNueva = basePorPosicion(newTier, posNueva, 'companero') ?? null;

  const forjado: any = crearCompanioDeTier(newTier, potential, rng, baseNueva);
  // La obra también se firma aquí, con la misma regla y el mismo sufijo: un
  // compañero perfecto de padres perfectos es tan obra como un recolector.
  if (esObraMaestra(materials, potential, (options.obraMaestra ?? 0) > 0)) {
    forjado.obraMaestra = true;
    forjado.name = `${forjado.name}·Obra Maestra`;
  }
  return { success: true, companion: forjado, chanceUsed: tira.chance };
}

function collectorRarity(tier: number, potential: number): Rarity {
  const base = rarezaDeTier(tier) as Rarity ?? 'Común';
  if (potential >= 5 && tier >= 9) return 'Divino';
  if (potential >= 4 && tier >= 7) return 'Mítico';
  if (potential >= 3 && tier >= 5) return 'Legendario';
  if (potential >= 2 && tier >= 3) return 'Épico';
  return (base as Rarity) || 'Común';
}

/**
 * LA RAREZA QUE LA FORJA ANUNCIA ANTES DE TIRAR EL DADO (F76).
 *
 * Es la calculada del recolector —`collectorRarity()` con el tier nuevo y el
 * potencial promedio del yunque— sin la tirada de conservar la compartida, sin
 * la tirada de subida de potencial y sin la Nanopartícula. Las tres son dados
 * que todavía no salieron, así que lo único honesto que se puede enseñar es el
 * suelo: si la ★ sube y cruza un umbral, o si la compartida se conserva, la
 * rareza final es ESA o mejor, nunca peor. Por eso la línea de la pantalla dice
 * "calculada" y no "sale".
 */
export function rarezaCalculadaDeForja(newTier: number, potencialPromedio: number): Rarity {
  return collectorRarity(newTier, potencialPromedio);
}

/**
 * LA RAREZA QUE UN COMPAÑERO FORJADO TRAE DEL TIER, EN UNA SOLA FUNCIÓN.
 *
 * La pone el tier y nada más: ni la de los materiales, ni la tirada, ni la
 * Nanopartícula (que en compañeros no se cobra). Vivía escrita a mano dentro
 * de `crearCompanioDeTier()` y la pantalla la necesitaría igual para anunciar
 * el resultado antes de forjar (F76): dos copias de la misma tabla son dos
 * oportunidades de que una diga Divino y la otra Común.
 */
export function rarezaDeCompanionForjado(tier: number): string {
  return TIER_SYSTEM.rarityByTier[tier as keyof typeof TIER_SYSTEM.rarityByTier] || 'Común';
}

/**
 * LA PROBABILIDAD DE CONSERVAR LA RAREZA COMPARTIDA, Y POR QUÉ ES UN NÚMERO.
 *
 * Dos materiales de la misma rareza "probablemente" dan esa rareza: 3 de cada
 * 4 veces la conserva, 1 de cada 4 sale la calculada. Es una decisión de
 * equilibrio con nombre propio para que se pueda mover sin tocar la regla, y
 * los bancos la clavan por los dos lados.
 */
export const PROB_CONSERVA_RAREZA = 0.75;

/**
 * LA RAREZA SALE DE LOS MATERIALES, NO SOLO DEL TIER.
 *
 * Si los dos materiales comparten rareza, el resultado la conserva con
 * `PROB_CONSERVA_RAREZA` y si no, sale la calculada de siempre. Es la mitad de
 * "forzar por probabilidades": dos Comunes dan un Común casi siempre, y dos
 * Legendarios conservan su escalón en vez de caer al que toque por tier.
 *
 * **Y SI LA RAREZA COMPARTIDA NO ES UNA RAREZA, NO SE CONSERVA NADA.** Un item
 * viejo o corrupto puede traer cualquier cadena en `rarity`, y conservarla
 * sería fabricar un item de una rareza que el juego no conoce: sin precio, sin
 * suelo de afijos y sin color. La compartida tiene que estar en el catálogo
 * de rarezas o no cuenta como compartida.
 */
export function rarezaFusionada(
  rarA: string | undefined, rarB: string | undefined, calculada: Rarity,
  rng: () => number = Math.random
): Rarity {
  const compartida = rarA && rarA === rarB && (RARITY_ORDER as readonly string[]).includes(rarA)
    ? (rarA as Rarity)
    : null;
  if (compartida && rng() < PROB_CONSERVA_RAREZA) return compartida;
  return calculada;
}

/**
 * UN ESCALÓN ARRIBA EN LA ESCALERA DE RAREZAS, TOPADO EN DIVINO.
 *
 * Es lo que hace la Nanopartícula de Estabilidad al recolector forjado, la mitad de
 * las veces (`PROB_NANO_SUBE_RAREZA`). Sube un escalón
 * en `RARITY_ORDER`, la misma lista que ordena las rarezas en todo el juego, así que
 * "un escalón" no está escrito en ningún sitio: si mañana se añade una rareza entre
 * Épico y Legendario, la nanopartícula la atraviesa sin tocar nada.
 *
 * **Y EL TOPE ES DIVINO, NO UN NÚMERO.** Un resultado ya Divino se queda donde está:
 * el índice no pasa del último, y la nanopartícula se gasta igual. Subir de Divino
 * sería fabricar una rareza que el juego no conoce —sin color, sin precio y sin suelo
 * de afijos—, que es exactamente lo que ya evita `rarezaFusionada()` al mirar que la
 * compartida exista en el catálogo.
 */
export function subirRareza(rareza: string): Rarity {
  const i = RARITY_ORDER.indexOf(rareza as Rarity);
  if (i < 0) return rareza as Rarity;
  return RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, i + 1)];
}

/**
 * LOS AFIJOS QUE TRAEN LOS DOS MATERIALES, EN ORDEN.
 *
 * Es la otra mitad de "forzar por probabilidades": lo compartido entra primero
 * en el item, mientras haya hueco. El orden es el de aparición (primero lo del
 * primer material), no un sorteo: forzar es elegir, y un sorteo entre
 * compartidos sería forzar a medias. Los ids que no están en el catálogo no
 * entran, que es lo mismo que ya filtraba la herencia.
 */
export function afijosCompartidos(materials: Array<{ affixes?: string[] }>): string[] {
  if (materials.length < 2) return [];
  const delSegundo = new Set(materials[1].affixes ?? []);
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const id of materials[0].affixes ?? []) {
    if (vistos.has(id)) continue;
    vistos.add(id);
    if (delSegundo.has(id) && AFFIXES.some(a => a.id === id)) salida.push(id);
  }
  return salida;
}

/**
 * Cuántos afijos lleva como MÍNIMO un item de cada rareza. El tope son 6.
 *
 * **`Divino` SE LLEVA EL TOPO ENTERO.** Antes el sexto escalón era `Sobrecargado`
 * y el que llevaba los 6 afijos; con esa rareza fuera, un item con 6 afijos
 * tiene que ser `Divino`, o el tope de afijos es inalcanzable y la regla de
 * "más rareza, más afijos" deja de tener final. La rareza la pone el tier —o el
 * potencial, en la forja—, así que un Divino de T9 forjado con buenos materiales
 * es el item más completo del juego, que es lo que tenía que ser.
 */
export const AFIX_MIN_POR_RARIDAD: Record<string, number> = {
  'Común': 0, 'Raro': 1, 'Épico': 2, 'Legendario': 3,
  'Mítico': 4, 'Divino': 6
};

/** El tope de afijos de un item. Nadie lleva más de estos. */
export const AFIX_MAX = 6;

/**
 * Cuántos afijos lleva un item forjado: EL DE SU RAREZA, NI UNO MÁS NI UNO MENOS.
 *
 * **F97: LA RAREZA MANDA Y EL LINAJE ELIGE CUÁLES.** Antes había suelo (la tabla)
 * y techo (suelo + linaje): dos materiales buenos daban un item con MÁS afijos.
 * Ahora la cantidad es fija por rareza —si un forjado lleva 2 afijos, es Épico
 * por construcción— y los padres deciden *cuáles* (los compartidos entran
 * primero, que ya existía). Un Común lleva 0 siempre, aunque sus padres fueran
 * buenos; un Divino lleva los 6, que es el tope entero.
 *
 * El parámetro `materials` se conserva porque los llamadores lo pasan y la
 * regla se lee "para estos materiales", pero la cantidad ya no sale de ahí:
 * sale de la tabla. Quien busque de dónde salen los *cuáles*, es `pickAffixes()`.
 */
export function rangoDeAfijosForjados(
  materials: CollectorItem[], rarity: string
): { minimo: number; maximo: number } {
  void materials;
  const suelo = AFIX_MIN_POR_RARIDAD[rarity] ?? 0;
  const fijo = Math.max(0, Math.min(suelo, AFIX_MAX));
  return { minimo: fijo, maximo: fijo };
}

/**
 * LOS AFIJOS DE UNA RAREZA, Y CÓMO SE DICEN EN PALABRAS.
 *
 * F51. La regla "más rareza, más afijos" estaba escrita en un comentario y en
 * ninguna parte que el jugador pudiera leer. La pregunta que se hacía —"¿cuántos
 * afijos puede tener un Mítico?"— tiene respuesta exacta y la daba la tabla,
 * así que lo que faltaba no era el número: era que alguien lo dijera.
 *
 * **Y EL NÚMERO NO SE ESCRIBE AQUÍ, SE LEE DE LA TABLA.** Esta función monta la
 * frase con `AFIX_MIN_POR_RARIDAD[rareza]`, de modo que el día que la tabla suba
 * un peldaño la frase lo dice sola. Una explicación con el número escrito a mano
 * es una segunda fuente de la verdad, y es exactamente el tipo de cosa que se
 * queda diciendo la regla vieja después de que la regla haya cambiado.
 *
 * **Y YA NO DICE "FORJADO".** Desde F97 los afijos salen de tienda, caja y forja
 * por igual: un "Mítico forjado lleva 4" sin ese matiz haría pensar que el de la
 * tienda es distinto, y es el mismo objeto con la misma regla.
 */
export function fraseDeAfijosDeRareza(rareza: string): string {
  const n = AFIX_MIN_POR_RARIDAD[rareza];
  if (n === undefined) return '';
  if (n === 0) return `Un ${rareza} no lleva afijos.`;
  if (n >= AFIX_MAX) {
    return `Un ${rareza} lleva los ${AFIX_MAX} afijos: no puede llevar ni uno más.`;
  }
  return `Un ${rareza} lleva ${n} afijos.`;
}

/**
 * LA EXPLICACIÓN COMPLETA, EN UNA FRASE QUE CABE EN UNA TARJETA.
 *
 * Las dos mitades de la regla, que es lo que el jugador no puede deducir:
 * **la cantidad la pone la rareza** —un Épico lleva 2 salga de donde salga— y
 * **los *cuáles* los pone el linaje en la forja** —los compartidos entran
 * primero, y por eso buscar buenos padres vale algo—. Con una regla y sin la
 * otra, la mitad de las preguntas que se hacen en la forja no tienen respuesta.
 *
 * El texto se arma con `AFIX_MAX` y con la lista de rarezas de
 * `AFIX_MIN_POR_RARIDAD`, en el mismo orden que el juego las ordena, para que
 * añadir una rareza nueva no deje un texto que se la salta en silencio.
 */
export function explicacionDeAfijos(): string {
  const tabla = Object.entries(AFIX_MIN_POR_RARIDAD)
    .map(([rareza, n]) => `${rareza} ${n}`)
    .join(' · ');
  return `Cada rareza lleva sus afijos (${tabla}), salgan de tienda, caja o forja, `
    + `hasta ${AFIX_MAX}. En la forja, los que comparten tus dos materiales entran primero.`;
}

/**
 * LA TIRADA DE POTENCIAL, EN UNA FRASE QUE SALE DE LOS NÚMEROS.
 *
 * Igual que `explicacionDeAfijos()`: **la cifra no está escrita en el texto, se lee de
 * `PROB_SUBE_POTENCIAL` y de `BONO_ETTER`**, así que el día que cambie la probabilidad
 * de ★4→5 la frase la dice sola. Con el número escrito a mano, la tienda seguiría
 * anunciando el valor viejo y el dado tiraría otro, que es R3 con dos semanas de retraso.
 */
export function explicacionDePotencial(): string {
  const filas = [1, 2, 3, 4]
    .map(st => `★${st}→★${st + 1} un ${pctDe(PROB_SUBE_POTENCIAL[st] ?? 0)} %`)
    .join(', ');
  return `La forja sube el potencial una estrella con probabilidad ${filas}; `
    + `el Éter de Refinamiento suma ${pctDe(BONO_ETTER)} puntos a esa probabilidad, `
    + `y los nodos de Potencial del árbol suman los suyos a la misma tirada.`;
}

/**
 * Reparte los afijos del item forjado.
 *
 * **LA RAREZA DA EL NÚMERO Y EL LINAJE DA LOS NOMBRES (F97).** El item lleva
 * exactamente los de su tabla, y la mezcla decide cuáles: primero lo que traen
 * **los dos materiales**, en orden —es lo que permite forzar un afijo—, después
 * al azar entre el resto de lo que traen entre los dos, y si aún faltan se
 * rellena del catálogo con los raros pesando menos. Con un número que dependiera
 * de los padres, un Mítico saldría a veces con 2 y "lleva 4" mentiría.
 *
 * **La mezcla es en dos pasos, y ese orden es lo que la hace tener sentido:**
 *
 * 1. Primero lo que traen **los dos materiales**, en orden: es lo que permite
 *    forzar un afijo. Después, al azar entre el resto de lo que tienen entre
 *    los dos. Es la herencia: los afijos buenos se transmiten de verdad, y por
 *    eso buscar un item con buenos afijos tiene recompensa.
 * 2. Si aún faltan para llegar al número de la rareza, se rellenan **al azar
 *    de todo el catálogo**, con los raros pesando menos.
 *
 * El paso 1 va primero a propósito. Si rellenara de catálogo y luego heredara,
 * muchas veces no quedaría hueco para heredar y el paso 1 casi no se vería.
 *
 * Con dos materiales no se puede pasar de 12 afijos distintos, pero el tope de 6
 * hace esa cuenta irrelevante.
 */
function pickAffixes(
  materials: CollectorItem[], rarity: string,
  rng: () => number = Math.random
): string[] {
  const { minimo } = rangoDeAfijosForjados(materials, rarity);

  // **YA NO HAY DADO DE CANTIDAD (F97).** El objetivo es el de la rareza, fijo:
  // el azar solo decide *cuáles* (paso 1 y 2 de abajo), no *cuántos*. Con un
  // dado aquí, un Mítico saldría a veces con 2 y a veces con 4, y "lleva 4"
  // dejaría de ser verdad.
  const objetivo = minimo;
  if (objetivo <= 0) return [];

  const picked: string[] = [];
  const usados = new Set<string>();

  // 1 · Herencia: primero lo que traen LOS DOS, en orden. Es lo que permite
  // forzar un afijo: dos materiales con Baluarte lo ponen el primero mientras
  // haya hueco. Después, al azar entre el resto de lo que traen juntos.
  const compartidos = afijosCompartidos(materials);
  for (const id of compartidos) {
    if (picked.length >= objetivo) break;
    picked.push(id);
    usados.add(id);
  }
  const heredables: string[] = [];
  for (const m of materials) {
    for (const id of m.affixes ?? []) {
      if (!usados.has(id) && !heredables.includes(id) && AFFIXES.some(a => a.id === id)) {
        heredables.push(id);
      }
    }
  }
  while (picked.length < objetivo && heredables.length > 0) {
    const i = Math.floor(rng() * heredables.length);
    const id = heredables[i];
    picked.push(id);
    usados.add(id);
    heredables.splice(i, 1);
  }

  // 2 · Relleno del catálogo completo, con los afijos raros pesando menos.
  const restantes = AFFIXES.filter(a => !usados.has(a.id));
  while (picked.length < objetivo && restantes.length > 0) {
    const weights = restantes.map(a => 1 / (0.5 + (RARITY_WEIGHT[a.rarity] ?? 1)));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * total;
    let idx = 0;
    for (; idx < restantes.length - 1; idx++) {
      roll -= weights[idx];
      if (roll <= 0) break;
    }
    picked.push(restantes[idx].id);
    restantes.splice(idx, 1);
  }

  return picked;
}

/**
 * Sorteo ponderado del catálogo, sin repetir y saltando los excluidos.
 *
 * Es el paso 2 de la mezcla de la forja sacado a función: los tres que sortean
 * afijos —la forja no, que hereda primero— tiran de aquí para no tener tres
 * dados con tres pesos. Los raros pesan menos, como siempre.
 */
function sorteaAfijos(
  cantidad: number,
  excluidos: string[],
  rng: () => number = Math.random,
  pool: Affix[] = AFFIXES
): string[] {
  const restantes = pool.filter(a => !excluidos.includes(a.id));
  const picked: string[] = [];
  while (picked.length < cantidad && restantes.length > 0) {
    const weights = restantes.map(a => 1 / (0.5 + (RARITY_WEIGHT[a.rarity] ?? 1)));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * total;
    let idx = 0;
    for (; idx < restantes.length - 1; idx++) {
      roll -= weights[idx];
      if (roll <= 0) break;
    }
    picked.push(restantes[idx].id);
    restantes.splice(idx, 1);
  }
  return picked;
}

/**
 * LOS AFIJOS DE UNA RAREZA, SORTEADOS DEL CATÁLOGO (F97).
 *
 * Es el `pickAffixes()` sin padres: la cantidad fija de la tabla y los *cuáles*
 * al azar con los raros pesando menos (los mismos pesos del paso 2 de la
 * mezcla). Lo usan el generador —tienda y cajas sacan de aquí— y la migración
 * de items viejos, que no tienen de dónde heredar. La forja NO lo usa: ella
 * hereda con `pickAffixes()`, que es lo que la hace forja y no lotería.
 */
export function afijosParaRareza(
  rarity: string,
  rng: () => number = Math.random
): string[] {
  const objetivo = AFIX_MIN_POR_RARIDAD[rarity] ?? 0;
  const tope = Math.max(0, Math.min(objetivo, AFIX_MAX));
  if (tope <= 0) return [];
  // Sin semilla ni orden: cada llamante tira su propio dado, como `rollPotentialFrom()`.
  return sorteaAfijos(tope, [], rng);
}

/**
 * TODO RECOLECTOR CON AFIJOS LOS DE SU RAREZA, NI UNO MÁS NI UNO MENOS (F97).
 *
 * Va en cada carga, como `migraPotenciales()`, y es idempotente: lo que ya
 * cumple la tabla no se toca y devuelve el mismo array.
 *
 * Tres casos, y cada uno tiene su motivo:
 * - **Sin campo** (tienda y cajas viejas, que nunca lo traían): se sortean los
 *   de su rareza. Sin esto, un Épico viejo con 0 afijos conviviría con uno nuevo
 *   con 2 y la regla mentiría por la mitad del almacén.
 * - **Con campo**: se quitan los ids que no están en el catálogo (`aff_luck` y
 *   cualquier invento) y se recorta o rellena hasta la tabla. El recorte duele
 *   en un caso —un Común forjado con afijos de linaje los pierde— y es lo
 *   pedido: Común son 0 siempre.
 * - **Rareza desconocida**: no se inventa nada; se limpia lo desconocido y se
 *   deja lo que hay. Una rareza que nadie conoce no puede pedir una cantidad.
 */
export function migraAfijosPorRareza(
  items: any[],
  rng: () => number = Math.random
): { items: any[]; changed: boolean } {
  let changed = false;
  const salida = items.map((w) => {
    if (w?.type !== 'collector') return w;
    const objetivo = AFIX_MIN_POR_RARIDAD[w.rarity];
    const conocidos = Array.isArray(w.affixes)
      ? (w.affixes as any[]).filter(id => AFFIXES.some(a => a.id === id))
      : null;
    if (objetivo === undefined) {
      // Rareza que no está en la tabla: solo limpieza, sin asignar ni recortar.
      if (conocidos !== null && conocidos.length !== (w.affixes as any[]).length) {
        changed = true;
        return { ...w, affixes: conocidos };
      }
      return w;
    }
    const tope = Math.max(0, Math.min(objetivo, AFIX_MAX));
    let lista = conocidos ?? [];
    // Relleno con lo que no esté ya, con el mismo sorteo de arriba.
    if (lista.length < tope) {
      lista = [...lista, ...sorteaAfijos(tope - lista.length, lista, rng)];
    } else if (lista.length > tope) {
      lista = lista.slice(0, tope);
    }
    const antes = Array.isArray(w.affixes) ? (w.affixes as any[]) : null;
    if (antes !== null && antes.length === lista.length && antes.every((id, i) => id === lista[i])) return w;
    if (antes === null && lista.length === 0) {
      // Sin campo y con tabla en 0 (Común): se escribe el [] para que la
      // invariante "todo recolector trae su lista" valga en todo el almacén.
      changed = true;
      return { ...w, affixes: [] };
    }
    changed = true;
    return { ...w, affixes: lista };
  });
  if (!changed) return { items, changed: false };
  return { items: salida, changed: true };
}

/**
 * EL POOL DE AFIJOS DE COMPAÑERO (F97 Lote 2d).
 *
 * El mismo catálogo menos los de crítico puro (`aff_crit`, `aff_focus`): un
 * compañero no critica, así que sortearle un afijo que solo da crítico sería
 * sortearle un hueco vacío. `aff_void` se queda porque sus multis sí aplican.
 * El sorteo y los pesos son los de siempre (`sorteaAfijos()` con otro pool).
 */
export function afijosParaCompanero(
  rarity: string,
  rng: () => number = Math.random
): string[] {
  const objetivo = AFIX_MIN_POR_RARIDAD[rarity] ?? 0;
  const tope = Math.max(0, Math.min(objetivo, AFIX_MAX));
  if (tope <= 0) return [];
  return sorteaAfijos(tope, [], rng, POOL_AFIJOS_COMPANERO);
}

/**
 * EL EFECTO DE LOS AFIJOS DE UN COMPAÑERO, SEGÚN SU TIPO (F97 Lote 2d).
 *
 * Los afijos hablan dos idiomas y el compañero solo entiende uno: en un
 * `passive` cuenta lo de pasivo (base y por niveles), en un `click` lo de
 * click, y en un `multiplier` nada —su aura es fija y no lleva afijos—.
 * La magnitud escala por tier como en el recolector (`potenciaDeAfijoPorTier`):
 * el mismo afijo pega más en un tier alto. El crítico no se lee en ningún
 * tipo: los compañeros no critican.
 */
export function efectoDeAfijosDeCompanero(
  affixIds: Array<string> | undefined | null,
  nivel: number | undefined | null,
  tier: number | undefined | null,
  tipo: string | undefined | null
): number {
  const ids = Array.isArray(affixIds) ? affixIds : [];
  const nv = Number(nivel) || 0;
  const potencia = tier === null || tier === undefined ? 1 : potenciaDeAfijoPorTier(tier);
  let out = 0;
  for (const affixId of ids) {
    const affix = AFFIX_BY_ID[affixId];
    if (!affix) continue;
    if (tipo === 'passive') {
      out += (affix.effect.passiveMult || 0) * potencia;
      out += (affix.effect.passiveMultPorNiveles || 0) * (nv / 5) * potencia;
    } else if (tipo === 'click') {
      out += (affix.effect.clickMult || 0) * potencia;
      out += (affix.effect.clickMultPorNivel || 0) * nv * potencia;
    }
    // `multiplier` y lo desconocido: 0. El aura es fija y un tipo inventado
    // no puede multiplicar nada.
  }
  return out;
}

/**
 * LOS AFIJOS INNATOS DE LOS COMPAÑEROS, EN CADA CARGA (F97 Lote 2d).
 *
 * Solo fichas del almacén (`type === 'companion'`): en `state.companions`
 * vive lo que paga y el ingreso cruza por id, así que no hay segundo campo
 * que sincronizar. Se salta lo forjado (lleva `forgedBy` y la forja no da
 * afijos: su eje es el potencial), los `multiplier` y los sin tier (los
 * exclusivos de caja, de poder fijo y hechos a mano). Lo demás sigue la
 * tabla universal: si es Épico lleva 2.
 */
export function migraAfijosDeCompaneros(
  fichas: any[],
  rng: () => number = Math.random
): { fichas: any[]; changed: boolean } {
  let changed = false;
  const pool = POOL_AFIJOS_COMPANERO;
  const salida = (fichas ?? []).map((f) => {
    if (f?.type !== 'companion') return f;
    if (typeof (f as any).forgedBy === 'string' && (f as any).forgedBy) return f;
    if ((f as any).companionType === 'multiplier') return f;
    const tier = Number((f as any).tier);
    if (!Number.isFinite(tier) || tier < 1) return f;
    const objetivo = AFIX_MIN_POR_RARIDAD[(f as any).rarity];
    if (objetivo === undefined) return f;
    const tope = Math.max(0, Math.min(objetivo, AFIX_MAX));
    const conocidos = Array.isArray((f as any).affixes)
      ? ((f as any).affixes as any[]).filter(id => AFFIXES.some(a => a.id === id))
      : [];
    let lista = conocidos;
    if (lista.length < tope) {
      lista = [...lista, ...sorteaAfijos(tope - lista.length, lista, rng, pool)];
    } else if (lista.length > tope) {
      lista = lista.slice(0, tope);
    }
    const antes = Array.isArray((f as any).affixes) ? ((f as any).affixes as any[]) : null;
    if (antes !== null && antes.length === lista.length && antes.every((id, i) => id === lista[i])) return f;
    changed = true;
    return { ...f, affixes: lista };
  });
  if (!changed) return { fichas, changed: false };
  return { fichas: salida, changed: true };
}
