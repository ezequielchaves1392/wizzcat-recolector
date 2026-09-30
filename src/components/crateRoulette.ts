// Ruleta horizontal de apertura de cajas.
//
// Importante: la ruleta NO decide el premio. `reward` llega ya decidido por el
// game loop y la animación se limita a enseñarlo. Si se invirtiera el orden,
// la ruleta estaría mintiendo sobre las probabilidades reales.

import { sfx } from '../utils/audio';
import { ic, type IconName } from '../ui/icons';
import {
  buildRouletteStrip, rarityClass, RARITY_GLOW, RARITY_TEXT, RARITY_RANK, CRATE_META,
  type CrateReward
} from './crateLoot';
import type { CrateType } from '../gameLoop';

const TILE_W = 96;   // ancho de casilla en desktop
const TILE_W_MOBILE = 78;
const SPIN_MS = 4200;

function tileHtml(t: { label: string; sub: string; rarity: string; icon: string }, width: number) {
  return `
    <div class="flex-shrink-0 flex flex-col items-center justify-center gap-1 rounded-xl
                border ${rarityClass(t.rarity)} card-glass"
         style="width:${width}px;height:${width + 24}px">
      <span class="[&>span>svg]:w-6 [&>span>svg]:h-6 ${RARITY_TEXT[t.rarity] || ''} leading-none">${ic(t.icon as IconName)}</span>
      <span class="text-[9px] font-mono text-center leading-tight px-1 line-clamp-2 w-full ${RARITY_TEXT[t.rarity] || ''}">${t.label}</span>
      <span class="text-[9px] font-mono uppercase tracking-wider ${RARITY_TEXT[t.rarity] || ''} opacity-70">${t.sub}</span>
    </div>
  `;
}

/**
 * Muestra la ruleta y al terminar el cartel del objeto.
 * `onClose` se llama cuando el jugador acepta el premio.
 */
