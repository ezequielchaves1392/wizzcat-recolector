// ==========================================================================
//  La mecánica de la ruleta: la ventana, las casillas y el giro.
//
//  POR QUÉ ESTE FICHERO NO HACE LA MATEMÁTICA DEL GIRO. `rouletteSpin.ts` la
//  tiene, y sin un solo import a propósito: son números puros y eso es lo que
//  permite comprobarlos sin navegador. Aquí solo queda lo que necesita DOM —
//  la ventana, las máscaras, el marcador y la transición CSS— y TODO el cálculo
//  de cuánto se desplaza la pista y cuándo suena cada chasquido sale de
//  `geometria()` y `crucesDeCasilla()`.
//
//  Eso es R2 aplicado a un caso que duele: la aritmética del giro es una regla
//  del juego, y con dos copias se separan en cuanto alguien cambia la curva en
//  una de ellas. El síntoma sería una ruleta que frena con una curva y suena
//  como si frenara con otra, que es exactamente lo que `rouletteSpin.ts`
//  escribió para impedir.
//
//  POR QUÉ NO VIVE DENTRO DE `crateRoulette.ts`. Porque ya no hay una ruleta
//  sola. La de las cajas y la del sintonizador pintan el mismo carril, con la
//  misma ventana y el mismo final, y copiar ese bloque es tener dos reglas del
//  giro que se separan en cuanto una cambia.
//
//  LO QUE ESTE MÓDULO NO HACE, y es lo importante: no sortea nada. Quien llama
//  ya tiene el resultado decidido y lo pone en la casilla `winIndex`. Una
//  ruleta que sortea sería una ruleta que miente sobre las probabilidades
//  reales, que es justo lo que hace buena a la de las cajas.
// ==========================================================================

import { sfx } from '../utils/audio';
import { ic, type IconName } from '../ui/icons';
import { rarityClass, RARITY_TEXT, type RouletteTile } from './crateLoot';
import { FRENADO, geometria, crucesDeCasilla, type Giro } from './rouletteSpin';

/** Ancho de casilla en escritorio y en móvil. */
const TILE_W = 96;
const TILE_W_MOBILE = 78;
/** Separación entre casillas. Tiene que ser la misma que la del `gap-2` del carril. */
const GAP = 8;

/**
 * Cuánto se queda quieta la cinta, ya parada, antes de que aparezca el cartel.
 *
 * POR QUÉ ESTA PAUSA Y POR QUÉ HERE. Sin ella el cartel salía en el mismo
 * fotograma en que la casilla ganadora se quedaba quieta bajo el marcador, y el
 * ojo no llegaba a tiempo de registrarla: el premio se leía como un cartel que
 * aparecía, no como una casilla que se paró encima. Aquí la regla que manda es
 * la de siempre: menos movimiento, NO menos confirmación. La pausa no forma
 * parte de la animación, forma parte de la confirmación.
 *
 * Y el premio ya está decidido cuando la cinta para: este hueco no estropea
 * nada, solo deja que el jugador lo vea.
 */
const PARADA_MS = 420;

/** La misma pausa cuando el sistema pide menos movimiento. Más corta, no ninguna. */
const PARADA_REDUCIDA_MS = 260;

/** El ancho con el que hay que pintar las casillas, según la ventana. */
export function tileWidth(): number {
  return window.innerWidth < 640 ? TILE_W_MOBILE : TILE_W;
}

/**
 * Clases de una casilla sin rareza.
 *
 * Para las ruletas que no son de botín. Una casilla de acierto o de fallo no
 * tiene rareza, y prestarle una ("Épico" sobre un FALLO) haría que el jugador
 * leyera una rareza donde no hay ningún premio. Con `tone` la casilla se
 * tiñe por desenlace, no por rareza: `good` para lo que se gana, `bad` para lo
 * que se pierde, con los mismos colores que usa el juego para el acierto y
 * para el error.
 */
const TONE_TEXT: Record<'good' | 'bad', string> = {
  good: 'text-cyan-300',
  bad: 'text-rose-400'
};
const TONE_BORDER: Record<'good' | 'bad', string> = {
  good: 'border-cyan-400/40',
  bad: 'border-rose-500/40'
};

