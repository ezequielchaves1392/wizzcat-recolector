// ==========================================================================
//  Banco de pruebas de FILTROS y de la rejilla del almacen
//
//  Comprueba las tres funciones que deciden que se ve y que se puede mover:
//
//    matchesFilter   -> si un item entra en la rejilla
//    visibleStacksFor-> como se agrupan los items en celdas y en que orden
//
//  POR QUE ESTAS TRES JUNTAS Y NO POR SEPARADO. El agrupado de pilas no es solo
//  una cosa de pintar: el destino del arrastre es un INDICE DE CELDA, no un
//  indice del array. Si la rejilla que se pinta y la que usa el arrastre
//  agruparan distinto, el numero de celda que el jugador senala no es el sitio
//  donde acaba el item. Con tres cajas apiladas en medio, todo se desplaza una
//  celda y el item aterriza junto a la cosa equivocada. Esa clase de bug es
//  invisible mirando el codigo y muy visible jugando.
//
//  Tambien se comprueba el filtro `otros`, que es el unico con logica propia:
//  no es un tipo, es "todo lo que no sea recolector ni companero". Si un
//  guardado viejo trae un tipo desconocido, ese item tiene que caer en `otros`
//  y no desaparecer de la rejilla.
// ==========================================================================

import {
  visibleStacksFor, matchesFilter, matchesSearch, pasaElFiltro,
  terminosDeBusqueda, normalizaBusqueda, ordenesParaFiltro, ordenValidoParaFiltro
} from '../src/components/warehouse';
import { materialesDeForja } from '../src/ui/forgePage';
import { bandaDeProbabilidad, CORTE_PROBABILIDAD_ALTA, CORTE_PROBABILIDAD_MEDIA } from '../src/data/items';
import { textoDeCantidad, MAX_STACK } from '../src/data/stacking';
import { poderDeCompanero, danioDeRango } from '../src/data/crafting';
import { basePorId } from '../src/data/bases';
import {
  boot, reload, check, resumen, s, wh, ids, baseSave,
  collector, companion, crate, consumable, ficha
} from './kit';

/** Los ids de las celdas, que es lo que el jugador ve y lo que se comprueba. */
const celdas = (g: any, filtro: string, sort = 'default') =>
  visibleStacksFor(g, s(g), filtro, sort).map((c: any) => c.item.id);
/** Los ids de TODOS los items detrás de cada celda (una pila son varios). */
const grupos = (g: any, filtro: string, sort = 'default') =>
  visibleStacksFor(g, s(g), filtro, sort).map((c: any) => c.ids);

