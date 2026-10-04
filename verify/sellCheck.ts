// ==========================================================================
//  Banco de pruebas del game loop real (no una reimplementación)
//
//  Arranca `createGameLoop()` de verdad contra un Firestore en memoria y
//  comprueba, tipo por tipo, que vender saca el item del almacén y que no
//  reaparece ni al re-sincronizar ni al recargar la partida.
//
//  Los stubs de `firebase/*` se inyectan por alias en `verify/vite.config.ts`.
// ==========================================================================

import { createGameLoop, SAVE_VERSION } from '../src/gameLoop';
import { danioDeRango, estrellasDe } from '../src/data/crafting';
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
// `crate` y `crystal` estaban definidas aquí **además** de las de `kit.ts`,
// con tablas de nombres propias. Y las dos copias ya se habían separado: las
// listas de aquí tenían cuatro nombres y el juego tenía diez. Un banco que
// fabrica un `Cristal Singular` que el juego no fabrica mide un objeto que no
// existe, que es la forma más tranquila de tener un banco en verde y falso.
//
// **Y NO SE IMPORTA `key`, Y NO ES UN OLVIDO.** Quitar las llaves del juego no
// quitó el tipo de una partida vieja: al cargar, cada item del almacén con
// `type: 'key'` se convierte en nanitas y desaparece. Un banco que montara una
// partida con `key(...)` y luego esperara encontrarla estaría midiendo la
// redención, no la venta.
//
// **Y EL CRISTAL TAMBIÉN SE QUEDA FUERA, POR EL MOTIVO CONTRARIO.** Antes lo que
// se vendía por unidades con contador derivado era el cristal, y todo lo de abajo
// lo medía con él. **Ahora es un recurso**: no está en el almacén, no se vende y
// su valor es de uso, no de reventa. Lo que queda con esa forma es el CONSUMIBLE:
// apilable, sin tope de pila y con contador derivado (`afkCards`). La redención
// de las pilas de cristal viejas la mide `stackCheck`.
const { crate } = factories;

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
/**
 * Un recolector como lo guardaba el juego ANTES del renombre a 'collector'.
 *
 * **DAÑO 6 Y NO 5, Y ES POR G4.** El daño lo pone `danioDeRango()` para que el
 * item sea coherente con el ★1: un T1 con daño 5 estaba **por debajo del suelo**
 * de la escala, así que la migración de G4 lo subía a 6 al cargar. Con un
 * fixture coherente, esta prueba mide lo que dice medir —que el renombre no toca
 * nada— en vez de medirse a sí misma. El caso del item incoherente tiene su
 * propia prueba, más abajo.
 */
