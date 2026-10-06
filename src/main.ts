import { renderBuffHud, resetBuffHud, buffLabel } from './ui/buffHud';
import { setSkipRoulette } from './roulettePrefs';
import { setPatchNotes } from './patchNotesPrefs';
import { showPatchNotes, montarNotas } from './ui/patchNotes';
import { renderPanel } from './ui/playerPanel';
import { formatNumber } from './utils/format';
import './style.css';
import './style.modules.css';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { renderAuth } from './components/auth';
import { renderBloqueado, renderSesionOcupada, renderErrorDeCarga } from './components/blocked';
import { ponMiUid } from './ui/tarjetaAjena';
import { conTiempoLimite } from './utils/timeout';
import {
  anotarLatido, consultarSesion, idDeSesion, soltarSesion,
  REINTENTO_MS, VENTANA_MS
} from './services/sessionService';
import { consultarBloqueo } from './services/bloqueoService';
import { createGameLoop } from './gameLoop';
import type { BuffKey } from './data/buffs';
import { showToast, syncToastOffset } from './utils/toast';
import { renderWarehouseTab, pintarBarraDeConsumibles } from './components/warehouse';
import { renderRankings } from './components/rankings';
import { renderStoreTab } from './components/store';
import { renderForgePage } from './ui/forgePage';
import { renderProfilePage } from './ui/profilePage';
import { renderPrestigePage } from './ui/prestigePage';
import { Router, type Route } from './ui/router';

import { applyTheme, getSavedTheme, setTheme, THEMES, type ThemeName } from './theme';
import { showConfirmModal } from './utils/modal';
import {
  sfx, isSfxEnabled, isMusicEnabled, toggleMute, toggleMusic, primeAudio,
  setAudioSuspended, installAudioUnlock, onAudioStateChange
} from './utils/audio';
import { renderLayoutHTML } from './ui/layout';
import { updateResourceBar } from './ui/appHeader';
import { miniIdentity } from './ui/identity';
import { ic, icSafe } from './ui/icons';

const app = document.querySelector('#app') as HTMLElement;
let activeGameInstance: any = null;
let activeUser: any = null;
/**
 * Marca de la identidad parcheada en la cabecera (`#nav-identity`).
 *
 * Vive a nivel de módulo y no en `updateUI` porque tiene que sobrevivir a sus
 * propias llamadas: si fuera local, cada tick la vería vacía y reescribiría
 * el HTML dos veces por segundo. Se invalida al reconstruir la cabecera.
 */
let lastIdentityKey = '';const router = new Router();

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

/**
 * Que la delegacion de ajustes ya esta puesta.
 *
 * Un `addEventListener` acumula, y `initGame()` corre **otra vez** al volver a entrar:
 * sin este guarda, un jugador que cierra sesion y vuelve a entrar tendria dos
 * delegados, y con dos la hoja se abre y se cierra en el mismo clic y no se ve nada.
 * Es el bug de multiplicador par de esta misma funcion, que es el que ya se pago dos
 * veces aqui. Ver `instalaDelegacionDeAjustes()`.
 */
let ajustesDelegados = false;

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

// ==========================================================================
//  Logros: la cola de los que no tienen sitio donde enseñarse (B3)
// ==========================================================================
//
//  POR QUÉ ESTA COLA EXISTE. `showAchievementPopup` busca `#achievement-stack`
//  con `querySelector` y **si no está, se sale sin hacer ruido**. Ese contenedor lo
//  pinta `renderLayoutHTML`, que corre en el `requestAnimationFrame` siguiente a
//  que `createGameLoop` termine. A la hora del primer logro —que el motor evalúa
//  durante la carga, dentro del `await`— el `#app` todavía no tiene layout, así
//  que el cartel se descartaba. Por eso no hay ni un solo cartel de logro en
//  toda la partida, ni siquiera los que se detectan en vivo.
//
//  O sea: el cartel no estaba roto, estaba **sin sitio a tiempo**. Es un fallo de
//  cableado, y por eso ningún banco lo pilla: los bancos comprueban números, y
//  lo que falta aquí es que un callback llegue a un nodo que está en el documento.
//
//  QUÉ HACE LA COLA, Y POR QUÉ NO ES "SOLO PARA LA CARGA". Un logro detectado
//  durante la carga no se puede "enseñar luego": el jugador entra y a los cinco
//  segundos le aparece un cartel de algo que pasó antes de que estuviera mirando,
//  y eso confunde más que no avisar. Se vacía en cuanto el layout existe, que es
//  el primer fotograma, así que el retraso es imperceptible y el aviso está donde
//  tiene que estar.
//
//  Y el tope es el de siempre, tres: la cola desemboca en la misma pila que los
//  avisos en vivo, así que hereda su tope sin tener uno propio.
const logrosPendientes: { title: string; description: string; icon: string; rewardText: string }[] = [];

/** Vacía la cola en cuanto hay dónde enseñarla. Idempotente. */
function vaciarLogrosPendientes() {
  const stack = document.querySelector('#achievement-stack') as HTMLElement | null;
  if (!stack) return;
  while (logrosPendientes.length > 0) {
    showAchievementPopup(logrosPendientes.shift()!);
  }
}

