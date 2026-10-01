// ==========================================================================
//  Cyber-Forge · Terminal de administración
//
//  Página aparte, pensada para abrirla en local (`npm run dev` → /admin.html)
//  y entrar con una cuenta de Firebase Auth del mismo proyecto. Desde aquí se:
//
//    · ve la lista de operativos con su saldo y su fecha de guardado,
//    · se le otorgan o se le fijan nanitas (el ranking se actualiza al momento),
//    · se abre el inventario completo de un jugador y su JSON en crudo,
//    · se editan algunos campos sueltos (llaves, cristales, núcleos…),
//    · y se borra un jugador o la base de datos entera, con confirmación
//      escrita a mano.
//
//  LO QUE ESTÁ EN PANTALLA, NO SOLO AQUÍ: esta página no tiene control de
//  acceso propio. Lo único que decide quién puede entrar es la sesión de
//  Firebase y, sobre todo, las reglas de seguridad de Firestore. Si las reglas
//  permiten escribir a cualquiera, cualquiera que abra esta URL puede vaciar la
//  base de datos. El bloqueo de la lista de administradores de más abajo es una
//  comodidad, no una protección.
//
//  Dos límites que conviene tener presentes al usarla:
//
//  · Borrar un documento de `users` borra la PARTIDA, no la cuenta. Ese mismo
//    nickname puede volver a entrar y arrancar de cero. Para borrar la cuenta
//    de verdad hay que usar el Admin SDK (ver la nota al final del archivo).
//  · Si el jugador está jugando mientras se le toca la partida, su próximo
//    guardado pisa lo que se haya cambiado aquí. La partida vive en memoria
//    durante toda la sesión: no hay forma de empujar un cambio a alguien que
//    tiene el juego abierto.
// ==========================================================================

import './style.css';
import './style.modules.css';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { formatNumber } from './utils/format';
import { ic } from './ui/icons';
import { showToast } from './utils/toast';
import { showConfirmModal } from './utils/modal';
import { applyTheme, getSavedTheme } from './theme';
import {
  CAMPOS_EDITABLES,
  bloquearOperativo,
  borrarBaseDeDatos,
  borrarOperativo,
  borrarBloqueo,
  colorRareza,
  desbloquearOperativo,
  esAdministrador,
  fijarCampo,
  fijarNanitas,
  listarBloqueos,
  listarOperativos,
  otorgarNanitas,
  type Bloqueo,
  type ProgresoBorrado,
  type ResumenOperativo
} from './services/adminService';

/**
 * Quién puede usar la terminal.
 *
 * La respuesta de verdad la dan las reglas de Firestore (`firestore.rules`): un
 * documento `admins/{uid}` es lo que convierte a alguien en administrador, y sin
 * él todas las escrituras de esta página son rechazadas. Este array es la capa
 * de la interfaz, y solo existe para dos cosas:
 *
 *  · No montar la pantalla a quien no va a poder usarla. Preguntar a Firestore
 *    cuesta una lectura; leer un array no cuesta nada.
 *  · Poder trabajar en local sin tener que crear el documento de admin.
 *
 * VACÍO = modo local: entra cualquier cuenta con sesión. Cómodo para el día a
 * día en tu máquina, pero INSEGURO si publicas la URL: con las reglas viejas
 * de "todo público", cualquiera que abra la página puede leer las partidas de
 * todos y escribir las suyas. Rellena este array cuando despliegues.
 *
 * Y en cualquier caso, esto NO es una comprobación de seguridad: ocurre en el
 * navegador y cualquiera puede editarla desde la consola. Lo que protege de
 * verdad son las reglas.
 */
const ADMIN_UIDS: string[] = [];

const app = document.querySelector('#app') as HTMLElement;

// --------------------------------------------------------------------------
//  Estado
// --------------------------------------------------------------------------

type Pestana = 'operativos' | 'base';

let sesion: any = null;
let operativo: ResumenOperativo | null = null;
let lista: ResumenOperativo[] = [];
let cargando = false;
let filtro = '';
let orden: 'nanites' | 'nombre' | 'guardado' = 'nanites';
let pestana: Pestana = 'operativos';
let ocupado = false;

let borradoActivo = false;
let borradoProgreso: ProgresoBorrado | null = null;
let borradoResultado: { total: number; errores: string[] } | null = null;

/**
 * Bloqueos por uid.
 *
 * Se cargan de una vez al abrir la terminal y se van actualizando en local al
 * bloquear o desbloquear. Preguntar bloque por bloque al pintar la lista serían
 * una lectura por cada operativo.
 */
let bloqueos: Record<string, Bloqueo> = {};

/** El campo donde se teclea la confirmación del borrado masivo. */
const CONFIRMACION = 'BORRAR TODO';

// --------------------------------------------------------------------------
//  Utilidades de pintado
// --------------------------------------------------------------------------

/**
 * Escapa texto que viene de la base de datos antes de meterlo en innerHTML.
 *
 * El nombre de un operativo lo elige el jugador al registrarse, y los nombres
 * de los items vienen de la caja. Sin esto, un nickname con `<img onerror=…>`
 * ejecutaría código en la terminal.
 */
function esc(valor: unknown): string {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string;
  });
}

/** Fecha legible, o el texto alternativo si no hay fecha. */
function haceCuando(ms: number): string {
  if (!ms) return 'sin guardado';
  const seg = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seg < 60) return `hace ${seg} s`;
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(ms).toLocaleDateString('es-ES');
}

/**
 * Vuelca un documento de Firestore a JSON legible.
 *
 * Los `Timestamp` se guardan como objetos opacos con `seconds` y `nanoseconds`:
 * sin convertir, el JSON del inventario enseña `{"seconds":1759…}` en lugar de
 * una fecha, que es justo lo que se viene a mirar.
 */
function serializar(valor: any): any {
  if (valor === null || valor === undefined) return valor;
  if (typeof valor?.toDate === 'function') return valor.toDate().toISOString();
  if (Array.isArray(valor)) return valor.map(serializar);
  if (typeof valor === 'object') {
    const salida: Record<string, any> = {};
    for (const [clave, v] of Object.entries(valor)) salida[clave] = serializar(v);
    return salida;
  }
  return valor;
}

/**
 * Atajo de selección.
 *
 * Genérico para poder pedir el tipo concreto —`$<HTMLInputElement>('#buscar')`—
 * y no castear en cada uso. El valor por defecto sigue siendo `HTMLElement`,
 * que es lo que usan casi todas las llamadas.
 */
const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
  document.querySelector(sel) as T | null;

// `any` y no `string`: `ic()` pide el nombre como clave de `ICONS`, y un
// `Record<string, string>` obliga a castear en cada llamada. Es el mismo
// apaño que hace el almacén con su tabla de iconos por tipo.
const ICONO_TIPO: Record<string, any> = {
  collector: 'collector',
  companion: 'companion',
  crate: 'crate',
  key: 'key',
  crystal: 'crystal',
  consumable: 'flask'
};

const ETIQUETA_TIPO: Record<string, string> = {
  collector: 'Recolector',
  companion: 'Compañero',
  crate: 'Caja',
  key: 'Llave',
  crystal: 'Cristal',
  consumable: 'Consumible'
};

function boton(
  accion: string,
  texto: string,
  clases: string,
  atributos = ''
): string {
  return `<button type="button" data-accion="${accion}" ${atributos}
    class="${clases}">${texto}</button>`;
}

// --------------------------------------------------------------------------
//  Acceso
// --------------------------------------------------------------------------

