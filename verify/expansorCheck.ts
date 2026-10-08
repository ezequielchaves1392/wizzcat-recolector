// ==========================================================================
//  B24 · NINGÚN EXPANSOR COMPRABLE DICE QUE NO TIENE EFECTO CONOCIDO
// ==========================================================================
//
//  > "me dice este consumible no tiene efecto conocido lo podríamos arreglar?"
//
//  **LO QUE SE SABÍA Y LO QUE PASÓ AL MIRAR.** La entrada apuntaba a que
//  `EXPANSOR_CONSUMABLES` se construye con `Object.fromEntries` sobre `EXPANSOR_TIERS` y a
//  que el `switch` de `useConsumable` seguía hablando de `expansorT{n}`. **Las dos cosas
//  son ciertas y ninguna es el fallo**: los cuatro `buffId` nuevos están bien
//  (`expansorInicial`, `expansorIntermedio`, `expansorAvanzado`, `expansorSupremo`), el
//  `switch` los tiene escritos uno a uno (gameLoop.ts:5106), el botín de las cajas mete
//  `buffId: def.buffId` y la inferencia por nombre los reconoce.
//
//  **O SEA QUE LA HIPÓTESIS APUNTABA AL SITIO EQUIVOCADO, Y POR ESO ESTE BANCO EMPIEZA
//  POR EL HECHO Y NO POR LA TEORÍA.** El mensaje "no tiene efecto conocido" sale de tres
//  sitios distintos y **los tres son el mismo `!buffId`** —o un `switch` que no conoce la
//  clave—. Ese texto es **la señal de un dato que falta**, no de una tabla mal escrita: así
//  que la pregunta es **qué item llega sin `buffId`**, no "dónde está el expansor".
import { boot, check, resumen, baseSave, consumable } from './kit';
import { EXPANSOR_TIERS, EXPANSOR_CONSUMABLES, CONSUMABLES, expansorPorBuff } from '../src/data/store';

