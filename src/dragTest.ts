// ==========================================================================
//  Banco de pruebas del ARRASTRE del almacen, con DOM de verdad.
//
//  Los bancos de `verify/` comprueban `moveItemTo` y `moveItems` sin DOM: que el
//  item acabe en la posicion correcta. Eso no dice nada de si el puntero llega al
//  sitio, que es la mitad del problema: el destino lo lee
//  `document.elementFromPoint`, y si eso no devuelve la celda que el jugador
//  senala, el arrastre es un no-op aunque toda la logica este bien.
//
//  Aqui se monta la pantalla de verdad, se sueltan eventos de puntero reales
//  sobre las celdas y se lee lo que ha quedado. `?caso=<n>` elige el escenario.
// ==========================================================================

import './style.css';
import './style.modules.css';

import { renderWarehouseTab } from './components/warehouse';

type Item = any;

interface Scenario {
  nombre: string;
  /** Orden guardado del almacen (lo que hay detras de la rejilla). */
  warehouse: Item[];
  capacity: number;
  /** Huecos ya colocados: hay un hueco delante de cada id. */
  gaps?: string[];
  /** Celda de origen y celda de destino, por indice de celda. */
  from: number;
  /** -1 = soltar en el hueco que precede a `gapAntesDe`. */
  to: number;
  gapAntesDe?: string;
}

const key = (id: string, n = 1): Item => ({
  id, name: 'Llave de Cifrado', type: 'key', details: 'x', rarity: 'Común',
  tier: 0, sellPrice: 480, stackable: true, stackCount: n
});
const coll = (id: string, name = 'Dron Explorador'): Item => ({
  id, name, type: 'collector', details: '+5', rarity: 'Común',
  tier: 1, level: 0, damage: 5, sellPrice: 250
});
const comp = (id: string): Item => ({
  id, name: 'Blaster Láser', type: 'companion', details: '+2/s', rarity: 'Común',
  tier: 1, sellPrice: 900
});

