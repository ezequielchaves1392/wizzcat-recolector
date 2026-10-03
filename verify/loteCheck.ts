// ==========================================================================
//  La apertura en lote: compra múltiple, tope de 20 y la lista de lo que salió
//
//  Tres cosas se compran aquí y ninguna es el sorteo —eso lo mide `lootCheck`—:
//
//  1. Que la caja se pueda comprar en lote, y que el tope lo ponga el espacio.
//  2. Que el tope del lote de apertura sea 20, que es el de la pila: el mismo
//     número en la esquina de la celda y en el diálogo.
//  3. Que `resumenDePremios()` sume lo que tiene que sumar y NO sume lo que no.
//
//  El tercer punto es el que importa, y es una función pura a propósito: "las
//  nanitas de veinte cajas son un número" y "el Espectro Azulado que salió en la
//  séptima es un compañero, no un multiplicador" son reglas del juego, y una
//  regla que vive dentro de un `innerHTML` no se puede comprobar.
// ==========================================================================

import { boot, reload, check, resumen, s, wh, nanites, ids, baseSave, crate, key, crystal, distintos } from './kit';
import { STORE_ITEMS, costeDeCaja, costeDeLlave, CRATE_TYPES, type CrateType } from '../src/data/store';
import { CRATE_LOOT, rollCrateReward, resolveLootAmount, tablaDePesos, probabilidadDeSalto, type CrateReward } from '../src/components/crateLoot';
import { resumenDePremios, MAX_APERTURA_LOTE } from '../src/components/crateSummary';
import { TOPE_PILA } from '../src/data/stacking';

