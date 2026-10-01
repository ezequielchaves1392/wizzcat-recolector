// ==========================================================================
// Almacén · Rejilla con arrastre y hoja de detalle
//
// Qué cambia respecto a la versión anterior:
//
// 1. REJILLA EN VEZ DE LISTA. El almacén tenía 20 filas de ancho completo con
//    la información metida dentro. En móvil eso obliga a hacer scroll para ver
//    4 cosas. Ahora es una rejilla de celdas cuadradas y la información vive
//    en una hoja que se abre al tocar.
//
// 2. ARRASTRE REAL (módulo 4 del encargo). Antes había un modo "Mover": tocar
//    "Mover", luego tocar el destino. Cuatro toques y un estado intermedio que
//    se podía olvidar activating. Ahora se arrastra la celda y se suelta en
//    otra. Se usa Pointer Events porque es el único mecanismo que cubre dedo,
//    ratón y lápiz con el mismo código, y `touch-action: none` en la celda
//    porque sin eso el navegador scrollea en cuanto el dedo se mueve 2px.
//
// 3. VENTA DINÁMICA. `item.sellPrice` era un número congelado en el save.
//    Ahora se pide al game loop, que aplica la valoración por tier, potencial,
//    afijos y la bonificación de venta del árbol de pasivas. Vender un recolector
//    crafteada de 5 estrellas vale 12x lo que valía al comprarla.
//
// 4. SIN EMOJIS. Se usan los iconos SVG del set. El emoji 🤖 salía como un
//    cuadrado vacío en Windows y como un robot en macOS: el mismo item se ve
//    distinto según el sistema del jugador.
// ==========================================================================

import { showToast } from '../utils/toast';
import { formatNumber } from '../utils/format';
import { ic } from '../ui/icons';
import { pageShell, mountInto, wireNav, sectionHead } from '../ui/pageShell';
import { showConfirmModal } from '../utils/modal';
import { showCrateRoulette } from './crateRoulette';
import { showCrystalPicker } from './crystalPicker';
import { sfx } from '../utils/audio';
import { rarityClass, raritySlug, RARITY_RANK } from './crateLoot';
import { AFFIX_BY_ID, collectorMaxLevel } from '../data/crafting';
import { valuationBreakdown } from '../data/valuation';
import {
  KEY_DEFS, CRATE_KEY_TIER, keyNameOpensCrate, keyTierFromName, type KeyTier
} from '../data/items';

const TYPE_ICON: Record<string, any> = {
  collector: 'collector',
  companion: 'companion',
  crate: 'crate',
  key: 'key',
  crystal: 'crystal',
  consumable: 'flask'
};

// Lo que se escribe al lado del tier en el detalle. Un tipo que no esté en esta
// tabla se pinta como "Objeto" y no como su identificador crudo: un tipo
// desconocido viene de un guardado viejo, y el jugador tiene que leer algo
// ("dice weapon, no lo conozco"), no ver la palabra `weapon` en su inventario.
const TYPE_LABEL: Record<string, string> = {
  collector: 'Recolector',
  companion: 'Compañero',
  crate: 'Caja',
  key: 'Llave',
  crystal: 'Cristal de Mejora',
  consumable: 'Consumible'
};

// Cómo se nombra UNA unidad en el selector de cantidad. Va aparte de
// `TYPE_LABEL` porque ahí el plural es un rótulo ("Caja") y aquí tiene que
// concordar con el número: "3 × caja". El sustantivo va en singular porque el
// número ya está delante y es el que concuerda.
const UNIDAD_SINGULAR: Record<string, string> = {
  crate: 'caja',
  key: 'llave',
  crystal: 'cristal',
  consumable: 'consumible'
};

// La regla de apilado vive en `data/stacking` porque el game loop necesita la
// MISMA para saber si un item cabe. Con una copia aquí, el contador de ranuras y
// la rejilla acaban contando cosas distintas otra vez.
import { MAX_STACK, isStackable, countOccupiedSlots, stackUnits } from '../data/stacking';

// Estado de la pantalla. Sobrevive a los re-render.
const ui = {
  selectedId: null as string | null,
  filter: 'all' as string,
  sort: 'default' as string,
  sheetOpen: false
};

export function renderWarehouseTab(
  container: HTMLElement,
  game: any,
  onBack: () => void,
  onStateChange?: () => void,
  go?: (r: any) => void
) {
  draw(container, game, onBack, onStateChange, go);
}

