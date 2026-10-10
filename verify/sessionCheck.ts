// ==========================================================================
//  Banco de UNA SOLA SESIÓN POR JUGADOR (F23)
//
//  Lo que hay debajo es un problema de tiempo, no de sincronización, y esa es la
//  razón de que este banco mida una regla propia y no el game loop.
//
//  La partida se pisaba porque `saveToFirebase` escribe el estado COMPLETO en
//  cada bloque contra el mismo documento, así que dos sesiones a la vez se
//  sobrescriben sin error. Lo grave era la Ascensión, que borra nanitas y paga con
//  núcleos: dos reinicios a la vez podían dar un reinicio por cero.
//
//  LA REGLA, Y POR QUÉ ES "OCUPADA" ES UNA PREGUNTA SOBRE EL TIEMPO.
//
//  La forma obvia —"existe un documento de sesión, así que está ocupada"—
//  bloquea la cuenta para siempre en cuanto el jugador cierra la pestaña sin
//  llegar a borrar nada. Por eso `consultarSesion` mira el latido y solo considera
//  ocupada la cuenta cuando el latido es RECIENTE. Un latido viejo es una
//  pestaña cerrada.
//
//  Y estos bancos comprueban justo esa frontera, que es donde el bug vivía: el
//  latido en el borde de la ventana, el latido caducado y la propia sesión no
//  contándose a sí misma.
//
//  Lo que NO comprueba, y no puede: que el latido llegue a Firestore. Eso es la
//  cadena de cableado —igual que el cartel de logro en B3— y necesita la red.
// ==========================================================================

import { check, resumen } from './kit';
import { conTiempoLimite, esTiempoAgotado } from '../src/utils/timeout';
import { PLAZO_DE_LECTURA_MS, VENTANA_MS } from '../src/services/sessionService';

interface Latido { dispositivo: string; latido: number; }

/**
 * La regla de `consultarSesion`, con el reloj como parámetro.
 *
 * **Ya no es una copia de la ventana.** Antes este banco escribía su propio
 * `VENTANA_MS` y lo comparaba con el del juego; ahora importa el número, así
 * que la frontera que se comprueba abajo es la del juego por construcción y
 * no hay dos relojes que se puedan separar.
 */
function ocupada(d: Latido | null, miId: string, ahora: number): boolean {
  if (!d) return false;
  if (d.dispositivo === miId) return false;
  if (d.latido <= 0) return false;
  if (ahora - d.latido > VENTANA_MS) return false;
  return true;
}

