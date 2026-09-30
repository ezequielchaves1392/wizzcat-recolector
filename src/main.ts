import { renderBuffHud, resetBuffHud, buffLabel } from './ui/buffHud';
import { renderPanel } from './ui/playerPanel';
import { formatNumber } from './utils/format';
import './style.css';
import './style.modules.css';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { renderAuth } from './components/auth';
import { createGameLoop, type BuffKey } from './gameLoop';
import { showToast } from './utils/toast';
import { renderWarehouseTab } from './components/warehouse';
import { renderRankings } from './components/rankings';
import { renderStoreTab } from './components/store';
import { renderForgePage } from './ui/forgePage';
import { renderProfilePage } from './ui/profilePage';
import { renderPrestigePage } from './ui/prestigePage';
import { Router, type Route } from './ui/router';

import { applyTheme, getSavedTheme, setTheme, type ThemeName } from './theme';
import { showConfirmModal } from './utils/modal';
import {
  sfx, isMuted, isMusicEnabled, toggleMute, toggleMusic, primeAudio, setAudioSuspended
} from './utils/audio';
import { renderLayoutHTML } from './ui/layout';
import { ic } from './ui/icons';

const app = document.querySelector('#app') as HTMLElement;
let activeGameInstance: any = null;
let activeUser: any = null;
const router = new Router();

/**
 * Manejador de `visibilitychange` con nombre, para poder quitarlo antes de
 * volver a ponerlo. Ver `renderBase`.
 */
function handleVisibility() {
  setAudioSuspended(document.hidden);
}

// Aviso de logro desbloqueado. Va abajo al centro, por encima de la barra de
// navegación, y se apila si llegan varios seguidos en el mismo segundo.
function showAchievementPopup(achievement: { title: string; description: string; icon: string; rewardText: string }) {
  sfx.achievement();

  const stack = document.querySelector('#achievement-stack') as HTMLElement | null;
  if (!stack) return;

  const el = document.createElement('div');
  el.className = 'card-glass-elevated rounded-2xl px-4 py-2.5 flex items-center gap-3 w-full pointer-events-none';
  el.style.borderColor = 'var(--accent)';
  el.style.cssText += 'animation: achievementIn 380ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid var(--accent);';
  el.innerHTML = `
    <span class="w-9 h-9 rounded-xl accent-bg flex items-center justify-center flex-shrink-0
                 [&>span>svg]:w-4 [&>span>svg]:h-4 text-slate-900">${ic((achievement.icon || 'sparkle') as any)}</span>
    <span class="flex flex-col gap-0.5 min-w-0">
      <span class="label-caps" style="color: var(--accent)">Logro desbloqueado</span>
      <span class="font-['Orbitron'] font-bold text-[13px] text-[var(--text-main)] truncate">${achievement.title}</span>
      <span class="text-[10px] font-mono text-[var(--text-muted)] truncate">${achievement.rewardText}</span>
    </span>
  `;
  stack.appendChild(el);

  // Un tope de 3 evita que una racha de logros tape media pantalla
  while (stack.children.length > 3) stack.firstElementChild?.remove();

  setTimeout(() => {
    el.style.transition = 'opacity 350ms ease, transform 350ms ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px) scale(0.97)';
    setTimeout(() => el.remove(), 380);
  }, 3000);
}

// Aplicar tema guardado (o por defecto cyber-dark)
applyTheme(getSavedTheme());

document.addEventListener('contextmenu', (e) => e.preventDefault());

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (activeGameInstance?.cleanup) await activeGameInstance.cleanup();
    stopCompanionClicks();
    activeGameInstance = null;
    activeUser = null;
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
  activeUser = user;
  activeGameInstance = await createGameLoop(user, (state: any, isAfk?: boolean) => {
    updateUI(state, isAfk ?? false);
  }, username, (achievement: any) => {
    showAchievementPopup(achievement);
  });

  // Handle de depuración solo en dev: permite inspeccionar y probar el estado
  // desde la consola. Se elimina del build de producción.
  if (import.meta.env.DEV) {
    (window as any).__cyberforge = activeGameInstance;
    (window as any).__cyberforgeRelayout = () => renderRoute(router.current);
  }

  requestAnimationFrame(() => {
    renderRoute(router.current);
    startCompanionClicks(activeGameInstance);
  });
}

