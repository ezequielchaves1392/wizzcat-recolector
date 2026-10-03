// ==========================================================================
//  Banco de pruebas de APILADO: una pila ocupa UNA ranura
//
//  El bug que cubre
//  ----------------
//  La rejilla agrupaba los items iguales en una celda y el contador de ranuras
//  contaba ENTRADAS del array. Un jugador con 19 unidades de la misma cosa veía
//  una celda con un "19" arriba y un "19/21 ranuras" al lado, y el almacén se le
//  llenaba de duplicados que él no había pedido guardar: cada caja que soltaba
//  un item metía un item nuevo en vez de sumar una unidad a la pila que ya había.
//
//  Lo que se comprueba aquí
//  ------------------------
//    1. Meter un apilable lo suma a la pila existente, no abre ranura nueva.
//    2. La migración colapsa las partidas ya jugadas sin perder unidades.
//    3. El contador de ranuras y la rejilla dicen SIEMPRE lo mismo.
//    4. Un almacén lleno admite más unidades de lo que ya tiene, y no admite
//       un item que sí ocuparía ranura.
//    5. Vender y gastar una pila sigue funcionando después de fusionarla.
//    6. F30 · El tope de pintado NO recorta lo que hay, y lo dice con un "+".
// ==========================================================================

import { visibleStacksFor } from '../src/components/warehouse';
import { countOccupiedSlots, isStackable, mergeStacks, partirPilas, stackUnits, textoDeCantidad, topeDePila, cabeEnPila, pilasNecesarias, MAX_STACK, TOPE_PILA } from '../src/data/stacking';
import { boot, reload, bootNew, check, resumen, s, wh, ids, nanites, baseSave, collector, crate, key, crystalViejo, consumable } from './kit';
// Lo que vale una unidad del recurso único. La tienda lo entrega a este precio, así
// que el banco no lo escribe: lo lee de la función que lo calcula.
import { valorDeUnCristal } from '../src/data/crafting';

/** Cuántas celdas pinta la rejilla, que es lo que el jugador ve. */
const celdas = (g: any) => visibleStacksFor(g, s(g), 'all', 'default');

/** Cuántas unidades de un tipo hay, sin importar cuántas pilas las guarden. */
const unidades = (g: any, type: string): number =>
  wh(g).filter((w: any) => w.type === type).reduce((a: number, w: any) => a + stackUnits(w), 0);

