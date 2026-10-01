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
  return { exists: () => !!doc, data: () => doc };
};
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
  const previo = options?.merge ? db[ref.id] : undefined;
  db[ref.id] = previo ? { ...previo, ...data } : data;
};
