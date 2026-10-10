
// =========================================================================
//  LOS DATOS DEL BANCO, Y POR QUÉ EL DAÑO LO PONE EL MOTOR
//
//  **ESTO ES LO QUE HIZO FALLAR LA PRIMERA VEZ ESTE BANCO.** Los items se
//  fabricaban con `collector('p1', 1, { potential: 1, damage: 20 })`: potencial 1
//  con un daño que en el T1 es de un potencial 5. La migración
//  `migraPotenciales()` deriva el potencial **del daño**, porque potencial y daño
//  son dos vistas de lo mismo y el daño manda. Al cargar, el motor corrigió los
//  cuatro items a potencial 5, los cuatro quedaron empatados y el reparto salió
//  por id en vez de por potencial.
//
//  El banco daba verde con una afirmación falsa: el motor no estaba ordenando
//  mal, estaba ordenando bien datos que el propio banco había escrito mal.
//
//  **EL DAÑO LO PONE `danioDeRango()`, LA MISMA FUNCIÓN QUE USA EL MOTOR.** Así un
//  banco no puede fabricar un item que la migración vaya a reescribir, y si
//  algún día cambia la relación entre potencial y daño, los bancos cambian con
//  ella en vez de quedarse midiendo una regla que ya no existe.
// =========================================================================

// ==========================================================================
//  LA FORJA
//
//  Hasta ahora la forja no tenía banco. `stateCheck` la rozaba seis veces para
//  el techo de nivel y poco más, así que las reglas de la fusión —que son las
//  más descubiertas del juego— no las comprobaba nadie:
//
//    · Solo se fusionan **exactamente 2** del **mismo tier**.
//    · El potencial sale de la **media** de los dos.
//    · Los afijos los decide **la rareza en cantidad y los padres en cuáles**.
//
//  La última es F97: `rangoDeAfijosForjados()` da el número fijo de la tabla
//  para la rareza (si lleva 2 es Épico, por construcción) y `pickAffixes()`
//  reparte con los compartidos primero. Ya no hay dado de cantidad: con uno,
//  un Mítico saldría a veces con 2 y "lleva 4" mentiría.
//
//  Y hay un motivo para que este banco mida la regla y no el resultado: el
//  resultado lleva un `Math.random()` dentro —el éxito, el potencial y los
//  afijos—, así que una prueba que tire una vez mide el azar, no la regla.
// ==========================================================================

import { boot, bootNew, check, resumen, s, wh, ids, baseSave, collector, companion, ficha, consumable, conRoll, conSec, reload, recargar } from './kit';
import { TREE_NODES, TREE_BY_ID } from '../src/data/tree';
import { filaDeSerie } from '../src/ui/forgePage';
import { successChance, baseSuccessChance } from '../src/data/crafting';
import { poderDeCompanero } from '../src/data/crafting';
import { PROB_SUBE_POTENCIAL, BONO_ETTER, PROB_NANO_SUBE_RAREZA } from '../src/data/constants';

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
const NOMBRE_ETER = 'Éter de Refinamiento';
import {
  attemptForge, attemptForgeCompanion, rangoDeAfijosForjados, danioDeRango,
  AFIX_MIN_POR_RARIDAD, AFIX_MAX, AFFIXES, POOL_AFIJOS_COMPANERO, collectorMaxLevel, MATERIALES_POR_FUSION,
  valorDeUnCristal, cristalesDeConsuelo, rarezaFusionada, afijosCompartidos,
  PROB_CONSERVA_RAREZA, subirRareza, piedrasParaObjetivo, MAX_PIEDRAS_POR_FUSION,
  rarezaCalculadaDeForja, potencialFusionado, afijosParaRareza, migraAfijosPorRareza,
  efectoDeAfijos, potenciaDeAfijoPorTier, rarezaDeCompanionForjado
} from '../src/data/crafting';
import { generateCollectorByTier } from '../src/data/generators';
import { basePorId } from '../src/data/bases';

const TODOS_LOS_AFIJOS = AFFIXES.map(a => a.id);

const opts = (extra: any = {}) => ({
  craftLuck: 0, consolationBonus: 0, stonesUsed: 0, nanoUsed: 0, eterUsed: 0, ...extra
});

/**
 * LOS DATOS DEL BANCO, Y POR QUÉ EL DAÑO LO PONE EL MOTOR
 *
 * **ESTO ES LO QUE HIZO FALLAR LA PRIMERA VEZ ESTE BANCO.** Los items se
 * fabricaban con `collector('p1', 1, { potential: 1, damage: 20 })`: un potencial
 * 1 con un daño que en el T1 es de un potencial 5. La migración
 * `migraPotenciales()` deriva el potencial **del daño**, porque potencial y daño son
 * dos vistas de lo mismo y el daño manda. Al cargar, el motor corrigió los cuatro
 * items a potencial 5, los cuatro quedaron empatados y el reparto salió por id en
 * vez de por potencial.
 *
 * El banco daba verde sobre una afirmación falsa. **No era el motor el que no
 * ordenaba bien: era el banco, que fabricaba datos que el motor iba a reescribir.**
 *
 * **EL DAÑO LO PONE `danioDeRango()`, LA MISMA FUNCIÓN QUE USA EL MOTOR.** Así un
 * banco no puede crear un item que la migración vaya a corregir, y si algún día
 * cambia la relación entre potencial y daño, los bancos cambian con ella en vez de
 * quedarse midiendo una regla que ya no existe.
 *
 * **Y POR QUÉ ESTO ES UNA REGLA DE LOS BANCOS, NO UN DETALLE DE ESTE.** Ya ha
 * pasado dos veces en este repositorio: una vez con la rareza del compañero de
 * ejemplo, que hacía que los bancos de ingreso midieran el multiplicador en vez del
 * ingreso, y ahora con el potencial. **Un banco que fabrica datos imposibles no
 * falla: falla mintiendo**, y falla en la dirección que hace que la regla parezca
 * correcta.
 */
