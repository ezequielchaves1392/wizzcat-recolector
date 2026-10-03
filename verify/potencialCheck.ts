// ==========================================================================
//  LA ESCALA DE CALIDAD: EL POTENCIAL, Y SOLO EL POTENCIAL
//
//  Este banco comprueba una decisión de diseño que se puede decir en tres frases
//  y que antes estaba repartida por el código sin estar escrita en ningún sitio:
//
//    1. No existe una rareza por encima de `Divino`, ni una marca de
//       "sobrecargado". La calidad de un item la dice su potencial, de 1 a 5.
//    2. El potencial decide el poder de los COMPAÑEROS, igual que ya decidía el
//       daño de los recolectores. Antes el compañero de caja era un número
//       suelto dentro del rango y no tenía estrellas: la mitad de los objetos de
//       tier del almacén no traían la escala.
//    3. El expansor que suelta la caja T{n} es el T{n}, porque con el techo por
//       tier el expansor T3 —que era el único que salía de las cajas altas—
//       dejó de servir a los 30 ranuras y era botín muerto.
//
//  Y que la leyenda de una caja y la de una llave **digan la regla y no la
//  lista**, porque enumerar era justo lo que se quedaba viejo.
// ==========================================================================

import { boot, bootNew, reload, check, resumen, wh, baseSave, crate, key } from './kit';
import { RARITY_ORDER } from '../src/types/domain';
import { CRATE_TYPES, EXPANSOR_TIERS, CONSUMABLES } from '../src/data/store';
import { KEY_TIERS } from '../src/data/items';
import { KEY_DEFS } from '../src/data/items';
import {
  RARITY_RANK, RARITY_TEXT, RARITY_BORDER, RARITY_GLOW, raritySlug,
  CRATE_LOOT, tablaDePesos
} from '../src/components/crateLoot';
import { CRATE_TIERS } from '../src/data/store';
import { generateCompanionByTier } from '../src/data/generators';
import { rangoDePoder } from '../src/data/tiers';
import { danioDeRango, potencialNormalizado, potencialYDanoDe, AFIX_MIN_POR_RARIDAD, AFIX_MAX, poderDeCompanero } from '../src/data/crafting';


/** ¿Coincide el ★3 con el punto medio del rango en los diez tiers? */
function medioCoincide(): boolean {
  for (let tier = 1; tier <= 10; tier++) {
    const [min, max] = rangoDePoder(tier);
    if (Math.abs(poderDeCompanero(tier, 3) - (min + max) / 2) > 1) return false;
  }
  return true;
}

