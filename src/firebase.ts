import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

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
