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
import { getSkipRoulette } from '../roulettePrefs';
import { getPatchNotes } from '../patchNotesPrefs';
import { routeTitle, type Route } from './router';
import { navDesktopHTML } from './navBars';
import { isMusicEnabled, isSfxEnabled } from '../utils/audio';
import { THEMES, getSavedTheme } from '../theme';
import { formatNumber } from '../utils/format';

// --------------------------------------------------------------------------
//  EL TAMAÑO DE LOS ICONOS DE LA CABECERA
// --------------------------------------------------------------------------

/**
 * Los iconos de la cabecera, en un número cada uno, y no repetidos.
 *
 * **EL PROBLEMA QUE ESTO ARREGLA ES DE PESO VISUAL, NO DE TAMAÑO.** Medido en el
 * navegador: los tres glifos de la franja de saldos y los seis del nav estaban todos a
 * `w-3.5`, o sea 14 px, y medían 14x14 los nueve. O sea que el problema no era que
 * fueran de tamaños distintos: era que **a 14 px, al lado de un número de 11 px en
 * monoespaciada, los tres glifos no tienen el mismo peso**. El rayo, que es un trazo
 * corto, se leía casi relleno; la gema, que es una silueta, se leía más fina; y el
 * círculo con sus cuatro radios, que es lo que más líneas tiene, se leía como un
 * dibujo más pequeño que las otras dos. Tres estilos, no tres iconos.
 *
 * Por eso el de los saldos sube a 16 px y el del título se queda en 20: cada uno tiene
 * su función y su escala, pero las dos salen de una constante y no de un literal
 * repetido por el fichero. Añadir un cuarto saldo con otro tamaño sería tocar aquí y en
 * un solo sitio.
 */
const ICONO_DE_SALDO = '[&>span>svg]:w-4 [&>span>svg]:h-4';
const ICONO_DE_TITULO = '[&>span>svg]:w-5 [&>span>svg]:h-5';

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
 * exista: si un saldo se enseña en dos sitios, el jugador acaba tomando uno de
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
 * el jugador compra, lo que empuja el nav un poco. Con el ancho reservado, la
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
          <span class="accent-text ${ICONO_DE_SALDO}" aria-hidden="true">${ic(r.icono)}</span>
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
 * un contador obligaba a tocar dos ficheros, y olvidar el segundo síntoma deja un
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
  /**
   * Lo que esta pantalla pone **además** de lo común.
   *
   * El audio, el tema y la salida están en la hoja de ajustes, que es de la cabecera y
   * va en las siete. Aquí solo cabe lo que es de un sector —el botón que abre la ayuda
   * de la Forja, la píldora de núcleos del prestigio— y por eso es opcional.
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
 * LA HOJA DE AJUSTES, Y POR QUÉ ES UNA HOJA Y NO TRES BOTONES EN LA CABECERA.
 *
 * **LO QUE RESUELVE, Y SON TRES COSAS A LA VEZ.**
 *
 * · **La asimetría.** El audio, el tema y la salida estaban solo en la base, así que al
 *   entrar a cualquier sector desaparecían. Y el tema era peor de lo que parecía: su
 *   panel era `lg:hidden` y estaba en `layout.ts`, o sea que **desde un sector no se
 *   podía cambiar el tema de ninguna manera**. Un botón que solo existe en la base es un
 *   botón que hay que recordar dónde está.
 * · **El ancho.** Con los tres en línea, la fila pasa de "título, saldos, nav" a
 *   "título, saldos, audio, audio, tema, salida, nav". Medido: el nav **volvía a
 *   moverse**, porque al desbordarse la fila su borde derecho dejaba de ser el padding
 *   de la cabecera. Con un botón se vuelve a la medida anterior, que era la buena.
 * · **La fila.** Con un botón, la fila es idéntica en las siete y su contenido también.
 *   Lo que el jugador aprende una vez vale para todas.
 *
 * **LO QUE SE PIERDE, Y SE DICE PORQUE ES REAL.** Silenciar la música pasa de un toque
 * a dos. Se justifica así: el audio molesta en cualquier sector por igual, pero molesta
 * en momentos concretos, y en esos momentos el jugador está mirando el recolector, no
 * buscando ajustes.
 *
 * **Y NO HAY UNA HOJA POR COSA.** Una hoja con las tres cosas es lo que hace que
 * "Ajustes" signifique algo; tres hojas distintas obligan a saber cuál abrir.
 *
 * **EL BOTÓN NO LLEVA LA PALABRA "AJUSTES": LLEVA UN ENGRANAJE CON `aria-label`.** Un
 * engranaje con nombre accesible es el patrón que ya se reconoce, y ocupa 36 px en vez
 * de los 250 que ocupaban los tres controles. El nombre va en el `title` para el ratón
 * y en el `aria-label` para el lector de pantalla, que son los dos que lo necesitan.
 */
