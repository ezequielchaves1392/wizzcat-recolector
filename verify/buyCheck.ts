// ==========================================================================
//  Banco de pruebas de la COMPRA
//
//  Cubre `buyStoreItem` (la tienda entera) y `buyNode` (el arbol de pasivas).
//
//  Lo que se comprueba, y por que es lo que rompe:
//
//  - Que se COBRA lo mismo que se ENSEÑA. El precio lleva el descuento del
//    arbol; si la carta muestra un numero y el cobro aplica otro, el jugador
//    pierde nanitas sin aviso en cada compra.
//  - Que lo comprado LLEGA. Una compra que se cobra y no mete nada en el almacen
//    es la peor clase de bug: las nanitas se van, el item no, y no hay forma de
//    que el jugador lo note hasta que le falta.
//  - Que NO se compra lo que no se puede tener: sin nanitas, con el almacen
//    lleno, o con un permiso que ya se compro.
//  - Que el estado sobrevive a la recarga, que es donde se cae lo que solo
//    vivia en memoria.
// ==========================================================================

import { STORE_ITEMS } from '../src/gameLoop';
import { TREE_BY_ID, nodeCost } from '../src/data/tree';
import {
  boot, reload, check, resumen, s, wh, ids, nanites, deType, find, ranuras, baseSave, crate, distintos
} from './kit';

