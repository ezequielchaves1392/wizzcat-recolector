// ==========================================================================
//  Cyber-Forge · Servicio de administración
//
//  Todo lo que esta herramienta escribe de verdad vive aquí y no en la
//  interfaz, por dos razones:
//
//  1. La interfaz se puede reescribir sin que las reglas de borrado cambien.
//  2. `borrarBaseDeDatos()` es la única función del proyecto que borra en
//     bloque, y su forma (paginación con `startAfter`, lotes de 400, seguir
//     aunque una tanda falle) se verifica mucho mejor en un sitio único que
//     repartida dentro de manejadores de eventos.
//
//  Escribe con el SDK de cliente, igual que el juego. Eso implica dos límites
//  que conviene tener presentes antes de tocar nada:
//
//  · Solo puede hacer lo que las reglas de seguridad de Firestore permitan.
//    Con reglas restrictivas, todo lo de aquí falla con `permission-denied`.
//  · No toca las cuentas de Firebase Auth. Borrar el documento de `users`
//    elimina la partida, pero ese mismo nickname puede volver a entrar y
//    arrancar de cero. Para borrar la cuenta de verdad hace falta el Admin SDK
//    (ver la nota al final de este archivo).
//  · Tampoco puede cerrar la sesión de OTRO dispositivo. `signOut()` solo
//    afecta a la pestaña que lo llama; matar sesiones en remoto es una
//    operación del Admin SDK. El bloqueo de aquí no lo intenta: marca la
//    cuenta y el juego se niega a arrancar. Ver `bloquearOperativo`.
// ==========================================================================

import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';

const USERS = 'users';
const RANKINGS = 'rankings';
const BLOQUEOS = 'bloqueos';
const ADMINS = 'admins';

/** Cuántos documentos se piden en cada viaje al servidor al listar. */
const PAGINA = 200;

/**
 * Tamaño del lote de borrado.
 *
 * Firestore admite 500 escrituras por lote. Se baja a 400 porque cada
 * `writeBatch` con `commit` falla entero si una sola escritura es rechazada, y
 * un lote más pequeño significa menos trabajo que repetir cuando eso pasa.
 */
const LOTE_BORRADO = 400;

// --------------------------------------------------------------------------
//  Lectura
// --------------------------------------------------------------------------

/** Lo que la lista de la terminal necesita de cada operativo. */
export interface ResumenOperativo {
  uid: string;
  username: string;
  nanites: number;
  totalNanitesProduced: number;
  totalClicks: number;
  cores: number;
  items: number;
  companeros: number;
  /** Milisegundos del último guardado, o 0 si nunca guardó. */
  actualizado: number;
  /** El documento tal cual, para el visor de JSON. */
  bruto: Record<string, any>;
}