export function headerSettingsButton(): string {
  return `
    <button data-abrir-ajustes
            class="w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
            aria-label="Ajustes" title="Ajustes">
      <span class="[&>span>svg]:w-[18px] [&>span>svg]:h-[18px]">${ic('wrench')}</span>
    </button>`;
}

/**
 * LA HOJA. Va **FUERA del `<header>`**, y no por gusto.
 *
 * **ESTABA DENTRO Y ESO LA HACIA PEQUEÑA.** El velo es `fixed inset-0`, y un `fixed`
 * dentro de un ancestro con `backdrop-filter` deja de ser relativo a la ventana y pasa a
 * ser relativo a ese ancestro: la cabecera usa `card-glass`, o sea que tiene
 * `backdrop-filter`, y por eso **la hoja entera quedaba metida en la caja de la cabecera**.
 * Medido: el velo medía 78 px de alto en las pantallas y 80 en la base —la diferencia es
 * la identidad del jugador—, cuando la ventana tiene 898. Said así de verdad: la hoja no
 * tapaba la pantalla y solo se veían los 78 píxeles de arriba.
 *
 * Por eso, y porque salía distinta en cada pantalla, parecía que los ajustes solo
 * abrían desde un sitio. Devolver la hoja **justo después de `</header>`**, como hermana y
 * no como hija, la deja en el mismo nodo del `#app` en las siete pantallas **sin tocar
 * ninguna de las siete llamadas**: sigue siendo esta función la que la pinta.
 *
 * **`hidden` EN EL NODO, Y NO `lg:hidden`: EL MOTIVO ES EL CONTRARIO AL DE ANTES.** El
 * panel viejo era `lg:hidden` porque en escritorio había un `<select>` que hacía lo mismo
 * y en móvil el `select` no cabía. Ahora no hay `select`: la hoja es la **única** forma de
 * cambiar el tema, así que tiene que existir en todos los anchos.
 *
 * Y el nodo **no se desmonta al cerrar**: el botón le quita `hidden` y el de cerrar se la
 * vuelve a poner. Así los ids —`#music-btn`, `#mute-btn`— siguen siendo los mismos para
 * `paintAudioButtons()`, que los busca por id para repintarlos al cambiar el estado. Si la
 * hoja se desmontara, ese pintor no los encontraría y los interruptores se quedarían con
 * el icono de antes de apagarlos.
 *
 * ## Y CENTRADA EN TODOS LOS ANCHOS, NO ABAJO EN MÓVIL
 *
 * Estaba anclada abajo por el pulgar, que es un motivo de verdad, pero el resultado era un
 * modal que **no se leía como modal**: sin bordes alrededor y con el título pegado al
 * borde de la pantalla, parecía un mensaje que salía de golpe. Centrada tapa lo mismo,
 * tiene los cuatro lados y se lee como una ventana. El `max-height` y el margen de abajo
 * son para que con la pantalla de un móvil pequeño no se salga por arriba, y el
 * `safe-area` sigue estando.
 *
 * **Y LA ENTRADA ES `fadeIn`, NO `riseIn`, PORQUE `riseIn` ROMPÍA EL CENTRADO.** Acaba en
 * `transform: translateY(0)` y con `fill-mode: both` ese transform se queda para siempre,
 * declarado en la animación gana a la clase, así que se comía el `-translate-y-1/2` de
 * aquí. Medido: velo de 898 px y panel en `top=459` en vez de 257, o sea **centrado a la
 * mitad de abajo**, que no parece un fallo de posición sino un centrado medio desfasado.
 * Una animación con `both` sobre un elemento que se centra con un translate anula el
 * centrado. `fadeIn` solo mueve la opacidad y no compite con nada.
 */
