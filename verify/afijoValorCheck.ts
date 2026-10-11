// ==========================================================================
//  EL VALOR DE CADA AFIJO: UN Baluarte NO ES "UN Baluarte", ES UN Baluarte CON MAGNITUD
//
//  Este banco existe por tres regresiones que ya pasaron, y las tres eran
//  silenciosas: ninguna tiraba un rojo, la suite daba verde y el juego mentía.
//
//  1. **LA MIGRACIÓN NO SE EJECUTABA.** El bloque que sortea el valor de cada
//     afijo estaba escrito DESPUÉS de un `return` temprano que cortaba en cuanto
//     la lista de afijos ya coincidía con la rareza —que es el caso de todo item
//     que ya existía en una partida—. No fallaba de forma ruidosa: devolvía
//     `changed: false`, el banco la daba por buena, y los items del mundo
//     seguían sin valor. Un banco que mira "este item viejo ¿tiene valor?" lo
//     caza; uno que no lo mira, no.
//
//  2. **LOS AFIJOS DE PASIVO NO COBRABAN.** `passiveMult` no lo leía ninguna
//     cuenta, así que Rendimiento, Núcleo, Primo, Absorción y Efenéreo prometían
//     "+X % al ingreso por segundo" y no pagaban nada —la misma clase que
//     `aff_luck`, que ya se había borrado por exactamente esto—.
//
//  3. **EL 1,0 TIENE QUE SER EL CENTRO.** Es lo que pagan todos los items que ya
//     existían cuando entra la regla, así que poner el mínimo en 1 bajaría el
//     almacén de todo el mundo la primera vez que carga. Y es lo que hace que la
//     mitad de las veces el afijo pague justo lo que decía su descripción.
//
//  Y una cuarta, que es la que hace útil todo lo demás: **dos items con el mismo
//  afijo y valores distintos tienen que pegar distinto**, que es lo que convierte
//  "un afijo" en "un afijo concreto" y le da algo que buscar a la forja.
// ==========================================================================

import { boot, reload, check, resumen, wh, baseSave, collector, companion, conRoll } from './kit';
import { attemptForge, attemptForgeCompanion } from '../src/data/crafting';
import { sellPrice, valuationConCifras, affixValueMult } from '../src/data/valuation';
import {
  efectoDeAfijos, valorGuardadoDeAfijo, textoDeAfijo, heredaValoresDeAfijo,
  afijosParaRareza, AFFIXES,
  VALOR_AFIJO_MIN, VALOR_AFIJO_MAX, pesoDeAfijo
} from '../src/data/crafting';

/** Los cuatro Raros del catálogo, para la prueba de distribución. */
const RARO_IDS = new Set(
  AFFIXES.filter((a: any) => a.rarity === 'Raro').map((a: any) => a.id));

/**
 * Un recolector con afijos y SIN `affixVals`: exactamente lo que es un item de
 * una partida guardada antes de que existiera el campo.
 */
const viejo = (id: string, affixes: string[], over: any = {}) =>
  collector(id, 3, { rarity: 'Épico', affixes, ...over });

/** Redondea a 3 decimales, que es donde estos números se leen. */
const r3 = (n: number) => Math.round(n * 1000) / 1000;

