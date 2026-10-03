// ==========================================================================
//  Banco de pruebas del game loop real (no una reimplementación)
//
//  Arranca `createGameLoop()` de verdad contra un Firestore en memoria y
//  comprueba, tipo por tipo, que vender saca el item del almacén y que no
//  reaparece ni al re-sincronizar ni al recargar la partida.
//
//  Los stubs de `firebase/*` se inyectan por alias en `verify/vite.config.ts`.
// ==========================================================================

import { createGameLoop } from '../src/gameLoop';
import * as factories from './kit';

type Row = { name: string; ok: boolean; detail: string };
const rows: Row[] = [];

function check(name: string, ok: boolean, detail = '') {
  rows.push({ name, ok, detail });
}

const USER = { uid: 'test', displayName: 'Probador' };
const DB = 'users/test';

/** Guarda una partida en la "base de datos" y arranca el game loop con ella. */
async function boot(save: any) {
  globalThis.__MEM_DB__ = {};
  if (save) globalThis.__MEM_DB__[DB] = JSON.parse(JSON.stringify(save));
  return await createGameLoop(USER, () => {});
}

/** Vuelve a cargar la partida desde lo último guardado, como si refrescaran. */
async function reload() {
  const game = await createGameLoop(USER, () => {});
  return game;
}

const ids = (g: any) => (g.getState().warehouse as any[]).map((w: any) => w.id);
const nanites = (g: any) => g.getState().nanites;
const find = (g: any, id: string) => (g.getState().warehouse as any[]).find((w: any) => w.id === id);
/** El almacén como array, para mirar una unidad concreta de una pila. */
const wh = (g: any): any[] => g.getState().warehouse as any[];
// Cuenta por tipo, no por id: el bug de las cajas las resucitaba con un id
// NUEVO, así que buscar el id viejo daba un falso "desapareció".
const deType = (g: any, type: string) => (g.getState().warehouse as any[]).filter((w: any) => w.type === type).length;

// --------------------------------------------------------------------------
//  Utilidades para construir partidas
// --------------------------------------------------------------------------

const collector = (id: string, tier = 3) => ({
  id, name: 'Recolector T' + tier, type: 'collector', details: 'Recolección por click: +20',
  rarity: 'Épico', tier, level: 0, damage: 20, sellPrice: 500
});
const companion = (id: string, tier = 3) => ({
  id, name: 'Compañero T' + tier, type: 'companion', details: 'Recolección por segundo: +10/s',
  rarity: 'Épico', tier, sellPrice: 2000
});
// F31 · ESTE BANCO TENÍA SUS PROPIAS FÁBRICAS DE ITEM, Y NO DEBERÍA.
//
// `crate`, `key` y `crystal` estaban definidas aquí **además** de las de `kit.ts`,
// con tablas de nombres propias. Y las dos copias ya se habían separado: las
// listas de aquí tenían cuatro nombres y el juego tenía diez. Un banco que
// fabrica un `Cristal Singular` que el juego no fabrica mide un objeto que no
// existe, que es la forma más tranquila de tener un banco en verde y falso.
const { crate, key, crystal } = factories;

/**
 * Y la de consumible, que aquí tenía OTRA FIRMA: `(id, stack, over)` en vez de
 * `(id, buffId, stack, over)`. Al cambiar a la del kit sin querer, `consumable('u1', 3)`
 * pasó a significar "tres tarjetas AFK" cuando quería decir "una pila de tres", y
 * los catorce bancos de AFK de este fichero se cayeron de golpe. Una firma
 * distinta en dos sitios que se llaman igual es peor que un nombre distinto:
 * compila, y falla por el motivo equivocado.
 */
const consumable = (id: string, stack = 1, over: any = {}) =>
  factories.consumable(id, 'afk', stack, { name: 'Tarjeta AFK', ...over });
/** Un recolector como lo guardaba el juego ANTES del renombre a 'collector'. */
const legacyWeapon = (id = 'weapon_blaster_001', over: any = {}) => ({
  id, name: 'Blaster Láser', type: 'weapon', details: 'Recolección por click: +5',
  rarity: 'Común', tier: 1, level: 0, damage: 5, sellPrice: 250, ...over
});
/** Partida base con contadores ya en paz con el almacén. */
function baseSave(warehouse: any[], extra: any = {}) {
  // F31 · Diez niveles, y el nivel se lee del número del nombre con la misma
  // regla que usa el juego. Antes eran cuatro claves y una cadena de `includes`
  // que adivinaba la rareza por el texto —otra copia de la regla del motor—.
  const crates: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
  warehouse.forEach(w => {
    if (w.type !== 'crate') return;
    const m = /caja t(\d+)/.exec(String(w.name || '').toLowerCase());
    if (!m) return;
    crates[Number(m[1])] += w.stackCount || 1;
  });
  return {
    saveVersion: 7, nanites: 1000, warehouse, crates,
    companions: [], activeCompanions: [], equippedCollectorId: null,
    keys: 0, upgradeCrystals: 0, warehouseCapacity: 30,
    ...extra
  };
}

// ==========================================================================
//  Casos
// ==========================================================================

