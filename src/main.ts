import './style.css';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { renderAuth } from './components/auth';
import { createGameLoop, COLLECTOR_BASE_COSTS, STORE_ITEMS, type BuffKey } from './gameLoop';
import { showToast } from './utils/toast';
import { renderWarehouseTab } from './components/warehouse';
import { renderRankings } from './components/rankings';
import { renderStoreTab } from './components/store';

import { applyTheme, getSavedTheme, setTheme, type ThemeName } from './theme';
import { showConfirmModal } from './utils/modal';
import { sfx, isMuted, toggleMute } from './utils/audio';

const app = document.querySelector('#app') as HTMLElement;
let activeGameInstance: any = null;

// Definición de los buffs con duración. Las clases van escritas enteras para que
// el generador de Tailwind las detecte.
const BUFF_DEFS: Array<{
  key: BuffKey;
  icon: string;
  label: string;
  tag?: string;
  durationMs: number;
  accent: string;
  bar: string;
  getExpires: (state: any) => number;
}> = [
  {
    key: 'clickBoost', icon: '⚡', label: 'Clics x2', durationMs: 30 * 60 * 1000,
    accent: 'border-emerald-500/50 text-emerald-500 dark:text-emerald-400',
    bar: 'bg-emerald-400',
    getExpires: (s) => s.buffs.clickBoostExpiresAt
  },
  {
    key: 'clickX2', icon: '⚡', label: 'Clics x2', tag: 'tarjeta', durationMs: 30 * 1000,
    accent: 'border-cyan-500/50 text-cyan-500 dark:text-cyan-400',
    bar: 'bg-cyan-400',
    getExpires: (s) => s.buffs.clickX2ExpiresAt
  },
  {
    key: 'clickX3', icon: '⚡', label: 'Clics x3', tag: 'tarjeta', durationMs: 30 * 1000,
    accent: 'border-purple-500/50 text-purple-500 dark:text-purple-400',
    bar: 'bg-purple-400',
    getExpires: (s) => s.buffs.clickX3ExpiresAt
  },
  {
    key: 'passiveBoost', icon: '🛡️', label: 'Pasivo x2', durationMs: 60 * 60 * 1000,
    accent: 'border-blue-500/50 text-blue-500 dark:text-blue-400',
    bar: 'bg-blue-400',
    getExpires: (s) => s.buffs.passiveBoostExpiresAt
  },
  {
    key: 'afk', icon: '🎴', label: 'AFK', durationMs: 30 * 60 * 1000,
    accent: 'border-amber-500/50 text-amber-500 dark:text-amber-400',
    bar: 'bg-amber-400',
    getExpires: (s) => s.afkExpiresAt
  }
];

const buffHudBuilt = { done: false };

// Crea las tarjetas una sola vez y luego solo parchea el contador. Si se
// reescribiera el innerHTML en cada tick, el clic en la X se perdería porque el
// nodo cambia entre mousedown y mouseup.
function buildBuffCard(def: typeof BUFF_DEFS[number]) {
  return `
    <div data-buff="${def.key}" class="hidden card-glass border ${def.accent} rounded-xl pl-2 pr-1 py-1 flex items-center gap-1.5 flex-shrink-0">
      <span class="text-[11px] leading-none">${def.icon}</span>
      <span class="flex flex-col gap-1">
        <span class="flex items-baseline gap-1.5 leading-none whitespace-nowrap">
          <span class="text-[11px] font-mono font-bold">${def.label}</span>
          ${def.tag ? `<span class="text-[8px] font-mono uppercase tracking-wider opacity-60">${def.tag}</span>` : ''}
          <span data-role="time" class="text-[10px] font-mono tabular-nums opacity-80">0:00</span>
        </span>
        <span class="h-[3px] w-full rounded-full bg-black/40 overflow-hidden block">
          <span data-role="bar" class="block h-full rounded-full ${def.bar} transition-[width] duration-500 ease-linear" style="width:100%"></span>
        </span>
      </span>
      <button data-cancel="${def.key}" title="Cancelar buff" aria-label="Cancelar ${def.label}" class="w-4 h-4 flex items-center justify-center rounded-md text-[11px] leading-none opacity-50 hover:opacity-100 hover:bg-white/10 transition cursor-pointer">✕</button>
    </div>
  `;
}

