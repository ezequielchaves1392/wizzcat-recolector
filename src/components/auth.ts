// ==========================================================================
//  Cyber-Forge · Acceso
//
//  La pantalla de acceso es la primera impresión del juego, y antes era un
//  formulario con un borde. Este diseño se apoya en cuatro cosas:
//
//  1. ESCENA DE FONDO VIVA. Tres capas de gradientes que se mueven muy despacio
//     (22-31 segundos por ciclo). Nada se nota conscientemente, pero una
//     pantalla quieta se percibe como muerta en cuanto se mira dos veces.
//
//  2. REJILLA EN PERSPECTIVA. Una rejilla que sugiere suelo industrial, con
//     la línea de horizonte difuminada hacia arriba.
//
//  3. BANDA DE ESCANEO. Una franja de luz que baja cada 7,5 s. Es el detalle
//     que más comunica "terminal" y es una sola animación CSS.
//
//  4. LLUVIA DE CARACTERES. Sobre un canvas, no con nodos DOM: 40 columnas
//     por 18 filas serían 720 elementos que el navegador vuelve a medir en
//     cada frame.
//
//  Todo lo que brilla está bajo `prefers-reduced-motion`: si el sistema pide
//  menos movimiento, las animaciones no arrancan y la pantalla se queda en un
//  estado que ya es legible sin ellas.
//
//  ACCESIBILIDAD: los campos tienen etiqueta real, el error se anuncia con
//  `role="alert"`, hay botón de mostrar contraseña para no tener que vaciar el
//  campo al equivocarse, y el envío se bloquea mientras la petición está en
//  curso para que no se pueda mandar dos veces.
// ==========================================================================

import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { getSavedTheme, setTheme, THEMES } from '../theme';
import { showConfirmModal } from '../utils/modal';
import { ic } from '../ui/icons';

