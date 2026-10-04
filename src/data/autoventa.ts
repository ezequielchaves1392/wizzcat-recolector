// ==========================================================================
//  AUTO-VENTA: QUÉ SE VENDE SOLO AL ABRIR CAJAS
//
//  La regla vive aquí y no en la hoja de la caja por dos razones que no son
//  estilo. La primera es que **la decide el motor**: el botín se aplica dentro de
//  `rollCrateReward()`, y si el filtro fuera de la vista, la vista tendría que
//  mirar cada premio que sale y decidir qué hacer con él —que es exactamente la
//  vista mutando el estado (R1)—. La segunda es que un filtro son cuatro reglas
//  (tipo, tier, potencial y "solo si cabe") y cada una necesita un banco; escritas
//  dentro de un manejador de clic no los tendría.
//
//  ## POR QUÉ NO VENDE TODO POR DEFECTO
//
//  Un "vende todo lo que salga" sin querer vacía el almacén de una partida entera
//  y no hay forma de deshacerlo: el juego no tiene Ctrl+Z, y con razón.
//
//  Por eso el conmutador maestro **viene apagado**, los tres tipos vienen apagados,
//  y los dos selectores vienen en "no vender". Encenderlo es una decisión, y la
//  casilla se queda a la vista —con lo que vende exactamente— para que nadie la
//  tome por reflejo.
//
//  ## Y POR QUÉ EL TOPE DE PRECIO SIGUE APLICÁNDOSE AL VENDER
//
//  Porque `sellPriceTope` existe para que **un premio de caja no valga más
//  vendido que la caja y la llave que lo dieron**. Venderlo automáticamente no
//  cambia de dónde sale el dinero: si el tope no se aplicara, la auto-venta sería
//  el camino para imprimir, que es justo lo que ese tope cierra.
// ==========================================================================

import { MAX_CRATE_TIER } from './store';
import { POTENTIAL_WEIGHTS } from './crafting';

/** Los tres tipos de item que se pueden enviar a la venta automática. */
export type TipoDeVentaAuto = 'collector' | 'companion' | 'consumable';

/** Los tres tipos, en el orden en que salen en la pantalla. */
export const TIPOS_DE_VENTA_AUTO: TipoDeVentaAuto[] = ['collector', 'companion', 'consumable'];

export interface ConfigAutoVenta {
  /** El conmutador maestro. Apagado por defecto, y no es un detalle. */
  activa: boolean;
  /** Qué tipos se venden. Apagados los tres por defecto. */
  tipos: Record<TipoDeVentaAuto, boolean>;
  /**
   * Vende solo los de tier **menor o igual** que este. `0` = sin tope.
   *
   * Va por "menor o igual" y no por "mayor o igual" porque la pregunta del
   * jugador al abrir cajas es siempre "¿cuándo dejo de necesitar esto?": un T9
   * sirve para forjar un T10 y encima es material de forja, así que el filtro que
   * se quiere es "los bajos se venden, los altos se guardan". Un filtro al revés
   * no lo usaría nadie.
   */
  tierMax: number;
  /**
   * Vende solo los de potencial **menor o igual** que este. `0` = sin tope.
   *
   * Es el otro eje del mismo problema, y va en la misma dirección: lo de ★5 es lo
   * que se busca, así que el filtro que se quiere es "los de una estrella se
   * venden". Y no es un invento: los dos topes van juntos porque casi siempre es
   * el mismo objeto el que se quiere descartar —el T2 de ★1 que no va a Place.
   */
  potencialMax: number;
}

export const AUTO_VENTA_POR_DEFECTO: ConfigAutoVenta = {
  activa: false,
  tipos: { collector: false, companion: false, consumable: false },
  tierMax: 0,
  potencialMax: 0
};

/**
 * Los topes que se pueden elegir, para la pantalla.
 *
 * El `0` es "sin tope" y va el primero porque es el que ya está puesto: un filtro
 * que nace sin límite se lee como "no filtra", que es exactamente lo que dice.
 */
