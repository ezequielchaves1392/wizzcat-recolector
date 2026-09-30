import { showToast } from '../utils/toast';
import { formatNumber } from '../utils/format';
import { WarehouseItem } from '../types';
import { AFK_CARD_DURATION_MS, MAX_AFK_BUFF_DURATION_MS } from '../gameLoop';
import { showCrateRoulette } from './crateRoulette';
import { sfx } from '../utils/audio';


function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Sistema de modal de confirmación
function showQuantityModal(item: any, maxStack: number, onConfirm: (quantity: number) => void) {
  const price = item.sellPrice || 0;
  let selectedQuantity = 1;

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm';
  overlay.innerHTML = `
    <div class="card-glass border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4 shadow-2xl">
      <div class="text-center">
        <div class="text-4xl mb-2">${item.type === 'weapon' ? '⚔️' : item.type === 'companion' ? '🤖' : '📦'}</div>
        <h3 class="font-['Orbitron'] font-bold text-lg text-[var(--text-main)]">${item.name}</h3>
        <div class="text-sm font-mono text-[var(--text-muted)]">Cantidad disponible: ${maxStack}</div>
      </div>
      <div class="border-t border-[var(--border-color)] pt-3">
        <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-2">Cantidad a vender</div>
        <div class="flex items-center gap-3">
          <button id="qty-minus" class="w-10 h-10 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 font-bold hover:bg-slate-700 transition cursor-pointer">-</button>
          <div class="flex-1 text-center">
            <div class="text-2xl font-bold text-cyan-400 font-['Orbitron']" id="qty-display">1</div>
          </div>
          <button id="qty-plus" class="w-10 h-10 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 font-bold hover:bg-slate-700 transition cursor-pointer">+</button>
        </div>
        <input type="range" id="qty-slider" min="1" max="${maxStack}" value="1" class="w-full mt-3">
      </div>
      <div class="border-t border-[var(--border-color)] pt-3">
        <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-1">Precio total</div>
        <div class="text-xl font-bold text-amber-400 font-['Orbitron']" id="qty-total">${formatNumber(price)} ⚡</div>
      </div>
      <div class="flex gap-2">
        <button id="qty-cancel" class="flex-1 py-2 bg-slate-700/50 border border-slate-600/50 text-slate-300 font-['Orbitron'] font-bold text-xs rounded-xl hover:bg-slate-700 transition cursor-pointer">
          Cancelar
        </button>
        <button id="qty-confirm" class="flex-1 py-2 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
          Vender
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const qtyDisplay = overlay.querySelector('#qty-display')!;
  const qtyTotal = overlay.querySelector('#qty-total')!;
  const qtySlider = overlay.querySelector('#qty-slider') as HTMLInputElement;

  const updateQuantity = (qty: number) => {
    selectedQuantity = Math.max(1, Math.min(qty, maxStack));
    qtyDisplay.textContent = selectedQuantity.toString();
    qtyTotal.textContent = `${formatNumber(price * selectedQuantity)} ⚡`;
    qtySlider.value = selectedQuantity.toString();
  };

  overlay.querySelector('#qty-minus')?.addEventListener('click', () => updateQuantity(selectedQuantity - 1));
  overlay.querySelector('#qty-plus')?.addEventListener('click', () => updateQuantity(selectedQuantity + 1));
  qtySlider?.addEventListener('input', (e) => updateQuantity(parseInt((e.target as HTMLInputElement).value)));
  overlay.querySelector('#qty-cancel')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#qty-confirm')?.addEventListener('click', () => {
    overlay.remove();
    onConfirm(selectedQuantity);
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function showItemCard(item: any, onConfirm: () => void) {
  const rarityColors: Record<string, string> = {
    'Común': 'text-slate-400',
    'Raro': 'text-blue-400',
    'Épico': 'text-purple-400',
    'Legendario': 'text-amber-400',
    'Mítico': 'text-red-400',
    'Divino': 'text-yellow-300'
  };

  const rarityColor = rarityColors[item.rarity] || 'text-slate-400';
  const icon = item.type === 'weapon' ? '⚔️' : item.type === 'companion' ? '🤖' : item.type === 'crate' ? '📦' : item.type === 'key' ? '🔑' : item.type === 'crystal' ? '💎' : '⚡';

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm';
  overlay.innerHTML = `
    <div class="card-glass border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4 shadow-2xl">
      <div class="text-center">
        <div class="text-4xl mb-2">${icon}</div>
        <h3 class="font-['Orbitron'] font-bold text-lg text-[var(--text-main)]">${item.name}${item.tier ? ` T${item.tier}` : ''}</h3>
        <div class="text-sm font-mono ${rarityColor}">${item.rarity}</div>
      </div>
      <div class="border-t border-[var(--border-color)] pt-3">
        <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-1">Descripción</div>
        <div class="text-sm font-mono text-[var(--text-main)]">${item.details || 'Sin descripción'}</div>
      </div>
      <div class="flex gap-2">
        <button id="item-card-cancel" class="flex-1 py-2 bg-slate-700/50 border border-slate-600/50 text-slate-300 font-['Orbitron'] font-bold text-xs rounded-xl hover:bg-slate-700 transition cursor-pointer">
          Cancelar
        </button>
        <button id="item-card-confirm" class="flex-1 py-2 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
          Vender
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#item-card-cancel')?.addEventListener('click', () => {
    overlay.remove();
  });

  overlay.querySelector('#item-card-confirm')?.addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function showConfirmModal(message: string, onConfirm: () => void) {
  // Crear overlay
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
  overlay.id = 'confirm-modal-overlay';
  
  // Crear modal
  const modal = document.createElement('div');
  modal.className = 'card-glass border rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4';
  
  // Mensaje
  const messageEl = document.createElement('p');
  messageEl.className = 'text-sm font-mono text-[var(--text-main)] text-center';
  messageEl.textContent = message;
  
  // Contenedor de botones
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'flex gap-3';
  
  // Botón cancelar
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'flex-1 py-2.5 bg-slate-700/50 border border-slate-600/50 text-slate-300 font-[\'Orbitron\'] font-bold text-xs rounded-xl hover:bg-slate-700 transition cursor-pointer';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });
  
  // Botón aceptar
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'flex-1 py-2.5 accent-bg text-slate-950 font-[\'Orbitron\'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer';
  confirmBtn.textContent = 'Aceptar';
  confirmBtn.addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
  
  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(confirmBtn);
  
  modal.appendChild(messageEl);
  modal.appendChild(buttonContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Cerrar con Escape
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

/**
 * Módulo de Almacén Central (Warehouse Hub)
 * Grilla de 20 slots con panel lateral de inspección
 */
export function renderWarehouseTab(container: HTMLElement, game: any, onBack: () => void, onStateChange?: () => void) {
    let selectedItemId: string | null = null;
    let currentSort: string = 'default';
    let currentFilter: string = 'all';
    let moveMode = false;

    const renderTemplate = () => {
        const state = game.getState();
        const warehouse = state.warehouse || [];
        const capacity = state.warehouseCapacity || 20;

        // Aplicar filtro
        let filteredItems = warehouse.filter((item: WarehouseItem) => {
            if (currentFilter === 'all') return true;
            if (currentFilter === 'consumable') {
                return !['weapon', 'companion'].includes(item.type);
            }
            return item.type === currentFilter;
        });

        // Aplicar orden (no ordenar si es Custom - respetar orden manual del usuario)
        if (currentSort === 'name') {
            filteredItems.sort((a: WarehouseItem, b: WarehouseItem) => a.name.localeCompare(b.name));
        } else if (currentSort === 'rarity') {
            const rarityOrder: Record<string, number> = { 'Común': 0, 'Raro': 1, 'Épico': 2, 'Legendario': 3 };
            filteredItems.sort((a: WarehouseItem, b: WarehouseItem) => (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0));
        } else if (currentSort === 'type') {
            filteredItems.sort((a: WarehouseItem, b: WarehouseItem) => a.type.localeCompare(b.type));
        } else if (currentSort === 'tier') {
            filteredItems.sort((a: WarehouseItem, b: WarehouseItem) => (b.tier || 0) - (a.tier || 0));
        }
        // Si currentSort es 'custom' o 'default', no ordenar - mantener orden actual

        // Apilar items apilables
        const stackedItems = stackItems(filteredItems);

        // Crear grilla de 20 slots
        const slots = [];
        for (let i = 0; i < capacity; i++) {
            const item = stackedItems[i];
            if (item) {
                slots.push(renderItemSlot(item, item.id === selectedItemId, state, i, moveMode));
            } else {
                slots.push(renderEmptySlot(i, moveMode));
            }
        }

        // Item seleccionado para panel lateral
        const selectedItem = selectedItemId ? warehouse.find((i: WarehouseItem) => i.id === selectedItemId) : null;

        // Guardar valores actuales de los selects
        const currentFilterValue = (container.querySelector('#filter-type') as HTMLSelectElement)?.value || 'all';
        const currentSortValue = (container.querySelector('#sort-by') as HTMLSelectElement)?.value || 'default';

        container.innerHTML = `
            <div class="fixed inset-0 app-bg flex flex-col items-center p-3 md:p-4 font-sans select-none overflow-hidden">
                <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--accent)]/10 via-[var(--bg-app)] to-[var(--bg-app)] pointer-events-none"></div>
                
                <div class="relative z-10 max-w-6xl w-full flex flex-col gap-3 md:gap-4 h-full min-h-0">
                    <!-- Header -->
                    <div class="flex items-center justify-between flex-shrink-0">
                        <button id="back-btn" class="px-4 py-2 card-glass border border-[var(--border-color)] rounded-xl text-xs font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer">
                            ← Volver a la Base
                        </button>
                        <div class="flex items-center gap-4">
                            <div class="text-right">
                                <div class="text-[10px] text-[var(--text-muted)] font-mono uppercase">Nanitas</div>
                                <div id="warehouse-nanites" class="text-lg font-bold accent-text font-['Orbitron']">${formatNumber(state.nanites)}</div>
                            </div>
                            <h2 class="text-base md:text-xl font-['Orbitron'] font-black accent-text tracking-wider text-right">📦 ALMACÉN CENTRAL</h2>
                        </div>
                    </div>

                    <!-- Stats Bar -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
                        <div class="card-glass border rounded-xl p-3 text-center">
                            <div class="text-[10px] text-[var(--text-muted)] font-mono uppercase">Capacidad</div>
                            <div class="text-lg font-bold text-emerald-400 font-['Orbitron']">${warehouse.length} / ${capacity}</div>
                        </div>
                        <div class="card-glass border rounded-xl p-3 text-center">
                            <div class="text-[10px] text-[var(--text-muted)] font-mono uppercase">Recolectores</div>
                            <div class="text-lg font-bold text-red-400 font-['Orbitron']">${warehouse.filter((i: WarehouseItem) => i.type === 'weapon').length}</div>
                        </div>
                        <div class="card-glass border rounded-xl p-3 text-center">
                            <div class="text-[10px] text-[var(--text-muted)] font-mono uppercase">Compañeros</div>
                            <div class="text-lg font-bold text-blue-400 font-['Orbitron']">${warehouse.filter((i: WarehouseItem) => i.type === 'companion').length}</div>
                        </div>
                        <div class="card-glass border rounded-xl p-3 text-center">
                            <div class="text-[10px] text-[var(--text-muted)] font-mono uppercase">Consumibles</div>
                            <div class="text-lg font-bold text-amber-400 font-['Orbitron']">${warehouse.filter((i: WarehouseItem) => i.type === 'consumable').length}</div>
                        </div>
                    </div>

                    <!--Toolbar: Filtro por tipo y ordenamiento -->
                    <div class="flex flex-wrap gap-2 items-center flex-shrink-0">
                        <select id="filter-type" class="px-3 py-1.5 text-xs font-semibold rounded-lg card-glass border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] cursor-pointer">
                            <option value="all">Todos</option>
                            <option value="weapon">Recolectores</option>
                            <option value="companion">Compañeros</option>
                            <option value="consumable">Consumibles</option>
                        </select>
                        <select id="sort-by" class="px-3 py-1.5 text-xs font-semibold rounded-lg card-glass border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] cursor-pointer">
                            <option value="default">Ordenar: Default</option>
                            <option value="custom">Ordenar: Custom</option>
                            <option value="name">Nombre A-Z</option>
                            <option value="rarity">Rareza</option>
                            <option value="type">Tipo</option>
                            <option value="tier">Tier</option>
                        </select>
                    </div>

                    <!-- Main Content: Grid + Side Panel -->
                    <div class="flex flex-col lg:flex-row gap-4 flex-grow overflow-hidden">
                        <!-- Grid de 20 slots -->
                        <div class="flex-grow overflow-y-auto pr-1 custom-scrollbar">
                            <div class="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                ${slots.join('')}
                            </div>
                        </div>

                        <!-- Panel Lateral de Inspección -->
                        <div class="lg:w-80 flex-shrink-0">
                            <div id="inspection-panel" class="card-glass border rounded-2xl p-4 h-full overflow-y-auto custom-scrollbar">
                                ${selectedItem ? renderInspectionPanel(selectedItem, state) : renderEmptyPanel()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Restaurar valores de los selects
        const filterTypeSelect = container.querySelector('#filter-type') as HTMLSelectElement;
        if (filterTypeSelect) filterTypeSelect.value = currentFilterValue;
        const sortBySelect = container.querySelector('#sort-by') as HTMLSelectElement;
        if (sortBySelect) sortBySelect.value = currentSortValue;

        setupEventListeners();
    };

    function renderItemSlot(item: WarehouseItem, isSelected: boolean, state: any, slotIndex: number, moveMode: boolean = false): string {
        const rarityColors: Record<string, string> = {
            'Común': 'border-slate-500/50',
            'Raro': 'border-blue-500/50',
            'Épico': 'border-purple-500/50',
            'Legendario': 'border-amber-500/50'
        };
        const rarityBg: Record<string, string> = {
            'Común': 'bg-slate-800/60',
            'Raro': 'bg-blue-900/40',
            'Épico': 'bg-purple-900/40',
            'Legendario': 'bg-amber-900/40'
        };
        const typeIcons: Record<string, string> = {
            'weapon': '⚙️',
            'companion': '🤖',
            'crate': '📦',
            'key': '🔑',
            'crystal': '💎',
            'consumable': '⚡'
        };

        const isEquipped = (item.type === 'weapon' && item.equipped) || (item.type === 'companion' && state.activeCompanions.includes(item.id));
        const equippedBorder = isEquipped ? 'ring-2 ring-amber-400 border-amber-400' : '';
        const equippedBg = isEquipped ? 'bg-amber-900/30' : '';
        
        return `
            <div class="warehouse-item ${rarityColors[item.rarity] || 'border-slate-500/50'} ${rarityBg[item.rarity] || 'bg-slate-800/60'} ${equippedBg} border-2 rounded-xl p-3 cursor-pointer transition-all hover:border-[var(--accent)] ${isSelected ? 'ring-2 ring-[var(--accent)] border-[var(--accent)]' : ''} ${equippedBorder}" data-item-id="${item.id}" data-slot-index="${slotIndex}" class="${moveMode ? 'ring-2 ring-[var(--accent)] border-[var(--accent)] cursor-move' : ''}">
                <div class="text-2xl text-center mb-1">${typeIcons[item.type] || '📦'}</div>
                <div class="text-[10px] font-mono text-center text-[var(--text-main)] truncate">${item.name}${item.tier ? ` T${item.tier}` : ''}</div>
                <div class="text-[9px] font-mono text-center text-[var(--text-muted)]">${item.rarity}</div>
                ${item.stackable && item.stackCount ? `<div class="text-[9px] font-mono text-center text-emerald-400">${item.stackCount}/${item.type === 'consumable' ? 20 : item.type === 'crate' ? 20 : item.type === 'key' ? 99 : 99}</div>` : ''}
                ${isEquipped ? '<div class="mt-1 text-[9px] font-mono text-center text-slate-900 font-bold bg-amber-400 rounded px-1">(Equipado)</div>' : ''}
            </div>
        `;
    }

    function renderEmptySlot(slotIndex: number, moveMode: boolean = false): string {
        return `
            <div class="border-2 border-dashed border-slate-700/50 rounded-xl p-3 opacity-30 cursor-pointer hover:opacity-60 transition ${moveMode ? 'ring-2 ring-[var(--accent)] border-[var(--accent)] cursor-move' : ''}" data-slot-index="${slotIndex}">
                <div class="text-2xl text-center mb-1">📭</div>
                <div class="text-[10px] font-mono text-center text-[var(--text-muted)]">Vacío</div>
            </div>
        `;
    }

    function renderInspectionPanel(item: WarehouseItem, state: any): string {
        const typeLabels: Record<string, string> = {
            'weapon': 'Recolector',
            'companion': 'Compañero',
            'crate': 'Caja',
            'key': 'Llave',
            'crystal': 'Cristal de Mejora',
            'consumable': 'Consumible'
        };

        const rarityColors: Record<string, string> = {
            'Común': 'text-slate-400',
            'Raro': 'text-blue-400',
            'Épico': 'text-purple-400',
            'Legendario': 'text-amber-400'
        };

        let actionButtons = '';

        if (item.type === 'weapon') {
            actionButtons = `
                <button id="action-equip" class="w-full py-2 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
                    ${item.equipped ? 'Desequipar' : 'Equipar'}
                </button>
            `;
        } else if (item.type === 'companion') {
            const isActive = state.activeCompanions.includes(item.id);
            actionButtons = `
                <button id="action-equip" class="w-full py-2 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
                    ${isActive ? 'Desequipar' : 'Equipar'}
                </button>
            `;
        } else if (item.type === 'crate') {
            actionButtons = `
                <button id="action-use" class="w-full py-2 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
                    Abrir Caja (1 🔑)
                </button>
            `;
        } else if (item.type === 'consumable') {
            const isExpander = item.name.includes('Expansor');
            const isAfkCard = item.name.includes('AFK');
            const isClickCard = item.name.includes('Click');
            let useLabel = 'Usar';
            if (isExpander) useLabel = 'Usar (+1 slot)';
            else if (isAfkCard) useLabel = 'Usar (10 min AFK)';
            else if (isClickCard) useLabel = 'Usar (buff click)';
            actionButtons = `
                <button id="action-use" class="w-full py-2 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
                    ${useLabel}
                </button>
            `;
        } else if (item.type === 'crystal') {
            actionButtons = `
                <div class="text-[10px] font-mono text-[var(--text-muted)] text-center">Usa "Mejorar" en un recolector para aplicar cristales</div>
            `;
        }

        // Botón Mover (siempre visible)
        actionButtons += `
            <button id="action-move" class="w-full py-2 bg-slate-700/50 border border-slate-600/50 text-slate-300 font-['Orbitron'] font-bold text-xs rounded-xl hover:bg-slate-700 transition cursor-pointer">
                📦 Mover
            </button>
        `;

        return `
            <div class="flex flex-col gap-4">
                <div class="text-center">
                    <div class="text-4xl mb-2">${item.type === 'weapon' ? '⚙️' : item.type === 'companion' ? '🤖' : item.type === 'crate' ? '📦' : item.type === 'key' ? '🔑' : item.type === 'crystal' ? '💎' : '⚡'}</div>
                    <h3 class="font-['Orbitron'] font-bold text-sm text-[var(--text-main)]">${item.name}${item.tier ? ` T${item.tier}` : ''}</h3>
                    <div class="text-xs font-mono ${rarityColors[item.rarity] || 'text-slate-400'}">${item.rarity}</div>
                    ${item.tier ? `<div class="text-[10px] font-mono text-[var(--text-muted)]">Tier ${item.tier}</div>` : ''}
                    <div class="text-[10px] font-mono text-[var(--text-muted)]">${typeLabels[item.type] || item.type}</div>
                </div>

                ${item.stackable && item.stackCount ? `
                <div class="border-t border-[var(--border-color)] pt-3">
                    <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-1">Cantidad</div>
                    <div class="text-lg font-bold text-cyan-400 font-['Orbitron']">${item.stackCount}/${item.type === 'consumable' ? 20 : item.type === 'crate' ? 20 : item.type === 'key' ? 99 : 99}</div>
                </div>
                ` : ''}

                <div class="border-t border-[var(--border-color)] pt-3">
                    <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-1">Descripción</div>
                    <div class="text-xs font-mono text-[var(--text-main)]">${item.details || 'Sin descripción'}</div>
                    ${item.type === 'consumable' && (item.name.includes('Click x2') || item.name.includes('Click x3') || item.name.includes('AFK')) ? `
                    <div class="mt-2 text-[10px] font-mono text-[var(--text-muted)]">
                        <span class="buff-timer" data-buff="${item.name.includes('Click x2') ? 'clickX2' : item.name.includes('Click x3') ? 'clickX3' : 'afk'}">Tiempo restante: --</span>
                    </div>
                    ` : ''}
                </div>

                ${item.level ? `
                <div class="border-t border-[var(--border-color)] pt-3">
                    <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-1">Nivel</div>
                    <div class="text-lg font-bold text-emerald-400 font-['Orbitron']">${item.level} / 20</div>
                </div>
                ` : ''}

                <div class="border-t border-[var(--border-color)] pt-3 flex flex-col gap-2">
                    ${actionButtons}
                    <button id="action-sell" class="w-full py-2 bg-amber-600/20 border border-amber-600/40 text-amber-300 font-['Orbitron'] font-bold text-xs rounded-xl hover:bg-amber-600/30 transition cursor-pointer">
                        Vender (${item.sellPrice || 0} ⚡)
                    </button>
                    <button id="action-delete" class="w-full py-2 bg-red-600/20 border border-red-600/40 text-red-300 font-['Orbitron'] font-bold text-xs rounded-xl hover:bg-red-600/30 transition cursor-pointer">
                        Eliminar
                    </button>
                </div>
            </div>
        `;
    }

    function renderEmptyPanel(): string {
        return `
            <div class="flex flex-col items-center justify-center h-full text-center opacity-50">
                <div class="text-4xl mb-3">🔍</div>
                <div class="text-xs font-mono text-[var(--text-muted)]">Selecciona un ítem del almacén para inspeccionarlo</div>
            </div>
        `;
    }

    function stackItems(items: WarehouseItem[]): WarehouseItem[] {
        const stacked: WarehouseItem[] = [];
        const stackMap = new Map<string, WarehouseItem>();
        // Solo estos tipos se apilan (recolectores y compañeros tienen IDs únicos)
        const STACKABLE_TYPES = ['consumable', 'crate', 'key', 'crystal'];
        // Máximo de apilamiento por tipo de item
        const MAX_STACK_BY_TYPE: Record<string, number> = {
            'consumable': 20,  // Tarjetas y consumibles se apilan hasta 20
            'crate': 20,        // Cajas hasta 20
            'key': 99,         // Llaves hasta 99
            'crystal': 99      // Cristales hasta 99
        };

        for (const item of items) {
            // Solo apilar si es un tipo apilable Y tiene stackable=true
            if (item.stackable && STACKABLE_TYPES.includes(item.type)) {
                const maxStack = MAX_STACK_BY_TYPE[item.type] || 20;
                // Apilar por nombre + tipo (items con mismo nombre y tipo se apilan)
                const stackKey = `${item.type}_${item.name}`;
                const existing = stackMap.get(stackKey);
                if (existing) {
                    existing.stackCount = Math.min((existing.stackCount || 1) + (item.stackCount || 1), maxStack);
                } else {
                    const newItem = { ...item, stackCount: Math.min(item.stackCount || 1, maxStack) };
                    stackMap.set(stackKey, newItem);
                    stacked.push(newItem);
                }
            } else {
                // Recolectores y compañeros: no apilar, cada uno es único
                stacked.push(item);
            }
        }

        return stacked;
    }

    function setupEventListeners() {
        const backBtn = container.querySelector('#back-btn');
        backBtn?.addEventListener('click', onBack);

        // Filtros
        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = (e.currentTarget as HTMLElement).getAttribute('data-filter');
                if (filter) {
                    currentFilter = filter;
                    renderTemplate();
                }
            });
        });

        // Filtro por tipo
        const filterTypeSelect = container.querySelector('#filter-type') as HTMLSelectElement;
        filterTypeSelect?.addEventListener('change', () => {
            currentFilter = filterTypeSelect.value;
            renderTemplate();
        });

        // Ordenar
        const sortSelect = container.querySelector('#sort-by') as HTMLSelectElement;
        sortSelect?.addEventListener('change', () => {
            currentSort = sortSelect.value;
            renderTemplate();
        });

        // Botón Mover a otro slot
        const moveBtn = container.querySelector('#action-move');
        moveBtn?.addEventListener('click', () => {
            const currentState = game.getState();
            const selectedItem = currentState.warehouse.find((i: WarehouseItem) => i.id === selectedItemId);
            if (!selectedItem) return;
            showConfirmModal('Elija el nuevo slot o similar', () => {
                moveMode = true;
                renderTemplate();
            });
        });

        // Seleccionar item o mover a slot (incluso vacío)
        container.querySelectorAll('[data-slot-index]').forEach((slot) => {
            slot.addEventListener('click', (e) => {
                const slotIndex = parseInt((e.currentTarget as HTMLElement).getAttribute('data-slot-index') || '0');
                const id = (e.currentTarget as HTMLElement).getAttribute('data-item-id');
                console.log('Click en slot:', slotIndex, 'moveMode:', moveMode, 'selectedItemId:', selectedItemId);

                // Si estamos en modo movimiento, mover el item seleccionado a este slot
                if (moveMode && selectedItemId) {
                    const state = game.getState();
                    const fromIndex = state.warehouse.findIndex((i: WarehouseItem) => i.id === selectedItemId);
                    if (fromIndex !== -1) {
                        // Mover al slot exacto seleccionado (incluso si está vacío)
                        const itemToMove = state.warehouse[fromIndex];
                        state.warehouse.splice(fromIndex, 1);
                        // Insertar en la posición exacta del slot seleccionado
                        // Si el slot está más allá del final, agregar al final
                        // Si el slot está dentro, insertar en esa posición
                        const insertIndex = Math.min(slotIndex, state.warehouse.length);
                        state.warehouse.splice(insertIndex, 0, itemToMove);
                        // Asegurar que el item quede en la posición correcta
                        // Si el slot está más allá del final, el item queda al final
                        // Si el slot está dentro, el item queda en esa posición
                        game.updateState(state);
                        selectedItemId = null;
                        moveMode = false;
                        // No re-ordenar después de mover - el item se queda en su nueva posición
                        currentSort = 'custom';
                        renderTemplate();
                        return;
                    }
                }

                if (id) {
                    selectedItemId = id;
                    renderTemplate();
                }
            });
        });

        // Acciones del panel lateral
        setupActionListeners();
    }

    function setupActionListeners() {
        const state = game.getState();
        const item = selectedItemId ? state.warehouse.find((i: WarehouseItem) => i.id === selectedItemId) : null;
        if (!item) return;

        // Equipar/Desequipar
        const equipBtn = container.querySelector('#action-equip');
        equipBtn?.addEventListener('click', () => {
            if (item.type === 'weapon') {
                const wasEquipped = item.equipped;
                const collectorName = item.name;
                const action = wasEquipped ? 'desequipar' : 'equipar';
                showConfirmModal(`¿${action === 'equipar' ? 'Equipar' : 'Desequipar'} ${collectorName}?`, () => {
                    game.equipCollector(item.id);
                    renderTemplate();
                    // Re-renderizar el juego completo para actualizar el panel principal
                    if (onStateChange) onStateChange();
                });
            } else if (item.type === 'companion') {
                const wasActive = state.activeCompanions.includes(item.id);
                const compName = item.name;
                const action = wasActive ? 'desequipar' : 'equipar';
                showConfirmModal(`¿${action === 'equipar' ? 'Equipar' : 'Desequipar'} ${compName}?`, () => {
                    const success = game.equipCompanion(item.id);
                    if (!success) {
                        showConfirmModal('No hay slots disponibles. Desequipa un compañero primero.', () => {});
                    }
                    renderTemplate();
                    // Re-renderizar el juego completo para actualizar el panel principal
                    if (onStateChange) onStateChange();
                });
            }
        });

        // Mejorar recolector
        const upgradeBtn = container.querySelector('#action-upgrade');
        upgradeBtn?.addEventListener('click', () => {
            if (state.upgradeCrystals < 1) {
                showConfirmModal('No tienes cristales de mejora suficientes.', () => {});
                return;
            }
            if (item.level >= 20) {
                showConfirmModal('El recolector ya está al nivel máximo.', () => {});
                return;
            }
            // Se delega en el game loop: alli viven el coste en cristales y la
            // probabilidad de exito. Aqui solo habia un +1 garantizado.
            showConfirmModal(`\u00bfIntentar mejorar ${item.name} al nivel ${(item.level || 0) + 1}?`, () => {
                sfx.use();
                const result = game.upgradeEquippedWeapon();
                if (result) {
                    showToast(result.msg, result.success ? 'success' : 'error');
                    renderTemplate();
                }
            });
        });

        // Usar item
        const useBtn = container.querySelector('#action-use');
        useBtn?.addEventListener('click', () => {
            if (item.type === 'crate') {
                if (state.keys < 1) {
                    showConfirmModal('No tienes llaves suficientes.', () => {});
                    return;
                }
                // Abrir caja
                const crateType = item.name.toLowerCase().includes('común') ? 'common' :
                                  item.name.toLowerCase().includes('rara') ? 'rare' :
                                  item.name.toLowerCase().includes('épica') ? 'epic' : 'legendary';
                showConfirmModal(`¿Abrir ${item.name}?`, () => {
                    const reward = game.openCrateBox(crateType);
                    if (reward) {
                        // Reducir cantidad o eliminar
                        if (item.stackCount && item.stackCount > 1) {
                            item.stackCount -= 1;
                        } else {
                            state.warehouse = state.warehouse.filter((i: WarehouseItem) => i.id !== item.id);
                        }
                        game.updateState(state);
                        renderTemplate();
                    }
                });
            } else if (item.type === 'consumable') {
                // Usar consumible - gasta solo 1 por uso
                showConfirmModal(`¿Usar ${item.name}?`, () => {
                    const now = Date.now();
                    // Se decide por el identificador del item, no por el nombre:
                    // los nombres han cambiado ("Buff Clicks x2", "Tarjeta Click x2"...)
                    // y comparar strings dejaba buffs sin activar.
                    const buffId = (item as any).buffId;
                    if (buffId) {
                        if (buffId === 'warehouseExpander') {
                            if (state.warehouseCapacity >= 20) {
                                showConfirmModal('Almacén al máximo (20 slots).', () => {});
                                return;
                            }
                            state.warehouseCapacity += 1;
                        } else if (buffId === 'afk') {
                            // 10 min por tarjeta, acumulables hasta 30 min
                            const base = Math.max(now, state.afkExpiresAt || 0);
                            state.afkExpiresAt = Math.min(base + AFK_CARD_DURATION_MS, now + MAX_AFK_BUFF_DURATION_MS);
                        } else if (buffId === 'clickBoost') {
                            const base = Math.max(now, state.buffs.clickBoostExpiresAt);
                            state.buffs.clickBoostExpiresAt = Math.min(base + 30 * 60 * 1000, now + 60 * 60 * 1000);
                        } else if (buffId === 'passiveBoost') {
                            const base = Math.max(now, state.buffs.passiveBoostExpiresAt);
                            state.buffs.passiveBoostExpiresAt = Math.min(base + 60 * 60 * 1000, now + 2 * 60 * 60 * 1000);
                        } else if (buffId === 'clickX2') {
                            const base = Math.max(now, state.buffs.clickX2ExpiresAt);
                            state.buffs.clickX2ExpiresAt = Math.min(base + 30000, now + 30 * 60 * 1000);
                        } else if (buffId === 'clickX3') {
                            const base = Math.max(now, state.buffs.clickX3ExpiresAt);
                            state.buffs.clickX3ExpiresAt = Math.min(base + 30000, now + 30 * 60 * 1000);
                        }
                    } else if (item.name.includes('Expansor')) {
                        // Fallback para items de saves antiguos sin buffId
                        if (state.warehouseCapacity >= 20) {
                            showConfirmModal('Almacén al máximo (20 slots).', () => {});
                            return;
                        }
                        state.warehouseCapacity += 1;
                    } else if (item.name.includes('AFK')) {
                        const base = Math.max(now, state.afkExpiresAt || 0);
                        state.afkExpiresAt = Math.min(base + AFK_CARD_DURATION_MS, now + MAX_AFK_BUFF_DURATION_MS);
                    } else if (item.name.includes('Click x3')) {
                        const base = Math.max(now, state.buffs.clickX3ExpiresAt);
                        state.buffs.clickX3ExpiresAt = Math.min(base + 30000, now + 30 * 60 * 1000);
                    } else if (item.name.includes('Click x2')) {
                        const base = Math.max(now, state.buffs.clickX2ExpiresAt);
                        state.buffs.clickX2ExpiresAt = Math.min(base + 30000, now + 30 * 60 * 1000);
                    } else if (/clics?\s*x2/i.test(item.name)) {
                        state.buffs.clickBoostExpiresAt = now + 30 * 60 * 1000;
                    } else if (/pasivo/i.test(item.name)) {
                        state.buffs.passiveBoostExpiresAt = now + 60 * 60 * 1000;
                    }
                    // Gastar solo 1 del stack
                    if (item.stackCount && item.stackCount > 1) {
                        item.stackCount -= 1;
                    } else {
                        state.warehouse = state.warehouse.filter((i: WarehouseItem) => i.id !== item.id);
                    }
                    game.updateState(state);
                    renderTemplate();
                });
            }
        });

        // Vender
        const sellBtn = container.querySelector('#action-sell');
        sellBtn?.addEventListener('click', () => {
            // Verificar si el objeto está equipado
            const isEquipped = (item.type === 'weapon' && item.equipped) || (item.type === 'companion' && state.activeCompanions.includes(item.id));
            if (isEquipped) {
                showConfirmModal('Debes desequipar el objeto antes de venderlo', () => {});
                return;
            }
            // Verificar si es el último recolector o compañero
            const isLastOfKind = (type: string) => {
                const count = state.warehouse.filter((i: WarehouseItem) => i.type === type).length;
                return count <= 1;
            };
            if ((item.type === 'weapon' && isLastOfKind('weapon')) || (item.type === 'companion' && isLastOfKind('companion'))) {
                showConfirmModal('No puedes vender el último de este tipo. Debes tener al menos uno en el almacén.', () => {});
                return;
            }
            const price = item.sellPrice || 0;

            // Vender de a uno del stack
            showItemCard(item, () => {
                state.nanites += price;
                const itemId = item.id;
                if (item.stackCount && item.stackCount > 1) {
                    const stackItem = state.warehouse.find((i: WarehouseItem) => i.id === itemId);
                    if (stackItem) stackItem.stackCount = (stackItem.stackCount || 1) - 1;
                } else {
                    state.warehouse = state.warehouse.filter((i: WarehouseItem) => i.id !== itemId);
                    if (item.type === 'companion') {
                        state.companions = state.companions.filter((c: any) => c.id !== itemId);
                        state.activeCompanions = state.activeCompanions.filter((id: string) => id !== itemId);
                    }
                }
                game.updateState(state);
                selectedItemId = null;
                renderTemplate();
            });
        });

        // Eliminar
        const deleteBtn = container.querySelector('#action-delete');
        deleteBtn?.addEventListener('click', () => {
            // Verificar si el objeto está equipado
            const isEquipped = (item.type === 'weapon' && item.equipped) || (item.type === 'companion' && state.activeCompanions.includes(item.id));
            if (isEquipped) {
                showConfirmModal('Debes desequipar el objeto antes de eliminarlo', () => {});
                return;
            }
            // Verificar si es el último recolector o compañero
            const isLastOfKind = (type: string) => {
                const count = state.warehouse.filter((i: WarehouseItem) => i.type === type).length;
                return count <= 1;
            };
            if ((item.type === 'weapon' && isLastOfKind('weapon')) || (item.type === 'companion' && isLastOfKind('companion'))) {
                showConfirmModal('No puedes eliminar el último de este tipo. Debes tener al menos uno en el almacén.', () => {});
                return;
            }
            showConfirmModal(`¿Estás seguro de que deseas eliminar ${item.name}?`, () => {
                state.warehouse = state.warehouse.filter((i: WarehouseItem) => i.id !== item.id);
                // Si es un compañero, también eliminar de la lista de compañeros
                if (item.type === 'companion') {
                    state.companions = state.companions.filter((c: any) => c.id !== item.id);
                    state.activeCompanions = state.activeCompanions.filter((id: string) => id !== item.id);
                }
                game.updateState(state);
                selectedItemId = null;
                renderTemplate();
            });
        });
    }

    renderTemplate();

    // Actualizar nanitas cada segundo
    const nanitesInterval = setInterval(() => {
        const nanitesEl = container.querySelector('#warehouse-nanites');
        if (nanitesEl) {
            const currentState = game.getState();
            nanitesEl.textContent = formatNumber(currentState.nanites);
        }
        // Actualizar tooltips de buffs con contador y X para cancelar
        const buffTimers = container.querySelectorAll('.buff-timer');
        buffTimers.forEach((el) => {
            const buffType = el.getAttribute('data-buff');
            const state = game.getState();
            let remaining = 0;
            if (buffType === 'clickX2') remaining = Math.max(0, state.buffs.clickX2ExpiresAt - Date.now());
            else if (buffType === 'clickX3') remaining = Math.max(0, state.buffs.clickX3ExpiresAt - Date.now());
            else if (buffType === 'afk') remaining = state.afkCards * 10 * 60 * 1000;
            if (buffType === 'afk') {
                // No mostrar leyenda de AFK en la descripción
                el.innerHTML = `<span class="text-[var(--text-muted)]">Buff AFK activo</span>`;
            } else if (remaining > 0) {
                el.innerHTML = `<span>⏱️ ${formatTime(remaining)}</span> <button class="buff-cancel ml-1 text-red-400 hover:text-red-300 font-bold" data-buff-type="${buffType}">✕</button>`;
            } else {
                el.innerHTML = `<span class="text-[var(--text-muted)]">Sin buff activo</span>`;
            }
        });

        // Event delegation para cancelar buffs (funciona aunque el botón se recree)
        container.onclick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('buff-cancel')) {
                e.stopPropagation();
                const buffType = target.getAttribute('data-buff-type');
                const state = game.getState();
                if (buffType === 'clickX2') state.buffs.clickX2ExpiresAt = 0;
                else if (buffType === 'clickX3') state.buffs.clickX3ExpiresAt = 0;
                else if (buffType === 'clickBoost') state.buffs.clickBoostExpiresAt = 0;
                else if (buffType === 'passiveBoost') state.buffs.passiveBoostExpiresAt = 0;
                game.updateState(state);
                renderTemplate();
            }
        };
    }, 1000);

    // Limpiar intervalo cuando se sale del almacén
    const originalOnBack = onBack;
    onBack = () => {
        clearInterval(nanitesInterval);
        originalOnBack();
    };
}