function renderBuffHud(state: any, now: number) {
  const hud = document.querySelector('#active-buffs-hud');
  const hudMobile = document.querySelector('#buffs-hud-mobile');
  if (!hud) return;

  if (!buffHudBuilt.done) {
    const cards = BUFF_DEFS.map(buildBuffCard).join('') + `
      <div data-buff="global" class="hidden card-glass border border-sky-500/50 rounded-xl px-2.5 py-1 text-[11px] font-mono text-sky-500 dark:text-sky-400 flex-shrink-0 whitespace-nowrap">
        ✖ Global x<span data-role="value">1</span>
      </div>
    `;
    hud.innerHTML = cards;
    if (hudMobile) hudMobile.innerHTML = cards;
    buffHudBuilt.done = true;
  }

  for (const def of BUFF_DEFS) {
    const remaining = Math.max(0, def.getExpires(state) - now);
    const timeText = formatCountdown(remaining);
    const width = `${Math.max(0, Math.min(100, (remaining / def.durationMs) * 100))}%`;

    // Se parchea el mismo valor en las dos copias (desktop y menú móvil)
    for (const root of [hud, hudMobile]) {
      if (!root) continue;
      const card = root.querySelector(`[data-buff="${def.key}"]`);
      if (!card) continue;
      card.classList.toggle('hidden', remaining <= 0);
      if (remaining <= 0) continue;
      const timeEl = card.querySelector('[data-role="time"]');
      if (timeEl) timeEl.textContent = timeText;
      const barEl = card.querySelector('[data-role="bar"]') as HTMLElement | null;
      if (barEl) barEl.style.width = width;
    }
  }

  // El multiplicador global no es un consumible: se muestra, no se cancela
  const mult = Number(state.passiveMultiplier) || 1;
  for (const root of [hud, hudMobile]) {
    if (!root) continue;
    const globalCard = root.querySelector('[data-buff="global"]');
    if (!globalCard) continue;
    globalCard.classList.toggle('hidden', mult <= 1);
    const valueEl = globalCard.querySelector('[data-role="value"]');
    if (valueEl) valueEl.textContent = mult.toFixed(2).replace(/\.?0+$/, '');
  }
}

// Aviso de logro desbloqueado. Aparece abajo al centro para no tapar el HUD
// de buffs ni el contador de nanitas.
function showAchievementPopup(achievement: { title: string; description: string; icon: string; rewardText: string }) {
  sfx.reward(true);
  const el = document.createElement('div');
  el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] card-glass border border-[var(--accent)] rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl';
  el.style.cssText = 'animation: achievementIn 400ms cubic-bezier(0.16, 1, 0.3, 1);';
  el.innerHTML = `
    <span class="text-3xl leading-none">${achievement.icon}</span>
    <span class="flex flex-col gap-0.5">
      <span class="text-[9px] font-mono uppercase tracking-widest" style="color: var(--text-muted)">Logro desbloqueado</span>
      <span class="font-['Orbitron'] font-bold text-sm" style="color: var(--accent)">${achievement.title}</span>
      <span class="text-[10px] font-mono" style="color: var(--text-main)">${achievement.rewardText}</span>
    </span>
  `;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 400ms, transform 400ms';
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, 20px)';
    setTimeout(() => el.remove(), 420);
  }, 3200);
}

// mm:ss, o h:mm:ss a partir de una hora
function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

// Aplicar tema guardado (o por defecto cyber-dark)
applyTheme(getSavedTheme());

document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (activeGameInstance?.cleanup) await activeGameInstance.cleanup();
    renderAuth(app, (loggedInUser, username) => {
      initGame(loggedInUser, username);
    });
  } else {
    // Leer username guardado del registro (si existe)
    const pendingUsername = sessionStorage.getItem('pending_username');
    if (pendingUsername) {
      sessionStorage.removeItem('pending_username');
      initGame(user, pendingUsername);
    } else {
      initGame(user);
    }
  }
});

