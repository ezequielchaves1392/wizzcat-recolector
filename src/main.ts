import './style.css';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { renderAuth } from './components/auth';
import { createGameLoop, COLLECTOR_BASE_COSTS, STORE_ITEMS } from './gameLoop';
import { renderWarehouseTab } from './components/warehouse';
import { renderRankings } from './components/rankings';

import { applyTheme, getSavedTheme, setTheme, type ThemeName } from './theme';

const app = document.querySelector('#app') as HTMLElement;
let activeGameInstance: any = null;

// Aplicar tema guardado (o por defecto cyber-dark)
applyTheme(getSavedTheme());

document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (activeGameInstance?.cleanup) await activeGameInstance.cleanup();
    renderAuth(app, (loggedInUser) => {
      initGame(loggedInUser);
    });
  } else {
    initGame(user);
  }
});

async function initGame(user: any) {
  activeGameInstance = await createGameLoop(user, (state, isAfk) => {
    updateUI(state, isAfk);
  });

  renderGameLayout(user, activeGameInstance);
}

function renderGameLayout(user: any, game: any) {
  app.innerHTML = `
    <div class="w-screen h-dvh app-bg flex flex-col font-sans select-none overflow-hidden p-4 md:p-6 relative">
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--accent)]/10 via-[var(--bg-app)] to-[var(--bg-app)] pointer-events-none"></div>

      <!-- Banner Anti-AFK -->
      <div id="afk-banner" class="hidden relative z-20 mb-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 px-4 py-2 rounded-xl text-xs font-mono text-center animate-pulse flex-shrink-0">
        ⚠️ MODO AFK: Producción pasiva de drones pausada. Interactúa o adquiere un Buff Pasivo.
      </div>

      <!-- Header Principal -->
      <header class="relative z-10 card-glass border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl mb-4 flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full accent-bg animate-pulse"></div>
          <div>
            <div class="text-[10px] text-[var(--text-muted)] font-mono tracking-widest">CYBER BASE</div>
            <div id="nav-username" class="font-['Orbitron'] font-bold text-sm accent-text truncate max-w-[200px]">${user.displayName || 'Operativo'}</div>
          </div>
        </div>

        <!-- HUD de Buffs y Compañeros -->
        <div id="active-buffs-hud" class="flex items-center gap-2 flex-wrap justify-center"></div>

        <div class="flex items-center gap-2 flex-wrap justify-center">
          <select id="theme-selector" class="app-bg border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] cursor-pointer">
            <option value="cyber-dark">🌙 Cyber Dark</option>
            <option value="synthwave">🌸 Synthwave</option>
            <option value="matrix">🟢 Matrix Green</option>
            <option value="nature">🌿 Naturaleza (Eco)</option>
            <option value="neon-purple">🔮 Neón Púrpura</option>
            <option value="sunset">🌅 Sunset Cyber</option>
          </select>

          <button id="warehouse-tab-btn" class="px-3 py-2 card-glass border border-[var(--border-color)] rounded-xl text-xs font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer flex items-center gap-1">
            📦 Almacén
          </button>

          <button id="rankings-btn" class="px-3.5 py-2 card-glass border border-[var(--border-color)] rounded-xl text-xs font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer">
            🏆 Rankings
          </button>
          
          <button id="logout-btn" class="px-3.5 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-400 hover:bg-red-500/25 transition cursor-pointer">
            Salir
          </button>
        </div>
      </header>

      <!-- Main Fullscreen Layout sin Scroll Global -->
      <main class="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-6xl mx-auto w-full items-center flex-grow overflow-hidden pb-4">
        
        <!-- Panel Izquierdo: Recolector Principal (Click = Recolección) -->
        <div class="lg:col-span-5 flex flex-col items-center justify-center gap-5 card-glass border rounded-3xl p-6 shadow-2xl text-center">
          <div>
            <div id="nanites-counter" class="text-3xl md:text-4xl font-['Orbitron'] font-black accent-text tracking-wider">0</div>
            <div class="text-xs text-[var(--text-muted)] font-mono tracking-widest mt-1">NANITAS</div>
            <div id="passive-income-display" class="text-xs font-mono text-[var(--text-muted)] mt-1">+0 Nanitas / segundo</div>
          </div>

          <button id="click-btn" class="relative w-44 h-44 md:w-52 md:h-52 rounded-full app-bg border-4 border-[var(--accent)] flex flex-col items-center justify-center gap-2 shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:scale-105 active:scale-95 transition-all cursor-pointer group">
            <div class="absolute inset-0 rounded-full accent-bg opacity-10 group-hover:opacity-20 transition"></div>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 accent-text animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span class="font-['Orbitron'] font-black text-xs tracking-widest accent-text">RECOLECTAR</span>
          </button>
          <div id="click-damage-display" class="text-xs font-mono text-emerald-400 text-center">+0 Nanitas por click</div>
        </div>

        <!-- Panel Derecho: Panel del Jugador (Recolector + 3 Slots Compañeros) -->
        <div class="lg:col-span-7 card-glass border rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col gap-4 overflow-hidden h-full max-h-[60vh] lg:max-h-[72vh]">
          <div class="flex items-center justify-between border-b border-[var(--border-color)] pb-3 flex-shrink-0">
            <h2 class="font-['Orbitron'] font-bold text-base accent-text tracking-wide">PANEL PRINCIPAL</h2>
          </div>

          <div class="flex flex-col gap-4 overflow-y-auto pr-1 flex-grow">
            <!-- Recolector Equipado -->
            <div class="app-bg border-2 rounded-2xl p-4" style="border-color: var(--accent); background: linear-gradient(to bottom right, color-mix(in srgb, var(--accent) 15%, transparent), transparent);">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">⚙️</span>
                <span class="text-[10px] font-mono uppercase tracking-wider font-bold" style="color: var(--accent)">Recolector Equipado</span>
              </div>
              <div id="equipped-collector-container">
                <!-- Se llena dinámicamente -->
              </div>
            </div>

            <!-- Slots de Compañeros -->
            <div class="app-bg border-2 rounded-2xl p-4" style="border-color: var(--accent); background: linear-gradient(to bottom right, color-mix(in srgb, var(--accent) 10%, transparent), transparent);">
              <div class="flex items-center gap-2 mb-3">
                <span class="text-lg">🤖</span>
                <span class="text-[10px] font-mono uppercase tracking-wider font-bold" style="color: var(--accent)">Compañeros Equipados</span>
              </div>
              <div id="companions-slots-container" class="grid grid-cols-3 gap-3">
                <!-- Se llena dinámicamente -->
              </div>
            </div>
          </div>
        </div>

      </main>

      <footer class="relative z-10 text-center text-[10px] text-[var(--text-muted)] font-mono flex-shrink-0 pt-1">
        Cyber-Forge Space Engine v4.0 • Sistema En Línea
      </footer>
    </div>
  `;

  document.querySelector('#click-btn')?.addEventListener('click', () => {
    const beforeClick = game.getState().nanites;
    game.click();
    const afterClick = game.getState().nanites;
    const collected = afterClick - beforeClick;
    const clickDamageEl = document.querySelector('#click-damage-display');
    if (clickDamageEl) {
      clickDamageEl.textContent = `+${formatNumber(collected)} Nanitas por click`;
    }
  });

  document.querySelector('#warehouse-tab-btn')?.addEventListener('click', () => {
    renderWarehouseTab(app, game, () => {
      renderGameLayout(user, game);
    }, () => {
      // Callback cuando cambia el estado (equipar/desequipar)
      // Solo actualizar el panel principal sin cerrar el almacén
      updateUI(game.getState(), game.isAfk());
    });
  });

  document.querySelector('#rankings-btn')?.addEventListener('click', () => {
    renderRankings(app, user, () => renderGameLayout(user, game));
  });

  document.querySelector('#logout-btn')?.addEventListener('click', async () => {
    if (activeGameInstance?.cleanup) await activeGameInstance.cleanup();
    await signOut(auth);
  });

  const themeSelector = document.querySelector('#theme-selector') as HTMLSelectElement;
  const savedTheme = getSavedTheme();
  if (themeSelector) {
    themeSelector.value = savedTheme;
    document.body.setAttribute('data-theme', savedTheme);
  }
  themeSelector?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value as ThemeName;
    setTheme(val);
  });

  // Renderizar con el estado inicial del juego
  const initialState = game.getState();
  updateUI(initialState, game.isAfk());
  renderPlayerPanel(initialState);
}

