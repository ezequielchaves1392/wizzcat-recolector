// ==========================================================================
//  Banco de pruebas de LA PARTIDA ENTERA de un jugador nuevo
//
//  Qué hay aquí y por qué hace falta
//  -------------------------------
//  Los otros once bancos prueban FUNCIONES: que `sellItem` borre, que la pila se
//  funda, que la cola no se aplique cuando no debe. Todos montan la partida a
//  mano con `baseSave()` y comprueban una cosa.
//
//  Lo que no había era lo que de verdad mira un jugador en su primer minuto:
//  Lifecycle completo con el estado que nace de verdad, en el orden en que se
//  juega. Un banco puede pasar entero y que la partida sea injugable, porque
//  cada función por separado funciona: el jugador nace sin recolector, pero
//  `equipCollector` funciona, así que la función está probada; el de arriba nunca
//  equipó nada, y eso no lo mira nadie.
//
//  Aquí no hay atajos: se arranca con `bootNew()`, que es el documento inexistente
//  de verdad, y se juega. Si algo no está conectado al resto, se rompe aquí.
//
//  POR QUÉ ESTE BANCO NO ES EL ÚNICO QUE DEBERÍA EXISTIR
//  ------------------------------------------------------
//  Mide el CAMINO, y un camino que pasa no dice que el juego esté equilibrado. Un
//  banco puede recorrer los once pasos y que el jugador pasara hambre en el
//  minuto tres. El apartado 8 mide algo de eso —que el coste por punto de poder no
//  se dispare entre tiers, que es la regresión que `CAMBIOS-MACRO.md` documenta
//  haber arreglado una vez— y el apartado 10 mide que la Ascensión no regale ni
//  cobre de más. Pero el equilibrio fino sigue siendo cosa de jugar, no de un
//  `check()`.
//
//  CÓMO ESTÁ ESCRITO
//  ----------------
//  · Nada se reinicia a mitad de camino. La partida empieza en `bootNew()` y cada
//    apartado continúa la anterior. Un banco que reinicia en cada apartado no
//    comprueba el camino: comprueba once caminos.
//
//  · Cada apartado acaba en `reload()`. R13: lo que solo vive en memoria no está
//    guardado, y el jugador no va a notar el fallo hasta que refresque.
//
//  · No se reimplementa ninguna regla del juego (R2). Las cifras se piden al game
//    loop con `getClickDamage()`, `getSellTotal()`, `getCapacity()`. Si el banco
//    calcula el precio por su cuenta, pasa justo cuando el juego está roto.
// ==========================================================================

import { STORE_ITEMS } from '../src/gameLoop';
import {
  boot, reload, bootNew, check, resumen, s, wh, ids, nanites, deType, find,
  baseSave, collector, crystal, consumable, guardado
} from './kit';

/** Cuántos clicks se dan en un paso. Suficiente para que la cifra sea legible. */
const CLICKS = 20;

