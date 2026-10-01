// ==========================================================================
//  Barrido de backticks en comentarios HTML dentro de plantillas
//
//  Uso:  node verify/scanPlantillas.mjs [carpeta]
//        npm run scan
//        npm run verify        (lo ejecuta antes de los bancos)
//
//  ---------------------------------------------------------------------------
//  POR QUÉ ESTE FICHERO EXISTE
//  ---------------------------------------------------------------------------
//
//  Es un error que se ha repetido tres veces en el MISMO fichero
//  (`rouletteStrip.ts`), y siempre igual:
//
//      ventana.innerHTML = `
//        ...
//        <!-- POR QUÉ `data-role` Y NO `id`. ... -->
//        <div data-role="track"></div>
//      `;
//
//  El comentario HTML vive dentro del template literal, así que CADA backtick
//  que lleva dentro cierra la cadena en ese punto. Lo que viene después se lee
//  como código y `tsc` suelta cuatro errores de sintaxis —`TS1005`, `TS1443`,
//  `TS1109`— que no señalan ni de lejos la causa real. Tuercen el resto del
//  HTML y quien lo lee no ve el `<!--` de dos líneas más arriba.
//
//  Ya se corrigió a mano dos veces y volvió a aparecer en otro comentario del
//  mismo fichero. Un arreglo a mano no escala a la tercera, y el sitio donde
//  este tipo de fallo se repite de verdad es el comentario: es el único trozo
//  del template donde escribir un acento a `data-role` parece natural.
//
//  ---------------------------------------------------------------------------
//  QUÉ MARCA Y QUÉ NO
//  ---------------------------------------------------------------------------
//
//  Solo marca un comentario HTML con backtick SIN ESCAPAR que esté dentro de
//  una plantilla. Lo demás pasa, y cada caso está en `probarPlantillas.mjs`:
//
//   - El mismo comentario con backticks en un comentario de TypeScript (`//`
//     o `/* *\/`). Legal, y es donde se escribe el porqué de estas reglas.
//   - Con backticks dentro de una cadena normal ('...' o "..."). Legal: ahí el
//     backtick es un carácter y no cierra nada.
//   - Con el backtick escapado (`\``). Legal a propósito, y el que hay que
//     escribir cuando de verdad se quiere un acento grave en el HTML.
//
//  Y la documentación no se mira: un `.md` puede enseñar el patrón roto a
//  propósito —este mismo fichero lo hace— y eso no es código.
//
//  ---------------------------------------------------------------------------
//  POR QUÉ NO USA EL COMPILADOR, QUE YA LO ENCUENTRA
//  ---------------------------------------------------------------------------
//
//  Porque el compilador lo encuentra TARDE y sin decir por qué. `tsc` solo ve
//  que la cadena se cierra antes de tiempo; aquí se señala el `<!--` concreto.
//  Los dos se necesitan: el guard avisa antes de que se haya escrito media
//  plantilla, y `tsc` es el que de verdad manda.
//
//  ---------------------------------------------------------------------------
//  POR QUÉ NO REUTILIZA EL RECORRIDO DE `scanTexto.mjs`
//  ---------------------------------------------------------------------------
//
//  Para que quitar un guard no pueda dejar al otro cojo. Si este importase el
//  recorrido del otro, un fallo en `scanTexto.mjs` se llevaría por delante a
//  este sin que se note, y dos guards que se necesitan mutuamente son uno solo
//  con dos nombres. Son treinta lineas de recorrido y van a juego.
//
//  ---------------------------------------------------------------------------
//  CÓMO DECIDE
//  ---------------------------------------------------------------------------
//
//  Con un LEXER propio, no con una expresión regular, porque la pregunta "¿esto
//  está dentro de una plantilla?" no se puede contestar con un patrón: un
//  `<!--` puede estar en el texto de la plantilla, en una cadena normal, en un
//  comentario de TypeScript o dentro de una plantilla anidada en un `${}`.
//  Un `split('`')` cuenta delimitadores y no sabe nada de ninguno de los tres
//  casos, que es como se marcaban de más los ficheros buenos.
// ==========================================================================

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/** Se ignoran: no son codigo nuestro y son enormes. */
const IGNORAR_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'out-one', '.vite', 'coverage', '.turbo'
]);

/** Solo estos tienen plantillas. Un `.md` no, y por eso no se lee. */
const CODIGO = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// ==========================================================================
//  El lexer
// ==========================================================================

/** Marca de apertura de un comentario HTML. Se arma con codepoints para que el guard no se marque a si mismo. */
const OPEN = '<' + String.fromCharCode(33) + '--';
const CLOSE = '--' + String.fromCharCode(62);

/**
 * ¿El backtick de `i` está escapado?
 *
 * escaped si le precede un número IMPAR de barras: `\` escapado, `\\` real.
 */
function escapado(texto, i) {
  let barras = 0;
  for (let j = i - 1; j >= 0 && texto[j] === '\\'; j--) barras++;
  return barras % 2 === 1;
}

/**
 * Recorre el fichero y devuelve los comentarios HTML con backtick sin escapar
 * que están dentro de una plantilla.
 *
 * `codigo` cuenta líneas por su cuenta porque el recorrido salta de bloque en
 * bloque: sin él, el informe.signalaría una línea que no es la del fallo, que
 * es justo el dato que hace falta para arreglarlo.
 */