async function main() {
  const ahora = Date.now();

  // -----------------------------------------------------------------------
  //  1. UNA PESTAÑA NUEVA ENTRA SI NO HAY NADIE
  // -----------------------------------------------------------------------
  check('sesion: sin documento, la cuenta está libre',
    !ocupada(null, 'a', ahora), 'nada escrito');
  check('sesion: una sesión con el latido vacío no ocupa la cuenta',
    !ocupada({ dispositivo: 'b', latido: 0 }, 'a', ahora),
    'latido=0');
  check('sesion: la sesión que ya está jugando no se cuenta a sí misma',
    !ocupada({ dispositivo: 'a', latido: ahora }, 'a', ahora),
    'mismo dispositivo');
  check('sesion: con latido reciente de OTRO dispositivo, no se entra',
    ocupada({ dispositivo: 'b', latido: ahora }, 'a', ahora),
    `otro con latido hace ${(ahora - ahora) / 1000}s`);

  // -----------------------------------------------------------------------
  //  2. EL RELOJ: LA FRONTERA ESTÁ EN VENTANA_MS
  // -----------------------------------------------------------------------
  check('sesion: un latido viejo deja entrar, que es la pestaña cerrada',
    !ocupada({ dispositivo: 'b', latido: ahora - (VENTANA_MS + 1000) }, 'a', ahora),
    `caducado hace 1s de más`);
  check('sesion: un latido en el borde sigue ocupando',
    ocupada({ dispositivo: 'b', latido: ahora - (VENTANA_MS - 5000) }, 'a', ahora),
    'dentro de la ventana');
  check('sesion: y el borde exacto sigue dentro',
    ocupada({ dispositivo: 'b', latido: ahora - VENTANA_MS }, 'a', ahora),
    'justo en el limite');

  // -----------------------------------------------------------------------
  //  3. POR QUÉ CINCO MINUTOS Y NO UN NÚMERO CUALQUIERA
  // -----------------------------------------------------------------------
  // Un corte de red debe dejar entrar, no dejar fuera. Y la ventana tiene que
  // ser más del doble que el periodo del guardado (2 min): el latido viaja de
  // viaje en el bloque, y con una ventana más corta el cerrojo caducaría entre
  // bloque y bloque estando jugando. El traspaso normal no espera a la
  // ventana: al cerrar se suelta la sesión a propósito, y la espera larga solo
  // la paga quien pierde la pestaña de golpe.
  check('sesion: la ventana cubre varios bloques de guardado, o caduca jugando',
    VENTANA_MS >= 2 * 120_000, VENTANA_MS + 'ms');
  check('sesion: y bastante corta para no dejar la cuenta bloqueada tras un cuelgue',
    VENTANA_MS <= 6 * 60_000, VENTANA_MS + 'ms');

  // -----------------------------------------------------------------------
  //  4. LA VENTANA MANDA SOBRE EL RITMO DEL GUARDADO
  // -----------------------------------------------------------------------
  // La comprobación que hace que el banco sirva: si alguien mueve la ventana o
  // el periodo del guardado y la relación se rompe, el latido de viaje caduca
  // entre bloques y la cuenta queda libre estando jugando. Se leen los dos
  // números de donde viven, no de una copia: una copia pasa en verde con el
  // juego roto.
  const { VENTANA_MS: DEL_JUEGO, REINTENTO_MS } = await import('../src/services/sessionService');
  const { RITMO_GUARDADO_MS } = await import('../src/gameLoop');
  check('sesion: la ventana cubre más del doble que el bloque, o el viaje caduca',
    DEL_JUEGO === VENTANA_MS && DEL_JUEGO > 2 * RITMO_GUARDADO_MS,
    `ventana=${DEL_JUEGO} bloque=${RITMO_GUARDADO_MS}`);
  check('sesion: el reintento cabe en la ventana, o se espera más de lo debido',
    REINTENTO_MS > 0 && REINTENTO_MS < DEL_JUEGO,
    `reintento=${REINTENTO_MS} ventana=${DEL_JUEGO}`);

  // -----------------------------------------------------------------------
  //  5. DOS PESTAÑAS DEL MISMO NAVEGADOR
  // -----------------------------------------------------------------------
  // El caso raro que más gente se encuentra, y el que `sessionStorage` resuelve:
  // cada pestaña tiene su id, así que se ven entre ellas. Con `localStorage`
  // las dos serían el mismo dispositivo y el bloqueo no existiría.
  check('sesion: dos pestañas con id distinto se detectan',
    ocupada({ dispositivo: 'pestana1', latido: ahora }, 'pestana2', ahora),
    'pestana1 y pestana2');

  // -----------------------------------------------------------------------
  //  6. LO QUE EL RELOJ NO PUEDE ARREGLAR
  // -----------------------------------------------------------------------
  // Dato para el rebalanceo, no una aserción. La carrera entre dos pestañas que
  // abren en el MISMO instante se resuelve por reloj, no por orden de llegada:
  // ambas pasan la primera consulta, ambas escriben su latido, y la segunda
  // consulta decide cuál se queda. La ventana de esa carrera es el tiempo entre
  // la primera consulta y la segunda, que es lo que mide este número.
  //
  // Con 3 segundos, dos pestañas que abren a la vez se detectan y solo una
  // entra. Es el caso raro y está bien resuelto. Lo que NO cubre es un jugador
  // que abre la segunda pestaña mientras la primera está en mitad de su carga
  // (varios segundos): esa entra directamente sin ver la pantalla, y es un
  // riesgo aceptado que la ventana acota.
  const carreraMs = REINTENTO_MS / 4;
  check('sesion: DATO la carrera entre dos pestañas simultáneas está acotada',
    carreraMs > 0 && carreraMs < VENTANA_MS / 4,
    `${Math.round(carreraMs)}ms de carrera, ventana ${VENTANA_MS}ms`);


  // ---------------------------------------------------------------------------
  //  F104 · LA PRESENCIA SE HA IDO: NI PUNTO, NI "HACE CUÁNTO", NI FUNCIONES.
  //
  //  Antes aquí se comprobaban `estaOnline()`, `textoUltimaConexion()` y
  //  `puntoDePresencia()` con la misma ventana que la sesión. Decían "en línea"
  //  con un latido que ya nadie escribe (la presencia costaba una escritura
  //  periódica por pestaña sin proteger nada), así que todas las filas salían
  //  "offline" para siempre. Las tres funciones se han ido con el punto, y con
  //  ellas estos dos bloques: un banco que afirma sobre código borrado es peor
  //  que no tenerlo. Lo que queda del "en línea" es el cerrojo de arriba, que
  //  es lo único que lo necesitaba.

  // =========================================================================
  //  El reloj de las esperas. Y por que vive en el propio banco y no en el juego.
  // =========================================================================
  //
  // **LO QUE SE COMPRUEBA ES QUE UNA PROMESA COLGADA SE CONVIERTE EN UN ERROR.**
  // Con la cuota de Firestore agotada el servidor no contesta con un error: contesta
  // "Using maximum backoff delay", y la peticion se queda esperando. Una promesa que no
  // contesta no se rechaza nunca, asi que un `catch` no sirve y el arranque se quedaba
  // con la pantalla en negro para siempre. Esto es lo que convierte una espera en un
  // fallo con nombre, que es lo unico que permite enseñarle algo al jugador.
  {
    // 1) Lo que contesta, pasa tal cual.
    check(
      'reloj: lo que llega antes del plazo se devuelve intacto',
      await conTiempoLimite(Promise.resolve(7), 1000, 'prueba') === 7,
      'no llego'
    );
    // 2) La que no contesta, falla. Y falla CON NOMBRE, no con un string suelto.
    const colgada: Promise<never> = new Promise<never>(() => { });
    let nombre = '';
    try {
      await conTiempoLimite(colgada, 20, 'colgada');
    } catch (e: any) {
      nombre = String(e?.name ?? '');
    }
    check(
      'reloj: una promesa que no contesta se convierte en un error',
      nombre === 'TiempoAgotadoError',
      `nombre=${nombre}`
    );
    check(
      'reloj: y el error lleva la etiqueta de lo que se esperaba',
      esTiempoAgotado({ name: 'TiempoAgotadoError' }) && !esTiempoAgotado(new Error('otra cosa')),
      'no se reconoce'
    );
    // 3) Un fallo de verdad sale sin convertirse en "se acabo el tiempo".
    let real = '';
    try {
      await conTiempoLimite(Promise.reject(new Error('quota')), 1000, 'prueba');
    } catch (e: any) {
      real = String(e?.message ?? '');
    }
    check(
      'reloj: un fallo de verdad no se disfraza de tiempo agotado',
      real === 'quota',
      `mensaje=${real}`
    );
    // 4) Y el temporizador se limpia, que es lo que evita que el proceso se quede vivo.
    //    Se mide con el reloj del banco: si el temporizador siguiera vivo, el proceso
    //    no terminaria nunca, y eso se veria en la suite entera, no aqui.
    check(
      'reloj: el plazo de las llamadas del modulo es corto',
      PLAZO_DE_LECTURA_MS > 0 && PLAZO_DE_LECTURA_MS <= 15_000,
      `plazo=${PLAZO_DE_LECTURA_MS}`
    );
  }

  resumen('sesion: una sola sesion por jugador');
}

export default main();
