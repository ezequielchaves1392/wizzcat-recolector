// Arranca el bundle de pruebas con el mínimo de DOM que el game loop necesita.
// El game loop solo usa `document`/`window` para enganchar listeners de
// presencia y para preguntar si la pestaña está visible.
const listeners = () => ({ addEventListener() {}, removeEventListener() {} });

globalThis.__MEM_DB__ = {};

// El game loop pinta avisos con `showToast`, que hace `toast.classList.remove()`
// dentro de un `setTimeout`. Con el stub de antes, ese `classList` no existía y
// el temporizador reventaba con "Cannot read properties of undefined (reading
// 'remove')" DESPUÉS de que la tanda de pruebas ya hubiera terminado: el banco
// que se ejecutaba a continuación (moveCheck) moría sin imprimir una sola
// línea, y el proceso se acababa con "0 pruebas" sin decir por qué. Un stub que
// no cubre lo que el código toca no es un stub más pequeño: es un banco de
// pruebas que se apaga solo en cuanto hay un aviso que mostrar.
const elementoFalso = () => {
  const clases = new Set();
  return {
    className: '',
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
};

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

// `localStorage` QUE GUARDA, y no el `{getItem: () => null}` que había.
//
// La cola de nanitas pendientes vive aquí, y con un almacén que devuelve
// siempre `null` no se puede ni escribir ni comprobar nada: todas sus pruebas
// pasarían sin mirar la cola. Además lacked `removeItem`, que es justo lo que
// se llama cuando el servidor confirma, así que habría reventado con un
// "is not a function" en mitad del guardado bueno.
//
// `localStorage` QUE GUARDA, y no el `{getItem: () => null}` que había.
//
// La cola de nanitas pendientes vive aquí, y con un almacén que devuelve
// siempre `null` no se puede ni escribir ni comprobar nada: todas sus pruebas
// pasarían sin mirar la cola. Además le faltaba `removeItem`, que es justo lo
// que se llama cuando el servidor confirma, así que habría reventado con un
// "is not a function" en mitad del guardado bueno.
//
// Cada banco parte de este mapa vacío, y `queueCheck` lo sustituye por el suyo
// para poder inspeccionarlo.
globalThis.localStorage = {
  _datos: new Map(),
  getItem(k) { return this._datos.has(k) ? this._datos.get(k) : null; },
  setItem(k, v) { this._datos.set(k, v); },
  removeItem(k) { this._datos.delete(k); },
  clear() { this._datos.clear(); }
};
globalThis.performance ??= { now: () => Date.now() };

// El game loop arranca un `setInterval` de juego; en Node Keeps alive el proceso
// y el runner no termina nunca. Las pruebas no dependen del tick.
globalThis.setInterval = () => 0;

/**
 * POR QUÉ `process.exit()` ESTÁ AL FINAL Y NO EN `process.on('exit')`.
 *
 * `process.exit()` corta lo que hubiera pendiente de escribirse en stdout. Con
 * bancos que imprimen hundreds de líneas y un `console.error` de una excepción
 * justo antes del final, esas líneas se perdían: el banco se quedaba mudo y
 * parecía que no habia corrido. `process.on('exit', ...)` calling a su vez
 * `process.exit` hace lo mismo un instante antes de que Node vacíe los buffers.
 *
 * Dejar que Node termine solo, y devolver el código con `process.exitCode`, es
 * lo que garantiza que todo lo impreso llegue a pantalla.
 */
process.exitCode = 0;
process.on('unhandledRejection', (e) => { console.error('RECHAZO SIN CAPTURAR', e?.stack || e); process.exit(2); });
process.on('uncaughtException', (e) => { console.error('EXCEPCION', e?.stack || e); process.exit(3); });
// Cada módulo exporta la promesa de `main()`: hay que esperarla, o el proceso
// se cierra antes de que termine la tanda. Se recorren en orden y se acumulan
// los códigos de salida, para que un fallo en el segundo no enmascare al primero.
for (const banco of [
  'sellCheck',
  'equipCheck',
  'buyCheck',
  'filterCheck',
  'moveCheck',
  'stackCheck',
  'consumableCheck',
  'stateCheck',
  'gapCheck',
  'lootCheck',
  'queueCheck'
]) {
  console.log(`\n=== ${banco} ===`);
  try {
    const { default: pruebas } = await import(`./out/${banco}.js`);
    await pruebas;
  } catch (e) {
    // POR QUÉ ESTE TRY. `check()` no imprime: apila en `rows` y solo `resumen()`
    // saca el resultado. Un banco que revienta ANTES de su `resumen()` no
    // imprime absolutamente nada, y sin este `catch` el runner se limitaba a
    // seguir con el siguiente como si nada — que es como `queueCheck` lleva
    // tiempo "en construcción" sin que se supiera que estaba fallando en la
    // segunda prueba.
    //
    // Un banco que muere aquí no es un banco que pasa, y el proceso entero
    // tiene que salir con error aunque los demás banquen bien.
    console.error(`\n  !! ${banco} HA FALLADO POR EXCEPCION`);
    console.error('  ' + (e?.stack || e));
    process.exitCode = 1;
    break;
  }

  // Turno de espera antes de terminar.
  //
  // `flush()` y el intervalo de guardado lanzan `saveToFirebase()` sin await, así
  // que al acabar el banco sigue habiendo un guardado en vuelo. La limpieza de
  // la cola vive en `kit.ts` (`boot()` la borra), y ocurre al arrancar el banco
  // SIGUIENTE, no aquí: por eso este turno importa. Sin él, ese guardado en
  // vuelo escribe en la cola un instante después de que el banco siguiente ya
  // la hubiera limpiado, y hereda un saldo de hace dos segundos.
  await new Promise((r) => setTimeout(r, 0));
}
// Sin `process.exit()`: el código de salida ya está en `process.exitCode` y Node
// termina solo cuando no queda nada pendiente, que es cuando stdout está vacío.

