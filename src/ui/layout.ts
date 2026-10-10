// ==========================================================================
// Layout principal del juego.
//
// Responsive mobile-first: en móvil la navegación va en una barra inferior con
// zona táctil ≥44px (al alcance del pulgar, no en la esquina inalcanzable del
// header) y en escritorio se convierte en una fila de botones en la cabecera.
//
// Seguro para móvil:
//  - env(safe-area-inset-*) en los bordes para notch y barra de gestos
//  - dvh en lugar de vh: evita el salto cuando aparece la barra del navegador
//  - sin hover-dependiente: todo lo accionable es un botón real con :active
//  - las áreas de scroll usan overscroll-behavior: contain para que el
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
// en un sector se sale con el ‹ de la cabecera, y la barra solo reaparece
// al volver a la base. La razón es que repetir el mismo menú de cinco botones
// dentro de cada sector no daba información nueva —el botón del sector en el
// que estás nunca cambiaba de sitio, y los enlaces reales de cada página
// (perfil → prestigio, base → ranking) ya están dentro del contenido— y sí
// costaba algo: en las pantallas cortas tapaba la última fila de la lista y
// hacía que el ‹ dejara de ser la salida evidente.
// ==========================================================================

import { ic, type IconName } from './icons';
import { isSfxEnabled, isMusicEnabled } from '../utils/audio';
import { THEMES } from '../theme';
import { routeTitle, type Route } from './router';
import { navMobileHTML } from './navBars';
import { appHeaderHTML } from './appHeader';
import { miniIdentity, type IdentityCosmetics } from './identity';

export interface LayoutCallbacks {
  onNavigate: (route: Route) => void;
  onLogout: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onThemeChange: (theme: string) => void;
}

/** Quién eres en la cabecera: nombre para pintar y cosméticos equipados. */
export interface NavIdentity {
  name: string;
  cosmetics?: IdentityCosmetics;
}



