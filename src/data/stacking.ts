// ==========================================================================
//  Apilado del almacén · la regla, en un solo sitio
//
//  Qué es una ranura
// ------------------
//  UNA ranura es un item del array `state.warehouse`. Un item apilable lleva
//  sus unidades dentro (`stackCount`), así que 19 llaves ocupan UNA ranura y se
//  pintan en UNA celda con un "19" en la esquina.
//
//  El bug que vive aquí
//  --------------------
//  La rejilla y el contador de ranuras contaban cosas distintas. La rejilla
//  agrupaba los items iguales en una celda (`visibleStacksFor`) y el contador
//  contaba ENTRADAS del array. Con 19 items de llave guardados por separado la
//  pantalla pintaba una celda y decía "19 ranuras": el jugador veía 3 celdas
//  ocupadas y un contador que pedía 21.
//
//  La causa estaba en el game loop, que metía cada unidad como un item nuevo
//  (`state.warehouse.push(createMaterialItem(...))`) en vez de sumarla a la pila
//  que ya había. Cada caja abierta que soltaba una llave gastaba una ranura, y
//  el almacén se llenaba de llaves que el jugador nunca había pedido guardar.
//
//  Aquí vive la respuesta, y por eso vive aquí y no en la vista: el game loop
//  la necesita al meter cosas, y la vista la necesita al contarlas. Si son dos
//  copias, vuelven a divergir.
// ==========================================================================

/**
 * Los tipos cuyos items se acumulan en una sola celda.
 *
 * Un tipo que no esté en esta lista NUNCA se agrupa, por muchas unidades que
 * tenga. Dos recolectores son dos celdas aunque digan que son apilables: si se
 * fundieran, el jugador no podría elegir con cuál hacer clic.
 */
export const STACKABLE_TYPES = ['consumable', 'crate', 'key', 'crystal'] as const;

/**
 * Unidades que caben en la esquina de una celda antes de recortar el número.
 *
 * Es un tope DE PINTADO, no de almacenamiento. Llave y cristal admiten 99 porque
 * se gastan de uno en uno y 99 es de sobra; caja y consumible, 20, porque se
 * leen en un vistazo.
 */
export const MAX_STACK: Record<string, number> = {
  consumable: 20, crate: 20, key: 99, crystal: 99
};

/**
 * TOPE DE UNA PILA, Y ESTE SÍ ES DE ALMACENAMIENTO.
 *
 * Es la diferencia con `MAX_STACK`, y la diferencia es la que hace que
 * `countOccupiedSlots` no mienta:
 *
 *   · `MAX_STACK` es de **pintado**. "150 llaves" se teachan como "99+" porque el
 *     150 no cabe en la esquina, y siguen siendo **una** ranura. Las 150 llaves
 *     existen detrás de la pantalla (F30).
 *   · `TOPE_PILA` es de **almacenamiento**. Una caja no se apila más de 20: a la
 *     21 se abre una pila nueva, si hay sitio. Son dos ranuras, no una.
 *
 * **POR QUÉ LAS CAJAS Y NO LAS LLAVES.** Porque una caja es un objeto, no una
 * moneda: la rejilla tiene que poder teachas cuántas cajas hay sin que ese número
 * crezca sin límite, y porque sin tope el almacén entero se puede llenar de cajas
 * en dos ranuras —que es la forma más rápida de que un jugador nuevo bloquee su
 * propio almacén sin enterarse—. Las llaves y los cristales sí son moneda de
 * pago: 150 llaves tienen que caber en un hueco, porque si no el jugador tendría
 * que tirar cajas para guardar llaves.
 *
 * Que el tope valga **solo** para los tipos que están en la tabla y no sea un
 * número global es lo que evita tener que decidirlo para cada consumible nuevo:
 * un tipo que no esté aquí se apila entero, como hasta ahora.
 */
export const TOPE_PILA: Record<string, number> = { crate: 20 };

/**
 * Cuántas unidades caben en UNA pila de este tipo.
 *
 * `Infinity` para los que no tienen tope, que es el caso de las llaves: es un
 * número que se compara con `units < tope` y da `true` siempre, sin necesidad de
 * un `if` en cada sitio.
 */
export function topeDePila(type: string): number {
  return TOPE_PILA[type] ?? Infinity;
}

/** ¿Le caben estas unidades en esta pila, sin tener que abrir otra? */
export function cabeEnPila(pila: any, unidades: number): boolean {
  if (!pila || !isStackable(pila)) return false;
  return stackUnits(pila) + unidades <= topeDePila(pila.type);
}

