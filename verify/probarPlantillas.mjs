// Prueba del guard de plantillas: hay que comprobar que FALLA cuando debe.
//
// Un guard que nunca falla no protege nada, y lo peligroso que tiene uno es justo
// eso: da verde, y lo verde es lo que hace que nadie vuelva a mirar.
//
// Se monta una carpeta con lo que el repo deberia ser (limpio), lo que NO
// deberia (comentarios HTML con backtick dentro de una plantilla) y los cuatro
// casos que se parecen mucho y NO deben marcar: backticks en comentarios de
// TypeScript, en cadenas normales, escapados, y en documentacion.
//
// Los cuatro importan mas que el que si falla. Este guard tiene que decidir si
// un `<!--` esta dentro de una plantilla, y esa pregunta tiene cuatro respuestas
// distintas ademas de "si". Un guard que marcara los cuatro-leggedos dejaria de
// ser util en una semana: el primer acierto en codigo bueno lo tira.
//
// POR QUE EL BACKTICK SE SAQUE DE UN CODEPOINT Y NO SE ESCRIBA A MANO.
//
//   En un fichero de este repo no puede escribirse un comentario HTML con un
//   backtick dentro sin romperse: este test tendria que vivir dentro de una
//   plantilla para poder contener lo que prueba. Con el caracter por numero se
//   escribe en un fichero normal, se lee de un vistazo y no hay forma de que un
//   editor lo cambie por el camino.
//
// Uso: node verify/probarPlantillas.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BT = String.fromCharCode(96);   // acento grave
const OPEN = '<' + String.fromCharCode(33) + '--';
const CLOSE = '--' + String.fromCharCode(62);

const raiz = join(tmpdir(), 'plantillas-fixture-' + process.pid);
const guion = join(process.cwd(), 'verify', 'scanPlantillas.mjs');

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

/** Escribe un fichero de codigo dentro de la fixture `carpeta`. */
function escribir(carpeta, nombre, contenido) {
  mkdirSync(join(raiz, carpeta), { recursive: true });
  writeFileSync(join(raiz, carpeta, nombre), contenido, 'utf8');
  return join(raiz, carpeta);
}