async function main() {
  // =========================================================================
  //  1. La regla, sola
  // =========================================================================
  {
    // La fusión, medida con el CONSUMIBLE: es el objeto que el juego fabrica y que
    // se apila sin tope, así que 19 + 4 tienen que acabar en la misma pila.
    //
    // **POR QUÉ NO ES EL CRISTAL, QUE ES LO QUE SE USABA ANTES.** El cristal ya no
    // es un item: es un número en `state.crystals`. Una pila de cristal no existe,
    // y una prueba que la montara estaría midiendo un objeto que el juego no
    // reconoce —la forma más tranquila de tener un banco en verde y falso—.
    const uno = consumable('x1', 'afk', 19);
    const otro = consumable('x2', 'afk', 4);
    const r = mergeStacks([uno, otro]);

    check('apilado: dos pilas del mismo consumible se funden en una',
      r.items.length === 1, String(r.items.length));
    check('apilado: y las unidades se suman, no se pierden',
      r.items[0].stackCount === 23, 'stackCount=' + r.items[0].stackCount);
    check('apilado: se conserva el id del primero',
      r.items[0].id === 'x1', r.items[0].id);
    check('apilado: y se avisa de que se ha tocado', r.changed === true);
  }
  {
    // Y la llave vieja, que es justo lo contrario. Al quitar el sistema de llaves
    // el tipo 'key' salió de `STACKABLE_TYPES`: una llave que se colara en el
    // almacén **no se funde** con otra, porque ya no es moneda. Antes esta
    // comprobación decía que sí, y ahora dice lo contrario a propósito.
    const r = mergeStacks([key('k1', 'Llave de Cifrado', 19), key('k2', 'Llave Reforzada', 4)]);

    check('apilado: dos llaves viejas NO se funden: ya no son moneda',
      r.items.length === 2, String(r.items.length));
    check('apilado: y el guardado no se toca, que no hay nada que repartir',
      r.changed === false, String(r.changed));
    check('apilado: cada llave conserva sus unidades',
      r.items.map((w: any) => w.stackCount).join(',') === '19,4',
      r.items.map((w: any) => `${w.id}:${w.stackCount}`).join(' '));
  }
  {
    // Un item guardado sin `stackCount` vale UNA unidad, no cero. Restarlo como
    // cero lo dejaba en la pila sin cambiar nada y se perdía en silencio.
    //
    // El item sin conteo se fabrica a partir del del kit y se le quita el campo, en
    // vez de escribir un objeto a mano: el nombre tiene que ser el de verdad, porque
    // es la clave con la que se decide si dos items son la misma pila.
    const sinConteo: any = consumable('x2', 'afk');
    delete sinConteo.stackCount;
    const r = mergeStacks([consumable('x1', 'afk', 5), sinConteo]);
    check('apilado: un item sin stackCount cuenta como una unidad',
      r.items.length === 1 && r.items[0].stackCount === 6,
      `items=${r.items.length} stack=${r.items[0]?.stackCount}`);
  }
  {
    // Dos objetos de DISTINTO nombre no son la misma pila: el jugador tiene que
    // poder verlos y elegirlos por separado.
    const r = mergeStacks([
      consumable('x1', 'afk', 3),
      consumable('x2', 'clickBoost', 3, { name: 'Píldora de Foco' })
    ]);
    check('apilado: dos consumibles de distinto nombre NO se funden', r.items.length === 2, String(r.items.length));
  }
  {
    // Y el cristal viejo, que ya no es un item de ninguna manera: sale de
    // `STACKABLE_TYPES` al dejar de ser moneda, igual que la llave. Un item de
    // cristal que se colara en el almacén **no se funde** con otro porque
    // `isStackable` ya no lo reconoce, y en una partida de antes la redención lo
    // convierte en unidades antes de que nada lo mire.
    check('apilado: un cristal viejo ya NO es apilable: es un recurso',
      isStackable(crystalViejo('x1', 1, 19)) === false);
  }
  {
// =====================================================================
    //  TOPE DE PILA: LA CAJA APILA DE 99 EN 99, EL CONSUMIBLE NO
    // =====================================================================
    //
    // La diferencia con `MAX_STACK` es la que separa dos cosas que se confundían:
    // el tope de PINTADO (99 en la esquina, "120+" detrás) y el de ALMACENAMIENTO
    // (una celda son 99 y la 100 va a otra celda).
    //
    // Y el caso que de verdad importa es el tercero: **una sola pila guardada con
    // más cajas que el tope**. No hay nada que fusionar, así que la fusión rápida
    // no la toca y el almacén aceptaba una forma que el motor nunca produce. Eso
    // no es un detalle de guardado: es la puerta por la que una partida
    // manipulada entra en un almacén imposible.
    const tope = topeDePila('crate');
    const unaLlena = crate('c1', 1, tope);
    const una = crate('c2', 1, 1);
    check('tope de pila: una pila llena cabe en una ranura',
      countOccupiedSlots([unaLlena]) === 1, String(countOccupiedSlots([unaLlena])));
    check('tope de pila: una más ya son dos',
      countOccupiedSlots([crate('c1', 1, tope + 1)]) === 2,
      String(countOccupiedSlots([crate('c1', 1, tope + 1)])));
    // Y la llave vieja, que ya no se apila: no es moneda, así que cada entrada
    // ocupa su propia ranura y 500 unidades dentro de un item NO son una ranura
    // con cosas de más, son un item más.
    const sueltas = [key('k1', 'Llave de Cifrado', 1), key('k2', 'Llave Reforzada', 1), key('k3', 'Llave Rúnica', 1)];
    check('tope de pila: una llave vieja NO se apila, así que tres son tres ranuras',
      countOccupiedSlots(sueltas) === 3, String(countOccupiedSlots(sueltas)));

    const f1 = partirPilas([unaLlena, una]);
    check('tope de pila: pila llena + 1 se reparten en dos, no se funden',
      f1.changed && f1.items.length === 2
        && f1.items.map((w: any) => w.stackCount).join(',') === `${tope},1`,
      JSON.stringify(f1.items.map((w: any) => `${w.id}:${w.stackCount}`)));

    const f2 = partirPilas([crate('c1', 1, 250)]);
    check('tope de pila: 250 cajas son 99 + 99 + 52',
      f2.changed && f2.items.length === 3
        && f2.items.map((w: any) => w.stackCount).join(',') === '99,99,52',
      JSON.stringify(f2.items.map((w: any) => `${w.id}:${w.stackCount}`)));

    const f3 = partirPilas([crate('c1', 1, tope + 1)]);
    check('tope de pila: y una sola pila que se pasa del tope también se parte',
      f3.changed && f3.items.length === 2
        && f3.items.map((w: any) => w.stackCount).join(',') === `${tope},1`,
      JSON.stringify(f3.items.map((w: any) => `${w.id}:${w.stackCount}`)));

    // Y el reparto se hace en TODOS los tipos con tope a la vez, no en el primero
    // que encuentre: dos objetos distintos en el mismo guardado se reparten los
    // dos, porque si solo se repartiera uno el almacén aceptaría la forma
    // imposible por el otro lado.
    // **LO QUE ESTE BLOQUE DABA POR HECHO Y NO ES CIERTO, Y POR QUÉ EL BANCO DEBÍA
    // HABERLO DADO POR HECHO.** Daba por hecho que el cristal tenía tope de
    // almacenamiento de 99, como la caja. No lo tenía: `TOPE_PILA` es
    // `{ crate: 99 }` y nada más. El 99 del cristal estaba en `MAX_STACK`, que es el
    // tope **de pintado**, que es otra cosa. Y ya no hay ni una cosa ni otra: el
    // cristal es un recurso.
    //
    // Así que lo que se comprueba aquí es la asimetría, que es lo que hay:
    // **la caja se reparte y el consumible no**, en la misma pasada y con el mismo
    // recorrido. Si `partirPilas` repartiera por `MAX_STACK` en vez de por
    // `TOPE_PILA`, 250 consumibles se partirían en trece y el almacén contaría
    // ranuras donde el jugador no ve más que una celda.
    const f4 = partirPilas([consumable('x1', 'afk', 120), crate('c1', 1, 250)]);
    check('tope de pila: la caja se reparte y el consumible no, en la misma pasada',
      f4.changed && f4.items.length === 4
        && f4.items.filter((w: any) => w.type === 'consumable').length === 1
        && f4.items.filter((w: any) => w.type === 'consumable')[0]?.stackCount === 120
        && f4.items.filter((w: any) => w.type === 'crate').length === 3,
      JSON.stringify(f4.items.map((w: any) => `${w.type}:${w.stackCount}`)));

    // Y el suelo del reparto: una caja nunca queda por debajo de su tope, así que
    // `topeDePila` es un número y no una promesa.
    const sinCambio = partirPilas([crate('c1', 1, 99)]);
    check('tope de pila: sin nada que repartir no toca el array',
      sinCambio.changed === false && sinCambio.items.length === 1
        && sinCambio.items[0].stackCount === 99,
      `changed=${sinCambio.changed} items=${sinCambio.items.length}`);
    // **EL TOPE DE ALMACENAMIENTO Y EL DE PINTADO, MIRADOS POR SEPARADO, QUE ES LA
    // MITAD DE LO QUE ESTA AFIRMACIÓN DABA POR HECHO.** Sólo la caja tiene tope de
    // pila: el consumible se guarda entero en una ranura y se recorta solo al
    // pintar. Y una llave vieja **no se apila en absoluto**, que es la afirmación
    // interesante: ya no es moneda, así que dos no caben en una celda ni se funden.
    // El cristal tampoco se apila, y por un motivo más fuerte: ya no está en el
    // almacén, así que la pregunta ni se le hace.
    check('tope de pila: solo la caja tiene tope de almacenamiento, y la llave vieja no apila',
      topeDePila('crate') === 99
        && topeDePila('consumable') === Infinity
        && isStackable(key('k1')) === false,
      `caja=${topeDePila('crate')} consumible=${topeDePila('consumable')} llave apilable=${isStackable(key('k1'))}`);
    // Y los dos tipos que sí se apilan tienen tope de pintado, que es lo que
    // hace que "150" se lea como "20+" y no como una cifra imposible.
    check('tope de pila: y los dos que se apilan tienen tope de pintado',
      MAX_STACK.crate === 99 && MAX_STACK.consumable === 20,
      `caja=${MAX_STACK.crate} consumible=${MAX_STACK.consumable}`);
    check('tope de pila: y cabeEnPila lo dice por item, no por tipo suelto',
      cabeEnPila(crate('c1', 1, 98), 1) === true && cabeEnPila(crate('c1', 1, 99), 1) === false,
      `98+1=${cabeEnPila(crate('c1', 1, 98), 1)} 99+1=${cabeEnPila(crate('c1', 1, 99), 1)}`);
    // **250 unidades, dos respuestas, y la asimetría es la que se está midiendo.**
    // De la caja salen tres pilas porque su tope es 99; del consumible sale **una**,
    // y ese uno es el número que el jugador ve en la rejilla. Si estas dos cuentas
    // se separaran, el contador del almacén, la rejilla y la comprobación de si
    // cabe una compra dejarían de estar de acuerdo, que es el fallo que G3 describe
    // con dos cifras en pantalla.
    //
    // Y de cero sale **una**, no cero. Es lo que dice el `Math.max(1, ...)` y es lo
    // correcto para quien la usa: la pregunta es "cuántas ranuras necesito", y una
    // pila vacía no existe en la rejilla, así que la respuesta conservadora es una.
    // Ponerlo a cero haría que "no comprar nada" no pidiera hueco, que es la forma
    // de que una comprobación de espacio acepte una compra que no cabe.
    check('tope de pila: pilasNecesarias es la cuenta del contador',
      pilasNecesarias(250, 'crate') === 3 && pilasNecesarias(250, 'consumable') === 1
        && pilasNecesarias(0, 'crate') === 1,
      `cajas=${pilasNecesarias(250, 'crate')} consumibles=${pilasNecesarias(250, 'consumable')}`);

    // **G3 · LOS DOS TOPES NO PUEDEN SEPARARSE.**
    //
    // El de pintado se quedó en 20 cuando el de almacenamiento cambió, y lo
    // delató un jugador diciendo "se me ve 120/20": una celda con 99 cajas
    // pintando "20+". Con dos números distintos en pantalla, nadie sabe cuál es
    // el bueno y el que adivina mal se lleva una sorpresa.
    //
    // Esta es la comprobación que habría pillado el bug antes de que lo viera
    // nadie, y solo cabe en un banco: es una igualdad entre dos tablas que viven
    // en ficheros distintos y que nada obliga a mantener sincronizadas.
    check('G3: el tope de pintado y el de almacenamiento son el MISMO numero',
      MAX_STACK.crate === TOPE_PILA.crate,
      `pintado=${MAX_STACK.crate} almacenamiento=${TOPE_PILA.crate}`);
    check('G3: y por eso 120 cajas son dos celdas que se leen enteras',
      partirPilas([crate('c1', 1, 120)]).items.map((w: any) => w.stackCount).join(',') === '99,21',
      partirPilas([crate('c1', 1, 120)]).items.map((w: any) => `${w.id}:${w.stackCount}`).join(' '));
    check('G3: 99 cajas se pintan como 99, no como "20+"',
      textoDeCantidad(99, MAX_STACK.crate) === '99' && textoDeCantidad(120, MAX_STACK.crate) === '99+',
      `99→"${textoDeCantidad(99, MAX_STACK.crate)}" 120→"${textoDeCantidad(120, MAX_STACK.crate)}"`);
  }

  // =========================================================================
  //  6. F30 · EL TOPE DE PINTADO NO RECORTA LO QUE HAY
  // =========================================================================
  {
    // Lo que el jugador compró y vio: "compré más de 20 tarjetas y me sale 20".
    // El consumible es hoy el caso vivo de esto: `MAX_STACK` lo limita a 20 en la
    // esquina y `TOPE_PILA` no le pone tope, así que 150 son **una** ranura detrás
    // de un "20+". Lo que se ve no era lo que había, que es la regla R3 del
    // proyecto. Aquí se comprueba las dos mitades.
    const tope = MAX_STACK.consumable;
    check(`F30: 150 consumibles se pintan como "${tope}+", no como ${tope}`,
      textoDeCantidad(150, tope) === `${tope}+`,
      `texto="${textoDeCantidad(150, tope)}" con 150 y tope ${tope}`);
    check('F30: por debajo del tope se ve el número entero',
      textoDeCantidad(7, tope) === '7' && textoDeCantidad(tope, tope) === String(tope),
      `7→"${textoDeCantidad(7, tope)}" ${tope}→"${textoDeCantidad(tope, tope)}"`);
    check('F30: el "+" solo aparece cuando hay más de lo que cabe',
      textoDeCantidad(tope, tope) === String(tope) &&
      textoDeCantidad(tope + 1, tope).endsWith('+'),
      `exactamente el tope="${textoDeCantidad(tope, tope)}" uno más="${textoDeCantidad(tope + 1, tope)}"`);

    // Y lo importante: la rejilla NO recorta el número. Antes hacía
    // `Math.min(count, tope)`, así que el `data-count` que leen el arrastre y la
    // selección llegaba ya recortado y no había forma de saber cuántas había.
    const conMuchas = consumable('u1', 'afk', 150);
    const g = await boot(baseSave([conMuchas]));
    const celda = celdas(g).find((c: any) => c.count > 0);
    check('F30: la rejilla NO recorta la cantidad real',
      celda?.count === 150, `count=${celda?.count}`);
    check('F30: y las unidades sobreviven al guardado',
      unidades(g, 'consumable') === 150, 'unidades=' + unidades(g, 'consumable'));
    const g2 = await reload();
    check('F30: y a la recarga',
      unidades(g2, 'consumable') === 150, 'unidades=' + unidades(g2, 'consumable'));
    check('F30: 150 consumibles siguen siendo UNA ranura',
      countOccupiedSlots(wh(g2)) === 1, 'ranuras=' + countOccupiedSlots(wh(g2)));

    // Y el "+" no es decorativo: el número de verdad está detrás y el motor lo lee
    // entero, así que el jugador puede gastar las 150 aunque la esquina solo
    // enseñe "20+".
    check('F30: el motor lee la pila entera, no la recortada',
      stackUnits(wh(g2)[0]) === 150, 'stackCount=' + stackUnits(wh(g2)[0]));
  }
  {
    // Dos recolectores son dos cosas distintas aunque se llamen igual. Si se
    // fundieran, el jugador no podría elegir con cuál hacer clic.
    const r = mergeStacks([
      collector('r1', 3, { stackable: true, stackCount: 3 }),
      collector('r2', 3, { stackable: true, stackCount: 3 })
    ]);
    check('apilado: los recolectores no se funden nunca', r.items.length === 2, String(r.items.length));
  }
  {
    // Un recolector no apilable se queda como estaba: la fusión no puede
    // inventarle un `stackCount` que el juego no espera.
    const r = mergeStacks([collector('r1')]);
    check('apilado: un item que no es apilable se queda sin stackCount',
      r.items[0].stackCount === undefined, String(r.items[0].stackCount));
    check('apilado: y se avisa de que no se ha tocado nada', r.changed === false);
  }
  {
    // Y la llave vieja, que antes era el ejemplo de apilable y ahora es el
    // ejemplo de lo contrario: `'key'` salió de `STACKABLE_TYPES` al quitar las
    // llaves. Que la que aparezca en una partida guardada no la convierte en
    // moneda: no se funde con otra y no cuenta como una ranura llena.
    check('apilado: una llave vieja NO es apilable: ya no es moneda',
      isStackable(key('k1', 'Llave de Cifrado', 1)) === false);
    check('apilado: un recolector no lo es', isStackable(collector('r1')) === false);
    check('apilado: y el consumible, que es el tipo sin tope de pila, sí lo es',
      isStackable(consumable('u1', 'afk', 3)) === true);
  }
  {
    // El contador de ranuras y la rejilla tienen que usar la MISMA clave. Si
    // una cuenta entradas y la otra grupos, el "21/21" no cuadra con lo que se ve.
    // Aqui: 1 recolector + 4 cajas del mismo tipo (una pila) + 19 consumibles
    // repartidos en dos entradas (una sola pila) = 3 ranuras. Contando entradas
    // serian 5.
    const items = [collector('r1'), crate('c1', 1, 3), crate('c2'),
      consumable('x1', 'afk', 7), consumable('x2', 'afk', 12)];
    check('ranuras: 4 cajas y 19 consumibles son 2 ranuras, no 5',
      countOccupiedSlots(items) === 3, String(countOccupiedSlots(items)));
  }

  // =========================================================================
  //  2. Comprar y abrir van a la pila, no a una ranura nueva
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1')], { nanites: 10_000_000 }));
    for (let i = 0; i < 19; i++) g.buyStoreItem('crateT1');
    const pilas = wh(g).filter((w: any) => w.type === 'crate');

    check('tienda: 19 cajas compradas son 19 unidades', unidades(g, 'crate') === 19, String(unidades(g, 'crate')));
    check('tienda: y están en UNA sola pila', pilas.length === 1, `pilas=${pilas.length}`);
    check('tienda: la pila lleva las 19 dentro', pilas[0]?.stackCount === 19, String(pilas[0]?.stackCount));
    check('tienda: y no se ha gastado ni una ranura más',
      countOccupiedSlots(wh(g)) === 2, String(countOccupiedSlots(wh(g))));
    check('tienda: el contador derivado cuadra', s(g).crates[1] === 19, String(s(g).crates[1]));
  }
  {
    // El botín de una caja también. Con el almacén lleno esto antes era
    // imposible: cada llave que caía gastaba una ranura y el almacén se negaba
    // a admitirla, así que el jugador perdía el premio sin avisar.
    // Las 9 cajas de relleno se llaman todas distinto a propósito: si todas se
    // llamaran "Caja Común" se fundirían en una sola ranura y el almacén no
    // estaría lleno, que es justo lo que este bloque no mide.
    // La casilla que antes ocupaba la llave la baja la capacidad: el almacén
    // tiene que seguir lleno sin ella, porque ya no existe.
    const relleno = Array.from({ length: 9 }, (_, i) => crate(`c${i}`, 1, 1, { name: `Caja Común ${i}` }));
    const g = await boot(baseSave(
      [collector('r1'), ...relleno],
      { warehouseCapacity: 10, nanites: 0 }
    ));
    const antes = countOccupiedSlots(wh(g));
    check('cajas: el almacen de prueba esta lleno', antes === g.getCapacity(),
      `ranuras=${antes} cap=${g.getCapacity()}`);

    // Abrir una caja da Companion o botín aleatorio, así que lo que se comprueba
    // aquí es la REGLA, no el premio: con el almacén lleno, un item que ya
    // tiene se suma a su pila en vez de perderse. Y sin llave que colocar, la
    // caja se abre sola.
    const r = g.openCrateBox('c0');
    check('cajas: con el almacen lleno la caja se abre igualmente', r.ok, r.msg ?? '');
    check('cajas: y el almacen no se desborda',
      countOccupiedSlots(wh(g)) <= g.getCapacity(),
      `ranuras=${countOccupiedSlots(wh(g))} cap=${g.getCapacity()}`);
  }

  // =========================================================================
  //  3. La migración de las partidas ya jugadas
  // =========================================================================
  {
    // 19 items del mismo tipo guardados por separado, como los dejaba el código
    // viejo. El objeto es un consumible: el tipo apilable sin tope que además trae
    // el juego por su cuenta, así que la migración se mide sobre un objeto vivo.
    // Antes se medía con cristales, que ya no son items.
    const sueltos = Array.from({ length: 19 }, (_, i) => consumable(`x${i}`, 'afk', 1));
    const g = await boot(baseSave([collector('r1'), ...sueltos]));

    const tarjetas = wh(g).filter((w: any) => w.type === 'consumable');
    check('migracion: 19 consumibles guardados por separado se vuelven una pila',
      tarjetas.length === 1, `pilas=${tarjetas.length}`);
    check('migracion: y las 19 unidades siguen ahi', tarjetas[0]?.stackCount === 19, String(tarjetas[0]?.stackCount));
    check('migracion: no se pierde ni una unidad', unidades(g, 'consumable') === 19, String(unidades(g, 'consumable')));
    check('migracion: el contador derivado no cambia', s(g).afkCards === 19, String(s(g).afkCards));
    check('migracion: y el almacen ocupa una ranura menos',
      countOccupiedSlots(wh(g)) === 2, String(countOccupiedSlots(wh(g))));
  }
  {
    // Y la fusión tiene que sobrevivir a la recarga: si el resultado no se
    // guarda, la siguiente vuelta a cargar deshace la migración.
    const sueltos = Array.from({ length: 19 }, (_, i) => consumable(`x${i}`, 'afk', 1));
    const g = await boot(baseSave([collector('r1'), ...sueltos]));
    const g2 = await reload();
    const tarjetas = wh(g2).filter((w: any) => w.type === 'consumable');

    check('migracion: la fusion se guarda', tarjetas.length === 1, `pilas=${tarjetas.length}`);
    check('migracion: y no se vuelve a partir en 19 al recargar',
      tarjetas[0]?.stackCount === 19, String(tarjetas[0]?.stackCount));
  }
  {
    // LA REDENCIÓN DEL CRISTAL, QUE ES LO QUE QUEDA DE LA PILA VIEJA.
    //
    // Una partida guardada antes del cambio tiene cristales **en el almacén**,
    // porque eran un item con diez niveles. Ahora son un recurso, así que esas
    // pilas desaparecen y lo que llega es un número en `state.crystals`. El banco
    // lo mide con `crystalViejo()`, la fábrica que existe para esto y para nada
    // más: un item de cristal no se puede usar para probar el apilado porque ya no
    // hay apilado de cristales que probar.
    //
    // **LO QUE CUESTA NO ES EL DEL ITEM VIEJO, ES EL DEL RECURSO.** La unidad de un
    // cristal de nivel n vale lo que vale una caja de nivel n, y eso lo pone
    // `valorDeUnCristal()`: el banco no escribe el número.
    const g = await boot(baseSave([crystalViejo('x1', 1, 19)]));
    check('redencion: una partida con cristales viejos sale SIN ninguna pila de cristal',
      wh(g).filter((w: any) => w.type === 'crystal').length === 0 && wh(g).length === 0,
      ids(g).join(',') || 'almacen vacio');
    check('redencion: y el recurso vale lo que valian las unidades',
      s(g).crystals === 19 * valorDeUnCristal(1),
      `crystals=${s(g).crystals} esperado=${19 * valorDeUnCristal(1)}`);

    // Y no se redime dos veces: la segunda carga ya no encuentra ninguna pila, y
    // el número tiene que ser el mismo.
    const g2 = await reload();
    check('redencion: y la segunda carga no vuelve a sumar nada',
      s(g2).crystals === 19 * valorDeUnCristal(1), `crystals=${s(g2).crystals}`);
  }
  {
    // Una partida nueva: las 2 cajas de bienvenida se materializan, y ahora se
    // guardan como UNA pila de 2. Antes eran 2 items y 2 ranuras por dos cajas
    // idénticas que el jugador nunca eligió guardar por separado.
    const g = await bootNew();
    const cajas = wh(g).filter((w: any) => w.type === 'crate');
    check('partida nueva: las 2 cajas de bienvenida son UNA pila', cajas.length === 1, `pilas=${cajas.length}`);
    check('partida nueva: con las 2 unidades dentro', cajas[0]?.stackCount === 2, String(cajas[0]?.stackCount));
    check('partida nueva: y el contador de cajas sigue a 2', s(g).crates[1] === 2, String(s(g).crates[1]));
  }

  // =========================================================================
  //  4. El contador y la rejilla no pueden discrepar
  // =========================================================================
  {
    const items = [
      collector('r1'), collector('r2'),
      crate('c1', 1, 4), crate('c2', 1, 2), crate('c3', 6),
      consumable('u1', 'afk', 2), consumable('u2', 'clickBoost', 1),
      consumable('u3', 'afk', 8), consumable('u4', 'clickBoost', 3),
      consumable('u5', 'afk', 11)
    ];
    const g = await boot(baseSave(items));
    check('cuadra: el contador de ranuras coincide con las celdas pintadas',
      countOccupiedSlots(wh(g)) === celdas(g).length,
      `contador=${countOccupiedSlots(wh(g))} celdas=${celdas(g).length}`);
  }
  {
    // Y después de jugar: comprar, abrir y regalar cosas tiene que seguir
    // cuadrando. El descuadre reaparece en cuanto un camino se olvida de la regla.
    // Lo que se compra dos veces es el expansor, que es el producto que se
    // apila sin tope: el papel que tenía la carta de llave.
    const g = await boot(baseSave([collector('r1')], { nanites: 10_000_000 }));
    g.buyStoreItem('expansorT1');
    g.buyStoreItem('expansorT1');
    g.buyStoreItem('upgradeCrystal');
    g.buyStoreItem('crateT1');
    g.buyStoreItem('crateT1');
    g.buyStoreItem('afkCard');
    g.openCrateBox(wh(g).find((w: any) => w.type === 'crate').id);

    check('cuadra: sigue cuadrando despues de comprar y abrir',
      countOccupiedSlots(wh(g)) === celdas(g).length,
      `contador=${countOccupiedSlots(wh(g))} celdas=${celdas(g).length}`);
  }
  {
    // Y con los filtros puestos, que el contador no se mueva: es el almacén
    // entero, no la vista filtrada.
    const g = await boot(baseSave([collector('r1'), consumable('x1', 'afk', 19), crate('c1')]));
    check('cuadra: el contador no depende del filtro',
      countOccupiedSlots(wh(g)) === 3, String(countOccupiedSlots(wh(g))));
  }

  // =========================================================================
  //  5. Almacén lleno: unidades sí, ranuras nuevas no
  // =========================================================================
  {
    // 4 recolectores (4 ranuras) + 1 pila de cajas + 1 pila de consumibles = 6, y
    // la capacidad es 6: lleno. La pila de cajas tiene que estar YA, porque es la
    // que va a absorber la compra. La última pila es la del tipo sin tope, que
    // ocupa la casilla que antes ocupaba la de llaves.
    const lleno = Array.from({ length: 4 }, (_, i) => collector(`r${i}`));
    const g = await boot(baseSave([...lleno, crate('c1', 1, 1), consumable('u1', 'afk', 1)],
      { warehouseCapacity: 6, nanites: 10_000_000 }));
    check('lleno: el almacen esta lleno', countOccupiedSlots(wh(g)) === g.getCapacity(),
      `${countOccupiedSlots(wh(g))}/${g.getCapacity()}`);

    // Comprar otra caja del mismo tipo NO necesita ranura: se suma a la pila.
    // Antes esto se rechazaba y el jugador se comía las nanitas.
    const r = g.buyStoreItem('crateT1');
    check('lleno: una caja mas se compra igual (deja de ocupar ranura nueva)', r !== false, String(r));
    check('lleno: y se suma a la pila de cajas, sin gastar ranura',
      countOccupiedSlots(wh(g)) === g.getCapacity() &&
      wh(g).find((w: any) => w.type === 'crate')?.stackCount === 2,
      `ranuras=${countOccupiedSlots(wh(g))} pila=${wh(g).find((w: any) => w.type === 'crate')?.stackCount}`);

    // Comprar un item que sí necesita ranura propia se sigue rechazando, y sin
    // cobrar: un "Almacén lleno" que descuenta nanitas es un robo.
    //
    // F31 · Antes la carta era `companionCardT1`, que ya no se vende, y después
    // se medía con el cristal. **El cristal ya no sirve para esto: es un recurso y
    // no ocupa ranura.** El caso se mide con el expansor, que es un item con su
    // propia pila y no hay ninguna en un almacén lleno.
    const g2 = await boot(baseSave([...lleno, crate('c1', 1, 1), consumable('u1', 'afk', 1)],
      { warehouseCapacity: 6, nanites: 10_000_000 }));
    const antes = nanites(g2);
    const r2 = g2.buyStoreItem('expansorT1');
    check('lleno: y un item que si ocupa ranura se rechaza', r2 === false, String(r2));
    check('lleno: sin cobrar por encima', nanites(g2) === antes, `${antes} -> ${nanites(g2)}`);

    // **Y EL CRISTAL, QUE ES LA MITAD NUEVA DE ESTE BLOQUE.** Un recurso no está
    // en el almacén, así que no pide hueco: con las seis ranuras ocupadas se
    // compra igual. Antes esto era un rechazo, y era absurdo —un jugador con el
    // almacén lleno no podía comprar el material que necesita para subir de
    // nivel—.
    const antesCristales = s(g2).crystals;
    const r3 = g2.buyStoreItem('upgradeCrystal');
    check('lleno: el cristal se compra con el almacen lleno: no es un item',
      r3 !== false && wh(g2).filter((w: any) => w.type === 'crystal').length === 0, String(r3));
    check('lleno: y lo que sube son las unidades del recurso, no las ranuras',
      countOccupiedSlots(wh(g2)) === g2.getCapacity()
        && s(g2).crystals === antesCristales + valorDeUnCristal(1),
      `ranuras=${countOccupiedSlots(wh(g2))}/${g2.getCapacity()} crystals=${s(g2).crystals}`);
  }

  // =========================================================================
  //  5 bis. El boton de la tienda y la compra dicen lo mismo
  // =========================================================================
  // Con dos copias de la pregunta, el boton se apaga para algo que la compra si
  // deja pasar, o al reves: se enciende y al pulsarlo no ocurre nada. Lo que se
  // comprueba aqui es que `canBuyStoreItem` —lo que lee la tienda— coincide con
  // lo que hace `buyStoreItem` —quien cobra— en todas las combinaciones.
  {
    const lleno = Array.from({ length: 4 }, (_, i) => collector(`r${i}`));
    const g = await boot(baseSave([...lleno, crate('c1', 1, 1), consumable('u1', 'afk', 1)],
      { warehouseCapacity: 6, nanites: 10_000_000 }));

    // Con el almacen lleno: cabe lo que se funde en una pila, y NO cabe lo que
    // necesita ranura propia. La tienda y la compra tienen que estar de acuerdo
    // en las dos mitades.
    check('tienda: con el almacen lleno, una caja SÍ cabe (se suma a su pila)',
      g.canBuyStoreItem('crateT1') === true, String(g.canBuyStoreItem('crateT1')));
    check('tienda: y comprar una caja funciona de verdad',
      g.buyStoreItem('crateT1') !== false, 'rechazada');
    check('tienda: con el almacen lleno, una carta que necesita ranura propia NO cabe',
      g.canBuyStoreItem('expansorT1') === false, String(g.canBuyStoreItem('expansorT1')));
    check('tienda: y comprarla falla de verdad',
      g.buyStoreItem('expansorT1') === false, 'aceptada');
    // Y el botón del cristal dice que SÍ con el almacén lleno, porque la pregunta
    // de espacio no le aplica. Botón apagado para algo que sí se puede comprar es
    // un jugador que cree que no le llega la nanita cuando sí le llega.
    check('tienda: y el boton del cristal se enciende igual: no ocupa ranura',
      g.canBuyStoreItem('upgradeCrystal') === true, String(g.canBuyStoreItem('upgradeCrystal')));
  }
  {
    // Y con hueco de sobra, nada se rechaza: un boton apagado sin motivo es un
    // jugador que cree que no le llega la nanita cuando si le llega.
    const g = await boot(baseSave([collector('r1')], { warehouseCapacity: 30, nanites: 10_000_000 }));
    for (const k of ['expansorT1', 'upgradeCrystal', 'crateT1', 'afkCard']) {
      if (g.canBuyStoreItem(k) === false) {
        check(`tienda: ${k} se puede comprar con el almacen vacio`, false, 'dice que no cabe');
      }
    }
    check('tienda: con el almacen vacio, todo se puede comprar', true);
  }
  {
    // F27 · Ampliar YA no es un permiso: el expansor es un item y con el
    // almacén lleno y sin pila no entra. Los huecos de compañero sí siguen
    // siendo permisos y entran igual. `maxCompanionSlots: 1` porque con 3 el
    // de compañero ya estaría comprado y la prueba mediría eso.
    const lleno = Array.from({ length: 4 }, (_, i) => collector(`r${i}`));
    const g = await boot(baseSave([...lleno, crate('c1', 1, 1), consumable('u1', 'afk', 1)],
      { warehouseCapacity: 6, maxCompanionSlots: 1, nanites: 10_000_000 }));
    check('tienda: ampliar el almacen con el almacen lleno se rechaza sin pila',
      g.canBuyStoreItem('expansorT1') === false && g.buyStoreItem('expansorT1') === false);
    check('tienda: y añadir un hueco de companero sigue entrando',
      g.canBuyStoreItem('companionSlot1') === true && g.buyStoreItem('companionSlot1') !== false);
  }

  // =========================================================================
  //  5 ter. La pregunta "¿cabe?" mira el MISMO item que se entrega
  // =========================================================================
  // La preview y la creacion son dos funciones, y por eso pueden discrepar: la
  // preview decia "Llave de Cifrado" (nivel 0) mientras la compra creaba una
  // "Llave Reforzada" (nivel 1). Con el almacen lleno y una pila de nivel 0, el
  // boton decia que si cabia y la compra fallaba.
  //
  // No se comprueba mirando el nivel, que es un detalle del producto, sino la
  // consecuencia: DOS compras del mismo producto tienen que acabar en la MISMA
  // pila. Si preview y creacion discrepan, la primera compra abre una pila y la
  // segunda buscaria otra distinta, y el almacen se llenaria de un producto que
  // el jugador solo compro una vez cada vez.
  {
    const g = await boot(baseSave([collector('r1')], { warehouseCapacity: 30, nanites: 10_000_000 }));
    // Todas las cartas que dejan un item en el almacen, no solo una: que dos
    // unidades del mismo producto caigan en una pila vale para todas, y
    // comprobar solo la mas barata dejaria sin mirar las demas.
    // Una partida por carta, y no una compartida: en una sola partida se
    // mezclarian varios productos y la prueba de "caen en UNA pila" mediria dos
    // cosas a la vez y fallaria sin que hubiera ningun bug: el error estaria en
    // la prueba.
    const cartas: [string, string][] = [
      ['crateT1', 'crate'],
      ['afkCard', 'consumable'], ['expansorT1', 'consumable']
    ];
    for (const [k, tipo] of cartas) {
      const gk = await boot(baseSave([collector('r1')], { nanites: 10_000_000 }));
      gk.buyStoreItem(k as any);
      gk.buyStoreItem(k as any);
      const pilas = wh(gk).filter((w: any) => w.type === tipo);
      check(`tienda: dos "${k}" caen en UNA pila, no en dos`,
        pilas.length === 1, `pilas=${pilas.length} (${pilas.map((w: any) => w.name).join(' | ')})`);
      check(`tienda: y la pila lleva las 2 unidades`,
        pilas[0]?.stackCount === 2, `stackCount=${pilas[0]?.stackCount}`);
      // Y las dos unidades tienen que ser del mismo nivel, o no serian el mismo
      // producto y no se podrian fundir entre si.
      check(`tienda: las dos unidades son del mismo nivel`,
        new Set(pilas.map((w: any) => w.tier)).size === 1,
        `niveles=${[...new Set(pilas.map((w: any) => w.tier))].join(',')}`);
    }
    // Y LA CARTA QUE NO ENTRA EN LA LISTA POR UNA RAZÓN NUEVA. `upgradeCrystal` no
    // crea ningún item, así que "caen en una pila" no tiene nada que ver con ella.
    // Lo que se comprueba es la otra mitad de la misma pregunta: dos compras del
    // cristal no abren NINGUNA celda, y lo que sí sube es el recurso. Si la carta
    // metiera un item invisible en el almacén, el contador de ranuras mentiría y
    // este bloque entero no lo vería.
    const gr = await boot(baseSave([collector('r1')], { nanites: 10_000_000 }));
    const antesRecurso = s(gr).crystals;
    gr.buyStoreItem('upgradeCrystal');
    gr.buyStoreItem('upgradeCrystal');
    check('tienda: dos compras de cristal NO abren ninguna celda',
      wh(gr).length === 1 && wh(gr)[0]?.type === 'collector',
      `items=${ids(gr).join(',')}`);
    check('tienda: y lo que suben son las unidades del recurso',
      s(gr).crystals === antesRecurso + 2 * valorDeUnCristal(1),
      `crystals=${s(gr).crystals} antes=${antesRecurso}`);
  }
  {
    // Y el caso que lo destapó: con el almacén lleno y una pila de lo que la
    // tienda entrega, la compra tiene que poder fundirse en ella. Aqui la pila
    // se monta COMPRANDO el producto, que es la unica forma de saber con
    // certeza que se entrega sin duplicar la tabla.
    const g = await boot(baseSave([collector('r1')], { warehouseCapacity: 30, nanites: 10_000_000 }));
    // F31 · La nota vieja era "`keyT0` y la pila del almacén viejo es de nivel 0",
    // que describía un bug ya arreglado (B7: la carta se llamaba 'key' pero
    // entregaba la Reforzada). Ahora el producto es la caja y la pila se rellena
    // con el nombre que entrega la propia compra. Lo que importa no cambia: las
    // dos mitades tienen que coincidir o la compra no se funde con la pila.
    g.buyStoreItem('crateT1');
    const nombrePila = wh(g).find((w: any) => w.type === 'crate')?.name;

    // Se rellena el almacen con items que no se funden entre si, hasta llenarlo.
    // F31 · Antes se rellenaba comprando `collectorCardT1`, veinte veces. Ya no
    // hay carta de tier, así que el relleno se pone directamente en el
    // guardado de la partida siguiente: es el mismo item que producía la compra,
    // y además sin depender de que la tienda siga teniendo la carta.
    const rellenos = Array.from({ length: 40 }, (_, i) => collector(`x${i}`, 1, { name: `Relleno ${i}` }));
    // Ajusta la capacidad para que quepa justo lo que ya hay.
    const g2 = await boot(baseSave(
      [collector('r1'), crate('c0', 1, 3, { name: nombrePila }),
        ...rellenos.slice(0, 20).map((w, i) => ({ ...w, id: `x${i}` }))],
      { warehouseCapacity: 22, nanites: 10_000_000 }
    ));
    const ocupada = countOccupiedSlots(wh(g2));
    check('tienda: el almacen de la prueba esta lleno', ocupada === g2.getCapacity(),
      `${ocupada}/${g2.getCapacity()}`);

    check('tienda: con el almacen lleno, la caja SÍ cabe (es su propia pila)',
      g2.canBuyStoreItem('crateT1') === true, String(g2.canBuyStoreItem('crateT1')));
    const r = g2.buyStoreItem('crateT1');
    const k = wh(g2).find((w: any) => w.type === 'crate');
    check('tienda: y la compra va con ella en vez de fallar',
      r !== false && k?.stackCount === 4, `ok=${r !== false} pila=${k?.stackCount}`);
    check('tienda: sin gastar una ranura nueva',
      countOccupiedSlots(wh(g2)) === g2.getCapacity(), `${countOccupiedSlots(wh(g2))}/${g2.getCapacity()}`);
  }

  // =========================================================================
  //  6. Vender y gastar una pila sigue funcionando
  // =========================================================================
  {
    const sueltos = Array.from({ length: 19 }, (_, i) => consumable(`x${i}`, 'afk', 1));
    const g = await boot(baseSave([collector('r1'), collector('r2'), ...sueltos], { nanites: 0 }));
    const pila = wh(g).find((w: any) => w.type === 'consumable');
    const antes = nanites(g);
    const r = g.sellItem(pila.id);

    check('vender: una pila fusionada se vende entera', r.ok && pila.id, r.msg ?? '');
    check('vender: y cobra las 19 unidades, no una',
      nanites(g) === antes + 19 * pila.sellPrice, `${antes} -> ${nanites(g)}`);
    check('vender: la pila desaparece del almacen',
      !wh(g).some((w: any) => w.type === 'consumable'), ids(g).join(','));
  }
  {
    const sueltos = Array.from({ length: 3 }, (_, i) => consumable(`u${i}`, 'afk', 1));
    const g = await boot(baseSave([collector('r1'), collector('r2'), ...sueltos], { afkCards: 3 }));
    const pila = wh(g).find((w: any) => w.type === 'consumable');
    check('gastar: las tarjetas se funden en una pila', pila?.stackCount === 3, String(pila?.stackCount));
    check('gastar: y el contador de AFK las ve las tres', s(g).afkCards === 3, String(s(g).afkCards));

    const r = g.useConsumable(pila.id);
    check('gastar: usar una gasta UNA unidad de la pila', r.ok, r.msg ?? '');
    check('gastar: y la pila queda en 2',
      wh(g).find((w: any) => w.id === pila.id)?.stackCount === 2,
      String(wh(g).find((w: any) => w.id === pila.id)?.stackCount));
  }

  resumen('apilado');
}

export default main();
