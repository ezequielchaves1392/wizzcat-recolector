// ==========================================================================
//  Configuración de Vite
//
//  Existe solo por el `input` multipágina. Vite, sin configuración, construye
//  únicamente la entrada que se llama `index.html`, y la terminal de
//  administración se quedaba fuera de `dist/` sin avisar: el build terminaba
//  en verde y `admin.html` no existía.
//
//  El resto de ajustes son los de siempre a propósito: nada de plugins, alias
//  ni Formats raros. La página del juego y la terminal comparten CSS, tipos y
//  el SDK de Firebase, así que van como dos entradas del MISMO build y no como
//  dos proyectos.
//
//  OJO con `admin.html`: es una herramienta de gestión con un botón que vacía
//  la base de datos. Que se construya no significa que deba publicarse. Si esta
//  salida se sube a un servidor accesible, hay que excluirla del despliegue
//  (no publicarla) y poner reglas en Firestore que limiten las escrituras.
// ==========================================================================

import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// `import.meta.dirname` en vez de `__dirname`: en un `vite.config.ts` cargado
// de forma nativa el segundo no existe, y Vite avisa. Es el mismo apaño que
// lleva `verify/vite.config.ts`.
const aqui = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // La página del juego.
        main: resolve(aqui, 'index.html'),
        // La terminal de administración.
        admin: resolve(aqui, 'admin.html')
      }
    }
  }
});
