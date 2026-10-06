// ==========================================================================
//  La tarjeta pública de un jugador: leerla, publicarla y contar quién la mira
// ==========================================================================
//
//  ## POR QUÉ UNA COLECCIÓN NUEVA
//
//  Porque `users/{uid}` es la partida entera y no se abre. La tarjeta es un documento
//  que el dueño escribe a propósito con dentro solo lo que `documentoDeTarjeta()` deja,
//  y eso es lo que los demás pueden leer. Ver `data/profile.ts` para el qué y el porqué
//  de cada cosa: aquí solo está el cómo.
//
//  ## LAS REGLAS, Y POR QUÉ ESTÁN DONDE ESTÁN
//
//  En `firestore.rules`, y hay que publicarlas en la consola de Firebase antes de que
//  esto funcione: una colección nueva sin regla cae en el `match /{document=**}` que
//  cierra la puerta, que es exactamente lo que pasó con el latido de sesión.
//
//  · **Cualquiera con sesión lee.** Es un perfil público de un juego: sin sesión no,
//    porque la lista de jugadores no es un recurso de un sitio abierto.
//  · **Solo el dueño publica su tarjeta.** Y publica **todas** las claves, no una.
//  · **Y cualquiera puede tocar SOLO `visitas` y `visitantes`, y nunca en su propia
//    tarjeta.** Esa es la línea que hace que un contador de visitas no se pueda usar
//    para otra cosa: las reglas comprueban que las claves afectadas sean exactamente esas
//    dos, así que un visitante no puede reescribir la partida de nadie aunque quiera.
//
//  ## EL CONTADOR CUESTA UNA ESCRITURA POR VISITA, Y ES CONSCIENTE
//
//  Contar visits es escribir en el documento de otro, y Firestore cobra eso igual que
//  cualquier otra escritura. Con la cuota del plan gratuito, mirar cien perfiles cuesta
//  cien escrituras. Es el precio de lo que se pidió y se puede quitar en una línea
//  (quitando la llamada a `registrarVisita`), así que está aislado en su propia función
//  y no aparece en ninguna otra.

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  tarjetaDesdeEstado, documentoDeTarjeta, coaccionaTarjeta, TARJETA_VACIA,
  type TarjetaPublica
} from '../data/profile';

/** Cuántos uids distintos se guardan. Tope para que el documento no crezca sin fin. */
export const TOPE_VISITANTES = 50;

/** La colección de las tarjetas. */
const COLECCION = 'perfiles';

/** El documento de una tarjeta. */
export function refDeTarjeta(uid: string) {
  return doc(db, COLECCION, uid);
}

/**
 * Lee la tarjeta de un jugador.
 *
 * **NUNCA LANZA Y NUNCA INVENTA UNA TARJETA QUE NO SEA LA DE ESE JUGADOR.** Si el
 * documento no existe, si las reglas no han publicado todavía o si la red falla, sale
 * `null`. Un perfil que no se puede leer tiene que parecer "no hay nada", no "está
 * vacío": son dos cosas distintas y el jugador las distingue enseguida.
 */
/**
 * POR QUÉ `leerTarjeta` DEVUELVE UN MOTIVO Y NO UN `NULL`.
 *
 * Antes devolvía `null` para las dos cosas que pueden pasar, y son distintas:
 *
 *  · **`no-existe`**: el documento no está. El jugador no ha publicado tarjeta.
 *    La pantalla puede enseñar **lo que el ranking ya sabe de él** y decir que su
 *    colección no está publicada.
 *  · **`error`**: no se ha podido leer. Las reglas sin publicar, la cuota agotada, un
 *    corte de red. Aquí no hay nada que enseñar y hay que decirlo, porque el jugador
 *    tiene que distinguir "este jugador no enseña nada" de "el juego está roto".
 *
 * Con un `null` para los dos, un jugador con las reglas sin Teach publica se veía
 * exactamente igual que uno que no ha jugado nunca, y el primero es un problema mío.
 */
export type LecturaDeTarjeta =
  | { ok: true; tarjeta: TarjetaPublica }
  | { ok: false; motivo: 'no-existe' | 'permiso' | 'error' };

/**
 * ¿Es esto un permiso denegado?
 *
 * **POR QUÉ HAY QUE DISTINGUIRLO DEL RESTO DE ERRORES, Y POR QUÉ ES UN MOTIVO PROPIO.**
 *
 * El aviso de la ficha a medias decía "aparecerá en cuanto vuelva la conexión" para
 * cualquier fallo de lectura. Con un permiso denegado eso es **falso**: la conexión está
 * perfectamente y la ficha no va a volver nunca por el camino que está diciendo el aviso. El
 * jugador apaga y enciende el wifi tres veces y el aviso sigue ahí, y lo que tiene que hacer
 * es publicar las reglas de Firestore, que no es ninguna de las dos cosas.
 *
 * Un error que manda al jugador a la fuente equivocada no es un mensaje poco bueno: es
 * trabajo perdido. El fallo de permisos tiene su propia línea de aviso, y dice qué hacer.
 */
function esPermisoDenegado(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === 'permission-denied' || /insufficient permissions/i.test(String(err?.message ?? ''));
}

