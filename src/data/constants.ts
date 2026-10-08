// ==========================================================================
//  Constantes compartidas entre sistemas
// ==========================================================================
//  POR QUÉ ESTE FICHERO EXISTE. `store.ts` necesitaba `PIEDRA_PUNTOS` para los
//  textos de la tienda, y `crafting.ts` necesitaba `costeDeCaja` para la
//  valoración. Cada uno importaba del otro, y eso creaba un ciclo de
//  dependencias: al cargar `store.ts`, `PIEDRA_PUNTOS` aún no estaba
//  inicializado porque `crafting.ts` estaba esperando que `store.ts` terminara.
//
//  La solución es un tercer fichero que no importa nada. Cualquier constante
//  que necesite ser compartida entre dos o más sistemas vive aquí.
// ==========================================================================

/**
 * Lo que aporta cada Piedra de Calibración a la probabilidad de fusión.
 *
 * **ERAN 0,07 (10 = 70 puntos) Y ERAN DEMASIADO**: diez piedras convertían cualquier
 * tirada en casi segura y el 95 % se alcanzaba con cualquiera de los tiers, así que
 * "arriesgar" dejó de existir. Ahora son 0,012: diez piedras suman **exactamente 12
 * puntos** y una sola suma 1,2. Sigue siendo un bonus que merece la pena pagar, pero
 * es un lujo, no una aseguradora. El precio de la tienda no cambia por lo mismo.
 */
export const PIEDRA_APORTA = 0.012;

/**
 * Los puntos que aporta cada piedra, para los textos que la nombran.
 *
 * Y **NO ES UN ENTERO**: con 0,012 por piedra, `Math.round(1.2)` diría "1", y una
 * piedra que da 1,2 no puede anunciarse como 1 —el número que se enseña es el que se
 * cobra (R3). Sale con la coma decimal del castellano: "1,2".
 */
export const PIEDRA_PUNTOS = pctDe(PIEDRA_APORTA);

/**
 * Un porcentaje con la coma decimal: 0,012 → "1,2", 0,12 → "12", 0,024 → "2,4".
 *
 * Está aquí y no en `utils/format` porque la tienda y la forja lo usan para texto de
 * consumibles y `constants.ts` es el fichero que no importa a nadie —el que rompe los
 * ciclos—. `Math.round(v * 100)` no sirve: se lleva por delante las décimas, que es
 * exactamente lo que hay que mostrar.
 */
export function pctDe(valor: number): string {
  const n = Math.round(valor * 1000) / 10;
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

/**
 * La probabilidad de que la Nanopartícula de Estabilidad suba un escalón la rareza
 * del recolector forjado, con la nanopartícula puesta.
 *
 * Es su efecto entero: ya no toca la probabilidad de acierto ni los afijos. Media de
 * las veces es a propósito —es una tirada, no una mejora garantizada— y el escalón se
 * topa en Divino en `subirRareza()`.
 */
export const PROB_NANO_SUBE_RAREZA = 0.5;

/**
 * La probabilidad de que la fusión suba el potencial una estrella, por estrella de
 * partida. Baja al subir —lo difícil es llegar a ★5, no el primer escalón— y la ★5
 * no sube, así que su fila es 0.
 */
export const PROB_SUBE_POTENCIAL: Record<number, number> = {
  1: 0.20, 2: 0.15, 3: 0.10, 4: 0.05, 5: 0
};

/**
 * Lo que el Éter de Refinamiento suma a esa probabilidad, en puntos: con él, ★1→2
 * pasa de 20 % a 40 % y ★4→5 de 5 % a 25 %. Se aplica encima de la probabilidad base,
 * que existe aunque no gastes Éter.
 */
export const BONO_ETTER = 0.20;
