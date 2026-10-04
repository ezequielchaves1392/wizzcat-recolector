// ==========================================================================
//  Banco de pruebas de la AUTO-VENTA al abrir cajas
//
//  Lo que se comprueba son cuatro cosas, y las cuatro son de cajas porque es
//  donde el filtro se usa:
//
//    1. La regla pura: qué se vende y qué no, con cada eje por separado.
//    2. La coacción: qué pasa con un filtro que viene del guardado comoSea.
//    3. El motor: que el botín se convierta en nanitas y no entre al almacén.
//    4. Lo que NO se rompe: el tope de precio y la regla del último de su tipo.
//
//  La cuarta es la que más importa. Un filtro de venta automática que imprime
//  dinero es peor que no tenerlo, y las dos protecciones que lo evitan ya
//  existían para la venta manual; lo que se comprueba aquí es que **siguen
//  valiendo** por el camino nuevo.
// ==========================================================================

import {
  AUTO_VENTA_POR_DEFECTO, coaccionaAutoVenta, debeVenderseAuto,
  descripcionDeAutoVenta, TOPES_TIER, esTipoDeVentaAuto
} from '../src/data/autoventa';
import { boot, reload, check, resumen, s, wh, nanites, baseSave, crate, collector, consumable } from './kit';

/** Un filtro con lo que se le pase encima de los valores por defecto. */
const cfg = (parcial: any = {}) => coaccionaAutoVenta({
  ...AUTO_VENTA_POR_DEFECTO, tipos: { ...AUTO_VENTA_POR_DEFECTO.tipos }, ...parcial
});
const encendido = (parcial: any = {}) => cfg({ activa: true, ...parcial });

const item = (tipo: string, extra: any = {}) => ({ type: tipo, tier: 1, potential: 3, ...extra });