// ==========================================================================
//  Router
// ==========================================================================

/**
 * Monta la vista que toca. Es el único punto donde se decide qué se pinta,
 * y todas las páginas reciben la misma pareja de callbacks (`back` y, en el
 * caso del perfil, `prestigio`) para que el botón de atrás funcione igual en
 * las cinco.
 *
 * Nota sobre el estado: el game loop NO se reinicia al cambiar de vista. El
 * tick sigue corriendo con la página de almacén abierta, así que las nanitas
 * siguen entrando. Antes, al entrar al almacén se paraba el bucle y el juego
 * se congelaba mientras mirabas tus cosas.
 */
function renderRoute(route: Route) {
  if (!activeGameInstance) return;
  app.innerHTML = '';
  app.removeAttribute('style');
  document.body.setAttribute('data-theme', getSavedTheme());

  // El DOM del HUD de buffs se recrea, así que hay que invalidar la marca
  resetBuffHud();

  const goBack = () => {
    sfx.nav();
    if (!router.back()) router.goTo('base');
    else renderRoute(router.current);
  };

  const go = (r: Route) => {
    sfx.nav();
    router.goTo(r);
    renderRoute(router.current);
  };

  switch (route) {
    case 'base':
      renderBase(go, goBack);
      break;
    case 'almacen':
      renderWarehouseTab(app, activeGameInstance, goBack, () => {
        updateUI(activeGameInstance.getState(), activeGameInstance.isAfk());
      });
      break;
    case 'forja':
      renderForgePage(app, activeGameInstance, goBack);
      break;
    case 'tienda':
      renderStoreTab(app, activeGameInstance, goBack);
      break;
    case 'perfil':
      renderProfilePage(app, activeGameInstance, goBack, () => go('prestigio'));
      break;
    case 'ranking':
      renderRankings(app, activeUser, goBack);
      break;
    case 'prestigio':
      renderPrestigePage(app, activeGameInstance, goBack);
      break;
  }
}

