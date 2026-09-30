// ==========================================================================
// Mercado · Tienda
//
// Reestructurado por tres razones:
//
// 1. PRECIO REAL. La tarjeta mostraba `item.cost` y el game loop cobraba lo
//    mismo. Al añadir la reducción de coste del árbol de pasivas, si la tarjeta
//    siguiera mostrando el precio base el jugador pagaría más de lo que ve.
//    Ahora ambos salen del mismo número, calculado en un único sitio.
//
// 2. CATEGORÍAS CON ICONOS. Las etiquetas eran "📦 Cajas", "⚡ Recursos"... Los
//    emojis se veían distintos según el sistema operativo, así que se
//    sustituyeron por iconos SVG del mismo set que el resto del juego.
//
// 3. ESTADO DEL ALMACÉN. Un item que no cabe se deshabilita, pero la razón no
//    se veía: el botón ponía "Comprar" en gris y no explicaba por qué. Ahora
//    el texto del botón es la razón ("Almacén lleno"), que es lo único que
//    puede hacer un botón deshabilitado.
// ==========================================================================

import { formatNumber } from '../utils/format';
import { ic } from '../ui/icons';
import { pageShell, mountInto, statStrip } from '../ui/pageShell';
import { STORE_ITEMS, TIER_SYSTEM, TIER_POWER } from '../gameLoop';
import { sfx } from '../utils/audio';
import { showToast } from '../utils/toast';
import { rarityClass, raritySlug } from './crateLoot';

interface Category {
  id: string;
  label: string;
  icon: string;
  items: string[];
}

const CATEGORIES: Category[] = [
  { id: 'cajas', label: 'Cajas', icon: 'crate', items: ['commonCrate', 'rareCrate', 'epicCrate', 'legendaryCrate'] },
  { id: 'recursos', label: 'Recursos', icon: 'crystal', items: ['key', 'upgradeCrystal', 'warehouseSlot', 'backpackExpander'] },
  { id: 'cartas', label: 'Cartas', icon: 'card', items: ['afkCard', 'clickBuff', 'passiveBuff', 'clickX2Card', 'clickX3Card'] },
  { id: 'forja', label: 'Forja', icon: 'flask', items: ['calibrationStone', 'stabilityNano'] },
  { id: 'mejoras', label: 'Mejoras', icon: 'layers', items: ['companionSlot1', 'companionSlot2'] },
  { id: 'companeros', label: 'Compañeros', icon: 'companion', items: Array.from({ length: 10 }, (_, i) => `companionCardT${i + 1}`) },
  { id: 'armas', label: 'Armas', icon: 'weapon', items: Array.from({ length: 10 }, (_, i) => `weaponCardT${i + 1}`) }
];

/** Rango de poder de un tier, para la línea de detalle de las tarjetas. */
function tierRange(tier: number): [number, number] {
  return (TIER_SYSTEM.ranges as Record<number, [number, number]>)[tier] ?? [1, 5];
}

function tierRarity(tier: number): string {
  return (TIER_SYSTEM.rarityByTier as Record<number, string>)[tier] ?? 'Común';
}

let activeCategory = 'cajas';

