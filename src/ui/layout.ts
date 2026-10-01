// ==========================================================================
// Layout principal del juego.
//
// Responsive mobile-first: en móvil la navegación va en una barra inferior con
// zona táctil ≥44px (al alcance del pulgar, no en la esquina inalcanzable del
// header) y en escritorio se convierte en una fila de botones en la cabecera.
//
// Seguro para móvil:
//  - `env(safe-area-inset-*)` en los bordes para notch y barra de gestos
//  - `dvh` en lugar de `vh`: evita el salto cuando aparece la barra del navegador
//  - sin hover-dependiente: todo lo accionable es un botón real con :active
//  - las áreas de scroll usan `overscroll-behavior: contain` para que el
//    arrastre no mueva la página entera
//
// La barra inferior tiene exactamente 5 destinos. Antes tenía 5 también, pero
// dos de ellos (Ranking y Tema) eran secundarios: el jugador tenía que
// apartar el pulgar del borde inferior y buscar en la esquina. Ahora los
// cinco son páginas de verdad —Base, Almacén, Forja, Tienda, Perfil— y tanto
// el Ranking como el tema se alcanzan desde la cabecera y desde el Perfil.
//
// LA BARRA ES DE AQUÍ Y SOLO DE AQUÍ. Este archivo pinta el menú principal, y
// la barra inferior es su índice. Ninguna otra vista la dibuja: una vez entras
// en un sector se sale con el `‹` de la cabecera, y la barra solo reaparece
// al volver a la base. La razón es que repetir el mismo menú de cinco botones
// dentro de cada sector no daba información nueva —el botón del sector en el
// que estás nunca cambiaba de sitio, y los enlaces reales de cada página
// (perfil → prestigio, base → ranking) ya están dentro del contenido— y sí
// costaba algo: en las pantallas cortas tapaba la última fila de la lista y
// hacía que el `‹` dejara de ser la salida evidente.
// ==========================================================================

import { ic, type IconName } from './icons';
import { isSfxEnabled, isMusicEnabled } from '../utils/audio';
import { THEMES } from '../theme';
import { BOTTOM_BAR_ROUTES, HEADER_ROUTES, routeTitle, type Route } from './router';

export interface LayoutCallbacks {
  onNavigate: (route: Route) => void;
  onLogout: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onThemeChange: (theme: string) => void;
}



