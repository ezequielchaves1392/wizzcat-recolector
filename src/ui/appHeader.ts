// ==========================================================================
//  LA CABECERA, Y POR QUÉ ES UN FICHERO SOLO
// ==========================================================================
//
//  EL PROBLEMA QUE ESTE FICHERO ARREGLA, EN DOS NÚMEROS
//
//  Antes de escribirlo, la cabecera de la base medía **111 px** y la de los otros
//  seis sectores **71 px**. No era una impresión: se midió el `getBoundingClientRect()`
//  de las siete pantallas a 1440×900 y salió esa diferencia.
//
//  La causa eran dos cabeceras distintas escritas en dos sitios:
//
//    · La de la base metía la identidad con avatar dentro de un `flex-1`, y el
//      avatar es más alto que un título de una línea. La fila crecía.
//    · La de las páginas no llevaba `flex-1` en el título, así que el nav caía
//      justo detrás del texto en vez de al otro extremo.
//
//  O sea: el nav era el **mismo HTML** en las siete pantallas —por eso existe
//  `navBars.ts`— pero su posición dependía de lo que hubiera a su izquierda. Con
//  lo mismo a la izquierda no se movía; al cambiar de sector, lo de la izquierda
//  cambiaba, y el nav se iba con ello.
//
//  LAS DOS REGLAS QUE ARREGLAN ESTO
//
//  1. **LA FILA TIENE ALTO FIJO, Y LO QUE VAYA DENTRO NO LA PUEDE AGRANDAR.**
//     El nav va centrado verticalmente en la fila, así que si la fila crece, el nav
//     baja. Con la altura fijada, la base puede llevar avatar y los sectores pueden
//     no llevarlo, y el nav se queda donde está.
//
//  2. **EL NAV VA LO ÚLTIMO DE TODO, Y EL GRUPO DE LA IZQUIERDA LLEVA EL `flex-1`.**
//     Es lo importante. Si el nav fuese el primero, su posición dependería de la
//     anchura de todo lo que viene después: cambiar los controles de la base por
//     las acciones de una página lo movería. Puesto al final, su **borde derecho
//     es el padding de la cabecera**, que es el mismo número en las siete, y su
//     anchura es la misma porque los botones y sus etiquetas son las mismas
//     —`HEADER_ROUTES` son seis y no cambian— así que su borde izquierdo tampoco
//     se mueve. Los dos extremos son constantes y el nav queda clavado.
//
//  Y no es una casualidad que el `flex-1` esté en el grupo de la izquierda y no en
//  el nav: el `flex-1` **empuja** al nav contra el borde derecho sin mover el
//  contenido del grupo, que se queda a la izquierda donde estaba. Si el `flex-1`
//  estuviera en el nav, el hueco se repartiría según lo que quede a su derecha, y
//  volveríamos a depender del contenido.
//
//  LO QUE ESTE FICHERO NO HACE, Y ES A PROPÓSITO
//
//  No decide qué hay en la pantalla de abajo. Eso es de cada vista. Aquí solo vive
//  la franja de arriba, y la pintan las siete pantallas calling a la misma función.
//  Si mañana se añade una octava ruta, hereda la cabecera entera sin que nadie
//  tenga que acordarse de escribirla.
// ==========================================================================

import { ic, type IconName } from './icons';
import { routeTitle, type Route } from './router';
import { navDesktopHTML } from './navBars';
import { formatNumber } from '../utils/format';

// --------------------------------------------------------------------------
//  LOS RECURSOS
// --------------------------------------------------------------------------

/**
 * Los tres saldos del juego, en el orden en que se gastan.
 *
 * **EL ORDEN ES EL DE LA MONEDA, NO EL DEL CÓDIGO.** Nanitas primero porque es lo
 * único que se gasta en la base; cristales después porque son lo que sube de nivel;
 * núcleos al final porque no se gastan hasta que se entra en el prestigio. Un
 * jugador que los lee de izquierda a derecha los encuentra en el orden en que
 * los va a necesitar.
 *
 * Y el motivo de que estén **solo aquí** está en la razón de que esta función
 * exista: si un saldo se enseña en dos sitios, el jugador acaba de Treating uno de
 * los dos como el bueno, y basta con que los dos se actualicen con distinta
 * frecuencia para que se note. La cabecera se repinta en cada tick y es el mismo
 * nodo en las siete pantallas, así que un saldo tiene una única cifra en todo el
 * juego.
 */