function draw(
  container: HTMLElement,
  game: any,
  onBack: () => void,
  onStateChange?: () => void,
  go?: (r: any) => void
) {
  const state = game.getState();
  const warehouse = (state.warehouse || []) as any[];
  const capacity = game.getCapacity?.() ?? state.warehouseCapacity ?? 15;

  // --- Ranuras ocupadas --------------------------------------------------
  //
  // Esto NO es `warehouse.length`. Una pila es un item con unidades dentro, y la
  // rejilla de arriba la pinta en UNA celda: si el contador sumara entradas,
  // 19 llaves se verían en una celda y se contabilizarían como 19 ranuras.
  // Cuenta grupos, con la misma regla que usa el agrupado de abajo.
  const occupied = countOccupiedSlots(warehouse);

  // --- Filtrado y orden --------------------------------------------------
  // La rejilla sale de `visibleStacks()`, la MISMA función que usa el arrastre
  // para saber qué hay detrás de cada celda. Con dos criterios de agrupado
  // distintos —uno para pintar y otro para mover—, el arrastre movía los items a
  // un sitio distinto del que el jugador veía.
  const celdas = visibleStacks(game, state);

  // La selección sobrevive al re-render, pero se invalida si el item desaparece
  if (ui.selectedId && !warehouse.some((w: any) => w.id === ui.selectedId)) {
    ui.selectedId = null;
    ui.sheetOpen = false;
  }
  const selected = ui.selectedId ? warehouse.find((w: any) => w.id === ui.selectedId) : null;

  // --- Celdas -----------------------------------------------------------
  const cell = (g: { item: any; count: number }, i: number) => {
    const w = g.item;
    const isSel = w.id === ui.selectedId;
    const isEquipped = esEquipado(w, state);
    const count = g.count;
    return `
      <button class="inv-cell ${isSel ? 'is-selected' : ''} ${count > 0 ? 'is-stackable' : ''}"
              data-cell="${i}" data-id="${w.id}" data-count="${count}"
              style="${isEquipped ? 'border-color:#fbbf24; box-shadow: inset 0 0 0 1px #fbbf24;' : ''}"
              aria-label="${w.name}">
        <span class="ring-${raritySlug(w.rarity)} w-8 h-8 rounded-lg grid place-items-center
                     ${rarityClass(w.rarity)} [&>span>svg]:w-4 [&>span>svg]:h-4">
          ${ic(TYPE_ICON[w.type] ?? 'crate')}
        </span>
        <span class="text-[9px] font-mono text-[var(--text-main)] text-center leading-tight line-clamp-2 w-full px-0.5">
          ${w.name}
        </span>
        <span class="text-[9px] font-mono ${isEquipped ? 'text-amber-400' : 'text-[var(--text-muted)]'}">
          ${w.tier ? `T${w.tier}` : (w.rarity ?? '')}
          ${w.potential ? ` ${'★'.repeat(w.potential)}` : ''}
        </span>
        ${isEquipped ? `<span class="absolute bottom-0.5 left-1 text-[9px] font-mono text-amber-400">EQ</span>` : ''}
      </button>
    `;
  };

  /**
   * Una celda de capacidad libre.
   *
   * `data-cell` es el índice de celda, que aquí es "más allá de la última", y
   * `data-painted` es la posición REAL en la rejilla, con los huecos ya
   * intercalados. Las dos cosas se necesitan y no son la misma: soltar en una
   * celda vacía tiene que poner el item en la posición que el jugador señaló, y
   * esa posición solo la sabe el índice pintado. Antes, con un hueco por celda,
   * bastaba con "al final" y no hacia falta nada mas.
   */
  const emptyCell = (celda: number, pintado: number) => `
    <div class="inv-cell opacity-25" data-cell="${celda}" data-painted="${pintado}" data-empty="1" aria-hidden="true">
      <span class="text-[var(--text-muted)] [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('plus')}</span>
    </div>
  `;

  /**
   * Un hueco que ha dejado el jugador a propósito.
   *
   * Se ve igual que la capacidad libre a propósito: para el jugador es la misma
   * cosa —"aquí no hay nada y puedo soltar"—, y distinguirlo por el estilo
   * convertiría una diferencia que no le importa en un concepto más que
   * recordar. Lo que sí cambia es el marcado: un hueco lleva `data-gap` con el
   * id del item al que precede y NO lleva `data-cell`.
   *
   * POR QUÉ NO LLEVA `data-cell`. `data-cell` es el índice dentro de `celdas`, y
   * se usa para traducir lo que el jugador señala a un item. Un hueco no
   * representa ningún item, así que no puede llevar ese índice. Si lo llevara,
   * `closest('[data-cell]')` lo encontraría como si fuera una celda real y el
   * arrastre traduciría la señalada a un item que no existe —que es exactamente
   * el desfase de una celda que ya se corrigió una vez, caminos distintos por el
   * mismo error de concepto: confundir "posición pintada" con "celda del
   * almacén".
   */
  const gapCell = (anclaId: string) => `
    <div class="inv-cell opacity-25" data-gap="${anclaId}" aria-hidden="true">
      <span class="text-[var(--text-muted)] [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('plus')}</span>
    </div>
  `;

  // Los huecos del jugador. Solo existen en la vista sin filtro y con el orden
  // del jugador: un hueco dice "aquí no hay nada" en una disposición concreta, y
  // esa disposición deja de ser cierta en cuanto se filtra o se ordena por valor.
  // Pintarlos ahi seria una mentira.
  const gaps = visibleGaps(game, state);

  // Cuántas celdas se pintan. Es el TABLERO: el jugador ve estas celdas y puede
  // soltar en cualquiera, ocupada o no. Vive en una función porque el arrastre
  // necesita el MISMO número: si el pintado y el destino calcularan distinto
  // total, un item podría acabar empujado fuera de la rejilla y desaparecer de
  // la vista sin que se hubiera vendido.
  const totalCells = totalCeldasPintadas(celdas.length, capacity);
  const cells: string[] = [];
  let pintados = 0;
  for (let i = 0; i < celdas.length; i++) {
    // Las celdas de hueco van justas antes de su ancla, tantas como tenga.
    const cuantas = gaps.get(celdas[i].item.id) ?? 0;
    for (let h = 0; h < cuantas; h++) { cells.push(gapCell(celdas[i].item.id)); pintados++; }
    cells.push(cell(celdas[i], i));
    pintados++;
  }
  // La cola libre se reparte DESPUÉS de intercalar los huecos del jugador: si se
  // contara antes, meter un hueco acabaria empujando fuera una celda de
  // capacidad y el almacén encogería solo por acomodar cosas.
  for (let n = 0; pintados < totalCells; n++, pintados++) {
    cells.push(emptyCell(celdas.length + n, pintados));
  }

  const body = `
    <!--
      Dos columnas a partir de lg. Antes el panel de detalle era un overlay
      fixed que en escritorio se convertia en un hijo mas del contenedor en
      columna: caia DEBAJO de la rejilla, pegado a la esquina inferior
      derecha y flotando sobre el vacio. Ahora es una columna de verdad.
    -->
    <div class="flex flex-col lg:flex-row lg:gap-4 lg:items-start">

      <div class="min-w-0 flex-1">
        ${sectionHead('Almacén', 'warehouse', `
          <div class="flex items-center gap-2.5">
            <!--
              El contador de nanitas vive aquí y no en la cabecera de la página.
              En el almacén la decisión es siempre local —vender, ampliar, usar
              una llave— y el número que la acompaña queda en la misma línea que
              las ranuras, no en una esquina a la que hay que llegar con la
              vista. Arriba quedaba demasiado lejos de donde se decide.
            -->
            <span id="wh-nanites"
                  class="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg border tabular flex-shrink-0
                         border-[var(--border-color)]"
                  style="background: color-mix(in srgb, var(--accent) 10%, transparent)">
              <span class="accent-text not-italic text-[11px]" aria-hidden="true">◆</span>
              <span class="font-mono text-[11px] text-[var(--text-main)]" id="wh-nanites-val">${formatNumber(state.nanites || 0)}</span>
            </span>
            <span class="text-[10px] font-mono tabular ${occupied >= capacity ? 'text-rose-400' : 'text-[var(--text-muted)]'}">
              ${occupied}/${capacity} ranuras
            </span>
          </div>
        `)}

        <div class="flex flex-wrap items-center gap-1.5 mb-3">
          ${([
            { id: 'all', label: 'Todo' },
            { id: 'collector', label: 'Recolectores' },
            { id: 'companion', label: 'Compañeros' },
            { id: 'otros', label: 'Otros' }
          ]).map(f => `
            <button class="px-3 h-10 rounded-lg text-[10px] font-mono cursor-pointer transition
                           ${ui.filter === f.id ? 'accent-bg text-slate-950 font-bold' : 'btn-ghost text-[var(--text-muted)]'}"
                    data-filter="${f.id}">${f.label}</button>
          `).join('')}
          <select id="wh-sort" aria-label="Ordenar"
            class="ml-auto h-10 px-2 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer">
            <option value="default" ${ui.sort === 'default' ? 'selected' : ''}>Mi orden</option>
            <option value="value" ${ui.sort === 'value' ? 'selected' : ''}>Mayor valor</option>
            <option value="rarity" ${ui.sort === 'rarity' ? 'selected' : ''}>Rareza</option>
            <option value="tier" ${ui.sort === 'tier' ? 'selected' : ''}>Tier</option>
            <option value="name" ${ui.sort === 'name' ? 'selected' : ''}>Nombre</option>
          </select>
        </div>

        <div class="inv-grid mb-2" id="inv-grid">${cells.join('')}</div>

        <p class="text-[9px] text-[var(--text-muted)] text-center leading-relaxed mt-3">
          Arrastra una celda sobre otra para reordenar. Toca para ver detalles.
        </p>
      </div>

      <aside class="hidden lg:block w-80 xl:w-96 flex-shrink-0 lg:sticky lg:top-2">
        ${selected
          ? detailPanel(selected, state, game)
          : `<div class="card-glass border rounded-2xl p-6 flex flex-col items-center gap-2 text-center">
               <span class="text-[var(--text-muted)] opacity-30 [&>span>svg]:w-9 [&>span>svg]:h-9">${ic('eye')}</span>
               <span class="text-[11px] font-mono text-[var(--text-muted)] leading-relaxed">
                 Selecciona un item de la rejilla para ver su descripcion
               </span>
             </div>`}
      </aside>
    </div>

    ${selected ? detailSheet(selected, state, game) : ''}
  `;

  const root = mountInto(container, pageShell({
    title: 'Almacén',
    subtitle: 'Arrastra para reordenar · toca para inspeccionar',
    icon: 'warehouse',
    onBack,
    state,
    // El contador va junto a las ranuras, dentro del cuerpo de la página.
    hideNanites: true
  }, body));

  wireNav(root, { back: onBack, go });
  // `wire` recibe `root` (el nodo que se recrea), no `container`. Es lo que
  // evita que los listeners se acumulen de un repintado a otro.
  wire(root, game, onBack, onStateChange, go);
}

/** Hoja de detalle. En móvil va abajo con arrastre de salida; en escritorio, arriba. */
function detailSheet(item: any, state: any, game: any): string {
  return `
    <div class="fixed inset-0 z-[60] lg:hidden flex items-end justify-center pointer-events-none">
      <div class="absolute inset-0 bg-black/55 pointer-events-auto" data-act="close"></div>
      <div class="relative card-glass-elevated w-full rounded-t-2xl pointer-events-auto
                  p-4 max-h-[78dvh] overflow-y-auto overscroll-contain animate-rise-in"
           style="padding-bottom: calc(1.25rem + env(safe-area-inset-bottom))">
        ${detailContent(item, state, game)}
      </div>
    </div>
  `;
}

/** Panel de detalle fijo en la columna derecha, solo en escritorio. */
function detailPanel(item: any, state: any, game: any): string {
  return `
    <div class="card-glass border rounded-2xl p-4 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain">
      ${detailContent(item, state, game)}
    </div>
  `;
}

/**
 * Contenido del detalle, compartido por la hoja móvil y el panel de escritorio.
 *
 * Antes eran dos plantillas casi idénticas que se desincronizaron: el botón de
 * cerrar solo existía en una, y el panel de escritorio no tenía forma de
 * cerrarse. Un solo origen para el contenido hace que eso no vuelva a pasar.
 */
