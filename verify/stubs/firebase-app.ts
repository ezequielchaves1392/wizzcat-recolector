// `firebase/app` y `firebase/auth` no se usan para nada en el game loop: solo
// se necesitan para que `src/firebase.ts` pueda inicializarse sin red.
export const initializeApp = (config: any) => ({ config, name: 'stub' });
export const getAuth = (app: any) => app;

/**
 * `connectAuthEmulator`, para que importar `firebase.ts` no reviente.
 *
 * **POR QUÉ HAY QUE TENERLA Y POR QUÉ ES UNA TRAMPA SI NO SE PONE.** `src/firebase.ts`
 * llama a `connectAuthEmulator` **junto a** `connectFirestoreEmulator`, dentro de una
 * condición que en los bancos es falsa (`import.meta.env.DEV`). Pero **Vite hace el
 * análisis del módulo antes de llegar a la condición**, así que el símbolo tiene que
 * existir aunque nunca se ejecute: sin esta línea, `emuladorCheck` —y cualquier banco que
 * arrastre `firebase.ts`— falla con un `does not provide an export named` que **no señala
 * la causa**, que es esto.
 *
 * Y lo que hace es **grabar que se ha llamado**, que es lo que permite comprobar en un
 * banco que la línea está ahí **y que no se dispara en producción** sin necesidad de
 * levantar un emulador de verdad.
 */
export const conectoresAuth: string[] = [];
export const connectAuthEmulator = (auth: any, url: string, opts?: any) => {
  conectoresAuth.push(url);
  (globalThis as any).__EMULADOR_AUTH__ = url;
};
