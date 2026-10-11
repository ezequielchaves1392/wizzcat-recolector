import { BaseOculta, LadoBase } from './bases';

/**
 * EL NOMBRE DE UN ITEM, Y SALE DE SU BASE.
 *
 * **POR QUÉ ESTE MÓDULO, CON DOCE LÍNEAS.** `generators.ts` tira el potencial y
 * el base del recolector y necesita un nombre. `crafting.ts` construye el
 * compañero **forjado**, que no tira el suyo, y también necesita un nombre. Si
 * cada uno guardara su copia, un día una cambiaría y la otra no. Y si
 * `crafting.ts` importara de `generators.ts`, ambos se importarían mutuamente:
 * eso aguanta hasta que un cambio mete una constante en el sitio equivocado, y el
 * fallo aparece en un fichero que no tiene nada que ver.
 *
 * Con esto, los dos dependen de un módulo que no depende de ninguno.
 *
 * **EL NOMBRE ES EL DE LA BASE, Y NO UNA LISTA DEL TIER.** Antes sortea entre tres
 * nombres escritos a mano por tier (`TIER_SYSTEM.collectorNames`), y eso era
 * **media partida del bug de B10**: la base —que es lo que de verdad decide el
 * daño— se sorteaba aparte, así que veinte T1 con diez bases distintas se llamaban
 * todos con tres nombres. Dos T1 con el mismo nombre podían pegar 6 y 8.
 *
 * Ahora el nombre **es** la base, así que lo que el jugador lee es lo que pega.
 *
 * **POR QUÉ LA BASE VIENE EN EL ARGUMENTO Y NO SE SORTEA AQUÍ.** El sorteo de la
 * base es ponderado por `pesoDrop` y ya lo hacen los generadores; si aquí se
 * tirara otra, el nombre y el `baseId` podrían salir de bases distintas y el
 * item volvería a mentir sobre su propio daño. Quien llama, trae la base que ya
 * sorteó.
 */

/** El lado de un tipo de item, para leer la tabla de bases correcta. */
export function ladoDeNombre(tipo: 'companion' | 'collector'): LadoBase {
  return tipo === 'companion' ? 'companero' : 'recolector';
}

/**
 * EL NOMBRE DE RESERVA, PARA CUANDO NO HAY BASE.
 *
 * Solo pasa en T11+, donde las tablas de base llegan al T10 y
 * `baseAleatoriaSegura()` devuelve `null` a propósito. Un item sin base no está
 * roto —sale neutro, con ×1,00— pero **no puede quedarse sin nombre**, porque el
 * nombre se pinta en la rejilla, en la ficha y en el buscador: `undefined` ahí
 * es un item que no se puede buscar ni vender por su nombre.
 *
 * El nombre **lo dice**: prototipo, que es lo que es. Un T12 sin base no es una
 * base mejorada, es un objeto sin base todavía dibujada. Cuando el contenido
 * llegue al T11, esta función deja de ser el camino normal.
 */
export function nombreDeReserva(tipo: 'companion' | 'collector'): string {
  return tipo === 'companion' ? 'Prototipo de Compañero' : 'Prototipo de Recolector';
}

/**
 * El nombre que le toca a un item: el de su base.
 *
 * Sin base (T11+) cae a la reserva, que **no lanza**: un item al que le falta el
 * contenido no puede ser el motivo de que la partida se detenga.
 */
export function nombreDe(tipo: 'companion' | 'collector', base: BaseOculta | null | undefined): string {
  return base?.nombre ?? nombreDeReserva(tipo);
}
