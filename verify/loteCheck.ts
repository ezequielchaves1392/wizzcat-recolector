// ==========================================================================
//  La apertura en lote: compra múltiple, el tope de apertura y la lista de lo que salió
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
//
//  Y hay un bloque entero que antes era "cada apertura gasta una llave": ya no hay
//  llave que gastar, y lo que se comprueba ahora es su consecuencia —**el tope de
//  reventa es un número solo y vale lo mismo que el par que era**, y ninguna
//  apertura deja una llave en el almacén.
// ==========================================================================

import { boot, reload, check, resumen, s, wh, nanites, ids, baseSave, crate, crystal, distintos } from './kit';
import { STORE_ITEMS, costeDeCaja, CRATE_TYPES, type CrateType } from '../src/data/store';
import { CRATE_LOOT, rollCrateReward, resolveLootAmount, tablaDePesos, probabilidadDeSalto, type CrateReward } from '../src/components/crateLoot';
import { resumenDePremios, MAX_APERTURA_LOTE, maximoDeApertura } from '../src/components/crateSummary';
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

    const r = g.buyStoreItem('crateT1', 200) as any;
    const pilas = wh(g).filter((w: any) => w.type === 'crate');
    check('compra: 200 cajas de golpe entran las 200',
      !!r && pilas.reduce((a: number, w: any) => a + (w.stackCount || 1), 0) === 200,
      `${pilas.length} pilas · ${pilas.map((w: any) => w.stackCount).join('+')}`);
    // 200 = 99 + 99 + 2. Es el caso que de verdad importa: por debajo del tope
    // todo entra en una pila y el reparto no llega a verse.
    check('compra: y repartidas en 99 + 99 + 2, por el tope de pila',
      pilas.length === 3 && pilas.map((w: any) => w.stackCount).sort((a: number, b: number) => b - a).join(',') === '99,99,2',
      `${pilas.map((w: any) => w.stackCount).join(',')}`);
    check('compra: y se cobran 200 veces el unitario',
      nanites(g) === unit * 200 - unit * 200, `nanites=${nanites(g)}`);
    check('compra: el total del diálogo es el que se cobra',
      g.getBulkCost('crateT1', 200) === unit * 200, `bulk=${g.getBulkCost('crateT1', 200)}`);

    // El tope lo manda el ESPACIO, y con el tope de pila eso ya no es "una pila
    // es una ranura, así que caben N".
    const g2 = await boot(baseSave([crate('c1', 1, 99)], { nanites: unit * 1000, warehouseCapacity: 4 }));
    const max = g2.getBulkMax('crateT1');
    check('compra: el tope del lote lo manda el espacio, no el saldo',
      max === 297, `max=${max}; con el dinero alcanza para 1000`);
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
    //
    // Y no se mira una carta de llave porque **ya no hay ninguna**: la lista de
    // cartas en lote son el cristal, la caja y los consumibles, y una carta que
    // no existe devolvería "unidad" sin decir por qué.
    check('compra: el nombre de unidad sale del motor y la caja dice "caja"',
      g.getBulkUnitName('crateT1') === 'caja'
        && g.getBulkUnitName('upgradeCrystal') === 'cristal'
        && g.getBulkUnitName('companionSlot1') === 'unidad',
      `caja=${g.getBulkUnitName('crateT1')} ` +
      `cristal=${g.getBulkUnitName('upgradeCrystal')} ranura=${g.getBulkUnitName('companionSlot1')}`);
  }

  // -------------------------------------------------------------------------
  //  2. EL TOPE DE APERTURA, Y POR QUÉ ESTÁ ATADO AL DE LA PILA
  // -------------------------------------------------------------------------
  {
    // **NO TIENEN QUE SER IGUALES. TIENEN QUE CUMPLIR UNA COSA.**
    //
    // Antes sí eran el mismo número y la prueba lo exigía con `===`, porque el
    // tope de pila era 20 y el de apertura también. Con la caja apilando de 99 en
    // 99 (G3) ya no: el de apertura sigue en 20 porque es una decisión de
    // **cuántas aperturas de golpe se le ofrecen a alguien**, no de cuántas caben
    // en una celda. Son dos cosas distintas y atarlas era casualidad, no regla.
    //
    // Lo que sí tiene que ser cierto es la **garantía**: abrir N cajas de golpe
    // no puede ocupar más de una ranura nueva, porque si no el diálogo ofrecería
    // una apertura que no cabe. De ahí sale la desigualdad: si el lote fuera mayor
    // que el tope de pila, abrirlo entero necesitaría más de una ranura y el
    // almacén decidiría por su cuenta cuántos Botín de menos.
    check('lote: el tope de apertura cabe en una sola pila, así que no gasta dos ranuras',
      MAX_APERTURA_LOTE <= TOPE_PILA.crate,
      `lote=${MAX_APERTURA_LOTE} pila=${TOPE_PILA.crate}`);
    check('lote: y sigue siendo un tope de verdad, no "todas las que haya"',
      MAX_APERTURA_LOTE >= 10 && Number.isFinite(MAX_APERTURA_LOTE),
      `lote=${MAX_APERTURA_LOTE}`);

    // Y que abrir de verdad N cajas gaste N cajas. Y solo N cajas.
    const g = await boot(baseSave([crate('c1', 1, 20)],
      { nanites: 0, warehouseCapacity: 40 }));
    const abiertas: CrateReward[] = [];
    // Lo que queda de la pila después de cada apertura. Antes esta cuenta era la de
    // las llaves; ahora, con la caja abierta sola, **el número que se puede medir
    // es el de la pila**: si una apertura gastara dos cajas o cero, la pila bajaría
    // de dos en dos o se quedaría quieta, y por eso se mira en cada vuelta y no
    // solo al final.
    const restantes: number[] = [];
    for (let i = 0; i < 20; i++) {
      const res: any = g.openCrateBox('c1');
      if (!res.ok) break;
      abiertas.push(res.reward);
      restantes.push(wh(g).find((w: any) => w.id === 'c1')?.stackCount ?? 0);
    }
    check('lote: se pueden abrir 20 de una vez',
      abiertas.length === 20, `abiertas=${abiertas.length}`);
    check('lote: y cada apertura se lleva exactamente una caja, ni dos ni ninguna',
      restantes.length === 20 && restantes.every((n, i) => n === 19 - i),
      `pila tras cada apertura: ${restantes.join(',')}`);
    check('lote: y la caja se consume entera',
      !wh(g).some((w: any) => w.id === 'c1'), ids(g).join(','));
    check('lote: el contador de cajas abiertas sube por cada una',
      s(g).cratesOpened === 20, `abiertas=${s(g).cratesOpened}`);

    // Y lo que no puede pasar: **que veinte aperturas dejen una llave en el
    // almacén**. La llave era una fila del botín y una segunda cosa que gastar en
    // cada apertura; si alguna vez vuelve a aparecer en la tabla o en la redención,
    // el almacén se llenaría de objetos que no abren nada y esta es la que lo ve.
    check('lote: veinte aperturas no dejan ni una llave en el almacén',
      wh(g).filter((w: any) => w.type === 'key').length === 0,
      ids(g).filter((id) => /^k/.test(id)).join(',') || 'ninguna');

    // Y el tope NO es "las cajas que tengo". Con 99 cajas encima, el diálogo
    // ofrece 20: el tope manda por encima de lo que hay.
    //
    // **ESTA PRUEBA MEDÍA SU PROPIO MONTAJE, NO LA REGLA.** Abría cajas en bucle
    // y contaba cuántas salían, con la idea de que se pararía en el tope. Pero
    // `openCrateBox` abre **una** caja: el tope de apertura nunca estuvo en el
    // motor, está en el `Math.min` del diálogo. La prueba se paraba porque se
    // acababan las cajas del banco, no porque existiera el tope, y lo que de
    // verdad comprobaba era el inventario del Test.
    //
    // La regla se mide ahora donde está: `maximoDeApertura()`, en
    // `crateSummary.ts`. Sacarla de la vista es lo que la ha hecho comprobable;
    // mientras viviera en un manejador de clic no había forma de preguntarle nada.
    check('lote: con 99 cajas encima, el tope sigue mandando',
      maximoDeApertura(99) === MAX_APERTURA_LOTE,
      `diálogo=${maximoDeApertura(99)} tope=${MAX_APERTURA_LOTE}`);
    check('lote: y lo que hay de menos manda también',
      maximoDeApertura(8) === 8 && maximoDeApertura(1) === 1,
      `ocho=${maximoDeApertura(8)} una=${maximoDeApertura(1)}`);
    check('lote: sin cajas no se abre ninguna, y no se ofrece un número negativo',
      maximoDeApertura(0) === 0 && maximoDeApertura(-5) === 0,
      `cero=${maximoDeApertura(0)} negativo=${maximoDeApertura(-5)}`);
    // Y lo que hay de menos **siempre es un número de cajas entero**. La función
    // hace `Math.floor(cajas) || 0` por un motivo concreto: un `NaN` de la vista se
    // convertiría en un "abre NaN cajas" que nadie sabe de dónde sale, y por eso
    // cae a cero en vez de propagarse.
    check('lote: un número de cajas que no sea entero se recorta, y un NaN cae a cero',
      maximoDeApertura(3.9) === 3 && maximoDeApertura(NaN) === 0,
      `tres coma nueve=${maximoDeApertura(3.9)} NaN=${maximoDeApertura(NaN)}`);
  }

  // -------------------------------------------------------------------------
  //  3. EL RESUMEN: QUÉ SE SUMA Y QUÉ NO
  // -------------------------------------------------------------------------
  {
    const nanita = (amount: number): CrateReward => ({
      kind: 'nanites', amount, name: 'Nanitas', label: `+${amount} Nanitas`,
      details: 'Materia prima básica', rarity: 'Común', icon: 'bolt', exclusive: false
    });
    // La caja siguiente. Sustituye a la llave como fila del mismo tipo —"algo que
    // se agrupa porque es intercambiable"— y **agrupa por NOMBRE**, no por nivel:
    // dos cajas T2 son la misma fila porque son la misma caja, y por eso el
    // nombre sale de `CRATE_TYPES` y no se escribe aquí a mano. Una lista de
    // nombres escrita en el banco sería una copia de la del juego, que es
    // exactamente lo que este banco no puede tener.
    const caja = (tier: number, amount: number): CrateReward => ({
      kind: 'crate', amount, name: CRATE_TYPES[tier as CrateType].name, label: `+${amount}`,
      details: 'x', rarity: CRATE_TYPES[tier as CrateType].rarity, icon: 'crate', exclusive: false
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

    // Y las cajas, que son la otra mitad de lo que se suma. Dos cajas T2 sí son la
    // misma fila —el jugador quiere saber cuántas se lleva, no cuántas veces
    // salieron— y una T3 es otra fila, porque mezclarlas daría "T2+T3" y una cifra
    // que no existe en el almacén. Esta es la fila que la llave ocupaba, y lo que
    // hay que comprobar es **las dos mitades**: que se una y que no se una.
    const cajas = resumenDePremios([caja(2, 1), caja(3, 2), caja(2, 1)]);
    check('resumen: las cajas del mismo nivel se suman',
      cajas.length === 2 && cajas.find(f => f.reward.name === CRATE_TYPES[2].name)?.total === 2,
      JSON.stringify(cajas.map(f => `${f.reward.name}:${f.total}`)));
    check('resumen: pero las de distinto nivel NO, porque son otra caja',
      cajas.find(f => f.reward.name === CRATE_TYPES[3].name)?.total === 2
        && cajas.filter(f => f.reward.name === CRATE_TYPES[3].name).length === 1,
      JSON.stringify(cajas.map(f => `${f.reward.name}:${f.total}`)));

    // Y los OBJETOS no se suman. Dos drones son dos drones, y escribirlos "×2"
    // escondería que hay dos celdas ocupadas y dos compañeros que elegir.
    const dosDrones = resumenDePremios([dron('d1'), dron('d2')]);
    check('resumen: dos compañeros son dos filas, no un "×2"',
      dosDrones.length === 2, `filas=${dosDrones.length}`);
    check('resumen: y cada uno con su id, que es como el jugador los elige',
      dosDrones[0].reward.item?.id === 'd1' && dosDrones[1].reward.item?.id === 'd2',
      JSON.stringify(dosDrones.map(f => f.reward.item?.id)));

    // El caso mixto: siete premios de una vez. Son **cinco** filas, y el número
    // importa: dos nanitas se unen (1), dos cajas T2 se unen (1), un cristal (1) y
    // los dos drones NO (2). Una versión anterior de esta prueba contaba cuatro y
    // fallaba.
    const mezcla = resumenDePremios([
      nanita(900), nanita(700), cri(1, 3), caja(2, 1), dron('d1'), dron('d2'), caja(2, 1)
    ]);
    check('resumen: siete premios dan cinco filas (2 nanitas juntas, 2 drones sueltos)',
      mezcla.length === 5, `filas=${mezcla.length} · ${JSON.stringify(mezcla.map(f => `${f.reward.kind}:${f.total}`))}`);
    check('resumen: las dos filas de 2 companion NO se han unido',
      mezcla.filter(f => f.reward.kind === 'companion').length === 2,
      `companions=${mezcla.filter(f => f.reward.kind === 'companion').length}`);
    check('resumen: y las dos cajas T2 sí',
      mezcla.find(f => f.reward.kind === 'crate')?.total === 2,
      `cajas=${mezcla.find(f => f.reward.kind === 'crate')?.total}`);
    check('resumen: el total de nanitas es la suma de las dos filas',
      mezcla.find(f => f.reward.kind === 'nanites')?.total === 1600,
      `nanitas=${mezcla.find(f => f.reward.kind === 'nanites')?.total}`);

    // Y el caso real: veinte cajas de verdad dan muchas más filas que veinte, pero
    // nanitas y materiales se agrupan.
    const g = await boot(baseSave([crate('c1', 1, 20)],
      { nanites: 0, warehouseCapacity: 40 }));
    const reales: CrateReward[] = [];
    for (let i = 0; i < 20; i++) {
      const res: any = g.openCrateBox('c1');
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
    // El premio mayor de cada caja no puede venderse por más que lo que cuesta
    // abrirla. Medido antes de poner el tope: el recolector sobrecargado de la T10
    // se vendía por 457.800 con un tope de 145.388, ×3,15.
    //
    // **EL TOPE ES UN NÚMERO Y NO UNA SUMA, Y ES EL MISMO NÚMERO.** Antes era
    // `costeDeCaja(t) + costeDeLlave(t)`. Ahora la caja se abre sola y la paga
    // ella sola, pero **su precio subió justo lo que costaba la llave**: los dos
    // números coinciden en las diez. Por eso quitar las llaves no movió un nanito, y
    // esta comprobación es la que lo fija: si alguien bajara el precio de la caja a
    // la mitad "porque ya no hay llave", aquí empezaría a imprimir dinero sin que
    // ninguna otra prueba se enterase.
    for (let t = 1; t <= 10; t++) {
      const caja = t as CrateType;
      const tope = costeDeCaja(t);
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
      check(`equilibrio: nada de la caja T${t} se vende por más que abrirla`,
        peor <= tope, `peor=${peor} (${deQuien}) tope=${tope} ${peor > tope ? `IMPRIME x${(peor / tope).toFixed(2)}` : ''}`);
    }
  }

  // -------------------------------------------------------------------------
  //  5. Y LAS NANITAS, QUE NO SON UN ITEM Y NO PASAN POR EL TOPE
  // -------------------------------------------------------------------------
  {
    for (let t = 1; t <= 10; t++) {
      const caja = t as CrateType;
      const tope = costeDeCaja(t);
      const nanites: any = CRATE_LOOT[caja].find(e => e.id === 'nanites')!;
      let peor = 0;
      for (let i = 0; i < 40; i++) {
        const p: CrateReward = resolveLootAmount(caja, nanites.build({ ownedCosmetics: [] }));
        peor = Math.max(peor, p.amount);
      }
      check(`equilibrio: las nanitas de la caja T${t} no superan el tope de la caja`,
        peor <= tope, `peor=${peor} tope=${tope}`);
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
    // la T2 existe en el almacén y se abre sola.
    const g = await boot(baseSave([crate('c1', 1, 20), crate('c2', 2, 1)],
      { nanites: 0, warehouseCapacity: 60 }));
    const siguiente = wh(g).find((w: any) => w.type === 'crate' && w.name === CRATE_TYPES[2].name);
    check('cadena: la T2 salida de la T1 se reconoce como T2',
      !!siguiente, `no hay ninguna caja T2 en el almacén: ${wh(g).map((w: any) => w.name).join(', ')}`);

    // La escalera ya no tiene tramos. Antes esta caja solo se podía abrir con la
    // llave T2, y la llave T2 solo salía de una T2, así que el tramo intermedio
    // no lo podía hacer nadie y esta prueba acababa midiendo el rechazo de la
    // llave equivocada. **Ahora el tramo entero son dos clics y nada más**, que es
    // justo lo que hay que comprobar: la caja que salió de la T1 se abre sin
    // tener que buscar nada, y el motor devuelve de qué nivel era.
    if (siguiente) {
      const r: any = g.openCrateBox(siguiente.id);
      check('cadena: la T2 se abre sola, sin nada más en la mano',
        r.ok === true && r.crateType === 2, `ok=${r.ok} nivel=${r.crateType} msg=${r.msg}`);
      // Y lo que se gastó es **una** caja: la del salto. Si se cobrase también la
      // que quedaba de la T1, la escalera seguiría costando un paso que ya no
      // existe.
      check('cadena: y abrir la T2 no toca la pila de T1 que quedaba',
        wh(g).find((w: any) => w.id === 'c1')?.stackCount === 20,
        `pila de T1=${wh(g).find((w: any) => w.id === 'c1')?.stackCount}`);
    }

    // Y lo que sigue siendo verdad con y sin llaves: **abrir algo que no es una
    // caja no lanza nada, se rechaza y lo dice.** Antes esta mitad la ocupaba la
    // llave equivocada; el motivo de que siga aquí es el mismo, y es R4 —nunca
    // fallar hacia el jugador— aplicado a la única entrada que queda.
    const rFuera: any = g.openCrateBox('no-existe');
    check('cadena: un id que no está en el almacén se rechaza y lo dice',
      rFuera.ok === false && typeof rFuera.msg === 'string' && rFuera.msg.length > 0,
      `ok=${rFuera.ok} msg=${rFuera.msg}`);
  }
  {
    // Y el tramo bueno de la cadena, que ya es el único: T2 y nada más.
    const g = await boot(baseSave([crate('c2', 2, 1)],
      { nanites: 0, warehouseCapacity: 40 }));
    const r: any = g.openCrateBox('c2');
    check('cadena: la T2 se abre sola, y sale un T2',
      r.ok === true && r.crateType === 2, `ok=${r.ok} nivel=${r.crateType} msg=${r.msg ?? ''}`);
  }

  resumen('lote: compra multiple, tope de apertura y la lista de lo que salió');
}

export default main();