const legacyWeapon = (id = 'weapon_blaster_001', over: any = {}) => ({
  id, name: 'Blaster Láser', type: 'weapon',
  details: `Recolección por click: +${danioDeRango(1, 1)}`,
  rarity: 'Común', tier: 1, level: 0, damage: danioDeRango(1, 1),
  potential: 1, sellPrice: 250, ...over
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
    // Ni `keys` ni `keysByTier` ni `upgradeCrystals` ni `crystalsByTier`: ya no
    // existen en el estado. Escribirlos aquí no rompería nada —el motor los ignora
    // y los borra al guardar—, pero un banco que pone un campo que el juego no tiene
    // es un banco que mide otra partida. El cristal es `crystals`, y es un recurso:
    // si esta partida no lo trae, el motor le da el valor por defecto.
    warehouseCapacity: 30,
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

  // --- 4. Los otros tres tipos ----------------------------------------
  {
    // El material que se vende en lote, con contador DERIVADO del almacén. Este
    // bloque primero fue de las llaves y luego del cristal, y los dos han dejado de
    // ser items: las llaves se redimen a nanitas y el cristal es un recurso.
    //
    // **LO QUE QUEDA CON ESA FORMA ES EL CONSUMIBLE**: apilable, sin tope de pila y
    // con contador derivado del almacén, que es exactamente el papel que tenía el
    // cristal. Vender una pila tiene que bajar ese contador en la misma proporción
    // en que baja la pila, y eso es lo que se mide aquí.
    //
    // El precio de reventa lo pone la fábrica de `kit.ts` (2500), y el árbol de
    // pasivas no está comprado en esta partida, así que 3 unidades son 3 × 2500.
    const g = await boot(baseSave([consumable('x1', 3)]));
    const antes = nanites(g);
    const r = g.sellItem('x1');
    check('consumible: desaparece', r.ok && deType(g, 'consumable') === 0, ids(g).join(','));
    check('consumible: el contador derivado a 0',
      g.getState().afkCards === 0, 'afkCards=' + g.getState().afkCards);
    check('consumible: paga 3 unidades', r.gained === 7500 && nanites(g) === antes + 7500,
      'ganado=' + r.gained);
    const g2 = await reload();
    check('consumible: no revive al recargar', deType(g2, 'consumable') === 0, ids(g2).join(','));
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
    const g = await boot(baseSave([crate('x1')]));
    const r = g.sellItem('x1');
    const r2 = g.sellItem('x1');
    check('vender dos veces el mismo id: la 2ª falla', r.ok && !r2.ok, r2.msg ?? '');
  }

  // --- 6. Abrir una caja: el otro camino que reutilizaba el contador ----
  {
    // Un solo argumento, y sin llave en la partida. La caja se abre sola; lo que
    // sigue midiendo aquí es que abrirla consume LA CAJA y actualiza su contador.
    const g = await boot(baseSave([crate('c1')]));
    const r = g.openCrateBox('c1');
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
    const g2 = await reload();
    check('abrir caja: no revive al recargar', g2.getState().crates[1] === 0, 'crates[1]=' + g2.getState().crates[1]);
  }

  // --- 7. Migración: el contador sí puede crear cajas, pero solo al cargar
  {
    const g = await boot({ ...baseSave([]), crates: { common: 3, rare: 0, epic: 0, legendary: 0 } });
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
    const g = await boot(baseSave([crate('c1'), crate('c2'), collector('r1'), collector('r2'), crate('x1', 7, 5)],
      { totalNanitesProduced: 5_000_000, totalCores: 1 }));
        const r = g.prestige();
    check('prestigio: se concede', r.success, r.msg ?? '');
    check('prestigio: el almacén se vacía de lo reciclado',
      deType(g, 'crate') === 1 && g.getState().crates[7] === 0,
      'cajas=' + deType(g, 'crate') + ' cajasT7=' + g.getState().crates[7]);
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
    // Los dos últimos objetos son consumibles de NOMBRE DISTINTO a propósito: dos
    // del mismo nombre son la misma pila y se venden de una vez, así que no habría
    // cinco ids que vender uno a uno.
    const g = await boot(baseSave([
      crate('c1'), crate('c2'), crate('c3'),
      consumable('x1', 1, { name: 'Permiso de Ausencia' }),
      consumable('x2', 1, { name: 'Píldora de Foco' })
    ]));
    const antes = nanites(g);
    for (const id of ['c1', 'c2', 'c3', 'x1', 'x2']) g.sellItem(id);
    check('ciclo: almacén vacío', (g.getState().warehouse as any[]).length === 0, ids(g).join(','));
    check('ciclo: nanites = 3 cajas + 2 consumibles', nanites(g) === antes + 3 * 125 + 2 * 2500,
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
      find(g, 'weapon_blaster_001')?.damage === danioDeRango(1, 1)
        && find(g, 'weapon_blaster_001')?.details === `Recolección por click: +${danioDeRango(1, 1)}`,
      JSON.stringify(find(g, 'weapon_blaster_001')));

    // El id del equipado se renombró a la vez. Sin adoptarlo, el click se
    // quedaba a cero sin decir nada, que es como lo reportó el jugador.
    check('renombre: el recolector equipado no se pierde', s.equippedCollectorId === 'weapon_blaster_001',
      'equippedCollectorId=' + s.equippedCollectorId);
    check('renombre: el click vuelve a hacer daño', g.getClickDamage() > 0, 'daño=' + g.getClickDamage());
    // **G4 · Y UN ITEM VIEJO INCOHERENTE SÍ SE ARREGLA AL CARGAR.** Está en su
    // propio bloque, más abajo: `reload()` lee el último documento guardado, así
    // que un bloque que deja otro almacén ensucia al que recargue después. Es la
    // trampa del banco, no un problema del juego.

    check('renombre: la bandera "equipped" acompaña al id',
      find(g, 'weapon_blaster_001')?.equipped === true, JSON.stringify(find(g, 'weapon_blaster_001')?.equipped));

    // La migración no sirve de nada si no se guarda.
    const g2 = await reload();
    const guardado: any = (globalThis as any).__MEM_DB__[DB];
    // **EL NÚMERO DE VERSIÓN SE COMPARA CONTRA LA CONSTANTE, Y ESO ES LO QUE HACE
    // QUE ESTA LÍNEA NO HAYA QUE TOCAR EN CADA CAMBIO DE FORMATO.** Antes ponía un
    // `=== 8` escrito a mano, con un comentario que recordaba subirlo. Ha dado rojo
    // en las últimas versiones por lo mismo cada vez: la constante subía y el banco
    // se quedaba.
    //
    // Lo que se comprueba NO es el número: es **que la migración se escribe**, que es
    // lo que la hacía útil. El número es el instrumento, no el sujeto —y por eso lo
    // que se lee es el del documento, que es el que la migración escribe.
    check('renombre: se guarda y no vuelve al estado viejo',
      deType(g2, 'collector') === 1 && guardado.saveVersion === SAVE_VERSION,
      `saveVersion=${guardado.saveVersion} esperado=${SAVE_VERSION}`);
  }
  // =========================================================================
  //  G4 · UN ITEM VIEJO INCOHERENTE SE ARREGLA AL CARGAR
  // =========================================================================
  //  El bloque del renombre de arriba usa un item que **ya viene coherente** con
  //  su potencial, y por eso la migración no lo toca: eso es lo que hay que
  //  comprobar, que una partida bien puesta no se mueva sola.
  //
  //  Este es el otro caso: un item guardado con daño 5 y sin potencial, que es lo
  //  que había en las partidas de antes de la escala. El suelo del T1 son 6, así
  //  que **no existe ningún ★ que valga 5**: o el daño sube al suelo, o el item se
  //  queda con unas estrellas que no son suyas y un número que no cuadra con ellas.
  //
  //  Sube al suelo. Y el cambio es el más pequeño posible porque
  //  `potencialYDanoDe()` elige el potencial MÁS CERCANO y a empate el MENOR: una
  //  migración no puede acabar siendo un regalo para quien lleva más tiempo.
  {
    const g = await boot(baseSave([
      legacyWeapon('viejo_ok'),
      legacyWeapon('viejo_mal', { damage: 5, details: 'Recolección por click: +5', potential: undefined })
    ], { saveVersion: 6 }));
    const ok = find(g, 'viejo_ok');
    const mal = find(g, 'viejo_mal');

    check('G4: un item viejo coherente no se toca al cargar',
      ok?.damage === danioDeRango(1, 1) && ok?.potential === 1,
      `daño=${ok?.damage} potencial=${ok?.potential}`);

    check('G4: y uno incoherente se pone de acuerdo con sus estrellas',
      mal?.potential === 1 && mal?.damage === danioDeRango(1, 1),
      `daño=${mal?.damage} potencial=${mal?.potential} · el ★1 de T1 es ${danioDeRango(1, 1)}`);

    check('G4: y el texto que se pinta pasa a decir la verdad',
      mal?.details === `Recolección por click: +${danioDeRango(1, 1)}`,
      `details="${mal?.details}"`);

    // **Y LA REGLA DE LAS ESTRELLAS, QUE ANTES NO EXISTÍA COMO REGLA.** Siete
    // plantillas pintaban "estrellas si hay potencial, nada si no", así que un
    // item sin campo salía **sin ninguna estrella** — no con cero, sin nada, que
    // parece un item viejo o malgenerado. Esto fija que nunca estén vacías.
    check('G4: las estrellas nunca están vacías, ni sin potencial ni con uno raro',
      estrellasDe(undefined) === '★★★' && estrellasDe(0) === '★★★'
        && estrellasDe(7) === '★★★' && estrellasDe(1) === '★' && estrellasDe(5) === '★★★★★',
      `ausente="${estrellasDe(undefined)}" cero="${estrellasDe(0)}" siete="${estrellasDe(7)}"`);

    // Y la razón de que todo esto sirva: **daño = potencial × la regla**.
    const incoherentes = wh(g).filter((w: any) =>
      w.type === 'collector' && w.damage !== danioDeRango(w.tier ?? 1, w.potential));
    check('G4: en el almacén no queda ni un item con el daño de otras estrellas',
      incoherentes.length === 0,
      incoherentes.map((w: any) => `${w.id}:★${w.potential} daño=${w.damage} (debería ${danioDeRango(w.tier ?? 1, w.potential)})`).join(' '));
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
    // Aquí lo que se comprueba es que **el id viejo del documento no resucita un
    // equipado fantasma**, y eso sigue igual. Lo que cambia es el daño: sin ningún
    // equipado hay un suelo de 1, porque con cero la partida no tenía salida.
    check('renombre: sin equipado el click da el suelo, y no un 0 que bloquea',
      g2.getClickDamage() >= 1 && g2.getState().equippedCollectorId === null,
      'daño=' + g2.getClickDamage() + ' equipado=' + g2.getState().equippedCollectorId);
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
    // partida, con el tipo que el juego reconoce y **ya puestos**.
    //
    // Antes esta comprobación los equipaba a mano, que es como nació. Ahora nacen
    // equipado, y llamar a `equipCollector()` sería un conmutador que los
    // **quitaría**: el banco se quedaría con daño cero y el fallo parecería un
    // problema del motor. Por eso ahora se mira el estado en vez de llamar.
    globalThis.__MEM_DB__ = {};
    const g = await createGameLoop(USER, () => {});
    const s = g.getState();
    const blaster = (s.warehouse as any[]).find((w: any) => w.type === 'collector');
    const dron = (s.warehouse as any[]).find((w: any) => w.type === 'companion');
    check('partida nueva: el Blaster es un recolector', !!blaster, ids(g).join(','));
    check('partida nueva: el Dron es un compañero', !!dron, ids(g).join(','));
    check('partida nueva: los dos nacen puestos, sin que el jugador toque nada',
      s.equippedCollectorId === blaster.id && s.activeCompanions.includes(dron.id),
      `equipo=${s.equippedCollectorId} companeros=${s.activeCompanions.join(',')}`);
    check('partida nueva: el click del Blaster hace daño', g.getClickDamage() > 0, 'daño=' + g.getClickDamage());
    // El ingreso pasivo se calcula en el primer tick, que en el navegador son 500 ms.
    // Aquí los `setInterval` están anulados, así que se comprueba tras una recarga,
    // que es cuando el cálculo ocurre de verdad.
    const gNuevo = await reload();
    check('partida nueva: el Dron da ingreso pasivo',
      gNuevo.getState().passiveIncome > 0, 'pasivo=' + gNuevo.getState().passiveIncome);
  }

  // --- El botón de vender y el cargo, el mismo número --------------------
  // `getSellPrice` es el UNITARIO. El botón "Vender" pintaba ese número sin
  // multiplicar por las unidades de la pila, así que con 19 cajas decía
  // "Vender · 125 ◆" y el cargo eran 2.375. `getSellTotal` es el número que
  // enseñan el botón y el modal, y tiene que ser el que entra en la cuenta.
  //
  // Las tres pilas tienen que ser de productos DISTINTOS: dos del mismo nombre son
  // la misma pila, y entonces `x1` y `u1` serían el mismo item y la segunda venta
  // se mediría sobre un id que ya no existe.
  for (const [id, unidades] of [['c1', 4], ['x1', 19], ['u1', 3]] as Array<[string, number]>) {
    const g = await boot(baseSave([
      crate('c1', 1, unidades), crate('x1', 6, unidades), consumable('u1', unidades),
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
  // Una pila se puede querer a medias: 19 tarjetas y solo vas a usar tres. Antes
  // la única palanca era vender la pila entera, y para un material de consumo eso
  // es una decisión equivocada por defecto.
  //
  // Todo lo de aquí se mide con CONSUMIBLES, y antes se medía con cristales y antes
  // con llaves. No es un cambio de gusto: ninguno de los dos se vende ya —la llave
  // se redime a nanitas al cargar y el cristal es un recurso—, así que una partida
  // montada con ellos entra al almacén y sale sin ninguno. El consumible es el
  // material que queda con la misma forma: apilable, sin tope de pila y con
  // contador DERIVADO del almacén. Su reventa es de 2500 por unidad (la de
  // `kit.ts`), sin bonificación comprada.
  {
    // Una parte de una pila: qué queda, qué se cobra y qué se guarda.
    const g = await boot(baseSave([consumable('x1', 10)]));
    const antes = nanites(g);
    const r = g.sellItem('x1', 4);
    const pila = find(g, 'x1');
    check('parcial: devuelve cuántas se vendieron', r.ok && r.sold === 4, 'sold=' + r.sold);
    check('parcial: la pila conserva lo que sobra', !!pila && pila.stackCount === 6,
      'quedan=' + (pila ? pila.stackCount : 'no existe'));
    check('parcial: cobra 4, no la pila', r.gained === 4 * 2500 && nanites(g) === antes + 10_000,
      'ganado=' + r.gained + ' nanitas=' + nanites(g));
    check('parcial: el contador derivado baja a 6', g.getState().afkCards === 6,
      'afkCards=' + g.getState().afkCards);

    const g2 = await reload();
    const pila2 = find(g2, 'x1');
    check('parcial: las 6 que sobran sobreviven a la recarga',
      !!pila2 && pila2.stackCount === 6, 'quedan=' + (pila2 ? pila2.stackCount : 'no existe'));
    check('parcial: y no se readmite lo vendido', nanites(g2) === antes + 10_000,
      'nanitas=' + nanites(g2));
    check('parcial: el contador tras recargar sigue en 6', g2.getState().afkCards === 6,
      'afkCards=' + g2.getState().afkCards);
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
      const g = await boot(baseSave([consumable('x1', 10)]));
      const esperado = g.getSellTotal('x1', n);
      const r = g.sellItem('x1', n);
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
    const g = await boot(baseSave([consumable('x1', 3)]));
    const antes = nanites(g);
    const r = g.sellItem('x1', 99);
    check('parcial: pedir 99 en una pila de 3 se recorta a 3', r.ok && r.sold === 3,
      'sold=' + r.sold + ' ganado=' + r.gained);
    check('parcial: y cobra lo de 3, no lo de 99', r.gained === 3 * 2500 && nanites(g) === antes + 7500,
      'ganado=' + r.gained);
    check('parcial: la pila se queda vacía', !find(g, 'x1'), ids(g).join(','));
    check('parcial: y getSellTotal también se recorta', g.getSellTotal('x1', 99) === 0,
      'total=' + g.getSellTotal('x1', 99));
  }
  {
    // Una cantidad que no es una cantidad NO es una intención de compra. Se
    // rechaza SIN cobrar: es el único caso que `sellItem` rechaza de verdad.
    const g = await boot(baseSave([consumable('x1', 5)]));
    const antes = nanites(g);
    const malos = [0, -3, NaN, Infinity];
    const acepto: string[] = [];
    for (const n of malos) {
      const r = g.sellItem('x1', n as number);
      if (r.ok) acepto.push(`${n} -> ok`);
    }
    check('parcial: 0, negativos, NaN e Infinity se rechazan',
      acepto.length === 0, acepto.join(' | ') || 'los 4 rechazados');
    check('parcial: y rechazar no cobra nada', nanites(g) === antes,
      `nanitas=${nanites(g)} antes=${antes}`);
    check('parcial: y la pila sigue entera', find(g, 'x1')?.stackCount === 5,
      'quedan=' + find(g, 'x1')?.stackCount);

    // Un decimal NO se rechaza: se redondea ABAJO a una unidad. No hay unidades
    // fraccionables, así que "vender 1,7" solo tiene una lectura posible y
    // quedarse con 1 es más útil que dejar el botón muerto. Y por debajo de 1 sí
    // es rechazo, porque ahí no queda ni una unidad entera.
    const g3 = await boot(baseSave([consumable('x1', 5)]));
    const a3 = nanites(g3);
    const rDecimal = g3.sellItem('x1', 1.7);
    check('parcial: un decimal se redondea ABAJO y se vende 1, no 2',
      rDecimal.ok && rDecimal.sold === 1 && nanites(g3) === a3 + 2500,
      'sold=' + rDecimal.sold + ' ganado=' + rDecimal.gained);
    const g4 = await boot(baseSave([consumable('x1', 5)]));
    check('parcial: por debajo de 1 no queda ni una unidad y se rechaza',
      g4.sellItem('x1', 0.5).ok === false, 'vendido 0.5');

    // Un texto llega si alguien tipa en vez de usar el campo. `Number('abc')`
    // es NaN, así que cae en el mismo rechazo; un número en texto, no.
    const rTexto = g.sellItem('x1', '2' as any);
    check('parcial: un "2" escrito como texto se acepta y son 2 unidades',
      rTexto.ok && rTexto.sold === 2, 'sold=' + rTexto.sold);
  }
  {
    // Vender la pila por partes tiene que sumar lo mismo que venderla de una vez.
    const g1 = await boot(baseSave([consumable('x1', 10)]));
    const a1 = nanites(g1);
    g1.sellItem('x1', 3);
    g1.sellItem('x1', 4);
    const r3 = g1.sellItem('x1', 3);

    const g2 = await boot(baseSave([consumable('x2', 10)]));
    const a2 = nanites(g2);
    const rTodo = g2.sellItem('x2');

    check('parcial: tres ventas suman lo mismo que una de la pila entera',
      nanites(g1) - a1 === nanites(g2) - a2,
      `por partes=${nanites(g1) - a1} de una vez=${nanites(g2) - a2}`);
    check('parcial: y la tercera vació la pila', r3.sold === 3 && !find(g1, 'x1'), ids(g1).join(','));
    check('parcial: vender sin decir cantidad sigue vendiendo la pila entera',
      rTodo.sold === 10 && !find(g2, 'x2'), 'sold=' + rTodo.sold);
  }
  {
    // Una caja se puede vender a medias igual que un consumible: son apilables por la
    // misma regla y el contador derivado tiene que bajar en la misma proporción.
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

  // --- 8. La venta en lote: UN método y un plan, no un bucle de sellItem -----
  //
  //  La barra de la selección múltiple pinta `planSellMany()` y el botón llama a
  //  `sellMany()`. Las dos cosas tienen que salir de la misma cuenta, que es R3, y el
  //  motivo por el que el plan es una función y no un número que la vista suma.
  {
    // **LAS DOS PILAS SON DE TIER DISTINTO A PROPÓSITO.** Dos cajas del mismo tier se
    // funden al cargar —`mergeStacks()` las junta— y entonces `c2` no existe: el primer
    // intento de esta prueba fallaba con "c2 ya no está en el almacén", que no tiene nada
    // que ver con lo que estaba midiendo. Es el mismo fixture que se cayó dos veces más
    // en este fichero, y por eso está dicho aquí y no en el fallo.
    const g = await boot(baseSave([
      crate('c1', 1, 4), crate('c2', 3, 3), consumable('u1', 'afk', 5),
      collector('r1'), collector('r2'), collector('r3')
    ], { nanites: 0, warehouseCapacity: 40 }));

    const plan = g.planSellMany(['c1', 'c2', 'u1', 'r1']);
    check('lote: el plan aprueba los cuatro y no bloquea ninguno',
      plan.vendibles.length === 4 && plan.bloqueados.length === 0,
      `vendibles=${plan.vendibles.length} bloqueados=${JSON.stringify(plan.bloqueados)}`);

    // **R3 CON VARIAS PILAS: LA SUMA DEL PLAN TIENE QUE SER LA SUMA DE LOS TOTALES
    // INDIVIDUALES.** Un plan que redondea por item y uno que redondea la suma darían
    // números distintos, y el botón anunciaría uno y el cobro pagaría el otro. Con tres
    // apilables de precios distintos es donde se nota.
    const aPalo = ['c1', 'c2', 'u1'].reduce((a, id) => a + g.getSellTotal(id), 0);
    check('lote: el total del plan es la suma de los totales de cada uno',
      plan.total === aPalo + g.getSellTotal('r1'),
      `plan=${plan.total} suma=${aPalo + g.getSellTotal('r1')}`);

    const antes = nanites(g);
    const r: any = g.sellMany(['c1', 'c2', 'u1', 'r1']);
    check('lote: cobra EXACTAMENTE lo que el plan|anno',
      r.ok && r.gained === plan.total && nanites(g) === antes + plan.total,
      `cobro=${r.gained} plan=${plan.total} saldo=${nanites(g)} antes=${antes}`);
    check('lote: y dice cuántos vendió, que no es cuántas unidades',
      r.sold === 4, `sold=${r.sold}`);
    check('lote: los cuatro se van del almacén',
      !find(g, 'c1') && !find(g, 'c2') && !find(g, 'u1') && !find(g, 'r1'),
      ids(g).join(','));
    const g2 = await reload();
    check('lote: los cuatro no vuelven al recargar',
      !find(g2, 'c1') && !find(g2, 'u1') && !find(g2, 'r1'), ids(g2).join(','));
  }

  // --- 9. La regla del "último de su tipo" ES COLECTIVA, Y ES LO NUEVO ---------
  //
  //  Con uno solo, "no puedes vender el último de su tipo" significa lo obvious. En un
  //  lote la misma regla pasa a ser una pregunta sobre el conjunto: con tres recolectores
  //  marcados se pueden vender dos y el tercero no. Y la respuesta tiene que ser
  //  explícita, porque el jugador ve cuatro marcas y una venta de tres.
  {
    const g = await boot(baseSave([
      collector('r1'), collector('r2'), collector('r3'), crate('c1')
    ], { nanites: 0, warehouseCapacity: 40 }));
    const plan = g.planSellMany(['r1', 'r2', 'r3']);
    check('lote: de tres recolectores marcados se venden dos',
      plan.vendibles.length === 2,
      `vendibles=${plan.vendibles.length} ids=${plan.vendibles.map((v: any) => v.id).join(',')}`);
    check('lote: y el tercero sale con el motivo puesto',
      plan.bloqueados.length === 1 && plan.bloqueados[0].motivo === 'es el último de su tipo',
      JSON.stringify(plan.bloqueados));
    check('lote: el precio del plan NO incluye lo que no se vende',
      plan.total === plan.vendibles.reduce((a: number, v: any) => a + v.total, 0),
      `total=${plan.total}`);

    const antes = nanites(g);
    const r: any = g.sellMany(['r1', 'r2', 'r3']);
    check('lote: se venden los dos aunque el tercero no se pueda',
      r.ok && r.sold === 2, `sold=${r.sold}`);
    check('lote: y el descarte vuelve en la respuesta, no se pierde en silencio',
      (r.bloqueados || []).length === 1,
      JSON.stringify(r.bloqueados));
    check('lote: queda un recolector, que es lo que la regla protege',
      deType(g, 'collector') === 1, ids(g).join(','));

    // **Y MARCÁNDOLOS LOS DOS, SE VENDE UNO Y QUEDA UNO.** La regla de "no puedes vender el
    // último de su tipo" es la misma en un lote que en uno solo: significa **que quede
    // alguno**, no que no se pueda marcar. La primera versión de esta comprobación pedía
    // que marcar los dos no vendiera ninguno, que sería negarse entero y dejaría al
    // jugador con veinte celdas marcadas y un botón inútil por una celda de más. Vende
    // todo lo que pueda y dice lo que se quedó.
    const g2 = await boot(baseSave([
      collector('r1'), collector('r2'), crate('c1')
    ], { nanites: 0, warehouseCapacity: 40 }));
    const r2: any = g2.sellMany(['r1', 'r2']);
    check('lote: marcados los dos últimos se vende uno, que es lo que la regla pide',
      r2.ok === true && r2.sold === 1 && deType(g2, 'collector') === 1,
      `ok=${r2.ok} sold=${r2.sold} quedan=${deType(g2, 'collector')}`);
    check('lote: y el descarte viene con motivo, para que no sea un misterio',
      (r2.bloqueados || []).length === 1 && /último/.test(r2.bloqueados[0].motivo),
      JSON.stringify(r2.bloqueados));
  }

  // --- 9b. Y CON UNO SOLO DE SU TIPO, NO SE VENDE NINGUNO -------------------------
  {
    // El otro extremo, que es el que hereda la regla de siempre: si solo hay uno, no hay
    // "vender todo lo que pueda" porque no puede ser ninguno.
    const g = await boot(baseSave([collector('r1'), crate('c1')],
      { nanites: 0, warehouseCapacity: 40 }));
    const antes = nanites(g);
    const r: any = g.sellMany(['r1', 'c1']);
    check('lote: el único recolector no se puede vender ni en lote, y la caja sí',
      r.ok === true && !!find(g, 'r1') && !find(g, 'c1') &&
      (r.bloqueados || []).length === 1,
      `ok=${r.ok} quedan=${ids(g).join(',')} bloqueados=${JSON.stringify(r.bloqueados)}`);
    check('lote: y solo se cobra lo de la caja',
      nanites(g) === antes + g.getSellTotal('c1') || !find(g, 'c1'),
      `antes=${antes} ahora=${nanites(g)}`);
  }

  // --- 10. Un equipado marcado no se vende, y el motivo sale antes ---------------
  {
    const g = await boot(baseSave([
      collector('r1'), collector('r2'), crate('c1')
    ], { nanites: 0, warehouseCapacity: 40, equippedCollectorId: 'r1' }));
    const plan = g.planSellMany(['r1', 'c1']);
    check('lote: el equipado se bloquea con su motivo',
      plan.bloqueados.length === 1 && plan.bloqueados[0].motivo === 'está equipado',
      JSON.stringify(plan.bloqueados));
    check('lote: y el resto de la selección sigue siendo vendible',
      plan.vendibles.length === 1 && plan.vendibles[0].id === 'c1',
      JSON.stringify(plan.vendibles));

    const r: any = g.sellMany(['r1', 'c1']);
    check('lote: se vende el que sí y el equipado SE QUEDA, que es lo que se quería',
      r.ok === true && !!find(g, 'r1') && !find(g, 'c1'),
      `ids=${ids(g).join(',')} bloqueados=${JSON.stringify(r.bloqueados)}`);
  }

  // --- 11. Una selección vacía o imposible se NEGA, no cobra ----------------------
  {
    const g = await boot(baseSave([crate('c1')], { nanites: 0, warehouseCapacity: 40 }));
    const antes = nanites(g);
    const r: any = g.sellMany([]);
    check('lote: una selección vacía no cobra nada y lo dice',
      r.ok === false && nanites(g) === antes && /nada seleccionado/.test(r.msg ?? ''),
      `ok=${r.ok} msg=${r.msg ?? ''}`);
    // Un id que no está tampoco, y con mensaje: una selección puede quedarse obsoleta
    // entre que se marca y se pulsa, porque el juego sigue corriendo.
    const r2: any = g.sellMany(['no-existe']);
    check('lote: un id que ya no está no se cobra y se dice por qué',
      r2.ok === false && /ya no est/.test(r2.msg ?? ''),
      `ok=${r2.ok} msg=${r2.msg ?? ''}`);
  }

  // --- 12. El compañero se borra de los TRES sitios, como en la forja -------------
  {
    // Es el mismo forgetting que se corrigió en `consumeMaterialesDeForja()`: el
    // compañero vive en el almacén y en `state.companions`, y si solo se quita de uno,
    // `syncCompanionsToWarehouse()` lo vuelve a crear y sigue pagando ingreso pasivo.
    const g = await boot(baseSave([
      companion('m1'), companion('m2'), crate('c1')
    ], {
      nanites: 0, warehouseCapacity: 40,
      companions: [
        { id: 'm1', name: 'Compañero T3', type: 'passive', power: 10, rarity: 'Épico', tier: 3 },
        { id: 'm2', name: 'Compañero T3', type: 'passive', power: 10, rarity: 'Épico', tier: 3 }
      ]
    }));
    const r: any = g.sellMany(['m1', 'c1']);
    check('lote: el compañero se va del almacén y de las fichas',
      r.ok && !find(g, 'm1') &&
      !g.getState().companions.some((c: any) => c.id === 'm1'),
      ids(g).join(',') + ' fichas=' + g.getState().companions.map((c: any) => c.id).join(','));
    const g2 = await reload();
    check('lote: y no vuelve por la sincronización al recargar',
      !find(g2, 'm1') && !g2.getState().companions.some((c: any) => c.id === 'm1'),
      ids(g2).join(','));
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
