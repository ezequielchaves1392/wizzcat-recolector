// Prueba del alcance del guard: QUE CARACTERES TIENEN QUE SALTAR Y CUALES NO.
//
// El primer diseno solo miraba bloques CJK, y se equivocaba por el motivo que
// justifica este fichero. El caso real de `buyCheck.ts` se leyo de dos
// maneras distintas en dos momentos:
//
//   - U+73FE y U+8C61: ideogramas CJK unificados.
//   - U+FE8C: que NO es un ideograma. Es una letra arabe de
//     `Arabic Presentation Forms-B`.
//
// La segunda vez que se leyo el fichero ya era la letra arabe. Un barrido que
// solo mire CJK no la ve.
//
// Y hay un segundo motivo, mas aburrido y mas peligroso: el rango se dio por
// bueno sin medirlo. Al comprobarlo con `.test()` sobre una regex con bandera
// `g`, la comprobacion arrastra `lastIndex` y devuelve verdadero y falso
// alternados. Eso si que es un guard que parece funcionar.
//
// Uso: node verify/probarAlcance.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RAIZ = process.cwd();
const GUION = join(RAIZ, 'verify', 'scanTexto.mjs');

// ==========================================================================
//  1 · Lo que tiene que saltar
// ==========================================================================

const DEBEN = [
  ['CJK unificado', 0x73fe],
  ['kanji suplementario', 0x8c61],
  ['compat ideographs', 0xfa10],
  ['compat forms', 0xfe32],
  ['arabe presentacion B', 0xfe8c],
  ['kana de ancho completo', 0x3042],
  ['puntuacion CJK', 0x3001],
  ['hangul', 0xac00],
  ['ancho completo', 0xff0c]
];

// ==========================================================================
//  2 · Lo que NO puede saltar, o el guard es inservible
// ==========================================================================

const NO_DEBEN = [
  ['acentos, enye y signos', '\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\u00bf\u00a1'],
  ['comillas tipograficas', '\u201c\u201d\u00ab\u00bb'],
  ['rayas y puntos suspensivos', '\u2013\u2014\u2026'],
  ['simbolos matematicos', '\u2212\u2248\u2260\u00d7'],
  ['flechas', '\u2190\u2192\u2191\u2193'],
  ['cajas y bordes', '\u2500\u2502\u250c\u2510\u2514\u2550'],
  ['moneda', '\u20ac\u2665'],
  ['emoji', '\u{1F4E6}\u{1F48E}\u{1F511}\u{1F916}'],
  ['variacion de emoji', '\uFE0F'],
  ['kana de MEDIO ancho (auth.ts)', '\uff71\uff72\uff73\uff74'],
  ['sigma griega (CAMBIOS-MACRO)', '\u03a3'],
  ['cirilico', '\u0416'],
  ['BOM', '\uFEFF'],
  ['tabs y espacios', '\t  ']
];

// ==========================================================================
//  Ejecucion
// ==========================================================================

let fallos = 0;
const check = (nombre, ok, detalle = '') => {
  console.log(`  ${ok ? 'PASA ' : 'FALLA'}  ${nombre}${detalle ? '   [' + detalle + ']' : ''}`);
  if (!ok) fallos++;
};

/**
 * Corre el barrido de verdad contra una carpeta de un solo fichero y devuelve
 * si ha fallado.
 *
 * Se llama al SCRIPT y no a la regex, a proposito: asi lo que se prueba es lo
 * que se usa, con su politica de codigo y de documentacion incluida.
 */
function elGuardeSalta(texto, extension = '.ts') {
  const dir = mkdtempSync(join(tmpdir(), 'alcance-'));
  try {
    writeFileSync(join(dir, 'x' + extension), texto, 'utf8');
    try {
      execFileSync(process.execPath, [GUION, dir], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });
      return false;
    } catch {
      return true;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log('\n1 · Caracteres que tienen que saltar\n');
for (const [nombre, cp] of DEBEN) {
  const ch = String.fromCodePoint(cp);
  const hex = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
  check(`${nombre} (${hex})`, elGuardeSalta(`export const x = 'a${ch}b';\n`));
}

console.log('\n2 · Caracteres que NO pueden saltar, o el guard es inservible\n');
for (const [nombre, texto] of NO_DEBEN) {
  check(nombre, !elGuardeSalta(`export const x = '${texto}';\n`));
}

// 3 · Lo mas importante: cero falsos positivos sobre el repo de verdad.
console.log('\n3 · Cero falsos positivos sobre el repo entero\n');

let salida = '';
let codigo = 0;
try {
  salida = execFileSync(process.execPath, [GUION, RAIZ], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
} catch (e) {
  codigo = e.status ?? -1;
  salida = (e.stdout || '') + (e.stderr || '');
}

check('el codigo del repo esta limpio', codigo === 0,
  codigo === 0 ? '' : 'el guard falla sobre el propio repo');
if (salida.includes('AVISO')) {
  console.log('      avisos en documentacion (no rompen):');
  salida.split(/\r?\n/)
    .filter(l => /\.(md|txt):\d+/.test(l))
    .slice(0, 5)
    .forEach(l => console.log('        ' + l.trim()));
}

console.log(fallos === 0
  ? '\nEl rango cubre lo que tiene que cubrir, y no toca lo que es legitimo.'
  : `\n${fallos} prueba(s) mal`);
process.exit(fallos === 0 ? 0 : 1);