export function renderStoreTab(container: HTMLElement, game: any, onBack: () => void) {
  const state = game.getState();
  const discount = state.bonus?.costReduction || 0;
  const effectiveCost = (base: number) => Math.floor(base * (1 - discount));

  const category = CATEGORIES.find(c => c.id === activeCategory) ?? CATEGORIES[0];

  // --- Tarjetas ---------------------------------------------------------
  const card = (itemKey: string) => {
    const item = (STORE_ITEMS as Record<string, any>)[itemKey];
    if (!item) return '';

    const cost = effectiveCost(item.cost);
    const canAfford = state.nanites >= cost;
    const disabled = isDisabled(itemKey, state, game);
    const reason = disabledReason(itemKey, state, game);
    const rarity = itemRarity(itemKey);

    // Nota contextual: por qué este item existe
    let note = '';
    if (itemKey === 'backpackExpander') {
      const cap = game.getCapacity?.() ?? state.warehouseCapacity;
      note = `Capacidad real: ${state.warehouse.length}/${cap}`;
    } else if (itemKey === 'warehouseSlot') {
      note = `Añade 5 ranuras · base ${state.warehouseCapacity}`;
    } else if (itemKey === 'afkCard') {
      const mins = Math.round((game.getAfkDurationMs?.() ?? 600_000) / 60_000);
      note = `${mins} min cada una · acumulable ×3`;
    } else if (itemKey === 'key') {
      note = `Llaves: ${state.keys}`;
    } else if (itemKey === 'upgradeCrystal') {
      note = `Cristales: ${state.upgradeCrystals}`;
    } else if (itemKey === 'companionSlot1' || itemKey === 'companionSlot2') {
      note = `Slots activos: ${game.getCompanionSlots?.() ?? state.maxCompanionSlots}`;
    } else if (itemKey === 'calibrationStone') {
      note = '+12 puntos de éxito por piedra, hasta 5';
    } else if (itemKey === 'stabilityNano') {
      note = 'Afijo garantizado en la próxima arma';
    } else if (itemKey.startsWith('companionCardT') || itemKey.startsWith('weaponCardT')) {
      const t = parseInt(itemKey.replace(/^(companion|weapon)CardT/, ''));
      const range = tierRange(t);
      const unit = itemKey.startsWith('companionCardT') ? '/s' : '';
      const r = tierRarity(t);
      note = `T${t} · +${range[0]}–${range[1]}${unit} · <span class="${rarityClass(r)}">${r}</span>`;
    }

    const isCheap = discount > 0 && Math.floor(item.cost) > cost;

    return `
      <div class="card-glass border rounded-xl p-3 flex flex-col gap-2 ${disabled ? 'opacity-55' : ''}">
        <div class="flex items-start gap-2.5">
          <span class="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0
                       ${rarity ? 'ring-' + raritySlug(rarity) : ''}
                       [&>span>svg]:w-4 [&>span>svg]:h-4"
                style="${rarity ? rarityClass(rarity) : ''}">
            ${ic(catIconFor(itemKey))}
          </span>
          <div class="flex-1 min-w-0">
            <div class="text-[12px] font-bold text-[var(--text-main)] leading-tight">${item.label}</div>
            ${note ? `<div class="text-[9px] font-mono text-[var(--text-muted)] mt-0.5 leading-snug">${note}</div>` : ''}
          </div>
        </div>

        <div class="flex items-end justify-between gap-2 mt-auto">
          <div>
            <div class="font-['Orbitron'] font-bold text-[14px] accent-text tabular leading-none">
              ${formatNumber(cost)}
            </div>
            ${isCheap ? `
              <div class="text-[9px] font-mono text-emerald-400 line-through leading-none mt-0.5">
                ${formatNumber(item.cost)}
              </div>
            ` : `<div class="text-[9px] font-mono text-[var(--text-muted)] mt-0.5">nanitas</div>`}
          </div>
          <button data-buy="${itemKey}" ${disabled ? 'disabled' : ''}
            class="px-3 h-9 rounded-lg text-[10px] font-['Orbitron'] font-bold cursor-pointer transition
                   ${disabled ? 'btn-ghost text-[var(--text-muted)] cursor-not-allowed'
                              : canAfford ? 'btn-primary'
                              : 'btn-ghost text-[var(--text-muted)] cursor-not-allowed'}">
            ${reason ?? (canAfford ? 'Comprar' : 'Sin nanitas')}
          </button>
        </div>
      </div>
    `;
  };

  const body = `
    ${statStrip([
      { label: 'Nanitas', value: formatNumber(state.nanites) },
      { label: 'Almacén', value: `${state.warehouse.length}/${game.getCapacity?.() ?? state.warehouseCapacity}` },
      { label: 'Descuento', value: discount > 0 ? `−${Math.round(discount * 100)}%` : '—', tone: discount > 0 ? 'text-emerald-400' : undefined },
      { label: 'Llaves', value: String(state.keys) }
    ])}

    <div class="flex gap-1 mb-3 overflow-x-auto pb-1">
      ${CATEGORIES.map(c => `
        <button class="px-3 h-10 rounded-lg text-[10px] font-mono cursor-pointer flex-shrink-0
                       transition flex items-center gap-1.5
                       ${activeCategory === c.id ? 'accent-bg text-slate-950' : 'btn-ghost text-[var(--text-muted)]'}"
                data-cat="${c.id}">
          <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(c.icon as any)}</span>
          ${c.label}
        </button>
      `).join('')}
    </div>

    ${category.id === 'forja' && !((state.nodeLevels?.blueprint) > 0) ? `
      <div class="rounded-xl border p-3 mb-2.5 text-[10px] leading-relaxed"
           style="border-color: color-mix(in srgb, #f59e0b 40%, transparent);
                  background: color-mix(in srgb, #f59e0b 8%, transparent)">
        Puedes comprar estas piedras antes de desbloquear la forja, pero no
        sirven de nada hasta que tengas el nodo <span class="text-amber-400">Planos Viejos</span>.
      </div>
    ` : ''}

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      ${category.items.map(card).join('')}
    </div>
  `;

  const root = mountInto(container, pageShell({
    title: 'Mercado',
    subtitle: discount > 0 ? `Descuento del árbol aplicado: −${Math.round(discount * 100)}%` : 'Todo con nanitas',
    icon: 'store',
    onBack
  }, body));

  // --- Eventos ---
  root.querySelector('[data-nav-back]')?.addEventListener('click', onBack);

  root.querySelectorAll<HTMLElement>('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.nav();
      activeCategory = btn.dataset.cat!;
      renderStoreTab(container, game, onBack);
    });
  });

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-buy]') as HTMLElement | null;
    if (!btn || btn.hasAttribute('disabled')) return;
    const key = btn.dataset.buy!;
    const bought = game.buyStoreItem(key as any);
    if (bought === false) {
      sfx.error();
      showToast('No se pudo completar la compra.', 'error');
      return;
    }
    sfx.buy();
    showToast('Comprado', 'success');
    renderStoreTab(container, game, onBack);
  });
}

