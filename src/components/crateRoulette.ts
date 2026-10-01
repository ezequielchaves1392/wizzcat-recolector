// Ruleta horizontal de apertura de cajas.
//
// Importante: la ruleta NO decide el premio. `reward` llega ya decidido por el
// game loop y la animación se limita a enseñarlo. Si se invirtiera el orden,
// la ruleta estaría mintiendo sobre las probabilidades reales.
//
// La mecánica del carril —la ventana, las casillas y el giro— vive en
// `rouletteStrip.ts`, que la comparte con la ruleta del sintonizador. Aquí solo
// queda lo que es de las cajas: qué se anuncia arriba, cómo se pinta el cartel
// del premio y qué suena al ganarlo.

import { sfx } from '../utils/audio';
import { ic, type IconName } from '../ui/icons';
import {
  buildRouletteStrip, makeRouletteTile,
  lootAmountText, isCountedLoot, rarityClass,
  RARITY_GLOW, RARITY_TEXT, RARITY_RANK, CRATE_META,
  type CrateReward
} from './crateLoot';
import { mountStrip, spinTrack } from './rouletteStrip';
import type { CrateType } from '../gameLoop';

/**
 * Cuánto dura el trompo de las cajas.
 *
 * POR QUÉ 5200 Y NO MÁS. Lo que da emoción a una tirada no es el tiempo: es el
 * FRENADO. Con la curva de antes (`0.16, 1, 0.3, 1`) el 90% del camino se
 * recorría en el primer 25% del tiempo, así que cuatro segundos eran un segundo
 * de trompo y tres de arrastre: el ojo abandona la tirada mucho antes de que
 * termine y el final se lee como "esto que dura tanto no está pasando nada".
 * Ahora la curva es la de `FRENADO` (`rouletteSpin.ts`), que es una deceleración
 * constante, y el último medio segundo va casilla a casilla. Eso es
 * anticipación: el jugador mira a dónde se acerca.
 *
 * Y con la cuenta de vueltas de `rouletteSpin.ts` el desplazamiento son unas
 * tres vueltas de la ventana, de modo que 5200 ms salen a una velocidad punta
 * de ~20 casillas por segundo: rápida de verdad al principio y lenta de verdad
 * al final. Subirlo a 7000 no buyería nada más de tensión, solo más espera.
 *
 * El sintonizador usa 2400 ms y dos vueltas a propósito (`tuningRoulette.ts`):
 * se tira docenas de veces por partida y ahí el volteo largo no compra nada.
 */
const SPIN_MS = 5200;

/**
 * Cómo se llama la unidad de cada botín, para el rótulo bajo la cifra.
 *
 * Vive aquí y no en la tabla porque solo la ruleta lo necesita, pero tiene que
 * ser el MISMO diccionario para todos: si las nanitas se anunciaran como
 * "Nanitas" en un sitio y como "Monedas" en otro, el jugador leería dos juegos
 * distintos en la misma pantalla.
 */
const LOOT_UNITS: Record<string, string> = {
  nanites: 'Nanitas',
  crystals: 'Cristales',
  keys: 'Llaves',
  crate: 'Cajas',
  consumable: 'Unidades'
};

/**
 * Muestra la ruleta y al terminar el cartel del objeto.
 * `onClose` se llama cuando el jugador acepta el premio.
 */