// Aviso de logro desbloqueado. Va abajo al centro, por encima de la barra de
// navegación, y se apila si llegan varios seguidos en el mismo segundo.
function showAchievementPopup(achievement: { title: string; description: string; icon: string; rewardText: string }) {
  const stack = document.querySelector('#achievement-stack') as HTMLElement | null;
  if (!stack) {
    // Sin layout todavía: se anota y se enseña en cuanto exista (B3).
    // El sonido NO se reproduce aquí a propósito. Un logro que se anuncia al
    // llegar a la aplicación es un ruido en mitad de otra cosa; el aviso visual
    // sí tiene sentido, porque el jugador ya está mirando la pantalla.
    logrosPendientes.push(achievement);
    return;
  }

  sfx.achievement();

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
      // F49 · LAS NOTAS DE PARCHE, AL ENTRAR Y NO EN CADA NAVEGACIÓN.
      //
      //  Va aquí y no en `renderRoute()` porque "al entrar al juego" es un momento y
      //  una navegación no lo es: en la base, en el almacén y en el Perfil no sale nada,
      //  y aunque la marca de "ya visto" lo taparía, un cartel que se pide en cada
      //  navegación es un cartel que depende de dónde está el jugador.
      //
      //  Y **después de `initGame()`**, para que la pantalla de juego ya esté montada
      //  detrás del cartel: una nota de parche sobre la pantalla de acceso sería un
      //  aviso de lo que todavía no se puede usar.
      showPatchNotes();
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
 * F23 · RECLAMAR LA SESIÓN, O EXPLICAR POR QUÉ NO SE PUEDE.
 *
 * Tres cosas, en este orden, y el orden es lo que evita los dos fallos
 * contrarios:
 *
 *  1. **Pregunta** si hay otra sesión con un latido reciente. Si no la hay, la
 *     cuenta está libre y no hay nada que explicar.
 *  2. **Reclama** escribiendo el latido de esta pestaña. Se hace DESPUÉS de la
 *     pregunta y no antes a propósito: si se anotara primero, una pestaña nueva
 *     taparía el latido de la que está jugando y el bloqueo no se detectaría
 *     nunca —que es el fallo que un "escribir y ya" trae consigo.
 *  3. **Vuelve a preguntar** para confirmar que el latido ahora es el nuestro.
 *     Con dos pestañas que abren en el mismo instante las dos pueden pasar el
 *     punto 1, y esta segunda pregunta es la que resuelve cuál se queda con la
 *     cuenta. Es la parte que hace que la promesa "una sola sesión" sea verdad y
 *     no "casi siempre".
 *
 * Cuando está ocupada se pinta la pantalla y se **queda mirando sola**: no se
 * deja al jugador recargando a mano, porque la otra sesión se libera en menos de
 * un minuto y recargar es exactamente lo que le pediríamos que hiciera.
 *
 * `bloqueadoEnCurso` es el mismo guard que usa la suspensión de cuentas: si la
 * cuenta está bloqueada, esta pantalla no tiene que taparla.
 */
async function ocuparSesion(uid: string, nombre: string): Promise<boolean> {
  if (bloqueadoEnCurso) return false;

  const miId = idDeSesion();

  const antes = await consultarSesion(uid, miId);
  if (antes.ocupada) return esperarSesion(uid, nombre, miId, antes.latido);

  await anotarLatido(uid, miId);

  const despues = await consultarSesion(uid, miId);
  if (despues.ocupada) {
    // Perdimos la carrera contra otra pestaña. Se suelta el latido que acabamos
    // de escribir para no dejar dos latidos-patrón, y se espera a que la otra
    // sesión seLibere.
    await soltarSesion(uid, miId);
    return esperarSesion(uid, nombre, miId, despues.latido);
  }

  mantenerLatido(uid, miId);
  return true;
}

/**
 * La sesión está ocupada: se enseña por qué y se reintenta solo.
 *
 * El temporizador no es un detalle de conveniencia: es lo que convierte "no
 * puedes entrar ahora" en "espera medio minuto y entra". Y el tiempo que se
 * enseña se calcula sobre el reloj que realmente decide —cuánto queda para que
 * expire el latido ajeno—, no sobre uno inventado.
 */
function esperarSesion(uid: string, nombre: string, miId: string, latidoAjeno: number): Promise<boolean> {
  const queda = Math.max(0, VENTANA_MS - (Date.now() - latidoAjeno));

  return new Promise<boolean>((resolve) => {
    let intentos = 0;
    console.info('[sesion] La partida esta abierta en otro sitio; esperando.');

    const probar = async () => {
      const estado = await consultarSesion(uid, miId);
      if (!estado.ocupada) {
        await anotarLatido(uid, miId);
        limpiarPantallaOcupada();
        mantenerLatido(uid, miId);
        console.info('[sesion] La otra sesion se ha liberado; entrando.');
        resolve(true);
        return;
      }
      // Cada consulta acorta el reloj del enemigo: se le ve el pulso.
      pintarSesionOcupada(uid, nombre, miId, estado.latido);
      intentos++;
      if (intentos > 40) {
        // Se ha esperado más de ocho minutos. Se entra igualmente: es preferible
        // el riesgo de una carrera a dejar al jugador fuera sin salida.
        console.warn('[sesion] Se haesperado demasiado; se entra igualmente.');
        limpiarPantallaOcupada();
        resolve(true);
      }
    };

    const espera = Math.max(1500, Math.min(REINTENTO_MS, queda));
    setTimeout(probar, espera);
    setTimeout(() => { void probar(); }, REINTENTO_MS);
    const id = setInterval(() => { void probar(); }, REINTENTO_MS);
    // El intervalo se para en cuanto se resuelve, para no dejar un temporizador
    // vivo detrás de la pantalla.
    const parar = () => clearInterval(id);
    const observador = new MutationObserver(() => {
      if (document.querySelector('#reintentar-sesion')) return;
      parar();
      observador.disconnect();
    });
    observador.observe(document.body, { childList: true, subtree: true });
    pintarSesionOcupada(uid, nombre, miId, latidoAjeno);
  });
}

function pintarSesionOcupada(uid: string, nombre: string, miId: string, latidoAjeno: number) {
  const app = document.getElementById('app');
  if (!app) return;
  const queda = Math.max(0, VENTANA_MS - (Date.now() - latidoAjeno));
  renderSesionOcupada(app, { nombre, alLiberarMs: queda }, () => {
    // El botón reintenta YA, sin esperar al temporizador: si el jugador ha
    // cerrado la otra ventana, quiere entrar en este momento.
    void consultarSesion(uid, miId).then(async (e) => {
      if (e.ocupada) return;
      await anotarLatido(uid, miId);
      limpiarPantallaOcupada();
      mantenerLatido(uid, miId);
      if (activeUser) await initGame(activeUser, resolvedUsername || undefined);
    });
  });
}

function limpiarPantallaOcupada() {
  // No se borra el contenido a pelo: `initGame` se encarga de pintar el juego.
  // Lo único que se quita es la pantalla para que no quede detrás del layout.
  document.querySelector('#reintentar-sesion')?.closest('.auth-scene')?.remove();
}

/**
 * Mantiene vivo el latido mientras esta pestaña juega.
 *
 * Se refresca a MENOS de la mitad de la ventana de expiración, para que un
 * `setTimeout` que se retrase —una pestaña en segundo plano, un móvil que
 * congela JavaScript— no llegue a dejar el latido caducado y a perder la
 * cuenta. Y al descargar la página se suelta, para no esperar a que expire.
 */
/**
 * Cada cuánto se refresca el latido mientras se está jugando.
 *
 * **LA MITAD DE LA VENTANA, Y NO UN TERCIO.** Con la ventana en 45 s, refrescar cada
 * 15 s eran tres refrescos por ventana; 22 s son dos, y es el mínimo que sigue
 * distinguiendo "esta pestaña viva" de "la otra se ha ido" sin quedarse sin margen. La
 * comprobación que importa es la del **arranque** —"¿hay otra sesión con un latido
 * reciente?"—, y para eso basta con que el latido propio no envejezca más que la ventana.
 *
 * Y es una escritura de las que cuentan para la cuota, que es compartida por todo el
 * proyecto: un tercio de las escrituras del juego eran solo para mantener vivo un
 * reloj que el propio jugador no ve.
 */
function mantenerLatido(uid: string, miId: string) {
  const refresco = setInterval(() => { void anotarLatido(uid, miId); }, Math.floor(VENTANA_MS / 2));

  const soltar = () => {
    clearInterval(refresco);
    void soltarSesion(uid, miId);
  };
  window.addEventListener('pagehide', soltar);
  window.addEventListener('beforeunload', soltar);
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

  // F23 · Y lo mismo con la sesión: si la partida ya está abierta en otro
  // dispositivo u otra pestaña, los dos se pisan la partida. Se comprueba ANTES
  // de `initGame` por la misma razón que el bloqueo —no hay ni un frame de juego
  // con dos sesiones—, y también ANTES de anotar el latido, que si no
  // sobreescribiría el de la sesión que ya está jugando.
  if (!(await ocuparSesion(user.uid, nombre))) return;

  // **AQUI ESTABA EL AGUJERO QUE DEJABA LA PANTALLA EN NEGRO.** El arranque era una
  // cadena de `await` sin un solo `catch`: cualquier fallo --sin red, cuota de Firestore
  // agotada, un dato del documento que no se puede migrar--iba al `catch` del motor,
  // que escribia una linea en la consola, y el `await` de aqui se resolvia igual. El
  // jugador se quedaba con un `#app` vacio y sin una palabra: ni error, ni boton, ni
  // una pista de que el navegador no era el culpable.
  //
  // El `catch` esta DESPUES de `ocuparSesion` a proposito: si la sesion esta ocupada,
  // `ocuparSesion` ya ha pintado su pantalla y no hay nada que avisar.
  try {
    await conTiempoLimite(initGame(user, nombre), PLAZO_DE_ARRANQUE_MS, 'el arranque');
  } catch (e) {
    mostrarFalloDeCarga(e);
  }
});

