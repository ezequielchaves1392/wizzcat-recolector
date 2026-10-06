// ==========================================================================
//  LA TARJETA A MEDIAS: LO QUE EL RANKING YA SABE DE ESE JUGADOR
// ==========================================================================
//
//  ## EL PROBLEMA QUE ESTE FICHERO RESUELVE
//
//  Se tocó un nombre en el ranking, aparece el jugador, y debajo: "todavía no tiene
//  tarjeta pública". Pero **el ranking ya lo sabe todo lo que el juego publica de él**:
//  cuánto ha producido, sus clics, sus logros, sus núcleos, sus forjadas, su título, su
//  marco y su banner. Estaba en la fila que se acaba de tocar, en la pantalla de al lado.
//
//  O sea que la pantalla vacía **tira datos que ya tenemos**, y el jugador lo lee como
//  "este jugador no ha jugado" cuando en realidad sí, y lo que no ha publicado es su
//  colección. Una ficha a medias enseña lo que hay; una ficha vacía enseña una conclusión
//  que no se deduce de nada.
//
//  ## QUÉ NO SE INVENTA
//
//  **Ni los recolectores, ni los compañeros, ni los nodos, ni los logros que no sean el
//  número.** Esos datos no están en el documento de la clasificación y no hay forma de
//  deducirlos: inventar un recolector para llenar una sección sería la peor forma de
//  mentir en una pantalla comparativa. Las secciones que no se pueden rellenar **no se
//  pintan**, y se dice una sola vez por qué.
//
//  Y el motivo se dice **distinto** en los dos casos, porque obligan a hacer cosas
//  distintas: con las reglas de Firestore sin publicar, el perfil aparecerá entero en
//  cuanto su juego guarde otra vez; con un corte de red, lo que falla es la conexión.
//
//  ## POR QUÉ ESTÁ EN UN FICHERO APARTE Y NO EN LA PANTALLA
//
//  Porque es una regla —qué se puede afirmar de alguien con lo poco que hay— y porque el
//  banco tiene que poder comprobarla sin red: que de una fila de ranking no salga un
//  recolector de mentira es una afirmación sobre un objeto.

import { type TarjetaPublica, type RecolectorPublico } from '../data/profile';

/**
 * Lo que el documento de la clasificación ya sabe de un jugador.
 *
 * **ES UN SUBCONJUNTO A PROPÓSITO, ESCRITO CAMPO A CAMPO.** Si se aceptara el
 * `LeaderboardEntry` entero, esta función podría leer cualquier campo que alguien añadiera
 * al documento más adelante, y acabar mostrando un dato que nadie decidió que fuera
 * público. Con la lista explícita, añadir un campo a la clasificación **no** publica un
 * dato nuevo por accidente: hay que venir aquí a escribirlo.
 */
export interface DatosDeRanking {
  uid: string;
  username: string;
  /** Las nanitas **producidas**, que es lo que mide la clasificación. */
  score: number;
  totalClicks: number;
  achievements: number;
  secretAchievements: number;
  forgedCount: number;
  cores: number;
  title?: string;
  frame?: string;
  banner?: string;
  updatedAt?: number;
}

/** Por qué no hay tarjeta. Cambia lo que se le dice al jugador. */
/**
 * Por qué no hay ficha entera.
 *
 * **`permiso` es un motivo propio y no una variante de `error`** porque lo que hay que hacer
 * es distinto: un `error` se arregla reconectando y un permiso denegado no. Si los dos
 * compartieran texto, el jugador con las reglas sin publicar leería "aparecerá en cuanto
 * vuelva la conexión" y no volvería nunca por ahí.
 */
export type MotivoDeAusencia = 'no-existe' | 'permiso' | 'error';

/**
 * Construye la ficha con lo poco que hay.
 *
 * **`completa` es `false`**, y la pantalla lo usa para decir que la colección no está
 * publicada en vez de fingir que no tiene nada.
 */
export function tarjetaDesdeRanking(
  d: DatosDeRanking,
  uid: string,
  nombre: string,
  motivo: MotivoDeAusencia
): TarjetaPublica {
  return {
    userId: uid || d.uid,
    username: d.username || nombre || 'Operativo',
    nanitasProducidas: num(d.score),
    totalClicks: num(d.totalClicks),
    cores: num(d.cores),
    totalCores: num(d.cores),
    resets: 0,
    cajasAbiertas: 0,
    forjadas: num(d.forgedCount),
    recolectores: [] as RecolectorPublico[],
    companeros: [],
    nodosComprados: 0,
    nodosTotales: 0,
    nivelesDeArbol: 0,
    nodos: [],
    // **EL NÚMERO DE LOGROS SÍ SE SABE, LA LISTA NO.** Por eso `logros` va vacío y
    // `totalLogros` no: se puede decir "ha desbloqueado 34" sin poder decir cuáles.
    logros: [],
    totalLogros: num(d.achievements) + num(d.secretAchievements),
    cosmetics: {
      title: d.title ?? '',
      frame: d.frame ?? 'frame_none',
      banner: d.banner ?? 'banner_none'
    },
    visitas: 0,
    visitantes: [],
    updatedAt: num(d.updatedAt),
    completa: false,
    motivo
  };
}

const num = (v: any): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);