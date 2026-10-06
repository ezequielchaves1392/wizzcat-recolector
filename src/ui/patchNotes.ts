// ==========================================================================
//  El cartel de notas de parche
// ==========================================================================
//  POR QUÉ UN CARTEL Y NO UNA PÁGINA.
//
//  Es un aviso de "ha pasado algo mientras no estabas", y un aviso tiene que estar en la
//  pantalla al entrar, sin que el jugador tenga que buscarlo. Una página sería mejor
//  archivo y peor cartel: nadie la abriría.
//
//  Y tiene que poder **cerrarse con el dedo en cualquier parte y con el botón**, porque
//  en un móvil es un gesto y en un teclado es una tecla. El Escape cierra, el botón
//  cierra y tocar el fondo cierra: son tres formas de hacer lo mismo y por eso el cierre
//  está en una función y no en tres sitios.
//
//  LO QUE NO HACE, Y ES LO IMPORTANTE: no decide si mostrar. Eso es
//  `debeMostrarNotas()`, que es una regla comprobable con un banco, porque "cuándo sale
//  un cartel" es exactamente el tipo de cosa que se rompe en silencio —un cartel que sale
//  cada vez, o uno que no sale nunca— y las dos son invisibles en una partida normal.
// ==========================================================================

import { ic } from './icons';
import { VERSION, NOTAS, notaDeEstaVersion } from '../data/patchNotes';
import { getPatchNotes, getNotasVistas, setNotasVistas } from '../patchNotesPrefs';

/**
 * Si toca cartel, y por qué no lo hemos marcado como visto todavía.
 *
 * **SON TRES CONDICIONES Y LAS TRES IMPORTAN.** Sin nota de esta versión no hay nada que
 * enseñar. Con la preferencia apagada, no. Y si ya se vio esta versión, no: que es lo
 * que evita el cartel en cada recarga.
 *
 * Se exporta sin DOM a propósito, para que el banco lo pueda preguntar.
 */
export function debeMostrarNotas(): { mostrar: boolean; motivo: string } {
  if (!notaDeEstaVersion()) return { mostrar: false, motivo: 'sin nota para esta versión' };
  if (!getPatchNotes()) return { mostrar: false, motivo: 'desactivado en ajustes' };
  if (getNotasVistas() === VERSION) return { mostrar: false, motivo: 'ya visto' };
  return { mostrar: true, motivo: 'versión nueva' };
}

/**
 * El cartel, si toca. Devuelve si se ha llegado a montar.
 *
 * Marca la versión como vista **al montar**, no al cerrar: si el jugador cierra la
 * pestaña sin cerrar el cartel, ya lo ha visto igual —estaba en su pantalla— y marcarlo
 * solo al cerrar haría que le volviera a salir hasta que pulsara algo.
 */
export function showPatchNotes(): boolean {
  if (!debeMostrarNotas().mostrar) return false;
  setNotasVistas(VERSION);
  return montarNotas();
}

/**
 * Las notas, siempre, sin preguntar nada.
 *
 * **ESTO ES SEPARADO DE `showPatchNotes()` A PROPÓSITO, Y LA SEPARACIÓN TIENE SENTIDO.**
 * El cartel al entrar tiene tres condiciones —hay nota, la preferencia está puesta y no se
 * ha visto todavía— y está bien que las tenga: si no, sale en cada recarga.
 *
 * El botón de Ajustes es otra cosa: es el jugador **preguntando**. Si al botón le colgaran
 * las tres condiciones,passaría una de dos cosas: aparecería "Notas de parche" y no
 * haría nada si ya las habías visto, que es justo cuando se va a buscarlas; o habría que
 * quitarle el gate al cartel y entonces reaparece en cada recarga. **Ninguna de las dos
 * es un botón.**
 *
 * Y tampoco marca la versión como vista: quien las lee a pedido ya las ha visto, y quien
 * las había saltado porque no le interesan no debe encontrárselas marcadas solo por
 * haber abierto el botón una vez.
 */
export function montarNotas(): boolean {
  if (!notaDeEstaVersion()) return false;

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 app-bg';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Notas de parche');

  const notas = NOTAS.map(n => `
    <section class="mb-4 last:mb-0">
      <div class="flex items-baseline gap-2 mb-1.5">
        <span class="font-['Orbitron'] font-bold text-[13px] accent-text">${n.version}</span>
        <span class="text-[10px] font-mono text-[var(--text-muted)]">${n.fecha}</span>
      </div>
      <div class="text-[12px] font-bold text-[var(--text-main)] mb-1.5">${n.titulo}</div>
      <ul class="space-y-1.5">
        ${n.lineas.map(t => `
          <li class="text-[11px] leading-relaxed text-[var(--text-muted)] flex gap-2">
            <span class="accent-text flex-shrink-0 mt-[6px]">&bull;</span>
            <span class="min-w-0">${t}</span>
          </li>`).join('')}
      </ul>
    </section>`).join('');

  overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/60" data-notas-cerrar></div>
    <div class="relative card-glass-elevated border rounded-2xl w-full max-w-md max-h-[80dvh] flex flex-col
                pointer-events-auto" style="padding-bottom: calc(1.25rem + env(safe-area-inset-bottom))">
      <div class="flex items-start gap-3 mb-3 flex-shrink-0">
        <span class="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 accent-bg"
              style="color: var(--accent)">
          <span class="[&>span>svg]:w-6 [&>span>svg]:h-6">${ic('scroll')}</span>
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="font-['Orbitron'] font-bold text-[15px] text-[var(--text-main)] leading-tight">
            Notas de parche
          </h2>
          <div class="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
            Versión ${VERSION}
          </div>
        </div>
        <button data-notas-cerrar aria-label="Cerrar"
                class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0">
          <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('close')}</span>
        </button>
      </div>

      <div class="overflow-y-auto overscroll-contain flex-1 pr-1">${notas}</div>

      <button data-notas-cerrar
              class="mt-3 w-full py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs
                     rounded-xl hover:opacity-90 transition cursor-pointer flex-shrink-0">
        ENTENDIDO
      </button>

      <p class="text-[9px] font-mono text-[var(--text-muted)] mt-2 text-center leading-relaxed flex-shrink-0">
        Se puede desactivar en Ajustes.
      </p>
    </div>`;

  const cerrar = () => {
    document.removeEventListener('keydown', onTecla);
    overlay.remove();
  };
  const onTecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };

  overlay.querySelectorAll('[data-notas-cerrar]').forEach(el =>
    el.addEventListener('click', cerrar));
  document.addEventListener('keydown', onTecla);
  document.body.appendChild(overlay);
  return true;
}