async function main() {
  // -------------------------------------------------------------------------
  //  1. LA RAREZA SE ACABÓ EN DIVINO
  // -------------------------------------------------------------------------
  {
    check('potencial: no hay una septima rareza',
      RARITY_ORDER.length === 6 && RARITY_ORDER[5] === 'Divino',
      RARITY_ORDER.join(', '));
    check('potencial: y ninguna se llama Sobrecargado',
      !RARITY_ORDER.some(r => /sobrecarg/i.test(r)),
      RARITY_ORDER.join(', '));
    check('potencial: el rango de rareza también acaba en 5',
      RARITY_RANK['Divino'] === 5 && Object.keys(RARITY_RANK).length === 6,
      JSON.stringify(RARITY_RANK));

    // Y los tres mapas de color, que es donde una rareza retirada se queda
    // escribiendo sin que nadie lo note: un item con la rareza vieja saldría sin
    // color en vez de con el de `Común`.
    const sinColor = RARITY_ORDER.filter(r => !RARITY_TEXT[r] || !RARITY_BORDER[r] || !(r in RARITY_GLOW));
    check('potencial: las seis rarezas tienen color, borde y glow',
      sinColor.length === 0, `sin: ${sinColor.join(',') || 'ninguna'}`);
    check('potencial: y el slug sale del nombre, sin sufijos raros',
      raritySlug('Divino') === 'divino' && raritySlug('Sobrecargado') === 'sobrecargado',
      `${raritySlug('Divino')} / ${raritySlug('Sobrecargado')}`);
  }

  // -------------------------------------------------------------------------
  //  2. EL POTENCIAL DEL COMPAÑERO: LA POSICIÓN EN EL RANGO
  // -------------------------------------------------------------------------
  {
    let fallos = 0;
    let detalle = '';
    for (let tier = 1; tier <= 10; tier++) {
      const [min, max] = rangoDePoder(tier);
      const p1 = poderDeCompanero(tier, 1);
      const p3 = poderDeCompanero(tier, 3);
      const p5 = poderDeCompanero(tier, 5);
      if (p1 !== min || p5 !== max || !(p1 <= p3 && p3 <= p5)) {
        fallos++;
        detalle += `T${tier}: ${p1}/${p3}/${p5} vs [${min},${max}] `;
      }
    }
    check('potencial: el compañero ★1 es el suelo del rango y el ★5 el techo',
      fallos === 0, detalle || 'los diez tiers');

    // Y el orden entre tiers es estricto: el techo del T{n} es menor que el suelo
    // del T{n+1}, así que subir de tier mejora con potencial o sin él. Sin esto,
    // buscar potencial sería mejor que subir de caja.
    let cruces = 0;
    const detalle2: string[] = [];
    for (let tier = 1; tier < 10; tier++) {
      const techo = rangoDePoder(tier)[1];
      const suelo = rangoDePoder(tier + 1)[0];
      if (techo >= suelo) { cruces++; detalle2.push(`T${tier}→T${tier + 1}`); }
    }
    check('potencial: el mejor de un tier no iguala al peor del siguiente',
      cruces === 0, `${cruces} cruces: ${detalle2.join(',')}`);

    // El potencial 3 es el punto medio del rango, que es lo que daba de media el
    // `rand(min, max)` de antes: **la esperanza del compañero no cambia**, lo que
    // cambia es la diferencia entre dos del mismo tier. Es lo que hace que la caja
    // sea una lotería con premio y no solo ruido.
    check('potencial: el ★3 cae en el punto medio del rango',
      medioCoincide(), 'varios tiers no coinciden');

    // Y el recorte es el mismo que el del recolector: es la misma lotería.
    check('potencial: un potencial fuera de 1..5 vale 3, no explota',
      potencialNormalizado(0) === 3 && potencialNormalizado(9) === 3 &&
      potencialNormalizado(undefined) === 3 && potencialNormalizado(5) === 5,
      `${potencialNormalizado(0)}/${potencialNormalizado(9)}/${potencialNormalizado(undefined)}`);
  }

  // -------------------------------------------------------------------------
// 3. LOS COMPAÑEROS DE VERDAD LLEVAN POTENCIAL
  //
  // **DESDE F31 LOS COMPAÑEROS SOLO SALEN DE CAJAS** (las veinte cartas de tier
  // se quitaron de la tienda), así que aquí no se compra nada: se abre. Y la
  // función que los construye es la misma para la tienda y para la caja, así que
  // comprobar `generateCompanionByTier()` es comprobar las dos.
  {
    // La puerta de la regla: el generador siempre devuelve potencial 1..5, y el
    // poder sale del rango con ese potencial, nunca de un dado suelto.
    let fallos = 0;
    let detalle = '';
    const vistos = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const c = generateCompanionByTier(5);
      vistos.add(c.potential);
      const [min, max] = rangoDePoder(5);
      if (c.power !== poderDeCompanero(5, c.potential) || c.power < min || c.power > max) {
        fallos++;
        if (detalle.length < 80) detalle += `pot${c.potential}/p${c.power} `;
      }
    }
    check('potencial: el generador da potencial 1..5 y el poder sale del rango',
      fallos === 0, `${fallos} fallos · ${detalle}`);
    check('potencial: y sale más de un potencial en 300 tiradas',
      vistos.size >= 3, `vistos: ${[...vistos].sort().join(',')}`);

    // La caja: cuarenta aperturas tienen que dar compañeros con potencial y dentro
    // del rango **de su propio tier**.
    //
    // **EL SALTO SE CUENTA CON SU TIER, NO CON EL DE LA CAJA.** La entrada `up`
    // devuelve un compañero de `crateType + 1`, y su poder está en el rango del
    // T2 aunque salga de una caja T1. Comparar todos los compañeros contra el rango
    // de la caja que los soltó daría un falso positivo justo con la sorpresa, que
    // es la única entrada que puede salir de un tier.
    const g = await boot(baseSave([crate('c1', 1, 40), key('k1', 1, 40)],
      { nanites: 0, warehouseCapacity: 60 }));
    let n = 0;
    let conPot = 0;
    let fueraDeRango = 0;
    const tiersVistos = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const r: any = g.openCrateBox('c1', 'k1');
      if (!r.ok || !r.reward || r.reward.kind !== 'companion') continue;
      n++;
      const it = r.reward.item;
      const tierDelItem = r.reward.tier ?? 1;
      tiersVistos.add(tierDelItem);
      if (typeof it?.potential === 'number') conPot++;
      const [min, max] = rangoDePoder(tierDelItem);
      if (it && (it.power < min || it.power > max)) fueraDeRango++;
    }
    check('potencial: los compañeros de caja traen potencial y están en su rango',
      n > 0 && conPot === n && fueraDeRango === 0,
      `${conPot}/${n} con potencial · ${fueraDeRango} fuera de rango`);
    check('potencial: y el salto sale con su propio tier (1 o 2)',
      [...tiersVistos].every(t => t === 1 || t === 2) && tiersVistos.size >= 1,
      `tiers vistos: ${[...tiersVistos].sort().join(',')}`);

    // Y el compañero que trae la partida. **NO SE PUEDE LEER DEL ESTADO INICIAL**
    // porque cargar un guardado lo pisa: `boot({})` deja `companions: []`, que es
    // una partida sin compañeros, no una nueva. La única vez que el juego escribe
    // `baseCompanion` es al reconstruir la partida en la Ascensión, así que es
    // ahí donde se comprueba: y se comprueban **las dos mitades**, la ficha de
    // `state.companions` y el item del almacén, porque son el mismo compañero y
    // antes decían números distintos.
    const g3 = await boot(baseSave([], {
      totalNanitesProduced: 1_000_000_000,
      totalCores: 0,
      cores: 0,
      resets: 0
    }));
    const asc = g3.prestige();
    check('potencial: la asension se puede hacer para montar el caso',
      asc?.success === true, `msg=${asc?.msg ?? ''} ok=${asc?.success}`);
    const g4 = await reload();
    const inicial = (g4.getState().companions as any[])[0];
    const suItem = (wh(g4) as any[]).find((w: any) => w.id === 'companion_base_001');
    // **★1, QUE ES EL SUELO DEL RANGO, Y POR ESO EL PODER ES 5 Y NO 6.** El
    // compañero de partida pasó de ★3 a ★1 para que el jugador empiece con todo
    // el recorrido por delante: si naciera en el punto medio no tendría nada que
    // mejorar. El poder sale de `poderDeCompanero(1, 1)`, o sea el suelo del
    // rango del T1, y el número no se escribe: si la escala del T1 cambiara, esta
    // comprobación sigue siendo la cuenta y no una memorización del 6 de antes.
    check('potencial: el compañero de partida es un T1 de verdad, y ★1',
      !!inicial && inicial.potential === 1 && inicial.power === poderDeCompanero(1, 1),
      `pot=${inicial?.potential} power=${inicial?.power} esperado=${poderDeCompanero(1, 1)}`);
    check('potencial: y el item del almacén dice lo mismo que la ficha',
      !!inicial && !!suItem
        && suItem.potential === inicial.potential
        && suItem.details.includes(String(inicial.power)),
`item=${JSON.stringify({ pot: suItem?.potential, det: suItem?.details })} ficha=${JSON.stringify({ pot: inicial?.potential, power: inicial?.power })}`);
  }

  // -------------------------------------------------------------------------
  //  4. EL RECOLECTOR DE CAJA ES UN RECOLECTOR NORMAL
  // -------------------------------------------------------------------------
  {
    const g = await boot(baseSave([crate('c3', 3, 40), key('k3', 3, 40)],
      { nanites: 0, warehouseCapacity: 60 }));
    let n = 0;
    let sinPot = 0;
    let sobrecargados = 0;
    let fueraDeDano = 0;
    for (let i = 0; i < 40; i++) {
      const r: any = g.openCrateBox('c3', 'k3');
      if (!r.ok || !r.reward || r.reward.kind !== 'collector') continue;
      n++;
      const it = r.reward.item;
      if (typeof it?.potential !== 'number') sinPot++;
      if (/sobrecargado/i.test(it?.rarity ?? '') || it?.overclock) sobrecargados++;
      // El salto sale con SU tier, no con el de la caja: un T4 de una caja T3
      // tiene el daño de un T4, y medirlo contra T3 daría un fallo falso justo en
      // la única entrada que puede cambiar de tier.
      const tierDelItem = r.reward.tier ?? 3;
      if (it?.damage !== danioDeRango(tierDelItem, it?.potential)) fueraDeDano++;
    }
    check('potencial: el recolector de caja es normal y trae potencial',
      n > 0 && sinPot === 0, `${sinPot}/${n} sin potencial de ${n}`);
    check('potencial: y no sale ninguna rareza por encima de Divino',
      sobrecargados === 0, `${sobrecargados} sobrecargados de ${n}`);
    check('potencial: su daño es danioDeRango(tier, potencial), sin sobrecarga encima',
      fueraDeDano === 0, `${fueraDeDano} de ${n} con daño que no cuadra`);
    check('potencial: la caja T3 sigue teniendo entrada de recolector',
      CRATE_LOOT[3].some((e: any) => e.id === 'collector'),
      CRATE_LOOT[3].map((e: any) => e.id).join(','));

    // **Y AHORA LAS DIEZ, Y POR QUÉ ESTO NO ES UN ADORNO.**
    //
    // La entrada de recolector estaba detrás de un `if (tier >= 3)`, así que una
    // caja T1 **no podía dar un arma T1**. La consecuencia no era "la caja T1 es
    // más pobre": era que el jugador que solo puede comprar cajas T1 **no tenía
    // forma de conseguir material para la forja**, porque no se compra en la tienda
    // y la caja era la única puerta. Y la forja son dos del mismo tier.
    const sinArma = CRATE_TIERS.filter((t: any) =>
      !CRATE_LOOT[t].some((e: any) => e.id === 'collector'));
    check('potencial: TODAS las cajas dan recolectores, la T1 incluida',
      sinArma.length === 0,
      `sin entrada de recolector: ${sinArma.join(',')} · ` +
      `ids de la T1: ${CRATE_LOOT[1].map((e: any) => e.id).join(',')}`);

    // Y no solo tiene la entrada: el peso es el que decide la probabilidad real, y
    // una entrada con peso cero es una entrada que no sale nunca. Este es el banco
    // que lo mide, porque `tablaDePesos` es la misma que usa el sorteo.
    const pesosT1 = tablaDePesos(1);
    const pesoArmaT1 = pesosT1[CRATE_LOOT[1].findIndex((e: any) => e.id === 'collector')];
    const pesoCompT1 = pesosT1[CRATE_LOOT[1].findIndex((e: any) => e.id === 'companion')];
    const totalT1 = pesosT1.reduce((a: number, b: number) => a + b, 0);
    check('potencial: y el arma de la T1 sale con un peso de verdad, no con un cero',
      (pesoArmaT1 ?? 0) > 0 && (pesoCompT1 ?? 0) > 0,
      `arma=${pesoArmaT1} compañero=${pesoCompT1} de ${totalT1}`);
    check('potencial: y arma y compañero pesan más que la caja siguiente',
      (pesoArmaT1 ?? 0) > (pesosT1[CRATE_LOOT[1].findIndex((e: any) => e.id === 'nextCrate')] ?? 0),
      `arma=${pesoArmaT1} siguiente=${pesosT1[CRATE_LOOT[1].findIndex((e: any) => e.id === 'nextCrate')]}`);
  }

  // -------------------------------------------------------------------------
  //  5. EL EXPANSOR DE LA CAJA ES EL DE SU TIER
  // -------------------------------------------------------------------------
  {
    let fallos = 0;
    let detalle = '';
    for (const tier of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const) {
      const entrada = CRATE_LOOT[tier].find((e: any) => e.id === 'expansor');
      if (!entrada) { fallos++; detalle += `T${tier}: sin entrada `; continue; }
      const p: any = entrada.build({ ownedCosmetics: [] });
      if (p.item?.buffId !== `expansorT${tier}`) {
        fallos++;
        detalle += `T${tier}: dio ${p.item?.buffId} `;
      }
    }
    check('expansor: la caja T{n} suelta el expansor T{n}',
      fallos === 0, detalle || 'los diez tiers');

    // Y con el techo nuevo, cada expansor sirve para un peldaño y se muere: los
    // diez dan la escalera entera de 15 a 65.
    const total = EXPANSOR_TIERS.reduce((a, e) => a + e.slots, 0);
    check('expansor: los diez dan la escalera entera, de 15 a 65',
      EXPANSOR_TIERS[0].maxCap === 20 && EXPANSOR_TIERS[9].maxCap === 65 && total === 50,
      `${EXPANSOR_TIERS[0].maxCap}..${EXPANSOR_TIERS[9].maxCap} · ${total} ranuras`);

    // Y la ficha del expansor DICE su techo: es lo que contesta "¿me sirve?" sin
    // que el jugador tenga que abrir el almacén.
    const sinTecho = EXPANSOR_TIERS.filter(e => {
      const def = CONSUMABLES[e.buffId] as { details: string } | undefined;
      return !def || !def.details.includes(String(e.maxCap));
    });
    check('expansor: el texto de cada expansor enseña su techo',
      sinTecho.length === 0,
      sinTecho.map(e => `T${e.tier}`).join(',') || 'los diez');
  }

  // -------------------------------------------------------------------------
  //  6. LAS LEYENDAS DICEN LA REGLA, NO LA LISTA
  // -------------------------------------------------------------------------
  {
    const textos = KEY_TIERS.map(t => KEY_DEFS[t].details);
    check('leyenda: ninguna llave nombra una caja',
      !textos.some(d => /Caja T/.test(d)), textos.join(' | '));
    check('leyenda: las diez llaves dicen la regla de su tier',
      textos.every(d => d.includes('su tier')),
      textos.join(' | '));
    check('leyenda: y solo la T10 dice que no hay nada más abajo',
      textos.filter(d => d.includes('menor')).length === 9,
      `${textos.filter(d => d.includes('menor')).length} de 9`);

    // Y las diez cajas dicen lo MISMO, que es la prueba de que la leyenda no es
    // una copia del botín: si un día una caja cambia su texto, se ve aquí.
    const deCajas = KEY_TIERS.map(t => CRATE_TYPES[t].details);
    check('leyenda: las diez cajas dicen la MISMA regla',
      new Set(deCajas).size === 1 && deCajas[0].includes('llave'),
      `${new Set(deCajas).size} textos distintos`);
    check('leyenda: y no enumera el botín',
      !/cristal|compa|recolector|Nanitas|llave de la T/i.test(deCajas[0]),
      deCajas[0]);
  }

  // -------------------------------------------------------------------------
  //  7. LOS AFIJOS: EL TOPO LO LLEVA DIVINO
  // -------------------------------------------------------------------------
  {
    check('afijos: Divino lleva el tope entero de afijos',
      AFIX_MIN_POR_RARIDAD['Divino'] === AFIX_MAX,
      `Divino=${AFIX_MIN_POR_RARIDAD['Divino']} AFIX_MAX=${AFIX_MAX}`);
    check('afijos: y hay un peldaño por rareza, ni uno más ni uno menos',
      Object.keys(AFIX_MIN_POR_RARIDAD).length === RARITY_ORDER.length,
      `${Object.keys(AFIX_MIN_POR_RARIDAD).length} peldaños, ${RARITY_ORDER.length} rarezas`);
  }