export function renderLayoutHTML(
  user: any,
  savedTheme: string,
  activeRoute: Route,
  cb: LayoutCallbacks
): string {
  const options = THEMES.map(t =>
    `<option value="${t.value}" ${t.value === savedTheme ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  const navBtn = (route: Route) => {
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

  return `
    <div class="fixed inset-0 app-bg flex flex-col font-sans select-none overflow-hidden">

      <!-- ===================== CABECERA ===================== -->
      <header
        class="relative z-20 card-glass flex-shrink-0 px-3 md:px-5 py-2.5 md:py-3
               border-x-0 border-t-0 md:mx-4 md:mt-2 md:rounded-2xl md:border"
        style="padding-top: max(0.625rem, env(safe-area-inset-top))">

        <div class="flex items-center justify-between gap-3">
          <!-- Identidad -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="relative flex-shrink-0">
              <span class="block w-8 h-8 rounded-lg accent-bg flex items-center justify-center"
                    style="box-shadow: 0 0 18px -4px color-mix(in srgb, var(--accent) 70%, transparent)">
                ${ic('chip', 'w-[18px] h-[18px] text-slate-900')}
              </span>
              <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full accent-bg border-2 animate-core-pulse"
                    style="border-color: var(--bg-app)"></span>
            </div>
            <div class="min-w-0">
              <div class="label-caps leading-none" id="page-title">${routeTitle(activeRoute)}</div>
              <div id="nav-username"
                   class="font-['Orbitron'] font-bold text-[13px] md:text-sm accent-text truncate leading-tight mt-0.5">
                ${user.displayName || 'Operativo'}
              </div>
            </div>
          </div>

          <!-- Navegación de escritorio -->
          <nav class="hidden lg:flex items-center gap-0.5 flex-shrink-0" aria-label="Navegación">
            ${HEADER_ROUTES.map(r => {
              const active = activeRoute === r.id;
              return `
                <button data-nav="${r.id}"
                  class="h-9 px-3 rounded-lg text-[11px] font-mono cursor-pointer transition flex items-center gap-1.5
                         ${active ? 'accent-bg text-slate-950 font-bold'
                                  : 'btn-ghost text-[var(--text-muted)]'}"
                  aria-label="${r.title}">
                  <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(r.icon as IconName)}</span>
                  ${r.label}
                </button>`;
            }).join('')}
          </nav>

          <!-- HUD de buffs: fila con scroll, nunca agranda la cabecera -->
          <div id="active-buffs-hud"
               class="hidden xl:flex items-center gap-1.5 flex-nowrap min-w-0 overflow-x-auto py-0.5"></div>

          <!-- Controles -->
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button data-nav="ranking" title="Ranking"
              class="lg:hidden w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer"
              aria-label="Ranking">
              <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('trophy')}</span>
            </button>

            <!--
              AUDIO: los dos interruptores son independientes y cada uno lleva
              su PROPIO icono. Antes los dos pintaban el altavoz, así que en
              móvil —donde la etiqueta de texto no cabe— eran dos botones
              idénticos y no se sabía cuál era cuál.

                música -> nota musical  (lo que pone, no lo que suena)
                SFX    -> altavoz       (icono de parlante)

              Apagado baja al icono de silencio y el texto dice "Off": el
              estado se lee de un vistazo, sin depender del title, que en
              táctil no aparece hasta mantener pulsado.

              data-audio en vez de dos ids distintos: un solo manejador por
              delegación cubre los dos, y el estado se lee con querySelector
              sin acoplarse al id.
            -->
            <button id="music-btn" data-audio="music"
              aria-pressed="${isMusicEnabled()}"
              aria-label="${isMusicEnabled() ? 'Apagar música' : 'Encender música'}"
              title="${isMusicEnabled() ? 'Apagar música' : 'Encender música'}"
              class="w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center
                     gap-1.5 cursor-pointer text-[11px] transition
                     ${isMusicEnabled() ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] opacity-70'}">
              <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic(isMusicEnabled() ? 'music' : 'mute')}</span>
              <span class="hidden md:inline font-mono">${isMusicEnabled() ? 'Música' : 'Off'}</span>
            </button>

            <button id="mute-btn" data-audio="sfx"
              aria-pressed="${isSfxEnabled()}"
              aria-label="${isSfxEnabled() ? 'Silenciar efectos' : 'Activar efectos'}"
              title="${isSfxEnabled() ? 'Silenciar efectos' : 'Activar efectos'}"
              class="w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center
                     gap-1.5 cursor-pointer text-[11px] transition
                     ${isSfxEnabled() ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] opacity-70'}">
              <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic(isSfxEnabled() ? 'sound' : 'mute')}</span>
              <span class="hidden md:inline font-mono">${isSfxEnabled() ? 'SFX' : 'Off'}</span>
            </button>

            <select id="theme-selector" aria-label="Tema visual"
              class="hidden md:block app-bg border border-[var(--border-color)] rounded-lg px-2.5 h-9
                     text-[11px] font-mono text-[var(--text-main)] cursor-pointer hover:border-[var(--accent)]
                     transition-colors">
              ${options}
            </select>

            <!--
              El ancho fijo evita que la etiqueta se descentre cuando los botones
              de audio alternan entre "Música" y "Off", y hace que el botón
              "Salir" no parezca moverse respecto al resto de la cabecera.

              items-center es lo que lo centra de verdad: antes era inline-flex
              a secas, y el nodo de texto, al ser un ítem anónimo de flex, se
              estiraba a la altura completa y la línea se pegaba arriba.
            -->
            <button id="logout-btn" data-logout title="Cerrar sesión"
              class="hidden md:inline-flex h-9 w-24 shrink-0 items-center justify-center gap-1.5 rounded-lg
                     text-[11px] font-mono cursor-pointer
                     border border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
              <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('logout')}</span>
              <span>Salir</span>
            </button>
          </div>
        </div>

        <!-- Buffs en móvil: bajo la cabecera, siempre visible -->
        <div id="buffs-hud-mobile"
             class="xl:hidden flex gap-1.5 overflow-x-auto mt-2 pb-0.5 empty:hidden -mx-1 px-1"></div>
      </header>

      <!-- ===================== ZONA DE JUEGO ===================== -->
      <main
        class="relative z-10 flex-grow min-h-0 w-full max-w-[68rem] mx-auto
               px-3 md:px-4 pt-2 md:pt-3 pb-2 md:pb-3
               grid grid-cols-1 lg:grid-cols-12 gap-2.5 md:gap-4
               overflow-y-auto lg:overflow-hidden overscroll-contain"
        style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom))">

        <!-- ---------- Columna izquierda: el recolector ---------- -->
        <section class="lg:col-span-5 card-glass rounded-2xl md:rounded-3xl
                        flex flex-col items-center justify-center gap-3 md:gap-5
                        p-4 md:p-5 lg:p-6 text-center min-h-0
                        justify-center lg:justify-start lg:pt-10">

          <!-- Métrica principal: el número que importa -->
          <div class="flex-shrink-0 w-full">
            <div class="flex items-baseline justify-center gap-1.5">
              <span id="nanites-counter"
                    class="font-['Orbitron'] font-black text-[32px] md:text-4xl accent-text
                           tabular leading-none tracking-tight
                           [text-shadow:0_0_28px_color-mix(in_srgb,var(--accent)_35%,transparent)]">0</span>
            </div>
            <div class="label-caps mt-1.5 flex items-center justify-center gap-1.5">
              <span class="accent-text font-bold not-italic" aria-hidden="true">◆</span>
              <span>Nanitas</span>
            </div>
            <div id="passive-income-display"
                 class="text-[11px] md:text-xs font-mono mt-1.5 text-[var(--text-muted)] tabular
                       min-h-[16px] flex items-center justify-center text-center px-2">
              +0 /s
            </div>
            <!--
              Aviso de guardado pendiente.

              Sin esto, con la red caída el jugador ve su saldo crecer en pantalla
              sin ninguna pista de que el servidor no lo sabe. Cierra la pestaña y
              no tiene forma de saber si se guardó o no. El indicador solo aparece
              cuando hay algo de verdad sin confirmar, y desaparece en cuanto
              llega: no es un adorno, es el estado real de la partida.
            -->
            <div id="pending-save-indicator"
                 role="status" aria-live="polite"
                 class="hidden mt-2 text-[10px] font-mono text-amber-400/90 flex items-center
                        justify-center gap-1.5 px-2 py-1 rounded-lg border border-amber-500/30
                        bg-amber-500/10">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>Sin guardar en el servidor</span>
            </div>
          </div>

          <!-- El botón: objetivo táctil grande y con respuesta táctil -->
          <button id="click-btn"
            class="relative rounded-full flex-shrink-0
                   w-32 h-32 md:w-40 md:h-40 lg:w-44 lg:h-44
                   max-h-[38vh] aspect-square
                   flex flex-col items-center justify-center gap-1.5 cursor-pointer
                   border-[3px] border-[var(--accent)] app-bg
                   transition-transform duration-100 ease-out active:scale-95
                   animate-core-breathe"
            style="box-shadow:
                   0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent),
                   0 0 44px -8px color-mix(in srgb, var(--accent) 55%, transparent),
                   inset 0 1px 0 color-mix(in srgb, #fff 12%, transparent)"
            aria-label="Recolectar nanitas">
            <span class="absolute inset-2 rounded-full border border-[var(--accent)] opacity-25 animate-core-pulse pointer-events-none"></span>
            <span class="relative accent-text animate-pulse" style="animation-duration:2s">
              <span class="[&>span>svg]:w-9 [&>span>svg]:h-9">${ic('bolt')}</span>
            </span>
            <span class="relative font-['Orbitron'] font-black text-[10px] md:text-xs
                         tracking-[0.2em] accent-text leading-none">RECOLECTAR</span>
          </button>

          <div id="click-damage-display"
               class="text-[11px] md:text-xs font-mono text-emerald-400 flex-shrink-0 tabular">
            +0 por click
          </div>

          <!-- Acceso rápido a la ascensión: el techo del juego tiene que ser
               alcanzable desde donde se pasa el 95% del tiempo -->
          <button data-nav="prestigio"
            class="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl btn-ghost cursor-pointer
                   transition active:scale-95 w-full max-w-[16rem]"
            style="border-color: color-mix(in srgb, var(--accent) 35%, transparent)">
            <span class="accent-text flex-shrink-0 [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('recycle')}</span>
            <span class="min-w-0 flex-1 text-left">
              <span class="block text-[10px] font-mono text-[var(--text-muted)] leading-none">Ascensión</span>
              <span class="block text-[11px] font-bold accent-text leading-tight mt-0.5" id="prestige-hint">
                0 núcleos
              </span>
            </span>
          </button>
        </section>

        <!-- ---------- Columna derecha: paneles ---------- -->
        <section class="lg:col-span-7 card-glass rounded-2xl md:rounded-3xl
                        flex flex-col min-h-0 overflow-hidden">
          <div class="flex items-center justify-between gap-2 px-4 md:px-5 py-3 flex-shrink-0
                      border-b border-[var(--border-color)]">
            <h2 class="font-['Orbitron'] font-bold text-[13px] md:text-sm accent-text
                       tracking-wide flex items-center gap-2">
              <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('companion')}</span>
              Escuadrón
            </h2>
            <span class="label-caps">Panel principal</span>
          </div>

          <div class="flex flex-col gap-2.5 md:gap-3 overflow-y-auto overscroll-contain
                      p-3 md:p-4 flex-grow min-h-0 -webkit-overflow-scrolling:touch">
            <!-- Recolector equipado -->
            <div class="app-bg border rounded-xl p-3 md:p-4 flex-shrink-0"
                 style="border-color: color-mix(in srgb, var(--accent) 45%, transparent);
                        background: linear-gradient(to bottom right,
                          color-mix(in srgb, var(--accent) 10%, transparent), transparent)">
              <div class="flex items-center gap-2 mb-2.5">
                <span class="[&>span>svg]:w-4 [&>span>svg]:h-4 accent-text">${ic('collector')}</span>
                <span class="label-caps" style="color: var(--accent)">Recolector</span>
              </div>
              <div id="equipped-collector-container"></div>
            </div>

            <!-- Compañeros -->
            <div class="app-bg border rounded-xl p-3 md:p-4 flex-shrink-0"
                 style="border-color: color-mix(in srgb, var(--accent) 30%, transparent);
                        background: linear-gradient(to bottom right,
                          color-mix(in srgb, var(--accent) 6%, transparent), transparent)">
              <div class="flex items-center justify-between gap-2 mb-3">
                <div class="flex items-center gap-2">
                  <span class="[&>span>svg]:w-4 [&>span>svg]:h-4 accent-text">${ic('companion')}</span>
                  <span class="label-caps" style="color: var(--accent)">Compañeros</span>
                </div>
                <span id="slots-label" class="text-[10px] font-mono text-[var(--text-muted)] tabular"></span>
              </div>
              <div id="companions-slots-container" class="grid grid-cols-3 gap-2 md:gap-2.5"></div>
            </div>
          </div>
        </section>
      </main>

      <!-- ===================== NAVEGACIÓN INFERIOR (MÓVIL) ===================== -->
      <nav
        class="lg:hidden relative z-20 card-glass border-x-0 border-b-0 flex-shrink-0 px-1 pt-1.5 pb-1"
        style="padding-bottom: max(0.25rem, env(safe-area-inset-bottom))"
        aria-label="Navegación principal">
        <div class="flex items-stretch gap-0.5 relative">
          ${BOTTOM_BAR_ROUTES.map(r => navBtn(r.id)).join('')}
        </div>
      </nav>

      <!-- Avisos de logro: por encima de todo, sin bloquear toques -->
      <div id="achievement-stack"
           class="fixed z-[70] left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[min(92vw,22rem)]
                  pointer-events-none"
           style="bottom: calc(5.5rem + env(safe-area-inset-bottom))"></div>

      <!-- ===================== PANEL DE TEMA (MÓVIL) ===================== -->
      <div id="theme-sheet" class="lg:hidden fixed inset-0 z-40 hidden">
        <div class="absolute inset-0 bg-black/65 backdrop-blur-sm" id="theme-sheet-overlay"></div>
        <div class="absolute bottom-0 left-0 right-0 card-glass-elevated rounded-t-2xl
                    p-5 pb-8 flex flex-col gap-3"
             style="padding-bottom: calc(2rem + env(safe-area-inset-bottom));
                    animation: riseIn 280ms cubic-bezier(0.16, 1, 0.3, 1) both">
          <div class="flex items-center justify-between">
            <h3 class="font-['Orbitron'] font-bold text-sm accent-text">Tema visual</h3>
            <button id="close-theme-sheet" class="w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer"
                    aria-label="Cerrar">
              <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('close')}</span>
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            ${THEMES.map(t => `
              <button data-theme-option="${t.value}"
                class="theme-option h-11 rounded-lg btn-ghost text-[11px] font-mono cursor-pointer
                       flex items-center justify-center gap-1.5 transition-colors"
                style="${t.value === savedTheme ? 'border-color:' + t.tone + ';color:' + t.tone : ''}">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${t.tone}"></span>
                ${t.label}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}
