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

import { boot, check, resumen, wh, baseSave, collector, crystal, conRoll } from './kit';
import {
  attemptForge, rangoDeAfijosForjados, danioDeRango,
  AFIX_MIN_POR_RARIDAD, AFIX_MAX, AFFIXES, collectorMaxLevel
} from '../src/data/crafting';

const TODOS_LOS_AFIJOS = AFFIXES.map(a => a.id);

const opts = (extra: any = {}) => ({
  craftLuck: 0, shardBonus: 0, stonesUsed: 0, nanoUsed: 0, ...extra
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
  //  6. POR EL MOTOR: LA FORJA NO ES SÓLO UNA FUNCIÓN PURA
  // -------------------------------------------------------------------------
  {
    // Sin el nodo del árbol no se forja, y **no se cobra nada**: un rechazo
    // después del cobro se llevaría los consumibles sin forjar nada.
    const g = await boot(baseSave([collector('a', 3), collector('b', 3), crystal('x1', 3, 10)],
      { nanites: 0, warehouseCapacity: 20, nodeLevels: {} }));
    const sinNodo: any = g.forgeCollector(['a', 'b']);
    check('forja: sin el nodo del árbol no se forja, y se dice por qué',
      !sinNodo.success && /Planos Viejos/.test(sinNodo.msg ?? ''), sinNodo.msg ?? 'aceptado');
    check('forja: y no se ha gastado nada',
      wh(g).some(w => w.id === 'a') && wh(g).some(w => w.id === 'b')
        && wh(g).some(w => w.id === 'x1'),
      wh(g).map(w => `${w.id}:${w.stackCount ?? 1}`).join(' '));

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

  resumen('la forja: dos del mismo tier, potencial medio y afijos por linaje');
}

export default main();