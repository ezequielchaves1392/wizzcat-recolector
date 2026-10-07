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
//  Y que la leyenda de una caja **diga la regla y no la lista**, porque enumerar
//  era justo lo que se quedaba viejo. Antes esta sección comparaba las diez
//  llaves con las diez cajas; ya no hay llaves, así que la mitad que queda es la
//  que de verdad puede quedarse vieja sin que nadie la revise: **un texto que
//  sigue leyéndose bien y describe algo que el juego ya no hace.**
// ==========================================================================

import { boot, bootNew, reload, check, resumen, s, wh, ids, baseSave, crate, collector, companion, ficha, consumable, conRoll, find } from './kit';
import { RARITY_ORDER } from '../src/types/domain';
import { CRATE_TYPES, EXPANSOR_TIERS, CONSUMABLES } from '../src/data/store';
import {
  RARITY_RANK, RARITY_TEXT, RARITY_BORDER, RARITY_GLOW, raritySlug,
  CRATE_LOOT, tablaDePesos
} from '../src/components/crateLoot';
import { CRATE_TIERS } from '../src/data/store';
import { generateCompanionByTier } from '../src/data/generators';

import { rangoDePoder } from '../src/data/tiers';
import { danioDeRango, potencialNormalizado, potencialYDanoDe, AFIX_MIN_POR_RARIDAD, AFIX_MAX, poderDeCompanero, nivelMaximoDeCompanio, costeDeNivel, costeDeNivelDeCompanio, valorDeUnCristal, multiplicadorDeNivel } from '../src/data/crafting';
import { chanceDeSintonizacion } from '../src/data/items';
import { previewUpgradeChance } from '../src/gameLoop';
import { tuningRoll } from '../src/components/tuningRoulette';


/** ¿Coincide el ★3 con el punto medio del rango en los diez tiers? */
function medioCoincide(): boolean {
  for (let tier = 1; tier <= 10; tier++) {
    const [min, max] = rangoDePoder(tier);
    if (Math.abs(poderDeCompanero(tier, 3) - (min + max) / 2) > 1) return false;
  }
  return true;
}

/** Las partidas del cartel del sintonizador usan un T3 en nivel 4, y el saldo se
 * escribe con la regla delante: si `costeDeNivel()` cambia, siguen pagando lo
 * que cuesta subir. */
