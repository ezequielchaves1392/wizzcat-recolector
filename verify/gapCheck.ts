// ==========================================================================
//  Banco de pruebas de los HUECOS del almacen
//
//  Un hueco es "no hay nada aqui y el jugador lo ha puesto a proposito". Se
//  guarda como el id del item que va justo detras —`warehouseGaps`—, nunca como
//  un indice de celda, y esa es la decision de la que sale todo lo demas:
//
//    - Un indice se desliza en la primera compra, venta o caja abierta, y el
//      hueco acabaria delante de un item que el jugador no eligio. Un id se
//      queda pegado a su item para siempre.
//    - El array `warehouse` sigue EMPAQUETADO. Un hueco no es un item: no
//      cuenta para la capacidad, no se vende, no se mueve con el almacen. Por
//      eso la economia entera no llega a verlo, y por eso esta prueba vigila
//      que siga siendo cierto.
//
//  Lo que se comprueba:
//
//    - Que un hueco se pinta justo antes de su ancla y desplaza lo de detras.
//    - Que soltar dentro de un hueco es un INTERCAMBIO: el item entra y el hueco
//      se queda donde estaba el item. El numero de huecos no cambia al arrastrar.
//    - Que arrastrar nunca crea ni pierde un item.
//    - Que un hueco anclado a un item que se vende desaparece.
//    - Que un hueco no consume capacidad ni bloquea una compra.
//    - Que con filtro o con orden activo los huecos no se pintan.
//    - Que los huecos sobreviven a recargar.
// ==========================================================================

import {
  boot, reload, check, resumen, s, wh, ids, baseSave, guardado,
  collector, companion, crate, key
} from './kit';

import { moveItemTo, moveIntoGap, moveToFreeCell, visibleStacksFor } from '../src/components/warehouse';

/** Los huecos tal y como los guarda el juego. */
const huecos = (g: any): string[] => g.getWarehouseGaps?.() ?? [];

/**
 * La rejilla como la ve el jugador, con `·` delante del item que lleva hueco.
 *
 * Reimplementa aquí el mismo criterio que el pintor —un hueco va justo antes de
 * su ancla— a propósito: si el banco usara la función del pintor no
 * comprobaría nada, porque una prueba que llama a la implementación que quiere
 * verificar pasa justo cuando la implementación está mal.
 */
const rejilla = (g: any, filtro = 'all', sort = 'default'): string[] => {
  const celdas = visibleStacksFor(g, s(g), filtro, sort);
  // Un hueco puede ocupar VARIAS celdas seguidas, y eso se cuenta por
  // repeticiones del id. Un `Set` las fundiría en una y la rejilla que se
  // comprobaría aquí no sería la que ve el jugador.
  const cuenta = new Map<string, number>();
  if (filtro === 'all' && sort === 'default') {
    for (const id of huecos(g)) cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
  }
  const out: string[] = [];
  for (const c of celdas) {
    for (let h = 0; h < (cuenta.get(c.item.id) ?? 0); h++) out.push('·');
    out.push(c.item.id);
  }
  return out;
};

