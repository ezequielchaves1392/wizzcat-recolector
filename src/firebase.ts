import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
       apiKey: "AIzaSyDe2OtAdDFWOml4v6EuISnPhYI-0xx8kOU",
       authDomain: "chronos-tap.firebaseapp.com",
       databaseURL: "https://chronos-tap-default-rtdb.firebaseio.com",
       projectId: "chronos-tap",
       storageBucket: "chronos-tap.firebasestorage.app",
       messagingSenderId: "755222927108",
       appId: "1:755222927108:web:82744c3626e7a125c92251",
       measurementId: "G-WGZLCFN2GH"
     };


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
