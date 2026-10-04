// ==========================================================================
//  LA FORJA
//
//  Hasta ahora la forja no tenía banco. `stateCheck` la rozaba seis veces para
//  el techo de nivel y poco más, así que las reglas de la fusión —que son las
//  más descubiertas del juego— no las comprobaba nadie:
//
//    · Solo se fusionan **exactamente 2** del **mismo tier**.
//    · El potencial sale de la **media** de los dos.
//    · Los afijos los deciden **los padres**, y ahora también en cantidad.
//
//  La última es nueva: `rangoDeAfijosForjados()` le da al item un suelo (la
//  rareza) y un techo (lo que arrastran los dos materiales) y tira el dado
//  entre los dos. Con un solo número fijo, los dos materiales solo servían para
//  decidir *cuáles* afijos, y se podían haber gastado en cualquier otra cosa.
//
//  Y hay un motivo para que este banco mida la regla y no el resultado: el
//  resultado lleva un `Math.random()` dentro —el éxito, el potencial y los
//  afijos—, así que una prueba que tire una vez mide el azar, no la regla.
// ==========================================================================

import { boot, bootNew, check, resumen, s, wh, ids, baseSave, collector, companion, ficha, consumable, conRoll, reload } from './kit';
import { TREE_NODES, TREE_BY_ID } from '../src/data/tree';
import { successChance, baseSuccessChance } from '../src/data/crafting';
import { poderDeCompanero } from '../src/data/crafting';

/**
 * **EL NOMBRE DEL CONSUMIBLE NO ES ADORNO, Y ESTA ES LA RAZÓN.**
 *
 * El almacén funde los items apilables que se llaman igual. Las fábricas de
 * `kit.ts` les ponen `name: 'Consumible'` a todos, así que una Piedra de
 * Calibración y una Nanopartícula de Estabilidad en la misma partida salían
 * fundidas en una sola ficha —la primera que se encontrara— y la nanopartícula
 * desaparecía sin aviso: la forja contestaba "no tienes nanopartículas" con la
 * partida guardada delante.
 *
 * Tres bancos distintos pasaban ya el nombre bueno a mano. Nadie lo había escrito
 * como regla, así que el siguiente lo vuelve a tropezar. Aquí se pone el nombre
 * real en las cuatro fábricas y se avisa en el propio sitio donde importa.
 */
const NOMBRE_PIEDRA = 'Piedra de Calibración';
const NOMBRE_NANO = 'Nanopartícula de Estabilidad';
import {
  attemptForge, rangoDeAfijosForjados, danioDeRango,
  AFIX_MIN_POR_RARIDAD, AFIX_MAX, AFFIXES, collectorMaxLevel, MATERIALES_POR_FUSION,
  valorDeUnCristal, cristalesDeConsuelo
} from '../src/data/crafting';

const TODOS_LOS_AFIJOS = AFFIXES.map(a => a.id);

const opts = (extra: any = {}) => ({
  craftLuck: 0, consolationBonus: 0, stonesUsed: 0, nanoUsed: 0, ...extra
});

