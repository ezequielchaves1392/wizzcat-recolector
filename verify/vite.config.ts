// Bundles las pruebas del game loop con Firebase sustituido por un store en
// memoria, para poder ejecutarlas con `node` sin navegador ni red.
import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

const sustitutos: Record<string, string> = {
  'firebase/firestore': 'firebase-firestore.ts',
  'firebase/app': 'firebase-app.ts',
  'firebase/auth': 'firebase-app.ts'
};

const sustituirFirebase = () => ({
  name: 'stub-firebase',
  enforce: 'pre' as const,
  resolveId(source: string) {
    const stub = sustitutos[source];
    return stub ? resolve(here, 'stubs', stub) : null;
  }
});

export default defineConfig({
  plugins: [sustituirFirebase()],
  build: {
    outDir: resolve(here, 'out'),
    emptyOutDir: true,
    minify: false,
    target: 'esnext',
    // Varios bancos en una pasada: cada uno es un entry, y `run.mjs` los
    // importa todos. Añadir uno es añadirlo aquí, no tocar el runner.
    lib: {
      entry: {
        sellCheck: resolve(here, 'sellCheck.ts'),
        equipCheck: resolve(here, 'equipCheck.ts'),
        buyCheck: resolve(here, 'buyCheck.ts'),
        filterCheck: resolve(here, 'filterCheck.ts'),
        stackCheck: resolve(here, 'stackCheck.ts'),
        potencialCheck: resolve(here, 'potencialCheck.ts'),
        loteCheck: resolve(here, 'loteCheck.ts'),
        consumableCheck: resolve(here, 'consumableCheck.ts'),
        stateCheck: resolve(here, 'stateCheck.ts'),
        lootCheck: resolve(here, 'lootCheck.ts'),
        queueCheck: resolve(here, 'queueCheck.ts'),
        guardadoCheck: resolve(here, 'guardadoCheck.ts'),
        forjaCheck: resolve(here, 'forjaCheck.ts'),
        sessionCheck: resolve(here, 'sessionCheck.ts'),
        perfilCheck: resolve(here, 'perfilCheck.ts'),
        playthroughCheck: resolve(here, 'playthroughCheck.ts'),
        toastCheck: resolve(here, 'toastCheck.ts'),
        rouletteCheck: resolve(here, 'rouletteCheck.ts'),
        tickCheck: resolve(here, 'tickCheck.ts'),
        senalCheck: resolve(here, 'senalCheck.ts'),
        balanceCheck: resolve(here, 'balanceCheck.ts'),
        desgloseCheck: resolve(here, 'desgloseCheck.ts'),
        cajasCheck: resolve(here, 'cajasCheck.ts'),
        ranuraCheck: resolve(here, 'ranuraCheck.ts'),
        tarjetaCheck: resolve(here, 'tarjetaCheck.ts'),
        saltoCheck: resolve(here, 'saltoCheck.ts'),
        identidadCheck: resolve(here, 'identidadCheck.ts'),
        loreCheck: resolve(here, 'loreCheck.ts'),
        leyendaCheck: resolve(here, 'leyendaCheck.ts'),
        // F50 · El número del contador. Nace porque F48 y F50 ya estaban hechos y
        // sin banco, y el banco encontró dos bugs que no eran de formato: el
        // separador decimal del juego y el tramo en la frontera del logaritmo.
        contadorCheck: resolve(here, 'contadorCheck.ts'),
        autoventaCheck: resolve(here, 'autoventaCheck.ts'),
        arbolLoreCheck: resolve(here, 'arbolLoreCheck.ts')
      },
      formats: ['es']
    }
  },
  logLevel: 'warn'
});
