// ==========================================================================
//  Banco de pruebas de los MOVIMIENTOS en la mochila
//
//  Aqui se prueba `moveItems` del game loop, que es donde de verdad se reordena
//  el almacen, separado del `filterCheck` que prueba la traduccion de celda a
//  destino. La separacion es a proposito: si los dos fallan a la vez no se sabe
//  cual de los dos es el culpable, y son fallos con sintomas opuestos.
//
//  Lo que se comprueba:
//
//  - Que se REORDENA y no se edita. Mover no puede cambiar el numero de items,
//    ni los nanites, ni los contadores, ni el contenido de ningun item.
//  - Que el resultado es el orden pedido: delante del ancla, detras, o al final.
//  - Que el lado del ancla es lo que decide la posicion final, y que el item cae
//    en la CELDA que el jugador senalo y no en la de al lado.
//  - Que los casos imposibles se rechazan en vez de destrozar el almacen:
//    lista vacia, ids que no existen, ancla que no existe, soltar un bloque
//    sobre si mismo.
//  - Que un id caducado en medio de un grupo no bloquea a los demas.
//  - Que el orden se guarda.
//
//  La razon de que `moveItems` reciba un ANCLA en vez de un indice esta en el
//  game loop y ya la comprueba el filtro: aqui se comprueba el contrato entero.
// ==========================================================================

import {
  boot, reload, check, resumen, s, wh, ids, find, baseSave,
  collector, companion, crate, consumable, ficha
} from './kit';

