// `firebase/app` y `firebase/auth` no se usan para nada en el game loop: solo
// se necesitan para que `src/firebase.ts` pueda inicializarse sin red.
export const initializeApp = (config: any) => ({ config, name: 'stub' });
export const getAuth = (app: any) => app;