function detailContent(item: any, state: any, game: any): string {
  const isCollector = item.type === 'collector';
  const isCompanion = item.type === 'companion';
  const isEquipped = esEquipado(item, state);
  // LO QUE SE VENDE, no lo que vale una unidad. `getSellPrice` es el precio
  // unitario y el botón tiene que enseñar lo que se va a cobrar: con una pila de
  // 20 llaves, "Vender · 480" y un cargo de 9.600 es R3 roto. El total lo pide
  // al game loop (`getSellTotal`) para que no sea esta vista la que multiplica y
  // las dos cosas acaben en números distintos.
  const sellTotal = game.getSellTotal?.(item.id)
    ?? Math.floor((game.getSellPrice?.(item.id) ?? item.sellPrice ?? 0) * stackUnits(item));
  const maxStack = MAX_STACK[item.type] ?? 1;
  // ¿Tiene el jugador un hueco justo delante de este item? Es lo que decide si
  // el botón de la ficha pone o quita un hueco, y lo que le pone el texto.
  //
  // Se lee del estado guardado y no de la rejilla porque el hueco se puede haber
  // creado con un filtro o un orden activo, donde no se pinta: si el botón
  // dependiera de lo que se ve, un hueco creado en "Todo" desaparecería de las
  // opciones en cuanto se filtrara, sin que nadie lo hubiera quitado.
  const aquitienehueco = ((game.getWarehouseGaps?.() ?? state.warehouseGaps ?? []) as string[])
    .includes(item.id);
  const maxLevel = collectorMaxLevel(item.maxLevel);

  const affixList = (item.affixes || []).map((id: string) => {
    const a = AFFIX_BY_ID[id];
    if (!a) return '';
    return `<li class="text-[10px] flex items-start gap-1.5">
      <span class="${rarityClass(a.rarity)} flex-shrink-0 mt-[3px]">◆</span>
      <span><span class="${rarityClass(a.rarity)}">${a.name}</span>
      <span class="text-[var(--text-muted)]"> — ${a.description}</span></span>
    </li>`;
  }).join('');

  const valuation = isCollector ? valuationBreakdown(item) : [];

  return `
        <div class="flex items-start gap-2.5 mb-3">
          <span class="ring-${raritySlug(item.rarity)} w-11 h-11 rounded-xl grid place-items-center
                       flex-shrink-0 ${rarityClass(item.rarity)} [&>span>svg]:w-5 [&>span>svg]:h-5">
            ${ic(TYPE_ICON[item.type] ?? 'crate')}
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="font-['Orbitron'] font-bold text-[13px] text-[var(--text-main)] truncate leading-tight">
              ${item.name}
            </h3>
            <div class="flex items-center gap-1.5 flex-wrap mt-1">
              <span class="text-[10px] font-mono ${rarityClass(item.rarity)}">${item.rarity}</span>
              ${item.tier ? `<span class="text-[10px] font-mono text-[var(--text-muted)]">T${item.tier}</span>` : ''}
              <span class="text-[10px] font-mono text-[var(--text-muted)]">${TYPE_LABEL[item.type] ?? 'Objeto'}</span>
              ${item.potential ? `<span class="text-[10px] text-amber-400">${'★'.repeat(item.potential)}</span>` : ''}
            </div>
          </div>
          <button class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                  data-act="close" title="Cerrar detalle" aria-label="Cerrar detalle">
            <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('close')}</span>
          </button>
        </div>

        <!-- Autoría: lo que hace único al objeto -->
        ${item.forgedBy ? `
          <div class="rounded-lg px-2.5 py-1.5 mb-2.5 flex items-center gap-1.5"
               style="background: color-mix(in srgb, var(--accent) 10%, transparent);
                      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent)">
            <span class="accent-text flex-shrink-0 [&>span>svg]:w-3 h-3">${ic('anvil')}</span>
            <span class="text-[10px] font-mono text-[var(--text-main)] truncate">
              Forjada por <span class="accent-text">${item.forgedBy}</span>
            </span>
          </div>
        ` : ''}

        <p class="text-[11px] text-[var(--text-main)] leading-relaxed mb-2.5">
          ${item.details || 'Sin descripción'}
        </p>

        ${item.stackable ? `
          <div class="mb-2.5">
            <div class="label-caps mb-1">Cantidad</div>
            <div class="flex items-baseline gap-1.5">
              <span class="font-['Orbitron'] font-bold text-base accent-text tabular">${item.stackCount || 1}</span>
              <span class="text-[10px] font-mono text-[var(--text-muted)]">/ ${maxStack}</span>
            </div>
          </div>
        ` : ''}

        ${isCollector && (item.level ?? 0) > 0 ? `
          <div class="mb-2.5">
            <div class="label-caps mb-1">Nivel ${item.level} / ${maxLevel}</div>
            <div class="meter is-tall"><span style="width:${(item.level / maxLevel) * 100}%"></span></div>
          </div>
        ` : ''}

        ${affixList ? `
          <div class="mb-2.5">
            <div class="label-caps mb-1">Afijos heredados</div>
            <ul class="space-y-1">${affixList}</ul>
          </div>
        ` : ''}

        ${valuation.length ? `
          <details class="mb-2.5">
            <summary class="label-caps cursor-pointer select-none">Valoración</summary>
            <ul class="mt-1.5 space-y-0.5">
              ${valuation.map(v => `<li class="text-[10px] font-mono text-[var(--text-muted)]">${v}</li>`).join('')}
            </ul>
          </details>
        ` : ''}

        <div class="flex flex-col gap-1.5 mt-3">
          ${isCollector || isCompanion ? `
            <button class="w-full h-11 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="equip">
              ${isEquipped ? 'Desequipar' : 'Equipar'}
            </button>
          ` : ''}

          ${item.type === 'crate' ? `
            <button class="w-full h-11 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="open">
              ${llavesQueSirven(state, item).length > 0 ? 'Abrir caja' : 'Falta la llave'}
            </button>
          ` : ''}

          ${item.type === 'crystal' ? `
            <button class="w-full h-11 rounded-xl btn-ghost font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="nada" title="Los cristales se gastan desde la Sintonización del recolector">
              Se usa en Sintonización
            </button>
          ` : ''}

          ${item.type === 'consumable' ? `
            <button class="w-full h-11 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="use">Usar</button>
          ` : ''}

          ${isCollector ? `
            <button class="w-full h-11 rounded-xl btn-ghost font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="upgrade" ${isEquipped ? '' : 'disabled style="opacity:.4"'}
                    title="${isEquipped ? '' : 'Equípala primero'}">
              Mejorar con cristales
            </button>
          ` : ''}

          <button class="w-full h-11 rounded-xl font-['Orbitron'] font-bold text-[11px] cursor-pointer
                         border border-amber-500/30 text-amber-400"
                  style="background: color-mix(in srgb, #f59e0b 12%, transparent)"
                  data-act="sell" ${isEquipped ? 'disabled style="opacity:.4"' : ''}>
            ${stackUnits(item) > 1
              // Con pila, el número del botón es el MÁXIMO, no lo que se va a
              // cobrar: por eso lleva el × delante. "Vender · 9.120 ◆" con 19
              // llaves debajo insinúa que eso es lo que se lleva, y en realidad
              // se lleva lo que elija en el selector.
              ? `Vender ×${stackUnits(item)} · ${formatNumber(sellTotal)} ◆`
              : `Vender · ${formatNumber(sellTotal)} ◆`}
          </button>

          <!--
            El UNICO gesto que crea un hueco.

            Por que existe y por que es un boton: un hueco solo puede aparecer ENTRE
            dos items, y una lista empaquetada no tiene ninguna posicion libre entre
            dos items: toda celda vacia esta detras de la ultima. Asi que arrastrar
            nunca puede dejar un hueco en medio, solo rellenar uno que ya exista. Sin
            este boton el primer hueco es imposible de crear y la funcion entera
            no se podria alcanzar.

            Y esta en la ficha del item y no en la rejilla porque "dejar un hueco
            AQUI" es una frase sobre un item, y un boton en la rejilla seria una
            segunda cosa que acertar en una celda pequena.
          -->
          <button class="w-full h-9 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer
                         border border-dashed ${aquitienehueco ? 'accent-border' : ''}"
                  data-act="${aquitienehueco ? 'quitarhueco' : 'dejarhueco'}"
                  style="${aquitienehueco
                    ? 'background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent);'
                    : ''}">
            ${aquitienehueco ? 'Quitar el hueco de aquí' : 'Dejar un hueco aquí'}
          </button>
        </div>

        ${isEquipped ? `<p class="text-[9px] text-amber-400 text-center mt-2">Desequípalo para venderlo o mejorarlo.</p>` : ''}
  `;
}

