// ==========================================================================
//  Banco de pruebas de APILADO: una pila ocupa UNA ranura
//
//  El bug que cubre
//  ----------------
//  La rejilla agrupaba los items iguales en una celda y el contador de ranuras
//  contaba ENTRADAS del array. Un jugador con 19 llaves de Cifrado veía una
//  celda con un "19" arriba y un "19/21 ranuras" al lado, y el almacén se le
//  llenaba de llaves que él no había pedido guardar: cada caja que soltaba una
//  llave metía un item nuevo en vez de sumar una unidad a la pila que ya había.
//
//  Lo que se comprueba aquí
//  ------------------------
//    1. Meter un apilable lo suma a la pila existente, no abre ranura nueva.
//    2. La migración colapsa las partidas ya jugadas sin perder unidades.
//    3. El contador de ranuras y la rejilla dicen SIEMPRE lo mismo.
//    4. Un almacén lleno admite más unidades de lo que ya tiene, y no admite
//       un item que sí ocuparía ranura.
//    5. Vender y gastar una pila sigue funcionando después de fusionarla.
// ==========================================================================

import { visibleStacksFor } from '../src/components/warehouse';
import { countOccupiedSlots, isStackable, mergeStacks, stackUnits } from '../src/data/stacking';
import { boot, reload, bootNew, check, resumen, s, wh, ids, nanites, baseSave, collector, crate, key, crystal, consumable } from './kit';

/** Cuántas celdas pinta la rejilla, que es lo que el jugador ve. */
const celdas = (g: any) => visibleStacksFor(g, s(g), 'all', 'default');

/** Cuántas unidades de un tipo hay, sin importar cuántas pilas las guarden. */
const unidades = (g: any, type: string): number =>
  wh(g).filter((w: any) => w.type === type).reduce((a: number, w: any) => a + stackUnits(w), 0);