async function main() {
  // ---- 1. LA TABLA: TODO EXPANSOR COMPRABLE ESTÁ EN `CONSUMABLES` ----
  //
  // **POR QUÉ ESTA COMPROBACIÓN VA PRIMERO Y SOBRE LA TABLA, NO SOBRE EL MOTOR.** Un
  // expansor que no está en `CONSUMABLES` no tiene carta, no tiene texto y no tiene a quién
  // preguntarle: el fallo aparecería en tres sitios a la vez y no se sabría de dónde. La
  // tabla es la base, y **si la base está bien, el fallo está en el item que llega**.
  for (const e of EXPANSOR_TIERS) {
    check(`B24: el expansor "${e.name}" esta en la tabla de consumibles`,
      !!CONSUMABLES[e.buffId as keyof typeof CONSUMABLES]
        && (EXPANSOR_CONSUMABLES as any)[e.buffId]?.name === e.name,
      `buffId=${e.buffId}`);
  }

  // ---- 2. Y CADA UNO RESUELVE A SU TRAMO ----
  //
  // `expansorPorBuff()` es el que traduce el `buffId` al tramo con su techo. Si un
  // expansor de la tabla no resolviera, `useConsumable` devolvería su propio mensaje, que
  // **también es un "no funciona"**, y el jugador vería dos textos distintos para el mismo
  // fallo según por dónde lo mirara.
  for (const e of EXPANSOR_TIERS) {
    const tipo = expansorPorBuff(e.buffId);
    check(`B24: y "${e.name}" resuelve a su tramo (techo ${e.maxCap})`,
      !!tipo && tipo?.maxCap === e.maxCap,
      `buffId=${e.buffId} -> ${tipo ? `techo ${tipo.maxCap}` : 'NO RESUELVE'}`);
  }

  // ---- 3. Y EL CASO REAL: USAR EL EXPANSOR DE VERDAD ----
  //
  // **LO QUE ESTA COMPROBACIÓN ES Y NO ES.** No es "el motor funciona": es **que el item del
  // almacén trae su `buffId`**, que es lo que el motor lee. Si un expansor llegara sin ese
  // campo, `useConsumable` haría `item.buffId ?? inferBuffIdFromName(item.name)` y, como la
  // inferencia **sí** reconoce los cuatro nombres, se salvaría por el nombre —**y por eso el
  // fallo sería intermitente**: solo aparecería con items cuyo nombre no cuadre, que es
  // exactamente el tipo de bug que se cuela una vez y no se vuelve a ver.
  //
  // **Y POR QUÉ NO SE USA `??` PARA ARREGLARLO A LO BRUTO.** Sustituirlo por un "si no hay
  // buffId, pon el de la tabla" **esconddría** un item mal creado detrás de la inferencia,
  // y volvería a aparecer la próxima vez que el nombre cambie. Primero se ve.
  {
    for (const e of EXPANSOR_TIERS) {
      const g: any = await boot(baseSave([consumable('x1', e.buffId, 1, { name: e.name })], {
        warehouseCapacity: 10
      }));
      const item = g.getState().warehouse.find((w: any) => w.id === 'x1');
      const r = g.useConsumable('x1');
      const capacidad = g.getState().warehouseCapacity;

      check(`B24: usar "${e.name}" sube el almacen y no dice que no tiene efecto`,
        r.ok === true && capacidad === 10 + 1,
        `ok=${r.ok}msg="${r.msg ?? ''}" capacidad=${capacidad} buffId=${item?.buffId}`);
      await g.cleanup?.();
    }
  }

  // ---- 4. Y EL CASO QUE SÍ ESTÁ ROTO, QUE ES EL DE VERDAD ----
  //
  // **AQUÍ ESTÁ EL BUG, Y NO ES EL DE LA TABLA.** Un item **sin `buffId`** tiene que
  // resolverse por el nombre, porque así se leen los expansores de las partidas viejas, que
  // no tenían el campo. Si la inferencia **no** reconoce el nombre, el item **no tiene
  // efecto conocido** — y eso es lo que le pasó al jugador.
  //
  // **LO QUE SE COMPRUEBA ES LA FRONTERA DE LA INFERENCIA, NO UN CASO QUE YA FUNCIONA.**
  // Los cuatro nombres oficiales están cubiertos por una línea cada uno, y por eso funcionan.
  // Lo que **no** hay es un expansor que no se sepa de dónde viene. **Y AQUÍ ESTÁ LA
  // AGUJA:** la inferencia reconoce `expansor inicial`, `intermedio`, `avanzado`, `supremo`
  // y el genérico `expansor`. **Un expansor cuyo nombre lleve otra cosa cae en el genérico**,
  // que devuelve `warehouseExpander` —**un buffId que sí existe pero que NO está en la tabla**
  // de tramos—, y ese item se usaría con el **+1 antiguo** en vez de con sus cinco ranuras.
  {
    // El nombre con el que **realmente** se guardan los expansores viejos, que es con el
    // número de tier, es el único que la inferencia tiene que saber además de los cuatro.
    const g: any = await boot(baseSave([{
      id: 'viejo', name: 'Expansor T7', type: 'consumable', details: 'x',
      rarity: 'Épico', tier: 0, sellPrice: 0, stackable: true, stackCount: 1
    }], { warehouseCapacity: 80 }));

    const r = g.useConsumable('viejo');
    check('B24: un expansor viejo (T7, sin buffId guardado) tambien se usa',
      r.ok === true,
      `ok=${r.ok} msg="${r.msg ?? ''}"`);
    await g.cleanup?.();
  }

  // ---- 5. Y EL BUG DE VERDAD, QUE NO ES UN EXPANSOR ----
  //
  // **LO QUE PASÓ AL SEGUIR EL HECHO EN VEZ DE LA HIPÓTESIS.** Los trece casos de arriba
  // pasan: la tabla está bien, los cuatro expansores resuelven, el `switch` los tiene
  // escritos uno a uno, el botín de las cajas pone `buffId` y hasta un expansor viejo sin el
  // campo guardado se resuelve por el nombre. **La hipótesis de PENDIENTES apuntaba a los
  // expansores y era falsa**, y el jugador además decía "**este consumible**", no "el
  // expansor" — que era la pista que yo pasé por alto dos veces.
  //
  // **EL CULPABLE: F4 RETIRÓ `clickBuff` Y `passiveBuff` DEL CATÁLOGO Y NO DEL `switch`.**
  // F4 quitó las dos tarjetas comprables porque un buff pasivo comprado rompe R10. Se
  // quitaron de la tienda y de `CONSUMABLES_SIN_EXPANSOR`, y sus buffIds no están en
  // `inferBuffIdFromName()` ni en la barra asignable —todo bien—. **Pero el `switch` de
  // `useConsumable` no tiene `case` para ellos**, y un item con `buffId: 'clickBuff'` pasa la
  // puerta de la línea 5063 (porque es un `buffId` **verdadero**) y se precipita al `default`
  // de la línea 5186.
  //
  // **Y POR QUÉ LE PASA A UN JUGADOR Y A OTRO NO.** El item viene de un guardado **anterior a
  // F4**: alguien que ya tenía "Clics x2" comprado lo sigue teniendo en el almacén, y cada vez
  // que lo intenta usar le sale el mensaje. **Un jugador nuevo no lo ve nunca**, porque no le
  // llega el item. Es un fallo de una partida vieja, que es donde caen casi todos los fallos
  // que no se ven al probar.
  //
  // **NO ES QUE EL EFECTO FALTE: ES QUE FUE RETIRADO A PROPÓSITO.** Así que el arreglo **no**
  // puede ser devolverle el buff —eso volvería a romper R10 por la puerta de atrás—. Lo que
  // hay que decir es **qué es ese item y por qué ya no se usa**, que es lo que el jugador
  // merece: no un "no tiene efecto conocido" para una carta que él compró.
  {
    for (const viejo of ['clickBuff', 'passiveBuff']) {
      const g: any = await boot(baseSave([consumable('v1', viejo, 1, {
        name: viejo === 'clickBuff' ? 'Amplificador de Click' : 'Amplificador de Pasivo'
      })], {}));
      const r = g.useConsumable('v1');
      // **LA CADENA ES LA DEL MOTOR, COPIADA, Y NO UNA EXPRESIÓN REGULAR.** La primera
      // versión buscaba `/efecto desconocido/i` y **la comprobación pasaba en falso**: el
      // mensaje real dice "no tiene efecto **conocido**", y la expresión no coincidía con
      // nada, el `!` daba `true` y el banco daba verde **sin haber comprobado el fallo que
      // existía**. Una comprobación que pasa porque su patrón no encuentra nada es peor que
      // no tenerla: **parece que vigila**.
      //
      // Y **NO SE COMPRUEBA LEYENDO EL FICHERO**, porque `node:fs` no llega a un banco:
      // Vite compila sin saber que lo ejecuta `node` y resuelve los builtins como si fueran
      // de navegador. Eso costó cuatro intentos en B31 y aquí no se repite.
      const MENSAJE = 'Este consumible no tiene efecto conocido.';
      check(`B24: un item viejo con buffId "${viejo}" NO dice eso`,
        !(typeof r.msg === 'string' && r.msg.includes(MENSAJE)),
        `ok=${r.ok} msg="${r.msg ?? ''}"`);
      await g.cleanup?.();
    }
  }

  resumen('B24: ningun expansor comprable dice que no tiene efecto conocido');
}

export default main();