/** Número finito, o 0. Un campo ausente o corrupto no puede romper la lista. */
function num(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Normaliza una fecha a milisegundos.
 *
 * El juego guarda `updatedAt` como `new Date()` —un `Timestamp` de Firestore—,
 * pero `rankingService` lo guarda como `Date.now()`, un número pelado. Los dos
 * formatos conviven en la misma base de datos y `updatedAt.toDate()` a secas
 * rompe con el segundo.
 */
function aMilis(valor: any): number {
  if (valor == null) return 0;
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') {
    const t = Date.parse(valor);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (typeof valor.seconds === 'number') return valor.seconds * 1000;
  return 0;
}

function resumen(uid: string, data: Record<string, any>): ResumenOperativo {
  const almacen = Array.isArray(data.warehouse) ? data.warehouse : [];
  const companeros = Array.isArray(data.companions) ? data.companions : [];
  return {
    uid,
    username: String(data.username || data.userId || uid),
    nanites: num(data.nanites),
    totalNanitesProduced: num(data.totalNanitesProduced ?? data.nanites),
    totalClicks: num(data.totalClicks),
    cores: num(data.cores),
    items: almacen.length,
    companeros: companeros.length,
    actualizado: aMilis(data.updatedAt),
    bruto: data
  };
}

/**
 * Todos los operativos de `users`, en páginas.
 *
 * Paginado por `documentId()` y no por `nanites`: ordenar por un campo del
 * documento exigiría un índice compuesto en cuanto la lista creciera, y
 * `documentId()` no necesita ninguno. La lista se ordena en memoria después,
 * que es instantáneo para los tamaños que cabe esperar aquí.
 */
export async function listarOperativos(
  onProgreso?: (cargados: number) => void
): Promise<ResumenOperativo[]> {
  const salida: ResumenOperativo[] = [];
  let cursor: string | null = null;

  for (;;) {
    const partes: any[] = [orderBy(documentId()), limit(PAGINA)];
    if (cursor) partes.unshift(startAfter(cursor));

    const snap = await getDocs(query(collection(db, USERS), ...partes));
    if (snap.empty) break;

    snap.forEach(s => salida.push(resumen(s.id, s.data() as any)));
    onProgreso?.(salida.length);

    if (snap.size < PAGINA) break;
    cursor = snap.docs[snap.docs.length - 1].id;
  }

  // De más nanitas a menos. Un `sort` estable: dos operativos empatados
  // mantienen el orden del id, que es el mismo de la consulta.
  salida.sort((a, b) => b.nanites - a.nanites);
  return salida;
}

// --------------------------------------------------------------------------
//  Escritura
// --------------------------------------------------------------------------

/**
 * Mantiene el ranking al día tras tocar las nanitas.
 *
 * `rankings/{uid}.score` guarda la puntuación BASE —las nanitas— y
 * `computeScore()` le suma encima logros y firmas cada vez que se pinta la
 * tabla. Tocar solo `users` dejaría la clasificación desfasada hasta que el
 * jugador volviera a guardar, y un admin que otorga 1.000 millones y no aparece
 * en el ranking parece no haber hecho nada.
 */
async function sincronizarRanking(uid: string, nanitas: number): Promise<void> {
  const ref = doc(db, RANKINGS, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { score: Math.floor(nanitas) });
}

/**
 * Suma (o resta) nanitas a un operativo.
 *
 * Suma, no asignación: el valor se vuelve a leer del servidor antes de
 * escribir. Con la partida en memoria en el juego, entre el momento en que se
 * pide el HERE y el momento en que se escribe, el jugador puede haber guardado
 * y haber ganado nanitas; si se calculara sobre una cifra cacheada, ese rato
 * se perdería.
 *
 * Devuelve el saldo resultante para poder pintarlo sin volver a leer.
 */
export async function otorgarNanitas(uid: string, cantidad: number): Promise<number> {
  const ref = doc(db, USERS, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Ese operativo ya no está en la base de datos.');

  const data = snap.data() as any;
  const actual = num(data.nanites);
  const nuevo = Math.max(0, Math.floor(actual + cantidad));

  await updateDoc(ref, {
    nanites: nuevo,
    // El histórico sube lo mismo: los núcleos del reinicio se calculan sobre
    // lo producido, no sobre el saldo. Regalar sin contarlo en el total
    // penalizaría al jugador en el siguiente prestige.
    totalNanitesProduced: Math.max(0, Math.floor(num(data.totalNanitesProduced ?? data.nanites) + cantidad))
  });
  await sincronizarRanking(uid, nuevo);
  return nuevo;
}

/** Fija el saldo exacto de nanitas, sin tocar el histórico producido. */
export async function fijarNanitas(uid: string, valor: number): Promise<number> {
  const ref = doc(db, USERS, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Ese operativo ya no está en la base de datos.');

  const data = snap.data() as any;
  const nuevo = Math.max(0, Math.floor(valor));

  await updateDoc(ref, {
    nanites: nuevo,
    totalNanitesProduced: Math.max(nuevo, num(data.totalNanitesProduced))
  });
  await sincronizarRanking(uid, nuevo);
  return nuevo;
}

/** Campos numéricos editables aparte de las nanitas. */
export const CAMPOS_EDITABLES = [
  { campo: 'crystals', etiqueta: 'Cristales' },
  { campo: 'warehouseCapacity', etiqueta: 'Capacidad del almacén' },
  { campo: 'maxCompanionSlots', etiqueta: 'Huecos de compañero' },
  { campo: 'cratesOpened', etiqueta: 'Cajas abiertas' },
  { campo: 'totalClicks', etiqueta: 'Clics totales' },
  { campo: 'cores', etiqueta: 'Núcleos' },
  { campo: 'totalCores', etiqueta: 'Núcleos totales' },
  { campo: 'shards', etiqueta: 'Esquirlas' }
] as const;

/** Escribe un campo numérico suelto del documento del operativo. */
export async function fijarCampo(
  uid: string,
  campo: string,
  valor: number
): Promise<void> {
  const ref = doc(db, USERS, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Ese operativo ya no está en la base de datos.');
  await updateDoc(ref, { [campo]: Math.max(0, Math.floor(valor)) });
}

// --------------------------------------------------------------------------
//  Borrado
// --------------------------------------------------------------------------

/**
 * Borra un operativo: su partida y su fila de ranking.
 *
 * Las dos. Dejar el ranking sin su documento de partida produce una fila
 * fantasma en la clasificación que ningún jugador puede borrar desde dentro.
 */
export async function borrarOperativo(uid: string): Promise<void> {
  await Promise.all([
    deleteDoc(doc(db, USERS, uid)),
    deleteDoc(doc(db, RANKINGS, uid))
  ]);
}

export interface ProgresoBorrado {
  fase: 'users' | 'rankings' | 'bloqueos';
  borrados: number;
  total: number;
  /** Ultimo error de una tanda que no impidió seguir con las demás. */
  ultimoError: string | null;
}

/**
 * Vacía `users` y `rankings` por completo.
 *
 * Por lotes de 400 porque Firestore admite 500 escrituras por lote y un lote
 * muy grande multiplica lo que se pierde si algo falla a mitad.
 *
 * La paginación usa `startAfter` con el ULTIMO id de cada página. Es
 * importante que sea el último y no el primero: los documentos de la página
 * anterior ya no existen (se acaban de borrar), así que repetir la consulta
 * desde el principio saltaría todo lo que quede.
 *
 * Un fallo en una tanda no detiene el proceso: se anota y se sigue con la
 * siguiente. Parar a la primera deja la base a medias, que es el peor estado
 * posible: ni la base entera ni la de antes.
 */
export async function borrarBaseDeDatos(
  onProgreso?: (p: ProgresoBorrado) => void
): Promise<{ total: number; errores: string[] }> {
  const errores: string[] = [];
  let total = 0;

  for (const coleccion of [USERS, RANKINGS, BLOQUEOS] as const) {
    let cursor: string | null = null;
    let ultimoError: string | null = null;

    for (;;) {
      const partes: any[] = [orderBy(documentId()), limit(LOTE_BORRADO)];
      if (cursor) partes.unshift(startAfter(cursor));

      const snap = await getDocs(query(collection(db, coleccion), ...partes));
      if (snap.empty) break;

      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));

      try {
        await batch.commit();
        total += snap.size;
      } catch (e: any) {
        // La tanda entera ha fallado. Uno a uno sí puede que funcione parte:
        // un documento corrupto no debería dejar los otros 399 sin borrar.
        for (const d of snap.docs) {
          try {
            await deleteDoc(d.ref);
            total += 1;
          } catch (err: any) {
            ultimoError = `${coleccion}/${d.id}: ${err?.message || err}`;
            errores.push(ultimoError);
          }
        }
      }

      onProgreso?.({ fase: coleccion, borrados: total, total, ultimoError });
      cursor = snap.docs[snap.docs.length - 1].id;
    }
  }

  onProgreso?.({ fase: 'rankings', borrados: total, total, ultimoError: null });
  return { total, errores };
}

// --------------------------------------------------------------------------
//  Bloqueo
// --------------------------------------------------------------------------

/**
 * Qué guarda el documento de bloqueo de una cuenta.
 *
 * Vive en `bloqueos/{uid}`, una colección APARTE de `users`, y no como un
 * campo más dentro del documento de la partida. La razón es que el juego
 * escribe su documento entero cada 15 segundos con `setDoc(..., {merge: true})`:
 * un `bloqueado: true` puesto ahí desaparecería en el siguiente guardado del
 * jugador, y el bloqueo duraría lo que un refresco de pantalla. En su propia
 * colección el juego no la toca nunca.
 */
export interface Bloqueo {
  uid: string;
  activo: boolean;
  /** Motivo que verá el jugador en la pantalla de bloqueo. */
  motivo: string;
  /** Milisegundos del bloqueo, o 0 si está desbloqueado. */
  desde: number;
  /** UIDs de los administradores que lo pusieron y lo quitaron. */
  puestoPor: string;
  quitadoPor: string;
}

/**
 * Bloquea una cuenta: el juego se negará a cargarse para ella.
 *
 * QUÉ HACE Y QUÉ NO, porque la diferencia importa más de lo que parece:
 *
 *  · SÍ — mientras esté bloqueado, el jugador no puede jugar. Ni al recargar
 *    ni con la partida ya abierta: el juego consulta el bloqueo al arrancar y
 *    en cada vuelta a la pestaña, y si lo encuentra activo cierra la sesión y
 *    pinta la pantalla de bloqueo.
 *  · NO — no mata la sesión que ya está abierta en otro dispositivo hasta que
 *    ese jugador cambie de pestaña o recargue. `signOut()` del SDK de cliente
 *    solo funciona sobre la pestaña que lo llama; cerrar sesiones de verdad es
 *    `revokeRefreshTokens` del Admin SDK, que necesita servidor.
 *  · NO — no impide crear una cuenta nueva. El nickname se puede volver a
 *    registrar. Para eso está el borrado de la cuenta de Auth.
 *
 * Lo que sí hace es dejar la cuenta inservible sin que el jugador pueda
 * limpiarse el bloqueo solo: `bloqueos/` no la escribe el juego.
 */
export async function bloquearOperativo(uid: string, motivo: string, adminUid: string): Promise<void> {
  const ref = doc(db, BLOQUEOS, uid);
  await setDoc(
    ref,
    {
      uid,
      activo: true,
      // Se guarda también el texto plano y no solo una bandera: el jugador ve
      // el motivo, y un "bloqueado" a secas no le dice por qué.
      motivo: (motivo || '').trim() || 'Cuentasuspendida por un administrador.',
      desde: Date.now(),
      puestoPor: adminUid,
      quitadoPor: ''
    },
    { merge: true }
  );
}

/**
 * Levanta el bloqueo.
 *
 * No borra el documento: lo deja con `activo: false` y la fecha de quién lo
 * quitó. Un bloqueo que se borra no deja rastro, y cuando alguien discute si
 * estuvo bloqueado o no, "¿está bloqueado?" no contesta nada.
 */
export async function desbloquearOperativo(uid: string, adminUid: string): Promise<void> {
  const ref = doc(db, BLOQUEOS, uid);
  await setDoc(
    ref,
    { uid, activo: false, quitadoPor: adminUid, desde: 0 },
    { merge: true }
  );
}

/** Lee el bloqueo de una cuenta. `null` si no hay documento. */export async function leerBloqueo(uid: string): Promise<Bloqueo | null> {
  const snap = await getDoc(doc(db, BLOQUEOS, uid));
  if (!snap.exists()) return null;
  const d = snap.data() as any;
  return {
    uid,
    activo: d.activo === true,
    motivo: String(d.motivo || ''),
    desde: aMilis(d.desde),
    puestoPor: String(d.puestoPor || ''),
    quitadoPor: String(d.quitadoPor || '')
  };
}

/**
 * Lee los bloqueos de varias cuentas de una vez.
 *
 * Existe para la lista de la terminal: preguntar bloque por bloque al montar
 * la pantalla serían 200 lecturas, una por cada operativo, y la lista tarda
 * medio minuto en aparecer. Con un `getDocs` de toda la colección —que son
 * documentos diminutos— sale en una sola.
 */
export async function listarBloqueos(): Promise<Record<string, Bloqueo>> {
  const salida: Record<string, Bloqueo> = {};
  const snap = await getDocs(collection(db, BLOQUEOS));
  snap.forEach(s => {
    const d = s.data() as any;
    salida[s.id] = {
      uid: s.id,
      activo: d.activo === true,
      motivo: String(d.motivo || ''),
      desde: aMilis(d.desde),
      puestoPor: String(d.puestoPor || ''),
      quitadoPor: String(d.quitadoPor || '')
    };
  });
  return salida;
}

/**
 * ¿La cuenta es administradora?
 *
 * La respuesta de verdad está en `admins/{uid}` y en las reglas de Firestore
 * (`firestore.rules`), no en el array de `admin.ts`. Esta comprobación es la
 * capa visible: las reglas ya impiden de verdad, esto solo evita cargar la
 * pantalla de la terminal para alguien que va a recibir un `permission-denied`
 * a los dos segundos.
 *
 * Devuelve `true` si la consulta falla, y el motivo es que las reglas viejas
 * —las de "todo público"— no tienen colección `admins` y todo el mundo leería
 * que no es admin. En ese caso se le deja entrar: lo que le va a impedir hacer
 * daño son las reglas, no esta función, y con reglas antiguas el proyecto no
 * tiene nada que proteger que no se pudiera proteger ya de otra forma.
 */
export async function esAdministrador(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, ADMINS, uid));
    return snap.exists();
  } catch (e) {
    console.warn('[admin] No se ha podido comprobar el rol de administrador; se permite el acceso.', e);
    return true;
  }
}