async function main() {
  // =========================================================================
  // 1 · LA MIGRACIÓN. Un item viejo tiene que salir con valor, sin tocar nada.
  // =========================================================================
  {
    const g = await boot(baseSave([
      viejo('r-viejo', ['aff_bulwark', 'aff_core']),
      // Uno que ya trae valor: la migración no lo puede tocar.
      viejo('r-fijo', ['aff_sharp'], { affixVals: { aff_sharp: 1.25 } })
    ]));

    const sinValor = wh(g).find((w: any) => w.id === 'r-viejo');
    const vals = sinValor?.affixVals;
    const todosTienen = ['aff_bulwark', 'aff_core'].every(id => typeof vals?.[id] === 'number');
    check('migración: un item VIEJO, sin el campo, sale con valor',
      todosTienen, `affixVals=${JSON.stringify(vals)}`);

    check('migración: y hay un valor para CADA afijo que trae',
      Object.keys(vals ?? {}).length === (sinValor?.affixes?.length ?? -1),
      `ids=${JSON.stringify(sinValor?.affixes)} vals=${JSON.stringify(Object.keys(vals ?? {}))}`);

    const dentro = Object.values(vals ?? {}).every((v: any) =>
      typeof v === 'number' && v >= VALOR_AFIJO_MIN - 1e-9 && v <= VALOR_AFIJO_MAX + 1e-9);
    check('migración: todo valor cae dentro del rango',
      dentro, `rango=[${VALOR_AFIJO_MIN},${VALOR_AFIJO_MAX}] vals=${JSON.stringify(vals)}`);

    const fijo = wh(g).find((w: any) => w.id === 'r-fijo');
    check('migración: un valor que YA estaba no se toca',
      fijo?.affixVals?.aff_sharp === 1.25,
      `era 1.25 y quedó ${fijo?.affixVals?.aff_sharp}`);
  }

  // =========================================================================
  // 2 · ES IDEMPOTENTE. Recargar no puede volver a tirar el dado.
  //
  //    Es la diferencia entre "los items viejos reciben un valor" y "los items
  //    viejos reciben un valor nuevo en cada recarga". Lo segundo es un item que
  //    cambia de número cada vez que el jugador abre el juego.
  // =========================================================================
  {
    const g = await boot(baseSave([viejo('r1', ['aff_bulwark', 'aff_core'])]));
    const antes = { ...(wh(g).find((w: any) => w.id === 'r1').affixVals ?? {}) };

    await reload();

    const despues = wh(g).find((w: any) => w.id === 'r1')?.affixVals ?? {};
    const iguales = Object.keys(antes).length === Object.keys(despues).length
      && Object.keys(antes).every(k => antes[k] === despues[k]);
    check('migración: recargar NO vuelve a sortear',
      iguales, `antes=${JSON.stringify(antes)} despues=${JSON.stringify(despues)}`);
  }

  // =========================================================================
  // 3 · LO CORRUPTO CAE A 1, Y NO ARRASTRA AL DAÑO.
  //
  //    Un guardado editado a mano, un `null` colado o un factor de otra versión
  //    no pueden meter `NaN` en el daño: `Math.floor(NaN)` se lleva por delante el
  //    número entero del click sin avisar, y un item con un afijo corrupto se
  //    queda sin hacer daño.
  // =========================================================================
  {
    const check1 = valorGuardadoDeAfijo({ aff_x: NaN }, 'aff_x') === 1;
    check('corrupto: un NaN vale 1', check1);

    check('corrupto: un null vale 1', valorGuardadoDeAfijo({ aff_x: null } as any, 'aff_x') === 1);
    check('corrupto: una cadena vale 1', valorGuardadoDeAfijo({ aff_x: 'alto' } as any, 'aff_x') === 1);
    check('corrupto: Infinity vale 1', valorGuardadoDeAfijo({ aff_x: Infinity }, 'aff_x') === 1);

    // Fuera del rango se recorta, no se propaga: un 40 sería un ×40 silencioso.
    check('corrupto: por encima del rango se recorta al máximo',
      valorGuardadoDeAfijo({ aff_x: 40 }, 'aff_x') === VALOR_AFIJO_MAX);
    check('corrupto: por debajo del rango se recorta al mínimo',
      valorGuardadoDeAfijo({ aff_x: -3 }, 'aff_x') === VALOR_AFIJO_MIN);

    // El daño entero sobrevive: es la consecuencia que de verdad importa.
    const conNaN = efectoDeAfijos(['aff_bulwark'], 0, 3, { aff_bulwark: NaN } as any);
    const sinNada = efectoDeAfijos(['aff_bulwark'], 0, 3);
    check('corrupto: el efecto sale igual que si el afijo valiera 1',
      r3(conNaN.clickMult) === r3(sinNada.clickMult),
      `NaN=${r3(conNaN.clickMult)} uno=${r3(sinNada.clickMult)}`);

    check('corrupto: ningún efecto sale NaN',
      Number.isFinite(conNaN.clickMult) && Number.isFinite(conNaN.passiveMult)
      && Number.isFinite(conNaN.critChance));
  }

  // =========================================================================
  // 4 · EL 1,0 ES EL CENTRO: paga la magnitud de catálogo.
  //
  //    Esto es lo que hace que cargar la partida no le haga daño a nadie, y lo que
  //    hace que medio afijo de cada tres pague exactamente lo que decía su texto.
  // =========================================================================
  {
    const catalogo = efectoDeAfijos(['aff_bulwark'], 0, 3);
    const conUno = efectoDeAfijos(['aff_bulwark'], 0, 3, { aff_bulwark: 1 });
    check('el 1,0 paga la magnitud de catálogo',
      r3(catalogo.clickMult) === r3(conUno.clickMult),
      `catálogo=${r3(catalogo.clickMult)} con 1=${r3(conUno.clickMult)}`);

    const bajo = efectoDeAfijos(['aff_bulwark'], 0, 3, { aff_bulwark: VALOR_AFIJO_MIN });
    const alto = efectoDeAfijos(['aff_bulwark'], 0, 3, { aff_bulwark: VALOR_AFIJO_MAX });
    check('y el rango sí mueve el efecto de verdad',
      bajo.clickMult < conUno.clickMult && conUno.clickMult < alto.clickMult,
      `min=${r3(bajo.clickMult)} 1=${r3(conUno.clickMult)} max=${r3(alto.clickMult)}`);

    check('el rango es simétrico alrededor de 1',
      r3((alto.clickMult - conUno.clickMult)) === r3((conUno.clickMult - bajo.clickMult)),
      `subida=${r3(alto.clickMult - conUno.clickMult)} bajada=${r3(conUno.clickMult - bajo.clickMult)}`);
  }

  // =========================================================================
  // 5 · DOS ITEMS IGUALES CON VALORES DISTINTOS PEGAN DISTINTO.
  //
  //    Esta es la prueba que justifica el sistema entero. Si dos Baluartes del
  //    mismo tier pagaran lo mismo, el valor no existiría.
  // =========================================================================
  {
    const flojo = efectoDeAfijos(['aff_bulwark'], 0, 5, { aff_bulwark: VALOR_AFIJO_MIN });
    const bueno = efectoDeAfijos(['aff_bulwark'], 0, 5, { aff_bulwark: VALOR_AFIJO_MAX });
    check('dos Baluartes del mismo tier con valores distintos pegan distinto',
      bueno.clickMult > flojo.clickMult,
      `flojo=${r3(flojo.clickMult)} bueno=${r3(bueno.clickMult)}`);
  }

  // =========================================================================
  // 6 · EL VALOR APLICA A LOS TRES EFECTOS, INCLUIDO EL CRÍTICO.
  //
  //    Que `potenciaDeAfijoPorTier()` no escale `critChance` es otra decisión y no
  //    quiere decir que dos Focos valgan igual: el valor sorteado es del afijo en
  //    ese item, y va a los tres.
  // =========================================================================
  {
    const flojo = efectoDeAfijos(['aff_void'], 0, 5, { aff_void: VALOR_AFIJO_MIN });
    const bueno = efectoDeAfijos(['aff_void'], 0, 5, { aff_void: VALOR_AFIJO_MAX });
    check('el valor también mueve el crítico',
      bueno.critChance > flojo.critChance,
      `flojo=${r3(flojo.critChance)} bueno=${r3(bueno.critChance)}`);
    check('y el pasivo', bueno.passiveMult > flojo.passiveMult,
      `flojo=${r3(flojo.passiveMult)} bueno=${r3(bueno.passiveMult)}`);
  }

  // =========================================================================
  // 7 · DISCREPANCIA 8: LOS AFIJOS DE PASIVO COBRAN.
  //
  //    Antes de esto, `Rendimiento` decía "+20 % al ingreso por segundo" y la
  //    cuenta del ingreso no leía `passiveMult` en ninguna parte. Se cobraba en
  //    la valoración y no hacía nada jugando: la misma clase de afijo fantasma
  //    que `aff_luck`.
  // =========================================================================
  {
    const arma = viejo('r-pasivo', ['aff_yield']);
    const g = await boot(baseSave([arma, companion('c1')]));
    const st: any = g.getState();
    st.companions = [{ id: 'c1', name: 'C', type: 'passive', power: 100, tier: 3, rarity: 'Común' }];
    g.equipCollector('r-pasivo');
    g.equipCompanion('c1');

    const sinAfijos = st.passiveIncome;
    const conRendimiento = st.passiveIncome;
    check('pasivo: el ingreso se cobra', conRendimiento > 0, `ingreso=${conRendimiento}`);
    // Y ahora lo importante: quitar el afijo tiene que BAJAR el ingreso.
    const st2: any = g.getState();
    st2.warehouse = st2.warehouse.map((w: any) =>
      w.id === 'r-pasivo' ? { ...w, affixes: [] } : w);
    g.equipCollector('r-pasivo');
    check('pasivo: y QUITAR el afijo de pasivo lo baja',
      st2.passiveIncome < conRendimiento,
      `con afijo=${conRendimiento} sin=${st2.passiveIncome}`);
    void sinAfijos;
  }

  // =========================================================================
  // 8 · LOS PESOS DEL SORTEO: EL DIVINO ES MUCHO MÁS RARO QUE EL RARO.
  //
  //    El encargo era "no deberían ser más difíciles de sacar los mejores". Con la
  //    tabla de antes un Divino salía 3,6 veces más raro que un Raro, que es tan
  //    poco que se lee como "todos salen igual". Ahora se comprueba el orden
  //    entero, no solo el par.
  // =========================================================================
  {
    const raro = pesoDeAfijo('Raro');
    const epico = pesoDeAfijo('Épico');
    const legendario = pesoDeAfijo('Legendario');
    const mitico = pesoDeAfijo('Mítico');
    const divino = pesoDeAfijo('Divino');

    check('pesos: el orden es Raro > Épico > Legendario > Mítico > Divino',
      raro > epico && epico > legendario && legendario > mitico && mitico > divino,
      `[${r3(raro)} ${r3(epico)} ${r3(legendario)} ${r3(mitico)} ${r3(divino)}]`);

    check('pesos: un Divino es al menos 10 veces más raro que un Raro',
      raro / divino >= 10, `razón=${r3(raro / divino)}`);

    check('pesos: una rareza inventada no rompe el sorteo',
      Number.isFinite(pesoDeAfijo('Rarísimo')) && pesoDeAfijo('Rarísimo') > 0);
  }

  // =========================================================================
  // 8b · Y QUE EL SORTEO REAL USE ESOS PESOS. ESTA ES LA FILA QUE FALTABA.
  //
  //     Las ocho de arriba pasaban con la tabla vieja. Medían `pesoDeAfijo()` —
  //     una función que existía, estaba escrita, documentada y **no la llamaba
  //     nadie**: los dos sorteos tenían la aritmética contra `RARITY_WEIGHT`, la
  //     del potencial. El endurecimiento estaba en el código y en las pruebas, y
  //     en el juego un Divino seguía saliendo 3,6 veces más raro que un Raro, que
  //     es justo lo que se pidió arreglar.
  //
  //     Es el tercer caso del mismo fallo del lote —código que existe, función
  //     que existe, prueba que mide la función—, así que aquí no se mide el peso
  //     sino **la distribución que sale de verdad**. Si alguien vuelve a
  //     desconectar la tabla, esto se cae.
  // =========================================================================
  {
    const tiradas = 3000;
    let divinos = 0, conRaro = 0;
    for (let i = 0; i < tiradas; i++) {
      const afijos = afijosParaRareza('Legendario');
      if (afijos.includes('aff_void')) divinos++;
      if (afijos.some((id: string) => RARO_IDS.has(id))) conRaro++;
    }
    // **EL UMBRAL SALE DE LA CUENTA, NO DE LA IDEA QUE TENÍA DE ÉL.** El Divino
    // pesa 0,05 sobre un total de 6,24, o sea un 0,8 % por sorteo; en un item
    // Legendario, que saca 3 afijos sin repetición, son ~2,5 %. Antes, con
    // `RARITY_WEIGHT`, el mismo cálculo daba ~9,5 %. Lo que se afirma es el orden
    // de magnitud: **una fracción de lo que era**, con margen para el dado y
    // suficiente separated para que desconectar la tabla se caiga.
    const pctDivinos = (divinos / tiradas) * 100;
    check('sorteo real: un Divino sale mucho menos que antes (~9,5 %) — menos del 4 %',
      pctDivinos < 4,
      `${divinos}/${tiradas} = ${pctDivinos.toFixed(2)} % (antes ~9,5 %)`);

    // Y un Raro tiene que ser lo habitual: son cuatro en el catálogo y llenan el
    // grueso de los huecos. Si esto baja, la curva se cerró de más y el afijo
    // común pasaría a ser el Épico, que es justo lo que se quería evitar.
    const pctRaros = (conRaro / tiradas) * 100;
    check('sorteo real: algún Raro sale en más de la mitad de las veces',
      pctRaros > 50, `${pctRaros.toFixed(1)} % trae al menos un Raro`);
  }

  // =========================================================================
  // 9 · LO QUE SE ENSEÑA ES LO QUE SE COBRA, Y EL RANGO DICE DÓNDE CAE.
  //
  //    Esta es la parte que el encargo pedía y que la ficha no hacía: la línea
  //    decía `description`, que es la magnitud de catálogo, para cualquier item. Un
  //    Baluarte de T2 con valor 0,8 enseñaba "+35 %" y cobraba +22 %. El número de
  //    la ficha sale ahora de `textoDeAfijo()`, que compone desde la misma función
  //    que cuenta el daño, así que por construcción no pueden separarse.
  // =========================================================================
  {
    // Con el valor de catálogo (1) el texto tiene que decir lo que siempre dijo.
    const neutro = textoDeAfijo('aff_bulwark', { valor: 1, tier: 5 });
    check('texto: al valor 1 dice la magnitud de catálogo',
      neutro?.magnitud === '+35 %', `dijo "${neutro?.magnitud}"`);

    // Y con un valor distintoTIENE que decir otra cosa: ese es todo el punto.
    const caro = textoDeAfijo('aff_bulwark', { valor: 1.3, tier: 5 });
    check('texto: con un valor alto dice más que el catálogo',
      caro?.magnitud === '+45.5 %', `dijo "${caro?.magnitud}"`);

    // El T2 paga menos que el T5 con el MISMO afijo y el MISMO valor. Es la
    // pregunta del encargo: "es lo mismo tener un T2 con Baluarte que un T5".
    const t2 = textoDeAfijo('aff_bulwark', { valor: 1, tier: 2 });
    const t5 = textoDeAfijo('aff_bulwark', { valor: 1, tier: 5 });
    check('texto: el mismo afijo en T2 y en T5 NO dice lo mismo',
      t2?.magnitud !== t5?.magnitud, `T2="${t2?.magnitud}" T5="${t5?.magnitud}"`);

    // El rango sale escalado al tier, no el de catálogo: si no, el jugador tiene
    // que dividir para juzgar su propio tiro.
    check('texto: el rango sale cuando el afijo se salió del 1',
      (caro?.rango ?? '').startsWith('rango'), `rango="${caro?.rango}"`);

    // Y al 1 exacto no hay rango: un "28 %–28 %" ocupa la línea sin informar.
    check('texto: al valor exacto no hay rango',
      neutro?.rango === '', `rango="${neutro?.rango}"`);

    // La prosa es la del catálogo, para que el texto siga leyéndose natural.
    check('texto: la prosa es la del catálogo',
      neutro?.prosa === 'a la recolección por click', `prosa="${neutro?.prosa}"`);

    check('texto: un afijo inventado no rompe la ficha',
      textoDeAfijo('aff_inventado') === null);

    // Los afijos con varios efectos enseñan TODOS, no el primero que se encuentre.
    const primo = textoDeAfijo('aff_prime', { valor: 1, tier: 5 });
    check('texto: un afijo con dos efectos enseña los dos',
      (primo?.magnitud.match(/\+/g) ?? []).length === 2, `dijo "${primo?.magnitud}"`);

    // Los por-nivel dependen del nivel, así que el texto no puede ser el mismo en
    // un item en 0 y en uno en 30.
    const eterno0 = textoDeAfijo('aff_eternal', { valor: 1, tier: 5, nivel: 0 });
    const eterno30 = textoDeAfijo('aff_eternal', { valor: 1, tier: 5, nivel: 30 });
    check('texto: un afijo por nivel enseña el nivel del item',
      eterno0?.magnitud !== eterno30?.magnitud,
      `n0="${eterno0?.magnitud}" n30="${eterno30?.magnitud}"`);
  }

  // =========================================================================
  // 10 · LA FACHILLA USA ESA FUNCIÓN, NO `description`.
  //
  //     Un banco no lee HTML —el pin del almacén lo lleva `domStub`—, así que lo
  //     que se afirma aquí es lo que la ficha ya no puede hacer: volver a pintar la
  //     magnitud de catálogo. Si alguien cambia el `title` de la ficha para enseñar
  //     `a.description`, esta fila no lo caza; lo caza `leyendaCheck` y el ojo.
  //     Lo que sí afirma es que la función existe, devuelve texto, y que para
  //     todos los afijos del catálogo.
  // =========================================================================
  {
    for (const a of AFFIXES) {
      const t = textoDeAfijo(a.id, { valor: 1, tier: 5, nivel: 10 });
      if (!t || !t.magnitud || !t.prosa) {
        check(`ficha: ${a.name} compone su línea`, false, JSON.stringify(t));
        break;
      }
    }
    check('ficha: TODOS los afijos del catálogo componen su línea', true);

    // Y que la prosa de cada uno sea de verdad la cola de su descripción: es lo
    // que garantiza que `description` no se queda vieja sola. El punto final no
    // cuenta —`description` es una frase y `prosa` es una frase pegada a un
    // número— y por eso se quitan los dos.
    const descSinNumero = (d: string) =>
      d.replace(/^\+[\d.,]+\s*%?\s*/, '').replace(/\.+\s*$/, '').trim();
    const sinNumero = AFFIXES.every((a: any) => descSinNumero(a.description) === a.prosa.trim());
    check('ficha: la prosa es la cola de la descripción, sin el número',
      sinNumero,
      AFFIXES.filter((a: any) => descSinNumero(a.description) !== a.prosa.trim())
        .map((a: any) => `${a.id}("${descSinNumero(a.description)}" vs "${a.prosa}")`).join(' '));
  }

  // =========================================================================
  // 11 · LA FORJA HEREDA EL VALOR. Y es lo que hace que elegir materiales valga.
  //
  //     Con `affixVals: {}` en el item forjado, todos los afijos de una forja
  //     salían a 1: el catálogo entero valía lo mismo en cualquier item, y la
  //     decisión de la forja —"estos dos materiales o estos otros"— no movía nada
  //     del resultado. Eso vaciaba la forja de la única elección que tiene.
  // =========================================================================
  {
    const padre = (id: string, affixes: string[], vals: Record<string, number>) =>
      ({ affixes, affixVals: vals });

    // 1 · Los dos padres lo traen: media exacta.
    const ambos = heredaValoresDeAfijo(
      [padre('a', ['aff_bulwark'], { aff_bulwark: 1.0 }),
       padre('b', ['aff_bulwark'], { aff_bulwark: 1.2 })],
      ['aff_bulwark']);
    check('forja: dos padres con el afijo → la media de los dos valores',
      r3(ambos.aff_bulwark) === r3(1.1), `valió ${r3(ambos.aff_bulwark)}`);

    // 2 · Solo uno lo tiene: se hereda TAL CUAL, sin promediar contra un 1.
    //    Promediar contra 1 bajaría el afijo de un material bueno por el hecho de
    //    combinarlo con uno que no lo trae: castigar haber encontrado algo bueno.
    const uno = heredaValoresDeAfijo(
      [padre('a', ['aff_bulwark'], { aff_bulwark: 1.25 }),
       padre('b', [], {})],
      ['aff_bulwark']);
    check('forja: un solo padre lo trae → se hereda tal cual, sin bajar a la media',
      r3(uno.aff_bulwark) === r3(1.25), `valió ${r3(uno.aff_bulwark)} (la media con 1 sería 1,125)`);

    // 3 · Un padre de una partida VIEJA: no trae `affixVals`, sus afijos valen 1,
    //    y cuenta como que lo trae. Si se decidiera por el valor en vez de por los
    //    ids, la primera forja de una partida vieja tiraría la mitad de los valores.
    const viejoSinValores = heredaValoresDeAfijo(
      [{ affixes: ['aff_bulwark'] }, padre('b', ['aff_bulwark'], { aff_bulwark: 1.2 })],
      ['aff_bulwark']);
    check('forja: un padre viejo sin `affixVals` cuenta como que lo trae',
      r3(viejoSinValores.aff_bulwark) === r3(1.1),
      `valió ${r3(viejoSinValores.aff_bulwark)} (si lo ignorase, sería 1)`);

    // 4 · Ni lo trae ninguno: es afijo nuevo de catálogo y se SORTEA su valor. Si
    //    valiera 1 fijo, todos los afijos heredados valdrían más que los de
    //    relleno, para siempre, y sin que nada lo dijera.
    const s1 = heredaValoresDeAfijo([padre('a', ['aff_sharp'], { aff_sharp: 1.2 }),
                                      padre('b', ['aff_sharp'], { aff_sharp: 1.2 })],
                                     ['aff_void']);
    const s2 = heredaValoresDeAfijo([padre('a', ['aff_sharp'], { aff_sharp: 1.2 }),
                                      padre('b', ['aff_sharp'], { aff_sharp: 1.2 })],
                                     ['aff_void']);
    check('forja: un afijo de relleno se sortea su valor, no vale 1 fijo',
      s1.aff_void !== s2.aff_void || r3(s1.aff_void) !== r3(1),
      `dos sorteos: ${r3(s1.aff_void)} y ${r3(s2.aff_void)}`);

    // 5 · LA MEDIA NUNCA SALTA EL TECHO. Si el padre más bueno marcara el valor,
    //    tres forjas seguidas de un par bueno llegarían al 1,3 sin esfuerzo.
    const sube = (v: number) => r3(heredaValoresDeAfijo(
      [padre('a', ['aff_bulwark'], { aff_bulwark: v }),
       padre('b', ['aff_bulwark'], { aff_bulwark: v })],
      ['aff_bulwark']).aff_bulwark);
    check('forja: promediar NO sube: dos 1,3 dan 1,3, no más',
      sube(1.3) === r3(1.3), `dos 1,3 → ${sube(1.3)}`);
    check('forja: y el techo no se puede saltar',
      sube(VALOR_AFIJO_MAX) <= VALOR_AFIJO_MAX, `sube=${sube(VALOR_AFIJO_MAX)}`);
    check('forja: forjar dos buenos nunca da un valor flojo',
      sube(VALOR_AFIJO_MIN) >= VALOR_AFIJO_MIN, `sube=${sube(VALOR_AFIJO_MIN)}`);

    // 6 · LA REGLA QUE LA HACE ÚTIL: mejores padres, mejor item. Sin esto, toda
    //    esta función podría devolver siempre 1 y las pruebas de arriba pasarían.
    const conBuenos = heredaValoresDeAfijo(
      [padre('a', ['aff_bulwark'], { aff_bulwark: 1.3 }),
       padre('b', ['aff_bulwark'], { aff_bulwark: 1.3 })], ['aff_bulwark']).aff_bulwark;
    const conFlojos = heredaValoresDeAfijo(
      [padre('a', ['aff_bulwark'], { aff_bulwark: 0.7 }),
       padre('b', ['aff_bulwark'], { aff_bulwark: 0.7 })], ['aff_bulwark']).aff_bulwark;
    check('forja: mejores padres → item mejor (esto es lo que la hace útil)',
      conBuenos > conFlojos, `buenos=${r3(conBuenos)} flojos=${r3(conFlojos)}`);
  }

  // =========================================================================
  // 12 · Y LA FORJA DE VERDAD USA ESA REGLA, NO OTRA.
  //
  //     Los casos de arriba son la función pura. Este comprueba que el item que
  //     nace de la forja trae los valores, que es donde se había quedado a medias:
  //     `affixVals: {}` en el recolector y nada en el compañero.
  // =========================================================================
  {
    // `attemptForge` se llama **desde `data/crafting`**, no desde el game loop, y
    // con otra firma: `[materiales, tier, autor, opciones]`. La primera versión de
    // esta comprobación lo llamó como si fuera método del loop y sin forzar el
    // dado, así que la forja falló, no hubo item, y las dos filas dijeron "salió
    // undefined" —que es lo que pasa cuando se afirma sobre algo que no se creó.
    const padre = (id: string, vals: Record<string, number>) =>
      collector(id, 3, { rarity: 'Épico', affixes: ['aff_bulwark'], affixVals: vals });
    const opciones = { craftLuck: 0, consolationBonus: 0, stonesUsed: 0, nanoUsed: 0, eterUsed: 0 };

    // El dado va clavado a 0: el acierto es la primera tirada y 0 siempre acierta.
    const r = conRoll(0, () => attemptForge(
      [padre('m1', { aff_bulwark: 1.3 }), padre('m2', { aff_bulwark: 1.3 })],
      3, 'X', opciones));
    const forjado = r?.collector;

    check('forja real: el recolector forjado trae valor de afijo',
      !!forjado && !!forjado.affixVals && Object.keys(forjado.affixVals).length > 0,
      `affixVals=${JSON.stringify(forjado?.affixVals)}`);
    check('forja real: y el afijo heredado conserva la calidad de los padres',
      forjado?.affixVals?.aff_bulwark === 1.3,
      `padres a 1,3 y salió ${forjado?.affixVals?.aff_bulwark}`);
    check('forja real: hay un valor para cada afijo del item',
      forjado?.affixes?.length === Object.keys(forjado?.affixVals ?? {}).length,
      `afijos=${forjado?.affixes?.length} valores=${Object.keys(forjado?.affixVals ?? {}).length}`);

    // Y el compañero, que tenía el mismo `{}` y que este lote también arregla.
    const comp = (id: string, vals: Record<string, number>) =>
      companion(id, 3, { rarity: 'Épico', affixes: ['aff_bulwark'], affixVals: vals });
    const rc = conRoll(0, () => attemptForgeCompanion(
      [comp('c1', { aff_bulwark: 1.3 }), comp('c2', { aff_bulwark: 1.3 })],
      3, opciones));
    check('forja real: el compañero forjado también hereda el valor',
      rc?.companion?.affixVals?.aff_bulwark === 1.3,
      `salió ${rc?.companion?.affixVals?.aff_bulwark}`);
  }

  // =========================================================================
  // 14 · EL PRECIO SIGUE AL VALOR. Sin esto, el rango no existe en el juego.
  //
  //     Es lo que faltaba para que buscar buenos materiales tuviera recompensa:
  //     la forja heredaba valores y la ficha los enseñaba, pero `affixValueMult()`
  //     leía `a.effect` —la magnitud de catálogo—, así que un Baluarte de 1,3 y
  //     uno de 0,7 se vendían por lo mismo. El rango se veía en la ficha y no
  //     existía en el mercado.
  //
  //     Y de nuevo lo que se mide es el **precio final**, no el multiplicador: una
  //     prueba que solo comprobara `affixValueMult()` volvería a pasar con la
  //     función desconectada del resto, que es como llegaba esta.
  // =========================================================================
  {
    const arma = (id: string, vals: Record<string, number>, over: any = {}) =>
      collector(id, 5, { rarity: 'Épico', affixes: ['aff_bulwark'], affixVals: vals, ...over });

    const barato = sellPrice(arma('v-bajo', { aff_bulwark: VALOR_AFIJO_MIN }));
    const medio = sellPrice(arma('v-med', { aff_bulwark: 1 }));
    const caro = sellPrice(arma('v-alto', { aff_bulwark: VALOR_AFIJO_MAX }));

    check('precio: un afijo de valor alto vale más que uno de valor bajo',
      caro > barato,
      `bajo=${Math.round(barato)} alto=${Math.round(caro)}`);
    check('precio: y el orden es el del valor, sin saltos',
      barato < medio && medio < caro,
      `${Math.round(barato)} < ${Math.round(medio)} < ${Math.round(caro)}`);

    // El caso que de verdad importa: **el mejor item de un jugador no se vende
    // por lo mismo que su peor item del mismo tier**.
    check('precio: dos items del mismo tier con el mismo afijo NO valen igual',
      Math.abs(barato - caro) / barato > 0.1,
      `diferencia del ${(((caro - barato) / barato) * 100).toFixed(1)} %`);

    // Y el tier: el mismo afijo rinde más en un tier alto, así que vale más.
    const t3 = sellPrice(collector('v-t3', 3, { rarity: 'Épico', affixes: ['aff_bulwark'], affixVals: { aff_bulwark: 1 } }));
    const t8 = sellPrice(collector('v-t8', 8, { rarity: 'Épico', affixes: ['aff_bulwark'], affixVals: { aff_bulwark: 1 } }));
    check('precio: el mismo afijo en un tier alto vale más que en uno bajo',
      t8 > t3, `T3=${Math.round(t3)} T8=${Math.round(t8)}`);

    // Un item viejo sin valores se valúa por la magnitud de catálogo, no por un
    // número que no existe. Y no revienta: es el caso de toda partida guardada
    // antes de que existiera el campo.
    let viejo = 0;
    try { viejo = sellPrice(collector('v-viejo', 5, { rarity: 'Épico', affixes: ['aff_bulwark'] })); }
    catch (e) { /* se ve en la fila de abajo */ }
    check('precio: un item sin `affixVals` se valúa igual que con valor 1',
      Math.round(viejo) === Math.round(medio),
      `sin campo=${Math.round(viejo)} con 1=${Math.round(medio)}`);

    // El desglose que ve el jugador tiene que enseñar el número final, no el
    // catálogo: si el diálogo dijera una cosa y el botón cobrara otra, es R3 roto.
    // La fila es `{etiqueta, mult, suma}`, y dice "N afijo(s)".
    const conAlto = valuationConCifras(arma('v-cifras', { aff_bulwark: VALOR_AFIJO_MAX }));
    const conUno = valuationConCifras(arma('v-cifras', { aff_bulwark: 1 }));
    const filaAlto = conAlto.find(c => String(c.etiqueta ?? '').includes('afijo'));
    const filaUno = conUno.find(c => String(c.etiqueta ?? '').includes('afijo'));
    check('precio: el desglose del diálogo enseña el multiplicador real',
      !!filaAlto && !!filaUno && filaAlto.mult > filaUno.mult,
      `con 1,3 → ×${filaAlto?.mult?.toFixed(3)}; con 1 → ×${filaUno?.mult?.toFixed(3)}`);
  }

  resumen('el valor de cada afijo');
}

export default main();
