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
  techoDeExpansor
} from '../src/data/store';
import {
  boot, reload, check, resumen, s, wh, ids, find, baseSave,
  collector, crate, consumable
} from './kit';

const AFK_MS = AFK_CARD_DURATION_MS;
const MIN_60 = 60 * 60_000;
const MIN_30 = 30 * 60_000;
const BUFFS_ZERO = { clickBoostExpiresAt: 0, passiveBoostExpiresAt: 0, clickX2ExpiresAt: 0, clickX3ExpiresAt: 0 };

async function main() {
  // =========================================================================
  //  1. EXPANSORES: UNO POR TIER, CADA UNO HASTA SU TECHO
  //
  //  LA REGLA ENTERA, QUE ANTES NO TENÍA NI SIQUIERA CASOS:
  //
  //      el expansor T{n} da +{RANURAS} ranuras y vale hasta {15 + 5n}
  //
  //  **EL TECHO ES LO QUE HACE LA REGLA.** Con los tres expansores antiguos los
  //  techos eran 120, 300 y 600, que no frenaban nada: desde 15 de partida el
  //  expansor T1 seguía sirviendo a los 119. Con la escalera de diez, el T1
  //  sirve hasta 20 y a partir de ahí **no se puede usar**: hay que buscar el T2,
  //  que llega a 25.
  //
  //  Y el motivo por el que `WAREHOUSE_MAX_CAP` sigue en 600, pese a que la
  //  escalera acaba en 65, es que **bajarlo haría que
  //  `enforceWarehouseCapacity()` le borrara items del almacén** a quien ya pasó
  //  de 65. El techo frena el crecimiento; nunca recorta lo que ya hay.
  // =========================================================================
  {
    const g = await boot(baseSave([consumable('e1', 'expansorT1', 1, { name: 'Expansor T1' })],
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
    // **LA ESCALERA COMPLETA, LOS DIEZ.** Cada expansor T{n} sirve mientras el
    // almacén esté por debajo de su techo, y usarlo lleva la capacidad
    // **exactamente a su techo**: el T1 a 20, el T2 a 25, el T10 a 65. Eso es la
    // escalera, y es lo que hace que subir de caja siga siendo la decisión buena:
    // sin el expansor del siguiente tier no se puede pasar de ese peldaño.
    const g = await boot(baseSave([], { warehouseCapacity: WAREHOUSE_BASE_CAP }));
    let fallos = 0;
    let mensaje = '';
    for (const e of EXPANSOR_TIERS) {
      const esperado = techoDeExpansor(e.tier);
      g.updateState({ warehouse: [consumable('x1', e.buffId, 1, { name: e.name })] });
      const r = g.useConsumable('x1');
      if (!r.ok || s(g).warehouseCapacity !== esperado) {
        fallos++;
        if (!mensaje) mensaje = `T${e.tier}: ok=${r.ok} cap=${s(g).warehouseCapacity} esperado=${esperado} msg=${r.msg}`;
      }
    }
    check('expansor: los diez llevan la capacidad a su techo, uno detrás de otro',
      fallos === 0 && s(g).warehouseCapacity === techoDeExpansor(EXPANSOR_TIERS.length),
      `${fallos} fallos · final=${s(g).warehouseCapacity} · ${mensaje}`);
  }
  {
    // **Y EL RECHAZO, QUE ES LA MITAD DE LA REGLA.** Ya en el techo del T1, el
    // Expansor T1 no se puede usar, no se gasta y el mensaje dice cuál hace
    // falta: el jugador no tiene que adivinar qué comprar.
    const g = await boot(baseSave([consumable('e1', 'expansorT1', 1, { name: 'Expansor T1' })],
      { warehouseCapacity: techoDeExpansor(1) }));
    const r = g.useConsumable('e1');
    check('expansor: en su propio techo NO se usa',
      !r.ok && s(g).warehouseCapacity === techoDeExpansor(1), `ok=${r.ok} cap=${s(g).warehouseCapacity}`);
    check('expansor: y NO se gasto el item', wh(g).length === 1, ids(g).join(','));
    check('expansor: y el mensaje dice el numero y el expansor que falta',
      /20/.test(r.msg ?? '') && /Expansor T2/.test(r.msg ?? ''), r.msg ?? '');
  }
  {
    // Un expansor alto en un almacén pequeño SÍ sirve: la regla es techo, no
    // banda. Si solo valiera a partir de su techo, sería botín muerto.
    const g = await boot(baseSave([consumable('e1', 'expansorT7', 1, { name: 'Expansor T7' })],
      { warehouseCapacity: 15 }));
    const r = g.useConsumable('e1');
    check('expansor: el T7 en un almacen de 15 si sirve', r.ok, r.msg ?? '');
    check('expansor: y sube 5, no 12', s(g).warehouseCapacity === 20,
      'cap=' + s(g).warehouseCapacity);
  }
  {
    // El tope duro de 600 sigue existiendo para el +1 viejo. El T10 acaba en 65,
    // así que para llegar a 600 hace falta el stock antiguo.
    const g = await boot(baseSave([consumable('e1', 'expansorT10', 1, { name: 'Expansor T10' })],
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
    const g = await boot(baseSave([consumable('e1', 'expansorT3', 1, { name: 'Expansor T3' })], {
      warehouseCapacity: 28,
      nodeLevels: { storage_rack: 2, scrapyard: 1 },
      unlockedNodes: ['storage_rack', 'scrapyard']
    }));
    const r = g.useConsumable('e1');
    check('expansor: con la base en 28 y slots del arbol se aplica', r.ok, r.msg ?? '');
    check('expansor: y sube solo la BASE, no el total',
      s(g).warehouseCapacity === 33, 'base=' + s(g).warehouseCapacity);
  }
  {
    // Una pila de expansores: usar uno baja el contador, no borra la celda.
    const g = await boot(baseSave([consumable('e1', 'expansorT2', 3, { name: 'Expansor T2' })],
      { warehouseCapacity: 15 }));
    const antes = s(g).warehouseCapacity;
    const r = g.useConsumable('e1');
    check('expansor: una pila de 3 se queda en 2', r.ok && find(g, 'e1')?.stackCount === 2,
      `ok=${r.ok} stack=${find(g, 'e1')?.stackCount}`);
    check('expansor: y la capacidad sube 5', s(g).warehouseCapacity === antes + RANURAS_POR_EXPANSOR,
      `${antes} -> ${s(g).warehouseCapacity}`);
  }
  {
    const g = await boot(baseSave([consumable('e1', 'expansorT2', 2, { name: 'Expansor T2' })], {
      warehouseCapacity: techoDeExpansor(2)
    }));
    const r = g.useConsumable('e1');
    check('expansor: en el techo del T2 NO se gasta ni una unidad de la pila',
      !r.ok && find(g, 'e1')?.stackCount === 2, `stack=${find(g, 'e1')?.stackCount}`);
  }
  {
    // El +1 de antes de los tipos sigue sirviendo, con el tope duro. Es el único
    // camino por encima de los 65 de la escalera de expansores.
    const g = await boot(baseSave([consumable('e1', 'warehouseExpander', 1, { name: 'Expansor de Almacén' })],
      { warehouseCapacity: 65 }));
    const capAntes = s(g).warehouseCapacity;
    const r = g.useConsumable('e1');
    check('expansor: el +1 viejo se aplica por encima de la escalera', r.ok, r.msg ?? '');
    check('expansor: y sube la capacidad 1', s(g).warehouseCapacity === capAntes + 1,
      `${capAntes} -> ${s(g).warehouseCapacity}`);
  }
  {
    // **Y LA TABLA NO PUEDE SEPARARSE DE LOS DIEZ CASES DEL MOTOR.** El
    // `switch` de `useConsumable` tiene un `case` por buffId escrito a mano: un
    // expansor nuevo que no se añada ahí nace muerto, en silencio, hasta que
    // alguien lo usa y no pasa nada. Aquí se mira que los dos coincidan.
    const buffsDeTabla = EXPANSOR_TIERS.map(e => e.buffId);
    const faltan = buffsDeTabla.filter(b => !(b in CONSUMABLES));
    check('expansor: los diez buffIds de la tabla son consumibles',
      faltan.length === 0, `faltan: ${faltan.join(',') || 'ninguno'}`);
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
    // Tope de 1 hora para el buff de click, aunque cada tarjeta dure 30 min.
    const g = await boot(baseSave([consumable('b1', 'clickBoost', 5, { name: 'Buff Clicks x2' })],
      { buffs: BUFFS_ZERO }));
    g.useConsumable('b1');
    const tras = s(g).buffs.clickBoostExpiresAt - Date.now();
    check('clickBoost: la primera tarjeta da 30 minutos', tras <= MIN_30, `restante=${tras}`);
    g.useConsumable('b1');
    const tras2 = s(g).buffs.clickBoostExpiresAt - Date.now();
    check('clickBoost: la segunda NO puede pasar de 1 hora', tras2 <= MIN_60, `restante=${tras2}`);
    check('clickBoost: pero consume las dos unidades', find(g, 'b1')?.stackCount === 3,
      String(find(g, 'b1')?.stackCount));
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
    const g = await boot(baseSave([
      consumable('b2', 'passiveBoost', 1, { name: 'Buff Pasivo x2' }),
      { id: 'm1', name: 'Compañero T1', type: 'companion', details: 'x', rarity: 'Épico', tier: 1, sellPrice: 100 }
    ], {
      activeCompanions: ['m1'],
      companions: [{ id: 'm1', name: 'Compañero T1', type: 'passive', power: 10, rarity: 'Épico', tier: 1 }]
    }));
    const pasivoSinBuff = s(g).passiveIncome;
    check('passiveBoost: hay ingreso pasivo de partida', pasivoSinBuff === 10, 'pasivo=' + pasivoSinBuff);
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
    const g = await boot(baseSave([
      consumable('p1', 'calibrationStone', 2, { name: 'Piedra de Calibración' }),
      consumable('n1', 'stabilityNano', 1, { name: 'Nanopartícula de Estabilidad' })
    ]));
    const r1 = g.useConsumable('p1');
    const r2 = g.useConsumable('n1');
    check('forja: la Piedra de Calibracion se rechaza desde el almacen', !r1.ok, r1.msg ?? '');
    check('forja: y avisa de que es para la Forja', /Forja/i.test(r1.msg ?? ''), r1.msg ?? '');
    check('forja: la Nanoparticula se rechaza desde el almacen', !r2.ok, r2.msg ?? '');
    check('forja: y avisa tambien', /Forja/i.test(r2.msg ?? ''), r2.msg ?? '');
    check('forja: ninguno de los dos se gasta', wh(g).length === 2, ids(g).join(','));
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
      consumable('e1', 'expansorT1', 2, { name: 'Expansor T1' }),
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
    const etiqueta = g.cancelBuff('afk');
    check('cancelar: se puede cancelar el buff AFK', !!etiqueta, String(etiqueta));
    check('cancelar: y el buff se desactiva', s(g).afkExpiresAt === 0, 'expira=' + s(g).afkExpiresAt);
    check('cancelar: el item NO se devuelve', wh(g).length === 1, ids(g).join(','));
    check('cancelar: el tiempo restante se pierde, no se recupera',
      s(g).afkCards === 1, 'afkCards=' + s(g).afkCards);
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

  resumen('consumibles');
}

export default main();
