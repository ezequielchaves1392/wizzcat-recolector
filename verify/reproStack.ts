// ==========================================================================
//  Reproducción del caso de la captura: 19 llaves apiladas
//
//  Arranca con una partida guardada por la versión que guardaba una llave por
//  item, pinta el almacén DE VERDAD con el mismo HTML que ve el jugador, y
//  saca el texto del contador de ranuras. Si el arreglo funciona, dice "1" y no
//  "19", aunque el almacén tuviera 21 entradas en el array.
// ==========================================================================

import { nodo, contenedor } from './domStub';
import { createGameLoop } from '../src/gameLoop';
import { renderWarehouseTab } from '../src/components/warehouse';
import { countOccupiedSlots } from '../src/data/stacking';

const USER = { uid: 'test', displayName: 'P' };
const DB = 'users/test';

// --- La partida de la captura ----------------------------------------------
const collector = (id, name, tier) => ({ id, name, type: 'collector', details: '+20', rarity: 'Común', tier, level: 1, damage: 20, sellPrice: 250 });
const key = (i) => ({ id: `k${i}`, name: 'Llave de Cifrado', type: 'key', details: 'x', rarity: 'Común', tier: 0, sellPrice: 480, stackable: true, stackCount: 1 });

// 19 llaves guardadas POR SEPARADO: exactamente lo que dejaba la versión vieja.
const llaves = Array.from({ length: 19 }, (_, i) => key(i));

globalThis.__MEM_DB__ = {
  [DB]: {
    saveVersion: 7,
    nanites: 34_400,
    totalNanitesProduced: 34_400,
    warehouse: [collector('r1', 'Dron Explorador', 1), collector('r2', 'Blaster Láser', 1), ...llaves],
    crates: { common: 0, rare: 0, epic: 0, legendary: 0 },
    keys: 19, keysByTier: { 0: 19, 1: 0, 2: 0, 3: 0 },
    crystalsByTier: {}, upgradeCrystals: 0, afkCards: 0,
    companions: [], activeCompanions: [], equippedCollectorId: null,
    warehouseCapacity: 21, maxCompanionSlots: 3,
    buffs: { clickBoostExpiresAt: 0, passiveBoostExpiresAt: 0, clickX2ExpiresAt: 0, clickX3ExpiresAt: 0 },
    nodeLevels: {}, unlockedNodes: [], cores: 0, totalCores: 0, shards: 0, forgedCount: 0,
    cosmetics: { title: 'title_default', frame: 'frame_none', banner: 'banner_none', unlocked: [] },
    unlockedAchievements: []
  }
};

const g = await createGameLoop(USER, () => {});
const st: any = g.getState();

// --- Lo que ve el jugador ---------------------------------------------------
const container = contenedor();
renderWarehouseTab(container, g, () => {}, () => {}, () => {}, () => {});
const html: string = container.children[0]?.innerHTML ?? '';

