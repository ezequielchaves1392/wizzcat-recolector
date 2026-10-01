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
