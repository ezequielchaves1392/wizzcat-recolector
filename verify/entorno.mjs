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
  return {
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: {},
    classList: {
      add: (...c) => c.forEach(x => clases.add(x)),
      remove: (...c) => c.forEach(x => clases.delete(x)),
      toggle: (c, on) => (on ? clases.add(c) : clases.delete(c)),
      contains: (c) => clases.has(c)
    },
    setAttribute() {},
    removeAttribute() {},
    appendChild() {},
    remove() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {}
  };
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
 */
export function instalarEntorno() {
  globalThis.document = {
    visibilityState: 'visible',
    hasFocus: () => true,
    addEventListener() {},
    removeEventListener() {},
    createElement: () => elementoFalso(),
    querySelector: () => null,
    querySelectorAll: () => [],
    body: { appendChild() {} }
  };
  globalThis.window = { ...listeners() };
  globalThis.performance ??= { now: () => Date.now() };
  globalThis.setInterval = () => 0;
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