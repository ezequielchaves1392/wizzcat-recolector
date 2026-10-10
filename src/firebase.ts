import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import {
  CLAVE_SERVIDOR,
  leerParametroServidor,
  resolverServidor,
  type ServidorId
} from './data/servidores';

// ==========================================================================
//  DOS SERVIDORES, UNA SOLA APP
//
//  El juego corre en dos proyectos de Firebase distintos, con jugadores
//  distintos en cada uno: `chronos-tap` (servidor 1, el de siempre) y
//  `pet-project-aef10` (servidor 2, jugadores nuevos). Cada CARGA apunta a uno
//  solo, y lo elige el jugador en la primera pantalla, ANTES del acceso.
//
//  POR QUÉ EN LA CARGA Y NO CON UN SELECTOR EN CALIENTE. `auth` y `db` son los
//  singletons que importa todo el proyecto: un cambio de servidor sin recargar
//  obligaría a dos sesiones vivas a la vez (dos auth, dos escrituras, dos
//  rankings) y a decidir en cada servicio cuál manda. Elegir y recargar no
//  tiene ese problema: cada carga tiene un solo backend, como hasta ahora, y
//  la recarga solo ocurre al elegir o al cambiar, nunca jugando.
//
//  POR QUÉ SE GUARDA LA ELECCIÓN. Para no preguntarla en cada visita: lo
//  elegido ayer vale hoy, y el acceso lo dice con una pastilla y un botón de
//  cambiar. Un enlace con `?servidor=2` manda sobre lo guardado, porque es
//  una decisión de ahora mismo.
//
//  POR QUÉ EL BUILD SIGUE TENIENDO VALOR POR DEFECTO. Un despliegue viejo con
//  `VITE_FIREBASE_SERVIDOR=2` y un jugador con sesión recordada pero sin
//  elección guardada tienen que seguir entrando donde estaban: la serie es
//  no haber decidido nunca, y solo decide cuando nada más lo hace (mismo
//  criterio opt-in que `VITE_EMULADOR` en B31).
//
//  LA REGLA DE QUÉ VALE VIVE EN `data/servidores.ts`, no aquí: este fichero
//  solo lee el navegador y le pasa lo leído. Dos sitios decidiendo lo mismo
//  acaban diciendo cosas distintas, y eso aquí es perder la partida de vista.
//  LO QUE UN PROYECTO NUEVO NECESITA ANTES DEL PRIMER JUGADOR (no viene solo):
//    1. Auth con el proveedor de correo y contraseña activado.
//    2. Una base de datos Firestore creada.
//    3. Las reglas publicadas en ESE proyecto:
//       `firebase deploy --only firestore:rules --project pet-project-aef10`
//       (o `npm run rules:server2`). Sin esto, el juego arranca y no guarda nada.
//    4. El documento `admins/{uid}` del admin, o la terminal no concede nada.
//  Los datos no migran: cada servidor empieza con sus jugadores desde cero,
//  que es lo pedido.
//
//  ANALYTICS, Y POR QUÉ NO ESTÁ. La plantilla de Firebase trae `getAnalytics`
//  y el `measurementId` viaja en las dos configs, pero el juego no lo usa: sin
//  una pantalla o decisión que lo lea, es peso muerto con acceso a la red.
// ==========================================================================

const CONFIG_SERVIDOR_1 = {
       apiKey: "AIzaSyDe2OtAdDFWOml4v6EuISnPhYI-0xx8kOU",
       authDomain: "chronos-tap.firebaseapp.com",
       databaseURL: "https://chronos-tap-default-rtdb.firebaseio.com",
       projectId: "chronos-tap",
       storageBucket: "chronos-tap.firebasestorage.app",
       messagingSenderId: "755222927108",
       appId: "1:755222927108:web:82744c3626e7a125c92251",
       measurementId: "G-WGZLCFN2GH"
     };

const CONFIG_SERVIDOR_2 = {
       apiKey: "AIzaSyBR0R04751C2ytAjkIYTcFJ2NMDOUS0wCw",
       authDomain: "pet-project-aef10.firebaseapp.com",
       databaseURL: "https://pet-project-aef10-default-rtdb.firebaseio.com",
       projectId: "pet-project-aef10",
       storageBucket: "pet-project-aef10.firebasestorage.app",
       messagingSenderId: "1095832691858",
       appId: "1:1095832691858:web:715bcdfa2da1fbd51bb24b",
       measurementId: "G-BDWWK5K0R4"
     };

const CONFIG_POR_SERVIDOR = {
  '1': CONFIG_SERVIDOR_1,
  '2': CONFIG_SERVIDOR_2
} as const;

/**
 * F103 · EL SERVIDOR DE ESTA CARGA, Y POR QUÉ SE LEE AQUÍ.
 *
 * El enlace manda sobre lo guardado y lo guardado sobre la serie del build:
 * la decisión en sí (`resolverServidor`) vive en `data/servidores.ts` y aquí
 * solo se lee el navegador. Si el enlace trae un servidor, se guarda, para
 * que las recargas de esta visita no vuelvan a preguntar.
 *
 * Todo va en `try/catch` porque esto corre al evaluar el módulo: un
 * `localStorage` bloqueado (modo privado) no puede impedir que el juego
 * arranque, solo que recuerde.
 */
function servidorDeEsteArranque(): ServidorId {
  let param: ServidorId | null = null;
  try {
    param = leerParametroServidor(location.search);
  } catch { /* sin URL legible no hay enlace que obedecer */ }
  let guardado: unknown = null;
  try {
    guardado = localStorage.getItem(CLAVE_SERVIDOR);
  } catch { /* modo privado: sin recuerdo, como recién llegado */ }
  const porDefecto: ServidorId =
    import.meta.env.VITE_FIREBASE_SERVIDOR === '2' ? '2' : '1';
  const elegido = resolverServidor(param, guardado, porDefecto);
  if (param !== null) {
    try {
      localStorage.setItem(CLAVE_SERVIDOR, param);
    } catch { /* el enlace ya decidió esta carga aunque no se guarde */ }
  }
  return elegido;
}