const SCENARIOS: Scenario[] = [
  {
    // El caso del jugador: 3 celdas, 19 llaves apiladas y 18 huecos detras.
    nombre: 'pila de 19 llaves al final',
    warehouse: [coll('dron'), comp('blaster'), ...Array.from({ length: 19 }, (_, i) => key('k' + i))],
    capacity: 21,
    from: 0,
    to: 3
  },
  {
    nombre: 'pila al final',
    warehouse: [coll('dron'), comp('blaster'), ...Array.from({ length: 19 }, (_, i) => key('k' + i))],
    capacity: 21,
    from: 2,
    to: 3
  },
  {
    nombre: 'celda ocupada en medio',
    warehouse: [coll('a'), coll('b'), coll('c')],
    capacity: 12,
    from: 0,
    to: 2
  },
  {
    nombre: 'celda ocupada a la derecha',
    warehouse: [coll('a'), coll('b'), coll('c')],
    capacity: 12,
    from: 0,
    to: 1
  },
  {
    nombre: 'pila en medio',
    warehouse: [coll('a'), key('p1'), key('p2'), coll('b')],
    capacity: 12,
    from: 1,
    to: 3
  },
  {
    // La celda de al lado: el caso que antes NO movía nada en absoluto.
    nombre: 'vecina inmediata a la derecha',
    warehouse: [coll('a'), coll('b'), coll('c')],
    capacity: 12,
    from: 0,
    to: 1
  },
  {
    nombre: 'pila sobre la celda de al lado',
    warehouse: [coll('a'), key('p1'), key('p2'), coll('b')],
    capacity: 12,
    from: 0,
    to: 1
  },
  {
    nombre: 'hacia la izquierda',
    warehouse: [coll('a'), coll('b'), coll('c')],
    capacity: 12,
    from: 2,
    to: 0
  },
  {
    // LO QUE REPORTA EL JUGADOR: el dron en la ultima celda ocupada, arrastrado
    // a un hueco mas adelante. Como el guardado es una lista, "un hueco mas
    // adelante" solo puede significar "ponlo al final", y ya estaba al final.
    nombre: 'ultima celda ocupada -> hueco',
    warehouse: [comp('blaster'), key('k1', 5), coll('dron')],
    capacity: 12,
    from: 2,
    to: 5
  },
  {
    // HUECOS REALES: ya hay un hueco antes de `c`; se suelta `a` dentro.
    // El intercambio tiene que mover `a` delante de `c` Y dejar un hueco
    // delante de `b`, que es el item que quedaba justo detras de `a`.
    nombre: 'soltar dentro de un hueco',
    warehouse: [coll('a'), coll('b'), coll('c')],
    capacity: 12,
    gaps: ['c'],
    from: 0,
    to: -1,   // -1 = el hueco, se localiza por `data-gap`
    gapAntesDe: 'c'
  },
  {
    // Y al revés: el item va al hueco del final y el hueco se queda donde
    // estaba, que es justo lo que pedía el jugador.
    nombre: 'hueco hacia el final',
    warehouse: [coll('a'), coll('b'), coll('c')],
    capacity: 12,
    gaps: ['b'],
    from: 2,
    to: -1,
    gapAntesDe: 'b'
  },
  {
    // Una pila es UNA celda, asi que arrastrarla mueve los items que hay detras.
    // Al meterla en un hueco tienen que entrar TODOS: si entrara solo el que
    // pintaba la celda, la pila se partiria y la mitad se quedaria fuera.
    nombre: 'pila dentro de un hueco',
    warehouse: [key('p1', 3), key('p2', 4), coll('a'), coll('z')],
    capacity: 12,
    gaps: ['z'],
    from: 0,
    to: -1,
    gapAntesDe: 'z'
  },
  {
    // SOLTAR LEJOS. Con 3 celdas, la celda 5 es la ultima representable: hacen
    // falta 3 celdas de hueco para empujar el item hasta ahi. Es lo que pedia el
    // jugador: que el item caiga en la celda que senala, no "al final".
    nombre: 'soltar en la celda 5',
    warehouse: [coll('dron'), comp('blaster'), key('k1', 5)],
    capacity: 12,
    from: 0,
    to: 5
  },
  {
    // Mas alla del tope del tablero: se recorta en vez de inventar una posicion.
    nombre: 'soltar mas alla del tablero',
    warehouse: [coll('dron'), comp('blaster'), key('k1', 5)],
    capacity: 12,
    from: 0,
    to: 9
  },
  {
    // EL CASO DEL JUGADOR: 3 celdas ocupadas y 18 libres. Las 18 son sitios
    // validos, no adorno, y el item tiene que poder llegar a la celda 17.
    // Antes solo llegaba a la 5, por un tope de "un hueco por celda" que se
    // invento sin motivo.
    nombre: 'lejos: 3 celdas y 18 libres',
    warehouse: [coll('dron'), comp('blaster'), key('k1', 5)],
    capacity: 21,
    from: 0,
    to: 17
  },
  {
    // Y el ultimo item, que es el que antes rechazaba.
    nombre: 'el ultimo item, lejos',
    warehouse: [coll('dron'), comp('blaster'), key('k1', 5)],
    capacity: 21,
    from: 2,
    to: 17
  },
  {
    // La ultima celda del tablero: el tope real.
    nombre: 'la ultima celda del tablero',
    warehouse: [coll('dron'), comp('blaster'), key('k1', 5)],
    capacity: 21,
    from: 0,
    to: 20
  }
];

const estado: any = {
  nanites: 34400, warehouse: [], warehouseCapacity: 12,
  equippedCollectorId: null, activeCompanions: [], companions: [],
  // Huecos que el jugador ha dejado a propósito: hay un hueco antes de cada id.
  warehouseGaps: [] as string[]
};
const llamadas: any[] = [];

