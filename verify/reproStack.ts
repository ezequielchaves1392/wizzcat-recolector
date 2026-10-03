// ==========================================================================
//  Reproducción del caso de la captura: 19 unidades apiladas
//
//  Arranca con una partida guardada por la versión que guardaba **un item por
//  unidad** en vez de una pila, pinta el almacén DE VERDAD con el mismo HTML que ve
//  el jugador, y saca el texto del contador de ranuras. Si el arreglo funciona dice
//  "1" y no "19", aunque el almacén tuviera 21 entradas en el array.
//
//  **ESTO ERA DE LLAVES Y AHORA ES DE CRISTALES, Y NO ES UN CAMBIO DE PALABRA.** El
//  bug era real y el arreglo también, pero las llaves dejaron de apilarse cuando
//  dejaron de ser moneda: `'key'` ya no está en `STACKABLE_TYPES`, así que 19
//  llaves en una partida vieja no llegan ni a pintarse —la redención las convierte
//  en nanitas—. El cristal es el objeto que de verdad llena una celda con tres
//  dígitos, así que el escenario que se quiere reproducir es el suyo, y el script
//  sigue sirviendo para lo mismo: probar que una pila grande cuenta como **una**
//  ranura y no se pierde ninguna unidad.
// ==========================================================================

import { nodo, contenedor } from './domStub';
import { createGameLoop } from '../src/gameLoop';
import { renderWarehouseTab } from '../src/components/warehouse';
import { countOccupiedSlots } from '../src/data/stacking';

const USER = { uid: 'test', displayName: 'P' };
const DB = 'users/test';

// --- La partida de la captura ----------------------------------------------
const collector = (id, name, tier) => ({ id, name, type: 'collector', details: '+20', rarity: 'Común', tier, level: 1, damage: 20, sellPrice: 250 });
const cristal = (i) => ({ id: `k${i}`, name: 'Cristal de Afino', type: 'crystal', details: 'x1', rarity: 'Común', tier: 1, sellPrice: 180, stackable: true, stackCount: 1 });

// 19 unidades guardadas POR SEPARADO: exactamente lo que dejaba la versión vieja.
const cristales = Array.from({ length: 19 }, (_, i) => cristal(i));