async function main() {
  // =========================================================================
  //  1. Un hueco se pinta antes de su ancla
  // =========================================================================
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    check('huecos: nace sin huecos', huecos(g).length === 0, huecos(g).join(','));
    check('huecos: y la rejilla no tiene ninguno', rejilla(g).join(',') === 'a,b,c', rejilla(g).join(','));
  }
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    g.setWarehouseGaps(['c']);
    check('huecos: uno antes de c se pinta en su sitio', rejilla(g).join(',') === 'a,b,·,c', rejilla(g).join(','));
    check('huecos: y no toca el almacen', ids(g).join(',') === 'a,b,c', ids(g).join(','));
  }
  {
    // El hueco NO es un item: el array sigue igual de largo. Si se colara una
    // entrada, la capacidad lo contaria y la economia entera veria un agujero.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    g.setWarehouseGaps(['a', 'b', 'c']);
    check('huecos: tres huecos no crean items', wh(g).length === 3, String(wh(g).length));
    check('huecos: y la rejilla es un hueco por celda',
      rejilla(g).join(',') === '·,a,·,b,·,c', rejilla(g).join(','));
  }

  // =========================================================================
  //  2. Soltar dentro de un hueco es un intercambio
  // =========================================================================
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    g.setWarehouseGaps(['c']);
    const r = moveIntoGap(g, 'a', 'c', 'all', 'default');
    check('hueco: soltar dentro de un hueco se acepta', r === true, String(r));
    check('hueco: el item entra justo antes del ancla', ids(g).join(',') === 'b,a,c', ids(g).join(','));
    check('hueco: y el hueco se queda donde estaba el item',
      huecos(g).join(',') === 'b', huecos(g).join(','));
    check('hueco: la rejilla lo cuenta como un hueco antes de b',
      rejilla(g).join(',') === '·,b,a,c', rejilla(g).join(','));
  }
  {
    // El número de huecos NO cambia al arrastrar: se rellena el que se señaló y
    // aparece otro donde estaba el item. Un intercambio, no un "rellenar el
    // hueco" que dejara el almacén compactado hacia arriba.
    //
    // Cuatro items para que el arrastrado NO sea el último: si lo fuera, el hueco
    // nuevo caería en la cola libre y no necesitaría ancla, y la comprobación
    // estaría midiendo otro caso.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c'), collector('d')]));
    g.setWarehouseGaps(['c']);
    const r = moveIntoGap(g, 'a', 'c', 'all', 'default');
    check('hueco: arrastrar no crea ni destruye huecos', r === true && huecos(g).length === 1,
      `${r} ${huecos(g).join(',')}`);
    check('hueco: el hueco se reancla donde estaba el item',
      huecos(g).join(',') === 'b', huecos(g).join(','));
    check('hueco: el item entra en el hueco', ids(g).join(',') === 'b,a,c,d', ids(g).join(','));
  }
  {
    // Si el item era el último no hay nada detrás, así que el hueco nuevo cae en
    // la cola libre, que ya se pinta vacía sola y no necesita ancla. Es el caso
    // "suelto el dron al hueco del medio y se queda un hueco al final".
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    g.setWarehouseGaps(['b']);
    const r = moveIntoGap(g, 'c', 'b', 'all', 'default');
    check('hueco: si el item es el ultimo, el hueco nuevo no necesita ancla',
      r === true && huecos(g).length === 0, `${r} ${huecos(g).join(',')}`);
    check('hueco: y el item entra igualmente en el hueco', ids(g).join(',') === 'a,c,b', ids(g).join(','));
  }
  {
    // Si el grupo ya está justo delante del ancla, no hay nada que colocar: el
    // hueco está pegado a su derecha y moverlo no cambiaría nada. Se rechaza
    // para que el gesto no parezca ignorado.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    g.setWarehouseGaps(['b']);
    const r = moveIntoGap(g, 'a', 'b', 'all', 'default');
    check('hueco: soltar justo delante del hueco no hace nada',
      r === false && ids(g).join(',') === 'a,b,c' && huecos(g).join(',') === 'b',
      `${r} ${ids(g).join(',')} ${huecos(g).join(',')}`);
  }
  {
    // "Ponerme delante de mí" no tiene solución.
    const g = await boot(baseSave([collector('a'), collector('b')]));
    g.setWarehouseGaps(['a']);
    const r = moveIntoGap(g, 'a', 'a', 'all', 'default');
    check('hueco: soltar dentro del hueco que precede al propio item se rechaza',
      r === false && ids(g).join(',') === 'a,b', String(r));
  }
  {
    // Una pila entera entra en el hueco y sale entera. Esta comprobación vive en
    // el banco de DOM (`drag-test.html`, caso `pila dentro de un hueco`) y no
    // aquí a propósito: al cargar, una partida con dos apilables iguales se
    // normaliza y solo sobrevive un item, así que una prueba en este banco
    // mediría la normalización en vez del comportamiento del hueco. El banco de
    // DOM monta la rejilla con un estado ya hecho, sin pasar por la carga.
  }

  // =========================================================================
  //  3. Arrastrar nunca crea ni pierde un item
  // =========================================================================
  {
    const items = [
      collector('a'), collector('b'), crate('p1', 'common', 3), crate('p2', 'common', 2),
      key('k1', 0, 7), companion('m1')
    ];
    const g = await boot(baseSave(items));
    const original = new Set(ids(g));
    g.setWarehouseGaps(['p1', 'm1']);

    // Doce intercambios, alternando huecos y celdas, con huecos de por medio.
    for (let k = 0; k < 12; k++) {
      const celdas = visibleStacksFor(g, s(g), 'all', 'default');
      const celda = celdas[k % celdas.length];
      const siguiente = celdas[(k + 2) % celdas.length];
      if (celda.item.id === siguiente.item.id) continue;
      if (k % 2 === 0) moveIntoGap(g, celda.item.id, siguiente.item.id, 'all', 'default');
      else moveItemTo(g, celda.item.id, (k + 2) % celdas.length, 'all', 'default');
    }

    const final = ids(g);
    check('cadena: no se pierde ningun item', new Set(final).size === original.size,
      `${new Set(final).size} de ${original.size}`);
    check('cadena: no aparece ningun item nuevo',
      [...final].every(id => original.has(id)), final.join(','));
    check('cadena: y todos los huecos apuntan a items que existen',
      huecos(g).every(id => final.includes(id)), huecos(g).join(','));
  }

  // =========================================================================
  //  4. Un hueco no es una ranura
  // =========================================================================
  {
    const items = Array.from({ length: 10 }, (_, i) => collector('c' + i));
    const g = await boot(baseSave(items, { warehouseCapacity: 10, nanites: 5000 }));
    g.setWarehouseGaps(['c0', 'c5']);
    check('capacidad: los huecos no cuentan como ranura',
      wh(g).length === 10 && g.getCapacity() === 10, `${wh(g).length}/${g.getCapacity()}`);
    const r = g.buyStoreItem('collectorCardT1');
    check('capacidad: con el almacen lleno y huecos, la compra se rechaza igual',
      r === false, JSON.stringify(r));
  }
  {
    // Un hueco NO bloquea la entrada de un item nuevo: no es una ranura ocupada.
    const items = Array.from({ length: 9 }, (_, i) => collector('c' + i));
    const g = await boot(baseSave(items, { warehouseCapacity: 10, nanites: 5000 }));
    g.setWarehouseGaps(['c0']);
    const r = g.buyStoreItem('collectorCardT1');
    check('capacidad: y con hueco de sobra la compra SI entra', !!r && wh(g).length === 10,
      `${JSON.stringify(r)} ${wh(g).length}`);
  }

  // =========================================================================
  //  5. Un hueco sobrevive a lo que pasa, y desaparece si su ancla desaparece
  // =========================================================================
  {
    const g = await boot(baseSave([
      collector('a'), collector('b'), collector('c'), collector('d')
    ]));
    g.setWarehouseGaps(['b']);
    g.sellItem('b');
    check('higiene: vender el ancla de un hueco lo borra', huecos(g).length === 0, huecos(g).join(','));
  }
  {
    const g = await boot(baseSave([
      collector('a'), collector('b'), crate('p1', 'common', 2), collector('c')
    ]));
    g.setWarehouseGaps(['b', 'p1']);
    g.sellItem('p1');
    check('higiene: solo se borra el hueco que se queda sin ancla',
      huecos(g).join(',') === 'b', huecos(g).join(','));
  }
  {
    // Un hueco guardado con un id que no existe no se pinta y no rompe nada.
    const g = await boot(baseSave([collector('a')]));
    const doc = guardado();
    doc.warehouseGaps = ['no_existe', 'a'];
    const g2 = await reload();
    check('higiene: al cargar se descartan los huecos colgantes',
      huecos(g2).join(',') === 'a', huecos(g2).join(','));
  }
  {
    // Un guardado con el campo ausente o corrupto no revienta.
    const g = await boot(baseSave([collector('a'), collector('b')]));
    const doc = guardado();
    delete doc.warehouseGaps;
    const g2 = await reload();
    check('higiene: sin el campo, cero huecos y cero problemas',
      huecos(g2).length === 0 && ids(g2).join(',') === 'a,b', huecos(g2).join(','));

    const doc2 = guardado();
    doc2.warehouseGaps = 'esto no es una lista';
    const g3 = await reload();
    check('higiene: y con basura en el campo tambien cero huecos',
      huecos(g3).length === 0, huecos(g3).join(','));
  }

  // =========================================================================
  //  6. Persistencia
  // =========================================================================
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    g.setWarehouseGaps(['b']);
    const g2 = await reload();
    check('guardar: los huecos sobreviven a recargar',
      huecos(g2).join(',') === 'b', huecos(g2).join(','));
    check('guardar: y el almacen sigue igual', ids(g2).join(',') === 'a,b,c', ids(g2).join(','));
  }
  {
    // El hueco acompaña a su ancla aunque el item se mueva de sitio.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    g.setWarehouseGaps(['b']);
    moveItemTo(g, 'b', 0, 'all', 'default');
    check('guardar: el hueco sigue pegado a su item aunque se mueva',
      huecos(g).join(',') === 'b' && ids(g).join(',') === 'b,a,c',
      `${huecos(g).join(',')} ${ids(g).join(',')}`);
  }

  // =========================================================================
  //  7. Con filtro o con orden los huecos no se pintan
  //
  //  Un hueco describe una disposición, y con un filtro activo la celda que ocupa
  //  un item es otra. Pintarlo ahí sería dibujar una mentira.
  // =========================================================================
  {
    // Se usan cuatro recolectores y no cajas: dos cajas iguales se funden al
    // cargar y el almacén no tendría cuatro celdas que filtrar.
    const g = await boot(baseSave([
      collector('a'), collector('d'), collector('b'), collector('e')
    ]));
    g.setWarehouseGaps(['b']);
    check('filtro: con filtro activo no se pintan huecos',
      rejilla(g, 'collector').join(',') === 'a,d,b,e', rejilla(g, 'collector').join(','));
    check('filtro: pero siguen guardados', huecos(g).join(',') === 'b', huecos(g).join(','));
    check('filtro: y con el filtro Todo vuelven a verse',
      rejilla(g, 'all').join(',') === 'a,d,·,b,e', rejilla(g, 'all').join(','));
  }
  {
    const g = await boot(baseSave([
      collector('a', 1), collector('b', 9)
    ]));
    g.setWarehouseGaps(['a']);
    check('orden: con un orden activo no se pintan huecos',
      rejilla(g, 'all', 'tier').join(',') === 'b,a', rejilla(g, 'all', 'tier').join(','));
    check('orden: y con "Mi orden" vuelven a verse',
      rejilla(g, 'all', 'default').join(',') === '·,a,b', rejilla(g, 'all', 'default').join(','));
  }

  // =========================================================================
  //  8. Lo que el jugador pidió
  // =========================================================================
  {
    // El mockup: hueco en medio de la rejilla, items detrás, y un item que se
    // suelta dentro del hueco dejando el hueco donde estaba.
    //
    // El dron va PRIMERO en el array a propósito. Si ya fuera el vecino del
    // hueco no habría nada que colocar —el hueco está pegado a su derecha— y el
    // gesto se rechazaría, que es lo correcto pero no es lo que se quiere ver.
    const items: any[] = [collector('dron'), collector('blaster')];
    for (let i = 0; i < 19; i++) items.push(key('k' + i));
    const g = await boot(baseSave(items, { warehouseCapacity: 21 }));
    check('mockup: el almacen con 19 llaves da 3 celdas',
      visibleStacksFor(g, s(g), 'all', 'default').length === 3, ids(g).join(','));

    // El hueco se monta aqui con la API y no arrastrando, para poder colocar el
    // ancla donde interesa sin tener que acertar una celda de la rejilla: aqui lo
    // que se comprueba es COMO se ve y COMO se comporta un hueco, no el gesto que
    // lo crea. Ese gesto es el arrastre —soltar en una celda vacia le cuelga al
    // item los huecos que necesita para caer ahi—, y lo cubren las secciones 9 y
    // 10 con `moveToFreeCell`.
    g.setWarehouseGaps(['dron']);
    check('mockup: el hueco delante del dron se ve en la rejilla',
      rejilla(g).join(',') === '·,dron,blaster,k0', rejilla(g).join(','));

    // Y ahora el dron entra en el hueco de en medio, el que precede a la pila de
    // llaves. Entra ahi y deja su hueco donde estaba, que es justo el dibujo.
    g.setWarehouseGaps(['k0']);
    const r = moveIntoGap(g, 'dron', 'k0', 'all', 'default');
    check('mockup: soltar dentro del hueco mete el item ahi',
      r === true && ids(g).join(',') === 'blaster,dron,k0', ids(g).join(','));
    check('mockup: y el hueco se queda donde estaba el dron',
      huecos(g).join(',') === 'blaster', huecos(g).join(','));
    check('mockup: la rejilla lo enseña como hueco antes del blaster',
      rejilla(g).join(',') === '·,blaster,dron,k0', rejilla(g).join(','));
  }

  // =========================================================================
  //  9. Soltar en una celda VACIA de capacidad
  //
  //  LA REGLA: mientras queden celdas vacias, cualquier objeto se puede mover a
  //  cualquiera de ellas. Tambien el ULTIMO, que es el caso que antes se
  //  rechazaba con "no hay mas sitio libre detras": habia sitio, lo que no habia
  //  era forma de representarlo.
  //
  //  COMO SE REPRESENTA. El array sigue empaquetado, asi que el item va al
  //  final y para que se VEA en la celda senalada hacen falta celdas de hueco por
  //  delante. Los huecos van TODOS en el item que se mueve: si se repartieran
  //  entre los demas, al soltar un item en una celda vacia se desplazarian otros
  //  tres que el jugador no habia tocado.
  // =========================================================================
  {
    const g = await boot(baseSave([collector('dron'), collector('blaster'), collector('k1')]));
    const r = moveToFreeCell(g, 'dron', 3, 'all', 'default');
    check('vacia: soltar en la primera celda vacia se acepta', r === true, String(r));
    check('vacia: el item se va al final del almacen', ids(g).join(',') === 'blaster,k1,dron', ids(g).join(','));
    check('vacia: hace falta UNA celda de hueco', huecos(g).length === 1, huecos(g).join(','));
    check('vacia: el item cae en la posicion SENALADA, no en la de al lado',
      rejilla(g).indexOf('dron') === 3, rejilla(g).join(',') + ' senalada 3');
    check('vacia: y los demas items NO se mueven de sitio',
      rejilla(g).slice(0, 2).join(',') === 'blaster,k1', rejilla(g).join(','));
  }
  {
    // El caso largo: soltar en la 5 con 3 celdas necesita TRES celdas de hueco.
    const g = await boot(baseSave([collector('dron'), collector('blaster'), collector('k1')]));
    const r = moveToFreeCell(g, 'dron', 5, 'all', 'default');
    check('vacia: soltar en la celda 5 se acepta', r === true, String(r));
    check('vacia: hacen falta 3 celdas de hueco', huecos(g).length === 3, huecos(g).join(','));
    check('vacia: y el item cae en la 5, exacta',
      rejilla(g).join(',') === 'blaster,k1,·,·,·,dron', rejilla(g).join(','));
  }
  {
    // EL QUE ANTES SE RECHAZABA: el item ya es el ultimo y aun asi hay sitio a su
    // derecha. No hace falta reordenar nada, solo poner las celdas de hueco que
    // lo empujan hasta donde se senalo.
    const g = await boot(baseSave([collector('blaster'), collector('k1'), collector('dron')]));
    const r = moveToFreeCell(g, 'dron', 5, 'all', 'default');
    check('vacia: el ULTIMO item tambien se mueve a una celda vacia',
      r === true && rejilla(g).indexOf('dron') === 5, r + ' ' + rejilla(g).join(','));
    check('vacia: y no se reordena nada, que ya estaba al final',
      ids(g).join(',') === 'blaster,k1,dron', ids(g).join(','));
  }
  {
    // Celda 9 con 3 items: se llega. Antes se recortaba a la 5 porque cada hueco
    // necesitaba un item al que anclarse -un tope de "un hueco por celda" que
    // hacia lo contrario de lo que el jugador pide. Ahora el tope es el tablero,
    // y con capacidad 30 la celda 9 esta de sobra dentro.
    const g = await boot(baseSave([collector('dron'), collector('blaster'), collector('k1')]));
    const r = moveToFreeCell(g, 'dron', 9, 'all', 'default');
    check('vacia: la celda 9 se alcanza con 3 items',
      r === true && rejilla(g).indexOf('dron') === 9, r + ' ' + rejilla(g).join(','));
  }
  {
    // Y el recorte ocurre donde DEBE: mas alla de la ultima celda del tablero, no
    // antes. Este es el limite que evita empujar un item fuera de la rejilla.
    const g = await boot(baseSave(
      [collector('dron'), collector('blaster'), collector('k1')],
      { warehouseCapacity: 21 }
    ));
    const r = moveToFreeCell(g, 'dron', 40, 'all', 'default');
    check('vacia: mas alla de la ultima celda se recorta, no se inventa',
      r === true && rejilla(g).indexOf('dron') === 20, r + ' ' + rejilla(g).join(','));
  }
  {
    // La celda INMEDIATAMENTE siguiente a la del item tambien es una celda libre
    // valida, y por la regla del tablero eso tambien cuenta: el item se va una
    // celda a la derecha y deja un hueco. Antes lo rechazaba por considerarlo un
    // no-op, y el jugador tenia razon: es un sitio libre mas.
    const g = await boot(baseSave([collector('a'), collector('dron')]));
    const r = moveToFreeCell(g, 'dron', 2, 'all', 'default');
    check('vacia: la celda libre de al lado tambien es un destino',
      r === true && rejilla(g).join(',') === 'a,·,dron', `${r} ${rejilla(g).join(',')}`);
    check('vacia: y el almacen no se toca, solo la disposicion',
      ids(g).join(',') === 'a,dron', ids(g).join(','));
  }
  {
    // Un item que el filtro oculta no se puede mover, igual que en el resto de
    // los destinos. La caja es de tipo crate, asi que el filtro "collector" la
    // esconde: no tiene celda propia y no hay ni un sitio al que senalarla.
    const g = await boot(baseSave([collector('a'), crate('c1'), collector('b')]));
    const r = moveToFreeCell(g, 'c1', 5, 'collector', 'default');
    check('vacia: con un filtro activo no se mueve un item oculto',
      r === false && ids(g).join(',') === 'a,c1,b', r + ' ' + ids(g).join(','));
  }
  {
    // Los huecos que el jugador ya habia puesto se respetan: cuentan para la
    // cuenta y se quedan donde su ancla. No se borra el acomodo previo.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    g.setWarehouseGaps(['a']);
    const r = moveToFreeCell(g, 'c', 5, 'all', 'default');
    check('vacia: el hueco previo sobrevive intacto',
      r === true && huecos(g).filter(id => id === 'a').length === 1, huecos(g).join(','));
    check('vacia: y el item cae igualmente en la senalada',
      rejilla(g).indexOf('c') === 5, rejilla(g).join(','));
  }
  {
    // EL TABLERO. Con 3 celdas ocupadas y capacidad 21, la rejilla dibuja 21
    // celdas: 3 ocupadas y 18 libres. Las 18 son sitios validos, no adorno, y el
    // item tiene que poder llegar a la ultima. Este es el tope REAL.
    //
    // Antes se confundia con un limite inventado de "un hueco por celda ocupada",
    // que hacia justo lo contrario de lo que el jugador pide: solo dejaba mover
    // el item hasta la celda 5.
    const g = await boot(baseSave(
      [collector('dron'), collector('blaster'), collector('k1')],
      { warehouseCapacity: 21 }
    ));
    const r = moveToFreeCell(g, 'dron', 17, 'all', 'default');
    check('tablero: con 3 celdas y 18 libres se llega a la celda 17',
      r === true && rejilla(g).indexOf('dron') === 17, `${r} ${rejilla(g).join(',')}`);
    check('tablero: y los otros dos items no se mueven de sitio',
      rejilla(g).slice(0, 2).join(',') === 'blaster,k1', rejilla(g).join(','));
    check('tablero: hacen falta 15 celdas de hueco, y caben',
      huecos(g).length === 15, huecos(g).length.toString());
  }
  {
    // El ULTIMO item tambien, que es justo el caso que antes rechazaba: no hay
    // nada a lo que moverse, solo huecos que abrir.
    const g = await boot(baseSave(
      [collector('dron'), collector('blaster'), collector('k1')],
      { warehouseCapacity: 21 }
    ));
    const r = moveToFreeCell(g, 'k1', 17, 'all', 'default');
    check('tablero: el ULTIMO item tambien llega a la celda 17',
      r === true && rejilla(g).indexOf('k1') === 17, `${r} ${rejilla(g).join(',')}`);
  }
  {
    // La ultima celda del tablero es el tope: mas alla se RECORTA, no se inventa
    // una posicion. Un item empujado mas alla dejaria de caber en la rejilla, y
    // eso es lo unico que este limite evita.
    const g = await boot(baseSave(
      [collector('dron'), collector('blaster'), collector('k1')],
      { warehouseCapacity: 21 }
    ));
    moveToFreeCell(g, 'dron', 17, 'all', 'default');
    const r = moveToFreeCell(g, 'k1', 40, 'all', 'default');
    check('tablero: mas alla de la ultima celda se recorta, no se inventa',
      r === true && rejilla(g).indexOf('k1') === 20, `${r} ${rejilla(g).join(',')}`);
  }
  {
    // El cortafuegos del guardado. Ya no se recorta por "un hueco por celda
    // ocupada" —eso era lo que hacia inutil la mitad del tablero—, sino por un
    // numero absurdo. El recorte no pierde items, que es lo que de verdad
    // importaria, pero evita pintar una rejilla gigante.
    const g = await boot(baseSave(
      [collector('a'), collector('b')],
      { warehouseCapacity: 12 }
    ));
    g.setWarehouseGaps(new Array(250).fill('a'));
    check('guardado: un numero disparatado de huecos se recorta',
      huecos(g).length === 200, huecos(g).length.toString());
    check('guardado: y ningun item desaparece por ello',
      ids(g).join(',') === 'a,b', ids(g).join(','));
  }
  resumen('huecos del almacen');
}

export default main();