// Exponer updateUI globalmente para que el almacén pueda actualizar la UI
(window as any).updateGameUI = (state?: any) => {
  const gameState = state || (typeof activeGameInstance !== 'undefined' && activeGameInstance?.getState());
  if (gameState) {
    updateUI(gameState, activeGameInstance?.isAfk() || false);
  }
};

function updateUI(state: any, isAfk: boolean = false) {
  const nanitesCounter = document.querySelector('#nanites-counter');
  const passiveIncomeDisplay = document.querySelector('#passive-income-display');
  const clickDamageDisplay = document.querySelector('#click-damage-display');
  const afkBanner = document.querySelector('#afk-banner');
  const activeBuffsHud = document.querySelector('#active-buffs-hud');

  if (nanitesCounter) nanitesCounter.textContent = formatNumber(state.nanites);

  const now = Date.now();
  const clickBuffRemaining = Math.max(0, state.buffs.clickBoostExpiresAt - now);
  const passiveBuffRemaining = Math.max(0, state.buffs.passiveBoostExpiresAt - now);
  const hasPassiveBuff = passiveBuffRemaining > 0;

  if (passiveIncomeDisplay) {
    const displayValue = (isAfk && !hasPassiveBuff) ? 0 : state.passiveIncome;
    passiveIncomeDisplay.textContent = `+${formatNumber(displayValue)} Nanitas / segundo`;
  }

  if (clickDamageDisplay) {
    const equippedCollector = Object.entries(state.collectors).find(([_, c]: [string, any]) => c.equipped);
    let clickDamage = 0;
    if (equippedCollector) {
      const [collectorKey, collector]: [string, any] = equippedCollector;
      const baseDmg = collectorKey === 'blaster' ? 1 : collectorKey === 'plasmaCannon' ? 5 : 25;
      const levelMultiplier = 1 + ((collector.level || 0) * 0.10);
      clickDamage = Math.floor(baseDmg * levelMultiplier);
    }
    const multiplier = now < state.buffs.clickBoostExpiresAt ? 2 : 1;
    clickDamageDisplay.textContent = `+${formatNumber(clickDamage * multiplier)} Nanitas por click`;
  }

  if (afkBanner) {
    if (isAfk && !hasPassiveBuff) {
      afkBanner.classList.remove('hidden');
    } else {
      afkBanner.classList.add('hidden');
    }
  }

  if (activeBuffsHud) {
    let hudHtml = '';
    if (clickBuffRemaining > 0) {
      hudHtml += `<div class="card-glass border border-emerald-500/50 rounded-xl px-2.5 py-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">⚡ Clics x2: ${formatTime(clickBuffRemaining)}</div>`;
    }
    if (passiveBuffRemaining > 0) {
      hudHtml += `<div class="card-glass border border-blue-500/50 rounded-xl px-2.5 py-1 text-[11px] font-mono text-blue-600 dark:text-blue-400">🛡️ Pasivo x2 (AFK): ${formatTime(passiveBuffRemaining)}</div>`;
    }
    activeBuffsHud.innerHTML = hudHtml;
  }

  // Renderizar Panel del Jugador solo si no estamos en el almacén
  // (evita titileo por re-render constante)
  const warehouseOverlay = document.querySelector('#back-btn');
  if (!warehouseOverlay) {
    renderPlayerPanel(state);
  }
}

