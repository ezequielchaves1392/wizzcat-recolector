// ==========================================================================
//  Banco de pruebas de FILTROS y de la rejilla del almacen
//
//  Comprueba las tres funciones que deciden que se ve y que se puede mover:
//
//    matchesFilter   -> si un item entra en la rejilla
//    visibleStacksFor-> como se agrupan los items en celdas y en que orden
//    moveItemTo      -> a donde va el item que el jugador arrastra
//
//  POR QUE ESTAS TRES JUNTAS Y NO POR SEPARADO. El agrupado de pilas no es solo
//  una cosa de pintar: el destino del arrastre es un INDICE DE CELDA, no un
//  indice del array. Si la rejilla que se pinta y la que usa el arrastre
//  agruparan distinto, el numero de celda que el jugador senala no es el sitio
//  donde acaba el item. Con tres cajas apiladas en medio, todo se desplaza una
//  celda y el item aterriza junto a la cosa equivocada. Esa clase de bug es
//  invisible mirando el codigo y muy visible jugando.
//
//  Tambien se comprueba el filtro `otros`, que es el unico con logica propia:
//  no es un tipo, es "todo lo que no sea recolector ni companero". Si un
//  guardado viejo trae un tipo desconocido, ese item tiene que caer en `otros`
//  y no desaparecer de la rejilla.
// ==========================================================================

import { visibleStacksFor, moveItemTo, matchesFilter } from '../src/components/warehouse';
import { textoDeCantidad, MAX_STACK } from '../src/data/stacking';
import {
  boot, reload, check, resumen, s, wh, ids, baseSave,
  collector, companion, crate, key, crystal, consumable
} from './kit';

/** Los ids de las celdas, que es lo que el jugador ve y lo que se comprueba. */
const celdas = (g: any, filtro: string, sort = 'default') =>
  visibleStacksFor(g, s(g), filtro, sort).map((c: any) => c.item.id);
/** Los ids de TODOS los items detrás de cada celda (una pila son varios). */
const grupos = (g: any, filtro: string, sort = 'default') =>
  visibleStacksFor(g, s(g), filtro, sort).map((c: any) => c.ids);

