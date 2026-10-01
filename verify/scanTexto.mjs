// ==========================================================================
//  Barrido de caracteres colados
//
//  Uso:  node verify/scanTexto.mjs [carpeta]
//        npm run scan
//        npm run verify        (lo ejecuta antes de los bancos)
//
//  SI CAMBIAS EL RANGO DE MAS ABAJO, CORRE `npm run scan:probar`. El rango no
//  es una opinion: hay bloques dentro y fuera por motivos comprobados, y sin
//  las pruebas no hay manera de saber que un cambio no ha metido un falso
//  positivo en codigo legitimo ni ha dejado fuera un caso real.
//
//  POR QUE ESTE FICHERO EXISTE.
//
//  En una tarde aparecieron caracteres de otro alfabeto dentro de codigo,
//  escritos a mano por dos agentes distintos:
//
//    - verify/buyCheck.ts: un identificador con un ideograma colado en medio.
//      Eso no es un comentario: rompe el build entero con un "Unexpected
//      token" que no senala el origen real.
//
//    - src/ui/naniteCounter.ts: un ideograma en mitad de una frase, DENTRO de
//      un comentario. Ese es el peligroso: no rompe nada, no falla ningun banco
//      y ninguna prueba lo delata. Estuvo commiteado sin que nadie lo notara.
//
//  Y hay un motivo por el que se cuelan tan facil: la consola de Windows los
//  imprime como `?`. Buscar "el caracter raro" a ojo no funciona, porque el
//  terminal no lo ensena. Por eso este script saca la linea con
//  JSON.stringify: asi los bytes exactos salen aunque la consola no sepa
//  representarlos.
//
//  ---------------------------------------------------------------------------
//  POR QUE EL RANGO ES ESTE Y NO "TODO LO QUE NO SEA LATINO".
//  ---------------------------------------------------------------------------
//
//  La primera version hacia exactamente eso, y el propio repo la desmentia:
//
//    - src/components/auth.ts:226 tiene katakana DE MEDIO ANCHO a proposito:
//      es una tabla de glifos para una fuente. Codigo legitimo.
//    - docs/CAMBIOS-MACRO.md:47 usa una sigma griega (Sigma) en una formula.
//      Documentacion legitima.
//    - verify/buyCheck.ts empieza por BOM (U+FEFF). Es la huella que deja
//      PowerShell al escribir con -Encoding UTF8, no corrupcion.
//
//  Un veto general habria marcado las tres. Un guard que grita sobre codigo
//  bueno acaba ignorado, y un guard ignorado no protege de nada. Asi que cada
//  bloque entra o sale por un motivo, y los motivos estan probados en
//  `probarAlcance.mjs`.
//
//  ---------------------------------------------------------------------------
//  QUE SE QUEDA, Y POR QUE
//  ---------------------------------------------------------------------------
//
//   2E80-303F  Radicales y kangxi, signos CJK, puntuacion CJK, hiragana y
//              katakana. Cero apariciones hoy en el repo.
//   3040-9FFF  Kana extendido, jamo hangul, unificados CJK, jamo compat,
//              extension A. Sin apariciones.
//   AC00-D7AF  Silabas hangul. Sin apariciones.
//   F900-FAFF  Ideogramas de compatibilidad CJK.
//   FE30-FE4F  Formas de compatibilidad CJK. LA PRIMERA VERSION NO LO TENIA.
//   FE70-FEFF  Formas de presentacion arabes B, con el BOM excluido a mano.
//   FF01-FF60  Formas de ancho completo.
//
//  ---------------------------------------------------------------------------
//  QUE SE QUEDA FUERA, Y POR QUE
//  ---------------------------------------------------------------------------
//
//   FF61-FF9F  Katakana de MEDIO ancho: `auth.ts` lo usa a proposito. Si
//              estuviera dentro, el guard marcaria codigo correcto.
//   FEFF       BOM. Lo escribe PowerShell, no es contenido.
//   Griego, cirilico, hebreo  La Sigma de la formula de `CAMBIOS-MACRO.md` es
//              legitima, y un idioma futuro los legitimaria igual.
//
//  ---------------------------------------------------------------------------
//  COMO DECIDE
//  ---------------------------------------------------------------------------
//
//  En codigo, uno de estos caracteres es basura: FALLA. En documentacion avisa
//  y sigue: el AGENTS.md lo escribe otra persona a la vez, y bloquearle el
//  banco entero por un caracter seria un falso positivo.
// ==========================================================================

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