// --- Reglas de disponibilidad --------------------------------------------

const NO_SPACE = ['key', 'upgradeCrystal', 'warehouseSlot', 'backpackExpander', 'companionSlot1', 'companionSlot2'];

function isDisabled(itemKey: string, state: any, game: any): boolean {
  const effSlots = game.getCompanionSlots?.() ?? state.maxCompanionSlots;
  if (itemKey === 'companionSlot1' && effSlots >= 2) return true;
  if (itemKey === 'companionSlot2' && effSlots >= 5) return true;
  if (itemKey === 'backpackExpander' && state.warehouseCapacity >= 50) return true;
  if (!NO_SPACE.includes(itemKey)) {
    if (state.warehouse.length >= (game.getCapacity?.() ?? state.warehouseCapacity)) return true;
  }
  return false;
}

function disabledReason(itemKey: string, state: any, game: any): string | null {
  const effSlots = game.getCompanionSlots?.() ?? state.maxCompanionSlots;
  if (itemKey === 'companionSlot1' && effSlots >= 2) return 'Comprado';
  if (itemKey === 'companionSlot2' && effSlots >= 5) return 'Comprado';
  if (itemKey === 'backpackExpander' && state.warehouseCapacity >= 50) return 'Al máximo';
  if (!NO_SPACE.includes(itemKey)) {
    if (state.warehouse.length >= (game.getCapacity?.() ?? state.warehouseCapacity)) return 'Almacén lleno';
  }
  return null;
}

function itemRarity(itemKey: string): string | null {
  if (itemKey.endsWith('Crate')) {
    return { commonCrate: 'Común', rareCrate: 'Raro', epicCrate: 'Épico', legendaryCrate: 'Legendario' }[itemKey as never] ?? null;
  }
  if (itemKey.startsWith('companionCardT')) return tierRarity(parseInt(itemKey.slice(14)));
  if (itemKey.startsWith('weaponCardT')) return tierRarity(parseInt(itemKey.slice(11)));
  const map: Record<string, string> = {
    key: 'Común', upgradeCrystal: 'Raro', warehouseSlot: 'Raro', backpackExpander: 'Raro',
    afkCard: 'Raro', clickBuff: 'Raro', passiveBuff: 'Épico', clickX2Card: 'Raro', clickX3Card: 'Épico',
    calibrationStone: 'Raro', stabilityNano: 'Legendario',
    companionSlot1: 'Épico', companionSlot2: 'Legendario'
  };
  return map[itemKey] ?? null;
}

function catIconFor(itemKey: string): any {
  if (itemKey.endsWith('Crate')) return 'crate';
  if (itemKey.startsWith('weaponCardT')) return 'weapon';
  if (itemKey.startsWith('companionCardT')) return 'companion';
  const map: Record<string, any> = {
    key: 'key', upgradeCrystal: 'crystal', warehouseSlot: 'warehouse', backpackExpander: 'warehouse',
    afkCard: 'clock', clickBuff: 'bolt', passiveBuff: 'graph', clickX2Card: 'bolt', clickX3Card: 'bolt',
    calibrationStone: 'flask', stabilityNano: 'flask',
    companionSlot1: 'layers', companionSlot2: 'layers'
  };
  return map[itemKey] ?? 'store';
}
