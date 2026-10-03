// ==========================================================================
//  Reproducción del caso de la captura: 19 unidades apiladas
//
//  Arranca con una partida guardada por la versión que guardaba **un item por
//  unidad** en vez de una pila, pinta el almacén DE VERDAD con el mismo HTML que ve
//  el jugador, y saca el texto del contador de ranuras. Si el arreglo funciona dice
//  "3" y no "21", aunque el almacén tuviera 21 entradas en el array.
//
//  **ESTO HA SIDO DE LLAVES, LUEGO DE CRISTALES, Y AHORA ES DE CAJAS.** El bug era
//  real y el arreglo también, pero los dos objetos que lo sostenían han ido
//  apareciendo: las llaves dejaron de apilarse cuando dejaron de ser moneda, y el
//  cristal hizo lo mismo al volverse un recurso —`'crystal'` ya no aparece en
//  ninguna partida guardada por el motor, y una partida vieja convierte sus pilas
//  en unidades al cargar—. **La caja es lo que queda**, y es un caso mejor que los
//  otros dos: su celda lleva tres dígitos de verdad, el tope es de 99, y es el
//  objeto que más veces se compra en lote. El script sigue sirviendo para lo mismo:
//  probar que una pila grande cuenta como **una** ranura y no se pierde ninguna
//  unidad.
// ==========================================================================

import { nodo, contenedor } from './domStub';
import { createGameLoop } from '../src/gameLoop';
import { renderWarehouseTab } from '../src/components/warehouse';
import { countOccupiedSlots } from '../src/data/stacking';

const USER = { uid: 'test', displayName: 'P' };
const DB = 'users/test';

// --- La partida de la captura ----------------------------------------------
const collector = (id, name, tier) => ({ id, name, type: 'collector', details: '+20', rarity: 'Común', tier, level: 1, damage: 20, sellPrice: 250 });
// **EL NOMBRE DE LA CAJA ES EL QUE ESCRIBE EL JUEGO.** Las cajas son diez y se
// reconocen por el número del nombre (`Caja T1`), así que un nombre inventado aquí
// produciría una partida que el juego no sabe ni abrir ni contar.
const caja = (i, stack = 1) => ({ id: `c${i}`, name: 'Caja T1', type: 'crate', details: 'Se abre sola', rarity: 'Común', tier: 0, sellPrice: 125, stackable: true, stackCount: stack });

// 19 unidades guardadas POR SEPARADO: exactamente lo que dejaba la versión vieja.
const cajas = Array.from({ length: 19 }, (_, i) => caja(i));