function buscar(texto) {
  const hallazgos = [];
  const n = texto.length;
  // modo: codigo | linea | bloque | cadena | plantilla
  let modo = 'codigo';
  let delim = '';
  // Un cero por cada `${` abierto: al llegar a su `}` se vuelve a la plantilla.
  const expr = [];
  let i = 0, linea = 1;

  while (i < n) {
    const c = texto[i];
    const c2 = texto[i + 1];

    // Un `//` se cierra con el salto de línea, y hay que devolver el lexer a
    // código ahí. Sin este `modo = 'codigo'`, el comentario se comía el resto
    // del FICHERO entero y el guard daba verde sobre cualquier fichero que
    // empezara por un comentario, que son casi todos. Se encontró porque la
    // prueba lo comprobaba y porque no: las pruebasyntheticas no llevaban
    // delante un `//`, y el fichero de verdad sí.
    if (c === '\n') { linea++; if (modo === 'linea') modo = 'codigo'; i++; continue; }

    if (modo === 'linea') {
      i++;
      continue;
    }

    if (modo === 'bloque') {
      if (c === '*' && c2 === '/') { modo = 'codigo'; i += 2; continue; }
      i++;
      continue;
    }

    if (modo === 'cadena') {
      if (c === '\\') { if (texto[i + 1] === '\n') linea++; i += 2; continue; }
      if (c === delim) { modo = 'codigo'; i++; continue; }
      i++;
      continue;
    }

    if (modo === 'plantilla') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { modo = 'codigo'; i++; continue; }
      if (c === '$' && c2 === '{') { expr.push(0); modo = 'codigo'; i += 2; continue; }
      if (c === '<' && c2 === '!' && texto.startsWith(OPEN, i)) {
        const fin = texto.indexOf(CLOSE, i);
        const hasta = fin === -1 ? n : fin + CLOSE.length;
        const cuerpo = texto.slice(i, hasta);
        for (let k = i; k < hasta; k++) {
          if (texto[k] === '`' && !escapado(texto, k)) {
            hallazgos.push({
              linea,
              // La linea del BACKTICK, no la del comentario: es el caracter que
              // hay que quitar y es el que se senala.
              lineaCodigo: texto.slice(0, k).split('\n').length,
              texto: cuerpo.replace(/\s+/g, ' ').trim().slice(0, 110)
            });
            break;
          }
        }
        // El comentario puede ocupar varias lineas: hay que contarlas todas o
        // el informe señalaria una linea anterior a la del fallo.
        linea += (cuerpo.match(/\n/g) || []).length;
        i = hasta;
        continue;
      }
      i++;
      continue;
    }

    // modo === 'codigo'
    if (c === '/' && c2 === '/') { modo = 'linea'; i += 2; continue; }
    if (c === '/' && c2 === '*') { modo = 'bloque'; i += 2; continue; }
    if (c === "'" || c === '"') { modo = 'cadena'; delim = c; i++; continue; }
    if (c === '`') { modo = 'plantilla'; i++; continue; }
    if (c === '{' && expr.length) { expr[expr.length - 1]++; i++; continue; }
    if (c === '}' && expr.length) {
      if (expr[expr.length - 1] === 0) { expr.pop(); modo = 'plantilla'; i++; continue; }
      expr[expr.length - 1]--;
      i++;
      continue;
    }
    i++;
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
      if (!CODIGO.has(extension(ruta))) continue;

      for (const h of buscar(readFileSync(ruta, 'utf8'))) {
        rotos.push({
          fichero: relative(raiz, ruta).split(sep).join('/'),
          linea: h.lineaCodigo,
          lineaComentario: h.linea,
          texto: h.texto
        });
      }
    }
  })(raiz);

  return rotos;
}

// ==========================================================================
//  Informe
// ==========================================================================

/**
 * Imprime un hallazgo.
 *
 * El `JSON.stringify` es el mismo truco de `scanTexto.mjs`: si el comentario
 * lleva un acento grave, sin esto la consola se lo come y el que lo lee no ve
 * qué hay que quitar.
 */
function informar(sitio) {
  console.log(`  ${sitio.fichero}:${sitio.linea}`);
  console.log(`    comentario en  : ${sitio.lineaComentario}`);
  console.log(`    con backtick en: ${JSON.stringify(sitio.texto)}`);
}

// ==========================================================================
//  Entrada
// ==========================================================================

const raiz = resolve(process.argv[2] || process.cwd());

if (!statSync(raiz).isDirectory()) {
  console.error(`No es una carpeta: ${raiz}`);
  process.exit(2);
}

const rotos = escanear(raiz);

if (rotos.length) {
  console.error(`\n${rotos.length} comentario(s) HTML con backtick dentro de una plantilla.`);
  console.error('El backtick cierra el template literal y el HTML de despues se lee como codigo.');
  console.error('Por donde se empieza: el `<!--` de la linea anterior. Se quita el acento grave del');
  console.error('comentario, o se escapa con \\` si de verdad hace falta un acento grave en el HTML.');
  rotos.forEach(informar);
  process.exit(1);
}

console.log('\nOK: ningun comentario HTML con backtick dentro de una plantilla.');
process.exit(0);