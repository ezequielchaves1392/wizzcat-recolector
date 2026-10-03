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
// Para las ranuras: el número que da cada carta sale de esta tabla, no de un 4
// escrito aquí. Con el modelo viejo de dos cartas, el 5 estaba en el motor, en el
// texto de la tarjeta y en estas dos aserciones.
import { COMPANION_SLOT_BUY, RANURA_POR_CARTA } from '../src/data/store';
// Cuántas unidades de cristal entrega una carta. El número lo pone esta función y
// no el banco: si el valor del recurso cambia, estas comprobaciones lo siguen sin
// tocarse.
import { valorDeUnCristal } from '../src/data/crafting';
import {
  boot, reload, check, resumen, s, wh, ids, nanites, deType, find, ranuras, baseSave, crate, consumable, distintos
} from './kit';

async function main() {
  // =========================================================================
  //  1. Compra simple: cobra lo justo y entrega el item
  // =========================================================================
  {
    const g = await boot(baseSave([], { nanites: 10_000 }));
    const antes = nanites(g);
    // `crateT1` y no una carta de llave: ya no hay ninguna. La compra simple se
    // mide con la caja, que es el único producto de tienda que ocupa pila y en
    // lote, y con el que se comprueba el contador derivado que antes se medía
    // sobre las llaves.
    const item = g.buyStoreItem('crateT1');

    check('tienda: devuelve el item comprado', !!item && item.type === 'crate', JSON.stringify(item?.id));
    check('tienda: cobra el precio de carta', nanites(g) === antes - STORE_ITEMS.crateT1.cost,
      `cobrado=${antes - nanites(g)} precio=${STORE_ITEMS.crateT1.cost}`);
    check('tienda: la caja entra en el almacen', deType(g, 'crate') === 1, ids(g).join(','));
    check('tienda: el contador derivado sube a 1', s(g).crates[1] === 1, 't1=' + s(g).crates[1]);
    check('tienda: el item devuelto es el que esta en el almacen', !!item?.id && !!find(g, item.id));

    const g2 = await reload();
    check('tienda: la compra sobrevive a la recarga', deType(g2, 'crate') === 1 && s(g2).crates[1] === 1,
      `items=${deType(g2, 'crate')} t1=${s(g2).crates[1]}`);
  }

  // =========================================================================
  //  2. Cada categoria de la tienda, una por una
  //
  //     El fallo tipico es que una rama del `if/else` de `buyStoreItem` se quede
  //     sin cubrir: se cobra y no se entrega. Por eso se recorre la lista
  //     completa en vez de unos pocos casos representativos.
  // =========================================================================
  //  2. Cada carta de la tienda, una por una
  //
  //     El fallo típico es que una rama del `if/else` de `buyStoreItem` se quede
  //     sin cubrir: se cobra y no se entrega. Por eso se recorre la lista
  //     COMPLETA en vez de unos pocos casos representativos.
  //
  //     F31 · Y la lista completa es `STORE_ITEMS`, no una escrita aquí.
  //
  //     Antes eran veinte filas a mano con veinte precios dentro —una segunda
  //     copia de la tabla— y veinte cartas de tier que F31 acaba de retirar de la
  //     tienda. Recorrer la tabla real es lo que hace que el banco no pueda
  //     quedarse probando lo que ya no se vende, ni se le pase una carta nueva sin
  //     probarla.
  //
  //     Se quitan las cartas de ranura de compañero: son permisos, no objetos, y
  //     no dejan nada que vender. El filtro sale de `RANURA_POR_CARTA`, la misma
  //     tabla que usa el motor, así que una ranura nueva no hay que añadirla a
  //     ninguna lista de este fichero.
  //
  //     Y el TIPO y el NOMBRE sale del item que devuelve la propia compra, no de
  //     una cuarta copia: si el motor entregara otra cosa, la prueba lo vería.
  // =========================================================================
  const cartas = (Object.keys(STORE_ITEMS) as (keyof typeof STORE_ITEMS)[])
    .filter(k => !RANURA_POR_CARTA[k as string]) as string[];

  // El precio de la caja, leído de la tabla. El mismo número estaba escrito a mano
  // en cuatro aserciones y en un titular ("1000/250 = 4"), y cuando la curva de
  // balance se rehizo estas pruebas fallaron sin que hubiera ningún bug: el test
  // tenía su propia copia de la tabla de precios. Y la caja T1 dejó de costar 250
  // al quitarse la llave, porque ahora vale el par entero.
  const UNIT_CAJA = (STORE_ITEMS as Record<string, { cost: number }>).crateT1.cost;

  // POR QUÉ EL COSTE SE LEE DE `STORE_ITEMS` Y NO SE ESCRIBE AQUÍ. Estaba en la
  // lista, a mano en cada fila, y cuando la curva de balance se rehizo estas
  // pruebas fallaron sin que hubiera ningún bug: el test tenía su propia copia de
  // la tabla de precios. Y la cartera se siembra por ENCIMA del precio más caro,
  // no con una cifra fija: con 200 000 justos la carta más cara se quedaba sin
  // margen y el fallo habría parecido de saldo en vez de de tabla.
  const masCaro = Math.max(...cartas.map(k => (STORE_ITEMS as Record<string, { cost: number }>)[k].cost));

  for (const carta of cartas) {
    const coste = (STORE_ITEMS as Record<string, { cost: number }>)[carta].cost;
    const g = await boot(baseSave([], { nanites: masCaro * 2 }));
    const antesN = wh(g).length;
    const antesNanites = nanites(g);
    const antesCristales = s(g).crystals;
    const item = g.buyStoreItem(carta as any);
    const tipo = String(item?.type ?? '');
    // **UNA CARTA DE ESTE BANCO NO ES UN ITEM, Y POR ESO TIENE SU MITAD PROPIA.**
    // `upgradeCrystal` ya no crea nada en el almacén: suma unidades a
    // `state.crystals`. Si se comprobara con el mismo criterio que las demás,
    // fallaría por lo único que hace bien, que es no crear un item.
    const esRecurso = carta === 'upgradeCrystal';

    check(`tienda ${carta}: cobra ${coste}`, nanites(g) === antesNanites - coste,
      `cobrado=${antesNanites - nanites(g)}`);

    if (esRecurso) {
      check(`tienda ${carta}: no mete ningún item en el almacen`,
        wh(g).length === antesN && deType(g, 'crystal') === 0,
        `antes=${antesN} ahora=${wh(g).length}`);
      check(`tienda ${carta}: lo que entrega son unidades del recurso`,
        s(g).crystals === antesCristales + valorDeUnCristal(1),
        `crystals=${s(g).crystals} antes=${antesCristales}`);
      continue;
    }

    check(`tienda ${carta}: mete 1 item de tipo ${tipo}`,
      !!tipo && wh(g).length === antesN + 1 && deType(g, tipo) === 1,
      `antes=${antesN} ahora=${wh(g).length} tipo=${tipo} de ${tipo}=${deType(g, tipo)}`);
    // Un item recien comprado tiene que ser utilizable: si la compra entrega
    // algo que el juego no reconoce despues, es un callejon sin salida.
    check(`tienda ${carta}: el item comprado existe y trae id`,
      !!item?.id && !!find(g, item.id), JSON.stringify(item?.id));
  }

  // Los contadores derivados tienen que incluir lo recien comprado: son lo que
  // lee el arbol de pasivas y las pantallas de progreso.
  {
    const g = await boot(baseSave([], { nanites: 200_000 }));
    g.buyStoreItem('crateT1');
    g.buyStoreItem('crateT1');
    check('tienda: dos cajas dejan el contador de su nivel a 2', s(g).crates[1] === 2, 't1=' + s(g).crates[1]);
    const g2 = await reload();
    check('tienda: el contador de cajas no se duplica al recargar', s(g2).crates[1] === 2,
      't1=' + s(g2).crates[1]);
  }
  {
    const g = await boot(baseSave([], { nanites: 200_000 }));
    g.buyStoreItem('afkCard');
    check('tienda: la tarjeta AFK cuenta al comprarse', s(g).afkCards === 1, 'afkCards=' + s(g).afkCards);
    const g2 = await reload();
    check('tienda: y sigue contando tras recargar', s(g2).afkCards === 1, 'afkCards=' + s(g2).afkCards);
  }
  {
    // F31 · UN COMPAÑERO TIENE QUE EXISTIR EN LOS DOS SITIOS, Y YA NO SE COMPRA.
    //
    // El caso era "el compañero comprado". Con las veinte cartas de tier fuera de
    // la tienda no hay ningún compañero que comprar: sale de las cajas. El
    // invariante sigue siendo el mismo y ahora importa MÁS, porque una caja
    // entrega el item por un camino y la ficha por otro: si solo creara el item,
    // se podría equipar y no pagaría nada.
    //
    // Y es un caso no determinista a propósito: se abren muchas cajas T1 y se
    // comprueba que **los** compañeros que salgan cumplen el invariante. Un banco
    // con un solo compañero fijado no miraría nada.
    //
    // Y sin llave: la caja se abre sola, así que la partida de la prueba solo
    // necesita la caja. Antes llevaba también la llave que la abría.
    const g = await boot(baseSave([crate('c1', 1, 60)],
      { nanites: 200_000, warehouseCapacity: 200 }));

    let vistos = 0;
    let sinFicha = 0;
    let sinPasivo = 0;
    for (let i = 0; i < 60; i++) {
      const r: any = g.openCrateBox('c1');
      if (!r || r.ok === false) break;
      if (r.reward?.kind !== 'companion' || !r.reward?.item?.id) continue;
      vistos++;
      const id = r.reward.item.id;
      if (!s(g).companions.some((c: any) => c.id === id)) sinFicha++;
      if (g.equipCompanion(id) !== false && s(g).passiveIncome <= 0) sinPasivo++;
    }
    check('cajas: algún compañero salió de verdad en 60 cajas T1', vistos > 0, 'vistos=' + vistos);
    check('cajas: todo compañero de caja tiene ficha en state.companions',
      vistos > 0 && sinFicha === 0, `vistos=${vistos} sinFicha=${sinFicha}`);
    check('cajas: y equipado paga ingreso pasivo',
      vistos > 0 && sinPasivo === 0, `vistos=${vistos} sinPasivo=${sinPasivo}`);

    const g2 = await reload();
    check('cajas: los compañeros de caja sobreviven a la recarga',
      deType(g2, 'companion') >= 1 && s(g2).companions.length >= 1,
      `items=${deType(g2, 'companion')} fichas=${s(g2).companions.length}`);
  }

  // =========================================================================
  //  3. Sin nanitas no se compra, y no se cobra de mas
  // =========================================================================
  {
    const g = await boot(baseSave([], { nanites: 100 }));
    const antes = nanites(g);
    const r = g.buyStoreItem('stabilityNano');
    check('tienda: sin nanitas no se compra', r === false, String(r));
    check('tienda: y no se cobra nada', nanites(g) === antes, 'nanites=' + nanites(g));
    check('tienda: ni se entrega un item a medias', wh(g).length === 0, ids(g).join(','));
  }
  {
    // El borde: nanitas EXACTAMENTE iguales al precio. Si el `>=` esta al reves,
    // el jugador con la cantidad justa no puede comprar nunca.
    //
    // Y EL PRECIO SE LEE DE `STORE_ITEMS`, no se escribe aqui. Estaba puesto a
    // mano (60) y cuando el cristal paso a 200 esta prueba fallo sin que hubiera
    // ningun bug: el test tenia su propia copia del numero. Es la misma clase de
    // error que un comentario que describe un precio.
    const precioCristal = (STORE_ITEMS as Record<string, { cost: number }>).upgradeCrystal.cost;
    const g = await boot(baseSave([], { nanites: precioCristal }));
    // La carta del cristal es además la que NO crea un item, así que del saldo
    // justo se comprueban las dos mitades: que se cobra, y que lo que llega son
    // unidades del recurso en vez de una pila en el almacén.
    const antesCristales = s(g).crystals;
    const r = g.buyStoreItem('upgradeCrystal');
    check('tienda: con las nanitas justas SI se compra', r !== false, String(r));
    check('tienda: y deja la cartera a cero', nanites(g) === 0, 'nanites=' + nanites(g));
    check('tienda: la carta del cristal no deja ningún item en el almacen', wh(g).length === 0, ids(g).join(','));
    check('tienda: y deja el recurso con las unidades de la carta', s(g).crystals === antesCristales + valorDeUnCristal(1), `crystals=${s(g).crystals} antes=${antesCristales}`);
  }
  {
    const menos = (STORE_ITEMS as Record<string, { cost: number }>).upgradeCrystal.cost - 1;
    const g = await boot(baseSave([], { nanites: menos }));
    const r = g.buyStoreItem('upgradeCrystal');
    check('tienda: con una nanita menos NO se compra', r === false && nanites(g) === menos,
      'nanitas=' + nanites(g));
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
    g.buyStoreItem('crateT1');
    const esperado = Math.floor(STORE_ITEMS.crateT1.cost * (1 - descuento));
    check('descuento: el cobro aplica el descuento del arbol',
      nanites(g) === antes - esperado,
      `cobrado=${antes - nanites(g)} esperado=${esperado} sin=${STORE_ITEMS.crateT1.cost}`);
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
    const r = g.buyStoreItem('crateT1');
    check('descuento: con descuento enorme el item llega igual', r !== false && deType(g, 'crate') === 1,
      ids(g).join(','));
    const cobrado = antes - nanites(g);
    check('descuento: se cobra menos que el precio de carta, pero algo',
      cobrado > 0 && cobrado < STORE_ITEMS.crateT1.cost,
      `cobrado=${cobrado} de carta=${STORE_ITEMS.crateT1.cost}`);
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
    const r = g.buyStoreItem('crateT1');
    check('capacidad: con el almacen lleno no se compra un item', r === false, String(r));
    check('capacidad: y no se cobra', nanites(g) === antes, 'nanites=' + nanites(g));
    check('capacidad: el almacen sigue igual', ranuras(g) === 30, 'ranuras=' + ranuras(g));
  }
  {
    // La contra-prueba: dos cajas de DISTINTO tipo son dos celdas. Si dos
    // entradas cualesquiera se fundieran en una, el jugador no podria elegir con
    // cual abrir el cofre.
    const g = await boot(baseSave([crate('c1', 1, 20), crate('c2', 6, 10)],
      { nanites: 200_000, warehouseCapacity: 2 }));
    check('capacidad: dos cajas de distinto tipo son dos ranuras', ranuras(g) === 2,
      'ranuras=' + ranuras(g));
  }
  {
    // Y dos del MISMO tipo se funden en una sola ranura mientras quepan en el
    // tope de pila. Dos pilas de 40 son 80, que caben en una sola: una ranura.
    //
    // El motivo por el que este caso sigue teniendo contenido es que **la fusión
    // y el tope son la misma regla vista desde dos lados**: `countOccupiedSlots()`
    // cuenta `ceil(unidades / tope)` y `addToWarehouse()` abre la pila siguiente
    // cuando la anterior está llena. Si uno de los dos no supiera del tope, el
    // contador y la rejilla dirían cosas distintas.
    const g = await boot(baseSave([crate('c1', 1, 40), crate('c2', 1, 40)],
      { nanites: 200_000, warehouseCapacity: 4 }));
    check('capacidad: dos pilas de 40 se funden en una sola ranura',
      ranuras(g) === 1 && wh(g).length === 1,
      `ranuras=${ranuras(g)} items=${wh(g).length}`);
    check('capacidad: y las 80 unidades están todas ahí',
      wh(g)[0].stackCount === 80, `unidades=${wh(g)[0].stackCount}`);
  }
  {
    // Y por pasarse del tope, ya no caben. 60 + 60 son 120, que se reparten en 99 y
    // 21: **la fusión no puede quedarse sin tope**, porque si no el almacén
    // aceptaría una forma que el motor nunca produce.
    const g = await boot(baseSave([crate('c1', 1, 60), crate('c2', 1, 60)],
      { nanites: 200_000, warehouseCapacity: 4 }));
    check('capacidad: 120 cajas sí son dos pilas',
      ranuras(g) === 2 && wh(g).length === 2,
      `ranuras=${ranuras(g)} items=${wh(g).length}`);
    check('capacidad: y el reparto es 99 + 21',
      wh(g).map((w: any) => w.stackCount).sort((a: number, b: number) => b - a).join(',') === '99,21',
      wh(g).map((w: any) => `${w.id}:${w.stackCount}`).join(' '));
  }
  {
    // Y 150 cajas sí que son dos pilas, y la que se pasa del tope NO se fusiona con
    // la otra aunque se llamen igual. Aquí está el otro lado del tope.
    const g = await boot(baseSave([crate('c1', 1, 150)],
      { nanites: 200_000, warehouseCapacity: 4 }));
    check('capacidad: 150 cajas ya son dos pilas',
      ranuras(g) === 2 && wh(g).length === 2,
      `ranuras=${ranuras(g)} items=${wh(g).length} unidades=${(find(g, 'c1')?.stackCount ?? 0)}`);
    check('capacidad: y la pila grande no se come a la pequeña',
      wh(g).length === 2
        && wh(g).some((w: any) => w.stackCount === 99)
        && wh(g).some((w: any) => w.stackCount === 51),
      JSON.stringify(wh(g).map((w: any) => `${w.id}:${w.stackCount}`)));
  }
  {
    // El tipo SIN tope de pila ya no es la llave: es el consumible. Lo que se
    // comprueba es el mismo invariante —una pila enorme sigue siendo una ranura—
    // con el objeto que hoy lo cumple. La caja es justo lo contrario a propósito,
    // y por eso los dos casos se comprueban en bloques distintos.
    const g = await boot(baseSave([consumable('u1', 'afk', 150)],
      { nanites: 200_000, warehouseCapacity: 2 }));
    check('capacidad: 150 consumibles siguen siendo una sola ranura',
      ranuras(g) === 1 && (find(g, 'u1')?.stackCount ?? 0) === 150,
      `ranuras=${ranuras(g)} unidades=${find(g, 'u1')?.stackCount}`);
  }
  {
    // =====================================================================
    //  LA CAJA SE COMPRA EN LOTE
    // =====================================================================
    //
    // **ESTO ESTABA ROTO Y NO LANZABA NINGÚN ERROR.** La lista de "qué se compra
    // en lote" decía `itemKey.endsWith('Crate')`, que era el nombre de la carta
    // antes de F31. Con una caja por tier la carta se llama `crateT1`, así que la
    // condición dejó de cumplirse: el diálogo no pintaba cantidad, `getBulkMax`
    // devolvía 1, y comprar cinco cajas eran cinco viajes a la tienda. Un `if`
    // que ya no se cumple es el peor sitio para un cambio de nombre.
    //
    // Y el tope del lote lo manda **el espacio, no el saldo**. Con un tope de pila,
    // un almacén con la pila de cajas llena y una ranura libre admite **una caja
    // más**, no quinientas: si `getBulkMax` solo mirara el dinero, el diálogo
    // ofrecería 500 y el motor rechazaría con "Almacén lleno".
    const unit = STORE_ITEMS.crateT1.cost;
    const g = await boot(baseSave([], { nanites: unit * 300, warehouseCapacity: 30 }));
    check('lote caja: getBulkMax dice que sí se puede en lote',
      g.getBulkMax('crateT1') > 1, `max=${g.getBulkMax('crateT1')}`);
    // 250 para pasarse del tope de 99 y ver el reparto: es el caso que importa,
    // porque por debajo del tope todo entra en una pila y no se ve nada.
    const r = g.buyStoreItem('crateT1', 250) as any;
    const pilas = wh(g).filter((w: any) => w.type === 'crate');
    check('lote caja: comprar 250 de golpe mete las 250',
      !!r && pilas.reduce((a: number, w: any) => a + (w.stackCount || 1), 0) === 250,
      `${pilas.length} pilas: ${pilas.map((w: any) => w.stackCount).join('+')}`);
    check('lote caja: y en 99 + 99 + 52, por el tope de pila',
      pilas.length === 3 && pilas.map((w: any) => w.stackCount).sort((a: number, b: number) => b - a).join(',') === '99,99,52',
      `${pilas.map((w: any) => w.stackCount).join(',')}`);
    check('lote caja: y cobra 250 veces el unitario',
      nanites(g) === unit * 300 - unit * 250, `nanites=${nanites(g)}`);
    check('lote caja: y 250 ocupan tres ranuras, por el tope de 99',
      ranuras(g) === 3, `ranuras=${ranuras(g)} items=${ids(g).join(',')}`);
    check('lote caja: el diálogo enseña el mismo total que se cobra',
      g.getBulkCost('crateT1', 250) === unit * 250, `bulk=${g.getBulkCost('crateT1', 250)}`);
  }
  {
    // Y el tope lo manda el ESPACIO cuando el almacén se queda corto, que es el
    // caso que antes habría mostrado 500 cajas y rechazado la compra.
    const unit = STORE_ITEMS.crateT1.cost;
    // 4 ranuras y ya hay una pila LLENA de 99: quedan 3 pilas libres de 99, o
    // sea 297 cajas más. Comprarlas tiene que funcionar y llenar las tres.
    const g = await boot(baseSave([crate('c1', 1, 99)], { nanites: unit * 1000, warehouseCapacity: 4 }));
    const max = g.getBulkMax('crateT1');
    check('lote caja: con 4 ranuras y una pila llena el tope son 297 cajas, no "el dinero que hay"',
      max === 297, `max=${max} (3 pilas libres x 99; con el dinero alcanza para 1000)`);
    const r = g.buyStoreItem('crateT1', max) as any;
    check('lote caja: y comprar ese tope funciona de verdad',
      r !== false && ranuras(g) === 4, `ranuras=${ranuras(g)}`);
  }
  {
    // F27 · La ampliación YA no es un permiso: el expansor es un item y ocupa
    // ranura (las ranuras de compañero sí siguen siendo permisos). Con el
    // almacén lleno y sin pila a la que sumarse, se rechaza sin cobrar.
    const g = await boot(baseSave(distintos(30), { nanites: 200_000 }));
    const capAntes = s(g).warehouseCapacity;
    const antes = nanites(g);
    const r = g.buyStoreItem('expansorT1');
    check('capacidad: el expansor sin hueco ni pila se rechaza', r === false, String(r));
    check('capacidad: y no se cobra', nanites(g) === antes, 'nanites=' + nanites(g));
    check('capacidad: y la capacidad no se mueve', s(g).warehouseCapacity === capAntes,
      `${capAntes} -> ${s(g).warehouseCapacity}`);
  }
  {
    // ...pero con pila se funde con ella aunque esté lleno, como las cajas.
    // La pila del expansor no existe aún: se crea la primera comprando con
    // hueco, y el lote siguiente tiene que fundirse sin abrir ranura.
    const g2 = await boot(baseSave([], { nanites: 200_000, warehouseCapacity: 30 }));
    const e1 = g2.buyStoreItem('expansorT1') as any;
    check('capacidad: el primer expansor abre su pila',
      !!e1 && find(g2, e1.id)?.stackCount === 1, `pila=${e1 && find(g2, e1.id)?.stackCount}`);
    const e2 = g2.buyStoreItem('expansorT1', 4) as any;
    check('capacidad: el lote se suma a la pila, no abre otra',
      !!e2 && find(g2, e1.id)?.stackCount === 5 && ranuras(g2) === 1,
      `pila=${e1 && find(g2, e1.id)?.stackCount} ranuras=${ranuras(g2)}`);
  }
  {
    // Un item apilable puede NO necesitar ranura nueva: si ya hay una pila de su
    // tipo, la compra se suma a ella aunque el almacen este lleno. Preguntar solo
    // "¿quedan ranuras libres?" rechazaba la compra y hacia perder las nanitas por
    // un item que no ocupaba ni una ranura.
    const g = await boot(baseSave([crate('c1', 1, 5)], { nanites: 200_000, warehouseCapacity: 1 }));
    check('capacidad: una ranura y una pila de cajas = almacen lleno', ranuras(g) === 1,
      'ranuras=' + ranuras(g) + '/' + g.getCapacity());
    const antes = nanites(g);
    const r = g.buyStoreItem('crateT1');
    check('capacidad: con el almacen lleno, una caja que cabe en la pila SI se compra',
      r !== false, String(r));
    check('capacidad: se suma a la pila sin abrir ranura nueva',
      ranuras(g) === 1 && find(g, 'c1')?.stackCount === 6,
      'ranuras=' + ranuras(g) + ' unidades=' + find(g, 'c1')?.stackCount);
    check('capacidad: y se paga una sola vez', nanites(g) === antes - STORE_ITEMS.crateT1.cost,
      'nanites=' + nanites(g));
  }
  {
    // F31 · ESTE CASO YA NO TIENE CARTA, Y EL INVARIANTE SE MIDE ENTERO.
    //
    // Antes: "una caja de otro tipo necesita ranura nueva y con el almacén lleno
    // se rechaza". Ya no hay dos cajas en la tienda, así que el caso concreto no
    // se puede construir. Lo que queda —y es lo que de verdad importa— es que
    // **con el almacén lleno no entra nada nuevo**: lo único que puede pasar es
    // que una compra se funda en una pila que ya existe.
    //
    // Se compran TODAS las cartas con una sola ranura y se mira que las ranuras
    // nunca pasen de una. Con cuatro cajas y veinte cartas de tier, este caso se
    // podía escribir con dos compras; ahora son veinte compras y ninguna puede
    // colarse, que es justo lo que no se podía comprobar antes.
    const g = await boot(baseSave([crate('c1', 1, 5)], { nanites: 5_000_000, warehouseCapacity: 1 }));
    const coladas: string[] = [];
    for (const carta of cartas) {
      const antesRuns = ranuras(g);
      g.buyStoreItem(carta as any);
      if (ranuras(g) > 1) coladas.push(`${carta} (ranuras ${antesRuns}->${ranuras(g)})`);
    }
    check('capacidad: con una sola ranura, ninguna carta cuela un item nuevo',
      coladas.length === 0, coladas.join(' | ') || `${cartas.length} cartas probadas`);
    check('capacidad: y la pila de cajas solo ha crecido',
      (find(g, 'c1')?.stackCount ?? 0) >= 5, 'unidades=' + find(g, 'c1')?.stackCount);
  }
  {
    // Un hueco justo: entra el que cabe y se rechaza el siguiente.
    //
    // F31 · Antes eran dos cajas DISTINTAS: la segunda necesitaba ranura nueva y
    // con el almacén lleno se rechazaba. Ahora solo se vende una caja, y dos cajas
    // iguales se funden en una pila —que sí entra—, así que el caso se mide con
    // un item de otra clase: el expansor sí necesita ranura propia.
    //
    // Y el cristal, que era lo que se ponía aquí, **ya no vale**: es un recurso y no
    // ocupa ranura, así que con el almacén lleno se compra igual. Eso no es un
    // detalle de esta prueba: es el bloque siguiente entero.
    const g = await boot(baseSave([], { nanites: 200_000, warehouseCapacity: 1 }));
    const r1 = g.buyStoreItem('crateT1');
    const r2 = g.buyStoreItem('expansorT1');
    check('capacidad: el primer item entra', r1 !== false);
    check('capacidad: el segundo se rechaza al llenarse', r2 === false && ranuras(g) === 1,
      'ranuras=' + ranuras(g));
    check('capacidad: y solo se cobro una vez', nanites(g) === 200_000 - STORE_ITEMS.crateT1.cost,
      'nanites=' + nanites(g));
  }
  {
    // EL CRISTAL, QUE NO NECESITA HUECO. El bloque de arriba comprueba que lo que
    // necesita ranura se rechaza con el almacén lleno; este comprueba lo
    // contrario, que es la mitad nueva de la regla.
    //
    // **POR QUÉ ESTA PRUEBA VALE MÁS QUE LA QUE SUSTITUYE.** El cristal era un item
    // y pedía hueco, así que un jugador con las cuatrocientas ranuras llenas no
    // podía comprar el material que necesita para subir de nivel: el almacén, que
    // es donde vive lo que ya tiene, le impedía comprar lo que le falta. Al ser un
    // recurso la pregunta de espacio desaparece, y esta es la prueba que lo ata.
    const g = await boot(baseSave(distintos(30), { nanites: 200_000 }));
    check('capacidad: el almacen de la prueba esta lleno', ranuras(g) === 30,
      `ranuras=${ranuras(g)}/${g.getCapacity()}`);
    const antes = nanites(g);
    const antesCristales = s(g).crystals;
    const r = g.buyStoreItem('upgradeCrystal');
    check('capacidad: el cristal se compra con el almacen lleno: no es un item', r !== false,
      String(r));
    check('capacidad: y no ocupa ni una ranura',
      ranuras(g) === 30 && wh(g).length === 30, `ranuras=${ranuras(g)} items=${wh(g).length}`);
    check('capacidad: lo que sube son las unidades del recurso',
      s(g).crystals === antesCristales + valorDeUnCristal(1),
      `crystals=${s(g).crystals} antes=${antesCristales}`);
    check('capacidad: y se cobra una sola vez',
      nanites(g) === antes - (STORE_ITEMS as Record<string, { cost: number }>).upgradeCrystal.cost,
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
    const comprados = ['crateT1', 'crateT1', 'crateT1'].filter((k) => g.buyStoreItem(k as any) !== false).length;
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
    // Comprar la segunda ranura sin la primera da los intermedios: la carta lleva
    // a 4, así que saltas del 1 al 4.
    //
    // Los números salen de `COMPANION_SLOT_BUY`, que es la tabla que el motor
    // escribe. Escribir el 4 aquí sería volver a tener el número en dos sitios, que
    // es exactamente lo que hacía el modelo viejo de dos cartas con el 5.
    const g = await boot(baseSave([], { nanites: 200_000, maxCompanionSlots: 1 }));
    const r = g.buyStoreItem('companionSlot2');
    check('permisos: la segunda ranura se compra', r !== false, String(r));
    check('permisos: y lleva los slots donde dice la tabla',
      s(g).maxCompanionSlots === COMPANION_SLOT_BUY[1].da,
      'slots=' + s(g).maxCompanionSlots + ' tabla=' + COMPANION_SLOT_BUY[1].da);
  }
  {
    // El guard de los permisos compara sobre el total EFECTIVO, no sobre la base
    // guardada. Con la base en 2 y +1 del arbol, el total efectivo es 3: comprar
    // la siguiente carta tiene que seguir siendo posible, o el slot del arbol
    // habria "bloqueado" la compra que le toca.
    const g = await boot(baseSave([], {
      nanites: 200_000, maxCompanionSlots: 2,
      nodeLevels: { squad_slots: 1, passive_loop: 1, core_sink: 1 },
      unlockedNodes: ['squad_slots', 'passive_loop', 'core_sink']
    }));
    check('permisos: el slot del arbol suma al total efectivo', g.getCompanionSlots() === 3,
      'slots=' + g.getCompanionSlots());
    const r = g.buyStoreItem('companionSlot2');
    check('permisos: con 3 slots efectivos se puede comprar la siguiente ranura',
      r !== false, String(r));
    check('permisos: y lleva los slots donde dice la tabla',
      s(g).maxCompanionSlots === COMPANION_SLOT_BUY[1].da,
      'slots=' + s(g).maxCompanionSlots + ' tabla=' + COMPANION_SLOT_BUY[1].da);
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
    // **EL NODO QUE ESTÁ EN LA RAÍZ DE LA RAMA DE CRAFTEO TIENE QUE DAR ALGO.**
    //
    // Aquí hubo tres comprobaciones que decían que sin el nodo `blueprint` la
    // forja estaba cerrada, y después de comprarlo se abría. Ya no hay puerta: la
    // forja está abierta desde el inicio. Se han ido con ella, porque **una prueba
    // que asegura una regla borrada es peor que no tenerla**: alguien la lee, la
    // ve pasar, y se queda creyendo que el requisito sigue ahí.
    //
    // Lo que se conserva es **el motivo de que este banco comprobara ese nodo**, que
    // es bueno: es el único de la rama sin bonificación numérica, y un nodo sin
    // efecto es un nodo por el que el jugador paga 4 núcleos y no ve nada. Ahora da
    // `craftLuck`, así que lo que se comprueba es que **suba la probabilidad** y que
    // **eso sobreviva a recargar**. Si algún día el nodo vuelve a ser una puerta
    // vacía, esta es la prueba que lo canta.
    const g = await boot(baseSave([], { cores: 100 }));
    const antes = g.getForgeInfo().craftLuck;
    const r = g.buyNode('blueprint');
    const despues = g.getForgeInfo().craftLuck;
    check('arbol: el nodo de la forja sube la probabilidad, no es decorativo',
      r.success && Math.abs((despues - antes) - 0.03) < 1e-9,
      `success=${r.success} antes=${antes} despues=${despues} msg=${r.msg ?? ''}`);
    check('arbol: y el efecto sigue ahí tras recargar',
      Math.abs((await reload()).getForgeInfo().craftLuck - despues) < 1e-9,
      `recargado=${(await reload()).getForgeInfo().craftLuck}`);
  }

  // =========================================================================
  //  8. El recorte de capacidad al cargar una partida que no cabe
  // =========================================================================
  {
    // Abrir una caja con el almacen lleno: si el botin cabe, entra; si no cabe,
    // no se cuela. Con una capacidad de 1 no hay forma de que quepa nada.
    // El segundo item es un consumible: la llave que ponía aquí ya no existe —al
    // cargar una partida vieja se redime y desaparece— y el cristal ya no es un
    // item, así que ni siquiera se puede meter en el guardado de una partida.
    const g = await boot(baseSave([crate('c1'), consumable('x1', 'afk')],
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
    // F31 · LA LISTA DE CARTAS ES LA DE `STORE_ITEMS`, NO UNA ESCRITA AQUÍ.
    //
    // Estaba escrita a mano y con veinte cartas de tier dentro, que ya no se
    // venden. Una lista escrita a mano es una lista que se desincroniza: cuando
    // se añadió la novena llave nadie se acordó de añadirla aquí, así que el
    // abuso de la novena —si lo hubiera— no lo habría visto nadie. Se recorre
    // `STORE_ITEMS` y se quitan las cartas de ranura, que no meten nada en el
    // almacén y por eso no tienen reventa que comprobar.
    //
    // **Y LA DEL CRISTAL SE QUITA POR UNA RAZÓN NUEVA, Y POR ESO DICE SU NOMBRE.**
    // Antes la recorría y la compraba, pero devuelven un recurso: no hay item que
    // vender y su valor es de uso, no de reventa. Sin este filtro, el `continue`
    // de "no hay id" la saltaría en silencio y el banco habría dado por comprobado
    // algo que no ha mirado.
    const cartasConItem = (Object.keys(STORE_ITEMS) as (keyof typeof STORE_ITEMS)[])
      .filter(k => !RANURA_POR_CARTA[k as string] && k !== 'upgradeCrystal');

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
        abusos.push(`${carta}: cuesta ${STORE_ITEMS[carta].cost} y compra+venta deja +${delta}`);
      }
    }
    check('tienda: NINGUNA carta se revende por mas de lo que costo',
      abusos.length === 0, abusos.join(' | ') || `${cartasConItem.length} cartas comprobadas, ninguna imprime`);
  }
  {
    // Y el caso que de verdad estaba roto, con los números a la vista.
    //
    // Comprar y vender en bucle, diez veces. Con el bug anterior el saldo
    // crecía sin límite: +4.260 por cristal era el más gordo.
    //
    // El cristal sale del bucle porque **ya no hay nada que vender**: la compra
    // devuelve unidades de un recurso y no hay item detrás. El segundo producto es
    // la tarjeta de click x2, que sí deja un item en el almacén y se vende por un
    // cuarto de lo que costó.
    const g = await boot(baseSave([], { nanites: 1_000_000, warehouseCapacity: 40 }));
    const antes = nanites(g);
    for (let i = 0; i < 10; i++) {
      for (const carta of ['crateT1', 'clickX2Card']) {
        const comprado: any = g.buyStoreItem(carta as any);
        if (!comprado || !find(g, comprado.id)) continue;
        g.sellItem(comprado.id);
      }
    }
    check('tienda: comprar y vender 10 veces NO crea nanitas',
      nanites(g) <= antes,
      `antes=${antes} despues=${nanites(g)} · delta=${nanites(g) - antes}`);
    check('tienda: y el almacen queda como estaba',
      wh(g).length === 0, 'quedan=' + wh(g).length + ' ids=' + ids(g).join(','));
  }
  {
    // F14: COMPRAR POR CANTIDAD. El lote cobra N veces el unitario —lo mismo
    // que N compras de una— y entrega las N de una vez, en la pila que haya.
    //
    // La caja T1 vale lo que diga la tabla, y el banco no lo escribe: si el precio
    // redondeo que discutir, y la cuenta es exacta a propósito.
    const g = await boot(baseSave([], { nanites: 10_000 }));
    const r = g.buyStoreItem('crateT1', 10);
    check('lote: comprar 10 cobra 10 veces el unitario',
      r !== false && nanites(g) === 10_000 - UNIT_CAJA * 10,
      `nanites=${nanites(g)}`);
    check('lote: y llegan las 10 a una sola pila',
      !!r && find(g, (r as any).id)?.stackCount === 10,
      `pila=${!!r && find(g, (r as any).id)?.stackCount}`);
    check('lote: y ocupan una sola ranura',
      ranuras(g) === 1, 'ranuras=' + ranuras(g));
    check('lote: el total que enseña el diálogo es el que se cobra',
      g.getBulkCost('crateT1', 10) === UNIT_CAJA * 10,
      `bulk=${g.getBulkCost('crateT1', 10)}`);
    const g2 = await reload();
    check('lote: el lote sobrevive a la recarga',
      nanites(g2) === 10_000 - UNIT_CAJA * 10,
      `nanites=${nanites(g2)}`);
  }
  {
    // Con pila previa se funde con ella: 3 que había + 7 que llegan.
    const g = await boot(baseSave([], { nanites: 10_000 }));
    g.buyStoreItem('crateT1', 3);
    const pila = wh(g).find((w: any) => w.type === 'crate');
    g.buyStoreItem('crateT1', 7);
    check('lote: el segundo lote se suma a la pila, no abre otra',
      pila && find(g, pila.id)?.stackCount === 10 && ranuras(g) === 1,
      `pila=${pila && find(g, pila.id)?.stackCount} ranuras=${ranuras(g)}`);
    check('lote: y se cobraron las 10 en total',
      nanites(g) === 10_000 - UNIT_CAJA * 10, `nanites=${nanites(g)}`);
  }
  {
    // Sin nanitas para el total no hay compra parcial: o las N o ninguna, y
    // sin cobrar. Un lote a medias sería una pila pagada sin precio cerrado.
    const g = await boot(baseSave([], { nanites: 1_000 }));
    const r = g.buyStoreItem('crateT1', 10);
    check('lote: sin saldo para el total se rechaza entero',
      r === false && nanites(g) === 1_000 && wh(g).length === 0,
      `ok=${r} nanites=${nanites(g)} items=${wh(g).length}`);
  }
  {
    // Cantidad no válida: 0, negativos y NaN no cobran nada. Y en lo no
    // apilable el número ni se mira: una ranura de escuadrón siempre es una.
    //
    // F31 · Antes esta aserción usaba una carta de llave. Se mide con la caja,
    // que sigue siendo la otra clase de "vale una vez" entre las que se compran
    // en lote.
    const g = await boot(baseSave([], { nanites: 10_000, maxCompanionSlots: 1 }));
    const antes = nanites(g);
    check('lote: 0 se rechaza sin cobrar',
      g.buyStoreItem('crateT1', 0) === false && nanites(g) === antes,
      `nanites=${nanites(g)}`);
    check('lote: un negativo se rechaza sin cobrar',
      g.buyStoreItem('crateT1', -5) === false && nanites(g) === antes,
      `nanites=${nanites(g)}`);
    check('lote: NaN se rechaza sin cobrar',
      g.buyStoreItem('crateT1', NaN) === false && nanites(g) === antes,
      `nanites=${nanites(g)}`);
    // Ya no hay carta de tier que comprar, así que el caso "no apilable" se
    // mide con la ranura, que también vale una sola vez. Con una ranura ya
    // comprada la segunda se rechaza, así que la partida arranca con una.
    const t = g.buyStoreItem('companionSlot2', 10);
    check('lote: una carta de ranura con 10 sigue siendo una sola compra',
      t !== false && nanites(g) === antes - g.getStoreUnitCost('companionSlot2'),
      `nanites=${nanites(g)} unitario=${g.getStoreUnitCost('companionSlot2')}`);
  }
  {
    // El tope del diálogo sale del motor: lo que alcanza con el saldo.
    // El saldo se pone para que quepan varias unidades y el tope sea el del
    // dinero: con 1 000 y una caja de 675 el tope sería 1 y no miraría nada.
    const g = await boot(baseSave([], { nanites: 5_000 }));
    check('lote: el tope es lo que alcanza con el saldo',
      g.getBulkMax('crateT1') === Math.floor(5_000 / UNIT_CAJA), `max=${g.getBulkMax('crateT1')}`);
    check('lote: lo no apilable no tiene tope que preguntar',
      g.getBulkMax('companionSlot1') === 1, `max=${g.getBulkMax('companionSlot1')}`);
  }

  resumen('compra');
}

export default main();
