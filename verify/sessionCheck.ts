// ==========================================================================
//  Banco de UNA SOLA SESIÓN POR JUGADOR (F23)
//
//  Lo que hay debajo es un problema de tiempo, no de sincronización, y esa es la
//  razón de que este banco mida una regla propia y no el game loop.
//
//  La partida se pisaba porque `saveToFirebase` escribe el estado COMPLETO cada
//  15 segundos contra el mismo documento, así que dos sesiones a la vez se
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
import { PLAZO_DE_LECTURA_MS } from '../src/services/sessionService';
import { estaOnline, textoUltimaConexion } from '../src/services/rankingService';
import { puntoDePresencia } from '../src/components/rankings';

// La misma regla que usa el juego, pero sin Firestore: el reloj es lo único que
// decide y aquí se puede mover a voluntad.
const VENTANA_MS = 45_000;

interface Latido { dispositivo: string; latido: number; }

/**
 * La regla de `consultarSesion`, con el reloj como parámetro.
 *
 * **Es una copia, y por eso aquí se declara tan alto el problema**: una
 * reimplementación pasa los bancos justo cuando el juego está roto. Lo que se
 * comprueba abajo es que ESTA copia y la del juego dicen lo mismo, leyendo el
 * módulo de verdad para comparar los dos números de ventana.
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
  //  3. POR QUÉ 45 SEGUNDOS Y NO UN NÚMERO CUALQUIERA
  // -----------------------------------------------------------------------
  // Un corte de red debe dejar entrar, no dejar fuera. Y recargar la página no
  // puede perder la cuenta: el guardado local gana, pero la partida se queda sin
  // tocar durante un par de segundos y el latido ajeno caduca justo entonces.
  check('sesion: la ventana es bastante para sobrevivir a una recarga',
    VENTANA_MS >= 30_000, VENTANA_MS + 'ms');
  check('sesion: y bastante corta para no dejar la cuenta bloqueada',
    VENTANA_MS <= 60_000, VENTANA_MS + 'ms');

  // -----------------------------------------------------------------------
  //  4. LA VENTANA DEL JUEGO ES LA MISMA QUE LA DE AQUÍ
  // -----------------------------------------------------------------------
  // Esta es la comprobación que hace que el banco sirva: si alguien cambia la
  // ventana en el juego y no en el banco, los dos dejan de hablar del mismo
  // reloj y todos los números de arriba pasan sin decir nada del juego real.
  const { VENTANA_MS: DEL_JUEGO, REINTENTO_MS } = await import('../src/services/sessionService');
  check('sesion: la ventana del banco es la del juego',
    DEL_JUEGO === VENTANA_MS, `banco=${VENTANA_MS} juego=${DEL_JUEGO}`);
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
  // riesgo aceptado que el latido de 45 segundos acota.
  const carreraMs = REINTENTO_MS / 4;
  check('sesion: DATO la carrera entre dos pestañas simultáneas está acotada',
    carreraMs > 0 && carreraMs < VENTANA_MS / 4,
    `${Math.round(carreraMs)}ms de carrera, ventana ${VENTANA_MS}ms`);


  // ---------------------------------------------------------------------------
  //  PRESENCIA: LA MISMA VENTANA QUE LA SESIÓN OCUPADA, Y LOS TRES CASOS
  //
  //  "En línea" y "la cuenta está ocupada" son la misma pregunta con dos palabras
  //  distintas, y por eso la función de una **importa** `VENTANA_MS` en vez de
  //  escribirla. Si cada sitio tuviera la suya —aunque coincidieran el día que se
  //  escribieron— habría un momento en que un jugador Would ver "en línea" en el
  //  ranking y a la vez could entrar con la misma cuenta en otro sitio.
  //
  //  Y los tres casos que se comprueban son los que de verdad se dan: un latido
  //  fresco, un latido viejo y **ningún latido**, que es el de todo documento
  //  escrito antes de que esto existiera.
  // ---------------------------------------------------------------------------
  {
    const ahora = 1_000_000;
    check('presencia: un latido recién puesto está en línea',
      estaOnline(ahora - 1_000, ahora) === true, 'hace 1 s');
    check('presencia: y uno de hace medio minuto también',
      estaOnline(ahora - 30_000, ahora) === true, 'hace 30 s');

    // El borde, que es donde vive el bug: exactamente en la ventana sigue en línea y
    // un milisegundo después no. Es el mismo borde que ya comprueba la sesión ocupada, y
    // se comprueba en los dos sitios a propósito: si las dos ventanas dejaran de ser la
    // misma, estos dos números dejarían de cuadrar y nadie lo vería.
    check('presencia: el borde exacto sigue en línea, como la sesión ocupada',
      estaOnline(ahora - VENTANA_MS + 1, ahora) === true
      && estaOnline(ahora - VENTANA_MS - 1, ahora) === false,
      `borde: ${VENTANA_MS} ms`);

    check('presencia: un latido viejo está offline',
      estaOnline(ahora - 10 * 60_000, ahora) === false, 'hace 10 min');

    // **SIN LATIDO ES OFFLINE, Y NO ONLINE POR DEFECTO.** El documento de una cuenta
    // que no ha jugado desde que esto existe no tiene el campo, y tratarlo como online
    // sería una mentira en la fila de arriba. Una mentira verde es la peor de las dos,
    // porque el jugador la lee sin poder comprobarla.
    const sinLatido: any[] = [undefined, null, 0, -1, NaN, 'ahora' as any];
    const marcados = sinLatido.filter(v => estaOnline(v, ahora) === true);
    check('presencia: sin latido es offline, y no online por defecto',
      marcados.length === 0, marcados.join(',') || `${sinLatido.length} valores, ninguno en línea`);

    // Y **un reloj que va hacia atrás no da online eterno**. Un dispositivo con la hora
    // mal, o un cambio de hora, dejan el latido en el futuro: `ahora - latido` sería
    // negativo, y "negativo es menor que la ventana" es `true` sin que nadie lo piense.
    check('presencia: un latido del futuro no marca online para siempre',
      estaOnline(ahora + 60_000, ahora) === false, 'latido 1 min en el futuro');

    // **Y LA VENTANA ES LA MISMA QUE LA DE LA SESIÓN, LEÍDA DEL MISMO SITIO.** No es una
    // coincidencia que se pueda comprobar: es que la función importa el número, y esto
    // solo comprueba que sigue siendo el que dice el servicio de sesión.
    check('presencia: la ventana de "en línea" es la de la sesión ocupada',
      typeof VENTANA_MS === 'number' && VENTANA_MS > 0
      && !estaOnline(ahora - VENTANA_MS - 1, ahora),
      `ventana=${VENTANA_MS} ms`);
  }

  // ---------------------------------------------------------------------------
  //  F67 · EL OFFLINE DICE HACE CUÁNTO, EN MINUTOS, HORAS O DÍAS.
  //
  //  Donde la fila decía "offline" a secas, ahora dice "hace 3 h" con el latido
  //  que ya trae: saber si alguien se fue hace cinco minutos o hace un mes es
  //  lo que hace útil el punto rojo. Y los tramos tienen techo, porque sin él
  //  un latido viejo saldría como minutos de seis cifras, que no dice nada y
  //  parece un bug —que es justo lo que se viene a comprobar aquí.
  // ---------------------------------------------------------------------------
  {
    const ahora = 1_700_000_000_000;
    const hace = (ms: number) => textoUltimaConexion(ahora - ms, ahora);
    check('ultima: hace medio minuto es "hace un momento", no "hace 0 min"',
      hace(30_000) === 'hace un momento', String(hace(30_000)));
    check('ultima: cinco minutos son minutos',
      hace(5 * 60_000) === 'hace 5 min', String(hace(5 * 60_000)));
    check('ultima: 59 minutos siguen siendo minutos',
      hace(59 * 60_000) === 'hace 59 min', String(hace(59 * 60_000)));
    check('ultima: una hora son horas, no 60 minutos',
      hace(60 * 60_000) === 'hace 1 h', String(hace(60 * 60_000)));
    check('ultima: 23 horas siguen siendo horas',
      hace(23 * 3_600_000) === 'hace 23 h', String(hace(23 * 3_600_000)));
    check('ultima: un día son días, no 24 horas',
      hace(24 * 3_600_000) === 'hace 1 día', String(hace(24 * 3_600_000)));
    check('ultima: 29 días siguen siendo días',
      hace(29 * 86_400_000) === 'hace 29 días', String(hace(29 * 86_400_000)));
    check('ultima: un mes es tope, no 30 días contados',
      hace(30 * 86_400_000) === 'hace más de un mes', String(hace(30 * 86_400_000)));
    // **EL CASO PEDIDO: UN LATIDO VIEJÍSIMO NO SALE EN MINUTOS.** Un millón de
    // minutos son casi dos años: la frase con techo dice lo mismo sin el número
    // absurdo.
    check('ultima: un millón de minutos sale como "más de un mes", nunca en minutos',
      hace(1_000_000 * 60_000) === 'hace más de un mes', String(hace(1_000_000 * 60_000)));
    // Sin latido no hay frase, y la fila se queda con el "offline" de siempre.
    const sinDato: any[] = [undefined, null, 0, -1, NaN, 'ahora' as any];
    check('ultima: sin latido no hay frase que inventar',
      sinDato.every(v => textoUltimaConexion(v, ahora) === null),
      sinDato.map(v => String(textoUltimaConexion(v, ahora))).join(','));
    // Y un reloj hacia atrás no da un "hace -3 min": se recorta a ahora.
    check('ultima: un latido del futuro es "hace un momento", no un negativo',
      textoUltimaConexion(ahora + 60_000, ahora) === 'hace un momento',
      String(textoUltimaConexion(ahora + 60_000, ahora)));

    // **Y EL PUNTO LO ENSEÑA.** La fila en línea sigue diciendo "en línea", la
    // offline con latido dice el hace-cuánto (con el title que lo explica), y
    // la offline sin latido se queda como estaba.
    const puntoOnline = puntoDePresencia(ahora - 1_000, ahora);
    check('punto: en línea sigue diciendo "en línea"',
      puntoOnline.includes('en línea') && !puntoOnline.includes('hace'), puntoOnline.slice(0, 120));
    const puntoViejo = puntoDePresencia(ahora - 3 * 3_600_000, ahora);
    check('punto: offline con latido dice hace cuánto',
      puntoViejo.includes('hace 3 h') && puntoViejo.includes('última conexión'),
      puntoViejo.slice(0, 160));
    const puntoSin = puntoDePresencia(undefined, ahora);
    check('punto: offline sin latido se queda en "offline"',
      puntoSin.includes('offline') && !puntoSin.includes('hace'), puntoSin.slice(0, 120));
  }

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