function tileHtml(t: RouletteTile, width: number) {
  // `tone` sustituye a la rareza cuando está. La casilla del sintonizador no
  // es un premio: es un desenlace, y teñirla de "Legendario" en un fallo
  // enseñaría que fallar tiene categoría.
  const texto = t.tone ? TONE_TEXT[t.tone] : (RARITY_TEXT[t.rarity] || '');
  const borde = t.tone ? TONE_BORDER[t.tone] : rarityClass(t.rarity);
  return `
    <div class="flex-shrink-0 flex flex-col items-center justify-center gap-1 rounded-xl
                border ${borde} card-glass"
         style="width:${width}px;height:${width + 24}px">
      <span class="[&>span>svg]:w-6 [&>span>svg]:h-6 ${texto} leading-none">${ic(t.icon as IconName)}</span>
      <span class="text-[9px] font-mono text-center leading-tight px-1 line-clamp-2 w-full ${texto}">${t.label}</span>
      ${t.amount ? `<span class="text-[10px] font-mono font-bold leading-none ${texto}">${t.amount}</span>` : ''}
      <span class="text-[9px] font-mono uppercase tracking-wider ${texto} opacity-70">${t.sub}</span>
    </div>
  `;
}

/**
 * Cuántos píxeles le sobran a la casilla `winIndex` a la DERECHA de la aguja, en
 * el estado en que esté el carril AHORA MISMO.
 *
 * Positivo significa que hay que llevarla hacia la izquierda. Un solo hecho
 * medido, dos lecturas, y por eso hay un solo sitio donde se mide:
 *
 *   - Al montar, con el carril sin desplazar, este número ES el viaje entero:
 *     la casilla está tan a la derecha de la aguja como hay que moverla.
 *   - Al terminar, con el carril ya en su sitio, es el ERROR que queda, y se
 *     corrige restándolo: una casilla a la derecha se lleva la pista a la
 *     izquierda. Sumarlo la empuja en la dirección en la que ya se desviaba, y
 *     una corrección que empeora lo que corrige es peor que no corregir.
 *
 * POR QUÉ MEDIR Y NO CALCULAR. `geometria()` coloca la casilla con
 * `winIndex * pasoPx + casillaPx / 2`, y eso da por hecho que el carril no tiene
 * relleno por la izquierda. El carril tiene `px-1`: cuatro píxeles que nadie
 * escribió en la fórmula y que desplazan la casilla entera. Se podría meter el
 * relleno a mano en `rouletteSpin.ts`, y entonces el error pasa a ser el del
 * borde, o el de un `gap` que el navegador redondea a medio píxel, o el de un
 * ancho que cambia cuando aparece la barra de scroll del overlay. Medir en el
 * sitio y en el momento es lo único que no hay que volver a acertar.
 *
 * Se mide con `getBoundingClientRect()` y no con `offsetLeft` porque los dos
 * rectángulos tienen que estar en el mismo sistema de coordenadas, y el
 * `offsetParent` de una casilla no es el mismo nodo que el de la ventana.
 */
function desvioDelAguja(track: HTMLElement, winIndex: number): number {
  const ventana = track.parentElement;
  const casilla = track.children[winIndex] as HTMLElement | undefined;
  if (!ventana || !casilla) return 0;
  const rv = ventana.getBoundingClientRect();
  const rc = casilla.getBoundingClientRect();
  const aguja = rv.left + ventana.clientLeft + ventana.clientWidth / 2;
  return rc.left + rc.width / 2 - aguja;
}

/** Lo que hay que pintar, y por dónde tiene que ir la pista. */
export interface StripMount {
  /** El carril. Es lo que se desplaza. */
  track: HTMLElement;
  /** La geometría que se ha calculado: dónde para y cuánto viaja. */
  giro: Giro;
  /**
   * El ancho REAL de la ventana, medido.
   *
   * Viaja aparte de `giro` a propósito. `visibles` es el ancho DIVIDIDO por el
   * paso de casilla, con la parte decimal perdida, y `crucesDeCasilla()` lo
   * necesita en píxeles: reconstruirlo como `visibles * paso` desplaza la
   * ventana unos píxeles y con ella todos los chasquidos, que es justo lo que
   * este módulo existe para que cuadren.
   */
  anchoVentana: number;
}