const SERVIDOR_DE_ARRANQUE = servidorDeEsteArranque();

const firebaseConfig = CONFIG_POR_SERVIDOR[SERVIDOR_DE_ARRANQUE];

/**
 * F103 · QUÉ SERVIDOR ES ESTA CARGA, Y POR QUÉ UNA CONSTANTE Y NO UNA FUNCIÓN.
 *
 * Sale del mismo sitio que elige la config de arriba, así que no hay dos
 * sitios que puedan decir servidores distintos: lo que se cobra y lo que se
 * enseña en la pastilla del acceso son el mismo. La elección del jugador
 * vive en `data/servidores.ts`; esto solo dice el resultado para esta carga.
 */
export const SERVIDOR_ACTUAL: ServidorId = SERVIDOR_DE_ARRANQUE;


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

/**
 * `initializeFirestore`, no `getFirestore`, por UNA opción.
 *
 * **UN `undefined` EN CUALQUIER CAMPO HACE QUE FIRESTORE RECHACE EL DOCUMENTO
 * ENTERO.** No es un aviso ni una omisión: la escritura falla, y con ella se va
 * la partida entera. Y en este juego los items vienen de tres sitios que **ponen y
 * quitan campos**: la ruleta, las migraciones de partidas viejas y el guardado. Un
 * item de antes de los potenciales no tiene `potential`; uno de antes del tope de
 * reventa no tiene `sellPriceTope`; uno nuevo tiene los dos. Con la opción puesta
 * aquí, el campo que falta simplemente no se escribe y el resto llega igual.
 *
 * Es la diferencia entre "un item al que le falta un número" y "todo el progreso".
 * Va **una vez, aquí**, porque en el SDK modular no es una opción por escritura: es
 * una configuración de la instancia. Escribirla en cada `setDoc` además de no
 * compilar.
 */
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

/**
 * B31 · EL EMULADOR DE FIRESTORE, Y POR QUÉ ESTÁ EN `firebase.ts` Y NO EN UN `.env`.
 *
 * **EL PROBLEMA QUE RESUELVE, Y ES DINERO REAL.** El emulador estaba **declarado** en
 * `firebase.json` desde el principio y **nadie lo conectaba**: `connectFirestoreEmulator` no
 * aparecía en todo `src/`. O sea que **cada `npm run dev` con la cuenta de verdad escribía
 * en el proyecto de producción**, y todo lo gastado ahí salía de la misma cuota de 20.000
 * que se comparten los jugadores. Recargar para probar una cosa no cuesta 5 escrituras,
 * cuesta 5 del presupuesto del día.
 *
 * **POR QUÉ UNA VARIABLE DE ENTORNO Y NO UNA CONSTANTE.** Porque la condición tiene que ser
 * **imposible de activar por accidente**, y una constante en el código se puede cambiar sin
 * querer en un commit y **subir a producción**: el juego apuntaría al emulador de la
 * máquina de quien compiló y **la partida de todos iría a un cubo en localhost**. Con una
 * variable de entorno hay **dos** condiciones, y las dos tienen que cumplirse.
 *
 * **LAS DOS CONDICIONES, Y CADA UNA IMPIDE UNA COSA DISTINTA:**
 *
 *   1. `import.meta.env.DEV` — **solo en desarrollo**. Esta sola ya impide el desastre:
 *      un build de producción **jamás** habla con el emulador, aunque la variable esté
 *      puesta en la máquina de quien compila. **Producción no tiene cuesta abajo.**
 *   2. `import.meta.env.VITE_EMULADOR === '1'` — **hay que pedirlo a mano**. Sin esto,
 *      cualquier `npm run dev` se apuntaría al emulador y quien quisiera probar contra el
 *      proyecto real **no podría**.
 *
 * **POR QUÉ ESTÁ EN `firebase.ts` Y NO EN CADA SERVICIO.** `connectFirestoreEmulator` se
 * llama **una vez por instancia**, y hay una sola instancia (`db`). Si se conectara en un
 * servicio, el orden de los `import` decidaría si los demásHan conecta o no, y eso es un
 * fallo que **depende del grafo de módulos**: funciona hoy y se rompe con un import nuevo.
 * Aquí es imposible, porque **aquí se crea la instancia**.
 *
 * **CÓMO SE USA.** Con el emulador del proyecto levantado:
 *
 * ```
 * $env:VITE_EMULADOR="1"; npm run dev
 * ```
 *
 * El emulador no tiene reglas de seguridad por defecto ni datos: es una base de datos
 * vacía. Para probar contra el proyecto de verdad, **sin poner la variable**.
 */
if (import.meta.env.DEV && import.meta.env.VITE_EMULADOR === '1') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  // **AUTH TAMBIÉN, Y POR QUÉ NO PUEDE DEJARSE FUERA.** El juego entra con correo y
  // contraseña (`signInWithEmailAndPassword`). Si solo se conectara Firestore, el emulador
  // aceptaría las escrituras pero **el acceso seguiría yendo al proyecto real**: se
  // entraría con la cuenta de verdad y se guardaría en el cubo. Eso es **peor que no
  // tener emulador**, porque parece que funciona y en realidad **mezcla dos bases de
  // datos**. Los dos van juntos o no va ninguno.
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  console.info('[firebase] Emulador conectado (Firestore 8080, Auth 9099). Los datos NO se guardan.');
}
