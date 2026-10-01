import { renderBuffHud, resetBuffHud, buffLabel } from './ui/buffHud';
import { renderPanel } from './ui/playerPanel';
import { formatNumber } from './utils/format';
import './style.css';
import './style.modules.css';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { renderAuth } from './components/auth';
import { renderBloqueado } from './components/blocked';
import { consultarBloqueo } from './services/bloqueoService';
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
  // Una cuenta bloqueada NO vuelve al formulario: se queda en su pantalla.
  // Este camino se dispara por el `signOut` que hace el propio bloqueo, y sin
  // esta guarda el formulario de acceso se montaba encima del aviso un segundo
  // después — el jugador veía "nombre o contraseña incorrectos" justo cuando le
  // acababan de explicar el motivo, y tenía que adivinar que era un bloqueo.
  if (bloqueadoEnCurso) return;

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

/**
 * CUENTA BLOQUEADA
 *
 * Cuando la terminal suspende una cuenta, el juego tiene que enterarse. Se
 * comprueba en DOS momentos, y son los dos únicos que cubren los casos reales:
 *
 *  1. Al arrancar. Cubre al jugador que recarga la página o abre el juego en
 *     otro dispositivo con la cuenta suspendida.
 *  2. Al volver a la pestaña. Cubre al jugador que ya estaba jugando cuando le
 *     bloquearon: no se le corta la partida en mitad de un click —eso sería
 *     un problema de sincronización del que salir es más difícil que el
 *     propio bloqueo—, pero en cuanto vuelve a mirar la pantalla se le cierra
 *     la sesión y ve el motivo.
 *
 * Lo que NO se puede hacer desde aquí es cerrar la sesión en remoto. Un
 * `signOut()` solo afecta a la pestaña que lo llama, así que el jugador del
 * otro dispositivo sigue dentro hasta que él mismo cambie de pestaña. Para
 * cortar eso de raíz hay que revocar los tokens con el Admin SDK, desde un
 * servidor.
 */

/**
 * Ya se está mostrando la pantalla de bloqueo.
 *
 * Vive fuera de la función porque lo consultan dos caminos distintos: el
 * propio bloqueo, y `returnToLogin()` —que la firma de sesión dispara un
 * instante después y que si no lo supiera, pintaría el acceso encima.
 *
 * No se reinicia nunca: si un administrador levanta el bloqueo, el jugador lo
 * nota recargando, que es lo que ofrece el botón de la propia pantalla.
 */
let bloqueadoEnCurso = false;

async function comprobarBloqueo(uid: string, nombre: string): Promise<boolean> {
  // Dos comprobaciones a la vez (pestaña y arranque) se solaparían: la segunda
  // volvería a pintar la pantalla de bloqueo encima de la primera.
  if (bloqueadoEnCurso) return true;

  const estado = await consultarBloqueo(uid);
  if (!estado.bloqueado) return false;

  bloqueadoEnCurso = true;
  console.warn('[bloqueo] Cuenta suspendida:', nombre, '-', estado.motivo);

  // Se guarda antes de cerrar. `signOut` deja las escrituras sin permisos, y
  // perder lo jugado en los últimos segundos sería un castigo doble por algo
  // que el jugador no ha hecho mal ahora mismo.
  try {
    activeGameInstance?.flush?.();
  } catch (e) {
    console.warn('[bloqueo] No se ha podido guardar antes de bloquear:', e);
  }

  clearAudioUnsubscribers();
  stopCompanionClicks();
  if (activeGameInstance?.cleanup) {
    try { await activeGameInstance.cleanup(); } catch { /* igualmente se sigue */ }
  }
  activeGameInstance = null;
  activeUser = null;
  resolvedUsername = null;
  try { sessionStorage.removeItem('cyberforge_username'); } catch { /* modo privado */ }

  // La sesión se cierra para que no quede una sesión viva detrás de la
  // pantalla. Si el jugador recarga, `onAuthStateChanged` lo encontrará
  // bloqueado otra vez y no podrá saltárselo.
  try { await signOut(auth); } catch { /* la pantalla ya está puesta */ }

  renderBloqueado(app, { nombre, motivo: estado.motivo, desde: estado.desde });
  return true;
}

/**
 * Al volver a la pestaña.
 *
 * Solo si hay partida viva: sin juego no hay nada que cortar, y el arranque ya
 * hizo la comprobación. Se consulta en cuanto la pestaña vuelve a verse, que es
 * justo cuando el jugador puede leer un aviso.
 */