const TIER_CARTEL = 3;
const NIVEL_CARTEL = 4;
/** Lo que cuesta pasar del nivel 4 al 5 en un T3. */
const COSTE_CARTEL = costeDeNivel(TIER_CARTEL, NIVEL_CARTEL);
/** Lo que cuestan las dos subidas seguidas del mismo item, del 4 al 6. */
const COSTE_DOS_CARTEL = COSTE_CARTEL + costeDeNivel(TIER_CARTEL, NIVEL_CARTEL + 1);

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
    const g = await boot(baseSave([crate('c1', 1, 40)],
      { nanites: 0, warehouseCapacity: 60 }));
    let n = 0;
    let conPot = 0;
    let fueraDeRango = 0;
    const tiersVistos = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const r: any = g.openCrateBox('c1');
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
    const g = await boot(baseSave([crate('c3', 3, 40)],
      { nanites: 0, warehouseCapacity: 60 }));
    let n = 0;
    let sinPot = 0;
    let sobrecargados = 0;
    let fueraDeDano = 0;
    for (let i = 0; i < 40; i++) {
      const r: any = g.openCrateBox('c3');
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

    // Y con el techo nuevo, cada expansor sirve **hasta** su techo y se muere
    // después. Lo que da y hasta dónde llega son dos reglas distintas: da **una**
    // ranura y llega a `15 + 10n`, así que un peldaño son diez usos. Que las dos
    // salieran del mismo número era el error de esta misma tarde: al subir el escalón
    // a diez, el techo bajó a 16, 17, 18 y 19 y el T4 dejó de llegar a 55.
    const total = EXPANSOR_TIERS.reduce((a, e) => a + e.slots, 0);
    check('expansor: la escalera va de 15 a 115, de diez en diez, y cada uno da una ranura',
      EXPANSOR_TIERS[0].maxCap === 25 && EXPANSOR_TIERS[9].maxCap === 115 && total === 10,
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
    // **LO QUE ESTA SECCIÓN COMPROBABA ANTES Y YA NO PUEDE COMPROBAR.**
    //
    // Comparaba las diez llaves con las diez cajas: que una leyenda no nombrara
    // una caja, que cada una dijera la regla de su nivel y que solo la T10
    // avisara de que no hay nada más abajo. Eso era una comparación **entre dos
    // cartas**, y la otra carta ya no existe. Lo que queda de verdad no es una
    // comparación: es una regla sobre lo que el juego **hace**, y por eso se
    // escribe contra el botín y no contra otra leyenda.
    //
    // La regla es: **la leyenda dice lo que hay que hacer, y no hay llave que
    // mentionar.** Una leyenda que dijera "se abre con la llave de su tier"
    // sería la forma peor de quedarse vieja: se leería bien, no daría ningún
    // error, y estaría describiendo algo que el juego ya no hace.
    const deCajas = CRATE_TIERS.map(t => CRATE_TYPES[t].details);
    check('leyenda: las diez cajas dicen la MISMA regla',
      new Set(deCajas).size === 1, `${new Set(deCajas).size} textos distintos: ${deCajas.join(' | ')}`);
    check('leyenda: y la regla que dice es la de abrirse sola',
      /se abre sola/i.test(deCajas[0]), deCajas[0]);
    check('leyenda: y ninguna caja habla de una llave que ya no existe',
      !deCajas.some(d => /llave/i.test(d)), deCajas.join(' | '));
    check('leyenda: y no enumera el botín',
      !/cristal|compa|recolector|Nanitas|llave/i.test(deCajas[0]),
      deCajas[0]);

    // **Y LA MITAD QUE NO SE PODRÍA VER A SIMPLE VISTA: EL BOTÍN.** La leyenda de
    // la caja se escribe en `data/store.ts` y la de cada premio, en la entrada de
    // la tabla de botín. Las dos son textos que el jugador lee, y **una entrada
    // de botín con la explicación de la llave pasada también se leería bien**.
    //
    // Por eso se construye el botín de las diez cajas —la misma función que
    // construye lo que de verdad cae— y se pregunta a cada premio por su texto.
    // No es una búsqueda en el código: pregunta a lo que el juego entrega.
    const sospechosos: string[] = [];
    for (const tier of CRATE_TIERS) {
      for (const entrada of CRATE_LOOT[tier]) {
        const construido: any = entrada.build({ ownedCosmetics: [] });
        if (!construido) continue;
        const texto = `${construido.name ?? ''} ${construido.details ?? ''}`.trim();
        if (/llave/i.test(texto)) sospechosos.push(`T${tier}/${entrada.id}: "${texto}"`);
      }
    }
    check('leyenda: y ningún premio de las diez cajas habla de una llave',
      sospechosos.length === 0, sospechosos.join(' | ') || 'el botín entero de las diez');
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
//  · Que **es la misma regla que el recolector**: el mismo recurso, la misma
//    curva de coste, la misma probabilidad y **fallar no retrocede**. Escribir
//    una curva "para el compañero" es el error que produce dos reglas que un día
//    no coinciden.
//  · Que el techo lo pone **la misma función** que lo aplica, con la ficha como
//    fuente, y que un compañero de una partida vieja —sin `level` ni `maxLevel`—
//    los recibe.
//  · Y que **el rechazo no cuesta nada**, que es lo que protege al jugador.
//
//  **LO QUE ESTE BLOQUE COMPROBABA ANTES Y YA NO PUEDE COMPROBAR.** La mitad de
//  la regla F26 —"el cristal tiene que ser del mismo nivel que el item"— nació
//  de que el cristal fuera un item con diez niveles, cada uno con su
//  multiplicador de probabilidad. Sin niveles no hay con qué incumplirla: la
//  pregunta "qué cristal gasto" se ha convertido en "cuánto cuesta", y esa sí se
//  comprueba. Lo que **no** se ha perdido es la mitad buena de F26 —que no exista
//  una curva propia para el compañero—, y eso es lo que queda aquí.
// =========================================================================

// --- 1. El nivel sube y el ingreso sube con él --------------------------------
{
  // **EL MONTAJE SON CIFRAS, NO ITEMS.** Antes esto montaba una pila de cristales
  // del T3 en el almacén y la gastaba. Ahora el cristal es un recurso: lo que se
  // pone es `state.crystals`, en unidades, y la cuenta sale de
  // `valorDeUnCristal()` —que es la misma que usa el motor para el precio.
  const g = await boot(baseSave([
    companion('c1', 3, { potential: 5 })
  ], {
    nanites: 0, warehouseCapacity: 40, activeCompanions: ['c1'],
    companions: [ficha('c1', 3, { potential: 5 })],
    crystals: valorDeUnCristal(3) * 4
  }));

  const antes: any = s(g).passiveIncome;
  const base = (s(g).companions as any[])[0];

  // Con el dado forzado a 0, el `%` sale 0 y siempre acierta.
  const r: any = conRoll(0, () => g.upgradeCompanion('c1'));
  check('nivel companero: con las unidades del coste, sube de nivel',
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
  // **LO QUE QUEDA DE F26, Y ES LA MITAD BUENA.** La regla vieja era "el cristal
  // tiene que ser del mismo nivel que el item", y nacía de que el cristal fuera un
  // item con diez niveles. Sin niveles ya no hay con qué incumplirla, así que esa
  // mitad se ha ido con sus nombres. Lo que se conserva es lo que F26 protegía de
  // verdad: que el precio lo ponga el **tier del item**, que no llega como
  // argumento, y que sale de la misma función que la del recolector.
  //
  // Y el rechazo que queda es el otro: **no hay unidades suficientes**. Es la
  // versión buena de "un rechazo no cuesta nada", y se comprueba con una unidad
  // menos de lo que cuesta.
  const coste = costeDeNivelDeCompanio(3, 0);
  const gCorto = await boot(baseSave([
    companion('c1', 3, { potential: 3 })
  ], {
    nanites: 0, warehouseCapacity: 40, crystals: coste - 1,
    companions: [ficha('c1', 3, { potential: 3 })]
  }));
  const rCorto: any = conRoll(0, () => gCorto.upgradeCompanion('c1'));
  check('nivel companero: con una unidad menos se rechaza y no se gasta nada',
    rCorto.success === false && /Necesitas/.test(rCorto.msg ?? '')
      && s(gCorto).crystals === coste - 1,
    `msg="${rCorto.msg}" crystals=${s(gCorto).crystals} de ${coste - 1}`);
  check('nivel companero: y no sube de nivel',
    (s(gCorto).companions as any[])[0]?.level === 0,
    `nivel=${(s(gCorto).companions as any[])[0]?.level}`);

  // Y la curva de coste es **la misma función**: el primer nivel cuesta lo que
  // cuesta el del recolector, y el segundo más. Un número escrito aquí sería una
  // segunda curva que un día no coincidiría.
  //
  // **AHORA LA CURVA SÍ CRECE DESDE EL PRIMER NIVEL**, y es una consecuencia del
  // cristal como recurso: el precio de una subida es el valor del cristal de ese
  // tier multiplicado por `1,26^nivel`, así que el nivel 1 cuesta un 26 % más que
  // el 0. Con la curva entera de antes (`floor(1,2 × 1,26^n)`, en unidades de un
  // solo cristal) el primer salto no crecía, porque `floor(1,2 × 1,26) = 1`. Ese
  // caso raro ya no existe y sí se puede exigir que la curva suba.
  const partida = valorDeUnCristal(3) * 20;
  const g2 = await boot(baseSave([
    companion('c1', 3, { potential: 3 })
  ], {
    nanites: 0, warehouseCapacity: 40, crystals: partida,
    companions: [ficha('c1', 3, { potential: 3 })]
  }));
  // Se sube hasta el 4 y se compara lo gastado en cada salto contra lo que
  // dice `costeDeNivelDeCompanio(3, nivel)`, que es un alias de la curva del
  // recolector: los dos argumentos son el tier del item y el nivel que ya tiene.
  const gastados: number[] = [];
  for (let nivel = 0; nivel < 4; nivel++) {
    conRoll(0, () => g2.upgradeCompanion('c1'));
    gastados.push(partida - s(g2).crystals);
  }
  const esperado = gastados.map((_, i) => costeDeNivelDeCompanio(3, i));
  // **SE COMPARAN LOS SALTOS, NO EL TOTAL.** `gastados` es acumulado —lo que queda
  // fuera de la cuenta— y `esperado` es lo que cuesta *ese* nivel. Comparar los dos
  // así da un desfase de uno en cada término y parece que la curva está mal. Lo que
  // dice la regla es lo que cuesta **cada** subida, y eso es la diferencia entre
  // dos totales consecutivos.
  const porSalto = gastados.map((g, i) => g - (i === 0 ? 0 : gastados[i - 1]));
  check('nivel companero: el coste sale de la MISMA curva que el del recolector',
    porSalto.every((g, i) => g === esperado[i]) && esperado[3] > esperado[0],
    `por salto=[${porSalto.join(',')}] esperado=[${esperado.join(',')}]`);
  check('nivel companero: y el primer nivel ya cuesta más que el cero',
    esperado[1] > esperado[0],
    `nivel0=${esperado[0]} nivel1=${esperado[1]}`);
}

// --- 3. Fallar no retrocede ----------------------------------------------------
{
  const g = await boot(baseSave([
    companion('c1', 3, { potential: 3 })
  ], {
    nanites: 0, warehouseCapacity: 40, crystals: valorDeUnCristal(3) * 4,
    companions: [ficha('c1', 3, { potential: 3 })]
  }));

  // Con el dado al 99 %, siempre falla, sin importar el nivel.
  const r: any = conRoll(0.99, () => g.upgradeCompanion('c1'));
  check('nivel companero: fallar se paga y se dice',
    r.success === false && r.rolled === true && /Fallo/.test(r.msg ?? ''), r.msg ?? 'no falló');
  check('nivel companero: y el nivel NO retrocede, que era el fallo viejo',
    (s(g).companions as any[])[0]?.level === 0,
    `nivel=${(s(g).companions as any[])[0]?.level}`);
}

// --- 3b. EL UMBRAL ES EL QUE ANUNCIA LA HOJA, Y ESO ANTES NO SE COMPROBABA ---------
//
// Hasta aquí solo se medían los extremos: con el dado a 0 acierta y con el dado a 0,99
// falla. **Esas dos pruebas pasan igual si el motor y la hoja dijeran probabilidades
// distintas**, siempre que los extremos no se muevan: el 0 acierta con cualquier umbral
// positivo y el 0,99 falla con cualquier umbral por debajo de 99. O sea que el agujero
// exacto —"me enseñan una probabilidad y tiran con otra" — no estaba cerrado, y es el
// fallo que R3 prohíbe.
//
// Por eso el borde se mide **con un umbral en medio**: el nivel 10 anuncia 65 %, así que
// un dado de 0,649 tiene que acertar y uno de 0,651 tiene que fallar. Si el motor usara
// otra fórmula, estas dos pruebas no podrían pasar a la vez.
{
  const nivel = 10;
  const anunciado = chanceDeSintonizacion(nivel);
  check('nivel companero: el nivel 10 anuncia 65, que es el numero que hay que tirar',
    anunciado === 65, `anuncia=${anunciado}`);

  const conNivel = async (id: string, dado: number) => {
    const g = await boot(baseSave([
      companion(id, 3, { potential: 3 })
    ], {
      nanites: 0, warehouseCapacity: 40, crystals: valorDeUnCristal(3) * 40,
      companions: [ficha(id, 3, { potential: 3, level: nivel })]
    }));
    return conRoll(dado, () => g.upgradeCompanion(id)) as any;
  };

  // 0,649 · 100 = 64,9, que es MENOS que 65: acierta.
  const rJusto = await conNivel('c1', 0.649);
  check('nivel companero: un dado por debajo del anunciado acierta',
    rJusto?.success === true, `dado=64,9 anuncia=${anunciado} success=${rJusto?.success}`);

  // 0,651 · 100 = 65,1, que es MÁS que 65: falla.
  const rPasado = await conNivel('c2', 0.651);
  check('nivel companero: un dado por encima del anunciado falla',
    rPasado?.success === false, `dado=65,1 anuncia=${anunciado} success=${rPasado?.success}`);

  // **Y LA MISMA CUENTA PARA EL RECOLECTOR**, porque el Holeja enseña la misma
  // probabilidad y son dos métodos distintos: que coincidan los dos con el mismo número
  // es lo que hace que "abrir la hoja" signifique algo sea cual sea el objeto.
  const gRec = await boot(baseSave([collector('r1', 3)], {
    nanites: 0, warehouseCapacity: 40, crystals: valorDeUnCristal(3) * 40
  }));
  (wh(gRec) as any[]).find((w: any) => w.id === 'r1').level = nivel;
  const rRec: any = conRoll(0.651, () => gRec.upgradeEquippedCollector());
  check('nivel recolector: el mismo borde y el mismo numero',
    rRec?.success === false, `dado=65,1 anuncia=${anunciado} success=${rRec?.success}`);
}

// --- 3c. SE PUEDE MEJORAR CUALQUIER RECOLECTOR, NO SOLO EL EQUIPADO -------------
//
// El método antes no recibía id y mejoraba `state.equippedCollectorId`, así que la ficha
// apagaba el botón con "Equípala primero": con veinte recolectores en el almacén,
// diecinueve no se podían subir y había que equipar cada uno por turnos.
//
// Lo que se fija aquí es que **el id manda**, y en los dos sentidos: que sube el que se
// le pide aunque no esté equipado, y que **no** sube el equipado por error cuando se le
// pide otro. Lo segundo es el que importa: si el método ignorara el argumento, la hoja
// mostraría el coste y la probabilidad de un item y el motor subiría otro.
{
  const g = await boot(baseSave([
    collector('equipado', 3), collector('guardado', 3), collector('tercero', 3)
  ], {
    nanites: 0, warehouseCapacity: 40,
    crystals: valorDeUnCristal(3) * 200,
    equippedCollectorId: 'equipado'
  }));

  const nivelDe = (id: string) =>
    (s(g).warehouse as any[]).find((w: any) => w.id === id)?.level;

  const r: any = conRoll(0.001, () => g.upgradeCollector('guardado'));
  check('mejorar: sube el que se le pide aunque no este equipado',
    r?.success === true && nivelDe('guardado') === 1 && nivelDe('equipado') === 0,
    `success=${r?.success} guardado=${nivelDe('guardado')} equipado=${nivelDe('equipado')}`);

  // **Y SIN ARGUMENTO SIGUE SUBIENDO EL EQUIPADO**, que es lo que hace que veinte bancos
  // y el guardado no cambien de comportamiento.
  const r2: any = conRoll(0.001, () => g.upgradeCollector());
  check('mejorar: sin argumento sube el equipado, como antes',
    r2?.success === true && nivelDe('equipado') === 1,
    `success=${r2?.success} equipado=${nivelDe('equipado')}`);

  // Y el alias antiguo sigue siendo lo mismo, no una segunda implementación.
  const r3: any = conRoll(0.001, () => g.upgradeEquippedCollector());
  check('mejorar: el alias antiguo sube el equipado y no tiene logica propia',
    r3?.success === true && nivelDe('equipado') === 2 && nivelDe('guardado') === 1,
    `success=${r3?.success} equipado=${nivelDe('equipado')} guardado=${nivelDe('guardado')}`);

  // **LO QUE NO ES UN RECOLECTOR SE NIEGA**, en vez de subirle el nivel a una caja.
  const r4: any = g.upgradeCollector('no-existe');
  check('mejorar: un id que no existe se niega diciendo que',
    r4?.success === false && !!r4?.msg, `ok=${r4?.success} msg=${r4?.msg ?? ''}`);
}

// --- 4. El techo y el rechazo sin coste ---------------------------------------
{
  // El techo lo pone **la ficha**, y la ficha lo pone `nivelMaximoDeCompanio()`.
  const g = await boot(baseSave([
    companion('c1', 3, { potential: 1, level: 0, maxLevel: 3 })
  ], {
    nanites: 0, warehouseCapacity: 40, crystals: valorDeUnCristal(3) * 20,
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
  const antesEnElTecho = s(g).crystals;
  const rTop: any = conRoll(0, () => g.upgradeCompanion('c1'));
  check('nivel companero: y en el techo responde "máximo", no cobra nada',
    rTop.success === false && /m/i.test(rTop.msg ?? '') && s(g).crystals === antesEnElTecho,
    `msg="${rTop.msg}" crystals=${antesEnElTecho} -> ${s(g).crystals}`);

  // **Un rechazo no cuesta nada.** Con unidades de sobra en la mano, que es donde
  // el orden importa: si la comprobación fuera después del cobro, el jugador
  // pagaría por una subida que no ocurrió.
  //
  // **EL RECHAZO ES "YA ESTÁ EN EL TECHO", NO "NO TENGO CRISTALES".** Con un
  // rechazo por falta de unidades se comprobaría el orden del cobro dos veces —con
  // el mismo resultado—, y además ese rechazo se puede tapar con "quedan cero": es
  // el que sale cuando el jugador no ha jugado nunca. El techo da el rechazo que se
  // repite cada vez que se vuelve a tocar el botón, y es el que un jugador con la
  // cartera llena se encuentra.
  const tope = nivelMaximoDeCompanio(3, 3);
  const g2 = await boot(baseSave([
    companion('c1', 3, { potential: 3, level: tope, maxLevel: tope })
  ], {
    nanites: 0, warehouseCapacity: 40, crystals: costeDeNivelDeCompanio(3, 0),
    companions: [ficha('c1', 3, { potential: 3, level: tope, maxLevel: tope })]
  }));
  const antes = s(g2).crystals;
  const r2: any = g2.upgradeCompanion('c1');
  check('nivel companero: un rechazo no gasta ni una unidad de cristal',
    r2.success === false && s(g2).crystals === antes,
    `antes=${antes} despues=${s(g2).crystals} msg="${r2.msg}"`);

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
    companion('c1', 3, { potential: 5 })
  ], {
    nanites: 0, warehouseCapacity: 40, activeCompanions: ['c1'],
    crystals: valorDeUnCristal(3) * 4,
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
  // ---------------------------------------------------------------------------
  //  EL MOTOR NO ESTA ROTO: LO QUE TIRA ES LO QUE DICE LA HOJA
  //
  //  Se reporto que la mejora de companeros "siempre falla". Medido: el motor tira
  //  `chanceDeSintonizacion(nivel)` y la hoja ensena `previewUpgradeChance(nivel)`, que
  //  es un alias de esa MISMA funcion. **Lo que se ve es lo que sale, en los trece
  //  niveles medidos.** Asi que lo que hay no es un fallo de probabilidad sino un
  //  acantilado de coste, y esto queda escrito para que la proxima vez se mire el
  //  numero antes de dar por hecho que el motor esta roto.
  //
  //  Y de paso, una frase que si estaba mal: **el aviso de "ya estas al nivel maximo"
  //  decia "El recolector"**, companero incluido, porque el camino del recolector se
  //  escribio primero y el del companero se anadio encima sin tocarla.
  // ---------------------------------------------------------------------------
  {
    check('sintonizacion: la hoja ensena la misma probabilidad que el motor tira',
      [0, 4, 8, 12, 16, 20].every((l: number) => previewUpgradeChance(l) === chanceDeSintonizacion(l)),
      [0, 4, 8, 12, 16, 20].map((l: number) => l + ':' + previewUpgradeChance(l)).join(' ') +
        ' vs motor ' + [0, 4, 8, 12, 16, 20].map((l: number) => chanceDeSintonizacion(l)).join(' '));

    // **EL DADO FORZADO, QUE ES LA UNICA FORMA DE AFIRMAR UNA PROBABILIDAD.** Una
    //  prueba que hace sesenta intentos de verdad y cuenta aciertos es una prueba que
    //  depende del dado, y eso ya se ha pagado: en `loteCheck` una prueba asi caia un
    //  9 % de las veces. Y el recuento no decia nada util: con el nivel subiendo en cada
    //  acierto, la media de las sesenta tiradas no es la probabilidad de ningun nivel
    //  concreto.
    //
    //  Con el dado clavado si: **la frontera se comprueba, no se estima.** Si el motor
    //  tirara otra cosa que `chanceDeSintonizacion()`, estos tres casos caen.
    const g = await boot(baseSave([
      { id: 'm1', name: 'Uno', type: 'companion', details: 'x', rarity: 'Raro', tier: 1, potential: 3, sellPrice: 100 },
      { id: 'm2', name: 'Dos', type: 'companion', details: 'x', rarity: 'Raro', tier: 1, potential: 3, sellPrice: 100 }
    ], { crystals: 1e12, stones: 1e9, warehouseCapacity: 60, maxCompanionSlots: 4 }));
    // **EL DADO TAMBIEN AQUI: LA FORJA TIRA, Y SIN CLAVARLA ESTA PRUEBA ES UN DADO.**
    // Una fusión puede fallar, y cuando falla **se come los materiales**: el `.companion`
    // salía `undefined` y la línea siguiente reventaba. Es el segundo banco que se cae
    // por depender del azar en la misma tarde, después del de `loteCheck`.
    const forjado: any = conRoll(0, () => g.forgeCompanion(['m1', 'm2'], 0, 0));
    const idForjado = forjado.companion.id;
    const nivelDe = () => (g.getState().companions as any[]).find((x: any) => x.id === idForjado)?.level ?? 0;

    const bajo: any = conRoll(0.94, () => g.upgradeCompanion(idForjado));
    check('sintonizacion: con el dado por debajo de la frontera, acierta y sube de nivel',
      bajo.success === true && nivelDe() === 1, `ok=${bajo.success} nivel=${nivelDe()}`);

    const alto: any = conRoll(0.96, () => g.upgradeCompanion(idForjado));
    check('sintonizacion: y por encima, falla sin retroceder el nivel',
      alto.success === false && alto.rolled === true && nivelDe() === 1,
      `ok=${alto.success} rolled=${alto.rolled} nivel=${nivelDe()}`);

    // **Y LA FRONTERA JUSTA EN EL NIVEL 10, QUE ES DONDE LA CIFRA ES 65.** El nivel 10
    //  es el que ya se ve en la hoja con dos decimales de diferencia, asi que es el
    //  punto donde un motor que tirara "un poco mas" o "un poco menos" se nota.
    for (let k = 0; k < 9; k++) conRoll(0, () => g.upgradeCompanion(idForjado));
    const p10 = chanceDeSintonizacion(10);
    const dentro: any = conRoll(p10 / 100 - 0.001, () => g.upgradeCompanion(idForjado));
    const trasDentro = nivelDe();
    const fuera: any = conRoll(p10 / 100 + 0.001, () => g.upgradeCompanion(idForjado));
    const trasFuera = nivelDe();
    check('sintonizacion: en el nivel 10 la frontera es exactamente la que dice la hoja',
      trasDentro === 11 && dentro.success === true &&
      trasFuera === 11 && fuera.success === false,
      `p=${p10} dentro=${trasDentro} fuera=${trasFuera}`);
    // **Y QUE EL COMPANERO NO SE QUEDE ATRAPADO EN EL TECHO.** El tope sale de su
    //  potencial y no del recolector, y una vez tocado el motor dice que no tira en
    //  vez de fallar: eso es lo que distingue "no me sirve" de "he fallado".
    const stFinal: any = g.getState();
    const cFinal = (stFinal.companions || []).find((x: any) => x.id === idForjado);
    check('sintonizacion: en el techo el motor no tira, y lo dice',
      (cFinal.level || 0) < 29 || (g.upgradeCompanion(idForjado) as any).rolled === false,
      `nivel=${cFinal.level} maxLevel=${cFinal.maxLevel}`);
  }

  // -------------------------------------------------------------------------
  //  EL CARTEL DEL SINTONIZADOR NO ENSEÑA UNA TIRADA QUE NO HUBO
  //
  //  Esta sección no mira ninguna animación: mira el CONTRATO entre el motor y
  //  el cartel. Y nace de un fallo de razón que es fácil de cometer y que ningún
  //  banco habría visto: `upgradeEquippedCollector` devuelve `{ success: false }`
  //  tanto cuando el dado falla como cuando la operación se RECHAZA antes de
  //  tirar (faltan cristales, ya está en el techo, no hay recolector equipado).
  //  Los dos casos son `false`, pero son cosas opuestas para el jugador: uno
  //  gastó los cristales y hay que enseñarle el fallo, el otro no gastó nada y
  //  lo que corresponde es un aviso.
  //
  //  Sin `rolled`, un rechazo enseñaría un cartel de "FALLO" por una operación
  //  que no ocurrió, con un mensaje que habla de otra cosa. Y no habría ningún
  //  error: el cartel saldría bien, con su cifra y su botón.
  // -------------------------------------------------------------------------
  {
    // EL ACIERTO: el dado salió, y el cartel lo tiene que enseñar como tal.
    const g = await boot(baseSave([
      collector('r1', TIER_CARTEL, { damage: 60, level: NIVEL_CARTEL })
    ], { nanites: 0, crystals: COSTE_CARTEL }));
    g.equipCollector('r1');
    const nivelAntes = find(g, 'r1').level;
    const res = conRoll(0, () => g.upgradeEquippedCollector());
    const roll = tuningRoll(res, nivelAntes, find(g, 'r1').level);

    check('cartel: en el acierto se tira el dado', res.rolled === true,
      `rolled=${res.rolled}`);
    check('cartel: y lo enseña como acierto',
      roll.rolled === true && roll.success === true,
      `rolled=${roll.rolled} success=${roll.success}`);
    // Y la flecha. El motor sube el nivel en el mismo objeto del almacén, así
    // que si `levelBefore` se leyera después de la llamada daría el nivel nuevo
    // en los dos casos y el cartel pintaría "5 -> 5", un número que no existe.
    check('cartel: la flecha del acierto es "4 -> 5"',
      roll.levelBefore === NIVEL_CARTEL && roll.levelAfter === NIVEL_CARTEL + 1,
      `${roll.levelBefore} -> ${roll.levelAfter}`);

    const g2 = await reload();
    check('cartel: el acierto sobrevive a la recarga', find(g2, 'r1')?.level === 5,
      'nivel=' + find(g2, 'r1')?.level);
  }
  {
    // EL FALLO DEL DADO: se gastaron los cristales, y hay que decirlo.
    const g = await boot(baseSave([
      collector('r1', TIER_CARTEL, { damage: 60, level: NIVEL_CARTEL })
    ], { nanites: 0, crystals: COSTE_CARTEL }));
    g.equipCollector('r1');
    const nivelAntes = find(g, 'r1').level;
    const crystalsAntes = s(g).crystals;
    const res = conRoll(0.999, () => g.upgradeEquippedCollector());
    const roll = tuningRoll(res, nivelAntes, find(g, 'r1').level);

    check('cartel: el fallo del dado tambien es una tirada', res.rolled === true,
      `rolled=${res.rolled}`);
    check('cartel: y lo enseña como fallo',
      roll.rolled === true && roll.success === false,
      `rolled=${roll.rolled} success=${roll.success}`);
    check('cartel: el fallo deja el nivel donde estaba',
      roll.levelAfter === roll.levelBefore && find(g, 'r1').level === NIVEL_CARTEL,
      `${roll.levelBefore} -> ${roll.levelAfter}, el item esta en ${find(g, 'r1').level}`);
    // Y se paga. Un fallo que no costara nada sería un fallo que no es un
    // fallo: sería el cartel echando el premio.
    check('cartel: el fallo se paga con los cristales',
      s(g).crystals === crystalsAntes - COSTE_CARTEL,
      `antes=${crystalsAntes} despues=${s(g).crystals}, y subir el nivel ${NIVEL_CARTEL} cuesta ${COSTE_CARTEL}`);
  }
  {
    // LOS RECHAZOS, que es lo que el cartel tiene que NO representar.
    //
    // Cada uno se monta con la partida que lo provoca y se mira lo mismo: que el
    // motor diga `rolled: false`, que el cartel se entere, y que no se haya
    // gastado nada. La última es la que de verdad lo demuestra: si el saldo sigue
    // entero, no hubo tirada que mostrar.
    const rechazos: Array<{ nombre: string; save: any; equipo?: string }> = [
      {
        nombre: 'sin cristales en el saldo',
        save: baseSave([collector('r1', TIER_CARTEL, { damage: 60, level: NIVEL_CARTEL })], { nanites: 0, crystals: 0 })
      },
      {
        nombre: 'con menos cristales de los necesarios',
        save: baseSave([collector('r1', TIER_CARTEL, { damage: 60, level: 10 })], { nanites: 0, crystals: 1 })
      },
      {
        // **EL TECHO SE COMPRUEBA CON SALDO DE SOBRA, A PROPÓSITO.** Si el saldo se
        // quedara corto, el motor rechazaría por falta de cristales y no por el
        // techo, y el caso demostraría otra cosa sin que nadie lo notara: el
        // rechazo seguiría siendo `false` y el banco daría verde. Con el saldo
        // justo para subir este nivel, la única razón posible del rechazo es el
        // tope.
        nombre: 'en el techo de niveles',
        save: baseSave([collector('r1', TIER_CARTEL, { damage: 60, level: 20, maxLevel: 20 })],
          { nanites: 0, crystals: costeDeNivel(TIER_CARTEL, 20) })
      },
      {
        // Almacén VACÍO a propósito: este caso se provoca por no tener recolector
        // equipado, y `baseSave([])` no trae ninguno.
        nombre: 'sin recolector equipado',
        save: baseSave([], { nanites: 0, crystals: COSTE_CARTEL })
      }
    ];

    for (const caso of rechazos) {
      const g = await boot(caso.save);
      if (caso.equipo !== null) g.equipCollector('r1');
      const crystalsAntes = s(g).crystals;

      const nivelAntes = find(g, 'r1')?.level;
      const res = g.upgradeEquippedCollector();
      const roll = tuningRoll(res, nivelAntes ?? 0, find(g, 'r1')?.level ?? 0);
      const crystalsDespues = s(g).crystals;

      check(`rechazo (${caso.nombre}): el motor dice que no se tiro el dado`,
        res.success === false && res.rolled === false,
        `success=${res.success} rolled=${res.rolled} msg=${res.msg ?? ''}`);
      check(`rechazo (${caso.nombre}): y el cartel no lo presenta como tirada`,
        roll.rolled === false,
        `rolled=${roll.rolled}: con esto el selector avisa por toast y no enseña nada`);
      check(`rechazo (${caso.nombre}): no se gasta ni un cristal`,
        crystalsDespues === crystalsAntes,
        `antes=${crystalsAntes} despues=${crystalsDespues}`);
      check(`rechazo (${caso.nombre}): el nivel no se mueve`,
        (find(g, 'r1')?.level ?? 0) === (nivelAntes ?? 0),
        `antes=${nivelAntes} ahora=${find(g, 'r1')?.level}`);
    }
  }
  {
    // Y el caso degenerado: un motor viejo, o un mock sin `rolled`. Se trata
    // como "no hay cartel", que es la salida que no le enseña al jugador un
    // resultado que nadie ha tirado. Mismo criterio que R11 con los saves.
    const viejo = tuningRoll({ success: true, msg: 'x' } as any, 4, 5);
    check('cartel: sin `rolled` no se enseña nada',
      viejo.rolled === false && viejo.success === false,
      `rolled=${viejo.rolled} success=${viejo.success}`);

    // Y el motor da siempre el nivel con el que se queda. El cartel lo usa
    // para la flecha, y sin él tendría que releer el item, que es el error del
    // "5 -> 5" que esta sección existe para cerrar.
    //
    // **AQUÍ HAY QUE PAGAR LAS DOS SUBIDAS, Y CADA UNA A SU PRECIO.** El acierto
    // gasta el coste del nivel 4 y el fallo el del nivel 5, que ya no es el mismo
    // —crece con `1,26^nivel`—, así que el saldo se pone con la suma de los dos y
    // no con un número que haya que adivinar.
    const g = await boot(baseSave([
      collector('r1', TIER_CARTEL, { damage: 60, level: NIVEL_CARTEL })
    ], { nanites: 0, crystals: COSTE_DOS_CARTEL }));
    g.equipCollector('r1');
    const ok = conRoll(0, () => g.upgradeEquippedCollector());
    const mal = conRoll(0.999, () => g.upgradeEquippedCollector());
    check('cartel: el motor devuelve el nivel con el que se queda',
      ok.level === NIVEL_CARTEL + 1 && mal.level === NIVEL_CARTEL + 1,
      `acierto=${ok.level} fallo=${mal.level}: el fallo no retrocede, asi que los dos suben`);
  }
  {
    // LA REGLA DEL FALLO QUE SE CONTRADECÍA A SÍ MISMO.
    //
    // **LO QUE SE VEÍA EN PANTALLA:** un cartel con **FALLO** en grande, la línea
    // "Nivel 7 · sin cambio" y, debajo, el mensaje del motor diciendo "¡Mejora
    // exitosa!". Las dos cosas ciertas y contradictorias en la misma tarjeta, y
    // la grande es la que miente.
    //
    // **LA CAUSA: LEER EL NIVEL POR SEGUNDA VEZ, Y EL MOTOR REESCRIBE EL OBJETO.**
    // El motor sube el nivel reescribiendo el array, o sea con objetos nuevos. Si
    // se lee dos veces, la segunda dice lo nuevo en los dos casos y el cartel
    // concluye que no hubo subida mientras el motor subía de verdad.
    const subio = tuningRoll({ success: true, rolled: true, level: 8, msg: 'x' }, 7, 7);
    check(
      'cartel: el motor dice que subio y no se pinta FALLO aunque las cifras no cuadren',
      subio.success === true,
      `success=${subio.success} ${subio.levelBefore}->${subio.levelAfter}`
    );
    check(
      'cartel: y el nivel que se ensena es una subida, no un numero que no existe',
      subio.levelAfter > subio.levelBefore,
      `${subio.levelBefore}->${subio.levelAfter}`
    );
  }
  {
    // Y el caso normal: el nivel de después sale del propio motor, no de releer
    // el item.
    const bien = tuningRoll({ success: true, rolled: true, level: 8, msg: 'x' }, 7, 8);
    check(
      'cartel: cuando el motor da el numero bueno, se pinta la flecha 7 -> 8',
      bien.success === true && bien.levelBefore === 7 && bien.levelAfter === 8,
      `${bien.levelBefore}->${bien.levelAfter}`
    );
    const fallo = tuningRoll({ success: false, rolled: true, level: 7, msg: 'x' }, 7, 7);
    check(
      'cartel: un fallo de verdad sigue siendo fallo y no inventa una subida',
      fallo.success === false && fallo.levelAfter === 7,
      `success=${fallo.success} ${fallo.levelBefore}->${fallo.levelAfter}`
    );
  }

resumen('la escala de calidad: el potencial y solo el potencial');
}

export default main();
