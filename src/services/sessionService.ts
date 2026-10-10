// ==========================================================================
//  Cyber-Forge · Una sola sesión por jugador
//
//  Qué resuelve. Dos dispositivos (o dos pestañas) jugando a la vez contra el
//  mismo documento se pisan: `saveToFirebase` escribe el estado COMPLETO con
//  `setDoc(..., { merge: true })` en cada bloque, así que el segundo dispositivo
//  borra lo que produjo el primero sin error y sin aviso. Y lo grave es la
//  Ascensión: borra las nanitas y paga con núcleos, así que dos reinicios a la
//  vez pueden dar un reinicio por cero núcleos.
//
//  LA FORMA, Y POR QUÉ ES ESTA.
//
//  Hay dos maneras de evitarlo y solo una funciona desde el navegador:
//
//   1. Expulsar a la sesión antigua. NO SE PUEDE. `signOut()` solo afecta a la
//      pestaña que lo llama, y cerrar la sesión de verdad requiere revocar los
//      tokens con el Admin SDK, que es un servidor. Un jugador con la partida
//      abierta en el móvil se quedaría sin poder jugar hasta que cerrara la otra
//      pestaña él mismo.
//   2. Negarse a entrar. **Es la elegida, y por eso está aquí.** La sesión que
//      ya está jugando sigue viva y no se le toca nada; la que llega se le
//      explica por qué no puede entrar. Nadie pierde una partida en curso por un
//  error nuestro.
//
//  EL RELOJ DE EXPIRACIÓN ES LA PARTE QUE NO SE PUEDE SALTAR.
//
//  Si el latido no expirara, cerrar la pestaña dejaría la cuenta bloqueada para
//  siempre: el jugador cierra el portátil, se va a dormir y al volver no puede
//  jugar hasta que expire un plazo que no conoce. Con `VENTANA_MS` corto, cerrar
//  la pestaña libera la cuenta en menos de un minuto y el que espera un momento
//  es el que llega antes, no el que ya estaba.
//
//  Y como la partida tarda más de un minuto en cerrarse sola, el latido se
//  comprueba DOS veces: al arrancar y cada `REINTENTO_MS` mientras se espera.
//  Así quien tiene el escritorio abierto y abre el móvil recibe el aviso en
//  cuanto el otro se libera, sin tener que recargar a mano.
//
//  DÓNDE VIVE. En `users/{uid}`, que el jugador ya puede escribir (reglas de
//  Firestore, línea 90). Un documento nuevo para esto habría pedido cambiar las
//  reglas, y esto no necesita permiso nuevo para nada.
// ==========================================================================

import { doc, getDoc, setDoc, deleteField, updateDoc } from 'firebase/firestore';
import { contarOp } from './contadorOps';
import { db } from '../firebase';
import { conTiempoLimite } from '../utils/timeout';

/**
 * Cuánto vive un latido sin refrescar.
 *
 * 5 minutos (F104). Es el margen entre "cerré la pestaña" y "ya puedo volver a
 * entrar". Se alargó desde 45 segundos porque el latido viaja de viaje en el
 * guardado, que sale cada 2 minutos: con una ventana más corta que dos
 * periodos, el cerrojo caducaría entre bloque y bloque y la cuenta quedaría
 * libre estando jugando. La ventana manda sobre el ritmo del latido, y por
 * eso este número vive aquí y el ritmo sale de él (`VENTANA_MS / 2`).
 *
 * El traspaso normal no espera a la ventana: al cerrar se suelta la sesión a
 * propósito (`soltarSesion`), así que la espera larga solo la paga quien
 * pierde la pestaña de golpe (cuelgue, batería). El ahorro es del orden de
 * diez latidos sueltos por hora; la espera, solo en el caso raro.
 */
export const VENTANA_MS = 300_000;

