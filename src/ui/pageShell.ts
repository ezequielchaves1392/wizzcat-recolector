// ==========================================================================
// Cáscara de página
//
// Todas las vistas secundarias (almacén, forja, tienda, perfil, ranking,
// prestigio) se montan con esta función. Antes cada una reconstruía su propio
// contenedor a mano, y por eso todas se veían ligeramente distintas: unas
// tenían safe-area y otras no, una variaba el título a 24px y otra a 18px, y el
// botón de volver estaba en dos posiciones distintos.
//
// Concentrarlo aquí significa que un cambio de espaciado o de zona segura se
// hace en un archivo y se propaga a las seis páginas.
//
// Decisiones de layout móvil:
//   - `dvh` en el contenedor, no `vh`: en iOS la barra del navegador cambia la
//     altura del viewport y `vh` deja 60px de hueco al abrir el teclado
//   - el encabezado es `flex-shrink-0` y el cuerpo es el único que scrollea:
//     así el botón de volver nunca sale de la pantalla a mitad de scroll
//   - `overscroll-behavior: contain` en el cuerpo para que el arrastre no
//     haga rubber-band de la página entera
//
// NAVEGACIÓN. La barra inferior vive AQUÍ y no solo en la vista principal.
// Antes solo la base la tenía, así que desde el almacén, la forja o la tienda
// la única salida era el botón `‹` de la esquina superior: en un móvil eso
// está en la posición que el pulgar no alcanza. Tener la barra en las seis
// páginas hace que volver sea un gesto igual de barato en todas partes.
// ==========================================================================

import { ic, type IconName } from './icons';
import { BOTTOM_BAR_ROUTES, type Route } from './router';
import { formatNumber } from '../utils/format';

export interface PageShellOptions {
  title: string;
  subtitle?: string;
  icon?: string;
  /** Botón de volver. Si no se pasa `onBack`, no se pinta. */
  onBack?: () => void;
  /** Ir directo a la base. Es distinto de `onBack`: no Depends del historial. */
  onHome?: () => void;
  /** Contenido extra del encabezado a la derecha, antes del contador. */
  actions?: string;
  /** Ruta activa, para resaltar la barra inferior. */
  activeRoute?: Route;
  /** Estado de la partida, para pintar el contador de nanitas. */
  state?: any;
  /** Oculta el contador (no hace falta en ninguna página hoy, pero queda). */
  hideNanites?: boolean;
  /** Clases extra del cuerpo. */
  bodyClass?: string;
}

/**
 * Monta el HTML de una página devolviendo el nodo vivo, y limpia los listeners
 * que el anterior hubiera acumulado.
 *
 * Por qué hace falta: `#app` no se recrea al cambiar de vista, así que cada
 * `addEventListener('click', ...)` que añadía una página se acumulaba. En la
 * cuarta interacción una acción se ejecutaba cuatro veces: en la Forja, marcar
 * tres piedras se alternaba tres veces y acababa en cero.
 *
 * La solución es clonar el nodo sin hijos y sustituirlo: `cloneNode` NO copia
 * listeners, así que un solo paso borra todos los anteriores sin tener que
 * llevar la cuenta de qué se registró. El mapa recuerda cuál es ahora el nodo
 * vivo, porque quien llama guarda la referencia del principio y esa quedó
 * desconectada tras el primer montaje.
 */
// Un Map y no un WeakMap: las claves son strings, y hay como mucho una
// entrada por contenedor. El tamaño está acotado por el número de páginas.
const liveRoots = new Map<string, HTMLElement>();

export function mountInto(container: HTMLElement, html: string): HTMLElement {
  const id = container.id;
  const prev = (id ? liveRoots.get(id) : undefined) ?? container;
  const fresh = prev.cloneNode(false) as HTMLElement;
  prev.replaceWith(fresh);
  fresh.innerHTML = html;
  if (id) liveRoots.set(id, fresh);
  return fresh;
}

/** Invalida el nodo vivo de una página. Se llama al salir de ella. */
export function unmount(container: HTMLElement): void {
  liveRoots.delete(container.id);
}

/**
 * Conecta la navegación de una página: botón de volver, botón de inicio y
 * cualquier elemento con `data-nav`.
 *
 * Se delega en el contenedor en vez de registrar un manejador por botón,
 * porque los botones se recrean en cada render y un listener por botón se
 * acumularía sobre nodos muertos. Un solo listener en la raíz, y la raíz se
 * recrea limpia con `mountInto`.
 */
export function wireNav(root: HTMLElement, cb: { back?: () => void; home?: () => void; go?: (r: Route) => void }) {
  root.addEventListener('click', (e) => {
    const nav = (e.target as HTMLElement).closest('[data-nav]') as HTMLElement | null;
    if (nav) {
      e.stopPropagation();
      cb.go?.(nav.dataset.nav as Route);
      return;
    }
    const back = (e.target as HTMLElement).closest('[data-nav-back]') as HTMLElement | null;
    if (back) {
      e.stopPropagation();
      cb.back?.();
      return;
    }
    const home = (e.target as HTMLElement).closest('[data-nav-home]') as HTMLElement | null;
    if (home) {
      e.stopPropagation();
      cb.home?.();
    }
  });
}