/**
 * El arranque ha fallado: se dice qué ha pasado y se ofrece reintentar.
 *
 * **NO ES ADORNAR UN ERROR, ES EVITAR UN DAÑO.** El motor deja el guardado
 * deshabilitado cuando la carga falla —`cargaFallida()`—, precisamente para que esto
 * no pueda dejar al jugador jugando de mentira con una partida en blanco. Si aqui se
 * hiciera un `console.error` y ya esta, la pantalla seguiria vacia y el jugador no
 * sabria si su progreso sigue a salvo.
 */
function mostrarFalloDeCarga(error: unknown) {
  const app = document.querySelector('#app') as HTMLElement | null;
  if (!app) return;
  renderErrorDeCarga(app, error, () => { window.location.reload(); });
}

/**
 * Cuánto se espera a que la partida se monte antes de decir que no se ha podido.
 *
 * **VEINTICINCO SEGUNDOS, Y POR QUÉ EL ARRANQUE NECESITABA UN RELOJ.**
 *
 * Con la cuota de Firestore agotada el servidor no contesta con un error: contesta
 * "Using maximum backoff delay", que significa "todavía no". **La promesa no se rechaza
 * nunca**, así que el `catch` de abajo no saltaba y el `await` no terminaba nunca: el
 * juego se quedaba con el `#app` vacío **para siempre**, sin un solo error que contar.
 *
 * Veinticinco segundos es mucho más que arrancar de verdad —que lleva un par de segundos—
 * y muy poco para alguien mirando una pantalla en blanco. Y cuando se pasa, lo que se
 * enseña es el aviso con su botón de reintentar, que recarga la página entera: es lo
 * único que corta la petición colgada, porque **el reloj no cancela nada**, solo decide
 * cuándo dejamos de esperar.
 */