/**
 * Cuánto se espera a Firestore antes de dar la comprobación por perdida.
 *
 * **OCHO SEGUNDOS, Y POR QUÉ HACE FALTA.** Con la cuota agotada, Firestore no
 * contesta con un error: contesta "Using maximum backoff delay", que significa
 * "todavía no". La petición se queda colgada, y como las dos llamadas de este
 * fichero son `await` en el arranque, **el juego entero se quedaba esperando en
 * silencio y la pantalla no se montaba nunca**. Un rechazo lo atrapa cualquiera; una
 * promesa que no contesta, no.
 *
 * Ocho segundos es mucho más que una respuesta normal y muy poco para alguien que
 * está mirando una pantalla en blanco. Y el resultado de pasarse **es el mismo que
 * el de cualquier otra inability de comprobar**: se deja entrar. Un corte de red no
 * puede ser la razón de que un jugador se quede fuera de su partida, y un límite de
 * tiempo es un corte de red que ha decidido no avisar.
 */
export const PLAZO_DE_LECTURA_MS = 8_000;

/** Cada cuánto se vuelve a preguntar mientras se espera a que se libere. */
export const REINTENTO_MS = 12_000;

const CLAVE = 'cyberforge_deviceo';

export interface EstadoSesion {
  ocupada: boolean;
  /** Cuándo se vio el latido de la sesión que tiene la cuenta. */
  latido: number;
  /** El id de la sesión que la tiene. */
  dispositivo: string;
}

/**
 * El id de ESTA pestaña.
 *
 * **`sessionStorage` y no `localStorage`, y la diferencia es el caso raro que más
 * gente se va a encontrar**: dos pestañas del mismo navegador son el mismo
 * dispositivo y sería normal que compitiesen. Con `sessionStorage` cada pestaña
 * tiene su propio id, así que se detectan solas y no hay que tratarlas aparte. Con
 * `localStorage` las dos pestañas se creer'sían la misma sesión y el bloqueo no
 * se vería nunca.
 *
 * Y `sessionStorage` muere con la pestaña, que es justo lo que queremos: al
 * cerrar, el id desaparece y no queda un "dispositivo" fantasma ocupando la
 * cuenta.
 */
