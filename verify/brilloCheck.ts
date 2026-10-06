// ==========================================================================
//  EL BRILLO DE UN ITEM: LA REGLA ENTERA, Y POR QUÉ CADA PARTE ESTÁ ESCRITA
// ==========================================================================
//
//  El brillo es un número del 0 al 4 que sale del potencial, del nivel y del techo
//  de la rareza. Es una función pura: no toca el estado, no depende del reloj y no
//  sabe qué pantalla la está pintando. Eso es lo que permite comprobar **la regla
//  entera**, en vez de mirar una pantalla y|teamar que el brillo "parece" bien.
//
//  Y hay tres cosas que este banco fija porque son las que se rompen solas:
//
//  1. **SUBIR DE NIVEL SIEMPRE SE NOTA.** Con una escala larga, el potencial —que no
//     se toca nunca después de forjar— se comería el brillo entero y el item dejaría de
//     cambiar a mitad de partida. Aquí cada parte aporta como mucho dos, así que el
//     nivel manda mientras sube.
//
//  2. **LA RAREZA PONE EL TECHO.** Un Mítico recién sacado no puede brillar más que un
//     Divino al máximo: si lo hiciera, el techo del juego estaría en la tienda.
//
//  3. **EL EFECTO PROPIO ES EL 4, Y SOLO SE ALCANZA AL TECHO DE NIVEL.** Y es raro a
//     propósito: un Legendario al máximo se queda en 3. Si llegara al 4, el efecto
//     propio sería solo un segundo nombre de "Legendario".
//
//  Este banco no prueba el aspecto. Eso no se puede probar aquí: se mide en el
//  preview. Lo que sí fija es el número del que el aspecto depende.
// ==========================================================================

import { check, resumen } from './kit';
import {
  BRILLO_MAXIMO, TOPO_POR_RAREZA, topeDeBrillo,
  brilloDeItem, tieneEfectoPropio, etiquetaDeBrillo
} from '../src/data/brillo';
import { potencialNormalizado, collectorMaxLevel, nivelMaximoDeCompanio } from '../src/data/crafting';
import { RARITY_RANK } from '../src/components/crateLoot';

/** Un recolector de ejemplo con lo que el brillo mira. */
function rec(over: any = {}) {
  return {
    type: 'collector',
    rarity: 'Raro',
    potential: 3,
    level: 0,
    maxLevel: collectorMaxLevel(null),
    ...over,
  };
}

function comp(over: any = {}) {
  return {
    type: 'companion',
    rarity: 'Raro',
    potential: 3,
    level: 0,
    maxLevel: nivelMaximoDeCompanio(3),
    ...over,
  };
}

