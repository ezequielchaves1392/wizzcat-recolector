// Cartel del premio de las cajas.
//
// Antes esto era una ruleta: el premio llegaba decidido por el game loop y una
// cinta lo enseñaba girando. La ruleta se ha quitado del juego entero (B17) y
// lo que queda es lo que la ruleta enseñaba al final: el cartel del premio,
// directo y sin giro. El premio sigue llegando decidido y aplicado por el
// motor, como siempre: aquí solo se enseña.
//
// Importante, y no ha cambiado: este cartel NO decide nada. Si se invirtiera el
// orden, se estaría mintiendo sobre las probabilidades reales.

import { sfx } from '../utils/audio';
import { ic, type IconName } from '../ui/icons';
import {
  lootAmountText, isCountedLoot, rarityClass,
  RARITY_GLOW, RARITY_TEXT, RARITY_RANK, CRATE_META,
  type CrateReward
} from './crateLoot';
import type { CrateType } from '../data/store';

/**
 * Cómo se llama la unidad de cada botín, para el rótulo bajo la cifra.
 *
 * Vive aquí y no en la tabla porque solo el cartel lo necesita, pero tiene que
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
 * Muestra el cartel del premio.
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
  `;
  document.body.appendChild(overlay);

  const result = document.createElement('div');
  result.dataset.role = 'result';
  result.className = 'flex flex-col items-center gap-3 flex-shrink-0 pb-2';
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

  if (isJackpot) sfx.jackpot(); else sfx.reward((RARITY_RANK[reward.rarity] ?? 0) >= 2);

  const finish = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    onClose();
  };
  result.querySelector('[data-role="close"]')?.addEventListener('click', finish);
  // Escape cierra: como ya no hay giro, el premio está revelado desde el
  // primer instante y no hay momento en el que cerrar deje sin verlo.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish();
  };
  document.addEventListener('keydown', onKey);
}