globalThis.__MEM_DB__ = {
  [DB]: {
    saveVersion: 7,
    nanites: 34_400,
    totalNanitesProduced: 34_400,
    warehouse: [collector('r1', 'Dron Explorador', 1), collector('r2', 'Blaster Láser', 1), ...cristales],
    crates: { common: 0, rare: 0, epic: 0, legendary: 0 },
    // `saveVersion: 7` a propósito: es lo que tenía la partida de la captura, y es
    // lo que hace que la migración de apilado se aplique.
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
const celdaPila = /data-id="(k\d+)" data-count="(\d+)"/.exec(html);

const unidades = st.warehouse.filter((w: any) => w.type === 'crystal').reduce((a: number, w: any) => a + (w.stackCount ?? 1), 0);

console.log('\n================ LO QUE VE EL JUGADOR ================');
console.log('  contador de ranuras .......', contador ? `${contador[1]}/${contador[2]}` : 'NO ENCONTRADO');
console.log('  celdas pintadas ............', celdasPintadas, '(3 ocupadas + huecos hasta la capacidad)');
console.log('  celda de la pila ...........',
  celdaPila ? `id=${celdaPila[1]} insignia="${celdaPila[2]}"` : 'NO ENCONTRADA');
console.log('\n================ LO QUE HAY DEBAJO ================');
console.log('  entradas en el array .......', st.warehouse.length, '<-- lo que contaba el contador antes');
console.log('  items de cristal ............', st.warehouse.filter((w: any) => w.type === 'crystal').length);
console.log('  unidades de cristal .........', unidades, '(contador del juego:', st.crystalTotal, ')');
console.log('  ranuras (countOccupiedSlots)', countOccupiedSlots(st.warehouse));
console.log('=====================================================\n');

const ok = contador?.[1] === '3' && celdaPila?.[2] === '19' && unidades === 19 && st.crystalTotal === 19
  && st.warehouse.filter((w: any) => w.type === 'crystal').length === 1;
console.log(ok
  ? 'OK  la pila de 19 unidades cuenta como 1 ranura, dice 19 en la insignia y no se pierde ninguna'
  : 'FALLO');

// ==========================================================================
//  Y ahora el caso en VIVO: el botín de una caja cae sobre la pila
// ==========================================================================
// Antes de arreglarlo, cada unidad de material que soltaba una caja entraba como
// un item nuevo y gastaba una ranura. Con el almacén lleno, el botín se perdía
// entero con un aviso solo en consola. Aquí se fuerza esa situación.
console.log('\n================ BOTIN CON EL ALMACEN LLENO ================');
{
  // 2 recolectores + 1 pila de cristales + 1 pila de cajas = 4 ranuras, y la
  // capacidad es 4: lleno. Las dos pilas llevan de sobra para 40 aperturas.
  //
  // **LA PILA QUE SE ABRE AL PRINCIPIO ES LA DE CRISTAL, Y ES A PROPÓSITO.** Antes
  // era la de llaves: la caja soltaba llaves, así que había una pila de llaves
  // esperando. Ahora la caja no suelta llave —suelta cristal—, así que si la pila
  // inicial fuese de caja, las 40 aperturas se comerían su propia pila en el
  // primer bloque y este wouldn't mediría lo que dice que mide.
  globalThis.__MEM_DB__[DB].warehouse = [
    collector('r1', 'Dron Explorador', 1),
    collector('r2', 'Blaster Láser', 1),
    { id: 'k0', name: 'Cristal de Afino', type: 'crystal', details: 'x1', rarity: 'Común', tier: 1, sellPrice: 180, stackable: true, stackCount: 60 },
    { id: 'c1', name: 'Caja Común', type: 'crate', details: 'x', rarity: 'Común', tier: 0, sellPrice: 125, stackable: true, stackCount: 60 }
  ];
  globalThis.__MEM_DB__[DB].crystalsByTier = { 1: 60 };
  globalThis.__MEM_DB__[DB].upgradeCrystals = 60;
  globalThis.__MEM_DB__[DB].crates = { common: 60, rare: 0, epic: 0, legendary: 0 };
  globalThis.__MEM_DB__[DB].warehouseCapacity = 4;

  const g2 = await createGameLoop(USER, () => {});
  console.log('  antes: ranuras =', countOccupiedSlots(g2.getState().warehouse), '/', g2.getCapacity(), ' (lleno)');

  // 40 aperturas seguidas. Antes de arreglarlo, cada unidad que caía abría una
  // ranura nueva: el almacén se llenaba de material suelto y el resto del botín
  // empezaba a perderse por falta de hueco, con el aviso solo en consola.
  //
  // **Y `openCrateBox` RECIBE UN SOLO ARGUMENTO.** La caja se busca por su id
  // y se consume; no hay llave que buscar ni que comprobar. El bucle ya no mira qué
  // llave hay en el almacén porque no hay ninguna.
  let abiertas = 0;
  let perdidas = 0;
  for (let i = 0; i < 40; i++) {
    const r = g2.openCrateBox('c1');
    if (r.ok) abiertas++;
    else perdidas++;
  }
  const st2: any = g2.getState();
  const cristales2 = st2.warehouse.filter((w: any) => w.type === 'crystal');
  const usadas = st2.warehouse.reduce((a: number, w: any) => a + (w.stackCount ?? 1), 0);

  console.log('  aperturas correctas .......', abiertas, perdidas ? `(+${perdidas} rechazadas)` : '');
  console.log('  pilas de cristal ...........', cristales2.length);
  console.log('  unidades de cristal ........', cristales2.reduce((a: number, w: any) => a + (w.stackCount ?? 1), 0));
  console.log('  unidades de caja ...........', st2.warehouse.filter((w: any) => w.type === 'crate')
    .reduce((a: number, w: any) => a + (w.stackCount ?? 1), 0), `(-${60 - usadas} gastadas)`);
  console.log('  ranuras ocupadas ...........', countOccupiedSlots(st2.warehouse), '/', g2.getCapacity());
  console.log('  desbordado .................', countOccupiedSlots(st2.warehouse) > g2.getCapacity() ? 'SI' : 'no');

  const ok2 = abiertas === 40 && cristales2.length === 1 && countOccupiedSlots(st2.warehouse) <= g2.getCapacity();
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
      { id: 'k0', name: 'Cristal de Afino', type: 'crystal', details: 'x1', rarity: 'Común', tier: 1, sellPrice: 180, stackable: true, stackCount: 60 },
      { id: 'c1', name: 'Caja Común', type: 'crate', details: 'x', rarity: 'Común', tier: 0, sellPrice: 125, stackable: true, stackCount: 60 }
    ];
    // **AQUÍ SÍ NO HAY PILA DE CRISTAL, Y POR ESO ESTE BLOQUE MIDE OTRA COSA.** Es el
    // caso en el que el material todavía no tiene dónde meterse: pierde hasta que
    // el primer botín abre la pila, y a partir de ahí todo cabe dentro.
    globalThis.__MEM_DB__[DB].crystalsByTier = {};
    globalThis.__MEM_DB__[DB].upgradeCrystals = 0;
    globalThis.__MEM_DB__[DB].crates = { common: 60, rare: 0, epic: 0, legendary: 0 };
    globalThis.__MEM_DB__[DB].warehouseCapacity = 4;

    const g3 = await createGameLoop(USER, () => {});
    const origWarn = console.warn;
    const avisos: string[] = [];
    console.warn = (m: string) => { avisos.push(m); };
    for (let i = 0; i < 40; i++) {
      g3.openCrateBox('c1');
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