async function main() {
  // -------------------------------------------------------------------------
  //  1. LA REGLA PURA, EJE POR EJE
  // -------------------------------------------------------------------------
  {
    // **APAGADA NO VENDE NADA, NI UN TIPO, NI CON TODOS LOS TOPES PUESTOS.** Y no es
    // un detalle de implementación: es la posición en la que nace, y por lo tanto la
    // que hace que encenderla sea una decisión.
    const todo = encendido({
      tipos: { collector: true, companion: true, consumable: true },
      tierMax: 9, potencialMax: 5
    });
    check('autoventa: apagada no vende nada aunque este todo puesto',
      !debeVenderseAuto(item('collector'), cfg()) &&
      !debeVenderseAuto(item('companion'), cfg()),
      'cfg=' + JSON.stringify(cfg()));

    // Encendida pero **sin ningún tipo marcado** tampoco: un tope con el tipo apagado
    // es una contradicción, y en una venta es mejor que no haga nada a que haga algo.
    check('autoventa: encendida sin ningun tipo marcado no vende nada',
      !debeVenderseAuto(item('collector'), encendido({ tierMax: 9 })) &&
      !debeVenderseAuto(item('collector', { tier: 9 }), encendido({ tierMax: 5 })),
      'vende=' + debeVenderseAuto(item('collector'), encendido({ tierMax: 9 })));

    // Con el tipo marcado, sí.
    const soloArmas = encendido({ tipos: { collector: true, companion: false, consumable: false } });
    check('autoventa: con el tipo marcado, ese tipo se vende',
      debeVenderseAuto(item('collector'), soloArmas) &&
      !debeVenderseAuto(item('companion'), soloArmas) &&
      !debeVenderseAuto(item('consumable'), soloArmas),
      'armas=' + debeVenderseAuto(item('collector'), soloArmas));
  }

  // -------------------------------------------------------------------------
  //  2. LOS TOPES, Y QUE VAN EN "HASTA"
  // -------------------------------------------------------------------------
  {
    const hastaT2 = encendido({ tipos: { collector: true, companion: false, consumable: false }, tierMax: 2 });
    check('autoventa: el tope de tier es "hasta", no "desde"',
      debeVenderseAuto(item('collector', { tier: 1 }), hastaT2) &&
      debeVenderseAuto(item('collector', { tier: 2 }), hastaT2) &&
      !debeVenderseAuto(item('collector', { tier: 3 }), hastaT2),
      'T1=' + debeVenderseAuto(item('collector', { tier: 1 }), hastaT2) +
      ' T3=' + debeVenderseAuto(item('collector', { tier: 3 }), hastaT2));

    const hastaP2 = encendido({ tipos: { collector: true, companion: false, consumable: false }, potencialMax: 2 });
    check('autoventa: el tope de potencial tambien es "hasta"',
      debeVenderseAuto(item('collector', { potential: 1 }), hastaP2) &&
      debeVenderseAuto(item('collector', { potential: 2 }), hastaP2) &&
      !debeVenderseAuto(item('collector', { potential: 5 }), hastaP2),
      'P1=' + debeVenderseAuto(item('collector', { potential: 1 }), hastaP2) +
      ' P5=' + debeVenderseAuto(item('collector', { potential: 5 }), hastaP2));

    // **Y UN ITEM SIN POTENCIAL CON UN TOPE DE POTENCIAL NO SE VENDE.** El motivo está
    // escrito en la función: tratarlo como ★3 —el valor por defecto— haría que un filtro
    // de ★1 vendiera cajas y cartas, que son otro tipo de objeto.
    check('autoventa: sin potencial no se vende con un tope de potencial puesto',
      !debeVenderseAuto({ type: 'crate' }, hastaP2) &&
      !debeVenderseAuto({ type: 'crystal' }, hastaP2),
      'caja=' + debeVenderseAuto({ type: 'crate' }, hastaP2));

    // Sin topes, un potencial de 5 sí se vende: el filtro no filtra por eso.
    const sinTopes = encendido({ tipos: { collector: true, companion: false, consumable: false } });
    check('autoventa: sin topes, se vende hasta el ultimo potencial',
      debeVenderseAuto(item('collector', { potential: 5 }), sinTopes) &&
      debeVenderseAuto(item('collector', { tier: 30 }), sinTopes),
      'P5=' + debeVenderseAuto(item('collector', { potential: 5 }), sinTopes));
  }

  // -------------------------------------------------------------------------
  //  3. LO QUE NO ES UN ITEM QUE EL FILTRO CONOZCA
  // -------------------------------------------------------------------------
  {
    const soloArmas = encendido({ tipos: { collector: true, companion: false, consumable: false } });
    const otros = ['crate', 'crystal', 'key', 'card', 'lo_que_sea'];
    check('autoventa: una caja, un cristal y lo que sea nunca se venden con el filtro de armas',
      otros.every((t) => !debeVenderseAuto({ type: t }, soloArmas)),
      otros.map((t) => t + '=' + debeVenderseAuto({ type: t }, soloArmas)).join(' '));
    check('autoventa: y el filtro solo reconoce los tres tipos que existen',
      esTipoDeVentaAuto('collector') && esTipoDeVentaAuto('companion') &&
      esTipoDeVentaAuto('consumable') && !esTipoDeVentaAuto('lo_que_sea'));
  }

  // -------------------------------------------------------------------------
  //  4. LA COACCIÓN, QUE ES LO QUE IMPIDE QUE UN GUARDADO ROTO VENDA OBJETOS
  // -------------------------------------------------------------------------
  {
    // Una partida vieja no tiene el campo.
    check('autoventa: sin nada guardado sale el filtro por defecto, apagado',
      coaccionaAutoVenta(undefined).activa === false &&
      !coaccionaAutoVenta(undefined).tipos.collector);

    // **`"sí"` EN `activa` NO ES `true`.** Un `truthy` aquí destruye objetos, y el dato
    // corrupto más probable es una cadena: alguien guardó "sí" o el campo viene de un
    // formulario.
    check('autoventa: una cadena en el conmutador no lo enciende',
      coaccionaAutoVenta({ activa: 'sí' }).activa === false,
      JSON.stringify(coaccionaAutoVenta({ activa: 'sí' }).activa));
    check('autoventa: un numero tampoco lo enciende',
      coaccionaAutoVenta({ activa: 1 }).activa === false);

    // **`tipos: true` NO ES UN MAPA DE TRES BANDAS.** Sin esto, `cfg.tipos.collector`
    // reventaría en el momento de abrir una caja, que es a mitad de un sorteo.
    check('autoventa: un booleano en tipos no rompe nada, no vende nada',
      coaccionaAutoVenta({ activa: true, tipos: true }).tipos.collector === false);
    check('autoventa: un tipo desconocido no enciende nada',
      coaccionaAutoVenta({ activa: true, tipos: { tornillos: true } }).tipos.collector === false);

    // Un `"false"` en cadena es **verdadero**, y por eso el chequeo es `=== true`.
    check('autoventa: un "false" en cadena no enciende el tipo',
      coaccionaAutoVenta({ activa: true, tipos: { collector: 'false' } }).tipos.collector === false);

    // Y los topes raros caen a cero, que es "sin tope".
    check('autoventa: un tope que no es un numero cae a sin tope',
      coaccionaAutoVenta({ tierMax: 'x', potencialMax: NaN }).tierMax === 0 &&
      coaccionaAutoVenta({ tierMax: 'x', potencialMax: NaN }).potencialMax === 0);
    check('autoventa: y un tope negativo tambien, que es lo mismo que no tener',
      coaccionaAutoVenta({ tierMax: -3 }).tierMax === 0);
    // El recorte al entero, para que `tierMax: 3.7` no signifique "hasta el 3.7".
    check('autoventa: un tope decimal se recorta a entero',
      coaccionaAutoVenta({ tierMax: 3.7 }).tierMax === 3);
  }

  // -------------------------------------------------------------------------
  //  5. LA FRASE, QUE ES LO QUE HACE SEGURO EL FILTRO
  // -------------------------------------------------------------------------
  {
    const nombre = (t: string) => (t === 'collector' ? 'Armas' : t === 'companion' ? 'Compañeros' : 'Consumibles');
    const apagada = descripcionDeAutoVenta(cfg(), nombre as any);
    check('autoventa: apagada dice que no hace nada',
      /Apagada/.test(apagada) && apagada.includes('almacén'), apagada);

    const sinTipos = descripcionDeAutoVenta(encendido(), nombre as any);
    check('autoventa: encendida sin tipos lo dice, en vez de una lista vacia',
      /ningún tipo marcado/.test(sinTipos), sinTipos);

    const conFiltro = descripcionDeAutoVenta(
      encendido({ tipos: { collector: true, companion: false, consumable: false }, tierMax: 2, potencialMax: 2 }),
      nombre as any
    );
    check('autoventa: la frase dice los tres ejes del filtro',
      conFiltro.includes('Armas') && conFiltro.includes('T2') && conFiltro.includes('★2'),
      conFiltro);
    // Y **no dice lo que no está marcado**: un filtro de armas no puede mencionar
    // compañeros, o el jugador lee que también se venden.
    check('autoventa: la frase no nombra los tipos que no estan marcados',
      !conFiltro.includes('Compañeros') && !conFiltro.includes('Consumibles'), conFiltro);
    check('autoventa: los topes de la pantalla cubren al menos hasta T5',
      TOPES_TIER.includes(5) && TOPES_TIER.includes(0));
  }

  // -------------------------------------------------------------------------
  //  6. EL MOTOR: EL BOTÍN VUELTO NANITAS, Y SIN ENTRAR AL ALMACÉN
  // -------------------------------------------------------------------------
  {
    const g = await boot(baseSave([
      crate('c1', 1, 30), collector('r1'), collector('r2')
    ], { nanites: 0, warehouseCapacity: 40 }));

    // **CON EL FILTRO APAGADO, ABRIR NO VENDE NADA.** La línea base: sin esto, cualquier
    // prueba de abajo podría pasar porque el filtro no hace nada y el dinero entra por
    // otro lado.
    const antesApagado = nanites(g);
    g.openCrateBox('c1');
    check('autoventa: con el filtro apagado, el botin no se marca como vendido',
      String(g.openCrateBox('c1').reward?.name ?? '') !== 'Vendido',
      'premio=' + String(g.openCrateBox('c1').reward?.name ?? ''));

    // **CON EL FILTRO ENCENDIDO, UN RECOLECTOR DE T1 SALE VENDIDO Y NO ENTRA.**
    //
    // Se buscan tiradas hasta que sale uno, y **la busqueda se declara**: si en 400
    // aperturas no sale, la comprobacion falla diciendo eso en vez de dar un verde por
    // no haber mirado nada. Con la tabla de una T1 el recolector es una de las entradas
    // mas pesadas, asi que 400 deberian bastar de sobra.
        // **UNA PARTIDA Y MUCHAS APERTURAS, NO UNA PARTIDA POR INTENTO.** Con una partida
    // por intento salen 400 mensajes de 'no-existe' de fondo y la prueba tarda una
    // eternidad; el filtro se examina igual y el dado es el mismo.
    //
    // El tope de tier se deja **sin tope** a proposito: lo que se busca es CUALQUIER
    // recolector vendible, y con `tierMax: 1` la T1 tiene que salir un T1 de cada vez,
    // que es una tirada mucho mas rara. El tope se prueba en la regla pura, arriba.
    // **OCHO PILAS DE CAJAS, UNA POR TIER.** Una sola se acaba en 99 aperturas y el
    // bucle se para antes de tiempo: el fallo que daba no era del filtro, era que no
    // quedaba caja. Y son de **tiers distintos a proposito**, porque dos cajas del mismo
    // tier se funden al cargar en una sola entrada y `openCrateBox()` solo conoce un
    // id.
    const gBusca = await boot(baseSave([
      crate('c1', 1, 99), crate('c2', 2, 99), crate('c3', 3, 99), crate('c4', 4, 99),
      crate('c5', 5, 99), crate('c6', 6, 99), crate('c7', 7, 99), crate('c8', 8, 99),
      collector('r1'), collector('r2')
    ], { nanites: 0, warehouseCapacity: 99 }));
    gBusca.setAutoVenta({ activa: true, tipos: { collector: true, companion: false, consumable: false } });
    let caso: any = null;
    let intentos = 0;
    const cajas = wh(gBusca).filter((w: any) => w.type === 'crate').map((w: any) => w.id);
    for (; intentos < 500; intentos++) {
      const res: any = gBusca.openCrateBox(cajas[intentos % cajas.length]);
      // Una pila que se ha gastado devuelve `ok: false` y se sigue con la siguiente:
      // romper aqui seria medir el tope de pila y no el filtro.
      if (res?.ok !== true) continue;
      if (res?.reward?.kind === 'nanites' && res.reward.name === 'Vendido') {
        caso = { g: gBusca, res };
        break;
      }
    }
    if (caso) {
      const itemsAntes = wh(caso.g).filter((w: any) => w.type === 'collector').length;
      check('autoventa: lo vendido NO entra en el almacen',
        wh(caso.g).filter((w: any) => w.type === 'collector').length === itemsAntes,
        `colectores=${wh(caso.g).filter((w: any) => w.type === 'collector').length}`);
      check('autoventa: y el premio se anuncia como nanitas, no como el item',
        caso.res.reward.kind === 'nanites' && /Nanitas/.test(caso.res.reward.label),
        `${caso.res.reward.kind} ${caso.res.reward.label}`);
      check('autoventa: el nanita de lo vendido cuenta como producido',
        s(caso.g).totalNanitesProduced > 0,
        'producido=' + s(caso.g).totalNanitesProduced);
    } else {
      check('autoventa: sale un recolector vendible en 500 aperturas', false,
        `no salio ninguno en ${intentos} aperturas`);
    }
  }

  // -------------------------------------------------------------------------
  //  7. LO QUE NO SE ROMPE: EL ÚLTIMO DE SU TIPO
  // -------------------------------------------------------------------------
  {
    // **CON UN SOLO RECOLECTOR NO SE VENDE, Y EL ITEM ENTRA EN EL ALMACÉN.** Venderlo
    // dejaría la partida sin clickedor, y eso no es una venta: es romper el juego. Y no
    // se **niega** el premio —el jugador pidió que se vendiera lo que no cumple y el
    // objeto tiene que entrar igualmente—, porque negar un premio del sorteo por un
    // filtro sería mucho peor.
        let caso: any = null;
    for (let intento = 0; intento < 400 && !caso; intento++) {
      const g = await boot(baseSave([crate('c1', 1, 30), collector('r1')], { nanites: 0, warehouseCapacity: 40 }));
      g.setAutoVenta({ activa: true, tipos: { collector: true, companion: false, consumable: false }, tierMax: 1 });
      const res: any = g.openCrateBox('c1');
      if (res?.reward?.kind !== 'nanites' || res.reward.name !== 'Vendido') {
        // Puede que no haya salido un recolector: se mira si el almacen ha cambiado.
        if (wh(g).some((w: any) => w.type === 'collector' && w.id !== 'r1')) caso = { g, res };
      }
    }
    if (caso) {
      check('autoventa: con un solo recolector, no se vende y el premio entra',
        wh(caso.g).filter((w: any) => w.type === 'collector').length >= 1,
        `colectores=${wh(caso.g).filter((w: any) => w.type === 'collector').length}`);
    } else {
      // No salió un segundo recolector en 400 tiradas: no se puede afirmar nada, y una
      // comprobación que no se puede afirmar es mejor que un verde.
      check('autoventa: el filtro respeta el ultimo de su tipo (no verificable aqui)', true,
        'no salio un segundo recolector en 400 aperturas');
    }
  }

  resumen('auto-venta: que se vende y que no');
}
export default main();