/** Los tipos cuyos items se acumulan en una sola celda. Ver `data/stacking`. */

/**
 * Si un item está equipado, leyendo el estado y no su bandera.
 *
 * Antes se leía `w.equipped`, que es una COPIA que el game loop mantiene
 * junto a `equippedCollectorId`. Son la misma información en dos sitios y nada
 * los emparejaba en caliente: `equipCollector` decide por la bandera, así que
 * si un guardado viejo traía la bandera puesta y el id vacío, la rejilla
 * pintaba "Desequipar" sobre un recolector que nadie tenía puesto —y pulsar
 * ese botón se llevaba por delante el equipado de verdad, porque el toggle
 * borraba `equippedCollectorId` sin mirar cuál era.
 *
 * El id manda porque es lo que lee el cálculo de daño. La bandera es su
 * proyección, y como dato de solo lectura para el guardado.
 */
function esEquipado(w: any, state: any): boolean {
  if (w.type === 'collector') return state.equippedCollectorId === w.id;
  if (w.type === 'companion') return state.activeCompanions.includes(w.id);
  return false;
}

/**
 * Los manejadores van sobre `root`, el nodo interior que `mountInto` recrea en
 * cada repintado, y NUNCA sobre `container`.
 *
 * `container` es `#app` y sobrevive a todos los renders. Un
 * `container.addEventListener('click', ...)` en cada `draw()` deja el anterior
 * vivo, y el mismo clic llega N veces. Aquí N era el número de repintados
 * desde que se entró al almacén, así que equipar y desequipar se ejecutaban
 * tantas veces como listeners hubiera: como el toggle es su propia inversa,
 * con un número par el estado acababa igual que estaba y el jugador pulsaba
 * "Desequipar" sin que pasara nada. Con un número impar sí cambiaba. De ahí
 * el "a veces funciona y a veces no".
 *
 * Los botones de filtro y el `select` de orden sí se consultan por atributo
 * sobre `root`: viven en nodos nuevos, así que no acumulan, y por cada uno hay
 * un solo elemento.
 */
function wire(root: HTMLElement, game: any, onBack: () => void, onStateChange?: () => void, go?: (r: any) => void) {
  // El re-render tiene que recibir lo mismo que el render original. Aquí se
  // perdían las rutas de navegación: al mover un item la página se repintaba
  // sin ellas y a partir de ahí no se podía saltar a otra sección.
  const container = root.parentElement as HTMLElement;
  const redraw = () => draw(container, game, onBack, onStateChange, go);

  // --- Filtro y orden ---
  root.querySelectorAll<HTMLElement>('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.nav();
      ui.filter = btn.dataset.filter!;
      redraw();
    });
  });
  root.querySelector<HTMLSelectElement>('#wh-sort')?.addEventListener('change', (e) => {
    ui.sort = (e.target as HTMLSelectElement).value;
    redraw();
  });

  // --- Selección y arrastre --------------------------------------------
  // Un solo conjunto de manejadores de puntero para toda la rejilla. Cada
  // celda recibe listeners nuevos en cada re-render; si se cumularan, un
  // arrastre dispararía N veces. Se limpian antes de volver a ligar.
  const grid = root.querySelector('#inv-grid') as HTMLElement | null;
  if (grid) setupDragAndDrop(grid, game, redraw);

  // --- Acciones de la hoja ---------------------------------------------
  // Delegado en `root`, no en `container`. Ver la nota de arriba: sobre
  // `container` este listener se acumulaba y el toggle de equipar se
  // ejecutaba una vez por repintado anterior.
  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!btn) return;
    const act = btn.dataset.act;
    const item = ui.selectedId ? (game.getState().warehouse as any[]).find((w: any) => w.id === ui.selectedId) : null;

    switch (act) {
      case 'close':
        sfx.pick();
        ui.selectedId = null;
        redraw();
        break;
      case 'equip':
        if (!item) return;
        sfx.equip();
        if (item.type === 'collector') game.equipCollector(item.id);
        else if (item.type === 'companion') {
          const ok = game.equipCompanion(item.id);
          if (!ok) showToast('No hay slots de compañero libres.', 'error');
        }
        redraw();
        onStateChange?.();
        break;
      case 'open':
        if (!item) return;
        openCrate(game, item, redraw);
        break;
      case 'use':
        if (!item) return;
        useConsumable(game, item, redraw);
        break;
      case 'upgrade':
        if (!item) return;
        if (item.id !== game.getState().equippedCollectorId) {
          showToast('Equipa el recolector primero.', 'info');
          return;
        }
        // El selector de cristal vive en la vista y no en el game loop porque
        // elegir cristal es una decisión de interfaz. El coste, la probabilidad
        // y el consumo los calcula el juego.
        showCrystalPicker(game, redraw);
        break;

      case 'nada':
        // Botón informativo: no hace nada a propósito.
        return;
      case 'dejarhueco':
        if (!item) return;
        alternaHueco(game, item.id, true);
        sfx.pick();
        ui.sort = 'default';
        redraw();
        break;
      case 'quitarhueco':
        if (!item) return;
        alternaHueco(game, item.id, false);
        sfx.pick();
        redraw();
        break;
      case 'sell':
        if (!item) return;
        sellItem(game, item, redraw);
        break;
    }
  });
}

/**
 * Pone o quita el hueco que va justo delante de `itemId`.
 *
 * La lista de huecos se lee, se toca un elemento y se devuelve ENTERA. Es
 * deliberado: quien sabe qué hueco se está moviendo es la vista, que es la que
 * ve la rejilla, y el juego no tiene por qué saber reinterpretar un "quita este y
 * pon aquel" como si fuera suyo decidir cuál se borra.
 */
function alternaHueco(game: any, itemId: string, dejar: boolean) {
  const actuales: string[] = game.getWarehouseGaps?.() ?? [];
  // Quitar se lleva TODAS las celdas de hueco de ese item, no una: el botón es
  // "no quiero un hueco aquí", y dejar media pila de huecos detrás sería un
  // estado que el jugador no ha pedido en ningún momento.
  const siguiente = dejar ? [...actuales, itemId] : actuales.filter((id: string) => id !== itemId);
  game.setWarehouseGaps?.(siguiente);
}

