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
  sfx, isSfxEnabled, isMusicEnabled, toggleMute, toggleMusic, primeAudio,
  setAudioSuspended, installAudioUnlock, onAudioStateChange
} from './utils/audio';
import { renderLayoutHTML } from './ui/layout';
import { ic, icSafe } from './ui/icons';

const app = document.querySelector('#app') as HTMLElement;
let activeGameInstance: any = null;
let activeUser: any = null;
const router = new Router();

/**
 * Suscriptores de audio vivos de la vista actual.
 *
 * `onAudioStateChange` devuelve la función que lo da de baja. Guardarlas aquí
 * permite limpiarlas al salir de la base: si no, cada visita a la vista
 * principal dejaba un suscriptor apuntando a un DOM que ya no existe. Cuatro
 * visitas bastaban para que un toggle de música intentara pintar cuatro
 * botones, tres de ellos borrados.
 */
const audioUnsubscribers = new Set<() => void>();

function clearAudioUnsubscribers() {
  audioUnsubscribers.forEach(fn => {
    try { fn(); } catch { /* un suscriptor ya muerto no debe impedir limpiar al resto */ }
  });
  audioUnsubscribers.clear();
}

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
                 [&>span>svg]:w-4 [&>span>svg]:h-4 text-slate-900">${icSafe(achievement.icon)}</span>
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

// El audio se desbloquea con el primer toque o tecla en cualquier parte.
// Sin esto, un jugador que entra y navega directo al almacén no oye nada
// hasta que vuelve a la base y pulsa el recolector.
installAudioUnlock();

/**
 * USER ANÓNIMO / SESIÓN PERDIDA.
 *
 * El nombre del jugador venía de una única fuente: `user.displayName`. Cuando
 * esa propiedad llegaba vacía —por ejemplo porque el token se renovó y el
 * objeto `user` se reconstruyó sin ella, o porque la cuenta se creó antes de
 * que existiera el `updateProfile`— el juego arrancaba mostrando el texto de
 * reserva "Operativo", y el jugador veía un nombre que no era el suyo.
 *
 * Ahora el nombre se busca en este orden, y el resultado se guarda en
 * `sessionStorage` para que sobreviva a un refresco de token:
 *
 *   1. el nombre con el que se acaba de registrarse (si acabamos de hacerlo)
 *   2. el que quedó cacheado de una visita anterior de esta sesión
 *   3. `user.displayName`
 *   4. el que guardamos en Firestore la última vez
 *
 * Si aun así no hay ninguno, se usa "Operativo", pero SOLO como último
 * recurso, y se avisa por consola para que el fallo sea diagnosticable.
 */
const ANON = 'Operativo';

/** Nombre resuelto de la sesión actual, o null si aún no se ha obtenido. */
let resolvedUsername: string | null = null;