async function main() {
  // =========================================================================
  //  1. La regla, sola
  // =========================================================================
  {
    const uno = key('k1', 0, 19);
    const otro = key('k2', 0, 4);
    const r = mergeStacks([uno, otro]);

    check('apilado: dos pilas de la misma llave se funden en una',
      r.items.length === 1, String(r.items.length));
    check('apilado: y las unidades se suman, no se pierden',
      r.items[0].stackCount === 23, 'stackCount=' + r.items[0].stackCount);
    check('apilado: se conserva el id del primero',
      r.items[0].id === 'k1', r.items[0].id);
    check('apilado: y se avisa de que se ha tocado', r.changed === true);
  }
  {
    // Un item guardado sin `stackCount` vale UNA unidad, no cero. Restarlo como
    // cero lo dejaba en la pila sin cambiar nada y se perdía en silencio.
    const r = mergeStacks([key('k1', 0, 5), { id: 'k2', name: 'Llave de Cifrado', type: 'key', stackable: true } as any]);
    check('apilado: un item sin stackCount cuenta como una unidad',
      r.items.length === 1 && r.items[0].stackCount === 6,
      `items=${r.items.length} stack=${r.items[0]?.stackCount}`);
  }
  {
    // Dos llaves de DISTINTO nivel no son la misma pila: el jugador tiene que
    // poder elegir con cuál abre el cofre.
    const r = mergeStacks([key('k1', 0, 3), key('k2', 1, 3)]);
    check('apilado: dos llaves de distinto nivel NO se funden', r.items.length === 2, String(r.items.length));
  }
  {
    // Dos recolectores son dos cosas distintas aunque se llamen igual. Si se
    // fundieran, el jugador no podría elegir con cuál hacer clic.
    const r = mergeStacks([
      collector('r1', 3, { stackable: true, stackCount: 3 }),
      collector('r2', 3, { stackable: true, stackCount: 3 })
    ]);
    check('apilado: los recolectores no se funden nunca', r.items.length === 2, String(r.items.length));
  }
  {
    // Un recolector no apilable se queda como estaba: la fusión no puede
    // inventarle un `stackCount` que el juego no espera.
    const r = mergeStacks([collector('r1')]);
    check('apilado: un item que no es apilable se queda sin stackCount',
      r.items[0].stackCount === undefined, String(r.items[0].stackCount));
    check('apilado: y se avisa de que no se ha tocado nada', r.changed === false);
  }
  {
    check('apilado: una llave es apilable', isStackable(key('k1', 0, 1)) === true);
    check('apilado: un recolector no lo es', isStackable(collector('r1')) === false);
  }
  {
    // El contador de ranuras y la rejilla tienen que usar la MISMA clave. Si
    // una cuenta entradas y la otra grupos, el "21/21" no cuadra con lo que se ve.
    // Aqui: 1 recolector + 3 cajas del mismo tipo (una pila) + 1 pila de 19 llaves
    // + 1 pila de cristales = 4 ranuras. Contando entradas serian 24.
    const items = [collector('r1'), crate('c1', 'common', 3), crate('c2'), key('k1', 0, 19), crystal('x1', 1, 7)];
    check('ranuras: 3 cajas y 19 llaves son 2 ranuras, no 22',
      countOccupiedSlots(items) === 4, String(countOccupiedSlots(items)));
  }

  // =========================================================================
  //  2. Comprar y abrir van a la pila, no a una ranura nueva
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1')], { nanites: 10_000_000 }));
    for (let i = 0; i < 19; i++) g.buyStoreItem('keyT0');
    const pilas = wh(g).filter((w: any) => w.type === 'key');

    check('tienda: 19 llaves compradas son 19 unidades', unidades(g, 'key') === 19, String(unidades(g, 'key')));
    check('tienda: y están en UNA sola pila', pilas.length === 1, `pilas=${pilas.length}`);
    check('tienda: la pila lleva las 19 dentro', pilas[0]?.stackCount === 19, String(pilas[0]?.stackCount));
    check('tienda: y no se ha gastado ni una ranura más',
      countOccupiedSlots(wh(g)) === 2, String(countOccupiedSlots(wh(g))));
    check('tienda: el contador de llaves cuadra', s(g).keys === 19, String(s(g).keys));
  }
  {
    // El botín de una caja también. Con el almacén lleno esto antes era
    // imposible: cada llave que caía gastaba una ranura y el almacén se negaba
    // a admitirla, así que el jugador perdía el premio sin avisar.
    // Las 9 cajas de relleno se llaman todas distinto a propósito: si todas se
    // llamaran "Caja Común" se fundirían en una sola ranura y el almacén no
    // estaría lleno, que es justo lo que este bloque no mide.
    const relleno = Array.from({ length: 9 }, (_, i) => crate(`c${i}`, 'common', 1, { name: `Caja Común ${i}` }));
    const g = await boot(baseSave(
      [collector('r1'), ...relleno, key('k1', 0, 1)],
      { warehouseCapacity: 11, nanites: 0 }
    ));
    const antes = countOccupiedSlots(wh(g));
    check('cajas: el almacen de prueba esta lleno', antes === g.getCapacity(),
      `ranuras=${antes} cap=${g.getCapacity()}`);

    // Abrir una caja da Companion o botín aleatorio, así que lo que se comprueba
    // aquí es la REGLA, no el premio: con el almacén lleno, una llave que ya
    // tiene se suma a su pila en vez de perderse.
    const r = g.openCrateBox('c0', 'k1');
    check('cajas: con el almacen lleno la caja se abre igualmente', r.ok, r.msg ?? '');
    check('cajas: y el almacen no se desborda',
      countOccupiedSlots(wh(g)) <= g.getCapacity(),
      `ranuras=${countOccupiedSlots(wh(g))} cap=${g.getCapacity()}`);
  }

  // =========================================================================
  //  3. La migración de las partidas ya jugadas
  // =========================================================================
  {
    // 19 items de llave sueltos, como los dejaba el código viejo.
    const sueltos = Array.from({ length: 19 }, (_, i) => key(`k${i}`, 0, 1));
    const g = await boot(baseSave([collector('r1'), ...sueltos], { keys: 19, keysByTier: { 0: 19, 1: 0, 2: 0, 3: 0 } }));

    const llaves = wh(g).filter((w: any) => w.type === 'key');
    check('migracion: 19 llaves guardadas por separado se vuelven una pila',
      llaves.length === 1, `pilas=${llaves.length}`);
    check('migracion: y las 19 unidades siguen ahi', llaves[0]?.stackCount === 19, String(llaves[0]?.stackCount));
    check('migracion: no se pierde ni una unidad', unidades(g, 'key') === 19, String(unidades(g, 'key')));
    check('migracion: el contador de llaves no cambia', s(g).keys === 19, String(s(g).keys));
    check('migracion: y el almacen ocupa una ranura menos',
      countOccupiedSlots(wh(g)) === 2, String(countOccupiedSlots(wh(g))));
  }
  {
    // Y la fusión tiene que sobrevivir a la recarga: si el resultado no se
    // guarda, la siguiente vuelta a cargar deshace la migración.
    const sueltos = Array.from({ length: 19 }, (_, i) => key(`k${i}`, 0, 1));
    const g = await boot(baseSave([collector('r1'), ...sueltos], { keys: 19, keysByTier: { 0: 19, 1: 0, 2: 0, 3: 0 } }));
    const g2 = await reload();
    const llaves = wh(g2).filter((w: any) => w.type === 'key');

    check('migracion: la fusion se guarda', llaves.length === 1, `pilas=${llaves.length}`);
    check('migracion: y no se vuelve a partir en 19 al recargar',
      llaves[0]?.stackCount === 19, String(llaves[0]?.stackCount));
  }
  {
    // Una partida nueva: las 2 cajas de bienvenida se materializan, y ahora se
    // guardan como UNA pila de 2. Antes eran 2 items y 2 ranuras por dos cajas
    // idénticas que el jugador nunca eligió guardar por separado.
    const g = await bootNew();
    const cajas = wh(g).filter((w: any) => w.type === 'crate');
    check('partida nueva: las 2 cajas de bienvenida son UNA pila', cajas.length === 1, `pilas=${cajas.length}`);
    check('partida nueva: con las 2 unidades dentro', cajas[0]?.stackCount === 2, String(cajas[0]?.stackCount));
    check('partida nueva: y el contador de cajas sigue a 2', s(g).crates.common === 2, String(s(g).crates.common));
  }

  // =========================================================================
  //  4. El contador y la rejilla no pueden discrepar
  // =========================================================================
  {
    const items = [
      collector('r1'), collector('r2'),
      crate('c1', 'common', 4), crate('c2', 'common', 2), crate('c3', 'epic'),
      key('k1', 0, 19), key('k2', 1, 3),
      crystal('x1', 1, 8),
      consumable('u1', 'afk', 2), consumable('u2', 'clickBoost', 1)
    ];
    const g = await boot(baseSave(items));
    check('cuadra: el contador de ranuras coincide con las celdas pintadas',
      countOccupiedSlots(wh(g)) === celdas(g).length,
      `contador=${countOccupiedSlots(wh(g))} celdas=${celdas(g).length}`);
  }
  {
    // Y después de jugar: comprar, abrir y regalar cosas tiene que seguir
    // cuadrando. El descuadre reaparece en cuanto un camino se olvida de la regla.
    const g = await boot(baseSave([collector('r1')], { nanites: 10_000_000 }));
    g.buyStoreItem('keyT0');
    g.buyStoreItem('keyT0');
    g.buyStoreItem('upgradeCrystal');
    g.buyStoreItem('commonCrate');
    g.buyStoreItem('commonCrate');
    g.buyStoreItem('afkCard');
    g.openCrateBox(wh(g).find((w: any) => w.type === 'crate').id,
      wh(g).find((w: any) => w.type === 'key').id);

    check('cuadra: sigue cuadrando despues de comprar y abrir',
      countOccupiedSlots(wh(g)) === celdas(g).length,
      `contador=${countOccupiedSlots(wh(g))} celdas=${celdas(g).length}`);
  }
  {
    // Y con los filtros puestos, que el contador no se mueva: es el almacén
    // entero, no la vista filtrada.
    const g = await boot(baseSave([collector('r1'), key('k1', 0, 19), crate('c1')]));
    check('cuadra: el contador no depende del filtro',
      countOccupiedSlots(wh(g)) === 3, String(countOccupiedSlots(wh(g))));
  }

  // =========================================================================
  //  5. Almacén lleno: unidades sí, ranuras nuevas no
  // =========================================================================
  {
    // 4 recolectores (4 ranuras) + 1 pila de cajas + 1 pila de llaves = 6, y la
    // capacidad es 6: lleno. La pila de cajas tiene que estar YA, porque es la
    // que va a absorber la compra.
    const lleno = Array.from({ length: 4 }, (_, i) => collector(`r${i}`));
    const g = await boot(baseSave([...lleno, crate('c1', 'common', 1), key('k1', 0, 1)],
      { warehouseCapacity: 6, nanites: 10_000_000 }));
    check('lleno: el almacen esta lleno', countOccupiedSlots(wh(g)) === g.getCapacity(),
      `${countOccupiedSlots(wh(g))}/${g.getCapacity()}`);

    // Comprar otra caja del mismo tipo NO necesita ranura: se suma a la pila.
    // Antes esto se rechazaba y el jugador se comía las nanitas.
    const r = g.buyStoreItem('commonCrate');
    check('lleno: una caja mas se compra igual (deja de ocupar ranura nueva)', r !== false, String(r));
    check('lleno: y se suma a la pila de cajas, sin gastar ranura',
      countOccupiedSlots(wh(g)) === g.getCapacity() &&
      wh(g).find((w: any) => w.type === 'crate')?.stackCount === 2,
      `ranuras=${countOccupiedSlots(wh(g))} pila=${wh(g).find((w: any) => w.type === 'crate')?.stackCount}`);

    // Comprar un item que sí necesita ranura propia se sigue rechazando, y sin
    // cobrar: un "Almacén lleno" que descuenta nanitas es un robo.
    const g2 = await boot(baseSave([...lleno, crate('c1', 'common', 1), key('k1', 0, 1)],
      { warehouseCapacity: 6, nanites: 10_000_000 }));
    const antes = nanites(g2);
    const r2 = g2.buyStoreItem('companionCardT1');
    check('lleno: y un item que si ocupa ranura se rechaza', r2 === false, String(r2));
    check('lleno: sin cobrar por encima', nanites(g2) === antes, `${antes} -> ${nanites(g2)}`);
  }

  // =========================================================================
  //  5 bis. El boton de la tienda y la compra dicen lo mismo
  // =========================================================================
  // Con dos copias de la pregunta, el boton se apaga para algo que la compra si
  // deja pasar, o al reves: se enciende y al pulsarlo no ocurre nada. Lo que se
  // comprueba aqui es que `canBuyStoreItem` —lo que lee la tienda— coincide con
  // lo que hace `buyStoreItem` —quien cobra— en todas las combinaciones.
  {
    const lleno = Array.from({ length: 4 }, (_, i) => collector(`r${i}`));
    const g = await boot(baseSave([...lleno, crate('c1', 'common', 1), key('k1', 0, 1)],
      { warehouseCapacity: 6, nanites: 10_000_000 }));

    // Con el almacen lleno: cabe lo que se funde en una pila, y NO cabe lo que
    // necesita ranura propia. La tienda y la compra tienen que estar de acuerdo
    // en las dos mitades.
    check('tienda: con el almacen lleno, una caja SÍ cabe (se suma a su pila)',
      g.canBuyStoreItem('commonCrate') === true, String(g.canBuyStoreItem('commonCrate')));
    check('tienda: y comprar una caja funciona de verdad',
      g.buyStoreItem('commonCrate') !== false, 'rechazada');
    check('tienda: con el almacen lleno, una carta de compañero NO cabe',
      g.canBuyStoreItem('companionCardT1') === false, String(g.canBuyStoreItem('companionCardT1')));
    check('tienda: y comprarla falla de verdad',
      g.buyStoreItem('companionCardT1') === false, 'aceptada');
  }
  {
    // Y con hueco de sobra, nada se rechaza: un boton apagado sin motivo es un
    // jugador que cree que no le llega la nanita cuando si le llega.
    const g = await boot(baseSave([collector('r1')], { warehouseCapacity: 30, nanites: 10_000_000 }));
    for (const k of ['keyT0', 'upgradeCrystal', 'commonCrate', 'afkCard', 'companionCardT1', 'collectorCardT1']) {
      if (g.canBuyStoreItem(k) === false) {
        check(`tienda: ${k} se puede comprar con el almacen vacio`, false, 'dice que no cabe');
      }
    }
    check('tienda: con el almacen vacio, todo se puede comprar', true);
  }
  {
    // F27 · Ampliar YA no es un permiso: el expansor es un item y con el
    // almacén lleno y sin pila no entra. Los huecos de compañero sí siguen
    // siendo permisos y entran igual. `maxCompanionSlots: 1` porque con 3 el
    // de compañero ya estaría comprado y la prueba mediría eso.
    const lleno = Array.from({ length: 4 }, (_, i) => collector(`r${i}`));
    const g = await boot(baseSave([...lleno, crate('c1', 'common', 1), key('k1', 0, 1)],
      { warehouseCapacity: 6, maxCompanionSlots: 1, nanites: 10_000_000 }));
    check('tienda: ampliar el almacen con el almacen lleno se rechaza sin pila',
      g.canBuyStoreItem('expansorT1') === false && g.buyStoreItem('expansorT1') === false);
    check('tienda: y añadir un hueco de companero sigue entrando',
      g.canBuyStoreItem('companionSlot1') === true && g.buyStoreItem('companionSlot1') !== false);
  }

  // =========================================================================
  //  5 ter. La pregunta "¿cabe?" mira la MISMA llave que se entrega
  // =========================================================================
  // La preview y la creacion son dos funciones, y por eso pueden discrepar: la
  // preview decia "Llave de Cifrado" (nivel 0) mientras la compra creaba una
  // "Llave Reforzada" (nivel 1). Con el almacen lleno y una pila de nivel 0, el
  // boton decia que si cabia y la compra fallaba.
  //
  // No se comprueba mirando el nivel, que es un detalle del producto, sino la
  // consecuencia: DOS compras del mismo producto tienen que acabar en la MISMA
  // pila. Si preview y creacion discrepan, la primera compra abre una pila y la
  // segunda buscaria otra distinta, y el almacen se llenaria de un producto que
  // el jugador solo compro una vez cada vez.
  {
    const g = await boot(baseSave([collector('r1')], { warehouseCapacity: 30, nanites: 10_000_000 }));
    // Las cuatro llaves, no solo una. Que dos unidades del mismo nivel caigan en
    // una pila vale para las cuatro cartas, y comprobar solo la barata dejaría
    // sin mirar las otras tres.
    // Una partida por carta, y no una compartida. Con una sola partida, la T1 se
    // apila junto a la T0, y entonces la prueba de "caen en UNA pila" mide
    // cuatro llaves de tres niveles distintos y falla sin que haya ningún bug:
    // el error estaba en la prueba.
    for (const k of ['keyT0', 'keyT1', 'keyT2', 'keyT3', 'upgradeCrystal']) {
      const gk = await boot(baseSave([collector('r1')], { nanites: 10_000_000 }));
      gk.buyStoreItem(k as any);
      gk.buyStoreItem(k as any);
      const tipo = k.startsWith('key') ? 'key' : 'crystal';
      const pilas = wh(gk).filter((w: any) => w.type === tipo);
      check(`tienda: dos "${k}" caen en UNA pila, no en dos`,
        pilas.length === 1, `pilas=${pilas.length} (${pilas.map((w: any) => w.name).join(' | ')})`);
      check(`tienda: y la pila lleva las 2 unidades`,
        pilas[0]?.stackCount === 2, `stackCount=${pilas[0]?.stackCount}`);
      // Y las dos unidades tienen que ser del mismo nivel, o no abrirían los
      // mismos cofres y no se podrían fundir entre sí.
      check(`tienda: las dos unidades son del mismo nivel`,
        new Set(pilas.map((w: any) => w.tier)).size === 1,
        `niveles=${[...new Set(pilas.map((w: any) => w.tier))].join(',')}`);
    }
  }
  {
    // Y el caso que lo destapó: con el almacén lleno y una pila de lo que la
    // tienda entrega, la compra tiene que poder fundirse en ella. Aqui la pila
    // se monta COMPRANDO el producto, que es la unica forma de saber con
    // certeza que nivel se entrega sin duplicar la tabla.
    const g = await boot(baseSave([collector('r1')], { warehouseCapacity: 30, nanites: 10_000_000 }));
    // `keyT0` y la pila del almacén viejo es de nivel 0. Antes la carta se llamaba
    // 'key' pero entregaba la Reforzada (nivel 1), y por eso el relleno de abajo
    // era de nivel 1: el test estaba atado al bug sin quererlo. Las dos mitades
    // tienen que coincidir en el nivel o la compra no se funde con la pila.
    g.buyStoreItem('keyT0');
    const nombrePila = wh(g).find((w: any) => w.type === 'key')?.name;

    // Se rellena el almacen con items que no se funden entre si, hasta llenarlo.
    const rellenos = Array.from({ length: 40 }, (_, i) => collector(`x${i}`, 1, { name: `Relleno ${i}` }));
    for (const w of rellenos) {
      if (countOccupiedSlots(wh(g)) >= g.getCapacity()) break;
      g.buyStoreItem('collectorCardT1');
    }
    // Ajusta la capacidad para que quepa justo lo que ya hay.
    const g2 = await boot(baseSave(
      [collector('r1'), { id: 'k0', name: nombrePila, type: 'key', details: 'x', rarity: 'Común', tier: 0, sellPrice: 480, stackable: true, stackCount: 3 },
        ...rellenos.slice(0, 20).map((w, i) => ({ ...w, id: `x${i}` }))],
      { warehouseCapacity: 22, keys: 3, keysByTier: { 0: 3, 1: 0, 2: 0, 3: 0 }, nanites: 10_000_000 }
    ));
    const ocupada = countOccupiedSlots(wh(g2));
    check('tienda: el almacen de la prueba esta lleno', ocupada === g2.getCapacity(),
      `${ocupada}/${g2.getCapacity()}`);

    check('tienda: con el almacen lleno, la llave SÍ cabe (es su propia pila)',
      g2.canBuyStoreItem('keyT0') === true, String(g2.canBuyStoreItem('keyT0')));
    const r = g2.buyStoreItem('keyT0');
    const k = wh(g2).find((w: any) => w.type === 'key');
    check('tienda: y la compra va con ella en vez de fallar',
      r !== false && k?.stackCount === 4, `ok=${r !== false} pila=${k?.stackCount}`);
    check('tienda: sin gastar una ranura nueva',
      countOccupiedSlots(wh(g2)) === g2.getCapacity(), `${countOccupiedSlots(wh(g2))}/${g2.getCapacity()}`);
  }

  // =========================================================================
  //  6. Vender y gastar una pila sigue funcionando
  // =========================================================================
  {
    const sueltos = Array.from({ length: 19 }, (_, i) => key(`k${i}`, 0, 1));
    const g = await boot(baseSave([collector('r1'), collector('r2'), ...sueltos],
      { keys: 19, keysByTier: { 0: 19, 1: 0, 2: 0, 3: 0 }, nanites: 0 }));
    const pila = wh(g).find((w: any) => w.type === 'key');
    const antes = nanites(g);
    const r = g.sellItem(pila.id);

    check('vender: una pila fusionada se vende entera', r.ok && pila.id, r.msg ?? '');
    check('vender: y cobra las 19 unidades, no una',
      nanites(g) === antes + 19 * pila.sellPrice, `${antes} -> ${nanites(g)}`);
    check('vender: la pila desaparece del almacen',
      !wh(g).some((w: any) => w.type === 'key'), ids(g).join(','));
  }
  {
    const sueltos = Array.from({ length: 3 }, (_, i) => consumable(`u${i}`, 'afk', 1));
    const g = await boot(baseSave([collector('r1'), collector('r2'), ...sueltos], { afkCards: 3 }));
    const pila = wh(g).find((w: any) => w.type === 'consumable');
    check('gastar: las tarjetas se funden en una pila', pila?.stackCount === 3, String(pila?.stackCount));
    check('gastar: y el contador de AFK las ve las tres', s(g).afkCards === 3, String(s(g).afkCards));

    const r = g.useConsumable(pila.id);
    check('gastar: usar una gasta UNA unidad de la pila', r.ok, r.msg ?? '');
    check('gastar: y la pila queda en 2',
      wh(g).find((w: any) => w.id === pila.id)?.stackCount === 2,
      String(wh(g).find((w: any) => w.id === pila.id)?.stackCount));
  }

  resumen('apilado');
}

export default main();