/**
 * `moveItems` con la MISMA semántica que el del game loop: el bloque entra
 * delante o detrás del ancla, y con ancla nula al final. Si el game loop cambia,
 * esta copia cambia con él; no es una reimplementación con reglas propias.
 */
function moveItems(ids: string[], anchorId: string | null, lado: 'antes' | 'despues' = 'antes'): boolean {
  const wh = estado.warehouse;
  const origen = ids
    .map(id => wh.findIndex((w: any) => w.id === id))
    .filter(i => i >= 0)
    .sort((a, b) => a - b);
  if (!origen.length) return false;

  const seMueven = new Set(origen);
  const ancla = anchorId == null ? -1 : wh.findIndex((w: any) => w.id === anchorId);
  if (anchorId != null && ancla < 0) return false;
  if (ancla >= 0 && seMueven.has(ancla)) return false;

  const bloque = origen.map(i => wh[i]);
  for (let k = origen.length - 1; k >= 0; k--) wh.splice(origen[k], 1);
  let destino: number;
  if (ancla < 0) {
    destino = wh.length;
  } else {
    const i = wh.findIndex((w: any) => w.id === anchorId);
    destino = lado === 'despues' ? i + 1 : i;
  }
  wh.splice(destino, 0, ...bloque);

  llamadas.push({ ids: ids.length, anchorId, lado, destino });
  return true;
}

const game: any = {
  getState: () => estado,
  getCapacity: () => estado.warehouseCapacity,
  getSellPrice: (id: string) => estado.warehouse.find((w: any) => w.id === id)?.sellPrice ?? 0,
  moveItems,
  getWarehouseGaps: () => [...estado.warehouseGaps],
  setWarehouseGaps: (ids: string[]) => {
    const limpio = ids.filter(id => estado.warehouse.some((w: any) => w.id === id));
    const antes = estado.warehouseGaps.join(',');
    estado.warehouseGaps = limpio;
    return antes !== limpio.join(',');
  },
  equipCollector: () => true,
  equipCompanion: () => true
};

// --------------------------------------------------------------------------
//  Montaje y arrastre con eventos reales
// --------------------------------------------------------------------------

const app = document.querySelector('#app') as HTMLElement;

function pintar(sc: Scenario) {
  estado.warehouse = sc.warehouse.map((w: any) => ({ ...w }));
  estado.warehouseCapacity = sc.capacity;
  estado.warehouseGaps = [...(sc.gaps ?? [])];
  llamadas.length = 0;
  renderWarehouseTab(app, game, () => {}, () => {}, () => {});
}

/**
 * La rejilla tal y como la ve el jugador, en orden de pintado.
 *
 * Cada hueco se marca como `·`. Es la vista que importa: el índice de `celda`
 * del DOM ya NO es la posición en esta lista, porque intercalar huecos las
 * separa. Confundir las dos cosas es el error que la función `moveItemTo` ya
 * cometió una vez.
 */
function rejillaPintada(): string[] {
  return [...document.querySelectorAll('#inv-grid [data-cell], #inv-grid [data-gap]')]
    .map(el => {
      const e = el as HTMLElement;
      return e.dataset.gap !== undefined ? '·' : (e.dataset.id ?? 'libre');
    });
}

/** Los ids de las celdas pintadas, que es lo que el jugador ve. */
function celdasPintadas(): string[] {
  return [...document.querySelectorAll('#inv-grid [data-cell]:not([data-empty])')]
    .map(el => (el as HTMLElement).dataset.id!);
}

function celdaRect(i: number): DOMRect {
  // Con huecos intercalados hay dos indices distintos y no son lo mismo: el de
  // celda (`data-cell`, el indice dentro del almacen) y el pintado, que es el
  // que el jugador ve. El scenario pide una posicion PINTADA, asi que se busca
  // por la celda vacia que la lleva.
  const el = (document.querySelector(`#inv-grid [data-cell="${i}"]`) ??
    document.querySelector(`#inv-grid [data-painted="${i}"]`)) as HTMLElement;
  if (!el) throw new Error('No hay celda ' + i);
  return el.getBoundingClientRect();
}

