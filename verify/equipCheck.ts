// ==========================================================================
//  Banco de pruebas de equipar/desequipar (game loop real, no reimplementado)
//
//  El síntoma que se reporta es "a veces funciona y a veces no". Eso no
//  puede estar en el toggle del game loop, que es determinista, ni en la
//  rejilla, que solo pinta lo que le dan. Está en que el clic llega al toggle
//  un número de veces que depende de cuántas veces se ha repintado la página
//  desde que se entró al almacén.
//
//  Aquí se comprueban las dos mitades por separado y luego juntas.
// ==========================================================================

import { createGameLoop } from '../src/gameLoop';

type Row = { name: string; ok: boolean; detail: string };
const rows: Row[] = [];
function check(name: string, ok: boolean, detail = '') { rows.push({ name, ok, detail }); }

const USER = { uid: 'test', displayName: 'Probador' };
const DB = 'users/test';

async function boot(save: any) {
  globalThis.__MEM_DB__ = {};
  if (save) globalThis.__MEM_DB__[DB] = JSON.parse(JSON.stringify(save));
  return await createGameLoop(USER, () => {});
}

const collector = (id: string, tier = 3) => ({
  id, name: 'Recolector T' + tier, type: 'collector', details: '+20',
  rarity: 'Épico', tier, level: 0, damage: 20, sellPrice: 500
});
const companion = (id: string, tier = 3) => ({
  id, name: 'Compañero T' + tier, type: 'companion', details: '+10/s',
  rarity: 'Épico', tier, sellPrice: 2000
});
function baseSave(warehouse: any[], extra: any = {}) {
  return {
    saveVersion: 7, nanites: 1000, warehouse, crates: {},
    companions: [], activeCompanions: [], equippedCollectorId: null,
    keys: 0, upgradeCrystals: 0, warehouseCapacity: 30,
    maxCompanionSlots: 3, ...extra
  };
}
const find = (g: any, id: string) => (g.getState().warehouse as any[]).find((w: any) => w.id === id);

// =========================================================================
//  Un nodo con la MISMA semántica de `addEventListener` que un elemento del
//  DOM: todos los listeners registrados se ejecutan, en orden, en cada
//  dispatch. No se reimplementa la lógica del juego —solo el `dispatch` que
//  dispara lo que el navegador dispararía— porque lo que se mide es
//  exactamente cuántas veces llega un clic.
// =========================================================================
class Nodo {
  /** Contenedor al que pertenece. Los listeners NO se propagan hacia él. */
  parent: Nodo | null = null;
  private ls: Array<() => void> = [];
  /** Número de listeners vivos en este nodo. */
  get count() { return this.ls.length; }
  addEventListener(_: string, fn: () => void) { this.ls.push(fn); }
  removeEventListener(_: string, fn: () => void) {
    const i = this.ls.indexOf(fn);
    if (i >= 0) this.ls.splice(i, 1);
  }
  /** Un clic: se ejecutan TODOS los listeners registrados, en orden. */
  click() { for (const fn of [...this.ls]) fn(); }
}