export function settingsSheetHTML(): string {
  const tema = getSavedTheme();
  return `
    <div data-ajustes class="fixed inset-0 z-[80] hidden">
      <div class="absolute inset-0 bg-black/65 backdrop-blur-sm" data-cerrar-ajustes></div>
      <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(22rem,calc(100vw-2rem))]
                  max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain
                  card-glass-elevated rounded-2xl p-5 flex flex-col gap-4"
           style="margin-bottom: env(safe-area-inset-bottom);
                  animation: fadeIn 220ms cubic-bezier(0.16, 1, 0.3, 1) both">
        <div class="flex items-center justify-between">
          <h3 class="font-['Orbitron'] font-bold text-sm accent-text">Ajustes</h3>
          <button data-cerrar-ajustes
                  class="w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                  aria-label="Cerrar">
            <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('close')}</span>
          </button>
        </div>

        <!--
          AUDIO: los dos interruptores son independientes y cada uno lleva su PROPIO
          icono. Antes los dos pintaban el altavoz, así que eran dos botones idénticos y
          no se sabía cuál era cuál.

            música -> nota musical  (lo que pone, no lo que suena)
            SFX    -> altavoz       (icono de parlante)

          Apagado baja al icono de silencio y el texto lo dice, porque el estado se lee
          de un vistazo sin depender del title —que en táctil no aparece hasta mantener
          pulsado—.

          data-audio en vez de dos manejadores: uno solo por delegación cubre los dos. Los
          ids se quedan porque paintAudioButtons() los busca por id para repintarlos.
        -->
        <div class="grid grid-cols-2 gap-2">
          <button id="music-btn" data-audio="music"
            aria-pressed="${isMusicEnabled()}"
            aria-label="${isMusicEnabled() ? 'Apagar música' : 'Encender música'}"
            class="h-11 rounded-lg btn-ghost text-[11px] font-mono cursor-pointer
                   flex items-center justify-center gap-1.5 transition-colors
                   ${isMusicEnabled() ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] opacity-70'}">
            <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic(isMusicEnabled() ? 'music' : 'mute')}</span>
            <span>${isMusicEnabled() ? 'Música' : 'Música off'}</span>
          </button>

          <button id="mute-btn" data-audio="sfx"
            aria-pressed="${isSfxEnabled()}"
            aria-label="${isSfxEnabled() ? 'Silenciar efectos' : 'Activar efectos'}"
            class="h-11 rounded-lg btn-ghost text-[11px] font-mono cursor-pointer
                   flex items-center justify-center gap-1.5 transition-colors
                   ${isSfxEnabled() ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] opacity-70'}">
            <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic(isSfxEnabled() ? 'sound' : 'mute')}</span>
            <span>${isSfxEnabled() ? 'Efectos' : 'Efectos off'}</span>
          </button>
        </div>

                <!--
          SALTAR LA ANIMACIÓN DE LA RULETA, Y POR QUÉ ESTÁ AQUÍ Y NO EN EL PERFIL.

          Estaba en el Perfil, en una sección "Ajustes" propia, y era el único sitio
          del juego donde se podía cambiar. Tres razones para moverlo:

          · **El engranaje está en las siete pantallas y el Perfil es una.** Saltar la
            ruleta es lo que se hace siempre que se abren veinte cajas; pedir abrir el
            Perfil para ello es un viaje por cada ajuste.
          · **Un control dentro de algo que se puede saltar no se alcanza nunca** — esa
            razón siempre se tenía, pero iba en la dirección contraria: el Perfil es un
            sitio al que se va, y aquí el ajuste está donde ya estás.
          · **La sección del Perfil que lo contenía se queda sin nada que poner.** Un
            "Ajustes" con un solo control al final de una página de logros es ruido; el
            sitio de los ajustes es la hoja que se llama Ajustes.

          Y la casilla es un input real, no un botón: el estado lo lleva el navegador y
          la preferencia vive en el almacenamiento local, así que no hay que repintar
          nada al cambiarla. Se lee de la misma fuente al montar, y por eso sobrevive al
          re-render igual que sobrevive a la recarga.
        -->
        <label class="flex items-center gap-3 min-h-[44px] cursor-pointer select-none">
          <input type="checkbox" data-setting="skip-roulette"
                 class="w-5 h-5 flex-shrink-0 accent-[var(--accent)]"
                 ${getSkipRoulette() ? 'checked' : ''}
                 aria-describedby="skip-roulette-hint">
          <span class="min-w-0">
            <span class="block text-[12px] font-bold text-[var(--text-main)]">Saltar la ruleta</span>
            <span id="skip-roulette-hint" class="block text-[10px] font-mono text-[var(--text-muted)] mt-0.5 leading-relaxed">
              Va directo al cartel, en cajas, en el sintonizador y en la forja. El premio no cambia: ya estaba decidido.
            </span>
          </span>
        </label>
        <!--
          LAS NOTAS DE PARCHE, Y POR QUÉ ESTÁN EN ESTA HOJA Y NO EN EL PERFIL.

          Es la misma razón que el check de arriba, y está escrita aquí para que no haya
          que volver a preguntarlo: Ajustes es donde se cambian las cosas de la pantalla,
          y un jugador que no quiere un cartel al entrar no debería tener que entrar en el
          Perfil para callarlo. Además **esta casilla es reversible de verdad**: al
          desactivarla no se marca la versión como vista, así que si la vuelves a activar
          te aparecen las notas que te habías perdido. Un ajuste que se puede volver a
          poner **tiene** que devolver lo que apagó, o no es un ajuste: es una puerta de
          un solo sentido.
        -->
        <label class="flex items-center gap-3 min-h-[44px] cursor-pointer select-none">
          <input type="checkbox" data-setting="patch-notes"
                 class="w-5 h-5 flex-shrink-0 accent-[var(--accent)]"
                 ${getPatchNotes() ? 'checked' : ''}
                 aria-describedby="patch-notes-hint">
          <span class="min-w-0">
            <span class="block text-[12px] font-bold text-[var(--text-main)]">Notas de parche</span>
            <span id="patch-notes-hint" class="block text-[10px] font-mono text-[var(--text-muted)] mt-0.5 leading-relaxed">
              Un cartel al entrar con los cambios de la versión. No cambia nada del juego.
            </span>
          </span>
        </label>

        <div>
          <div class="label-caps mb-2">Tema visual</div>
          <div class="grid grid-cols-2 gap-2">
            ${(THEMES ?? []).map((th: any) => `
              <button data-theme-option="${th.value}"
                class="theme-option h-11 rounded-lg btn-ghost text-[11px] font-mono cursor-pointer
                       flex items-center justify-center gap-1.5 transition-colors"
                style="${th.value === tema ? 'border-color:' + th.tone + ';color:' + th.tone : ''}">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${th.tone}"></span>
                ${th.label}
              </button>`).join('')}
          </div>
        </div>

        <button data-logout
          class="h-11 rounded-lg btn-ghost text-[11px] font-mono cursor-pointer
                 flex items-center justify-center gap-1.5 transition-colors
                 border border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/20">
          <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('logout')}</span>
          Cerrar sesión
        </button>
      </div>
    </div>`;
}