const RECURSOS: Array<{ clave: string; nombre: string; icono: IconName }> = [
  { clave: 'nanites', nombre: 'Nanitas', icono: 'nanite' },
  { clave: 'crystals', nombre: 'Cristales de mejora', icono: 'crystal' },
  { clave: 'cores', nombre: 'Núcleos', icono: 'core' }
];

/**
 * La franja de recursos.
 *
 * **EL GLIFO VA DELANTE Y EL NOMBRE NO.** Con tres saldos en 360 px no caben tres
 * etiquetas de texto, y un número suelto sin su unidad al lado obliga a leer. El
 * rombo, la gema y el círculo se distinguen de un vistazo y son los mismos que usan
 * los botones de la ruleta y las fichas del almacén, así que no hay dos
 * vocabularios de iconos en el juego. El nombre va en el `title`, que es donde se
 * busca cuando no se sabe qué es.
 *
 * **EL `min-w` ES LO QUE SOSTIENE LA GEOMETRÍA DE LA CABECERA.** Sin él, un saldo
 * de 4 cifras empuja a los de al lado y la anchura de la franja cambia cada vez que
 * el jugador compra, lo que rattling el nav un poco. Con el ancho reservado, la
 * franja mide lo mismo siempre y el nav se queda clavado.
 */
export function resourceBarHTML(state: any): string {
  return `
    <div class="flex items-center gap-1 flex-shrink-0" role="group" aria-label="Recursos">
      ${RECURSOS.map(r => `
        <span class="inline-flex items-center gap-1 h-9 px-2 rounded-lg border flex-shrink-0 tabular
                     border-[var(--border-color)]"
              style="background: color-mix(in srgb, var(--accent) 10%, transparent)"
              data-res="${r.clave}" title="${r.nombre}">
          <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5" aria-hidden="true">${ic(r.icono)}</span>
          <span class="font-mono text-[11px] text-[var(--text-main)] min-w-[2.75rem] text-right"
                data-res-val="${r.clave}">${formatNumber(saldoDe(state, r.clave))}</span>
        </span>`).join('')}
    </div>`;
}