/**
 * El tope de potencial sale de la tabla de pesos, no de un numero escrito aqui.
 *
 * `POTENTIAL_WEIGHTS` tiene las cinco claves y el filtro se offeringo hasta la tercera:
 * el desplegable decia "hasta star3" en un juego donde el star5 existe y se gana, y un
 * filtro de venta que no llega al tope **no puede decir "todo lo que no me sirva"**.
 * Lo que sale de un numero escrito al lado es exactamente esta clase de mentira.
 */
export const MAX_POTENCIAL: number = Math.max(
  ...Object.keys(POTENTIAL_WEIGHTS).map((k) => Number(k))
);

/**
 * Y el de tier sale del tope de caja, que es el techo de un item: los items vienen de
 * cajas y de forjas de items, asi que donde acaba la caja acaba el item.
 *
 * El mismo motivo: el desplegable llegaba a T5 en un juego con diez cajas.
 */
export const MAX_TIER_ITEM: number = MAX_CRATE_TIER;

/**
 * Los topes que se pueden elegir, para la pantalla.
 *
 * El `0` es "sin tope" y va el primero porque es el que ya esta puesto: un filtro
 * que nace sin limite se lee como "no filtra", que es exactamente lo que dice.
 */
export const TOPES_TIER: number[] = [0, ...Array.from({ length: MAX_TIER_ITEM }, (_, i) => i + 1)];
export const TOPES_POTENCIAL: number[] = [0, ...Array.from({ length: MAX_POTENCIAL }, (_, i) => i + 1)];