export function pageShell(opts: PageShellOptions, body: string): string {
  const backBtn = opts.onBack
    ? `<button data-nav-back
         class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0
                transition-transform active:scale-90"
         style="min-width:44px;min-height:44px" aria-label="Volver">
         <span class="[&>span>svg]:w-5 [&>span>svg]:h-5">${ic('back')}</span>
       </button>`
    : '';

  // En escritorio la barra inferior no se pinta, así que hace falta una
  // salida a la base que no dependa del historial.
  const homeBtn = opts.onHome
    ? `<button data-nav-home
         class="hit-expand hidden lg:inline-flex w-9 h-9 rounded-lg btn-ghost items-center justify-center
                cursor-pointer flex-shrink-0 transition-transform active:scale-90"
         style="min-width:44px;min-height:44px" title="Volver a la base" aria-label="Volver a la base">
         <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('chip')}</span>
       </button>`
    : '';

  // El contador de nanitas viaja en el encabezado de todas las páginas: es el
  // número que hace falta para decidir cualquier compra, y estaba solo en la
  // base y en la tienda.
  const nanites = opts.state && !opts.hideNanites
    ? `<span id="page-nanites"
             class="inline-flex items-center gap-1 px-2.5 h-9 rounded-lg border flex-shrink-0 tabular
                    border-[var(--border-color)]"
             style="background: color-mix(in srgb, var(--accent) 10%, transparent)">
         <span class="accent-text not-italic text-[11px]" aria-hidden="true">◆</span>
         <span class="font-mono text-[11px] text-[var(--text-main)]">${formatNumber(opts.state.nanites || 0)}</span>
       </span>`
    : '';

  const bottomBar = opts.activeRoute
    ? `<nav class="lg:hidden relative z-20 card-glass border-x-0 border-b-0 flex-shrink-0 px-1 pt-1.5 pb-1"
               style="padding-bottom: max(0.25rem, env(safe-area-inset-bottom))"
               aria-label="Navegación principal">
         <div class="flex items-stretch gap-0.5">
           ${BOTTOM_BAR_ROUTES.map(r => {
             const active = r.id === opts.activeRoute;
             return `
               <button data-nav="${r.id}"
                 class="nav-item group flex flex-col items-center justify-center gap-1 flex-1 cursor-pointer
                        transition-colors duration-150 active:scale-95
                        ${active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}"
                 style="min-height:44px" aria-label="${r.label}"
                 ${active ? 'aria-current="page"' : ''}>
                 <span class="[&>span>svg]:w-[22px] [&>span>svg]:h-[22px] transition-transform duration-150
                              group-active:scale-90
                              ${active ? 'drop-shadow-[0_0_8px_var(--accent)]' : ''}">
                   ${ic(r.icon as IconName)}
                 </span>
                 <span class="text-[9px] font-mono tracking-wide leading-none">${r.label}</span>
               </button>`;
           }).join('')}
         </div>
       </nav>`
    : '';

  return `
    <div class="fixed inset-0 app-bg flex flex-col font-sans select-none overflow-hidden">
      <header
        class="card-glass flex-shrink-0 flex items-center gap-2 px-3 md:px-5 py-2.5 md:py-3
               border-x-0 border-t-0 md:mx-4 md:mt-2 md:rounded-2xl md:border"
        style="padding-top: max(0.625rem, env(safe-area-inset-top))">
        ${backBtn}
        ${opts.icon ? `<span class="accent-text flex-shrink-0 hidden sm:block [&>span>svg]:w-5 [&>span>svg]:h-5">${ic(opts.icon as any)}</span>` : ''}
        <div class="min-w-0 flex-1">
          <h1 class="font-['Orbitron'] font-bold text-[15px] md:text-lg accent-text truncate leading-tight">
            ${opts.title}
          </h1>
          ${opts.subtitle ? `<p class="text-[10px] md:text-[11px] text-[var(--text-muted)] font-mono truncate mt-0.5 hidden sm:block">${opts.subtitle}</p>` : ''}
        </div>
        ${nanites}
        ${opts.actions ? `<div class="flex items-center gap-1.5 flex-shrink-0">${opts.actions}</div>` : ''}
        ${homeBtn}
      </header>

      <main class="relative z-10 flex-grow min-h-0 w-full max-w-[68rem] mx-auto
                  px-3 md:px-4 pt-2 md:pt-3 overflow-y-auto overscroll-contain
                  -webkit-overflow-scrolling:touch ${opts.bodyClass || ''}"
           style="padding-bottom: calc(1rem + env(safe-area-inset-bottom))">
        ${body}
      </main>

      ${bottomBar}
    </div>
  `;
}

/** Franja de estadísticas: 2-4 números cortos con etiqueta encima. */
export function statStrip(stats: Array<{ label: string; value: string; tone?: string }>): string {
  return `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      ${stats.map(s => `
        <div class="card-glass border rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
          <span class="label-caps">${s.label}</span>
          <span class="font-['Orbitron'] font-bold text-[15px] md:text-base tabular
                       ${s.tone || 'accent-text'}">${s.value}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/** Sección con título y contador opcional. */
export function sectionHead(title: string, iconName: string, right = ''): string {
  return `
    <div class="flex items-center justify-between gap-2 mb-2.5">
      <h2 class="label-caps flex items-center gap-1.5">
        <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(iconName as any)}</span>
        ${title}
      </h2>
      ${right}
    </div>
  `;
}

/** Estado vacío: la mitad de las pantallas pasa un momento por aquí. */
export function emptyState(iconName: string, title: string, hint: string): string {
  return `
    <div class="card-glass border rounded-2xl py-10 px-5 flex flex-col items-center gap-2 text-center">
      <span class="text-[var(--text-muted)] opacity-40 [&>span>svg]:w-9 [&>span>svg]:h-9">${ic(iconName as any)}</span>
      <span class="font-['Orbitron'] font-bold text-sm text-[var(--text-main)]">${title}</span>
      <span class="text-[11px] text-[var(--text-muted)] max-w-[22rem] leading-relaxed">${hint}</span>
    </div>
  `;
}
