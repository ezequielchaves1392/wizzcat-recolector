// Bundles UN solo archivo, sin Firebase, para depurar a mano.
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
    outDir: resolve(here, 'out-repro'),
    emptyOutDir: true,
    minify: false,
    target: 'esnext',
    lib: {
      entry: { reproStack: resolve(here, 'reproStack.ts') },
      formats: ['es']
    }
  },
  logLevel: 'warn'
});
