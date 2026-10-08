// Arranca el bundle de pruebas con el mínimo de DOM que el game loop necesita.
//
// El entorno (DOM, `localStorage` que guarda, `performance`, `setInterval` anulado
// y los manejadores de fallo del proceso) vive en `entorno.mjs`, COMPARTIDO con
// `one.mjs`. Estaba duplicado aquí y allí, y las dos copias se separaron: a `one.mjs`
// le faltaba `querySelector` y le faltaba `classList`, con lo que cuatro bancos no
// se podían depurar en solitario y uno no imprimía nada, siempre con un error que
// no señalaba a su causa real. Un banco que funciona con este runner tiene que
// funcionar también con el otro, y eso solo se garantiza si hay una definición.
import { instalarEntorno, instalarProceso } from './entorno.mjs';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `aqui`, **a nivel de módulo y no dentro del bloque que hace las comprobaciones de disco.**
 *
 * Declarado dentro, el bloque de B31 lo necesita y **no lo ve**: da `ReferenceError: aqui
 * is not defined` antes de imprimir nada. Es un detalle de alcance —no de lógica— y por eso
 * está aquí y con un comentario, porque el error que produce **no señala dónde está el
 * problema**: dice que una variable no existe, no que está declarado en el sitio equivocado.
 */
const aqui = dirname(fileURLToPath(import.meta.url));

globalThis.__MEM_DB__ = {};
instalarEntorno();
instalarProceso();

// Cada módulo exporta la promesa de `main()`: hay que esperarla, o el proceso
// se cierra antes de que termine la tanda. Se recorren en orden y se acumulan
// los códigos de salida, para que un fallo en el segundo no enmascare al primero.
//
// **ESTÁ EN UNA CONSTANTE Y NO EN EL `for` PORQUE ALGO TIENE QUE PODER LEERLA.** La
// comprobación de "ningún banco se queda en el disco sin ejecutarse" compara esta lista
// con el directorio, y para eso hace falta el array. Con la lista dentro del `for` el
// comprueba-bancos no podría verla.
const BANCOS = [
  'sellCheck',
  'equipCheck',
  'buyCheck',
  'filterCheck',
  'stackCheck',
  'potencialCheck',
  'brilloCheck',
  'companionCheck',
  'loteCheck',
  'consumableCheck',
  'stateCheck',
  'lootCheck',
  'queueCheck',
  'guardadoCheck',
  'cargaIncompletaCheck',
  'cuotaCheck',
  'costeJuegoCheck',
  'costeRealCheck',
  'cerrojoCheck',
  'forjaCheck',
  'sessionCheck',
  'perfilCheck',
  'playthroughCheck',
  'toastCheck',
  'tickCheck',
  'senalCheck',
  'balanceCheck',
  'desgloseCheck',
  'cajasCheck',
  'ranuraCheck',
  'tarjetaCheck',
  'saltoCheck',
  'identidadCheck',
  'loreCheck',
  'autoventaCheck',
  'arbolLoreCheck',
  'leyendaCheck',
  'contadorCheck'
];

// ==========================================================================
//  NINGÚN BANCO SE QUEDA FUERA DE LA LISTA, Y POR QUÉ ESTA COMPROBACIÓN
//  ESTÁ AQUÍ Y NO EN UN BANCO.
// ==========================================================================
//
// **ESTA LISTA ES MANUAL, Y ESA ES LA TRAMPA.** Alguien escribe un banco nuevo,
// `npm run verify` **no lo ejecuta**, sale todo en verde y nadie se entera: el banco
//  parece estar porque existe, y no está porque nadie lo escribió en la lista. Un banco
//  que no se ejecuta **no es un banco que pasa**, pero se comporta como si lo fuera, que
//  es peor que no tenerlo.
//
//  **Y NO ERA SOLO LA LISTA: TAMBIÉN LA DE VITE.** El banco tiene que estar en `BANCOS` (el
//  runner) **y** en `vite.config.ts` (el bundle). El primero se olvidó al añadir
//  `cuotaCheck` y `costeJuegoCheck`, y el segundo también: el `import` falló con
//  `Cannot find module` **a mitad de la suite**, después de quince bancos que ya habían
//  pasado. Es el peor sitio posible para enterarse.
//
//  **SE COMPRUEBA ANTES DE EMPEZAR, CONTRA EL DISCO Y CONTRA EL BUNDLE.** Contra el disco
//  para que un banco nuevo sea un fallo de la suite y no un olvido, y contra el bundle
//  para que el fallo sea **este mensaje** y no un `Cannot find module` a mitad. La segunda
//  lista sería el mismo fallo con dos sitios donde equivocarse, así que **las dos
//  comprobaciones leen lo que hay de verdad**: el directorio de fuentes y el de salidas.
{
  const { readdirSync, existsSync } = await import('node:fs');

  const listado = new Set(BANCOS);
  const sinEjecutar = readdirSync(aqui)
    .filter((f) => f.endsWith('Check.ts'))
    .map((f) => f.replace(/\.ts$/, ''))
    .filter((b) => !listado.has(b));
  if (sinEjecutar.length) {
    console.error('  !! BANCOS QUE NO SE EJECUTAN: ' + sinEjecutar.join(', '));
    console.error('     Añádelos a BANCOS en run.mjs y a `entry` en vite.config.ts.');
    process.exitCode = 1;
  }

  const sinEmpaquetar = BANCOS.filter((b) => !existsSync(resolve(aqui, 'out', `${b}.js`)));
  if (sinEmpaquetar.length) {
    console.error('  !! BANCOS QUE NO ESTÁN EN EL BUNDLE: ' + sinEmpaquetar.join(', '));
    console.error('     Añádelos a `entry` en vite.config.ts.');
    process.exitCode = 1;
  }
}