function resolveUsername(user: any, justRegistered?: string): string {
  const guardado = (() => {
    try { return sessionStorage.getItem('cyberforge_username'); } catch { return null; }
  })();

  const candidatos = [
    justRegistered,
    guardado,
    user?.displayName,
    activeUser?.displayName
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  const nombre = candidatos[0] ?? ANON;
  resolvedUsername = nombre;

  // Se cachea solo si no es el valor de reserva: guardar "Operativo" haría
  // que el error se auto-perpetuase.
  if (nombre !== ANON) {
    try { sessionStorage.setItem('cyberforge_username', nombre); } catch { /* modo privado */ }
  }

  if (nombre === ANON) {
    console.warn('[auth] No se ha podido determinar el nombre de usuario; se usa "' + ANON + '".', user);
  }
  return nombre;
}

/**
 * Devuelve a la pantalla de acceso de forma ordenada.
 *
 * Es el camino que se usa tanto al cerrar sesión a mano como al perder la
 * sesión sola. Centralizarlo evita las dos cosas que se rompían por separado:
 * dejar el bucle de juego corriendo (las nanitas seguían entrando con la
 * partida "cerrada") y dejar la pantalla de juego a medias.
 */
async function returnToLogin(motivo?: string) {
  // Evita que dos caídas simultáneas (un signOut manual y un token
  // caducado) monten dos pantallas de acceso encima.
  if (returningToLogin) return;
  returningToLogin = true;

  console.info('[auth] Volviendo al acceso' + (motivo ? ': ' + motivo : '') + '.');
  clearAudioUnsubscribers();
  stopCompanionClicks();

  // Se limpia primero el estado local para que un fallo de red no deje la
  // partida a medias. El estado ya está guardado en Firestore.
  if (activeGameInstance?.cleanup) {
    try { await activeGameInstance.cleanup(); } catch { /* igualmente se sigue */ }
  }
  activeGameInstance = null;
  activeUser = null;
  resolvedUsername = null;
  try { sessionStorage.removeItem('cyberforge_username'); } catch { /* modo privado */ }

  // Un pequeño retardo evita el parpadeo de "juego → acceso → juego" cuando
  // el token se renueva, que dispara `onAuthStateChanged` más de una vez.
  setTimeout(() => {
    returningToLogin = false;
    renderAuth(app, (loggedInUser, username) => {
      initGame(loggedInUser, username);
    });
  }, 120);
}

let returningToLogin = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Firebase avisa con `null` tanto de "cerré sesión" como de "el token ya
    // no vale". Los dos casos terminan aquí: el jugador vuelve a acceder.
    await returnToLogin();
    return;
  }

  // Ya hay partida viva para ESTE usuario: no se reinicia nada. Antes,
  // cualquier disparo de `onAuthStateChanged` con un usuario válido llamaba a
  // `initGame`, y la renovación periódica del token lo dispara aunque no haya
  // pasado nada. El efecto era perder la partida en curso y volver a empezar
  // la carga desde cero.
  if (activeGameInstance && activeUser?.uid === user.uid) return;

  const justRegistered = sessionStorage.getItem('pending_username');
  if (justRegistered) sessionStorage.removeItem('pending_username');

  await initGame(user, resolveUsername(user, justRegistered ?? undefined));
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

  // Los suscriptores de audio apuntan al DOM de la vista anterior, que este
  // `innerHTML = ''` acaba de destruir. Se limpian antes de montar la nueva.
  clearAudioUnsubscribers();

  /**
   * Volver. Se intenta el historial y, si ya no queda nada, se cae a la base:
   * la base es el único sitio donde siempre se puede estar, así que nunca
   * puede haber un "atrás" que no lleve a ninguna parte.
   */
  const goBack = () => {
    sfx.nav();
    if (!router.back()) router.goTo('base');
    renderRoute(router.current);
  };

  /** Ir a la base ignorando el historial. Es el botón de "inicio" de escritorio. */
  const goHome = () => {
    sfx.nav();
    router.goTo('base');
    renderRoute(router.current);
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
      }, goHome, go);
      break;
    case 'forja':
      renderForgePage(app, activeGameInstance, goBack, goHome, go);
      break;
    case 'tienda':
      renderStoreTab(app, activeGameInstance, goBack, goHome);
      break;
    case 'perfil':
      renderProfilePage(app, activeGameInstance, goBack, () => go('prestigio'), goHome, go);
      break;
    case 'ranking':
      renderRankings(app, activeUser, goBack, goHome);
      break;
    case 'prestigio':
      renderPrestigePage(app, activeGameInstance, goBack, goHome, go);
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
    onToggleMute: () => toggleMute(),
    onToggleMusic: () => toggleMusic(),
    onThemeChange: (theme) => setTheme(theme as ThemeName)
  });

  // --- Navegación y controles: delegación en el contenedor, no por botón ---
  // Con un solo listener en `app` todos los botones `data-nav` funcionan sin
  // registrar nueve manejadores distintos cada vez que se monta la vista.
  app.onclick = (e) => {
    const target = e.target as HTMLElement;

    // Los interruptores de audio se comprueban ANTES que la navegación: los
    // botones viven en la cabecera, que está dentro de `app`, así que sin este
    // orden el click caería en el `closest('[data-nav]')` equivocado.
    const audioBtn = target.closest('[data-audio]') as HTMLElement | null;
    if (audioBtn) {
      e.preventDefault();
      if (audioBtn.dataset.audio === 'music') toggleMusic();
      else toggleMute();
      return;
    }

    if (target.closest('[data-logout]')) {
      e.preventDefault();
      void doLogout();
      return;
    }

    const nav = target.closest('[data-nav]') as HTMLElement | null;
    if (!nav) return;
    e.preventDefault();
    sfx.nav();
    onNavigate(nav.dataset.nav as Route);
  };

  /**
   * Repinta los dos botones de audio con el estado real.
   *
   * Se llama tras cada toggle en vez de re-renderizar la vista entera: un
   * re-render destroys el HUD de buffs y las escuchas del click del
   * recolector, y perderse eso por cambiar un icono no compensa.
   *
   * Hay una sola función que decide cómo se ve cada estado. Cuando el estado
   * se pintaba en dos sitios —el HTML de `layout.ts` y el manejador del
   * toggle— cualquier cambio de estilo tenía que hacerse dos veces, y ya se
   * había desincronizado: el botón de música nunca cambiaba de icono.
   */
  const paintAudioButtons = () => {
    const music = isMusicEnabled();
    const sfxOn = isSfxEnabled();

    const musicBtn = document.querySelector('#music-btn');
    if (musicBtn) {
      musicBtn.innerHTML =
        `<span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic(music ? 'music' : 'mute')}</span>` +
        `<span class="hidden md:inline font-mono">${music ? 'Música' : 'Off'}</span>`;
      musicBtn.className = music
        ? 'w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition text-[var(--text-main)]'
        : 'w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition text-[var(--text-muted)] opacity-70';
      musicBtn.setAttribute('aria-pressed', String(music));
      musicBtn.setAttribute('aria-label', music ? 'Apagar música' : 'Encender música');
      musicBtn.setAttribute('title', music ? 'Apagar música' : 'Encender música');
    }

    const sfxBtn = document.querySelector('#mute-btn');
    if (sfxBtn) {
      sfxBtn.innerHTML =
        `<span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic(sfxOn ? 'sound' : 'mute')}</span>` +
        `<span class="hidden md:inline font-mono">${sfxOn ? 'SFX' : 'Off'}</span>`;
      sfxBtn.className = sfxOn
        ? 'w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition text-[var(--text-main)]'
        : 'w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition text-[var(--text-muted)] opacity-70';
      sfxBtn.setAttribute('aria-pressed', String(sfxOn));
      sfxBtn.setAttribute('aria-label', sfxOn ? 'Silenciar efectos' : 'Activar efectos');
      sfxBtn.setAttribute('title', sfxOn ? 'Silenciar efectos' : 'Activar efectos');
    }
  };

  // El propio módulo de audio avisa de cualquier cambio, venga de donde venga
  // (un toggle, o el estado guardado que se aplica al montar). Así el botón
  // nunca queda mostrando algo que ya no es verdad.
  const unsubscribeAudio = onAudioStateChange(paintAudioButtons);
  audioUnsubscribers.add(unsubscribeAudio);
  paintAudioButtons();

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

/**
 * Cierra la sesión.
 *
 * `signOut` dispara `onAuthStateChanged` con `null`, y ese es el camino que ya
 * limpia todo y vuelve al acceso. Aquí solo se fuerza el cierre y se espera a
 * que el propio listener haga el resto: duplicar la limpieza en los dos sitios
 * es exactamente la forma de que uno se quede sin actualizar.
 *
 * El guardado previo evita perder lo jugado en los últimos segundos: el estado
 * se escribe a Firestore, pero con la sesión ya cerrada la escritura sería
 * rechazada.
 */
async function doLogout() {
  stopCompanionClicks();
  try {
    if (activeGameInstance?.flush) activeGameInstance.flush();
  } catch (e) {
    console.warn('[auth] No se ha podido guardar antes de salir:', e);
  }
  await signOut(auth);
  // `onAuthStateChanged` se encarga de limpiar y de pintar el acceso.
  // Esta llamada solo cubre el caso de que el listener ya no estuviera vivo.
  await returnToLogin('cierre de sesión manual');
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
    // El daño real lo calcula el game loop (nivel del recolector + buffs + afijos +
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