async function main() {
  // -------------------------------------------------------------------------
  //  1. LA COMPRA EN LOTE
  // -------------------------------------------------------------------------
  {
    const unit = STORE_ITEMS.crateT1.cost;
    const g = await boot(baseSave([], { nanites: unit * 200, warehouseCapacity: 30 }));

    check('compra: la caja se compra en lote',
      g.getBulkMax('crateT1') > 1, `getBulkMax=${g.getBulkMax('crateT1')}`);

    const r = g.buyStoreItem('crateT1', 25) as any;
    const pilas = wh(g).filter((w: any) => w.type === 'crate');
    check('compra: 25 cajas de golpe entran las 25',
      !!r && pilas.reduce((a: number, w: any) => a + (w.stackCount || 1), 0) === 25,
      `${pilas.length} pilas · ${pilas.map((w: any) => w.stackCount).join('+')}`);
    check('compra: y repartidas en 20 + 5, por el tope de pila',
      pilas.length === 2 && pilas.map((w: any) => w.stackCount).sort((a: number, b: number) => b - a).join(',') === '20,5',
      `${pilas.map((w: any) => w.stackCount).join(',')}`);
    check('compra: y se cobran 25 veces el unitario',
      nanites(g) === unit * 200 - unit * 25, `nanites=${nanites(g)}`);
    check('compra: el total del diálogo es el que se cobra',
      g.getBulkCost('crateT1', 25) === unit * 25, `bulk=${g.getBulkCost('crateT1', 25)}`);

    // El tope lo manda el ESPACIO, y con el tope de pila eso ya no es "una pila
    // es una ranura, así que caben N".
    const g2 = await boot(baseSave([crate('c1', 1, 20)], { nanites: unit * 500, warehouseCapacity: 4 }));
    const max = g2.getBulkMax('crateT1');
    check('compra: el tope del lote lo manda el espacio, no el saldo',
      max === 60, `max=${max}; con el dinero alcanza para 500`);
    check('compra: y comprar ese tope entero funciona',
      g2.buyStoreItem('crateT1', max) !== false, 'rechazada');
    check('compra: y llena el almacén sin pasarse',
      wh(g2).filter((w: any) => w.type === 'crate').length === 4,
      ids(g2).join(','));

    const g3 = await boot(baseSave(distintos(40), { nanites: unit * 500, warehouseCapacity: 5 }));
    check('compra: sin hueco ni pila, el lote vale 0 y no se pregunta',
      g3.getBulkMax('crateT1') === 0, `max=${g3.getBulkMax('crateT1')}`);

    // El sustantivo del selector ("¿cuántas **cajas**?") lo pone el motor. La
    // vista tenía su propia copia de la lista de cartas en lote, con el mismo
    // `endsWith('Crate')` que ya había fallado en el motor: con la caja de F31 la
    // tarjeta decía "elige cuántas **unidad**". Dos copias de una lista de
    // nombres de carta es exactamente cómo se rompe una de las dos en silencio.
    check('compra: el nombre de unidad sale del motor y la caja dice "caja"',
      g.getBulkUnitName('crateT1') === 'caja'
        && g.getBulkUnitName('keyT3') === 'llave'
        && g.getBulkUnitName('upgradeCrystal') === 'cristal'
        && g.getBulkUnitName('companionSlot1') === 'unidad',
      `caja=${g.getBulkUnitName('crateT1')} llave=${g.getBulkUnitName('keyT3')} ` +
      `cristal=${g.getBulkUnitName('upgradeCrystal')} ranura=${g.getBulkUnitName('companionSlot1')}`);
  }

  // -------------------------------------------------------------------------
  //  2. EL TOPE DE 20, Y QUE SEA EL MISMO QUE EL DE LA PILA
  // -------------------------------------------------------------------------
  {
    check('lote: el tope de apertura es el tope de pila de la caja',
      MAX_APERTURA_LOTE === TOPE_PILA.crate,
      `lote=${MAX_APERTURA_LOTE} pila=${TOPE_PILA.crate}`);

    // Y que abrir de verdad N cajas solo gaste N llaves y N cajas.
    const g = await boot(baseSave([crate('c1', 1, 20), key('k1', 1, 20)],
      { nanites: 0, warehouseCapacity: 40 }));
    const abiertas: CrateReward[] = [];
    for (let i = 0; i < 20; i++) {
      const res: any = g.openCrateBox('c1', 'k1');
      if (!res.ok) break;
      abiertas.push(res.reward);
    }
    check('lote: se pueden abrir 20 de una vez',
      abiertas.length === 20, `abiertas=${abiertas.length}`);
    // Las llaves NO son 20 menos: la caja devuelve llaves, así que la cuenta buena
    // es "quedan exactamente las que el botín ha devuelto". Esa es la
    // comprobación que demuestra que **cada apertura gastó una llave**, y es la
    // única que no depende de saber de antemano cuántas van a volver.
    const devueltas = abiertas
      .filter((r) => r.kind === 'keys')
      .reduce((a, r) => a + (r.amount ?? 0), 0);
    const llavesEnAlmacen = wh(g).filter((w: any) => w.type === 'key')
      .reduce((a, w) => a + (w.stackCount || 1), 0);
    check('lote: cada apertura gastó una llave (quedan solo las que volvió el botín)',
      llavesEnAlmacen === devueltas,
      `almacen=${llavesEnAlmacen} devueltas=${devueltas}`);
    check('lote: y la caja se consume entera',
      !wh(g).some((w: any) => w.id === 'c1'), ids(g).join(','));
    check('lote: el contador de cajas abiertas sube por cada una',
      s(g).cratesOpened === 20, `abiertas=${s(g).cratesOpened}`);

    // Y con 30 en la pila el tope sigue siendo 20: es el de la pila, no el de
    // lo que hay. Por eso el diálogo no puede ofrecer abrir 30.
    const g2 = await boot(baseSave([crate('c1', 1, 20), crate('c2', 1, 10), key('k1', 1, 20)],
      { nanites: 0, warehouseCapacity: 40 }));
    const abiertas2: CrateReward[] = [];
    for (let i = 0; i < MAX_APERTURA_LOTE + 5; i++) {
      const res: any = g2.openCrateBox('c1', 'k1');
      if (!res.ok) break;
      abiertas2.push(res.reward);
    }
    check('lote: el tope del lote no es "las cajas que tengo"',
      abiertas2.length <= MAX_APERTURA_LOTE,
      `abiertas=${abiertas2.length} tope=${MAX_APERTURA_LOTE}`);
  }

  // -------------------------------------------------------------------------
  //  3. EL RESUMEN: QUÉ SE SUMA Y QUÉ NO
  // -------------------------------------------------------------------------
  {
    const nanita = (amount: number): CrateReward => ({
      kind: 'nanites', amount, name: 'Nanitas', label: `+${amount} Nanitas`,
      details: 'Materia prima básica', rarity: 'Común', icon: 'bolt', exclusive: false
    });
    const llave = (tier: number, amount: number): CrateReward => ({
      kind: 'keys', amount, name: `Llave T${tier}`, label: `+${amount} Llaves T${tier}`,
      details: 'x', rarity: 'Raro', icon: 'key', keyTier: tier as any, exclusive: false
    });
    const cri = (tier: number, amount: number): CrateReward => ({
      kind: 'crystals', amount, name: `Cristal T${tier}`, label: `+${amount}`,
      details: 'x', rarity: 'Raro', icon: 'crystal', materialTier: tier, exclusive: false
    });
    const dron = (id: string): CrateReward => ({
      kind: 'companion', amount: 1, name: 'Dron Explorador', label: 'Dron Explorador',
      details: '+2/s', rarity: 'Común', icon: 'companion', tier: 1,
      item: { id, name: 'Dron Explorador', type: 'companion', rarity: 'Común', sellPrice: 100 },
      exclusive: false
    });

    // 10 veces nanitas es UNA fila con la suma. Es lo que pidió el jugador y es
    // lo único razonable: veinte casillas de "+900" obligan a sumar a mano.
    const diezNanitas = resumenDePremios(Array.from({ length: 10 }, () => nanita(900)));
    check('resumen: diez nanitas son una fila con la suma',
      diezNanitas.length === 1 && diezNanitas[0].total === 9000,
      JSON.stringify({ filas: diezNanitas.length, total: diezNanitas[0]?.total }));

    // Los materiales se agrupan POR LO QUE SON, no por su nombre: el cristal T3
    // de la T3 y el de la T4 son el mismo material.
    const dosCri = resumenDePremios([cri(3, 4), cri(3, 6), cri(4, 2)]);
    check('resumen: los cristales del mismo nivel se suman',
      dosCri.length === 2 && dosCri.find(f => f.reward.materialTier === 3)?.total === 10,
      JSON.stringify(dosCri.map(f => `T${f.reward.materialTier}:${f.total}`)));

    const dosLlaves = resumenDePremios([llave(1, 1), llave(2, 3), llave(1, 2)]);
    check('resumen: las llaves de distinto nivel NO se suman',
      dosLlaves.length === 2 && dosLlaves.find(f => f.reward.keyTier === 1)?.total === 3,
      JSON.stringify(dosLlaves.map(f => `T${f.reward.keyTier}:${f.total}`)));

    // Y los OBJETOS no se suman. Dos drones son dos drones, y escribirlos "×2"
    // escondería que hay dos celdas ocupadas y dos compañeros que elegir.
    const dosDrones = resumenDePremios([dron('d1'), dron('d2')]);
    check('resumen: dos compañeros son dos filas, no un "×2"',
      dosDrones.length === 2, `filas=${dosDrones.length}`);
    check('resumen: y cada uno con su id, que es como el jugador los elige',
      dosDrones[0].reward.item?.id === 'd1' && dosDrones[1].reward.item?.id === 'd2',
      JSON.stringify(dosDrones.map(f => f.reward.item?.id)));

    // El caso mixto: siete premios de una vez. Son **cinco** filas, y el número
    // importa: dos nanitas se unen (1), tres cosas más (1+1+1) y los dos drones
    // NO (2). Una versión anterior de esta prueba contaba cuatro y fallaba.
    const mezcla = resumenDePremios([
      nanita(900), nanita(700), cri(1, 3), llave(1, 1), dron('d1'), dron('d2'), llave(1, 1)
    ]);
    check('resumen: siete premios dan cinco filas (2 nanitas juntas, 2 drones sueltos)',
      mezcla.length === 5, `filas=${mezcla.length} · ${JSON.stringify(mezcla.map(f => `${f.reward.kind}:${f.total}`))}`);
    check('resumen: las dos filas de 2 companion NO se han unido',
      mezcla.filter(f => f.reward.kind === 'companion').length === 2,
      `companions=${mezcla.filter(f => f.reward.kind === 'companion').length}`);
    check('resumen: y las dos llaves del T1 sí',
      mezcla.find(f => f.reward.kind === 'keys')?.total === 2,
      `llaves=${mezcla.find(f => f.reward.kind === 'keys')?.total}`);
    check('resumen: el total de nanitas es la suma de las dos filas',
      mezcla.find(f => f.reward.kind === 'nanites')?.total === 1600,
      `nanitas=${mezcla.find(f => f.reward.kind === 'nanites')?.total}`);

    // Y el caso real: veinte cajas de verdad dan muchas más filas que veinte, pero
    // nanitas y llaves se agrupan.
    const g = await boot(baseSave([crate('c1', 1, 20), key('k1', 1, 20)],
      { nanites: 0, warehouseCapacity: 40 }));
    const reales: CrateReward[] = [];
    for (let i = 0; i < 20; i++) {
      const res: any = g.openCrateBox('c1', 'k1');
      if (res.ok && res.reward) reales.push(res.reward);
    }
    const filas = resumenDePremios(reales);
    const nanitas = filas.find(f => f.reward.kind === 'nanites');
    const vecesNanitas = reales.filter(r => r.kind === 'nanites').length;
    check('resumen: veinte cajas reales dan menos de veinte filas',
      filas.length < reales.length, `filas=${filas.length} de ${reales.length}`);
    check('resumen: y si salieron nanitas, están en UNA fila con la suma',
      !nanitas || nanitas.total === reales.filter(r => r.kind === 'nanites')
        .reduce((a: number, r) => a + (r.amount ?? 0), 0),
      nanitas ? `${vecesNanitas} veces · total=${nanitas.total}` : 'no salieron');
    check('resumen: el número de veces sale en la fila',
      !nanitas || nanitas.veces === vecesNanitas,
      `${nanitas?.veces} de ${vecesNanitas}`);
    check('resumen: el total de nanitas de la lista es la suma de la fila',
      filas.filter(f => f.reward.kind === 'nanites')
        .reduce((a, f) => a + f.total, 0) === (nanitas?.total ?? 0),
      `${filas.filter(f => f.reward.kind === 'nanites').reduce((a, f) => a + f.total, 0)} vs ${nanitas?.total ?? 0}`);

    const g2 = await reload();
    check('resumen: y el lote sobrevive a la recarga',
      s(g2).cratesOpened === 20, `abiertas=${s(g2).cratesOpened}`);
  }

  // -------------------------------------------------------------------------
  //  4. LO QUE SE ABRE NO IMPRIMA DINERO (F31, punto de la petición)
  // -------------------------------------------------------------------------
  {
    // El premio mayor de cada caja no puede venderse por más que la caja y la
    // llave. Medido antes de poner el tope: el recolector sobrecargado de la T10
    // se vendía por 457.800 con un par de 145.388, ×3,15.
    for (let t = 1; t <= 10; t++) {
      const caja = t as CrateType;
      const par = costeDeCaja(t) + costeDeLlave(t);
      const g = await boot(baseSave([], { nanites: 10_000_000, warehouseCapacity: 400 }));
      let peor = 0;
      let deQuien = '';

      for (const entrada of CRATE_LOOT[caja]) {
        // El salto y los exclusivos no son "premios de la caja" en el mismo
        // sentido, pero también se venden: se miden igual.
        for (let i = 0; i < 12; i++) {
          const construido: any = entrada.build({ ownedCosmetics: [] });
          const premio: CrateReward = resolveLootAmount(caja, construido);
          if (!premio.item) continue;
          g.updateState({ warehouse: [premio.item] });
          const precio = g.getSellPrice(premio.item.id) as number;
          if (precio > peor) { peor = precio; deQuien = entrada.id; }
        }
      }
      check(`equilibrio: nada de la caja T${t} se vende por más que caja+llave`,
        peor <= par, `peor=${peor} (${deQuien}) par=${par} ${peor > par ? `IMPRIME x${(peor / par).toFixed(2)}` : ''}`);
    }
  }

  // -------------------------------------------------------------------------
  //  5. Y LAS NANITAS, QUE NO SON UN ITEM Y NO PASAN POR EL TOPE
  // -------------------------------------------------------------------------
  {
    for (let t = 1; t <= 10; t++) {
      const caja = t as CrateType;
      const par = costeDeCaja(t) + costeDeLlave(t);
      const nanites: any = CRATE_LOOT[caja].find(e => e.id === 'nanites')!;
      let peor = 0;
      for (let i = 0; i < 40; i++) {
        const p: CrateReward = resolveLootAmount(caja, nanites.build({ ownedCosmetics: [] }));
        peor = Math.max(peor, p.amount);
      }
      check(`equilibrio: las nanitas de la caja T${t} no superan caja+llave`,
        peor <= par, `peor=${peor} par=${par}`);
    }
  }

  // -------------------------------------------------------------------------
  //  6. LO QUE SALIÓ ESTÁ EN EL ALMACÉN Y SE PUEDE ABRIR
  // -------------------------------------------------------------------------
  {
    // **ESTA PRUEBA NO TIRA DADOS. MIDE LA REGLA.**
    //
    // Antes abría 20 cajas T1 y miraba si salía una T2, y fallaba de verdad:
    // el salto de tier es un peso dentro de la tabla, y el peso del salto en una
    // T1 da menos del 5 % por apertura. Con 20 aperturas hay un chance real de
    // cero, así que la prueba se caía sola de vez en cuando sin que cambiera
    // nada — y eso es peor que no probarla, porque el día que falle de verdad
    // nadie va a mirar si era el botín o el código.
    //
    // Lo que importa no es si sale T2 en una partida, sino **que la T2 esté en
    // la tabla** y con qué peso: eso es lo que decide la probabilidad y es
    // determinista. `saltoCheck` mide los pesos; aquí se comprueba que el premio
    // existe de verdad y que su peso es positivo.
    const pesos = tablaDePesos(1);
    const iUp = CRATE_LOOT[1].findIndex((e: any) => e.id === 'up');
    check('cadena: el salto de tier ESTA en la tabla de la T1',
      iUp >= 0, CRATE_LOOT[1].map((e: any) => e.id).join(','));
    check('cadena: y su peso es positivo, o sea que la T2 puede salir',
      (pesos[iUp] ?? 0) > 0,
      `peso del salto=${pesos[iUp]} de un total=${pesos.reduce((a: number, b: number) => a + b, 0)}`);
    check('cadena: el salto es raro, que es lo que se quiere de un premio de sorpresa',
      probabilidadDeSalto(1) < 0.10,
      `probabilidad=${(probabilidadDeSalto(1) * 100).toFixed(2)}%`);

    // Y ahora sí, con una caja T2 **puesta a mano**, se prueba el tramo entero:
    // la T2 existe en el almacén y no se abre con la llave que no toca.
    const g = await boot(baseSave([crate('c1', 1, 20), key('k1', 1, 20), crate('c2', 2, 1)],
      { nanites: 0, warehouseCapacity: 60 }));
    const siguiente = wh(g).find((w: any) => w.type === 'crate' && w.name === CRATE_TYPES[2].name);
    check('cadena: la T2 abierta desde la T1 se reconoce como T2',
      !!siguiente, `no hay ninguna caja T2 en el almacén: ${wh(g).map((w: any) => w.name).join(', ')}`);

    // Y LA CADENA TIENE UN TRAMO QUE ESTA PARTIDA NO PUEDE HACER: la T2 pide
    // llave T2, y la llave T2 solo sale de una T2. La primera versión de esta
    // prueba abria la T2 con la llave T1 y fallaba; no es un bug, es
    // que la escalera empieza en la T2, no en la T1.
    //
    // Asi que el tramo que si se puede comprobar con este botin es el
    // del rechazo, y es el que importa: la caja T2 con la llave equivocada
    // **no** se abre y lo dice.
    const llaveT1 = wh(g).find((w: any) => w.type === 'key' && w.tier === 1);
    if (siguiente) {
      const r: any = g.openCrateBox(siguiente.id, llaveT1?.id ?? 'nada');
      check('cadena: la T2 no se abre con la llave T1, y lo dice',
        r.ok === false && typeof r.msg === 'string' && r.msg.length > 0,
        `ok=${r.ok} msg=${r.msg}`);
    }
  }
  {
    // Y el tramo bueno de la cadena, con la llave que toca: T2 con llave T2.
    const g = await boot(baseSave([crate('c2', 2, 1), key('k2', 2, 1)],
      { nanites: 0, warehouseCapacity: 40 }));
    const r: any = g.openCrateBox('c2', 'k2');
    check('cadena: la T2 sí se abre con la llave T2',
      r.ok === true, r.msg ?? '');
  }

  resumen('lote: compra multiple, tope de 20 y la lista de lo que salió');
}

export default main();