/**
 * Monta la ventana de la ruleta y su carril, ya con la geometría resuelta.
 *
 * POR QUÉ SE MIDE ANTES DE PINTAR LAS CASILLAS Y NO DESPUÉS. El número de
 * casillas que hace falta depende de cuántas caben en la ventana visible
 * (`geometria()`), así que hay que medir la ventana antes de saber cuántas
 * casillas hay que pintar. La alternativa —pintar 26 fijas y esperar a
 * colocarlas— es lo que había, y es la razón de que en el móvil el trompo
 * fuera corto: 26 casillas son muchas para cuatro casillas de ventana.
 *
 * `pintar` recibe cuántas casillas hay que hacer y devuelve la lista. Se pasa
 * como función y no como lista ya hecha porque el número no se conoce hasta
 * aquí dentro, y porque la casilla que gana tiene que estar en `winIndex`: si
 * el llamante pintara la tira antes, tendría que adivinar el índice.
 *
 * Y por eso `pintar` recibe el `Giro` entero, no solo el `winIndex`: quien
 * decide dónde va la casilla ganadora (la ruleta de cajas la pone en
 * `winIndex`, y el resto la pone donde le parece) necesita saber cuántas
 * casillas hay antes de decidir.
 */
export function mountStrip(
  host: HTMLElement,
  pintar: (giro: Giro) => RouletteTile[],
  vueltas?: number
): StripMount {
  const casillaPx = tileWidth();
  const pasoPx = casillaPx + GAP;

  const ventana = document.createElement('div');
  ventana.className = 'relative w-full max-w-2xl select-none flex-shrink-0';
  // SIN BACKTICKS EN NINGÚN `<!-- -->` DE ESTE TEMPLATE. Un comentario HTML
  // vive dentro de la cadena, así que un `data-role` escrito con backticks
  // cierra el template en ese punto y el resto del HTML se lee como código:
  // cuatro errores de sintaxis y ni una pista de qué los ha causado. Por eso
  // aquí los identificadores van sin marcar, y el porqué vive FUERA, en este
  // comentario de TypeScript, donde los backticks sí son legal.
  ventana.innerHTML = `
    <div class="relative overflow-hidden rounded-2xl border py-4"
         style="border-color: var(--border-color); background: color-mix(in srgb, var(--bg-app) 70%, transparent)">
      <!-- POR QUÉ data-role Y NO id. Las dos ruletas se montan en el body
           y comparten selectores: con un id, la segunda que se abriera
           encontraría el carril de la primera. El estado de un nodo va en
           data-* (R8). -->
      <!-- Y POR QUÉ EL CARRIL NO TIENE px-1. Geometría (rouletteSpin.ts)
           coloca la casilla k en k * paso desde el borde IZQUIERDO de la
           pista, sin contar un relleno. Un px-1 la desplazaba 4 px, y como el
           desplazamiento se calcula sin él, la casilla ganadora se paraba 4 px
           a la derecha de la aguja. Lo que se ve es el peor fallo posible en
           una ruleta: el marcador sobre una casilla y el cartel anunciando
           otra. La corrección por medición de enderezar() lo tapaba solo si
           el signo era el correcto, así que el error pasaba por dos sitios.
           Lo que no está en la aritmética no se pone en la aritmética. -->
      <div data-role="track" class="flex gap-2 will-change-transform"></div>
      <!-- Máscara de degradados en los extremos -->
      <div class="pointer-events-none absolute inset-y-0 left-0 w-16" style="background: linear-gradient(to right, var(--bg-app), transparent)"></div>
      <div class="pointer-events-none absolute inset-y-0 right-0 w-16" style="background: linear-gradient(to left, var(--bg-app), transparent)"></div>
      <!-- Marcador central -->
      <div class="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px]" style="background: var(--accent); box-shadow: 0 0 14px var(--accent)"></div>
      <div class="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0" style="border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid var(--accent)"></div>
    </div>`;
  host.appendChild(ventana);

  // La ventana acaba de montarse, así que ya se puede medir de verdad. Medir
  // antes de insertarla daría 0, y `geometria()` con 0 daría cero casillas
  // visibles: la cinta no avanzaría.
  const ancho = ventana.querySelector('div') as HTMLElement;
  const giro = geometria({ ventanaPx: ancho.clientWidth, pasoPx, casillaPx, vueltas });

  const track = ventana.querySelector('[data-role="track"]') as HTMLElement;
  track.innerHTML = pintar(giro).map(t => tileHtml(t, casillaPx)).join('');

  // Y el viaje se SUSTITUYE por el medido. `geometria()` decide cuántas casillas
  // hacen falta y cuál es la ganadora, pero su `viaje` es una estimación: no
  // sabe del `px-1` del carril ni de un `gap` que el navegador redondea a medio
  // píxel. Con las casillas ya en el DOM, y con el carril sin desplazar, la
  // distancia entre la ganadora y la aguja ES el viaje que hay que hacer.
  //
  // Se sustituye y no se corrige a ojo porque este número no es un error: es el
  // viaje. Sumarlo al Estimated lo mandaría al doble de lejos, que es lo que
  // pasa si se confunde una cosa con la otra. Lo único que se queda es lo que
  // decide el ritmo —la cuenta de casillas y de vueltas—, porque eso no se mide:
  // se cuenta.
  const medido = Math.round(desvioDelAguja(track, giro.winIndex));
  const afinado = medido > 0 ? { ...giro, viaje: medido } : giro;

  return { track, giro: afinado, anchoVentana: ancho.clientWidth };
}

