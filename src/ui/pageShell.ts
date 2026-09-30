// ==========================================================================
// Cáscara de página
//
// Todas las vistas secundarias (almacén, forja, tienda, perfil, ranking,
// prestigio) se montan con esta función. Antes cada una reconstruía su propio
// contenedor a mano, y por eso todas se veian ligeramente distintas: unas
// tenían safe-area y otras no, una variaba el título a 24px y otra a 18px, y el
// botón de volver estaba en dos posiciones distintas.
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
// ==========================================================================

import { ic } from './icons';

export interface PageShellOptions {
  title: string;
  subtitle?: string;
  icon?: string;
  /** Botón de volver. Si no se pasa `onBack`, no se pinta. */
  onBack?: () => void;
  /** Contenido del encabezado a la derecha (contadores, filtros). */
  actions?: string;
  /** Clases extra del contenedor. */
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
 * llevar la cuenta de qué se registró. El `WeakMap` recuerda cuál es ahora el
 * nodo vivo, porque quien llama guarda la referencia del principio y esa quedó
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

export function pageShell(opts: PageShellOptions, body: string): string {
  const backBtn = opts.onBack
    ? `<button data-nav-back
         class="w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0
                transition-transform active:scale-90"
         style="min-width:44px;min-height:44px" aria-label="Volver">
         <span class="[&>span>svg]:w-5 [&>span>svg]:h-5">${ic('back')}</span>
       </button>`
    : '';

  return `
    <div class="fixed inset-0 app-bg flex flex-col font-sans select-none overflow-hidden">
      <header
        class="card-glass flex-shrink-0 flex items-center gap-2.5 px-3 md:px-5 py-2.5 md:py-3
               border-x-0 border-t-0 md:mx-4 md:mt-2 md:rounded-2xl md:border"
        style="padding-top: max(0.625rem, env(safe-area-inset-top))">
        ${backBtn}
        ${opts.icon ? `<span class="accent-text flex-shrink-0 [&>span>svg]:w-5 [&>span>svg]:h-5">${ic(opts.icon as any)}</span>` : ''}
        <div class="min-w-0 flex-1">
          <h1 class="font-['Orbitron'] font-bold text-[15px] md:text-lg accent-text truncate leading-tight">
            ${opts.title}
          </h1>
          ${opts.subtitle ? `<p class="text-[10px] md:text-[11px] text-[var(--text-muted)] font-mono truncate mt-0.5">${opts.subtitle}</p>` : ''}
        </div>
        ${opts.actions ? `<div class="flex items-center gap-1.5 flex-shrink-0">${opts.actions}</div>` : ''}
      </header>

      <main class="relative z-10 flex-grow min-h-0 w-full max-w-[68rem] mx-auto
                  px-3 md:px-4 pt-2 md:pt-3 overflow-y-auto overscroll-contain
                  -webkit-overflow-scrolling:touch ${opts.bodyClass || ''}"
           style="padding-bottom: calc(1rem + env(safe-area-inset-bottom))">
        ${body}
      </main>
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

/** Estado vacío: la mitad de las pantallasolas un momento de "aquí no hay nada". */
export function emptyState(iconName: string, title: string, hint: string): string {
  return `
    <div class="card-glass border rounded-2xl py-10 px-5 flex flex-col items-center gap-2 text-center">
      <span class="text-[var(--text-muted)] opacity-40 [&>span>svg]:w-9 [&>span>svg]:h-9">${ic(iconName as any)}</span>
      <span class="font-['Orbitron'] font-bold text-sm text-[var(--text-main)]">${title}</span>
      <span class="text-[11px] text-[var(--text-muted)] max-w-[22rem] leading-relaxed">${hint}</span>
    </div>
  `;
}
