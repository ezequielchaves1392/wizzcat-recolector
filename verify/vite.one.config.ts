// Config de un solo entry, para depurar un banco suelto sin tocar la de todos.
// Uso: npx vite build --config verify/vite.one.config.ts <entry>
import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

const sustitutos: Record<string, string> = {
  'firebase/firestore': 'firebase-firestore.ts',
  'firebase/app': 'firebase-app.ts',
  'firebase/auth': 'firebase-app.ts'
};

// **LO QUE NO HAY AQUÍ, Y ES UNA LECCIÓN.** No hay un plugin que marque `node:fs`,
// `node:path` y `node:url` como externos, aunque se probó. **Vite compila el banco sin
// saber que lo ejecuta `node`**, y resuelve los builtins como si fueran de navegador, así
// que llegan vacíos y el banco revienta con un `is not a function` que **no señala el
// motivo**. Se probaron cuatro caminos —import estático, import dinámico,
// `import.meta.dirname` y marcar los externos— y los cuatro fallaron.
//
// **LA RAZÓN DE QUE ESTO NO MOLESTE NADA ES `run.mjs`.** Ningún banco necesita leer
// ficheros: la comprobación que sí lo necesitaba (que el emulador no salga de desarrollo) está
// **en el runner**, que lo ejecuta `node` directamente y **nunca pasa por Vite**, así que
// sus imports de `node:` son de verdad. Un banco que necesite el disco **no puede
// escribirse como banco**, y eso hay que saberlo antes de perder cuatro intentos.
const sustituirFirebase = () => ({
  name: 'stub-firebase',
  enforce: 'pre' as const,
  resolveId(source: string) {
    const stub = sustitutos[source];
    return stub ? resolve(here, 'stubs', stub) : null;
  }
});

const entry = process.env.ONE_BANK ?? 'sellCheck';

export default defineConfig({
  plugins: [sustituirFirebase()],
  build: {
    outDir: resolve(here, 'out-one'),
    emptyOutDir: true,
    minify: false,
    target: 'esnext',
    lib: { entry: { [entry]: resolve(here, `${entry}.ts`) }, formats: ['es'] }
  },
  logLevel: 'warn'
});