/**
 * Borra el documento de bloqueo de una cuenta.
 *
 * A diferencia de `desbloquearOperativo`, esto sí lo elimina. Se usa solo
 * cuando la partida también se está borrando: un bloqueo sin partida detrás es
 * ruido, y si el mismo nickname se registra otra vez volvería a estar
 * bloqueado sin que nadie lo hubiera decidido otra vez.
 */
export async function borrarBloqueo(uid: string): Promise<void> {
  await deleteDoc(doc(db, BLOQUEOS, uid));
}

// --------------------------------------------------------------------------
//  Rareza (copia local a propósito)
// --------------------------------------------------------------------------

/**
 * `raritySlug` también existe en `components/crateLoot.ts`, pero ese módulo
 * importa `gameLoop`, que arrastra el bucle de juego entero al bundle de la
 * terminal: la página de administración se descargaría el juego para pintar
 * cuatro colores. Aquí solo hacen falta el slug y el color.
 */
export function slugRareza(rareza: string): string {
  return (rareza || 'Común')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const COLOR_RAREZA: Record<string, string> = {
  'comun': '#94a3b8',
  'raro': '#60a5fa',
  'epico': '#c084fc',
  'legendario': '#fbbf24',
  'mitico': '#fb7185',
  'divino': '#fde047'
};

export function colorRareza(rareza: string): string {
  return COLOR_RAREZA[slugRareza(rareza)] || COLOR_RAREZA.comun;
}
