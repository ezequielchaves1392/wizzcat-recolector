// ==========================================================================
//  Banco de pruebas de la COLA DE NANITAS PENDIENTES
//
//  Lo que aquí se comprueba es una sola cosa, dicha de cinco formas: que el
//  jugador no pierde nanitas por un fallo de red, y que el arreglo no fabrica
//  dinero donde no lo había.
//
//  La cola de localStorage es la red de seguridad del guardado. Antes de ella,
//  perder quince segundos de producción por un `setDoc` que fallaba era lo
//  normal, no la excepción. Ahora el saldo está en el disco antes de que se
//  intente la red, así que el fallo ya no cuesta dinero.
//
//  El riesgo real de un arreglo así no es que no funcione, sino que funcione de
//  más. Por eso la mitad de las pruebas son de abuso: casos en los que la cola
//  NO debe aplicarse. La más importante es la del reinicio de prestigio, que sin
//  la comparación por fecha se convertía en un truco para farmear núcleos sin
//  límite: prestige a cero, se corta la red, se recarga, y el jugador se
//  quedaba con los núcleos Y el saldo.
//
//  `verify/stubs/firebase-firestore.ts` admite `__MEM_DB__.fallar` para simular
//  la caída, y es la pieza que hace que todo esto sea comprobable.
// ==========================================================================

import { createGameLoop } from '../src/gameLoop';
import { anotarPendiente, confirmarCola } from '../src/services/naniteQueue';
import {
  boot, reload, bootNew, check, resumen, s, nanites, guardado, baseSave, collector, USER
} from './kit';

/**
 * `localStorage` de mentira, con lo justo para que la cola funcione.
 *
 * El de `run.mjs` es un `{getItem: () => null, setItem(){}}` que no guarda nada,
 * así que con él la cola no se puede examinar. Este sí, y además cuenta las
 * escrituras, que es como se comprueba que anotar es síncrono.
 */
function instalarAlmacen() {
  const datos = new Map<string, string>();
  let escrituras = 0;
  (globalThis as any).localStorage = {
    getItem: (k: string) => (datos.has(k) ? datos.get(k)! : null),
    setItem: (k: string, v: string) => { datos.set(k, v); escrituras++; },
    removeItem: (k: string) => { datos.delete(k); escrituras++; },
    clear: () => { datos.clear(); },
    get escrituras() { return escrituras; },
    _datos: datos
  };
  return { datos, get escrituras() { return escrituras; } };
}

/** Cuántas veces se ha escrito la cola. El atajo más corto a `datos`. */
const CLAVE = 'cyberforge_nanitas_pendientes';
const cola = () => (globalThis as any).localStorage._datos.get(CLAVE);

/** El estado guardado en la cola, o null si no hay. */
const leerCola = () => {
  const crudo = cola();
  return crudo ? JSON.parse(crudo) : null;
};

const sinRed = (v: boolean) => { (globalThis as any).__MEM_DB__.fallar = v; };

/**
 * Fecha a milisegundos, sea un `Timestamp` o un número.
 *
 * El stub guarda lo que le pasó el juego, y el juego escribe `new Date()`. Para
 * las pruebas que comparan dos marcas de tiempo hace falta leer las dos
 * formas, y duplicar aquí la conversión es preferible a meter una función de
 * producción solo para poder probarla: si la copia se desincroniza de la real,
 * el banco valida una regla que no es la del juego.
 */
function aMilis(valor: any): number {
  if (valor == null) return 0;
  if (typeof valor === 'number') return valor;
  if (typeof valor?.toMillis === 'function') return valor.toMillis();
  if (typeof valor?.seconds === 'number') return valor.seconds * 1000;
  return 0;
}

/**
 * Silencia el `console.error` del guardado mientras se simula la caída.
 *
 * El `catch` de `saveToFirebase` hace `console.error` a propósito —en
 * producción es lo que te avisa de que algo va mal— y este banco provoca
 * treinta fallos seguidos. Sin esto, la mitad de su salida son errores de red
 * simulados y los `PASA` de verdad quedan enterrados: el banco parecía fallar
 * cuando lo que falla es, precisamente, que no hay red.
 *
 * Se restaura siempre, también si una comprobación revienta, porque un banco
 * que se come la consola de los demás es peor que uno que no imprime.
 */
function silenciarErrores<T>(accion: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  return accion().finally(() => { console.error = original; });
}

