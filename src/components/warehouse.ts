import { WarehouseItem } from '../types';

// Sistema de modal de confirmación
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

    const renderTemplate = () => {
        const state = game.getState();
        const warehouse = state.warehouse || [];
        const capacity = state.warehouseCapacity || 20;

        // Aplicar filtro
        let filteredItems = warehouse.filter((item: WarehouseItem) => {
            if (currentFilter === 'all') return true;
            return item.type === currentFilter;
        });

        // Aplicar orden
        if (currentSort === 'name') {
            filteredItems.sort((a: WarehouseItem, b: WarehouseItem) => a.name.localeCompare(b.name));
        } else if (currentSort === 'rarity') {
            const rarityOrder: Record<string, number> = { 'Común': 0, 'Raro': 1, 'Épico': 2, 'Legendario': 3 };
            filteredItems.sort((a: WarehouseItem, b: WarehouseItem) => (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0));
        } else if (currentSort === 'type') {
            filteredItems.sort((a: WarehouseItem, b: WarehouseItem) => a.type.localeCompare(b.type));
        }

        // Apilar items apilables
        const stackedItems = stackItems(filteredItems);

        // Crear grilla de 20 slots
        const slots = [];
        for (let i = 0; i < capacity; i++) {
            const item = stackedItems[i];
            if (item) {
                slots.push(renderItemSlot(item, item.id === selectedItemId, state));
            } else {
                slots.push(renderEmptySlot());
            }
        }

        // Item seleccionado para panel lateral
        const selectedItem = selectedItemId ? warehouse.find((i: WarehouseItem) => i.id === selectedItemId) : null;

        container.innerHTML = `
            <div class="w-screen h-dvh app-bg flex flex-col items-center p-4 md:p-6 font-sans select-none overflow-hidden">
                <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--accent)]/10 via-[var(--bg-app)] to-[var(--bg-app)] pointer-events-none"></div>
                
                <div class="relative z-10 max-w-6xl w-full flex flex-col gap-4 my-auto max-h-full">
                    <!-- Header -->
                    <div class="flex items-center justify-between flex-shrink-0">
                        <button id="back-btn" class="px-4 py-2 card-glass border border-[var(--border-color)] rounded-xl text-xs font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer">
                            ← Volver al Comando
                        </button>
                        <div class="flex items-center gap-4">
                            <div class="text-right">
                                <div class="text-[10px] text-[var(--text-muted)] font-mono uppercase">Nanitas</div>
                                <div id="warehouse-nanites" class="text-lg font-bold accent-text font-['Orbitron']">${Math.floor(state.nanites).toString()}</div>
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

                    <!-- Toolbar -->
                    <div class="flex flex-wrap gap-2 justify-between items-center flex-shrink-0">
                        <div class="flex flex-wrap gap-2">
                            <button data-filter="all" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${currentFilter === 'all' ? 'accent-bg text-slate-950' : 'card-glass border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)]'}">Todos</button>
                            <button data-filter="weapon" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${currentFilter === 'weapon' ? 'accent-bg text-slate-950' : 'card-glass border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)]'}">Recolectores</button>
                            <button data-filter="companion" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${currentFilter === 'companion' ? 'accent-bg text-slate-950' : 'card-glass border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)]'}>Compañeros</button>
                            <button data-filter="crate" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${currentFilter === 'crate' ? 'accent-bg text-slate-950' : 'card-glass border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)]'}>Cajas</button>
                            <button data-filter="key" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${currentFilter === 'key' ? 'accent-bg text-slate-950' : 'card-glass border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)]'}>Llaves</button>
                            <button data-filter="crystal" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${currentFilter === 'crystal' ? 'accent-bg text-slate-950' : 'card-glass border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)]'}>Cristales</button>
                            <button data-filter="consumable" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${currentFilter === 'consumable' ? 'accent-bg text-slate-950' : 'card-glass border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)]'}>Consumibles</button>
                        </div>
                        <div class="flex gap-2">
                            <button id="stack-btn" class="px-3 py-1.5 text-xs font-semibold rounded-lg card-glass border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)] transition-all cursor-pointer">
                                📚 Apilar
                            </button>
                            <select id="sort-select" class="px-3 py-1.5 text-xs font-semibold rounded-lg card-glass border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] cursor-pointer">
                                <option value="default">Ordenar: Default</option>
                                <option value="name">Nombre A-Z</option>
                                <option value="rarity">Rareza</option>
                                <option value="type">Tipo</option>
                            </select>
                        </div>
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

        setupEventListeners();
    };

    function renderItemSlot(item: WarehouseItem, isSelected: boolean, state: any): string {
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
            <div class="warehouse-item ${rarityColors[item.rarity] || 'border-slate-500/50'} ${rarityBg[item.rarity] || 'bg-slate-800/60'} ${equippedBg} border-2 rounded-xl p-3 cursor-pointer transition-all hover:border-[var(--accent)] ${isSelected ? 'ring-2 ring-[var(--accent)] border-[var(--accent)]' : ''} ${equippedBorder}" data-item-id="${item.id}">
                <div class="text-2xl text-center mb-1">${typeIcons[item.type] || '📦'}</div>
                <div class="text-[10px] font-mono text-center text-[var(--text-main)] truncate">${item.name}</div>
                <div class="text-[9px] font-mono text-center text-[var(--text-muted)]">${item.rarity}</div>
                ${item.stackable && item.stackCount ? `<div class="text-[9px] font-mono text-center text-emerald-400">x${item.stackCount}</div>` : ''}
                ${isEquipped ? '<div class="mt-1 text-[9px] font-mono text-center text-slate-900 font-bold bg-amber-400 rounded px-1">(Equipado)</div>' : ''}
            </div>
        `;
    }

    function renderEmptySlot(): string {
        return `
            <div class="border-2 border-dashed border-slate-700/50 rounded-xl p-3 opacity-30">
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
                <button id="action-upgrade" class="w-full py-2 bg-cyan-600 text-white font-['Orbitron'] font-bold text-xs rounded-xl hover:bg-cyan-500 transition cursor-pointer">
                    Mejorar (1 💎)
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
            actionButtons = `
                <button id="action-use" class="w-full py-2 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
                    Usar
                </button>
            `;
        } else if (item.type === 'crystal') {
            actionButtons = `
                <div class="text-[10px] font-mono text-[var(--text-muted)] text-center">Usa "Mejorar" en un recolector para aplicar cristales</div>
            `;
        }

        return `
            <div class="flex flex-col gap-4">
                <div class="text-center">
                    <div class="text-4xl mb-2">${item.type === 'weapon' ? '⚙️' : item.type === 'companion' ? '🤖' : item.type === 'crate' ? '📦' : item.type === 'key' ? '🔑' : item.type === 'crystal' ? '💎' : '⚡'}</div>
                    <h3 class="font-['Orbitron'] font-bold text-sm text-[var(--text-main)]">${item.name}</h3>
                    <div class="text-xs font-mono ${rarityColors[item.rarity] || 'text-slate-400'}">${item.rarity}</div>
                    <div class="text-[10px] font-mono text-[var(--text-muted)]">${typeLabels[item.type] || item.type}</div>
                </div>

                <div class="border-t border-[var(--border-color)] pt-3">
                    <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-1">Descripción</div>
                    <div class="text-xs font-mono text-[var(--text-main)]">${item.details || 'Sin descripción'}</div>
                </div>

                ${item.level ? `
                <div class="border-t border-[var(--border-color)] pt-3">
                    <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-1">Nivel</div>
                    <div class="text-lg font-bold text-emerald-400 font-['Orbitron']">${item.level} / 20</div>
                </div>
                ` : ''}

                ${item.stackable && item.stackCount ? `
                <div class="border-t border-[var(--border-color)] pt-3">
                    <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-1">Cantidad</div>
                    <div class="text-lg font-bold text-cyan-400 font-['Orbitron']">x${item.stackCount}</div>
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

        for (const item of items) {
            if (item.stackable) {
                const existing = stackMap.get(item.id);
                if (existing) {
                    existing.stackCount = (existing.stackCount || 1) + (item.stackCount || 1);
                } else {
                    const newItem = { ...item, stackCount: item.stackCount || 1 };
                    stackMap.set(item.id, newItem);
                    stacked.push(newItem);
                }
            } else {
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

        // Ordenar
        const sortSelect = container.querySelector('#sort-select') as HTMLSelectElement;
        sortSelect?.addEventListener('change', () => {
            currentSort = sortSelect.value;
            renderTemplate();
        });

        // Apilar
        const stackBtn = container.querySelector('#stack-btn');
        stackBtn?.addEventListener('click', () => {
            const state = game.getState();
            const newWarehouse = stackItems(state.warehouse);
            state.warehouse = newWarehouse;
            game.updateState(state);
            renderTemplate();
        });

        // Seleccionar item
        container.querySelectorAll('.warehouse-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const id = (e.currentTarget as HTMLElement).getAttribute('data-item-id');
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
            showConfirmModal(`¿Mejorar ${item.name} al nivel ${(item.level || 0) + 1}?`, () => {
                state.upgradeCrystals -= 1;
                item.level = (item.level || 0) + 1;
                game.updateState(state);
                renderTemplate();
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
                // Usar consumible
                showConfirmModal(`¿Usar ${item.name}?`, () => {
                    const now = Date.now();
                    if (item.name.includes('Clics')) {
                        state.buffs.clickBoostExpiresAt = now + 30 * 60 * 1000;
                    } else if (item.name.includes('Pasivo')) {
                        state.buffs.passiveBoostExpiresAt = now + 60 * 60 * 1000;
                    }
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
            showConfirmModal(`¿Vender ${item.name} por ${price} nanitas?`, () => {
                state.nanites += price;
                if (item.stackCount && item.stackCount > 1) {
                    item.stackCount -= 1;
                } else {
                    state.warehouse = state.warehouse.filter((i: WarehouseItem) => i.id !== item.id);
                }
                game.updateState(state);
                showConfirmModal(`¡Vendido! +${price} nanitas`, () => {});
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
            nanitesEl.textContent = Math.floor(currentState.nanites).toString();
        }
    }, 1000);

    // Limpiar intervalo cuando se sale del almacén
    const originalOnBack = onBack;
    onBack = () => {
        clearInterval(nanitesInterval);
        originalOnBack();
    };
}
