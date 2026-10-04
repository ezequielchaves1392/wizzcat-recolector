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
import { totalConcedidoDe } from '../src/data/buffs';
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
  //      el expansor T{n} da +1 ranura y vale hasta {15 + 10n}
  //
  //  **EL TECHO ES LO QUE HACE LA REGLA.** Con los tres expansores antiguos los
  //  techos eran 120, 300 y 600, que no frenaban nada: desde 15 de partida el
  //  expansor T1 seguía sirviendo a los 119. Con la escalera de diez, el T1
  //  sirve hasta 25 y a partir de ahí **no se puede usar**: hay que buscar el T2,
  //  que llega a 35.
  //
  //  Y el motivo por el que `WAREHOUSE_MAX_CAP` sigue en 600, pese a que la
  //  escalera acaba en 115, es que **bajarlo haría que
  //  `enforceWarehouseCapacity()` le borrara items del almacén** a quien ya pasó
  //  de 115. El techo frena el crecimiento; nunca recorta lo que ya hay.
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
    // **LA ESCALERA COMPLETA, LOS DIEZ, Y CON EL LOTE DE UN DIALOGO.** Cada expansor
    // T{n} sirve mientras el almacén esté por debajo de su techo y da **una ranura por
    // uso**, así que un peldaño son diez usos: el T1 lleva 15 a 25, el T2 de 25 a 35, el
    // T10 hasta 115. Eso es la escalera, y es lo que hace que subir de caja siga siendo
    // la decisión buena: sin el expansor del siguiente tier no se pasa de ese peldaño.
    //
    // Y son diez usos porque el expansor da +1, no el peldaño entero: la tienda da el
    // primer tramo y el botín de las cajas el resto. El lote es lo que hace que eso no
    // sea un fastidio: `useConsumable(id, n)` con el número que dice el plan deja el
    // almacén en su techo de un golpe.
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
          mensaje = `T${e.tier}: ok=${r.ok} usadas=${r.usadas} de ${pila} `
            + `cap=${s(g).warehouseCapacity} esperado=${esperado} msg=${r.msg}`;
        }
      }
    }
    check('expansor: los diez llevan la capacidad a su techo, uno detrás de otro',
      fallos === 0 && s(g).warehouseCapacity === techoDeExpansor(EXPANSOR_TIERS.length),
      `${fallos} fallos · final=${s(g).warehouseCapacity} · ${mensaje}`);
    check('expansor: y cada peldaño son diez usos, uno por ranura',
      EXPANSOR_TIERS.every(e => e.slots === 1)
      && techoDeExpansor(1) - WAREHOUSE_BASE_CAP === 10,
      `slots=${EXPANSOR_TIERS[0].slots} peldaño=${techoDeExpansor(1) - WAREHOUSE_BASE_CAP}`);
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
      new RegExp(String(techoDeExpansor(1))).test(r.msg ?? '') && /Expansor T2/.test(r.msg ?? ''),
      r.msg ?? '');
  }
  {
    // Un expansor alto en un almacén pequeño SÍ sirve: la regla es techo, no
    // banda. Si solo valiera a partir de su techo, sería botín muerto.
    const g = await boot(baseSave([consumable('e1', 'expansorT7', 1, { name: 'Expansor T7' })],
      { warehouseCapacity: 15 }));
    const r = g.useConsumable('e1');
    check('expansor: el T7 en un almacen de 15 si sirve', r.ok, r.msg ?? '');
    check('expansor: y sube una sola ranura, no el escalon entero',
      s(g).warehouseCapacity === 16, 'cap=' + s(g).warehouseCapacity);
  }
  {
    // El tope duro de 600 sigue existiendo para el +1 viejo. El T10 acaba en 115,
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
      s(g).warehouseCapacity === 29, 'base=' + s(g).warehouseCapacity);
  }
  {
    // Una pila de expansores: usar uno baja el contador, no borra la celda.
    const g = await boot(baseSave([consumable('e1', 'expansorT2', 3, { name: 'Expansor T2' })],
      { warehouseCapacity: 15 }));
    const antes = s(g).warehouseCapacity;
    const r = g.useConsumable('e1');
    check('expansor: una pila de 3 se queda en 2', r.ok && find(g, 'e1')?.stackCount === 2,
      `ok=${r.ok} stack=${find(g, 'e1')?.stackCount}`);
    check('expansor: y la capacidad sube una ranura por unidad', s(g).warehouseCapacity === antes + RANURAS_POR_EXPANSOR,
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
    // camino por encima de los 115 de la escalera de expansores.
    const g = await boot(baseSave([consumable('e1', 'warehouseExpander', 1, { name: 'Expansor de Almacén' })],
      { warehouseCapacity: 115 }));
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
    // Con 18 de capacidad y un T1 que vale hasta 25, la cuenta es de siete unidades, no
    // de cinco ni de una: `ceil((techo - base) / ranuras)` con una ranura por expansor es
    // exactamente "cuántas veces cabe", y es el mismo número que el diálogo le enseña al
    // jugador. Por eso el lote aquí no es una comodidad: es la única forma cómoda de
    // subir un peldaño.
    const g = await boot(baseSave([consumable('e1', 'expansorT1', 12, { name: 'Expansor T1' })],
      { warehouseCapacity: 18 }));
    const plan = g.planUseConsumable('e1');
    check('lote: el expansor cuenta las ranuras que faltan hasta su techo',
      plan.unidades === techoDeExpansor(1) - 18, `unidades=${plan.unidades}`);
    const r = g.useConsumable('e1', 12) as any;
    const queda = (g.getState().warehouse as any[]).find((w: any) => w.id === 'e1');
    check('lote: y al pedir doce usa solo las que caben y deja el resto',
      r.ok === true && r.usadas === plan.unidades && (queda?.stackCount ?? 0) === 12 - plan.unidades,
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
    check('b13: cancelar el click pone el total a cero',
      (() => {
        const a = g.cancelBuff('clickX2');
        return a === 'Clics x2 (tarjeta)'
          && s(g).buffs.clickX2TotalMs === 0 && s(g).buffs.clickX2ExpiresAt === 0;
      })(),
      `total=${s(g).buffs.clickX2TotalMs} expira=${s(g).buffs.clickX2ExpiresAt}`);
    check('b13: y cancelar el AFK también',
      (() => { const a = g2.cancelBuff('afk'); return a === 'AFK' && s(g2).afkTotalMs === 0; })(),
      'afkTotalMs=' + String(s(g2).afkTotalMs));
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

  resumen('consumibles');
}

export default main();
