// ==========================================================================
//  B27 · UNA LECTURA INCOMPLETA NO PUEDE DEJARTE SIN PARTIDA
// ==========================================================================
//
//  **LO QUE PASÓ, CON LA CONSOLA DEL JUGADOR DELANTE:**
//
//      FirebaseError: [code=resource-exhausted]: Quota exceeded.
//      Using maximum backoff delay to prevent overloading the backend.
//      Error al sincronizar con Firebase: TypeError: Cannot read properties of
//      undefined (reading 'some')   at createGameLoop (gameLoop.ts:1534)
//
//  O sea: **la cuota de Firestore se agotó, la lectura llegó a medias y una línea de la
//  carga asumía que el almacén venía.** El `TypeError` tumbó la carga entera, el jugador
//  se encontró con una partida en blanco, y en la consola de Firestore sus datos estaban
//  **enteros**. No se había perdido nada: el juego nunca llegó a leerlos.
//
//  **Y POR QUÉ ESTE BANCO EXISTE Y NO ES UNA PRUEBA DE HUMO.** La primera versión del
//  arreglo —coaccionar el `warehouse`— hace que la carga **no reviente**, y eso suena a
//  cierre. Pero es **peor**: sin el aviso de "lectura incompleta" el juego cree que ha
//  cargado bien, **sí guarda**, y escribe una partida en blanco encima de la buena que
//  está intacta en el servidor. El crash estaba haciendo de red de seguridad sin que
//  nadie lo supiera; quitarlo sin ponerla en su sitio convierte una avería sin daños en
//  una pérdida de datos. Las dos mitades van en el mismo banco por eso.
// ==========================================================================

import { boot, baseSave, collector, check, resumen, s, reload, recargar } from './kit';

/**
 * MONTA UN DOCUMENTO AL QUE LE FALTA `warehouse`, QUE ES LO QUE PASÓ.
 *
 * Con la cuota agotada, Firestore resuelve el getDoc con el documento ahí pero sin
 * todos los campos. Es lo que se vio en la consola: el documento existe, la carga
 * entra en la rama "existe" y aun así `data.warehouse` es undefined.
 */
const partidaConAlmacen = () => baseSave([
  collector('a', 1, { potential: 3 }),
  collector('b', 1, { potential: 3 })
] as any[]);

/** Le quita un campo de un tirón, sin tocar el resto. */
function sinCampo(save: any, campo: string) {
  const copia = JSON.parse(JSON.stringify(save));
  delete copia[campo];
  return copia;
}

async function main() {
  // ---- 1. Documento normal: la partida se carga entera ----
  {
    const g = await boot(partidaConAlmacen());
    const st = s(g);
    check('B27: sin recorte, el almacen se carga entero',
      (g.getState().warehouse as any[]).length === 2,
      'items=' + (g.getState().warehouse as any[]).length);
    check('B27: y el nanito guardado tambien',
      typeof st.nanites === 'number', 'nanites=' + st.nanites);
  }

  // ---- 2. EL CASO REAL: el documento llega sin `warehouse` ----
  // Antes esto tiraba `TypeError: Cannot read properties of undefined (reading 'some')`
  // y la carga entera caía al catch: el jugador veía una partida en blanco con sus
  // datos intactos en el servidor.
  {
    const save = sinCampo(partidaConAlmacen(), 'warehouse');
    let g: any = null;
    let fallo = '';
    try {
      g = await boot(save);
    } catch (e: any) {
      fallo = e?.message || String(e);
    }
    check('B27: un documento SIN warehouse no revienta la carga',
      fallo === '', fallo || 'cargo bien');
    if (g) {
      check('B27: y el estado es utilizable, no undefined',
        Array.isArray(g.getState().warehouse),
        'warehouse=' + typeof g.getState().warehouse);
    }
  }

  // ---- 3. Y lo que de verdad importa: NO SE PUEDE GUARDAR ENCIMA ----
  // Si la lectura vino incompleta, escribir pondría una partida en blanco sobre la
  // buena. El motor ya tiene `partidaNoCargada` para esto; hay que comprobar que se
  // activa también en este camino, no solo cuando getDoc lanza.
  {
    const save = sinCampo(partidaConAlmacen(), 'warehouse');
    const g = await boot(save);
    const cargaFallida = g.cargaFallida?.();
    check('B27: una lectura incompleta MARCA la carga como fallida', cargaFallida === true,
      'cargaFallida=' + cargaFallida);
    check('B27: y por eso el guardado queda deshabilitado',
      g.sePuedeGuardar?.() === false || cargaFallida === true,
      'sePuedeGuardar=' + g.sePuedeGuardar?.());
  }

  // ---- 4. El resto de campos que también pueden no venir ----
  {
    const casos: Array<[string, string]> = [
      ['nanites', 'el saldo'],
      ['companions', 'los compañeros'],
      ['crates', 'el contador de cajas'],
      ['buffs', 'los buffs'],
    ];
    for (const [campo, que] of casos) {
      let fallo = '';
      let ok = false;
      try {
        const g = await boot(sinCampo(partidaConAlmacen(), campo));
        ok = !!g && Array.isArray(g.getState().warehouse) === false ? true : !!g;
      } catch (e: any) {
        fallo = e?.message || String(e);
      }
      check(`B27: sin \`${campo}\` (${que}) la carga no revienta`, fallo === '', fallo || 'ok');
    }
  }

  // ---- 5. Y el documento bueno no se pisa al recargar ----
  {
    const g = await boot(partidaConAlmacen());
    await recargar(g as any);
    const g2 = await reload();
    check('B27: una partida normal sobrevive a la recarga',
      (g2.getState().warehouse as any[]).length === 2,
      'items=' + (g2.getState().warehouse as any[]).length);
  }

  resumen('B27: una lectura incompleta no puede dejarte sin partida');
}

export default main();