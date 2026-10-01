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
// NAVEGACIÓN. Aquí NO se pinta la barra inferior: la barra es del menú
// principal y solo del menú principal.
//
// Antes esta cáscara también dibujaba los cinco destinos, y el resultado era un
// mapa de dos menús: en la base estaba la barra y al entrar a cualquier sector
// aparecía OTRA vez, idéntica pero sin el sector activo resaltado, porque los
// enlaces internos de una página (perfil → prestigio, base → ranking) van
//idgets en un submenú que no está en la barra. Con las dos barras a la vez la
//posición de los iconos se corría respecto al menú al que decías haber
//entrado, y la salida de un sector dependedía de cuál de las dos pulsabas.
//
// Ahora la regla es una sola: la barra inferior es el índice del juego y solo
// existe en la base. Desde cualquier otro sector se sale con el botón `‹` de la
// esquina superior izquierda, que es el gesto de "atrás" que ya se esperaba, y
// que además nunca falla: si el historial no tiene nada más, cae a la base.
//
// LA ESQUINA SUPERIOR DERECHA SE QUEDÓ VACÍA A PROPÓSITO.
//
// En escritorio había ahí un botón de "inicio" (el icono del microchip) que
// ignoraba el historial y saltaba a la base. Se quitó porque es justo donde
// aterrizan los avisos flotantes: los tapaba, y encima era el segundo control
// de navegación en una esquina que ya tiene el contador de nanitas y las
// acciones de la página.
//
// La salida no se pierde: el `‹` es el mismo en las siete pantallas y, como
// `back()` cae a la base cuando no queda historial, nunca deja al jugador en un
// sitio del que no pueda salir. Lo que se pierde es el atajo de un clic al
// panel principal, y a cambio la esquina superior derecha queda libre para lo
// que el jugador tiene que leer.
// ==========================================================================

import { ic } from './icons';
import type { Route } from './router';
import { formatNumber } from '../utils/format';

export interface PageShellOptions {
  title: string;
  subtitle?: string;
  icon?: string;
  /** Botón de volver. Si no se pasa `onBack`, no se pinta. */
  onBack?: () => void;
  /** Contenido extra del encabezado a la derecha, antes del contador. */
  actions?: string;
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
 * La solución es meter dentro del contenedor un nodo NUEVO cada vez y tirar el
 * anterior. `cloneNode` no era necesario para limpiar listeners: basta con
 * crear un elemento de cero y vaciar dentro de él, porque los listeners viven
 * en el nodo que se descarta.
 *
 * POR QUÉ NO SE SUSTITUYE EL CONTENEDOR.
 *
 * La versión anterior hacía `prev.replaceWith(fresh)`, es decir, cambiaba el
 * propio `#app` por un clon. Eso rompía la navegación entera: `main.ts` guarda
 * `const app = document.querySelector('#app')` una vez al arrancar, y después
 * del primer `mountInto` esa variable apuntaba a un nodo ya desconectado del
 * documento. Volver a la base escribía el HTML en un nodo invisible, y
 * `app.onclick = ...` escuchaba en un nodo que ya no estaba en pantalla. El
 * síntoma era "no me deja volver atrás": la barra seguía dibujada en la
 * pantalla anterior, pero los botones no hacían nada porque el manejador
 * estaba colgado de un nodo que nadie veía.
 *
 * El contenedor se respeta. Lo único que se reemplaza es el nodo interior que
 * aloja la página, y ese sí se busca por atributo en cada montaje, así que
 * `app.innerHTML = ''` entre render y render no lo deja desincronizado.
 */

/** Marca el nodo interior que `mountInto` va sustituyendo. */
const MOUNT_ATTR = 'data-page-root';

export function mountInto(container: HTMLElement, html: string): HTMLElement {
  const prev = container.querySelector(`:scope > [${MOUNT_ATTR}]`);
  const fresh = container.ownerDocument.createElement('div');
  fresh.setAttribute(MOUNT_ATTR, '');
  fresh.className = 'page-root';
  fresh.innerHTML = html;

  if (prev) prev.replaceWith(fresh);
  else container.appendChild(fresh);

  return fresh;
}

/** Vacía el nodo interior de una página. Se llama al salir de ella. */
export function unmount(container: HTMLElement): void {
  container.querySelector(`:scope > [${MOUNT_ATTR}]`)?.remove();
}

/**
 * Conecta la navegación de una página: botón de volver y cualquier elemento
 * con `data-nav`.
 *
 * Se delega en el contenedor en vez de registrar un manejador por botón,
 * porque los botones se recrean en cada render y un listener por botón se
 * acumularía sobre nodos muertos. Un solo listener en la raíz, y la raíz se
 * recrea limpia con `mountInto`.
 */
export function wireNav(root: HTMLElement, cb: { back?: () => void; go?: (r: Route) => void }) {
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
    }
  });
}

export function pageShell(opts: PageShellOptions, body: string): string {
  // El `‹` es LA salida del sector, y por eso se pinta siempre que haya
  // `onBack` — sin importar el tamaño de la pantalla. Es el único control de
  // navegación que existe aquí, así que no puede depender de un breakpoint:
  // en móvil es la esquina inalcanzable del pulgar, y en escritorio es el
  // botón de vuelta atrás de toda la vida.
  const backBtn = opts.onBack
    ? `<button data-nav-back
         class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0
                transition-transform active:scale-90"
         style="min-width:44px;min-height:44px" aria-label="Volver">
         <span class="[&>span>svg]:w-5 [&>span>svg]:h-5">${ic('back')}</span>
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
         <span class="font-mono text-[11px] text-[var(--text-main)]" id="page-nanites-val">${formatNumber(opts.state.nanites || 0)}</span>
       </span>`
    : '';

  // Sin barra inferior el cuerpo se apoya en el borde inferior de la pantalla.
  // El safe-area sigue estando: en iPhone el gesto de subir descarta el contenido
  // que quede justo en el borde, y sin ese margen el último botón de la página
  // queda debajo del gesto.
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

/**
 * Franja de estadísticas: 2-4 números cortos con etiqueta encima.
 *
 * `glyph` va delante de la etiqueta y es lo que permite distinguir la moneda sin
 * tener que leer la palabra: el rombo delante de "NANITAS" se reconoce de un
 * vistazo, y es el mismo glifo que usan los contadores de la cabecera y del
 * almacén.
 *
 * `valueId` existe porque la franja se pinta una sola vez al montar la página y
 * el juego no para: una stat que es un contador —el saldo, que es lo que
 * decide si puedes comprar— se queda congelada en la cifra de hace un minuto.
 * Pasando el id, `updateUI` la refresca por el DOM en cada tick en vez de
 * obligar a la página entera a re-pintarse.
 */
export function statStrip(stats: Array<{
  label: string;
  value: string;
  tone?: string;
  glyph?: string;
  valueId?: string;
}>): string {
  return `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      ${stats.map(s => `
        <div class="card-glass border rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
          <span class="label-caps">
            ${s.glyph ? `<span class="accent-text not-italic">${s.glyph}</span>` : ''}
            ${s.label}
          </span>
          <span class="font-['Orbitron'] font-bold text-[15px] md:text-base tabular
                       ${s.tone || 'accent-text'}"
                ${s.valueId ? `id="${s.valueId}"` : ''}>${s.value}</span>
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