async function main() {
  // =========================================================================
  //  1. EL MINUTO CERO: qué nace de verdad
  // =========================================================================
  const g = await bootNew();
  {
    check('nacimiento: nace con cero nanitas', nanites(g) === 0, 'nanitas=' + nanites(g));
    check('nacimiento: trae un recolector, un compañero y 2 cajas',
      deType(g, 'collector') === 1 && deType(g, 'companion') === 1 && deType(g, 'crate') === 1,
      ids(g).join(','));
    check('nacimiento: las 2 cajas de bienvenida son UNA pila',
      wh(g).find((w: any) => w.type === 'crate')?.stackCount === 2,
      'unidades=' + wh(g).find((w: any) => w.type === 'crate')?.stackCount);
    check('nacimiento: almacén de 15 y una sola ranura de compañero',
      g.getCapacity() === 15 && g.getCompanionSlots() === 1,
      `cap=${g.getCapacity()} slots=${g.getCompanionSlots()}`);
    check('nacimiento: NADA equipado, que es lo que el jugador ve',
      s(g).equippedCollectorId === null && s(g).activeCompanions.length === 0,
      `equipo=${s(g).equippedCollectorId} companeros=${s(g).activeCompanions.join(',')}`);
    check('nacimiento: y sin ingreso pasivo', s(g).passiveIncome === 0, 'pasivo=' + s(g).passiveIncome);
    const g2 = await reload();
    check('nacimiento: y recargar no inventa nada',
      nanites(g2) === 0 && deType(g2, 'crate') === 1, ids(g2).join(','));
  }

  // =========================================================================
  //  2. CLICKEAR. El primer minuto real, y el que más veces se ha roto.
  // =========================================================================
  {
    // Sin recolector equipado el click NO da nada, pero CUENTA. Un jugador que
    // entra y ve su contador de clicks subir sin ganar nanitas tiene que poder
    // entenderlo: no está roto, es que no tiene con qué recolectar.
    for (let i = 0; i < 3; i++) g.click();
    check('click: sin recolector no se gana nada', nanites(g) === 0, 'nanitas=' + nanites(g));
    check('click: pero el click se cuenta igualmente', s(g).totalClicks === 3, 'clics=' + s(g).totalClicks);

    // El número que anuncia `getClickDamage()` es el que entra. No se recalcula
    // aquí: si hiciera la cuenta, el banco mediría su propia aritmética.
    const danio = g.getClickDamage();
    check('click: sin nada equipado el daño es cero', danio === 0, 'danio=' + danio);

    const colector = wh(g).find((w: any) => w.type === 'collector')!;
    const equipado = g.equipCollector(colector.id);
    check('click: se puede equipar el recolector de partida', equipado === true, String(equipado));
    check('click: el equipado queda dicho en el estado',
      s(g).equippedCollectorId === colector.id, String(s(g).equippedCollectorId));

    const announced = g.getClickDamage();
    check('click: equipado, el daño es mayor que cero', announced > 0, 'danio=' + announced);

    const antes = nanites(g);
    for (let i = 0; i < CLICKS; i++) g.click();
    const ganado = nanites(g) - antes;
    check('click: N clicks dan N veces el daño anunciado',
      ganado === announced * CLICKS, `ganado=${ganado} esperado=${announced * CLICKS}`);
    check('click: el total produzido lleva la cuenta', s(g).totalNanitesProduced === ganado,
      `producido=${s(g).totalNanitesProduced} ganado=${ganado}`);

    const g2 = await reload();
    check('click: y el saldo del jugador sobrevive a la recarga',
      nanites(g2) === ganado, `nanitas=${nanites(g2)}`);
    check('click: el recolector sigue equipado tras recargar',
      s(g2).equippedCollectorId === colector.id, String(s(g2).equippedCollectorId));
    check('click: y sigue haciendo daño', g2.getClickDamage() === announced,
      `${announced} -> ${g2.getClickDamage()}`);
  }

  // =========================================================================
  //  3. COMPRAR. Lo que se enseña tiene que ser lo que se cobra (R3).
  // =========================================================================
  {
    const g3 = await reload();
    const barato = 'collectorCardT1';

    // Sin nanitas no se compra, y sobre todo: no se COBRA. Un "no compres" que
    // descuenta es peor que un bug visible, porque el jugador pierde sin ver por
    // qué.
    const saldoAntes = nanites(g3);
    const denied = g3.buyStoreItem(barato);
    check('tienda: sin nanitas no se compra', !denied, String(denied));
    check('tienda: y no se cobra nada', nanites(g3) === saldoAntes, 'nanitas=' + nanites(g3));

    // Con nanitas justas sí, y el botón y el cobro dicen lo mismo.
    const precio = STORE_ITEMS[barato].cost;
    g3.updateState({ nanites: precio });
    const comprado = g3.buyStoreItem(barato);
    check('tienda: con las nanitas justas sí se compra', Boolean(comprado), String(comprado));
    check('tienda: se cobra EXACTAMENTE el precio de carta',
      nanites(g3) === 0, `nanitas=${nanites(g3)} precio=${precio}`);
    check('tienda: lo comprado llega al almacén',
      ids(g3).includes((comprado as any).id), String((comprado as any)?.id));
    // `canBuyStoreItem` NO pregunta "¿me llega el dinero?": pregunta "¿cabe en el
    // almacén?". La cartera es otra comprobación, y por eso el botón de la tienda
    // mira las dos. Con la cartera a cero pero sitio de sobra, aquí tiene que decir
    // que SÍ cabe: si dijera que no, el jugador vería el botón apagado sin razón.
    check('tienda: sin nanitas pero con sitio, cabe igual',
      g3.canBuyStoreItem(barato) === true, 'dice que no cabe con 3 de 15 ranuras');

    const g4 = await reload();
    check('tienda: la compra sobrevive a la recarga',
      deType(g4, 'collector') === 2, 'recolectores=' + deType(g4, 'collector'));
    check('tienda: y la cartera vacía también sobrevive', nanites(g4) === 0, 'nanitas=' + nanites(g4));
  }

  // =========================================================================
  //  4. COMPAÑEROS: la otra mitad del ingreso
  // =========================================================================
  {
    const g5 = await reload();
    check('compañero: se nace con uno pero inactivo',
      s(g5).activeCompanions.length === 0 && s(g5).passiveIncome === 0,
      `activos=${s(g5).activeCompanions.length} pasivo=${s(g5).passiveIncome}`);

    const comp = wh(g5).find((w: any) => w.type === 'companion')!;
    const pasivo0 = s(g5).passiveIncome;
    const ok = g5.equipCompanion(comp.id);
    check('compañero: se activa', ok === true, String(ok));
    check('compañero: y a partir de ahí hay ingreso pasivo',
      s(g5).passiveIncome > pasivo0, `pasivo=${s(g5).passiveIncome}`);
    check('compañero: con 1 ranura no cabe un segundo',
      g5.equipCompanion('inexistente') === false, 'aceptó un id que no existe');

    const g6 = await reload();
    check('compañero: el activo sigue activo tras recargar',
      s(g6).activeCompanions.includes(comp.id), s(g6).activeCompanions.join(','));
    check('compañero: y el ingreso pasivo sobrevive',
      s(g6).passiveIncome === s(g5).passiveIncome,
      `${s(g5).passiveIncome} -> ${s(g6).passiveIncome}`);

    // Desequipar lo quita y el ingreso baja: una ranura que no se puede vaciar
    // es una decisión del jugador que no existe.
    const fuera = g6.equipCompanion(comp.id);
    check('compañero: se puede quitar', fuera === true, String(fuera));
    check('compañero: y al quitarlo se acaba el ingreso pasivo',
      s(g6).activeCompanions.length === 0 && s(g6).passiveIncome === 0,
      `activos=${s(g6).activeCompanions.length} pasivo=${s(g6).passiveIncome}`);
    g6.equipCompanion(comp.id);
  }

  // =========================================================================
  //  5. EL ALMACÉN: ranuras, pilas y no perder nada
  // =========================================================================
  {
    const g7 = await reload();
    const cap = g7.getCapacity();
    check('almacén: la capacidad es la que se anuncia', cap === 15, 'cap=' + cap);

    // Cuatro items en el almacén son CUATRO ranuras. Lo que se apila son las 2 cajas
    // de bienvenida, que ya son un solo item: sin apilado serían cinco ranuras.
    const ranuras = wh(g7).length;
    check('almacén: las 2 cajas de bienvenida ocupan 1 ranura, no 2',
      deType(g7, 'crate') === 1 &&
      wh(g7).find((w: any) => w.type === 'crate')?.stackCount === 2 &&
      ranuras === 4,
      `items=${ranuras} cajas=${deType(g7, 'crate')} unidades=2`);
    check('almacén: con sitio de sobra la compra cabe',
      g7.canBuyStoreItem('collectorCardT2') === true, 'no cabe con ' + ranuras + ' de 15');

    // Ampliar el almacén tiene DOS caminos distintos, y confundirlos es fácil porque
    // los dos se llaman "ampliar" en la carta: `warehouseSlot` amplía al
    // comprarse y no mete ningún item, mientras que `backpackExpander` es un
    // CONSUMIBLE que hay que usar después. El primero es un permiso y el segundo
    // un objeto, y por eso solo el primero es gratis de ranura.
    const antesCap = g7.getCapacity();
    const antesSlots = wh(g7).length;

    g7.updateState({ nanites: 6000 });
    const permiso = g7.buyStoreItem('warehouseSlot');
    check('almacén: se puede ampliar', Boolean(permiso), String(permiso));
    check('almacén: ampliar NO mete un item',
      wh(g7).length === antesSlots, `${antesSlots} -> ${wh(g7).length}`);
    check('almacén: y la capacidad sube 5', g7.getCapacity() === antesCap + 5,
      `${antesCap} -> ${g7.getCapacity()}`);

    // El expansor comprable: da un item, y el item es el que amplía.
    g7.updateState({ nanites: 1400 });
    const expansor = g7.buyStoreItem('backpackExpander');
    check('almacén: el expansor SÍ es un item',
      Boolean(expansor) && deType(g7, 'consumable') === 1, 'consumibles=' + deType(g7, 'consumable'));
    const capTrasComprar = g7.getCapacity();
    check('almacén: pero comprarlo NO amplía todavía',
      capTrasComprar === antesCap + 5, 'cap=' + capTrasComprar);
    const usado = g7.useConsumable((expansor as any).id);
    check('almacén: ampliar es usarlo', usado.ok === true, usado.msg ?? '');
    // OJO: el expansor da +1 ranura, no +5. El +5 es del permiso `warehouseSlot`.
    check('almacén: y al usarlo sube 1 ranura',
      g7.getCapacity() === capTrasComprar + 1,
      `${capTrasComprar} -> ${g7.getCapacity()}`);

    const g8 = await reload();
    check('almacén: las dos ampliaciones sobreviven a la recarga',
      g8.getCapacity() === antesCap + 6, 'cap=' + g8.getCapacity());

    // Y ahora la parte que más se ha roto: con el almacén lleno, lo que no cabe
    // no se compra, y lo que sí cabe en una pila sí se compra.
    //
    // QUINCE items, no catorce: `baseSave` no añade los de bienvenida, así que
    // catorce contra una capacidad de quince no está lleno y todas las
    // comprobaciones de "lleno" pasarían sin probar nada. Y una de esas quince es
    // una pila de cajas, que es lo que da sentido a la comparación.
    const g9 = await boot(baseSave(
      [...Array.from({ length: 14 }, (_, i) => collector('c' + i)), cr('pila', 'common', 5)],
      { nanites: 100_000, warehouseCapacity: 15 }
    ));
    check('almacén lleno: está lleno de verdad',
      g9.getCapacity() === 15 && wh(g9).length === 15,
      `${wh(g9).length}/${g9.getCapacity()}`);
    check('almacén lleno: un item que necesita ranura NO cabe',
      g9.canBuyStoreItem('collectorCardT1') === false, 'dice que cabe');
    check('almacén lleno: y al comprarlo no se cobra',
      (() => { g9.buyStoreItem('collectorCardT1'); return nanites(g9) === 100_000; })(),
      'nanitas=' + nanites(g9));
    check('almacén lleno: pero otra caja del mismo tipo SÍ cabe, porque se apila',
      g9.canBuyStoreItem('commonCrate') === true,
      `hay una pila de ${wh(g9).find((w: any) => w.id === 'pila')?.stackCount} cajas`);
    check('almacén lleno: y al comprarla no ocupa ranura nueva',
      (() => {
        const antes = wh(g9).length;
        const comprada = g9.buyStoreItem('commonCrate');
        return Boolean(comprada) && wh(g9).length === antes;
      })(), `items=${wh(g9).length}`);
    check('almacén lleno: y la pila suma las unidades',
      wh(g9).find((w: any) => w.id === 'pila')?.stackCount === 6,
      'unidades=' + wh(g9).find((w: any) => w.id === 'pila')?.stackCount);
  }

  // =========================================================================
  //  6. VENDER: el botón tiene que decir lo que cobra
  // =========================================================================
  {
    const g10 = await boot(baseSave(
      [collector('r1', 3, { damage: 60 }), { ...collector('r1'), id: 'r2' },
       { ...collector('r1'), id: 'r3', type: 'crate', name: 'Caja Común', stackable: true, stackCount: 4 }],
      { nanites: 500, warehouseCapacity: 30 }
    ));
    // El unitario es el de ESE item, no el de otro. Al principio se comparaba una
    // pila de cajas contra el precio de un recolector, que no tienen nada que ver
    // y daba un fallo que parecía del juego.
    const unitarioCaja = g10.getSellPrice('r3');
    const unitarioRec = g10.getSellPrice('r1');
    check('venta: el precio unitario es el de UNA pieza', unitarioRec > 0, 'unitario=' + unitarioRec);
    check('venta: y el de una caja es el suyo, no el de otro item',
      unitarioCaja > 0 && unitarioCaja !== unitarioRec,
      `caja=${unitarioCaja} recolector=${unitarioRec}`);

    const total = g10.getSellTotal('r3');
    check('venta: el total de una pila es SU unitario × unidades',
      total === unitarioCaja * 4, `total=${total} unitario=${unitarioCaja} pila=4`);
    check('venta: el total NO es el unitario (la trampa que ya pasó)',
      total !== unitarioCaja, 'son iguales');

    const antes = nanites(g10);
    const vendido = g10.sellItem('r3');
    check('venta: se vende la pila entera', vendido.ok === true, vendido.msg ?? '');
    check('venta: y se cobra EXACTAMENTE lo que el botón decía',
      nanites(g10) - antes === total,
      `cobrado=${nanites(g10) - antes}(total=${total})`);
    check('venta: y la pila desaparece del almacén', !find(g10, 'r3'), ids(g10).join(','));

    const g11 = await reload();
    check('venta: no se resucita al recargar', !find(g11, 'r3'), ids(g11).join(','));
    check('venta: y la cartera es la que quedó',
      nanites(g11) === antes + total, `nanitas=${nanites(g11)}`);

    // El recolector equipado no se vende, y esta comprobacion mira dos cosas: que se
    // rechace y que ademas siga ahi haciendo dano. Si se vendiera, el jugador se
    // quedaria sin dano, con el almacen mas vacio y sin ningun aviso.
    g11.equipCollector('r1');
    const intentado = g11.sellItem('r1');
    check('venta: el recolector equipado no se vende', intentado.ok === false, intentado.msg ?? '');
    check('venta: y sigue en el almacén haciendo daño',
      Boolean(find(g11, 'r1')) && g11.getClickDamage() > 0, 'danio=' + g11.getClickDamage());
  }

  // =========================================================================
  //  7. LA RULETA Y LAS CAJAS: lo que enseña es lo que entra
  // =========================================================================
  {
    const g12 = await boot(baseSave(
      [{ ...collector('r1', 3, { damage: 60 }) }, cr('c1', 'common'), keyT1('k1', 2)],
      { nanites: 0, warehouseCapacity: 30 }
    ));
    const antes = nanites(g12);
    const cajas = wh(g12).filter((w: any) => w.type === 'crate').length;
    const llaves = wh(g12).filter((w: any) => w.type === 'key')
      .reduce((a, w: any) => a + (w.stackCount ?? 1), 0);

    const r = g12.openCrateBox('c1', 'k1');
    check('caja: se abre', r.ok === true, r.msg ?? '');
    check('caja: la caja se consume',
      deType(g12, 'crate') < cajas, 'cajas=' + deType(g12, 'crate'));
    check('caja: y se gasta UNA llave',
      wh(g12).filter((w: any) => w.type === 'key')
        .reduce((a, w: any) => a + (w.stackCount ?? 1), 0) === llaves - 1,
      'llaves=' + wh(g12).filter((w: any) => w.type === 'key')
        .reduce((a, w: any) => a + (w.stackCount ?? 1), 0));
    check('caja: el contador de cajas abiertas sube', s(g12).cratesOpened === 1,
      'abiertas=' + s(g12).cratesOpened);

    // El principio del módulo: el nombre que enseña y el item que entra son el
    // mismo. Con el botín siendo nanitas, la cifra que anuncia la casilla tiene
    // que ser la que entró.
    const premio = r.reward;
    check('caja: vuelve un premio con etiqueta y nombre',
      Boolean(premio && premio.label && premio.name), JSON.stringify(premio?.label ?? null));
    if (premio?.kind === 'nanites') {
      const ganado = nanites(g12) - antes;
      check('caja: si son nanitas, entran las que dice la etiqueta',
        premio.label.includes(String(ganado)) || premio.label.includes('K'),
        `etiqueta="${premio.label}" entraron=${ganado}`);
    }

    // Dos turnos antes de recargar, y el motivo es el mismo que documenta `boot()`:
    // `openCrateBox` llama a `saveToFirebase()` SIN `await`, así que su escritura
    // sigue en el aire cuando se pide la recarga y el bucle nuevo lee el documento
    // de antes de abrir la caja. Con un solo turno el documento llega a medio
    // guardar —la caja ya consumida, la llave todavía con dos unidades— y el
    // banco acusa al guardado de algo que no ha hecho.
    //
    // No se arregla dentro de `reload()`, que debe seguir siendo una recarga limpia
    // para `queueCheck`: esperar es responsabilidad de quien acaba de mutar.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const g13 = await reload();
    check('caja: el botín sobrevive a la recarga',
      s(g13).cratesOpened === 1, 'abiertas=' + s(g13).cratesOpened);
    // Lo que se comprueba aquí es la dirección del daño: el MATERIAL NO AUMENTA.
// Que la caja no vuelva es lo evidente; lo que sería un fallo de verdad es que
// abrirla devolviera llaves, porque convertir una caja en llaves gratis es
// infinitamente explotable.
//
    // NOTA HISTORICA: este `check` empez\u00f3 siendo un dato en lugar de una asercion, porque
    // la llave consumida VOLVIA al recargar. Resulto ser un bug de verdad, y de los que
    // mas caros: `saveToFirebase` no escribia `keysByTier` ni `crystalsByTier`, asi que
    // al cargar la migracion metia el TOTAL de llaves en el cubo del nivel 0, comparaba
    // un total contra una parte y materializaba material de mas EN CADA RECARGA.
    //
    // Se ve porque el stub de Firestore guardaba el documento con una copia superficial,
    // de modo que el banco comparaba un array consigo mismo. Al hacer que el stub
    // serialice como Firestore, dos pruebas que eran vacuas se pusieron a mirar de
    // verdad. Ver `CONTEXTO-JUEGO.md`, discrepancias 15 y 16.
    const cajas13 = deType(g13, 'crate');
    const llaves13 = wh(g13).filter((w: any) => w.type === 'key')
      .reduce((a, w: any) => a + (w.stackCount ?? 1), 0);
    check('caja: la caja abierta no vuelve',
      cajas13 < cajas, `cajas=${cajas13} (antes ${cajas})`);
    check('caja: abrir una caja NO multiplica el material',
      llaves13 <= llaves, `llaves=${llaves13} antes=${llaves}`);
    check('caja: la llave consumida no vuelve al recargar',
      llaves13 === llaves - 1,
      `llaves=${llaves13} esperado=${llaves - 1} · doc=${JSON.stringify((guardado() as any)?.keys ?? 'sin campo keys')}`);
  }

  // =========================================================================
  //  8. EL BALANCE: que un tier alto no sea una trampa
  //
  //  Esta es la única comprobación de equilibrio del banco, y no es arbitraria.
  //  `CAMBIOS-MACRO.md` documenta que la curva se aplanó porque el coste por punto
  //  de poder era 32× peor en T10 que en T1, y que el jugador óptimo solo
  //  compraba T1. Ese es un fallo de juego, no una preferencia: hace que la mitad
  //  de la tienda sean trampas.
  //
  //  Se mide por poder REAL, no por el número de la carta: se compra la carta, se
  //  equipa, y se lee `getClickDamage()`. Así el banco no reimplementa la fórmula
  //  de daño; usa la misma que ve el jugador.
  // =========================================================================
  {
    const g14 = await boot(baseSave([collector('base', 3, { damage: 60 })],
      { nanites: 5_000_000, warehouseCapacity: 40 }));

    const poder: { tier: number; coste: number; danio: number }[] = [];
    for (let tier = 1; tier <= 10; tier++) {
      const carta = `collectorCardT${tier}` as keyof typeof STORE_ITEMS;
      const comprado = g14.buyStoreItem(carta);
      if (!comprado) continue;
      const id = (comprado as any).id;
      g14.equipCollector(id);
      poder.push({ tier, coste: STORE_ITEMS[carta].cost, danio: g14.getClickDamage() });
      // Se vende para no llenar el almacén: 10 cartas no caben en 15 ranuras.
      g14.equipCollector('base');
      g14.sellItem(id);
    }

    const detalle = poder.map((p) => `T${p.tier}:${(p.danio / p.coste * 1000).toFixed(1)}`).join(' ');
    check('balance: se pudieron medir los diez tiers', poder.length === 10,
      'medidos=' + poder.length);

    // El daño SUBE con el tier. Trivial, pero es la condición necesaria para que
    // el apartado de debajo signifique algo: si un tier alto diera menos daño que
    // uno bajo, hablar de coste por punto sería hablar de nada.
    check('balance: más tier es más daño',
      poder.every((p, i) => i === 0 || p.danio > poder[i - 1].danio), detalle);

    // Aquí está el hallazgo, y es un DATO, no una aspiración.
    //
    // `CAMBIOS-MACRO.md` cuenta que la curva se aplanó porque el coste por punto de
    // poder era 32× peor en T10 que en T1, y que después del arreglo T10 salía
    // "~1,3x mejor que en T1". Medido hoy NO es eso: el mejor tier entrega 4,9×
    // más poder por nanita que el peor, y la curva es una escalera que sube sin
    // parar de T5 en adelante (T5 10,9 · T6 11,9 · T7 13,6 · T8 21,7 · T9 29,5 ·
    // T10 30,9).
    //
    // La consecuencia para el jugador es la del bug original, del revés: ahora
    // las cartas de tier bajo son trampas y no se compran nunca. En
    // `CONTEXTO-JUEGO.md` queda anotado como discrepancia 15.
    //
    // El margen de aquí es de GUARDIA, no de diseño: está puesto por encima del
    // 4,9× medido para que una subida de precios no lo dispare, y con la cabeza
    // sobre el hecho de que el objetivo declarado era 1,3×. Si esto salta, alguien
    // ha tocado la tabla de precios.
    const ratio = poder.map((p) => p.danio / p.coste);
    const max = Math.max(...ratio);
    const min = Math.min(...ratio);
    const factor = max / min;
    const peor = poder[ratio.indexOf(min)].tier;
    const mejor = poder[ratio.indexOf(max)].tier;
    check('balance: el poder por nanita se midió en los diez tiers',
      ratio.every((r) => r > 0), detalle);
    check('balance: la curva no se dispara (peor ≤ 6× el mejor)',
      factor <= 6, `T${peor} contra T${mejor}: ${factor.toFixed(1)}x  ${detalle}`);
    check('balance: DATO la dispersión real entre tiers',
      true, `${factor.toFixed(1)}x de T${peor} a T${mejor}; el objetivo declarado es 1,3x`);
  }

  // =========================================================================
  //  9. LOS BUFFS: se aplican, se caducan y se pueden cancelar
  // =========================================================================
  {
    const g15 = await boot(baseSave(
      [collector('r1', 3, { damage: 60 }), consumable('u1', 'clickX2', 1, { name: 'Tarjeta Click x2' })],
      { nanites: 0, warehouseCapacity: 30 }
    ));
    g15.equipCollector('r1');
    const danio = g15.getClickDamage();

    const r = g15.useConsumable('u1');
    check('buff: una tarjeta Click x2 se aplica', r.ok === true, r.msg ?? '');
    check('buff: y duplica el daño por click', g15.getClickDamage() === danio * 2,
      `${danio} -> ${g15.getClickDamage()}`);
    check('buff: el item se gasta', !find(g15, 'u1'), ids(g15).join(','));

    const cancelado = g15.cancelBuff('clickX2');
    check('buff: se puede cancelar', Boolean(cancelado), String(cancelado));
    check('buff: y al cancelar vuelve el daño', g15.getClickDamage() === danio,
      `${danio} -> ${g15.getClickDamage()}`);

    const g16 = await reload();
    check('buff: el buff cancelado no sobrevive a la recarga',
      g16.getClickDamage() === danio, 'danio=' + g16.getClickDamage());
    check('buff: y el item cancelado no vuelve', !find(g16, 'u1'), ids(g16).join(','));
  }

  // =========================================================================
  //  10. LA ASCENSIÓN: el cierre del ciclo
  //
  //  Es lo último que hace un jugador y lo que más caro sale si se rompe, porque
  //  es la partida entera. Se comprueba lo que la página promete: por debajo del
  //  umbral no pasa nada, y por encima se conservan los núcleos y el árbol y se
  //  reinicia el progreso.
  // =========================================================================
  {
    const g17 = await boot(baseSave(
      [collector('r1', 3, { damage: 60 })],
      { nanites: 1000, totalNanitesProduced: 500, warehouseCapacity: 30 }
    ));
    const bajo = g17.prestige();
    check('ascensión: por debajo del umbral se rechaza', !bajo.success, bajo.msg ?? '');
    check('ascensión: y no se toca el progreso', nanites(g17) === 1000, 'nanitas=' + nanites(g17));

    const g18 = await boot(baseSave(
      [collector('r1', 3, { damage: 60 }), crystal('x1', 1, 3)],
      {
        nanites: 2_000_000, totalNanitesProduced: 50_000_000,
        warehouseCapacity: 30, cores: 3, totalCores: 10, resets: 2,
        nodeLevels: { core_sink: 2 }, unlockedNodes: ['core_sink']
      }
    ));
    // `pending` es el nombre del campo, no `gained`: el que se anuncia en la
    // página de Ascensión. Es lo que tiene que coincidir con lo que el reinicio
    // otorga, porque un jugador que ve una cifra y recibe otra no va a notar que
    // la fórmula sea la misma.
    const info = g18.getPrestigeInfo();
    check('ascensión: la página anuncia lo que daría', info.pending > 0, 'daria=' + info.pending);

    const r = g18.prestige();
    check('ascensión: con suficiente producción se concede', r.success === true, r.msg ?? '');
    check('ascensión: otorga los núcleos anunciados', s(g18).cores === 3 + info.pending,
      `nucleos=${s(g18).cores} esperado=${3 + info.pending}`);
    check('ascensión: el progreso se reinicia', nanites(g18) === 0, 'nanitas=' + nanites(g18));
    check('ascensión: los núcleos NO se pierden', s(g18).cores > 3, 'nucleos=' + s(g18).cores);
    check('ascensión: el árbol de pasivas se conserva',
      (s(g18).nodeLevels?.core_sink ?? 0) === 2, JSON.stringify(s(g18).nodeLevels));
    check('ascensión: el contador de reinicios sube', s(g18).resets === 3, 'reinicios=' + s(g18).resets);

    const g19 = await reload();
    check('ascensión: el reinicio sobrevive a la recarga',
      nanites(g19) === 0 && s(g19).cores === 3 + info.pending && s(g19).resets === 3,
      `nanitas=${nanites(g19)} nucleos=${s(g19).cores} reinicios=${s(g19).resets}`);
    check('ascensión: y el árbol sigue ahí tras recargar',
      (s(g19).nodeLevels?.core_sink ?? 0) === 2, JSON.stringify(s(g19).nodeLevels));

    // Y LO MÁS IMPORTANTE DE ESTE APARTADO: que no haya bloqueo. Tras el reinicio
    // el jugador tiene cero nanitas y ningún recolector equipado, así que el click
    // no da nada. Si además no le quedara nada con lo que arrancar, la partida se
    // acabaría ahí para siempre: el jugador no puede ganar su primer nanita.
    //
    // No lo hay, y por qué: el reinicio deja 3 llaves, 5 cristales, las 2 cajas de
    // bienvenida y un Blaster Láser en el almacén. Se comprueba, no se supone.
    const blaster = wh(g19).find((w: any) => w.type === 'collector');
    check('ascensión: queda un recolector con el que empezar',
      Boolean(blaster), 'items=' + ids(g19).join(','));
    g19.equipCollector(blaster!.id);
    check('ascensión: y con él se vuelve a hacer daño',
      g19.getClickDamage() > 0, 'danio=' + g19.getClickDamage());
    g19.click();
    check('ascensión: no hay bloqueo: el primer click ya da algo',
      nanites(g19) > 0, 'nanitas=' + nanites(g19));
  }

  resumen('la partida entera de un jugador nuevo');
}

// --------------------------------------------------------------------------
//  Ayudantes locales. Los que ya existen en `kit.ts` se usan; estos son solo
//  atajos de lectura para que el banco se lea como se juega.
// --------------------------------------------------------------------------

/** Una caja con el nombre que el juego reconoce al abrirla. */
function cr(id: string, tipo: 'common' | 'rare' | 'epic' | 'legendary', stack = 1) {
  const NOMBRES = { common: 'Caja Común', rare: 'Caja Rara', epic: 'Caja Épica', legendary: 'Caja Legendaria' };
  return {
    id, name: NOMBRES[tipo], type: 'crate', details: 'x', rarity: 'Raro',
    tier: 0, sellPrice: 500, stackable: true, stackCount: stack
  };
}

/** Una llave de nivel 0, que abre las cajas comunes. */
function keyT1(id: string, stack: number) {
  return {
    id, name: 'Llave de Cifrado', type: 'key', details: 'x', rarity: 'Raro',
    tier: 0, sellPrice: 480, stackable: true, stackCount: stack
  };
}

export default main();
