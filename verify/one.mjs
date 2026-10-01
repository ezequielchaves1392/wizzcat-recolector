// Arranque de UN banco suelto, sin Firebase.
//
// Uso: node verify/one.mjs <nombreDelBanco>
//
// El entorno es el MISMO que usa `run.mjs`, importado de `entorno.mjs`: DOM
// completo, `localStorage` que guarda y `setInterval` anulado. Estaba duplicado
// aquí y allí, y las dos copias divergieron —a este le faltaban `querySelector` y
// `classList`— de modo que cuatro de los once bancos no se podían depurar en
// solitario y uno no imprimía nada. La regla es la del proyecto: un banco que
// funciona con el runner tiene que funcionar también con el depurador.
import { instalarEntorno, instalarProceso } from './entorno.mjs';

globalThis.__MEM_DB__ = {};
instalarEntorno();
instalarProceso();

const banco = process.argv[2] ?? 'sellCheck';
const { default: pruebas } = await import(`./out-one/${banco}.js`);
await pruebas;
// Sin este `exit`, el proceso se queda vivo por temporizadores de los avisos y el
// banco tarda en terminar aunque ya haya impreso su resumen.
process.exit(process.exitCode ?? 0);