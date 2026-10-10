// ==========================================================================
//  Banco de pruebas del USO DE CONSUMIBLES
//
//  `useConsumable` es la operacion con mas condiciones de una sola vez: el item
//  tiene que ser del tipo correcto, su `buffId` tiene que ser conocido, el
//  efecto se aplica ANTES de gastar, y hay topes (capacidad 600 por tipo, AFK 3 tarjetas,
//  buffs con duracion maxima) que se calculan sobre lo que ya habia.
//
//  Los tres fallos que esto evita:
//
//  1. GASTAR SIN APLICAR. Si el item se consumiera antes de resolver el efecto,
//     un fallo (por ejemplo, almacen al maximo) se llevaria el item sin dar nada.
//     La regla es: primero el efecto, y solo si ha salido bien, el gasto.
//  2. APLICAR SIN GASTAR. El buff se aplica y el item se queda, y el jugador
//     puede reutilizarlo indefinidamente.
//  3. ROMPER EL TOPE. Sin tope, 20 tarjetas de AFK darian 200 minutos de AFK y
//     el ingreso pasivo se podria acumular sin limite.
//
//  Se comprueba tambien el otro camino: algunos consumibles NO se usan desde el
//  almacen (Piedra de Calibracion y Nanoparticula son de la Forja). Si el
//  almacen las aceptara, el jugador las gastaria en el sitio equivocado.
// ==========================================================================

import { AFK_CARD_DURATION_MS } from '../src/gameLoop';
import {
  EXPANSOR_TIERS, CONSUMABLES, RANURAS_POR_EXPANSOR, WAREHOUSE_BASE_CAP, WAREHOUSE_MAX_CAP,
  RANURAS_BARRA, techoDeExpansor
} from '../src/data/store';
import { totalConcedidoDe, BUFF_LABELS, type BuffKey } from '../src/data/buffs';
import { buffLabel } from '../src/ui/buffHud';
import { unidadesDeBuff, matchesFilter } from '../src/components/warehouse';
import {
  successChance, piedrasParaObjetivo, MAX_PIEDRAS_POR_FUSION, PIEDRA_PUNTOS,
  poderDeCompanero
} from '../src/data/crafting';
import { basePorId } from '../src/data/bases';
import {
  boot, reload, check, resumen, s, wh, ids, find, baseSave,
  collector, crate, consumable, RAREZA_NEUTRA
} from './kit';

const AFK_MS = AFK_CARD_DURATION_MS;
const MIN_60 = 60 * 60_000;
const MIN_30 = 30 * 60_000;
const BUFFS_ZERO = {
  clickBoostExpiresAt: 0, passiveBoostExpiresAt: 0,
  clickX2ExpiresAt: 0, clickX3ExpiresAt: 0,
  compPassiveBoostExpiresAt: 0, compClickBoostExpiresAt: 0, compGlobalBoostExpiresAt: 0
};