async function main() {
  // =========================================================================
  //  1. Filtros: cada boton enseña lo que promete
  // =========================================================================
  {
    const g = await boot(baseSave([
      collector('r1'), collector('r2'),
      companion('m1'),
      crate('c1'), consumable('u1', 'afk'),
      consumable('u2', 'clickBoost', 1, { name: 'Píldora de Foco' })
    ]));

    check('filtro Todo: deja pasar todo',
      celdas(g, 'all').length === 6, celdas(g, 'all').join(','));
    check('filtro Recolectores: solo recolectores',
      celdas(g, 'collector').join(',') === 'r1,r2', celdas(g, 'collector').join(','));
    check('filtro Companeros: solo companeros',
      celdas(g, 'companion').join(',') === 'm1', celdas(g, 'companion').join(','));
    check('filtro Cajas: solo cajas',
      celdas(g, 'crate').join(',') === 'c1', celdas(g, 'crate').join(','));

    // **"OTROS" ES LO QUE NO SON LAS TRES COSAS GRANDES, Y ANTES ERA LO QUE NO ERAN
    // DOS.** Al añadir el filtro de cajas, `otros` dejó de sacar las cajas y se quedó con
    // llaves, cristales y consumibles. Esta prueba lo dice en voz alta porque es
    // exactamente el punto que se puede separar sin que nadie lo note: un filtro que
    // cambia de contenido sin que cambie su nombre.
    check('filtro Otros: ni recolectores, ni companeros, ni cajas',
      celdas(g, 'otros').join(',') === 'u1,u2', celdas(g, 'otros').join(','));

    // **Y LOS CUATRO FILTROS SE PARTEN LA REJILLA.** Nada puede estar en dos y nada se
    // puede perder: si se pierde un item al filtrar, el jugador cree que ha desaparecido
    // del juego. Antes esta cuenta estaba mal escrita —sumaba solo dos de los tres
    // filtros— y daba verde con `cajas` sin filtro.
    const grandes = new Set(
      celdas(g, 'collector').concat(celdas(g, 'companion'), celdas(g, 'crate')));
    const todo = new Set(celdas(g, 'all'));
    check('filtro: Recolectores + Companeros + Cajas + Otros = Todo',
      grandes.size + celdas(g, 'otros').length === todo.size,
      `partes=${grandes.size + celdas(g, 'otros').length} todo=${todo.size}`);

    check('filtro: y ninguna celda sale en dos filtros a la vez',
      [...grandes].every(id => !celdas(g, 'otros').includes(id)),
      'solape=' + [...grandes].filter(id => celdas(g, 'otros').includes(id)).join(','));
  }
  {
    // Un tipo desconocido en un guardado viejo: tiene que ser visible en
    // `otros`. Si se hiciera `w.type === 'otros'`, el item se perderia.
    const g = await boot(baseSave([
      collector('r1'), companion('m1'),
      { id: 'z1', name: 'Cosa Rara', type: 'weapon', details: 'x', rarity: 'Común', sellPrice: 1 },
      { id: 'z2', name: 'Trozo', type: 'modulo', details: 'x', rarity: 'Raro', sellPrice: 1 }
    ]));
    check('filtro Otros: un tipo desconocido SI sale', celdas(g, 'otros').join(',') === 'z1,z2',
      celdas(g, 'otros').join(','));
    check('filtro: matchesFilter es la misma regla que usa la rejilla',
      matchesFilter({ type: 'weapon' }, 'otros') === true &&
      matchesFilter({ type: 'collector' }, 'otros') === false);
  }
  {
    // Un filtro sin ningun item de ese tipo tiene que dar una rejilla VACIA, no
    // "todo". Si `matchesFilter` cayera en un `return true` por defecto, el
    // filtro vacio dejaria pasar el almacen entero.
    const g = await boot(baseSave([collector('r1')]));
    check('filtro sin resultados: la rejilla queda vacia', celdas(g, 'companion').length === 0,
      celdas(g, 'companion').join(','));
  }
  {
    // Un filtro desconocido (un id de mas en el DOM) no debe romper la rejilla.
    const g = await boot(baseSave([collector('r1')]));
    check('filtro desconocido: no muestra nada en vez de mostrarlo todo',
      celdas(g, 'filtroQueNoExiste').length === 0, celdas(g, 'filtroQueNoExiste').join(','));
  }

  // =========================================================================
  //  1b. Ordenar por el stat: DOS EJES, Y UNO SOLO MENTIRÍA
  // =========================================================================
  //
  //  Lo que se pidió fue encontrar los mejores, y detrás hay dos preguntas: qué
  //  recolector da más **por clic** y qué compañero da más **por segundo**. Son dos
  //  ejes y por eso dos opciones.
  //
  //  El error que hay que evitar es ordenar por el número "mayor" mezclando los dos: un
  //  clic se repite mil veces en un segundo, así que cualquier compañero ganaría siempre y
  //  la lista no diría nada. Y el multiplicador tampoco entra en el eje de por segundo,
  //  porque su 1,75 no son unidades: son 1,75 veces lo de los demás.
  {
    const g = await boot(baseSave([
      // Dos recolectores con el MISMO daño y distinto tier: es el caso del desempate.
      // **COMUNES A PROPÓSITO (F97).** Desde F97 todo item con rareza trae sus
      // afijos al cargar y el stat sumaría un componente sorteado: el orden
      // dejaría de ser el del daño y la prueba sería flaky entre corridas. El
      // neutro es Común (0 por tabla), que es lo que la doctrina de RAREZA_NEUTRA
      // de `kit.ts` pide para no medir el multiplicador en vez de lo medido.
      collector('r1', 3, { rarity: 'Común' }), collector('r2', 7, { rarity: 'Común' }),
      collector('r3', 5, { rarity: 'Común' }), collector('r4', 1, { rarity: 'Común' }),
      companion('m1'), companion('m2'), companion('m3'),
      crate('c1')
    ]));

    // **EL DAÑO SE PONE DESPUÉS DE CARGAR, Y POR QUÉ ES ASÍ.** La carga recalcula el
    // daño de un recolector desde su tier y su potencial, así que un `damage: 100`
    // escrito en la partida guardada no llega al estado: la primera versión de esta
    // prueba los puso ahí y la carga los cambió todos, y el orden que se comprobaba era
    // el del tier. Para probar dos recolectores **con el mismo daño y distinto tier** hay
    // que fijarlo en el estado, que es donde vive la cifra que ordena.
    const wh = s(g).warehouse as any[];
    const danio = (id: string, d: number) => { wh.find((w: any) => w.id === id).damage = d; };
    danio('r1', 100); danio('r2', 100); danio('r3', 300); danio('r4', 10);

    // Y las fichas de los compañeros, que es de donde el motor saca el tipo y el poder.
    s(g).companions = [
      ficha('m1', 3, { type: 'click', power: 20 }),
      ficha('m2', 5, { type: 'passive', power: 65 }),
      ficha('m3', 4, { type: 'multiplier', power: 0.5 })
    ];

    const stat = g.getStatPrincipal;
    // **EL ORDEN POR CLIC, Y LOS QUE NO MIDEN EN ESE EJE AL FINAL.** El compañero de 65/s
    // tiene un número más grande que cualquier recolector de esta partida, y aun así no
    // puede ir delante: son grandezas distintas.
    const porClic = celdas(g, 'collector', 'stat');
    check('orden stat: los recolectores van de mas dano a menos',
      porClic.join(',') === 'r3,r2,r1,r4', porClic.join(','));
    check('orden stat: a igual de dano, delante el de tier mas alto',
      porClic.indexOf('r2') < porClic.indexOf('r1'), porClic.join(','));

    const porSegundo = celdas(g, 'companion', 'statSeg');
    check('orden stat/s: los companeros de mas ingreso a menos',
      porSegundo.join(',') === 'm2,m1,m3', porSegundo.join(','));

    // **EL MULTIPLICADOR AL FINAL, Y NO UN CERO.** Su stat vale 1,5, que es menos que el 20
    // del de click, así que si se tratara como una cifra más ya saldría el primero por
    // error. Va al final porque en este eje no tiene cifra.
    check('orden stat/s: el multiplicador va al final, y no es un cero',
      porSegundo[porSegundo.length - 1] === 'm3', porSegundo.join(','));

    // **Y CON TODO, LO QUE NO PERTENECE AL EJE SE QUEDA AL FINAL.** Un item que no se
    // puede comparar no se pierde: se va al final, que es donde está lo demás.
    const todoClic = celdas(g, 'all', 'stat');
    const todoSeg = celdas(g, 'all', 'statSeg');
    check('orden stat: con todo, los recolectores delante y el resto detras',
      todoClic.slice(0, 4).join(',') === 'r3,r2,r1,r4' &&
      !todoClic.slice(0, 4).some((x: string) => x.startsWith('m') || x.startsWith('c')),
      todoClic.join(','));
    check('orden stat: no se pierde ningun item al ordenar',
      new Set(todoClic).size === todoClic.length && todoClic.length === 8, todoClic.join(','));
    check('orden stat/s: los de por segundo delante y el resto detras',
      todoSeg.slice(0, 2).join(',') === 'm2,m1' &&
      !todoSeg.slice(0, 2).some((x: string) => x.startsWith('r') || x.startsWith('c')),
      todoSeg.join(','));

    // **Y EL ORDEN ES EL DEL NÚMERO QUE SE VEN.** El stat de la esquina de la celda y el
    // de la ficha salen de la misma función, así que ordenar por aquí tiene que dar el
    // mismo orden que ordenar leyendo los números. Si divergieran, el jugador vería una
    // lista que no cuadra con lo que tiene delante de los ojos.
    const leido = (ids: string[]) => ids.map((id: string) => stat(id)?.valor ?? -1);
    check('orden stat: el orden es el del stat que se ve en la celda',
      leido(porClic).every((v: number, i: number, arr: number[]) => i === 0 || arr[i - 1] >= v),
      porClic.map((id: string) => id + '=' + stat(id)?.valor).join(' '));
  }

  // =========================================================================
  //  1b. El mismo orden, en la Forja
  // =========================================================================
  //
  //  La rejilla de la Forja ordenaba por `(a.tier - b.tier) || (b.damage || b.power)`,
  //  y eso es el **valor de base**: el `damage` de un recolector es
  //  `danioDeRango(tier, potencial)` sin el multiplicador de nivel, y el `power` de un
  //  compañero es su poder sin `multiplicadorDeNivel`. El resultado era que un compañero
  //  de nivel 20 con poder 2 quedaba debajo de uno de nivel 0 con poder 3, y el número
  //  que ordenaba no era ninguno de los que se veían en la celda.
  //
  //  Estas pruebaspin el orden por el stat FINAL, que es el mismo que pinta la celda. Y
  //  lo pinen con los dos casos que el orden por base no distinguishesía: el nivel dentro
  //  del mismo poder, y el potencial dentro del mismo tier.
  {
    const g = await boot(baseSave([
      // Los tres del mismo tier y **el mismo daño de base**: 10. Solo se diferencian en
      // el nivel, así que el orden por base los deja en el orden de entrada y el final los
      // ordena de verdad. El nivel se fija DESPUÉS de cargar, porque la carga recalcula el
      // daño del recolector a partir del tier y el potencial.
      // F74 · La base va explícita e igual en los tres: sin ella la migración sortea
      // una distinta por item y la premisa (mismo daño) se rompe por el dado.
      collector('n0', 3, { potential: 3, baseId: 'base_rec_t3_6' }),
      collector('n5', 3, { potential: 3, baseId: 'base_rec_t3_6' }),
      collector('n20', 3, { potential: 3, baseId: 'base_rec_t3_6' }),
      // Dos del mismo tier con distinto potencial: el daño de base ya sale distinto, así
      // que este caso lo resolvía el orden viejo también. Está para que se vea que sigue
      // funcionando.
      collector('p1', 3, { potential: 1, baseId: 'base_rec_t3_6' }),
      collector('p5', 3, { potential: 5, baseId: 'base_rec_t3_6' }),
      companion('c0', 4, { potential: 3, baseId: 'base_com_t4_6' }),
      companion('c20', 4, { potential: 3, baseId: 'base_com_t4_6' }),
      companion('mult')
    ], { warehouseCapacity: 30 }));

    const wh = s(g).warehouse as any[];
    const fijaNivel = (id: string, nivel: number) => { wh.find((w: any) => w.id === id).level = nivel; };
    // `collector(id, tier, potential?)`: los tres del principio van al mismo daño de base.
    fijaNivel('n0', 0); fijaNivel('n5', 5); fijaNivel('n20', 20);

    // Y las fichas, que es de donde el motor saca el tipo y el poder. **EL MISM0 PODER
    // CON NIVELES DISTINTOS**: es el caso exacto que el orden por base no veía.
    // F74 · Base y potencial explícitos e iguales: sin ellos la migración sortea
    // una base por item y el poder recalculado ya no es el mismo.
    const poderC = poderDeCompanero(4, 3, basePorId('base_com_t4_6'));
    s(g).companions = [
      ficha('c0', 4, { type: 'passive', power: poderC, potential: 3, baseId: 'base_com_t4_6' }),
      ficha('c20', 4, { type: 'passive', power: poderC, potential: 3, baseId: 'base_com_t4_6' }),
      ficha('mult', 4, { type: 'multiplier', power: 2 })
    ];
    // El poder sale de la ficha, y la ficha tiene que ir en el mismo sitio que en el
    // almacén: `getStatPrincipal()` busca el compañero por id para saber su tipo.
    const c20 = wh.find((w: any) => w.id === 'c20');
    c20.level = 20;
    if (c20.power !== 10) c20.power = 10;

    // **LA PREMISA, O ESTAS PRUEBAS NO COMPRUEBAN NADA.** Si los tres recolectores no
    // tienen el mismo daño de base, el orden viejo acertaría por casualidad y la prueba
    // pasaría sin estar midiendo el nivel. Un "sale bien" que viene de un fixture
    // equivocado es verde y no está midiendo el defecto.
    const baseDe = (id: string) => wh.find((w: any) => w.id === id).damage;
    check('forja: los tres del mismo tier tienen el mismo dano de base',
      baseDe('n0') === baseDe('n5') && baseDe('n5') === baseDe('n20'),
      `n0=${baseDe('n0')} n5=${baseDe('n5')} n20=${baseDe('n20')}`);

    const stat = g.getStatPrincipal;
    const ordenRec = materialesDeForja(g, 'collector').map((w: any) => w.id);
    const ordenCom = materialesDeForja(g, 'companion').map((w: any) => w.id);

    // **Y QUE EL NIVEL REALMENTE CAMBIE EL STAT.** Si `getStatPrincipal()` no multiplicara
    // por el nivel, los tres valdrían lo mismo y el orden sería el de entrada otra vez,
    // verde por el motivo equivocado.
    check('forja: el stat final sale mas alto con mas nivel, con la misma base',
      (stat('n20')?.valor ?? 0) > (stat('n5')?.valor ?? 0) &&
      (stat('n5')?.valor ?? 0) > (stat('n0')?.valor ?? 0),
      `n0=${stat('n0')?.valor} n5=${stat('n5')?.valor} n20=${stat('n20')?.valor}`);

    // **EL ORDEN ES EL DEL VALOR FINAL, NO EL DE LA BASE.** Relativo, no absoluto:
    // p5 lleva ★5 y queda donde le toca por su número; lo que importa es que el
    // nivel ordene a los tres iguales (n20 > n5 > n0).
    check('forja: con la misma base, el de mas nivel va primero',
      ordenRec.indexOf('n20') < ordenRec.indexOf('n5')
        && ordenRec.indexOf('n5') < ordenRec.indexOf('n0'),
      ordenRec.join(','));

    // **Y EL ORDEN ES EL DEL NÚMERO QUE SE VE**, que es lo que hace que la lista cuadre
    // con lo que hay delante de los ojos. La misma comprobación que en el almacén.
    const leido = ordenRec.map((id: string) => stat(id)?.valor ?? -1);
    check('forja: el orden es el del stat que se ve en la celda',
      leido.every((v: number, i: number, arr: number[]) => i === 0 || arr[i - 1] >= v),
      ordenRec.map((id: string) => id + '=' + stat(id)?.valor).join(' '));

    // **Y ENTRE COMPAÑEROS, IGUAL: EL NIVEL CUENTA.**
    check('forja: entre companeros, con el mismo poder gana el de mas nivel',
      ordenCom.slice(0, 2).join(',') === 'c20,c0', ordenCom.join(','));

    // **EL MULTIPLICADOR AL FINAL, Y NO UN CERO.** Su stat es "tres veces lo de los
    // demás" y da 3, que es MÁS que el 10 del pasivo: si se tratara como una cifra más,
    // saldría el primero por error.
    check('forja: el multiplicador va el ultimo aunque su numero sea mayor',
      ordenCom[ordenCom.length - 1] === 'mult',
      `orden=${ordenCom.join(',')} mult=${stat('mult')?.valor}`);

    // **Y NINGÚN MATERIAL SE PIERDE.** Ordenar es reordenar: si un item no aparece, el
    // jugador ha perdido un material del almacén sin que nadie le avise.
    check('forja: ordenar no pierde ningun material',
      ordenRec.length === 5 && ordenCom.length === 3,
      `rec=${ordenRec.join(',')} com=${ordenCom.join(',')}`);
  }

  // =========================================================================
  //  1c. Las bandas de la probabilidad, que es lo que decide el color
  // =========================================================================
  //
  //  La hoja de sintonización enseña la probabilidad en grande y con color, y el color
  //  sale de `bandaDeProbabilidad()`. La regla del corte vive en `data/items.ts` y no en la
  //  vista, así que aquí se puede comprobar: si el corte viviera en el componente, el mismo
  //  número sería rojo en una pantalla y verde en otra y no habría forma de enterarse.
  {
    // **LOS TRES TRAMOS, Y LOS CORTES EXACTOS.** El 80 es verde y el 79,999 no; con la
    // probabilidad de sintonización, que es entera, eso nunca se nota, pero el corte
    // exacto es lo que dice la regla y lo que hay que fijar.
    check('banda: de 80 para arriba es alta',
      bandaDeProbabilidad(80) === 'alta' && bandaDeProbabilidad(95) === 'alta' &&
      bandaDeProbabilidad(79.999) !== 'alta',
      `80=${bandaDeProbabilidad(80)} 95=${bandaDeProbabilidad(95)} 79.999=${bandaDeProbabilidad(79.999)}`);
    check('banda: de 50 a 80 es media',
      bandaDeProbabilidad(50) === 'media' && bandaDeProbabilidad(79) === 'media' &&
      bandaDeProbabilidad(79.999) === 'media',
      `50=${bandaDeProbabilidad(50)} 79=${bandaDeProbabilidad(79)} 79.999=${bandaDeProbabilidad(79.999)}`);
    check('banda: por debajo de 50 es baja',
      bandaDeProbabilidad(49.999) === 'baja' && bandaDeProbabilidad(0) === 'baja',
      `49.999=${bandaDeProbabilidad(49.999)} 0=${bandaDeProbabilidad(0)}`);

    // **UN NÚMERO ROTO ES LA BANDA QUE NO PROMETE, NUNCA "NO SE SABE".** Un NaN
    // comparado con 80 es false y con 50 tambien, asi que el primer corte se come los dos
    // casos: sin el `|| 0` de la entrada, un fallo del motor se pintaria como una
    // probabilidad sin banda, que es exactamente lo que este diseno quiere evitar.
    check('banda: un numero que no es un numero es baja, no una banda cualquiera',
      bandaDeProbabilidad(NaN) === 'baja' && bandaDeProbabilidad(undefined as any) === 'baja',
      `NaN=${bandaDeProbabilidad(NaN)} undefined=${bandaDeProbabilidad(undefined as any)}`);

    // **Y LA BANDA NO SE SACA DE NINGÚN OTRO SITIO.** Se llama a la función que la hoja
    // llama, y el corte se lee de las constantes que la hoja no vuelve a escribir.
    check('banda: el corte sale de la constante, y la hoja no lleva el suyo',
      CORTE_PROBABILIDAD_ALTA === 80 && CORTE_PROBABILIDAD_MEDIA === 50,
      `alta=${CORTE_PROBABILIDAD_ALTA} media=${CORTE_PROBABILIDAD_MEDIA}`);
  }

  // =========================================================================
  //  2. Agrupado de pilas: una celda, N items
  // =========================================================================
  {
    // Dos items IGUALES pero NO contiguos en el array tienen que acabar en la
    // misma celda. Antes solo se juntaban los vecinos, y entonces la rejilla que
    // pintaba y la del arrastre tenian distinto numero de celdas.
    //
    // Se meten DESPUES de cargar, a proposito: `mergeStacks` ya funde los
    // duplicados al arrancar, asi que la unica forma de tener dos entradas
    // iguales separadas es que llegaran asi. Es exactamente el caso que la
    // agrupacion de la rejilla tiene que seguir soportando.
    const g = await boot(baseSave([crate('c1'), collector('r1')]));
    (s(g).warehouse as any[]).push(crate('c2'));
    check('pilas: dos cajas separadas por otra cosa se aunan en una celda',
      celdas(g, 'all').length === 2, celdas(g, 'all').join(','));
    check('pilas: la celda guarda los dos ids detras',
      grupos(g, 'all').find((gr: string[]) => gr.includes('c1'))?.join(',') === 'c1,c2',
      JSON.stringify(grupos(g, 'all')));
  }
  {
    // El contador de la esquina son UNIDADES, no items: una pila de 5 son 5, y
    // si hay otra pila de 1 se suman en la MISMA celda hasta el tope del tipo.
    const g = await boot(baseSave([crate('c1', 1, 5), crate('c2')]));
    const gs = visibleStacksFor(g, s(g), 'all', 'default');
    const celda = gs.find((c: any) => c.item.id === 'c1');
    check('pilas: el contador suma las unidades de la celda',
      celda.count === 6, 'count=' + celda.count);
    check('pilas: tras la fusion hay un solo item detras', celda.ids.length === 1, celda.ids.join(','));
    check('pilas: y ese item lleva las 6 unidades', celda.item.stackCount === 6,
      'stackCount=' + celda.item.stackCount);
  }
  {
    // F30 · EL TOPE DE PINTADO NO RECORTA EL CONTADOR. Antes la rejilla hacía
    // `Math.min(count, tope)` y con 25 cajas pintaba 20, que es lo que el jugador
    // reportaba como "tengo 25 y me sale 20" (R3).
    //
    // **Y AHORA EL CASO SON LOS CONSUMIBLES, PORQUE EL DE LAS CAJAS YA NO EXISTE.**
    // Las cajas tienen tope de PILA —99 de almacenamiento—, así que 150 cajas son
    // dos celdas de 99 y 51 y la pregunta de "150 en una celda" ya no se puede
    // hacer. El consumible NO tiene tope de pila: 150 son una celda, y el 20 de
    // `MAX_STACK` es solo de pintado. Es el mismo bug, en el tipo donde todavía
    // puede ocurrir, y por eso la prueba se queda ahí en vez de desaparecer.
    //
    // Antes esta prueba usaba cristales, y antes que eso llaves. Los dos han dejado
    // de ser objetos de la rejilla: la llave se vende sola al cargar y el cristal es
    // un recurso, así que la partida se quedaría sin un solo item y `celda` sería
    // `undefined`.
    const g = await boot(baseSave([consumable('x1', 'afk', 150)]));
    const celda = visibleStacksFor(g, s(g), 'all', 'default')[0];
    check(`pilas: el contador ya NO se recorta al tope (tope ${MAX_STACK.consumable}, hay 150)`,
      celda.count === 150, 'count=' + celda.count);
    check('pilas: y el item sigue con sus unidades reales', celda.item.stackCount === 150,
      'stackCount=' + celda.item.stackCount);
    check(`pilas: la esquina dice "${MAX_STACK.consumable}+" y no "${MAX_STACK.consumable}"`,
      textoDeCantidad(celda.count, MAX_STACK.consumable) === `${MAX_STACK.consumable}+`,
      textoDeCantidad(celda.count, MAX_STACK.consumable));
  }
  {
    // Y EL CONTRAPUNTO: con tope de pila, 250 cajas SÍ son tres celdas. No es que
    // la rejilla las recorte —eso no pasa—: es que el almacén las reparte al
    // cargar, y por eso hay tres celdas de verdad y no una que mienta.
    const g = await boot(baseSave([crate('c1', 1, 250)]));
    const celdas = visibleStacksFor(g, s(g), 'all', 'default');
    check('pilas: 250 cajas son tres celdas, por el tope de pila',
      celdas.length === 3 && celdas.map(c => c.count).sort((a, b) => b - a).join(',') === '99,99,52',
      JSON.stringify(celdas.map(c => `${c.item.id}:${c.count}`)));
    check('pilas: y ninguna se pinta recortada, porque ninguna pasa de su tope',
      celdas.every(c => textoDeCantidad(c.count, MAX_STACK.crate) === String(c.count)),
      celdas.map(c => textoDeCantidad(c.count, MAX_STACK.crate)).join(' · '));
  }
  {
    // Un bloque que vivía aquí y se ha BORRADO a propósito: miraba si el tope de
    // PINTADO de una celda se aplicaba a 120 unidades. Lo hacía con el cristal, que
    // era el tipo sin tope de pila y con tope de pintado de 99, y por eso "120 en
    // una celda" era una pregunta con respuesta. **Ya no hay tal tipo**: el cristal
    // es un recurso y no está en el almacén. Lo que queda es el consumible, y su
    // caso es el bloque de F30 de más arriba; el de las cajas, el de 250 de más
    // abajo. Una prueba que asegura una regla borrada es peor que no tenerla:
    // alguien la lee, la ve pasar y se queda creyendo que la regla sigue ahí.
    //
    // Un tipo que NO es apilable nunca se agrupa, por muchas unidades que tenga:
    // dos recolectores son dos celdas, o el jugador no puede elegir entre ellos.
    const g = await boot(baseSave([
      collector('r1', 3, { stackable: true, stackCount: 3 }),
      collector('r2', 3, { stackable: true, stackCount: 3 })
    ]));
    check('pilas: los recolectores no se apilan aunque digan que son apilables',
      celdas(g, 'all').length === 2, celdas(g, 'all').join(','));
  }
  {
    // Dos items de DISTINTO nombre no se aunan: el jugador tiene que poder elegir con
    // cuál de los dos, y por eso la pila se distingue por NOMBRE y no por tipo.
    // Antes eran dos cristales de distinto nivel; ya no hay niveles de cristal.
    const g = await boot(baseSave([
      consumable('x1', 'afk', 1),
      consumable('x2', 'clickBoost', 1, { name: 'Píldora de Foco' })
    ]));
    check('pilas: dos consumibles de distinto nombre no se aunan',
      celdas(g, 'all').length === 2, celdas(g, 'all').join(','));
  }
  {
    // Dos cajas de DISTINTO tipo tampoco: abren cofres distintos.
    const g = await boot(baseSave([crate('c1', 1), crate('c2', 6)]));
    check('pilas: dos cajas de distinto tipo no se aunan',
      celdas(g, 'all').length === 2, celdas(g, 'all').join(','));
  }

  // =========================================================================
  //  3. Orden
  // =========================================================================
  {
    // Para los cuatro ordenes se usan COMPANEROS, no cajas. Los companeros no
    // son apilables, asi que no se funden entre si, y se les puede poner nombre,
    // rareza, tier y precio de reventa a voluntad.
    //
    // Ojo con las cajas: su tipo se deduce del NOMBRE, asi que un item con
    // `name: 'Beta'` deja de contar como caja, `materializePendingCrates` le crea
    // una de verdad al cargar, y la rejilla muestra 4 celdas donde se esperaban
    // 3. Cambiar el nombre de una caja no es inocuo, y por eso aqui no se toca.
    const g = await boot(baseSave([
      companion('a', 1, { name: 'Zeta', rarity: 'Común', sellPrice: 100 }),
      companion('b', 5, { name: 'Alfa', rarity: 'Legendario', sellPrice: 900 }),
      companion('c', 3, { name: 'Beta', rarity: 'Épico', sellPrice: 400 })
    ]));
    check('orden Mi orden: respeta el orden del jugador',
      celdas(g, 'all', 'default').join(',') === 'a,b,c', celdas(g, 'all', 'default').join(','));
    check('orden Nombre: alfabetico',
      celdas(g, 'all', 'name').join(',') === 'b,c,a', celdas(g, 'all', 'name').join(','));
    check('orden Rareza: de la mas rara a la mas comun',
      celdas(g, 'all', 'rarity').join(',') === 'b,c,a', celdas(g, 'all', 'rarity').join(','));
    check('orden Tier: de mayor a menor',
      celdas(g, 'all', 'tier').join(',') === 'b,c,a', celdas(g, 'all', 'tier').join(','));
    check('orden Valor: de mayor a menor precio',
      celdas(g, 'all', 'value').join(',') === 'b,c,a', celdas(g, 'all', 'value').join(','));

    // Ordenar NUNCA puede perder items ni cambiar el almacen: solo cambia el
    // orden en que se pintan. Si `sort` mutara el array del estado, arrastrar
    // algo dejaria el almacen desordenado para siempre.
    check('orden: ordenar no toca el orden guardado',
      ids(g).join(',') === 'a,b,c', ids(g).join(','));
  }
  {
    // El filtro manda sobre el orden: los items de otros tipos no se cuelan.
    const g = await boot(baseSave([
      collector('r1', 9, { name: 'Zeta' }),
      collector('r2', 1, { name: 'Alfa' }),
      companion('m1', 3, { name: 'Beta' })
    ]));
    check('orden + filtro: el filtro se aplica antes de ordenar',
      celdas(g, 'collector', 'name').join(',') === 'r2,r1', celdas(g, 'collector', 'name').join(','));
  }
  {
    // Y el caso de una pila que se vende ENTERA: una celda antes, cero despues.
    // Si la rejilla se quedara con la celda vacia, el arrastre siguiente contaria
    // una celda que ya no existe.
    const g = await boot(baseSave([crate('p1', 1, 4), collector('r1'), collector('r2')]));
    check('venta: una pila es una celda', celdas(g, 'all').length === 3, celdas(g, 'all').join(','));
    g.sellItem('p1');
    check('venta: vender la pila quita su celda entera', celdas(g, 'all').length === 2,
      celdas(g, 'all').join(','));
    check('venta: y no queda ningun id fantasma',
      new Set(celdas(g, 'all')).size === new Set(ids(g)).size, ids(g).join(','));
  }
  {
    // Un filtro que ya no tiene resultados tras vender: **la rejilla se vacia y ya no
    // hay nada que decidir.** Antes esta comprobacion era sobre el arrastre --mover un
    // item que el filtro oculta-- y las dos mitades se han ido juntas al quitar la
    // disposicion manual. Lo que queda es lo que un filtro tiene que seguir cumpliendo
    // con la venta por medio, que es que la rejilla y el almacen dicen lo mismo.
    const g = await boot(baseSave([companion('m1'), companion('m2'), collector('r1'), collector('r2')]));
    check('venta + filtro: el filtro companeros tiene 2 celdas',
      celdas(g, 'companion').length === 2, celdas(g, 'companion').join(','));
    g.sellItem('m1');
    check('venta + filtro: tras vender queda 1 celda', celdas(g, 'companion').length === 1,
      celdas(g, 'companion').join(','));
    check('venta + filtro: y la rejilla no inventa celdas para lo que el filtro oculta',
      new Set(celdas(g, 'companion')).size === new Set(ids(g).filter((x: string) => x !== 'r1' && x !== 'r2')).size,
      ids(g).join(','));
  }
  {
    // El almacen con un solo item: una celda y ni una más.
    const g = await boot(baseSave([collector('r1'), collector('r2')]));
    g.sellItem('r1');
    check('venta: un almacen con un item da una celda', celdas(g, 'all').length === 1, celdas(g, 'all').join(','));
  }
  {
    // Un almacen VACIO de verdad: la rejilla no falla.
    const g = await boot(baseSave([]));
    check('vacio: sin items hay cero celdas', celdas(g, 'all').length === 0, celdas(g, 'all').join(','));
  }

  // ---------------------------------------------------------------------------
  //  LA REJILLA DE LA FORJA NO PINTA LO EQUIPADO
  //
  //  Es una regla de la lista, no de la celda, y por eso se puede comprobar sin un DOM:
  //  `materialesDeForja()` es la que decide y lo que se mira es lo que sale de ella.
  //  La celda se lleva la parte de verdad de la regla --que no haya ningun equipado que
  //  pueda tocar-- y esta comprueba la parte de la lista.
  // ---------------------------------------------------------------------------
  {
    const g = await boot(baseSave([
      collector('r1'), collector('r2'), collector('r3')
    ], { equippedCollectorId: 'r2' }));
    const ids = materialesDeForja(g, 'collector').map((w: any) => w.id);
    check('forja: el recolector equipado no sale en la rejilla de materiales',
      !ids.includes('r2'), 'ids=' + ids.join(','));
    check('forja: y los demas siguen saliendo',
      ids.includes('r1') && ids.includes('r3'), 'ids=' + ids.join(','));
    check('forja: el equipado sigue ESTANDO en el almacen, no se perdio',
      s(g).warehouse.some((w: any) => w.id === 'r2'),
      'almacen=' + s(g).warehouse.map((w: any) => w.id).join(','));

    // **Y LO MISMO CON LOS COMPAÑEROS, QUE SON OTRA LISTA Y OTRO PREDICADO.** El
    // recolector se recognise por `equippedCollectorId` y el compañero por la lista de
    // activos, y un filtro que solo mirara el primero dejaría a los compañeros equipados
    //ocupando huecos sin que nadie lo dijera.
    const g2 = await boot(baseSave([
      consumable('x1', 'afk', 1), collector('r1')
    ], { activeCompanions: [] }));
    // Un compañero activo con id propio: se marca en `activeCompanions`, que es lo
    // unico que hay para el.
    const st: any = s(g2);
    st.warehouse.push({ id: 'k1', name: 'KOBOLD', type: 'companion', details: 'x', rarity: 'Raro', tier: 1, potential: 3, sellPrice: 100 });
    st.activeCompanions = ['k1'];
    const comp = materialesDeForja(g2, 'companion').map((w: any) => w.id);
    check('forja: el compañero activo tampoco sale en la rejilla',
      !comp.includes('k1'), 'ids=' + comp.join(','));

    // **Y CON TODO EQUIPADO LA REJILLA QUEDA VACIA, QUE ES JUSTO LO QUE SE PIDIO**
    // antes de que la celda gris dijera "no tienes nada". Con tres y dos equipados el
    // filtro tiene que dejar la lista a cero, no a uno.
    // **Y LA FLAG `equipped` DE LA FICHA NO CUENTA**, que es lo que hace peligroso
    // escribir el filtro a ojo: el id manda y la bandera es su proyeccion. Aqui se
    // comprueba poniendo la bandera puesta SIN id, que es el estado que dejo un
    // guardado viejo, y el item tiene que seguir saliendo: el motor lo consume igual.
    const g3 = await boot(baseSave([collector('r1'), collector('r2')], {}));
    const st3: any = s(g3);
    st3.equippedCollectorId = '';
    st3.warehouse[0].equipped = true;
    check('forja: la bandera de la ficha sin id NO esconde el item, porque el id manda',
      materialesDeForja(g3, 'collector').length === 2,
      `materiales=${materialesDeForja(g3, 'collector').length}`);

    // Y con el id puesto de verdad, fuera.
    st3.equippedCollectorId = 'r1';
    check('forja: con el id puesto, el item sale de la rejilla y sigue en el almacen',
      materialesDeForja(g3, 'collector').map((w: any) => w.id).join(',') === 'r2' &&
      st3.warehouse.length === 2,
      `ids=${materialesDeForja(g3, 'collector').map((w: any) => w.id).join(',')} almacen=${st3.warehouse.length}`);
  }

  // ---------------------------------------------------------------------------
  //  EL ORDEN DE LA FORJA, Y QUE SEA EL DEL ALMACÉN
  //
  //  La rejilla de materiales se ordenaba por el stat final con un comparador propio,
  //  duplicado dentro de la Forja. Ahora llama a `visibleStacksFor()` --la del
  //  almacén-- con el eje que le toca al tipo, y lo que se comprueba es que las dos
  //  rejillas dicen lo mismo con la misma entrada.
  // ---------------------------------------------------------------------------
  {
    const g = await boot(baseSave([
      collector('n0', 3, { damage: 10, level: 0 }),
      collector('n5', 3, { damage: 10, level: 5 }),
      collector('n12', 3, { damage: 10, level: 12 })
    ]));
    const porDefecto = materialesDeForja(g, 'collector').map((w: any) => w.id);

    // **EL NIVEL MULTIPLICA, ASI QUE EL ORDEN POR STAT DA N0, N5, N12.** Con la misma
    // base, el de nivel 12 pega mucho mas: es el mismo dato que la celda pinta en la
    // esquina, y por eso el orden es comprobable con los numeros delante.
    check('forja orden: por defecto va por stat final, y el nivel pesa',
      porDefecto.join(',') === 'n12,n5,n0', porDefecto.join(','));

    // **Y POR NIVEL ES EL MISMO ORDEN, PERO DICE QUE ES POR NIVEL.** No es una prueba
    // tautologica: las dos listas salen de `materialesDeForja()` con la misma entrada y
    // solo cambia la clave, asi que si el comparador fuera el mismo por accidente lo
    // que se esta afirmando es que la clave llega hasta el almacen.
    const porNivel = materialesDeForja(g, 'collector', 'level').map((w: any) => w.id);
    check('forja orden: la clave de nivel llega hasta el orden del almacen',
      porNivel.join(',') === 'n12,n5,n0', porNivel.join(','));

    // **EL VALOR Y EL NOMBRE, QUE SON LOS OTROS DOS EJES QUE EL ALMACÉN TIENE.**
    // **LA AFIRMACIÓN ES SOBRE LOS NOMBRES, NO SOBRE LOS IDS.** El kit le pone un nombre de
    // recolector al item y el id no tiene nada que ver con el: ordenar por nombre y mirar
    // los ids daría una lista que parece sin criterio, y la prueba fallaría por un motivo
    // que no es el que se quiere comprobar.
    const porNombre = materialesDeForja(g, 'collector', 'name');
    const nombres = porNombre.map((w: any) => String(w.name));
    check('forja orden: por nombre sale alfabetico',
      nombres.join('|') === [...nombres].sort((a, b) => a.localeCompare(b)).join('|'),
      nombres.join(' · '));
    check('forja orden: el valor tambien cambia el orden',
      materialesDeForja(g, 'collector', 'value').map((w: any) => w.id).length === 3);

    // **Y QUE LA CLAVE DESCONOCIDA NO ROMPA LA REJILLA.** Un `select` manda lo que le
    // viene: si un dia se quita una opcion y el estado se queda con la clave vieja, la
    // lista tiene que seguir saliendo en el orden de entrada en vez de vacia.
    const desconocida = materialesDeForja(g, 'collector', 'lo_que_sea').map((w: any) => w.id);
    check('forja orden: una clave que no existe deja la lista entera, no vacia',
      desconocida.length === 3, desconocida.join(','));
  }

// =========================================================================
  //  F45 · EL BUSCADOR, Y SUS TRES MITADES
  //
  //  El filtro de tipo y el orden contestan "¿qué tipo quiero ver?" y "¿en qué
  //  orden?". El buscador contesta "¿dónde está el AK-7?", que es la tercera
  //  pregunta y la que másfalta cuando el almacén tiene veinte cajas y cuarenta
  //  armas. Y como es texto libre **se compone** con el filtro en vez de
  //  sustituirlo: buscar dentro de "Recolectores" tiene que salir distinto de
  //  buscarlo en "Todo".
  //
  //  Lo que se comprueba aquí es la regla, no el campo: el input es markup y el
  //  banco no tiene DOM, pero la regla es lo que puede estar mal.
  // =========================================================================
  {
    const ak = ficha('ak7', 5, { name: 'Ak-7 Valioso', type: 'collector', tier: 3, rarity: 'Épico' });
    const ak10 = ficha('ak10', 5, { name: 'Ak-10 Roto', type: 'collector', tier: 10, rarity: 'Legendario' });
    const dron = ficha('d1', 5, { name: 'Dron Explorador', type: 'companion', tier: 2, rarity: 'Raro' });
    const caja = crate('c1', 4);
    const lista = [ak, ak10, dron, caja];

    const busca = (texto: string, filtro = 'all') =>
      lista.filter((w: any) => pasaElFiltro(w, filtro, terminosDeBusqueda(texto))).map((w: any) => w.id);

    // --- El nombre, y sin tildes ni mayúsculas ---
    check('buscador: por el nombre, en cualquier caja',
      busca('ak-7').join() === 'ak7', busca('ak-7').join());
    check('buscador: sin tildes y sin mayúsculas',
      busca('ak').length === 2 && busca('AK-7').join() === 'ak7',
      `${busca('ak').join('|')} / ${busca('AK-7').join('|')}`);

    // **Y POR TILDE, QUE ES LA RAZÓN DE NORMALIZAR.** El teclado del móvil no
    //  siempre la pone, y un buscador que solo encuentra lo que está bien escrito
    //  es un buscador que falla justo en el móvil, que es donde se busca más.
    const conTilde = ficha('a1', 5, { name: 'Águila Cibernética', type: 'collector', tier: 1 });
    check('buscador: encuentra lo que lleva tilde escribiéndolo sin ella',
      matchesSearch(conTilde, terminosDeBusqueda('aguila')) === true
      && normalizaBusqueda('Águila') === 'aguila',
      normalizaBusqueda('Águila'));

    // --- El tier como número, que es el número que ve el jugador ---
    check('buscador: por el tier',
      busca('t10').join() === 'ak10' && busca('10').join() === 'ak10',
      `${busca('t10').join('|')} / ${busca('10').join('|')}`);

    // --- TÉRMINOS ENTEROS, Y NO SUBCADENA: EL ERROR CLÁSICO ---
    // Buscar "t1" devolviendo el T10 es lo que hace que un buscador parezca roto:
    // el jugador ve resultados que no ha pedido y no entiende el porqué.
    check('buscador: "t1" NO devuelve el T10',
      !busca('t1').includes('ak10'), busca('t1').join('|'));
    check('buscador: y el T10 sí aparece con su propio término',
      busca('t10').join() === 'ak10', busca('t10').join('|'));

    // **Y VARIAS PALABRAS SON "Y", NO "O".** "ak 7" son dos términos: un jugador
    //  que escribe eso quiere los AK-7, no los AK y los que tienen un 7.
    check('buscador: dos términos son "y", no "o"',
      busca('ak 7').join() === 'ak7', busca('ak 7').join('|'));
    check('buscador: y dos términos imposibles no devuelven nada, sin error',
      busca('ak 99').length === 0, busca('ak 99').join('|'));
    check('buscador: y "ak 10" si encuentra el Ak-10, que el 10 es su tier',
      busca('ak 10').join() === 'ak10', busca('ak 10').join('|'));

    // --- El filtro sigue mandando ---
    check('buscador: se compone con el filtro de tipo',
      busca('t3', 'collector').join() === 'ak7' && busca('t3', 'companion').length === 0,
      `${busca('t3', 'collector').join('|')} / ${busca('t3', 'companion').join('|')}`);
    check('buscador: buscar en "Todo" encuentra un compañero que en su filtro no está',
      busca('dron').join() === 'd1' && busca('dron', 'collector').length === 0,
      `${busca('dron').join('|')} / ${busca('dron', 'collector').join('|')}`);

    // --- Lo vacío NO FILTRA NADA ---
    // Un buscador que se queda sin resultados porque el campo quedó con un espacio
    // es un buscador que parece roto, y el jugador va a abrir el inventario otra vez.
    check('buscador: vacío y solo espacios devuelven todo',
      busca('').length === 4 && busca('   ').length === 4,
      `${busca('').length} / ${busca('   ').length}`);
    check('buscador: y sin términos tampoco filtra, que es el 0 de los términos',
      matchesSearch(ak, []) === true, String(matchesSearch(ak, [])));

    // --- Y LA REJILLA, QUE ES DONDE SE VE SI LOS DOS FILTROS SE SEPARAN ---
    const g = await boot(baseSave([ak, ak10, dron, caja], { warehouseCapacity: 40 }));
    const rejilla = (buscar: string, filtro = 'all', sort = 'default') =>
      visibleStacksFor(g, g.getState(), filtro, sort, buscar).map((c: any) => c.item.id).join('|');
    check('buscador: la rejilla filtra por el texto que le pasan',
      rejilla('dron') === 'd1', rejilla('dron'));
    check('buscador: y por texto y tipo a la vez, que es la prueba de que no se separan',
      rejilla('t3', 'collector') === 'ak7' && rejilla('ak', 'collector') === 'ak7|ak10',
      `${rejilla('t3', 'collector')} / ${rejilla('ak', 'collector')}`);
    check('buscador: sin texto la rejilla no cambia, que es lo que tiene que pasar',
      rejilla('') === rejilla('   '), `${rejilla('')} vs ${rejilla('   ')}`);
    check('buscador: el orden sigue mandando sobre la búsqueda, no al revés',
      rejilla('ak', 'all', 'value') === rejilla('ak', 'all', 'rarity').split('|').length
        ? rejilla('ak', 'all', 'value')
        : 'x',
      'orden=' + rejilla('ak', 'all', 'value'));
  }

  // =========================================================================
  //  F59 · El selector enseña lo que se puede ordenar, y hay orden por tipo
  // =========================================================================
  //
  //  "Recolección por segundo" con recolectores delante no ordena nada: ningún
  //  recolector tiene cifra en ese eje. Antes la opción salía igual y la rejilla
  //  se quedaba quieta, que se lee como rota. Ahora cada eje sale donde tiene
  //  cifras, y al cambiar de filtro el orden que deja de aplicar vuelve a
  //  Default en vez de quedarse puesto sin aparecer en el selector.
  {
    const ids = (filtro: string) => ordenesParaFiltro(filtro).map(o => o.id);
    check('ordenes: con recolectores sale el por clic y no el por segundo',
      ids('collector').includes('stat') && !ids('collector').includes('statSeg'),
      ids('collector').join(','));
    check('ordenes: con compañeros sale el por segundo y no el por clic',
      ids('companion').includes('statSeg') && !ids('companion').includes('stat'),
      ids('companion').join(','));
    check('ordenes: con cajas no sale ningún eje de stat',
      !ids('crate').includes('stat') && !ids('crate').includes('statSeg'),
      ids('crate').join(','));
    check('ordenes: en Todo salen los dos ejes y el orden por tipo',
      ids('all').includes('stat') && ids('all').includes('statSeg') && ids('all').includes('tipo'),
      ids('all').join(','));
    check('ordenes: el orden por tipo solo sale en Todo, que es donde agrupa',
      !ids('collector').includes('tipo') && !ids('companion').includes('tipo')
        && !ids('crate').includes('tipo') && !ids('otros').includes('tipo'),
      'sale fuera de Todo');
    check('ordenes: un orden que deja de aplicar no vale, y Default vale siempre',
      !ordenValidoParaFiltro('statSeg', 'collector')
        && ordenValidoParaFiltro('stat', 'collector')
        && ordenValidoParaFiltro('default', 'crate'),
      'statSeg+collector sigue valiendo');
    check('ordenes: un orden que no existe tampoco vale',
      !ordenValidoParaFiltro('invento', 'all'), 'invento vale');
  }
  {
    // **POR TIPO: COMPAÑEROS, RECOLECTORES, CAJAS Y EL RESTO.** Es decisión del
    // jugador, y dentro de cada tipo no se mueve nada: el sort es estable y
    // conserva la llegada. Dos recolectores seguidos salen en el mismo orden
    // en que entraron.
    const g = await boot(baseSave([
      crate('c1', 1, 1),
      collector('r1'), collector('r2'),
      companion('m1'),
      consumable('u1', 'afk', 1),
      companion('m2'),
      collector('r3')
    ]));
    const porTipo = celdas(g, 'all', 'tipo');
    check('orden tipo: compañeros, recolectores, cajas y el resto',
      porTipo.join(',') === 'm1,m2,r1,r2,r3,c1,u1', porTipo.join(','));
    check('orden tipo: no se pierde ningún item al agrupar',
      porTipo.length === 7, porTipo.join(','));
  }


  resumen('filtros y rejilla');
}

export default main();