async function main() {
  // =========================================================================
  //  1. Filtros: cada boton enseña lo que promete
  // =========================================================================
  {
    const g = await boot(baseSave([
      collector('r1'), collector('r2'),
      companion('m1'),
      crate('c1'), key('k1'), crystal('x1'), consumable('u1', 'afk')
    ]));

    check('filtro Todo: deja pasar todo',
      celdas(g, 'all').length === 7, celdas(g, 'all').join(','));
    check('filtro Recolectores: solo recolectores',
      celdas(g, 'collector').join(',') === 'r1,r2', celdas(g, 'collector').join(','));
    check('filtro Companeros: solo companeros',
      celdas(g, 'companion').join(',') === 'm1', celdas(g, 'companion').join(','));
    check('filtro Otros: ni recolectores ni companeros',
      celdas(g, 'otros').join(',') === 'c1,k1,x1,u1', celdas(g, 'otros').join(','));

    // Los filtros se PARTEN la rejilla: nada puede estar en dos y nada se
    // puede perder. Si se pierde un item al filtrar, el jugador cree que ha
    // desaparecido del juego.
    const otros = new Set(celdas(g, 'collector').concat(celdas(g, 'companion')));
    const todo = new Set(celdas(g, 'all'));
    check('filtro: Recolectores + Companeros + Otros = Todo',
      otros.size + celdas(g, 'otros').length === todo.size,
      `partes=${otros.size + celdas(g, 'otros').length} todo=${todo.size}`);
  }
  {
    // Un tipo desconocido en un guardado viejo: tiene que ser visible en
    // `otros`. Si se hiciera `w.type === 'otros'`, el item se perderia.
    const g = await boot(baseSave([
      collector('r1'), companion('m1'),
      { id: 'z1', name: 'Cosa Rara', type: 'weapon', details: 'x', rarity: 'Común', sellPrice: 1 },
      { id: 'z2', name: 'Trozo', type: 'modulo', details: 'x', rarity: 'Raro', sellPrice: 1 }
    ]));
    check('filtro Otros: un tipo desconocido SI sale', celdas(g, 'otros').join(',') === 'z1,z2',
      celdas(g, 'otros').join(','));
    check('filtro: matchesFilter es la misma regla que usa la rejilla',
      matchesFilter({ type: 'weapon' }, 'otros') === true &&
      matchesFilter({ type: 'collector' }, 'otros') === false);
  }
  {
    // Un filtro sin ningun item de ese tipo tiene que dar una rejilla VACIA, no
    // "todo". Si `matchesFilter` cayera en un `return true` por defecto, el
    // filtro vacio dejaria pasar el almacen entero.
    const g = await boot(baseSave([collector('r1')]));
    check('filtro sin resultados: la rejilla queda vacia', celdas(g, 'companion').length === 0,
      celdas(g, 'companion').join(','));
  }
  {
    // Un filtro desconocido (un id de mas en el DOM) no debe romper la rejilla.
    const g = await boot(baseSave([collector('r1')]));
    check('filtro desconocido: no muestra nada en vez de mostrarlo todo',
      celdas(g, 'filtroQueNoExiste').length === 0, celdas(g, 'filtroQueNoExiste').join(','));
  }

  // =========================================================================
  //  2. Agrupado de pilas: una celda, N items
  // =========================================================================
  {
    // Dos items IGUALES pero NO contiguos en el array tienen que acabar en la
    // misma celda. Antes solo se juntaban los vecinos, y entonces la rejilla que
    // pintaba y la del arrastre tenian distinto numero de celdas.
    //
    // Se meten DESPUES de cargar, a proposito: `mergeStacks` ya funde los
    // duplicados al arrancar, asi que la unica forma de tener dos entradas
    // iguales separadas es que llegaran asi. Es exactamente el caso que la
    // agrupacion de la rejilla tiene que seguir soportando.
    const g = await boot(baseSave([crate('c1'), collector('r1')]));
    (s(g).warehouse as any[]).push(crate('c2'));
    check('pilas: dos cajas separadas por otra cosa se aunan en una celda',
      celdas(g, 'all').length === 2, celdas(g, 'all').join(','));
    check('pilas: la celda guarda los dos ids detras',
      grupos(g, 'all').find((gr: string[]) => gr.includes('c1'))?.join(',') === 'c1,c2',
      JSON.stringify(grupos(g, 'all')));
  }
  {
    // El contador de la esquina son UNIDADES, no items: una pila de 5 son 5, y
    // si hay otra pila de 1 se suman en la MISMA celda hasta el tope del tipo.
    const g = await boot(baseSave([crate('c1', 1, 5), crate('c2')]));
    const gs = visibleStacksFor(g, s(g), 'all', 'default');
    const celda = gs.find((c: any) => c.item.id === 'c1');
    check('pilas: el contador suma las unidades de la celda',
      celda.count === 6, 'count=' + celda.count);
    check('pilas: tras la fusion hay un solo item detras', celda.ids.length === 1, celda.ids.join(','));
    check('pilas: y ese item lleva las 6 unidades', celda.item.stackCount === 6,
      'stackCount=' + celda.item.stackCount);
  }
  {
    // F30 · EL TOPE DE PINTADO NO RECORTA EL CONTADOR. Antes la rejilla hacía
    // `Math.min(count, tope)` y con 25 cajas pintaba 20, que es lo que el jugador
    // reportaba como "tengo 25 y me sale 20" (R3).
    //
    // **Y AHORA EL CASO SON LAS LLAVES, PORQUE EL DE LAS CAJAS YA NO EXISTE.**
    // Las cajas tienen tope de PILA —20 de almacenamiento—, así que 25 cajas son
    // dos celdas de 20 y 5 y la pregunta de "25 en una celda" ya no se puede
    // hacer. Las llaves no tienen tope de pila: 150 llaves son una celda, y el
    // tope de 99 es solo de pintado. Es el mismo bug, en el tipo donde todavía
    // puede ocurrir, y por eso la prueba se queda ahí en vez de desaparecer.
    const g = await boot(baseSave([key('k1', 1, 150)]));
    const celda = visibleStacksFor(g, s(g), 'all', 'default')[0];
    check('pilas: el contador ya NO se recorta al tope (tope 99, hay 150)', celda.count === 150,
      'count=' + celda.count);
    check('pilas: y el item sigue con sus unidades reales', celda.item.stackCount === 150,
      'stackCount=' + celda.item.stackCount);
    check('pilas: la esquina dice "99+" y no "99"', textoDeCantidad(celda.count, 99) === '99+',
      textoDeCantidad(celda.count, 99));
  }
  {
    // Y EL CONTRAPUNTO: con tope de pila, 250 cajas SÍ son tres celdas. No es que
    // la rejilla las recorte —eso no pasa—: es que el almacén las reparte al
    // cargar, y por eso hay tres celdas de verdad y no una que mienta.
    const g = await boot(baseSave([crate('c1', 1, 250)]));
    const celdas = visibleStacksFor(g, s(g), 'all', 'default');
    check('pilas: 250 cajas son tres celdas, por el tope de pila',
      celdas.length === 3 && celdas.map(c => c.count).sort((a, b) => b - a).join(',') === '99,99,52',
      JSON.stringify(celdas.map(c => `${c.item.id}:${c.count}`)));
    check('pilas: y ninguna se pinta recortada, porque ninguna pasa de su tope',
      celdas.every(c => textoDeCantidad(c.count, MAX_STACK.crate) === String(c.count)),
      celdas.map(c => textoDeCantidad(c.count, MAX_STACK.crate)).join(' · '));
  }
  {
    // El tope de llaves es 99, como el de las cajas. Con el tope metido en la
    // función `textoDeCantidad`, una tabla mezclada se ve: 120 llaves se
    // pintarían "20+" como si fueran cajas.
    const g = await boot(baseSave([key('k1', 1, 120)]));
    const celda = visibleStacksFor(g, s(g), 'all', 'default')[0];
    check('pilas: 120 llaves tampoco se recortan', celda.count === 120, 'count=' + celda.count);
    check('pilas: y con el tope de llave la esquina es "99+", no "20+"',
      textoDeCantidad(celda.count, 99) === '99+', textoDeCantidad(celda.count, 99));
  }
  {
    // Un tipo que NO es apilable nunca se agrupa, por muchas unidades que tenga:
    // dos recolectores son dos celdas, o el jugador no puede elegir entre ellos.
    const g = await boot(baseSave([
      collector('r1', 3, { stackable: true, stackCount: 3 }),
      collector('r2', 3, { stackable: true, stackCount: 3 })
    ]));
    check('pilas: los recolectores no se apilan aunque digan que son apilables',
      celdas(g, 'all').length === 2, celdas(g, 'all').join(','));
  }
  {
    // Dos llaves de DISTINTO nivel no se aunan: el jugador tiene que poder
    // elegir con cual abrir el cofre.
    const g = await boot(baseSave([key('k1', 1), key('k2', 2)]));
    check('pilas: dos llaves de distinto nivel no se aunan',
      celdas(g, 'all').length === 2, celdas(g, 'all').join(','));
  }
  {
    // Dos cajas de DISTINTO tipo tampoco: abren cofres distintos.
    const g = await boot(baseSave([crate('c1', 1), crate('c2', 6)]));
    check('pilas: dos cajas de distinto tipo no se aunan',
      celdas(g, 'all').length === 2, celdas(g, 'all').join(','));
  }

  // =========================================================================
  //  3. Orden
  // =========================================================================
  {
    // Para los cuatro ordenes se usan COMPANEROS, no cajas. Los companeros no
    // son apilables, asi que no se funden entre si, y se les puede poner nombre,
    // rareza, tier y precio de reventa a voluntad.
    //
    // Ojo con las cajas: su tipo se deduce del NOMBRE, asi que un item con
    // `name: 'Beta'` deja de contar como caja, `materializePendingCrates` le crea
    // una de verdad al cargar, y la rejilla muestra 4 celdas donde se esperaban
    // 3. Cambiar el nombre de una caja no es inocuo, y por eso aqui no se toca.
    const g = await boot(baseSave([
      companion('a', 1, { name: 'Zeta', rarity: 'Común', sellPrice: 100 }),
      companion('b', 5, { name: 'Alfa', rarity: 'Legendario', sellPrice: 900 }),
      companion('c', 3, { name: 'Beta', rarity: 'Épico', sellPrice: 400 })
    ]));
    check('orden Mi orden: respeta el orden del jugador',
      celdas(g, 'all', 'default').join(',') === 'a,b,c', celdas(g, 'all', 'default').join(','));
    check('orden Nombre: alfabetico',
      celdas(g, 'all', 'name').join(',') === 'b,c,a', celdas(g, 'all', 'name').join(','));
    check('orden Rareza: de la mas rara a la mas comun',
      celdas(g, 'all', 'rarity').join(',') === 'b,c,a', celdas(g, 'all', 'rarity').join(','));
    check('orden Tier: de mayor a menor',
      celdas(g, 'all', 'tier').join(',') === 'b,c,a', celdas(g, 'all', 'tier').join(','));
    check('orden Valor: de mayor a menor precio',
      celdas(g, 'all', 'value').join(',') === 'b,c,a', celdas(g, 'all', 'value').join(','));

    // Ordenar NUNCA puede perder items ni cambiar el almacen: solo cambia el
    // orden en que se pintan. Si `sort` mutara el array del estado, arrastrar
    // algo dejaria el almacen desordenado para siempre.
    check('orden: ordenar no toca el orden guardado',
      ids(g).join(',') === 'a,b,c', ids(g).join(','));
  }
  {
    // El filtro manda sobre el orden: los items de otros tipos no se cuelan.
    const g = await boot(baseSave([
      collector('r1', 9, { name: 'Zeta' }),
      collector('r2', 1, { name: 'Alfa' }),
      companion('m1', 3, { name: 'Beta' })
    ]));
    check('orden + filtro: el filtro se aplica antes de ordenar',
      celdas(g, 'collector', 'name').join(',') === 'r2,r1', celdas(g, 'collector', 'name').join(','));
  }
  {
    // El filtro oculta items, y el arrastre usa indices de CELDA. Con un filtro
    // activo, el indice 0 de la rejilla es el primer item del filtro, no el
    // primero del almacen. Es la razon de que el destino se traduzca a ancla.
    const g = await boot(baseSave([
      collector('r1'), crate('c1'), collector('r2'), crate('c2')
    ]));
    check('filtro + arrastre: la celda 0 es del filtro, no del almacen',
      celdas(g, 'collector')[0] === 'r1', celdas(g, 'collector').join(','));
  }

  // =========================================================================
  //  4. Arrastre: la celda de destino es la que el jugador senala
  // =========================================================================
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    moveItemTo(g, 'a', 1, 'all', 'default');
    check('arrastre: soltar en la celda 1 deja el item en la celda 1',
      ids(g).join(',') === 'b,a,c', ids(g).join(','));
  }
  {
    // El caso que se reporta como "no puedo mover": arrastrar una celda sobre la
    // de al lado no movia NADA. Con el bloque entrando siempre por delante del
    // ancla, y siendo el vecino el ancla, el destino era el sitio donde ya
    // estaba. Es un no-op exacto y silencioso, sin ningun aviso.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    const r = moveItemTo(g, 'a', 1, 'all', 'default');
    check('arrastre: soltar sobre la celda de al lado SI mueve',
      r === true && ids(g).join(',') === 'b,a,c', ids(g).join(','));
  }
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    moveItemTo(g, 'c', 0, 'all', 'default');
    check('arrastre: mover a la primera celda lo pone al principio',
      ids(g).join(',') === 'c,a,b', ids(g).join(','));
  }
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    moveItemTo(g, 'a', 2, 'all', 'default');
    check('arrastre: soltar en la ultima celda lo pone en esa celda',
      ids(g).join(',') === 'b,c,a', ids(g).join(','));
  }
  {
    // Y el salto largo, que es el que se salta una celda entera: antes el bloque
    // acababa en la celda 1 de una celda 2 señalada.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c'), collector('d')]));
    moveItemTo(g, 'a', 3, 'all', 'default');
    check('arrastre: un salto de dos celdas cae donde se senalo',
      ids(g).join(',') === 'b,c,d,a', ids(g).join(','));
  }
  {
    // Los huecos del final no tienen item al que anclarse. Lo que el jugador
    // quiere decir es "dejalo al final", y es lo que tiene que pasar.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    const r = moveItemTo(g, 'a', 7, 'all', 'default');
    check('arrastre: soltar en un hueco del final lo manda al final',
      r === true && ids(g).join(',') === 'b,c,a', ids(g).join(','));
  }
  {
    // El caso exacto que reporta el jugador: un almacen lleno, una pila enorme
    // que ocupa una sola celda y un montón de huecos detras. Soltar en un hueco
    // tiene que llevar el item a la ultima celda OCUPADA, que es lo unico que
    // el guardado puede representar: el array es una lista, no una bandeja con
    // huecos. Y tiene que decirse, no dejar al jugador con la certeza de que el
    // arrastre esta roto.
    const items = [collector('dron'), companion('blaster')];
    for (let i = 0; i < 19; i++) items.push(key('k' + i));
    const g = await boot(baseSave(items, { warehouseCapacity: 21 }));
    check('huecos: con una pila de 19 hay 3 celdas y 21 huecos pintados',
      celdas(g, 'all').length === 3 && celdas(g, 'all').join(',') === 'dron,blaster,k0',
      celdas(g, 'all').join(','));
    const r = moveItemTo(g, 'dron', 3, 'all', 'default');
    check('huecos: soltar en un hueco lleva el item a la ultima celda ocupada',
      r === true && celdas(g, 'all').join(',') === 'blaster,k0,dron', celdas(g, 'all').join(','));
  }
  {
    // Y soltar en un hueco lo que YA esta al final no puede hacer nada, porque
    // no hay nada que colocar. Es un no-op legitimo, pero la vista tiene que
    // avisar: sin el aviso el jugador arrastra, ve la celda igual y concluye que
    // no se puede mover. El banco no puede comprobar el aviso (es de la vista),
    // pero si que puede fijar que el estado no se rompe.
    const items = [collector('dron'), companion('blaster')];
    for (let i = 0; i < 19; i++) items.push(key('k' + i));
    const g = await boot(baseSave(items, { warehouseCapacity: 21 }));
    const r = moveItemTo(g, 'k0', 3, 'all', 'default');
    check('huecos: soltar en un hueco lo que ya esta al final no rompe nada',
      r === true && celdas(g, 'all').join(',') === 'dron,blaster,k0', celdas(g, 'all').join(','));
  }
  {
    // El caso que el comentario del codigo describe: soltar sobre su propia
    // celda no hace nada, y el jugador no ve como se le ha duplicado el item.
    const g = await boot(baseSave([collector('a'), collector('b')]));
    const r = moveItemTo(g, 'a', 0, 'all', 'default');
    check('arrastre: soltar sobre su propia celda no hace nada',
      r === false && ids(g).join(',') === 'a,b', ids(g).join(','));
  }
  {
    // Una pila es UNA celda: arrastrarla mueve todos sus items juntos y en el
    // mismo orden. Mover solo el que representaba la celda dejaba la celda igual
    // de llena, y el jugador ve un arrastre que no movio nada.
    //
    // Se usan cajas de DISTINTO tipo: dos del mismo tipo son la misma pila y se
    // funden en un item, asi que no habria dos ids que arrastrar. Para el caso de
    // "una celda con varios items detras" (que es el de verdad) esta el caso de las
    // 19 llaves de mas abajo.
    const g = await boot(baseSave([
      crate('p1', 1, 2), crate('p2', 6, 3), collector('z')
    ]));
    // Celdas: [p1, p2, z]. Soltar p1 sobre la celda 1 tiene que dejar p1 EN la
    // celda 1, es decir DETRAS de p2 (la celda 2). Si el bloque entrara siempre
    // por delante del ancla, caeria en la celda 0, que es donde ya estaba: el
    // arrastre pareceria un no-op.
    const ok = moveItemTo(g, 'p1', 1, 'all', 'default');
    check('arrastre: arrastrar una pila la mueve entera', ok === true, ids(g).join(','));
    check('arrastre: los items de la pila van juntos y en orden',
      ids(g).join(',') === 'p2,p1,z', ids(g).join(','));
  }
  {
    // Soltar una pila sobre si misma no hace nada. Antes esto podia quitar los
    // items del array y volver a insertarlos en otro sitio, duplicando el
    // contenido o dejandolo en un orden distinto del que se veia.
    const g = await boot(baseSave([crate('p1', 1), crate('p2', 6), collector('z')]));
    const r = moveItemTo(g, 'p2', 1, 'all', 'default');
    check('arrastre: soltar una pila sobre su propia celda no hace nada',
      r === false && wh(g).length === 3, ids(g).join(','));
  }
  {
    // Un ancla que no existe no se puede usar: se rechaza en vez de mandarlo al
    // final, que es donde acabaria el item sin que el jugador lo pidiera.
    const g = await boot(baseSave([collector('a'), collector('b')]));
    const r = g.moveItems(['a'], 'no_existe');
    check('arrastre: un ancla inexistente se rechaza',
      r === false && ids(g).join(',') === 'a,b', ids(g).join(','));
  }
  {
    const g = await boot(baseSave([collector('a'), collector('b')]));
    const r = g.moveItems([], 'a');
    check('arrastre: mover una lista vacia se rechaza', r === false, String(r));
  }
  {
    const g = await boot(baseSave([collector('a'), collector('b')]));
    const r = g.moveItems(['no_existe'], null);
    check('arrastre: mover ids que no estan se rechaza', r === false, String(r));
  }
  {
    // Un id que ya no existe no puede bloquear el movimiento de los otros: el
    // jugador arrastra un grupo y uno de sus ids esta caducado. Se ancla en 'a'
    // para que el movimiento se vea: si el item ya estuviera delante del ancla,
    // el almacen no cambiaria y la prueba no mediria nada.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    const r = g.moveItems(['c', 'idCaducado'], 'a');
    check('arrastre: un id caducado no bloquea al resto',
      r === true && ids(g).join(',') === 'c,a,b', ids(g).join(','));
  }
  {
    // Arrastrar con un filtro activo: el destino es una celda de ESE filtro, y
    // el item acaba junto a el. Aqui es donde un indice de array en vez de un
    // indice de celda seequivoca.
    const g = await boot(baseSave([
      collector('r1'), crate('c1', 1), collector('r2'), crate('c2', 6)
    ]));
    // En el filtro "collector" las celdas son r1 y r2. Soltar r2 sobre r1
    // significa "pon r2 justo delante de r1".
    moveItemTo(g, 'r2', 0, 'collector', 'default');
    check('arrastre + filtro: el destino es una celda del filtro',
      ids(g).join(',') === 'r2,r1,c1,c2', ids(g).join(','));
  }
  {
    // Con un filtro activo, un item que el filtro OCULTA no se puede arrastrar:
    // no hay celda suya. Si se pudiera, moveria un item invisible.
    const g = await boot(baseSave([collector('r1'), crate('c1'), collector('r2')]));
    const r = moveItemTo(g, 'c1', 0, 'collector', 'default');
    check('arrastre + filtro: un item oculto por el filtro no se mueve',
      r === false && ids(g).join(',') === 'r1,c1,r2', ids(g).join(','));
  }
  {
    // El orden elegido NO se pierde: arrastrar con "Mayor valor" activo mueve
    // segun las celdas de ESE orden, que es lo que el jugador ve.
    //
    // La diferencia tiene que estar en el TIER, no en `sellPrice`: el precio de
    // venta lo calcula el juego con la valoracion por tier, potencial y afijos
    // (`getSellPriceFor`), y el `sellPrice` del guardado es lo que se usaba ANTES
    // de esa valoracion. Con dos recolectores identicos y distinto `sellPrice` la
    // prueba no comprobaba el orden: los dos valian lo mismo y el desempate los
    // dejaba en el orden del array, que es justo el resultado que sale siempre.
    const g = await boot(baseSave([
      collector('barato', 1, { sellPrice: 10 }),
      collector('caro', 9, { sellPrice: 999 })
    ]));
    const ordenValor = celdas(g, 'all', 'value');
    check('arrastre + orden: las celdas son las del orden activo',
      ordenValor.join(',') === 'caro,barato', ordenValor.join(','));
    moveItemTo(g, 'barato', 0, 'all', 'value');
    check('arrastre + orden: el item se coloca donde se senalo',
      ids(g).join(',') === 'barato,caro', ids(g).join(','));
  }

  // =========================================================================
  //  5. El movimiento se guarda
  // =========================================================================
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    moveItemTo(g, 'c', 0, 'all', 'default');
    const g2 = await reload();
    check('arrastre: el nuevo orden sobrevive a la recarga',
      ids(g2).join(',') === 'c,a,b', ids(g2).join(','));
    check('arrastre: y no se pierde ningun item al guardar',
      wh(g2).length === 3, ids(g2).join(','));
  }
  {
    // Un movimiento no puede cambiar NADA mas: ni.nanites, ni el contador, ni
    // los items. Es reordenar, no editar.
    const items = [collector('a'), crate('c1'), key('k1')];
    const g = await boot(baseSave(items, { nanites: 5000 }));
    const antes = JSON.stringify({ n: s(g).nanites, k: s(g).keys, c: s(g).crates.common });
    moveItemTo(g, 'a', 2, 'all', 'default');
    const despues = JSON.stringify({ n: s(g).nanites, k: s(g).keys, c: s(g).crates.common });
    check('arrastre: no toca nanitas ni contadores', antes === despues, despues);
  }

  // =========================================================================
  //  6. Vender quita celdas: la rejilla y el almacen no pueden discrepar
  // =========================================================================
  {
    // Si la rejilla se quedara con una celda vacia, el siguiente arrastre
    // contaria celdas que ya no existen y moveria el item un sitio equivocado.
    // Se usan cajas de distinto tipo para que cada una sea su propia celda: dos
    // del mismo tipo son una pila y se venden juntas de golpe.
    const g = await boot(baseSave([
      crate('c1', 1), crate('c2', 6), collector('r1'), collector('r2')
    ]));
    check('venta: antes hay 4 celdas', celdas(g, 'all').length === 4, celdas(g, 'all').join(','));
    g.sellItem('c1');
    check('venta: tras vender una caja su celda desaparece', celdas(g, 'all').length === 3,
      celdas(g, 'all').join(','));
    g.sellItem('c2');
    check('venta: tras vender la otra tambien', celdas(g, 'all').length === 2,
      celdas(g, 'all').join(','));
    check('venta: y la rejilla no inventa ids que no estan',
      new Set(celdas(g, 'all')).size === new Set(ids(g)).size, `${celdas(g, 'all').join(',')} / ${ids(g).join(',')}`);
  }
  {
    // Y el caso de una pila que se vende ENTERA: una celda antes, cero despues.
    // Si la rejilla se quedara con la celda vacia, el arrastre siguiente contaria
    // una celda que ya no existe.
    const g = await boot(baseSave([crate('p1', 1, 4), collector('r1'), collector('r2')]));
    check('venta: una pila es una celda', celdas(g, 'all').length === 3, celdas(g, 'all').join(','));
    g.sellItem('p1');
    check('venta: vender la pila quita su celda entera', celdas(g, 'all').length === 2,
      celdas(g, 'all').join(','));
    check('venta: y no queda ningun id fantasma',
      new Set(celdas(g, 'all')).size === new Set(ids(g)).size, ids(g).join(','));
  }
  {
    // Un filtro que ya no tiene resultados tras vender: la rejilla se vacia y el
    // arrastre deja de poder mover nada, en vez de mover a un indice que no
    // existe. Este caso pedia `r === true` con un item que el filtro OCULTA
    // (r1 es un recolector y el filtro es "companeros"), o sea mover algo que el
    // jugador no ve y sin celda propia: al final del almacen, por casualidad y
    // no porque se lo pidiera. Se rechaza, que es lo coherente.
    const g = await boot(baseSave([companion('m1'), companion('m2'), collector('r1'), collector('r2')]));
    check('venta + filtro: el filtro companeros tiene 2 celdas',
      celdas(g, 'companion').length === 2, celdas(g, 'companion').join(','));
    g.sellItem('m1');
    check('venta + filtro: tras vender queda 1 celda', celdas(g, 'companion').length === 1,
      celdas(g, 'companion').join(','));
    const r = moveItemTo(g, 'r1', 5, 'companion', 'default');
    check('venta + filtro: con un filtro corto no se mueve un item oculto',
      r === false && ids(g).join(',') === 'm2,r1,r2', ids(g).join(','));
    // Y lo que SI se puede mover con ese filtro corto: el companero que queda,
    // soltado en el hueco del final.
    const r2 = moveItemTo(g, 'm2', 4, 'companion', 'default');
    check('venta + filtro: el item del filtro activo si se mueve a un hueco',
      r2 === true && ids(g).join(',') === 'r1,r2,m2', ids(g).join(','));
  }
  {
    // El almacen vacio: ni una celda, ni un movimiento que reviente.
    const g = await boot(baseSave([collector('r1'), collector('r2')]));
    g.sellItem('r1');
    check('venta: un almacen con un item da una celda', celdas(g, 'all').length === 1, celdas(g, 'all').join(','));
    check('venta: mover la ultima celda a un hueco la manda al final (no hay nada que mover)',
      moveItemTo(g, 'r2', 0, 'all', 'default') === false, ids(g).join(','));
  }
  {
    // Un almacen VACIO de verdad: la rejilla no falla.
    const g = await boot(baseSave([]));
    check('vacio: sin items hay cero celdas', celdas(g, 'all').length === 0, celdas(g, 'all').join(','));
    check('vacio: y mover en un almacen vacio se rechaza sin error',
      moveItemTo(g, 'lo_que_sea', 0, 'all', 'default') === false);
  }

  resumen('filtros y rejilla');
}

export default main();