/** Vista principal: el recolector, el escuadrón y la navegación. */
function renderBase(onNavigate: (r: Route) => void, goBack: () => void) {
  const game = activeGameInstance;
  const user = activeUser;

  app.innerHTML = renderLayoutHTML(user, getSavedTheme(), router.current, {
    onNavigate,
    onLogout: () => void doLogout(),
    onToggleMute: () => {
      const muted = toggleMute();
      const btn = document.querySelector('#mute-btn');
      if (btn) {
        btn.innerHTML = `<span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic(muted ? 'mute' : 'sound')}</span>` +
                        `<span class="hidden md:inline font-mono">${muted ? 'Mudo' : 'SFX'}</span>`;
      }
    },
    onToggleMusic: () => {
      const on = toggleMusic();
      const btn = document.querySelector('#music-btn');
      if (btn) {
        btn.innerHTML = `<span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('sound')}</span>` +
                        `<span class="hidden md:inline font-mono">${on ? 'Música' : 'Silencio'}</span>`;
        (btn as HTMLElement).style.opacity = on ? '1' : '0.5';
      }
    },
    onThemeChange: (theme) => setTheme(theme as ThemeName)
  });

  // --- Navegación: delegación en el contenedor, no por botón ---
  // Con un solo listener en `app` todos los botones `data-nav` funcionan sin
  // registrar nueve manejadores distintos cada vez que se monta la vista.
  app.onclick = (e) => {
    const nav = (e.target as HTMLElement).closest('[data-nav]') as HTMLElement | null;
    if (!nav) return;
    e.preventDefault();
    sfx.nav();
    onNavigate(nav.dataset.nav as Route);
  };

  // ---- Click del recolector ----
  let clickStreak = 0;
  let streakTimer: number | null = null;
  document.querySelector('#click-btn')?.addEventListener('click', (e) => {
    const mouseEvent = e as MouseEvent;
    // El AudioContext solo puede crearse tras un gesto real del usuario
    primeAudio();

    clickStreak++;
    sfx.click(clickStreak);
    if (streakTimer) clearTimeout(streakTimer);
    streakTimer = window.setTimeout(() => { clickStreak = 0; }, 1200);

    const before = game.getState().nanites;
    game.click();
    const collected = game.getState().nanites - before;

    const el = document.querySelector('#click-damage-display');
    if (el) el.textContent = `+${formatNumber(collected)} por click`;

    showFloatingText(mouseEvent.clientX, mouseEvent.clientY, `+${formatNumber(collected)}`);
  });

  // ---- Cancelación de buffs (delegación: las tarjetas se parchean cada tick) ----
  const handleBuffCancel = (e: Event) => {
    const btn = (e.target as HTMLElement).closest('[data-cancel]');
    const buffKey = btn?.getAttribute('data-cancel') as BuffKey | undefined;
    if (!buffKey) return;
    e.stopPropagation();
    showConfirmModal(
      `Se pierde el tiempo restante de ${buffLabel(buffKey)}. El item ya está gastado.`,
      () => {
        const cancelled = activeGameInstance?.cancelBuff?.(buffKey);
        if (cancelled) showToast(`${cancelled} cancelado`, 'info');
      },
      { sublabel: 'Cancelar buff', confirmText: 'Cancelar buff', danger: true }
    );
  };
  document.querySelector('#active-buffs-hud')?.addEventListener('click', handleBuffCancel);
  document.querySelector('#buffs-hud-mobile')?.addEventListener('click', handleBuffCancel);

  // ---- Panel de tema (móvil) ----
  const sheet = document.querySelector('#theme-sheet');
  const openSheet = () => sheet?.classList.remove('hidden');
  const closeSheet = () => sheet?.classList.add('hidden');
  document.querySelector('#theme-btn-mobile')?.addEventListener('click', openSheet);
  document.querySelector('#close-theme-sheet')?.addEventListener('click', closeSheet);
  document.querySelector('#theme-sheet-overlay')?.addEventListener('click', closeSheet);
  sheet?.querySelectorAll('[data-theme-option]').forEach(btn => {
    btn.addEventListener('click', () => {
      setTheme(btn.getAttribute('data-theme-option') as ThemeName);
      closeSheet();
    });
  });

  // ---- Tema (escritorio) ----
  const themeSelector = document.querySelector('#theme-selector') as HTMLSelectElement | null;
  if (themeSelector) themeSelector.value = getSavedTheme();
  themeSelector?.addEventListener('change', (e) => setTheme((e.target as HTMLSelectElement).value as ThemeName));

  // ---- Audio: suspende en segundo plano para no gastar batería ----
  // El listener vive en `document`, que sobrevive a los re-renders de la
  // vista. Sin el `removeEventListener` previo, cada vuelta a la base añadía
  // un manejador más y cambiar la visibilidad disparaba N veces el mismo
  // trabajo de audio.
  document.removeEventListener('visibilitychange', handleVisibility);
  document.addEventListener('visibilitychange', handleVisibility);

  // ---- Primer render ----
  const initialState = game.getState();
  updateUI(initialState, game.isAfk());
  renderPlayerPanel(initialState);

  // Segundo pase tras un frame: corrige medidas de layout tras el primer pintado
  requestAnimationFrame(() => {
    updateUI(game.getState(), game.isAfk());
    renderPlayerPanel(game.getState());
  });
}

async function doLogout() {
  stopCompanionClicks();
  if (activeGameInstance?.cleanup) await activeGameInstance.cleanup();
  await signOut(auth);
}

// Exponer updateUI globalmente para que el almacén pueda actualizar la UI
(window as any).updateGameUI = (state?: any) => {
  const gameState = state || activeGameInstance?.getState();
  if (gameState) updateUI(gameState, activeGameInstance?.isAfk() || false);
};