async function main() {
// =========================================================================
  //  1. EXPANSORES: CUATRO TRAMOS, CADA UNO HASTA SU TECHO
  //
  //  LA REGLA ENTERA:
  //
  //      Inicial (tienda)      da +1 y vale hasta 60
  //      Intermedio (cajas T3) da +1 y vale hasta 120
  //      Avanzado (cajas T7)   da +1 y vale hasta 180
  //      Supremo (caja T10)    da +1 y vale hasta 240
  //
  //  **EL TECHO ES LO QUE HACE LA REGLA.** Antes eran diez de diez en diez y
  //  convenía saltarse los primeros e ir al último, así que los de abajo eran
  //  irrelevantes. Con un solo Inicial hasta 60 no hay decisión falsa, y el
  //  siguiente ya no se compra: sale de las cajas.
  //
  //  Y el motivo por el que `WAREHOUSE_MAX_CAP` sigue en 600, pese a que la
  //  escalera acaba en 240, es que **bajarlo haría que
  //  `enforceWarehouseCapacity()` le borrara items del almacén** a quien ya pasó
  //  de 240. El techo frena el crecimiento; nunca recorta lo que ya hay.
  // =========================================================================
  {
    const g = await boot(baseSave([consumable('e1', 'expansorInicial', 1, { name: 'Expansor Inicial' })],
      { warehouseCapacity: WAREHOUSE_BASE_CAP }));
    const capAntes = s(g).warehouseCapacity;
    const r = g.useConsumable('e1');

    check('expansor: se aplica', r.ok, r.msg ?? '');
    check('expansor: sube la capacidad RANURAS_POR_EXPANSOR',
      s(g).warehouseCapacity === capAntes + RANURAS_POR_EXPANSOR,
      `${capAntes} -> ${s(g).warehouseCapacity}`);
    check('expansor: y consume la unidad', wh(g).length === 0, ids(g).join(','));
  }
{
    // **LA ESCALERA COMPLETA, LOS CUATRO TRAMOS, Y CON EL LOTE DE UN DIALOGO.**
    // Cada tramo sirve mientras el almacén esté por debajo de su techo y da
    // **una ranura por uso**: el Inicial lleva 15 a 60 (45 usos), y los otros
    // tres de 60 en 60 hasta 240. Sin el expansor del tramo siguiente no se
    // pasa de ese techo.
    //
    // Y son 45 + 60 + 60 + 60 usos porque el expansor da +1, no el tramo entero:
    // la tienda da el primer tramo y el botín de las cajas el resto. El lote es
    // lo que hace que eso no sea un fastidio: `useConsumable(id, n)` con el
    // número que dice el plan deja el almacén en su techo de un golpe.
    const g = await boot(baseSave([], { warehouseCapacity: WAREHOUSE_BASE_CAP }));
    let fallos = 0;
    let mensaje = '';
    for (const e of EXPANSOR_TIERS) {
      const esperado = techoDeExpansor(e.tier);
      const pila = Math.max(1, esperado - s(g).warehouseCapacity);
      g.updateState({ warehouse: [consumable('x1', e.buffId, pila, { name: e.name })] });
      const plan = g.planUseConsumable('x1');
      const r = g.useConsumable('x1', plan.unidades) as any;
      if (!r.ok || s(g).warehouseCapacity !== esperado || r.usadas !== pila) {
        fallos++;
        if (!mensaje) {
          mensaje = `${e.name}: ok=${r.ok} usadas=${r.usadas} de ${pila} `
            + `cap=${s(g).warehouseCapacity} esperado=${esperado} msg=${r.msg}`;
        }
      }
    }
    check('expansor: los cuatro tramos llevan la capacidad a su techo, uno detrás de otro',
      fallos === 0 && s(g).warehouseCapacity === techoDeExpansor(EXPANSOR_TIERS.length),
      `${fallos} fallos · final=${s(g).warehouseCapacity} · ${mensaje}`);
    check('expansor: la escalera va de 15 a 240 y cada uno da una ranura',
      EXPANSOR_TIERS.every(e => e.slots === 1)
      && EXPANSOR_TIERS.map(e => e.maxCap).join(',') === '60,120,180,240',
      `techos=${EXPANSOR_TIERS.map(e => e.maxCap).join(',')}`);
    check('expansor: el Inicial son 45 usos y los otros tres de 60 en 60',
      techoDeExpansor(1) - WAREHOUSE_BASE_CAP === 45
      && techoDeExpansor(2) - techoDeExpansor(1) === 60
      && techoDeExpansor(3) - techoDeExpansor(2) === 60
      && techoDeExpansor(4) - techoDeExpansor(3) === 60,
      `tramos=${techoDeExpansor(1) - WAREHOUSE_BASE_CAP},${techoDeExpansor(2) - techoDeExpansor(1)},${techoDeExpansor(3) - techoDeExpansor(2)},${techoDeExpansor(4) - techoDeExpansor(3)}`);
  }
  {
    // **Y EL RECHAZO, QUE ES LA MITAD DE LA REGLA.** Ya en el techo del Inicial,
    // el Inicial no se puede usar, no se gasta y el mensaje dice cuál hace
    // falta: el jugador no tiene que adivinar qué comprar.
    const g = await boot(baseSave([consumable('e1', 'expansorInicial', 1, { name: 'Expansor Inicial' })],
      { warehouseCapacity: techoDeExpansor(1) }));
    const r = g.useConsumable('e1');
    check('expansor: en su propio techo NO se usa',
      !r.ok && s(g).warehouseCapacity === techoDeExpansor(1), `ok=${r.ok} cap=${s(g).warehouseCapacity}`);
    check('expansor: y NO se gasto el item', wh(g).length === 1, ids(g).join(','));
    check('expansor: y el mensaje dice el numero y el expansor que falta',
      new RegExp(String(techoDeExpansor(1))).test(r.msg ?? '') && /Expansor Intermedio/.test(r.msg ?? ''),
      r.msg ?? '');
  }
  {
    // En la cima no hay nada por encima, y se dice así: el mensaje no puede
    // pedir un tramo que no existe.
    const g = await boot(baseSave([consumable('e1', 'expansorSupremo', 1, { name: 'Expansor Supremo' })],
      { warehouseCapacity: techoDeExpansor(4) }));
    const r = g.useConsumable('e1');
    check('expansor: en 240 el Supremo NO se usa y dice que no hay mas',
      !r.ok && /No hay expansor por encima/.test(r.msg ?? ''), r.msg ?? '');
    check('expansor: y NO se gasto el item', wh(g).length === 1, ids(g).join(','));
  }
  {
    // Un expansor alto en un almacén pequeño SÍ sirve: la regla es techo, no
    // banda. Si solo valiera a partir de su techo, sería botín muerto.
    const g = await boot(baseSave([consumable('e1', 'expansorSupremo', 1, { name: 'Expansor Supremo' })],
      { warehouseCapacity: 15 }));
    const r = g.useConsumable('e1');
    check('expansor: el Supremo en un almacen de 15 si sirve', r.ok, r.msg ?? '');
    check('expansor: y sube una sola ranura, no el tramo entero',
      s(g).warehouseCapacity === 16, 'cap=' + s(g).warehouseCapacity);
  }
  {
    // El stock de antes de los tramos sigue sirviendo con su techo de siempre:
    // la migración no quita nada. Un T7 en un almacén de 15 sube a 16, y en su
    // techo de 85 pide el tramo nuevo que cubre ese número, no un T8 que ya no
    // sale en ninguna parte.
    const g = await boot(baseSave([consumable('e1', 'expansorT7', 1, { name: 'Expansor T7' })],
      { warehouseCapacity: 15 }));
    const r = g.useConsumable('e1');
    check('expansor: el T7 viejo en un almacen de 15 si sirve', r.ok, r.msg ?? '');
    check('expansor: y sube una sola ranura', s(g).warehouseCapacity === 16,
      'cap=' + s(g).warehouseCapacity);
    const gB = await boot(baseSave([consumable('e1', 'expansorT7', 1, { name: 'Expansor T7' })],
      { warehouseCapacity: 85 }));
    const rB = gB.useConsumable('e1');
    check('expansor: en su techo viejo el T7 pide el Intermedio, no un T8 muerto',
      !rB.ok && /Expansor Intermedio/.test(rB.msg ?? ''), rB.msg ?? '');
  }
  {
    // El tope duro de 600 sigue existiendo para el stock viejo. Ningún tramo
    // nuevo llega ahí, así que con el almacén al tope se rechaza y dice que no
    // hay más.
    const g = await boot(baseSave([consumable('e1', 'expansorSupremo', 1, { name: 'Expansor Supremo' })],
      { warehouseCapacity: 600 }));
    const r = g.useConsumable('e1');
    check('expansor: con el almacen al tope duro se rechaza y dice que no hay mas',
      !r.ok && /No hay expansor por encima/.test(r.msg ?? ''), r.msg ?? '');
    check('expansor: y NO se gasto el item', wh(g).length === 1, ids(g).join(','));
  }
  {
    // El tope es sobre la base GUARDADA, no sobre el total efectivo: los slots
    // del árbol no se "gastan" al usar un expansor. Con la base por debajo de su
    // techo y slots del árbol, entra y sube solo la base.
    const g = await boot(baseSave([consumable('e1', 'expansorIntermedio', 1, { name: 'Expansor Intermedio' })], {
      warehouseCapacity: 28,
      nodeLevels: { storage_rack: 2, scrapyard: 1 },
      unlockedNodes: ['storage_rack', 'scrapyard']
    }));
    const r = g.useConsumable('e1');
    check('expansor: con la base en 28 y slots del arbol se aplica', r.ok, r.msg ?? '');
    check('expansor: y sube solo la BASE, no el total',
      s(g).warehouseCapacity === 29, 'base=' + s(g).warehouseCapacity);

    // **EL DESGLOSE QUE FALTA EN PANTALLA, Y POR QUÉ ES UN BUG DE LO QUE SE VE.**
    // Lo reportado fue: "tengo 69 de capacidad y lo subí con el expansor inicial, me
    // debería dejar solo hasta 60". Y el expansor **cumplió**: su techo es 60 y llegó
    // a 60. Los 9 de más son de `storage_rack` en nivel 2 (+3 cada uno), que es una
    // regla del juego y cuenta igual. Lo que no decía nadie era de dónde salía la
    // diferencia, así que los dos números ciertos se leían como un expansor roto: si
    // su techo es 60 y el contador dice 69, la conclusión del jugador es que hizo más
    // de lo que promete.
    // **Lo que se ata es que el desglose SUME el total.** Si las dos partes no dieran
    // el número grande, el "+" estaría pintando una cuenta que no es la del juego, que
    // es peor que no pintar nada.
    const bd: any = (g as any).getCapacityBreakdown?.();
    check('capacidad: el desglose existe y sus dos partes suman el total',
      !!bd && bd.delExpansor + bd.delArbol === (g as any).getCapacity(),
      bd ? `exp=${bd.delExpansor} arbol=${bd.delArbol} total=${bd.total}` : 'no existe');
    check('capacidad: la parte del expansor es la base GUARDADA, sin lo del arbol',
      bd?.delExpansor === s(g).warehouseCapacity,
      `delExpansor=${bd?.delExpansor} base=${s(g).warehouseCapacity}`);
    check('capacidad: y la del arbol son los slots del nodo, sin el expansor',
      bd?.delArbol === 6, `delArbol=${bd?.delArbol} (storage_rack nivel 2 son +6)`);
    // Y el caso del reporte, que es el que el jugador vio: 60 del expansor + 9 del árbol.
    const g69 = await boot(baseSave([], { warehouseCapacity: 60, nodeLevels: { storage_rack: 3 } }));
    const b69: any = (g69 as any).getCapacityBreakdown?.();
    check('capacidad: el caso reportado da 60+9 y el total 69, no un expansor roto',
      b69?.delExpansor === 60 && b69?.delArbol === 9 && (g69 as any).getCapacity() === 69,
      b69 ? `exp=${b69.delExpansor} arbol=${b69.delArbol} total=${b69.total}` : 'no existe');
  }
  {
    // Una pila de expansores: usar uno baja el contador, no borra la celda.
    const g = await boot(baseSave([consumable('e1', 'expansorInicial', 3, { name: 'Expansor Inicial' })],
      { warehouseCapacity: 15 }));
    const antes = s(g).warehouseCapacity;
    const r = g.useConsumable('e1');
    check('expansor: una pila de 3 se queda en 2', r.ok && find(g, 'e1')?.stackCount === 2,
      `ok=${r.ok} stack=${find(g, 'e1')?.stackCount}`);
    check('expansor: y la capacidad sube una ranura por unidad', s(g).warehouseCapacity === antes + RANURAS_POR_EXPANSOR,
      `${antes} -> ${s(g).warehouseCapacity}`);
  }
  {
    const g = await boot(baseSave([consumable('e1', 'expansorInicial', 2, { name: 'Expansor Inicial' })], {
      warehouseCapacity: techoDeExpansor(1)
    }));
    const r = g.useConsumable('e1');
    check('expansor: en el techo del Inicial NO se gasta ni una unidad de la pila',
      !r.ok && find(g, 'e1')?.stackCount === 2, `stack=${find(g, 'e1')?.stackCount}`);
  }
  {
    // El +1 de antes de los tipos sigue sirviendo, con el tope duro. Es el único
    // camino por encima de los 240 de la escalera de expansores.
    const g = await boot(baseSave([consumable('e1', 'warehouseExpander', 1, { name: 'Expansor de Almacén' })],
      { warehouseCapacity: 240 }));
    const capAntes = s(g).warehouseCapacity;
    const r = g.useConsumable('e1');
    check('expansor: el +1 viejo se aplica por encima de la escalera', r.ok, r.msg ?? '');
    check('expansor: y sube la capacidad 1', s(g).warehouseCapacity === capAntes + 1,
      `${capAntes} -> ${s(g).warehouseCapacity}`);
  }
  {
    // **Y LA TABLA NO PUEDE SEPARARSE DE LOS CASES DEL MOTOR.** El
    // `switch` de `useConsumable` tiene un `case` por buffId escrito a mano: un
    // expansor nuevo que no se añada ahí nace muerto, en silencio, hasta que
    // alguien lo usa y no pasa nada. Aquí se mira que los dos coincidan.
    const buffsDeTabla = EXPANSOR_TIERS.map(e => e.buffId);
    const faltan = buffsDeTabla.filter(b => !(b in CONSUMABLES));
    check('expansor: los cuatro buffIds de la tabla son consumibles',
      faltan.length === 0, `faltan: ${faltan.join(',') || 'ninguno'}`);
    // Y solo el Inicial se vende: los otros tres salen de cajas. Dos cartas
    // para lo mismo es la trampa que se quita.
    const enVenta = EXPANSOR_TIERS.filter(e => e.cost !== null);
    check('expansor: solo el Inicial esta a la venta',
      enVenta.length === 1 && enVenta[0].buffId === 'expansorInicial',
      `en venta: ${enVenta.map(e => e.buffId).join(',') || 'ninguno'}`);
  }
  // =========================================================================
  //  2. Tarjeta AFK: acumula tiempo, con tope de 3 tarjetas
  // =========================================================================
  {
    const g = await boot(baseSave([consumable('u1', 'afk', 1, { name: 'Tarjeta AFK' })]));
    const r = g.useConsumable('u1');
    const restante = s(g).afkExpiresAt - Date.now();

    check('afk: se aplica', r.ok, r.msg ?? '');
    check('afk: el buff queda vigente', s(g).afkExpiresAt > Date.now(), 'expira=' + s(g).afkExpiresAt);
    check('afk: dura lo que una tarjeta', restante > AFK_MS * 0.9 && restante <= AFK_MS,
      `restante=${restante} de=${AFK_MS}`);
    check('afk: consume la unidad', wh(g).length === 0, ids(g).join(','));
    check('afk: el contador de tarjetas baja a 0', s(g).afkCards === 0, 'afkCards=' + s(g).afkCards);
  }
  {
    // Dos tarjetas: el tiempo se SUMA. El tope de 3 son 30 minutos, asi que dos
    // entran sin recorte. Cada uso gasta UNA unidad, asi que una pila de 2 solo
    // da 10 minutos: para sumar dos hay que usar la tarjeta dos veces.
    const g = await boot(baseSave([consumable('u1', 'afk', 2, { name: 'Tarjeta AFK' })]));
    const r = g.useConsumable('u1');
    const trasUna = s(g).afkExpiresAt - Date.now();
    check('afk: un uso de una pila de 2 da una sola tarjeta',
      r.ok && trasUna > AFK_MS * 0.9 && trasUna <= AFK_MS, `restante=${trasUna}`);
    check('afk: y la pila queda en 1', find(g, 'u1')?.stackCount === 1, String(find(g, 'u1')?.stackCount));
    g.useConsumable('u1');
    const trasDos = s(g).afkExpiresAt - Date.now();
    check('afk: el segundo uso suma el tiempo', trasDos > AFK_MS * 1.5, `restante=${trasDos}`);
    check('afk: y consume la ultima unidad', wh(g).length === 0, ids(g).join(','));
  }
  {
    // El tope duro: 3 tarjetas. Una cuarta no da 40 minutos, da los mismos 30.
    const g = await boot(baseSave([consumable('u1', 'afk', 5, { name: 'Tarjeta AFK' })]));
    const r = g.useConsumable('u1');
    const restante = s(g).afkExpiresAt - Date.now();
    check('afk: el tope son 3 tarjetas', r.ok && restante <= AFK_MS * 3,
      `restante=${restante} tope=${AFK_MS * 3}`);
    check('afk: y aun asi consume la unidad que ha usado', find(g, 'u1')?.stackCount === 4,
      String(find(g, 'u1')?.stackCount));
  }
  {
    // Con un buff ya vigente, usar otra tarjeta lo PROLONGA, no lo reinicia.
    // Si se calculara sobre "ahora" en vez de sobre max(ahora, vigente), el
    // jugador perderia el tiempo que le quedaba.
    const pronto = Date.now() + 8 * 60_000;
    const g = await boot(baseSave([consumable('u1', 'afk', 2, { name: 'Tarjeta AFK' })], {
      afkExpiresAt: pronto
    }));
    const r = g.useConsumable('u1');
    const restante = s(g).afkExpiresAt - Date.now();
    check('afk: con un buff vigente se prolonga, no se reinicia',
      r.ok && restante > AFK_MS * 1.5, `restante=${restante} (vencia en ${pronto - Date.now()})`);
  }
  {
    // Con el buff CADUCADO, la tarjeta se cuenta entera desde ahora.
    const g = await boot(baseSave([consumable('u1', 'afk', 1, { name: 'Tarjeta AFK' })], {
      afkExpiresAt: Date.now() - 1000
    }));
    const r = g.useConsumable('u1');
    check('afk: con el buff caducado cuenta entera desde ahora',
      r.ok && s(g).afkExpiresAt > Date.now() + AFK_MS * 0.9, 'expira=' + s(g).afkExpiresAt);
  }
  {
    // El nodo "Suspension Prolongada" alarga la tarjeta. Sin este caso, un
    // cambio en `afkCardDurationMs` pasaria inadvertido.
    const g = await boot(baseSave([consumable('u1', 'afk', 1, { name: 'Tarjeta AFK' })], {
      afkExpiresAt: 0,
      nodeLevels: { afk_extend: 2, shard_sifter: 1, refinery: 1, blueprint: 1 },
      unlockedNodes: ['afk_extend', 'shard_sifter', 'refinery', 'blueprint']
    }));
    check('afk: el nodo alarga la duracion de la tarjeta', g.getAfkDurationMs() > AFK_MS,
      `${g.getAfkDurationMs()} vs ${AFK_MS}`);
    const r = g.useConsumable('u1');
    check('afk: y la tarjeta comprada dura mas', r.ok && s(g).afkExpiresAt - Date.now() > AFK_MS,
      'restante=' + (s(g).afkExpiresAt - Date.now()));
  }
  {
    // El tiempo se cuenta desde el instante de uso, no desde un reloj
    // manipulado: dos usos seguidos acumulan sobre el mismo "ahora".
    const g = await boot(baseSave([consumable('u1', 'afk', 3, { name: 'Tarjeta AFK' })], { afkExpiresAt: 0 }));
    g.useConsumable('u1');
    const uno = s(g).afkExpiresAt;
    g.useConsumable('u1');
    const dos = s(g).afkExpiresAt;
    check('afk: dos usos seguidos acumulan, no se pisan',
      dos > uno && dos - uno > AFK_MS * 0.9, `delta=${dos - uno}`);
    check('afk: y el tope de 3 tarjetas aguanta los dos', dos - Date.now() <= AFK_MS * 3,
      `restante=${dos - Date.now()}`);
  }

  // =========================================================================
  //  3. Buffs de click y de pasivo
  // =========================================================================
  {
    const g = await boot(baseSave([consumable('b1', 'clickBoost', 1, { name: 'Buff Clicks x2' })]));
    const r = g.useConsumable('b1');
    check('clickBoost: se aplica', r.ok, r.msg ?? '');
    check('clickBoost: deja el buff vigente', s(g).buffs.clickBoostExpiresAt > Date.now(),
      'expira=' + s(g).buffs.clickBoostExpiresAt);
    check('clickBoost: consume el item', wh(g).length === 0, ids(g).join(','));
  }
{
    // **UNA TARJETA QUE NO MUEVE EL RELOJ NO SE COBRA.** El tope se mide en el
    //  instante de cada llamada, así que usar dos veces seguidas deja siempre unos
    //  milisegundos de margen y, sin el margen de un segundo, el motor cobraría la
    //  segunda tarjeta por mover el reloj dos milisegundos. El jugador la ve gastar y
    //  no ve pasar nada, que es la mitad de lo que motivó el uso en lote.
    const g = await boot(baseSave([consumable('b1', 'clickBoost', 5, { name: 'Buff Clicks x2' })],
      { buffs: BUFFS_ZERO }));
    g.useConsumable('b1');
    const tras = s(g).buffs.clickBoostExpiresAt - Date.now();
    check('clickBoost: la primera tarjeta da 30 minutos', tras <= MIN_30, `restante=${tras}`);
    const segunda = g.useConsumable('b1');
    check('clickBoost: la segunda ya esta al tope y lo dice',
      !segunda.ok && /tope/i.test(segunda.msg ?? ''), segunda.msg ?? '');
    check('clickBoost: y NO se gasta, que era el gasto sin efecto',
      find(g, 'b1')?.stackCount === 4, String(find(g, 'b1')?.stackCount));
    check('clickBoost: y el plan lo dice ANTES de gastar, no al fallar',
      g.planUseConsumable('b1').unidades === 0,
      'unidades=' + g.planUseConsumable('b1').unidades);
    check('clickBoost: y el tope se respeta igual',
      s(g).buffs.clickBoostExpiresAt - Date.now() <= MIN_30,
      'restante=' + (s(g).buffs.clickBoostExpiresAt - Date.now()));
  }
  {
    // **PERO UN BUFF A MEDIAS SÍ ACEPTA LA TARJETA, Y ESO ES LO QUE SALVA EL `ceil`.**
    //  Con veinte minutos puestos de un tope de treinta, la tarjeta lleva el buff al
    //  tope: son diez minutos de verdad. Con un `floor` —o sin el margen de un segundo—
    //  esto se rechazaría, y el jugador se quedaría con un buff que no puede rematar
    //  hasta que expire entero, que es la peor de las dos mitades.
    const g = await boot(baseSave([consumable('b1', 'clickBoost', 2, { name: 'Buff Clicks x2' })],
      { buffs: { ...BUFFS_ZERO, clickBoostExpiresAt: Date.now() + MIN_30 - 10 * 60_000 } }));
    check('clickBoost: con veinte minutos de treinta, el plan ofrece una',
      g.planUseConsumable('b1').unidades === 1,
      'unidades=' + g.planUseConsumable('b1').unidades);
    const r = g.useConsumable('b1', 2) as any;
    check('clickBoost: y usarla en lote se queda en una y no cobra la segunda',
      r.ok === true && r.usadas === 1 && find(g, 'b1')?.stackCount === 1,
      `ok=${r.ok} usadas=${r.usadas} quedan=${find(g, 'b1')?.stackCount}`);
    check('clickBoost: y el buff llega al tope entero',
      s(g).buffs.clickBoostExpiresAt - Date.now() > MIN_30 - 2_000,
      'restante=' + (s(g).buffs.clickBoostExpiresAt - Date.now()));
  }
  {
    const g = await boot(baseSave([consumable('b2', 'passiveBoost', 1, { name: 'Buff Pasivo x2' })]));
    const r = g.useConsumable('b2');
    check('passiveBoost: se aplica', r.ok, r.msg ?? '');
    check('passiveBoost: deja el buff vigente', s(g).buffs.passiveBoostExpiresAt > Date.now(),
      'expira=' + s(g).buffs.passiveBoostExpiresAt);
    check('passiveBoost: consume el item', wh(g).length === 0, ids(g).join(','));
  }
  {
    // El buff de pasivo tiene que DOBLAR el ingreso, que es para lo que sirve.
    //
    // **RARIZA NEUTRA A PROPOSITO.** El compañero se construye a mano aquí, con Épico, y
    // con el multiplicador de rareza un Épico de potencia 10 rinde 12: la prueba pedía 10
    // y recibía 12. La prueba es del buff, no de la rareza, así que el compañero va
    // neutro. Si algún día se deja aquí un Épico, esta vuelve a estar midiendo dos cosas.
    // F74 · Poder y base explícitos: sin base la migración sortea y recalcula.
    const poderM1 = poderDeCompanero(1, 3, basePorId('base_com_t1_6'));
    const g = await boot(baseSave([
      consumable('b2', 'passiveBoost', 1, { name: 'Buff Pasivo x2' }),
      { id: 'm1', name: 'Compañero T1', type: 'companion', details: 'x', rarity: RAREZA_NEUTRA, tier: 1, sellPrice: 100, potential: 3, baseId: 'base_com_t1_6' }
    ], {
      activeCompanions: ['m1'],
      companions: [{ id: 'm1', name: 'Compañero T1', type: 'passive', power: poderM1, rarity: RAREZA_NEUTRA, tier: 1, potential: 3, baseId: 'base_com_t1_6' }]
    }));
    const pasivoSinBuff = s(g).passiveIncome;
    check('passiveBoost: hay ingreso pasivo de partida', pasivoSinBuff === poderM1, 'pasivo=' + pasivoSinBuff);
    g.useConsumable('b2');
    check('passiveBoost: duplica el ingreso pasivo', s(g).passiveIncome === pasivoSinBuff * 2,
      `${pasivoSinBuff} -> ${s(g).passiveIncome}`);
  }
  {
    // Tope de 2 horas para el pasivo, con 1 hora por tarjeta.
    const g = await boot(baseSave([consumable('b2', 'passiveBoost', 5, { name: 'Buff Pasivo x2' })],
      { buffs: BUFFS_ZERO }));
    g.useConsumable('b2');
    g.useConsumable('b2');
    g.useConsumable('b2');
    check('passiveBoost: el tope son 2 horas',
      s(g).buffs.passiveBoostExpiresAt - Date.now() <= 2 * MIN_60,
      `restante=${s(g).buffs.passiveBoostExpiresAt - Date.now()}`);
  }
  {
    const g = await boot(baseSave([consumable('b3', 'clickX2', 1, { name: 'Tarjeta Click x2' })]));
    const r = g.useConsumable('b3');
    check('clickX2: se aplica', r.ok, r.msg ?? '');
    check('clickX2: deja el buff vigente', s(g).buffs.clickX2ExpiresAt > Date.now(),
      'expira=' + s(g).buffs.clickX2ExpiresAt);
    check('clickX2: consume el item', wh(g).length === 0, ids(g).join(','));
  }
  {
    const g = await boot(baseSave([consumable('b4', 'clickX3', 1, { name: 'Tarjeta Click x3' })]));
    const r = g.useConsumable('b4');
    check('clickX3: se aplica', r.ok, r.msg ?? '');
    check('clickX3: deja el buff vigente', s(g).buffs.clickX3ExpiresAt > Date.now(),
      'expira=' + s(g).buffs.clickX3ExpiresAt);
  }
  {
    // El buff de click tiene que notarse en el dano por click. Esta es la prueba
    // de que el buff EXISTE y no solo se escribe en el estado.
    const g = await boot(baseSave([
      collector('r1', 3, { damage: 60 }),
      consumable('b1', 'clickBoost', 1, { name: 'Buff Clicks x2' })
    ]));
    g.equipCollector('r1');
    const antes = g.getClickDamage();
    check('clickBoost: hay dano de partida que boostar', antes > 0, 'danio=' + antes);
    g.useConsumable('b1');
    check('clickBoost: el dano por click sube', g.getClickDamage() > antes,
      `${antes} -> ${g.getClickDamage()}`);
  }

  // =========================================================================
  //  4. Los consumibles de forja NO se usan desde el almacen
  // =========================================================================
  {
    // Los tres: piedra, nanopartícula y el Éter de Refinamiento nuevo. Si al
    // Éter le faltara este rechazo, el jugador podría usarlo desde la rejilla y
    // el efecto —sumar puntos a una tirada— no existiría: se gastaría y no pasaría
    // nada, que es la clase de error que nadie reporta porque "no hace nada" no
    // parece un fallo.
    const g = await boot(baseSave([
      consumable('p1', 'calibrationStone', 2, { name: 'Piedra de Calibración' }),
      consumable('n1', 'stabilityNano', 1, { name: 'Nanopartícula de Estabilidad' }),
      consumable('e1', 'refiningEther', 1, { name: 'Éter de Refinamiento' })
    ]));
    const r1 = g.useConsumable('p1');
    const r2 = g.useConsumable('n1');
    const r3 = g.useConsumable('e1');
    check('forja: la Piedra de Calibracion se rechaza desde el almacen', !r1.ok, r1.msg ?? '');
    check('forja: y avisa de que es para la Forja', /Forja/i.test(r1.msg ?? ''), r1.msg ?? '');
    check('forja: la Nanoparticula se rechaza desde el almacen', !r2.ok, r2.msg ?? '');
    check('forja: y avisa tambien', /Forja/i.test(r2.msg ?? ''), r2.msg ?? '');
    check('forja: y el Éter de Refinamiento se rechaza desde el almacen', !r3.ok, r3.msg ?? '');
    check('forja: ninguno de los tres se gasta', wh(g).length === 3, ids(g).join(','));
    const plan = g.planUseConsumable('e1');
    check('forja: y su plan desde el almacen tambien dice que es de la Forja',
      plan.unidades === 0 && /Forja/i.test(plan.motivo ?? ''), `${plan.unidades} ${plan.motivo}`);
  }
  {
    // Un consumible con un buffId que el juego no conoce. No se gasta y no
    // rompe nada: es lo que pasa con un guardado muy viejo o con un item
    // eliminado del juego.
    const g = await boot(baseSave([consumable('z1', 'buffInventado', 1, { name: 'Cosa Rara' })]));
    const r = g.useConsumable('z1');
    check('buff desconocido: se rechaza', !r.ok, r.msg ?? '');
    check('buff desconocido: y no se gasta el item', wh(g).length === 1, ids(g).join(','));
  }
  {
    // Un consumible viejo SIN `buffId`: el efecto se deduce del nombre. Es la
    // migracion de las partidas que todavia no tienen el campo.
    const viejo = consumable('u1', 'afk', 1, { name: 'Tarjeta AFK' });
    delete (viejo as any).buffId;
    const g = await boot(baseSave([viejo]));
    check('migracion: un consumible sin buffId deduce el efecto del nombre',
      wh(g)[0]?.buffId === 'afk', JSON.stringify(wh(g)[0]?.buffId));
    const r = g.useConsumable('u1');
    check('migracion: y se puede usar igual', r.ok, r.msg ?? '');
  }
  {
    // Y un consumible viejo cuyo nombre tampoco dice nada: se rechaza, pero no
    // se gasta.
    const viejo = consumable('u1', 'afk', 1, { name: 'Cosa Sin Nombre' });
    delete (viejo as any).buffId;
    const g = await boot(baseSave([viejo]));
    const r = g.useConsumable('u1');
    check('migracion: un nombre irreconocible se rechaza', !r.ok, r.msg ?? '');
    check('migracion: y no se gasta', wh(g).length === 1, ids(g).join(','));
  }

  // =========================================================================
  //  5. Lo que NO es un consumible
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1'), crate('c1')]));
    check('no consumible: un recolector no se usa', !g.useConsumable('r1').ok);
    check('no consumible: una caja no se usa', !g.useConsumable('c1').ok);
    check('no consumible: y no se gastan', wh(g).length === 2, ids(g).join(','));
  }
  {
    const g = await boot(baseSave([consumable('u1', 'afk')]));
    const r = g.useConsumable('idQueNoExiste');
    check('no consumible: un id inexistente se rechaza', !r.ok, r.msg ?? '');
    check('no consumible: y el almacen queda igual', wh(g).length === 1, ids(g).join(','));
  }

  // =========================================================================
  //  6. El gasto solo si el efecto ha salido bien
  // =========================================================================
  {
    // El caso central: almacen al maximo de expansores. El efecto no cabe, asi
    // que no debe gastarse NINGUN item, ni el expansor ni otra cosa.
    const g = await boot(baseSave([
      consumable('e1', 'expansorInicial', 2, { name: 'Expansor Inicial' }),
      consumable('u1', 'afk', 1, { name: 'Tarjeta AFK' })
    ], { warehouseCapacity: 600 }));
    const r = g.useConsumable('e1');
    check('gasto: un efecto rechazado no gasta el item',
      !r.ok && find(g, 'e1')?.stackCount === 2, `stack=${find(g, 'e1')?.stackCount}`);
    check('gasto: y no toca los otros items', find(g, 'u1') !== undefined, ids(g).join(','));
    check('gasto: ni aplica el buff de la otra tarjeta', s(g).afkExpiresAt === 0, 'expira=' + s(g).afkExpiresAt);
  }
  {
    // Dos usos seguidos del mismo item: el segundo falla si la pila se acabo.
    const g = await boot(baseSave([consumable('b1', 'clickBoost', 1, { name: 'Buff Clicks x2' })]));
    const r1 = g.useConsumable('b1');
    const r2 = g.useConsumable('b1');
    check('gasto: el primer uso funciona', r1.ok, r1.msg ?? '');
    check('gasto: el segundo falla sin item', !r2.ok, r2.msg ?? '');
    check('gasto: y el item no reaparece', wh(g).length === 0, ids(g).join(','));
  }
  {
    // Un item no apilable (stackCount ausente) se gasta entero, no a medias.
    const suelto = consumable('b1', 'clickBoost', 1, { name: 'Buff Clicks x2' });
    delete (suelto as any).stackable;
    delete (suelto as any).stackCount;
    const g = await boot(baseSave([suelto]));
    const r = g.useConsumable('b1');
    check('gasto: un consumible sin stackCount se gasta entero',
      r.ok && wh(g).length === 0, `ok=${r.ok} items=${wh(g).length}`);
  }

  // =========================================================================
  //  7. El consumible NO debe reventar el resto del estado
  // =========================================================================
  {
    const g = await boot(baseSave([
      collector('r1', 3, { damage: 50 }),
      crate('c1', 1, 4),
      consumable('k1', 'afk', 3, { name: 'Tarjeta AFK' })
    ]));
    const antes = JSON.stringify({
      n: s(g).nanites, k: s(g).keys, c: s(g).crates.common, cap: s(g).warehouseCapacity
    });
    g.useConsumable('k1');
    const despues = JSON.stringify({
      n: s(g).nanites, k: s(g).keys, c: s(g).crates.common, cap: s(g).warehouseCapacity
    });
    check('gasto: usar un consumible no altera nanitas, contadores ni capacidad',
      antes === despues, despues);
  }
  {
    // Un consumible de los que se compran: comprarlo y usarlo seguido tiene que
    // dejar el estado como si nunca se hubiera tenido.
    const g = await boot(baseSave([], { nanites: 50_000 }));
    g.buyStoreItem('afkCard');
    const comprada = wh(g).find((w: any) => w.buffId === 'afk');
    const r = g.useConsumable(comprada.id);
    check('gasto: una tarjeta comprada y usada se aplica', r.ok, r.msg ?? '');
    check('gasto: y desaparece del almacen', !wh(g).some((w: any) => w.id === comprada.id), ids(g).join(','));
  }
  {
    // Los tres buffs de "carta corta" (clickX2 / clickX3) tienen su propio
    // campo: usar uno no puede pisar el otro.
    const g = await boot(baseSave([
      consumable('b3', 'clickX2', 1, { name: 'Tarjeta Click x2' }),
      consumable('b4', 'clickX3', 1, { name: 'Tarjeta Click x3' })
    ]));
    g.useConsumable('b3');
    const x2 = s(g).buffs.clickX2ExpiresAt;
    g.useConsumable('b4');
    check('gasto: clickX2 y clickX3 van a campos separados',
      x2 > Date.now() && s(g).buffs.clickX3ExpiresAt > Date.now() && s(g).buffs.clickX2ExpiresAt === x2,
      `x2=${x2} x3=${s(g).buffs.clickX3ExpiresAt}`);
    check('gasto: y ninguno toca el buff de click largo',
      s(g).buffs.clickBoostExpiresAt === 0);
  }

  // =========================================================================
  //  8. El buff se puede cancelar y el item NO vuelve
  // =========================================================================
  {
    const g = await boot(baseSave([consumable('u1', 'afk', 2, { name: 'Tarjeta AFK' })]));
    g.useConsumable('u1');
    check('cancelar: el item se ha gastado al usarlo', wh(g).length === 1, ids(g).join(','));
    const antes = s(g).afkExpiresAt;
    const etiqueta = g.cancelBuff('afk');

    // **EL AFK TAMBIÉN SE PUEDE CANCELAR DESDE Q3, Y LO DICE EL MOTOR Y NO EL BOTÓN.**
    // Ocultar la cruce en la tarjeta habría hecho pasar esta mitad sin probar nada: el
    // botón desaparecería mientras `cancelBuff()` siguiera negando. La regla es
    // `sePuedeCancelar('afk')`, que leen el HUD y el motor, y aquí se comprueba contra el
    // motor porque es él quien tiene que dejar de negar.
    check('cancelar: el AFK se puede cancelar (Q3)',
      etiqueta === BUFF_LABELS.afk && antes > 0, String(etiqueta));
    check(
      'cancelar: y su buff se apaga, con el total a cero',
      s(g).afkExpiresAt === 0 && (s(g).afkTotalMs as number) === 0 && antes > 0,
      'expira=' + s(g).afkExpiresAt + ' antes=' + antes
    );
    // Y la regla de este bloque entera: cancelar no devuelve el item.
    check('cancelar: la tarjeta cancelada no vuelve al almacen', wh(g).length === 1, ids(g).join(','));
    check(
      'cancelar: y el item sigue gastado igual',
      wh(g).length === 1 && s(g).afkCards === 1,
      wh(g).length + ' tarjetas=' + s(g).afkCards
    );
    // **Y VOLVER A PONERLO ES USAR OTRA TARJETA, QUE ERA LA MITAD DE LA OBJECIÓN VIEJA**
    // ("no había ningún sitio donde volver a ponerlo sin gastar otra tarjeta"). Es
    // cierto, y es exactamente lo que se hace con el resto de buffs: aquí queda una en
    // el almacén y el buff vuelve, con su total nuevo y no con el del cancelado, que es
    // lo que la barra mide.
    const otra = wh(g).find((w: any) => w.buffId === 'afk');
    const r2 = otra ? g.useConsumable(otra.id) : { ok: false, msg: 'no queda tarjeta' };
    check(
      'cancelar: y se puede volver a poner con la tarjeta que queda',
      !!r2.ok && s(g).afkExpiresAt > 0 && (s(g).afkTotalMs as number) > 0,
      `${r2.msg ?? ''} expira=${s(g).afkExpiresAt} total=${s(g).afkTotalMs}`
    );
  }
  {
    const g = await boot(baseSave([consumable('b1', 'clickBoost', 1, { name: 'Buff Clicks x2' })]));
    g.useConsumable('b1');
    g.cancelBuff('clickBoost');
    check('cancelar: el buff de click se puede cancelar', s(g).buffs.clickBoostExpiresAt === 0,
      'expira=' + s(g).buffs.clickBoostExpiresAt);
    check('cancelar: y el item sigue gastado', wh(g).length === 0, ids(g).join(','));
  }
  {
    // Cancelar un buff que no esta vigente no inventa un estado raro.
    const g = await boot(baseSave([consumable('b1', 'clickBoost', 1, { name: 'Buff Clicks x2' })]));
    const r = g.cancelBuff('clickBoost');
    check('cancelar: cancelar un buff inexistente no hace nada', r === false, String(r));
  }

  // =========================================================================
  //  9. Persistencia
  // =========================================================================
  {
    const g = await boot(baseSave([consumable('u1', 'afk', 2, { name: 'Tarjeta AFK' })]));
    g.useConsumable('u1');
    const g2 = await reload();
    check('guardar: el buff AFK sobrevive a la recarga', s(g2).afkExpiresAt > Date.now(),
      'expira=' + s(g2).afkExpiresAt);
    check('guardar: y la pila queda en 1', wh(g2)[0]?.stackCount === 1, JSON.stringify(wh(g2)[0]));
  }
  {
    const g = await boot(baseSave([consumable('b1', 'clickBoost', 1, { name: 'Buff Clicks x2' })]));
    g.useConsumable('b1');
    const g2 = await reload();
    check('guardar: el buff de click sobrevive a la recarga',
      s(g2).buffs.clickBoostExpiresAt > Date.now(), 'expira=' + s(g2).buffs.clickBoostExpiresAt);
  }
  {
    // Un buff ya caducado se renueva con la tarjeta nueva, no se queda en el
    // pasado: el estado guardado puede traer fechas viejas.
    const g = await boot(baseSave([consumable('b1', 'clickBoost', 1, { name: 'Buff Clicks x2' })], {
      buffs: { clickBoostExpiresAt: Date.now() - 5000, passiveBoostExpiresAt: 0, clickX2ExpiresAt: 0, clickX3ExpiresAt: 0 }
    }));
    const r = g.useConsumable('b1');
    check('caducado: usar un consumible con un buff caducado lo renueva',
      r.ok && s(g).buffs.clickBoostExpiresAt > Date.now(), 'expira=' + s(g).buffs.clickBoostExpiresAt);
  }
  {
    // Usar un consumible y recargar a la vez no duplica el efecto: el buff se
    // guarda una vez y se lee una vez.
    const g = await boot(baseSave([consumable('u1', 'afk', 3, { name: 'Tarjeta AFK' })], { afkExpiresAt: 0 }));
    g.useConsumable('u1');
    const primera = s(g).afkExpiresAt;
    const g2 = await reload();
    const segunda = s(g2).afkExpiresAt;
    check('guardar: recargar no alarga el buff otra vez',
      Math.abs(segunda - primera) < 1000, `antes=${primera} despues=${segunda}`);
    check('guardar: y la pila sigue con 2 unidades', wh(g2)[0]?.stackCount === 2,
      JSON.stringify(wh(g2)[0]?.stackCount));
  }