/** El rectángulo de un hueco, que no lleva `data-cell` sino `data-gap`. */
function huecoRect(anclaId: string): DOMRect {
  const el = document.querySelector(`#inv-grid [data-gap="${anclaId}"]`) as HTMLElement;
  if (!el) throw new Error('No hay hueco delante de ' + anclaId);
  return el.getBoundingClientRect();
}

function evento(tipo: string, x: number, y: number): PointerEvent {
  return new PointerEvent(tipo, {
    pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true,
    clientX: x, clientY: y, button: 0, buttons: tipo === 'pointerup' ? 0 : 1
  });
}

/**
 * Arrastra de la celda `from` al destino, con la misma secuencia real de
 * eventos que un dedo o un ratón. `to === -1` significa "suelta en el hueco que
 * precede a `gapAntesDe`", que es un destino distinto con su propio marcado.
 */
function arrastrar(from: number, to: number, gapAntesDe?: string) {
  const a = celdaRect(from);
  const b = to < 0 ? huecoRect(gapAntesDe!) : celdaRect(to);
  const x0 = a.left + a.width / 2;
  const y0 = a.top + a.height / 2;
  const x1 = b.left + b.width / 2;
  const y1 = b.top + b.height / 2;

  const grid = document.querySelector('#inv-grid') as HTMLElement;
  const src = grid.querySelector(`[data-cell="${from}"]`) as HTMLElement;

  src.dispatchEvent(evento('pointerdown', x0, y0));
  // Dos movimientos: el primero pasa el umbral, el segundo lleva al destino.
  src.dispatchEvent(evento('pointermove', x0 + 20, y0 + 20));
  src.dispatchEvent(evento('pointermove', x1, y1));
  src.dispatchEvent(evento('pointerup', x1, y1));
}

// --------------------------------------------------------------------------

function correr() {
  const n = Number(new URLSearchParams(location.search).get('caso') ?? 0);
  const sc = SCENARIOS[n] ?? SCENARIOS[0];
  pintar(sc);

  const arrastrado = (document.querySelector(`#inv-grid [data-cell="${sc.from}"]`) as HTMLElement)?.dataset.id;
  const huecosAntes = [...estado.warehouseGaps];
  const antes = rejillaPintada();
  arrastrar(sc.from, sc.to, sc.gapAntesDe);
  const despues = rejillaPintada();

  // En qué celda ha quedado el grupo. Es LA comprobación: el jugador soltó en
  // `to`, así que el item tiene que estar en `to` y no en la de al lado.
  const celdaFinal = celdasPintadas().indexOf(arrastrado!);
  // Y en una rejilla con huecos, la posición PINTADA importa tanto como la de
  // celda: si el item cae en la posición que el jugador señaló, bien.
  const posPintada = despues.indexOf(arrastrado!);

  const out = {
    caso: n,
    nombre: sc.nombre,
    arrastre: sc.to < 0
      ? `celda ${sc.from} -> hueco delante de ${sc.gapAntesDe}`
      : `celda ${sc.from} -> celda ${sc.to}`,
    huecos: `${huecosAntes.join(',') || '-'} -> ${estado.warehouseGaps.join(',') || '-'}`,
    rejillaAntes: antes,
    rejillaDespues: despues,
    cambio: antes.join() !== despues.join(),
    celdaDondeQuedo: celdaFinal,
    posPintada,
    cayoEnLaCeldaSenalada: celdaFinal === sc.to,
    llamada: llamadas[0] ?? null
  };
  (window as any).__resultado = out;
  document.title = out.cambio ? 'arrastre: MOVIO' : 'arrastre: SIN CAMBIOS';
  console.log('ARRESTRE', JSON.stringify(out, null, 1));
}

correr();