export function idDeSesion(): string {
  try {
    let id = sessionStorage.getItem(CLAVE);
    if (!id) {
      id = `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(CLAVE, id);
    }
    return id;
  } catch {
    // Modo privado sin almacenamiento: se genera uno en memoria. No se puede
    // persistir entre recargas, así que cada recarga cuenta como sesión nueva y
    // el bloqueo no puede activarse. Es el precio de no tener dónde guardar, y
    // es aceptable: sin almacenamiento tampoco se puede guardar la partida.
    return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

const SIN_SESION: EstadoSesion = { ocupada: false, latido: 0, dispositivo: '' };

/**
 * Pregunta si la cuenta está ocupada por OTRA sesión.
 *
 * NUNCA lanza, por la misma razón que `consultarBloqueo`: si no se puede
 * comprobar, se deja entrar. Un corte de red no puede ser la razón de que un
 * jugador se quede fuera de su partida.
 *
 * Se considera ocupada cuando el latido es **reciente** (`VENTANA_MS`), no
 * cuando existe. Un latido viejo es una pestaña cerrada que no llegó a
 * borrarse, y dejarlo ahí sería la forma segura de bloquear la cuenta para
 * siempre. Por eso "ocupada" es una pregunta sobre el TIEMPO, no sobre la
 * existencia del campo.
 */
export async function consultarSesion(uid: string, miId: string): Promise<EstadoSesion> {
  try {
    // Con plazo: una petición colgada no puede dejar el arranque esperando para siempre.
    const snap = await conTiempoLimite(
      getDoc(doc(db, 'users', uid)),
      PLAZO_DE_LECTURA_MS,
      'consultarSesion'
    );
    // F96 · Preguntar quién tiene la cuenta también es una lectura.
    contarOp('lectura', 'users', 'sesion-check');
    if (!snap.exists()) return SIN_SESION;

    // **EL LATIDO VIVE DENTRO DE LA PARTIDA, EN LA CLAVE `sesion`.** No en un
    // subdocumento, y por dos razones que seuzzaron a la vez: las reglas de seguridad
    // solo dejan escribir en `users/{uid}` —todo lo demas cae en el
    // `match /{document=**}` que cierra la puerta— y la API pide un numero PAR de
    // segmentos, mientras que `users/{uid}/sesion` son TRES. Con la ruta mala, la
    // escritura fallaba siempre, la lectura tambien, y como las dos van dentro de un
    // `try` que solo avisa, **el aviso aparecia y el juego seguia como si nada**:
    // ninguna sesion se detectaba nunca y la proteccion contra dos pestanas
    // escribiendo a la vez llevaba tiempo sin existir sin que se notara.
    const d = (snap.data() as any)?.sesion;
    const latido = typeof d?.latido === 'number' ? d.latido : 0;
    const dispositivo = String(d?.dispositivo || '');

    if (dispositivo === miId) return { ocupada: false, latido, dispositivo };
    if (latido <= 0) return SIN_SESION;
    if (Date.now() - latido > VENTANA_MS) return SIN_SESION;

    return { ocupada: true, latido, dispositivo };
  } catch (e) {
    console.warn('[sesion] No se ha podido comprobar la sesion; se deja entrar.', e);
    return SIN_SESION;
  }
}

/**
 * Pone el latido de esta sesión.
 *
 * Se escribe con `setDoc` sobre un subdocumento, así que no toca el documento
 * de la partida: si se escribiera en `users/{uid}` entero, un fallo al anotar el
 * latido podría pisar nanitas o inventario.
 *
 * F104 · Solo aquí, y solo cuando toca. Antes esta función hacía dos viajes
 * (la sesión y la presencia del ranking); la presencia se ha ido porque el
 * punto verde costaba una escritura periódica por pestaña sin proteger nada.
 * El "en línea" que queda es el cerrojo, que es lo único que lo necesita.
 */
/**
 * **CUÁNDO SE HA ESCRITO EL LATIDO POR ÚLTIMA VEZ, Y POR QUÉ ESTÁ EXPORTADO.**
 *
 * Es el reloj que decide si un latido se escribe o no, y lo necesita `gameLoop`,
 * porque el latido va a viajar **dentro del documento de la partida** en vez de en una
 * escritura propia. Sin este número el motor no puede saber si su escritura ya ha
 * refreshed el latido, y acabaría escribiendo las dos veces.
 *
 * **EL RELOJ SE PONE EN `confirmarLatido()`, NO EN `campoLatido()`, Y ES EL MISMO
 * ERROR QUE B28 CORIGIÓ CON LA FIRMA DE LA PARTIDA, VUELTO A SALIR.**
 *
 * La primera versión lo ponía al devolver el campo, antes de que nadie escribiera nada.
 * Con la red en su sitio daba igual. **Con la red caída, o con un guardado que B28 decide
 * no hacer, el reloj mentía**: decía "el latido está escrito" sin que se hubiera escrito
 * nada, y el cerrojo se quedaba **sin latido durante la ventana entera** —con lo que la cuenta
 * del jugador quedaba libre y otro dispositivo podía entrar—. El jugador que pierde la
 * partida es exactamente el que no tenía red, que es el que más lo necesita.
 *
 * Por eso el reloj se mueve **después** de la escritura, en `confirmarLatido()`, que
 * llaman los dos caminos que escriben de verdad: `anotarLatido()` y el guardado del motor.
 * **Firmar antes de escribir es afirmar que algo está en el servidor cuando no lo está**,
 * y sale más barato en la misma regla que en la partida.
 */
let ultimoLatidoEscrito = 0;

/**
 * F104 · DEVUELVE EL RELOJ A FRÍO. SOLO LA USAN LOS BANCOS.
 *
 * El reloj es de módulo y los bancos comparten proceso: un banco que confirma
 * con el reloj simulado adelantado dejaría el latido "fresco" para el banco
 * siguiente, que mediría un cerrojo recién batido en vez del suyo. Es la misma
 * clase de contaminación que `limpiarCola()` y `limpiarCacheRanking()` ya
 * resuelven en su sitio. El juego no la llama nunca.
 */
export function reiniciarRelojLatido(): void {
  ultimoLatidoEscrito = 0;
}

/**
 * El campo `sesion` tal y como hay que escreverlo, o `null` si no toca.
 *
 * **ESTE ES EL ARREGLO DE B30, Y LA IDEA ES UNA SOLA: EL LATIDO NO TIENE QUE
 * ESCRIBIRSE SOLO.**
 *
 * El latido dice una sola cosa, "esta pestaña sigue viva", y la dice cada
 * `VENTANA_MS / 2`. Para decirlo hacía falta **una escritura en `users/{uid}`
 * en cada periodo**, y esa escritura es la que se gastaba la cuota: el comentario
 * de arriba ya lo sospechaba ("un tercio de las escrituras del juego eran solo
 * para mantener vivo un reloj que el propio jugador no ve").
 *
 * **EL PROBLEMA ES QUE ESE `setDoc` ES INÚTIL POR SEPARADO, PORQUE EL GUARDADO DE LA
 * PARTIDA ESTÁ ESCRIBIENDO EL MISMO DOCUMENTO CADA POCO.** `anotarLatido`
 * escribe `{ sesion: {...} }` con `merge: true` en `users/{uid}`, y el guardado escribe
 * la partida entera en `users/{uid}` con `merge: true`. Son **el mismo documento**: dos
 * viajes al mismo sitio con el mismo sello. Firestore cobra **una escritura por
 * documento**, así que la segunda no compra nada que la primera no compre, y sin embargo
 * las dos se pagan.
 *
 * **LA SOLUCIÓN, Y POR QUÉ NO ROMPE EL CERROJO.** El latido se mete **dentro** del
 * documento del guardado. En cada bloque, mientras se guarda, el latido viaja de
 * viaje y **no cuesta una escritura extra**: ya se estaba pagando esa. El cerrojo sigue
 * vivo exactamente igual, porque la ventana (5 minutos) es más del doble que el
 * periodo del guardado (2 minutos): entre dos bloques nunca pasa tanto como para
 * que el latido caduque. Por eso el latido **sigue teniendo su propio reloj**,
 * pero **solo escribe cuando el guardado no lo ha hecho hace poco**: si
 * el juego acaba de guardar, su latido es de ahora mismo y escribirlo otra vez sería
 * pagar dos veces por el mismo sello.
 *
 * **LO QUE NO SE ROMPE, Y POR QUÉ.** Al cerrar se suelta la sesión a propósito,
 * así que el traspaso normal no espera a la ventana; la ventana larga solo la
 * paga quien pierde la pestaña de golpe. El cerrojo sigue bloqueando igual. Lo
 * único que cambia es **cuántas veces se paga el sello**.
 */
export function campoLatido(uid: string, miId: string): { sesion: any } | null {
  // Solo si ha pasado el rato que se considera "fresco". `VENTANA_MS / 2` es el mismo
  // margen que usa el temporizador, o sea que un latido que acaba de escribirse por su
  // cuenta se considera fresco y no se vuelve a escribir.
  //
  // **OJO CON EL CERO DE LA IZQUIERDA, Y ES LO QUE MANTIENE VIVO EL CERROJO AL
  // ARRANCAR.** La comparación es `ultimoLatidoEscrito && ...` a propósito: con el reloj
  // a cero, "ha pasado el rato" sería cierto —el reloj dice que nunca se escribió— y el
  // primer latido saldría, que es lo que se quiere. Pero un `Date.now() - 0` da una
  // cifra enorme y **un banco o una recarga se tragarían la primera llamada sin
  // enterarse**. La forma corta de esto es que la condición se lee al revés de lo
  // normal: se pregunta "¿hay un latido reciente?" y si **no lo hay**, se escribe.
  if (ultimoLatidoEscrito && Date.now() - ultimoLatidoEscrito < VENTANA_MS / 2) return null;
  return { sesion: { dispositivo: miId, latido: Date.now(), v: 1 } };
}

/**
 * Confirma que el latido **sí** se ha escrito, y solo entonces mueve el reloj.
 *
 * **LA MITAD QUE NO SE PUEDE OLVIDAR.** Quien llama a `campoLatido()` recibe un campo y
 * tiene que escribirlo; si la escritura falla, **el reloj no se mueve** y el siguiente
 * latido se vuelve a intentar. Es lo contrario de lo que hace un "optimista", que da el
 * campo por bueno antes de saber si llegó al servidor.
 */
export function confirmarLatido(): void {
  ultimoLatidoEscrito = Date.now();
}

export async function anotarLatido(uid: string, miId: string): Promise<void> {
  const campo = campoLatido(uid, miId);
  try {
    // **UN CAMPO, Y CON MERGE.** Va dentro de la partida porque es el unico sitio
    // donde las reglas ya dejan escribir, pero `merge: true` con una sola clave
    // anidada no puede tocar nanitas ni inventario: Firestore fusiona por el primer
    // nivel, asi que lo unico que se reemplaza es el mapa `sesion` entero.
    //
    // **`campo` PUEDE SER `null`, Y ESO ES EL ARREGLO.** Si el guardado acaba de
    // escribir el latido, esta escritura **no se hace**: se salta entera, y con ella se
    // ahorra una de las que más gastaba. La comprobación va **aquí y no dentro del
    // `setDoc`** porque el coste es el viaje, no los campos: un `setDoc` con `merge` de
    // un mapa vacío sigue siendo una escritura y Firestore la cobra igual.
    if (campo) {
      await conTiempoLimite(setDoc(
        doc(db, 'users', uid),
        campo,
        { merge: true }
      ), PLAZO_DE_LECTURA_MS, 'anotarLatido');
      // F96 · Junto a la confirmación del reloj: lo que no se escribió no se cuenta.
      contarOp('escritura', 'users', 'latido');
      // **SOLO AQUÍ, Y SOLO SI NO HA LANZADO.** El reloj se mueve después de la
      // escritura, no antes: si el `setDoc` falla, el siguiente latido tiene que volver a
      // intentarlo, porque el cerrojo **no** se ha refrescado.
      confirmarLatido();
    }
  } catch (e) {
    console.warn('[sesion] No se ha podido anotar el latido.', e);
  }
}

/**
 * Suelta la cuenta al cerrar.
 *
 * **Solo borra si el latido es el NUESTRO.** Si el jugador tiene dos pestañas
 * (cada una con su id) y una cierra, no puede llevarse por delante el latido de
 * la otra: la que sigue abierta se encontraría sin sesión al volver a mirar.
 *
 * Por eso el borrado es condicional y se hace en dos pasos: se comprueba que el
 * `dispositivo` guardado siga siendo el nuestro y solo entonces se borra el
 * campo. Es una comprobación previa, no una transacción, así que hay una ventana
 * mínima de carrera; se acepta porque el reloj de `VENTANA_MS` la cubre igual.
 */
export async function soltarSesion(uid: string, miId: string): Promise<void> {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await conTiempoLimite(getDoc(ref), PLAZO_DE_LECTURA_MS, 'soltarSesion');
    contarOp('lectura', 'users', 'soltar-sesion');
    if (!snap.exists()) return;
    const sesion = (snap.data() as any)?.sesion;
    if (!sesion) return;
    if (sesion.dispositivo !== miId) return;
    // Se borra el mapa entero y no sus dos campos: con `update` un mapa anidado se
    // reemplaza, no se fusiona, asi que esto es lo unico que deja la partida sin rastro
    // de la sesion.
    await updateDoc(ref, { sesion: deleteField() });
    // F96 · Soltar el cerrojo también es una escritura, aunque sea al cerrar.
    contarOp('escritura', 'users', 'soltar-sesion');
  } catch (e) {
    // Al cerrar la pestaña puede que la red ya no esté. El reloj de expiración
    // es la red de seguridad: aunque esto falle, la cuenta se libera sola.
    console.warn('[sesion] No se ha podido soltar la sesion.', e);
  }
}

/**
 * F104 · LA PRESENCIA SE HA IDO, Y CON ELLA ESTE BLOQUE.
 *
 * El punto verde del ranking costaba una escritura cada cinco minutos por
 * pestaña para pintar algo que nadie necesita para jugar. Mirar la tabla
 * sigue siendo gratis (lecturas con caché); saber si alguien está jugando
 * ahora mismo, no hay forma de saberlo sin pagarlo, y se decidió no pagarlo.
 * Lo que queda del "en línea" es el cerrojo, que es lo único que lo necesita.
 */
