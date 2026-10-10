// ==========================================================================
//  F103 · La primera pantalla: en qué servidor se juega.
//
//  Va ANTES del acceso porque la cuenta vive en un servidor: pedir el nombre
//  primero y el servidor después es pedir una llave sin decir de qué puerta.
//  Cada servidor tiene sus propios jugadores y partidas, y eso se dice aquí
//  mismo, no en letra pequeña: sin esa línea, quien viene del otro esperaría
//  su partida al otro lado y encontraría un registro vacío.
//
//  POR QUÉ ELEGIR RECARGA. `auth` y `db` son los singletons que importa todo
//  el proyecto y ya están creados cuando esta pantalla se pinta: cambiar de
//  backend sin recargar es tener dos sesiones vivas a la vez. La recarga solo
//  ocurre al elegir o al cambiar, nunca jugando, y la elección se guarda para
//  no volver a preguntar en cada visita.
//
//  `data-servidor` lleva la semántica (R7); las clases, solo el aspecto.
// ==========================================================================

import { ic } from '../ui/icons';
import type { ServidorId } from '../data/servidores';

export function renderServerSelect(
  container: HTMLElement,
  onElegir: (servidor: ServidorId) => void
): void {
  container.innerHTML = `
    <div class="auth-scene w-screen h-dvh app-bg flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
      <div class="auth-bg" aria-hidden="true">
        <div class="auth-glow auth-glow-1"></div>
        <div class="auth-glow auth-glow-2"></div>
        <div class="auth-grid"></div>
        <div class="auth-vignette"></div>
      </div>

      <div class="auth-brand relative z-10 text-center mb-5">
        <div class="auth-logo mx-auto mb-3">
          <span class="[&>span>svg]:w-6 [&>span>svg]:h-6">${ic('chip')}</span>
        </div>
        <h1 class="font-['Orbitron'] font-black text-xl sm:text-2xl accent-text tracking-[0.2em] leading-none">
          CYBER-FORGE
        </h1>
        <p class="text-[10px] text-[var(--text-muted)] font-mono mt-2 tracking-[0.15em]">
          ELIGE DÓNDE JUGAR
        </p>
      </div>

      <div class="relative z-10 w-full max-w-sm sm:max-w-md">
        <div class="auth-card card-glass rounded-3xl p-5 sm:p-7 flex flex-col gap-3">
          <button type="button" data-servidor="1"
                  class="w-full p-4 rounded-2xl border border-[var(--border-color)] text-left
                         cursor-pointer transition hover:border-[var(--accent)]">
            <span class="font-['Orbitron'] font-bold text-[13px] text-[var(--text-main)] tracking-[0.12em]">
              SERVIDOR 1
            </span>
            <span class="block text-[11px] font-mono text-[var(--text-muted)] mt-1 leading-relaxed">
              El de siempre: aquí está tu partida si ya jugabas.
            </span>
          </button>

          <button type="button" data-servidor="2"
                  class="w-full p-4 rounded-2xl border border-[var(--border-color)] text-left
                         cursor-pointer transition hover:border-[var(--accent)]">
            <span class="font-['Orbitron'] font-bold text-[13px] text-[var(--text-main)] tracking-[0.12em]">
              SERVIDOR 2
            </span>
            <span class="block text-[11px] font-mono text-[var(--text-muted)] mt-1 leading-relaxed">
              Para empezar de cero: jugadores y ranking nuevos.
            </span>
          </button>

          <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed text-center pt-1">
            Cada servidor guarda lo suyo: tu cuenta y tu partida de uno no viajan al otro.
          </p>
        </div>
      </div>
    </div>
  `;

  // Los manejadores van sobre los nodos recién creados, nunca sobre `#app`:
  // en `#app` se acumularían y una elección se guardaría N veces (R5).
  container.querySelectorAll('[data-servidor]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const elegido = (btn as HTMLElement).getAttribute('data-servidor');
      if (elegido === '1' || elegido === '2') onElegir(elegido);
    });
  });
}
