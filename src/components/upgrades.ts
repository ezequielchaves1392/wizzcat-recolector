import { COMPANION_SLOT_COSTS } from '../gameLoop';

export function renderUpgradesTab(container: HTMLElement, game: any, onBack: () => void) {
  const renderTemplate = () => {
    const state = game.getState();
    const equippedItem = state.equippedCollectorId
      ? state.warehouse.find((w: any) => w.id === state.equippedCollectorId)
      : null;
    container.innerHTML = `
      <div class="w-screen h-dvh app-bg flex flex-col items-center p-4 md:p-6 font-sans select-none overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--accent)]/10 via-[var(--bg-app)] to-[var(--bg-app)] pointer-events-none"></div>
        
        <div class="relative z-10 max-w-3xl w-full flex flex-col gap-5 my-auto max-h-full">
          <div class="flex items-center justify-between flex-shrink-0">
            <button id="back-btn" class="px-4 py-2 card-glass border border-[var(--border-color)] rounded-xl text-xs font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer">
              ← Volver al Comando
            </button>
            <h2 class="text-base md:text-xl font-['Orbitron'] font-black accent-text tracking-wider text-right">SINTONIZADOR Y MEJORA DE RECOLECTORES</h2>
          </div>

          <!-- Cabecera de Cristales y Recursos -->
          <div class="card-glass border rounded-2xl p-4 flex items-center justify-between gap-4 flex-shrink-0 shadow-lg">
            <div class="flex items-center gap-3">
              <span class="text-2xl">💎</span>
              <div>
                <div class="text-[10px] text-[var(--text-muted)] font-mono">CRISTALES DE MEJORA DISPONIBLES</div>
                <div class="font-['Orbitron'] font-bold text-base accent-text">${state.upgradeCrystals}</div>
              </div>
            </div>
            <button id="buy-crystal-btn" class="px-4 py-2 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer accent-glow">
              Comprar Cristal (60 ⚡)
            </button>
          </div>

          <!-- Contenedor con Scroll Interno Estricto -->
          <div class="flex flex-col gap-3 overflow-y-auto pr-1 max-h-[52vh] flex-grow">
            <!-- Recolector Equipada -->
            <div class="card-glass border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-lg">⚔️</span>
                  <div class="font-['Orbitron'] font-bold text-sm text-[var(--text-main)]">${equippedItem ? equippedItem.name : 'Sin recolector equipado'}</div>
                  ${equippedItem ? `<span class="text-[10px] font-mono accent-bg text-slate-950 px-2 py-0.5 rounded-full font-bold">Nivel: ${equippedItem.level || 0} / 20</span>` : ''}
                </div>
                <div class="text-xs text-[var(--text-muted)] font-mono mt-1">${equippedItem ? `${equippedItem.rarity} — Tier ${equippedItem.tier || 1}` : 'Equipá un recolector desde el almacén para mejorarla.'}</div>
              </div>
              <div class="flex items-center gap-2 w-full md:w-auto">
                <button id="upgrade-collector-btn" class="gacha-btn flex-1 md:flex-initial px-4 py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer accent-glow">
                  Sintonizar (1 💎)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#back-btn')?.addEventListener('click', onBack);

    container.querySelector('#buy-crystal-btn')?.addEventListener('click', () => {
      const success = game.buyStoreItem('upgradeCrystal');
      if (success) {
        renderTemplate();
      } else {
        alert('Nanitas insuficientes para comprar un Cristal de Mejora (Requiere 60).');
      }
    });

    container.querySelector('#upgrade-collector-btn')?.addEventListener('click', () => {
      const result = game.upgradeEquippedCollector();
      alert(result.msg);
      renderTemplate();
    });
  };

  renderTemplate();
}