/** Normaliza un topes: entero, y por lo menos 0. Un `NaN` es "sin tope". */
function topeDe(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Coacciona un config que venga de donde venga —el guardado, un `localStorage`,
 * un banco— a la forma que el juego espera.
 *
 * **CADA CAMPO POR SEPARADO, Y POR QUE NO SE PUEDE CONFIAR EN EL OBJETO ENTERO.**
 * Una partida vieja no tiene el campo y sale `undefined`; uno a medio escribir
 * puede traer `"sí"` en `activa` o `tipos: true` en vez de un objeto de tres
 * banderas. Sin coaccionar, `cfg.tipos.collector` sería un fallo de ejecución en
 * el momento de abrir una caja, que es el peor sitio posible para un dato
 * corrupto: a mitad de un sorteo.
 *
 * Y **un tipo desconocido se ignora en vez de aceptarse**: un filtro que dice
 * "vende los `tornillos`" no puede activar la venta de nada, porque no hay tal
 * tipo. Aceptar cualquier cadena haría que un typo en el guardado vendiera
 * cosas de verdad.
 */
export function coaccionaAutoVenta(bruto: unknown): ConfigAutoVenta {
  const base = AUTO_VENTA_POR_DEFECTO;
  if (!bruto || typeof bruto !== 'object') return { ...base, tipos: { ...base.tipos } };
  const c = bruto as Partial<ConfigAutoVenta> & { tipos?: unknown };
  const tipos = { ...base.tipos };
  if (c.tipos && typeof c.tipos === 'object') {
    const t = c.tipos as Record<string, unknown>;
    for (const clave of TIPOS_DE_VENTA_AUTO) {
      // `=== true` y no "truthy": un `"false"` en el guardado es una cadena
      // verdadera, y un filtro de venta con un truthy equivocado destruye items.
      tipos[clave] = t[clave] === true;
    }
  }
  return {
    activa: c.activa === true,
    tipos,
    tierMax: topeDe(c.tierMax),
    potencialMax: topeDe(c.potencialMax)
  };
}

/** ¿Es un tipo de item que la auto-venta sabe mirar? */
export function esTipoDeVentaAuto(tipo: string): tipo is TipoDeVentaAuto {
  return (TIPOS_DE_VENTA_AUTO as string[]).includes(tipo);
}

/**
 * LA REGLA: ¿este item se vende en vez de entrar en el almacén?
 *
 * Devuelve `false` para todo lo que no sea un item vendible, **empezando por la
 * propia configuración apagada**. El orden no es decorativo: si el conmutador
 * maestro no está, no se mira nada, y eso hace que un filtro encendido con los
 * tres tipos apagados sea un no-op honesto en vez de "vende lo que no sea de tipo
 * conocido".
 *
 * Y **los topes no se pueden activar solos**: un `tierMax` de 2 sin ningún tipo
 * marcado no vende nada, porque no hay tipo al que aplicarse. Un filtro con el
 * tope puesto y el tipo apagado es una contradicción, y en una venta es mejor
 * que no haga nada a que haga algo.
 */
export function debeVenderseAuto(item: any, cfg: ConfigAutoVenta): boolean {
  if (!cfg || !cfg.activa) return false;
  const tipo = String(item?.type ?? '');
  if (!esTipoDeVentaAuto(tipo)) return false;
  if (!cfg.tipos[tipo]) return false;
  const marcados = TIPOS_DE_VentaAutoMarcados(cfg);
  if (marcados === 0) return false;

  if (cfg.tierMax > 0) {
    const tier = Math.max(1, Math.floor(Number(item?.tier) || 1));
    if (tier > cfg.tierMax) return false;
  }
  if (cfg.potencialMax > 0) {
    // El potencial **solo existe en los que lo tienen**: una caja o una carta no
    // lo traen, y tratarlo como potencial 3 --el valor por defecto de
    // `potencialNormalizado()`-- haría que un filtro de ★1 vendiera cosas que no
    // tienen estrellas. Un item sin potencial no es "depotential bajo": es otro
    // tipo de objeto, y lo decide el filtro de tipos.
    const p = item?.potential;
    if (typeof p !== 'number') return false;
    if (Math.round(p) > cfg.potencialMax) return false;
  }
  return true;
}

/** Cuántos tipos tiene marcados el filtro. Sale del bucle de arriba. */
function TIPOS_DE_VentaAutoMarcados(cfg: ConfigAutoVenta): number {
  let n = 0;
  for (const clave of TIPOS_DE_VENTA_AUTO) if (cfg.tipos[clave]) n++;
  return n;
}

/**
 * Una frase que diga qué se está vendiendo, para ponerla debajo del filtro.
 *
 * **ES LA FRASE QUE HACE SEGURO EL FILTRO.** Un conmutador encendido sin
 * explicación es el que se enciende por error; con "vende recolectores hasta T2
 * de ★2 o menos" debajo, el jugador lee lo que va a pasar antes de que pase. Y
 * sale de la configuración, no de un texto escrito al lado: si mañana el filtro
 * acepta otra cosa, la frase se queda diciendo lo que hace.
 *
 * Sin filtros de tipo marcados devuelve una frase que **dice que no va a
 * vender nada**, en vez de una lista vacía que parece un fallo.
 */
export function descripcionDeAutoVenta(cfg: ConfigAutoVenta, nombreDeTipo: (t: TipoDeVentaAuto) => string): string {
  if (!cfg.activa) return 'Apagada: todo lo que salga entra en el almacén.';
  const tipos = TIPOS_DE_VENTA_AUTO.filter((t) => cfg.tipos[t]).map(nombreDeTipo);
  if (tipos.length === 0) {
    return 'Encendida pero sin ningún tipo marcado: no se vende nada.';
  }
  const partes: string[] = [];
  partes.push(tipos.join(' y '));
  if (cfg.tierMax > 0) partes.push(`hasta T${cfg.tierMax}`);
  if (cfg.potencialMax > 0) partes.push(`de ★${cfg.potencialMax} o menos`);
  return `Vende ${partes.join(' ')} en vez de dejarlo en el almacén.`;
}