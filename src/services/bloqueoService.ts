// ==========================================================================
//  Cyber-Forge · Consulta de bloqueo
//
//  La comprobación que hace el juego de si su cuenta está suspendida. Va
//  aparte de `adminService` a propósito: ese módulo importa el SDK de cliente
//  completo y arrastra laterminal entera, y el juego no tiene por qué cargar
//  la herramienta de gestión para leer un documento.
//
//  Solo se usa `getDoc`. Sin listeners: el juego consulta al arrancar y al
//  volver a la pestaña, nada más. Un `onSnapshot` abierto en segundo plano
//  sería una conexión viva gastando batería en un móvil, para enterarse de algo
//  que el jugador ya está mirando y no puede esquivar.
// ==========================================================================

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { contarOp } from './contadorOps';

export interface EstadoBloqueo {
  bloqueado: boolean;
  motivo: string;
  desde: number;
}

const SIN_BLOQUEO: EstadoBloqueo = { bloqueado: false, motivo: '', desde: 0 };

/**
 * Pregunta si la cuenta está bloqueada.
 *
 * NUNCA lanza. Un fallo de red aquí no puede tumbar el juego: si no se puede
 * comprobar el bloqueo, se deja entrar. La alternativa —dejar fuera a todo el
 * mundo cuando Firestore no responde— convertiría una caída de la red en un
 * juego entero inaccesible.
 *
 * La contrapartida es que un bloqueo puesto justo en el momento del corte de
 * red no se aplica hasta el siguiente intento. Se acepta: el jugador ya está
 * dentro, y el siguiente chequeo es al volver a la pestaña.
 */
export async function consultarBloqueo(uid: string): Promise<EstadoBloqueo> {
  try {
    const snap = await getDoc(doc(db, 'bloqueos', uid));
    // F96 · También cuenta aunque el documento no exista: Firestore la cobra igual.
    contarOp('lectura', 'bloqueos', 'bloqueo');
    if (!snap.exists()) return SIN_BLOQUEO;

    const d = snap.data() as any;
    if (d.activo !== true) return SIN_BLOQUEO;

    return {
      bloqueado: true,
      motivo: String(d.motivo || ''),
      desde: typeof d.desde === 'number' ? d.desde : 0
    };
  } catch (e) {
    console.warn('[bloqueo] No se ha podido comprobar el bloqueo; se deja entrar.', e);
    return SIN_BLOQUEO;
  }
}
