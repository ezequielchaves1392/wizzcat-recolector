import { STORE_ITEMS, TIER_SYSTEM } from '../gameLoop';

function showConfirmModal(message: string, onConfirm: () => void) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div class="card-glass border rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4">
      <p class="text-sm font-mono text-[var(--text-main)] text-center">${message}</p>
      <div class="flex gap-3">
        <button id="confirm-cancel" class="flex-1 py-2.5 bg-slate-700/50 border border-slate-600/50 text-slate-300 font-['Orbitron'] font-bold text-xs rounded-xl hover:bg-slate-700 transition cursor-pointer">Cancelar</button>
        <button id="confirm-ok" class="flex-1 py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">Aceptar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#confirm-cancel')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#confirm-ok')?.addEventListener('click', () => { overlay.remove(); onConfirm(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

export function renderStoreTab(container: HTMLElement, game: any, onBack: () => void) {
  const state = game.getState();

  const storeCategories = [
    { id: 'cards', label: '🎴 Tarjetas', items: ['afkCard', 'clickX2Card', 'clickX3Card'] },
    { id: 'upgrades', label: '⬆️ Mejoras', items: ['backpackExpander', 'companionSlot1', 'companionSlot2'] },
    { id: 'companionCards', label: '🤖 Compañeros', items: Array.from({ length: 10 }, (_, i) => `companionCardT${i + 1}`) },
    { id: 'weaponCards', label: '⚔️ Armas', items: Array.from({ length: 10 }, (_, i) => `weaponCardT${i + 1}`) }
  ];

  let activeCategory = 'cards';

  function renderTemplate() {
    const state = game.getState();
    const category = storeCategories.find(c => c.id === activeCategory)!;

    const itemsHtml = category.items.map((itemKey, index) => {
      const item = STORE_ITEMS[itemKey as keyof typeof STORE_ITEMS];
      if (!item) return '';

      const canAfford = state.nanites >= item.cost;
      const isDisabled = isItemDisabled(itemKey, state);
      const disabledReason = getDisabledReason(itemKey, state);

      let extraInfo = '';
      if (itemKey === 'backpackExpander') {
        extraInfo = `<div class="text-[9px] text-[var(--text-muted)]">Actual: ${state.warehouseCapacity}/20 slots</div>`;
      } else if (itemKey === 'afkCard') {
        extraInfo = `<div class="text-[9px] text-[var(--text-muted)]">Acumuladas: ${state.afkCards}/3</div>`;
      } else if (itemKey.startsWith('companionCardT') || itemKey.startsWith('weaponCardT')) {
        const tier = parseInt(itemKey.replace(/^(companion|weapon)CardT/, ''));
        const range = TIER_SYSTEM.ranges[tier as keyof typeof TIER_SYSTEM.ranges];
        const rarity = TIER_SYSTEM.rarityByTier[tier as keyof typeof TIER_SYSTEM.rarityByTier];
        extraInfo = `<div class="text-[9px] text-[var(--text-muted)]">Tier ${tier} • ${range[0]}-${range[1]} clics/s • ${rarity}</div>`;
      }

      // Añadir división visual después de las tarjetas AFK (antes de las Click)
      const showDivider = index > 0 && category.items[index - 1] === 'afkCard' && itemKey === 'clickX2Card';

      return `
        ${showDivider ? '<div class="col-span-full border-t border-[var(--border-color)] my-1"></div>' : ''}
        <div class="card-glass border rounded-xl p-3 flex flex-col gap-2 ${isDisabled ? 'opacity-50' : ''}">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold text-[var(--text-main)] truncate">${item.label}</div>
              ${extraInfo}
            </div>
            <div class="text-right flex-shrink-0">
              <div class="text-xs font-bold accent-text">${formatNumber(item.cost)} ⚡</div>
            </div>
          </div>
          <button
            data-item-key="${itemKey}"
            class="w-full py-2 rounded-lg text-xs font-bold transition cursor-pointer ${isDisabled ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed' : canAfford ? 'accent-bg text-slate-950 hover:opacity-90' : 'bg-slate-700/50 text-slate-400 cursor-not-allowed'}"
            ${isDisabled ? 'disabled' : ''}
          >
            ${isDisabled ? disabledReason : canAfford ? 'Comprar' : 'Sin nanitas'}
          </button>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="fixed inset-0 app-bg flex flex-col items-center p-3 md:p-4 font-sans select-none overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--accent)]/10 via-[var(--bg-app)] to-[var(--bg-app)] pointer-events-none"></div>

        <div class="relative z-10 max-w-4xl w-full flex flex-col gap-3 md:gap-4 h-full min-h-0">
          <!-- Header -->
          <div class="flex items-center justify-between flex-shrink-0">
            <button id="back-btn" class="px-4 py-2 card-glass border border-[var(--border-color)] rounded-xl text-xs font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer">
              ← Volver al Comando
            </button>
            <div class="flex items-center gap-4">
              <div class="text-right">
                <div class="text-[10px] text-[var(--text-muted)] font-mono uppercase">Nanitas</div>
                <div id="store-nanites" class="text-lg font-bold accent-text font-['Orbitron']">${formatNumber(state.nanites)}</div>
              </div>
              <h2 class="text-base md:text-xl font-['Orbitron'] font-black accent-text tracking-wider text-right">🛒 TIENDA</h2>
            </div>
          </div>

          <!-- Categorías -->
          <div class="flex flex-wrap gap-2 flex-shrink-0">
            ${storeCategories.map(cat => `
              <button data-cat="${cat.id}" class="cat-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeCategory === cat.id ? 'accent-bg text-slate-950' : 'card-glass border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)]'}">
                ${cat.label}
              </button>
            `).join('')}
          </div>

          <!-- Items Grid -->
          <div class="flex-grow overflow-y-auto pr-1 min-h-0">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              ${itemsHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    setupEventListeners();
  }

  function isItemDisabled(itemKey: string, state: any): boolean {
    if (itemKey === 'backpackExpander') return state.warehouseCapacity >= 20;
    if (itemKey === 'afkCard') return state.afkCards >= 3;
    if (itemKey === 'companionSlot1') return state.maxCompanionSlots >= 2;
    if (itemKey === 'companionSlot2') return state.maxCompanionSlots >= 3;
    return false;
  }

  function getDisabledReason(itemKey: string, state: any): string {
    if (itemKey === 'backpackExpander' && state.warehouseCapacity >= 20) return 'Máximo alcanzado';
    if (itemKey === 'afkCard' && state.afkCards >= 3) return 'Máximo acumulado';
    if (itemKey === 'companionSlot1' && state.maxCompanionSlots >= 2) return 'Ya comprado';
    if (itemKey === 'companionSlot2' && state.maxCompanionSlots >= 3) return 'Ya comprado';
    return 'No disponible';
  }

  function setupEventListeners() {
    container.querySelector('#back-btn')?.addEventListener('click', onBack);

    container.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cat = (e.currentTarget as HTMLElement).getAttribute('data-cat');
        if (cat) {
          activeCategory = cat;
          renderTemplate();
        }
      });
    });

    container.querySelectorAll('button[data-item-key]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemKey = (e.currentTarget as HTMLElement).getAttribute('data-item-key') as keyof typeof STORE_ITEMS;
        if (!itemKey) return;

        // Verificar si tiene suficientes nanitas antes de mostrar el modal
        const item = STORE_ITEMS[itemKey];
        const state = game.getState();
        if (state.nanites < item.cost) return; // No hacer nada si no hay suficientes nanitas

        // Preguntar primero, comprar solo si confirma
        showConfirmModal(`¿Comprar ${item.label} por ${formatNumber(item.cost)} nanitas?`, () => {
          const purchasedItem = game.buyStoreItem(itemKey);
          if (purchasedItem) {
            showItemCard(purchasedItem);
            renderTemplate();
          }
        });
      });
    });
  }

  function showItemCard(item: any) {
    const rarityColors: Record<string, string> = {
      'Común': 'text-slate-400',
      'Raro': 'text-blue-400',
      'Épico': 'text-purple-400',
      'Legendario': 'text-amber-400',
      'Mítico': 'text-red-400',
      'Divino': 'text-yellow-300'
    };

    const rarityColor = rarityColors[item.rarity] || 'text-slate-400';
    const icon = item.type === 'weapon' ? '⚔️' : item.type === 'companion' ? '🤖' : '📦';

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm';
    overlay.innerHTML = `
      <div class="card-glass border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4 shadow-2xl">
        <div class="text-center">
          <div class="text-4xl mb-2">${icon}</div>
          <h3 class="font-['Orbitron'] font-bold text-lg text-[var(--text-main)]">${item.name}</h3>
          <div class="text-sm font-mono ${rarityColor}">${item.rarity}</div>
          ${item.tier ? `<div class="text-xs font-mono text-[var(--text-muted)]">Tier ${item.tier}</div>` : ''}
        </div>
        <div class="border-t border-[var(--border-color)] pt-3">
          <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-1">Descripción</div>
          <div class="text-sm font-mono text-[var(--text-main)]">${item.details || 'Sin descripción'}</div>
        </div>
        ${item.damage ? `
        <div class="border-t border-[var(--border-color)] pt-3">
          <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-1">Daño</div>
          <div class="text-lg font-bold text-emerald-400 font-['Orbitron']">+${item.damage}</div>
        </div>
        ` : ''}
        ${item.level !== undefined ? `
        <div class="border-t border-[var(--border-color)] pt-3">
          <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-1">Nivel</div>
          <div class="text-lg font-bold text-cyan-400 font-['Orbitron']">${item.level} / 20</div>
        </div>
        ` : ''}
        <button id="item-card-close" class="w-full py-2 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
          Aceptar
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#item-card-close')?.addEventListener('click', () => {
      overlay.remove();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  function formatNumber(num: number): string {
    const floored = Math.floor(num);
    if (floored >= 1e9) return (floored / 1e9).toFixed(2) + ' B';
    if (floored >= 1e6) return (floored / 1e6).toFixed(2) + ' M';
    if (floored >= 1e3) return (floored / 1e3).toFixed(2) + ' K';
    return floored.toString();
  }

  renderTemplate();

  // Actualizar nanitas cada segundo (como en el almacén)
  const nanitesInterval = setInterval(() => {
    const nanitesEl = container.querySelector('#store-nanites');
    if (nanitesEl) {
      const currentState = game.getState();
      nanitesEl.textContent = formatNumber(currentState.nanites);
    }
  }, 1000);

  // Limpiar intervalo cuando se sale de la tienda
  const originalOnBack = onBack;
  onBack = () => {
    clearInterval(nanitesInterval);
    originalOnBack();
  };
}
