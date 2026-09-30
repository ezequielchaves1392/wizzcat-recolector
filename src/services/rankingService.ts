// ==========================================================================
// Servicio de ranking
//
// El ranking pasó de "ordenar por nanitas" a "ordenar por una puntuación que
// mezcla potencia, logros y firma de autor". El cambio no es cosmético: antes
// un jugador que hubiera desbloqueado los 15 logros seguía apareciendo por
// debajo de alguien con la misma cantidad de nanitas y cero logros, y eso
// comunicaba que los logros no contaban.
//
// Fórmula de puntuación:
//   score = nanitas + logros·50.000 + secretos·250.000 + firmas·20.000
//
// Los pesos son Invention deliberados: un logro vale lo mismo que 50.000
// nanitas, así que 15 logros son 750.000. Eso iguala la partida entre "el que
// lleva una hora grindando" y "el que ha completado el juego". No es neutral,
// es una decisión de diseño, y por eso el peso vive en una constante con
// nombre en vez de repartido por el archivo.
// ==========================================================================

import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

/** Peso de cada logro público en la puntuación global. */
export const ACHIEVEMENT_WEIGHT = 50_000;
/** Un logro secreto pesa 5x: son raros y casi nadie los tiene. */
export const SECRET_ACHIEVEMENT_WEIGHT = 250_000;
/** Peso de cada arma forjada por el jugador. */
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
  cosmetics?: { title: string; frame: string; banner: string };
  updatedAt: number;
}

/** Puntuación global de una entrada. */
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
  } = {}
) {
  try {
    const userRef = doc(db, 'rankings', uid);
    await setDoc(userRef, {
      uid,
      userId: uid,
      username: username || 'Operativo_Anon',
      score: Math.floor(score),
      ...extra,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (e) {
    console.error('Error saving score to Firestore:', e);
  }
}

/**
 * Obtener el Top global.
 *
 * Se piden 40 filas aunque solo se pinten 10: la puntuación del ranking
 * incluye logros, y un jugador con pocos nanitas pero muchos logros puede
 * subir varias posiciones respecto al corte por `score`. Pedir solo 10
 * mostraría un top incoherente con las columnas nuevas.
 */
export async function getTopRankings(limitRows = 25): Promise<LeaderboardEntry[]> {
  const fallbackData: LeaderboardEntry[] = [
    { uid: 'mock_1', username: 'QuantumApex', score: 1450200, achievements: 12, secretAchievements: 0, forgedCount: 8, updatedAt: Date.now() },
    { uid: 'mock_2', username: 'NexusGrid', score: 12100, achievements: 4, secretAchievements: 1, forgedCount: 0, updatedAt: Date.now() }
  ];

  try {
    const fetchPromise = async () => {
      const q = query(collection(db, 'rankings'), orderBy('score', 'desc'), limit(40));
      const querySnapshot = await getDocs(q);
      const rows: LeaderboardEntry[] = [];
      querySnapshot.forEach((d) => rows.push({ ...(d.data() as any), uid: d.id }));
      if (rows.length === 0) return fallbackData;
      // Reordenar por la puntuación completa: el `orderBy` de Firestore solo
      // conoce nanitas.
      return rows
        .map(r => ({ ...r, score: computeScore(r) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limitRows);
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