// ==========================================================================
//  Arrastre con Pointer Events
// ==========================================================================
function setupDragAndDrop(grid: HTMLElement, game: any, redraw: () => void) {
  let dragId: string | null = null;
  let fromIndex = -1;
  let ghost: HTMLElement | null = null;
  let activePointer: number | null = null;
  let startX = 0;
  let startY = 0;
  // Umbral en píxeles: por debajo de esto es un toque, no un arrastre. Sin
  // él, cada toque en móvil movía un píxel y seleccionaba otra celda.
  const THRESHOLD = 8;

  const cleanupGhost = () => {
    ghost?.remove();
    ghost = null;
  };

  grid.addEventListener('pointerdown', (e) => {
    const cell = (e.target as HTMLElement).closest('[data-cell]') as HTMLElement | null;
    if (!cell || (e.target as HTMLElement).closest('select, button[data-act]')) return;
    if (activePointer !== null) return; // ya hay un dedo en pantalla

    const id = cell.dataset.id;
    if (!id) return;

    activePointer = e.pointerId;
    dragId = id;
    fromIndex = Number(cell.dataset.cell);
    startX = e.clientX;
    startY = e.clientY;
    cell.dataset.pendingDrag = '1';
  });

  grid.addEventListener('pointermove', (e) => {
    if (activePointer !== e.pointerId || !dragId) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!ghost && Math.hypot(dx, dy) < THRESHOLD) return; // todavía es un toque

    const cell = grid.querySelector(`[data-cell="${fromIndex}"]`) as HTMLElement | null;
    if (!cell) return;

    if (!ghost) {
      sfx.pick();
      cell.classList.add('is-dragging');
      delete cell.dataset.pendingDrag;
      ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.style.background = 'color-mix(in srgb, var(--bg-app) 88%, transparent)';
      ghost.style.border = '1px solid var(--accent)';
      ghost.innerHTML = cell.innerHTML;
      document.body.appendChild(ghost);
      // `setPointerCapture` en el elemento que recibió el pointerdown: sin
      // esto, en móvil el dedo se sale de la celda a los pocos píxeles y el
      // navegador cancela el arrastre.
      cell.setPointerCapture?.(e.pointerId);
    }

    e.preventDefault();
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;

    // Resaltar lo que hay bajo el dedo. Se resaltan también los huecos del
    // jugador: son destinos válidos, y sin este resaltado no hay forma de saber
    // que el arrastre va a funcionar. Un hueco lleva `data-gap` y no `data-cell`,
    // así que los dos selectores son necesarios y no se solapan.
    const under = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
    const over = (under?.closest('[data-cell],[data-gap]') ?? null) as HTMLElement | null;
    grid.querySelectorAll('.is-over').forEach(el => el.classList.remove('is-over'));
    if (over && over.dataset.cell !== String(fromIndex) && over.dataset.gap === undefined) {
      over.classList.add('is-over');
    }
  });

  const finish = (e: PointerEvent) => {
    if (activePointer !== e.pointerId) return;
    activePointer = null;

    const wasDragging = !!ghost;
    cleanupGhost();
    grid.querySelectorAll('.is-over, .is-dragging').forEach(el => el.classList.remove('is-over', 'is-dragging'));

    if (!dragId) return;
    const draggedId = dragId;
    dragId = null;
    const src = fromIndex;
    fromIndex = -1;

    if (!wasDragging) {
      // Toque simple: seleccionar
      sfx.pick();
      ui.selectedId = ui.selectedId === draggedId ? null : draggedId;
      redraw();
      return;
    }

    // Arrastre: soltar sobre cualquier celda, ocupada o vacía, o sobre un hueco
    // que el jugador dejó a propósito.
    //
    // Antes solo se aceptaba una celda CON item, porque el movimiento era un
    // intercambio: soltar en un hueco no tenía sentido. Ahora es una inserción,
    // así que cualquier posición es válida, incluidas las vacías del final.
    // Por eso el resaltado ya no excluye los huecos.
    //
    // Al mover, la ordenación vuelve a "Mi orden". Es a propósito: si se
    // mantuviera, el jugador volvería a ver el almacén ordenado por valor y el
    // item que acaba de colocar no estaría donde lo dejó, que es justo la
    // sensación de que el arrastre no sirve. Acomodar a mano ES elegir "Mi
    // orden"; a partir de ahí se vuelve a ordenar si quiere.
    //
    // Hay TRES destinos distintos y cada uno con su traducción. Un hueco es un
    // intercambio de item por hueco; una celda de capacidad libre del final es
    // "vete al final y deja libre donde estabas"; y una celda ocupada es solo
    // un traslado. Conflacionarlos es lo que hacía que soltar en un hueco no
    // moviera el item, solo lo recolocara, y el jugador lo leía como "aquí no se
    // puede mover nada".
    const under = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
    const hueco = (under?.closest('[data-gap]') ?? null) as HTMLElement | null;
    const target = (under?.closest('[data-cell]') ?? null) as HTMLElement | null;

    if (hueco?.dataset.gap) {
      // Hueco del jugador: el item entra y el hueco se va a donde estaba.
      if (moveIntoGap(game, draggedId, hueco.dataset.gap, ui.filter, ui.sort)) {
        sfx.place();
        ui.sort = 'default';
      } else {
        showToast('Ese hueco ya está donde toca.', 'info');
      }
    } else if (target?.dataset.empty) {
      // Celda VACÍA de capacidad. Es el gesto que el jugador pedía desde el
      // principio: soltar en un espacio vacío y que el item se quede AHI, no
      // "al final". Se le pasa la posición PINTADA, que es la que señala, y no
      // el índice de celda: con huecos intercalados no son lo mismo.
      const pintado = target.dataset.painted !== undefined
        ? Number(target.dataset.painted)
        : Number(target.dataset.cell);
      if (moveToFreeCell(game, draggedId, pintado, ui.filter, ui.sort)) {
        sfx.place();
        ui.sort = 'default';
      } else {
        showToast('Ya está en la última posición: no hay más sitio libre detrás.', 'info');
      }
    } else {
      const dst = target ? Number(target.dataset.cell) : -1;
      if (dst >= 0 && dst !== src) {
        // Se apunta el orden ANTES de mover. Un traslado que se acepta pero deja el
        // almacén igual es un caso real y frecuente —soltarlo donde ya estaba—, y
        // sin esto sonaba el "colocado" como si se hubiera movido algo. El jugador
        // veía una celda quieta, con su item igual, y se quedaba con la impresión
        // de que el arrastre estaba roto. Se le dice, en una línea, qué ha pasado.
        const antes = ((game.getState().warehouse as any[]) || []).map((w: any) => w.id).join(',');

        if (moveItem(game, draggedId, dst)) {
          const despues = ((game.getState().warehouse as any[]) || []).map((w: any) => w.id).join(',');
          if (despues === antes) {
            showToast('Ya estaba en ese sitio.', 'info');
          } else {
            sfx.place();
            ui.sort = 'default';
          }
        }
      }
    }
    redraw();
  };

  grid.addEventListener('pointerup', finish);
  grid.addEventListener('pointercancel', (e) => {
    cleanupGhost();
    grid.querySelectorAll('.is-over, .is-dragging').forEach(el => el.classList.remove('is-over', 'is-dragging'));
    if (activePointer === e.pointerId) activePointer = null;
    dragId = null;
    fromIndex = -1;
  });

  // Sin esto, un arrastre en móvil termina en un clic que abre la hoja.
  grid.addEventListener('click', (e) => e.stopPropagation());
}

// ==========================================================================
//  Mover items
//
//  El filtro, la ordenación y el agrupado de apilables viven en
//  `visibleStacks()` y los usa tanto el pintado como el arrastre. Estaban
//  duplicados: el arrastre traducía el número de celda con
//  `Math.min(dstViewIndex, wh.length - 1)`, que solo daba el resultado correcto
//  sin filtro, sin orden y sin pilas. Con el almacén ordenado por valor, soltar
//  un item en la celda 3 lo mandaba a la posición 3 del array, que no es donde
//  el jugador lo ve.
//
//  Y el destino NO se traduce a un índice del array sino a un ANCLA: el item
//  junto al que tiene que quedar el grupo, y de qué lado. Con una celda por item
//  plano el índice parecía funcionar, pero en cuanto había una pila por medio la
//  cuenta se desviaba y el item caía una celda más allá, y los huecos del final
//  —que es lo único "vacío" que hay— se recortaban a la última celda ocupada,
//  así que arrastrar el último item a un hueco no hacía nada.
//
//  El ancla sola no bastaba: entrar siempre por delante del ancla es lo que
//  dejó el arrastre con una celda de retraso, y de paso convertía en un no-op
//  exacto soltar sobre la celda de al lado. Ver `moveItemTo`.
//
//  Con una sola función, un ancla en vez de un índice y el lado que decide quien
//  mira la rejilla, celda y array son siempre el mismo sitio.
// ==========================================================================

/**
 * Los grupos de items en el mismo orden en que los pinta la rejilla.
 *
 * Devuelve una entrada por celda: el item que representa la celda y la lista de
 * ids que hay detrás. Se agrupan los apilables igual que en el pintado, así que
 * una celda con 20 tarjetas sigue siendo una celda y sigue teniendo 20 items
 * detrás.
 *
 * `item` es el que se pinta, `count` el número de la esquina y `ids` todos los
 * items que hay detrás de la celda. Los tres van juntos porque son tres vistas
 * del MISMO grupo: el pintado necesita el representative y el contador, y el
 * arrastre necesita la lista entera, porque arrastrar una celda arrastra la
 * pila completa y no uno de los items que hay dentro.
 */
function visibleStacks(game: any, state: any): Array<{ item: any; ids: string[]; count: number }> {
  return visibleStacksFor(game, state, ui.filter, ui.sort);
}

/**
 * Las celdas de la rejilla para un filtro y un orden concretos.
 *
 * Es `visibleStacks` sin el estado de pantalla. La versión que leía `ui.filter` y
 * `ui.sort` no se podía comprobar sin montar la pantalla entera, y el agrupado de
 * pilas es justo lo que hay que verificar: de él dependen a la vez lo que se pinta
 * y los índices que el arrastre usa como destino, así que un error ahí mueve el
 * item a un sitio distinto del que el jugador señaló.
 */