export function showCrateRoulette(reward: CrateReward, crateType: CrateType, onClose: () => void) {
  const meta = CRATE_META[crateType];
  const rarityColor = rarityClass(reward.rarity);
  const rarityGlow = RARITY_GLOW[reward.rarity] || '';
  const isJackpot = (RARITY_RANK[reward.rarity] ?? 0) >= 4;
  const alreadyStored = Boolean(reward.item);
  // La cifra va en grande, por encima del nombre, porque es la respuesta a la
  // pregunta que el jugador se hace al cerrar la caja: cuánto me ha tocado. Si
  // solo aparece en la `details` ("Materia prima básica") hay que restar el
  // saldo de antes del de después para averiguarlo.
  const showAmount = isCountedLoot(reward);
  const unit = LOOT_UNITS[reward.kind] ?? '';
  // "Nanitas" sobre "Nanitas" es ruido. En el resto de botines el nombre aporta
  // ("Cristales de Mejora" dice de qué material es), así que se conserva.
  const nameIsUnit = unit !== '' && reward.name.trim().toLowerCase() === unit.toLowerCase();

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 p-4 app-bg overflow-y-auto';
  overlay.innerHTML = `
    <div class="text-center flex-shrink-0">
      <div class="mb-2 [&>span>svg]:w-9 [&>span>svg]:h-9" style="color: var(--accent)">${ic(meta.icon as IconName)}</div>
      <h2 class="font-['Orbitron'] font-black text-lg tracking-wider" style="color: var(--accent)">${meta.name.toUpperCase()}</h2>
      <p class="text-[10px] font-mono mt-1" style="color: var(--text-muted)">DESBLOQUEANDO CARGA…</p>
    </div>

    <!-- SIN BACKTICKS EN ESTE COMENTARIO. Va dentro de un template literal, así que
         un identificador marcado cerraría la cadena en ese punto y el resto
         del HTML se leería como código. Los identificadores van sin marcar y el
         porqué vive en el comentario de TypeScript de mountStrip. -->
    <div data-role="strip" class="contents"></div>
  `;
  document.body.appendChild(overlay);

  // El cartel se cuelga ANTES de montar la cinta, a propósito. El destino del
  // trompo sale de una medición, y medir con medio overlay puesto es medir una
  // ventana que luego no es la que hay: el overlay lleva `overflow-y-auto`, así
  // que si el cartel hace la pantalla demasiado alta, aparece la barra de scroll,
  // la ventana se estrecha y la aguja se mueve de sitio. Con el cartel ya
  // dentro, la medición lo tiene en cuenta y la casilla para clavada sin
  // necesitar la pasada de corrección final.
  const result = document.createElement('div');
  result.dataset.role = 'result';
  result.className = 'opacity-0 transition-opacity duration-300 flex flex-col items-center gap-3 flex-shrink-0 pb-2';
  result.innerHTML = `
    <div class="card-glass-elevated border ${rarityColor} rounded-2xl px-6 py-5 flex flex-col items-center gap-2 ${rarityGlow} max-w-sm text-center">
      <div class="mb-1 [&>span>svg]:w-12 [&>span>svg]:h-12 ${RARITY_TEXT[reward.rarity] || ''}">${ic(reward.icon as IconName)}</div>
      ${showAmount ? `
      <div class="font-['Orbitron'] font-black text-3xl leading-none tabular-nums ${RARITY_TEXT[reward.rarity] || ''}">
        ${lootAmountText(reward)}
      </div>
      <div class="text-[9px] font-mono uppercase tracking-[0.2em] -mt-1" style="color: var(--text-muted)">${unit}</div>` : ''}
      ${nameIsUnit ? '' : `<div class="font-['Orbitron'] font-bold text-base ${RARITY_TEXT[reward.rarity] || ''}">${reward.name}</div>`}
      <div class="text-[11px] font-mono uppercase tracking-wider ${RARITY_TEXT[reward.rarity] || ''} opacity-80">${reward.rarity}${reward.exclusive ? ' · EXCLUSIVO' : ''}</div>
      <div class="text-xs font-mono mt-1" style="color: var(--text-main)">${reward.details}</div>
      ${alreadyStored ? `<div class="text-[10px] font-mono mt-1" style="color: var(--text-muted)">✓ Guardado en el almacén</div>` : ''}
      ${reward.cosmeticId ? `<div class="text-[10px] font-mono mt-1 accent-text">✓ Desbloqueado · equípalo en el Perfil</div>` : ''}
    </div>
    <button data-role="close" class="px-6 py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
      CONTINUAR
    </button>`;
  overlay.appendChild(result);

  // La cinta se mide antes de pintarse, porque cuántas casillas hacen falta
  // depende de cuántas caben en la ventana. Eso lo decide `geometria()`.
  const mount = mountStrip(overlay.querySelector('[data-role="strip"]') as HTMLElement, (giro) => {
    const { tiles } = buildRouletteStrip(crateType, giro.casillas);
    // Insertamos el premio en su posicion. La casilla usa el mismo constructor
    // que las distracciones: si la ganadora se escribiera a mano, cualquier
    // cambio en cómo se enseña una cifra (el "+", el separador de millares)
    // llegaría a una casilla y no a la otra, y el jugador vería dos verdades
    // distintas en la misma pantalla.
    tiles[giro.winIndex] = makeRouletteTile(reward);
    return tiles;
  });

  const finished = { value: false };
  spinTrack(mount, SPIN_MS, () => {
    finished.value = true;
    if (isJackpot) sfx.jackpot(); else sfx.reward((RARITY_RANK[reward.rarity] ?? 0) >= 2);

    result.classList.remove('opacity-0');
    result.classList.add('opacity-100');
  });

  const finish = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    onClose();
  };
  result.querySelector('[data-role="close"]')?.addEventListener('click', finish);
  // Escape cierra, pero solo cuando el premio ya está revelado: si se cerrara
  // durante el giro el jugador se quedaría sin ver lo que ha ganado
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && finished.value) finish();
  };
  document.addEventListener('keydown', onKey);
}
