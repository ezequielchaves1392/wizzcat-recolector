import { auth } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { getSavedTheme, setTheme } from '../theme';
import { showConfirmModal } from '../utils/modal';

export function renderAuth(container: HTMLElement, onLoginSuccess: (user: any) => void) {
  container.innerHTML = `
    <div class="w-screen h-dvh app-bg flex flex-col items-center justify-center p-4 font-sans select-none overflow-hidden">
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--accent)]/10 via-[var(--bg-app)] to-[var(--bg-app)] pointer-events-none"></div>
      
      <div class="relative z-10 card-glass border rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-6">
        <div class="text-center">
          <div class="w-12 h-12 rounded-full accent-bg mx-auto flex items-center justify-center mb-3 accent-glow">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 class="font-['Orbitron'] font-black text-xl accent-text tracking-wider">CYBER-FORGE</h1>
          <p class="text-xs text-[var(--text-muted)] font-mono mt-1">Terminal de Acceso por Identidad</p>
        </div>

        <div id="auth-error" class="hidden bg-red-500/20 border border-red-500/40 text-red-300 p-3 rounded-xl text-xs font-mono text-center"></div>

        <form id="auth-form" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-mono text-[var(--text-muted)]">Nombre de Operativo (Usuario)</label>
            <input type="text" id="username-input" required class="app-bg border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]" placeholder="Ej. CyberKnight">
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-mono text-[var(--text-muted)]">Contraseña de Acceso</label>
            <input type="password" id="password-input" required class="app-bg border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]" placeholder="••••••••">
          </div>

          <div class="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="remember-me" checked class="accent-bg rounded cursor-pointer">
              <span>Recordar sesión</span>
            </label>
          </div>

          <button type="submit" id="submit-btn" class="mt-2 py-3 accent-bg hover:opacity-90 text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl transition accent-glow cursor-pointer tracking-widest">
            INICIAR SESIÓN
          </button>
        </form>

        <div class="text-center">
          <button type="button" id="toggle-mode" class="text-xs font-mono text-[var(--text-muted)] hover:accent-text transition cursor-pointer">
            ¿Nuevo operativo? <span class="accent-text underline">Registrar cuenta</span>
          </button>
        </div>

        <div class="border-t border-[var(--border-color)] pt-4 flex flex-col gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-mono text-[var(--text-muted)]">Tema Visual</label>
            <select id="theme-select" class="app-bg border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] cursor-pointer">
              <option value="cyber-dark">🌙 Cyber Dark</option>
              <option value="synthwave">🌸 Synthwave</option>
              <option value="matrix">🟢 Matrix Green</option>
              <option value="nature">🌿 Naturaleza (Eco)</option>
              <option value="neon-purple">🔮 Neón Púrpura</option>
              <option value="sunset">🌅 Sunset Cyber</option>
            </select>
          </div>

        </div>
      </div>
    </div>
  `;

  let isRegistering = false;
  const toggleBtn = container.querySelector('#toggle-mode');
  const submitBtn = container.querySelector('#submit-btn');
  const errorBox = container.querySelector('#auth-error');
  const themeSelect = container.querySelector('#theme-select') as HTMLSelectElement;
  const usernameInput = container.querySelector('#username-input') as HTMLInputElement;
  const passwordInput = container.querySelector('#password-input') as HTMLInputElement;
  const rememberCheckbox = container.querySelector('#remember-me') as HTMLInputElement;

  // Cargar credenciales guardadas si existen
  const savedUsername = localStorage.getItem('cyberforge_remember_user');
  const savedPassword = localStorage.getItem('cyberforge_remember_pass');
  if (savedUsername) usernameInput.value = savedUsername;
  if (savedPassword) passwordInput.value = savedPassword;

  // Establecer tema por defecto
  if (themeSelect) {
    themeSelect.value = getSavedTheme();
    setTheme(getSavedTheme() as any);
  }

  themeSelect?.addEventListener('change', () => {
    setTheme(themeSelect.value as any);
  });

  toggleBtn?.addEventListener('click', () => {
    isRegistering = !isRegistering;
    if (isRegistering) {
      if (submitBtn) submitBtn.textContent = 'REGISTRAR CUENTA';
      if (toggleBtn) toggleBtn.innerHTML = '¿Ya tienes cuenta? <span class="accent-text underline">Inicia sesión</span>';
    } else {
      if (submitBtn) submitBtn.textContent = 'INICIAR SESIÓN';
      if (toggleBtn) toggleBtn.innerHTML = '¿Nuevo operativo? <span class="accent-text underline">Registrar cuenta</span>';
    }
  });

  const form = container.querySelector('#auth-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox?.classList.add('hidden');

    const username = (container.querySelector('#username-input') as HTMLInputElement).value.trim();
    const password = (container.querySelector('#password-input') as HTMLInputElement).value;
    const remember = (container.querySelector('#remember-me') as HTMLInputElement).checked;

    if (!username) return;

    // Mapeo seguro de nombre de usuario a correo interno para Firebase Auth
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const email = `${cleanUsername}@cyberforge.game`;

    try {
      const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);

      // Guardar o limpiar credenciales según el checkbox
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
        // Avisar que se creó el usuario y está ingresando
        showConfirmModal('¡Cuenta creada exitosamente! Ingresando al sistema...', () => {
          onLoginSuccess(creds.user);
        });
      } else {
        const creds = await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess(creds.user);
      }
    } catch (err: any) {
      if (errorBox) {
        let msg = err.message || 'Error de autenticación.';
        if (msg.includes('(auth/invalid-credential)') || msg.includes('user-not-found') || msg.includes('wrong-password')) {
          msg = 'Credenciales incorrectas o usuario no registrado.';
        } else if (msg.includes('email-already-in-use')) {
          msg = 'El nombre de usuario ya está en uso. Elige otro o inicia sesión.';
        }
        errorBox.textContent = msg;
        errorBox.classList.remove('hidden');
      }
    }
  });
}