export function renderLayoutHTML(
  user: any,
  savedTheme: string,
  activeRoute: Route,
  cb: LayoutCallbacks,
  identity?: NavIdentity,
  /**
   * El estado de la partida, para la franja de recursos de la cabecera.
   *
   * **ES EL ÚNICO MOTIVO POR EL QUE ESTE PARÁMETRO EXISTE.** La franja se pinta una
   * vez, al montar el layout, y de ahí en adelante la refresca updateResourceBar() en
   * cada tick; lo que hace falta al pintar es el valor inicial, y ese solo lo sabe el
   * motor.
   *
   * Y es opcional a propósito: las pantallas de acceso y las del navTest montan este
   * mismo layout **sin partida**, y si fuera obligatorio habría que inventar un estado
   * falso para ellas. Con que no venga, la cabecera se pinta sin recursos y el
   * updateResourceBar no encuentra nada que actualizar —que es lo que devuelve, y lo
   * que permite que nadie se entere—.
   */
  state?: any
): string {
  const options = THEMES.map(t =>
    `<option value="${t.value}" ${t.value === savedTheme ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  return `
    <div class="fixed inset-0 app-bg flex flex-col font-sans select-none overflow-hidden">

      <!-- ===================== CABECERA ===================== -->
      <!--
        LA CABECERA DE LA BASE, Y POR QUÉ DEJA DE SER UNA CABECERA PROPIA.

        Este bloque era el segundo sitio del juego que pintaba una franja de arriba.
        Las seis páginas tienen la suya en pageShell.ts, y las dos se parecían pero
        no eran iguales: esta metía la identidad con avatar dentro de un flex-1 —que es
        más alta que un título de una línea— y las páginas no tenían ninguno. Medido con
        getBoundingClientRect() en las siete pantallas: **esta medía 111 px y las otras
        seis 71**.

        No era una cuestión de gusto. El nav va centrado verticalmente en la fila, así
        que 40 px de diferencia son 20 px de nav desplazado; y como el flex-1 estaba en
        un sitio y no en el otro, el nav caía también a distinta distancia del borde. El
        mismo HTML del nav en las siete pantallas, y aun así se movía al cambiar de
        sector, que es justo lo que el jugador ve: "aquí no está donde estaba".

        Ahora llama a appHeaderHTML(), que fija la altura de la fila, pone el nav al
        final y el flex-1 en el grupo de la izquierda. Lo único que aquí es distinto son
        tres cosas: el título sale del router, la identidad se pasa como HTML y los
        controles van en actions.
      -->
      ${appHeaderHTML({
        route: activeRoute,
        // El título de la base lo decide la ruta, y por eso no se pasa: es el único sitio
        // donde eso se escribe, y no un texto repetido en dos ficheros.
        identityHTML: miniIdentity(identity?.name ?? user.displayName ?? 'Operativo', identity?.cosmetics, {
          hideDefaultTitle: true,
          nameClass: 'font-[\'Orbitron\'] font-bold text-[13px] md:text-sm accent-text truncate leading-tight'
        }),
        // El HUD de buffs vive en el grupo de la izquierda porque se puede desplazar y
        // encogerse; en actions, que no encoge, aplastaría al nav.
        buffsHudId: 'active-buffs-hud',
        mobileBuffsId: 'buffs-hud-mobile',
        // Sin estado no hay recursos: es el caso de la pantalla de acceso y del
        // navTest, que montan este layout sin partida detrás.
        resources: state ?? false
      })}

      <!-- ===================== ZONA DE JUEGO ===================== -->

      <!--
        POR QUÉ lg:overflow-hidden ESTABA Y POR QUÉ SE HA QUITADO. Era la causa de que
        las cosas desaparecieran: en escritorio el contenido **no tenía scroll**, así que
        lo que no cabía se cortaba en silencio, sin barra y sin aviso. Un jugador con la
        ventana un poco más baja perdía el botón de ascender o la barra de consumibles y
        no tenía forma de recuperarlos. Es el peor modo de fallo que hay en un layout:
        no hay error, solo falta.

        Ahora la columna se desplaza en todos los tamaños. **Que haya barra no es el
        objetivo**: el objetivo es que no haga falta, y para eso lo de abajo. Pero una
        red de seguridad que deja todo alcanzable siempre es mejor que un recorte que a
        veces aparece, y sobre todo en pantallas que no son las de diseño.
      -->
      <main
        class="relative z-10 flex-grow min-h-0 w-full max-w-[68rem] mx-auto
               px-3 md:px-4 pt-2 md:pt-3 pb-2 md:pb-3
               grid grid-cols-1 lg:grid-cols-12 gap-2.5 md:gap-4
               overflow-y-auto overflow-x-hidden overscroll-contain"
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
                    class="font-['Orbitron'] font-black accent-text
                           text-[clamp(1.5rem,5.5vh,2.25rem)]
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
              Cartel de pausa por inactividad (B10).

              Cuando el AFK salta solo, lo único que cambiaba era el "+0 /s" de
              arriba: el jugador volvía a la pantalla y no sabía por qué no
              entraba nada. El cartel lo dice y dice qué hacer (pulsar), que es
              justo lo que saca del AFK. Lo enciende el repintado con parado,
              que es la misma pregunta del motor que deja el contador en +0/s y
              para el botón, así que cartel, botón y número no pueden
              contradecirse. Con tarjeta AFK viva no sale: el juego sigue
              cobrando (B19).
            -->
            <div id="afk-banner"
                 role="status" aria-live="polite"
                 class="hidden mt-2 text-[10px] font-mono text-amber-400/90 items-center
                        justify-center gap-1.5 px-2 py-1 rounded-lg border border-amber-500/30
                        bg-amber-500/10">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>En pausa por inactividad — pulsa para seguir cobrando</span>
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

          <!--
            EL BOTÓN, Y POR QUÉ SU TAMAÑO DEPENDE DE LA ALTURA DE LA VENTANA.

            Era fijo: w-32 h-32 md:w-40 md:h-40 lg:w-44 lg:h-44 con un max-h-[38vh].
            El max-h recortaba el **ancho** implícito sin avisar —el botón se volvía
            ovalado en vez de cuadrado— y, sobre todo, fijaba 176 px de alto en pantallas
            donde no caben: en una ventana de 700 px, la columna izquierda ya se pasaba.

            Ahora es un clamp sobre vh: 104 px de suelo, 26% de la altura, 176 px de
            techo. En una ventana alta sigue siendo el botón grande de siempre; en una
            de 600 px baja a 156 px y en una de 500 a 130, y la columna entra. **El suelo
            y el techo importan**: por debajo de 104 px el icono deja de leerse, así que
            antes de encoger más se acepta que la barra aparezca.
          -->
          <button id="click-btn"
            class="relative rounded-full flex-shrink-0
                   w-[clamp(6.5rem,26vh,11rem)] h-[clamp(6.5rem,26vh,11rem)]
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

          <!--
            EL AVISO DE "NO TIENES RECOLECTOR", Y POR QUÉ NO BASTA CON VER "+1 POR CLICK".

            El suelo de 1 del motor evita que la partida se bloquee, pero un "+1" solo, sin
            decir por qué, es indistinguible de un bug: el jugador ve un número que no
            cuadra con nada y no tiene forma de saber que le falta un equipo.

            Así que se dice, y se dice en el sitio donde se va a notar: **junto al botón
            que falla de verdad**. Un aviso que aparece lejos del problema que explica es un
            aviso que no se lee.
          -->
          ${!state?.equippedCollectorId ? `
            <p class="text-[10px] font-mono text-amber-400/90 text-center leading-snug max-w-[22rem]">
              No tienes ningún recolector equipado. Cada click te da 1 mientras tanto: abre
              una caja del Mercado para conseguir uno.
            </p>` : ''}

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

          <!--
            BARRA DE ACCESO RÁPIDO A CONSUMIBLES. TRES HUECOS FIJOS, NO UNA LISTA.

            **POR QUÉ TRES Y NO TODOS.** Un consumible se usa cuando lo decides, y para
            decidirlo tienes que verlo. Con veinte huecos no decides nada: es el almacén otra
            vez. Con tres decides "de estos, ahora", y si tienes más de tres entran los tres
            más caros, que son los que más duele reponer. El orden lo pone el almacén, no
            esta barra: es el mismo eje que su rejilla, y si los dos sitios ordenaran distinto
            el mismo consumible aparecería en dos posiciones sin que ninguna se explique.

            **Y FIJOS, PARA QUE NO SALTE NADA AL USAR UNO.** Un hueco por cada consumible
            distinto, en el orden del almacén, hace que al gastar uno desaparezca una casilla
            y las otras se desplacen: el dedo que iba a la tercera acaba en otra cosa. Con
            tres ranuras fijas el botón que pulsas sigue siendo el mismo después.

            El repintado lo pone main.ts en el mismo sitio que el #prestige-hint de al
            lado, y el motor dice cuántos se pueden usar de cada uno.
          -->
          <div id="barra-consumibles"
               class="flex-shrink-0 grid grid-cols-3 gap-2 mt-3 w-full"
               aria-label="Consumibles del almacén"></div>
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
            <!--
              AQUÍ PONÍA "Panel principal", Y NO ERA CIERTO NI ÚTIL. La columna del
              escuadón no es el panel principal: la pantalla entera lo es. Y la etiqueta
              repetía lo que el nav ya dice al resaltar "Base", en una esquina distinta, lo
              que la convertía en el segundo sitio donde se lee lo mismo.
            -->
            <!--
              LAS DOS PESTAÑAS, Y POR QUÉ ESTÁN DEBAJO DEL TÍTULO Y NO EN SU LUGAR.

              Recolector y escuadrón estaban apilados en la misma columna y en un móvil
              había que hacer scroll para pasar de uno al otro. Con la ficha del recolector
              !

              más el detalle y la rejilla de compañeros, la columna se hacía más larga que
              la pantalla, y lo que estaba arriba —la ficha, con el número grande— era
              justamente lo que se empujeaba fuera.

              El título se queda en "Escuadrón" porque es el nombre de la columna, no el de
              una de las dos mitades: poner "Recolector" arriba y "Escuadrón" como pestaña
              sería el mismo nombre en dos sitios con dos significados.

              Y las dos pestañas viven en un tablist de verdad, con aria-selected y
              teclado: no son dos botones decorativos.
            -->
            <div role="tablist" aria-label="Qué ver"
                 class="flex gap-1 mt-2 p-0.5 rounded-lg self-start"
                 style="background: color-mix(in srgb, var(--text-main) 6%, transparent)">
              <button data-pestana="recolector" role="tab"
                      class="h-7 px-2.5 rounded-md text-[11px] font-mono cursor-pointer
                             transition-colors flex items-center gap-1.5"
                      aria-controls="panel-recolector">
                <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('collector')}</span>
                Recolector
              </button>
              <button data-pestana="escuadron" role="tab"
                      class="h-7 px-2.5 rounded-md text-[11px] font-mono cursor-pointer
                             transition-colors flex items-center gap-1.5"
                      aria-controls="panel-escuadron">
                <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('companion')}</span>
                Escuadrón
              </button>
            </div>
          </div>

          <!-- Recolector equipado -->
          <div id="panel-recolector" role="tabpanel" aria-labelledby="pestana-recolector"
               class="flex flex-col gap-2.5 md:gap-3 overflow-y-auto overscroll-contain
                      p-3 md:p-4 flex-grow min-h-0 -webkit-overflow-scrolling:touch">
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
          </div>

          <!-- Compañeros -->
          <div id="panel-escuadron" role="tabpanel" aria-labelledby="pestana-escuadron"
               class="hidden flex flex-col gap-2.5 md:gap-3 overflow-y-auto overscroll-contain
                      p-3 md:p-4 flex-grow min-h-0 -webkit-overflow-scrolling:touch">
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
      ${navMobileHTML(activeRoute)}

      <!-- Avisos de logro: por encima de todo, sin bloquear toques -->
      <div id="achievement-stack"
           class="fixed z-[70] left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[min(92vw,22rem)]
                  pointer-events-none"
           style="bottom: calc(5.5rem + env(safe-area-inset-bottom))"></div>

      <!--
        BORRADO: EL PANEL DE TEMA DE AQUÍ.

        Era el panel de tema, con lg:hidden, y en escritorio lo sustituía un
        select que hacía lo mismo. Ahora los dos están en la hoja de ajustes de la
        cabecera —que se pinta en las siete pantallas—, así que este bloque era la tercera
        forma de cambiar el tema y la única que no funcionaba desde un sector.

        Lo que queda es una hoja con las tres cosas juntas: audio, tema y salida. Tres
        sitios para lo mismo era justo lo que se quería evitar.
      -->
    </div>
  `;
}