function pintarAcceso(mensaje = '', tipo: 'error' | 'info' = 'error') {
  app.innerHTML = `
    <div class="min-h-dvh flex items-center justify-center p-4 app-bg">
      <div class="w-full max-w-sm card-glass rounded-3xl p-6 flex flex-col gap-4">
        <div class="flex flex-col items-center gap-2 text-center">
          <div class="w-12 h-12 rounded-2xl accent-bg grid place-items-center text-slate-950">
            <span class="[&>span>svg]:w-6 [&>span>svg]:h-6">${ic('lock')}</span>
          </div>
          <h1 class="font-['Orbitron'] font-black text-lg tracking-[0.15em] accent-text">
            TERMINAL DE ADMINISTRACIÓN
          </h1>
          <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">
            Acceso con una cuenta de Cyber-Forge.<br />La sesión es la misma que la del juego.
          </p>
        </div>

        <div id="login-error" role="alert"
             class="${mensaje ? '' : 'hidden'} rounded-xl border px-3 py-2.5 text-[11px] font-mono leading-relaxed
                    ${tipo === 'error'
                      ? 'border-red-500/40 bg-red-500/10 text-red-300'
                      : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'}">${esc(mensaje)}</div>

        <form id="login-form" class="flex flex-col gap-3" novalidate>
          <div class="flex flex-col gap-1.5">
            <label for="login-user" class="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
              NOMBRE DE OPERATIVO
            </label>
            <input type="text" id="login-user" autocomplete="username" maxlength="24" spellcheck="false"
                   class="w-full app-bg border border-[var(--border-color)] rounded-xl px-3.5 py-2.5
                          text-[13px] font-mono text-[var(--text-main)] focus:outline-none
                          placeholder:text-[var(--text-muted)]"
                   placeholder="admin" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="login-pass" class="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
              CONTRASEÑA
            </label>
            <input type="password" id="login-pass" autocomplete="current-password"
                   class="w-full app-bg border border-[var(--border-color)] rounded-xl px-3.5 py-2.5
                          text-[13px] font-mono text-[var(--text-main)] focus:outline-none
                          placeholder:text-[var(--text-muted)]"
                   placeholder="Mínimo 6 caracteres" />
          </div>
          <button type="submit" id="login-btn"
                  class="mt-1 py-3 accent-bg hover:opacity-90 text-slate-950 font-['Orbitron'] font-bold
                         text-[12px] rounded-xl accent-glow cursor-pointer tracking-[0.15em]
                         disabled:opacity-60 disabled:cursor-not-allowed">
            ENTRAR
          </button>
        </form>

        <p class="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed text-center">
          Esta pantalla no va a producción sin reglas en Firestore: quien pueda
          escribir en la base de datos puede usar todo lo que hay debajo.
        </p>
      </div>
    </div>
  `;

  const form = $<HTMLFormElement>('#login-form');
  const user = $<HTMLInputElement>('#login-user');
  const pass = $<HTMLInputElement>('#login-pass');
  const btn = $<HTMLButtonElement>('#login-btn');
  const error = $('#login-error');

  // La cuenta de admin se recuerda, la contraseña no.
  const guardado = localStorage.getItem('cyberforge_admin_user');
  if (user && guardado) user.value = guardado;

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = (user?.value || '').trim();
    const clave = pass?.value || '';

    const fallo = (msg: string) => {
      if (error) {
        error.textContent = msg;
        error.classList.remove('hidden');
      }
    };

    if (nombre.length < 3) return fallo('El nombre necesita al menos 3 letras o números.');
    if (clave.length < 6) return fallo('La contraseña necesita al menos 6 caracteres.');

    // El mismo mapeo que usa la pantalla de acceso del juego: el nickname se
    // convierte en un correo interno. Si aquí se hiciera de otra forma, la
    // cuenta de admin no existiría.
    const correo = nombre.toLowerCase().replace(/[^a-z0-9]/g, '') + '@cyberforge.game';

    btn!.disabled = true;
    btn!.textContent = 'VERIFICANDO…';
    try {
      localStorage.setItem('cyberforge_admin_user', nombre);
      await signInWithEmailAndPassword(auth, correo, clave);
      // No se hace nada más: `onAuthStateChanged` es quien monta la terminal.
    } catch (err: any) {
      btn!.disabled = false;
      btn!.textContent = 'ENTRAR';
      const code = String(err?.code || '');
      fallo(
        code.includes('invalid-credential') || code.includes('user-not-found')
          ? 'Nombre o contraseña incorrectos.'
          : code.includes('too-many-requests')
            ? 'Demasiados intentos. Espera un momento.'
            : String(err?.message || 'No se ha podido completar el acceso.')
              .replace(/^Firebase:\s*/i, '')
              .replace(/\s*\(auth\/[^)]+\)\.?$/, '')
      );
    }
  });

  user?.focus();
}

// --------------------------------------------------------------------------
//  Terminal
// --------------------------------------------------------------------------

function esAdmin(uid: string): boolean {
  return ADMIN_UIDS.length === 0 || ADMIN_UIDS.includes(uid);
}

function montarTerminal() {
  app.innerHTML = `
    <div class="min-h-dvh flex flex-col app-bg">

      <header class="sticky top-0 z-30 border-b border-[var(--border-color)] backdrop-blur-xl
                     bg-slate-950/80">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div class="w-9 h-9 rounded-xl accent-bg grid place-items-center text-slate-950 flex-shrink-0">
            <span class="[&>span>svg]:w-5 [&>span>svg]:h-5">${ic('shield')}</span>
          </div>
          <div class="mr-auto min-w-0">
            <h1 class="font-['Orbitron'] font-black text-[13px] tracking-[0.15em] accent-text leading-none">
              TERMINAL DE ADMINISTRACIÓN
            </h1>
            <p class="text-[10px] font-mono text-[var(--text-muted)] mt-1 truncate">
              <span id="sesion-nombre">—</span>
            </p>
          </div>

          <div class="flex items-center gap-1 p-1 rounded-xl border border-[var(--border-color)]
                      app-bg">
            <button type="button" data-pestana="operativos" class="admin-tab">Operativos</button>
            <button type="button" data-pestana="base" class="admin-tab">Base de datos</button>
          </div>

          <button type="button" id="btn-refrescar"
                  class="px-3 h-9 rounded-xl border border-[var(--border-color)] app-bg
                         text-[10px] font-mono text-[var(--text-main)] hover:border-[var(--accent)]
                         transition cursor-pointer flex items-center gap-1.5">
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('recycle')}</span>
            Refrescar
          </button>
          <button type="button" id="btn-salir"
                  class="px-3 h-9 rounded-xl border border-[var(--border-color)] app-bg
                         text-[10px] font-mono text-[var(--text-muted)] hover:text-red-300
                         hover:border-red-500/50 transition cursor-pointer flex items-center gap-1.5">
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('logout')}</span>
            Salir
          </button>
        </div>
      </header>

      <main class="max-w-7xl w-full mx-auto px-4 py-5 flex-1">

        <!-- Pestaña de operativos -->
        <section id="panel-operativos" class="grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4 items-start">
          <div class="card-glass rounded-2xl p-3 flex flex-col gap-3 lg:sticky lg:top-20">
            <div class="flex flex-col gap-2">
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]
                             [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('eye')}</span>
                <input type="search" id="buscar" placeholder="Buscar por nombre o UID"
                       class="w-full app-bg border border-[var(--border-color)] rounded-xl pl-9 pr-3 py-2.5
                              text-[12px] font-mono text-[var(--text-main)] focus:outline-none
                              placeholder:text-[var(--text-muted)]" />
              </div>
              <div class="flex items-center gap-1.5 text-[10px] font-mono">
                <span class="text-[var(--text-muted)] mr-1">Orden</span>
                <button type="button" data-orden="nanites" class="admin-chip">Nanitas</button>
                <button type="button" data-orden="nombre" class="admin-chip">Nombre</button>
                <button type="button" data-orden="guardado" class="admin-chip">Guardado</button>
              </div>
            </div>
            <div id="lista" class="flex flex-col gap-1.5 max-h-[calc(100dvh-15rem)] overflow-y-auto pr-0.5"></div>
          </div>

          <div id="detalle" class="min-w-0"></div>
        </section>

        <!-- Pestaña de borrado masivo -->
        <section id="panel-base" class="hidden max-w-2xl"></section>
      </main>
    </div>
  `;

  // --- Listeners de la cabecera (una vez; el contenido se repinta) ---------
  document.querySelectorAll<HTMLElement>('[data-pestana]').forEach(b => {
    b.addEventListener('click', () => cambiarPestana(b.dataset.pestana as Pestana));
  });
  document.querySelectorAll<HTMLElement>('[data-orden]').forEach(b => {
    b.addEventListener('click', () => {
      orden = b.dataset.orden as typeof orden;
      pintarLista();
      marcarOrden();
    });
  });

  $('#btn-refrescar')?.addEventListener('click', () => cargarOperativos(true));
  $('#btn-salir')?.addEventListener('click', async () => {
    await signOut(auth);
  });

  const buscar = $<HTMLInputElement>('#buscar');
  buscar?.addEventListener('input', () => {
    filtro = buscar.value.trim();
    pintarLista();
  });

  // Un solo listener en el contenedor: los hijos se sustituyen en cada
  // repintado y cualquier listener puesto sobre ellos se perdería.
  $('#detalle')?.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-accion]');
    if (btn) accionDetalle(btn.dataset.accion!, btn);
  });

  $('#panel-base')?.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-accion]');
    if (btn) accionBase(btn.dataset.accion!);
  });

  $('#panel-base')?.addEventListener('input', e => {
    if ((e.target as HTMLElement).id === 'confirmacion') comprobarConfirmacion();
  });

  const nombre = sesion?.displayName || sesion?.email?.split('@')[0] || 'administrador';
  const etiqueta = $('#sesion-nombre');
  if (etiqueta) etiqueta.textContent = `Sesión: ${nombre} · ${sesion?.uid || ''}`;

  if (ADMIN_UIDS.length === 0) {
    // Modo local: sin lista de admins en el código entra cualquier sesión
    // iniciada. Se dice alto en vez de dejar que se descubra cuando alguien
    // entre por el enlace.
    showToast('Modo local: ADMIN_UIDS está vacío, así que esta comprobación no filtra a nadie.', 'info');
  }

  marcarOrden();
  cambiarPestana(pestana);
  cargarOperativos();
}

