import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
       apiKey: "AIzaSyDe2OtAdDFWOml4v6EuISnPhYI-0xx8kOU",
       authDomain: "chronos-tap.firebaseapp.com",
       databaseURL: "[https://chronos-tap-default-rtdb.firebaseio.com](https://chronos-tap-default-rtdb.firebaseio.com)",
       projectId: "chronos-tap",
       storageBucket: "chronos-tap.firebasestorage.app",
       messagingSenderId: "755222927108",
       appId: "1:755222927108:web:82744c3626e7a125c92251",
       measurementId: "G-WGZLCFN2GH"
     };


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const db = getFirestore(app);