const PLAZO_DE_ARRANQUE_MS = 25_000;

async function initGame(user: any, username?: string) {
  // **EL UID DE QUIÉN ESTÁ MIRANDO, Y POR QUÉ SE PONE AQUÍ Y NO EN EL RANKING.**
  // El contador de visitas es lo único que necesita saber quién eres, y la regla de
  // "no te cuentes a ti mismo" está en `registrarVisita()`. Que el uid esté en un solo
  // sitio de módulo significa que **no puede quedarse viejo en dos*: si lo leyera el
  // ranking de otra manera, un día una de las dos se quedaría sin poner y
  // acabarías contándote a ti mismo sin que nadie lo notara.
  ponMiUid(user?.uid ?? '');
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
    // **UNA SOLA VEZ, AQUÍ, Y NO EN CADA `renderRoute()`.** Es un
    // `addEventListener`, así que llamarlo otra vez añadiría otro manejador: la hoja se
    // abriría y cerraría tantas veces como hubs, y con un número par el jugador no vería
    // nada. Va antes del primer render porque no depende del DOM: busca el nodo en el
    // momento del clic, no lo guarda.
    instalaDelegacionDeAjustes();
    renderRoute(router.current);
    startCompanionClicks(activeGameInstance);
    // B3 · El layout ya está montado, así que los logros que el motor evaluó
    // durante la carga ya tienen dónde enseñarse. Va DESPUÉS de `renderRoute`
    // porque es `renderRoute` la que pinta el `#achievement-stack`; si fuera
    // antes, la cola se volvería a llenar y no se vaciaría nunca.
    vaciarLogrosPendientes();
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
/**
 * Repinta los dos botones de audio con el estado real.
 *
 * Se llama tras cada cambio de estado y **no** re-renderiza la vista entera: un
 * re-render destruye el HUD de buffs y las escuchas del click del recolector, y perderse
 * eso por cambiar un icono no compensa.
 *
 * ## POR QUE ESTA EN EL AMBITO DEL MODULO Y NO DENTRO DE `renderBase`
 *
 * Porque la llamaban los dos interruptores, y como solo se llamaba en la base, cambiar la
 * musica desde el almacen no repintaba el boton: **el estado de audio y lo que se veian
 * dejaban de ser la misma cosa en seis de las siete pantallas**. Una funcion que decide
 * como se ve un estado tiene que estar donde el estado vive, y el estado no es de la
 * base.
 *
 * Y hay una sola funcion que decide como se ve cada estado: cuando el estado se pintaba
 * en dos sitios --el HTML de `layout.ts` y el manejador del toggle-- cualquier cambio de
 * estilo tenia que hacerse dos veces, y ya se habia desincronizado: el boton de musica
 * nunca cambiaba de icono.
 */
function paintAudioButtons() {
  const music = isMusicEnabled();
  const sfxOn = isSfxEnabled();

  // **EL FORMATO DE AQUI TIENE QUE SER EL DE LA HOJA, Y ANTES NO LO ERA.** Estos dos
  // botones quedaban en la cabecera con clases de boton de icono --w-9, texto oculto en
  // movil-- y esta funcion los repintaba con esas mismas clases. Al moverlos a la hoja,
  // que usa otros, este pintor habria seguido escribiendo las de la cabecera encima: el
  // interruptor se veria diminuto dentro de una celda de la rejilla y el texto nunca
  // apareceria.
  //
  // Es el mismo motivo por el que el marcado **no** deberia estar en las dos: el que esta
  // aqui y el que escribe `settingsSheetHTML()` tienen que decir lo mismo, y por eso los
  // dos estan en este fichero y a la vista.
  const PINTAR = 'h-11 rounded-lg btn-ghost text-[11px] font-mono cursor-pointer' +
    ' flex items-center justify-center gap-1.5 transition-colors';

  const musicBtn = document.querySelector('#music-btn');
  if (musicBtn) {
    musicBtn.innerHTML =
      `<span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic(music ? 'music' : 'mute')}</span>` +
      `<span>${music ? 'Música' : 'Música off'}</span>`;
    musicBtn.className = PINTAR + (music ? ' text-[var(--text-main)]' : ' text-[var(--text-muted)] opacity-70');
    musicBtn.setAttribute('aria-pressed', String(music));
    musicBtn.setAttribute('aria-label', music ? 'Apagar música' : 'Encender música');
  }

  const sfxBtn = document.querySelector('#mute-btn');
  if (sfxBtn) {
    sfxBtn.innerHTML =
      `<span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic(sfxOn ? 'sound' : 'mute')}</span>` +
      `<span>${sfxOn ? 'Efectos' : 'Efectos off'}</span>`;
    sfxBtn.className = PINTAR + (sfxOn ? ' text-[var(--text-main)]' : ' text-[var(--text-muted)] opacity-70');
    sfxBtn.setAttribute('aria-pressed', String(sfxOn));
    sfxBtn.setAttribute('aria-label', sfxOn ? 'Silenciar efectos' : 'Activar efectos');
  }
}

/**
 * ABRE Y CIERRA LA HOJA DE AJUSTES, Y ESTE LISTENER SOBREVIVE A LOS CAMBIOS DE RUTA.
 *
 * ## POR QUÉ ESTÁ FUERA DEL `app.onclick` DE LA BASE
 *
 * Porque `renderRoute()` hace `app.onclick = null` en cada cambio de ruta y solo
 * `renderBase()` vuelve a ponerlo. Con la apertura de la hoja declarada ahí dentro, el
 * botón de ajustes —que la cabecera pinta en las siete pantallas desde que la hoja se
 * movió fuera de la cabecera— **se veía en todas y solo respondía en la base**. Se vio
 * así, jugando.
 *
 * ## POR QUÉ UN `addEventListener` Y NO OTRA ASIGNACIÓN DE `onclick`
 *
 * Porque `renderBase()` se llama en cada vuelta a la base, y ahí un `onclick` se
 * reasigna y no se acumula —mientras que un `addEventListener` sí. Al revés de lo que
 * pasa con el resto de las pantallas, que se limpian creando un nodo nuevo. Por eso esta
 * función se llama **una vez, al arrancar**, y no desde `renderRoute()` ni desde
 * `renderBase()`: si se llamara en cada render, a los cuatro clics habría cuatro
 * manejadores, la hoja se abriría y cerraría cuatro veces y no se vería nada. Con un
 * número par el síntoma es "no hace nada", que es lo mismo que el bug que arregla.
 *
 * ## Y POR QUÉ BUSCA EL NODO EN EL MOMENTO DEL CLIC
 *
 * Porque la hoja **se reconstruye con cada vista**: el nodo que había en la base no es
 * el que hay en el almacén. Guardar la referencia en una variable es exactamente el
 * fallo que hace que el botón deje de responder al cambiar de sector.
 *
 * Y `data-cerrar-ajustes` y `data-abrir-ajustes` salen del mismo `closest()`, porque los
 * dos botones y el fondo del diálogo comparten atributo y no hay nada más que consultar.
 */

function instalaDelegacionDeAjustes() {
  if (ajustesDelegados) return;
  ajustesDelegados = true;

  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // ---------------------------------------------------------------------------------
    //  LOS INTERRUPTORES DE AUDIO, Y POR QUÉ ESTABAN EN EL `onclick` DE LA BASE
    // ---------------------------------------------------------------------------------
    //
    // **ESTOS BOTONES NO RESPONDÍAN FUERA DE LA BASE, Y NO ES UN CASO RARO: son seis de
    // las siete pantallas.** El abrir, el cerrar y el tema se movieron aquí hace un rato
    // porque tenían este mismo fallo, y **los tres que quedaban detrás se quedaron**:
    // música, efectos y cerrar sesión. Los dos interruptores se veían, se pulsaban y no
    // pasaba nada, porque `renderRoute()` hace `app.onclick = null` en cada cambio de
    // ruta y el manejador que los atendía solo existía en la base.
    //
    // Y hay una segunda mitad que es la que más cuesta ver: **aunque el clic llegara, el
    // icono no se repintaría**, porque `paintAudioButtons()` estaba como función local de
    // `renderBase()` y su suscripción estaba en `audioUnsubscribers`, que
    // `renderRoute()` limpia en cada ruta. Es decir: el estado de audio y lo que se veía
    // solo cuadraban juntos en la base.
    //
    // `primeAudio()` va antes del toggle y por el motivo de siempre: **el AudioContext no
    // se puede crear sin un gesto del usuario**, y un toggle que lo crea después de un
    // `await` nace suspendido para siempre. El preview ya lo hacía — por eso allí sí
    // funcionaba — y aquí no.
    const audioBtn = target.closest('[data-audio]') as HTMLElement | null;
    if (audioBtn) {
      e.preventDefault();
      primeAudio();
      if (audioBtn.dataset.audio === 'music') toggleMusic();
      else toggleMute();
      return;
    }

    if (target.closest('[data-logout]')) {
      e.preventDefault();
      void doLogout();
      return;
    }

    if (target.closest('[data-cerrar-ajustes]')) {
      e.preventDefault();
      // **EL NODO SE BUSCA AQUÍ Y NO SE GUARDA.** Ver el párrafo de arriba: la hoja se
      // reconstruye en cada vista y una referencia guardada apunta al nodo viejo, que ya
      // no está en el documento. Con una referencia, el botón funcionaba en la base —la
      // primera vez— y en ningún otro sitio.
      document.querySelector('[data-ajustes]')?.classList.add('hidden');
      return;
    }
    if (target.closest('[data-abrir-ajustes]')) {
      e.preventDefault();
      sfx.nav();
      document.querySelector('[data-ajustes]')?.classList.remove('hidden');
      return;
    }

    // **VER LAS NOTAS, POR DELEGACIÓN COMO TODO LO DEMÁS DE LA HOJA.** El nodo se
    // busca aquí y no se guarda, por el mismo motivo que el de más arriba: la hoja se
    // reconstruye en cada vista y una referencia apuntaría al nodo viejo.
    //
    // **SE ABRE POR ENCIMA DE LA HOJA, Y NO SE CIERRA ESTA.** Las notas son un cartel
    // con z-70 y la hoja de ajustes z-80, así que si se dejara la hoja abierta el cartel
    // saldría debajo y no se vería nada. Cerrarla primero es lo que hace que el botón
    // funcione desde las siete pantallas en vez de solo desde la primera.
    if (target.closest('[data-ver-notas]')) {
      e.preventDefault();
      sfx.nav();
      document.querySelector('[data-ajustes]')?.classList.add('hidden');
      montarNotas();
      return;
    }

    // **EL TEMA TAMBIÉN POR DELEGACIÓN, Y POR EL MISMO MOTIVO QUE EL RESTO.**
    //
    // Los botones de tema tenían un `addEventListener` por nodo, ligado en `renderBase()`:
    // en la base funcionaban, y en las otras seis pantallas no, porque esos nodos **no
    // existían** cuando se ligaron y la hoja se reconstruye en cada vista. Con la hoja
    // abierta desde el almacén, los seis temas eran seis botones muertos.
    //
    // El marcado del botón elegido lo repinta quien cambia, y **solo el que está
    // elegido**: los demás solo cambian de color al perder el borde, y eso lo hace el
    // mismo recorrido.
    const tema = target.closest('[data-theme-option]') as HTMLElement | null;
    if (tema) {
      e.preventDefault();
      setTheme(tema.getAttribute('data-theme-option') as ThemeName);
      const activo = THEMES.find((t: any) => t.value === getSavedTheme());
      document.querySelectorAll('[data-theme-option]').forEach((otro) => {
        (otro as HTMLElement).style.cssText = otro.getAttribute('data-theme-option') === getSavedTheme()
          ? `border-color:${activo?.tone};color:${activo?.tone}`
          : '';
      });
    }
  });

  // -------------------------------------------------------------------------------------
  //  EL REPARTO DE LOS INTERRUPTORES, Y POR QUÉ ESTÁ FUERA DE `audioUnsubscribers`
  // -------------------------------------------------------------------------------------
  //
  // `clearAudioUnsubscribers()` existe para soltar a los suscriptores que **apuntan al
  // DOM de la vista anterior** — el del sonido del click del recolector, que es lo único
  // que había — y `renderRoute()` lo llama en cada cambio de ruta. Este no apunta a nada de
  // eso: `paintAudioButtons()` busca `#music-btn` y `#mute-btn` **en el momento de
  // pintarlos**, y si no están no hace nada.
  //
  // Meterlo en ese conjunto sería devolver el bug por la puerta de atrás: en el almacén el
  // suscriptor ya no existiría, que es exactamente la mitad del fallo que se acaba de
  // corregir. Vive al lado de la delegación, que es donde puede vivir: **una vez por
  // sesión, mirando el nodo en el momento**, igual que el resto de lo de la hoja.
  onAudioStateChange(paintAudioButtons);
  paintAudioButtons();
}

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

  const go = (r: Route) => {
    sfx.nav();
    router.goTo(r);
    renderRoute(router.current);
  };

  switch (route) {
    case 'base':
      renderBase(go);
      break;
    case 'almacen':
      renderWarehouseTab(app, activeGameInstance, () => {
        updateUI(activeGameInstance.getState(), activeGameInstance.isAfk());
      }, go);
      break;
    case 'forja':
      renderForgePage(app, activeGameInstance, go);
      break;
    case 'tienda':
      renderStoreTab(app, activeGameInstance, go);
      break;
    case 'perfil':
      renderProfilePage(app, activeGameInstance, () => go('prestigio'), go);
      break;
    case 'ranking':
      // El estado va aparte: `activeUser` es el usuario de Firebase y no lleva la partida.
  // La firma lo dice y el comentario de `renderRankings` explica por qué.
  renderRankings(app, activeUser, go, activeGameInstance?.getState?.());
      break;
    case 'prestigio':
      renderPrestigePage(app, activeGameInstance, go);
      break;
  }

  // Los avisos flotantes se colocan midiendo el borde inferior de la cabecera, y
  // la cabecera es distinta en cada vista (y le crece una fila con los buffs).
  // Aquí se recolocan al terminar de montar, no cuando ya esté un aviso en
  // pantalla: un aviso que sale durante el `app.innerHTML = ''` se quedaría
  // pegado a la esquina.
  syncToastOffset();
}