// =========================================================================
  //  4. USAR CONSUMIBLES DE A VECES, Y CUANTAS CABEN DE GOLPE
  //
  //  El consumible se usaba de a uno, y con veinte tarjetas AFK en la pila eso son
  //  veinte confirmaciones para un efecto que el propio juego limita a tres. Y el
  //  gasto era el otro extremo del problema: el tope vivia dentro del `case` que
  //  aplica el efecto, asi que una tarjeta que no cabia **se cobraba igual**.
  //
  //  La regla de "cuantas caben" se comprueba contra el motor real y no contra una
  //  cuenta de la vista: el maximo del dialogo y el tope del cobro tienen que ser el
  //  mismo numero, y la unica forma de que no se separen es que salgan de la misma
  //  funcion.
  // =========================================================================
  {
    const g = await boot(baseSave([consumable('u1', 'afk', 20, { name: 'Tarjeta AFK' })],
      { warehouseCapacity: 40 }));

    const plan = g.planUseConsumable('u1');
    check('lote: veinte tarjetas AFK y el plan dice tres, no veinte',
      plan.unidades === 3 && plan.motivo === null,
      `unidades=${plan.unidades} motivo=${plan.motivo}`);

    // **Y USAR TRES DE UNA VEZ GASTA TRES, NI UNA MAS NI UNA MENOS.** Si el tope
    //  estuviera solo en el gasto y no en el plan, el motor cobraria tres con un
    //  boton que promete veinte, que es la discrepancia que R3 prohibe.
    const tres = g.useConsumable('u1', 3) as any;
    const queda = (g.getState().warehouse as any[]).find((w: any) => w.id === 'u1');
    check('lote: usar tres de una vez gasta tres y no las veinte',
      tres.ok === true && tres.usadas === 3 && (queda?.stackCount ?? 0) === 17,
      `ok=${tres.ok} usadas=${tres.usadas} quedan=${queda?.stackCount}`);

    // **Y EL EFECTO ES EL DE TRES TARJETAS, NO EL DE UNA.** Esta es la mitad que
    //  faltaba: si se gastaran tres y solo se aplicara una, el jugador pagaria tres
    //  por un efecto, y el "gasto en lote" seria una forma de perder recursos con
    //  botones que encima lo anuncian.
    const restante = s(g).afkExpiresAt - Date.now();
    check('lote: y el buff dura tres tarjetas, no una',
      restante > AFK_MS * 2 && restante <= AFK_MS * 3,
      `restante=${restante} una=${AFK_MS} tope=${AFK_MS * 3}`);

    // **Y EL TOPE SE APLICA AL EFECTO, ASI QUE EL PLAN SE QUEDA A CERO.** No es un
    //  detalle: es lo que hace que el boton se apague antes de gastar.
    const despues = g.planUseConsumable('u1');
    check('lote: despues de gastarlas no cabe ninguna mas, y lo dice',
      despues.unidades === 0 && !!despues.motivo,
      `unidades=${despues.unidades} motivo=${despues.motivo}`);

    const manual = g.useConsumable('u1', 2) as any;
    const sigue = (g.getState().warehouse as any[]).find((w: any) => w.id === 'u1');
    check('lote: y usarlas a mano tambien se rechaza sin gastar',
      manual.ok === false && manual.usadas === 0 && (sigue?.stackCount ?? 0) === 17,
      `ok=${manual.ok} usadas=${manual.usadas} quedan=${sigue?.stackCount}`);
  }
{
    // **EL EXPANSOR DA UNA RANURA Y SIRVE HASTA SU TECHO: DOS COSAS DISTINTAS.**
    // Con 18 de capacidad y un Inicial que vale hasta 60, la cuenta es de 42
    // unidades: `ceil((techo - base) / ranuras)` con una ranura por expansor es
    // exactamente "cuántas veces cabe", y es el mismo número que el diálogo le
    // enseña al jugador. Por eso el lote aquí no es una comodidad: es la única
    // forma cómoda de subir un tramo.
    const g = await boot(baseSave([consumable('e1', 'expansorInicial', 50, { name: 'Expansor Inicial' })],
      { warehouseCapacity: 18 }));
    const plan = g.planUseConsumable('e1');
    check('lote: el expansor cuenta las ranuras que faltan hasta su techo',
      plan.unidades === techoDeExpansor(1) - 18, `unidades=${plan.unidades}`);
    const r = g.useConsumable('e1', 50) as any;
    const queda = (g.getState().warehouse as any[]).find((w: any) => w.id === 'e1');
    check('lote: y al pedir cincuenta usa solo las que caben y deja el resto',
      r.ok === true && r.usadas === plan.unidades && (queda?.stackCount ?? 0) === 50 - plan.unidades,
      `ok=${r.ok} usadas=${r.usadas} quedan=${queda?.stackCount} plan=${plan.unidades}`);
    check('lote: y la capacidad se queda exactamente en su techo',
      s(g).warehouseCapacity === techoDeExpansor(1), 'cap=' + s(g).warehouseCapacity);
    check('lote: y en el techo no cabe ni uno más',
      g.planUseConsumable('e1').unidades === 0);
  }
  {
    // **UN TOPE Y UN PASO DISTINTOS: DOS HORAS SON DOS TARJETAS, NO UNA.** Es el caso
    //  que separa las dos mitades de la regla --`topeDeConsumible` y
    //  `pasoDeConsumible`--: con la misma duration por tarjeta, cinco darian cinco
    //  horas; con una hora por tarjeta, dos dan las dos horas del tope.
    const g = await boot(baseSave([consumable('p1', 'passiveBoost', 5, { name: 'Buff Pasivo x2' })]));
    const plan = g.planUseConsumable('p1');
    check('lote: el pasivo dice dos, que es el tope de dos horas partido por una hora',
      plan.unidades === 2, `unidades=${plan.unidades}`);
    const r = g.useConsumable('p1', 5) as any;
    const queda = (g.getState().warehouse as any[]).find((w: any) => w.id === 'p1');
    check('lote: y al pedir cinco se cobran dos, no cinco',
      r.ok === true && r.usadas === 2 && (queda?.stackCount ?? 0) === 3,
      `ok=${r.ok} usadas=${r.usadas} quedan=${queda?.stackCount}`);
    const resta = s(g).buffs.passiveBoostExpiresAt - Date.now();
    check('lote: y el buff se lleva las dos horas enteras',
      resta > MIN_60 && resta <= 2 * MIN_60, `restante=${resta}`);
    check('lote: y ya no cabe ni una mas',
      g.planUseConsumable('p1').unidades === 0);
  }
  {
    // **LO QUE NO SE USA DESDE EL ALMACEN, DICIENTO ANTES DE GASTAR.** Las piedras
    //  se consumen en la Forja una por tirada: aplicarlas desde aqui las gastaria sin
    //  que la Forja las viera, y en lote eso seria un monton de stonesLost en silencio.
    const g = await boot(baseSave([consumable('c1', 'calibrationStone', 4, { name: 'Piedra de Calibracion' })]));
    const plan = g.planUseConsumable('c1');
    check('lote: la piedra se rechaza en el almacen y el motivo lo dice',
      plan.unidades === 0 && /Forja/.test(plan.motivo ?? ''),
      `unidades=${plan.unidades} motivo=${plan.motivo}`);
    check('lote: y ni siquiera en lote se gasta',
      (g.useConsumable('c1', 4) as any).usadas === 0
      && ((g.getState().warehouse as any[]).find((w: any) => w.id === 'c1')?.stackCount ?? 0) === 4);
  }
  {
    // **Y UN ID QUE NO EXISTE NO PROMETE NADA, EN VEZ DE DECIR QUE ESTA AL TOPE.**
    const g = await boot(baseSave([]));
    const plan = g.planUseConsumable('no-existe');
    check('lote: un id que no esta no ofrece nada y lo dice',
      plan.unidades === 0 && !!plan.motivo && !/tope/i.test(plan.motivo ?? ''),
      `unidades=${plan.unidades} motivo=${plan.motivo}`);
  }