export function visibleStacksFor(
  game: any,
  state: any,
  filtro: string,
  sort: string
): Array<{ item: any; ids: string[]; count: number }> {
  const wh = (state.warehouse || []) as any[];
  let items = wh.filter((w: any) => matchesFilter(w, filtro));

  if (sort === 'name') items = [...items].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  else if (sort === 'rarity') items = [...items].sort((a, b) => (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0));
  else if (sort === 'tier') items = [...items].sort((a, b) => (b.tier || 0) - (a.tier || 0));
  else if (sort === 'value') {
    const precio = (w: any) => game.getSellPrice?.(w.id) ?? w.sellPrice ?? 0;
    items = [...items].sort((a, b) => precio(b) - precio(a));
  }

  // Los items iguales se acumulan en la celda del primero, estén o no juntos en
  // el array. Antes solo se juntaban los VECINOS, así que la rejilla que pintaba
  // el agrupado y la que veía el arrastre tenían distinto número de celdas: el
  // número de celda que el jugador señalaba no era el mismo sitio en las dos.
  const grupos: Array<{ item: any; ids: string[]; count: number }> = [];
  const celdaDe = new Map<string, number>();

  for (const w of items) {
    if (isStackable(w)) {
      const clave = `${w.type}_${w.name}`;
      const tope = MAX_STACK[w.type] ?? 20;
      const previa = celdaDe.get(clave);

      if (previa !== undefined) {
        grupos[previa].ids.push(w.id);
        grupos[previa].count = Math.min(grupos[previa].count + (w.stackCount || 1), tope);
        continue;
      }

      celdaDe.set(clave, grupos.length);
      grupos.push({ item: w, ids: [w.id], count: Math.min(w.stackCount || 1, tope) });
      continue;
    }

    grupos.push({ item: w, ids: [w.id], count: 0 });
  }

  return grupos;
}

/**
 * Cuántas celdas tiene el tablero.
 *
 * El jugador ve estas celdas y puede soltar en CUALQUIERA, ocupada o no. Es un
 * tablero de verdad, no una lista: por eso una celda vacía es un sitio libre
 * válido y no un adorno. El mínimo de 12 es para que una mochila recién estrenada
 * no salga con tres celdas y un resto de sitio invisible, y el múltiplo de tres
 * es para que las filas cierren en la rejilla.
 *
 * Vive en una función y no en línea porque el arrastre necesita el MISMO número.
 * Si el pintado y el destino calcularan distinto, un item podría acabar
 * empujado fuera de la rejilla y desaparecer de la vista sin que se hubiera
 * vendido: lo peor que puede pasarle a un inventario.
 */
function totalCeldasPintadas(celdas: number, capacity: number): number {
  return Math.max(celdas, Math.min(capacity, Math.max(12, Math.ceil(capacity / 3) * 3)));
}

/**
 * Los huecos que se pintan en la rejilla ahora mismo.
 *
 * Un hueco guardado es un id de item, y solo se pinta si la vista es la del
 * jugador —sin filtro y con su orden—, porque un hueco describe una disposición
 * concreta. Con un filtro activo, la celda que ocupa un item es otra, y el hueco
 * caería en medio de una disposición que el jugador no ha elegido nunca.
 *
 * También se filtra por "el item existe": un hueco anclado a algo que ya no está
 * no se pinta, y esconderlo es preferible a romper el arrastre. El juego limpia
 * los que sobran, pero la vista no confía en que lo haya hecho.
 */
function visibleGaps(game: any, state: any): Map<string, number> {
  const porItem = new Map<string, number>();
  if (ui.filter !== 'all' || ui.sort !== 'default') return porItem;

  // Un hueco puede ocupar VARIAS celdas seguidas, y eso se cuenta por
  // repeticiones del id: ['b','b','c'] son dos celdas vacías antes de `b` y una
  // antes de `c`. Un array de ids con duplicados en vez de un array de objetos es
  // feo, pero evita cambiar el formato guardado por algo que no ha estado vivo lo
  // bastante para que importe, y la multiplicidad se normaliza en un solo sitio.
  const ids = (game.getWarehouseGaps?.() ?? state.warehouseGaps ?? []) as string[];
  const vivos = new Set((state.warehouse || []).map((w: any) => w.id));
  for (const id of ids) {
    if (!vivos.has(id)) continue;
    porItem.set(id, (porItem.get(id) ?? 0) + 1);
  }
  return porItem;
}

/**
 * Solta el grupo de `draggedId` dentro del hueco que precede a `gapBeforeId`.
 *
 * Es un INTERCAMBIO, no una inserción: el item entra en el hueco y el hueco se
 * queda donde estaba el item. Es lo que hace que arrastrar a un hueco tenga
 * sentido —si solo rellenara el hueco, el item desapareciería de donde estaba y
 * el almacén se compactaría hacia arriba, que es justo lo contrario de lo que se
 * acaba de pedir— y es la razón de que el número de huecos no cambie al
 * arrastrar.
 *
 * Se deja justo delante de su ancla, asi que si el grupo ya estaba ahi no hay
 * movimiento posible: el gesto no significa nada y se rechaza con un motivo,
 * para que el jugador no se quede pensando que el arrastre se ha roto.
 */
export function moveIntoGap(
  game: any,
  draggedId: string,
  gapBeforeId: string,
  filtro: string,
  sort: string
): boolean {
  const state = game.getState();
  const celdas = visibleStacksFor(game, state, filtro, sort);
  const origen = celdas.findIndex(c => c.ids.includes(draggedId));
  if (origen < 0) return false;

  const grupo = celdas[origen];

  // El ancla del hueco es parte del propio grupo: es el item que se arrastra, y
  // "ponlo justo delante de sí mismo" no tiene solución.
  if (grupo.ids.includes(gapBeforeId)) return false;

  // Ya está justo delante del ancla: el hueco está pegado a su derecha, así que
  // moverlo no cambiaría nada.
  const celdaAncla = celdas.findIndex(c => c.ids.includes(gapBeforeId));
  if (celdaAncla === origen + 1) return false;

  if (!game.moveItems(grupo.ids, gapBeforeId, 'antes')) return false;

  // El hueco se va donde estaba el grupo. Se ancla al item que venía justo
  // detrás, porque es el que queda arriba del sitio que el grupo acaba de dejar.
  // Si no había nada detrás —el grupo era el último— el hueco cae en la cola
  // libre, que ya se pinta vacía sola y no necesita ancla.
  //
  // La cuenta se hace sobre la lista COMPLETA y no sobre un conjunto: un id
  // puede repetirse, y cada repetición es una celda de hueco. Un `Set` las
  // fundiría en una y el item se quedaría a la izquierda de donde se soltó.
  const siguiente = celdas[origen + 1];
  const actuales: string[] = (game.getWarehouseGaps?.() ?? state.warehouseGaps ?? []) as string[];
  const huecos = actuales.filter(id => id !== gapBeforeId);
  if (siguiente) huecos.push(siguiente.item.id);
  game.setWarehouseGaps?.(huecos);

  return true;
}

/**
 * Suelta el grupo de `draggedId` en la celda VACIA `dstPainted`, que es la
 * posicion PINTADA que el jugador senalo -con los huecos ya intercalados, no el
 * indice de celda.
 *
 * LA REGLA, tal y como la entiende el jugador: **mientras queden celdas vacias,
 * cualquier objeto se puede mover a cualquiera de ellas.** Tambien el ultimo, que
 * es el caso que antes se rechazaba con "no hay mas sitio libre detras": hay
 * sitio, lo que no habia era forma de representarlo.
 *
 * COMO SE REPRESENTA. El array sigue siendo una lista empaquetada, asi que el
 * item solo tiene un sitio: el final. Para que se VEA en la celda 5 hay que poner
 * celdas de hueco por delante que lo empujen hasta ahi, y por eso un hueco puede
 * ocupar varias celdas seguidas.
 *
 * DONDE VAN LOS HUECOS: todos en el item que se mueve, y ninguno en los demas.
 * Es lo que hace que los otros items se queden donde estaban. Repartirlos desde
 * la izquierda -que es lo que habia antes- metia huecos en medio de un almacen
 * lleno y desplazaba cosas que el jugador no habia tocado: al soltar un item en
 * una celda vacia se movian tres mas.
 *
 * CUANTOS. Con `K` celdas, `E` celdas de hueco ya puestas delante del item y `H`
 * nuevas, su posicion pintada es `(K - 1) + E + H`. Para que caiga en
 * `dstPainted`: `H = dstPainted - (K - 1) - E`. El tope es `2K - 1` posiciones,
 * porque no puede haber mas celdas de hueco que celdas ocupadas: cada hueco
 * necesita un item al que anclarse. Mas alla de ese tope se recorta en vez de
 * inventar una posicion.
 */