/**
 * LA FRANJA DE ARRIBA DE LAS SIETE PANTALLAS.
 *
 * ## LA REGLA, Y POR QUÉ ESTÁ DICHA ASÍ DE ESTRICTA
 *
 * **El `flex-1` va en el grupo de la izquierda, y todo lo demás se ordena hacia la
 * derecha.** Por eso lo que hay a la derecha del nav no lo mueve: el nav queda a
 * `padding − (lo que haya detrás de él) − ancho del nav` del borde, y su ancho depende
 * solo de las etiquetas, que no cambian.
 *
 * **DETRÁS DEL NAV SOLO PUEDE IR ANCHO FIJO, Y ESO NO ES UNA CASUALIDAD: ES LA
 * CONDICIÓN.** El engranaje de ajustes va detrás y son 36 px constantes, así que el nav
 * se queda igual en las siete pantallas. Si detrás del nav se pusiera algo **de ancho
 * variable** —un contador, un nombre, una etiqueta— el nav se movería, y se movería
 * **solo en las pantallas que lo tuvieran**, que es el peor sitio posible para que se
 * note. Ese es el cambio que hay que revisar antes de añadir nada.
 *
 * Y lo que no se debe hacer es lo contrario: **quitarle el `flex-1` al grupo de la
 * izquierda** para "centrar" algo. El `flex-1` es el que empuja; sin él, el reparto del
 * hueco libre depende de lo que quede y el nav deja de estar clavado.
 *
 * **POR QUÉ EL HUD DE BUFFS DE ESCRITORIO VA EN EL GRUPO DE LA IZQUIERDA Y NO EN
 * `actions`.** Es una fila con desplazamiento, de ancho indeterminado, y detrás del nav
 * no puede ir. En `actions`, que es `flex-shrink-0`, no podría encogerse y aplastaría al
 * nav; en el grupo de la izquierda, que es `flex-1`, se encoge él y lo que se acorta es
 * el título. Entre estortar el título y mover el nav, el título es lo correcto.
 */