/**
 * Cuántas pilas hacen falta para estas unidades.
 *
 * Es la pregunta que responde "¿cuánta ranura ocupa esto?", y la que usa el
 * contador del almacén, la rejilla y la comprobación de si cabe una compra. Las
 * tres tienen que hacer **esta** cuenta y no "¿hay hueco?", porque un item que
 * necesita tres ranuras nuevas no cabe en un almacén con una sola libre.
 *
 * **Y CERO UNIDADES DEVUELVE UNA, NO CERO. ES A PROPÓSITO, Y ES UNA TRAMPA.**
 * La pregunta es "cuántas pilas necesito para GUARDAR esto", y de cero unidades la
 * respuesta mínima razonable es una. Quien la llama preguntando "cuántas tengo
 * que ABRIR" tiene que tratar el cero antes: `planDeEntrada()` en el motor lo
 * hace, y sin ese `if` un almacén lleno rechazaba una caja que se sumaba a una
 * pila sin ocupar ni una ranura nueva.
 */
export function pilasNecesarias(unidades: number, type: string): number {
  const tope = topeDePila(type);
  if (tope === Infinity) return 1;
  return Math.max(1, Math.ceil(Math.max(0, unidades) / tope));
}

/**
 * Cómo se pinta una cantidad en la esquina de una celda.
 *
 * El jugador compró más de 99 llaves y la esquina decía "99": no se perdían
 * llaves, pero **lo que se ve no era lo que había** (R3). Aquí se decide el texto
 * en un solo sitio, porque el número se pinta en tres —la rejilla, el detalle y la
 * venta— y si cada uno compusiera su regla volvieran a discrepar.
 *
 * **"150+" y no el número entero**, por una razón práctica: el 99 cabe en la
 * esquina y el 150 no. Y **el "+" dice la verdad sin mentir**: el jugador sabe que
 * hay más de lo que ve, que era el problema. El detalle sí enseña la cifra
 * exacta, que es donde cabe.
 */
export function textoDeCantidad(unidades: number, tope: number): string {
  const n = Math.max(0, Math.floor(unidades) || 0);
  if (n <= tope) return String(n);
  return `${tope}+`;
}

/** Un item se agrupa solo si lo dice Y si su tipo lo permite. */
export function isStackable(item: any): boolean {
  return !!item && !!item.stackable && (STACKABLE_TYPES as readonly string[]).includes(item.type);
}

