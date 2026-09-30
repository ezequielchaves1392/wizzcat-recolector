import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { setTheme, getSavedTheme } from '../theme';
import { formatNumber } from '../utils';

export function renderGameHUD(
  container: HTMLElement,
  gameState: any,
  currentUser: any,
  onAction: (action: string, payload?: any) => void
) {
  const playerName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Operativo';
  const currentTheme = getSavedTheme();

  // Obtener arma equipada
  const equippedItem = gameState.equippedWeaponId
    ? gameState.warehouse.find((w: any) => w.id === gameState.equippedWeaponId)
    : null;

  // Obtener compañeros activos
  const activeCompanions = gameState.activeCompanions
    .map((id: string) => gameState.companions.find((c: any) => c.id === id))
    .filter(Boolean);

  container.innerHTML = `
    <div class="min-h-screen app-bg flex flex-col justify-between p-6 font-sans select-none relative overflow-hidden">
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--accent)]/10 via-[var(--bg-app)] to-[var(--bg-app)] pointer-events-none"></div>

      <!-- Top Bar -->
      <div class="relative z-10 flex flex-wrap justify-between items-center gap-4 card-glass border border-[var(--border-color)] rounded-2xl p-4 shadow-xl">
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full accent-bg accent-glow animate-pulse"></div>
          <div>
            <div class="text-xs font-mono text-[var(--text-muted)]">OPERATIVO ACTIVO</div>
            <div class="font-bold font-mono text-sm text-[var(--text-main)]">${playerName}</div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="relative">
            <select id="theme-select" aria-label="Seleccionar tema visual" class="app-bg border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] cursor-pointer">
              <option value="cyber-dark" ${currentTheme === 'cyber-dark' ? 'selected' : ''}>🌙 Cyber Dark</option>
              <option value="synthwave" ${currentTheme === 'synthwave' ? 'selected' : ''}>🌸 Synthwave</option>
              <option value="matrix" ${currentTheme === 'matrix' ? 'selected' : ''}>🟢 Matrix Green</option>
              <option value="nature" ${currentTheme === 'nature' ? 'selected' : ''}>🌿 Naturaleza (Eco)</option>
              <option value="neon-purple" ${currentTheme === 'neon-purple' ? 'selected' : ''}>🔮 Neón Púrpura</option>
              <option value="sunset" ${currentTheme === 'sunset' ? 'selected' : ''}>🌅 Sunset Cyber</option>
            </select>
          </div>

          <button id="warehouse-btn" class="px-4 py-2 card-glass border border-[var(--border-color)] rounded-xl text-xs font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer">
            📦 Almacén
          </button>

          <button id="rankings-btn" class="px-4 py-2 card-glass border border-[var(--border-color)] rounded-xl text-xs font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer">
            🏆 Rankings
          </button>

          <button id="logout-btn" class="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-400 hover:bg-red-500/20 transition cursor-pointer">
            Cerrar Sesión
          </button>
        </div>
      </div>

      <!-- Main Center Clicker & Player Panel -->
      <div class="relative z-10 flex flex-col lg:flex-row items-center justify-center gap-8 my-auto py-8">
        <!-- Panel Central de Extracción -->
        <div class="flex flex-col items-center gap-6 w-full max-w-md">
          <div class="text-center w-full">
            <div class="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1">Nanitas Extraídas</div>
            <div class="w-full flex justify-center items-center">
              <div id="nanites-display" class="text-4xl md:text-5xl font-['Orbitron'] font-black accent-text tracking-wider whitespace-nowrap">${formatNumber(gameState.nanites)}</div>
            </div>
            <div class="text-xs font-mono text-[var(--text-muted)] mt-1">+${formatNumber(gameState.passiveIncome)} / seg</div>
          </div>

          <button id="click-btn" class="w-48 h-48 rounded-full card-glass border-2 border-[var(--accent)] accent-glow flex flex-col items-center justify-center gap-2 transform active:scale-95 transition cursor-pointer group">
            <span class="text-5xl group-hover:scale-110 transition">⚡</span>
            <span class="font-['Orbitron'] font-black text-xs accent-text tracking-widest">EXTRAER</span>
          </button>
        </div>

        <!-- Panel del Jugador -->
        <div class="card-glass border border-[var(--border-color)] rounded-2xl p-6 w-full max-w-md flex flex-col gap-4 shadow-2xl">
          <h3 class="font-['Orbitron'] font-bold text-sm accent-text tracking-wider border-b border-[var(--border-color)] pb-3">PANEL DEL JUGADOR</h3>
          
          <!-- Arma Equipada -->
          <div class="app-bg border border-[var(--border-color)] rounded-xl p-4">
            <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-2">Arma Equipada</div>
            <div class="flex items-center justify-between">
              <div>
                <div class="font-bold text-sm text-[var(--text-main)] font-mono">${equippedItem ? equippedItem.name : 'Sin arma equipada'}</div>
                <div class="text-xs text-[var(--text-muted)] font-mono">${equippedItem ? `Nivel: ${equippedItem.level || 0} / 20` : '—'}</div>
              </div>
              <div class="text-2xl">${equippedItem ? '⚔️' : '—'}</div>
            </div>
          </div>

          <!-- Slots de Compañeros -->
          <div class="app-bg border border-[var(--border-color)] rounded-xl p-4">
            <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide mb-2">Compañeros Equipados (${activeCompanions.length}/${gameState.maxCompanionSlots})</div>
            <div class="grid grid-cols-3 gap-2">
              ${[0, 1, 2].map(slot => {
                const comp = activeCompanions[slot];
                if (comp) {
                  return `
                    <div class="bg-slate-800/60 border border-[var(--border-color)] rounded-lg p-2 text-center">
                      <div class="text-lg mb-1">${comp.type === 'click' ? '⚔️' : comp.type === 'passive' ? '🛡️' : '✨'}</div>
                      <div class="text-[10px] font-mono text-[var(--text-main)] truncate">${comp.name}</div>
                      <div class="text-[9px] font-mono text-[var(--text-muted)]">${comp.type === 'click' ? '+' + comp.power + ' Clic' : comp.type === 'passive' ? '+' + comp.power + '/s' : '+' + (comp.power * 100) + '% Mult'}</div>
                    </div>
                  `;
                }
                return `
                  <div class="bg-slate-800/30 border border-dashed border-[var(--border-color)] rounded-lg p-2 text-center opacity-50">
                    <div class="text-lg mb-1">➕</div>
                    <div class="text-[10px] font-mono text-[var(--text-muted)]">Vacío</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Footer info -->
      <div class="relative z-10 text-center text-xs font-mono text-[var(--text-muted)]">
        Cyber-Forge Modular Engine v2.0 • Sistema En Línea
      </div>
    </div>
  `;

  // Event Listeners
  const clickBtn = container.querySelector('#click-btn');
  clickBtn?.addEventListener('click', (e: any) => {
    const rect = clickBtn.getBoundingClientRect();
    const x = e.clientX || rect.left + rect.width / 2;
    const y = e.clientY || rect.top + rect.height / 2;
    onAction('click', { x, y });
  });

  container.querySelector('#warehouse-btn')?.addEventListener('click', () => {
    onAction('switch_tab', 'warehouse');
  });

  container.querySelector('#rankings-btn')?.addEventListener('click', () => {
    onAction('switch_tab', 'rankings');
  });

  container.querySelector('#logout-btn')?.addEventListener('click', async () => {
    await signOut(auth);
  });

  const themeSelect = container.querySelector('#theme-select') as HTMLSelectElement;
  themeSelect?.addEventListener('change', () => {
    const newTheme = themeSelect.value;
    setTheme(newTheme as any);
    onAction('switch_theme');
  });
}