/** Vista principal: el recolector, el escuadrón y la navegación. */
function renderBase(onNavigate: (r: Route) => void) {
  const game = activeGameInstance;
  const user = activeUser;

  app.innerHTML = renderLayoutHTML(user, getSavedTheme(), router.current, {
    onNavigate,
    onLogout: () => void doLogout(),
    onToggleMute: () => toggleMute(),
    onToggleMusic: () => toggleMusic(),
    onThemeChange: (theme) => setTheme(theme as ThemeName)
  }, {
    name: activeGameInstance?.getDisplayName?.() ?? user.displayName ?? 'Operativo',
    cosmetics: activeGameInstance?.getState?.()?.cosmetics
  }, activeGameInstance?.getState?.());
  // La cabecera se reconstruye: la marca de la identidad parcheada ya no vale.
  lastIdentityKey = '';

  // --- Navegación y controles: delegación en el contenedor, no por botón ---
  // Con un solo listener en `app` todos los botones `data-nav` funcionan sin
  // registrar nueve manejadores distintos cada vez que se monta la vista.
  app.onclick = (e) => {
    const target = e.target as HTMLElement;

    const nav = target.closest('[data-nav]') as HTMLElement | null;
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

    // Lo que entró lo dice el motor. Antes se deducía restando dos lecturas del
    // estado (`antes` y `después`), y esa resta no es un número que exista en
    // ningún sitio: si entre las dos entraba un cobro del pasivo, el "+N"
    // incluía dinero de otro origen. El motor ya sabe cuánto cobró y lo
    // devuelve, así que aquí no hay nada que recalcular (R1, R3).
    const collected = game.click();

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

  // ---- Hoja de ajustes ----
  //
  // **AQUI NO HAY NADA, Y ANTES HABIA DOS COSAS.** Abrir y cerrar la hoja, y el
  // selector de tema, estaban los dos en la base y los dos fallaban en las otras seis
  // pantallas: el boton se veia en todas y solo respondia en una, y los seis temas
  // eran seis botones muertos en cuanto abrias la hoja desde el almacen.
  //
  // Los dos tenian la misma causa y por eso los dos estan ahora en
  // `instalaDelegacionDeAjustes()`: `renderRoute()` hace `app.onclick = null` en cada
  // cambio de ruta, asi que lo declarado aqui solo vivia en la base; y los
  // `addEventListener` por nodo se ligaban contra nodos que la siguiente vista
  // destruye. Esa funcion se llama una vez al arrancar y busca los nodos en el momento
  // del clic.
  //
  // **Y LA HOJA NO SE DESMONTA**: se le quita y se le pone `hidden`. Eso es lo que
  // permite que `paintAudioButtons()` encuentre `#music-btn` y `#mute-btn` por id
  // despues de haber cambiado el estado; si se quitara del DOM, los interruptores se
  // quedarian con el icono de antes de apagarlos.
  //
  // El tema se aplica **sin cerrar** la hoja, al reves que antes. Antes el panel de
  // movil se cerraba al elegir, y eso obligaba a reabrirlo para ver el siguiente:
  // cambiar el tema probando cuatro es un bucle, no una decision.

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

  // Los clicks del árbol que el motor ya ha cobrado y que aún no se han
  // enseñado. Se vacían aquí, que es el único sitio que repinta en cada tick.
  //
  // POR QUÉ NO SE PINTAN EN EL SITIO QUE LOS COBRA. El tick no sabe dónde está
  // el recolector ni si el jugador lo está mirando, y el "+N" necesita las dos
  // cosas. La cifra, en cambio, la sabe el motor y llega en el evento: si se
  // calculara aquí, estaríamos pintando un número que el motor ya aplicó, que
  // es la forma más fácil de volver a tener dos verdades.
  if (activeGameInstance && typeof activeGameInstance.drainClickEvents === 'function') {
    for (const evento of activeGameInstance.drainClickEvents()) {
      showCompanionClickInCollector(evento.cantidad);
    }
  }

  // El saldo de nanitas vive en varios sitios según la vista, y solo se
  // refrescaba el de la base. Los otros se pintaban una vez al montar la página
  // y se quedaban congelados: en el almacén, que es donde se vende y se sube de
  // nivel, el precio se decidía contra una cifra vieja mientras el ingreso
  // pasivo seguía subiendo; en el mercado, directamente no se podía saber si
  // algo era asequible.

  //
  // AHORA ES UNA FRANJA EN LA CABECERA, Y NO UNA LISTA DE CINCO IDENTIFICADORES.
  //
  // Antes, el saldo de nanitas se pintaba en cinco sitios con cinco ids distintos y
  // `updateUI` llevaba la lista escrita a mano. Añadir un contador obligaba a tocar
  // dos ficheros, y olvidar el segundo se colgaba de un saldo congelado: no lanza error,
  // la cifra simplemente deja de moverse, y eso es el peor tipo de fallo porque
  // parece un saldo que no cambia por diseño.
  //
  // Ahora `updateResourceBar()` busca por atributo `data-res-val`, así que **la lista
  // está en el HTML que se pinta** y no puede quedar desfasada, porque no hay lista que
  // desfasar. Y los tres saldos viajan juntos, que es lo que hace falta para decidir
  // una compra sin leer dos sitios.
  updateResourceBar(state);

  // La cifra grande de la base sigue siendo un nodo propio, y por un motivo que no es
  // nostalgia: **es la métrica principal del incrementador**, el número que crece cuando
  // el jugador hace clic, y por eso va a 32 px en el centro de la pantalla en vez de en
  // una franja. La cabecera es donde se consultan los saldos; la base sigue teniendo su
  // cifra protagonista. Lo que ya no hay es una *segunda* etiqueta de "NANITAS" al lado
  // de la misma cifra, que era lo que obligaba a leer el mismo saldo dos veces.
  const nanitesValue = formatNumber(state.nanites || 0);
  if (nanitesCounter) nanitesCounter.textContent = nanitesValue;

  const now = Date.now();
  const passiveBuffRemaining = Math.max(0, state.buffs.passiveBoostExpiresAt - now);
  const hasPassiveBuff = passiveBuffRemaining > 0;

  // B10 · La pausa se ve y el botón se para, con la MISMA expresión que deja
  // el contador en +0/s (más abajo). Si el cartel usara otra cuenta, habría
  // dos verdades: cartel diciendo "en pausa" con el número cobrando, o número
  // a cero sin cartel. Así cartel, botón y número van siempre juntos.
  const parado = isAfk && !hasPassiveBuff;
  const afkBanner = document.querySelector('#afk-banner');
  if (afkBanner) {
    afkBanner.classList.toggle('hidden', !parado);
    afkBanner.classList.toggle('flex', parado);
  }
  // El atributo va en el contenedor y no en el botón: el CSS para la
  // animación con una regla (`#app[data-afk] #click-btn`), y en las vistas
  // sin botón no pasa nada porque la regla no encuentra a quién aplicarse.
  // Sin `toggle` con segundo argumento no hay forma de que se quede
  // desincronizado: el atributo siempre dice lo mismo que el cartel.
  app.dataset.afk = parado ? 'true' : 'false';

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

  // **LA BARRA DE CONSUMIBLES SE REPINTA AQUÍ, Y NO AL MONTAR LA PÁGINA.**
  //
  // Su contenido depende de lo que hay en el almacén, y el almacén cambia en cada guardado.
  // Una barra dibujada solo al entrar enseñaría un consumible que ya gastaste y escondería
  // uno que acaba de caer de una caja. Va al lado del `#prestige-hint` porque los dos son lo
  // mismo: un dato de la partida que hay que ver sin abrir su página.
  //
  // El repintado que le pasa es el de la base, así que usarlo redibuja la base entera. **No
  // se puede pasar el de la página del almacén**: esa sigue montada debajo y su propio redraw
  // se encargaría de lo suyo cuando vuelva a ella.
  if (activeGameInstance) {
    pintarBarraDeConsumibles(activeGameInstance, () => updateUI(state));
  }

  renderBuffHud(state, now);

  // La identidad de la cabecera (F16): avatar con marco + título equipado. Se
  // parchea en caliente al cambiar, sin reconstruir la cabecera —equipar desde
  // el Perfil no navega, así que sin esto el marco nuevo saldría al cambiar
  // de vista—. Solo se toca si algo cambió: reescribir el HTML en cada tick
  // recrearía el DOM dos veces por segundo para nada (R7).
  const navIdentity = document.querySelector('#nav-identity');
  if (navIdentity && activeGameInstance) {
    const nombre = activeGameInstance.getDisplayName?.() ?? state.displayName ?? 'Operativo';
    const cos = state.cosmetics ?? {};
    const clave = [activeUser?.uid ?? '', nombre, cos.title ?? '', cos.frame ?? '', cos.banner ?? ''].join('|');
    if (clave !== lastIdentityKey) {
      lastIdentityKey = clave;
      navIdentity.innerHTML = miniIdentity(nombre, cos, {
        hideDefaultTitle: true,
        nameClass: 'font-[\'Orbitron\'] font-bold text-[13px] md:text-sm accent-text truncate leading-tight mt-0.5'
      });
    }
  }

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
  // Lo que aporta cada compañero, con los multiplicadores ya puestos y el
  // reparto justo. Sin esto la ficha pintaría `comp.power`, que es el valor
  // desnudo y no el que entra en la cuenta.
  const ingresoDe = typeof activeGameInstance?.getCompanionOutput === 'function'
    ? (id: string) => activeGameInstance.getCompanionOutput(id)
    : undefined;
  // El desglose del daño también lo da el motor, partido en base, nivel y bonos.
  // La vista no lo deduce restando: si lo hiciera, un buff que expirara entre el
  // pintado y la lectura haría que las partes no sumaran el total, que es
  // justo el descuadre que esto viene a arreglar.
  // **Y LAS DOS PARTES DEL DAÑO**, que es lo que permite pintar "30+5": lo que produce el
  // item por sí mismo y lo que le suma la partida. También del motor: son cifras suyas, y
  // si las calculara la vista un buff que expirara entre el pintado y la lectura haría que
  // el número grande y el desglose no cuadraran.
  const damagePartsDe = typeof activeGameInstance?.getClickDamageParts === 'function'
    ? () => activeGameInstance.getClickDamageParts()
    : undefined;
  renderPanel(state, realDamage, slots, ingresoDe, damagePartsDe);
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

// Avisos del ingreso por segundo.
//
// POR QUÉ SIGUE SIENDO UN INTERVALO DE LA VISTA Y NO UN EVENTO DEL MOTOR. El
// ingreso pasivo entra entero y de una vez cada segundo (`msParaCobroPasivo`),
// así que el segundo es la unidad real del cobro: un aviso por segundo y un
// bloque por segundo son la misma cosa, y montarlo como evento del motor sería
// una segunda vía para lo que el tick ya resuelve.
//
// LO QUE YA NO SE DECIDE AQUÍ. Antes esta función recorría los compañeros por su
// cuenta y se quedaba con los de tipo `click`, así que los `passive` no
// anunciaban nada: el Avatar del Vacío —power 65— salía de una caja, se
// equipaba, y no aparecía nunca. La pregunta de QUIÉN avisa la responde ahora el
// motor (`getAnunciablesIngreso`), que es donde vive la regla y donde un banco
// puede comprobarla. Aquí solo se pinta lo que el motor dice que pintan.
let avisoIngresoInterval: number | null = null;

function avisoDeIngreso(game: any) {
  // Solo efectos visuales: con la pestaña oculta no hay nada que dibujar. El
  // dinero tampoco entra ahí —el tick se detiene antes de acumulado—, así que
  // esta guarda no oculta ningún cobro, solo su número.
  if (document.hidden) return;
  // Solo en la vista principal: en las demás el recolector no existe.
  if (!document.querySelector('#click-btn')) return;

  // El motor decide la lista y la cifra. El respaldo es para un motor viejo que
  // no tenga el método: entonces se cae al reparto simple de los `click`, que
  // es como funcionaba antes y es mejor que no pintar nada.
  const anunciables = typeof game.getAnunciablesIngreso === 'function'
    ? game.getAnunciablesIngreso()
    : (game.getState().activeCompanions as string[])
        .map((id: string) => game.getState().companions.find((c: any) => c.id === id))
        .filter((c: any) => c && c.type === 'click')
        .map((c: any) => ({ id: c.id, cantidad: c.power }));

  anunciables.forEach((a: { id: string; cantidad: number }, index: number) => {
    // Escalonado para que dos números a la vez no se pisen. El hueco es de 100 ms
    // y el bloque de texto dura bastante más, así que con muchos compañeros
    // activos se solapan; eso lo resuelve `showFloatingText`, que retira el más
    // viejo cuando se llega al tope.
    setTimeout(() => {
      showCompanionClickInCollector(a.cantidad);
    }, index * 100);
  });
}

function startCompanionClicks(game: any) {
  if (avisoIngresoInterval) clearInterval(avisoIngresoInterval);
  avisoIngresoInterval = window.setInterval(() => avisoDeIngreso(game), 1000);
}

function stopCompanionClicks() {
  if (avisoIngresoInterval) {
    clearInterval(avisoIngresoInterval);
    avisoIngresoInterval = null;
  }
}