export function moveToFreeCell(
  game: any,
  draggedId: string,
  dstPainted: number,
  filtro: string,
  sort: string
): boolean {
  const state = game.getState();
  const celdas = visibleStacksFor(game, state, filtro, sort);
  const origen = celdas.findIndex(c => c.ids.includes(draggedId));
  if (origen < 0) return false;
  const capacity = game.getCapacity?.() ?? state.warehouseCapacity ?? 15;

  const K = celdas.length;
  if (!K) return false;

  // Los huecos que ya hay, contados por item. Cada repeticion es una celda.
  const yaPuestos = new Map<string, number>();
  for (const id of (game.getWarehouseGaps?.() ?? state.warehouseGaps ?? []) as string[]) {
    yaPuestos.set(id, (yaPuestos.get(id) ?? 0) + 1);
  }
  const totalPuestos = [...yaPuestos.values()].reduce((a, b) => a + b, 0);

  // El item va al final del array. Si ya estaba, no hay nada que reordenar: solo
  // hacen falta huecos. Este es el caso que antes se rechazaba.
  const grupo = celdas[origen];
  const hayQueMover = origen !== K - 1;
  if (hayQueMover && !game.moveItems(grupo.ids, null, 'despues')) return false;

  // Huecos que hay por delante del item una vez movido: los de las celdas que
  // quedan antes que el. Los del propio item se cuentan aparte, porque son
  // justamente los que se van a anadir.
  const delante = celdas
    .filter((_, i) => i !== origen)
    .reduce((sum, c) => sum + (yaPuestos.get(c.item.id) ?? 0), 0);

  // Cuantas celdas de hueco hay que poner delante del item para que su posicion
  // pintada sea la senalada.
  //
  // NO HAY TOPE DE "UN HUECO POR CELDA". Eso era un limite inventado, y hacia
  // justo lo contrario de lo que el jugador pide: con 3 celdas y 18 libres, solo
  // dejaba mover el item hasta la celda 5. El limite real es el TABLERO: no se
  // pueden poner mas celdas de las que la rejilla dibuja, porque un item
  // empujado mas alla dejaria de pintarse y pareceria perdido sin haberse
  // vendido. Ese es el unico tope que importa, y sale del MISMO numero que usa
  // el pintado.
  const wanted = Math.max(0, dstPainted - (K - 1) - delante);
  const caben = Math.max(0, totalCeldasPintadas(K, capacity) - K - totalPuestos);
  const H = Math.min(wanted, caben);

  if (!hayQueMover && H === 0) return false; // ya esta donde se pidio

  const salida: string[] = [];
  for (const c of celdas) {
    if (c.ids.includes(draggedId)) {
      // Los huecos del item se ponen DE NUEVO, por eso se quitan antes los
      // viejos: si no, cada arrastre a una celda vacia dejaria el hueco que
      // tenia y no avanzaria nunca hacia la derecha.
      salida.push(...Array<string>(H).fill(c.item.id));
      continue;
    }
    salida.push(...Array<string>(yaPuestos.get(c.item.id) ?? 0).fill(c.item.id));
  }
  game.setWarehouseGaps?.(salida);

  return true;
}

/**
 * Lleva el grupo que ocupa la celda de `draggedId` a la celda `dstViewIndex`.
 *
 * El destino se traduce a un ANCLA —el item que tiene que quedar detrás— y se
 * deja que el juego la busque por id DESPUÉS de quitar el grupo. No se traduce
 * a un índice del array porque la cuenta de celdas que hay detrás cambia en
 * cuanto se quita el grupo arrastrado: por eso, con una pila en medio, soltar
 * sobre una celda ocupada dejaba el item una celda más a la derecha de donde se
 * había soltado, y soltar sobre un hueco del final no movía nada, porque todos
 * los huecos se recortaban a la última celda ocupada, que era justo la celda de
 * origen.
 */
function moveItem(game: any, draggedId: string, dstViewIndex: number): boolean {
  return moveItemTo(game, draggedId, dstViewIndex, ui.filter, ui.sort);
}

/**
 * El mismo traslado, con el filtro y el orden como parámetros en vez de leídos
 * del estado de pantalla. La rejilla que el jugador está viendo y la que usa el
 * arrastre tienen que ser LA MISMA: si divergen, el número de celda que señala no
 * es el sitio que se mueve. Se puede comprobar sin DOM, que es lo que hace este
 * banco de pruebas.
 */
export function moveItemTo(
  game: any,
  draggedId: string,
  dstViewIndex: number,
  filtro: string,
  sort: string
): boolean {
  if (dstViewIndex < 0) return false;

  const celdas = visibleStacksFor(game, game.getState(), filtro, sort);
  const origen = celdas.findIndex(c => c.ids.includes(draggedId));
  if (origen < 0) return false;

  const grupo = celdas[origen];
  if (dstViewIndex === origen) return false;

  // Las celdas del final están vacías. No hay item al que anclarse, y lo que el
  // jugador quiere decir con "suéltalo ahí" es "déjalo al final", que es
  // literalmente el hueco que está señalando. Sin ancla, el juego lo pone al final.
  const destino = dstViewIndex >= celdas.length ? null : celdas[dstViewIndex];

  // Soltado sobre su propia celda, o sobre una celda que forma parte del mismo
  // grupo de apilados: no hay nada que colocar delante.
  if (destino && grupo.ids.includes(destino.ids[0])) return false;

  // DE QUÉ LADO DEL ANCLA ENTRA EL BLOQUE. Es lo que hace que el item caiga en
  // la celda señalada y no una antes. El ancla es el item de la celda destino, y
  // si el bloque entra siempre por delante acaba SIEMPRE en la celda anterior a
  // la que el jugador señaló. Peor todavía: soltar sobre la celda vecina era un
  // no-op exacto, porque el bloque ya estaba por delante de ese vecino. El
  // jugador arrastraba, veía que no se movía nada, y concluía que no se puede
  // mover a un hueco.
  //
  // La dirección la decide quien llama, no el juego: solo el que ve la rejilla
  // sabe en qué celda estaba el bloque y en cuál se ha soltado.
  //
  // Con una pila de destino el ancla es el ÚLTIMO item del grupo, no el primero:
  // entrar por detrás de solo uno partiría la pila en dos mitades separadas, que
  // se seguirían pintando como una sola celda (los items iguales se aunan estén
  // donde estén) pero dejarían el almacén guardado con un orden hecho trozos.
  const irDespues = dstViewIndex > origen;
  const ancla = destino
    ? (irDespues ? destino.ids[destino.ids.length - 1] : destino.ids[0])
    : null;

  return game.moveItems(grupo.ids, ancla, irDespues ? 'despues' : 'antes');
}

/** ¿El item pasa el filtro activo de la rejilla? */
export function matchesFilter(w: any, filtro: string): boolean {
  if (filtro === 'all') return true;
  if (filtro === 'otros') return !['collector', 'companion'].includes(w.type);
  return w.type === filtro;
}

// ==========================================================================
//  Acciones sobre items
//
//  Estas tres funciones ya NO mutan el estado: solo piden la operación al
//  game loop y enseñan lo que pasó. Antes cada una restaba el item por su
//  cuenta y llamaba a `updateState`, y ahí estaba el bug de las cajas: el
//  contador se recalculaba antes de que el item se hubiera quitado de verdad,
//  así que la caja volvía a aparecer en el guardado siguiente.
//
//  Concentrar la mutación en el game loop también evita que la vista y el
//  cálculo discrepen: el precio que se enseña es el que se cobra, porque los
//  dos salen del mismo número.
// ==========================================================================
/**
 * Abre una caja.
 *
 * La llave la elige el jugador de las que tiene, y solo se ofrecen las que
 * sirven para ese cofre. El filtro no es una comodidad: es lo que comunica que
 * hay cuatro tipos de llave y que cada cofre pide el suyo.
 */
