// ==========================================================================
//  Cyber-Forge · Cuenta bloqueada
//
//  Pantalla que ve el jugador cuando su cuenta está suspendida desde la
//  terminal de administración. Es una pantalla aparte y no un error dentro del
//  formulario de acceso, por dos razones:
//
//  1. El mensaje importa. Un "nombre o contraseña incorrectos" sobre una cuenta
//     que SÍ es correcta manda al jugador a pensar que se ha equivocado de
//     contraseña, y a probar variaciones hasta que le salta el límite de intentos
//     de Firebase. Aquí se dice qué ha pasado y por qué.
//  2. El formulario no se monta. Con los campos delante, cualquier toque a
//     "Entrar" vuelve a fallar y el jugador insiste. Sin campos, no hay nada
//     que reintentar.
//
//  NO HAY BOTÓN DE REINTENTO A PROPÓSITO. Un desbloqueo es una decisión del
//  administrador, y un botón que dice "reintentar" invites a pulsarlo cada diez
//  segundos. Lo único que se ofrece es recargar la página, por si el bloqueo se
//  levanta mientras el jugador mira.
// ==========================================================================

import { ic } from '../ui/icons';

export function renderBloqueado(
  container: HTMLElement,
  datos: { nombre: string; motivo: string; desde: number }
): void {
  const { nombre, motivo, desde } = datos;

  // Si el motivo no viene de la terminal —un documento a medio escribir, por
  // ejemplo— se dice lo mismo que sin motivo. Un hueco en blanco donde debería
  // haber una explicación se lee como un fallo de la página, no como un castigo.
  const texto = (motivo || '').trim() || 'Cuentasuspendida por un administrador.';

  const fecha = desde
    ? new Date(desde).toLocaleString('es-ES', {
        dateStyle: 'long',
        timeStyle: 'short'
      })
    : '';

  container.innerHTML = `
    <div class="auth-scene w-screen h-dvh app-bg flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
      <div class="auth-bg" aria-hidden="true">
        <div class="auth-glow auth-glow-1"></div>
        <div class="auth-grid"></div>
        <div class="auth-vignette"></div>
      </div>

      <div class="relative z-10 w-full max-w-md">
        <div class="auth-card card-glass rounded-3xl p-6 sm:p-8 flex flex-col gap-5 text-center items-center">

          <div class="auth-logo" style="background:#ef4444;color:#fff">
            <span class="[&>span>svg]:w-6 [&>span>svg]:h-6">${ic('lock')}</span>
          </div>

          <div class="flex flex-col gap-1.5">
            <h1 class="font-['Orbitron'] font-black text-lg tracking-[0.18em] text-red-400">
              CUENTA BLOQUEADA
            </h1>
            <p class="text-[10px] font-mono text-[var(--text-muted)] tracking-[0.12em]">
              OPERATIVO · ${nombre}
            </p>
          </div>

          <div role="alert"
               class="w-full rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-4
                      flex flex-col gap-2">
            <span class="label-caps" style="color:#f87171">Motivo</span>
            <p class="text-[13px] font-sans leading-relaxed text-[var(--text-main)] break-words">
              ${escapeTexto(texto)}
            </p>
          </div>

          ${fecha ? `
            <p class="text-[10px] font-mono text-[var(--text-muted)]">
              Suspendido el ${escapeTexto(fecha)}
            </p>
          ` : ''}

          <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">
            Tu partida sigue guardada. Un administrador tiene que levantar el
            bloqueo; no hay forma de hacerlo desde aquí.
          </p>

          <button type="button" id="reintentar"
                  class="btn-ghost w-full h-11 rounded-xl font-['Orbitron'] font-bold text-[11px]
                         tracking-[0.12em] cursor-pointer transition">
            COMPROBAR DE NUEVO
          </button>
        </div>
      </div>
    </div>
  `;

  // Recargar y no reintentar el acceso: la sesión sigue abierta, así que un
  // "volver a entrar" ni siquiera tendría nada que hacer. La recarga vuelve a
  // pasar por `onAuthStateChanged`, que es quien vuelve a preguntar a Firestore.
  container.querySelector('#reintentar')?.addEventListener('click', () => location.reload());
}

/**
 * Pantalla de "la partida ya está abierta en otro sitio".
 *
 * Es PARTE de `blocked.ts` y no un archivo aparte porque es la misma situación
 * vista desde el otro lado: hay una sesión viva y esta pestaña no puede tomar el
 * control. La diferencia es lo importante —esta vez **no es un castigo**, la otra
 * sesión sigue jugando— y por eso el texto no dice "bloqueada" en ningún sitio.
 *
 * Y a diferencia de la pantalla de bloqueo, esta **sí ofrece reintentar**: la
 * otra sesión se cierra sola en menos de un minuto, así que esperar es lo
 * correcto. Ofrecer solo recargar convertiría un contratiempo de un minuto en
 * algo que hay que resolver a mano.
 */
export function renderSesionOcupada(
  container: HTMLElement,
  datos: { nombre: string; alLiberarMs: number },
  onReintentar: () => void
): void {
  const segundos = Math.max(1, Math.ceil(datos.alLiberarMs / 1000));
  const nombre = escapeTexto(datos.nombre);

  container.innerHTML = `
    <div class="auth-scene w-screen h-dvh app-bg flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
      <div class="auth-bg" aria-hidden="true">
        <div class="auth-glow auth-glow-1"></div>
        <div class="auth-grid"></div>
        <div class="auth-vignette"></div>
      </div>

      <div class="relative z-10 w-full max-w-md">
        <div class="auth-card card-glass rounded-3xl p-6 sm:p-8 flex flex-col gap-5 text-center items-center">

          <div class="auth-logo" style="background:#f59e0b;color:#fff">
            <span class="[&>span>svg]:w-6 [&>span>svg]:h-6">${ic('lock')}</span>
          </div>

          <div class="flex flex-col gap-1.5">
            <h1 class="font-['Orbitron'] font-black text-lg tracking-[0.14em] text-amber-400">
              PARTIDA YA ABIERTA
            </h1>
            <p class="text-[10px] font-mono text-[var(--text-muted)] tracking-[0.12em]">
              ${nombre}
            </p>
          </div>

          <div role="status"
               class="w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4
                      flex flex-col gap-2 text-left">
            <p class="text-[13px] font-sans leading-relaxed text-[var(--text-main)]">
              Tienes el juego abierto en <strong>otro sitio</strong> —otro
              dispositivo u otra pestaña del navegador— y los dos a la vez se
              pisarían la partida.
            </p>
            <p class="text-[13px] font-sans leading-relaxed text-[var(--text-main)]">
              Tu partida sigue intacta ahí. <strong>Cierra la otra ventana</strong>
              y vuelve a entrar, o espera a que se libere sola.
            </p>
          </div>

          <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">
            La otra sesión se libera sola en unos ${segundos} segundos. Esta
            pantalla se prueba sola, no hace falta recargar.
          </p>

          <button type="button" id="reintentar-sesion"
                  class="btn-ghost w-full h-11 rounded-xl font-['Orbitron'] font-bold text-[11px]
                         tracking-[0.12em] cursor-pointer transition">
            PROBAR DE NUEVO
          </button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#reintentar-sesion')?.addEventListener('click', onReintentar);
}

/**
 * Escapa el motivo.
 *
 * Lo escribe un administrador, no el jugador, pero sigue siendo texto que
 * viene de la base de datos y esta pantalla lo pinta con `innerHTML`. Un motivo
 * con etiquetas dentro se ejecutaría en el navegador de todos los que lo vean.
 */
function escapeTexto(valor: unknown): string {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string;
  });
}
