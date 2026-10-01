// ==========================================================================
//  Barrido de `color-mix()` con modificador de alfa
//
//  Uso:  node verify/scanCss.mjs [carpeta]
//        npm run scan
//        npm run verify        (lo ejecuta antes de los bancos)
//
//  ---------------------------------------------------------------------------
//  POR QUE ESTE FICHERO EXISTE
//  ---------------------------------------------------------------------------
//
//  `.card-glass` y `.card-glass-elevated` eran ESTE:
//
//      background: linear-gradient(
//        to bottom,
//        color-mix(in srgb, var(--bg-app) 96%, var(--text-main) 4% / 0.94),
//        color-mix(in srgb, var(--bg-app) 92%, transparent)
//      );
//
//  El `/ 0.94` no existe. La gramática de `color-mix()` es
//
//      color-mix( [ <color-interpolation-method> , ]?
//                  <color> <percentage [0,100]>?
//                , <color> <percentage [0,100]>? )
//
//  y no tiene ranura para un alfa: la transparencia se consigue MEZCLANDO CON
//  `transparent`, no con un modificador detrás de la última coma. Comprobado en
//  el motor que usa el juego:
//
//      CSS.supports('background', 'color-mix(in srgb, red 50%, blue / 0.5)')
//      // false
//
//  Lo que hace el motor con una función inválida es descartar la DECLARACIÓN
//  ENTERA, y `background` es un atajo: la superficie se queda en `none`. Como el
//  `backdrop-filter` de la misma regla sí es válido, el panel se veía
//  "vidrioso" —borde, sombra y desenfoque— y no se notaba que le faltaba el
//  fondo. Se leía la página entera detrás de los modales.
//
//  ---------------------------------------------------------------------------
//  POR QUÉ HACE FALTA UN GUARD Y NO UN BANCO
//  ---------------------------------------------------------------------------
//
//  Los quince bancos pasan por encima de este bug sin despeinarse: miden la
//  economía, el guardado y el botín, y `tsc` da el CSS por bueno porque un
//  `color-mix()` mal escrito sigue siendo un `color-mix()` bien escrito. No hay
//  ninguna prueba que pueda mirarlo, y sin guard el siguiente `/ 0.9` colado en
//  una superficie vuelve a dejar un panel invisible sin que nada se entere.
//
//  Es la misma clase de fallo que persiguen `scanTexto.mjs` y
//  `scanPlantillas.mjs`: no rompe el build, no falla un banco y no se ve en el
//  código. Aquí se nota mirando la pantalla, que es el peor sitio posible para
//  descubrir un error de sintaxis.
//
//  ---------------------------------------------------------------------------
//  QUÉ MARCA Y QUÉ NO
//  ---------------------------------------------------------------------------
//
//  Marca un `/` en el primer nivel de paréntesis de un `color-mix()`. Los tres
//  casos que se parecen y NO deben marcarse:
//
//   - El MISMO patrón escrito en un comentario, para explicar el porqué. Es lo
//     que hace `style.css` al documentar el apaño, y es el falso positivo más
//     probable: un guard que marca su propia explicación se tira en una semana.
//   - Un `color-mix()` ANIDADO, que lleva paréntesis propios por dentro y es
//     válido:
//       color-mix(in srgb, color-mix(in srgb, A 92%, B 8%) 72%, transparent)
//   - Una cadena normal de JavaScript que menciona el patrón sin ser CSS.
//
//  Los comentarios se tapa ANTES de buscar, así que lo que hay dentro no se ve.
//  Las cadenas NO se tapan: el CSS que vive dentro de un `style.cssText = '...'`
//  o de una plantilla tiene que seguir estando a la vista, que es justo donde se
//  escribiría el error.
//
//  ---------------------------------------------------------------------------
//  POR QUÉ NO USA EL COMPILADOR, QUE YA LO ENCUENTRA
//  ---------------------------------------------------------------------------
//
//  Porque no lo encuentra. Ni `tsc` ni Tailwind ni el navegador lo señalan:
//  el navegador lo descarta en silencio, que es el problema. Aquí se dice qué
//  línea es y cómo se arregla, que es lo que un aviso tiene que hacer.
//
//  ---------------------------------------------------------------------------
//  POR QUÉ NO REUTILIZA EL RECORRIDO DE LOS OTROS DOS GUARDS
//  ---------------------------------------------------------------------------
//
//  Por lo mismo que dice `scanPlantillas.mjs`: para que quitar un guard no pueda
//  dejar a otro cojo. Son treinta líneas de recorrido y van a juego.
// ==========================================================================

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/** Se ignoran: no son codigo nuestro y son enormes. */
const IGNORAR_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'out-one', '.vite', 'coverage', '.turbo'
]);