export function showCrateRoulette(reward: CrateReward, crateType: CrateType, onClose: () => void) {
  const isMobile = window.innerWidth < 640;
  const tileW = isMobile ? TILE_W_MOBILE : TILE_W;
  const stripLen = 26;
  // El premio cae hacia el final para que la ruleta "gire de verdad"
  const winIndex = 20;
  const { tiles } = buildRouletteStrip(crateType, stripLen);

  // Insertamos el premio en su posicion
  tiles[winIndex] = {
    label: reward.name.length > 16 ? reward.name.slice(0, 15) + '…' : reward.name,
    sub: reward.rarity,
    rarity: reward.rarity,
    icon: reward.icon
  };

  const meta = CRATE_META[crateType];
  const rarityColor = rarityClass(reward.rarity);
  const rarityGlow = RARITY_GLOW[reward.rarity] || '';
  const isJackpot = (RARITY_RANK[reward.rarity] ?? 0) >= 4;
  const alreadyStored = Boolean(reward.item);

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 p-4 app-bg overflow-y-auto';
  overlay.innerHTML = `
    <div class="text-center flex-shrink-0">
      <div class="mb-2 [&>span>svg]:w-9 [&>span>svg]:h-9" style="color: var(--accent)">${ic(meta.icon as IconName)}</div>
      <h2 class="font-['Orbitron'] font-black text-lg tracking-wider" style="color: var(--accent)">${meta.name.toUpperCase()}</h2>
      <p class="text-[10px] font-mono mt-1" style="color: var(--text-muted)">DESBLOQUEANDO CARGA…</p>
    </div>

    <div class="relative w-full max-w-2xl select-none flex-shrink-0">
      <!-- Ventana de la ruleta con mask -->
      <div class="relative overflow-hidden rounded-2xl border py-4"
           style="border-color: var(--border-color); background: color-mix(in srgb, var(--bg-app) 70%, transparent)">
        <div id="roulette-track" class="flex gap-2 px-1 will-change-transform">
          ${tiles.map(t => tileHtml(t, tileW)).join('')}
        </div>
        <!-- Máscara de degradados en los extremos -->
        <div class="pointer-events-none absolute inset-y-0 left-0 w-16" style="background: linear-gradient(to right, var(--bg-app), transparent)"></div>
        <div class="pointer-events-none absolute inset-y-0 right-0 w-16" style="background: linear-gradient(to left, var(--bg-app), transparent)"></div>
        <!-- Marcador central -->
        <div class="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px]" style="background: var(--accent); box-shadow: 0 0 14px var(--accent)"></div>
        <div class="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0" style="border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid var(--accent)"></div>
      </div>
    </div>

    <div id="roulette-result" class="opacity-0 transition-opacity duration-300 flex flex-col items-center gap-3 flex-shrink-0 pb-2">
      <div id="result-card" class="card-glass-elevated border ${rarityColor} rounded-2xl px-6 py-5 flex flex-col items-center gap-2 ${rarityGlow} max-w-sm text-center">
        <div class="mb-1 [&>span>svg]:w-12 [&>span>svg]:h-12 ${RARITY_TEXT[reward.rarity] || ''}">${ic(reward.icon as IconName)}</div>
        <div class="font-['Orbitron'] font-bold text-base ${RARITY_TEXT[reward.rarity] || ''}">${reward.name}</div>
        <div class="text-[11px] font-mono uppercase tracking-wider ${RARITY_TEXT[reward.rarity] || ''} opacity-80">${reward.rarity}${reward.exclusive ? ' · EXCLUSIVO' : ''}</div>
        <div class="text-xs font-mono mt-1" style="color: var(--text-main)">${reward.details}</div>
        ${alreadyStored ? `<div class="text-[10px] font-mono mt-1" style="color: var(--text-muted)">✓ Guardado en el almacén</div>` : ''}
      </div>
      <button id="roulette-close" class="px-6 py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
        CONTINUAR
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  const track = overlay.querySelector('#roulette-track') as HTMLElement;
  const resultBox = overlay.querySelector('#roulette-result') as HTMLElement;

  // Posición final: hay que desplazar la pista lo justo para que el CENTRO de la
  // casilla ganadora quede bajo el marcador central, que está en el punto medio
  // del ancho visible. Desplazamos (indexCasilla + anchoCasilla/2 - mitadVentana).
  const gap = 8;
  const step = tileW + gap;
  const targetX = -(winIndex * step + tileW / 2 - (track.parentElement!.clientWidth / 2));

  sfx.spinStart();

  // La animación va por CSS, no por rAF: el navegador no ejecuta rAF en pestañas
  // ocultas y la ruleta se quedaría congelada a la primera casilla.
  track.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`;
  track.style.transform = `translate3d(${targetX}px,0,0)`;

  // Ticks de sonido mientras avanza: se programa por tiempo, no por fotograma
  const totalMs = SPIN_MS;
  const totalSteps = Math.max(1, Math.floor(Math.abs(targetX) / step));
  const tickEvery = Math.max(28, Math.floor(totalMs / totalSteps));
  for (let t = tickEvery; t < totalMs; t += tickEvery) {
    setTimeout(() => sfx.tick(), t);
  }

  const finished = { value: false };
  const onTransitionEnd = (e: TransitionEvent) => {
    if (e.propertyName !== 'transform' || finished.value) return;
    finished.value = true;
    showResult();
  };
  track.addEventListener('transitionend', onTransitionEnd);
  // Respaldo: si el navegador no emite transitionend, se revela igual
  setTimeout(() => {
    if (!finished.value) {
      finished.value = true;
      showResult();
    }
  }, SPIN_MS + 350);

  function showResult() {
    // Resaltar la casilla ganadora
    const winEl = track.children[winIndex] as HTMLElement | undefined;
    if (winEl) {
      winEl.classList.add('scale-110', 'z-10');
      winEl.style.transition = 'transform 220ms ease-out, box-shadow 220ms';
      winEl.style.boxShadow = '0 0 28px var(--accent)';
    }
    if (isJackpot) sfx.jackpot(); else sfx.reward((RARITY_RANK[reward.rarity] ?? 0) >= 2);

    resultBox.classList.remove('opacity-0');
    resultBox.classList.add('opacity-100');
  }

  const closeBtn = overlay.querySelector('#roulette-close');
  const finish = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    onClose();
  };
  closeBtn?.addEventListener('click', finish);
  // Escape cierra, pero solo cuando el premio ya está revelado: si se cerrara
  // durante el giro el jugador se quedaría sin ver lo que ha ganado
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && finished.value) finish();
  };
  document.addEventListener('keydown', onKey);
}
