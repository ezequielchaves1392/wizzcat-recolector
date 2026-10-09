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
//  LA VARIABLE `GH_PAGES`, Y POR QUÉ CAMBIA DOS COSAS A LA VEZ.
// ==========================================================================
//  GitHub Pages sirve el repo desde un SUBCAMINO
//  (`https://<cuenta>.github.io/<repo>/`), y Vite por defecto escribe las rutas
//  de los assets con barra inicial (`/assets/main-xxx.js`). En la raíz eso es
//  correcto; en un subcamino apunta a la raíz del dominio y da 404. Por eso
//  `base` pasa a `'./'` —relativas— cuando la variable está puesta.
//
//  Y lo segundo, y es lo importante: **en Pages NO se construye `admin.html`**.
//
//  `admin.html` tiene un botón que borra la base de datos entera, y lo único que
//  decide quién puede pulsarlo son las reglas de Firestore. Publicarlo en un
//  repo accesible pone esa URL en manos de cualquiera que la encuentre, así que
//  el despliegue público se queda **solo con la página del juego**. La terminal
//  se sigue construyendo en local, donde no la ve nadie.
//
//  O sea que una variable de entorno decide dos cosas a la vez, y conviene que
//  sea explícita: si alguien la pone y cree que solo cambia el `base`, publica
//  el botón de borrar. Las dos cosas están en este mismo bloque a propósito.
//
//  ## ESTO SE QUEDA AUNQUE NO HAYA PAGES
//
//  `.github/workflows/publicar.yml` está **borrado**: Pages no está activado en el repo y
//  no se quiere, así que aquel workflow solo conseguía que todos los pushes salieran en
//  rojo. Con él se fue `.github/` entero.
//
//  Esta variable **sigue aquí a propósito**, y no la pone nadie, así que hoy no hace
//  nada. Es la red que impide que un despliegue público —Pages, Netlify, un `dist` en
//  cualquier servidor— acabe subido `admin.html`, que tiene un botón de **borrar la
//  base de datos**. Borrar el fichero de despliegue no es lo mismo que borrar la
//  protección, y esa es la diferencia entre este commit y el siguiente.
// ==========================================================================

import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// `import.meta.dirname` en vez de `__dirname`: en un `vite.config.ts` cargado
// de forma nativa el segundo no existe, y Vite avisa. Es el mismo apaño que
// lleva `verify/vite.config.ts`.
const aqui = dirname(fileURLToPath(import.meta.url));

const paraPages = process.env.GH_PAGES === '1';

export default defineConfig({
  // `'./'` solo en Pages. En local y en cualquier otro despliegue queda `/`,
  // que es lo que espera el resto del proyecto.
  base: paraPages ? './' : '/',
  build: {
    rollupOptions: {
      input: paraPages
        // En Pages tampoco se publica `admin.html`, pero la Wiki sí: es solo
        // lectura sobre datos, sin botones que escriban ni terminal alguna.
        ? { main: resolve(aqui, 'index.html'), wiki: resolve(aqui, 'wiki.html') }
        : {
            // La página del juego.
            main: resolve(aqui, 'index.html'),
            // La terminal de administración. SOLO en local.
            admin: resolve(aqui, 'admin.html'),
            // La Wiki en pestaña aparte. Sin game loop ni Firebase.
            wiki: resolve(aqui, 'wiki.html')
          }
    }
  }
});