/** Donde puede haber CSS: hojas, plantillas, atributos `style` en linea. */
const CODIGO = new Set(['.css', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html']);

/** Solo estos tienen `//`. En CSS y en HTML no significa nada. */
const COMENTARIO_LINEA = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/** Solo el HTML tiene `<!-- -->`. */
const COMENTARIO_HTML = new Set(['.html']);

/** El nombre de la funcion, tal cual. Se busca con `indexOf` y luego se cuela. */
const LLAMADA = 'color-mix(';

/**
 * Cuanto se lee buscando el parentesis que cierra.
 *
 * Un `color-mix()` sin cerrar se lleva el barrido medio fichero y acaba
 * marcando cualquier barra de division que encuentre por el camino. El tope
 * corta eso, y los 600 caracteres dan de sobra: el argumento más largo que
 * existe en este repo no llega a doscientos.
 */
const MAX_BUSQUEDA = 600;

// ==========================================================================
//  El lexer
// ==========================================================================

/**
 * Tapa los comentarios y deja TODO LO DEMAS a la vista.
 *
 * Se tapa en lugar de borrar para que las longitudes no cambien: las líneas del
 * informe tienen que seguir siendo las del fichero de verdad.
 *
 * Las cadenas se SALTAN, no se tapan. El motivo está en el pie del guard: el
 * CSS que se busca suele vivir dentro de una, y taparla sería tapar el error.
 * Saltarlas sirve para otra cosa: un `//` dentro de `'https://...'` no abre
 * comentario, y sin esto el resto de la línea desaparecería del barrido.
 *
 * @param {string} texto
 * @param {string} ext  Extension en minusculas, con punto.
 * @returns {string} El mismo texto con los comentarios tapados en huecos.
 */
function taparComentarios(texto, ext) {
  const out = texto.split('');
  const conLinea = COMENTARIO_LINEA.has(ext);
  const conHtml = COMENTARIO_HTML.has(ext);
  const n = texto.length;
  let i = 0;

  /** Sustituye por huecos, dejando los saltos de linea donde estaban. */
  const tapar = (desde, hasta) => {
    for (let k = desde; k < hasta && k < n; k++) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };

  while (i < n) {
    const c = texto[i];
    const c2 = texto[i + 1];

    if (conHtml && texto.startsWith('<!--', i)) {
      const fin = texto.indexOf('-->', i + 4);
      const hasta = fin === -1 ? n : fin + 3;
      tapar(i, hasta);
      i = hasta;
      continue;
    }

    if (c === '/' && c2 === '*') {
      const fin = texto.indexOf('*/', i + 2);
      const hasta = fin === -1 ? n : fin + 2;
      tapar(i, hasta);
      i = hasta;
      continue;
    }

    if (conLinea && c === '/' && c2 === '/') {
      const fin = texto.indexOf('\n', i);
      tapar(i, fin === -1 ? n : fin);
      i = fin === -1 ? n : fin;
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      const delim = c;
      i++;
      while (i < n) {
        if (texto[i] === '\\') { i += 2; continue; }
        if (texto[i] === delim) { i++; break; }
        i++;
      }
      continue;
    }

    i++;
  }

  return out.join('');
}

// ==========================================================================
//  La busqueda
// ==========================================================================

/**
 * Busca `/` en el primer nivel de una lista de argumentos que empieza en
 * `inicio` (justo despues del `(` de la llamada).
 *
 * Se cuentan los parentesis anidados porque un `color-mix()` puede llevar otros
 * dentro —`var(--x)` uno, o un `color-mix()` anidado— y su barra interna no
 * cuenta: la de `var(--x)` es un guion, la del anidado esta a otro nivel.
 *
 * Un `;`, `{` o `}` corta la busqueda. Dentro de la llamada no puede haber
 * ninguno, y si aparece es que la llamada no era una: mejor rendirse que
 * seguir leyendo y marcar algo que no es.
 *
 * @returns {{barra: number, cuerpo: string}|null} La posicion de la barra
 *   separadora, o `null` si la llamada esta bien o no se cierra.
 */
function revisarArgumentos(mascarado, inicio) {
  const n = mascarado.length;
  const limite = Math.min(n, inicio + MAX_BUSQUEDA);
  let nivel = 0;

  for (let i = inicio; i < limite; i++) {
    const c = mascarado[i];
    if (c === '(') { nivel++; continue; }
    if (c === ')') {
      if (nivel === 0) return null;   // Cierra la llamada: no hay barra.
      nivel--;
      continue;
    }
    if (c === '/' ) return { barra: i, cuerpo: mascarado.slice(inicio, i) };
    if (c === ';' || c === '{' || c === '}') return null;
  }

  return null;
}

/** Numero de linea (1 based) de un indice, contando desde el principio. */
function lineaDe(texto, indice) {
  let linea = 1;
  for (let i = 0; i < indice; i++) if (texto[i] === '\n') linea++;
  return linea;
}

/**
 * Devuelve los `color-mix()` con modificador de alfa de un texto ya sin
 * comentarios.
 */
function buscar(mascarado) {
  const hallazgos = [];
  let desde = 0;

  for (;;) {
    const i = mascarado.indexOf(LLAMADA, desde);
    if (i === -1) break;
    desde = i + LLAMADA.length;

    const r = revisarArgumentos(mascarado, desde);
    if (!r) continue;

    hallazgos.push({
      lineaBarra: lineaDe(mascarado, r.barra),
      cuerpo: r.cuerpo.replace(/\s+/g, ' ').trim()
    });
  }

  return hallazgos;
}

// ==========================================================================
//  Recorrido
// ==========================================================================

const extension = (ruta) => {
  const i = ruta.lastIndexOf('.');
  return i < 0 ? '' : ruta.slice(i).toLowerCase();
};

function escanear(raiz) {
  const rotos = [];

  (function anda(dir) {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      if (IGNORAR_DIRS.has(entrada.name)) continue;

      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) { anda(ruta); continue; }

      // Los junctions de Windows llegan como symlink y no se siguen.
      if (entrada.isSymbolicLink()) continue;

      const ext = extension(ruta);
      if (!CODIGO.has(ext)) continue;

      const texto = readFileSync(ruta, 'utf8');
      const mascarado = taparComentarios(texto, ext);

      for (const h of buscar(mascarado)) {
        rotos.push({
          fichero: relative(raiz, ruta).split(sep).join('/'),
          linea: h.lineaBarra,
          texto: h.cuerpo.slice(0, 110)
        });
      }
    }
  })(raiz);

  return rotos;
}

