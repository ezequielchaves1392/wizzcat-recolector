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

import { boot, reload, check, resumen, s, wh, nanites, ids, baseSave, crate, distintos, collector } from './kit';
import { STORE_ITEMS, costeDeCaja, CRATE_TYPES, type CrateType } from '../src/data/store';
import { CRISTAL_NOMBRE } from '../src/data/items';
import { CRATE_LOOT, rollCrateReward, resolveLootAmount, tablaDePesos, probabilidadDeSalto, type CrateReward } from '../src/components/crateLoot';
import { resumenDePremios, MAX_APERTURA_LOTE, maximoDeApertura, estrellasDeFila } from '../src/components/crateSummary';
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
    //
    // **EL CRISTAL SE COMPRA POR PACKS, NO POR CRISTALES.** La carta cuesta 200 y
    // entrega 675 de golpe, así que el diálogo dice "2 × pack" y no "2 × cristal":
    // "cristal" haría creer que se compran dos cristales.
    check('compra: el nombre de unidad sale del motor y la caja dice "caja"',
      g.getBulkUnitName('crateT1') === 'caja'
        && g.getBulkUnitName('upgradeCrystal') === 'pack'
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
    // **EL TOPE DE APERTURA ES EL DE LA PILA, LEÍDO DE SU TABLA.** Estaba en veinte,
    // con el argumento de que una lista de cincuenta premios no cabe en una pantalla.
    // El argumento era cierto y la conclusión estaba equivocada: la lista **ya no es
    // una línea por caja**, porque `resumenDePremios()` agrupa las monedas y los
    // materiales. Lo que no se agrupa son los objetos, y eso es una columna con scroll,
    // que es lo que ha sido siempre.
    //
    // Y el 20 era una **copia** del 99 de la pila que se quedó vieja cuando la pila
    // subió. Dos números que hablan del mismo tope y que solo se comparaban entre sí el
    // día que alguien los miraba juntos.
    check('lote: el tope de apertura es el de la pila, no un número copiado',
      MAX_APERTURA_LOTE === TOPE_PILA.crate,
      `lote=${MAX_APERTURA_LOTE} pila=${TOPE_PILA.crate}`);
    // La garantía sigue siendo la misma: abrir el tope entero **no puede ocupar más de
    // una ranura nueva**, porque si no el almacén decidiría por su cuenta qué botín se
    // queda por el camino.
    check('lote: abrir el tope entero sigue gastando una sola ranura',
      MAX_APERTURA_LOTE <= TOPE_PILA.crate,
      `lote=${MAX_APERTURA_LOTE} pila=${TOPE_PILA.crate}`);
    check('lote: y sigue siendo un tope de verdad, no "todas las que haya"',
      MAX_APERTURA_LOTE >= 10 && Number.isFinite(MAX_APERTURA_LOTE),
      `lote=${MAX_APERTURA_LOTE}`);

    // **Y CON 99 APERTURAS, EL ESPACIO SIGUE SIENDO EL QUE MANDA.** Es el motivo por el
    // que se puede subir el tope sin abrir la puerta a perder botín: el diálogo ofrece
    // hasta lo que cabe y no una unidad más. Se comprueba en los tres casos que importan:
    // almacén entero, un hueco y sin límite conocido.
    check('lote: con el almacén lleno no se ofrece ni una apertura en lote',
      maximoDeApertura(99, 0) === 0, `ofrece=${maximoDeApertura(99, 0)}`);
    // **Y CON 99 APERTURAS EL ESPACIO SIGUE SIENDO EL QUE MANDA, Y SE NOTA.** Con 40
    // huecos ofrece 40 y no 99: es lo peor que puede pasar —un hueco por apertura—, y es
    // justo lo que el jugador pidió al subir el tope. Un tope de apertura sin el mínimo
    // de espacio sería una puerta a perder botín en silencio.
    check('lote: con huecos de sobra ofrece la pila entera',
      maximoDeApertura(99, 120) === 99, `ofrece=${maximoDeApertura(99, 120)}`);
    check('lote: y con huecos justos ofrece los huecos, que es lo peor que puede pasar',
      maximoDeApertura(99, 40) === 40, `ofrece=${maximoDeApertura(99, 40)}`);
    check('lote: un hueco da una apertura, no las que caben en la pila',
      maximoDeApertura(99, 1) === 1, `ofrece=${maximoDeApertura(99, 1)}`);
    check('lote: y ni una de más: la pila manda cuando no hay hueco que lo quite',
      maximoDeApertura(150, 99) === 99, `ofrece=${maximoDeApertura(150, 99)}`);

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

    // -------------------------------------------------------------------------
    //  2b. EL TERCER MÍNIMO: EL ESPACIO DEL ALMACÉN
    // -------------------------------------------------------------------------
    //
    //  Abrir veinte cajas con el almacén lleno es pedir un botín que no cabe. Lo que
    //  pasaba antes es que **`addToWarehouse()` devolvía `false`, el item no entraba y no
    //  había ningún aviso**: el jugador veía un objeto en la ruleta que no tenía en ninguna
    //  parte, y la tirada seguía su curso como si nada. En una lotería, un premio que
    //  desaparece sin decir por qué es lo más difícil que puede pasar.
    //
    //  Y el espacio tiene que ser el TERCER mínimo y no un añadido suelto, porque la regla
    //  vive en `maximoDeApertura()`: si el tope quedara en el diálogo, habría dos reglas y
    //  la del diálogo no la comprobaría ningún banco.
    {
      // **LO MÁS IMPORTANTE: SIN ESPACIO NO SE OFRECE NADA.** Con el almacén lleno, un
      //  selector que va de 1 a 20 es una promesa que el motor no puede cumplir.
      check('lote: sin huecos libres no se ofrece abrir ninguna',
        maximoDeApertura(20, 0) === 0,
        `huecos=0 ofrece=${maximoDeApertura(20, 0)}`);

      // **Y CON HUECOS, EL MÍNIMO DE LOS TRES MANDA.** Con 3 huecos no se ofrecen 20
      //  aperturas aunque haya 99 cajas y el tope del lote sea 20.
      check('lote: con tres huecos no se ofrecen mas de tres, por muchas cajas que haya',
        maximoDeApertura(99, 3) === 3,
        `huecos=3 con 99 cajas=${maximoDeApertura(99, 3)}`);

      // **UN HUECO BASTA PARA UNA CAJA.** Cada apertura consume una caja y trae como mucho
      //  un item, así que lo peor es un hueco por apertura: con uno libre siempre se puede
      //  abrir una, y por eso el límite no es "huecos más uno".
      check('lote: con un hueco basta para abrir una',
        maximoDeApertura(99, 1) === 1,
        `huecos=1=${maximoDeApertura(99, 1)}`);

      // **NO SE PIDE SABER EL ALMACÉN PARA QUE LA FUNCIÓN SIGA SIENDO LA DE LAS CAJAS.**
      // El primer intento convirtió el valor por defecto en un cero y devolvía siempre 0:
      // una función de "cuántas puedo" que devuelve 0 no dice que no puedes, dice que no hay
      //  nada que hacer. Las llamadas que no saben el almacén siguen viendo el tope.
      check('lote: sin saber el espacio, la regla sigue siendo la de las cajas',
        maximoDeApertura(99) === MAX_APERTURA_LOTE && maximoDeApertura(8) === 8,
        `sin espacio 99=${maximoDeApertura(99)} ocho=${maximoDeApertura(8)}`);

      // **Y UN NÚMERO DE HUECOS RARO NO ROMPE NADA.** Un `NaN` o un negativo son cero
      // huecos, no un `NaN` de aperturas: el mismo motivo por el que las cajas se recortan.
      check('lote: huecos raros caen a cero, que es lo que significa',
        maximoDeApertura(20, NaN) === 0 && maximoDeApertura(20, -4) === 0,
        `NaN=${maximoDeApertura(20, NaN)} negativo=${maximoDeApertura(20, -4)}`);
    }
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
    // **YA NO HAY NIVELES, Y POR QUÉ LA FABRICA NO PIDE UNO.** El cristal es un
    // recurso: un nombre, una rareza y una cantidad. La fila real del botín
    // (`CRATE_LOOT`) construye exactamente esto —`amount` en unidades ya
    // convertidas y sin `materialTier`—, y una fábrica que añadiera un nivel
    // estaría probando un objeto que el juego ya no construye.
    const cri = (amount: number): CrateReward => ({
      kind: 'crystals', amount, name: CRISTAL_NOMBRE, label: `+${amount}`,
      details: 'x', rarity: 'Raro', icon: 'crystal', exclusive: false
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

    // **LOS CRISTALES SON UN RECURSO, Y POR QUÉ AHORA SOLO HAY UNA FILA.** Antes
    // esta comprobación miraba que el cristal T3 de la T3 y el de la T4 fueran dos
    // filas distintas, porque el material tenía nivel y cada nivel era otra cosa.
    // Sin niveles la clave de agrupación es **solo el tipo**: la fila de cristal
    // lleva un único nombre y una única rareza, así que tres premios de cristal son
    // tres filas o son una con la suma, y lo segundo es lo que quiere el jugador.
    //
    // **Y NO HAY UNA MITAD "PERO LAS DE DISTINTO NIVEL NO".** Esa comprobación era
    // media verdad: la clave de fila del cristal todavía lleva `materialTier ?? 1`,
    // que con el botín real siempre vale 1 porque ninguna entrada lo trae. Así que
    // el agrupamiento correcto hoy es el de una fila, y lo que se afirma aquí es
    // justo eso: tres premios de cristal se suman en una sola fila.
    const tresCri = resumenDePremios([cri(400), cri(600), cri(200)]);
    check('resumen: los cristales son UNA fila con la suma, porque son un recurso',
      tresCri.length === 1 && tresCri[0].total === 1200,
      JSON.stringify(tresCri.map(f => `${f.reward.name}:${f.total} en ${f.veces} veces`)));

    // **Y LA CIFRA QUE SUMA ES LA QUE DICE LA ETIQUETA.** El botín entrega unidades
    // ya convertidas —una caja da `rand(3n, 5n) × valorDeUnCristal(n)`— así que la
    // suma de la fila es unidades y no intentos. Confundir las dos cosas es el
    // error que haría que el jugador creyera que le sale un 1.000× más de lo que
    // sale, y es por eso que el banco mide la fila y no "lo que eso compra".
    check('resumen: y lo que suma son las unidades, no los intentos de mejora',
      tresCri[0].total === 1200 && Number(tresCri[0].reward.label.replace(/[^\d]/g, '')) === 400,
      `total=${tresCri[0].total} etiqueta="${tresCri[0].reward.label}"`);

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
      nanita(900), nanita(700), cri(3), caja(2, 1), dron('d1'), dron('d2'), caja(2, 1)
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

    // **EL CASO REAL, PERO CON LOS PREMIOS HECHOS A MANO Y SIN TIRAR EL DADO.**
    //
    // Esta prueba.openCrateBox() veinte veces y miraba que salieran **menos filas que
    // premios**, que es lo que quiere decir "se agrupan". Con veinte cajas T1 el dado
    // puede dar cero nanitas, o una sola: en los dos casos no se agrupa nada y la
    // cuenta de filas se queda en veinte. **Era una prueba que dependia del dado**, y
    // caia un 9 % de las veces --una de cada once-- sin que hubiera cambiado el codigo.
    //
    // La regla que de verdad importa no necesita azar: **los premios que se agrupan van
    // en una fila con la suma y el numero de veces**, y ninguna fila cuenta un premio
    // que no esta. Eso se comprueba con una lista construida aqui, y ademas se
    // comprueban los tres casos de golpe en vez de un caso y medio.
    const piezas: CrateReward[] = [
      ...[400, 900].map((amount) => ({
        kind: 'nanites', amount, name: 'Nanitas', label: '+n',
        details: '', rarity: 'Común', icon: 'bolt', exclusive: false
      } as any)),
      ...['r1', 'r2', 'r3'].map((id) => ({
        kind: 'collector', amount: 1, name: 'Pistola ' + id, label: 'Pistola ' + id,
        details: '', rarity: 'Común', icon: 'collector', tier: 1, exclusive: false
      } as any))
    ];
    const agrupadas = resumenDePremios(piezas);
    const filaNanitas = agrupadas.find(f => f.reward.kind === 'nanites');
    check('resumen: las dos filas de nanitas se funden en UNA',
      filaNanitas !== undefined && agrupadas.filter(f => f.reward.kind === 'nanites').length === 1,
      `filas=${agrupadas.length} nanitas=${agrupadas.filter(f => f.reward.kind === 'nanites').length}`);
    check('resumen: y la fila lleva la suma y el numero de veces',
      filaNanitas?.total === 1300 && (filaNanitas as any)?.veces === 2,
      `total=${filaNanitas?.total} veces=${(filaNanitas as any)?.veces}`);
    check('resumen: el agrupado hace MENOS filas, que es de lo que se trata',
      agrupadas.length < piezas.length,
      `filas=${agrupadas.length} de ${piezas.length}`);
    check('resumen: y ningun item se pierde ni se duplica',
      agrupadas.filter(f => f.reward.kind === 'collector').length === 3 &&
      agrupadas.reduce((s, f) => s + (f.veces ?? 1), 0) === piezas.length,
      `cole=${agrupadas.filter(f => f.reward.kind === 'collector').length} ` +
      `total=${agrupadas.reduce((s, f) => s + (f.veces ?? 1), 0)}`);

    // Y el caso de verdad, **sin afirmar nada que dependa del dado**: con veinte cajas
    // reales la suma por fila tiene que ser la suma de los premios.
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
    check('resumen: veinte cajas reales dan menos filas que premios',
      filas.length <= reales.length, `filas=${filas.length} de ${reales.length}`);

    // **LAS ESTRELLAS EN LA FILA DEL OBJETO (F64).** Un recolector o un
    // compañero sin su potencial es una fila a medias. Salen de la misma
    // función que pinta la rejilla, y la regla es qué fila las lleva.
    const arma3: any = { kind: 'collector', name: 'X', label: 'X', details: '', rarity: 'Común', icon: 'collector', tier: 1, potential: 3, exclusive: false };
    const dron5: any = { kind: 'companion', name: 'Y', label: 'Y', details: '', rarity: 'Común', icon: 'companion', tier: 1, potential: 5, exclusive: false };
    const moneda: any = { kind: 'nanites', amount: 1, name: 'Nanitas', label: '+1', details: '', rarity: 'Común', icon: 'bolt', exclusive: false };
    const sinCampo: any = { kind: 'collector', name: 'Z', label: 'Z', details: '', rarity: 'Común', icon: 'collector', tier: 1, exclusive: false };
    check('resumen: el recolector enseña sus tres estrellas',
      estrellasDeFila(arma3) === '★★★', estrellasDeFila(arma3));
    check('resumen: y el compañero sus cinco',
      estrellasDeFila(dron5) === '★★★★★', estrellasDeFila(dron5));
    check('resumen: las nanitas no llevan estrellas',
      estrellasDeFila(moneda) === '', 'llevan');
    check('resumen: y sin el campo no se inventa ninguna',
      estrellasDeFila(sinCampo) === '', 'inventa');
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

  // -------------------------------------------------------------------------
  //  5. EL VETO DEL MOTOR: NINGÚN PREMIO SE PIERDE EN SILENCIO
  // -------------------------------------------------------------------------
  //
  //  El tope del lote es una cortesía; esto es la garantía. Aunque alguien llame a
  //  `openCrateBox()` directamente saltándose el diálogo —y el almacén, el admin y los bancos
  //  lo hacen—, **una caja cuyo botín no cabe no se abre**, y se dice por qué.
  {
    // **CON UNA PILA Y EL ALMACÉN LLENO, NO SE ABRE.** La caja está en una celda con otras, así
    //  que consumir una unidad no libera ninguna ranura y el premio no tendría dónde entrar.
    // **LA CAPACIDAD CUENTA LA CAJA.** Con seis recolectores y una caja en un almacén de seis
    // ranuras, la caja no cabe y `enforceWarehouseCapacity()` la tira: el primer fixture
    // fallaba con un "no está en el almacén" que no tenía nada que ver con lo que se
    // probaba. Siete ranuras para siete items es un almacén **lleno**, que es lo que hace
    // falta.
    const lleno = 6;
    const g = await boot(baseSave([
      crate('pila', 2, 5),
      ...Array.from({ length: lleno }, (_, i) => collector(`lleno${i}`, 1))
    ], { nanites: 0, warehouseCapacity: 7 }));
    const antes = ids(g).length;
    check('caja: el fixture esta lleno de verdad, con la caja dentro',
      antes === 7 && wh(g).some((w: any) => w.type === 'crate'),
      `items=${antes} ids=${ids(g).join(',')}`);
    // **EL ID DE LA PILA, LEÍDO DEL ALMACÉN Y NO ESCRITO A MANO.** El helper del banco compone
    // el id de la caja, y escribirlo a mano fue como esta comprobación empezaba a fallar con
    // un "no está en el almacén" que no tenía nada que ver con lo que estaba probando.
    const todos = ids(g);
    const idPila = todos.find((i: string) => wh(g).find((w: any) => w.id === i)?.type === 'crate')!;
    const r = g.openCrateBox(idPila);
    check('caja: con el almacen lleno y la caja en pila, no se abre',
      r.ok === false && /espacio/i.test(r.msg ?? ''),
      `ids=${todos.join(',')} id=${idPila} ok=${r.ok} msg=${r.msg ?? ''}`);
    check('caja: y no se gasta la caja, porque no se ha abierto nada',
      ids(g).length === antes, `antes=${antes} despues=${ids(g).length}`);

    // **CON UN HUECO, SÍ.** Un hueco basta: la apertura consume una caja y trae como mucho un
    // item, así que con uno libre siempre cabe.
    const conHueco = await boot(baseSave([
      crate('suelta', 2, 1),
      ...Array.from({ length: 5 }, (_, i) => collector(`c${i}`, 1))
    ], { nanites: 0, warehouseCapacity: 6 }));
    const rLibre = conHueco.openCrateBox('suelta');
    check('caja: con un hueco libre si se puede abrir',
      rLibre.ok === true,
      `ok=${rLibre.ok} msg=${rLibre.msg ?? ''}`);

    // **Y CON LA CAJA SOLTA NO HACE FALTA NI UN HUECO**, porque su propia celda se libera al
    // consumirla. Esa es la razón de que el veto mire las dos cosas y no solo el espacio.
    const sola = await boot(baseSave([
      crate('sola', 2, 1),
      ...Array.from({ length: 5 }, (_, i) => collector(`d${i}`, 1))
    ], { nanites: 0, warehouseCapacity: 6 }));
    const rSola = sola.openCrateBox('sola');
    check('caja: una caja sola se abre sin hueco, porque libera su celda',
      rSola.ok === true,
      `ok=${rSola.ok} msg=${rSola.msg ?? ''}`);
  }

  resumen('lote: compra multiple, tope de apertura y la lista de lo que salió');
}

export default main();
