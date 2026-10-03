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
import { navMobileHTML } from './navBars';
import { appHeaderHTML } from './appHeader';
import { formatNumber } from '../utils/format';

export interface PageShellOptions {
  title: string;
  /**
   * **YA NO HAY SUBTÍTULO, Y POR QUÉ ESTÁ QUITADO DE LA INTERFAZ Y NO SOLO DE LA PANTALLA.**
   *
   * La cabecera pintaba una segunda línea con una frase de presentación —"Todo se paga con
   * nanitas", "Fusión, autoría y potencial"— y lo que se pidió fue quitarla. Dejarla en el
   * tipo sería dejarla como una opción que ya no tiene efecto: el siguiente que escriba
   * `subtitle:` la pondría, no vería nada, y perdería el rato. Por eso desaparece del tipo.
   *
   * **NADA SE PIERDE CON ELLO.** Las siete descripciones eran de presentación, no de juego:
   * la única que decía algo era la del mercado —el descuento del árbol aplicado— y esa ya
   * aparece en el panel de detalle de la ficha, en la fila "Descuento".
   */
  icon?: string;
  /**
   * Qué ruta está pintando esta página.
   *
   * **NO ES ADORNO: es lo que marca el botón activo de las dos barras.** Sin esto
   * cada página diría cuál de las cinco rutas es la buena, y el jugador vería
   * "Forja" resaltada dentro del almacén. Y como las barras viven en un módulo
   * compartido, el fallo no se ve en la página: se ve en las dos barras a la vez.
   */
  route: Route;
  /** Contenido extra del encabezado a la derecha, antes del contador. */
  actions?: string;
  /**
   * Estado de la partida, para la franja de recursos de la cabecera.
   *
   * `hideNanites` ya no existe, y no porque se haya olvidado quitarlo: **ya no hay
   * ningún contador de nanitas en la página que pueda esconderse.** El almacén lo
   * pedía con `hideNanites: true` para no tener dos cifras de nanitas a la vez, y la
   * razón por la que se escondía —que en la cabecera hubiera otro— es la que ha
   * desaparecido. Dejar el flag sería dejar un interruptor que no hace nada, y el día
   * que alguien lo tocara creería que controla algo.
   */
  state?: any;
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
export function wireNav(root: HTMLElement, cb: { go?: (r: Route) => void }) {
  root.addEventListener('click', (e) => {
    const nav = (e.target as HTMLElement).closest('[data-nav]') as HTMLElement | null;
    if (nav) {
      e.stopPropagation();
      cb.go?.(nav.dataset.nav as Route);
      return;
    }
  });
}

export function pageShell(opts: PageShellOptions, body: string): string {
  // Sin barra inferior el cuerpo se apoya en el borde inferior de la pantalla.
  // El safe-area sigue estando: en iPhone el gesto de subir descarta el contenido
  // que quede justo en el borde, y sin ese margen el último botón de la página
  // queda debajo del gesto.
  // **LA CABECERA DE LAS SEIS PÁGINAS, Y LA MISMA FUNCIÓN QUE LA DE LA BASE.**
  //
  // Aquí solo hay una diferencia con la de la base y son tres campos: el título, el icono
  // y las acciones. El resto —la altura de la fila, la posición del nav, el sitio de los
  // recursos— sale de `appHeaderHTML()`, y es justamente esa parte la que hace que el
  // nav no se mueva. Antes cada pantalla pintaba su propio `<header>`, y el de la base
  // medía 111 px contra los 71 de estas seis.
  return `
    <div class="fixed inset-0 app-bg flex flex-col font-sans select-none overflow-hidden">
      ${appHeaderHTML({
        route: opts.route,
        // El botón del ranking en móvil: en escritorio ya está en el nav, y por eso el
        // nav de escritorio lo tiene filtrado. Es la misma regla que en la base.
        title: opts.title,
        icon: opts.icon as any,
        resources: opts.state ?? false,
        actions: opts.actions
      })}

      <main class="relative z-10 flex-grow min-h-0 w-full max-w-[68rem] mx-auto
                  px-3 md:px-4 pt-2 md:pt-3 overflow-y-auto overscroll-contain
                  -webkit-overflow-scrolling:touch ${opts.bodyClass || ''}"
           style="padding-bottom: calc(1rem + env(safe-area-inset-bottom))">
        ${body}
      </main>

      ${navMobileHTML(opts.route)}
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
