// Prueba del guard: hay que comprobar que FALLA cuando debe.
//
// Un barrido que nunca falla no protege nada, y lo peligroso que tiene uno es
// justo eso: da verde, y lo verde es lo que hace que nadie vuelva a mirar.
//
// Se monta una carpeta con lo que el repo deberia ser (limpio), lo que NO
// deberia (codigo roto) y lo que da aviso sin romper (documentacion). Se
// comprueban las tres salidas y los codigos de salida.
//
// POR QUE LOS CARACTERES RAROS SE CONSTRUYEN Y NO SE ESCRIBEN.
//
//   La primera version de este fichero traia el caracter de ejemplo escrito a
//   mano, y al renombrarlo se perdio por el camino: un `Set-Content` de
//   PowerShell se lo comio y lo guardo como otra cosa. El test seguia
//   ejecutandose, y daba FALLA en los tres casos de ideograma, que es
//   exactamente lo que hace un test mal: no dice que el codigo este roto, dice
//   que el test esta roto, y las dos cosas parecen la misma.
//
//   Ahora el caracter se saca de su codepoint. No hay forma de que un editor o
//   una consola lo cambien por el camino, porque en el fichero solo esta el
//   numero.
//
// Uso: node verify/probarScan.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Los dos caracteres que aparecieron de verdad, por codepoint y no a mano.
//
// U+FE8C no es un ideograma: es una letra arabe de `Arabic Presentation
// Forms-B`. Aparecio en `buyCheck.ts` en una lectura y U+73FE en otra, dos
// corrupciones distintas del mismo sitio en dos minutos.
//
// NO se escriben a mano aqui, ni en ningun comentario de este repo, ni con
// vistas a que estan a dos pasos y se leen de un vistazo. Es la razon por la
// que existe el guard: un fichero que documenta el fallo con el caracter
// fallido dentro se marca a si mismo. `scanTexto.mjs` lo encuentra en su
// propio comentario y falla sobre el repo. Los dos caracteres van por numero.
const ANCHO = String.fromCodePoint(0xff0c);   // coma de ancho completo
const COMPAT = String.fromCodePoint(0xfe8c);  // la letra arabe de buyCheck

const raiz = join(tmpdir(), 'scan-fixture-' + process.pid);
const guion = join(process.cwd(), 'verify', 'scanTexto.mjs');

let fallos = 0;
const check = (nombre, ok, detalle = '') => {
  console.log(`  ${ok ? 'PASA ' : 'FALLA'}  ${nombre}${detalle ? '   [' + detalle + ']' : ''}`);
  if (!ok) fallos++;
};

/**
 * Corre el barrido contra una carpeta y devuelve el codigo de salida y el texto.
 *
 * El `stdio` es explicito porque `execFileSync` deja el stderr HEREDADO al
 * padre por defecto: sin esto, el "1 caracter fuera de latin" del escaner sale
 * intercalado entre las lineas de este test y no se sabe que prueba fallo y
 * cual fallo por culpa del escaner.
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

try {
  // 1 · Repo limpio: tiene que pasar.
  mkdirSync(join(raiz, 'limpio'), { recursive: true });
  writeFileSync(join(raiz, 'limpio', 'ok.ts'),
    'export const saludo = "Las dos son medidas en el mismo sitio";\n', 'utf8');
  writeFileSync(join(raiz, 'limpio', 'notas.md'),
    '# Todo en espanol, sin ideogramas.\n', 'utf8');
  const a = correr(join(raiz, 'limpio'));
  check('el repo limpio pasa', a.codigo === 0, `salida ${a.codigo}`);

  // 2 · Codigo roto con el ideograma de compatibilidad: tiene que FALLAR.
  mkdirSync(join(raiz, 'roto'), { recursive: true });
  writeFileSync(join(raiz, 'roto', 'malo.ts'),
    `const${COMPAT}a = 1;\nexport const bueno = 2;\n`, 'utf8');
  const b = correr(join(raiz, 'roto'));
  check('el codigo roto falla', b.codigo === 1, `salida ${b.codigo}`);
  check('  y senala fichero y linea', /malo\.ts:1/.test(b.texto));
  check('  y da el codepoint', /U\+FE8C/.test(b.texto));
  check('  y saca la linea en JSON', /"const/.test(b.texto));

  // 3 · Codigo roto con signo de ancho completo: tambien es basura.
  mkdirSync(join(raiz, 'ancho'), { recursive: true });
  writeFileSync(join(raiz, 'ancho', 'malo2.ts'),
    `const${ANCHO}x = 1;\n`, 'utf8');
  const c = correr(join(raiz, 'ancho'));
  check('el signo de ancho completo tambien falla', c.codigo === 1, `salida ${c.codigo}`);
  check('  y da el codepoint', /U\+FF0C/.test(c.texto));

  // 4 · Documentacion: avisa, pero NO rompe.
  mkdirSync(join(raiz, 'doc'), { recursive: true });
  writeFileSync(join(raiz, 'doc', 'leeme.md'),
    `# El caracter problematico: ${COMPAT}\n`, 'utf8');
  const d = correr(join(raiz, 'doc'));
  check('la documentacion avisa sin fallar', d.codigo === 0, `salida ${d.codigo}`);
  check('  y lo dice', /AVISO/.test(d.texto));

  // 5 · node_modules se ignora: ahi hay tropezones de todo el mundo.
  mkdirSync(join(raiz, 'ignorado', 'node_modules', 'algo'), { recursive: true });
  writeFileSync(join(raiz, 'ignorado', 'node_modules', 'algo', 'x.js'),
    `const${ANCHO} = 1;\n`, 'utf8');
  writeFileSync(join(raiz, 'ignorado', 'bien.ts'), 'export const ok = 1;\n', 'utf8');
  const e = correr(join(raiz, 'ignorado'));
  check('node_modules se ignora', e.codigo === 0, `salida ${e.codigo}`);
} finally {
  rmSync(raiz, { recursive: true, force: true });
}

console.log(fallos === 0
  ? '\nEl guard atrapa lo que tiene que atrapar.'
  : `\n${fallos} prueba(s) mal`);
process.exit(fallos === 0 ? 0 : 1);