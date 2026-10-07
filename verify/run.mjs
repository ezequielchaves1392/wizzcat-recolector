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

globalThis.__MEM_DB__ = {};
instalarEntorno();
instalarProceso();

// Cada módulo exporta la promesa de `main()`: hay que esperarla, o el proceso
// se cierra antes de que termine la tanda. Se recorren en orden y se acumulan
// los códigos de salida, para que un fallo en el segundo no enmascare al primero.
for (const banco of [
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