async function initGame(user: any, username?: string) {
  activeGameInstance = await createGameLoop(user, (state, isAfk) => {
    updateUI(state, isAfk);
  }, username, (achievement) => {
    showAchievementPopup(achievement);
  });

  // Handle de depuración solo en dev: permite inspeccionar y probar el estado
  // desde la consola. Se elimina del build de producción.
  if (import.meta.env.DEV) {
    (window as any).__cyberforge = activeGameInstance;
    (window as any).__cyberforgeRelayout = () => renderGameLayout(user, activeGameInstance);
  }

  // Esperar a que el DOM esté completamente listo antes de renderizar
  requestAnimationFrame(() => {
    renderGameLayout(user, activeGameInstance);
  });
}

function renderGameLayout(user: any, game: any) {
  // Limpiar el DOM completamente antes de renderizar
  app.innerHTML = '';
  app.removeAttribute('style');
  
  app.innerHTML = `
    <div class="fixed inset-0 app-bg flex flex-col font-sans select-none overflow-hidden">
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--accent)]/10 via-[var(--bg-app)] to-[var(--bg-app)] pointer-events-none"></div>

      <!-- Header Principal -->
      <header class="relative z-10 card-glass border rounded-2xl p-3 md:p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xl mx-3 md:mx-4 mt-2 md:mt-3 flex-shrink-0">
        <div class="flex items-center gap-3">
          <!-- Botón menú hamburguesa (solo móvil) -->
          <button id="menu-btn" class="md:hidden w-10 h-10 flex items-center justify-center card-glass border border-[var(--border-color)] rounded-xl text-[var(--text-main)] hover:border-[var(--accent)] transition cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div class="w-3 h-3 rounded-full accent-bg animate-pulse"></div>
          <div>
            <div class="text-[10px] text-[var(--text-muted)] font-mono tracking-widest">CYBER BASE</div>
            <div id="nav-username" class="font-['Orbitron'] font-bold text-sm accent-text truncate max-w-[200px]">${user.displayName || 'Operativo'}</div>
          </div>
        </div>

        <!-- HUD de Buffs: una sola fila con scroll, nunca crece el header -->
        <div id="active-buffs-hud" class="hidden md:flex items-center gap-1.5 flex-nowrap min-w-0 flex-1 max-w-full overflow-x-auto py-0.5"></div>

        <div class="hidden md:flex items-center gap-2 flex-wrap justify-center">
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

          <button id="store-tab-btn" class="px-3 py-2 card-glass border border-[var(--border-color)] rounded-xl text-xs font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer flex items-center gap-1">
            🛒 Tienda
          </button>

          <button id="rankings-btn" class="px-3.5 py-2 card-glass border border-[var(--border-color)] rounded-xl text-xs font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer">
            🏆 Rankings
          </button>

          <button id="mute-btn" title="Activar o silenciar sonido" class="w-9 py-2 card-glass border border-[var(--border-color)] rounded-xl text-xs font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer">
            ${isMuted() ? '🔇' : '🔊'}
          </button>

          <button id="logout-btn" class="px-3.5 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-400 hover:bg-red-500/25 transition cursor-pointer">
            Salir
          </button>
        </div>
      </header>

      <!-- Menú lateral móvil -->
      <div id="mobile-menu" class="fixed inset-0 z-50 hidden">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="mobile-menu-overlay"></div>
        <div class="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] app-bg border-r border-[var(--border-color)] flex flex-col p-4 gap-3 shadow-2xl">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-['Orbitron'] font-bold text-base accent-text">MENÚ</h3>
            <button id="close-menu-btn" class="w-8 h-8 flex items-center justify-center card-glass border border-[var(--border-color)] rounded-lg text-[var(--text-main)] hover:border-[var(--accent)] transition cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div id="buffs-hud-mobile" class="flex flex-col gap-1.5 empty:hidden"></div>
          <select id="theme-selector-mobile" class="app-bg border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] cursor-pointer">
            <option value="cyber-dark">🌙 Cyber Dark</option>
            <option value="synthwave">🌸 Synthwave</option>
            <option value="matrix">🟢 Matrix Green</option>
            <option value="nature">🌿 Naturaleza (Eco)</option>
            <option value="neon-purple">🔮 Neón Púrpura</option>
            <option value="sunset">🌅 Sunset Cyber</option>
          </select>
          <button id="warehouse-tab-btn-mobile" class="w-full px-4 py-3 card-glass border border-[var(--border-color)] rounded-xl text-sm font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer flex items-center gap-2">
            📦 Almacén
          </button>
          <button id="store-tab-btn-mobile" class="w-full px-4 py-3 card-glass border border-[var(--border-color)] rounded-xl text-sm font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer flex items-center gap-2">
            🛒 Tienda
          </button>
          <button id="rankings-btn-mobile" class="w-full px-4 py-3 card-glass border border-[var(--border-color)] rounded-xl text-sm font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer flex items-center gap-2">
            🏆 Rankings
          </button>
          <div class="flex-grow"></div>
          <button id="logout-btn-mobile" class="w-full px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm font-mono text-red-400 hover:bg-red-500/25 transition cursor-pointer flex items-center gap-2">
            🚪 Salir
          </button>
        </div>
      </div>

      <!-- Main Fullscreen Layout sin Scroll Global -->
      <main class="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 max-w-6xl mx-auto w-full items-stretch flex-grow min-h-0 px-3 md:px-4 pb-2 md:pb-3 overflow-hidden">
        
        <!-- Panel Izquierdo: Recolector Principal (Click = Recolección) -->
        <div class="lg:col-span-5 flex flex-col items-center justify-center gap-3 md:gap-5 card-glass border rounded-3xl p-4 md:p-6 shadow-2xl text-center min-h-0 overflow-hidden">
          <div class="flex-shrink-0">
            <div id="nanites-counter" class="text-3xl md:text-4xl font-['Orbitron'] font-black accent-text tracking-wider">0</div>
            <div class="text-xs text-[var(--text-muted)] font-mono tracking-widest mt-1">NANITAS</div>
            <div id="passive-income-display" class="text-xs font-mono text-[var(--text-muted)] mt-1">+0 Nanitas / segundo</div>
          </div>

          <button id="click-btn" class="relative w-36 h-36 md:w-44 md:h-44 lg:w-52 lg:h-52 rounded-full app-bg border-4 border-[var(--accent)] flex flex-col items-center justify-center gap-2 shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:scale-105 active:scale-95 transition-all cursor-pointer group flex-shrink-0">
            <div class="absolute inset-0 rounded-full accent-bg opacity-10 group-hover:opacity-20 transition"></div>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 accent-text animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span class="font-['Orbitron'] font-black text-xs tracking-widest accent-text">RECOLECTAR</span>
          </button>
          <div id="click-damage-display" class="text-xs font-mono text-emerald-400 text-center flex-shrink-0">+0 Nanitas por click</div>
        </div>

        <!-- Panel Derecho: Panel del Jugador (Recolector + 3 Slots Compañeros) -->
        <div class="lg:col-span-7 card-glass border rounded-3xl p-4 md:p-6 shadow-2xl flex flex-col gap-3 md:gap-4 overflow-hidden min-h-0">
          <div class="flex items-center justify-between border-b border-[var(--border-color)] pb-3 flex-shrink-0">
            <h2 class="font-['Orbitron'] font-bold text-base accent-text tracking-wide">PANEL PRINCIPAL</h2>
          </div>

          <div class="flex flex-col gap-3 md:gap-4 overflow-y-auto pr-1 flex-grow min-h-0">
            <!-- Recolector Equipado -->
            <div class="app-bg border-2 rounded-2xl p-4 flex-shrink-0" style="border-color: var(--accent); background: linear-gradient(to bottom right, color-mix(in srgb, var(--accent) 15%, transparent), transparent);">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">⚙️</span>
                <span class="text-[10px] font-mono uppercase tracking-wider font-bold" style="color: var(--accent)">Recolector Equipado</span>
              </div>
              <div id="equipped-collector-container">
                <!-- Se llena dinámicamente -->
              </div>
            </div>

            <!-- Slots de Compañeros -->
            <div class="app-bg border-2 rounded-2xl p-4 flex-shrink-0" style="border-color: var(--accent); background: linear-gradient(to bottom right, color-mix(in srgb, var(--accent) 10%, transparent), transparent);">
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

      <footer class="relative z-10 text-center text-[10px] text-[var(--text-muted)] font-mono flex-shrink-0 pb-2 pt-1">
        Cyber-Forge Space Engine v4.0 • Sistema En Línea
      </footer>
    </div>
  `;

  // Cancelación de buffs por delegación de eventos: las tarjetas se parchean en
  // cada tick, así que el botón se replaces; el contenedor no.
  buffHudBuilt.done = false;
  const handleBuffCancelClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest('[data-cancel]');
    const buffKey = btn?.getAttribute('data-cancel') as BuffKey | undefined;
    if (!buffKey) return;
    const def = BUFF_DEFS.find(d => d.key === buffKey);
    showConfirmModal(
      `¿Cancelar ${def?.label ?? 'el buff'}? El tiempo restante se pierde.`,
      () => {
        const cancelled = activeGameInstance?.cancelBuff?.(buffKey);
        if (cancelled) showToast(`${cancelled} cancelado`, 'info');
      }
    );
  };
  document.querySelector('#active-buffs-hud')?.addEventListener('click', handleBuffCancelClick);
  document.querySelector('#buffs-hud-mobile')?.addEventListener('click', handleBuffCancelClick);

  document.querySelector('#click-btn')?.addEventListener('click', (e) => {
    const mouseEvent = e as MouseEvent;
    // El AudioContext solo puede crearse tras un gesto del usuario: este es el
    // primer clic real de la partida
    sfx.click();
    const beforeClick = game.getState().nanites;
    game.click();
    const afterClick = game.getState().nanites;
    const collected = afterClick - beforeClick;
    const clickDamageEl = document.querySelector('#click-damage-display');
    if (clickDamageEl) {
      clickDamageEl.textContent = `+${formatNumber(collected)} Nanitas por click`;
    }
    // Texto flotante en la posición del click
    showFloatingText(mouseEvent.clientX, mouseEvent.clientY, `+${formatNumber(collected)}`, 'var(--accent)');
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

  document.querySelector('#store-tab-btn')?.addEventListener('click', () => {
    renderStoreTab(app, game, () => {
      renderGameLayout(user, game);
    });
  });

  document.querySelector('#rankings-btn')?.addEventListener('click', () => {
    renderRankings(app, user, () => renderGameLayout(user, game));
  });

  const muteBtn = document.querySelector('#mute-btn');
  muteBtn?.addEventListener('click', () => {
    const muted = toggleMute();
    muteBtn.textContent = muted ? '🔇' : '🔊';
  });

  document.querySelector('#logout-btn')?.addEventListener('click', async () => {
    stopCompanionClicks();
    if (activeGameInstance?.cleanup) await activeGameInstance.cleanup();
    await signOut(auth);
  });

  // Menú móvil
  const menuBtn = document.querySelector('#menu-btn');
  const mobileMenu = document.querySelector('#mobile-menu');
  const closeMenuBtn = document.querySelector('#close-menu-btn');
  const mobileMenuOverlay = document.querySelector('#mobile-menu-overlay');

  menuBtn?.addEventListener('click', () => {
    mobileMenu?.classList.remove('hidden');
  });

  closeMenuBtn?.addEventListener('click', () => {
    mobileMenu?.classList.add('hidden');
  });

  mobileMenuOverlay?.addEventListener('click', () => {
    mobileMenu?.classList.add('hidden');
  });

  // Botones del menú móvil
  document.querySelector('#warehouse-tab-btn-mobile')?.addEventListener('click', () => {
    mobileMenu?.classList.add('hidden');
    renderWarehouseTab(app, game, () => {
      renderGameLayout(user, game);
    }, () => {
      updateUI(game.getState(), game.isAfk());
    });
  });

  document.querySelector('#store-tab-btn-mobile')?.addEventListener('click', () => {
    mobileMenu?.classList.add('hidden');
    renderStoreTab(app, game, () => {
      renderGameLayout(user, game);
    });
  });

  document.querySelector('#rankings-btn-mobile')?.addEventListener('click', () => {
    mobileMenu?.classList.add('hidden');
    renderRankings(app, user, () => renderGameLayout(user, game));
  });

  document.querySelector('#logout-btn-mobile')?.addEventListener('click', async () => {
    mobileMenu?.classList.add('hidden');
    stopCompanionClicks();
    if (activeGameInstance?.cleanup) await activeGameInstance.cleanup();
    await signOut(auth);
  });

  // Tema móvil
  const themeSelectorMobile = document.querySelector('#theme-selector-mobile') as HTMLSelectElement;
  themeSelectorMobile?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value as ThemeName;
    setTheme(val);
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
  
  // Forzar un re-render completo después de un breve delay para asegurar que todo se muestre correctamente
  setTimeout(() => {
    updateUI(game.getState(), game.isAfk());
    renderPlayerPanel(game.getState());
  }, 50);

  // Iniciar clicks automáticos de compañeros después de que el DOM esté listo
  setTimeout(() => {
    startCompanionClicks(game);
  }, 100);
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
  const activeBuffsHud = document.querySelector('#active-buffs-hud');

  if (nanitesCounter) nanitesCounter.textContent = formatNumber(state.nanites);

  const now = Date.now();
  const passiveBuffRemaining = Math.max(0, state.buffs.passiveBoostExpiresAt - now);
  const hasPassiveBuff = passiveBuffRemaining > 0;

  const isPresent = typeof activeGameInstance?.isPresent === 'function'
    ? activeGameInstance.isPresent()
    : true;

  if (passiveIncomeDisplay) {
    if (!isPresent) {
      // El juego está en pausa: sin ventana activa no hay pasivo
      passiveIncomeDisplay.innerHTML = `<span class="text-amber-500">⏸ En pausa — vuelve a la ventana para cobrar</span>`;
    } else {
      const displayValue = (isAfk && !hasPassiveBuff) ? 0 : state.passiveIncome;
      passiveIncomeDisplay.textContent = `+${formatNumber(displayValue)} Nanitas / segundo`;
    }
  }

  if (clickDamageDisplay) {
    // El daño real lo calcula el game loop (nivel del arma + buffs + multiplicador
    // de compañeros). Si aquí se recalcula a mano se desincroniza del valor real.
    const clickDamage = typeof activeGameInstance?.getClickDamage === 'function'
      ? activeGameInstance.getClickDamage()
      : 0;
    clickDamageDisplay.textContent = `+${formatNumber(clickDamage)} Nanitas por click`;
  }

  renderBuffHud(state, now);

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

function renderPlayerPanel(state: any) {
  const rarityColors: Record<string, string> = {
    'Común': 'text-slate-400',
    'Raro': 'text-blue-400',
    'Épico': 'text-purple-400',
    'Legendario': 'text-amber-400',
    'Mítico': 'text-red-400',
    'Divino': 'text-yellow-300'
  };

  // Arma equipada
  const equippedItem = state.equippedWeaponId
    ? state.warehouse.find((w: any) => w.id === state.equippedWeaponId)
    : null;
  const collectorContainer = document.querySelector('#equipped-collector-container');
  if (collectorContainer) {
    if (equippedItem) {
      const tier = equippedItem.tier || 1;
      const baseDmg = equippedItem.damage || 0;
      const levelMultiplier = 1 + ((equippedItem.level || 0) * 0.10);
      const totalDmg = Math.floor(baseDmg * levelMultiplier);
      const rarity = equippedItem.rarity || 'Común';
      collectorContainer.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <div class="font-['Orbitron'] font-bold text-sm text-[var(--text-main)]">${equippedItem.name} T${tier}</div>
            <div class="text-xs font-mono ${rarityColors[rarity] || 'text-slate-400'}">${rarity} — Tier ${tier}</div>
            <div class="text-xs font-mono text-[var(--text-muted)]">Nivel: ${equippedItem.level || 0} / 20</div>
            <div class="text-xs font-mono" style="color: var(--accent)">Recolección: +${totalDmg}</div>
          </div>
        </div>
      `;
    } else {
      collectorContainer.innerHTML = `
        <div class="text-center py-4">
          <div class="text-3xl mb-2 opacity-50">⚔️</div>
          <div class="text-xs font-mono text-[var(--text-muted)]">Sin arma equipada</div>
        </div>
      `;
    }
  }

  // Slots de compañeros (respetar maxCompanionSlots)
  const companionsContainer = document.querySelector('#companions-slots-container');
  if (companionsContainer) {
    const maxSlots = state.maxCompanionSlots || 1;
    const activeCompanions = state.activeCompanions
      .map((id: string) => state.companions.find((c: any) => c.id === id))
      .filter(Boolean);

    let slotsHtml = '';
    for (let i = 0; i < maxSlots; i++) {
      const comp = activeCompanions[i];
      if (comp) {
        const compDescription = comp.type === 'multiplier'
          ? `Multiplicador global: x${(1 + comp.power).toFixed(2).replace(/\.?0+$/, '')}`
          : `Recolección por segundo: +${comp.power}/s`;
        const tierLabel = comp.tier ? ` T${comp.tier}` : '';
        const compRarity = comp.rarity || 'Común';
        const rarityColor = rarityColors[compRarity] || 'text-slate-400';
        slotsHtml += `
          <div class="rounded-xl p-3 text-center border transition-all" style="background: var(--bg-app); border-color: var(--accent); border-opacity: 0.3;">
            <div class="text-[10px] font-mono text-[var(--text-main)] truncate">${comp.name}${tierLabel}</div>
            <div class="text-[9px] font-mono ${rarityColor}">${compRarity}</div>
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

// Texto flotante para clicks del jugador
function showFloatingText(x: number, y: number, text: string, color: string = 'var(--accent)') {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    transform: translate(-50%, -50%);
    color: ${color};
    font-family: 'Orbitron', sans-serif;
    font-weight: 900;
    font-size: 14px;
    pointer-events: none;
    z-index: 100;
    text-shadow: 0 0 10px ${color};
    animation: floatUp 1s ease-out forwards;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// Efecto de click de compañero en posición random dentro del recolector
function showCompanionClickInCollector(power: number) {
  const collector = document.querySelector('#click-btn');
  if (!collector) return;
  const rect = collector.getBoundingClientRect();
  
  // Posición random dentro del recolector (con margen para que no salga del borde)
  const margin = 40;
  const x = rect.left + margin + Math.random() * (rect.width - margin * 2);
  const y = rect.top + margin + Math.random() * (rect.height - margin * 2);
  
  // Crear efecto visual de click (círculo que se expande)
  const clickEffect = document.createElement('div');
  clickEffect.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 3px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 40%, transparent);
    box-shadow: 0 0 15px var(--accent);
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 9999;
    animation: companionClick 0.8s ease-out forwards;
  `;
  document.body.appendChild(clickEffect);
  setTimeout(() => clickEffect.remove(), 800);
  
  // Texto flotante
  showFloatingText(x, y, `+${power}`, 'var(--accent)');
}

// Clicks automáticos de compañeros (cada segundo)
let companionClickInterval: number | null = null;

function startCompanionClicks(game: any) {
  if (companionClickInterval) clearInterval(companionClickInterval);
  companionClickInterval = window.setInterval(() => {
    // Solo efectos visuales: con la pestaña oculta no hay nada que dibujar
    if (document.hidden) return;

    const state = game.getState();
    const clickCompanions = state.activeCompanions
      .map((compId: string) => state.companions.find((c: any) => c.id === compId))
      .filter((c: any) => c && c.type === 'click');

    clickCompanions.forEach((comp: any, index: number) => {
      setTimeout(() => {
        showCompanionClickInCollector(comp.power);
      }, index * 100);
    });
  }, 1000);
}

function stopCompanionClicks() {
  if (companionClickInterval) {
    clearInterval(companionClickInterval);
    companionClickInterval = null;
  }
}
