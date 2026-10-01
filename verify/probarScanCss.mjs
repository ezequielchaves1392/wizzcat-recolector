// Prueba del guard de CSS: hay que comprobar que FALLA cuando debe.
//
// Un guard que nunca falla no protege nada, y lo peligroso que tiene uno es justo
// eso: da verde, y lo verde es lo que hace que nadie vuelva a mirar.
//
// Se monta una carpeta con lo que el repo deberia ser (limpio), lo que NO
// deberia (`color-mix()` con modificador de alfa) y los casos que se parecen
// mucho y NO deben marcarse: el mismo patrón escrito en un comentario para
// explicar el apaño, un `color-mix()` anidado, y un `//` dentro de una cadena.
//
// Los que NO deben marcarse importan mas que el que si falla. Este guard tiene
// que decidir si una barra de division está dentro de la lista de argumentos de
// un `color-mix()`, y esa pregunta tiene tres respuestas mas ademas de "si". Un
// guard que marcara las tres dejaria de ser util en una semana: el primer
// acierto en codigo bueno lo tira. Y el caso del comentario no es hipotetico:
// `style.css` escribe el patron roto EN SU PROPIO COMENTARIO para explicar por
// que se arranco, asi que sin esta prueba el guard naceria marcando el repo.
//
// Uso: node verify/probarScanCss.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const raiz = join(tmpdir(), 'css-fixture-' + process.pid);
const guion = join(process.cwd(), 'verify', 'scanCss.mjs');

/**
 * La barra de division, por numero y no escrita.
 *
 * Las fixtures de este fichero tienen que CONTENER el patron roto, y este
 * fichero esta dentro del repo que el guard escanea. Con la barra escrita a mano
 * el guard se marcaria a si mismo y la prueba 10 —"el CSS real del repo pasa"—
 * no significaria nada. Es el mismo truco que el backtick en
 * `probarPlantillas.mjs`.
 */
const BARRA = String.fromCharCode(47);

/** El patron roto, para no repetirlo en cada fixture. */
const MALO = 'color-mix(in srgb, red 50%, blue ' + BARRA + ' 0.5)';

let fallos = 0;
const check = (nombre, ok, detalle = '') => {
  console.log(`  ${ok ? 'PASA ' : 'FALLA'}  ${nombre}${detalle ? '   [' + detalle + ']' : ''}`);
  if (!ok) fallos++;
};

/**
 * Corre el barrido contra una carpeta y devuelve el codigo de salida y el texto.
 *
 * El `stdio` es explicito porque `execFileSync` deja el stderr HEREDADO al
 * padre por defecto: sin esto, el mensaje del escaner sale intercalado entre las
 * lineas de este test y no se sabe que prueba fallo por culpa del escaner.
 */
function correr(carpeta) {
  try {
    return {
      codigo: 0,
      texto: execFileSync(process.execPath, [guion, carpeta], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      })
    };
  } catch (e) {
    return { codigo: e.status ?? -1, texto: (e.stdout || '') + (e.stderr || '') };
  }
}

/** Escribe un fichero dentro de la fixture `carpeta` y devuelve la carpeta. */
function escribir(carpeta, nombre, contenido) {
  mkdirSync(join(raiz, carpeta), { recursive: true });
  writeFileSync(join(raiz, carpeta, nombre), contenido, 'utf8');
  return join(raiz, carpeta);
}