/** El saldo de un recurso, tolerante con partidas viejas que no lo traigan. */
function saldoDe(state: any, clave: string): number {
  const v = Number(state?.[clave]);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Refresca los tres saldos de la cabecera.
 *
 * **BUSCA POR ATRIBUTO Y NO POR ID, Y POR QUÉ ES MEJOR ASÍ.** Antes el saldo de
 * nanitas vivía en cuatro identificadores distintos (`#nanites-counter`,
 * `#page-nanites-val`, `#wh-nanites-val`, `#store-nanites`, `#profile-nanites`) y
 * quien lo refrescaba llevaba una lista escrita a mano con los cinco dentro. Añadir
 * un contador obligaba a tocar dos ficheros, y olvidar el segundo Symptoms en un
 * saldo congelado, que es el peor tipo de fallo: no lanza error, la cifra simplemente
 * deja de moverse.
 *
 * Con `[data-res-val]` la lista **está en el HTML que se pinta**, así que no puede
 * quedar desfasada: o el nodo existe y se actualiza, o no existe y no hay nada que
 * actualizar.
 *
 * Devuelve cuántos encontró. No se usa para decidir nada: es el aviso de que se ha
 * roto el cableado, que es lo único que no se puede ver mirando la pantalla.
 */
export function updateResourceBar(state: any): number {
  const nodos = document.querySelectorAll('[data-res-val]');
  nodos.forEach(n => {
    const clave = (n as HTMLElement).dataset.resVal;
    if (clave) n.textContent = formatNumber(saldoDe(state, clave));
  });
  return nodos.length;
}

// --------------------------------------------------------------------------
//  LA CABECERA
// --------------------------------------------------------------------------

export interface AppHeaderOptions {
  /** Qué ruta está pintando esta pantalla. Marca el botón activo del nav. */
  route: Route;
  /** El título. En la base sale del propio router si no se pasa. */
  title?: string;
  subtitle?: string;
  icon?: IconName;
  /** Nombre y avatar del jugador. **Solo la base**: es el sector de la identidad. */
  identityHTML?: string;
  /**
   * Botón `‹` de vuelta.
   *
   * **NO EXISTE Y NO SE HA PUESTO, A PROPÓSITO.** El icono `back` sigue en
   * `icons.ts` porque hay otras cosas que lo usan, pero un `‹` en la cabecera sería
   * el segundo control de navegación en la misma esquina que ya tiene el nav
   * persistente, y volver a diseñar eso después de quitarlo a propósito sería
   * deshacer una decisión, no mejorarla. Aquí no hay hueco para él, y el que no está
   * escrito no se puede pintar por descuido.
   */
  actions?: string;
  /** Los saldos. `false` los quita, que es el caso de la pantalla de acceso. */
  resources?: any | false;
  /** Fila de buffs de escritorio, dentro del grupo de la izquierda. Solo la base. */
  buffsHudId?: string;
  /** Fila de buffs de móvil, DEBAJO de la fila. Solo la base. */
  mobileBuffsId?: string;
}

/**
 * LA FRANJA DE ARRIBA DE LAS SIETE PANTALLAS.
 *
 * Lo único que hay que recordar al usarla es esto: **el nav es lo último y el
 * `flex-1` va en el grupo de la izquierda**. Si algún día se añade algo, va en el
 * grupo de la izquierda o en `actions`; después del nav, nunca. Un elemento
 * colocado después del nav es exactamente el cambio que rompe la posición del nav
 * en todas las pantallas menos en una, que es el peor sitio posible para que se
 * note.
 *
 * **POR QUÉ EL HUD DE BUFFS DE ESCRITORIO VA EN EL GRUPO DE LA IZQUIERDA Y NO EN
 * `actions`.** Es una fila con desplazamiento, de ancho indeterminado. En `actions`,
 * que es `flex-shrink-0`, no podría encogerse y aplastaría al nav; en el grupo de la
 * izquierda, que es `flex-1`, se encoge él y lo que se acorta es el título. Entre
 * estortar el título y mover el nav, el título es lo correcto.
 */
export function appHeaderHTML(opts: AppHeaderOptions): string {
  const titulo = opts.title ?? routeTitle(opts.route);

  return `
    <header class="relative z-20 card-glass flex-shrink-0 px-3 md:px-5 py-2.5 md:py-3
                    border-x-0 border-t-0 md:mx-4 md:mt-2 md:rounded-2xl md:border"
            style="padding-top: max(0.625rem, env(safe-area-inset-top))">
      <div class="flex items-center gap-2 md:gap-3 min-h-[3.5rem]">

        <div class="flex items-center gap-2 min-w-0 flex-1">
          ${opts.icon ? `<span class="accent-text flex-shrink-0 hidden sm:block [&>span>svg]:w-5 [&>span>svg]:h-5">${ic(opts.icon)}</span>` : ''}
          <div class="min-w-0">
            <h1 id="page-title"
                class="font-['Orbitron'] font-bold text-[15px] md:text-lg accent-text truncate leading-tight">
              ${titulo}
            </h1>
            ${opts.subtitle ? `<p class="text-[10px] md:text-[11px] text-[var(--text-muted)] font-mono truncate mt-0.5 hidden sm:block">${opts.subtitle}</p>` : ''}
          </div>
          ${opts.identityHTML ? `<div id="nav-identity" class="flex-shrink-0 hidden sm:flex items-center">${opts.identityHTML}</div>` : ''}
          ${opts.buffsHudId ? `
            <div id="${opts.buffsHudId}"
                 class="hidden xl:flex items-center gap-1.5 flex-nowrap min-w-0 flex-grow overflow-x-auto py-0.5"></div>` : ''}
        </div>

        ${opts.resources !== false ? resourceBarHTML(opts.resources) : ''}
        ${opts.actions ? `<div class="flex items-center gap-1.5 flex-shrink-0">${opts.actions}</div>` : ''}

        ${navDesktopHTML(opts.route)}
      </div>

      ${opts.mobileBuffsId ? `
        <div id="${opts.mobileBuffsId}"
             class="xl:hidden flex gap-1.5 overflow-x-auto mt-2 pb-0.5 empty:hidden -mx-1 px-1"></div>` : ''}
    </header>`;
}