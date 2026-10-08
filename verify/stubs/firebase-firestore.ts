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

/**
 * `initializeFirestore`, que `src/firebase.ts` usa en vez de `getFirestore`
 * **por una opción**: `ignoreUndefinedProperties`.
 *
 * El stub no puede leer una configuración de instancia, así que se comporta
 * **como si la opción estuviera puesta**, que es como está de verdad: el juego
 * escribe con `clonar()`, que es `JSON.parse(JSON.stringify(...))`, y eso ya
 * descarta los `undefined` en lugar de tirar el documento entero, que es
 * exactamente lo que hace Firestore con la opción activa.
 *
 * Sin la opción, un `undefined` en cualquier item del almacén **tiraría la
 * escritura entera**. Un stub que no distinguiera los dos casos dejaría pasar la
 * regresión más cara del guardado: perder la partida por un campo opcional.
 */
export const initializeFirestore = (app: any, _opciones?: unknown) => app;

/**
 * `connectFirestoreEmulator`, para que importar `firebase.ts` no reviente.
 *
 * El motivo es el mismo que el de `connectAuthEmulator` en `firebase-app.ts`, y es
 * **el mismo error de las dos veces**: el símbolo tiene que existir aunque la condición
 * que lo llama sea falsa, porque **Vite comprueba los exports al resolver el módulo, antes
 * de ejecutar una sola línea**. Sin esto, el fallo es un `Missing export` que no señala
 * que lo que falta es un stub.
 *
 * Y **graba que se llamó**, que es lo que permite comprobar en un banco que la llamada
 * existe y que **no** ocurre en producción, sin levantar un emulador.
 */
export const conectoresFirestore: string[] = [];
export const connectFirestoreEmulator = (db: any, host: string, port: number) => {
  const url = `${host}:${port}`;
  conectoresFirestore.push(url);
  (globalThis as any).__EMULADOR_FIRESTORE__ = url;
};

export const doc = (_db: any, ...path: string[]) => ({ id: path.join('/') });
export const getDoc = async (ref: any) => {
  // FALLO DE LECTURA, Y POR QUÉ HACE FALTA UN CONMUTADOR PROPIO.
  //
  // `fallar` hace fallar las ESCRITURAS, que es lo que necesita la cola de
  // pendientes. Lo que no se podía provocar era que **la carga de la partida fallara**,
  // y ese es el fallo más caro del juego: si la lectura falla, el motor se queda con
  // una partida nueva en memoria y el guardado automático la escribe encima de la
  // buena. La escritura tiene éxito, así que no falla, no avisa y nadie lo nota.
  //
  // Aquí el error lleva el texto de la cuota de Firestore a propósito, porque es el
  // caso real que pasó, y para que la prueba compruebe también que se distingue de
  // una caída de red cualquiera.
  if (globalThis.__MEM_DB__?.fallarLectura) {
    const e: any = new Error(
      '[code=resource-exhausted] Quota exceeded. Simulado para las pruebas.'
    );
    e.code = 'firestore/resource-exhausted';
    throw e;
  }
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

/**
 * CUENTA LAS ESCRITURAS, Y POR QUE HACE FALTA.
 *
 * Lo que cobra Firestore es **una escritura por documento**, no por campo, así que
 * `merge: true` con cuarenta campos sigue siendo una. Y la cuota es de 20.000 al día
 * para todo el proyecto, no para cada jugador: varias pestañas a la vez se la reparten
 * sin enterarse.
 *
 * Por eso hace falta poder mirarlas. Un cálculo de "escribimos cada quince segundos
 * así que son 240 por hora" puede estar mal y seguir pareciendo una cifra exacta;
 * contar lo que el stub ha visto de verdad no. `escrituras` es el total y `filas` solo
 * las de `rankings/`, que son las que se pueden dejar de escribir sin perder nada.
 */
export function contarEscritura(ref: any): void {
  const db = globalThis.__MEM_DB__ as any;
  if (!db) return;
  db.escrituras = (db.escrituras ?? 0) + 1;
  if (String(ref?.id ?? '').startsWith('rankings/')) db.filas = (db.filas ?? 0) + 1;
}

export const setDoc = async (ref: any, data: any, options?: { merge?: boolean }) => {
  contarEscritura(ref);
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
  //
  // **Y `fallarDoc`, PARA UNO SOLO.** El guardado del juego hace **dos**
  // escrituras —`users/{uid}` y `rankings/{uid}`— y son independientes: el
  // ranking es un documento público con reglas de seguridad propias, y fallar él
  // no es perder la partida. Sin este hook, un banco no puede comprobar la
  // diferencia entre "no se ha guardado nada" y "no se ha guardado tu posición",
  // que es exactamente la diferencia que el jugador no podía ver en el aviso.
  const fallaEste = globalThis.__MEM_DB__?.fallarDoc;
  if (globalThis.__MEM_DB__?.fallar || (fallaEste && String(ref.id).includes(fallaEste))) {
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
  const escrito = previo ? { ...previo, ...data } : { ...data };
  // `deleteField()` también en `setDoc`, porque es lo que usa el motor para **borrar**
  // un campo que el documento viejo todavía tiene: `setDoc` va con `merge`, y con
  // `merge` lo que no está en el objeto no se borra, se queda. Sin esto, el stub
  // guardaría el símbolo en el documento en vez de quitar el campo, y una prueba que
  // dice "el campo desaparece" estaría mirando un `Symbol(deleteField)` en su sitio y
  // no notaría nada.
  for (const k of Object.keys(escrito)) {
    if ((escrito as any)[k] === DELETE_FIELD) delete (escrito as any)[k];
  }
  db[ref.id] = clonar(escrito);
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
  contarEscritura(ref);
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