const contador = html.match(/(\d+)\/(\d+) ranuras/);
const celdasPintadas = (html.match(/class="inv-cell /g) ?? []).length;
// La insignia de la pila no es texto: la pinta el CSS con
// `content: attr(data-count)`, así que el numero vive en el atributo.
const celdaLlaves = /data-id="(k\d+)" data-count="(\d+)"/.exec(html);

const unidades = st.warehouse.filter((w: any) => w.type === 'key').reduce((a: number, w: any) => a + (w.stackCount ?? 1), 0);

console.log('\n================ LO QUE VE EL JUGADOR ================');
console.log('  contador de ranuras .......', contador ? `${contador[1]}/${contador[2]}` : 'NO ENCONTRADO');
console.log('  celdas pintadas ............', celdasPintadas, '(3 ocupadas + huecos hasta la capacidad)');
console.log('  celda de las llaves ........',
  celdaLlaves ? `id=${celdaLlaves[1]} insignia="${celdaLlaves[2]}"` : 'NO ENCONTRADA');
console.log('\n================ LO QUE HAY DEBAJO ================');
console.log('  entradas en el array .......', st.warehouse.length, '<-- lo que contaba el contador antes');
console.log('  items de llave .............', st.warehouse.filter((w: any) => w.type === 'key').length);
console.log('  unidades de llave ..........', unidades, '(contador del juego:', st.keys, ')');
console.log('  ranuras (countOccupiedSlots)', countOccupiedSlots(st.warehouse));
console.log('=====================================================\n');

const ok = contador?.[1] === '3' && celdaLlaves?.[2] === '19' && unidades === 19 && st.keys === 19
  && st.warehouse.filter((w: any) => w.type === 'key').length === 1;
console.log(ok
  ? 'OK  la pila de 19 llaves cuenta como 1 ranura, dice 19 en la insignia y no se pierde ninguna unidad'
  : 'FALLO');

// ==========================================================================
//  Y ahora el caso en VIVO: el botín de una caja cae sobre la pila
// ==========================================================================
// Antes de arreglarlo, cada llave que soltaba una caja entraba como un item
// nuevo y gastaba una ranura. Con el almacén lleno, el botín se perdía entero
// con un aviso solo en consola. Aquí se fuerza esa situación.
console.log('\n================ BOTIN CON EL ALMACEN LLENO ================');
{
  // 2 recolectores + 1 pila de llaves + 1 pila de cajas = 4 ranuras, y la
  // capacidad es 4: lleno. Las dos pilas llevan de sobra para 40 aperturas.
  globalThis.__MEM_DB__[DB].warehouse = [
    collector('r1', 'Dron Explorador', 1),
    collector('r2', 'Blaster Láser', 1),
    { id: 'k0', name: 'Llave de Cifrado', type: 'key', details: 'x', rarity: 'Común', tier: 0, sellPrice: 480, stackable: true, stackCount: 60 },
    { id: 'c1', name: 'Caja Común', type: 'crate', details: 'x', rarity: 'Común', tier: 0, sellPrice: 125, stackable: true, stackCount: 60 }
  ];
  globalThis.__MEM_DB__[DB].keys = 60;
  globalThis.__MEM_DB__[DB].keysByTier = { 0: 60, 1: 0, 2: 0, 3: 0 };
  globalThis.__MEM_DB__[DB].crates = { common: 60, rare: 0, epic: 0, legendary: 0 };
  globalThis.__MEM_DB__[DB].warehouseCapacity = 4;

  const g2 = await createGameLoop(USER, () => {});
  console.log('  antes: ranuras =', countOccupiedSlots(g2.getState().warehouse), '/', g2.getCapacity(), ' (lleno)');

  // 40 aperturas seguidas. Antes de arreglarlo, cada llave que caía abría una
  // ranura nueva: el almacén se llenaba de llaves sueltas y el resto del botín
  // empezaba a perderse por falta de hueco, con el aviso solo en consola.
  let abiertas = 0;
  let perdidas = 0;
  for (let i = 0; i < 40; i++) {
    const id = g2.getState().warehouse.find((w: any) => w.type === 'key')?.id;
    const r = g2.openCrateBox('c1', id as string);
    if (r.ok) abiertas++;
    else perdidas++;
  }
  const st2: any = g2.getState();
  const llaves2 = st2.warehouse.filter((w: any) => w.type === 'key');
  const usadas = st2.warehouse.reduce((a: number, w: any) => a + (w.stackCount ?? 1), 0);

  console.log('  aperturas correctas .......', abiertas, perdidas ? `(+${perdidas} rechazadas)` : '');
  console.log('  pilas de llave .............', llaves2.length);
  console.log('  unidades de llave ..........', llaves2.reduce((a: number, w: any) => a + (w.stackCount ?? 1), 0));
  console.log('  unidades de caja ...........', st2.warehouse.filter((w: any) => w.type === 'crate')
    .reduce((a: number, w: any) => a + (w.stackCount ?? 1), 0), `(-${60 - usadas} gastadas)`);
  console.log('  ranuras ocupadas ...........', countOccupiedSlots(st2.warehouse), '/', g2.getCapacity());
  console.log('  desbordado .................', countOccupiedSlots(st2.warehouse) > g2.getCapacity() ? 'SI' : 'no');

  const ok2 = abiertas === 40 && llaves2.length === 1 && countOccupiedSlots(st2.warehouse) <= g2.getCapacity();
  console.log(ok2
    ? '\nOK  40 cajas seguidos con el almacen lleno: el botin se apila y no se desborda'
    : '\nFALLO');
  if (!ok2) process.exitCode = 1;

  // Lo de arriba perdía cristales porque son un TIPO NUEVO y no quedaba ranura
  // para abrir su pila. Eso es lo correcto. Con una ranura libre, el primer
  // cristal abre la pila y todos los siguientes caben dentro: la pérdida es de
  // una vez, no por cada botín.
  console.log('\n================ CON UNA RANURA LIBRE ================');
  {
    globalThis.__MEM_DB__[DB].warehouse = [
      collector('r1', 'Dron Explorador', 1),
      { id: 'k0', name: 'Llave de Cifrado', type: 'key', details: 'x', rarity: 'Común', tier: 0, sellPrice: 480, stackable: true, stackCount: 60 },
      { id: 'c1', name: 'Caja Común', type: 'crate', details: 'x', rarity: 'Común', tier: 0, sellPrice: 125, stackable: true, stackCount: 60 }
    ];
    globalThis.__MEM_DB__[DB].keys = 60;
    globalThis.__MEM_DB__[DB].keysByTier = { 0: 60, 1: 0, 2: 0, 3: 0 };
    globalThis.__MEM_DB__[DB].crystalsByTier = {};
    globalThis.__MEM_DB__[DB].upgradeCrystals = 0;
    globalThis.__MEM_DB__[DB].crates = { common: 60, rare: 0, epic: 0, legendary: 0 };
    globalThis.__MEM_DB__[DB].warehouseCapacity = 4;

    const g3 = await createGameLoop(USER, () => {});
    const origWarn = console.warn;
    const avisos: string[] = [];
    console.warn = (m: string) => { avisos.push(m); };
    for (let i = 0; i < 40; i++) {
      const id = g3.getState().warehouse.find((w: any) => w.type === 'key')?.id;
      g3.openCrateBox('c1', id as string);
    }
    console.warn = origWarn;

    const st3: any = g3.getState();
    const cristales = st3.warehouse.filter((w: any) => w.type === 'crystal');
    const lostas = avisos.filter(a => /crystal/.test(a))
      .reduce((a, s) => a + (parseInt(s.match(/se pierden (\d+)/)?.[1] ?? '0')), 0);

    console.log('  capacidad .................', g3.getCapacity());
    console.log('  ranuras ocupadas ..........', countOccupiedSlots(st3.warehouse));
    console.log('  pilas de cristal ..........', cristales.length,
      'con', cristales.reduce((a: number, w: any) => a + (w.stackCount ?? 1), 0), 'unidades');
    console.log('  cristales perdidos ........', lostas, '(solo hasta abrir la pila)');
    console.log('  desbordado .................', countOccupiedSlots(st3.warehouse) > g3.getCapacity() ? 'SI' : 'no');

    const ok3 = cristales.length <= 1 && countOccupiedSlots(st3.warehouse) <= g3.getCapacity();
    console.log(ok3
      ? '\nOK  los cristales caben en una sola pila en cuanto hay ranura para abrirla'
      : '\nFALLO');
    if (!ok3) process.exitCode = 1;
  }
}

process.exit(ok ? 0 : 1);