function cambiarPestana(p: Pestana) {
  pestana = p;
  $('#panel-operativos')?.classList.toggle('hidden', p !== 'operativos');
  $('#panel-base')?.classList.toggle('hidden', p !== 'base');
  document.querySelectorAll<HTMLElement>('[data-pestana]').forEach(b => {
    b.classList.toggle('admin-tab-on', b.dataset.pestana === p);
  });
  if (p === 'base') pintarBase();
}

function marcarOrden() {
  document.querySelectorAll<HTMLElement>('[data-orden]').forEach(b => {
    b.classList.toggle('admin-chip-on', b.dataset.orden === orden);
  });
}

// --------------------------------------------------------------------------
//  Lista de operativos
// --------------------------------------------------------------------------

function pintarLista() {
  const cont = $('#lista');
  if (!cont) return;

  if (cargando) {
    cont.innerHTML = `<p class="text-[11px] font-mono text-[var(--text-muted)] p-4 text-center">
      Leyendo la base de datos…</p>`;
    return;
  }

  // El filtro se aplica antes de ordenar para que el orden elegido siga
  // mandando sobre el subconjunto visible.
  let visibles = lista;
  if (filtro) {
    const q = filtro.toLowerCase();
    visibles = visibles.filter(u =>
      u.username.toLowerCase().includes(q) || u.uid.toLowerCase().includes(q)
    );
  }
  visibles = visibles.slice().sort((a, b) => {
    if (orden === 'nombre') return a.username.localeCompare(b.username, 'es');
    if (orden === 'guardado') return b.actualizado - a.actualizado;
    return b.nanites - a.nanites;
  });

  if (!visibles.length) {
    cont.innerHTML = `<p class="text-[11px] font-mono text-[var(--text-muted)] p-4 text-center">
      ${lista.length ? 'Ningún operativo coincide con la búsqueda.' : 'No hay ningún operativo guardado.'}
    </p>`;
    return;
  }

  cont.innerHTML = visibles.map(u => {
    const on = u.uid === operativo?.uid;
    const avatar = u.username.trim().charAt(0).toUpperCase() || '?';
    const bloq = bloqueos[u.uid]?.activo;
    return `
      <button type="button" data-uid="${esc(u.uid)}"
        class="text-left w-full rounded-xl border px-3 py-2.5 flex items-center gap-2.5 transition cursor-pointer
               ${on
                 ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                 : 'border-[var(--border-color)] hover:border-[var(--accent)]/60'}">
        <span class="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 relative
                     ${on ? 'accent-bg text-slate-950' : 'app-bg text-[var(--text-muted)] border border-[var(--border-color)]'}
                     font-['Orbitron'] font-bold text-[13px]">
          ${esc(avatar)}
          ${bloq ? `
            <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500
                         ring-2 ring-[var(--bg-app)]"
                  title="Cuenta bloqueada"></span>
          ` : ''}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-[12px] font-mono ${bloq ? 'text-red-300' : 'text-[var(--text-main)]'} truncate">
            ${esc(u.username)}
          </span>
          <span class="block text-[9px] font-mono truncate">
            ${bloq
              ? '<span class="text-red-400">BLOQUEADO</span>'
              : `<span class="text-[var(--text-muted)]">${u.items} objs · ${u.companeros} comp. · ${esc(haceCuando(u.actualizado))}</span>`}
          </span>
        </span>
        <span class="font-mono text-[11px] flex-shrink-0 ${bloq ? 'text-[var(--text-muted)]' : 'accent-text'}">
          ${formatNumber(u.nanites)}
        </span>
      </button>
    `;
  }).join('');

  cont.querySelectorAll<HTMLElement>('[data-uid]').forEach(b => {
    b.addEventListener('click', () => {
      operativo = lista.find(u => u.uid === b.dataset.uid) || null;
      pintarLista();
      pintarDetalle();
    });
  });
}

async function cargarOperativos(manual = false) {
  if (cargando) return;
  cargando = true;
  pintarLista();
  try {
    lista = await listarOperativos();
    // El detalle puede haber apuntado a un operativo que ya no está: se
    // suelta en vez de quedarse enseñando datos de un documento borrado.
    if (operativo && !lista.some(u => u.uid === operativo!.uid)) operativo = null;
    if (manual) showToast(`${lista.length} operativos cargados.`, 'success');
  } catch (err: any) {
    console.error(err);
    lista = [];
    operativo = null;
    showToast(`No se ha podido leer la base de datos: ${describeError(err)}`, 'error');
  }

  // Los bloqueos van aparte y NO ROMPEN la lista si fallan. Sin este documento
  // la terminal sigue pudiendo dar nanitas y ver inventarios; lo único que se
  // pierde es la marca de bloqueado. Es una degradación aceptable donde la
  // alternativa —no mostrar nada— sería peores.
  try {
    bloqueos = await listarBloqueos();
  } catch (err: any) {
    console.error(err);
    bloqueos = {};
    showToast('No se han podido leer los bloqueos: puede que las reglas de Firestore lo impidan.', 'error');
  } finally {
    cargando = false;
    pintarLista();
    pintarDetalle();
    if (pestana === 'base') pintarBase();
  }
}