export function appHeaderHTML(opts: AppHeaderOptions): string {
  // **EL TÍTULO VACÍO ES "NO HAY TÍTULO", NO "UN TÍTULO EN BLANCO".** La base no tiene:
  // su ruta dice `title: ''` y lo que ocupa ese sitio es la identidad del jugador. Un
  // `<h1></h1>` vacío sería una estructura sin contenido —lo que un lector de pantalla
  // lee como un encabezado sin nombre—, así que no se pinta.
  const titulo = (opts.title ?? routeTitle(opts.route)).trim();

  return `
    <header class="relative z-20 card-glass flex-shrink-0 px-3 md:px-5 py-2.5 md:py-3
                    border-x-0 border-t-0 md:mx-4 md:mt-2 md:rounded-2xl md:border"
            style="padding-top: max(0.625rem, env(safe-area-inset-top))">
      <div class="flex items-center gap-2 md:gap-3 min-h-[3.5rem]">

        <div class="flex items-center gap-2 min-w-0 flex-1">
          ${opts.identityHTML ? `<div id="nav-identity" class="flex-shrink-0 hidden sm:flex items-center">${opts.identityHTML}</div>` : ''}

          <!--
            EL ICONO Y EL TÍTULO VAN A LA IZQUIERDA, EN EL MISMO SITIO QUE EL NOMBRE.

            La primera versión de esto los centró en el hueco que sobra, y se veía bien
            pero era un error de sitio. Ese hueco **no es un hueco**: es donde van los
            buffs, y los buffs son de ancho indeterminado —una fila que crece con cada
            carta activa y que se desplaza—. Si el título se centrara en el espacio
            restante, se movería cada vez que hubiera un buff distinto, que es la misma
            clase de fallo que ya se arregló con el nav: un elemento anclado a la
            derecha que se mueve según lo que haya al otro lado.

            Así que el título se ancla a la **izquierda**, que es una esquina fija, igual
            que el nombre en la base. Y por eso no hace falta un contenedor que agrupe
            icono y título: la base nunca tiene las dos cosas a la vez —su título está
            vacío a propósito y en su lugar está la identidad—, así que van sueltos, como
            estaban.

            Lo que sí se conserva del arreglo anterior es lo de las acciones, que es otra
            cosa y no se toca aquí.
          -->
          ${opts.icon ? `<span class="accent-text flex-shrink-0 hidden sm:block ${ICONO_DE_TITULO}">${ic(opts.icon)}</span>` : ''}
          ${titulo ? `
          <h1 id="page-title"
              class="font-['Orbitron'] font-bold text-[15px] md:text-lg accent-text truncate leading-tight min-w-0">
            ${titulo}
          </h1>` : ''}

          ${opts.buffsHudId ? `
            <!--
              LOS BUFFS NO MOUEVEN EL NAV, Y ESTO ESTÁ MEDIDO.

              La pregunta salió de verlos crecer y fearing que empujaran la fila, y la
              respuesta es que no pueden, por dos motivos que son independientes:

              · El nav es flex-shrink-0 y va **el segundo por la derecha**, con el botón
                de ajustes detrás. Todo lo de anchura variable está a su izquierda, así que
                la fila está anclada por la derecha y el nav no se mueve aunque lo de la
                izquierda crezca sin límite.
              · Y este contenedor es flex-grow, o sea que **se queda con el holgura que
                sobra** en vez de dársela a la fila. Medido en la base a 1440 y a 1280, con
                seis buffs, con ninguno y con catorce: el nav, la franja de saldos y el
                ancho de este contenedor dan **exactamente los mismos números** en los tres
                casos. Ni el nav ni los saldos se mueven.

              Y cuando los buffs no caben, overflow-x-auto los desplaza: el coste es que
              un buff se puede quedar fuera de vista, y se ha preferido eso a empujar la
              fila. Por debajo de 1280 los buffs pasan a su propia fila **debajo** de la
              cabecera, que ya no puede mover nada por construcción.

              **NO QUITAR EL flex-grow NI EL overflow-x-auto PARA "ARREGLAR" NADA:**
              sin el primero, los buffs empujan la franja de saldos; sin el segundo, un
              buff con un temporizador largo ensancha la cabecera y la descuadra. Los dos
              están aquí por lo que dice este párrafo.
            -->
            <div id="${opts.buffsHudId}"
                 class="hidden xl:flex items-center gap-1.5 flex-nowrap min-w-0 flex-grow overflow-x-auto py-0.5"></div>` : ''}
        </div>

        ${opts.resources !== false ? resourceBarHTML(opts.resources) : ''}

        <!--
          EL ENVOLTORIO DE LAS ACCIONES SE PINTA SIEMPRE, Y ESTO ES LO QUE ARREGLA EL
          DESPLAZAMIENTO QUE SE HA VISTO ENTRE LA BASE Y EL MERCADO.

          Antes solo se pintaba cuando había acciones, y lo medido fue: el grupo de la
          izquierda **352 px en la base y 364 en las seis páginas** —doce píxeles—, y la
          franja de saldos doce píxeles más a la derecha en unas que en otras. El nav no se
          movía: eso ya estaba bien. Lo que se movía era todo lo que hay entre el borde
          izquierdo y la franja.

          La causa era tan poco útil como un hueco: la fila lleva separaciones, y la base
          pintaba cinco hijos —con el envoltorio de acciones vacío pero presente, porque la
          base pasaba actions con un espacio en vez de no pasar nada— y las páginas cuatro.
          Cinco hijos son cuatro separaciones y cuatro son tres, y el flex-1 se queda con el
          hueco que sobra: una separación más son doce píxeles más de grupo de la izquierda.

          Con el envoltorio siempre presente las siete filas tienen cinco hijos, cuatro
          separaciones, y el grupo de la izquierda mide lo mismo por construcción y no por
          casualidad. **Un hueco vacío no es la diferencia entre dos cabeceras; solo lo era
          porque el hueco estaba antes que el que de verdad las distingue, y ese es el de
          las acciones reales.** Un envoltorio vacío con ancho cero no empuja nada.
        -->
        <div class="flex items-center gap-1.5 flex-shrink-0">${opts.actions ?? ''}</div>

        ${navDesktopHTML(opts.route)}

        ${headerSettingsButton()}
      </div>

      ${opts.mobileBuffsId ? `
        <div id="${opts.mobileBuffsId}"
             class="xl:hidden flex gap-1.5 overflow-x-auto mt-2 pb-0.5 empty:hidden -mx-1 px-1"></div>` : ''}

      </header>
    ${settingsSheetHTML()}`;
}