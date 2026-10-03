import { BOTTOM_BAR_ROUTES, HEADER_ROUTES, type Route } from './router';
import { ic, type IconName } from './icons';

/**
 * LAS DOS BARRAS DE NAVEGACIÓN, EN UN SITIO.
 *
 * **POR QUÉ ESTÁN AQUÍ Y NO EN LA PANTALLA DE LA BASE.** Porque hasta ahora solo la
 * base las tenía: el layout **es** la pantalla principal, con el botón de click y
 * las fichas del jugador dentro, y cualquier otra vista **sustituía `#app`
 * entero**. O sea que la barra no era "de la base": era lo único que había, y en
 * las otras seis pantallas no había nada. El jugador tenía que volver con el botón
 * `‹` porque no había nada más.
 *
 * Con esto, la base y las seis páginas pintan **las mismas dos barras** desde la
 * misma función. Dos consecuencias:
 *
 *  · **Una sola fuente.** Si las barras estuvieran escritas dos veces, el día que se
 *    añadiera una ruta nueva habría siete sitios y seis se quedarían sin ella. Que
 *    es exactamente lo que pasó: se añadieron rutas y nadie se dio cuenta de que
 *    faltaban.
 *  · **El marcado activo no puede discrepar.** Las dos barras leen la misma ruta
 *    activa de `ROUTES`, así que el botón resaltado es el mismo en las dos, y
 *    `navDesktopHTML` y `navMobileHTML` no pueden separarse porque comparten el
 *    botón.
 */

/** La fila de navegación de escritorio, la que vive en la cabecera. */
export function navDesktopHTML(activeRoute: Route): string {
  return `
          <nav class="hidden lg:flex items-center gap-0.5 flex-shrink-0" aria-label="Navegación">
            ${HEADER_ROUTES.map(r => {
              const active = activeRoute === r.id;
              return `
                <button data-nav="${r.id}"
                  class="h-9 px-3 rounded-lg text-[11px] font-mono cursor-pointer transition flex items-center gap-1.5
                         ${active ? 'accent-bg text-slate-950 font-bold'
                                  : 'btn-ghost text-[var(--text-muted)]'}"
                  aria-label="${r.title}"
                  ${active ? 'aria-current="page"' : ''}>
                  <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(r.icon as IconName)}</span>
                  ${r.label}
                </button>`;
            }).join('')}
          </nav>`;
}

const botonMovil = (activeRoute: Route, route: Route) => {
  const def = BOTTOM_BAR_ROUTES.find(r => r.id === route)!;
  const active = activeRoute === route;
  return `
      <button data-nav="${route}"
        class="nav-item group flex flex-col items-center justify-center gap-1 flex-1 h-full cursor-pointer
               transition-colors duration-150 active:scale-95
               ${active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}"
        style="min-height:44px" aria-label="${def.label}"
        ${active ? 'aria-current="page"' : ''}>
        <span class="[&>span>svg]:w-[22px] [&>span>svg]:h-[22px] transition-transform duration-150
                     group-active:scale-90
                     ${active ? 'drop-shadow-[0_0_8px_var(--accent)]' : ''}">
          ${ic(def.icon as IconName)}
        </span>
        <span class="text-[9px] font-mono tracking-wide leading-none">${def.label}</span>
        ${active ? `<span class="absolute top-0 w-6 h-[2px] rounded-full" style="background: var(--accent)"></span>` : ''}
      </button>`;
};

/**
 * La barra inferior de móvil.
 *
 * **EL `flex-1` DE CADA BOTÓN ES LO QUE REPARTE EL ANCHO**, así que con cinco
 * entradas y con cuatro cada una ocupa lo que le toca y no hace falta nada para que
 * no quede un hueco donde estaba una entrada.
 */
export function navMobileHTML(activeRoute: Route): string {
  return `
      <nav
        class="lg:hidden relative z-20 card-glass border-x-0 border-b-0 flex-shrink-0 px-1 pt-1.5 pb-1"
        style="padding-bottom: max(0.25rem, env(safe-area-inset-bottom))"
        aria-label="Navegación principal">
        <div class="flex items-stretch gap-0.5 relative">
          ${BOTTOM_BAR_ROUTES.map(r => botonMovil(activeRoute, r.id)).join('')}
        </div>
      </nav>`;
}