// -------------------------------------------------------------------------
  //  B13 · LA BARRA DEL HUD, Y SU DENOMINADOR
  //
  //  Era `restante / duracion de UNA tarjeta`, con el motor acumulando por encima:
  //  tres tarjetas de click x2 de treinta segundos dejan el buff treinta minutos y la
  //  barra se quedaba clavada en el 100 % con el contador corriendo. Ahora el
  //  denominador es lo que se concedió en el último uso, que es un campo del guardado.
  //
  //  Aquí se comprueban las tres mitades por separado, porque pueden fallar solas: que
  //  el motor anote el total, que el HUD lo use de denominador, y que una partida vieja
  //  sin el campo caiga a algo y no a NaN.
  // -------------------------------------------------------------------------
  {
    const g = await boot(baseSave([
      consumable('x2', 'clickX2', 60, { name: 'Tarjeta Click x2' })
    ], { buffs: BUFFS_ZERO }));

    // **SESENTA TARJETAS DE 30 s, TREINTA MINUTOS, Y UN TOTAL DE TREINTA MINUTOS.**
    //  La clave de B13 es que las dos mitades cuadren: si el motor acumula y el
    //  denominador no, la barra miente, y aquí se mide el error exacto que se veía en
    //  pantalla. Sesenta es el tope del click x2 --treinta minutos--, así que es el
    //  caso en el que más se salen: `restante / 30 s` da **6000 %**, que es la
    //  barra clavada en el 100 % con el contador corriendo de lado a lado.
    const r = g.useConsumable('x2', 60) as any;
    const restante = s(g).buffs.clickX2ExpiresAt - Date.now();
    check('b13: sesenta tarjetas de 30 s dejan el buff en 30 minutos',
      r.usadas === 60 && restante > MIN_30 - 5_000 && restante <= MIN_30,
      `usadas=${r.usadas} restante=${restante}`);
    check('b13: y el total concedido son esos mismos 30 minutos, no 30 s',
      Math.abs((s(g).buffs.clickX2TotalMs as number) - restante) < 5_000,
      `total=${s(g).buffs.clickX2TotalMs} restante=${restante}`);
    check('b13: con el denominador viejo la barra se iba de mil por ciento',
      (restante / 30_000) * 100 > 1000,
      `barra vieja=${((restante / 30_000) * 100).toFixed(0)}%`);

    // **Y LA BARRA DE VERDAD, CON LA FÓRMULA DEL HUD.** Se calcula aquí y no mirando el
    //  DOM porque el banco no tiene layout, pero es la misma cuenta: `restante / total`,
    //  con `total` cayendo a una tarjeta cuando no se sabe.
    const ancho = (restanteMs: number) => {
      const total = totalConcedidoDe(s(g), 'clickX2') || 30_000;
      return Math.max(0, Math.min(100, (restanteMs / total) * 100));
    };
    check('b13: la barra arranca llena',
      ancho(restante) > 95, `ancho=${ancho(restante).toFixed(1)}%`);
    check('b13: y a la mitad del buff le queda la mitad de barra',
      ancho(restante / 2) > 45 && ancho(restante / 2) < 55,
      `ancho=${ancho(restante / 2).toFixed(1)}%`);
    check('b13: y al final se vacía, no se queda clavada',
      ancho(0) === 0, 'ancho=' + ancho(0));

    // **Y EL AFK, QUE VIVE FUERA DE `buffs`, TAMBIÉN TIENE TOTAL.** Es el caso especial
    //  de toda la regla: si el total se escribiera solo dentro de `state.buffs`, el AFK
    //  sería el único buff con la barra rota, y ningún banco de buffs lo vería.
    const g2 = await boot(baseSave([consumable('a1', 'afk', 3, { name: 'Tarjeta AFK' })],
      { warehouseCapacity: 40 }));
    g2.useConsumable('a1', 3);
    check('b13: el AFK anota su total en su propio campo',
      (s(g2).afkTotalMs as number) > 0
      && Math.abs((s(g2).afkTotalMs as number) - (s(g2).afkExpiresAt - Date.now())) < 5_000,
      `total=${s(g2).afkTotalMs}`);
    check('b13: y no escribe nada dentro de buffs',
      !(s(g2).buffs as any).afkTotalMs,
      'afkTotalMs=' + String((s(g2).buffs as any).afkTotalMs));

    // **CANCELAR LO BORRA, O LA BARRA DEL SIGUIENTE ARRANCA CON EL ANCHO DEL VIEJO.**
    //
    // El nombre con el que se anuncia sale de `BUFF_LABELS` y no de una tabla
    // escrita dentro del motor: con dos copias el dialogo decia una cosa y el
    // aviso otra (Q1). Lo comprueba `nombres:` mas abajo.
    check('b13: cancelar el click pone el total a cero',
      (() => {
        const a = g.cancelBuff('clickX2');
        return a === BUFF_LABELS.clickX2
          && s(g).buffs.clickX2TotalMs === 0 && s(g).buffs.clickX2ExpiresAt === 0;
      })(),
      `total=${s(g).buffs.clickX2TotalMs} expira=${s(g).buffs.clickX2ExpiresAt}`);
    // **Y EL AFK, QUE DESDE Q3 TAMBIÉN SE CANCELA, Y SU TOTAL SE BORRA COMO EL OTRO.**
    // Mismo motivo que el click: el denominador de la barra es lo que se concedió, y si
    // cancelar dejara el total escrito, la próxima tarjeta de AFK arrancaría con el ancho
    // de un buff que ya no existe. El caso no se comprobaba antes porque cancelar no
    // existía para el; ahora la regla es la de todos, así que se comprueba igual.
    check(
      'b13: cancelar el AFK apaga su buff y borra su total',
      (() => {
        const antes = s(g2).afkTotalMs as number;
        const a = g2.cancelBuff('afk');
        return a === BUFF_LABELS.afk && s(g2).afkTotalMs === 0
          && s(g2).afkExpiresAt === 0 && antes > 0;
      })(),
      'expira=' + String(s(g2).afkExpiresAt) + ' total=' + String(s(g2).afkTotalMs));
  }
  {
    // **UNA PARTIDA VIEJA NO TIENE EL CAMPO, Y ESO NO PUEDE SER UN NaN.**
    //
    //  Sin `?? 0` el campo llega `undefined`, y `restante / undefined` es `NaN`: un
    //  `width` inválido es una barra que desaparece sin que nadie sepa por qué. Con 0 el
    //  HUD vuelve a la duración de una tarjeta, que es exactamente lo que se pintaba
    //  antes de que este campo existiera.
    const g = await boot(baseSave([], { buffs: BUFFS_ZERO }));
    const guardado = { ...s(g) } as any;
    delete guardado.buffs.clickX2TotalMs;
    delete guardado.buffs.passiveBoostTotalMs;
    delete guardado.afkTotalMs;
    // El campo se borra del guardado **y del estado**, que es como llega una partida
    // de antes del cambio: el documento no lo tiene y la coacción no lo inventa.
    (s(g).buffs as any).clickX2TotalMs = undefined;
    (s(g).buffs as any).passiveBoostTotalMs = undefined;
    (s(g) as any).afkTotalMs = undefined;
    g.updateState({ buffs: { ...(s(g).buffs as any), clickX2ExpiresAt: Date.now() + 30_000 } });
    const g2 = await reload();
    check('b13: una partida vieja sin el campo carga a cero, no a undefined',
      (s(g2).buffs as any).clickX2TotalMs === 0,
      'total=' + String((s(g2).buffs as any).clickX2TotalMs));
    check('b13: y el denominador cae a la duración de una tarjeta',
      (totalConcedidoDe(s(g2), 'clickX2') || 30_000) === 30_000,
      'denominador=' + (totalConcedidoDe(s(g2), 'clickX2') || 30_000));
    check('b13: y el ancho sale finito, que es lo que evita que la barra desaparezca',
      Number.isFinite((s(g2).buffs.clickX2ExpiresAt - Date.now()) / (totalConcedidoDe(s(g2), 'clickX2') || 30_000)),
      'denominador=' + String(totalConcedidoDe(s(g2), 'clickX2')));
    check('b13: y tampoco se rompe la partida vieja por tener un buff sin total',
      s(g2).buffs.clickX2ExpiresAt > Date.now(),
      'expira=' + s(g2).buffs.clickX2ExpiresAt);
  }
  {
    // **Y QUE EL CAMPO SOBREVIVA A LA RECARGA**, que es el motivo de que esté en el
    //  guardado y no en un módulo: si fuera un `let` del módulo, cada recarga pondría la
    //  barra a cero y el buff seguiría puesto.
    const g = await boot(baseSave([
      consumable('p1', 'passiveBoost', 2, { name: 'Buff Pasivo x2' })
    ], { buffs: BUFFS_ZERO }));
    g.useConsumable('p1', 2);
    const antes = s(g).buffs.passiveBoostTotalMs as number;
    const g2 = await reload();
    check('b13: el total del pasivo son sus dos horas',
      antes > MIN_60 && antes <= 2 * MIN_60, `total=${antes}`);
    check('b13: y el total guardado sobrevive a la recarga',
      Math.abs((s(g2).buffs.passiveBoostTotalMs as number) - antes) < 5_000,
      `antes=${antes} despues=${s(g2).buffs.passiveBoostTotalMs}`);
    check('b13: y el buff sigue puesto con el mismo tiempo',
      Math.abs((s(g2).buffs.passiveBoostExpiresAt - s(g).buffs.passiveBoostExpiresAt)) < 5_000,
      `antes=${s(g).buffs.passiveBoostExpiresAt} despues=${s(g2).buffs.passiveBoostExpiresAt}`);
  }