async function main() {
  // -------------------------------------------------------------------------
  //  1. LA ESCALA ENTERA, Y QUE NO SE SALE
  // -------------------------------------------------------------------------
  {
    check('brillo: el maximo es 4, que es el numero del efecto propio',
      BRILLO_MAXIMO === 4, 'BRILLO_MAXIMO=' + BRILLO_MAXIMO);

    // **NUNCA FUERA DE RANGO, CON CUALQUIER DATO.** Se prueban los que de verdad
    // llegan: un item de tienda sin nivel, uno con un nivel por encima del techo y
    // uno con basura donde deberia ir un numero. Un brillo de 7 o de -1 se pinta
    // como algo que no existe.
    const destrames = [
      ['sin nivel', rec({ level: undefined })],
      ['nivel por encima del techo', rec({ level: 9999, maxLevel: 20 })],
      ['nivel negativo', rec({ level: -5 })],
      ['potencial basura', rec({ potential: 'mucho' })],
      ['potencial 0', rec({ potential: 0 })],
      ['potencial 99', rec({ potential: 99 })],
      ['nivel en texto', rec({ level: 'diez' })],
      ['rareza inventada', rec({ rarity: 'Mitica' })],
      ['sin rareza', rec({ rarity: undefined })],
      ['sin nada', {}],
      ['nulo', null],
      ['companero sin nivel', comp({ level: undefined })],
      ['material de forja, que no tiene nivel', { type: 'material', rarity: 'Raro', potential: 5 }],
    ] as Array<[string, any]>;

    const fuera = destrames.filter(([, w]) => {
      const b = brilloDeItem(w);
      return !Number.isInteger(b) || b < 0 || b > BRILLO_MAXIMO;
    });
    check('brillo: ni un dato raro saca el brillo de 0 a 4',
      fuera.length === 0,
      fuera.map(([n, w]) => n + '=' + brilloDeItem(w)).join(', ') || 'los 13 dentro');
  }

  // -------------------------------------------------------------------------
  //  2. SUBIR DE NIVEL SIEMPRE SE NOTA, Y ESO ES UNA REGLA
  // -------------------------------------------------------------------------
  {
    // **LA PRUEBA DE FUERA, LA IMPORTANTE.** Con el potencial quieto, recorrer los
    // niveles no puede quedarse quieto: cada escalon tiene que verse. Si el brillo
    // se quedara igual entre el 40% y el 50%, habria un tramo entero de partida en
    // el que subir nivel no se ve, que es justo lo que el jugador sube a mirar.
    let quieto = '';
    const potencialFijo = 4;
    const techo = collectorMaxLevel(null);
    // **UN DIVINO, Y NO EL RECOLECTOR DE EJEMPLO.** El deejemplo es un Raro, que
    // topea en 2: con el tope puesto midiendo el nivel no se veria nada, porque
    // pot4 y nivel tope ya estan en el techo de la rareza. Para medir el nivel hace
    // falta un item cuyo tope de rareza no lo recorte, y el unico que llega a 4 es el
    // Divino. Con cualquier otro, estas dos pruebas darian verde con la regla rota.
    const raro = { rarity: 'Divino' } as const;
    let anterior = brilloDeItem(rec({ ...raro, potential: potencialFijo, level: 0 }));
    for (let nivel = 1; nivel <= techo; nivel++) {
      const b = brilloDeItem(rec({ ...raro, potential: potencialFijo, level: nivel }));
      if (b < anterior) quieto = 'baja en ' + nivel + ' (' + anterior + '->' + b + ')';
      anterior = b;
    }
    check('brillo: subir nivel nunca baja el brillo',
      quieto === '', quieto || 'recorrido 0..' + techo + ' sin bajar');

    // Y que de verdad suba: no basta con que no baje.
    const bajo = brilloDeItem(rec({ ...raro, potential: potencialFijo, level: 0 }));
    const medio = brilloDeItem(rec({ ...raro, potential: potencialFijo, level: Math.round(techo * 0.6) }));
    const tope = brilloDeItem(rec({ ...raro, potential: potencialFijo, level: techo }));
    check('brillo: y subir de verdad lo sube',
      bajo < medio && medio < tope,
      'nivel0=' + bajo + ' nivel60%=' + medio + ' tope=' + tope);
  }

  // -------------------------------------------------------------------------
  //  3. EL POTENCIAL APORTA, Y EL MEDIO NO
  // -------------------------------------------------------------------------
  {
    const techo = collectorMaxLevel(null);
    const porPotencial = [1, 2, 3, 4, 5].map(
      p => p + '=' + brilloDeItem(rec({ rarity: 'Divino', potential: p, level: techo }))
    );
    check('brillo: el potencial 1 y 2 no dan nada, porque el medio no paga',
      brilloDeItem(rec({ rarity: 'Divino', potential: 1, level: techo }))
        === brilloDeItem(rec({ rarity: 'Divino', potential: 2, level: techo })),
      porPotencial.join(' '));

    check('brillo: y del 3 para arriba el potencial sube el brillo',
      brilloDeItem(rec({ rarity: 'Divino', potential: 3, level: techo }))
        < brilloDeItem(rec({ rarity: 'Divino', potential: 4, level: techo }))
        && brilloDeItem(rec({ rarity: 'Divino', potential: 4, level: techo }))
          === brilloDeItem(rec({ rarity: 'Divino', potential: 5, level: techo })),
      porPotencial.join(' '));

    check('brillo: y el potencial normalizado es el que usa, no el guardado en crudo',
      brilloDeItem(rec({ rarity: 'Divino', potential: '4', level: techo }))
        === brilloDeItem(rec({ rarity: 'Divino', potential: 4, level: techo }))
        && brilloDeItem(rec({ rarity: 'Divino', potential: 0, level: techo }))
          === brilloDeItem(rec({ rarity: 'Divino', potential: 3, level: techo })),
      'texto4=' + brilloDeItem(rec({ rarity: 'Divino', potential: '4', level: techo }))
        + ' cero=' + brilloDeItem(rec({ rarity: 'Divino', potential: 0, level: techo })));

    check('brillo: y el potencial que usa es el normalizado del juego, no el suyo',
      potencialNormalizado(0) === 3 && potencialNormalizado(99) === 3,
      '0->' + potencialNormalizado(0) + ' 99->' + potencialNormalizado(99));
  }

  // -------------------------------------------------------------------------
  //  4. LA RAREZA PONE EL TECHO, Y UNO DESCONOCIDO CAE AL SUELO
  // -------------------------------------------------------------------------
  {
    const techo = collectorMaxLevel(null);
    const conTopeAlto = rec({ rarity: 'Divino', potential: 5, level: techo });
    const conTopeBajo = rec({ rarity: 'Raro', potential: 5, level: techo });

    check('brillo: un Raro al maximo no puede brillar como un Divino al maximo',
      brilloDeItem(conTopeBajo) < brilloDeItem(conTopeAlto),
      'raro=' + brilloDeItem(conTopeBajo) + ' divino=' + brilloDeItem(conTopeAlto));

    check('brillo: cada rareza sin tope nunca supera el suyo',
      Object.entries(TOPO_POR_RAREZA).every(([rareza, tope]) => {
        const b = brilloDeItem(rec({ rarity: rareza, potential: 5, level: techo }));
        return b <= tope;
      }),
      Object.entries(TOPO_POR_RAREZA)
        .map(([r, t]) => r + ' tope' + t + ' brilla' + brilloDeItem(rec({ rarity: r, potential: 5, level: techo })))
        .join(' | '));

    check('brillo: y los topes no son un numero inventado, van con el rango de rareza',
      Object.entries(TOPO_POR_RAREZA).every(([rareza, tope]) => tope >= 1 && tope <= BRILLO_MAXIMO)
        && Object.keys(TOPO_POR_RAREZA).length === Object.keys(RARITY_RANK).length,
      'topes=' + Object.keys(TOPO_POR_RAREZA).length
        + ' rarezas=' + Object.keys(RARITY_RANK).length);

    // **UNA RAREZA CON ACENTOS Y OTRA SIN ELLOS SON LA MISMA.** El nombre sale de
    // datos guardados y de generadores distintos, y "Mitica" sin tilde no puede
    // quedarse sin brillo mientras "Mítica" con tilde si lo tiene.
    check('brillo: la rareza se lee igual con tilde que sin tilde',
      topeDeBrillo('Mitica') === topeDeBrillo('Mítica')
        && topeDeBrillo('mitica') === topeDeBrillo('Mítica')
        && topeDeBrillo('EPICO') === topeDeBrillo('Épico'),
      'Mitica=' + topeDeBrillo('Mitica') + ' mitica=' + topeDeBrillo('mitica')
        + ' EPICO=' + topeDeBrillo('EPICO'));

    check('brillo: una rareza que no existe cae al suelo, que es el fallo que no se nota',
      topeDeBrillo('Rarisima') === topeDeBrillo('Común')
        && topeDeBrillo(undefined) === topeDeBrillo('Común')
        && topeDeBrillo('') === topeDeBrillo('Común'),
      'inventada=' + topeDeBrillo('Rarisima'));
  }

  // -------------------------------------------------------------------------
  //  5. EL EFECTO PROPIO: SOLO AL TECHO, Y RARO
  // -------------------------------------------------------------------------
  {
    const techoRecolector = collectorMaxLevel(null);

    check('brillo: un Divino al maximo de nivel y potencial si lleva el efecto propio',
      tieneEfectoPropio(rec({ rarity: 'Divino', potential: 5, level: techoRecolector })),
      'divino5tope=' + brilloDeItem(rec({ rarity: 'Divino', potential: 5, level: techoRecolector })));

    // **LO QUE NO LLEGA AL EFECTO PROPIO, Y CADA MOTOR POR SEPARADO.** Falta un nivel o
    // falta potencial: son dos formas distintas de no llegar, y por eso se comprueban
    // las dos. Un Divino con potencial 5 y un nivel menos se queda en 3; un Divino con
    // potencial 2 ni siquiera con el tope llega.
    check('brillo: al efecto propio se llega por las dos partes, y sin una no se llega',
      !tieneEfectoPropio(rec({ rarity: 'Divino', potential: 5, level: techoRecolector - 1 }))
        && !tieneEfectoPropio(rec({ rarity: 'Divino', potential: 2, level: techoRecolector }))
        && !tieneEfectoPropio(rec({ rarity: 'Mítico', potential: 2, level: techoRecolector })),
      'divino5 casiTope=' + brilloDeItem(rec({ rarity: 'Divino', potential: 5, level: techoRecolector - 1 }))
        + ' divino2 tope=' + brilloDeItem(rec({ rarity: 'Divino', potential: 2, level: techoRecolector })));

    // **EL MÍTICO SÍ LLEGA, Y ES LO QUE DICE EL DISEÑO.** Divino y Mítico topean en 4
    // a propósito: el efecto propio no es de una sola rareza, es de las dos últimas. La
    // primera vez esta prueba decía que el Mítico no debía llegar, que era yo escribiendo
    // el comentario de al lado ("hace falta un Divino o un Mítico") y la aserción al revés
    // — las dos cosas no pueden mandar, y el código tenía razón y la prueba no.
    check('brillo: las dos rarezas mas altas pueden llevar el efecto propio',
      tieneEfectoPropio(rec({ rarity: 'Mítico', potential: 4, level: techoRecolector })),
      'mitico4=' + brilloDeItem(rec({ rarity: 'Mítico', potential: 4, level: techoRecolector })));

    // **UN LEGENDARIO AL MÁXIMO NO LLEGA.** Si llegara, el efecto propio sería solo
    // otro nombre de "Legendario", y dejaría de ser un efecto.
    check('brillo: un Legendario al maximo se queda en 3, y el efecto propio es raro a proposito',
      brilloDeItem(rec({ rarity: 'Legendario', potential: 5, level: techoRecolector })) === 3
        && !tieneEfectoPropio(rec({ rarity: 'Legendario', potential: 5, level: techoRecolector })),
      'legendario=' + brilloDeItem(rec({ rarity: 'Legendario', potential: 5, level: techoRecolector })));

    check('brillo: y un material de forja no lleva nunca el efecto propio',
      !tieneEfectoPropio({ type: 'material', rarity: 'Divino', potential: 5, level: 99 }),
      'material=' + brilloDeItem({ type: 'material', rarity: 'Divino', potential: 5, level: 99 }));

    // **LA PREGUNTA NO ES UNA COMPARACIÓN ESCRITA EN LA VISTA.** Por eso existe
    // `tieneEfectoPropio()`: si las tres pantallas compararan con el `4` a mano, el día
    // que el máximo subiera a 5 dos de ellas se quedarían atrás.
    check('brillo: el efecto propio se pregunta, no se compara con el numero en la vista',
      tieneEfectoPropio(rec({ rarity: 'Divino', potential: 5, level: techoRecolector }))
        === (brilloDeItem(rec({ rarity: 'Divino', potential: 5, level: techoRecolector })) >= BRILLO_MAXIMO),
      'pregunta=' + tieneEfectoPropio(rec({ rarity: 'Divino', potential: 5, level: techoRecolector })));
  }

  // -------------------------------------------------------------------------
  //  6. EL COMPAÑERO SIGUE SU PROPIA REGLA DE TECHO
  // -------------------------------------------------------------------------
  {
    // **EL TECHO DEL COMPAÑERO NO ES EL DEL RECOLECTOR, Y USAR EL EQUIVOCADO HACE
    // QUE BRILLE ANTES DE TIEMPO.** Un compañero tiene su propio `maxLevel`; si se le
    // pidiera al recolector, un compañero corto llegaria "al tope" con la mitad de los
    // niveles y el brillo diria una cosa que no es.
    const c = comp({ rarity: 'Divino', potential: 5 });
    const techo = c.maxLevel as number;
    check('brillo: el companero usa su propio techo de nivel',
      techo !== collectorMaxLevel(null),
      'companero=' + techo + ' recolector=' + collectorMaxLevel(null));

    check('brillo: y con el suyo llega al efecto propio justo en su tope',
      tieneEfectoPropio(comp({ rarity: 'Divino', potential: 5, level: techo }))
        && !tieneEfectoPropio(comp({ rarity: 'Divino', potential: 5, level: techo - 1 })),
      'tope=' + brilloDeItem(comp({ rarity: 'Divino', potential: 5, level: techo }))
        + ' casiTope=' + brilloDeItem(comp({ rarity: 'Divino', potential: 5, level: techo - 1 })));

    // Con el techo equivocado el mismo nivel brillaría de más, y esta es la
    // comprobación que lo dice por escrito.
    const conTechoAjeno = { ...comp({ rarity: 'Divino', potential: 5, level: techo - 1 }), maxLevel: collectorMaxLevel(null) };
    check('brillo: y con el techo del recolector brillaria antes de tiempo, que es el fallo',
      brilloDeItem(conTechoAjeno) > brilloDeItem(comp({ rarity: 'Divino', potential: 5, level: techo - 1 })),
      'ajeno=' + brilloDeItem(conTechoAjeno) + ' suyo=' + brilloDeItem(comp({ rarity: 'Divino', potential: 5, level: techo - 1 })));
  }

  // -------------------------------------------------------------------------
  //  7. LA ETIQUETA, Y QUE NO Mienta NI SE ROMPA
  // -------------------------------------------------------------------------
  {
    check('brillo: la etiqueta del maximo no es un numero como los demas',
      etiquetaDeBrillo(BRILLO_MAXIMO) === 'Brillo máximo'
        && etiquetaDeBrillo(0) === 'Sin brillo',
      'max=' + etiquetaDeBrillo(BRILLO_MAXIMO) + ' cero=' + etiquetaDeBrillo(0));

    check('brillo: y en medio si lleva el numero, y el denominador para saber cuanto queda',
      etiquetaDeBrillo(2) === 'Brillo 2 de ' + BRILLO_MAXIMO,
      'dos=' + etiquetaDeBrillo(2));

    // **LA ETIQUETA RECORTA, IGUAL QUE EL NÚMERO.** Si el texto se acorta y el numero
    // no, el tooltip diría "Brillo 3 de 4" y no cuadraría con el brillo.
    const raros: Array<[number, string]> = [[-3, ''], [99, ''], [NaN, ''], [2.7, '']];
    const recorte = raros.every(([b]) => etiquetaDeBrillo(b) === etiquetaDeBrillo(b > BRILLO_MAXIMO ? BRILLO_MAXIMO : b < 0 ? 0 : b));
    check('brillo: y un brillo imposible se recorta igual que el numero',
      recorte,
      raros.map(([b]) => b + '->' + etiquetaDeBrillo(b)).join(' '));
  }

  // -------------------------------------------------------------------------
  //  8. QUE LA REGLA SEA PURA
  // -------------------------------------------------------------------------
  {
    // **UNA FUNCIÓN QUE DEPENDE DEL RELOJ ES UNA FUNCIÓN QUE MIENTE AL REPETIR.** Se
    // llama veinte veces con el mismo item y tiene que dar el mismo número: si
    // metiera `Date.now()` o un aleatorio dentro, el brillo parpadearia cada vez que
    // se repinta la rejilla, y sería el peor bug posible —uno que solo se ve mirando.
    const item = rec({ rarity: 'Épico', potential: 4, level: 12 });
    const primera = brilloDeItem(item);
    let estable = true;
    for (let i = 0; i < 20; i++) {
      if (brilloDeItem(item) !== primera) estable = false;
    }
    check('brillo: el mismo item da el mismo brillo veinte veces seguidas',
      estable, 'primera=' + primera + ' ahora=' + brilloDeItem(item));

    check('brillo: y no le importa si el item es el mismo objeto o una copia',
      brilloDeItem(rec({ rarity: 'Épico', potential: 4, level: 12 })) === primera,
      'copia=' + brilloDeItem(rec({ rarity: 'Épico', potential: 4, level: 12 })));
  }

  resumen('brillo');
}

export default main();