// ==========================================================================
//  Informe
// ==========================================================================

function informar(sitio) {
  console.log(`  ${sitio.fichero}:${sitio.linea}`);
  console.log(`    color-mix(${sitio.texto})`);
}

// ==========================================================================
//  Entrada
// ==========================================================================

const raiz = resolve(process.argv[2] || process.cwd());

/**
 * La barra de division, por numero y no escrita.
 *
 * El mensaje de abajo ENSENA el patron roto, y el guard lo.seekARIA a si mismo
 * si la barra estuviera escrita a mano: seARIA codigo, no un comentario. Es el
 * mismo truco que usa `probarPlantillas.mjs` con el backtick, y por el mismo
 * motivo: asi el ejemplo se lee de un vistazo y no hay forma de que un editor lo
 * cambie por el camino.
 */
const BARRA = String.fromCharCode(47);

if (!statSync(raiz).isDirectory()) {
  console.error(`No es una carpeta: ${raiz}`);
  process.exit(2);
}

const rotos = escanear(raiz);

if (rotos.length) {
  console.error(`\n${rotos.length} color-mix() con modificador de alfa.`);
  console.error('No es sintaxis valida: el motor descarta la DECLARACION ENTERA y la superficie');
  console.error('se queda sin fondo. Con backdrop-filter al lado, el panel parece que si lo tiene.');
  console.error('La transparencia se mezcla con `transparent`:');
  console.error(`  MAL   color-mix(in srgb, A 92%, B 8% ${BARRA} 0.72)`);
  console.error('  BIEN  color-mix(in srgb, color-mix(in srgb, A 92%, B 8%) 72%, transparent)');
  rotos.forEach(informar);
  process.exit(1);
}

console.log('\nOK: ningun color-mix() con modificador de alfa.');
process.exit(0);
