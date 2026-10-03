// ==========================================================================
//  El entorno mínimo que necesita el game loop para correr en Node
//
//  POR QUÉ ESTE FICHERO EXISTE Y NO ESTÁ DENTRO DE `run.mjs`.
//
//  `run.mjs` y `one.mjs` montaban cada uno su propio DOM y su propio
//  `localStorage`, y no tenían por qué parecerse: nadie los comparaba. Se
//  separaron, y la separación costó caro de una forma que no se ve:
//
//  · `one.mjs` no daba `querySelector` a `document`, así que la guarda de
//    `marcarPendiente()` pasaba y la llamada reventaba DENTRO del `catch` que
//    informa de fallos de red. Cuatro bancos no se podían ejecutar en solitario y
//    el primer aviso señalaba a Firebase de un error de DOM.
//  · `one.mjs` tampoco daba `classList` a `createElement`, y `showToast` hace
//    `toast.classList.remove(...)` dentro de un `setTimeout`. El fallo salía
//    asíncrono, 10 ms después de cualquier aviso, y tumbaba el proceso entero
//    con un error que no señalaba a ningún sitio.
//  · `one.mjs` tenía un `localStorage` que devolvía `null` siempre y sin
//    `removeItem`, o sea que no guardaba nada: la cola de nanitas no se podía ni
//    escribir ni comprobar.
//
//  Tres bancos de los once fallaban en solitario y el cuarto no imprimía nada.
//  Ninguno de los tres fallos señalaba a su causa real.
//
//  La regla del proyecto es que "un stub que no cubre lo que el código toca no es
//  un stub más pequeño, es un banco que se apaga solo". Estos dos ficheros eran
//  dos fuentes de verdad para lo mismo. Ahora hay una, y `run.mjs` y `one.mjs` la
//  comparten, así que un banco que funciona con el runner funciona también
//  depurándolo en solitario — que es justo para lo que sirve `one.mjs`.
// ==========================================================================

const listeners = () => ({ addEventListener() {}, removeEventListener() {} });

/**
 * Busca por `id` en el árbol ya construido, y solo para selectores de id.
 *
 * Lo único que devuelve algo es lo que el propio código acaba de crear con
 * `appendChild`: `#toast-stack` en `body`, por ejemplo. Un selector de clase o
 * de etiqueta sigue dando `null`, porque decidir eso en Node significaría
 * inventarse un DOM entero.
 */
function porId(raiz, sel) {
  if (!raiz || typeof sel !== 'string' || !sel.startsWith('#')) return null;
  const id = sel.slice(1);
  const apilado = [raiz];
  while (apilado.length) {
    const nodo = apilado.shift();
    if (nodo.id === id) return nodo;
    if (Array.isArray(nodo.children)) apilado.push(...nodo.children);
  }
  return null;
}

/**
 * Un `localStorage` QUE GUARDA.
 *
 * Con un `{ getItem: () => null }` la cola de nanitas no se puede ni escribir
 * ni comprobar, y todas sus pruebas pasarían sin mirar la cola. `removeItem` no
 * es opcional: es lo que llama `vaciarCola()` cuando el servidor confirma, y sin
 * él reventaba con un "is not a function" en mitad del guardado bueno.
 */
export function crearAlmacenLocal() {
  const datos = new Map();
  return {
    _datos: datos,
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => { datos.set(k, String(v)); },
    removeItem: (k) => { datos.delete(k); },
    clear: () => datos.clear()
  };
}

/**
 * Un elemento que se parece lo bastante a uno como para que el código no se
 * entere de que no hay navegador.
 *
 * `classList` no es decorativo: `showToast` hace
 * `toast.classList.remove('translate-x-full')` y `toast.classList.add(...)` dentro
 * de `setTimeout`, así que sin él el fallo es asíncrono y aparece en el sitio
 * equivocado.
 *
 * `querySelector` devuelve `null` y `querySelectorAll` devuelve `[]`, que es lo
 * correcto: en Node no existe ningún nodo, y el juego tiene que saber seguir sin
 * él en lugar de recibir un elemento de mentira.
 */
export function elementoFalso() {
  const clases = new Set();
  const el = {
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: {},
    attributes: {},
    children: [],
    parentElement: null,
    classList: {
      add: (...c) => c.forEach(x => clases.add(x)),
      remove: (...c) => c.forEach(x => clases.delete(x)),
      toggle: (c, on) => (on ? clases.add(c) : clases.delete(c)),
      contains: (c) => clases.has(c)
    },
    setAttribute(k, v) { el.attributes[k] = String(v); },
    getAttribute(k) { return k in el.attributes ? el.attributes[k] : null; },
    hasAttribute(k) { return k in el.attributes; },
    removeAttribute(k) { delete el.attributes[k]; },
    appendChild(hijo) {
      el.children.push(hijo);
      if (hijo) hijo.parentElement = el;
      return hijo;
    },
    removeChild(hijo) {
      el.children = el.children.filter(x => x !== hijo);
      if (hijo) hijo.parentElement = null;
      return hijo;
    },
    remove() { el.parentElement?.removeChild(el); },
    get firstChild() { return el.children[0] ?? null; },
    get firstElementChild() { return el.children[0] ?? null; },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {}
  };
  return el;
}