export async function leerTarjeta(uid: string): Promise<LecturaDeTarjeta> {
  try {
    const snap = await getDoc(refDeTarjeta(uid));
    if (!snap.exists()) return { ok: false, motivo: 'no-existe' };
    return { ok: true, tarjeta: coaccionaTarjeta(snap.data(), uid) };
  } catch (e) {
    console.warn('[perfil] No se ha podido leer la tarjeta.', e);
    return { ok: false, motivo: esPermisoDenegado(e) ? 'permiso' : 'error' };
  }
}

/**
 * Publica la tarjeta del dueño.
 *
 * Va con `merge: true` y **sin el contador**, que es de quien mira. Que falle no
 * rompe nada: el juego sigue guardando la partida, que es lo que no se puede perder, y
 * un perfil con datos de hace un rato es mil veces mejor que un perfil vacío.
 */
/**
 * La tarjeta tal y como se escribiría ahora mismo, sin escribir nada.
 *
 * **POR QUÉ ESTÁ AQUÍ Y NO LA LLAMA EL MOTOR DIRECTAMENTE.** Por un lado es la regla de
 * `data/profile.ts` y este servicio es quien la usa; y por otro, `gameLoop` no debe
 * importarla: `data/profile` arrastra el árbol y los logros, y meterlo en el motor cambia
 * el orden de inicialización de esos módulos —que se notó en los bancos, donde el resto
 * de módulos se evalúan antes que el motor—. La arista del motor a esta regla es esta
 * función y solo esta.
 */
export function tarjetaDeEstado(state: any, uid: string, username: string): TarjetaPublica {
  return tarjetaDesdeEstado(state, uid, username);
}

export async function publicarTarjeta(state: any, uid: string, username: string): Promise<void> {
  try {
    const tarjeta = tarjetaDesdeEstado(state, uid, username);
    await setDoc(refDeTarjeta(uid), documentoDeTarjeta(tarjeta), { merge: true });
  } catch (e) {
    console.warn('[perfil] No se ha podido publicar la tarjeta.', e);
  }
}

/**
 * Anota que `visitanteUid` ha mirado la tarjeta de `perfilUid`.
 *
 * ## LO QUE PIDE EL JUGADOR Y LO QUE HACE ESTA FUNCIÓN
 *
 * *"Un contador de la gente que entra a ver el perfil, que no sea yo mismo."* Son dos
 * cosas y aquí están las dos: **el dueño nunca se cuenta**, ni al abrir su propio
 * perfil ni al recargar la página, porque para eso ya tiene su pantalla; y **cada
 * persona cuenta una vez**, no una por cada vez que mira. Por eso hay dos cifras y no
 * una: `visitas` son aperturas y `visitantes` son personas distintas.
 *
 * ## POR QUÉ LEEMOS Y ESCRIBIMOS EN VEZ DE USAR `increment()`
 *
 * Porque `arrayUnion()` no tiene tope, y la lista de visitantes crecería sin límite: un
 * documento que crece con cada mirada es un documento que algún día no cabe y que
 * encarece cada lectura. Como la tarjeta **ya está leída** cuando se pinta —el que
 * mira la está viendo en pantalla—, el coste de volver a leerlo para no perder nada es
 * cero. Con dos personas mirando a la vez se pierde una de las dos sumas, y eso se
 * acepta: un contador exacto de visitas concurrentes no vale una regla más.
 *
 * ## NUNCA LANZA, Y NUNCA ESCRIBE DOS VECES
 *
 * La tarjeta del propio dueño se salta antes de nada, y el mismo `visitanteUid` dos
 * veces tampoco cuenta dos veces. Escriben una tarjeta propia con estas reglas.
 */
export async function registrarVisita(perfilUid: string, visitanteUid: string): Promise<void> {
  // **EL DUEÑO NO SE CUENTA, Y EL PRIMER FILTRO ES ESTE.** Ni una escritura, ni un
  // día que refuse: abrir tu propio perfil no es una visita de nadie.
  if (!perfilUid || !visitanteUid || perfilUid === visitanteUid) return;

  // La tarjeta **ya está leída** cuando se pinta, que es quien llama, así que volver a
  // leerla para no perder la cuenta no cuesta una red de más.
  const lectura = await leerTarjeta(perfilUid);
  // **SI NO HAY TARJETA NO SE ESCRIBE NADA.** Escribir crearía un documento con solo el
  // contador, que es lo peor que puede hacer esta función: un perfil vacío con visitas
  // contadas que parece un perfil de verdad. Mirar a alguien que no publica tarjeta no es
  // una visita a su perfil, porque su perfil no existe.
  if (!lectura.ok) return;
  const tarjeta = lectura.tarjeta;

  // **UNA PERSONA CUENTA UNA VEZ.** Mirar el mismo perfil tres veces es una visita, no
  // tres: el contador que interesa es "cuánta gente ha mirado", no "cuántas veces se ha
  // abierto una pantalla".
  const yaVisto = tarjeta.visitantes.includes(visitanteUid);
  if (yaVisto) return;

  const visitantes = [...tarjeta.visitantes, visitanteUid].slice(-TOPE_VISITANTES);
  try {
    await setDoc(refDeTarjeta(perfilUid), {
      visitas: tarjeta.visitas + 1,
      visitantes
    }, { merge: true });
  } catch (e) {
    console.warn('[perfil] No se ha podido anotar la visita.', e);
  }
}

/** La tarjeta vacía, para cuando hay que pintar algo aunque no haya datos. */
export const TARJETA_SIN_DATOS = TARJETA_VACIA;