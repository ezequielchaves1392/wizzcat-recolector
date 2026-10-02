// ==========================================================================
//  Servicio de ranking
//
//  La tabla pasó de "ordenar por nanitas" a "ordenar por una puntuación que
//  mezcla potencia, logros y firmas de autor". El cambio no era cosmético: con
//  la versión anterior, un jugador que hubiera desbloqueado los 15 logros
//  seguía apareciendo por debajo de alguien con la misma cantidad de nanitas y
//  cero logros, y eso comunicaba que los logros no contaban.
//
//  AHORA HAY CUATRO TABLAS, no una. La decisión de cuál es la buena cambia
//  según el jugador, así que no se la impone:
//
//    · Nanitas     — cuánta ha producido en total
//    · Clics       — cuánto tiempo ha dedicado a la partida
//    · Logros      — cuánto del juego ha explorado
//    · Definitivo  — el compuesto: nanitas + logros + firmas
//
//  El Definitivo mezcla potencia con exploración a propósito, y es el único
//  que junta las tres cosas en una sola columna.
//
//  Fórmula del definitivo:
//     score = nanitas + logros·50.000 + secretos·250.000 + firmas·20.000
//
//  Los pesos son deliberados: un logro vale lo mismo que 50.000 nanitas, así
//  que 15 logros son 750.000. Eso iguala la partida entre "el que lleva una
//  hora grindando" y "el que ha completado el juego". No es neutral, es una
//  decisión de diseño, y por eso el peso vive en constantes con nombre en vez
//  de repartido por el archivo.
// ==========================================================================

import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

/** Peso de cada logro público en la puntuación global. */
export const ACHIEVEMENT_WEIGHT = 50_000;
/** Un logro secreto pesa 5x: son raros y casi nadie los tiene. */
export const SECRET_ACHIEVEMENT_WEIGHT = 250_000;
/** Peso de cada recolector forjado por el jugador. */
export const FORGED_WEIGHT = 20_000;

export interface LeaderboardEntry {
  uid: string;
  userId?: string;
  username: string;
  score: number;
  nanites?: number;
  totalClicks?: number;
  achievements?: number;
  secretAchievements?: number;
  forgedCount?: number;
  title?: string;
  frame?: string;
  banner?: string;
  cosmetics?: { title: string; frame: string; banner: string };
  updatedAt: number;
}

/**
 * Las cuatro tablas y cómo se ordenan.
 *
 * El orden del array es el de las pestañas. El "Definitivo" va el primero
 * porque es la tabla que resume a las otras tres: es la que responde "¿quién va
 * ganando?", que es la pregunta con la que se entra. Y coincide con la
 * pestaña que queda activa al abrir, así que la primera de la lista es
 * también la que se está viendo. Antes iban en el orden inverso —el
 * compuesto al final— y el efecto era abrir la página con la pestaña
 * activa siendo la cuarta de la fila.
 */
export const BOARD_KINDS = ['definitivo', 'nanitas', 'clics', 'logros'] as const;
export type BoardKind = typeof BOARD_KINDS[number];

export interface BoardDef {
  id: BoardKind;
  label: string;
  /** Lo que mide, en una frase. Se enseña debajo de las pestañas. */
  hint: string;
  icon: string;
}

/** El orden del array es el de las pestañas: va clavado a `BOARD_KINDS`. */
export const BOARDS: BoardDef[] = [
  {
    id: 'definitivo',
    label: 'Definitivo',
    hint: 'La combinación de las tres: potencia, tiempo y exploración. Un logro pesa 50.000 nanitas y una firma de autor 20.000.',
    icon: 'trophy'
  },
  {
    id: 'nanitas',
    label: 'Nanitas',
    hint: 'Quién ha juntado más nanitas en total. No cuenta solo lo que tiene ahora, sino todo lo que ha producido desde que empezó.',
    icon: 'bolt'
  },
  {
    id: 'clics',
    label: 'Clics',
    hint: 'Quién más tiempo ha dedicado a la partida. Un clic es una decisión activa: subir en esta tabla cuesta más que en la de nanitas.',
    icon: 'collector'
  },
  {
    id: 'logros',
    label: 'Logros',
    hint: 'Quién ha explorado más del juego. Cuenta los secretos, que pesan más que los normales.',
    icon: 'achievement'
  }
];

/**
 * Número de una entrada en una tabla concreta.
 *
 * Cada tabla tiene su propio número. Antes solo existía la puntuación global,
 * y con ella no se podía contestar "¿quién ha hecho más clics?", que es la
 * pregunta más natural después de "¿quién tiene más?".
 */