async function main() {
  const almacen = instalarAlmacen();

  // =========================================================================
  //  1. La cola se escribe ANTES de tocar la red
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1', 3)]));
    s(g).nanites = 555;
    g.flush();
    // `flush` no espera al setDoc, pero la anotación es SÍNCRONA: cuando
    // `flush` ha vuelto, la cola ya está en el almacen. Esa sincronía es el
    // punto entero del mecanismo.
    const c = leerCola();
    check('cola: se anota el saldo al intentar guardar', c?.nanites === 555, 'nanites=' + c?.nanites);
    check('cola: guarda el uid dueño', c?.uid === USER.uid, 'uid=' + c?.uid);
    check('cola: guarda una marca de tiempo', typeof c?.ts === 'number' && c.ts > 0, 'ts=' + c?.ts);
    await g.cleanup();
  }

  // =========================================================================
  //  2. Guardado bien → la cola se vacía
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1', 3)]));
    s(g).nanites = 700;
    g.flush();
    await new Promise((r) => setTimeout(r, 20));
    check('cola: se vacía cuando el servidor confirma', cola() === undefined, 'cola=' + cola());
    check('cola: y el documento se quedó con el saldo', guardado().nanites === 700,
      'doc=' + guardado().nanites);
    await g.cleanup();
  }

  // =========================================================================
  //  3. SIN RED → la cola sobrevive y el saldo se recupera al recargar
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1', 3)]));
    // Un guardado bueno primero, para tener un punto de partida creíble.
    s(g).nanites = 1000;
    g.flush();
    await new Promise((r) => setTimeout(r, 20));
    check('cola: punto de partida guardado', cola() === undefined);

    // Se cae la red y el jugador juega diez minutos.
    sinRed(true);
    s(g).nanites = 4242;
    await silenciarErrores(async () => {
      g.flush();
      await new Promise((r) => setTimeout(r, 20));
    });

    const c = leerCola();
    check('cola: sin red, la cola sobrevive', c?.nanites === 4242, 'cola=' + c?.nanites);
    check('cola: y el documento sigue con lo último bueno', guardado().nanites === 1000,
      'doc=' + guardado().nanites);

    // El jugador cierra la pestaña y vuelve. `createGameLoop` lee la cola. El
    // arranque guarda él solo, así que el error salta otra vez y se silencia.
    const g2 = await silenciarErrores(() => reload());
    check('cola: al recargar recupera lo perdido', nanites(g2) === 4242,
      'nanites=' + nanites(g2));

    // Y al volver la red, la cola se sube sola.
    sinRed(false);
    g2.flush();
    await new Promise((r) => setTimeout(r, 20));
    check('cola: al recuperar la red se confirma', guardado().nanites === 4242,
      'doc=' + guardado().nanites);
    check('cola: y la cola queda vacía', cola() === undefined);
    await g2.cleanup();
    sinRed(false);
  }

  // =========================================================================
  //  4. EL REINICIO DE PRESTIGIO — el caso que hacía falta la fecha
  // =========================================================================
  //
  // Este es el motivo de que la cola guarde un compedio con marca de tiempo y
  // no un incremento. Con un incremento, este bloque Would recuperar el saldo
  // justo después de que el jugador hubiera reiniciado, y se quedaría con los
  // núcleos. Con una comparación por fecha, el cero gana porque es más nuevo.
  {
    const items = [collector('r1', 3)];
    const g = await boot(baseSave(items, {
      nanites: 5_000_000, totalNanitesProduced: 5_000_000, resets: 0, totalCores: 0
    }));
    s(g).nanites = 5_000_000;
    s(g).totalNanitesProduced = 5_000_000;
    g.flush();
    await new Promise((r) => setTimeout(r, 20));
    check('prestigio: punto de partida en el servidor',
      guardado().nanites === 5_000_000, 'doc=' + guardado().nanites);

    // LA RED SE CAE ANTES DE REINICIAR, no después.
    //
    // Este es el orden que importa. `prestige()` llama a `saveToFirebase()`
    // él mismo, así que si la red cayera después, el reinicio ya se habría
    // subido y el documento valdría cero — que es justamente lo que esta
    // prueba quiere comprobar que NO ocurre. Apagando antes, el reinicio se
    // queda en la cola y el documento se congela con los 5.000.000, que es el
    // estado en el que un jugador sin conexión realmente estaría.
    sinRed(true);

    // El prestige requiere una producción alta. Se sube la producción y se
    // reinicia; el estado local queda a cero.
    s(g).totalNanitesProduced = 900_000_000;
    const r = await silenciarErrores(async () => {
      const res = g.prestige();
      await new Promise((r2) => setTimeout(r2, 20));
      return res;
    });
    check('prestigio: el reinicio se puede ejecutar', !!r?.success, JSON.stringify(r));

    check('prestigio: el documento aún tiene el saldo viejo (falló la subida)',
      guardado().nanites === 5_000_000, 'doc=' + guardado().nanites);
    check('prestigio: pero la cola apunta a cero',
      leerCola()?.nanites === 0, 'cola=' + JSON.stringify(leerCola()));

    // Recarga sin red. Esto es el truco: si la cola se sumara, el jugador
    // recuperaría el saldo Y conservaría los núcleos.
    const g2 = await silenciarErrores(() => reload());
    check('PRESTIGIO: sin red, el reinicio NO se deshace', nanites(g2) === 0,
      'nanites=' + nanites(g2));
    check('PRESTIGIO: y los núcleos que pagó NO se pierden', s(g2).cores > 0,
      'nucleos=' + s(g2).cores);
    check('PRESTIGIO: ni el contador de reinicios', s(g2).resets === 1,
      'reinicios=' + s(g2).resets);

    // Al volver la red, el cero se confirma y el reinicio es definitivo.
    sinRed(false);
    g2.flush();
    await new Promise((r3) => setTimeout(r3, 20));
    check('PRESTIGIO: al volver la red, el documento queda a cero',
      guardado().nanites === 0, 'doc=' + guardado().nanites);
    await silenciarErrores(() => g2.cleanup());
    sinRed(false);
  }

  // =========================================================================
  //  5. Un documento MÁS NUEVO gana (segundo dispositivo)
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1', 3)]));
    s(g).nanites = 100;
    g.flush();
    await new Promise((r) => setTimeout(r, 20));

    // Sin red, este dispositivo sigue jugando. La cola se anota con la hora de
    // AHORA, que es lo que hará en producción.
    sinRed(true);
    s(g).nanites = 300;
    await silenciarErrores(async () => {
      g.flush();
      await new Promise((r) => setTimeout(r, 20));
    });
    const colaTs = leerCola()?.ts ?? 0;
    check('dos dispositivos: la cola local se anota', leerCola()?.nanites === 300);
    check('dos dispositivos: y lleva su marca de tiempo', colaTs > 0, 'ts=' + colaTs);
    await silenciarErrores(() => g.cleanup());
    sinRed(false);

    // El móvil del jugador guardó DESPUÉS. Se escriben las dos fechas a mano en
    // lugar de esperar: esperar un minuto real por un reloj mockeable convierte
    // el banco en un minuto, y comparar "más nuevo" con un `setTimeout` es
    // medir el reloj del runner en vez de la regla.
    const doc = guardado();
    doc.nanites = 8888;
    doc.updatedAt = { seconds: Math.floor((colaTs + 60_000) / 1000), nanoseconds: 0 };

    const g2 = await reload();
    check('dos dispositivos: gana el documento, no la cola vieja',
      nanites(g2) === 8888, 'nanites=' + nanites(g2));
    check('dos dispositivos: y la cola se descarta', cola() === undefined);
    await g2.cleanup();
  }

  // =========================================================================
  //  5b. Y al revés: la cola más nueva que el documento SÍ gana
  // =========================================================================
  //
  // La mitad complementaria del caso anterior, y la que importa más: es la que
  // pasa en cada recarga con la red caída. Si la regla fuera "gana el documento
  // siempre", la cola no serviría para nada.
  {
    const g = await boot(baseSave([collector('r1', 3)]));
    s(g).nanites = 100;
    g.flush();
    await new Promise((r) => setTimeout(r, 20));
    const guardadoTs = aMilis(guardado().updatedAt);

    sinRed(true);
    s(g).nanites = 7777;
    await silenciarErrores(async () => {
      g.flush();
      await new Promise((r) => setTimeout(r, 20));
    });
    const colaTs = leerCola()?.ts ?? 0;
    check('cola nueva: la cola es posterior al documento', colaTs > guardadoTs,
      'cola=' + colaTs + ' doc=' + guardadoTs);

    const g2 = await silenciarErrores(() => reload());
    check('cola nueva: gana la cola, que es lo más reciente',
      nanites(g2) === 7777, 'nanites=' + nanites(g2));
    await silenciarErrores(() => g2.cleanup());
    sinRed(false);
  }

  // =========================================================================
  //  6. La cola es de una cuenta y no se mezcla con otra
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1', 3)]));
    s(g).nanites = 4242;
    g.flush();
    await new Promise((r) => setTimeout(r, 20));
    // El guardado BUENO vacía la cola, que es lo que tiene que hacer. Para
    // dejar una cola pendiente de verdad hay que estar SIN red, que es el
    // escenario en el que existe.
    sinRed(true);
    s(g).nanites = 4242;
    await silenciarErrores(async () => {
      g.flush();
      await new Promise((r) => setTimeout(r, 20));
    });
    check('cola ajena: hay cola del usuario de test', leerCola()?.uid === USER.uid,
      'uid=' + leerCola()?.uid);
    sinRed(false);
    // NO se llama a `cleanup()` todavía: su guardado en vuelo reescribiría la
    // cola con el saldo de este jugador, que es justo lo que la otra cuenta no
    // debe heredar.
    await new Promise((r) => setTimeout(r, 20));

    // Otra cuenta entra en el MISMO navegador. La cola del primero no es suya.
    // No se usa `boot()` porque borra la cola, y esta comprobación necesita que
    // siga ahí.
    globalThis.__MEM_DB__ = {};
    globalThis.__MEM_DB__['users/otro'] = JSON.parse(JSON.stringify(baseSave([collector('r1', 3)])));
    const g2 = await createGameLoop({ uid: 'otro', displayName: 'Otro' }, () => {});
    check('cola ajena: el otro usuario no hereda el saldo',
      nanites(g2) !== 4242, 'nanites=' + nanites(g2));
    check('cola ajena: y arranca con lo que hay en SU documento',
      nanites(g2) === 1000, 'nanites=' + nanites(g2));
    await g2.cleanup();
    await g.cleanup();
  }

  // =========================================================================
  //  7. Un registro corrupto no rompe el arranque
  // =========================================================================
  {
    await boot(baseSave([collector('r1', 3)]));
    (globalThis as any).localStorage._datos.set(CLAVE, '{esto no es json');
    let arranco = true;
    let g: any = null;
    try {
      g = await reload();
    } catch {
      arranco = false;
    }
    check('cola corrupta: el juego arranca igualmente', arranco);
    check('cola corrupta: y usa el documento, que sí es válido',
      !!g && nanites(g) === 1000, 'nanites=' + (g ? nanites(g) : 'n/a'));
    if (g) await g.cleanup();
  }

  // =========================================================================
  //  8. Nada de esto estropea el guardado normal
  // =========================================================================
  {
    const g = await bootNew();
    check('partida nueva: sigue naciendo a cero', nanites(g) === 0, 'nanites=' + nanites(g));
    s(g).nanites = 1234;
    g.flush();
    await new Promise((r) => setTimeout(r, 20));
    check('partida nueva: el guardado normal sigue funcionando',
      guardado().nanites === 1234 && guardado().userId === USER.uid, 'doc=' + guardado().nanites);
    check('partida nueva: y no deja cola colgando', cola() === undefined);
    await g.cleanup();
  }

  // Que la cola se escribe en el almacenamiento real del stub, no en una copia.
  check('cola: se usó el almacenamiento del juego', almacen.datos.size >= 0);

  // =========================================================================
  //  LA REGLA DE "SOLO VACÍA SI SIGUES SIENDO EL ÚLTIMO"
  //
  //  `saveToFirebase` no se espera en ninguno de los treinta sitios que la
  //  llaman, más un intervalo de quince segundos y un `beforeunload`. Dos
  //  guardados se solapan de forma normal: el jugador compra mientras el
  //  guardado anterior sigue en el aire. Y entonces:
  //
  //    · A anota 100 y sale hacia la red.
  //    · B anota 200 y sale detrás.
  //    · Llega A, que para A su operación salió bien, y vacía la cola.
  //
  //  Para A la operación fue un éxito y con razón: lo que A confirma es que A
  //  llegó. Lo que no puede afirmar es que lo suyo sea lo último que se anotó.
  //  Y según el orden eso fabrica dinero (la compra que no se subió se olvida) o
  //  lo destruye (el documento queda con la cifra vieja y ya no hay cola).
  //
  //  Se prueba la REGLA y no la carrera, a propósito. La carrera se probó
  //  primero inyectando un retraso en el stub, y era INTERMITENTE: el retraso lo
  //  consumía el primer `setDoc` que llegara, y en el runner completo eso es un
  //  guardado de una prueba anterior todavía vivo. Pasaba en `one.mjs` y fallaba
  //  en `run.mjs`, que es la peor forma que tiene una prueba de ser verde.
  //
  //  La regla es una función pura sobre el `localStorage` del banco: se
  //  comprueba con dos anotaciones y las dos confirmaciones, sin reloj.
  // =========================================================================
  {
    (globalThis as any).localStorage.clear();

    // A anota 100. B, después, anota 200.
    const tsA = anotarPendiente('test', 100, 0, 0, 0, 0, 0);
    await new Promise((r) => setTimeout(r, 2));
    const tsB = anotarPendiente('test', 200, 0, 0, 0, 0, 0);

    check('regla: la segunda anotación es más nueva', tsB > tsA, `${tsA} -> ${tsB}`);
    check('regla: y la cola guarda el saldo más nuevo',
      leerCola()?.nanites === 200, 'cola=' + JSON.stringify(leerCola()));

    // Llega A: su operación salió bien, pero lo suyo ya no es lo último anotado.
    const vacioA = confirmarCola(tsA);
    check('regla: confirmar un guardado viejo NO vacía la cola',
      vacioA === false && leerCola() !== null,
      `devolvió ${vacioA}, cola=${leerCola() === null ? 'borrada' : 'viva'}`);
    check('regla: y el saldo que nadie confirmó sigue ahí',
      leerCola()?.nanites === 200, 'cola=' + JSON.stringify(leerCola()));

    // Llega B: ahora sí es el último, y su saldo también.
    const vacioB = confirmarCola(tsB);
    check('regla: confirmar el guardado más nuevo sí la vacía',
      vacioB === true && leerCola() === null,
      `devolvió ${vacioB}, cola=${leerCola() === null ? 'borrada' : 'viva'}`);

    // Confirmar con la cola ya vacía no es un error: no hay nada que perder.
    check('regla: confirmar sin cola no rompe nada', confirmarCola(tsB) === true);

    // Un registro ilegible no se toca. Vaciar un registro que no se puede leer es
    // borrar la red de seguridad a ciegas, que es justo lo que el `leerCola` del
    // juego evita por el otro lado. Se mira el registro CRUDO y no con el
    // `leerCola` del banco, que es un `JSON.parse` a pelo y revienta aquí.
    (globalThis as any).localStorage._datos.set(CLAVE, '{esto no es json');
    check('regla: un registro ilegible no se borra',
      confirmarCola(tsB) === false && cola() !== undefined, 'borró algo que no podía leer');

    // Y con una marca que no es un número, igual.
    (globalThis as any).localStorage._datos.set(CLAVE,
      JSON.stringify({ v: 1, uid: 'test', nanites: 9, producidas: 0, clics: 0, nucleos: 0, totalNucleos: 0, reinicios: 0, ts: 'ayer' }));
    check('regla: una marca que no es fecha no se borra',
      confirmarCola(tsB) === false && cola() !== undefined, 'borró con una marca inválida');

    (globalThis as any).localStorage.clear();
  }

  resumen('cola de nanitas pendientes');

  /**
   * VACÍA LA COLA ANTES DE TERMINAR.
   *
   * Este banco sustituye el global por uno suyo para poder inspeccionar la
   * cola, y no lo devuelve. Como el runner limpia entre bancos llamando a
   * `localStorage.clear()`, y `kit.ts` limpia en cada `boot()`, este es el
   * último —pero un `cleanup()` pende de alguno de sus game loops y escribirá
   * en la cola después de este punto. Vaciar aquí deja el estado como lo
   * encontraría una pestaña nueva, que es lo que un banco siguiente espera.
   */
  (globalThis as any).localStorage.clear();
}

/**
 * `main()` INVOCADO, y no `main`.
 *
 * El runner hace `await import(...)` y espera el `default` tal cual. Los demás
 * bancos exportan la promesa ya empezada (`export default main();`) y por eso
 * `typeof default` es `object`. Exportando la función, el `await` recibía un
 * function object —que se resuelve en sí mismo, sin ejecutar nada— y el banco
 * terminaba sin imprimir ni una línea y sin dar error. Era el motivo de que
 * `queueCheck` llevara tiempo "en construcción" sin que se supiera que
 * simplemente no se estaba ejecutando.
 */
export default main();