async function main() {
  // --- 1. Caja suelta: el caso que reportó el jugador --------------------
  {
    const g = await boot(baseSave([crate('c1')]));
    const antes = nanites(g);
    const r = g.sellItem('c1');
    const s = g.getState();
    check('caja suelta: sellItem devuelve ok', r.ok, r.msg ?? '');
    check('caja suelta: el almacén se queda vacío', (s.warehouse as any[]).length === 0, ids(g).join(','));
    check('caja suelta: contador de cajas a 0', s.crates[1] === 0, 'crates[1]=' + s.crates[1]);
    check('caja suelta: paga el precio', r.gained === 125 && nanites(g) === antes + 125, 'ganado=' + r.gained);

    const g2 = await reload();
    check('caja suelta: no revive al recargar', (g2.getState().warehouse as any[]).length === 0, ids(g2).join(','));
  }

  // --- 2. Pila de cajas --------------------------------------------------
  {
    const g = await boot(baseSave([crate('c1', 1, 4)]));
    const r = g.sellItem('c1');
    check('pila de 4 cajas: se vende entera', r.ok && deType(g, 'crate') === 0, ids(g).join(','));
    check('pila de 4 cajas: paga 4 x 125', r.gained === 500, 'ganado=' + r.gained);
    check('pila de 4 cajas: contador a 0', g.getState().crates[1] === 0, 'crates[1]=' + g.getState().crates[1]);
  }

  // --- 3. Dos cajas del mismo tipo, una a una ----------------------------
  //
  //     Desde `data/stacking` dos items apilables del MISMO tipo y nombre se
  //     funden en una sola pila al cargar. Dos cajas iguales ya no son "dos
  //     entradas que se venden de una en una": son una pila de 2 que se vende
  //     entera. Para seguir comprobando la venta de uno en uno hace falta que sean
  //     cajas DISTINTAS, y ese caso es ahora el 3b.
  {
    const g = await boot(baseSave([crate('c1', 1), crate('c2', 6)]));
    const antes = nanites(g);
    g.sellItem('c1');
    check('dos cajas distintas: tras la primera queda 1',
      deType(g, 'crate') === 1 && g.getState().crates[1] === 0 && g.getState().crates[6] === 1,
      'comunes=' + g.getState().crates[1] + ' epicas=' + g.getState().crates[6]);
    g.sellItem('c2');
    check('dos cajas distintas: tras la segunda no queda ninguna',
      deType(g, 'crate') === 0 && g.getState().crates[1] === 0 && g.getState().crates[6] === 0,
      'comunes=' + g.getState().crates[1] + ' epicas=' + g.getState().crates[6]);
    check('dos cajas distintas: paga las dos', nanites(g) === antes + 125 + 125, 'nanites=' + nanites(g));
    const g2 = await reload();
    check('dos cajas distintas: no revive ninguna al recargar',
      deType(g2, 'crate') === 0 && g2.getState().crates[6] === 0, 'ids=' + ids(g2).join(','));
  }
  {
    // 3b. Dos cajas IGUALES son una pila: se venden enteras, se pagan las dos, y
    // el contador baja de dos a cero de golpe. Vender "una de dos" ya no es un
    // caso que exista, y el banco tiene que decirlo para que no se vuelva a
    // escribir esperando ese comportamiento.
    const g = await boot(baseSave([crate('c1'), crate('c2')]));
    const antes = nanites(g);
    check('pila de cajas iguales: se funden en un solo item', deType(g, 'crate') === 1,
      'items=' + deType(g, 'crate'));
    check('pila de cajas iguales: y el contador sigue diciendo 2', g.getState().crates[1] === 2,
      'crates[1]=' + g.getState().crates[1]);
    const r = g.sellItem('c1');
    check('pila de cajas iguales: vender una se lleva la pila entera',
      r.ok && deType(g, 'crate') === 0, 'quedan=' + deType(g, 'crate'));
    check('pila de cajas iguales: paga las dos unidades', nanites(g) === antes + 250, 'nanites=' + nanites(g));
    check('pila de cajas iguales: y el contador queda a 0', g.getState().crates[1] === 0,
      'crates[1]=' + g.getState().crates[1]);
    const g2 = await reload();
    check('pila de cajas iguales: no revive al recargar', deType(g2, 'crate') === 0, 'ids=' + ids(g2).join(','));
  }

  // --- 4. Los otros cuatro tipos ----------------------------------------
  {
    const g = await boot(baseSave([key('k1', 1, 3)]));
    const r = g.sellItem('k1');
    check('llave: desaparece', r.ok && deType(g, 'key') === 0, ids(g).join(','));
    check('llave: contador de llaves a 0', g.getState().keys === 0, 'keys=' + g.getState().keys);
    check('llave: paga 3 unidades', r.gained === 1440, 'ganado=' + r.gained);
    const g2 = await reload();
    check('llave: no revive al recargar', deType(g2, 'key') === 0, ids(g2).join(','));
  }
  {
    const g = await boot(baseSave([crystal('x1', 1, 2)]));
    const r = g.sellItem('x1');
    check('cristal: desaparece', r.ok && deType(g, 'crystal') === 0, ids(g).join(','));
    check('cristal: contador a 0', g.getState().upgradeCrystals === 0, 'crystals=' + g.getState().upgradeCrystals);
  }
  {
    const g = await boot(baseSave([consumable('u1', 2)]));
    const r = g.sellItem('u1');
    check('consumible: desaparece', r.ok && deType(g, 'consumable') === 0, ids(g).join(','));
    check('consumible: paga 2 unidades', r.gained === 5000, 'ganado=' + r.gained);
  }
  {
    const g = await boot(baseSave([companion('m1'), companion('m2')],
      { companions: [{ id: 'm1', name: 'Compañero T3', type: 'passive', power: 10, rarity: 'Épico', tier: 3 },
                     { id: 'm2', name: 'Compañero T3', type: 'passive', power: 10, rarity: 'Épico', tier: 3 }] }));
    const r = g.sellItem('m1');
    check('compañero: desaparece del almacén', r.ok && deType(g, 'companion') === 1, ids(g).join(','));
    check('compañero: sale de state.companions',
      !g.getState().companions.some((c: any) => c.id === 'm1'),
      JSON.stringify(g.getState().companions.map((c: any) => c.id)));
    const g2 = await reload();
    check('compañero: no vuelve por la sincronización', deType(g2, 'companion') === 1, ids(g2).join(','));
  }
  {
    const g = await boot(baseSave([collector('r1'), collector('r2')]));
    const r = g.sellItem('r1');
    check('recolector: desaparece', r.ok && deType(g, 'collector') === 1, ids(g).join(','));
    check('recolector: queda el otro', !!find(g, 'r2'), ids(g).join(','));
    const g2 = await reload();
    check('recolector: no revive al recargar', deType(g2, 'collector') === 1, ids(g2).join(','));
  }

  // --- 5. Reglas que deben seguir en pie ---------------------------------
  {
    const g = await boot(baseSave([collector('r1'), collector('r2')], { equippedCollectorId: 'r1' }));
    const r = g.sellItem('r1');
    check('recolector equipado: se rechaza', !r.ok && !!r.msg, r.msg ?? '');
    check('recolector equipado: sigue en el almacén', deType(g, 'collector') === 2, ids(g).join(','));
  }
  {
    const g = await boot(baseSave([collector('r1')]));
    const r = g.sellItem('r1');
    check('último recolector: se rechaza', !r.ok && deType(g, 'collector') === 1, r.msg ?? '');
  }
  {
    const g = await boot(baseSave([key('k1')]));
    const r = g.sellItem('k1');
    const r2 = g.sellItem('k1');
    check('vender dos veces el mismo id: la 2ª falla', r.ok && !r2.ok, r2.msg ?? '');
  }

  // --- 6. Abrir una caja: el otro camino que reutilizaba el contador ----
  {
    const g = await boot(baseSave([crate('c1'), key('k1', 1)]));
    const r = g.openCrateBox('c1', 'k1');
    check('abrir caja: ok', r.ok, r.msg ?? '');
    // **EL RECUENTO, NO "NO QUEDA NINGUNA CAJA".**
    //
    // El botín de una caja puede soltar cajas, así que la prueba pedía que no
    // quedara ninguna en el almacén y fallaba de verdad cuando salía una: el
    // almacenamiento está bien, lo mal escrito era el recuento. Decía "se
    // consumió" mirando algo que el botín puede cambiar por diseño.
    //
    // Lo que hay que comprobar es que la caja abierta **ha dejado de existir**.
    check('abrir caja: la caja se consume',
      !find(g, 'c1') && g.getState().crates[1] === 0,
      `sigue=${ids(g).join(',')} crates[1]=${g.getState().crates[1]}`);
    // El botín es aleatorio y puede soltar llaves, así que se comprueba la
    // llave concreta gastada, no el recuento de llaves del almacén.
    check('abrir caja: la llave se consume', !find(g, 'k1'), ids(g).join(','));
    const g2 = await reload();
    check('abrir caja: no revive al recargar', g2.getState().crates[1] === 0, 'crates[1]=' + g2.getState().crates[1]);
  }

  // --- 7. Migración: el contador sí puede crear cajas, pero solo al cargar
  {
    const g = await boot({ ...baseSave([]), crates: { common: 3, rare: 0, epic: 0, legendary: 0 }, keys: 0 });
    check('migración: contador huérfano se materializa', g.getState().crates[1] === 3,
      'crates[1]=' + g.getState().crates[1]);
    const g2 = await reload();
    check('migración: no duplica al cargar otra vez', g2.getState().crates[1] === 3,
      'crates[1]=' + g2.getState().crates[1]);
    // Y una vez migrado, vender funciona igual. Las 3 cajas huérfanas se
    // materializan en UNA sola pila, así que venderla las elimina todas.
    const primera = (g2.getState().warehouse as any[]).find(w => w.type === 'crate')!.id;
    g2.sellItem(primera);
    check('migración: tras vender, no queda ninguna',
      g2.getState().crates[1] === 0 && deType(g2, 'crate') === 0,
      'crates[1]=' + g2.getState().crates[1] + ' items=' + deType(g2, 'crate'));
  }

  // --- 8. Partida nueva y prestigio: los dos Sites donde sí se crea ------
  {
    globalThis.__MEM_DB__ = {};
    const g = await createGameLoop(USER, () => {});
    check('partida nueva: recibe 2 cajas comunes', g.getState().crates[1] === 2,
      'crates[1]=' + g.getState().crates[1]);
    check('partida nueva: las cajas son items reales', deType(g, 'crate') === 1,
      'items de caja=' + deType(g, 'crate') + ' (las 2 en una sola pila)');
    check('partida nueva: y la pila lleva las 2 unidades',
      wh(g).find((w: any) => w.type === 'crate')?.stackCount === 2,
      'stackCount=' + wh(g).find((w: any) => w.type === 'crate')?.stackCount);
  }
  {
    const g = await boot(baseSave([crate('c1'), crate('c2'), collector('r1'), collector('r2'), key('k1', 1, 5)],
      { totalNanitesProduced: 5_000_000, totalCores: 1 }));
        const r = g.prestige();
    check('prestigio: se concede', r.success, r.msg ?? '');
    check('prestigio: el almacén se vacía de lo reciclado', deType(g, 'crate') === 1 && deType(g, 'key') === 0,
      'cajas=' + deType(g, 'crate') + ' llaves=' + deType(g, 'key'));
    check('prestigio: las 2 cajas de partida nueva son reales',
      g.getState().crates[1] === 2 && deType(g, 'crate') === 1,
      'contador=' + g.getState().crates[1] + ' items=' + deType(g, 'crate'));
    const g2 = await reload();
    check('prestigio: las cajas no se duplican al recargar', g2.getState().crates[1] === 2,
      'contador=' + g2.getState().crates[1]);
  }

  // --- 9. Contador de tarjetas AFK: unidades, no items --------------------
  {
    // Una sola pila de 3 tarjetas. El contador viejo contaba items, así que
    // decía 1.
    const g = await boot(baseSave([consumable('u1', 3)]));
    check('AFK: una pila de 3 cuenta 3', g.getState().afkCards === 3, 'afkCards=' + g.getState().afkCards);

    // Tres tarjetas sueltas de 1 se funden en una pila de 3 al cargar, así que
    // ahora son el mismo caso que el de arriba. El total es el que importa: 3.
    const g2 = await boot(baseSave([consumable('u1'), consumable('u2'), consumable('u3')]));
    check('AFK: 3 tarjetas sueltas cuentan 3', g2.getState().afkCards === 3, 'afkCards=' + g2.getState().afkCards);

    // Dos pilas DISTINTAS de tarjetas (distinto nombre, por tanto distinta
    // celda) se conservan por separado, y el contador las suma.
    const g4 = await boot(baseSave([
      consumable('u1', 3, { name: 'Tarjeta AFK' }),
      consumable('u2', 2, { name: 'Permiso de Ausencia' })
    ]));
    check('AFK: dos pilas distintas de tarjetas se suman', g4.getState().afkCards === 5,
      'afkCards=' + g4.getState().afkCards);
    check('AFK: y son dos celdas de verdad', deType(g4, 'consumable') === 2,
      'items=' + deType(g4, 'consumable'));

    // Vender se lleva la pila ENTERA, como cualquier otra pila: no queda una
    // "una de tres" que vender. El contador baja por las unidades de la pila.
    const g3 = await boot(baseSave([consumable('u1', 3)]));
    g3.sellItem('u1');
    check('AFK: vender una pila de 3 se lleva las 3', g3.getState().afkCards === 0,
      'afkCards=' + g3.getState().afkCards);
    const g5 = await boot(baseSave([consumable('u2', 2)]));
    g5.useConsumable('u2');
    check('AFK: usar una tarjeta de una pila de 2 deja 1', g5.getState().afkCards === 1,
      'afkCards=' + g5.getState().afkCards);
  }

  {
    // El identificador es `buffId`, no el nombre: una tarjeta que se renombre
    // sigue contándose.
    const g = await boot(baseSave([{ ...consumable('u1', 2), name: 'Permiso de Ausencia' }]));
    check('AFK: se identifica por buffId, no por el nombre', g.getState().afkCards === 2,
      'afkCards=' + g.getState().afkCards);
  }
  {
    // Partida vieja: sin `buffId`. Se deduce del nombre, igual que al usarla.
    const viejo = { ...consumable('u1', 2) };
    delete (viejo as any).buffId;
    const g = await boot(baseSave([viejo]));
    check('AFK: save viejo sin buffId se sigue contando', g.getState().afkCards === 2,
      'afkCards=' + g.getState().afkCards);
    const r = g.useConsumable('u1');
    check('AFK: y se puede usar igual', r.ok, r.msg ?? '');
  }
  {
    // Otros consumibles y otros tipos NO se cuentan como tarjetas AFK.
    const g = await boot(baseSave([
      { id: 'e1', name: 'Ranura de Almacén', type: 'consumable', details: 'x', rarity: 'Raro', tier: 0, sellPrice: 125, stackable: true, stackCount: 4, buffId: 'warehouseExpander' },
      { id: 'p1', name: 'Piedra de Calibración', type: 'consumable', details: 'x', rarity: 'Raro', tier: 0, sellPrice: 11250, stackable: true, stackCount: 2, buffId: 'calibrationStone' },
      // Tipo equivocado con buffId de AFK: el filtro por `type` lo descarta.
      { id: 'x1', name: 'Caja Común', type: 'crate', details: 'x', rarity: 'Común', tier: 0, sellPrice: 125, stackable: true, stackCount: 1, buffId: 'afk' },
      consumable('u1', 1)
    ]));
    check('AFK: no cuenta otros consumibles ni otros tipos', g.getState().afkCards === 1,
      'afkCards=' + g.getState().afkCards);
  }
  {
    // El contador se deriva al cargar: un `afkCards` guardado equivocado no
    // sobrevive a la recarga.
    const g = await boot(baseSave([consumable('u1', 5)], { afkCards: 1 }));
    check('AFK: al cargar se recalcula, no se cree al guardado', g.getState().afkCards === 5,
      'afkCards=' + g.getState().afkCards);
    const g2 = await reload();
    check('AFK: y el valor bueno es el que se guarda', g2.getState().afkCards === 5,
      'afkCards=' + g2.getState().afkCards);
  }

  // --- 10. Ciclo largo: vender 5 veces no acumula ni borra de más ----------
  {
    const g = await boot(baseSave([crate('c1'), crate('c2'), crate('c3'), key('k1'), key('k2')]));
    const antes = nanites(g);
    for (const id of ['c1', 'c2', 'c3', 'k1', 'k2']) g.sellItem(id);
    check('ciclo: almacén vacío', (g.getState().warehouse as any[]).length === 0, ids(g).join(','));
    check('ciclo: nanites = 3 cajas + 2 llaves', nanites(g) === antes + 3 * 125 + 2 * 480,
      'delta=' + (nanites(g) - antes));
    const g2 = await reload();
    check('ciclo: sigue vacío tras recargar', (g2.getState().warehouse as any[]).length === 0, ids(g2).join(','));
  }

  // --- 11. Migración del renombre `weapon` -> `collector` -----------------
  //
  // El tipo de item viaja en el guardado, no en el código. Cuando las armas
  // pasaron a llamarse recolectores, el código pasó a esperar 'collector' y las
  // partidas que ya existían se quedaron con 'weapon'. Como el tipo es la clave
  // de todo lo demás (filtro de la rejilla, botón de equipar, forja, precio,
  // protección de "no vendas el último"), el Blaster Láser de partida desaparecía
  // de la pestaña "Recolectores", no se podía equipar y el detalle pintaba la
  // etiqueta cruda: "weapon".
  {
    const g = await boot(baseSave([legacyWeapon(), companion('m1')], {
      saveVersion: 6, equippedWeaponId: 'weapon_blaster_001'
    }));
    const s = g.getState();

    check('renombre: el item viejo pasa a ser recolector', deType(g, 'collector') === 1 && deType(g, 'weapon') === 0,
      ids(g).join(','));
    check('renombre: conserva su id, su daño y su descripción',
      find(g, 'weapon_blaster_001')?.damage === 5 && find(g, 'weapon_blaster_001')?.details === 'Recolección por click: +5',
      JSON.stringify(find(g, 'weapon_blaster_001')));

    // El id del equipado se renombró a la vez. Sin adoptarlo, el click se
    // quedaba a cero sin decir nada, que es como lo reportó el jugador.
    check('renombre: el recolector equipado no se pierde', s.equippedCollectorId === 'weapon_blaster_001',
      'equippedCollectorId=' + s.equippedCollectorId);
    check('renombre: el click vuelve a hacer daño', g.getClickDamage() > 0, 'daño=' + g.getClickDamage());
    check('renombre: la bandera "equipped" acompaña al id',
      find(g, 'weapon_blaster_001')?.equipped === true, JSON.stringify(find(g, 'weapon_blaster_001')?.equipped));

    // La migración no sirve de nada si no se guarda.
    const g2 = await reload();
    const guardado: any = (globalThis as any).__MEM_DB__[DB];
    // F33 · `SAVE_VERSION` es 8 ahora (el `potential` del recolector), no 7. El
    // resto del aserto no cambia: lo que se comprueba es que la migración se
    // ESCRIBE, que es lo que la hacia util.
    check('renombre: se guarda y no vuelve al estado viejo',
      deType(g2, 'collector') === 1 && guardado.saveVersion === 8,
      'saveVersion=' + guardado.saveVersion);
  }
  {
    // El caso que reportado el jugador tal cual: el Blaster de partida, solo en
    // el almacén y sin equipar. Tiene que poder equiparse.
    const g = await boot(baseSave([legacyWeapon(), companion('m1')], { saveVersion: 6 }));
    const ok = g.equipCollector('weapon_blaster_001');
    check('renombre: el Blaster de partida se puede equipar', ok === true);
    check('renombre: queda como recolector equipado', g.getState().equippedCollectorId === 'weapon_blaster_001',
      'equippedCollectorId=' + g.getState().equippedCollectorId);
    check('renombre: y hace daño al click', g.getClickDamage() > 0, 'daño=' + g.getClickDamage());
  }
  {
    // `equippedWeaponId` se queda en el documento para siempre: `setDoc` con
    // `merge: true` no borra las claves que ya no se envían. Si se leyera en
    // cada arranque, desequipar en la versión nueva no serviría de nada.
    const g = await boot(baseSave([legacyWeapon(), companion('m1')], {
      saveVersion: 6, equippedWeaponId: 'weapon_blaster_001'
    }));
    g.equipCollector('weapon_blaster_001');   // equipar y desequipar
    check('renombre: desequipar funciona', g.getState().equippedCollectorId === null,
      'equippedCollectorId=' + g.getState().equippedCollectorId);

    const g2 = await reload();
    check('renombre: el id viejo del documento no resucita el equipado',
      g2.getState().equippedCollectorId === null, 'equippedCollectorId=' + g2.getState().equippedCollectorId);
    check('renombre: sin equipado, el click no hace daño', g2.getClickDamage() === 0,
      'daño=' + g2.getClickDamage());
  }
  {
    // Id guardado que ya no apunta a nada: se descarta en vez de dejar el
    // estado apuntando al vacío.
    const g = await boot(baseSave([collector('r1'), collector('r2')], { equippedCollectorId: 'r9' }));
    check('renombre: un id equipado colgante se limpia', g.getState().equippedCollectorId === null,
      'equippedCollectorId=' + g.getState().equippedCollectorId);
    check('renombre: y ningún item se marca por el camino',
      (g.getState().warehouse as any[]).every((w: any) => !w.equipped), 'EQ=colgado');
  }
  {
    // Bandera puesta sin id, el otro sentido de la desincronización. La bandera
    // es lo único que queda, así que se adopta si y solo si hay un candidato.
    const g = await boot(baseSave([legacyWeapon('weapon_blaster_001', { equipped: true })], { saveVersion: 6 }));
    check('renombre: bandera sin id: se recupera el equipado',
      g.getState().equippedCollectorId === 'weapon_blaster_001',
      'equippedCollectorId=' + g.getState().equippedCollectorId);
  }
  {
    // Y lo que el jugador quiere de verdad al empezar: el Blaster y el Dron de
    // partida, con el tipo que el juego reconoce y equipables.
    globalThis.__MEM_DB__ = {};
    const g = await createGameLoop(USER, () => {});
    const s = g.getState();
    const blaster = (s.warehouse as any[]).find((w: any) => w.type === 'collector');
    const dron = (s.warehouse as any[]).find((w: any) => w.type === 'companion');
    check('partida nueva: el Blaster es un recolector', !!blaster, ids(g).join(','));
    check('partida nueva: el Dron es un compañero', !!dron, ids(g).join(','));
    check('partida nueva: se pueden equipar los dos',
      g.equipCollector(blaster.id) === true && g.equipCompanion(dron.id) === true,
      `blaster=${blaster.id} dron=${dron.id}`);
    check('partida nueva: el click del Blaster hace daño', g.getClickDamage() > 0, 'daño=' + g.getClickDamage());
    check('partida nueva: el Dron da ingreso pasivo', s.passiveIncome > 0, 'pasivo=' + s.passiveIncome);
  }

  // --- El botón de vender y el cargo, el mismo número --------------------
  // `getSellPrice` es el UNITARIO. El botón "Vender" pintaba ese número sin
  // multiplicar por las unidades de la pila, así que con 20 llaves decía
  // "Vender · 480 ◆" y el cargo eran 9.600. `getSellTotal` es el número que
  // enseñan el botón y el modal, y tiene que ser el que entra en la cuenta.
  for (const [id, unidades] of [['c1', 4], ['k1', 19], ['x1', 7], ['u1', 3]] as Array<[string, number]>) {
    const g = await boot(baseSave([
      crate('c1', 1, unidades), key('k1', 1, unidades),
      crystal('x1', 1, unidades), consumable('u1', unidades),
      collector('r1'), collector('r2')
    ]));
    const unitario = g.getSellPrice(id);
    const anunciado = g.getSellTotal(id);
    const antes = nanites(g);
    const r = g.sellItem(id);
    const cobrado = nanites(g) - antes;

    check(`venta: el total anunciado de ${id} es unidad x ${unidades}`,
      anunciado === unitario * unidades, `anunciado=${anunciado} ${unitario}x${unidades}`);
    check(`venta: y es lo que entra en la cuenta de ${id}`,
      r.ok && cobrado === anunciado, `cobrado=${cobrado} anunciado=${anunciado}`);
  }
  {
    // Un item que no es apilable vale una unidad: el total no lo multiplica por
    // nada, aunque le quede un `stackCount` de adorno.
    const g = await boot(baseSave([collector('r1'), collector('r2')]));
    const id = 'r1';
    const antes = nanites(g);
    g.sellItem(id);
    check('venta: un recolector no apilable se cobra a precio de una unidad',
      g.getSellTotal(id) === g.getSellPrice(id) * 1
      || nanites(g) - antes === g.getSellPrice(id),
      `total=${g.getSellTotal(id)} unitario=${g.getSellPrice(id)} cobrado=${nanites(g) - antes}`);
  }
  {
    // Un id que no está en el almacén da 0 en los dos, no en uno: un total
    // inventado sería peor que ninguno.
    const g = await boot(baseSave([collector('r1'), collector('r2')]));
    check('venta: un id inexistente vale 0 en precio y en total',
      g.getSellPrice('nada') === 0 && g.getSellTotal('nada') === 0,
      `unitario=${g.getSellPrice('nada')} total=${g.getSellTotal('nada')}`);
  }

  // --- Venta por unidades: el caso que pidió el jugador -------------------
  //
  // Una pila se puede querer a medias: 19 llaves y solo vas a abrir dos cajas.
  // Antes la única palanca era vender la pila entera, y para un material de
  // consumo eso es una decisión equivocada por defecto.
  {
    // Una parte de una pila: qué queda, qué se cobra y qué se guarda.
    const g = await boot(baseSave([key('k1', 1, 10)]));
    const antes = nanites(g);
    const r = g.sellItem('k1', 4);
    const pila = find(g, 'k1');
    check('parcial: devuelve cuántas se vendieron', r.ok && r.sold === 4, 'sold=' + r.sold);
    check('parcial: la pila conserva lo que sobra', !!pila && pila.stackCount === 6,
      'quedan=' + (pila ? pila.stackCount : 'no existe'));
    check('parcial: cobra 4, no la pila', r.gained === 4 * 480 && nanites(g) === antes + 1920,
      'ganado=' + r.gained + ' nanitas=' + nanites(g));
    check('parcial: el contador de llaves baja a 6', g.getState().keys === 6,
      'keys=' + g.getState().keys);

    const g2 = await reload();
    const pila2 = find(g2, 'k1');
    check('parcial: las 6 que sobran sobreviven a la recarga',
      !!pila2 && pila2.stackCount === 6, 'quedan=' + (pila2 ? pila2.stackCount : 'no existe'));
    check('parcial: y no se Readmite lo vendido', nanites(g2) === antes + 1920,
      'nanitas=' + nanites(g2));
    check('parcial: el contador tras recargar sigue en 6', g2.getState().keys === 6,
      'keys=' + g2.getState().keys);
  }
  {
    // R3: el botón, el texto del modal y el cargo leen el MISMO número.
    //
    // Se comprueba en las DIEZ cantidades por separado y no en un bucle sobre la
    // misma pila: vendiendo 1+2+3+4 ya se han gastado las diez unidades y de la
    // quinta en adelante el item ya no existe, así que el bucle mediría "no
    // existe" en vez de "el número no cuadra". Cada cantidad necesita su partida.
    const desajustes: string[] = [];
    for (let n = 1; n <= 10; n++) {
      const g = await boot(baseSave([key('k1', 1, 10)]));
      const esperado = g.getSellTotal('k1', n);
      const r = g.sellItem('k1', n);
      if (r.gained !== esperado) desajustes.push(`n=${n} cargo=${r.gained} anunciaba=${esperado}`);
    }
    check('parcial: el cargo es EXACTAMENTE el que anunciaba getSellTotal, en las 10 cantidades',
      desajustes.length === 0, desajustes.join(' | ') || 'las 10 cuadran');
  }
  {
    // Pedir MÁS de lo que hay no puede fabricar dinero: se recorta a lo que hay.
    // Un recorte devuelve menos de lo anunciado, y el botón se lo pregunta a la
    // MISMA función, así que no puede haber discrepancia; lo que no puede pasar
    // es cobrar por unidades que no estaban.
    const g = await boot(baseSave([key('k1', 1, 3)]));
    const antes = nanites(g);
    const r = g.sellItem('k1', 99);
    check('parcial: pedir 99 en una pila de 3 se recorta a 3', r.ok && r.sold === 3,
      'sold=' + r.sold + ' ganado=' + r.gained);
    check('parcial: y cobra lo de 3, no lo de 99', r.gained === 3 * 480 && nanites(g) === antes + 1440,
      'ganado=' + r.gained);
    check('parcial: la pila se queda vacía', !find(g, 'k1'), ids(g).join(','));
    check('parcial: y getSellTotal también se recorta', g.getSellTotal('k1', 99) === 0,
      'total=' + g.getSellTotal('k1', 99));
  }
  {
    // Una cantidad que no es una cantidad NO es una intención de compra. Se
    // rechaza SIN cobrar: es el único caso que `sellItem` rechaza de verdad.
    const g = await boot(baseSave([key('k1', 1, 5)]));
    const antes = nanites(g);
    const malos = [0, -3, NaN, Infinity];
    const acepto: string[] = [];
    for (const n of malos) {
      const r = g.sellItem('k1', n as number);
      if (r.ok) acepto.push(`${n} -> ok`);
    }
    check('parcial: 0, negativos, NaN e Infinity se rechazan',
      acepto.length === 0, acepto.join(' | ') || 'los 4 rechazados');
    check('parcial: y rechazar no cobra nada', nanites(g) === antes,
      `nanitas=${nanites(g)} antes=${antes}`);
    check('parcial: y la pila sigue entera', find(g, 'k1')?.stackCount === 5,
      'quedan=' + find(g, 'k1')?.stackCount);

    // Un decimal NO se rechaza: se redondea ABAJO a una unidad. No hay unidades
    // fraccionables, así que "vender 1,7" solo tiene una lectura posible y
    // quedarse con 1 es más útil que dejar el botón muerto. Y por debajo de 1 sí
    // es rechazo, porque ahí no queda ni una unidad entera.
    const g3 = await boot(baseSave([key('k1', 1, 5)]));
    const a3 = nanites(g3);
    const rDecimal = g3.sellItem('k1', 1.7);
    check('parcial: un decimal se redondea ABAJO y se vende 1, no 2',
      rDecimal.ok && rDecimal.sold === 1 && nanites(g3) === a3 + 480,
      'sold=' + rDecimal.sold + ' ganado=' + rDecimal.gained);
    const g4 = await boot(baseSave([key('k1', 1, 5)]));
    check('parcial: por debajo de 1 no queda ni una unidad y se rechaza',
      g4.sellItem('k1', 0.5).ok === false, 'vendido 0.5');

    // Un texto llega si alguien tipa en vez de usar el campo. `Number('abc')`
    // es NaN, así que cae en el mismo rechazo; un número en texto, no.
    const rTexto = g.sellItem('k1', '2' as any);
    check('parcial: un "2" escrito como texto se acepta y son 2 unidades',
      rTexto.ok && rTexto.sold === 2, 'sold=' + rTexto.sold);
  }
  {
    // Vender la pila por partes tiene que sumar lo mismo que venderla de una vez.
    const g1 = await boot(baseSave([key('k1', 1, 10)]));
    const a1 = nanites(g1);
    g1.sellItem('k1', 3);
    g1.sellItem('k1', 4);
    const r3 = g1.sellItem('k1', 3);

    const g2 = await boot(baseSave([key('k2', 1, 10)]));
    const a2 = nanites(g2);
    const rTodo = g2.sellItem('k2');

    check('parcial: tres ventas suman lo mismo que una de la pila entera',
      nanites(g1) - a1 === nanites(g2) - a2,
      `por partes=${nanites(g1) - a1} de una vez=${nanites(g2) - a2}`);
    check('parcial: y la tercera vació la pila', r3.sold === 3 && !find(g1, 'k1'), ids(g1).join(','));
    check('parcial: vender sin decir cantidad sigue vendiendo la pila entera',
      rTodo.sold === 10 && !find(g2, 'k2'), 'sold=' + rTodo.sold);
  }
  {
    // Una caja se puede vender a medias igual que una llave: son apilables por la
    // misma regla y el contador de cajas tiene que bajar en la misma proporción.
    const g = await boot(baseSave([crate('c1', 1, 8)]));
    const r = g.sellItem('c1', 5);
    check('parcial: una pila de cajas también se vende a medias',
      r.ok && r.sold === 5 && find(g, 'c1')?.stackCount === 3,
      'sold=' + r.sold + ' quedan=' + find(g, 'c1')?.stackCount);
    check('parcial: y el contador de cajas sigue a la pila', g.getState().crates[1] === 3,
      'crates[1]=' + g.getState().crates[1]);
    const g2 = await reload();
    check('parcial: las 3 cajas que sobran sobreviven', find(g2, 'c1')?.stackCount === 3,
      'quedan=' + find(g2, 'c1')?.stackCount);
  }
  {
    // Un recolector NO es apilable, así que una cantidad mayor que uno tiene que
    // recortarse a uno y no cambiar su comportamiento de ninguna manera.
    const g = await boot(baseSave([collector('r1'), collector('r2')]));
    // El precio se lee ANTES de vender: después de venderlo el item ya no está
    // y `getSellPrice` devuelve 0, así que compararlo después mediría 0 contra
    // un cobro y fallaría por la razón equivocada.
    const unitario = g.getSellPrice('r1');
    const r = g.sellItem('r1', 7);
    check('parcial: un recolector se vende de una en una aunque se pidan 7',
      r.ok && r.sold === 1 && r.gained === unitario,
      `sold=${r.sold} ganado=${r.gained} unitario=${unitario}`);
  }

  // --- Resumen -----------------------------------------------------------
  const fallos = rows.filter(r => !r.ok);
  rows.forEach(r => console.log(`${r.ok ? 'PASA' : 'FALLA'}  ${r.name}${r.detail ? '   [' + r.detail + ']' : ''}`));
  console.log(`\n${rows.length - fallos.length}/${rows.length} pruebas correctas`);
  if (fallos.length) {
    console.log('\nFALLOS:');
    fallos.forEach(r => console.log('  - ' + r.name + '  [' + r.detail + ']'));
    process.exitCode = 1;
  }
}

export default main();
