// ==========================================================================
//  F96 · EL NUMERITO DICE LA VERDAD, Y EL SEMÁFORO TAMBIÉN
// ==========================================================================
//
//  **LO QUE ESTE BANCO ATA.** El contador de operaciones (`contadorOps.ts`)
//  es la herramienta con la que se cazan los picos de cuota, así que lo
//  primero que tiene que demostrar es que **cuenta lo que Firestore cobra**:
//  ni inventa operaciones que no hubo, ni se come las que hubo, ni pinta un
//  color con un ritmo de otro. Una herramienta que miente es peor que no
//  tenerla, porque manda a recortar donde no duele.
//
//  **LO QUE NO MIDE.** Los relojes reales (latido cada 22,5 s, presencia cada
//  5 min): eso ya lo miden `costeJuegoCheck` y `costeRealCheck` con tiempo de
//  verdad. Aquí el tiempo es el del banco y lo que se afirma es el cableado:
//  cada sitio que toca la red anota su motivo, y el semáforo sale del ritmo.
import { boot, check, resumen, baseSave } from './kit';
import {
  contarOp,
  colorDeRitmo,
  ritmoUltimoMinuto,
  evaluarPico,
  ultimosPicos,
  topMotivos,
  reiniciarContador,
} from '../src/services/contadorOps';

/** Espera a que el `setDoc` encolado termine. */
const asentar = () => new Promise((r) => setTimeout(r, 10));

const db = (): any => (globalThis as any).__MEM_DB__;

