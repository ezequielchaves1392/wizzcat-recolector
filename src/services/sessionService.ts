// ==========================================================================
//  Cyber-Forge · Una sola sesión por jugador
//
//  Qué resuelve. Dos dispositivos (o dos pestañas) jugando a la vez contra el
//  mismo documento se pisan: `saveToFirebase` escribe el estado COMPLETO con
//  `setDoc(..., { merge: true })` cada 15 segundos, así que el segundo dispositivo
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
import { db } from '../firebase';

/**
 * Cuánto vive un latido sin refrescar.
 *
 * 45 segundos. Es el margen entre "cerré la pestaña" y "ya puedo volver a
 * entrar": bastante para que una recarga normal o un móvil que cambia de app no
 * se cuelen, y bastante corto para que cerrar el portátil no bloquee la cuenta
 * hasta el día siguiente.
 */
export const VENTANA_MS = 45_000;

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
    const snap = await getDoc(doc(db, 'users', uid, 'sesion'));
    if (!snap.exists()) return SIN_SESION;

    const d = snap.data() as any;
    const latido = typeof d.latido === 'number' ? d.latido : 0;
    const dispositivo = String(d.dispositivo || '');

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
 * ## Y ADEMÁS EN `rankings/{uid}`, PORQUE ES EL ÚNICO SITIO DONDE SE PUEDE LEER
 *
 * El latido de arriba va a `users/{uid}/sesion`, y **otro jugador no puede
 * leerlo**: las reglas de Firestore dan a `users/{uid}` solo a su dueño y a un
 * admin, que es exactamente lo que impide que alguien se entere de que está
 * suspendido. Por eso el estado "en línea" del ranking no puede salir de ahí.
 *
 * La segunda escritura es **parcial** —solo el campo `latido`, con `merge`— y va
 * al documento que la clasificación ya escribe de continuo. Tres razones por las
 * que no es una decisión cara:
 *
 *   · **El ritmo ya existe.** Esto corre cada quince segundos porque el latido
 *     de la sesión lo necesita; piggybackear una segunda escritura parcial en el
 *     mismo tick no añade ninguna espera ni ningún temporizador nuevo.
 *   · **Es un documento pequeño.** `merge: true` con una sola clave no reescribe
 *     el resto, así que el documento de clasificación no crece.
 *   · **Que falle no rompe nada.** Va en su propio `try`: si el ranking no se
 *     puede anotar, el juego sigue jugando y la presencia sale stale. Al revés
 *     —que la sesión no se pueda anotar— sí rompería algo, porque de eso depende
 *     la ocupacion de la cuenta, y por eso cada uno lleva su `try`.
 */
export async function anotarLatido(uid: string, miId: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', uid, 'sesion'),
      { dispositivo: miId, latido: Date.now(), v: 1 },
      { merge: true }
    );
  } catch (e) {
    console.warn('[sesion] No se ha podido anotar el latido.', e);
  }
  try {
    await setDoc(doc(db, 'rankings', uid), { latido: Date.now() }, { merge: true });
  } catch (e) {
    console.warn('[presencia] No se ha podido anotar la presencia en la clasificación.', e);
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
    const ref = doc(db, 'users', uid, 'sesion');
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    if ((snap.data() as any)?.dispositivo !== miId) return;
    await updateDoc(ref, { dispositivo: deleteField(), latido: deleteField() });
  } catch (e) {
    // Al cerrar la pestaña puede que la red ya no esté. El reloj de expiración
    // es la red de seguridad: aunque esto falle, la cuenta se libera sola.
    console.warn('[sesion] No se ha podido soltar la sesion.', e);
  }
}