/**
 * Instala `document`, `window`, `performance` y anula `setInterval`.
 *
 * El `setInterval` se anula porque el game loop arranca su tick y en Node eso
 * mantiene el proceso vivo para siempre: el runner no terminaría nunca. Las
 * pruebas no dependen del tick.
 *
 * `setTimeout` NO se anula a propósito: los avisos lo usan, y si el reloj no
 * corriera, un `setTimeout` que reventara pasaría desapercibido. Es
 * precisamente un `setTimeout` el que ha destapado el `classList` que faltaba.
 *
 * `__DOM__`: LA CABECERA DE LA PRUEBA.
 *
 * `showToast` coloca la pila de avisos leyendo el borde inferior del `<header>`
 * de verdad, porque su alto no es fijo. Sin cabecera, `document.querySelector`
 * devuelve `null` y el aviso se queda en el margen por defecto: ese camino es el
 * de los bancos, y hay que poder mirarlo también.
 *
 * Así que un banco publica el nodo que quiera en `__DOM__['header']` y lo
 * quita al terminar. Es el mismo truco que `__MEM_DB__` con Firestore: el
 * entorno es el que sabe imitar al navegador, no cada banco por su cuenta. Por
 * eso `querySelector` NO devuelve cualquier cosa: devuelve lo publicado, y `null`
 * para todo lo demás, que es la respuesta correcta en Node.
 */
export function instalarEntorno() {
  globalThis.__DOM__ = {};
  globalThis.document = {
    visibilityState: 'visible',
    hasFocus: () => true,
    addEventListener() {},
    removeEventListener() {},
    createElement: () => elementoFalso(),
    // Por `__DOM__` primero, y luego por `id` en el árbol que el código ya ha
    // construido. Lo segundo no es adivinar: `#toast-stack` lo pone `toast.ts`
    // sobre `body`, así que un banco puede mirar el contenedor de verdad por su
    // id sin que el entorno sepa nada de avisos.
    querySelector: (sel) => globalThis.__DOM__?.[sel] ?? porId(globalThis.document.body, sel),
    querySelectorAll: () => [],
    body: elementoFalso()
  };
  globalThis.window = { ...listeners() };
  globalThis.performance ??= { now: () => Date.now() };
  globalThis.setInterval = () => 0;

  /**
   * Los temporizadores largos, apuntados para poder cancelarlos ENTRE BANCOS.
   *
   * `createGameLoop()` programa un `setTimeout(saveToFirebase, 1200)` al arrancar
   * cuando cree que hay cola heredada. En el juego está bien. En un banco es una
   * bomba **entre bancos**, porque todos comparten proceso: el temporizador del
   * banco N cae dentro del N+1, y su `saveToFirebase()` escribe en `__MEM_DB__` con
   * el estado de una partida que ya no existe. Lo que se rompe es siempre una
   * comprobación de "el inventario viene bien" o "el saldo sobrevive", y siempre
   * de forma intermitente — que es lo peor que puede hacer una prueba, porque
   * entrena a ignorar el banco entero.
   *
   * **SE CANCELA ENTRE BANCOS Y NO DENTRO.** Cancelarlos dentro de `boot()` se
   * probó y rompió `toastCheck`: el desvanecido de un aviso también dura segundos,
   * y se quedaba en pantalla para siempre, así que las pruebas de la pila
   * contaban avisos de un banco anterior. Entre bancos no hay nada que mirar, y sin
   * embargo cancela justo lo que sobra.
   */
  const relojOriginal = globalThis.setTimeout;
  const relojesColision = new Set();
  // **UNA BANDA, Y LOS DOS NÚMEROS QUE LA DEFINEN.** Abajo de 1000 ms no hay nada
  // que cancelar (la transición de un aviso dura 300), y entre 1000 y 2000 solo vive
  // el guardado diferido del arranque, que son 1200 ms. Un aviso se retira a los
  // 3000 —muy por encima de la banda—, así que sobrevive y `toastCheck` puede
  // esperar a que la pila se vacíe sola, que es lo que lleva haciendo.
  //
  // La banda es fea y por eso está escrita con los dos números al lado. **Si algún
  // día `VIDA_MS` de `src/utils/toast.ts` baja de 2000, `toastCheck` falla ruido**,
  // y eso es justo lo que tiene que pasar: es mejor un banco rojo que un banco que
  // mida los avisos de otro.
  const DESDE_MS = 1000;
  const HASTA_MS = 2000;
  globalThis.setTimeout = (fn, ms, ...args) => {
    const id = relojOriginal(fn, ms, ...args);
    if (typeof ms === 'number' && ms >= DESDE_MS && ms < HASTA_MS) relojesColision.add(id);
    return id;
  };

  globalThis.cancelarRelojesColision = () => {
    for (const id of relojesColision) clearTimeout(id);
    relojesColision.clear();
  };
}

/**
 * Los manejadores de fallo del proceso, y el código de salida.
 *
 * Sin ellos, una promesa sin capturar en un banco deja el proceso con código 0 y
 * el banco mudo, que es la forma más cara de perder una señal.
 *
 * POR QUÉ `process.exit()` ESTÁ DENTRO Y NO EN `process.on('exit')`.
 * `process.exit()` corta lo que hubiera pendiente de escribirse en stdout. Con
 * bancos que imprimen cientos de líneas y un `console.error` de una excepción
 * justo antes del final, esas líneas se perdían: el banco se quedaba mudo y
 * parecía que no había corrido. `process.on('exit', ...)` llamando a su vez
 * `process.exit` hace lo mismo un instante antes de que Node vacíe los buffers.
 *
 * Dejar que Node termine solo, y devolver el código con `process.exitCode`, es lo
 * que garantiza que todo lo impreso llegue a pantalla.
 */
export function instalarProceso() {
  globalThis.localStorage = crearAlmacenLocal();
  process.exitCode = 0;
  process.on('unhandledRejection', (e) => {
    console.error('RECHAZO SIN CAPTURAR', e?.stack || e);
    process.exit(2);
  });
  process.on('uncaughtException', (e) => {
    console.error('EXCEPCION', e?.stack || e);
    process.exit(3);
  });
}