async function main() {
  // ---- 1. EL ARRANQUE SE CUENTA, Y CON SUS MOTIVOS ----
  // Cargar también es cuota: si el contador no viera la carga, el numerito
  // diría que arrancar es gratis.
  {
    reiniciarContador();
    const g: any = await boot(baseSave([], { nanites: 5_000 }));
    await g.flush();
    await asentar();
    const top = topMotivos(5).map((t) => t.motivo);
    check('F96: la carga anota su lectura',
      top.includes('carga'), `motivos=${top.join(',')}`);
    check('F96: el guardado de carga anota su escritura',
      top.includes('guardado-users'), `motivos=${top.join(',')}`);
    await g.cleanup?.();
  }

  // ---- 2. EL REPOSO NO SE INVENTA NADA ----
  // B28 dejó de escribir cuando nada cambia; el contador tiene que ver lo
  // mismo que el stub, o el semáforo se pondría naranja solo.
  {
    reiniciarContador();
    const g: any = await boot(baseSave([], { nanites: 5_000 }));
    await g.flush();
    await asentar();
    db().escrituras = 0;
    reiniciarContador();
    for (let n = 0; n < 120; n++) await g.flush();
    await asentar();
    const { escrituras, lecturas } = ritmoUltimoMinuto();
    check('F96: 120 guardados en reposo no escriben ni se cuentan',
      (db().escrituras ?? 0) === 0 && escrituras === 0 && lecturas === 0,
      `stub=${db().escrituras ?? 0} contador=W${escrituras} R${lecturas}`);
    await g.cleanup?.();
  }

  // ---- 3. JUGAR SÍ SE CUENTA, Y CON EL MOTIVO BUENO ----
  {
    reiniciarContador();
    const g: any = await boot(baseSave([], { nanites: 5_000 }));
    await g.flush();
    await asentar();
    reiniciarContador();
    for (let n = 0; n < 60; n++) g.click?.();
    await g.flush();
    await asentar();
    const top = topMotivos(5).map((t) => t.motivo);
    check('F96: sesenta clics anotan el guardado de la partida',
      top.includes('guardado-users'), `motivos=${top.join(',')}`);
    await g.cleanup?.();
  }

  // ---- 4. EL SEMÁFORO, CON LOS NÚMEROS MEDIDOS ----
  // Verde hasta 6 (el idle sano son ~4-5), naranja hasta 12, rojo más allá.
  // Si alguien mueve un umbral en `contadorOps.ts`, es aquí donde canta.
  {
    check('F96: el idle sano (4W) es verde',
      colorDeRitmo(4, 0) === 'verde', colorDeRitmo(4, 0));
    check('F96: el tope verde (6W) sigue siendo verde',
      colorDeRitmo(6, 0) === 'verde', colorDeRitmo(6, 0));
    check('F96: siete escrituras ya son naranja',
      colorDeRitmo(7, 0) === 'naranja', colorDeRitmo(7, 0));
    check('F96: trece escrituras son rojo',
      colorDeRitmo(13, 0) === 'rojo', colorDeRitmo(13, 0));
    check('F96: abrir el ranking (40R de golpe) es naranja, no rojo',
      colorDeRitmo(0, 40) === 'naranja', colorDeRitmo(0, 40));
    check('F96: repetir la ráfaga (41R) sí es rojo',
      colorDeRitmo(0, 41) === 'rojo', colorDeRitmo(0, 41));
  }

  // ---- 5. EL PICO SE ABRE EN ROJO Y SE CIERRA EN VERDE ----
  // Trece anotaciones seguidas son un minuto a 13W: el pico tiene que abrirse
  // solo, sin que nadie lo declare. Y al vaciar el contador el ritmo vuelve a
  // cero: el pico se cierra y queda el máximo anotado.
  {
    reiniciarContador();
    for (let n = 0; n < 13; n++) contarOp('escritura', 'users', 'guardado-users');
    evaluarPico();
    const abierto = ultimosPicos().at(-1);
    check('F96: un minuto a 13W abre un pico',
      abierto != null && abierto.fin === null && abierto.maxW >= 13,
      `picos=${ultimosPicos().length} maxW=${abierto?.maxW ?? '-'}`);
    for (let n = 0; n < 2; n++) contarOp('escritura', 'users', 'guardado-users');
    evaluarPico();
    check('F96: en rojo sostenido no se abre un segundo pico',
      ultimosPicos().length === 1 && (ultimosPicos()[0].fin ?? null) === null,
      `picos=${ultimosPicos().length}`);
    // **EL CIERRE SE EVALÚA EN EL FUTURO, Y ES LA ÚNICA FORMA HONESTA.** El
    // pico se cierra cuando el ritmo cae, y el ritmo cae 60 segundos después
    // de la última operación. Esperar un minuto de verdad en un banco es un
    // minuto de suite por comprobación; `evaluarPico(ahora)` acepta el reloj
    // y el futuro de mentira ejerce el mismo camino que el futuro de verdad.
    evaluarPico(Date.now() + 61_000);
    const cerrado = ultimosPicos().at(-1);
    check('F96: un minuto después el pico se cierra con su motivo',
      cerrado?.fin !== null && cerrado?.motivoTop === 'guardado-users',
      `fin=${cerrado?.fin ?? '-'} motivo=${cerrado?.motivoTop ?? '-'}`);
  }

  // ---- 6. LA TABLA DEL RANKING DICE CUÁNTAS FILAS TRAJO ----
  // El pico de la captura (27 lecturas en un minuto) solo se explica si el
  // motivo lleva el tamaño de la ráfaga. Veintisiete filas son 27 lecturas.
  {
    reiniciarContador();
    const { getTopRankings, limpiarCacheRanking } = await import('../src/services/rankingService');
    limpiarCacheRanking();
    db().__rankingDocs = Array.from({ length: 27 }, (_, i) => ({
      uid: `j${i}`, userId: `j${i}`, username: `J${i}`, score: 1000 - i,
    }));
    db().consultas = 0;
    const filas = await getTopRankings();
    const top = topMotivos(5);
    const motivo = top.find((t) => t.motivo === 'ranking-tabla');
    check('F96: abrir la tabla anota una lectura con sus 27 filas',
      db().consultas === 1 && filas.length === 27 && motivo?.n === 1,
      `consultas=${db().consultas} filas=${filas.length} motivo=${motivo?.n ?? 0}`);
    delete db().__rankingDocs;
  }

  resumen('F96: el contador cuenta lo que se cobra y el semáforo dice lo que hay');
}

export default main();
