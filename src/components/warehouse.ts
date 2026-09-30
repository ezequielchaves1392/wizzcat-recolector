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
import { AFFIX_BY_ID } from '../data/crafting';
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

const TYPE_LABEL: Record<string, string> = {
  collector: 'Recolector',
  companion: 'Compañero',
  crate: 'Caja',
  key: 'Llave',
  crystal: 'Cristal de Mejora',
  consumable: 'Consumible'
};

const MAX_STACK: Record<string, number> = {
  consumable: 20, crate: 20, key: 99, crystal: 99
};

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
  onHome?: () => void,
  go?: (r: any) => void
) {
  draw(container, game, onBack, onStateChange, onHome, go);
}

function draw(
  container: HTMLElement,
  game: any,
  onBack: () => void,
  onStateChange?: () => void,
  onHome?: () => void,
  go?: (r: any) => void
) {
  const state = game.getState();
  const warehouse = (state.warehouse || []) as any[];
  const capacity = game.getCapacity?.() ?? state.warehouseCapacity ?? 15;

  // --- Filtrado y orden --------------------------------------------------
  // La lista sale de `visibleStacks()`, la MISMA función que usa el arrastre
  // para traducir una celda a un índice del array. Con dos copias del criterio
  // de orden, el arrastre movía los items a un sitio distinto del que el
  // jugador veía: la celda 3 del array no es la celda 3 de una vista ordenada.
  const items = visibleStacks(game, state).map(c => c!.item);

  const stacked = stackItems(items);

  // La selección sobrevive al re-render, pero se invalida si el item desaparece
  if (ui.selectedId && !warehouse.some((w: any) => w.id === ui.selectedId)) {
    ui.selectedId = null;
    ui.sheetOpen = false;
  }
  const selected = ui.selectedId ? warehouse.find((w: any) => w.id === ui.selectedId) : null;

  // --- Celdas -----------------------------------------------------------
  const cell = (w: any, i: number) => {
    const isSel = w.id === ui.selectedId;
    const isEquipped = (w.type === 'collector' && w.equipped) || (w.type === 'companion' && state.activeCompanions.includes(w.id));
    const count = w.stackable ? (w.stackCount || 1) : 0;
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

  const emptyCell = (i: number) => `
    <div class="inv-cell opacity-25" data-cell="${i}" data-empty="1" aria-hidden="true">
      <span class="text-[var(--text-muted)] [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('plus')}</span>
    </div>
  `;

  // Huecos hasta la capacidad: el jugador ve cuánto le queda
  const totalCells = Math.max(stacked.length, Math.min(capacity, Math.max(12, Math.ceil(capacity / 3) * 3)));
  const cells: string[] = [];
  for (let i = 0; i < totalCells; i++) {
    cells.push(stacked[i] ? cell(stacked[i], i) : emptyCell(i));
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
          <span class="text-[10px] font-mono tabular ${warehouse.length >= capacity ? 'text-rose-400' : 'text-[var(--text-muted)]'}">
            ${warehouse.length}/${capacity} ranuras
          </span>
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
    onHome,
    activeRoute: 'almacen',
    state
  }, body));

  wireNav(root, { back: onBack, home: onHome, go });
  wire(root, game, onBack, onStateChange);
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
  const isEquipped = (isCollector && item.equipped) || (isCompanion && state.activeCompanions.includes(item.id));
  const sellPrice = game.getSellPrice?.(item.id) ?? item.sellPrice ?? 0;
  const maxStack = MAX_STACK[item.type] ?? 1;
  const maxLevel = item.maxLevel ?? 20;

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
              <span class="text-[10px] font-mono text-[var(--text-muted)]">${TYPE_LABEL[item.type] ?? item.type}</span>
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
            Vender · ${formatNumber(sellPrice)} ◆
          </button>
        </div>

        ${isEquipped ? `<p class="text-[9px] text-amber-400 text-center mt-2">Desequípalo para venderlo o mejorarlo.</p>` : ''}
  `;
}

/** Agrupa los apilables por tipo+nombre y devuelve una copia ordenada. */
function stackItems(items: any[]): any[] {
  const out: any[] = [];
  const map = new Map<string, any>();
  const STACKABLE = ['consumable', 'crate', 'key', 'crystal'];

  for (const item of items) {
    if (item.stackable && STACKABLE.includes(item.type)) {
      const key = `${item.type}_${item.name}`;
      const cap = MAX_STACK[item.type] ?? 20;
      const existing = map.get(key);
      if (existing) {
        existing.stackCount = Math.min((existing.stackCount || 1) + (item.stackCount || 1), cap);
      } else {
        const copy = { ...item, stackCount: Math.min(item.stackCount || 1, cap) };
        map.set(key, copy);
        out.push(copy);
      }
    } else {
      out.push(item);
    }
  }
  return out;
}

function wire(container: HTMLElement, game: any, onBack: () => void, onStateChange?: () => void) {
  const redraw = () => draw(container, game, onBack, onStateChange);

  container.querySelector('[data-nav-back]')?.addEventListener('click', onBack);

  // --- Filtro y orden ---
  container.querySelectorAll<HTMLElement>('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.nav();
      ui.filter = btn.dataset.filter!;
      redraw();
    });
  });
  container.querySelector<HTMLSelectElement>('#wh-sort')?.addEventListener('change', (e) => {
    ui.sort = (e.target as HTMLSelectElement).value;
    redraw();
  });

  // --- Selección y arrastre --------------------------------------------
  // Un solo conjunto de manejadores de puntero para toda la rejilla. Cada
  // celda recibe listeners nuevos en cada re-render; si se cumularan, un
  // arrastre dispararía N veces. Se limpian antes de volver a ligar.
  const grid = container.querySelector('#inv-grid') as HTMLElement | null;
  if (grid) setupDragAndDrop(grid, game, redraw);

  // --- Acciones de la hoja ---------------------------------------------
  container.addEventListener('click', (e) => {
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
      case 'sell':
        if (!item) return;
        sellItem(game, item, redraw);
        break;
    }
  });
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

    // Resaltar la celda bajo el dedo. Se resaltan también los huecos: son
    // destinos válidos, y sin este resaltado no hay forma de saber que el
    // arrastre va a funcionar.
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-cell]') as HTMLElement | null;
    grid.querySelectorAll('.is-over').forEach(el => el.classList.remove('is-over'));
    if (over && over.dataset.cell !== String(fromIndex)) over.classList.add('is-over');
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

    // Arrastre: soltar sobre cualquier celda, ocupada o vacía.
    //
    // Antes solo se aceptaba una celda CON item, porque el movimiento era un
    // intercambio: soltar en un hueco no tenía sentido. Con `moveItem` —una
    // inserción, no un intercambio— cualquier posición es válida, incluidas
    // las vacías del final. Por eso el resaltado ya no excluye los huecos.
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-cell]') as HTMLElement | null;
    const dst = target ? Number(target.dataset.cell) : -1;
    if (dst >= 0 && dst !== src) {
      if (moveItem(game, draggedId, dst)) {
        sfx.place();
        ui.sort = 'default';
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
//  El filtro y la ordenación viven en `visibleStacks()` y los usa tanto el
//  pintado como el arrastre. Estaban duplicados: el arrastre traducía el
//  número de celda con `Math.min(dstViewIndex, wh.length - 1)`, que solo daba
//  el resultado correcto sin filtro y sin orden. Con el almacén ordenado por
//  valor, soltar un item en la celda 3 lo mandaba a la posición 3 del array,
//  que no es donde el jugador lo ve.
//
//  Con una sola función, celda y array son siempre el mismo sitio.
// ==========================================================================

/**
 * Los grupos de items en el mismo orden en que los pinta la rejilla.
 *
 * Devuelve una entrada por celda: el item si la celda tiene uno, `null` si está
 * vacía. Se agrupan los apilables igual que en el pintado, así que una celda
 * con 20 tarjetas sigue siendo una celda y sigue teniendo 20 items detrás.
 */
function visibleStacks(game: any, state: any): Array<{ item: any; size: number } | null> {
  const wh = (state.warehouse || []) as any[];
  let items = wh.filter((w: any) => matchesFilter(w, ui.filter));

  if (ui.sort === 'name') items = [...items].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  else if (ui.sort === 'rarity') items = [...items].sort((a, b) => (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0));
  else if (ui.sort === 'tier') items = [...items].sort((a, b) => (b.tier || 0) - (a.tier || 0));
  else if (ui.sort === 'value') {
    const precio = (w: any) => game.getSellPrice?.(w.id) ?? w.sellPrice ?? 0;
    items = [...items].sort((a, b) => precio(b) - precio(a));
  }

  // `stackItems` aplana la lista en grupos; aquí solo hace falta saber cuántos
  // items hay detrás de cada celda, que es el tamaño del grupo.
  const grupos: Array<{ item: any; size: number } | null> = [];
  let actual: any = null;
  let tamano = 0;

  for (const w of items) {
    const clave = `${w.type}_${w.name}`;
    if (w.stackable && actual && `${actual.type}_${actual.name}` === clave) {
      tamano += w.stackCount || 1;
      continue;
    }
    if (actual) grupos.push({ item: actual, size: tamano });
    actual = w;
    tamano = w.stackCount || 1;
  }
  if (actual) grupos.push({ item: actual, size: tamano });

  return grupos;
}

/** Traduce la celda de destino a un índice del array y mueve el item allí. */
function moveItem(game: any, draggedId: string, dstViewIndex: number): boolean {
  const state = game.getState();
  const wh = state.warehouse as any[];
  const realFrom = wh.findIndex((w: any) => w.id === draggedId);
  if (realFrom < 0) return false;

  const celdas = visibleStacks(game, state);
  const origen = celdas.findIndex(c => c && c.item.id === draggedId);
  if (origen < 0) return false;

  // La celda destino se recorta al rango real: soltar más allá de la última
  // significa "al final", no un error.
  const destino = Math.max(0, Math.min(dstViewIndex, celdas.length - 1));
  if (destino === origen) return false;

  // Índice del array equivalente: la suma de los tamaños de los grupos que hay
  // antes de la celda destino. Sin esto, con una pila en medio la cuenta no
  // cuadraría: la celda 3 puede estar detrás de 8 items del array.
  let realTo = 0;
  for (let i = 0; i < destino; i++) realTo += celdas[i]?.size ?? 0;

  if (realTo === realFrom) return false;
  return game.moveItem(draggedId, realTo);
}

/** ¿El item pasa el filtro activo de la rejilla? */
function matchesFilter(w: any, filtro: string): boolean {
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
  overlay.className = 'fixed inset-0 z-[70] flex items-end justify-center pointer-events-none';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/60 pointer-events-auto" data-cerrar></div>
    <div class="relative card-glass-elevated w-full max-w-md rounded-t-2xl pointer-events-auto p-4
                max-h-[80dvh] overflow-y-auto overscroll-contain animate-rise-in"
         style="padding-bottom: calc(1.25rem + env(safe-area-inset-bottom))">
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

/** Vende un item. El precio y el borrado los decide el game loop. */
function sellItem(game: any, item: any, redraw: () => void) {
  const qty = item.stackable ? (item.stackCount || 1) : 1;
  const unitario = game.getSellPrice?.(item.id) ?? item.sellPrice ?? 0;
  const total = unitario * qty;

  showConfirmModal(
    `Vendes ${item.name}${qty > 1 ? ` ×${qty}` : ''} por ${formatNumber(total)} nanitas.`,
    () => {
      const res = game.sellItem(item.id);
      if (!res.ok) {
        sfx.error();
        showToast(res.msg || 'No se pudo vender.', 'error');
        return;
      }
      sfx.buy();
      showToast(`Vendido por ${formatNumber(res.gained ?? total)} ◆`, 'success');
      ui.selectedId = null;
      redraw();
    },
    { sublabel: 'Vender', confirmText: `+${formatNumber(total)} ◆` }
  );
}