function updateUI(state: any, isAfk: boolean = false) {
  const nanitesCounter = document.querySelector('#nanites-counter');
  const passiveIncomeDisplay = document.querySelector('#passive-income-display');
  const clickDamageDisplay = document.querySelector('#click-damage-display');

  if (nanitesCounter) nanitesCounter.textContent = formatNumber(state.nanites);

  const now = Date.now();
  const passiveBuffRemaining = Math.max(0, state.buffs.passiveBoostExpiresAt - now);
  const hasPassiveBuff = passiveBuffRemaining > 0;

  const isPresent = typeof activeGameInstance?.isPresent === 'function'
    ? activeGameInstance.isPresent()
    : true;

  if (passiveIncomeDisplay) {
    if (!isPresent) {
      passiveIncomeDisplay.innerHTML =
        `<span class="text-amber-500">En pausa — vuelve a la ventana para cobrar</span>`;
    } else {
      const displayValue = (isAfk && !hasPassiveBuff) ? 0 : state.passiveIncome;
      passiveIncomeDisplay.textContent = `+${formatNumber(displayValue)} Nanitas / segundo`;
    }
  }

  if (clickDamageDisplay) {
    // El daño real lo calcula el game loop (nivel del arma + buffs + afijos +
    // multiplicador de compañeros + árbol). Si aquí se recalcula a mano se
    // desincroniza del valor real.
    const clickDamage = typeof activeGameInstance?.getClickDamage === 'function'
      ? activeGameInstance.getClickDamage()
      : 0;
    clickDamageDisplay.textContent = `+${formatNumber(clickDamage)} Nanitas por click`;
  }

  // Atajo a la ascensión: dice cuántos núcleos llevas sin abrir la página
  const prestigeHint = document.querySelector('#prestige-hint');
  if (prestigeHint) {
    const pending = activeGameInstance?.getPrestigeInfo?.()?.pending ?? 0;
    prestigeHint.textContent = state.cores > 0
      ? `${formatNumber(state.cores)} núcleos disponibles`
      : pending > 0
        ? `Reciclar: +${formatNumber(pending)} núcleos`
        : '0 núcleos';
  }

  renderBuffHud(state, now);

  // El panel del jugador solo se pinta en la vista principal: en las demás no
  // existe el DOM y renderizarlo sería trabajo tirado a la basura.
  if (document.querySelector('#equipped-collector-container')) {
    renderPlayerPanel(state);
  }
}

function renderPlayerPanel(state: any) {
  // El daño real (con buffs, logros, afijos y multiplicadores) lo calcula el
  // game loop: así la tarjeta nunca contradice al botón del recolector
  const realDamage = typeof activeGameInstance?.getClickDamage === 'function'
    ? activeGameInstance.getClickDamage()
    : 0;
  // El total de slots (tienda + árbol) lo resuelve el game loop: leer
  // `state.maxCompanionSlots` mostraría "3/3 activos" con 5 huecos reales
  const slots = typeof activeGameInstance?.getCompanionSlots === 'function'
    ? activeGameInstance.getCompanionSlots()
    : undefined;
  renderPanel(state, realDamage, slots);
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

  const margin = 40;
  const x = rect.left + margin + Math.random() * (rect.width - margin * 2);
  const y = rect.top + margin + Math.random() * (rect.height - margin * 2);

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

  showFloatingText(x, y, `+${formatNumber(power)}`, 'var(--accent)');
}

// Clics automáticos de compañeros (cada segundo)
let companionClickInterval: number | null = null;

function startCompanionClicks(game: any) {
  if (companionClickInterval) clearInterval(companionClickInterval);
  companionClickInterval = window.setInterval(() => {
    // Solo efectos visuales: con la pestaña oculta no hay nada que dibujar
    if (document.hidden) return;
    // Solo en la vista principal: en las demás el recolector no existe
    if (!document.querySelector('#click-btn')) return;

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