// ==========================================================================
//  B31 · EL EMULADOR NO PUEDE SALIR DE DESARROLLO.
// ==========================================================================
//
//  **POR QUÉ ESTÁ AQUÍ Y NO EN UN BANCO, Y ES LO CONTRARIO DE LO QUE PARECE.** Un banco
//  se empaqueta con Vite para poder sustituirle Firebase, y **Vite compila el banco sin
//  saber que lo ejecuta `node`**: resuelve `node:fs`, `node:path` y `node:url` como si
//  fueran módulos de navegador, y entonces `readFileSync` y `fileURLToPath` llegan vacíos.
//  Se probaron cuatro caminos —import estático, import dinámico, `import.meta.dirname` y
//  marcar los builtins como externos en la config— y **los cuatro fallaron**. Un quinto
//  intento habría sido persistence sin entender el motivo.
//
//  **ESTE FICHERO NO PASA POR VITE.** `run.mjs` lo ejecuta `node` directamente, así que
//  sus imports de `node:fs` son de verdad y funcionan. **Por eso la comprobación va aquí.**
//
//  **LO QUE PROTEGE, Y ES MÁS GRAVE QUE UN ERROR NORMAL.** Conectar el emulador mal no es
//  "que no funcione el desarrollo": es **que la partida de todos acabe en el cubo de la
//  máquina de quien compiló**. El juego apuntaría a `127.0.0.1`, que para un jugador es
//  nada, y **nadie lo vería nunca**, porque el que lo subió lo probó en su máquina.
//
//  **Y LA COMPROBACIÓN ES SOBRE `dist/`, NO SOBRE EL CÓDIGO, PORQUE LA PROTECCIÓN ES INVISIBLE
//  LEYENDO LA FUENTE.** El `if` con `import.meta.env.DEV` **desaparece del bundle entero**
//  al compilar en producción, porque `DEV` es `false` y el bloque es código muerto. Esa
//  eliminación **es** la protección. Así que leer `firebase.ts` y ver la condición **no
//  demuestra nada**: hay que mirar lo que sale.
{
  const { readdirSync, readFileSync, existsSync } = await import('node:fs');
  const raiz = aqui + '/..';

  const fuente = readFileSync(raiz + '/src/firebase.ts', 'utf8');
  const conDevYVariable = /import\.meta\.env\.DEV\s*&&\s*import\.meta\.env\.VITE_EMULADOR/.test(fuente);
  const conLosDos = /connectFirestoreEmulator/.test(fuente) && /connectAuthEmulator/.test(fuente);

  // **EL BUNDLE. `dist/assets/*.js`, que es lo que se desplegaría.**
  let js = '';
  if (existsSync(raiz + '/dist/assets')) {
    js = readdirSync(raiz + '/dist/assets')
      .filter((f) => f.endsWith('.js'))
      .map((f) => readFileSync(raiz + '/dist/assets/' + f, 'utf8'))
      .join('\n');
  }
  const emuladorEnBundle = js.includes('Emulador conectado');

  // `pkg` y `firebase.json`, que es lo que decide si alguien puede arrancar el emulador.
  const pkg = JSON.parse(readFileSync(raiz + '/package.json', 'utf8'));
  const firebaseJson = JSON.parse(readFileSync(raiz + '/firebase.json', 'utf8'));
  const hayScript = typeof pkg.scripts?.['dev:emulador'] === 'string';
  const authDeclarado = firebaseJson.emulators?.auth?.port === 9099;

  const fallos = [];
  if (!conDevYVariable) fallos.push('el emulador no exige DEV Y VITE_EMULADOR a la vez');
  if (!conLosDos) fallos.push('Firestore y Auth no se conectan en el mismo sitio');
  if (emuladorEnBundle) fallos.push('*** EL BUNDLE DE PRODUCCION LLEVA EL EMULADOR ***');
  if (js && js.includes('127.0.0.1:8080')) fallos.push('el puerto del emulador esta en el bundle');
  if (!hayScript) fallos.push('no hay script dev:emulador');
  if (!authDeclarado) fallos.push('el emulador de Auth no esta declarado en firebase.json');

  if (fallos.length) {
    console.error('  !! B31 · EMULADOR: ' + fallos.join(' | '));
    process.exitCode = 1;
  } else {
    console.log('  B31 emulador: la condicion es DEV && variable, los dos emuladores van juntos,');
    console.log('               y dist/ no lleva nada de esto.');
  }
}

for (const banco of BANCOS) {
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

  // **Y SE CANCELAN LOS TEMPORIZADORES DE LA BANDA DEL GUARDADO DIFERIDO.** Este es
  // el sitio correcto y el único: entre bancos no hay nada que mirar, y el
  // `setTimeout(saveToFirebase, 1200)` del banco anterior se quedaría colgado
  // hasta un segundo después de que empiece el siguiente, escribiendo en
  // `__MEM_DB__` con el estado de una partida que ya no existe. Ha roto
  // comprobaciones de "el inventario viene bien" y "el saldo sobrevive", y
  // siempre de forma intermitente, que es lo peor que puede hacer una prueba.
  //
  // Cancelar TODO lo largo se probó y rompió `toastCheck`: un aviso vive 3000 ms
  // y se quedaba en pantalla para siempre. La banda está en `entorno.mjs`.
  globalThis.cancelarRelojesColision?.();
}
// Sin `process.exit()`: el código de salida ya está en `process.exitCode` y Node
// termina solo cuando no queda nada pendiente, que es cuando stdout está vacío.