/**
 * Gira el carril y avisa cuando se para.
 *
 * TODO EL CÁLCULO ESTÁ EN `rouletteSpin.ts`. Aquí solo se traduce a una
 * transición CSS y se programan los chasquidos en los instantes que devuelve
 * `crucesDeCasilla()`. La curva es la misma en los dos sitios a propósito: si
 * el CSS frenara con una curva y los chasquidos salieran de otra, el sonido
 * describiría un movimiento que no es el que se ve.
 *
 * POR QUÉ CSS Y NO `requestAnimationFrame`. El navegador no ejecuta rAF en una
 * pestaña oculta: la ruleta se quedaría clavada en la primera casilla y, al
 * volver, el salto sería instantáneo. Con una transición CSS el tiempo pasa
 * igual y el navegador decide el final.
 *
 * Y por qué hay un `setTimeout` de respaldo aunque se escuche
 * `transitionend`: hay navegadores y ajustes del sistema donde ese evento no
 * llega. Sin el respaldo el premio se quedaba sin revelar y el jugador tenía
 * un overlay que no se iba nunca.
 */
export function spinTrack(mount: StripMount, durationMs: number, onDone: () => void) {
  const { track, giro, anchoVentana } = mount;

  // R20: con `prefers-reduced-motion` el carril no se desliza, pero el resultado
  // se enseña igual. Menos movimiento, no menos confirmación: quitar el giro no
  // puede significar quitar el veredicto.
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const duracion = reduced ? 0 : durationMs;

  // El zumbido del motor va PRIMERO, antes de programar los chasquidos: es lo
  // que el jugador oye en el instante de arrancar, y si se emitiera después el
  // primer chasquido se le solaparía encima.
  sfx.spinStart();

  // `viaje` viene en positivo; quien mueve la pista le pone el signo. La curva
  // se escribe desde la constante `FRENADO`, la misma que usa `instante()` para
  // los chasquidos, y no desde un literal repetido aquí: dos copias del
  // `cubic-bezier` acaban frenando distinto la una de la otra, y entonces el
  // sonido describe un movimiento que no es el que se ve.
  track.style.transition = reduced ? 'none' : `transform ${duracion}ms cubic-bezier(${FRENADO.join(', ')})`;
  track.style.transform = `translate3d(${-giro.viaje}px,0,0)`;

  // Chasquidos: uno por frontera de casilla que pasa por el marcador, y en el
  // instante que dice la curva. Sin movimiento no hay nada que chasquear.
  //
  // Y el `progress` NO es opcional. `sfx.tick()` sin argumento suena siempre
  // igual, así que el último tramo, donde la cinta apenas se mueve, suena igual
  // de fuerte que el primero, donde vuela: un metrónomo que se para de golpe en
  // lugar de frenarse. Con el progreso el tono baja y el volumen se atenúa justo
  // cuando la ruleta se para, que es de donde sale la sensación de "se está
  // parando" y no la de "se ha parado".
  if (!reduced) {
    for (const ms of crucesDeCasilla({
      viajePx: giro.viaje,
      pasoPx: tileWidth() + GAP,
      ventanaPx: anchoVentana,
      duracionMs: duracion
    })) {
      setTimeout(() => sfx.tick(ms / duracion), ms);
    }
  }

  const finished = { value: false };

  /**
   * Deja la casilla ganadora clavada en la aguja, midiendo lo que quedó.
   *
   * POR QUÉ ESTA PASADA Y NO SOLO EL AFINADO DEL MONTAJE. Al montar se afina el
   * `viaje` midiendo, pero el ancho puede cambiar DESPUÉS: el overlay lleva
   * `overflow-y-auto`, así que al añadir el cartel del premio el contenido crece,
   * aparece la barra de scroll y la ventana se estrecha unos píxeles. Con la
   * ventana más estrecha la aguja se mueve y el destino se queda viejo.
   *
   * Y lo que se ve si eso pasa es lo peor que puede pasar aquí: el marcador
   * sobre una casilla y el cartel anunciando otra. La ruleta no puede enseñar
   * un premio que no es el que la aguja señala. La Forja ya hacía esta
   * comprobación con dos pasadas (`forgePage.ts`); aquí es la misma idea.
   *
   * Solo se mueve si la diferencia es de un píxel o más: en el caso normal no
   * toca la transición y el trompo para exactamente donde tenía que parar.
   */
  function enderezar() {
    const desvio = desvioDelAguja(track, giro.winIndex);
    if (Math.abs(desvio) < 1) return;
    track.style.transition = 'transform 200ms cubic-bezier(0.33, 0, 0.2, 1)';
    track.style.transform = `translate3d(${-giro.viaje - desvio}px,0,0)`;
  }

  /** El premio se anuncia: primero la casilla se ilumina, y solo entonces el cartel. */
  function revelar() {
    const winEl = track.children[giro.winIndex] as HTMLElement | undefined;
    if (winEl) {
      winEl.classList.add('scale-110', 'z-10');
      winEl.style.transition = 'transform 220ms ease-out, box-shadow 220ms';
      winEl.style.boxShadow = '0 0 28px var(--accent)';
    }
    onDone();
  }

  function finish() {
    if (finished.value) return;
    finished.value = true;
    track.removeEventListener('transitionend', onEnd);
    // La transición se anula antes de corregir. Si no, al aplicar el
    // desplazamiento de la corrección el navegador emitiría un `transitionend`
    // más, y ese evento no es el final del trompo: es la corrección. Los dos
    // caminos de entrada (el evento y el reloj de respaldo) entran por aquí, y
    // por eso la guarda va antes de tocar nada.
    track.style.transition = 'none';
    // Y hay que ASENTAR la posición final ANTES de medir. Sin esto, el
    // navegador todavía no ha aplicado el `translate3d` cuando se mide: el
    // `getBoundingClientRect` devuelve la casilla donde estaba antes de girar,
    // `delta` sale del tamaño del viaje entero, y la corrección se lo lleva al
    // doble de lejos. Pasaba en el camino de `prefers-reduced-motion`, donde no
    // hay transición que sincronizar y la lectura sale entera.
    //
    // La alternativa descartada es medir en el siguiente `requestAnimationFrame`.
    // Funciona, pero `rAF` no corre en una pestaña oculta, que es justo donde el
    // respaldo del reloj es el único camino que queda. Leer el `layout` a
    // propósito fuerza el mismo reflow sin esa dependencia, y es lo que hace la
    // Forja con su segunda pasada.
    void track.offsetWidth;
    enderezar();
    // Y la pausa. La cinta se queda quieta bajo la aguja antes de que salga el
    // cartel, para que el ojo llegue a registrarla. Sin esto el premio se
    // leía como un cartel que aparecía, no como una casilla que se paró.
    //
    // Con menos movimiento no hay nada que asentar: la cinta ya estaba en su
    // sitio desde el principio, porque sin transición no hay a medio camino.
    if (reduced) revelar();
    else setTimeout(revelar, PARADA_MS);
  }
  function onEnd(e: Event) {
    if ((e as TransitionEvent).propertyName !== 'transform') return;
    finish();
  }
  track.addEventListener('transitionend', onEnd);
  // El respaldo del reloj. Sin él, un navegador o un ajuste del sistema donde
  // `transitionend` no llega dejaría el premio sin revelar y con un overlay que
  // no se iba nunca. Sin movimiento el reloj es el ÚNICO camino, y por eso es
  // la pausa corta y no el final del trompo más un margen.
  setTimeout(finish, reduced ? PARADA_REDUCIDA_MS : duracion + 350);
}