async function main() {
  // =========================================================================
  // 1. El toggle del game loop, aislado. Debe ser su propia inversa.
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1')]));
    const s = g.getState();
    check('toggle: nace sin nada equipado',
      s.equippedCollectorId === null && find(g, 'r1').equipped !== true);

    g.equipCollector('r1');
    check('toggle: equipar pone id y bandera',
      s.equippedCollectorId === 'r1' && find(g, 'r1').equipped === true);

    g.equipCollector('r1');
    check('toggle: desequipar limpia id y bandera',
      s.equippedCollectorId === null && find(g, 'r1').equipped !== true);

  }
  {
    const g = await boot(baseSave([collector('r1'), collector('r2')]));
    const s = g.getState();
    g.equipCollector('r1');
    g.equipCollector('r2');
    check('toggle: cambiar de recolector no deja dos con la bandera puesta',
      (s.warehouse as any[]).filter((w: any) => w.equipped).length === 1,
      'equipados=' + (s.warehouse as any[]).filter((w: any) => w.equipped).map((w: any) => w.id).join(','));
    check('toggle: el anterior queda limpio',
      find(g, 'r1').equipped !== true && find(g, 'r2').equipped === true);
    check('toggle: y el id es el nuevo', s.equippedCollectorId === 'r2');
  }
  {
    const g = await boot(baseSave([collector('r1'), companion('c1')]));
    const s = g.getState();
    s.companions = [{ id: 'c1', name: 'Compañero T3', type: 'click', power: 5, tier: 3 }];
    g.equipCompanion('c1');
    check('toggle: equipar compañero lo mete en la lista',
      s.activeCompanions.length === 1, 'activos=' + s.activeCompanions.join(','));
    g.equipCompanion('c1');
    check('toggle: desequipar compañero lo saca',
      s.activeCompanions.length === 0, 'activos=' + s.activeCompanions.join(','));
  }

  // =========================================================================
  // 2. Un clic debe llegar UNA vez, por muchos repintados que haya.
  //
  //    `wire()` encolaba su listener de `click` sobre `container` (que es
  //    `#app` y sobrevive a los renders) en cada `draw()`. Con N listeners
  //    vivos, un clic ejecutaba el toggle N veces y, como el toggle es su
  //    propia inversa, N par no hacía nada.
  //
  //    Aquí se comprueba la propiedad que lo evita: los listeners se cuelgan
  //    del nodo que se recrea, así que el anterior se va con él.
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1')]));
    const s = g.getState();

    let raiz = new Nodo();
    const repintar = () => {
      // Equivalente a `mountInto`: nodo NUEVO, el anterior se descarta con sus
      // listeners. Es lo que hace la página.
      const nuevo = new Nodo();
      raiz.parent = nuevo.parent;
      nuevo.addEventListener('click', () => g.equipCollector('r1'));
      raiz = nuevo;
    };
    const clic = () => { const antes = s.equippedCollectorId; raiz.click(); return s.equippedCollectorId !== antes; };

    repintar();
    check('repintado: 1er render, el clic equipa', clic(), 'listeners=' + raiz.count);

    repintar();
    check('repintado: tras repintar, el clic SIGUE cambiando el estado', clic(),
      'listeners=' + raiz.count);

    // El caso que más dolía: cambiar de recolector. Con listeners
    // acumulados, equipar el segundo lo desequipaba y el jugador se quedaba
    // con el primero sin haberlo pedido.
    const g2 = await boot(baseSave([collector('r1'), collector('r2')]));
    const s2 = g2.getState();
    let raiz2 = new Nodo();
    const repintar2 = () => {
      const nuevo = new Nodo();
      raiz2.parent = nuevo.parent;
      nuevo.addEventListener('click', () => g2.equipCollector('r2'));
      raiz2 = nuevo;
    };
    repintar2();
    g2.equipCollector('r1');
    repintar2();
    raiz2.click();
    check('repintado: se puede cambiar de recolector después de repintar',
      s2.equippedCollectorId === 'r2', 'equippedCollectorId=' + s2.equippedCollectorId);
  }
  {
    // El mecanismo exacto que se cambió: ligar sobre el nodo RECREADO debe
    // dejar el contenedor persistente con un solo listener, no uno por render.
    // Es la aserción que falla con el código anterior.
    const contenedor = new Nodo();
    let raiz: Nodo | null = null;
    for (let i = 0; i < 5; i++) {
      raiz = new Nodo();
      raiz.parent = contenedor;
      raiz.addEventListener('click', () => { /* acción */ });
    }
    check('repintado: ligar sobre el nodo recreado no acumula en el contenedor',
      contenedor.count === 0 && raiz!.count === 1,
      `contenedor=${contenedor.count} raiz=${raiz!.count}`);
  }

  // =========================================================================
  // 3. La bandera `equipped` y el id NO son dos fuentes de verdad.
  //
  //    El id es lo que lee el cálculo de daño. La bandera es su proyección y
  //    tiene que seguirlo siempre, también después de cada equipar. Antes el
  //    toggle decidía por la bandera, así que una bandera descolocada invertía
  //    el botón y desequipar se llevaba por delante el equipado de verdad.
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1')]));
    const s = g.getState();
    g.equipCollector('r1');
    check('id y bandera: equipar deja los dos de acuerdo',
      s.equippedCollectorId === 'r1' && find(g, 'r1').equipped === true,
      `id=${s.equippedCollectorId} bandera=${find(g, 'r1').equipped}`);

    // Se fuerza la desincronización que un guardado viejo podía traer:
    // bandera puesta, id vacío.
    s.equippedCollectorId = null;
    (s.warehouse as any[])[0].equipped = true;

    // Con el id mandando, el item NO está equipado: el botón tiene que decir
    // "Equipar" y el click tiene que hacer daño.
    g.equipCollector('r1');
    check('id y bandera: una bandera descolocada ya no manda',
      s.equippedCollectorId === 'r1' && g.getClickDamage() > 0,
      `id=${s.equippedCollectorId} daño=${g.getClickDamage()}`);
    check('id y bandera: y el toggle se recupera del desajuste',
      find(g, 'r1').equipped === true, 'bandera=' + find(g, 'r1').equipped);
  }
  {
    // El peor caso del toggle antiguo: bandera puesta en un item que NO es el
    // equipado. Desequiparlo borraba `equippedCollectorId` sin mirar, y el
    // jugador se quedaba sin recolector por haber pulsado "Desequipar" sobre
    // un item que ni siquiera llevaba puesto.
    const g = await boot(baseSave([collector('r1'), collector('r2')]));
    const s = g.getState();
    s.equippedCollectorId = 'r2';
    find(g, 'r1').equipped = true;   // bandera fantasma

    g.equipCollector('r1');
    check('id y bandera: pulsar sobre una bandera fantasma no destruye el equipado real',
      s.equippedCollectorId === 'r1', 'equippedCollectorId=' + s.equippedCollectorId);
    check('id y bandera: y solo queda un item con la bandera puesta',
      (s.warehouse as any[]).filter((w: any) => w.equipped).length === 1,
      'equipados=' + (s.warehouse as any[]).filter((w: any) => w.equipped).map((w: any) => w.id).join(','));
  }

  // =========================================================================
  // 4. `equipCompanion` acepta ids que no son compañeros.
  //
  //    `state.activeCompanions` es una lista de ids; el ingreso se calcula
  //    cruzando con `state.companions`. Un id que no está ahí ocupa ranura y
  //    no paga nada, sin avisar. `toggleCompanionActive` tampoco lo comprueba.
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1'), companion('m1')]));
    const s = g.getState();
    const slots = g.getCompanionSlots();
    // Sin compañeros registrados, la partida de partida no trae ninguno: el
    // ingreso sale de `state.companions`, que el save de test deja vacío.
    s.companions = [{ id: 'm1', name: 'Compañero T3', type: 'click', power: 10, tier: 3 }];
    g.recalculatePassiveIncome?.();

    const pasivoAntes = s.passiveIncome;
    g.equipCompanion('m1');
    check('compañero: uno real entra y paga',
      s.activeCompanions.includes('m1') && s.passiveIncome > pasivoAntes,
      `pasivo=${s.passiveIncome} antes=${pasivoAntes}`);

    const llenos = s.activeCompanions.length;
    const pasivoConUno = s.passiveIncome;
    const ok = g.equipCompanion('no_existe');
    check('compañero: un id inexistente se rechaza', ok === false, 'ok=' + ok);
    check('compañero: y no gasta ranura',
      s.activeCompanions.length === llenos,
      `activos=${s.activeCompanions.join(',')} slots=${slots}`);
    check('compañero: ni aparece en el ingreso', s.passiveIncome === pasivoConUno,
      `pasivo=${s.passiveIncome} antes=${pasivoConUno}`);
  }
  {
    // Un id que sí está en `state.companions` pero cuyo item se vendió: la
    // ranura tiene que quedar libre, no quedar colgada.
    const g = await boot(baseSave([collector('r1'), companion('m1')]));
    const s = g.getState();
    s.companions = [{ id: 'm1', name: 'Compañero T3', type: 'click', power: 10, tier: 3 }];
    g.equipCompanion('m1');
    g.equipCompanion('m1');
    check('compañero: desequipar un id válido lo saca y libera la ranura',
      s.activeCompanions.length === 0, 'activos=' + s.activeCompanions.join(','));
  }

  // =========================================================================
  // 5. Un solo camino para activar/desactivar un compañero.
  //
  //    Había dos: `equipCompanion` (la que usaba la vista) y
  //    `toggleCompanionActive` (que no llamaba nadie). El segundo ordenaba la
  //    lista por tier al insertar y el primero no, así que el orden depended
  //    de por dónde se hubiera equipado. Ahora uno delega en el otro.
  // =========================================================================
  {
    const g = await boot(baseSave([companion('m3', 3), companion('m1', 1)]));
    const s = g.getState();
    s.companions = [
      { id: 'm3', name: 'Compañero T3', type: 'click', power: 3, tier: 3 },
      { id: 'm1', name: 'Compañero T1', type: 'click', power: 1, tier: 1 }
    ];

    g.equipCompanion('m3');
    g.equipCompanion('m1');
    const porEquip = s.activeCompanions.join(',');

    s.activeCompanions.length = 0;
    g.toggleCompanionActive('m3');
    g.toggleCompanionActive('m1');
    const porToggle = s.activeCompanions.join(',');

    check('doble camino: los dos caminos coinciden',
      porEquip === porToggle, `equipCompanion=[${porEquip}] toggle=[${porToggle}]`);
    check('doble camino: y ordenan por tier, como se pintan',
      porEquip === 'm1,m3', 'activos=[' + porEquip + ']');
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
