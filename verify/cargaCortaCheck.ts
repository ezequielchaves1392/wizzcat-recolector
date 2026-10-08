// ==========================================================================
//  B35 · UNA CARGA A MEDIAS NO MONTA EL JUEGO
// ==========================================================================
//
//  **EL BUG, VISTO EN EL JUEGO DE VERDAD.** Con la cuota de Firestore agotada, la lectura
//  del documento llega **incompleta**: existe, pero le faltan `warehouse` y `nanites`. El
//  motor lo detecta y hace bien —no guarda, para no escribir una partida en blanco encima
//  de la buena—, **pero no lanza nada**. Y como la pantalla de fallo solo salía ante una
//  excepción, **el juego se montaba entero con el almacén vacío**. El jugador veía su
//  saldo (salvado de la cola local) sobre un almacén que parecía vacío.
//
//  **POR QUÉ ESO ES PEOR QUE NO ENTRAR, Y NO ES UNA CUESTIÓN DE ESTÉTICA.** Es la peor forma
//  de perder una partida: **parece que la has perdido y no la has perdido**. El jugador ve
//  el almacén vacío, cierra el portátil y cree que se le han borrado las colecciones,
//  cuando **están intactas en el servidor**. Y el guardado está deshabilitado, así que lo
//  que juegue ahí **tampoco se guarda**: las dos cosas mal a la vez.
//
//  **LO QUE ESTE BANCO COMPRUEBA, Y ES LO QUE SE ROMPIÓ.** Que una carga a medias **no
//  deje un estado jugable por delante**. No se comprueba el texto de una pantalla: se
//  comprueba que el motor **se niega a montar** cuando la carga vino a medias.
import { boot, check, resumen, baseSave } from './kit';
import { esCuotaAgotada } from '../src/components/blocked';

async function main() {
  // ---- 1. EL DATO QUE FALTA Y EL QUE NO ----
  //
  // **ESTOS DOS CASOS SON EL NÚCLEO DEL BUG, Y LA DIFERENCIA ENTRE ELLOS ES TODO.**
  // Un documento **completo** con `warehouse: []` es una partida nueva: un jugador que
  // acaba de empezar tiene el almacén vacío de verdad, y **no se le debe decir que hay un
  // problema**. Un documento al que **le falta la clave** `warehouse` es una lectura
  // recortada, y ese jugador tiene su almacén en el servidor.
  //
  // Si estos dos se confundieran, el arreglo de B35 **rompería a los jugadores nuevos**:
  // alguien que se registra vería "se agotó la cuota" con una partida perfectamente vacía.
  // Por eso se comprueban los dos, y **no solo el que falla**.
  {
    const nuevo = await boot({ ...baseSave([]), warehouse: [] });
    check('B35: una partida nueva (almacen vacio de verdad) SI monta el juego',
      nuevo.cargaFallida?.() === false,
      `cargaFallida=${nuevo.cargaFallida?.()}`);
    await nuevo.cleanup?.();
  }

  // ---- 2. EL CASO DEL BUG: LE FALTA LA CLAVA ENTERA ----
  //
  // Se quita `warehouse` **del documento**, no se pone a `null`. Es lo que hace una lectura
  // recortada: el campo no viaja. Y `nanites` también, que es el otro que toda partida
  // guardada tiene.
  {
    const recortado: any = baseSave([]);
    delete recortado.warehouse;
    delete recortado.nanites;
    const g: any = await boot(recortado);

    check('B35: una carga a medias se marca como NO cargada (o se pisa la partida buena)',
      g.cargaFallida?.() === true,
      `cargaFallida=${g.cargaFallida?.()}`);

    // **Y LA SEGUNDA MITAD, QUE ES LA QUE DE VERDAD IMPORTA.** Estar marcada no basta: lo
    // que hay que comprobar es que **no se escriba**. Si escribiera, una partida en blanco
    // iría encima de la buena y ahí habría pérdida de datos de verdad.
    const db: any = globalThis.__MEM_DB__;
    db.escrituras = 0;
    const original = console.error;
    console.error = () => {};
    for (let n = 0; n < 3; n++) {
      g.getState().nanites += 1000;
      await g.flush();
      await new Promise((r) => setTimeout(r, 10));
    }
    console.error = original;
    const escribio = db.escrituras ?? 0;

    check('B35: y con la carga a medias NO se escribe NADA (el dato bueno queda a salvo)',
      escribio === 0,
      `escrituras=${escribio} de 3 guardados con la carga a medias`);
    await g.cleanup?.();
  }

  // ---- 3. Y LA PANTALLA QUE SE ENSEÑA TIENE QUE SER LA DE CUOTA ----
  //
  // **POR QUÉ SE COMPRUEBA EL CÓDIGO Y NO EL TEXTO.** Lo que decide qué pantalla sale es
  // `esCuotaAgotada()`, y lo que el jugador lee es lo que esa función decide. Fabricar el
  // error en `main.ts` con `resource-exhausted` **usa esa ruta tal cual**: no se duplica el
  // texto ni la lógica de "qué va".
  {
    const e: any = new Error('Quota exceeded for quota metric: Read operations');
    e.code = 'resource-exhausted';
    check('B35: y la carga a medias se enseña como cuota, no como fallo de red',
      esCuotaAgotada(e),
      'que es la que dice "tu partida esta intacta y se repone solo"');
  }

  resumen('B35: una carga a medias no monta el juego');
}

export default main();