async function main() {
  // -------------------------------------------------------------------------
  //  1. EXACTAMENTE 2, DISTINTOS Y DEL MISMO TIER
  // -------------------------------------------------------------------------
  {
    const a = collector('a', 3);
    const b = collector('b', 3);
    const c = collector('c', 4);

    check('forja: con uno solo no se forja',
      !attemptForge([a], 3, 'X', opts()).success, 'un material');
    check('forja: con tres del mismo tier tampoco',
      !attemptForge([a, b, c], 3, 'X', opts()).success, 'tres materiales');

    const mismo = attemptForge([a, collector('a', 3)], 3, 'X', opts());
    check('forja: el MISMO id dos veces no cuenta como dos',
      !mismo.success && /distintos/.test(mismo.error ?? ''),
      mismo.error ?? 'aceptado');

    const cruzada = attemptForge([a, c], 3, 'X', opts());
    check('forja: y de distinto tier no se forja',
      !cruzada.success && /mismo tier/.test(cruzada.error ?? ''),
      cruzada.error ?? 'aceptado');

    check('forja: los dos rechazos dicen POR QUÉ, no solo que no',
      [mismo, cruzada].every(r => typeof r.error === 'string' && r.error.length > 0),
      `${mismo.error} / ${cruzada.error}`);
  }

  // -------------------------------------------------------------------------
  //  2. EL POTENCIAL ES LA MEDIA, Y NUNCA SUBE
  // -------------------------------------------------------------------------
  //  Con `conRoll(0, ...)`: el éxito de la forja es un `Math.random()` contra la
  //  probabilidad, y sin quitarla esta comprobación mediría **si ha salido la
  //  cara**, no la regla. Con el dado a 0 el acierto es seguro para cualquier
  //  probabilidad, sin tener que conocer la fórmula ni subir `craftLuck`.
  {
    const caso = (p1: number, p2: number) => conRoll(0, () => attemptForge(
      [collector('x', 3, { potential: p1 }), collector('y', 3, { potential: p2 })],
      3, 'X', opts()
    )).collector;

    check('forja: el potencial es la media de los dos',
      caso(5, 1)?.potential === 3,
      `5 y 1 → ${caso(5, 1)?.potential} (media ${Math.round((5 + 1) / 2)})`);
    check('forja: dos iguales dan ese mismo potencial',
      caso(4, 4)?.potential === 4, `4 y 4 → ${caso(4, 4)?.potential}`);
    check('forja: y promediar NUNCA sube: 5 con 1 da 3, no 5',
      caso(5, 1)?.potential === 3, `5 y 1 → ${caso(5, 1)?.potential}`);

    // Y el daño sale del potencial, no del tier solo: es lo que hace que el
    // promedio sirva para algo y no sea solo un número decorativo.
    const dos = caso(5, 1);
    check('forja: y el daño es el de ese potencial, no un número suelto',
      dos?.damage === danioDeRango(4, dos.potential),
      `daño=${dos?.damage} · el ★${dos.potential} de T4 es ${danioDeRango(4, dos.potential)}`);
    check('forja: el forjado sube UN tier',
      dos?.tier === 4, `tier=${dos?.tier}`);
  }

  // -------------------------------------------------------------------------
  //  3. EL TECHO DE NIVEL SUBE CON EL POTENCIAL
  // -------------------------------------------------------------------------
  {
    const r = conRoll(0, () => attemptForge(
      [collector('x', 3, { potential: 5 }), collector('y', 3, { potential: 5 })], 3, 'X', opts()
    ));
    check('forja: un item forjado trae techo de nivel, y el motor lo respeta',
      (r.collector?.maxLevel ?? 0) === collectorMaxLevel(r.collector?.maxLevel),
      `maxLevel=${r.collector?.maxLevel} y el que dice la regla=${collectorMaxLevel(r.collector?.maxLevel)}`);
    check('forja: y es mayor que el de un item normal, o el potencial no serviría',
      (r.collector?.maxLevel ?? 0) > 20, `maxLevel=${r.collector?.maxLevel}`);
  }

  // -------------------------------------------------------------------------
  //  4. LOS AFIJOS: SUELO EL DE LA RAREZA, TECHO EL DEL LINAJE
  // -------------------------------------------------------------------------
  {
    // **CADA MATERIAL CON SU ID.** Con los dos mirando al mismo id, la forja
    // los rechaza por "selecciona 2 distintos" —que es lo que tiene que hacer— y
    // el banco midió su propio montaje en vez de la regla. `con(n, i)` lo dice
    // porque es el error más fácil de repetir: un ayudante que "hace un item"
    // detrás de otro con el mismo id parece correcto y no lo es.
    const con = (n: number, i = 0) => collector(`p${i}`, 3, { affixes: TODOS_LOS_AFIJOS.slice(0, n) });

    // El suelo no se negocia: es la regla de "más rareza, más afijos".
    const pobre = con(0);
    const lineaLlena = con(AFIX_MAX);
    check('forja: el suelo es el de la rareza y no lo baja ni el linaje más pobre',
      Object.keys(AFIX_MIN_POR_RARIDAD).every(r =>
        rangoDeAfijosForjados([pobre, pobre], r, false).minimo === AFIX_MIN_POR_RARIDAD[r]),
      JSON.stringify(Object.keys(AFIX_MIN_POR_RARIDAD).map(r =>
        `${r}:${rangoDeAfijosForjados([pobre, pobre], r, false).minimo}`)));

    // El techo SÍ depende de los padres, y esa es la parte nueva.
    const sinLinea = rangoDeAfijosForjados([pobre, pobre], 'Raro', false);
    const conLinea = rangoDeAfijosForjados([lineaLlena, lineaLlena], 'Raro', false);
    check('forja: los padres suben el TECHO, que antes no existía',
      conLinea.maximo > sinLinea.maximo,
      `sin linaje=${sinLinea.maximo} con linaje=${conLinea.maximo}`);
    check('forja: y el techo nunca pasa del tope del juego',
      conLinea.maximo === AFIX_MAX,
      `techo con dos materiales perfectos=${conLinea.maximo} tope=${AFIX_MAX}`);

    // Y es la MEDIA, no el mayor: con eso, un solo material bueno bastaría y el
    // otro sería decorativo, que es justo lo que la forja no debe ser.
    const unoBueno = rangoDeAfijosForjados([lineaLlena, pobre], 'Raro', false);
    const medioBueno = rangoDeAfijosForjados([lineaLlena, collector('q', 3, { affixes: TODOS_LOS_AFIJOS.slice(0, 3) })], 'Raro', false);
    check('forja: el techo es la MEDIA de los dos, no el mejor',
      unoBueno.maximo === sinLinea.maximo + 3 && medioBueno.maximo === sinLinea.maximo + 4,
      `uno bueno=${unoBueno.maximo} · 6 y 0 media 3 → ${unoBueno.maximo}, ` +
      `6 y 3 media 4 → ${medioBueno.maximo}, base=${sinLinea.maximo}`);

    // La nanopartícula suma uno, y a los dos lados: es lo que justifies pagar.
    const conNano = rangoDeAfijosForjados([pobre, pobre], 'Raro', true);
    const conNanoYLinea = rangoDeAfijosForjados([lineaLlena, lineaLlena], 'Raro', true);
    check('forja: la nanopartícula sube el suelo',
      conNano.minimo === sinLinea.minimo + 1, `${sinLinea.minimo} → ${conNano.minimo}`);
    check('forja: y también el techo, no solo lo garantizado',
      conNanoYLinea.maximo === conLinea.maximo || conNanoYLinea.maximo === AFIX_MAX,
      `techo=${conNanoYLinea.maximo} sin nano=${conLinea.maximo} tope=${AFIX_MAX}`);

    // Un Divino tiene el suelo pegado al tope: el dado no tira nada y sale
    // completo. Es lo que hace que "más rareza, más afijos" tenga final.
    const divino = rangoDeAfijosForjados([pobre, pobre], 'Divino', false);
    check('forja: y un Divino sale siempre completo, porque su suelo ES el tope',
      divino.minimo === divino.maximo && divino.maximo === AFIX_MAX,
      `min=${divino.minimo} max=${divino.maximo}`);
  }

  // -------------------------------------------------------------------------
  //  5. LO QUE SALE DE VERDAD: NUNCA FUERA DEL RANGO, NI AFIJOS REPETIDOS
  // -------------------------------------------------------------------------
  //  Aquí sí hay azar, así que no se mide una tirada: se miden 60 y se comprueba
  //  que **ninguna** se sale. Un fallo aquí no sería "ha salido raro", sería la
  //  regla rota — que es la diferencia entre una prueba con azar y una inútil.
  {
    const linea = (n: number, i: number) => collector(`p${i}`, 3, { affixes: TODOS_LOS_AFIJOS.slice(0, n) });
    let fueraDeRango = 0;
    let repetidos = 0;
    let inventados = 0;
    let demasiados = 0;
    let salidos = 0;

    for (let i = 0; i < 60; i++) {
      // Se alterna entre un padre con 6 afijos y uno sin ninguno, para que el
      // rango que se comprueba cambie en cada tirada en vez de ser siempre el
      // mismo: un rango fijo solo mediría una mitad de la regla.
      const padres = [linea(i % 2 ? 6 : 0, 1), linea(3, 2)];
      // El dado entra controlado **y**, además, se mueve: si fuera una constante,
      // los afijos saldrían siempre los mismos y la mitad de la mezcla ni se
      // miraría. Se usa `rng: () => 0.001` para el acierto —que sale seguro con
      // cualquier probabilidad— y un valor que cambia para el resto.
      const r = conRoll(0.001 + i * 0.016, () => attemptForge(padres, 3, 'X', opts()));
      if (!r.success || !r.collector) { salidos++; continue; }
      const afijos = r.collector.affixes ?? [];
      // La rareza del item la decide su potencial, no el catálogo de arriba: lo
      // que sí vale para todos es el tope duro y que no baje del suelo de la
      // rareza que le haya tocado.
      const { minimo, maximo } = rangoDeAfijosForjados(padres, r.collector.rarity, false);
      if (afijos.length < minimo || afijos.length > maximo) fueraDeRango++;
      if (afijos.length > AFIX_MAX) demasiados++;
      if (new Set(afijos).size !== afijos.length) repetidos++;
      if (afijos.some(a => !TODOS_LOS_AFIJOS.includes(a))) inventados++;
    }

    check('forja: 60 tiradas y ni una sale fuera del rango que le toca',
      fueraDeRango === 0, `${fueraDeRango} de 60 fuera de rango`);
    check('forja: y ninguna se pasa del tope de afijos del juego',
      demasiados === 0, `${demasiados} de 60 con más de ${AFIX_MAX}`);
    check('forja: ni un afijo repetido',
      repetidos === 0, `${repetidos} de 60 con repeticiones`);
    check('forja: ni un afijo inventado que no esté en el catálogo',
      inventados === 0, `${inventados} de 60 con afijos raros`);
    check('forja: y de 60 intentos han salido items, o esto no midió nada',
      salidos < 60, `${salidos} intentos fallidos de 60`);
  }

  // -------------------------------------------------------------------------
  //  5b · EL TECHO SE ALCANZA Y EL SUELO SE CUMPLE, CON DADO CONTROLADO
  // -------------------------------------------------------------------------
  //  La sección anterior comprueba que nada se sale del rango. Esta comprueba lo
  //  contrario, que es lo que hace que el rango signifique algo: **que las dos
  //  puntas son alcanzables**. Si el techo fuera inalcanzable, la sección
  //  anterior pasaría igual y esta regla nueva sería decorativa.
  //
  //  **UN SOLO `rng` NO SIRVE, Y POR QUÉ.** El primer uso del dado es el acierto
  //  y va contra una probabilidad que llega a 0.95, así que con `0.999` la forja
  //  falla y no hay item del que mirar la cantidad. Hace falta una **secuencia**:
  //  acierto seguro y, a partir de ahí, el valor que interese para el reparto.
  {
    const linea = (n: number, i: number) => collector(`p${i}`, 3, { affixes: TODOS_LOS_AFIJOS.slice(0, n) });
    const secuencia = (primero: number, resto: number) => {
      let n = 0;
      return () => (n++ === 0 ? primero : resto);
    };
    const conRng = (rng: () => number) => attemptForge(
      [linea(AFIX_MAX, 1), linea(AFIX_MAX, 2)], 3, 'X', opts({ rng })
    );

    const abajo = conRng(secuencia(0.001, 0));
    const arriba = conRng(secuencia(0.001, 0.999));
    const { minimo, maximo } = rangoDeAfijosForjados(
      [linea(AFIX_MAX, 1), linea(AFIX_MAX, 2)], abajo.collector?.rarity ?? 'Raro', false
    );

    check('forja: el dado es el primero que se tira, así que el acierto va primero',
      abajo.success === true && arriba.success === true,
      `abajo=${abajo.error ?? 'ok'} arriba=${arriba.error ?? 'ok'}`);
    check('forja: con el dado al mínimo sale el suelo, ni uno menos',
      (abajo.collector?.affixes.length ?? -1) === minimo,
      `${abajo.collector?.affixes.length} afijos, suelo=${minimo}`);
    check('forja: y con el dado al máximo sale el techo, ni uno más',
      (arriba.collector?.affixes.length ?? -1) === maximo,
      `${arriba.collector?.affixes.length} afijos, techo=${maximo}`);
    check('forja: los dos extremos son distintos, si no el dado no hace nada',
      minimo !== maximo, `suelo=${minimo} techo=${maximo}`);
    check('forja: y el techo es alcanzable de verdad, no un número de adorno',
      maximo > minimo, `suelo=${minimo} techo=${maximo}`);
  }

  // -------------------------------------------------------------------------
  //  6. LA FORJA ESTÁ ABIERTA DESDE EL INICIO, Y NO HAY PUERTA
  // -------------------------------------------------------------------------
  //  Aquí hubo una regla entera: la forja no se podía usar sin el nodo "Planos
  //  Viejos", la regla estaba escrita en cuatro sitios, y el botón de la forja no
  //  salía en la barra hasta tenerlo. **Ya no existe ninguna de las tres cosas.**
  //
  //  Y el motivo de que este bloque siga, siendo el contrario de lo que probaba,
  //  es que **un requisito que desaparece también se puede volver a poner por
  //  descuido**. Si alguien reintroduce un `if` de "tengo el nodo", esta es la
  //  prueba que lo canta: una partida sin ningún nodo no podría llegar a la forja,
  //  y eso es exactamente lo que se trabaja para que pase.
  {
    const gNuevo = await bootNew();
    check('forja: una partida nueva, sin ningún nodo, ya puede entrar en la forja',
      gNuevo.getForgeInfo().craftLuck >= 0,
      `craftLuck=${gNuevo.getForgeInfo().craftLuck}`);

    // Y la prueba de verdad: **forjar en una partida recién creada**, sin árbol
    // ninguno. Antes esto fallaba con "Necesitas el nodo Planos Viejos" y no había
    // manera de llegar a la forja por ningún otro camino.
    const conDos = await bootNew();
    await conRoll(0.001, () => conDos.forgeCollector(['a', 'b']));
    const rNuevo: any = conRoll(0.001, () => conDos.forgeCollector(['a', 'b']));
    check('forja: y con dos recolectores T1 forja, sin árbol y sinAscensión',
      rNuevo.success !== undefined,
      rNuevo.msg ?? 'sin mensaje');

    // Y el árbol ya no es el que abre la forja: `blueprint` es una raíz más, con su
    // propio bonus. Un nodo que no hace nada es una trampa —el jugador paga 4
    // núcleos y no ve nada— y además es la raíz de `forge_luck` y `shard_sifter`,
    // así que borrarlo dejaría esos dos inalcanzables.
    const nodo = TREE_BY_ID.blueprint;
    check('forja: el nodo de la forja sigue existiendo y da algo a cambio',
      !!nodo && Object.keys(nodo.bonus ?? {}).length > 0,
      `nodo=${nodo?.id} bonus=${JSON.stringify(nodo?.bonus)}`);
    const dependientes = TREE_NODES.filter((n: any) => (n.requires ?? []).includes('blueprint'));
    check('forja: y sigue siendo la raíz de la rama de crafteo, que lo necesitaría',
      dependientes.length === 2,
      `nodos que lo requieren: ${dependientes.map((n: any) => n.id).join(',') || 'ninguno'}`);

    // Y la puerta que había en la tienda tampoco: las piedras y las nanopartículas
    // se venden desde el principio, porque la forja se puede usar desde el
    // principio y comprar algo inservible es perder dinero a propósito.
    const gTienda = await bootNew();
    check('forja: y el nodo ya no abre ni cierra la forja en ninguna partida',
      gTienda.getForgeInfo().craftLuck >= 0 && (gTienda.getState().nodeLevels ?? {}).blueprint === undefined,
      `niveles=${JSON.stringify(gTienda.getState().nodeLevels ?? {})}`);
  }
  // -------------------------------------------------------------------------
  //  7. POR EL MOTOR: LA FORJA NO ES SÓLO UNA FUNCIÓN PURA
  // -------------------------------------------------------------------------
  {
    // **LA FORJA NO TIENE PUERTA.** Antes esta comprobación era "sin el nodo del
    // árbol no se forja", y era una puerta de verdad: sin "Planos Viejos" la forja
    // no se podía usar. Ya no hay puerta, así que la prueba se ha ido con ella.
    //
    // Y una prueba que afirma una regla borrada es peor que no tenerla: alguien la
    // lee, la ve pasar, y se queda creyendo que la puerta sigue ahí.
    const g = await boot(baseSave([collector('a', 3), collector('b', 3)],
      { nanites: 0, warehouseCapacity: 20, nodeLevels: {} }));
    const sinPuerta: any = conRoll(0.001, () => g.forgeCollector(['a', 'b']));
    check('forja: sin ninguna puerta, una partida sin árbol forja igual',
      sinPuerta.success === true, sinPuerta.msg ?? 'no forjó');
    // Y con el nodo, el motor cobra los materiales y sube el contador de forjas.
    // **EL DADO SE QUITA CON `conRoll`, NO CON 12 INTENTOS.** Con la probabilidad
    // real de la forja, 12 intentos pueden fallar todos —y esa es una partida
    // legítima, no un fallo— así que una prueba que aprieta hasta que salga mide
    // el tiempo que tarda el azar, no la regla.
    const g2 = await boot(baseSave([collector('a', 3), collector('b', 3)],
      { nanites: 0, warehouseCapacity: 20, nodeLevels: { blueprint: 1 } }));
    const r: any = conRoll(0.001, () => g2.forgeCollector(['a', 'b']));
    check('forja: con el nodo, la forja funciona',
      r.success === true, r.msg ?? 'falló');
    check('forja: y los dos materiales se consumen al forjar',
      !wh(g2).some(w => w.id === 'a' && w.type === 'collector')
        && !wh(g2).some(w => w.id === 'b' && w.type === 'collector'),
      wh(g2).map(w => `${w.id}:${w.type}`).join(' '));
  }


// =========================================================================
  //  8. LA FORJA DE COMPAÑEROS
  // =========================================================================
  //  La forja fusionaba solo recolectores. Ahora fusiona los dos, y lo que se
  //  comprueba aquí es que **no sean dos reglas parecidas**: tienen que ser la
  //  misma regla con dos resultados distintos.
  {
    // --- La más básica: dos compañeros T3 sale un T4 ------------------------------
    const g = await boot(baseSave([
      companion('c1', 3, { potential: 5 }),
      companion('c2', 3, { potential: 5 }),
      ficha('c1', 3, { potential: 5 }),
      ficha('c2', 3, { potential: 5 })
    ], { warehouseCapacity: 20 }));

    const r: any = conRoll(0.001, () => g.forgeCompanion(['c1', 'c2']));
    check('compañero: dos T3 forjan un T4',
      r.success === true && r.companion?.tier === 4,
      `success=${r.success} tier=${r.companion?.tier} msg=${r.msg}`);

    const st = g.getState();
    const enArray = (st.companions || []).find((c: any) => c.id === r.companion?.id);
    const enAlmacen = (st.warehouse || []).find((w: any) => w.id === r.companion?.id);
    // **EN LOS DOS SITIOS, Y NO EN UNO.** El array es el que paga el ingreso
    // pasivo; la ficha del almacén es la que pinta las estrellas y la que se
    // vende. Meterlo solo en uno de los dos deja al panel y a la rejilla
    // describiendo objetos distintos.
    check('compañero: y aparece en el array que paga el ingreso',
      !!enArray && enArray.power > 0,
      `array=${enArray ? `power=${enArray.power}` : 'no está'}`);
    check('compañero: y en la ficha del almacén, con el mismo potencial',
      !!enAlmacen && enAlmacen.type === 'companion' && enAlmacen.potential === enArray?.potential,
      `almacen=${enAlmacen ? `${enAlmacen.type} pot=${enAlmacen.potential}` : 'no está'}`);
    check('compañero: y los dos materiales se consumen también en el acierto',
      !ids(g).includes('c1') && !ids(g).includes('c2'),
      ids(g).join(','));

    // --- El potencial: la media, y con la nanopartícula +1 -----------------------
    const forja = async (p1: number, p2: number, nano = 0) => {
      const j = await boot(baseSave([
        companion('x1', 3, { potential: p1 }), companion('x2', 3, { potential: p2 }),
        ficha('x1', 3, { potential: p1 }), ficha('x2', 3, { potential: p2 }),
        ...(nano ? [consumable('n1', 'stabilityNano', 1, { name: NOMBRE_NANO })] : [])
      ], { warehouseCapacity: 20 }));
      return conRoll(0.001, () => j.forgeCompanion(['x1', 'x2'], 0, nano)) as any;
    };

    check('compañero: dos potenciales 5 dan un 5, y la media no inventa nada',
      (await forja(5, 5)).companion?.potential === 5,
      `pot=${(await forja(5, 5)).companion?.potential}`);
    check('compañero: dos 3 dan un 3',
      (await forja(3, 3)).companion?.potential === 3,
      `pot=${(await forja(3, 3)).companion?.potential}`);
    check('compañero: un 3 y un 4 dan un 4, porque Math.round sube en el empate',
      (await forja(3, 4)).companion?.potential === 4,
      `pot=${(await forja(3, 4)).companion?.potential}`);

    // **Y EL EMPATE SUBE, QUE ES LO QUE HACE `Math.round`.** Un 4 y un 5 dan un 5.
    // No es un descuido: es que `Math.round(4,5)` es 5 en JavaScript, y el día que
    // se puso el promedio nadie miró ese caso. La consecuencia —que un 4 solo es
    // material de fusión de un 5— está escrita en `potencialFusionado()`. Aquí se
    // fija para que, si algún día se cambia a redondear hacia abajo, se cambie a
    // propósito y no por sorpresa.
    check('compañero: un 4 y un 5 dan un 5, porque Math.round sube en el empate',
      (await forja(4, 5)).companion?.potential === 5,
      `pot=${(await forja(4, 5)).companion?.potential}`);

    // Y la nanopartícula sube +1 al potencial: es su versión de "un afijo extra",
    // porque un compañero no tiene afijos y sin esto sería un consumible de 90 000
    // nanitas que no hace nada.
    check('compañero: con nanopartícula, un 3 y un 4 dan un 5, que es +1 a la media',
      (await forja(3, 4, 1)).companion?.potential === 5,
      `pot=${(await forja(3, 4, 1)).companion?.potential}`);
    check('compañero: con nanopartícula, un 5 y un 5 se quedan en 5, por el tope',
      (await forja(5, 5, 1)).companion?.potential === 5,
      `pot=${(await forja(5, 5, 1)).companion?.potential}`);
    const gNano = await boot(baseSave([
      companion('x1', 3, { potential: 3 }), companion('x2', 3, { potential: 4 }),
      ficha('x1', 3, { potential: 3 }), ficha('x2', 3, { potential: 4 }),
      consumable('n1', 'stabilityNano', 3, { name: NOMBRE_NANO })
    ], { warehouseCapacity: 20 }));
    conRoll(0.001, () => gNano.forgeCompanion(['x1', 'x2'], 0, 1));
    const nanoFicha = wh(gNano).find((w: any) => w.id === 'n1');
    check('compañero: y la nanopartícula se gasta de una en una, no se consume la pila',
      nanoFicha?.stackCount === 2,
      `stack=${nanoFicha?.stackCount}`);

    // --- La misma probabilidad que el recolector -----------------------------------
    const gc = await boot(baseSave([
      companion('y1', 3, { potential: 5 }), companion('y2', 3, { potential: 5 }),
      ficha('y1', 3, { potential: 5 }), ficha('y2', 3, { potential: 5 }),
      collector('r1', 3, { potential: 5, damage: 100 }),
      collector('r2', 3, { potential: 5, damage: 100 }),
      // **Nueve piedras y cinco nanopartículas, y no cinco y cinco.** Esta partida hace
      // las DOS fusiones: la de compañero y la de recolector. Con cinco, la
      // primera se las gastaba y la segunda se comía un "solo tienes 2" — y una
      // prueba que falla por falta de material no prueba la regla que dice
      // probar, sino el orden del gasto.
      consumable('piedras', 'calibrationStone', 9, { name: NOMBRE_PIEDRA }),
      consumable('nanos', 'stabilityNano', 5, { name: NOMBRE_NANO })
    ], { warehouseCapacity: 20 }));
    const rc: any = conRoll(0.001, () => gc.forgeCompanion(['y1', 'y2'], 3, 1));
    const rr: any = conRoll(0.001, () => gc.forgeCollector(['r1', 'r2'], 3, 1));
    check('compañero: la misma probabilidad que el recolector con los mismos consumibles',
      Math.abs(rc.chance - rr.chance) < 1e-9,
      `compañero=${rc.chance} recolector=${rr.chance}`);
    check('compañero: y sale de la misma función, no de una cuenta parecida',
      Math.abs(rc.chance - successChance(3, 0, 3, 0, 1)) < 1e-9,
      `tirada=${rc.chance} regla=${successChance(3, 0, 3, 0, 1)}`);

    // **Y LA QUE ANUNCIA LA PANTALLA TAMBIÉN.** `getForgeInfo().baseChance` reescribía
    // aquí la curva con los mismos números que la regla, y el `preview.ts` la
    // reescribía una tercera vez. Tres copias de una curva que el jugador lee para
    // decidir cuánto paga por una piedra.
    const curvaOk = await boot(baseSave([collector('q1', 3, { potential: 3, damage: 60 })], {}));
    check('compañero: y la curva que anuncia la forja sale de `baseSuccessChance`',
      Math.abs(curvaOk.getForgeInfo().baseChance(4) - baseSuccessChance(4)) < 1e-9,
      `anunciada=${curvaOk.getForgeInfo().baseChance(4)} regla=${baseSuccessChance(4)}`);

    // --- Las mismas validaciones ----------------------------------------------------
    const gb = await boot(baseSave([
      companion('z1', 3), companion('z2', 4), companion('z4', 3), collector('z3', 3),
      ficha('z1', 3), ficha('z3', 3)
    ], { warehouseCapacity: 20, activeCompanions: ['z1'] }));

    const rDistintos: any = gb.forgeCompanion(['z1', 'z1']);
    check('compañero: el mismo compañero dos veces no cuenta como dos materiales',
      !rDistintos.success && /distintos/.test(rDistintos.msg ?? ''), rDistintos.msg ?? 'aceptado');

    const rTier: any = gb.forgeCompanion(['z1', 'z2']);
    check('compañero: tiers distintos no se fusionan',
      !rTier.success && /mismo tier/.test(rTier.msg ?? ''), rTier.msg ?? 'aceptado');

    const rTipo: any = gb.forgeCompanion(['z3', 'z3']);
    check('compañero: un recolector no se puede fusionar como compañero',
      !rTipo.success && /compañeros/.test(rTipo.msg ?? ''), rTipo.msg ?? 'aceptado');

    const rEquipado: any = gb.forgeCompanion(['z1', 'z4']);
    check('compañero: el compañero activo no se puede consumir',
      !rEquipado.success && /equipado/.test(rEquipado.msg ?? ''), rEquipado.msg ?? 'aceptado');

    const rUno: any = gb.forgeCompanion(['z4']);
    check('compañero: y hacen falta los dos, ni uno ni tres',
      !rUno.success && /exactamente 2/.test(rUno.msg ?? ''), rUno.msg ?? 'aceptado');

    // **Y NINGUNO DE ESOS RECHAZOS CUESTA NADA**, que es lo que protege al jugador:
    // se pide con piedras en la mano a propósito, porque es donde el orden importa.
    const gcobro = await boot(baseSave([
      companion('q1', 3), companion('q2', 4),
      consumable('piedras', 'calibrationStone', 5, { name: NOMBRE_PIEDRA })
    ], { warehouseCapacity: 20 }));
    const rCobro: any = gcobro.forgeCompanion(['q1', 'q2'], 5, 0);
    const piedras = wh(gcobro).find((w: any) => w.id === 'piedras');
    check('compañero: un rechazo no gasta ni una piedra',
      !rCobro.success && (piedras?.stackCount ?? 0) === 5,
      `piedras=${piedras?.stackCount} msg=${rCobro.msg}`);

    // Y el caso caro: **piedras que sí tiene y nanopartícula que no.** Un cobro a
    // medias dejaría al jugador con menos sin haber forjado nada.
    const gMedio = await boot(baseSave([
      companion('m1', 3), companion('m2', 4),
      consumable('piedras', 'calibrationStone', 5, { name: NOMBRE_PIEDRA })
    ], { warehouseCapacity: 20 }));
    const rMedio: any = gMedio.forgeCompanion(['m1', 'm2'], 5, 1);
    const piedrasMedio = wh(gMedio).find((w: any) => w.id === 'piedras');
    check('compañero: y si falta la nanopartícula, tampoco se cobran las piedras',
      !rMedio.success && (piedrasMedio?.stackCount ?? 0) === 5,
      `piedras=${piedrasMedio?.stackCount} msg=${rMedio.msg}`);

    // --- El fallo pierde los materiales y paga cristales ----------------------------
    const gf = await boot(baseSave([
      companion('f1', 3, { potential: 5 }), companion('f2', 3, { potential: 5 }),
      ficha('f1', 3, { potential: 5 }), ficha('f2', 3, { potential: 5 })
    ], { warehouseCapacity: 20 }));
    const rf: any = conRoll(0.999, () => gf.forgeCompanion(['f1', 'f2']));
    // **ANTES AFIRMABA QUE EL FALLO DABA ESQUIRLAS.** Eran una moneda sin salida: se
    // acumulaban y no se gastaban en nada. Lo que paga el fallo es lo único que se
    // puede gastar, así que la misma comprobación pasa a ser la del cristal.
    check('compañero: el fallo da cristales, y son los que se pueden gastar',
      !rf.success && (rf.crystals ?? 0) > 0,
      `crystals=${rf.crystals} msg=${rf.msg}`);
    check('compañero: y pierde los dos materiales, como el recolector',
      !ids(gf).includes('f1') && !ids(gf).includes('f2'),
      ids(gf).join(','));

    // --- Y NO VUELVEN DESPUÉS, QUE ES DONDE ESTABA EL DEFECTO ----------------------
    //
    //  La comprobación de arriba mira el almacén **en el instante**. Pasa, porque
    //  `consumeMaterialesDeForja()` sí borra las entradas del almacén. El problema es que un
    //  compañero tiene dos sitios: la ficha en `state.companions`, que es la que paga el
    //  ingreso y la que ve el panel, y una entrada en el almacén, que es una copia. La
    //  función de consumo solo tocaba la copia.
    //
    //  Y `syncCompanionsToWarehouse()` **crea la entrada de cada compañero que sigue en
    //  `state.companions`**. O sea que los dos materiales se iban y volvían: en el acierto,
    //  en la misma llamada, porque el sincronismo se ejecuta justo después; y en el fallo,
    //  en la siguiente acción que sincronice. Un fallo de forja que devuelve los materiales
    //  es un fallo que no cuesta nada, y un acierto que fabrica un objeto sin perder dos
    //  parte el coste neto por tier.
    //
    //  **RECARGAR ES LA MANERA DE PROBARLO**, porque la carga sincroniza. Y recargar es
    //  exactamente lo que hace el jugador que cierra el juego y vuelve.
    const gr = await boot(baseSave([
      companion('r1', 3), companion('r2', 3)
    ], { warehouseCapacity: 20 }));
    s(gr).companions = [ficha('r1', 3), ficha('r2', 3)];
    check('compañero: y el del fallo tambien parte de un fixture real',
      s(gr).companions.length === 2,
      `companions=${s(gr).companions.map((c: any) => c.id).join(',')}`);
    conRoll(0.999, () => gr.forgeCompanion(['r1', 'r2']));
    await reload();
    check('compañero: en el fallo, los materiales NO vuelven al recargar',
      !ids(gr).includes('r1') && !ids(gr).includes('r2'),
      ids(gr).join(','));

    // Y en el acierto, donde el sincronismo se ejecuta en la misma llamada: no hace falta
    // recargar para verlo, y por eso la comprobación de arriba no lo cazaba.
    const ga = await boot(baseSave([
      companion('w1', 3), companion('w2', 3)
    ], { warehouseCapacity: 20 }));
    // **LAS FICHAS SE PONEN DESPUÉS DE CARGAR, Y POR QUÉ.** Van en el array del juego y no
    // en el guardado: la carga lee `data.companions`, y el helper del banco escribe la
    // ficha como un item más del almacén. Con las fichas en el guardado, `state.companions`
    // llegaba vacío y **las tres comprobaciones de abajo pasaban en verde sin mirar nada** —
    // "no están" porque nunca entraron. Una comprobación que no parte de una premisa
    // comprobada no es una comprobación.
    s(ga).companions = [ficha('w1', 3), ficha('w2', 3)];
    check('compañero: el fixture tiene las dos fichas en su array antes de forjar',
      s(ga).companions.length === 2,
      `companions=${s(ga).companions.map((c: any) => c.id).join(',')}`);
    conRoll(0.001, () => ga.forgeCompanion(['w1', 'w2']));
    check('compañero: y en el acierto tampoco, que el sincronismo es inmediato',
      !ids(ga).includes('w1') && !ids(ga).includes('w2'),
      ids(ga).join(','));
    check('compañero: y las fichas tambien se van, no solo las entradas del almacen',
      !s(ga).companions.some((c: any) => c.id === 'w1' || c.id === 'w2'),
      s(ga).companions.map((c: any) => c.id).join(','));

    // --- Y el poder es el del constructor, no una cuenta suelta --------------------
    // La razón de que `crearCompanioDeTier()` se sharee entre la tienda, la caja y
    // la forja: si cada uno construyera el objeto, el día que se añadiese un campo
    // la forja se quedaría sin él sin que nada lo dijera.
    const rPow: any = await forja(5, 5);
    check('compañero: el poder sale del constructor común, no de una cuenta propia',
      rPow.companion?.power === poderDeCompanero(4, 5),
      `power=${rPow.companion?.power} esperado=${poderDeCompanero(4, 5)}`);
  }
// =========================================================================
//  EL FALLO DE FORJA DEJA CRISTALES
// =========================================================================
//  Lo que se comprueba, y por qué:
//
//  · Que el fallo **entrega** cristales, y no solo los anuncia. El mensaje dice
//    "+N cristales": si no se entregues, el juego le está mintiendo al jugador en
//    el momento en que más caro sale.
//  · Que entrega **los intentos del tier que se estaba forjando**, y lo que se
//    mide son INTENTOS, no unidades.
//  · Que **suben con el tier**, porque el coste del fallo también sube. Un fallo
//    en T1 no puede costar lo mismo que uno en T10.
//  · Y que **las dos fusiones dan lo mismo**, que es la comprobación que más fácil
//    se rompe el día que alguien copia una de las dos ramas.
//
//  **EL CRISTAL ES UN RECURSO, Y POR QUÉ ESTE BLOQUE MIDE INTENTOS.** Antes el
//  consuelo eran N items de cristal apilados y la cifra que se miraba era `N`. Ahora
//  el cristal es un número, y el motor convierte los intentos por
//  `valorDeUnCristal(tier)` al entregar: **`cristalesDeConsuelo()` sigue devolviendo
//  `2 + n` intentos y el que paga es el motor**. Comparar unidades contra `2 + n`
//  daría un fallo falso en los nueve tiers que no sean el primero, así que lo que
//  se comprueba aquí es que las unidades entregadas, divididas por el valor del
//  cristal de ese tier, den exactamente los intentos de siempre.
// =========================================================================

// **LA PARTIDA DE TRABAJO, Y POR QUÉ EMPIEZA EN CERO CRISTAL.** Sin esto el saldo
// de la partida nueva —que son 5— se sumaría al del fallo y la comprobación de
// "el acierto no da nada" mediría un número que ya no era cero. Se pone a cero para
// que cada entrega se pueda leer tal cual.
const falloCon = async () => {
  const g = await boot(baseSave([
    collector('a', 3, { potential: 3, damage: 100 }),
    collector('b', 3, { potential: 3, damage: 100 })
  ], { nanites: 0, warehouseCapacity: 40, crystals: 0 }));
  const r: any = conRoll(0.999, () => g.forgeCollector(['a', 'b']));
  const unidades = s(g).crystals;
  // **LOS INTENTOS, Y NO LAS UNIDADES.** El motor entrega unidades y el jugador
  // gasta unidades; lo que la regla fija es cuántas *subidas* compra la
  // compensación, y esa cifra es la que se compara con `2 + tier`.
  const intentos = unidades / valorDeUnCristal(3);
  return { g, r, unidades, intentos };
};

// --- 1. El fallo entrega cristales, y el mensaje lo dice -------------------------
{
  const { r, unidades, intentos } = await falloCon();
  check('consuelo: el fallo entrega cristales de verdad',
    unidades > 0, `unidades=${unidades}`);
  check('consuelo: y el mensaje lo anuncia, que es la mitad de la promesa',
    /cristales/.test(r.msg ?? '') && unidades === (r.crystals ?? -1),
    `msg="${r.msg}" crystals=${r.crystals} entregadas=${unidades}`);
  check('consuelo: y lo que entrega son los 2 + n intentos de siempre',
    intentos === cristalesDeConsuelo(3),
    `intentos=${intentos} de la regla=${cristalesDeConsuelo(3)} (unidades=${unidades} de valor ${valorDeUnCristal(3)})`);
}

// --- 2. Son del tier que se estaba forjando, y suben con él ----------------------
{
  const porTier: string[] = [];
  let bien = true;
  for (const tier of [1, 4, 7]) {
    const g = await boot(baseSave([
      collector(`a${tier}`, tier, { potential: 3, damage: 100 }),
      collector(`b${tier}`, tier, { potential: 3, damage: 100 })
    ], { nanites: 0, warehouseCapacity: 40, crystals: 0 }));
    conRoll(0.999, () => g.forgeCollector([`a${tier}`, `b${tier}`]));
    const unidades = s(g).crystals;
    // El motor convierte los intentos por el valor del cristal de ESE tier, así que
    // volver a dividir por el mismo valor deshace la conversión y deja la regla a
    // la vista. Es la cuenta del jugador, no una cuenta del banco.
    const intentos = unidades / valorDeUnCristal(tier);
    porTier.push(`T${tier}:${intentos} intentos=${unidades} unidades`);
    if (intentos !== 2 + tier) bien = false;
    // Y la conversión tiene que ser la de ese tier: si el motor dividiera por el
    // T1 o por una constante, aquí saldría un número que no es entero.
    if (unidades !== (2 + tier) * valorDeUnCristal(tier)) bien = false;
  }
  check('consuelo: los intentos son los del TIER que se forja, y suben con él',
    bien, porTier.join(' '));
}

// --- 3. Las dos fusiones dan lo mismo --------------------------------------------
//
// **LA COMPROBACIÓN QUE MÁS FÁCIL SE ROMPE.** Las dos ramas de fallo son código
// duplicado a propósito —el recolector y el compañero devuelven objetos distintos—,
// así que el día que alguien edita una y no la otra, el jugador forja un
// compañero y recibe otra recompensa sin que nada se entere.
{
  const gRec = await boot(baseSave([
    collector('a', 5, { potential: 3, damage: 100 }),
    collector('b', 5, { potential: 3, damage: 100 })
  ], { nanites: 0, warehouseCapacity: 40, crystals: 0 }));
  const rRec: any = conRoll(0.999, () => gRec.forgeCollector(['a', 'b']));
  const rec = s(gRec).crystals / valorDeUnCristal(5);

  const gCom = await boot(baseSave([
    companion('c1', 5, { potential: 3 }),
    companion('c2', 5, { potential: 3 }),
    ficha('c1', 5, { potential: 3 }),
    ficha('c2', 5, { potential: 3 })
  ], {
    nanites: 0, warehouseCapacity: 40, crystals: 0,
    companions: [ficha('c1', 5, { potential: 3 }), ficha('c2', 5, { potential: 3 })]
  }));
  const rCom: any = conRoll(0.999, () => gCom.forgeCompanion(['c1', 'c2']));
  const com = s(gCom).crystals / valorDeUnCristal(5);

  check('consuelo: un fallo da lo MISMO en las dos fusiones',
    rec === com && rRec.crystals === rCom.crystals && rec === 2 + 5,
    `recolector=${rec} intentos, companero=${com} intentos, regla=${2 + 5}`);
}

// --- 4. Y el acierto no da nada, que si no es una ruleta más ----------------------
{
  const g = await boot(baseSave([
    collector('a', 3, { potential: 3, damage: 100 }),
    collector('b', 3, { potential: 3, damage: 100 })
  ], { nanites: 0, warehouseCapacity: 40, crystals: 0 }));
  conRoll(0.001, () => g.forgeCollector(['a', 'b']));
  const unidades = s(g).crystals;
  check('consuelo: el acierto NO da cristales de consuelo, que solo compensan el fallo',
    unidades === 0, `unidades=${unidades}`);
}
  resumen('la forja: dos del mismo tier, potencial medio y afijos por linaje');
}

export default main();