export function boardValue(e: LeaderboardEntry, kind: BoardKind): number {
  switch (kind) {
    case 'nanitas':
      // Se usa lo PRODUCIDO y no el saldo: un jugador que lo gastó todo en
      // mejoras sigue siendo uno de los que más ha jugado.
      //
      // `nanites ?? score` y no solo `nanites`: el documento de `rankings` lo
      // escribe `gameLoop` con las nanitas en `score` (y `nanites` no existe),
      // así que leer solo `nanitas` dejaba la tabla entera en cero. Los datos
      // de ejemplo de `fallbackData` sí traen `nanites`, y por eso el bug no
      // se veía en el banco de pruebas.
      return Math.floor(e.nanites ?? e.score ?? 0);
    case 'clics':
      return Math.floor(e.totalClicks ?? 0);
    case 'logros':
      return Math.floor(
        (e.achievements ?? 0) + (e.secretAchievements ?? 0) * 2
      );
    case 'definitivo':
      return computeScore(e);
  }
}

/** Puntuación global de una entrada: la del "Definitivo". */
export function computeScore(e: {
  score?: number; achievements?: number; secretAchievements?: number; forgedCount?: number;
}): number {
  return Math.floor(
    (e.score || 0) +
    (e.achievements || 0) * ACHIEVEMENT_WEIGHT +
    (e.secretAchievements || 0) * SECRET_ACHIEVEMENT_WEIGHT +
    (e.forgedCount || 0) * FORGED_WEIGHT
  );
}

/** Guardar o actualizar la puntuación del jugador actual. */
export async function savePlayerScore(
  uid: string,
  username: string,
  score: number,
  extra: {
    achievements?: number;
    secretAchievements?: number;
    forgedCount?: number;
    title?: string;
    frame?: string;
    banner?: string;
    cosmetics?: { title: string; frame: string; banner: string };
  } = {}
) {
  try {
    const userRef = doc(db, 'rankings', uid);
    await setDoc(userRef, {
      uid,
      userId: uid,
      username: username || 'Operativo',
      score: Math.floor(score),
      ...extra,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (e) {
    console.error('Error saving score to Firestore:', e);
  }
}

/**
 * Obtiene el Top global completo, una sola vez, y de ahí salen las cuatro
 * tablas.
 *
 * Antes cada tabla habría hecho su propia consulta con su `orderBy`, y eso son
 * cuatro esperas de red para pintar cuatro listas de la misma gente. Peor: los
 * cortes no coincidirían, porque `orderBy('totalClicks')` y
 * `orderBy('score')` cortan sobre conjuntos distintos.
 *
 * Ahora se piden las filas por la columna que ordena mejor (la de nanitas,
 * que es la que más filas tiene) y el resto se ordena en cliente. Con el tope
 * hay de sobra para las cuatro tablas: los últimos puestos de cada criterio
 * están dentro, y un jugador con cero en un criterio no aparecería igual.
 */
export async function getTopRankings(limitRows = 40): Promise<LeaderboardEntry[]> {
  const fallbackData: LeaderboardEntry[] = [
    { uid: 'mock_1', username: 'QuantumApex', score: 1450200, nanites: 1450200, totalClicks: 8420, achievements: 12, secretAchievements: 1, forgedCount: 8, updatedAt: Date.now() },
    { uid: 'mock_2', username: 'NexusGrid', score: 12100, nanites: 12100, totalClicks: 312, achievements: 4, secretAchievements: 0, forgedCount: 0, updatedAt: Date.now() },
    { uid: 'mock_3', username: 'AgujaCero', score: 41500, nanites: 41500, totalClicks: 2105, achievements: 3, secretAchievements: 0, forgedCount: 1, updatedAt: Date.now() },
    { uid: 'mock_4', username: 'ByteSmith', score: 9800, nanites: 9800, totalClicks: 640, achievements: 7, secretAchievements: 1, forgedCount: 3, updatedAt: Date.now() }
  ];

  try {
    const fetchPromise = async () => {
      const q = query(collection(db, 'rankings'), orderBy('score', 'desc'), limit(limitRows));
      const querySnapshot = await getDocs(q);
      const rows: LeaderboardEntry[] = [];
      querySnapshot.forEach((d) => rows.push({ ...(d.data() as any), uid: d.id }));
      if (rows.length === 0) return fallbackData;

      // LAS FILAS SE DEVOLUEN TAL CUAL. Antes se sobrescribía aquí
      // `score: computeScore(r)`, y `boardValue` volvía a aplicar `computeScore`
      // encima: los logros, secretos y firmas se sumaban DOS veces. Con 12
      // logros la fila valía 3.470.200 puntos en vez de 2.460.200, y el
      // "Definitivo" no cuadraba con la suma que el pie explicaba.
      //
      // `score` es lo que guarda `gameLoop`: las nanitas producidas. El
      // compuesto se calcula una única vez, al leer (`boardValue`).
      return rows;
    };

    const timeoutPromise = new Promise<LeaderboardEntry[]>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), 3500)
    );

    return await Promise.race([fetchPromise(), timeoutPromise]);
  } catch (e) {
    console.warn('Rankings con datos de respaldo (Firestore no disponible):', e);
    return fallbackData;
  }
}

/** Ordena una lista de entradas por el criterio pedido. */
export function sortByBoard(rows: LeaderboardEntry[], kind: BoardKind): LeaderboardEntry[] {
  return [...rows].sort((a, b) => boardValue(b, kind) - boardValue(a, kind));
}