function recDePotencial(id: string, tier: number, potencial: number) {
  return collector(id, tier, {
    potential: potencial,
    damage: danioDeRango(tier, potencial)
  });
}

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
  //  2. EL POTENCIAL ES LA MEDIA, Y SOLO LA TIRADA LO PUEDE SUBIR
  // -------------------------------------------------------------------------
  //  Con `conSec(0, ...)`: el PRIMERO de los dados es el de acierto —a 0 es
  //  seguro para cualquier probabilidad, sin conocer la fórmula— y el resto,
  //  el de subir el potencial, se clava en 1: nadie sube. Con un solo número
  //  —`conRoll(0, ...)`— los dos dados saldrían iguales y **la media subiría
  //  siempre**, o sea que este bloque mediría el ascenso y no la media.
  {
    const caso = (p1: number, p2: number) => conSec(0, 1, () => attemptForge(
      [collector('x', 3, { potential: p1 }), collector('y', 3, { potential: p2 })],
      3, 'X', opts()
    )).collector;

    check('forja: el potencial es la media de los dos',
      caso(5, 1)?.potential === 3,
      `5 y 1 → ${caso(5, 1)?.potential} (media ${Math.round((5 + 1) / 2)})`);
    check('forja: dos iguales dan ese mismo potencial',
      caso(4, 4)?.potential === 4, `4 y 4 → ${caso(4, 4)?.potential}`);
    check('forja: y promediar NUNCA sube por sí solo: 5 con 1 da 3, no 4',
      caso(5, 1)?.potential === 3, `5 y 1 → ${caso(5, 1)?.potential}`);

    // Y el daño sale del potencial, no del tier solo: es lo que hace que el
    // promedio sirva para algo y no sea solo un número decorativo.
    const dos = caso(5, 1);
    check('forja: y el daño es el de ese potencial, no un número suelto',
      dos?.damage === danioDeRango(4, dos.potential),
      `daño=${dos?.damage} · el ★${dos.potential} de T4 es ${danioDeRango(4, dos.potential)}`);
    check('forja: el forjado sube UN tier',
      dos?.tier === 4, `tier=${dos?.tier}`);

    // **LA ENMIENDA DE F33: LA TIRADA DE POTENCIAL, Y QUE ES LO ÚNICO QUE SUBE.**
    // Con el dado a la mitad de lo que haría falta —0,10 contra un 5 % de ★4→5— la
    // media se queda; con el mismo 0,10 Y ÉTER —5 % + 20 puntos = 25 %— sube. La
    // misma tirada en las dos ramas es lo que hace que la diferencia sea el Éter y
    // no el azar.
    const rSinEter = conSec(0, 0.10, () => attemptForge(
      [collector('x', 3, { potential: 4 }), collector('y', 3, { potential: 4 })],
      3, 'X', opts()
    )).collector;
    check('forja: la tirada de potencial existe sin Éter, y con ella a favor NO sube',
      rSinEter?.potential === 4, `pot=${rSinEter?.potential} tirada=0.10`);
    const rConEter = conSec(0, 0.10, () => attemptForge(
      [collector('x', 3, { potential: 4 }), collector('y', 3, { potential: 4 })],
      3, 'X', opts({ eterUsed: 1 })
    )).collector;
    check('forja: y con Éter, el MISMO dado sube la ★ — 5 % + 20 puntos = 25 %',
      rConEter?.potential === 5,
      `pot=${rConEter?.potential} prob=${PROB_SUBE_POTENCIAL[4]}+${BONO_ETTER}`);
    const rSube = conSec(0, 0, () => attemptForge(
      [collector('x', 3, { potential: 2 }), collector('y', 3, { potential: 2 })],
      3, 'X', opts()
    )).collector;
    check('forja: la subida es de UNA estrella como mucho, aunque el dado diga 0',
      rSube?.potential === 3, `pot=${rSube?.potential}`);
    const rCinco = conSec(0, 0, () => attemptForge(
      [collector('x', 3, { potential: 5 }), collector('y', 3, { potential: 5 })],
      3, 'X', opts({ eterUsed: 1 })
    )).collector;
    check('forja: y un ★5 no sube aunque haya Éter: no hay escalón encima',
      rCinco?.potential === 5, `pot=${rCinco?.potential}`);

    // **LA NANO NO TOCA EL POTENCIAL NI LA PROBABILIDAD: SUBE LA RAREZA.** Su
    // tirada va después de la rareza decidida. El par sale de dos materiales con
    // rareza compartida y ★5 —sin tirada de potencial que consuma dados—, así que
    // con 0,001 la conserva y la subida es exactamente un escalón; y con 0,999 la
    // calculada es la misma con y sin nano, que es la única forma de ver que la nano
    // no hizo nada sin confiar en saber cuál sale calculada.
    const compartido = (id: string) => collector(id, 3, { potential: 5, rarity: 'Raro', damage: danioDeRango(3, 5) });
    const raro = () => attemptForge([compartido('x'), compartido('y')], 3, 'X', opts());
    const rNanoSube = conSec(0, 0.001, () => attemptForge(
      [compartido('x'), compartido('y')], 3, 'X', opts({ nanoUsed: 1 }))).collector;
    const rSinNano = conSec(0, 0.001, () => raro()).collector;
    check('la nanopartícula sube la rareza un escalón con el dado a favor (50 %)',
      rNanoSube?.rarity === 'Épico' && rSinNano?.rarity === 'Raro',
      `con nano=${rNanoSube?.rarity} sin=${rSinNano?.rarity}`);
    const rNoSube = conSec(0, 0.999, () => attemptForge(
      [compartido('x'), compartido('y')], 3, 'X', opts({ nanoUsed: 1 }))).collector;
    const rNoNano = conSec(0, 0.999, () => raro()).collector;
    check('y con el dado en contra la deja exactamente donde estaba',
      rNoSube?.rarity === rNoNano?.rarity,
      `con nano=${rNoSube?.rarity} sin=${rNoNano?.rarity}`);
    check('y el PROB de la nanopartícula está escrita y es media',
      PROB_NANO_SUBE_RAREZA === 0.5, `p=${PROB_NANO_SUBE_RAREZA}`);
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
  //  4. LOS AFIJOS: LA RAREZA PONE EL NÚMERO, FIJO
  // -------------------------------------------------------------------------
  {
    // **CADA MATERIAL CON SU ID.** Con los dos mirando al mismo id, la forja
    // los rechaza por "selecciona 2 distintos" —que es lo que tiene que hacer— y
    // el banco midió su propio montaje en vez de la regla. `con(n, i)` lo dice
    // porque es el error más fácil de repetir: un ayudante que "hace un item"
    // detrás de otro con el mismo id parece correcto y no lo es.
    const con = (n: number, i = 0) => collector(`p${i}`, 3, { affixes: TODOS_LOS_AFIJOS.slice(0, n) });

    // El número es el de la tabla y no lo mueve ni el linaje más pobre.
    const pobre = con(0);
    const lineaLlena = con(AFIX_MAX);
    check('forja: el número es el de la tabla, con padres pobres o ricos',
      Object.keys(AFIX_MIN_POR_RARIDAD).every(r => {
        const rango = rangoDeAfijosForjados([pobre, pobre], r);
        const rico = rangoDeAfijosForjados([lineaLlena, lineaLlena], r);
        return rango.minimo === AFIX_MIN_POR_RARIDAD[r]
          && rango.maximo === AFIX_MIN_POR_RARIDAD[r]
          && rico.minimo === AFIX_MIN_POR_RARIDAD[r]
          && rico.maximo === AFIX_MIN_POR_RARIDAD[r];
      }),
      JSON.stringify(Object.keys(AFIX_MIN_POR_RARIDAD).map(r =>
        `${r}:${rangoDeAfijosForjados([pobre, pobre], r).minimo}`)));

    // **LA NANO SIGUE SIN TOCAR ESTE RANGO: SU EFECTO ES LA RAREZA.** La
    // nanopartícula sube la rareza y la rareza trae su número desde la tabla;
    // sumarlo aquí también sería pagar dos veces por lo mismo. La comprobación
    // es que el rango no depende de los materiales: con pobres o con ricos da
    // lo mismo, porque el parámetro ya ni mueve la cuenta.
    const sinLinea = rangoDeAfijosForjados([pobre, pobre], 'Raro');
    check('forja: ni los padres ni la nano mueven el número de un Raro',
      sinLinea.minimo === AFIX_MIN_POR_RARIDAD['Raro']
        && sinLinea.maximo === AFIX_MIN_POR_RARIDAD['Raro'],
      `suelo=${sinLinea.minimo} techo=${sinLinea.maximo}`);

    // Un Divino tiene el número pegado al tope: sale siempre completo. Es lo
    // que hace que "más rareza, más afijos" tenga final.
    const divino = rangoDeAfijosForjados([pobre, pobre], 'Divino');
    check('forja: y un Divino sale siempre completo, porque su número ES el tope',
      divino.minimo === divino.maximo && divino.maximo === AFIX_MAX,
      `min=${divino.minimo} max=${divino.maximo}`);

    // Y un Común sale siempre pelado, aunque sus padres fueran buenos.
    const comun = rangoDeAfijosForjados([lineaLlena, lineaLlena], 'Común');
    check('forja: y un Común no lleva ninguno aunque sus padres trajeran',
      comun.minimo === 0 && comun.maximo === 0,
      `min=${comun.minimo} max=${comun.maximo}`);
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
      const { minimo, maximo } = rangoDeAfijosForjados(padres, r.collector.rarity);
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
  //  5b · EL NÚMERO ES EL DE LA RAREZA QUE SALGA, CON EL DADO QUE SEA
  // -------------------------------------------------------------------------
  //  La sección anterior comprueba que nada se sale del número que le toca.
  //  Esta comprueba que el número es el de la tabla **para la rareza que haya
  //  salido**, con el dado arriba o abajo: sin dado de cantidad, los extremos
  //  no pueden dar cantidades distintas para la misma rareza.
  //
  //  **UN SOLO `rng` NO SIRVE, Y POR QUÉ.** El primer uso del dado es el acierto
  //  y va contra una probabilidad que llega a 0.95, así que con `0.999` la forja
  //  falla y no hay item del que mirar nada. Hace falta una **secuencia**:
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
    const tablaAbajo = AFIX_MIN_POR_RARIDAD[abajo.collector?.rarity ?? ''] ?? -1;
    const tablaArriba = AFIX_MIN_POR_RARIDAD[arriba.collector?.rarity ?? ''] ?? -1;

    check('forja: el dado es el primero que se tira, así que el acierto va primero',
      abajo.success === true && arriba.success === true,
      `abajo=${abajo.error ?? 'ok'} arriba=${arriba.error ?? 'ok'}`);
    check('forja: con el dado abajo, la cantidad es la de la rareza que salió',
      (abajo.collector?.affixes.length ?? -1) === tablaAbajo,
      `${abajo.collector?.affixes.length} afijos, ${abajo.collector?.rarity}=${tablaAbajo}`);
    check('forja: y con el dado arriba, la de la suya',
      (arriba.collector?.affixes.length ?? -1) === tablaArriba,
      `${arriba.collector?.affixes.length} afijos, ${arriba.collector?.rarity}=${tablaArriba}`);
    // Y lo compartido entra el primero aunque el número sea 1: forzar es elegir.
    const padre = (id: string) => collector(id, 3, {
      potential: 3, rarity: 'Raro', damage: danioDeRango(3, 3),
      affixes: ['aff_bulwark', 'aff_sharp']
    });
    const forzado = conSec(0.001, 0, () => attemptForge([padre('s1'), padre('s2')], 3, 'X', opts()));
    check('forja: dos Raros que comparten Baluarte lo traen, porque entra primero',
      forzado.success === true && (forzado.collector?.affixes ?? []).join(',') === 'aff_bulwark',
      `rarity=${forzado.collector?.rarity} afijos=${(forzado.collector?.affixes ?? []).join(',')}`);
  }

  // -------------------------------------------------------------------------
  //  5c · F97: UNIVERSALES, FIJOS POR RAREZA Y CON POTENCIA POR TIER
  // -------------------------------------------------------------------------
  //  Tres reglas nuevas y las tres se miden aquí porque las tres viven en
  //  `data/crafting`: la cantidad fija por rareza en la generación, la magnitud
  //  por tier en el efecto y la migración de lo viejo en la carga.
  {
    // La cantidad es la de la tabla, salga de donde salga el sorteo.
    for (const [rareza, n] of Object.entries(AFIX_MIN_POR_RARIDAD)) {
      const sorteo = afijosParaRareza(rareza, () => 0.5);
      check(`f97: un ${rareza} sorteado lleva ${n} afijos`,
        sorteo.length === n && new Set(sorteo).size === sorteo.length
          && sorteo.every(id => TODOS_LOS_AFIJOS.includes(id)),
        `${rareza}=${sorteo.length} esperados=${n}`);
    }
    check('f97: una rareza que no existe no sortea nada, no un número roto',
      afijosParaRareza('Rarisima', () => 0.5).length === 0, 'sorteó algo');

    // El generador —tienda y cajas— trae la misma regla, porque es el mismo.
    const t1 = generateCollectorByTier(1, () => 0.5);
    const t5 = generateCollectorByTier(5, () => 0.5);
    const t10 = generateCollectorByTier(10, () => 0.5);
    check('f97: el T1 (Común) nace sin afijos',
      t1.affixes.length === 0, `t1=${t1.affixes.length}`);
    check('f97: el T5 (Épico) nace con 2',
      t5.affixes.length === 2, `t5=${t5.affixes.length}`);
    check('f97: el T10 (Divino) nace con 6',
      t10.affixes.length === 6, `t10=${t10.affixes.length}`);

    // La magnitud sube con el tier y el crítico no se mueve.
    const t3 = efectoDeAfijos(['aff_bulwark', 'aff_focus'], 0, 3).clickMult;
    const t5b = efectoDeAfijos(['aff_bulwark', 'aff_focus'], 0, 5).clickMult;
    const t10b = efectoDeAfijos(['aff_bulwark', 'aff_focus'], 0, 10).clickMult;
    check('f97: el mismo afijo pega más en tier alto',
      t3 < t5b && t5b < t10b, `T3=${t3} T5=${t5b} T10=${t10b}`);
    check('f97: y en T5 rinde lo nominal, ni más ni menos',
      t5b === 0.35, `T5=${t5b}`);
    check('f97: el crítico no escala por tier, que es probabilidad y no stat',
      efectoDeAfijos(['aff_focus'], 0, 3).critChance === efectoDeAfijos(['aff_focus'], 0, 10).critChance
        && efectoDeAfijos(['aff_focus'], 0, 10).critChance === 0.14,
      `T3=${efectoDeAfijos(['aff_focus'], 0, 3).critChance}`);
    check('f97: sin tier el factor es 1, la cuenta de siempre',
      efectoDeAfijos(['aff_bulwark'], 0).clickMult === 0.35
        && potenciaDeAfijoPorTier(5) === 1,
      `sinTier=${efectoDeAfijos(['aff_bulwark'], 0).clickMult}`);

    // La migración: asigna, recorta, limpia y no toca dos veces.
    const viejo = { id: 'viejo', type: 'collector', name: 'V', tier: 5, rarity: 'Épico', level: 0, damage: danioDeRango(5, 3), potential: 3 };
    const m1 = migraAfijosPorRareza([viejo], () => 0.5);
    check('f97: un Épico viejo sin campo recibe sus 2',
      m1.changed === true && m1.items[0].affixes.length === 2
        && m1.items[0].affixes.every((id: string) => TODOS_LOS_AFIJOS.includes(id)),
      `afijos=${JSON.stringify(m1.items[0].affixes)}`);
    const m2 = migraAfijosPorRareza(m1.items, () => 0.5);
    check('f97: y a la segunda pasada no se toca nada',
      m2.changed === false, `changed=${m2.changed}`);
    const forjadoComun = { id: 'fc', type: 'collector', name: 'C', tier: 3, rarity: 'Común', level: 0, damage: danioDeRango(3, 3), potential: 3, affixes: ['aff_bulwark', 'aff_inventado'] };
    const m3 = migraAfijosPorRareza([forjadoComun], () => 0.5);
    check('f97: un Común forjado con afijos de linaje los pierde, que son 0',
      m3.items[0].affixes.length === 0, `afijos=${JSON.stringify(m3.items[0].affixes)}`);
    const conSuerte = { id: 'cs', type: 'collector', name: 'S', tier: 5, rarity: 'Épico', level: 0, damage: danioDeRango(5, 3), potential: 3, affixes: ['aff_luck', 'aff_bulwark'] };
    const m4 = migraAfijosPorRareza([conSuerte], () => 0.5);
    check('f97: aff_luck se va de los items guardados sin dejar hueco',
      !m4.items[0].affixes.includes('aff_luck') && m4.items[0].affixes.length === 2,
      `afijos=${JSON.stringify(m4.items[0].affixes)}`);

    // Y sobrevive a la recarga con los mismos ids, no con otros.
    const gMig = await boot(baseSave([viejo]));
    const trasCarga = wh(gMig).find((w: any) => w.id === 'viejo');
    const gRe = await reload();
    const trasRecarga = wh(gRe).find((w: any) => w.id === 'viejo');
    check('f97: lo migrado se guarda y recarga con los mismos afijos',
      Array.isArray(trasCarga?.affixes) && trasCarga.affixes.length === 2
        && JSON.stringify(trasCarga.affixes) === JSON.stringify(trasRecarga?.affixes),
      `carga=${JSON.stringify(trasCarga?.affixes)} recarga=${JSON.stringify(trasRecarga?.affixes)}`);
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

    // **EL NODO DE LA FORJA YA NO ESTA, Y ESTAS TRES COMPROBACIONES SON LAS DE ESO.**
    //
    // Decian que `blueprint` seguia existiendo, que tenia bonus y que era la raiz de
    // `forge_luck` y `shard_sifter`. Las tres se han reescrito: **una prueba que afirma
    // una regla borrada es peor que no tenerla**, porque se lee, se ve pasar y alguien
    // se queda creyendola. Ahora fijan lo contrario, que es lo que hay.
    //
    // Lo que se borro es el nodo entero. La forja no tiene puerta desde que se abrio
    // desde el inicio, y cuando se le puso un +3% de `craftLuck` para que no fuera un
    // nodo que no hace nada, seguia pagando por una restriccion que ya no existia.
    check('forja: el nodo de la puerta ya no esta, y no queda ni el identificador',
      TREE_BY_ID.blueprint === undefined && !TREE_NODES.some((n: any) => n.id === 'blueprint'),
      `quedan=${TREE_NODES.filter((n: any) => n.id === 'blueprint').map((n: any) => n.id).join(',') || 'ninguno'}`);

    // **Y SUS DOS HIJOS SIGUEN SIENDO COMPRABLES, QUE ES LO QUE HABIA QUE CUIDAR.**
    // Borrar el nodo sin quitarles el `requires` los dejaba inalcanzables para el que
    // no lo tenia comprado, con sus bonificaciones desaparecidas de golpe. Se compran
    // directamente, y dan lo que han dado siempre.
    const hijos = ['forge_luck', 'shard_sifter'].map((id) => TREE_BY_ID[id]).filter(Boolean);
    check('forja: los dos hijos de la rama de crafteo siguen en el arbol',
      hijos.length === 2,
      `hijos=${hijos.map((n: any) => n.id).join(',') || 'ninguno'}`);
    check('forja: y ya no piden ningun requisito que no exista',
      hijos.every((n: any) => (n.requires ?? []).every((r: string) => !!TREE_BY_ID[r])),
      `requisitos=${hijos.map((n: any) => (n.requires ?? []).join('+') || 'ninguno').join(' | ')}`);
    check('forja: y los dos dan un bonus de crafteo o de consuelo',
      hijos.every((n: any) => Object.keys(n.bonus ?? {}).length > 0),
      `bonus=${hijos.map((n: any) => JSON.stringify(n.bonus)).join(' | ')}`);

    // Y la puerta que habia en la tienda tampoco: las piedras y las nanoparticulas
    // se venden desde el principio, porque la forja se puede usar desde el
    // principio y comprar algo inservible es perder dinero a proposito.
    const gTienda = await bootNew();
    check('forja: y el arbol ya no abre ni cierra la forja en ninguna partida',
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

    // --- El potencial: la media, y lo único que la puede subir: la tirada ----------
    //
    // **`conSec` Y NO `conRoll`, PORQUE LA FUSIÓN TIRA DOS DADOS.** El primero es
    // el de acierto —a 0 es seguro para cualquier probabilidad— y el resto es el
    // de subir el potencial. Con un único número clavado los dos saldrían iguales:
    // `conRoll(0.001)` haría subir SIEMPRE —0,001 es menos que cualquier
    // probabilidad de subida— y estos "la media no sube" darían verde sobre una
    // mentira. Aquí el segundo dado va a 1 (nadie sube) salvo en las pruebas que
    // miden justo lo contrario.
    const forja = async (p1: number, p2: number,
      extra: { nano?: 0 | 1; eter?: 0 | 1 } = {}, tirada = 1) => {
      const j = await boot(baseSave([
        // F74 · Base explícita e igual en los dos: sin ella la migración sortea
        // una por material y el poder forjado varía con el dado.
        companion('x1', 3, { potential: p1, baseId: 'base_com_t3_6' }),
        companion('x2', 3, { potential: p2, baseId: 'base_com_t3_6' }),
        ficha('x1', 3, { potential: p1, baseId: 'base_com_t3_6' }),
        ficha('x2', 3, { potential: p2, baseId: 'base_com_t3_6' }),
        ...(extra.nano ? [consumable('n1', 'stabilityNano', 3, { name: NOMBRE_NANO })] : []),
        ...(extra.eter ? [consumable('e1', 'refiningEther', 3, { name: NOMBRE_ETER })] : [])
      ], { warehouseCapacity: 20 }));
      const r = conSec(0, tirada, () =>
        j.forgeCompanion(['x1', 'x2'], 0, extra.nano ?? 0, extra.eter ?? 0)) as any;
      r._g = j;
      return r;
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

    // --- La tirada de potencial, y el Éter como lo único que la mueve ---------------
    //
    // **MISMO 0,10 EN LOS DOS LADOS: LA DIFERENCIA ES EL ÉTER Y NO EL AZAR.** Un ★4
    // sube con un 5 %; con Éter, con un 25 %. Con el dado a 0,10 la primera rama
    // pierde y la segunda gana —y si el Éter no añadiera nada, ambas darían 4.
    const sinEter = await forja(4, 4, {}, 0.10);
    const conEter = await forja(4, 4, { eter: 1 }, 0.10);
    check('compañero: la tirada de potencial existe sin Éter, y a 0,10 NO sube un ★4',
      sinEter.companion?.potential === 4, `pot=${sinEter.companion?.potential}`);
    check('compañero: y con Éter el MISMO 0,10 sí sube — 5 % + 20 puntos = 25 %',
      conEter.companion?.potential === 5, `pot=${conEter.companion?.potential}`);

    // **Y SE GASTA AUNQUE LA TIRADA SALGA EN BLANCO**, igual que las piedras: si
    // solo se cobrara cuando sube, el Éter sería una apuesta y no un consumible,
    // y el botón de la tienda diría "aumenta" en vez de "añade probabilidad".
    const tiradaMala = await forja(4, 4, { eter: 1 }, 0.99);
    const etherTrasFallo = wh(tiradaMala._g).find((w: any) => w.id === 'e1');
    check('compañero: el Éter se gasta aunque la tirada salga en blanco',
      tiradaMala.companion?.potential === 4 && etherTrasFallo?.stackCount === 2,
      `pot=${tiradaMala.companion?.potential} éter=${etherTrasFallo?.stackCount}`);

    // **LA NANOPARTÍCULA YA NO TOCA NADA EN COMPAÑEROS: NI EL POTENCIAL NI EL
    // ALMACÉN.** Su efecto es subir la rareza un escalón, y la del compañero la
    // pone el tier, así que aquí sería un interruptor que no hace nada. Antes
    // daba +1 al potencial y se cobraba; ahora el motor la ignora sin cobrarla,
    // y la vista ni la ofrece. Un consumible que se cobra sin efecto es la
    // definición de R3.
    const conNano = await forja(3, 4, { nano: 1 });
    const nanoTras = wh(conNano._g).find((w: any) => w.id === 'n1');
    check('compañero: con la nanopartícula marcada, la media sigue siendo la de siempre',
      conNano.companion?.potential === 4, `pot=${conNano.companion?.potential}`);
    check('compañero: y la nanopartícula NO se cobra en compañeros',
      nanoTras?.stackCount === 3, `stack=${nanoTras?.stackCount}`);

    // --- La misma probabilidad que el recolector -----------------------------------
    // **LOS PADRES SON COMUNES A PROPÓSITO (F97).** La suerte de la tirada suma
    // +2 % por afijo de los materiales, y desde F97 todo Épico trae 2: con los
    // padres de antes (Épicos sin campo) la migración los rellenaba y el
    // recolector salía con +0,08 sobre el compañero. Lo que se mide aquí es que
    // la fórmula es la misma, así que los padres tienen que ser neutros —cero
    // afijos—, que es la doctrina de RAREZA_NEUTRA de `kit.ts`.
    const gc = await boot(baseSave([
      companion('y1', 3, { potential: 5 }), companion('y2', 3, { potential: 5 }),
      ficha('y1', 3, { potential: 5 }), ficha('y2', 3, { potential: 5 }),
      collector('r1', 3, { potential: 5, damage: 100, rarity: 'Común' }),
      collector('r2', 3, { potential: 5, damage: 100, rarity: 'Común' }),
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
      Math.abs(rc.chance - successChance(3, 0, 3, 0)) < 1e-9,
      `tirada=${rc.chance} regla=${successChance(3, 0, 3, 0)}`);

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

    // Y el caso caro: **piedras que sí tiene y Éter que no.** Un cobro a medias
    // dejaría al jugador con menos sin haber forjado nada. Los materiales aquí son
    // válidos a propósito —dos T3—, porque si no, el rechazo sería de los
    // materiales y el cobro no se llega a mirar: la comprobación diría "no se gasta
    // nada" sin haber entrado nunca en la caja.
    const gMedio = await boot(baseSave([
      companion('m1', 3), companion('m2', 3),
      ficha('m1', 3), ficha('m2', 3),
      consumable('piedras', 'calibrationStone', 5, { name: NOMBRE_PIEDRA })
    ], { warehouseCapacity: 20 }));
    const rMedio: any = gMedio.forgeCompanion(['m1', 'm2'], 5, 0, 1);
    const piedrasMedio = wh(gMedio).find((w: any) => w.id === 'piedras');
    check('compañero: y si falta el Éter, tampoco se cobran las piedras',
      !rMedio.success && /Éter/.test(rMedio.msg ?? '') && (piedrasMedio?.stackCount ?? 0) === 5,
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
    // F74 · Con las dos bases en 6, la fusionada es 6 (×1,00): el poder es el del
    // constructor con esa base, y la base viaja en el forjado.
    check('compañero: el poder sale del constructor común, no de una cuenta propia',
      rPow.companion?.power === poderDeCompanero(4, 5, basePorId('base_com_t4_6'))
        && rPow.companion?.baseId === 'base_com_t4_6',
      `power=${rPow.companion?.power} esperado=${poderDeCompanero(4, 5, basePorId('base_com_t4_6'))} base=${rPow.companion?.baseId}`);
  }

  // =========================================================================
  //  8b. LOS AFIJOS DEL COMPAÑERO FORJADO
  // =========================================================================
  //  El super bug: la forja de compañeros era la ÚNICA vía del juego que creaba
  //  items sin afijos. Un compañero de caja nace con los de su rareza, uno de
  //  tienda también, y el forjado —que cuesta dos items, una tirada y sus
  //  consumibles— salía sin ninguno: su ficha enseñaba menos que el botín
  //  gratis, y el ingreso no cobraba nada por el linaje.
  //
  //  Lo que se comprueba aquí:
  //
  //  · Que el forjado TRAE afijos, con la cantidad de su rareza —la pone el
  //    tier— y solo del pool de compañero (sin crítico puro: no critica).
  //  · Que viajan a la FICHA del almacén en la misma llamada, y que sobreviven
  //    a la recarga. El ingreso y la ficha leen los afijos del almacén
  //    cruzando por id: forjarlos sin sincronizarlos sería forjar a medias.
  //  · Que la HERENCIA funciona: lo que traen los dos padres entra primero.
  //  · Que la suerte de afijos (+2 % por afijo de material) cuenta en la
  //    tirada del compañero como en la del recolector, y que las dos siguen
  //    empatadas CON padres con afijos —antes la igualdad solo se probaba con
  //    padres Comunes, que no traían ninguno—.
  // =========================================================================
  {
    // --- El forjado trae los afijos de su rareza, y solo del pool de compañero --
    const gAf = await boot(baseSave([
      companion('a1', 3, { potential: 3 }), companion('a2', 3, { potential: 3 }),
      ficha('a1', 3, { potential: 3 }), ficha('a2', 3, { potential: 3 })
    ], { warehouseCapacity: 20 }));
    const rAf: any = conRoll(0.001, () => gAf.forgeCompanion(['a1', 'a2']));
    const rarezaNina = rarezaDeCompanionForjado(4);
    const tablaNina = AFIX_MIN_POR_RARIDAD[rarezaNina] ?? -1;
    check('compañero forjado: trae afijos, los de la rareza que le pone el tier',
      Array.isArray(rAf.companion?.affixes) && rAf.companion.affixes.length === tablaNina,
      `rareza=${rarezaNina} tabla=${tablaNina} afijos=${JSON.stringify(rAf.companion?.affixes)}`);
    const fueraDePool = (rAf.companion?.affixes ?? []).filter(
      (id: string) => !POOL_AFIJOS_COMPANERO.some(a => a.id === id));
    check('compañero forjado: y solo del pool de compañero, sin crítico puro',
      Array.isArray(rAf.companion?.affixes) && fueraDePool.length === 0,
      `fuera=${fueraDePool.join(',') || 'ninguno'}`);

    // --- Y los afijos viajan a la FICHA, que es donde los leen el ingreso y la
    //     pantalla, y se quedan tras recargar -------------------------------
    const fichaNina = (gAf.getState().warehouse as any[]).find((w: any) => w.id === rAf.companion?.id);
    check('compañero forjado: los afijos viajan a la ficha del almacén en la misma llamada',
      Array.isArray(fichaNina?.affixes)
        && fichaNina.affixes.length === (rAf.companion?.affixes?.length ?? -1)
        && fichaNina.affixes.every((id: string, i: number) => id === rAf.companion.affixes[i]),
      `ficha=${JSON.stringify(fichaNina?.affixes)}`);
    await reload();
    const trasRecarga = (gAf.getState().warehouse as any[]).find((w: any) => w.id === rAf.companion?.id);
    check('compañero forjado: y sobreviven a la recarga, sin relleno ni recorte',
      Array.isArray(trasRecarga?.affixes)
        && trasRecarga.affixes.length === (rAf.companion?.affixes?.length ?? -1),
      `recarga=${JSON.stringify(trasRecarga?.affixes)}`);

    // --- La herencia: lo que traen LOS DOS padres entra primero ---------------
    //  Se llama al motor de datos directamente, con el dado clavado: la prueba
    //  mide la REGLA de la mezcla, no una tirada. T4 → T5 es Épico, que son 2
    //  afijos: el primero tiene que ser el compartido y el segundo, del linaje.
    const compA = companion('ha', 4, { potential: 3, affixes: ['aff_yield', 'aff_flow'] });
    const compB = companion('hb', 4, { potential: 3, affixes: ['aff_yield', 'aff_sharp'] });
    const rHer: any = attemptForgeCompanion([compA as any, compB as any], 4, opts({ rng: () => 0 }));
    check('compañero forjado: lo que traen LOS DOS padres entra primero',
      rHer.companion?.affixes?.[0] === 'aff_yield',
      `afijos=${JSON.stringify(rHer.companion?.affixes)}`);
    const delLinaje = new Set(['aff_yield', 'aff_flow', 'aff_sharp']);
    check('compañero forjado: y el resto sale del linaje, no del azar del catálogo',
      (rHer.companion?.affixes ?? []).every((id: string) => delLinaje.has(id)),
      `afijos=${JSON.stringify(rHer.companion?.affixes)}`);
    //  Y un afijo de crítico en un material NO se hereda: no está en el pool
    //  de compañero, y heredarlo sería un hueco vacío que la ficha anunciaría.
    const compCritA = companion('ca', 4, { potential: 3, affixes: ['aff_crit', 'aff_yield'] });
    const compCritB = companion('cb', 4, { potential: 3, affixes: ['aff_crit', 'aff_flow'] });
    const rCrit: any = attemptForgeCompanion([compCritA as any, compCritB as any], 4, opts({ rng: () => 0 }));
    check('compañero forjado: el crítico de un material no se hereda: no está en su pool',
      !(rCrit.companion?.affixes ?? []).includes('aff_crit'),
      `afijos=${JSON.stringify(rCrit.companion?.affixes)}`);

    // --- Y la suerte de afijos cuenta en la tirada, en las DOS forjas ----------
    //  El mismo cobro de +2 % por afijo para el compañero que para el
    //  recolector, CON padres que traen afijos: antes la igualdad de
    //  probabilidad solo se probaba con padres Comunes, que no traían ninguno,
    //  y la rama de compañero pasaba la suya por alto en silencio.
    const gSu = await boot(baseSave([
      companion('l1', 3, { rarity: 'Épico', affixes: ['aff_yield', 'aff_flow'], potential: 5 }),
      companion('l2', 3, { rarity: 'Épico', affixes: ['aff_yield', 'aff_flow'], potential: 5 }),
      ficha('l1', 3, { potential: 5 }), ficha('l2', 3, { potential: 5 }),
      collector('lr1', 3, { rarity: 'Épico', affixes: ['aff_yield', 'aff_flow'], potential: 5, damage: 100 }),
      collector('lr2', 3, { rarity: 'Épico', affixes: ['aff_yield', 'aff_flow'], potential: 5, damage: 100 })
    ], { warehouseCapacity: 20 }));
    const rLC: any = conRoll(0.001, () => gSu.forgeCompanion(['l1', 'l2']));
    const rLR: any = conRoll(0.001, () => gSu.forgeCollector(['lr1', 'lr2']));
    //  4 afijos de material × 2 % = +8 puntos, la misma cuenta que en el
    //  recolector, y sale de `successChance`, la función que cobra.
    check('compañero forjado: la suerte de afijos cuenta en la tirada, +2 % por afijo',
      Math.abs(rLC.chance - successChance(3, 0, 0, 0.08)) < 1e-9,
      `tirada=${rLC.chance} regla=${successChance(3, 0, 0, 0.08)}`);
    check('compañero forjado: y las dos forjas siguen empatadas CON padres con afijos',
      Math.abs(rLC.chance - rLR.chance) < 1e-9,
      `compañero=${rLC.chance} recolector=${rLR.chance}`);
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
// =========================================================================
//  4. EL AUTO-FORGE: REPARTO POR POTENCIAL, EL SOBRANTE Y QUE NO SE GASTE
//     LO EQUIPADO
//
//  Aquí no se comprueba que el botón exista. Se comprueba lo que el jugador no
//  puede ver: **qué dos materiales se emparejan**, porque es lo único que
//  decide la calidad de lo que sale y no hay forma de verlo en la partida.
// =========================================================================
{
  /**
   * Cuatro del T1 con potenciales en desorden: 1, 5, 2 y 4.
   *
   * **LOS DAÑOS LOS PONE `recDePotencial()`, NO A MANO.** La migración
   * `migraPotenciales()` deriva el potencial del daño, así que un item con
   * potencial 1 y daño de un 5 se corrige al cargar y el banco acaba midiendo
   * cuatro potenciales iguales. Parecía que el motor no estaba ordenando mal.
   */
  const cuatro = () => [
    recDePotencial('p1', 1, 1),
    recDePotencial('p5', 1, 5),
    recDePotencial('p2', 1, 2),
    recDePotencial('p4', 1, 4)
  ];

  // ---- DIAGNOSTICO TEMPORAL ----
  // --- EL REPARTO ES POR POTENCIAL DESCENDENTE ----------------------------
  // **NO ES ORDEN AL AZAR Y TAMPOCO POR ID.** Con 1, 5, 2 y 4 el reparto
  // correcto es (5, 4) y (2, 1): los dos mejores se gastan juntos. Si el
  // orden fuera por id saldría (p1, p2) y (p4, p5), que es justo lo contrario:
  // el ★1 se gastaría en la primera tirada.
  const g1 = await boot(baseSave(cuatro(), { warehouseCapacity: 40 }));
  const plan1 = g1.autoForgePreview('collector', 1);
  check('autoforge: reparte por potencial, no por id',
    JSON.stringify(plan1.pares) === JSON.stringify([['p5', 'p4'], ['p2', 'p1']]),
    'pares=' + JSON.stringify(plan1.pares));

  // **Y CUATRO MATERIALES SON DOS TIRADAS, NO CUATRO.** Este es el caso que
  // Straiton pidió: cuatro recolectores en el T1 tienen que salir en dos
  // fusiones, no en una ni en cuatro.
  check('autoforge: cuatro materiales del tier son dos tiradas',
    plan1.tiradas === 2 && plan1.disponibles === 4,
    `tiradas=${plan1.tiradas} disponibles=${plan1.disponibles}`);

  // --- EL IMPAR SE QUEDA, Y SE DICE CUÁNTO -------------------------------
  const g2 = await boot(baseSave([...cuatro(), recDePotencial('p3', 1, 3)],
    { warehouseCapacity: 40 }));
  const plan2 = g2.autoForgePreview('collector', 1);
  check('autoforge: con cinco salen dos tiradas y sobra uno, y lo dice',
    plan2.tiradas === 2 && plan2.sobrantes === 1,
    `tiradas=${plan2.tiradas} sobrantes=${plan2.sobrantes}`);

  // **EL SOBRANTE NO SE TIRA, Y ES EL DE MENOR POTENCIAL, QUE ES MÁS JUSTO QUE CUALQUIERA.**
  //
  // Se esperaba que sobrara el del medio, `p3`, y sobra `p1`: con cinco materiales y
  // pares de dos, el que se queda es el último de la lista ordenada, que es el más
  // flojo. Es lo que tiene que pasar, porque el jugador pierde lo que peor le
  // serviría y guarda lo mejor para la siguiente ronda.
  //
  // La primera versión de esta comprobación contaba los recolectores del almacén y
  // esperaba uno. Contaba tres, y no porque el sobrante se perdiera: quedaban **el
  // sobrante más los dos que acaban de salir de la forja**. Por eso va por id
  // concreto: si `p1` sigue ahí, el sobrante no se tiró, diga lo que diga el recuento.
  const r2 = conRoll(0.001, () => g2.autoForge('collector', 1));
  const idsQueQuedan = wh(g2).map((w: any) => w.id);
  check('autoforge: el sobrante se queda en el almacen y es el de menor potencial',
    idsQueQuedan.includes('p1') && r2.sobrantes === 1,
    `p1 sigue=${idsQueQuedan.includes('p1')} sobrantes=${r2.sobrantes}`);

  // **Y SE GASTARON LOS CUATRO DE MAYOR POTENCIAL, QUE ES LO QUE SE MEDÍA ARRIBA.**
  // Con potenciales 1, 5, 2, 4 y 3, los gastados son el 5, el 4, el 3 y el 2. Si se
  // hubieran gastado `p1` y `p2` primero, los mejores del tier habrían esperado al
  // final y ordenar por potencial no habría servido de nada.
  const originals = wh(g2).filter((w: any) => ['p1','p2','p3','p4','p5'].includes(w.id));
  check('autoforge: se gastan los de mayor potencial y se queda el peor',
    originals.length === 1 && originals[0].id === 'p1',
    'de los cinco siguen=' + originals.map((w: any) => w.id).join(',') || 'ninguno');

  // --- CON UNO SOLO NO SE PUEDE, Y SE DICE POR QUÉ -----------------------
  const g3 = await boot(baseSave([recDePotencial('solo', 1, 3)],
    { warehouseCapacity: 40 }));
  const plan3 = g3.autoForgePreview('collector', 1);
  check('autoforge: con un solo material no se puede forjar, y lo dice',
    plan3.puede === false && plan3.tiradas === 0 && /2/.test(plan3.msg),
    `puede=${plan3.puede} msg="${plan3.msg}"`);

  // --- LO EQUIPADO NO ENTRA, Y CON LA MISMA REGLA QUE LA FORJA MANUAL ----
  // **ESTE CASO VALÍA LA MITAD DEL TRABAJO.** El equipado del recolector se
  // marca con la bandera `equipped` dentro del almacén, no con un id suelto en
  // el estado. Una primera versión del auto-forge miraba el id suelto, así que
  // un recolector con la puesta y sin el id se colaba en el reparto: la tirada
  // reventaba **después** de haber gastado la anterior.
  const g4 = await boot(baseSave([
    ...cuatro(),
    { ...recDePotencial('puesto', 1, 5), equipped: true }
  ], { warehouseCapacity: 40 }));
  const plan4 = g4.autoForgePreview('collector', 1);
  check('autoforge: el equipado no entra en el reparto',
    !plan4.pares.some((par: string[]) => par.includes('puesto')),
    'pares=' + JSON.stringify(plan4.pares));

  // **Y CON UN EQUIPADO DE POTENCIAL MAXIMO, EL REPARTO SIGUE SIENDO EL MISMO.**
  // Si el filtro se aplicara después de ordenar, el ★5 puesto se contaría como
  // el primero y el reparto real bajaría un puesto: el mismo botón daría dos
  // listas distintas según se mirase antes o después.
  check('autoforge: y el reparto de los otros no se mueve por el equipado',
    JSON.stringify(plan4.pares) === JSON.stringify([['p5', 'p4'], ['p2', 'p1']]),
    'pares=' + JSON.stringify(plan4.pares));

  // --- LA TIRADA REAL COBRA LO QUE DIJO LA VISTA PREVIA ------------------
  // **ESTA ES LA COMPROBACIÓN QUE IMPORTA.** Se fija el dado a 0.001, que
  // siempre acierta, para que la tirada dependa solo del reparto y del cobro.
  const g5 = await boot(baseSave(cuatro(), { warehouseCapacity: 40, crystals: 0 }));
  const plan5 = g5.autoForgePreview('collector', 1);
  const r5 = conRoll(0.001, () => g5.autoForge('collector', 1));
  check('autoforge: hace tantas tiradas como dijo la vista previa',
    r5.resultados.length === plan5.tiradas,
    `hechas=${r5.resultados.length} previstas=${plan5.tiradas}`);

  check('autoforge: y con el dado fijado acierta todas',
    r5.hechos === plan5.tiradas && r5.fallos === 0,
    `hechos=${r5.hechos} fallos=${r5.fallos}`);

  // **Y EL ALMACÉN BAJA EN EL NÚMERO DE MATERIALES QUE DIJO, NO EN OTRO.**
  check('autoforge: el almacen se queda sin los materiales gastados',
    wh(g5).filter((w: any) => w.type === 'collector').length === 2,
    `quedan=${wh(g5).filter((w: any) => w.type === 'collector').length}`);

  // --- LOS RESULTADOS VAN UNO A UNO, CON SU NOMBRE -----------------------
  // Sin nombre no hay lista: el jugador vería "2 de 2 forjados" y no sabría
  // qué salió de cada par, que es justo lo que pasó con las cajas y se corrigió
  // porque una caja que no enseña su contenido no se puede contar.
  check('autoforge: cada resultado trae su nombre y su item',
    r5.resultados.every((r: any) => r.exito && r.nombre && r.item),
    'nombres=' + r5.resultados.map((r: any) => r.nombre ?? 'null').join(', '));

  // --- OTRO TIER, Y OTRO TIPO -------------------------------------------
  // La función no puede tener un atajo por tier ni por tipo: un error que
  // solo sale con compañeros es un error igual de real que uno que solo sale en
  // el T7.
  const g6 = await boot(baseSave([
    companion('c1', 2, { potential: 1 }),
    companion('c5', 2, { potential: 5 }),
    companion('c3', 2, { potential: 3 })
  ], { warehouseCapacity: 40 }));
  const plan6 = g6.autoForgePreview('companion', 2);
  check('autoforge: tambien funciona con compañeros y reparte igual',
    JSON.stringify(plan6.pares) === JSON.stringify([['c5', 'c3']]) && plan6.sobrantes === 1,
    'pares=' + JSON.stringify(plan6.pares) + ' sobrantes=' + plan6.sobrantes);

  const g7 = await boot(baseSave(cuatro(), { warehouseCapacity: 40 }));
  const plan7 = g7.autoForgePreview('collector', 3);
  check('autoforge: otro tier sale vacio, no mezcla con el T1',
    plan7.disponibles === 0 && plan7.puede === false,
    `disponibles=${plan7.disponibles}`);
}

  // --- LAS PIEDRAS AUTOMÁTICAS, Y POR QUÉ EL PREVIEW Y EL COBRO TIENEN
  //     QUE DAR EL MISMO NÚMERO --------------------------------------------
  // **ESTO ES LA REGLA DE R3 APLICADA A UNA SERIE.** El modal lee el preview
  // y el cobro hace otra pasada: si difieren en uno, en una serie de cinco
  // tiradas el jugador ha pagado cinco piedras que no le dijeron. Por eso el
  // auto-forge gasta `plan.stones[i]` y no recalcula.
  {
    // Cuatro del T9: sin piedras no llegan, y con stock cada par pide las
    // suyas de la regla —que en el T9 son diez, el tope de la mano, porque ni
    // diez llegan al 95 % allí.
    const g8 = await boot(baseSave([
      recDePotencial('a9', 9, 5), recDePotencial('b9', 9, 4),
      recDePotencial('c9', 9, 3), recDePotencial('d9', 9, 2)
    ], { warehouseCapacity: 40 }));
    const plan8 = g8.autoForgePreview('collector', 9);

    check('autoforge: sin piedras, el preview dice cero y no inventa gasto',
      plan8.stonesTotal === 0 && plan8.stones.every((n: number) => n === 0),
      `total=${plan8.stonesTotal} porTirada=${JSON.stringify(plan8.stones)}`);

    // Con piedras de sobra, la suma por par debe ser el total, y no un número
    // redondo inventado: diez por tirada son veinte en dos tiradas.
    const g9 = await boot(baseSave([
      recDePotencial('a9', 9, 5), recDePotencial('b9', 9, 4),
      recDePotencial('c9', 9, 3), recDePotencial('d9', 9, 2),
      consumable('piedras', 'calibrationStone', 40)
    ], { warehouseCapacity: 40 }));
    const plan9 = g9.autoForgePreview('collector', 9);
    check('autoforge: el total de piedras es la suma de las de cada par',
      plan9.stonesTotal === plan9.stones.reduce((a: number, n: number) => a + n, 0),
      `total=${plan9.stonesTotal} porTirada=${JSON.stringify(plan9.stones)}`);

    // **Y LO QUE DICE EL PREVIEW ES LO QUE SE COBRA.** Esta es la comprobación
    // que de verdad importa: se tira la serie y se mira lo que se gastó.
    const gastadas = () => wh(g9)
      .filter((w: any) => w.buffId === 'calibrationStone')
      .reduce((a: number, w: any) => a + (w.stackCount || 1), 0);
    const antes = gastadas();
    const r9 = conRoll(0.001, () => g9.autoForge('collector', 9));
    const gastadasDeVerdad = antes - gastadas();

    check('autoforge: el preview promete el mismo gasto que el cobro',
      r9.stonesTotal === plan9.stonesTotal && gastadasDeVerdad === plan9.stonesTotal,
      `prometidas=${plan9.stonesTotal} cobradas=${gastadasDeVerdad} devueltas=${r9.stonesTotal}`);

    // **CADA PAR PIDE LAS NECESARIAS DE LA REGLA — Y EN EL T9 NI DIEZ LLEGAN AL 95 %.**
    // Antes el objetivo era siempre el 95 % y el tope diez llegaba en todos los
    // tiers. Con piedras de 1,2 puntos ya no: en el T9 la base es 0,38 y el techo
    // de la mano 0,50. Por eso el preview trae `chanceConNecesarias` y el botón de
    // la vista solo dice "para el 95 %" cuando de verdad se alcanza (R3). Aquí se
    // fija la otra mitad: que la cantidad pedida es la de la regla y que con ella
    // la probabilidad **es menor que el 95 %**, o sea que nadie está prometiendo
    // un tope que no se puede pagar.
    check('autoforge: cada par pide las necesarias de la regla, ni una de más',
      plan9.stones.every((n: number) => n === piedrasParaObjetivo(9, 0, 0)),
      `porTirada=${JSON.stringify(plan9.stones)} regla=${piedrasParaObjetivo(9, 0, 0)}`);
    check('autoforge: y con esas piedras el T9 se queda en 0,50: el 95 % no se promete',
      successChance(9, 0, plan9.stones[0], 0) < 0.95
        && Math.abs(successChance(9, 0, plan9.stones[0], 0)
          - successChance(9, 0, plan9.stones[0] - 1, 0) - 0.012) < 1e-9,
      `con=${successChance(9, 0, plan9.stones[0], 0)} una menos=${successChance(9, 0, plan9.stones[0] - 1, 0)}`);

    // **SI NO HAY PIEDRAS SUFICIENTES, GASTA LAS QUE HAY Y SIGUE FORJANDO.**
    // Devolver un error dejaría al jugador sin poder usar un botón que sí
    // funciona: la forja no depende de las piedras, solo su probabilidad.
    const g10 = await boot(baseSave([
      recDePotencial('a9', 9, 5), recDePotencial('b9', 9, 4),
      consumable('piedras', 'calibrationStone', 2)
    ], { warehouseCapacity: 40 }));
    const plan10 = g10.autoForgePreview('collector', 9);
    check('autoforge: con pocas piedras gasta las que hay y no se niega',
      plan10.stonesTotal === 2,
      `total=${plan10.stonesTotal} porTirada=${JSON.stringify(plan10.stones)}`);

    const r10 = conRoll(0.001, () => g10.autoForge('collector', 9));
    check('autoforge: y la serie se completa igualmente sin piedras',
      r10.success === true && r10.resultados.length === 1,
      `success=${r10.success} resultados=${r10.resultados.length}`);
  }

  // --- Y LA SERIE DE COMPAÑEROS CUENTA LOS AFIJOS EN EL PLAN, COMO EL COBRO --
  // **ESTA ES LA MITAD DE R3 QUE MIRABA EL OTRO SENTIDO.** El cobro de la serie
  // usa la suerte de afijos del par —la forja de compañeros la cuenta desde que
  // hereda afijos—, y el plan tenía una rama que la ponía a cero solo para
  // compañeros: el diálogo prometía MÁS piedras de las que la serie cobraba, y
  // el jugador veía quedarse el contador de piedras por debajo de lo dicho.
  //
  // Se mide en T1 porque ahí la diferencia se ve sin que la sature el tope: la
  // base es 0,78, sin afijos el par pide las 10 de siempre y con 4 afijos de
  // material (+8 puntos) pide las de la regla, que son 8. Y lo cobrado tiene
  // que ser exactamente lo prometido.
  {
    const gA = await boot(baseSave([
      companion('s1', 1, { potential: 5, rarity: 'Épico', affixes: ['aff_yield', 'aff_flow'] }),
      companion('s2', 1, { potential: 4, rarity: 'Épico', affixes: ['aff_yield', 'aff_bulwark'] }),
      consumable('piedras', 'calibrationStone', 40)
    ], { warehouseCapacity: 40 }));
    const planA = gA.autoForgePreview('companion', 1);
    check('autoforge: el plan de compañeros cuenta los afijos, como el cobro',
      planA.stones[0] === piedrasParaObjetivo(1, 0, 0.08)
        && planA.stones[0] < piedrasParaObjetivo(1, 0, 0),
      `porTirada=${JSON.stringify(planA.stones)} conAfijos=${piedrasParaObjetivo(1, 0, 0.08)} sin=${piedrasParaObjetivo(1, 0, 0)}`);
    const antesA = wh(gA).filter((w: any) => w.buffId === 'calibrationStone')
      .reduce((a: number, w: any) => a + (w.stackCount || 1), 0);
    const rA = conRoll(0.001, () => gA.autoForge('companion', 1));
    const despuesA = wh(gA).filter((w: any) => w.buffId === 'calibrationStone')
      .reduce((a: number, w: any) => a + (w.stackCount || 1), 0);
    check('autoforge: y la serie de compañeros cobra exactamente lo que prometió el plan',
      rA.stonesTotal === planA.stonesTotal && antesA - despuesA === planA.stonesTotal,
      `prometidas=${planA.stonesTotal} cobradas=${antesA - despuesA} devueltas=${rA.stonesTotal}`);
  }

  // --- F65 · LA SERIE CON DOS CHECKS: PIEDRAS Y NANO, POR SEPARADO --------
  // **APAGAR NO ES AHORRAR A MEDIAS.** Con el check de piedras apagado, el
  // preview promete cero y el cobro gasta cero: si el diálogo dijera el total
  // de siempre y la serie no gastara, el jugador no sabría qué pagó.
  {
    const g = await boot(baseSave([
      recDePotencial('a9', 9, 5), recDePotencial('b9', 9, 4),
      recDePotencial('c9', 9, 3), recDePotencial('d9', 9, 2),
      consumable('piedras', 'calibrationStone', 40)
    ], { warehouseCapacity: 40 }));
    const plan = g.autoForgePreview('collector', 9, false, false);
    check('autoforge: con el check apagado el preview promete cero piedras',
      plan.stonesTotal === 0 && plan.stones.every((n: number) => n === 0),
      `total=${plan.stonesTotal} porTirada=${JSON.stringify(plan.stones)}`);

    const gastadas = () => wh(g)
      .filter((w: any) => w.buffId === 'calibrationStone')
      .reduce((a: number, w: any) => a + (w.stackCount || 1), 0);
    const antes = gastadas();
    const r = conRoll(0.001, () => g.autoForge('collector', 9, false, false));
    check('autoforge: y la serie no gasta ni una aunque haya stock',
      r.success === true && r.hechos === 2 && r.stonesTotal === 0 && gastadas() === antes,
      `hechos=${r.hechos} total=${r.stonesTotal} stock=${gastadas()} antes=${antes}`);
    const g2 = await recargar(g);
    check('autoforge: y la serie sin piedras sobrevive a la recarga',
      wh(g2).filter((w: any) => w.type === 'collector').length === 2,
      `quedan=${wh(g2).filter((w: any) => w.type === 'collector').length}`);
  }
  {
    // **LA NANO YA NO TOCA LA SERIE DE COMPAÑEROS: NI PROMETE NI COBRA.** Su
    // efecto es subir la rareza un escalón, y la del compañero la pone el tier,
    // así que el plan la fuerza a cero **aunque el check esté puesto**: un
    // número que la vista enseña y el motor no cobra sería mentir con la fila
    // entera. Y la prueba de que no hace falta: las dos series dan el mismo
    // potencial —el ascenso es de la tirada de la fusión, que tira igual con y
    // sin nano en la mano—.
    const dos = () => [
      companion('c1', 2, { potential: 2 }),
      companion('c2', 2, { potential: 2 }),
      companion('c3', 2, { potential: 2 }),
      companion('c4', 2, { potential: 2 })
    ];
    const g = await boot(baseSave([...dos(), consumable('n1', 'stabilityNano', 4)],
      { warehouseCapacity: 40 }));
    const plan = g.autoForgePreview('companion', 2, true, true);
    check('autoforge: el plan de compañeros promete cero nanos, con el check puesto',
      plan.nanoTotal === 0,
      `total=${plan.nanoTotal} stock=${plan.nanoStock} tiradas=${plan.tiradas}`);

    const r = conRoll(0.001, () => g.autoForge('companion', 2, true, true));
    const nanoTras = wh(g).find((w: any) => w.id === 'n1');
    check('autoforge: la serie con nano marcada forja las dos y sube por la tirada',
      r.hechos === 2 && r.resultados.every((x: any) => x.item?.potential === 3),
      `hechos=${r.hechos} potenciales=${r.resultados.map((x: any) => x.item?.potential).join(',')}`);
    check('autoforge: y ninguna nano se cobra: la pila se queda en cuatro',
      r.nanoTotal === 0 && nanoTras?.stackCount === 4,
      `gastadas=${r.nanoTotal} stack=${nanoTras?.stackCount}`);

    // **Y SIN NANO EN LA MANO, EL MISMO RESULTADO.** Si las dos series dan el
    // mismo potencial, la nano marcada no estaba moviendo nada —que es
    // exactamente lo que se quiere que no haga en compañeros.
    const gB = await boot(baseSave(dos(), { warehouseCapacity: 40 }));
    const rB = conRoll(0.001, () => gB.autoForge('companion', 2, true, false));
    check('autoforge: y sin nano el resultado es idéntico, que es lo que se exige',
      rB.hechos === 2 && rB.resultados.every((x: any) => x.item?.potential === 3),
      `potenciales=${rB.resultados.map((x: any) => x.item?.potential).join(',')}`);
  }

  // --- B43 · LA SERIE GUARDA UNA VEZ, NO UNA POR PAREJA ------------------
  // **ESTA ES LA PRUEBA DEL PICO DE LA MAÑANA.** `autoForge()` llamaba a la
  // forja de a una por tirada y cada una guardaba y repintaba, más el guardado
  // final: N parejas eran N+1 guardados. Forjar compañeros en serie quemó la
  // cuota con el mismo documento escrito decenas de veces seguidas. (F104 lo
  // deja en un solo bloque de un solo documento: la fila ya no sale con cada
  // guardado.)
  //
  // **SE MIDE CON EL CONTADOR DEL STUB, NO CON UNA CUENTA.** `db.escrituras`
  // es la partida y `db.filas` la fila del ranking: lo que Firestore cobra. El
  // contador se pone a cero DESPUÉS del arranque y de una forja manual previa,
  // que ya escribe lo suyo —y de paso desbloquea `first_forge`, para que la
  // serie medida no estrene ningún logro a mitad y su guardado no ensucie la
  // cuenta—. La escritura del final ya está pedida: se espera a que llegue con
  // un turno al bucle, sin `flush()`, que pediría OTRO guardado y correría la
  // carrera de la discrepancia 14 contra el que está en vuelo.
  {
    const seis = () => [
      companion('m0', 2, { potential: 2 }),
      companion('m1', 2, { potential: 2 }),
      companion('c1', 2, { potential: 2 }),
      companion('c2', 2, { potential: 2 }),
      companion('c3', 2, { potential: 2 }),
      companion('c4', 2, { potential: 2 })
    ];
    const g = await boot(baseSave(seis(), { warehouseCapacity: 40 }));
    const manual: any = conRoll(0.001, () => g.forgeCompanion(['m0', 'm1']));
    await g.flush();
    await new Promise((res) => setTimeout(res, 20));
    check('autoforge: la forja manual previa sale y desbloquea el logro de forja',
      manual.success === true && (s(g).unlockedAchievements ?? []).includes('first_forge'),
      `success=${manual.success} logros=${JSON.stringify(s(g).unlockedAchievements ?? [])}`);

    const db = (globalThis as any).__MEM_DB__;
    db.escrituras = 0;
    db.filas = 0;
    const logrosAntes = [...(s(g).unlockedAchievements ?? [])];
    const r = conRoll(0.001, () => g.autoForge('companion', 2));
    // **SIN `flush()`: ESO SERÍA OTRO GUARDADO.** `flush()` dispara su propio
    // `saveToFirebase()`, y con el de la serie todavía en vuelo los dos pasan
    // el filtro de "¿cambió algo?" a la vez y escriben los dos: la misma
    // carrera de la discrepancia 14. La escritura ya está pedida; solo se
    // espera a que llegue.
    await new Promise((res) => setTimeout(res, 20));
    check('autoforge: la serie de dos parejas forja las dos',
      r.hechos === 2 && r.resultados.length === 2,
      `hechos=${r.hechos} resultados=${r.resultados.length}`);
    // **1 ES SOLO LA PARTIDA: UN SOLO GUARDADO.** Cada `saveToFirebase()` escribe
    // la partida cuando algo cambió; dos parejas con el código viejo eran hasta
    // siete escrituras (una por tirada más la final). F104: la fila y la tarjeta
    // van a su propio ritmo de quince minutos, así que la serie ya no las
    // arrastra. Lo que se ata es que la serie cuesta un guardado, haya una o
    // cincuenta parejas.
    check('autoforge: y la serie cuesta un solo guardado, no uno por pareja',
      db.escrituras === 1,
      `escrituras=${db.escrituras}`);
    check('autoforge: y la fila del ranking no sale con la serie (va a su ritmo)',
      db.filas === 0,
      `filas=${db.filas}`);
    check('autoforge: y la serie no estrena logros a mitad, que guardarían de más',
      JSON.stringify(s(g).unlockedAchievements ?? []) === JSON.stringify(logrosAntes),
      `logros=${JSON.stringify(s(g).unlockedAchievements ?? [])}`);
    const g2 = await recargar(g);
    // **EL CONTEO VA POR `forgedCount`, NO POR ITEMS.** Con el dado fijado los
    // tres ids salen del mismo milisegundo con el mismo sufijo (`conRoll` clava
    // la parte aleatoria), así que dos forjados pueden compartir id y su espejo
    // en el almacén es uno solo: contar items es contar una lotería de
    // milisegundos. El contador sube uno por acierto sí o sí, en memoria y en
    // el documento, y eso es lo que demuestra que la serie llegó al disco.
    check('autoforge: y los tres aciertos quedan anotados tras recargar',
      (s(g2).forgedCount ?? 0) === 3,
      `forgedCount=${(s(g2).forgedCount ?? 0)}`);
    check('autoforge: y el almacén recargado trae los forjados',
      wh(g2).filter((w: any) => w.type === 'companion' && (w.tier ?? 0) === 3).length >= 2,
      `T3=${wh(g2).filter((w: any) => w.type === 'companion' && (w.tier ?? 0) === 3).length}`);
  }
  {
    // **Y EN RECOLECTORES LA NANO SIGUE GASTÁNDOSE POR PAREJA: SI NO ALCANZA, LA
    // PAREJA SE QUEDA.** Es la misma regla de siempre, pero ahora en el único
    // sitio donde la nano hace algo. Con una sola nano y dos tiradas, la primera
    // la gasta y la segunda se queda sin nano —y sin forjar, porque el cobro va
    // antes de la tirada—: los materiales siguen en el almacén y el total cuenta
    // la que salió de verdad.
    const g = await boot(baseSave([
      recDePotencial('a2', 2, 5), recDePotencial('b2', 2, 4),
      recDePotencial('c2', 2, 3), recDePotencial('d2', 2, 2),
      consumable('n1', 'stabilityNano', 1)
    ], { warehouseCapacity: 40 }));
    const r = conRoll(0.001, () => g.autoForge('collector', 2, true, true));
    check('autoforge: con una nano para dos tiradas solo sale una',
      r.hechos === 1 && r.fallos === 1,
      `hechos=${r.hechos} fallos=${r.fallos}`);
    check('autoforge: y el total cuenta una nano, no dos',
      r.nanoTotal === 1, `total=${r.nanoTotal}`);
    check('autoforge: y la pareja sin nano se queda en el almacén',
      ['c2', 'd2'].every(id => wh(g).some((w: any) => w.id === id)),
      'quedan=' + wh(g).map((w: any) => w.id).join(','));
  }

  // -------------------------------------------------------------------------
  //  F60 · LA RAREZA Y LOS AFIJOS SE HEREDAN POR PROBABILIDAD
  //
  //  Dos Comunes daban cualquier rareza según el tier, y dos objetos con
  //  Baluarte sorteaban sus afijos con el resto: los materiales decidían
  //  cuántos, no cuáles ni de qué rareza. Ahora lo compartido tira a quedarse:
  //  la rareza compartida se conserva 3 de cada 4 y los afijos compartidos
  //  entran primero. Es lo que permite "forzar" un afijo poniendo dos
  //  materiales que lo traigan.
  // -------------------------------------------------------------------------
  {
    check('herencia: la probabilidad de conservar está escrita y es 3 de cada 4',
      PROB_CONSERVA_RAREZA === 0.75, `p=${PROB_CONSERVA_RAREZA}`);
    check('herencia: con el dado a favor se conserva la compartida',
      rarezaFusionada('Común', 'Común', 'Épico', () => 0) === 'Común', 'no la conservó');
    check('herencia: con el dado en contra sale la calculada',
      rarezaFusionada('Común', 'Común', 'Épico', () => 0.99) === 'Épico', 'no salió la calculada');
    check('herencia: sin rareza compartida no hay nada que conservar',
      rarezaFusionada('Común', 'Raro', 'Épico', () => 0) === 'Épico', 'conservó sin compartir');
    check('herencia: una rareza que no existe no se conserva',
      rarezaFusionada('Rara', 'Rara', 'Épico', () => 0) === 'Épico', 'conservó una inventada');
    check('herencia: y sin rareza en un material tampoco',
      rarezaFusionada(undefined, 'Común', 'Épico', () => 0) === 'Épico', 'conservó con hueco');
  }
  {
    // Dos Comunes de T3 al máximo daban un Épico por tier+potencial; ahora lo
    // normal es que salga Común, que es lo que se puso en el yunque.
    const comun = (id: string) => collector(id, 3, { potential: 5, rarity: 'Común', damage: danioDeRango(3, 5) });
    const r = conRoll(0, () => attemptForge([comun('x'), comun('y')], 3, 'X', opts()));
    check('herencia: dos Comunes dan un Común casi siempre',
      r.success === true && r.collector?.rarity === 'Común',
      `rarity=${r.collector?.rarity}`);
  }
  {
    // F76 · LO QUE LA PANTALLA ANUNCIA ES LO QUE LA FORJA ESTAMPA. La linea de
    // "Rareza calculada" sale de `rarezaCalculadaDeForja()` con el tier nuevo y
    // el promedio del yunque: sin rarezas compartidas no hay nada que conservar
    // y con el segundo dado a 1 la estrella no sube, asi que el forjado tiene
    // que traer exactamente la anunciada.
    const a = (id: string) => collector(id, 3, { potential: 2, rarity: 'Común', damage: danioDeRango(3, 2) });
    const b = (id: string) => collector(id, 3, { potential: 2, rarity: 'Raro', damage: danioDeRango(3, 2) });
    const medio = potencialFusionado([2, 2]);
    const anunciada = rarezaCalculadaDeForja(4, medio);
    const r = conSec(0, 1, () => attemptForge([a('x'), b('y')], 3, 'X', opts()));
    check('herencia: sin compartir, el forjado trae la rareza calculada',
      r.success === true && r.collector?.rarity === anunciada,
      `rarity=${r.collector?.rarity} anunciada=${anunciada}`);
    // **Y LA TABLA ANUNCIADA ES LA DE SIEMPRE.** Los umbrales por potencial y
    // tier no los mueve esta feature: solo se exponen para ensenarlos.
    check('herencia: y la calculada cruza los umbrales donde toca',
      rarezaCalculadaDeForja(4, 2) === 'Épico'
        && rarezaCalculadaDeForja(5, 3) === 'Legendario'
        && rarezaCalculadaDeForja(7, 4) === 'Mítico'
        && rarezaCalculadaDeForja(9, 5) === 'Divino',
      'T4p2=' + rarezaCalculadaDeForja(4, 2)
        + ' T5p3=' + rarezaCalculadaDeForja(5, 3));
  }
  {
    // Lo compartido entra primero, en orden de aparición: forzar es elegir.
    check('herencia: lo compartido sale en el orden en que aparece',
      afijosCompartidos([
        { affixes: ['aff_bulwark', 'aff_sharp'] },
        { affixes: ['aff_sharp', 'aff_bulwark'] }
      ]).join(',') === 'aff_bulwark,aff_sharp',
      afijosCompartidos([
        { affixes: ['aff_bulwark', 'aff_sharp'] },
        { affixes: ['aff_sharp', 'aff_bulwark'] }
      ]).join(','));
    check('herencia: lo no compartido no entra en la lista',
      afijosCompartidos([{ affixes: ['aff_bulwark'] }, { affixes: ['aff_sharp'] }]).length === 0,
      'entró algo sin compartir');
    check('herencia: y un id que no existe tampoco',
      afijosCompartidos([{ affixes: ['aff_bulwark', 'invento'] }, { affixes: ['aff_bulwark', 'invento'] }]).join(',') === 'aff_bulwark',
      'coló un invento');
  }
  {
    // De punta a punta: dos Legendarios con Baluarte y filo, y el forjado lo
    // trae el primero. Con el dado a cero el número es el suelo (3) y los dos
    // primeros huecos son los compartidos, en orden.
    const leg = (id: string) => collector(id, 3, {
      potential: 5, rarity: 'Legendario', damage: danioDeRango(3, 5),
      affixes: ['aff_bulwark', 'aff_sharp']
    });
    const r = conRoll(0, () => attemptForge([leg('x'), leg('y')], 3, 'X', opts()));
    const afijos = r.collector?.affixes ?? [];
    check('herencia: el forjado conserva la rareza compartida',
      r.success === true && r.collector?.rarity === 'Legendario',
      `rarity=${r.collector?.rarity}`);
    check('herencia: y el compartido entra el primero',
      afijos[0] === 'aff_bulwark' && afijos[1] === 'aff_sharp',
      afijos.join(','));
  }

  // =========================================================================
  //  B22 · UN FALLO NO ES UN RECHAZO, Y LA CARD LOS CONDECÍA EN UNO
  // =========================================================================
  //
  //  Lo que se reportó: "a veces la forja falla y sin embargo da el item", y la
  //  versión con más detalle es "vi el cartel de fallo y luego me dio el item".
  //
  //  **LO QUE NO ERA.** Ni el motor entrega un item en un fallo, ni la vista forja
  //  dos veces. Eso está medido: el dado fijado a fallar da `success:false` sin
  //  collector, y un click produce un cartel y un aviso, no dos.
  //
  //  **LO QUE ERA.** El motor devuelve `success:false` en **tres** casos que para el
  //  jugador son uno, y solo uno es un fallo de forja:
  //
  //    · Materiales que no valen, o piedras/nano que no hay → **no se tira nada y los
  //      materiales NO se gastan.** El motor no pone `chance` en la respuesta.
  //    · La tirada sale mal → se gastan los dos materiales y deja el consuelo. El
  //      motor sí pone `chance`.
  //
  //  Los tres pintaban la misma card, y en los dos primeros esa card afirmaba
  //  **"Los materiales se gastan igual"**, que es falso. El jugador ve un fallo rojo,
  //  cierra, y sus dos materiales siguen ahí: de ahí la lectura de que la forja le dio
  //  algo. Y `msg`, que traía el motivo exacto, **no lo leía nadie**.
  //
  //  Lo que se ata aquí es la parte del motor, que es donde el juego cobra y entrega:
  //  un rechazo no gasta materiales, no crea item y **no trae `chance`**, y un fallo sí
  //  lo trae. Que la card lo distinga es de la vista, y lo que se comprueba aquí es que
  //  el discriminante existe y no se puede confundir.
  // =========================================================================

  /** La respuesta del motor tal cual la devuelve el juego, para leerla sin opinion. */
  const porElMotor = async (items: any[], stones = 0, ids2?: [string, string]) => {
    const g = await boot(baseSave(items));
    const w: any[] = g.getState().warehouse;
    const par = (ids2 ?? ['m1', 'm2']) as [string, string];
    return await conRoll(0.999, () => (g as any).forgeCollector(
      [w.find((x) => x.id === par[0])?.id, w.find((x) => x.id === par[1])?.id], stones, 0));
  };

  {
    // El fallo de verdad: hubo tirada, y el motor lo dice trayendo `chance`.
    const r = await porElMotor([collector('m1', 1, { potential: 3 }), collector('m2', 1, { potential: 3 })]);
    check('B22: el fallo de forja trae la probabilidad usada', typeof r.chance === 'number',
      `chance=${r.chance}`);
    check('B22: y no trae item', !r.collector, `collector=${!!r.collector}`);
  }
  {
    // El rechazo: no hay piedras y las pide. No hubo tirada, así que NO puede
    // traer `chance` — ese campo es el discriminante entero del arreglo.
    const r = await porElMotor([
      collector('m1', 1, { potential: 3 }),
      collector('m2', 1, { potential: 3 })
    ], 5);
    check('B22: el rechazo por consumibles NO trae probabilidad, o sea que no hubo tirada',
      typeof r.chance !== 'number', `chance=${r.chance}`);
    check('B22: y dice por qué', typeof r.msg === 'string' && r.msg.length > 0, `msg=${r.msg}`);
    check('B22: y no trae item', !r.collector, `collector=${!!r.collector}`);
  }
  {
    // Y el motivo: es la información que la card tiraba a la basura, así que se
    // ata que existe y que nombra lo que falta.
    const r = await porElMotor([
      collector('m1', 1, { potential: 3 }),
      collector('m2', 1, { potential: 3 })
    ], 5);
    check('B22: el motivo nombra las piedras', /piedra/i.test(r.msg ?? ''), `msg=${r.msg}`);
  }
  {
    // La regla que hace que el rechazo no cueste materiales. Sin esto, el jugador
    // pierde los dos por un botón que no teníastones, y el "fallo" sí sería de verdad.
    const items = [collector('m1', 1, { potential: 3 }), collector('m2', 1, { potential: 3 })];
    const g = await boot(baseSave(items));
    const w: any[] = g.getState().warehouse;
    const antes = w.length;
    const r = await conRoll(0.999, () => (g as any).forgeCollector(
      [w.find((x) => x.id === 'm1')!.id, w.find((x) => x.id === 'm2')!.id], 5, 0));
    const despues: any[] = g.getState().warehouse;
    check('B22: el rechazo NO gasta los materiales', despues.length === antes,
      `antes=${antes} despues=${despues.length} msg=${r.msg}`);
  }

  resumen('la forja: dos del mismo tier, potencial medio y afijos por linaje');
}

// =========================================================================
//  F81 · LA FILA DE LA SERIE ENSEÑA EL ITEM ENTERO
// =========================================================================
//
//  Se pasa de "una línea con un sparkle y un nombre" a las cuatro cosas que el motor
//  ya devolvía por resultado y que la vista no leía: el icono del tipo, las
//  estrellas, el tier y los afijos como tag.
//
//  **LO QUE SE COMPRUEBA AQUÍ ES LA REGLA DE QUÉ SE PINTA Y QUÉ NO**, que es la
//  parte que puede mentir en silencio: una fila de acierto con los cuatro datos, y
//  una de fallo con **ninguno** —porque el fallo no tiene item, y pintarle un "T2"
//  sería inventar el dato. Es el mismo criterio que `tierDeFila()` en el resumen de
//  apertura, y por el mismo motivo.
//
//  **LO QUE NO SE COMPRUEBA Y HAY QUE DECIR:** que no se desborde. Eso es layout, y
//  `domStub` no tiene medidas: una prueba escrita ahí daría verde sin mirar nada. Es
//  `preview.html`, y con el mock de `preview.ts` **no se puede** porque el mock no
//  trae la serie —solo `forgeCollector` y `forgeCompanion`—.
const fila = (x: any): string => filaDeSerie(x, 0, 'collector');

async function main2() {
  const item = {
    name: 'Herencia de Éclipsis', type: 'collector', rarity: 'Mítico',
    tier: 8, potential: 4, affixes: ['aff_sharp', 'aff_bulwark']
  };
  const acierto = fila({ exito: true, nombre: item.name, item, msg: 'x forjada' });
  const fallo = fila({ exito: false, nombre: null, item: null, msg: 'Fallo en la forja' });

  check('F81: la fila de acierto enseña las estrellas del item',
    acierto.includes('★★★★'), 'no hay estrellas');
  check('F81: y el tier, que es la otra mitad de la calidad',
    /\bT8\b/.test(acierto), 'no hay T8');
  check('F81: y el icono del tipo, no uno generico para todos',
    /data-ico="collector"/.test(acierto), 'no hay data-ico del tipo');
  check('F81: los afijos salen por su nombre, como tags',
    acierto.includes('Afilado') && acierto.includes('Baluarte'),
    'faltan afijos');
  check('F81: y el tag lleva la rareza del afijo, que es la que lo tiñe',
    /rarity-\w+/.test(acierto) && acierto.includes('style="border-color: currentColor"'),
    'el tag no tiene el estilo de la ficha');
  check('F81: el nombre del item sale entero',
    acierto.includes('Herencia de Éclipsis'), 'no sale el nombre');

  // **LA MITAD IMPORTANTE: LO QUE NO TIENE QUE SALIR.**
  check('F81: la fila de fallo NO enseña estrellas',
    !fallo.includes('★'), 'sale una estrella en un fallo');
  check('F81: ni tier',
    !/\bT\d+\b/.test(fallo), 'sale un T en un fallo');
  check('F81: ni afijos',
    !fallo.includes('Afilado') && !fallo.includes('Baluarte'), 'salen afijos en un fallo');
  check('F81: ni el icono del objeto, sino el de fallo',
    !fallo.includes('data-ico="collector"') && /data-ico="close"/.test(fallo),
    'icono equivocado en un fallo');
  check('F81: y el fallo sí dice por qué',
    fallo.includes('Fallo en la forja'), 'no sale el motivo');

  // **UN ACIERTO CON UN ITEM CORRUPTO NO ROMPE LA FILA.** El item viene del guardado
  // de otro jugador y del motor, y un campo ausente tiene que salir vacío en vez de
  // pintar `undefined` o `TNaN`.
  const sinNada = fila({ exito: true, nombre: 'X', item: { name: 'X', rarity: 'Común' } });
  // El `undefined` se busca en el texto *pintado*, no en el HTML entero: la función
  // lleva su comentario en un comentario HTML, y el comentario habla de `undefined`.
  // Una comprobación que lo busca en todo el HTML se pasa por el comentario y se
  // acaba mirando su propia documentación —que es lo que pasó con la primera versión.
  const pintado = sinNada.replace(/<!--[\s\S]*?-->/g, '');
  const conEstrella = pintado.match(/.{40}★.{40}/);
  const conT = pintado.match(/\bT\d+\b/);
  const conUndef = pintado.includes('undefined');
  check('F81: un item sin potencial ni tier no inventa ninguno',
    !conEstrella && !conT && !conUndef,
    `estrella=${JSON.stringify(conEstrella)} tier=${conT ? conT[0] : 'no'} undef=${conUndef}`);
  check('F81: y un tier imposible cae a nada, no a T0',
    !fila({ exito: true, nombre: 'Y', item: { name: 'Y', rarity: 'Común', tier: 0, potential: 3 } }).includes('T0'),
    'sale T0');

  resumen('la fila de la serie enseña el item entero');
}

export default (async () => { await main(); await main2(); })();