// =========================================================================
  //  BARRA DE ACCESO RÁPIDO: TRES RANURAS QUE ELLE EL JUGADOR
  //
  //  La barra NO elige. Eso es lo que se cambió, y la prueba que va primero es la que
  //  lo demuestra: una partida nueva llega con las tres ranuras vacías aunque tenga
  //  cuatro consumibles en el almacén. Antes se rellenaba sola con los tres más caros,
  //  y el primer síntoma visible fue una Piedra de Calibración en un hueco, que es un
  //  consumible de **Forja**: desde la base no hace nada. Elegir por el jugador es
  //  decidir por él.
  //
  //  Sin elección automática, la lista de lo que se puede poner pasa a ser la regla del
  //  juego y no un filtro de la vista: `CONSUMIBLES_ASIGNABLES` son tres, y lo que no
  //  está ahí no llega a una ranura ni aunque alguien lo escriba en el guardado. Eso es
  //  lo que comprueban las pruebas de Forja.
  //
  //  Y el guardado guarda un `buffId`, no un id de item, porque el almacén rehace ids al
  //  apilar: guardado el id, la ranura apuntaría a un item que ya no existe.
  // =========================================================================

  {
    // **EL BUG DEL FILTRO INVENTADO, QUE SIGUE SIENDO UN BUG POSIBLE.**
    //
    // La barra se escribió con `visibleStacksFor(..., 'consumible', ...)` y
    // `matchesFilter()` no tiene ese valor: los suyos son `all`, `otros`, `collector` y
    // `companion`. Un valor que no es ninguno cae al final de la función y devuelve
    // `filtro === 'all'`, o sea **falso y sin error**: tres huecos vacíos y ninguna pista.
    //
    // Se contrasta con la misma función que aplica el filtro, para que escribir un valor
    // de oído falle aquí en vez de vaciar la barra en la partida de alguien.
    const unItem = consumable('voc', 'afk', 1, { name: 'Uno' });
    check('filtro: el vocabulario de matchesFilter es estos cuatro, y solo estos',
      ['all', 'otros', 'collector', 'companion']
        .filter((f: string) => matchesFilter(unItem, f)).join(',') === 'all,otros',
      'casan=' + ['all', 'otros', 'collector', 'companion']
        .filter((f: string) => matchesFilter(unItem, f)).join(','));
    check('filtro: y un valor inventado no casa con nada, en vez de dar error',
      matchesFilter(unItem, 'consumable') === false
        && matchesFilter(unItem, 'todos') === false,
      'consumible=' + matchesFilter(unItem, 'consumible')
        + ' todos=' + matchesFilter(unItem, 'todos'));
  }

  {
    // **UNA PARTIDA NUEVA EMPIEZA CON LAS TRES RANURAS VACÍAS.** Aunque tenga cuatro
    // consumibles, ninguno entra solo. Esta es la prueba del cambio de fondo: si alguien
    // vuelve a rellenar la barra por su cuenta, esta falla.
    const g = await boot(baseSave([
      consumable('n-a', 'afk', 3, { name: 'AFK' }),
      consumable('n-b', 'clickX2', 1, { name: 'X2' }),
      consumable('n-c', 'clickX3', 1, { name: 'X3' }),
      consumable('n-d', 'clickX2', 1, { name: 'X2 otra' })
    ]));
    const ranuras = g.getBarraConsumibles();
    check('barra: una partida nueva llega con las TRES ranuras vacias',
      ranuras.length === 3 && ranuras.every(h => h.buffId === null && h.itemId === null),
      'buffs=' + ranuras.map((h: any) => String(h.buffId)).join(','));
    check('barra: y con tres huecos fijos, ni uno mas ni uno menos',
      ranuras.length === RANURAS_BARRA,
      'ranuras=' + ranuras.length);
    check('barra: no hay item resuelto en un hueco vacio, que es lo que se gasta',
      ranuras.every(h => h.itemId === null),
      'ids=' + ranuras.map((h: any) => String(h.itemId)).join(','));
  }

  {
    // **ASIGNAR, Y LO QUE PUEDE Y LO QUE NO.**
    const g = await boot(baseSave([
      consumable('a-a', 'afk', 2, { name: 'AFK' }),
      consumable('a-b', 'clickX2', 1, { name: 'X2' }),
      consumable('a-c', 'clickX3', 1, { name: 'X3' })
    ]));
    const ok = g.asignarBarraConsumible(0, 'afk');
    check('barra: se puede asignar un consumible',
      ok.ok === true, ok.msg ?? '');
    check('barra: y el hueco guarda el BUFF, no el id del item',
      s(g).barraConsumibles[0] === 'afk',
      'guardado=' + String(s(g).barraConsumibles[0]));
    check('barra: y getBarra lo resuelve al item del almacen',
      g.getBarraConsumibles()[0].itemId === 'a-a',
      'itemId=' + String(g.getBarraConsumibles()[0].itemId));

    // **EL MISMO EN DOS RANURAS, Y POR QUÉ ES UNA REGLA DEL MOTOR.** El botón tachado
    // es la primera línea de defensa, pero el motor es la que vale: un guardado
    // manipulado podría traer dos ranuras iguales y la barra sería una lista de tres
    // con dos copias.
    const dup = g.asignarBarraConsumible(1, 'afk');
    check('barra: el mismo consumible NO puede estar en dos ranuras',
      dup.ok === false,
      'msg=' + (dup.msg ?? '(aceptado, que es el fallo)'));
    check('barra: y la ranura que se intentaba queda como estaba',
      s(g).barraConsumibles[1] === null,
      'ranura2=' + String(s(g).barraConsumibles[1]));

    // **VOLVER A PONER LO QUE YA ESTÁ EN ESE MISMO HUECO NO ES UN CONFLICTO.** Es una
    // no-op legal. Si no se distingue, elegir lo que ya tienes puesto se rechazaría a sí
    // mismo con "ya está en la ranura 1" estando en la ranura 1.
    const mismo = g.asignarBarraConsumible(0, 'afk');
    check('barra: volver a elegir lo que ya tiene ESE hueco no es un conflicto',
      mismo.ok === true, mismo.msg ?? '');

    check('barra: un consumible de Forja no se puede asignar',
      g.asignarBarraConsumible(2, 'calibrationStone').ok === false
        && g.asignarBarraConsumible(2, 'stabilityNano').ok === false,
      'piedra=' + g.asignarBarraConsumible(2, 'calibrationStone').ok
        + ' nano=' + g.asignarBarraConsumible(2, 'stabilityNano').ok);
    check('barra: ni un expansor, ni un buff inventado, ni una ranura que no existe',
      g.asignarBarraConsumible(2, 'expansorInicial').ok === false
        && g.asignarBarraConsumible(2, 'noExiste').ok === false
        && g.asignarBarraConsumible(7, 'afk').ok === false
        && g.asignarBarraConsumible(-1, 'afk').ok === false,
      'exp=' + g.asignarBarraConsumible(2, 'expansorInicial').ok
        + ' ranura7=' + g.asignarBarraConsumible(7, 'afk').ok);

    check('barra: vaciar un hueco es siempre legal',
      g.asignarBarraConsumible(0, null).ok === true
        && s(g).barraConsumibles[0] === null,
      'ranura1=' + String(s(g).barraConsumibles[0]));
    check('barra: y vaciar un hueco vacio no da error',
      g.asignarBarraConsumible(0, null).ok === true,
      '');
  }

  {
    // **GASTAR DESDE LA BARRA GASTA DE VERDAD, Y POR EL MISMO CAMINO.**
    //
    // La barra llama a `useConsumable()` con el item que le dio el motor. Si tuviera su
    // propia forma de gastar, un cambio en el tope de las tarjetas arreglaría el almacén
    // y dejaría la barra cobrando de más: es el mismo cobro en los dos sitios o no lo es
    // en ninguno.
    const g = await boot(baseSave([consumable('u-a', 'clickX3', 2, { name: 'X3' })]));
    g.asignarBarraConsumible(0, 'clickX3');
    const antes = unidadesDeBuff(g, 'clickX3');
    const res = g.usarBarraConsumible(0);
    const despues = unidadesDeBuff(g, 'clickX3');
    check('barra: gastar desde la barra quita una unidad',
      res.ok === true && despues === antes - 1,
      'antes=' + antes + ' despues=' + despues + ' msg=' + (res.msg ?? ''));
    check('barra: y el item del almacen ha bajado de verdad',
      (s(g).warehouse.find((w: any) => w.id === 'u-a')?.stackCount ?? 0) === antes - 1,
      'pila=' + String(s(g).warehouse.find((w: any) => w.id === 'u-a')?.stackCount));
    check('barra: y el buff esta puesto',
      (s(g).buffs as any).clickX3ExpiresAt > Date.now(),
      'expira=' + String((s(g).buffs as any).clickX3ExpiresAt));

    // **UN HUECO VACÍO NO GASTA NADA Y LO DICE, EN VEZ DE CALLAR.**
    const vacio = g.usarBarraConsumible(2);
    check('barra: un hueco vacio no gasta y devuelve el motivo',
      vacio.ok === false && typeof vacio.msg === 'string' && vacio.msg.length > 0,
      'msg=' + (vacio.msg ?? '(sin mensaje)'));

    // **QUEDARSE SIN EL ITEM NO DESHACE LA ASIGNACIÓN.** La ranura guardada es lo que
    // el jugador eligió; que ahora no tenga con qué gastarse es otra cosa, y si la ranura
    // se borrara sola el selector volvería a quedar vacío sin que nadie lo decidiera.
    g.useConsumable('u-a', 1);
    const g2 = await reload();
    const trasAgotar = g2.getBarraConsumibles()[0];
    check('barra: sin unidades el hueco sigue ocupado y con el nombre a la vista',
      trasAgotar.buffId === 'clickX3' && trasAgotar.unidades === 0 && trasAgotar.nombre.length > 0,
      'buffId=' + String(trasAgotar.buffId) + ' unidades=' + trasAgotar.unidades);
    // **EL MENSAJE DICE LA VERDAD, Y NO CONFUNDE LAS DOS SITUACIONES.** La ranura sigue
    // puesta: lo que se acabó son las tarjetas. Decir "no hay nada asignado" aquí mandaba
    // al selector a reconfigurar algo que estaba bien.
    const sinUnidades = g2.usarBarraConsumible(0);
    check('barra: y no se puede gastar lo que no hay',
      sinUnidades.ok === false,
      'msg=' + (sinUnidades.msg ?? ''));
    check('barra: y el motivo habla de las unidades, no de la asignacion',
      (sinUnidades.msg ?? '').includes('No tienes ninguna')
        && !(sinUnidades.msg ?? '').includes('nada asignado'),
      'msg=' + (sinUnidades.msg ?? ''));
  }

  {
    // **LO QUE GUARDA, Y LO QUE NO SE GUARDA.**
    //
    // Tres ranuras y tres buffs guardados, y tras recargar siguen los tres: si esto no se
    // comprueba, la barra parece funcionar mientras se juega y se olvida al abrir la
    // página al día siguiente (R9).
    const g = await boot(baseSave([
      consumable('s-a', 'afk', 1, { name: 'AFK' }),
      consumable('s-b', 'clickX2', 1, { name: 'X2' }),
      consumable('s-c', 'clickX3', 1, { name: 'X3' })
    ]));
    g.asignarBarraConsumible(0, 'afk');
    g.asignarBarraConsumible(1, 'clickX2');
    g.asignarBarraConsumible(2, 'clickX3');
    const g2 = await reload();
    check('barra: las tres ranuras sobreviven a la recarga',
      JSON.stringify(s(g2).barraConsumibles) === JSON.stringify(['afk', 'clickX2', 'clickX3']),
      'guardado=' + JSON.stringify(s(g2).barraConsumibles));
    check('barra: y siguen resolviendo a su item',
      g2.getBarraConsumibles().map((h: any) => h.itemId).join(',') === 's-a,s-b,s-c',
      'ids=' + g2.getBarraConsumibles().map((h: any) => h.itemId).join(','));
  }

  {
    // **LA COACCIÓN, Y CADA UNA DE SUS TRES REGLAS.**
    //
    // Nada de esto es irreversible así que no sube `SAVE_VERSION`: una ranura se quita
    // escribiendo `null`. Pero un guardado puede venir con cualquier cosa, y cada regla
    // que no se compruebe aquí aparece un día como un hueco que falta o como dos ranuras
    // con lo mismo.
    const guardado = await boot(baseSave([], {
      barraConsumibles: ['afk', 'afk', 'clickX2']
    }));
    check('coaccion: el mismo buff en dos ranuras no sobrevive a la carga',
      JSON.stringify(s(guardado).barraConsumibles) === JSON.stringify(['afk', null, 'clickX2']),
      'quedo=' + JSON.stringify(s(guardado).barraConsumibles));

    const deForja = await boot(baseSave([], {
      barraConsumibles: ['calibrationStone', 'stabilityNano', 'afk']
    }));
    check('coaccion: un buff que ya no se puede asignar se cae',
      JSON.stringify(s(deForja).barraConsumibles) === JSON.stringify([null, null, 'afk']),
      'quedo=' + JSON.stringify(s(deForja).barraConsumibles));

    // **UNA LISTA QUE NO ES UNA LISTA.** No es un caso raro: un guardado con el campo mal
    // es exactamente lo que pasa si alguien lo importa o si una versión vieja lo escribió
    // de otra forma.
    const raro = await boot(baseSave([], { barraConsumibles: 'afk' } as any));
    check('coaccion: si el campo no es una lista, sale una lista de tres huecos vacios',
      JSON.stringify(s(raro).barraConsumibles) === JSON.stringify([null, null, null]),
      'quedo=' + JSON.stringify(s(raro).barraConsumibles));

    const corto = await boot(baseSave([], { barraConsumibles: ['afk'] }));
    check('coaccion: si faltan huecos, se rellenan, y no se inventa contenido',
      JSON.stringify(s(corto).barraConsumibles) === JSON.stringify(['afk', null, null]),
      'quedo=' + JSON.stringify(s(corto).barraConsumibles));

    // **UNA PARTIDA VIEJA NO TIENE EL CAMPO.** Y sale vacía, que es lo único honesto:
    // rellenar ranuras por el juego es lo que se acaba de quitar.
    const vieja = await boot(baseSave([]));
    check('coaccion: una partida sin el campo sale con las tres vacias',
      JSON.stringify(s(vieja).barraConsumibles) === JSON.stringify([null, null, null]),
      'quedo=' + JSON.stringify(s(vieja).barraConsumibles));
  }

  {
    // **UN MISMO BUFF PUEDE VIVIR EN VARIOS ITEMS, Y LA RANURA GASTA DEL MÁS GRUESO.**
    //
    // Las tarjetas se apilan, pero un item no apilable llega suelto, así que un mismo
    // buff puede vivir en varios items. Gastar del más grande es el que aguanta más
    // pulsadas y el que menos veces cambia de id debajo del botón.
    const g = await boot(baseSave([
      consumable('p-pequena', 'afk', 1, { name: 'AFK', stackable: false }),
      consumable('p-grande', 'afk', 5, { name: 'AFK' })
    ]));
    g.asignarBarraConsumible(0, 'afk');
    check('barra: con el buff repartido en dos items, la ranura gasta del mas grande',
      g.getBarraConsumibles()[0].itemId === 'p-grande',
      'itemId=' + String(g.getBarraConsumibles()[0].itemId));
    check('barra: y cuenta unidades de los dos, no de uno',
      unidadesDeBuff(g, 'afk') === 6,
      'unidades=' + unidadesDeBuff(g, 'afk'));
  }