async function main() {
  // =========================================================================
  //  1. Un item, en la celda que se señala
  //
  //  `lado` ('antes' | 'despues') decide de qué lado del ancla entra el bloque y,
  //  con ello, en qué posición del almacén acaba. Por defecto es 'antes', que es
  //  el contrato de siempre: "ponte delante de este item".
  //
  //  Por qué hace falta: el ancla es el item de la celda DESTINO, así que entrar
  //  siempre por delante dejaba el bloque una celda a la izquierda de donde el
  //  jugador lo había soltado, y soltar sobre la celda de al lado era un no-op
  //  exacto. Solo quien mira la rejilla sabe en qué dirección se señaló el
  //  destino, así que el lado lo decide el que llama. Ver `moveItemTo`.
  // =========================================================================
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    const r = g.moveItems(['c'], 'a');
    check('mover: acepta un item suelto', r === true, String(r));
    check('mover: por defecto lo pone justo delante del ancla', ids(g).join(',') === 'c,a,b', ids(g).join(','));
  }
  {
    // Un item que YA esta delante del ancla no se mueve con el lado por defecto.
    // La operacion responde true (el destino es valido) pero el orden no cambia:
    // si en este caso insertara detras, arrastrar un item hacia arriba lo
    // bajaria. Por eso "detras" no es el default y hay que pedirlo.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    g.moveItems(['a'], 'b');
    check('mover: un item que ya esta delante del ancla se queda', ids(g).join(',') === 'a,b,c',
      ids(g).join(','));
  }
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    g.moveItems(['a'], 'c', 'despues');
    check('mover: en medio queda el bloque detrás del ancla', ids(g).join(',') === 'b,c,a', ids(g).join(','));
  }
  {
    // LAS DOS MITADES DEL CONTRATO. Lo que el jugador señala es una CELDA, y el
    // item tiene que quedar en esa celda. Estas dos pruebas son las que
    // encuentran el bug: el bloque caia siempre en la celda anterior, y soltar
    // sobre la celda vecina no movia nada en absoluto.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    g.moveItems(['a'], 'b', 'despues');
    check('mover: cae en la celda señalada y no en la de al lado',
      ids(g).join(',') === 'b,a,c', ids(g).join(','));
  }
  {
    // Y al revés: soltar a la IZQUIERDA también tiene que respectar la celda.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    g.moveItems(['c'], 'a', 'antes');
    check('mover: hacia la izquierda cae en la celda señalada',
      ids(g).join(',') === 'c,a,b', ids(g).join(','));
  }
  {
    // El caso que el jugador reportaba: arrastrar una celda sobre la de al lado
    // no movia absolutamente nada, porque el bloque ya estaba por delante del
    // vecino. Con el lado explicito, ese mismo arrastre SI intercambia.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    const r = g.moveItems(['a'], 'b', 'despues');
    check('mover: soltar sobre la celda de al lado SI cambia el orden',
      r === true && ids(g).join(',') === 'b,a,c', ids(g).join(','));
  }
  {
    // Un salto largo: la celda 2 de una rejilla de 3, no la de al lado. Con el
    // bloque entrando por delante del ancla esto daba celda 1.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    g.moveItems(['a'], 'c', 'despues');
    check('mover: a un salto largo cae en la celda exacta',
      ids(g).indexOf('a') === 2, ids(g).join(','));
  }

  // =========================================================================
  //  2. Al final
  // =========================================================================
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    const r = g.moveItems(['a'], null);
    check('mover: con ancla null va al final', r === true && ids(g).join(',') === 'b,c,a', ids(g).join(','));
  }
  {
    // Ya estaba al final: no cambia nada, pero no debe fallar.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    const r = g.moveItems(['c'], null);
    check('mover: un item que ya esta al final se queda', r === true && ids(g).join(',') === 'a,b,c', ids(g).join(','));
  }

  // =========================================================================
  //  3. Un bloque (una pila o varios items a la vez)
  // =========================================================================
  {
    // Varios items juntos conservan su orden relativo: si se invirtieran, una
    // pila de 5 aparecia al reves y el jugador no reconocia su propio almacen.
    const g = await boot(baseSave([collector('z'), collector('p1'), collector('p2'), collector('p3')]));
    g.moveItems(['p1', 'p2', 'p3'], 'z');
    check('mover: un bloque conserva su orden interno', ids(g).join(',') === 'p1,p2,p3,z', ids(g).join(','));
  }
  {
    // El bloque se pone CONTIGUO: si los items se metieran uno a uno delante del
    // ancla, el ultimo acabaria el primero y quedarian entremezclados.
    const g = await boot(baseSave([collector('z'), collector('a'), collector('m'), collector('b')]));
    g.moveItems(['a', 'b'], 'z');
    check('mover: el bloque queda junto, sin entremezclar',
      ids(g).join(',') === 'a,b,z,m', ids(g).join(','));

    const g2 = await boot(baseSave([collector('z'), collector('a'), collector('m'), collector('b')]));
    g2.moveItems(['a', 'b'], 'm');
    check('mover: delante de un ancla que esta en medio, igual de junto',
      ids(g2).join(',') === 'z,a,b,m', ids(g2).join(','));
  }
  {
    // El orden en que se pasa el bloque no importa: el juego ordena por la
    // posicion ORIGINAL en el almacen, no por el orden del array recibido.
    const g = await boot(baseSave([collector('z'), collector('a'), collector('b')]));
    g.moveItems(['b', 'a'], 'z');
    check('mover: el bloque se ordena por su posicion original, no por el argumento',
      ids(g).join(',') === 'a,b,z', ids(g).join(','));
  }
  {
    // Un bloque de items apilables: los 3 van juntos. Se usan cajas de DISTINTO
    // tipo porque dos del mismo tipo son la MISMA pila (se funden al cargar en un
    // unico item con 5 unidades) y no habria tres ids que mover.
    const g = await boot(baseSave([
      crate('p1', 1, 2), crate('p2', 3, 3), crate('p3', 6, 1), collector('z')
    ]));
    g.moveItems(['p1', 'p2', 'p3'], 'z');
    check('mover: un bloque de tres items apilables va junto',
      ids(g).join(',') === 'p1,p2,p3,z', ids(g).join(','));
    check('mover: y cada item conserva sus unidades',
      wh(g).map((w: any) => w.stackCount).join(',') === '2,3,1,',
      wh(g).map((w: any) => w.stackCount).join(','));
  }
  {
    // El caso de una celda con VARIOS items detras de verdad: 19 unidades del mismo
    // material guardadas como items separados. `mergeStacks` las funde al cargar
    // en una sola pila, y arrastrar esa celda tiene que moverla entera sin partirla.
    //
    // **ESTE CASO PASÓ POR LAS LLAVES Y POR EL CRISTAL, Y AHORA ES DE UN CONSUMIBLE.**
    // Los dos dejaron de ser moneda de pago: las llaves se redimen al cargar, y el
    // cristal es un recurso, un número en `state.crystals`. Ninguno de los dos está
    // en `STACKABLE_TYPES`, así que un item viejo de cualquiera de ellos ya ni
    // siquiera llega a la pantalla, y con ellos este bloque habría dado verde
    // midiendo items que no se funden entre sí.
    //
    // El que de verdad llena una celda es el consumible —'`stackKey()` es tipo y
    // nombre, así que 19 tarjetas iguales son una pila—, y es el escenario que se
    // quiere probar aquí.
    const items = Array.from({ length: 19 }, (_, i) => consumable('k' + i, 'afk'));
    const g = await boot(baseSave([collector('z'), ...items]));
    check('mover: 19 unidades separadas se funden en una celda', wh(g).length === 2,
      'items=' + wh(g).length);
    g.moveItems([find(g, 'k0').id], 'z');
    check('mover: arrastrar esa celda mueve la pila entera, no la parte',
      ids(g).join(',') === find(g, 'k0').id + ',z', ids(g).join(','));
    check('mover: y no se pierde ninguna unidad', find(g, 'k0').stackCount === 19,
      'stackCount=' + find(g, 'k0').stackCount);
  }

  // =========================================================================
  //  4. El almacen no se toca mas alla del orden
  // =========================================================================
  {
    const items = [
      collector('r1', 4, { level: 3, damage: 80, affixes: ['x'], potential: 3 }),
      companion('m1', 2),
      crate('c1', 6, 4),
      // Tres consumibles **de nombres distintos**, y no por gusto: `stackKey()` es
      // tipo y nombre, así que dos con el mismo nombre serían la MISMA pila y se
      // fundirían al cargar. Aquí se quiere medir que mover no crea ni borra nada,
      // y con items que se funden la foto de antes y la de después no serían
      // comparables.
      consumable('x2', 'clickX2', 7, { name: 'Tarjeta Click x2' }),
      consumable('x1', 'calibrationStone', 2, { name: 'Piedra de Calibración' }),
      consumable('u1', 'afk', 5)
    ];
    const g = await boot(baseSave(items, { nanites: 7777 }));
    const foto = JSON.stringify(wh(g).slice().sort((a, b) => a.id.localeCompare(b.id)));
    const contadores = JSON.stringify({
      // **EL CRISTAL YA NO ESTÁ EN ESTA FOTO COMO CONTADOR DEL ALMACÉN, Y POR QUÉ EL
      // SALDO SE COMPARA IGUAL.** Antes era el total de cristales, derivado de las
      // pilas del almacén. Al ser un recurso ya no hay nada que el almacén cuente,
      // pero la pregunta del banco es la misma —que mover **no toca nada**—, y el
      // saldo del recurso es justo uno de esos "nadas": si un movimiento lo
      // descolocara, el jugador vería su saldo de cristal cambiar sin haber gastado
      // un solo cristal.
      n: s(g).nanites, cr: s(g).crystals, c: s(g).crates,
      comp: s(g).companions, afk: s(g).afkCards
    });

    g.moveItems(['r1', 'm1', 'c1', 'x1', 'x2', 'u1'], null);

    check('mover: no se crea ni se borra ningun item', wh(g).length === items.length,
      `${wh(g).length} vs ${items.length}`);
    check('mover: el contenido de los items es identico',
      JSON.stringify(wh(g).slice().sort((a, b) => a.id.localeCompare(b.id))) === foto);
    check('mover: nanitas, saldo de cristal y contadores intactos',
      JSON.stringify({ n: s(g).nanites, cr: s(g).crystals, c: s(g).crates, comp: s(g).companions, afk: s(g).afkCards }) === contadores,
      'cambiados');
  }
  {
    // Mover NO puede cambiar el contenido de una celda de la rejilla: una pila
    // de 5 sigue siendo una pila de 5 despues de moverla.
    const g = await boot(baseSave([crate('p1', 1, 5), collector('z')]));
    g.moveItems(['p1'], 'z');
    check('mover: la pila conserva sus unidades', findStackCount(g, 'p1') === 5, String(findStackCount(g, 'p1')));
    check('mover: y sigue siendo una sola celda', celdasDe(g).length === 2, celdasDe(g).join(','));
  }

  // =========================================================================
  //  5. Los casos imposibles se rechazan
  // =========================================================================
  {
    const g = await boot(baseSave([collector('a'), collector('b')]));
    check('mover: lista vacia se rechaza', g.moveItems([], 'a') === false);
    check('mover: y el almacen queda igual', ids(g).join(',') === 'a,b', ids(g).join(','));
  }
  {
    const g = await boot(baseSave([collector('a'), collector('b')]));
    const r = g.moveItems(['nada', 'tampoco'], 'a');
    check('mover: si ninguno de los ids existe se rechaza', r === false, String(r));
    check('mover: y no se toca el almacen', ids(g).join(',') === 'a,b', ids(g).join(','));
  }
  {
    // Un id caducado en medio del grupo no puede bloquear el movimiento de los
    // que si existen: si lo hiciera, un arrastre se caeria entero por un item
    // que se vendio en otra pestana.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    const r = g.moveItems(['a', 'idCaducado'], 'b', 'despues');
    check('mover: un id caducado no bloquea al grupo', r === true, String(r));
    check('mover: y los ids buenos se mueven', ids(g).join(',') === 'b,a,c', ids(g).join(','));
  }
  {
    const g = await boot(baseSave([collector('a'), collector('b')]));
    check('mover: ancla inexistente se rechaza', g.moveItems(['a'], 'no_existe') === false, String(g.moveItems(['a'], 'no_existe')));
    check('mover: y no manda el item al final', ids(g).join(',') === 'a,b', ids(g).join(','));
  }
  {
    // Soltar un bloque sobre si mismo: no hay reordenacion posible. Si en vez de
    // rechazarlo se hiciera el quitado y el insertado, el almacen pasaria por un
    // estado sin esos items y un fallo a mitad dejariaItems perdidos.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    const r = g.moveItems(['b'], 'b');
    check('mover: soltar sobre si mismo se rechaza', r === false, String(r));
    check('mover: y ningun item se pierde', ids(g).join(',') === 'a,b,c', ids(g).join(','));
  }
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    const r = g.moveItems(['a', 'b', 'c'], 'b');
    check('mover: soltar todo el almacen sobre si mismo se rechaza', r === false, String(r));
    check('mover: y el almacen sigue entero', ids(g).join(',') === 'a,b,c', ids(g).join(','));
  }

  // =========================================================================
  //  6. Movimientos encadenados
  // =========================================================================
  {
    // Doce movimientos seguidos: el estado tiene que seguir siendo una
    // permutacion de los ids originales, sin perdidas ni duplicados. Esta es la
    // prueba que encuentra un `splice` con indice desfasado.
    const n = 12;
    const items = Array.from({ length: n }, (_, i) => collector(`i${i}`));
    const g = await boot(baseSave(items));
    const original = new Set(ids(g));

    for (let k = 0; k < 12; k++) {
      const actual = ids(g);
      const origen = actual[k % n];
      const destino = actual[(k * 5 + 3) % n];
      // Se alterna el lado a proposito: la cadena tiene que aguantar las dos
      // formas de entrar, no solo la de por defecto.
      if (origen !== destino) g.moveItems([origen], destino, k % 2 ? 'despues' : 'antes');
    }

    const final = ids(g);
    check('cadena: no se pierde ningun item', new Set(final).size === n, `${new Set(final).size} de ${n}`);
    check('cadena: no aparece ningun item nuevo', [...final].every((id) => original.has(id)), final.join(','));
    check('cadena: siguen siendo todos los originales', original.size === n, [...original].join(','));
  }
  {
    // Mover, vender y mover otra vez: los ids de la venta no pueden volver a
    // aparecer, y los que quedan deben seguir moviendose bien.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c'), collector('d')]));
    g.sellItem('a');
    const r = g.moveItems(['d'], 'c');
    check('cadena: tras una venta el almacen se sigue moviendo',
      r === true && ids(g).join(',') === 'b,d,c', ids(g).join(','));
    const r2 = g.moveItems(['c'], 'b');
    check('cadena: y un segundo movimiento encadenado tambien',
      r2 === true && ids(g).join(',') === 'c,b,d', ids(g).join(','));
  }

  // =========================================================================
  //  7. Persistencia
  // =========================================================================
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c'), crate('p1', 1, 3)]));
    g.moveItems(['p1'], 'c', 'despues');
    const esperado = ids(g).join(',');
    const g2 = await reload();
    check('guardar: el orden se conserva tras recargar', ids(g2).join(',') === esperado,
      `${ids(g2).join(',')} vs ${esperado}`);
    check('guardar: y sigue habiendo los mismos items', wh(g2).length === 4, ids(g2).join(','));
  }
  {
    // Un movimiento fallido no debe ensuciar el documento: si escribiera igual,
    // la recarga traeria un almacen distinto al que el jugador veia.
    const g = await boot(baseSave([collector('a'), collector('b')]));
    g.moveItems(['a'], 'b', 'despues');
    g.moveItems(['a'], 'idQueNoExiste');
    const g2 = await reload();
    check('guardar: un movimiento fallido no altera el orden guardado',
      ids(g2).join(',') === 'b,a', ids(g2).join(','));
  }

  // =========================================================================
  //  8. El orden del jugador convive con todo lo demas
  // =========================================================================
  {
    // Un recolector equipado se puede mover como cualquier otro. Si el
    // movimiento lo destrozara, el click se quedaria sin dano sin avisar.
    //
    // El almacen tiene un item mas, `c`, en medio: sin el, mover `b` delante de
    // `a` no cambiaria nada (ya estaba delante) y la prueba no mediria el
    // movimiento, solo que no se rompe.
    //
    // NO se llama a `equipCollector`: la partida ya viene con `b` equipado y esa
    // funcion es un conmutador, asi que llamarla lo desequiparia.
    const g = await boot(baseSave([collector('a'), collector('c'), collector('b')],
      { equippedCollectorId: 'b' }));
    check('equipar + mover: la partida arranca con el recolector equipado',
      s(g).equippedCollectorId === 'b' && g.getClickDamage() > 0,
      `id=${s(g).equippedCollectorId} danio=${g.getClickDamage()}`);
    g.moveItems(['b'], 'a');
    check('equipar + mover: el recolector equipado se mueve bien',
      ids(g).join(',') === 'b,a,c' && s(g).equippedCollectorId === 'b', ids(g).join(','));
    check('equipar + mover: y sigue haciendo dano', g.getClickDamage() > 0, 'danio=' + g.getClickDamage());

    const g2 = await reload();
    check('equipar + mover: el equipado sobrevive con el nuevo orden',
      s(g2).equippedCollectorId === 'b' && g2.getClickDamage() > 0,
      `id=${s(g2).equippedCollectorId} danio=${g2.getClickDamage()}`);
  }
  {
    // Un companero activo tambien se puede mover.
    const items = [collector('a'), companion('m1')];
    const g = await boot(baseSave(items, {
      companions: [ficha('m1')],
      activeCompanions: ['m1']
    }));
    g.moveItems(['m1'], 'a');
    check('equipar + mover: el companero activo se mueve bien',
      ids(g).join(',') === 'm1,a' && s(g).activeCompanions.join(',') === 'm1', ids(g).join(','));
    check('equipar + mover: y sigue pagando pasivo', s(g).passiveIncome > 0, 'pasivo=' + s(g).passiveIncome);
  }
  {
    // Un almacen de UN item: moverlo no puede duplicarlo ni borrarlo.
    const g = await boot(baseSave([collector('solo')]));
    const r = g.moveItems(['solo'], null);
    check('un solo item: moverlo no lo destruye', wh(g).length === 1 && ids(g).join(',') === 'solo',
      ids(g).join(','));
    check('un solo item: la operacion responde correctamente', r === true, String(r));
  }
  {
    // Vacio de verdad.
    const g = await boot(baseSave([]));
    check('almacen vacio: mover se rechaza sin reventar', g.moveItems(['a'], null) === false);
    check('almacen vacio: sigue vacio', wh(g).length === 0);
  }

  resumen('movimientos');
}

// --- Ayudas locales -------------------------------------------------------
function findStackCount(g: any, id: string): number {
  const w = wh(g).find((x: any) => x.id === id);
  return w ? (w.stackCount || 0) : -1;
}
function celdasDe(g: any): string[] {
  return wh(g).map((w: any) => w.id);
}

export default main();