// -------------------------------------------------------------------------
  //  8. G4 · NINGÚN ITEM DEL JUEGO SE QUEDA SIN POTENCIAL
  // -------------------------------------------------------------------------
//  Este es el banco que hacía falta y que no existía. Todo lo demás comprueba
//  generadores sueltos: "este generador tira potencial". Eso deja pasar el caso
//  que de verdad se Quejó el jugador, que **no es un generador**, es el resto.
//
//  Un item escrito a mano —el Blaser de partida— no pasa por ningún generador, y
//  una partida vieja tampoco. Los dos se colaban por el mismo hueco: nadie mira
//  un objeto literal, y a un item guardado no se le puede preguntar a su
//  generador.
//
//  Así que la pregunta no es "este generador está bien" sino **"en este almacén,
//  ¿algún item incumple?"**, que es la pregunta del jugador.
{
  const sucios = (g: any) =>
    wh(g)
      .filter((w: any) => w.type === 'collector')
      .filter((w: any) =>
        typeof w.potential !== 'number'
        || w.potential < 1 || w.potential > 5
        || w.damage !== danioDeRango(w.tier ?? 1, w.potential));

  // 1. Una partida nueva, tal cual. El Blaser de partida es el item que pediste.
  {
    const g = await bootNew();
    const colector = wh(g).find((w: any) => w.type === 'collector');
    check('G4: el recolector de partida nace con potencial',
      typeof colector?.potential === 'number' && colector.potential >= 1 && colector.potential <= 5,
      `potential=${colector?.potential}`);
    check('G4: y su daño es el de esas estrellas, no un número suelto',
      colector?.damage === danioDeRango(1, colector?.potential),
      `daño=${colector?.damage} · el ★${colector?.potential} de T1 es ${danioDeRango(1, colector?.potential)}`);
    check('G4: y lo que se pinta dice lo mismo que el daño',
      colector?.details === `Recolección por click: +${colector?.damage}`,
      `details="${colector?.details}" daño=${colector?.damage}`);
    check('G4: y el almacén entero está limpio',
      sucios(g).length === 0,
      sucios(g).map((w: any) => `${w.id}:★${w.potential} daño=${w.damage}`).join(' '));
  }

  // 2. Y el compañero también. Su poder es la posición en el rango del tier, así
  // que no se deduce de un número: se le da ★3, que es lo que ya se leía antes.
  {
    const g = await bootNew();
    const comp = (g.getState() as any).companions?.[0];
    check('G4: el compañero de partida nace con potencial',
      typeof comp?.potential === 'number' && comp.potential >= 1 && comp.potential <= 5,
      `potential=${comp?.potential}`);
    const ficha = wh(g).find((w: any) => w.type === 'companion');
    check('G4: y su ficha dice lo mismo que el compañero real',
      ficha?.potential === comp?.potential,
      `ficha=${ficha?.potential} compañero=${comp?.potential}`);
    check('G4: y la ficha enseña el poder REAL, no un número escrito a mano',
      ficha?.details === `Recolección por segundo: +${comp?.power}/s`,
      `details="${ficha?.details}" · el compañero vale ${comp?.power}`);
  }

  // 3. Una partida VIEJA: sin potencial, con el daño de la escala de antes. Es el
  //    caso que no lo cubre ningún generador porque no viene de ninguno.
  {
    const g = await boot(baseSave([
      crate('c1', 1, 5),
      // T3 con daño 15, que es donde lo ponía el juego antes de la escala.
      { id: 'v1', name: 'Blaster Láser', type: 'collector', details: 'Recolección por click: +15',
        rarity: 'Común', tier: 3, level: 0, damage: 15, sellPrice: 250 },
      { id: 'v2', name: 'Blaster Láser', type: 'collector', details: 'Recolección por click: +19',
        rarity: 'Común', tier: 3, level: 0, damage: 19, sellPrice: 250 }
    ], { nanites: 0, warehouseCapacity: 20 }));
    check('G4: los items viejos reciben potencial al cargar',
      sucios(g).length === 0,
      sucios(g).map((w: any) => `${w.id}:★${w.potential} daño=${w.damage} (el ★${w.potential} de T3 es ${danioDeRango(3, w.potential)})`).join(' '));
    // Y se guarda: una migración que no se escribe es una migración que se
    // repite en cada carga, y una que se repite puede acabar criando ★5 falsos.
    await g.flush();
    await new Promise((r) => setTimeout(r, 30));
    const g2 = await reload();
    check('G4: y lo arreglado se guarda, no se vuelve a arreglar cada vez',
      sucios(g2).length === 0,
      sucios(g2).map((w: any) => `${w.id}:★${w.potential} daño=${w.damage}`).join(' '));
  }

  // 4. Y lo que NO puede pasar: **que una migración le regale una mejora a
  //    alguien.** Es la diferencia entre "aplico la regla a lo viejo" y "subo el
  //    daño de quien llevaba más tiempo".
  //
  //    **LA REGLA ES "EL MÁS CERCANO", Y ESO SÍ PUEDE SUBIR.** Un daño 31 en un T3
  //    está más cerca del 32 (★2) que del 28 (★1), así que sube a 32. Redondear al
  //    más cercano no puede ser "nunca sube": sería mentira. Lo que sí garantiza
  //    son dos cosas, y son las que se comprueban aquí.
  {
    // A · El error es EL MÍNIMO de los cinco, siempre. Si algún día se cambia la
    //     regla de "más cercano" y se pasa a "el mayor que no pase", esto falla.
    let noMinimo = 0;
    for (let d = 1; d <= 600; d++) {
      const { potential, damage } = potencialYDanoDe(3, d);
      const errores = [1, 2, 3, 4, 5].map(p => Math.abs(danioDeRango(3, p) - d));
      if (Math.abs(damage - d) !== Math.min(...errores)) noMinimo++;
      void potential;
    }
    check('G4: la migración elige el potencial MÁS CERCANO, siempre',
      noMinimo === 0, `${noMinimo} de 600 daños no cogieron el más cercano`);

    // B · Y a EMPATE, EL MENOR. El 30 está a dos del 28 (★1) y a dos del 32 (★2):
    //    empate perfecto. Si cogiera el mayor, cada item de esa frontera ganaría
    //    dos de daño y la migración sería un regalo con forma de regla.
    const empate = potencialYDanoDe(3, 30);
    check('G4: y a empate gana el potencial MENOR, que es donde no hay regalo',
      empate.potential === 1 && empate.damage < 30,
      `30 → ★${empate.potential} daño=${empate.damage}`);

    // C · Y EL HECHO QUE HACE QUE ESTO SEA UNA DECISIÓN DE BALANCE Y NO UN
    //     RETOQUE, FIJADO POR UNA PRUEBA PARA QUE NO SE OLVIDE.
    //
    //     **LA ESCALA NUEVA ESTÁ ENTERA POR ENCIMA DE LA VIEJA.** Fijado con el T3:
    //     el rango del que salía un recolector viejo era de 13 a 19, y el suelo de
    //     la escala actual es 28. No hay ni un solo valor del rango viejo que
    //     llegue al nuevo suelo, así que **todos** los items viejos de T3 suben,
    //     y en los tiers altos el salto es mayor todavía.
    //
    //     Esto NO es un tope que se pueda comprobar con un "< medio escalón": se
    //     intentó y es falso, porque los dos juegos de números no se solapan. Lo
    //     que se puede comprobar —y lo que importa— es que el hecho siga siendo
    //     cierto, para que nadie lo descubra cuando ya haya pasado a ser historia.
    const rangoViejo = rangoDePoder(3);
    const sueloNuevo = danioDeRango(3, 1);
    check('G4: la escala nueva está por encima de la vieja: esto sube el daño viejo',
      rangoViejo[1] < sueloNuevo,
      `el T3 viejo llegaba a ${rangoViejo[1]} y el suelo nuevo es ${sueloNuevo}. ` +
      `TODOS los items viejos suben: decisión de balance, escrita en PENDIENTES.md`);
  }
}

resumen('la escala de calidad: el potencial y solo el potencial');
}

export default main();