function handleVisibilityCheckBlock() {
  if (document.hidden) return;
  const uid = activeUser?.uid;
  if (!uid || bloqueadoEnCurso) return;

  const nombre = resolvedUsername || ANON;
  void comprobarBloqueo(uid, nombre).then((bloqueado) => {
    if (bloqueado) console.info('[bloqueo] Sesión cerrada al volver a la pestaña.');
  });
}

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

  const nombre = resolveUsername(user, justRegistered ?? undefined);

  // Antes de arrancar nada. Si la cuenta está suspendida, el juego no llega a
  // crearse: ni bucle, ni guardado, ni pantalla de juego un solo instante.
  if (await comprobarBloqueo(user.uid, nombre)) return;

  await initGame(user, nombre);
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
  app.onclick = null;
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
      renderStoreTab(app, activeGameInstance, goBack, goHome, go);
      break;
    case 'perfil':
      renderProfilePage(app, activeGameInstance, goBack, () => go('prestigio'), goHome, go);
      break;
    case 'ranking':
      renderRankings(app, activeUser, goBack, goHome, go);
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

    // El rótulo de debajo NO se toca aquí. `game.click()` ya dispara `onUpdate`,
    // que termina en `updateUI`, y ese es el sitio que escribe
    // "+X Nanitas por click". Este bloque escribía además su propia versión,
    // "+X por click", con otro formato: como llegaba después, el texto
    // alternaba entre las dos frases en cada click y el tick siguiente lo
    // devolvía, y de ahí el "+X por click" que parpadeaba. Un solo escritor.
    playHitEffect(1);
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

  // ---- Comprobación de bloqueo al volver a la pestaña ----
  // Junto al resto de listeners de `document`, que sobreviven a los re-renders
  // de la vista. El `removeEventListener` previo es el mismo apaño que el de
  // arriba y por el mismo motivo: sin él, cada vuelta a la base añadiría un
  // manejador más y volver a la pestaña consultaría N veces lo mismo.
  document.removeEventListener('visibilitychange', handleVisibilityCheckBlock);
  document.addEventListener('visibilitychange', handleVisibilityCheckBlock);

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

  // El saldo de nanitas vive en varios sitios según la vista, y solo se
  // refrescaba el de la base. Los otros se pintaban una vez al montar la página
  // y se quedaban congelados: en el almacén, que es donde se vende y se usan
  // llaves, el precio se decidía contra una cifra vieja mientras el ingreso
  // pasivo seguía subiendo; en el mercado, directamente no se podía saber si
  // algo era asequible. Se recorren por id en vez de buscar clases para que
  // añadir otro contador sea añadir una entrada a la lista.
  const nanitesValue = formatNumber(state.nanites || 0);
  if (nanitesCounter) nanitesCounter.textContent = nanitesValue;
  for (const id of ['#page-nanites-val', '#wh-nanites-val', '#store-nanites', '#profile-nanites']) {
    const el = document.querySelector(id);
    if (el) el.textContent = nanitesValue;
  }

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

// Cuánto vive en pantalla un "+X" flotante. El companion click usa un valor
// mayor a propósito: el golpe llega solo, sin que nadie esté mirando el
// recolector en ese instante, así que necesita margen de sobra para leerse.
const FLOAT_MS_PLAYER = 1150;
const FLOAT_MS_COMPANION = 1750;

/**
 * Flotantes vivos ahora mismo.
 *
 * Los golpes automáticos caen uno por segundo y por compañero, así que con
 * varios activos se juntan varios números a la vez. Cuando se apilan encima unos
 * de otros ya no hay nada legible por muy larga que sea su duración: lo que
 * hace falta en ese caso es apurar, no esperar. El más viejo se retira antes
 * de crear el siguiente.
 */
const liveFloatingTexts: HTMLElement[] = [];
const MAX_FLOATING_TEXTS = 12;

/**
 * Texto flotante para clicks del jugador
 *
 * @param duration vida total en ms. La animación usa porcentajes, así que
 *   cualquier duración reparte las fases (pique / lectura / desvanecido) en la
 *   misma proporción; el elemento se retira al terminar la animación, nunca con
 *   un `setTimeout` aparte que pudiera desfasarse de ella.
 */