// =========================================================================
  //  3. LAS PIEDRAS: DIEZ QUE SUMAN 12 PUNTOS, Y EL OBJETIVO QUE YA NO ES
  //     SIEMPRE EL 95 %
  //
  //  Eran siete puntos por piedra —diez sumaban 70 y cualquier tirada quedaba
  //  casi segura—. Ahora cada una da 1,2: diez suman exactamente 12, y con eso
  //  **el 95 % deja de ser alcanzable en ningún tier sin suerte del árbol ni
  //  afijos**. Por eso el botón "las necesarias" enseña la probabilidad real con
  //  esas piedras —`previewPiedrasNecesarias()`— y aquí se comprueba la cuenta
  //  que lo rodea y que el número no promete lo que no se puede pagar (R3).
  // =========================================================================
  {
    // **DIEZ SUMAN DOCE, NI UNA MÁS NI UNA MENOS — Y UNA SUMA 1,2.** Es el
    // número que anuncian la tienda, la ficha y el botón: si las diez no suman
    // 12, el "12 %" que ve el jugador no es lo que cobra. Y la coma del texto
    // sale de `PIEDRA_PUNTOS`, que es la misma constante que usa la vista.
    const diez = successChance(5, 0, 10, 0) - successChance(5, 0, 0, 0);
    const una = successChance(5, 0, 1, 0) - successChance(5, 0, 0, 0);
    check('forja: diez piedras suman exactamente 12 puntos',
      Math.abs(diez - 0.12) < 1e-9, diez.toFixed(4));
    check('forja: y una sola suma 1,2, que es la coma del texto que se enseña',
      Math.abs(una - 0.012) < 1e-9 && PIEDRA_PUNTOS === '1,2',
      `una=${una.toFixed(4)} texto=${PIEDRA_PUNTOS}`);

    // **Y CON CINCO, LOS TIERS ALTOS SE QUEDAN MUY CORTOS.** Es la comprobación
    // de la causa: por eso la mano son diez y no cinco, y por eso el botón ya no
    // puede prometer el 95 % con ellas.
    const sinPiedras = (tier: number) => successChance(tier, 0, 0, 0);
    const conCinco = (tier: number) => successChance(tier, 0, 5, 0);
    const noLlegan = [8, 9, 10].filter(t => conCinco(t) < 0.95);
    check('forja: con cinco piedras los tiers altos se quedan corto del 95',
      noLlegan.length > 0,
      'cortos=' + noLlegan.map(t => 'T' + t + '=' + conCinco(t).toFixed(2)).join(' ')
        + ' | base T10=' + sinPiedras(10).toFixed(2));

    // **EL NÚMERO ES EL DE LA REGLA, Y CON ÉL NO SE PROMETE EL 95 %.** En todos
    // los tiers sin suerte ni afijos, las necesarias son el tope de la mano —y el
    // porcentaje real, con esas piedras, se queda por debajo del 95: es donde el
    // botón tiene que decir "sube al X %" y no "para el 95 %". La comprobación
    // invierte la de antes a propósito: antes todas llegaban, y el cambio de
    // siete a 1,2 puntos es justamente el que hizo que ninguna llegara.
    for (const tier of [1, 3, 5, 7, 8, 9, 10]) {
      const n = piedrasParaObjetivo(tier, 0, 0);
      const conN = successChance(tier, 0, n, 0);
      const conUnaMenos = successChance(tier, 0, Math.max(0, n - 1), 0);
      check('forja: T' + tier + ' — las necesarias son el tope y NO se promete el 95',
        n === MAX_PIEDRAS_POR_FUSION && conN < 0.95
          && Math.abs(conN - conUnaMenos - 0.012) < 1e-9,
        `n=${n} conN=${conN.toFixed(3)} conUnaMenos=${conUnaMenos.toFixed(3)}`);
    }

    // **Y CUANDO DE VERDAD SE LLEGA, LO DICE — CON LA MISMA CUENTA.** Con un 10 %
    // de suerte del árbol, el T1 parte de 0,88 y le hacen falta seis: con ellas
    // llega al 95 y con cinco no. Es el otro lado de la honestidad: el botón no
    // es que nunca diga 95, es que solo lo dice cuando el número lo aguanta.
    const nOk = piedrasParaObjetivo(1, 0.10, 0);
    const conOk = successChance(1, 0.10, nOk, 0);
    const sinOk = successChance(1, 0.10, Math.max(0, nOk - 1), 0);
    check('forja: con suerte del árbol sí se llega, y una menos no — el botón lo dice',
      conOk >= 0.95 && nOk > 0 && nOk < MAX_PIEDRAS_POR_FUSION && sinOk < 0.95,
      `n=${nOk} con=${conOk.toFixed(3)} unaMenos=${sinOk.toFixed(3)}`);

    // **CON LAS PASIVAS DEL ÁRBOL, HAY TIERNES DONDE NO HACE FALTA NINGUNA.**
    // Con la base del T1 en 0,78, el árbol puede empujarla por encima de 0,95 y entonces
    // ofrecer "gastar 2" sería cobrar por nada, que es lo que el jugador no perdona en
    // una ruleta.
    const sinNada = piedrasParaObjetivo(1, 0, 0);
    const conSuerte = piedrasParaObjetivo(1, 0.30, 0);
    check('forja: si ya se llega sin gastar, dice cero en vez de inventar piedras',
      sinNada > 0 && conSuerte === 0,
      `sinSuerte=${sinNada} conSuerte=${conSuerte}`);

    // **LOS AFIJOS CUENTAN, Y EL BOTÓN NO PUEDE IGNORARLOS.** Cada afijo de un material
    // da un 2 %, así que dos materiales con afijos bajan el número de piedras. Si el
    // botón no los contara, prometería más de lo necesario —que se puede permitir— o
    // menos, que no: cobrar de más. Se mide en el T1 porque ahí las dos cantidades
    // son distintas: en los tiers altos ambas se topan en el tope de la mano y la
    // diferencia no se ve.
    const sinAfijos = piedrasParaObjetivo(1, 0, 0);
    const conAfijos = piedrasParaObjetivo(1, 0, 0.10);
    check('forja: los afijos de los materiales bajan las piedras necesarias',
      conAfijos < sinAfijos,
      `sin=${sinAfijos} con=${conAfijos}`);

    // **Y QUIEN DICE EL PORCENTAJE DEL BOTÓN ES EL MOTOR, NO LA VISTA.** El
    // preview trae `chanceConNecesarias` —la probabilidad real con esas piedras—
    // y la vista la pinta sin recalcularla. Si este número mintiera, el botón
    // "gastar las necesarias, para el 95 %" prometería algo que la tirada no va
    // a dar, que era exactamente el fallo que se arregló (R3).
    const gPrev = await boot(baseSave([
      consumable('p', 'calibrationStone', 10, { name: 'Piedra de Calibración' })
    ], {}));
    const prev = gPrev.previewPiedrasNecesarias(9, 0);
    check('forja: el preview enseña la probabilidad REAL con las necesarias, y no el 95',
      prev.necesarias === MAX_PIEDRAS_POR_FUSION && prev.chanceConNecesarias < 0.95
        && Math.abs(prev.chanceConNecesarias
          - successChance(9, 0, MAX_PIEDRAS_POR_FUSION, 0)) < 1e-9,
      `n=${prev.necesarias} chance=${prev.chanceConNecesarias}`);
    const prevOk = gPrev.previewPiedrasNecesarias(1, 0.10);
    check('forja: y cuando el 95 se alcanza de verdad, la probabilidad dice 95',
      prevOk.chanceConNecesarias >= 0.95 && prevOk.necesarias > 0
        && prevOk.necesarias < MAX_PIEDRAS_POR_FUSION,
      `n=${prevOk.necesarias} chance=${prevOk.chanceConNecesarias}`);

    // **EL NÚMERO NUNCA ES NEGATIVO NI MAYOR QUE EL TOPE.**
    const todos = [1, 5, 10].flatMap(t =>
      [0, 0.1, 0.5, 1].map(luck =>
        piedrasParaObjetivo(t, luck, 0)));
    check('forja: el numero sale siempre entre 0 y el tope',
      todos.every(n => Number.isInteger(n) && n >= 0 && n <= MAX_PIEDRAS_POR_FUSION),
      'min=' + Math.min(...todos) + ' max=' + Math.max(...todos));

    // **Y EL TOPE SIGUE EXISTIENDO.** Si alguien lo quita, `piedrasParaObjetivo` daría
    // números grandes y "gastar 30" saldría como un botón normal.
    check('forja: y hay tope, porque sin el el boton ofrece gastarlo todo',
      MAX_PIEDRAS_POR_FUSION > 0 && MAX_PIEDRAS_POR_FUSION < 100,
      'tope=' + MAX_PIEDRAS_POR_FUSION);
  }

  // =========================================================================
  //  10. BUFFERS DE COMPAÑERO (F97 Lote 2d)
  // =========================================================================
  //  Los tres buffers dan boost a un tipo de compañero: pasivos, clicks o
  //  global. Se usan desde el almacén como cualquier consumible. Lo que se
  //  comprueba es que cada uno aplica al tipo correcto y no a los demás.
  {
    const poderM1 = poderDeCompanero(1, 3, basePorId('base_com_t1_6'));
    const g = await boot(baseSave([
      consumable('bp', 'compPassiveBoost', 1, { name: 'Buffer Pasivo' }),
      consumable('bc', 'compClickBoost', 1, { name: 'Buffer Click' }),
      consumable('bg', 'compGlobalBoost', 1, { name: 'Buffer Global' }),
      { id: 'm1', name: 'Compañero T1', type: 'companion', details: 'x', rarity: RAREZA_NEUTRA, tier: 1, sellPrice: 100, potential: 3, baseId: 'base_com_t1_6' }
    ], {
      activeCompanions: ['m1'],
      companions: [{ id: 'm1', name: 'Compañero T1', type: 'passive', power: poderM1, rarity: RAREZA_NEUTRA, tier: 1, potential: 3, baseId: 'base_com_t1_6' }]
    }));
    const base = s(g).passiveIncome;
    check('buffer: hay ingreso pasivo de partida', base === poderM1, 'pasivo=' + base);

    // Buffer Pasivo: +50% a pasivos
    g.useConsumable('bp');
    check('buffer: el pasivo sube el ingreso un 50%',
      s(g).passiveIncome === Math.floor(base * 1.5),
      `${base} -> ${s(g).passiveIncome}`);

    // Buffer Click: no afecta a pasivos
    g.useConsumable('bc');
    check('buffer: el de click no afecta a pasivos',
      s(g).passiveIncome === Math.floor(base * 1.5),
      `${s(g).passiveIncome}`);

    // Buffer Global: +25% a todos
    g.useConsumable('bg');
    check('buffer: el global sube el ingreso un 25%',
      s(g).passiveIncome === Math.floor(base * 1.5 * 1.25),
      `${s(g).passiveIncome}`);
  }
  {
    // Con un compañero de click, el buffer de click sí afecta y el de pasivo no.
    const poderM1 = poderDeCompanero(1, 3, basePorId('base_com_t1_6'));
    const g = await boot(baseSave([
      consumable('bp', 'compPassiveBoost', 1, { name: 'Buffer Pasivo' }),
      consumable('bc', 'compClickBoost', 1, { name: 'Buffer Click' }),
      { id: 'm1', name: 'Compañero T1', type: 'companion', details: 'x', rarity: RAREZA_NEUTRA, tier: 1, sellPrice: 100, potential: 3, baseId: 'base_com_t1_6' }
    ], {
      activeCompanions: ['m1'],
      companions: [{ id: 'm1', name: 'Compañero T1', type: 'click', power: poderM1, rarity: RAREZA_NEUTRA, tier: 1, potential: 3, baseId: 'base_com_t1_6' }]
    }));
    const base = s(g).passiveIncome;
    check('buffer: hay ingreso de click de partida', base === poderM1, 'click=' + base);

    g.useConsumable('bp');
    check('buffer: el de pasivo no afecta a clicks',
      s(g).passiveIncome === base,
      `${s(g).passiveIncome}`);

    g.useConsumable('bc');
    check('buffer: el de click sube el ingreso un 50%',
      s(g).passiveIncome === Math.floor(base * 1.5),
      `${base} -> ${s(g).passiveIncome}`);
  }
  {
    // El buffer global aplica a ambos tipos.
    const poderM1 = poderDeCompanero(1, 3, basePorId('base_com_t1_6'));
    const g = await boot(baseSave([
      consumable('bg', 'compGlobalBoost', 1, { name: 'Buffer Global' }),
      { id: 'm1', name: 'Compañero T1', type: 'companion', details: 'x', rarity: RAREZA_NEUTRA, tier: 1, sellPrice: 100, potential: 3, baseId: 'base_com_t1_6' }
    ], {
      activeCompanions: ['m1'],
      companions: [{ id: 'm1', name: 'Compañero T1', type: 'click', power: poderM1, rarity: RAREZA_NEUTRA, tier: 1, potential: 3, baseId: 'base_com_t1_6' }]
    }));
    const base = s(g).passiveIncome;
    g.useConsumable('bg');
    check('buffer: el global sube el ingreso de click un 25%',
      s(g).passiveIncome === Math.floor(base * 1.25),
      `${base} -> ${s(g).passiveIncome}`);
  }
  {
    // Tope de 2 horas para pasivo y click, 1 hora para global.
    const g = await boot(baseSave([consumable('bp', 'compPassiveBoost', 10, { name: 'Buffer Pasivo' })],
      { buffs: BUFFS_ZERO }));
    g.useConsumable('bp');
    g.useConsumable('bp');
    g.useConsumable('bp');
    check('buffer: el tope del pasivo son 2 horas',
      s(g).buffs.compPassiveBoostExpiresAt - Date.now() <= 2 * MIN_60,
      `restante=${s(g).buffs.compPassiveBoostExpiresAt - Date.now()}`);

    const g2 = await boot(baseSave([consumable('bg', 'compGlobalBoost', 10, { name: 'Buffer Global' })],
      { buffs: BUFFS_ZERO }));
    g2.useConsumable('bg');
    g2.useConsumable('bg');
    check('buffer: el tope del global es 1 hora',
      s(g2).buffs.compGlobalBoostExpiresAt - Date.now() <= MIN_60,
      `restante=${s(g2).buffs.compGlobalBoostExpiresAt - Date.now()}`);
  }
  {
    // Los buffers se pueden cancelar.
    const g = await boot(baseSave([consumable('bp', 'compPassiveBoost', 1, { name: 'Buffer Pasivo' })]));
    g.useConsumable('bp');
    const r = g.cancelBuff('compPassiveBoost');
    check('buffer: el pasivo se puede cancelar', r === BUFF_LABELS.compPassiveBoost, String(r));
    check('buffer: y el buff queda a cero', s(g).buffs.compPassiveBoostExpiresAt === 0,
      'expira=' + s(g).buffs.compPassiveBoostExpiresAt);
  }

  // =========================================================================
  //  Q1 · EL NOMBRE DEL BUFF, IGUAL EN LOS DOS SITIOS DONDE SE LEE
  // =========================================================================
  //  El dialogo ("Se pierde el tiempo restante de X") y el aviso que sale al
  //  confirmarlo ("X cancelado") son los dos momentos en los que el jugador lee
  //  el nombre del buff. Eran DOS tablas --`BUFF_DEFS` y una copia privada dentro
  //  de `cancelBuff()`-- y al unificar el vocabulario se movio una y no la otra.
  //
  //  Aqui se fija que las dos lean `BUFF_LABELS`. No es comprobar que la tabla
  //  contiene lo que la tabla contiene: es que el dialogo no tenga la suya. Lo
  //  que el MOTOR devuelve lo fijan los dos casos de arriba (`b13:` y `buffer:`),
  //  que comparan `cancelBuff()` contra esa misma tabla.
  {
    const todos = Object.keys(BUFF_LABELS) as BuffKey[];
    check('nombres: el dialogo dice exactamente lo que dice el aviso',
      todos.every(k => buffLabel(k) === BUFF_LABELS[k]),
      todos.map(k => `${k}=${buffLabel(k)}`).join(' · '));
  }

  resumen('consumibles');
}

export default main();
