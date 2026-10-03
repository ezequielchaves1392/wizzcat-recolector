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

import { boot, reload, check, resumen, wh, baseSave, crate, key } from './kit';
import { RARITY_ORDER } from '../src/types/domain';
import { CRATE_TYPES, EXPANSOR_TIERS, CONSUMABLES } from '../src/data/store';
import { KEY_TIERS } from '../src/data/items';
import { KEY_DEFS } from '../src/data/items';
import {
  RARITY_RANK, RARITY_TEXT, RARITY_BORDER, RARITY_GLOW, raritySlug,
  CRATE_LOOT
} from '../src/components/crateLoot';
import { poderDeCompanero, generateCompanionByTier } from '../src/data/generators';
import { rangoDePoder } from '../src/data/tiers';
import { danioDeRango, potencialNormalizado, AFIX_MIN_POR_RARIDAD, AFIX_MAX } from '../src/data/crafting';


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
    check('potencial: el compañero de partida es un T1 de verdad',
      !!inicial && inicial.potential === 3 && inicial.power === poderDeCompanero(1, 3),
      `pot=${inicial?.potential} power=${inicial?.power} esperado=${poderDeCompanero(1, 3)}`);
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

  resumen('la escala de calidad: el potencial y solo el potencial');
}

export default main();