/** Unidades de un item. Un item no apilable siempre vale una. */
export function stackUnits(item: any): number {
  if (!isStackable(item)) return 1;
  const n = Number(item.stackCount);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/**
 * La clave con la que dos items son "la misma pila".
 *
 * `type` + `name`, que es lo que ya usaba la rejilla. El nombre es lo que
 * distingue una llave de la otra: dos llaves de distinto nivel se llaman
 * distinto, así que el jugador puede elegir con cuál abrir el cofre.
 */
export function stackKey(item: any): string {
  return `${item?.type}::${item?.name}`;
}

/**
 * Cuántas ranuras ocupa un almacén.
 *
 * Es la función que responde "¿queda hueco?" y la que pinta el "21/21 ranuras".
 * Cuenta GRUPOS, no entradas, pero **un grupo con tope de pila cuenta tan varias
 * veces como pilas necesita**: 45 cajas son tres ranuras, no una. Sin esto el
 * contador diría "1" de un almacén con tres celdas de cajas y el jugador leería
 * que le queda sitio donde no lo hay.
 */
export function countOccupiedSlots(items: any[] | undefined): number {
  const lista = items || [];
  // Clave -> unidades apiladas de ese tipo y nombre.
  const grupos = new Map<string, { unidades: number; type: string }>();
  let sueltos = 0;

  for (let i = 0; i < lista.length; i++) {
    const w = lista[i];
    if (!isStackable(w)) {
      // Un item que no es apilable ocupa su propia ranura SIEMPRE, aunque se
      // llame igual que otro. Se cuenta por posición y no por id para que un
      // item guardado sin id no se funda con el siguiente por accidente.
      sueltos++;
      continue;
    }
    const clave = stackKey(w);
    const previo = grupos.get(clave);
    grupos.set(clave, {
      unidades: (previo?.unidades ?? 0) + stackUnits(w),
      type: w.type
    });
  }

  let ranuras = sueltos;
  for (const g of grupos.values()) {
    ranuras += pilasNecesarias(g.unidades, g.type);
  }
  return ranuras;
}

/**
 * Colapsa los items apilables repetidos en pilas, respetando el tope de cada tipo.
 *
 * Es la migración de las partidas ya jugadas. Una pila guardada como 19 items
 * sueltos de la misma llave se convierte en UN item con `stackCount: 19`, que es
 * lo que la rejilla ya estaba mostrando desde antes. No se pierde ninguna
 * unidad: se suman, y `syncMaterialCounters` sigue viendo el mismo total.
 *
 * Y cuando la suma **supera el tope de pila**, se reparten en varias: 45 cajas
 * son tres items de 20, 20 y 5, no uno de 45. Antes se fundían en uno solo y el
 * almacén parecía tener sitio de sobra para siempre, que es justo lo que pasa
 * si el tope no existe.
 *
 * Se conserva el PRIMER item de cada grupo, con su id, porque es el que puede
 * tener algo pendiente detrás (un compañero en `state.companions` apunta al id
 * de su ficha, y un afijo de un recolector forjado apunta a su id). Las pilas
 * sobrantes reciben un id nuevo con el mismo patrón, porque no hay nada detrás
 * que apuntar a ellas.
 *
 * Devuelve el mismo array cuando no había nada que fusionar, para que el
 * llamante pueda usar el resultado como prueba de "esto no se ha tocado".
 */
export function mergeStacks(items: any[]): { items: any[]; changed: boolean } {
  // Clave -> unidades sumadas. Se cuenta primero y se reparte después, porque
  // repartir sobre la marcha dejaría el orden del almacén del jugador depende de
  // cuántas cosas hubiera, y la disposición es suya.
  const unidadesDe = new Map<string, { unidades: number; primero: any }>();
  const salida: any[] = [];
  let changed = false;

  for (const w of items) {
    if (!isStackable(w)) {
      salida.push(w);
      continue;
    }
    const clave = stackKey(w);
    const previo = unidadesDe.get(clave);
    // Un item guardado sin `stackCount` vale una unidad, no cero: restarlo como
    // cero dejaría la pila en su valor y el item se perdería sin aviso.
    if (previo) {
      previo.unidades += stackUnits(w);
      changed = true;
      continue;
    }
    unidadesDe.set(clave, { unidades: stackUnits(w), primero: w });
    salida.push(w);
  }

  if (!changed) return { items, changed };

  // Y se reparten en el sitio del PRIMER item de cada grupo, que es el que
  // conserva su id: un compañero en `state.companions` apunta al id de su
  // ficha, y un afijo de un recolector forjado apunta a su id. Las pilas
  // sobrantes reciben un id nuevo con el mismo patrón, porque no hay nada detrás
  // que pueda apuntar a ellas.
  const repartidas = new Map<string, any[]>();
  for (const [clave, { unidades, primero }] of unidadesDe) {
    const tope = topeDePila(primero.type);
    const pila: any[] = [];
    let quedan = unidades;
    let n = 0;
    while (quedan > 0) {
      const take = tope === Infinity ? quedan : Math.min(tope, quedan);
      const copia: any = { ...primero, stackCount: take };
      if (n > 0) copia.id = `${primero.id}#${n + 1}`;
      pila.push(copia);
      quedan -= take;
      n++;
    }
    repartidas.set(clave, pila);
  }

  const final: any[] = [];
  const puesto = new Set<string>();
  for (const w of items) {
    if (!isStackable(w)) {
      final.push(w);
      continue;
    }
    const clave = stackKey(w);
    if (puesto.has(clave)) continue;
    puesto.add(clave);
    final.push(...(repartidas.get(clave) ?? [w]));
  }

  return { items: final, changed };
}

/**
 * El mismo reparto, pero aplicado SIEMPRE, incluso cuando no hubo fusión.
 *
 * Existe por un caso que la fusión no cubre: **una única pila guardada con 21
 * cajas**. No hay nada que fusionar —una entrada, un grupo— así que la función
 * rápida devolvía el array sin tocar, y el tope no se aplicaba: el almacén
 * aceptaba una pila de 21 que el motor nunca crearía y que `countOccupiedSlots()`
 * contaría como una sola ranura.
 *
 * Que el guardadoacepte una forma que el motor no produce no es un detalle: es
 * la puerta por la que una partida manipulada entra en un almacén imposible.
 */
export function partirPilas(items: any[]): { items: any[]; changed: boolean } {
  const { items: fusionadas, changed: huboFusion } = mergeStacks(items);
  const salida: any[] = [];
  let partido = false;

  for (const w of fusionadas) {
    const tope = topeDePila(w.type);
    const unidades = stackUnits(w);
    if (!isStackable(w) || tope === Infinity || unidades <= tope) {
      salida.push(w);
      continue;
    }
    let quedan = unidades;
    let n = 0;
    while (quedan > 0) {
      const take = Math.min(tope, quedan);
      const copia: any = { ...w, stackCount: take };
      if (n > 0) copia.id = `${w.id}#${n + 1}`;
      salida.push(copia);
      quedan -= take;
      n++;
    }
    partido = true;
  }

  if (!huboFusion && !partido) return { items, changed: false };
  return { items: salida, changed: huboFusion || partido };
}
