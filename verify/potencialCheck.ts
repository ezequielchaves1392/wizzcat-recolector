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

import { boot, bootNew, reload, check, resumen, s, wh, ids, baseSave, crate, key, collector, companion, ficha, crystal, consumable, conRoll } from './kit';
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
import { danioDeRango, potencialNormalizado, potencialYDanoDe, AFIX_MIN_POR_RARIDAD, AFIX_MAX, poderDeCompanero, nivelMaximoDeCompanio, costeDeNivelDeCompanio, multiplicadorDeNivel } from '../src/data/crafting';


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
  //  3b. LAS DOS MITADES DEL EQUIPO DE PARTIDA: RECOLECTOR Y COMPAÑERO
  // -------------------------------------------------------------------------
  //  **LO QUE PIDE EL JUGADOR NUEVO, Y LO QUE NO TENÍA PRUEBA.** Un T1 de arma con
  //  potencial 1 y un T1 de compañero con potencial 1, **los dos ya equipados**.
  //
  //  El compañero sí estaba comprobado —arriba, después de la Ascensión— y el
  //  recolector **no**. Que es la mitad exacta del encargo: una mitad probada y
  //  otra en la que nadie miraba.
  //
  //  **POR QUÉ "EQUIPADO" ESTÁ EN LA MISMA COMPROBACIÓN Y NO EN OTRA.** Lo
  //  equipado no es un detalle: es lo que hace que el primer clic de la partida
  //  cobre algo. Un arma de partida sin equipar es un minuto cero esperando a que
  //  el jugador adivine que tiene que tocar el arma, y eso no es una partida, es
  //  una pantalla muerta. Y el compañero sin equipar no da ingreso por segundo.
  //
  //  Y se comprueba **por el mismo camino que el juego**, que es el Ascenso: la
  //  partida nueva escribe su base desde las mismas fábricas, así que si el
  //  Ascensoconstruyera un equipo distinto del de partida nueva, alguien podría
  //  haber arreglado uno y no el otro. Se leen los dos del mismo sitio.
  {
    const g = await boot(baseSave([], {
      totalNanitesProduced: 1_000_000_000, totalCores: 0, cores: 0, resets: 0
    }));
    g.prestige();
    const g2 = await reload();
    const st: any = g2.getState();

    // El recolector: T1, ★1, y con la bandera de equipado puesta.
    const arma: any = (wh(g2) as any[]).find((w: any) => w.type === 'collector');
    check('equipo de partida: hay un arma, y es un T1 de ★1',
      !!arma && arma.tier === 1 && arma.potential === 1,
      `arma=${JSON.stringify(arma && { tier: arma.tier, pot: arma.potential, id: arma.id })}`);
    check('equipo de partida: y está equipada de origen',
      !!arma && st.equippedCollectorId === arma.id && arma.equipped === true,
      `equipped=${st.equippedCollectorId} bandera=${arma?.equipped}`);
    check('equipo de partida: su daño es el del suelo del T1, no un número escrito',
      !!arma && arma.damage === danioDeRango(1, 1),
      `daño=${arma?.damage} esperado=${danioDeRango(1, 1)}`);

    // El compañero: T1, ★1, activo.
    const comp: any = (st.companions as any[])[0];
    check('equipo de partida: hay un compañero, y es un T1 de ★1',
      !!comp && comp.tier === 1 && comp.potential === 1,
      `compañero=${JSON.stringify(comp && { tier: comp.tier, pot: comp.potential, id: comp.id })}`);
    check('equipo de partida: y está activo de origen',
      !!comp && (st.activeCompanions || []).includes(comp.id),
      `activos=${JSON.stringify(st.activeCompanions)}`);
    check('equipo de partida: y da ingreso, que es para lo que está',
      st.passiveIncome > 0, `pasivo=${st.passiveIncome}`);

    // **LOS DOS TIENEN QUE ESTAR A LA VEZ, Y ESO ES LO QUE NO SE COMPRUEBA SI SE
    // MIRA UNO SOLO.** Con el equipo vacío la partida arranca en cero sin que nada
    // falle, y el jugador ve un contador parado.
    check('equipo de partida: y están los DOS, que es lo que pedía el encargo',
      !!arma && !!comp && !!st.equippedCollectorId && (st.activeCompanions || []).length >= 1,
      `arma=${!!arma} companio=${!!comp} equipado=${!!st.equippedCollectorId} activos=${(st.activeCompanions || []).length}`);
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


// =========================================================================
//  EL COMPAÑERO SUBE DE NIVEL CON CRISTALES
// =========================================================================
//  Lo que se comprueba, y por qué cada cosa:
//
//  · Que el nivel **sube de verdad**: que el ingreso sube con él. Sin esto,
//    "subir de nivel" sería un número que crece y no hace nada, que es el peor
//    tipo de progreso que se puede añadir a un juego.
//  · Que **es la misma regla que el recolector**: mismo cristal por regla de F26,
//    misma curva de coste, misma probabilidad y **fallar no retrocede**. Escribir
//    una curva "para el compañero" es el error que produce dos reglas que un día
//    no coinciden.
//  · Que el techo lo pone **la misma función** que lo aplica, con la ficha como
//    fuente, y que un compañero de una partida vieja —sin `level` ni `maxLevel`—
//    los recibe.
//  · Y que **el rechazo no cuesta nada**, que es lo que protege al jugador.
// =========================================================================

// --- 1. El nivel sube y el ingreso sube con él --------------------------------
{
  const g = await boot(baseSave([
    companion('c1', 3, { potential: 5 }),
    crystal('x3', 3, 20)
  ], {
    nanites: 0, warehouseCapacity: 40, activeCompanions: ['c1'],
    companions: [ficha('c1', 3, { potential: 5 })]
  }));

  const antes: any = s(g).passiveIncome;
  const base = (s(g).companions as any[])[0];

  // Con el dado forzado a 0, el `%` sale 0 y siempre acierta.
  const r: any = conRoll(0, () => g.upgradeCompanion('c1'));
  check('nivel companero: con el cristal de su tier, sube de nivel',
    r.success === true && r.level === 1, `success=${r.success} nivel=${r.level} msg=${r.msg}`);

  const despues: any = s(g).passiveIncome;
  check('nivel companero: y el ingreso sube con el nivel, que es para lo que está',
    despues > antes,
    `antes=${antes} despues=${despues} poder=${base?.power} nivel=${(s(g).companions as any[])[0]?.level}`);

  // **Y EN LOS DOS SITIOS.** El array paga el ingreso y la ficha lo pinta. Escribir
  // una sola deja dos verdades sobre el mismo objeto.
  const arr: any = (s(g).companions as any[])[0];
  const fich: any = wh(g).find((w: any) => w.id === 'c1');
  check('nivel companero: el nivel queda en el array y en la ficha, iguales',
    arr?.level === 1 && fich?.level === 1, `array=${arr?.level} ficha=${fich?.level}`);
}

// --- 2. La misma regla que el recolector --------------------------------------
{
  // **F26: el cristal lo decide el tier y NO LLEGA COMO ARGUMENTO.** Un compañero
  // T3 con un cristal T1 tiene que rechazarse, igual que un recolector.
  const g = await boot(baseSave([
    companion('c1', 3, { potential: 3 }),
    crystal('x1', 1, 99)
  ], { nanites: 0, warehouseCapacity: 40, companions: [ficha('c1', 3, { potential: 3 })] }));
  const r: any = conRoll(0, () => g.upgradeCompanion('c1'));
  check('nivel companero: el cristal de otro tier no sirve, igual que el recolector',
    r.success === false && /No tienes/.test(r.msg ?? ''), r.msg ?? 'aceptado');
  check('nivel companero: y no sube de nivel',
    (s(g).companions as any[])[0]?.level === 0,
    `nivel=${(s(g).companions as any[])[0]?.level}`);

  // Y la curva de coste es **la misma función**: el primer nivel cuesta lo que
  // cuesta el del recolector, y el segundo más. Un número escrito aquí sería una
  // segunda curva que un día no coincidiría.
  const g2 = await boot(baseSave([
    companion('c1', 3, { potential: 3 }),
    crystal('x3', 3, 200)
  ], { nanites: 0, warehouseCapacity: 40, companions: [ficha('c1', 3, { potential: 3 })] }));
  // Se sube hasta el 4 y se compara lo gastado en cada salto contra lo que
  // dice `costeDeNivelDeCompanio()`, que es un alias de la curva del recolector.
  //
  // **NO SE COMPRUEBA QUE LA CURVA CREZCA NIVEL A NIVEL, PORQUE EN EL PRIMERO NO
  // CRECE:** `floor(1.2 × 1.26) = 1`, igual que el nivel 0. Esperar que el nivel 1
  // cueste más que el 0 es pedirle a la curva algo que no hace, y el banco fallaría
  // por una regla que está bien. Lo que se comprueba es que el número **sale de la
  // función**, que es lo que evita tener dos curvas.
  const gastados: number[] = [];
  for (let nivel = 0; nivel < 4; nivel++) {
    conRoll(0, () => g2.upgradeCompanion('c1'));
    const restantes = wh(g2).find((w: any) => w.id === 'x3')?.stackCount ?? 0;
    gastados.push(200 - restantes);
  }
  const esperado = gastados.map((_, i) => costeDeNivelDeCompanio(i));
  // **SE COMPARAN LOS SALTOS, NO EL TOTAL.** `gastados` es acumulado —lo que queda
  // fuera de la pila— y `esperado` es lo que cuesta *ese* nivel. Comparar los dos
  // así da un desfase de uno en cada término y parece que la curva está mal. Lo que
  // dice la regla es lo que cuesta **cada** subida, y eso es la diferencia entre
  // dos totales consecutivos.
  const porSalto = gastados.map((g, i) => g - (i === 0 ? 0 : gastados[i - 1]));
  check('nivel companero: el coste sale de la MISMA curva que el del recolector',
    porSalto.every((g, i) => g === esperado[i]) && esperado[3] > esperado[0],
    `por salto=[${porSalto.join(',')}] esperado=[${esperado.join(',')}]`);
}

// --- 3. Fallar no retrocede ----------------------------------------------------
{
  const g = await boot(baseSave([
    companion('c1', 3, { potential: 3 }),
    crystal('x3', 3, 50)
  ], { nanites: 0, warehouseCapacity: 40, companions: [ficha('c1', 3, { potential: 3 })] }));

  // Con el dado al 99 %, siempre falla, sin importar el nivel.
  const r: any = conRoll(0.99, () => g.upgradeCompanion('c1'));
  check('nivel companero: fallar se paga y se dice',
    r.success === false && r.rolled === true && /Fallo/.test(r.msg ?? ''), r.msg ?? 'no falló');
  check('nivel companero: y el nivel NO retrocede, que era el fallo viejo',
    (s(g).companions as any[])[0]?.level === 0,
    `nivel=${(s(g).companions as any[])[0]?.level}`);
}

// --- 4. El techo y el rechazo sin coste ---------------------------------------
{
  // El techo lo pone **la ficha**, y la ficha lo pone `nivelMaximoDeCompanio()`.
  const g = await boot(baseSave([
    companion('c1', 3, { potential: 1, level: 0, maxLevel: 3 }),
    crystal('x3', 3, 200)
  ], {
    nanites: 0, warehouseCapacity: 40,
    companions: [ficha('c1', 3, { potential: 1, level: 0, maxLevel: 3 })]
  }));

  let ok = 0;
  for (let i = 0; i < 6; i++) {
    const r: any = conRoll(0, () => g.upgradeCompanion('c1'));
    if (r.success) ok++;
    if (/nivel m/i.test(r.msg ?? '')) break;
  }
  const nivelFinal = (s(g).companions as any[])[0]?.level;
  check('nivel companero: llega al techo de la ficha y ahí para',
    ok === 3 && nivelFinal === 3, `subidas=${ok} nivel=${nivelFinal}`);
  const rTop: any = conRoll(0, () => g.upgradeCompanion('c1'));
  check('nivel companero: y en el techo responde "máximo", no cobra nada',
    rTop.success === false && /m/i.test(rTop.msg ?? ''), rTop.msg ?? 'aceptado');

  // **Un rechazo no cuesta nada.** Con cristales de sobra en la mano, que es donde
  // el orden importa: si la comprobación fuera después del cobro, el jugador
  // pagaría por una subida que no ocurrió.
  // **El rechazo es "ya está en el techo", no "no tengo cristales".** Con un
  // cristal y un coste de uno la operación ACIERTA, así que una comprobación de
  // "un rechazo no gasta nada" que acabe en éxito no comprueba nada. El techo en
  // cero da el rechazo que se repite cada vez que se vuelve a tocar el botón.
  const tope = nivelMaximoDeCompanio(3, 3);
  const g2 = await boot(baseSave([
    companion('c1', 3, { potential: 3, level: tope, maxLevel: tope }),
    crystal('x3', 3, 1)
  ], {
    nanites: 0, warehouseCapacity: 40,
    companions: [ficha('c1', 3, { potential: 3, level: tope, maxLevel: tope })]
  }));
  const antes = (wh(g2).find((w: any) => w.id === 'x3')?.stackCount) ?? 0;
  const r2: any = g2.upgradeCompanion('c1');
  check('nivel companero: un rechazo no gasta ni un cristal',
    r2.success === false && (wh(g2).find((w: any) => w.id === 'x3')?.stackCount ?? 0) === antes,
    `antes=${antes} msg=${r2.msg}`);

  const rNoExiste: any = g2.upgradeCompanion('no-existe');
  check('nivel companero: y un id que no existe se rechaza sin decir "undefined"',
    rNoExiste.success === false && !/undefined/.test(rNoExiste.msg ?? ''),
    rNoExiste.msg ?? '');
}

// --- 5. Una partida vieja recibe nivel y techo --------------------------------
{
  // **LO QUE NO SE COMPRUEBA SI NO SE MONTA A MANO.** Un compañero guardado antes
  // de esto no tiene `level` ni `maxLevel`, y sin migración el botón calcularía un
  // techo con una función y el motor aceptaría otro. Los bancos construyen su
  // propio estado, así que esta es la única forma de verlo.
  const g = await boot(baseSave([
    companion('c1', 3, { potential: 5 })
  ], { nanites: 0, warehouseCapacity: 40, companions: [ficha('c1', 3, { potential: 5 })] }));
  const arr: any = (s(g).companions as any[])[0];
  const fich: any = wh(g).find((w: any) => w.id === 'c1');
  check('nivel companero: una partida vieja recibe nivel 0',
    arr?.level === 0, `nivel=${arr?.level}`);
  check('nivel companero: y el techo que dice la función, en las dos mitades',
    arr?.maxLevel === nivelMaximoDeCompanio(5) && fich?.maxLevel === arr?.maxLevel,
    `array=${arr?.maxLevel} ficha=${fich?.maxLevel} esperado=${nivelMaximoDeCompanio(5)}`);
}

// --- 6. Y la regla se sostiene sola, sin subir más ------------------------------------
{
  // El multiplicador por nivel es **la misma función** que la del recolector, y el
  // poder guardado **no** lleva el nivel dentro. Si lo llevara, dejaría de ser "el
  // poder de un T3 con potencial 5" y los bancos que comparan contra
  // `poderDeCompanero()` empezarían a fallar sin explicación.
  // **EL INVARIANTE REAL: DESPUÉS DE SUBIR, EL PODER GUARDADO SIGUE SIENDO EL DE
  // BASE.** Si el nivel se escribiera dentro de `power`, dejaría de ser "el poder de
  // un T3 con potencial 5" y todos los bancos que comparan contra
  // `poderDeCompanero()` empezarían a fallar sin que nadie supiera por qué.
  const gGuardado = await boot(baseSave([
    companion('c1', 3, { potential: 5 }),
    crystal('x3', 3, 20)
  ], {
    nanites: 0, warehouseCapacity: 40, activeCompanions: ['c1'],
    companions: [ficha('c1', 3, { potential: 5, power: poderDeCompanero(3, 5) })]
  }));
  conRoll(0, () => gGuardado.upgradeCompanion('c1'));
  const guardado: any = (s(gGuardado).companions as any[])[0];
  check('nivel companero: el poder guardado es el de base, sin nivel dentro',
    guardado?.level === 1 && guardado?.power === poderDeCompanero(3, 5),
    `nivel=${guardado?.level} power=${guardado?.power} esperado=${poderDeCompanero(3, 5)}`);
  check('nivel companero: y el multiplicador por nivel es el mismo +10 %',
    multiplicadorDeNivel(0) === 1 && multiplicadorDeNivel(5) === 1.5,
    `nivel0=${multiplicadorDeNivel(0)} nivel5=${multiplicadorDeNivel(5)}`);
}
resumen('la escala de calidad: el potencial y solo el potencial');
}

export default main();