// ==========================================================================
//  Que se mira
// ==========================================================================

/** Se ignoran: no son codigo nuestro y son enormes. */
const IGNORAR_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'out-one', '.vite', 'coverage', '.turbo'
]);

/** Ficheros donde uno de estos caracteres rompe algo. */
const CODIGO = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.html', '.json'
]);

/** Ficheros donde solo se avisa. */
const DOCUMENTOS = new Set(['.md', '.txt']);

/**
 * Los bloques que se rechazan, con `u` porque los emoji de los apartados de
 * "NO deben saltar" estan fuera de UTF-16 y sin esta bandera ni se detectan.
 *
 * FF61-FF9F se deja fuera a proposito: katakana de medio ancho. Y el BOM
 * (U+FEFF) queda fuera del rango de formas arabes B, asi que se exclude
 * entero el tramo FF01-FF60 y no hace falta exceptuar nada.
 */
const EXTRANOS = /[\u2e80-\u303f\u3040-\u9fff\uf900-\ufaff\ufe30-\ufe4f\ufe70-\ufefc\uac00-\ud7af\uff01-\uff60]/gu;

// ==========================================================================
//  Recorrido
// ==========================================================================

const extension = (ruta) => {
  const i = ruta.lastIndexOf('.');
  return i < 0 ? '' : ruta.slice(i).toLowerCase();
};

/**
 * Devuelve los ficheros con caracteres strangers, separados en los que ROMPEN
 * (codigo) y los que solo AVISAN (documentacion).
 */
function escanear(raiz) {
  const rotos = [];
  const avisados = [];

  (function anda(dir) {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      if (IGNORAR_DIRS.has(entrada.name)) continue;

      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) { anda(ruta); continue; }

      // Los junctions de Windows llegan como symlink y no se siguen: si se
      // siguieran, un node_modules enlazado se leeria entero.
      if (entrada.isSymbolicLink()) continue;

      const ext = extension(ruta);
      const esDocumento = DOCUMENTOS.has(ext);
      if (!CODIGO.has(ext) && !esDocumento) continue;

      const texto = readFileSync(ruta, 'utf8');
      texto.split(/\r?\n/).forEach((linea, i) => {
        const hallados = linea.match(EXTRANOS);
        if (!hallados) return;

        const sitio = {
          fichero: relative(raiz, ruta).split(sep).join('/'),
          linea: i + 1,
          caracteres: hallados,
          codepoints: hallados
            .map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'))
            .join(' '),
          texto: linea.trim().slice(0, 90)
        };

        (esDocumento ? avisados : rotos).push(sitio);
      });
    }
  })(raiz);

  return { rotos, avisados };
}

// ==========================================================================
//  Informe
// ==========================================================================

/**
 * Imprime un hallazgo.
 *
 * El JSON.stringify de la linea es a proposito: es la unica forma de que el
 * terminal ensene el caracter en vez de `?`. Si esto se quita, el script vuelve
 * a ser inutil en la mitad de los casos que existen para cazar.
 */
function informar(sitio) {
  console.log(`  ${sitio.fichero}:${sitio.linea}`);
  console.log(`    caracteres : ${sitio.caracteres.join(' ')}  (${sitio.codepoints})`);
  console.log(`    linea      : ${JSON.stringify(sitio.texto)}`);
}

// ==========================================================================
//  Entrada
// ==========================================================================

const raiz = resolve(process.argv[2] || process.cwd());

if (!statSync(raiz).isDirectory()) {
  console.error(`No es una carpeta: ${raiz}`);
  process.exit(2);
}

const { rotos, avisados } = escanear(raiz);

if (avisados.length) {
  console.log(`\nAVISO: ${avisados.length} caracter(es) fuera de latin en documentacion. No rompe.`);
  avisados.forEach(informar);
}

if (rotos.length) {
  console.error(`\n${rotos.length} caracter(es) fuera de latin en CODIGO.`);
  console.error('Rompe el build si es codigo, y en un comentario no se ve nunca.');
  rotos.forEach(informar);
  console.error('\nCada uno se borra dejando el resto de la frase intacto.');
  process.exit(1);
}

console.log('\nOK: ningun caracter fuera de latin en el codigo.');
process.exit(0);