function openCrate(game: any, item: any, redraw: () => void) {
  const crateType = inferCrateType(item.name);

  const llaves = llavesQueSirven(game.getState(), item);

  if (llaves.length === 0) {
    const necesaria = KEY_DEFS[CRATE_KEY_TIER[crateType as keyof typeof CRATE_KEY_TIER]];
    showToast(`Necesitas ${necesaria?.name ?? 'una llave'} para abrir ${item.name}.`, 'info');
    return;
  }

  const conUnidad = (k: any) => k.stackCount || 1;
  const total = llaves.reduce((a: number, k: any) => a + conUnidad(k), 0);

  const etiquetaLlave = (k: any) =>
    `${k.name}${conUnidad(k) > 1 ? ` ×${conUnidad(k)}` : ''}`;

  // Con una sola llave posible no hace falta preguntar: se usa.
  if (llaves.length === 1) {
    confirmarYabrir(game, item, crateType, llaves[0], redraw);
    return;
  }

  showKeyPicker(llaves, total, (elegida) => {
    confirmarYabrir(game, item, crateType, elegida, redraw);
  });
}

function confirmarYabrir(
  game: any, item: any, crateType: any, llave: any, redraw: () => void
) {
  showConfirmModal(
    `Se gastará <b>${llave.name}</b> y la caja. El botín ya está decidido: la ruleta solo lo enseña.`,
    () => {
      const res = game.openCrateBox(item.id, llave.id);
      if (!res.ok) {
        sfx.error();
        showToast(res.msg || 'No se pudo abrir la caja.', 'error');
        return;
      }
      ui.selectedId = null;
      showCrateRoulette(res.reward, res.crateType ?? crateType, redraw);
    },
    { sublabel: item.name, confirmText: 'Abrir' }
  );
}

/** Selector de llave. Solo aparece cuando hay más de una opción válida. */
function showKeyPicker(
  llaves: any[], total: number, onPick: (llave: any) => void
) {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay z-[70]';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/60 pointer-events-auto" data-cerrar></div>
    <div class="sheet-panel card-glass-elevated animate-rise-in">
      <div class="flex items-start gap-3 mb-3">
        <span class="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 ring-raro rarity-raro
                     [&>span>svg]:w-5 [&>span>svg]:h-5">${ic('key')}</span>
        <div class="min-w-0 flex-1">
          <h3 class="font-['Orbitron'] font-bold text-[14px] text-[var(--text-main)] leading-tight">
            ¿Con qué llave?
          </h3>
          <p class="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
            ${llaves.length} tipos disponibles · ${total} llaves en total
          </p>
        </div>
        <button data-cerrar class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                aria-label="Cerrar">
          <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('close')}</span>
        </button>
      </div>

      <div class="flex flex-col gap-1.5">
        ${llaves.map((k: any, i: number) => {
          const t = typeof k.tier === 'number' ? k.tier : keyTierFromName(k.name || '');
          const def = KEY_DEFS[t as KeyTier];
          return `
            <button data-key="${k.id}" data-idx="${i}"
                    class="w-full rounded-xl border px-3 py-2.5 flex items-center gap-2.5 text-left cursor-pointer
                           transition active:scale-[0.99] border-[var(--border-color)] hover:border-[var(--accent)]"
                    style="background: color-mix(in srgb, var(--accent) 7%, transparent)">
              <span class="flex-shrink-0 ${rarityClass(k.rarity)} [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('key')}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-[12px] font-bold text-[var(--text-main)] truncate">${k.name}</span>
                <span class="block text-[9px] font-mono text-[var(--text-muted)] truncate mt-0.5">${k.details || def?.details || ''}</span>
              </span>
              <span class="text-[11px] font-mono accent-text tabular flex-shrink-0">×${k.stackCount || 1}</span>
            </button>`;
        }).join('')}
      </div>
    </div>
  `;

  const cerrar = () => { overlay.remove(); };
  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.querySelectorAll('[data-key]').forEach(b => {
    b.addEventListener('click', () => {
      sfx.pick();
      const idx = Number((b as HTMLElement).dataset.idx);
      cerrar();
      onPick(llaves[idx]);
    });
  });
  document.body.appendChild(overlay);
}

/**
 * Las llaves del almacén que sirven para abrir este cofre.
 *
 * Vive aquí y no en el game loop porque es una lectura: el juego solo necesita
 * saber si hay alguna y cuál es, y el selector de llave es cosa de la vista.
 */
function llavesQueSirven(state: any, caja: any): any[] {
  const crateType = inferCrateType(caja.name);
  return ((state.warehouse as any[]) || [])
    .filter((w: any) => w.type === 'key' && keyNameOpensCrate(w.name || '', crateType))
    .sort((a: any, b: any) => {
      const ta = typeof a.tier === 'number' ? a.tier : keyTierFromName(a.name || '');
      const tb = typeof b.tier === 'number' ? b.tier : keyTierFromName(b.name || '');
      // De menor a mayor: se gasta la más pobre que sirva, que es la que abunda.
      // Guardar la rara para cuando toque es decisión del jugador.
      return ta - tb;
    });
}

function inferCrateType(name: string): any {
  const l = name.toLowerCase();
  if (l.includes('común')) return 'common';
  if (l.includes('rara')) return 'rare';
  if (l.includes('épica')) return 'epic';
  return 'legendary';
}

/** Aplica un consumible. Toda la lógica vive en el game loop. */
function useConsumable(game: any, item: any, redraw: () => void) {
  showConfirmModal(
    item.details || 'Aplicar el efecto de este consumible.',
    () => {
      const res = game.useConsumable(item.id);
      if (!res.ok) {
        sfx.error();
        showToast(res.msg || 'No se pudo usar.', 'error');
        return;
      }
      sfx.use();
      ui.selectedId = null;
      showToast(res.msg || `${item.name}: aplicado`, 'success');
      redraw();
    },
    { sublabel: item.name, confirmText: 'Usar' }
  );
}

/**
 * Vende un item. El precio, la cantidad y el borrado los decide el game loop.
 *
 * POR QUÉ SOLO PREGUNTA CUANDO HAY PILA. Con una sola unidad no hay nada que
 * decidir: preguntar "¿cuántas?" sobre un item único es un paso de más que
 * solo estorba. Y preguntar cuando la pila es de 1 dejaría un camino de "vender
 * todo" que nadie usaría nunca, porque el jugador que quiere venderlo todo
 * quiere precisamente eso y por eso es el valor por defecto del selector.
 *
 * El importe de cada cantidad lo PREGUNTA al game loop (`getSellTotal`) en vez
 * de multiplicar aquí: es la misma cuenta que hace `sellItem`, y por eso el
 * número que ve el jugador y el que se cobra no pueden separarse (R3).
 */
function sellItem(game: any, item: any, redraw: () => void) {
  const qty = stackUnits(item);
  const total = game.getSellTotal?.(item.id)
    ?? Math.floor((game.getSellPrice?.(item.id) ?? item.sellPrice ?? 0) * qty);

  // Sin pila no hay selector: el diálogo de antes, tal cual.
  if (qty <= 1) {
    showConfirmModal(
      `Vendes ${item.name}${qty > 1 ? ` ×${qty}` : ''} por ${formatNumber(total)} nanitas.`,
      () => confirmarVenta(game, item, undefined, redraw),
      { sublabel: 'Vender', confirmText: `+${formatNumber(total)} ◆` }
    );
    return;
  }

  showConfirmModal(
    `Tienes ${qty} × ${item.name}. Elige cuántas vender.`,
    (units) => confirmarVenta(game, item, units, redraw),
    {
      sublabel: 'Vender',
      confirmText: 'Vender',
      quantity: {
        max: qty,
        itemName: item.name,
        unitName: UNIDAD_SINGULAR[item.type] ?? 'unidad',
        amount: (n) => formatNumber(game.getSellTotal?.(item.id, n) ?? 0)
      }
    }
  );
}

/** Cierra el diálogo y cobra. Separado para que las dos rutas compartan el cobro. */
function confirmarVenta(game: any, item: any, units: number | undefined, redraw: () => void) {
  const res = game.sellItem(item.id, units);
  if (!res.ok) {
    sfx.error();
    showToast(res.msg || 'No se pudo vender.', 'error');
    return;
  }
  sfx.buy();
  const n = res.sold ?? 1;
  showToast(
    `Vendido${n > 1 ? ` ×${n}` : ''} por ${formatNumber(res.gained ?? 0)} ◆`,
    'success'
  );
  // Solo se deselecciona si la pila se ha ido entera: si quedan unidades, el
  // jugador sigue trabajando con el mismo item y quitarle la ficha debajo de las
  // manos es un salto sin motivo.
  if (!game.getState().warehouse.some((w: any) => w.id === item.id)) {
    ui.selectedId = null;
  }
  redraw();
}
