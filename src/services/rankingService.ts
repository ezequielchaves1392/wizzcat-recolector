import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

export interface LeaderboardEntry {
  uid: string;
  username: string;
  score: number;
  updatedAt: number;
}

// Guardar o actualizar la puntuación del jugador actual
export async function savePlayerScore(uid: string, username: string, score: number) {
  try {
    const userRef = doc(db, 'rankings', uid);
    await setDoc(userRef, {
      uid,
      username: username || 'Operativo_Anon',
      score: Math.floor(score),
      updatedAt: Date.now()
    }, { merge: true });
  } catch (e) {
    console.error('Error saving score to Firestore:', e);
  }
}

// Obtener el Top 10 global de comandantes con timeout de seguridad
export async function getTopRankings(): Promise<LeaderboardEntry[]> {
  const fallbackData: LeaderboardEntry[] = [
    { uid: 'mock_1', username: 'QuantumApex', score: 1450200, updatedAt: Date.now() },
    { uid: 'mock_2', username: 'NexusGrid', score: 12100, updatedAt: Date.now() }
  ];

  try {
    // Promesa de lectura con un timeout de 3 segundos para evitar bloqueos si Firestore no está activo
    const fetchPromise = async () => {
      const q = query(collection(db, 'rankings'), orderBy('score', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);
      const rankings: LeaderboardEntry[] = [];
      querySnapshot.forEach((doc) => {
        rankings.push(doc.data() as LeaderboardEntry);
      });
      return rankings.length > 0 ? rankings : fallbackData;
    };

    const timeoutPromise = new Promise<LeaderboardEntry[]>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), 3000)
    );

    return await Promise.race([fetchPromise(), timeoutPromise]);
  } catch (e) {
    console.warn('Usando datos de respaldo de rankings (Firestore no disponible o inactivo):', e);
    return fallbackData;
  }
}