try {
  // 1 · Plantilla con un comentario HTML SIN backticks: tiene que pasar. Es el
  //     estado en el que deberia estar el repo entero.
  const limpio = escribir('limpio', 'ok.ts',
    'export function pintar(el: HTMLElement) {\n' +
    '  el.innerHTML = ' + BT + '\n' +
    '    <div data-role="track">hola</div>\n' +
    '    ' + OPEN + ' POR QUE data-role y no id. ' + CLOSE + '\n' +
    '  ' + BT + ';\n' +
    '}\n');
  const a = correr(limpio);
  check('una plantilla con comentario sin backtick pasa', a.codigo === 0, `salida ${a.codigo}`);

  // 2 · El caso real: backtick sin escapar dentro del comentario. FALLA.
  const roto = escribir('roto', 'malo.ts',
    'export function pintar(el: HTMLElement) {\n' +
    '  el.innerHTML = ' + BT + '\n' +
    '    ' + OPEN + ' POR QUE ' + BT + 'data-role' + BT + ' y no ' + BT + 'id' + BT + '. ' + CLOSE + '\n' +
    '    <div data-role="track"></div>\n' +
    '  ' + BT + ';\n' +
    '}\n');
  const b = correr(roto);
  check('el comentario con backtick falla', b.codigo === 1, `salida ${b.codigo}`);
  check('  y senala fichero y linea del backtick', /malo\.ts:3/.test(b.texto));
  check('  y dice en que linea empieza el comentario', /comentario en\s+:\s+3/.test(b.texto));
  check('  y saca el comentario en JSON', /POR QUE/.test(b.texto) && /data-role/.test(b.texto));
  check('  y explica como se arregla', /quita el acento grave|escapa/.test(b.texto));

  // 3 · El mismo comentario, pero en un comentario de TypeScript. Pasa: es
  //     donde se escribe el porqué de las reglas de este guard.
  const enComentario = escribir('comentario', 'ok.ts',
    '// ' + OPEN + ' aqui hay un ' + BT + 'data-role' + BT + ' y esta bien ' + CLOSE + '\n' +
    '/* ' + OPEN + ' y aqui tambien ' + BT + 'id' + BT + ' ' + CLOSE + ' */\n' +
    'export const ok = 1;\n');
  const c = correr(enComentario);
  check('backticks en comentarios de TypeScript pasan', c.codigo === 0, `salida ${c.codigo}`);

  // 4 · En una cadena normal. Pasa: el backtick ahi es un caracter y no cierra
  //     nada. Es el falso positivo mas probable si el lexer no distingue.
  const enCadena = escribir('cadena', 'ok.ts',
    'export const doc = ' + "'" + OPEN + ' un ' + BT + 'dato' + BT + ' ' + CLOSE + "'" + ';\n');
  const d = correr(enCadena);
  check('backticks en cadena normal pasan', d.codigo === 0, `salida ${d.codigo}`);

  // 5 · Backtick ESCAPADO dentro del comentario. Pasa a proposito: es lo que hay
  //     que escribir cuando de verdad se quiere un acento grave en el HTML.
  escribir('escapado', 'ok.ts',
    'export function pintar(el: HTMLElement) {\n' +
    '  el.innerHTML = ' + BT + '\n' +
    '    ' + OPEN + ' por que ' + '\\' + BT + 'data-role' + '\\' + BT + ' ' + CLOSE + '\n' +
    '    <div data-role="track"></div>\n' +
    '  ' + BT + ';\n' +
    '}\n');
  const e = correr(join(raiz, 'escapado'));
  check('el backtick escapado pasa', e.codigo === 0, `salida ${e.codigo}`);

  // 6 · Plantilla ANIDADA dentro de un `${}` con el mismo fallo. Tiene que
  //     FALLAR: es el caso donde un `split('`')` se rindiria, porque los dos
  //     delimitadores estan en la misma linea.
  const anidada = escribir('anidada', 'malo.ts',
    'export function pintar(el: HTMLElement, x: string) {\n' +
    '  el.innerHTML = ' + BT + '\n' +
    '    <div>${x ? ' + BT + '\n' +
    '        ' + OPEN + ' con ' + BT + 'data-role' + BT + ' ' + CLOSE + '\n' +
    '      ' + BT + ' : ""}</div>\n' +
    '  ' + BT + ';\n' +
    '}\n');
  const f = correr(anidada);
  check('la plantilla anidada con backtick tambien falla', f.codigo === 1, `salida ${f.codigo}`);

  // 7 · La plantilla anidada pero SIN fallo: no puede marcar de mas por el solo
  //     hecho de haber dos plantillas en la misma linea.
  escribir('anidada-ok', 'ok.ts',
    'export function pintar(el: HTMLElement, x: string) {\n' +
    '  el.innerHTML = ' + BT + '<div>${x ? ' + BT + '\n' +
    '        ' + OPEN + ' sin acentos ' + CLOSE + '\n' +
    '      ' + BT + ' : ""}</div>' + BT + ';\n' +
    '}\n');
  const g = correr(join(raiz, 'anidada-ok'));
  check('la plantilla anidada sin backtick pasa', g.codigo === 0, `salida ${g.codigo}`);

  // 8 · La documentacion no se mira: un `.md` puede enseñar el patron roto a
  //     proposito —este mismo repo lo hace— y no es codigo.
  mkdirSync(join(raiz, 'doc'), { recursive: true });
  writeFileSync(join(raiz, 'doc', 'notas.md'),
    '# El patron: ' + OPEN + ' un ' + BT + 'dato' + BT + ' ' + CLOSE + '\n', 'utf8');
  const h = correr(join(raiz, 'doc'));
  check('la documentacion no se marca', h.codigo === 0, `salida ${h.codigo}`);

  // 9 · node_modules se ignora: ahi hay tropezones de todo el mundo.
  mkdirSync(join(raiz, 'ignorado', 'node_modules', 'algo'), { recursive: true });
  writeFileSync(join(raiz, 'ignorado', 'node_modules', 'algo', 'x.js'),
    'const a = ' + BT + '\n' + '  ' + OPEN + ' con ' + BT + BT + ' ' + CLOSE + '\n' + BT + ';\n', 'utf8');
  writeFileSync(join(raiz, 'ignorado', 'bien.ts'), 'export const ok = 1;\n', 'utf8');
  const i = correr(join(raiz, 'ignorado'));
  check('node_modules se ignora', i.codigo === 0, `salida ${i.codigo}`);

  // 10 · El fallo DETRAS de un comentario de linea. Esta es la prueba que
  //      importa mas de todas, y existe porque la primera version del lexer se
  //      comia el fichero entero al entrar en un `//`: no volvia a codigo al
  //      ver el salto de linea y todo lo que venia despues le era invisible.
  //      Las pruebas syntheticas de arriba no lo cazaron porque ninguna llevaba
  //      delante un `//`, y el fichero de verdad si. Un guard que depende de que
  //      el fichero empiece por codigo es un guard que no protege.
  escribir('tras-comentario', 'malo.ts',
    '// ===== cabecera del modulo =====\n' +
    '// Toda la logica de la ruleta vive aqui.\n' +
    'export function pintar(el: HTMLElement) {\n' +
    '  el.innerHTML = ' + BT + '\n' +
    '    ' + OPEN + ' con ' + BT + 'data-role' + BT + ' ' + CLOSE + '\n' +
    '    <div data-role="track"></div>\n' +
    '  ' + BT + ';\n' +
    '}\n');
  const k = correr(join(raiz, 'tras-comentario'));
  check('el fallo tras un comentario de linea tambien falla', k.codigo === 1, `salida ${k.codigo}`);
  check('  y senala la linea de verdad', /malo\.ts:5/.test(k.texto));

  // 11 · Y lo mismo tras un comentario de bloque, por el mismo motivo: son dos
  //      modos distintos y los dos se-come-el-fichero si no se cierran bien.
  escribir('tras-bloque', 'malo.ts',
    '/*\n' +
    ' La mecanica del giro.\n' +
    '*/\n' +
    'export function pintar(el: HTMLElement) {\n' +
    '  el.innerHTML = ' + BT + OPEN + ' con ' + BT + 'px-1' + BT + ' ' + CLOSE + BT + ';\n' +
    '}\n');
  const l = correr(join(raiz, 'tras-bloque'));
  check('el fallo tras un comentario de bloque tambien falla', l.codigo === 1, `salida ${l.codigo}`);

  // 12 · Y una comprobacion que no depende del repo: el guard, sobre el codigo
  //      bueno que ya hay, tiene que dar verde. Si el repo entero falla aqui, el
  //      guard marca algo que funciona.
  const m = correr(process.cwd());
  check('el codigo real del repo pasa', m.codigo === 0, `salida ${m.codigo}`);
} finally {
  rmSync(raiz, { recursive: true, force: true });
}

console.log(fallos === 0
  ? '\nEl guard atrapa lo que tiene que atrapar y no marca lo que no debe.'
  : `\n${fallos} prueba(s) mal`);
process.exit(fallos === 0 ? 0 : 1);