try {
  // 1 · CSS correcto: el estado en que deberia estar el repo entero. Incluye un
  //     `color-mix()` anidado, que es la forma buena de bajar la opacidad.
  const limpio = escribir('limpio', 'ok.css',
    '.card {\n' +
    '  background: linear-gradient(\n' +
    '    to bottom,\n' +
    '    color-mix(in srgb, color-mix(in srgb, var(--bg-app) 92%, var(--text-main) 8%) 72%, transparent),\n' +
    '    color-mix(in srgb, var(--bg-app) 88%, transparent)\n' +
    '  );\n' +
    '}\n');
  const a = correr(limpio);
  check('un color-mix anidado pasa', a.codigo === 0, `salida ${a.codigo}`);

  // 2 · El caso real: el modificador de alfa. FALLA.
  const roto = escribir('roto', 'malo.css',
    '.card {\n' +
    '  background: linear-gradient(\n' +
    '    to bottom,\n' +
    '    color-mix(in srgb, var(--bg-app) 96%, var(--text-main) 4% ' + BARRA + ' 0.94),\n' +
    '    color-mix(in srgb, var(--bg-app) 92%, transparent)\n' +
    '  );\n' +
    '}\n');
  const b = correr(roto);
  check('el color-mix con modificador de alfa falla', b.codigo === 1, `salida ${b.codigo}`);
  check('  y senala fichero y linea', /malo\.css:4/.test(b.texto));
  check('  y saca la llamada en JSON', /color-mix\(in srgb, var\(--bg-app\) 96%/.test(b.texto));
  check('  y dice que se descarta la declaracion', /descarta la DECLARACION/i.test(b.texto));
  check('  y ensena la forma buena', /transparent/.test(b.texto));

  // 3 · El MISMO patron en un comentario CSS. Pasa, y no es hipotetico: es
  //     exactamente lo que hace `style.css` al documentar el apaño. Sin esta
  //     prueba el guard naceria marcando el repo.
  const enComentario = escribir('comentario', 'ok.css',
    '/*\n' +
    '   POR QUE SE ARRANCA. color-mix(in srgb, A 92%, B 8% ' + BARRA + ' 0.72) no es valido:\n' +
    '   el motor descarta la declaracion y la superficie se queda sin fondo.\n' +
    '*/\n' +
    '.card { background: red; }\n');
  const c = correr(enComentario);
  check('el patron roto en un comentario CSS pasa', c.codigo === 0, `salida ${c.codigo}`);

  // 4 · Y en un comentario de bloque de TypeScript, que es donde se escribe el
  //     porqué de las reglas de este guard.
  escribir('comentario-ts', 'ok.ts',
    '/* color-mix(in srgb, A 92%, B 8% ' + BARRA + ' 0.72) esta bien aqui. */\n' +
    '// y tambien en este\n' +
    'export const ok = 1;\n');
  const d = correr(join(raiz, 'comentario-ts'));
  check('el patron roto en un comentario de TS pasa', d.codigo === 0, `salida ${d.codigo}`);

  // 5 · El CSS dentro de una cadena de TypeScript. TIENE que fallar: es donde se
  //     escribe el error de verdad (`el.style.cssText = '...'` y las plantillas
  //     de los componentes), y si el guard se comiera las cadenas no miraria
  //     ninguno de los sitios donde este bug aparece en el juego.
  escribir('cadena', 'malo.ts',
    'export const panel = document.createElement("div");\n' +
    'panel.style.cssText = "background: ' + MALO + '";\n');
  const e = correr(join(raiz, 'cadena'));
  check('el color-mix dentro de una cadena falla', e.codigo === 1, `salida ${e.codigo}`);
  check('  y senala la linea de verdad', /malo\.ts:2/.test(e.texto));

  // 6 · Un `//` dentro de una cadena NO abre comentario. Sin esto, el `//` de
  //     una URL se comería el resto de la linea y el fallo de al lado se
  //     escaparia: el guard daria verde sobre codigo roto.
  escribir('url', 'malo.ts',
    'export const u = "https://ejemplo.test/a";\n' +
    'const x = 1; panel.style.cssText = "' + MALO + '";\n');
  const f = correr(join(raiz, 'url'));
  check('un // dentro de una cadena no tapa la linea', f.codigo === 1, `salida ${f.codigo}`);
  check('  y encuentra el fallo de la misma linea', /malo\.ts:2/.test(f.texto));

  // 7 · Un `color-mix(` SIN cerrar no puede arrastrar el barrido medio fichero
  //     marcando divisiones de verdad que no tienen nada que ver.
  escribir('sin-cerrar', 'ok.css',
    '.a { content: "color-mix("; }\n' +
    '.b { width: 10px; height: 20px; }\n' +
    '.c { border-radius: 50%; }\n');
  const g = correr(join(raiz, 'sin-cerrar'));
  check('un color-mix sin cerrar no marca de mas', g.codigo === 0, `salida ${g.codigo}`);

  // 8 · El HTML tampoco se mira para `//`, que ahi no es un comentario, pero si
  //     para `<!-- -->`: un patron roto escondiendose en un comentario HTML
  //     pasaria por codigo.
  escribir('html', 'ok.html',
    '<style>\n' +
    '<!-- .a { background: ' + MALO + '; } -->\n' +
    '.b { color: red; }\n' +
    '</style>\n');
  const h = correr(join(raiz, 'html'));
  check('el patron roto en un comentario HTML pasa', h.codigo === 0, `salida ${h.codigo}`);

  // 9 · node_modules se ignora: ahi hay tropezones de todo el mundo.
  mkdirSync(join(raiz, 'ignorado', 'node_modules', 'algo'), { recursive: true });
  writeFileSync(join(raiz, 'ignorado', 'node_modules', 'algo', 'x.css'),
    '.a { background: ' + MALO + '; }\n', 'utf8');
  writeFileSync(join(raiz, 'ignorado', 'bien.css'), '.b { color: red; }\n', 'utf8');
  const i = correr(join(raiz, 'ignorado'));
  check('node_modules se ignora', i.codigo === 0, `salida ${i.codigo}`);

  // 10 · Una comprobacion que no depende de la fixture: el guard, sobre el
  //      codigo real del repo, tiene que dar verde. `style.css` documenta el
  //      patron roto en un comentario, asi que esta prueba es la que dice si
  //      el tapado de comentarios funciona de verdad y no solo en teoria.
  const j = correr(process.cwd());
  check('el CSS real del repo pasa', j.codigo === 0, `salida ${j.codigo}`);
} finally {
  rmSync(raiz, { recursive: true, force: true });
}

console.log(fallos === 0
  ? '\nEl guard atrapa lo que tiene que atrapar y no marca lo que no debe.'
  : `\n${fallos} prueba(s) mal`);
process.exit(fallos === 0 ? 0 : 1);