function showFloatingText(
  x: number,
  y: number,
  text: string,
  color: string = 'var(--accent)',
  duration: number = FLOAT_MS_PLAYER
) {
  while (liveFloatingTexts.length >= MAX_FLOATING_TEXTS) {
    liveFloatingTexts.shift()?.remove();
  }

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
    font-size: 16px;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
    z-index: 100;
    text-shadow: 0 0 10px ${color}, 0 0 2px ${color}, 0 1px 3px rgba(0, 0, 0, 0.9);
    animation: floatUp ${duration}ms linear forwards;
  `;
  // Lo engancha el CSS a `floatHold` cuando el sistema pide menos movimiento.
  el.setAttribute('data-float-text', '');
  document.body.appendChild(el);
  liveFloatingTexts.push(el);

  const remove = () => {
    el.remove();
    const i = liveFloatingTexts.indexOf(el);
    if (i !== -1) liveFloatingTexts.splice(i, 1);
  };
  // `animationend` es la fuente de verdad: el nodo se va cuando termina el
  // desvanecido, no cuando le da la gana a un temporizador aparte (que es como
  // se quedaba vivo un número ya invisible al cambiar la duración). El
  // `setTimeout` es solo la red de seguridad por si la animación no llegara a
  // terminar; `remove()` es idempotente, así que correr las dos no hace daño.
  el.addEventListener('animationend', remove, { once: true });
  window.setTimeout(remove, duration + 600);
}

// ==========================================================================
//  Golpe: la reaccion del recolector al recibir un impacto
// ==========================================================================

/**
 * Squash del boton: se hunde y vuelve con rebote.
 *
 * Va por la Web Animations API y no por una clase CSS a proposito. El boton
 * lleva `animate-core-breathe`, una animacion infinita sobre `transform`, y las
 * animaciones CSS ganan a las declaraciones normales: por eso el
 * `active:scale-95` de Tailwind no hacia nada, el boton no se hundia nunca al
 * pulsarlo. Una animacion creada con `element.animate()` entra despues en la
 * pila de animaciones y si manda sobre la anterior mientras corre; al terminar
 * devuelve el control a `coreBreathe`.
 *
 * El `easing` va por keyframe y no en las opciones de la animacion: cada tramo
 * lleva su curva. El hundimiento arranca de golpe (es el impacto), el rebote
 * sale disparado y frena, y el cierre es lineal para que no se note.
 */
interface HitKeyframe {
  transform: string;
  offset: number;
  easing?: string;
}

const HIT_SQUASH: HitKeyframe[] = [
  { transform: 'scale(1)', offset: 0, easing: 'cubic-bezier(0.2, 0, 0.4, 1)' },
  { transform: 'scale(0.9)', offset: 0.16, easing: 'cubic-bezier(0.2, 0.9, 0.35, 1)' },
  { transform: 'scale(1.07)', offset: 0.46, easing: 'ease-in-out' },
  { transform: 'scale(0.985)', offset: 0.72, easing: 'linear' },
  { transform: 'scale(1)', offset: 1 }
];

/** Onda expansiva: el anillo que se abre hacia fuera. */
const HIT_WAVE = [
  { transform: 'scale(0.72)', opacity: 0.85, offset: 0 },
  { transform: 'scale(1.12)', opacity: 0.4, offset: 0.4 },
  { transform: 'scale(1.5)', opacity: 0, offset: 1 }
];

/** El squash vivo, para poder cancelarlo si vuelve a llegar otro golpe. */
let squashAnimation: Animation | null = null;

/**
 * Ondas vivas, en-desuso-ya.
 *
 * Un golpe por segundo y por companero apilaria anillos sin limite si cada uno
 * crease su propio elemento, asi que se reciclan: el que ya se apago vuelve al
 * bolso y el siguiente golpe lo saca. Cuatro de sobra para que dos golpes
 * seguidos no se pisen nunca.
 */
const hitWaves: HTMLElement[] = [];

/**
 * Reaccion de golpe del recolector, para clicks del jugador y de los companeros.
 *
 * El jugador pega mas fuerte (`strength` 1) que un companero (0.62): un golpe
 * automatico por segundo no deberia sacudir el boton tanto como pulsarlo a
 * proposito.
 *
 * El anillo vive DENTRO del boton, no encima. Antes, el efecto expansivo
 * (`companionClick`) se pintaba sobre el recolector y con `z-index` 9999, justo
 * encima del "+X": el fondo translucido con glow se comia la cifra, que es lo
 * unico que decia cuanto trae el companero. Asi el "+X" vive en `body` con
 * `z-index: 100` y el anillo no lo toca nunca.
 *
 * Con `prefers-reduced-motion` se quita la onda y el squash se reduce a un
 * hundimiento corto y sin sobreimpulso (~0.03): el rebote y el anillo son
 * justo lo que ese ajuste pide quitar. El hundimiento se queda porque es la
 * unica confirmacion de que el click ha entrado, y no hay alternativa: el
 * `active:scale-95` del boton no sirve, `coreBreathe` lo pisa siempre. Menos
 * movimiento, no menos confirmacion.
 */
function playHitEffect(strength: number = 1) {
  const btn = document.querySelector('#click-btn');
  if (!btn) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) strength = Math.min(strength, 0.35);

  // --- Squash ---
  // `strength` aprieta el rebote hacia 1: el companionclick se queda en un
  // 0.93/1.04 suave y el del jugador baja a 0.9 y sube a 1.07.
  //
  // El easing global es `linear` a proposito. Con un `cubic-bezier` con rebote
  // hacia atras, el progreso se adelantaba tanto que la curva entera se
  // disparaba en el primer 40% de la duracion y el 60% restante se quedaba
  // quieto en 1: el golpe se veia a medias. Aqui el ritmo lo llevan los
  // `offset` de cada keyframe, que se traducen a milisegundos reales.
  //
  // Ojo al copiar `offset` en el `.map`: si se olvida, los cinco keyframes se
  // reparten en partes iguales (0/25/50/75/100) en vez de donde de verdad toca,
  // y el squash deja de hundirse al ritmo del golpe. Pasa igual con el
  // `easing` por keyframe, que tampoco sobrevive a un objeto nuevo.
  squashAnimation?.cancel();
  squashAnimation = btn.animate(
    HIT_SQUASH.map(k => ({
      transform: `scale(${(1 + (parseFloat(k.transform.slice(6)) - 1) * strength).toFixed(4)})`,
      offset: k.offset,
      easing: k.easing
    })),
    { duration: 240 + 80 * strength, easing: 'linear' }
  );

  if (reduceMotion) return;

  // --- Onda ---
  // Se reutiliza el mismo anillo para todos los golpes. Es un elemento sin
  // listeners y con la animacion controlada desde aqui, asi que reiniciarla es
  // cancelarla y volvarla a lanzar; no hay estado que limpiar entre golpes.
  let wave = hitWaves.pop();
  if (!wave) {
    wave = document.createElement('span');
    wave.setAttribute('aria-hidden', 'true');
    wave.className = 'hit-wave';
    // `prepend` y no `append`: el icono y el texto del boton son hermanos
    // posicionados, y entre ellos pinta el ultimo. Anadido al final, el anillo
    // se dibujaria encima del rayo; asi queda detras y solo se ve el borde.
    btn.prepend(wave);
  }
  wave.getAnimations().forEach(a => a.cancel());
  wave.animate(HIT_WAVE, {
    duration: 460 + 160 * strength,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
  });
  // Vuelve al pool cuando se apaga. El timeout va con margen de sobra: si la
  // animacion se perdiera (pestaña en segundo plano), el anillo se recicla igual
  // y no se queda a media luz en la pantalla.
  window.setTimeout(() => {
    if (hitWaves.length < 4) hitWaves.push(wave as HTMLElement);
  }, 700 + 160 * strength);
}

/**
 * Golpe automático de un compañero, dentro del recolector y en posición
 * aleatoria.
 *
 * Solo se pinta el número, nada más. Antes encima se dibujaba un círculo
 * expansivo (el keyframe `companionClick`): iba en el mismo punto, con
 * `z-index` 9999 y creciendo hasta 60px de diámetro, así que su fondo
 * translúcido con glow se comía el número de 14px que iba justo debajo. El
 * efecto se leía como un disparo en seco y la cifra — que es lo único que
 * dice cuánto trae ese compañero — se perdía. El número también sube: es la
 * misma señal que usa el clic del jugador, así que el golpe se lee sin aprender
 * nada nuevo y la posición aleatoria lo hace propio.
 */
function showCompanionClickInCollector(power: number) {
  const collector = document.querySelector('#click-btn');
  if (!collector) return;
  const rect = collector.getBoundingClientRect();

  const margin = 40;
  const x = rect.left + margin + Math.random() * (rect.width - margin * 2);
  const y = rect.top + margin + Math.random() * (rect.height - margin * 2);

  // Se queda en pantalla bastante más que el click del jugador: este número es
  // la única señal de cuánto trae el compañero y aparece solo, sin aviso.
  showFloatingText(x, y, `+${formatNumber(power)}`, 'var(--accent)', FLOAT_MS_COMPANION);
  // Mismo golpe que el del jugador, más suave. El número ya sube desde un punto
  // aleatorio, así que el recoil va en el botón: el efecto va en el recolector,
  // que es lo que ha recibido el golpe, no en el número.
  playHitEffect(0.62);
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
