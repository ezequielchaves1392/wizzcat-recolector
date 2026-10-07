
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

import { boot, bootNew, check, resumen, s, wh, ids, baseSave, collector, companion, ficha, consumable, conRoll, reload, recargar } from './kit';
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
  valorDeUnCristal, cristalesDeConsuelo, rarezaFusionada, afijosCompartidos,
  PROB_CONSERVA_RAREZA
} from '../src/data/crafting';

const TODOS_LOS_AFIJOS = AFFIXES.map(a => a.id);

const opts = (extra: any = {}) => ({
  craftLuck: 0, consolationBonus: 0, stonesUsed: 0, nanoUsed: 0, ...extra
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
    // Cuatro del T9: sin piedras no llegan, y con stock cada par pide las suyas
    // para el 95 % (nueve por tirada con siete puntos cada una).
    const g8 = await boot(baseSave([
      recDePotencial('a9', 9, 5), recDePotencial('b9', 9, 4),
      recDePotencial('c9', 9, 3), recDePotencial('d9', 9, 2)
    ], { warehouseCapacity: 40 }));
    const plan8 = g8.autoForgePreview('collector', 9);

    check('autoforge: sin piedras, el preview dice cero y no inventa gasto',
      plan8.stonesTotal === 0 && plan8.stones.every((n: number) => n === 0),
      `total=${plan8.stonesTotal} porTirada=${JSON.stringify(plan8.stones)}`);

    // Con piedras de sobra, la suma por par debe ser el total, y no un número
    // redondo inventado: nueve por tirada son dieciocho en dos tiradas.
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

    check('autoforge: y cada par gasta hasta el 95 por ciento',
      plan9.stones.every((n: number) => n === 0 || successChance(9, 0, n, 0) >= 0.95),
      'porTirada=' + JSON.stringify(plan9.stones));

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
    // **LA NANO SE VE EN EL POTENCIAL DEL COMPAÑERO.** En compañeros la nano
    // sube +1 al potencial, que es un número exacto y no un sorteo: dos ★2 con
    // nano dan un ★3, y sin nano dan un ★2. Es la prueba que distingue "la nano
    // entró" de "la nano se cobró y no hizo nada".
    const dos = () => [
      companion('c1', 2, { potential: 2 }),
      companion('c2', 2, { potential: 2 }),
      companion('c3', 2, { potential: 2 }),
      companion('c4', 2, { potential: 2 })
    ];
    const g = await boot(baseSave([...dos(), consumable('n1', 'stabilityNano', 4)],
      { warehouseCapacity: 40 }));
    const plan = g.autoForgePreview('companion', 2, true, true);
    check('autoforge: el preview cuenta una nano por tirada y dice el stock',
      plan.nanoTotal === 2 && plan.nanoStock === 4,
      `total=${plan.nanoTotal} stock=${plan.nanoStock} tiradas=${plan.tiradas}`);

    const r = conRoll(0.001, () => g.autoForge('companion', 2, true, true));
    check('autoforge: con nano, los dos forjados suben +1 de potencial',
      r.hechos === 2 && r.resultados.every((x: any) => x.item?.potential === 3),
      `hechos=${r.hechos} potenciales=${r.resultados.map((x: any) => x.item?.potential).join(',')}`);
    check('autoforge: y se gastó una nano por tirada, lo que dijo el preview',
      r.nanoTotal === plan.nanoTotal && r.nanoTotal === 2,
      `gastadas=${r.nanoTotal} previstas=${plan.nanoTotal}`);

    // **Y SIN NANO, EL MISMO PAR DA UN ★2.** La diferencia entre las dos series
    // es la nano y nada más: sin ella el potencial es la media sin subir.
    const gB = await boot(baseSave(dos(), { warehouseCapacity: 40 }));
    const rB = conRoll(0.001, () => gB.autoForge('companion', 2, true, false));
    check('autoforge: sin nano el potencial es la media, sin subir',
      rB.hechos === 2 && rB.resultados.every((x: any) => x.item?.potential === 2),
      `potenciales=${rB.resultados.map((x: any) => x.item?.potential).join(',')}`);
  }
  {
    // **SI LA NANO NO ALCANZA, LA PAREJA FALLA SIN PERDER MATERIALES.** El
    // cobro va antes de la tirada: sin nano que gastar, la pareja se queda
    // como está y el total solo cuenta lo que salió del almacén.
    const g = await boot(baseSave([
      companion('c1', 2, { potential: 2 }),
      companion('c2', 2, { potential: 2 }),
      companion('c3', 2, { potential: 2 }),
      companion('c4', 2, { potential: 2 }),
      consumable('n1', 'stabilityNano', 1)
    ], { warehouseCapacity: 40 }));
    const r = conRoll(0.001, () => g.autoForge('companion', 2, true, true));
    check('autoforge: con una nano para dos tiradas solo sale una',
      r.hechos === 1 && r.fallos === 1,
      `hechos=${r.hechos} fallos=${r.fallos}`);
    check('autoforge: y el total cuenta una nano, no dos',
      r.nanoTotal === 1, `total=${r.nanoTotal}`);
    check('autoforge: y la pareja sin nano se queda en el almacén',
      ['c3', 'c4'].every(id => wh(g).some((w: any) => w.id === id)),
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
  resumen('la forja: dos del mismo tier, potencial medio y afijos por linaje');
}

export default main();
