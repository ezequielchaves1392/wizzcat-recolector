// ==========================================================================
//  EL BRILLO EN PANTALLA: LAS CLASES Y EL ANILLO
// ==========================================================================
//
//  Aquí NO hay ninguna regla de juego. El número sale de `data/brillo.ts` y este
//  módulo solo lo viste: decide qué clases lleva y pinta el anillo.
//
//  **POR QUÉ ESTE MÓDULO Y NO UNA LÍNEA EN CADA PANTALLA.** El almacén, la
//  descripción de la base y la tarjeta del ranking tienen que enseñar el mismo
//  brillo. Si cada una escribiera sus clases, bastaría con que una se olvidara del
//  escalón 4 para que el jugador viera su mejor item sin el efecto propio en una
//  pantalla y con él en otra. Con un módulo, las tres pintan lo mismo por
//  construcción.
//
//  **Y POR QUÉ NO SE CALCULA AQUÍ.** Si el brillo se calculara en la vista, cada
//  pantalla tendría su propia regla y la primera en desincronizarse sería la que
//  nadie mira. El número es del motor; este fichero solo lo traduce a clases.
// ==========================================================================

import { brilloDeItem, tieneEfectoPropio, etiquetaDeBrillo, BRILLO_MAXIMO } from '../data/brillo';

/**
 * Las clases del contenedor que envuelve al icono.
 *
 * **EL COLOR NO SE PONE AQUÍ A PROPÓSITO.** El contenedor lleva la clase de rareza
 * (`.rarity-divino` y compañía), que ya le da su color, y el anillo usa
 * `currentColor`. Si esta función eligiera el color, habría dos sitios decidiendo de
 * qué color brilla un Divino, y se separarían el día que se añada una rareza.
 *
 * El 0 no lleva ninguna clase de brillo: sin brillo es el estado por defecto, no un
 * caso con estilo propio.
 */
export function claseDeBrillo(w: any): string {
  const b = brilloDeItem(w);
  if (b <= 0) return '';
  if (b >= BRILLO_MAXIMO) return 'brillo-max';
  return 'brillo-' + b;
}

/**
 * El anillo y, en el escalón máximo, el barrido.
 *
 * **LOS DOS VIENEN EN UN SOLO `string`, CON EL ANILLO PRIMERO.** El orden no es
 * libre: el barrido se pinta después a propósito, para que pase por encima del
 * anillo en vez de quedar debajo. Invertidos se ve un barrido apagado, que es el
 * peor de los dos mundos.
 *
 * Y sale aunque el brillo sea 0: **devuelve cadena vacía y no un contenedor**, para
 * que una celda sin brillo no cargue dos elementos que no pintan nada.
 */
export function anilloDeBrillo(w: any): string {
  const b = brilloDeItem(w);
  if (b <= 0) return '';
  const anillo = '<span class="brillo-anillo" aria-hidden="true"></span>';
  const barrido = b >= BRILLO_MAXIMO
    ? '<span class="brillo-barrido" aria-hidden="true"></span>'
    : '';
  return anillo + barrido;
}

/**
 * El contenedor completo: clases más anillo.
 *
 * Es lo que usan las tres pantallas, y existe para que **no se pueda pintar el anillo
 * sin su clase**. Si una pantalla escribiera su propio `<span class="relative">` y
 * añadiera el anillo dentro, se olvidaría de `claseDeBrillo()` y el anillo saldría sin
 * estilo: invisible, sin ningún error, y con la prueba en verde.
 *
 * `relative` y `grid place-items-center` vienen aquí porque el anillo es `absolute` y
 * necesita un padre posicionado. Que se metan en el sitio que lo usa es como nacen
 * los `<button>` dentro de `<button>`.
 */
export function marcoDeBrillo(w: any, contenido: string, extra = ''): string {
  const clase = claseDeBrillo(w);
  const anillo = anilloDeBrillo(w);
  return `<span class="relative grid place-items-center ${clase} ${extra}">${contenido}${anillo}</span>`;
}

/**
 * El texto que explica el brillo, para el `title` y para las fichas.
 *
 * **NO ES UN BOTÓN.** El brillo se explica en el `title` del icono y en la descripción
 * del item, nunca en un botón que enseñe un número: el botón enseña el precio o el
 * daño, y meterle una tercera cifra lo convierte en una tabla de cosas que no se
 * pinchan.
 */
export function textoDeBrillo(w: any): string {
  const b = brilloDeItem(w);
  if (b <= 0) return '';
  return tieneEfectoPropio(w)
    ? etiquetaDeBrillo(b) + ': efecto propio.'
    : etiquetaDeBrillo(b);
}