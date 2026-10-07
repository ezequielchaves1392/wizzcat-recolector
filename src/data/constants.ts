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

/** Lo que aporta cada Piedra de Calibración a la probabilidad de fusión. */
export const PIEDRA_APORTA = 0.07;

/** Los puntos que aporta cada piedra, para los textos que la nombran. */
export const PIEDRA_PUNTOS = Math.round(PIEDRA_APORTA * 100);