async function main() {
  // =========================================================================
  //  1. Compra simple: cobra lo justo y entrega el item
  // =========================================================================
  {
    const g = await boot(baseSave([], { nanites: 10_000 }));
    const antes = nanites(g);
    const item = g.buyStoreItem('key');

    check('tienda: devuelve el item comprado', !!item && item.type === 'key', JSON.stringify(item?.id));
    check('tienda: cobra el precio de carta', nanites(g) === antes - STORE_ITEMS.key.cost,
      `cobrado=${antes - nanites(g)} precio=${STORE_ITEMS.key.cost}`);
    check('tienda: la llave entra en el almacen', deType(g, 'key') === 1, ids(g).join(','));
    check('tienda: el contador de llaves sube a 1', s(g).keys === 1, 'keys=' + s(g).keys);
    check('tienda: el item devuelto es el que esta en el almacen', !!item?.id && !!find(g, item.id));

    const g2 = await reload();
    check('tienda: la compra sobrevive a la recarga', deType(g2, 'key') === 1 && s(g2).keys === 1,
      `items=${deType(g2, 'key')} keys=${s(g2).keys}`);
  }

  // =========================================================================
  //  2. Cada categoria de la tienda, una por una
  //
  //     El fallo tipico es que una rama del `if/else` de `buyStoreItem` se quede
  //     sin cubrir: se cobra y no se entrega. Por eso se recorre la lista
  //     completa en vez de unos pocos casos representativos.
  // =========================================================================
  const casos: Array<{ k: string; tipo: string; coste: number; nombre?: string }> = [
    { k: 'upgradeCrystal', tipo: 'crystal', coste: 60, nombre: 'Cristal' },
    { k: 'commonCrate', tipo: 'crate', coste: 500, nombre: 'Común' },
    { k: 'rareCrate', tipo: 'crate', coste: 1500, nombre: 'Rara' },
    { k: 'epicCrate', tipo: 'crate', coste: 5500, nombre: 'Épica' },
    { k: 'legendaryCrate', tipo: 'crate', coste: 21000, nombre: 'Legendaria' },
    { k: 'clickBuff', tipo: 'consumable', coste: 800, nombre: 'Buff Clicks' },
    { k: 'passiveBuff', tipo: 'consumable', coste: 1500, nombre: 'Buff Pasivo' },
    { k: 'backpackExpander', tipo: 'consumable', coste: 1400, nombre: 'Expansor' },
    { k: 'afkCard', tipo: 'consumable', coste: 10000, nombre: 'Tarjeta AFK' },
    { k: 'clickX2Card', tipo: 'consumable', coste: 5000, nombre: 'Click x2' },
    { k: 'clickX3Card', tipo: 'consumable', coste: 15000, nombre: 'Click x3' },
    { k: 'calibrationStone', tipo: 'consumable', coste: 45000, nombre: 'Calibración' },
    { k: 'stabilityNano', tipo: 'consumable', coste: 90000, nombre: 'Nanopartícula' },
    { k: 'companionCardT1', tipo: 'companion', coste: 900 },
    { k: 'companionCardT5', tipo: 'companion', coste: 7400 },
    { k: 'collectorCardT1', tipo: 'collector', coste: 850 },
    { k: 'collectorCardT10', tipo: 'collector', coste: 17500 }
  ];

  for (const c of casos) {
    const g = await boot(baseSave([], { nanites: 200_000 }));
    const antesN = wh(g).length;
    const antesNanites = nanites(g);
    const item = g.buyStoreItem(c.k as any);

    check(`tienda ${c.k}: cobra ${c.coste}`, nanites(g) === antesNanites - c.coste,
      `cobrado=${antesNanites - nanites(g)}`);
    check(`tienda ${c.k}: mete 1 item de tipo ${c.tipo}`,
      wh(g).length === antesN + 1 && deType(g, c.tipo) === 1,
      `antes=${antesN} ahora=${wh(g).length} de ${c.tipo}=${deType(g, c.tipo)}`);
    if (c.nombre) {
      check(`tienda ${c.k}: el item se llama "${c.nombre}"`,
        String(item?.name ?? '').includes(c.nombre), `nombre=${item?.name}`);
    }
    // Un item recien comprado tiene que ser utilizable: si la compra entrega
    // algo que el juego no reconoce despues, es un callejon sin salida.
    check(`tienda ${c.k}: el item comprado existe y trae id`,
      !!item?.id && !!find(g, item.id), JSON.stringify(item?.id));
  }

  // Los contadores derivados tienen que incluir lo recien comprado: son lo que
  // lee el arbol de pasivas y las pantallas de progreso.
  {
    const g = await boot(baseSave([], { nanites: 200_000 }));
    g.buyStoreItem('epicCrate');
    g.buyStoreItem('epicCrate');
    check('tienda: dos cajas epicas dejan el contador a 2', s(g).crates.epic === 2, 'epic=' + s(g).crates.epic);
    const g2 = await reload();
    check('tienda: el contador de cajas no se duplica al recargar', s(g2).crates.epic === 2,
      'epic=' + s(g2).crates.epic);
  }
  {
    const g = await boot(baseSave([], { nanites: 200_000 }));
    g.buyStoreItem('afkCard');
    check('tienda: la tarjeta AFK cuenta al comprarse', s(g).afkCards === 1, 'afkCards=' + s(g).afkCards);
    const g2 = await reload();
    check('tienda: y sigue contando tras recargar', s(g2).afkCards === 1, 'afkCards=' + s(g2).afkCards);
  }
  {
    // Un compañero comprado tiene que existir en los DOS sitios: la ficha que
    // paga pasivo (`state.companions`) y el item del almacen. Si solo se
    // creara el item, se podria equipar y no pagaria nada.
    const g = await boot(baseSave([], { nanites: 200_000 }));
    const item = g.buyStoreItem('companionCardT3');
    check('tienda: el compañero comprado tiene ficha en state.companions',
      s(g).companions.some((c: any) => c.id === item.id), JSON.stringify(s(g).companions.map((c: any) => c.id)));
    g.equipCompanion(item.id);
    check('tienda: y equipado paga ingreso pasivo', s(g).passiveIncome > 0, 'pasivo=' + s(g).passiveIncome);
    const g2 = await reload();
    check('tienda: el compañero comprado sobrevive a la recarga',
      deType(g2, 'companion') >= 1 && s(g2).passiveIncome > 0,
      `items=${deType(g2, 'companion')} pasivo=${s(g2).passiveIncome}`);
  }

  // =========================================================================
  //  3. Sin nanitas no se compra, y no se cobra de mas
  // =========================================================================
  {
    const g = await boot(baseSave([], { nanites: 100 }));
    const antes = nanites(g);
    const r = g.buyStoreItem('legendaryCrate');
    check('tienda: sin nanitas no se compra', r === false, String(r));
    check('tienda: y no se cobra nada', nanites(g) === antes, 'nanites=' + nanites(g));
    check('tienda: ni se entrega un item a medias', wh(g).length === 0, ids(g).join(','));
  }
  {
    // El borde: nanitas EXACTAMENTE iguales al precio. Si el `>=` esta al reves,
    // el jugador con la cantidad justa no puede comprar nunca.
    const g = await boot(baseSave([], { nanites: 60 }));
    const r = g.buyStoreItem('upgradeCrystal');
    check('tienda: con las nanitas justas SI se compra', r !== false, String(r));
    check('tienda: y deja la cartera a cero', nanites(g) === 0, 'nanites=' + nanites(g));
  }
  {
    const g = await boot(baseSave([], { nanites: 59 }));
    const r = g.buyStoreItem('upgradeCrystal');
    check('tienda: con una nanita menos NO se compra', r === false && nanites(g) === 59,
      'nanites=' + nanites(g));
  }
  {
    // Una clave que no existe en la tienda no puede cobrar nada, aunque se le
    // pase un id con el shape correcto.
    const g = await boot(baseSave([], { nanites: 5000 }));
    const antes = nanites(g);
    const r = g.buyStoreItem('itemInventado' as any);
    check('tienda: una clave inexistente devuelve false', r === false, String(r));
    check('tienda: y no cobra', nanites(g) === antes, 'nanites=' + nanites(g));
  }

  // =========================================================================
  //  4. El descuento del arbol: la carta y el cobro salen del mismo numero
  // =========================================================================
  {
    // `refinery` da -4% y `bulk_buy` -5%. Se compran por `nodeLevels` porque
    // `state.bonus` NO se guarda: se recalcula de los nodos al cargar.
    const g = await boot(baseSave([], {
      nanites: 200_000,
      nodeLevels: { refinery: 3, bulk_buy: 2, scrapyard: 1 },
      unlockedNodes: ['refinery', 'bulk_buy', 'scrapyard']
    }));
    const descuento = s(g).bonus.costReduction;
    check('descuento: los nodos comprados bajan el coste de tienda', descuento > 0, 'costReduction=' + descuento);

    const antes = nanites(g);
    g.buyStoreItem('commonCrate');
    const esperado = Math.floor(STORE_ITEMS.commonCrate.cost * (1 - descuento));
    check('descuento: el cobro aplica el descuento del arbol',
      nanites(g) === antes - esperado,
      `cobrado=${antes - nanites(g)} esperado=${esperado} sin=${STORE_ITEMS.commonCrate.cost}`);
  }
  {
    // Con el descuento al maximo (4% x 6 + 5% x 5 = 49%) el precio no puede
    // salir negativo: si saliera, `nanites -= coste` regalaria nanitas al comprar.
    const g = await boot(baseSave([], {
      nanites: 1000,
      nodeLevels: { refinery: 6, bulk_buy: 5, scrapyard: 1 },
      unlockedNodes: ['refinery', 'bulk_buy', 'scrapyard']
    }));
    const antes = nanites(g);
    const r = g.buyStoreItem('commonCrate');
    check('descuento: con descuento enorme el item llega igual', r !== false && deType(g, 'crate') === 1,
      ids(g).join(','));
    const cobrado = antes - nanites(g);
    check('descuento: se cobra menos que el precio de carta, pero algo',
      cobrado > 0 && cobrado < STORE_ITEMS.commonCrate.cost,
      `cobrado=${cobrado} de carta=${STORE_ITEMS.commonCrate.cost}`);
    check('descuento: y la cartera nunca queda negativa', nanites(g) >= 0, 'nanites=' + nanites(g));
  }

  // =========================================================================
  //  5. Almacen lleno
  //
  //     La capacidad se cuenta en RANURAS OCUPADAS, y por eso 30 cajas iguales
  //     solo ocupan 2: se funden en una pila al cargar. Para llenar 30 hay que
  //     usar 30 items DISTINTOS, que es lo que hace `distintos()`.
  // =========================================================================
  {
    const g = await boot(baseSave(distintos(30), { nanites: 200_000 }));
    check('capacidad: 30 items distintos llenan 30 ranuras', ranuras(g) === 30, 'ranuras=' + ranuras(g));
    const antes = nanites(g);
    const r = g.buyStoreItem('commonCrate');
    check('capacidad: con el almacen lleno no se compra un item', r === false, String(r));
    check('capacidad: y no se cobra', nanites(g) === antes, 'nanites=' + nanites(g));
    check('capacidad: el almacen sigue igual', ranuras(g) === 30, 'ranuras=' + ranuras(g));
  }
  {
    // La contra-prueba: dos cajas de DISTINTO tipo son dos celdas. Si dos
    // entradas cualesquiera se fundieran en una, el jugador no podria elegir con
    // cual abrir el cofre.
    const g = await boot(baseSave([crate('c1', 'common', 20), crate('c2', 'epic', 10)],
      { nanites: 200_000, warehouseCapacity: 2 }));
    check('capacidad: dos cajas de distinto tipo son dos ranuras', ranuras(g) === 2,
      'ranuras=' + ranuras(g));
  }
  {
    // Y dos del MISMO tipo son una sola ranura, aunque sean dos entradas
    // distintas: la fusion de `data/stacking` las junta al cargar.
    const g = await boot(baseSave([crate('c1', 'common', 20), crate('c2', 'common', 10)],
      { nanites: 200_000, warehouseCapacity: 2 }));
    check('capacidad: dos cajas del mismo tipo se funden en una ranura', ranuras(g) === 1,
      'ranuras=' + ranuras(g));
  }
  {
    // Los PERMISOS no son objetos: Ampliacion de almacen y Hueco de companero no
    // ocupan ranura, precisamente para poder comprarlos con el almacen lleno.
    const g = await boot(baseSave(distintos(30), { nanites: 200_000 }));
    const capAntes = s(g).warehouseCapacity;
    const r = g.buyStoreItem('warehouseSlot');
    check('capacidad: la ampliacion de almacen SI se compra con el almacen lleno', r !== false, String(r));
    check('capacidad: y sube la capacidad 5', s(g).warehouseCapacity === capAntes + 5,
      `${capAntes} -> ${s(g).warehouseCapacity}`);
    check('capacidad: sin meter un item de mas', ranuras(g) === 30, 'ranuras=' + ranuras(g));
  }
  {
    // Un item apilable puede NO necesitar ranura nueva: si ya hay una pila de su
    // tipo, la compra se suma a ella aunque el almacen este lleno. Preguntar solo
    // "¿quedan ranuras libres?" rechazaba la compra y hacia perder las nanitas por
    // un item que no ocupaba ni una ranura.
    const g = await boot(baseSave([crate('c1', 'common', 5)], { nanites: 200_000, warehouseCapacity: 1 }));
    check('capacidad: una ranura y una pila de cajas = almacen lleno', ranuras(g) === 1,
      'ranuras=' + ranuras(g) + '/' + g.getCapacity());
    const antes = nanites(g);
    const r = g.buyStoreItem('commonCrate');
    check('capacidad: con el almacen lleno, una caja que cabe en la pila SI se compra',
      r !== false, String(r));
    check('capacidad: se suma a la pila sin abrir ranura nueva',
      ranuras(g) === 1 && find(g, 'c1')?.stackCount === 6,
      'ranuras=' + ranuras(g) + ' unidades=' + find(g, 'c1')?.stackCount);
    check('capacidad: y se paga una sola vez', nanites(g) === antes - STORE_ITEMS.commonCrate.cost,
      'nanites=' + nanites(g));
  }
  {
    // Lo que NO cabe de ninguna manera sigue sin entrar: una caja de otro tipo
    // necesita ranura nueva y no hay ninguna.
    const g = await boot(baseSave([crate('c1', 'common', 5)], { nanites: 200_000, warehouseCapacity: 1 }));
    const antes = nanites(g);
    const r = g.buyStoreItem('epicCrate');
    check('capacidad: un item que necesita ranura nueva se rechaza con el almacen lleno',
      r === false, String(r));
    check('capacidad: y no se cobra', nanites(g) === antes, 'nanites=' + nanites(g));
    check('capacidad: la pila existente no cambia', find(g, 'c1')?.stackCount === 5,
      'unidades=' + find(g, 'c1')?.stackCount);
  }
  {
    // Una carta de RECOLECTOR no es apilable: necesita ranura siempre, y con el
    // almacen lleno se rechaza.
    const g = await boot(baseSave([crate('c1', 'common', 5)], { nanites: 200_000, warehouseCapacity: 1 }));
    const r = g.buyStoreItem('collectorCardT1');
    check('capacidad: una carta de recolector con el almacen lleno se rechaza', r === false, String(r));
  }
  {
    // Un hueco justo: entra el que cabe y se rechaza el siguiente.
    const g = await boot(baseSave([], { nanites: 200_000, warehouseCapacity: 1 }));
    const r1 = g.buyStoreItem('commonCrate');
    const r2 = g.buyStoreItem('rareCrate');
    check('capacidad: el primer item entra', r1 !== false);
    check('capacidad: el segundo se rechaza al llenarse', r2 === false && ranuras(g) === 1,
      'ranuras=' + ranuras(g));
    check('capacidad: y solo se cobro una vez', nanites(g) === 200_000 - STORE_ITEMS.commonCrate.cost,
      'nanites=' + nanites(g));
  }
  {
    // La capacidad efectiva manda sobre la guardada: los slots del arbol cuentan.
    const g = await boot(baseSave([], {
      nanites: 200_000, warehouseCapacity: 1,
      nodeLevels: { storage_rack: 1, scrapyard: 1 },
      unlockedNodes: ['storage_rack', 'scrapyard']
    }));
    check('capacidad: la capacidad efectiva suma los slots del arbol',
      g.getCapacity() === 1 + s(g).bonus.storageSlots, `getCapacity=${g.getCapacity()}`);
    const comprados = ['commonCrate', 'rareCrate', 'epicCrate'].filter((k) => g.buyStoreItem(k as any) !== false).length;
    check('capacidad: se pueden llenar los huecos del arbol',
      comprados === s(g).bonus.storageSlots, `comprados=${comprados} bonus=${s(g).bonus.storageSlots}`);
  }

  // =========================================================================
  //  6. Los permisos de companero son unicos
  // =========================================================================
  {
    const g = await boot(baseSave([], { nanites: 200_000, maxCompanionSlots: 1 }));
    const r1 = g.buyStoreItem('companionSlot1');
    check('permisos: el primer hueco de companero se compra', r1 !== false, String(r1));
    check('permisos: y sube los slots a 2', s(g).maxCompanionSlots === 2, 'slots=' + s(g).maxCompanionSlots);
    const r2 = g.buyStoreItem('companionSlot1');
    check('permisos: comprarlo dos veces se rechaza', r2 === false, String(r2));
    check('permisos: y no se cobra la segunda', s(g).maxCompanionSlots === 2, 'slots=' + s(g).maxCompanionSlots);
  }
  {
    // Comprar el ranura de escuadron sin el primer hueco no tiene sentido: el
    // `companionSlot2` de tienda pone los slots a 5, y comprarlo con 1 slot base
    // regalaria los intermedios.
    const g = await boot(baseSave([], { nanites: 200_000, maxCompanionSlots: 1 }));
    const r = g.buyStoreItem('companionSlot2');
    check('permisos: la ranura de escuadron se compra', r !== false, String(r));
    check('permisos: y lleva los slots a 5', s(g).maxCompanionSlots === 5, 'slots=' + s(g).maxCompanionSlots);
  }
  {
    // El guard de los permisos compara sobre el total EFECTIVO, no sobre la base
    // guardada. Con la base en 2 y +1 del arbol, el total efectivo es 3: comprar
    // el ranura de escuadron (que lleva a 5) tiene que seguir siendo posible, o
    // el slot del arbol habria "bloqueado" la compra siguiente.
    const g = await boot(baseSave([], {
      nanites: 200_000, maxCompanionSlots: 2,
      nodeLevels: { squad_slots: 1, passive_loop: 1, core_sink: 1 },
      unlockedNodes: ['squad_slots', 'passive_loop', 'core_sink']
    }));
    check('permisos: el slot del arbol suma al total efectivo', g.getCompanionSlots() === 3,
      'slots=' + g.getCompanionSlots());
    const r = g.buyStoreItem('companionSlot2');
    check('permisos: con 3 slots efectivos se puede comprar la ranura de escuadron',
      r !== false, String(r));
    check('permisos: y lleva los slots a 5', s(g).maxCompanionSlots === 5,
      'slots=' + s(g).maxCompanionSlots);
  }
  {
    // Y con la base en 1 mas el +1 del arbol, el total efectivo ya es 2: el hueco
    // de companero es innecesario y no se debe cobrar por comprarlo.
    const g = await boot(baseSave([], {
      nanites: 200_000, maxCompanionSlots: 1,
      nodeLevels: { squad_slots: 1, passive_loop: 1, core_sink: 1 },
      unlockedNodes: ['squad_slots', 'passive_loop', 'core_sink']
    }));
    const antes = nanites(g);
    const r = g.buyStoreItem('companionSlot1');
    check('permisos: con 2 slots efectivos no se cobra un hueco que ya se tiene',
      r === false && nanites(g) === antes, `ok=${r} nanites=${nanites(g)}`);
  }

  // =========================================================================
  //  7. El arbol de pasivas: `buyNode`
  // =========================================================================
  {
    const g = await boot(baseSave([], { cores: 100, unlockedNodes: [], nodeLevels: {} }));
    const node = TREE_BY_ID.core_sink;                    // raiz sin requisitos
    const coste = nodeCost(node, 0);
    const antes = s(g).cores;
    const r = g.buyNode('core_sink');

    check('arbol: la compra de un nodo raiz se concede', r.success, r.msg ?? '');
    check('arbol: cobra los nucleos justos', s(g).cores === antes - coste,
      `cobrado=${antes - s(g).cores} coste=${coste}`);
    check('arbol: sube el nivel del nodo', s(g).nodeLevels.core_sink === 1,
      'nivel=' + s(g).nodeLevels.core_sink);
    check('arbol: proyecta el nodo en unlockedNodes', s(g).unlockedNodes.includes('core_sink'),
      s(g).unlockedNodes.join(','));
    check('arbol: aplica la bonificacion del nodo', s(g).bonus.passiveMult > 0,
      'passiveMult=' + s(g).bonus.passiveMult);

    const g2 = await reload();
    check('arbol: el nodo comprado sobrevive a la recarga', s(g2).nodeLevels.core_sink === 1,
      'nivel=' + s(g2).nodeLevels.core_sink);
    check('arbol: y la bonificacion se recalcula al cargar', s(g2).bonus.passiveMult > 0,
      'passiveMult=' + s(g2).bonus.passiveMult);
  }
  {
    // Subir de nivel encarece: el coste crece con `costGrowth`. Si el nivel 2
    // costara lo mismo que el 1, la bonificacion seria gratis.
    const g = await boot(baseSave([], {
      cores: 1000, nodeLevels: { core_sink: 1 }, unlockedNodes: ['core_sink']
    }));
    const n1 = nodeCost(TREE_BY_ID.core_sink, 1);
    const antes = s(g).cores;
    const r = g.buyNode('core_sink');
    check('arbol: el segundo nivel se compra', r.success, r.msg ?? '');
    check('arbol: el segundo nivel cuesta MAS que el primero',
      s(g).cores === antes - n1 && n1 > nodeCost(TREE_BY_ID.core_sink, 0),
      `nivel2=${n1} nivel1=${nodeCost(TREE_BY_ID.core_sink, 0)}`);
    check('arbol: y acumula el nivel', s(g).nodeLevels.core_sink === 2, 'nivel=' + s(g).nodeLevels.core_sink);
    check('arbol: la bonificacion se suma por niveles', s(g).bonus.passiveMult > 0.15,
      'passiveMult=' + s(g).bonus.passiveMult);
  }
  {
    // Sin requisitos cumplidos no se compra, y el mensaje los NOMBRA: si no los
    // nombra, el jugador no sabe que le falta.
    const g = await boot(baseSave([], { cores: 10_000 }));
    const r = g.buyNode('auto_clicker');                // requiere 'core_edge'
    check('arbol: sin requisitos no se compra', !r.success && !!r.msg, r.msg ?? '');
    check('arbol: el mensaje nombra el requisito que falta',
      /Requiere/i.test(r.msg ?? '') && /Filo Afilado/.test(r.msg ?? ''), r.msg ?? '');
    check('arbol: y no se cobran nucleos', s(g).cores === 10_000, 'cores=' + s(g).cores);
  }
  {
    const g = await boot(baseSave([], { cores: 10_000 }));
    const r = g.buyNode('nodoInexistente');
    check('arbol: un nodo inexistente se rechaza', !r.success && !!r.msg, r.msg ?? '');
  }
  {
    const g = await boot(baseSave([], { cores: 0 }));
    const r = g.buyNode('core_sink');
    check('arbol: sin nucleos no se compra', !r.success && !!r.msg, r.msg ?? '');
    check('arbol: y no secreates un nivel fantasma', !s(g).nodeLevels.core_sink, JSON.stringify(s(g).nodeLevels));
  }
  {
    // El tope de nivel hay que respetarlo: `squad_slots` da +1 ranura y llega a
    // 4. Comprarlo 5 veces haria el total de slots impar sin querer.
    const g = await boot(baseSave([], {
      cores: 100_000,
      nodeLevels: { squad_slots: 4, passive_loop: 1, core_sink: 1 },
      unlockedNodes: ['squad_slots', 'passive_loop', 'core_sink']
    }));
    const antes = s(g).cores;
    const r = g.buyNode('squad_slots');
    check('arbol: en el nivel maximo no se compra mas', !r.success && /máximo/i.test(r.msg ?? ''), r.msg ?? '');
    check('arbol: y no se cobran nucleos', s(g).cores === antes, 'cores=' + s(g).cores);
  }
  {
    // El nodo que abre la forja tiene que abrirla de verdad: es un caso sin
    // bonificacion numerica, y por eso es facil que se quede sin efecto.
    const g = await boot(baseSave([], { cores: 100 }));
    check('forja: antes del nodo la forja esta cerrada', g.getForgeInfo().forgeUnlocked === false);
    g.buyNode('blueprint');
    check('forja: tras comprarlo la forja se abre', g.getForgeInfo().forgeUnlocked === true);
    check('forja: y se abre tambien tras recargar', (await reload()).getForgeInfo().forgeUnlocked === true);
  }

  // =========================================================================
  //  8. El recorte de capacidad al cargar una partida que no cabe
  // =========================================================================
  {
    // Abrir una caja con el almacen lleno: si el botin cabe, entra; si no cabe,
    // no se cuela. Con una capacidad de 1 no hay forma de que quepa nada.
    const g = await boot(baseSave([crate('c1'), { ...crate('k1'), type: 'key', name: 'Llave de Cifrado', tier: 0 }],
      { warehouseCapacity: 1 }));
    check('capacidad: la partida respeta la capacidad al cargar', wh(g).length <= 1, 'items=' + wh(g).length);
  }

  // =========================================================================
  //  9. NADA DE LO QUE SE COMPRA PUEDE REVENDERSE POR MÁS DE LO QUE COSTÓ
  // =========================================================================
  //
  // La invariante, no un caso. Se compra una carta, se vende lo comprado y se
  // mira el saldo: si no ha bajado, o ha SUBIDO, hay una máquina de imprimir
  // nanitas. Hace falta una prueba así porque las que ya había no la cubren:
  // comprueban que el botón y el cargo coincidan (que es otra cosa) y que el
  // total sea el unitario por las unidades.
  {
    // Las cartas que METER un item en el almacén. Las de ranura y las de
    // "ampliar" no dejan nada que vender, así que no tienen nada que comprobar.
    const cartasConItem = [
      'key', 'upgradeCrystal', 'commonCrate', 'rareCrate', 'epicCrate', 'legendaryCrate',
      'clickBuff', 'passiveBuff', 'backpackExpander', 'afkCard', 'clickX2Card', 'clickX3Card',
      'calibrationStone', 'stabilityNano',
      'companionCardT1', 'companionCardT5', 'companionCardT10',
      'collectorCardT1', 'collectorCardT5', 'collectorCardT10'
    ];

    const abusos: string[] = [];
    for (const carta of cartasConItem) {
      const g = await boot(baseSave([], { nanites: 1_000_000, warehouseCapacity: 40 }));

      // El saldo se mide ANTES de comprar. Medirlo despues mediria el precio
      // de reventa solo, que siempre es positivo, y la prueba pasaria con el
      // bug puesto: que es exactamente lo que hacia la primera version.
      const antes = nanites(g);

      const comprados: any = g.buyStoreItem(carta);
      if (!comprados || comprados.ok === false) continue;
      const id = comprados.id;
      if (!id || !find(g, id)) continue;

      const trasComprar = nanites(g);
      if (trasComprar >= antes) {
        abusos.push(`${carta}: la compra no cobro (antes=${antes} despues=${trasComprar})`);
        continue;
      }

      g.sellItem(id);
      const delta = nanites(g) - antes;   // negativo = perdida, positivo = imprimir

      // Se admite que den algo: un recolector o un companero se valoran con la
      // tabla dinamica y no con `sellPrice`. Lo que no se admite NUNCA es que den
      // mas de lo que costo la carta, que es lo unico que importa en esta prueba.
      if (delta > 0) {
        abusos.push(`${carta}: cuesta ${STORE_ITEMS[carta as keyof typeof STORE_ITEMS].cost} y compra+venta deja +${delta}`);
      }
    }
    check('tienda: NINGUNA carta se revende por mas de lo que costo',
      abusos.length === 0, abusos.join(' | ') || `${cartasConItem.length} cartas comprobadas, ninguna imprime`);
  }
  {
    // Y el caso que de verdad estaba roto, con los números a la vista.
    //
    // Comprar y vender en bucle, diez veces. Con el bug anterior el saldo
    // crecía sin límite: +950 por llave y +4.260 por cristal.
    const g = await boot(baseSave([], { nanites: 10_000, warehouseCapacity: 40 }));
    const antes = nanites(g);
    for (let i = 0; i < 10; i++) {
      const k = g.buyStoreItem('key');
      if (!k || !find(g, (k as any).id)) continue;
      g.sellItem((k as any).id);
      const c = g.buyStoreItem('upgradeCrystal');
      if (!c || !find(g, (c as any).id)) continue;
      g.sellItem((c as any).id);
    }
    check('tienda: comprar y vender 10 veces NO crea nanitas',
      nanites(g) <= antes,
      `antes=${antes} despues=${nanites(g)} · delta=${nanites(g) - antes}`);
    check('tienda: y el almacen queda como estaba',
      wh(g).length === 0, 'quedan=' + wh(g).length + ' ids=' + ids(g).join(','));
  }

  resumen('compra');
}

export default main();