/** Traduce el `code` de Firestore a algo que sirva para un toast. */
function describeError(err: any): string {
  const code = String(err?.code || '');
  if (code.includes('permission-denied')) {
    return 'las reglas de Firestore no permiten esta operación (permission-denied)';
  }
  if (code.includes('unavailable')) return 'no hay conexión con el servidor';
  return err?.message || String(err);
}

// --------------------------------------------------------------------------
//  Detalle de un operativo
// --------------------------------------------------------------------------

function campo(etiqueta: string, valor: string, extra = '') {
  return `
    <div class="rounded-xl border border-[var(--border-color)] app-bg px-3 py-2">
      <p class="text-[9px] font-mono text-[var(--text-muted)] tracking-wider uppercase">${etiqueta}</p>
      <p class="text-[13px] font-mono text-[var(--text-main)] mt-0.5 truncate ${extra}">${valor}</p>
    </div>
  `;
}

function pintarDetalle() {
  const cont = $('#detalle');
  if (!cont) return;

  if (!operativo) {
    cont.innerHTML = `
      <div class="card-glass rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
        <span class="text-[var(--text-muted)] [&>span>svg]:w-10 [&>span>svg]:h-10">${ic('user')}</span>
        <p class="text-[12px] font-mono text-[var(--text-main)]">Elige un operativo de la lista</p>
        <p class="text-[10px] font-mono text-[var(--text-muted)] max-w-sm leading-relaxed">
          Podrás ver su inventario, darle nanitas o borrar su partida.
        </p>
      </div>
    `;
    return;
  }

  const u = operativo;
  const d = u.bruto;
  const almacen: any[] = Array.isArray(d.warehouse) ? d.warehouse : [];
  const companeros: any[] = Array.isArray(d.companions) ? d.companions : [];
  const cajas: any = d.crates && typeof d.crates === 'object' ? d.crates : {};
  const bloqueo = bloqueos[u.uid];

  const panelBloqueo = bloqueo?.activo
    ? `
      <div class="rounded-2xl border border-red-500/50 bg-red-500/5 p-3.5 flex flex-col gap-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-red-400 [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('lock')}</span>
          <h3 class="text-[11px] font-['Orbitron'] font-bold tracking-[0.12em] text-red-300">
            CUENTA BLOQUEADA
          </h3>
          ${bloqueo.desde ? `
            <span class="text-[9px] font-mono text-[var(--text-muted)] ml-auto">
              desde ${esc(haceCuando(bloqueo.desde))}
            </span>
          ` : ''}
        </div>

        <div class="rounded-xl border border-[var(--border-color)] app-bg px-3 py-2.5">
          <p class="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
            Motivo que ve el jugador
          </p>
          <p class="text-[12px] font-sans text-[var(--text-main)] mt-1 break-words">
            ${esc(bloqueo.motivo || 'Sin motivo registrado.')}
          </p>
        </div>

        <p class="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">
          El juego no le cargará. Si tiene la partida abierta en otra pestaña, se le
          cerrará la sesión en cuanto vuelva a mirar la pantalla.
          ${bloqueo.puestoPor ? `<br />Bloqueado por ${esc(bloqueo.puestoPor)}.` : ''}
        </p>

        ${boton('desbloquear', 'LEVANTAR BLOQUEO',
          'self-start px-4 h-10 rounded-xl btn-primary font-[\'Orbitron\'] font-bold text-[11px] cursor-pointer transition',
          'tracking-[0.08em]')}
      </div>
    `
    : `
      <div class="rounded-2xl border border-[var(--border-color)] app-bg p-3.5 flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <span class="text-[var(--text-muted)] [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('lock')}</span>
          <h3 class="text-[11px] font-['Orbitron'] font-bold tracking-[0.12em] text-[var(--text-main)]">
            BLOQUEAR CUENTA
          </h3>
        </div>

        <p class="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">
          El juego dejará de cargarse para ${esc(u.username)} y le mostrará el motivo
          que escribas abajo. No le cierra la sesión al instante en otros
          dispositivos, y no le impide crear una cuenta nueva.
        </p>

        <div class="flex flex-col gap-1.5">
          <label for="motivo-bloqueo" class="text-[9px] font-mono text-[var(--text-muted)] tracking-wider">
            MOTIVO (LO VERÁ EL JUGADOR)
          </label>
          <input type="text" id="motivo-bloqueo" maxlength="180"
                 placeholder="Cuentasuspensa por un administrador."
                 class="w-full app-bg border border-[var(--border-color)] rounded-xl px-3 py-2.5
                        text-[12px] font-sans text-[var(--text-main)] focus:outline-none
                        placeholder:text-[var(--text-muted)]" />
        </div>

        ${boton('bloquear', 'BLOQUEAR CUENTA',
          'self-start px-4 h-10 rounded-xl text-white font-[\'Orbitron\'] font-bold text-[11px] cursor-pointer transition',
          'tracking-[0.08em]" style="background:linear-gradient(to bottom,#dc2626,#b91c1c)"')}
      </div>
    `;

  const ficha = `
    <div class="card-glass rounded-2xl p-4 flex flex-col gap-4">
      <div class="flex items-start gap-3 flex-wrap">
        <div class="min-w-0 flex-1">
          <h2 class="font-['Orbitron'] font-bold text-base ${bloqueo?.activo ? 'text-red-300' : 'text-[var(--text-main)]'} truncate">
            ${esc(u.username)}
          </h2>
          <p class="text-[10px] font-mono text-[var(--text-muted)] mt-1 break-all">${esc(u.uid)}</p>
        </div>
        ${boton('copiar-uid', 'Copiar UID',
          'px-3 h-9 rounded-xl border border-[var(--border-color)] app-bg text-[10px] font-mono',
          'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--accent)] transition cursor-pointer')}
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${campo('Nanitas', formatNumber(u.nanites), 'accent-text text-[15px] font-bold')}
        ${campo('Producidas', formatNumber(u.totalNanitesProduced))}
        ${campo('Clics', formatNumber(u.totalClicks))}
        ${campo('Núcleos', formatNumber(u.cores))}
        ${campo('Llaves', formatNumber(Number(d.keys) || 0))}
        ${campo('Cristales', formatNumber(Number(d.upgradeCrystals) || 0))}
        ${campo('Cajas', `${cajas.common || 0}C · ${cajas.rare || 0}R · ${cajas.epic || 0}E · ${cajas.legendary || 0}L`)}
        ${campo('Almacén', `${u.items} / ${d.warehouseCapacity ?? '—'}`)}
        ${campo('Logros', formatNumber(Array.isArray(d.unlockedAchievements) ? d.unlockedAchievements.length : 0))}
        ${campo('Reinicios', formatNumber(Number(d.resets) || 0))}
        ${campo('Esquirlas', formatNumber(Number(d.shards) || 0))}
        ${campo('Guardado', esc(haceCuando(u.actualizado)))}
      </div>

      <!-- Otorgar nanitas -->
      <div class="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3.5 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <h3 class="text-[11px] font-['Orbitron'] font-bold tracking-[0.12em] accent-text">
            OTORGAR NANITAS
          </h3>
          <span class="text-[10px] font-mono text-[var(--text-muted)]">
            Saldo actual: <span class="text-[var(--text-main)]">${formatNumber(u.nanites)}</span>
          </span>
        </div>

        <div class="flex gap-2">
          <input type="number" id="grant-cantidad" inputmode="numeric" placeholder="Cantidad"
                 class="flex-1 min-w-0 app-bg border border-[var(--border-color)] rounded-xl px-3 py-2.5
                        text-[12px] font-mono text-[var(--text-main)] focus:outline-none
                        placeholder:text-[var(--text-muted)]" />
          ${boton('otorgar', 'OTORGAR',
            'px-4 rounded-xl accent-bg hover:opacity-90 text-slate-950 font-[\'Orbitron\'] font-bold text-[11px]',
            'tracking-[0.1em] cursor-pointer disabled:opacity-50')}
        </div>

        <div class="flex flex-wrap gap-1.5">
          ${[
            { etiqueta: '−1 M', valor: -1000000 }, { etiqueta: '−1 K', valor: -1000 },
            { etiqueta: '1 K', valor: 1000 }, { etiqueta: '100 K', valor: 100000 },
            { etiqueta: '1 M', valor: 1000000 }, { etiqueta: '10 M', valor: 10000000 },
            { etiqueta: '1 B', valor: 1000000000 }, { etiqueta: '1 T', valor: 1000000000000 }
          ].map(c => boton('rapido', c.etiqueta,
            'px-2.5 h-7 rounded-lg border border-[var(--border-color)] app-bg text-[10px] font-mono',
            `data-valor="${c.valor}" style="color:var(--text-muted)"
             onmouseover="this.style.color='var(--accent)'"
             onmouseout="this.style.color='var(--text-muted)'"`)).join('')}
        </div>

        <p class="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">
          Una cantidad negativa resta nanitas. El saldo nunca baja de cero y el
          histórico de producción sube lo mismo, para que el reinicio no lo castigue.
        </p>

        <div class="flex gap-2 flex-wrap items-center">
          <span class="text-[10px] font-mono text-[var(--text-muted)]">Fijar saldo</span>
          <input type="number" id="fijar-valor" inputmode="numeric" placeholder="0"
                 class="w-32 app-bg border border-[var(--border-color)] rounded-xl px-3 py-2
                        text-[12px] font-mono text-[var(--text-main)] focus:outline-none" />
          ${boton('fijar', 'FIJAR',
            'px-3 h-9 rounded-xl btn-ghost text-[10px] font-[\'Orbitron\'] font-bold cursor-pointer transition')}
          ${boton('a-cero', 'Poner a 0',
            'px-3 h-9 rounded-xl btn-ghost text-[10px] font-[\'Orbitron\'] font-bold cursor-pointer transition')}
          ${boton('duplicar', 'Duplicar saldo',
            'px-3 h-9 rounded-xl btn-ghost text-[10px] font-[\'Orbitron\'] font-bold cursor-pointer transition')}
        </div>
      </div>

      ${panelBloqueo}

      <!-- Campos sueltos -->
      <details class="rounded-2xl border border-[var(--border-color)] app-bg p-3.5">
        <summary class="text-[11px] font-['Orbitron'] font-bold tracking-[0.12em]
                        text-[var(--text-main)] cursor-pointer select-none">
          OTROS CAMPOS
        </summary>
        <div class="grid sm:grid-cols-2 gap-2 mt-3">
          ${CAMPOS_EDITABLES.map(c => {
            // Un campo ausente se deja VACÍO, no a 0. Ponerlo a 0 invitaría a
            // darle a «Guardar» sin querer y machacar un valor que no existe:
            // el juego guarda muchos de estos solo cuando se han tocado.
            const bruto = d[c.campo];
            const valor = typeof bruto === 'number' && Number.isFinite(bruto) ? String(bruto) : '';
            return `
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-mono text-[var(--text-muted)] flex-1 truncate">${c.etiqueta}</span>
                <input type="number" inputmode="numeric" data-campo="${c.campo}" value="${valor}"
                       placeholder="—"
                       class="w-24 app-bg border border-[var(--border-color)] rounded-lg px-2 py-1.5
                              text-[11px] font-mono text-[var(--text-main)] focus:outline-none
                              placeholder:text-[var(--text-muted)]" />
                ${boton('guardar-campo', 'Guardar',
                  'px-2.5 h-8 rounded-lg btn-ghost text-[9px] font-[\'Orbitron\'] cursor-pointer transition',
                  `data-campo="${c.campo}"`)}
              </div>
            `;
          }).join('')}
        </div>
      </details>

      <!-- Peligro -->
      <div class="rounded-2xl border border-red-500/40 bg-red-500/5 p-3.5 flex items-center gap-3 flex-wrap">
        <div class="min-w-0 flex-1">
          <h3 class="text-[11px] font-['Orbitron'] font-bold tracking-[0.12em] text-red-300">
            ELIMINAR PARTIDA
          </h3>
          <p class="text-[9px] font-mono text-[var(--text-muted)] mt-1 leading-relaxed">
            Borra el documento de <span class="text-[var(--text-main)]">users/${esc(u.uid)}</span> y su
            fila del ranking. La cuenta de acceso sigue existiendo: el nickname
            puede volver a entrar y empezar de cero.
          </p>
        </div>
        ${boton('borrar', 'ELIMINAR',
          'px-4 h-10 rounded-xl text-white font-[\'Orbitron\'] font-bold text-[11px] cursor-pointer transition',
          'style="background:linear-gradient(to bottom,#ef4444,#dc2626)"')}
      </div>
    </div>
  `;

  const inventario = `
    <div class="card-glass rounded-2xl p-4 flex flex-col gap-3 mt-4">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <h3 class="text-[11px] font-['Orbitron'] font-bold tracking-[0.12em] text-[var(--text-main)]">
          INVENTARIO · ${almacen.length} OBJETOS
        </h3>
        <span class="text-[10px] font-mono text-[var(--text-muted)]">
          ${companeros.length} compañeros · ${almacen.filter((i: any) => i.equipped).length} equipados
        </span>
      </div>
      ${almacen.length ? `
        <div class="overflow-x-auto -mx-1 px-1">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                <th class="py-1.5 pr-2 font-normal">Objeto</th>
                <th class="py-1.5 pr-2 font-normal">Tipo</th>
                <th class="py-1.5 pr-2 font-normal">Rareza</th>
                <th class="py-1.5 pr-2 font-normal text-right">Nivel</th>
                <th class="py-1.5 pr-2 font-normal text-right">Daño</th>
                <th class="py-1.5 pr-2 font-normal text-right">Cant.</th>
                <th class="py-1.5 font-normal text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              ${almacen.map((it: any) => `
                <tr class="border-t border-[var(--border-color)]/60 text-[11px] font-mono">
                  <td class="py-1.5 pr-2">
                    <span class="flex items-center gap-1.5 min-w-0">
                      <span style="color:${colorRareza(it.rarity)}" class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5 flex-shrink-0">
                        ${ic(ICONO_TIPO[it.type] || 'crate')}
                      </span>
                      <span class="text-[var(--text-main)] truncate max-w-[14rem]">${esc(it.name)}</span>
                      ${it.equipped ? '<span class="text-amber-400 text-[9px] flex-shrink-0">EQ</span>' : ''}
                    </span>
                  </td>
                  <td class="py-1.5 pr-2 text-[var(--text-muted)]">
                    ${esc(ETIQUETA_TIPO[it.type] || it.type || '—')}
                  </td>
                  <td class="py-1.5 pr-2" style="color:${colorRareza(it.rarity)}">${esc(it.rarity || '—')}</td>
                  <td class="py-1.5 pr-2 text-right text-[var(--text-muted)]">
                    ${it.level != null ? it.level : '—'}${it.potential ? ' ' + '★'.repeat(it.potential) : ''}
                  </td>
                  <td class="py-1.5 pr-2 text-right text-[var(--text-main)]">
                    ${it.damage != null ? formatNumber(it.damage) : '—'}
                  </td>
                  <td class="py-1.5 pr-2 text-right text-[var(--text-main)]">${it.stackCount ?? 1}</td>
                  <td class="py-1.5 text-right text-[var(--text-muted)]">
                    ${it.sellPrice != null ? formatNumber(it.sellPrice) : '—'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <p class="text-[11px] font-mono text-[var(--text-muted)] py-3 text-center">
          El almacén está vacío.
        </p>
      `}

      ${companeros.length ? `
        <div class="flex flex-col gap-1.5">
          <p class="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Compañeros</p>
          ${companeros.map((c: any) => `
            <div class="flex items-center gap-2 text-[11px] font-mono rounded-lg px-2 py-1.5
                        border border-[var(--border-color)]/60">
              <span style="color:${colorRareza(c.rarity)}" class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">
                ${ic('companion')}
              </span>
              <span class="text-[var(--text-main)] truncate flex-1">${esc(c.name)}</span>
              <span style="color:${colorRareza(c.rarity)}">${esc(c.rarity || '')}</span>
              <span class="text-[var(--text-muted)]">${c.power != null ? `+${formatNumber(c.power)}/s` : ''}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <details class="rounded-xl border border-[var(--border-color)] app-bg p-3">
        <summary class="text-[10px] font-mono text-[var(--text-muted)] cursor-pointer select-none">
          Documento en crudo (JSON)
        </summary>
        <pre class="mt-2.5 max-h-96 overflow-auto text-[10px] font-mono text-[var(--text-muted)]
                    leading-relaxed whitespace-pre-wrap break-all">${esc(JSON.stringify(serializar(d), null, 2))}</pre>
      </details>

      ${bloqueo ? `
        <details class="rounded-xl border border-[var(--border-color)] app-bg p-3">
          <summary class="text-[10px] font-mono text-[var(--text-muted)] cursor-pointer select-none">
            Documento de bloqueo (JSON)
          </summary>
          <pre class="mt-2.5 max-h-40 overflow-auto text-[10px] font-mono text-[var(--text-muted)]
                      leading-relaxed whitespace-pre-wrap break-all">${esc(JSON.stringify(serializar(bloqueo), null, 2))}</pre>
        </details>
      ` : ''}
    </div>
  `;

  cont.innerHTML = ficha + inventario;
}

// --------------------------------------------------------------------------
//  Acciones del detalle
// --------------------------------------------------------------------------

async function accionDetalle(accion: string, origen: HTMLElement) {
  const u = operativo;
  if (!u) return;

  if (accion === 'copiar-uid') {
    try {
      await navigator.clipboard.writeText(u.uid);
      showToast('UID copiado.', 'success');
    } catch {
      showToast('El navegador no deja copiar. Cópialo a mano.', 'error');
    }
    return;
  }

  if (accion === 'rapido') {
    const input = $<HTMLInputElement>('#grant-cantidad');
    if (input) {
      input.value = origen.dataset.valor || '';
      input.focus();
    }
    return;
  }

  if (accion === 'bloquear') {
    const motivo = ($<HTMLInputElement>('#motivo-bloqueo')?.value ?? '').trim();
    // Un motivo vacío se rellena solo con una frase genérica, pero se avisa:
    // quien bloquea suele creer que lo está escribiendo y no lo está, y luego
    // el jugador ve un texto que no explica nada.
    if (!motivo) {
      showToast('Escribe un motivo: el jugador lo verá en su pantalla de bloqueo.', 'error');
      $<HTMLInputElement>('#motivo-bloqueo')?.focus();
      return;
    }

    const ok = await confirmar(
      `${u.username} no podrá volver a jugar. Su partida se queda guardada y verá este motivo: "${motivo}".`,
      'BLOQUEAR',
      true
    );
    if (!ok) return;

    await conOcupado(async () => {
      await bloquearOperativo(u.uid, motivo, sesion?.uid || 'admin');
      // Se actualiza en local: releer la colección entera para un cambio que
      // ya se sabe sería tirar la red sin motivo.
      bloqueos[u.uid] = {
        uid: u.uid,
        activo: true,
        motivo,
        desde: Date.now(),
        puestoPor: sesion?.uid || 'admin',
        quitadoPor: ''
      };
      pintarLista();
      pintarDetalle();
      showToast(`${u.username} bloqueado.`, 'success');
    });
    return;
  }

  if (accion === 'desbloquear') {
    const ok = await confirmar(
      `${u.username} volverá a poder entrar.`,
      'DESBLOQUEAR',
      false
    );
    if (!ok) return;

    await conOcupado(async () => {
      await desbloquearOperativo(u.uid, sesion?.uid || 'admin');
      bloqueos[u.uid] = {
        uid: u.uid,
        activo: false,
        motivo: bloqueos[u.uid]?.motivo || '',
        desde: 0,
        puestoPor: bloqueos[u.uid]?.puestoPor || '',
        quitadoPor: sesion?.uid || 'admin'
      };
      pintarLista();
      pintarDetalle();
      showToast(`Bloqueo de ${u.username} levantado.`, 'success');
    });
    return;
  }

  if (accion === 'otorgar') {
    const input = $<HTMLInputElement>('#grant-cantidad');
    const texto = (input?.value ?? '').trim();
    if (texto === '') {
      showToast('Escribe una cantidad, o usa uno de los atajos de abajo.', 'error');
      return;
    }
    const cantidad = Number(texto);
    if (!Number.isFinite(cantidad) || cantidad === 0) {
      showToast('La cantidad tiene que ser un número distinto de cero.', 'error');
      return;
    }
    if (cantidad > 0) {
      const ok = await confirmar(
        `Se van a sumar ${formatNumber(cantidad)} nanitas a ${u.username}.`,
        'OTORGAR', false
      );
      if (!ok) return;
    }
    await conOcupado(async () => {
      const saldo = await otorgarNanitas(u.uid, Math.floor(cantidad));
      showToast(`${u.username} tiene ahora ${formatNumber(saldo)} nanitas.`, 'success');
    });
    return;
  }

  if (accion === 'fijar' || accion === 'a-cero' || accion === 'duplicar') {
    // Un input vacío da `Number('') === 0`, así que "Fijar" sin escribir nada
    // pondría el saldo a cero sin avisar. Solo `fijar` lee el campo; los otros
    // dos traen su propio valor.
    if (accion === 'fijar' && ($<HTMLInputElement>('#fijar-valor')?.value ?? '').trim() === '') {
      showToast('Escribe el saldo al que quieres fijarlo.', 'error');
      return;
    }
    const valor = accion === 'a-cero'
      ? 0
      : accion === 'duplicar'
        ? u.nanites * 2
        : Number($<HTMLInputElement>('#fijar-valor')?.value);

    if (!Number.isFinite(valor) || valor < 0) {
      showToast('Ese número no vale. Usa un entero igual o mayor que cero.', 'error');
      return;
    }
    const ok = await confirmar(
      `El saldo de ${u.username} pasará de ${formatNumber(u.nanites)} a ${formatNumber(valor)} nanitas.`,
      'FIJAR', false
    );
    if (!ok) return;

    await conOcupado(async () => {
      const saldo = await fijarNanitas(u.uid, Math.floor(valor));
      showToast(`Saldo fijado en ${formatNumber(saldo)}.`, 'success');
    });
    return;
  }

  if (accion === 'guardar-campo') {
    const campo = origen.dataset.campo!;
    const input = document.querySelector<HTMLInputElement>(`input[type="number"][data-campo="${campo}"]`);
    const texto = (input?.value ?? '').trim();
    // `Number('')` es 0, no NaN: un campo vacío se guardaría como cero sin
    // haber escrito nada. Se comprueba el texto antes de convertirlo.
    if (texto === '') {
      showToast('Escribe un número antes de guardar.', 'error');
      return;
    }
    const valor = Number(texto);
    if (!Number.isFinite(valor) || valor < 0) {
      showToast('Ese número no vale. Usa un entero igual o mayor que cero.', 'error');
      return;
    }
    await conOcupado(async () => {
      await fijarCampo(u.uid, campo, valor);
      showToast(`${campo} guardado.`, 'success');
    });
    return;
  }

  if (accion === 'borrar') {
    const ok = await confirmar(
      `Se borrará la partida de ${u.username} y su fila del ranking. La cuenta de acceso seguirá existiendo.`,
      'ELIMINAR', true
    );
    if (!ok) return;

    await conOcupado(async () => {
      await borrarOperativo(u.uid);
      // El bloqueo se va con la partida. Dejarlo crearía un documento
      // bloqueando un uid que ya no tiene juego detrás, y si ese nickname
      // vuelve a registrarse con esa misma cuenta se encontraría bloqueado sin
      // que nadie hubiera vuelto a pulsarlo.
      if (bloqueos[u.uid]) {
        delete bloqueos[u.uid];
        await borrarBloqueo(u.uid).catch((e) => {
          console.warn('[admin] No se ha podido borrar el bloqueo:', e);
        });
      }
      operativo = null;
      showToast('Partida eliminada.', 'success');
      await cargarOperativos();
    });
  }
}

/**
 * Ejecuta una acción con el panel bloqueado.
 *
 * Sin esto, dos clics rápidos en «otorgar» lanzarían dos escrituras: la segunda
 * se leería el valor que la primera todavía no ha escrito, y el resultado
 * dependería del orden de llegada.
 */
async function conOcupado(fn: () => Promise<void>) {
  if (ocupado) return;
  ocupado = true;
  document.body.style.cursor = 'progress';
  try {
    await fn();
  } catch (err: any) {
    console.error(err);
    showToast(`Operación fallida: ${describeError(err)}`, 'error');
  } finally {
    ocupado = false;
    document.body.style.cursor = '';
  }
}

/**
 * Confirmación con el diálogo del juego. Resuelve `true` solo si se confirma.
 *
 * `showConfirmModal` no avisa de cómo se ha cerrado el diálogo, y aquí importa:
 * "borrar toda la base de datos" y "cancelar" tienen que ser dos caminos
 * distintos y explícitos, no un `void`. Se enganchan listeners a los dos botones
 * del diálogo ya creado —el último es siempre el de confirmar— y se limpian al
 * resolver, incluido el `keydown` de Escape que el modal registra a nivel de
 * documento.
 */
function confirmar(mensaje: string, textoBoton: string, peligro: boolean): Promise<boolean> {
  return new Promise(resolve => {
    let resuelto = false;

    const overlay = () => document.querySelector('#confirm-modal-overlay');
    const botones = () => Array.from(overlay()?.querySelectorAll('button') ?? []);

    const resolver = (v: boolean) => {
      if (resuelto) return;
      resuelto = true;
      for (const b of botones()) {
        b.removeEventListener('click', alAceptar);
        b.removeEventListener('click', alCancelar);
      }
      overlay()?.removeEventListener('click', alFondo);
      document.removeEventListener('keydown', alEscape);
      resolve(v);
    };

    const alAceptar = () => resolver(true);
    const alCancelar = () => resolver(false);
    const alFondo = (e: Event) => { if (e.target === overlay()) resolver(false); };
    const alEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') resolver(false); };

    showConfirmModal(mensaje, alAceptar, {
      sublabel: peligro ? 'OPERACIÓN IRREVERSIBLE' : 'CONFIRMAR',
      confirmText: textoBoton,
      danger: peligro
    });

    const bs = botones();
    bs[0]?.addEventListener('click', alCancelar);
    bs[bs.length - 1]?.addEventListener('click', alAceptar);
    overlay()?.addEventListener('click', alFondo);
    document.addEventListener('keydown', alEscape);
  });
}

// --------------------------------------------------------------------------
//  Pestaña de base de datos
// --------------------------------------------------------------------------

function pintarBase() {
  const cont = $('#panel-base');
  if (!cont) return;

  const ocupadoBorrado = borradoActivo;
  const prog = borradoProgreso;
  const esperado = lista.length || 1;
  const pct = prog ? Math.min(100, Math.round((prog.borrados / esperado) * 100)) : 0;
  // Se lee del DOM y no de una variable: el texto tecleado vive en el input, y
  // este panel se repinta entero en cada tanda de borrado.
  const confirmado = (($('#confirmacion') as HTMLInputElement | null)?.value || '')
    .trim().toUpperCase() === CONFIRMACION;

  cont.innerHTML = `
    <div class="card-glass rounded-2xl p-5 flex flex-col gap-4">
      <div class="flex items-center gap-2.5">
        <span class="text-red-400 [&>span>svg]:w-5 [&>span>svg]:h-5">${ic('warning')}</span>
        <h2 class="font-['Orbitron'] font-bold text-sm tracking-[0.12em] text-red-300">
          BORRADO MASIVO DE LA BASE DE DATOS
        </h2>
      </div>

      <p class="text-[11px] font-mono text-[var(--text-muted)] leading-relaxed">
        Vacía por completo las colecciones <span class="text-[var(--text-main)]">users</span>,
        <span class="text-[var(--text-main)]">rankings</span> y
        <span class="text-[var(--text-main)]">bloqueos</span> en lotes de 400 documentos.
        Ahora mismo hay <span class="text-[var(--text-main)]">${lista.length}</span>
        ${lista.length === 1 ? 'operativo' : 'operativos'}
        en la lista (puede haber más: la lista se lee al abrir la terminal).
      </p>

      <div class="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3.5 flex flex-col gap-2">
        <p class="text-[10px] font-mono text-amber-200 leading-relaxed">
          Antes de seguir, dos cosas que este botón NO hace:
        </p>
        <ul class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed list-disc pl-4 space-y-1">
          <li>
            No borra las cuentas de Firebase Auth. Los nicknames seguirán pudiendo
            entrar y crearán una partida nueva desde cero.
          </li>
          <li>
            No avisa a nadie. No hay copia de seguridad: lo que se borra, se borró.
          </li>
        </ul>
      </div>

      <div class="flex flex-col gap-2">
        <label for="confirmacion" class="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
          ESCRIBE <span class="text-red-300">${CONFIRMACION}</span> PARA HABILITAR EL BOTÓN
        </label>
        <input type="text" id="confirmacion" autocomplete="off" spellcheck="false" ${ocupadoBorrado ? 'disabled' : ''}
               placeholder="${CONFIRMACION}"
               class="w-full app-bg border border-[var(--border-color)] rounded-xl px-3.5 py-2.5
                      text-[12px] font-mono text-[var(--text-main)] focus:outline-none
                      placeholder:text-[var(--text-muted)]" />
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        ${boton('borrar-todo', ocupadoBorrado ? 'BORRANDO…' : 'BORRAR TODA LA BASE DE DATOS',
          'px-5 h-12 rounded-xl text-white font-[\'Orbitron\'] font-bold text-[11px] tracking-[0.1em] transition',
          `style="background:linear-gradient(to bottom,#ef4444,#dc2626)"
           ${confirmado && !ocupadoBorrado ? '' : 'disabled opacity-40 cursor-not-allowed'}`
        )}
        ${boton('recargar-lista', 'Recargar lista',
          'px-4 h-12 rounded-xl btn-ghost text-[11px] font-[\'Orbitron\'] font-bold cursor-pointer transition')}
      </div>

      ${prog ? `
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
            <span>Fase: ${
              prog.fase === 'users' ? 'partidas' : prog.fase === 'rankings' ? 'ranking' : 'bloqueos'
            } · ${prog.borrados} borrados</span>
            <span>${pct}%</span>
          </div>
          <div class="meter"><span style="width:${pct}%;background:#ef4444"></span></div>
          ${prog.ultimoError ? `<p class="text-[9px] font-mono text-amber-300">${esc(prog.ultimoError)}</p>` : ''}
        </div>
      ` : ''}

      ${borradoResultado ? `
        <div class="rounded-xl border px-3.5 py-3 flex flex-col gap-1.5
                    ${borradoResultado.errores.length
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-emerald-500/40 bg-emerald-500/5'}">
          <p class="text-[11px] font-mono ${borradoResultado.errores.length ? 'text-amber-200' : 'text-emerald-300'}">
            ${borradoResultado.errores.length
              ? `Borrado terminado con ${borradoResultado.errores.length} documento(s) que no se pudieron eliminar.`
              : `Base de datos vaciada. ${borradoResultado.total} documentos eliminados.`}
          </p>
          ${borradoResultado.errores.slice(0, 8).map(e =>
            `<p class="text-[9px] font-mono text-[var(--text-muted)] break-all">${esc(e)}</p>`
          ).join('')}
        </div>
      ` : ''}

      <details class="rounded-xl border border-[var(--border-color)] app-bg p-3.5">
        <summary class="text-[10px] font-mono text-[var(--text-muted)] cursor-pointer select-none">
          Reglas de Firestore: por qué esto puede fallar con «permission-denied»
        </summary>
        <div class="mt-2.5 text-[10px] font-mono text-[var(--text-muted)] leading-relaxed flex flex-col gap-2">
          <p>
            Todo lo que hace esta página escribe en documentos de otros. Eso solo
            lo permite si las reglas de seguridad lo autorizan, y con las reglas
            por defecto de un proyecto nuevo no lo hace: son de lectura y
            escritura públicas.
          </p>
          <p>
            El archivo <span class="text-[var(--text-main)]">firestore.rules</span>
            del proyecto trae las reglas necesarias, con la explicación de por
            qué cada colección es como es. Se pega en Firebase console →
            Firestore Database → Rules → Publish.
          </p>
          <p>
            Después hay que crear el documento
            <span class="text-[var(--text-main)]">admins/{esc(sesion?.uid || 'TU_UID')}</span>
            para tu cuenta. Sin él, las reglas niegan el acceso aunque las
            publiques.
          </p>
        </div>
      </details>

      <details class="rounded-xl border border-[var(--border-color)] app-bg p-3.5">
        <summary class="text-[10px] font-mono text-[var(--text-muted)] cursor-pointer select-none">
          Cómo se borran también las cuentas de acceso
        </summary>
        <div class="mt-2.5 text-[10px] font-mono text-[var(--text-muted)] leading-relaxed flex flex-col gap-2">
          <p>
            Las cuentas viven en Firebase Auth, no en Firestore, y el SDK del
            navegador no tiene permiso para borrarlas. Con el Admin SDK, desde
            Node y con una clave de cuenta de servicio:
          </p>
          <pre class="overflow-x-auto p-2.5 rounded-lg bg-black/40 text-[9px] leading-relaxed">import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const app = initializeApp({ credential: admin.credential.cert(serviceAccount) });
await getAuth(app).deleteUsers(uids);   // máximo 1000 por llamada</pre>
          <p>
            El mismo script puede recorrer <span class="text-[var(--text-main)]">users</span> con
            <span class="text-[var(--text-main)]">listUsers()</span> y borrar cada uid antes de
            borrar su documento. Haz una copia de seguridad antes: no hay vuelta atrás.
          </p>
          <p>
            Es también la única forma de <strong>cerrar la sesión de un jugador
            ahora</strong>: <span class="text-[var(--text-main)]">revokeRefreshTokens(uid)</span>
            invalida sus tokens, y su partida se cae en cuanto intente guardar. El
            botón de bloquear de esta página no lo hace —el SDK del navegador no
            puede—: se limita a negar el arranque y a cerrarle la sesión cuando
            vuelve a la pestaña.
          </p>
        </div>
      </details>
    </div>
  `;
}

/**
 * Habilita el botón de borrado solo con la confirmación escrita.
 *
 * Se quita el atributo `disabled` de verdad, no solo la opacidad: un botón
 * "desactivado" que se puede pulsar es peor que uno que no existe. La opacidad
 * solo acompaña al estado para que se vea por qué está apagado.
 */
function comprobarConfirmacion() {
  const input = $<HTMLInputElement>('#confirmacion');
  const btn = $<HTMLButtonElement>('[data-accion="borrar-todo"]');
  if (!btn) return;
  const listo = (input?.value || '').trim().toUpperCase() === CONFIRMACION;
  btn.disabled = !listo || borradoActivo;
  btn.style.opacity = btn.disabled ? '.4' : '1';
  btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
}

function accionBase(accion: string) {
  if (accion === 'recargar-lista') {
    cargarOperativos(true);
    return;
  }
  if (accion !== 'borrar-todo') return;

  const escrito = ($<HTMLInputElement>('#confirmacion')?.value || '').trim().toUpperCase();
  if (escrito !== CONFIRMACION) {
    showToast(`Escribe ${CONFIRMACION} para confirmar.`, 'error');
    return;
  }

  confirmar(
    `Se borrarán todas las partidas y todas las filas del ranking. Esto no se puede deshacer.`,
    'BORRAR TODO',
    true
  ).then(ok => {
    if (ok) ejecutarBorrado();
  });
}

async function ejecutarBorrado() {
  if (borradoActivo) return;
  borradoActivo = true;
  borradoProgreso = { fase: 'users', borrados: 0, total: 0, ultimoError: null };
  borradoResultado = null;
  // El panel se repinta con el texto ya escrito en el input, así que la
  // confirmación escrita no se pierde y `pintarBase` no la lee como vacía.
  const escrito = ($<HTMLInputElement>('#confirmacion')?.value || '').trim().toUpperCase();
  pintarBase();
  const input = $<HTMLInputElement>('#confirmacion');
  if (input) input.value = escrito;

  try {
    const res = await borrarBaseDeDatos(p => {
      borradoProgreso = p;
      pintarBase();
    });
    borradoResultado = res;
    if (!res.errores.length) {
      showToast(`Base de datos vaciada: ${res.total} documentos.`, 'success');
    } else {
      showToast(`${res.errores.length} documento(s) no se pudieron borrar.`, 'error');
    }
  } catch (err: any) {
    console.error(err);
    showToast(`Borrado interrumpido: ${describeError(err)}`, 'error');
  } finally {
    borradoActivo = false;
    borradoProgreso = null;
    lista = [];
    operativo = null;
    pintarBase();
    pintarLista();
    pintarDetalle();
    // El campo de confirmación se vacía al terminar. Si se dejara escrito, el
    // botón del borrado volvería a salir habilitado y con la misma frase
    // puesta: un segundo borrado a un clic de distancia.
    const input = $<HTMLInputElement>('#confirmacion');
    if (input) input.value = '';
  }
}

// --------------------------------------------------------------------------
//  Arranque
// --------------------------------------------------------------------------

applyTheme(getSavedTheme());

onAuthStateChanged(auth, user => {
  sesion = user;
  if (!user) {
    operativo = null;
    lista = [];
    pintarAcceso();
    return;
  }
  if (!esAdmin(user.uid)) {
    pintarAcceso(
      'Esta cuenta no está en la lista de administradores (ADMIN_UIDS en src/admin.ts).',
      'error'
    );
    return;
  }

  // Segunda comprobación, contra Firestore. El array de arriba es una lista
  // escrita a mano y se olvida actualizar; el documento `admins/{uid}` es la
  // fuente de verdad. Con las reglas en su sitio, quien no sea admin ya no
  // habría llegado hasta aquí —su consulta de partidas habría sido rechazada—,
  // pero se pregunta igualmente para no montar una pantalla que va a devolver
  // `permission-denied` en cada acción.
  void esAdministrador(user.uid).then((ok) => {
    if (ok) {
      montarTerminal();
      return;
    }
    pintarAcceso(
      'Esta cuenta no es administradora. Para darle acceso, crea el documento ' +
        'admins/' + user.uid + ' en Firestore.',
      'error'
    );
  });
});