globalThis.__MEM_DB__ = {
  [DB]: {
    saveVersion: 7,
    nanites: 34_400,
    totalNanitesProduced: 34_400,
    warehouse: [collector('r1', 'Dron Explorador', 1), collector('r2', 'Blaster Láser', 1), ...cajas],
    crates: { common: 0, rare: 0, epic: 0, legendary: 0 },
    // `saveVersion: 7` a propósito: es lo que tenía la partida de la captura. El
    // reparto de pilas ya no mira la versión —`partirPilas()` se aplica siempre—,
    // así que el número solo cuenta la historia del guardado.
    crystals: 0, afkCards: 0,
    companions: [], activeCompanions: [], equippedCollectorId: null,
    warehouseCapacity: 21, maxCompanionSlots: 3,
    buffs: { clickBoostExpiresAt: 0, passiveBoostExpiresAt: 0, clickX2ExpiresAt: 0, clickX3ExpiresAt: 0 },
    nodeLevels: {}, unlockedNodes: [], cores: 0, totalCores: 0, forgedCount: 0,
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
const celdaPila = /data-id="(c\d+)" data-count="(\d+)"/.exec(html);

const unidades = st.warehouse.filter((w: any) => w.type === 'crate').reduce((a: number, w: any) => a + (w.stackCount ?? 1), 0);

console.log('\n================ LO QUE VE EL JUGADOR ================');
console.log('  contador de ranuras .......', contador ? `${contador[1]}/${contador[2]}` : 'NO ENCONTRADO');
console.log('  celdas pintadas ............', celdasPintadas, '(3 ocupadas + huecos hasta la capacidad)');
console.log('  celda de la pila ...........',
  celdaPila ? `id=${celdaPila[1]} insignia="${celdaPila[2]}"` : 'NO ENCONTRADA');
console.log('\n================ LO QUE HAY DEBAJO ================');
console.log('  entradas en el array .......', st.warehouse.length, '<-- lo que contaba el contador antes');
console.log('  items de caja ..............', st.warehouse.filter((w: any) => w.type === 'crate').length);
console.log('  unidades de caja ...........', unidades, '(contador del juego:', st.crates?.[1] ?? 'sin crates', ')');
console.log('  ranuras (countOccupiedSlots)', countOccupiedSlots(st.warehouse));
console.log('=====================================================\n');

const ok = contador?.[1] === '3' && celdaPila?.[2] === '19' && unidades === 19 && (st.crates?.[1] ?? 0) === 19
  && st.warehouse.filter((w: any) => w.type === 'crate').length === 1;
console.log(ok
  ? 'OK  la pila de 19 unidades cuenta como 1 ranura, dice 19 en la insignia y no se pierde ninguna'
  : 'FALLO');

// ==========================================================================
//  Y ahora el caso en VIVO: el botín de una caja cae sobre el almacén lleno
// ==========================================================================
// El botín que **no** cabe no se pierde nunca: se compensa en nanitas. Y el cristal
// ya no es un item, así que no hay ningún caso en el que pueda perderse por falta
// de ranura. Aquí se fuerza esa situación: almacén lleno y cuarenta aperturas.
console.log('\n================ BOTIN CON EL ALMACEN LLENO ================');
{
  // 2 recolectores + 1 pila de cajas T1 + 1 pila de cajas T2 = 4 ranuras, y la
  // capacidad es 4: lleno. Las dos pilas llevan de sobra para 40 aperturas.
  globalThis.__MEM_DB__[DB].warehouse = [
    collector('r1', 'Dron Explorador', 1),
    collector('r2', 'Blaster Láser', 1),
    caja('c1', 60),
    { ...caja('c2', 60), id: 'c2', name: 'Caja T2' }
  ];
  globalThis.__MEM_DB__[DB].crystals = 0;
  globalThis.__MEM_DB__[DB].crates = { common: 60, rare: 0, epic: 0, legendary: 0 };
  globalThis.__MEM_DB__[DB].warehouseCapacity = 4;

  const g2 = await createGameLoop(USER, () => {});
  const st0: any = g2.getState();
  console.log('  antes: ranuras =', countOccupiedSlots(st0.warehouse), '/', g2.getCapacity(), ' (lleno)');
  console.log('  antes: unidades de cristal =', st0.crystals);

  // 40 aperturas seguidas. Cada premio que es un objeto y no tiene hueco se
  // compensa en nanitas con el mismo criterio del botín repetido, así que aquí no
  // se pierde nada: lo que se mide es que el almacén **no se desborda** y que el
  // cristal, que ya no es un item, entra entero.
  //
  // **Y `openCrateBox` RECIBE UN SOLO ARGUMENTO.** La caja se busca por su id y se
  // consume; no hay llave que buscar ni que comprobar.
  let abiertas = 0;
  let rechazadas = 0;
  let prometidas = 0;
  let entregadas = 0;
  for (let i = 0; i < 40; i++) {
    const r: any = g2.openCrateBox('c1');
    if (!r.ok) { rechazadas++; continue; }
    abiertas++;
    const premio = r.reward;
    // **LO QUE DICE LA ETIQUETA ES LO QUE SE COBRA.** Se anota lo prometido y se
    // compara con el saldo al final: si el almacén lleno hiciera perder una sola
    // unidad, la diferencia saldría aquí.
    if (premio?.kind === 'crystals') prometidas += Number(premio.amount) || 0;
    if (premio?.name === 'Compensación') entregadas += Number(premio.amount) || 0;
  }
  const st2: any = g2.getState();
  const cajas2 = st2.warehouse.filter((w: any) => w.type === 'crate');
  const usadas = st2.warehouse.reduce((a: number, w: any) => a + (w.stackCount ?? 1), 0);

  console.log('  aperturas correctas .......', abiertas, rechazadas ? `(+${rechazadas} rechazadas)` : '');
  console.log('  unidades de cristal ........', st2.crystals, `(el botín prometió ${prometidas})`);
  console.log('  compensaciones en nanitas ..', entregadas);
  console.log('  pilas de caja .............', cajas2.length,
    '->', cajas2.map((w: any) => `${w.name}x${w.stackCount ?? 1}`).join(' + '));
  console.log('  unidades de caja ...........', cajas2.reduce((a: number, w: any) => a + (w.stackCount ?? 1), 0), `(-${120 - usadas} gastadas)`);
  console.log('  ranuras ocupadas ...........', countOccupiedSlots(st2.warehouse), '/', g2.getCapacity());
  console.log('  desbordado .................', countOccupiedSlots(st2.warehouse) > g2.getCapacity() ? 'SI' : 'no');

  // **LO QUE ESTE BLOQUE MIDE AHORA, Y POR QUÉ CAMBIÓ.** Antes contaba cuántas
  // pilas de material quedaban, y eso ya no puede pasar: el cristal es un recurso,
  // se suma a `state.crystals` y no ocupa ranura ni la necesita. El invariante que
  // queda es más fuerte que el que había: **el almacén no se desborda y el botín
  // se entrega entero**, y las dos mitades se comprueban por separado.
  const ok2 = abiertas === 40
    && st2.crystals >= prometidas
    && countOccupiedSlots(st2.warehouse) <= g2.getCapacity()
    && cajas2.length <= 2;
  console.log(ok2
    ? '\nOK  40 cajas seguidos con el almacen lleno: nada se desborda y el cristal entra entero'
    : '\nFALLO');
  if (!ok2) process.exitCode = 1;

  // Con una ranura libre el caso es el otro: el botín que sí es un objeto puede
  // abrir su celda, y a partir de ahí los que se apilan caben dentro. Lo que se
  // mide es que **la celda nueva es una, no una por botín**, y que el cristal
  // —que no necesita celda ninguna— no se ve afectado por el hueco que haya o deje
  // de haber.
  console.log('\n================ CON UNA RANURA LIBRE ================');
  {
    globalThis.__MEM_DB__[DB].warehouse = [
      collector('r1', 'Dron Explorador', 1),
      caja('c1', 60),
      { ...caja('c2', 60), id: 'c2', name: 'Caja T2' }
    ];
    globalThis.__MEM_DB__[DB].crystals = 0;
    globalThis.__MEM_DB__[DB].crates = { common: 60, rare: 0, epic: 0, legendary: 0 };
    globalThis.__MEM_DB__[DB].warehouseCapacity = 4;

    const g3 = await createGameLoop(USER, () => {});
    let prometidas3 = 0;
    for (let i = 0; i < 40; i++) {
      const r: any = g3.openCrateBox('c1');
      if (r.ok && r.reward?.kind === 'crystals') prometidas3 += Number(r.reward.amount) || 0;
    }
    const st3: any = g3.getState();
    const cajas3 = st3.warehouse.filter((w: any) => w.type === 'crate');
    const ocupadas3 = countOccupiedSlots(st3.warehouse);

    console.log('  capacidad .................', g3.getCapacity());
    console.log('  ranuras ocupadas ..........', ocupadas3);
    console.log('  unidades de cristal .......', st3.crystals, `(el botín prometió ${prometidas3})`);
    console.log('  pilas de caja .............', cajas3.length,
      '->', cajas3.map((w: any) => `${w.name}x${w.stackCount ?? 1}`).join(' + '));
    console.log('  desbordado .................', ocupadas3 > g3.getCapacity() ? 'SI' : 'no');

    // El cristal no aparece en el almacén ni en la cuenta de ranuras: sale entero
    // con el almacén lleno y con hueco, que es justo lo que un recurso tiene que
    // hacer. Las cajas, en cambio, sí son objetos: se apilan dentro de su tope de
    // 99 y no abren una celda por unidad.
    const ok3 = ocupadas3 <= g3.getCapacity() && st3.crystals >= prometidas3
      && cajas3.every((w: any) => (w.stackCount ?? 1) <= 99);
    console.log(ok3
      ? '\nOK  con una ranura libre las cajas siguen apiladas y el cristal entra entero igual'
      : '\nFALLO');
    if (!ok3) process.exitCode = 1;
  }
}

process.exit(ok ? 0 : 1);