export function renderAuth(container: HTMLElement, onLoginSuccess: (user: any, username?: string) => void) {
  container.innerHTML = `
    <div class="auth-scene w-screen h-dvh app-bg flex flex-col items-center justify-center p-4 font-sans overflow-hidden">

      <!-- Fondo: gradientes en movimiento + rejilla + lluvia + escaneo -->
      <div class="auth-bg" aria-hidden="true">
        <div class="auth-glow auth-glow-1"></div>
        <div class="auth-glow auth-glow-2"></div>
        <div class="auth-glow auth-glow-3"></div>
        <div class="auth-grid"></div>
        <canvas class="auth-rain"></canvas>
        <div class="auth-scan"></div>
        <div class="auth-vignette"></div>
      </div>

      <!-- Marca -->
      <div class="auth-brand relative z-10 text-center mb-5">
        <div class="auth-logo mx-auto mb-3">
          <span class="[&>span>svg]:w-6 [&>span>svg]:h-6">${ic('chip')}</span>
        </div>
        <h1 class="font-['Orbitron'] font-black text-xl sm:text-2xl accent-text tracking-[0.2em] leading-none">
          CYBER-FORGE
        </h1>
        <p class="text-[10px] text-[var(--text-muted)] font-mono mt-2 tracking-[0.15em]">
          TERMINAL DE EXTRACCIÓN · v1.0
        </p>
      </div>

      <!-- Tarjeta -->
      <div class="relative z-10 w-full max-w-sm sm:max-w-md">
        <div class="auth-card card-glass rounded-3xl p-5 sm:p-7 flex flex-col gap-4">

          <div class="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
            <span class="auth-dot w-1.5 h-1.5 rounded-full accent-bg flex-shrink-0"></span>
            <span id="auth-status">EN ESPERA DE IDENTIFICACIÓN</span>
          </div>

          <div id="auth-error" role="alert" aria-live="assertive"
               class="hidden rounded-xl border border-red-500/40 bg-red-500/10 text-red-300
                      px-3 py-2.5 text-[11px] font-mono leading-relaxed"></div>

          <form id="auth-form" class="flex flex-col gap-3.5" novalidate>
            <div class="flex flex-col gap-1.5">
              <label for="username-input" class="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
                NOMBRE DE OPERATIVO
              </label>
              <input type="text" id="username-input" name="username" required autocomplete="username"
                     maxlength="24" spellcheck="false"
                     class="auth-input w-full app-bg border border-[var(--border-color)] rounded-xl px-3.5 py-2.5
                            text-[13px] font-mono text-[var(--text-main)] focus:outline-none
                            placeholder:text-[var(--text-muted)]"
                     placeholder="CyberKnight">
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="password-input" class="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
                CONTRASEÑA DE ACCESO
              </label>
              <!--
                El contenedor "relative" no lleva w-full a propósito: es el
                ancla del botón del ojo y se mide contra el input, que ya es
                w-full. El botón va a right-1.5 en vez de right-1 para que el
                icono respire igual que el texto del campo y no parezca haberse
                salido del input.
              -->
              <div class="relative">
                <input type="password" id="password-input" name="password" required
                       autocomplete="current-password"
                       class="auth-input w-full app-bg border border-[var(--border-color)] rounded-xl px-3.5 py-2.5
                              pr-11 text-[13px] font-mono text-[var(--text-main)] focus:outline-none
                              placeholder:text-[var(--text-muted)]"
                       placeholder="Mínimo 6 caracteres">
                <button type="button" id="toggle-pass"
                        class="hit-expand absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg
                               flex items-center justify-center
                               cursor-pointer text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
                        aria-label="Mostrar contraseña" aria-pressed="false">
                  <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('eye')}</span>
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between gap-2">
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" id="remember-me" checked class="accent-bg rounded cursor-pointer w-3.5 h-3.5">
                <span class="text-[10px] font-mono text-[var(--text-muted)]">Recordar</span>
              </label>
              <select id="theme-select" aria-label="Tema visual"
                      class="app-bg border border-[var(--border-color)] rounded-lg px-2 py-1.5
                             text-[10px] font-mono text-[var(--text-main)] cursor-pointer
                             focus:outline-none focus:border-[var(--accent)] max-w-[8.5rem]">
                ${THEMES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
              </select>
            </div>

            <button type="submit" id="submit-btn"
                    class="auth-submit relative mt-1 py-3 accent-bg hover:opacity-90 text-slate-950
                           font-['Orbitron'] font-bold text-[12px] rounded-xl accent-glow
                           cursor-pointer tracking-[0.15em] overflow-hidden
                           disabled:opacity-60 disabled:cursor-not-allowed">
              <span class="relative z-10">INICIAR SESIÓN</span>
            </button>
          </form>

          <div class="text-center pt-0.5">
            <button type="button" id="toggle-mode"
                    class="text-[11px] font-mono text-[var(--text-muted)] hover:accent-text transition cursor-pointer">
              ¿Nuevo operativo? <span class="accent-text underline">Registrar cuenta</span>
            </button>
          </div>
        </div>

        <p class="text-[9px] font-mono text-[var(--text-muted)] text-center mt-3 leading-relaxed">
          El progreso se guarda en la nube y se restaura al volver.
        </p>
        <!--
          LA WIKI SIN CUENTA (F86). Abre wiki.html en otra pestaña, que no
          pide auth ni toca la partida: es solo lectura sobre datos. Va aquí
          y no solo en la cabecera para que un jugador nuevo pueda leer las
          reglas antes de registrarse.
        -->
        <div class="text-center mt-2">
          <button type="button" id="auth-wiki"
                  class="text-[11px] font-mono text-[var(--text-muted)] hover:accent-text transition cursor-pointer">
            ¿Cómo se juega? <span class="accent-text underline">Abrir la Wiki</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // ==========================================================================
  //  Estado
  // ==========================================================================

  let isRegistering = false;
  let ocupado = false;
  const $ = (sel: string) => container.querySelector(sel) as HTMLElement | null;

  const toggleBtn = $('#toggle-mode');
  const submitBtn = $('#submit-btn') as HTMLButtonElement | null;
  const errorBox = $('#auth-error');
  const statusLine = $('#auth-status');
  const themeSelect = $('#theme-select') as HTMLSelectElement | null;
  const usernameInput = $('#username-input') as HTMLInputElement | null;
  const passwordInput = $('#password-input') as HTMLInputElement | null;
  const rememberCheckbox = $('#remember-me') as HTMLInputElement | null;

  /** Bloquea el formulario mientras hay una petición en vuelo. */
  const setOcupado = (v: boolean, msg = '') => {
    ocupado = v;
    if (submitBtn) submitBtn.disabled = v;
    if (statusLine) statusLine.textContent = msg || 'EN ESPERA DE IDENTIFICACIÓN';
    container.querySelectorAll('#auth-form input').forEach(i => {
      (i as HTMLInputElement).disabled = v;
    });
  };

  // ==========================================================================
  //  Fondo animado
  // ==========================================================================

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) startRain();

  /**
   * Lluvia de caracteres sobre un canvas.
   *
   * Canvas y no nodos DOM porque en DOM cada carácter sería un elemento que el
   * navegador vuelve a medir y pintar en cada frame.
   *
   * Cada columna cae a su velocidad, que es lo que hace que parezca lluvia y
   * no una rejilla que baja. Además el rastro se borra con un rectángulo
   * semitransparente en vez de con `clearRect`: así los caracteres se
   * desvanecen en vez de desaparecer de golpe.
   */
  function startRain() {
    const canvas = container.querySelector('.auth-rain') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Los dos estrechos, capturados en constantes.
    //
    // `pintar` y `alCambiarVisibilidad` son DECLARACIONES de función, y una
    // declaración se puede llamar antes de los `if (!x) return` de arriba, así que
    // TypeScript no les conserva el estrechamiento y las marcaba `possibly null`
    // aunque aquí el `return` haga inalcanzable el null. `medir` y `seguir`, que
    // son `const`, sí lo conservan: la diferencia es la forma, no los datos. Con
    // estas dos constantes —ya estrechas— las dos declaraciones ven el tipo bueno.
    const lienzo = canvas;
    const contexto = ctx;

    // Se mide en píxeles reales del dispositivo: con `width=390` en un móvil se
    // vería borroso, porque el buffer no coincide con los píxeles que se pintan.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const medir = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    medir();
    window.addEventListener('resize', medir);

    const glifos = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ01';
    const TAM = 13;
    const PASO = 22;
    const columnas = Math.ceil(window.innerWidth / PASO);
    const filas = Math.ceil(window.innerHeight / TAM);

    // `y` negativo = todavía fuera de pantalla por arriba
    const gotas = Array.from({ length: columnas }, (_, i) => ({
      x: i * PASO,
      y: Math.random() * filas * -1,
      v: 0.12 + Math.random() * 0.22
    }));

    let activo = true;
    let rafId = 0;

    /**
     * Apaga la lluvia y suelta todo lo que registro.
     *
     * El bucle se para solo cuando el canvas sale del documento, y hace falta
     * mirar `isConnected` en CADA frame en vez de solo al empezar: `renderAuth`
     * se vuelve a llamar en cada ciclo de login y logout, así que la lluvia del
     * acceso anterior se quedaba pidiendo frames para siempre sobre un canvas
     * que ya no estaba en la pantalla. Una fuga por sesión, y en móvil es
     * batería. Antes solo paraba al ocultar la pestaña, así que entrar y salir
     * sin cambiar de pestaña la dejaba viva.
     */
    function parar() {
      activo = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      window.removeEventListener('resize', medir);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    }

    function pintar() {
      contexto.fillStyle = 'rgba(3, 9, 22, 0.14)';
      contexto.fillRect(0, 0, window.innerWidth, window.innerHeight);
      contexto.font = TAM + 'px ui-monospace, monospace';
      // El color se lee del tema en cada frame: la lluvia cambia con el tema
      // sin tener que recrear el canvas.
      contexto.fillStyle = getComputedStyle(container).getPropertyValue('--accent').trim() || '#38bdf8';
      contexto.globalAlpha = 0.15;

      for (const g of gotas) {
        contexto.fillText(glifos[Math.floor(Math.random() * glifos.length)], g.x, g.y * TAM);
        g.y += g.v;
        if (g.y > filas + 2) {
          g.y = Math.random() * -8;
          g.v = 0.12 + Math.random() * 0.22;
        }
      }
      contexto.globalAlpha = 1;
    }

    const seguir = () => {
      if (!activo) return;
      if (!canvas.isConnected) { parar(); return; }
      pintar();
      rafId = requestAnimationFrame(seguir);
    };

    // Se detiene con la pestaña oculta: en algunos navegadores un rAF sigue
    // corriendo en segundo plano, y en móvil eso es batería.
    function alCambiarVisibilidad() {
      if (document.hidden) {
        activo = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        return;
      }
      // Al volver, solo se reanuda si el canvas sigue en pantalla. Si el jugador
      // entró y salió mientras la pestaña estaba oculta, reanudar un canvas
      // huérfano es justo la fuga que se está evitando.
      if (!activo && lienzo.isConnected) {
        activo = true;
        rafId = requestAnimationFrame(seguir);
      }
    }

    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    rafId = requestAnimationFrame(seguir);
  }

  // ==========================================================================
  //  Comportamiento
  // ==========================================================================

  // Credenciales recordadas. Se rellenan sin normalizar: el juego guarda
  // exactamente lo que el usuario escribió, con sus mayúsculas.
  const savedUsername = localStorage.getItem('cyberforge_remember_user');
  const savedPassword = localStorage.getItem('cyberforge_remember_pass');
  if (usernameInput && savedUsername) usernameInput.value = savedUsername;
  if (passwordInput && savedPassword) passwordInput.value = savedPassword;

  if (themeSelect) themeSelect.value = getSavedTheme();
  setTheme(getSavedTheme());

  themeSelect?.addEventListener('change', () => setTheme(themeSelect.value as any));

  // La Wiki en pestaña aparte, sin cuenta. Mismo destino que el botón de la
  // cabecera (`data-wiki-externo` en `main.ts`), pero aquí no hay delegación
  // instalada todavía: la pantalla se monta una vez y el listener va directo.
  $('#auth-wiki')?.addEventListener('click', () => {
    window.open('wiki.html', '_blank', 'noopener');
  });

  // Mostrar contraseña. Sin esto, un error de tecleo obliga a vaciar el campo.
  const togglePass = $('#toggle-pass');
  togglePass?.addEventListener('click', () => {
    if (!passwordInput) return;
    const visible = passwordInput.type === 'text';
    passwordInput.type = visible ? 'password' : 'text';
    togglePass.setAttribute('aria-pressed', String(!visible));
    togglePass.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
  });

  toggleBtn?.addEventListener('click', () => {
    isRegistering = !isRegistering;
    if (submitBtn) submitBtn.textContent = isRegistering ? 'REGISTRAR CUENTA' : 'INICIAR SESIÓN';
    if (toggleBtn) {
      toggleBtn.innerHTML = isRegistering
        ? '¿Ya tienes cuenta? <span class="accent-text underline">Inicia sesión</span>'
        : '¿Nuevo operativo? <span class="accent-text underline">Registrar cuenta</span>';
    }
    if (errorBox) errorBox.classList.add('hidden');
    // El navegador decide qué contraseña sugiere con este atributo: sin él, al
    // pasar a registro sigue ofreciendo la que ya está guardada.
    passwordInput?.setAttribute('autocomplete', isRegistering ? 'new-password' : 'current-password');
  });

  const form = $('#auth-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (ocupado) return;

    errorBox?.classList.add('hidden');

    const username = (usernameInput?.value || '').trim();
    const password = passwordInput?.value || '';
    const remember = rememberCheckbox?.checked ?? true;

    // Validación aquí y no solo con `required`: el atributo solo actúa en el
    // envío nativo, y este formulario lleva `novalidate`.
    if (!username) {
      mostrarError('Escribe un nombre de operativo.');
      usernameInput?.focus();
      return;
    }
    if (password.length < 6) {
      mostrarError('La contraseña necesita al menos 6 caracteres.');
      passwordInput?.focus();
      return;
    }

    // Mapeo de nombre de usuario a correo interno de Firebase Auth.
    const limpio = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (limpio.length < 3) {
      mostrarError('El nombre necesita al menos 3 letras o números.');
      usernameInput?.focus();
      return;
    }
    const email = limpio + '@cyberforge.game';

    setOcupado(true, isRegistering ? 'CREANDO CUENTA…' : 'VERIFICANDO IDENTIDAD…');

    try {
      const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);

      if (remember) {
        localStorage.setItem('cyberforge_remember_user', username);
        localStorage.setItem('cyberforge_remember_pass', password);
      } else {
        localStorage.removeItem('cyberforge_remember_user');
        localStorage.removeItem('cyberforge_remember_pass');
      }

      if (isRegistering) {
        const creds = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(creds.user, { displayName: username });
        showConfirmModal('Cuenta creada. Entras al sistema…', () => {
          // El nombre pasa por sessionStorage para sobrevivir al guardado de
          // la partida, que ocurre antes de que el perfil exista en Firestore.
          sessionStorage.setItem('pending_username', username);
          onLoginSuccess(creds.user, username);
        }, { confirmText: 'Entrar' });
      } else {
        const creds = await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess(creds.user, username);
      }
      setOcupado(false);
    } catch (err: any) {
      setOcupado(false);
      mostrarError(traducirError(err));
    }
  });

  function mostrarError(msg: string) {
    if (!errorBox) return;
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  // El foco va al campo de nombre: quien abre la pantalla quiere escribir ya.
  usernameInput?.focus();
}

/**
 * Traduce los errores de Firebase a algo que un jugador pueda actuar.
 *
 * Los mensajes originales están en inglés y describen la causa técnica:
 * "auth/invalid-credential" no le dice a nadie que su contraseña está mal
 * escrita. Los que no tienen equivalente conocido se enseñan tal cual: un error
 * desconocido con su código es mejor que un texto inventado que no cuadre.
 */
function traducirError(err: any): string {
  const code = String(err?.code || '');
  const bruto = String(err?.message || '');

  if (code.includes('invalid-credential') || bruto.includes('wrong-password') || bruto.includes('user-not-found')) {
    return 'Nombre o contraseña incorrectos.';
  }
  if (code.includes('email-already-in-use')) {
    return 'Ese nombre ya está en uso. Prueba con otro o inicia sesión.';
  }
  if (code.includes('weak-password')) {
    return 'La contraseña es demasiado débil. usa al menos 6 caracteres.';
  }
  if (code.includes('invalid-email')) {
    return 'Ese nombre no es válido. Usa solo letras y números.';
  }
  if (code.includes('too-many-requests')) {
    return 'Demasiados intentos. Espera un momento y prueba otra vez.';
  }
  if (code.includes('network-request-failed') || code.includes('unavailable')) {
    return 'No hay conexión con el servidor. Revisa tu red y vuelve a intentarlo.';
  }
  if (code.includes('operation-not-allowed')) {
    return 'Este acceso está deshabilitado en la configuración del proyecto.';
  }
  return bruto.replace(/^Firebase:\s*/i, '').replace(/\s*\(auth\/[^)]+\)\.?$/, '')
    || 'No se ha podido completar el acceso.';
}