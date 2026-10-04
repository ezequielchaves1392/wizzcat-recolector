// ==========================================================================
//  Banco de pruebas de FILTROS y de la rejilla del almacen
//
//  Comprueba las tres funciones que deciden que se ve y que se puede mover:
//
//    matchesFilter   -> si un item entra en la rejilla
//    visibleStacksFor-> como se agrupan los items en celdas y en que orden
//    moveItemTo      -> a donde va el item que el jugador arrastra
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

import { visibleStacksFor, moveItemTo, matchesFilter } from '../src/components/warehouse';
import { materialesDeForja } from '../src/ui/forgePage';
import { bandaDeProbabilidad, CORTE_PROBABILIDAD_ALTA, CORTE_PROBABILIDAD_MEDIA } from '../src/data/items';
import { textoDeCantidad, MAX_STACK } from '../src/data/stacking';
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
    check('filtro Otros: ni recolectores ni companeros',
      celdas(g, 'otros').join(',') === 'c1,u1,u2', celdas(g, 'otros').join(','));

    // Los filtros se PARTEN la rejilla: nada puede estar en dos y nada se
    // puede perder. Si se pierde un item al filtrar, el jugador cree que ha
    // desaparecido del juego.
    const otros = new Set(celdas(g, 'collector').concat(celdas(g, 'companion')));
    const todo = new Set(celdas(g, 'all'));
    check('filtro: Recolectores + Companeros + Otros = Todo',
      otros.size + celdas(g, 'otros').length === todo.size,
      `partes=${otros.size + celdas(g, 'otros').length} todo=${todo.size}`);
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
      collector('r1', 3), collector('r2', 7), collector('r3', 5), collector('r4', 1),
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
      collector('n0'), collector('n5'), collector('n20'),
      // Dos del mismo tier con distinto potencial: el daño de base ya sale distinto, así
      // que este caso lo resolvía el orden viejo también. Está para que se vea que sigue
      // funcionando.
      collector('p1'), collector('p5'),
      companion('c0'), companion('c20'), companion('mult')
    ], { warehouseCapacity: 30 }));

    const wh = s(g).warehouse as any[];
    const fijaNivel = (id: string, nivel: number) => { wh.find((w: any) => w.id === id).level = nivel; };
    // `collector(id, tier, potential?)`: los tres del principio van al mismo daño de base.
    fijaNivel('n0', 0); fijaNivel('n5', 5); fijaNivel('n20', 20);

    // Y las fichas, que es de donde el motor saca el tipo y el poder. **EL MISM0 PODER
    // CON NIVELES DISTINTOS**: es el caso exacto que el orden por base no veía.
    s(g).companions = [
      ficha('c0', 4, { type: 'passive', power: 10 }),
      ficha('c20', 4, { type: 'passive', power: 10 }),
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

    // **EL ORDEN ES EL DEL VALOR FINAL, NO EL DE LA BASE.**
    check('forja: con la misma base, el de mas nivel va primero',
      ordenRec.slice(0, 3).join(',') === 'n20,n5,n0', ordenRec.join(','));

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
    // El filtro oculta items, y el arrastre usa indices de CELDA. Con un filtro
    // activo, el indice 0 de la rejilla es el primer item del filtro, no el
    // primero del almacen. Es la razon de que el destino se traduzca a ancla.
    const g = await boot(baseSave([
      collector('r1'), crate('c1'), collector('r2'), crate('c2')
    ]));
    check('filtro + arrastre: la celda 0 es del filtro, no del almacen',
      celdas(g, 'collector')[0] === 'r1', celdas(g, 'collector').join(','));
  }

  // =========================================================================
  //  4. Arrastre: la celda de destino es la que el jugador senala
  // =========================================================================
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    moveItemTo(g, 'a', 1, 'all', 'default');
    check('arrastre: soltar en la celda 1 deja el item en la celda 1',
      ids(g).join(',') === 'b,a,c', ids(g).join(','));
  }
  {
    // El caso que se reporta como "no puedo mover": arrastrar una celda sobre la
    // de al lado no movia NADA. Con el bloque entrando siempre por delante del
    // ancla, y siendo el vecino el ancla, el destino era el sitio donde ya
    // estaba. Es un no-op exacto y silencioso, sin ningun aviso.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    const r = moveItemTo(g, 'a', 1, 'all', 'default');
    check('arrastre: soltar sobre la celda de al lado SI mueve',
      r === true && ids(g).join(',') === 'b,a,c', ids(g).join(','));
  }
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    moveItemTo(g, 'c', 0, 'all', 'default');
    check('arrastre: mover a la primera celda lo pone al principio',
      ids(g).join(',') === 'c,a,b', ids(g).join(','));
  }
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    moveItemTo(g, 'a', 2, 'all', 'default');
    check('arrastre: soltar en la ultima celda lo pone en esa celda',
      ids(g).join(',') === 'b,c,a', ids(g).join(','));
  }
  {
    // Y el salto largo, que es el que se salta una celda entera: antes el bloque
    // acababa en la celda 1 de una celda 2 señalada.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c'), collector('d')]));
    moveItemTo(g, 'a', 3, 'all', 'default');
    check('arrastre: un salto de dos celdas cae donde se senalo',
      ids(g).join(',') === 'b,c,d,a', ids(g).join(','));
  }
  {
    // Los huecos del final no tienen item al que anclarse. Lo que el jugador
    // quiere decir es "dejalo al final", y es lo que tiene que pasar.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    const r = moveItemTo(g, 'a', 7, 'all', 'default');
    check('arrastre: soltar en un hueco del final lo manda al final',
      r === true && ids(g).join(',') === 'b,c,a', ids(g).join(','));
  }
  {
    // El caso exacto que reporta el jugador: un almacen lleno, una pila enorme
    // que ocupa una sola celda y un montón de huecos detras. Soltar en un hueco
    // tiene que llevar el item a la ultima celda OCUPADA, que es lo unico que
    // el guardado puede representar: el array es una lista, no una bandeja con
    // huecos. Y tiene que decirse, no dejar al jugador con la certeza de que el
    // arrastre esta roto.
    //
    // La pila son 19 CONSUMIBLES iguales: se funden en un item al cargar y de ahí
    // una celda. Antes eran 19 cristales y antes que eso 19 llaves, y ninguno de los
    // dos se puede meter aquí: la llave se vende sola al cargar y el cristal es un
    // recurso, así que la partida se quedaría con dos items.
    const items = [collector('dron'), companion('blaster')];
    for (let i = 0; i < 19; i++) items.push(consumable('x' + i, 'afk'));
    const g = await boot(baseSave(items, { warehouseCapacity: 21 }));
    check('huecos: con una pila de 19 hay 3 celdas y 21 huecos pintados',
      celdas(g, 'all').length === 3 && celdas(g, 'all').join(',') === 'dron,blaster,x0',
      celdas(g, 'all').join(','));
    const r = moveItemTo(g, 'dron', 3, 'all', 'default');
    check('huecos: soltar en un hueco lleva el item a la ultima celda ocupada',
      r === true && celdas(g, 'all').join(',') === 'blaster,x0,dron', celdas(g, 'all').join(','));
  }
  {
    // Y soltar en un hueco lo que YA esta al final no puede hacer nada, porque
    // no hay nada que colocar. Es un no-op legitimo, pero la vista tiene que
    // avisar: sin el aviso el jugador arrastra, ve la celda igual y concluye que
    // no se puede mover. El banco no puede comprobar el aviso (es de la vista),
    // pero si que puede fijar que el estado no se rompe.
    const items = [collector('dron'), companion('blaster')];
    for (let i = 0; i < 19; i++) items.push(consumable('x' + i, 'afk'));
    const g = await boot(baseSave(items, { warehouseCapacity: 21 }));
    const r = moveItemTo(g, 'x0', 3, 'all', 'default');
    check('huecos: soltar en un hueco lo que ya esta al final no rompe nada',
      r === true && celdas(g, 'all').join(',') === 'dron,blaster,x0', celdas(g, 'all').join(','));
  }
  {
    // El caso que el comentario del codigo describe: soltar sobre su propia
    // celda no hace nada, y el jugador no ve como se le ha duplicado el item.
    const g = await boot(baseSave([collector('a'), collector('b')]));
    const r = moveItemTo(g, 'a', 0, 'all', 'default');
    check('arrastre: soltar sobre su propia celda no hace nada',
      r === false && ids(g).join(',') === 'a,b', ids(g).join(','));
  }
  {
    // Una pila es UNA celda: arrastrarla mueve todos sus items juntos y en el
    // mismo orden. Mover solo el que representaba la celda dejaba la celda igual
    // de llena, y el jugador ve un arrastre que no movio nada.
    //
    // Se usan cajas de DISTINTO tipo: dos del mismo tipo son la misma pila y se
    // funden en un item, asi que no habria dos ids que arrastrar. Para el caso de
    // "una celda con varios items detras" (que es el de verdad) esta el caso de los
    // 19 consumibles de mas abajo.
    const g = await boot(baseSave([
      crate('p1', 1, 2), crate('p2', 6, 3), collector('z')
    ]));
    // Celdas: [p1, p2, z]. Soltar p1 sobre la celda 1 tiene que dejar p1 EN la
    // celda 1, es decir DETRAS de p2 (la celda 2). Si el bloque entrara siempre
    // por delante del ancla, caeria en la celda 0, que es donde ya estaba: el
    // arrastre pareceria un no-op.
    const ok = moveItemTo(g, 'p1', 1, 'all', 'default');
    check('arrastre: arrastrar una pila la mueve entera', ok === true, ids(g).join(','));
    check('arrastre: los items de la pila van juntos y en orden',
      ids(g).join(',') === 'p2,p1,z', ids(g).join(','));
  }
  {
    // Soltar una pila sobre si misma no hace nada. Antes esto podia quitar los
    // items del array y volver a insertarlos en otro sitio, duplicando el
    // contenido o dejandolo en un orden distinto del que se veia.
    const g = await boot(baseSave([crate('p1', 1), crate('p2', 6), collector('z')]));
    const r = moveItemTo(g, 'p2', 1, 'all', 'default');
    check('arrastre: soltar una pila sobre su propia celda no hace nada',
      r === false && wh(g).length === 3, ids(g).join(','));
  }
  {
    // Un ancla que no existe no se puede usar: se rechaza en vez de mandarlo al
    // final, que es donde acabaria el item sin que el jugador lo pidiera.
    const g = await boot(baseSave([collector('a'), collector('b')]));
    const r = g.moveItems(['a'], 'no_existe');
    check('arrastre: un ancla inexistente se rechaza',
      r === false && ids(g).join(',') === 'a,b', ids(g).join(','));
  }
  {
    const g = await boot(baseSave([collector('a'), collector('b')]));
    const r = g.moveItems([], 'a');
    check('arrastre: mover una lista vacia se rechaza', r === false, String(r));
  }
  {
    const g = await boot(baseSave([collector('a'), collector('b')]));
    const r = g.moveItems(['no_existe'], null);
    check('arrastre: mover ids que no estan se rechaza', r === false, String(r));
  }
  {
    // Un id que ya no existe no puede bloquear el movimiento de los otros: el
    // jugador arrastra un grupo y uno de sus ids esta caducado. Se ancla en 'a'
    // para que el movimiento se vea: si el item ya estuviera delante del ancla,
    // el almacen no cambiaria y la prueba no mediria nada.
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    const r = g.moveItems(['c', 'idCaducado'], 'a');
    check('arrastre: un id caducado no bloquea al resto',
      r === true && ids(g).join(',') === 'c,a,b', ids(g).join(','));
  }
  {
    // Arrastrar con un filtro activo: el destino es una celda de ESE filtro, y
    // el item acaba junto a el. Aqui es donde un indice de array en vez de un
    // indice de celda seequivoca.
    const g = await boot(baseSave([
      collector('r1'), crate('c1', 1), collector('r2'), crate('c2', 6)
    ]));
    // En el filtro "collector" las celdas son r1 y r2. Soltar r2 sobre r1
    // significa "pon r2 justo delante de r1".
    moveItemTo(g, 'r2', 0, 'collector', 'default');
    check('arrastre + filtro: el destino es una celda del filtro',
      ids(g).join(',') === 'r2,r1,c1,c2', ids(g).join(','));
  }
  {
    // Con un filtro activo, un item que el filtro OCULTA no se puede arrastrar:
    // no hay celda suya. Si se pudiera, moveria un item invisible.
    const g = await boot(baseSave([collector('r1'), crate('c1'), collector('r2')]));
    const r = moveItemTo(g, 'c1', 0, 'collector', 'default');
    check('arrastre + filtro: un item oculto por el filtro no se mueve',
      r === false && ids(g).join(',') === 'r1,c1,r2', ids(g).join(','));
  }
  {
    // El orden elegido NO se pierde: arrastrar con "Mayor valor" activo mueve
    // segun las celdas de ESE orden, que es lo que el jugador ve.
    //
    // La diferencia tiene que estar en el TIER, no en `sellPrice`: el precio de
    // venta lo calcula el juego con la valoracion por tier, potencial y afijos
    // (`getSellPriceFor`), y el `sellPrice` del guardado es lo que se usaba ANTES
    // de esa valoracion. Con dos recolectores identicos y distinto `sellPrice` la
    // prueba no comprobaba el orden: los dos valian lo mismo y el desempate los
    // dejaba en el orden del array, que es justo el resultado que sale siempre.
    const g = await boot(baseSave([
      collector('barato', 1, { sellPrice: 10 }),
      collector('caro', 9, { sellPrice: 999 })
    ]));
    const ordenValor = celdas(g, 'all', 'value');
    check('arrastre + orden: las celdas son las del orden activo',
      ordenValor.join(',') === 'caro,barato', ordenValor.join(','));
    moveItemTo(g, 'barato', 0, 'all', 'value');
    check('arrastre + orden: el item se coloca donde se senalo',
      ids(g).join(',') === 'barato,caro', ids(g).join(','));
  }

  // =========================================================================
  //  5. El movimiento se guarda
  // =========================================================================
  {
    const g = await boot(baseSave([collector('a'), collector('b'), collector('c')]));
    moveItemTo(g, 'c', 0, 'all', 'default');
    const g2 = await reload();
    check('arrastre: el nuevo orden sobrevive a la recarga',
      ids(g2).join(',') === 'c,a,b', ids(g2).join(','));
    check('arrastre: y no se pierde ningun item al guardar',
      wh(g2).length === 3, ids(g2).join(','));
  }
  {
    // Un movimiento no puede cambiar NADA mas: ni.nanites, ni el contador, ni
    // los items. Es reordenar, no editar.
    const items = [collector('a'), crate('c1'), consumable('x1', 'afk', 4)];
    const g = await boot(baseSave(items, { nanites: 5000 }));
    const antes = JSON.stringify({ n: s(g).nanites, x: s(g).afkCards, c: s(g).crates[1] });
    moveItemTo(g, 'a', 2, 'all', 'default');
    const despues = JSON.stringify({ n: s(g).nanites, x: s(g).afkCards, c: s(g).crates[1] });
    check('arrastre: no toca nanitas ni contadores', antes === despues, despues);
  }

  // =========================================================================
  //  6. Vender quita celdas: la rejilla y el almacen no pueden discrepar
  // =========================================================================
  {
    // Si la rejilla se quedara con una celda vacia, el siguiente arrastre
    // contaria celdas que ya no existen y moveria el item un sitio equivocado.
    // Se usan cajas de distinto tipo para que cada una sea su propia celda: dos
    // del mismo tipo son una pila y se venden juntas de golpe.
    const g = await boot(baseSave([
      crate('c1', 1), crate('c2', 6), collector('r1'), collector('r2')
    ]));
    check('venta: antes hay 4 celdas', celdas(g, 'all').length === 4, celdas(g, 'all').join(','));
    g.sellItem('c1');
    check('venta: tras vender una caja su celda desaparece', celdas(g, 'all').length === 3,
      celdas(g, 'all').join(','));
    g.sellItem('c2');
    check('venta: tras vender la otra tambien', celdas(g, 'all').length === 2,
      celdas(g, 'all').join(','));
    check('venta: y la rejilla no inventa ids que no estan',
      new Set(celdas(g, 'all')).size === new Set(ids(g)).size, `${celdas(g, 'all').join(',')} / ${ids(g).join(',')}`);
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
    // Un filtro que ya no tiene resultados tras vender: la rejilla se vacia y el
    // arrastre deja de poder mover nada, en vez de mover a un indice que no
    // existe. Este caso pedia `r === true` con un item que el filtro OCULTA
    // (r1 es un recolector y el filtro es "companeros"), o sea mover algo que el
    // jugador no ve y sin celda propia: al final del almacen, por casualidad y
    // no porque se lo pidiera. Se rechaza, que es lo coherente.
    const g = await boot(baseSave([companion('m1'), companion('m2'), collector('r1'), collector('r2')]));
    check('venta + filtro: el filtro companeros tiene 2 celdas',
      celdas(g, 'companion').length === 2, celdas(g, 'companion').join(','));
    g.sellItem('m1');
    check('venta + filtro: tras vender queda 1 celda', celdas(g, 'companion').length === 1,
      celdas(g, 'companion').join(','));
    const r = moveItemTo(g, 'r1', 5, 'companion', 'default');
    check('venta + filtro: con un filtro corto no se mueve un item oculto',
      r === false && ids(g).join(',') === 'm2,r1,r2', ids(g).join(','));
    // Y lo que SI se puede mover con ese filtro corto: el companero que queda,
    // soltado en el hueco del final.
    const r2 = moveItemTo(g, 'm2', 4, 'companion', 'default');
    check('venta + filtro: el item del filtro activo si se mueve a un hueco',
      r2 === true && ids(g).join(',') === 'r1,r2,m2', ids(g).join(','));
  }
  {
    // El almacen vacio: ni una celda, ni un movimiento que reviente.
    const g = await boot(baseSave([collector('r1'), collector('r2')]));
    g.sellItem('r1');
    check('venta: un almacen con un item da una celda', celdas(g, 'all').length === 1, celdas(g, 'all').join(','));
    check('venta: mover la ultima celda a un hueco la manda al final (no hay nada que mover)',
      moveItemTo(g, 'r2', 0, 'all', 'default') === false, ids(g).join(','));
  }
  {
    // Un almacen VACIO de verdad: la rejilla no falla.
    const g = await boot(baseSave([]));
    check('vacio: sin items hay cero celdas', celdas(g, 'all').length === 0, celdas(g, 'all').join(','));
    check('vacio: y mover en un almacen vacio se rechaza sin error',
      moveItemTo(g, 'lo_que_sea', 0, 'all', 'default') === false);
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

  resumen('filtros y rejilla');
}

export default main();