function formatNumber(num: number): string {
  const floored = Math.floor(num);
  if (floored >= 1e9) return (floored / 1e9).toFixed(2) + ' B';
  if (floored >= 1e6) return (floored / 1e6).toFixed(2) + ' M';
  if (floored >= 1e3) return (floored / 1e3).toFixed(2) + ' K';
  return floored.toString();
}

// Sistema de notificaciones personalizado (toasts)
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    error: 'bg-red-500/20 border-red-500/40 text-red-300',
    info: 'bg-blue-500/20 border-blue-500/40 text-blue-300'
  };
  toast.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-xs font-mono shadow-2xl transform transition-all duration-300 translate-x-full ${colors[type]}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Animar entrada
  setTimeout(() => toast.classList.remove('translate-x-full'), 10);
  
  // Auto-eliminar después de 3 segundos
  setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function renderPlayerPanel(state: any) {
  const collectorLabels: Record<string, string> = {
    blaster: 'Recolector Básico',
    plasmaCannon: 'Recolector de Plasma',
    quantumDisruptor: 'Recolector Cuántico'
  };

  // Recolector equipado
  const equippedCollector = Object.entries(state.collectors).find(([_, c]: [string, any]) => c.equipped);
  const collectorContainer = document.querySelector('#equipped-collector-container');
  if (collectorContainer) {
    if (equippedCollector) {
      const [collectorKey, collector]: [string, any] = equippedCollector;
      const baseDmg = collectorKey === 'blaster' ? 1 : collectorKey === 'plasmaCannon' ? 5 : 25;
      const levelMultiplier = 1 + ((collector.level || 0) * 0.10);
      const totalDmg = Math.floor(baseDmg * levelMultiplier);
      const rarity = collectorKey === 'blaster' ? 'Común' : collectorKey === 'plasmaCannon' ? 'Raro' : 'Épico';
      const rarityColors: Record<string, string> = {
        'Común': 'text-slate-400',
        'Raro': 'text-blue-400',
        'Épico': 'text-purple-400',
        'Legendario': 'text-amber-400'
      };
      collectorContainer.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <div class="font-['Orbitron'] font-bold text-sm text-[var(--text-main)]">${collectorLabels[collectorKey] || collectorKey}</div>
            <div class="text-xs font-mono ${rarityColors[rarity] || 'text-slate-400'}">${rarity}</div>
            <div class="text-xs font-mono text-[var(--text-muted)]">Nivel: ${collector.level || 0} / 20</div>
            <div class="text-xs font-mono" style="color: var(--accent)">Recolección: +${totalDmg}</div>
          </div>
          <div class="text-3xl">⚙️</div>
        </div>
      `;
    } else {
      collectorContainer.innerHTML = `
        <div class="text-center py-4">
          <div class="text-3xl mb-2 opacity-50">⚙️</div>
          <div class="text-xs font-mono text-[var(--text-muted)]">Sin recolector equipado</div>
        </div>
      `;
    }
  }

  // Slots de compañeros
  const companionsContainer = document.querySelector('#companions-slots-container');
  if (companionsContainer) {
    const activeCompanions = state.activeCompanions
      .map((id: string) => state.companions.find((c: any) => c.id === id))
      .filter(Boolean);

    let slotsHtml = '';
    for (let i = 0; i < 3; i++) {
      const comp = activeCompanions[i];
      if (comp) {
        const compDescription = `+${comp.power}/s`;
        slotsHtml += `
          <div class="rounded-xl p-3 text-center border" style="background: var(--bg-app); border-color: var(--accent); border-opacity: 0.3;">
            <div class="text-2xl mb-1">${comp.type === 'click' ? '⚔️' : comp.type === 'passive' ? '🛡️' : '✨'}</div>
            <div class="text-[10px] font-mono text-[var(--text-main)] truncate">${comp.name} <span class="text-[var(--accent)]">(equipado)</span></div>
            <div class="text-[9px] font-mono" style="color: var(--accent)">${compDescription}</div>
          </div>
        `;
      } else {
        slotsHtml += `
          <div class="rounded-xl p-3 text-center opacity-50 border border-dashed" style="background: var(--bg-app); border-color: var(--border-color);">
            <div class="text-2xl mb-1">➕</div>
            <div class="text-[10px] font-mono text-[var(--text-muted)]">Slot Vacío</div>
          </div>
        `;
      }
    }
    companionsContainer.innerHTML = slotsHtml;
  }
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
