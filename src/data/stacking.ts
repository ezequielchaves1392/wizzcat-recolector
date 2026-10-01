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
 * Es un tope DE PINTADO, no de almacenamiento: una pila puede llevar 25 cajas
 * detrás y el detalle sigue enseñando las 25. Lo que no se puede prometer es un
 * número más grande del que cabe en la celda. Llave y cristal admiten 99 porque
 * se gastan de uno en uno y 99 es de sobra; caja y consumible, 20, porque se
 * recognize en un vistazo.
 */
export const MAX_STACK: Record<string, number> = {
  consumable: 20, crate: 20, key: 99, crystal: 99
};

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
 * Cuenta GRUPOS, no entradas: por eso tiene que agrupar con la misma clave que
 * la rejilla.
 */
export function countOccupiedSlots(items: any[] | undefined): number {
  const lista = items || [];
  const celdas = new Set<string>();
  for (let i = 0; i < lista.length; i++) {
    const w = lista[i];
    // Un item que no es apilable ocupa su propia ranura SIEMPRE, aunque se
    // llame igual que otro. Se distingue por su posición y no por su id para
    // que un item guardado sin id no se funda con el siguiente por accidente.
    celdas.add(isStackable(w) ? stackKey(w) : `#${i}:${w.id}`);
  }
  return celdas.size;
}

/**
 * Colapsa los items apilables repetidos en una sola pila cada uno.
 *
 * Es la migración de las partidas ya jugadas. Una pila guardada como 19 items
 * sueltos de la misma llave se convierte en UN item con `stackCount: 19`, que es
 * lo que la rejilla ya estaba mostrando desde antes. No se pierde ninguna
 * unidad: se suman, y `syncMaterialCounters` sigue viendo el mismo total.
 *
 * Se conserva el PRIMER item de cada grupo, con su id, porque es el que puede
 * tener algo pendiente detrás (un Companion en `state.companions` apunta al id
 * de su ficha, y un afijo de un recolector forjado apunta a su id).
 *
 * Devuelve el mismo array cuando no había nada que fusionar, para que el
 * llamante pueda usar el resultado como prueba de "esto no se ha tocado".
 */
export function mergeStacks(items: any[]): { items: any[]; changed: boolean } {
  const celdaDe = new Map<string, any>();
  const salida: any[] = [];
  let changed = false;

  for (const w of items) {
    if (!isStackable(w)) {
      salida.push(w);
      continue;
    }

    const clave = stackKey(w);
    const previa = celdaDe.get(clave);
    if (previa) {
      const unidades = stackUnits(w);
      // Un item guardado sin `stackCount` vale una unidad, no cero: restarlo
      // como cero dejaría la pila en su valor y el item se perdería sin aviso.
      previa.stackCount = stackUnits(previa) + unidades;
      changed = true;
      continue;
    }

    const copia = { ...w, stackCount: stackUnits(w) };
    celdaDe.set(clave, copia);
    salida.push(copia);
  }

  return { items: changed ? salida : items, changed };
}
