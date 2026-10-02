// Sustituye `firebase/firestore` en las pruebas: una "base de datos" en memoria
// con un solo documento, para poder arrancar el game loop sin red ni Firebase.
//
// `setDoc` HONRA `{ merge: true }`, igual que Firestore. No es un detalle: el
// juego guarda siempre con `merge: true`, así que en producción las claves que
// un guardado deja de escribir se quedan en el documento para siempre. Con un
// stub que las borrara, una regresión del tipo "dejamos de guardar
// `equippedCollectorId` al desequipar" pasaría inadvertida: en el stub la clave
// desaparecería y la recarga saldría limpia, mientras que en Firestore el id
// viejo seguiría ahí y volvería a equipar lo que el jugador quitó.
export const getFirestore = (app: any) => app;
export const doc = (_db: any, ...path: string[]) => ({ id: path.join('/') });
export const getDoc = async (ref: any) => {
  const doc = globalThis.__MEM_DB__?.[ref.id];
  // SE DEVUELVE UNA COPIA, y es lo que hace Firestore. Antes devolvía el objeto
  // tal cual, con lo que `__MEM_DB__` guardaba una REFERENCIA VIVA al array
  // `warehouse` del juego: un bucle que mutase su memoria reescribía el documento
  // del otro sin guardar nada. Una prueba podía entonces pasar por un estado que
  // el juego nunca escribió, y una regresión de guardado podía esconderse detrás
  // de un mutuo secreto entre dos bucles.
  return { exists: () => !!doc, data: () => (doc ? clonar(doc) : undefined) };
};

const clonar = (v: any) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export const setDoc = async (ref: any, data: any, options?: { merge?: boolean }) => {
  // FALLO PROGRAMADO.
  //
  // La cola de nanitas pendientes vive o muere de que `setDoc` falle, y su
  // único escenario interesante es exactamente ese: sin red. Con un stub que
  // siempre tiene éxito, la parte del código que más importa —el `catch`, que
  // decide si la cola sobrevive— no se ejecutaría nunca y sus pruebas pasarían
  // sin comprobar nada.
  //
  // `__MEM_DB__.fallar` se pone a true para simular la caída y a false para
  // recuperar la conexión, que es como lo hace el juego en producción con el
  // evento `online`.
  if (globalThis.__MEM_DB__?.fallar) {
    throw new Error('FirestoreError: unavailable: Sin conexión (simulado)');
  }
  // RETRASO PROGRAMADO.
  //
  // `fallar` simula la caída, pero no el tiempo que tarda un guardado en
  // viajar. Sin este hook no hay forma de provocar DOS guardados solapados, que
  // es lo que pasa en el juego real: `saveToFirebase` no se espera en treinta
  // sitios distintos y el intervalo de quince segundos la llama sin más. Aquí
  // `__MEM_DB__.retrasar` es una promesa que la prueba controla, así que puede
  // dejar un `setDoc` en el aire mientras el jugador sigue comprando.
  //
  // El hook se consulta por cada escritura y se limpia solo: `__MEM_DB__.retrasar`
  // es `undefined` en cuanto se resuelve, de modo que el segundo `setDoc` del
  // mismo guardado (el de `rankings`) no hereda el retraso.
  const espera = globalThis.__MEM_DB__?.retrasar;
  if (espera) {
    delete globalThis.__MEM_DB__.retrasar;
    await espera;
  }
  const db = globalThis.__MEM_DB__;
  // Se guarda una COPIA también al escribir. Sin esto, el documento retiene una
  // referencia al array del juego y el "guardado" de un bucle mezcla su memoria
  // con la del siguiente. Firestore serializa; el stub tiene que serializar.
  const previo = options?.merge ? db[ref.id] : undefined;
  db[ref.id] = clonar(previo ? { ...previo, ...data } : data);
};

/**
 * La marca de "borra este campo", igual que en Firestore.
 *
 * El sentinel es un símbolo, no una cadena como la de Firestore, y por eso el
 * borrado se resuelve en `updateDoc`. Un stub que lo hiciera con `"__DELETE__"`
 * se rompería en cuanto un jugador guardara ese texto en un campo, que es
 * exactamente el tipo de colisión que los stubs bien hechos evitan.
 */
export const DELETE_FIELD = Symbol('deleteField');
export const deleteField = () => DELETE_FIELD;

/**
 * Los tres verbos de consulta que el ranking importa.
 *
 * No hacen nada: el ranking se prueba con `fallbackData` y no llega a la base de
 * datos. Pero exportarlos sin implementar es lo que hace que el módulo se pueda
 * importar en un banco, que es lo que permite comprobar sus funciones puras —
 * `boardValue`, `computeScore`— contra los datos de verdad del juego en vez de
 * contra una copia.
 */
export const collection = (_db: any, path: string) => ({ path });
export const query = (...args: any[]) => ({ args });
export const orderBy = (campo: string) => ({ campo });
export const limit = (n: number) => ({ limite: n });
export const getDocs = async (_q: any) => ({ docs: [] as any[], empty: true });

/**
 * `updateDoc` con el sentinel de borrado.
 *
 * Se implementa en lugar de no exportarlo porque el borrado condicional es lo
 * que hace que soltar la sesión no se lleve por delante el latido de la otra
 * pestaña: dos pestañas abiertas en el mismo navegador, una cierra y la otra se
 * queda sin sesión al volver a mirar. Sin esto, esa parte no se puede comprobar
 * en un banco.
 */
export const updateDoc = async (ref: any, data: any) => {
  if (globalThis.__MEM_DB__?.fallar) {
    throw new Error('FirestoreError: unavailable: Sin conexión (simulado)');
  }
  const db = globalThis.__MEM_DB__;
  const previo = db[ref.id];
  if (!previo) return;
  const salida: any = { ...previo };
  for (const [k, v] of Object.entries(data)) {
    if (v === DELETE_FIELD) delete salida[k];
    else salida[k] = clonar(v);
  }
  db[ref.id] = clonar(salida);
};
